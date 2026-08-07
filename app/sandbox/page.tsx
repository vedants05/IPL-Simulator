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
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { calculateMatchTemperature, venueRainProbability } from "@/lib/logic/matchSimulation";
import styles from "./sandbox.module.css";

type PlayerRole = "batter" | "bowler" | "allrounder" | "keeper";
type Aggression = "Retain" | "Balanced" | "Attack" | "All out";
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
      ["mi-5", "Hardik Pandya", "allrounder", 88, 84],
      ["mi-6", "Tim David", "batter", 84, 18],
      ["mi-7", "Romario Shepherd", "allrounder", 76, 82],
      ["mi-8", "Gerald Coetzee", "bowler", 35, 84],
      ["mi-9", "Jasprit Bumrah", "bowler", 19, 96],
      ["mi-10", "Piyush Chawla", "bowler", 32, 82],
      ["mi-11", "Akash Madhwal", "bowler", 21, 79],
    ].map(([id, name, role, batting, bowling]) => ({
      id: id as string,
      name: name as string,
      role: role as PlayerRole,
      batting: batting as number,
      bowling: bowling as number,
    })),
  },
  {
    id: "LSG",
    name: "Lucknow Super Giants",
    shortName: "LSG",
    primaryColor: "#e21f26",
    secondaryColor: "#0057e2",
    players: [
      ["lsg-1", "KL Rahul", "batter", 89, 10],
      ["lsg-2", "Quinton de Kock", "keeper", 87, 12],
      ["lsg-3", "Devdutt Padikkal", "batter", 81, 10],
      ["lsg-4", "Marcus Stoinis", "allrounder", 86, 78],
      ["lsg-5", "Nicholas Pooran", "keeper", 90, 8],
      ["lsg-6", "Ayush Badoni", "batter", 80, 25],
      ["lsg-7", "Krunal Pandya", "allrounder", 78, 83],
      ["lsg-8", "Ravi Bishnoi", "bowler", 22, 87],
      ["lsg-9", "Naveen-ul-Haq", "bowler", 28, 83],
      ["lsg-10", "Mohsin Khan", "bowler", 20, 82],
      ["lsg-11", "Mayank Yadav", "bowler", 15, 88],
    ].map(([id, name, role, batting, bowling]) => ({
      id: id as string,
      name: name as string,
      role: role as PlayerRole,
      batting: batting as number,
      bowling: bowling as number,
    })),
  },
];

