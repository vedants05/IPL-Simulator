"use client";

import Link from "next/link";
import {
  Activity,
  ChevronDown,
  CircleDot,
  Gauge,
  Pause,
  Play,
  Shield,
  SkipForward,
  Target,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { calculateMatchTemperature, venueRainProbability } from "@/lib/logic/matchSimulation";
import styles from "./sandbox.module.css";

type PlayerRole = "batter" | "bowler" | "allrounder" | "keeper";
type Aggression = "Retain" | "Balanced" | "Attack" | "All out";
type BatterAggressionStage = "Survive" | "Anchor" | "Balanced" | "Attack" | "Dealing in 6s";
const BATTING_STAGES: BatterAggressionStage[] = ["Survive", "Anchor", "Balanced", "Attack", "Dealing in 6s"];
type FieldPlan = "Protect" | "Balanced" | "Hunt wickets";

interface SandboxPlayer {
  id: string;
  name: string;
  role: PlayerRole;
  batting: number;
  bowling: number;
}

interface SandboxTeam {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  textColor?: string;
  players: SandboxPlayer[];
}

export function getTextColor(teamId: string): string {
  const lightTeams = ["CSK"];
  return lightTeams.includes(teamId) ? "#0A0E17" : "#FFFFFF";
}

interface Delivery {
  id: number;
  over: string;
  runs: number;
  wicket: boolean;
  label: string;
  detail: string;
  angle: number;
  distance: number;
  startX?: number;
  pitchX?: number;
  pitchY?: number;
  isSpinner?: boolean;
  six?: boolean;
}

interface BatterLine {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  state: "in" | "out" | "waiting";
}

interface BowlerLine {
  balls: number;
  runs: number;
  wickets: number;
}

const FALLBACK_TEAMS: SandboxTeam[] = [
  {
    id: "CSK",
    name: "Chennai Super Kings",
    shortName: "CSK",
    primaryColor: "#f8c90d",
    secondaryColor: "#0055a5",
    players: [
      ["csk-1", "Ruturaj Gaikwad", "batter", 88, 18],
      ["csk-2", "Devon Conway", "keeper", 87, 12],
      ["csk-3", "Ajinkya Rahane", "batter", 82, 10],
      ["csk-4", "Shivam Dube", "allrounder", 86, 67],
      ["csk-5", "Daryl Mitchell", "allrounder", 84, 72],
      ["csk-6", "Ravindra Jadeja", "allrounder", 89, 90],
      ["csk-7", "MS Dhoni", "keeper", 83, 8],
      ["csk-8", "Shardul Thakur", "allrounder", 68, 81],
      ["csk-9", "Deepak Chahar", "bowler", 42, 84],
      ["csk-10", "Tushar Deshpande", "bowler", 24, 79],
      ["csk-11", "Matheesha Pathirana", "bowler", 18, 89],
    ].map(([id, name, role, batting, bowling]) => ({
      id: id as string,
      name: name as string,
      role: role as PlayerRole,
      batting: batting as number,
      bowling: bowling as number,
    })),
  },
  {
    id: "MI",
    name: "Mumbai Indians",
    shortName: "MI",
    primaryColor: "#1474d4",
    secondaryColor: "#f4b41b",
    players: [
      ["mi-1", "Rohit Sharma", "batter", 90, 12],
      ["mi-2", "Ishan Kishan", "keeper", 85, 8],
      ["mi-3", "Suryakumar Yadav", "batter", 94, 15],
      ["mi-4", "Tilak Varma", "batter", 85, 31],
      ["mi-1", "Rohit Sharma", "batter", 90, 12, "Right-hand"],
      ["mi-2", "Ishan Kishan", "keeper", 85, 8, "Left-hand"],
      ["mi-3", "Suryakumar Yadav", "batter", 94, 15, "Right-hand"],
      ["mi-4", "Tilak Varma", "batter", 85, 31, "Left-hand"],
      ["mi-5", "Hardik Pandya", "allrounder", 88, 84, "Right-hand"],
      ["mi-6", "Tim David", "batter", 84, 18, "Right-hand"],
      ["mi-7", "Romario Shepherd", "allrounder", 76, 82, "Right-hand"],
      ["mi-8", "Gerald Coetzee", "bowler", 35, 84, "Right-hand"],
      ["mi-9", "Jasprit Bumrah", "bowler", 19, 96, "Right-hand"],
      ["mi-10", "Piyush Chawla", "bowler", 32, 82, "Right-hand"],
      ["mi-11", "Akash Madhwal", "bowler", 21, 79, "Right-hand"],
    ].map(([id, name, role, batting, bowling, battingStyle]) => ({
      id: id as string,
      name: name as string,
      role: role as PlayerRole,
      batting: batting as number,
      bowling: bowling as number,
      battingStyle: battingStyle as "Right-hand" | "Left-hand",
    })),
  },
  {
    id: "LSG",
    name: "Lucknow Super Giants",
    shortName: "LSG",
    primaryColor: "#e21f26",
    secondaryColor: "#0057e2",
    players: [
      ["lsg-1", "KL Rahul", "batter", 89, 10, "Right-hand"],
      ["lsg-2", "Quinton de Kock", "keeper", 87, 12, "Left-hand"],
      ["lsg-3", "Devdutt Padikkal", "batter", 81, 10, "Left-hand"],
      ["lsg-4", "Marcus Stoinis", "allrounder", 86, 78, "Right-hand"],
      ["lsg-5", "Nicholas Pooran", "keeper", 90, 8, "Left-hand"],
      ["lsg-6", "Ayush Badoni", "batter", 80, 25, "Right-hand"],
      ["lsg-7", "Krunal Pandya", "allrounder", 78, 83, "Left-hand"],
      ["lsg-8", "Ravi Bishnoi", "bowler", 22, 87, "Right-hand"],
      ["lsg-9", "Naveen-ul-Haq", "bowler", 28, 83, "Right-hand"],
      ["lsg-10", "Mohsin Khan", "bowler", 20, 82, "Left-hand"],
      ["lsg-11", "Mayank Yadav", "bowler", 15, 88, "Right-hand"],
    ].map(([id, name, role, batting, bowling, battingStyle]) => ({
      id: id as string,
      name: name as string,
      role: role as PlayerRole,
      batting: batting as number,
      bowling: bowling as number,
      battingStyle: battingStyle as "Right-hand" | "Left-hand",
    })),
  },
];

const DEFAULT_FIELD_POSITIONS = [
  { id: 0, label: "Slip 1", x: 56.5, y: 69 },
  { id: 1, label: "Point", x: 73, y: 56 },
  { id: 2, label: "Cover", x: 67, y: 44 },
  { id: 3, label: "Mid off", x: 57, y: 39 },
  { id: 4, label: "Mid on", x: 43, y: 39 },
  { id: 5, label: "Square leg", x: 26, y: 56 },
  { id: 6, label: "Fine leg", x: 35, y: 76 },
  { id: 7, label: "Third man", x: 72, y: 77 },
  { id: 8, label: "Deep midwicket", x: 27, y: 33 },
];

const FIELD_PRESETS: Record<string, typeof DEFAULT_FIELD_POSITIONS> = {
  "Standard T20": DEFAULT_FIELD_POSITIONS,
  "Attacking Slips": [
    { id: 0, label: "Slip 1", x: 56, y: 69 },
    { id: 1, label: "Slip 2", x: 59, y: 67 },
    { id: 2, label: "Gully", x: 63, y: 64 },
    { id: 3, label: "Point", x: 72, y: 56 },
    { id: 4, label: "Cover", x: 65, y: 44 },
    { id: 5, label: "Mid off", x: 56, y: 39 },
    { id: 6, label: "Mid on", x: 44, y: 39 },
    { id: 7, label: "Square leg", x: 28, y: 56 },
    { id: 8, label: "Fine leg", x: 35, y: 76 },
  ],
  "Boundary Guard": [
    { id: 0, label: "Deep point", x: 80, y: 55 },
    { id: 1, label: "Deep cover", x: 76, y: 32 },
    { id: 2, label: "Long off", x: 68, y: 22 },
    { id: 3, label: "Long on", x: 32, y: 22 },
    { id: 4, label: "Deep midwicket", x: 22, y: 34 },
    { id: 5, label: "Deep square", x: 20, y: 56 },
    { id: 6, label: "Fine leg", x: 34, y: 76 },
    { id: 7, label: "Third man", x: 72, y: 77 },
    { id: 8, label: "Mid off", x: 56, y: 39 },
  ],
};

const roleFromStore = (role: string, wicketkeeper?: boolean): PlayerRole => {
  if (wicketkeeper || role === "WK-Batsman") return "keeper";
  if (role === "All-Rounder") return "allrounder";
  if (role.includes("Bowler")) return "bowler";
  return "batter";
};

const surname = (name: string) => name.trim().split(/\s+/).at(-1) ?? name;
const overs = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

const selectSandboxXI = (players: SandboxPlayer[]) => {
  const selected: SandboxPlayer[] = [];
  const add = (player: SandboxPlayer) => {
    if (!selected.some((candidate) => candidate.id === player.id) && selected.length < 11) selected.push(player);
  };
  players.filter((player) => player.role === "keeper").sort((a, b) => b.batting - a.batting).slice(0, 1).forEach(add);
  players.filter((player) => player.role === "bowler" || player.role === "allrounder").sort((a, b) => b.bowling - a.bowling).slice(0, 5).forEach(add);
  [...players].sort((a, b) => Math.max(b.batting, b.bowling) - Math.max(a.batting, a.bowling)).forEach(add);
  return selected;
};

export default function MatchSandboxPage() {
  const storeTeams = useGameStore((state) => state.teams);
  const storePlayers = useGameStore((state) => state.players);

  const availableTeams = useMemo(() => {
    const normalized = Object.values(storeTeams)
      .map((team) => ({
        id: team.id,
        name: team.name,
        shortName: team.shortName,
        primaryColor: team.id === "LSG" ? "#e21f26" : team.id === "CSK" ? "#FDB913" : (team.primaryColor || "#6ee7b7"),
        secondaryColor: team.id === "LSG" ? "#0057e2" : team.id === "RR" ? "#0057e2" : team.id === "CSK" ? "#0055a5" : team.id === "SRH" ? "#e5b842" : team.id === "DC" || team.id === "DD" ? "#ef4123" : team.id === "PBKS" || team.id === "KXIP" ? "#ffffff" : (team.secondaryColor && team.secondaryColor !== "#141414" && team.secondaryColor !== "#111827" ? team.secondaryColor : "#0057e2"),
        textColor: getTextColor(team.id),
        players: selectSandboxXI(team.squad
          .map((id) => storePlayers[id])
          .filter(Boolean)
          .map((player) => ({
            id: player.id,
            name: player.name,
            role: roleFromStore(player.role, player.isWicketkeeper),
            batting: player.currentBatting,
            bowling: player.currentBowling,
            battingStyle: player.battingStyle || "Right-hand",
          }))),
      }))
      .filter((team) => team.players.length === 11);

    return normalized.length >= 2 ? normalized : FALLBACK_TEAMS;
  }, [storePlayers, storeTeams]);

  const [battingTeamId, setBattingTeamId] = useState(availableTeams[0].id);
  const [bowlingTeamId, setBowlingTeamId] = useState(availableTeams[1].id);
  const [showSetup, setShowSetup] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [aggression, setAggression] = useState<Aggression>("Balanced");
  const [batterAggression, setBatterAggression] = useState<Record<string, BatterAggressionStage>>({});
  const [fieldPlan, setFieldPlan] = useState<FieldPlan>("Balanced");
  const [activeRole, setActiveRole] = useState<"batting" | "bowling">("batting");
  const [isChasing, setIsChasing] = useState<boolean>(false);
  const [targetRuns, setTargetRuns] = useState<number>(175);
  const [shotZone, setShotZone] = useState<string>("360° All Ground");
  const [bowlingTactics, setBowlingTactics] = useState<string>("Good Length");
  const [runs, setRuns] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [balls, setBalls] = useState(0);
  const [partnershipRuns, setPartnershipRuns] = useState(0);
  const [strikerIndex, setStrikerIndex] = useState(0);
  const [nonStrikerIndex, setNonStrikerIndex] = useState(1);
  const [slot0Index, setSlot0Index] = useState(0);
  const [slot1Index, setSlot1Index] = useState(1);
  const [nextBatterIndex, setNextBatterIndex] = useState(2);
  const [bowlerIndex, setBowlerIndex] = useState(0);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [batterLines, setBatterLines] = useState<Record<string, BatterLine>>({});
  const [bowlerLines, setBowlerLines] = useState<Record<string, BowlerLine>>({});

const FIELD_ZONES = [
  // Behind Stumps (y > 56%)
  { name: "Slips", left: 50, top: 58, width: 14, height: 17 },
  { name: "Gully", left: 64, top: 62, width: 12, height: 13 },
  { name: "Third Man", left: 50, top: 75, width: 48, height: 23 },
  { name: "Leg Slip", left: 36, top: 58, width: 14, height: 17 },
  { name: "Fine Leg", left: 2, top: 75, width: 48, height: 23 },

  // Square Pitch (46% <= y <= 58%)
  { name: "Point", left: 64, top: 50, width: 16, height: 12 },
  { name: "Deep Point", left: 80, top: 50, width: 18, height: 18 },
  { name: "Square Leg", left: 20, top: 46, width: 16, height: 16 },
  { name: "Deep Square", left: 2, top: 46, width: 18, height: 22 },

  // In Front of Striker (y < 46%)
  { name: "Cover", left: 60, top: 32, width: 16, height: 18 },
  { name: "Deep Cover", left: 76, top: 20, width: 22, height: 30 },
  { name: "Mid Off", left: 50, top: 28, width: 10, height: 18 },
  { name: "Long Off", left: 50, top: 2, width: 24, height: 26 },
  { name: "Midwicket", left: 24, top: 32, width: 16, height: 14 },
  { name: "Deep Midwicket", left: 2, top: 20, width: 22, height: 26 },
  { name: "Mid On", left: 40, top: 28, width: 10, height: 18 },
  { name: "Long On", left: 26, top: 2, width: 24, height: 26 },
];

  const [fieldPositions, setFieldPositions] = useState(DEFAULT_FIELD_POSITIONS);
  const [activeShot, setActiveShot] = useState<{
    id: number;
    batRuns: number;
    ballHitX: number;
    ballHitY: number;
    closestFielderIdx: number;
    phase: "bowling" | "hit";
  } | null>(null);
  const [activePreset, setActivePreset] = useState<string>("Standard T20");
  const [showZoneOverlay, setShowZoneOverlay] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const stadiumRef = useRef<HTMLDivElement>(null);

  // Live Field Restrictions & Drag Setup
  const currentOverNumber = Math.floor(balls / 6);
  const isPowerplay = currentOverNumber < 6;
  const maxOutsideCircleAllowed = isPowerplay ? 2 : 5;

const getCricketPositionName = (x: number, y: number): string => {
  const matchedZone = FIELD_ZONES.find(
    (zone) =>
      x >= zone.left &&
      x <= zone.left + zone.width &&
      y >= zone.top &&
      y <= zone.top + zone.height
  );

  let name = matchedZone ? matchedZone.name : "Fielder";

  const pitchDx = x - 50;
  const pitchDy = y - 50;
  const isInsideCircle = Math.sqrt(pitchDx * pitchDx + pitchDy * pitchDy) <= 29.5;

  if (name === "Fine Leg" && isInsideCircle) {
    return "Short Fine Leg";
  }

  if (matchedZone) {
    return name;
  }

  // Polar sector math fallback for 100% full ground coverage with zero gaps
  const polarDx = x - 50;
  const polarDy = y - 56;
  const dist = Math.sqrt(polarDx * polarDx + polarDy * polarDy);
  const isDeep = dist > 26.5;

  if (polarDy > 0) {
    if (polarDx >= 0) {
      if (polarDy < 12 && polarDx < 14) return "Slips";
      if (polarDy < 18 && polarDx < 22) return "Gully";
      return isDeep ? "Third Man" : "Fly Slip";
    } else {
      if (polarDy < 12 && polarDx > -14) return "Leg Slip";
      return isDeep ? "Fine Leg" : "Short Fine Leg";
    }
  }

  const angle = (Math.atan2(polarDy, polarDx) * 180) / Math.PI;

  if (polarDx >= 0) {
    if (angle > -25) return isDeep ? "Deep Point" : "Point";
    if (angle > -68) return isDeep ? "Deep Cover" : "Cover";
    return isDeep ? "Long Off" : "Mid Off";
  } else {
    if (angle < -155) return isDeep ? "Deep Square" : "Square Leg";
    if (angle < -112) return isDeep ? "Deep Midwicket" : "Midwicket";
    return isDeep ? "Long On" : "Mid On";
  }
};

  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    if (activeRole === "batting") return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingIndex(index);
  };

  const handlePointerMove = (index: number, e: React.PointerEvent) => {
    if (draggingIndex !== index || !stadiumRef.current) return;
    const rect = stadiumRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.max(10, Math.min(90, Number(rawX.toFixed(1))));
    const clampedY = Math.max(10, Math.min(90, Number(rawY.toFixed(1))));
    const realX = isLhb ? 100 - clampedX : clampedX;
    const dynamicLabel = getCricketPositionName(realX, clampedY);

    setFieldPositions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, x: realX, y: clampedY, label: dynamicLabel } : item))
    );
    setActivePreset("Custom");
  };

  const handlePointerUp = () => {
    setDraggingIndex(null);
  };

  const applyPreset = (presetName: string) => {
    const preset = FIELD_PRESETS[presetName];
    if (preset) {
      setFieldPositions(preset);
      setActivePreset(presetName);
    }
  };

  useEffect(() => {
    if (!availableTeams.some((team) => team.id === battingTeamId)) {
      setBattingTeamId(availableTeams[0].id);
      setBowlingTeamId(availableTeams[1].id);
    }
  }, [availableTeams, battingTeamId]);

  const battingTeam = availableTeams.find((team) => team.id === battingTeamId) ?? availableTeams[0];
  const bowlingTeam = availableTeams.find((team) => team.id === bowlingTeamId) ?? availableTeams[1];
  const battingXI = battingTeam.players;
  const bowlingXI = bowlingTeam.players;
  const bowlingOptions = useMemo(() => bowlingXI
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => player.role === "bowler" || player.role === "allrounder"), [bowlingXI]);
  const safeBowlerIndex = bowlingOptions.some(({ index }) => index === bowlerIndex)
    ? bowlerIndex
    : (bowlingOptions[0]?.index ?? 0);
  const striker = battingXI[strikerIndex] ?? battingXI[0];
  const nonStriker = battingXI[nonStrikerIndex] ?? battingXI[1];
  const bowler = bowlingXI[safeBowlerIndex] ?? bowlingXI[0];

  const isLhb = useMemo(() => {
    return (striker as any)?.battingStyle === "Left-hand";
  }, [striker]);

  const outsideCircleCount = useMemo(() => {
    return fieldPositions.filter((pos) => {
      const dx = pos.x - 50;
      const dy = pos.y - 50;
      return Math.sqrt(dx * dx + dy * dy) > 29.5;
    }).length;
  }, [fieldPositions]);

  const legSideBehindSquareCount = useMemo(() => {
    return fieldPositions.filter((pos) => {
      const isLegSide = isLhb ? pos.x > 50 : pos.x < 50;
      const isBehindSquare = pos.y > 56;
      return isLegSide && isBehindSquare;
    }).length;
  }, [fieldPositions, isLhb]);

  const isLegSideViolation = legSideBehindSquareCount > 2;
  const isCircleViolation = outsideCircleCount > maxOutsideCircleAllowed;
  const remainingBatters = useMemo(() => {
    return battingXI
      .map((player, index) => ({ player, index }))
      .filter(({ player, index }) => {
        const line = batterLines[player.id];
        const isCurrentCrease = index === strikerIndex || index === nonStrikerIndex;
        const isOut = line?.state === "out";
        return !isCurrentCrease && !isOut;
      });
  }, [battingXI, batterLines, strikerIndex, nonStrikerIndex]);

  const safeNextBatterIndex = useMemo(() => {
    if (remainingBatters.some(({ index }) => index === nextBatterIndex)) {
      return nextBatterIndex;
    }
    return remainingBatters[0]?.index ?? nextBatterIndex;
  }, [remainingBatters, nextBatterIndex]);

  const nextBatter = battingXI[safeNextBatterIndex];
  const lastBall = deliveries[0];
  const inningsComplete = wickets >= 10 || balls >= 120;
  const projected = balls ? Math.round((runs / balls) * 120) : 0;

  const resetMatch = useCallback(() => {
    const firstBowler = bowlingOptions[0]?.index ?? 0;
    setIsPlaying(false);
    setRuns(0);
    setWickets(0);
    setBalls(0);
    setPartnershipRuns(0);
    setStrikerIndex(0);
    setNonStrikerIndex(1);
    setSlot0Index(0);
    setSlot1Index(1);
    setNextBatterIndex(2);
    setBowlerIndex(firstBowler);
    setDeliveries([]);
    setBatterLines(Object.fromEntries(battingXI.map((player, index) => [
      player.id,
      { runs: 0, balls: 0, fours: 0, sixes: 0, state: index < 2 ? "in" : "waiting" },
    ])));
    setBowlerLines(Object.fromEntries(bowlingXI.map((player) => [
      player.id,
      { balls: 0, runs: 0, wickets: 0 },
    ])));
  }, [battingXI, bowlingOptions, bowlingXI]);

  useEffect(() => {
    resetMatch();
  }, [battingTeamId, bowlingTeamId, resetMatch]);

  const simulateBall = useCallback(() => {
    if (inningsComplete || !striker || !nonStriker || !bowler || activeShot !== null) {
      if (inningsComplete) setIsPlaying(false);
      return;
    }

    const activeAggression = batterAggression[striker.id] ?? aggression;
    const aggressionRiskMap: Record<string, number> = {
      Survive: 0.008,
      Anchor: 0.02,
      Balanced: 0.035,
      Attack: 0.065,
      "Dealing in 6s": 0.14,
      Retain: 0.018,
      "All out": 0.105,
    };
    const attackBoostMap: Record<string, number> = {
      Survive: -0.2,
      Anchor: -0.1,
      Balanced: 0,
      Attack: 0.12,
      "Dealing in 6s": 0.28,
      Retain: -0.1,
      "All out": 0.2,
    };
    const fieldPressure: Record<FieldPlan, number> = {
      Protect: 0.82,
      Balanced: 1,
      "Hunt wickets": 1.28,
    };
    const wicketChance = (aggressionRiskMap[activeAggression] ?? 0.035) * fieldPressure[fieldPlan] * (0.8 + bowler.bowling / 220);
    const wicket = Math.random() < wicketChance;
    const extraRoll = Math.random();
    const isNoBall = !wicket && extraRoll < 0.04;
    const isWide = !wicket && !isNoBall && extraRoll > 0.94;
    const isLegal = !isNoBall && !isWide;

    const roll = Math.random();
    const attackBoost = attackBoostMap[activeAggression] ?? 0;
    const scoringRoll = roll + attackBoost + (striker.batting - bowler.bowling) / 500;

    let ballRuns = 0;
    let batRuns = 0;
    let extraType: "nb" | "wd" | null = null;
    let ballTag = "";
    let label = "Dot ball";
    let detail = `${bowler.name} finds a tight line. ${striker.name} cannot pierce the ring.`;

    if (wicket) {
      const dismissals = ["taken at cover", "bowled through the gate", "caught on the rope", "trapped in front"];
      label = "W";
      ballTag = "W";
      detail = `${striker.name} is ${dismissals[Math.floor(Math.random() * dismissals.length)]}. ${bowler.name} has the breakthrough.`;
    } else if (isNoBall) {
      extraType = "nb";
      batRuns = scoringRoll > 0.91 ? 6 : scoringRoll > 0.76 ? 4 : scoringRoll > 0.5 ? 1 : 0;
      ballRuns = 1 + batRuns;
      ballTag = batRuns > 0 ? `NB+${batRuns}` : "NB";
      label = ballTag;
      detail = `${bowler.name} oversteps the crease! ${batRuns > 0 ? `${striker.name} smashes it for ${batRuns} runs.` : ""}`;
    } else if (isWide) {
      extraType = "wd";
      ballRuns = 1;
      ballTag = "WD";
      label = "WD";
      detail = `${bowler.name} strays wide down the leg side. Extra run awarded.`;
    } else {
      batRuns = scoringRoll > 0.91 ? 6 : scoringRoll > 0.76 ? 4 : scoringRoll > 0.6 ? 2 : scoringRoll > 0.32 ? 1 : 0;
      ballRuns = batRuns;
      ballTag = String(ballRuns);
      label = String(ballRuns);
      if (ballRuns === 6) {
        detail = `${striker.name} commits early and launches it cleanly into the crowd.`;
      } else if (ballRuns === 4) {
        detail = `${striker.name} finds the gap and the outfield does the rest.`;
      } else if (ballRuns > 0) {
        detail = `${striker.name} works it into space. The pair complete ${ballRuns}.`;
      }
    }

    const currentOverNum = Math.floor(balls / 6);
    const legalBallNumInOver = (balls % 6) + (isLegal ? 1 : 0);
    const ballLabel = `${currentOverNum}.${isLegal ? legalBallNumInOver : (balls % 6) + 1}`;
    const angle = Math.round(Math.random() * 260 - 130);
    const distance = wicket
      ? 22
      : ballRuns === 6
      ? 210
      : ballRuns === 4
      ? 165
      : ballRuns === 3
      ? 130
      : ballRuns === 2
      ? 95
      : ballRuns === 1
      ? 60
      : 25;

    const isSpinner = bowler.role === "spinner" || /spin|jadeja|chahal|narine|ashwin|kuldeep|rashid|bishnoi|axar|varun/i.test(bowler.name);
    const startX = 48.4;
    const pitchX = isSpinner
      ? Number((50 + (Math.random() * 2.2 - 1.1)).toFixed(1))
      : Number((50 + (Math.random() * 1.0 - 0.5)).toFixed(1));
    const pitchY = bowlingTactics === "Yorker Attack" ? 54 : bowlingTactics === "Bouncer & Pace" ? 45 : 49.5;

    setRuns((value) => value + ballRuns);
    if (isLegal) {
      setBalls((value) => value + 1);
    }

    setBatterLines((lines) => ({
      ...lines,
      [striker.id]: {
        ...(lines[striker.id] ?? { runs: 0, balls: 0, fours: 0, sixes: 0, state: "in" }),
        runs: (lines[striker.id]?.runs ?? 0) + batRuns,
        balls: (lines[striker.id]?.balls ?? 0) + (isLegal ? 1 : 0),
        fours: (lines[striker.id]?.fours ?? 0) + (batRuns === 4 ? 1 : 0),
        sixes: (lines[striker.id]?.sixes ?? 0) + (batRuns === 6 ? 1 : 0),
        state: wicket ? "out" : "in",
      },
    }));

    setBowlerLines((lines) => ({
      ...lines,
      [bowler.id]: {
        balls: (lines[bowler.id]?.balls ?? 0) + (isLegal ? 1 : 0),
        runs: (lines[bowler.id]?.runs ?? 0) + ballRuns,
        wickets: (lines[bowler.id]?.wickets ?? 0) + (wicket ? 1 : 0),
      },
    }));

    setDeliveries((items) => [{
      id: Date.now(),
      overNumber: currentOverNum,
      over: ballLabel,
      runs: ballRuns,
      batRuns,
      wicket,
      isLegal,
      extraType,
      ballTag,
      label,
      detail,
      angle,
      distance,
      startX,
      pitchX,
      pitchY,
      isSpinner,
      six: ballRuns === 6,
    }, ...items].slice(0, 36));

    const rad = (angle * Math.PI) / 180;
    const shotDist = Math.min(42, distance / 4.2);
    const ballHitX = Math.max(8, Math.min(92, Number((50 + Math.sin(rad) * shotDist).toFixed(1))));
    const ballHitY = Math.max(8, Math.min(92, Number((59 - Math.cos(rad) * shotDist).toFixed(1))));

    let closestFielderIdx = 0;
    let minDistance = Infinity;

    fieldPositions.forEach((pos, idx) => {
      const displayX = isLhb ? 100 - pos.x : pos.x;
      const distToBall = Math.sqrt((displayX - ballHitX) ** 2 + (pos.y - ballHitY) ** 2);
      if (distToBall < minDistance) {
        minDistance = distToBall;
        closestFielderIdx = idx;
      }
    });

    const shotId = Date.now();
    setActiveShot({
      id: shotId,
      batRuns,
      ballHitX,
      ballHitY,
      closestFielderIdx,
      phase: "bowling",
    });

    window.setTimeout(() => {
      setActiveShot((current) => (current?.id === shotId ? { ...current, phase: "hit" } : current));
    }, 450);

    const runDuration = batRuns === 3 ? 2800 : batRuns === 2 ? 2200 : 1600;
    window.setTimeout(() => {
      setActiveShot((current) => (current?.id === shotId ? null : current));
    }, runDuration);

    let nextStriker = strikerIndex;
    let nextNonStriker = nonStrikerIndex;
    if (wicket) {
      setWickets((value) => value + 1);
      setPartnershipRuns(0);
      if (remainingBatters.length > 0) {
        const incomingIndex = safeNextBatterIndex;
        const incoming = battingXI[incomingIndex];
        nextStriker = incomingIndex;

        if (strikerIndex === slot0Index) {
          setSlot0Index(incomingIndex);
        } else {
          setSlot1Index(incomingIndex);
        }

        const nextRemaining = remainingBatters.filter(({ index }) => index !== incomingIndex);
        if (nextRemaining.length > 0) {
          setNextBatterIndex(nextRemaining[0].index);
        }

        setBatterLines((lines) => ({
          ...lines,
          [incoming.id]: { ...(lines[incoming.id] ?? { runs: 0, balls: 0, fours: 0, sixes: 0 }), state: "in" },
        }));
      }
    } else {
      setPartnershipRuns((prev) => prev + ballRuns);
      if (batRuns % 2 === 1) {
        [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
      }
    }

    if (isLegal && (balls + 1) % 6 === 0) {
      [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
      const eligible = bowlingOptions.map(({ index }) => index).filter((index) => index !== safeBowlerIndex);
      if (eligible.length) setBowlerIndex(eligible[Math.floor(Math.random() * eligible.length)]);
    }
    setStrikerIndex(nextStriker);
    setNonStrikerIndex(nextNonStriker);
  }, [activeShot, aggression, balls, batterAggression, battingXI, bowler, bowlingOptions, deliveries, fieldPlan, inningsComplete, nextBatterIndex, nonStriker, nonStrikerIndex, remainingBatters, safeBowlerIndex, safeNextBatterIndex, slot0Index, slot1Index, striker, strikerIndex]);

  useEffect(() => {
    if (!isPlaying || activeShot !== null) return;
    const delay = Math.max(1200, 3000 / speed);
    const timer = window.setTimeout(simulateBall, delay);
    return () => window.clearTimeout(timer);
  }, [isPlaying, activeShot, simulateBall, speed]);

  const confirmTeams = () => {
    if (battingTeamId === bowlingTeamId) {
      const opponent = availableTeams.find((team) => team.id !== battingTeamId);
      if (opponent) setBowlingTeamId(opponent.id);
    }
    setShowSetup(false);
  };

  const decreaseSpeed = () => setSpeed((prev) => (prev === 8 ? 4 : prev === 4 ? 2 : 1));
  const increaseSpeed = () => setSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 8));

  const bowlerFigures = bowlerLines[bowler?.id] ?? { balls: 0, runs: 0, wickets: 0 };
  const strikerStats = batterLines[striker?.id] ?? { runs: 0, balls: 0, fours: 0, sixes: 0, state: "in" };

  const currentOverDeliveries = useMemo(() => {
    const currentLegalInOver = (balls > 0 && balls % 6 === 0) ? 6 : (balls % 6);
    const items: any[] = [];
    let legalSeen = 0;

    for (const d of deliveries) {
      if ((d as any).isLegal) {
        legalSeen++;
        if (legalSeen > currentLegalInOver) {
          break;
        }
      }
      items.push(d);
    }

    items.reverse();
    const legalRemaining = (balls > 0 && balls % 6 === 0) ? 0 : (6 - (balls % 6));
    const numSlots = Math.max(6, items.length + legalRemaining);

    return Array.from({ length: numSlots }).map((_, idx) => {
      if (idx < items.length) {
        const ball = items[idx];
        return {
          label: ball.ballTag || (ball.wicket ? "W" : String(ball.runs)),
          wicket: ball.wicket,
          four: !ball.wicket && (ball.batRuns === 4 || ball.runs === 4) && !ball.extraType,
          six: !ball.wicket && (ball.batRuns === 6 || ball.runs === 6) && !ball.extraType,
          extra: !!ball.extraType,
          active: true,
        };
      }
      return { label: "", wicket: false, four: false, six: false, extra: false, active: false };
    });
  }, [balls, deliveries]);

  const nonStrikerStats = batterLines[nonStriker?.id] ?? { runs: 0, balls: 0, fours: 0, sixes: 0, state: "in" };

  const topBatter = battingXI[slot0Index] ?? striker;
  const bottomBatter = battingXI[slot1Index] ?? nonStriker;
  const topStats = topBatter ? (batterLines[topBatter.id] ?? { runs: 0, balls: 0, fours: 0, sixes: 0, state: "in" }) : { runs: 0, balls: 0, fours: 0, sixes: 0, state: "in" };
  const bottomStats = bottomBatter ? (batterLines[bottomBatter.id] ?? { runs: 0, balls: 0, fours: 0, sixes: 0, state: "in" }) : { runs: 0, balls: 0, fours: 0, sixes: 0, state: "in" };
  const isTopStriker = !!(topBatter && striker && topBatter.id === striker.id);
  const isBottomStriker = !!(bottomBatter && striker && bottomBatter.id === striker.id);

  const matchDate = "15 Apr 2027";
  const matchTime = "19:30 IST (Night)";
  const stadiumName = "Wankhede Stadium, Mumbai";
  const pitchType = "Balanced Pitch";
  const tempCelsius = calculateMatchTemperature("sandbox-seed", "wankhede-stadium", "2027-04-15", "19:30");
  const rainProbPercent = Math.round(venueRainProbability("wankhede-stadium", "2027-04-15") * 100);
  const battingTextColor = battingTeam.textColor ?? getTextColor(battingTeam.id);
  const bowlingTextColor = bowlingTeam.textColor ?? getTextColor(bowlingTeam.id);
  const scoreColor = battingTeam.id === "LSG" ? "#FF6B00" : battingTeam.secondaryColor;
  const currentRunRate = balls > 0 ? ((runs / balls) * 6).toFixed(2) : "0.00";
  const runsNeeded = Math.max(0, targetRuns - runs);
  const ballsRemaining = Math.max(0, 120 - balls);
  const requiredRunRate = (isChasing && ballsRemaining > 0 && runsNeeded > 0)
    ? ((runsNeeded * 6) / ballsRemaining).toFixed(2)
    : "0.00";

  return (
    <main className={styles.shell} style={{ "--bat": battingTeam.primaryColor, "--bowl": bowlingTeam.primaryColor } as React.CSSProperties}>
      
      {/* Top Header: Brand & Match Details on Left; Speed Control, Next Ball, Pause/Resume on Right */}
      <header className={styles.topbar}>
        <div className="flex items-center gap-4">
          <div className={styles.brand}>
            <span className={styles.liveDot} />
            <span className="font-space-mono text-xs font-bold tracking-widest text-yellow-500 uppercase">MATCH CENTRE</span>
          </div>

          {/* Compact 2-Row Match Details Pill (50% Width) */}
          <div className="flex flex-col justify-center gap-0.5 px-3 py-1 bg-[#111622] border border-white/15 rounded-md text-[9.5px] text-slate-300 font-space-mono select-none leading-tight">
            <div className="flex items-center gap-2">
              <span>🏟️ Wankhede, Mumbai</span>
              <span className="text-white/20">·</span>
              <span>📅 15 Apr '27 (19:30)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span>🌱 {pitchType}</span>
              <span className="text-white/20">·</span>
              <span>🌡️ {tempCelsius}°C</span>
              <span className="text-white/20">·</span>
              <span>🌧️ {rainProbPercent}% Rain</span>
            </div>
          </div>

          <div className={styles.headerActions}>
            <Link href="/game/overview"><X size={15} /><span>Exit</span></Link>
          </div>
        </div>

        {/* Right Header Controls (From rightmost to left: Role Switcher, Chasing Switcher, Speed Control, Next Ball, Pause/Resume) */}
        <div className="flex items-center gap-3">
          {/* Compact Role Switcher Toggle */}
          <div className="flex items-center bg-black/40 p-0.5 rounded border border-white/10 shrink-0 text-[9px]">
            <button
              onClick={() => setActiveRole("batting")}
              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer select-none ${
                activeRole === "batting"
                  ? "bg-white/20 text-white font-extrabold"
                  : "text-white/40 hover:text-white/70"
              }`}
              title="Test Batting Controls"
            >
              BAT
            </button>
            <button
              onClick={() => setActiveRole("bowling")}
              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer select-none ${
                activeRole === "bowling"
                  ? "bg-white/20 text-white font-extrabold"
                  : "text-white/40 hover:text-white/70"
              }`}
              title="Test Bowling Controls"
            >
              BOWL
            </button>
          </div>

          {/* Compact Innings / Chase Mode Switcher */}
          <div className="flex items-center bg-black/40 p-0.5 rounded border border-white/10 shrink-0 text-[9px] gap-1">
            <button
              onClick={() => setIsChasing(false)}
              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer select-none ${
                !isChasing
                  ? "bg-white/20 text-white font-extrabold"
                  : "text-white/40 hover:text-white/70"
              }`}
              title="1st Innings Mode"
            >
              1ST INN
            </button>
            <button
              onClick={() => setIsChasing(true)}
              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer select-none ${
                isChasing
                  ? "bg-amber-500/30 text-amber-300 border border-amber-400/40 font-extrabold"
                  : "text-white/40 hover:text-white/70"
              }`}
              title="2nd Innings Target Chase Mode"
            >
              🎯 CHASE
            </button>
            {isChasing && (
              <div className="flex items-center gap-1 pl-1 border-l border-white/15">
                <span className="text-[8px] text-amber-400 font-bold uppercase">TARGET:</span>
                <input
                  type="number"
                  min="1"
                  max="350"
                  value={targetRuns}
                  onChange={(e) => setTargetRuns(Math.max(1, Number(e.target.value)))}
                  className="w-10 bg-black/60 border border-amber-400/50 rounded text-amber-300 text-[9px] font-mono font-bold text-center px-0.5 py-0 focus:outline-none"
                  title="Click to change target score"
                />
              </div>
            )}
          </div>

          {/* Speed Control (Leftmost in Right Group) */}
          <div
            className="flex items-center gap-0 rounded select-none h-[34px] overflow-hidden transition-colors duration-200"
            style={{
              backgroundColor: "#111622",
              border: "1.5px solid rgba(255,255,255,0.18)",
            }}
          >
            <button
              disabled={speed === 1}
              onClick={decreaseSpeed}
              className="w-8 shrink-0 px-0 text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-all h-full flex items-center justify-center font-bold text-[10px] cursor-pointer"
              title="Decrease Speed"
            >
              &lt;&lt;
            </button>
            <span
              className="font-space-mono font-bold text-[11px] min-w-[34px] shrink-0 whitespace-nowrap text-center text-white flex items-center justify-center h-full border-x border-white/15 px-2 select-none"
            >
              {speed}x
            </span>
            <button
              disabled={speed === 8}
              onClick={increaseSpeed}
              className="w-8 shrink-0 px-0 text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-all h-full flex items-center justify-center font-bold text-[10px] cursor-pointer"
              title="Increase Speed"
            >
              &gt;&gt;
            </button>
          </div>

          {/* Next Ball (Middle Button) */}
          <button
            onClick={simulateBall}
            disabled={isPlaying || inningsComplete}
            title="Simulate next ball"
            className="w-[34px] h-[34px] shrink-0 rounded border-[1.5px] border-white/18 bg-[#111622] hover:bg-white/15 text-white flex items-center justify-center cursor-pointer transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
          >
            <SkipForward size={14} />
          </button>

          {/* Pause / Resume (Rightmost Button) */}
          <button
            disabled={inningsComplete}
            onClick={() => setIsPlaying((value) => !value)}
            className={`shrink-0 whitespace-nowrap px-4 rounded font-space-mono font-bold text-[11px] tracking-wider uppercase transition-all duration-150 flex items-center justify-center gap-2 h-[34px] cursor-pointer select-none ${
              isPlaying
                ? "bg-[#ed4c47] text-white hover:bg-red-600 hover:scale-105 active:scale-95 animate-pulse"
                : "bg-[#111622] text-white hover:bg-white/15 hover:scale-105 active:scale-95"
            }`}
            style={{
              border: "1.5px solid rgba(255, 255, 255, 0.18)",
            }}
          >
            {isPlaying ? (
              <><Pause size={13} className="inline fill-current" /> Pause</>
            ) : (
              <><Play size={13} className="inline fill-current" /> {inningsComplete ? "Complete" : "Play match"}</>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <section className={styles.workspace}>
        <aside className={styles.leftRail}>
          {/* BATTING CONTROLS (Displayed when activeRole === "batting") */}
          {activeRole === "batting" && (
            <>
              <section className={styles.panel}>
                <div className={styles.panelHeading}><span><Target size={14} /> Innings Control</span><b>BATTING</b></div>

                <label className={styles.controlLabel}>Batting Intent</label>
                <div className={styles.segmented}>
                  {(["Retain", "Balanced", "Attack", "All out"] as Aggression[]).map((option) => (
                    <button key={option} onClick={() => setAggression(option)} className={aggression === option ? styles.selected : ""}>{option}</button>
                  ))}
                </div>

                <label className={styles.controlLabel}>Target Shot Zone</label>
                <div className={styles.segmented}>
                  {(["360° All Ground", "Offside Gaps", "V & Straight", "Legside Power"]).map((zone) => (
                    <button key={zone} onClick={() => setShotZone(zone)} className={shotZone === zone ? styles.selected : ""}>{zone}</button>
                  ))}
                </div>

                <div className={styles.riskReadout}>
                  <span><Zap size={14} /> Boundary intent</span>
                  <b>{aggression === "All out" ? "Very high" : aggression === "Attack" ? "High" : aggression === "Retain" ? "Low" : "Normal"}</b>
                </div>
                <div className={styles.riskReadout}>
                  <span><Shield size={14} /> Wicket risk</span>
                  <b>{aggression === "All out" ? "+70%" : aggression === "Attack" ? "+28%" : aggression === "Retain" ? "−38%" : "Baseline"}</b>
                </div>

                {/* Next Batter In Line & Selection */}
                <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[8.5px] font-extrabold uppercase text-white/70">
                    <span><Users size={11} className="inline mr-1 text-lime-400" /> Next Batter In Line</span>
                    <span className="text-white/40">{remainingBatters.length} in dugout</span>
                  </div>

                  {remainingBatters.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2">
                        <select
                          value={safeNextBatterIndex}
                          onChange={(e) => setNextBatterIndex(Number(e.target.value))}
                          className="w-full h-6 bg-[#0a0e10] border border-white/15 rounded text-[9.5px] text-white px-2 font-bold focus:outline-none"
                        >
                          {remainingBatters.map(({ player, index }) => (
                            <option value={index} key={player.id}>
                              {index + 1}. {player.name} ({player.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <div className="text-[9px] text-white/40 italic">All batters dismissed</div>
                  )}
                </div>
              </section>

              <section className={`${styles.panel} ${styles.batterPanel}`}>
                <div className={styles.panelHeading}><span><Users size={14} /> At the Crease</span></div>
                {[
                  { player: topBatter, line: topStats, strike: isTopStriker },
                  { player: bottomBatter, line: bottomStats, strike: isBottomStriker },
                ].map(({ player, line, strike }) => {
                  const currentStage = batterAggression[player.id] ?? "Balanced";
                  return (
                    <div className="flex flex-col gap-1 py-1 px-0.5 border-b border-white/10" key={player.id}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={styles.avatar}>{player.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                          <div className={styles.playerName}>
                            <strong>{player.name}</strong>
                            <small>{strike ? "ON STRIKE" : "NON-STRIKER"}</small>
                          </div>
                        </div>
                        <div className={styles.playerScore}>
                          <b>{line.runs}</b>
                          <small>{line.balls}b ({line.fours}x4, {line.sixes}x6)</small>
                        </div>
                      </div>

                      {/* 5-Stage Aggression Control Underneath Name */}
                      <div className="mt-1 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[8.5px] font-bold text-white/60 uppercase">
                          <span>Batter Aggression</span>
                          <span className="text-lime-400 font-extrabold">{currentStage}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1 bg-black/40 p-1 rounded border border-white/10">
                          {BATTING_STAGES.map((stage) => {
                            const isSelected = currentStage === stage;
                            return (
                              <button
                                key={stage}
                                onClick={() =>
                                  setBatterAggression((prev) => ({
                                    ...prev,
                                    [player.id]: stage,
                                  }))
                                }
                                className={`py-1 text-[7.5px] font-extrabold rounded leading-none transition-all cursor-pointer truncate ${
                                  isSelected
                                    ? "bg-lime-400 text-black shadow-sm font-black"
                                    : "text-white/50 hover:text-white hover:bg-white/10"
                                }`}
                                title={`Set ${player.name} aggression to ${stage}`}
                              >
                                {stage === "Dealing in 6s" ? "6s" : stage}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className={styles.partnership}>
                  <span>Current partnership</span>
                  <strong>{partnershipRuns}<small> runs</small></strong>
                </div>
              </section>
            </>
          )}

          {/* BOWLING CONTROLS (Displayed when activeRole === "bowling") */}
          {activeRole === "bowling" && (
            <>
              <section className={styles.panel}>
                <div className={styles.panelHeading}><span><Gauge size={14} /> Bowling Control</span><b>BOWLING</b></div>
                <div className={styles.bowlerCard}>
                  <span className={styles.avatar}>{bowler.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                  <div><small>CURRENT BOWLER</small><strong>{bowler.name}</strong><span>{overs(bowlerFigures.balls)} ov · {bowlerFigures.runs} runs · {bowlerFigures.wickets} wkts</span></div>
                </div>

                <label className={styles.selectLabel}>Change Bowler <ChevronDown size={13} /></label>
                <select value={safeBowlerIndex} onChange={(event) => setBowlerIndex(Number(event.target.value))}>
                  {bowlingOptions.map(({ player, index }) => <option value={index} key={player.id}>{player.name}</option>)}
                </select>

                <label className={styles.controlLabel}>Field Mentality</label>
                <div className={styles.fieldButtons}>
                  {(["Protect", "Balanced", "Hunt wickets"] as FieldPlan[]).map((plan) => (
                    <button key={plan} onClick={() => setFieldPlan(plan)} className={fieldPlan === plan ? styles.selected : ""}>{plan}</button>
                  ))}
                </div>

                <label className={styles.controlLabel}>Delivery Line & Length</label>
                <div className={styles.segmented}>
                  {(["Good Length", "Yorker Attack", "Bouncer & Pace", "Slower Cutters"]).map((tactic) => (
                    <button key={tactic} onClick={() => setBowlingTactics(tactic)} className={bowlingTactics === tactic ? styles.selected : ""}>{tactic}</button>
                  ))}
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeading}><span><Users size={14} /> Active Bowler Spells</span></div>
                <div className="flex flex-col gap-1.5 mt-1 overflow-y-auto max-h-[220px] pr-1">
                  {bowlingOptions.map(({ player, index }) => {
                    const line = bowlerLines[player.id] ?? { balls: 0, runs: 0, wickets: 0 };
                    const isActive = index === safeBowlerIndex;
                    return (
                      <div key={player.id} className={`flex items-center justify-between px-2 py-1.5 rounded border transition-all ${isActive ? "bg-white/10 border-yellow-400/80" : "bg-black/20 border-white/10"}`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isActive ? "bg-yellow-400" : "bg-white/20"}`} />
                          <span className="text-[10.5px] font-bold text-white">{player.name}</span>
                        </div>
                        <span className="text-[10.5px] font-mono font-bold text-white/90">
                          {line.wickets}-{line.runs} <small className="text-white/50">({overs(line.balls)})</small>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </aside>

        <section className={styles.centreStage}>
          {/* Preset Buttons & Rule Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 mr-1">
                {activeRole === "bowling" ? "Field Presets:" : "Opponent Field:"}
              </span>
              {activeRole === "bowling" ? (
                <>
                  {Object.keys(FIELD_PRESETS).map((name) => (
                    <button
                      key={name}
                      onClick={() => applyPreset(name)}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                        activePreset === name
                          ? "bg-amber-400 text-black shadow-md shadow-amber-400/20"
                          : "bg-white/10 hover:bg-white/20 text-white/80"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                  <button
                    onClick={() => applyPreset("Standard T20")}
                    className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/40 text-red-300 text-[10px] font-bold transition-all ml-1"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setShowZoneOverlay(!showZoneOverlay)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ml-1 flex items-center gap-1 ${
                      showZoneOverlay
                        ? "bg-emerald-400 text-black shadow-md shadow-emerald-400/20 font-extrabold"
                        : "bg-white/10 hover:bg-white/20 text-white/80"
                    }`}
                  >
                    🗺️ Zone Map: {showZoneOverlay ? "ON" : "OFF"}
                  </button>
                </>
              ) : (
                <span className="text-[10px] font-bold text-amber-300/90 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded">
                  {bowlingTeam.name} Field Alignment (Read Only)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className={styles.fieldingRuleBadge}>
                {isPowerplay ? "⚡ Powerplay (Overs 1-6)" : "🛡️ Overs 7-20"}
                <span className={outsideCircleCount > maxOutsideCircleAllowed ? "text-red-400 font-extrabold" : "text-emerald-400 font-extrabold"}>
                  {outsideCircleCount}/{maxOutsideCircleAllowed} Deep
                </span>
              </span>
              <span className={styles.fieldingRuleBadge}>
                Leg Behind Sq:
                <span className={legSideBehindSquareCount > 2 ? "text-red-400 font-extrabold" : "text-emerald-400 font-extrabold"}>
                  {legSideBehindSquareCount}/2 Max
                </span>
              </span>
            </div>
          </div>

          {/* Live Rule Warning Banners */}
          {isLegSideViolation && (
            <div className={styles.fieldingWarningBanner}>
              ⚠️ ILLEGAL FIELD: Max 2 fielders allowed behind square on leg side! ({legSideBehindSquareCount} placed)
            </div>
          )}
          {isCircleViolation && (
            <div className={styles.fieldingWarningBanner}>
              ⚠️ FIELD RESTRICTION: Max {maxOutsideCircleAllowed} fielders allowed outside 30-yd circle {isPowerplay ? "in Powerplay!" : "now!"} ({outsideCircleCount} placed)
            </div>
          )}

          <div className={styles.stadium}>
            <div className={styles.crowd} />
            <div ref={stadiumRef} className={styles.field}>
              <div className={styles.mownStripes} />
              <div className={styles.innerCircle} />

              {/* Visual Field Zone Overlay */}
              {showZoneOverlay && (
                <div className={styles.zoneOverlay}>
                  {FIELD_ZONES.map((zone) => {
                    const zoneLeft = isLhb ? 100 - (zone.left + zone.width) : zone.left;
                    const isActive = fieldPositions.some((pos) => {
                      const displayX = isLhb ? 100 - pos.x : pos.x;
                      return (
                        displayX >= zoneLeft &&
                        displayX <= zoneLeft + zone.width &&
                        pos.y >= zone.top &&
                        pos.y <= zone.top + zone.height
                      );
                    });

                    return (
                      <div
                        key={zone.name}
                        className={`${styles.zoneBox} ${isActive ? styles.activeZoneBox : ""}`}
                        style={{
                          left: `${zoneLeft}%`,
                          top: `${zone.top}%`,
                          width: `${zone.width}%`,
                          height: `${zone.height}%`,
                        }}
                      >
                        {zone.name}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className={styles.pitch}>
                <i className={styles.creaseTop} /><i className={styles.creaseBottom} />
                <span className={styles.stumpsTop} /><span className={styles.stumpsBottom} />
              </div>

              {/* Dynamic Animated Shot Ball flying across grass */}
              {activeShot && (
                <div
                  className={styles.shotBall}
                  style={{
                    left: `${activeShot.phase === "hit" ? activeShot.ballHitX : 50}%`,
                    top: `${activeShot.phase === "hit" ? activeShot.ballHitY : 59}%`,
                    opacity: activeShot.phase === "hit" ? 1 : 0,
                  }}
                />
              )}

              {/* Active Bowler Marker (Carries ball during runup and releases at crease line - Non-draggable) */}
              <div
                key={lastBall ? `bowler-${lastBall.id}` : "bowler-idle"}
                className={`${styles.fielder} ${styles.activeFielder} ${lastBall ? (lastBall.isSpinner ? styles.spinnerRunup : styles.pacerRunup) : ""}`}
                style={{ left: "48.4%", top: "40.1%" }}
              >
                <span className="relative">
                  B
                  {lastBall && <i className={styles.carriedBall} />}
                </span>
                <small>{surname(bowler.name)}</small>
              </div>

              {/* Non-Striker Marker (Mirrors to left side if LHB is on strike) */}
              <div
                className={`${styles.batterMarker} ${
                  activeShot && activeShot.phase === "hit" && activeShot.batRuns > 0 && activeShot.batRuns <= 3
                    ? styles[`runnerNonStriker${activeShot.batRuns}`]
                    : ""
                }`}
                style={{ left: isLhb ? "48.5%" : "51.5%", top: "40.5%" }}
              >
                <span style={{ color: battingTeam.primaryColor }}>▲</span>
                <b>{surname(nonStriker.name)}</b>
              </div>

              {/* Striker Marker (Shows LHB / RHB handedness indicator) */}
              <div
                className={`${styles.batterMarker} ${
                  activeShot && activeShot.phase === "hit" && activeShot.batRuns > 0 && activeShot.batRuns <= 3
                    ? styles[`runnerStriker${activeShot.batRuns}`]
                    : ""
                }`}
                style={{ left: "50%", top: "59%" }}
              >
                <span style={{ color: battingTeam.primaryColor }}>▲</span>
                <b className="flex items-center gap-1">
                  <span>{surname(striker.name)}</span>
                  <small className="text-[5.5px] px-1 py-0.2 rounded bg-amber-400/30 text-amber-300 font-extrabold">
                    {isLhb ? "LHB" : "RHB"}
                  </small>
                </b>
              </div>

              {/* Wicketkeeper (Fixed Behind Stumps - Non-draggable) */}
              <div className={styles.fielder} style={{ left: "50%", top: "73%" }}>
                <span>WK</span>
                <b>KEEPER</b>
                <small>{surname(bowlingXI.find((p) => p.role === "keeper")?.name ?? bowlingXI[1].name)}</small>
              </div>

              {/* 9 Fielders (Draggable when bowling, read-only when batting) */}
              {fieldPositions.map((pos, idx) => {
                const outfielders = bowlingXI.filter((p) => p.id !== bowler.id && p.role !== "keeper");
                const player = outfielders[idx] ?? bowlingXI[idx + 2] ?? bowlingXI[0];
                const isLegSide = isLhb ? pos.x > 50 : pos.x < 50;
                const isBehindSquare = pos.y > 56;
                const isLegBehindSquareOffender = isLegSideViolation && isLegSide && isBehindSquare;
                const isCircleOffender = isCircleViolation && Math.sqrt((pos.x - 50) ** 2 + (pos.y - 50) ** 2) > 29.5;
                const isOffending = isLegBehindSquareOffender || isCircleOffender;
                const isDraggable = activeRole === "bowling";

                const isGathering = activeShot && activeShot.phase === "hit" && activeShot.closestFielderIdx === idx && activeShot.batRuns > 0;
                const displayX = isGathering ? activeShot.ballHitX : (isLhb ? 100 - pos.x : pos.x);
                const displayY = isGathering ? activeShot.ballHitY : pos.y;

                return (
                  <div
                    key={pos.id}
                    className={`${styles.fielder} ${isDraggable ? styles.draggableFielder : ""} ${isDraggable && draggingIndex === idx ? styles.isDraggingFielder : ""} ${isOffending ? styles.isOffendingFielder : ""} ${isGathering ? styles.gatheringFielder : ""}`}
                    style={{ left: `${displayX}%`, top: `${displayY}%` }}
                    onPointerDown={isDraggable ? (e) => handlePointerDown(idx, e) : undefined}
                    onPointerMove={isDraggable ? (e) => handlePointerMove(idx, e) : undefined}
                    onPointerUp={isDraggable ? handlePointerUp : undefined}
                  >
                    {isGathering && <span className={styles.ballGatherBadge}>⚾ GATHER!</span>}
                    <span>{idx + 1}</span>
                    <b>{pos.label}</b>
                    <small>{surname(player.name)}</small>
                  </div>
                );
              })}
              {lastBall && (
                <div key={lastBall.id}>
                  {/* Dynamic Flight Path SVG Line */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
                    <path
                      d={`M ${lastBall.startX ?? 48.4}% 40.1% Q ${lastBall.pitchX ?? 50.0}% ${lastBall.pitchY ?? 49.5}% 50% 59.9%`}
                      fill="none"
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      className={styles.pitchPathStroke}
                    />
                  </svg>

                  {/* Dynamic Delivery Ball Flight (Pacer Seam vs Spinner Turn) */}
                  <div
                    className={lastBall.isSpinner ? styles.spinnerFlightBall : styles.pacerFlightBall}
                    style={
                      {
                        "--startX": `${lastBall.startX ?? 48.4}%`,
                        "--pitchX": `${lastBall.pitchX ?? 50.0}%`,
                        "--pitchY": `${lastBall.pitchY ?? 49.5}%`,
                      } as React.CSSProperties
                    }
                  />

                  {/* Shot / Outcome Trajectory from Batter Crease */}
                  <div
                    className={`${styles.shotTrajectoryPath} ${lastBall.six ? styles.shotTrajectorySix : ""}`}
                    style={{ "--angle": `${lastBall.angle}deg`, "--distance": `${lastBall.distance}px` } as React.CSSProperties}
                  >
                    <i />
                  </div>

                  {/* Wicket Burst Effect */}
                  {lastBall.wicket && <div className={styles.wicketBurst} />}
                </div>
              )}
            </div>
            <div className={styles.fieldCaption}>
              <span className={lastBall?.wicket ? styles.wicketTag : ""}>{lastBall?.label ?? "Ready for play"}</span>
              <p>{lastBall?.detail ?? `${bowler.name} has the ball. Set your approach and start the match.`}</p>
            </div>
          </div>

          <div className={styles.lowerTelemetry}>
            {isChasing ? (
              <>
                <div>
                  <small>Chase Equation</small>
                  <strong className="text-amber-300 font-extrabold">{battingTeam.shortName} need {runsNeeded} in {ballsRemaining}b</strong>
                  <span><i style={{ width: `${Math.min(100, (runs / targetRuns) * 100)}%`, background: battingTeam.primaryColor }} /></span>
                </div>
                <div>
                  <small>Required Rate</small>
                  <strong className="text-amber-300 font-extrabold">RRR {requiredRunRate}</strong>
                  <em>{Number(requiredRunRate) > Number(currentRunRate) ? "▲" : "▼"}</em>
                </div>
                <div>
                  <small>Target Score</small>
                  <strong>{targetRuns} runs</strong>
                  <span className="text-white/60">CRR {currentRunRate}</span>
                </div>
              </>
            ) : (
              <>
                <div><small>Win predictor</small><strong>{battingTeam.shortName} 54%</strong><span><i style={{ width: "54%", background: battingTeam.primaryColor }} /></span></div>
                <div><small>Momentum</small><strong>{lastBall?.wicket ? bowlingTeam.shortName : (lastBall?.runs ?? 0) >= 4 ? battingTeam.shortName : "EVEN"}</strong><em>{lastBall?.wicket ? "▼" : "▲"}</em></div>
                <div><small>Last 12 balls</small><strong>{deliveries.slice(0, 12).reduce((total, ball) => total + ball.runs, 0)} runs</strong><span>{deliveries.slice(0, 12).filter((ball) => ball.wicket).length} wickets</span></div>
              </>
            )}
          </div>
        </section>

        <aside className={styles.rightRail}>
          {/* RIGHT RAIL CONTENT SWITCHES BASED ON ACTIVE ROLE */}
          {activeRole === "batting" ? (
            <>
              <section className={`${styles.panel} ${styles.feedPanel}`}>
                <div className={styles.panelHeading}><span><Activity size={14} /> Live Match Feed</span><b>{deliveries.length}</b></div>
                <div className={`${styles.feed} max-h-[312px] h-[312px] overflow-y-auto`}>
                  {deliveries.length === 0 && <div className={styles.emptyFeed}>The next ball will appear here.</div>}
                  {deliveries.map((delivery, index) => (
                    <article
                      key={delivery.id}
                      className={`flex items-center gap-3 py-1.5 px-2 border-b border-white/10 ${
                        delivery.wicket
                          ? "bg-red-500/10 border-l-2 border-l-red-500"
                          : index === 0
                          ? "bg-white/5"
                          : ""
                      }`}
                    >
                      {/* Left Stack: Over Number on Top, Runs/Wicket Badge Underneath */}
                      <div className="flex flex-col items-center justify-center shrink-0 min-w-[42px] text-center leading-none pr-2.5 border-r border-white/15">
                        <time className="text-[9px] font-mono text-white/50">{delivery.over}</time>
                        <span
                          className={`text-[9.5px] font-black mt-1 px-1.5 py-0.5 rounded leading-none ${
                            delivery.wicket
                              ? "bg-red-600 text-white shadow-sm"
                              : delivery.runs === 6
                              ? "bg-yellow-400 text-black font-extrabold shadow-sm"
                              : delivery.runs === 4
                              ? "bg-amber-400 text-black font-extrabold shadow-sm"
                              : delivery.runs > 0
                              ? "bg-white/20 text-white"
                              : "bg-white/10 text-white/60"
                          }`}
                        >
                          {delivery.label}
                        </span>
                      </div>

                      {/* Right: Full Commentary Detail Text with Clean Padding */}
                      <div className="flex-1 min-w-0 pl-1 pr-1">
                        <p className="text-[10px] text-white/90 leading-normal m-0 whitespace-normal break-words">{delivery.detail}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeading}><span><Users size={14} /> Batting XI & Dugout</span></div>
                <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {battingXI.map((player, idx) => {
                    const isCrease = player.id === striker?.id || player.id === nonStriker?.id;
                    const line = batterLines[player.id];
                    const isOut = line?.state === "out";
                    return (
                      <div key={player.id} className={`flex items-center justify-between text-[10px] px-2 py-1 rounded border ${isCrease ? "bg-white/15 border-yellow-400 text-white font-bold" : isOut ? "opacity-40 border-white/5" : "bg-black/20 border-white/10 text-white/80"}`}>
                        <span>{idx + 1}. {player.name}</span>
                        <span className="font-mono">{isOut ? "OUT" : isCrease ? `${line?.runs ?? 0}* (${line?.balls ?? 0})` : "Yet to bat"}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          ) : (
            <>
              <section className={styles.panel}>
                <div className={styles.panelHeading}><span><Users size={14} /> Opponent Batters at Crease</span></div>
                {[
                  { player: topBatter, line: topStats, strike: isTopStriker },
                  { player: bottomBatter, line: bottomStats, strike: isBottomStriker },
                ].map(({ player, line, strike }) => (
                  <div className={styles.playerCard} key={player.id}>
                    <span className={styles.avatar}>{player.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                    <div className={styles.playerName}><strong>{player.name}</strong><small>{strike ? "ON STRIKE" : "NON-STRIKER"}</small></div>
                    <div className={styles.playerScore}><b>{line.runs}</b><small>{line.balls} balls</small></div>
                  </div>
                ))}
                <div className={styles.partnership}>
                  <span>Current partnership</span>
                  <strong>{partnershipRuns}<small> runs</small></strong>
                </div>
              </section>

              <section className={`${styles.panel} ${styles.feedPanel}`}>
                <div className={styles.panelHeading}><span><Activity size={14} /> Live Match Feed</span><b>{deliveries.length}</b></div>
                <div className={`${styles.feed} max-h-[312px] h-[312px] overflow-y-auto`}>
                  {deliveries.length === 0 && <div className={styles.emptyFeed}>The next ball will appear here.</div>}
                  {deliveries.map((delivery, index) => (
                    <article
                      key={delivery.id}
                      className={`flex items-center gap-3 py-1.5 px-2 border-b border-white/10 ${
                        delivery.wicket
                          ? "bg-red-500/10 border-l-2 border-l-red-500"
                          : index === 0
                          ? "bg-white/5"
                          : ""
                      }`}
                    >
                      {/* Left Stack: Over Number on Top, Runs/Wicket Badge Underneath */}
                      <div className="flex flex-col items-center justify-center shrink-0 min-w-[42px] text-center leading-none pr-2.5 border-r border-white/15">
                        <time className="text-[9px] font-mono text-white/50">{delivery.over}</time>
                        <span
                          className={`text-[9.5px] font-black mt-1 px-1.5 py-0.5 rounded leading-none ${
                            delivery.wicket
                              ? "bg-red-600 text-white shadow-sm"
                              : delivery.runs === 6
                              ? "bg-yellow-400 text-black font-extrabold shadow-sm"
                              : delivery.runs === 4
                              ? "bg-amber-400 text-black font-extrabold shadow-sm"
                              : delivery.runs > 0
                              ? "bg-white/20 text-white"
                              : "bg-white/10 text-white/60"
                          }`}
                        >
                          {delivery.label}
                        </span>
                      </div>

                      {/* Right: Full Commentary Detail Text with Clean Padding */}
                      <div className="flex-1 min-w-0 pl-1 pr-1">
                        <p className="text-[10px] text-white/90 leading-normal m-0 whitespace-normal break-words">{delivery.detail}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </aside>
      </section>

      {/* Official TATA IPL TV Broadcast Scorecard Banner */}
      <footer className="h-[64px] bg-[#000] px-0 flex items-center justify-center font-[family-name:var(--font-bricolage)] select-none relative z-20 overflow-hidden shadow-2xl border-t border-white/15">
        
        {/* Quick Team Switcher Button on Bottom Left of Footer */}
        <button
          onClick={() => setShowSetup(true)}
          className="absolute left-3 z-30 flex items-center gap-1.5 bg-[#0e131f]/90 hover:bg-[#1a2235] text-white text-[11px] font-bold px-2.5 py-1 rounded border border-white/20 hover:border-yellow-400/60 shadow-lg backdrop-blur-md transition-all cursor-pointer group active:scale-95"
          title="Change Teams & Test Colors"
        >
          <span className="text-yellow-400 text-xs group-hover:rotate-180 transition-transform duration-300">🔄</span>
          <span>Change Teams</span>
        </button>

        {/* Full Width Outer Container with Team Color Background Gradient */}
        <div
          className="w-full h-full flex items-center justify-center relative overflow-hidden font-[family-name:var(--font-bricolage)]"
          style={{
            background: `linear-gradient(90deg, ${battingTeam.primaryColor} 0%, ${battingTeam.primaryColor} 45%, #040508 50%, ${bowlingTeam.primaryColor} 55%, ${bowlingTeam.primaryColor} 100%)`,
          }}
        >
          {/* ONE SINGLE CENTRALIZED BROADCAST OBJECT (From Left Logo to Right Logo) */}
          <div className="flex items-center justify-center h-full shrink-0 mx-auto relative z-10">

            {/* 1. LEFT BATTING GROUP (Solid Batting Team Color background so batters never hover over black) */}
            <div
              className="flex items-center gap-5 px-5 h-full relative"
              style={{
                backgroundColor: `${battingTeam.primaryColor}`,
              }}
            >
              {/* Circular Team Badge */}
              <div
                className="w-10 h-10 rounded-full border-2 border-yellow-400/90 flex items-center justify-center text-base font-extrabold text-white shadow-xl shrink-0"
                style={{
                  backgroundColor: `${battingTeam.primaryColor}CC`,
                  boxShadow: `0 0 14px ${battingTeam.primaryColor}bb`,
                }}
              >
                {battingTeam.shortName}
              </div>

              {/* Team Short Name & Opponent */}
              <div className="flex flex-col leading-none justify-center">
                <span className="text-xl font-black tracking-wider leading-none" style={{ color: battingTextColor }}>
                  {battingTeam.shortName}
                </span>
                <span className="text-[9.5px] font-bold tracking-wide mt-1" style={{ color: `${battingTextColor}CC` }}>
                  v {bowlingTeam.shortName}
                </span>
              </div>

              {/* Score (Runs-Wickets in Batting Team Secondary Color / Orange for LSG) */}
              <div className="text-2xl font-black tracking-tight px-1 leading-none" style={{ color: scoreColor }}>
                {runs}-{wickets}
              </div>

              {/* Target Pill during Chasing Mode */}
              {isChasing && (
                <div className="flex flex-col justify-center leading-none px-1.5 py-0.5 rounded bg-black/40 border border-white/20 text-white">
                  <span className="text-[7px] font-black uppercase tracking-wider text-white/70">TARGET</span>
                  <span className="text-xs font-black text-white text-center leading-none mt-0.5">{targetRuns}</span>
                </div>
              )}

              {/* Powerplay Badge (PP) during Overs 1-6 (balls < 36) */}
              {balls < 36 && (
                <div
                  className="text-[10px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-tighter leading-none flex items-center justify-center shadow-sm"
                  style={{
                    backgroundColor: battingTeam.secondaryColor,
                    color: ["#f4b41b", "#f5c842", "#e5b842", "#f9cd05", "#ffffff"].includes(battingTeam.secondaryColor?.toLowerCase() ?? "")
                      ? "#000000"
                      : "#ffffff",
                  }}
                >
                  PP
                </div>
              )}

              {/* Overs & Hashtag */}
              <div className="flex flex-col leading-none justify-center">
                <span className="text-lg font-extrabold tracking-tight leading-none" style={{ color: battingTextColor }}>
                  {overs(balls)}
                </span>
                <span className="text-[8.5px] font-bold tracking-tighter mt-1" style={{ color: `${battingTextColor}B3` }}>
                  #{battingTeam.shortName}v{bowlingTeam.shortName}
                </span>
              </div>

              {/* Vertical Divider Line 1 (Batting Team Secondary Color) */}
              <div
                className="shrink-0 rounded-full"
                style={{
                  width: "1.5px",
                  minWidth: "1.5px",
                  maxWidth: "1.5px",
                  height: "28px",
                  marginLeft: "4px",
                  marginRight: "4px",
                  backgroundColor: battingTeam.secondaryColor,
                }}
              />

              {/* Batters At The Crease (Solid Batting Color Background) */}
              <div className="flex flex-col justify-center leading-none min-w-[235px] gap-0.5 py-0 my-0" style={{ color: battingTextColor }}>
                {/* Top Batter */}
                {topBatter && (
                  <div className="flex items-center justify-between gap-4 leading-none text-[19px] font-black" style={{ color: battingTextColor }}>
                    <span className="tracking-wide flex items-center gap-1 leading-none">
                      <span className="w-3 text-center inline-block font-black text-sm leading-none shrink-0" style={{ color: battingTextColor }}>
                        {isTopStriker ? ">" : ""}
                      </span>
                      <span className="leading-none">{surname(topBatter.name).toUpperCase()}</span>
                    </span>
                    <span className="font-black text-[19px] leading-none" style={{ color: battingTextColor }}>
                      {topStats.runs} <span className="text-[12px] font-semibold ml-0.5" style={{ color: `${battingTextColor}CC` }}>{topStats.balls}</span>
                    </span>
                  </div>
                )}

                {/* Bottom Batter */}
                {bottomBatter && (
                  <div className="flex items-center justify-between gap-4 leading-none text-[19px] font-black" style={{ color: battingTextColor }}>
                    <span className="tracking-wide flex items-center gap-1 leading-none">
                      <span className="w-3 text-center inline-block font-black text-sm leading-none shrink-0" style={{ color: battingTextColor }}>
                        {isBottomStriker ? ">" : ""}
                      </span>
                      <span className="leading-none">{surname(bottomBatter.name).toUpperCase()}</span>
                    </span>
                    <span className="font-black text-[19px] leading-none" style={{ color: battingTextColor }}>
                      {bottomStats.runs} <span className="text-[12px] font-semibold ml-0.5" style={{ color: `${battingTextColor}CC` }}>{bottomStats.balls}</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Vertical Divider Line 2 (Batting Team Secondary Color) */}
              <div
                className="shrink-0 rounded-full"
                style={{
                  width: "1.5px",
                  minWidth: "1.5px",
                  maxWidth: "1.5px",
                  height: "28px",
                  marginLeft: "4px",
                  marginRight: "4px",
                  backgroundColor: battingTeam.secondaryColor,
                }}
              />
            </div>

            {/* Gradient transition into solid black center section */}
            <div
              className="w-3 h-full shrink-0"
              style={{
                background: `linear-gradient(90deg, ${battingTeam.primaryColor} 0%, #040508 100%)`,
              }}
            />

            {/* 2. CENTER TOSS / CRR / RRR / CHASE EQUATION SECTION */}
            <div className="h-full bg-[#040508] flex flex-col items-center justify-center px-3 leading-none shrink-0 z-10 shadow-2xl min-w-[76px]">
              {isChasing ? (
                (runsNeeded < 30 || balls > 72) ? (
                  <>
                    <span className="text-[7.5px] font-extrabold text-white uppercase tracking-widest text-center">{runsNeeded} REQUIRED</span>
                    <span className="text-xs text-white font-black tracking-wider mt-0.5 text-center">OF {ballsRemaining} BALLS</span>
                  </>
                ) : (
                  <>
                    <span className="text-[7.5px] font-extrabold text-white uppercase tracking-widest text-center">RRR</span>
                    <span className="text-xs text-white font-black tracking-wider mt-0.5 text-center">{requiredRunRate}</span>
                  </>
                )
              ) : runs < 20 ? (
                <>
                  <span className="text-[7.5px] font-extrabold text-white/70 uppercase tracking-widest text-center">TOSS</span>
                  <span className="text-xs text-white font-black tracking-wider mt-0.5 text-center">{battingTeam.shortName}</span>
                </>
              ) : (
                <>
                  <span className="text-[7.5px] font-extrabold text-white uppercase tracking-widest text-center">CRR</span>
                  <span className="text-xs text-white font-black tracking-wider mt-0.5 text-center">{currentRunRate}</span>
                </>
              )}
            </div>

            {/* Gradient transition out of solid black into bowling team color */}
            <div
              className="w-3 h-full shrink-0"
              style={{
                background: `linear-gradient(90deg, #040508 0%, ${bowlingTeam.primaryColor} 100%)`,
              }}
            />

            {/* 3. RIGHT BOWLING GROUP (Solid Bowling Team Color Background) */}
            <div
              className="flex items-center gap-4 px-5 h-full relative"
              style={{
                backgroundColor: `${bowlingTeam.primaryColor}`,
              }}
            >
              {/* Vertical Divider Line 3 (Bowling Team Secondary Color) */}
              <div
                className="shrink-0 rounded-full"
                style={{
                  width: "1.5px",
                  minWidth: "1.5px",
                  maxWidth: "1.5px",
                  height: "28px",
                  marginLeft: "4px",
                  marginRight: "4px",
                  backgroundColor: bowlingTeam.secondaryColor,
                }}
              />
              {/* Bowler Figures & Over Deliveries (Reserved 270px width so 10 delivery boxes expand leftwards safely) */}
              <div className="flex flex-col text-right leading-none justify-center shrink-0 min-w-[270px]">
                <div className="flex items-center justify-end gap-2 text-xs">
                  <span className="font-extrabold tracking-wide uppercase" style={{ color: bowlingTextColor }}>{surname(bowler.name)}</span>
                  <span className="font-extrabold text-xs" style={{ color: bowlingTextColor }}>
                    {bowlerFigures.wickets}-{bowlerFigures.runs} <span className="text-[10px] font-normal ml-1" style={{ color: `${bowlingTextColor}B3` }}>{overs(bowlerFigures.balls)}</span>
                  </span>
                </div>
                {/* Square Boxes Representing Deliveries of Current Over (Left to Right) */}
                <div className="flex items-center gap-1 mt-1 justify-end flex-nowrap shrink-0">
                  {currentOverDeliveries.map((ball, idx) => (
                    <span
                      key={idx}
                      className={`h-4 ${ball.label.length > 2 ? "px-1.5 min-w-[26px]" : ball.label.length > 1 ? "px-1 min-w-[20px]" : "w-4"} rounded-none text-[9.5px] font-black flex items-center justify-center border transition-all ${
                        !ball.active
                          ? "bg-black/40 border-white/30 text-transparent"
                          : ball.wicket
                          ? "bg-red-600 border-red-400 text-white shadow-sm"
                          : ball.six || ball.four || ball.extra
                          ? "bg-yellow-400 border-yellow-300 text-black shadow-sm"
                          : "bg-white border-white text-black shadow-sm"
                      }`}
                    >
                      {ball.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Circular Team Badge */}
              <div
                className="w-10 h-10 rounded-full border-2 border-yellow-400/90 flex items-center justify-center text-base font-extrabold text-white shadow-xl shrink-0"
                style={{
                  backgroundColor: `${bowlingTeam.primaryColor}CC`,
                  boxShadow: `0 0 14px ${bowlingTeam.primaryColor}bb`,
                }}
              >
                {bowlingTeam.shortName}
              </div>
            </div>

          </div>
        </div>
      </footer>

      {/* Setup Modal */}
      {showSetup && (
        <div className={styles.modalBackdrop} onMouseDown={() => setShowSetup(false)}>
          <section className={styles.setupModal} onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}><div><small>EXHIBITION SETUP</small><h2>Choose the matchup</h2></div><button onClick={() => setShowSetup(false)}><X size={19} /></button></div>
            <label>Batting first</label>
            <select value={battingTeamId} onChange={(event) => setBattingTeamId(event.target.value)}>
              {availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <label>Bowling first</label>
            <select value={bowlingTeamId} onChange={(event) => setBowlingTeamId(event.target.value)}>
              {availableTeams.filter((team) => team.id !== battingTeamId).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <div className={styles.lineupPreview}>
              <Users size={17} />
              <div><strong>Full XIs loaded</strong><span>{battingTeam.players.length + bowlingTeam.players.length} named players ready on the field</span></div>
            </div>
            <button className={styles.confirmButton} onClick={confirmTeams}>Load match</button>
          </section>
        </div>
      )}
    </main>
  );
}
