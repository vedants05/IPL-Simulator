import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRecommendedLineups,
  buildRecommendedImpactSubs,
  dropPlayerIntoImpactSubs,
  dropPlayerIntoLineup,
  type LineupCandidate,
  validateLineup,
} from "./lineupPlanner";

const squad: LineupCandidate[] = [
  { id: "wk", nationality: "Indian Capped", role: "WK-Batsman", batting: 84, bowling: 5, isWicketkeeper: true, isOpener: true },
  { id: "bat1", nationality: "Indian Capped", role: "Batsman", batting: 89, bowling: 8, isWicketkeeper: false, isOpener: true },
  { id: "bat2", nationality: "Overseas", role: "Batsman", batting: 87, bowling: 12, isWicketkeeper: false },
  { id: "bat3", nationality: "Indian Capped", role: "Batsman", batting: 82, bowling: 15, isWicketkeeper: false },
  { id: "ar1", nationality: "Indian Capped", role: "All-Rounder", batting: 79, bowling: 76, isWicketkeeper: false },
  { id: "ar2", nationality: "Overseas", role: "All-Rounder", batting: 77, bowling: 81, isWicketkeeper: false },
  { id: "pace1", nationality: "Indian Capped", role: "Pace Bowler", batting: 31, bowling: 88, isWicketkeeper: false },
  { id: "pace2", nationality: "Overseas", role: "Pace Bowler", batting: 28, bowling: 86, isWicketkeeper: false },
  { id: "pace3", nationality: "Indian Capped", role: "Pace Bowler", batting: 25, bowling: 82, isWicketkeeper: false },
  { id: "spin1", nationality: "Indian Capped", role: "Spin Bowler", batting: 34, bowling: 84, isWicketkeeper: false },
  { id: "impactBat", nationality: "Indian Uncapped", role: "Batsman", batting: 80, bowling: 4, isWicketkeeper: false },
  { id: "impactBowl", nationality: "Indian Uncapped", role: "Spin Bowler", batting: 20, bowling: 80, isWicketkeeper: false },
  { id: "bench1", nationality: "Indian Uncapped", role: "Batsman", batting: 70, bowling: 5, isWicketkeeper: false },
  { id: "bench2", nationality: "Indian Uncapped", role: "All-Rounder", batting: 62, bowling: 61, isWicketkeeper: false },
  { id: "bench3", nationality: "Indian Uncapped", role: "Pace Bowler", batting: 18, bowling: 68, isWicketkeeper: false },
  { id: "bench4", nationality: "Indian Uncapped", role: "Spin Bowler", batting: 22, bowling: 66, isWicketkeeper: false },
];

test("recommended plans create two independently valid XIs and five-player benches", () => {
  const plans = buildRecommendedLineups(squad);
  const battingValidation = validateLineup(plans.battingFirstXI, squad);
  const bowlingValidation = validateLineup(plans.bowlingFirstXI, squad);
  const battingImpactSubs = buildRecommendedImpactSubs(plans.battingFirstXI, squad, "battingFirst");
  const bowlingImpactSubs = buildRecommendedImpactSubs(plans.bowlingFirstXI, squad, "bowlingFirst");

  assert.equal(battingValidation.isValid, true);
  assert.equal(bowlingValidation.isValid, true);
  assert.equal(battingImpactSubs.length, 5);
  assert.equal(bowlingImpactSubs.length, 5);
  assert.ok(battingImpactSubs.every((id) => !plans.battingFirstXI.includes(id)));
  assert.ok(bowlingImpactSubs.every((id) => !plans.bowlingFirstXI.includes(id)));
});

test("part-time wicketkeepers satisfy the keeper requirement", () => {
  const partTimeKeeperSquad = squad.map((player) => player.id === "wk"
    ? { ...player, role: "Batsman", isWicketkeeper: true, isPartTimeWicketkeeper: true }
    : player);
  const plans = buildRecommendedLineups(partTimeKeeperSquad);

  assert.ok(validateLineup(plans.battingFirstXI, partTimeKeeperSquad).wicketkeeperCount >= 1);
});

test("lineup validation reports overseas, wicketkeeping, and bowling balance", () => {
  const invalidXI = squad.slice(1, 11).map((player) => player.id);
  const validation = validateLineup(invalidXI, squad);

  assert.equal(validation.playerCount, 10);
  assert.equal(validation.wicketkeeperCount, 0);
  assert.equal(validation.isComplete, false);
  assert.equal(validation.isValid, false);
});

test("lineup drops can swap players or insert them between batting positions", () => {
  const selected = ["a", "b", "c", "d"];

  assert.deepEqual(dropPlayerIntoLineup(selected, [], "a", 2, "swap").lineup, ["c", "b", "a", "d"]);
  assert.deepEqual(dropPlayerIntoLineup(selected, [], "d", 1, "before").lineup, ["a", "d", "b", "c"]);
  assert.deepEqual(dropPlayerIntoLineup(selected, [], "a", 2, "after").lineup, ["b", "c", "a", "d"]);
});

test("players can be dropped from the pool into either selection zone", () => {
  const lineup = Array.from({ length: 11 }, (_, index) => `xi-${index}`);
  const impactSubs = Array.from({ length: 5 }, (_, index) => `impact-${index}`);
  const lineupDrop = dropPlayerIntoLineup(lineup, impactSubs, "pool-player", 3, "swap");
  const impactDrop = dropPlayerIntoImpactSubs(lineup, impactSubs, "pool-player", 2);

  assert.equal(lineupDrop.lineup[3], "pool-player");
  assert.equal(lineupDrop.lineup.length, 11);
  assert.equal(impactDrop.impactSubs[2], "pool-player");
  assert.equal(impactDrop.impactSubs.length, 5);
});

test("dragging between XI and impact substitutes swaps the occupied slots", () => {
  const lineup = ["xi-0", "xi-1", "xi-2"];
  const impactSubs = ["impact-0", "impact-1"];
  const intoImpact = dropPlayerIntoImpactSubs(lineup, impactSubs, "xi-1", 0);
  const intoLineup = dropPlayerIntoLineup(lineup, impactSubs, "impact-1", 2, "swap");

  assert.deepEqual(intoImpact.lineup, ["xi-0", "impact-0", "xi-2"]);
  assert.deepEqual(intoImpact.impactSubs, ["xi-1", "impact-1"]);
  assert.deepEqual(intoLineup.lineup, ["xi-0", "xi-1", "impact-1"]);
  assert.deepEqual(intoLineup.impactSubs, ["impact-0", "xi-2"]);
});
