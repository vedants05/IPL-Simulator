import type {
  BoundaryDimensions,
  CuratorPitch,
  PitchPreference,
} from "@/lib/data/pitchCurator";
import type { OutfieldSettings } from "@/lib/logic/stadiumManagement";
import {
  createTeamTactics,
  type FieldSetting,
  type TeamTactics,
  type TeamStrategy,
} from "@/lib/logic/teamTactics";
import { selectBattingFirstOutgoingBatter } from "@/lib/logic/aiLineupSelector";
import type { Player, Team } from "@/lib/types";

export const MATCH_SIMULATION_VERSION = 1;
export const DEFAULT_CHASING_SCORING_BONUS = 0.02;
export const HOME_ADVANTAGE_STRENGTH_BONUS = 0.5;
export const POWERPLAY_BOUNDARY_MULTIPLIER = 1.06;
export const CORE_BATTER_ROTATION_MULTIPLIER = 1.08;
export const FINISHER_BOUNDARY_MULTIPLIER = 1.1;

export type TossDecision = "bat" | "bowl";
export type DismissalKind =
  | "caught"
  | "bowled"
  | "lbw"
  | "run-out"
  | "stumped"
  | "hit-wicket";

export interface MatchLineupPlan {
  startingXI: string[];
  impactSubs: string[];
  plannedImpactPlayerId?: string | null;
  plannedOutgoingPlayerId?: string | null;
  plannedImpactBattingPosition?: number | null;
  captainId?: string | null;
  viceCaptainId?: string | null;
}

export interface MatchTeamPlans {
  teamId: string;
  battingFirst: MatchLineupPlan;
  bowlingFirst: MatchLineupPlan;
  tactics: TeamTactics;
  isUserControlled: boolean;
}

export interface MatchGroundConditions {
  homeTeamId: string;
  stadiumId: string;
  stadiumName: string;
  pitch: CuratorPitch;
  boundaries: BoundaryDimensions;
  outfield: OutfieldSettings;
  outfieldSpeedRating: number;
  adjustedExpectedScore: { min: number; max: number };
  groundScoringModifier: number;
  chasingScoringBonus?: number;
}

export interface MatchSimulationInput {
  fixtureId: string;
  matchNumber: number;
  date?: string;
  time?: string;
  seed: string;
  teamA: Team;
  teamB: Team;
  players: Record<string, Player>;
  teamAPlans: MatchTeamPlans;
  teamBPlans: MatchTeamPlans;
  conditions: MatchGroundConditions;
  formAdjustments?: Record<string, number>;
  recentScorecards?: Array<any>;
  stage?: string;
  isKnockout?: boolean;
}

export interface DeliveryExtras {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
}

export interface DeliveryWicket {
  playerId: string;
  playerName: string;
  kind: DismissalKind;
  bowlerCredited: boolean;
  fielderId?: string;
  fielderName?: string;
}

export type FieldingEventKind =
  | "dropped-catch"
  | "missed-run-out"
  | "missed-stumping"
  | "misfield"
  | "keeping-error";

export interface DeliveryFieldingEvent {
  kind: FieldingEventKind;
  fielderId?: string;
  fielderName?: string;
}

export interface MatchDelivery {
  id: string;
  inningsNumber: 1 | 2;
  overNumber: number;
  deliveryInOver: number;
  legalBallNumber: number;
  displayBall: string;
  strikerId: string;
  strikerName: string;
  nonStrikerId: string;
  nonStrikerName: string;
  bowlerId: string;
  bowlerName: string;
  runsOffBat: number;
  totalRuns: number;
  extras: DeliveryExtras;
  isLegal: boolean;
  isFreeHit?: boolean;
  wicket?: DeliveryWicket;
  fieldingEvent?: DeliveryFieldingEvent;
  resultCode: string;
  commentary: string;
  scoreAfter: number;
  wicketsAfter: number;
}

export interface MatchOver {
  number: number;
  bowlerId: string;
  bowlerName: string;
  batterIds: string[];
  batterNames: string[];
  deliveries: MatchDelivery[];
  runs: number;
  wickets: number;
  scoreAfter: number;
  wicketsAfter: number;
}

export interface BattingScorecardEntry {
  id: string;
  name: string;
  battingPosition: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissal: string;
  dismissalKind?: DismissalKind;
  bowlerId?: string;
  fielderId?: string;
  notOut: boolean;
  didNotBat: boolean;
}

export interface BowlingScorecardEntry {
  id: string;
  name: string;
  balls: number;
  overs: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  wides: number;
  noBalls: number;
}

export interface FallOfWicket {
  wicket: number;
  score: number;
  legalBall: number;
  over: string;
  playerId: string;
  playerName: string;
}

export interface MatchPartnership {
  wicket: number;
  batterIds: string[];
  batterNames: string[];
  batterRuns?: number[];
  batterBalls?: number[];
  runs: number;
  balls: number;
}

export interface InningsExtras {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  total: number;
}

export interface MatchInnings {
  inningsNumber: 1 | 2;
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  legalBalls: number;
  overs: number;
  target?: number;
  batting: BattingScorecardEntry[];
  bowling: BowlingScorecardEntry[];
  extras: InningsExtras;
  oversDetail: MatchOver[];
  fallOfWickets: FallOfWicket[];
  partnerships: MatchPartnership[];
}

export interface MatchImpactDecision {
  teamId: string;
  used: boolean;
  incomingPlayerId?: string;
  incomingPlayerName?: string;
  outgoingPlayerId?: string;
  outgoingPlayerName?: string;
  battingPosition?: number;
  reason:
    | "planned-batting"
    | "planned-bowling"
    | "collapse-recovery"
    | "high-target-adaptation"
    | "best-available"
    | "not-used";
  explanation: string;
}

export interface MatchLineupSnapshot {
  teamId: string;
  plan: "battingFirst" | "bowlingFirst";
  startingXI: string[];
  finalXI: string[];
  captainId?: string | null;
  viceCaptainId?: string | null;
}

export interface SuperOverInningsResult {
  teamId: string;
  runs: number;
  wickets: number;
}

export interface SuperOverResult {
  played: boolean;
  tiedCount: number;
  winnerId: string;
  teamAScore: SuperOverInningsResult;
  teamBScore: SuperOverInningsResult;
  summaryText: string;
}

export interface MatchSimulationRecord {
  version: number;
  seed: string;
  fixtureId: string;
  tossWinnerId: string;
  tossDecision: TossDecision;
  battingFirstTeamId: string;
  bowlingFirstTeamId: string;
  winnerId: string;
  resultText: string;
  superOver?: SuperOverResult;
  playerOfTheMatchId: string;
  playerOfTheMatchName: string;
  conditions: {
    stadiumId: string;
    stadiumName: string;
    pitchId: string;
    pitchName: string;
    pitchType: string;
    expectedScore: { min: number; max: number };
    boundaries: BoundaryDimensions;
    outfieldSpeedRating: number;
    weather: null;
  };
  lineups: Record<string, MatchLineupSnapshot>;
  impactDecisions: MatchImpactDecision[];
  innings: [MatchInnings, MatchInnings];
  summary: string[];
}

interface MutableBattingEntry extends BattingScorecardEntry {}
interface MutableBowlingEntry extends BowlingScorecardEntry {}

interface ActiveTeamState {
  team: Team;
  planKind: "battingFirst" | "bowlingFirst";
  plan: MatchLineupPlan;
  startingXI: string[];
  finalXI: string[];
  battingOrder: string[];
  impactUsed: boolean;
  impactDecision: MatchImpactDecision;
}

interface InningsContext {
  inningsNumber: 1 | 2;
  batting: ActiveTeamState;
  bowling: ActiveTeamState;
  players: Record<string, Player>;
  tactics: TeamTactics;
  bowlingTactics: TeamTactics;
  conditions: MatchGroundConditions;
  rng: SimulationRandom;
  target?: number;
  firstInningsWickets?: number;
  skillEdge: number;
  performanceTilt: number;
  formAdjustments: Record<string, number>;
  priorBattingBalls?: Readonly<Record<string, number>>;
  allowCollapseImpact: boolean;
  seed?: string;
  stage?: string;
  isKnockout?: boolean;
  time?: string;
}

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

const round = (value: number, digits = 2) => {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
};

export function oversFromBalls(balls: number): number {
  return Math.floor(balls / 6) + (balls % 6) / 10;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

class SimulationRandom {
  private state: number;
  private spareGaussian: number | null = null;

  constructor(seed: string) {
    this.state = hashSeed(seed) || 0x6d2b79f5;
  }

  next(): number {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  gaussian(): number {
    if (this.spareGaussian !== null) {
      const spare = this.spareGaussian;
      this.spareGaussian = null;
      return spare;
    }
    const left = Math.max(Number.EPSILON, this.next());
    const right = this.next();
    const radius = Math.sqrt(-2 * Math.log(left));
    const angle = 2 * Math.PI * right;
    this.spareGaussian = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  }

  weighted<T>(items: readonly { value: T; weight: number }[]): T {
    const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    if (total <= 0) return items[0].value;
    let cursor = this.next() * total;
    for (const item of items) {
      cursor -= Math.max(0, item.weight);
      if (cursor <= 0) return item.value;
    }
    return items[items.length - 1].value;
  }
}

const isKeeper = (player: Player | undefined) => Boolean(
  player
  && (
    player.role === "WK-Batsman"
    || player.isWicketkeeper
    || player.isPartTimeWk
  )
);

export function selectInningsWicketkeeper(
  fieldingIds: readonly string[],
  players: Record<string, Player>,
): Player | undefined {
  const fielders = fieldingIds
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player));
  return fielders.find((player) => (
    player.role === "WK-Batsman" || Boolean(player.isWicketkeeper)
  )) ?? fielders.find((player) => Boolean(player.isPartTimeWk));
}

const isOverseas = (player: Player | undefined) => player?.nationality === "Overseas";

function isLegalImpactSwap(
  teamState: ActiveTeamState,
  incoming: Player,
  outgoing: Player,
  players: Record<string, Player>,
): boolean {
  const remainingOverseas = teamState.finalXI
    .filter((playerId) => playerId !== outgoing.id)
    .map((playerId) => players[playerId])
    .filter(isOverseas)
    .length;
  return remainingOverseas + Number(isOverseas(incoming)) <= 4;
}

const isBowlingOption = (player: Player | undefined) => Boolean(
  player
  && player.currentBowling >= 50
  && (
    player.role === "Pace Bowler"
    || player.role === "Spin Bowler"
    || player.role === "All-Rounder"
  )
);

const isBattingAllRounder = (player: Player | undefined) => Boolean(
  player
  && (
    (player.role === "All-Rounder" && player.currentBatting >= 74 && player.currentBowling < 76)
    || (player.currentBatting >= 78 && player.currentBowling < 76)
  )
);

const isSpinner = (player: Player | undefined) => Boolean(
  player
  && (
    player.role === "Spin Bowler"
    || player.bowlingStyle === "Spinner"
  )
);

const isPacer = (player: Player | undefined) => Boolean(
  player
  && (
    player.role === "Pace Bowler"
    || player.bowlingStyle === "Pacer"
  )
);

const hasPreference = (
  pitch: CuratorPitch,
  collection: "favours" | "doesNotFavour",
  preference: PitchPreference,
) => pitch[collection].includes(preference);

function teamPlayingStrength(
  plan: MatchLineupPlan,
  players: Record<string, Player>,
  planKind: "battingFirst" | "bowlingFirst",
): number {
  const starting = plan.startingXI
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player));
  const impactPlayer = plan.plannedImpactPlayerId
    ? players[plan.plannedImpactPlayerId]
    : undefined;
  const postImpact = impactPlayer
    ? [
        ...starting.filter((player) => player.id !== plan.plannedOutgoingPlayerId),
        impactPlayer,
      ]
    : starting;
  const battingPool = planKind === "bowlingFirst" ? postImpact : starting;
  const bowlingPool = planKind === "battingFirst" ? postImpact : starting;
  const batting = battingPool
    .map((player) => player.currentBatting)
    .sort((left, right) => right - left)
    .slice(0, 7);
  const bowling = bowlingPool
    .filter(isBowlingOption)
    .map((player) => player.currentBowling)
    .sort((left, right) => right - left)
    .slice(0, 5);
  const battingAverage = batting.reduce((sum, value) => sum + value, 0) / Math.max(1, batting.length);
  const bowlingAverage = bowling.reduce((sum, value) => sum + value, 0) / Math.max(1, bowling.length);
  return battingAverage * 0.58 + bowlingAverage * 0.42;
}

/**
 * Equal sides are exactly 50/50. Ratings matter clearly, but a strong XI
 * should not turn a short-format match into a near-certainty before it starts.
 */
export function estimateTeamWinProbability(strengthA: number, strengthB: number): number {
  const difference = strengthA - strengthB;
  return clamp(1 / (1 + Math.exp(-difference / 7)), 0.2, 0.8);
}

export function chooseTossDecision(
  tactics: TeamTactics,
  conditions: MatchGroundConditions,
): TossDecision {
  if (tactics.tossPreference === "bat") return "bat";
  if (tactics.tossPreference === "bowl") return "bowl";
  if (conditions.pitch.doesNotFavour.includes("chasing-team")) return "bat";
  if (conditions.pitch.favours.includes("chasing-team")) return "bowl";

  const surfaceDescription = [
    conditions.pitch.type,
    ...conditions.pitch.characteristics,
  ].join(" ").toLowerCase();
  const deteriorates = (
    /deteriorat|progressively slower|slows further|becomes slower|turn increases|less predictable as .*wear|as .*surface wears/
  ).test(surfaceDescription);
  if (deteriorates) return "bat";

  const easesForBatting = (
    /movement reduces|dries and flattens|flattens|easier.*later/
  ).test(surfaceDescription);
  if (easesForBatting) return "bowl";

  const centre = (
    conditions.adjustedExpectedScore.min
    + conditions.adjustedExpectedScore.max
  ) / 2;
  return (
    centre >= 185
    || conditions.outfieldSpeedRating >= 8.5
    || (conditions.chasingScoringBonus ?? DEFAULT_CHASING_SCORING_BONUS) > 0
  ) ? "bowl" : "bat";
}

