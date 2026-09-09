"use client";

import { useMemo, useState } from "react";
import type { Player, Team } from "@/lib/types";
import type { ScoutingReport } from "@/lib/logic/scoutingAssignments";
import { getBestPlayerScoutingReport, getPlayerScoutingConfidence } from "@/lib/logic/scoutingAssignments";

type View = "attributes" | "career" | "season";
type CareerScope = "ipl" | "t20";
type FixtureLike = { id: string; date?: string; played?: boolean; teamA?: string; teamB?: string; scorecard?: any };

export interface PlayerAnalysisPageProps {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  userTeamId: string;
  currentSeason: number;
  fixtures: FixtureLike[];
  seasonArchives: Array<{ season: number; playerMatchLogs?: Record<string, unknown[]> }>;
  scoutingReports: ScoutingReport[];
  shortlist: string[];
  onToggleShortlist: (playerId: string) => void;
  onOpenProfile: (playerId: string) => void;
  initialPlayerId?: string | null;
}

const ATTRIBUTES: Array<{ label: string; key: keyof Player; group: string }> = [
  { label: "Batting ability", key: "currentBatting", group: "Core" }, { label: "Bowling ability", key: "currentBowling", group: "Core" },
  { label: "Batting potential", key: "potentialBatting", group: "Core" }, { label: "Bowling potential", key: "potentialBowling", group: "Core" },
  { label: "Pace batting", key: "paceRating", group: "Matchups" }, { label: "Spin batting", key: "spinRating", group: "Matchups" },
  { label: "Powerplay batting", key: "powerplayBatting", group: "Batting phases" }, { label: "Middle-over batting", key: "middleOversBatting", group: "Batting phases" }, { label: "Death batting", key: "deathBatting", group: "Batting phases" },
  { label: "Powerplay bowling", key: "powerplayBowling", group: "Bowling phases" }, { label: "Middle-over bowling", key: "middleOversBowling", group: "Bowling phases" }, { label: "Death bowling", key: "deathBowling", group: "Bowling phases" },
  { label: "Batting consistency", key: "stamina", group: "Execution" }, { label: "Bowling consistency", key: "consistency", group: "Execution" },
  { label: "Pressure", key: "pressureRating", group: "Mental" }, { label: "Big match", key: "bigMatchRating", group: "Mental" },
  { label: "Fielding", key: "fieldingRating", group: "Fielding" }, { label: "Wicketkeeping", key: "wicketkeepingRating", group: "Fielding" }, { label: "Injury proneness", key: "injuryProneness", group: "Fitness" },
];

function isIplPlayer(player: Player, teams: Record<string, Team>) {
  return Boolean(player.currentTeamId && teams[player.currentTeamId]) || player.iplHistory.some((entry) => entry.teamId && entry.teamId !== "UNSOLD");
}

function visibleRating(player: Player, key: keyof Player, reports: ScoutingReport[], userTeamId: string): string {
  const value = player[key];
  if (typeof value !== "number") return "—";
  if (player.currentTeamId === userTeamId) return String(Math.round(value));
  const confidence = getPlayerScoutingConfidence(reports, player.id);
  if (confidence <= 0) return "Unknown";
  if (confidence >= 100) return String(Math.round(value));
  const margin = confidence >= 80 ? 2 : confidence >= 60 ? 4 : 6;
  return `${Math.max(1, Math.round(value - margin))}–${Math.min(99, Math.round(value + margin))}`;
}

function seasonEntry(player: Player, season: number) {
  return player.iplHistory.find((entry) => Number(entry.season) === season)?.seasonStats;
}

function matchRows(playerId: string, fixtures: FixtureLike[], teams: Record<string, Team>) {
  return fixtures.flatMap((fixture) => {
    if (!fixture.played || !fixture.scorecard) return [];
    const innings = [fixture.scorecard.inningsA, fixture.scorecard.inningsB].filter(Boolean);
    const battingInningsIndex = innings.findIndex((entry: any) => (entry.batting ?? []).some((row: any) => row.id === playerId));
    const bowlingInningsIndex = innings.findIndex((entry: any) => (entry.bowling ?? []).some((row: any) => row.id === playerId));
    const batting = innings.flatMap((entry: any) => entry.batting ?? []).find((entry: any) => entry.id === playerId);
    const bowling = innings.flatMap((entry: any) => entry.bowling ?? []).find((entry: any) => entry.id === playerId);
    if (!batting && !bowling) return [];
    const playerTeam = battingInningsIndex === 0 || bowlingInningsIndex === 1 ? fixture.teamA : fixture.teamB;
    const opponentId = playerTeam === fixture.teamA ? fixture.teamB : fixture.teamA;
    return [{
      id: fixture.id, date: fixture.date ?? "—", opponent: teams[opponentId ?? ""]?.shortName ?? opponentId ?? "—",
      batting: batting ? `${batting.runs ?? 0} (${batting.balls ?? 0})` : "DNB",
      bowling: bowling ? `${bowling.wickets ?? 0}/${bowling.runsConceded ?? 0} (${bowling.overs ?? 0})` : "—",
    }];
  });
}

