import assert from 'node:assert/strict';
import { battingAggressionScoringProfile, calibrateBattingTempo } from '../lib/logic/matchSimulation';

const expectation = (weights: Record<string, number>) => {
  const values: Record<string, number> = { dot: 0, single: 1, two: 2, three: 3, four: 4, six: 6 };
  return Object.entries(weights).reduce((sum, [key, weight]) => sum + weight * values[key], 0)
    / Object.values(weights).reduce((sum, weight) => sum + weight, 0);
};
for (let aggression = 2; aggression <= 99; aggression++) {
  assert.ok(battingAggressionScoringProfile(aggression).indicativeStrikeRate > battingAggressionScoringProfile(aggression - 1).indicativeStrikeRate);
}
assert.equal(battingAggressionScoringProfile(65).indicativeStrikeRate, 135);
assert.equal(battingAggressionScoringProfile(95).indicativeStrikeRate, 175);
assert.ok(battingAggressionScoringProfile(99).indicativeStrikeRate > 200);
assert.deepEqual(battingAggressionScoringProfile(100), battingAggressionScoringProfile(99));

const profiles = [
  { name: 'developing', q: .065, weights: { dot: .44, single: .37, two: .09, three: .0035, four: .10, six: .035 } },
  { name: 'established', q: .045, weights: { dot: .34, single: .37, two: .09, three: .0035, four: .14, six: .052 } },
  { name: 'elite', q: .030, weights: { dot: .27, single: .37, two: .09, three: .0035, four: .18, six: .075 } },
];
const output = [];
for (const profile of profiles) {
  for (const context of [.85, 1, 1.15]) for (const scoringChance of [1, .975]) {
    const baseline = expectation(profile.weights) * (1 - profile.q) * scoringChance / profile.q;
    let previousRate = 0, previousBalls = Infinity;
    for (const aggression of [40, 65, 85, 95, 99]) {
      const result = calibrateBattingTempo(profile.weights, profile.q, aggression, context, scoringChance);
      const fullBallRate = expectation(result.weights) * (1 - result.wicketProbability) * scoringChance;
      assert.ok(Object.values(result.weights).every(weight => Number.isFinite(weight) && weight >= 0));
      assert.ok(result.wicketProbability > 0 && result.wicketProbability < 1);
      assert.ok(Math.abs(fullBallRate - result.targetRunsPerBall) < 1e-6, 'target must include wicket balls and byes');
      assert.ok(Math.abs(fullBallRate / result.wicketProbability / baseline - 1) < 1e-6, 'tempo must preserve neutral productivity');
      assert.ok(fullBallRate > previousRate);
      assert.ok(1 / result.wicketProbability < previousBalls);
      previousRate = fullBallRate; previousBalls = 1 / result.wicketProbability;
      if (context === 1 && scoringChance === 1) output.push({ profile: profile.name, aggression, strikeRate: fullBallRate * 100, runsPerDismissal: baseline, ballsPerDismissal: previousBalls });
    }
  }
}
// Bowling control is separate from batting style/ability restraints: suppressing
// scoring must also reduce the run budget without buying extra wicket survival.
// Keep the neutral profile fixed here; full-match tests cover the additional
// wicket-taking advantage from higher bowling ability.
for (const profile of profiles) for (const aggression of [40, 65, 85, 99]) {
  const baseline = calibrateBattingTempo(profile.weights, profile.q, aggression, 1, .975);
  let previousRate = Infinity, previousBudget = Infinity;
  for (const bowlingFactor of [1.32, 1, .75, .62]) {
    const result = calibrateBattingTempo(profile.weights, profile.q, aggression, 1, .975, bowlingFactor);
    const fullBallRate = expectation(result.weights) * (1 - result.wicketProbability) * .975;
    assert.ok(Math.abs(fullBallRate / baseline.achievedRunsPerBall - bowlingFactor) < 1e-6,
      'opposition control must remain in the final scoring distribution');
    assert.ok(Math.abs(result.runsPerWicketChance / baseline.runsPerWicketChance - bowlingFactor) < 1e-6,
      'opposition control must reduce scoring productivity as well as pace');
    assert.ok(Math.abs(result.wicketProbability - baseline.wicketProbability) < 1e-10,
      'a control-only change must not reduce wicket threat');
    assert.ok(fullBallRate < previousRate && result.runsPerWicketChance < previousBudget);
    previousRate = fullBallRate;
    previousBudget = result.runsPerWicketChance;
  }
}
// Score/ability restraints may reduce the run budget, but must not turn a
// settled attacking batter into an accumulator as their innings grows.
for (const scoringFactor of [1, .83, .58, .44]) {
  const weights = { ...profiles[1].weights, four: .14 * scoringFactor, six: .052 * scoringFactor };
  const result = calibrateBattingTempo(weights, .045, 99);
  assert.ok(Math.abs(result.achievedRunsPerBall * 100 - 208.6666667) < .001);
}
const limited = calibrateBattingTempo(profiles[0].weights, .8, 99);
assert.ok(limited.achievedRunsPerBall < limited.targetRunsPerBall, 'an infeasible target must be reported honestly');
assert.ok(Object.values(limited.weights).every(Number.isFinite));
console.table(output);
// Independently sample complete innings rather than only inspecting weights.
// No over limit or changing match state: only aggression differs within a band.
for (const profile of profiles) {
  const averages: number[] = [];
  for (const aggression of [40, 65, 85, 95, 99]) {
    const tempo = calibrateBattingTempo(profile.weights, profile.q, aggression, 1, .975);
    const sum = Object.values(tempo.weights).reduce((a, b) => a + b, 0);
    const outcomes = Object.entries(tempo.weights);
    const values: Record<string, number> = { dot: 0, single: 1, two: 2, three: 3, four: 4, six: 6 };
    let state = 123456789, runs = 0, balls = 0;
    const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
    const inningsCount = 30000;
    for (let innings = 0; innings < inningsCount; innings++) {
      while (true) {
        balls++;
        if (random() < tempo.wicketProbability) break;
        if (random() >= .975) continue;
        let draw = random() * sum;
        for (const [key, weight] of outcomes) { draw -= weight; if (draw <= 0) { runs += values[key]; break; } }
      }
    }
    const average = runs / inningsCount;
    averages.push(average);
    assert.ok(Math.abs(100 * runs / balls - tempo.targetRunsPerBall * 100) < 3, 'sampled SR must reach the style target');
    assert.ok(Math.abs(average / tempo.runsPerWicketChance - 1) < .05, 'sampled productivity must stay within 5% of the neutral budget');
  }
  assert.ok(Math.max(...averages) / Math.min(...averages) < 1.05, 'aggression alone must not add expected innings runs');
}
console.log('Aggression targets and productivity verification passed.');
