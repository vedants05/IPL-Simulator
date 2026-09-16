import assert from "node:assert/strict";
import { getDefaultCuratorPitch } from "../lib/data/pitchCurator";
import { battingPitchAdjustment, bowlingPitchAdjustment } from "../lib/logic/matchSimulation";
import type { Player } from "../lib/types";

const batter = (currentBatting: number) => ({
  currentBatting,
  battingAggression: 99,
  isOpener: true,
} as Player);
const pacer = { currentBowling: 82, role: "Pace Bowler", bowlingStyle: "Pacer" } as Player;

const cases = [
  { team: "RR", rating: 90, oldBatting: -1.5, oldBowling: 4 },
  { team: "SRH", rating: 89, oldBatting: 4, oldBowling: -4 },
  { team: "RCB", rating: 87, oldBatting: 5.5, oldBowling: -4 },
] as const;

const before = cases.map(({ rating, oldBatting, oldBowling }) => rating + oldBatting - (82 + oldBowling));
const after = cases.map(({ team, rating }) => {
  const pitch = getDefaultCuratorPitch(team);
  assert.ok(pitch, `${team} default pitch exists`);
  const batting = battingPitchAdjustment(batter(rating), pitch);
  const bowling = bowlingPitchAdjustment(pacer, pitch);
  assert.ok(Math.abs(batting) <= 1.5 && Math.abs(bowling) <= 1.5);
  return rating + batting - (82 + bowling);
});

assert.deepEqual(before, [2.5, 15, 14.5]);
assert.ok(Math.max(...after) - Math.min(...after) < Math.max(...before) - Math.min(...before));
assert.ok(after[1] > after[0] && after[2] > after[0], "pitch preferences still have their intended direction");
assert.deepEqual(getDefaultCuratorPitch("RR")?.expectedFirstInningsScore, { min: 170, max: 185 });
assert.deepEqual(getDefaultCuratorPitch("SRH")?.expectedFirstInningsScore, { min: 205, max: 230 });
assert.deepEqual(getDefaultCuratorPitch("RCB")?.expectedFirstInningsScore, { min: 205, max: 235 });
console.log("Venue ability before/after", { before, after });
