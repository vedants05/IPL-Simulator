import type { Player, Team } from "@/lib/types";
import { getTopSevenBattingPositions } from "./playerBattingPositions";

export const MINI_AUCTION_PURSE_LAKHS = 12_500;

export interface MiniRetentionValidation {
  valid: boolean;
  totalSalary: number;
  remainingPurse: number;
  errors: string[];
}

export type MiniRetentionDecision = "definite-keep" | "keep" | "conditional-keep" | "release" | "definite-release";

export interface MiniRetentionEvaluation {
  playerId: string;
  value: number;
  mandatory: boolean;
  mandatoryReasons: string[];
  decision: MiniRetentionDecision;
  shouldKeep: boolean;
  components: {
    ability: number;
    performance: number;
    potential: number;
    age: number;
    salaryValue: number;
    role: number;
    leadershipOrTenure: number;
    overseas: number;
    reputation: number;
  };
}

interface SeasonPerformance {
  season: number;
  matches: number;
  runs: number;
  balls: number;
  wickets: number;
  oversBowled: number;
}

interface RoleCategory {
  key: string;
  target: number;
  qualifies: (player: Player) => boolean;
}

const ROLE_CATEGORIES: RoleCategory[] = [
  { key: "wicketkeeper", target: 2, qualifies: (player) => player.role === "WK-Batsman" || Boolean(player.isWicketkeeper && !player.isPartTimeWk) },
  { key: "opener", target: 3, qualifies: (player) => Boolean(player.isOpener || player.onlyOpensOrBenched) },
  { key: "top-seven batter", target: 8, qualifies: (player) => getTopSevenBattingPositions(player).length > 0 },
  { key: "bowling option", target: 6, qualifies: (player) => player.currentBowling >= 65 && ["All-Rounder", "Pace Bowler", "Spin Bowler"].includes(player.role) },
  { key: "pace option", target: 3, qualifies: (player) => player.currentBowling >= 65 && (player.role === "Pace Bowler" || player.bowlingStyle === "Pacer") },
  { key: "spin option", target: 2, qualifies: (player) => player.currentBowling >= 65 && (player.role === "Spin Bowler" || player.bowlingStyle === "Spinner") },
  { key: "finisher", target: 2, qualifies: (player) => Boolean(player.isFinisher) },
];

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value));

export function getMiniAuctionContractPrice(player: Player, teamId: string, season: number): number {
  const previousContract = [...(player.iplHistory ?? [])]
    .filter((entry) => entry.teamId === teamId && entry.price > 0 && Number(entry.season) < season)
    .sort((left, right) => Number(right.season) - Number(left.season))[0];
  if (previousContract?.price) return Math.round(previousContract.price);

  // Offseason trades intentionally do not rewrite the completed season's
  // history. Carry the player's existing contract salary into mini-retention
  // when the player is now contracted to the receiving team.
  if (player.currentTeamId === teamId && (player.basePrice ?? 0) > 0) {
    return Math.round(player.basePrice);
  }

  return 0;
}

export function calculateMiniAuctionKeptSalary(keptIds: string[], teamId: string, players: Record<string, Player>, season: number): number {
  return Array.from(new Set(keptIds)).reduce((total, playerId) => {
    const player = players[playerId];
    return total + (player ? getMiniAuctionContractPrice(player, teamId, season) : 0);
  }, 0);
}

