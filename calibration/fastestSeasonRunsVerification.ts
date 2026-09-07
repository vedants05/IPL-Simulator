import assert from "node:assert/strict";
import { MINOR_RECORDS } from "../lib/data/minorRecords";
import {
  reconcileFastestSeasonRunInningsRecords,
  trackMinorRecordsOnMatchComplete,
} from "../lib/logic/minorRecordTracker";

const tracked = MINOR_RECORDS.filter((record) => (
  record.id === "fastest-300-balls" || record.id === "fastest-300-innings"
));
const match = {
  id: "milestone-match",
  teamA: "MI",
  teamB: "KKR",
  played: true,
  date: "2028-04-10",
  scorecard: {
    inningsA: {
      batting: [{ id: "batter", name: "Rapid Batter", runs: 10, balls: 4, dismissal: "not out" }],
      bowling: [], extras: 0,
    },
    inningsB: { batting: [], bowling: [], extras: 0 },
  },
  simulation: {
    innings: [{
      battingTeamId: "MI",
      partnerships: [],
      oversDetail: [{ deliveries: [
        { strikerId: "batter", runsOffBat: 1, isLegal: true },
        { strikerId: "batter", runsOffBat: 4, isLegal: true },
        { strikerId: "batter", runsOffBat: 1, isLegal: true },
        { strikerId: "batter", runsOffBat: 4, isLegal: true },
      ] }],
    }],
  },
};
const result = trackMinorRecordsOnMatchComplete(
  match,
  tracked,
  { MI: { shortName: "MI" }, KKR: { shortName: "KKR" } },
  2028,
  { batter: { id: "batter", name: "Rapid Batter", teamId: "MI", runs: 305, balls: 104, matches: 5, battingInnings: 5 } },
);

assert.equal(result.updatedRecords.find((record) => record.id === "fastest-300-balls")?.value, "102 balls");
assert.equal(result.updatedRecords.find((record) => record.id === "fastest-300-innings")?.value, "5 innings");
assert.equal(result.brokenRecordNotices.length, 2);

const storedSaltRecord = result.updatedRecords.map((record) => record.id === "fastest-300-innings"
  ? { ...record, value: "4 innings", holder: "Phil Salt", season: "2028" }
  : record);
const jaiswalFixtures = [80, 110, 115].map((runs, index) => ({
  id: `jaiswal-${index + 1}`,
  teamA: "RR",
  teamB: "MI",
  played: true,
  date: `2028-04-${String(index + 1).padStart(2, "0")}`,
  scorecard: {
    inningsA: { batting: [{ id: "jaiswal", name: "Yashasvi Jaiswal", runs, balls: 50, dismissal: "not out" }], bowling: [], extras: 0 },
    inningsB: { batting: [], bowling: [], extras: 0 },
  },
}));
const migrated = reconcileFastestSeasonRunInningsRecords(
  storedSaltRecord,
  jaiswalFixtures,
  { RR: { shortName: "RR" }, MI: { shortName: "MI" } },
  2028,
);
const migratedInnings = migrated.find((record) => record.id === "fastest-300-innings");
assert.equal(migratedInnings?.value, "3 innings");
assert.equal(migratedInnings?.holder, "Yashasvi Jaiswal");

console.log("Fastest season-runs record verification passed.");
