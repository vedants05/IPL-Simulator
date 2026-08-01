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
import { buildAiMatchLineups } from "../lib/logic/aiLineupSelector";
import { mapRowsToPlayers } from "../lib/supabase/fetchPlayers";
import type { Player, Team } from "../lib/types";

async function loadPlayerData(): Promise<Player[]> {
  const { fetchPlayersFromSupabase } = await import("../lib/supabase/fetchPlayers");
  try {
    const players = await fetchPlayersFromSupabase();
    if (players && players.length > 0) return players;
  } catch (err) {
    // Fallback below
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

interface PlayerStats {
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
  bestWickets: number;
  bestRunsConceded: number;
  inningsBatted: number;
  inningsBowled: number;
}

async function main() {
  console.log("\n=======================================================");
  console.log("   IPL SIMULATOR — AUTHENTIC 1-SEASON SIMULATION RUN   ");
  console.log("=======================================================\n");

  const players = await loadPlayerData();
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

  // Generate authentic XI plans for each franchise using the game's actual AI Lineup Selector!
  const teamPlansById: Record<string, { battingFirst: any; bowlingFirst: any }> = {};
  teamIds.forEach((tId) => {
    const squad = teamsById[tId].squad.map((id) => playersById[id]).filter(Boolean);
    const plans = buildAiMatchLineups(squad);
    teamPlansById[tId] = {
      battingFirst: plans.battingFirst,
      bowlingFirst: plans.bowlingFirst,
    };
  });

  console.log("Authentic team lineups built via buildAiMatchLineups():");
  teamIds.forEach((tId) => {
    const captain = playersById[teamPlansById[tId].battingFirst.captainId]?.name ?? "Captain";
    const keyStar = playersById[teamPlansById[tId].battingFirst.startingXI[0]]?.name ?? "Star";
    console.log(` • ${teamsById[tId].name} (${tId}): Capt: ${captain} | Opener: ${keyStar}`);
  });

  // Track League Standings
  const standings: Record<string, { wins: number; losses: number; points: number; runsFor: number; oversFor: number; runsAgainst: number; oversAgainst: number }> = {};
  teamIds.forEach((tId) => {
    standings[tId] = { wins: 0, losses: 0, points: 0, runsFor: 0, oversFor: 0, runsAgainst: 0, oversAgainst: 0 };
  });

  // Track Player Performance
  const stats: Record<string, PlayerStats> = {};
  const getP = (id: string): PlayerStats => {
    if (!stats[id]) {
      stats[id] = {
        runs: 0, balls: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0, highestScore: 0,
        wickets: 0, ballsBowled: 0, runsConceded: 0, bestWickets: 0, bestRunsConceded: 999,
        inningsBatted: 0, inningsBowled: 0,
      };
    }
    return stats[id];
  };

  let totalMatches = 0;
  let total1stInningsRuns = 0;
  let highestTeamScore = 0;
  let highestTeamScoreDetail = "";
  let lowestTeamScore = 999;
  let lowestTeamScoreDetail = "";
  let highestIndividualScore = 0;
  let highestIndividualBatter = "";
  let bestBowlingWickets = 0;
  let bestBowlingRuns = 999;
  let bestBowlingBowler = "";

  const testPitch = {
    id: "balanced",
    name: "Standard Surface",
    type: "Balanced" as const,
    characteristics: ["True bounce"],
    expectedFirstInningsScore: { min: 165, max: 180 },
    favours: [],
    doesNotFavour: [],
  };

  const schedule = generateBalancedLeagueFixtures(teamIds, 2026, "MI", 42);

  // 1. SIMULATE LEAGUE STAGE (70 Matches)
  console.log(`\nSimulating 70 League Stage Matches...`);
  for (const m of schedule) {
    const teamA = teamsById[m.teamA];
    const teamB = teamsById[m.teamB];
    if (!teamA || !teamB) continue;

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

    const planA = teamPlansById[teamA.id].battingFirst;
    const planB = teamPlansById[teamB.id].battingFirst;

    const formattedPlanA = {
      startingXI: [...planA.startingXI],
      impactSubs: [...(planA.impactSubs || [])],
      plannedImpactPlayerId: planA.plannedImpactPlayerId,
      plannedOutgoingPlayerId: planA.plannedOutgoingPlayerId,
      plannedImpactBattingPosition: planA.plannedImpactBattingPosition ?? 6,
      captainId: planA.captainId,
      viceCaptainId: planA.viceCaptainId,
    };

    const formattedPlanB = {
      startingXI: [...planB.startingXI],
      impactSubs: [...(planB.impactSubs || [])],
      plannedImpactPlayerId: planB.plannedImpactPlayerId,
      plannedOutgoingPlayerId: planB.plannedOutgoingPlayerId,
      plannedImpactBattingPosition: planB.plannedImpactBattingPosition ?? 6,
      captainId: planB.captainId,
      viceCaptainId: planB.viceCaptainId,
    };

    const input: MatchSimulationInput = {
      fixtureId: m.id,
      matchNumber: m.matchNumber,
      seed: `season-match-${m.matchNumber}`,
      teamA,
      teamB,
      players: playersById,
      teamAPlans: { teamId: teamA.id, isUserControlled: false, tactics: createTeamTactics("Balanced"), battingFirst: formattedPlanA, bowlingFirst: formattedPlanA },
      teamBPlans: { teamId: teamB.id, isUserControlled: false, tactics: createTeamTactics("Balanced"), battingFirst: formattedPlanB, bowlingFirst: formattedPlanB },
      conditions,
      time: m.matchNumber % 2 === 0 ? "19:30" : "15:30",
      stage: m.stage,
    };

    const result = simulateInstantMatch(input);
    totalMatches++;

    const firstInn = result.innings[0];
    const secondInn = result.innings[1];
    total1stInningsRuns += firstInn.runs;

    if (firstInn.runs > highestTeamScore) { highestTeamScore = firstInn.runs; highestTeamScoreDetail = `${teamA.shortName} v ${teamB.shortName}`; }
    if (firstInn.runs < lowestTeamScore) { lowestTeamScore = firstInn.runs; lowestTeamScoreDetail = `${teamA.shortName} v ${teamB.shortName}`; }

    // Standings calculation
    const winner = result.winnerId;
    const loser = winner === teamA.id ? teamB.id : teamA.id;
    standings[winner].wins++;
    standings[winner].points += 2;
    standings[loser].losses++;

    // Track Player Stats
    result.innings.forEach((inn) => {
      inn.batting.forEach((b) => {
        const p = getP(b.id);
        p.runs += b.runs;
        p.balls += b.balls;
        p.fours += b.fours;
        p.sixes += b.sixes;
        if (b.balls > 0) p.inningsBatted++;
        if (b.runs >= 100) p.hundreds++;
        else if (b.runs >= 50) p.fifties++;
        if (b.runs > p.highestScore) p.highestScore = b.runs;

        const pName = b.name || playersById[b.id]?.name || b.id;
        if (b.runs > highestIndividualScore) {
          highestIndividualScore = b.runs;
          highestIndividualBatter = `${pName} (${teamsById[playersById[b.id]?.currentTeamId ?? ""]?.shortName ?? "N/A"})`;
        }
      });

      inn.bowling.forEach((bw) => {
        const p = getP(bw.id);
        p.wickets += bw.wickets;
        p.ballsBowled += bw.balls;
        p.runsConceded += bw.runsConceded;
        if (bw.balls > 0) p.inningsBowled++;
        if (bw.wickets > p.bestWickets || (bw.wickets === p.bestWickets && bw.runsConceded < p.bestRunsConceded)) {
          p.bestWickets = bw.wickets;
          p.bestRunsConceded = bw.runsConceded;
        }

        const bwName = bw.name || playersById[bw.id]?.name || bw.id;
        if (bw.wickets > bestBowlingWickets || (bw.wickets === bestBowlingWickets && bw.runsConceded < bestBowlingRuns)) {
          bestBowlingWickets = bw.wickets;
          bestBowlingRuns = bw.runsConceded;
          bestBowlingBowler = `${bwName} (${teamsById[playersById[bw.id]?.currentTeamId ?? ""]?.shortName ?? "N/A"})`;
        }
      });
    });
  }

  // Rank Standings
  const rankedTable = Object.entries(standings)
    .map(([tId, st]) => ({
      id: tId,
      name: teamsById[tId].name,
      shortName: teamsById[tId].shortName,
      wins: st.wins,
      losses: st.losses,
      points: st.points,
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins);

  console.log("\n-------------------------------------------------------");
  console.log("                 LEAGUE STAGE TABLE                    ");
  console.log("-------------------------------------------------------");
  console.table(rankedTable.map((t, idx) => ({
    Pos: idx + 1,
    Team: t.shortName,
    Name: t.name,
    Wins: t.wins,
    Losses: t.losses,
    Pts: t.points,
  })));

  // 2. PLAYOFF STAGE (Qualifiers, Eliminator, Final)
  console.log("\n-------------------------------------------------------");
  console.log("               PLAYOFF STAGE MATCHES                   ");
  console.log("-------------------------------------------------------");

  const t1 = teamsById[rankedTable[0].id];
  const t2 = teamsById[rankedTable[1].id];
  const t3 = teamsById[rankedTable[2].id];
  const t4 = teamsById[rankedTable[3].id];

  // Helper to simulate a playoff match
  const playKnockout = (fixtureId: string, stage: string, teamA: Team, teamB: Team) => {
    const planA = teamPlansById[teamA.id].battingFirst;
    const planB = teamPlansById[teamB.id].battingFirst;

    const formattedPlanA = {
      startingXI: [...planA.startingXI],
      impactSubs: [...(planA.impactSubs || [])],
      plannedImpactPlayerId: planA.plannedImpactPlayerId,
      plannedOutgoingPlayerId: planA.plannedOutgoingPlayerId,
      plannedImpactBattingPosition: planA.plannedImpactBattingPosition ?? 6,
      captainId: planA.captainId,
      viceCaptainId: planA.viceCaptainId,
    };

    const formattedPlanB = {
      startingXI: [...planB.startingXI],
      impactSubs: [...(planB.impactSubs || [])],
      plannedImpactPlayerId: planB.plannedImpactPlayerId,
      plannedOutgoingPlayerId: planB.plannedOutgoingPlayerId,
      plannedImpactBattingPosition: planB.plannedImpactBattingPosition ?? 6,
      captainId: planB.captainId,
      viceCaptainId: planB.viceCaptainId,
    };

    const input: MatchSimulationInput = {
      fixtureId,
      matchNumber: 71,
      seed: `playoff-${fixtureId}`,
      teamA,
      teamB,
      players: playersById,
      teamAPlans: { teamId: teamA.id, isUserControlled: false, tactics: createTeamTactics("Balanced"), battingFirst: formattedPlanA, bowlingFirst: formattedPlanA },
      teamBPlans: { teamId: teamB.id, isUserControlled: false, tactics: createTeamTactics("Balanced"), battingFirst: formattedPlanB, bowlingFirst: formattedPlanB },
      conditions: {
        homeTeamId: teamA.id, stadiumId: `stadium-${teamA.id}`, stadiumName: `${teamA.name} Stadium`,
        pitch: testPitch, boundaries: { straightMetres: 68, wideMetres: 64 }, outfield: { grassHeightMm: 12, moisturePercent: 20, firmnessGmax: 75 },
        outfieldSpeedRating: 8.0, adjustedExpectedScore: testPitch.expectedFirstInningsScore, groundScoringModifier: 1.0, chasingScoringBonus: 0.02,
      },
      time: "19:30",
      stage,
      isKnockout: true,
    };
    return simulateInstantMatch(input);
  };

  // Qualifier 1 (1st vs 2nd)
  const q1Res = playKnockout("qualifier1", "Qualifier 1", t1, t2);
  const q1Winner = q1Res.winnerId === t1.id ? t1 : t2;
  const q1Loser = q1Res.winnerId === t1.id ? t2 : t1;
  console.log(`• Qualifier 1: ${t1.shortName} vs ${t2.shortName} ➔ WINNER: ${q1Winner.name} (Direct to Final)`);

  // Eliminator (3rd vs 4th)
  const elimRes = playKnockout("eliminator", "Eliminator", t3, t4);
  const elimWinner = elimRes.winnerId === t3.id ? t3 : t4;
  const elimLoser = elimRes.winnerId === t3.id ? t4 : t3;
  console.log(`• Eliminator:  ${t3.shortName} vs ${t4.shortName} ➔ WINNER: ${elimWinner.name} | Knocked Out: ${elimLoser.name}`);

  // Qualifier 2 (Q1 Loser vs Eliminator Winner)
  const q2Res = playKnockout("qualifier2", "Qualifier 2", q1Loser, elimWinner);
  const q2Winner = q2Res.winnerId === q1Loser.id ? q1Loser : elimWinner;
  const q2Loser = q2Res.winnerId === q1Loser.id ? elimWinner : q1Loser;
  console.log(`• Qualifier 2: ${q1Loser.shortName} vs ${elimWinner.shortName} ➔ WINNER: ${q2Winner.name} | Knocked Out: ${q2Loser.name}`);

  // IPL Final (Q1 Winner vs Q2 Winner)
  const finalRes = playKnockout("final", "Final", q1Winner, q2Winner);
  const champion = finalRes.winnerId === q1Winner.id ? q1Winner : q2Winner;
  const runnerUp = finalRes.winnerId === q1Winner.id ? q2Winner : q1Winner;
  console.log(`\n🏆 IPL FINAL RESULT: ${champion.name.toUpperCase()} DEFEATED ${runnerUp.name.toUpperCase()} TO WIN THE IPL CHAMPIONSHIP! 🏆`);

  // 3. INDIVIDUAL SEASON AWARDS & TOP PERFORMERS
  const topRunScorers = Object.entries(stats)
    .sort((a, b) => b[1].runs - a[1].runs)
    .map(([id, st]) => ({
      name: playersById[id]?.name ?? id,
      team: teamsById[playersById[id]?.currentTeamId ?? ""]?.shortName ?? "N/A",
      runs: st.runs,
      innings: st.inningsBatted,
      avg: (st.runs / Math.max(1, st.inningsBatted)).toFixed(1),
      sr: ((st.runs / Math.max(1, st.balls)) * 100).toFixed(1),
      fifties: st.fifties,
      hundreds: st.hundreds,
      highest: st.highestScore,
    }));

  const topWicketTakers = Object.entries(stats)
    .sort((a, b) => b[1].wickets - a[1].wickets)
    .map(([id, st]) => ({
      name: playersById[id]?.name ?? id,
      team: teamsById[playersById[id]?.currentTeamId ?? ""]?.shortName ?? "N/A",
      wickets: st.wickets,
      overs: (st.ballsBowled / 6).toFixed(1),
      econ: (st.runsConceded / Math.max(1, st.ballsBowled / 6)).toFixed(2),
      best: `${st.bestWickets}/${st.bestRunsConceded}`,
    }));

  const orangeCap = topRunScorers[0];
  const purpleCap = topWicketTakers[0];

  console.log("\n-------------------------------------------------------");
  console.log("               SEASON INDIVIDUAL AWARDS                ");
  console.log("-------------------------------------------------------");
  console.log(`🟧 ORANGE CAP WINNER: ${orangeCap.name} (${orangeCap.team})`);
  console.log(`   • Stats: ${orangeCap.runs} runs | Avg: ${orangeCap.avg} | SR: ${orangeCap.sr} | 50s: ${orangeCap.fifties} | 100s: ${orangeCap.hundreds} | High: ${orangeCap.highest}`);

  console.log(`\n🟪 PURPLE CAP WINNER: ${purpleCap.name} (${purpleCap.team})`);
  console.log(`   • Stats: ${purpleCap.wickets} wickets | Overs: ${purpleCap.overs} | Econ: ${purpleCap.econ} | Best: ${purpleCap.best}`);

  console.log("\n-------------------------------------------------------");
  console.log("                 TOP 10 BATTERS                        ");
  console.log("-------------------------------------------------------");
  console.table(topRunScorers.slice(0, 10));

  console.log("\n-------------------------------------------------------");
  console.log("                 TOP 10 BOWLERS                        ");
  console.log("-------------------------------------------------------");
  console.table(topWicketTakers.slice(0, 10));

  console.log("\n-------------------------------------------------------");
  console.log("                 SEASON HIGHLIGHTS                     ");
  console.log("-------------------------------------------------------");
  console.log(`• Average First Innings Score: ${Math.round(total1stInningsRuns / 70)} runs`);
  console.log(`• Highest Team Total: ${highestTeamScore} (${highestTeamScoreDetail})`);
  console.log(`• Lowest Team Total: ${lowestTeamScore} (${lowestTeamScoreDetail})`);
  console.log(`• Highest Individual Score: ${highestIndividualScore} by ${highestIndividualBatter}`);
  console.log(`• Best Bowling Performance: ${bestBowlingWickets}/${bestBowlingRuns} by ${bestBowlingBowler}`);
}

main().catch(console.error);