export function validateMiniAuctionRetentions(input: { team: Team; keptIds: string[]; players: Record<string, Player>; season: number }): MiniRetentionValidation {
  const { team, keptIds, players, season } = input;
  const errors: string[] = [];
  const uniqueIds = Array.from(new Set(keptIds));
  if (uniqueIds.length !== keptIds.length) errors.push("A player cannot be kept more than once.");

  uniqueIds.forEach((playerId) => {
    const player = players[playerId];
    if (!player) errors.push(`Missing player record: ${playerId}.`);
    else if (!team.squad.includes(playerId)) errors.push(`${player.name} is not part of the existing squad.`);
    else if (player.currentTeamId !== team.id) errors.push(`${player.name} is not contracted to ${team.name}.`);
    else if (player.setForRelease) errors.push(`${player.name} is explicitly set for release.`);
    else if (getMiniAuctionContractPrice(player, team.id, season) <= 0) errors.push(`${player.name} has no valid previous-season contract salary.`);
  });

  const overseasCount = uniqueIds.filter((playerId) => players[playerId]?.nationality === "Overseas").length;
  const maximumSquadSize = team.maxSquadSize ?? 25;
  const maximumOverseas = team.overseasPlayersMax ?? 8;
  if (uniqueIds.length > maximumSquadSize) errors.push(`Kept squad exceeds the ${maximumSquadSize}-player limit.`);
  if (overseasCount > maximumOverseas) errors.push(`Kept squad exceeds the ${maximumOverseas}-player overseas limit.`);

  const totalSalary = calculateMiniAuctionKeptSalary(uniqueIds, team.id, players, season);
  if (totalSalary > MINI_AUCTION_PURSE_LAKHS) errors.push("Kept-player salaries exceed the Rs 125 Cr mini-auction purse.");
  return { valid: errors.length === 0, totalSalary, remainingPurse: Math.max(0, MINI_AUCTION_PURSE_LAKHS - totalSalary), errors };
}

function abilityAdjustment(rating: number): number {
  if (rating >= 83) return 18;
  if (rating >= 81) return 14;
  if (rating >= 79) return 10;
  if (rating >= 76) return 5;
  if (rating >= 73) return 0;
  if (rating >= 70) return -5;
  return rating >= 67 ? -10 : -14;
}

function potentialAdjustment(potential: number): number {
  if (potential >= 84) return 8;
  if (potential >= 81) return 4;
  if (potential >= 78) return 1;
  return 0;
}

function ageAdjustment(age: number): number {
  if (age <= 21) return 6;
  if (age <= 25) return 4;
  if (age <= 29) return 2;
  if (age <= 32) return 0;
  if (age <= 35) return -3;
  if (age <= 37) return -6;
  return -10;
}

function battingPerformanceAdjustment(runs: number, matches: number): number {
  if (runs >= 500) return 15;
  if (runs >= 401) return 12;
  if (runs >= 301) return 9;
  if (runs >= 201) return 6;
  if (runs >= 151) return 3;
  if (runs >= 100) return 0;
  if (matches < 6) return 0;
  return runs >= 51 ? -4 : -8;
}

function bowlingPerformanceAdjustment(wickets: number, matches: number): number {
  if (wickets >= 25) return 15;
  if (wickets >= 20) return 12;
  if (wickets >= 15) return 9;
  if (wickets >= 11) return 6;
  if (wickets >= 8) return 3;
  if (wickets >= 5) return 0;
  if (matches < 6) return 0;
  return wickets >= 2 ? -4 : -8;
}

function seasonPerformances(player: Player, auctionSeason: number): SeasonPerformance[] {
  const fromHistory = (player.iplHistory ?? []).flatMap((entry) => {
    const season = Number(entry.season);
    if (!entry.seasonStats || !Number.isFinite(season) || season >= auctionSeason) return [];
    return [{
      season,
      matches: entry.seasonStats.matches ?? 0,
      runs: entry.seasonStats.runs ?? 0,
      balls: entry.seasonStats.balls ?? 0,
      wickets: entry.seasonStats.wickets ?? 0,
      oversBowled: entry.seasonStats.oversBowled ?? 0,
    }];
  });
  const bySeason = new Map(fromHistory.map((performance) => [performance.season, performance]));
  const fallbackSeason = player.careerState?.lastDevelopmentSeason;
  if (fallbackSeason && fallbackSeason < auctionSeason && !bySeason.has(fallbackSeason)) {
    bySeason.set(fallbackSeason, {
      season: fallbackSeason,
      matches: player.careerState?.lastSeasonMatches ?? 0,
      runs: player.careerState?.lastSeasonRuns ?? 0,
      balls: 0,
      wickets: player.careerState?.lastSeasonWickets ?? 0,
      oversBowled: 0,
    });
  }
  return Array.from(bySeason.values()).sort((left, right) => right.season - left.season).slice(0, 3);
}

