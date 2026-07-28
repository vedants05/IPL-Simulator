import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultHomeBoundaryDimensions,
  createDefaultHomePitchSelections,
  getHomeStadium,
  getStadiumBoundaryLimits,
} from "@/lib/data/pitchCurator";
import { addDaysToDateKey } from "@/lib/logic/careerCalendar";
import { DEFAULT_PITCH_SLIDERS, PITCH_DESTRUCTION_DAYS } from "@/lib/logic/pitchCreator";
import {
  createDefaultHomeOutfieldSettings,
  getDefaultOutfieldSettings,
} from "@/lib/logic/stadiumManagement";

test("custom pitch projects persist through creation, selection and removal", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  const testGlobal = globalThis as typeof globalThis & { WebSocket?: typeof WebSocket };
  testGlobal.WebSocket ??= class TestWebSocket {} as unknown as typeof WebSocket;
  const { useGameStore } = await import("./gameStore");
  const stadium = getHomeStadium("KKR")!;
  useGameStore.setState({
    userTeamId: "KKR",
    currentDate: "2027-01-01",
    homePitchSelections: createDefaultHomePitchSelections(),
    homeBoundaryDimensions: createDefaultHomeBoundaryDimensions(),
    customPitchesByTeam: {},
    pitchProjectsByTeam: {},
    boundaryPresetsByTeam: {},
    homeOutfieldSettings: createDefaultHomeOutfieldSettings(),
    outfieldProjectsByTeam: {},
  });

  assert.equal(
    useGameStore.getState().startPitchCreation("KKR", "black", DEFAULT_PITCH_SLIDERS),
    true,
  );
  const creationProject = useGameStore.getState().pitchProjectsByTeam.KKR;
  assert.equal(creationProject?.kind, "create");
  assert.equal(useGameStore.getState().customPitchesByTeam.KKR, undefined);
  assert.equal(
    useGameStore.getState().startPitchCreation("KKR", "red", DEFAULT_PITCH_SLIDERS),
    false,
    "a second grounds project cannot start while creation is underway",
  );

  useGameStore.setState({ currentDate: creationProject!.completesOn });
  useGameStore.getState().reconcilePitchProjects();
  const completedPitch = useGameStore.getState().customPitchesByTeam.KKR?.[0];
  assert.ok(completedPitch);
  assert.equal(useGameStore.getState().pitchProjectsByTeam.KKR, undefined);

  useGameStore.getState().setHomePitchSelection("KKR", completedPitch.id);
  assert.equal(useGameStore.getState().homePitchSelections.KKR, completedPitch.id);
  assert.equal(
    useGameStore.getState().startPitchDestruction("KKR", completedPitch.id),
    false,
    "the pitch in use cannot be removed",
  );

  useGameStore.getState().setHomePitchSelection("KKR", stadium.defaultPitchId);
  assert.equal(useGameStore.getState().startPitchDestruction("KKR", completedPitch.id), true);
  const destructionProject = useGameStore.getState().pitchProjectsByTeam.KKR;
  assert.equal(destructionProject?.kind, "destroy");
  assert.equal(
    destructionProject?.completesOn,
    addDaysToDateKey(creationProject!.completesOn, PITCH_DESTRUCTION_DAYS),
  );

  useGameStore.setState({ currentDate: destructionProject!.completesOn });
  useGameStore.getState().reconcilePitchProjects();
  assert.equal(useGameStore.getState().customPitchesByTeam.KKR?.length, 0);
  assert.equal(useGameStore.getState().pitchProjectsByTeam.KKR, undefined);
  assert.equal(useGameStore.getState().homePitchSelections.KKR, stadium.defaultPitchId);

  useGameStore.getState().setHomeBoundaryDimensions("KKR", { straightMetres: 74 });
  assert.deepEqual(useGameStore.getState().homeBoundaryDimensions.KKR, {
    straightMetres: 74,
    wideMetres: stadium.defaultBoundaryDimensions.wideMetres,
  });
  useGameStore.getState().setHomeBoundaryDimensions("KKR", {
    straightMetres: 500,
    wideMetres: 67,
  });
  assert.deepEqual(useGameStore.getState().homeBoundaryDimensions.KKR, {
    straightMetres: getStadiumBoundaryLimits("KKR")?.straightMaximum,
    wideMetres: 67,
  });
  assert.equal(stadium.capacity, 67_551);

  const presetId = useGameStore.getState().saveBoundaryPreset(
    "KKR",
    "Powerplay setup",
    { straightMetres: 62, wideMetres: 58 },
  );
  assert.ok(presetId);
  assert.equal(useGameStore.getState().boundaryPresetsByTeam.KKR?.length, 1);

  useGameStore.getState().setHomeBoundaryDimensions("KKR", {
    straightMetres: 70,
    wideMetres: 68,
  });
  assert.equal(useGameStore.getState().applyBoundaryPreset("KKR", presetId!), true);
  assert.deepEqual(useGameStore.getState().homeBoundaryDimensions.KKR, {
    straightMetres: 62,
    wideMetres: 58,
  });

  const overwrittenId = useGameStore.getState().saveBoundaryPreset(
    "KKR",
    "powerplay setup",
    { straightMetres: 64, wideMetres: 60 },
  );
  assert.equal(overwrittenId, presetId);
  assert.equal(useGameStore.getState().boundaryPresetsByTeam.KKR?.length, 1);
  assert.deepEqual(
    useGameStore.getState().boundaryPresetsByTeam.KKR?.[0]?.dimensions,
    { straightMetres: 64, wideMetres: 60 },
  );

  assert.equal(useGameStore.getState().deleteBoundaryPreset("KKR", presetId!), true);
  assert.equal(useGameStore.getState().boundaryPresetsByTeam.KKR?.length, 0);

  const defaultOutfield = getDefaultOutfieldSettings("KKR")!;
  assert.equal(useGameStore.getState().startOutfieldPreparation("KKR", {
    ...defaultOutfield,
    grassHeightMm: defaultOutfield.grassHeightMm + 2,
  }), true);
  const outfieldProject = useGameStore.getState().outfieldProjectsByTeam.KKR;
  assert.ok(outfieldProject);
  assert.equal(
    useGameStore.getState().homeOutfieldSettings.KKR.grassHeightMm,
    defaultOutfield.grassHeightMm,
    "the active outfield should not change while preparation is underway",
  );
  useGameStore.setState({ currentDate: outfieldProject!.completesOn });
  useGameStore.getState().reconcileOutfieldProjects();
  assert.equal(
    useGameStore.getState().homeOutfieldSettings.KKR.grassHeightMm,
    defaultOutfield.grassHeightMm + 2,
  );
  assert.equal(useGameStore.getState().outfieldProjectsByTeam.KKR, undefined);
});
