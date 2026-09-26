"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { Player, Team } from "@/lib/types";
import type { ScoutingReport } from "@/lib/logic/scoutingAssignments";
import { formatDisplayDate } from "@/lib/logic/displayDate";
import { playerDashboardStructure } from "@/lib/logic/playerAnalysisDashboard";
import { chartAxis } from "@/lib/logic/playerAnalysisChart";
import PlayerAnalysisDashboard from "./PlayerAnalysisDashboard";
import {
  buildPlayerAnalysisTotals, emptyPlayerAnalysisTotals, metricByKey, PLAYER_METRICS,
  type PlayerAnalysisFixture, type PlayerAnalysisTotals, type PlayerMetricKey,
} from "@/lib/logic/playerAnalysisMetrics";

type Group = "all" | "batters" | "all-rounders" | "pacers" | "spinners";
type FinderFilters = { nationality: string; country: string; role: string; team: string; minAge: string; maxAge: string; rating: "batting" | "bowling"; minRating: string; maxRating: string };
const emptyFinderFilters = (): FinderFilters => ({ nationality: "", country: "", role: "", team: "", minAge: "", maxAge: "", rating: "batting", minRating: "", maxRating: "" });
type Config = { x: PlayerMetricKey; y: PlayerMetricKey; group: Group; kind: "chart" | "table" | "ranking" | "breakdown" };
type Row = { player: Player; x: number; y: number; qualified: boolean };

export interface PlayerAnalysisPageProps {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  userTeamId: string;
  currentSeason: number;
  fixtures: PlayerAnalysisFixture[];
  scoutingReports: ScoutingReport[];
  shortlist: string[];
  onToggleShortlist: (playerId: string) => void;
  onOpenProfile: (playerId: string) => void;
  initialPlayerId?: string | null;
}

const display = (value: number | null, key: PlayerMetricKey) => value === null || !Number.isFinite(value) ? "—" : `${value.toLocaleString(undefined, { maximumFractionDigits: ["matches", "runs", "fours", "sixes", "fifties", "hundreds", "wickets", "powerplayRuns", "middleRuns", "deathRuns", "powerplayWickets", "middleWickets", "deathWickets"].includes(key) ? 0 : 1 })}${metricByKey[key].unit}`;
function groupMatches(p: Player, group: Group) {
  return group === "all" || (group === "batters" && ["Batsman", "WK-Batsman"].includes(p.role)) || (group === "all-rounders" && p.role === "All-Rounder") || (group === "pacers" && p.role === "Pace Bowler") || (group === "spinners" && p.role === "Spin Bowler");
}
function rowsFor(players: Player[], totals: Record<string, PlayerAnalysisTotals>, config: Config, selectedId: string): Row[] {
  const mx = metricByKey[config.x], my = metricByKey[config.y];
  return players.flatMap((player) => {
    if (!groupMatches(player, config.group) && player.id !== selectedId) return [];
    const stats = totals[player.id] ?? emptyPlayerAnalysisTotals();
    const x = config.kind === "ranking" ? my.value(stats) : mx.value(stats), y = my.value(stats);
    if (x === null || y === null) return [];
    const qualified = groupMatches(player, config.group) && (config.kind === "ranking" || mx.qualifies(stats)) && my.qualifies(stats);
    return qualified || player.id === selectedId ? [{ player, x, y, qualified }] : [];
  }).sort((a, b) => (my.lowerBetter ? a.y - b.y : b.y - a.y) || a.player.name.localeCompare(b.player.name));
}
function seasonSummary(player: Player, stats: PlayerAnalysisTotals): Array<{ label: string; value: string }> {
  const isBowler = player.role === "Pace Bowler" || player.role === "Spin Bowler";
  const isAllRounder = player.role === "All-Rounder";
  const showBatting = !isBowler || stats.innings > 0;
  const showBowling = isBowler || isAllRounder || stats.bowlBalls > 0;
  const rows = [{ label: "Matches", value: String(stats.matches) }];
  if (showBatting) rows.push(
    { label: "Bat inns", value: String(stats.innings) },
    { label: "Runs", value: String(stats.runs) },
    { label: "Avg", value: display(metricByKey.batAverage.value(stats), "batAverage") },
    { label: "SR", value: display(metricByKey.strikeRate.value(stats), "strikeRate") },
    { label: "50s/100s", value: `${stats.fifties}/${stats.hundreds}` },
    { label: "4s/6s", value: `${stats.fours}/${stats.sixes}` },
  );
  if (showBowling) rows.push(
    { label: "Bowl inns", value: String(stats.bowlingInnings) },
    { label: "Overs", value: `${Math.floor(stats.bowlBalls / 6)}.${stats.bowlBalls % 6}` },
    { label: "Wickets", value: String(stats.wickets) },
    { label: "Econ", value: display(metricByKey.economy.value(stats), "economy") },
    { label: "Bowl avg", value: display(metricByKey.bowlAverage.value(stats), "bowlAverage") },
  );
  return rows;
}
function searchRating(player: Player): number {
  if (player.role === "Pace Bowler" || player.role === "Spin Bowler") return player.currentBowling;
  if (player.role === "All-Rounder") return (player.currentBatting + player.currentBowling) / 2;
  return player.currentBatting;
}
const paired: Partial<Record<PlayerMetricKey, PlayerMetricKey>> = {
  runs: "strikeRate", strikeRate: "runs", batAverage: "strikeRate", boundaryRate: "runs",
  powerplayRuns: "powerplayStrikeRate", powerplayStrikeRate: "powerplayRuns", middleRuns: "middleStrikeRate", middleStrikeRate: "middleRuns", deathRuns: "deathStrikeRate", deathStrikeRate: "deathRuns",
  wickets: "economy", economy: "wickets", dotRate: "wickets", deathWickets: "deathEconomy", deathEconomy: "deathWickets", powerplayWickets: "powerplayEconomy",
};

