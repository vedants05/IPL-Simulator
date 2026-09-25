import assert from "node:assert/strict";
import { estimateAuctionValue } from "../lib/logic/auctionValueEstimate";
import type { Player } from "../lib/types";

function batter(rating: number): Player {
  return {
    id: `batter-${rating}`,
    name: `Batter ${rating}`,
    role: "Batsman",
    nationality: "Indian",
    age: 28,
    basePrice: 200,
    currentBatting: rating,
    currentBowling: 0,
    isCapped: false,
    currentTeamId: null,
    iplHistory: [],
    iplStats: { matches: 0, innings: 0, bowlingInnings: 0 },
  } as unknown as Player;
}

const prices = [75, 85, 93].map((rating) =>
  estimateAuctionValue(batter(rating), {}, {}, null, 2027),
);

assert.ok(prices[0].low < prices[1].low && prices[0].high < prices[1].high, "85-rated player should price above a 75-rated player");
assert.ok(prices[1].low < prices[2].low && prices[1].high < prices[2].high, "93-rated player should price above an 85-rated player");
assert.ok(prices[2].low >= 1000, "93-rated player should have a crore-scale valuation despite a 2 Cr base price");
assert.ok(prices[2].factors.some((factor) => factor.group === "Current ability" && factor.direction === "up"));
