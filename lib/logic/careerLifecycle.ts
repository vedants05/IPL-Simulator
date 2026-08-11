import type {
  AuctionType,
  Player,
  PlayerCareerState,
  Potential,
  Team,
} from "../types";
import { getAuctionTypeForSeason } from "./auctionCycle";
import {
  applyAuctionMarketRatings,
  createAuctionMarketProfile,
  getAuctionRoleGroup,
  getRawAuctionPotential,
  getRawAuctionRating,
  hasOpeningSeasonDhoniRetirementGrace,
  isPlayerAuctionEligible,
  roleForGeneratedPlayer,
  type AuctionMarketProfile,
  type AuctionRoleGroup,
} from "./auctionMarket";
import { generateRegenName } from "../data/regenNames";
import { calculateBasePrice } from "./playerBasePrice";
import { enforceBattingPositionEligibility } from "./playerBattingPositions";
import { getEmergingPlayerEligibility, rankMvpCandidates } from "./seasonAwards";

export const CAREER_POLICY = {
  auctionEligibilityRating: 67,
  minimumGeneratedCurrentRating: 67,
  highPotentialProjectMaxAge: 19,
  highPotentialProjectMinimumPotential: 88,
  youngDevelopmentPoolMaxAge: 27,
  minimumPlayerPool: 310,
  maximumPlayerPool: 400,
  minimumAnnualGeneratedPlayers: 5,
  maximumAnnualGeneratedPlayers: 30,
  minimumEmergingEligiblePlayers: 10,
  minimumAuctionHighPotential: 81,
  targetIndianPlayerShare: 0.65,
  exceptionalTeenProdigyChance: 0.0005,
  ultraPotentialChance: 0.0002,
  maximumPotentialRating: 99,
  establishedEntryChance: 0.03,
  indianSquadPlayerChance: 0.16,
  maximumStandardEliteCurrentPerIntake: 1,
  maximumStandardElitePotentialPerIntake: 1,
  standardHighPotentialSharePerIntake: 0.1,
  defensiveBattingProfileChance: 0.02,
  wicketkeeperOpenerShare: 0.2,
  wicketkeeperMiddleOrderShare: 0.5,
  paceBowlingAllRounderChance: 0.18,
  protectedRetirementRating: 81,
  lowRatedUnsoldRetirementRating: 69,
  lowRatedUnsoldRetirementYears: 3,
  midRatedUnsoldRetirementRating: 74,
  midRatedUnsoldRetirementYears: 4,
  establishedUnsoldRetirementRating: 80,
  establishedUnsoldRetirementYears: 3,
  establishedUnsoldRetirementMinimumAge: 34,
  youngProspectRetirementProtectionAge: 23,
  youngProspectRetirementProtectionPotential: 78,
  belowAuctionStandardRetirementSeasons: 2,
  maximumMiniAuctionDiscretionaryRetirements: 22,
  maximumMegaAuctionDiscretionaryRetirements: 28,
  veteranProtectionMinimumRating: 80,
  veteranProtectionAge: 40,
  continuationRetirementScore: 25,
  maximumYoungUnrealizedPotentialLoss: 12,
} as const;

/** Long-run role balance for the 310-player minimum career pool. */
export const REGEN_ROLE_TARGETS = {
  BAT: 80 / 310,
  WK: 30 / 310,
  AR: 67 / 310,
  PACE: 88 / 310,
  SPIN: 45 / 310,
} as const satisfies Record<AuctionRoleGroup, number>;

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
  fours?: number;
  sixes?: number;
  maidens?: number;
  battingPerformanceBonus?: number;
  bowlingPerformanceBonus?: number;
  emergingPoints?: number;
  emergingBattingImpact?: number;
  emergingBowlingImpact?: number;
  matchesCaptained?: number;
  matchesViceCaptained?: number;
  teamMatches?: number;
  mvpRank?: number;
  mvpCandidateCount?: number;
  playerOfMatchAwards?: number;
  playoffPlayerOfMatchAwards?: number;
  wonOrangeCap?: boolean;
  wonPurpleCap?: boolean;
  wonSeasonMvp?: boolean;
  wonEmergingPlayer?: boolean;
  championshipCaptain?: boolean;
  playedInChampionshipFinal?: boolean;
}

export interface CareerReputationAchievements {
  seasonMvpPlayerId?: string | null;
  emergingPlayerId?: string | null;
  orangeCapPlayerId?: string | null;
  purpleCapPlayerId?: string | null;
  championCaptainId?: string | null;
  championFinalPlayerIds?: string[];
  playerOfMatchCounts?: Record<string, number>;
  playoffPlayerOfMatchCounts?: Record<string, number>;
}

export type RetirementReason =
  | "natural"
  | "three-unsold-auctions"
  | "persistent-unsold"
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
  internationalDebutSeason?: number;
  internationalDebutCountry?: string;
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
  reputation?: number;
  captaincy?: number;
  retirementAge: number;
  retirementSeason: number;
  finalRating: number;
  careerStats: Player["careerStats"];
  iplStats: Player["iplStats"];
  iplHistory: Player["iplHistory"];
}

export type InternationalCappingReason =
  | "elite-ability"
  | "season-runs"
  | "season-wickets"
  | "india-selection"
  | "overseas-selection";

export interface InternationalCappingRecord {
  playerId: string;
  name: string;
  country: string;
  season: number;
  role: AuctionRoleGroup;
  reason: InternationalCappingReason;
  selectionScore?: number;
}

export interface CareerLifecycleResult {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  retirements: CareerRetirementRecord[];
  retiredPlayers: Player[];
  newlyCappedPlayers?: InternationalCappingRecord[];
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
      belowAuctionStandardSeasons: existing.belowAuctionStandardSeasons ?? 0,
      lastRetirementEvaluationSeason: existing.lastRetirementEvaluationSeason,
      consecutiveLowUsageSeasons: existing.consecutiveLowUsageSeasons ?? 0,
      initialPotentialBatting: existing.initialPotentialBatting ?? player.potentialBatting,
      initialPotentialBowling: existing.initialPotentialBowling ?? player.potentialBowling,
      battingDevelopmentBank: existing.battingDevelopmentBank ?? 0,
      bowlingDevelopmentBank: existing.bowlingDevelopmentBank ?? 0,
      potentialBattingBank: existing.potentialBattingBank ?? 0,
      potentialBowlingBank: existing.potentialBowlingBank ?? 0,
      captaincyDevelopmentBank: existing.captaincyDevelopmentBank ?? 0,
      reputationDevelopmentBank: existing.reputationDevelopmentBank ?? 0,
      unrealizedPotentialBattingLoss: existing.unrealizedPotentialBattingLoss ?? 0,
      unrealizedPotentialBowlingLoss: existing.unrealizedPotentialBowlingLoss ?? 0,
      consecutivePoorBattingSeasons: existing.consecutivePoorBattingSeasons ?? 0,
      consecutivePoorBowlingSeasons: existing.consecutivePoorBowlingSeasons ?? 0,
      consecutivePoorReputationSeasons: existing.consecutivePoorReputationSeasons ?? 0,
      eliteReputationSeasons: existing.eliteReputationSeasons ?? 0,
      majorReputationAchievements: existing.majorReputationAchievements ?? 0,
      lastSeasonMatches: existing.lastSeasonMatches ?? 0,
      lastSeasonRuns: existing.lastSeasonRuns ?? 0,
      lastSeasonWickets: existing.lastSeasonWickets ?? 0,
      lastSeasonMatchesCaptained: existing.lastSeasonMatchesCaptained ?? 0,
      lastSeasonMatchesViceCaptained: existing.lastSeasonMatchesViceCaptained ?? 0,
      lastSeasonReputationPoints: existing.lastSeasonReputationPoints ?? 0,
      ratingHistory: existing.ratingHistory?.length > 0 ? existing.ratingHistory : [{
        season: baselineSeason,
        batting: player.currentBatting,
        bowling: player.currentBowling,
        potentialBatting: player.potentialBatting,
        potentialBowling: player.potentialBowling,
        captaincy: player.captaincy ?? 50,
        reputation: player.reputation ?? 5,
      }],
    };
  }
  return {
    origin: "database",
    unsoldAuctionStreak: 0,
    belowAuctionStandardSeasons: 0,
    lastRetirementEvaluationSeason: undefined,
    consecutiveLowUsageSeasons: 0,
    initialPotentialBatting: player.potentialBatting,
    initialPotentialBowling: player.potentialBowling,
    battingDevelopmentBank: 0,
    bowlingDevelopmentBank: 0,
    potentialBattingBank: 0,
    potentialBowlingBank: 0,
    captaincyDevelopmentBank: 0,
    reputationDevelopmentBank: 0,
    unrealizedPotentialBattingLoss: 0,
    unrealizedPotentialBowlingLoss: 0,
    consecutivePoorBattingSeasons: 0,
    consecutivePoorBowlingSeasons: 0,
    consecutivePoorReputationSeasons: 0,
    eliteReputationSeasons: 0,
    majorReputationAchievements: 0,
    lastSeasonMatches: 0,
    lastSeasonRuns: 0,
    lastSeasonWickets: 0,
    lastSeasonMatchesCaptained: 0,
    lastSeasonMatchesViceCaptained: 0,
    lastSeasonReputationPoints: 0,
    ratingHistory: [{
      season: baselineSeason,
      batting: player.currentBatting,
      bowling: player.currentBowling,
      potentialBatting: player.potentialBatting,
      potentialBowling: player.potentialBowling,
      captaincy: player.captaincy ?? 50,
      reputation: player.reputation ?? 5,
    }],
  };
}

export function initializeCareerPlayers(
  players: Record<string, Player>,
  baselineSeason: number,
): Record<string, Player> {
  return Object.fromEntries(Object.entries(players).map(([id, player]) => {
    const ability = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
    const startingReputation = player.reputation ?? 5;
    const reputation = Math.max(startingReputation, ability >= 87 ? 9 : 0);
    const newlyAutoCapped = !player.isCapped && ability >= 86;
    const normalizedPlayer = {
      ...player,
      country: player.country ?? (player.nationality === "Indian" ? "India" : "Overseas"),
      reputation,
      isCapped: player.isCapped || ability >= 86,
      internationalDebutSeason: player.internationalDebutSeason
        ?? (newlyAutoCapped ? baselineSeason + 1 : undefined),
      internationalDebutCountry: player.internationalDebutCountry
        ?? (player.isCapped || ability >= 86
          ? (player.country ?? (player.nationality === "Indian" ? "India" : "Overseas"))
          : undefined),
    };
    const careerState = initializePlayerCareerState(normalizedPlayer, baselineSeason);
    const reputationCareerState = reputation > startingReputation
      ? { ...careerState, reputationDevelopmentBank: Math.max(0, careerState.reputationDevelopmentBank) }
      : careerState;
    const cappedCareerState = newlyAutoCapped && reputation < 10
      ? {
          ...reputationCareerState,
          reputationDevelopmentBank: Math.min(99, reputationCareerState.reputationDevelopmentBank + 25),
          lastSeasonReputationPoints: reputationCareerState.lastSeasonReputationPoints + 25,
        }
      : reputationCareerState;
    return [id, enforceBattingPositionEligibility({
      ...normalizedPlayer,
      careerState: cappedCareerState,
    })];
  }));
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
      fours: number(stat.fours),
      sixes: number(stat.sixes),
      maidens: number(stat.maidens),
      battingPerformanceBonus: number(stat.battingPerformanceBonus),
      bowlingPerformanceBonus: number(stat.bowlingPerformanceBonus),
      emergingPoints: number(stat.emergingPoints),
      emergingBattingImpact: number(stat.emergingBattingImpact),
      emergingBowlingImpact: number(stat.emergingBowlingImpact),
      matchesCaptained: number(stat.matchesCaptained),
      matchesViceCaptained: number(stat.matchesViceCaptained),
      teamMatches: number(stat.teamMatches),
    }]];
  }));
}

