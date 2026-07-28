import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultHomeBoundaryDimensions,
  createDefaultHomePitchSelections,
  getCuratorPitch,
  getDefaultCuratorPitch,
  getHomeStadium,
  getStadiumBoundaryLimits,
  HOME_STADIUMS,
  MIN_BOUNDARY_LENGTH_METRES,
  normalizeHomeBoundaryDimensions,
  normalizeHomePitchSelections,
} from "./pitchCurator";

const TEAM_IDS = ["MI", "CSK", "KKR", "RCB", "DC", "LSG", "SRH", "GT", "RR", "PBKS"] as const;

test("registers one home stadium for every IPL team", () => {
  assert.equal(HOME_STADIUMS.length, TEAM_IDS.length);
  assert.deepEqual(
    [...HOME_STADIUMS.map((stadium) => stadium.teamId)].sort(),
    [...TEAM_IDS].sort(),
  );
  TEAM_IDS.forEach((teamId) => assert.ok(getHomeStadium(teamId)));
});

test("registers fixed capacities and representative default boundaries", () => {
  const expectedCapacities = {
    KKR: 67_551,
    RCB: 33_677,
    MI: 33_210,
    CSK: 37_505,
    DC: 37_306,
    LSG: 47_165,
    SRH: 39_952,
    GT: 135_000,
    RR: 23_400,
    PBKS: 31_150,
  };
  const expectedBoundaries = {
    KKR: { straightMetres: 71, wideMetres: 69 },
    RCB: { straightMetres: 65, wideMetres: 60 },
    MI: { straightMetres: 72, wideMetres: 66 },
    CSK: { straightMetres: 65, wideMetres: 68 },
    DC: { straightMetres: 70, wideMetres: 65 },
    LSG: { straightMetres: 70, wideMetres: 65 },
    SRH: { straightMetres: 70, wideMetres: 67 },
    GT: { straightMetres: 75, wideMetres: 65 },
    RR: { straightMetres: 68, wideMetres: 68 },
    PBKS: { straightMetres: 72, wideMetres: 73 },
  };

  HOME_STADIUMS.forEach((stadium) => {
    assert.equal(stadium.capacity, expectedCapacities[stadium.teamId]);
    assert.deepEqual(stadium.defaultBoundaryDimensions, expectedBoundaries[stadium.teamId]);
    const limits = getStadiumBoundaryLimits(stadium.teamId);
    assert.ok(limits);
    Object.values(stadium.defaultBoundaryDimensions).forEach((metres) => {
      assert.ok(metres >= MIN_BOUNDARY_LENGTH_METRES);
    });
    assert.equal(
      limits.straightMaximum,
      stadium.defaultBoundaryDimensions.straightMetres + 5,
    );
    assert.equal(
      limits.wideMaximum,
      stadium.defaultBoundaryDimensions.wideMetres + 5,
    );
  });
});

test("straight and wide boundaries remain independently changeable", () => {
  const defaults = createDefaultHomeBoundaryDimensions();
  const normalized = normalizeHomeBoundaryDimensions({
    KKR: { straightMetres: 74, wideMetres: 67 },
    RCB: { straightMetres: 500, wideMetres: 20 },
    MI: "invalid",
  });

  assert.deepEqual(normalized.KKR, { straightMetres: 74, wideMetres: 67 });
  assert.deepEqual(normalized.RCB, {
    straightMetres: getStadiumBoundaryLimits("RCB")?.straightMaximum,
    wideMetres: MIN_BOUNDARY_LENGTH_METRES,
  });
  assert.deepEqual(normalized.MI, defaults.MI);
  assert.deepEqual(normalized.CSK, defaults.CSK);
});

test("registers complete outfield details for every stadium", () => {
  HOME_STADIUMS.forEach((stadium) => {
    assert.ok(stadium.outfield.grass.length > 0);
    assert.ok(stadium.outfield.drainage.length > 0);
    assert.ok(stadium.outfield.description.length > 0);
    assert.ok(stadium.outfield.speedRating >= 1);
    assert.ok(stadium.outfield.speedRating <= 10);
  });
});

test("legacy single boundary values migrate into both directions", () => {
  const normalized = normalizeHomeBoundaryDimensions({
    KKR: 70,
    MI: 64,
  });

  assert.deepEqual(
    normalized.KKR,
    getHomeStadium("KKR")?.defaultBoundaryDimensions,
    "the old KKR default should upgrade to the new directional defaults",
  );
  assert.deepEqual(normalized.MI, { straightMetres: 64, wideMetres: 64 });
});

test("registers all 22 supplied curator pitches with valid score ranges", () => {
  const pitches = HOME_STADIUMS.flatMap((stadium) => stadium.pitches);
  assert.equal(pitches.length, 22);

  const pitchIds = pitches.map((pitch) => pitch.id);
  assert.equal(new Set(pitchIds).size, pitchIds.length);

  pitches.forEach((pitch) => {
    assert.ok(pitch.expectedFirstInningsScore.min < pitch.expectedFirstInningsScore.max);
    assert.equal(getCuratorPitch(pitch.id)?.name, pitch.name);
  });
});

test("surface characteristics only describe pitch and bowling behaviour", () => {
  const forbiddenNonPitchDetails = /\b(outfield|boundar(?:y|ies)|altitude|dew|running between|shots?)\b/i;
  const pitchBehaviour = /\b(pace|seam|spin|turn|bounce|carry|grip|surface|pitch|cutter|cutters|slower|movement|ball|bowling)\b/i;

  HOME_STADIUMS.flatMap((stadium) => stadium.pitches).forEach((pitch) => {
    pitch.characteristics.forEach((characteristic) => {
      assert.equal(
        forbiddenNonPitchDetails.test(characteristic),
        false,
        `${pitch.name} contains a non-pitch characteristic: ${characteristic}`,
      );
      assert.match(
        characteristic,
        pitchBehaviour,
        `${pitch.name} does not describe a pitch or bowling response: ${characteristic}`,
      );
    });
  });
});

test("every default pitch belongs to its registered home stadium", () => {
  HOME_STADIUMS.forEach((stadium) => {
    assert.ok(stadium.pitches.some((pitch) => pitch.id === stadium.defaultPitchId));
    assert.equal(getDefaultCuratorPitch(stadium.teamId)?.id, stadium.defaultPitchId);
  });
});

test("uses the requested second-pitch defaults for CSK, KKR and LSG", () => {
  assert.equal(getDefaultCuratorPitch("CSK")?.name, "Clay Sporting Track");
  assert.equal(getDefaultCuratorPitch("KKR")?.name, "Black Soil Turner");
  assert.equal(getDefaultCuratorPitch("LSG")?.name, "Red Soil Pace Track");
});

test("uses the first pitch as the default for every other club", () => {
  const secondPitchDefaultTeams = new Set(["CSK", "KKR", "LSG"]);
  HOME_STADIUMS
    .filter((stadium) => !secondPitchDefaultTeams.has(stadium.teamId))
    .forEach((stadium) => assert.equal(stadium.defaultPitchId, stadium.pitches[0]?.id));
});

test("normalizes saved selections and rejects pitches belonging to another team", () => {
  const defaults = createDefaultHomePitchSelections();
  const normalized = normalizeHomePitchSelections({
    MI: "wankhede-dry-red-surface",
    KKR: "wankhede-red-soil-express",
    CSK: "missing-pitch",
  });

  assert.equal(normalized.MI, "wankhede-dry-red-surface");
  assert.equal(normalized.KKR, defaults.KKR);
  assert.equal(normalized.CSK, defaults.CSK);
});
