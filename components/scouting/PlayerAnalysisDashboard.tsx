"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Maximize2, Pencil, Trash2 } from "lucide-react";
import { PlayerAnalysisContent } from "./PlayerAnalysisBuilder";
import { ANALYSIS_DIAGRAMS, resolveAnalysisMetric, type AnalysisBuilderConfig } from "@/lib/logic/playerAnalysisBuilder";
import type { Player, Team } from "@/lib/types";
import { emptyPlayerAnalysisTotals, metricByKey, groupPlayerAnalysisMetrics, type PlayerAnalysisFixture, type PlayerAnalysisTotals, type PlayerMetricKey } from "@/lib/logic/playerAnalysisMetrics";
import { playerMatchPerformances, performanceBarColour, playerDashboardRankings, type PlayerDashboardStructure } from "@/lib/logic/playerAnalysisDashboard";
import PlayerScatterPlot from "./PlayerScatterPlot";

type Explore = (metric: PlayerMetricKey, view?: "chart" | "table" | "matches", paired?: PlayerMetricKey) => void;
type Props = {
  player: Player;
  players: Player[];
  playerMap: Record<string, Player>;
  teams: Record<string, Team>;
  totals: Record<string, PlayerAnalysisTotals>;
  fixtures: PlayerAnalysisFixture[];
  structure: PlayerDashboardStructure;
  onExplore: Explore;
  hiddenTiles?: string[];
  customTiles?: { id: string; config: AnalysisBuilderConfig }[];
  onRemoveTile?: (id: string) => void;
  onEditTile?: (id: string) => void;
  onExpandTile?: (id: string) => void;
  season?: number;
};
type Ranked = { player: Player; value: number };
const shown = (value: number | null, key: string) => value === null || !Number.isFinite(value) ? "—" : `${value.toLocaleString(undefined, { maximumFractionDigits: ["runs", "wickets", "fours", "sixes", "matches"].includes(key) ? 0 : 1 })}${metricByKey[key]?.unit ?? ""}`;
const metricValue = (stats: PlayerAnalysisTotals, key: string) => metricByKey[key]?.value(stats) ?? null;

function rankedPlayers(players: Player[], totals: Record<string, PlayerAnalysisTotals>, key: string): Ranked[] {
  const metric = metricByKey[key];
  return players.flatMap((player) => {
    const stats = totals[player.id] ?? emptyPlayerAnalysisTotals();
    const value = metric.value(stats);
    return metric.qualifies(stats) && value !== null ? [{ player, value }] : [];
  }).sort((a, b) => (metric.lowerBetter ? a.value - b.value : b.value - a.value) || a.player.name.localeCompare(b.player.name));
}

