import assert from "node:assert/strict";
import { summarizeIplPlayerFixtures, summarizeIplSeasonMatchLogs } from "../lib/logic/playerHistory";

assert.deepEqual(summarizeIplSeasonMatchLogs([
  { id: "ipl-1", batting: "72 (44)", bowling: "DNB" },
  { id: "ipl-2", batting: "DNB", bowling: "3/24 (4)" },
  { id: "ipl-3", batting: "0 (1)", bowling: "0/19 (2.3)" },
  { id: "ipl-2", batting: "DNB", bowling: "3/24 (4)" },
]), { matches: 3, runs: 72, wickets: 3 });
assert.equal(summarizeIplSeasonMatchLogs(undefined), undefined);
assert.equal(summarizeIplSeasonMatchLogs([]), undefined);
assert.deepEqual(summarizeIplPlayerFixtures([
  { id: "ipl-1", played: true, scorecard: { inningsA: { batting: [{ id: "player-1", runs: 72 }], bowling: [] }, inningsB: { batting: [], bowling: [{ id: "player-1", wickets: 2 }] } } },
  { id: "ipl-2", played: true, scorecard: { inningsA: { batting: [{ id: "player-1", runs: 0 }], bowling: [] }, inningsB: { batting: [], bowling: [] } } },
  { id: "ipl-2", played: true, scorecard: { inningsA: { batting: [{ id: "player-1", runs: 0 }], bowling: [] }, inningsB: { batting: [], bowling: [] } } },
  { id: "ipl-3", played: false, scorecard: { inningsA: { batting: [{ id: "player-1", runs: 90 }], bowling: [] }, inningsB: { batting: [], bowling: [] } } },
], "player-1"), { matches: 2, runs: 72, wickets: 2 });
assert.equal(summarizeIplPlayerFixtures(undefined, "player-1"), undefined);
assert.deepEqual(summarizeIplPlayerFixtures([
  { id: "ipl-current", date: "2026-04-10", teamA: "MI", teamB: "CSK", played: true, scorecard: { inningsA: { batting: [{ id: "player-1", runs: 25 }], bowling: [] }, inningsB: { batting: [], bowling: [] } } },
  { id: "ipl-compact", date: "2026-04-12", teamA: "MI", teamB: "CSK", played: true, simulation: { lineups: { MI: { startingXI: ["player-1"] } }, innings: [{ batting: [{ id: "player-1", runs: 40 }], bowling: [] }, { batting: [], bowling: [{ id: "player-1", wickets: 1 }] }] } },
  { id: "ipl-dnb", date: "2026-04-13", teamA: "MI", teamB: "CSK", played: true, simulation: { lineups: { MI: { startingXI: ["player-1"] } } } },
  { id: "domestic", date: "2026-04-15", teamA: "MUM", teamB: "DEL", played: true, scorecard: { inningsA: { batting: [{ id: "player-1", runs: 100 }], bowling: [] }, inningsB: { batting: [], bowling: [] } } },
  { id: "ipl-previous", date: "2025-04-10", teamA: "MI", teamB: "CSK", played: true, scorecard: { inningsA: { batting: [{ id: "player-1", runs: 80 }], bowling: [] }, inningsB: { batting: [], bowling: [] } } },
], "player-1", { season: 2026, teamIds: new Set(["MI", "CSK"]) }), { matches: 3, runs: 65, wickets: 1 });
console.log("IPL team-history match-log verification passed.");
