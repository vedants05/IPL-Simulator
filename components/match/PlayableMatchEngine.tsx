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
  type TossCall,
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
type ShotPhase = "runup" | "delivery" | "bowled" | "pad" | "lbw" | "hit-wicket" | "hit-wicket-out" | "keeper" | "stumping" | "stumped" | "missed-stumping-keeper" | "missed-stumping-attempt" | "missed-stumping-spill" | "keeper-error-take" | "keeper-error-spill" | "keeper-error-boundary" | "edge-contact" | "dropped-catch" | "catch-spill" | "catch-held" | "misfield-stop" | "misfield-bobble" | "missed-run-out-throw" | "missed-run-out-miss" | "missed-run-out-safe" | "run-out-throw" | "run-out-wicket" | "wide" | "wide-collected" | "wide-missed" | "wide-running" | "wide-boundary" | "no-ball" | "no-ball-collected" | "bye" | "leg-bye" | "shot" | "fielded" | "throw" | "received";
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
// Leave enough clearance for the marker and its labels so a fielder cannot be
// clipped by the oval when standing on or running towards the boundary.
const MAX_VISIBLE_FIELDER_RADIUS = 0.88;

const isOutsideThirtyYardCircle = ({ x, y }: Pick<FieldPosition, "x" | "y">) => (
  Math.hypot((x - 50) / THIRTY_YARD_RADIUS_X, (y - 50) / THIRTY_YARD_RADIUS_Y) > 1
);

const isLegSideBehindSquare = ({ x, y }: Pick<FieldPosition, "x" | "y">) => x < 50 && y > 59;

