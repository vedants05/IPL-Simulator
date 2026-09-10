import assert from "node:assert/strict";
import { MINOR_RECORDS } from "../lib/data/minorRecords";
import { reconcileCumulativeMinorRecords, trackMinorRecordsOnMatchComplete, updateAllTimeBattingSeasonRecords } from "../lib/logic/minorRecordTracker";

const players = {
  batter: { id: "batter", name: "Test Batter", age: 22, nationality: "Indian", role: "Batsman", isCapped: false, isWicketkeeper: false, currentTeamId: "MI", bowlingStyle: null, iplStats: { matches: 0 } },
  bowler: { id: "bowler", name: "Test Bowler", age: 24, nationality: "Overseas", role: "Pace Bowler", isCapped: true, isWicketkeeper: false, currentTeamId: "KKR", bowlingStyle: "Right-arm Fast", iplStats: { matches: 0 } },
  keeper: { id: "keeper", name: "Test Keeper", age: 25, nationality: "Indian", role: "WK-Batsman", isCapped: true, isWicketkeeper: true, currentTeamId: "KKR", bowlingStyle: null, iplStats: { matches: 0 } },
} as any;

const deliveries = Array.from({ length: 18 }, (_, index) => ({
  strikerId: "batter", strikerName: "Test Batter", bowlerId: "bowler", bowlerName: "Test Bowler",
  overNumber: Math.floor(index / 6) + 1, runsOffBat: index < 13 ? 4 : 0, totalRuns: index < 13 ? 4 : 0, isLegal: true,
  ...(index < 6 ? { wicket: { playerId: `out-${index}`, kind: "caught", bowlerCredited: true, fielderId: "keeper", fielderName: "Test Keeper" } } : {}),
}));
const match = {
  id: "record-test", teamA: "MI", teamB: "KKR", played: true, winner: "MI", date: "2030-05-01", stage: "final" as const,
  scoreA: { runs: 250, wickets: 5, overs: 20 }, scoreB: { runs: 100, wickets: 10, overs: 18 },
  scorecard: {
    inningsA: { batting: [{ id: "batter", name: "Test Batter", battingPosition: 11, runs: 104, balls: 18, fours: 13, sixes: 0, dismissal: "not out" }], bowling: [{ id: "bowler", name: "Test Bowler", wickets: 40, runsConceded: 80, overs: 4, maidens: 0 }], extras: 0 },
    inningsB: { batting: [], bowling: [], extras: 0 },
  },
  simulation: {
    battingFirstTeamId: "MI", winnerId: "MI", playerOfTheMatchId: "batter", playerOfTheMatchName: "Test Batter",
    lineups: { MI: { captainId: "batter", startingXI: ["batter"], finalXI: ["batter"] } },
    innings: [{ battingTeamId: "MI", partnerships: [{ wicket: 10, runs: 240, batterIds: ["batter", "tail"], batterNames: ["Test Batter", "Tail"], }], oversDetail: [{ number: 1, bowlerId: "bowler", bowlerName: "Test Bowler", runs: 52, deliveries }] }, { battingTeamId: "KKR", partnerships: [], oversDetail: [] }],
  },
};

const live = trackMinorRecordsOnMatchComplete(match, MINOR_RECORDS, { MI: { shortName: "MI" }, KKR: { shortName: "KKR" } }, 2030, {
  batter: { id: "batter", name: "Test Batter", teamId: "MI", runs: 1000, balls: 400, matches: 1, battingInnings: 1, wickets: 0, catches: 0, stumpings: 0, maidens: 0 },
  bowler: { id: "bowler", name: "Test Bowler", teamId: "KKR", runs: 0, balls: 0, matches: 1, wickets: 40, catches: 0, stumpings: 0, maidens: 7 },
}, { players, fixtures: [match] });

const value = (id: string) => live.updatedRecords.find((record) => record.id === id)?.value;
assert.equal(value("fastest-fifty-ipl"), "13 balls");
assert.equal(value("lowest-team-score-final"), "100/10");
assert.equal(value("fastest-900-balls"), "383 balls");
assert.equal(value("highest-score-final"), "117*"); // baseline remains intact
assert.equal(value("most-runs-conceded-spell"), "80 runs");
assert.equal(value("most-dismissals-keeper-innings"), "6 dismissals");
assert.equal(value("highest-partnership-pos-11"), "240");
assert.equal(value("most-boundaries-innings"), "30 boundaries"); // baseline intact because 13 < 30
assert.equal(value("most-wickets-in-over"), "6 wickets");

const cumulative = reconcileCumulativeMinorRecords(live.updatedRecords, [match], {
  batter: { id: "batter", name: "Test Batter", teamId: "MI", runs: 1000, balls: 400, matches: 1, battingInnings: 1, wickets: 0, catches: 20, stumpings: 0, maidens: 0 },
  bowler: { id: "bowler", name: "Test Bowler", teamId: "KKR", runs: 0, balls: 0, matches: 1, wickets: 40, catches: 0, stumpings: 0, maidens: 7 },
}, players, { MI: { shortName: "MI" }, KKR: { shortName: "KKR" } }, 2030, [{ playerId: "batter", teamId: "MI", price: 3000 }]);

const cumulativeValue = (id: string) => cumulative.find((record) => record.id === id)?.value;
assert.equal(cumulativeValue("season-most-runs-pos-11"), "104 runs");
assert.equal(cumulativeValue("runs-by-age-22"), "1000 runs");
assert.equal(cumulativeValue("fastest-32-wickets"), "1 matches");
assert.equal(cumulativeValue("most-expensive-auction-buy"), "₹30.00 Crore");

// Verify 1,000-run and 40-wicket season dynamic promotion into all-time leaderboards
const seasonStats = {
  batter: { id: "batter", name: "Test Batter", teamId: "MI", runs: 1000, balls: 400, matches: 14, battingInnings: 14, wickets: 0, catches: 5, stumpings: 0, maidens: 0 },
  bowler: { id: "bowler", name: "Test Bowler", teamId: "KKR", runs: 20, balls: 15, matches: 14, wickets: 40, catches: 3, stumpings: 0, maidens: 7 },
};
const promoted = updateAllTimeBattingSeasonRecords(cumulative, seasonStats, { MI: { shortName: "MI" }, KKR: { shortName: "KKR" } }, 2030);

const runRank1 = promoted.find((r) => r.id === "all-time-season-runs-1");
assert.equal(runRank1?.value, "1000 runs");
assert.equal(runRank1?.holder, "Test Batter");
assert.equal(runRank1?.season, "2030");

const runRank2 = promoted.find((r) => r.id === "all-time-season-runs-2");
assert.equal(runRank2?.value, "973 runs");
assert.equal(runRank2?.holder, "Virat Kohli");
assert.equal(runRank2?.season, "2016");

const wktRank1 = promoted.find((r) => r.id === "all-time-season-wickets-1");
assert.equal(wktRank1?.value, "40 wickets");
assert.equal(wktRank1?.holder, "Test Bowler");
assert.equal(wktRank1?.season, "2030");

const wktRank2 = promoted.find((r) => r.id === "all-time-season-wickets-2");
assert.equal(wktRank2?.value, "32 wickets");
assert.equal(wktRank2?.holder, "Dwayne Bravo");
assert.equal(wktRank2?.season, "2013");

console.log("Comprehensive minor-record evaluator verification passed.");
