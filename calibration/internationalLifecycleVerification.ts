import assert from "node:assert/strict";
import type { Player } from "../lib/types";
import { internationalNamePool } from "../lib/data/internationalNames";
import {
  createInternationalCareer,
  INTERNATIONAL_TEAMS,
  internationalProgrammePreview,
  internationalProfileName,
  reconcileInternationalCareer,
} from "../lib/logic/international";
import { generateOffseasonStats } from "../lib/logic/offseasonStats";

const captains: Array<[string, string, string]> = [
  ["IND", "India", "Shreyas Iyer"], ["AUS", "Australia", "Mitchell Marsh"],
  ["ENG", "England", "Harry Brook"], ["SA", "South Africa", "Aiden Markram"],
  ["NZ", "New Zealand", "Mitchell Santner"], ["WI", "West Indies", "Shai Hope"],
  ["SL", "Sri Lanka", "Kusal Mendis"],
];

function player(id: string, name: string, country: string, role: Player["role"], rating: number, capped = true): Player {
  return {
    id, name, country, age: 29, nationality: country === "India" ? "Indian" : "Overseas", role,
    battingStyle: "Right-hand", bowlingStyle: role === "Spin Bowler" ? "Leg Spin" : role === "Pace Bowler" ? "Right-arm Fast" : null,
    bowlingHand: role === "Spin Bowler" || role === "Pace Bowler" ? "Right-hand" : null,
    currentBatting: role === "Pace Bowler" || role === "Spin Bowler" ? 45 : rating,
    potentialBatting: rating, currentBowling: role === "Pace Bowler" || role === "Spin Bowler" ? rating : role === "All-Rounder" ? rating - 2 : 35,
    potentialBowling: rating, captaincy: name.includes("Iyer") ? 86 : 78, isWicketkeeper: role === "WK-Batsman",
    careerStats: { batting: { matches: 0, innings: 0, runs: 0, average: 0, strikeRate: 0, highestScore: 0, fifties: 0, hundreds: 0 }, bowling: { matches: 0, innings: 0, wickets: 0, average: 0, economy: 0, strikeRate: 0, bestBowling: "0/0", fourWickets: 0, fiveWickets: 0 } },
    iplStats: { matches: 0, innings: 0, runs: 0, ballsFaced: 0, notOuts: 0, battingAverage: 0, strikeRate: 0, highScore: "0", fifties: 0, hundreds: 0, fours: 0, sixes: 0, wickets: 0, bowlingAverage: 0, economy: 0, bestBowling: "0/0", catches: 0, stumpings: 0 },
    iplHistory: [], basePrice: 100, isCapped: capped, isRetained: false, retainedByTeamId: null, currentTeamId: null, potential: "High",
  } as unknown as Player;
}

const players: Record<string, Player> = {};
captains.forEach(([id, country, name], countryIndex) => {
  const roles: Player["role"][] = ["Batsman", "WK-Batsman", "Batsman", "All-Rounder", "All-Rounder", "Pace Bowler", "Pace Bowler", "Pace Bowler", "Spin Bowler", "Spin Bowler", "Batsman", "Pace Bowler"];
  roles.forEach((role, index) => {
    const key = `${id}-${index}`;
    players[key] = player(key, index === 0 ? name : `${country} Player ${index}`, country, role, 82 - index % 4, index !== 1);
  });
});
players["IND-prospect"] = player("IND-prospect", "India Uncapped Prospect", "India", "Batsman", 96, false);
players["IND-prospect"].internationalCallUpSeason = 2025;
players["IND-keeper-role"] = {
  ...player("IND-keeper-role", "Prabhsimran Singh", "India", "All-Rounder", 88),
  isWicketkeeper: true,
  isPartTimeWk: false,
  isOpener: true,
  currentBatting: 88,
  currentBowling: 32,
};
players["IND-batting-ar"] = {
  ...player("IND-batting-ar", "Abhishek Sharma", "India", "All-Rounder", 89),
  isOpener: true,
  currentBatting: 89,
  currentBowling: 68,
};

