"use client";

import Link from "next/link";
import {
  Activity,
  ChevronDown,
  CircleDot,
  Gauge,
  Pause,
  Play,
  RefreshCcw,
  Settings2,
  Shield,
  SkipForward,
  Target,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
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
  players: SandboxPlayer[];
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
    secondaryColor: "#111827",
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
        primaryColor: team.primaryColor || "#6ee7b7",
        secondaryColor: team.secondaryColor || "#111827",
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
    const roll = Math.random();
    const attackBoost = aggression === "All out" ? 0.2 : aggression === "Attack" ? 0.1 : aggression === "Retain" ? -0.1 : 0;
    const scoringRoll = roll + attackBoost + (striker.batting - bowler.bowling) / 500;
    const ballRuns = wicket ? 0 : scoringRoll > 0.91 ? 6 : scoringRoll > 0.76 ? 4 : scoringRoll > 0.6 ? 2 : scoringRoll > 0.32 ? 1 : 0;
    const currentBall = balls + 1;
    const ballLabel = `${Math.floor(balls / 6)}.${(balls % 6) + 1}`;
    const angle = Math.round(Math.random() * 250 - 125);
    const distance = wicket || ballRuns === 0 ? 18 : ballRuns >= 4 ? 88 : ballRuns === 2 ? 56 : 38;

    let label = "Dot ball";
    let detail = `${bowler.name} finds a tight line. ${striker.name} cannot pierce the ring.`;
    if (wicket) {
      const dismissals = ["taken at cover", "bowled through the gate", "caught on the rope", "trapped in front"];
      label = "WICKET";
      detail = `${striker.name} is ${dismissals[Math.floor(Math.random() * dismissals.length)]}. ${bowler.name} has the breakthrough.`;
    } else if (ballRuns === 6) {
      label = "SIX";
      detail = `${striker.name} commits early and launches it cleanly into the crowd.`;
    } else if (ballRuns === 4) {
      label = "FOUR";
      detail = `${striker.name} finds the gap and the outfield does the rest.`;
    } else if (ballRuns > 0) {
      label = `${ballRuns} run${ballRuns > 1 ? "s" : ""}`;
      detail = `${striker.name} works it into space. The pair complete ${ballRuns}.`;
    }

    setRuns((value) => value + ballRuns);
    setBalls(currentBall);
    setBatterLines((lines) => ({
      ...lines,
      [striker.id]: {
        ...(lines[striker.id] ?? { runs: 0, balls: 0, fours: 0, sixes: 0, state: "in" }),
        runs: (lines[striker.id]?.runs ?? 0) + ballRuns,
        balls: (lines[striker.id]?.balls ?? 0) + 1,
        fours: (lines[striker.id]?.fours ?? 0) + (ballRuns === 4 ? 1 : 0),
        sixes: (lines[striker.id]?.sixes ?? 0) + (ballRuns === 6 ? 1 : 0),
        state: wicket ? "out" : "in",
      },
    }));
    setBowlerLines((lines) => ({
      ...lines,
      [bowler.id]: {
        balls: (lines[bowler.id]?.balls ?? 0) + 1,
        runs: (lines[bowler.id]?.runs ?? 0) + ballRuns,
        wickets: (lines[bowler.id]?.wickets ?? 0) + (wicket ? 1 : 0),
      },
    }));
    setDeliveries((items) => [{
      id: Date.now(),
      over: ballLabel,
      runs: ballRuns,
      wicket,
      label,
      detail,
      angle,
      distance,
    }, ...items].slice(0, 24));

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
    } else if (ballRuns % 2 === 1) {
      [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
    }
    if (currentBall % 6 === 0) {
      [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
      const eligible = bowlingOptions.map(({ index }) => index).filter((index) => index !== safeBowlerIndex);
      if (eligible.length) setBowlerIndex(eligible[Math.floor(Math.random() * eligible.length)]);
    }
    setStrikerIndex(nextStriker);
    setNonStrikerIndex(nextNonStriker);
  }, [aggression, balls, battingXI, bowler, bowlingOptions, fieldPlan, inningsComplete, nextBatterIndex, nonStriker, nonStrikerIndex, safeBowlerIndex, striker, strikerIndex]);

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

  const bowlerFigures = bowlerLines[bowler?.id] ?? { balls: 0, runs: 0, wickets: 0 };
  const strikerStats = batterLines[striker?.id] ?? { runs: 0, balls: 0, fours: 0, sixes: 0, state: "in" };
  const nonStrikerStats = batterLines[nonStriker?.id] ?? { runs: 0, balls: 0, fours: 0, sixes: 0, state: "in" };

  return (
    <main className={styles.shell} style={{ "--bat": battingTeam.primaryColor, "--bowl": bowlingTeam.primaryColor } as React.CSSProperties}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.liveDot} />
          <div>
            <span className={styles.eyebrow}>Match centre</span>
            <strong>Wankhede · Mumbai</strong>
          </div>
        </div>

        <div className={styles.scoreStrip}>
          <div className={styles.teamIdentity}>
            <span className={styles.crest} style={{ background: battingTeam.primaryColor }}>{battingTeam.shortName.slice(0, 1)}</span>
            <div><b>{battingTeam.shortName}</b><small>Batting</small></div>
          </div>
          <div className={styles.score}>
            <strong>{runs}<i>/</i>{wickets}</strong>
            <span>{overs(balls)} overs</span>
          </div>
          <div className={styles.matchMeta}>
            <span><b>{currentRunRate.toFixed(2)}</b> CRR</span>
            <span><b>{projected || "—"}</b> projected</span>
          </div>
          <div className={`${styles.teamIdentity} ${styles.bowlingIdentity}`}>
            <div><b>{bowlingTeam.shortName}</b><small>Fielding</small></div>
            <span className={styles.crest} style={{ background: bowlingTeam.primaryColor }}>{bowlingTeam.shortName.slice(0, 1)}</span>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button onClick={() => setShowSetup(true)}><Settings2 size={15} /> Setup</button>
          <Link href="/game/overview"><X size={17} /><span>Exit</span></Link>
        </div>
      </header>

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

      <footer className={styles.controlDeck}>
        <div className={styles.engineState}><span className={isPlaying ? styles.pulsing : ""} /><div><small>SIMULATION ENGINE</small><strong>{inningsComplete ? "INNINGS COMPLETE" : isPlaying ? "RUNNING LIVE" : "PAUSED"}</strong></div></div>
        <button className={styles.primaryControl} onClick={() => setIsPlaying((value) => !value)} disabled={inningsComplete}>
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          {isPlaying ? "Pause match" : inningsComplete ? "Innings complete" : "Play match"}
        </button>
        <button className={styles.iconControl} onClick={simulateBall} disabled={isPlaying || inningsComplete} title="Simulate next ball"><SkipForward size={17} /></button>
        <div className={styles.speedControl}>
          <small>SPEED</small>
          {[1, 2, 4].map((value) => <button key={value} onClick={() => setSpeed(value)} className={speed === value ? styles.selected : ""}>{value}×</button>)}
        </div>
        <div className={styles.deckDivider} />
        <div className={styles.nextEvent}><small>NEXT DECISION</small><strong>{balls % 6 === 0 ? "New over · choose bowler" : `${6 - (balls % 6)} balls to over end`}</strong></div>
        <button className={styles.resetControl} onClick={resetMatch}><RefreshCcw size={15} /> Restart</button>
      </footer>

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
