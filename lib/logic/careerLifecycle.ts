import type {
  Player,
  PlayerCareerState,
  Potential,
  Team,
} from "../types";
import {
  applyAuctionMarketRatings,
  createAuctionMarketProfile,
  getAuctionRoleGroup,
  getRawAuctionPotential,
  getRawAuctionRating,
  hasOpeningSeasonDhoniRetirementGrace,
  roleForGeneratedPlayer,
  type AuctionMarketProfile,
  type AuctionRoleGroup,
} from "./auctionMarket";

export const CAREER_POLICY = {
  auctionEligibilityRating: 68,
  youngDevelopmentPoolMaxAge: 27,
  minimumPlayerPool: 320,
  maximumPlayerPool: 400,
  protectedRetirementRating: 81,
  automaticUnsoldRetirementRating: 74,
  automaticUnsoldRetirementYears: 3,
  veteranProtectionMinimumRating: 80,
  veteranProtectionAge: 40,
  continuationRetirementScore: 25,
  maximumYoungUnrealizedPotentialLoss: 3,
} as const;

export interface CareerSeasonPerformance {
  id?: string;
  name?: string;
  teamId?: string;
  matches: number;
  runs: number;
  balls: number;
  wickets: number;
  runsConceded: number;
  oversBowled: number;
  dismissals?: number;
  dotBalls?: number;
  catches?: number;
  stumpings?: number;
  runOuts?: number;
  emergingPoints?: number;
  emergingBattingImpact?: number;
  emergingBowlingImpact?: number;
}

export type RetirementReason =
  | "natural"
  | "three-unsold-auctions"
  | "auction-continuation"
  | "below-auction-standard"
  | "player-pool-cap";

export interface CareerRetirementRecord {
  playerId: string;
  name: string;
  season: number;
  age: number;
  rating: number;
  role: Player["role"];
  nationality: Player["nationality"];
  reason: RetirementReason;
}

export interface HistoricalPlayerSnapshot {
  id: string;
  name: string;
  role: Player["role"];
  nationality: Player["nationality"];
  country?: string;
  battingStyle?: Player["battingStyle"];
  bowlingStyle?: Player["bowlingStyle"];
  bowlingHand?: Player["bowlingHand"];
  isCapped?: boolean;
  currentBatting?: number;
  potentialBatting?: number;
  currentBowling?: number;
  potentialBowling?: number;
  isOpener?: boolean;
  hasBattedAt3?: boolean;
  hasBattedAt4?: boolean;
  hasBattedAt5?: boolean;
  hasBattedAt6?: boolean;
  hasBattedAt7?: boolean;
  isFinisher?: boolean;
  isWicketkeeper?: boolean;
  retirementAge: number;
  retirementSeason: number;
  finalRating: number;
  careerStats: Player["careerStats"];
  iplStats: Player["iplStats"];
  iplHistory: Player["iplHistory"];
}

export interface CareerLifecycleResult {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  retirements: CareerRetirementRecord[];
  retiredPlayers: Player[];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalRandom(random: () => number, centre: number, standardDeviation: number): number {
  const first = Math.max(1e-9, random());
  const second = random();
  const normal = Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  return centre + normal * standardDeviation;
}

function potentialLabel(player: Pick<Player, "age" | "currentBatting" | "currentBowling" | "potentialBatting" | "potentialBowling">): Potential {
  const current = Math.max(player.currentBatting, player.currentBowling);
  const potential = Math.max(player.potentialBatting, player.potentialBowling);
  const gap = potential - current;
  if (current >= 88) return "World Class";
  if (gap >= 15 && player.age <= 22) return "Wonderkid";
  if (gap >= 8) return "Promising";
  return "Established";
}

export function initializePlayerCareerState(player: Player, baselineSeason: number): PlayerCareerState {
  const existing = player.careerState;
  if (existing) {
    return {
      ...existing,
      unsoldAuctionStreak: existing.unsoldAuctionStreak ?? 0,
      consecutiveLowUsageSeasons: existing.consecutiveLowUsageSeasons ?? 0,
      initialPotentialBatting: existing.initialPotentialBatting ?? player.potentialBatting,
      initialPotentialBowling: existing.initialPotentialBowling ?? player.potentialBowling,
      battingDevelopmentBank: existing.battingDevelopmentBank ?? 0,
      bowlingDevelopmentBank: existing.bowlingDevelopmentBank ?? 0,
      potentialBattingBank: existing.potentialBattingBank ?? 0,
      potentialBowlingBank: existing.potentialBowlingBank ?? 0,
      unrealizedPotentialBattingLoss: existing.unrealizedPotentialBattingLoss ?? 0,
      unrealizedPotentialBowlingLoss: existing.unrealizedPotentialBowlingLoss ?? 0,
      lastSeasonMatches: existing.lastSeasonMatches ?? 0,
      lastSeasonRuns: existing.lastSeasonRuns ?? 0,
      lastSeasonWickets: existing.lastSeasonWickets ?? 0,
      ratingHistory: existing.ratingHistory?.length > 0 ? existing.ratingHistory : [{
        season: baselineSeason,
        batting: player.currentBatting,
        bowling: player.currentBowling,
        potentialBatting: player.potentialBatting,
        potentialBowling: player.potentialBowling,
      }],
    };
  }
  return {
    origin: "database",
    unsoldAuctionStreak: 0,
    consecutiveLowUsageSeasons: 0,
    initialPotentialBatting: player.potentialBatting,
    initialPotentialBowling: player.potentialBowling,
    battingDevelopmentBank: 0,
    bowlingDevelopmentBank: 0,
    potentialBattingBank: 0,
    potentialBowlingBank: 0,
    unrealizedPotentialBattingLoss: 0,
    unrealizedPotentialBowlingLoss: 0,
    lastSeasonMatches: 0,
    lastSeasonRuns: 0,
    lastSeasonWickets: 0,
    ratingHistory: [{
      season: baselineSeason,
      batting: player.currentBatting,
      bowling: player.currentBowling,
      potentialBatting: player.potentialBatting,
      potentialBowling: player.potentialBowling,
    }],
  };
}

export function initializeCareerPlayers(
  players: Record<string, Player>,
  baselineSeason: number,
): Record<string, Player> {
  return Object.fromEntries(Object.entries(players).map(([id, player]) => [id, {
    ...player,
    country: player.country ?? (player.nationality === "Indian" ? "India" : "Overseas"),
    careerState: initializePlayerCareerState(player, baselineSeason),
  }]));
}

export function normalizeCareerSeasonPerformance(value: unknown): Record<string, CareerSeasonPerformance> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([id, raw]) => {
    if (!raw || typeof raw !== "object") return [];
    const stat = raw as Partial<CareerSeasonPerformance>;
    const number = (candidate: unknown) => Number.isFinite(Number(candidate)) ? Number(candidate) : 0;
    return [[id, {
      id,
      name: typeof stat.name === "string" ? stat.name : undefined,
      teamId: typeof stat.teamId === "string" ? stat.teamId : undefined,
      matches: number(stat.matches),
      runs: number(stat.runs),
      balls: number(stat.balls),
      wickets: number(stat.wickets),
      runsConceded: number(stat.runsConceded),
      oversBowled: number(stat.oversBowled),
      dismissals: number(stat.dismissals),
      dotBalls: number(stat.dotBalls),
      catches: number(stat.catches),
      stumpings: number(stat.stumpings),
      runOuts: number(stat.runOuts),
      emergingPoints: number(stat.emergingPoints),
      emergingBattingImpact: number(stat.emergingBattingImpact),
      emergingBowlingImpact: number(stat.emergingBowlingImpact),
    }]];
  }));
}

