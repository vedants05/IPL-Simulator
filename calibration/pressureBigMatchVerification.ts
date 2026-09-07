import assert from "node:assert/strict";
import type { Player } from "../lib/types";
import {
  attributeSignal,
  bigMatchOutcomeModifiers,
  calculateBattingPressure,
  calculateBowlingPressure,
  knockoutBigMatchIntensity,
  type SituationalPressureInput,
} from "../lib/logic/matchSimulation";
import { qualificationImportanceForFixture } from "../lib/logic/qualificationImportance";

const base: SituationalPressureInput = {
  inningsNumber: 1, runs: 50, wickets: 1, legalBalls: 36, maxBalls: 120,
  expectedScore: 165, consecutiveDots: 0, recentWickets: 0, batterBalls: 15,
  batterPosition: 3, partnershipBalls: 24, partnershipRuns: 34, matchupPressure: 0,
  consecutiveBoundaries: 0, runsThisOver: 2, bowlerEconomy: 7, fieldingErrorPressure: 0,
};
const calmBatting = calculateBattingPressure(base);
const chaseCrisis = calculateBattingPressure({
  ...base, inningsNumber: 2, runs: 125, wickets: 7, legalBalls: 102, target: 171,
  consecutiveDots: 4, recentWickets: 2, batterBalls: 1, batterPosition: 8,
});
const calmBowling = calculateBowlingPressure(base);
const defenceCrisis = calculateBowlingPressure({
  ...base, inningsNumber: 2, runs: 145, wickets: 2, legalBalls: 102, target: 171,
  consecutiveBoundaries: 2, runsThisOver: 14, bowlerEconomy: 11,
  partnershipBalls: 55, partnershipRuns: 82, matchupPressure: 0.8, fieldingErrorPressure: 1,
});
assert.ok(chaseCrisis > calmBatting);
assert.ok(defenceCrisis > calmBowling);
assert.equal(attributeSignal(50), 0);
assert.ok(attributeSignal(80) > 0 && attributeSignal(20) < 0);
assert.equal(knockoutBigMatchIntensity("qualifier1"), 0.7);
assert.equal(knockoutBigMatchIntensity("eliminator"), 0.85);
assert.equal(knockoutBigMatchIntensity("qualifier2"), 0.9);
assert.equal(knockoutBigMatchIntensity("final"), 1);

const mentalPlayer = (rating: number): Player => ({
  id: String(rating), name: "Player", bigMatchRating: rating,
} as Player);
assert.deepEqual(bigMatchOutcomeModifiers(mentalPlayer(50), 1, "batting"), { runMultiplier: 1, wicketAdjustment: 0 });
assert.ok(bigMatchOutcomeModifiers(mentalPlayer(80), 1, "batting").runMultiplier > 1);
assert.ok(bigMatchOutcomeModifiers(mentalPlayer(80), 1, "bowling").runMultiplier < 1);

const fixture = { id: "decider", teamA: "A", teamB: "B", played: false };
const importance = qualificationImportanceForFixture(fixture, [fixture], [
  { teamId: "A", points: 10, nrr: -0.2 }, { teamId: "B", points: 16, nrr: 0.5 },
  { teamId: "C", points: 14, nrr: 0.4 }, { teamId: "D", points: 14, nrr: 0.3 },
  { teamId: "E", points: 12, nrr: 0.2 }, { teamId: "F", points: 8, nrr: -0.5 },
]);
assert.equal(importance.A, 0.9);

console.log("Pressure and big-match verification passed", {
  batting: { calm: calmBatting, crisis: chaseCrisis },
  bowling: { calm: calmBowling, crisis: defenceCrisis },
  qualificationImportance: importance,
});
