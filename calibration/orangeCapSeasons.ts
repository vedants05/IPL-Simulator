import { randomUUID } from "node:crypto";
import { buildAiMatchLineups } from "../lib/logic/aiLineupSelector";
import { getDefaultCuratorPitch, getHomeStadium } from "../lib/data/pitchCurator";
import { generateBalancedLeagueFixtures, generateKnockoutFixtures } from "../lib/logic/leagueSchedule";
import { simulateInstantMatch, type MatchTeamPlans } from "../lib/logic/matchSimulation";
import { calculateGroundScoringImpact, calculateOutfieldSpeedRating, getDefaultOutfieldSettings } from "../lib/logic/stadiumManagement";
import { createTeamTactics } from "../lib/logic/teamTactics";
import { fetchPlayersFromSupabase } from "../lib/supabase/fetchPlayers";
import { fetchTeamsFromSupabase } from "../lib/supabase/fetchTeams";

async function main() {
  const runSeed = process.argv[2] || randomUUID();
  const [players, teams] = await Promise.all([fetchPlayersFromSupabase(), fetchTeamsFromSupabase()]);
  if (!players.length || teams.length !== 10) throw new Error("Expected player data and 10 IPL teams");

  const playerById = Object.fromEntries(players.map((player) => [player.id, player]));
  const teamById = Object.fromEntries(teams.map((team) => [
    team.id,
    { ...team, squad: players.filter((player) => player.currentTeamId === team.id).map((player) => player.id) },
  ]));
  const plansByTeam = Object.fromEntries(teams.map((team) => {
    const squad = teamById[team.id].squad.map((id) => playerById[id]);
    const selection = buildAiMatchLineups(squad);
    const plan = (mode: "battingFirst" | "bowlingFirst") => {
      const lineup = selection[mode];
      return {
        startingXI: lineup.startingXI,
        impactSubs: lineup.impactPlayerId ? [lineup.impactPlayerId] : [],
        plannedImpactPlayerId: lineup.impactPlayerId,
        plannedOutgoingPlayerId: lineup.likelyOutgoingPlayerId,
        plannedImpactBattingPosition: lineup.impactBattingPosition,
        captainId: lineup.captainId,
        viceCaptainId: lineup.viceCaptainId,
      };
    };
    return [team.id, {
      teamId: team.id,
      battingFirst: plan("battingFirst"),
      bowlingFirst: plan("bowlingFirst"),
      tactics: createTeamTactics("Balanced"),
      isUserControlled: false,
    } satisfies MatchTeamPlans];
  }));

  console.log("Orange Cap simulation: 10 runs of 2027-2029, current database squads, fixed AI XIs, 70 league + 4 playoff matches per year");
  console.log(`Seed: ${runSeed}`);
  console.log(`Replay: npm run test:orange-cap-seasons -- ${runSeed}`);
  const vaibhavProfile = players.find((player) => player.name === "Vaibhav Suryavanshi");
  if (vaibhavProfile) {
    console.log(`Vaibhav: batting ${vaibhavProfile.currentBatting}, aggression ${vaibhavProfile.battingAggression}, consistency ${vaibhavProfile.battingConsistency}`);
    console.log(`RR batting first: ${plansByTeam.RR.battingFirst.startingXI.slice(0, 5).map((id) => playerById[id].name).join(", ")}`);
    console.log(`RR bowling first: ${plansByTeam.RR.bowlingFirst.startingXI.slice(0, 5).map((id) => playerById[id].name).join(", ")}`);
  }
  for (let run = 1; run <= 10; run += 1) {
    const iterationSeed = `${runSeed}-run-${run}`;
    let reigningChampion = "RCB";
    console.log(`\nRun ${run}/10`);
    for (const year of [2027, 2028, 2029]) {
    const fixtures = generateBalancedLeagueFixtures(teams.map((team) => team.id), year, reigningChampion, iterationSeed);
    const seasonStats: Record<string, { runs: number; matches: number }> = {};
    const standings = Object.fromEntries(teams.map((team) => [team.id, { points: 0, wins: 0, runsFor: 0, runsAgainst: 0 }]));

    const play = (fixture: { id: string; matchNumber: number; date: string; time: string; teamA: string; teamB: string }, stage?: string) => {
      const stadium = getHomeStadium(fixture.teamA)!;
      const pitch = getDefaultCuratorPitch(fixture.teamA)!;
      const outfield = getDefaultOutfieldSettings(fixture.teamA)!;
      const result = simulateInstantMatch({
        fixtureId: fixture.id,
        matchNumber: fixture.matchNumber,
        date: fixture.date,
        time: fixture.time,
        seed: `${year}:${iterationSeed}:${fixture.id}`,
        teamA: teamById[fixture.teamA],
        teamB: teamById[fixture.teamB],
        players: playerById,
        teamAPlans: plansByTeam[fixture.teamA],
        teamBPlans: plansByTeam[fixture.teamB],
        stage,
        isKnockout: Boolean(stage),
        conditions: {
          homeTeamId: fixture.teamA,
          stadiumId: stadium.id,
          stadiumName: stadium.name,
          pitch,
          boundaries: stadium.defaultBoundaryDimensions,
          outfield,
          outfieldSpeedRating: calculateOutfieldSpeedRating(fixture.teamA, outfield),
          adjustedExpectedScore: pitch.expectedFirstInningsScore,
          groundScoringModifier: calculateGroundScoringImpact(fixture.teamA, stadium.defaultBoundaryDimensions, outfield).modifier,
          chasingScoringBonus: 0,
        },
        seasonBattingStats: seasonStats,
      });
      for (const innings of result.innings) {
        for (const batter of innings.batting) {
          const previous = seasonStats[batter.id] ?? { runs: 0, matches: 0 };
          seasonStats[batter.id] = { runs: previous.runs + batter.runs, matches: previous.matches + 1 };
        }
      }
      if (!stage) {
        for (const innings of result.innings) {
          const team = standings[innings.battingTeamId];
          team.runsFor += innings.runs;
          standings[innings.bowlingTeamId].runsAgainst += innings.runs;
        }
        if (result.winnerId) {
          standings[result.winnerId].points += 2;
          standings[result.winnerId].wins += 1;
        } else {
          standings[fixture.teamA].points += 1;
          standings[fixture.teamB].points += 1;
        }
      }
      return result.winnerId ?? fixture.teamA;
    };

    for (const fixture of fixtures) play(fixture);
    const topFour = Object.keys(standings).sort((a, b) =>
      standings[b].points - standings[a].points
      || (standings[b].runsFor - standings[b].runsAgainst) - (standings[a].runsFor - standings[a].runsAgainst)
      || a.localeCompare(b)
    ).slice(0, 4);
    const playoffs = generateKnockoutFixtures(fixtures.at(-1)!.date, year, topFour);
    const qualifier1Winner = play(playoffs[0], "qualifier1");
    const qualifier1Loser = topFour[0] === qualifier1Winner ? topFour[1] : topFour[0];
    const eliminatorWinner = play(playoffs[1], "eliminator");
    const qualifier2Winner = play({ ...playoffs[2], teamA: qualifier1Loser, teamB: eliminatorWinner }, "qualifier2");
    reigningChampion = play({ ...playoffs[3], teamA: qualifier1Winner, teamB: qualifier2Winner }, "final");

    const leaders = Object.entries(seasonStats)
      .sort((a, b) => b[1].runs - a[1].runs || playerById[a[0]].name.localeCompare(playerById[b[0]].name))
      .slice(0, 3);
    console.log(`\n${year} Orange Cap top 3`);
    leaders.forEach(([id, stats], index) => console.log(`${index + 1}. ${playerById[id].name} — ${stats.runs} runs`));
    const vaibhav = players.find((player) => player.name === "Vaibhav Suryavanshi");
    if (vaibhav) {
      const ranked = Object.entries(seasonStats).sort((a, b) => b[1].runs - a[1].runs);
      const rank = ranked.findIndex(([id]) => id === vaibhav.id) + 1;
      console.log(`Vaibhav Suryavanshi: ${seasonStats[vaibhav.id]?.runs ?? 0} runs, rank ${rank || "unranked"}`);
    }
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