function battingPerformance(stats: CareerSeasonPerformance): number {
  if (stats.matches <= 0 || stats.balls <= 0) return 0;
  const runsPerMatch = stats.runs / Math.max(1, stats.matches);
  const strikeRate = stats.runs * 100 / Math.max(1, stats.balls);
  return clamp((runsPerMatch / 30) * 0.72 + (strikeRate / 140) * 0.28, 0, 1.65);
}

function bowlingPerformance(stats: CareerSeasonPerformance): number {
  if (stats.matches <= 0 || stats.oversBowled <= 0) return 0;
  const wicketsPerMatch = stats.wickets / Math.max(1, stats.matches);
  const economy = stats.runsConceded / Math.max(1, stats.oversBowled);
  const economyComponent = clamp((9.5 - economy) / 2.5, 0, 1.35);
  return clamp((wicketsPerMatch / 1.15) * 0.75 + economyComponent * 0.25, 0, 1.65);
}

function roleDeclineBase(player: Player, skill: "batting" | "bowling"): number {
  if (skill === "bowling") {
    if (player.role === "Spin Bowler" || (player.role === "All-Rounder" && player.bowlingStyle === "Spinner")) return 0.72;
    if (player.role === "Pace Bowler" || (player.role === "All-Rounder" && player.bowlingStyle === "Pacer")) return 1.16;
    return 0.9;
  }
  if (player.role === "WK-Batsman") return 1.05;
  return 0.92;
}

function agingDecline(age: number): number {
  if (age <= 33) return 0;
  if (age === 34) return 0.55;
  if (age === 35) return 0.72;
  if (age === 36) return 0.92;
  if (age === 37) return 1.18;
  if (age === 38) return 1.5;
  if (age === 39) return 2.8;
  if (age === 40) return 3.8;
  if (age === 41) return 4.9;
  return 6 + (age - 42) * 1.1;
}

function performanceProtection(performance: number, age: number): number {
  const raw = clamp((performance - 0.72) * 0.72, 0, 0.62);
  if (age >= 42) return Math.min(raw, 0.04);
  if (age >= 40) return Math.min(raw, 0.1);
  if (age >= 39) return Math.min(raw, 0.2);
  return raw;
}

function applyBank(value: number, bank: number, delta: number, minimum = 0, maximum = 97): { value: number; bank: number } {
  const total = bank + delta;
  const whole = total >= 0 ? Math.floor(total) : Math.ceil(total);
  return {
    value: clamp(value + whole, minimum, maximum),
    bank: total - whole,
  };
}

function youngGrowth(
  age: number,
  current: number,
  potential: number,
  matches: number,
  performance: number,
  lowUsageSeasons: number,
  production: number,
  emergingBonus: number,
  skill: "batting" | "bowling",
  random: () => number,
): number {
  if (age > 27) return 0;
  const breakoutBonus = skill === "batting"
    ? production >= 800 ? 2.45 : production >= 700 ? 2 : production >= 600 ? 1.55 : production >= 500 ? 1.1 : production >= 400 ? 0.55 : 0
    : production >= 35 ? 2.45 : production >= 30 ? 2 : production >= 25 ? 1.55 : production >= 20 ? 1.1 : production >= 15 ? 0.55 : 0;
  if (potential <= current && breakoutBonus === 0 && emergingBonus === 0) return 0;
  const ageBase = age <= 20 ? 1.75 : age <= 23 ? 1.48 : age <= 25 ? 1.12 : age === 26 ? 0.9 : 0.72;
  const playingTime = clamp(matches / 14, 0, 1);
  const opportunity = 0.12 + playingTime * 0.88;
  const availableGrowth = Math.max(potential - current, breakoutBonus > 0 ? 2 : 0);
  const gap = clamp(availableGrowth / 10, 0.35, 1);
  const performanceFactor = matches <= 0 ? 0.5 : clamp(0.68 + performance * 0.5, 0.6, 1.5);
  const variance = 0.88 + random() * 0.24;
  const ratingDifficulty = current >= 89 ? 0.45 : current >= 86 ? 0.65 : current >= 83 ? 0.82 : 1;
  const inactivityPenalty = age >= 26 && lowUsageSeasons >= 2
    ? Math.min(0.9, (lowUsageSeasons - 1) * 0.3)
    : 0;
  return (
    ageBase * opportunity * gap * performanceFactor * variance
    + breakoutBonus
    + emergingBonus
  ) * ratingDifficulty - inactivityPenalty;
}

