import assert from "node:assert/strict";
import {
  aggressionAdjustedWicketProbability,
  applyBattingAggressionOutcomeWeights,
  battingAggressionScoringProfile,
  pressureAdjustedAggression,
} from "../lib/logic/matchSimulation";

const base = { dot: 0.34, single: 0.37, two: 0.09, three: 0.0035, four: 0.14, six: 0.052 };
const expectedRuns = (weights: typeof base) => {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  return (weights.single + weights.two * 2 + weights.three * 3 + weights.four * 4 + weights.six * 6) / total;
};
const boundaryShare = (weights: typeof base) => (
  (weights.four + weights.six) / Object.values(weights).reduce((sum, value) => sum + value, 0)
);

const controlled = applyBattingAggressionOutcomeWeights(base, 45);
const neutral = applyBattingAggressionOutcomeWeights(base, 65);
const attacking = applyBattingAggressionOutcomeWeights(base, 90);
assert.ok(boundaryShare(attacking) > boundaryShare(neutral));
assert.ok(boundaryShare(neutral) > boundaryShare(controlled));

const oldGuide95 = 157.5 + (95 - 65) * 27.5 / 30;
const oldGuide99 = 157.5 + (99 - 65) * 27.5 / 30;
const newGuide95 = battingAggressionScoringProfile(95).indicativeStrikeRate;
const newGuide99 = battingAggressionScoringProfile(99).indicativeStrikeRate;
assert.equal(newGuide95, oldGuide95, "95 remains calibrated to the old tempo");
assert.ok(newGuide99 - newGuide95 > oldGuide99 - oldGuide95 + 15);
assert.ok(battingAggressionScoringProfile(99).boundaryIntent > battingAggressionScoringProfile(95).boundaryIntent);
assert.ok(aggressionAdjustedWicketProbability(0.05, 99) > aggressionAdjustedWicketProbability(0.05, 95));
console.log("Aggression before/after", {
  old: { aggression95: oldGuide95, aggression99: oldGuide99 },
  new: { aggression95: newGuide95, aggression99: newGuide99 },
});

const lowComposure = pressureAdjustedAggression(90, 1, 20, 6);
const neutralComposure = pressureAdjustedAggression(90, 1, 50, 6);
const highComposure = pressureAdjustedAggression(90, 1, 80, 6);
assert.ok(lowComposure.effectiveAggression > neutralComposure.effectiveAggression);
assert.ok(lowComposure.wicketRiskMultiplier > 1);
assert.ok(highComposure.effectiveAggression < neutralComposure.effectiveAggression);
assert.ok(highComposure.wicketRiskMultiplier < 1);

// Aggression raises tempo and dismissal probability by the same multiplier.
// Expected runs per wicket should therefore remain essentially unchanged.
const production = (aggression: number) => (
  expectedRuns(applyBattingAggressionOutcomeWeights(base, aggression))
  / aggressionAdjustedWicketProbability(0.05, aggression)
);
const lowProduction = production(45);
const highProduction = production(90);
assert.ok(Math.abs(highProduction / lowProduction - 1) < 0.005);
const extremeProduction = production(99);
const veryAttackingProduction = production(95);
assert.ok(Math.abs(extremeProduction / veryAttackingProduction - 1) < 0.005,
  "extreme aggression changes tempo and dismissal risk together, without adding quality");

console.log("Batting aggression verification passed", {
  boundaryShare: { controlled: boundaryShare(controlled), neutral: boundaryShare(neutral), attacking: boundaryShare(attacking) },
  pressure: { lowComposure, neutralComposure, highComposure },
  approximateRunsPerWicket: { controlled: lowProduction, attacking: highProduction, veryAttacking: veryAttackingProduction, extreme: extremeProduction },
});
