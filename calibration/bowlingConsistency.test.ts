import assert from "node:assert/strict";
import {
  advanceBowlingConsistencyMomentum,
  bowlingConsistencyProfile,
} from "../lib/logic/matchSimulation";

const volatile = bowlingConsistencyProfile(20);
const neutral = bowlingConsistencyProfile(50);
const reliable = bowlingConsistencyProfile(95);

assert.ok(volatile.matchVarianceMultiplier > neutral.matchVarianceMultiplier);
assert.ok(neutral.matchVarianceMultiplier > reliable.matchVarianceMultiplier);
assert.ok(volatile.deliveryShockScale > neutral.deliveryShockScale);
assert.ok(neutral.deliveryShockScale > reliable.deliveryShockScale);
assert.ok(volatile.deliveryPersistence > neutral.deliveryPersistence);
assert.ok(neutral.deliveryPersistence > reliable.deliveryPersistence);

function sampleRhythm(consistency: number, pressureMultiplier = 1) {
  const values: number[] = [];
  let previous = 0;
  for (let spell = 0; spell < 750; spell += 1) {
    previous = 0;
    for (let ball = 0; ball < 24; ball += 1) {
      previous = advanceBowlingConsistencyMomentum(
        previous,
        consistency,
        `bowling-consistency-calibration:${spell}:${ball}`,
        pressureMultiplier,
      );
      values.push(previous);
    }
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return { mean, standardDeviation: Math.sqrt(variance) };
}

const volatileSample = sampleRhythm(20);
const neutralSample = sampleRhythm(50);
const reliableSample = sampleRhythm(95);
const pressuredVolatileSample = sampleRhythm(20, 1.35);
const pressuredReliableSample = sampleRhythm(95, 1.35);

for (const sample of [
  volatileSample,
  neutralSample,
  reliableSample,
  pressuredVolatileSample,
  pressuredReliableSample,
]) {
  assert.ok(Math.abs(sample.mean) < 0.03);
}
assert.ok(volatileSample.standardDeviation > neutralSample.standardDeviation);
assert.ok(neutralSample.standardDeviation > reliableSample.standardDeviation);
assert.ok(pressuredVolatileSample.standardDeviation > volatileSample.standardDeviation);
assert.ok(pressuredReliableSample.standardDeviation > reliableSample.standardDeviation);
assert.ok(pressuredVolatileSample.standardDeviation > pressuredReliableSample.standardDeviation * 3);

console.log("Bowling consistency calibration passed", {
  profiles: { volatile, neutral, reliable },
  normal: { volatileSample, neutralSample, reliableSample },
  pressure: { pressuredVolatileSample, pressuredReliableSample },
});
