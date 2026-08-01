import * as fs from "fs";
import * as path from "path";
import { loadEnvConfig } from "@next/env";

import { getDefaultCuratorPitch, getHomeStadium } from "../lib/data/pitchCurator";
import { buildAutomaticLineupSelection } from "../lib/logic/automaticLineupBuilder";
import {
  generateBalancedLeagueFixtures,
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
    throw new Error("Supabase environment variables are strictly required. CSV fallback is disabled.");
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
    // ignore
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
    outfieldSpeedRating: calculateOutfieldSpeedRating(homeTeamId, outfield),
    adjustedExpectedScore: {
      min: Math.round(pitch.expectedFirstInningsScore.min * ground.modifier),
      max: Math.round(pitch.expectedFirstInningsScore.max * ground.modifier),
    },
    groundScoringModifier: ground.modifier,
    chasingScoringBonus,
  };
}

async function main() {
  const startTime = Date.now();
  console.log("==================================================================================");
  console.log("   IPL SIMULATOR — 50 FULL SEASONS CALIBRATION (RETENTIONS ➔ AUCTION ➔ MATCHES)   ");
  console.log("==================================================================================\n");

  const players = await loadPlayersOnlyFromSupabase();
  console.log(`✓ Authoritative players loaded from Supabase: ${players.length} players.\n`);

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

  let totalMatches = 0;
  let chasingWins = 0;
  let battingFirstWins = 0;
  let tiesCount = 0;
  let total1stInningsRuns = 0;

  const cumulativeBatting: Record<string, { name: string; team: string; runs: number; balls: number; fifties: number; hundreds: number; highest: number }> = {};
  const cumulativeBowling: Record<string, { name: string; team: string; wickets: number; balls: number; runsConceded: number; bestWkts: number; bestRuns: number }> = {};

  const TOTAL_SEASONS = 50;

  for (let sIndex = 1; sIndex <= TOTAL_SEASONS; sIndex++) {
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

    // STEP 1: RETENTIONS
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

    // STEP 2: MEGA AUCTION
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

    // STEP 3: MATCHES
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

    const fixtures = generateBalancedLeagueFixtures(baseTeamIds, 2026 + sIndex, "MI", sIndex);

    // Accumulate player stats
    const trackResultStats = (result: any) => {
      result.innings.forEach((inn: any) => {
        inn.batting.forEach((b: any) => {
          if (!cumulativeBatting[b.id]) {
            const pObj = playerMap[b.id];
            const tObj = teamsById[pObj?.currentTeamId ?? ""];
            cumulativeBatting[b.id] = { name: b.name || pObj?.name || b.id, team: tObj?.shortName ?? "N/A", runs: 0, balls: 0, fifties: 0, hundreds: 0, highest: 0 };
          }
          const st = cumulativeBatting[b.id];
          st.runs += b.runs;
          st.balls += b.balls;
          if (b.runs >= 100) st.hundreds++;
          else if (b.runs >= 50) st.fifties++;
          if (b.runs > st.highest) st.highest = b.runs;
        });

        inn.bowling.forEach((bw: any) => {
          if (!cumulativeBowling[bw.id]) {
            const pObj = playerMap[bw.id];
            const tObj = teamsById[pObj?.currentTeamId ?? ""];
            cumulativeBowling[bw.id] = { name: bw.name || pObj?.name || bw.id, team: tObj?.shortName ?? "N/A", wickets: 0, balls: 0, runsConceded: 0, bestWkts: 0, bestRuns: 999 };
          }
          const st = cumulativeBowling[bw.id];
          st.wickets += bw.wickets;
          st.balls += bw.balls;
          st.runsConceded += bw.runsConceded;
          if (bw.wickets > st.bestWkts || (bw.wickets === st.bestWkts && bw.runsConceded < st.bestRuns)) {
            st.bestWkts = bw.wickets;
            st.bestRuns = bw.runsConceded;
          }
        });
      });
    };

    for (const m of fixtures) {
      const teamA = teamsById[m.teamA];
      const teamB = teamsById[m.teamB];
      if (!teamA || !teamB) continue;

      const cond = conditionsFor(teamA.id, 0.02);
      const input = {
        fixtureId: m.id,
        matchNumber: m.matchNumber,
        seed: `sim-50-${sIndex}-${m.matchNumber}`,
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
      totalMatches++;
      total1stInningsRuns += result.innings[0].runs;
      trackResultStats(result);

      const winnerId = result.winnerId;
      const chasingTeamId = result.innings[1].battingTeamId;

      if (winnerId === chasingTeamId) {
        chasingWins++;
      } else if (winnerId) {
        battingFirstWins++;
      } else {
        tiesCount++;
      }

      const loserId = winnerId === teamA.id ? teamB.id : teamA.id;
      if (winnerId) {
        standings[winnerId].wins++;
        standings[winnerId].points += 2;
        standings[loserId].losses++;
      }
    }

    // PLAYOFF MATCHES
    const ranked = baseTeamIds.map((id) => ({ id, points: standings[id].points, wins: standings[id].wins }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins);

    const t1 = teamsById[ranked[0].id];
    const t2 = teamsById[ranked[1].id];
    const t3 = teamsById[ranked[2].id];
    const t4 = teamsById[ranked[3].id];

    const playKnockout = (fixtureId: string, stage: string, teamA: Team, teamB: Team) => {
      const cond = conditionsFor(teamA.id, 0.02);
      const input = {
        fixtureId,
        matchNumber: 71,
        seed: `playoff-50-${sIndex}-${fixtureId}`,
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
      const res = simulateInstantMatch(input as any);
      totalMatches++;
      total1stInningsRuns += res.innings[0].runs;
      trackResultStats(res);

      if (res.winnerId === res.innings[1].battingTeamId) {
        chasingWins++;
      } else if (res.winnerId) {
        battingFirstWins++;
      } else {
        tiesCount++;
      }
      return res;
    };

    const q1Res = playKnockout("qualifier1", "Qualifier 1", t1, t2);
    const q1Winner = q1Res.winnerId === t1.id ? t1 : t2;
    const q1Loser = q1Res.winnerId === t1.id ? t2 : t1;

    const elimRes = playKnockout("eliminator", "Eliminator", t3, t4);
    const elimWinner = elimRes.winnerId === t3.id ? t3 : t4;

    const q2Res = playKnockout("qualifier2", "Qualifier 2", q1Loser, elimWinner);
    const q2Winner = q2Res.winnerId === q1Loser.id ? q1Loser : elimWinner;

    playKnockout("final", "Final", q1Winner, q2Winner);

    // LOG EVERY 10 SEASONS PROGRESS UPDATE
    if (sIndex % 10 === 0 || sIndex === TOTAL_SEASONS) {
      const chasePct = ((chasingWins / Math.max(1, totalMatches)) * 100).toFixed(2);
      const bat1stPct = ((battingFirstWins / Math.max(1, totalMatches)) * 100).toFixed(2);
      const avg1stScore = (total1stInningsRuns / Math.max(1, totalMatches)).toFixed(1);

      console.log(`[PROGRESS UPDATE ${sIndex}/${TOTAL_SEASONS} SEASONS]`);
      console.log(` • Matches Simulated: ${totalMatches}`);
      console.log(` • Chasing Wins: ${chasingWins} (${chasePct}%)`);
      console.log(` • Batting 1st Wins: ${battingFirstWins} (${bat1stPct}%)`);
      console.log(` • Avg 1st Innings Score: ${avg1stScore} runs\n`);
    }
  }

  const finalChasePct = ((chasingWins / totalMatches) * 100).toFixed(2);
  console.log("==================================================================================");
  console.log(`FINAL 50-SEASON SUMMARY:`);
  console.log(` • Total Matches: ${totalMatches}`);
  console.log(` • Chasing Win Rate: ${finalChasePct}% (${chasingWins} Wins / ${totalMatches} Matches)`);
  console.log(` • Batting 1st Win Rate: ${((battingFirstWins / totalMatches) * 100).toFixed(2)}% (${battingFirstWins} Wins)`);
  console.log(` • Avg 1st Innings Score: ${(total1stInningsRuns / totalMatches).toFixed(1)} runs`);

  const topBatters = Object.values(cumulativeBatting)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 10)
    .map((b) => ({
      Name: b.name,
      Team: b.team,
      Runs: b.runs,
      SR: ((b.runs / Math.max(1, b.balls)) * 100).toFixed(1),
      Fifties: b.fifties,
      Hundreds: b.hundreds,
      High: b.highest,
    }));

  const topBowlers = Object.values(cumulativeBowling)
    .sort((a, b) => b.wickets - a.wickets)
    .slice(0, 10)
    .map((bw) => ({
      Name: bw.name,
      Team: bw.team,
      Wickets: bw.wickets,
      Overs: (bw.balls / 6).toFixed(1),
      Econ: (bw.runsConceded / Math.max(1, bw.balls / 6)).toFixed(2),
      Best: `${bw.bestWkts}/${bw.bestRuns}`,
    }));

  console.log("\n-------------------------------------------------------");
  console.log("      TOP 10 CUMULATIVE RUN SCORERS (50 SEASONS)       ");
  console.log("-------------------------------------------------------");
  console.table(topBatters);

  console.log("\n-------------------------------------------------------");
  console.log("      TOP 10 CUMULATIVE WICKET TAKERS (50 SEASONS)     ");
  console.log("-------------------------------------------------------");
  console.table(topBowlers);
  console.log("==================================================================================");
}

main().catch(console.error);