function MetricPicker({ label, value, onChange }: { label: string; value: PlayerMetricKey; onChange: (key: PlayerMetricKey) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  const matches = PLAYER_METRICS.filter((metric) => `${metric.label} ${metric.group}`.toLowerCase().includes(query.toLowerCase())).slice(0, 35);
  return <div ref={root} className="relative min-w-0"><label className="text-[10px] font-bold uppercase text-text-secondary">{label}<input value={open ? query : metricByKey[value].label} onFocus={() => { setOpen(true); setQuery(""); }} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={(event) => { if (event.key === "Enter" && matches[0]) { onChange(matches[0].key); setOpen(false); } if (event.key === "Escape") setOpen(false); }} className="mt-1 h-9 w-full rounded border border-border bg-bg px-2 text-xs font-normal normal-case text-text-primary outline-none focus:border-accent" placeholder="Search metrics" /></label>{open && <div className="absolute inset-x-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded border border-border bg-bg shadow-xl">{matches.map((metric) => <button key={metric.key} type="button" onClick={() => { onChange(metric.key); setOpen(false); }} className="block w-full border-b border-border/50 px-2 py-1.5 text-left hover:bg-accent/10"><span className="block text-[11px] font-semibold">{metric.label}</span><span className="text-[9px] text-text-secondary">{metric.group} · {metric.minimum}</span></button>)}{matches.length === 0 && <p className="p-3 text-[11px] text-text-secondary">No matching metric</p>}</div>}</div>;
}

const breakdownSuffix = (key: string) => key.split(":").at(-1);
const canBreakdown = (key: string) => ["runs", "wickets", "fours", "sixes"].includes(key) || /^position:(1-2|3-5|6plus):(runs|fours|sixes)$/.test(key);
function Breakdown({ stats, keyName }: { stats: PlayerAnalysisTotals; keyName: PlayerMetricKey }) {
  const suffix = breakdownSuffix(keyName) as "runs" | "wickets" | "fours" | "sixes";
  const positionPrefix = keyName.startsWith("position:") ? keyName.slice(0, keyName.lastIndexOf(":")) + ":" : "";
  const windows = [[1, 6], [7, 12], [13, 16], [17, 20]] as const;
  const parts = windows.map(([start, end]) => ({ label: `Overs ${start}–${end}`, value: stats.segments[`${positionPrefix}overs:${start}-${end}`]?.[suffix] ?? 0 }));
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const colors = ["#f97316", "#38bdf8", "#a78bfa", "#34d399"];
  let progress = 0;
  const slices = parts.map((part, index) => { const start = progress; progress += total ? part.value / total * 100 : 0; return `${colors[index]} ${start}% ${progress}%`; });
  return <div><p className="mb-3 text-[11px] text-text-secondary">{metricByKey[keyName].label} by over range for this player. Requires archived delivery records.</p>{total ? <div className="flex flex-wrap items-center gap-8"><div role="img" aria-label="Over range share" className="size-44 rounded-full" style={{ background: `conic-gradient(${slices.join(", ")})` }} /><div className="min-w-[180px] space-y-2">{parts.map((part, index) => <div key={part.label} className="flex justify-between gap-5 text-xs"><span className="flex items-center gap-2"><span className="size-3 rounded-sm" style={{ backgroundColor: colors[index] }} />{part.label}</span><strong>{part.value} · {(part.value / total * 100).toFixed(1)}%</strong></div>)}<p className="border-t border-border pt-2 text-xs">Total: {total}</p></div></div> : <p className="rounded border border-dashed border-border p-8 text-center text-xs text-text-secondary">No delivery breakdown is available for this season.</p>}</div>;
}

function ResultView({ rows, config, selectedId, onSelect, teams }: { rows: Row[]; config: Config; selectedId: string; onSelect: (id: string) => void; teams: Record<string, Team> }) {
  const [sortBy, setSortBy] = useState<"x" | "y">("y");
  const [ascending, setAscending] = useState(false);
  const qualified = rows.filter((row) => row.qualified).sort((a, b) => {
    const lowerBetter = sortBy === "x" ? metricByKey[config.x].lowerBetter : metricByKey[config.y].lowerBetter;
    const direction = (ascending ? 1 : -1) * (lowerBetter ? -1 : 1);
    return (a[sortBy] - b[sortBy]) * direction || a.player.name.localeCompare(b.player.name);
  });
  const shown = [...qualified, ...rows.filter((row) => !row.qualified && row.player.id === selectedId)];
  const xs = shown.map((row) => row.x), ys = shown.map((row) => row.y);
  const xAxis = chartAxis(xs), yAxis = chartAxis(ys);
  const { min: minX, max: maxX } = xAxis, { min: minY, max: maxY } = yAxis;
  const position = (value: number, low: number, high: number) => 7 + 86 * (value - low) / Math.max(0.001, high - low);
  const xPosition = (value: number) => metricByKey[config.x].lowerBetter ? 100 - position(value, minX, maxX) : position(value, minX, maxX);
  const yPosition = (value: number) => metricByKey[config.y].lowerBetter ? position(value, minY, maxY) : 100 - position(value, minY, maxY);
  const averageX = qualified.length ? qualified.reduce((sum, row) => sum + row.x, 0) / qualified.length : null;
  const averageY = qualified.length ? qualified.reduce((sum, row) => sum + row.y, 0) / qualified.length : null;
  const toggleSort = (axis: "x" | "y") => { if (sortBy === axis) setAscending(!ascending); else { setSortBy(axis); setAscending(false); } };
  return <div className="space-y-3">
    <p className="font-space-mono text-[10px] text-text-secondary">{qualified.length} qualified players · {config.kind === "ranking" ? "" : `${metricByKey[config.x].label}: ${metricByKey[config.x].minimum} · `}{metricByKey[config.y].label}: {metricByKey[config.y].minimum}</p>
    {config.kind === "chart" ? <div className="rounded-lg border border-border bg-bg p-4">
      <div className="grid grid-cols-[70px_minmax(0,1fr)] gap-2">
        <div className="relative font-space-mono text-[9px] text-text-secondary"><span className="absolute inset-y-0 left-0 flex items-center font-bold uppercase [writing-mode:vertical-rl] rotate-180">{metricByKey[config.y].label}</span>{yAxis.ticks.map((tick) => <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${yPosition(tick)}%` }}>{display(tick, config.y)}</span>)}</div>
        <div className="relative h-[min(48vh,420px)] min-h-[240px] border border-border bg-surface/5">
          {xAxis.ticks.map((tick) => <span key={tick} className="absolute inset-y-0 border-l border-dashed border-border/40" style={{ left: `${xPosition(tick)}%` }} />)}
          {yAxis.ticks.map((tick) => <span key={tick} className="absolute inset-x-0 border-t border-dashed border-border/40" style={{ top: `${yPosition(tick)}%` }} />)}
          {averageX !== null && <span className="absolute inset-y-0 border-l border-dashed border-accent/60" style={{ left: `${xPosition(averageX)}%` }} />}
          {averageY !== null && <span className="absolute inset-x-0 border-t border-dashed border-accent/60" style={{ top: `${yPosition(averageY)}%` }} />}
          {shown.map((row) => <button key={row.player.id} type="button" onClick={() => onSelect(row.player.id)} aria-label={`${row.player.name}, ${metricByKey[config.x].label} ${display(row.x, config.x)}, ${metricByKey[config.y].label} ${display(row.y, config.y)}`} className={`group absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg shadow hover:z-30 ${row.player.id === selectedId ? "z-20 size-5 ring-2 ring-accent" : "size-3"}`} style={{ left: `${xPosition(row.x)}%`, top: `${yPosition(row.y)}%`, backgroundColor: row.player.id === selectedId ? "var(--accent)" : teams[row.player.currentTeamId ?? ""]?.primaryColor ?? "#777" }}>
            <span className="pointer-events-none invisible absolute bottom-full left-1/2 z-40 mb-2 w-48 -translate-x-1/2 rounded border border-border bg-bg p-2 text-left font-space-mono text-[9px] text-text-primary shadow-xl group-hover:visible"><strong>{row.player.name}</strong><br />{metricByKey[config.x].label}: {display(row.x, config.x)}<br />{metricByKey[config.y].label}: {display(row.y, config.y)}{!row.qualified && <><br />Small sample · unranked</>}</span>
          </button>)}
          {shown.length === 0 && <div className="grid h-full place-items-center text-xs text-text-secondary">No recorded players for this comparison.</div>}
        </div>
      </div>
      <div className="relative ml-[78px] mt-1 h-4 font-space-mono text-[9px] text-text-secondary">{xAxis.ticks.map((tick) => <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${xPosition(tick)}%` }}>{display(tick, config.x)}</span>)}</div>
      <p className="text-center font-space-mono text-[9px] font-bold uppercase text-text-secondary">{metricByKey[config.x].label} →</p>
      <p className="mt-2 text-center font-space-mono text-[9px] text-text-secondary">Dashed lines: qualified league averages · selected player highlighted{metricByKey[config.y].lowerBetter ? " · lower is better" : ""}</p>
    </div> : <div className="max-h-[55vh] overflow-auto rounded-lg border border-border">
      <table className="w-full text-left font-space-mono text-[11px]">
        <thead className="sticky top-0 bg-surface text-[9px] uppercase text-text-secondary"><tr><th className="p-2">Rank</th><th className="p-2">Player</th>{config.kind !== "ranking" && <th className="p-2 text-right"><button type="button" onClick={() => toggleSort("x")}>{metricByKey[config.x].label} ↕</button></th>}<th className="p-2 text-right"><button type="button" onClick={() => toggleSort("y")}>{metricByKey[config.y].label} ↕</button></th></tr></thead>
        <tbody>{shown.map((row, index) => <tr key={row.player.id} className={`border-t border-border ${row.player.id === selectedId ? "bg-accent/10" : "hover:bg-surface/5"}`}><td className="p-2 font-anton text-sm text-accent">{row.qualified ? `#${index + 1}` : "—"}</td><td className="p-2"><button type="button" onClick={() => onSelect(row.player.id)} className="font-semibold hover:text-accent">{row.player.name}</button>{!row.qualified && <span className="ml-2 text-[9px] text-warning">Small sample</span>}</td>{config.kind !== "ranking" && <td className="p-2 text-right">{display(row.x, config.x)}</td>}<td className="p-2 text-right">{display(row.y, config.y)}</td></tr>)}</tbody>
      </table>{shown.length === 0 && <p className="p-8 text-center text-xs text-text-secondary">No players meet the requirement yet.</p>}
    </div>}
  </div>;
}

