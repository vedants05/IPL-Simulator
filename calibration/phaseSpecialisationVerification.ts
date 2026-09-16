import assert from "node:assert/strict";
import {
  combinedDeathReserveOvers,
  getInningsPhase,
  getPhaseMatchup,
  getPhaseOutcomeModifiers,
  getRelativePhaseSignal,
  normalizePhaseRating,
  phaseBowlingSelectionBonus,
  projectedChaseFinishBall,
  projectedChaseFinishWindow,
} from "../lib/logic/matchSimulation";

assert.equal(normalizePhaseRating(0), -1);
assert.equal(normalizePhaseRating(50), 0);
assert.equal(normalizePhaseRating(100), 1);
assert.equal(normalizePhaseRating(undefined), 0);
assert.equal(normalizePhaseRating(Number.NaN), 0);
assert.equal(normalizePhaseRating(-20), -1);
assert.equal(normalizePhaseRating(120), 1);

assert.equal(getInningsPhase(1), "powerplay");
assert.equal(getInningsPhase(6), "powerplay");
assert.equal(getInningsPhase(7), "middle");
assert.equal(getInningsPhase(15), "middle");
assert.equal(getInningsPhase(16), "death");
assert.equal(getInningsPhase(20), "death");
assert.equal(getInningsPhase(3, 10), "powerplay");
assert.equal(getInningsPhase(4, 10), "middle");
assert.equal(getInningsPhase(7, 10), "middle");
assert.equal(getInningsPhase(8, 10), "death");

const neutralPlayer = {
  powerplayBatting: 50,
  middleOversBatting: 50,
  deathBatting: 50,
  powerplayBowling: 50,
  middleOversBowling: 50,
  deathBowling: 50,
};
const neutral = getPhaseOutcomeModifiers(getPhaseMatchup(neutralPlayer, neutralPlayer, 18));
assert.deepEqual(neutral, {
  dot: 1,
  single: 1,
  two: 1,
  four: 1,
  six: 1,
  wicket: 1,
  widePressure: 1,
  noBallPressure: 1,
});

const finisher = { ...neutralPlayer, deathBatting: 70 };
const death = getPhaseOutcomeModifiers(getPhaseMatchup(finisher, neutralPlayer, 18));
assert.ok(Math.abs(death.four - 1.0225) < 1e-12);
assert.ok(Math.abs(death.six - 1.03) < 1e-12);
assert.ok(Math.abs(death.single - 0.9925) < 1e-12);
assert.ok(Math.abs(death.dot - 0.982) < 1e-12);
assert.ok(Math.abs(death.wicket - 0.9895) < 1e-12);
assert.ok(getRelativePhaseSignal(finisher, "batting", "middle") < 0);

const uniformlyHigh = { ...neutralPlayer, powerplayBatting: 80, middleOversBatting: 80, deathBatting: 80 };
const oldUniformSignal = normalizePhaseRating(80);
const newUniformSignals = [4, 10, 18].map((over) => getPhaseMatchup(uniformlyHigh, neutralPlayer, over).battingSignal);
assert.equal(oldUniformSignal, 0.6, "before: every phase received a quality bonus");
assert.deepEqual(newUniformSignals, [0, 0, 0], "after: all-high phases give no overall quality bonus");
const uniformlyHighBowling = { ...neutralPlayer, powerplayBowling: 80, middleOversBowling: 80, deathBowling: 80 };
assert.deepEqual(["powerplay", "middle", "death"].map((phase) =>
  phaseBowlingSelectionBonus(uniformlyHighBowling, phase as "powerplay" | "middle" | "death")), [0, 0, 0]);
console.log("Phase before/after", { oldUniformSignal, newUniformSignals });

const equalElite = getPhaseOutcomeModifiers(getPhaseMatchup(
  { ...neutralPlayer, deathBatting: 90 },
  { ...neutralPlayer, deathBowling: 90 },
  18,
));
assert.equal(equalElite.dot, 1);
assert.equal(equalElite.four, 1);
assert.equal(equalElite.six, 1);
assert.equal(equalElite.wicket, 1);
assert.ok(equalElite.widePressure < 1);
assert.ok(equalElite.noBallPressure < 1);

const strongPowerplay = getPhaseOutcomeModifiers(getPhaseMatchup(
  { ...neutralPlayer, powerplayBatting: 80 },
  neutralPlayer,
  4,
));
assert.ok(strongPowerplay.four > 1);
assert.ok(strongPowerplay.dot < 1);
assert.ok(strongPowerplay.wicket < 1);
assert.equal(strongPowerplay.single, 1);

const strongMiddleBowler = getPhaseOutcomeModifiers(getPhaseMatchup(
  neutralPlayer,
  { ...neutralPlayer, middleOversBowling: 80 },
  10,
));
assert.ok(strongMiddleBowler.dot > 1);
assert.ok(strongMiddleBowler.single < 1);
assert.ok(strongMiddleBowler.two < 1);
assert.ok(strongMiddleBowler.wicket > 1);

assert.ok(Math.abs(phaseBowlingSelectionBonus({ powerplayBowling: 80 }, "powerplay") - 2.52) < 1e-12);
assert.ok(Math.abs(phaseBowlingSelectionBonus({ deathBowling: 30 }, "death") + 1.8) < 1e-12);
assert.equal(phaseBowlingSelectionBonus({}, "middle"), 0);

assert.equal(combinedDeathReserveOvers(20), 3);
assert.equal(combinedDeathReserveOvers(10), 2);
assert.equal(combinedDeathReserveOvers(5), 1);

assert.equal(projectedChaseFinishBall(30, 160, 6, [30]), undefined);
assert.equal(projectedChaseFinishBall(35, 160, 12, [18, 17]), undefined);
const projectedFinish = projectedChaseFinishBall(50, 160, 12, [24, 26]);
assert.ok(projectedFinish !== undefined && projectedFinish > 12);
const slowerFinish = projectedChaseFinishBall(50, 160, 12, [10, 10]);
assert.ok(slowerFinish !== undefined && slowerFinish > projectedFinish!);
const healthyChase = projectedChaseFinishWindow(80, 160, 36, [14, 16], 1);
const damagedChase = projectedChaseFinishWindow(80, 160, 36, [14, 16], 7);
assert.ok(healthyChase && damagedChase);
assert.ok(healthyChase.fast <= healthyChase.central && healthyChase.central <= healthyChase.slow);
assert.ok(healthyChase.central < damagedChase.central);

console.log("Phase-ratings performance tests passed");
