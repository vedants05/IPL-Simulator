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
import {
  findOptimalImpactBattingPosition,
  selectBattingFirstOutgoingBatter,
} from "@/lib/logic/aiLineupSelector";
import type { CareerStaffState } from "@/lib/logic/staffContracts";
import { calculateCoachingStaffModifiers, deriveAITeamTactics } from "@/lib/logic/coachingStrategyImpact";
import { appendRainAffectedResultLabel, hasRainReducedOvers } from "@/lib/logic/matchWeather";
import type { Player, Team } from "@/lib/types";

export const MATCH_SIMULATION_VERSION = 4;
export const DEFAULT_CHASING_SCORING_BONUS = 0;
export const HOME_ADVANTAGE_STRENGTH_BONUS = 0.5;
export const POWERPLAY_BOUNDARY_MULTIPLIER = 1.06;
export const CORE_BATTER_ROTATION_MULTIPLIER = 1.08;
export const FINISHER_BOUNDARY_MULTIPLIER = 1.1;

export type TossDecision = "bat" | "bowl";
export type TossCall = "heads" | "tails";
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

export type WeatherScenarioKind =
  | "clear"
  | "delayed-start"
  | "innings-break-rain"
  | "multiple-showers"
  // Retained so older saves and explicit test scenarios remain readable.
  | "first-innings-shower"
  | "chase-shower";

export interface MatchWeatherScenario {
  kind: WeatherScenarioKind;
  rainDelayMinutes: number;
  firstInningsOvers: number;
  secondInningsOvers: number;
  summary: string;
  dlsApplied?: boolean;
  originalTarget?: number;
  revisedTarget?: number;
  firstInningsResourcePercentage?: number;
  secondInningsResourcePercentage?: number;
  temperatureCelsius?: number;
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
  battingFormAdjustments?: Record<string, number>;
  bowlingFormAdjustments?: Record<string, number>;
  seasonBattingStats?: Record<string, { runs: number; matches: number }>;
  recentScorecards?: Array<any>;
  stage?: string;
  isKnockout?: boolean;
  /** Per-team league-match importance (0-1), calculated from qualification state. */
  bigMatchIntensityByTeam?: Record<string, number>;
  weatherScenario?: MatchWeatherScenario;
  staffState?: CareerStaffState | null;
}

export type PlayableBattingApproach =
  | "survive"
  | "anchor"
  | "balanced"
  | "attack"
  | "six-hitting";

export type PlayableShotZone =
  | "all-ground"
  | "offside"
  | "straight"
  | "legside";

export type PlayableFieldPlan = "protect" | "balanced" | "hunt-wickets";

export interface PlayableFieldPosition {
  id: number;
  label: string;
  x: number;
  y: number;
}

export type DeliveryShotType = "ground" | "lofted" | "skier" | "edge";

export interface DeliveryShotTarget {
  x: number;
  y: number;
}

export type PlayableBowlingPlan =
  | "good-length"
  | "yorker-attack"
  | "bouncer-pace"
  | "spin-choke";

export interface PlayableDeliveryControl {
  battingApproach?: PlayableBattingApproach;
  /** Broad scoring area requested by the striker. It biases rather than forces direction. */
  shotZone?: PlayableShotZone;
  fieldPlan?: PlayableFieldPlan;
  bowlingPlan?: PlayableBowlingPlan;
  /** The exact nine outfield positions used for this delivery. */
  fieldPositions?: PlayableFieldPosition[];
}

/** Decisions are keyed by stable innings/delivery identifiers so a played
 * match can be deterministically rebuilt after every saved delivery. */
export interface PlayableMatchDecisions {
  tossCall?: TossCall;
  tossDecision?: TossDecision;
  /** Pauses a lost toss until the user has seen the result and AI decision. */
  tossResultAcknowledged?: boolean;
  deliveryControls: Record<string, PlayableDeliveryControl>;
  bowlerByOver: Record<string, string>;
  batterByWicket: Record<string, string>;
  /** Records that the post-wicket prompt was confirmed, including Automatic. */
  resolvedBatterWickets?: Record<string, boolean>;
  impactByTeam?: Record<string, PlayableImpactChoice>;
}

export interface PlayableImpactChoice {
  use: boolean;
  incomingPlayerId?: string;
  outgoingPlayerId?: string;
  battingPosition?: number;
  /** Apply at the next stable delivery boundary, preserving revealed play. */
  activationInningsNumber?: 1 | 2;
  activationDeliverySequence?: number;
}

export interface PlayableInningsProgress {
  inningsNumber: 1 | 2;
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  legalBalls: number;
  overs: number;
  target?: number;
  deliveries: MatchDelivery[];
  complete: boolean;
}

export interface PlayableMatchProgress {
  tossWinnerId?: string;
  tossCall?: TossCall;
  tossResult?: TossCall;
  tossDecision?: TossDecision;
  awaitingTossCall: boolean;
  awaitingTossDecision: boolean;
  awaitingTossAcknowledgement: boolean;
  battingFirstTeamId?: string;
  bowlingFirstTeamId?: string;
  revealedDeliveries: number;
  totalDeliveries: number;
  inningsDeliveryEnds: [number, number];
  innings: PlayableInningsProgress[];
  nextDelivery?: MatchDelivery;
  nextOverBowler?: {
    overNumber: number;
    bowlerId: string;
    bowlerName: string;
    selectionReason?: BowlerSelectionReason;
  };
  awaitingImpactDecision?: boolean;
  impactRecommendation?: MatchImpactDecision;
  complete: boolean;
  simulation?: MatchSimulationRecord;
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
  shotType?: DeliveryShotType;
  shotTarget?: DeliveryShotTarget;
  shotZone?: PlayableShotZone;
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
  bowlerSelectionReason?: BowlerSelectionReason;
}

export type BowlerSelectionReason =
  | "phase-specialist"
  | "death-reserved"
  | "target-at-risk"
  | "pitch-matchup"
  | "batter-matchup"
  | "rotation-required"
  | "user-selected"
  | "smart-selection";

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
    weather: MatchWeatherScenario;
  };
  lineups: Record<string, MatchLineupSnapshot>;
  impactDecisions: MatchImpactDecision[];
  impactRecommendations?: MatchImpactDecision[];
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
  matchScoringEnvironment: number;
  battingFormAdjustments: Record<string, number>;
  bowlingFormAdjustments: Record<string, number>;
  seasonBattingStats?: Readonly<Record<string, { runs: number; matches: number }>>;
  priorBattingBalls?: Readonly<Record<string, number>>;
  allowCollapseImpact: boolean;
  seed?: string;
  stage?: string;
  isKnockout?: boolean;
  bigMatchIntensityByTeam?: Readonly<Record<string, number>>;
  time?: string;
  maxOvers?: number;
  playableDecisions?: PlayableMatchDecisions;
  staffState?: CareerStaffState | null;
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

interface PlayableFieldInfluence {
  shotType: DeliveryShotType;
  shotTarget: DeliveryShotTarget;
  shotZone: PlayableShotZone;
  catchFielderIndex: number;
  catchDistance: number;
  ringFielderIndex: number;
  ringDistance: number;
  boundaryOpportunityMultiplier: number;
  rotationMultiplier: number;
  wicketAdjustment: number;
  caughtWeightMultiplier: number;
  runOutWeightMultiplier: number;
}

const THIRTY_YARD_RADIUS_X = 33;
const THIRTY_YARD_RADIUS_Y = 31;
const PLAYABLE_SHOT_DIRECTIONS: readonly DeliveryShotTarget[] = [
  { x: 12, y: 55 },
  { x: 22, y: 25 },
  { x: 38, y: 14 },
  { x: 50, y: 10 },
  { x: 62, y: 14 },
  { x: 78, y: 25 },
  { x: 88, y: 55 },
  { x: 70, y: 80 },
  { x: 30, y: 80 },
] as const;
const PLAYABLE_EDGE_TARGETS: readonly DeliveryShotTarget[] = [
  { x: 56, y: 68 },
  { x: 60, y: 67 },
  { x: 65, y: 63 },
  { x: 45, y: 68 },
] as const;
const PLAYABLE_SHOT_ZONE_DIRECTIONS: Record<PlayableShotZone, readonly DeliveryShotTarget[]> = {
  "all-ground": PLAYABLE_SHOT_DIRECTIONS,
  offside: [
    PLAYABLE_SHOT_DIRECTIONS[4],
    PLAYABLE_SHOT_DIRECTIONS[5],
    PLAYABLE_SHOT_DIRECTIONS[6],
    PLAYABLE_SHOT_DIRECTIONS[7],
  ],
  straight: [
    PLAYABLE_SHOT_DIRECTIONS[2],
    PLAYABLE_SHOT_DIRECTIONS[3],
    PLAYABLE_SHOT_DIRECTIONS[4],
  ],
  legside: [
    PLAYABLE_SHOT_DIRECTIONS[0],
    PLAYABLE_SHOT_DIRECTIONS[1],
    PLAYABLE_SHOT_DIRECTIONS[2],
    PLAYABLE_SHOT_DIRECTIONS[8],
  ],
};

function deterministicUnit(seed: string): number {
  return hashSeed(seed) / 4294967296;
}

function isPlayableDeepPosition(position: PlayableFieldPosition): boolean {
  return Math.hypot(
    (position.x - 50) / THIRTY_YARD_RADIUS_X,
    (position.y - 50) / THIRTY_YARD_RADIUS_Y,
  ) > 1;
}

function isPlayableLegSideBehindSquare(position: PlayableFieldPosition): boolean {
  return position.x < 50 && position.y > 59;
}

export interface PlayableFieldLegality {
  legal: boolean;
  maxOutside: number;
  outsideCount: number;
  legSideBehindSquareCount: number;
}

export function getPlayableFieldLegality(
  positions: readonly PlayableFieldPosition[],
  overNumber: number,
  maxOvers = 20,
): PlayableFieldLegality {
  const { powerplayEnd } = inningsPhaseThresholds(maxOvers);
  const maxOutside = overNumber <= powerplayEnd ? 2 : 5;
  const validCoordinates = positions.every((position) => (
    Number.isFinite(position.x)
    && Number.isFinite(position.y)
    && position.x >= 0
    && position.x <= 100
    && position.y >= 0
    && position.y <= 100
  ));
  const outsideCount = positions.filter(isPlayableDeepPosition).length;
  const legSideBehindSquareCount = positions.filter(isPlayableLegSideBehindSquare).length;
  return {
    legal: positions.length === 9
      && validCoordinates
      && outsideCount <= maxOutside
      && legSideBehindSquareCount <= 2,
    maxOutside,
    outsideCount,
    legSideBehindSquareCount,
  };
}

const AUTOMATIC_PLAYABLE_FIELDS: Record<FieldSetting, {
  powerplay: readonly PlayableFieldPosition[];
  openField: readonly PlayableFieldPosition[];
}> = {
  balanced: {
    powerplay: [
      { id: 0, label: "1st slip", x: 56, y: 69 }, { id: 1, label: "Point", x: 76, y: 55 },
      { id: 2, label: "Cover", x: 73, y: 40 }, { id: 3, label: "Mid off", x: 58, y: 26 },
      { id: 4, label: "Mid on", x: 42, y: 26 }, { id: 5, label: "Square leg", x: 24, y: 55 },
      { id: 6, label: "Fine leg", x: 26, y: 90 }, { id: 7, label: "Third man", x: 79, y: 85 },
      { id: 8, label: "Midwicket", x: 27, y: 38 },
    ],
    openField: [
      { id: 0, label: "Point", x: 76, y: 55 }, { id: 1, label: "Cover", x: 73, y: 40 },
      { id: 2, label: "Mid off", x: 58, y: 26 }, { id: 3, label: "Short fine leg", x: 36, y: 74 },
      { id: 4, label: "Deep point", x: 95, y: 52 }, { id: 5, label: "Deep cover", x: 85, y: 20 },
      { id: 6, label: "Long off", x: 58, y: 5 }, { id: 7, label: "Long on", x: 42, y: 5 },
      { id: 8, label: "Deep midwicket", x: 15, y: 20 },
    ],
  },
  attacking: {
    powerplay: [
      { id: 0, label: "1st slip", x: 56, y: 69 }, { id: 1, label: "2nd slip", x: 59.5, y: 68 },
      { id: 2, label: "Gully", x: 65, y: 63 }, { id: 3, label: "Point", x: 76, y: 55 },
      { id: 4, label: "Cover", x: 73, y: 40 }, { id: 5, label: "Mid off", x: 58, y: 26 },
      { id: 6, label: "Mid on", x: 42, y: 26 }, { id: 7, label: "Square leg", x: 24, y: 55 },
      { id: 8, label: "Fine leg", x: 26, y: 90 },
    ],
    openField: [
      { id: 0, label: "1st slip", x: 56, y: 69 }, { id: 1, label: "Gully", x: 65, y: 63 },
      { id: 2, label: "Short cover", x: 59.5, y: 50.5 }, { id: 3, label: "Mid off", x: 58, y: 26 },
      { id: 4, label: "Mid on", x: 42, y: 26 }, { id: 5, label: "Deep point", x: 95, y: 52 },
      { id: 6, label: "Deep cover", x: 85, y: 20 }, { id: 7, label: "Deep midwicket", x: 15, y: 20 },
      { id: 8, label: "Fine leg", x: 26, y: 90 },
    ],
  },
  defensive: {
    powerplay: [
      { id: 0, label: "Deep point", x: 95, y: 52 }, { id: 1, label: "Deep square leg", x: 5, y: 52 },
      { id: 2, label: "Point", x: 76, y: 55 }, { id: 3, label: "Cover", x: 73, y: 40 },
      { id: 4, label: "Extra cover", x: 66, y: 30 }, { id: 5, label: "Mid off", x: 58, y: 26 },
      { id: 6, label: "Mid on", x: 42, y: 26 }, { id: 7, label: "Midwicket", x: 27, y: 38 },
      { id: 8, label: "Short fine leg", x: 36, y: 74 },
    ],
    openField: [
      { id: 0, label: "Deep point", x: 95, y: 52 }, { id: 1, label: "Deep cover", x: 85, y: 20 },
      { id: 2, label: "Long off", x: 58, y: 5 }, { id: 3, label: "Long on", x: 42, y: 5 },
      { id: 4, label: "Deep midwicket", x: 15, y: 20 }, { id: 5, label: "Point", x: 76, y: 55 },
      { id: 6, label: "Cover", x: 73, y: 40 }, { id: 7, label: "Square leg", x: 24, y: 55 },
      { id: 8, label: "Short fine leg", x: 36, y: 74 },
    ],
  },
};

export function getAutomaticPlayableFieldPositions(
  field: FieldSetting,
  overNumber: number,
  maxOvers = 20,
): PlayableFieldPosition[] {
  const { powerplayEnd } = inningsPhaseThresholds(maxOvers);
  const positions = overNumber <= powerplayEnd
    ? AUTOMATIC_PLAYABLE_FIELDS[field].powerplay
    : AUTOMATIC_PLAYABLE_FIELDS[field].openField;
  return positions.map((position) => ({ ...position }));
}

export function ensurePlayableFieldIsLegal(
  positions: readonly PlayableFieldPosition[] | undefined,
  field: FieldSetting,
  overNumber: number,
  maxOvers = 20,
): PlayableFieldPosition[] {
  if (positions && getPlayableFieldLegality(positions, overNumber, maxOvers).legal) {
    return positions.map((position) => ({ ...position }));
  }
  return getAutomaticPlayableFieldPositions(field, overNumber, maxOvers);
}

function nearestPlayableFielder(
  positions: readonly PlayableFieldPosition[],
  target: DeliveryShotTarget,
  predicate: (position: PlayableFieldPosition) => boolean = () => true,
): { index: number; distance: number } {
  return positions.reduce((nearest, position, index) => {
    if (!predicate(position)) return nearest;
    const distance = Math.hypot(position.x - target.x, position.y - target.y);
    return distance < nearest.distance ? { index, distance } : nearest;
  }, { index: -1, distance: Number.POSITIVE_INFINITY });
}

function projectPlayableShotTarget(
  direction: DeliveryShotTarget,
  radius: number,
): DeliveryShotTarget {
  const dx = direction.x - 50;
  const dy = direction.y - 50;
  const magnitude = Math.max(1, Math.hypot(dx, dy));
  return {
    x: 50 + dx / magnitude * radius,
    y: 50 + dy / magnitude * radius,
  };
}

function playableShotZoneSkill(player: Player, zone: PlayableShotZone): number {
  if (zone === "all-ground") return player.currentBatting;
  if (zone === "offside") {
    return clamp(
      player.currentBatting + (player.isOpener ? 3 : 0) + (player.isCoreBatter ? 2 : 0),
      35,
      99,
    );
  }
  if (zone === "straight") {
    return clamp(
      player.currentBatting + (player.isCoreBatter ? 3 : 0) + (player.currentBatting >= 82 ? 2 : 0),
      35,
      99,
    );
  }
  return clamp(
    player.currentBatting
      + ((player.battingAggression ?? 65) - 65) * 0.12
      + (player.isFinisher ? 4 : 0),
    35,
    99,
  );
}

function playableDirectionOpenness(
  positions: readonly PlayableFieldPosition[],
  direction: DeliveryShotTarget,
): number {
  if (positions.length === 0) return 12;
  const ringDistance = nearestPlayableFielder(
    positions,
    projectPlayableShotTarget(direction, 29),
    (position) => !isPlayableDeepPosition(position),
  ).distance;
  const deepDistance = nearestPlayableFielder(
    positions,
    projectPlayableShotTarget(direction, 44),
    isPlayableDeepPosition,
  ).distance;
  const safeRingDistance = Number.isFinite(ringDistance) ? ringDistance : 24;
  const safeDeepDistance = Number.isFinite(deepDistance) ? deepDistance : 28;
  return clamp(safeRingDistance, 0, 24) * 0.42 + clamp(safeDeepDistance, 0, 28) * 0.58;
}

function automaticPlayableShotZone(
  positions: readonly PlayableFieldPosition[],
  player: Player,
  deliverySeed: string,
  intent: number,
): PlayableShotZone {
  const zones: PlayableShotZone[] = ["offside", "straight", "legside"];
  const ranked = zones.map((zone) => {
    const directions = PLAYABLE_SHOT_ZONE_DIRECTIONS[zone];
    const bestGap = Math.max(...directions.map((direction) => playableDirectionOpenness(positions, direction)));
    const profile = playableShotZoneSkill(player, zone) - player.currentBatting;
    const intentFit = zone === "legside"
      ? Math.max(0, intent) * 2.2
      : zone === "straight"
        ? Math.max(0, intent) * 1.1
        : 0;
    const variation = deterministicUnit(`${deliverySeed}:ai-zone:${zone}`) * 4.5;
    return { zone, score: bestGap + profile * 0.65 + intentFit + variation };
  }).sort((left, right) => right.score - left.score);
  const commitsToTarget = deterministicUnit(`${deliverySeed}:ai-zone-commit`) < clamp(
    0.58 + Math.max(0, intent) * 0.3,
    0.55,
    0.82,
  );
  return commitsToTarget ? ranked[0]?.zone ?? "all-ground" : "all-ground";
}

function playableBowlingPlanZoneModifier(
  plan: PlayableBowlingPlan | undefined,
  zone: PlayableShotZone,
): number {
  if (zone === "all-ground") return 0;
  if (plan === "yorker-attack") return zone === "straight" ? 0.025 : zone === "legside" ? -0.04 : -0.02;
  if (plan === "bouncer-pace") return zone === "offside" ? 0.01 : zone === "legside" ? -0.035 : -0.05;
  if (plan === "spin-choke") return zone === "offside" ? 0 : zone === "straight" ? -0.015 : -0.035;
  return 0;
}

/**
 * Converts the saved field map into delivery-level tactical effects. All rolls
 * are derived from the stable delivery id, so saving/resuming after a ball
 * produces the same shot and outcome.
 */