export interface CaptaincyDevelopmentInput {
  captaincy: number;
  age: number;
  ability: number;
  matches: number;
  teamMatches: number;
  matchesCaptained?: number;
  matchesViceCaptained?: number;
  variation?: number;
}

/**
 * Captaincy is learned primarily through regular high-level cricket. Formal
 * leadership accelerates that learning, but is deliberately not required for
 * a player to develop into a credible future captain.
 */
export function calculateCaptaincyDevelopment(input: CaptaincyDevelopmentInput): number {
  const captaincy = clamp(input.captaincy, 0, 95);
  const matches = Math.max(0, input.matches);
  if (matches <= 0 || captaincy >= 95) return 0;

  const teamMatches = Math.max(matches, input.teamMatches, 1);
  const appearanceShare = clamp(matches / teamMatches, 0, 1);
  const experienceBonus = appearanceShare >= 0.75
    ? 3
    : appearanceShare >= 0.5
      ? 2
      : appearanceShare >= 0.25
        ? 1
        : 0.25;

  // Players above 81 ability receive the stronger leadership-development
  // route requested for established and elite future captaincy candidates.
  let abilityBonus = input.ability >= 90
    ? 3
    : input.ability >= 85
      ? 2.5
      : input.ability >= 82
        ? 1.75
        : input.ability >= 78
          ? 1.25
          : input.ability >= 70
            ? 0.5
            : 0;
  if (captaincy >= 80) abilityBonus *= 0.25;
  else if (captaincy >= 70) abilityBonus *= 0.6;

  const ageBonus = input.age <= 20
    ? 1
    : input.age <= 24
      ? 1.75
      : input.age <= 33
        ? 1.5
        : input.age <= 36
          ? 1
          : 0.5;
  const foundationBonus = captaincy < 60 ? 1 : captaincy < 70 ? 0.5 : 0;

  const captainShare = clamp((input.matchesCaptained ?? 0) / teamMatches, 0, appearanceShare);
  const viceCaptainShare = clamp((input.matchesViceCaptained ?? 0) / teamMatches, 0, appearanceShare);
  const leadershipBonus = captainShare * 1.25 + viceCaptainShare * 0.75;
  const leadershipLimitBonus = captainShare + viceCaptainShare * 0.5;
  const acceleratedCandidateLimitBonus = (
    input.ability >= 90
      ? 1
      : input.ability >= 85
        ? 0.9
        : input.ability >= 82
          ? 0.75
          : 0
  ) + (input.age <= 24 ? 0.75 : input.age <= 27 ? 0.5 : 0);

  const ratingLimit = captaincy < 60
    ? 7
    : captaincy < 70
      ? 6
      : captaincy < 75
        ? 4
        : captaincy < 80
          ? 2.5
          : captaincy < 85
            ? 1
            : captaincy < 90
              ? 0.5
              : 0.2;
  const appearanceLimit = appearanceShare >= 0.75
    ? Number.POSITIVE_INFINITY
    : appearanceShare >= 0.5
      ? 5
      : appearanceShare >= 0.25
        ? 3
        : 1;
  const variation = clamp(input.variation ?? 1, 0.9, 1.1);
  return Math.max(0, Math.min(
    (foundationBonus + experienceBonus + abilityBonus + ageBonus + leadershipBonus) * variation,
    ratingLimit + leadershipLimitBonus + acceleratedCandidateLimitBonus,
    appearanceLimit,
    95 - captaincy,
  ));
}

export interface ReputationDevelopmentInput {
  reputation: number;
  reputationBank: number;
  ability: number;
  matches: number;
  teamMatches: number;
  mvpRank?: number;
  mvpCandidateCount?: number;
  playerOfMatchAwards?: number;
  playoffPlayerOfMatchAwards?: number;
  wonOrangeCap?: boolean;
  wonPurpleCap?: boolean;
  wonSeasonMvp?: boolean;
  wonEmergingPlayer?: boolean;
  championshipCaptain?: boolean;
  playedInChampionshipFinal?: boolean;
  injuryProtectedAbsence?: boolean;
  unsoldAuctionStreak?: number;
  consecutivePoorSeasons?: number;
  eliteReputationSeasons?: number;
  majorReputationAchievements?: number;
}

export interface ReputationDevelopmentResult {
  reputation: number;
  bank: number;
  points: number;
  consecutivePoorSeasons: number;
  eliteReputationSeasons: number;
  majorReputationAchievements: number;
}