function MatchEvidence({ fixtures, player, metricKey, teams, players }: { fixtures: PlayerAnalysisFixture[]; player: Player; metricKey: PlayerMetricKey; teams: Record<string, Team>; players: Record<string, Player> }) {
  const matches = fixtures.flatMap((fixture) => {
    if (!fixture.played) return [];
    const totals = buildPlayerAnalysisTotals([fixture], players)[player.id];
    if (!totals || totals.matches === 0) return [];
    const value = metricByKey[metricKey].value(totals);
    if (value === null) return [];
    const teamId = Object.values(fixture.simulation?.lineups ?? {}).find((lineup) => lineup.startingXI.includes(player.id) || lineup.finalXI.includes(player.id))?.teamId ?? player.currentTeamId;
    const opponentId = fixture.teamA === teamId ? fixture.teamB : fixture.teamA;
    return [{ id: fixture.id, date: fixture.date, opponent: teams[opponentId ?? ""]?.shortName ?? opponentId ?? "—", value }];
  }).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return <div className="mt-5 border-t border-border pt-4"><h3 className="font-anton text-base uppercase">Match evidence · {metricByKey[metricKey].label}</h3><p className="mb-2 text-[10px] text-text-secondary">Per-match values can be below the season ranking threshold. These rows are available for the current season’s scorecards.</p><div className="max-h-52 overflow-y-auto rounded border border-border">{matches.map((match) => <div key={match.id} className="flex justify-between gap-3 border-b border-border/50 px-3 py-2 text-xs"><span>{match.date ? formatDisplayDate(match.date) : "—"} · vs {match.opponent}</span><strong>{display(match.value, metricKey)}</strong></div>)}{matches.length === 0 && <p className="p-5 text-center text-xs text-text-secondary">No match-level record is available for this factor.</p>}</div></div>;
}

