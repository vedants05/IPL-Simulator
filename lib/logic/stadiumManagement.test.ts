import assert from "node:assert/strict";
import test from "node:test";

import { getHomeStadium, getStadiumBoundaryLimits } from "@/lib/data/pitchCurator";
import {
  applyGroundScoringImpact,
  applyBoundaryScoringImpact,
  calculateBoundaryScoringImpact,
  calculateGroundScoringImpact,
  calculateOutfieldPreparationTiming,
  calculateOutfieldScoringImpact,
  createDefaultHomeOutfieldSettings,
  getDefaultOutfieldSettings,
  normalizeBoundaryPreset,
  normalizeOutfieldSettings,
} from "./stadiumManagement";

test("default compact grounds score higher than default large grounds", () => {
  const rcb = getHomeStadium("RCB")!;
  const pbks = getHomeStadium("PBKS")!;
  const historical = calculateBoundaryScoringImpact("RCB", rcb.defaultBoundaryDimensions);
  const shorter = calculateBoundaryScoringImpact("RCB", {
    straightMetres: 50,
    wideMetres: 50,
  });
  const larger = calculateBoundaryScoringImpact("RCB", {
    straightMetres: 70,
    wideMetres: 65,
  });
  const largeDefault = calculateBoundaryScoringImpact("PBKS", pbks.defaultBoundaryDimensions);

  assert.ok(historical.modifier > 1);
  assert.ok(largeDefault.modifier < 1);
  assert.ok(shorter.modifier > historical.modifier);
  assert.ok(larger.modifier < historical.modifier);
  assert.ok(
    applyBoundaryScoringImpact({ min: 200, max: 220 }, historical).min > 200,
  );
});

test("each boundary direction is limited to 50 metres through historical size plus five", () => {
  const limits = getStadiumBoundaryLimits("GT")!;
  assert.deepEqual(limits, {
    minimum: 50,
    straightMaximum: 80,
    wideMaximum: 70,
  });
});

test("default outfield settings reproduce each stadium's registered speed", () => {
  const defaults = createDefaultHomeOutfieldSettings();
  const chinnaswamy = calculateOutfieldScoringImpact("RCB", defaults.RCB);
  const ekana = calculateOutfieldScoringImpact("LSG", defaults.LSG);

  assert.equal(chinnaswamy.speedRating, getHomeStadium("RCB")?.outfield.speedRating);
  assert.equal(ekana.speedRating, getHomeStadium("LSG")?.outfield.speedRating);
  assert.ok(chinnaswamy.modifier > ekana.modifier);
});

test("short dry firm outfields are faster and raise the combined scoring environment", () => {
  const stadium = getHomeStadium("KKR")!;
  const defaults = getDefaultOutfieldSettings("KKR")!;
  const fast = normalizeOutfieldSettings({
    grassHeightMm: 10,
    moisturePercent: 18,
    firmnessGmax: 90,
  }, "KKR");
  const slow = normalizeOutfieldSettings({
    grassHeightMm: 20,
    moisturePercent: 34,
    firmnessGmax: 55,
  }, "KKR");
  const fastImpact = calculateGroundScoringImpact("KKR", stadium.defaultBoundaryDimensions, fast);
  const slowImpact = calculateGroundScoringImpact("KKR", stadium.defaultBoundaryDimensions, slow);

  assert.ok(calculateOutfieldScoringImpact("KKR", fast).speedRating > calculateOutfieldScoringImpact("KKR", defaults).speedRating);
  assert.ok(fastImpact.modifier > slowImpact.modifier);
  assert.ok(
    applyGroundScoringImpact({ min: 160, max: 180 }, fastImpact).min
      > applyGroundScoringImpact({ min: 160, max: 180 }, slowImpact).min,
  );
});

test("outfield preparation respects gradual mowing, growth and softening recovery", () => {
  const defaults = getDefaultOutfieldSettings("KKR")!;
  const growing = calculateOutfieldPreparationTiming("KKR", defaults, {
    ...defaults,
    grassHeightMm: defaults.grassHeightMm + 4,
  });
  const mowing = calculateOutfieldPreparationTiming("KKR", {
    ...defaults,
    grassHeightMm: 20,
  }, {
    ...defaults,
    grassHeightMm: 10,
  });
  const softening = calculateOutfieldPreparationTiming("KKR", defaults, {
    ...defaults,
    firmnessGmax: defaults.firmnessGmax - 15,
  });

  assert.equal(growing.mowingOrGrowthDays, 8);
  assert.ok(mowing.mowingOrGrowthDays >= 2);
  assert.ok(softening.firmnessTreatmentDays >= 8);
  assert.equal(softening.totalDays, softening.firmnessTreatmentDays);
});

test("saved presets are validated and clamped to their stadium limits", () => {
  const preset = normalizeBoundaryPreset({
    id: "preset-1",
    teamId: "GT",
    name: "  Big Ground  ",
    dimensions: { straightMetres: 200, wideMetres: 40 },
    createdOn: "2027-03-01",
  });

  assert.deepEqual(preset, {
    id: "preset-1",
    teamId: "GT",
    name: "Big Ground",
    dimensions: { straightMetres: 80, wideMetres: 50 },
    createdOn: "2027-03-01",
  });
});