export default function PlayerAnalysisPage(props: PlayerAnalysisPageProps) {
  const eligible = useMemo(() => Object.values(props.players).filter((player) => isIplPlayer(player, props.teams)).sort((a, b) => a.name.localeCompare(b.name)), [props.players, props.teams]);
  const [firstId, setFirstId] = useState(props.initialPlayerId ?? eligible[0]?.id ?? "");
  const [secondId, setSecondId] = useState("");
  const [view, setView] = useState<View>("attributes");
  const [careerScope, setCareerScope] = useState<CareerScope>("ipl");
  const seasons = useMemo(() => Array.from(new Set(eligible.flatMap((player) => player.iplHistory.map((entry) => Number(entry.season))).filter(Number.isFinite))).sort((a, b) => b - a), [eligible]);
  const [season, setSeason] = useState(props.currentSeason);
  const selected = [props.players[firstId], secondId ? props.players[secondId] : undefined].filter(Boolean) as Player[];
  const rows = selected.map((player) => {
    if (season === props.currentSeason) return matchRows(player.id, props.fixtures, props.teams);
    const archived = props.seasonArchives.find((archive) => archive.season === season)?.playerMatchLogs?.[player.id] ?? [];
    return archived.map((row: any) => ({ id: row.id, date: row.date, opponent: props.teams[row.opponentId]?.shortName ?? row.opponentId ?? "—", batting: row.batting ?? "DNB", bowling: row.bowling ?? "—" }));
  });

  const PlayerHeader = ({ player }: { player: Player }) => {
    const report = getBestPlayerScoutingReport(props.scoutingReports, player.id);
    const confidence = player.currentTeamId === props.userTeamId ? 100 : getPlayerScoutingConfidence(props.scoutingReports, player.id);
    return <div className="rounded-lg border border-border bg-bg/50 p-4"><div className="flex items-start justify-between gap-3"><div><button onClick={() => props.onOpenProfile(player.id)} className="font-anton text-[22px] uppercase text-text-primary hover:text-accent">{player.name}</button><div className="mt-1 text-[11px] font-semibold text-text-secondary">{player.role} · {props.teams[player.currentTeamId ?? ""]?.shortName ?? "Former / unsold"} · Age {player.age}</div></div><button onClick={() => props.onToggleShortlist(player.id)} className="rounded-md border border-border bg-surface px-3 py-2 text-[10px] font-bold uppercase text-text-primary">{props.shortlist.includes(player.id) ? "Shortlisted ✓" : "+ Shortlist"}</button></div><div className="mt-3 rounded bg-surface px-3 py-2 text-[11px] text-text-secondary"><span className="font-bold text-text-primary">Scouting knowledge:</span> <span className="font-bold text-accent">{confidence}%</span>{report ? ` · ${report.summary}` : " · No scout report"}</div></div>;
  };

  return <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-6">
    <div className="grid shrink-0 grid-cols-[minmax(14rem,1fr)_auto_minmax(14rem,1fr)] items-end gap-4 rounded-xl border-2 border-border bg-surface p-5 shadow-sm">
      <label className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Player one<select value={firstId} onChange={(event) => setFirstId(event.target.value)} className="mt-1 block w-full rounded border border-border bg-bg px-3 py-2 text-xs text-text-primary">{eligible.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.role}</option>)}</select></label>
      <button onClick={() => setSecondId(secondId ? "" : eligible.find((player) => player.id !== firstId)?.id ?? "")} className="rounded bg-[var(--ink)] px-4 py-2 font-space-mono text-[9px] font-bold uppercase text-bg">{secondId ? "Remove comparison" : "Compare player"}</button>
      {secondId ? <label className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Player two<select value={secondId} onChange={(event) => setSecondId(event.target.value)} className="mt-1 block w-full rounded border border-border bg-bg px-3 py-2 text-xs text-text-primary">{eligible.filter((player) => player.id !== firstId).map((player) => <option key={player.id} value={player.id}>{player.name} · {player.role}</option>)}</select></label> : <div />}
    </div>
    <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-surface p-2">{(["attributes", "career", "season"] as View[]).map((item) => <button key={item} onClick={() => setView(item)} className={`rounded-md px-4 py-2 text-[11px] font-bold uppercase ${view === item ? "bg-[var(--ink)] text-bg" : "text-text-secondary hover:bg-bg"}`}>{item === "career" ? "Career stats" : item === "season" ? "Season stats" : "Attributes"}</button>)}{view === "career" && <select value={careerScope} onChange={(event) => setCareerScope(event.target.value as CareerScope)} className="ml-auto h-9 rounded-md border border-border bg-bg px-3 text-[11px]"><option value="ipl">IPL career</option><option value="t20">T20 career</option></select>}{view === "season" && <select value={season} onChange={(event) => setSeason(Number(event.target.value))} className="ml-auto h-9 rounded-md border border-border bg-bg px-3 text-[11px]">{seasons.map((year) => <option key={year}>{year}</option>)}</select>}</div>
    <div className={`grid min-h-0 flex-1 gap-4 overflow-hidden ${selected.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>{selected.map((player, playerIndex) => <div key={player.id} className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-xl border-2 border-border bg-surface p-5 shadow-sm"><PlayerHeader player={player} />
      {view === "attributes" && <div className="space-y-3">{Array.from(new Set(ATTRIBUTES.map((attribute) => attribute.group))).map((group) => <div key={group}><h3 className="mb-1 border-b border-border pb-1 font-anton text-[11px] uppercase">{group}</h3><div className="grid grid-cols-2 gap-1">{ATTRIBUTES.filter((attribute) => attribute.group === group).map((attribute) => <div key={String(attribute.key)} className="flex justify-between rounded bg-bg/60 px-2 py-1.5 text-[9px]"><span className="text-text-secondary">{attribute.label}</span><span className="font-space-mono font-bold text-text-primary">{visibleRating(player, attribute.key, props.scoutingReports, props.userTeamId)}</span></div>)}</div></div>)}</div>}
      {view === "career" && (() => { const stats = careerScope === "ipl" ? { matches: player.iplStats.matches, runs: player.iplStats.runs, average: player.iplStats.battingAverage, strikeRate: player.iplStats.strikeRate, wickets: player.iplStats.wickets, bowlingAverage: player.iplStats.bowlingAverage, economy: player.iplStats.economy ?? 0 } : { matches: player.careerStats.batting.matches, runs: player.careerStats.batting.runs, average: player.careerStats.batting.average, strikeRate: player.careerStats.batting.strikeRate, wickets: player.careerStats.bowling.wickets, bowlingAverage: player.careerStats.bowling.average, economy: player.careerStats.bowling.economy }; return <StatGrid stats={stats} />; })()}
      {view === "season" && <><StatGrid stats={seasonEntry(player, season) ?? {}} emptyText={`No IPL statistics recorded for ${season}.`} /><MatchLog rows={rows[playerIndex]} /></>}
    </div>)}</div>
  </div>;
}

function StatGrid({ stats, emptyText }: { stats: Record<string, any>; emptyText?: string }) {
  const entries = Object.entries(stats).filter(([, value]) => typeof value === "number" || typeof value === "string");
  if (entries.length === 0) return <div className="rounded border border-dashed border-border p-8 text-center text-xs text-text-secondary">{emptyText ?? "No statistics available."}</div>;
  return <div className="grid grid-cols-3 gap-2">{entries.map(([key, value]) => <div key={key} className="rounded border border-border bg-bg/50 p-2"><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">{key.replace(/([A-Z])/g, " $1")}</div><div className="mt-1 font-anton text-[17px] text-text-primary">{typeof value === "number" ? Number(value.toFixed(2)) : value}</div></div>)}</div>;
}

function MatchLog({ rows }: { rows: ReturnType<typeof matchRows> }) {
  return <div><h3 className="mb-1 border-b border-border pb-1 font-anton text-[11px] uppercase">Match by match</h3><div className="grid grid-cols-[5rem_1fr_5rem_7rem] gap-2 px-2 py-1 font-space-mono text-[7px] font-bold uppercase text-text-secondary"><span>Date</span><span>Opponent</span><span>Bat</span><span>Bowl</span></div>{rows.map((row) => <div key={row.id} className="grid grid-cols-[5rem_1fr_5rem_7rem] gap-2 border-t border-border/60 px-2 py-1.5 text-[9px]"><span>{row.date}</span><span>{row.opponent}</span><span>{row.batting}</span><span>{row.bowling}</span></div>)}{rows.length === 0 && <div className="p-4 text-center text-xs text-text-secondary">No match appearances recorded.</div>}</div>;
}