function oneSeasonPerformanceAdjustment(player: Player, performance: SeasonPerformance): number {
  if (player.role !== "All-Rounder") {
    return player.role === "Pace Bowler" || player.role === "Spin Bowler"
      ? bowlingPerformanceAdjustment(performance.wickets, performance.matches)
      : battingPerformanceAdjustment(performance.runs, performance.matches);
  }

  const battingEligible = player.currentBatting >= 65 && performance.balls >= 70;
  const bowlingEligible = player.currentBowling >= 65 && performance.oversBowled >= 14;
  if (!battingEligible && !bowlingEligible) return 0;
  if (!battingEligible) return bowlingPerformanceAdjustment(performance.wickets, performance.matches);
  if (!bowlingEligible) return battingPerformanceAdjustment(performance.runs, performance.matches);

  const battingScore = battingPerformanceAdjustment(performance.runs, performance.matches);
  const bowlingScore = bowlingPerformanceAdjustment(performance.wickets, performance.matches);
  const battingWeight = Math.max(0, player.currentBatting - 65);
  const bowlingWeight = Math.max(0, player.currentBowling - 65);
  const totalWeight = battingWeight + bowlingWeight;
  return totalWeight === 0 ? (battingScore + bowlingScore) / 2 : (battingScore * battingWeight + bowlingScore * bowlingWeight) / totalWeight;
}

function weightedPerformanceAdjustment(player: Player, season: number): number {
  const performances = seasonPerformances(player, season);
  if (performances.length === 0) return 0;
  const weights = [0.6, 0.25, 0.15].slice(0, performances.length);
  const availableWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return performances.reduce((sum, performance, index) => sum + oneSeasonPerformanceAdjustment(player, performance) * weights[index], 0) / availableWeight;
}

function estimatedAuctionValue(player: Player): number {
  const rating = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
  const potential = Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0);
  const abilityValue = rating >= 90 ? 2_000 : rating >= 87 ? 1_700 : rating >= 84 ? 1_400 : rating >= 81 ? 1_000 : rating >= 78 ? 700 : rating >= 75 ? 450 : rating >= 72 ? 250 : 100;
  const potentialValue = Math.max(0, potential - rating) * 35;
  const reputationValue = Math.max(0, (player.reputation ?? 5) - 5) * 45;
  return clamp(Math.max(player.basePrice ?? 30, abilityValue + potentialValue + reputationValue), 30, 2_500);
}

function salaryValueAdjustment(player: Player, teamId: string, season: number): number {
  const salary = getMiniAuctionContractPrice(player, teamId, season);
  if (salary <= 0) return -18;
  const ratio = salary / estimatedAuctionValue(player);
  if (ratio <= 0.65) return 12;
  if (ratio <= 0.85) return 6;
  if (ratio <= 1.15) return 0;
  if (ratio <= 1.5) return -8;
  return -18;
}

function roleAdjustment(player: Player, squad: Player[]): number {
  const applicable = ROLE_CATEGORIES.filter((category) => category.qualifies(player));
  if (applicable.length === 0) return 0;
  const adjustments = applicable.map((category) => {
    const count = squad.filter(category.qualifies).length;
    if (count <= 1) return 12;
    if (count === 2) return 8;
    if (count <= category.target) return 4;
    if (count === category.target + 1) return 0;
    if (count === category.target + 2) return -5;
    return -10;
  });
  const positive = adjustments.filter((value) => value > 0);
  return positive.length > 0 ? Math.max(...positive) : Math.min(...adjustments);
}

function consecutiveTeamSeasons(player: Player, teamId: string, season: number): number {
  const teamSeasons = new Set((player.iplHistory ?? []).filter((entry) => entry.teamId === teamId).map((entry) => Number(entry.season)));
  let count = 0;
  for (let year = season - 1; teamSeasons.has(year); year -= 1) count += 1;
  return count;
}

