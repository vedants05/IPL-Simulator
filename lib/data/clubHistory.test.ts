import assert from "node:assert/strict";
import test from "node:test";

import {
  getClubSeasonHistory,
  LAST_HISTORICAL_CLUB_SEASON,
  type ClubSeasonOutcome,
} from "./clubHistory";

const CLUB_IDS = ["MI", "CSK", "KKR", "RCB", "SRH", "RR", "DC", "PBKS", "GT", "LSG"];

test("every current club history includes the 2026 season", () => {
  CLUB_IDS.forEach((teamId) => {
    assert.equal(getClubSeasonHistory(teamId, teamId)[0]?.season, LAST_HISTORICAL_CLUB_SEASON);
  });
});

test("2026 club outcomes match the league history result", () => {
  const outcomeFor = (teamId: string): ClubSeasonOutcome | undefined => getClubSeasonHistory(teamId, teamId)
    .find((entry) => entry.season === 2026)?.outcome;

  assert.equal(outcomeFor("RCB"), "Champions");
  assert.equal(outcomeFor("GT"), "Runners-up");
  CLUB_IDS.filter((teamId) => teamId !== "RCB" && teamId !== "GT")
    .forEach((teamId) => assert.equal(outcomeFor(teamId), "League season"));
});
