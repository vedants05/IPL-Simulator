import assert from "node:assert/strict";
import { reconcileBowlingFirstImpactPlan } from "../lib/logic/aiLineupSelector";

const player = (id: string, role: "Batsman" | "Pace Bowler" | "Spin Bowler", batting: number, bowling: number, extras: Record<string, unknown> = {}) => ({
  id, name: id, role, nationality: "Indian", currentBatting: batting, currentBowling: bowling,
  potentialBatting: batting, potentialBowling: bowling, reputation: 5, ...extras,
}) as any;

const opener1 = player("opener-1", "Batsman", 78, 10, { isOpener: true });
const opener2 = player("opener-2", "Batsman", 76, 10, { isOpener: true });
const core1 = player("core-1", "Batsman", 88, 10, { isCoreBatter: true, hasBattedAt3: true });
const core2 = player("core-2", "Batsman", 80, 15, { isCoreBatter: true, hasBattedAt4: true });
const incumbentFinisher = player("incumbent-finisher", "Batsman", 72, 20, { isFinisher: true, hasBattedAt6: true });
const lowerBatter = player("lower-batter", "Batsman", 64, 15, { hasBattedAt7: true });
const bowlers = Array.from({ length: 5 }, (_, index) => player(
  `bowler-${index + 1}`,
  index === 4 ? "Spin Bowler" : "Pace Bowler",
  32 + index * 4,
  84 - index,
));
const bowlFirstXI = [opener1, opener2, core1, core2, incumbentFinisher, lowerBatter, ...bowlers];
const ashutosh = player("ashutosh-impact", "Batsman", 80, 10, { isFinisher: true, hasBattedAt6: true, hasBattedAt7: true });
const reserveBatter = player("reserve-batter", "Batsman", 68, 10, { hasBattedAt7: true });

const reconciled = reconcileBowlingFirstImpactPlan(
  [...bowlFirstXI, ashutosh, reserveBatter],
  bowlFirstXI.map((candidate) => candidate.id),
  [reserveBatter.id, ashutosh.id],
);

assert.equal(reconciled.impactPlayerId, ashutosh.id, "the strongest suitable batting substitute should be selected");
assert.ok(
  reconciled.battingPosition !== null && reconciled.battingPosition >= 5 && reconciled.battingPosition <= 8,
  "a finisher should receive a suitable middle/lower-middle-order entry position",
);
assert.ok(
  bowlers.some((candidate) => candidate.id === reconciled.outgoingPlayerId),
  "the batting substitute should replace a bowler from the bowling-first XI",
);

console.log("Bowling-first Impact-plan verification passed.");