function playableFieldInfluence(
  positions: readonly PlayableFieldPosition[] | undefined,
  deliverySeed: string,
  intent: number,
  striker: Player,
  bowlingRating: number,
  approach: PlayableBattingApproach | undefined,
  requestedShotZone: PlayableShotZone | undefined,
  bowlingPlan: PlayableBowlingPlan | undefined,
): PlayableFieldInfluence | undefined {
  const validPositions = (positions ?? []).filter((position) => (
    Number.isFinite(position.x)
    && Number.isFinite(position.y)
    && position.x >= 0
    && position.x <= 100
    && position.y >= 0
    && position.y <= 100
  )).slice(0, 9);
  if (validPositions.length === 0 && !requestedShotZone) return undefined;

  const shotZone = requestedShotZone ?? automaticPlayableShotZone(
    validPositions,
    striker,
    deliverySeed,
    intent,
  );
  const zoneSkill = playableShotZoneSkill(striker, shotZone);
  const zoneDirections = PLAYABLE_SHOT_ZONE_DIRECTIONS[shotZone];
  const directionCompliance = shotZone === "all-ground"
    ? 1
    : clamp(
      0.72
        + (zoneSkill - 72) * 0.004
        + (striker.currentBatting - bowlingRating) * 0.002
        + (bowlingPlan === "bouncer-pace" ? -0.08 : bowlingPlan === "yorker-attack" ? -0.055 : bowlingPlan === "spin-choke" ? -0.035 : 0),
      0.55,
      0.9,
    );
  const followsInstruction = shotZone === "all-ground"
    || deterministicUnit(`${deliverySeed}:zone-compliance`) < directionCompliance;
  const zoneDirectionKeys = new Set(zoneDirections.map((direction) => `${direction.x}:${direction.y}`));
  const missedDirections = PLAYABLE_SHOT_DIRECTIONS.filter((direction) => (
    !zoneDirectionKeys.has(`${direction.x}:${direction.y}`)
  ));
  const intendedDirectionPool = followsInstruction
    ? zoneDirections
    : missedDirections.length > 0
      ? missedDirections
      : PLAYABLE_SHOT_DIRECTIONS;
  const gapReading = clamp((striker.currentBatting - 48) / 50, 0.18, 0.94);
  const intendedDirection = intendedDirectionPool.map((direction, index) => ({
    direction,
    score: playableDirectionOpenness(validPositions, direction) * gapReading
      + deterministicUnit(`${deliverySeed}:direction-option:${index}`) * (15 - gapReading * 9),
  })).sort((left, right) => right.score - left.score)[0]?.direction ?? PLAYABLE_SHOT_DIRECTIONS[0];
  const planZoneModifier = playableBowlingPlanZoneModifier(bowlingPlan, shotZone);
  const zoneExecutionMultiplier = shotZone === "all-ground"
    ? 1
    : clamp(
      1
        + (zoneSkill - striker.currentBatting) * 0.006
        + (striker.currentBatting - bowlingRating) * 0.0015
        + planZoneModifier
        + (followsInstruction ? 0 : -0.12),
      0.82,
      1.08,
    );

  const aggression = clamp(
    ((striker.battingAggression ?? 65) - 55) / 45
      + Math.max(0, intent) * 1.2
      + (approach === "six-hitting" ? 0.38 : approach === "attack" ? 0.18 : 0),
    0,
    1.5,
  );
  const shotRoll = deterministicUnit(`${deliverySeed}:elevation`);
  const executionMistime = Math.max(0, 1 - zoneExecutionMultiplier);
  const edgeChance = clamp(
    0.055 - Math.max(0, intent) * 0.025 + executionMistime * 0.11,
    0.025,
    0.085,
  );
  const skierChance = clamp(
    0.035 + aggression * 0.075 + executionMistime * 0.09,
    0.035,
    0.17,
  );
  const loftedChance = clamp(0.13 + aggression * 0.17, 0.13, 0.38);
  const shotType: DeliveryShotType = shotRoll < edgeChance
    ? "edge"
    : shotRoll < edgeChance + skierChance
      ? "skier"
      : shotRoll < edgeChance + skierChance + loftedChance
        ? "lofted"
        : "ground";

  const direction = shotType === "edge"
    ? PLAYABLE_EDGE_TARGETS[
      Math.floor(deterministicUnit(`${deliverySeed}:edge-direction`) * PLAYABLE_EDGE_TARGETS.length)
    ] ?? PLAYABLE_EDGE_TARGETS[0]
    : intendedDirection;
  const jitterX = (deterministicUnit(`${deliverySeed}:jitter-x`) - 0.5) * 6;
  const jitterY = (deterministicUnit(`${deliverySeed}:jitter-y`) - 0.5) * 6;
  const rawDirection = {
    x: clamp(direction.x + jitterX, 4, 96),
    y: clamp(direction.y + jitterY, 4, 94),
  };
  const catchTarget = shotType === "edge"
    ? rawDirection
    : projectPlayableShotTarget(rawDirection, shotType === "skier" ? 31 : shotType === "lofted" ? 39 : 25);
  const boundaryTarget = projectPlayableShotTarget(rawDirection, 44);
  const ringTarget = projectPlayableShotTarget(rawDirection, 29);
  const catchFielder = nearestPlayableFielder(validPositions, catchTarget);
  const ringFielder = nearestPlayableFielder(
    validPositions,
    ringTarget,
    (position) => !isPlayableDeepPosition(position),
  );
  const deepFielder = nearestPlayableFielder(
    validPositions,
    boundaryTarget,
    isPlayableDeepPosition,
  );

  const fieldBoundaryMultiplier = Number.isFinite(deepFielder.distance)
    ? clamp(0.72 + Math.max(0, deepFielder.distance - 6) * 0.021, 0.72, 1.22)
    : 1.22;
  const fieldRotationMultiplier = Number.isFinite(ringFielder.distance)
    ? clamp(0.72 + Math.max(0, ringFielder.distance - 4) * 0.025, 0.72, 1.18)
    : 1.18;
  const boundaryOpportunityMultiplier = clamp(
    fieldBoundaryMultiplier * zoneExecutionMultiplier,
    0.66,
    1.28,
  );
  const rotationMultiplier = clamp(
    fieldRotationMultiplier * (1 + (zoneExecutionMultiplier - 1) * 0.55),
    0.68,
    1.22,
  );
  const fieldWicketAdjustment = shotType === "skier"
    ? catchFielder.distance <= 7
      ? 0.026
      : catchFielder.distance <= 14
        ? 0.016
        : catchFielder.distance <= 22
          ? 0.006
          : -0.007
    : shotType === "edge"
      ? catchFielder.distance <= 7
        ? 0.014
        : catchFielder.distance <= 14
          ? 0.006
          : -0.004
      : shotType === "lofted" && catchFielder.distance <= 9
        ? 0.005
        : 0;
  const wicketAdjustment = clamp(
    fieldWicketAdjustment
      + executionMistime * 0.055
      + (!followsInstruction ? 0.004 : 0),
    -0.008,
    0.035,
  );
  const caughtWeightMultiplier = shotType === "skier"
    ? (catchFielder.distance <= 14 ? 3.2 : 1.7)
    : shotType === "edge"
      ? (catchFielder.distance <= 14 ? 3.8 : 1.8)
      : shotType === "lofted"
        ? 1.45
        : 0.72;
  const runOutWeightMultiplier = Number.isFinite(ringFielder.distance)
    ? clamp(2.25 - ringFielder.distance * 0.075, 0.5, 2.1)
    : 0.5;

  return {
    shotType,
    shotTarget: rawDirection,
    shotZone,
    catchFielderIndex: catchFielder.index,
    catchDistance: catchFielder.distance,
    ringFielderIndex: ringFielder.index,
    ringDistance: ringFielder.distance,
    boundaryOpportunityMultiplier,
    rotationMultiplier,
    wicketAdjustment,
    caughtWeightMultiplier,
    runOutWeightMultiplier,
  };
}

function seededGaussian(value: string): number {
  const left = Math.max(0.0001, hashSeed(`${value}:left`) / 4294967296);
  const right = hashSeed(`${value}:right`) / 4294967296;
  return Math.sqrt(-2 * Math.log(left)) * Math.cos(2 * Math.PI * right);
}

export interface BattingConsistencyProfile {
  matchVarianceMultiplier: number;
  inningsShockScale: number;
  inningsPersistence: number;
}

/**
 * Consistency controls the spread and persistence of batting outcomes, never
 * their average. High values produce smaller, short-lived deviations; low
 * values allow both prolonged failures and exceptional innings.
 */
export function battingConsistencyProfile(consistencyValue: number | undefined): BattingConsistencyProfile {
  const consistency = clamp(consistencyValue ?? 50, 1, 99);
  const distanceFromNeutral = (consistency - 50) / 49;
  const positive = Math.max(0, distanceFromNeutral);
  const negative = Math.max(0, -distanceFromNeutral);

  return {
    matchVarianceMultiplier: 1 - positive * 0.48 + negative * 0.45,
    inningsShockScale: 0.34 - positive * 0.20 + negative * 0.28,
    inningsPersistence: 0.52 - positive * 0.27 + negative * 0.22,
  };
}

export function advanceBattingConsistencyMomentum(
  previousMomentum: number,
  consistencyValue: number | undefined,
  seed: string,
): number {
  const profile = battingConsistencyProfile(consistencyValue);
  return clamp(
    previousMomentum * profile.inningsPersistence
      + seededGaussian(seed) * profile.inningsShockScale,
    -3.5,
    3.5,
  );
}

export interface BowlingConsistencyProfile {
  matchVarianceMultiplier: number;
  deliveryShockScale: number;
  deliveryPersistence: number;
}

/**
 * Bowling consistency is value-neutral: it changes how widely and how long a
 * bowler deviates from currentBowling, without adding to their expected skill.
 */
export function bowlingConsistencyProfile(consistencyValue: number | undefined): BowlingConsistencyProfile {
  const consistency = clamp(consistencyValue ?? 50, 1, 99);
  const distanceFromNeutral = (consistency - 50) / 49;
  const positive = Math.max(0, distanceFromNeutral);
  const negative = Math.max(0, -distanceFromNeutral);

  return {
    matchVarianceMultiplier: 1 - positive * 0.48 + negative * 0.45,
    deliveryShockScale: 0.38 - positive * 0.22 + negative * 0.30,
    deliveryPersistence: 0.56 - positive * 0.29 + negative * 0.22,
  };
}