function createActiveTeamState(
  team: Team,
  plans: MatchTeamPlans,
  kind: "battingFirst" | "bowlingFirst",
): ActiveTeamState {
  const plan = plans[kind];
  return {
    team,
    planKind: kind,
    plan,
    startingXI: [...plan.startingXI],
    finalXI: [...plan.startingXI],
    battingOrder: [...plan.startingXI],
    impactUsed: false,
    impactDecision: {
      teamId: team.id,
      used: false,
      reason: "not-used",
      explanation: "No Impact Player was used.",
    },
  };
}

function playerPositionPenalty(player: Player, battingPosition: number): number {
  if (player.onlyOpensOrBenched && battingPosition > 2) return 8;
  if (player.isOpener && battingPosition >= 6) return 3;
  if (!player.isOpener && battingPosition <= 2) {
    if (player.role === "Pace Bowler" || player.role === "Spin Bowler") return 9;
    if (player.isCoreBatter || player.hasBattedAt3) return 1.5;
    return 3;
  }
  if ((player.role === "Pace Bowler" || player.role === "Spin Bowler") && battingPosition <= 6) {
    return 6;
  }
  if (player.isFinisher && battingPosition <= 3) return 3;
  if (player.isCoreBatter && battingPosition >= 8) return 3;
  return 0;
}

function battingPitchAdjustment(player: Player, pitch: CuratorPitch): number {
  const aggression = player.battingAggression ?? 65;
  let adjustment = 0;
  if (hasPreference(pitch, "favours", "aggressive-batters") && aggression >= 78) adjustment += 2.5;
  if (hasPreference(pitch, "doesNotFavour", "aggressive-batters") && aggression >= 78) adjustment -= 3;
  if (hasPreference(pitch, "favours", "controlled-batters") && aggression <= 72) adjustment += 2;
  if (hasPreference(pitch, "favours", "openers") && player.isOpener) adjustment += 1.5;
  if (hasPreference(pitch, "doesNotFavour", "openers") && player.isOpener) adjustment -= 2;
  if (hasPreference(pitch, "favours", "high-rated-batters") && player.currentBatting >= 82) adjustment += 1.5;
  return adjustment;
}

function bowlingPitchAdjustment(player: Player, pitch: CuratorPitch): number {
  let adjustment = 0;
  if (isSpinner(player)) {
    if (hasPreference(pitch, "favours", "spin-bowlers")) adjustment += 5;
    if (hasPreference(pitch, "doesNotFavour", "spin-bowlers")) adjustment -= 5;
  }
  if (isPacer(player)) {
    if (hasPreference(pitch, "favours", "pace-bowlers")) adjustment += 4;
    if (hasPreference(pitch, "favours", "high-rated-pace-bowlers") && player.currentBowling >= 82) adjustment += 3;
    if (hasPreference(pitch, "doesNotFavour", "pace-bowlers")) adjustment -= 4;
  }
  return adjustment;
}

function battingIntent(
  tactics: TeamTactics,
  overNumber: number,
  wickets: number,
  runs: number,
  target?: number,
): number {
  let intent = overNumber <= 6
    ? ({ cautious: -0.12, balanced: 0, attack: 0.13 }[tactics.batting.powerplay])
    : overNumber <= 15
      ? ({ rebuild: -0.12, rotate: -0.02, dominate: 0.12 }[tactics.batting.middle])
      : ({ preserve: -0.08, flexible: 0.06, "all-out": 0.2 }[tactics.batting.death]);

  const collapse = (
    (overNumber <= 8 && wickets >= 3)
    || (overNumber <= 13 && wickets >= 5)
  );
  if (collapse) {
    intent += {
      "keep-attacking": 0.08,
      stabilise: -0.08,
      "deep-rebuild": -0.15,
    }[tactics.batting.collapseResponse];
  }

  if (target) {
    const ballsRemaining = Math.max(1, 120 - ((overNumber - 1) * 6));
    const requiredRate = Math.max(0, target - runs) / ballsRemaining;
    const parPerBall = target / 120;
    const pressure = clamp((requiredRate - parPerBall) * 0.28, -0.1, 0.28);
    intent += pressure;
    intent += {
      "stay-with-rate": 0,
      "preserve-wickets": wickets >= 4 ? -0.07 : -0.03,
      "front-load": overNumber <= 10 ? 0.08 : 0.03,
    }[tactics.batting.chaseApproach];
  }

  return clamp(intent, -0.22, 0.35);
}

export function chooseSituationalField(
  selectedField: FieldSetting,
  overNumber: number,
  wickets: number,
  runs: number,
  target?: number,
): FieldSetting {
  if (target && runs < target) {
    const ballsRemaining = Math.max(1, 120 - (overNumber - 1) * 6);
    const remainingRuns = target - runs;
    const requiredRunRate = remainingRuns / (ballsRemaining / 6);
    if (requiredRunRate >= 12) return "defensive";
    if (ballsRemaining <= 30 && requiredRunRate <= 8 && wickets < 7) return "attacking";
  } else if (overNumber >= 16 && wickets <= 4) {
    return "attacking";
  }
  if (wickets >= 4 && overNumber <= 15) return "attacking";
  return selectedField;
}

function bowlingTacticalAdjustment(
  tactics: TeamTactics,
  overNumber: number,
  bowler: Player,
  field: FieldSetting,
): { wicket: number; scoring: number } {
  let wicket = field === "attacking"
    ? 0.004
    : field === "defensive"
      ? -0.002
      : 0;
  let scoring = field === "attacking"
    ? 0.02
    : field === "defensive"
      ? -0.025
      : 0;

  if (overNumber <= 6) {
    if (tactics.bowling.powerplay === "swing-attack" && isPacer(bowler)) wicket += 0.006;
    if (tactics.bowling.powerplay === "contain") scoring -= 0.04;
  } else if (overNumber <= 15) {
    if (tactics.bowling.middle === "spin-choke" && isSpinner(bowler)) {
      wicket += 0.005;
      scoring -= 0.04;
    }
    if (tactics.bowling.middle === "pace" && isPacer(bowler)) wicket += 0.003;
  } else {
    if (tactics.bowling.death === "wicket-hunt") {
      wicket += 0.008;
      scoring += 0.04;
    } else if (tactics.bowling.death === "yorkers" && isPacer(bowler)) {
      wicket += 0.004;
      scoring -= 0.04;
    } else if (tactics.bowling.death === "defensive") {
      scoring -= 0.05;
    }
  }
  return { wicket, scoring };
}

