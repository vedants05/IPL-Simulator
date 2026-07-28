import type {
  BoundaryDimensions,
  CuratorPitch,
  PitchPreference,
} from "@/lib/data/pitchCurator";
import type { OutfieldSettings } from "@/lib/logic/stadiumManagement";
import {
  createTeamTactics,
  type TeamTactics,
  type TeamStrategy,
} from "@/lib/logic/teamTactics";
import { selectBattingFirstOutgoingBatter } from "@/lib/logic/aiLineupSelector";
import type { Player, Team } from "@/lib/types";

export const MATCH_SIMULATION_VERSION = 1;
export const DEFAULT_CHASING_SCORING_BONUS = 0.05;

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
  wicket?: DeliveryWicket;
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

export interface MatchSimulationRecord {
  version: number;
  seed: string;
  fixtureId: string;
  tossWinnerId: string;
  tossDecision: TossDecision;
  battingFirstTeamId: string;
  bowlingFirstTeamId: string;
  winnerId: string | null;
  resultText: string;
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
  allowCollapseImpact: boolean;
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
): number {
  const selected = plan.startingXI
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player));
  const batting = selected
    .map((player) => player.currentBatting)
    .sort((left, right) => right - left)
    .slice(0, 7);
  const bowling = selected
    .filter(isBowlingOption)
    .map((player) => player.currentBowling)
    .sort((left, right) => right - left)
    .slice(0, 5);
  const battingAverage = batting.reduce((sum, value) => sum + value, 0) / Math.max(1, batting.length);
  const bowlingAverage = bowling.reduce((sum, value) => sum + value, 0) / Math.max(1, bowling.length);
  return battingAverage * 0.58 + bowlingAverage * 0.42;
}

/**
 * Equal sides are exactly 50/50. A rating gap of roughly eight points is
 * treated as a noticeably stronger side and approaches a nine-in-ten chance.
 */
export function estimateTeamWinProbability(strengthA: number, strengthB: number): number {
  const difference = strengthA - strengthB;
  return clamp(1 / (1 + Math.exp(-difference / 3.65)), 0.1, 0.9);
}