export function advanceBowlingConsistencyMomentum(
  previousMomentum: number,
  consistencyValue: number | undefined,
  seed: string,
  pressureMultiplier = 1,
): number {
  const profile = bowlingConsistencyProfile(consistencyValue);
  return clamp(
    previousMomentum * profile.deliveryPersistence
      + seededGaussian(seed) * profile.deliveryShockScale * clamp(pressureMultiplier, 1, 1.5),
    -4,
    4,
  );
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
  const primaryKeepers = fielders.filter((player) => (
    player.role === "WK-Batsman" || Boolean(player.isWicketkeeper)
  ));
  const partTimeKeepers = fielders.filter((player) => (
    Boolean(player.isPartTimeWk)
    && player.role !== "WK-Batsman"
    && !player.isWicketkeeper
  ));
  const bestKeeper = (candidates: Player[]) => candidates.sort((left, right) => (
    effectiveWicketkeepingRating(right) - effectiveWicketkeepingRating(left)
  ))[0];
  return bestKeeper(primaryKeepers) ?? bestKeeper(partTimeKeepers);
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

/** The exact pool used by both smart selection and playable-match overrides. */
export function getPlayableBowlingOptions(teamPlayers: readonly Player[]): Player[] {
  const candidates = teamPlayers.filter((player) => isBowlingOption(player));
  const fallback = teamPlayers
    .filter((player) => player.currentBowling >= 45 && player.role !== "WK-Batsman")
    .sort((left, right) => right.currentBowling - left.currentBowling);

  // Five bowlers are needed to cover 20 overs legally. If a lineup exposes
  // fewer recognised options, supplement it with the best part-time choices.
  return candidates.length >= 5
    ? candidates
    : [
        ...candidates,
        ...fallback.filter((player) => !candidates.some((candidate) => candidate.id === player.id)),
      ].slice(0, Math.min(5, fallback.length));
}

function battingAllRounderUsagePenalty(player: Player | undefined): number {
  if (!player) return 0;
  const isBattingLed = (
    (player.role === "All-Rounder" && player.currentBatting >= 74)
    || player.currentBatting >= 78
  );
  return isBattingLed ? 22 * clamp((82 - player.currentBowling) / 14, 0, 1) : 0;
}

/** Smoothly reduces the extra wicket threat of batting-led all-rounders. */
export function battingAllRounderWicketRelief(player: Player | undefined): number {
  if (!player) return 0;
  const isBattingLed = (
    (player.role === "All-Rounder" && player.currentBatting >= 74)
    || player.currentBatting >= 78
  );
  if (!isBattingLed) return 0;
  return 0.012 * clamp((82 - player.currentBowling) / 14, 0, 1);
}

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

function inningsPhaseThresholds(maxOvers = 20) {
  const powerplayEnd = Math.max(2, Math.round(maxOvers * 0.3));
  const deathLength = Math.max(2, Math.round(maxOvers * 0.25));
  const deathStart = Math.max(powerplayEnd + 1, maxOvers - deathLength + 1);
  return { powerplayEnd, deathStart };
}

export type InningsPhase = "powerplay" | "middle" | "death";

export interface PhaseMatchup {
  phase: InningsPhase;
  battingSignal: number;
  bowlingSignal: number;
  edge: number;
}

export interface PhaseOutcomeModifiers {
  dot: number;
  single: number;
  two: number;
  four: number;
  six: number;
  wicket: number;
  widePressure: number;
  noBallPressure: number;
}

const NEUTRAL_PHASE_OUTCOME_MODIFIERS: PhaseOutcomeModifiers = {
  dot: 1, single: 1, two: 1, four: 1, six: 1,
  wicket: 1, widePressure: 1, noBallPressure: 1,
};

export function normalizePhaseRating(value: number | undefined): number {
  const rating = Number.isFinite(value) ? clamp(value!, 0, 100) : 50;
  return (rating - 50) / 50;
}

export function getInningsPhase(overNumber: number, maxOvers = 20): InningsPhase {
  const { powerplayEnd, deathStart } = inningsPhaseThresholds(maxOvers);
  if (overNumber <= powerplayEnd) return "powerplay";
  if (overNumber < deathStart) return "middle";
  return "death";
}

type PhaseRatedPlayer = Pick<Player,
  | "powerplayBatting" | "middleOversBatting" | "deathBatting"
  | "powerplayBowling" | "middleOversBowling" | "deathBowling"
>;

export function getPlayerPhaseRating(
  player: PhaseRatedPlayer,
  discipline: "batting" | "bowling",
  phase: InningsPhase,
): number | undefined {
  if (discipline === "batting") {
    if (phase === "powerplay") return player.powerplayBatting;
    if (phase === "middle") return player.middleOversBatting;
    return player.deathBatting;
  }
  if (phase === "powerplay") return player.powerplayBowling;
  if (phase === "middle") return player.middleOversBowling;
  return player.deathBowling;
}

export function getPhaseMatchup(
  batter: PhaseRatedPlayer,
  bowler: PhaseRatedPlayer,
  overNumber: number,
  maxOvers = 20,
): PhaseMatchup {
  const phase = getInningsPhase(overNumber, maxOvers);
  const battingSignal = normalizePhaseRating(getPlayerPhaseRating(batter, "batting", phase));
  const bowlingSignal = normalizePhaseRating(getPlayerPhaseRating(bowler, "bowling", phase));
  return { phase, battingSignal, bowlingSignal, edge: clamp(battingSignal - bowlingSignal, -2, 2) };
}

export function getPhaseOutcomeModifiers(matchup: PhaseMatchup): PhaseOutcomeModifiers {
  const edge = clamp(matchup.edge, -2, 2);
  if (matchup.phase === "powerplay") {
    return {
      ...NEUTRAL_PHASE_OUTCOME_MODIFIERS,
      dot: clamp(1 - 0.055 * edge, 0.89, 1.11),
      four: clamp(1 + 0.09 * edge, 0.82, 1.18),
      six: clamp(1 + 0.07 * edge, 0.86, 1.14),
      wicket: clamp(1 - 0.075 * edge, 0.85, 1.15),
    };
  }
  if (matchup.phase === "middle") {
    return {
      ...NEUTRAL_PHASE_OUTCOME_MODIFIERS,
      dot: clamp(1 - 0.07 * edge, 0.86, 1.14),
      single: clamp(1 + 0.06 * edge, 0.88, 1.12),
      two: clamp(1 + 0.05 * edge, 0.90, 1.10),
      four: clamp(1 + 0.035 * edge, 0.93, 1.07),
      six: clamp(1 + 0.025 * edge, 0.95, 1.05),
      wicket: clamp(1 - 0.06 * edge, 0.88, 1.12),
    };
  }
  return {
    ...NEUTRAL_PHASE_OUTCOME_MODIFIERS,
    dot: clamp(1 - 0.06 * edge, 0.88, 1.12),
    single: clamp(1 - 0.025 * edge, 0.95, 1.05),
    four: clamp(1 + 0.075 * edge, 0.85, 1.15),
    six: clamp(1 + 0.10 * edge, 0.80, 1.20),
    wicket: clamp(1 - 0.035 * edge, 0.93, 1.07),
    widePressure: clamp(1 - 0.10 * matchup.bowlingSignal, 0.90, 1.10),
    noBallPressure: clamp(1 - 0.08 * matchup.bowlingSignal, 0.92, 1.08),
  };
}

export type BowlingFamily = "pace" | "spin";

type BowlingTypeRatedBatter = Pick<Player,
  "paceRating" | "spinRating" | "battingAggression" | "aggression" | "battingConsistency" | "stamina"
>;

export function getBowlingFamily(player: Pick<Player, "role" | "bowlingStyle">): BowlingFamily | undefined {
  if (player.role === "Spin Bowler" || player.bowlingStyle === "Spinner") return "spin";
  if (player.role === "Pace Bowler" || player.bowlingStyle === "Pacer") return "pace";
  return undefined;
}

export function getBattingTypeRating(
  batter: Pick<Player, "paceRating" | "spinRating">,
  family: BowlingFamily | undefined,
): number {
  if (family === "pace") return Number.isFinite(batter.paceRating) ? clamp(batter.paceRating!, 0, 100) : 50;
  if (family === "spin") return Number.isFinite(batter.spinRating) ? clamp(batter.spinRating!, 0, 100) : 50;
  return 50;
}

export function getBattingTypeOutcomeModifiers(
  batter: BowlingTypeRatedBatter,
  bowler: Pick<Player, "role" | "bowlingStyle" | "currentBowling">,
  matchupPressure = 0,
): PhaseOutcomeModifiers {
  const family = getBowlingFamily(bowler);
  if (!family) return NEUTRAL_PHASE_OUTCOME_MODIFIERS;

  const ratingSignal = normalizePhaseRating(getBattingTypeRating(batter, family));
  const quality = clamp((bowler.currentBowling - 55) / 30, 0, 1);
  const qualityScale = 0.65 + quality * 0.35;
  // Matchup technique supplies the average edge. Batting consistency remains
  // value-neutral and changes only match luck plus delivery momentum elsewhere
  // in the innings engine; it must never strengthen an edge or soften a flaw.
  const signal = clamp(ratingSignal * qualityScale, -1, 1);
  const pressure = clamp(matchupPressure, 0, 1);
  const aggression = clamp(((batter.battingAggression ?? batter.aggression ?? 65) - 40) / 55, 0, 1);

  return {
    dot: clamp(1 - signal * 0.08 + pressure * 0.06, 0.84, 1.18),
    single: clamp(1 + signal * 0.06 - pressure * 0.06, 0.84, 1.16),
    two: clamp(1 + signal * 0.04 - pressure * 0.025, 0.88, 1.12),
    four: clamp(1 + signal * (0.035 + aggression * 0.035) + pressure * (0.02 + aggression * 0.035), 0.86, 1.16),
    six: clamp(1 + signal * (0.025 + aggression * 0.05) + pressure * (0.015 + aggression * 0.05), 0.84, 1.18),
    wicket: clamp(1 - signal * (0.07 + aggression * 0.03) + pressure * (0.05 + aggression * 0.06), 0.82, 1.22),
    widePressure: 1,
    noBallPressure: 1,
  };
}

export function advanceBattingTypePressure(
  previousPressure: number,
  matchupRating: number | undefined,
  runsOffBat: number,
  isWicket: boolean,
  isLegal: boolean,
): number {
  if (!isLegal) return clamp(previousPressure, 0, 1);
  if (isWicket) return 0;
  const signal = normalizePhaseRating(matchupRating);
  if (runsOffBat === 0) return clamp(previousPressure + 0.10 * (1 - signal * 0.55), 0, 1);
  if (runsOffBat === 1) return clamp(previousPressure - 0.11 * (1 + Math.max(0, signal) * 0.25), 0, 1);
  if (runsOffBat === 2 || runsOffBat === 3) return clamp(previousPressure - 0.18, 0, 1);
  return clamp(previousPressure - 0.35, 0, 1);
}

function multiplyOutcomeModifiers(
  left: PhaseOutcomeModifiers,
  right: PhaseOutcomeModifiers,
): PhaseOutcomeModifiers {
  return {
    dot: left.dot * right.dot,
    single: left.single * right.single,
    two: left.two * right.two,
    four: left.four * right.four,
    six: left.six * right.six,
    wicket: left.wicket * right.wicket,
    widePressure: left.widePressure * right.widePressure,
    noBallPressure: left.noBallPressure * right.noBallPressure,
  };
}

export function bowlingTypeSelectionBonus(
  bowler: Pick<Player, "role" | "bowlingStyle">,
  striker: Pick<Player, "paceRating" | "spinRating"> | undefined,
  nonStriker: Pick<Player, "paceRating" | "spinRating"> | undefined,
  captaincyRating = 50,
): number {
  const family = getBowlingFamily(bowler);
  if (!family || !striker) return 0;
  const strikerRating = getBattingTypeRating(striker, family);
  const nonStrikerRating = nonStriker ? getBattingTypeRating(nonStriker, family) : 50;
  const weightedRating = strikerRating * 0.68 + nonStrikerRating * 0.32;
  const captaincyAccess = 0.65 + clamp(captaincyRating, 0, 100) / 100 * 0.35;
  return clamp((50 - weightedRating) * 0.18 * captaincyAccess, -5.5, 5.5);
}

function battingIntent(
  tactics: TeamTactics,
  overNumber: number,
  wickets: number,
  runs: number,
  target?: number,
  maxOvers = 20,
): number {
  const { powerplayEnd, deathStart } = inningsPhaseThresholds(maxOvers);
  let intent = overNumber <= powerplayEnd
    ? ({ cautious: -0.12, balanced: 0, attack: 0.13 }[tactics.batting.powerplay])
    : overNumber < deathStart
      ? ({ rebuild: -0.12, rotate: -0.02, dominate: 0.12 }[tactics.batting.middle])
      : ({ preserve: -0.08, flexible: 0.06, "all-out": 0.2 }[tactics.batting.death]);

  const collapse = (
    (overNumber <= powerplayEnd + 2 && wickets >= 3)
    || (overNumber < deathStart && wickets >= 5)
  );
  if (collapse) {
    intent += {
      "keep-attacking": 0.08,
      stabilise: -0.08,
      "deep-rebuild": -0.15,
    }[tactics.batting.collapseResponse];
  }

  if (target) {
    const inningsBalls = maxOvers * 6;
    const ballsRemaining = Math.max(1, inningsBalls - ((overNumber - 1) * 6));
    const requiredRate = Math.max(0, target - runs) / ballsRemaining;
    const parPerBall = target / inningsBalls;
    const pressure = clamp((requiredRate - parPerBall) * 0.28, -0.1, 0.28);
    intent += pressure;
    intent += {
      "stay-with-rate": 0,
      "preserve-wickets": wickets >= 4 ? -0.07 : -0.03,
      "front-load": overNumber <= Math.ceil(maxOvers / 2) ? 0.08 : 0.03,
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
  maxOvers = 20,
): FieldSetting {
  const { deathStart } = inningsPhaseThresholds(maxOvers);
  if (target && runs < target) {
    const ballsRemaining = Math.max(1, maxOvers * 6 - (overNumber - 1) * 6);
    const remainingRuns = target - runs;
    const requiredRunRate = remainingRuns / (ballsRemaining / 6);
    if (requiredRunRate >= 12) return "defensive";
    if (ballsRemaining <= 30 && requiredRunRate <= 8 && wickets < 7) return "attacking";
  } else if (overNumber >= deathStart && wickets <= 4) {
    return "attacking";
  }
  if (wickets >= 4 && overNumber < deathStart) return "attacking";
  return selectedField;
}

function bowlingTacticalAdjustment(
  tactics: TeamTactics,
  overNumber: number,
  bowler: Player,
  field: FieldSetting,
  maxOvers = 20,
): { wicket: number; scoring: number } {
  const { powerplayEnd, deathStart } = inningsPhaseThresholds(maxOvers);
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

  if (overNumber <= powerplayEnd) {
    if (tactics.bowling.powerplay === "swing-attack" && isPacer(bowler)) wicket += 0.006;
    if (tactics.bowling.powerplay === "contain") scoring -= 0.04;
  } else if (overNumber < deathStart) {
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

function automaticPlayableBowlingPlan(
  tactics: TeamTactics,
  overNumber: number,
  bowler: Player,
  maxOvers = 20,
): PlayableBowlingPlan {
  const { powerplayEnd, deathStart } = inningsPhaseThresholds(maxOvers);
  if (overNumber >= deathStart) {
    if (tactics.bowling.death === "yorkers" && isPacer(bowler)) return "yorker-attack";
    if (tactics.bowling.death === "wicket-hunt") {
      return isSpinner(bowler) ? "spin-choke" : "bouncer-pace";
    }
    return isPacer(bowler) ? "yorker-attack" : "spin-choke";
  }
  if (overNumber > powerplayEnd) {
    if (tactics.bowling.middle === "spin-choke" && isSpinner(bowler)) return "spin-choke";
    if (tactics.bowling.middle === "pace" && isPacer(bowler)) return "bouncer-pace";
  }
  return "good-length";
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

interface BowlerMatchFigures {
  balls: number;
  runs: number;
  wickets: number;
}

interface BowlerSelectionMatchState {
  runs: number;
  wickets: number;
  legalBalls: number;
  target?: number;
  recentOverRuns: readonly number[];
  figuresByBowler: ReadonlyMap<string, BowlerMatchFigures>;
}

interface BowlerSelection {
  player: Player;
  reason: BowlerSelectionReason;
}

export function phaseBowlingSelectionBonus(player: PhaseRatedPlayer, phase: InningsPhase): number {
  return normalizePhaseRating(getPlayerPhaseRating(player, "bowling", phase)) * 6;
}

export function combinedDeathReserveOvers(maxOvers: number): number {
  const { deathStart } = inningsPhaseThresholds(maxOvers);
  const deathOvers = Math.max(1, maxOvers - deathStart + 1);
  return Math.min(3, Math.max(1, Math.round(deathOvers * 0.6)));
}

export function projectedChaseFinishBall(
  runs: number,
  target: number | undefined,
  legalBalls: number,
  recentOverRuns: readonly number[],
  wickets = 0,
): number | undefined {
  return projectedChaseFinishWindow(runs, target, legalBalls, recentOverRuns, wickets)?.central;
}

export interface ChaseFinishWindow {
  fast: number;
  central: number;
  slow: number;
}

export function projectedChaseFinishWindow(
  runs: number,
  target: number | undefined,
  legalBalls: number,
  recentOverRuns: readonly number[],
  wickets = 0,
): ChaseFinishWindow | undefined {
  if (!target || runs >= target || legalBalls < 12 || runs < target * 0.25) return undefined;
  const recentRuns = recentOverRuns.slice(-2).reduce((sum, value) => sum + value, 0);
  const recentBalls = Math.min(12, recentOverRuns.length * 6);
  const inningsRate = runs / Math.max(1, legalBalls);
  const recentRate = recentBalls > 0 ? recentRuns / recentBalls : inningsRate;
  const wicketFactor = wickets <= 2 ? 1.05 : wickets >= 6 ? 0.95 : 1;
  const finishAt = (recentWeight: number) => {
    const projectedRate = Math.max(
      0.15,
      (recentRate * recentWeight + inningsRate * (1 - recentWeight)) * wicketFactor,
    );
    return legalBalls + (target - runs) / projectedRate;
  };
  const projections = [finishAt(0.8), finishAt(0.65), finishAt(0.35)].sort((a, b) => a - b);
  return { fast: projections[0], central: projections[1], slow: projections[2] };
}

function bowlerMatchPerformanceAdjustment(figures: BowlerMatchFigures | undefined): number {
  if (!figures || figures.balls < 12) return 0;
  const economy = figures.runs / (figures.balls / 6);
  return clamp((8.5 - economy) * 0.4, -3, 3) + Math.min(1.5, figures.wickets * 0.5);
}

function deathSuitability(player: Player, pitch: CuratorPitch, tactics: TeamTactics): number {
  let score = player.currentBowling
    + phaseBowlingSelectionBonus(player, "death")
    + bowlingPitchAdjustment(player, pitch);
  if (tactics.bowling.death === "yorkers" && isPacer(player)) score += 3;
  if (tactics.bowling.death === "wicket-hunt") score += player.currentBowling >= 75 ? 2 : 0;
  return score;
}

function plannedReservedDeathSlots(
  reserveGroup: readonly Player[],
  ballsByBowler: ReadonlyMap<string, number>,
  maxBowlerOvers: number,
  deathStart: number,
  inningsOvers: number,
): Map<string, number[]> {
  const slots = new Map(reserveGroup.map((player) => [player.id, [] as number[]]));
  const capacity = new Map(reserveGroup.map((player) => [
    player.id,
    Math.max(0, maxBowlerOvers - Math.floor((ballsByBowler.get(player.id) ?? 0) / 6)),
  ]));
  const wanted = combinedDeathReserveOvers(inningsOvers);
  let previousId = "";
  for (let index = 0; index < wanted; index += 1) {
    const over = Math.max(deathStart, inningsOvers - wanted + index + 1);
    const candidate = reserveGroup.find((player) => (
      player.id !== previousId && (capacity.get(player.id) ?? 0) > 0
    )) ?? reserveGroup.find((player) => (capacity.get(player.id) ?? 0) > 0);
    if (!candidate) break;
    slots.get(candidate.id)!.push(over);
    capacity.set(candidate.id, (capacity.get(candidate.id) ?? 0) - 1);
    previousId = candidate.id;
  }
  return slots;
}

function chooseBowler(
  overNumber: number,
  inningsOvers: number,
  fieldingIds: readonly string[],
  players: Record<string, Player>,
  ballsByBowler: ReadonlyMap<string, number>,
  previousBowlerId: string | null,
  tactics: TeamTactics,
  pitch: CuratorPitch,
  captaincyRating: number,
  unavailableUntilOver: ReadonlyMap<string, number>,
  matchState: BowlerSelectionMatchState,
  currentBatters: readonly [Player | undefined, Player | undefined],
  rng: SimulationRandom,
): BowlerSelection {
  const { powerplayEnd, deathStart } = inningsPhaseThresholds(inningsOvers);
  const maxBowlerOvers = Math.ceil(inningsOvers / 5);
  const teamPlayers = fieldingIds
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player));
  const pool = getPlayableBowlingOptions(teamPlayers);
  const withCapacity = pool.filter((player) => (
    (ballsByBowler.get(player.id) ?? 0) < maxBowlerOvers * 6
    && player.id !== previousBowlerId
  ));
  const restedWithCapacity = withCapacity.filter((player) => (
    (unavailableUntilOver.get(player.id) ?? 0) <= overNumber
  ));
  const remainingOversAfterThis = inningsOvers - overNumber;
  const feasible = restedWithCapacity.filter((candidate) => {
    const remainingCapacity = new Map(pool.map((player) => [
      player.id,
      Math.max(0, maxBowlerOvers - Math.floor((ballsByBowler.get(player.id) ?? 0) / 6)),
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
    : pool.filter((player) => (ballsByBowler.get(player.id) ?? 0) < maxBowlerOvers * 6);
  const frontlineBowlerIds = new Set(
    [...pool]
      .sort((left, right) => right.currentBowling - left.currentBowling)
      .slice(0, Math.min(4, pool.length))
      .map((player) => player.id),
  );
  const reserveGroup = [...pool]
    .filter((player) => player.currentBowling >= 65)
    .sort((left, right) => (
      deathSuitability(right, pitch, tactics) - deathSuitability(left, pitch, tactics)
    ))
    .slice(0, 2);
  const deathBowlerIds = new Set(
    reserveGroup.map((player) => player.id),
  );
  const plannedDeathSlots = plannedReservedDeathSlots(
    reserveGroup,
    ballsByBowler,
    maxBowlerOvers,
    deathStart,
    inningsOvers,
  );
  const combinedReserveCapacity = reserveGroup.reduce((sum, player) => (
    sum + Math.max(0, maxBowlerOvers - Math.floor((ballsByBowler.get(player.id) ?? 0) / 6))
  ), 0);
  const requiredReserve = Math.min(
    combinedDeathReserveOvers(inningsOvers),
    Array.from(plannedDeathSlots.values()).reduce((sum, slots) => sum + slots.length, 0),
  );
  const projectedFinishWindow = projectedChaseFinishWindow(
    matchState.runs,
    matchState.target,
    matchState.legalBalls,
    matchState.recentOverRuns,
    matchState.wickets,
  );
  const topOverallBowlerIds = new Set(
    [...pool]
      .sort((left, right) => right.currentBowling - left.currentBowling)
      .slice(0, 2)
      .map((player) => player.id),
  );

  const captaincyQuality = clamp(captaincyRating / 100, 0, 1);
  const phaseFitMultiplier = 0.94 + captaincyQuality * 0.12;
  const decisionNoise = 1.45 - captaincyQuality * 0.55;
  const scored = eligible.map((player) => {
    let score = player.currentBowling + bowlingPitchAdjustment(player, pitch);
    const ballsBowled = ballsByBowler.get(player.id) ?? 0;
    const phase = getInningsPhase(overNumber, inningsOvers);
    const phaseSelectionBonus = phaseBowlingSelectionBonus(player, phase);
    score += phaseSelectionBonus;
    const batterMatchupBonus = bowlingTypeSelectionBonus(
      player,
      currentBatters[0],
      currentBatters[1],
      captaincyRating,
    );
    score += batterMatchupBonus;
    let phaseFit = 0;
    if (overNumber <= powerplayEnd && isPacer(player)) phaseFit += 5;
    if (overNumber > powerplayEnd && overNumber < deathStart && isSpinner(player)) phaseFit += 5;
    if (overNumber >= deathStart && isPacer(player)) phaseFit += 4;
    if (overNumber <= powerplayEnd && tactics.bowling.powerplay === "swing-attack" && isPacer(player)) phaseFit += 3;
    if (overNumber > powerplayEnd && overNumber < deathStart && tactics.bowling.middle === "spin-choke" && isSpinner(player)) phaseFit += 4;
    if (overNumber >= deathStart && tactics.bowling.death === "yorkers" && isPacer(player)) phaseFit += 3;
    score += phaseFit * phaseFitMultiplier;
    const matchPerformanceAdjustment = bowlerMatchPerformanceAdjustment(
      matchState.figuresByBowler.get(player.id),
    );
    score += matchPerformanceAdjustment;
    const recentAverage = matchState.recentOverRuns.slice(-2).reduce((sum, value) => sum + value, 0)
      / Math.max(1, Math.min(2, matchState.recentOverRuns.length));
    const selectionPressure = clamp(
      (overNumber >= deathStart ? 0.45 : 0)
      + Math.max(0, recentAverage - 9) * 0.07
      + (projectedFinishWindow?.central !== undefined
        && projectedFinishWindow.central <= (deathStart - 1) * 6 ? 0.35 : 0),
      0,
      1,
    );
    score += attributeSignal(player.pressureRating) * selectionPressure * 4;
    const established = player.currentBowling >= 75 || topOverallBowlerIds.has(player.id);
    const surgeBonus = established ? clamp((recentAverage - 10) * 1.5, 0, 8) : 0;
    score += surgeBonus;
    let reservationPenalty = 0;
    if (overNumber < deathStart && deathBowlerIds.has(player.id)) {
      const capacityAfterSelection = combinedReserveCapacity - 1;
      reservationPenalty = Math.max(0, requiredReserve - capacityAfterSelection) * 12;
      score -= reservationPenalty;
    }
    const nextPlannedDeathOver = plannedDeathSlots.get(player.id)?.[0];
    const plannedStartBall = nextPlannedDeathOver === undefined
      ? undefined
      : (nextPlannedDeathOver - 1) * 6;
    const oversTooLate = projectedFinishWindow !== undefined && plannedStartBall !== undefined
      ? (plannedStartBall - projectedFinishWindow.central) / 6
      : 0;
    const targetAtRiskBonus = established && plannedStartBall !== undefined && projectedFinishWindow !== undefined
      ? projectedFinishWindow.slow <= plannedStartBall
        ? clamp(8 + Math.max(0, oversTooLate) * 8, 8, 24)
        : projectedFinishWindow.fast <= plannedStartBall
          ? clamp(4 + Math.max(0, oversTooLate) * 4, 4, 12)
          : 0
      : 0;
    score += targetAtRiskBonus;
    const oversBowled = Math.floor(ballsBowled / 6);
    if (frontlineBowlerIds.has(player.id)) {
      const oversStillWanted = Math.max(0, maxBowlerOvers - oversBowled);
      // Frontline quality becomes increasingly decisive late in the innings,
      // preventing surface preferences from leaving superior bowlers unused.
      score += oversStillWanted * (overNumber >= deathStart ? 5 : overNumber >= Math.ceil(inningsOvers * 0.6) ? 2.5 : 1);
      if (overNumber >= deathStart + 1 && oversStillWanted >= 2) score += 9;
    }
    if (deathBowlerIds.has(player.id) && overNumber >= deathStart) score += 7;
    // Heavy penalty for part-timers in death overs to keep death overs strictly for specialists
    if (overNumber >= deathStart && (!isBowlingOption(player) || player.currentBowling < 65)) {
      score -= 50;
    }
    // Selection penalty for batting all-rounders so primary specialist bowlers bowl first
    const battingAllRounderPenalty = battingAllRounderUsagePenalty(player);
    if (battingAllRounderPenalty > 0) {
      score -= battingAllRounderPenalty;
      if (oversBowled >= 2) {
        score -= battingAllRounderPenalty * (30 / 22);
      }
    }
    score -= ballsBowled * 0.12;
    // Strong captains are a little more consistent at identifying the right
    // bowler for the phase; this changes selection, never execution ratings.
    score += rng.gaussian() * decisionNoise;
    const reason: BowlerSelectionReason = targetAtRiskBonus > 0
      ? "target-at-risk"
      : overNumber >= deathStart && deathBowlerIds.has(player.id)
        ? "death-reserved"
        : batterMatchupBonus >= 2
          ? "batter-matchup"
        : phaseSelectionBonus >= 2
          ? "phase-specialist"
          : Math.abs(bowlingPitchAdjustment(player, pitch)) >= 3
            ? "pitch-matchup"
            : "smart-selection";
    return { player, score, reason };
  });

  const selected = scored.sort((left, right) => right.score - left.score)[0];
  return selected
    ? { player: selected.player, reason: selected.reason }
    : { player: pool[0], reason: "rotation-required" };
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
    const relevantRating = wicketkeeperOnly
      ? effectiveWicketkeepingRating(player)
      : effectiveFieldingRating(player);
    return {
      value: player,
      // Better fielders reach more chances, without unrealistically funnelling
      // every dismissal to the strongest member of the XI.
      weight: 20 + relevantRating * 0.55,
    };
  }));
}

export function effectiveFieldingRating(player: Player): number {
  if (Number.isFinite(player.fieldingRating)) {
    return clamp(player.fieldingRating!, 0, 100);
  }
  const ageAdjustment = player.age <= 28 ? 4 : player.age <= 33 ? 1 : -3;
  const generalAbility = Math.max(player.currentBatting, player.currentBowling);
  return clamp(
    54 + generalAbility * 0.24 + (player.reputation ?? 5) * 0.8 + ageAdjustment,
    55,
    91,
  );
}

export function effectiveWicketkeepingRating(player: Player | undefined): number {
  if (!player) return 48;

  if (Number.isFinite(player.wicketkeepingRating)) {
    return clamp(player.wicketkeepingRating!, 0, 100);
  }

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

export function attributeSignal(value: number | undefined): number {
  return clamp(((Number.isFinite(value) ? value! : 50) - 50) / 50, -1, 1);
}

export function knockoutBigMatchIntensity(stage: string | undefined): number {
  const normalized = stage?.toLowerCase().replace(/[\s_-]/g, "") ?? "";
  if (normalized.includes("final") && !normalized.includes("qualifier")) return 1;
  if (normalized.includes("qualifier2")) return 0.9;
  if (normalized.includes("eliminator")) return 0.85;
  if (normalized.includes("qualifier1")) return 0.7;
  return 0;
}

export interface SituationalPressureInput {
  inningsNumber: 1 | 2;
  runs: number;
  wickets: number;
  legalBalls: number;
  maxBalls: number;
  expectedScore: number;
  target?: number;
  consecutiveDots: number;
  recentWickets: number;
  batterBalls: number;
  batterPosition: number;
  partnershipBalls: number;
  partnershipRuns: number;
  matchupPressure: number;
  consecutiveBoundaries: number;
  runsThisOver: number;
  bowlerEconomy: number;
  fieldingErrorPressure: number;
}

export function calculateBattingPressure(input: SituationalPressureInput): number {
  const ballsRemaining = Math.max(1, input.maxBalls - input.legalBalls);
  const projectedScore = input.legalBalls > 0
    ? input.runs / input.legalBalls * input.maxBalls
    : input.expectedScore;
  const remainingRuns = input.target ? Math.max(0, input.target - input.runs) : 0;
  const requiredRate = input.target ? remainingRuns / ballsRemaining * 6 : 0;
  const currentRate = input.legalBalls > 0 ? input.runs / input.legalBalls * 6 : 0;
  const chaseDemand = input.target
    ? clamp((requiredRate - 7) / 7, 0, 0.65)
      + clamp((requiredRate - currentRate) / 8, 0, 0.25)
      + (ballsRemaining <= 24 ? clamp(remainingRuns / ballsRemaining - 1, 0, 0.25) : 0)
    : 0;
  const settingDemand = input.target
    ? 0
    : clamp((input.expectedScore - projectedScore) / 55, 0, 0.55)
      * clamp((input.legalBalls - input.maxBalls * 0.45) / (input.maxBalls * 0.4), 0, 1);
  const wicketDemand = clamp((input.wickets - 2) * 0.09 + input.recentWickets * 0.13, 0, 0.48);
  const dotDemand = clamp((input.consecutiveDots - 2) * 0.075, 0, 0.35);
  const arrivalDemand = input.batterBalls <= 4 ? 0.1 : 0;
  const tailDemand = input.batterPosition >= 7 || input.wickets >= 7 ? 0.12 : 0;
  const phaseDemand = ballsRemaining <= 30 ? 0.1 : 0;
  const partnershipStall = input.partnershipBalls >= 12 && input.partnershipRuns / input.partnershipBalls < 0.8 ? 0.12 : 0;
  return clamp(chaseDemand + settingDemand + wicketDemand + dotDemand + arrivalDemand
    + tailDemand + phaseDemand + partnershipStall + input.matchupPressure * 0.18, 0, 1);
}

export function calculateBowlingPressure(input: SituationalPressureInput): number {
  const ballsRemaining = Math.max(1, input.maxBalls - input.legalBalls);
  const remainingRuns = input.target ? Math.max(0, input.target - input.runs) : 0;
  const requiredRate = input.target ? remainingRuns / ballsRemaining * 6 : 0;
  const currentRate = input.legalBalls > 0 ? input.runs / input.legalBalls * 6 : 0;
  const defenceDanger = input.target
    ? clamp((currentRate - requiredRate) / 6, 0, 0.28)
      + clamp((10 - requiredRate) / 7, 0, 0.25)
      + (ballsRemaining <= 24 && remainingRuns <= 45 ? 0.22 : 0)
      + (input.target < input.expectedScore - 20 ? 0.12 : 0)
    : 0;
  const boundaryDemand = clamp(input.consecutiveBoundaries * 0.13 + Math.max(0, input.runsThisOver - 8) * 0.025, 0, 0.38);
  const wicketDemand = clamp((input.partnershipBalls - 24) * 0.006 + (input.partnershipRuns - 35) * 0.004, 0, 0.28);
  const deathDemand = ballsRemaining <= 30 ? 0.16 : 0;
  const poorSpell = input.bowlerEconomy >= 10 ? clamp((input.bowlerEconomy - 9) * 0.035, 0, 0.2) : 0;
  return clamp(defenceDanger + boundaryDemand + wicketDemand + deathDemand + poorSpell
    + input.matchupPressure * 0.14 + input.fieldingErrorPressure * 0.14, 0, 1);
}

export function bigMatchOutcomeModifiers(player: Player, intensity: number, discipline: "batting" | "bowling") {
  const signal = attributeSignal(player.bigMatchRating) * clamp(intensity, 0, 1);
  if (signal === 0) return { runMultiplier: 1, wicketAdjustment: 0 };
  return discipline === "batting"
    ? { runMultiplier: 1 + signal * 0.035, wicketAdjustment: -signal * 0.006 }
    : { runMultiplier: 1 - signal * 0.025, wicketAdjustment: signal * 0.005 };
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
  maxOvers = 20,
): { wideIncrease: number; noBallIncrease: number } {
  const { deathStart } = inningsPhaseThresholds(maxOvers);
  if (overNumber < deathStart) return { wideIncrease: 0, noBallIncrease: 0 };
  const deathLength = Math.max(1, maxOvers - deathStart + 1);
  const phasePressure = clamp((overNumber - deathStart + 1) / deathLength + (closeChase ? 0.25 : 0), 0, 1);
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
  _battingAggression: number,
  pressureLevel: number,
): number {
  if (pressureLevel > 0.2) return 1;
  if (runs >= 90 && runs < 100) return 0.98;
  if (runs >= 45 && runs < 50) return 0.96;
  return 1;
}

export interface BattingAggressionScoringProfile {
  /** Per-ball scoring tempo relative to the neutral aggression value of 65. */
  tempoMultiplier: number;
  /** -1 (very controlled) to +1 (maximum boundary-orientated intent). */
  boundaryIntent: number;
  /** A guide only: match context and batting ability still determine actual SR. */
  indicativeStrikeRate: number;
}

/**
 * Converts aggression into tempo, not batting quality. A neutral 65 maps to an
 * indicative 157.5 SR and 95 maps to 185 SR. The innings engine applies the
 * same multiplier to dismissal odds, so aggressive players score their runs
 * faster but also use fewer balls rather than receiving free expected runs.
 */
export function battingAggressionScoringProfile(
  battingAggression: number,
): BattingAggressionScoringProfile {
  const aggression = clamp(battingAggression, 1, 99);
  const indicativeStrikeRate = 157.5 + (aggression - 65) * (27.5 / 30);
  return {
    tempoMultiplier: indicativeStrikeRate / 157.5,
    boundaryIntent: clamp((aggression - 65) / 30, -1, 1),
    indicativeStrikeRate,
  };
}

/**
 * Scale dismissal probability by the same factor as scoring tempo. Applying
 * the multiplier to odds made attacking batters slightly more productive per
 * dismissal, especially in finite 120-ball innings. Direct probability
 * scaling keeps aggression a tempo choice rather than a source of free runs.
 */
export function aggressionAdjustedWicketProbability(
  wicketProbability: number,
  battingAggression: number,
  pressureRiskMultiplier = 1,
): number {
  const probability = clamp(wicketProbability, 0.0001, 0.9999);
  const { tempoMultiplier } = battingAggressionScoringProfile(battingAggression);
  return clamp(
    probability * tempoMultiplier * pressureRiskMultiplier,
    0.0001,
    0.9999,
  );
}

export interface PressureAdjustedAggression {
  effectiveAggression: number;
  wicketRiskMultiplier: number;
}

/**
 * Pressure changes decision quality, not the batter's underlying aggression.
 * Low-composure attackers can chase a release shot after dots; composed
 * attackers trim only the reckless edge while retaining their scoring intent.
 */
export function pressureAdjustedAggression(
  battingAggression: number,
  pressureLevel: number,
  pressureRating: number | undefined,
  consecutiveDots: number,
): PressureAdjustedAggression {
  const aggression = clamp(battingAggression, 1, 99);
  const attackingIdentity = clamp((aggression - 65) / 30, 0, 1);
  if (attackingIdentity === 0 || pressureLevel <= 0) {
    return { effectiveAggression: aggression, wicketRiskMultiplier: 1 };
  }
  const response = attributeSignal(pressureRating);
  const poorResponse = Math.max(0, -response);
  const composedResponse = Math.max(0, response);
  const dotFrustration = clamp((consecutiveDots - 2) / 4, 0, 1);
  const panic = clamp(pressureLevel, 0, 1) * attackingIdentity * poorResponse * (0.55 + dotFrustration * 0.45);
  const selectivity = clamp(pressureLevel, 0, 1) * attackingIdentity * composedResponse;
  return {
    effectiveAggression: clamp(aggression + panic * 10 - selectivity * 2.5, 1, 99),
    wicketRiskMultiplier: clamp(1 + panic * 0.14 - selectivity * 0.05, 0.95, 1.14),
  };
}

type BattingOutcomeWeights = {
  dot: number;
  single: number;
  two: number;
  three: number;
  four: number;
  six: number;
};

function expectedRunsFromWeights(weights: BattingOutcomeWeights): number {
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return 0;
  return (
    weights.single
    + weights.two * 2
    + weights.three * 3
    + weights.four * 4
    + weights.six * 6
  ) / total;
}

/**
 * Makes high aggression visibly boundary-heavy, then tilts the complete
 * distribution to the calibrated tempo. The latter is paired with higher
 * wicket odds by the innings engine, keeping aggression value-neutral overall.
 */
export function applyBattingAggressionOutcomeWeights(
  input: BattingOutcomeWeights,
  battingAggression: number,
): BattingOutcomeWeights {
  const profile = battingAggressionScoringProfile(battingAggression);
  const targetExpectedRuns = expectedRunsFromWeights(input) * profile.tempoMultiplier;
  const attacking = Math.max(0, profile.boundaryIntent);
  const controlled = Math.max(0, -profile.boundaryIntent);
  const styled: BattingOutcomeWeights = {
    dot: input.dot * (1 + attacking * 0.20 - controlled * 0.10),
    single: input.single * (1 - attacking * 0.42 + controlled * 0.22),
    two: input.two * (1 - attacking * 0.30 + controlled * 0.20),
    three: input.three,
    four: input.four * (1 + attacking * 0.42 - controlled * 0.20),
    six: input.six * (1 + attacking * 0.90 - controlled * 0.38),
  };

  // Exponential tilting reaches the requested runs-per-ball target while
  // preserving the boundary-heavy/rotation-heavy identity established above.
  let low = -1;
  let high = 1;
  for (let index = 0; index < 32; index += 1) {
    const tilt = (low + high) / 2;
    const candidate: BattingOutcomeWeights = {
      dot: styled.dot,
      single: styled.single * Math.exp(tilt),
      two: styled.two * Math.exp(tilt * 2),
      three: styled.three * Math.exp(tilt * 3),
      four: styled.four * Math.exp(tilt * 4),
      six: styled.six * Math.exp(tilt * 6),
    };
    if (expectedRunsFromWeights(candidate) < targetExpectedRuns) low = tilt;
    else high = tilt;
  }
  const tilt = (low + high) / 2;
  return {
    dot: styled.dot,
    single: styled.single * Math.exp(tilt),
    two: styled.two * Math.exp(tilt * 2),
    three: styled.three * Math.exp(tilt * 3),
    four: styled.four * Math.exp(tilt * 4),
    six: styled.six * Math.exp(tilt * 6),
  };
}

/**
 * Makes the playable "six-hitting" instruction change the kind of boundary a
 * batter looks for, not simply add free expected runs. A matching amount of
 * four and dot-ball weight is exchanged for six weight, preserving both the
 * total outcome weight and its expected run value.
 */
export function playableBattingApproachScoringWeights(
  approach: PlayableBattingApproach | undefined,
  dotWeight: number,
  fourWeight: number,
  sixWeight: number,
): { dotWeight: number; fourWeight: number; sixWeight: number } {
  if (approach !== "six-hitting") {
    return { dotWeight, fourWeight, sixWeight };
  }

  const sixShift = Math.min(fourWeight * 0.28, 0.026);
  return {
    dotWeight: dotWeight + sixShift * 0.5,
    fourWeight: fourWeight - sixShift * 1.5,
    sixWeight: sixWeight + sixShift,
  };
}

export function lowerRatedCenturyConversionAdjustment(
  battingRating: number,
  runs: number,
): { scoringFactor: number; wicketIncrease: number } {
  if (runs < 85) {
    return { scoringFactor: 1, wicketIncrease: 0 };
  }
  // Conversion resistance fades smoothly instead of disappearing at a single
  // rating threshold. Even elite batters retain a small amount of milestone
  // pressure, while ordinary batters cannot become unrestricted at 78 CA.
  const eliteRelief = clamp((battingRating - 74) / 18, 0, 1);
  const ratingWeight = 1 - eliteRelief * 0.80;
  const milestoneProgress = clamp((runs - 85) / 15, 0, 1);
  return {
    scoringFactor: 1 - (0.04 + milestoneProgress * 0.06) * ratingWeight,
    wicketIncrease: (0.0015 + milestoneProgress * 0.0035) * ratingWeight,
  };
}

export function sustainedPositiveFormCap(battingRating: number): number {
  if (battingRating < 75) return 3;
  if (battingRating < 80) return 4;
  if (battingRating < 85) return 5;
  if (battingRating < 90) return 6;
  return 7;
}

export function expectedEliteSeasonRunsPerMatch(battingRating: number): number {
  if (battingRating < 65) return 7;
  if (battingRating < 70) return 12;
  if (battingRating < 75) return 18;
  if (battingRating < 78) return 28;
  if (battingRating < 82) return 40;
  if (battingRating < 86) return 50;
  if (battingRating < 90) return 57;
  return 62;
}

export function lowRatedBattingAdjustment(
  battingRating: number,
): { scoringFactor: number; wicketIncrease: number } {
  const deficit = Math.max(0, 75 - battingRating);
  return {
    scoringFactor: clamp(1 - deficit * 0.12, 0.45, 1),
    wicketIncrease: clamp(deficit * 0.007, 0, 0.04),
  };
}

export function seasonBattingRegressionAdjustment(
  battingRating: number,
  stats?: { runs: number; matches: number },
): number {
  if (!stats || stats.matches < 4) return 0;
  const runsPerMatch = stats.runs / Math.max(1, stats.matches);
  const excess = runsPerMatch - expectedEliteSeasonRunsPerMatch(battingRating);
  const productionRegression = excess > 0
    ? clamp(
        excess * (battingRating < 75 ? 0.34 : 0.11),
        0,
        battingRating < 75 ? 6 : 2.5,
      )
    : 0;
  // Required quality rises continuously with the season total. This avoids
  // milestone cliffs while making extreme production increasingly exclusive.
  const requiredRating = stats.runs < 400
    ? 0
    : clamp(74 + (stats.runs - 400) * 0.04, 74, 93);
  const qualificationRegression = Math.max(0, requiredRating - battingRating) * 0.65;
  // Accumulated fatigue/form regression controls the far tail. It starts late
  // enough not to suppress normal leading seasons, then increases smoothly so
  // 900 remains exceptional and 1,000 requires repeated elite performances.
  const extremeTailRegression = Math.max(0, stats.runs - 725) * 0.045;
  const totalRegression = clamp(
    productionRegression + qualificationRegression + extremeTailRegression,
    0,
    10,
  );
  return totalRegression === 0 ? 0 : -totalRegression;
}

export function extremeSeasonConversionAdjustment(
  battingRating: number,
  stats?: { runs: number; matches: number },
): { scoringFactor: number; wicketIncrease: number } {
  if (!stats || stats.matches < 6 || stats.runs < 725) {
    return { scoringFactor: 1, wicketIncrease: 0 };
  }
  const progress = clamp((stats.runs - 725) / 175, 0, 1);
  const eliteProtection = clamp((battingRating - 86) / 20, 0, 0.25);
  const pressure = progress * (1 - eliteProtection);
  return {
    scoringFactor: 1 - pressure * 0.36,
    wicketIncrease: pressure * 0.07,
  };
}

export function abilityBasedConversionAdjustment(
  battingRating: number,
  runs: number,
): { scoringFactor: number; wicketIncrease: number } {
  if (runs < 30) return { scoringFactor: 1, wicketIncrease: 0 };
  const nonEliteWeight = clamp((90 - battingRating) / 15, 0, 1);
  const inningsProgress = clamp((runs - 30) / 50, 0, 1);
  return {
    scoringFactor: 1 - nonEliteWeight * (0.01 + inningsProgress * 0.05),
    wicketIncrease: nonEliteWeight * (0.001 + inningsProgress * 0.005),
  };
}

export function lowerRatedBowlingHaulMultiplier(
  bowlingRating: number,
  creditedWickets: number,
): number {
  if (creditedWickets < 4) return 1;
  const fullHaulCredibility = clamp((bowlingRating - 72) / 16, 0, 1);
  const lowAbilityMultiplier = creditedWickets === 4 ? 0.62 : 0.48;
  return lowAbilityMultiplier + (1 - lowAbilityMultiplier) * fullHaulCredibility;
}

function isPartTimeKeeper(player: Player | undefined): boolean {
  return Boolean(
    player
    && player.isPartTimeWk
    && !player.isWicketkeeper
    && player.role !== "WK-Batsman",
  );
}

export function dismissalCompletionProbability(
  wicket: DeliveryWicket,
  players: Record<string, Player>,
  fieldInfluence?: PlayableFieldInfluence,
  pressureLevel = 0,
  bigMatchIntensity = 0,
): number {
  const fielder = wicket.fielderId ? players[wicket.fielderId] : undefined;
  const pressureAdjustment = pressureLevel * attributeSignal(fielder?.pressureRating) * 0.025;
  const bigMatchAdjustment = bigMatchIntensity * attributeSignal(fielder?.bigMatchRating) * 0.015;
  if (wicket.kind === "caught") {
    const rating = fielder
      ? (isKeeper(fielder) ? effectiveWicketkeepingRating(fielder) : effectiveFieldingRating(fielder))
      : 65;
    return clamp(
      0.76
        + (rating - 60) * 0.0055
        - (isPartTimeKeeper(fielder) ? 0.045 : 0)
        + (fieldInfluence
          ? clamp((14 - fieldInfluence.catchDistance) * 0.006, -0.08, 0.055)
          : 0)
        + pressureAdjustment
        + bigMatchAdjustment,
      0.72,
      0.96,
    );
  }
  if (wicket.kind === "stumped") {
    return clamp(
      0.82
      + (effectiveWicketkeepingRating(fielder) - 60) * 0.0055
      - (isPartTimeKeeper(fielder) ? 0.055 : 0)
      + pressureAdjustment
      + bigMatchAdjustment,
      0.74,
      0.96,
    );
  }
  if (wicket.kind === "run-out") {
    const rating = fielder ? effectiveFieldingRating(fielder) : 65;
    return clamp(
      0.70
        + (rating - 60) * 0.005
        + (fieldInfluence
          ? clamp((13 - fieldInfluence.ringDistance) * 0.005, -0.06, 0.045)
          : 0)
        + pressureAdjustment
        + bigMatchAdjustment,
      0.64,
      0.93,
    );
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
  fieldInfluence?: PlayableFieldInfluence,
  positionedFielders: readonly Player[] = [],
): DeliveryWicket {
  const kind = rng.weighted<DismissalKind>([
    { value: "caught", weight: 52 * (fieldInfluence?.caughtWeightMultiplier ?? 1) },
    { value: "bowled", weight: isPacer(bowler) ? 18 : 13 },
    { value: "lbw", weight: isPacer(bowler) ? 14 : 16 },
    { value: "run-out", weight: 7 * (1 + runningPressure * 0.2) * (fieldInfluence?.runOutWeightMultiplier ?? 1) },
    { value: "stumped", weight: isSpinner(bowler) ? 7 : 0.8 },
    { value: "hit-wicket", weight: 0.025 },
  ]);
  const positionedFielder = kind === "caught"
    ? positionedFielders[fieldInfluence?.catchFielderIndex ?? -1]
    : kind === "run-out"
      ? positionedFielders[fieldInfluence?.ringFielderIndex ?? -1]
      : undefined;
  const fielder = kind === "caught"
    ? positionedFielder ?? selectFielder(fieldingIds, players, rng)
    : kind === "stumped"
      // Preserve the established seeded random stream without allowing this
      // draw to re-select the keeper during the innings.
      ? (wicketkeeper ? (rng.next(), wicketkeeper) : undefined)
      : kind === "run-out"
        ? positionedFielder ?? selectFielder(fieldingIds, players, rng)
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
  battingAggression: number = 65,
  playableBattingApproach?: PlayableBattingApproach,
  phaseModifiers: PhaseOutcomeModifiers = NEUTRAL_PHASE_OUTCOME_MODIFIERS,
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

  let dotWeight = 0.34 * dotFactor;
  let singleWeight = 0.37 * rotationMultiplier * singleOpportunityMultiplier;
  let twoWeight = 0.09 * rotationMultiplier * twoRunMultiplier * clamp(1.05 - conditions.outfieldSpeedRating * 0.02, 0.82, 1.05);
  let fourWeight = 0.14 * boundaryFactor * clamp(conditions.outfieldSpeedRating / 7.5, 0.72, 1.25);
  let sixWeight = 0.052 * boundaryFactor ** 1.35 * clamp(69 / averageBoundary, 0.8, 1.3);
  const aggressionWeights = applyBattingAggressionOutcomeWeights({
    dot: dotWeight,
    single: singleWeight,
    two: twoWeight,
    three: 0.0035 * threeRunFactor,
    four: fourWeight,
    six: sixWeight,
  }, battingAggression);
  dotWeight = aggressionWeights.dot;
  singleWeight = aggressionWeights.single;
  twoWeight = aggressionWeights.two;
  fourWeight = aggressionWeights.four;
  sixWeight = aggressionWeights.six;

  ({ dotWeight, fourWeight, sixWeight } = playableBattingApproachScoringWeights(
    playableBattingApproach,
    dotWeight,
    fourWeight,
    sixWeight,
  ));

  dotWeight *= phaseModifiers.dot;
  singleWeight *= phaseModifiers.single;
  twoWeight *= phaseModifiers.two;
  fourWeight *= phaseModifiers.four;
  sixWeight *= phaseModifiers.six;

  return rng.weighted([
    { value: 0, weight: dotWeight },
    { value: 1, weight: singleWeight },
    { value: 2, weight: twoWeight },
    { value: 3, weight: aggressionWeights.three },
    { value: 4, weight: fourWeight },
    { value: 6, weight: sixWeight },
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
  // Permanent development is applied once after each completed season. Match
  // form/luck is handled separately by createPlayerLuck below, so potential is
  // deliberately not added a second time here.
  return rating;
}

export function getEffectiveBowlingRating(
  player: { id?: string; age: number; currentBowling: number; potentialBowling?: number },
  rng?: SimulationRandom,
  seed?: string,
): number {
  let rating = player.currentBowling;
  return rating;
}

export function getSeasonalPlayerForm(
  playerId: string,
  seed?: string,
  discipline: "batting" | "bowling" = "batting",
): number {
  if (!seed) return 0;
  // Match seeds are `${season}:${save-specific fixture seed}:${fixture}`.
  // Keeping the first two components makes form stable within one season and
  // different across separate careers.
  const seasonAndSaveKey = seed.split(":").slice(0, 2).join(":");
  const hashStr = `${seasonAndSaveKey}:${playerId}:${discipline}:season_form_v4`;
  let hash = 0;
  for (let index = 0; index < hashStr.length; index += 1) {
    hash = (hash << 5) - hash + hashStr.charCodeAt(index);
    hash |= 0;
  }
  const u1 = Math.max(0.0001, (Math.abs(hash) % 10000) / 10000);
  const u2 = Math.max(0.0001, (Math.abs(hash >> 3) % 10000) / 10000);
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  // Season-long form should provide background variation, not outweigh the
  // stronger short-term recent-form adjustment or conceal a rating decline.
  return clamp(z * 1.15, -3, 3);
}

export function capSeasonalFormAverages(
  playerIds: readonly string[],
  playerGroups: readonly (readonly string[])[],
  seed?: string,
  discipline: "batting" | "bowling" = "batting",
): Map<string, number> {
  const adjustedSeasonalForm = new Map(
    playerIds.map((playerId) => [playerId, getSeasonalPlayerForm(playerId, seed, discipline)]),
  );
  playerGroups.forEach((group) => {
    const ids = Array.from(new Set(group)).filter((playerId) => adjustedSeasonalForm.has(playerId));
    if (ids.length === 0) return;
    const average = ids.reduce(
      (sum, playerId) => sum + (adjustedSeasonalForm.get(playerId) ?? 0),
      0,
    ) / ids.length;
    const correction = clamp(average, -1.5, 1.5) - average;
    ids.forEach((playerId) => adjustedSeasonalForm.set(
      playerId,
      (adjustedSeasonalForm.get(playerId) ?? 0) + correction,
    ));
  });
  return adjustedSeasonalForm;
}

function createPlayerLuck(
  playerIds: readonly string[],
  playerGroups: readonly (readonly string[])[],
  players: Record<string, Player>,
  formAdjustments: Record<string, number>,
  rng: SimulationRandom,
  discipline: "batting" | "bowling",
  seasonBattingStats?: Readonly<Record<string, { runs: number; matches: number }>>,
  seed?: string,
): Map<string, number> {
  const adjustedSeasonalForm = capSeasonalFormAverages(playerIds, playerGroups, seed, discipline);
  return new Map(playerIds.map((playerId) => {
    const player = players[playerId];
    if (!player) return [playerId, 0];
    const ageConsistency = player.age >= 25 && player.age <= 33 ? 0.85 : 1.15;
    
    const seasonalForm = adjustedSeasonalForm.get(playerId) ?? 0;
    const baseRating = discipline === "batting" ? player.currentBatting : player.currentBowling;
    const recentForm = formAdjustments[playerId] ?? 0;
    const positivePersistence = player.age <= 33
      ? 1
      : player.age <= 37
        ? 0.94
        : player.age <= 40
          ? 0.86
          : 0.78;
    const consistency = discipline === "batting"
      ? player.battingConsistency ?? player.stamina ?? 50
      : player.bowlingConsistency ?? player.consistency ?? 50;
    const sustainedForm = discipline === "batting"
      ? consistencyAdjustedBattingForm(seasonalForm + recentForm, consistency)
      : seasonalForm + recentForm;
    const cappedSustainedForm = sustainedForm > 0
      ? Math.min(sustainedForm * positivePersistence, sustainedPositiveFormCap(baseRating))
      : Math.max(-6, sustainedForm);
    const seasonRegression = discipline === "batting"
      ? seasonBattingRegressionAdjustment(baseRating, seasonBattingStats?.[playerId])
      : 0;

    // Ratings should remain the strongest match-level signal. Luck supplies
    // believable variation without routinely erasing several rating points.
    const baseStandardDeviation = clamp(2.2 * ageConsistency, 1.35, 3.1);
    const consistencyMultiplier = discipline === "batting"
      ? battingConsistencyProfile(player.battingConsistency ?? player.stamina ?? 50).matchVarianceMultiplier
      : bowlingConsistencyProfile(player.bowlingConsistency ?? player.consistency ?? 50).matchVarianceMultiplier;
    const standardDeviation = baseStandardDeviation * consistencyMultiplier;
    const rawMatchLuck = rng.gaussian() * standardDeviation;
    const matchLuck = discipline === "batting"
      ? consistencyAdjustedBattingLuck(rawMatchLuck, consistency)
      : rawMatchLuck;
    const totalLuck = clamp(matchLuck + cappedSustainedForm + seasonRegression, -6, 6);
    return [playerId, totalLuck];
  }));
}

/**
 * Low consistency must not gain season-long value from a wider symmetric
 * distribution. It shortens good runs and deepens poor runs; high consistency
 * cushions a slump while leaving the player's underlying ceiling unchanged.
 */
export function consistencyAdjustedBattingForm(form: number, consistencyValue: number | undefined): number {
  const consistency = clamp(consistencyValue ?? 50, 1, 99);
  const unreliability = Math.max(0, (50 - consistency) / 49);
  const reliability = Math.max(0, (consistency - 50) / 49);
  if (form > 0) return form * (1 - unreliability * 0.45);
  if (form < 0) return form * (1 + unreliability * 0.35) * (1 - reliability * 0.25);
  return 0;
}

export function consistencyAdjustedBattingLuck(luck: number, consistencyValue: number | undefined): number {
  const consistency = clamp(consistencyValue ?? 50, 1, 99);
  const unreliability = Math.max(0, (50 - consistency) / 49);
  if (luck > 0) return luck * (1 - unreliability * 0.22);
  if (luck < 0) return luck * (1 + unreliability * 0.14);
  return 0;
}

export interface DisciplineFormAdjustments {
  batting: Record<string, number>;
  bowling: Record<string, number>;
}

export function derivePlayerDisciplineFormAdjustments(
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
): DisciplineFormAdjustments {
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

  const battingAdjustments: Record<string, number> = {};
  const bowlingAdjustments: Record<string, number> = {};

  playerBattingScores.forEach((performances, playerId) => {
    const recent = performances.slice(-3);
    if (recent.length === 0) return;

    let hotCount = 0;
    let coldCount = 0;

    recent.forEach((p) => {
      if (p.runs >= 40) {
        hotCount += 1;
      } else if (p.balls >= 5 && p.runs < 10) {
        coldCount += 1;
      }
    });

    let mod = 0;
    if (hotCount >= 2) mod += 3.5;
    else if (coldCount >= 2) mod -= 3.5;

    battingAdjustments[playerId] = mod;
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

    bowlingAdjustments[playerId] = clamp(mod, -6.0, 6.0);
  });

  return { batting: battingAdjustments, bowling: bowlingAdjustments };
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
  const allBenchCandidates = teamState.plan.impactSubs
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(
      player
      && !startingSet.has(player.id)
    ))
    .sort((left, right) => (
      right.currentBatting - left.currentBatting
      || right.currentBowling - left.currentBowling
    ));
  // A user/AI plan is authoritative even when the selected batter is rated
  // below the generic fallback threshold. The threshold is only a guard for
  // choosing an unplanned substitute automatically.
  const planned = allBenchCandidates.find((player) => player.id === teamState.plan.plannedImpactPlayerId);
  const candidates = [
    ...(planned ? [planned] : []),
    ...allBenchCandidates.filter((player) => (
      player.id !== planned?.id && player.currentBatting >= 55
    )),
  ];
  const best = candidates[0];
  if (!best) return;
  const centre = (
    conditions.adjustedExpectedScore.min
    + conditions.adjustedExpectedScore.max
  ) / 2;
  const highTarget = target >= centre + 18 || target / 20 >= 10;
  // Never silently replace a configured Impact Player because of the target.
  // Target adaptation is only appropriate when no explicit plan exists.
  const preferredIncoming = planned ?? best;

  const keepers = teamState.finalXI
    .map((playerId) => players[playerId])
    .filter(isKeeper);
  const allLegalOutgoing = teamState.finalXI
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(
      player
      && !(isKeeper(player) && keepers.length <= 1),
    ));
  // A specifically nominated outgoing player may be the captain or vice
  // captain; those protections only apply when the engine has to improvise.
  const plannedOutgoing = allLegalOutgoing.find((player) => (
    player.id === teamState.plan.plannedOutgoingPlayerId
  ));
  const eligibleOutgoing = allLegalOutgoing.filter((player) => (
    player.id !== teamState.plan.captainId
    && player.id !== teamState.plan.viceCaptainId
  ));
  const rankedOutgoing = [
    ...(plannedOutgoing ? [plannedOutgoing] : []),
    ...[...eligibleOutgoing]
      .filter((player) => player.id !== plannedOutgoing?.id)
      .sort((left, right) => (
        // A specialist bowler deliberately placed in the batting top seven is
        // an Impact placeholder. Remove that player before sacrificing a
        // lower-order bowler and leaving the placeholder to bat in the chase.
        Number(isBowlingOption(right) && right.currentBatting < 65
          && teamState.battingOrder.indexOf(right.id) < 7)
        - Number(isBowlingOption(left) && left.currentBatting < 65
          && teamState.battingOrder.indexOf(left.id) < 7)
        || left.currentBatting - right.currentBatting
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
  const automaticPosition = findOptimalImpactBattingPosition(
    teamState.battingOrder
      .map((playerId) => players[playerId])
      .filter((player): player is Player => Boolean(player)),
    incoming,
    outgoing,
    true,
  );
  if (outgoingPosition >= 0) teamState.battingOrder.splice(outgoingPosition, 1);
  // Pitch tuning can change the best available incoming player after the
  // original plan was generated. A stored slot only belongs to that planned
  // player; replacements must calculate their own position.
  const requestedPosition = incoming.id === planned?.id
    ? teamState.plan.plannedImpactBattingPosition
    : null;
  const insertionIndex = typeof requestedPosition === "number"
    ? clamp(Math.round(requestedPosition) - 1, 0, teamState.battingOrder.length)
    : clamp(automaticPosition - 1, 0, teamState.battingOrder.length);
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

function applyPlayableImpactChoice(
  teamState: ActiveTeamState,
  choice: PlayableImpactChoice,
  players: Record<string, Player>,
  teamWillBat: boolean,
  nextBatterIndex?: number,
): boolean {
  if (!choice.use) {
    teamState.impactDecision = {
      teamId: teamState.team.id,
      used: false,
      reason: "not-used",
      explanation: `${teamState.team.name} chose not to use an Impact Player.`,
    };
    return true;
  }
  const incoming = choice.incomingPlayerId ? players[choice.incomingPlayerId] : undefined;
  const outgoing = choice.outgoingPlayerId ? players[choice.outgoingPlayerId] : undefined;
  if (
    !incoming
    || !outgoing
    || !teamState.plan.impactSubs.includes(incoming.id)
    || !teamState.finalXI.includes(outgoing.id)
    || !isLegalImpactSwap(teamState, incoming, outgoing, players)
  ) return false;

  const outgoingPosition = teamState.battingOrder.indexOf(outgoing.id);
  let insertionIndex: number | undefined;
  if (teamWillBat) {
    if (typeof nextBatterIndex === "number") {
      // During an innings, preserve all historical batting positions. Replace
      // an unused player in place, or queue the Impact Player as next in when
      // the outgoing player has already appeared on the scorecard.
      if (outgoingPosition >= nextBatterIndex) {
        teamState.battingOrder.splice(outgoingPosition, 1, incoming.id);
        insertionIndex = outgoingPosition;
      } else {
        insertionIndex = clamp(nextBatterIndex, 0, teamState.battingOrder.length);
        teamState.battingOrder.splice(insertionIndex, 0, incoming.id);
      }
    } else if (outgoingPosition >= 0) {
      teamState.battingOrder.splice(outgoingPosition, 1);
      insertionIndex = clamp(
        Math.round(choice.battingPosition ?? outgoingPosition + 1) - 1,
        0,
        teamState.battingOrder.length,
      );
      teamState.battingOrder.splice(insertionIndex, 0, incoming.id);
    }
  }
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
    battingPosition: teamWillBat
      ? (insertionIndex ?? teamState.battingOrder.indexOf(incoming.id)) + 1
      : undefined,
    reason: teamWillBat ? "planned-batting" : "planned-bowling",
    explanation: `${incoming.name} replaced ${outgoing.name} as the user-selected Impact Player.`,
  };
  return true;
}

export function isNightMatch(time?: string): boolean {
  if (!time) return true;
  const t = time.toLowerCase();
  return t.includes("19") || t.includes("20") || t.includes("7:") || t.includes("8:") || t.includes("pm");
}

export function nightDewScoringBonus(
  seed: string | undefined,
  stadiumId: string,
  time?: string,
): number {
  if (!isNightMatch(time)) return 0;
  const normalizedStadium = stadiumId.toLowerCase();
  const highDewVenue = ["wankhede", "chinnaswamy", "rajiv-gandhi", "hyderabad"]
    .some((token) => normalizedStadium.includes(token));
  const lowDewVenue = ["chepauk", "chidambaram", "ekana", "lucknow", "sawai", "jaipur", "mullanpur", "yadavindra"]
    .some((token) => normalizedStadium.includes(token));
  const activationChance = highDewVenue ? 0.55 : lowDewVenue ? 0.25 : 0.4;
  const minimumBonus = highDewVenue ? 0.015 : 0.01;
  const maximumBonus = highDewVenue ? 0.035 : lowDewVenue ? 0.022 : 0.03;
  const fixtureKey = `${seed ?? "match"}:${stadiumId}:dew-v1`;
  const activationRoll = hashSeed(`${fixtureKey}:active`) / 4294967296;
  if (activationRoll >= activationChance) return 0;
  const severityRoll = hashSeed(`${fixtureKey}:severity`) / 4294967296;
  return minimumBonus + (maximumBonus - minimumBonus) * severityRoll;
}

export function isAfternoonMatch(time?: string): boolean {
  if (!time) return false;
  const t = time.toLowerCase();
  return t.includes("15") || t.includes("14") || t.includes("3:") || t.includes("4:");
}

// ICC Standard Edition DLS resource percentages for whole overs. The
// Professional Edition used by the IPL is proprietary; this published ICC
// table is the official deterministic fallback and is materially more
// accurate than treating overs and wickets as independent multipliers.
const DLS_STANDARD_RESOURCES: Record<number, readonly number[]> = {
  20: [56.6, 54.8, 52.4, 49.1, 44.6, 38.6, 30.8, 21.2, 11.9, 4.7],
  19: [54.4, 52.8, 50.5, 47.5, 43.4, 37.7, 30.3, 21.1, 11.9, 4.7],
  18: [52.2, 50.7, 48.6, 45.9, 42.0, 36.8, 29.8, 20.9, 11.9, 4.7],
  17: [49.9, 48.5, 46.7, 44.1, 40.6, 35.8, 29.2, 20.7, 11.9, 4.7],
  16: [47.6, 46.3, 44.7, 42.3, 39.1, 34.7, 28.5, 20.5, 11.8, 4.7],
  15: [45.2, 44.1, 42.6, 40.5, 37.6, 33.5, 27.8, 20.2, 11.8, 4.7],
  14: [42.7, 41.7, 40.4, 38.5, 35.9, 32.2, 27.0, 19.9, 11.8, 4.7],
  13: [40.2, 39.3, 38.1, 36.5, 34.2, 30.8, 26.1, 19.5, 11.7, 4.7],
  12: [37.6, 36.8, 35.8, 34.3, 32.3, 29.4, 25.1, 19.0, 11.6, 4.7],
  11: [34.9, 34.2, 33.4, 32.1, 30.4, 27.8, 24.0, 18.5, 11.5, 4.7],
  10: [32.1, 31.6, 30.8, 29.8, 28.3, 26.1, 22.8, 17.9, 11.4, 4.7],
  9: [29.3, 28.9, 28.2, 27.4, 26.1, 24.2, 21.4, 17.1, 11.2, 4.7],
  8: [26.4, 26.0, 25.5, 24.8, 23.8, 22.3, 19.9, 16.2, 10.9, 4.7],
  7: [23.4, 23.1, 22.7, 22.2, 21.4, 20.1, 18.2, 15.2, 10.5, 4.7],
  6: [20.3, 20.1, 19.8, 19.4, 18.8, 17.8, 16.4, 13.9, 10.1, 4.6],
  5: [17.2, 17.0, 16.8, 16.5, 16.1, 15.4, 14.3, 12.5, 9.4, 4.6],
};

export function dlsResourcePercentage(oversRemaining: number, wicketsLost = 0): number {
  const overs = Math.max(0, Math.min(20, Math.floor(oversRemaining)));
  if (overs === 0) return 0;
  const wickets = Math.max(0, Math.min(10, Math.floor(wicketsLost)));
  if (wickets >= 10) return 0;
  return (DLS_STANDARD_RESOURCES[Math.max(5, overs)]?.[wickets] ?? 0) / 100;
}

export function calculateDLSRevisedTarget(
  firstInningsRuns: number,
  oversAvailable: number,
  firstInningsWicketsLost = 0,
  secondInningsWicketsLost = 0,
  firstInningsOvers = 20,
): number {
  const firstResources = dlsResourcePercentage(firstInningsOvers, firstInningsWicketsLost);
  const secondResources = dlsResourcePercentage(oversAvailable, secondInningsWicketsLost);
  if (firstResources <= 0) return Math.max(1, Math.floor(firstInningsRuns) + 1);
  if (Math.abs(secondResources - firstResources) < 0.00001) {
    return Math.max(1, Math.floor(firstInningsRuns) + 1);
  }
  if (secondResources < firstResources) {
    return Math.max(1, Math.floor(firstInningsRuns * (secondResources / firstResources)) + 1);
  }
  const standardEditionG50 = 245;
  return Math.max(
    1,
    Math.floor(firstInningsRuns + ((secondResources - firstResources) * standardEditionG50)) + 1,
  );
}

function stableWeatherRoll(seed: string, stadiumId: string, date?: string): number {
  let hash = 2166136261;
  for (const character of `${seed}|${stadiumId}|${date ?? ""}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

interface VenueRainProfile {
  march: number;
  earlyApril: number;
  lateApril: number;
  may: number;
}

const DEFAULT_RAIN_PROFILE: VenueRainProfile = {
  march: 0.025,
  earlyApril: 0.04,
  lateApril: 0.055,
  may: 0.075,
};

// Pre-monsoon rain is highly regional. In particular, Kolkata's nor'wester
// season is represented from early April rather than using one IPL-wide roll.
const VENUE_RAIN_PROFILES: Record<string, VenueRainProfile> = {
  "eden-gardens": { march: 0.06, earlyApril: 0.14, lateApril: 0.13, may: 0.17 },
  "m-chinnaswamy-stadium": { march: 0.035, earlyApril: 0.07, lateApril: 0.10, may: 0.15 },
  "wankhede-stadium": { march: 0.008, earlyApril: 0.012, lateApril: 0.025, may: 0.07 },
  "ma-chidambaram-stadium": { march: 0.02, earlyApril: 0.025, lateApril: 0.04, may: 0.065 },
  "arun-jaitley-stadium": { march: 0.025, earlyApril: 0.03, lateApril: 0.04, may: 0.055 },
  "ekana-cricket-stadium": { march: 0.03, earlyApril: 0.04, lateApril: 0.055, may: 0.075 },
  "rajiv-gandhi-international-stadium": { march: 0.02, earlyApril: 0.035, lateApril: 0.055, may: 0.09 },
  "narendra-modi-stadium": { march: 0.012, earlyApril: 0.018, lateApril: 0.025, may: 0.04 },
  "sawai-mansingh-stadium": { march: 0.01, earlyApril: 0.015, lateApril: 0.02, may: 0.03 },
  "maharaja-yadavindra-singh-stadium": { march: 0.035, earlyApril: 0.04, lateApril: 0.045, may: 0.055 },
};

export function venueRainProbability(stadiumId: string, date?: string): number {
  if (!date) return 0;
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const profile = VENUE_RAIN_PROFILES[stadiumId] ?? DEFAULT_RAIN_PROFILE;
  if (month <= 3) return profile.march;
  if (month === 4) return day <= 15 ? profile.earlyApril : profile.lateApril;
  if (month === 5) return profile.may;
  return Math.min(0.2, profile.may * 1.25);
}

export function calculateMatchTemperature(
  seed: string,
  stadiumId: string,
  date?: string,
  time?: string,
  rainDelayMinutes: number = 0,
): number {
  const roll = stableWeatherRoll(`${seed}|temperature`, stadiumId, date ?? "");
  const isNight = isNightMatch(time);
  const month = date ? Number(date.slice(5, 7)) : 4;

  let baseTemp = 33;
  if (stadiumId.includes("dharamshala") || stadiumId.includes("yadavindra")) {
    baseTemp = 23;
  } else if (stadiumId.includes("modi") || stadiumId.includes("mansingh") || stadiumId.includes("arun-jaitley") || stadiumId.includes("ekana")) {
    baseTemp = month === 5 ? 39 : 35;
  } else if (stadiumId.includes("wankhede") || stadiumId.includes("chidambaram") || stadiumId.includes("eden") || stadiumId.includes("chinnaswamy")) {
    baseTemp = month === 5 ? 33 : 31;
  }

  // Night time adjustment (-4°C)
  if (isNight) baseTemp -= 4;

  // Rain & Cloud cover cooling effect: downpours cool the temperature down by 4°C to 10°C
  if (rainDelayMinutes > 0) {
    const coolingDrop = Math.min(10, 4 + Math.floor(rainDelayMinutes / 15));
    baseTemp -= coolingDrop;
  }

  const tempVariance = Math.round((roll - 0.5) * 4);
  return Math.max(18, Math.min(44, baseTemp + tempVariance));
}

export function createWeatherScenario(
  seed: string,
  stadiumId: string,
  date?: string,
  time?: string,
): MatchWeatherScenario {
  if (!date) {
    const temperatureCelsius = calculateMatchTemperature(seed, stadiumId, date, time, 0);
    return { kind: "clear", rainDelayMinutes: 0, firstInningsOvers: 20, secondInningsOvers: 20, summary: "Clear conditions allowed a full 20-over match.", temperatureCelsius };
  }
  const roll = stableWeatherRoll(seed, stadiumId, date);
  const rainChance = venueRainProbability(stadiumId, date);
  if (roll >= rainChance) {
    const temperatureCelsius = calculateMatchTemperature(seed, stadiumId, date, time, 0);
    return { kind: "clear", rainDelayMinutes: 0, firstInningsOvers: 20, secondInningsOvers: 20, summary: "Clear conditions allowed a full 20-over match.", temperatureCelsius };
  }
  const pattern = stableWeatherRoll(`${seed}|pattern`, stadiumId, date);
  const severity = stableWeatherRoll(`${seed}|severity`, stadiumId, date);
  const pick = (values: readonly number[]) => values[Math.min(values.length - 1, Math.floor(severity * values.length))];

  let kind: WeatherScenarioKind;
  let firstInningsOvers: number;
  let secondInningsOvers: number;
  let rainDelayMinutes: number;
  let summary: string;

  if (pattern < 0.3) {
    kind = "delayed-start";
    firstInningsOvers = pick([18, 16, 14, 12]);
    secondInningsOvers = firstInningsOvers;
    rainDelayMinutes = (20 - firstInningsOvers) * 9 + 20;
    summary = `Rain before the start reduced the match to ${firstInningsOvers} overs per side.`;
  } else if (pattern < 0.78) {
    kind = "innings-break-rain";
    firstInningsOvers = 20;
    secondInningsOvers = pick([16, 14, 12, 10, 8]);
    rainDelayMinutes = (20 - secondInningsOvers) * 8 + 20;
    summary = `Rain during the innings break reduced the chase to ${secondInningsOvers} overs.`;
  } else {
    kind = "multiple-showers";
    firstInningsOvers = pick([18, 16, 14, 12]);
    const furtherReduction = pick([3, 4, 5, 6]);
    secondInningsOvers = Math.max(5, firstInningsOvers - furtherReduction);
    rainDelayMinutes = ((20 - firstInningsOvers) + (firstInningsOvers - secondInningsOvers)) * 8 + 35;
    summary = `Repeated showers reduced the first innings to ${firstInningsOvers} overs and the chase to ${secondInningsOvers} overs.`;
  }

  const temperatureCelsius = calculateMatchTemperature(seed, stadiumId, date, time, rainDelayMinutes);

  return {
    kind,
    rainDelayMinutes,
    firstInningsOvers,
    secondInningsOvers,
    summary,
    temperatureCelsius,
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
  const maxOvers = context.maxOvers ?? 20;
  const { powerplayEnd, deathStart } = inningsPhaseThresholds(maxOvers);
  const isAfternoon = isAfternoonMatch(context.time);
  const dewScoringBonus = context.inningsNumber === 2
    ? nightDewScoringBonus(context.seed, conditions.stadiumId, context.time)
    : 0;
  const allParticipantIds = Array.from(new Set([
    ...batting.battingOrder,
    ...bowling.finalXI,
    ...batting.plan.impactSubs,
  ]));
  const playerBattingLuck = createPlayerLuck(
    allParticipantIds,
    [[...batting.battingOrder, ...batting.plan.impactSubs], bowling.finalXI],
    players,
    context.battingFormAdjustments,
    rng,
    "batting",
    context.seasonBattingStats,
    context.seed,
  );
  const playerBowlingLuck = createPlayerLuck(
    allParticipantIds,
    [[...batting.battingOrder, ...batting.plan.impactSubs], bowling.finalXI],
    players,
    context.bowlingFormAdjustments,
    rng,
    "bowling",
    undefined,
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
  const battingMomentumByPlayer = new Map<string, number>();
  const bowlingMomentumByPlayer = new Map<string, number>();
  const battingTypePressureByPlayer = new Map<string, number>();
  let deliverySequence = 0;
  let collapsePressureBalls = 0;
  let consecutiveDotBalls = 0;
  let consecutiveBoundaries = 0;
  let fieldingErrorPressureBalls = 0;
  const recentWicketBalls: number[] = [];
  let freeHitPending = false;
  let boundaryByeEvents = 0;
  let partnershipStartRuns = 0;
  let partnershipStartBalls = 0;
  let partnershipBatterIds = [strikerId, nonStrikerId];
  let partnershipStartBatterRuns = new Map(partnershipBatterIds.map((playerId) => [playerId, ensureBattingEntry(playerId).runs]));
  let partnershipStartBatterBalls = new Map(partnershipBatterIds.map((playerId) => [playerId, ensureBattingEntry(playerId).balls]));
  const handledScheduledImpactTeams = new Set<string>();
  const applyScheduledPlayableImpact = () => {
    ([
      { teamState: batting, teamIsBatting: true },
      { teamState: bowling, teamIsBatting: false },
    ] as const).forEach(({ teamState, teamIsBatting }) => {
      if (handledScheduledImpactTeams.has(teamState.team.id) || teamState.impactUsed) return;
      const choice = context.playableDecisions?.impactByTeam?.[teamState.team.id];
      if (
        !choice
        || choice.activationInningsNumber !== context.inningsNumber
        || deliverySequence < (choice.activationDeliverySequence ?? 0)
      ) return;
      const applied = applyPlayableImpactChoice(
        teamState,
        choice,
        players,
        teamIsBatting,
        teamIsBatting ? nextBatterIndex : undefined,
      );
      if (!applied) return;
      handledScheduledImpactTeams.add(teamState.team.id);
      if (teamIsBatting && choice.use && choice.incomingPlayerId) {
        ensureBattingEntry(choice.incomingPlayerId);
      }
    });
  };
  // A choice made before the first ball must affect the opening delivery.
  applyScheduledPlayableImpact();
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
    (sum, player) => sum + effectiveFieldingRating(player),
    0,
  ) / Math.max(1, fielders.length);
  // The nominated keeper is fixed for the entire innings. A full-time keeper
  // takes precedence over a part-time option, regardless of XI ordering.
  const wicketkeeper = selectInningsWicketkeeper(bowling.finalXI, players);
  const keeperRating = effectiveWicketkeepingRating(wicketkeeper);
  const partTimeKeeperPenalty = isPartTimeKeeper(wicketkeeper) ? 0.004 : 0;
  const fieldingCaptain = bowling.plan.captainId
    ? players[bowling.plan.captainId]
    : undefined;
  const captaincyRating = fieldingCaptain?.captaincy ?? 50;
  const isKnockoutMatch = Boolean(
    context.isKnockout
    || (context.stage && ["qualifier1", "eliminator", "qualifier2", "final"].some((s) => context.stage?.toLowerCase().includes(s)))
  );
  const stageBigMatchIntensity = knockoutBigMatchIntensity(context.stage);
  const battingBigMatchIntensity = Math.max(
    stageBigMatchIntensity,
    context.bigMatchIntensityByTeam?.[batting.team.id] ?? 0,
  );
  const bowlingBigMatchIntensity = Math.max(
    stageBigMatchIntensity,
    context.bigMatchIntensityByTeam?.[bowling.team.id] ?? 0,
  );
  const fieldingBigMatchSignal = fielders.reduce(
    (sum, player) => sum + attributeSignal(player.bigMatchRating),
    0,
  ) / Math.max(1, fielders.length);
  let bowlingMomentumDeliveries = 0;

  const legacyInningsEnvironmentDraw = rng.gaussian();
  const tailRoll = rng.next();
  void tailRoll;
  const inningsEnvironment = context.matchScoringEnvironment * clamp(
    1 + legacyInningsEnvironmentDraw * 0.02,
    0.94,
    1.06,
  );
  const battingStaffModifiers = calculateCoachingStaffModifiers(
    batting.team.id,
    context.staffState,
    context.tactics,
  );
  const bowlingStaffModifiers = calculateCoachingStaffModifiers(
    bowling.team.id,
    context.staffState,
    context.bowlingTactics,
  );

  while (
    legalBalls < maxOvers * 6
    && wickets < 10
    && strikerId
    && nonStrikerId
    && (!target || runs < target)
  ) {
    applyScheduledPlayableImpact();
    const overNumber = Math.floor(legalBalls / 6) + 1;
    const smartSelection = chooseBowler(
      overNumber,
      maxOvers,
      bowling.finalXI,
      players,
      new Map(Array.from(bowlingEntries.entries()).map(([id, entry]) => [id, entry.balls])),
      previousBowlerId,
      context.bowlingTactics,
      conditions.pitch,
      captaincyRating,
      bowlerUnavailableUntilOver,
      {
        runs,
        wickets,
        legalBalls,
        target,
        recentOverRuns: oversDetail.map((over) => over.runs),
        figuresByBowler: new Map(Array.from(bowlingEntries.entries()).map(([id, entry]) => [id, {
          balls: entry.balls,
          runs: entry.runsConceded,
          wickets: entry.wickets,
        }])),
      },
      [players[strikerId], players[nonStrikerId]],
      rng,
    );
    const requestedBowlerId = context.playableDecisions?.bowlerByOver[
      `${context.inningsNumber}-${overNumber}`
    ];
    const requestedBowler: Player | undefined = requestedBowlerId
      ? players[requestedBowlerId]
      : undefined;
    const playableBowlingOptionIds = new Set(getPlayableBowlingOptions(
      bowling.finalXI
        .map((playerId) => players[playerId])
        .filter((player): player is Player => Boolean(player)),
    ).map((player) => player.id));
    const maxBowlerOvers = Math.ceil(maxOvers / 5);
    const requestedBowlerIsLegal: boolean = Boolean(
      requestedBowler
      && bowling.finalXI.includes(requestedBowler.id)
      && playableBowlingOptionIds.has(requestedBowler.id)
      && requestedBowler.id !== previousBowlerId
      && (bowlingEntries.get(requestedBowler.id)?.balls ?? 0) < maxBowlerOvers * 6
    );
    // The smart selection is still calculated first to preserve the RNG stream.
    // A legal manual override bypasses AI workload/cooldown preferences; only
    // cricket rules and the available bowling pool can reject it.
    const bowler: Player = requestedBowlerIsLegal ? requestedBowler! : smartSelection.player;
    const bowlerSelectionReason: BowlerSelectionReason = requestedBowlerIsLegal
      ? "user-selected"
      : smartSelection.reason;
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
        && legalBalls < maxOvers * 6
      && wickets < 10
      && strikerId
      && nonStrikerId
      && (!target || runs < target)
    ) {
      applyScheduledPlayableImpact();
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

      const isDewActive = dewScoringBonus > 0 && overNumber >= Math.ceil(maxOvers / 2);
      const dewIntensity = dewScoringBonus / 0.025;
      const dewBowlerPenalty = isDewActive
        ? (bowler.role === "Spin Bowler" ? -2.5 : -1.2) * dewIntensity
        : 0;
      const heatBowlerPenalty = isAfternoon && spellOverNumber >= 2 ? -1.5 : 0;
      const heatBatterPenalty = isAfternoon && strikerEntry.balls >= 35 ? -1.5 : 0;

      const momentumWicketModifier = bowlingMomentumDeliveries > 0 ? 0.012 : 0;
      const momentumBowlerBoost = bowlingMomentumDeliveries > 0 ? 2.0 : 0;
      if (bowlingMomentumDeliveries > 0) bowlingMomentumDeliveries -= 1;


      const deliveryId = `${context.inningsNumber}-${deliverySequence}`;
      const bowlingConsistency = bowler.bowlingConsistency ?? bowler.consistency ?? 50;
      const bowlingPressureMultiplier = 1
        + (overNumber >= deathStart ? 0.12 : 0)
        + clamp((runs - overStartRuns - 6) * 0.025, 0, 0.25);
      const bowlingMomentum = advanceBowlingConsistencyMomentum(
        bowlingMomentumByPlayer.get(bowler.id) ?? 0,
        bowlingConsistency,
        `${context.seed}:${deliveryId}:${bowler.id}:bowling-rhythm-v1`,
        bowlingPressureMultiplier,
      );
      bowlingMomentumByPlayer.set(bowler.id, bowlingMomentum);

      const bowlingRating = (
        getEffectiveBowlingRating(bowler, rng, context.seed)
        + (playerBowlingLuck.get(bowler.id) ?? 0)
        + bowlingMomentum
        + bowlingPitchAdjustment(bowler, conditions.pitch)
        - fourthSpellOverFatigue
        - powerplayAllRounderFatigue(
          context.priorBattingBalls?.[bowler.id] ?? 0,
          overNumber,
          bowler.role === "All-Rounder",
        )
        + momentumBowlerBoost
        + dewBowlerPenalty
        + heatBowlerPenalty
      );
      const battingPosition = batting.battingOrder.indexOf(striker.id) + 1;
      const setBonus = clamp((strikerEntry.balls - 8) * 0.12, 0, 3.5);
      const battingConsistency = striker.battingConsistency ?? striker.stamina ?? 50;
      const battingMomentum = advanceBattingConsistencyMomentum(
        battingMomentumByPlayer.get(striker.id) ?? 0,
        battingConsistency,
        `${context.seed}:${deliveryId}:${striker.id}:batting-rhythm-v1`,
      );
      battingMomentumByPlayer.set(striker.id, battingMomentum);

      const battingRating = (
        getEffectiveBattingRating(striker, rng, context.seed)
        + (playerBattingLuck.get(striker.id) ?? 0)
        + battingMomentum
        + battingPitchAdjustment(striker, conditions.pitch)
        + setBonus
        - playerPositionPenalty(striker, battingPosition)
        + heatBatterPenalty
      );
      const deliveryControl = context.playableDecisions?.deliveryControls[deliveryId];
      const situationalField = chooseSituationalField(
        context.bowlingTactics.bowling.field,
        overNumber,
        wickets,
        runs,
        target,
        maxOvers,
      );
      // Every playable-match field passes through the same legality gate before
      // it can influence an outcome. This also repairs illegal AI controls from
      // an older saved session instead of allowing them to remain in play.
      const legalFieldPositions = context.playableDecisions
        ? ensurePlayableFieldIsLegal(
          deliveryControl?.fieldPositions,
          situationalField,
          overNumber,
          maxOvers,
        )
        : undefined;
      const fieldInfluenceBowlingPlan = deliveryControl?.bowlingPlan ?? automaticPlayableBowlingPlan(
        context.bowlingTactics,
        overNumber,
        bowler,
        maxOvers,
      );
      const battingApproachAdjustment = deliveryControl?.battingApproach === "survive"
        ? -0.18
        : deliveryControl?.battingApproach === "anchor"
          ? -0.08
          : deliveryControl?.battingApproach === "attack"
            ? 0.10
            : deliveryControl?.battingApproach === "six-hitting"
              ? 0.20
              : 0;
      const isCollapsePhase = (overNumber <= 8 && wickets >= 3) || wickets >= 5;
      const isHighChasePhase = Boolean(target && (target - runs) / Math.max(1, (maxOvers * 6 - (overNumber - 1) * 6)) > 0.16);
      const intent = battingIntent(
        context.tactics,
        overNumber,
        wickets,
        runs,
        target,
        maxOvers,
      ) + bowlerRespectIntentAdjustment(battingRating, bowlingRating)
        + battingApproachAdjustment
        + battingStaffModifiers.synergyModifier
        + battingStaffModifiers.battingControlModifier
        + (isCollapsePhase ? battingStaffModifiers.collapseMitigationFactor : 0)
        + (isHighChasePhase ? battingStaffModifiers.chasePressureResilience : 0);
      const positionedFielders = bowling.finalXI
        .filter((playerId) => playerId !== bowler.id && playerId !== wicketkeeper?.id)
        .map((playerId) => players[playerId])
        .filter((player): player is Player => Boolean(player));
      const fieldInfluence = playableFieldInfluence(
        legalFieldPositions,
        `${context.seed}:${deliveryId}`,
        intent,
        striker,
        bowlingRating,
        deliveryControl?.battingApproach,
        deliveryControl?.shotZone,
        fieldInfluenceBowlingPlan,
      );
      const baseTacticalBowling = bowlingTacticalAdjustment(
        context.bowlingTactics,
        overNumber,
        bowler,
        situationalField,
        maxOvers,
      );
      baseTacticalBowling.wicket += bowlingStaffModifiers.synergyModifier * 0.1;
      if (isSpinner(bowler)) {
        baseTacticalBowling.scoring -= bowlingStaffModifiers.spinExecutionModifier;
      } else if (isPacer(bowler)) {
        baseTacticalBowling.scoring -= bowlingStaffModifiers.paceExecutionModifier;
      }
      const fieldScoringAdjustment = deliveryControl?.fieldPlan === "protect"
        ? -0.025
        : deliveryControl?.fieldPlan === "hunt-wickets"
          ? 0.022
          : 0;
      const fieldWicketAdjustment = deliveryControl?.fieldPlan === "protect"
        ? -0.005
        : deliveryControl?.fieldPlan === "hunt-wickets"
          ? 0.006
          : 0;
      const bowlingPlanScoringAdjustment = deliveryControl?.bowlingPlan === "yorker-attack"
        ? -0.010
        : deliveryControl?.bowlingPlan === "bouncer-pace"
          ? 0.018
          : deliveryControl?.bowlingPlan === "spin-choke"
            ? -0.016
            : 0;
      const bowlingPlanWicketAdjustment = deliveryControl?.bowlingPlan === "yorker-attack"
        ? 0.004
        : deliveryControl?.bowlingPlan === "bouncer-pace"
          ? 0.006
          : deliveryControl?.bowlingPlan === "spin-choke"
            ? 0.002
            : 0;
      const tacticalBowling = {
        scoring: baseTacticalBowling.scoring + fieldScoringAdjustment + bowlingPlanScoringAdjustment,
        wicket: baseTacticalBowling.wicket + fieldWicketAdjustment + bowlingPlanWicketAdjustment,
      };
      const closeDeathChase = Boolean(
        target
        && overNumber >= deathStart
        && target - runs <= 50
      );
      const extrasPressure = deathExtrasPressure(
        overNumber,
        bowlingRating,
        clamp((bowler.pressureRating ?? 50) / 100, 0, 1),
        closeDeathChase,
        maxOvers,
      );
      const phaseModifiers = getPhaseOutcomeModifiers(
        getPhaseMatchup(striker, bowler, overNumber, maxOvers),
      );
      const bowlingFamily = getBowlingFamily(bowler);
      const battingTypePressureKey = bowlingFamily ? `${striker.id}:${bowlingFamily}` : undefined;
      const battingTypePressure = battingTypePressureKey
        ? battingTypePressureByPlayer.get(battingTypePressureKey) ?? 0
        : 0;
      const battingTypeModifiers = getBattingTypeOutcomeModifiers(
        striker,
        bowler,
        battingTypePressure,
      );
      const outcomeModifiers = multiplyOutcomeModifiers(phaseModifiers, battingTypeModifiers);
      const pressureInput: SituationalPressureInput = {
        inningsNumber: context.inningsNumber,
        runs,
        wickets,
        legalBalls,
        maxBalls: maxOvers * 6,
        expectedScore: expectedCentre,
        target,
        consecutiveDots: consecutiveDotBalls,
        recentWickets: recentWicketBalls.filter((ball) => legalBalls - ball <= 12).length,
        batterBalls: strikerEntry.balls,
        batterPosition: battingPosition,
        partnershipBalls: legalBalls - partnershipStartBalls,
        partnershipRuns: runs - partnershipStartRuns,
        matchupPressure: battingTypePressure,
        consecutiveBoundaries,
        runsThisOver: runs - overStartRuns,
        bowlerEconomy: bowlerEntry.balls > 0 ? bowlerEntry.runsConceded / bowlerEntry.balls * 6 : 0,
        fieldingErrorPressure: fieldingErrorPressureBalls > 0 ? 1 : 0,
      };
      const battingPressure = calculateBattingPressure(pressureInput);
      const bowlingPressure = calculateBowlingPressure(pressureInput);
      const batterPressureSignal = attributeSignal(striker.pressureRating);
      const bowlerPressureSignal = attributeSignal(bowler.pressureRating);
      const aggressionUnderPressure = pressureAdjustedAggression(
        striker.battingAggression ?? 65,
        battingPressure,
        striker.pressureRating,
        consecutiveDotBalls,
      );
      const batterBigMatch = bigMatchOutcomeModifiers(striker, battingBigMatchIntensity, "batting");
      const bowlerBigMatch = bigMatchOutcomeModifiers(bowler, bowlingBigMatchIntensity, "bowling");
      const wideProbability = clamp(
        0.015
          + (75 - bowlingRating) * 0.00045
          + extrasPressure.wideIncrease * phaseModifiers.widePressure
          - bowlingPressure * bowlerPressureSignal * 0.003,
        0.009,
        0.039,
      );
      const noBallProbability = clamp(
        0.005
          + (72 - bowlingRating) * 0.00024
          + extrasPressure.noBallIncrease * phaseModifiers.noBallPressure
          - bowlingPressure * bowlerPressureSignal * 0.0012,
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
        const isPowerplay = overNumber <= powerplayEnd;
        const isMiddleOvers = overNumber > powerplayEnd && overNumber < deathStart;
        const isDeathOvers = overNumber >= deathStart;

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
          const remainingBalls = Math.max(1, maxOvers * 6 - legalBalls);
          requiredRunRate = (remainingRuns / (remainingBalls / 6));

          if (requiredRunRate >= 13.0) {
            rrrRunModifier += 0.16;
            rrrWicketModifier += 0.018;
          } else if (requiredRunRate >= 10.0) {
            rrrRunModifier += 0.09;
            rrrWicketModifier += 0.009;
          } else if (requiredRunRate <= 6.0) {
            rrrRunModifier -= 0.07;
          } else if (requiredRunRate <= 7.5) {
            rrrRunModifier -= 0.045;
          } else if (requiredRunRate <= 8.5) {
            rrrRunModifier -= 0.02;
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

        const baseIndividualScoreScoringFactor = strikerEntry.runs >= 120
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
        const eliteConversionRelief = clamp((striker.currentBatting - 84) / 8, 0, 0.45)
          * clamp((80 - strikerEntry.runs) / 20, 0, 1);
        const individualScoreScoringFactor = 1
          - (1 - baseIndividualScoreScoringFactor) * (1 - eliteConversionRelief);
        const pressureRunModifier = (
          1
          + battingPressure * batterPressureSignal * 0.04
          - bowlingPressure * bowlerPressureSignal * 0.03
        );
        const pressureWicketModifier = (
          bowlingPressure * bowlerPressureSignal * 0.005
          - battingPressure * batterPressureSignal * 0.006
        );
        const milestoneScoringFactor = milestonePressureScoringFactor(
          strikerEntry.runs,
          striker.battingAggression ?? 65,
          battingPressure,
        );
        const centuryConversionAdjustment = lowerRatedCenturyConversionAdjustment(
          striker.currentBatting,
          strikerEntry.runs,
        );
        const abilityConversionAdjustment = abilityBasedConversionAdjustment(
          striker.currentBatting,
          strikerEntry.runs,
        );
        const lowRatedAdjustment = lowRatedBattingAdjustment(striker.currentBatting);
        const extremeSeasonAdjustment = extremeSeasonConversionAdjustment(
          striker.currentBatting,
          context.seasonBattingStats?.[striker.id],
        );
        const dotBallPressure = dotBallPressureAdjustment(consecutiveDotBalls);
        const runningPressure = groundRunningPressure(conditions);
        const dewScoringMultiplier = isDewActive ? 1 + dewScoringBonus : 1.0;
        const runEnvironment = clamp(
          clamp(expectedCentre / 159, 0.84, 1.16)
          * inningsEnvironment
          // Ratings remain decisive, but an uncapped linear multiplier made a
          // strong XI compound the same advantage into unrealistic season NRR.
          * (1 + Math.sign(skillDelta) * Math.pow(Math.abs(skillDelta), 0.95) * 0.008)
          * (1 + context.skillEdge)
          * (1 + context.performanceTilt)
          * individualScoreScoringFactor
          * milestoneScoringFactor
          * centuryConversionAdjustment.scoringFactor
          * abilityConversionAdjustment.scoringFactor
          * lowRatedAdjustment.scoringFactor
          * extremeSeasonAdjustment.scoringFactor
          * phaseRunModifier
          * matchupRunModifier
          * rrrRunModifier
          * deteriorationRunModifier
          * tailenderRunModifier
          * pressureRunModifier
          * batterBigMatch.runMultiplier
          * bowlerBigMatch.runMultiplier
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
            : wickets >= 2 && overNumber <= powerplayEnd + 2
              ? 0.6
              : 1;
        const easyChaseWicketRelief = clamp(
          easyTargetRelief + firstInningsCollapseRelief,
          0,
          0.5,
        ) * 0.026 * chaseCollapseResponse;
        const baseIndividualScoreWicketPressure = strikerEntry.runs >= 120
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
        const individualScoreWicketPressure = baseIndividualScoreWicketPressure
          * (1 - eliteConversionRelief * 0.65);
        const battingCaptain = players[batting.plan.captainId ?? ""];
        const battingCaptaincy = battingCaptain?.captaincy ?? 50;
        const captaincyPressureDampener = isKnockoutMatch
          ? 1 - clamp((battingCaptaincy - 65) * 0.005, 0, 0.16)
          : 1;
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
        const battingAllRounderRelief = battingAllRounderWicketRelief(bowler);
        const wicketProbability = clamp(
          0.038
          + dampedRatingDiff * 0.00155
          // Positive intent must buy enough scoring upside to define an
          // attacking identity. The risk remains meaningful, but the former
          // 0.035 slope made aggressive plans lose wickets so quickly that
          // they scored less than cautious plans over a full innings.
          + Math.max(0, intent) * 0.010
          + tacticalBowling.wicket
          + (fieldingRating - 75) * 0.00045
          + collapseWicketPressure
          + phaseWicketModifier
          + matchupWicketModifier
          + rrrWicketModifier * captaincyPressureDampener
          + deteriorationWicketModifier
          + tailenderWicketModifier
          + pressureWicketModifier * captaincyPressureDampener
          + batterBigMatch.wicketAdjustment
          + bowlerBigMatch.wicketAdjustment
          + momentumWicketModifier
          + dotBallPressure.wicketIncrease
          + runningPressure * 0.001
          - Math.max(0, 165 - expectedCentre) * 0.00025
          - easyChaseWicketRelief
          - partnershipSecurity
          - lowTotalSurvivalRelief
          - battingAllRounderRelief
          + individualScoreWicketPressure
          + centuryConversionAdjustment.wicketIncrease
          + abilityConversionAdjustment.wicketIncrease
          + lowRatedAdjustment.wicketIncrease
          + extremeSeasonAdjustment.wicketIncrease
          + (fieldInfluence?.wicketAdjustment ?? 0)
          - Math.min(0, intent) * -0.014,
          0.018,
          0.16,
        );
        const phaseAdjustedWicketProbability = clamp(
          wicketProbability * outcomeModifiers.wicket,
          0.018,
          0.16,
        );
        const tempoAdjustedWicketProbability = aggressionAdjustedWicketProbability(
          phaseAdjustedWicketProbability,
          aggressionUnderPressure.effectiveAggression,
          aggressionUnderPressure.wicketRiskMultiplier,
        );

        const bowlingHaulMultiplier = lowerRatedBowlingHaulMultiplier(
          bowler.currentBowling,
          bowlerEntry.wickets,
        );
        const effectiveWicketProbability = isFreeHit
          ? 0.002 + runningPressure * 0.001
          : tempoAdjustedWicketProbability * bowlingHaulMultiplier;
        const wicketOutcomeRoll = rng.next();
        if (!isNoBall && wicketOutcomeRoll < effectiveWicketProbability) {
          const wicketChance: DeliveryWicket = isFreeHit
            ? (() => {
                const fielder = positionedFielders[fieldInfluence?.ringFielderIndex ?? -1]
                  ?? selectFielder(bowling.finalXI, players, rng);
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
                fieldInfluence,
                positionedFielders,
              );
          // Reuse the wicket-chance roll after normalising it within its range.
          // This keeps fielding resolution independent without perturbing the
          // established scoring random stream with an extra roll on every chance.
          const completionRoll = wicketOutcomeRoll / effectiveWicketProbability;
          if (completionRoll < dismissalCompletionProbability(
            wicketChance,
            players,
            fieldInfluence,
            bowlingPressure,
            bowlingBigMatchIntensity,
          )) {
            wicket = wicketChance;
            wickets += 1;
            recentWicketBalls.push(legalBalls);
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
            0.007
              + (72 - keeperRating) * 0.00045
              + partTimeKeeperPenalty
              - bowlingPressure * attributeSignal(wicketkeeper?.pressureRating) * 0.0015
              - bowlingBigMatchIntensity * attributeSignal(wicketkeeper?.bigMatchRating) * 0.001,
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
                * (striker.isFinisher ? FINISHER_BOUNDARY_MULTIPLIER : 1)
                * (fieldInfluence?.boundaryOpportunityMultiplier ?? 1),
              (striker.isCoreBatter ? CORE_BATTER_ROTATION_MULTIPLIER : 1)
                * (fieldInfluence?.rotationMultiplier ?? 1),
              strikeFarmSingleMultiplier(
                displayLegalBall,
                strikerIsEstablished,
                nonStrikerIsWeak,
                strikerIsWeak,
                nonStrikerIsEstablished,
              ),
              aggressionUnderPressure.effectiveAggression,
              deliveryControl?.battingApproach,
              outcomeModifiers,
            );
            strikerEntry.runs += runsOffBat;
            if (runsOffBat === 4) strikerEntry.fours += 1;
            if (runsOffBat === 6) strikerEntry.sixes += 1;
            const misfieldProbability = clamp(
              0.018
                + (74 - fieldingRating) * 0.0008
                - bowlingBigMatchIntensity * fieldingBigMatchSignal * 0.002,
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
      if (runsOffBat === 4 || runsOffBat === 6) {
        consecutiveBoundaries += 1;
      } else if (isLegal) {
        consecutiveBoundaries = 0;
      }
      if (fieldingEvent) {
        fieldingErrorPressureBalls = 6;
      } else if (isLegal && fieldingErrorPressureBalls > 0) {
        fieldingErrorPressureBalls -= 1;
      }

      if (battingTypePressureKey) {
        battingTypePressureByPlayer.set(
          battingTypePressureKey,
          advanceBattingTypePressure(
            battingTypePressure,
            getBattingTypeRating(striker, bowlingFamily),
            runsOffBat,
            Boolean(wicket),
            isLegal,
          ),
        );
        const otherFamily: BowlingFamily = bowlingFamily === "pace" ? "spin" : "pace";
        const otherKey = `${striker.id}:${otherFamily}`;
        battingTypePressureByPlayer.set(
          otherKey,
          Math.max(0, (battingTypePressureByPlayer.get(otherKey) ?? 0) - (isLegal ? 0.025 : 0)),
        );
      }

      if (isLegal) {
        legalBalls += 1;
        legalBallsThisOver += 1;
        bowlerEntry.balls += 1;
        bowlerEntry.overs = oversFromBalls(bowlerEntry.balls);
        if (collapsePressureBalls > 0) collapsePressureBalls -= 1;
        while (recentWicketBalls.length > 0 && legalBalls - recentWicketBalls[0] > 12) {
          recentWicketBalls.shift();
        }
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
      const shotDescription = fieldInfluence?.shotType === "skier"
        ? "SKIED, "
        : fieldInfluence?.shotType === "edge"
          ? "EDGED, "
          : "";
      const commentary = wicket
        ? `${displayBall} ${bowler.name} to ${striker.name}: ${freeHitLabel}${shotDescription}OUT, ${strikerEntry.dismissal}.`
        : `${displayBall} ${bowler.name} to ${striker.name}: ${freeHitLabel}${shotDescription}${resultCode === "0" ? "no run" : `${resultCode}, ${totalRuns} run${totalRuns === 1 ? "" : "s"}`}${fieldingComment}.`;
      const delivery: MatchDelivery = {
        id: deliveryId,
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
        shotType: fieldInfluence?.shotType,
        shotTarget: fieldInfluence?.shotTarget,
        shotZone: fieldInfluence?.shotZone,
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
        const requestedBatterId = context.playableDecisions?.batterByWicket[
          `${context.inningsNumber}-${wickets}`
        ];
        if (requestedBatterId) {
          if (!batting.battingOrder.includes(requestedBatterId)) {
            if (batting.finalXI.includes(requestedBatterId)) {
              batting.battingOrder.push(requestedBatterId);
            }
          }
          const requestedBatterIndex = batting.battingOrder.indexOf(requestedBatterId);
          if (requestedBatterIndex >= 0) {
            const [requestedBatter] = batting.battingOrder.splice(requestedBatterIndex, 1);
            batting.battingOrder.splice(nextBatterIndex, 0, requestedBatter);
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
      bowlerSelectionReason,
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
  target: number,
  teams: Record<string, Team>,
  superOver?: SuperOverResult,
): string {
  if (superOver) {
    return superOver.summaryText;
  }
  if (!winnerId) return "Match tied";
  if (winnerId === battingFirstTeamId) {
    const margin = Math.max(1, (target - 1) - inningsTwo.runs);
    return `${teams[winnerId]?.name ?? winnerId} won by ${margin} run${margin === 1 ? "" : "s"}`;
  }
  const wicketsRemaining = 10 - inningsTwo.wickets;
  return `${teams[winnerId]?.name ?? winnerId} won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? "" : "s"}`;
}

function simulateMatchToCompletion(
  input: MatchSimulationInput,
  playableDecisions?: PlayableMatchDecisions,
  userTeamId?: string,
): MatchSimulationRecord {
  const rng = new SimulationRandom(`${input.seed}|engine-${MATCH_SIMULATION_VERSION}`);
  const weatherScenario = input.weatherScenario
    ?? createWeatherScenario(input.seed, input.conditions.stadiumId, input.date, input.time);
  const rainAffected = hasRainReducedOvers(weatherScenario);
  const tossRoll = rng.next();
  const tossResult: TossCall = tossRoll < 0.5 ? "heads" : "tails";
  const userTeam = userTeamId === input.teamA.id
    ? input.teamA
    : userTeamId === input.teamB.id
      ? input.teamB
      : undefined;
  const userOpponent = userTeam?.id === input.teamA.id ? input.teamB : input.teamA;
  const tossWinner = playableDecisions?.tossCall && userTeam
    ? playableDecisions.tossCall === tossResult ? userTeam : userOpponent
    : tossRoll < 0.5 ? input.teamA : input.teamB;
  const tossWinnerPlans = tossWinner.id === input.teamA.id
    ? input.teamAPlans
    : input.teamBPlans;
  const tossDecision = tossWinner.id === userTeamId && playableDecisions?.tossDecision
    ? playableDecisions.tossDecision
    : chooseTossDecision(tossWinnerPlans.tactics, input.conditions);
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
  // Individual ratings already affect every delivery. Applying aggregate XI
  // strength as well counted the same quality gap twice, exaggerating strong
  // teams' margins and season NRR. Keep only the modest home-ground edge.
  const strengthEdge = input.conditions.homeTeamId === battingFirstTeam.id
    ? HOME_ADVANTAGE_STRENGTH_BONUS * 0.002
    : input.conditions.homeTeamId === bowlingFirstTeam.id
      ? HOME_ADVANTAGE_STRENGTH_BONUS * -0.002
      : 0;
  // Player luck, form, conditions and delivery outcomes already create match
  // variance. A mirrored team-wide swing boosts one innings while suppressing
  // the other, so even a small value disproportionately widens margins and NRR.
  // Consume the legacy draw so existing deterministic fixture seeds keep the
  // same downstream delivery sequence while the obsolete effect stays disabled.
  rng.gaussian();
  const performanceEdge = 0;
  const matchScoringEnvironment = clamp(
    1 + seededGaussian(`${input.seed}:shared-scoring-environment-v3`) * 0.02,
    0.94,
    1.06,
  );

  const derivedForm = input.recentScorecards && input.recentScorecards.length > 0
    ? derivePlayerDisciplineFormAdjustments(input.recentScorecards)
    : { batting: {}, bowling: {} };
  // `formAdjustments` remains a compatibility fallback for older callers. New
  // callers should supply discipline-specific maps so one skill cannot inflate
  // the other for all-rounders.
  const activeBattingFormAdjustments = {
    ...derivedForm.batting,
    ...(input.formAdjustments ?? {}),
    ...(input.battingFormAdjustments ?? {}),
  };
  const activeBowlingFormAdjustments = {
    ...derivedForm.bowling,
    ...(input.formAdjustments ?? {}),
    ...(input.bowlingFormAdjustments ?? {}),
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
    matchScoringEnvironment,
    battingFormAdjustments: activeBattingFormAdjustments,
    bowlingFormAdjustments: activeBowlingFormAdjustments,
    seasonBattingStats: input.seasonBattingStats,
    allowCollapseImpact: battingFirstTeam.id !== userTeamId,
    seed: input.seed,
    stage: input.stage,
    isKnockout: input.isKnockout,
    bigMatchIntensityByTeam: input.bigMatchIntensityByTeam,
    time: input.time,
    maxOvers: weatherScenario.firstInningsOvers,
    playableDecisions,
    staffState: input.staffState,
  });

  const originalTarget = firstInnings.runs + 1;
  const dlsApplied = weatherScenario.secondInningsOvers < weatherScenario.firstInningsOvers;
  const revisedTarget = dlsApplied
    ? calculateDLSRevisedTarget(
      firstInnings.runs,
      weatherScenario.secondInningsOvers,
      0,
      0,
      weatherScenario.firstInningsOvers,
    )
    : originalTarget;

  const bowlingFirstImpactChoice = playableDecisions?.impactByTeam?.[bowlingFirstTeam.id];
  const battingFirstImpactChoice = playableDecisions?.impactByTeam?.[battingFirstTeam.id];
  const bowlingFirstChoiceIsScheduled = typeof bowlingFirstImpactChoice?.activationInningsNumber === "number";
  const battingFirstChoiceIsScheduled = typeof battingFirstImpactChoice?.activationInningsNumber === "number";
  const appliedBowlingFirstChoice = bowlingFirstImpactChoice && !bowlingFirstChoiceIsScheduled
    ? applyPlayableImpactChoice(bowlingFirstState, bowlingFirstImpactChoice, input.players, true)
    : false;
  const appliedBattingFirstChoice = battingFirstImpactChoice && !battingFirstChoiceIsScheduled
    ? applyPlayableImpactChoice(battingFirstState, battingFirstImpactChoice, input.players, false)
    : false;
  const bowlingFirstRecommendationState: ActiveTeamState = {
    ...bowlingFirstState,
    finalXI: [...bowlingFirstState.finalXI],
    battingOrder: [...bowlingFirstState.battingOrder],
    impactDecision: { ...bowlingFirstState.impactDecision },
  };
  const battingFirstRecommendationState: ActiveTeamState = {
    ...battingFirstState,
    finalXI: [...battingFirstState.finalXI],
    battingOrder: [...battingFirstState.battingOrder],
    impactDecision: { ...battingFirstState.impactDecision },
  };
  if (!bowlingFirstRecommendationState.impactUsed) {
    activateBowlFirstImpact(
      bowlingFirstRecommendationState,
      firstInnings.runs + 1,
      input.conditions,
      input.players,
    );
  }
  if (!battingFirstRecommendationState.impactUsed) {
    activateStandardBatFirstImpact(
      battingFirstRecommendationState,
      input.players,
    );
  }
  if (!bowlingFirstState.impactUsed && !appliedBowlingFirstChoice && bowlingFirstTeam.id !== userTeamId) {
    activateBowlFirstImpact(
      bowlingFirstState,
      firstInnings.runs + 1,
      input.conditions,
      input.players,
    );
  }
  if (!battingFirstState.impactUsed && !appliedBattingFirstChoice && battingFirstTeam.id !== userTeamId) {
    activateStandardBatFirstImpact(
      battingFirstState,
      input.players,
    );
  }

  const secondInnings = simulateInnings({
    inningsNumber: 2,
    batting: bowlingFirstState,
    bowling: battingFirstState,
    players: input.players,
    tactics: bowlingFirstPlans.tactics,
    bowlingTactics: battingFirstPlans.tactics,
    conditions: input.conditions,
    rng,
    target: revisedTarget,
    firstInningsWickets: firstInnings.wickets,
    skillEdge: -strengthEdge,
    performanceTilt: -performanceEdge,
    matchScoringEnvironment,
    battingFormAdjustments: activeBattingFormAdjustments,
    bowlingFormAdjustments: activeBowlingFormAdjustments,
    seasonBattingStats: input.seasonBattingStats,
    priorBattingBalls: Object.fromEntries(
      firstInnings.batting.map((entry) => [entry.id, entry.balls]),
    ),
    allowCollapseImpact: false,
    seed: input.seed,
    stage: input.stage,
    isKnockout: input.isKnockout,
    bigMatchIntensityByTeam: input.bigMatchIntensityByTeam,
    time: input.time,
    maxOvers: weatherScenario.secondInningsOvers,
    playableDecisions,
    staffState: input.staffState,
  });

  const chasingImpact = bowlingFirstState.impactDecision;
  const chasingImpactPosition = chasingImpact.battingPosition;
  const chaseCompletedBeforeImpactWasNeeded = Boolean(
    chasingImpact.used
    && chasingImpact.incomingPlayerId
    && chasingImpact.outgoingPlayerId
    && chasingImpactPosition
    && secondInnings.runs >= revisedTarget
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

  let winnerId: string = secondInnings.runs >= revisedTarget
    ? bowlingFirstTeam.id
    : secondInnings.runs < revisedTarget - 1
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
  const baseResultText = resultText(
    winnerId,
    battingFirstTeam.id,
    firstInnings,
    secondInnings,
    revisedTarget,
    teams,
    superOver,
  );
  const finalResultText = dlsApplied
    ? `${baseResultText} (DLS method - Rain affected)`
    : appendRainAffectedResultLabel(baseResultText, rainAffected);
  const firstInningsResourcePercentage = dlsResourcePercentage(weatherScenario.firstInningsOvers, 0) * 100;
  const secondInningsResourcePercentage = dlsResourcePercentage(weatherScenario.secondInningsOvers, 0) * 100;
  const weatherMatchSummary = rainAffected
    ? dlsApplied
      ? weatherScenario.kind === "multiple-showers"
        ? `Repeated rain caused a ${weatherScenario.rainDelayMinutes}-minute delay, reducing ${battingFirstTeam.name}'s allocation from 20 to ${weatherScenario.firstInningsOvers} overs and then reducing ${bowlingFirstTeam.name}'s chase further to ${weatherScenario.secondInningsOvers} overs. After ${battingFirstTeam.name} made ${firstInnings.runs}/${firstInnings.wickets}, DLS compared ${firstInningsResourcePercentage.toFixed(1)}% resources for the first innings with ${secondInningsResourcePercentage.toFixed(1)}% for the chase and revised the target from ${originalTarget} to ${revisedTarget} runs from ${weatherScenario.secondInningsOvers} overs.`
        : `Rain during the innings break caused a ${weatherScenario.rainDelayMinutes}-minute delay and reduced ${bowlingFirstTeam.name}'s chase from 20 to ${weatherScenario.secondInningsOvers} overs. After ${battingFirstTeam.name} made ${firstInnings.runs}/${firstInnings.wickets} from its full allocation, DLS reduced the target from ${originalTarget} to ${revisedTarget} runs from ${weatherScenario.secondInningsOvers} overs (${firstInningsResourcePercentage.toFixed(1)}% resources versus ${secondInningsResourcePercentage.toFixed(1)}%).`
      : `Rain before play caused a ${weatherScenario.rainDelayMinutes}-minute delay and reduced the match from 20 to ${weatherScenario.firstInningsOvers} overs per side. ${battingFirstTeam.name} made ${firstInnings.runs}/${firstInnings.wickets}, so ${bowlingFirstTeam.name} needed ${revisedTarget} from ${weatherScenario.secondInningsOvers} overs. The target remained one more than the first-innings score because both teams received the same allocation, so no DLS adjustment was required.`
    : weatherScenario.summary;
  const resolvedWeatherScenario: MatchWeatherScenario = {
    ...weatherScenario,
    summary: weatherMatchSummary,
    dlsApplied,
    originalTarget,
    revisedTarget,
    firstInningsResourcePercentage,
    secondInningsResourcePercentage,
  };
  const summary = [
    `${tossWinner.name} won the toss and chose to ${tossDecision}.`,
    `${battingFirstTeam.name} scored ${firstInnings.runs}/${firstInnings.wickets} in ${firstInnings.overs.toFixed(1)} overs.`,
    ...[battingFirstState.impactDecision, bowlingFirstState.impactDecision]
      .filter((decision) => decision.used)
      .map((decision) => decision.explanation),
    `${bowlingFirstTeam.name} scored ${secondInnings.runs}/${secondInnings.wickets} in ${secondInnings.overs.toFixed(1)} overs.`,
    ...(rainAffected ? [weatherMatchSummary] : []),
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
      weather: resolvedWeatherScenario,
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
    impactRecommendations: [
      battingFirstRecommendationState.impactDecision,
      bowlingFirstRecommendationState.impactDecision,
    ],
    innings: [firstInnings, secondInnings],
    summary,
  };
}

export function simulateInstantMatch(input: MatchSimulationInput): MatchSimulationRecord {
  return simulateMatchToCompletion(input);
}

function flattenMatchDeliveries(simulation: MatchSimulationRecord): MatchDelivery[] {
  return simulation.innings.flatMap((innings) => (
    innings.oversDetail.flatMap((over) => over.deliveries)
  ));
}

function playableInningsProgress(
  innings: MatchInnings,
  visibleDeliveries: MatchDelivery[],
  complete: boolean,
): PlayableInningsProgress {
  const lastDelivery = visibleDeliveries.at(-1);
  return {
    inningsNumber: innings.inningsNumber,
    battingTeamId: innings.battingTeamId,
    bowlingTeamId: innings.bowlingTeamId,
    runs: lastDelivery?.scoreAfter ?? 0,
    wickets: lastDelivery?.wicketsAfter ?? 0,
    legalBalls: lastDelivery?.legalBallNumber ?? 0,
    overs: oversFromBalls(lastDelivery?.legalBallNumber ?? 0),
    target: innings.target,
    deliveries: visibleDeliveries,
    complete,
  };
}

/**
 * Runs a deterministic playable match and reveals only completed deliveries.
 * Re-running from the fixture seed makes the session safe to persist after
 * every ball while retaining the exact native scorecard on completion.
 */
export function simulatePlayableMatch(
  input: MatchSimulationInput,
  userTeamId: string,
  decisions: PlayableMatchDecisions,
  requestedRevealedDeliveries: number,
): PlayableMatchProgress {
  const tossRng = new SimulationRandom(`${input.seed}|engine-${MATCH_SIMULATION_VERSION}`);
  const tossRoll = tossRng.next();
  const tossResult: TossCall = tossRoll < 0.5 ? "heads" : "tails";
  const userTeam = userTeamId === input.teamA.id ? input.teamA : input.teamB;
  const opponent = userTeam.id === input.teamA.id ? input.teamB : input.teamA;
  const legacyStartedMatch = requestedRevealedDeliveries > 0 || Boolean(decisions.tossDecision);

  if (!decisions.tossCall && !legacyStartedMatch) {
    return {
      awaitingTossCall: true,
      awaitingTossDecision: false,
      awaitingTossAcknowledgement: false,
      revealedDeliveries: 0,
      totalDeliveries: 0,
      inningsDeliveryEnds: [0, 0],
      innings: [],
      complete: false,
    };
  }

  if (decisions.tossCall) {
    const tossWinner = decisions.tossCall === tossResult ? userTeam : opponent;
    const tossWinnerPlans = tossWinner.id === input.teamA.id ? input.teamAPlans : input.teamBPlans;
    const resolvedTossDecision = tossWinner.id === userTeamId
      ? decisions.tossDecision
      : chooseTossDecision(tossWinnerPlans.tactics, input.conditions);
    const awaitingTossDecision = tossWinner.id === userTeamId && !resolvedTossDecision;
    const awaitingTossAcknowledgement = tossWinner.id !== userTeamId && !decisions.tossResultAcknowledged;

    if (awaitingTossDecision || awaitingTossAcknowledgement) {
      return {
        tossWinnerId: tossWinner.id,
        tossCall: decisions.tossCall,
        tossResult,
        tossDecision: resolvedTossDecision,
        awaitingTossCall: false,
        awaitingTossDecision,
        awaitingTossAcknowledgement,
        revealedDeliveries: 0,
        totalDeliveries: 0,
        inningsDeliveryEnds: [0, 0],
        innings: [],
        complete: false,
      };
    }
  }

  const simulation = simulateMatchToCompletion(input, decisions, userTeamId);
  const firstDeliveries = simulation.innings[0].oversDetail.flatMap((over) => over.deliveries);
  const secondDeliveries = simulation.innings[1].oversDetail.flatMap((over) => over.deliveries);
  const allDeliveries = flattenMatchDeliveries(simulation);
  const revealedDeliveries = clamp(
    Math.floor(requestedRevealedDeliveries),
    0,
    allDeliveries.length,
  );
  const visibleFirstCount = Math.min(firstDeliveries.length, revealedDeliveries);
  const visibleSecondCount = Math.max(
    0,
    Math.min(secondDeliveries.length, revealedDeliveries - firstDeliveries.length),
  );
  const firstVisible = firstDeliveries.slice(0, visibleFirstCount);
  const secondVisible = secondDeliveries.slice(0, visibleSecondCount);
  const complete = revealedDeliveries >= allDeliveries.length;
  const nextDelivery = allDeliveries[revealedDeliveries];
  const nextOverNumber = nextDelivery
    ? nextDelivery.overNumber + (nextDelivery.deliveryInOver === 1 ? 0 : 1)
    : undefined;
  const nextOverFirstDelivery = nextDelivery && nextOverNumber !== undefined
    ? allDeliveries.slice(revealedDeliveries).find((delivery) => (
      delivery.inningsNumber === nextDelivery.inningsNumber
      && delivery.overNumber === nextOverNumber
    ))
    : undefined;
  const innings: PlayableInningsProgress[] = [
    playableInningsProgress(
      simulation.innings[0],
      firstVisible,
      visibleFirstCount >= firstDeliveries.length,
    ),
  ];
  if (visibleSecondCount > 0 || revealedDeliveries >= firstDeliveries.length) {
    innings.push(playableInningsProgress(
      simulation.innings[1],
      secondVisible,
      visibleSecondCount >= secondDeliveries.length,
    ));
  }

  return {
    tossWinnerId: simulation.tossWinnerId,
    tossCall: decisions.tossCall,
    tossResult: decisions.tossCall ? tossResult : undefined,
    tossDecision: simulation.tossDecision,
    awaitingTossCall: false,
    awaitingTossDecision: false,
    awaitingTossAcknowledgement: false,
    battingFirstTeamId: simulation.battingFirstTeamId,
    bowlingFirstTeamId: simulation.bowlingFirstTeamId,
    revealedDeliveries,
    totalDeliveries: allDeliveries.length,
    inningsDeliveryEnds: [firstDeliveries.length, allDeliveries.length],
    innings,
    nextDelivery,
    nextOverBowler: nextOverFirstDelivery
      ? {
        overNumber: nextOverFirstDelivery.overNumber,
        bowlerId: nextOverFirstDelivery.bowlerId,
        bowlerName: nextOverFirstDelivery.bowlerName,
        selectionReason: simulation.innings
          .find((inningsItem) => inningsItem.inningsNumber === nextOverFirstDelivery.inningsNumber)
          ?.oversDetail.find((over) => over.number === nextOverFirstDelivery.overNumber)
          ?.bowlerSelectionReason,
      }
      : undefined,
    awaitingImpactDecision: false,
    impactRecommendation: !decisions.impactByTeam?.[userTeamId]
      ? simulation.impactRecommendations?.find((decision) => decision.teamId === userTeamId)
      : undefined,
    complete,
    simulation: complete ? simulation : undefined,
  };
}

export type PlayableSkipKind = "ball" | "over" | "five-overs" | "innings";

export function getPlayableSkipTarget(
  input: MatchSimulationInput,
  userTeamId: string,
  decisions: PlayableMatchDecisions,
  revealedDeliveries: number,
  kind: PlayableSkipKind,
): number {
  const simulation = simulateMatchToCompletion(input, decisions, userTeamId);
  const first = simulation.innings[0].oversDetail.flatMap((over) => over.deliveries);
  const second = simulation.innings[1].oversDetail.flatMap((over) => over.deliveries);
  const all = [...first, ...second];
  const current = clamp(Math.floor(revealedDeliveries), 0, all.length);
  if (kind === "ball") return Math.min(all.length, current + 1);
  if (kind === "innings") return current < first.length ? first.length : all.length;

  const inningsStart = current < first.length ? 0 : first.length;
  const inningsDeliveries = current < first.length ? first : second;
  const localCurrent = current - inningsStart;
  const currentLegalBalls = localCurrent > 0
    ? inningsDeliveries[Math.min(localCurrent, inningsDeliveries.length) - 1]?.legalBallNumber ?? 0
    : 0;
  const targetLegalBalls = kind === "five-overs"
    ? currentLegalBalls + 30
    : Math.floor(currentLegalBalls / 6) * 6 + 6;
  const targetIndex = inningsDeliveries.findIndex((delivery, index) => (
    index >= localCurrent && delivery.legalBallNumber >= targetLegalBalls
  ));
  return inningsStart + (targetIndex < 0 ? inningsDeliveries.length : targetIndex + 1);
}

export function createIntelligentAiTactics(
  team: Team,
  pitch: CuratorPitch,
  staffState?: CareerStaffState | null,
): TeamTactics {
  if (staffState && staffState.initialized) {
    return deriveAITeamTactics(team, staffState, pitch);
  }
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