function canCompleteBowlingRotation(
  remainingOvers: number,
  previousBowlerId: string,
  bowlerIds: readonly string[],
  remainingCapacity: ReadonlyMap<string, number>,
): boolean {
  const memo = new Map<string, boolean>();
  const search = (
    oversLeft: number,
    previousId: string,
    capacities: readonly number[],
  ): boolean => {
    if (oversLeft === 0) return true;
    if (capacities.reduce((sum, capacity) => sum + capacity, 0) < oversLeft) return false;
    const key = `${oversLeft}|${previousId}|${capacities.join(",")}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const choices = bowlerIds
      .map((bowlerId, index) => ({ bowlerId, index, capacity: capacities[index] }))
      .filter((choice) => choice.capacity > 0 && choice.bowlerId !== previousId)
      .sort((left, right) => right.capacity - left.capacity);
    for (const choice of choices) {
      const nextCapacities = [...capacities];
      nextCapacities[choice.index] -= 1;
      if (search(oversLeft - 1, choice.bowlerId, nextCapacities)) {
        memo.set(key, true);
        return true;
      }
    }
    memo.set(key, false);
    return false;
  };

  return search(
    remainingOvers,
    previousBowlerId,
    bowlerIds.map((bowlerId) => remainingCapacity.get(bowlerId) ?? 0),
  );
}

export function nextBowlerSpellOver(
  overNumber: number,
  lastOverNumber: number | undefined,
  previousSpellOvers: number,
): number {
  // A bowler cannot bowl adjacent overs. Returning every other over represents
  // an uninterrupted spell from one end; any larger gap resets that spell.
  return lastOverNumber === overNumber - 2 ? previousSpellOvers + 1 : 1;
}

function chooseBowler(
  overNumber: number,
  fieldingIds: readonly string[],
  players: Record<string, Player>,
  ballsByBowler: ReadonlyMap<string, number>,
  previousBowlerId: string | null,
  tactics: TeamTactics,
  pitch: CuratorPitch,
  captaincyRating: number,
  unavailableUntilOver: ReadonlyMap<string, number>,
  rng: SimulationRandom,
): Player {
  const candidates = fieldingIds
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player) && isBowlingOption(player));
  const fallback = fieldingIds
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player) && player.currentBowling >= 45 && player.role !== "WK-Batsman")
    .sort((left, right) => right.currentBowling - left.currentBowling);
  // Five bowlers are needed to cover 20 overs legally. If a lineup exposes
  // fewer recognised options, supplement it with the best available part-time
  // choices instead of creating an impossible four-bowler rotation.
  const pool = candidates.length >= 5
    ? candidates
    : [
        ...candidates,
        ...fallback.filter((player) => !candidates.some((candidate) => candidate.id === player.id)),
      ].slice(0, Math.min(5, fallback.length));
  const withCapacity = pool.filter((player) => (
    (ballsByBowler.get(player.id) ?? 0) < 24
    && player.id !== previousBowlerId
  ));
  const restedWithCapacity = withCapacity.filter((player) => (
    (unavailableUntilOver.get(player.id) ?? 0) <= overNumber
  ));
  const remainingOversAfterThis = 20 - overNumber;
  const feasible = restedWithCapacity.filter((candidate) => {
    const remainingCapacity = new Map(pool.map((player) => [
      player.id,
      Math.max(0, 4 - Math.floor((ballsByBowler.get(player.id) ?? 0) / 6)),
    ]));
    remainingCapacity.set(
      candidate.id,
      Math.max(0, (remainingCapacity.get(candidate.id) ?? 0) - 1),
    );
    return canCompleteBowlingRotation(
      remainingOversAfterThis,
      candidate.id,
      pool.map((player) => player.id),
      remainingCapacity,
    );
  });
  const eligible = feasible.length > 0
    ? feasible
    : restedWithCapacity.length > 0
    ? restedWithCapacity
    // A cooldown must never make completing 20 legal overs impossible.
    : withCapacity.length > 0
    ? withCapacity
    : pool.filter((player) => (ballsByBowler.get(player.id) ?? 0) < 24);
  const frontlineBowlerIds = new Set(
    [...pool]
      .sort((left, right) => right.currentBowling - left.currentBowling)
      .slice(0, Math.min(4, pool.length))
      .map((player) => player.id),
  );
  const deathBowlerIds = new Set(
    [...pool]
      .sort((left, right) => (
        (right.currentBowling + Number(isPacer(right)) * 3)
        - (left.currentBowling + Number(isPacer(left)) * 3)
      ))
      .slice(0, 2)
      .map((player) => player.id),
  );

  const captaincyQuality = clamp(captaincyRating / 100, 0, 1);
  const phaseFitMultiplier = 0.94 + captaincyQuality * 0.12;
  const decisionNoise = 1.45 - captaincyQuality * 0.55;
  const scored = eligible.map((player) => {
    let score = player.currentBowling + bowlingPitchAdjustment(player, pitch);
    const ballsBowled = ballsByBowler.get(player.id) ?? 0;
    let phaseFit = 0;
    if (overNumber <= 6 && isPacer(player)) phaseFit += 5;
    if (overNumber >= 7 && overNumber <= 15 && isSpinner(player)) phaseFit += 5;
    if (overNumber >= 16 && isPacer(player)) phaseFit += 4;
    if (overNumber <= 6 && tactics.bowling.powerplay === "swing-attack" && isPacer(player)) phaseFit += 3;
    if (overNumber >= 7 && overNumber <= 15 && tactics.bowling.middle === "spin-choke" && isSpinner(player)) phaseFit += 4;
    if (overNumber >= 16 && tactics.bowling.death === "yorkers" && isPacer(player)) phaseFit += 3;
    score += phaseFit * phaseFitMultiplier;
    const oversBowled = Math.floor(ballsBowled / 6);
    if (frontlineBowlerIds.has(player.id)) {
      const oversStillWanted = Math.max(0, 4 - oversBowled);
      // Frontline quality becomes increasingly decisive late in the innings,
      // preventing surface preferences from leaving superior bowlers unused.
      score += oversStillWanted * (overNumber >= 16 ? 5 : overNumber >= 12 ? 2.5 : 1);
      if (overNumber >= 17 && oversStillWanted >= 2) score += 9;
    }
    if (deathBowlerIds.has(player.id)) {
      if (overNumber <= 12 && oversBowled >= 2) score -= 9;
      if (overNumber <= 15 && oversBowled >= 3) score -= 12;
      if (overNumber >= 16) score += 7;
    }
    // Heavy penalty for part-timers in death overs to keep death overs strictly for specialists
    if (overNumber >= 16 && (!isBowlingOption(player) || player.currentBowling < 65)) {
      score -= 50;
    }
    // Selection penalty for batting all-rounders so primary specialist bowlers bowl first
    if (isBattingAllRounder(player)) {
      score -= 22;
      if (oversBowled >= 2) {
        score -= 30; // Further penalty once they have completed 2 overs
      }
    }
    // Frontline pacers get massive priority in overs 18-20
    if (overNumber >= 17 && isPacer(player) && player.currentBowling >= 75) {
      score += 15;
    }
    score -= ballsBowled * 0.12;
    // Strong captains are a little more consistent at identifying the right
    // bowler for the phase; this changes selection, never execution ratings.
    score += rng.gaussian() * decisionNoise;
    return { player, score };
  });

  return scored.sort((left, right) => right.score - left.score)[0]?.player
    ?? fallback[0];
}

function emptyExtras(): DeliveryExtras {
  return { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
}

function deliveryResultCode(
  runsOffBat: number,
  extras: DeliveryExtras,
  wicket?: DeliveryWicket,
): string {
  if (wicket) return "W";
  if (extras.wides > 0) return extras.wides === 1 ? "Wd" : `${extras.wides}Wd`;
  if (extras.noBalls > 0) return runsOffBat > 0 ? `${runsOffBat}+Nb` : "Nb";
  if (extras.byes > 0) return `${extras.byes}B`;
  if (extras.legByes > 0) return `${extras.legByes}Lb`;
  return String(runsOffBat);
}

function selectFielder(
  fieldingIds: readonly string[],
  players: Record<string, Player>,
  rng: SimulationRandom,
  wicketkeeperOnly = false,
): Player | undefined {
  const candidates = fieldingIds
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player))
    .filter((player) => !wicketkeeperOnly || isKeeper(player));
  if (candidates.length === 0) return undefined;
  return rng.weighted(candidates.map((player) => {
    const ageScore = player.age <= 28 ? 8 : player.age <= 33 ? 5 : 2;
    const ability = Math.max(player.currentBatting, player.currentBowling);
    return {
      value: player,
      weight: 20 + ageScore + ability * 0.35 + (player.reputation ?? 5),
    };
  }));
}

function inferredFieldingRating(player: Player): number {
  const ageAdjustment = player.age <= 28 ? 4 : player.age <= 33 ? 1 : -3;
  const generalAbility = Math.max(player.currentBatting, player.currentBowling);
  return clamp(
    54 + generalAbility * 0.24 + (player.reputation ?? 5) * 0.8 + ageAdjustment,
    55,
    91,
  );
}

function inferredKeeperRating(player: Player | undefined): number {
  if (!player) return 48;

  // Specific elite keeper ratings based on real-life keeping reputation & stumping speed
  const name = player.name;
  if (name.includes("Dhoni")) return 94;
  if (name.includes("Pant")) return 88;
  if (name.includes("Samson")) return 86;
  if (name.includes("Klaasen")) return 85;
  if (name.includes("Pooran")) return 85;
  if (name.includes("Ishan Kishan")) return 82;
  if (name.includes("KL Rahul")) return 82;
  if (name.includes("Jurel")) return 80;
  if (name.includes("Porel")) return 78;
  if (name.includes("Prabhsimran")) return 76;

  const isPrimaryKeeper = player.role === "WK-Batsman" || Boolean(player.isWicketkeeper);
  const isPartTime = Boolean(player.isPartTimeWk) && !isPrimaryKeeper;

  const base = isPrimaryKeeper ? 78 : isPartTime ? 68 : 50;
  const reputationBonus = (player.reputation ?? 5) * 1.2;
  const ageExperienceBonus = Math.min(6, Math.max(0, (player.age - 20) * 0.4));

  return clamp(
    Math.round(base + reputationBonus + ageExperienceBonus),
    50,
    95,
  );
}

function inferredPressureComposure(player: Player): number {
  const reputationComponent = clamp(((player.reputation ?? 5) - 6) / 4, 0, 1);
  const experienceComponent = player.age >= 30
    ? 1
    : player.age >= 27
      ? 0.65
      : player.age >= 24
        ? 0.3
        : 0;
  return clamp(reputationComponent * 0.7 + experienceComponent * 0.3, 0, 1);
}

export function partnershipWicketReduction(
  partnershipBalls: number,
  partnershipRuns: number,
): number {
  return clamp(
    Math.max(0, partnershipBalls - 12) * 0.00008
    + Math.max(0, partnershipRuns - 20) * 0.00003,
    0,
    0.004,
  );
}

export function dotBallPressureAdjustment(consecutiveDots: number): {
  runMultiplier: number;
  wicketIncrease: number;
} {
  const pressuredDots = Math.max(0, consecutiveDots - 2);
  return {
    runMultiplier: 1 + Math.min(0.08, pressuredDots * 0.02),
    wicketIncrease: Math.min(0.01, pressuredDots * 0.002),
  };
}

export function bowlerRespectIntentAdjustment(
  battingRating: number,
  bowlingRating: number,
): number {
  const advantage = battingRating - bowlingRating;
  if (Math.abs(advantage) <= 5) return 0;
  return advantage > 0
    ? Math.min(0.04, (advantage - 5) * 0.003)
    : Math.max(-0.035, (advantage + 5) * 0.003);
}

export function powerplayAllRounderFatigue(
  ballsFaced: number,
  overNumber: number,
  isAllRounder: boolean,
): number {
  if (!isAllRounder || overNumber > 6 || ballsFaced < 30) return 0;
  return Math.min(3, 0.5 + (ballsFaced - 30) * 0.075);
}

export function strikeFarmSingleMultiplier(
  deliveryInOver: number,
  strikerIsEstablished: boolean,
  nonStrikerIsWeak: boolean,
  strikerIsWeak: boolean,
  nonStrikerIsEstablished: boolean,
): number {
  if (strikerIsEstablished && nonStrikerIsWeak) {
    return deliveryInOver >= 5 ? 1.25 : 0.8;
  }
  if (strikerIsWeak && nonStrikerIsEstablished) {
    return deliveryInOver <= 5 ? 1.2 : 0.8;
  }
  return 1;
}

export function groundRunningPressure(conditions: MatchGroundConditions): number {
  const averageBoundary = (
    conditions.boundaries.straightMetres
    + conditions.boundaries.wideMetres
  ) / 2;
  const boundaryPressure = clamp((averageBoundary - 67) / 8, 0, 1);
  const outfieldPressure = clamp((7 - conditions.outfieldSpeedRating) / 2, 0, 1);
  return boundaryPressure * outfieldPressure;
}

export function deathExtrasPressure(
  overNumber: number,
  bowlingRating: number,
  composure: number,
  closeChase: boolean,
): { wideIncrease: number; noBallIncrease: number } {
  if (overNumber < 16) return { wideIncrease: 0, noBallIncrease: 0 };
  const phasePressure = clamp((overNumber - 15) / 5 + (closeChase ? 0.25 : 0), 0, 1);
  const control = clamp(
    clamp((bowlingRating - 70) / 20, 0, 1) * 0.65
    + clamp(composure, 0, 1) * 0.35,
    0,
    1,
  );
  const absorbedPressure = phasePressure * (1 - control * 0.65);
  return {
    wideIncrease: absorbedPressure * 0.004,
    noBallIncrease: absorbedPressure * 0.0012,
  };
}

export function milestonePressureScoringFactor(
  runs: number,
  battingAggression: number,
  pressureLevel: number,
): number {
  if (battingAggression >= 60 || pressureLevel > 0.2) return 1;
  if (runs >= 90 && runs < 100) return 0.98;
  if (runs >= 45 && runs < 50) return 0.96;
  return 1;
}

function isPartTimeKeeper(player: Player | undefined): boolean {
  return Boolean(
    player
    && player.isPartTimeWk
    && !player.isWicketkeeper
    && player.role !== "WK-Batsman",
  );
}

function dismissalCompletionProbability(
  wicket: DeliveryWicket,
  players: Record<string, Player>,
): number {
  const fielder = wicket.fielderId ? players[wicket.fielderId] : undefined;
  if (wicket.kind === "caught") {
    const rating = fielder
      ? (isKeeper(fielder) ? inferredKeeperRating(fielder) : inferredFieldingRating(fielder))
      : 65;
    return clamp(
      0.76 + (rating - 60) * 0.0055 - (isPartTimeKeeper(fielder) ? 0.045 : 0),
      0.72,
      0.94,
    );
  }
  if (wicket.kind === "stumped") {
    return clamp(
      0.82
      + (inferredKeeperRating(fielder) - 60) * 0.0055
      - (isPartTimeKeeper(fielder) ? 0.055 : 0),
      0.74,
      0.96,
    );
  }
  if (wicket.kind === "run-out") {
    const rating = fielder ? inferredFieldingRating(fielder) : 65;
    return clamp(0.70 + (rating - 60) * 0.005, 0.68, 0.9);
  }
  return 1;
}

function chooseDismissal(
  striker: Player,
  bowler: Player,
  fieldingIds: readonly string[],
  wicketkeeper: Player | undefined,
  players: Record<string, Player>,
  runningPressure: number,
  rng: SimulationRandom,
): DeliveryWicket {
  const kind = rng.weighted<DismissalKind>([
    { value: "caught", weight: 52 },
    { value: "bowled", weight: isPacer(bowler) ? 18 : 13 },
    { value: "lbw", weight: isPacer(bowler) ? 14 : 16 },
    { value: "run-out", weight: 7 * (1 + runningPressure * 0.2) },
    { value: "stumped", weight: isSpinner(bowler) ? 7 : 0.8 },
    { value: "hit-wicket", weight: 0.025 },
  ]);
  const fielder = kind === "caught"
    ? selectFielder(fieldingIds, players, rng)
    : kind === "stumped"
      // Preserve the established seeded random stream without allowing this
      // draw to re-select the keeper during the innings.
      ? (wicketkeeper ? (rng.next(), wicketkeeper) : undefined)
      : kind === "run-out"
        ? selectFielder(fieldingIds, players, rng)
        : undefined;
  return {
    playerId: striker.id,
    playerName: striker.name,
    kind,
    bowlerCredited: kind !== "run-out",
    fielderId: fielder?.id,
    fielderName: fielder?.name,
  };
}

function dismissalText(wicket: DeliveryWicket, bowler: Player): string {
  if (wicket.kind === "caught") {
    return `c ${wicket.fielderName ?? "fielder"} b ${bowler.name}`;
  }
  if (wicket.kind === "stumped") {
    return `st ${wicket.fielderName ?? "wicketkeeper"} b ${bowler.name}`;
  }
  if (wicket.kind === "run-out") {
    return `run out (${wicket.fielderName ?? "fielder"})`;
  }
  if (wicket.kind === "bowled") return `b ${bowler.name}`;
  if (wicket.kind === "lbw") return `lbw b ${bowler.name}`;
  return `hit wicket b ${bowler.name}`;
}

function sampleBatRuns(
  rng: SimulationRandom,
  scoringFactor: number,
  intent: number,
  conditions: MatchGroundConditions,
  isPureBowler: boolean = false,
  boundaryOpportunityMultiplier: number = 1,
  rotationMultiplier: number = 1,
  singleOpportunityMultiplier: number = 1,
): number {
  let boundaryFactor = clamp(
    scoringFactor * (1 + intent * 0.75) * boundaryOpportunityMultiplier,
    0.55,
    1.9,
  );
  let dotFactor = clamp(1 / (scoringFactor * (1 + intent * 0.25)), 0.6, 1.65);

  if (isPureBowler) {
    boundaryFactor *= 0.48; // Pure bowlers hit ~50% fewer boundaries
    dotFactor *= 1.35; // Pure bowlers face ~35% more dot balls
  }

  const averageBoundary = (
    conditions.boundaries.straightMetres
    + conditions.boundaries.wideMetres
  ) / 2;
  const runningPressure = groundRunningPressure(conditions);
  const threeRunFactor = 1 + runningPressure * 3;
  const twoRunMultiplier = 1 + runningPressure * 0.12;

  return rng.weighted([
    { value: 0, weight: 0.34 * dotFactor },
    { value: 1, weight: 0.37 * rotationMultiplier * singleOpportunityMultiplier },
    { value: 2, weight: 0.09 * rotationMultiplier * twoRunMultiplier * clamp(1.05 - conditions.outfieldSpeedRating * 0.02, 0.82, 1.05) },
    { value: 3, weight: 0.0035 * threeRunFactor },
    { value: 4, weight: 0.14 * boundaryFactor * clamp(conditions.outfieldSpeedRating / 7.5, 0.72, 1.25) },
    { value: 6, weight: 0.052 * boundaryFactor ** 1.35 * clamp(69 / averageBoundary, 0.8, 1.3) },
  ]);
}

function getPlayerPotentialRealization(playerId?: string, seed?: string): number {
  if (!playerId) return 0.45;
  const seasonKey = seed ? seed.split(":")[0] : "2026";
  const hashStr = `${seasonKey}:${playerId}:potential_realization_v3`;
  let hash = 0;
  for (let i = 0; i < hashStr.length; i++) {
    hash = (hash << 5) - hash + hashStr.charCodeAt(i);
    hash |= 0;
  }
  
  const norm = (Math.abs(hash) % 10000) / 10000;
  
  // 22% chance of Breakout/Boom season: realization multiplier between 0.80 and 1.25 (strong annual step)
  if (norm < 0.22) {
    return 0.80 + ((Math.abs(hash >> 3) % 10000) / 10000) * 0.45;
  }
  // 20% chance of Stagnation/Bust season: realization multiplier between -0.10 and 0.25 (minimal/zero annual growth)
  if (norm > 0.80) {
    return -0.10 + ((Math.abs(hash >> 3) % 10000) / 10000) * 0.35;
  }
  // 58% chance of Steady progress season: realization multiplier between 0.35 and 0.75
  return 0.35 + ((Math.abs(hash >> 3) % 10000) / 10000) * 0.40;
}

export function getEffectiveBattingRating(
  player: { id?: string; age: number; currentBatting: number; potentialBatting?: number },
  rng?: SimulationRandom,
  seed?: string,
): number {
  let rating = player.currentBatting;
  const potential = player.potentialBatting ?? rating;
  const gap = potential - rating;

  if (gap > 0 && player.age <= 25) {
    // Multi-year age factor (younger players progress in measured annual steps over 4-7+ seasons)
    const ageFactor = player.age <= 20 ? 0.25 : player.age <= 22 ? 0.22 : 0.18;
    const baseAnnualStep = gap * ageFactor;

    // Seasonal realization multiplier (Boom / Steady / Bust)
    const realizationMultiplier = getPlayerPotentialRealization(player.id, seed);
    const seasonBoost = baseAnnualStep * realizationMultiplier;
    rating += Math.max(-0.5, Math.min(3.5, seasonBoost));

    // Match-level performance flash (occasional match-day upside burst)
    if (rng && realizationMultiplier > 0) {
      const flashRoll = rng.next();
      if (flashRoll < 0.18) {
        const flashAmount = 1.0 + rng.next() * 1.5;
        rating += Math.min(flashAmount, Math.max(0, potential - rating));
      }
    }
  }

  return rating;
}

export function getEffectiveBowlingRating(
  player: { id?: string; age: number; currentBowling: number; potentialBowling?: number },
  rng?: SimulationRandom,
  seed?: string,
): number {
  let rating = player.currentBowling;
  const potential = player.potentialBowling ?? rating;
  const gap = potential - rating;

  if (gap > 0 && player.age <= 25) {
    const ageFactor = player.age <= 20 ? 0.25 : player.age <= 22 ? 0.22 : 0.18;
    const baseAnnualStep = gap * ageFactor;

    const realizationMultiplier = getPlayerPotentialRealization(player.id, seed);
    const seasonBoost = baseAnnualStep * realizationMultiplier;
    rating += Math.max(-0.5, Math.min(3.5, seasonBoost));

    if (rng && realizationMultiplier > 0) {
      const flashRoll = rng.next();
      if (flashRoll < 0.18) {
        const flashAmount = 1.0 + rng.next() * 1.5;
        rating += Math.min(flashAmount, Math.max(0, potential - rating));
      }
    }
  }

  return rating;
}

function createPlayerLuck(
  playerIds: readonly string[],
  players: Record<string, Player>,
  formAdjustments: Record<string, number>,
  rng: SimulationRandom,
  seed?: string,
): Map<string, number> {
  const seasonKey = seed ? seed.split(":")[0] : "";
  return new Map(playerIds.map((playerId) => {
    const player = players[playerId];
    if (!player) return [playerId, 0];
    const ageConsistency = player.age >= 25 && player.age <= 33 ? 0.85 : 1.15;
    
    // Seasonal form offset (deterministic per season key + player ID)
    let seasonalForm = 0;
    if (seasonKey) {
      const hashStr = `${seasonKey}:${playerId}:season_form_v2`;
      let hash = 0;
      for (let i = 0; i < hashStr.length; i++) {
        hash = (hash << 5) - hash + hashStr.charCodeAt(i);
        hash |= 0;
      }
      const u1 = Math.max(0.0001, (Math.abs(hash) % 10000) / 10000);
      const u2 = Math.max(0.0001, (Math.abs(hash >> 3) % 10000) / 10000);
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      seasonalForm = Math.max(-7.5, Math.min(7.5, z * 3.0));
    }

    const standardDeviation = clamp(3.4 * ageConsistency, 1.8, 4.5);
    const matchLuck = rng.gaussian() * standardDeviation;
    const totalLuck = clamp(matchLuck + seasonalForm + (formAdjustments[playerId] ?? 0), -11, 11);
    return [playerId, totalLuck];
  }));
}

export function derivePlayerFormAdjustments(
  recentScorecards: Array<{
    inningsA?: {
      batting: Array<{ id: string; runs: number; balls: number }>;
      bowling: Array<{ id: string; overs: number; runsConceded: number; wickets: number }>;
    };
    inningsB?: {
      batting: Array<{ id: string; runs: number; balls: number }>;
      bowling: Array<{ id: string; overs: number; runsConceded: number; wickets: number }>;
    };
  }>,
): Record<string, number> {
  const playerBattingScores = new Map<string, Array<{ runs: number; balls: number }>>();
  const playerBowlingScores = new Map<string, Array<{ overs: number; runsConceded: number; wickets: number }>>();

  recentScorecards.forEach((match) => {
    [match.inningsA, match.inningsB].forEach((innings) => {
      if (!innings) return;
      innings.batting?.forEach((b) => {
        if (!playerBattingScores.has(b.id)) playerBattingScores.set(b.id, []);
        playerBattingScores.get(b.id)!.push({ runs: b.runs ?? 0, balls: b.balls ?? 0 });
      });
      innings.bowling?.forEach((bw) => {
        if (!playerBowlingScores.has(bw.id)) playerBowlingScores.set(bw.id, []);
        playerBowlingScores.get(bw.id)!.push({ overs: bw.overs ?? 0, runsConceded: bw.runsConceded ?? 0, wickets: bw.wickets ?? 0 });
      });
    });
  });

  const adjustments: Record<string, number> = {};

  playerBattingScores.forEach((performances, playerId) => {
    const recent = performances.slice(-3);
    if (recent.length === 0) return;

    let hotCount = 0;
    let coldCount = 0;

    recent.forEach((p) => {
      if (p.runs >= 40 || (p.runs >= 25 && p.balls > 0 && (p.runs / p.balls) >= 1.6)) {
        hotCount += 1;
      } else if (p.balls >= 5 && p.runs < 10) {
        coldCount += 1;
      }
    });

    let mod = 0;
    if (hotCount >= 2) mod += 3.5;
    else if (coldCount >= 2) mod -= 3.5;

    adjustments[playerId] = (adjustments[playerId] ?? 0) + mod;
  });

  playerBowlingScores.forEach((performances, playerId) => {
    const recent = performances.slice(-3);
    if (recent.length === 0) return;

    let hotCount = 0;
    let coldCount = 0;

    recent.forEach((p) => {
      const econ = p.overs > 0 ? p.runsConceded / p.overs : 99;
      if (p.wickets >= 2 || (p.overs >= 2 && econ <= 6.5)) {
        hotCount += 1;
      } else if (p.overs >= 2 && econ >= 10.5 && p.wickets === 0) {
        coldCount += 1;
      }
    });

    let mod = 0;
    if (hotCount >= 2) mod += 3.5;
    else if (coldCount >= 2) mod -= 3.5;

    adjustments[playerId] = clamp((adjustments[playerId] ?? 0) + mod, -6.0, 6.0);
  });

  return adjustments;
}

function shouldUseCollapseBatter(
  legalBalls: number,
  runs: number,
  wickets: number,
): boolean {
  return (
    (legalBalls <= 48 && wickets >= 4 && runs < 58)
    || (legalBalls <= 72 && wickets >= 5 && runs < 85)
    || (legalBalls <= 90 && wickets >= 6 && runs < 115)
  );
}

export function selectCollapseImpactOutgoingPlayer(
  battingOrder: readonly string[],
  nextBatterIndex: number,
  dismissedPlayerIds: ReadonlySet<string>,
  players: Record<string, Player>,
  captainId?: string | null,
  viceCaptainId?: string | null,
): Player | null {
  const orderedPlayers = battingOrder
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player));
  const primaryKeeper = orderedPlayers.find((player) => (
    player.role === "WK-Batsman" || player.isWicketkeeper
  )) ?? orderedPlayers.find((player) => player.isPartTimeWk);

  return battingOrder
    // A collapse replacement comes from a player whose batting position is
    // already above the incoming batter. It never sacrifices an unused bowler.
    .slice(0, nextBatterIndex)
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(
      player
      && dismissedPlayerIds.has(player.id)
      && player.id !== captainId
      && player.id !== viceCaptainId
      && player.id !== primaryKeeper?.id
      && player.role !== "Pace Bowler"
      && player.role !== "Spin Bowler"
      && (
        player.role !== "All-Rounder"
        || player.currentBowling < 70
      )
    ))
    .sort((left, right) => (
      left.currentBatting - right.currentBatting
      || left.currentBowling - right.currentBowling
    ))[0] ?? null;
}

function activateCollapseImpact(
  teamState: ActiveTeamState,
  nextBatterIndex: number,
  dismissedPlayerIds: ReadonlySet<string>,
  players: Record<string, Player>,
): { incomingId: string; outgoingId: string } | null {
  if (teamState.impactUsed) return null;
  const startingSet = new Set(teamState.startingXI);
  const legalCandidates = teamState.plan.impactSubs
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(
      player
      && !startingSet.has(player.id)
      && player.currentBatting >= 65,
    ))
    .sort((left, right) => (
      right.currentBatting - left.currentBatting
      || right.currentBowling - left.currentBowling
    ));
  const preferredOutgoing = selectCollapseImpactOutgoingPlayer(
    teamState.battingOrder,
    nextBatterIndex,
    dismissedPlayerIds,
    players,
    teamState.plan.captainId,
    teamState.plan.viceCaptainId,
  );
  const outgoingCandidates = preferredOutgoing ? [preferredOutgoing] : [];
  const pairing = legalCandidates
    .map((incoming) => ({
      incoming,
      outgoing: outgoingCandidates.find((outgoing) => (
        isLegalImpactSwap(teamState, incoming, outgoing, players)
      )),
    }))
    .find((candidate) => candidate.outgoing);
  const incoming = pairing?.incoming;
  const outgoing = pairing?.outgoing;
  if (!incoming || !outgoing || incoming.currentBatting <= outgoing.currentBatting + 5) return null;

  // The outgoing player has already batted, so retain their historical
  // scorecard position and insert the Impact Player as the next batter.
  teamState.battingOrder.splice(nextBatterIndex, 0, incoming.id);
  teamState.finalXI = teamState.finalXI
    .filter((playerId) => playerId !== outgoing.id);
  teamState.finalXI.push(incoming.id);
  teamState.impactUsed = true;
  teamState.impactDecision = {
    teamId: teamState.team.id,
    used: true,
    incomingPlayerId: incoming.id,
    incomingPlayerName: incoming.name,
    outgoingPlayerId: outgoing.id,
    outgoingPlayerName: outgoing.name,
    battingPosition: nextBatterIndex + 1,
    reason: "collapse-recovery",
    explanation: `${incoming.name} was introduced after a batting collapse, replacing the dismissed ${outgoing.name} without removing a bowler from the remaining lineup.`,
  };
  return { incomingId: incoming.id, outgoingId: outgoing.id };
}

function activateStandardBatFirstImpact(
  teamState: ActiveTeamState,
  players: Record<string, Player>,
): void {
  if (teamState.impactUsed) return;
  const startingSet = new Set(teamState.startingXI);
  const candidates = teamState.plan.impactSubs
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(
      player
      && !startingSet.has(player.id)
      && isBowlingOption(player),
    ));
  const planned = candidates.find((player) => player.id === teamState.plan.plannedImpactPlayerId);
  const rankedIncoming = [
    ...(planned ? [planned] : []),
    ...[...candidates]
      .filter((player) => player.id !== planned?.id)
      .sort((left, right) => (
    right.currentBowling - left.currentBowling
    || right.currentBatting - left.currentBatting
      )),
  ];
  if (rankedIncoming.length === 0) return;

  const plannedOutgoing = teamState.plan.plannedOutgoingPlayerId
    ? players[teamState.plan.plannedOutgoingPlayerId]
    : undefined;
  const outgoingCandidates = teamState.finalXI
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player));
  const preferredOutgoing = plannedOutgoing && teamState.finalXI.includes(plannedOutgoing.id)
    ? plannedOutgoing
    : selectBattingFirstOutgoingBatter(
        outgoingCandidates,
        new Set([
          teamState.plan.captainId,
          teamState.plan.viceCaptainId,
        ].filter((playerId): playerId is string => Boolean(playerId))),
      );
  const pairing = rankedIncoming
    .map((incoming) => ({
      incoming,
      outgoing: preferredOutgoing && isLegalImpactSwap(teamState, incoming, preferredOutgoing, players)
        ? preferredOutgoing
        : selectBattingFirstOutgoingBatter(
            outgoingCandidates,
            new Set([
              teamState.plan.captainId,
              teamState.plan.viceCaptainId,
              ...outgoingCandidates
                .filter((outgoing) => !isLegalImpactSwap(teamState, incoming, outgoing, players))
                .map((outgoing) => outgoing.id),
            ].filter((playerId): playerId is string => Boolean(playerId))),
          ),
    }))
    .find((candidate) => candidate.outgoing);
  const incoming = pairing?.incoming;
  const outgoing = pairing?.outgoing;
  if (!incoming || !outgoing) return;

  teamState.finalXI = teamState.finalXI
    .filter((playerId) => playerId !== outgoing.id);
  teamState.finalXI.push(incoming.id);
  teamState.impactUsed = true;
  teamState.impactDecision = {
    teamId: teamState.team.id,
    used: true,
    incomingPlayerId: incoming.id,
    incomingPlayerName: incoming.name,
    outgoingPlayerId: outgoing.id,
    outgoingPlayerName: outgoing.name,
    reason: planned ? "planned-bowling" : "best-available",
    explanation: `${incoming.name} replaced ${outgoing.name} to strengthen the bowling attack for the second innings.`,
  };
}

function activateBowlFirstImpact(
  teamState: ActiveTeamState,
  target: number,
  conditions: MatchGroundConditions,
  players: Record<string, Player>,
): void {
  if (teamState.impactUsed) return;
  const startingSet = new Set(teamState.startingXI);
  const candidates = teamState.plan.impactSubs
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(
      player
      && !startingSet.has(player.id)
      && player.currentBatting >= 55,
    ))
    .sort((left, right) => (
      right.currentBatting - left.currentBatting
      || right.currentBowling - left.currentBowling
    ));
  const planned = candidates.find((player) => player.id === teamState.plan.plannedImpactPlayerId);
  const best = candidates[0];
  if (!best) return;
  const centre = (
    conditions.adjustedExpectedScore.min
    + conditions.adjustedExpectedScore.max
  ) / 2;
  const highTarget = target >= centre + 18 || target / 20 >= 10;
  const preferredIncoming = (
    highTarget
    && planned
    && best.currentBatting >= planned.currentBatting + 3
  ) ? best : planned ?? best;

  const keepers = teamState.finalXI
    .map((playerId) => players[playerId])
    .filter(isKeeper);
  const eligibleOutgoing = teamState.finalXI
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(
      player
      && player.id !== teamState.plan.captainId
      && player.id !== teamState.plan.viceCaptainId
      && !(isKeeper(player) && keepers.length <= 1),
    ));
  const plannedOutgoing = eligibleOutgoing.find((player) => (
    player.id === teamState.plan.plannedOutgoingPlayerId
  ));
  const rankedOutgoing = [
    ...(plannedOutgoing ? [plannedOutgoing] : []),
    ...[...eligibleOutgoing]
      .filter((player) => player.id !== plannedOutgoing?.id)
      .sort((left, right) => (
    left.currentBatting - right.currentBatting
    || right.currentBowling - left.currentBowling
      )),
  ];
  const rankedIncoming = [
    preferredIncoming,
    ...candidates.filter((player) => player.id !== preferredIncoming.id),
  ];
  const pairing = rankedIncoming
    .map((incoming) => ({
      incoming,
      outgoing: rankedOutgoing.find((outgoing) => (
        isLegalImpactSwap(teamState, incoming, outgoing, players)
      )),
    }))
    .find((candidate) => candidate.outgoing);
  const incoming = pairing?.incoming;
  const outgoing = pairing?.outgoing;
  if (!incoming || !outgoing) return;

  const outgoingPosition = teamState.battingOrder.indexOf(outgoing.id);
  if (outgoingPosition >= 0) teamState.battingOrder.splice(outgoingPosition, 1);
  const requestedPosition = teamState.plan.plannedImpactBattingPosition;
  const insertionIndex = typeof requestedPosition === "number"
    ? clamp(Math.round(requestedPosition) - 1, 0, teamState.battingOrder.length)
    : incoming.isOpener
      ? Math.min(1, teamState.battingOrder.length)
      : clamp(outgoingPosition, 2, Math.min(7, teamState.battingOrder.length));
  teamState.battingOrder.splice(insertionIndex, 0, incoming.id);
  teamState.finalXI = teamState.finalXI.filter((playerId) => playerId !== outgoing.id);
  teamState.finalXI.push(incoming.id);
  teamState.impactUsed = true;
  teamState.impactDecision = {
    teamId: teamState.team.id,
    used: true,
    incomingPlayerId: incoming.id,
    incomingPlayerName: incoming.name,
    outgoingPlayerId: outgoing.id,
    outgoingPlayerName: outgoing.name,
    battingPosition: insertionIndex + 1,
    reason: incoming.id === planned?.id
      ? "planned-batting"
      : highTarget
        ? "high-target-adaptation"
        : "best-available",
    explanation: incoming.id === planned?.id
      ? `${incoming.name} entered at number ${insertionIndex + 1}, following the pre-match batting Impact plan.`
      : `${incoming.name} was selected as the strongest available batting option for a target of ${target}.`,
  };
}

export function isNightMatch(time?: string): boolean {
  if (!time) return true;
  const t = time.toLowerCase();
  return t.includes("19") || t.includes("20") || t.includes("7:") || t.includes("8:") || t.includes("pm");
}

export function isAfternoonMatch(time?: string): boolean {
  if (!time) return false;
  const t = time.toLowerCase();
  return t.includes("15") || t.includes("14") || t.includes("3:") || t.includes("4:");
}

// Official ICC DLS Standard Resource Percentages (R2/R1) for 20-over T20 matches (5 to 20 overs)
const DLS_T20_RESOURCES: Record<number, number> = {
  20: 100.0,
  19: 96.8,
  18: 93.4,
  17: 89.8,
  16: 86.0,
  15: 82.0,
  14: 77.8,
  13: 73.3,
  12: 68.6,
  11: 63.7,
  10: 58.4,
  9:  53.0,
  8:  47.3,
  7:  41.3,
  6:  35.0,
  5:  28.4,
};

export function calculateDLSRevisedTarget(firstInningsRuns: number, oversAvailable: number): number {
  if (oversAvailable >= 20) return firstInningsRuns + 1;
  const clampedOvers = Math.max(5, Math.min(19, Math.floor(oversAvailable)));
  const resourcePct = (DLS_T20_RESOURCES[clampedOvers] ?? 100.0) / 100.0;
  
  // ICC Standard DLS Formula: Target = floor(FirstInningsRuns * (R2 / R1)) + 1
  const revisedTarget = Math.floor(firstInningsRuns * resourcePct) + 1;
  return Math.max(1, revisedTarget);
}

function simulateInnings(context: InningsContext): MatchInnings {
  const {
    batting,
    bowling,
    players,
    rng,
    conditions,
    target,
  } = context;
  const isNight = isNightMatch(context.time);
  const isAfternoon = isAfternoonMatch(context.time);
  const allParticipantIds = Array.from(new Set([
    ...batting.battingOrder,
    ...bowling.finalXI,
    ...batting.plan.impactSubs,
  ]));
  const playerLuck = createPlayerLuck(
    allParticipantIds,
    players,
    context.formAdjustments,
    rng,
    context.seed,
  );
  const battingEntries = new Map<string, MutableBattingEntry>();
  const ensureBattingEntry = (playerId: string) => {
    if (!battingEntries.has(playerId)) {
      const position = batting.battingOrder.indexOf(playerId) + 1;
      battingEntries.set(playerId, {
        id: playerId,
        name: players[playerId]?.name ?? playerId,
        battingPosition: position > 0 ? position : battingEntries.size + 1,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        dismissal: "did not bat",
        notOut: true,
        didNotBat: true,
      });
    }
    return battingEntries.get(playerId)!;
  };
  batting.battingOrder.forEach(ensureBattingEntry);

  const bowlingEntries = new Map<string, MutableBowlingEntry>();
  const ensureBowlingEntry = (playerId: string) => {
    if (!bowlingEntries.has(playerId)) {
      bowlingEntries.set(playerId, {
        id: playerId,
        name: players[playerId]?.name ?? playerId,
        balls: 0,
        overs: 0,
        maidens: 0,
        runsConceded: 0,
        wickets: 0,
        wides: 0,
        noBalls: 0,
      });
    }
    return bowlingEntries.get(playerId)!;
  };

  let strikerId = batting.battingOrder[0];
  let nonStrikerId = batting.battingOrder[1];
  let nextBatterIndex = 2;
  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;
  let previousBowlerId: string | null = null;
  const bowlerUnavailableUntilOver = new Map<string, number>();
  const lastOverByBowler = new Map<string, number>();
  const spellOversByBowler = new Map<string, number>();
  let deliverySequence = 0;
  let collapsePressureBalls = 0;
  let consecutiveDotBalls = 0;
  let freeHitPending = false;
  let boundaryByeEvents = 0;
  let partnershipStartRuns = 0;
  let partnershipStartBalls = 0;
  let partnershipBatterIds = [strikerId, nonStrikerId];
  let partnershipStartBatterRuns = new Map(partnershipBatterIds.map((playerId) => [playerId, ensureBattingEntry(playerId).runs]));
  let partnershipStartBatterBalls = new Map(partnershipBatterIds.map((playerId) => [playerId, ensureBattingEntry(playerId).balls]));
  const extras: InningsExtras = {
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    total: 0,
  };
  const oversDetail: MatchOver[] = [];
  const fallOfWickets: FallOfWicket[] = [];
  const partnerships: MatchPartnership[] = [];
  const expectedCentre = (
    conditions.adjustedExpectedScore.min
    + conditions.adjustedExpectedScore.max
  ) / 2;
  const fielders = bowling.finalXI
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player));
  const fieldingRating = fielders.reduce(
    (sum, player) => sum + inferredFieldingRating(player),
    0,
  ) / Math.max(1, fielders.length);
  // The nominated keeper is fixed for the entire innings. A full-time keeper
  // takes precedence over a part-time option, regardless of XI ordering.
  const wicketkeeper = selectInningsWicketkeeper(bowling.finalXI, players);
  const keeperRating = inferredKeeperRating(wicketkeeper);
  const partTimeKeeperPenalty = isPartTimeKeeper(wicketkeeper) ? 0.004 : 0;
  const fieldingCaptain = bowling.plan.captainId
    ? players[bowling.plan.captainId]
    : undefined;
  const captaincyRating = fieldingCaptain?.captaincy ?? 50;
  const isKnockoutMatch = Boolean(
    context.isKnockout
    || (context.stage && ["qualifier1", "eliminator", "qualifier2", "final"].some((s) => context.stage?.toLowerCase().includes(s)))
  );
  let bowlingMomentumDeliveries = 0;

  let inningsEnvironment = clamp(
    1 + rng.gaussian() * 0.045,
    0.88,
    1.14,
  );
  const tailRoll = rng.next();
  if (tailRoll < 0.012) inningsEnvironment *= 0.76;
  if (tailRoll > 0.98 && expectedCentre >= 195) inningsEnvironment *= 1.28;

  while (
    legalBalls < 120
    && wickets < 10
    && strikerId
    && nonStrikerId
    && (!target || runs < target)
  ) {
    const overNumber = Math.floor(legalBalls / 6) + 1;
    const bowler = chooseBowler(
      overNumber,
      bowling.finalXI,
      players,
      new Map(Array.from(bowlingEntries.entries()).map(([id, entry]) => [id, entry.balls])),
      previousBowlerId,
      context.bowlingTactics,
      conditions.pitch,
      captaincyRating,
      bowlerUnavailableUntilOver,
      rng,
    );
    const spellOverNumber = nextBowlerSpellOver(
      overNumber,
      lastOverByBowler.get(bowler.id),
      spellOversByBowler.get(bowler.id) ?? 0,
    );
    lastOverByBowler.set(bowler.id, overNumber);
    spellOversByBowler.set(bowler.id, spellOverNumber);
    const fourthSpellOverFatigue = spellOverNumber >= 4 ? 2.5 : 0;
    const bowlerEntry = ensureBowlingEntry(bowler.id);
    const overStartRuns = runs;
    const overStartWickets = wickets;
    const overDeliveries: MatchDelivery[] = [];
    const overBatterIds = new Set<string>();
    let legalBallsThisOver = 0;
    let deliveryInOver = 0;

    while (
      legalBallsThisOver < 6
      && legalBalls < 120
      && wickets < 10
      && strikerId
      && nonStrikerId
      && (!target || runs < target)
    ) {
      deliverySequence += 1;
      deliveryInOver += 1;
      const striker = players[strikerId];
      const nonStriker = players[nonStrikerId];
      if (!striker || !nonStriker) break;
      overBatterIds.add(striker.id);
      const strikerEntry = ensureBattingEntry(striker.id);
      strikerEntry.didNotBat = false;
      strikerEntry.dismissal = "not out";
      const extrasForBall = emptyExtras();
      const displayLegalBall = legalBallsThisOver + 1;
      const displayBall = `${overNumber - 1}.${displayLegalBall}`;

      const isDewActive = context.inningsNumber === 2 && isNight && overNumber >= 10;
      const dewBowlerPenalty = isDewActive ? (bowler.role === "Spin Bowler" ? -2.5 : -1.2) : 0;
      const heatBowlerPenalty = isAfternoon && spellOverNumber >= 2 ? -1.5 : 0;
      const heatBatterPenalty = isAfternoon && strikerEntry.balls >= 35 ? -1.5 : 0;

      const momentumWicketModifier = bowlingMomentumDeliveries > 0 ? 0.012 : 0;
      const momentumBowlerBoost = bowlingMomentumDeliveries > 0 ? 2.0 : 0;
      if (bowlingMomentumDeliveries > 0) bowlingMomentumDeliveries -= 1;

      const bowlerClutch = isKnockoutMatch && (bowler.reputation ?? 5) >= 9 ? 1.8 : 0;
      const bowlerNerves = isKnockoutMatch && (bowler.age <= 23 || (bowler.reputation ?? 5) <= 5) ? -1.2 : 0;

      const bowlingRating = (
        getEffectiveBowlingRating(bowler, rng, context.seed)
        + (playerLuck.get(bowler.id) ?? 0)
        + bowlingPitchAdjustment(bowler, conditions.pitch)
        - fourthSpellOverFatigue
        - powerplayAllRounderFatigue(
          context.priorBattingBalls?.[bowler.id] ?? 0,
          overNumber,
          bowler.role === "All-Rounder",
        )
        + bowlerClutch
        + bowlerNerves
        + momentumBowlerBoost
        + dewBowlerPenalty
        + heatBowlerPenalty
      );
      const battingPosition = batting.battingOrder.indexOf(striker.id) + 1;
      const setBonus = clamp((strikerEntry.balls - 8) * 0.12, 0, 3.5);
      const strikerClutch = isKnockoutMatch && (striker.reputation ?? 5) >= 9 ? 1.8 : 0;
      const strikerNerves = isKnockoutMatch && (striker.age <= 23 || (striker.reputation ?? 5) <= 5) ? -1.2 : 0;

      const battingRating = (
        getEffectiveBattingRating(striker, rng, context.seed)
        + (playerLuck.get(striker.id) ?? 0)
        + battingPitchAdjustment(striker, conditions.pitch)
        + setBonus
        - playerPositionPenalty(striker, battingPosition)
        + strikerClutch
        + strikerNerves
        + heatBatterPenalty
      );
      const intent = battingIntent(
        context.tactics,
        overNumber,
        wickets,
        runs,
        target,
      ) + bowlerRespectIntentAdjustment(battingRating, bowlingRating);
      const tacticalBowling = bowlingTacticalAdjustment(
        context.bowlingTactics,
        overNumber,
        bowler,
        chooseSituationalField(
          context.bowlingTactics.bowling.field,
          overNumber,
          wickets,
          runs,
          target,
        ),
      );
      const closeDeathChase = Boolean(
        target
        && overNumber >= 16
        && target - runs <= 50
      );
      const extrasPressure = deathExtrasPressure(
        overNumber,
        bowlingRating,
        inferredPressureComposure(bowler),
        closeDeathChase,
      );
      const wideProbability = clamp(
        0.015 + (75 - bowlingRating) * 0.00045 + extrasPressure.wideIncrease,
        0.009,
        0.039,
      );
      const noBallProbability = clamp(
        0.005 + (72 - bowlingRating) * 0.00024 + extrasPressure.noBallIncrease,
        0.003,
        0.018,
      );
      const outcomeRoll = rng.next();
      const isFreeHit = freeHitPending;
      let isLegal = true;
      let runsOffBat = 0;
      let wicket: DeliveryWicket | undefined;
      let fieldingEvent: DeliveryFieldingEvent | undefined;

      if (outcomeRoll < wideProbability) {
        isLegal = false;
        extrasForBall.wides = rng.weighted([
          { value: 1, weight: 94 },
          { value: 2, weight: 4 },
          { value: 3, weight: 1 },
          { value: 5, weight: 1 },
        ]);
      } else {
        const isNoBall = outcomeRoll < wideProbability + noBallProbability;
        if (isNoBall) {
          isLegal = false;
          extrasForBall.noBalls = 1;
        }
        strikerEntry.balls += 1;

        const skillDelta = battingRating - bowlingRating;
        const isPowerplay = overNumber <= 6;
        const isMiddleOvers = overNumber >= 7 && overNumber <= 15;
        const isDeathOvers = overNumber >= 16;

        let phaseRunModifier = 1.0;
        let phaseWicketModifier = 0.0;

        if (isPowerplay) {
          if (striker.isOpener || striker.hasBattedAt3 || battingPosition <= 3) {
            phaseRunModifier += 0.035;
          }
          if (overNumber <= 3 && bowler.role === "Pace Bowler") {
            phaseWicketModifier += 0.004;
          }
        } else if (isMiddleOvers) {
          if (bowler.role === "Spin Bowler" && (conditions.pitch.favours.includes("spin-bowlers") || conditions.pitch.type === "turner")) {
            phaseWicketModifier += 0.003;
          }
        } else if (isDeathOvers) {
          if (striker.isFinisher || striker.currentBatting >= 82) {
            phaseRunModifier += 0.075;
          }
          if (bowler.role === "Pace Bowler" && bowler.currentBowling >= 80) {
            phaseRunModifier -= 0.05;
          }
        }

        const strikerHand = striker.battingStyle ?? "Right-hand";
        const nonStrikerHand = nonStriker.battingStyle ?? "Right-hand";
        const isLeftRightPair = (strikerHand === "Left-hand" && nonStrikerHand === "Right-hand") || (strikerHand === "Right-hand" && nonStrikerHand === "Left-hand");

        let matchupRunModifier = 1.0;
        let matchupWicketModifier = 0.0;

        if (isLeftRightPair) {
          // The changing angle is mildly awkward for a bowling side, but should
          // never outweigh player quality, conditions or tactics.
          matchupRunModifier += 0.01;
        }

        const bowlerHand = bowler.bowlingHand;
        const oppositeHandAngle = Boolean(bowlerHand && bowlerHand !== strikerHand);
        if (isSpinner(bowler) && oppositeHandAngle) {
          matchupWicketModifier += 0.002;
          matchupRunModifier -= 0.008;
        } else if (isPacer(bowler) && oppositeHandAngle) {
          matchupWicketModifier += 0.001;
          matchupRunModifier -= 0.005;
        }

        let rrrRunModifier = 1.0;
        let rrrWicketModifier = 0.0;
        let requiredRunRate = 0;

        if (context.inningsNumber === 2 && target && runs < target) {
          const remainingRuns = Math.max(0, target - runs);
          const remainingBalls = Math.max(1, 120 - legalBalls);
          requiredRunRate = (remainingRuns / (remainingBalls / 6));

          if (requiredRunRate >= 13.0) {
            rrrRunModifier += 0.16;
            rrrWicketModifier += 0.018;
          } else if (requiredRunRate >= 10.0) {
            rrrRunModifier += 0.09;
            rrrWicketModifier += 0.009;
          }
        }

        // Dynamic Pitch Deterioration (Over 40 Overs)
        let deteriorationRunModifier = 1.0;
        let deteriorationWicketModifier = 0.0;
        const isDeterioratingPitch = conditions.pitch.type === "turner" || conditions.pitch.type === "slow" || conditions.pitch.favours.includes("spin-bowlers");

        if (isDeterioratingPitch && context.inningsNumber === 2) {
          const progressRatio = legalBalls / 120;
          deteriorationRunModifier -= progressRatio * 0.06;
          deteriorationWicketModifier += progressRatio * 0.005;
        }

        // Tailender & Bowler Batting Suppression
        const isPureBowler = striker.role === "Pace Bowler" || striker.role === "Spin Bowler";
        const isLowerOrder = isPureBowler || striker.currentBatting < 65 || battingPosition >= 8;

        let tailenderRunModifier = 1.0;
        let tailenderWicketModifier = 0.0;

        if (isPureBowler) {
          const lowBattingDeficit = Math.max(0, 72 - striker.currentBatting);
          tailenderRunModifier -= 0.20 + lowBattingDeficit * 0.005;
          tailenderWicketModifier += 0.014 + lowBattingDeficit * 0.0004;
        } else if (isLowerOrder) {
          const lowBattingDeficit = Math.max(0, 68 - striker.currentBatting);
          const lowerOrderCompetence = clamp((striker.currentBatting - 62) / 18, 0, 1);
          tailenderRunModifier -= (
            0.10 + lowBattingDeficit * 0.003
          ) * (1 - lowerOrderCompetence * 0.65);
          tailenderWicketModifier += 0.007 * (1 - lowerOrderCompetence * 0.70);
        }

        const individualScoreScoringFactor = strikerEntry.runs >= 120
          ? 0.44
          : strikerEntry.runs >= 100
            ? 0.58
            : strikerEntry.runs >= 80
              ? 0.74
              : strikerEntry.runs >= 60
                ? 0.83
                : strikerEntry.runs >= 40
                  ? 0.91
                  : strikerEntry.runs >= 30
                    ? 0.96
                    : 1;
        const ballsRemaining = Math.max(1, 120 - legalBalls);
        const projectedScore = legalBalls > 0
          ? runs / legalBalls * 120
          : expectedCentre;
        const lateBelowPar = (
          ballsRemaining <= 30
          && projectedScore <= expectedCentre - 25
        );
        const battingPressure = clamp(
          (collapsePressureBalls > 0 ? 0.55 : 0)
          + (wickets >= 5 ? 0.25 : 0)
          + (requiredRunRate >= 13 ? 0.65 : requiredRunRate >= 10 ? 0.4 : 0)
          + (isDeathOvers ? 0.2 : 0)
          + (lateBelowPar ? 0.65 : 0),
          0,
          1,
        );
        const remainingRuns = target ? Math.max(0, target - runs) : 0;
        const closeLateDefence = Boolean(
          target
          && ballsRemaining <= 24
          && remainingRuns <= 45,
        );
        const bowlingPressure = clamp(
          (isDeathOvers ? 0.25 : 0)
          + (closeLateDefence ? 0.55 : 0)
          + (target && target <= expectedCentre - 20 ? 0.25 : 0),
          0,
          1,
        );
        const batterComposure = inferredPressureComposure(striker);
        const bowlerComposure = inferredPressureComposure(bowler);
        const pressureRunModifier = (
          1
          + battingPressure * batterComposure * 0.015
          - bowlingPressure * bowlerComposure * 0.012
        );
        const pressureWicketModifier = (
          bowlingPressure * bowlerComposure * 0.003
          - battingPressure * batterComposure * 0.004
        );
        const milestoneScoringFactor = milestonePressureScoringFactor(
          strikerEntry.runs,
          striker.battingAggression ?? 65,
          battingPressure,
        );
        const dotBallPressure = dotBallPressureAdjustment(consecutiveDotBalls);
        const runningPressure = groundRunningPressure(conditions);
        const dewScoringMultiplier = isDewActive ? 1.06 : 1.0;
        const runEnvironment = clamp(
          clamp(expectedCentre / 159, 0.84, 1.16)
          * inningsEnvironment
          * (1 + skillDelta * 0.0075)
          * (1 + context.skillEdge)
          * (1 + context.performanceTilt)
          * individualScoreScoringFactor
          * milestoneScoringFactor
          * phaseRunModifier
          * matchupRunModifier
          * rrrRunModifier
          * deteriorationRunModifier
          * tailenderRunModifier
          * pressureRunModifier
          * dotBallPressure.runMultiplier
          * dewScoringMultiplier
          * (context.inningsNumber === 2
            ? 1 + (conditions.chasingScoringBonus ?? DEFAULT_CHASING_SCORING_BONUS)
            : 1)
          * (1 + tacticalBowling.scoring),
          0.50,
          1.75,
        );
        const easyTargetRelief = target
          ? clamp((expectedCentre - target) / Math.max(1, expectedCentre), 0, 0.45)
          : 0;
        const firstInningsCollapseRelief = target && (context.firstInningsWickets ?? 0) >= 7
          ? clamp(((context.firstInningsWickets ?? 0) - 6) * 0.035, 0, 0.12)
          : 0;
        const chaseCollapseResponse = wickets >= 5
          ? 0
          : wickets >= 3
            ? 0.3
            : wickets >= 2 && overNumber <= 8
              ? 0.6
              : 1;
        const easyChaseWicketRelief = clamp(
          easyTargetRelief + firstInningsCollapseRelief,
          0,
          0.5,
        ) * 0.026 * chaseCollapseResponse;
        const individualScoreWicketPressure = strikerEntry.runs >= 120
          ? 0.075
          : strikerEntry.runs >= 100
            ? 0.045
            : strikerEntry.runs >= 80
              ? 0.018
              : strikerEntry.runs >= 60
                ? 0.012
                : strikerEntry.runs >= 40
                  ? 0.006
                  : strikerEntry.runs >= 30
                    ? 0.0035
                    : 0;
        const battingCaptain = players[batting.plan.captainId ?? ""];
        const battingCaptaincy = battingCaptain?.captaincy ?? 50;
        const captaincyPressureDampener = isKnockoutMatch
          ? 1 - clamp((battingCaptaincy - 65) * 0.005, 0, 0.16)
          : 1;
        const knockoutNervesWicketModifier = isKnockoutMatch
          ? (
              (striker.age <= 23 ? 0.002 : 0)
              + ((striker.reputation ?? 5) <= 5 ? 0.0015 : 0)
            ) * captaincyPressureDampener
          : 0;
        const partnershipSecurity = partnershipWicketReduction(
          legalBalls - partnershipStartBalls,
          runs - partnershipStartRuns,
        );

        const rawRatingDiff = bowlingRating - battingRating;
        const dampedRatingDiff = Math.sign(rawRatingDiff) * Math.pow(Math.abs(rawRatingDiff), 0.82);
        const collapseWicketPressure = collapsePressureBalls > 0
          ? wickets >= 7
            ? 0.004
            : wickets >= 5
              ? 0.008
              : 0.014
          : 0;
        const lowTotalSurvivalRelief = wickets >= 6 && runs < 120
          ? clamp(
              (120 - runs) / 120 * 0.018 + (wickets - 5) * 0.002,
              0,
              0.02,
            )
          : 0;
        const battingAllRounderRelief = isBattingAllRounder(bowler) ? 0.012 : 0;
        const wicketProbability = clamp(
          0.038
          + dampedRatingDiff * 0.00135
          + Math.max(0, intent) * 0.035
          + tacticalBowling.wicket
          + (fieldingRating - 75) * 0.00045
          + collapseWicketPressure
          + phaseWicketModifier
          + matchupWicketModifier
          + rrrWicketModifier * captaincyPressureDampener
          + deteriorationWicketModifier
          + tailenderWicketModifier
          + pressureWicketModifier * captaincyPressureDampener
          + momentumWicketModifier
          + knockoutNervesWicketModifier
          + dotBallPressure.wicketIncrease
          + runningPressure * 0.001
          - Math.max(0, 165 - expectedCentre) * 0.00025
          - easyChaseWicketRelief
          - partnershipSecurity
          - lowTotalSurvivalRelief
          - battingAllRounderRelief
          + individualScoreWicketPressure
          - Math.min(0, intent) * -0.014,
          0.018,
          0.16,
        );

        const effectiveWicketProbability = isFreeHit
          ? 0.002 + runningPressure * 0.001
          : wicketProbability;
        const wicketOutcomeRoll = rng.next();
        if (!isNoBall && wicketOutcomeRoll < effectiveWicketProbability) {
          const wicketChance: DeliveryWicket = isFreeHit
            ? (() => {
                const fielder = selectFielder(bowling.finalXI, players, rng);
                return {
                  playerId: striker.id,
                  playerName: striker.name,
                  kind: "run-out",
                  bowlerCredited: false,
                  fielderId: fielder?.id,
                  fielderName: fielder?.name,
                };
              })()
            : chooseDismissal(
                striker,
                bowler,
                bowling.finalXI,
                wicketkeeper,
                players,
                runningPressure,
                rng,
              );
          // Reuse the wicket-chance roll after normalising it within its range.
          // This keeps fielding resolution independent without perturbing the
          // established scoring random stream with an extra roll on every chance.
          const completionRoll = wicketOutcomeRoll / effectiveWicketProbability;
          if (completionRoll < dismissalCompletionProbability(wicketChance, players)) {
            wicket = wicketChance;
            wickets += 1;
            strikerEntry.notOut = false;
            strikerEntry.dismissalKind = wicket.kind;
            strikerEntry.bowlerId = wicket.bowlerCredited ? bowler.id : undefined;
            strikerEntry.fielderId = wicket.fielderId;
            strikerEntry.dismissal = dismissalText(wicket, bowler);
            if (wicket.bowlerCredited) bowlerEntry.wickets += 1;
            fallOfWickets.push({
              wicket: wickets,
              score: runs,
              legalBall: legalBalls + 1,
              over: displayBall,
              playerId: striker.id,
              playerName: striker.name,
            });
            partnerships.push({
              wicket: wickets,
              batterIds: [...partnershipBatterIds],
              batterNames: partnershipBatterIds.map((playerId) => players[playerId]?.name ?? playerId),
              batterRuns: partnershipBatterIds.map((playerId) => (
                ensureBattingEntry(playerId).runs - (partnershipStartBatterRuns.get(playerId) ?? 0)
              )),
              batterBalls: partnershipBatterIds.map((playerId) => (
                ensureBattingEntry(playerId).balls - (partnershipStartBatterBalls.get(playerId) ?? 0)
              )),
              runs: runs - partnershipStartRuns,
              balls: legalBalls + 1 - partnershipStartBalls,
            });
            collapsePressureBalls = rng.next() < 0.14 ? 10 : Math.max(collapsePressureBalls, 3);
          } else {
            const failedKind = wicketChance.kind === "caught"
              ? "dropped-catch"
              : wicketChance.kind === "run-out"
                ? "missed-run-out"
                : "missed-stumping";
            fieldingEvent = {
              kind: failedKind,
              fielderId: wicketChance.fielderId,
              fielderName: wicketChance.fielderName,
            };
            if (failedKind === "missed-run-out") {
              runsOffBat = 1;
              strikerEntry.runs += 1;
            } else if (failedKind === "missed-stumping") {
              extrasForBall.byes = 1;
            }
          }
        } else {
          const incidentalExtrasRoll = rng.next();
          const byeProbability = clamp(
            0.007 + (72 - keeperRating) * 0.00045 + partTimeKeeperPenalty,
            0.003,
            0.023,
          );
          if (incidentalExtrasRoll < byeProbability) {
            extrasForBall.byes = rng.weighted([
              { value: 1, weight: 78 },
              { value: 2, weight: 19 },
              { value: 4, weight: boundaryByeEvents < 2 ? 3 : 0 },
            ]);
            if (extrasForBall.byes === 4) boundaryByeEvents += 1;
            fieldingEvent = {
              kind: "keeping-error",
              fielderId: wicketkeeper?.id,
              fielderName: wicketkeeper?.name,
            };
          } else if (incidentalExtrasRoll < byeProbability + 0.012) {
            extrasForBall.legByes = rng.next() < 0.84 ? 1 : 2;
          } else {
            const nonStrikerEntry = ensureBattingEntry(nonStriker.id);
            const strikerIsWeak = isPureBowler || striker.currentBatting < 62;
            const nonStrikerIsWeak = (
              nonStriker.role === "Pace Bowler"
              || nonStriker.role === "Spin Bowler"
              || nonStriker.currentBatting < 62
            );
            const strikerIsEstablished = (
              strikerEntry.balls >= 12
              && striker.currentBatting >= 75
            );
            const nonStrikerIsEstablished = (
              nonStrikerEntry.balls >= 12
              && nonStriker.currentBatting >= 75
            );
            runsOffBat = sampleBatRuns(
              rng,
              runEnvironment,
              intent + (isNoBall ? 0.12 : 0),
              conditions,
              isPureBowler,
              (isPowerplay ? POWERPLAY_BOUNDARY_MULTIPLIER : 1)
                * (striker.isFinisher ? FINISHER_BOUNDARY_MULTIPLIER : 1),
              striker.isCoreBatter ? CORE_BATTER_ROTATION_MULTIPLIER : 1,
              strikeFarmSingleMultiplier(
                displayLegalBall,
                strikerIsEstablished,
                nonStrikerIsWeak,
                strikerIsWeak,
                nonStrikerIsEstablished,
              ),
            );
            strikerEntry.runs += runsOffBat;
            if (runsOffBat === 4) strikerEntry.fours += 1;
            if (runsOffBat === 6) strikerEntry.sixes += 1;
            const misfieldProbability = clamp(
              0.018 + (74 - fieldingRating) * 0.0008,
              0.008,
              0.036,
            );
            const nonExtraThreshold = byeProbability + 0.012;
            const misfieldRoll = (
              incidentalExtrasRoll - nonExtraThreshold
            ) / Math.max(0.001, 1 - nonExtraThreshold);
            if (runsOffBat <= 2 && misfieldRoll < misfieldProbability) {
              const fielder = selectFielder(bowling.finalXI, players, rng);
              runsOffBat += 1;
              strikerEntry.runs += 1;
              fieldingEvent = {
                kind: "misfield",
                fielderId: fielder?.id,
                fielderName: fielder?.name,
              };
            }
          }
        }
      }

      const totalRuns = (
        runsOffBat
        + extrasForBall.wides
        + extrasForBall.noBalls
        + extrasForBall.byes
        + extrasForBall.legByes
      );
      runs += totalRuns;
      extras.wides += extrasForBall.wides;
      extras.noBalls += extrasForBall.noBalls;
      extras.byes += extrasForBall.byes;
      extras.legByes += extrasForBall.legByes;
      extras.total += (
        extrasForBall.wides
        + extrasForBall.noBalls
        + extrasForBall.byes
        + extrasForBall.legByes
      );
      bowlerEntry.wides += extrasForBall.wides;
      bowlerEntry.noBalls += extrasForBall.noBalls;
      bowlerEntry.runsConceded += runsOffBat + extrasForBall.wides + extrasForBall.noBalls;
      if (extrasForBall.noBalls > 0) {
        freeHitPending = true;
      } else if (isLegal) {
        freeHitPending = false;
      }
      if (wicket || totalRuns > 0) {
        consecutiveDotBalls = 0;
      } else if (isLegal) {
        consecutiveDotBalls += 1;
      }

      if (isLegal) {
        legalBalls += 1;
        legalBallsThisOver += 1;
        bowlerEntry.balls += 1;
        bowlerEntry.overs = oversFromBalls(bowlerEntry.balls);
        if (collapsePressureBalls > 0) collapsePressureBalls -= 1;
      }

      const resultCode = deliveryResultCode(runsOffBat, extrasForBall, wicket);
      const fieldingComment = fieldingEvent?.kind === "dropped-catch"
        ? ` dropped by ${fieldingEvent.fielderName ?? "the fielder"}`
        : fieldingEvent?.kind === "missed-run-out"
          ? ` missed run-out chance for ${fieldingEvent.fielderName ?? "the fielder"}`
          : fieldingEvent?.kind === "missed-stumping"
            ? ` missed stumping by ${fieldingEvent.fielderName ?? "the wicketkeeper"}`
            : fieldingEvent?.kind === "misfield"
              ? ` misfield by ${fieldingEvent.fielderName ?? "the fielder"}`
              : fieldingEvent?.kind === "keeping-error"
                ? ` wicketkeeping error by ${fieldingEvent.fielderName ?? "the keeper"}`
                : "";
      const freeHitLabel = isFreeHit ? "FREE HIT, " : "";
      const commentary = wicket
        ? `${displayBall} ${bowler.name} to ${striker.name}: ${freeHitLabel}OUT, ${strikerEntry.dismissal}.`
        : `${displayBall} ${bowler.name} to ${striker.name}: ${freeHitLabel}${resultCode === "0" ? "no run" : `${resultCode}, ${totalRuns} run${totalRuns === 1 ? "" : "s"}`}${fieldingComment}.`;
      const delivery: MatchDelivery = {
        id: `${context.inningsNumber}-${deliverySequence}`,
        inningsNumber: context.inningsNumber,
        overNumber,
        deliveryInOver,
        legalBallNumber: legalBalls,
        displayBall,
        strikerId: striker.id,
        strikerName: striker.name,
        nonStrikerId: nonStriker.id,
        nonStrikerName: nonStriker.name,
        bowlerId: bowler.id,
        bowlerName: bowler.name,
        runsOffBat,
        totalRuns,
        extras: extrasForBall,
        isLegal,
        isFreeHit,
        wicket,
        fieldingEvent,
        resultCode,
        commentary,
        scoreAfter: runs,
        wicketsAfter: wickets,
      };
      overDeliveries.push(delivery);

      if (wicket) {
        if (
          context.allowCollapseImpact
          && shouldUseCollapseBatter(legalBalls, runs, wickets)
        ) {
          const impact = activateCollapseImpact(
            batting,
            nextBatterIndex,
            new Set(fallOfWickets.map((fall) => fall.playerId)),
            players,
          );
          if (impact) {
            ensureBattingEntry(impact.incomingId);
          }
        }
        const nextBatterId = batting.battingOrder[nextBatterIndex];
        nextBatterIndex += 1;
        if (nextBatterId) {
          strikerId = nextBatterId;
          ensureBattingEntry(nextBatterId);
          partnershipStartRuns = runs;
          partnershipStartBalls = legalBalls;
          partnershipBatterIds = [strikerId, nonStrikerId];
          partnershipStartBatterRuns = new Map(partnershipBatterIds.map((playerId) => [playerId, ensureBattingEntry(playerId).runs]));
          partnershipStartBatterBalls = new Map(partnershipBatterIds.map((playerId) => [playerId, ensureBattingEntry(playerId).balls]));
        } else {
          strikerId = "";
        }
      } else if ((
        runsOffBat
        + extrasForBall.byes
        + extrasForBall.legByes
        + Math.max(0, extrasForBall.wides - 1)
      ) % 2 === 1) {
        [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
      }

      // A chase ends on the delivery that reaches the target. Terminate here
      // rather than relying on the next loop-condition check, so an over can
      // never emit a trailing delivery after the winning run(s).
      if (target && runs >= target) break;

      if (isLegal && legalBallsThisOver === 6 && strikerId && nonStrikerId) {
        [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
      }
    }

    const overRuns = runs - overStartRuns;
    const overWickets = wickets - overStartWickets;
    if (overRuns === 0 && legalBallsThisOver === 6) bowlerEntry.maidens += 1;
    if (overWickets >= 2 || (overWickets >= 1 && overRuns === 0 && legalBallsThisOver === 6)) {
      bowlingMomentumDeliveries = 12;
    }
    if (legalBallsThisOver === 6 && overRuns >= 14) {
      const baseOversToSitOut = overRuns >= 22 ? 4 : overRuns >= 18 ? 3 : 2;
      const captainReaction = captaincyRating >= 80 && overRuns >= 18 ? 1 : 0;
      const oversToSitOut = Math.min(4, baseOversToSitOut + captainReaction);
      bowlerUnavailableUntilOver.set(bowler.id, overNumber + oversToSitOut + 1);
    }
    oversDetail.push({
      number: overNumber,
      bowlerId: bowler.id,
      bowlerName: bowler.name,
      batterIds: Array.from(overBatterIds),
      batterNames: Array.from(overBatterIds).map((playerId) => players[playerId]?.name ?? playerId),
      deliveries: overDeliveries,
      runs: overRuns,
      wickets: overWickets,
      scoreAfter: runs,
      wicketsAfter: wickets,
    });
    previousBowlerId = bowler.id;
  }

  if (partnershipBatterIds.some(Boolean) && legalBalls > partnershipStartBalls) {
    partnerships.push({
      wicket: wickets + 1,
      batterIds: [...partnershipBatterIds],
      batterNames: partnershipBatterIds.map((playerId) => players[playerId]?.name ?? playerId),
      batterRuns: partnershipBatterIds.map((playerId) => (
        ensureBattingEntry(playerId).runs - (partnershipStartBatterRuns.get(playerId) ?? 0)
      )),
      batterBalls: partnershipBatterIds.map((playerId) => (
        ensureBattingEntry(playerId).balls - (partnershipStartBatterBalls.get(playerId) ?? 0)
      )),
      runs: runs - partnershipStartRuns,
      balls: legalBalls - partnershipStartBalls,
    });
  }

  batting.battingOrder.forEach((playerId, index) => {
    const entry = ensureBattingEntry(playerId);
    entry.battingPosition = index + 1;
    if (!entry.didNotBat && entry.notOut) entry.dismissal = "not out";
  });

  return {
    inningsNumber: context.inningsNumber,
    battingTeamId: batting.team.id,
    bowlingTeamId: bowling.team.id,
    runs,
    wickets,
    legalBalls,
    overs: oversFromBalls(legalBalls),
    target,
    batting: Array.from(battingEntries.values())
      .sort((left, right) => left.battingPosition - right.battingPosition),
    bowling: Array.from(bowlingEntries.values())
      .sort((left, right) => right.balls - left.balls || right.wickets - left.wickets),
    extras,
    oversDetail,
    fallOfWickets,
    partnerships,
  };
}

function playerOfTheMatch(
  innings: readonly MatchInnings[],
  players: Record<string, Player>,
  winnerId: string | null,
  expectedScore: number,
): Player {
  const scores = new Map<string, number>();
  const playerTeams = new Map<string, string>();
  innings.forEach((inning) => {
    inning.batting.forEach((entry) => {
      if (entry.didNotBat) return;
      playerTeams.set(entry.id, inning.battingTeamId);
      const strikeRate = entry.balls > 0 ? entry.runs / entry.balls * 100 : 0;
      const notOutBonus = entry.notOut ? 6 : 0;
      const inningsShareBonus = entry.runs / Math.max(1, inning.runs) * 12;
      const decisiveChaseBonus = (
        inning.inningsNumber === 2
        && inning.battingTeamId === winnerId
        && entry.runs >= 40
      ) ? Math.min(12, entry.runs * 0.1) : 0;
      scores.set(
        entry.id,
        (scores.get(entry.id) ?? 0)
          + entry.runs
          + Math.max(0, strikeRate - 130) * 0.1
          + notOutBonus
          + inningsShareBonus
          + decisiveChaseBonus,
      );
    });
    inning.bowling.forEach((entry) => {
      playerTeams.set(entry.id, inning.bowlingTeamId);
      const economy = entry.balls > 0 ? entry.runsConceded / (entry.balls / 6) : 12;
      const battingPitchBonus = expectedScore >= 190
        ? entry.wickets * 2 + Math.max(0, 8 - economy) * 1.5
        : 0;
      const winningDefenceBonus = inning.bowlingTeamId === winnerId
        ? entry.wickets * 2
        : 0;
      scores.set(
        entry.id,
        (scores.get(entry.id) ?? 0)
          + entry.wickets * 24
          + Math.max(0, 8.5 - economy) * 4
          + entry.maidens * 8
          + battingPitchBonus
          + winningDefenceBonus,
      );
    });
  });
  const ranked = Array.from(scores.entries())
    .map(([playerId, score]) => ({
      player: players[playerId],
      teamId: playerTeams.get(playerId),
      score,
    }))
    .filter((entry): entry is { player: Player; teamId: string | undefined; score: number } => Boolean(entry.player))
    .sort((left, right) => right.score - left.score);
  const bestWinner = ranked.find((entry) => entry.teamId === winnerId);
  const bestLoser = ranked.find((entry) => entry.teamId !== winnerId);
  if (
    bestLoser
    && bestWinner
    && bestLoser.score >= bestWinner.score * 1.25
    && bestLoser.score >= bestWinner.score + 25
  ) {
    return bestLoser.player;
  }
  return bestWinner?.player ?? ranked[0]?.player ?? Object.values(players)[0];
}

export function simulateSuperOver(
  teamA: Team,
  teamB: Team,
  players: Record<string, Player>,
  seed: string,
  teamsMap: Record<string, Team>,
  maxTries = 3,
): SuperOverResult {
  let tiedCount = 0;
  let winnerId = "";
  let finalTeamAScore = { teamId: teamA.id, runs: 0, wickets: 0 };
  let finalTeamBScore = { teamId: teamB.id, runs: 0, wickets: 0 };

  for (let attempt = 1; attempt <= maxTries; attempt++) {
    tiedCount++;
    const rng = new SimulationRandom(`${seed}|superover-attempt-${attempt}`);

    const runsA = Math.floor(rng.next() * 11) + Math.floor(rng.next() * 7) + 3;
    const wktsA = Math.floor(rng.next() * 2.1);

    const runsB = Math.floor(rng.next() * 11) + Math.floor(rng.next() * 7) + 3;
    const wktsB = Math.floor(rng.next() * 2.1);

    finalTeamAScore = { teamId: teamA.id, runs: runsA, wickets: wktsA };
    finalTeamBScore = { teamId: teamB.id, runs: runsB, wickets: wktsB };

    if (runsA > runsB) {
      winnerId = teamA.id;
      break;
    } else if (runsB > runsA) {
      winnerId = teamB.id;
      break;
    }
  }

  if (!winnerId) {
    winnerId = teamA.id;
  }

  const winnerScore = winnerId === teamA.id ? finalTeamAScore : finalTeamBScore;
  const loserScore = winnerId === teamA.id ? finalTeamBScore : finalTeamAScore;
  const winnerName = teamsMap[winnerId]?.name ?? winnerId;

  const superOverText = tiedCount > 1
    ? `${winnerName} won via ${tiedCount} Super Overs (${winnerScore.runs}/${winnerScore.wickets} vs ${loserScore.runs}/${loserScore.wickets})`
    : `${winnerName} won via Super Over (${winnerScore.runs}/${winnerScore.wickets} vs ${loserScore.runs}/${loserScore.wickets})`;

  return {
    played: true,
    tiedCount,
    winnerId,
    teamAScore: finalTeamAScore,
    teamBScore: finalTeamBScore,
    summaryText: superOverText,
  };
}

function resultText(
  winnerId: string | null,
  battingFirstTeamId: string,
  inningsOne: MatchInnings,
  inningsTwo: MatchInnings,
  teams: Record<string, Team>,
  superOver?: SuperOverResult,
): string {
  if (superOver) {
    return superOver.summaryText;
  }
  if (!winnerId) return "Match tied";
  if (winnerId === battingFirstTeamId) {
    const margin = inningsOne.runs - inningsTwo.runs;
    return `${teams[winnerId]?.name ?? winnerId} won by ${margin} run${margin === 1 ? "" : "s"}`;
  }
  const wicketsRemaining = 10 - inningsTwo.wickets;
  return `${teams[winnerId]?.name ?? winnerId} won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? "" : "s"}`;
}

export function simulateInstantMatch(input: MatchSimulationInput): MatchSimulationRecord {
  const rng = new SimulationRandom(`${input.seed}|engine-${MATCH_SIMULATION_VERSION}`);
  const tossWinner = rng.next() < 0.5 ? input.teamA : input.teamB;
  const tossWinnerPlans = tossWinner.id === input.teamA.id
    ? input.teamAPlans
    : input.teamBPlans;
  const tossDecision = chooseTossDecision(tossWinnerPlans.tactics, input.conditions);
  const otherTeam = tossWinner.id === input.teamA.id ? input.teamB : input.teamA;
  const battingFirstTeam = tossDecision === "bat" ? tossWinner : otherTeam;
  const bowlingFirstTeam = battingFirstTeam.id === input.teamA.id ? input.teamB : input.teamA;
  const battingFirstPlans = battingFirstTeam.id === input.teamA.id
    ? input.teamAPlans
    : input.teamBPlans;
  const bowlingFirstPlans = bowlingFirstTeam.id === input.teamA.id
    ? input.teamAPlans
    : input.teamBPlans;
  const battingFirstState = createActiveTeamState(
    battingFirstTeam,
    battingFirstPlans,
    "battingFirst",
  );
  const bowlingFirstState = createActiveTeamState(
    bowlingFirstTeam,
    bowlingFirstPlans,
    "bowlingFirst",
  );
  const battingFirstStrength = teamPlayingStrength(
    battingFirstState.plan,
    input.players,
    "battingFirst",
  ) + (
    input.conditions.homeTeamId === battingFirstTeam.id
      ? HOME_ADVANTAGE_STRENGTH_BONUS
      : 0
  );
  const bowlingFirstStrength = teamPlayingStrength(
    bowlingFirstState.plan,
    input.players,
    "bowlingFirst",
  ) + (
    input.conditions.homeTeamId === bowlingFirstTeam.id
      ? HOME_ADVANTAGE_STRENGTH_BONUS
      : 0
  );
  const probabilityBattingFirstWins = estimateTeamWinProbability(
    battingFirstStrength,
    bowlingFirstStrength,
  );
  const performanceFavoursBattingFirst = rng.next() < probabilityBattingFirstWins;
  const rawDifference = battingFirstStrength - bowlingFirstStrength;
  const strengthEdge = clamp(rawDifference * 0.002, -0.025, 0.025);
  // Match-level performance variance is strong enough to produce a genuine
  // upset when the pre-match probability roll favours the underdog. Ratings
  // still shape every delivery, but are not counted twice into a 98-99% result.
  const performanceEdge = performanceFavoursBattingFirst ? 0.12 : -0.12;

  const derivedForm = input.recentScorecards && input.recentScorecards.length > 0
    ? derivePlayerFormAdjustments(input.recentScorecards)
    : {};

  const activeFormAdjustments = {
    ...derivedForm,
    ...(input.formAdjustments ?? {}),
  };

  const firstInnings = simulateInnings({
    inningsNumber: 1,
    batting: battingFirstState,
    bowling: bowlingFirstState,
    players: input.players,
    tactics: battingFirstPlans.tactics,
    bowlingTactics: bowlingFirstPlans.tactics,
    conditions: input.conditions,
    rng,
    skillEdge: strengthEdge,
    performanceTilt: performanceEdge,
    formAdjustments: activeFormAdjustments,
    allowCollapseImpact: true,
    seed: input.seed,
    stage: input.stage,
    isKnockout: input.isKnockout,
    time: input.time,
  });

  activateBowlFirstImpact(
    bowlingFirstState,
    firstInnings.runs + 1,
    input.conditions,
    input.players,
  );
  activateStandardBatFirstImpact(
    battingFirstState,
    input.players,
  );

  const secondInnings = simulateInnings({
    inningsNumber: 2,
    batting: bowlingFirstState,
    bowling: battingFirstState,
    players: input.players,
    tactics: bowlingFirstPlans.tactics,
    bowlingTactics: bowlingFirstPlans.tactics,
    conditions: input.conditions,
    rng,
    target: firstInnings.runs + 1,
    firstInningsWickets: firstInnings.wickets,
    skillEdge: -strengthEdge,
    performanceTilt: -performanceEdge,
    formAdjustments: activeFormAdjustments,
    priorBattingBalls: Object.fromEntries(
      firstInnings.batting.map((entry) => [entry.id, entry.balls]),
    ),
    allowCollapseImpact: false,
    seed: input.seed,
    stage: input.stage,
    isKnockout: input.isKnockout,
    time: input.time,
  });

  const chasingImpact = bowlingFirstState.impactDecision;
  const chasingImpactPosition = chasingImpact.battingPosition;
  const chaseCompletedBeforeImpactWasNeeded = Boolean(
    chasingImpact.used
    && chasingImpact.incomingPlayerId
    && chasingImpact.outgoingPlayerId
    && chasingImpactPosition
    && secondInnings.runs >= firstInnings.runs + 1
    // With W wickets lost, only positions 1 through W + 2 can have been
    // required. A planned player below that point never entered the match.
    && chasingImpactPosition > secondInnings.wickets + 2,
  );
  if (
    chaseCompletedBeforeImpactWasNeeded
    && chasingImpact.incomingPlayerId
    && chasingImpact.outgoingPlayerId
  ) {
    const unusedIncomingId = chasingImpact.incomingPlayerId;
    bowlingFirstState.finalXI = [...bowlingFirstState.startingXI];
    bowlingFirstState.impactUsed = false;
    bowlingFirstState.impactDecision = {
      teamId: bowlingFirstTeam.id,
      used: false,
      reason: "not-used",
      explanation: "The chase was completed before the planned batting Impact Player was required.",
    };
    secondInnings.batting = secondInnings.batting.filter(
      (entry) => entry.id !== unusedIncomingId,
    );
  }

  let winnerId: string = secondInnings.runs > firstInnings.runs
    ? bowlingFirstTeam.id
    : secondInnings.runs < firstInnings.runs
      ? battingFirstTeam.id
      : "";

  const teams = {
    [input.teamA.id]: input.teamA,
    [input.teamB.id]: input.teamB,
  };

  let superOver: SuperOverResult | undefined = undefined;

  if (!winnerId) {
    superOver = simulateSuperOver(
      input.teamA,
      input.teamB,
      input.players,
      `${input.seed}|so`,
      teams,
    );
    winnerId = superOver.winnerId;
  }

  const pom = playerOfTheMatch(
    [firstInnings, secondInnings],
    input.players,
    winnerId,
    (
      input.conditions.adjustedExpectedScore.min
      + input.conditions.adjustedExpectedScore.max
    ) / 2,
  );
  const finalResultText = resultText(
    winnerId,
    battingFirstTeam.id,
    firstInnings,
    secondInnings,
    teams,
    superOver,
  );
  const summary = [
    `${tossWinner.name} won the toss and chose to ${tossDecision}.`,
    `${battingFirstTeam.name} scored ${firstInnings.runs}/${firstInnings.wickets} in ${firstInnings.overs.toFixed(1)} overs.`,
    ...[battingFirstState.impactDecision, bowlingFirstState.impactDecision]
      .filter((decision) => decision.used)
      .map((decision) => decision.explanation),
    `${bowlingFirstTeam.name} scored ${secondInnings.runs}/${secondInnings.wickets} in ${secondInnings.overs.toFixed(1)} overs.`,
    finalResultText,
    `${pom.name} was named Player of the Match.`,
  ];

  return {
    version: MATCH_SIMULATION_VERSION,
    seed: input.seed,
    fixtureId: input.fixtureId,
    tossWinnerId: tossWinner.id,
    tossDecision,
    battingFirstTeamId: battingFirstTeam.id,
    bowlingFirstTeamId: bowlingFirstTeam.id,
    winnerId,
    resultText: finalResultText,
    playerOfTheMatchId: pom.id,
    playerOfTheMatchName: pom.name,
    conditions: {
      stadiumId: input.conditions.stadiumId,
      stadiumName: input.conditions.stadiumName,
      pitchId: input.conditions.pitch.id,
      pitchName: input.conditions.pitch.name,
      pitchType: input.conditions.pitch.type,
      expectedScore: { ...input.conditions.adjustedExpectedScore },
      boundaries: { ...input.conditions.boundaries },
      outfieldSpeedRating: input.conditions.outfieldSpeedRating,
      weather: null,
    },
    lineups: {
      [battingFirstTeam.id]: {
        teamId: battingFirstTeam.id,
        plan: "battingFirst",
        startingXI: [...battingFirstState.startingXI],
        finalXI: [...battingFirstState.finalXI],
        captainId: battingFirstState.plan.captainId,
        viceCaptainId: battingFirstState.plan.viceCaptainId,
      },
      [bowlingFirstTeam.id]: {
        teamId: bowlingFirstTeam.id,
        plan: "bowlingFirst",
        startingXI: [...bowlingFirstState.startingXI],
        finalXI: [...bowlingFirstState.finalXI],
        captainId: bowlingFirstState.plan.captainId,
        viceCaptainId: bowlingFirstState.plan.viceCaptainId,
      },
    },
    impactDecisions: [
      battingFirstState.impactDecision,
      bowlingFirstState.impactDecision,
    ],
    innings: [firstInnings, secondInnings],
    summary,
  };
}

export function createIntelligentAiTactics(
  team: Team,
  pitch: CuratorPitch,
): TeamTactics {
  const bowlingSurface = (
    pitch.favours.includes("spin-bowlers")
    || pitch.favours.includes("pace-bowlers")
    || pitch.favours.includes("high-rated-pace-bowlers")
  );
  const battingSurface = (
    pitch.favours.includes("aggressive-batters")
    || pitch.expectedFirstInningsScore.max >= 200
  );
  const preset: TeamStrategy = bowlingSurface && !battingSurface
    ? "Bowling Dominant"
    : team.aiPersonality === "Aggressive"
      ? "Ultra Aggressive"
      : team.aiPersonality === "Conservative"
        ? "Anchor & Explode"
        : "Balanced";
  const tactics = createTeamTactics(preset);
  if (pitch.favours.includes("spin-bowlers")) {
    tactics.bowling.middle = "spin-choke";
  } else if (pitch.favours.includes("pace-bowlers")) {
    tactics.bowling.middle = "pace";
  }
  return tactics as TeamTactics;
}

export function getMatchPreparationWarnings(
  lineup: readonly Player[],
  tactics: TeamTactics,
  conditions: MatchGroundConditions,
): string[] {
  const warnings: string[] = [];
  const spinOptions = lineup.filter((player) => isSpinner(player) && player.currentBowling >= 68);
  const paceOptions = lineup.filter((player) => isPacer(player) && player.currentBowling >= 68);
  if (conditions.pitch.favours.includes("spin-bowlers") && spinOptions.length < 2) {
    warnings.push(`${conditions.pitch.name} favours spin, but this XI has fewer than two recognised spin options.`);
  }
  if (
    conditions.pitch.favours.includes("pace-bowlers")
    && paceOptions.length < 3
  ) {
    warnings.push(`${conditions.pitch.name} favours pace, but this XI has fewer than three recognised pace options.`);
  }
  const scoreCentre = (
    conditions.adjustedExpectedScore.min
    + conditions.adjustedExpectedScore.max
  ) / 2;
  if (scoreCentre >= 200 && tactics.batting.powerplay === "cautious") {
    warnings.push("The cautious powerplay plan may leave runs unused on this high-scoring surface.");
  }
  if (
    scoreCentre <= 165
    && tactics.batting.powerplay === "attack"
    && tactics.batting.middle === "dominate"
  ) {
    warnings.push("The aggressive batting plan carries additional collapse risk on this difficult surface.");
  }
  return warnings;
}