const TileControls = createContext<{ remove?: () => void; edit?: () => void; expand?: () => void; adaptive?: boolean; compact?: boolean }>({});
function Tile({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  const controls = useContext(TileControls);
  return <section className={`relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-bg ${controls.compact ? "p-1.5 [&_button]:min-h-0" : "p-3"} ${controls.adaptive ? "h-full" : className}`}>
    <div className={`${controls.compact ? "mb-1 pb-0.5" : "mb-2 pb-1.5"} flex shrink-0 items-start justify-between gap-2 border-b border-border/40`}><h3 title={title} className={`min-w-0 truncate font-anton ${controls.compact ? "text-[11px]" : "text-sm"} uppercase tracking-wider text-text-primary`}>{title}</h3><div className="flex shrink-0 gap-1">{controls.expand && <button type="button" onClick={controls.expand} aria-label={`Expand ${title}`} title="Expand analysis" className="rounded p-1 text-text-secondary hover:bg-accent/10 hover:text-accent"><Maximize2 size={12} /></button>}{controls.edit && <button type="button" onClick={controls.edit} aria-label={`Edit ${title}`} title="Edit analysis" className="rounded p-1 text-text-secondary hover:bg-accent/10 hover:text-accent"><Pencil size={12} /></button>}{controls.remove && <button type="button" onClick={controls.remove} aria-label={`Remove ${title}`} title="Remove analysis" className="rounded p-1 text-text-secondary hover:bg-accent/10 hover:text-accent"><Trash2 size={12} /></button>}</div></div>
    {children}
  </section>;
}

function ScatterTile({ props, x, y, title }: { props: Props; x: string; y: string; title: string }) {
  const mx = metricByKey[x], my = metricByKey[y];
  const points = props.players.flatMap((player) => {
    const stats = props.totals[player.id] ?? emptyPlayerAnalysisTotals();
    const vx = mx.value(stats), vy = my.value(stats);
    return vx !== null && vy !== null && mx.qualifies(stats) && my.qualifies(stats) ? [{ player, x: vx, y: vy, qualified: true }] : [];
  });
  const selfStats = props.totals[props.player.id] ?? emptyPlayerAnalysisTotals();
  const selfX = mx.value(selfStats), selfY = my.value(selfStats);
  if (selfX !== null && selfY !== null && !points.some((point) => point.player.id === props.player.id)) points.push({ player: props.player, x: selfX, y: selfY, qualified: false });
  return <Tile title={title} className="lg:col-span-5 lg:row-span-2">
    <button type="button" onClick={() => props.onExplore(y, "chart", x)} className="flex min-h-0 w-full flex-1 flex-col text-left" aria-label={`Open ${title} comparison`}>
      <PlayerScatterPlot points={points} selectedId={props.player.id} teams={props.teams} xMetric={mx} yMetric={my} />
      <p className="mt-1 shrink-0 truncate font-space-mono text-[9px] text-accent">{props.player.name}: {shown(selfX, x)} / {shown(selfY, y)} · expand ↗</p>
    </button>
  </Tile>;
}
function PhaseTile({ props, bowling }: { props: Props; bowling: boolean }) {
  const { compact } = useContext(TileControls);
  const keys = bowling ? ["powerplayWickets", "middleWickets", "deathWickets"] : ["powerplayRuns", "middleRuns", "deathRuns"];
  const rates = bowling ? ["powerplayEconomy", "middleEconomy", "deathEconomy"] : ["powerplayStrikeRate", "middleStrikeRate", "deathStrikeRate"];
  const stats = props.totals[props.player.id] ?? emptyPlayerAnalysisTotals();
  const phases = (["powerplay", "middle", "death"] as const).flatMap((phase, index) => {
    const balls = bowling ? stats.phase[phase].bowlBalls : stats.phase[phase].balls;
    return metricByKey[keys[index]].qualifies(stats) ? [{ phase, key: keys[index], rate: rates[index], balls, value: metricValue(stats, keys[index]) ?? 0 }] : [];
  });
  const maximum = Math.max(1, ...phases.map((phase) => phase.value));
  return <Tile title={bowling ? "Bowling phases" : "Scoring phases"} className="lg:col-span-4">
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="ml-[68px] flex justify-between font-space-mono text-[8px] text-text-secondary"><span>0</span><span>{bowling ? "Wickets" : "Runs"} → {maximum}</span></div>
      <div className={`flex min-h-0 flex-1 flex-col justify-around ${compact ? "gap-0.5" : "gap-1"}`}>{phases.map(({ phase, key, rate, balls, value }) => <button key={key} type="button" onClick={() => props.onExplore(key, metricValue(stats, rate) === null ? "table" : "chart", rate)} className={`grid w-full grid-cols-[62px_minmax(0,1fr)] items-center gap-1.5 text-left font-space-mono hover:text-accent ${compact ? "min-h-0 text-[8px]" : "min-h-[25px] text-[9px]"}`}>
        <span className="uppercase">{phase === "powerplay" ? "Power" : phase}</span>
        <span className={`relative min-w-0 overflow-hidden border border-border bg-surface/10 ${compact ? "h-4" : "h-5"}`}><span className="block h-full bg-accent/75" style={{ width: `${value / maximum * 100}%`, backgroundColor: "var(--accent)", opacity: 0.75 }} /><span className="absolute inset-0 flex items-center justify-end whitespace-nowrap px-1 font-bold text-text-primary">{value} ({bowling ? `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ""} overs` : balls}) @ {metricValue(stats, rate)?.toFixed(1) ?? "—"}</span></span>
      </button>)}</div>
    </div>
  </Tile>;
}

function RankingTile({ props, metricKey }: { props: Props; metricKey?: string }) {
  const { compact } = useContext(TileControls);
  if (!metricKey) return <Tile title="Player ranking" className="lg:col-span-3"><p className="m-auto text-center font-space-mono text-[9px] text-text-secondary">More match data needed for another ranking.</p></Tile>;
  const rows = rankedPlayers(props.players, props.totals, metricKey);
  const index = rows.findIndex((row) => row.player.id === props.player.id);
  const stats = props.totals[props.player.id] ?? emptyPlayerAnalysisTotals();
  const ownValue = metricValue(stats, metricKey);
  const firstRow = Math.max(0, Math.min(index - 1, rows.length - 3));
  const neighbors = index >= 0 ? [rows[firstRow], rows[firstRow + 1], rows[firstRow + 2]] : [undefined, { player: props.player, value: ownValue ?? 0 }, undefined];
  const metric = metricByKey[metricKey];
  return <Tile title={metric.label} className="lg:col-span-3">
    <button type="button" onClick={() => props.onExplore(metricKey, "table")} className={`flex min-h-0 w-full flex-1 flex-col text-left font-space-mono ${compact ? "gap-0.5 text-[8px] leading-tight" : "gap-1 text-[9px]"}`} aria-label={`Open ${metric.label} ranking`}>
      {neighbors.map((row, position) => {
        const selected = row?.player.id === props.player.id;
        return <div key={position} className={`grid min-h-0 w-full flex-1 grid-cols-[30px_1fr_44px] items-center gap-1 rounded px-1 py-0.5 ${selected ? "bg-accent/15 text-text-primary" : "text-text-secondary"}`}>
          <span className={selected ? `font-anton text-accent ${compact ? "text-[11px] leading-tight" : "text-lg"}` : ""}>{row ? index >= 0 ? `#${firstRow + position + 1}` : selected ? "—" : "" : ""}</span>
          <span className={`truncate ${selected ? "font-bold" : ""}`}>{row?.player.name ?? "—"}</span>
          <strong className={`text-right ${selected ? compact ? "text-[10px] leading-tight" : "text-sm" : ""}`}>{row ? selected && ownValue === null ? "—" : shown(row.value, metricKey) : ""}</strong>
        </div>;
      })}
      {index < 0 && <p className="text-[9px] text-text-secondary">{ownValue === null ? "No recorded value" : "Recorded · small sample, unranked"}</p>}
    </button>
  </Tile>;
}

function MetricsTile({ props, title, keys, className }: { props: Props; title: string; keys: string[]; className: string }) {
  const stats = props.totals[props.player.id] ?? emptyPlayerAnalysisTotals();
  return <Tile title={title} className={className}><div className="flex min-h-0 flex-1 flex-col gap-1">{keys.length === 0 && <p className="py-3 font-space-mono text-[10px] text-text-secondary">No matching delivery data yet.</p>}{groupPlayerAnalysisMetrics(keys).map((key) => {
    const metric = metricByKey[key];
    const rank = rankedPlayers(props.players, props.totals, key).findIndex((row) => row.player.id === props.player.id);
    return <button key={key} type="button" onClick={() => props.onExplore(key, "table")} className="grid min-h-0 w-full flex-1 grid-cols-[1fr_52px_48px] items-center gap-2 rounded px-1 py-0.5 text-left font-space-mono text-[10px] hover:bg-accent/10"><span className="truncate text-text-secondary">{metric.label}</span><strong className="text-right">{shown(metric.value(stats), key)}</strong><span className="text-right text-accent">{rank >= 0 ? `#${rank + 1}` : "—"}</span></button>;
  })}</div></Tile>;
}

function MatchScoreLabel({ label, opponent, date }: { label: string; opponent?: string; date: string }) {
  const cellRef = useRef<HTMLSpanElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const opponentRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const cell = cellRef.current;
    if (!cell) return;
    let active = true;
    const fit = () => {
      if (!active || cell.clientWidth <= 2) return;
      for (const [text, baseSize] of [[scoreRef.current, 8], [opponentRef.current, 6]] as const) {
        if (!text) continue;
        text.style.fontSize = `${baseSize}px`;
        const naturalWidth = text.getBoundingClientRect().width;
        if (naturalWidth > 0) text.style.fontSize = `${Math.min(baseSize, baseSize * (cell.clientWidth - 2) / naturalWidth)}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(cell);
    void document.fonts.ready.then(fit);
    return () => { active = false; observer.disconnect(); };
  }, [label, opponent]);
  return <span ref={cellRef} className={`relative min-w-0 ${opponent ? "h-5" : "h-3"}`} title={`${date}: ${label}${opponent ? ` vs ${opponent}` : ""}`}>
    <span className="block h-3 overflow-hidden leading-3"><span ref={scoreRef} className="inline-block whitespace-nowrap" style={{ fontSize: 8 }}>{label}</span></span>
    {opponent && <span className="absolute inset-x-0 top-3 block h-[8px] overflow-hidden pt-px font-normal leading-[7px] text-text-secondary"><span ref={opponentRef} className="inline-block whitespace-nowrap" style={{ fontSize: 6 }}>vs {opponent}</span></span>}
  </span>;
}

function TrendTile({ props, keyName }: { props: Props; keyName: string }) {
  const bowling = keyName === "wickets";
  const entries = playerMatchPerformances(props.fixtures, props.player.id, bowling);
  const worstRank = Math.max(1, ...entries.map((entry) => entry.rank));
  const columns = { gridTemplateColumns: `repeat(${Math.max(1, entries.length)}, minmax(0, 1fr))` };
  return <Tile title={`${metricByKey[keyName].label} by match`} className="lg:col-span-5">
    <button type="button" onClick={() => props.onExplore(keyName, "matches")} className="flex min-h-0 w-full flex-1 flex-col gap-1 text-left" aria-label={`Open ${metricByKey[keyName].label} performances ranked by ${bowling ? "wickets, then economy" : "runs, then balls faced"}`}>
      {entries.length > 0 && <>
        <div className="relative min-h-[36px] flex-1">
          <svg role="img" aria-label="Performance ranking bar chart for the latest ten matches" className="absolute inset-0 h-full w-full" viewBox={`0 0 ${entries.length * 100} 100`} preserveAspectRatio="none">
            {entries.map((entry, index) => {
              const barHeight = 100 * (worstRank - entry.rank + 1) / worstRank;
              const opponent = props.teams[entry.opponentTeamId ?? ""]?.shortName;
              return <rect key={entry.id} x={index * 100 + 18} y={100 - barHeight} width={64} height={barHeight} fill={performanceBarColour(entry.rank, worstRank)}><title>{`${entry.date}: ${entry.label}${opponent ? ` vs ${opponent}` : ""}`}</title></rect>;
            })}
          </svg>
        </div>
        <div className="grid shrink-0 text-center font-space-mono text-[8px] font-bold" style={columns}>{entries.map((entry) => {
          const opponent = props.teams[entry.opponentTeamId ?? ""]?.shortName;
          return <MatchScoreLabel key={entry.id} label={entry.label} opponent={opponent} date={entry.date} />;
        })}</div>
      </>}
      {entries.length === 0 && <span className="m-auto text-[10px] text-text-secondary">No matches recorded yet</span>}
    </button>
  </Tile>;
}

export default function PlayerAnalysisDashboard(props: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState({ width: 1200, height: 650 });
  useEffect(() => {
    const node = viewport.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setSpace((previous) => previous.width === node.clientWidth && previous.height === node.clientHeight ? previous : { width: node.clientWidth, height: node.clientHeight }));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const bowling = props.structure === "bowling" || props.structure === "bowling-with-batting";
  const balanced = props.structure === "balanced";
  const primaryBowling = bowling || balanced;
  const scatter = balanced ? { x: "runs", y: "wickets", title: "Batting × bowling impact" } : bowling ? { x: "wickets", y: "economy", title: "Wickets × economy" } : { x: "runs", y: "strikeRate", title: "Runs × strike rate" };
  const stats = props.totals[props.player.id] ?? emptyPlayerAnalysisTotals();
  const [rankingA, rankingB, rankingC] = playerDashboardRankings(stats, props.structure);
  const activePhases = (["powerplay", "middle", "death"] as const).filter((phase) => metricByKey[`${phase}${bowling ? "Wickets" : "Runs"}`].qualifies(stats));
  const available = (keys: string[]) => keys.filter((key) => metricByKey[key].qualifies(stats) && metricValue(stats, key) !== null).slice(0, 4);
  const coreKeys = available(balanced ? ["overs:7-12:economy", "overs:17-20:wickets", "position:6plus:runs", "boundaryRate", "batAverage", "economy"] : bowling ? ["overs:1-6:wickets", "overs:7-12:economy", "overs:13-16:wickets", "overs:17-20:economy", "wickets", "economy"] : ["position:1-2:runs", "position:3-5:runs", "position:6plus:runs", "boundaryRate", "batAverage", "strikeRate", "runs"]);
  const matchupKeys = available(props.structure === "bowling-with-batting" ? ["runs", "strikeRate", "fours", "sixes"] : props.structure === "batting-with-bowling" ? ["wickets", "economy", "deathWickets", "dotRate"] : balanced ? ["vs:pace:runs", "vs:spin:runs", "vs:left:wickets", "vs:right:wickets", "runs", "wickets"] : bowling ? ["vs:left:wickets", "vs:right:wickets", "vs:left:economy", "vs:right:economy", "wickets", "economy"] : ["vs:pace:runs", "vs:spin:runs", "vs:pace:sr", "vs:spin:sr", "runs", "strikeRate"]);
  const builtIn = stats.innings > 0 || stats.bowlBalls > 0 ? [
    { id: "comparison", content: <ScatterTile props={props} {...scatter} /> },
    { id: "phases", content: activePhases.length > 0 ? <PhaseTile props={props} bowling={bowling} /> : <MetricsTile props={props} title={bowling ? "Bowling output" : "Batting output"} keys={available(bowling ? ["wickets", "economy", "bowlAverage", "wicketsPerMatch"] : ["runs", "strikeRate", "batAverage", "boundaryRate"])} className="lg:col-span-4" /> },
    { id: "ranking-a", content: <RankingTile props={props} metricKey={rankingA} /> },
    { id: "core", content: <MetricsTile props={props} title={balanced ? "Both disciplines" : bowling ? "Bowling over ranges" : "Batting positions"} keys={coreKeys} className="lg:col-span-4" /> },
    { id: "ranking-b", content: <RankingTile props={props} metricKey={rankingB} /> },
    { id: "matches", content: <TrendTile props={props} keyName={primaryBowling ? "wickets" : "runs"} /> },
    { id: "matchups", content: <MetricsTile props={props} title={props.structure === "bowling-with-batting" ? "Batting contribution" : props.structure === "batting-with-bowling" ? "Bowling contribution" : "Matchups"} keys={matchupKeys} className="lg:col-span-4" /> },
    { id: "ranking-c", content: <RankingTile props={props} metricKey={rankingC} /> },
  ] : [];
  const tiles = [...builtIn.filter((tile) => !props.hiddenTiles?.includes(tile.id)), ...(props.customTiles ?? []).map((tile) => ({ id: tile.id, content: <Tile title={`${ANALYSIS_DIAGRAMS.find((diagram) => diagram.key === tile.config.diagram)!.name} · ${tile.config.diagram === "radar" ? "Player profile" : resolveAnalysisMetric(tile.config.y).label}`}><PlayerAnalysisContent teams={props.teams} config={tile.config} compact={tile.config.diagram === "ranking"} player={props.player} players={props.players} totals={props.totals} fixtures={props.fixtures} season={props.season ?? 0} onClose={() => {}} /></Tile> }))];
  if (!tiles.length) return <div ref={viewport} className="grid min-h-0 flex-1 place-items-center rounded-lg border border-dashed border-border bg-surface text-xs text-text-secondary">No analyses selected</div>;
  const adaptive = Boolean(props.hiddenTiles?.length || props.customTiles?.length || !builtIn.length || space.width < 850);
  const renderTile = (tile: typeof tiles[number], compact = false) => <TileControls.Provider value={{ adaptive, compact, remove: props.onRemoveTile ? () => props.onRemoveTile!(tile.id) : undefined, edit: tile.id.startsWith("custom-") && props.onEditTile ? () => props.onEditTile!(tile.id) : undefined, expand: tile.id.startsWith("custom-") && props.onExpandTile ? () => props.onExpandTile!(tile.id) : undefined }}>{tile.content}</TileControls.Provider>;
  if (!adaptive) return <div ref={viewport} data-dashboard-structure={props.structure} data-analysis-count={tiles.length} className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden pb-1 sm:grid-cols-2 lg:grid-cols-12 lg:grid-rows-3">{tiles.map((tile) => <React.Fragment key={tile.id}>{renderTile(tile)}</React.Fragment>)}</div>;
  const graphs = tiles.filter((tile) => tile.id === "comparison" || (tile.id.startsWith("custom-") && props.customTiles?.find((custom) => custom.id === tile.id)?.config.diagram !== "ranking"));
  const lists = tiles.filter((tile) => !graphs.includes(tile));
  const graphColumns = graphs.length > 1 ? 2 : 1;
  const graphRows = Math.ceil(graphs.length / graphColumns);
  const listColumns = graphs.length ? lists.length > 7 || (lists.length > 4 && space.height < 700) ? 2 : 1 : Math.min(3, lists.length);
  const listRows = Math.ceil(lists.length / listColumns);
  // Reserve the broad area for diagrams; compact lists share the remaining height.
  return <div ref={viewport} data-dashboard-structure={props.structure} data-analysis-count={tiles.length} className="grid min-h-0 flex-1 gap-2 overflow-hidden pb-1" style={{ gridTemplateColumns: graphs.length && lists.length ? listColumns === 2 ? "minmax(0, 1.8fr) minmax(0, 1fr)" : "minmax(0, 3fr) minmax(0, 1fr)" : "minmax(0, 1fr)" }}>
    {graphs.length > 0 && <div data-analysis-region="graphs" className="grid min-h-0 min-w-0 gap-2 overflow-hidden [&_svg[role=img]]:min-h-0" style={{ gridTemplateColumns: `repeat(${graphColumns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${graphRows}, minmax(0, 1fr))` }}>{graphs.map((tile, index) => <div key={tile.id} data-analysis-tile={tile.id} className="min-h-0 min-w-0" style={{ gridColumn: index === graphs.length - 1 && graphs.length % 2 === 1 ? "1 / -1" : undefined }}>{renderTile(tile)}</div>)}</div>}
    {lists.length > 0 && <div data-analysis-region="lists" className="grid min-h-0 min-w-0 gap-1 overflow-hidden" style={{ gridTemplateColumns: `repeat(${listColumns}, minmax(0, 1fr))`, gridTemplateRows: listColumns === 1 ? lists.map((tile) => `minmax(0, ${tile.id === "matches" ? 1.5 : tile.id.startsWith("ranking-") ? 1 : 1.2}fr)`).join(" ") : `repeat(${listRows}, minmax(0, 1fr))` }}>{lists.map((tile, index) => <div key={tile.id} data-analysis-tile={tile.id} className="min-h-0 min-w-0" style={{ gridColumn: index === lists.length - 1 && lists.length % listColumns === 1 ? "1 / -1" : undefined }}>{renderTile(tile, true)}</div>)}</div>}
  </div>;
}
