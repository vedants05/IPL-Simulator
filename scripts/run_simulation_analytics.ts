import * as fs from "fs";
import * as path from "path";

// Load .env.local environment variables
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

import { generateBalancedLeagueFixtures } from "../lib/logic/leagueSchedule";
import { simulateInstantMatch, type MatchSimulationInput, type MatchGroundConditions } from "../lib/logic/matchSimulation";
import { createTeamTactics } from "../lib/logic/teamTactics";
import { defaultPitches } from "../lib/data/pitchCurator";
import { mapRowsToPlayers } from "../lib/supabase/fetchPlayers";
import { STATIC_TEAMS } from "../lib/supabase/fetchTeams";
import type { Player, Team } from "../lib/types";

async function loadPlayerData(): Promise<Player[]> {
  const { fetchPlayersFromSupabase } = await import("../lib/supabase/fetchPlayers");
  try {
    const players = await fetchPlayersFromSupabase();
    if (players && players.length > 0) return players;
  } catch (err) {
    // Fallback to CSV parsing below
  }

  const csvPath = path.join(process.cwd(), "IPLMainGameDatabase.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = parseCsvLine(lines[0]);
  const rows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const tokens = parseCsvLine(lines[i]);
    const mappedRow: any = {};
    headers.forEach((h, idx) => {
      mappedRow[h] = tokens[idx] ?? "";
    });

    rows.push({
      team_id: mappedRow["Team"],
      name: mappedRow["Player Name"],
      age: mappedRow["Age"],
      nationality: mappedRow["Nationality"],
      role: mappedRow["Primary Role"],
      base_price: mappedRow["IPL 2026 Salary (Cr)"],
      is_capped: mappedRow["Status"],
      bowling_type: mappedRow["Bowling Type (Spinner/Pacer/NA)"],
      bowling_hand: mappedRow["Bowling Hand"],
      batting_hand: mappedRow['Batting Hand ("Right" or  "Left")'],
      current_batting: mappedRow["Current Batting"],
      potential_batting: mappedRow["Potential Batting"],
      current_bowling: mappedRow["Current Bowling"],
      potential_bowling: mappedRow["Potential Bowling"],
      reputation: mappedRow["Reputation"],
      batting_aggression: mappedRow["Batting Aggression (1-99)"],
      can_keep_wickets: mappedRow["Can they keep wickets?"],
      part_time_wicketkeeper: mappedRow["Are they a part time wicketkeeper?"],
      core_batter: mappedRow["Core Batter"],
      finisher: mappedRow["Finisher?"],
      captaincy: mappedRow["Captaincy"],
      opener: mappedRow["Opener?"],
      only_opener: mappedRow["Only Opener"],
    });
  }

  return mapRowsToPlayers(rows);
}

interface SeasonPlayerStats {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  highestScore: number;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
  fourWickets: number;
  bestWickets: number;
  bestRunsConceded: number;
  mvpPoints: number;
}

