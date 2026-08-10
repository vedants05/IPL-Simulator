"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Activity, ChevronDown, Gauge, Pause, Play, Shield, SkipForward, Target, UserPlus, Users, X, Zap } from "lucide-react";
import {
  getPlayableBowlingOptions,
  simulatePlayableMatch,
  type MatchDelivery,
  type MatchSimulationInput,
  type MatchSimulationRecord,
  type PlayableBattingApproach,
  type PlayableBowlingPlan,
  type PlayableFieldPlan,
  type PlayableFieldPosition,
  type PlayableImpactChoice,
  type PlayableMatchDecisions,
  type PlayableShotZone,
  type PlayableSkipKind,
} from "@/lib/logic/matchSimulation";
import type { Player, Team } from "@/lib/types";
import styles from "./PlayableMatchEngine.module.css";

export interface PlayableMatchSession {
  version: 1;
  fixtureId: string;
  revealedDeliveries: number;
  decisions: PlayableMatchDecisions;
}

interface Props {
  input: MatchSimulationInput;
  userTeamId: string;
  session: PlayableMatchSession;
  onSessionChange: (session: PlayableMatchSession) => void;
  onComplete: (simulation: MatchSimulationRecord) => void;
}

type FieldPosition = PlayableFieldPosition;
type FieldZone = { label: string; x: number; y: number; depth: "close" | "ring" | "deep" };
type FieldPreset = { powerplay: FieldPosition[]; openField: FieldPosition[] };
type ShotPhase = "runup" | "delivery" | "bowled" | "shot" | "fielded" | "throw" | "received";
interface ActiveShot {
  delivery: MatchDelivery;
  phase: ShotPhase;
  fielderCollects: boolean;
  batRuns: number;
  ballX: number;
  ballY: number;
  ballHitX: number;
  ballHitY: number;
  bowlerX: number;
  closestFielderIdx: number;
  receiverX: number;
  receiverY: number;
  releaseDelay: number;
  deliveryDuration: number;
  runningDuration: number;
  shotDuration: number;
  throwDuration: number;
}

const FIELD_ZONE_ANCHORS: FieldZone[] = [
  { label: "1st slip", x: 56, y: 69, depth: "close" },
  { label: "2nd slip", x: 59.5, y: 68, depth: "close" },
  { label: "3rd slip", x: 62.5, y: 66.5, depth: "close" },
  { label: "Leg slip", x: 45, y: 68, depth: "close" },
  { label: "Gully", x: 65, y: 63, depth: "close" },
  { label: "Silly point", x: 55.5, y: 58.5, depth: "close" },
  { label: "Short cover", x: 59.5, y: 50.5, depth: "close" },
  { label: "Short midwicket", x: 40.5, y: 50.5, depth: "close" },
  { label: "Short leg", x: 44.5, y: 56.5, depth: "close" },
  { label: "Backward point", x: 73, y: 61, depth: "ring" },
  { label: "Point", x: 76, y: 55, depth: "ring" },
  { label: "Cover point", x: 75, y: 46, depth: "ring" },
  { label: "Cover", x: 73, y: 40, depth: "ring" },
  { label: "Extra cover", x: 66, y: 30, depth: "ring" },
  { label: "Mid off", x: 58, y: 26, depth: "ring" },
  { label: "Mid on", x: 42, y: 26, depth: "ring" },
  { label: "Midwicket", x: 27, y: 38, depth: "ring" },
  { label: "Square leg", x: 24, y: 55, depth: "ring" },
  { label: "Backward square leg", x: 27, y: 63, depth: "ring" },
  { label: "Short fine leg", x: 36, y: 74, depth: "ring" },
  { label: "Third man", x: 79, y: 85, depth: "deep" },
  { label: "Deep backward point", x: 90, y: 70, depth: "deep" },
  { label: "Deep point", x: 95, y: 52, depth: "deep" },
  { label: "Deep cover", x: 85, y: 20, depth: "deep" },
  { label: "Deep extra cover", x: 69, y: 7, depth: "deep" },
  { label: "Long off", x: 58, y: 5, depth: "deep" },
  { label: "Long on", x: 42, y: 5, depth: "deep" },
  { label: "Deep midwicket", x: 15, y: 20, depth: "deep" },
  { label: "Deep square leg", x: 5, y: 52, depth: "deep" },
  { label: "Deep backward square", x: 10, y: 72, depth: "deep" },
  { label: "Fine leg", x: 26, y: 90, depth: "deep" },
];

// These radii exactly match `.innerCircle { inset: 19% 17% }` in the field.
const THIRTY_YARD_RADIUS_X = 33;
const THIRTY_YARD_RADIUS_Y = 31;
const MAX_FIELD_RADIUS = 0.94;

const isOutsideThirtyYardCircle = ({ x, y }: Pick<FieldPosition, "x" | "y">) => (
  Math.hypot((x - 50) / THIRTY_YARD_RADIUS_X, (y - 50) / THIRTY_YARD_RADIUS_Y) > 1
);

const isLegSideBehindSquare = ({ x, y }: Pick<FieldPosition, "x" | "y">) => x < 50 && y > 59;

function clampInsideBoundary(x: number, y: number) {
  const dx = (x - 50) / 50;
  const dy = (y - 50) / 50;
  const radius = Math.hypot(dx, dy);
  if (radius <= MAX_FIELD_RADIUS) return { x, y };
  const scale = MAX_FIELD_RADIUS / radius;
  return { x: 50 + dx * 50 * scale, y: 50 + dy * 50 * scale };
}

function fieldPositionLabel(x: number, y: number) {
  const depth: FieldZone["depth"] = isOutsideThirtyYardCircle({ x, y }) ? "deep" : "ring";
  const candidates = FIELD_ZONE_ANCHORS.filter((zone) => depth === "deep" ? zone.depth === "deep" : zone.depth !== "deep");
  return candidates.reduce((closest, zone) => {
    const distance = Math.hypot(zone.x - x, zone.y - y);
    return distance < closest.distance ? { label: zone.label, distance } : closest;
  }, { label: "Field", distance: Number.POSITIVE_INFINITY }).label;
}

const MODERATE_POWERPLAY_FIELD: FieldPosition[] = [
  { id: 0, label: "1st slip", x: 56, y: 69 }, { id: 1, label: "Point", x: 76, y: 55 },
  { id: 2, label: "Cover", x: 73, y: 40 }, { id: 3, label: "Mid off", x: 58, y: 26 },
  { id: 4, label: "Mid on", x: 42, y: 26 }, { id: 5, label: "Square leg", x: 24, y: 55 },
  { id: 6, label: "Fine leg", x: 26, y: 90 }, { id: 7, label: "Third man", x: 79, y: 85 },
  { id: 8, label: "Midwicket", x: 27, y: 38 },
];