function emergingDevelopmentBonus(
  stats: CareerSeasonPerformance,
  skill: "batting" | "bowling",
): number {
  const points = stats.emergingPoints ?? 0;
  if (points < 275) return 0;
  const pointsBonus = points >= 650
    ? 1.8
    : points >= 550
      ? 1.4
      : points >= 450
        ? 1
        : points >= 350
          ? 0.6
          : 0.3;
  const skillImpact = skill === "batting"
    ? stats.emergingBattingImpact ?? 0
    : stats.emergingBowlingImpact ?? 0;
  const strongestImpact = Math.max(
    stats.emergingBattingImpact ?? 0,
    stats.emergingBowlingImpact ?? 0,
  );
  if (strongestImpact <= 0) return 0;
  const impactShare = skillImpact / strongestImpact;
  if (impactShare < 0.35) return 0;
  return pointsBonus * (impactShare >= 0.7 ? 1 : 0.55);
}

function reachesProductionTier(
  skill: "batting" | "bowling",
  production: number,
  battingThreshold: number,
  bowlingThreshold: number,
): boolean {
  return production >= (skill === "batting" ? battingThreshold : bowlingThreshold);
}

function underThirtyOnePotentialPerformanceBoost(
  age: number,
  current: number,
  potential: number,
  performance: number,
  matches: number,
  production: number,
  skill: "batting" | "bowling",
): number {
  if (age > 31 || potential <= current || matches < 8) return 0;
  const exceptional = performance >= 1.58 || reachesProductionTier(skill, production, 750, 32);
  const massive = performance >= 1.45 || reachesProductionTier(skill, production, 650, 28);
  const standout = performance >= 1.25 || reachesProductionTier(skill, production, 500, 22);
  const strong = performance >= 1.12 || reachesProductionTier(skill, production, 400, 16);
  const productive = performance >= 0.92 || reachesProductionTier(skill, production, 300, 12);
  const seasonTier = exceptional
    ? 3.1
    : massive
      ? 2.65
      : standout
        ? 2.2
        : strong
          ? 1.2
          : productive
            ? 0.45
            : 0;
  if (seasonTier === 0) return 0;

  // Young players already receive baseline growth, so this extra component is
  // smaller for them. Ages 28-31 rely much more heavily on what they produce.
  const ageFactor = age <= 27 ? 0.65 : age <= 29 ? 1 : 0.9;
  const headroomFactor = clamp((potential - current) / 6, 0.45, 1);
  const ratingDifficulty = current >= 89 ? 0.3 : current >= 86 ? 0.52 : current >= 83 ? 0.78 : 1;
  return seasonTier * ageFactor * headroomFactor * ratingDifficulty;
}

function peakPerformanceChange(
  current: number,
  performance: number,
  matches: number,
  production: number,
  skill: "batting" | "bowling",
): number {
  if (matches <= 0) return -0.22;
  const exceptional = performance >= 1.58 || reachesProductionTier(skill, production, 750, 32);
  const massive = performance >= 1.45 || reachesProductionTier(skill, production, 650, 28);
  const standout = performance >= 1.25 || reachesProductionTier(skill, production, 500, 22);
  const strong = performance >= 1.12 || reachesProductionTier(skill, production, 400, 16);
  if (exceptional) return current >= 92 ? 0.2 : current >= 89 ? 0.45 : current >= 86 ? 1.1 : 1.55;
  if (massive) return current >= 92 ? 0.16 : current >= 89 ? 0.36 : current >= 86 ? 0.9 : 1.35;
  if (standout) return current >= 92 ? 0.08 : current >= 89 ? 0.2 : current >= 86 ? 0.5 : 0.8;
  if (strong) return current >= 92 ? 0.04 : current >= 89 ? 0.1 : current >= 86 ? 0.28 : 0.4;
  if (performance < 0.42) return -0.55;
  if (performance < 0.68) return -0.28;
  return 0;
}

function dynamicPotentialGain(
  skill: "batting" | "bowling",
  current: number,
  performance: number,
  production: number,
): number {
  const exceptional = performance >= 1.58 || reachesProductionTier(skill, production, 750, 32);
  const massive = performance >= 1.45 || reachesProductionTier(skill, production, 650, 28);
  const standout = performance >= 1.3 || reachesProductionTier(skill, production, 500, 22);
  if (!exceptional && !massive && !standout) return 0;
  if (current >= 92) return exceptional ? 0.12 : massive ? 0.08 : 0.04;
  if (current >= 89) return exceptional ? 0.35 : massive ? 0.25 : 0.12;
  if (current >= 86) return exceptional ? 0.85 : massive ? 0.65 : 0.4;
  return exceptional ? 1.25 : massive ? 1 : 0.7;
}

function updatePotential(
  player: Player,
  skill: "batting" | "bowling",
  current: number,
  potential: number,
  performance: number,
  matches: number,
  production: number,
  currentBank: number,
  currentLoss: number,
): { potential: number; bank: number; loss: number } {
  if (player.age === 32) return { potential: current, bank: 0, loss: currentLoss };
  if (player.age >= 33) return { potential: Math.max(current, potential), bank: 0, loss: currentLoss };

  let delta = 0;
  let loss = currentLoss;
  const performanceGain = dynamicPotentialGain(skill, current, performance, production);
  if (matches >= 8 && performanceGain > 0) {
    delta = performanceGain;
  } else if ((matches === 0 && player.age >= 24) || (matches >= 6 && performance < 0.42)) {
    const remainingLoss = CAREER_POLICY.maximumYoungUnrealizedPotentialLoss - loss;
    const requested = Math.min(remainingLoss, matches === 0 ? 0.36 : 0.24);
    delta = -requested;
    loss += requested;
  }
  const applied = applyBank(potential, currentBank, delta, current, 97);
  return { potential: Math.max(current, applied.value), bank: applied.bank, loss };
}

