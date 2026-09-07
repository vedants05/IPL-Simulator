import assert from "node:assert/strict";
import type { Player } from "../lib/types";
import {
  dismissalCompletionProbability,
  effectiveFieldingRating,
  effectiveWicketkeepingRating,
  selectInningsWicketkeeper,
} from "../lib/logic/matchSimulation";

const player = (overrides: Partial<Player>): Player => ({
  id: "player",
  name: "Test Player",
  age: 28,
  role: "Batsman",
  currentBatting: 75,
  currentBowling: 20,
  reputation: 6,
  ...overrides,
} as Player);

const eliteFielder = player({ id: "elite", fieldingRating: 90 });
const weakFielder = player({ id: "weak", fieldingRating: 35 });
assert.equal(effectiveFieldingRating(eliteFielder), 90);
assert.equal(effectiveFieldingRating(weakFielder), 35);
assert.ok(Number.isFinite(effectiveFieldingRating(player({ fieldingRating: undefined }))));

const eliteKeeper = player({ id: "elite-keeper", role: "WK-Batsman", isWicketkeeper: true, wicketkeepingRating: 91 });
const weakerKeeper = player({ id: "weaker-keeper", role: "WK-Batsman", isWicketkeeper: true, wicketkeepingRating: 68 });
const partTimer = player({ id: "part-time", isPartTimeWk: true, wicketkeepingRating: 95 });
const players = Object.fromEntries([eliteKeeper, weakerKeeper, partTimer].map((entry) => [entry.id, entry]));
assert.equal(effectiveWicketkeepingRating(eliteKeeper), 91);
assert.equal(selectInningsWicketkeeper([weakerKeeper.id, partTimer.id, eliteKeeper.id], players)?.id, eliteKeeper.id);

const completion = (kind: "caught" | "run-out", fielder: Player) => dismissalCompletionProbability({
  playerId: "batter",
  playerName: "Batter",
  kind,
  bowlerCredited: kind === "caught",
  fielderId: fielder.id,
}, { [fielder.id]: fielder });
assert.ok(completion("caught", eliteFielder) > completion("caught", weakFielder));
assert.ok(completion("run-out", eliteFielder) > completion("run-out", weakFielder));

console.log("Fielding and wicketkeeping rating tests passed", {
  caught: { elite: completion("caught", eliteFielder), weak: completion("caught", weakFielder) },
  runOut: { elite: completion("run-out", eliteFielder), weak: completion("run-out", weakFielder) },
});
