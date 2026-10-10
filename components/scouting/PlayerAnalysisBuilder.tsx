"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import type { Player, Team } from "@/lib/types";
import PlayerScatterPlot from "./PlayerScatterPlot";
import { emptyPlayerAnalysisTotals, type PlayerAnalysisFixture, type PlayerAnalysisTotals } from "@/lib/logic/playerAnalysisMetrics";
import {
  ANALYSIS_DIAGRAMS, ANALYSIS_COUNTS, ANALYSIS_PART_COLOURS, analysisData, analysisHistogram, analysisPercentile, analysisQuantile,
  analysisRoleMatches, changeAnalysisDiagram, defaultAnalysisConfig, isAnalysisBreakdown, isAnalysisTrend,
  ANALYSIS_METRIC_CHOICES, analysisMetricTemplate, analysisMetricChoiceLabel, resolveAnalysisMetric, analysisAxis, analysisTickLabel,
  type AnalysisBuilderConfig, type AnalysisDatum, type AnalysisDiagram, type AnalysisGrouping, type AnalysisPlayerGroup,
} from "@/lib/logic/playerAnalysisBuilder";

type Props = {
  player: Player; players: Player[]; totals: Record<string, PlayerAnalysisTotals>;
  teams?: Record<string, Team>;
  fixtures: PlayerAnalysisFixture[]; season: number; onClose: () => void;
  initialConfig?: AnalysisBuilderConfig;
  onSave?: (config: AnalysisBuilderConfig) => void;
  saveLabel?: string;
  compact?: boolean;
};
const accent = "var(--accent)";
const format = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
const compact = (name: string) => name.length > 17 ? `${name.slice(0, 15)}…` : name;
const control = "h-8 max-w-full rounded border border-border bg-bg px-2 text-[10px] font-normal text-text-primary outline-none focus:border-accent";

function metricTopic(key: string): string {
  const phase = key.match(/^(powerplay|middle|death)(?=[A-Z])/)?.[1];
  if (phase) return `${phase === "middle" ? "Middle overs" : phase === "death" ? "Death overs" : "Powerplay"}`;
  if (key.startsWith("position:")) return "Batting positions";
  if (key.startsWith("overs:")) return "Over ranges";
  if (key.startsWith("over:")) return "Individual overs";
  if (key.startsWith("vs:")) return "Matchups";
  if (key.startsWith("result:")) return "Match results";
  if (key.startsWith("innings:")) return "First / second innings";
  return resolveAnalysisMetric(key).group;
}