export function developPlayerAfterSeason(
  player: Player,
  stats: CareerSeasonPerformance,
  season: number,
  seed: string,
  injuryProtectedAbsence = false,
): Player {
  const state = initializePlayerCareerState(player, season - 1);
  if (state.lastDevelopmentSeason === season) return player;
  const random = seededRandom(`${seed}:${season}:${player.id}:development`);
  const lowUsageSeasons = stats.matches < 3
    ? state.consecutiveLowUsageSeasons + 1
    : 0;
  const battingForm = battingPerformance(stats);
  const bowlingForm = bowlingPerformance(stats);
  const absenceRelief = injuryProtectedAbsence && stats.matches < 3 ? 0.55 : 1;

  const skillDelta = (skill: "batting" | "bowling", current: number, potential: number, performance: number): number => {
    const production = skill === "batting" ? stats.runs : stats.wickets;
    const headroomPerformanceBoost = underThirtyOnePotentialPerformanceBoost(
      player.age,
      current,
      potential,
      performance,
      stats.matches,
      production,
      skill,
    );
    if (player.age <= 27) {
      return (youngGrowth(
        player.age,
        current,
        potential,
        stats.matches,
        performance,
        lowUsageSeasons,
        production,
        emergingDevelopmentBonus(stats, skill),
        skill,
        random,
      ) + headroomPerformanceBoost) * absenceRelief;
    }
    if (player.age <= 33) {
      return (
        peakPerformanceChange(current, performance, stats.matches, production, skill)
        + headroomPerformanceBoost
      ) * absenceRelief;
    }
    const decline = agingDecline(player.age) * roleDeclineBase(player, skill);
    const protectedDecline = decline * (1 - performanceProtection(performance, player.age));
    const exceptionalResistance = current >= 88 && performance >= 1.25 && player.age <= 38 ? 0.82 : 1;
    return -protectedDecline * exceptionalResistance;
  };

  const battingDelta = skillDelta("batting", player.currentBatting, player.potentialBatting, battingForm);
  const bowlingDelta = skillDelta("bowling", player.currentBowling, player.potentialBowling, bowlingForm);
  const batting = applyBank(player.currentBatting, state.battingDevelopmentBank, battingDelta, 0, 97);
  const bowling = applyBank(player.currentBowling, state.bowlingDevelopmentBank, bowlingDelta, 0, 97);

  let potentialBatting: ReturnType<typeof updatePotential>;
  let potentialBowling: ReturnType<typeof updatePotential>;
  if (player.age >= 33) {
    const battingPotential = applyBank(player.potentialBatting, state.potentialBattingBank, Math.min(0, battingDelta), batting.value, 97);
    const bowlingPotential = applyBank(player.potentialBowling, state.potentialBowlingBank, Math.min(0, bowlingDelta), bowling.value, 97);
    potentialBatting = { potential: Math.max(batting.value, battingPotential.value), bank: battingPotential.bank, loss: state.unrealizedPotentialBattingLoss };
    potentialBowling = { potential: Math.max(bowling.value, bowlingPotential.value), bank: bowlingPotential.bank, loss: state.unrealizedPotentialBowlingLoss };
  } else {
    potentialBatting = updatePotential(player, "batting", batting.value, player.potentialBatting, battingForm, stats.matches, stats.runs, state.potentialBattingBank, state.unrealizedPotentialBattingLoss);
    potentialBowling = updatePotential(player, "bowling", bowling.value, player.potentialBowling, bowlingForm, stats.matches, stats.wickets, state.potentialBowlingBank, state.unrealizedPotentialBowlingLoss);
  }

  const updated: Player = {
    ...player,
    currentBatting: batting.value,
    currentBowling: bowling.value,
    potentialBatting: potentialBatting.potential,
    potentialBowling: potentialBowling.potential,
    careerState: {
      ...state,
      consecutiveLowUsageSeasons: lowUsageSeasons,
      lastDevelopmentSeason: season,
      battingDevelopmentBank: batting.bank,
      bowlingDevelopmentBank: bowling.bank,
      potentialBattingBank: potentialBatting.bank,
      potentialBowlingBank: potentialBowling.bank,
      unrealizedPotentialBattingLoss: potentialBatting.loss,
      unrealizedPotentialBowlingLoss: potentialBowling.loss,
      lastSeasonMatches: stats.matches,
      lastSeasonRuns: stats.runs,
      lastSeasonWickets: stats.wickets,
      ratingHistory: [
        ...state.ratingHistory.filter((entry) => entry.season !== season),
        {
          season,
          batting: batting.value,
          bowling: bowling.value,
          potentialBatting: potentialBatting.potential,
          potentialBowling: potentialBowling.potential,
        },
      ].sort((left, right) => left.season - right.season).slice(-4),
    },
  };
  updated.potential = potentialLabel(updated);
  return updated;
}

export function calculateCareerContinuationScore(player: Player, projectedAge: number): number {
  const rating = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
  const state = initializePlayerCareerState(player, projectedAge - 1);
  let score = 60 + clamp(rating - 75, 0, 5) * 8;
  const reputation = player.reputation ?? 5;
  if (reputation <= 4) score -= 10;
  else if (reputation >= 10) score += 20;
  else if (reputation >= 9) score += 15;
  else if (reputation >= 8) score += 10;
  else if (reputation >= 7) score += 5;
  if (state.lastSeasonMatches >= 10) score += 10;
  if (state.lastSeasonRuns >= 300 || state.lastSeasonWickets >= 12) score += 10;
  if (state.lastSeasonMatches === 0) score -= 10;
  score -= state.unsoldAuctionStreak * 12;
  const history = state.ratingHistory;
  if (history.length >= 3) {
    const twoYearsAgo = history[history.length - 3];
    const oldRating = Math.max(twoYearsAgo.batting, twoYearsAgo.bowling);
    score -= Math.min(18, Math.max(0, oldRating - rating) * 3);
  }
  if (projectedAge >= 35) score -= (projectedAge - 34) * 3;
  return score;
}

