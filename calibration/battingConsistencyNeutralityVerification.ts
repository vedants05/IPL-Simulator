import assert from "node:assert/strict";
import {
  advanceBattingConsistencyMomentum,
  battingConsistencyProfile,
  consistencyAdjustedBattingForm,
  consistencyAdjustedBattingLuck,
  derivePlayerDisciplineFormAdjustments,
  getBattingTypeOutcomeModifiers,
} from "../lib/logic/matchSimulation";

const bowler = { role: "Pace Bowler" as const, bowlingStyle: "Pacer" as const, currentBowling: 82 };
for (const paceRating of [20, 50, 80]) {
  const volatile = getBattingTypeOutcomeModifiers({ paceRating, battingAggression: 70, battingConsistency: 20 }, bowler);
  const reliable = getBattingTypeOutcomeModifiers({ paceRating, battingAggression: 70, battingConsistency: 95 }, bowler);
  assert.deepEqual(volatile, reliable, `consistency changed the ${paceRating} pace matchup mean`);
}

const profiles = [20, 50, 95].map((rating) => ({ rating, profile: battingConsistencyProfile(rating) }));
assert.ok(profiles[0].profile.matchVarianceMultiplier > profiles[1].profile.matchVarianceMultiplier);
assert.ok(profiles[1].profile.matchVarianceMultiplier > profiles[2].profile.matchVarianceMultiplier);

const sample = (rating: number) => {
  const values: number[] = [];
  for (let innings = 0; innings < 500; innings += 1) {
    let momentum = 0;
    for (let ball = 0; ball < 30; ball += 1) {
      momentum = advanceBattingConsistencyMomentum(momentum, rating, `neutrality:${innings}:${ball}`);
      values.push(momentum);
    }
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return { mean, standardDeviation: Math.sqrt(variance) };
};

const samples = { volatile: sample(20), neutral: sample(50), reliable: sample(95) };
assert.ok(Object.values(samples).every(({ mean }) => Math.abs(mean) < 0.03));
assert.ok(samples.volatile.standardDeviation > samples.neutral.standardDeviation);
assert.ok(samples.neutral.standardDeviation > samples.reliable.standardDeviation);

// Inconsistency may still produce one-off brilliance, but must not turn wider
// variance into a season-long advantage. Good form fades faster and bad form
// bites harder; reliable players recover from the same slump more effectively.
assert.ok(consistencyAdjustedBattingForm(3, 20) < consistencyAdjustedBattingForm(3, 50));
assert.ok(consistencyAdjustedBattingForm(-3, 20) < consistencyAdjustedBattingForm(-3, 50));
assert.ok(consistencyAdjustedBattingForm(-3, 95) > consistencyAdjustedBattingForm(-3, 50));
assert.ok(consistencyAdjustedBattingLuck(3, 20) < consistencyAdjustedBattingLuck(3, 50));
assert.ok(consistencyAdjustedBattingLuck(-3, 20) < consistencyAdjustedBattingLuck(-3, 50));

const scorecards = (runs: number, balls: number) => [0, 1].map(() => ({
  inningsA: { batting: [{ id: "batter", runs, balls }], bowling: [] },
  inningsB: { batting: [], bowling: [] },
}));
assert.equal(
  derivePlayerDisciplineFormAdjustments(scorecards(35, 20)).batting.batter,
  0,
  "high strike rate alone must not create positive batting form",
);
assert.ok(
  derivePlayerDisciplineFormAdjustments(scorecards(40, 30)).batting.batter > 0,
  "repeated substantial scores should create positive batting form",
);

console.log("Batting consistency neutrality verification passed", samples);