const state = createInternationalCareer(2026, players);
assert.equal(INTERNATIONAL_TEAMS.length, 27, "The international pool must contain 27 countries");
assert.equal(state.qualifiers.length, 13, "A World Cup year must select 13 lightweight qualifiers");
captains.forEach(([id, country, name]) => {
  assert.equal(internationalProfileName(state, state.teams[id].captainId), name, `${country} must start with its real-life T20 captain`);
  assert.equal(state.teams[id].squad.length, 17, `${country} must have a 17-player squad`);
  assert.equal(state.teams[id].preferredXI.length, 11, `${country} must have a legal XI`);
});
INTERNATIONAL_TEAMS.forEach((definition) => {
  const pool = internationalNamePool(definition.name);
  assert.equal(pool.firstNames.length, 60, `${definition.name} needs 60 first names`);
  assert.equal(pool.lastNames.length, 60, `${definition.name} needs 60 surnames`);
});
state.series.forEach((series) => {
  const topFour = new Set(["IND", "AUS", "ENG", "SA"]);
  assert.equal(series.matchCount, topFour.has(series.hostCountry) || topFour.has(series.touringCountry) ? 5 : 3);
  const venues = series.fixtureIds.map((id) => state.fixtures.find((fixture) => fixture.id === id)!.venue);
  assert.equal(new Set(venues).size, venues.length, "A bilateral series must rotate through distinct host-country venues");
});
assert.ok(state.fixtures.every((fixture) => fixture.venue.includes(",")), "Every scheduled international must name a stadium and location");
const aprilCareer = createInternationalCareer(2029, players);
assert.ok(aprilCareer.fixtures.some((fixture) => fixture.date.startsWith("2028-")), "The active 2029 reporting window retains its 2028 results");
const announcedProgramme = internationalProgrammePreview(2030);
assert.ok(announcedProgramme.fixtures.some((fixture) => fixture.date.startsWith("2029-")), "The rest of the 2029 calendar must be visible during the 2029 IPL");
const augustCareer = reconcileInternationalCareer(aprilCareer, 2029, "2029-08-31", players).state;
assert.equal(augustCareer.season, 2030, "The international reporting window must roll after the IPL period");
assert.ok(augustCareer.fixtures.some((fixture) => fixture.date.startsWith("2029-") && fixture.played), "Elapsed 2029 internationals must appear as results by August 2029");
assert.ok(state.fixtures.filter((fixture) => fixture.stage === "bilateral").every((fixture) => fixture.date.startsWith("2025-")), "The 2026 international year must begin after the 2025 IPL");
assert.equal(state.profiles["full:IND-keeper-role"].role, "WK-Batsman", "A dedicated keeper must not retain an incorrect all-rounder label");
assert.ok(state.teams.IND.preferredXI.indexOf("full:IND-keeper-role") < 3, "A high-rated keeper-opener must bat in the top three");

const originalProspect = structuredClone(players["IND-prospect"]);
const completed = reconcileInternationalCareer(state, 2026, "2026-05-31", players);
assert.ok(completed.state.fixtures.every((fixture) => fixture.played), "All elapsed fixtures must be simulated");
assert.equal(completed.state.fixtures.filter((fixture) => fixture.stage === "final").length, 1, "World Cup must reach a final");
completed.state.fixtures.forEach((fixture) => {
  [fixture.xiA ?? [], fixture.xiB ?? []].forEach((xi) => {
    assert.ok(xi.slice(0, 2).every((id) => completed.state.profiles[id].isOpener || completed.state.profiles[id].battingPositions.includes(1) || completed.state.profiles[id].battingPositions.includes(2)), "Every batting order must begin with two recognised openers");
    assert.ok(xi.slice(0, 7).some((id) => completed.state.profiles[id].isWicketkeeper), "The selected wicketkeeper must bat in the top seven");
    assert.ok(xi.slice(5, 7).every((id) => {
      const profile = completed.state.profiles[id];
      return !profile.isOpener || profile.battingPositions.some((position) => position >= 6);
    }), "A specialist opener must not be used at numbers six or seven");
    const credibleBowlers = xi.filter((id) => {
      const profile = completed.state.profiles[id];
      const country = INTERNATIONAL_TEAMS.find((row) => row.id === profile.countryId)!;
      const floor = Math.min(70, Math.max(50, country.strength - 10));
      return ["Pace Bowler", "Spin Bowler", "All-Rounder"].includes(profile.role) && profile.bowling >= floor;
    });
    assert.ok(credibleBowlers.length >= 5, "Every XI must contain at least five bowlers of international standard for that country");
  });
  fixture.scorecard?.forEach((innings, index) => {
    innings.bowling.forEach(([id]) => {
      const profile = completed.state.profiles[id];
      const country = INTERNATIONAL_TEAMS.find((row) => row.id === profile.countryId)!;
      const floor = Math.min(70, Math.max(50, country.strength - 10));
      assert.ok(["Pace Bowler", "Spin Bowler", "All-Rounder"].includes(profile.role) && profile.bowling >= floor, "Only qualified bowling options may bowl");
    });
    const expectedScore = index === 0 ? fixture.scoreA! : fixture.scoreB!;
    assert.equal(innings.batting.reduce((sum, [, runs]) => sum + runs, 0), expectedScore[0], "Batting allocations must equal the innings total");
    assert.equal(innings.bowling.reduce((sum, [, , conceded]) => sum + conceded, 0), expectedScore[0], "Bowling concessions must equal the innings total");
    assert.equal(innings.bowling.reduce((sum, [, , , wickets]) => sum + wickets, 0), expectedScore[1], "Bowler wickets must equal the innings wicket total");
  });
});
const internationalInnings = completed.state.fixtures.flatMap((fixture) => [fixture.scoreA!, fixture.scoreB!]);
const individualScores = completed.state.fixtures.flatMap((fixture) => fixture.scorecard?.flatMap((innings) => innings.batting.map(([, runs]) => runs)) ?? []);
const wicketsFiveToNine = internationalInnings.filter(([, wickets]) => wickets >= 5 && wickets <= 9).length / internationalInnings.length;
const averageInningsScore = internationalInnings.reduce((sum, [runs]) => sum + runs, 0) / internationalInnings.length;
const wicketHistogram = Object.fromEntries(Array.from({ length: 11 }, (_, wickets) => [wickets, internationalInnings.filter(([, lost]) => lost === wickets).length]));
assert.ok(wicketsFiveToNine < 0.82, "Wicket distributions must not cluster almost entirely between five and nine");
assert.ok(internationalInnings.some(([, wickets]) => wickets <= 3), "The simulation must produce convincing low-wicket innings");
assert.ok(internationalInnings.some(([, wickets]) => wickets === 10), "The simulation must still produce occasional all-out innings");
assert.ok(averageInningsScore > 135 && averageInningsScore < 195, "Average international T20 scores must stay in a realistic range");
assert.ok(individualScores.some((runs) => runs >= 75), "The batting model must produce substantial individual innings rather than only low shared scores");
const indiaSpecialistWickets = Object.entries(completed.state.seasonStats)
  .filter(([id]) => completed.state.profiles[id]?.countryId === "IND" && ["Pace Bowler", "Spin Bowler"].includes(completed.state.profiles[id].role))
  .map(([, stats]) => stats.wickets);