async function main() {
  console.log("Loading teams and players for 1,000 match simulation run...");
  const players = await loadPlayerData();
  console.log("players loaded:", Array.isArray(players), players?.length);
  const BASE_TEAMS = [
    { id: "MI", name: "Mumbai Indians", shortName: "MI" },
    { id: "CSK", name: "Chennai Super Kings", shortName: "CSK" },
    { id: "KKR", name: "Kolkata Knight Riders", shortName: "KKR" },
    { id: "RCB", name: "Royal Challengers Bengaluru", shortName: "RCB" },
    { id: "RR", name: "Rajasthan Royals", shortName: "RR" },
    { id: "SRH", name: "Sunrisers Hyderabad", shortName: "SRH" },
    { id: "GT", name: "Gujarat Titans", shortName: "GT" },
    { id: "LSG", name: "Lucknow Super Giants", shortName: "LSG" },
    { id: "DC", name: "Delhi Capitals", shortName: "DC" },
    { id: "PBKS", name: "Punjab Kings", shortName: "PBKS" },
  ];

  const teams: Team[] = BASE_TEAMS.map((bt) => ({
    id: bt.id,
    name: bt.name,
    shortName: bt.shortName,
    primaryColor: "#004BA0",
    secondaryColor: "#D1AB3E",
    homeGround: `${bt.name} Stadium`,
    city: bt.name.split(" ")[0],
    totalPurse: 12000,
    spentAmount: 0,
    remainingPurse: 12000,
    squad: players.filter((p) => p?.currentTeamId === bt.id || p?.retainedByTeamId === bt.id).map((p) => p.id),
    retainedPlayers: [],
    rtmCardsUsed: 0,
    rtmCardsTotal: 6,
    maxSquadSize: 25,
    minSquadSize: 18,
    overseasPlayersCurrent: 0,
    overseasPlayersMax: 8,
    fanBase: "Massive" as any,
    prestige: 8,
    aiPersonality: "Balanced" as any,
    dna: {
      loyalty: 75, prefYoungsters: 75, experienceFocus: 75, bigNamesPref: 75, looksForDepth: 75,
      alrValue: 75, batValue: 75, bowlValue: 75, commitmentToTargets: 75,
      segmentFocus: {
        overseasPacers: 70, indianPacers: 70, overseasSpinners: 70, indianSpinners: 70,
        overseasAllRounders: 70, indianAllRounders: 70, overseasBatters: 70, indianBatters: 70,
      },
    },
  }));

  const playersById: Record<string, Player> = {};
  players.forEach((p) => { playersById[p.id] = p; });

  const teamsById: Record<string, Team> = {};
  teams.forEach((t) => { teamsById[t.id] = t; });

  const teamIds = Object.keys(teamsById);
  console.log(`Successfully loaded ${players.length} players across ${teamIds.length} franchises.`);

  const TOTAL_MATCHES_TARGET = 1000;
  const SEASONS_TO_RUN = Math.ceil(TOTAL_MATCHES_TARGET / 74); // 14 seasons = 1,036 matches

  console.log(`Simulating ${SEASONS_TO_RUN} seasons (~1,000 matches total)...`);

  const teamStats: Record<string, { wins: number; matches: number; playoffs: number; finals: number; titles: number }> = {};
  teamIds.forEach((id) => {
    teamStats[id] = { wins: 0, matches: 0, playoffs: 0, finals: 0, titles: 0 };
  });

  let totalMatches = 0;
  let batFirstWins = 0;
  let chaseWins = 0;
  let totalFirstInningsRuns = 0;
  let scores200Plus = 0;
  let scoresUnder150 = 0;
  let highestTeamScore = 0;
  let highestTeamScoreMatch = "";
  let lowestTeamScore = 999;
  let lowestTeamScoreMatch = "";

  const careerStats: Record<string, SeasonPlayerStats> = {};
  const getCareer = (id: string): SeasonPlayerStats => {
    if (!careerStats[id]) {
      careerStats[id] = {
        runs: 0, balls: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0, highestScore: 0,
        wickets: 0, ballsBowled: 0, runsConceded: 0, fourWickets: 0, bestWickets: 0, bestRunsConceded: 999, mvpPoints: 0,
      };
    }
    return careerStats[id];
  };

  const seasonOrangeCaps: { player: string; runs: number; season: number }[] = [];
  const seasonPurpleCaps: { player: string; wickets: number; season: number }[] = [];
  const seasonMVPs: { player: string; points: number; season: number }[] = [];

  for (let s = 1; s <= SEASONS_TO_RUN; s++) {
    if (totalMatches >= TOTAL_MATCHES_TARGET) break;

    const seasonSeed = `sim-1000-season-${s}`;
    const schedule = generateBalancedLeagueFixtures(teamIds, 2026, "MI", s * 100);

    const seasonStandings: Record<string, { points: number; wins: number }> = {};
    teamIds.forEach((id) => { seasonStandings[id] = { points: 0, wins: 0 }; });

    const seasonPlayerStats: Record<string, SeasonPlayerStats> = {};
    const getSeasonP = (id: string): SeasonPlayerStats => {
      if (!seasonPlayerStats[id]) {
        seasonPlayerStats[id] = {
          runs: 0, balls: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0, highestScore: 0,
          wickets: 0, ballsBowled: 0, runsConceded: 0, fourWickets: 0, bestWickets: 0, bestRunsConceded: 999, mvpPoints: 0,
        };
      }
      return seasonPlayerStats[id];
    };

    for (const m of schedule) {
      if (totalMatches >= TOTAL_MATCHES_TARGET) break;

      const teamA = teamsById[m.teamA];
      const teamB = teamsById[m.teamB];
      if (!teamA || !teamB) continue;

      const testPitch = {
        id: "standard-balanced",
        name: "Standard Balanced Surface",
        type: "Balanced" as const,
        characteristics: ["True bounce"],
        expectedFirstInningsScore: { min: 165, max: 180 },
        favours: [],
        doesNotFavour: [],
      };

      const conditions: MatchGroundConditions = {
        homeTeamId: teamA.id,
        stadiumId: `stadium-${teamA.id}`,
        stadiumName: `${teamA.name} Stadium`,
        pitch: testPitch,
        boundaries: { straightMetres: 68, wideMetres: 64 },
        outfield: { grassHeightMm: 12, moisturePercent: 20, firmnessGmax: 75 },
        outfieldSpeedRating: 8.0,
        adjustedExpectedScore: testPitch.expectedFirstInningsScore,
        groundScoringModifier: 1.0,
        chasingScoringBonus: 0.02,
      };

      const squadA = teamA.squad.map((id) => playersById[id]).filter(Boolean);
      const squadB = teamB.squad.map((id) => playersById[id]).filter(Boolean);

      const planA = {
        startingXI: squadA.slice(0, 11).map((p) => p.id),
        impactSubs: squadA.slice(11, 16).map((p) => p.id),
        plannedImpactPlayerId: squadA[11]?.id,
        plannedOutgoingPlayerId: squadA[10]?.id,
        plannedImpactBattingPosition: 6,
        captainId: squadA[0]?.id,
        viceCaptainId: squadA[1]?.id,
      };

      const planB = {
        startingXI: squadB.slice(0, 11).map((p) => p.id),
        impactSubs: squadB.slice(11, 16).map((p) => p.id),
        plannedImpactPlayerId: squadB[11]?.id,
        plannedOutgoingPlayerId: squadB[10]?.id,
        plannedImpactBattingPosition: 6,
        captainId: squadB[0]?.id,
        viceCaptainId: squadB[1]?.id,
      };

      const input: MatchSimulationInput = {
        fixtureId: m.id,
        matchNumber: m.matchNumber,
        seed: `${seasonSeed}-m-${m.matchNumber}`,
        teamA,
        teamB,
        players: playersById,
        teamAPlans: { teamId: teamA.id, isUserControlled: false, tactics: createTeamTactics("Balanced"), battingFirst: planA, bowlingFirst: planA },
        teamBPlans: { teamId: teamB.id, isUserControlled: false, tactics: createTeamTactics("Balanced"), battingFirst: planB, bowlingFirst: planB },
        conditions,
        time: m.matchNumber % 2 === 0 ? "19:30" : "15:30",
        stage: m.stage,
      };

      const result = simulateInstantMatch(input);
      totalMatches++;

      const firstInnings = result.innings[0];
      totalFirstInningsRuns += firstInnings.runs;
      if (firstInnings.runs >= 200) scores200Plus++;
      if (firstInnings.runs < 150) scoresUnder150++;

      if (firstInnings.runs > highestTeamScore) {
        highestTeamScore = firstInnings.runs;
        highestTeamScoreMatch = `${teamA.shortName} v ${teamB.shortName}`;
      }
      if (firstInnings.runs < lowestTeamScore) {
        lowestTeamScore = firstInnings.runs;
        lowestTeamScoreMatch = `${teamA.shortName} v ${teamB.shortName}`;
      }

      teamStats[teamA.id].matches++;
      teamStats[teamB.id].matches++;

      if (result.winnerId === teamA.id) {
        teamStats[teamA.id].wins++;
        seasonStandings[teamA.id].points += 2;
        seasonStandings[teamA.id].wins++;
        if (result.winnerId === result.innings[0].battingTeamId) batFirstWins++;
        else chaseWins++;
      } else if (result.winnerId === teamB.id) {
        teamStats[teamB.id].wins++;
        seasonStandings[teamB.id].points += 2;
        seasonStandings[teamB.id].wins++;
        if (result.winnerId === result.innings[0].battingTeamId) batFirstWins++;
        else chaseWins++;
      }

      result.innings.forEach((inn) => {
        inn.batting.forEach((b) => {
          const cP = getCareer(b.id);
          const sP = getSeasonP(b.id);

          cP.runs += b.runs;
          cP.balls += b.balls;
          cP.fours += b.fours;
          cP.sixes += b.sixes;
          if (b.runs >= 100) cP.hundreds++;
          else if (b.runs >= 50) cP.fifties++;
          if (b.runs > cP.highestScore) cP.highestScore = b.runs;

          sP.runs += b.runs;
          sP.balls += b.balls;
          sP.fours += b.fours;
          sP.sixes += b.sixes;
          if (b.runs >= 100) sP.hundreds++;
          else if (b.runs >= 50) sP.fifties++;
          if (b.runs > sP.highestScore) sP.highestScore = b.runs;

          const mvp = b.runs * 1 + b.fours * 2.5 + b.sixes * 3.5;
          cP.mvpPoints += mvp;
          sP.mvpPoints += mvp;
        });

        inn.bowling.forEach((bw) => {
          const cP = getCareer(bw.id);
          const sP = getSeasonP(bw.id);

          cP.wickets += bw.wickets;
          cP.ballsBowled += bw.balls;
          cP.runsConceded += bw.runsConceded;
          if (bw.wickets >= 4) cP.fourWickets++;
          if (bw.wickets > cP.bestWickets || (bw.wickets === cP.bestWickets && bw.runsConceded < cP.bestRunsConceded)) {
            cP.bestWickets = bw.wickets;
            cP.bestRunsConceded = bw.runsConceded;
          }

          sP.wickets += bw.wickets;
          sP.ballsBowled += bw.balls;
          sP.runsConceded += bw.runsConceded;
          if (bw.wickets >= 4) sP.fourWickets++;
          if (bw.wickets > sP.bestWickets || (bw.wickets === sP.bestWickets && bw.runsConceded < sP.bestRunsConceded)) {
            sP.bestWickets = bw.wickets;
            sP.bestRunsConceded = bw.runsConceded;
          }

          const dots = Math.max(0, bw.balls - Math.floor(bw.runsConceded / 1.5));
          const mvp = bw.wickets * 25 + dots * 1;
          cP.mvpPoints += mvp;
          sP.mvpPoints += mvp;
        });
      });
    }

    const ranked = Object.entries(seasonStandings).sort((a, b) => b[1].points - a[1].points || b[1].wins - a[1].wins);
    const top4 = ranked.slice(0, 4).map(([tId]) => tId);
    top4.forEach((tId) => teamStats[tId].playoffs++);

    if (top4.length >= 2) {
      teamStats[top4[0]].finals++;
      teamStats[top4[1]].finals++;
      teamStats[top4[0]].titles++;
    }

    let topRuns = 0; let topBatterId = "";
    let topWkts = 0; let topBowlerId = "";
    let topMvp = 0; let topMvpId = "";

    Object.entries(seasonPlayerStats).forEach(([pId, st]) => {
      if (st.runs > topRuns) { topRuns = st.runs; topBatterId = pId; }
      if (st.wickets > topWkts) { topWkts = st.wickets; topBowlerId = pId; }
      if (st.mvpPoints > topMvp) { topMvp = st.mvpPoints; topMvpId = pId; }
    });

    if (topBatterId) seasonOrangeCaps.push({ player: playersById[topBatterId]?.name ?? topBatterId, runs: topRuns, season: s });
    if (topBowlerId) seasonPurpleCaps.push({ player: playersById[topBowlerId]?.name ?? topBowlerId, wickets: topWkts, season: s });
    if (topMvpId) seasonMVPs.push({ player: playersById[topMvpId]?.name ?? topMvpId, points: Math.round(topMvp), season: s });
  }

  const avgFirstInnings = Math.round(totalFirstInningsRuns / totalMatches);
  const batFirstPct = ((batFirstWins / totalMatches) * 100).toFixed(1);
  const chasePct = ((chaseWins / totalMatches) * 100).toFixed(1);

  const mvpCounts: Record<string, number> = {};
  seasonMVPs.forEach((m) => { mvpCounts[m.player] = (mvpCounts[m.player] || 0) + 1; });
  const mostCommonMVP = Object.entries(mvpCounts).sort((a, b) => b[1] - a[1])[0] ?? ["None", 0];

  const avgTopOrangeCapRuns = Math.round(seasonOrangeCaps.reduce((a, b) => a + b.runs, 0) / seasonOrangeCaps.length);
  const avgTopPurpleCapWickets = (seasonPurpleCaps.reduce((a, b) => a + b.wickets, 0) / seasonPurpleCaps.length).toFixed(1);
  const avgTopMvpScore = Math.round(seasonMVPs.reduce((a, b) => a + b.points, 0) / seasonMVPs.length);

  const topRunScorerOverall = Object.entries(careerStats).sort((a, b) => b[1].runs - a[1].runs)[0];
  const topWicketTakerOverall = Object.entries(careerStats).sort((a, b) => b[1].wickets - a[1].wickets)[0];

  const top10RunScorers = Object.entries(careerStats)
    .sort((a, b) => b[1].runs - a[1].runs)
    .slice(0, 10)
    .map(([id, st]) => ({
      name: playersById[id]?.name ?? id,
      team: teamsById[playersById[id]?.currentTeamId ?? ""]?.shortName ?? "N/A",
      runs: st.runs,
      balls: st.balls,
      strikeRate: st.balls > 0 ? ((st.runs / st.balls) * 100).toFixed(1) : "0.0",
      fifties: st.fifties,
      hundreds: st.hundreds,
      highestScore: st.highestScore,
    }));

  const top10WicketTakers = Object.entries(careerStats)
    .sort((a, b) => b[1].wickets - a[1].wickets)
    .slice(0, 10)
    .map(([id, st]) => ({
      name: playersById[id]?.name ?? id,
      team: teamsById[playersById[id]?.currentTeamId ?? ""]?.shortName ?? "N/A",
      wickets: st.wickets,
      overs: (st.ballsBowled / 6).toFixed(1),
      economy: st.ballsBowled > 0 ? ((st.runsConceded / (st.ballsBowled / 6))).toFixed(2) : "0.00",
      bestFigures: `${st.bestWickets}/${st.bestRunsConceded}`,
      fourWicketHauls: st.fourWickets,
    }));

  const report = {
    overview: {
      totalMatchesSimulated: totalMatches,
      totalSeasonsExecuted: SEASONS_TO_RUN,
      averageFirstInningsScore: avgFirstInnings,
      chasingWinPercentage: `${chasePct}%`,
      battingFirstWinPercentage: `${batFirstPct}%`,
      scores200PlusPercentage: `${((scores200Plus / totalMatches) * 100).toFixed(1)}%`,
      scoresUnder150Percentage: `${((scoresUnder150 / totalMatches) * 100).toFixed(1)}%`,
      highestTeamTotal: `${highestTeamScore} (${highestTeamScoreMatch})`,
      lowestTeamTotal: `${lowestTeamScore} (${lowestTeamScoreMatch})`,
    },
    franchisePerformance: Object.entries(teamStats)
      .map(([id, st]) => ({
        shortName: teamsById[id]?.shortName ?? id,
        name: teamsById[id]?.name ?? id,
        winRate: `${((st.wins / st.matches) * 100).toFixed(1)}%`,
        playoffQualificationRate: `${((st.playoffs / SEASONS_TO_RUN) * 100).toFixed(0)}%`,
        finalsReached: st.finals,
        titlesWon: st.titles,
      }))
      .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate)),
    minorDataSummary: {
      avgOrangeCapWinnerRuns: avgTopOrangeCapRuns,
      avgPurpleCapWinnerWickets: avgTopPurpleCapWickets,
      avgTopMVPScore: avgTopMvpScore,
      mostCommonMVPWinner: `${mostCommonMVP[0]} (${mostCommonMVP[1]} seasons)`,
      highestIndividualRunScorerOverall: `${playersById[topRunScorerOverall[0]]?.name ?? topRunScorerOverall[0]} (${topRunScorerOverall[1].runs} runs)`,
      highestIndividualWicketTakerOverall: `${playersById[topWicketTakerOverall[0]]?.name ?? topWicketTakerOverall[0]} (${topWicketTakerOverall[1].wickets} wickets)`,
    },
    top10RunScorers,
    top10WicketTakers,
  };

  console.log("\n==================================================");
  console.log("    1,000 MATCHES SIMULATION ANALYTICS REPORT     ");
  console.log("==================================================");
  console.log(JSON.stringify(report, null, 2));

  const outputPath = path.join(process.cwd(), "simulation_analytics_report.json");
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\nDetailed report saved to ${outputPath}`);
}

main().catch(console.error);
