import assert from "node:assert/strict";
import {
  advanceBattingTypePressure,
  bowlingTypeSelectionBonus,
  getBattingTypeOutcomeModifiers,
  getBattingTypeRating,
  getBowlingFamily,
  getRelativeBattingTypeSignal,
} from "../lib/logic/matchSimulation";

const paceBowler = { role: "Pace Bowler" as const, bowlingStyle: "Pacer" as const, currentBowling: 82 };
const spinBowler = { role: "Spin Bowler" as const, bowlingStyle: "Spinner" as const, currentBowling: 82 };
const neutralBatter = { paceRating: 50, spinRating: 50, battingAggression: 65, battingConsistency: 50 };
const paceStrong = { ...neutralBatter, paceRating: 80 };
const paceWeak = { ...neutralBatter, paceRating: 20 };

assert.equal(getBowlingFamily(paceBowler), "pace");
assert.equal(getBowlingFamily(spinBowler), "spin");
assert.equal(getBattingTypeRating({}, "pace"), 50);
assert.equal(getBattingTypeRating({ paceRating: 72 }, "pace"), 72);

const neutral = getBattingTypeOutcomeModifiers(neutralBatter, paceBowler, 0);
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

const strong = getBattingTypeOutcomeModifiers(paceStrong, paceBowler, 0);
const weak = getBattingTypeOutcomeModifiers(paceWeak, paceBowler, 0);
const uniformlyHigh = { ...neutralBatter, paceRating: 80, spinRating: 80 };
const oldUniformSignal = (getBattingTypeRating(uniformlyHigh, "pace") - 50) / 50;
const newPaceSignal = getRelativeBattingTypeSignal(uniformlyHigh, "pace");
const newSpinSignal = getRelativeBattingTypeSignal(uniformlyHigh, "spin");
assert.equal(oldUniformSignal, 0.6, "before: 80/80 raised performance against both families");
assert.equal(newPaceSignal, 0);
assert.equal(newSpinSignal, 0);
assert.deepEqual(getBattingTypeOutcomeModifiers(uniformlyHigh, paceBowler, 0), neutral);
assert.deepEqual(getBattingTypeOutcomeModifiers(uniformlyHigh, spinBowler, 0), neutral);
assert.equal(bowlingTypeSelectionBonus(paceBowler, uniformlyHigh, uniformlyHigh, 85), 0);
assert.equal(bowlingTypeSelectionBonus(spinBowler, uniformlyHigh, uniformlyHigh, 85), 0);
assert.ok(getRelativeBattingTypeSignal(paceStrong, "pace") > 0);
assert.ok(getRelativeBattingTypeSignal(paceStrong, "spin") < 0);
console.log("Pace/spin before/after", { oldUniformSignal, newPaceSignal, newSpinSignal });
assert.ok(strong.dot < neutral.dot && weak.dot > neutral.dot);
assert.ok(strong.single > neutral.single && weak.single < neutral.single);
assert.ok(strong.four > neutral.four && weak.four < neutral.four);
assert.ok(strong.six > neutral.six && weak.six < neutral.six);
assert.ok(strong.wicket < neutral.wicket && weak.wicket > neutral.wicket);

const aggressiveStrong = getBattingTypeOutcomeModifiers(
  { ...paceStrong, battingAggression: 95 },
  paceBowler,
  0,
);
const controlledStrong = getBattingTypeOutcomeModifiers(
  { ...paceStrong, battingAggression: 45 },
  paceBowler,
  0,
);
assert.ok(aggressiveStrong.six > controlledStrong.six);
assert.ok(aggressiveStrong.wicket < controlledStrong.wicket);

const pressuredWeak = getBattingTypeOutcomeModifiers(paceWeak, paceBowler, 0.8);
assert.ok(pressuredWeak.four > weak.four);
assert.ok(pressuredWeak.six > weak.six);
assert.ok(pressuredWeak.wicket > weak.wicket);
assert.ok(pressuredWeak.single < weak.single);

let strongPressure = 0;
let weakPressure = 0;
for (let dot = 0; dot < 5; dot += 1) {
  strongPressure = advanceBattingTypePressure(strongPressure, 80, 0, false, true);
  weakPressure = advanceBattingTypePressure(weakPressure, 20, 0, false, true);
}
assert.ok(weakPressure > strongPressure);
assert.ok(advanceBattingTypePressure(weakPressure, 20, 4, false, true) < weakPressure);
assert.equal(advanceBattingTypePressure(weakPressure, 20, 0, true, true), 0);

const paceAttackBonus = bowlingTypeSelectionBonus(paceBowler, paceWeak, paceWeak, 85);
const paceAvoidancePenalty = bowlingTypeSelectionBonus(paceBowler, paceStrong, paceStrong, 85);
const spinAgainstPaceWeak = bowlingTypeSelectionBonus(spinBowler, paceWeak, paceWeak, 85);
assert.ok(paceAttackBonus > 0);
assert.ok(paceAvoidancePenalty < 0);
assert.ok(spinAgainstPaceWeak < 0);
assert.ok(Math.abs(bowlingTypeSelectionBonus(paceBowler, neutralBatter, neutralBatter, 85)) < 1e-12);

console.log("Batting bowling-type matchup tests passed", {
  strong,
  weak,
  pressuredWeak,
  pressureAfterFiveDots: { strongPressure, weakPressure },
  selection: { paceAttackBonus, paceAvoidancePenalty },
});