export function MetricSelector({ value, onChange, label, countsOnly = false, allowWickets = true }: { value: string; onChange: (key: string) => void; label: string; countsOnly?: boolean; allowWickets?: boolean }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ left: 0, top: 0, width: 300, height: 320 });
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const template = analysisMetricTemplate(value);
  const over = value.match(/^over:(\d+):/);
  const range = value.match(/overs:(\d+)-(\d+):/);
  const position = value.match(/^position:([^:]+):/);
  const suffix = value.split(":").at(-1)!;
  useEffect(() => {
    if (!open) return;
    field.current?.focus();
    const outside = (event: MouseEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);
  const options = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const metric of ANALYSIS_METRIC_CHOICES) {
      const key = metric.key;
      if (countsOnly && !ANALYSIS_COUNTS.includes(key)) continue;
      if (!allowWickets && key === "wickets") continue;
      if (search && !`${analysisMetricChoiceLabel(key)} ${metric.group} ${metricTopic(key)}`.toLowerCase().includes(search.toLowerCase())) continue;
      const topic = metricTopic(key);
      groups.set(topic, [...(groups.get(topic) ?? []), key]);
    }
    return Array.from(groups.entries());
  }, [search, countsOnly, allowWickets]);
  const choose = (key: string) => { onChange(key); setOpen(false); trigger.current?.focus(); };
  const openMenu = () => {
    if (open) { setOpen(false); return; }
    const rect = trigger.current!.getBoundingClientRect();
    const width = Math.min(Math.max(300, rect.width), window.innerWidth - 16);
    const below = window.innerHeight - rect.bottom - 12;
    const height = Math.min(330, Math.max(below, rect.top - 12));
    setPlacement({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: below >= height ? rect.bottom + 4 : Math.max(8, rect.top - height - 4), width, height });
    setSearch(""); setOpen(true);
  };
  const changeRange = (start: number, end: number) => onChange(`${position ? `position:${position[1]}:` : ""}overs:${start}-${end}:${suffix}`);
  return <div className="flex min-w-0 flex-col gap-1 text-[9px] font-semibold uppercase tracking-wide text-text-secondary">
    <span>{label}</span>
    <button ref={trigger} type="button" onClick={openMenu} aria-label={label} aria-haspopup="listbox" aria-expanded={open} className={`${control} flex min-w-0 items-center justify-between gap-1 text-left normal-case tracking-normal`}><span className="truncate">{resolveAnalysisMetric(value).label}</span><ChevronDown size={12} className="shrink-0" /></button>
    {(over || range || position) && <div className="flex flex-wrap items-center gap-1 normal-case tracking-normal">
      {position && <label className="flex items-center gap-1">Position<select aria-label={`${label} batting position`} value={position[1]} onChange={(event) => onChange(value.replace(/^position:[^:]+:/, `position:${event.target.value}:`))} className="h-6 rounded border border-border bg-bg px-1 font-normal">{Array.from({ length: 11 }, (_, index) => <option key={index} value={String(index + 1)}>No. {index + 1}</option>)}<option value="1-2">Openers (1–2)</option><option value="3-5">Middle order (3–5)</option><option value="6plus">No. 6 or lower</option></select></label>}
      {over && <label className="flex items-center gap-1">Over<input aria-label={`${label} over number`} type="number" min={1} max={20} value={over[1]} onChange={(event) => onChange(`over:${Math.max(1, Math.min(20, Number(event.target.value) || 1))}:${suffix}`)} className="h-6 w-12 rounded border border-border bg-bg px-1 font-normal" /></label>}
      {range && <><label className="flex items-center gap-1">Overs<input aria-label={`${label} first over`} type="number" min={1} max={20} value={range[1]} onChange={(event) => { const start = Math.max(1, Math.min(20, Number(event.target.value) || 1)); changeRange(start, Math.max(start, Number(range[2]))); }} className="h-6 w-12 rounded border border-border bg-bg px-1 font-normal" /></label><label className="flex items-center gap-1">to<input aria-label={`${label} last over`} type="number" min={1} max={20} value={range[2]} onChange={(event) => { const end = Math.max(1, Math.min(20, Number(event.target.value) || 1)); changeRange(Math.min(Number(range[1]), end), end); }} className="h-6 w-12 rounded border border-border bg-bg px-1 font-normal" /></label></>}
    </div>}
    {open && createPortal(<div ref={menu} data-analysis-options="true" className="fixed z-[150] flex flex-col overflow-hidden rounded-lg border border-border bg-bg shadow-xl" style={{ left: placement.left, top: placement.top, width: placement.width, height: placement.height }} onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const choices = Array.from(menu.current!.querySelectorAll<HTMLButtonElement>('[role="option"]'));
        const index = choices.indexOf(document.activeElement as HTMLButtonElement);
        choices[Math.max(0, Math.min(choices.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
      }
      if (event.key === "Enter" && event.target === field.current && options[0]?.[1][0]) choose(options[0][1][0]);
    }}>
      <div className="shrink-0 border-b border-border p-2"><input ref={field} aria-label={`Search ${label.toLowerCase()}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search statistics…" className={`${control} w-full`} /></div>
      <div role="listbox" aria-label={`${label} statistics`} className="min-h-0 flex-1 overflow-y-auto p-1 normal-case tracking-normal">{options.map(([topic, keys]) => <div key={topic}><p className="sticky top-0 bg-bg px-2 py-1.5 text-[9px] font-bold uppercase text-text-secondary">{topic}</p>{keys.map((key) => <button type="button" key={key} role="option" aria-selected={key === template} onClick={() => choose(key)} className={`block w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-accent/10 focus:bg-accent/10 ${key === template ? "text-accent" : "text-text-primary"}`}>{analysisMetricChoiceLabel(key)}</button>)}</div>)}{!options.length && <p className="p-3 text-[11px] text-text-secondary">No matching statistics.</p>}</div>
    </div>, document.body)}
  </div>;
}

function DiagramThumbnail({ diagram }: { diagram: AnalysisDiagram }) {
  const colour = "currentColor";
  let drawing: React.ReactNode;
  if (diagram === "scatter" || diagram === "bubble") drawing = <>{[[12, 29], [25, 25], [35, 17], [44, 23], [55, 9]].map(([cx, cy], index) => <circle key={index} cx={cx} cy={cy} r={diagram === "bubble" ? 2 + index : 2.5} fill={colour} opacity={0.45 + index * 0.1} />)}</>;
  else if (diagram === "pie" || diagram === "doughnut") drawing = <><circle cx="35" cy="20" r="15" fill={colour} opacity="0.3" /><path d="M35 20 L35 5 A15 15 0 0 1 48 28 Z" fill={colour} />{diagram === "doughnut" && <circle cx="35" cy="20" r="8" fill="var(--background)" />}</>;
  else if (diagram === "radar") drawing = <><polygon points="35,3 54,16 47,36 23,36 16,16" fill="none" stroke={colour} opacity="0.3" /><polygon points="35,8 50,18 42,29 25,32 22,17" fill={colour} fillOpacity="0.3" stroke={colour} /></>;
  else if (diagram === "table" || diagram === "ranking") drawing = <>{[7, 16, 25, 34].map((y) => <line key={y} x1="8" x2="62" y1={y} y2={y} stroke={colour} opacity="0.5" />)}{[8, 24, 44, 62].slice(0, diagram === "ranking" ? 3 : 4).map((x) => <line key={x} x1={x} x2={x} y1="7" y2="34" stroke={colour} opacity="0.5" />)}</>;
  else if (diagram === "treemap") drawing = <><rect x="8" y="5" width="30" height="30" fill={colour} opacity="0.7" /><rect x="40" y="5" width="22" height="17" fill={colour} opacity="0.4" /><rect x="40" y="24" width="22" height="11" fill={colour} opacity="0.25" /></>;
  else if (diagram === "box") drawing = <>{[15, 35, 55].map((x, index) => <g key={x}><line x1={x} x2={x} y1={4 + index * 3} y2="35" stroke={colour} /><rect x={x - 6} y={12 + index * 3} width="12" height="13" fill={colour} fillOpacity="0.3" stroke={colour} /><line x1={x - 6} x2={x + 6} y1={17 + index * 3} y2={17 + index * 3} stroke={colour} /></g>)}</>;
  else if (diagram === "dot") drawing = <>{[10, 20, 25, 37, 49, 58].map((x, index) => <circle key={x} cx={x} cy={18 + index % 2 * 8} r="3" fill={colour} />)}</>;
  else if (isAnalysisTrend(diagram)) drawing = <>{diagram === "area" && <path d="M8 32 L20 20 L32 26 L45 12 L60 7 L60 36 L8 36 Z" fill={colour} opacity="0.25" />}<polyline points={diagram === "cumulative" ? "8,34 20,29 32,22 45,17 60,5" : diagram === "rolling" ? "8,29 20,25 32,24 45,17 60,12" : "8,32 20,20 32,26 45,12 60,7"} fill="none" stroke={colour} strokeWidth="2" /></>;
  else if (diagram === "horizontal") drawing = <>{[45, 30, 20].map((width, index) => <rect key={index} x="10" y={6 + index * 11} width={width} height="7" fill={colour} opacity={1 - index * 0.25} />)}</>;
  else drawing = <>{[18, 29, 23, 33].map((height, index) => <g key={index}>
    <rect x={8 + index * 14} y={36 - height} width={diagram === "grouped" ? 5 : 10} height={height} fill={colour} opacity="0.7" />
    {diagram === "grouped" && <rect x={14 + index * 14} y={42 - height} width="5" height={height - 6} fill={colour} opacity="0.3" />}
    {["stacked", "percent"].includes(diagram) && <rect x={8 + index * 14} y={diagram === "percent" ? 6 : 36 - height} width="10" height={diagram === "percent" ? 10 : height / 3} fill={colour} opacity="0.3" />}
  </g>)}</>;
  return <svg viewBox="0 0 70 40" className="h-6 w-10 shrink-0" aria-hidden="true">{drawing}</svg>;
}

function ChartSvg({ children, label }: { children: React.ReactNode; label: string }) {
  return <svg viewBox="0 0 720 320" role="img" aria-label={label} className="h-full min-h-[230px] w-full" style={{ maxHeight: 450 }}><title>{label}</title>{children}</svg>;
}
function EmptyPreview({ breakdown = false }: { breakdown?: boolean }) {
  return <div className="grid min-h-[230px] flex-1 place-items-center rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-secondary">{breakdown ? "No recorded contribution for this breakdown. Try another statistic or grouping." : "No qualifying data for these selections. Choose another statistic or comparison group."}</div>;
}

function AxisBreak({ x, y, vertical = false }: { x: number; y: number; vertical?: boolean }) {
  return <g aria-label="Axis starts above zero" transform={`translate(${x} ${y})${vertical ? " rotate(90)" : ""}`}><rect x="-6" y="-5" width="12" height="10" fill="var(--background)" /><path d="M-6 3 L-2 -3 M2 3 L6 -3" stroke="var(--text-secondary)" strokeWidth="1.5" fill="none" /></g>;
}

function PlotAxes({ left, right, top, bottom }: { left: number; right: number; top: number; bottom: number }) {
  return <g aria-label="Chart axes" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5"><line x1={left} x2={left} y1={top} y2={bottom} /><line x1={left} x2={right} y1={bottom} y2={bottom} /></g>;
}

function GraphPreview({ config, rows, players = [], teams = {}, selectedId = "" }: { config: AnalysisBuilderConfig; rows: AnalysisDatum[]; players?: Player[]; teams?: Record<string, Team>; selectedId?: string }) {
  const { diagram } = config;
  let data = rows;
  if (diagram === "scatter" || diagram === "bubble") {
    const playerMap = new Map(players.map((player) => [player.id, player]));
    const points = rows.flatMap((row) => {
      const player = playerMap.get(row.id);
      return player ? [{ player, x: row.secondary ?? 0, y: row.value, size: row.size }] : [];
    });
    return <PlayerScatterPlot points={points} selectedId={selectedId} teams={teams} xMetric={resolveAnalysisMetric(config.x)} yMetric={resolveAnalysisMetric(config.y)} bubble={diagram === "bubble"} sizeMetric={resolveAnalysisMetric(config.size)} sizeLowerBetter={resolveAnalysisMetric(config.size).lowerBetter} />;
  }
  if (diagram === "histogram") data = analysisHistogram(rows.map((row) => row.value));
  if (!data.length || (isAnalysisBreakdown(diagram) && data.every((row) => ["stacked", "percent"].includes(diagram) ? (row.parts ?? []).every((value) => value === 0) : row.value === 0))) return <EmptyPreview breakdown={isAnalysisBreakdown(diagram)} />;
  const comparison = config.grouping === "players" && !["scatter", "bubble", "pie", "doughnut", "treemap"].includes(diagram);
  if (comparison) {
    const sorted = [...data].sort((a, b) => resolveAnalysisMetric(config.y).lowerBetter ? a.value - b.value : b.value - a.value);
    data = sorted.slice(0, 12);
    const self = sorted.find((row) => row.self);
    if (self && !data.some((row) => row.self)) data = [...data.slice(0, 11), self];
  }
  const x0 = 56, x1 = diagram === "grouped" ? 660 : 694, y0 = 24, y1 = 274;
  const width = x1 - x0, height = y1 - y0;
  const axisValues = data.map((row) => diagram === "percent" ? 100 : diagram === "stacked" ? (row.parts ?? []).reduce((sum, value) => sum + value, 0) : row.value);
  const magnitudeBars = ["bars", "horizontal", "grouped", "stacked", "percent", "histogram"].includes(diagram);
  const primaryAxis = analysisAxis(axisValues, !magnitudeBars && resolveAnalysisMetric(config.y).lowerBetter, magnitudeBars);
  const secondaryAxis = analysisAxis(data.map((row) => row.secondary ?? 0), diagram !== "grouped" && resolveAnalysisMetric(config.x).lowerBetter, diagram === "grouped");
  const yGap = primaryAxis.truncated ? 22 : 0;
  const y = (value: number) => y1 - yGap - primaryAxis.fraction(value) * (height - yGap);
  const secondGap = secondaryAxis.truncated ? 22 : 0;
  const secondY = (value: number) => y1 - secondGap - secondaryAxis.fraction(value) * (height - secondGap);
  const x = (index: number) => x0 + (index + 0.5) / data.length * width;
  const colour = (row: AnalysisDatum, index: number) => row.self ? accent : ANALYSIS_PART_COLOURS[index % ANALYSIS_PART_COLOURS.length];
  const tooltip = (row: AnalysisDatum) => <title>{`${row.name} · ${resolveAnalysisMetric(config.y).label}: ${format(row.value)}${row.secondary !== undefined ? ` · ${resolveAnalysisMetric(config.x).label}: ${format(row.secondary)}` : ""}`}</title>;
  const axes = <>
    <PlotAxes left={x0} right={x1} top={y0} bottom={y1} />
    {primaryAxis.ticks.map((tick) => <g key={tick}><line x1={x0 - 4} x2={x0} y1={y(tick)} y2={y(tick)} stroke="var(--text-secondary)" /><text x={x0 - 8} y={y(tick) + 4} textAnchor="end" fontSize="10" fill="var(--text-secondary)">{analysisTickLabel(tick, primaryAxis.step)}{diagram === "percent" ? "%" : ""}</text></g>)}
    {primaryAxis.truncated && <AxisBreak x={x0} y={y1 - 11} vertical />}
    {diagram === "grouped" && <><line x1={x1} x2={x1} y1={y0} y2={y1} stroke="#38bdf8" />{secondaryAxis.ticks.map((tick) => <text key={tick} x={x1 + 5} y={secondY(tick) + 4} fontSize="9" fill="#38bdf8">{analysisTickLabel(tick, secondaryAxis.step)}</text>)}{secondaryAxis.truncated && <AxisBreak x={x1} y={y1 - 11} vertical />}</>}
  </>;
  const captions = data.map((row, index) => {
    const every = Math.max(1, Math.ceil(data.length / 10));
    if (index % every && !row.self) return null;
    const fontSize = data.length > 10 ? 8 : 10;
    const maxCharacters = Math.max(3, Math.floor((width / data.length - 6) / (fontSize * 0.65)));
    const caption = row.name.length > maxCharacters ? `${row.name.slice(0, maxCharacters - 1)}…` : row.name;
    return <text key={row.id} x={x(index)} y={294} textAnchor="middle" fontSize={fontSize} fill={row.self ? accent : "var(--text-secondary)"}><title>{row.name}</title>{caption}</text>;
  });

  if (diagram === "pie" || diagram === "doughnut") {
    const positive = data.filter((row) => row.value > 0), total = positive.reduce((sum, row) => sum + row.value, 0);
    let angle = -Math.PI / 2;
    return <ChartSvg label={diagram === "pie" ? "Contribution pie chart" : "Contribution doughnut chart"}>
      {positive.map((row, index) => {
        const start = angle; angle += row.value / total * Math.PI * 2;
        const cx = 225, cy = 155, radius = 125;
        const d = `M${cx},${cy} L${cx + Math.cos(start) * radius},${cy + Math.sin(start) * radius} A${radius},${radius} 0 ${angle - start > Math.PI ? 1 : 0} 1 ${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius} Z`;
        return positive.length === 1 ? <circle key={row.id} cx={cx} cy={cy} r={radius} fill={colour(row, index)}>{tooltip(row)}</circle> : <path key={row.id} d={d} fill={colour(row, index)} stroke="var(--background)" strokeWidth="2">{tooltip(row)}</path>;
      })}
      {diagram === "doughnut" && <><circle cx="225" cy="155" r="76" fill="var(--background)" /><text x="225" y="151" textAnchor="middle" fontSize="24" fill="var(--ink)">{format(total)}</text><text x="225" y="173" textAnchor="middle" fontSize="11" fill="var(--text-secondary)">Total</text></>}
      {positive.slice(0, 12).map((row, index) => <g key={row.id}><rect x="400" y={22 + index * 23} width="9" height="9" fill={colour(row, index)} /><text x="418" y={31 + index * 23} fontSize="11" fill="var(--ink)">{compact(row.name)}: {format(row.value)} ({format(row.value / total * 100)}%)</text></g>)}
    </ChartSvg>;
  }
  if (diagram === "treemap") {
    const positive = data.filter((row) => row.value > 0), total = positive.reduce((sum, row) => sum + row.value, 0);
    // Alternating rectangular cuts preserve exact area proportions.
    let left = 16, top = 16, w = 688, h = 282, remaining = total;
    return <ChartSvg label="Contribution treemap">{positive.map((row, index) => {
      const vertical = w >= h, rw = vertical ? w * row.value / remaining : w, rh = vertical ? h : h * row.value / remaining;
      const rect = { left, top, w: rw, h: rh };
      if (vertical) { left += rw; w -= rw; } else { top += rh; h -= rh; }
      remaining -= row.value;
      return <g key={row.id}><rect x={rect.left} y={rect.top} width={Math.max(0, rect.w)} height={Math.max(0, rect.h)} fill={colour(row, index)} stroke="var(--background)" strokeWidth="2">{tooltip(row)}</rect>{rect.w > 80 && rect.h > 36 && <><text x={rect.left + 8} y={rect.top + 18} fontSize="10" fill="#0f172a">{compact(row.name)}</text><text x={rect.left + 8} y={rect.top + 34} fontSize="12" fontWeight="bold" fill="#0f172a">{format(row.value)}</text></>}</g>;
    })}</ChartSvg>;
  }
  if (diagram === "horizontal" || diagram === "dot") {
    const rowHeight = height / data.length;
    return <ChartSvg label={diagram === "dot" ? "Player dot plot" : "Horizontal player bars"}><PlotAxes left={180} right={620} top={y0} bottom={y1} />{data.map((row, index) => {
      const cy = y0 + (index + 0.5) * rowHeight, gap = primaryAxis.truncated ? 22 : 0, end = 180 + gap + primaryAxis.fraction(row.value) * (440 - gap);
      return <g key={row.id}><text x="166" y={cy + 4} textAnchor="end" fontSize="10" fill={row.self ? accent : "var(--text-secondary)"}>{compact(row.name)}</text>{diagram === "dot" ? <><line x1="180" x2="620" y1={cy} y2={cy} stroke="var(--text-secondary)" /><circle cx={end} cy={cy} r="5" fill={colour(row, index)}>{tooltip(row)}</circle></> : <rect x="180" y={cy - Math.min(8, rowHeight / 3)} width={Math.max(1, end - 180)} height={Math.min(16, rowHeight * 0.65)} fill={colour(row, index)}>{tooltip(row)}</rect>}<text x="635" y={cy + 4} fontSize="10" fill="var(--ink)">{format(row.value)}</text></g>;
    })}{primaryAxis.ticks.map((tick) => <text key={tick} x={180 + (primaryAxis.truncated ? 22 : 0) + primaryAxis.fraction(tick) * (440 - (primaryAxis.truncated ? 22 : 0))} y="297" textAnchor="middle" fontSize="10" fill="var(--text-secondary)">{analysisTickLabel(tick, primaryAxis.step)}</text>)}{primaryAxis.truncated && <AxisBreak x={191} y={y1 + 10} />}</ChartSvg>;
  }
  if (diagram === "box") {
    const boxAxis = analysisAxis(data.flatMap((row) => row.samples ?? []), resolveAnalysisMetric(config.y).lowerBetter);
    const gap = boxAxis.truncated ? 22 : 0;
    const sy = (value: number) => y1 - gap - boxAxis.fraction(value) * (height - gap);
    return <ChartSvg label="Match performance box plots"><PlotAxes left={x0} right={x1} top={y0} bottom={y1} />{data.map((row, index) => {
      const values = row.samples ?? [], cx = x(index), low = Math.min(...values), high = Math.max(...values);
      const q1 = analysisQuantile(values, 0.25), median = analysisQuantile(values, 0.5), q3 = analysisQuantile(values, 0.75), half = Math.min(20, width / data.length * 0.3);
      return <g key={row.id}><line x1={cx} x2={cx} y1={sy(low)} y2={sy(high)} stroke={colour(row, index)} /><line x1={cx - half / 2} x2={cx + half / 2} y1={sy(low)} y2={sy(low)} stroke={colour(row, index)} /><line x1={cx - half / 2} x2={cx + half / 2} y1={sy(high)} y2={sy(high)} stroke={colour(row, index)} /><rect x={cx - half} y={Math.min(sy(q1), sy(q3))} width={half * 2} height={Math.max(1, Math.abs(sy(q1) - sy(q3)))} fill={colour(row, index)} fillOpacity="0.25" stroke={colour(row, index)}><title>{`${row.name}: min ${format(low)}, Q1 ${format(q1)}, median ${format(median)}, Q3 ${format(q3)}, max ${format(high)} · ${values.length} performances`}</title></rect><line x1={cx - half} x2={cx + half} y1={sy(median)} y2={sy(median)} stroke={colour(row, index)} strokeWidth="2" /></g>;
    })}<line x1={x0} x2={x0} y1={y0} y2={y1} stroke="var(--text-secondary)" />{boxAxis.ticks.map((tick) => <text key={tick} x={x0 - 8} y={sy(tick) + 4} textAnchor="end" fontSize="10" fill="var(--text-secondary)">{analysisTickLabel(tick, boxAxis.step)}</text>)}{boxAxis.truncated && <AxisBreak x={x0} y={y1 - 11} vertical />}{captions}</ChartSvg>;
  }
  if (isAnalysisTrend(diagram)) {
    const coords = data.map((row, index) => `${x0 + index / Math.max(1, data.length - 1) * width},${y(row.value)}`);
    return <ChartSvg label={ANALYSIS_DIAGRAMS.find((entry) => entry.key === diagram)!.name}>{axes}
      {diagram === "area" && <polygon points={`${x0},${y1} ${coords.join(" ")} ${x1},${y1}`} fill={accent} fillOpacity="0.18" />}
      <polyline points={coords.join(" ")} fill="none" stroke={accent} strokeWidth="2.5" />
      {data.map((row, index) => <circle key={row.id} cx={x0 + index / Math.max(1, data.length - 1) * width} cy={y(row.value)} r="3" fill={accent}>{tooltip(row)}</circle>)}
      {data.map((row, index) => index % Math.max(1, Math.ceil(data.length / 8)) === 0 ? <text key={row.id} x={x0 + index / Math.max(1, data.length - 1) * width} y="296" textAnchor="middle" fontSize="9" fill="var(--text-secondary)">{compact(row.name)}</text> : null)}
    </ChartSvg>;
  }
  return <ChartSvg label={ANALYSIS_DIAGRAMS.find((entry) => entry.key === diagram)!.name}>{axes}{data.map((row, index) => {
    const slot = width / data.length, barWidth = Math.max(2, slot * 0.64), left = x(index) - barWidth / 2;
    if (diagram === "stacked" || diagram === "percent") {
      const parts = row.parts ?? [], total = parts.reduce((sum, value) => sum + value, 0);
      let running = 0;
      return <g key={row.id}>{parts.map((value, part) => {
        const amount = diagram === "percent" ? total ? value / total * 100 : 0 : value;
        running += amount;
        return <rect key={part} x={left} y={y(running)} width={barWidth} height={amount / (primaryAxis.max - primaryAxis.min) * height} fill={ANALYSIS_PART_COLOURS[part]}><title>{`${row.name} · ${["Powerplay", "Middle overs", "Death overs"][part]}: ${format(value)}${diagram === "percent" ? ` (${format(amount)}%)` : ""}`}</title></rect>;
      })}</g>;
    }
    if (diagram === "grouped") return <g key={row.id}><rect x={left} y={y(row.value)} width={barWidth / 2 - 1} height={y1 - y(row.value)} fill={accent}>{tooltip(row)}</rect><rect x={left + barWidth / 2 + 1} y={secondY(row.secondary ?? 0)} width={barWidth / 2 - 1} height={y1 - secondY(row.secondary ?? 0)} fill="#38bdf8">{tooltip(row)}</rect></g>;
    return <rect key={row.id} x={left} y={y(row.value)} width={barWidth} height={Math.max(1, y1 - y(row.value))} fill={colour(row, index)}>{tooltip(row)}</rect>;
  })}{captions}</ChartSvg>;
}

function RadarPreview({ config, props, setConfig, readOnly = false }: { config: AnalysisBuilderConfig; props: Props; setConfig: (config: AnalysisBuilderConfig) => void; readOnly?: boolean }) {
  const peers = props.players.filter((player) => analysisRoleMatches(player, config.group));
  const own = props.totals[props.player.id] ?? emptyPlayerAnalysisTotals();
  const metrics = config.radar.map((key) => resolveAnalysisMetric(key));
  const values = metrics.map((metric) => {
    const value = metric.value(own);
    const pool = peers.flatMap((player) => {
      const stats = props.totals[player.id] ?? emptyPlayerAnalysisTotals(), result = metric.value(stats);
      return metric.qualifies(stats) && result !== null ? [result] : [];
    });
    return metric.qualifies(own) && value !== null && pool.length ? analysisPercentile(pool, value, metric.lowerBetter) : null;
  });
  const centre = [360, 157], radius = 123;
  const point = (index: number, fraction: number) => [centre[0] + Math.cos(index / metrics.length * Math.PI * 2 - Math.PI / 2) * radius * fraction, centre[1] + Math.sin(index / metrics.length * Math.PI * 2 - Math.PI / 2) * radius * fraction];
  const polygon = (fraction: number) => metrics.map((_, index) => point(index, fraction).join(",")).join(" ");
  return <div className="flex min-h-0 flex-1 flex-col gap-2">
    {!readOnly && <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5">{config.radar.map((key, index) => <MetricSelector key={index} value={key} onChange={(value) => setConfig({ ...config, radar: config.radar.map((old, position) => position === index ? value : old) })} label={`Spoke ${index + 1}`} />)}</div>}
    {values.some((value) => value === null) ? <EmptyPreview /> : <ChartSvg label="Player radar chart in league percentiles">
      {[0.25, 0.5, 0.75, 1].map((fraction) => <polygon key={fraction} points={polygon(fraction)} fill="none" stroke="var(--text-secondary)" />)}
      <polygon points={polygon(0.5)} fill="#38bdf8" fillOpacity="0.08" stroke="#38bdf8" strokeDasharray="4 3" />
      {metrics.map((metric, index) => <g key={index}><line x1={centre[0]} y1={centre[1]} x2={point(index, 1)[0]} y2={point(index, 1)[1]} stroke="var(--text-secondary)" /><text x={point(index, 1.2)[0]} y={point(index, 1.2)[1]} textAnchor="middle" fontSize="10" fill="var(--text-secondary)">{index + 1}. {metric.label}</text></g>)}
      <polygon points={values.map((value, index) => point(index, value! / 100).join(",")).join(" ")} fill={accent} fillOpacity="0.25" stroke={accent} strokeWidth="2" />
    </ChartSvg>}
    <p className="text-center text-[10px] text-text-secondary">League percentiles · higher is better on every spoke · dashed outline is the league midpoint (50th percentile).</p>
  </div>;
}

export function PlayerAnalysisContent({ config, ...props }: Props & { config: AnalysisBuilderConfig }) {
  const rows = analysisData(config, props.player, props.players, props.totals, props.fixtures);
  if (config.diagram === "radar") return <RadarPreview config={config} props={props} setConfig={() => {}} readOnly />;
  if (config.diagram === "table" || config.diagram === "ranking") {
    const ranked = [...rows].sort((a, b) => resolveAnalysisMetric(config.y).lowerBetter ? a.value - b.value : b.value - a.value);
    if (config.diagram === "ranking" && props.compact) {
      const index = ranked.findIndex((row) => row.self);
      const first = Math.max(0, Math.min(index - 1, ranked.length - 3));
      return <div className="flex min-h-0 flex-1 flex-col gap-0.5 font-space-mono text-[9px] leading-tight">{ranked.slice(first, first + 3).map((row, offset) => <div key={row.id} className={`grid min-h-0 flex-1 grid-cols-[30px_minmax(0,1fr)_44px] items-center gap-1 rounded px-1 py-0.5 ${row.self ? "bg-accent/15 font-bold text-accent" : "text-text-secondary"}`}><span className={row.self ? "font-anton text-[11px]" : ""}>#{first + offset + 1}</span><span className="truncate" title={row.name}>{row.name}</span><strong className="text-right">{format(row.value)}</strong></div>)}{!rows.length && <EmptyPreview />}</div>;
    }
    return <div className="min-h-0 flex-1 overflow-auto"><table className="w-full text-left font-space-mono text-[10px]"><thead className="sticky top-0 bg-bg text-text-secondary"><tr><th className="p-1">Rank</th><th className="p-1">Player</th>{config.diagram === "table" && <th className="p-1">{resolveAnalysisMetric(config.x).label}</th>}<th className="p-1">{resolveAnalysisMetric(config.y).label}</th></tr></thead><tbody>{ranked.map((row, index) => <tr key={row.id} className={row.self ? "bg-accent/15 text-accent" : "text-text-secondary"}><td className="p-1">#{index + 1}</td><td className="p-1">{row.name}</td>{config.diagram === "table" && <td className="p-1">{format(row.secondary ?? 0)}</td>}<td className="p-1">{format(row.value)}</td></tr>)}</tbody></table>{!rows.length && <EmptyPreview />}</div>;
  }
  return <div className="flex min-h-0 flex-1 items-center overflow-hidden"><GraphPreview config={config} rows={rows} players={props.players} teams={props.teams} selectedId={props.player.id} /></div>;
}

export default function PlayerAnalysisBuilder(props: Props) {
  const [config, setConfig] = useState<AnalysisBuilderConfig>(() => props.initialConfig ?? defaultAnalysisConfig(props.player));
  const panel = useRef<HTMLElement>(null);
  const active = ANALYSIS_DIAGRAMS.find((diagram) => diagram.key === config.diagram)!;
  const categories = ["Comparisons", "Rankings", "Breakdowns", "Trends", "Distributions"] as const;
  const diagrams = ANALYSIS_DIAGRAMS.filter((diagram) => diagram.category === active.category);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);
  const rows = useMemo(() => analysisData(config, props.player, props.players, props.totals, props.fixtures), [config, props.player, props.players, props.totals, props.fixtures]);
  const table = config.diagram === "table" || config.diagram === "ranking";
  const countsOnly = isAnalysisBreakdown(config.diagram) || config.diagram === "cumulative" || ["phases", "positions"].includes(config.grouping);
  const twoMetrics = ["scatter", "bubble", "grouped", "table"].includes(config.diagram);
  const groupingAllowed = ["bars", "horizontal", "pie", "doughnut", "treemap"].includes(config.diagram);
  const ranked = [...rows].sort((a, b) => resolveAnalysisMetric(config.y).lowerBetter ? a.value - b.value : b.value - a.value);
  const updateGrouping = (grouping: AnalysisGrouping) => setConfig({ ...config, grouping,
    y: ["phases", "positions"].includes(grouping) && !ANALYSIS_COUNTS.includes(config.y) ? "runs" : grouping === "positions" && config.y === "wickets" ? "runs" : config.y });
  const pickDiagram = (diagram: AnalysisDiagram) => {
    setConfig(changeAnalysisDiagram(config, diagram, props.player));
  };
  return <section ref={panel} tabIndex={-1} aria-label="Player data analysis builder" className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-lg border border-border bg-surface p-3 outline-none sm:p-4" onKeyDown={(event) => {
    if (event.key === "Escape") props.onClose();
    if (event.key === "Tab" && !document.querySelector('[data-analysis-options="true"]')) {
      const controls = Array.from(panel.current!.querySelectorAll<HTMLElement>('button:not([tabindex="-1"]), input, select, [tabindex="0"]'));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
      <div><h2 className="font-anton text-lg uppercase">{active.name}</h2><p className="text-[10px] text-text-secondary">{props.player.name} · {props.season} season · live analysis</p></div>
      <div className="flex items-center gap-2">
        {props.onSave && <button type="button" onClick={() => props.onSave?.({ ...config, radar: [...config.radar] })} disabled={config.diagram !== "radar" && rows.length === 0} className="rounded bg-[var(--ink)] px-3 py-2 text-[11px] font-bold text-bg disabled:opacity-40">{props.saveLabel ?? "Add to Player Analysis"}</button>}
        {(config.grouping === "players" || config.diagram === "radar") && <label className="flex items-center gap-2 text-[10px] text-text-secondary">Compare with<select value={config.group} onChange={(event) => setConfig({ ...config, group: event.target.value as AnalysisPlayerGroup })} className={control} aria-label="Compare with"><option value="all">All players</option><option value="batters">Batters and keepers</option><option value="all-rounders">All-rounders</option><option value="pacers">Pace bowlers</option><option value="spinners">Spin bowlers</option></select></label>}
        <button type="button" onClick={props.onClose} aria-label="Close analysis builder" title="Close analysis builder" className="rounded border border-border p-1.5 hover:text-accent"><X size={16} /></button>
      </div>
    </div>
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-bg p-3" aria-label={`${active.name} live preview`}>
      {config.diagram === "radar" ? <RadarPreview config={config} props={props} setConfig={setConfig} /> : table ? <div className="max-h-[430px] min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-[11px]"><thead className="sticky top-0 z-10 bg-bg"><tr><th className="p-2 text-text-secondary">Rank</th><th className="p-2 text-text-secondary">Player</th>{twoMetrics && <th className="min-w-[260px] p-2"><MetricSelector value={config.x} onChange={(x) => setConfig({ ...config, x })} label="First statistic" /></th>}<th className="min-w-[260px] p-2"><MetricSelector value={config.y} onChange={(y) => setConfig({ ...config, y })} label={twoMetrics ? "Second statistic" : "Statistic"} /></th></tr></thead><tbody>{ranked.map((row, index) => <tr key={row.id} className={`border-t border-border ${row.self ? "bg-accent/10 font-bold text-accent" : ""}`}><td className="p-2">#{index + 1}</td><td className="p-2">{row.name}</td>{twoMetrics && <td className="p-2">{format(row.secondary ?? 0)}{resolveAnalysisMetric(config.x).unit}</td>}<td className="p-2">{format(row.value)}{resolveAnalysisMetric(config.y).unit}</td></tr>)}</tbody></table>
        {!rows.length && <EmptyPreview />}
      </div> : <>
        <div className="grid shrink-0 gap-2 sm:grid-cols-2">
          {["histogram", "horizontal", "dot"].includes(config.diagram) ? <p className="self-end pb-1 text-[10px] text-text-secondary">{config.diagram === "histogram" ? "Number of performances" : "Qualifying players"}</p> : <MetricSelector value={config.y} onChange={(y) => setConfig({ ...config, y })} label={config.diagram === "pie" || config.diagram === "doughnut" || config.diagram === "treemap" ? "Contribution statistic" : "Vertical statistic"} countsOnly={countsOnly} allowWickets={config.grouping !== "positions"} />}
          {config.diagram === "bubble" ? <MetricSelector value={config.size} onChange={(size) => setConfig({ ...config, size })} label="Bubble size" /> : config.diagram === "grouped" ? <MetricSelector value={config.x} onChange={(x) => setConfig({ ...config, x })} label="Comparison statistic" /> : ["stacked", "percent"].includes(config.diagram) ? <div className="flex flex-wrap items-end gap-3 pb-1 text-[10px] text-text-secondary">{["Powerplay", "Middle overs", "Death overs"].map((label, index) => <span key={label} className="flex items-center gap-1"><span className="size-2 rounded-sm" style={{ background: ANALYSIS_PART_COLOURS[index] }} />{label}</span>)}</div> : null}
        </div>
        <div className="flex min-h-[230px] min-w-0 flex-1 items-center"><GraphPreview config={config} rows={rows} players={props.players} teams={props.teams} selectedId={props.player.id} /></div>
        <div className="shrink-0">
          {["histogram", "horizontal", "dot"].includes(config.diagram) && <div className="mx-auto mb-2 max-w-lg"><MetricSelector value={config.y} onChange={(y) => setConfig({ ...config, y })} label="Horizontal statistic" countsOnly={countsOnly} allowWickets={config.grouping !== "positions"} /></div>}
          {["scatter", "bubble"].includes(config.diagram) ? <div className="mx-auto max-w-lg"><MetricSelector value={config.x} onChange={(x) => setConfig({ ...config, x })} label="Horizontal statistic" /></div> : groupingAllowed ? <label className="flex items-center justify-center gap-2 text-[10px] text-text-secondary">Group by<select value={config.grouping} onChange={(event) => updateGrouping(event.target.value as AnalysisGrouping)} className={control} aria-label="Group by"><option value="players">Players</option><option value="matches">Matches</option><option value="phases">Phases</option>{config.y !== "wickets" && <option value="positions">Batting positions</option>}</select></label> : <p className="text-center text-[10px] text-text-secondary">{isAnalysisTrend(config.diagram) || config.diagram === "histogram" ? "Matches in date order" : "Qualifying players"}</p>}
        </div>
      </>}
      <p className="shrink-0 text-[9px] text-text-secondary">{config.diagram === "radar" ? "Each spoke uses its own qualification rule." : config.grouping === "players" ? `${rows.length} qualifying players · ${resolveAnalysisMetric(config.y).minimum}${twoMetrics ? ` · ${resolveAnalysisMetric(config.x).minimum}` : ""}${!table && !["scatter", "bubble"].includes(config.diagram) && rows.length > 12 ? " · chart shows the leading 12, including the selected player when qualified" : ""}${config.diagram === "box" ? " · minimum four performances · box = middle 50%; whiskers = min/max" : ""}` : config.diagram === "rolling" ? "Average of the latest three recorded performances, including the current match." : config.diagram === "cumulative" ? "Running total across the season." : config.grouping === "phases" || config.grouping === "positions" ? "Breakdowns use archived delivery / scorecard data. Zero contributions remain zero." : "Individual recorded performances; season qualification thresholds do not apply to each match."}</p>
    </div>
    <div className="flex shrink-0 flex-col gap-1 border-t border-border pt-2">
      <div role="tablist" aria-label="Diagram categories" className="flex gap-1 overflow-x-auto [scrollbar-width:thin]">{categories.map((category) => <button key={category} type="button" role="tab" aria-selected={active.category === category} onClick={() => pickDiagram(ANALYSIS_DIAGRAMS.find((diagram) => diagram.category === category)!.key)} className={`shrink-0 rounded px-3 py-1 text-[10px] font-semibold ${active.category === category ? "bg-accent/15 text-accent" : "text-text-secondary hover:text-accent"}`}>{category}</button>)}</div>
      <div role="tablist" aria-label={`${active.category} diagram types`} className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:thin]">
        {diagrams.map((diagram, index) => <button key={diagram.key} data-diagram={diagram.key} type="button" role="tab" aria-selected={diagram.key === config.diagram} tabIndex={diagram.key === config.diagram ? 0 : -1} onClick={() => pickDiagram(diagram.key)} onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? diagrams.length - 1 : Math.max(0, Math.min(diagrams.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
          pickDiagram(diagrams[next].key);
          panel.current?.querySelector<HTMLButtonElement>(`[data-diagram="${diagrams[next].key}"]`)?.focus({ preventScroll: true });
        }} className={`flex h-10 shrink-0 items-center gap-1 rounded border px-2 text-center transition-colors ${diagram.key === config.diagram ? "border-accent bg-accent/10 text-accent" : "border-border bg-bg text-text-secondary hover:border-accent hover:text-accent"}`}>
          <DiagramThumbnail diagram={diagram.key} /><span className="text-[10px] font-semibold">{diagram.name}</span>
        </button>)}
      </div>
    </div>
  </section>;
}
