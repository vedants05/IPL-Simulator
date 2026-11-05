import assert from "node:assert/strict";
import { buildSeasonRankingEntries, rankSeasonEntries, SEASON_RANKING_METRICS } from "../lib/logic/seasonPlayerRankings";
import type { PlayerAnalysisFixture } from "../lib/logic/playerAnalysisMetrics";

const metric = (key: string) => SEASON_RANKING_METRICS.find(m => m.key === key)!;
const fixture: PlayerAnalysisFixture = {
  id: "first", played: true, teamA: "A", teamB: "B",
  scorecard: {
    inningsA: { batting: [
      { id: "quick", runs: 40, balls: 10, fours: 4, sixes: 4, dismissal: "caught" },
      { id: "anchor", runs: 60, balls: 60, fours: 3, sixes: 0, dismissal: "not out" },
      { id: "duck", runs: 0, balls: 0, dismissal: "run out" },
      { id: "dnb", runs: 0, balls: 0, dismissal: "did not bat" },
    ], bowling: [{ id: "bowler", balls: 70, runsConceded: 100, wickets: 2 }] },
    inningsB: { batting: [{ id: "bowler", runs: 5, balls: 7, dismissal: "bowled" }], bowling: [{ id: "quick", balls: 7, runsConceded: 5, wickets: 1 }] },
  },
};
const fielding = { quick: { id: "quick", name: "Quick", teamId: "A", matches: 1, catches: 2, stumpings: 0, runOuts: 1 } };
const data = buildSeasonRankingEntries([fixture, fixture, { ...fixture, id: "unplayed", played: false }], {}, fielding);
assert.equal(data.scoredMatches, 1, "duplicate fixtures and unplayed fixtures must not count");
const teamA = data.teams.find(t => t.id === "A")!;
assert.equal(teamA.totals.matches, 1, "team appearances must not sum player appearances");
assert.equal(teamA.totals.innings, 1);
assert.equal(teamA.totals.runs, 100);
assert.equal(metric("strikeRate").value(teamA), 10000 / 70, "team SR uses aggregate balls, not average player SR");
assert.equal(metric("batAverage").value(teamA), 50, "team average uses total dismissed batters");
assert.equal(metric("notOuts").value(teamA), 1, "team not-outs count batters, not innings minus wickets");
assert.equal(data.players.find(p => p.id === "duck")!.totals.dismissals, 1, "zero-ball run-outs count as dismissals");
assert.equal(data.players.find(p => p.id === "dnb")!.totals.innings, 0);
assert.equal(metric("fieldingDismissals").value(teamA), 3);
assert.equal(metric("highestScore").value(teamA), 100);
const bowlRows = rankSeasonEntries(data.players, metric("economy"), false);
assert.equal(bowlRows[0].entry.id, "quick", "lower economy ranks first");
assert.ok(!rankSeasonEntries(data.players, metric("strikeRate")).some(r => r.entry.id === "quick"), "small-sample SR is excluded by default");
assert.ok(!rankSeasonEntries(data.players, metric("bowlAverage")).some(r => r.entry.id === "quick"), "bowling average respects wickets and balls minimum");
assert.equal(data.detailedMatches, 0);
assert.equal(rankSeasonEntries(data.players, metric("powerplayStrikeRate")).length, 0, "missing deliveries must not fabricate phase rates");
assert.equal(new Set(SEASON_RANKING_METRICS.map(m => `${m.discipline}:${m.key}`)).size, SEASON_RANKING_METRICS.length);
for (const category of ["batting", "bowling", "fielding"]) assert.ok(SEASON_RANKING_METRICS.filter(m => m.discipline === category).length >= 8);
console.log("Season player rankings verified: weighted team rates, fielding, qualifications, direction, missing detail, DNBs and duplicate fixtures.");
