import assert from "node:assert/strict";
import test from "node:test";

import {
  RETIRED_MAJOR_RECORDS,
  qualifiesForBattingAverageRecord,
} from "./leagueRecords";

test("retired batting averages preserve five qualified fallback leaders", () => {
  const retiredLeaders = RETIRED_MAJOR_RECORDS["batting-average"];

  assert.deepEqual(
    retiredLeaders.map(({ name, value }) => [name, value]),
    [
      ["David Warner", 40.52],
      ["Shaun Marsh", 39.95],
      ["JP Duminy", 39.78],
      ["Chris Gayle", 39.72],
      ["AB de Villiers", 39.70],
    ],
  );

  assert.ok(retiredLeaders.every((entry) => qualifiesForBattingAverageRecord({
    matches: entry.matches ?? 0,
    runs: entry.runs ?? 0,
    battingAverage: entry.value,
  })));
});
