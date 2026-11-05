import assert from "node:assert/strict";
import { bowlingTempoMultiplier, calibrateBattingTempo, venueTempoMultiplier } from "../lib/logic/matchSimulation";

// Different neutral scoring and wicket distributions, representing changes in
// bowling quality. Opponent control must survive the final tempo calibration.
const weakBowling = { dot: 0.25, single: 0.30, two: 0.10, three: 0.01, four: 0.20, six: 0.14 };
const strongBowling = { dot: 0.45, single: 0.30, two: 0.10, three: 0.01, four: 0.10, six: 0.04 };
const weak = calibrateBattingTempo(weakBowling, 0.035, 75, 1, 1, bowlingTempoMultiplier(60));
const strong = calibrateBattingTempo(strongBowling, 0.07, 75, 1, 1, bowlingTempoMultiplier(94));
assert.ok(strong.achievedRunsPerBall < weak.achievedRunsPerBall);
assert.ok(strong.runsPerWicketChance < weak.runsPerWicketChance);
assert.ok(strong.wicketProbability > weak.wicketProbability);
const contextA = calibrateBattingTempo(weakBowling, 0.035, 75, 1.2);
const contextB = calibrateBattingTempo(weakBowling, 0.035, 75, 1.6);
assert.ok(contextA.achievedRunsPerBall < contextB.achievedRunsPerBall);
assert.equal(venueTempoMultiplier(185), 1);
assert.ok(venueTempoMultiplier(177.5) < venueTempoMultiplier(190));
assert.ok(venueTempoMultiplier(190) < venueTempoMultiplier(212.5));
console.log(JSON.stringify({
  weakBowling: { sr: weak.achievedRunsPerBall * 100, wicketChance: weak.wicketProbability },
  strongBowling: { sr: strong.achievedRunsPerBall * 100, wicketChance: strong.wicketProbability },
  context1_2: contextA.achievedRunsPerBall * 100,
  context1_6: contextB.achievedRunsPerBall * 100,
}));