function leadershipOrTenureAdjustment(player: Player, team: Team, season: number): number {
  const viceCaptain = player.id === team.viceCaptainContinuityId ? 5 : 0;
  const tenure = consecutiveTeamSeasons(player, team.id, season);
  const tenureBonus = tenure >= 5 ? 4 : tenure >= 3 ? 2 : 0;
  return Math.max(viceCaptain, tenureBonus);
}

function reputationAdjustment(reputation: number): number {
  if (reputation >= 10) return 22;
  if (reputation >= 9) return 18;
  if (reputation >= 8) return 12;
  if (reputation >= 7) return 5;
  if (reputation >= 6) return 2;
  if (reputation >= 5) return 0;
  if (reputation >= 4) return -2;
  if (reputation >= 3) return -4;
  if (reputation >= 2) return -6;
  return -8;
}

function latestPerformance(player: Player, season: number): SeasonPerformance | undefined {
  return seasonPerformances(player, season).find((performance) => performance.season === season - 1);
}

export function evaluateMiniAuctionRetention(player: Player, team: Team, players: Record<string, Player>, season: number): MiniRetentionEvaluation {
  const rating = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
  const potential = Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0);
  const previousSeason = latestPerformance(player, season);
  const forcedRelease = player.setForRelease === true;
  const mandatoryReasons: string[] = [];
  if (!forcedRelease) {
    if (rating >= 80) mandatoryReasons.push("80+ current rating");
    if (potential >= 86) mandatoryReasons.push("86+ potential");
    if (player.age < 25 && potential >= 80) mandatoryReasons.push("under 25 with 80+ potential");
    if ((previousSeason?.runs ?? 0) > 200) mandatoryReasons.push("more than 200 runs last season");
    if ((previousSeason?.wickets ?? 0) > 10) mandatoryReasons.push("more than 10 wickets last season");
    if (player.id === team.captainContinuityId) mandatoryReasons.push("end-of-season captain");
    if ((player.reputation ?? 5) >= 9) mandatoryReasons.push("reputation 9+ franchise star");
    if (player.lastTradedSeason === season - 1 && player.lastTradedToTeamId === team.id) {
      mandatoryReasons.push("traded in for the upcoming season");
    }
  }

  const squad = team.squad.map((id) => players[id]).filter((candidate): candidate is Player => Boolean(candidate));
  const role = roleAdjustment(player, squad);
  const overseasCount = squad.filter((candidate) => candidate.nationality === "Overseas").length;
  const overseas = player.nationality !== "Overseas" || role >= 8 ? 0 : overseasCount >= 8 ? -6 : overseasCount === 7 ? -3 : 0;
  const components = {
    ability: abilityAdjustment(rating),
    performance: weightedPerformanceAdjustment(player, season),
    potential: potentialAdjustment(potential),
    age: ageAdjustment(player.age),
    salaryValue: salaryValueAdjustment(player, team.id, season),
    role,
    leadershipOrTenure: leadershipOrTenureAdjustment(player, team, season),
    overseas,
    reputation: reputationAdjustment(player.reputation ?? 5),
  };
  const value = Math.round(clamp(50 + Object.values(components).reduce((sum, component) => sum + component, 0), 0, 100));
  const mandatory = mandatoryReasons.length > 0;
  let decision: MiniRetentionDecision;
  let shouldKeep: boolean;
  const reputationProtected = (player.reputation ?? 5) >= 8 && value >= 45;
  if (forcedRelease) {
    decision = "definite-release";
    shouldKeep = false;
  } else if (mandatory || value >= 75) {
    decision = "definite-keep";
    shouldKeep = true;
  } else if (value >= 60) {
    decision = "keep";
    shouldKeep = true;
  } else if (value >= 45) {
    decision = "conditional-keep";
    shouldKeep = reputationProtected || squad.length < 22 || role > 0;
  } else if (value >= 30) {
    decision = "release";
    shouldKeep = reputationProtected || role >= 8;
  } else {
    decision = "definite-release";
    shouldKeep = false;
  }
  return { playerId: player.id, value, mandatory, mandatoryReasons, decision, shouldKeep, components };
}

