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
  const cachedData = fs.readFileSync(cachePath, "utf-8");
  const rows = JSON.parse(cachedData);
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

  const cumulativeBatting: Record<string, { name: string; age: number; team: string; runs: number; balls: number; fifties: number; hundreds: number; highest: number }> = {};
  const cumulativeBowling: Record<string, { name: string; age: number; team: string; wickets: number; balls: number; runsConceded: number; bestWkts: number; bestRuns: number }> = {};

  const allTimeHighestScores: { player: string; team: string; runs: number; balls: number; season: number; match: number }[] = [];
  const allTimeBestBowling: { player: string; team: string; wickets: number; runs: number; overs: string; season: number; match: number }[] = [];

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

    const soldPlayerIds: string[] = [];
    for (let lotIndex = 0; lotIndex < auctionPool.length; lotIndex += 1) {
      const player = auctionPool[lotIndex];
      let currentBidderId: string | null = null;
      let currentPriceLakhs = Math.max(50, player.basePrice || 100);
      let activeBidders = true;
      let bidsCount = 0;
      const auctionCtx = {
        remainingPlayerIds: auctionPool.slice(lotIndex + 1).map((candidate) => candidate.id),
        soldPlayerIds,
        currentLotIndex: lotIndex,
        totalLots: auctionPool.length,
        season: String(2026 + sIndex),
      };

      while (activeBidders && bidsCount < 20) {
        const eligibleTeams = baseTeamIds.map((id) => teamsById[id]).filter((t) => t.id !== currentBidderId && t.remainingPurse >= currentPriceLakhs + 20 && t.squad.length < 25);
        if (eligibleTeams.length === 0) break;
        const pick = pickBiddingTeam(eligibleTeams, player, player.id, playerMap, auctionCtx);
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
        soldPlayerIds.push(player.id);
      }
    }

    const buildPlansForTeam = (team: Team, cond: MatchGroundConditions) => {
      const squad = team.squad.map((id) => playerMap[id]).filter(Boolean);
      const selection = buildAutomaticLineupSelection(squad, { useProvisionalCaptain: true });
      const captain = [...squad].sort((a, b) => (b.captaincy ?? 0) - (a.captaincy ?? 0))[0];
      const viceCaptain = [...squad].filter((player) => player.id !== captain?.id)
        .sort((a, b) => (b.captaincy ?? 0) - (a.captaincy ?? 0))[0];
      return {
        teamId: team.id, isUserControlled: false, tactics: createIntelligentAiTactics(team, cond.pitch),
        battingFirst: { startingXI: selection.battingFirstXI, impactSubs: selection.battingFirstImpactSubs, plannedImpactPlayerId: selection.battingFirstImpactSubs[0] || selection.battingFirstXI[10], plannedOutgoingPlayerId: selection.battingFirstXI[10], plannedImpactBattingPosition: 6, captainId: captain?.id, viceCaptainId: viceCaptain?.id },
        bowlingFirst: { startingXI: selection.bowlingFirstXI, impactSubs: selection.bowlingFirstImpactSubs, plannedImpactPlayerId: selection.bowlingFirstImpactSubs[0] || selection.bowlingFirstXI[10], plannedOutgoingPlayerId: selection.bowlingFirstXI[10], plannedImpactBattingPosition: 6, captainId: captain?.id, viceCaptainId: viceCaptain?.id },
      };
    };

    const fixtures = generateBalancedLeagueFixtures(baseTeamIds, 2026 + sIndex, "MI", String(sIndex));

    for (const m of fixtures) {
      const teamA = teamsById[m.teamA];
      const teamB = teamsById[m.teamB];
      if (!teamA || !teamB) continue;
      const cond = conditionsFor(teamA.id);
      const res = simulateInstantMatch({ fixtureId: m.id, matchNumber: m.matchNumber, seed: `sim-rec-${sIndex}-${m.matchNumber}`, teamA, teamB, players: playerMap, teamAPlans: buildPlansForTeam(teamA, cond), teamBPlans: buildPlansForTeam(teamB, cond), conditions: cond, time: m.matchNumber % 2 === 0 ? "19:30" : "15:30" } as any);

      res.innings.forEach((inn) => {
        inn.batting.forEach((b) => {
          const p = playerMap[b.id];
          const tName = teamsById[p?.currentTeamId ?? ""]?.shortName ?? "N/A";
          if (!cumulativeBatting[b.id]) {
            cumulativeBatting[b.id] = { name: b.name || p?.name || b.id, age: p?.age ?? 25, team: tName, runs: 0, balls: 0, fifties: 0, hundreds: 0, highest: 0 };
          }
          const st = cumulativeBatting[b.id];
          st.runs += b.runs;
          st.balls += b.balls;
          if (b.runs >= 100) st.hundreds++;
          else if (b.runs >= 50) st.fifties++;
          if (b.runs > st.highest) st.highest = b.runs;

          allTimeHighestScores.push({ player: b.name || p?.name || b.id, team: tName, runs: b.runs, balls: b.balls, season: sIndex, match: m.matchNumber });
        });

        inn.bowling.forEach((bw) => {
          const p = playerMap[bw.id];
          const tName = teamsById[p?.currentTeamId ?? ""]?.shortName ?? "N/A";
          if (!cumulativeBowling[bw.id]) {
            cumulativeBowling[bw.id] = { name: bw.name || p?.name || bw.id, age: p?.age ?? 25, team: tName, wickets: 0, balls: 0, runsConceded: 0, bestWkts: 0, bestRuns: 999 };
          }
          const st = cumulativeBowling[bw.id];
          st.wickets += bw.wickets;
          st.balls += bw.balls;
          st.runsConceded += bw.runsConceded;
          if (bw.wickets > st.bestWkts || (bw.wickets === st.bestWkts && bw.runsConceded < st.bestRuns)) {
            st.bestWkts = bw.wickets;
            st.bestRuns = bw.runsConceded;
          }

          if (bw.wickets >= 5) {
            allTimeBestBowling.push({ player: bw.name || p?.name || bw.id, team: tName, wickets: bw.wickets, runs: bw.runsConceded, overs: (bw.balls / 6).toFixed(1), season: sIndex, match: m.matchNumber });
          }
        });
      });
    }
  }

  // Youngsters (Age < 27)
  const topYoungBatters = Object.values(cumulativeBatting)
    .filter((b) => b.age < 27)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 10);

  const topYoungBowlers = Object.values(cumulativeBowling)
    .filter((bw) => bw.age < 27)
    .sort((a, b) => b.wickets - a.wickets)
    .slice(0, 10);

  const topHighScores = allTimeHighestScores
    .sort((a, b) => b.runs - a.runs || a.balls - b.balls)
    .slice(0, 10);

  const topBowlingFigures = allTimeBestBowling
    .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
    .slice(0, 10);

  console.log("\n==================================================================================");
  console.log("              TOP 10 YOUNGSTER RUN SCORERS (UNDER 27 YEARS OLD)                  ");
  console.log("==================================================================================");
  console.table(topYoungBatters.map((b, idx) => ({
    Rank: idx + 1, Player: b.name, Age: b.age, Team: b.team, TotalRuns: b.runs, SR: ((b.runs / Math.max(1, b.balls)) * 100).toFixed(1), Fifties: b.fifties, Hundreds: b.hundreds, HighScore: b.highest,
  })));

  console.log("\n==================================================================================");
  console.log("              TOP 10 YOUNGSTER WICKET TAKERS (UNDER 27 YEARS OLD)                ");
  console.log("==================================================================================");
  console.table(topYoungBowlers.map((bw, idx) => ({
    Rank: idx + 1, Player: bw.name, Age: bw.age, Team: bw.team, Wickets: bw.wickets, Overs: (bw.balls / 6).toFixed(1), Econ: (bw.runsConceded / Math.max(1, bw.balls / 6)).toFixed(2), Best: `${bw.bestWkts}/${bw.bestRuns}`,
  })));

  console.log("\n==================================================================================");
  console.log("              TOP 10 ALL-TIME HIGHEST INDIVIDUAL BATTING SCORES                  ");
  console.log("==================================================================================");
  console.table(topHighScores.map((h, idx) => ({
    Rank: idx + 1, Player: h.player, Team: h.team, Score: `${h.runs} (${h.balls}b)`, SR: ((h.runs / h.balls) * 100).toFixed(1), Detail: `Season ${h.season}, Match ${h.match}`,
  })));

  console.log("\n==================================================================================");
  console.log("              TOP 10 ALL-TIME BEST INDIVIDUAL BOWLING FIGURES                    ");
  console.log("==================================================================================");
  console.table(topBowlingFigures.map((bw, idx) => ({
    Rank: idx + 1, Player: bw.player, Team: bw.team, Figures: `${bw.wickets}/${bw.runs} (${bw.overs} ov)`, Detail: `Season ${bw.season}, Match ${bw.match}`,
  })));
}

main().catch(console.error);
