import * as fs from "fs";
import * as path from "path";
import { loadEnvConfig } from "@next/env";

import { getDefaultCuratorPitch, getHomeStadium } from "../lib/data/pitchCurator";
import { buildAutomaticLineupSelection } from "../lib/logic/automaticLineupBuilder";
import {
  generateBalancedLeagueFixtures,
  generateKnockoutFixtures,
} from "../lib/logic/leagueSchedule";
import {
  createIntelligentAiTactics,
  simulateInstantMatch,
  type MatchGroundConditions,
  type MatchLineupPlan,
  type MatchTeamPlans,
} from "../lib/logic/matchSimulation";
import {
  calculateGroundScoringImpact,
  calculateOutfieldSpeedRating,
  getDefaultOutfieldSettings,
} from "../lib/logic/stadiumManagement";
import { mapRowsToPlayers } from "../lib/supabase/fetchPlayers";
import { fetchTeamsFromSupabase } from "../lib/supabase/fetchTeams";
import { decideAIRetentions, pickBiddingTeam, resetAuctionQuirks, resetLotCache } from "../lib/logic/auctionEngine";
import type { Player, Team } from "../lib/types";

async function loadPlayersOnlyFromSupabase(): Promise<Player[]> {
  const cachePath = path.join(process.cwd(), "scripts", ".player_cache.json");
  if (fs.existsSync(cachePath)) {
    try {
      const cachedData = fs.readFileSync(cachePath, "utf-8");
      const rows = JSON.parse(cachedData);
      if (Array.isArray(rows) && rows.length > 0) {
        return mapRowsToPlayers(rows);
      }
    } catch {
      // Fall through
    }
  }

  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY) are strictly required. CSV fallback is disabled.");
  }

  const response = await fetch(`${url}/rest/v1/players?select=*&order=name.asc`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch players from Supabase REST API (${response.status})`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Supabase returned no player records.");
  }

  try {
    fs.writeFileSync(cachePath, JSON.stringify(rows), "utf-8");
  } catch {
    // ignore write errors
  }

  return mapRowsToPlayers(rows);
}

function conditionsFor(homeTeamId: string, chasingScoringBonus: number): MatchGroundConditions {
  const stadium = getHomeStadium(homeTeamId);
  const pitch = getDefaultCuratorPitch(homeTeamId);
  const outfield = getDefaultOutfieldSettings(homeTeamId);
  if (!stadium || !pitch || !outfield) throw new Error(`Missing ground data for ${homeTeamId}`);
  const boundaries = stadium.defaultBoundaryDimensions;
  const ground = calculateGroundScoringImpact(homeTeamId, boundaries, outfield);
  return {
    homeTeamId,
    stadiumId: stadium.id,
    stadiumName: stadium.name,
    pitch,
    boundaries,
    outfield,
    outfieldSpeedRating: calculateOutfieldSpeedRating(outfield),
    adjustedExpectedScore: {
      min: Math.round(pitch.expectedFirstInningsScore.min * ground.groundScoringModifier),
      max: Math.round(pitch.expectedFirstInningsScore.max * ground.groundScoringModifier),
    },
    groundScoringModifier: ground.groundScoringModifier,
    chasingScoringBonus,
  };
}

interface Accumulator {
  totalSeasons: number;
  totalMatches: number;
  totalInnings: number;
  total1stInningsRuns: number;
  totalRuns: number;
  scores200Count: number;
  scoresUnder120Count: number;
  allOutsCount: number;
  centuriesCount: number;
  fiftiesCount: number;
  highestTeamScore: number;
  highestTeamScoreDetail: string;
  lowestTeamScore: number;
  lowestTeamScoreDetail: string;

  dismissals: {
    caught: number;
    bowled: number;
    lbw: number;
    stumped: number;
    runOut: number;
    hitWicket: number;
  };

  teamStats: Record<string, {
    championships: number;
    playoffAppearances: number;
    totalWins: number;
    totalMatches: number;
    positionSum: number;
    squadSizeSum: number;
    remainingPurseSum: number;
  }>;

  playerCumulativeBatting: Record<string, { name: string; team: string; runs: number; balls: number; fours: number; sixes: number; fifties: number; hundreds: number; highest: number }>;
  playerCumulativeBowling: Record<string, { name: string; team: string; wickets: number; balls: number; runsConceded: number; bestWickets: number; bestRuns: number }>;

  orangeCapWinners: Record<string, number>;
  purpleCapWinners: Record<string, number>;
}

async function main() {
  const startTime = Date.now();
  console.log("==================================================================================");
  console.log("   IPL SIMULATOR — 1,000 FULL SEASONS SIMULATION (74,000 MATCHES + 1,000 AUCTIONS)  ");
  console.log("==================================================================================\n");

  const players = await loadPlayersOnlyFromSupabase();
  console.log(`✓ Authoritative players loaded from Supabase: ${players.length} players.`);

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

  const baseTeamIds = BASE_TEAMS.map(t => t.id);

  const acc: Accumulator = {
    totalSeasons: 0,
    totalMatches: 0,
    totalInnings: 0,
    total1stInningsRuns: 0,
    totalRuns: 0,
    scores200Count: 0,
    scoresUnder120Count: 0,
    allOutsCount: 0,
    centuriesCount: 0,
    fiftiesCount: 0,
    highestTeamScore: 0,
    highestTeamScoreDetail: "",
    lowestTeamScore: 999,
    lowestTeamScoreDetail: "",
    dismissals: { caught: 0, bowled: 0, lbw: 0, stumped: 0, runOut: 0, hitWicket: 0 },
    teamStats: {},
    playerCumulativeBatting: {},
    playerCumulativeBowling: {},
    orangeCapWinners: {},
    purpleCapWinners: {},
  };

  baseTeamIds.forEach((id) => {
    acc.teamStats[id] = { championships: 0, playoffAppearances: 0, totalWins: 0, totalMatches: 0, positionSum: 0, squadSizeSum: 0, remainingPurseSum: 0 };
  });

  const TOTAL_SEASONS_TO_RUN = 1000;

  for (let sIndex = 1; sIndex <= TOTAL_SEASONS_TO_RUN; sIndex++) {
    resetLotCache();
    resetAuctionQuirks();

    const playerMap: Record<string, Player> = {};
    players.forEach((p) => {
      playerMap[p.id] = { ...p, currentTeamId: p.currentTeamId || p.retainedByTeamId };
    });

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

    const teamsById: Record<string, Team> = {};
    teams.forEach((t) => { teamsById[t.id] = t; });

    // 1. AI Retentions
    const retainedSet = new Set<string>();
    baseTeamIds.forEach((tId) => {
      const team = teamsById[tId];
      const ret = decideAIRetentions(team, playerMap);
      ret.forEach((id) => retainedSet.add(id));

      team.retainedPlayers = [...ret];
      team.squad = [...ret];
      const spend = ret.reduce((sum, id) => {
        const p = playerMap[id];
        return sum + (p && (p.nationality === "Overseas" || p.isCapped) ? 1400 : 400);
      }, 0);
      team.spentAmount = spend;
      team.remainingPurse = Math.max(1000, team.totalPurse - spend);
      team.overseasPlayersCurrent = ret.filter((id) => playerMap[id]?.nationality === "Overseas").length;
    });

    // 2. Full Mega Auction Simulation
    const auctionPool = players.filter((p) => Boolean(p) && Boolean(p.id) && !retainedSet.has(p.id));
    auctionPool.sort((a, b) => (b.reputation ?? 5) * 10 + Math.max(b.currentBatting, b.currentBowling) - ((a.reputation ?? 5) * 10 + Math.max(a.currentBatting, a.currentBowling)));

    for (const player of auctionPool) {
      let currentBidderId: string | null = null;
      let currentPriceLakhs = Math.max(50, player.basePrice || 100);
      let activeBidders = true;
      let bidsCount = 0;

      const auctionCtx = { currentBidLakhs: currentPriceLakhs, currentBidderId: null, currentSetIndex: 1, totalSets: 10 };

      while (activeBidders && bidsCount < 20) {
        const eligibleTeams = baseTeamIds
          .map((id) => teamsById[id])
          .filter((t) => t.id !== currentBidderId && t.remainingPurse >= currentPriceLakhs + 20 && t.squad.length < 25);

        if (eligibleTeams.length === 0) break;

        const pick = pickBiddingTeam(eligibleTeams, player, player.id, playerMap, { ...auctionCtx, currentBidLakhs: currentPriceLakhs, currentBidderId });
        if (pick && pick.id !== currentBidderId) {
          currentBidderId = pick.id;
          const increment = currentPriceLakhs >= 1000 ? 50 : currentPriceLakhs >= 500 ? 25 : 20;
          currentPriceLakhs += increment;
          bidsCount++;
        } else {
          activeBidders = false;
        }
      }

      if (currentBidderId) {
        const winningTeam = teamsById[currentBidderId];
        winningTeam.squad.push(player.id);
        winningTeam.spentAmount += currentPriceLakhs;
        winningTeam.remainingPurse = Math.max(0, winningTeam.remainingPurse - currentPriceLakhs);
        if (player.nationality === "Overseas") winningTeam.overseasPlayersCurrent++;
        playerMap[player.id].currentTeamId = winningTeam.id;
      }
    }

    baseTeamIds.forEach((tId) => {
      acc.teamStats[tId].squadSizeSum += teamsById[tId].squad.length;
      acc.teamStats[tId].remainingPurseSum += teamsById[tId].remainingPurse;
    });

    // 3. Lineup Selection & Season Matches
    const buildPlansForTeam = (team: Team, cond: MatchGroundConditions): MatchTeamPlans => {
      const squad = team.squad.map((id) => playerMap[id]).filter(Boolean);
      const selection = buildAutomaticLineupSelection(squad, { useProvisionalCaptain: true });
      const planBattingFirst: MatchLineupPlan = {
        startingXI: selection.battingFirstXI,
        impactSubs: selection.battingFirstImpactSubs || selection.impactSubOptions || [],
        plannedImpactPlayerId: selection.battingFirstImpactSubs?.[0] || selection.impactSubOptions?.[0] || selection.battingFirstXI[10],
        plannedOutgoingPlayerId: selection.battingFirstXI[10],
        plannedImpactBattingPosition: 6,
        captainId: selection.captainId,
        viceCaptainId: selection.viceCaptainId,
      };
      const planBowlingFirst: MatchLineupPlan = {
        startingXI: selection.bowlingFirstXI,
        impactSubs: selection.bowlingFirstImpactSubs || selection.impactSubOptions || [],
        plannedImpactPlayerId: selection.bowlingFirstImpactSubs?.[0] || selection.impactSubOptions?.[0] || selection.bowlingFirstXI[10],
        plannedOutgoingPlayerId: selection.bowlingFirstXI[10],
        plannedImpactBattingPosition: 6,
        captainId: selection.captainId,
        viceCaptainId: selection.viceCaptainId,
      };
      return {
        teamId: team.id,
        isUserControlled: false,
        tactics: createIntelligentAiTactics(team, cond.pitch),
        battingFirst: planBattingFirst,
        bowlingFirst: planBowlingFirst,
      };
    };

    const standings: Record<string, { wins: number; losses: number; points: number }> = {};
    baseTeamIds.forEach((tId) => { standings[tId] = { wins: 0, losses: 0, points: 0 }; });

    const seasonBatting: Record<string, number> = {};
    const seasonBowling: Record<string, number> = {};

    const fixtures = generateBalancedLeagueFixtures(baseTeamIds, 2026 + sIndex, "MI", sIndex);

    for (const m of fixtures) {
      const teamA = teamsById[m.teamA];
      const teamB = teamsById[m.teamB];
      if (!teamA || !teamB) continue;

      const cond = conditionsFor(teamA.id, 0.02);
      const input = {
        fixtureId: m.id,
        matchNumber: m.matchNumber,
        seed: `sim-${sIndex}-${m.matchNumber}`,
        teamA,
        teamB,
        players: playerMap,
        teamAPlans: buildPlansForTeam(teamA, cond),
        teamBPlans: buildPlansForTeam(teamB, cond),
        conditions: cond,
        time: m.matchNumber % 2 === 0 ? "19:30" : "15:30",
        stage: m.stage,
      };

      const result = simulateInstantMatch(input as any);
      acc.totalMatches++;
      acc.teamStats[teamA.id].totalMatches++;
      acc.teamStats[teamB.id].totalMatches++;

      const fInn = result.innings[0];
      const sInn = result.innings[1];
      acc.total1stInningsRuns += fInn.runs;

      if (fInn.runs > acc.highestTeamScore) { acc.highestTeamScore = fInn.runs; acc.highestTeamScoreDetail = `${teamA.shortName} v ${teamB.shortName} (Season ${sIndex})`; }
      if (fInn.runs < acc.lowestTeamScore) { acc.lowestTeamScore = fInn.runs; acc.lowestTeamScoreDetail = `${teamA.shortName} v ${teamB.shortName} (Season ${sIndex})`; }

      const winner = result.winnerId;
      const loser = winner === teamA.id ? teamB.id : teamA.id;
      standings[winner].wins++;
      standings[winner].points += 2;
      acc.teamStats[winner].totalWins++;
      standings[loser].losses++;

      result.innings.forEach((inn) => {
        acc.totalInnings++;
        acc.totalRuns += inn.runs;
        if (inn.runs >= 200) acc.scores200Count++;
        if (inn.runs < 120) acc.scoresUnder120Count++;
        if (inn.wickets === 10) acc.allOutsCount++;

        inn.batting.forEach((b) => {
          if (!acc.playerCumulativeBatting[b.id]) {
            acc.playerCumulativeBatting[b.id] = { name: b.name || playerMap[b.id]?.name || b.id, team: teamsById[playerMap[b.id]?.currentTeamId ?? ""]?.shortName ?? "N/A", runs: 0, balls: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0, highest: 0 };
          }
          const pStat = acc.playerCumulativeBatting[b.id];
          pStat.runs += b.runs;
          pStat.balls += b.balls;
          pStat.fours += b.fours;
          pStat.sixes += b.sixes;
          if (b.runs >= 100) { pStat.hundreds++; acc.centuriesCount++; }
          else if (b.runs >= 50) { pStat.fifties++; acc.fiftiesCount++; }
          if (b.runs > pStat.highest) pStat.highest = b.runs;

          seasonBatting[b.id] = (seasonBatting[b.id] ?? 0) + b.runs;
        });

        inn.bowling.forEach((bw) => {
          if (!acc.playerCumulativeBowling[bw.id]) {
            acc.playerCumulativeBowling[bw.id] = { name: bw.name || playerMap[bw.id]?.name || bw.id, team: teamsById[playerMap[bw.id]?.currentTeamId ?? ""]?.shortName ?? "N/A", wickets: 0, balls: 0, runsConceded: 0, bestWickets: 0, bestRuns: 999 };
          }
          const pStat = acc.playerCumulativeBowling[bw.id];
          pStat.wickets += bw.wickets;
          pStat.balls += bw.balls;
          pStat.runsConceded += bw.runsConceded;
          if (bw.wickets > pStat.bestWickets || (bw.wickets === pStat.bestWickets && bw.runsConceded < pStat.bestRuns)) {
            pStat.bestWickets = bw.wickets;
            pStat.bestRuns = bw.runsConceded;
          }

          seasonBowling[bw.id] = (seasonBowling[bw.id] ?? 0) + bw.wickets;
        });

        inn.oversDetail.forEach((ov) => ov.deliveries.forEach((d) => {
          if (d.wicket) {
            const k = d.wicket.kind;
            if (k === "caught") acc.dismissals.caught++;
            else if (k === "bowled") acc.dismissals.bowled++;
            else if (k === "lbw") acc.dismissals.lbw++;
            else if (k === "stumped") acc.dismissals.stumped++;
            else if (k === "run-out") acc.dismissals.runOut++;
            else if (k === "hit-wicket") acc.dismissals.hitWicket++;
          }
        }));
      });
    }

    // Rank Standings & Playoff
    const ranked = baseTeamIds.map((id) => ({ id, points: standings[id].points, wins: standings[id].wins }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins);

    ranked.forEach((r, idx) => {
      acc.teamStats[r.id].positionSum += (idx + 1);
      if (idx < 4) acc.teamStats[r.id].playoffAppearances++;
    });

    const t1 = teamsById[ranked[0].id];
    const t2 = teamsById[ranked[1].id];
    const t3 = teamsById[ranked[2].id];
    const t4 = teamsById[ranked[3].id];

    const playKnockout = (fixtureId: string, stage: string, teamA: Team, teamB: Team) => {
      const cond = conditionsFor(teamA.id, 0.02);
      const input = {
        fixtureId,
        matchNumber: 71,
        seed: `playoff-${sIndex}-${fixtureId}`,
        teamA,
        teamB,
        players: playerMap,
        teamAPlans: buildPlansForTeam(teamA, cond),
        teamBPlans: buildPlansForTeam(teamB, cond),
        conditions: cond,
        time: "19:30",
        stage,
        isKnockout: true,
      };
      return simulateInstantMatch(input as any);
    };

    const q1Res = playKnockout("qualifier1", "Qualifier 1", t1, t2);
    const q1Winner = q1Res.winnerId === t1.id ? t1 : t2;
    const q1Loser = q1Res.winnerId === t1.id ? t2 : t1;

    const elimRes = playKnockout("eliminator", "Eliminator", t3, t4);
    const elimWinner = elimRes.winnerId === t3.id ? t3 : t4;

    const q2Res = playKnockout("qualifier2", "Qualifier 2", q1Loser, elimWinner);
    const q2Winner = q2Res.winnerId === q1Loser.id ? q1Loser : elimWinner;

    const finalRes = playKnockout("final", "Final", q1Winner, q2Winner);
    const championId = finalRes.winnerId === q1Winner.id ? q1Winner.id : q2Winner.id;
    acc.teamStats[championId].championships++;

    // Track Orange & Purple Cap Winners
    const topBat = Object.entries(seasonBatting).sort((a, b) => b[1] - a[1])[0];
    const topBowl = Object.entries(seasonBowling).sort((a, b) => b[1] - a[1])[0];
    if (topBat) acc.orangeCapWinners[topBat[0]] = (acc.orangeCapWinners[topBat[0]] ?? 0) + 1;
    if (topBowl) acc.purpleCapWinners[topBowl[0]] = (acc.purpleCapWinners[topBowl[0]] ?? 0) + 1;

    acc.totalSeasons++;

    // EVERY 50 SEASONS UPDATE
    if (sIndex % 50 === 0 || sIndex === TOTAL_SEASONS_TO_RUN) {
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      const avg1st = (acc.total1stInningsRuns / (acc.totalSeasons * 70)).toFixed(1);
      const hitWicketPerSeason = (acc.dismissals.hitWicket / acc.totalSeasons).toFixed(2);
      const pct200 = ((acc.scores200Count / acc.totalInnings) * 100).toFixed(1);
      const pctUnder120 = ((acc.scoresUnder120Count / acc.totalInnings) * 100).toFixed(1);

      console.log(`[PROGRESS UPDATE ${sIndex}/1000 SEASONS] (${elapsedSec}s elapsed)`);
      console.log(` • Matches Simulated So Far: ${acc.totalMatches} matches`);
      console.log(` • Avg 1st Innings Score: ${avg1st} runs | 200+ Scores: ${pct200}% | Sub-120 Scores: ${pctUnder120}%`);
      console.log(` • Hit-Wicket Dismissals: ${acc.dismissals.hitWicket} total (${hitWicketPerSeason} / season overall)`);
      console.log(` • Current Title Leaders: ${Object.entries(acc.teamStats).map(([id, st]) => `${id}: ${st.championships}`).join(" | ")}\n`);
    }
  }

  // SAVE FINAL REPORT TO JSON
  const reportPath = path.join(process.cwd(), "simulation_1000_seasons_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(acc, null, 2), "utf-8");
  console.log(`\n✅ 1,000 Seasons Simulation Successfully Completed! Final Report Saved to ${reportPath}`);
}

main().catch(console.error);
