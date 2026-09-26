"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Player, Team } from "@/lib/types";
import { emptyPlayerAnalysisTotals, metricByKey, type PlayerAnalysisFixture, type PlayerAnalysisTotals, type PlayerMetricKey } from "@/lib/logic/playerAnalysisMetrics";
import { playerMatchPerformances, performanceBarColour, type PlayerDashboardStructure } from "@/lib/logic/playerAnalysisDashboard";
import { chartAxis, chartLabels, chartLowerEndRoleMatches } from "@/lib/logic/playerAnalysisChart";

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
};
type Ranked = { player: Player; value: number };
const chartNameClass = "whitespace-nowrap rounded border px-1 py-0.5 font-space-mono text-[8px] leading-none shadow-sm";
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

function Tile({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={`relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-bg p-3 ${className}`}>
    <div className="mb-2 shrink-0 border-b border-border/40 pb-1.5"><h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">{title}</h3></div>
    {children}
  </section>;
}

function ScatterTile({ props, x, y, title }: { props: Props; x: string; y: string; title: string }) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotSize, setPlotSize] = useState({ width: 420, height: 220 });
  const measurementRef = useRef<HTMLDivElement>(null);
  const [nameWidths, setNameWidths] = useState<Record<string, number>>({});
  const measurementKey = JSON.stringify([...props.players, props.player].map((player) => [player.id, player.name, player.id === props.player.id]));
  useEffect(() => {
    const node = measurementRef.current;
    if (!node) return;
    const measure = () => {
      const widths: Record<string, number> = {};
      node.querySelectorAll<HTMLElement>("[data-player-name]").forEach((label) => {
        widths[label.dataset.playerName!] = label.getBoundingClientRect().width;
      });
      setNameWidths(widths);
    };
    measure();
    const observer = new ResizeObserver(measure);
    node.querySelectorAll<HTMLElement>("[data-player-name]").forEach((label) => observer.observe(label));
    return () => observer.disconnect();
  }, [measurementKey]);
  useEffect(() => {
    const node = plotRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setPlotSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const mx = metricByKey[x], my = metricByKey[y];
  const points = props.players.flatMap((player) => {
    const stats = props.totals[player.id] ?? emptyPlayerAnalysisTotals();
    const vx = mx.value(stats), vy = my.value(stats);
    return vx !== null && vy !== null && mx.qualifies(stats) && my.qualifies(stats) ? [{ player, x: vx, y: vy }] : [];
  });
  const selfStats = props.totals[props.player.id] ?? emptyPlayerAnalysisTotals();
  const selfX = mx.value(selfStats), selfY = my.value(selfStats);
  if (selfX !== null && selfY !== null && !points.some((point) => point.player.id === props.player.id)) points.push({ player: props.player, x: selfX, y: selfY });
  const xAxis = chartAxis(points.map((point) => point.x));
  const yAxis = chartAxis(points.map((point) => point.y));
  const xPercent = (value: number) => {
    const fraction = (value - xAxis.min) / Math.max(0.001, xAxis.max - xAxis.min);
    return 8 + (mx.lowerBetter ? 1 - fraction : fraction) * 84;
  };
  const yPercent = (value: number) => {
    const fraction = (value - yAxis.min) / Math.max(0.001, yAxis.max - yAxis.min);
    return 8 + (my.lowerBetter ? fraction : 1 - fraction) * 84;
  };
  const projected = points.map((point) => ({ id: point.player.id, name: point.player.name, x: xPercent(point.x) / 100 * plotSize.width, y: yPercent(point.y) / 100 * plotSize.height,
    lowerEndEligible: chartLowerEndRoleMatches(point.player.role, [mx.group, my.group]) && mx.qualifies(props.totals[point.player.id] ?? emptyPlayerAnalysisTotals()) && my.qualifies(props.totals[point.player.id] ?? emptyPlayerAnalysisTotals()) }));
  const labels = chartLabels(projected, props.player.id, plotSize.width, plotSize.height, 5, nameWidths);
  const qualified = points.filter((point) => mx.qualifies(props.totals[point.player.id] ?? emptyPlayerAnalysisTotals()) && my.qualifies(props.totals[point.player.id] ?? emptyPlayerAnalysisTotals()));
  const avgX = qualified.length ? qualified.reduce((sum, point) => sum + point.x, 0) / qualified.length : null;
  const avgY = qualified.length ? qualified.reduce((sum, point) => sum + point.y, 0) / qualified.length : null;
  return <Tile title={title} className="lg:col-span-5 lg:row-span-2">
    <div ref={measurementRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0" style={{ width: "max-content" }}>
      {props.players.concat(props.players.some((player) => player.id === props.player.id) ? [] : [props.player]).map((player) => <span key={player.id} data-player-name={player.id} className={`block ${chartNameClass} ${player.id === props.player.id ? "font-bold" : ""}`} style={{ width: "max-content", height: 17 }}>{player.name}</span>)}
    </div>
    <button type="button" onClick={() => props.onExplore(y, "chart", x)} className="flex min-h-0 w-full flex-1 flex-col text-left" aria-label={`Open ${title} comparison`}>
      <div className="grid min-h-0 flex-1 grid-cols-[29px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_16px_16px] gap-x-1 font-space-mono text-[8px] text-text-secondary">
        <div className="relative">
          {yAxis.ticks.map((tick) => <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${yPercent(tick)}%` }}>{shown(tick, y)}</span>)}
        </div>
        <div ref={plotRef} className="relative min-h-0 overflow-hidden border border-border bg-surface/5">
          {xAxis.ticks.map((tick) => <span key={tick} className="absolute inset-y-0 border-l border-dashed border-border/50" style={{ left: `${xPercent(tick)}%` }} />)}
          {yAxis.ticks.map((tick) => <span key={tick} className="absolute inset-x-0 border-t border-dashed border-border/50" style={{ top: `${yPercent(tick)}%` }} />)}
          {avgX !== null && <span className="absolute inset-y-0 border-l border-dashed border-accent/60" style={{ left: `${xPercent(avgX)}%` }} />}
          {avgY !== null && <span className="absolute inset-x-0 border-t border-dashed border-accent/60" style={{ top: `${yPercent(avgY)}%` }} />}
          {points.filter((point) => point.player.id !== props.player.id).map((point) => <span key={point.player.id} title={`${point.player.name}: ${shown(point.x, x)} / ${shown(point.y, y)}`} className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bg" style={{ left: `${xPercent(point.x)}%`, top: `${yPercent(point.y)}%`, backgroundColor: props.teams[point.player.currentTeamId ?? ""]?.primaryColor ?? "#888" }} />)}
          {selfX !== null && selfY !== null && <span className="absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-accent ring-2 ring-accent" style={{ left: `${xPercent(selfX)}%`, top: `${yPercent(selfY)}%` }} />}
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${plotSize.width} ${plotSize.height}`} preserveAspectRatio="none" aria-hidden="true">{labels.map((label) => <line key={label.id} x1={label.anchorX} y1={label.anchorY} x2={label.connectorX} y2={label.connectorY} stroke="currentColor" strokeWidth="1" className={label.id === props.player.id ? "text-accent" : "text-text-secondary/70"} />)}</svg>
          {labels.map((label) => <span key={label.id} className={`pointer-events-none absolute z-20 ${chartNameClass} ${label.id === props.player.id ? "border-accent bg-bg font-bold text-accent" : "border-border bg-bg/95 text-text-primary"}`} style={{ left: label.left, top: label.top, width: "max-content", height: 17 }}>{label.name}</span>)}
          {points.length === 0 && <span className="absolute inset-0 grid place-items-center text-[10px]">No recorded comparison yet</span>}
        </div>
        <div className="flex items-center justify-center font-bold uppercase [writing-mode:vertical-rl] rotate-180">{my.label}</div>
        <div className="relative">{xAxis.ticks.map((tick) => <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${xPercent(tick)}%` }}>{shown(tick, x)}</span>)}</div>
        <span />
        <div className="text-center font-bold uppercase">{mx.label} →</div>
      </div>
      <p className="mt-1 font-space-mono text-[9px] text-accent">{props.player.name}: {shown(selfX, x)} / {shown(selfY, y)} · expand ↗</p>
    </button>
  </Tile>;
}

function PhaseTile({ props, bowling }: { props: Props; bowling: boolean }) {
  const keys = bowling ? ["powerplayWickets", "middleWickets", "deathWickets"] : ["powerplayRuns", "middleRuns", "deathRuns"];
  const rates = bowling ? ["powerplayEconomy", "middleEconomy", "deathEconomy"] : ["powerplayStrikeRate", "middleStrikeRate", "deathStrikeRate"];
  const stats = props.totals[props.player.id] ?? emptyPlayerAnalysisTotals();
  const phases = (["powerplay", "middle", "death"] as const).flatMap((phase, index) => {
    const balls = bowling ? stats.phase[phase].bowlBalls : stats.phase[phase].balls;
    return balls > 0 ? [{ phase, key: keys[index], rate: rates[index], balls, value: metricValue(stats, keys[index]) ?? 0 }] : [];
  });
  const maximum = Math.max(1, ...phases.map((phase) => phase.value));
  return <Tile title={bowling ? "Bowling phases" : "Scoring phases"} className="lg:col-span-4">
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="ml-[68px] flex justify-between font-space-mono text-[8px] text-text-secondary"><span>0</span><span>{bowling ? "Wickets" : "Runs"} → {maximum}</span></div>
      <div className="flex min-h-0 flex-1 flex-col justify-around gap-1">{phases.map(({ phase, key, rate, balls, value }) => <button key={key} type="button" onClick={() => props.onExplore(key, metricValue(stats, rate) === null ? "table" : "chart", rate)} className="grid min-h-[25px] w-full grid-cols-[62px_minmax(0,1fr)] items-center gap-1.5 text-left font-space-mono text-[9px] hover:text-accent">
        <span className="uppercase">{phase === "powerplay" ? "Power" : phase}</span>
        <span className="relative h-5 border border-border bg-surface/10"><span className="block h-full bg-accent/75" style={{ width: `${value / maximum * 100}%` }} /><span className="absolute inset-0 flex items-center justify-end whitespace-nowrap px-1 font-bold text-text-primary">{value} ({bowling ? `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ""} overs` : balls}) @ {metricValue(stats, rate)?.toFixed(1) ?? "—"}</span></span>
      </button>)}</div>
    </div>
  </Tile>;
}

function RankingTile({ props, metricKey }: { props: Props; metricKey: string }) {
  const rows = rankedPlayers(props.players, props.totals, metricKey);
  const index = rows.findIndex((row) => row.player.id === props.player.id);
  const stats = props.totals[props.player.id] ?? emptyPlayerAnalysisTotals();
  const ownValue = metricValue(stats, metricKey);
  const firstRow = Math.max(0, Math.min(index - 1, rows.length - 3));
  const neighbors = index >= 0 ? [rows[firstRow], rows[firstRow + 1], rows[firstRow + 2]] : [undefined, { player: props.player, value: ownValue ?? 0 }, undefined];
  const metric = metricByKey[metricKey];
  return <Tile title={metric.label} className="lg:col-span-3">
    <button type="button" onClick={() => props.onExplore(metricKey, "table")} className="flex min-h-0 w-full flex-1 flex-col gap-1 text-left font-space-mono text-[9px]" aria-label={`Open ${metric.label} ranking`}>
      {neighbors.map((row, position) => {
        const selected = row?.player.id === props.player.id;
        return <div key={position} className={`grid min-h-0 w-full flex-1 grid-cols-[30px_1fr_44px] items-center gap-1 rounded px-1 py-0.5 ${selected ? "bg-accent/15 text-text-primary" : "text-text-secondary"}`}>
          <span className={selected ? "font-anton text-lg text-accent" : ""}>{row ? index >= 0 ? `#${firstRow + position + 1}` : selected ? "—" : "" : ""}</span>
          <span className={`truncate ${selected ? "font-bold" : ""}`}>{row?.player.name ?? "—"}</span>
          <strong className={`text-right ${selected ? "text-sm" : ""}`}>{row ? selected && ownValue === null ? "—" : shown(row.value, metricKey) : ""}</strong>
        </div>;
      })}
      {index < 0 && <p className="text-[9px] text-text-secondary">{ownValue === null ? "No recorded value" : "Recorded · small sample, unranked"}</p>}
    </button>
  </Tile>;
}

function MetricsTile({ props, title, keys, className }: { props: Props; title: string; keys: string[]; className: string }) {
  const stats = props.totals[props.player.id] ?? emptyPlayerAnalysisTotals();
  return <Tile title={title} className={className}><div className="flex min-h-0 flex-1 flex-col gap-1">{keys.length === 0 && <p className="py-3 font-space-mono text-[10px] text-text-secondary">No matching delivery data yet.</p>}{keys.map((key) => {
    const metric = metricByKey[key];
    const rank = rankedPlayers(props.players, props.totals, key).findIndex((row) => row.player.id === props.player.id);
    return <button key={key} type="button" onClick={() => props.onExplore(key, "table")} className="grid min-h-0 w-full flex-1 grid-cols-[1fr_52px_48px] items-center gap-2 rounded px-1 py-0.5 text-left font-space-mono text-[10px] hover:bg-accent/10"><span className="truncate text-text-secondary">{metric.label}</span><strong className="text-right">{shown(metric.value(stats), key)}</strong><span className="text-right text-accent">{rank >= 0 ? `#${rank + 1}` : "—"}</span></button>;
  })}</div></Tile>;
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
          return <span key={entry.id} className="relative whitespace-nowrap" title={`${entry.date}: ${entry.label}${opponent ? ` vs ${opponent}` : ""}`}>{entry.label}{opponent && <span className="absolute inset-x-0 top-full pt-px text-[6px] font-normal leading-[7px] text-text-secondary">vs {opponent}</span>}</span>;
        })}</div>
      </>}
      {entries.length === 0 && <span className="m-auto text-[10px] text-text-secondary">No matches recorded yet</span>}
    </button>
  </Tile>;
}

