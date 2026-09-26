"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Player, Team } from "@/lib/types";
import type { MetricDefinition } from "@/lib/logic/playerAnalysisMetrics";
import { analysisAxis, analysisTickLabel } from "@/lib/logic/playerAnalysisBuilder";
import { chartLabels, chartLowerEndRoleMatches } from "@/lib/logic/playerAnalysisChart";

export type PlayerScatterPoint = { player: Player; x: number; y: number; qualified?: boolean; size?: number };
const nameClass = "whitespace-nowrap rounded border px-1 py-0.5 font-space-mono text-[8px] leading-none shadow-sm";

export default function PlayerScatterPlot({ points, selectedId, teams = {}, xMetric, yMetric, bubble = false, sizeLowerBetter = false, sizeMetric }: {
  points: PlayerScatterPoint[]; selectedId: string; teams?: Record<string, Team>;
  xMetric: MetricDefinition; yMetric: MetricDefinition; bubble?: boolean; sizeLowerBetter?: boolean;
  sizeMetric?: MetricDefinition;
}) {
  const plot = useRef<HTMLDivElement>(null), measurement = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 420, height: 220 });
  const [nameWidths, setNameWidths] = useState<Record<string, number>>({});
  const namesKey = JSON.stringify(points.map((point) => [point.player.id, point.player.name, point.player.id === selectedId]));
  useEffect(() => {
    const node = plot.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setDimensions((old) => old.width === entry.contentRect.width && old.height === entry.contentRect.height ? old : { width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const node = measurement.current;
    if (!node) return;
    const measure = () => {
      const widths: Record<string, number> = {};
      node.querySelectorAll<HTMLElement>("[data-scatter-name]").forEach((label) => { widths[label.dataset.scatterName!] = label.getBoundingClientRect().width; });
      setNameWidths(widths);
    };
    measure();
    const observer = new ResizeObserver(measure);
    node.querySelectorAll<HTMLElement>("[data-scatter-name]").forEach((label) => observer.observe(label));
    return () => observer.disconnect();
  }, [namesKey]);
  const xAxis = analysisAxis(points.map((point) => point.x), xMetric.lowerBetter);
  const yAxis = analysisAxis(points.map((point) => point.y), yMetric.lowerBetter);
  const xPercent = (value: number) => 8 + xAxis.fraction(value) * 84;
  const yPercent = (value: number) => 92 - yAxis.fraction(value) * 84;
  const projected = points.map((point) => ({ id: point.player.id, name: point.player.name,
    x: xPercent(point.x) / 100 * dimensions.width, y: yPercent(point.y) / 100 * dimensions.height,
    lowerEndEligible: point.qualified !== false && chartLowerEndRoleMatches(point.player.role, [xMetric.group, yMetric.group]) }));
  const labels = chartLabels(projected, selectedId, dimensions.width, dimensions.height, 5, nameWidths);
  const qualified = points.filter((point) => point.qualified !== false);
  const average = (axis: "x" | "y") => qualified.length ? qualified.reduce((sum, point) => sum + point[axis], 0) / qualified.length : null;
  const avgX = average("x"), avgY = average("y");
  const sizeAxis = analysisAxis(points.map((point) => point.size ?? 0), sizeLowerBetter);
  const maxSize = Math.max(1, ...points.map((point) => point.size ?? 0));
  const shown = (value: number, metric: MetricDefinition) => `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${metric.unit}`;
  return <div className="relative flex h-full min-h-0 w-full flex-1 flex-col" data-player-scatter="true">
    <div ref={measurement} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 h-0 overflow-hidden" style={{ width: "max-content" }}>{points.map((point) => <span key={point.player.id} data-scatter-name={point.player.id} className={`block ${nameClass} ${point.player.id === selectedId ? "font-bold" : ""}`} style={{ width: "max-content", height: 17 }}>{point.player.name}</span>)}</div>
    <div className="grid min-h-0 flex-1 grid-cols-[36px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_16px_16px] gap-x-1 font-space-mono text-[8px] text-text-secondary">
      <div className="relative"><span className="absolute inset-y-0 left-0 flex items-center justify-center font-bold uppercase [writing-mode:vertical-rl] rotate-180" title={yMetric.label}>{yMetric.label}</span>{yAxis.ticks.map((tick) => <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${yPercent(tick)}%` }}>{analysisTickLabel(tick, yAxis.step)}</span>)}</div>
      <div ref={plot} role="img" aria-label={`${bubble ? "Bubble" : "Scatter"} comparison of ${xMetric.label} and ${yMetric.label}`} className="relative min-h-0 overflow-hidden border border-border bg-surface/5">
        {xAxis.ticks.map((tick) => <span key={tick} className="absolute inset-y-0 border-l border-dashed border-border/50" style={{ left: `${xPercent(tick)}%` }} />)}
        {yAxis.ticks.map((tick) => <span key={tick} className="absolute inset-x-0 border-t border-dashed border-border/50" style={{ top: `${yPercent(tick)}%` }} />)}
        {avgX !== null && <span className="absolute inset-y-0 border-l border-dashed border-accent/60" style={{ left: `${xPercent(avgX)}%` }} />}
        {avgY !== null && <span className="absolute inset-x-0 border-t border-dashed border-accent/60" style={{ top: `${yPercent(avgY)}%` }} />}
        {[...points].sort((a, b) => Number(a.player.id === selectedId) - Number(b.player.id === selectedId)).map((point) => {
          const selected = point.player.id === selectedId;
          const radius = bubble ? 4 + Math.sqrt(sizeLowerBetter ? Math.max(0, sizeAxis.fraction(point.size ?? 0)) : (point.size ?? 0) / maxSize) * 15 : selected ? 6 : 4;
          return <span key={point.player.id} data-scatter-point={point.player.id} title={`${point.player.name}: ${shown(point.x, xMetric)} / ${shown(point.y, yMetric)}${bubble && sizeMetric ? ` · ${sizeMetric.label}: ${shown(point.size ?? 0, sizeMetric)}` : ""}`} className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-bg ${selected ? "z-10 border-2 ring-2 ring-accent" : "border"}`} style={{ left: `${xPercent(point.x)}%`, top: `${yPercent(point.y)}%`, width: radius * 2, height: radius * 2, backgroundColor: selected ? "var(--accent)" : teams[point.player.currentTeamId ?? ""]?.primaryColor ?? "#888", opacity: bubble && !selected ? 0.65 : 1 }} />;
        })}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} preserveAspectRatio="none" aria-hidden="true">{labels.map((label) => <line key={label.id} data-scatter-connector={label.id} x1={label.anchorX} y1={label.anchorY} x2={label.connectorX} y2={label.connectorY} stroke={label.id === selectedId ? "var(--accent)" : "var(--text-secondary)"} strokeWidth="1" />)}</svg>
        {labels.map((label) => <span key={label.id} data-scatter-label={label.id} className={`pointer-events-none absolute z-20 ${nameClass} ${label.id === selectedId ? "border-accent font-bold text-accent" : "border-border text-text-primary"}`} style={{ left: label.left, top: label.top, width: "max-content", height: 17, backgroundColor: "var(--background)" }}>{label.name}</span>)}
        {xAxis.truncated && <span aria-label="Horizontal axis starts above zero" className="absolute bottom-0 left-1 text-[11px]">∕∕</span>}
        {yAxis.truncated && <span aria-label="Vertical axis starts above zero" className="absolute bottom-2 left-0 rotate-90 text-[11px]">∕∕</span>}
        {!points.length && <span className="absolute inset-0 grid place-items-center text-[10px]">No recorded comparison yet</span>}
      </div>
      <span />
      <div className="relative">{xAxis.ticks.map((tick) => <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${xPercent(tick)}%` }}>{analysisTickLabel(tick, xAxis.step)}</span>)}</div>
      <span /><div className="truncate text-center font-bold uppercase" title={xMetric.label}>{xMetric.label} →</div>
    </div>
  </div>;
}
