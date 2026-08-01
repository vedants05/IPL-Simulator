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
  type MatchSimulationRecord,
  type MatchTeamPlans,
} from "../lib/logic/matchSimulation";
import {
  calculateGroundScoringImpact,
  calculateOutfieldSpeedRating,
  getDefaultOutfieldSettings,
} from "../lib/logic/stadiumManagement";
import { mapRowsToPlayers } from "../lib/supabase/fetchPlayers";
import { fetchTeamsFromSupabase } from "../lib/supabase/fetchTeams";
import { useGameStore } from "../lib/store/gameStore";
import type { AuctionState, Player, Team } from "../lib/types";

async function loadPlayers(): Promise<Player[]> {
  const cachePath = path.join(process.cwd(), "scripts", ".player_cache.json");
  if (fs.existsSync(cachePath)) {
    try {
      const cachedData = fs.readFileSync(cachePath, "utf-8");
      const rows = JSON.parse(cachedData);
      if (Array.isArray(rows) && rows.length > 0) {
        return mapRowsToPlayers(rows);
      }
    } catch {
      // Fall through to fetch
    }
  }

  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables are required for calibration");
  }
  const response = await fetch(`${url}/rest/v1/players?select=*&order=name.asc`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Unable to load authoritative Supabase players (${response.status})`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Supabase returned no players for calibration");
  }
  try {
    fs.writeFileSync(cachePath, JSON.stringify(rows), "utf-8");
  } catch {
    // Ignore cache write errors
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

function plan(ids: string[], subs: string[], captainId?: string, viceCaptainId?: string): MatchLineupPlan {
  return {
    startingXI: ids,
    impactSubs: subs,
    captainId,
    viceCaptainId,
  };
}

function teamPlans(team: Team, squad: Player[], conditions: MatchGroundConditions): MatchTeamPlans {
  const selection = buildAutomaticLineupSelection(squad, { useProvisionalCaptain: true });
  const battingCaptain = selection.battingFirstXI
    .map((id) => squad.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player))
    .sort((left, right) => (right.captaincy ?? 50) - (left.captaincy ?? 50))[0];
  const bowlingCaptain = selection.bowlingFirstXI
    .map((id) => squad.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player))
    .sort((left, right) => (right.captaincy ?? 50) - (left.captaincy ?? 50))[0];
  return {
    teamId: team.id,
    isUserControlled: false,
    tactics: createIntelligentAiTactics(team, conditions.pitch),
    battingFirst: plan(
      selection.battingFirstXI,
      selection.battingFirstImpactSubs,
      battingCaptain?.id,
    ),
    bowlingFirst: plan(
      selection.bowlingFirstXI,
      selection.bowlingFirstImpactSubs,
      bowlingCaptain?.id,
    ),
  };
}

interface Standing {
  teamId: string;
  played: number;
  won: number;
  points: number;
  runsFor: number;
  ballsFor: number;
  runsAgainst: number;
  ballsAgainst: number;
}

function table(teamIds: string[], matches: MatchSimulationRecord[]): Standing[] {
  const rows = new Map(teamIds.map((teamId) => [teamId, {
    teamId, played: 0, won: 0, points: 0,
    runsFor: 0, ballsFor: 0, runsAgainst: 0, ballsAgainst: 0,
  }]));
  matches.forEach((match) => {
    const [first, second] = match.innings;
    const left = rows.get(first.battingTeamId)!;
    const right = rows.get(second.battingTeamId)!;
    left.played += 1;
    right.played += 1;
    left.runsFor += first.runs;
    left.ballsFor += first.wickets === 10 ? 120 : first.legalBalls;
    left.runsAgainst += second.runs;
    left.ballsAgainst += second.wickets === 10 ? 120 : second.legalBalls;
    right.runsFor += second.runs;
    right.ballsFor += second.wickets === 10 ? 120 : second.legalBalls;
    right.runsAgainst += first.runs;
    right.ballsAgainst += first.wickets === 10 ? 120 : first.legalBalls;
    if (match.winnerId) {
      const winner = rows.get(match.winnerId)!;
      winner.won += 1;
      winner.points += 2;
    } else {
      left.points += 1;
      right.points += 1;
    }
  });
  const nrr = (row: Standing) => (
    row.runsFor / Math.max(1, row.ballsFor / 6)
    - row.runsAgainst / Math.max(1, row.ballsAgainst / 6)
  );
  return Array.from(rows.values()).sort((left, right) => (
    right.points - left.points || nrr(right) - nrr(left)
  ));
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function runAuction(
  sourceTeams: Team[],
  sourcePlayers: Player[],
  seasonIndex: number,
): {
  teams: Record<string, Team>;
  players: Record<string, Player>;
  sales: AuctionState["saleHistory"];
} {
  const originalRandom = Math.random;
  Math.random = seededRandom(0x51f15e + seasonIndex * 104729);
  try {
    const startingPlayers = Object.fromEntries(sourcePlayers.map((player) => [
      player.id,
      {
        ...player,
        currentTeamId: null,
        isRetained: false,
        retainedByTeamId: null,
        iplHistory: [...player.iplHistory],
      },
    ]));
    const startingTeams = Object.fromEntries(sourceTeams.map((team) => {
      const originalSquad = sourcePlayers
        .filter((player) => player.currentTeamId === team.id)
        .map((player) => player.id);
      return [team.id, {
        ...team,
        squad: originalSquad,
        retainedPlayers: [],
        remainingPurse: 12_000,
        spentAmount: 0,
        minSquadSize: 18,
        softSquadTarget: 24,
        overseasPlayersCurrent: 0,
      }];
    }));
    useGameStore.setState({
      currentSeason: 2027 + seasonIndex,
      players: startingPlayers,
      teams: startingTeams,
      userTeamId: sourceTeams[seasonIndex % sourceTeams.length].id,
      auctionTargets: {},
      auctionTargetPriorities: {},
      acceleratedPlanningState: null,
      userAcceleratedTargets: [],
      aiAcceleratedTargets: {},
      aiAcceleratedBackups: {},
      auction: {
        type: "mega",
        season: 2027 + seasonIndex,
        phase: "retention",
        allPlayerIds: [],
        soldPlayerIds: [],
        unsoldPlayerIds: [],
        currentLotIndex: 0,
        currentPlayer: null,
        currentBid: 0,
        currentHighBidderTeamId: null,
        biddingHistory: [],
        timerSeconds: 10,
        sets: [],
        currentSetIndex: 0,
        teamPurses: {},
        isAcceleratedPhase: false,
        rtm: null,
        soldFlash: null,
        unsoldFlash: null,
        saleHistory: [],
      },
    });
    const actions = useGameStore.getState();
    actions.autoRetainPlayers();
    useGameStore.getState().confirmRetentions();
    useGameStore.getState().skipAllAuction();
    const completed = useGameStore.getState();
    if (completed.auction?.phase !== "completed") {
      throw new Error(`Auction ${seasonIndex + 1} did not complete`);
    }
    Object.values(completed.teams).forEach((team) => {
      if (team.squad.length < 18 || team.squad.length > 25) {
        throw new Error(`${team.id} ended auction with ${team.squad.length} players`);
      }
      const overseas = team.squad
        .map((id) => completed.players[id])
        .filter((player) => player?.nationality === "Overseas")
        .length;
      if (overseas > 8) throw new Error(`${team.id} ended auction with ${overseas} overseas players`);
    });
    return {
      teams: completed.teams,
      players: completed.players,
      sales: completed.auction.saleHistory,
    };
  } finally {
    Math.random = originalRandom;
  }
}

async function main() {
  const seasonCount = Math.max(1, Number(process.argv[2] ?? 8));
  const chasingScoringBonus = Number(process.argv[3] ?? 0.05);
  const seasonOffset = Math.max(0, Number(process.argv[4] ?? 0));
  const players = await loadPlayers();
  const teams = await fetchTeamsFromSupabase();
  let playerMap: Record<string, Player> = {};
  let teamMap: Record<string, Team> = {};
  let squads: Record<string, Player[]> = {};

  const totals = {
    matches: 0, leagueMatches: 0, runs: 0, innings: 0, firstInningsRuns: 0,
    chaseWins: 0, decidedMatches: 0, homeWins: 0, homeMatches: 0, tossWins: 0,
    ties: 0, allOuts: 0, scores200: 0, scoresUnder120: 0, stumpings: 0,
    firstInningsUnder120: 0, failedChasesUnder120: 0, successfulChasesUnder120: 0,
    missedStumpings: 0, keeperMismatches: 0, byes: 0, wides: 0, noBalls: 0,
    centuries: 0,
  };
  const champions: Record<string, number> = {};
  const playoffCounts: Record<string, number> = {};
  const positionTotals: Record<string, number> = {};
  const teamMatches: Record<string, number> = {};
  const teamWins: Record<string, number> = {};
  const dismissalKinds: Record<string, number> = {};
  const battingLeaderCounts: Record<string, number> = {};
  const bowlingLeaderCounts: Record<string, number> = {};
  const auctionTeamMetrics: Record<string, {
    squadSizes: number[];
    remainingPurses: number[];
    xiBatting: number[];
    xiBowling: number[];
    xiOverall: number[];
  }> = Object.fromEntries(teams.map((team) => [team.id, {
    squadSizes: [],
    remainingPurses: [],
    xiBatting: [],
    xiBowling: [],
    xiOverall: [],
  }]));
  const seasonSummaries: unknown[] = [];
  const auctionFingerprints = new Set<string>();
  const auctionSquadSizes: number[] = [];
  const auctionOverseasCounts: number[] = [];
  const unsoldPlayerCounts = new Map<string, {
    name: string;
    nationality: string;
    rating: number;
    count: number;
  }>();
  type AuctionOutcomeBucket = {
    appearances: number;
    retained: number;
    sold: number;
    unsold: number;
    totalSalePrice: number;
    salesAtBase: number;
  };
  const basePriceOutcomes = new Map<number, AuctionOutcomeBucket>();
  const playerCategoryOutcomes = new Map<string, AuctionOutcomeBucket>();
  const biddingWarsByRating = new Map<number, {
    pool: number;
    retained: number;
    sold: number;
    biddingWars: number;
    totalSalePrice: number;
    totalBasePrice: number;
  }>();
  const recordAuctionOutcome = (
    map: Map<any, AuctionOutcomeBucket>,
    key: any,
    outcome: "retained" | "sold" | "unsold",
    basePrice: number,
    salePrice?: number,
  ) => {
    const bucket = map.get(key) ?? {
      appearances: 0, retained: 0, sold: 0, unsold: 0, totalSalePrice: 0, salesAtBase: 0,
    };
    bucket.appearances += 1;
    bucket[outcome] += 1;
    if (outcome === "sold" && salePrice !== undefined) {
      bucket.totalSalePrice += salePrice;
      bucket.salesAtBase += Number(salePrice === basePrice);
    }
    map.set(key, bucket);
  };

  const simulate = (
    seasonIndex: number,
    matchNumber: number,
    teamAId: string,
    teamBId: string,
    stage?: string,
  ) => {
    const conditions = conditionsFor(teamAId, chasingScoringBonus);
    const result = simulateInstantMatch({
      fixtureId: `cal-${seasonIndex}-${matchNumber}`,
      matchNumber,
      seed: `calibration:${seasonIndex}:${matchNumber}:${teamAId}:${teamBId}`,
      teamA: teamMap[teamAId],
      teamB: teamMap[teamBId],
      players: playerMap,
      teamAPlans: teamPlans(teamMap[teamAId], squads[teamAId], conditions),
      teamBPlans: teamPlans(teamMap[teamBId], squads[teamBId], conditions),
      conditions,
      stage,
      isKnockout: Boolean(stage),
    });
    totals.matches += 1;
    totals.runs += result.innings.reduce((sum, innings) => sum + innings.runs, 0);
    totals.innings += result.innings.length;
    totals.firstInningsRuns += result.innings[0].runs;
    totals.firstInningsUnder120 += Number(result.innings[0].runs < 120);
    totals.failedChasesUnder120 += Number(
      result.innings[1].runs < 120
      && result.winnerId !== result.innings[1].battingTeamId,
    );
    totals.successfulChasesUnder120 += Number(
      result.innings[1].runs < 120
      && result.winnerId === result.innings[1].battingTeamId,
    );
    totals.decidedMatches += Number(Boolean(result.winnerId));
    totals.chaseWins += Number(result.winnerId === result.innings[1].battingTeamId);
    totals.homeMatches += 1;
    totals.homeWins += Number(result.winnerId === teamAId);
    totals.tossWins += Number(result.winnerId === result.tossWinnerId);
    totals.ties += Number(Boolean(result.superOver));
    teamMatches[teamAId] = (teamMatches[teamAId] ?? 0) + 1;
    teamMatches[teamBId] = (teamMatches[teamBId] ?? 0) + 1;
    if (result.winnerId) teamWins[result.winnerId] = (teamWins[result.winnerId] ?? 0) + 1;
    result.innings.forEach((innings) => {
      totals.centuries += innings.batting.filter((entry) => entry.runs >= 100).length;
      totals.allOuts += Number(innings.wickets === 10);
      totals.scores200 += Number(innings.runs >= 200);
      totals.scoresUnder120 += Number(innings.runs < 120);
      totals.byes += innings.extras.byes;
      totals.wides += innings.extras.wides;
      totals.noBalls += innings.extras.noBalls;
      const keeperIds = new Set<string>();
      innings.oversDetail.forEach((over) => over.deliveries.forEach((delivery) => {
        if (delivery.wicket?.kind === "stumped") {
          totals.stumpings += 1;
          if (delivery.wicket.fielderId) keeperIds.add(delivery.wicket.fielderId);
        }
        if (delivery.wicket) {
          dismissalKinds[delivery.wicket.kind] = (dismissalKinds[delivery.wicket.kind] ?? 0) + 1;
        }
        if (delivery.fieldingEvent?.kind === "missed-stumping") {
          totals.missedStumpings += 1;
          if (delivery.fieldingEvent.fielderId) keeperIds.add(delivery.fieldingEvent.fielderId);
        }
      }));
      totals.keeperMismatches += Number(keeperIds.size > 1);
    });
    return result;
  };

  for (
    let seasonIndex = seasonOffset;
    seasonIndex < seasonOffset + seasonCount;
    seasonIndex += 1
  ) {
    const year = 2027 + seasonIndex;
    const auction = runAuction(teams, players, seasonIndex);
    playerMap = auction.players;
    teamMap = auction.teams;
    const finalSaleByPlayer = new Map<string, (typeof auction.sales)[number]>();
    auction.sales.forEach((sale) => finalSaleByPlayer.set(sale.playerId, sale));
    Object.values(playerMap).forEach((player) => {
      const outcome = player.isRetained ? "retained" : player.currentTeamId ? "sold" : "unsold";
      const seasonHistory = player.iplHistory.find((history) => history.season === String(year));
      const salePrice = outcome === "sold" ? seasonHistory?.price : undefined;
      const category = `${player.isCapped ? "Capped" : "Uncapped"} ${player.nationality}`;
      recordAuctionOutcome(basePriceOutcomes, player.basePrice, outcome, player.basePrice, salePrice);
      recordAuctionOutcome(playerCategoryOutcomes, category, outcome, player.basePrice, salePrice);
      const rating = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
      if (rating >= 70 && rating <= 83) {
        const ratingBucket = biddingWarsByRating.get(rating) ?? {
          pool: 0, retained: 0, sold: 0, biddingWars: 0, totalSalePrice: 0, totalBasePrice: 0,
        };
        ratingBucket.pool += 1;
        ratingBucket.retained += Number(outcome === "retained");
        if (outcome === "sold") {
          const finalSale = finalSaleByPlayer.get(player.id);
          const finalPrice = finalSale?.price ?? salePrice ?? player.basePrice;
          ratingBucket.sold += 1;
          ratingBucket.biddingWars += Number(finalPrice > player.basePrice);
          ratingBucket.totalSalePrice += finalPrice;
          ratingBucket.totalBasePrice += player.basePrice;
        }
        biddingWarsByRating.set(rating, ratingBucket);
      }
    });
    Object.values(playerMap)
      .filter((player) => !player.currentTeamId)
      .forEach((player) => {
        const existing = unsoldPlayerCounts.get(player.id);
        unsoldPlayerCounts.set(player.id, {
          name: player.name,
          nationality: player.nationality,
          rating: Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0),
          count: (existing?.count ?? 0) + 1,
        });
      });
    squads = Object.fromEntries(teams.map((team) => [
      team.id,
      teamMap[team.id].squad.map((id) => playerMap[id]).filter(Boolean),
    ]));
    teams.forEach((team) => {
      const selection = buildAutomaticLineupSelection(squads[team.id], {
        useProvisionalCaptain: true,
      });
      const xi = selection.battingFirstXI.map((id) => playerMap[id]).filter(Boolean);
      const topBatters = [...xi].sort((left, right) => right.currentBatting - left.currentBatting).slice(0, 7);
      const topBowlers = [...xi].sort((left, right) => right.currentBowling - left.currentBowling).slice(0, 5);
      const batting = topBatters.reduce((sum, player) => sum + player.currentBatting, 0)
        / Math.max(1, topBatters.length);
      const bowling = topBowlers.reduce((sum, player) => sum + player.currentBowling, 0)
        / Math.max(1, topBowlers.length);
      auctionTeamMetrics[team.id].squadSizes.push(teamMap[team.id].squad.length);
      auctionTeamMetrics[team.id].remainingPurses.push(teamMap[team.id].remainingPurse);
      auctionTeamMetrics[team.id].xiBatting.push(batting);
      auctionTeamMetrics[team.id].xiBowling.push(bowling);
      auctionTeamMetrics[team.id].xiOverall.push((batting + bowling) / 2);
    });
    const fingerprint = teams
      .map((team) => `${team.id}:${[...teamMap[team.id].squad].sort().join(",")}`)
      .join("|");
    auctionFingerprints.add(fingerprint);
    auctionSquadSizes.push(...teams.map((team) => teamMap[team.id].squad.length));
    auctionOverseasCounts.push(...teams.map((team) => teamMap[team.id].squad
      .map((id) => playerMap[id])
      .filter((player) => player?.nationality === "Overseas")
      .length));
    const fixtures = generateBalancedLeagueFixtures(
      teams.map((team) => team.id),
      year,
      teams[seasonIndex % teams.length].id,
      `calibration-${seasonIndex}`,
    );
    const league = fixtures.map((fixture) => simulate(
      seasonIndex,
      fixture.matchNumber,
      fixture.teamA,
      fixture.teamB,
    ));
    totals.leagueMatches += league.length;
    const standings = table(teams.map((team) => team.id), league);
    standings.forEach((row, index) => {
      positionTotals[row.teamId] = (positionTotals[row.teamId] ?? 0) + index + 1;
      if (index < 4) playoffCounts[row.teamId] = (playoffCounts[row.teamId] ?? 0) + 1;
    });
    const playoffFixtures = generateKnockoutFixtures(
      fixtures.at(-1)!.date,
      year,
      standings.slice(0, 4).map((row) => row.teamId),
    );
    const q1 = simulate(seasonIndex, 71, playoffFixtures[0].teamA, playoffFixtures[0].teamB, "qualifier1");
    const eliminator = simulate(seasonIndex, 72, playoffFixtures[1].teamA, playoffFixtures[1].teamB, "eliminator");
    const q1Loser = q1.winnerId === playoffFixtures[0].teamA
      ? playoffFixtures[0].teamB : playoffFixtures[0].teamA;
    const q2 = simulate(seasonIndex, 73, q1Loser, eliminator.winnerId!, "qualifier2");
    const final = simulate(seasonIndex, 74, q1.winnerId!, q2.winnerId!, "final");
    const seasonMatches = [...league, q1, eliminator, q2, final];
    const battingTotals = new Map<string, number>();
    const bowlingTotals = new Map<string, number>();
    seasonMatches.forEach((match) => match.innings.forEach((innings) => {
      innings.batting.forEach((entry) => {
        battingTotals.set(entry.id, (battingTotals.get(entry.id) ?? 0) + entry.runs);
      });
      innings.bowling.forEach((entry) => {
        bowlingTotals.set(entry.id, (bowlingTotals.get(entry.id) ?? 0) + entry.wickets);
      });
    }));
    const battingLeader = Array.from(battingTotals.entries()).sort((left, right) => right[1] - left[1])[0];
    const bowlingLeader = Array.from(bowlingTotals.entries()).sort((left, right) => right[1] - left[1])[0];
    battingLeaderCounts[battingLeader[0]] = (battingLeaderCounts[battingLeader[0]] ?? 0) + 1;
    bowlingLeaderCounts[bowlingLeader[0]] = (bowlingLeaderCounts[bowlingLeader[0]] ?? 0) + 1;
    const champion = final.winnerId!;
    champions[champion] = (champions[champion] ?? 0) + 1;
    seasonSummaries.push({
      season: year,
      topFour: standings.slice(0, 4).map((row) => `${row.teamId}:${row.points}`),
      bottom: `${standings.at(-1)!.teamId}:${standings.at(-1)!.points}`,
      champion,
      battingLeader: `${playerMap[battingLeader[0]]?.name}:${battingLeader[1]}`,
      bowlingLeader: `${playerMap[bowlingLeader[0]]?.name}:${bowlingLeader[1]}`,
    });
  }

  const percent = (value: number, denominator: number) => (
    Math.round(value / Math.max(1, denominator) * 10_000) / 100
  );
  const summarizeBasePrices = (group: Player[]) => ({
    players: group.length,
    averageBasePrice: Math.round(group.reduce((sum, player) => sum + player.basePrice, 0) / Math.max(1, group.length)),
    minimumBasePrice: Math.min(...group.map((player) => player.basePrice)),
    maximumBasePrice: Math.max(...group.map((player) => player.basePrice)),
    startingAtTwoCrore: group.filter((player) => player.basePrice >= 200).length,
  });
  const playerRating = (player: Player) => Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
  const summarizeAuctionOutcomes = (entries: Array<[string | number, AuctionOutcomeBucket]>) => Object.fromEntries(
    entries.map(([key, bucket]) => [String(key), {
      averagePoolPerAuction: Math.round(bucket.appearances / seasonCount * 100) / 100,
      averageRetainedPerAuction: Math.round(bucket.retained / seasonCount * 100) / 100,
      averageSoldPerAuction: Math.round(bucket.sold / seasonCount * 100) / 100,
      averageUnsoldPerAuction: Math.round(bucket.unsold / seasonCount * 100) / 100,
      auctionSaleRatePct: percent(bucket.sold, bucket.sold + bucket.unsold),
      averageSalePrice: bucket.sold > 0 ? Math.round(bucket.totalSalePrice / bucket.sold) : 0,
      soldAtBasePct: percent(bucket.salesAtBase, bucket.sold),
    }]),
  );
  console.log(JSON.stringify({
    sample: {
      seasons: seasonCount,
      seasonOffset,
      matches: totals.matches,
      innings: totals.innings,
      chasingScoringBonus,
    },
    auctions: {
      uniquePostAuctionLeagues: auctionFingerprints.size,
      minimumSquadSize: Math.min(...auctionSquadSizes),
      maximumSquadSize: Math.max(...auctionSquadSizes),
      averageSquadSize: Math.round(
        auctionSquadSizes.reduce((sum, size) => sum + size, 0) / auctionSquadSizes.length * 100,
      ) / 100,
      minimumOverseasPlayers: Math.min(...auctionOverseasCounts),
      maximumOverseasPlayers: Math.max(...auctionOverseasCounts),
      averageOverseasPlayers: Math.round(
        auctionOverseasCounts.reduce((sum, size) => sum + size, 0) / auctionOverseasCounts.length * 100,
      ) / 100,
      squadsWithSixToEightOverseas: auctionOverseasCounts.filter(count => count >= 6 && count <= 8).length,
      squadSizeDistribution: Object.fromEntries(
        Array.from(new Set(auctionSquadSizes)).sort((left, right) => left - right)
          .map(size => [size, auctionSquadSizes.filter(value => value === size).length]),
      ),
      averageRemainingPurse: Math.round(
        Object.values(auctionTeamMetrics).flatMap(metric => metric.remainingPurses)
          .reduce((sum, purse) => sum + purse, 0) / (teams.length * seasonCount),
      ),
      minimumRemainingPurse: Math.min(
        ...Object.values(auctionTeamMetrics).flatMap(metric => metric.remainingPurses),
      ),
      maximumRemainingPurse: Math.max(
        ...Object.values(auctionTeamMetrics).flatMap(metric => metric.remainingPurses),
      ),
      outcomesByBasePrice: summarizeAuctionOutcomes(
        Array.from(basePriceOutcomes.entries()).sort((left, right) => left[0] - right[0]),
      ),
      outcomesByPlayerCategory: summarizeAuctionOutcomes(Array.from(playerCategoryOutcomes.entries())),
      biddingWarsByRating: Object.fromEntries(
        Array.from(biddingWarsByRating.entries())
          .sort((left, right) => left[0] - right[0])
          .map(([rating, bucket]) => [rating, {
            averagePoolPerAuction: Math.round(bucket.pool / seasonCount * 100) / 100,
            totalSold: bucket.sold,
            totalBiddingWars: bucket.biddingWars,
            biddingWarPctOfSales: percent(bucket.biddingWars, bucket.sold),
            averageSalePrice: bucket.sold ? Math.round(bucket.totalSalePrice / bucket.sold) : 0,
            averageBasePriceOfSold: bucket.sold ? Math.round(bucket.totalBasePrice / bucket.sold) : 0,
          }]),
      ),
      highestRatedUnsold: Array.from(unsoldPlayerCounts.values())
        .sort((left, right) => right.rating - left.rating || right.count - left.count || left.name.localeCompare(right.name))
        .slice(0, 20),
      highestRatedUnsoldIndian: Array.from(unsoldPlayerCounts.values())
        .filter(player => player.nationality === "Indian")
        .sort((left, right) => right.rating - left.rating || right.count - left.count || left.name.localeCompare(right.name))
        .slice(0, 10),
      highestRatedUnsoldOverseas: Array.from(unsoldPlayerCounts.values())
        .filter(player => player.nationality === "Overseas")
        .sort((left, right) => right.rating - left.rating || right.count - left.count || left.name.localeCompare(right.name))
        .slice(0, 10),
      basePriceReview: {
        allPlayersAbove80: summarizeBasePrices(players.filter((player) => playerRating(player) > 80)),
        indianPlayersAbove77: summarizeBasePrices(players.filter((player) => player.nationality === "Indian" && playerRating(player) > 77)),
        otherPlayers75To80: summarizeBasePrices(players.filter((player) => (
          playerRating(player) >= 75
          && playerRating(player) <= 80
          && !(player.nationality === "Indian" && playerRating(player) > 77)
        ))),
        playersBelow75: summarizeBasePrices(players.filter((player) => playerRating(player) < 75)),
      },
    },
    scoring: {
      averageInnings: Math.round(totals.runs / totals.innings * 10) / 10,
      averageFirstInnings: Math.round(totals.firstInningsRuns / totals.matches * 10) / 10,
      scores200Pct: percent(totals.scores200, totals.innings),
      scoresUnder120Pct: percent(totals.scoresUnder120, totals.innings),
      firstInningsUnder120Pct: percent(totals.firstInningsUnder120, totals.matches),
      failedChasesUnder120Pct: percent(totals.failedChasesUnder120, totals.matches),
      successfulChasesUnder120Pct: percent(totals.successfulChasesUnder120, totals.matches),
      allOutPct: percent(totals.allOuts, totals.innings),
      centuries: totals.centuries,
      centuriesPerSeason: Math.round(totals.centuries / seasonCount * 100) / 100,
      inningsPerCentury: totals.centuries > 0
        ? Math.round(totals.innings / totals.centuries * 100) / 100
        : null,
    },
    results: {
      chaseWinPct: percent(totals.chaseWins, totals.decidedMatches),
      homeWinPct: percent(totals.homeWins, totals.homeMatches),
      tossWinnerWinPct: percent(totals.tossWins, totals.decidedMatches),
      tiedMatches: totals.ties,
    },
    extrasPerInnings: {
      byes: Math.round(totals.byes / totals.innings * 100) / 100,
      wides: Math.round(totals.wides / totals.innings * 100) / 100,
      noBalls: Math.round(totals.noBalls / totals.innings * 100) / 100,
    },
    keeping: {
      stumpings: totals.stumpings,
      missedStumpings: totals.missedStumpings,
      inningsWithMultipleKeepersCredited: totals.keeperMismatches,
    },
    dismissalKinds,
    repeatedSeasonLeaders: {
      batting: Object.fromEntries(
        Object.entries(battingLeaderCounts)
          .filter(([, count]) => count > 1)
          .map(([id, count]) => [playerMap[id]?.name ?? id, count]),
      ),
      bowling: Object.fromEntries(
        Object.entries(bowlingLeaderCounts)
          .filter(([, count]) => count > 1)
          .map(([id, count]) => [playerMap[id]?.name ?? id, count]),
      ),
    },
    teamDistribution: Object.fromEntries(teams.map((team) => [team.id, {
      championships: champions[team.id] ?? 0,
      playoffs: playoffCounts[team.id] ?? 0,
      averageLeaguePosition: Math.round(positionTotals[team.id] / seasonCount * 100) / 100,
      overallWinPct: percent(teamWins[team.id] ?? 0, teamMatches[team.id] ?? 0),
      averagePostAuctionSquad: Math.round(
        auctionTeamMetrics[team.id].squadSizes.reduce((sum, value) => sum + value, 0)
        / seasonCount * 100,
      ) / 100,
      averageRemainingPurse: Math.round(
        auctionTeamMetrics[team.id].remainingPurses.reduce((sum, value) => sum + value, 0)
        / seasonCount,
      ),
      averageXiBatting: Math.round(
        auctionTeamMetrics[team.id].xiBatting.reduce((sum, value) => sum + value, 0)
        / seasonCount * 10,
      ) / 10,
      averageXiBowling: Math.round(
        auctionTeamMetrics[team.id].xiBowling.reduce((sum, value) => sum + value, 0)
        / seasonCount * 10,
      ) / 10,
      averageXiOverall: Math.round(
        auctionTeamMetrics[team.id].xiOverall.reduce((sum, value) => sum + value, 0)
        / seasonCount * 10,
      ) / 10,
    }])),
    seasons: process.argv[5] === "compact" ? undefined : seasonSummaries,
  }, null, 2));
}

void main();
