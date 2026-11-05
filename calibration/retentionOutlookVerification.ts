import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { likelyRetentionIds } from "../lib/logic/retentionOutlook";
import type { Player, Team } from "../lib/types";
const snapshot = JSON.parse(readFileSync("calibration/data/economy-control/audit-input.json", "utf8"));
const players: Record<string, Player> = Object.fromEntries(snapshot.players.map((p: Player) => [p.id, p]));
for (const rawTeam of snapshot.teams as Team[]) {
  const team = { ...rawTeam, squad: Object.values(players).filter(p => p.currentTeamId === rawTeam.id).map(p => p.id) };
  const ids = likelyRetentionIds(team, players);
  assert.ok(ids.length >= 2 && ids.length <= 3, `${team.id}: expected 2–3 cornerstones`);
  assert.deepEqual(likelyRetentionIds(team, players), ids);
  const released = { ...players, [ids[0]]: { ...players[ids[0]], setForRelease: true } };
  assert.ok(!likelyRetentionIds(team, released).includes(ids[0]));
}
const template = Object.values(players)[0];
const elite = { ...template, id: "elite", isCapped: true, role: "Spin Bowler", age: 35, currentBowling: 91, potentialBowling: 91 } as Player;
const squad = [elite, { ...elite, id: "second", currentBowling: 88 }, { ...elite, id: "third", currentBowling: 85 }, { ...elite, id: "fourth", currentBowling: 80 }];
const team = { ...snapshot.teams[0], squad: squad.map(p => p.id) } as Team;
const map = Object.fromEntries(squad.map(p => [p.id, p]));
assert.deepEqual(likelyRetentionIds(team, map), ["elite", "second", "third"]);
console.log("Retention outlook: 2–3 per club, stable forecasts, elite veterans and explicit releases passed.");
