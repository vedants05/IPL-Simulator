import assert from "node:assert/strict";
import { OTHER_LEAGUE_RECORDS } from "../lib/data/leagueRecords";
import { computeDynamicLeagueRecords } from "../lib/logic/leagueRecordTracker";

const records = computeDynamicLeagueRecords([{
  id: "record-match",
  played: true,
  teamA: "MI",
  teamB: "KKR",
  winner: "KKR",
  date: "2028-04-12",
  scoreA: { runs: 180, wickets: 6, overs: 20 },
  scoreB: { runs: 250, wickets: 2, overs: 19.2 },
  scorecard: {
    inningsA: { batting: [], bowling: [] },
    inningsB: { batting: [], bowling: [] },
  },
  simulation: {
    battingFirstTeamId: "MI",
    innings: [{
      battingTeamId: "MI",
      partnerships: [{ runs: 80, batterNames: ["First", "Second"] }],
    }, {
      battingTeamId: "KKR",
      partnerships: [{ runs: 230, batterNames: ["Record Opener", "Record Partner"] }],
    }],
  },
}], {} as any, {
  KKR: { id: "KKR", name: "Kolkata Knight Riders", shortName: "KKR" },
  MI: { id: "MI", name: "Mumbai Indians", shortName: "MI" },
} as any, OTHER_LEAGUE_RECORDS);

const partnership = records.find((record) => record.id === "partnership");
assert.equal(partnership?.value, "230");
assert.equal(partnership?.holder, "Record Opener & Record Partner");
assert.deepEqual(partnership?.playerNames, ["Record Opener", "Record Partner"]);

console.log("League partnership record verification passed.");