const FIELD_PRESETS: Record<string, FieldPreset> = {
  Moderate: {
    powerplay: MODERATE_POWERPLAY_FIELD,
    openField: [
      { id: 0, label: "Point", x: 76, y: 55 }, { id: 1, label: "Cover", x: 73, y: 40 },
      { id: 2, label: "Mid off", x: 58, y: 26 }, { id: 3, label: "Short fine leg", x: 36, y: 74 },
      { id: 4, label: "Deep point", x: 95, y: 52 }, { id: 5, label: "Deep cover", x: 85, y: 20 },
      { id: 6, label: "Long off", x: 58, y: 5 }, { id: 7, label: "Long on", x: 42, y: 5 },
      { id: 8, label: "Deep midwicket", x: 15, y: 20 },
    ],
  },
  Attacking: {
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
  Defensive: {
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

const fieldPresetPositions = (name: string, powerplay: boolean) => (
  powerplay ? FIELD_PRESETS[name].powerplay : FIELD_PRESETS[name].openField
);
const SPEEDS = [1, 2, 4, 8] as const;
const SHOT_ZONE_OPTIONS: Array<{ value: PlayableShotZone; label: string }> = [
  { value: "all-ground", label: "360°" },
  { value: "offside", label: "Offside" },
  { value: "straight", label: "Straight" },
  { value: "legside", label: "Legside" },
];
const FALLBACK_SHOT_TARGETS = [
  { x: 12, y: 55 }, { x: 22, y: 25 }, { x: 50, y: 12 }, { x: 78, y: 25 },
  { x: 88, y: 55 }, { x: 70, y: 80 }, { x: 30, y: 80 },
] as const;
const surname = (name = "Player") => name.split(" ").at(-1) ?? name;
const overs = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;
const hash = (value: string) => Array.from(value).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 7);
const isKeeper = (player?: Player) => Boolean(player && (player.role === "WK-Batsman" || player.isWicketkeeper || player.isPartTimeWk));
const isBowler = (player?: Player) => Boolean(player && player.currentBowling >= 45 && player.role !== "WK-Batsman");
const cloneDecisions = (decisions: PlayableMatchDecisions): PlayableMatchDecisions => ({
  ...decisions,
  deliveryControls: Object.fromEntries(Object.entries(decisions.deliveryControls).map(([id, control]) => [id, {
    ...control,
    fieldPositions: control.fieldPositions?.map((position) => ({ ...position })),
  }])), bowlerByOver: { ...decisions.bowlerByOver },
  batterByWicket: { ...decisions.batterByWicket },
  resolvedBatterWickets: { ...(decisions.resolvedBatterWickets ?? {}) },
  impactByTeam: { ...(decisions.impactByTeam ?? {}) },
});

function batterFigures(deliveries: MatchDelivery[], playerId?: string) {
  if (!playerId) return { runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
  return deliveries.reduce((line, delivery) => {
    if (delivery.strikerId === playerId) {
      line.runs += delivery.runsOffBat;
      if (delivery.extras.wides === 0) line.balls += 1;
      if (delivery.runsOffBat === 4) line.fours += 1;
      if (delivery.runsOffBat === 6) line.sixes += 1;
    }
    if (delivery.wicket?.playerId === playerId) line.out = true;
    return line;
  }, { runs: 0, balls: 0, fours: 0, sixes: 0, out: false });
}

function bowlerFigures(deliveries: MatchDelivery[], playerId?: string) {
  if (!playerId) return { balls: 0, runs: 0, wickets: 0 };
  return deliveries.reduce((line, delivery) => {
    if (delivery.bowlerId !== playerId) return line;
    if (delivery.isLegal) line.balls += 1;
    line.runs += delivery.runsOffBat + delivery.extras.wides + delivery.extras.noBalls;
    if (delivery.wicket?.bowlerCredited) line.wickets += 1;
    return line;
  }, { balls: 0, runs: 0, wickets: 0 });
}

function fixedCreaseSlotIds(
  deliveries: MatchDelivery[],
  nextDelivery: MatchDelivery | undefined,
): Array<string | null> {
  const firstSnapshot = deliveries[0] ?? nextDelivery;
  if (!firstSnapshot) return [null, null];
  const slots: Array<string | null> = [firstSnapshot.strikerId, firstSnapshot.nonStrikerId];

  const addActiveBatters = (delivery: MatchDelivery) => {
    [delivery.strikerId, delivery.nonStrikerId].forEach((playerId) => {
      if (slots.includes(playerId)) return;
      const emptySlot = slots.indexOf(null);
      if (emptySlot >= 0) slots[emptySlot] = playerId;
    });
  };

  deliveries.forEach((delivery) => {
    addActiveBatters(delivery);
    if (!delivery.wicket) return;
    const dismissedSlot = slots.indexOf(delivery.wicket.playerId);
    if (dismissedSlot >= 0) slots[dismissedSlot] = null;
  });
  if (nextDelivery) addActiveBatters(nextDelivery);
  return slots;
}

export default function PlayableMatchEngine({ input, userTeamId, session, onSessionChange, onComplete }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [battingApproach, setBattingApproach] = useState<PlayableBattingApproach>("balanced");
  const [batterApproaches, setBatterApproaches] = useState<Record<string, PlayableBattingApproach>>({});
  const [batterShotZones, setBatterShotZones] = useState<Record<string, PlayableShotZone>>({});
  const [fieldPlan, setFieldPlan] = useState<PlayableFieldPlan>("balanced");
  const [bowlingPlan, setBowlingPlan] = useState<PlayableBowlingPlan>("good-length");
  const [fieldPositions, setFieldPositions] = useState<FieldPosition[]>(() => MODERATE_POWERPLAY_FIELD.map((position) => ({ ...position })));
  const [activePreset, setActivePreset] = useState("Moderate");
  const [showZoneOverlay, setShowZoneOverlay] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [activeShot, setActiveShot] = useState<ActiveShot | null>(null);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const [impactIncoming, setImpactIncoming] = useState("");
  const [impactOutgoing, setImpactOutgoing] = useState("");
  const stadiumRef = useRef<HTMLDivElement>(null);
  const timeouts = useRef<number[]>([]);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const progress = useMemo(() => simulatePlayableMatch(input, userTeamId, session.decisions, session.revealedDeliveries), [input, session, userTeamId]);
  const teams: Record<string, Team> = { [input.teamA.id]: input.teamA, [input.teamB.id]: input.teamB };
  const currentInnings = progress.innings.at(-1);
  const visible = currentInnings?.deliveries ?? [];
  const lastDelivery = visible.at(-1);
  const nextDelivery = progress.nextDelivery;
  const battingTeamId = currentInnings?.battingTeamId ?? progress.battingFirstTeamId ?? input.teamA.id;
  const bowlingTeamId = currentInnings?.bowlingTeamId ?? progress.bowlingFirstTeamId ?? input.teamB.id;
  const battingTeam = teams[battingTeamId];
  const bowlingTeam = teams[bowlingTeamId];
  const homeTeam = teams[input.conditions.homeTeamId] ?? input.teamA;
  const awayTeam = homeTeam.id === input.teamA.id ? input.teamB : input.teamA;
  const matchHashtag = `#${homeTeam.shortName}v${awayTeam.shortName}`;
  const userIsBatting = battingTeamId === userTeamId;
  const activeRole = userIsBatting ? "batting" : "bowling";
  const inningsNumber = nextDelivery?.inningsNumber ?? currentInnings?.inningsNumber ?? 1;
  const planFor = (teamId: string) => {
    const plans = teamId === input.teamA.id ? input.teamAPlans : input.teamBPlans;
    return teamId === progress.battingFirstTeamId ? plans.battingFirst : plans.bowlingFirst;
  };
  const battingPlan = planFor(battingTeamId);
  const bowlingPlanLineup = planFor(bowlingTeamId);
  const impactChoice = session.decisions.impactByTeam?.[userTeamId];
  const applyImpactToXI = (ids: string[], teamId: string) => {
    if (teamId !== userTeamId || !impactChoice?.use || !impactChoice.incomingPlayerId || !impactChoice.outgoingPlayerId) return ids;
    return [...ids.filter((id) => id !== impactChoice.outgoingPlayerId), impactChoice.incomingPlayerId];
  };
  const battingXI = applyImpactToXI(battingPlan.startingXI, battingTeamId).map((id) => input.players[id]).filter((player): player is Player => Boolean(player));
  const bowlingXI = applyImpactToXI(bowlingPlanLineup.startingXI, bowlingTeamId).map((id) => input.players[id]).filter((player): player is Player => Boolean(player));
  const striker = input.players[nextDelivery?.strikerId ?? lastDelivery?.strikerId ?? battingXI[0]?.id];
  const nonStriker = input.players[nextDelivery?.nonStrikerId ?? lastDelivery?.nonStrikerId ?? battingXI[1]?.id];
  const currentBowlerId = nextDelivery?.bowlerId ?? lastDelivery?.bowlerId;
  const bowler = (currentBowlerId ? input.players[currentBowlerId] : undefined) ?? bowlingXI.find(isBowler) ?? bowlingXI[0];
  const keeper = bowlingXI.find(isKeeper) ?? bowlingXI[1];
  const outfielders = bowlingXI.filter((player) => player.id !== keeper?.id && player.id !== bowler?.id);
  const activeBowlerLine = bowlerFigures(visible, bowler?.id);
  const creaseCards = fixedCreaseSlotIds(visible, nextDelivery)
    .map((playerId) => playerId ? input.players[playerId] : undefined)
    .filter((player): player is Player => Boolean(player))
    .map((player) => ({
      player,
      line: batterFigures(visible, player.id),
      strike: player.id === striker?.id,
    }));
  const dismissedIds = new Set(visible.flatMap((delivery) => delivery.wicket?.playerId ? [delivery.wicket.playerId] : []));
  const remainingBatters = battingXI.filter((player) => (
    !dismissedIds.has(player.id)
    && player.id !== striker?.id
    && player.id !== nonStriker?.id
  ));
  const upcomingBatterDecisionKey = userIsBatting && nextDelivery && (currentInnings?.wickets ?? 0) < 9
    ? `${inningsNumber}-${(currentInnings?.wickets ?? 0) + 1}`
    : null;
  const wicketBatterDecisionKey = userIsBatting
    && lastDelivery?.wicket
    && nextDelivery
    && lastDelivery.inningsNumber === inningsNumber
    ? `${lastDelivery.inningsNumber}-${lastDelivery.wicketsAfter}`
    : null;
  const awaitingBatterSelection = Boolean(
    wicketBatterDecisionKey
    && !session.decisions.resolvedBatterWickets?.[wicketBatterDecisionKey],
  );
  const wicketSurvivorId = lastDelivery?.wicket
    ? (lastDelivery.wicket.playerId === lastDelivery.strikerId
      ? lastDelivery.nonStrikerId
      : lastDelivery.strikerId)
    : undefined;
  const wicketBatterOptions = battingXI.filter((player) => (
    !dismissedIds.has(player.id)
    && player.id !== wicketSurvivorId
  ));
  const activeBowlingOptions = bowlingXI.filter(isBowler);
  const bowlingOptions = getPlayableBowlingOptions(bowlingXI);
  const ratedBowlingOptions = [...activeBowlingOptions].sort((left, right) => (
    right.currentBowling - left.currentBowling
    || left.name.localeCompare(right.name)
  ));
  const partnershipStart = visible.findLastIndex((delivery) => Boolean(delivery.wicket));
  const partnershipRuns = visible.slice(partnershipStart + 1).reduce((total, delivery) => total + delivery.totalRuns, 0);
  const displayedBowlerOverNumber = nextDelivery?.overNumber ?? lastDelivery?.overNumber ?? 1;
  const currentOver = visible.filter((delivery) => (
    delivery.overNumber === displayedBowlerOverNumber
    && delivery.bowlerId === bowler?.id
  ));
  const currentOverLegalBalls = currentOver.filter((delivery) => delivery.isLegal).length;
  const bowlerDeliverySlots: Array<MatchDelivery | null> = [
    ...currentOver,
    ...Array.from({ length: Math.max(0, 6 - currentOverLegalBalls) }, () => null),
  ];
  const bowlerSelectionOver = nextDelivery
    ? nextDelivery.overNumber + (nextDelivery.deliveryInOver === 1 ? 0 : 1)
    : null;
  const bowlerSelectionKey = bowlerSelectionOver === null
    ? null
    : `${inningsNumber}-${bowlerSelectionOver}`;
  const bowlerBeforeSelectionId = nextDelivery?.deliveryInOver === 1
    ? (lastDelivery?.inningsNumber === inningsNumber ? lastDelivery.bowlerId : undefined)
    : nextDelivery?.bowlerId;
  const inningsOverLimit = inningsNumber === 1
    ? progress.simulation?.conditions.weather.firstInningsOvers ?? 20
    : progress.simulation?.conditions.weather.secondInningsOvers ?? 20;
  const maxBowlerBalls = Math.ceil(inningsOverLimit / 5) * 6;
  const bowlerUnavailableReason = (player: Player) => {
    if (player.id === bowlerBeforeSelectionId) return "cannot bowl consecutive overs";
    if (bowlerFigures(visible, player.id).balls >= maxBowlerBalls) return "quota complete";
    return "";
  };
  const selectedNextOverBowler = bowlerSelectionKey
    ? session.decisions.bowlerByOver[bowlerSelectionKey]
    : undefined;
  const automaticBowlerProgress = useMemo(() => {
    if (!bowlerSelectionKey || !selectedNextOverBowler) return progress;
    const automaticDecisions = cloneDecisions(session.decisions);
    delete automaticDecisions.bowlerByOver[bowlerSelectionKey];
    return simulatePlayableMatch(input, userTeamId, automaticDecisions, session.revealedDeliveries);
  }, [bowlerSelectionKey, input, progress, selectedNextOverBowler, session.decisions, session.revealedDeliveries, userTeamId]);
  const automaticBowlerLabel = automaticBowlerProgress.nextOverBowler?.bowlerName ?? "Smart selection";
  const automaticBatterProgress = useMemo(() => {
    if (!wicketBatterDecisionKey) return progress;
    const automaticDecisions = cloneDecisions(session.decisions);
    delete automaticDecisions.batterByWicket[wicketBatterDecisionKey];
    return simulatePlayableMatch(input, userTeamId, automaticDecisions, session.revealedDeliveries);
  }, [input, progress, session.decisions, session.revealedDeliveries, userTeamId, wicketBatterDecisionKey]);
  const automaticBatterId = wicketSurvivorId
    ? [automaticBatterProgress.nextDelivery?.strikerId, automaticBatterProgress.nextDelivery?.nonStrikerId]
      .find((playerId) => Boolean(playerId && playerId !== wicketSurvivorId))
    : undefined;
  const automaticBatterLabel = automaticBatterId
    ? input.players[automaticBatterId]?.name ?? "Smart selection"
    : "Smart selection";
  const isPowerplay = (currentInnings?.legalBalls ?? 0) < 36;
  const maxOutside = isPowerplay ? 2 : 5;
  const outsideCount = fieldPositions.filter(isOutsideThirtyYardCircle).length;
  const legBehind = fieldPositions.filter(isLegSideBehindSquare).length;
  const renderedLhb = striker?.battingStyle === "Left-hand";
  const target = currentInnings?.target;
  const maxBalls = (progress.simulation?.conditions.weather.secondInningsOvers ?? 20) * 6;
  const ballsRemaining = Math.max(0, maxBalls - (currentInnings?.legalBalls ?? 0));
  const runsNeeded = target ? Math.max(0, target - (currentInnings?.runs ?? 0)) : 0;
  const currentRunRate = currentInnings?.legalBalls ? ((currentInnings.runs * 6) / currentInnings.legalBalls).toFixed(2) : "0.00";
  const requiredRunRate = target && ballsRemaining ? ((runsNeeded * 6) / ballsRemaining).toFixed(2) : "0.00";

  const updateDecisions = (
    decisions: PlayableMatchDecisions,
    revealedDeliveries = sessionRef.current.revealedDeliveries,
  ) => {
    const nextSession = { ...sessionRef.current, decisions, revealedDeliveries };
    sessionRef.current = nextSession;
    onSessionChange(nextSession);
  };
  const setNextBatterDecision = (decisionKey: string, playerId: string) => {
    const decisions = cloneDecisions(sessionRef.current.decisions);
    if (playerId) decisions.batterByWicket[decisionKey] = playerId;
    else delete decisions.batterByWicket[decisionKey];
    updateDecisions(decisions);
  };
  const confirmWicketBatter = () => {
    if (!wicketBatterDecisionKey) return;
    const decisions = cloneDecisions(sessionRef.current.decisions);
    decisions.resolvedBatterWickets = {
      ...(decisions.resolvedBatterWickets ?? {}),
      [wicketBatterDecisionKey]: true,
    };
    updateDecisions(decisions);
  };
  const decisionsWithControl = () => {
    const decisions = cloneDecisions(sessionRef.current.decisions);
    const candidate = simulatePlayableMatch(
      input,
      userTeamId,
      decisions,
      sessionRef.current.revealedDeliveries,
    ).nextDelivery;
    if (candidate) decisions.deliveryControls[candidate.id] = userIsBatting
      ? {
        battingApproach: batterApproaches[candidate.strikerId] ?? battingApproach,
        shotZone: batterShotZones[candidate.strikerId] ?? "all-ground",
        fieldPositions: fieldPositions.map((position) => ({ ...position })),
      }
      : { fieldPlan, bowlingPlan, fieldPositions: fieldPositions.map((position) => ({ ...position })) };
    return decisions;
  };
  const completeAnimatedDelivery = (deliveryDecisions: PlayableMatchDecisions) => {
    const latestDecisions = cloneDecisions(sessionRef.current.decisions);
    latestDecisions.deliveryControls = {
      ...latestDecisions.deliveryControls,
      ...deliveryDecisions.deliveryControls,
    };
    updateDecisions(latestDecisions, sessionRef.current.revealedDeliveries + 1);
    setActiveShot(null);
  };
  const skip = (kind: PlayableSkipKind) => {
    if (activeShot || awaitingBatterSelection || progress.awaitingTossDecision || progress.awaitingImpactDecision || progress.complete) return;
    const decisions = cloneDecisions(sessionRef.current.decisions);
    let revealedDeliveries = sessionRef.current.revealedDeliveries;
    const startingInningsNumber = progress.nextDelivery?.inningsNumber ?? currentInnings?.inningsNumber;
    if (!startingInningsNumber) return;

    const startingLegalBalls = currentInnings?.legalBalls ?? 0;
    const targetLegalBalls = kind === "over"
      ? Math.floor(startingLegalBalls / 6) * 6 + 6
      : kind === "five-overs"
        ? startingLegalBalls + 30
        : undefined;

    // Rebuild each skipped delivery with the selected control attached. This
    // keeps per-batter aggression and bowling plans active through an entire
    // skipped over/innings, including after wickets and changes of strike.
    for (let step = 0; step < 300; step += 1) {
      const current = simulatePlayableMatch(input, userTeamId, decisions, revealedDeliveries);
      if (current.awaitingTossDecision || current.awaitingImpactDecision || current.complete) break;

      const innings = current.innings.find((entry) => entry.inningsNumber === startingInningsNumber);
      if (!innings || innings.complete) break;
      if (targetLegalBalls !== undefined && innings.legalBalls >= targetLegalBalls) break;

      const candidate = current.nextDelivery;
      if (!candidate || candidate.inningsNumber !== startingInningsNumber) break;
      decisions.deliveryControls[candidate.id] = innings.battingTeamId === userTeamId
        ? {
          battingApproach: batterApproaches[candidate.strikerId] ?? battingApproach,
          shotZone: batterShotZones[candidate.strikerId] ?? "all-ground",
          fieldPositions: fieldPositions.map((position) => ({ ...position })),
        }
        : { fieldPlan, bowlingPlan, fieldPositions: fieldPositions.map((position) => ({ ...position })) };
      revealedDeliveries += 1;
      if (candidate.wicket && innings.battingTeamId === userTeamId) break;
      if (kind === "ball") break;
    }

    updateDecisions(decisions, revealedDeliveries);
  };
  const later = (callback: () => void, delay: number) => {
    const id = window.setTimeout(callback, Math.max(35, Math.round(delay / speed)));
    timeouts.current.push(id);
  };
  const playNextDelivery = () => {
    if (activeShot || awaitingBatterSelection || progress.awaitingTossDecision || progress.awaitingImpactDecision || progress.complete) return;
    const decisions = decisionsWithControl();
    const controlled = simulatePlayableMatch(
      input,
      userTeamId,
      decisions,
      sessionRef.current.revealedDeliveries,
    );
    const delivery = controlled.nextDelivery;
    if (!delivery) return;
    const isFour = delivery.runsOffBat === 4;
    const isSix = delivery.runsOffBat === 6;
    const boundary = isFour || isSix;
    const bowled = delivery.wicket?.kind === "bowled";
    const logicalTarget = delivery.shotTarget
      ?? FALLBACK_SHOT_TARGETS[hash(delivery.id) % FALLBACK_SHOT_TARGETS.length];
    const targetX = logicalTarget.x - 50;
    const targetY = logicalTarget.y - 50;
    const targetMagnitude = Math.max(1, Math.hypot(targetX, targetY));
    const boundaryRadius = isSix ? 62 : 48.5;
    const travelScale = delivery.shotType === "skier"
      ? 0.76
      : delivery.shotType === "lofted"
        ? 0.72
        : delivery.runsOffBat >= 2
          ? 0.86
          : delivery.runsOffBat === 1
            ? 0.58
            : 0.4;
    const logicalHitX = boundary
      ? 50 + targetX / targetMagnitude * boundaryRadius
      : 50 + targetX * travelScale;
    const logicalHitY = boundary
      ? 50 + targetY / targetMagnitude * boundaryRadius
      : 50 + targetY * travelScale;
    const deliveryIsLeftHanded = input.players[delivery.strikerId]?.battingStyle === "Left-hand";
    // Fielders and the shot destination must use the same rendered coordinate
    // system. Previously only the field was mirrored for an LHB, so a player
    // appeared to run in from the opposite side of the ground.
    let hitX = bowled ? 50 : deliveryIsLeftHanded ? 100 - logicalHitX : logicalHitX;
    let hitY = bowled ? 59 : logicalHitY;
    const outfielderEvent = Boolean(
      delivery.fieldingEvent
      && !["keeping-error", "missed-stumping"].includes(delivery.fieldingEvent.kind)
    );
    const outfielderWicket = delivery.wicket?.kind === "caught" || delivery.wicket?.kind === "run-out";
    const isFieldedDotBall = delivery.resultCode === "0" && !delivery.wicket;
    const fielderCollects = Boolean(!bowled && !boundary && (
      delivery.runsOffBat > 0
      || isFieldedDotBall
      || outfielderEvent
      || outfielderWicket
    ));

    if (fielderCollects && delivery.runsOffBat >= 2 && delivery.runsOffBat < 4) {
      const deepFielders = fieldPositions
        .map((position, index) => ({
          index,
          x: deliveryIsLeftHanded ? 100 - position.x : position.x,
          y: position.y,
        }))
        .filter(({ index }) => isOutsideThirtyYardCircle(fieldPositions[index]));
      const nearestDeep = deepFielders.reduce<{ index: number; x: number; y: number; distance: number } | null>((closest, candidate) => {
        const distance = Math.hypot(candidate.x - hitX, candidate.y - hitY);
        return !closest || distance < closest.distance ? { ...candidate, distance } : closest;
      }, null);
      if (nearestDeep) {
        const outwardX = nearestDeep.x - 50;
        const outwardY = nearestDeep.y - 50;
        const magnitude = Math.max(1, Math.hypot(outwardX, outwardY));
        hitX = Math.max(7, Math.min(93, nearestDeep.x + outwardX / magnitude * 6));
        hitY = Math.max(7, Math.min(93, nearestDeep.y + outwardY / magnitude * 6));
      }
    }

    // Measure every rendered fielder after the LHB/RHB transform. Candidate
    // restrictions must never make a visibly farther player collect the ball.
    const closestFielderIdx = fielderCollects ? fieldPositions.map((_, index) => index).reduce((closest, index) => {
      const position = fieldPositions[index];
      const renderedX = deliveryIsLeftHanded ? 100 - position.x : position.x;
      const distance = Math.hypot(renderedX - hitX, position.y - hitY);
      if (closest.index < 0 || distance < closest.distance) return { index, distance };
      return closest;
    }, { index: -1, distance: Number.POSITIVE_INFINITY }).index : -1;
    const runningDuration = delivery.runsOffBat === 3 ? 9400 : delivery.runsOffBat === 2 ? 6200 : delivery.runsOffBat === 1 ? 3050 : 0;
    const shot: ActiveShot = { delivery, phase: "runup", fielderCollects, batRuns: Math.min(3, delivery.runsOffBat), ballX: 48.5, ballY: 42, ballHitX: hitX, ballHitY: hitY, bowlerX: 48.5, closestFielderIdx, receiverX: 50, receiverY: 61.2, releaseDelay: 680, deliveryDuration: 360, runningDuration, shotDuration: isSix ? 2600 : delivery.shotType === "skier" ? 1800 : isFour ? 1350 : Math.max(800, runningDuration * .68), throwDuration: 700 };
    setActiveShot(shot);
    later(() => setActiveShot((current) => current ? { ...current, phase: "delivery", ballX: 50, ballY: 58 } : current), 680);
    if (bowled) {
      later(() => setActiveShot((current) => current ? { ...current, phase: "bowled", ballX: 50, ballY: 61 } : current), 1040);
      later(() => completeAnimatedDelivery(decisions), 1540);
      return;
    }
    later(() => setActiveShot((current) => current ? { ...current, phase: "shot", ballX: hitX, ballY: hitY } : current), 1040);
    later(() => setActiveShot((current) => current ? { ...current, phase: "fielded" } : current), 1040 + shot.shotDuration);
    const needsThrow = fielderCollects && !boundary && (delivery.totalRuns > 0 || delivery.fieldingEvent || delivery.wicket?.kind === "run-out");
    if (needsThrow) later(() => setActiveShot((current) => current ? { ...current, phase: "throw", ballX: 50, ballY: 61.2 } : current), 1160 + shot.shotDuration);
    const finishAt = 1260 + shot.shotDuration + (needsThrow ? shot.throwDuration : 0);
    later(() => completeAnimatedDelivery(decisions), finishAt);
  };

  useEffect(() => () => timeouts.current.forEach(window.clearTimeout), []);
  useEffect(() => {
    if (!isPlaying || activeShot || awaitingBatterSelection || progress.complete || progress.awaitingTossDecision || progress.awaitingImpactDecision) return;
    const id = window.setTimeout(playNextDelivery, 180 / speed);
    return () => window.clearTimeout(id);
  });
  useEffect(() => {
    if (!awaitingBatterSelection) return;
    setIsPlaying(false);
    setShowScoreboard(false);
  }, [awaitingBatterSelection]);
  useEffect(() => { if (progress.complete && progress.simulation) { setIsPlaying(false); onComplete(progress.simulation); } }, [onComplete, progress.complete, progress.simulation]);
  useEffect(() => {
    if (!FIELD_PRESETS[activePreset]) return;
    setFieldPositions(fieldPresetPositions(activePreset, isPowerplay).map((position) => ({ ...position })));
  }, [activePreset, isPowerplay]);

  const applyPreset = (name: string) => {
    setActivePreset(name);
    setFieldPositions(fieldPresetPositions(name, isPowerplay).map((position) => ({ ...position })));
    setFieldPlan(name === "Attacking" ? "hunt-wickets" : name === "Defensive" ? "protect" : "balanced");
  };
  const moveFielder = (index: number, event: ReactPointerEvent) => {
    if (draggingIndex !== index || !stadiumRef.current || activeRole !== "bowling") return;
    const rect = stadiumRef.current.getBoundingClientRect();
    const renderedX = ((event.clientX - rect.left) / rect.width) * 100;
    const renderedY = ((event.clientY - rect.top) / rect.height) * 100;
    const logicalX = renderedLhb ? 100 - renderedX : renderedX;
    const constrained = clampInsideBoundary(logicalX, renderedY);
    const x = Number(constrained.x.toFixed(1));
    const y = Number(constrained.y.toFixed(1));
    setFieldPositions((positions) => positions.map((position, current) => (
      current === index ? { ...position, x, y, label: fieldPositionLabel(x, y) } : position
    )));
    setActivePreset("Custom");
  };
  const setImpact = (choice: PlayableImpactChoice) => {
    const decisions = cloneDecisions(sessionRef.current.decisions);
    decisions.impactByTeam = {
      ...(decisions.impactByTeam ?? {}),
      [userTeamId]: {
        ...choice,
        activationInningsNumber: currentInnings?.inningsNumber ?? nextDelivery?.inningsNumber ?? 1,
        activationDeliverySequence: visible.length,
      },
    };
    setShowImpact(false); updateDecisions(decisions);
  };
  const openImpactSelection = () => {
    setImpactIncoming(progress.impactRecommendation?.incomingPlayerId ?? "");
    setImpactOutgoing(progress.impactRecommendation?.outgoingPlayerId ?? "");
    setShowImpact(true);
  };
  const impactPlan = planFor(userTeamId);
  const impactIncomingOptions = impactPlan.impactSubs.map((id) => input.players[id]).filter((player): player is Player => Boolean(player));
  const impactOutgoingOptions = impactPlan.startingXI
    .map((id) => input.players[id])
    .filter((player): player is Player => Boolean(
      player
      && (userIsBatting
        ? player.id !== striker?.id && player.id !== nonStriker?.id
        : player.id !== bowler?.id)
    ));
  const fieldDelivery = activeShot?.delivery ?? lastDelivery;
  const keeperReceiving = Boolean(activeShot && activeShot.fielderCollects && activeShot.phase !== "bowled" && ["shot", "fielded", "throw", "received"].includes(activeShot.phase) && activeShot.delivery.runsOffBat < 4 && (activeShot.delivery.totalRuns > 0 || activeShot.delivery.fieldingEvent));
  const runnersActive = Boolean(activeShot && ["shot", "fielded", "throw"].includes(activeShot.phase));
  const inningsDeliveries = [...visible].reverse();
  const occupiedFieldZones = new Set(fieldPositions.map((position) => position.label));

  return (
    <main className={styles.shell} style={{ "--bat": battingTeam.primaryColor, "--bat-secondary": battingTeam.secondaryColor, "--bowl": bowlingTeam.primaryColor, "--bowl-secondary": bowlingTeam.secondaryColor } as CSSProperties}>
      <header className={styles.topbar}>
        <div className="flex items-center gap-4">
          <div className={styles.brand}><span className={styles.liveDot}/><span className="font-space-mono text-xs font-bold tracking-widest text-yellow-500">MATCH CENTRE</span></div>
          <div className="flex flex-col gap-0.5 rounded-md border border-white/15 bg-[#111622] px-3 py-1 font-space-mono text-[9.5px] leading-tight text-slate-300">
            <span>🏟️ {input.conditions.stadiumName} · 📅 {input.date ?? "Matchday"} ({input.time ?? "TBD"})</span>
            <span className="text-slate-400">🌱 {input.conditions.pitch.name} · Expected {input.conditions.adjustedExpectedScore.min}–{input.conditions.adjustedExpectedScore.max} · 🌧️ {progress.simulation?.conditions.weather.kind ?? "Live conditions"}</span>
          </div>
          <div className={styles.headerActions}>
            <button onClick={openImpactSelection} disabled={Boolean(activeShot) || progress.awaitingTossDecision || progress.complete || Boolean(impactChoice)}><UserPlus size={15}/><span>{impactChoice ? impactChoice.use ? "Impact Sub Used" : "Impact Declined" : "Make Impact Sub"}</span></button>
            <button onClick={() => setShowScoreboard(true)}><Activity size={15}/><span>Scorecard</span></button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-[34px] items-center overflow-hidden rounded border border-white/20 bg-[#111622] font-space-mono text-[8px] font-bold uppercase">
            <button onClick={() => skip("ball")} disabled={Boolean(activeShot) || awaitingBatterSelection} className="h-full border-r border-white/15 px-2.5 hover:bg-white/10 disabled:opacity-30">Skip ball</button>
            <button onClick={() => skip("over")} disabled={Boolean(activeShot) || awaitingBatterSelection} className="h-full border-r border-white/15 px-2.5 hover:bg-white/10 disabled:opacity-30">Skip over</button>
            <button onClick={() => skip("five-overs")} disabled={Boolean(activeShot) || awaitingBatterSelection} className="h-full border-r border-white/15 px-2.5 hover:bg-white/10 disabled:opacity-30">Skip 5 overs</button>
            <button onClick={() => skip("innings")} disabled={Boolean(activeShot) || awaitingBatterSelection} className="h-full px-2.5 hover:bg-white/10 disabled:opacity-30">Finish innings</button>
          </div>
          <div className="flex h-[34px] items-center overflow-hidden rounded border border-white/20 bg-[#111622]">
            <button disabled={speed === 1} onClick={() => setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(speed) - 1)])} className="h-full w-8 text-[10px] font-bold disabled:opacity-30">&lt;&lt;</button>
            <span className="flex h-full min-w-[38px] items-center justify-center border-x border-white/15 font-space-mono text-[11px] font-bold">{speed}x</span>
            <button disabled={speed === 8} onClick={() => setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(speed) + 1)])} className="h-full w-8 text-[10px] font-bold disabled:opacity-30">&gt;&gt;</button>
          </div>
          <button onClick={playNextDelivery} disabled={Boolean(activeShot) || isPlaying || awaitingBatterSelection} className="flex h-[34px] w-[34px] items-center justify-center rounded border border-white/20 bg-[#111622] disabled:opacity-30" title="Next ball"><SkipForward size={14}/></button>
          <button onClick={() => setIsPlaying((value) => !value)} disabled={awaitingBatterSelection} className={`flex h-[34px] shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded border border-white/20 px-4 font-space-mono text-[11px] font-bold leading-none uppercase disabled:opacity-30 ${isPlaying ? "bg-[#ed4c47]" : "bg-[#111622]"}`}>{isPlaying ? <><Pause className="shrink-0" size={13}/>Pause</> : <><Play className="shrink-0" size={13}/>Play match</>}</button>
        </div>
      </header>

      <section className={styles.workspace}>
        <aside className={styles.leftRail}>
          {activeRole === "batting" ? <>
            <section className={styles.panel}>
              <div className={styles.panelHeading}><span><Target size={14}/> Innings Control</span><b>BATTING</b></div>
              <label className={styles.controlLabel}>Batting Intent</label>
              <div className={styles.segmented}>{(["survive","balanced","attack","six-hitting"] as PlayableBattingApproach[]).map((option) => <button key={option} onClick={() => setBattingApproach(option)} className={battingApproach === option ? styles.selected : ""}>{option === "six-hitting" ? "All out" : option}</button>)}</div>
              <label className={styles.controlLabel}>Target Shot Zones</label>
              <div className="flex flex-col gap-1.5">{creaseCards.map(({ player, strike }) => {
                const selectedZone = batterShotZones[player.id] ?? "all-ground";
                return <div key={player.id} className="rounded border border-white/10 bg-black/20 p-1"><div className="mb-1 flex items-center justify-between px-0.5 text-[8px] font-bold uppercase tracking-wide text-white/50"><span className="max-w-[120px] truncate">{surname(player.name)}</span><span>{strike ? "On strike" : "Next strike"}</span></div><div className={styles.segmented}>{SHOT_ZONE_OPTIONS.map((option) => <button key={option.value} title={option.value === "all-ground" ? "360° All Ground" : `${option.label} target`} onClick={() => setBatterShotZones((current) => ({ ...current, [player.id]: option.value }))} className={selectedZone === option.value ? styles.selected : ""}>{option.label}</button>)}</div></div>;
              })}</div>
              <div className={styles.riskReadout}><span><Zap size={14}/> Boundary intent</span><b>{battingApproach === "six-hitting" ? "Very high" : battingApproach === "attack" ? "High" : battingApproach === "survive" ? "Low" : "Normal"}</b></div>
              <div className={styles.riskReadout}><span><Shield size={14}/> Wicket risk</span><b>{battingApproach === "six-hitting" ? "+70%" : battingApproach === "attack" ? "+28%" : battingApproach === "survive" ? "−38%" : "Baseline"}</b></div>
              {upcomingBatterDecisionKey && remainingBatters.length > 0 && <><label className={styles.selectLabel}>Next batter if a wicket falls <ChevronDown size={13}/></label><select value={session.decisions.batterByWicket[upcomingBatterDecisionKey] ?? ""} onChange={(event)=>setNextBatterDecision(upcomingBatterDecisionKey,event.target.value)}><option value="">Automatic: {remainingBatters[0]?.name ?? "Smart selection"}</option>{remainingBatters.map((player)=><option key={player.id} value={player.id}>{player.name}</option>)}</select></>}
            </section>
            <section className={`${styles.panel} ${styles.batterPanel}`}><div className={styles.panelHeading}><span><Users size={14}/> At the Crease</span></div>{creaseCards.map(({player,line,strike}) => player && <div className="border-b border-white/10 py-1" key={player.id}><div className={styles.playerCard}><span className={styles.avatar}>{player.name.split(" ").map((part: string)=>part[0]).slice(0,2).join("")}</span><div className={styles.playerName}><strong>{player.name}</strong><small>{strike ? "ON STRIKE" : "NON-STRIKER"}</small></div><div className={styles.playerScore}><b>{line.runs}</b><small>{line.balls} balls · {line.fours}x4 {line.sixes}x6</small></div></div><div className="mt-1 grid grid-cols-5 gap-1 rounded border border-white/10 bg-black/40 p-1">{(["survive","anchor","balanced","attack","six-hitting"] as PlayableBattingApproach[]).map((stage)=><button key={stage} onClick={()=>setBatterApproaches((current)=>({...current,[player.id]:stage}))} className={`truncate rounded py-1 text-[7.5px] font-extrabold ${((batterApproaches[player.id]??battingApproach)===stage)?"bg-lime-400 text-black":"text-white/50 hover:bg-white/10"}`}>{stage==="six-hitting"?"6s":stage}</button>)}</div></div>)}<div className={styles.partnership}><span>Current partnership</span><strong>{partnershipRuns}<small> runs</small></strong></div></section>
          </> : <>
            <section className={styles.panel}>
              <div className={styles.panelHeading}><span><Gauge size={14}/> Bowling Control</span><b>BOWLING</b></div>
              <div className={styles.bowlerCard}><span className={styles.avatar}>{bowler?.name.split(" ").map((part: string)=>part[0]).slice(0,2).join("")}</span><div><small>CURRENT BOWLER</small><strong>{bowler?.name}</strong><span>{overs(activeBowlerLine.balls)} ov · {activeBowlerLine.runs} runs · {activeBowlerLine.wickets} wkts</span></div></div>
              <><label className={styles.selectLabel}><span>Choose Next Over Bowler{bowlerSelectionOver !== null ? ` · Over ${bowlerSelectionOver}` : ""}</span><ChevronDown size={13}/></label><select disabled={!bowlerSelectionKey} value={bowlerSelectionKey ? session.decisions.bowlerByOver[bowlerSelectionKey] ?? "" : ""} onChange={(event)=>{if(!bowlerSelectionKey)return;const decisions=cloneDecisions(sessionRef.current.decisions);if(event.target.value)decisions.bowlerByOver[bowlerSelectionKey]=event.target.value;else delete decisions.bowlerByOver[bowlerSelectionKey];updateDecisions(decisions);}}><option value="">Automatic: {automaticBowlerLabel}</option>{bowlingOptions.map((player)=>{const unavailableReason=bowlerUnavailableReason(player);return <option key={player.id} value={player.id} disabled={Boolean(unavailableReason)}>{player.name}{unavailableReason?` — ${unavailableReason}`:""}</option>})}</select></>
              <label className={styles.controlLabel}>Field Mentality</label><div className={styles.fieldButtons}>{(["protect","balanced","hunt-wickets"] as PlayableFieldPlan[]).map((plan)=><button key={plan} onClick={()=>setFieldPlan(plan)} className={fieldPlan===plan?styles.selected:""}>{plan}</button>)}</div>
              <label className={styles.controlLabel}>Delivery Line & Length</label><div className={styles.segmented}>{(["good-length","yorker-attack","bouncer-pace","spin-choke"] as PlayableBowlingPlan[]).map((plan)=><button key={plan} onClick={()=>setBowlingPlan(plan)} className={bowlingPlan===plan?styles.selected:""}>{plan}</button>)}</div>
            </section>
            <section className={styles.panel}><div className={styles.panelHeading}><span><Users size={14}/> Active Bowler Spells</span></div><div className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto">{ratedBowlingOptions.map((player)=>{const line=bowlerFigures(visible,player.id);return <div key={player.id} className={`flex items-center justify-between rounded border px-2 py-1.5 ${player.id===bowler?.id?"border-yellow-400 bg-white/10":"border-white/10 bg-black/20"}`}><span className="text-[10.5px] font-bold">{player.name}</span><span className="font-mono text-[10.5px] font-bold">{line.wickets}-{line.runs} ({overs(line.balls)})</span></div>})}</div></section>
          </>}
        </aside>

        <section className={styles.centreStage}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1"><div className="flex items-center gap-1.5"><span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-white/50">{activeRole==="bowling"?"Field Presets:":"Opponent Field:"}</span>{activeRole==="bowling"?Object.keys(FIELD_PRESETS).map((name)=><button key={name} onClick={()=>applyPreset(name)} className={`rounded px-2.5 py-1 text-[10px] font-bold ${activePreset===name?"bg-amber-400 text-black":"bg-white/10"}`}>{name}</button>):<span className="rounded border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">{bowlingTeam.name} Field Alignment (Read Only)</span>}<button onClick={()=>setShowZoneOverlay((value)=>!value)} className="rounded bg-white/10 px-2 py-1 text-[10px] font-bold">Zone Map: {showZoneOverlay?"ON":"OFF"}</button></div><div className="flex gap-2"><span className={styles.fieldingRuleBadge}>{isPowerplay?"⚡ Powerplay":"🛡️ Overs 7-20"}<span className={outsideCount>maxOutside?"text-red-400":"text-emerald-400"}>{outsideCount}/{maxOutside} Deep</span></span><span className={styles.fieldingRuleBadge}>Leg Behind Sq: <span className={legBehind>2?"text-red-400":"text-emerald-400"}>{legBehind}/2</span></span></div></div>
          {(outsideCount>maxOutside||legBehind>2)&&activeRole==="bowling"&&<div className={styles.fieldingWarningBanner}>⚠️ ILLEGAL FIELD — adjust the highlighted field restriction before the next delivery.</div>}
          <div className={styles.stadium}><div className={styles.crowd}/><div ref={stadiumRef} className={styles.field}><div className={styles.mownStripes}/><div className={styles.innerCircle}/>{showZoneOverlay&&<div className={styles.zoneOverlay}>{FIELD_ZONE_ANCHORS.map((zone)=><div key={zone.label} className={`${styles.zoneBox} ${occupiedFieldZones.has(zone.label)?styles.activeZoneBox:""}`} style={{left:`${renderedLhb?100-zone.x:zone.x}%`,top:`${zone.y}%`}}>{zone.label}</div>)}</div>}<div className={styles.pitch}><i className={styles.creaseTop}/><i className={styles.creaseBottom}/><span className={styles.stumpsTop}/><span className={styles.stumpsBottom}/></div>
            {activeShot&&<div className={`${styles.shotBall} ${activeShot.phase==="shot"&&activeShot.delivery.runsOffBat===6?styles.careerSixBall:activeShot.phase==="shot"&&activeShot.delivery.shotType==="skier"?styles.skierBall:""}`} style={{left:`${activeShot.ballX}%`,top:`${activeShot.ballY}%`,opacity:activeShot.phase==="runup"?0:1,transitionDuration:`${(activeShot.phase==="delivery"?activeShot.deliveryDuration:activeShot.phase==="shot"?activeShot.shotDuration:activeShot.phase==="throw"?activeShot.throwDuration:100)/speed}ms`,"--six-flight-duration":`${activeShot.shotDuration/speed}ms`,"--skier-flight-duration":`${activeShot.shotDuration/speed}ms`} as CSSProperties}/>}
            <div className={`${styles.fielder} ${styles.activeFielder} ${activeShot?.phase==="runup"?styles.pacerRunup:""}`} style={{left:`${activeShot?.bowlerX??48.5}%`,top:"40.1%","--runup-duration":`${(activeShot?.releaseDelay??680)/speed}ms`,"--bowler-x":`${activeShot?.bowlerX??48.5}%`} as CSSProperties}><span>B</span><small>{surname(bowler?.name)}</small></div>
            <div className={`${styles.batterMarker} ${runnersActive&&activeShot?.batRuns?styles[`runnerNonStriker${activeShot.batRuns}`]:""}`} style={{left:"51.8%",top:"40.5%","--running-duration":`${(activeShot?.runningDuration??3050)/speed}ms`} as CSSProperties}><span style={{color:battingTeam.primaryColor}}>▲</span><b>{surname(nonStriker?.name)}</b></div>
            <div className={`${styles.batterMarker} ${runnersActive&&activeShot?.batRuns?styles[`runnerStriker${activeShot.batRuns}`]:""}`} style={{left:"50%",top:"59%","--running-duration":`${(activeShot?.runningDuration??3050)/speed}ms`} as CSSProperties}><span style={{color:battingTeam.primaryColor}}>▲</span><b>{surname(striker?.name)} <small>{renderedLhb?"LHB":"RHB"}</small></b></div>
            <div className={`${styles.fielder} ${keeperReceiving?styles.receivingFielder:""}`} style={{left:"50%",top:`${keeperReceiving?61.2:73}%`,"--receiver-duration":`${Math.max(250,(activeShot?.shotDuration??700)/speed)}ms`} as CSSProperties}><span>WK</span><b>KEEPER</b><small>{surname(keeper?.name)}</small></div>
            {fieldPositions.map((position,index)=>{const gathering=Boolean(activeShot&&activeShot.fielderCollects&&activeShot.phase!=="bowled"&&["shot","fielded","throw","received"].includes(activeShot.phase)&&activeShot.closestFielderIdx===index);const x=gathering?activeShot!.ballHitX:(renderedLhb?100-position.x:position.x);const y=gathering?activeShot!.ballHitY:position.y;const offending=(outsideCount>maxOutside&&isOutsideThirtyYardCircle(position))||(legBehind>2&&isLegSideBehindSquare(position));return <div key={position.id} className={`${styles.fielder} ${activeRole==="bowling"&&!activeShot?styles.draggableFielder:""} ${gathering?styles.gatheringFielder:""} ${offending?styles.isOffendingFielder:""}`} style={{left:`${x}%`,top:`${y}%`,"--fielding-duration":`${Math.max(300,(activeShot?.shotDuration??700)/speed)}ms`} as CSSProperties} onPointerDown={activeRole==="bowling"&&!activeShot?(event)=>{event.currentTarget.setPointerCapture(event.pointerId);setDraggingIndex(index)}:undefined} onPointerMove={(event)=>moveFielder(index,event)} onPointerUp={()=>setDraggingIndex(null)} onPointerCancel={()=>setDraggingIndex(null)}><span>{index+1}</span><b>{position.label}</b><small>{surname(outfielders[index]?.name)}</small></div>})}
            {activeShot&&["shot","fielded"].includes(activeShot.phase)&&[4,6].includes(activeShot.delivery.runsOffBat)&&<div className={`${styles.boundaryFlash} ${activeShot.delivery.runsOffBat===6?styles.sixFlash:styles.fourFlash}`}><strong>{activeShot.delivery.runsOffBat===6?"SIX":"FOUR"}</strong><span>{activeShot.delivery.runsOffBat===6?"OUT OF THE GROUND":"TO THE BOUNDARY"}</span></div>}
            {activeShot&&fieldDelivery?.wicket&&["bowled","shot","fielded"].includes(activeShot.phase)&&<div className={styles.wicketBurst}/>}</div><div className={styles.fieldCaption}><span className={fieldDelivery?.wicket?styles.wicketTag:""}>{fieldDelivery?.resultCode??"READY"}</span><p>{fieldDelivery?.commentary??`${bowler?.name} has the ball. Set your approach and start the match.`}</p></div></div>
          <div className={styles.lowerTelemetry}>{target?<><div><small>Chase Equation</small><strong>{battingTeam.shortName} need {runsNeeded} in {ballsRemaining}b</strong><span><i style={{width:`${Math.min(100,((currentInnings?.runs??0)/target)*100)}%`,background:battingTeam.primaryColor}}/></span></div><div><small>Required Rate</small><strong>RRR {requiredRunRate}</strong></div><div><small>Target Score</small><strong>{target} runs</strong><span>CRR {currentRunRate}</span></div></>:<><div><small>Current rate</small><strong>{battingTeam.shortName} {currentRunRate}</strong><span><i style={{width:`${Math.min(100,Number(currentRunRate)*7)}%`,background:battingTeam.primaryColor}}/></span></div><div><small>Momentum</small><strong>{lastDelivery?.wicket?bowlingTeam.shortName:(lastDelivery?.runsOffBat??0)>=4?battingTeam.shortName:"EVEN"}</strong></div><div><small>Last 12 balls</small><strong>{visible.slice(-12).reduce((sum,delivery)=>sum+delivery.totalRuns,0)} runs</strong><span>{visible.slice(-12).filter((delivery)=>delivery.wicket).length} wickets</span></div></>}</div>
        </section>

        <aside className={styles.rightRail}><section className={`${styles.panel} ${styles.feedPanel}`}><div className={styles.panelHeading}><span><Activity size={14}/> Live Match Feed</span><b>{visible.length}</b></div><div className={`${styles.feed} h-[312px] max-h-[312px] overflow-y-auto`}>{inningsDeliveries.length===0&&<div className={styles.emptyFeed}>The next ball will appear here.</div>}{inningsDeliveries.map((delivery,index)=><article key={delivery.id} className={`${styles.careerFeedRow} border-b border-white/10 ${delivery.wicket?"border-l-2 border-l-red-500 bg-red-500/10":index===0?"bg-white/5":""}`}><div className="w-[46px] shrink-0 border-r border-white/15 pr-2 text-center"><time className="text-[9px] text-white/50">{delivery.displayBall}</time><span className={`mt-1 block rounded px-1 text-[9.5px] font-black ${delivery.wicket?"bg-red-600":delivery.runsOffBat>=4?"bg-yellow-400 text-black":"bg-white/10"}`}>{delivery.resultCode}</span></div><p className={`${styles.careerFeedText} m-0 text-[10px] leading-normal text-white/90`}>{delivery.commentary}</p></article>)}</div></section><section className={styles.panel}><div className={styles.panelHeading}><span><Users size={14}/> {activeRole==="batting"?"Batting XI & Dugout":"Opponent Batters"}</span></div><div className="max-h-[235px] overflow-y-auto">{battingXI.map((player,index)=>{const line=batterFigures(visible,player.id);const crease=player.id===striker?.id||player.id===nonStriker?.id;return <div key={player.id} className={`flex items-center justify-between border-b border-white/10 px-1 py-1.5 text-[10px] ${line.out?"opacity-40":crease?"text-yellow-300":""}`}><span>{index+1}. {player.name}</span><span className="font-mono">{line.out?`${line.runs} OUT`:line.balls?`${line.runs}${crease?"*":""} (${line.balls})`:"Yet to bat"}</span></div>})}</div></section></aside>
      </section>

      <footer className="relative z-20 flex h-[72px] items-center justify-center overflow-hidden border-t border-white/15 bg-black font-[family-name:var(--font-bricolage)]" style={{background:`linear-gradient(90deg,${battingTeam.primaryColor} 0 45%,#040508 50%,${bowlingTeam.primaryColor} 55%)`}}><div className="flex h-full items-center"><div className="flex h-full items-center gap-5 px-5" style={{backgroundColor:battingTeam.primaryColor}}><div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-yellow-400 font-extrabold">{battingTeam.shortName}</div><div><strong className="text-xl">{battingTeam.shortName}</strong><small className="block">v {bowlingTeam.shortName}</small></div><strong className="text-2xl" style={{color:battingTeam.secondaryColor}}>{currentInnings?.runs??0}-{currentInnings?.wickets??0}</strong>{isPowerplay&&<b className="bg-yellow-400 px-1.5 text-black">PP</b>}<div className="flex min-w-[52px] flex-col items-center justify-center leading-none"><strong>{overs(currentInnings?.legalBalls??0)}</strong><small className="mt-1 whitespace-nowrap text-[8px] font-bold tracking-wide opacity-75">{matchHashtag}</small></div><div className="min-w-[230px] border-l border-white/40 pl-5">{creaseCards.slice(0,2).map(({player,line,strike})=><div key={player.id} className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-baseline text-lg font-black"><span className="text-center">{strike?">":""}</span><span className="truncate">{surname(player.name).toUpperCase()}</span><span>{line.runs} <small>{line.balls}</small></span></div>)}</div></div><div className="flex h-full min-w-[85px] flex-col items-center justify-center bg-[#040508] px-3"><small>{target?"RRR":"CRR"}</small><strong>{target?requiredRunRate:currentRunRate}</strong></div><div className="flex h-full items-center gap-4 px-5" style={{backgroundColor:bowlingTeam.primaryColor}}><div className="min-w-[250px] text-right"><div><b>{surname(bowler?.name).toUpperCase()}</b> {activeBowlerLine.wickets}-{activeBowlerLine.runs} ({overs(activeBowlerLine.balls)})</div><div className="mt-1 flex justify-end gap-1">{bowlerDeliverySlots.map((delivery,index)=><span key={delivery?.id??`blank-${index}`} className={`flex h-4 min-w-4 items-center justify-center border px-1 text-[9px] font-black ${!delivery?"border-white/35 bg-white/10 text-transparent":delivery.wicket?"border-red-600 bg-red-600":delivery.runsOffBat>=4?"border-yellow-400 bg-yellow-400 text-black":"border-white bg-white text-black"}`}>{delivery?.resultCode??"·"}</span>)}</div></div><div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-yellow-400 font-extrabold">{bowlingTeam.shortName}</div></div></div></footer>

      {progress.awaitingTossDecision&&<div className={styles.modalBackdrop}><section className={styles.setupModal}><div className={styles.modalHeader}><div><small>MATCH TOSS</small><h2>You won the toss</h2></div></div><p className="mb-4 text-sm text-white/65">{input.conditions.pitch.name} · expected score {input.conditions.adjustedExpectedScore.min}–{input.conditions.adjustedExpectedScore.max}</p><div className="grid grid-cols-2 gap-3"><button className={styles.confirmButton} onClick={()=>updateDecisions({...cloneDecisions(session.decisions),tossDecision:"bat"})}>Bat first</button><button className={styles.confirmButton} onClick={()=>updateDecisions({...cloneDecisions(session.decisions),tossDecision:"bowl"})}>Bowl first</button></div></section></div>}
      {showImpact&&<div className={styles.modalBackdrop}><section className={`${styles.setupModal} ${styles.impactModal}`}><div className={styles.modalHeader}><div><small>IMPACT PLAYER</small><h2>Make Impact Sub</h2></div><button onClick={()=>setShowImpact(false)}><X size={19}/></button></div><p className="mb-3 text-xs text-white/60">{progress.impactRecommendation?.explanation??"Choose a player swap to activate from the next delivery."}</p><label>Incoming player</label><select value={impactIncoming} onChange={(event)=>setImpactIncoming(event.target.value)}><option value="">Select player</option>{impactIncomingOptions.map((player)=><option key={player.id} value={player.id}>{player.name}</option>)}</select><label>Outgoing player</label><select value={impactOutgoing} onChange={(event)=>setImpactOutgoing(event.target.value)}><option value="">Select player</option>{impactOutgoingOptions.map((player)=><option key={player.id} value={player.id}>{player.name}</option>)}</select><div className="mt-4 grid grid-cols-2 gap-3"><button className={styles.confirmButton} disabled={!impactIncoming||!impactOutgoing} onClick={()=>setImpact({use:true,incomingPlayerId:impactIncoming,outgoingPlayerId:impactOutgoing,battingPosition:progress.impactRecommendation?.battingPosition})}>Confirm sub</button><button className={styles.confirmButton} onClick={()=>setImpact({use:false})}>Do not use</button></div></section></div>}
      {showScoreboard&&<div className={styles.modalBackdrop} onMouseDown={()=>setShowScoreboard(false)}><section className={`${styles.setupModal} ${styles.scoreboardModal}`} onMouseDown={(event)=>event.stopPropagation()}><div className={styles.modalHeader}><div><small>LIVE SCORECARD</small><h2>{battingTeam.name} {currentInnings?.runs??0}/{currentInnings?.wickets??0}</h2></div><button onClick={()=>setShowScoreboard(false)}><X size={19}/></button></div><div className="max-h-[60vh] overflow-y-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-white/20 text-white/50"><th>BATTER</th><th>R</th><th>B</th><th>4</th><th>6</th></tr></thead><tbody>{battingXI.map((player)=>{const line=batterFigures(visible,player.id);return <tr key={player.id} className="border-b border-white/10"><td className="py-2">{player.name}</td><td>{line.runs}</td><td>{line.balls}</td><td>{line.fours}</td><td>{line.sixes}</td></tr>})}</tbody></table></div></section></div>}
      {awaitingBatterSelection&&wicketBatterDecisionKey&&lastDelivery?.wicket&&<div className={styles.modalBackdrop}><section className={styles.setupModal}><div className={styles.modalHeader}><div><small>WICKET FALLEN</small><h2>Choose the next batter</h2></div></div><p className="mb-3 text-sm text-white/65"><strong className="text-white">{lastDelivery.wicket.playerName}</strong> is out. Play is paused until you confirm who comes in next.</p><label>Incoming batter</label><select value={session.decisions.batterByWicket[wicketBatterDecisionKey]??""} onChange={(event)=>setNextBatterDecision(wicketBatterDecisionKey,event.target.value)}><option value="">Automatic: {automaticBatterLabel}</option>{wicketBatterOptions.map((player)=><option key={player.id} value={player.id}>{player.name}</option>)}</select><button className={`${styles.confirmButton} mt-4 w-full`} onClick={confirmWicketBatter}>Confirm next batter</button></section></div>}
    </main>
  );
}
