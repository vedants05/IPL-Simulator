import assert from "node:assert/strict";
import test from "node:test";

import { dateKeyToLocalDate } from "./careerCalendar";
import {
  LEAGUE_FIXTURE_COUNT,
  generateBalancedLeagueFixtures,
  getLeagueSeasonStartDate,
} from "./leagueSchedule";

const teamIds = ["CSK", "DC", "GT", "KKR", "LSG", "MI", "PBKS", "RR", "RCB", "SRH"];
const reigningChampionTeamId = "RCB";
const fixtureSeed = "career-save-a";

const dayOffset = (startDate: string, date: string) => {
  const start = dateKeyToLocalDate(startDate);
  const fixtureDate = dateKeyToLocalDate(date);
  return Math.round((Date.UTC(fixtureDate.getFullYear(), fixtureDate.getMonth(), fixtureDate.getDate())
    - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86_400_000);
};

test("league fixtures stay evenly spread across the full two-month window", () => {
  const currentSeason = 2027;
  const startDate = getLeagueSeasonStartDate(currentSeason);
  const fixtures = generateBalancedLeagueFixtures(teamIds, currentSeason, reigningChampionTeamId, fixtureSeed);

  assert.equal(fixtures.length, LEAGUE_FIXTURE_COUNT);
  assert.equal(fixtures[0].date, startDate);

  const datesByTeam = new Map(teamIds.map((teamId) => [teamId, [] as number[]]));
  fixtures.forEach((fixture) => {
    const offset = dayOffset(startDate, fixture.date);
    datesByTeam.get(fixture.teamA)!.push(offset);
    datesByTeam.get(fixture.teamB)!.push(offset);
  });

  datesByTeam.forEach((dates) => {
    assert.equal(dates.length, 14);
    assert.ok(dates[0] <= 4, `first fixture was delayed until day ${dates[0]}`);
    assert.ok(dates.at(-1)! >= 57, `last fixture was too early on day ${dates.at(-1)}`);

    const gaps = dates.slice(1).map((date, index) => date - dates[index]);
    assert.ok(Math.min(...gaps) >= 2, `found a back-to-back fixture gap: ${gaps.join(", ")}`);
    assert.ok(Math.max(...gaps) <= 9, `found an uneven fixture gap: ${gaps.join(", ")}`);
  });
});

test("the schedule keeps the required opponent and venue balance", () => {
  const fixtures = generateBalancedLeagueFixtures(teamIds, 2027, reigningChampionTeamId, fixtureSeed);

  for (const teamId of teamIds) {
    const teamFixtures = fixtures.filter((fixture) => fixture.teamA === teamId || fixture.teamB === teamId);
    const opponentCounts = new Map<string, number>();
    teamFixtures.forEach((fixture) => {
      const opponent = fixture.teamA === teamId ? fixture.teamB : fixture.teamA;
      opponentCounts.set(opponent, (opponentCounts.get(opponent) ?? 0) + 1);
    });

    assert.equal(teamFixtures.length, 14);
    assert.equal(teamFixtures.filter((fixture) => fixture.teamA === teamId).length, 7);
    assert.deepEqual(Array.from(opponentCounts.values()).sort(), [1, 1, 1, 1, 2, 2, 2, 2, 2]);
  }

  const matchCountsByDate = new Map<string, number>();
  fixtures.forEach((fixture) => {
    matchCountsByDate.set(fixture.date, (matchCountsByDate.get(fixture.date) ?? 0) + 1);
  });
  assert.ok(Array.from(matchCountsByDate.values()).every((count) => count <= 2));
});

test("fixture generation is deterministic within one career", () => {
  assert.deepEqual(
    generateBalancedLeagueFixtures(teamIds, 2027, reigningChampionTeamId, fixtureSeed),
    generateBalancedLeagueFixtures(teamIds, 2027, reigningChampionTeamId, fixtureSeed),
  );
});

test("different career seeds produce different schedules", () => {
  assert.notDeepEqual(
    generateBalancedLeagueFixtures(teamIds, 2027, reigningChampionTeamId, "career-save-a"),
    generateBalancedLeagueFixtures(teamIds, 2027, reigningChampionTeamId, "career-save-b"),
  );
});

test("career seeds vary the opening fixture instead of fixing one pairing", () => {
  const openingPairings = new Set(
    ["career-a", "career-b", "career-c", "career-d"].map((seed) => {
      const openingFixture = generateBalancedLeagueFixtures(teamIds, 2027, reigningChampionTeamId, seed)[0];
      return [openingFixture.teamA, openingFixture.teamB].sort().join("-");
    }),
  );

  assert.ok(openingPairings.size > 1);
});

test("league-stage match numbers run continuously from 1 to 70", () => {
  const fixtures = generateBalancedLeagueFixtures(teamIds, 2027, reigningChampionTeamId, fixtureSeed);

  assert.deepEqual(
    fixtures.map((fixture) => fixture.matchNumber),
    Array.from({ length: LEAGUE_FIXTURE_COUNT }, (_, index) => index + 1),
  );
  assert.equal(fixtures[0].round, 1);
  assert.match(fixtures[0].id, /^match_0_2027_/);
  assert.match(fixtures[0].date, /^2027-/);
  assert.equal(fixtures[4].round, 1);
  assert.equal(fixtures[5].round, 2);
});

test("the reigning champion always plays in the opening fixture", () => {
  for (const championTeamId of teamIds) {
    const openingFixture = generateBalancedLeagueFixtures(teamIds, 2027, championTeamId, fixtureSeed)[0];
    assert.ok(
      openingFixture.teamA === championTeamId || openingFixture.teamB === championTeamId,
      `${championTeamId} was missing from the opening fixture`,
    );
  }
});

test("fixture generation rejects a reigning champion outside the league", () => {
  assert.throws(
    () => generateBalancedLeagueFixtures(teamIds, 2027, "DCG", fixtureSeed),
    /Reigning champion DCG is not in the league/,
  );
});
