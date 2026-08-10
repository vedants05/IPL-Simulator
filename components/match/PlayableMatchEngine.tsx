"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Activity, ChevronDown, Gauge, Pause, Play, Shield, SkipForward, Target, UserPlus, Users, X, Zap } from "lucide-react";
import {
  simulatePlayableMatch,
  type MatchDelivery,
  type MatchSimulationInput,
  type MatchSimulationRecord,
  type PlayableBattingApproach,
  type PlayableBowlingPlan,
  type PlayableFieldPlan,
  type PlayableImpactChoice,
  type PlayableMatchDecisions,
  type PlayableSkipKind,
} from "@/lib/logic/matchSimulation";
import type { Player, Team } from "@/lib/types";
import styles from "@/app/sandbox/sandbox.module.css";

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

type FieldPosition = { id: number; label: string; x: number; y: number };
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

const DEFAULT_FIELD: FieldPosition[] = [
  { id: 0, label: "Slip 1", x: 56.5, y: 69 }, { id: 1, label: "Point", x: 73, y: 56 },
  { id: 2, label: "Cover", x: 67, y: 44 }, { id: 3, label: "Mid off", x: 57, y: 39 },
  { id: 4, label: "Mid on", x: 43, y: 39 }, { id: 5, label: "Square leg", x: 26, y: 56 },
  { id: 6, label: "Fine leg", x: 35, y: 76 }, { id: 7, label: "Third man", x: 72, y: 77 },
  { id: 8, label: "Deep midwicket", x: 27, y: 33 },
];
const FIELD_PRESETS: Record<string, FieldPosition[]> = {
  "Standard T20": DEFAULT_FIELD,
  "Attacking Slips": [
    { id: 0, label: "Slip 1", x: 56, y: 69 }, { id: 1, label: "Slip 2", x: 59, y: 67 },
    { id: 2, label: "Gully", x: 63, y: 64 }, { id: 3, label: "Point", x: 72, y: 56 },
    { id: 4, label: "Cover", x: 65, y: 44 }, { id: 5, label: "Mid off", x: 56, y: 39 },
    { id: 6, label: "Mid on", x: 44, y: 39 }, { id: 7, label: "Square leg", x: 28, y: 56 },
    { id: 8, label: "Fine leg", x: 35, y: 76 },
  ],
  "Boundary Guard": [
    { id: 0, label: "Deep point", x: 80, y: 55 }, { id: 1, label: "Deep cover", x: 76, y: 32 },
    { id: 2, label: "Long off", x: 68, y: 22 }, { id: 3, label: "Long on", x: 32, y: 22 },
    { id: 4, label: "Deep midwicket", x: 22, y: 34 }, { id: 5, label: "Deep square", x: 20, y: 56 },
    { id: 6, label: "Fine leg", x: 34, y: 76 }, { id: 7, label: "Third man", x: 72, y: 77 },
    { id: 8, label: "Cover", x: 66, y: 44 },
  ],
};
const SPEEDS = [1, 2, 4, 8] as const;
const surname = (name = "Player") => name.split(" ").at(-1) ?? name;
const overs = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;
const hash = (value: string) => Array.from(value).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 7);
const isKeeper = (player?: Player) => Boolean(player && (player.role === "WK-Batsman" || player.isWicketkeeper || player.isPartTimeWk));
const isBowler = (player?: Player) => Boolean(player && player.currentBowling >= 45 && player.role !== "WK-Batsman");
const cloneDecisions = (decisions: PlayableMatchDecisions): PlayableMatchDecisions => ({
  ...decisions,
  deliveryControls: { ...decisions.deliveryControls }, bowlerByOver: { ...decisions.bowlerByOver },
  batterByWicket: { ...decisions.batterByWicket }, impactByTeam: { ...(decisions.impactByTeam ?? {}) },
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

export default function PlayableMatchEngine({ input, userTeamId, session, onSessionChange, onComplete }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [battingApproach, setBattingApproach] = useState<PlayableBattingApproach>("balanced");
  const [batterApproaches, setBatterApproaches] = useState<Record<string, PlayableBattingApproach>>({});
  const [fieldPlan, setFieldPlan] = useState<PlayableFieldPlan>("balanced");
  const [bowlingPlan, setBowlingPlan] = useState<PlayableBowlingPlan>("good-length");
  const [shotZone, setShotZone] = useState("360° All Ground");
  const [fieldPositions, setFieldPositions] = useState<FieldPosition[]>(DEFAULT_FIELD);
  const [activePreset, setActivePreset] = useState("Standard T20");
  const [showZoneOverlay, setShowZoneOverlay] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [activeShot, setActiveShot] = useState<ActiveShot | null>(null);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const [impactIncoming, setImpactIncoming] = useState("");
  const [impactOutgoing, setImpactOutgoing] = useState("");
  const stadiumRef = useRef<HTMLDivElement>(null);
  const timeouts = useRef<number[]>([]);

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
  const strikerLine = batterFigures(visible, striker?.id);
  const nonStrikerLine = batterFigures(visible, nonStriker?.id);
  const activeBowlerLine = bowlerFigures(visible, bowler?.id);
  const creaseCards = [
    { player: striker, line: strikerLine, strike: true },
    { player: nonStriker, line: nonStrikerLine, strike: false },
  ];
  const dismissedIds = new Set(visible.flatMap((delivery) => delivery.wicket?.playerId ? [delivery.wicket.playerId] : []));
  const remainingBatters = [...battingPlan.startingXI, ...battingPlan.impactSubs]
    .map((id) => input.players[id]).filter((player): player is Player => Boolean(player) && !dismissedIds.has(player.id) && player.id !== striker?.id && player.id !== nonStriker?.id);
  const bowlingOptions = bowlingXI.filter(isBowler);
  const partnershipStart = visible.findLastIndex((delivery) => Boolean(delivery.wicket));
  const partnershipRuns = visible.slice(partnershipStart + 1).reduce((total, delivery) => total + delivery.totalRuns, 0);
  const currentOver = visible.filter((delivery) => delivery.overNumber === (lastDelivery?.overNumber ?? 1));
  const isPowerplay = (currentInnings?.legalBalls ?? 0) < 36;
  const maxOutside = isPowerplay ? 2 : 5;
  const outsideCount = fieldPositions.filter((position) => Math.hypot(position.x - 50, position.y - 50) > 29.5).length;
  const legBehind = fieldPositions.filter((position) => position.x < 50 && position.y > 56).length;
  const renderedLhb = striker?.battingStyle === "Left-hand";
  const target = currentInnings?.target;
  const maxBalls = (progress.simulation?.conditions.weather.secondInningsOvers ?? 20) * 6;
  const ballsRemaining = Math.max(0, maxBalls - (currentInnings?.legalBalls ?? 0));
  const runsNeeded = target ? Math.max(0, target - (currentInnings?.runs ?? 0)) : 0;
  const currentRunRate = currentInnings?.legalBalls ? ((currentInnings.runs * 6) / currentInnings.legalBalls).toFixed(2) : "0.00";
  const requiredRunRate = target && ballsRemaining ? ((runsNeeded * 6) / ballsRemaining).toFixed(2) : "0.00";

  const updateDecisions = (decisions: PlayableMatchDecisions, revealedDeliveries = session.revealedDeliveries) => onSessionChange({ ...session, decisions, revealedDeliveries });
  const decisionsWithControl = () => {
    const decisions = cloneDecisions(session.decisions);
    const candidate = simulatePlayableMatch(input, userTeamId, decisions, session.revealedDeliveries).nextDelivery;
    if (candidate) decisions.deliveryControls[candidate.id] = userIsBatting
      ? { battingApproach: batterApproaches[candidate.strikerId] ?? battingApproach }
      : { fieldPlan, bowlingPlan };
    return decisions;
  };
  const skip = (kind: PlayableSkipKind) => {
    if (activeShot || progress.awaitingTossDecision || progress.awaitingImpactDecision || progress.complete) return;
    const decisions = cloneDecisions(session.decisions);
    let revealedDeliveries = session.revealedDeliveries;
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
        ? { battingApproach: batterApproaches[candidate.strikerId] ?? battingApproach }
        : { fieldPlan, bowlingPlan };
      revealedDeliveries += 1;
      if (kind === "ball") break;
    }

    updateDecisions(decisions, revealedDeliveries);
  };
  const later = (callback: () => void, delay: number) => {
    const id = window.setTimeout(callback, Math.max(35, Math.round(delay / speed)));
    timeouts.current.push(id);
  };
  const playNextDelivery = () => {
    if (activeShot || progress.awaitingTossDecision || progress.awaitingImpactDecision || progress.complete) return;
    const decisions = decisionsWithControl();
    const controlled = simulatePlayableMatch(input, userTeamId, decisions, session.revealedDeliveries);
    const delivery = controlled.nextDelivery;
    if (!delivery) return;
    const roll = hash(`${delivery.id}:${shotZone}`);
    const isFour = delivery.runsOffBat === 4;
    const isSix = delivery.runsOffBat === 6;
    const boundary = isFour || isSix;
    const bowled = delivery.wicket?.kind === "bowled";
    const shotTargets = shotZone === "Offside Gaps"
      ? [{ x: 88, y: 55 }, { x: 78, y: 28 }, { x: 65, y: 16 }, { x: 74, y: 80 }]
      : shotZone === "V & Straight"
        ? [{ x: 44, y: 12 }, { x: 56, y: 12 }, { x: 38, y: 22 }, { x: 62, y: 22 }]
        : shotZone === "Legside Power"
          ? [{ x: 12, y: 55 }, { x: 22, y: 28 }, { x: 35, y: 16 }, { x: 28, y: 80 }]
          : [{ x: 12, y: 55 }, { x: 22, y: 25 }, { x: 50, y: 12 }, { x: 78, y: 25 }, { x: 88, y: 55 }, { x: 70, y: 80 }, { x: 30, y: 80 }];
    const logicalTarget = shotTargets[roll % shotTargets.length];
    const targetX = logicalTarget.x - 50;
    const targetY = logicalTarget.y - 50;
    const targetMagnitude = Math.max(1, Math.hypot(targetX, targetY));
    const boundaryRadius = isSix ? 62 : 48.5;
    const travelScale = delivery.runsOffBat >= 2 ? 0.86 : delivery.runsOffBat === 1 ? 0.58 : 0.4;
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
    const fielderCollects = Boolean(!bowled && !boundary && (
      delivery.runsOffBat > 0
      || outfielderEvent
      || outfielderWicket
    ));

    if (fielderCollects && delivery.runsOffBat >= 2 && delivery.runsOffBat < 4) {
      const deepFielders = fieldPositions
        .map((position, index) => ({
          index,
          x: deliveryIsLeftHanded ? 100 - position.x : position.x,
          y: position.y,
          depth: Math.hypot(position.x - 50, position.y - 50),
        }))
        .filter(({ depth }) => depth > 29.5);
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
    const shot: ActiveShot = { delivery, phase: "runup", fielderCollects, batRuns: Math.min(3, delivery.runsOffBat), ballX: 48.5, ballY: 42, ballHitX: hitX, ballHitY: hitY, bowlerX: 48.5, closestFielderIdx, receiverX: 50, receiverY: 61.2, releaseDelay: 680, deliveryDuration: 360, runningDuration, shotDuration: isSix ? 2600 : isFour ? 1350 : Math.max(800, runningDuration * .68), throwDuration: 700 };
    setActiveShot(shot);
    later(() => setActiveShot((current) => current ? { ...current, phase: "delivery", ballX: 50, ballY: 58 } : current), 680);
    if (bowled) {
      later(() => setActiveShot((current) => current ? { ...current, phase: "bowled", ballX: 50, ballY: 61 } : current), 1040);
      later(() => { updateDecisions(decisions, session.revealedDeliveries + 1); setActiveShot(null); }, 1540);
      return;
    }
    later(() => setActiveShot((current) => current ? { ...current, phase: "shot", ballX: hitX, ballY: hitY } : current), 1040);
    later(() => setActiveShot((current) => current ? { ...current, phase: "fielded" } : current), 1040 + shot.shotDuration);
    const needsThrow = fielderCollects && !boundary && (delivery.totalRuns > 0 || delivery.fieldingEvent || delivery.wicket?.kind === "run-out");
    if (needsThrow) later(() => setActiveShot((current) => current ? { ...current, phase: "throw", ballX: 50, ballY: 61.2 } : current), 1160 + shot.shotDuration);
    const finishAt = 1260 + shot.shotDuration + (needsThrow ? shot.throwDuration : 0);
    later(() => { updateDecisions(decisions, session.revealedDeliveries + 1); setActiveShot(null); }, finishAt);
  };

  useEffect(() => () => timeouts.current.forEach(window.clearTimeout), []);
  useEffect(() => {
    if (!isPlaying || activeShot || progress.complete || progress.awaitingTossDecision || progress.awaitingImpactDecision) return;
    const id = window.setTimeout(playNextDelivery, 180 / speed);
    return () => window.clearTimeout(id);
  });
  useEffect(() => { if (progress.complete && progress.simulation) { setIsPlaying(false); onComplete(progress.simulation); } }, [onComplete, progress.complete, progress.simulation]);
  useEffect(() => {
    if (!progress.awaitingImpactDecision) return;
    setImpactIncoming(progress.impactRecommendation?.incomingPlayerId ?? "");
    setImpactOutgoing(progress.impactRecommendation?.outgoingPlayerId ?? "");
    setShowImpact(true);
  }, [progress.awaitingImpactDecision, progress.impactRecommendation]);

  const applyPreset = (name: string) => {
    setActivePreset(name); setFieldPositions(FIELD_PRESETS[name].map((position) => ({ ...position })));
    setFieldPlan(name === "Attacking Slips" ? "hunt-wickets" : name === "Boundary Guard" ? "protect" : "balanced");
  };
  const moveFielder = (index: number, event: ReactPointerEvent) => {
    if (draggingIndex !== index || !stadiumRef.current || activeRole !== "bowling") return;
    const rect = stadiumRef.current.getBoundingClientRect();
    const x = Math.max(10, Math.min(90, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(10, Math.min(90, ((event.clientY - rect.top) / rect.height) * 100));
    setFieldPositions((positions) => positions.map((position, current) => current === index ? { ...position, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), label: "Custom" } : position));
    setActivePreset("Custom");
  };
  const setImpact = (choice: PlayableImpactChoice) => {
    const decisions = cloneDecisions(session.decisions); decisions.impactByTeam = { ...(decisions.impactByTeam ?? {}), [userTeamId]: choice };
    setShowImpact(false); updateDecisions(decisions);
  };
  const impactPlan = planFor(userTeamId);
  const impactIncomingOptions = impactPlan.impactSubs.map((id) => input.players[id]).filter((player): player is Player => Boolean(player));
  const impactOutgoingOptions = impactPlan.startingXI.map((id) => input.players[id]).filter((player): player is Player => Boolean(player));
  const fieldDelivery = activeShot?.delivery ?? lastDelivery;
  const keeperReceiving = Boolean(activeShot && activeShot.fielderCollects && activeShot.phase !== "bowled" && ["shot", "fielded", "throw", "received"].includes(activeShot.phase) && activeShot.delivery.runsOffBat < 4 && (activeShot.delivery.totalRuns > 0 || activeShot.delivery.fieldingEvent));
  const runnersActive = Boolean(activeShot && ["shot", "fielded", "throw"].includes(activeShot.phase));
  const inningsDeliveries = [...visible].reverse();

  return (
    <main className={styles.shell} style={{ "--bat": battingTeam.primaryColor, "--bowl": bowlingTeam.primaryColor } as CSSProperties}>
      <header className={styles.topbar}>
        <div className="flex items-center gap-4">
          <div className={styles.brand}><span className={styles.liveDot}/><span className="font-space-mono text-xs font-bold tracking-widest text-yellow-500">MATCH CENTRE</span></div>
          <div className="flex flex-col gap-0.5 rounded-md border border-white/15 bg-[#111622] px-3 py-1 font-space-mono text-[9.5px] leading-tight text-slate-300">
            <span>🏟️ {input.conditions.stadiumName} · 📅 {input.date ?? "Matchday"} ({input.time ?? "TBD"})</span>
            <span className="text-slate-400">🌱 {input.conditions.pitch.name} · Expected {input.conditions.adjustedExpectedScore.min}–{input.conditions.adjustedExpectedScore.max} · 🌧️ {progress.simulation?.conditions.weather.kind ?? "Live conditions"}</span>
          </div>
          <div className={styles.headerActions}>
            <button onClick={() => setShowImpact(true)} disabled={!progress.awaitingImpactDecision || Boolean(activeShot)}><UserPlus size={15}/><span>Make Impact Sub</span></button>
            <button onClick={() => setShowScoreboard(true)}><Activity size={15}/><span>Scorecard</span></button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-[34px] items-center overflow-hidden rounded border border-white/20 bg-[#111622] font-space-mono text-[8px] font-bold uppercase">
            <button onClick={() => skip("ball")} disabled={Boolean(activeShot)} className="h-full border-r border-white/15 px-2.5 hover:bg-white/10 disabled:opacity-30">Skip ball</button>
            <button onClick={() => skip("over")} disabled={Boolean(activeShot)} className="h-full border-r border-white/15 px-2.5 hover:bg-white/10 disabled:opacity-30">Skip over</button>
            <button onClick={() => skip("five-overs")} disabled={Boolean(activeShot)} className="h-full border-r border-white/15 px-2.5 hover:bg-white/10 disabled:opacity-30">Skip 5 overs</button>
            <button onClick={() => skip("innings")} disabled={Boolean(activeShot)} className="h-full px-2.5 hover:bg-white/10 disabled:opacity-30">Finish innings</button>
          </div>
          <div className="flex h-[34px] items-center overflow-hidden rounded border border-white/20 bg-[#111622]">
            <button disabled={speed === 1} onClick={() => setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(speed) - 1)])} className="h-full w-8 text-[10px] font-bold disabled:opacity-30">&lt;&lt;</button>
            <span className="flex h-full min-w-[38px] items-center justify-center border-x border-white/15 font-space-mono text-[11px] font-bold">{speed}x</span>
            <button disabled={speed === 8} onClick={() => setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(speed) + 1)])} className="h-full w-8 text-[10px] font-bold disabled:opacity-30">&gt;&gt;</button>
          </div>
          <button onClick={playNextDelivery} disabled={Boolean(activeShot) || isPlaying} className="flex h-[34px] w-[34px] items-center justify-center rounded border border-white/20 bg-[#111622] disabled:opacity-30" title="Next ball"><SkipForward size={14}/></button>
          <button onClick={() => setIsPlaying((value) => !value)} className={`flex h-[34px] shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded border border-white/20 px-4 font-space-mono text-[11px] font-bold leading-none uppercase ${isPlaying ? "bg-[#ed4c47]" : "bg-[#111622]"}`}>{isPlaying ? <><Pause className="shrink-0" size={13}/>Pause</> : <><Play className="shrink-0" size={13}/>Play match</>}</button>
        </div>
      </header>

      <section className={styles.workspace}>
        <aside className={styles.leftRail}>
          {activeRole === "batting" ? <>
            <section className={styles.panel}>
              <div className={styles.panelHeading}><span><Target size={14}/> Innings Control</span><b>BATTING</b></div>
              <label className={styles.controlLabel}>Batting Intent</label>
              <div className={styles.segmented}>{(["survive","balanced","attack","six-hitting"] as PlayableBattingApproach[]).map((option) => <button key={option} onClick={() => setBattingApproach(option)} className={battingApproach === option ? styles.selected : ""}>{option === "six-hitting" ? "All out" : option}</button>)}</div>
              <label className={styles.controlLabel}>Target Shot Zone</label>
              <div className={styles.segmented}>{["360° All Ground","Offside Gaps","V & Straight","Legside Power"].map((zone) => <button key={zone} onClick={() => setShotZone(zone)} className={shotZone === zone ? styles.selected : ""}>{zone}</button>)}</div>
              <div className={styles.riskReadout}><span><Zap size={14}/> Boundary intent</span><b>{battingApproach === "six-hitting" ? "Very high" : battingApproach === "attack" ? "High" : battingApproach === "survive" ? "Low" : "Normal"}</b></div>
              <div className={styles.riskReadout}><span><Shield size={14}/> Wicket risk</span><b>{battingApproach === "six-hitting" ? "+70%" : battingApproach === "attack" ? "+28%" : battingApproach === "survive" ? "−38%" : "Baseline"}</b></div>
              {lastDelivery?.wicket && nextDelivery && <><label className={styles.selectLabel}>Next batter <ChevronDown size={13}/></label><select value={session.decisions.batterByWicket[`${lastDelivery.inningsNumber}-${lastDelivery.wicketsAfter}`] ?? ""} onChange={(event) => { const decisions=cloneDecisions(session.decisions); if(event.target.value) decisions.batterByWicket[`${lastDelivery.inningsNumber}-${lastDelivery.wicketsAfter}`]=event.target.value; else delete decisions.batterByWicket[`${lastDelivery.inningsNumber}-${lastDelivery.wicketsAfter}`]; updateDecisions(decisions); }}><option value="">Automatic: {nextDelivery.strikerName}</option>{remainingBatters.map((player)=><option key={player.id} value={player.id}>{player.name}</option>)}</select></>}
            </section>
            <section className={`${styles.panel} ${styles.batterPanel}`}><div className={styles.panelHeading}><span><Users size={14}/> At the Crease</span></div>{creaseCards.map(({player,line,strike}) => player && <div className="border-b border-white/10 py-1" key={player.id}><div className={styles.playerCard}><span className={styles.avatar}>{player.name.split(" ").map((part: string)=>part[0]).slice(0,2).join("")}</span><div className={styles.playerName}><strong>{player.name}</strong><small>{strike ? "ON STRIKE" : "NON-STRIKER"}</small></div><div className={styles.playerScore}><b>{line.runs}</b><small>{line.balls} balls · {line.fours}x4 {line.sixes}x6</small></div></div><div className="mt-1 grid grid-cols-5 gap-1 rounded border border-white/10 bg-black/40 p-1">{(["survive","anchor","balanced","attack","six-hitting"] as PlayableBattingApproach[]).map((stage)=><button key={stage} onClick={()=>setBatterApproaches((current)=>({...current,[player.id]:stage}))} className={`truncate rounded py-1 text-[7.5px] font-extrabold ${((batterApproaches[player.id]??battingApproach)===stage)?"bg-lime-400 text-black":"text-white/50 hover:bg-white/10"}`}>{stage==="six-hitting"?"6s":stage}</button>)}</div></div>)}<div className={styles.partnership}><span>Current partnership</span><strong>{partnershipRuns}<small> runs</small></strong></div></section>
          </> : <>
            <section className={styles.panel}>
              <div className={styles.panelHeading}><span><Gauge size={14}/> Bowling Control</span><b>BOWLING</b></div>
              <div className={styles.bowlerCard}><span className={styles.avatar}>{bowler?.name.split(" ").map((part: string)=>part[0]).slice(0,2).join("")}</span><div><small>CURRENT BOWLER</small><strong>{bowler?.name}</strong><span>{overs(activeBowlerLine.balls)} ov · {activeBowlerLine.runs} runs · {activeBowlerLine.wickets} wkts</span></div></div>
              {nextDelivery?.deliveryInOver === 1 && <><label className={styles.selectLabel}>Change Bowler <ChevronDown size={13}/></label><select value={session.decisions.bowlerByOver[`${inningsNumber}-${nextDelivery.overNumber}`] ?? ""} onChange={(event)=>{const decisions=cloneDecisions(session.decisions);if(event.target.value)decisions.bowlerByOver[`${inningsNumber}-${nextDelivery.overNumber}`]=event.target.value;else delete decisions.bowlerByOver[`${inningsNumber}-${nextDelivery.overNumber}`];updateDecisions(decisions);}}><option value="">Automatic: {nextDelivery.bowlerName}</option>{bowlingOptions.map((player)=><option key={player.id} value={player.id}>{player.name}</option>)}</select></>}
              <label className={styles.controlLabel}>Field Mentality</label><div className={styles.fieldButtons}>{(["protect","balanced","hunt-wickets"] as PlayableFieldPlan[]).map((plan)=><button key={plan} onClick={()=>setFieldPlan(plan)} className={fieldPlan===plan?styles.selected:""}>{plan}</button>)}</div>
              <label className={styles.controlLabel}>Delivery Line & Length</label><div className={styles.segmented}>{(["good-length","yorker-attack","bouncer-pace","spin-choke"] as PlayableBowlingPlan[]).map((plan)=><button key={plan} onClick={()=>setBowlingPlan(plan)} className={bowlingPlan===plan?styles.selected:""}>{plan}</button>)}</div>
            </section>
            <section className={styles.panel}><div className={styles.panelHeading}><span><Users size={14}/> Active Bowler Spells</span></div><div className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto">{bowlingOptions.map((player)=>{const line=bowlerFigures(visible,player.id);return <div key={player.id} className={`flex items-center justify-between rounded border px-2 py-1.5 ${player.id===bowler?.id?"border-yellow-400 bg-white/10":"border-white/10 bg-black/20"}`}><span className="text-[10.5px] font-bold">{player.name}</span><span className="font-mono text-[10.5px] font-bold">{line.wickets}-{line.runs} ({overs(line.balls)})</span></div>})}</div></section>
          </>}
        </aside>

        <section className={styles.centreStage}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1"><div className="flex items-center gap-1.5"><span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-white/50">{activeRole==="bowling"?"Field Presets:":"Opponent Field:"}</span>{activeRole==="bowling"?Object.keys(FIELD_PRESETS).map((name)=><button key={name} onClick={()=>applyPreset(name)} className={`rounded px-2.5 py-1 text-[10px] font-bold ${activePreset===name?"bg-amber-400 text-black":"bg-white/10"}`}>{name}</button>):<span className="rounded border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">{bowlingTeam.name} Field Alignment (Read Only)</span>}<button onClick={()=>setShowZoneOverlay((value)=>!value)} className="rounded bg-white/10 px-2 py-1 text-[10px] font-bold">Zone Map: {showZoneOverlay?"ON":"OFF"}</button></div><div className="flex gap-2"><span className={styles.fieldingRuleBadge}>{isPowerplay?"⚡ Powerplay":"🛡️ Overs 7-20"}<span className={outsideCount>maxOutside?"text-red-400":"text-emerald-400"}>{outsideCount}/{maxOutside} Deep</span></span><span className={styles.fieldingRuleBadge}>Leg Behind Sq: <span className={legBehind>2?"text-red-400":"text-emerald-400"}>{legBehind}/2</span></span></div></div>
          {(outsideCount>maxOutside||legBehind>2)&&activeRole==="bowling"&&<div className={styles.fieldingWarningBanner}>⚠️ ILLEGAL FIELD — adjust the highlighted field restriction before the next delivery.</div>}
          <div className={styles.stadium}><div className={styles.crowd}/><div ref={stadiumRef} className={styles.field}><div className={styles.mownStripes}/><div className={styles.innerCircle}/>{showZoneOverlay&&<div className={styles.zoneOverlay}>{fieldPositions.map((position)=><div key={position.id} className={styles.zoneBox} style={{left:`${position.x-6}%`,top:`${position.y-4}%`,width:"12%",height:"8%"}}>{position.label}</div>)}</div>}<div className={styles.pitch}><i className={styles.creaseTop}/><i className={styles.creaseBottom}/><span className={styles.stumpsTop}/><span className={styles.stumpsBottom}/></div>
            {activeShot&&<div className={`${styles.shotBall} ${activeShot.phase==="shot"&&activeShot.delivery.runsOffBat===6?styles.careerSixBall:""}`} style={{left:`${activeShot.ballX}%`,top:`${activeShot.ballY}%`,opacity:activeShot.phase==="runup"?0:1,transitionDuration:`${(activeShot.phase==="delivery"?activeShot.deliveryDuration:activeShot.phase==="shot"?activeShot.shotDuration:activeShot.phase==="throw"?activeShot.throwDuration:100)/speed}ms`,"--six-flight-duration":`${activeShot.shotDuration/speed}ms`} as CSSProperties}/>}
            <div className={`${styles.fielder} ${styles.activeFielder} ${activeShot?.phase==="runup"?styles.pacerRunup:""}`} style={{left:`${activeShot?.bowlerX??48.5}%`,top:"40.1%","--runup-duration":`${(activeShot?.releaseDelay??680)/speed}ms`,"--bowler-x":`${activeShot?.bowlerX??48.5}%`} as CSSProperties}><span>B</span><small>{surname(bowler?.name)}</small></div>
            <div className={`${styles.batterMarker} ${runnersActive&&activeShot?.batRuns?styles[`runnerNonStriker${activeShot.batRuns}`]:""}`} style={{left:"51.8%",top:"40.5%","--running-duration":`${(activeShot?.runningDuration??3050)/speed}ms`} as CSSProperties}><span style={{color:battingTeam.primaryColor}}>▲</span><b>{surname(nonStriker?.name)}</b></div>
            <div className={`${styles.batterMarker} ${runnersActive&&activeShot?.batRuns?styles[`runnerStriker${activeShot.batRuns}`]:""}`} style={{left:"50%",top:"59%","--running-duration":`${(activeShot?.runningDuration??3050)/speed}ms`} as CSSProperties}><span style={{color:battingTeam.primaryColor}}>▲</span><b>{surname(striker?.name)} <small>{renderedLhb?"LHB":"RHB"}</small></b></div>
            <div className={`${styles.fielder} ${keeperReceiving?styles.receivingFielder:""}`} style={{left:"50%",top:`${keeperReceiving?61.2:73}%`,"--receiver-duration":`${Math.max(250,(activeShot?.shotDuration??700)/speed)}ms`} as CSSProperties}><span>WK</span><b>KEEPER</b><small>{surname(keeper?.name)}</small></div>
            {fieldPositions.map((position,index)=>{const gathering=Boolean(activeShot&&activeShot.fielderCollects&&activeShot.phase!=="bowled"&&["shot","fielded","throw","received"].includes(activeShot.phase)&&activeShot.closestFielderIdx===index);const x=gathering?activeShot!.ballHitX:(renderedLhb?100-position.x:position.x);const y=gathering?activeShot!.ballHitY:position.y;return <div key={position.id} className={`${styles.fielder} ${activeRole==="bowling"&&!activeShot?styles.draggableFielder:""} ${gathering?styles.gatheringFielder:""}`} style={{left:`${x}%`,top:`${y}%`,"--fielding-duration":`${Math.max(300,(activeShot?.shotDuration??700)/speed)}ms`} as CSSProperties} onPointerDown={activeRole==="bowling"&&!activeShot?(event)=>{event.currentTarget.setPointerCapture(event.pointerId);setDraggingIndex(index)}:undefined} onPointerMove={(event)=>moveFielder(index,event)} onPointerUp={()=>setDraggingIndex(null)}><span>{index+1}</span><b>{position.label}</b><small>{surname(outfielders[index]?.name)}</small></div>})}
            {activeShot&&["shot","fielded"].includes(activeShot.phase)&&[4,6].includes(activeShot.delivery.runsOffBat)&&<div className={`${styles.boundaryFlash} ${activeShot.delivery.runsOffBat===6?styles.sixFlash:styles.fourFlash}`}><strong>{activeShot.delivery.runsOffBat===6?"SIX":"FOUR"}</strong><span>{activeShot.delivery.runsOffBat===6?"OUT OF THE GROUND":"TO THE BOUNDARY"}</span></div>}
            {activeShot&&fieldDelivery?.wicket&&["bowled","shot","fielded"].includes(activeShot.phase)&&<div className={styles.wicketBurst}/>}</div><div className={styles.fieldCaption}><span className={fieldDelivery?.wicket?styles.wicketTag:""}>{fieldDelivery?.resultCode??"READY"}</span><p>{fieldDelivery?.commentary??`${bowler?.name} has the ball. Set your approach and start the match.`}</p></div></div>
          <div className={styles.lowerTelemetry}>{target?<><div><small>Chase Equation</small><strong>{battingTeam.shortName} need {runsNeeded} in {ballsRemaining}b</strong><span><i style={{width:`${Math.min(100,((currentInnings?.runs??0)/target)*100)}%`,background:battingTeam.primaryColor}}/></span></div><div><small>Required Rate</small><strong>RRR {requiredRunRate}</strong></div><div><small>Target Score</small><strong>{target} runs</strong><span>CRR {currentRunRate}</span></div></>:<><div><small>Current rate</small><strong>{battingTeam.shortName} {currentRunRate}</strong><span><i style={{width:`${Math.min(100,Number(currentRunRate)*7)}%`,background:battingTeam.primaryColor}}/></span></div><div><small>Momentum</small><strong>{lastDelivery?.wicket?bowlingTeam.shortName:(lastDelivery?.runsOffBat??0)>=4?battingTeam.shortName:"EVEN"}</strong></div><div><small>Last 12 balls</small><strong>{visible.slice(-12).reduce((sum,delivery)=>sum+delivery.totalRuns,0)} runs</strong><span>{visible.slice(-12).filter((delivery)=>delivery.wicket).length} wickets</span></div></>}</div>
        </section>

        <aside className={styles.rightRail}><section className={`${styles.panel} ${styles.feedPanel}`}><div className={styles.panelHeading}><span><Activity size={14}/> Live Match Feed</span><b>{visible.length}</b></div><div className={`${styles.feed} h-[312px] max-h-[312px] overflow-y-auto`}>{inningsDeliveries.length===0&&<div className={styles.emptyFeed}>The next ball will appear here.</div>}{inningsDeliveries.map((delivery,index)=><article key={delivery.id} className={`${styles.careerFeedRow} border-b border-white/10 ${delivery.wicket?"border-l-2 border-l-red-500 bg-red-500/10":index===0?"bg-white/5":""}`}><div className="w-[46px] shrink-0 border-r border-white/15 pr-2 text-center"><time className="text-[9px] text-white/50">{delivery.displayBall}</time><span className={`mt-1 block rounded px-1 text-[9.5px] font-black ${delivery.wicket?"bg-red-600":delivery.runsOffBat>=4?"bg-yellow-400 text-black":"bg-white/10"}`}>{delivery.resultCode}</span></div><p className={`${styles.careerFeedText} m-0 text-[10px] leading-normal text-white/90`}>{delivery.commentary}</p></article>)}</div></section><section className={styles.panel}><div className={styles.panelHeading}><span><Users size={14}/> {activeRole==="batting"?"Batting XI & Dugout":"Opponent Batters"}</span></div><div className="max-h-[235px] overflow-y-auto">{battingXI.map((player,index)=>{const line=batterFigures(visible,player.id);const crease=player.id===striker?.id||player.id===nonStriker?.id;return <div key={player.id} className={`flex items-center justify-between border-b border-white/10 px-1 py-1.5 text-[10px] ${line.out?"opacity-40":crease?"text-yellow-300":""}`}><span>{index+1}. {player.name}</span><span className="font-mono">{line.out?`${line.runs} OUT`:line.balls?`${line.runs}${crease?"*":""} (${line.balls})`:"Yet to bat"}</span></div>})}</div></section></aside>
      </section>

      <footer className="relative z-20 flex h-[72px] items-center justify-center overflow-hidden border-t border-white/15 bg-black font-[family-name:var(--font-bricolage)]" style={{background:`linear-gradient(90deg,${battingTeam.primaryColor} 0 45%,#040508 50%,${bowlingTeam.primaryColor} 55%)`}}><div className="flex h-full items-center"><div className="flex h-full items-center gap-5 px-5" style={{backgroundColor:battingTeam.primaryColor}}><div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-yellow-400 font-extrabold">{battingTeam.shortName}</div><div><strong className="text-xl">{battingTeam.shortName}</strong><small className="block">v {bowlingTeam.shortName}</small></div><strong className="text-2xl">{currentInnings?.runs??0}-{currentInnings?.wickets??0}</strong>{isPowerplay&&<b className="bg-yellow-400 px-1.5 text-black">PP</b>}<strong>{overs(currentInnings?.legalBalls??0)}</strong><div className="min-w-[230px] border-l border-white/40 pl-5"><div className="flex justify-between text-lg font-black"><span>&gt; {surname(striker?.name).toUpperCase()}</span><span>{strikerLine.runs} <small>{strikerLine.balls}</small></span></div><div className="flex justify-between text-lg font-black"><span>{surname(nonStriker?.name).toUpperCase()}</span><span>{nonStrikerLine.runs} <small>{nonStrikerLine.balls}</small></span></div></div></div><div className="flex h-full min-w-[85px] flex-col items-center justify-center bg-[#040508] px-3"><small>{target?"RRR":"CRR"}</small><strong>{target?requiredRunRate:currentRunRate}</strong></div><div className="flex h-full items-center gap-4 px-5" style={{backgroundColor:bowlingTeam.primaryColor}}><div className="min-w-[250px] text-right"><div><b>{surname(bowler?.name).toUpperCase()}</b> {activeBowlerLine.wickets}-{activeBowlerLine.runs} ({overs(activeBowlerLine.balls)})</div><div className="mt-1 flex justify-end gap-1">{currentOver.map((delivery)=><span key={delivery.id} className={`flex h-4 min-w-4 items-center justify-center px-1 text-[9px] font-black ${delivery.wicket?"bg-red-600":delivery.runsOffBat>=4?"bg-yellow-400 text-black":"bg-white text-black"}`}>{delivery.resultCode}</span>)}</div></div><div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-yellow-400 font-extrabold">{bowlingTeam.shortName}</div></div></div></footer>

      {progress.awaitingTossDecision&&<div className={styles.modalBackdrop}><section className={styles.setupModal}><div className={styles.modalHeader}><div><small>MATCH TOSS</small><h2>You won the toss</h2></div></div><p className="mb-4 text-sm text-white/65">{input.conditions.pitch.name} · expected score {input.conditions.adjustedExpectedScore.min}–{input.conditions.adjustedExpectedScore.max}</p><div className="grid grid-cols-2 gap-3"><button className={styles.confirmButton} onClick={()=>updateDecisions({...cloneDecisions(session.decisions),tossDecision:"bat"})}>Bat first</button><button className={styles.confirmButton} onClick={()=>updateDecisions({...cloneDecisions(session.decisions),tossDecision:"bowl"})}>Bowl first</button></div></section></div>}
      {showImpact&&<div className={styles.modalBackdrop}><section className={`${styles.setupModal} ${styles.impactModal}`}><div className={styles.modalHeader}><div><small>IMPACT PLAYER</small><h2>Make Impact Sub</h2></div>{!progress.awaitingImpactDecision&&<button onClick={()=>setShowImpact(false)}><X size={19}/></button>}</div><p className="mb-3 text-xs text-white/60">{progress.impactRecommendation?.explanation??"Choose a player swap for the second innings."}</p><label>Incoming player</label><select value={impactIncoming} onChange={(event)=>setImpactIncoming(event.target.value)}><option value="">Select player</option>{impactIncomingOptions.map((player)=><option key={player.id} value={player.id}>{player.name}</option>)}</select><label>Outgoing player</label><select value={impactOutgoing} onChange={(event)=>setImpactOutgoing(event.target.value)}><option value="">Select player</option>{impactOutgoingOptions.map((player)=><option key={player.id} value={player.id}>{player.name}</option>)}</select><div className="mt-4 grid grid-cols-2 gap-3"><button className={styles.confirmButton} disabled={!impactIncoming||!impactOutgoing} onClick={()=>setImpact({use:true,incomingPlayerId:impactIncoming,outgoingPlayerId:impactOutgoing,battingPosition:progress.impactRecommendation?.battingPosition})}>Confirm sub</button><button className={styles.confirmButton} onClick={()=>setImpact({use:false})}>Do not use</button></div></section></div>}
      {showScoreboard&&<div className={styles.modalBackdrop} onMouseDown={()=>setShowScoreboard(false)}><section className={`${styles.setupModal} ${styles.scoreboardModal}`} onMouseDown={(event)=>event.stopPropagation()}><div className={styles.modalHeader}><div><small>LIVE SCORECARD</small><h2>{battingTeam.name} {currentInnings?.runs??0}/{currentInnings?.wickets??0}</h2></div><button onClick={()=>setShowScoreboard(false)}><X size={19}/></button></div><div className="max-h-[60vh] overflow-y-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-white/20 text-white/50"><th>BATTER</th><th>R</th><th>B</th><th>4</th><th>6</th></tr></thead><tbody>{battingXI.map((player)=>{const line=batterFigures(visible,player.id);return <tr key={player.id} className="border-b border-white/10"><td className="py-2">{player.name}</td><td>{line.runs}</td><td>{line.balls}</td><td>{line.fours}</td><td>{line.sixes}</td></tr>})}</tbody></table></div></section></div>}
    </main>
  );
}
