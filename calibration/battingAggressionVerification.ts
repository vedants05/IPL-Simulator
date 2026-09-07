import assert from "node:assert/strict";
import {
  aggressionAdjustedWicketProbability,
  applyBattingAggressionOutcomeWeights,
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

const lowComposure = pressureAdjustedAggression(90, 1, 20, 6);
const neutralComposure = pressureAdjustedAggression(90, 1, 50, 6);
const highComposure = pressureAdjustedAggression(90, 1, 80, 6);
assert.ok(lowComposure.effectiveAggression > neutralComposure.effectiveAggression);
assert.ok(lowComposure.wicketRiskMultiplier > 1);
assert.ok(highComposure.effectiveAggression < neutralComposure.effectiveAggression);
assert.ok(highComposure.wicketRiskMultiplier < 1);

// Aggression raises tempo and dismissal odds together. Approximate runs per
// wicket should remain close enough that aggression is a style, not free CA.
const production = (aggression: number) => (
  expectedRuns(applyBattingAggressionOutcomeWeights(base, aggression))
  / aggressionAdjustedWicketProbability(0.05, aggression)
);
const lowProduction = production(45);
const highProduction = production(90);
assert.ok(Math.abs(highProduction / lowProduction - 1) < 0.08);

console.log("Batting aggression verification passed", {
  boundaryShare: { controlled: boundaryShare(controlled), neutral: boundaryShare(neutral), attacking: boundaryShare(attacking) },
  pressure: { lowComposure, neutralComposure, highComposure },
  approximateRunsPerWicket: { controlled: lowProduction, attacking: highProduction },
});