function retirementRecord(player: Player, season: number, age: number, reason: RetirementReason): CareerRetirementRecord {
  return {
    playerId: player.id,
    name: player.name,
    season,
    age,
    rating: Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0),
    role: player.role,
    nationality: player.nationality,
    reason,
  };
}

function removePlayers(
  players: Record<string, Player>,
  teams: Record<string, Team>,
  retiring: Array<{ player: Player; record: CareerRetirementRecord }>,
): CareerLifecycleResult {
  if (retiring.length === 0) return { players, teams, retirements: [], retiredPlayers: [] };
  const ids = new Set(retiring.map((entry) => entry.player.id));
  const remainingPlayers = Object.fromEntries(Object.entries(players).filter(([id]) => !ids.has(id)));
  const remainingTeams = Object.fromEntries(Object.entries(teams).map(([id, team]) => [id, {
    ...team,
    squad: team.squad.filter((playerId) => !ids.has(playerId)),
    retainedPlayers: team.retainedPlayers.filter((playerId) => !ids.has(playerId)),
    captainContinuityId: team.captainContinuityId && ids.has(team.captainContinuityId)
      ? null
      : team.captainContinuityId,
    viceCaptainContinuityId: team.viceCaptainContinuityId && ids.has(team.viceCaptainContinuityId)
      ? null
      : team.viceCaptainContinuityId,
  }]));
  return {
    players: remainingPlayers,
    teams: remainingTeams,
    retirements: retiring.map((entry) => entry.record),
    retiredPlayers: retiring.map((entry) => entry.player),
  };
}

export function processPostSeasonCareer(input: {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  performance: Record<string, CareerSeasonPerformance>;
  completedSeason: number;
  seed: string;
  injuredPlayerIds?: Set<string>;
}): CareerLifecycleResult {
  const developed = Object.fromEntries(Object.entries(input.players).map(([id, player]) => [id,
    developPlayerAfterSeason(
      player,
      input.performance[id] ?? { matches: 0, runs: 0, balls: 0, wickets: 0, runsConceded: 0, oversBowled: 0 },
      input.completedSeason,
      input.seed,
      input.injuredPlayerIds?.has(id) ?? false,
    ),
  ]));
  const retiring = Object.values(developed).flatMap((player) => {
    const rating = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
    const projectedAge = player.age + 1;
    if (
      projectedAge >= CAREER_POLICY.veteranProtectionAge
      && rating < CAREER_POLICY.veteranProtectionMinimumRating
    ) {
      return [{ player, record: retirementRecord(player, input.completedSeason, projectedAge, "natural") }];
    }
    if (rating < 75 || rating >= CAREER_POLICY.protectedRetirementRating) return [];
    if (calculateCareerContinuationScore(player, projectedAge) > CAREER_POLICY.continuationRetirementScore) return [];
    return [{ player, record: retirementRecord(player, input.completedSeason, projectedAge, "natural") }];
  });
  return removePlayers(developed, input.teams, retiring);
}

export function processPostAuctionCareer(input: {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  auctionedPlayerIds: string[];
  season: number;
}): CareerLifecycleResult {
  const auctioned = new Set(input.auctionedPlayerIds);
  const updated = Object.fromEntries(Object.entries(input.players).map(([id, player]) => {
    const state = initializePlayerCareerState(player, input.season - 1);
    const unsoldAuctionStreak = player.currentTeamId
      ? 0
      : auctioned.has(id)
        ? state.unsoldAuctionStreak + 1
        : state.unsoldAuctionStreak;
    return [id, { ...player, careerState: { ...state, unsoldAuctionStreak } }];
  }));
  const retiring = Object.values(updated).flatMap((player) => {
    const rating = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
    if (
      player.age >= CAREER_POLICY.veteranProtectionAge
      && rating < CAREER_POLICY.veteranProtectionMinimumRating
      && !hasOpeningSeasonDhoniRetirementGrace(player)
    ) {
      return [{ player, record: retirementRecord(player, input.season, player.age, "natural") }];
    }
    if (player.currentTeamId) return [];
    const streak = player.careerState?.unsoldAuctionStreak ?? 0;
    if (rating <= CAREER_POLICY.automaticUnsoldRetirementRating && streak >= CAREER_POLICY.automaticUnsoldRetirementYears) {
      return [{ player, record: retirementRecord(player, input.season, player.age, "three-unsold-auctions") }];
    }
    if (
      auctioned.has(player.id)
      && rating >= 75
      && rating < CAREER_POLICY.protectedRetirementRating
      && calculateCareerContinuationScore(player, player.age) <= CAREER_POLICY.continuationRetirementScore
    ) {
      return [{ player, record: retirementRecord(player, input.season, player.age, "auction-continuation") }];
    }
    return [];
  });
  return removePlayers(updated, input.teams, retiring);
}

const OVERSEAS_COUNTRIES = [
  ["Australia", 28], ["England", 29], ["South Africa", 29], ["West Indies", 19],
  ["New Zealand", 16], ["Sri Lanka", 10], ["Afghanistan", 8], ["Bangladesh", 2],
  ["Zimbabwe", 2], ["Ireland", 1],
] as const;