export default function PlayerAnalysisDashboard(props: Props) {
  const bowling = props.structure === "bowling" || props.structure === "bowling-with-batting";
  const balanced = props.structure === "balanced";
  const primaryBowling = bowling || balanced;
  const scatter = balanced ? { x: "runs", y: "wickets", title: "Batting × bowling impact" } : bowling ? { x: "wickets", y: "economy", title: "Wickets × economy" } : { x: "runs", y: "strikeRate", title: "Runs × strike rate" };
  const rankingA = primaryBowling ? "wickets" : "sixes";
  const rankingB = balanced ? "runs" : bowling ? "economy" : "runs";
  const stats = props.totals[props.player.id] ?? emptyPlayerAnalysisTotals();
  const rankingC = props.structure === "bowling-with-batting" ? "runs" : props.structure === "batting-with-bowling" ? "wickets" : balanced ? stats.sixes > 0 ? "sixes" : metricValue(stats, "batAverage") !== null ? "batAverage" : "strikeRate" : bowling ? stats.phase.death.bowlBalls > 0 ? "deathWickets" : stats.phase.powerplay.bowlBalls + stats.phase.middle.bowlBalls > 0 ? "dotRate" : stats.wickets > 0 ? "bowlAverage" : "wicketsPerMatch" : metricValue(stats, "batAverage") !== null ? "batAverage" : metricValue(stats, "boundaryRate") !== null ? "boundaryRate" : "fours";
  const activePhases = (["powerplay", "middle", "death"] as const).filter((phase) => bowling ? stats.phase[phase].bowlBalls > 0 : stats.phase[phase].balls > 0);
  const available = (keys: string[]) => keys.filter((key) => metricValue(stats, key) !== null).slice(0, 4);
  const coreKeys = available(balanced ? ["overs:7-12:economy", "overs:17-20:wickets", "position:6plus:runs", "boundaryRate", "batAverage", "economy"] : bowling ? ["overs:1-6:wickets", "overs:7-12:economy", "overs:13-16:wickets", "overs:17-20:economy", "wickets", "economy"] : ["position:1-2:runs", "position:3-5:runs", "position:6plus:runs", "boundaryRate", "batAverage", "strikeRate", "runs"]);
  const matchupKeys = available(props.structure === "bowling-with-batting" ? ["runs", "strikeRate", "fours", "sixes"] : props.structure === "batting-with-bowling" ? ["wickets", "economy", "deathWickets", "dotRate"] : balanced ? ["vs:pace:runs", "vs:spin:runs", "vs:left:wickets", "vs:right:wickets", "runs", "wickets"] : bowling ? ["vs:left:wickets", "vs:right:wickets", "vs:left:economy", "vs:right:economy", "wickets", "economy"] : ["vs:pace:runs", "vs:spin:runs", "vs:pace:sr", "vs:spin:sr", "runs", "strikeRate"]);
  return <div data-dashboard-structure={props.structure} className="grid min-h-0 flex-1 grid-cols-1 gap-2 pb-1 sm:grid-cols-2 lg:grid-cols-12 lg:grid-rows-3">
    <ScatterTile props={props} {...scatter} />
    {activePhases.length > 0 ? <PhaseTile props={props} bowling={bowling} /> : <MetricsTile props={props} title={bowling ? "Bowling output" : "Batting output"} keys={available(bowling ? ["wickets", "economy", "bowlAverage", "wicketsPerMatch"] : ["runs", "strikeRate", "batAverage", "boundaryRate"])} className="lg:col-span-4" />}
    <RankingTile props={props} metricKey={rankingA} />
    <MetricsTile props={props} title={balanced ? "Both disciplines" : bowling ? "Bowling over ranges" : "Batting positions"} keys={coreKeys} className="lg:col-span-4" />
    <RankingTile props={props} metricKey={rankingB} />
    <TrendTile props={props} keyName={primaryBowling ? "wickets" : "runs"} />
    <MetricsTile props={props} title={props.structure === "bowling-with-batting" ? "Batting contribution" : props.structure === "batting-with-bowling" ? "Bowling contribution" : "Matchups"} keys={matchupKeys} className="lg:col-span-4" />
    <RankingTile props={props} metricKey={rankingC} />
  </div>;
}
