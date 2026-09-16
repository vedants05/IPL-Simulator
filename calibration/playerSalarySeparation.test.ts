import assert from "node:assert/strict";

import { getMiniAuctionContractPrice } from "../lib/logic/miniAuctionRetention";
import { mapRowsToPlayers } from "../lib/supabase/fetchPlayers";

const [player] = mapRowsToPlayers([{
  name: "Salary Split Test",
  team: "Mumbai Indians",
  team_2026: "DC",
  salary_2026: 7.5,
  ipl_2026_salary: 12,
  age: 25,
  overseas_status: "Indian",
  status: "Capped",
  primary_role: "Batter",
  current_batting: 75,
  potential_batting: 80,
}]);

const history2026 = player.iplHistory.find((entry) => entry.season === "2026");
assert.deepEqual(history2026, { teamId: "DC", season: "2026", price: 750 });
assert.equal(player.currentTeamId, "MI");
assert.equal(player.openingContractPrice, 1_200);
assert.equal(player.openingContractSeason, 2027);
assert.equal(getMiniAuctionContractPrice(player, "MI", 2027), 1_200);
assert.equal(getMiniAuctionContractPrice(player, "DC", 2027), 750);

console.log("Player salary history and opening retention contracts are separated.");