function weightedChoice<T>(entries: ReadonlyArray<readonly [T, number]>, random: () => number): T {
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  let roll = random() * Math.max(1, total);
  for (const [value, weight] of entries) {
    roll -= Math.max(0, weight);
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

function chooseOverseasCountry(players: Record<string, Player>, random: () => number): string {
  // Associate nations are a near-zero combined outcome: about one player per 20-40 seasons.
  if (random() < 0.006) return "Associate";
  const overseas = Object.values(players).filter((player) => player.nationality === "Overseas");
  const totalWeight = OVERSEAS_COUNTRIES.reduce((sum, [, weight]) => sum + weight, 0);
  const weightedDeficits = OVERSEAS_COUNTRIES.map(([country, weight]) => {
    const actual = overseas.filter((player) => player.country === country).length;
    const target = Math.max(1, overseas.length * weight / totalWeight);
    return [country, weight * clamp(target / Math.max(0.75, actual), 0.45, 2.2)] as const;
  });
  return weightedChoice(weightedDeficits, random);
}

function roleTargets(profile: AuctionMarketProfile): Record<AuctionRoleGroup, number> {
  const counts = Object.fromEntries((Object.keys(profile.roles) as AuctionRoleGroup[]).map((role) => [
    role, profile.roles[role].overall.length,
  ])) as Record<AuctionRoleGroup, number>;
  const total = Math.max(1, Object.values(counts).reduce((sum, count) => sum + count, 0));
  return Object.fromEntries(Object.entries(counts).map(([role, count]) => [role, count / total])) as Record<AuctionRoleGroup, number>;
}

function chooseRole(players: Record<string, Player>, profile: AuctionMarketProfile, random: () => number): AuctionRoleGroup {
  const targets = roleTargets(profile);
  const total = Math.max(1, Object.keys(players).length);
  const currentCounts = { BAT: 0, WK: 0, AR: 0, PACE: 0, SPIN: 0 } satisfies Record<AuctionRoleGroup, number>;
  Object.values(players).forEach((player) => { currentCounts[getAuctionRoleGroup(player)] += 1; });
  return weightedChoice((Object.keys(currentCounts) as AuctionRoleGroup[]).map((role) => {
    const targetCount = targets[role] * total;
    // Correct gaps gradually while preserving a healthy mix inside every intake.
    const correction = clamp(targetCount / Math.max(1, currentCounts[role]), 0.65, 1.75);
    return [role, targets[role] * correction] as const;
  }), random);
}

type ProspectCategory = "raw" | "good" | "great" | "elite" | "generational";
type MatureCategory = "good" | "great" | "elite" | "magnificent";

function integerBetween(random: () => number, minimum: number, maximum: number): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function youngRatings(category: ProspectCategory, random: () => number): { current: number; potential: number } {
  const ranges: Record<ProspectCategory, [number, number, number, number]> = {
    raw: [62, 69, 70, 78],
    good: [68, 75, 78, 84],
    great: [73, 79, 84, 89],
    elite: [77, 83, 89, 94],
    generational: [80, 85, 94, 97],
  };
  const [caMin, caMax, paMin, paMax] = ranges[category];
  const current = integerBetween(random, caMin, caMax);
  return { current, potential: Math.max(current, integerBetween(random, paMin, paMax)) };
}

function matureRatings(category: MatureCategory, random: () => number): { current: number; potential: number } {
  const ranges: Record<MatureCategory, [number, number, number, number]> = {
    good: [77, 81, 79, 84],
    great: [82, 86, 84, 89],
    elite: [87, 90, 89, 93],
    magnificent: [89, 91, 91, 93],
  };
  const [caMin, caMax, paMin, paMax] = ranges[category];
  const current = Math.min(91, integerBetween(random, caMin, caMax));
  return { current, potential: Math.min(93, Math.max(current, integerBetween(random, paMin, paMax))) };
}

function generatedSkills(
  role: AuctionRoleGroup,
  current: number,
  potential: number,
  random: () => number,
): Pick<Player, "currentBatting" | "currentBowling" | "potentialBatting" | "potentialBowling"> {
  if (role === "BAT" || role === "WK") {
    const secondary = integerBetween(random, 10, 48);
    return { currentBatting: current, potentialBatting: potential, currentBowling: secondary, potentialBowling: Math.min(65, secondary + integerBetween(random, 0, 5)) };
  }
  if (role === "PACE" || role === "SPIN") {
    const secondary = integerBetween(random, 10, 55);
    return { currentBatting: secondary, potentialBatting: Math.min(68, secondary + integerBetween(random, 0, 7)), currentBowling: current, potentialBowling: potential };
  }
  const gap = integerBetween(random, 0, 11);
  const highCurrent = Math.min(97, Math.round(current + (gap >= 7 ? gap * 0.2 : gap * 0.4)));
  const lowCurrent = Math.max(0, highCurrent - gap);
  const potentialGap = integerBetween(random, 0, 8);
  const highPotential = Math.min(97, Math.round(potential + (potentialGap >= 7 ? potentialGap * 0.2 : potentialGap * 0.4)));
  const lowPotential = Math.max(lowCurrent, highPotential - potentialGap);
  return random() < 0.5
    ? { currentBatting: highCurrent, currentBowling: lowCurrent, potentialBatting: highPotential, potentialBowling: lowPotential }
    : { currentBatting: lowCurrent, currentBowling: highCurrent, potentialBatting: lowPotential, potentialBowling: highPotential };
}

function createGeneratedPlayer(input: {
  index: number;
  season: number;
  seed: string;
  players: Record<string, Player>;
  profile: AuctionMarketProfile;
  forceStrong: boolean;
  forceYoung?: boolean;
}): Player {
  const random = seededRandom(`${input.seed}:${input.season}:regen:${input.index}`);
  const currentIndianShare = Object.values(input.players).filter((player) => player.nationality === "Indian").length
    / Math.max(1, Object.keys(input.players).length);
  // Bias each draw toward the baseline split without producing all-Indian or
  // all-overseas correction batches after a lopsided set of retirements.
  const indianProbability = clamp(0.59 + (0.59 - currentIndianShare) * 2.5, 0.35, 0.8);
  const nationality: Player["nationality"] = random() < indianProbability ? "Indian" : "Overseas";
  const mature = input.forceYoung
    ? false
    : input.forceStrong
      ? random() < 0.35
      : random() < 0.1;
  const age = mature
    ? integerBetween(random, 26, 32)
    : nationality === "Indian"
      ? clamp(Math.round(normalRandom(random, 20, 1.5)), 16, 25)
      : clamp(Math.round(normalRandom(random, 22, 2)), 17, 26);
  let ratings: { current: number; potential: number };
  if (mature) {
    const roll = random();
    const category: MatureCategory = input.forceStrong
      ? (roll < 0.55 ? "great" : roll < 0.88 ? "elite" : "magnificent")
      : (roll < 0.65 ? "good" : roll < 0.9 ? "great" : roll < 0.98 ? "elite" : "magnificent");
    ratings = matureRatings(category, random);
  } else {
    const roll = random();
    const category: ProspectCategory = input.forceStrong
      ? (roll < 0.85 ? "great" : roll < 0.99 ? "elite" : "generational")
      : (roll < 0.5 ? "raw" : roll < 0.88 ? "good" : roll < 0.99 ? "great" : roll < 0.999 ? "elite" : "generational");
    ratings = youngRatings(category, random);
  }
  const roleGroup = chooseRole(input.players, input.profile, random);
  const role = roleForGeneratedPlayer(roleGroup);
  const skills = generatedSkills(roleGroup, ratings.current, ratings.potential, random);
  if (age === 32) {
    skills.potentialBatting = skills.currentBatting;
    skills.potentialBowling = skills.currentBowling;
  }
  const serial = String(input.index + 1).padStart(3, "0");
  const id = `regen-${input.season}-${serial}-${hashSeed(`${input.seed}:${serial}`).toString(36)}`;
  const name = `${nationality === "Indian" ? "Indian" : "Overseas"} Prospect ${input.season}-${serial}`;
  const country = nationality === "Indian" ? "India" : chooseOverseasCountry(input.players, random);
  const player: Player = {
    id,
    name,
    age,
    nationality,
    country,
    role,
    battingStyle: random() < 0.3 ? "Left-hand" : "Right-hand",
    bowlingStyle: roleGroup === "PACE" ? "Pacer" : roleGroup === "SPIN" ? "Spinner" : roleGroup === "AR" ? (random() < 0.62 ? "Pacer" : "Spinner") : null,
    bowlingHand: roleGroup === "BAT" || roleGroup === "WK" ? null : random() < 0.24 ? "Left-hand" : "Right-hand",
    careerStats: {
      batting: { matches: 0, innings: 0, runs: 0, average: 0, strikeRate: 0, fifties: 0, hundreds: 0 },
      bowling: { matches: 0, wickets: 0, economy: 0, average: 0, bestFigures: "0/0" },
    },
    iplStats: { matches: 0, runs: 0, battingAverage: 0, strikeRate: 0, bowlingInnings: 0, bowlingAverage: 0, wickets: 0 },
    iplHistory: [],
    basePrice: 30,
    isCapped: mature && (ratings.current >= 82 || nationality === "Overseas"),
    isRetained: false,
    retainedByTeamId: null,
    currentTeamId: null,
    potential: "Established",
    ...skills,
    reputation: ratings.current >= 89 ? 9 : ratings.current >= 84 ? 8 : ratings.current >= 79 ? 7 : ratings.current >= 73 ? 6 : 4,
    captaincy: integerBetween(random, 35, 72),
    battingAggression: integerBetween(random, 40, 90),
    isWicketkeeper: roleGroup === "WK",
    isPartTimeWk: false,
    isOpener: (roleGroup === "BAT" || roleGroup === "WK") && random() < 0.38,
    isFinisher: (roleGroup === "BAT" || roleGroup === "AR") && random() < 0.28,
    isCoreBatter: (roleGroup === "BAT" || roleGroup === "WK" || roleGroup === "AR") && skills.currentBatting >= 76,
    hasBattedAt3: roleGroup === "BAT" || roleGroup === "WK",
    hasBattedAt4: roleGroup === "BAT" || roleGroup === "WK" || roleGroup === "AR",
    hasBattedAt5: roleGroup === "BAT" || roleGroup === "WK" || roleGroup === "AR",
    hasBattedAt6: roleGroup === "AR" || random() < 0.4,
    hasBattedAt7: roleGroup === "AR" || roleGroup === "PACE" || roleGroup === "SPIN",
  };
  player.potential = potentialLabel(player);
  player.careerState = {
    ...initializePlayerCareerState(player, input.season),
    origin: "generated",
    generatedSeason: input.season,
    lastAgedSeason: input.season,
  };
  return player;
}

export function prepareRetentionPlayerPool(input: {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  season: number;
  seed: string;
  baselineMarketProfile?: AuctionMarketProfile;
}): CareerLifecycleResult & { generatedPlayers: Player[]; marketProfile: AuctionMarketProfile } {
  const initialized = initializeCareerPlayers(input.players, input.season - 1);
  const aged = Object.fromEntries(Object.entries(initialized).map(([id, player]) => {
    const state = initializePlayerCareerState(player, input.season - 1);
    if (state.lastAgedSeason === input.season) return [id, player];
    return [id, { ...player, age: player.age + 1, careerState: { ...state, lastAgedSeason: input.season } }];
  }));
  const belowStandard = Object.values(aged).flatMap((player) => {
    const rating = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
    if (
      player.age >= CAREER_POLICY.veteranProtectionAge
      && rating < CAREER_POLICY.veteranProtectionMinimumRating
      && !hasOpeningSeasonDhoniRetirementGrace(player)
    ) {
      return [{ player, record: retirementRecord(player, input.season, player.age, "natural") }];
    }
    if (getRawAuctionRating(player) >= CAREER_POLICY.auctionEligibilityRating) return [];
    const canDevelop = player.age <= CAREER_POLICY.youngDevelopmentPoolMaxAge
      && getRawAuctionPotential(player) >= CAREER_POLICY.auctionEligibilityRating;
    if (canDevelop) return [];
    return [{ player, record: retirementRecord(player, input.season, player.age, "below-auction-standard") }];
  });
  let result = removePlayers(aged, input.teams, belowStandard);
  const baseline = input.baselineMarketProfile ?? createAuctionMarketProfile(Object.values(initialized));

  if (Object.keys(result.players).length > CAREER_POLICY.maximumPlayerPool) {
    const excess = Object.keys(result.players).length - CAREER_POLICY.maximumPlayerPool;
    const candidates = Object.values(result.players).sort((left, right) => {
      const leftState = initializePlayerCareerState(left, input.season - 1);
      const rightState = initializePlayerCareerState(right, input.season - 1);
      const leftPriority = getRawAuctionRating(left) + Math.max(0, getRawAuctionPotential(left) - getRawAuctionRating(left)) * 0.25 - leftState.unsoldAuctionStreak * 2;
      const rightPriority = getRawAuctionRating(right) + Math.max(0, getRawAuctionPotential(right) - getRawAuctionRating(right)) * 0.25 - rightState.unsoldAuctionStreak * 2;
      return leftPriority - rightPriority || right.age - left.age || left.id.localeCompare(right.id);
    }).slice(0, excess);
    const capped = removePlayers(result.players, result.teams, candidates.map((player) => ({
      player,
      record: retirementRecord(player, input.season, player.age, "player-pool-cap"),
    })));
    result = {
      ...capped,
      retirements: [...result.retirements, ...capped.retirements],
      retiredPlayers: [...result.retiredPlayers, ...capped.retiredPlayers],
    };
  }

  const existingCurrentSeasonIntake = Object.values(result.players).filter((player) => (
    player.careerState?.origin === "generated"
    && player.careerState.generatedSeason === input.season
  )).length;
  const preIntakePoolSize = Math.max(0, Object.keys(result.players).length - existingCurrentSeasonIntake);
  const replacementCount = Math.max(0, CAREER_POLICY.minimumPlayerPool - preIntakePoolSize);
  const poolAfterReplacements = preIntakePoolSize + replacementCount;
  const intakeRandom = seededRandom(`${input.seed}:${input.season}:annual-youth-intake`);
  const desiredYouthIntake = poolAfterReplacements >= CAREER_POLICY.maximumPlayerPool
    // Keep a small visible youth pipeline in the opening seasons even when
    // the imported database is already at the pool ceiling. These prospects
    // are trimmed only from the existing pool below, so the active database
    // still respects the 400-player cap.
    ? (input.season <= 2029 ? 3 : 0)
    : poolAfterReplacements < 350
      ? 4 + Math.floor(intakeRandom() * 3)
      : poolAfterReplacements < 375
        ? 3 + Math.floor(intakeRandom() * 2)
        : 1 + Math.floor(intakeRandom() * 2);
  const desiredGeneratedCount = Math.min(
    replacementCount + desiredYouthIntake,
    CAREER_POLICY.maximumPlayerPool - preIntakePoolSize,
  );
  const required = Math.max(0, desiredGeneratedCount - existingCurrentSeasonIntake);
  const remainingReplacementCount = Math.max(0, replacementCount - existingCurrentSeasonIntake);
  const strongCount = remainingReplacementCount > 0
    ? Math.min(remainingReplacementCount, Math.max(2, Math.ceil(replacementCount * 0.1)))
    : (desiredYouthIntake > 0 && input.season <= 2029 ? 1 : 0);
  const generatedPlayers: Player[] = [];
  let expanded = { ...result.players };
  for (let index = 0; index < required; index += 1) {
    const player = createGeneratedPlayer({
      index,
      season: input.season,
      seed: input.seed,
      players: expanded,
      profile: baseline,
      forceStrong: index < strongCount,
      forceYoung: index >= remainingReplacementCount,
    });
    expanded[player.id] = player;
    generatedPlayers.push(player);
  }
  expanded = applyAuctionMarketRatings(expanded, baseline);
  if (Object.keys(expanded).length > CAREER_POLICY.maximumPlayerPool) {
    const generatedIds = new Set(generatedPlayers.map((player) => player.id));
    const excess = Object.keys(expanded).length - CAREER_POLICY.maximumPlayerPool;
    const trimCandidates = Object.values(expanded)
      .filter((player) => !generatedIds.has(player.id))
      .sort((left, right) => (
        getRawAuctionRating(left) - getRawAuctionRating(right)
        || right.age - left.age
        || left.id.localeCompare(right.id)
      ))
      .slice(0, excess)
      .map((player) => ({
        player,
        record: retirementRecord(player, input.season, player.age, "player-pool-cap"),
      }));
    const trimmed = removePlayers(expanded, result.teams, trimCandidates);
    expanded = trimmed.players;
    return {
      ...result,
      players: expanded,
      teams: trimmed.teams,
      retirements: [...result.retirements, ...trimmed.retirements],
      retiredPlayers: [...result.retiredPlayers, ...trimmed.retiredPlayers],
      generatedPlayers,
      marketProfile: baseline,
    };
  }
  return { ...result, players: expanded, generatedPlayers, marketProfile: baseline };
}

export function isHistoricallyImportantRetiree(player: Player, referencedPlayerIds: Set<string> = new Set()): boolean {
  const rating = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
  return referencedPlayerIds.has(player.id)
    || rating >= 80
    || (player.iplStats?.matches ?? 0) >= 50
    || (player.iplStats?.runs ?? 0) >= 1_000
    || (player.iplStats?.wickets ?? 0) >= 50;
}

export function createHistoricalPlayerSnapshot(
  player: Player,
  record: CareerRetirementRecord,
): HistoricalPlayerSnapshot {
  return {
    id: player.id,
    name: player.name,
    role: player.role,
    nationality: player.nationality,
    country: player.country,
    battingStyle: player.battingStyle,
    bowlingStyle: player.bowlingStyle,
    bowlingHand: player.bowlingHand,
    isCapped: player.isCapped,
    currentBatting: player.currentBatting,
    potentialBatting: player.potentialBatting,
    currentBowling: player.currentBowling,
    potentialBowling: player.potentialBowling,
    isOpener: player.isOpener,
    hasBattedAt3: player.hasBattedAt3,
    hasBattedAt4: player.hasBattedAt4,
    hasBattedAt5: player.hasBattedAt5,
    hasBattedAt6: player.hasBattedAt6,
    hasBattedAt7: player.hasBattedAt7,
    isFinisher: player.isFinisher,
    isWicketkeeper: player.isWicketkeeper,
    retirementAge: record.age,
    retirementSeason: record.season,
    finalRating: record.rating,
    careerStats: player.careerStats,
    iplStats: player.iplStats,
    iplHistory: player.iplHistory,
  };
}
