import assert from "node:assert/strict";
import test from "node:test";

import { OTHER_LEAGUE_RECORDS } from "@/lib/data/leagueRecords";
import { computeDynamicLeagueRecords } from "./leagueRecordTracker";

const teams = {
  A: { id: "A", name: "Team A", shortName: "A" },
  B: { id: "B", name: "Team B", shortName: "B" },
} as any;

test("a record chase is detected from innings order rather than fixture team order", () => {
  const records = computeDynamicLeagueRecords([{
    id: "match", played: true, teamA: "A", teamB: "B", winner: "A", date: "2028-04-01",
    scoreA: { runs: 270, wickets: 5, overs: 19.2 }, scoreB: { runs: 269, wickets: 4, overs: 20 },
    simulation: { battingFirstTeamId: "B" },
    scorecard: { inningsA: { batting: [], bowling: [] }, inningsB: { batting: [], bowling: [] } },
  }], {}, teams, OTHER_LEAGUE_RECORDS);
  const chase = records.find((record) => record.id === "highest-chase");
  assert.equal(chase?.holder, "Team A");
  assert.equal(chase?.value, "270/5");
});

test("a 33-wicket season replaces the historical 32-wicket record", () => {
  const bowling = Array.from({ length: 11 }, () => ({
    id: "jadeja", name: "Ravindra Jadeja", overs: 4, maidens: 0, runsConceded: 20, wickets: 3,
  }));
  const fixtures = bowling.map((spell, index) => ({
    id: `match-${index}`, played: true, teamA: "A", teamB: "B", winner: "A", date: "2028-04-01",
    scoreA: { runs: 180, wickets: 5, overs: 20 }, scoreB: { runs: 160, wickets: 8, overs: 20 },
    scorecard: {
      inningsA: { batting: [], bowling: [] },
      inningsB: { batting: [], bowling: [spell] },
    },
  }));
  const records = computeDynamicLeagueRecords(fixtures, {}, teams, OTHER_LEAGUE_RECORDS);
  const wickets = records.find((record) => record.id === "bowling-season");
  assert.equal(wickets?.holder, "Ravindra Jadeja");
  assert.equal(wickets?.value, "33");
});