/** Reputation uses a slow 100-point ladder with hard achievement milestones. */
export function calculateReputationDevelopment(input: ReputationDevelopmentInput): ReputationDevelopmentResult {
  const startingReputation = Math.round(clamp(input.reputation, 1, 10));
  const existingEliteSeasons = Math.max(0, Math.floor(input.eliteReputationSeasons ?? 0));
  const existingMajorAchievements = Math.max(0, Math.floor(input.majorReputationAchievements ?? 0));
  if (startingReputation >= 10) {
    return {
      reputation: 10,
      bank: Math.max(0, input.reputationBank),
      points: 0,
      consecutivePoorSeasons: 0,
      eliteReputationSeasons: existingEliteSeasons,
      majorReputationAchievements: existingMajorAchievements,
    };
  }

  const matches = Math.max(0, input.matches);
  const candidateCount = Math.max(0, Math.floor(input.mvpCandidateCount ?? 0));
  const mvpRank = Math.max(0, Math.floor(input.mvpRank ?? 0));
  const rankShare = candidateCount > 0 && mvpRank > 0 ? mvpRank / candidateCount : 1;
  const eliteSeason = matches > 0 && (mvpRank > 0 && (mvpRank <= 3 || rankShare <= 0.1));
  const poorSeason = matches >= 8 && (mvpRank <= 0 || rankShare > 0.75);
  const consecutivePoorSeasons = poorSeason ? (input.consecutivePoorSeasons ?? 0) + 1 : 0;
  const eliteReputationSeasons = existingEliteSeasons + (eliteSeason ? 1 : 0);
  const majorAchievementsThisSeason = Number(Boolean(input.wonOrangeCap))
    + Number(Boolean(input.wonPurpleCap))
    + Number(Boolean(input.wonSeasonMvp))
    + Number(Boolean(input.championshipCaptain));
  const majorReputationAchievements = existingMajorAchievements + majorAchievementsThisSeason;

  let positivePoints = matches >= 12 ? 25 : matches >= 8 ? 15 : matches >= 4 ? 5 : 0;
  let negativePoints = matches === 0
    ? (input.injuryProtectedAbsence ? 0 : -40)
    : matches <= 3
      ? (input.injuryProtectedAbsence ? 0 : -10)
      : 0;

  positivePoints += input.ability >= 87
    ? 30
    : input.ability >= 86
      ? 20
      : input.ability >= 82
        ? 12
        : input.ability >= 78
          ? 5
          : 0;
  positivePoints += mvpRank <= 0
    ? 0
    : mvpRank <= 3
      ? 65
      : rankShare <= 0.1
        ? 45
        : rankShare <= 0.25
          ? 25
          : rankShare <= 0.5
            ? 10
            : 0;
  positivePoints += Number(Boolean(input.wonOrangeCap)) * 60;
  positivePoints += Number(Boolean(input.wonPurpleCap)) * 60;
  positivePoints += Math.min(24, Math.max(0, input.playerOfMatchAwards ?? 0) * 8);
  positivePoints += Math.max(0, input.playoffPlayerOfMatchAwards ?? 0) * 15;
  positivePoints += Number(Boolean(input.playedInChampionshipFinal)) * 10;

  if (consecutivePoorSeasons >= 2) negativePoints -= 20;
  const unsoldStreak = Math.max(0, Math.floor(input.unsoldAuctionStreak ?? 0));
  if (unsoldStreak > 0) negativePoints -= unsoldStreak >= 2 ? 30 : 20;

  const positiveMultiplier = startingReputation <= 4
    ? 1.25
    : startingReputation <= 6
      ? 1
      : startingReputation === 7
        ? 0.7
        : startingReputation === 8
          ? 0.45
          : 0.2;
  const positiveLimit = startingReputation <= 4 ? 200 : startingReputation <= 8 ? 100 : 50;
  const negativeMultiplier = startingReputation <= 6 ? 1 : startingReputation <= 8 ? 0.65 : 0.3;
  const points = Math.round(
    Math.min(positiveLimit, positivePoints * positiveMultiplier)
    + negativePoints * negativeMultiplier,
  );

  const milestoneFloor = input.ability >= 87 || input.wonSeasonMvp || input.championshipCaptain
    ? 9
    : input.wonEmergingPlayer
      ? 7
      : 1;
  const milestoneApplied = startingReputation < milestoneFloor;
  let reputation = Math.max(startingReputation, milestoneFloor);
  let bank = (milestoneApplied
    ? Math.max(0, clamp(input.reputationBank, -99, 99))
    : clamp(input.reputationBank, -99, 99)) + points;
  while (bank >= 100 && reputation < 10) {
    const target = reputation + 1;
    // A hard award/ability jump lands on its stated rating for this season;
    // excess positive progress is retained for future seasons, not used to
    // leap straight through the milestone.
    if (milestoneApplied && target > milestoneFloor) {
      bank = 99;
      break;
    }
    const canReachEight = target !== 8 || input.ability >= 82 || eliteSeason;
    const canReachNine = target !== 9
      || input.ability >= 87
      || Boolean(input.wonSeasonMvp)
      || Boolean(input.championshipCaptain)
      || majorAchievementsThisSeason > 0
      || eliteReputationSeasons >= 2;
    const canReachTen = target !== 10
      || majorReputationAchievements >= 2
      || eliteReputationSeasons >= 4;
    if (!canReachEight || !canReachNine || !canReachTen) {
      bank = 99;
      break;
    }
    reputation = target;
    bank -= 100;
  }
  while (bank <= -100 && reputation > 1) {
    reputation -= 1;
    bank += 100;
  }

  if (reputation < milestoneFloor) {
    reputation = milestoneFloor;
    bank = Math.max(0, bank);
  }

  return {
    reputation,
    bank: clamp(bank, -99, 99),
    points,
    consecutivePoorSeasons,
    eliteReputationSeasons,
    majorReputationAchievements,
  };
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

// Season labels are relative to ability. Up to the low-80s, strong raw IPL
// production is legitimate over-performance. From 85 upward the benchmark
// rises progressively, so an elite player's routine output does not keep
// generating elite-development bonuses.
function ratingAdjustedPerformance(performance: number, current: number): number {
  const eliteSteps = Math.max(0, current - 84);
  const expectationPenalty = eliteSteps <= 3
    ? eliteSteps * 0.02
    : 0.06 + (eliteSteps - 3) * 0.04;
  return clamp(performance - Math.min(0.3, expectationPenalty), 0, 1.65);
}

function ratingAdjustedProductionThreshold(threshold: number, current: number): number {
  const multiplier = clamp(1 + (current - 80) * 0.03, 0.8, 1.35);
  return threshold * multiplier;
}

function reachesRatingAdjustedProductionTier(
  skill: "batting" | "bowling",
  production: number,
  battingThreshold: number,
  bowlingThreshold: number,
  current: number,
): boolean {
  const threshold = skill === "batting" ? battingThreshold : bowlingThreshold;
  return production >= ratingAdjustedProductionThreshold(threshold, current);
}

function hasMeaningfulDisciplineSample(
  stats: CareerSeasonPerformance,
  skill: "batting" | "bowling",
): boolean {
  return skill === "batting"
    ? stats.balls >= 60
    : stats.oversBowled >= 12;
}

function youngPoorSeasonChange(
  age: number,
  performance: number,
  meaningfulSample: boolean,
  consecutivePoorSeasons: number,
): number {
  if (!meaningfulSample) return 0;
  const ageWeight = age <= 20 ? 0.7 : age <= 23 ? 0.85 : 1;
  const repeatPenalty = Math.min(0.65, Math.max(0, consecutivePoorSeasons - 1) * 0.22);
  if (performance < 0.42) return -(0.85 + repeatPenalty) * ageWeight;
  if (performance < 0.62) return -(0.45 + repeatPenalty * 0.7) * ageWeight;
  if (performance < 0.78 && consecutivePoorSeasons >= 2) {
    return -(0.18 + repeatPenalty * 0.35) * ageWeight;
  }
  return 0;
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
  const breakoutBonus = reachesRatingAdjustedProductionTier(skill, production, 800, 35, current)
    ? 2.45
    : reachesRatingAdjustedProductionTier(skill, production, 700, 30, current)
      ? 2
      : reachesRatingAdjustedProductionTier(skill, production, 600, 25, current)
        ? 1.55
        : reachesRatingAdjustedProductionTier(skill, production, 500, 20, current)
          ? 1.1
          : reachesRatingAdjustedProductionTier(skill, production, 400, 15, current)
            ? 0.55
            : 0;
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
  const exceptional = performance >= 1.58 || reachesRatingAdjustedProductionTier(skill, production, 750, 32, current);
  const massive = performance >= 1.45 || reachesRatingAdjustedProductionTier(skill, production, 650, 28, current);
  const standout = performance >= 1.25 || reachesRatingAdjustedProductionTier(skill, production, 500, 22, current);
  const strong = performance >= 1.12 || reachesRatingAdjustedProductionTier(skill, production, 400, 16, current);
  const productive = performance >= 0.92 || reachesRatingAdjustedProductionTier(skill, production, 300, 12, current);
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
  const ratingDifficulty = current >= 92
    ? 0.1
    : current >= 89
      ? 0.18
      : current >= 87
        ? 0.3
        : current >= 86
          ? 0.52
          : current >= 83
            ? 0.78
            : 1;
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
  const exceptional = performance >= 1.58 || reachesRatingAdjustedProductionTier(skill, production, 750, 32, current);
  const massive = performance >= 1.45 || reachesRatingAdjustedProductionTier(skill, production, 650, 28, current);
  const standout = performance >= 1.25 || reachesRatingAdjustedProductionTier(skill, production, 500, 22, current);
  const strong = performance >= 1.12 || reachesRatingAdjustedProductionTier(skill, production, 400, 16, current);
  // Elite ratings should require repeated elite production rather than
  // compounding upward after every merely good season. Fractional gains are
  // retained in the development bank, so exceptional seasons still count.
  if (exceptional) return current >= 92 ? 0.3 : current >= 89 ? 0.8 : current >= 87 ? 1.25 : current >= 86 ? 2.05 : 3.05;
  if (massive) return current >= 92 ? 0.1 : current >= 89 ? 0.25 : current >= 87 ? 0.55 : current >= 86 ? 1.55 : 2.35;
  if (standout) return current >= 92 ? 0 : current >= 89 ? 0.08 : current >= 87 ? 0.2 : current >= 86 ? 0.95 : 1.4;
  if (strong) return current >= 87 ? 0 : current >= 86 ? 0.45 : 0.7;
  if (performance < 0.42) return -0.55;
  if (performance < 0.68) return -0.28;
  return 0;
}

// Exceptional late-prime seasons can reveal a little more ceiling than a
// player's pre-season projection. This is deliberately limited to ages 34-35
// and truly elite full seasons, so ordinary veteran form still follows the
// normal decline curve.
function latePrimeResurgence(
  age: number,
  current: number,
  performance: number,
  matches: number,
  production: number,
  skill: "batting" | "bowling",
): number {
  if (age < 34 || age > 35 || matches < 8) return 0;
  const exceptional = performance >= 1.58 || reachesRatingAdjustedProductionTier(skill, production, 750, 32, current);
  const massive = performance >= 1.45 || reachesRatingAdjustedProductionTier(skill, production, 650, 28, current);
  if (exceptional) return age === 34 ? 1.85 : 1.55;
  if (massive) return age === 34 ? 1.05 : 0.8;
  return 0;
}

function dynamicPotentialGain(
  skill: "batting" | "bowling",
  current: number,
  performance: number,
  production: number,
): number {
  const exceptional = performance >= 1.58 || reachesRatingAdjustedProductionTier(skill, production, 750, 32, current);
  const massive = performance >= 1.45 || reachesRatingAdjustedProductionTier(skill, production, 650, 28, current);
  const standout = performance >= 1.3 || reachesRatingAdjustedProductionTier(skill, production, 500, 22, current);
  if (!exceptional && !massive && !standout) return 0;
  if (current >= 92) return exceptional ? 0.08 : massive ? 0.04 : 0;
  if (current >= 89) return exceptional ? 0.22 : massive ? 0.12 : 0.04;
  if (current >= 87) return exceptional ? 0.5 : massive ? 0.3 : 0.12;
  if (current >= 86) return exceptional ? 0.85 : massive ? 0.65 : 0.4;
  return exceptional ? 1.25 : massive ? 1 : 0.7;
}

function unrealizedPotentialCompression(
  age: number,
  current: number,
  potential: number,
  performance: number,
  matches: number,
  meaningfulSample: boolean,
  consecutivePoorSeasons: number,
  injuryProtectedAbsence: boolean,
): number {
  const gap = Math.max(0, potential - current);
  if (age < 30 || gap <= 0) return 0;

  const agePressure = age === 30
    ? 0.05
    : age === 31
      ? 0.1
      : age === 32
        ? 0.3
        : age === 33
          ? 0.45
          : age === 34
            ? 0.6
            : age === 35
              ? 0.75
              : age === 36
                ? 0.9
                : 1.1;
  const performancePressure = meaningfulSample
    ? performance >= 1.45
      ? 0
      : performance >= 1.25
        ? 0.15
        : performance >= 1.12
          ? 0.35
          : performance >= 0.92
            ? 0.6
            : performance >= 0.78
              ? 0.85
              : 1.15 + Math.min(0.6, Math.max(0, consecutivePoorSeasons - 1) * 0.2)
    : injuryProtectedAbsence
      ? 0.3
      : matches === 0
        ? 1
        : 0.8;
  const abilityFactor = current >= 88 ? 0.75 : current >= 83 ? 0.9 : 1.05;
  const gapFactor = clamp(gap / 6, 0.45, 1.25);
  return Math.min(gap, agePressure * performancePressure * abilityFactor * gapFactor);
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
  meaningfulSample: boolean,
  consecutivePoorSeasons: number,
  injuryProtectedAbsence: boolean,
): { potential: number; bank: number; loss: number } {
  let delta = 0;
  let loss = currentLoss;
  const performanceGain = player.age <= 31
    ? dynamicPotentialGain(skill, current, performance, production)
    : 0;
  if (matches >= 8 && performanceGain > 0) {
    delta = performanceGain;
  } else if (matches === 0 && player.age >= 24) {
    const remainingLoss = CAREER_POLICY.maximumYoungUnrealizedPotentialLoss - loss;
    const requested = Math.min(remainingLoss, 0.5);
    delta = -requested;
    loss += requested;
  } else if (meaningfulSample && performance < 0.78) {
    const remainingLoss = CAREER_POLICY.maximumYoungUnrealizedPotentialLoss - loss;
    const repeatPenalty = Math.min(0.9, Math.max(0, consecutivePoorSeasons - 1) * 0.3);
    const requested = performance < 0.42
      ? 1.1 + repeatPenalty
      : performance < 0.62
        ? 0.6 + repeatPenalty * 0.7
        : consecutivePoorSeasons >= 2
          ? 0.25 + repeatPenalty * 0.35
          : 0;
    const appliedLoss = Math.min(remainingLoss, requested);
    delta = -appliedLoss;
    loss += appliedLoss;
  }
  delta -= unrealizedPotentialCompression(
    player.age,
    current,
    potential,
    performance,
    matches,
    meaningfulSample,
    consecutivePoorSeasons,
    injuryProtectedAbsence,
  );
  const maximumPotential = potential > 97 ? CAREER_POLICY.maximumPotentialRating : 97;
  const applied = applyBank(
    potential,
    currentBank,
    delta,
    current,
    maximumPotential,
  );
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
  const battingDevelopmentForm = ratingAdjustedPerformance(battingForm, player.currentBatting);
  const bowlingDevelopmentForm = ratingAdjustedPerformance(bowlingForm, player.currentBowling);
  const meaningfulBattingSample = hasMeaningfulDisciplineSample(stats, "batting");
  const meaningfulBowlingSample = hasMeaningfulDisciplineSample(stats, "bowling");
  const consecutivePoorBattingSeasons = meaningfulBattingSample && battingDevelopmentForm < 0.78
    ? (state.consecutivePoorBattingSeasons ?? 0) + 1
    : 0;
  const consecutivePoorBowlingSeasons = meaningfulBowlingSample && bowlingDevelopmentForm < 0.78
    ? (state.consecutivePoorBowlingSeasons ?? 0) + 1
    : 0;
  const absenceRelief = injuryProtectedAbsence && stats.matches < 3 ? 0.55 : 1;

  const skillDelta = (skill: "batting" | "bowling", current: number, potential: number, performance: number): number => {
    const production = skill === "batting" ? stats.runs : stats.wickets;
    const meaningfulSample = skill === "batting" ? meaningfulBattingSample : meaningfulBowlingSample;
    const consecutivePoorSeasons = skill === "batting"
      ? consecutivePoorBattingSeasons
      : consecutivePoorBowlingSeasons;
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
      const poorSeasonChange = youngPoorSeasonChange(
        player.age,
        performance,
        meaningfulSample,
        consecutivePoorSeasons,
      );
      if (poorSeasonChange < 0) return poorSeasonChange * absenceRelief;
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
    return latePrimeResurgence(player.age, current, performance, stats.matches, production, skill)
      - protectedDecline * exceptionalResistance;
  };

  const battingDelta = skillDelta("batting", player.currentBatting, player.potentialBatting, battingDevelopmentForm);
  const bowlingDelta = skillDelta("bowling", player.currentBowling, player.potentialBowling, bowlingDevelopmentForm);
  const batting = applyBank(player.currentBatting, state.battingDevelopmentBank, battingDelta, 0, 97);
  const bowling = applyBank(player.currentBowling, state.bowlingDevelopmentBank, bowlingDelta, 0, 97);
  const captaincyRating = player.captaincy ?? 50;
  const captaincyRandom = seededRandom(`${seed}:${season}:${player.id}:captaincy-development`);
  const captaincyDelta = calculateCaptaincyDevelopment({
    captaincy: captaincyRating,
    age: player.age,
    ability: Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0),
    matches: stats.matches,
    teamMatches: stats.teamMatches ?? stats.matches,
    matchesCaptained: stats.matchesCaptained,
    matchesViceCaptained: stats.matchesViceCaptained,
    variation: 0.9 + captaincyRandom() * 0.2,
  });
  const captaincy = applyBank(
    captaincyRating,
    state.captaincyDevelopmentBank,
    captaincyDelta,
    0,
    95,
  );
  const reputation = calculateReputationDevelopment({
    reputation: player.reputation ?? 5,
    reputationBank: state.reputationDevelopmentBank,
    ability: Math.max(batting.value, bowling.value),
    matches: stats.matches,
    teamMatches: stats.teamMatches ?? stats.matches,
    mvpRank: stats.mvpRank,
    mvpCandidateCount: stats.mvpCandidateCount,
    playerOfMatchAwards: stats.playerOfMatchAwards,
    playoffPlayerOfMatchAwards: stats.playoffPlayerOfMatchAwards,
    wonOrangeCap: stats.wonOrangeCap,
    wonPurpleCap: stats.wonPurpleCap,
    wonSeasonMvp: stats.wonSeasonMvp,
    wonEmergingPlayer: stats.wonEmergingPlayer,
    championshipCaptain: stats.championshipCaptain,
    playedInChampionshipFinal: stats.playedInChampionshipFinal,
    injuryProtectedAbsence,
    unsoldAuctionStreak: state.unsoldAuctionStreak,
    consecutivePoorSeasons: state.consecutivePoorReputationSeasons,
    eliteReputationSeasons: state.eliteReputationSeasons,
    majorReputationAchievements: state.majorReputationAchievements,
  });

  let potentialBatting: ReturnType<typeof updatePotential>;
  let potentialBowling: ReturnType<typeof updatePotential>;
  if (player.age >= 33) {
    const battingCompression = unrealizedPotentialCompression(player.age, batting.value, player.potentialBatting, battingDevelopmentForm, stats.matches, meaningfulBattingSample, consecutivePoorBattingSeasons, injuryProtectedAbsence);
    const bowlingCompression = unrealizedPotentialCompression(player.age, bowling.value, player.potentialBowling, bowlingDevelopmentForm, stats.matches, meaningfulBowlingSample, consecutivePoorBowlingSeasons, injuryProtectedAbsence);
    const maximumBattingPotential = player.potentialBatting > 97
      ? CAREER_POLICY.maximumPotentialRating
      : 97;
    const maximumBowlingPotential = player.potentialBowling > 97
      ? CAREER_POLICY.maximumPotentialRating
      : 97;
    const battingPotential = applyBank(player.potentialBatting, state.potentialBattingBank, Math.min(0, battingDelta) - battingCompression, batting.value, maximumBattingPotential);
    const bowlingPotential = applyBank(player.potentialBowling, state.potentialBowlingBank, Math.min(0, bowlingDelta) - bowlingCompression, bowling.value, maximumBowlingPotential);
    const battingResurgenceHeadroom = latePrimeResurgence(player.age, player.currentBatting, battingDevelopmentForm, stats.matches, stats.runs, "batting") > 0 ? 1 : 0;
    const bowlingResurgenceHeadroom = latePrimeResurgence(player.age, player.currentBowling, bowlingDevelopmentForm, stats.matches, stats.wickets, "bowling") > 0 ? 1 : 0;
    const battingResurgencePotential = battingResurgenceHeadroom > 0 ? player.potentialBatting + 1 : batting.value;
    const bowlingResurgencePotential = bowlingResurgenceHeadroom > 0 ? player.potentialBowling + 1 : bowling.value;
    potentialBatting = { potential: Math.min(maximumBattingPotential, Math.max(batting.value, battingPotential.value, battingResurgencePotential)), bank: battingPotential.bank, loss: state.unrealizedPotentialBattingLoss };
    potentialBowling = { potential: Math.min(maximumBowlingPotential, Math.max(bowling.value, bowlingPotential.value, bowlingResurgencePotential)), bank: bowlingPotential.bank, loss: state.unrealizedPotentialBowlingLoss };
  } else {
    potentialBatting = updatePotential(player, "batting", batting.value, player.potentialBatting, battingDevelopmentForm, stats.matches, stats.runs, state.potentialBattingBank, state.unrealizedPotentialBattingLoss, meaningfulBattingSample, consecutivePoorBattingSeasons, injuryProtectedAbsence);
    potentialBowling = updatePotential(player, "bowling", bowling.value, player.potentialBowling, bowlingDevelopmentForm, stats.matches, stats.wickets, state.potentialBowlingBank, state.unrealizedPotentialBowlingLoss, meaningfulBowlingSample, consecutivePoorBowlingSeasons, injuryProtectedAbsence);
  }

  const updated: Player = {
    ...player,
    currentBatting: batting.value,
    currentBowling: bowling.value,
    potentialBatting: potentialBatting.potential,
    potentialBowling: potentialBowling.potential,
    captaincy: captaincy.value,
    reputation: reputation.reputation,
    careerState: {
      ...state,
      consecutiveLowUsageSeasons: lowUsageSeasons,
      lastDevelopmentSeason: season,
      battingDevelopmentBank: batting.bank,
      bowlingDevelopmentBank: bowling.bank,
      potentialBattingBank: potentialBatting.bank,
      potentialBowlingBank: potentialBowling.bank,
      captaincyDevelopmentBank: captaincy.bank,
      reputationDevelopmentBank: reputation.bank,
      unrealizedPotentialBattingLoss: potentialBatting.loss,
      unrealizedPotentialBowlingLoss: potentialBowling.loss,
      consecutivePoorBattingSeasons,
      consecutivePoorBowlingSeasons,
      consecutivePoorReputationSeasons: reputation.consecutivePoorSeasons,
      eliteReputationSeasons: reputation.eliteReputationSeasons,
      majorReputationAchievements: reputation.majorReputationAchievements,
      lastSeasonMatches: stats.matches,
      lastSeasonRuns: stats.runs,
      lastSeasonWickets: stats.wickets,
      lastSeasonMatchesCaptained: stats.matchesCaptained ?? 0,
      lastSeasonMatchesViceCaptained: stats.matchesViceCaptained ?? 0,
      lastSeasonReputationPoints: reputation.points,
      ratingHistory: [
        ...state.ratingHistory.filter((entry) => entry.season !== season),
        {
          season,
          batting: batting.value,
          bowling: bowling.value,
          potentialBatting: potentialBatting.potential,
          potentialBowling: potentialBowling.potential,
          captaincy: captaincy.value,
          reputation: reputation.reputation,
        },
      ].sort((left, right) => left.season - right.season).slice(-4),
    },
  };
  updated.potential = potentialLabel(updated);
  return enforceBattingPositionEligibility(updated);
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

const INTERNATIONAL_ROLE_TARGETS: Record<AuctionRoleGroup, number> = {
  BAT: 0.28,
  WK: 0.12,
  AR: 0.22,
  PACE: 0.23,
  SPIN: 0.15,
};

const MAJOR_OVERSEAS_COUNTRIES = new Set([
  "Australia",
  "England",
  "South Africa",
  "West Indies",
  "New Zealand",
  "Sri Lanka",
  "Afghanistan",
]);

interface InternationalSelectionCandidate {
  player: Player;
  stats: CareerSeasonPerformance;
  role: AuctionRoleGroup;
  ability: number;
  impactScore: number;
  selectionScore: number;
  awardExemption: boolean;
}

function internationalAgeReadiness(age: number): number {
  if (age <= 20) return 55;
  if (age <= 25) return 100;
  if (age <= 30) return 85;
  if (age <= 33) return 70;
  return 45;
}

function internationalImpactScore(stats: CareerSeasonPerformance): number {
  const rank = Math.max(0, Math.floor(stats.mvpRank ?? 0));
  const count = Math.max(0, Math.floor(stats.mvpCandidateCount ?? 0));
  if (rank <= 0 || count <= 0) return 0;
  if (count === 1) return 100;
  return clamp((1 - (rank - 1) / (count - 1)) * 100, 0, 100);
}

function internationalRoleNeedBonus(players: Player[], country: string, role: AuctionRoleGroup): number {
  const capped = players.filter((player) => player.isCapped && player.country === country);
  const roleCount = capped.filter((player) => getAuctionRoleGroup(player) === role).length;
  const actualShare = capped.length > 0 ? roleCount / capped.length : 0;
  return clamp((INTERNATIONAL_ROLE_TARGETS[role] - actualShare) * 16, 0, 4);
}

function capInternationalPlayer(
  player: Player,
  completedSeason: number,
): Player {
  const state = initializePlayerCareerState(player, completedSeason - 1);
  const reputation = Math.round(clamp(player.reputation ?? 5, 1, 10));
  return {
    ...player,
    isCapped: true,
    internationalDebutSeason: player.internationalDebutSeason ?? completedSeason,
    internationalDebutCountry: player.internationalDebutCountry ?? player.country
      ?? (player.nationality === "Indian" ? "India" : "Overseas"),
    careerState: {
      ...state,
      // A debut improves reputation progress without imposing a reputation floor.
      reputationDevelopmentBank: reputation >= 10
        ? state.reputationDevelopmentBank
        : Math.min(99, state.reputationDevelopmentBank + 25),
      lastSeasonReputationPoints: state.lastSeasonReputationPoints + (reputation >= 10 ? 0 : 25),
    },
  };
}

/**
 * Applies permanent international status at the post-season career break.
 * Automatic ability/performance selections are intentionally resolved before
 * peer filters and country limits.
 */
export function applyInternationalCappingAfterSeason(input: {
  players: Record<string, Player>;
  performance: Record<string, CareerSeasonPerformance>;
  completedSeason: number;
  seed: string;
}): { players: Record<string, Player>; selections: InternationalCappingRecord[] } {
  const players = { ...input.players };
  const selections: InternationalCappingRecord[] = [];

  const addSelection = (
    player: Player,
    reason: InternationalCappingReason,
    selectionScore?: number,
  ) => {
    if (players[player.id]?.isCapped) return;
    const cappedPlayer = capInternationalPlayer(players[player.id], input.completedSeason);
    players[player.id] = cappedPlayer;
    selections.push({
      playerId: player.id,
      name: player.name,
      country: cappedPlayer.internationalDebutCountry ?? cappedPlayer.country ?? "Unknown",
      season: input.completedSeason,
      role: getAuctionRoleGroup(player),
      reason,
      selectionScore,
    });
  };

  Object.values(players).forEach((player) => {
    if (player.isCapped) return;
    const ability = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
    const stats = input.performance[player.id];
    if (ability >= 86) {
      addSelection(player, "elite-ability");
    } else if ((stats?.runs ?? 0) >= 400) {
      addSelection(player, "season-runs");
    } else if ((stats?.wickets ?? 0) >= 21) {
      addSelection(player, "season-wickets");
    }
  });

  const currentPlayers = Object.values(players);
  const candidates = currentPlayers.flatMap((player): InternationalSelectionCandidate[] => {
    if (player.isCapped) return [];
    const ability = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
    const stats = input.performance[player.id];
    if (!stats || ability < 78 || ability > 85) return [];
    if (!(stats.matches >= 5 || (ability >= 85 && stats.matches >= 2))) return [];
    const role = getAuctionRoleGroup(player);
    const impactScore = internationalImpactScore(stats);
    const variation = seededRandom(
      `${input.seed}:${input.completedSeason}:${player.id}:international-selection`,
    )() * 6 - 3;
    const awardBonus = Number(Boolean(stats.wonSeasonMvp)) * 5
      + Number(Boolean(stats.wonOrangeCap)) * 4
      + Number(Boolean(stats.wonPurpleCap)) * 4
      + Number(Boolean(stats.wonEmergingPlayer)) * 3
      + Number((stats.playoffPlayerOfMatchAwards ?? 0) > 0) * 2;
    const selectionScore = ability * 0.6
      + impactScore * 0.25
      + clamp(player.reputation ?? 5, 1, 10)
      + internationalAgeReadiness(player.age) * 0.05
      + awardBonus
      + internationalRoleNeedBonus(currentPlayers, player.country ?? "Overseas", role)
      + variation;
    return [{
      player,
      stats,
      role,
      ability,
      impactScore,
      selectionScore: Math.round(selectionScore * 10) / 10,
      awardExemption: Boolean(
        stats.wonSeasonMvp
        || stats.wonEmergingPlayer
        || stats.wonOrangeCap
        || stats.wonPurpleCap
      ),
    }];
  });

  const indianCandidates = candidates.filter((candidate) => candidate.player.nationality === "Indian");
  (["BAT", "WK", "AR", "PACE", "SPIN"] as AuctionRoleGroup[]).forEach((role) => {
    const peers = indianCandidates.filter((candidate) => candidate.role === role);
    if (peers.length === 0) return;
    const abilityOrder = [...peers].sort((left, right) =>
      right.ability - left.ability || right.selectionScore - left.selectionScore || left.player.id.localeCompare(right.player.id));
    const impactOrder = [...peers].sort((left, right) =>
      right.impactScore - left.impactScore || right.selectionScore - left.selectionScore || left.player.id.localeCompare(right.player.id));
    const abilityQualifiers = new Set(
      abilityOrder.slice(0, Math.max(1, Math.ceil(peers.length * 0.35))).map((candidate) => candidate.player.id),
    );
    const impactQualifiers = new Set(
      impactOrder.slice(0, Math.max(1, Math.ceil(peers.length * 0.4))).map((candidate) => candidate.player.id),
    );
    const strongestAbility = abilityOrder[0].ability;
    peers
      .filter((candidate) => candidate.selectionScore >= 80)
      .filter((candidate) => abilityQualifiers.has(candidate.player.id))
      .filter((candidate) => candidate.ability >= strongestAbility - 3)
      .filter((candidate) => candidate.awardExemption || impactQualifiers.has(candidate.player.id))
      .sort((left, right) => right.selectionScore - left.selectionScore || left.player.id.localeCompare(right.player.id))
      .forEach((candidate) => addSelection(candidate.player, "india-selection", candidate.selectionScore));
  });

  const overseasCandidates = candidates.filter((candidate) => candidate.player.nationality === "Overseas");
  const countries = Array.from(new Set(overseasCandidates.map((candidate) => candidate.player.country ?? "Overseas")));
  countries.forEach((country) => {
    const majorCountry = MAJOR_OVERSEAS_COUNTRIES.has(country);
    const threshold = majorCountry ? 72 : 69;
    const limit = majorCountry ? 4 : 1;
    overseasCandidates
      .filter((candidate) => (candidate.player.country ?? "Overseas") === country)
      .filter((candidate) => candidate.selectionScore >= threshold)
      .sort((left, right) => right.selectionScore - left.selectionScore || left.player.id.localeCompare(right.player.id))
      .slice(0, limit)
      .forEach((candidate) => addSelection(candidate.player, "overseas-selection", candidate.selectionScore));
  });

  return { players, selections };
}

export function processPostSeasonCareer(input: {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  performance: Record<string, CareerSeasonPerformance>;
  completedSeason: number;
  seed: string;
  injuredPlayerIds?: Set<string>;
  reputationAchievements?: CareerReputationAchievements;
}): CareerLifecycleResult {
  const rankedMvp = rankMvpCandidates(Object.entries(input.performance).map(([id, stats]) => ({
    id,
    name: stats.name ?? input.players[id]?.name ?? id,
    teamId: stats.teamId ?? input.players[id]?.currentTeamId ?? "",
    runs: stats.runs,
    balls: stats.balls,
    wickets: stats.wickets,
    runsConceded: stats.runsConceded,
    oversBowled: stats.oversBowled,
    matches: stats.matches,
    dotBalls: stats.dotBalls,
    catches: stats.catches,
    stumpings: stats.stumpings,
    runOuts: stats.runOuts,
    fours: stats.fours,
    sixes: stats.sixes,
    maidens: stats.maidens,
    battingPerformanceBonus: stats.battingPerformanceBonus,
    bowlingPerformanceBonus: stats.bowlingPerformanceBonus,
  })));
  const mvpRankByPlayerId = new Map(rankedMvp.map((candidate, index) => [candidate.id, index + 1]));
  const achievements = input.reputationAchievements ?? {};
  const championFinalPlayerIds = new Set(achievements.championFinalPlayerIds ?? []);
  const teamMatches = Object.values(input.performance).reduce<Record<string, number>>((totals, stats) => {
    const teamId = stats.teamId;
    if (teamId) totals[teamId] = Math.max(totals[teamId] ?? 0, stats.matches);
    return totals;
  }, {});
  const enrichedPerformance = Object.fromEntries(Object.entries(input.players).map(([id, player]) => [id,
    input.performance[id]
      ? {
          ...input.performance[id],
          teamMatches: teamMatches[input.performance[id].teamId ?? player.currentTeamId ?? ""]
            ?? input.performance[id].matches,
          mvpRank: mvpRankByPlayerId.get(id),
          mvpCandidateCount: rankedMvp.length,
          playerOfMatchAwards: achievements.playerOfMatchCounts?.[id] ?? 0,
          playoffPlayerOfMatchAwards: achievements.playoffPlayerOfMatchCounts?.[id] ?? 0,
          wonOrangeCap: achievements.orangeCapPlayerId === id,
          wonPurpleCap: achievements.purpleCapPlayerId === id,
          wonSeasonMvp: (achievements.seasonMvpPlayerId ?? rankedMvp[0]?.id) === id,
          wonEmergingPlayer: achievements.emergingPlayerId === id,
          championshipCaptain: achievements.championCaptainId === id,
          playedInChampionshipFinal: championFinalPlayerIds.has(id),
        }
      : { matches: 0, runs: 0, balls: 0, wickets: 0, runsConceded: 0, oversBowled: 0, teamMatches: 0 },
  ]));
  const developed = Object.fromEntries(Object.entries(input.players).map(([id, player]) => [id,
    developPlayerAfterSeason(
      player,
      enrichedPerformance[id],
      input.completedSeason,
      input.seed,
      input.injuredPlayerIds?.has(id) ?? false,
    ),
  ]));
  const capping = applyInternationalCappingAfterSeason({
    players: developed,
    performance: enrichedPerformance,
    completedSeason: input.completedSeason,
    seed: input.seed,
  });
  return {
    players: capping.players,
    teams: input.teams,
    retirements: [],
    retiredPlayers: [],
    newlyCappedPlayers: capping.selections,
  };
}

function isYoungDevelopmentPoolPlayer(player: Player): boolean {
  return player.age <= CAREER_POLICY.youngDevelopmentPoolMaxAge
    && getRawAuctionPotential(player) >= CAREER_POLICY.auctionEligibilityRating;
}

function requiredUnsoldAuctionsForRetirement(player: Player, rating: number): number | null {
  let required: number | null = null;
  if (rating <= CAREER_POLICY.lowRatedUnsoldRetirementRating) {
    required = CAREER_POLICY.lowRatedUnsoldRetirementYears;
  } else if (rating <= CAREER_POLICY.midRatedUnsoldRetirementRating) {
    required = CAREER_POLICY.midRatedUnsoldRetirementYears;
  } else if (
    rating <= CAREER_POLICY.establishedUnsoldRetirementRating
    && player.age >= CAREER_POLICY.establishedUnsoldRetirementMinimumAge
  ) {
    required = CAREER_POLICY.establishedUnsoldRetirementYears;
  }
  if (
    required !== null
    && player.age <= CAREER_POLICY.youngProspectRetirementProtectionAge
    && getRawAuctionPotential(player) >= CAREER_POLICY.youngProspectRetirementProtectionPotential
  ) {
    required += 1;
  }
  return required;
}

function discretionaryRetirementPriority(player: Player, reason: RetirementReason): number {
  const rating = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
  const state = initializePlayerCareerState(player, player.age - 1);
  const reasonPriority = reason === "below-auction-standard" ? 80 : 60;
  return reasonPriority
    + state.belowAuctionStandardSeasons * 12
    + state.unsoldAuctionStreak * 10
    + Math.max(0, player.age - 30) * 2
    + Math.max(0, 75 - rating) * 3
    + Math.max(0, 5 - (player.reputation ?? 5)) * 2;
}

export function processPostAuctionCareer(input: {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  auctionedPlayerIds: string[];
  season: number;
  auctionType?: AuctionType;
  priorRetirementsThisSeason?: number;
}): CareerLifecycleResult {
  const auctioned = new Set(input.auctionedPlayerIds);
  const updated = Object.fromEntries(Object.entries(input.players).map(([id, player]) => {
    const state = initializePlayerCareerState(player, input.season - 1);
    if (state.lastRetirementEvaluationSeason === input.season) return [id, player];
    const unsoldAuctionStreak = player.currentTeamId
      ? 0
      : auctioned.has(id)
        ? state.unsoldAuctionStreak + 1
        : state.unsoldAuctionStreak;
    const belowAuctionStandard = !player.currentTeamId
      && getRawAuctionRating(player) < CAREER_POLICY.auctionEligibilityRating
      && !isYoungDevelopmentPoolPlayer(player);
    const belowAuctionStandardSeasons = belowAuctionStandard
      ? state.belowAuctionStandardSeasons + 1
      : 0;
    return [id, {
      ...player,
      careerState: {
        ...state,
        unsoldAuctionStreak,
        belowAuctionStandardSeasons,
        lastRetirementEvaluationSeason: input.season,
      },
    }];
  }));
  const mandatory: Array<{ player: Player; record: CareerRetirementRecord }> = [];
  const discretionary: Array<{ player: Player; record: CareerRetirementRecord; priority: number }> = [];
  Object.values(updated).forEach((player) => {
    const rating = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
    if (
      player.age >= CAREER_POLICY.veteranProtectionAge
      && rating < CAREER_POLICY.veteranProtectionMinimumRating
      && !hasOpeningSeasonDhoniRetirementGrace(player)
    ) {
      mandatory.push({ player, record: retirementRecord(player, input.season, player.age, "natural") });
      return;
    }
    if (player.currentTeamId) return;
    const streak = player.careerState?.unsoldAuctionStreak ?? 0;
    const belowStandardSeasons = player.careerState?.belowAuctionStandardSeasons ?? 0;
    if (belowStandardSeasons >= CAREER_POLICY.belowAuctionStandardRetirementSeasons) {
      const record = retirementRecord(player, input.season, player.age, "below-auction-standard");
      discretionary.push({ player, record, priority: discretionaryRetirementPriority(player, record.reason) });
      return;
    }
    const requiredUnsoldAuctions = requiredUnsoldAuctionsForRetirement(player, rating);
    if (requiredUnsoldAuctions !== null && streak >= requiredUnsoldAuctions) {
      const record = retirementRecord(player, input.season, player.age, "persistent-unsold");
      discretionary.push({ player, record, priority: discretionaryRetirementPriority(player, record.reason) });
    }
  });
  const auctionType = input.auctionType ?? getAuctionTypeForSeason(input.season);
  const discretionaryLimit = auctionType === "mega"
    ? CAREER_POLICY.maximumMegaAuctionDiscretionaryRetirements
    : CAREER_POLICY.maximumMiniAuctionDiscretionaryRetirements;
  const availableDiscretionaryPlaces = Math.max(
    0,
    discretionaryLimit - mandatory.length - Math.max(0, input.priorRetirementsThisSeason ?? 0),
  );
  const selectedDiscretionary = discretionary
    .sort((left, right) => right.priority - left.priority || left.player.id.localeCompare(right.player.id))
    .slice(0, availableDiscretionaryPlaces)
    .map(({ player, record }) => ({ player, record }));
  const retiring = [...mandatory, ...selectedDiscretionary];
  return removePlayers(updated, input.teams, retiring);
}

const OVERSEAS_COUNTRIES = [
  ["Australia", 28], ["England", 29], ["South Africa", 29], ["West Indies", 19],
  ["New Zealand", 16], ["Sri Lanka", 10], ["Afghanistan", 8], ["Bangladesh", 2],
  ["Zimbabwe", 2], ["Ireland", 1],
] as const;

const OVERSEAS_ELITE_TALENT_MULTIPLIERS: Record<string, number> = {
  Australia: 1.2,
  England: 1.15,
  "South Africa": 1.15,
  "West Indies": 0.85,
  "New Zealand": 0.8,
  "Sri Lanka": 0.55,
  Afghanistan: 0.55,
  Bangladesh: 0.25,
  Zimbabwe: 0.12,
  Ireland: 0.1,
  Associate: 0.03,
};

function weightedChoice<T>(entries: ReadonlyArray<readonly [T, number]>, random: () => number): T {
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  let roll = random() * Math.max(1, total);
  for (const [value, weight] of entries) {
    roll -= Math.max(0, weight);
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

export function getRegenIndianProbability(input: {
  currentIndianShare: number;
  currentAbility: number;
  potential: number;
}): number {
  // These are conditional talent-tier probabilities and deliberately do not
  // receive pool-balance correction. Elite arrivals remain predominantly
  // overseas even while the complete intake trends Indian.
  if (input.currentAbility >= 90) return 0.1;
  if (input.currentAbility >= 87) return 0.15;
  if (input.currentAbility >= 83) return 0.3;
  if (input.currentAbility >= 80) return 0.45;

  const poolCorrection = (CAREER_POLICY.targetIndianPlayerShare - input.currentIndianShare) * 2.5;
  const potentialBonus = input.potential >= 94
    ? 0.12
    : input.potential >= 89
      ? 0.08
      : input.potential >= 84
        ? 0.03
        : 0;
  return clamp(0.68 + poolCorrection + potentialBonus, 0.35, 0.92);
}

export function getOverseasCountryTalentMultiplier(country: string, currentAbility: number): number {
  if (currentAbility < 80) return 1;
  const eliteMultiplier = OVERSEAS_ELITE_TALENT_MULTIPLIERS[country] ?? OVERSEAS_ELITE_TALENT_MULTIPLIERS.Associate;
  const strength = currentAbility >= 87 ? 1 : currentAbility >= 83 ? 0.65 : 0.35;
  return 1 + (eliteMultiplier - 1) * strength;
}

function chooseOverseasCountry(
  players: Record<string, Player>,
  currentAbility: number,
  random: () => number,
): string {
  // Associate nations are a near-zero combined outcome: about one player per 20-40 seasons.
  const associateChance = currentAbility >= 90
    ? 0.0002
    : currentAbility >= 87
      ? 0.0008
      : currentAbility >= 83
        ? 0.002
        : 0.006;
  if (random() < associateChance) return "Associate";
  const overseas = Object.values(players).filter((player) => player.nationality === "Overseas");
  const totalWeight = OVERSEAS_COUNTRIES.reduce((sum, [, weight]) => sum + weight, 0);
  const weightedDeficits = OVERSEAS_COUNTRIES.map(([country, weight]) => {
    const actual = overseas.filter((player) => player.country === country).length;
    const target = Math.max(1, overseas.length * weight / totalWeight);
    const rawCorrection = clamp(target / Math.max(0.75, actual), 0.45, 2.2);
    const deficitStrength = currentAbility >= 83 ? 0.25 : 1;
    const deficitCorrection = 1 + (rawCorrection - 1) * deficitStrength;
    return [
      country,
      weight * deficitCorrection * getOverseasCountryTalentMultiplier(country, currentAbility),
    ] as const;
  });
  return weightedChoice(weightedDeficits, random);
}

function chooseRole(players: Record<string, Player>, random: () => number): AuctionRoleGroup {
  const targets = REGEN_ROLE_TARGETS;
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

interface RegenTalentBand {
  weight: number;
  strongWeight: number;
  current: readonly [number, number];
  potential: readonly [number, number];
  minimumGap: number;
  maximumGap: number;
}

/**
 * Talent groups are deliberately explicit so the published ratios, CA/PA
 * bands and development headroom cannot drift apart in separate code paths.
 */
export const REGEN_TALENT_DISTRIBUTION = {
  prospect: {
    raw: {
      weight: 0.35,
      strongWeight: 0,
      current: [62, 69],
      potential: [70, 78],
      minimumGap: 6,
      maximumGap: 16,
    },
    good: {
      weight: 0.45,
      strongWeight: 0,
      current: [68, 75],
      potential: [78, 84],
      minimumGap: 5,
      maximumGap: 14,
    },
    great: {
      weight: 0.18,
      strongWeight: 0.85,
      current: [73, 79],
      potential: [84, 89],
      minimumGap: 6,
      maximumGap: 16,
    },
    elite: {
      weight: 0.018,
      strongWeight: 0.14,
      current: [77, 83],
      potential: [89, 94],
      minimumGap: 7,
      maximumGap: 17,
    },
    generational: {
      weight: 0.002,
      strongWeight: 0.01,
      current: [80, 85],
      potential: [94, 97],
      minimumGap: 9,
      maximumGap: 17,
    },
  },
  established: {
    good: {
      weight: 0.6,
      strongWeight: 0,
      current: [77, 81],
      potential: [79, 84],
      minimumGap: 1,
      maximumGap: 4,
    },
    great: {
      weight: 0.28,
      strongWeight: 0.55,
      current: [82, 86],
      potential: [84, 89],
      minimumGap: 1,
      maximumGap: 4,
    },
    elite: {
      weight: 0.1,
      strongWeight: 0.33,
      current: [87, 90],
      potential: [89, 93],
      minimumGap: 1,
      maximumGap: 3,
    },
    magnificent: {
      weight: 0.02,
      strongWeight: 0.12,
      current: [89, 91],
      potential: [91, 93],
      minimumGap: 1,
      maximumGap: 3,
    },
  },
} as const satisfies {
  prospect: Record<ProspectCategory, RegenTalentBand>;
  established: Record<MatureCategory, RegenTalentBand>;
};

const PROSPECT_CATEGORIES: ProspectCategory[] = ["raw", "good", "great", "elite", "generational"];
const MATURE_CATEGORIES: MatureCategory[] = ["good", "great", "elite", "magnificent"];

function integerBetween(random: () => number, minimum: number, maximum: number): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function ratingsFromTalentBand(
  band: RegenTalentBand,
  random: () => number,
): { current: number; potential: number } {
  const current = integerBetween(random, band.current[0], band.current[1]);
  const potentialMinimum = Math.min(
    band.potential[1],
    Math.max(band.potential[0], current + band.minimumGap),
  );
  const potentialMaximum = Math.max(
    potentialMinimum,
    Math.min(band.potential[1], current + band.maximumGap),
  );
  return {
    current,
    potential: integerBetween(random, potentialMinimum, potentialMaximum),
  };
}

function chooseProspectCategory(forceStrong: boolean, random: () => number): ProspectCategory {
  return weightedChoice(PROSPECT_CATEGORIES.map((category) => [
    category,
    forceStrong
      ? REGEN_TALENT_DISTRIBUTION.prospect[category].strongWeight
      : REGEN_TALENT_DISTRIBUTION.prospect[category].weight,
  ] as const), random);
}

function chooseMatureCategory(forceStrong: boolean, random: () => number): MatureCategory {
  return weightedChoice(MATURE_CATEGORIES.map((category) => [
    category,
    forceStrong
      ? REGEN_TALENT_DISTRIBUTION.established[category].strongWeight
      : REGEN_TALENT_DISTRIBUTION.established[category].weight,
  ] as const), random);
}

function youngRatings(category: ProspectCategory, random: () => number): { current: number; potential: number } {
  return ratingsFromTalentBand(REGEN_TALENT_DISTRIBUTION.prospect[category], random);
}

function matureRatings(category: MatureCategory, random: () => number): { current: number; potential: number } {
  return ratingsFromTalentBand(REGEN_TALENT_DISTRIBUTION.established[category], random);
}

function normalizeGeneratedTalent(
  age: number,
  mature: boolean,
  ratings: { current: number; potential: number },
  random: () => number,
): { current: number; potential: number } {
  if (ratings.current >= CAREER_POLICY.minimumGeneratedCurrentRating) return ratings;

  // A very small number of teenage long-term projects may enter below the
  // normal intake floor, but only with genuinely elite potential.
  const isHighPotentialProject = !mature
    && age <= CAREER_POLICY.highPotentialProjectMaxAge
    && random() < 0.18;
  if (isHighPotentialProject) {
    return {
      current: ratings.current,
      potential: Math.max(
        ratings.potential,
        integerBetween(random, CAREER_POLICY.highPotentialProjectMinimumPotential, 94),
      ),
    };
  }

  return {
    current: CAREER_POLICY.minimumGeneratedCurrentRating,
    // Preserve the raw-prospect development gap when lifting a player onto the
    // auctionable CA floor instead of flattening them into a near-peak player.
    potential: Math.max(CAREER_POLICY.minimumGeneratedCurrentRating + 6, ratings.potential),
  };
}

function generatedSkills(
  role: AuctionRoleGroup,
  current: number,
  potential: number,
  random: () => number,
  maximumPotential = 97,
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
  const highPotential = Math.min(
    maximumPotential,
    Math.round(potential + (potentialGap >= 7 ? potentialGap * 0.2 : potentialGap * 0.4)),
  );
  const lowPotential = Math.max(lowCurrent, highPotential - potentialGap);
  return random() < 0.5
    ? { currentBatting: highCurrent, currentBowling: lowCurrent, potentialBatting: highPotential, potentialBowling: lowPotential }
    : { currentBatting: lowCurrent, currentBowling: highCurrent, potentialBatting: lowPotential, potentialBowling: highPotential };
}

function addIndianProspectPotential(
  skills: Pick<Player, "currentBatting" | "currentBowling" | "potentialBatting" | "potentialBowling">,
  role: AuctionRoleGroup,
  random: () => number,
): typeof skills {
  const roll = random();
  const minimumPotential = roll < 0.025
    ? integerBetween(random, 94, 97)
    : roll < 0.14
      ? integerBetween(random, 89, 94)
      : undefined;
  if (minimumPotential === undefined) return skills;
  if (role === "BAT" || role === "WK") {
    return { ...skills, potentialBatting: Math.max(skills.potentialBatting, minimumPotential) };
  }
  if (role === "PACE" || role === "SPIN") {
    return { ...skills, potentialBowling: Math.max(skills.potentialBowling, minimumPotential) };
  }
  return skills.potentialBatting >= skills.potentialBowling
    ? { ...skills, potentialBatting: Math.max(skills.potentialBatting, minimumPotential) }
    : { ...skills, potentialBowling: Math.max(skills.potentialBowling, minimumPotential) };
}

function constrainGeneratedPotentialForAge(
  skills: Pick<Player, "currentBatting" | "currentBowling" | "potentialBatting" | "potentialBowling">,
  age: number,
): typeof skills {
  const maximumGap = age >= 31 ? 3 : age >= 29 ? 6 : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(maximumGap)) return skills;
  return {
    ...skills,
    potentialBatting: Math.max(
      skills.currentBatting,
      Math.min(skills.potentialBatting, skills.currentBatting + maximumGap),
    ),
    potentialBowling: Math.max(
      skills.currentBowling,
      Math.min(skills.potentialBowling, skills.currentBowling + maximumGap),
    ),
  };
}

function generatedBattingProfile(
  role: AuctionRoleGroup,
  currentBatting: number,
  currentBowling: number,
  random: () => number,
  defensiveRandom: () => number,
): Pick<Player,
  | "battingAggression"
  | "isOpener"
  | "onlyOpensOrBenched"
  | "isFinisher"
  | "isCoreBatter"
  | "hasBattedAt3"
  | "hasBattedAt4"
  | "hasBattedAt5"
  | "hasBattedAt6"
  | "hasBattedAt7"
  | "isPartTimeWk"
> {
  let isOpener = false;
  let isFinisher = false;
  let hasBattedAt3 = false;
  let hasBattedAt4 = false;
  let hasBattedAt5 = false;
  let hasBattedAt6 = false;
  let hasBattedAt7 = false;
  let battingAggression: number;
  const archetypeRoll = random();

  if (role === "BAT") {
    if (archetypeRoll < 0.3) {
      isOpener = true;
      hasBattedAt3 = random() < 0.55;
      battingAggression = integerBetween(random, 55, 92);
    } else if (archetypeRoll < 0.55) {
      hasBattedAt3 = true;
      hasBattedAt4 = true;
      battingAggression = integerBetween(random, 50, 78);
    } else if (archetypeRoll < 0.83) {
      hasBattedAt4 = true;
      hasBattedAt5 = true;
      hasBattedAt6 = random() < 0.25;
      battingAggression = integerBetween(random, 52, 84);
    } else {
      isFinisher = true;
      hasBattedAt5 = true;
      hasBattedAt6 = true;
      hasBattedAt7 = true;
      battingAggression = integerBetween(random, 76, 95);
    }
  } else if (role === "WK") {
    if (archetypeRoll < CAREER_POLICY.wicketkeeperOpenerShare) {
      isOpener = true;
      hasBattedAt3 = random() < 0.45;
      battingAggression = integerBetween(random, 55, 90);
    } else if (
      archetypeRoll
      < CAREER_POLICY.wicketkeeperOpenerShare + CAREER_POLICY.wicketkeeperMiddleOrderShare
    ) {
      hasBattedAt3 = true;
      hasBattedAt4 = true;
      hasBattedAt5 = random() < 0.45;
      battingAggression = integerBetween(random, 50, 82);
    } else {
      isFinisher = true;
      hasBattedAt5 = true;
      hasBattedAt6 = true;
      hasBattedAt7 = true;
      battingAggression = integerBetween(random, 72, 94);
    }
  } else if (role === "AR") {
    if (archetypeRoll < 0.12 && currentBatting >= currentBowling) {
      isOpener = true;
      hasBattedAt3 = true;
      hasBattedAt4 = random() < 0.35;
      battingAggression = integerBetween(random, 56, 88);
    } else if (archetypeRoll < 0.48) {
      hasBattedAt4 = true;
      hasBattedAt5 = true;
      hasBattedAt6 = true;
      battingAggression = integerBetween(random, 52, 84);
    } else {
      isFinisher = true;
      hasBattedAt5 = true;
      hasBattedAt6 = true;
      hasBattedAt7 = true;
      battingAggression = integerBetween(random, 70, 94);
    }
  } else {
    hasBattedAt7 = currentBatting >= 50;
    hasBattedAt6 = currentBatting >= 54 && random() < 0.35;
    battingAggression = integerBetween(random, 50, 70);
  }

  // Defensive batting identities remain possible, but are deliberately rare
  // and never assigned to a player generated specifically as a finisher.
  if (!isFinisher && defensiveRandom() < CAREER_POLICY.defensiveBattingProfileChance) {
    battingAggression = integerBetween(defensiveRandom, 40, 49);
  }

  const middleOrderCapable = hasBattedAt3 || hasBattedAt4 || hasBattedAt5;
  return {
    battingAggression,
    isOpener,
    onlyOpensOrBenched: isOpener && !hasBattedAt3 && random() < 0.14,
    isFinisher,
    isCoreBatter: currentBatting >= 76 && middleOrderCapable && !isFinisher,
    hasBattedAt3,
    hasBattedAt4,
    hasBattedAt5,
    hasBattedAt6,
    hasBattedAt7,
    isPartTimeWk: role === "BAT" ? random() < 0.06 : role === "AR" ? random() < 0.035 : false,
  };
}

function generatedCaptaincy(age: number, rating: number, reputation: number, random: () => number): number {
  const ageMaturity = clamp((age - 20) * 1.5, 0, 18);
  const abilityStanding = clamp((rating - 70) * 0.8, 0, 16);
  const variation = integerBetween(random, -8, 8);
  return Math.round(clamp(30 + ageMaturity + abilityStanding + reputation * 1.5 + variation, 25, 90));
}

function createGeneratedPlayer(input: {
  index: number;
  season: number;
  seed: string;
  players: Record<string, Player>;
  forceStrong: boolean;
  forceYoung?: boolean;
  targetCurrentRange?: readonly [number, number];
  minimumPotential?: number;
}): Player {
  const random = seededRandom(`${input.seed}:${input.season}:regen:${input.index}`);
  const currentIndianShare = Object.values(input.players).filter((player) => player.nationality === "Indian").length
    / Math.max(1, Object.keys(input.players).length);
  const exceptionalTeenProdigy = input.targetCurrentRange === undefined
    && random() < CAREER_POLICY.exceptionalTeenProdigyChance;
  // A separate deterministic stream means adding this exceptional roll does
  // not reshuffle every ordinary regen generated from an existing save seed.
  const ultraPotentialRandom = seededRandom(
    `${input.seed}:${input.season}:regen:${input.index}:ultra-potential`,
  );
  const ultraPotential = input.targetCurrentRange === undefined
    && ultraPotentialRandom() < CAREER_POLICY.ultraPotentialChance;
  const mature = exceptionalTeenProdigy || ultraPotential || input.forceYoung
    ? false
    : random() < CAREER_POLICY.establishedEntryChance;
  let ratings: { current: number; potential: number };
  if (exceptionalTeenProdigy) {
    ratings = {
      current: integerBetween(random, 89, 91),
      potential: integerBetween(random, 95, 97),
    };
  } else if (mature) {
    const category = chooseMatureCategory(input.forceStrong, random);
    ratings = matureRatings(category, random);
  } else {
    const category = chooseProspectCategory(input.forceStrong, random);
    ratings = youngRatings(category, random);
  }
  if (ultraPotential) {
    ratings.potential = Math.max(ratings.current, integerBetween(
      ultraPotentialRandom,
      98,
      CAREER_POLICY.maximumPotentialRating,
    ));
  }
  if (input.targetCurrentRange) {
    const [minimumCurrent, maximumCurrent] = input.targetCurrentRange;
    ratings.current = integerBetween(random, minimumCurrent, maximumCurrent);
    ratings.potential = Math.max(ratings.current, ratings.potential);
  }
  if (input.minimumPotential !== undefined) {
    ratings.potential = Math.max(ratings.current, ratings.potential, input.minimumPotential);
  }
  const roleGroup = chooseRole(input.players, random);
  const role = roleForGeneratedPlayer(roleGroup);
  let skills = generatedSkills(
    roleGroup,
    ratings.current,
    ratings.potential,
    random,
    ultraPotential ? CAREER_POLICY.maximumPotentialRating : 97,
  );
  if (ultraPotential) {
    if (skills.potentialBatting >= skills.potentialBowling) {
      skills = {
        ...skills,
        potentialBatting: ratings.potential,
        potentialBowling: Math.min(ratings.potential, skills.potentialBowling),
      };
    } else {
      skills = {
        ...skills,
        potentialBatting: Math.min(ratings.potential, skills.potentialBatting),
        potentialBowling: ratings.potential,
      };
    }
  }
  let generatedAbility = Math.max(skills.currentBatting, skills.currentBowling);
  const indianProbability = getRegenIndianProbability({
    currentIndianShare,
    currentAbility: generatedAbility,
    potential: Math.max(skills.potentialBatting, skills.potentialBowling),
  });
  const nationality: Player["nationality"] = random() < indianProbability ? "Indian" : "Overseas";
  const indianSquadPlayer = nationality === "Indian"
    && !exceptionalTeenProdigy
    && !ultraPotential
    && !mature
    && !input.forceYoung
    && generatedAbility < 80
    && random() < CAREER_POLICY.indianSquadPlayerChance;
  if (indianSquadPlayer) {
    ratings.current = integerBetween(random, 73, 79);
    ratings.potential = integerBetween(random, ratings.current, Math.min(84, ratings.current + 5));
    skills = generatedSkills(roleGroup, ratings.current, ratings.potential, random);
    const currentBatting = Math.min(80, skills.currentBatting);
    const currentBowling = Math.min(80, skills.currentBowling);
    skills = {
      ...skills,
      currentBatting,
      currentBowling,
      potentialBatting: Math.max(currentBatting, Math.min(85, skills.potentialBatting)),
      potentialBowling: Math.max(currentBowling, Math.min(85, skills.potentialBowling)),
    };
    generatedAbility = Math.max(skills.currentBatting, skills.currentBowling);
  }
  const age = exceptionalTeenProdigy
    ? 16
    : indianSquadPlayer
      ? integerBetween(random, 24, 29)
      : nationality === "Overseas" && generatedAbility >= 83
        ? integerBetween(random, 21, 27)
        : mature
          ? integerBetween(random, 26, 32)
          : nationality === "Indian"
            ? clamp(Math.round(normalRandom(random, 20, 1.5)), 16, 25)
            : clamp(Math.round(normalRandom(random, 22, 2)), 17, input.forceYoung ? 25 : 26);
  const normalizedRatings = normalizeGeneratedTalent(age, mature, ratings, random);
  if (normalizedRatings.current !== ratings.current || normalizedRatings.potential !== ratings.potential) {
    ratings = normalizedRatings;
    skills = generatedSkills(roleGroup, ratings.current, ratings.potential, random);
    generatedAbility = Math.max(skills.currentBatting, skills.currentBowling);
  }
  if (nationality === "Indian" && !mature && !indianSquadPlayer && !exceptionalTeenProdigy) {
    skills = addIndianProspectPotential(skills, roleGroup, random);
  }
  skills = constrainGeneratedPotentialForAge(skills, age);
  const reputation = generatedAbility >= 87 ? 9 : generatedAbility >= 84 ? 8 : generatedAbility >= 79 ? 7 : generatedAbility >= 73 ? 6 : 4;
  const battingProfile = generatedBattingProfile(
    roleGroup,
    skills.currentBatting,
    skills.currentBowling,
    random,
    seededRandom(`${input.seed}:${input.season}:regen:${input.index}:defensive-profile`),
  );
  const country = nationality === "Indian" ? "India" : chooseOverseasCountry(input.players, generatedAbility, random);
  const isCapped = generatedAbility >= 86 || (mature && (ratings.current >= 82 || nationality === "Overseas"));
  const serial = String(input.index + 1).padStart(3, "0");
  const id = `regen-${input.season}-${serial}-${hashSeed(`${input.seed}:${serial}`).toString(36)}`;
  // Use a separate seed so changing the name list never changes player
  // ratings, role, country selection, or any other simulation outcome.
  const name = `${generateRegenName(country, seededRandom(`${input.seed}:${input.season}:regen:${input.index}:name`))} (R)`;
  const player: Player = {
    id,
    name,
    age,
    nationality,
    country,
    role,
    battingStyle: random() < 0.3 ? "Left-hand" : "Right-hand",
    bowlingStyle: roleGroup === "PACE"
      ? "Pacer"
      : roleGroup === "SPIN"
        ? "Spinner"
        : roleGroup === "AR"
          ? (random() < CAREER_POLICY.paceBowlingAllRounderChance ? "Pacer" : "Spinner")
          : null,
    bowlingHand: roleGroup === "BAT" || roleGroup === "WK" ? null : random() < 0.24 ? "Left-hand" : "Right-hand",
    careerStats: {
      batting: { matches: 0, innings: 0, runs: 0, average: 0, strikeRate: 0, fifties: 0, hundreds: 0 },
      bowling: { matches: 0, wickets: 0, economy: 0, average: 0, bestFigures: "0/0" },
    },
    iplStats: { matches: 0, runs: 0, battingAverage: 0, strikeRate: 0, bowlingInnings: 0, bowlingAverage: 0, wickets: 0 },
    iplHistory: [],
    basePrice: calculateBasePrice(isCapped, nationality, generatedAbility, reputation),
    isCapped,
    internationalDebutSeason: isCapped ? input.season : undefined,
    internationalDebutCountry: isCapped ? country : undefined,
    isRetained: false,
    retainedByTeamId: null,
    currentTeamId: null,
    potential: "Established",
    ...skills,
    reputation,
    captaincy: generatedCaptaincy(age, generatedAbility, reputation, random),
    ...battingProfile,
    isWicketkeeper: roleGroup === "WK",
  };
  player.potential = potentialLabel(player);
  player.careerState = {
    ...initializePlayerCareerState(player, input.season),
    origin: "generated",
    generatedSeason: input.season,
    lastAgedSeason: input.season,
  };
  return enforceBattingPositionEligibility(player);
}

function generatedRating(player: Player): number {
  return Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
}

function capGeneratedRating(player: Player, maximumRating: number): Player {
  const cappedCurrent = {
    ...player,
    currentBatting: Math.min(player.currentBatting ?? 0, maximumRating),
    currentBowling: Math.min(player.currentBowling ?? 0, maximumRating),
  };
  const capped = {
    ...cappedCurrent,
    ...constrainGeneratedPotentialForAge(cappedCurrent, player.age),
  };
  return { ...capped, potential: potentialLabel(capped) };
}

function capGeneratedPotential(player: Player, maximumPotential: number): Player {
  const capped = {
    ...player,
    potentialBatting: Math.max(
      player.currentBatting ?? 0,
      Math.min(player.potentialBatting ?? 0, maximumPotential),
    ),
    potentialBowling: Math.max(
      player.currentBowling ?? 0,
      Math.min(player.potentialBowling ?? 0, maximumPotential),
    ),
  };
  return { ...capped, potential: potentialLabel(capped) };
}

function isLikelyRetirementWithin(player: Player, seasonsAhead: number): boolean {
  const horizon = Math.max(1, Math.floor(seasonsAhead));
  const rating = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
  const projectedAge = player.age + horizon;
  if (projectedAge >= CAREER_POLICY.veteranProtectionAge && rating < CAREER_POLICY.veteranProtectionMinimumRating) {
    return true;
  }
  const state = initializePlayerCareerState(player, projectedAge - horizon);
  if (player.currentTeamId) return false;
  if (
    getRawAuctionRating(player) < CAREER_POLICY.auctionEligibilityRating
    && !isYoungDevelopmentPoolPlayer(player)
    && state.belowAuctionStandardSeasons + horizon >= CAREER_POLICY.belowAuctionStandardRetirementSeasons
  ) return true;
  const requiredUnsoldAuctions = requiredUnsoldAuctionsForRetirement(
    { ...player, age: projectedAge },
    rating,
  );
  return requiredUnsoldAuctions !== null
    && state.unsoldAuctionStreak + horizon >= requiredUnsoldAuctions;
}

export interface RegenRetirementForecast {
  nextSeason: number;
  followingSeason: number;
  requiredReserve: number;
}

export function forecastRegenRetirementDemand(
  players: Iterable<Player>,
  season?: number,
): RegenRetirementForecast {
  let nextSeason = 0;
  let followingSeason = 0;
  Array.from(players).forEach((player) => {
    if (isLikelyRetirementWithin(player, 1)) {
      nextSeason += 1;
    } else if (isLikelyRetirementWithin(player, 2)) {
      followingSeason += 1;
    }
  });
  const nextSeasonLimit = season !== undefined && getAuctionTypeForSeason(season) === "mega"
    ? CAREER_POLICY.maximumMegaAuctionDiscretionaryRetirements
    : CAREER_POLICY.maximumMiniAuctionDiscretionaryRetirements;
  const followingSeasonLimit = season !== undefined && getAuctionTypeForSeason(season + 1) === "mega"
    ? CAREER_POLICY.maximumMegaAuctionDiscretionaryRetirements
    : CAREER_POLICY.maximumMiniAuctionDiscretionaryRetirements;
  return {
    nextSeason,
    followingSeason,
    requiredReserve: Math.min(nextSeason, nextSeasonLimit)
      + Math.ceil(Math.min(followingSeason, followingSeasonLimit) / 2),
  };
}

function countEmergingEligiblePlayers(input: {
  players: Iterable<Player>;
  season: number;
  initialSeason: number;
  previousWinnerNames: Iterable<string>;
}): number {
  const previousWinnerNames = Array.from(input.previousWinnerNames);
  return Array.from(input.players).filter((player) => getEmergingPlayerEligibility({
    player,
    season: input.season,
    initialSeason: input.initialSeason,
    previousWinnerNames,
  }).eligible).length;
}

function hasAuctionHighPotentialPlayer(
  players: Iterable<Player>,
  teams: Record<string, Team>,
): boolean {
  const contractedPlayerIds = new Set(Object.values(teams).flatMap((team) => team.squad));
  return Array.from(players).some((player) => (
    !contractedPlayerIds.has(player.id)
    && isPlayerAuctionEligible(player)
    && Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0)
      >= CAREER_POLICY.minimumAuctionHighPotential
  ));
}

export function prepareRetentionPlayerPool(input: {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  season: number;
  seed: string;
  baselineMarketProfile?: AuctionMarketProfile;
  initialSeason?: number;
  previousEmergingWinnerNames?: Iterable<string>;
}): CareerLifecycleResult & { generatedPlayers: Player[]; marketProfile: AuctionMarketProfile } {
  const initialized = initializeCareerPlayers(input.players, input.season - 1);
  const aged = Object.fromEntries(Object.entries(initialized).map(([id, player]) => {
    const state = initializePlayerCareerState(player, input.season - 1);
    if (state.lastAgedSeason === input.season) return [id, player];
    return [id, { ...player, age: player.age + 1, careerState: { ...state, lastAgedSeason: input.season } }];
  }));
  // Preserve the existing hard veteran rule before squad construction. Every
  // discretionary retirement is deferred to the single post-auction pass.
  const mandatoryVeterans = Object.values(aged).flatMap((player) => {
    const rating = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
    if (
      player.age >= CAREER_POLICY.veteranProtectionAge
      && rating < CAREER_POLICY.veteranProtectionMinimumRating
      && !hasOpeningSeasonDhoniRetirementGrace(player)
    ) {
      return [{ player, record: retirementRecord(player, input.season, player.age, "natural") }];
    }
    return [];
  });
  let result = removePlayers(aged, input.teams, mandatoryVeterans);
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

  const existingCurrentSeasonPlayers = Object.values(result.players).filter((player) => (
    player.careerState?.origin === "generated"
    && player.careerState.generatedSeason === input.season
  ));
  const existingCurrentSeasonIntake = existingCurrentSeasonPlayers.length;
  const preIntakePoolSize = Math.max(0, Object.keys(result.players).length - existingCurrentSeasonIntake);
  const existingCurrentSeasonIds = new Set(existingCurrentSeasonPlayers.map((player) => player.id));
  const preIntakePlayers = Object.values(result.players).filter((player) => !existingCurrentSeasonIds.has(player.id));
  const preIntakeAuctionEligiblePlayers = preIntakePlayers.filter(isPlayerAuctionEligible);
  const preIntakeAuctionEligiblePoolSize = preIntakeAuctionEligiblePlayers.length;
  const retirementForecast = forecastRegenRetirementDemand(preIntakePlayers, input.season);
  // Grace-period players remain part of the save but cannot fill an auction
  // place. Base the hard floor on usable auction entrants so those players do
  // not crowd out the replacement intake or leave teams short after a mega.
  const hardMinimumNeed = Math.max(0, CAREER_POLICY.minimumPlayerPool - preIntakeAuctionEligiblePoolSize);
  const proactivePoolTarget = CAREER_POLICY.minimumPlayerPool + retirementForecast.requiredReserve;
  const proactiveNeed = Math.max(0, proactivePoolTarget - preIntakeAuctionEligiblePoolSize);
  // Five arrivals preserve a visible yearly pathway. Forecast demand is capped
  // at 30, but restoring the hard 310-player floor is allowed to exceed it.
  const desiredGeneratedCount = Math.min(
    CAREER_POLICY.maximumPlayerPool - preIntakePoolSize,
    Math.max(
      CAREER_POLICY.minimumAnnualGeneratedPlayers,
      hardMinimumNeed,
      Math.min(CAREER_POLICY.maximumAnnualGeneratedPlayers, proactiveNeed),
    ),
  );
  const required = Math.max(0, desiredGeneratedCount - existingCurrentSeasonIntake);
  const generatedPlayers: Player[] = [];
  let expanded = { ...result.players };
  // One standout prospect per intake keeps elite talent scarce. Include any
  // pre-existing players from this season so repeat preparation is safe too.
  let eliteGeneratedCount = Object.values(expanded).filter((player) => (
    player.careerState?.origin === "generated"
    && player.careerState.generatedSeason === input.season
    && generatedRating(player) > 82
  )).length;
  let elitePotentialCount = Object.values(expanded).filter((player) => (
    player.careerState?.origin === "generated"
    && player.careerState.generatedSeason === input.season
    && Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0) > 90
    && Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0) <= 97
  )).length;
  let highPotentialCount = Object.values(expanded).filter((player) => (
    player.careerState?.origin === "generated"
    && player.careerState.generatedSeason === input.season
    && Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0) > 88
    && Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0) <= 97
  )).length;
  const highPotentialLimit = Math.max(
    1,
    Math.ceil(desiredGeneratedCount * CAREER_POLICY.standardHighPotentialSharePerIntake),
  );
  let generationIndex = existingCurrentSeasonIntake;
  const generateIntakePlayer = (options: {
    forceYoung?: boolean;
    targetCurrentRange?: readonly [number, number];
    minimumPotential?: number;
  } = {}): Player | null => {
    if (Object.keys(expanded).length >= CAREER_POLICY.maximumPlayerPool) return null;
    let player = createGeneratedPlayer({
      index: generationIndex,
      season: input.season,
      seed: input.seed,
      players: expanded,
      forceStrong: false,
      forceYoung: options.forceYoung,
      targetCurrentRange: options.targetCurrentRange,
      minimumPotential: options.minimumPotential,
    });
    generationIndex += 1;
    if (generatedRating(player) > 82) {
      if (eliteGeneratedCount >= CAREER_POLICY.maximumStandardEliteCurrentPerIntake) {
        player = capGeneratedRating(player, 82);
      }
      else eliteGeneratedCount += 1;
    }
    const generatedPotential = Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0);
    const isUltraPotential = generatedPotential > 97;
    if (generatedPotential > 90 && !isUltraPotential) {
      if (elitePotentialCount >= CAREER_POLICY.maximumStandardElitePotentialPerIntake) {
        player = capGeneratedPotential(player, 90);
      }
      else elitePotentialCount += 1;
    }
    if (
      Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0) > 88
      && !isUltraPotential
    ) {
      if (highPotentialCount >= highPotentialLimit) player = capGeneratedPotential(player, 88);
      else highPotentialCount += 1;
    }
    expanded[player.id] = player;
    generatedPlayers.push(player);
    return player;
  };

  for (let index = 0; index < required; index += 1) {
    generateIntakePlayer();
  }

  const initialSeason = input.initialSeason ?? input.season;
  const previousEmergingWinnerNames = Array.from(input.previousEmergingWinnerNames ?? []);
  let emergingEligibleCount = countEmergingEligiblePlayers({
    players: Object.values(expanded),
    season: input.season,
    initialSeason,
    previousWinnerNames: previousEmergingWinnerNames,
  });
  while (
    emergingEligibleCount < CAREER_POLICY.minimumEmergingEligiblePlayers
    && Object.keys(expanded).length < CAREER_POLICY.maximumPlayerPool
  ) {
    const player = generateIntakePlayer({
      forceYoung: true,
      targetCurrentRange: [67, 78],
    });
    if (!player) break;
    emergingEligibleCount = countEmergingEligiblePlayers({
      players: Object.values(expanded),
      season: input.season,
      initialSeason,
      previousWinnerNames: previousEmergingWinnerNames,
    });
  }

  if (
    !hasAuctionHighPotentialPlayer(Object.values(expanded), result.teams)
    && Object.keys(expanded).length < CAREER_POLICY.maximumPlayerPool
  ) {
    generateIntakePlayer({
      forceYoung: true,
      targetCurrentRange: [67, 78],
      minimumPotential: CAREER_POLICY.minimumAuctionHighPotential,
    });
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
    internationalDebutSeason: player.internationalDebutSeason,
    internationalDebutCountry: player.internationalDebutCountry,
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
    reputation: player.reputation,
    captaincy: player.captaincy,
    retirementAge: record.age,
    retirementSeason: record.season,
    finalRating: record.rating,
    careerStats: player.careerStats,
    iplStats: player.iplStats,
    iplHistory: player.iplHistory,
  };
}
