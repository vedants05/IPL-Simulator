import * as fs from "fs";
import * as path from "path";
import { loadEnvConfig } from "@next/env";

import { getDefaultCuratorPitch, getHomeStadium } from "../lib/data/pitchCurator";
import { buildAutomaticLineupSelection } from "../lib/logic/automaticLineupBuilder";
import { generateBalancedLeagueFixtures } from "../lib/logic/leagueSchedule";
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
    const cachedData = fs.readFileSync(cachePath, "utf-8");
    const rows = JSON.parse(cachedData);
    return mapRowsToPlayers(rows);
  }
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const res = await fetch(`${url}/rest/v1/players?select=*&order=name.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const rows = await res.json();
  return mapRowsToPlayers(rows);
}

function conditionsFor(homeTeamId: string): MatchGroundConditions {
  const stadium = getHomeStadium(homeTeamId)!;
  const pitch = getDefaultCuratorPitch(homeTeamId)!;
  const outfield = getDefaultOutfieldSettings(homeTeamId)!;
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
    chasingScoringBonus: 0.02,
  };
}

async function main() {
  const players = await loadPlayersOnlyFromSupabase();
  const playerMap: Record<string, Player> = {};
  players.forEach((p) => { playerMap[p.id] = p; });

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
  const baseTeamIds = BASE_TEAMS.map((t) => t.id);

  const mvpStats: Record<string, { name: string; team: string; totalMvpPoints: number; runs: number; fours: number; sixes: number; wickets: number; dots: number; catches: number; stumpings: number }> = {};

  const getMvp = (id: string, name: string, team: string) => {
    if (!mvpStats[id]) {
      mvpStats[id] = { name: name || playerMap[id]?.name || id, team, totalMvpPoints: 0, runs: 0, fours: 0, sixes: 0, wickets: 0, dots: 0, catches: 0, stumpings: 0 };
    }
    return mvpStats[id];
  };

  const TOTAL_SEASONS = 50;

  for (let sIndex = 1; sIndex <= TOTAL_SEASONS; sIndex++) {
    resetLotCache();
    resetAuctionQuirks();

    const teams: Team[] = BASE_TEAMS.map((bt) => ({
      id: bt.id, name: bt.name, shortName: bt.shortName, primaryColor: "#004BA0", secondaryColor: "#D1AB3E",
      homeGround: `${bt.name} Stadium`, city: bt.name.split(" ")[0], totalPurse: 12000, spentAmount: 0, remainingPurse: 12000,
      squad: players.filter((p) => p?.currentTeamId === bt.id || p?.retainedByTeamId === bt.id).map((p) => p.id),
      retainedPlayers: [], rtmCardsUsed: 0, rtmCardsTotal: 6, maxSquadSize: 25, minSquadSize: 18,
      overseasPlayersCurrent: 0, overseasPlayersMax: 8, fanBase: "Massive" as any, prestige: 8, aiPersonality: "Balanced" as any,
      dna: { loyalty: 75, prefYoungsters: 75, experienceFocus: 75, bigNamesPref: 75, looksForDepth: 75, alrValue: 75, batValue: 75, bowlValue: 75, commitmentToTargets: 75, segmentFocus: { overseasPacers: 70, indianPacers: 70, overseasSpinners: 70, indianSpinners: 70, overseasAllRounders: 70, indianAllRounders: 70, overseasBatters: 70, indianBatters: 70 } },
    }));
    const teamsById: Record<string, Team> = {};
    teams.forEach((t) => { teamsById[t.id] = t; });

    // Retentions & Auction
    const retainedSet = new Set<string>();
    baseTeamIds.forEach((tId) => {
      const ret = decideAIRetentions(teamsById[tId], playerMap);
      ret.forEach((id) => retainedSet.add(id));
      teamsById[tId].retainedPlayers = [...ret];
      teamsById[tId].squad = [...ret];
      const spend = ret.reduce((sum, id) => sum + (playerMap[id] && (playerMap[id].nationality === "Overseas" || playerMap[id].isCapped) ? 1400 : 400), 0);
      teamsById[tId].spentAmount = spend;
      teamsById[tId].remainingPurse = Math.max(1000, 12000 - spend);
    });

    const auctionPool = players.filter((p) => Boolean(p) && Boolean(p.id) && !retainedSet.has(p.id));
    auctionPool.sort((a, b) => (b.reputation ?? 5) * 10 + Math.max(b.currentBatting, b.currentBowling) - ((a.reputation ?? 5) * 10 + Math.max(a.currentBatting, a.currentBowling)));

    for (const player of auctionPool) {
      let currentBidderId: string | null = null;
      let currentPriceLakhs = Math.max(50, player.basePrice || 100);
      let activeBidders = true;
      let bidsCount = 0;
      const auctionCtx = { currentBidLakhs: currentPriceLakhs, currentBidderId: null, currentSetIndex: 1, totalSets: 10 };

      while (activeBidders && bidsCount < 20) {
        const eligibleTeams = baseTeamIds.map((id) => teamsById[id]).filter((t) => t.id !== currentBidderId && t.remainingPurse >= currentPriceLakhs + 20 && t.squad.length < 25);
        if (eligibleTeams.length === 0) break;
        const pick = pickBiddingTeam(eligibleTeams, player, player.id, playerMap, { ...auctionCtx, currentBidLakhs: currentPriceLakhs, currentBidderId });
        if (pick && pick.id !== currentBidderId) {
          currentBidderId = pick.id;
          currentPriceLakhs += currentPriceLakhs >= 1000 ? 50 : currentPriceLakhs >= 500 ? 25 : 20;
          bidsCount++;
        } else { activeBidders = false; }
      }

      if (currentBidderId) {
        teamsById[currentBidderId].squad.push(player.id);
        teamsById[currentBidderId].remainingPurse = Math.max(0, teamsById[currentBidderId].remainingPurse - currentPriceLakhs);
        playerMap[player.id].currentTeamId = currentBidderId;
      }
    }

    const buildPlansForTeam = (team: Team, cond: MatchGroundConditions): MatchTeamPlans => {
      const squad = team.squad.map((id) => playerMap[id]).filter(Boolean);
      const selection = buildAutomaticLineupSelection(squad, { useProvisionalCaptain: true });
      return {
        teamId: team.id, isUserControlled: false, tactics: createIntelligentAiTactics(team, cond.pitch),
        battingFirst: { startingXI: selection.battingFirstXI, impactSubs: selection.impactSubOptions || [], plannedImpactPlayerId: selection.impactSubOptions?.[0] || selection.battingFirstXI[10], plannedOutgoingPlayerId: selection.battingFirstXI[10], plannedImpactBattingPosition: 6, captainId: selection.captainId, viceCaptainId: selection.viceCaptainId },
        bowlingFirst: { startingXI: selection.bowlingFirstXI, impactSubs: selection.impactSubOptions || [], plannedImpactPlayerId: selection.impactSubOptions?.[0] || selection.bowlingFirstXI[10], plannedOutgoingPlayerId: selection.bowlingFirstXI[10], plannedImpactBattingPosition: 6, captainId: selection.captainId, viceCaptainId: selection.viceCaptainId },
      };
    };

    const fixtures = generateBalancedLeagueFixtures(baseTeamIds, 2026 + sIndex, "MI", sIndex);

    const trackMvp = (res: any) => {
      res.innings.forEach((inn: any) => {
        inn.batting.forEach((b: any) => {
          const m = getMvp(b.id, b.name, teamsById[playerMap[b.id]?.currentTeamId ?? ""]?.shortName ?? "N/A");
          m.runs += b.runs;
          m.fours += b.fours;
          m.sixes += b.sixes;
          m.totalMvpPoints += (b.runs * 1) + (b.fours * 2.5) + (b.sixes * 3.5);
        });

        inn.bowling.forEach((bw: any) => {
          const m = getMvp(bw.id, bw.name, teamsById[playerMap[bw.id]?.currentTeamId ?? ""]?.shortName ?? "N/A");
          m.wickets += bw.wickets;
          const dots = bw.dots || 0;
          m.dots += dots;
          m.totalMvpPoints += (bw.wickets * 25) + (dots * 1);
        });

        inn.oversDetail.forEach((ov: any) => ov.deliveries.forEach((d: any) => {
          if (d.wicket && d.wicket.fielderId) {
            const m = getMvp(d.wicket.fielderId, d.wicket.fielderName, teamsById[playerMap[d.wicket.fielderId]?.currentTeamId ?? ""]?.shortName ?? "N/A");
            if (d.wicket.kind === "stumped") { m.stumpings++; m.totalMvpPoints += 15; }
            else if (d.wicket.kind === "caught") { m.catches++; m.totalMvpPoints += 10; }
          }
        }));
      });
    };

    for (const m of fixtures) {
      const teamA = teamsById[m.teamA];
      const teamB = teamsById[m.teamB];
      if (!teamA || !teamB) continue;
      const cond = conditionsFor(teamA.id);
      const res = simulateInstantMatch({ fixtureId: m.id, matchNumber: m.matchNumber, seed: `sim-mvp-${sIndex}-${m.matchNumber}`, teamA, teamB, players: playerMap, teamAPlans: buildPlansForTeam(teamA, cond), teamBPlans: buildPlansForTeam(teamB, cond), conditions: cond, time: m.matchNumber % 2 === 0 ? "19:30" : "15:30", stage: m.stage } as any);
      trackMvp(res);
    }
  }

  const topMvp = Object.values(mvpStats)
    .sort((a, b) => b.totalMvpPoints - a.totalMvpPoints)
    .slice(0, 15);

  console.log("\n==================================================================================");
  console.log("             TOP 15 COMBINED CUMULATIVE MVP LEADERS (50 SEASONS)                   ");
  console.log("==================================================================================");
  console.table(topMvp.map((m, idx) => ({
    Rank: idx + 1,
    Player: m.name,
    Team: m.team,
    "MVP Points": Math.round(m.totalMvpPoints),
    Runs: m.runs,
    Wickets: m.wickets,
    "4s": m.fours,
    "6s": m.sixes,
  })));
}

main().catch(console.error);