function clampInsideBoundary(x: number, y: number) {
  const dx = (x - 50) / 50;
  const dy = (y - 50) / 50;
  const radius = Math.hypot(dx, dy);
  if (radius <= MAX_VISIBLE_FIELDER_RADIUS) return { x, y };
  const scale = MAX_VISIBLE_FIELDER_RADIUS / radius;
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

function detailedBowlerFigures(deliveries: MatchDelivery[], playerId?: string) {
  const basic = bowlerFigures(deliveries, playerId);
  if (!playerId) return { ...basic, maidens: 0, wides: 0, noBalls: 0 };
  const bowlerDeliveries = deliveries.filter((delivery) => delivery.bowlerId === playerId);
  const oversByNumber = new Map<number, MatchDelivery[]>();
  bowlerDeliveries.forEach((delivery) => {
    const current = oversByNumber.get(delivery.overNumber) ?? [];
    current.push(delivery);
    oversByNumber.set(delivery.overNumber, current);
  });
  const maidens = Array.from(oversByNumber.values()).filter((overDeliveries) => (
    overDeliveries.filter((delivery) => delivery.isLegal).length === 6
    && overDeliveries.reduce((runs, delivery) => (
      runs + delivery.runsOffBat + delivery.extras.wides + delivery.extras.noBalls
    ), 0) === 0
  )).length;
  return {
    ...basic,
    maidens,
    wides: bowlerDeliveries.reduce((total, delivery) => total + delivery.extras.wides, 0),
    noBalls: bowlerDeliveries.reduce((total, delivery) => total + delivery.extras.noBalls, 0),
  };
}

function liveDismissal(deliveries: MatchDelivery[], playerId: string) {
  const wicketDelivery = deliveries.find((delivery) => delivery.wicket?.playerId === playerId);
  const wicket = wicketDelivery?.wicket;
  if (!wicket || !wicketDelivery) return "not out";
  if (wicket.kind === "caught") return `c ${wicket.fielderName ?? "fielder"} b ${wicketDelivery.bowlerName}`;
  if (wicket.kind === "bowled") return `b ${wicketDelivery.bowlerName}`;
  if (wicket.kind === "lbw") return `lbw b ${wicketDelivery.bowlerName}`;
  if (wicket.kind === "run-out") return `run out${wicket.fielderName ? ` (${wicket.fielderName})` : ""}`;
  if (wicket.kind === "stumped") return `st ${wicket.fielderName ?? "keeper"} b ${wicketDelivery.bowlerName}`;
  return `hit wicket b ${wicketDelivery.bowlerName}`;
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
  const [scoreboardTeamId, setScoreboardTeamId] = useState(input.teamA.id);
  const [showImpact, setShowImpact] = useState(false);
  const [impactIncoming, setImpactIncoming] = useState("");
  const [impactOutgoing, setImpactOutgoing] = useState("");
  const [tossCeremonyStarted, setTossCeremonyStarted] = useState(Boolean(session.decisions.tossCall));
  const stadiumRef = useRef<HTMLDivElement>(null);
  const timeouts = useRef<number[]>([]);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const progress = useMemo(() => simulatePlayableMatch(input, userTeamId, session.decisions, session.revealedDeliveries), [input, session, userTeamId]);
  const teams: Record<string, Team> = { [input.teamA.id]: input.teamA, [input.teamB.id]: input.teamB };
  const awaitingToss = progress.awaitingTossCall
    || progress.awaitingTossDecision
    || progress.awaitingTossAcknowledgement;
  const tossWinner = progress.tossWinnerId ? teams[progress.tossWinnerId] : undefined;
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
  const scoreboardInnings = progress.innings.find((innings) => innings.battingTeamId === scoreboardTeamId);
  const scoreboardBowlingTeamId = scoreboardTeamId === input.teamA.id ? input.teamB.id : input.teamA.id;
  const scoreboardBattingPlayers = applyImpactToXI(planFor(scoreboardTeamId).startingXI, scoreboardTeamId)
    .map((id) => input.players[id])
    .filter((player): player is Player => Boolean(player));
  const scoreboardBowlingPlayers = applyImpactToXI(planFor(scoreboardBowlingTeamId).startingXI, scoreboardBowlingTeamId)
    .map((id) => input.players[id])
    .filter((player): player is Player => Boolean(player));
  const scoreboardDeliveries = scoreboardInnings?.deliveries ?? [];
  const scoreboardExtras = scoreboardDeliveries.reduce((total, delivery) => (
    total
    + delivery.extras.wides
    + delivery.extras.noBalls
    + delivery.extras.byes
    + delivery.extras.legByes
  ), 0);
  const scoreboardBattingRows = scoreboardBattingPlayers.map((player) => ({
    player,
    figures: batterFigures(scoreboardDeliveries, player.id),
    dismissal: liveDismissal(scoreboardDeliveries, player.id),
    appeared: scoreboardDeliveries.some((delivery) => (
      delivery.strikerId === player.id
      || delivery.nonStrikerId === player.id
      || delivery.wicket?.playerId === player.id
    )),
  })).filter((row) => row.appeared);
  const scoreboardBowlingRows = scoreboardBowlingPlayers.map((player) => ({
    player,
    figures: detailedBowlerFigures(scoreboardDeliveries, player.id),
  })).filter((row) => row.figures.balls > 0);
  const liveScoreForTeam = (teamId: string) => progress.innings.find((innings) => innings.battingTeamId === teamId);
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
  // Once a delivery is animating its bowler has already been committed by the
  // deterministic simulation. In particular, the first ball used to leave the
  // selector pointing at that now-started over, so a manual choice was stored
  // too late and appeared to be replaced by the automatic bowler afterwards.
  const bowlerSelectionOver = activeShot
    ? activeShot.delivery.overNumber + 1
    : nextDelivery
      ? nextDelivery.overNumber + (nextDelivery.deliveryInOver === 1 ? 0 : 1)
      : null;
  const bowlerSelectionKey = bowlerSelectionOver === null
    ? null
    : `${inningsNumber}-${bowlerSelectionOver}`;
  const bowlerBeforeSelectionId = activeShot?.delivery.bowlerId
    ?? (nextDelivery?.deliveryInOver === 1
      ? (lastDelivery?.inningsNumber === inningsNumber ? lastDelivery.bowlerId : undefined)
      : nextDelivery?.bowlerId);
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
  const fieldIsIllegal = activeRole === "bowling" && (outsideCount > maxOutside || legBehind > 2);
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
  const makeTossCall = (tossCall: TossCall) => {
    const decisions = cloneDecisions(sessionRef.current.decisions);
    decisions.tossCall = tossCall;
    delete decisions.tossDecision;
    delete decisions.tossResultAcknowledged;
    updateDecisions(decisions);
  };
  const chooseTossDecision = (tossDecision: "bat" | "bowl") => {
    const decisions = cloneDecisions(sessionRef.current.decisions);
    decisions.tossDecision = tossDecision;
    decisions.tossResultAcknowledged = true;
    updateDecisions(decisions);
  };
  const acknowledgeLostToss = () => {
    const decisions = cloneDecisions(sessionRef.current.decisions);
    decisions.tossResultAcknowledged = true;
    updateDecisions(decisions);
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
    if (activeShot || awaitingBatterSelection || awaitingToss || progress.awaitingImpactDecision || progress.complete || fieldIsIllegal) return;
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
      if (current.awaitingTossCall || current.awaitingTossDecision || current.awaitingTossAcknowledgement || current.awaitingImpactDecision || current.complete) break;

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
    if (activeShot || awaitingBatterSelection || awaitingToss || progress.awaitingImpactDecision || progress.complete || fieldIsIllegal) return;
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
    const byeRuns = delivery.extras.byes + delivery.extras.legByes;
    const byeBoundary = byeRuns >= 4 && delivery.runsOffBat === 0;
    const bowled = delivery.wicket?.kind === "bowled";
    const lbw = delivery.wicket?.kind === "lbw";
    const hitWicket = delivery.wicket?.kind === "hit-wicket";
    const stumped = delivery.wicket?.kind === "stumped";
    const runOut = delivery.wicket?.kind === "run-out";
    const caught = delivery.wicket?.kind === "caught";
    const wide = delivery.extras.wides > 0 && !stumped;
    const wideBoundary = wide && delivery.extras.wides >= 5;
    const boundary = isFour || isSix || byeBoundary || wideBoundary;
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
    const missedStumping = delivery.fieldingEvent?.kind === "missed-stumping";
    const droppedCatch = delivery.fieldingEvent?.kind === "dropped-catch";
    const misfield = delivery.fieldingEvent?.kind === "misfield";
    const missedRunOut = delivery.fieldingEvent?.kind === "missed-run-out";
    const keepingError = delivery.fieldingEvent?.kind === "keeping-error";
    const droppedCatchFielderIdx = droppedCatch && delivery.fieldingEvent?.fielderId
      ? outfielders.findIndex((player) => player.id === delivery.fieldingEvent?.fielderId)
      : -1;
    const caughtFielderIdx = caught && delivery.wicket?.fielderId
      ? outfielders.findIndex((player) => player.id === delivery.wicket?.fielderId)
      : -1;
    const isBye = delivery.extras.byes > 0 && !stumped;
    const isLegBye = delivery.extras.legByes > 0 && !stumped;
    const untouchedNoBall = delivery.extras.noBalls > 0
      && delivery.runsOffBat === 0
      && byeRuns === 0
      && delivery.extras.wides === 0
      && !delivery.wicket;
    const edgedShot = delivery.shotType === "edge"
      && !wide
      && !isBye
      && !isLegBye
      && !bowled
      && !lbw
      && !hitWicket
      && !stumped;
    const wideRunningRuns = wideBoundary ? 0 : Math.max(0, delivery.extras.wides - 1);
    const runningRuns = boundary
      ? 0
      : wide
        ? Math.min(3, wideRunningRuns)
        : Math.min(3, delivery.runsOffBat + byeRuns);
    const wideOnStrongSide = hash(`${delivery.id}-wide-side`) % 2 === 0;
    const strongSideDirection = deliveryIsLeftHanded ? 1 : -1;
    const wideDirection = wideOnStrongSide ? strongSideDirection : -strongSideDirection;
    const wideX = 50 + wideDirection * (wideOnStrongSide ? 4.6 : 3.4);
    const noBallDirection = hash(`${delivery.id}-no-ball-side`) % 2 === 0 ? 1 : -1;
    const noBallX = 50 + noBallDirection * 1.8;
    const extraDirection = hash(`${delivery.id}-extra-side`) % 2 === 0 ? 1 : -1;
    const keepingErrorX = 50 + extraDirection * 2.2;
    // Fielders and the shot destination must use the same rendered coordinate
    // system. Previously only the field was mirrored for an LHB, so a player
    // appeared to run in from the opposite side of the ground.
    let hitX = bowled ? 50 : deliveryIsLeftHanded ? 100 - logicalHitX : logicalHitX;
    let hitY = bowled ? 59 : logicalHitY;
    if (wide && delivery.extras.wides > 1) {
      hitX = 50 + wideDirection * (wideBoundary ? 28 : runningRuns >= 2 ? 24 : 18);
      hitY = wideBoundary ? 96 : runningRuns >= 2 ? 84 : 80;
    } else if (missedStumping) {
      hitX = 50 + extraDirection * 18;
      hitY = 78;
    } else if (isBye) {
      hitX = 50 + extraDirection * (byeBoundary ? 10 : runningRuns >= 2 ? 15 : 9);
      hitY = byeBoundary ? 96 : runningRuns >= 2 ? 84 : 77;
    } else if (isLegBye) {
      hitX = 50 + extraDirection * (runningRuns >= 2 ? 27 : 18);
      hitY = runningRuns >= 2 ? 75 : 69;
    }
    const designatedCatchFielderIdx = caughtFielderIdx >= 0 ? caughtFielderIdx : droppedCatchFielderIdx;
    if (designatedCatchFielderIdx >= 0) {
      const designatedPosition = fieldPositions[designatedCatchFielderIdx];
      if (designatedPosition) {
        const designatedCatchPoint = clampInsideBoundary(
          deliveryIsLeftHanded ? 100 - designatedPosition.x : designatedPosition.x,
          designatedPosition.y,
        );
        hitX = designatedCatchPoint.x;
        hitY = designatedCatchPoint.y;
      }
    }
    const outfielderEvent = Boolean(
      delivery.fieldingEvent
      && !["keeping-error", "missed-stumping"].includes(delivery.fieldingEvent.kind)
    );
    const outfielderWicket = delivery.wicket?.kind === "caught" || delivery.wicket?.kind === "run-out";
    const isFieldedDotBall = delivery.resultCode === "0" && !delivery.wicket;
    const fielderCollects = Boolean(!bowled && !boundary && (
      delivery.runsOffBat > 0
      || byeRuns > 0
      || wideRunningRuns > 0
      || isFieldedDotBall
      || outfielderEvent
      || outfielderWicket
    ));

    if (fielderCollects && !droppedCatch && !wide && runningRuns >= 2 && runningRuns < 4) {
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

    // A fielded ball must finish at a point the collecting fielder can visibly
    // reach. Boundary shots are deliberately excluded so fours and sixes can
    // still travel to or beyond the rope.
    if (fielderCollects) {
      const visibleCollectionPoint = clampInsideBoundary(hitX, hitY);
      hitX = visibleCollectionPoint.x;
      hitY = visibleCollectionPoint.y;
    }

    // Measure every rendered fielder after the LHB/RHB transform. Candidate
    // restrictions must never make a visibly farther player collect the ball.
    const nearestFielderIdx = fielderCollects ? fieldPositions.map((_, index) => index).reduce((closest, index) => {
      const position = fieldPositions[index];
      const renderedX = deliveryIsLeftHanded ? 100 - position.x : position.x;
      const visiblePosition = clampInsideBoundary(renderedX, position.y);
      const distance = Math.hypot(visiblePosition.x - hitX, visiblePosition.y - hitY);
      if (closest.index < 0 || distance < closest.distance) return { index, distance };
      return closest;
    }, { index: -1, distance: Number.POSITIVE_INFINITY }).index : -1;
    const closestFielderIdx = caughtFielderIdx >= 0
      ? caughtFielderIdx
      : droppedCatchFielderIdx >= 0
        ? droppedCatchFielderIdx
        : nearestFielderIdx;
    const dropDirection = hash(`${delivery.id}-catch-spill`) % 2 === 0 ? 1 : -1;
    const droppedBallPoint = clampInsideBoundary(hitX + dropDirection * 7, hitY + 4);
    const misfieldDirection = hash(`${delivery.id}-misfield-bobble`) % 2 === 0 ? 1 : -1;
    const misfieldOutwardX = hitX - 50;
    const misfieldOutwardY = hitY - 50;
    const misfieldMagnitude = Math.max(1, Math.hypot(misfieldOutwardX, misfieldOutwardY));
    const misfieldBallPoint = clampInsideBoundary(
      hitX + misfieldOutwardX / misfieldMagnitude * 6 - misfieldOutwardY / misfieldMagnitude * misfieldDirection * 2.5,
      hitY + misfieldOutwardY / misfieldMagnitude * 6 + misfieldOutwardX / misfieldMagnitude * misfieldDirection * 2.5,
    );
    const missedRunOutDirection = hash(`${delivery.id}-missed-run-out`) % 2 === 0 ? 1 : -1;
    const missedRunOutWideThrow = hash(`${delivery.id}-missed-run-out-kind`) % 2 === 0;
    const missedRunOutTarget = missedRunOutWideThrow
      ? { x: 50 + missedRunOutDirection * 3.2, y: 62.8 }
      : { x: 50, y: 61.2 };
    const missedRunOutLooseBall = missedRunOutWideThrow
      ? { x: 50 + missedRunOutDirection * 6.2, y: 66 }
      : { x: 50 + missedRunOutDirection * 2.3, y: 63.4 };
    const runningDuration = runOut ? 3200 : runningRuns === 3 ? 9400 : runningRuns === 2 ? 6200 : runningRuns === 1 ? 3050 : 0;
    const noBatExtra = isBye || isLegBye;
    const shotDuration = noBatExtra
      ? byeBoundary ? 1350 : Math.max(900, runningDuration * .68)
      : wide
        ? wideBoundary ? 1450 : Math.max(900, runningDuration * .62)
        : caught
          ? delivery.shotType === "skier" ? 1800 : delivery.shotType === "lofted" ? 1500 : 1050
          : isSix ? 2600 : delivery.shotType === "skier" ? 1800 : isFour ? 1350 : Math.max(800, runningDuration * .68);
    const throwDistance = Math.hypot(hitX - 50, hitY - 61.2);
    const throwDuration = Math.round(Math.max(850, Math.min(2200, 650 + throwDistance * 31)));
    const shot: ActiveShot = { delivery, phase: "runup", fielderCollects, batRuns: runningRuns, ballX: 48.5, ballY: 42, ballHitX: hitX, ballHitY: hitY, bowlerX: 48.5, closestFielderIdx, receiverX: wide ? wideX : keepingError ? keepingErrorX : 50, receiverY: 61.2, releaseDelay: 680, deliveryDuration: 360, runningDuration, shotDuration, throwDuration };
    setActiveShot(shot);
    later(() => setActiveShot((current) => current ? { ...current, phase: "delivery", ballX: wide ? wideX : untouchedNoBall ? noBallX : isBye && !missedStumping ? 50 + extraDirection * 2.2 : 50, ballY: 58 } : current), 680);
    const outfieldShotAt = edgedShot ? 1200 : 1040;
    const beginOutfieldBall = (phase: ShotPhase = "shot") => {
      if (edgedShot) {
        const edgeDirection = hitX >= 50 ? 1 : -1;
        later(() => setActiveShot((current) => current ? { ...current, phase: "edge-contact", ballX: 50 + edgeDirection * 1.15, ballY: 60.2 } : current), 1040);
      }
      later(() => setActiveShot((current) => current ? { ...current, phase, ballX: hitX, ballY: hitY } : current), outfieldShotAt);
    };
    if (bowled) {
      later(() => setActiveShot((current) => current ? { ...current, phase: "bowled", ballX: 50, ballY: 61 } : current), 1040);
      later(() => completeAnimatedDelivery(decisions), 1540);
      return;
    }
    if (lbw) {
      const padDirection = deliveryIsLeftHanded ? 1 : -1;
      const padX = 50 + padDirection * 0.7;
      later(() => setActiveShot((current) => current ? { ...current, phase: "pad", ballX: padX, ballY: 59 } : current), 1040);
      later(() => setActiveShot((current) => current ? { ...current, phase: "lbw", ballX: padX + padDirection * 1.5, ballY: 60.1 } : current), 1280);
      later(() => completeAnimatedDelivery(decisions), 1720);
      return;
    }
    if (hitWicket) {
      const contactDirection = deliveryIsLeftHanded ? -1 : 1;
      later(() => setActiveShot((current) => current ? { ...current, phase: "hit-wicket", ballX: 50 + contactDirection * 4.2, ballY: 63.2 } : current), 1040);
      later(() => setActiveShot((current) => current ? { ...current, phase: "hit-wicket-out" } : current), 1360);
      later(() => completeAnimatedDelivery(decisions), 1800);
      return;
    }
    if (stumped) {
      later(() => setActiveShot((current) => current ? { ...current, phase: "keeper", ballX: 50, ballY: 70.2 } : current), 1040);
      later(() => setActiveShot((current) => current ? { ...current, phase: "stumping", ballX: 51.5, ballY: 61.2 } : current), 1380);
      later(() => setActiveShot((current) => current ? { ...current, ballX: 48.5, ballY: 61.2 } : current), 1570);
      later(() => setActiveShot((current) => current ? { ...current, phase: "stumped" } : current), 1760);
      later(() => completeAnimatedDelivery(decisions), 2060);
      return;
    }
    if (missedStumping) {
      const attemptDirection = deliveryIsLeftHanded ? 1 : -1;
      const spillAt = 1570;
      const fieldedAt = spillAt + shot.shotDuration;
      const throwAt = Math.max(fieldedAt + 120, spillAt + shot.runningDuration - shot.throwDuration + 100);
      later(() => setActiveShot((current) => current ? { ...current, phase: "missed-stumping-keeper", ballX: 50, ballY: 70.2 } : current), 1040);
      later(() => setActiveShot((current) => current ? { ...current, phase: "missed-stumping-attempt", ballX: 50 + attemptDirection * 1.5, ballY: 61.2 } : current), 1380);
      later(() => setActiveShot((current) => current ? { ...current, phase: "missed-stumping-spill", ballX: hitX, ballY: hitY } : current), spillAt);
      later(() => setActiveShot((current) => current ? { ...current, phase: "fielded" } : current), fieldedAt);
      later(() => setActiveShot((current) => current ? { ...current, phase: "throw", ballX: 50, ballY: 61.2 } : current), throwAt);
      later(() => completeAnimatedDelivery(decisions), Math.max(throwAt + shot.throwDuration + 100, spillAt + shot.runningDuration + 200));
      return;
    }
    if (wide) {
      later(() => setActiveShot((current) => current ? { ...current, phase: "wide", ballX: wideX, ballY: 70.2 } : current), 1040);
      if (delivery.extras.wides === 1) {
        later(() => setActiveShot((current) => current ? { ...current, phase: "wide-collected" } : current), 1390);
        later(() => completeAnimatedDelivery(decisions), 1700);
        return;
      }
      const missedAt = 1370;
      const looseBallAt = 1570;
      later(() => setActiveShot((current) => current ? { ...current, phase: "wide-missed" } : current), missedAt);
      if (wideBoundary) {
        later(() => setActiveShot((current) => current ? { ...current, phase: "wide-boundary", ballX: hitX, ballY: hitY } : current), looseBallAt);
        later(() => completeAnimatedDelivery(decisions), looseBallAt + shot.shotDuration + 320);
        return;
      }
      const fieldedAt = looseBallAt + shot.shotDuration;
      const throwAt = Math.max(fieldedAt + 120, looseBallAt + shot.runningDuration - shot.throwDuration + 100);
      later(() => setActiveShot((current) => current ? { ...current, phase: "wide-running", ballX: hitX, ballY: hitY } : current), looseBallAt);
      later(() => setActiveShot((current) => current ? { ...current, phase: "fielded" } : current), fieldedAt);
      later(() => setActiveShot((current) => current ? { ...current, phase: "throw", ballX: 50, ballY: 61.2 } : current), throwAt);
      later(() => completeAnimatedDelivery(decisions), Math.max(throwAt + shot.throwDuration + 100, looseBallAt + shot.runningDuration + 200));
      return;
    }
    if (untouchedNoBall) {
      later(() => setActiveShot((current) => current ? { ...current, phase: "no-ball", ballX: noBallX, ballY: 70.2 } : current), 1040);
      later(() => setActiveShot((current) => current ? { ...current, phase: "no-ball-collected" } : current), 1390);
      later(() => completeAnimatedDelivery(decisions), 1700);
      return;
    }
    if (keepingError) {
      const takeAt = 1040;
      const spillAt = 1420;
      later(() => setActiveShot((current) => current ? { ...current, phase: "keeper-error-take", ballX: keepingErrorX, ballY: 70.2 } : current), takeAt);
      if (byeBoundary) {
        later(() => setActiveShot((current) => current ? { ...current, phase: "keeper-error-boundary", ballX: hitX, ballY: hitY } : current), spillAt);
        later(() => completeAnimatedDelivery(decisions), spillAt + shot.shotDuration + 320);
        return;
      }
      const fieldedAt = spillAt + shot.shotDuration;
      const throwAt = Math.max(fieldedAt + 120, spillAt + shot.runningDuration - shot.throwDuration + 100);
      later(() => setActiveShot((current) => current ? { ...current, phase: "keeper-error-spill", ballX: hitX, ballY: hitY } : current), spillAt);
      later(() => setActiveShot((current) => current ? { ...current, phase: "fielded" } : current), fieldedAt);
      later(() => setActiveShot((current) => current ? { ...current, phase: "throw", ballX: 50, ballY: 61.2 } : current), throwAt);
      later(() => completeAnimatedDelivery(decisions), Math.max(throwAt + shot.throwDuration + 100, spillAt + shot.runningDuration + 200));
      return;
    }
    if (droppedCatch) {
      const catchAt = outfieldShotAt;
      const dropAt = catchAt + shot.shotDuration;
      const spillAt = dropAt + 240;
      const recoveredAt = spillAt + 600;
      const throwAt = Math.max(recoveredAt + 120, catchAt + shot.runningDuration - shot.throwDuration + 100);
      beginOutfieldBall();
      later(() => setActiveShot((current) => current ? { ...current, phase: "dropped-catch" } : current), dropAt);
      later(() => setActiveShot((current) => current ? {
        ...current,
        phase: "catch-spill",
        ballX: droppedBallPoint.x,
        ballY: droppedBallPoint.y,
        ballHitX: droppedBallPoint.x,
        ballHitY: droppedBallPoint.y,
      } : current), spillAt);
      later(() => setActiveShot((current) => current ? { ...current, phase: "fielded" } : current), recoveredAt);
      later(() => setActiveShot((current) => current ? { ...current, phase: "throw", ballX: 50, ballY: 61.2 } : current), throwAt);
      later(() => completeAnimatedDelivery(decisions), Math.max(throwAt + shot.throwDuration + 100, catchAt + shot.runningDuration + 200));
      return;
    }
    if (misfield) {
      const shotAt = outfieldShotAt;
      const attemptedStopAt = shotAt + shot.shotDuration;
      const bobbleAt = attemptedStopAt + 220;
      const recoveredAt = bobbleAt + 620;
      const throwAt = Math.max(recoveredAt + 120, shotAt + shot.runningDuration - shot.throwDuration + 100);
      beginOutfieldBall();
      later(() => setActiveShot((current) => current ? { ...current, phase: "misfield-stop" } : current), attemptedStopAt);
      later(() => setActiveShot((current) => current ? {
        ...current,
        phase: "misfield-bobble",
        ballX: misfieldBallPoint.x,
        ballY: misfieldBallPoint.y,
        ballHitX: misfieldBallPoint.x,
        ballHitY: misfieldBallPoint.y,
      } : current), bobbleAt);
      later(() => setActiveShot((current) => current ? { ...current, phase: "fielded" } : current), recoveredAt);
      later(() => setActiveShot((current) => current ? { ...current, phase: "throw", ballX: 50, ballY: 61.2 } : current), throwAt);
      later(() => completeAnimatedDelivery(decisions), Math.max(throwAt + shot.throwDuration + 100, shotAt + shot.runningDuration + 200));
      return;
    }
    if (missedRunOut) {
      const shotAt = outfieldShotAt;
      const fieldedAt = shotAt + shot.shotDuration;
      const throwAt = Math.max(fieldedAt + 120, shotAt + shot.runningDuration - shot.throwDuration - 80);
      const missedAt = throwAt + shot.throwDuration;
      const safeAt = missedAt + 300;
      beginOutfieldBall();
      later(() => setActiveShot((current) => current ? { ...current, phase: "fielded" } : current), fieldedAt);
      later(() => setActiveShot((current) => current ? {
        ...current,
        phase: "missed-run-out-throw",
        ballX: missedRunOutTarget.x,
        ballY: missedRunOutTarget.y,
      } : current), throwAt);
      later(() => setActiveShot((current) => current ? {
        ...current,
        phase: "missed-run-out-miss",
        ballX: missedRunOutLooseBall.x,
        ballY: missedRunOutLooseBall.y,
      } : current), missedAt);
      later(() => setActiveShot((current) => current ? { ...current, phase: "missed-run-out-safe" } : current), safeAt);
      later(() => completeAnimatedDelivery(decisions), Math.max(safeAt + 420, shotAt + shot.runningDuration + 300));
      return;
    }
    if (runOut) {
      const shotAt = outfieldShotAt;
      const fieldedAt = shotAt + shot.shotDuration;
      const throwAt = Math.max(fieldedAt + 120, shotAt + shot.runningDuration - shot.throwDuration - 160);
      const wicketAt = throwAt + shot.throwDuration;
      beginOutfieldBall();
      later(() => setActiveShot((current) => current ? { ...current, phase: "fielded" } : current), fieldedAt);
      later(() => setActiveShot((current) => current ? { ...current, phase: "run-out-throw", ballX: 50, ballY: 61.2 } : current), throwAt);
      later(() => setActiveShot((current) => current ? { ...current, phase: "run-out-wicket" } : current), wicketAt);
      later(() => completeAnimatedDelivery(decisions), Math.max(wicketAt + 800, shotAt + shot.runningDuration + 300));
      return;
    }
    if (caught) {
      const shotAt = outfieldShotAt;
      const heldAt = shotAt + shot.shotDuration;
      beginOutfieldBall();
      later(() => setActiveShot((current) => current ? { ...current, phase: "catch-held" } : current), heldAt);
      later(() => completeAnimatedDelivery(decisions), heldAt + 950);
      return;
    }
    const ballTravelPhase: ShotPhase = isBye ? "bye" : isLegBye ? "leg-bye" : "shot";
    beginOutfieldBall(ballTravelPhase);
    later(() => setActiveShot((current) => current ? { ...current, phase: "fielded" } : current), outfieldShotAt + shot.shotDuration);
    const needsThrow = fielderCollects && !boundary && (delivery.totalRuns > 0 || delivery.fieldingEvent || delivery.wicket?.kind === "run-out");
    const throwStartAt = needsThrow
      ? delivery.wicket?.kind === "run-out"
        ? outfieldShotAt + 120 + shot.shotDuration
        : Math.max(outfieldShotAt + 120 + shot.shotDuration, outfieldShotAt + 100 + runningDuration - shot.throwDuration)
      : 0;
    if (needsThrow) later(() => setActiveShot((current) => current ? { ...current, phase: "throw", ballX: 50, ballY: 61.2 } : current), throwStartAt);
    const finishAt = Math.max(
      needsThrow ? throwStartAt + shot.throwDuration + 100 : outfieldShotAt + 220 + shot.shotDuration,
      runningDuration > 0 ? outfieldShotAt + 200 + runningDuration : 0,
    );
    later(() => completeAnimatedDelivery(decisions), finishAt);
  };

  useEffect(() => () => timeouts.current.forEach(window.clearTimeout), []);
  useEffect(() => {
    if (!isPlaying || activeShot || awaitingBatterSelection || progress.complete || awaitingToss || progress.awaitingImpactDecision || fieldIsIllegal) return;
    const id = window.setTimeout(playNextDelivery, 180 / speed);
    return () => window.clearTimeout(id);
  });
  useEffect(() => {
    if (fieldIsIllegal) setIsPlaying(false);
  }, [fieldIsIllegal]);
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
  const openScoreboard = () => {
    setScoreboardTeamId(battingTeamId);
    setShowScoreboard(true);
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
  // Only completed deliveries belong in the ticker. Reading from activeShot
  // exposed wickets and boundaries before their animations reached the result.
  const fieldDelivery = lastDelivery;
  const stumpingAnimation = Boolean(
    activeShot
    && activeShot.delivery.wicket?.kind === "stumped"
    && ["keeper", "stumping", "stumped"].includes(activeShot.phase)
  );
  const wideAnimation = Boolean(
    activeShot
    && activeShot.delivery.extras.wides > 0
    && ["wide", "wide-collected", "wide-missed", "wide-running", "wide-boundary"].includes(activeShot.phase)
  );
  const noBallTakeAnimation = Boolean(
    activeShot
    && activeShot.delivery.extras.noBalls > 0
    && activeShot.delivery.runsOffBat === 0
    && ["no-ball", "no-ball-collected"].includes(activeShot.phase)
  );
  const missedStumpingAnimation = Boolean(
    activeShot
    && activeShot.delivery.fieldingEvent?.kind === "missed-stumping"
    && ["missed-stumping-keeper", "missed-stumping-attempt", "missed-stumping-spill"].includes(activeShot.phase)
  );
  const keepingErrorAnimation = Boolean(
    activeShot
    && activeShot.delivery.fieldingEvent?.kind === "keeping-error"
    && ["keeper-error-take", "keeper-error-spill", "keeper-error-boundary"].includes(activeShot.phase)
  );
  const missedRunOutAnimation = Boolean(
    activeShot
    && activeShot.delivery.fieldingEvent?.kind === "missed-run-out"
    && ["missed-run-out-throw", "missed-run-out-miss", "missed-run-out-safe"].includes(activeShot.phase)
  );
  const successfulRunOutAnimation = Boolean(
    activeShot
    && activeShot.delivery.wicket?.kind === "run-out"
    && ["run-out-throw", "run-out-wicket"].includes(activeShot.phase)
  );
  const successfulCatchAtFielder = Boolean(
    activeShot
    && activeShot.delivery.wicket?.kind === "caught"
    && activeShot.phase === "catch-held"
  );
  const keeperReceiving = Boolean(
    stumpingAnimation
    || wideAnimation
    || noBallTakeAnimation
    || missedStumpingAnimation
    || keepingErrorAnimation
    || missedRunOutAnimation
    || successfulRunOutAnimation
    || (activeShot && activeShot.fielderCollects && activeShot.phase !== "bowled" && ["shot", "bye", "leg-bye", "fielded", "throw", "received"].includes(activeShot.phase) && activeShot.delivery.runsOffBat < 4 && (activeShot.delivery.totalRuns > 0 || activeShot.delivery.fieldingEvent))
  );
  const keeperAtStumps = Boolean(
    (stumpingAnimation && activeShot?.phase !== "keeper")
    || (missedStumpingAnimation && activeShot?.phase !== "missed-stumping-keeper")
  );
  const keeperX = wideAnimation || keepingErrorAnimation ? activeShot!.receiverX : noBallTakeAnimation ? activeShot!.ballX : 50;
  const keeperY = keeperAtStumps ? 61.2 : stumpingAnimation || missedStumpingAnimation || keepingErrorAnimation || wideAnimation || noBallTakeAnimation ? 70.2 : keeperReceiving ? 61.2 : 73;
  const hitWicketAnimation = Boolean(activeShot && ["hit-wicket", "hit-wicket-out"].includes(activeShot.phase));
  const missedRunOutAtStumps = Boolean(activeShot && ["missed-run-out-miss", "missed-run-out-safe"].includes(activeShot.phase));
  const successfulRunOutAtStumps = activeShot?.phase === "run-out-wicket";
  const runOutRunnersActive = Boolean(activeShot && activeShot.delivery.wicket?.kind === "run-out" && ["shot", "fielded", "run-out-throw", "run-out-wicket"].includes(activeShot.phase));
  const runnersActive = Boolean(activeShot && ["shot", "bye", "leg-bye", "wide-running", "keeper-error-spill", "missed-stumping-spill", "dropped-catch", "catch-spill", "misfield-stop", "misfield-bobble", "missed-run-out-throw", "missed-run-out-miss", "missed-run-out-safe", "fielded", "throw"].includes(activeShot.phase));
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
            <button onClick={openImpactSelection} disabled={Boolean(activeShot) || awaitingToss || progress.complete || Boolean(impactChoice)}><UserPlus size={15}/><span>{impactChoice ? impactChoice.use ? "Impact Sub Used" : "Impact Declined" : "Make Impact Sub"}</span></button>
            <button onClick={openScoreboard}><Activity size={15}/><span>Scorecard</span></button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-[34px] items-center overflow-hidden rounded border border-white/20 bg-[#111622] font-space-mono text-[8px] font-bold uppercase">
            <button onClick={() => skip("ball")} disabled={Boolean(activeShot) || awaitingBatterSelection || awaitingToss || fieldIsIllegal} className="h-full border-r border-white/15 px-2.5 hover:bg-white/10 disabled:opacity-30">Skip ball</button>
            <button onClick={() => skip("over")} disabled={Boolean(activeShot) || awaitingBatterSelection || awaitingToss || fieldIsIllegal} className="h-full border-r border-white/15 px-2.5 hover:bg-white/10 disabled:opacity-30">Skip over</button>
            <button onClick={() => skip("five-overs")} disabled={Boolean(activeShot) || awaitingBatterSelection || awaitingToss || fieldIsIllegal} className="h-full border-r border-white/15 px-2.5 hover:bg-white/10 disabled:opacity-30">Skip 5 overs</button>
            <button onClick={() => skip("innings")} disabled={Boolean(activeShot) || awaitingBatterSelection || awaitingToss || fieldIsIllegal} className="h-full px-2.5 hover:bg-white/10 disabled:opacity-30">Finish innings</button>
          </div>
          <div className="flex h-[34px] items-center overflow-hidden rounded border border-white/20 bg-[#111622]">
            <button disabled={speed === 1} onClick={() => setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(speed) - 1)])} className="h-full w-8 text-[10px] font-bold disabled:opacity-30">&lt;&lt;</button>
            <span className="flex h-full min-w-[38px] items-center justify-center border-x border-white/15 font-space-mono text-[11px] font-bold">{speed}x</span>
            <button disabled={speed === 8} onClick={() => setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(speed) + 1)])} className="h-full w-8 text-[10px] font-bold disabled:opacity-30">&gt;&gt;</button>
          </div>
          <button onClick={playNextDelivery} disabled={Boolean(activeShot) || isPlaying || awaitingBatterSelection || awaitingToss || fieldIsIllegal} className="flex h-[34px] w-[34px] items-center justify-center rounded border border-white/20 bg-[#111622] disabled:opacity-30" title={fieldIsIllegal ? "Set a legal field before the next ball" : "Next ball"}><SkipForward size={14}/></button>
          <button onClick={() => setIsPlaying((value) => !value)} disabled={awaitingBatterSelection || awaitingToss || fieldIsIllegal} className={`flex h-[34px] shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded border border-white/20 px-4 font-space-mono text-[11px] font-bold leading-none uppercase disabled:opacity-30 ${isPlaying ? "bg-[#ed4c47]" : "bg-[#111622]"}`}>{isPlaying ? <><Pause className="shrink-0" size={13}/>Pause</> : <><Play className="shrink-0" size={13}/>Play match</>}</button>
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
          {fieldIsIllegal&&<div className={styles.fieldingWarningBanner}>⚠️ ILLEGAL FIELD — play is stopped until the highlighted field restriction is corrected.</div>}
          <div className={styles.stadium}><div className={styles.crowd}/><div ref={stadiumRef} className={styles.field}><div className={styles.mownStripes}/><div className={styles.innerCircle}/>{showZoneOverlay&&<div className={styles.zoneOverlay}>{FIELD_ZONE_ANCHORS.map((zone)=><div key={zone.label} className={`${styles.zoneBox} ${occupiedFieldZones.has(zone.label)?styles.activeZoneBox:""}`} style={{left:`${renderedLhb?100-zone.x:zone.x}%`,top:`${zone.y}%`}}>{zone.label}</div>)}</div>}<div className={styles.pitch}><i className={styles.creaseTop}/><i className={styles.creaseBottom}/><span className={styles.stumpsTop}/><span className={`${styles.stumpsBottom} ${hitWicketAnimation?styles.hitWicketStumps:""} ${missedRunOutAtStumps?styles.safeStumps:""} ${successfulRunOutAtStumps?styles.runOutStumps:""}`}/></div>
            {activeShot&&<div className={`${styles.shotBall} ${activeShot.phase==="shot"&&activeShot.delivery.runsOffBat===6?styles.careerSixBall:activeShot.phase==="shot"&&activeShot.delivery.shotType==="skier"?styles.skierBall:activeShot.phase==="shot"&&activeShot.delivery.shotType==="lofted"?styles.loftedBall:activeShot.phase==="shot"&&activeShot.delivery.shotType==="edge"?styles.edgeBall:""} ${activeShot.phase==="edge-contact"?styles.edgeContactBall:""} ${activeShot.phase==="lbw"?styles.padImpactBall:""} ${activeShot.phase==="catch-spill"?styles.droppedBall:""} ${activeShot.phase==="misfield-bobble"?styles.misfieldBall:""} ${activeShot.phase==="missed-run-out-miss"?styles.missedRunOutBall:""} ${activeShot.phase==="wide-missed"?styles.missedWideBall:""} ${activeShot.phase==="run-out-wicket"?styles.runOutImpactBall:""} ${activeShot.phase==="catch-held"?styles.caughtBall:""} ${activeShot.phase==="keeper-error-spill"||activeShot.phase==="keeper-error-boundary"?styles.keeperErrorBall:""}`} style={{left:`${activeShot.ballX}%`,top:`${activeShot.ballY}%`,opacity:activeShot.phase==="runup"?0:1,transitionDuration:`${(activeShot.phase==="delivery"?activeShot.deliveryDuration:activeShot.phase==="keeper"||activeShot.phase==="wide"||activeShot.phase==="no-ball"||activeShot.phase==="missed-stumping-keeper"||activeShot.phase==="keeper-error-take"?300:activeShot.phase==="edge-contact"?160:activeShot.phase==="hit-wicket"?260:activeShot.phase==="pad"?200:activeShot.phase==="lbw"||activeShot.phase==="stumping"||activeShot.phase==="missed-stumping-attempt"?150:activeShot.phase==="catch-spill"?600:activeShot.phase==="misfield-bobble"?620:activeShot.phase==="missed-run-out-throw"||activeShot.phase==="run-out-throw"?activeShot.throwDuration:activeShot.phase==="missed-run-out-miss"?300:["shot","bye","leg-bye","missed-stumping-spill","wide-running","wide-boundary","keeper-error-spill","keeper-error-boundary"].includes(activeShot.phase)?activeShot.shotDuration:activeShot.phase==="throw"?activeShot.throwDuration:100)/speed}ms`,"--six-flight-duration":`${activeShot.shotDuration/speed}ms`,"--skier-flight-duration":`${activeShot.shotDuration/speed}ms`,"--lofted-flight-duration":`${activeShot.shotDuration/speed}ms`,"--drop-pop-duration":`${600/speed}ms`,"--misfield-bobble-duration":`${620/speed}ms`,"--missed-run-out-duration":`${300/speed}ms`} as CSSProperties}/>}
            <div className={`${styles.fielder} ${styles.activeFielder} ${activeShot?.phase==="runup"?styles.pacerRunup:""}`} style={{left:`${activeShot?.bowlerX??48.5}%`,top:"40.1%","--runup-duration":`${(activeShot?.releaseDelay??680)/speed}ms`,"--bowler-x":`${activeShot?.bowlerX??48.5}%`} as CSSProperties}><span>B</span><small>{surname(bowler?.name)}</small></div>
            <div className={`${styles.batterMarker} ${runOutRunnersActive?styles.runOutNonStriker:runnersActive&&activeShot?.batRuns?styles[`runnerNonStriker${activeShot.batRuns}`]:""}`} style={{left:"51.8%",top:"40.5%","--running-duration":`${(activeShot?.runningDuration??3050)/speed}ms`} as CSSProperties}><span style={{color:battingTeam.primaryColor}}>▲</span><b>{surname(nonStriker?.name)}</b></div>
            <div className={`${styles.batterMarker} ${runOutRunnersActive?styles.runOutStriker:runnersActive&&activeShot?.batRuns?styles[`runnerStriker${activeShot.batRuns}`]:""} ${hitWicketAnimation?styles.hitWicketBatter:""}`} style={{left:"50%",top:"59%","--running-duration":`${(activeShot?.runningDuration??3050)/speed}ms`,"--hit-wicket-shift":renderedLhb?"-5px":"5px"} as CSSProperties}><span style={{color:battingTeam.primaryColor}}>▲</span><b>{surname(striker?.name)} <small>{renderedLhb?"LHB":"RHB"}</small></b></div>
            <div className={`${styles.fielder} ${keeperReceiving?styles.receivingFielder:""} ${activeShot?.phase==="stumping"||activeShot?.phase==="missed-stumping-attempt"?styles.stumpingFielder:""} ${activeShot?.phase==="wide-collected"||activeShot?.phase==="no-ball-collected"?styles.wideKeeper:""} ${activeShot&&["wide-missed","wide-running","wide-boundary"].includes(activeShot.phase)?styles.missedWideKeeper:""} ${keepingErrorAnimation?styles.keepingErrorKeeper:""} ${missedRunOutAtStumps?styles.missedRunOutFielder:""} ${successfulRunOutAtStumps?styles.runOutFielder:""}`} style={{left:`${keeperX}%`,top:`${keeperY}%`,"--receiver-duration":`${stumpingAnimation||missedStumpingAnimation||keepingErrorAnimation||wideAnimation||noBallTakeAnimation?300/speed:missedRunOutAnimation||successfulRunOutAnimation?Math.max(180,(activeShot?.throwDuration??700)/speed):Math.max(250,(activeShot?.shotDuration??700)/speed)}ms`} as CSSProperties}><span>WK</span><b>KEEPER</b><small>{surname(keeper?.name)}</small></div>
            {fieldPositions.map((position, index) => {
              const gathering = Boolean(
                activeShot
                && activeShot.fielderCollects
                && activeShot.phase !== "bowled"
                && ["shot", "bye", "leg-bye", "wide-running", "keeper-error-spill", "missed-stumping-spill", "dropped-catch", "catch-spill", "catch-held", "misfield-stop", "misfield-bobble", "missed-run-out-throw", "missed-run-out-miss", "missed-run-out-safe", "run-out-throw", "run-out-wicket", "fielded", "throw", "received"].includes(activeShot.phase)
                && activeShot.closestFielderIdx === index
              );
              const renderedPosition = clampInsideBoundary(
                gathering ? activeShot!.ballHitX : renderedLhb ? 100 - position.x : position.x,
                gathering ? activeShot!.ballHitY : position.y
              );
              const offending = (outsideCount > maxOutside && isOutsideThirtyYardCircle(position))
                || (legBehind > 2 && isLegSideBehindSquare(position));
              return (
                <div
                  key={position.id}
                  className={`${styles.fielder} ${activeRole === "bowling" && !activeShot ? styles.draggableFielder : ""} ${gathering ? styles.gatheringFielder : ""} ${gathering && activeShot?.phase === "misfield-stop" ? styles.misfieldAttemptFielder : ""} ${gathering && activeShot?.phase === "catch-held" ? styles.catchingFielder : ""} ${offending ? styles.isOffendingFielder : ""}`}
                  style={{
                    left: `${renderedPosition.x}%`,
                    top: `${renderedPosition.y}%`,
                    "--fielding-duration": `${activeShot?.phase === "catch-spill" ? 600 / speed : activeShot?.phase === "misfield-bobble" ? 620 / speed : Math.max(300, (activeShot?.shotDuration ?? 700) / speed)}ms`,
                  } as CSSProperties}
                  onPointerDown={activeRole === "bowling" && !activeShot ? (event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDraggingIndex(index);
                  } : undefined}
                  onPointerMove={(event) => moveFielder(index, event)}
                  onPointerUp={() => setDraggingIndex(null)}
                  onPointerCancel={() => setDraggingIndex(null)}
                >
                  <span>{index + 1}</span>
                  <b>{position.label}</b>
                  <small>{surname(outfielders[index]?.name)}</small>
                </div>
              );
            })}
            {activeShot&&["shot","fielded"].includes(activeShot.phase)&&[4,6].includes(activeShot.delivery.runsOffBat)&&<div className={`${styles.boundaryFlash} ${activeShot.delivery.runsOffBat===6?styles.sixFlash:styles.fourFlash}`}><strong>{activeShot.delivery.runsOffBat===6?"SIX":"FOUR"}</strong><span>{activeShot.delivery.runsOffBat===6?"OUT OF THE GROUND":"TO THE BOUNDARY"}</span></div>}
            {activeShot&&activeShot.phase==="wide-boundary"&&<div className={`${styles.boundaryFlash} ${styles.wideBoundaryFlash}`}><strong>5 WIDES</strong><span>TO THE BOUNDARY</span></div>}
            {activeShot&&activeShot.delivery.extras.byes>=4&&["bye","fielded","keeper-error-boundary"].includes(activeShot.phase)&&<div className={`${styles.boundaryFlash} ${styles.extraBoundaryFlash}`}><strong>FOUR BYES</strong><span>PAST THE KEEPER</span></div>}
            {activeShot&&activeShot.delivery.extras.legByes>=4&&["leg-bye","fielded"].includes(activeShot.phase)&&<div className={`${styles.boundaryFlash} ${styles.extraBoundaryFlash}`}><strong>FOUR LEG BYES</strong><span>TO THE BOUNDARY</span></div>}
            {activeShot&&activeShot.delivery.extras.wides>0&&!(["runup","delivery","wide-boundary"].includes(activeShot.phase))&&<div className={styles.wideFlash}>{activeShot.delivery.extras.wides===1?"WIDE":`${activeShot.delivery.extras.wides} WIDES`}</div>}
            {activeShot&&activeShot.delivery.extras.noBalls>0&&!(["runup","delivery"].includes(activeShot.phase))&&<div className={styles.noBallFlash}>NO BALL</div>}
            {activeShot&&activeShot.delivery.fieldingEvent?.kind==="dropped-catch"&&["dropped-catch","catch-spill"].includes(activeShot.phase)&&<div className={styles.droppedCatchFlash}>DROPPED</div>}
            {activeShot&&activeShot.delivery.fieldingEvent?.kind==="misfield"&&["misfield-stop","misfield-bobble"].includes(activeShot.phase)&&<div className={styles.misfieldFlash}>MISFIELD</div>}
            {activeShot&&activeShot.delivery.fieldingEvent?.kind==="missed-run-out"&&["missed-run-out-miss","missed-run-out-safe"].includes(activeShot.phase)&&<div className={styles.missedRunOutFlash}>MISSED RUN OUT</div>}
            {activeShot&&successfulRunOutAtStumps&&<div className={styles.runOutFlash}>RUN OUT</div>}
            {activeShot&&successfulCatchAtFielder&&<div className={styles.caughtFlash}>CAUGHT</div>}
            {activeShot&&activeShot.delivery.wicket&&(activeShot.delivery.wicket.kind==="run-out"?activeShot.phase==="run-out-wicket":activeShot.delivery.wicket.kind==="caught"?activeShot.phase==="catch-held":["bowled","lbw","hit-wicket-out","shot","bye","leg-bye","fielded","stumped","wide-collected"].includes(activeShot.phase))&&<div className={`${styles.wicketBurst} ${successfulRunOutAtStumps?styles.runOutBurst:""} ${successfulCatchAtFielder?styles.catchBurst:""}`} style={successfulCatchAtFielder?{left:`${activeShot.ballHitX}%`,top:`${activeShot.ballHitY}%`}:undefined}/>}</div><div className={styles.fieldCaption}><span className={fieldDelivery?.wicket?styles.wicketTag:""}>{fieldDelivery?.resultCode??"READY"}</span><p>{fieldDelivery?.commentary??`${bowler?.name} has the ball. Set your approach and start the match.`}</p></div></div>
          <div className={styles.lowerTelemetry}>{target?<><div><small>Chase Equation</small><strong>{battingTeam.shortName} need {runsNeeded} in {ballsRemaining}b</strong><span><i style={{width:`${Math.min(100,((currentInnings?.runs??0)/target)*100)}%`,background:battingTeam.primaryColor}}/></span></div><div><small>Required Rate</small><strong>RRR {requiredRunRate}</strong></div><div><small>Target Score</small><strong>{target} runs</strong><span>CRR {currentRunRate}</span></div></>:<><div><small>Current rate</small><strong>{battingTeam.shortName} {currentRunRate}</strong><span><i style={{width:`${Math.min(100,Number(currentRunRate)*7)}%`,background:battingTeam.primaryColor}}/></span></div><div><small>Momentum</small><strong>{lastDelivery?.wicket?bowlingTeam.shortName:(lastDelivery?.runsOffBat??0)>=4?battingTeam.shortName:"EVEN"}</strong></div><div><small>Last 12 balls</small><strong>{visible.slice(-12).reduce((sum,delivery)=>sum+delivery.totalRuns,0)} runs</strong><span>{visible.slice(-12).filter((delivery)=>delivery.wicket).length} wickets</span></div></>}</div>
        </section>

        <aside className={styles.rightRail}><section className={`${styles.panel} ${styles.feedPanel}`}><div className={styles.panelHeading}><span><Activity size={14}/> Live Match Feed</span><b>{visible.length}</b></div><div className={`${styles.feed} h-[312px] max-h-[312px] overflow-y-auto`}>{inningsDeliveries.length===0&&<div className={styles.emptyFeed}>The next ball will appear here.</div>}{inningsDeliveries.map((delivery,index)=><article key={delivery.id} className={`${styles.careerFeedRow} border-b border-white/10 ${delivery.wicket?"border-l-2 border-l-red-500 bg-red-500/10":index===0?"bg-white/5":""}`}><div className="w-[46px] shrink-0 border-r border-white/15 pr-2 text-center"><time className="text-[9px] text-white/50">{delivery.displayBall}</time><span className={`mt-1 block rounded px-1 text-[9.5px] font-black ${delivery.wicket?"bg-red-600":delivery.runsOffBat>=4?"bg-yellow-400 text-black":"bg-white/10"}`}>{delivery.resultCode}</span></div><p className={`${styles.careerFeedText} m-0 text-[10px] leading-normal text-white/90`}>{delivery.commentary}</p></article>)}</div></section><section className={styles.panel}><div className={styles.panelHeading}><span><Users size={14}/> {activeRole==="batting"?"Batting XI & Dugout":"Opponent Batters"}</span></div><div className="max-h-[235px] overflow-y-auto">{battingXI.map((player,index)=>{const line=batterFigures(visible,player.id);const crease=player.id===striker?.id||player.id===nonStriker?.id;return <div key={player.id} className={`flex items-center justify-between border-b border-white/10 px-1 py-1.5 text-[10px] ${line.out?"opacity-40":crease?"text-yellow-300":""}`}><span>{index+1}. {player.name}</span><span className="font-mono">{line.out?`${line.runs} OUT`:line.balls?`${line.runs}${crease?"*":""} (${line.balls})`:"Yet to bat"}</span></div>})}</div></section></aside>
      </section>

      <footer className="relative z-20 flex h-[72px] items-center justify-center overflow-hidden border-t border-white/15 bg-black font-[family-name:var(--font-bricolage)]" style={{background:`linear-gradient(90deg,${battingTeam.primaryColor} 0 45%,#040508 50%,${bowlingTeam.primaryColor} 55%)`}}><div className="flex h-full items-center"><div className="flex h-full items-center gap-5 px-5" style={{backgroundColor:battingTeam.primaryColor}}><div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-yellow-400 font-extrabold">{battingTeam.shortName}</div><div><strong className="text-xl">{battingTeam.shortName}</strong><small className="block">v {bowlingTeam.shortName}</small></div><strong className="text-2xl" style={{color:battingTeam.secondaryColor}}>{currentInnings?.runs??0}-{currentInnings?.wickets??0}</strong>{isPowerplay&&<b className="bg-yellow-400 px-1.5 text-black">PP</b>}<div className="flex min-w-[52px] flex-col items-center justify-center leading-none"><strong>{overs(currentInnings?.legalBalls??0)}</strong><small className="mt-1 whitespace-nowrap text-[8px] font-bold tracking-wide opacity-75">{matchHashtag}</small></div><div className="min-w-[230px] border-l border-white/40 pl-5">{creaseCards.slice(0,2).map(({player,line,strike})=><div key={player.id} className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-baseline text-lg font-black"><span className="text-center">{strike?">":""}</span><span className="truncate">{surname(player.name).toUpperCase()}</span><span>{line.runs} <small>{line.balls}</small></span></div>)}</div></div><div className="flex h-full min-w-[85px] flex-col items-center justify-center bg-[#040508] px-3"><small>{target?"RRR":"CRR"}</small><strong>{target?requiredRunRate:currentRunRate}</strong></div><div className="flex h-full items-center gap-4 px-5" style={{backgroundColor:bowlingTeam.primaryColor}}><div className="min-w-[250px] text-right"><div><b>{surname(bowler?.name).toUpperCase()}</b> {activeBowlerLine.wickets}-{activeBowlerLine.runs} ({overs(activeBowlerLine.balls)})</div><div className="mt-1 flex justify-end gap-1">{bowlerDeliverySlots.map((delivery,index)=><span key={delivery?.id??`blank-${index}`} className={`flex h-4 min-w-4 items-center justify-center border px-1 text-[9px] font-black ${!delivery?"border-white/35 bg-white/10 text-transparent":delivery.wicket?"border-red-600 bg-red-600":delivery.runsOffBat>=4?"border-yellow-400 bg-yellow-400 text-black":"border-white bg-white text-black"}`}>{delivery?.resultCode??"·"}</span>)}</div></div><div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-yellow-400 font-extrabold">{bowlingTeam.shortName}</div></div></div></footer>

      {awaitingToss && <div className={styles.modalBackdrop}>
        <section className={styles.setupModal}>
          {!tossCeremonyStarted && progress.awaitingTossCall ? <>
            <div className={styles.modalHeader}><div><small>MATCH TOSS</small><h2>Ready for the toss</h2></div></div>
            <p className="mb-4 text-sm text-white/65">The captains are in the middle. Start the toss, then call heads or tails.</p>
            <button className={styles.confirmButton} onClick={() => setTossCeremonyStarted(true)}>Do Toss</button>
          </> : progress.awaitingTossCall ? <>
            <div className={styles.modalHeader}><div><small>CALL THE COIN</small><h2>Heads or tails?</h2></div></div>
            <p className="mb-4 text-sm text-white/65">Make your call before the coin lands.</p>
            <div className="grid grid-cols-2 gap-3">
              <button className={styles.confirmButton} onClick={() => makeTossCall("heads")}>Heads</button>
              <button className={styles.confirmButton} onClick={() => makeTossCall("tails")}>Tails</button>
            </div>
          </> : progress.awaitingTossDecision ? <>
            <div className={styles.modalHeader}><div><small>{progress.tossResult?.toUpperCase()}</small><h2>You won the toss</h2></div></div>
            <p className={styles.tossResult}>You called <strong>{progress.tossCall}</strong>. The coin landed <strong>{progress.tossResult}</strong>.</p>
            <p className="mb-4 text-sm text-white/65">{input.conditions.pitch.name} · expected score {input.conditions.adjustedExpectedScore.min}–{input.conditions.adjustedExpectedScore.max}</p>
            <div className="grid grid-cols-2 gap-3">
              <button className={styles.confirmButton} onClick={() => chooseTossDecision("bat")}>Bat first</button>
              <button className={styles.confirmButton} onClick={() => chooseTossDecision("bowl")}>Bowl first</button>
            </div>
          </> : <>
            <div className={styles.modalHeader}><div><small>{progress.tossResult?.toUpperCase()}</small><h2>{tossWinner?.name ?? "The opposition"} won the toss</h2></div></div>
            <p className={styles.tossResult}>You called <strong>{progress.tossCall}</strong>. The coin landed <strong>{progress.tossResult}</strong>.</p>
            <p className="mb-4 text-sm text-white/65">{tossWinner?.name ?? "The opposition"} elected to <strong className="text-white">{progress.tossDecision === "bat" ? "bat first" : "bowl first"}</strong>.</p>
            <button className={styles.confirmButton} onClick={acknowledgeLostToss}>Continue to match</button>
          </>}
        </section>
      </div>}
      {showImpact&&<div className={styles.modalBackdrop}><section className={`${styles.setupModal} ${styles.impactModal}`}><div className={styles.modalHeader}><div><small>IMPACT PLAYER</small><h2>Make Impact Sub</h2></div><button onClick={()=>setShowImpact(false)}><X size={19}/></button></div><p className="mb-3 text-xs text-white/60">{progress.impactRecommendation?.explanation??"Choose a player swap to activate from the next delivery."}</p><label>Incoming player</label><select value={impactIncoming} onChange={(event)=>setImpactIncoming(event.target.value)}><option value="">Select player</option>{impactIncomingOptions.map((player)=><option key={player.id} value={player.id}>{player.name}</option>)}</select><label>Outgoing player</label><select value={impactOutgoing} onChange={(event)=>setImpactOutgoing(event.target.value)}><option value="">Select player</option>{impactOutgoingOptions.map((player)=><option key={player.id} value={player.id}>{player.name}</option>)}</select><div className="mt-4 grid grid-cols-2 gap-3"><button className={styles.confirmButton} disabled={!impactIncoming||!impactOutgoing} onClick={()=>setImpact({use:true,incomingPlayerId:impactIncoming,outgoingPlayerId:impactOutgoing,battingPosition:progress.impactRecommendation?.battingPosition})}>Confirm sub</button><button className={styles.confirmButton} onClick={()=>setImpact({use:false})}>Do not use</button></div></section></div>}
      {showScoreboard && <div className={`${styles.modalBackdrop} overflow-y-auto p-4 py-10`} onMouseDown={() => setShowScoreboard(false)}>
        <section className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded border-2 border-border bg-surface text-left font-barlow text-text-primary shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between border-b-2 border-accent bg-[#16130f] p-5 dark:bg-[#0f1420]">
            <div>
              <span className="font-space-mono text-[9px] font-bold uppercase text-accent">MATCH CENTRE · LIVE SCORECARD</span>
              <h3 className="mt-0.5 font-anton text-[24px] uppercase leading-tight text-white">
                {input.teamA.name} vs {input.teamB.name}
              </h3>
            </div>
            <button onClick={() => setShowScoreboard(false)} className="flex h-8 w-8 items-center justify-center rounded border border-white/30 bg-white/10 text-white transition-colors hover:bg-white/20">
              <X size={16}/>
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            <div className="flex items-center justify-between rounded border border-border bg-[#16130f]/5 p-4 text-center">
              {[input.teamA, input.teamB].map((team, index) => {
                const innings = liveScoreForTeam(team.id);
                return <div key={team.id} className="contents">
                  {index === 1 && <div className="px-4 font-anton text-[20px] font-bold text-text-secondary">VS</div>}
                  <div className="flex-1">
                    <div className="font-anton text-[18px] text-text-primary">{team.shortName}</div>
                    <div className="mt-1 font-anton text-[28px] text-accent">{innings?.runs ?? 0}/{innings?.wickets ?? 0}</div>
                    <div className="mt-1 font-space-mono text-[9px] text-text-secondary">{overs(innings?.legalBalls ?? 0)} Overs</div>
                  </div>
                </div>;
              })}
            </div>

            <div className="border border-success/15 bg-success/5 py-2.5 text-center font-anton text-[16px] uppercase tracking-wide text-success">
              LIVE · {battingTeam.shortName} {currentInnings?.runs ?? 0}/{currentInnings?.wickets ?? 0} after {overs(currentInnings?.legalBalls ?? 0)} overs
            </div>

            <div className="flex flex-wrap gap-2 border-b border-[#16130f]/10 pb-3">
              {[input.teamA, input.teamB].map((team) => {
                const selected = scoreboardTeamId === team.id;
                return <button key={team.id} type="button" onClick={() => setScoreboardTeamId(team.id)} aria-pressed={selected} className={`rounded border px-4 py-2 font-space-mono text-[9px] font-bold uppercase transition-colors ${selected ? "border-accent bg-accent text-white" : "border-border bg-surface text-text-secondary hover:border-accent hover:text-text-primary"}`}>
                  {team.name}
                </button>;
              })}
            </div>

            <div>
              <h4 className="mb-3 border-l-4 border-accent pl-2 font-anton text-[13px] uppercase text-text-primary">{teams[scoreboardTeamId]?.name} Batting</h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] divide-y divide-[#16130f]/10 text-left font-barlow text-xs">
                  <thead className="bg-[#16130f]/5 font-space-mono text-[8px] uppercase text-text-secondary">
                    <tr><th className="px-4 py-2">Batsman</th><th className="px-4 py-2 text-center">Runs</th><th className="px-4 py-2 text-center">Balls</th><th className="px-4 py-2 text-center">4s</th><th className="px-4 py-2 text-center">6s</th><th className="px-4 py-2 text-right">SR</th></tr>
                  </thead>
                  <tbody>
                    {scoreboardBattingRows.map(({ player, figures, dismissal }) => <tr key={player.id} className="border-b border-[#16130f]/5">
                      <td className="px-4 py-2"><div className="flex items-center gap-2 font-semibold"><span>{player.name}</span>{impactChoice?.incomingPlayerId === player.id && <span className="rounded bg-success/10 px-1.5 py-0.5 font-space-mono text-[7px] font-bold uppercase text-success">→ In</span>}{impactChoice?.outgoingPlayerId === player.id && <span className="rounded bg-red-500/10 px-1.5 py-0.5 font-space-mono text-[7px] font-bold uppercase text-red-700">← Out</span>}</div><div className="mt-0.5 font-space-mono text-[7px] text-text-secondary">{dismissal}</div></td>
                      <td className="px-4 py-2 text-center font-bold text-text-primary">{figures.runs}</td><td className="px-4 py-2 text-center font-space-mono text-text-secondary">{figures.balls}</td><td className="px-4 py-2 text-center font-space-mono text-text-secondary">{figures.fours}</td><td className="px-4 py-2 text-center font-space-mono text-text-secondary">{figures.sixes}</td><td className="px-4 py-2 text-right font-space-mono text-text-secondary">{(figures.runs / Math.max(1, figures.balls) * 100).toFixed(1)}</td>
                    </tr>)}
                    {scoreboardBattingRows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center font-space-mono text-[9px] uppercase text-text-secondary">Innings has not started</td></tr>}
                  </tbody>
                  <tfoot className="font-space-mono text-[9px] font-bold"><tr className="border-t border-border"><td className="px-4 py-2 uppercase">Extras</td><td className="px-4 py-2 text-center">{scoreboardExtras}</td><td colSpan={4} className="px-4 py-2 text-right uppercase">Total {scoreboardInnings?.runs ?? 0}/{scoreboardInnings?.wickets ?? 0}</td></tr></tfoot>
                </table>
              </div>
            </div>

            <div>
              <h4 className="mb-3 border-l-4 border-accent pl-2 font-anton text-[13px] uppercase text-text-primary">{teams[scoreboardBowlingTeamId]?.name} Bowling</h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] divide-y divide-[#16130f]/10 text-left font-barlow text-xs">
                  <thead className="bg-[#16130f]/5 font-space-mono text-[8px] uppercase text-text-secondary"><tr><th className="px-4 py-2">Bowler</th><th className="px-4 py-2 text-center">Overs</th><th className="px-4 py-2 text-center">M</th><th className="px-4 py-2 text-center">Wickets</th><th className="px-4 py-2 text-center">Runs</th><th className="px-4 py-2 text-center">WD/NB</th><th className="px-4 py-2 text-right">Econ</th></tr></thead>
                  <tbody>
                    {scoreboardBowlingRows.map(({ player, figures }) => <tr key={player.id} className="border-b border-[#16130f]/5"><td className="px-4 py-2 font-semibold"><span className="inline-flex items-center gap-2"><span>{player.name}</span>{impactChoice?.incomingPlayerId === player.id && <span className="rounded bg-success/10 px-1.5 py-0.5 font-space-mono text-[7px] font-bold uppercase text-success">→ In</span>}{impactChoice?.outgoingPlayerId === player.id && <span className="rounded bg-red-500/10 px-1.5 py-0.5 font-space-mono text-[7px] font-bold uppercase text-red-700">← Out</span>}</span></td><td className="px-4 py-2 text-center font-space-mono">{overs(figures.balls)}</td><td className="px-4 py-2 text-center font-space-mono">{figures.maidens}</td><td className="px-4 py-2 text-center font-space-mono font-bold text-purple-700">{figures.wickets}</td><td className="px-4 py-2 text-center font-space-mono">{figures.runs}</td><td className="px-4 py-2 text-center font-space-mono">{figures.wides}/{figures.noBalls}</td><td className="px-4 py-2 text-right font-space-mono">{figures.balls ? (figures.runs * 6 / figures.balls).toFixed(2) : "0.00"}</td></tr>)}
                    {scoreboardBowlingRows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center font-space-mono text-[9px] uppercase text-text-secondary">No bowling figures yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>}
      {awaitingBatterSelection&&wicketBatterDecisionKey&&lastDelivery?.wicket&&<div className={styles.modalBackdrop}><section className={styles.setupModal}><div className={styles.modalHeader}><div><small>WICKET FALLEN</small><h2>Choose the next batter</h2></div></div><p className="mb-3 text-sm text-white/65"><strong className="text-white">{lastDelivery.wicket.playerName}</strong> is out. Play is paused until you confirm who comes in next.</p><label>Incoming batter</label><select value={session.decisions.batterByWicket[wicketBatterDecisionKey]??""} onChange={(event)=>setNextBatterDecision(wicketBatterDecisionKey,event.target.value)}><option value="">Automatic: {automaticBatterLabel}</option>{wicketBatterOptions.map((player)=><option key={player.id} value={player.id}>{player.name}</option>)}</select><button className={`${styles.confirmButton} mt-4 w-full`} onClick={confirmWicketBatter}>Confirm next batter</button></section></div>}
    </main>
  );
}