function chooseTossDecision(
  tactics: TeamTactics,
  conditions: MatchGroundConditions,
): TossDecision {
  if (tactics.tossPreference === "bat") return "bat";
  if (tactics.tossPreference === "bowl") return "bowl";
  const centre = (
    conditions.adjustedExpectedScore.min
    + conditions.adjustedExpectedScore.max
  ) / 2;
  return (
    conditions.pitch.favours.includes("chasing-team")
    || centre >= 185
    || conditions.outfieldSpeedRating >= 8.5
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

function bowlingTacticalAdjustment(
  tactics: TeamTactics,
  overNumber: number,
  bowler: Player,
): { wicket: number; scoring: number } {
  let wicket = tactics.bowling.field === "attacking"
    ? 0.008
    : tactics.bowling.field === "defensive"
      ? -0.004
      : 0;
  let scoring = tactics.bowling.field === "attacking"
    ? 0.04
    : tactics.bowling.field === "defensive"
      ? -0.05
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

function chooseBowler(
  overNumber: number,
  fieldingIds: readonly string[],
  players: Record<string, Player>,
  ballsByBowler: ReadonlyMap<string, number>,
  previousBowlerId: string | null,
  tactics: TeamTactics,
  pitch: CuratorPitch,
  unavailableUntilOver: ReadonlyMap<string, number>,
  rng: SimulationRandom,
): Player {
  const candidates = fieldingIds
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player) && isBowlingOption(player));
  const fallback = fieldingIds
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player))
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

  const scored = eligible.map((player) => {
    let score = player.currentBowling + bowlingPitchAdjustment(player, pitch);
    const ballsBowled = ballsByBowler.get(player.id) ?? 0;
    if (overNumber <= 6 && isPacer(player)) score += 5;
    if (overNumber >= 7 && overNumber <= 15 && isSpinner(player)) score += 5;
    if (overNumber >= 16 && isPacer(player)) score += 4;
    if (overNumber <= 6 && tactics.bowling.powerplay === "swing-attack" && isPacer(player)) score += 3;
    if (overNumber >= 7 && overNumber <= 15 && tactics.bowling.middle === "spin-choke" && isSpinner(player)) score += 4;
    if (overNumber >= 16 && tactics.bowling.death === "yorkers" && isPacer(player)) score += 3;
    const oversBowled = Math.floor(ballsBowled / 6);
    if (frontlineBowlerIds.has(player.id)) {
      const oversStillWanted = Math.max(0, 4 - oversBowled);
      // Frontline quality becomes increasingly decisive late in the innings,
      // preventing surface preferences from leaving superior bowlers unused.
      score += oversStillWanted * (overNumber >= 16 ? 5 : overNumber >= 12 ? 2.5 : 1);
      if (overNumber >= 17 && oversStillWanted >= 2) score += 9;
    }
    if (deathBowlerIds.has(player.id)) {
      // Keep at least one over from two trusted options available for the
      // closing phase, while still allowing them to attack earlier.
      if (overNumber <= 12 && oversBowled >= 2) score -= 9;
      if (overNumber <= 15 && oversBowled >= 3) score -= 12;
      if (overNumber >= 16) score += 7;
    }
    score -= ballsBowled * 0.12;
    score += rng.gaussian() * 1.25;
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
  return clamp(
    55
    + player.currentBatting * 0.22
    + (player.reputation ?? 5) * 0.8
    - Number(Boolean(player.isPartTimeWk && !player.isWicketkeeper && player.role !== "WK-Batsman")) * 8,
    50,
    90,
  );
}

function chooseDismissal(
  striker: Player,
  bowler: Player,
  fieldingIds: readonly string[],
  players: Record<string, Player>,
  rng: SimulationRandom,
): DeliveryWicket {
  const kind = rng.weighted<DismissalKind>([
    { value: "caught", weight: 52 },
    { value: "bowled", weight: isPacer(bowler) ? 18 : 13 },
    { value: "lbw", weight: isPacer(bowler) ? 14 : 16 },
    { value: "run-out", weight: 7 },
    { value: "stumped", weight: isSpinner(bowler) ? 9 : 1 },
    { value: "hit-wicket", weight: 1 },
  ]);
  const fielder = kind === "caught"
    ? selectFielder(fieldingIds, players, rng)
    : kind === "stumped"
      ? selectFielder(fieldingIds, players, rng, true)
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
): number {
  const boundaryFactor = clamp(scoringFactor * (1 + intent * 0.75), 0.55, 1.8);
  const dotFactor = clamp(1 / (scoringFactor * (1 + intent * 0.25)), 0.6, 1.65);
  const averageBoundary = (
    conditions.boundaries.straightMetres
    + conditions.boundaries.wideMetres
  ) / 2;
  const threeRunFactor = (
    averageBoundary >= 71
    && conditions.outfieldSpeedRating <= 6
  ) ? 4 : 1;

  return rng.weighted([
    { value: 0, weight: 0.34 * dotFactor },
    { value: 1, weight: 0.37 },
    { value: 2, weight: 0.09 * clamp(1.05 - conditions.outfieldSpeedRating * 0.02, 0.82, 1.05) },
    { value: 3, weight: 0.0035 * threeRunFactor },
    { value: 4, weight: 0.14 * boundaryFactor * clamp(conditions.outfieldSpeedRating / 7.5, 0.72, 1.25) },
    { value: 6, weight: 0.052 * boundaryFactor ** 1.35 * clamp(69 / averageBoundary, 0.8, 1.3) },
  ]);
}

function createPlayerLuck(
  playerIds: readonly string[],
  players: Record<string, Player>,
  formAdjustments: Record<string, number>,
  rng: SimulationRandom,
): Map<string, number> {
  return new Map(playerIds.map((playerId) => {
    const player = players[playerId];
    if (!player) return [playerId, 0];
    const reputation = player.reputation ?? 5;
    const ageConsistency = player.age >= 25 && player.age <= 33 ? 0.8 : 1.12;
    const standardDeviation = clamp((4.1 - reputation * 0.22) * ageConsistency, 1.25, 3.4);
    return [
      playerId,
      clamp(
        rng.gaussian() * standardDeviation + (formAdjustments[playerId] ?? 0),
        -7,
        7,
      ),
    ];
  }));
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

function simulateInnings(context: InningsContext): MatchInnings {
  const {
    batting,
    bowling,
    players,
    rng,
    conditions,
    target,
  } = context;
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
  let deliverySequence = 0;
  let collapsePressureBalls = 0;
  let partnershipStartRuns = 0;
  let partnershipStartBalls = 0;
  let partnershipBatterIds = [strikerId, nonStrikerId];
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
  const keeperRating = inferredKeeperRating(fielders.find(isKeeper));
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
      bowlerUnavailableUntilOver,
      rng,
    );
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
      const bowlingRating = (
        bowler.currentBowling
        + (playerLuck.get(bowler.id) ?? 0)
        + bowlingPitchAdjustment(bowler, conditions.pitch)
      );
      const battingPosition = batting.battingOrder.indexOf(striker.id) + 1;
      const setBonus = clamp((strikerEntry.balls - 8) * 0.12, 0, 3.5);
      const battingRating = (
        striker.currentBatting
        + (playerLuck.get(striker.id) ?? 0)
        + battingPitchAdjustment(striker, conditions.pitch)
        + setBonus
        - playerPositionPenalty(striker, battingPosition)
      );
      const intent = battingIntent(
        context.tactics,
        overNumber,
        wickets,
        runs,
        target,
      );
      const tacticalBowling = bowlingTacticalAdjustment(
        context.bowlingTactics,
        overNumber,
        bowler,
      );
      const wideProbability = clamp(0.012 + (75 - bowlingRating) * 0.00045, 0.007, 0.035);
      const noBallProbability = clamp(0.004 + (72 - bowlingRating) * 0.00024, 0.0025, 0.016);
      const outcomeRoll = rng.next();
      let isLegal = true;
      let runsOffBat = 0;
      let wicket: DeliveryWicket | undefined;

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
        const milestoneScoringFactor = strikerEntry.runs >= 100
          ? 0.76
          : strikerEntry.runs >= 80
            ? 0.86
            : strikerEntry.runs >= 60
              ? 0.94
              : 1;
        const runEnvironment = clamp(
          clamp(expectedCentre / 162, 0.82, 1.14)
          * inningsEnvironment
          * (1 + skillDelta * 0.0075)
          * (1 + context.skillEdge)
          * (1 + context.performanceTilt)
          * milestoneScoringFactor
          * (context.inningsNumber === 2
            ? 1 + (conditions.chasingScoringBonus ?? DEFAULT_CHASING_SCORING_BONUS)
            : 1)
          * (1 + tacticalBowling.scoring),
          0.63,
          1.75,
        );
        const easyTargetRelief = target
          ? clamp((expectedCentre - target) / Math.max(1, expectedCentre), 0, 0.45)
          : 0;
        const firstInningsCollapseRelief = target && (context.firstInningsWickets ?? 0) >= 7
          ? clamp(((context.firstInningsWickets ?? 0) - 6) * 0.035, 0, 0.12)
          : 0;
        // An easy chase encourages lower-risk batting. If the chase then
        // suffers its own early collapse, that protection rapidly disappears.
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
        const individualScoreWicketPressure = strikerEntry.runs >= 100
          ? 0.026
          : strikerEntry.runs >= 80
            ? 0.013
            : strikerEntry.runs >= 60
              ? 0.004
              : 0;
        const wicketProbability = clamp(
          0.038
          + (bowlingRating - battingRating) * 0.00155
          + Math.max(0, intent) * 0.035
          + tacticalBowling.wicket
          + (fieldingRating - 75) * 0.00045
          + (collapsePressureBalls > 0 ? 0.018 : 0)
          // Slow surfaces reduce stroke-making without automatically turning
          // every low-scoring innings into an extreme batting collapse.
          - Math.max(0, 165 - expectedCentre) * 0.00025
          - easyChaseWicketRelief
          + individualScoreWicketPressure
          - Math.min(0, intent) * -0.014,
          0.018,
          0.13,
        );

        if (!isNoBall && rng.next() < wicketProbability) {
          wicket = chooseDismissal(
            striker,
            bowler,
            bowling.finalXI,
            players,
            rng,
          );
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
            runs: runs - partnershipStartRuns,
            balls: legalBalls + 1 - partnershipStartBalls,
          });
          collapsePressureBalls = rng.next() < 0.14 ? 10 : Math.max(collapsePressureBalls, 3);
        } else {
          const incidentalExtrasRoll = rng.next();
          const byeProbability = clamp(0.006 + (72 - keeperRating) * 0.00045, 0.002, 0.016);
          if (incidentalExtrasRoll < byeProbability) {
            extrasForBall.byes = rng.next() < 0.86 ? 1 : 2;
          } else if (incidentalExtrasRoll < byeProbability + 0.012) {
            extrasForBall.legByes = rng.next() < 0.84 ? 1 : 2;
          } else {
            runsOffBat = sampleBatRuns(
              rng,
              runEnvironment,
              intent + (isNoBall ? 0.12 : 0),
              conditions,
            );
            strikerEntry.runs += runsOffBat;
            if (runsOffBat === 4) strikerEntry.fours += 1;
            if (runsOffBat === 6) strikerEntry.sixes += 1;
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

      if (isLegal) {
        legalBalls += 1;
        legalBallsThisOver += 1;
        bowlerEntry.balls += 1;
        bowlerEntry.overs = oversFromBalls(bowlerEntry.balls);
        if (collapsePressureBalls > 0) collapsePressureBalls -= 1;
      }

      const resultCode = deliveryResultCode(runsOffBat, extrasForBall, wicket);
      const commentary = wicket
        ? `${displayBall} ${bowler.name} to ${striker.name}: OUT, ${strikerEntry.dismissal}.`
        : `${displayBall} ${bowler.name} to ${striker.name}: ${resultCode === "0" ? "no run" : `${resultCode}, ${totalRuns} run${totalRuns === 1 ? "" : "s"}`}.`;
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
        wicket,
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

      if (isLegal && legalBallsThisOver === 6 && strikerId && nonStrikerId) {
        [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
      }
    }

    const overRuns = runs - overStartRuns;
    const overWickets = wickets - overStartWickets;
    if (overRuns === 0 && legalBallsThisOver === 6) bowlerEntry.maidens += 1;
    if (legalBallsThisOver === 6 && overRuns >= 14) {
      const oversToSitOut = overRuns >= 22 ? 4 : overRuns >= 18 ? 3 : 2;
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
): Player {
  const scores = new Map<string, number>();
  innings.forEach((inning) => {
    inning.batting.forEach((entry) => {
      if (entry.didNotBat) return;
      const strikeRate = entry.balls > 0 ? entry.runs / entry.balls * 100 : 0;
      const notOutBonus = entry.notOut ? 6 : 0;
      scores.set(
        entry.id,
        (scores.get(entry.id) ?? 0)
          + entry.runs
          + Math.max(0, strikeRate - 130) * 0.1
          + notOutBonus,
      );
    });
    inning.bowling.forEach((entry) => {
      const economy = entry.balls > 0 ? entry.runsConceded / (entry.balls / 6) : 12;
      scores.set(
        entry.id,
        (scores.get(entry.id) ?? 0)
          + entry.wickets * 24
          + Math.max(0, 8.5 - economy) * 4
          + entry.maidens * 8,
      );
    });
  });
  const ranked = Array.from(scores.entries())
    .map(([playerId, score]) => ({
      player: players[playerId],
      score: score + (winnerId && players[playerId]?.currentTeamId === winnerId ? 7 : 0),
    }))
    .filter((entry): entry is { player: Player; score: number } => Boolean(entry.player))
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.player ?? Object.values(players)[0];
}

function resultText(
  winnerId: string | null,
  battingFirstTeamId: string,
  inningsOne: MatchInnings,
  inningsTwo: MatchInnings,
  teams: Record<string, Team>,
): string {
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
  );
  const bowlingFirstStrength = teamPlayingStrength(
    bowlingFirstState.plan,
    input.players,
  );
  const probabilityBattingFirstWins = estimateTeamWinProbability(
    battingFirstStrength,
    bowlingFirstStrength,
  );
  const performanceFavoursBattingFirst = rng.next() < probabilityBattingFirstWins;
  const rawDifference = battingFirstStrength - bowlingFirstStrength;
  const strengthEdge = clamp(rawDifference * 0.0035, -0.04, 0.04);
  // Match-level performance variance is strong enough to produce a genuine
  // upset when the pre-match probability roll favours the underdog. Ratings
  // still shape every delivery, but are not counted twice into a 98-99% result.
  const performanceEdge = performanceFavoursBattingFirst ? 0.14 : -0.14;

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
    formAdjustments: input.formAdjustments ?? {},
    allowCollapseImpact: true,
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
    bowlingTactics: battingFirstPlans.tactics,
    conditions: input.conditions,
    rng,
    target: firstInnings.runs + 1,
    firstInningsWickets: firstInnings.wickets,
    skillEdge: -strengthEdge,
    performanceTilt: -performanceEdge,
    formAdjustments: input.formAdjustments ?? {},
    allowCollapseImpact: false,
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

  const winnerId = secondInnings.runs > firstInnings.runs
    ? bowlingFirstTeam.id
    : secondInnings.runs < firstInnings.runs
      ? battingFirstTeam.id
      : null;
  const teams = {
    [input.teamA.id]: input.teamA,
    [input.teamB.id]: input.teamB,
  };
  const pom = playerOfTheMatch(
    [firstInnings, secondInnings],
    input.players,
    winnerId,
  );
  const finalResultText = resultText(
    winnerId,
    battingFirstTeam.id,
    firstInnings,
    secondInnings,
    teams,
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