export default function PlayerAnalysisPage(props: PlayerAnalysisPageProps) {
  const players = useMemo(() => Object.values(props.players).filter((player) => Boolean(player.currentTeamId && props.teams[player.currentTeamId]) || player.iplHistory.some((entry) => entry.teamId && entry.teamId !== "UNSOLD")).sort((a, b) => a.name.localeCompare(b.name)), [props.players, props.teams]);
  const [selectedId, setSelectedId] = useState(props.initialPlayerId ?? "");
  const [query, setQuery] = useState(""), [searchOpen, setSearchOpen] = useState(false);
  const [finder, setFinder] = useState<FinderFilters>(emptyFinderFilters);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [draft, setDraft] = useState<Config>({ x: "runs", y: "strikeRate", group: "all", kind: "chart" });
  const [expanded, setExpanded] = useState<Config | null>(null);
  const [detailTab, setDetailTab] = useState<"chart" | "table" | "matches">("chart");
  const searchRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (props.initialPlayerId && props.players[props.initialPlayerId]) setSelectedId(props.initialPlayerId); }, [props.initialPlayerId]);
  useEffect(() => { const close = (event: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSearchOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  const totals = useMemo(() => buildPlayerAnalysisTotals(props.fixtures, props.players), [props.fixtures, props.players]);
  const selected = selectedId ? props.players[selectedId] : undefined;
  const stats = selected ? totals[selected.id] ?? emptyPlayerAnalysisTotals() : emptyPlayerAnalysisTotals();
  const structure = selected ? playerDashboardStructure(selected, stats, props.fixtures) : null;
  const countries = Array.from(new Set(players.map((player) => player.country).filter((country): country is string => Boolean(country)))).sort();
  const ratingActive = finder.minRating !== "" || finder.maxRating !== "";
  const finderMatches = players.filter((player) => {
    if (!`${player.name} ${player.currentTeamId ?? ""} ${player.role} ${player.country ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (finder.nationality && player.nationality !== finder.nationality) return false;
    if (finder.country && player.country !== finder.country) return false;
    if (finder.role && player.role !== finder.role) return false;
    if (finder.team && player.currentTeamId !== finder.team) return false;
    if (finder.minAge && player.age < Number(finder.minAge)) return false;
    if (finder.maxAge && player.age > Number(finder.maxAge)) return false;
    if (ratingActive) {
      const rating = finder.rating === "batting" ? player.currentBatting : player.currentBowling;
      if (finder.minRating && rating < Number(finder.minRating)) return false;
      if (finder.maxRating && rating > Number(finder.maxRating)) return false;
    }
    return true;
  });
  const suggestions = [...finderMatches].sort((a, b) => searchRating(b) - searchRating(a) || a.name.localeCompare(b.name));
  const select = (id: string) => { setSelectedId(id); setQuery(""); setSearchOpen(false); };
  const openMetric = (metric: PlayerMetricKey, view: "chart" | "table" | "matches" = "chart", x?: PlayerMetricKey) => {
    const suffix = metric.endsWith(":wickets") ? ":economy" : metric.endsWith(":economy") ? ":wickets" : metric.endsWith(":runs") ? ":sr" : metric.endsWith(":sr") ? ":runs" : "";
    const segmentPair = suffix ? metric.slice(0, metric.lastIndexOf(":")) + suffix : "";
    const bowlingMetric = metricByKey[metric].group.toLowerCase().includes("bowling");
    const fallback = bowlingMetric ? metric === "economy" ? "wickets" : "economy" : metric === "strikeRate" ? "runs" : "strikeRate";
    const horizontal = x ?? paired[metric] ?? (metricByKey[segmentPair] ? segmentPair : fallback);
    setExpanded({ x: horizontal === metric ? bowlingMetric ? "wickets" : "runs" : horizontal, y: metric, group: "all", kind: view === "chart" ? "chart" : "ranking" });
    setDetailTab(view);
  };

  return <div className="flex h-full min-h-0 flex-col overflow-y-auto p-4 lg:overflow-hidden sm:p-6"><div className="mx-auto flex h-full w-full max-w-[1500px] min-h-0 flex-col gap-3">
    <div className="flex h-11 items-center gap-1.5 rounded-lg border border-border bg-surface px-2">
      <div ref={searchRef} className="relative min-w-[170px] flex-1">
        <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onClick={() => setSearchOpen(true)}
          onKeyDown={(event) => { if (event.key === "Enter" && suggestions[0]) select(suggestions[0].id); if (event.key === "Escape") setSearchOpen(false); }}
          placeholder={selected ? `Find a player · ${selected.name}` : "Find a player"} aria-label="Find a player" aria-expanded={searchOpen}
          className="h-8 w-full rounded border border-border bg-bg pl-7 pr-2 text-xs text-text-primary outline-none focus:border-accent" />
        {searchOpen && <div className="absolute left-0 top-full z-30 mt-2 w-[min(90vw,400px)] max-h-64 overflow-y-auto rounded-lg border border-border bg-bg shadow-xl">
          <p className="px-3 py-1.5 text-[10px] text-text-secondary">{finderMatches.length} matching players</p>
          {suggestions.map((player) => <button key={player.id} type="button" onClick={() => select(player.id)} className="flex w-full items-center justify-between gap-2 border-t border-border/50 px-3 py-2 text-left text-xs hover:bg-accent/10"><strong className="truncate">{player.name}</strong><span className="shrink-0 text-[10px] text-text-secondary">{props.teams[player.currentTeamId ?? ""]?.shortName ?? "Unsold"} · {player.role}</span></button>)}
          {suggestions.length === 0 && <p className="p-3 text-xs text-text-secondary">No matching players</p>}
        </div>}
      </div>
      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:thin]">
        <select value={finder.nationality} onChange={(event) => { const nationality = event.target.value; setFinder({ ...finder, nationality, country: nationality === "Indian" ? "India" : "" }); }} aria-label="Nationality" title="Nationality" className="h-8 w-[88px] shrink-0 rounded border border-border bg-bg px-1 text-[11px] text-text-primary"><option value="">Any origin</option><option value="Indian">Indian</option><option value="Overseas">Overseas</option></select>
        <select value={finder.country} onChange={(event) => setFinder({ ...finder, country: event.target.value })} aria-label="Country" title="Country" className="h-8 w-[88px] shrink-0 rounded border border-border bg-bg px-1 text-[11px] text-text-primary"><option value="">{finder.nationality === "Overseas" ? "Any country" : "Country"}</option>{(finder.nationality === "Indian" ? ["India"] : countries.filter((country) => !finder.nationality || players.some((player) => player.country === country && player.nationality === finder.nationality))).map((country) => <option key={country} value={country}>{country}</option>)}</select>
        <select value={finder.role} onChange={(event) => setFinder({ ...finder, role: event.target.value })} aria-label="Role" title="Role" className="h-8 w-[94px] shrink-0 rounded border border-border bg-bg px-1 text-[11px] text-text-primary"><option value="">Role</option>{["Batsman", "WK-Batsman", "All-Rounder", "Pace Bowler", "Spin Bowler"].map((role) => <option key={role} value={role}>{role}</option>)}</select>
        <select value={finder.team} onChange={(event) => setFinder({ ...finder, team: event.target.value })} aria-label="Team" title="Team" className="h-8 w-[86px] shrink-0 rounded border border-border bg-bg px-1 text-[11px] text-text-primary"><option value="">Any team</option>{Object.entries(props.teams).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([teamId, team]) => <option key={teamId} value={teamId}>{team.shortName}</option>)}</select>
        <span className="flex h-8 shrink-0 items-center gap-1 rounded border border-border bg-bg px-1 text-[10px] text-text-secondary">Age <input type="number" min={15} max={60} value={finder.minAge} onChange={(event) => setFinder({ ...finder, minAge: event.target.value })} placeholder="Min" aria-label="Minimum age" className="w-10 bg-transparent text-xs text-text-primary outline-none" />–<input type="number" min={15} max={60} value={finder.maxAge} onChange={(event) => setFinder({ ...finder, maxAge: event.target.value })} placeholder="Max" aria-label="Maximum age" className="w-10 bg-transparent text-xs text-text-primary outline-none" /></span>
        <select value={finder.rating} onChange={(event) => setFinder({ ...finder, rating: event.target.value as FinderFilters["rating"] })} aria-label="Rating type" title="Rating type" className="h-8 w-[75px] shrink-0 rounded border border-border bg-bg px-1 text-[11px] text-text-primary"><option value="batting">Batting</option><option value="bowling">Bowling</option></select>
        <span className="flex h-8 shrink-0 items-center gap-1 rounded border border-border bg-bg px-1 text-[10px] text-text-secondary">Rating <input type="number" min={1} max={100} value={finder.minRating} onChange={(event) => setFinder({ ...finder, minRating: event.target.value })} placeholder="Min" aria-label="Minimum rating" className="w-10 bg-transparent text-xs text-text-primary outline-none" />–<input type="number" min={1} max={100} value={finder.maxRating} onChange={(event) => setFinder({ ...finder, maxRating: event.target.value })} placeholder="Max" aria-label="Maximum rating" className="w-10 bg-transparent text-xs text-text-primary outline-none" /></span>
      </div>
      <button type="button" onClick={() => { setFinder(emptyFinderFilters()); setQuery(""); }} title="Clear player filters" aria-label="Clear player filters" className="h-8 shrink-0 rounded border border-border px-2 text-[10px] text-text-secondary hover:text-accent">Clear</button>
    </div>
    {selected ? <>
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border bg-surface px-4 py-4">
      <div className="min-w-[165px]"><button type="button" onClick={() => props.onOpenProfile(selected.id)} className="font-anton text-xl uppercase text-text-primary hover:text-accent">{selected.name}</button><p className="mt-0.5 text-[11px] text-text-secondary">{selected.role} · {props.teams[selected.currentTeamId ?? ""]?.shortName ?? "Former / unsold"} · {props.currentSeason}</p></div>
      <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2">{seasonSummary(selected, stats).map((item) => <span key={item.label} className="flex min-w-[52px] flex-col whitespace-nowrap"><span className="text-[10px] uppercase text-text-secondary">{item.label}</span><strong className="text-sm text-text-primary">{item.value}</strong></span>)}</div>
      <button type="button" onClick={() => props.onToggleShortlist(selected.id)} className="h-8 shrink-0 rounded border border-border bg-bg px-3 text-[10px] font-bold uppercase text-text-primary">{props.shortlist.includes(selected.id) ? "Shortlisted ✓" : "+ Shortlist"}</button>
    </div>
    <div className="flex shrink-0 justify-end"><button type="button" onClick={() => setBuilderOpen(true)} className="rounded bg-[var(--ink)] px-4 py-1.5 text-[11px] font-bold text-bg">+ Create chart or table</button></div>
    {stats.innings > 0 || stats.bowlBalls > 0 ? <PlayerAnalysisDashboard player={selected} players={players} playerMap={props.players} teams={props.teams} totals={totals} fixtures={props.fixtures} structure={structure!} onExplore={openMetric} /> : <div className="grid min-h-0 flex-1 place-items-center rounded-lg border border-dashed border-border bg-surface text-xs text-text-secondary">No batting or bowling performance has been recorded for this player this season.</div>}
    {builderOpen && <div role="dialog" aria-modal="true" aria-label="Create an analysis" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3" onKeyDown={(event) => { if (event.key === "Escape") setBuilderOpen(false); }}>
      <section className="w-full max-w-4xl rounded-xl border border-border bg-surface p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="font-anton text-xl uppercase">Create an analysis</h3><p className="text-[11px] text-text-secondary">Search {PLAYER_METRICS.length} precise season factors. Rankings include only players who meet each factor's sample requirement.</p></div><button type="button" onClick={() => setBuilderOpen(false)} aria-label="Close analysis builder" className="rounded border border-border p-1"><X size={16} /></button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {draft.kind !== "ranking" && draft.kind !== "breakdown" && <MetricPicker label="Horizontal factor" value={draft.x} onChange={(key) => setDraft({ ...draft, x: key })} />}
          <MetricPicker label={draft.kind === "ranking" || draft.kind === "breakdown" ? "Factor" : "Vertical factor"} value={draft.y} onChange={(key) => setDraft({ ...draft, y: key })} />
          {draft.kind !== "breakdown" && <label className="text-[10px] font-bold uppercase text-text-secondary">Players<select value={draft.group} onChange={(event) => setDraft({ ...draft, group: event.target.value as Group })} className="mt-1 h-9 w-full rounded border border-border bg-bg px-2 text-xs text-text-primary"><option value="all">All players</option><option value="batters">Batters and keepers</option><option value="all-rounders">All-rounders</option><option value="pacers">Pace bowlers</option><option value="spinners">Spin bowlers</option></select></label>}
          <label className="text-[10px] font-bold uppercase text-text-secondary">View<select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as Config["kind"] })} className="mt-1 h-9 w-full rounded border border-border bg-bg px-2 text-xs text-text-primary"><option value="chart">Two axis chart</option><option value="table">Two factor table</option><option value="ranking">One factor ranking</option><option value="breakdown">Player over split</option></select></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] text-text-secondary">{metricByKey[draft.y].label}: {metricByKey[draft.y].minimum}</p><button type="button" disabled={draft.kind === "breakdown" && !canBreakdown(draft.y)} onClick={() => { setExpanded({ ...draft }); setDetailTab(draft.kind === "ranking" || draft.kind === "table" ? "table" : "chart"); setBuilderOpen(false); }} className="rounded bg-accent px-4 py-2 text-[11px] font-bold text-white disabled:opacity-40">Create view</button></div>
        {draft.kind === "breakdown" && !canBreakdown(draft.y) && <p className="mt-2 text-[10px] text-warning">An over split requires a count such as runs, wickets, boundaries or balls.</p>}
      </section>
    </div>}
    </> : <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center text-xs text-text-secondary">Choose a player above to view this season's analysis.</div>}
    </div>{expanded && selected && <div role="dialog" aria-modal="true" aria-label={`${metricByKey[expanded.y].label} analysis`} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3" onKeyDown={(event) => { if (event.key === "Escape") setExpanded(null); }}>
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex justify-between gap-2"><div><h2 className="font-anton text-xl uppercase">{metricByKey[expanded.y].label} · {selected.name}</h2><p className="font-space-mono text-[10px] text-text-secondary">{props.currentSeason} season · ranking requires {metricByKey[expanded.y].minimum}{expanded.kind !== "ranking" && expanded.kind !== "breakdown" ? ` · horizontal: ${metricByKey[expanded.x].label}` : ""}</p></div><button type="button" onClick={() => setExpanded(null)} aria-label="Close analysis" className="rounded border border-border p-2"><X size={18} /></button></div>
        <div className="mb-4 flex gap-2 border-b border-border pb-2">{(["chart", "table", "matches"] as const).filter((tab) => expanded.kind !== "breakdown" || tab !== "table").map((tab) => <button key={tab} type="button" onClick={() => setDetailTab(tab)} className={`rounded px-3 py-1.5 text-xs capitalize ${detailTab === tab ? "bg-[var(--ink)] text-bg" : "border border-border text-text-secondary"}`}>{tab}</button>)}</div>
        {detailTab === "matches" ? <MatchEvidence fixtures={props.fixtures} player={selected} metricKey={expanded.y} teams={props.teams} players={props.players} /> : expanded.kind === "breakdown" ? <Breakdown stats={stats} keyName={expanded.y} /> : <ResultView rows={rowsFor(players, totals, { ...expanded, kind: detailTab === "table" ? expanded.kind === "ranking" ? "ranking" : "table" : "chart" }, selected.id)} config={{ ...expanded, kind: detailTab === "table" ? expanded.kind === "ranking" ? "ranking" : "table" : "chart" }} selectedId={selected.id} onSelect={select} teams={props.teams} />}
      </div>
    </div>}</div>;
}