const FIELD_POSITIONS = [
  { label: "WK", x: 50, y: 63 },
  { label: "Slip", x: 41, y: 58 },
  { label: "Point", x: 24, y: 47 },
  { label: "Cover", x: 34, y: 31 },
  { label: "Mid off", x: 44, y: 39 },
  { label: "Mid on", x: 58, y: 39 },
  { label: "Square", x: 75, y: 49 },
  { label: "Fine leg", x: 68, y: 72 },
  { label: "Third", x: 28, y: 73 },
  { label: "Long off", x: 31, y: 16 },
  { label: "Long on", x: 70, y: 17 },
];

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
  const [fieldPlan, setFieldPlan] = useState<FieldPlan>("Balanced");
  const [runs, setRuns] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [balls, setBalls] = useState(0);
  const [strikerIndex, setStrikerIndex] = useState(0);
  const [nonStrikerIndex, setNonStrikerIndex] = useState(1);
  const [nextBatterIndex, setNextBatterIndex] = useState(2);
  const [bowlerIndex, setBowlerIndex] = useState(0);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [batterLines, setBatterLines] = useState<Record<string, BatterLine>>({});
  const [bowlerLines, setBowlerLines] = useState<Record<string, BowlerLine>>({});

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
  const lastBall = deliveries[0];
  const inningsComplete = wickets >= 10 || balls >= 120;
  const currentRunRate = balls ? (runs * 6) / balls : 0;
  const projected = balls ? Math.round((runs / balls) * 120) : 0;

  const resetMatch = useCallback(() => {
    const firstBowler = bowlingOptions[0]?.index ?? 0;
    setIsPlaying(false);
    setRuns(0);
    setWickets(0);
    setBalls(0);
    setStrikerIndex(0);
    setNonStrikerIndex(1);
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
    if (inningsComplete || !striker || !nonStriker || !bowler) {
      setIsPlaying(false);
      return;
    }

    const aggressionRisk: Record<Aggression, number> = {
      Retain: 0.018,
      Balanced: 0.035,
      Attack: 0.065,
      "All out": 0.105,
    };
    const fieldPressure: Record<FieldPlan, number> = {
      Protect: 0.82,
      Balanced: 1,
      "Hunt wickets": 1.28,
    };
    const wicketChance = aggressionRisk[aggression] * fieldPressure[fieldPlan] * (0.8 + bowler.bowling / 220);
    const wicket = Math.random() < wicketChance;
    const extraRoll = Math.random();
    const isNoBall = !wicket && extraRoll < 0.04;
    const isWide = !wicket && !isNoBall && extraRoll > 0.94;
    const isLegal = !isNoBall && !isWide;

    const roll = Math.random();
    const attackBoost = aggression === "All out" ? 0.2 : aggression === "Attack" ? 0.1 : aggression === "Retain" ? -0.1 : 0;
    const scoringRoll = roll + attackBoost + (striker.batting - bowler.bowling) / 500;

    let ballRuns = 0;
    let batRuns = 0;
    let extraType: "nb" | "wd" | null = null;
    let ballTag = "";
    let label = "Dot ball";
    let detail = `${bowler.name} finds a tight line. ${striker.name} cannot pierce the ring.`;

    if (wicket) {
      const dismissals = ["taken at cover", "bowled through the gate", "caught on the rope", "trapped in front"];
      label = "WICKET";
      detail = `${striker.name} is ${dismissals[Math.floor(Math.random() * dismissals.length)]}. ${bowler.name} has the breakthrough.`;
      ballTag = "W";
    } else if (isNoBall) {
      extraType = "nb";
      batRuns = scoringRoll > 0.91 ? 6 : scoringRoll > 0.76 ? 4 : scoringRoll > 0.5 ? 1 : 0;
      ballRuns = 1 + batRuns;
      ballTag = batRuns > 0 ? `NB+${batRuns}` : "NB";
      label = batRuns > 0 ? `NO BALL (+${batRuns})` : "NO BALL";
      detail = `${bowler.name} oversteps the crease! ${batRuns > 0 ? `${striker.name} smashes it for ${batRuns} runs.` : ""}`;
    } else if (isWide) {
      extraType = "wd";
      ballRuns = 1;
      ballTag = "WD";
      label = "WIDE";
      detail = `${bowler.name} strays wide down the leg side. Extra run awarded.`;
    } else {
      batRuns = scoringRoll > 0.91 ? 6 : scoringRoll > 0.76 ? 4 : scoringRoll > 0.6 ? 2 : scoringRoll > 0.32 ? 1 : 0;
      ballRuns = batRuns;
      ballTag = String(ballRuns);
      if (ballRuns === 6) {
        label = "SIX";
        detail = `${striker.name} commits early and launches it cleanly into the crowd.`;
      } else if (ballRuns === 4) {
        label = "FOUR";
        detail = `${striker.name} finds the gap and the outfield does the rest.`;
      } else if (ballRuns > 0) {
        label = `${ballRuns} run${ballRuns > 1 ? "s" : ""}`;
        detail = `${striker.name} works it into space. The pair complete ${ballRuns}.`;
      }
    }

    const currentOverNum = Math.floor(balls / 6);
    const legalBallNumInOver = (balls % 6) + (isLegal ? 1 : 0);
    const ballLabel = `${currentOverNum}.${isLegal ? legalBallNumInOver : (balls % 6) + 1}`;
    const angle = Math.round(Math.random() * 250 - 125);
    const distance = wicket || ballRuns === 0 ? 18 : ballRuns >= 4 ? 88 : ballRuns === 2 ? 56 : 38;

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
    }, ...items].slice(0, 36));

    let nextStriker = strikerIndex;
    let nextNonStriker = nonStrikerIndex;
    if (wicket) {
      setWickets((value) => value + 1);
      if (nextBatterIndex < battingXI.length) {
        nextStriker = nextBatterIndex;
        setNextBatterIndex((value) => value + 1);
        const incoming = battingXI[nextBatterIndex];
        setBatterLines((lines) => ({
          ...lines,
          [incoming.id]: { ...(lines[incoming.id] ?? { runs: 0, balls: 0, fours: 0, sixes: 0 }), state: "in" },
        }));
      }
    } else if (batRuns % 2 === 1) {
      [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
    }

    if (isLegal && (balls + 1) % 6 === 0) {
      [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
      const eligible = bowlingOptions.map(({ index }) => index).filter((index) => index !== safeBowlerIndex);
      if (eligible.length) setBowlerIndex(eligible[Math.floor(Math.random() * eligible.length)]);
    }
    setStrikerIndex(nextStriker);
    setNonStrikerIndex(nextNonStriker);
  }, [aggression, balls, battingXI, bowler, bowlingOptions, deliveries, fieldPlan, inningsComplete, nextBatterIndex, nonStriker, nonStrikerIndex, safeBowlerIndex, striker, strikerIndex]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setTimeout(simulateBall, Math.max(180, 1050 / speed));
    return () => window.clearTimeout(timer);
  }, [isPlaying, simulateBall, speed]);

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

  const isStrikerFirst = strikerIndex <= nonStrikerIndex;
  const topBatter = isStrikerFirst ? striker : nonStriker;
  const bottomBatter = isStrikerFirst ? nonStriker : striker;
  const topStats = isStrikerFirst ? strikerStats : nonStrikerStats;
  const bottomStats = isStrikerFirst ? nonStrikerStats : strikerStats;
  const isTopStriker = isStrikerFirst;
  const isBottomStriker = !isStrikerFirst;

  const matchDate = "15 Apr 2027";
  const matchTime = "19:30 IST (Night)";
  const stadiumName = "Wankhede Stadium, Mumbai";
  const pitchType = "Balanced Pitch";
  const tempCelsius = calculateMatchTemperature("sandbox-seed", "wankhede-stadium", "2027-04-15", "19:30");
  const rainProbPercent = Math.round(venueRainProbability("wankhede-stadium", "2027-04-15") * 100);
  const battingTextColor = battingTeam.textColor ?? getTextColor(battingTeam.id);
  const bowlingTextColor = bowlingTeam.textColor ?? getTextColor(bowlingTeam.id);
  const scoreColor = battingTeam.id === "LSG" ? "#FF6B00" : battingTeam.secondaryColor;

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

        {/* Right Header Controls (From rightmost to left: Pause/Resume, Next Ball, Speed Control) */}
        <div className="flex items-center gap-3">
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
          <section className={styles.panel}>
            <div className={styles.panelHeading}><span><Target size={14} /> Innings control</span><b>LIVE</b></div>
            <div className={styles.phaseCard}>
              <div><small>Phase</small><strong>{balls < 36 ? "POWERPLAY" : balls < 90 ? "MIDDLE OVERS" : "DEATH OVERS"}</strong></div>
              <span>{balls < 36 ? `${36 - balls} balls left` : `${120 - balls} balls left`}</span>
              <div className={styles.phaseTrack}><i style={{ width: `${Math.min(100, (balls / 120) * 100)}%` }} /></div>
            </div>
            <label className={styles.controlLabel}>Batting intent</label>
            <div className={styles.segmented}>
              {(["Retain", "Balanced", "Attack", "All out"] as Aggression[]).map((option) => (
                <button key={option} onClick={() => setAggression(option)} className={aggression === option ? styles.selected : ""}>{option}</button>
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
          </section>

          <section className={`${styles.panel} ${styles.batterPanel}`}>
            <div className={styles.panelHeading}><span><Users size={14} /> At the crease</span></div>
            {[
              { player: striker, line: strikerStats, strike: true },
              { player: nonStriker, line: nonStrikerStats, strike: false },
            ].map(({ player, line, strike }) => (
              <div className={styles.playerCard} key={`${player.id}-${strike}`}>
                <span className={styles.avatar}>{player.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                <div className={styles.playerName}><strong>{player.name}</strong><small>{strike ? "ON STRIKE" : "NON-STRIKER"}</small></div>
                <div className={styles.playerScore}><b>{line.runs}</b><small>{line.balls} balls</small></div>
              </div>
            ))}
            <div className={styles.partnership}>
              <span>Current partnership</span>
              <strong>{strikerStats.runs + nonStrikerStats.runs}<small> runs</small></strong>
            </div>
          </section>
        </aside>

        <section className={styles.centreStage}>
          <div className={styles.fieldHeader}>
            <div><CircleDot size={14} /><span>TACTICAL FIELD</span><b>{fieldPlan.toUpperCase()}</b></div>
            <div className={styles.weather}><span>24°C</span><i /> <span>Clear</span><i /> <span>Light dew</span></div>
          </div>

          <div className={styles.stadium}>
            <div className={styles.crowd} />
            <div className={styles.field}>
              <div className={styles.mownStripes} />
              <div className={styles.innerCircle} />
              <div className={styles.pitch}>
                <i className={styles.creaseTop} /><i className={styles.creaseBottom} />
                <span className={styles.stumpsTop} /><span className={styles.stumpsBottom} />
              </div>

              {FIELD_POSITIONS.map((position, index) => {
                const player = bowlingXI[index] ?? bowlingXI[0];
                const isBowler = player.id === bowler.id;
                const adjustedX = fieldPlan === "Hunt wickets" ? 50 + (position.x - 50) * 0.78 : fieldPlan === "Protect" ? 50 + (position.x - 50) * 1.12 : position.x;
                const adjustedY = fieldPlan === "Hunt wickets" ? 50 + (position.y - 50) * 0.8 : fieldPlan === "Protect" ? 50 + (position.y - 50) * 1.08 : position.y;
                return (
                  <div key={player.id} className={`${styles.fielder} ${isBowler ? styles.activeFielder : ""}`} style={{ left: `${adjustedX}%`, top: `${adjustedY}%` }}>
                    <span>{index + 1}</span>
                    <b>{isBowler ? "BOWLER" : position.label}</b>
                    <small>{surname(player.name)}</small>
                  </div>
                );
              })}

              <div className={styles.batterMarker}><span>▲</span><b>{surname(striker.name)}</b></div>
              {lastBall && (
                <div key={lastBall.id} className={styles.ballPath} style={{ "--angle": `${lastBall.angle}deg`, "--distance": `${lastBall.distance}px` } as React.CSSProperties}>
                  <i />
                </div>
              )}
            </div>
            <div className={styles.fieldCaption}>
              <span className={lastBall?.wicket ? styles.wicketTag : ""}>{lastBall?.label ?? "Ready for play"}</span>
              <p>{lastBall?.detail ?? `${bowler.name} has the ball. Set your approach and start the match.`}</p>
            </div>
          </div>

          <div className={styles.lowerTelemetry}>
            <div><small>Win predictor</small><strong>{battingTeam.shortName} 54%</strong><span><i style={{ width: "54%", background: battingTeam.primaryColor }} /></span></div>
            <div><small>Momentum</small><strong>{lastBall?.wicket ? bowlingTeam.shortName : (lastBall?.runs ?? 0) >= 4 ? battingTeam.shortName : "EVEN"}</strong><em>{lastBall?.wicket ? "▼" : "▲"}</em></div>
            <div><small>Last 12 balls</small><strong>{deliveries.slice(0, 12).reduce((total, ball) => total + ball.runs, 0)} runs</strong><span>{deliveries.slice(0, 12).filter((ball) => ball.wicket).length} wickets</span></div>
          </div>
        </section>

        <aside className={styles.rightRail}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}><span><Gauge size={14} /> Bowling plan</span></div>
            <div className={styles.bowlerCard}>
              <span className={styles.avatar}>{bowler.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
              <div><small>CURRENT BOWLER</small><strong>{bowler.name}</strong><span>{overs(bowlerFigures.balls)} ov · {bowlerFigures.runs} runs · {bowlerFigures.wickets} wkts</span></div>
            </div>
            <label className={styles.selectLabel}>Change bowler <ChevronDown size={13} /></label>
            <select value={safeBowlerIndex} onChange={(event) => setBowlerIndex(Number(event.target.value))}>
              {bowlingOptions.map(({ player, index }) => <option value={index} key={player.id}>{player.name}</option>)}
            </select>
            <label className={styles.controlLabel}>Field mentality</label>
            <div className={styles.fieldButtons}>
              {(["Protect", "Balanced", "Hunt wickets"] as FieldPlan[]).map((plan) => (
                <button key={plan} onClick={() => setFieldPlan(plan)} className={fieldPlan === plan ? styles.selected : ""}>{plan}</button>
              ))}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.feedPanel}`}>
            <div className={styles.panelHeading}><span><Activity size={14} /> Live match feed</span><b>{deliveries.length}</b></div>
            <div className={styles.feed}>
              {deliveries.length === 0 && <div className={styles.emptyFeed}>The next ball will appear here.</div>}
              {deliveries.map((delivery, index) => (
                <article key={delivery.id} className={`${delivery.wicket ? styles.feedWicket : ""} ${index === 0 ? styles.latest : ""}`}>
                  <time>{delivery.over}</time>
                  <div><strong>{delivery.label}</strong><p>{delivery.detail}</p></div>
                </article>
              ))}
            </div>
          </section>
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

            {/* 2. CENTER TOSS / CRR SECTION (Switches from TOSS to CRR once batting team reaches 20+ runs) */}
            <div className="h-full bg-[#040508] flex flex-col items-center justify-center px-4 leading-none shrink-0 z-10 shadow-2xl">
              {runs < 20 ? (
                <>
                  <span className="text-[7.5px] font-extrabold text-white/70 uppercase tracking-widest text-center">TOSS</span>
                  <span className="text-xs text-white font-black tracking-wider mt-0.5 text-center">{battingTeam.shortName}</span>
                </>
              ) : (
                <>
                  <span className="text-[7.5px] font-extrabold text-white uppercase tracking-widest text-center">CRR</span>
                  <span className="text-xs text-white font-black tracking-wider mt-0.5 text-center">{currentRunRate.toFixed(2)}</span>
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