assert.ok((completed.state.seasonStats["full:IND-batting-ar"]?.wickets ?? 0) <= Math.max(...indiaSpecialistWickets), "A 68-rated batting all-rounder must not be favoured over India's specialist wicket-takers");
assert.equal(completed.playerUpdates["IND-prospect"]?.isCapped, true, "A selected uncapped player must become capped on appearance");
assert.equal(completed.playerUpdates["IND-prospect"]?.currentBatting, originalProspect.currentBatting, "International cricket must not change batting ability");
assert.equal(completed.playerUpdates["IND-prospect"]?.battingConsistency, originalProspect.battingConsistency, "International cricket must not change hidden attributes");
const indiaMatches = completed.state.fixtures.filter((fixture) => fixture.played && (fixture.teamA === "IND" || fixture.teamB === "IND")).length;
assert.ok(Object.entries(completed.state.seasonStats).filter(([id]) => completed.state.profiles[id]?.countryId === "IND").every(([, row]) => row.matches <= indiaMatches), "A player appearance must be counted once per match even when they bat and bowl");

const alreadyCappedPlayers = structuredClone(players);
alreadyCappedPlayers["IND-prospect"] = {
  ...alreadyCappedPlayers["IND-prospect"],
  isCapped: true,
  internationalDebutSeason: 2026,
  internationalDebutCountry: "India",
};
const externalCapState = createInternationalCareer(2026, alreadyCappedPlayers);
const externalCapResult = reconcileInternationalCareer(externalCapState, 2026, "2026-05-31", alreadyCappedPlayers);
assert.ok((externalCapResult.state.seasonStats["full:IND-prospect"]?.matches ?? 0) >= 1, "A player capped by career progression must be forced to make an international appearance");
assert.equal(externalCapResult.state.teams.IND.pendingDebuts["full:IND-prospect"], undefined, "A forced debut must remain pending only until the player actually appears");

const next = reconcileInternationalCareer(completed.state, 2027, "2027-01-01", { ...players, ...completed.playerUpdates });
captains.forEach(([id, , name]) => assert.equal(internationalProfileName(next.state, next.state.teams[id].captainId), name, "Captaincy must persist into the next season"));
assert.equal(next.state.history[0].seasonStats?.["full:IND-keeper-role"]?.matches, completed.state.seasonStats["full:IND-keeper-role"]?.matches, "History must retain the completed IPL-to-IPL statistical window");

const offseason = generateOffseasonStats({ players, performance: {}, completedSeason: 2026, seed: "international-isolation" });
assert.equal(offseason.players["IND-prospect"].isCapped, false, "Offseason output must not invent capped state");
assert.equal(offseason.period.players["IND-prospect"].competitionLevel, "Domestic", "Synthetic offseason stats must not claim international appearances");
assert.ok(JSON.stringify(completed.state).length < 2_000_000, "A full international season must remain below the compact storage budget");

console.log(`International lifecycle verified: ${completed.state.fixtures.length} matches, ${Object.keys(completed.state.profiles).length} profiles, ${JSON.stringify(completed.state).length} bytes, ${averageInningsScore.toFixed(1)} average score, ${(wicketsFiveToNine * 100).toFixed(1)}% innings lost 5-9 wickets.`, wicketHistogram);