/** Hard legality always overrides retention preference, including mandatory/star status. */
export function enforceMiniAuctionRetentionLimits(
  team: Team,
  proposedKeptIds: string[],
  players: Record<string, Player>,
  season: number,
): string[] {
  const ranked = Array.from(new Set(proposedKeptIds))
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player && player.currentTeamId === team.id && !player.setForRelease))
    .map((player) => ({ player, evaluation: evaluateMiniAuctionRetention(player, team, players, season) }))
    .sort((left, right) => (
      Number(right.evaluation.mandatory) - Number(left.evaluation.mandatory)
      || right.evaluation.value - left.evaluation.value
      || left.player.id.localeCompare(right.player.id)
    ));

  const releaseLowest = (matches: (player: Player) => boolean): boolean => {
    for (let index = ranked.length - 1; index >= 0; index -= 1) {
      if (!matches(ranked[index].player)) continue;
      ranked.splice(index, 1);
      return true;
    }
    return false;
  };

  const maximumOverseas = team.overseasPlayersMax ?? 8;
  while (ranked.filter(({ player }) => player.nationality === "Overseas").length > maximumOverseas) {
    if (!releaseLowest((player) => player.nationality === "Overseas")) break;
  }

  const maximumSquadSize = team.maxSquadSize ?? 25;
  while (ranked.length > maximumSquadSize) releaseLowest(() => true);

  while (
    ranked.length > 0
    && calculateMiniAuctionKeptSalary(ranked.map(({ player }) => player.id), team.id, players, season) > MINI_AUCTION_PURSE_LAKHS
  ) releaseLowest(() => true);

  return ranked.map(({ player }) => player.id);
}

export function selectAIMiniAuctionKeeps(team: Team, players: Record<string, Player>, season: number): string[] {
  const candidates = team.squad.map((playerId) => players[playerId]).filter((player): player is Player => Boolean(player && player.currentTeamId === team.id));
  const kept = candidates
    .map((player) => ({ player, evaluation: evaluateMiniAuctionRetention(player, team, players, season) }))
    .filter(({ evaluation }) => evaluation.shouldKeep)
    .sort((left, right) => Number(right.evaluation.mandatory) - Number(left.evaluation.mandatory) || right.evaluation.value - left.evaluation.value || left.player.id.localeCompare(right.player.id));

  return enforceMiniAuctionRetentionLimits(team, kept.map(({ player }) => player.id), players, season);
}

/** Normalize a retention-phase save created by older builds into a legal state. */
export function repairMiniAuctionRetentionState(input: {
  teams: Record<string, Team>;
  players: Record<string, Player>;
  season: number;
}): { teams: Record<string, Team>; players: Record<string, Player> } {
  const players = Object.fromEntries(Object.entries(input.players).map(([playerId, player]) => [
    playerId,
    { ...player, isRetained: false, retainedByTeamId: null },
  ])) as Record<string, Player>;
  const teams = Object.fromEntries(Object.entries(input.teams).map(([teamId, team]) => {
    const eligibleSquadIds = team.squad.filter((playerId) => (
      Boolean(players[playerId]) && players[playerId].currentTeamId === teamId
    ));
    const retainedPlayers = enforceMiniAuctionRetentionLimits(
      { ...team, squad: eligibleSquadIds },
      eligibleSquadIds,
      players,
      input.season,
    );
    retainedPlayers.forEach((playerId) => {
      players[playerId] = {
        ...players[playerId],
        currentTeamId: teamId,
        isRetained: true,
        retainedByTeamId: teamId,
      };
    });
    const spentAmount = calculateMiniAuctionKeptSalary(retainedPlayers, teamId, players, input.season);
    return [teamId, {
      ...team,
      squad: eligibleSquadIds,
      retainedPlayers,
      totalPurse: MINI_AUCTION_PURSE_LAKHS,
      spentAmount,
      remainingPurse: Math.max(0, MINI_AUCTION_PURSE_LAKHS - spentAmount),
      rtmCardsTotal: 0,
      rtmCardsUsed: 0,
    }];
  })) as Record<string, Team>;
  return { teams, players };
}
