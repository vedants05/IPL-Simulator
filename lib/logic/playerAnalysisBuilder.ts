import type { Player } from "../types";
import { buildPlayerAnalysisTotals, emptyPlayerAnalysisTotals, metricByKey, PLAYER_METRICS, type MetricDefinition, type PlayerAnalysisFixture, type PlayerAnalysisTotals } from "./playerAnalysisMetrics";

export const MAX_CUSTOM_ANALYSES = 3;
export type TemporaryAnalysisLayout = { hidden: string[]; custom: { id: string; config: AnalysisBuilderConfig }[] };
export function saveTemporaryAnalysis(layout: TemporaryAnalysisLayout, id: string, config: AnalysisBuilderConfig, editing = false): TemporaryAnalysisLayout {
  if (editing) return { ...layout, custom: layout.custom.map((tile) => tile.id === id ? { ...tile, config } : tile) };
  if (layout.custom.length >= MAX_CUSTOM_ANALYSES) return layout;
  return { ...layout, custom: [...layout.custom, { id, config }] };
}

export function analysisMetricTemplate(key: string): string {
  return key.replace(/^over:\d+:/, "over:1:").replace(/^overs:\d+-\d+:/, "overs:1-6:")
    .replace(/^position:[^:]+:overs:\d+-\d+:/, "position:1-2:overs:1-6:").replace(/^position:[^:]+:(?!overs:)/, "position:1:");
}

export const ANALYSIS_METRIC_CHOICES = PLAYER_METRICS.filter((metric) => analysisMetricTemplate(metric.key) === metric.key);

export function analysisMetricChoiceLabel(key: string): string {
  const metric = metricByKey[analysisMetricTemplate(key)];
  const suffix = key.split(":").at(-1)!;
  const names: Record<string, string> = { runs: "Runs", balls: "Balls faced", sr: "Strike rate", fours: "Fours", sixes: "Sixes", boundary: "Boundary ball %", wickets: "Wickets", conceded: "Runs conceded", bowlBalls: "Balls bowled", economy: "Economy", dotRate: "Dot ball %" };
  if (key.startsWith("position:") && key.includes(":overs:")) return `${names[suffix]} by batting position and over range`;
  if (key.startsWith("position:")) return `${names[suffix]} by batting position`;
  if (key.startsWith("over:")) return `${names[suffix]} in an over`;
  if (key.startsWith("overs:")) return `${names[suffix]} over a range`;
  return metric.label;
}

export function resolveAnalysisMetric(key: string): MetricDefinition {
  const range = key.match(/^(position:([^:]+):)?overs:(\d+)-(\d+):([^:]+)$/);
  if (!range) {
    if (metricByKey[key]) return metricByKey[key];
    throw new Error(`Unknown analysis statistic: ${key}`);
  }
  const position = range[1] ?? "", start = Number(range[3]), end = Number(range[4]), suffix = range[5];
  if (start < 1 || end > 20 || start > end) throw new Error("Analysis over ranges must be between 1 and 20.");
  const templateKey = position ? `position:1-2:overs:1-6:${suffix}` : `overs:1-6:${suffix}`;
  const template = metricByKey[templateKey];
  if (!template) throw new Error(`Unsupported analysis measure: ${suffix}`);
  const sourceKey = templateKey.slice(0, templateKey.lastIndexOf(":"));
  const source = (stats: PlayerAnalysisTotals) => {
    const aggregate: PlayerAnalysisTotals["segments"][string] = { innings: 0, runs: 0, balls: 0, dismissals: 0, fours: 0, sixes: 0, wickets: 0, bowlBalls: 0, conceded: 0, dots: 0 };
    for (let over = start; over <= end; over++) {
      const segment = stats.segments[`${position}over:${over}`];
      if (segment) for (const field of Object.keys(aggregate) as Array<keyof typeof aggregate>) aggregate[field] += segment[field];
    }
    const hasOverRecords = Object.keys(stats.segments).some((segment) => segment.startsWith(`${position}over:`));
    const requestedKey = key.slice(0, key.lastIndexOf(":"));
    return { ...stats, segments: { ...stats.segments, [sourceKey]: hasOverRecords ? aggregate : stats.segments[requestedKey] ?? aggregate } };
  };
  const positionLabel = range[2] === "6plus" ? "Batting at No. 6 or lower" : range[2]?.includes("-") ? `Batting at Nos. ${range[2].replace("-", "–")}` : `Batting at No. ${range[2]}`;
  const label = template.label.replace(/Batting at Nos\. 1[–-]2/i, positionLabel).replace(/overs 1[–-]6/i, `overs ${start}–${end}`);
  return { ...template, key, label, minimum: template.minimum.replace(/overs 1[–-]6/i, `overs ${start}–${end}`),
    value: (stats) => template.value(source(stats)), qualifies: (stats) => template.qualifies(source(stats)) };
}

export function analysisAxis(values: readonly number[], lowerBetter = false, forceZero = false) {
  const finite = values.filter(Number.isFinite);
  const low = finite.length ? Math.min(...finite) : 0, high = finite.length ? Math.max(...finite) : 1;
  const span = Math.max(forceZero ? high : high - low, Math.abs(high) * 0.08, 1);
  const rough = span / 6, power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= rough) ?? power * 10;
  const min = forceZero ? 0 : Math.max(0, Math.floor(low / step) * step);
  const max = Math.max(min + step, Math.ceil(high / step) * step);
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => Number((min + index * step).toFixed(8)));
  return { min, max, ticks, step, lowerBetter, truncated: min > 0,
    fraction: (value: number) => lowerBetter ? (max - value) / (max - min) : (value - min) / (max - min) };
}

export function analysisTickLabel(value: number, step: number): string {
  let decimals = 0;
  while (decimals < 6 && Math.abs(step * 10 ** decimals - Math.round(step * 10 ** decimals)) > 1e-8) decimals++;
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export const ANALYSIS_DIAGRAMS = [
  { key: "scatter", name: "Scatter graph", category: "Comparisons" },
  { key: "bubble", name: "Bubble chart", category: "Comparisons" },
  { key: "grouped", name: "Grouped bars", category: "Comparisons" },
  { key: "radar", name: "Radar chart", category: "Comparisons" },
  { key: "bars", name: "Vertical bars", category: "Rankings" },
  { key: "horizontal", name: "Horizontal bars", category: "Rankings" },
  { key: "ranking", name: "Ranking table", category: "Rankings" },
  { key: "table", name: "Two-factor table", category: "Rankings" },
  { key: "pie", name: "Pie chart", category: "Breakdowns" },
  { key: "doughnut", name: "Doughnut chart", category: "Breakdowns" },
  { key: "stacked", name: "Stacked bars", category: "Breakdowns" },
  { key: "percent", name: "100% stacked bars", category: "Breakdowns" },
  { key: "treemap", name: "Treemap", category: "Breakdowns" },
  { key: "line", name: "Line chart", category: "Trends" },
  { key: "area", name: "Area chart", category: "Trends" },
  { key: "cumulative", name: "Cumulative line", category: "Trends" },
  { key: "rolling", name: "Rolling average", category: "Trends" },
  { key: "histogram", name: "Histogram", category: "Distributions" },
  { key: "box", name: "Box plot", category: "Distributions" },
  { key: "dot", name: "Dot plot", category: "Distributions" },
] as const;
export type AnalysisDiagram = typeof ANALYSIS_DIAGRAMS[number]["key"];
export type AnalysisGrouping = "players" | "matches" | "phases" | "positions";
export type AnalysisPlayerGroup = "all" | "batters" | "all-rounders" | "pacers" | "spinners";
export type AnalysisBuilderConfig = {
  diagram: AnalysisDiagram; x: string; y: string; size: string;
  grouping: AnalysisGrouping; group: AnalysisPlayerGroup; radar: string[];
};
export type AnalysisDatum = {
  id: string; name: string; value: number; secondary?: number; size?: number;
  self?: boolean; parts?: number[]; samples?: number[];
};
export const ANALYSIS_PART_COLOURS = ["#38bdf8", "#a78bfa", "#f97316", "#34d399", "#f472b6", "#facc15"];
export const ANALYSIS_COUNTS = ["runs", "wickets", "fours", "sixes"];
export const isAnalysisTrend = (diagram: AnalysisDiagram) => ["line", "area", "cumulative", "rolling"].includes(diagram);
export const isAnalysisBreakdown = (diagram: AnalysisDiagram) => ["pie", "doughnut", "treemap", "stacked", "percent"].includes(diagram);

export function defaultAnalysisConfig(player: Player): AnalysisBuilderConfig {
  const bowling = player.role === "Pace Bowler" || player.role === "Spin Bowler";
  return { diagram: "scatter", x: bowling ? "wickets" : "runs", y: bowling ? "economy" : "strikeRate", size: "matches", grouping: "players", group: "all",
    radar: bowling ? ["wickets", "economy", "bowlAverage", "dotRate", "wicketsPerMatch"] : ["runs", "strikeRate", "batAverage", "boundaryRate", "sixes"] };
}

export function changeAnalysisDiagram(config: AnalysisBuilderConfig, diagram: AnalysisDiagram, player: Player): AnalysisBuilderConfig {
  const next = { ...config, diagram };
  const bowling = player.role === "Pace Bowler" || player.role === "Spin Bowler";
  if ((isAnalysisBreakdown(diagram) || diagram === "cumulative") && !ANALYSIS_COUNTS.includes(next.y)) next.y = bowling ? "wickets" : "runs";
  if (["pie", "doughnut", "treemap"].includes(diagram)) next.grouping = "phases";
  else if (isAnalysisTrend(diagram) || diagram === "histogram") next.grouping = "matches";
  else if (["scatter", "bubble", "radar", "table", "ranking", "stacked", "percent", "box", "dot", "grouped"].includes(diagram)) next.grouping = "players";
  if (["grouped", "table"].includes(diagram) && next.x === next.y) next.x = bowling ? "economy" : "strikeRate";
  return next;
}

export function analysisRoleMatches(player: Player, group: AnalysisPlayerGroup): boolean {
  return group === "all" || (group === "batters" && ["Batsman", "WK-Batsman"].includes(player.role))
    || (group === "all-rounders" && player.role === "All-Rounder")
    || (group === "pacers" && player.role === "Pace Bowler") || (group === "spinners" && player.role === "Spin Bowler");
}

function phaseParts(stats: PlayerAnalysisTotals, metric: string): number[] {
  return [[1, 6], [7, 16], [17, 20]].map(([start, end]) => {
    if (metric === "runs" || metric === "wickets") return stats.phase[start === 1 ? "powerplay" : start === 7 ? "middle" : "death"][metric];
    let value = 0;
    for (let over = start; over <= end; over++) value += resolveAnalysisMetric(`over:${over}:${metric}`)?.value(stats) ?? 0;
    return value;
  });
}

export function analysisData(config: AnalysisBuilderConfig, selected: Player, players: Player[], totals: Record<string, PlayerAnalysisTotals>, fixtures: readonly PlayerAnalysisFixture[]): AnalysisDatum[] {
  const metric = resolveAnalysisMetric(config.y);
  const own = totals[selected.id] ?? emptyPlayerAnalysisTotals();
  if (config.grouping === "phases") return phaseParts(own, config.y).map((value, index) => ({ id: String(index), name: ["Powerplay", "Middle overs", "Death overs"][index], value }));
  if (config.grouping === "positions") return Array.from({ length: 11 }, (_, index) => ({ id: String(index), name: `No. ${index + 1}`, value: resolveAnalysisMetric(`position:${index + 1}:${config.y}`)?.value(own) ?? 0 }));
  if (config.grouping === "matches") {
    const entries = fixtures.filter((fixture) => fixture.played).slice().sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).flatMap((fixture) => {
      const stats = buildPlayerAnalysisTotals([fixture])[selected.id];
      if (!stats) return [];
      if (metric.group.toLowerCase().includes("bowling") ? stats.bowlBalls === 0 : config.y !== "matches" && stats.innings === 0) return [];
      const value = metric.value(stats);
      if (value === null) return [];
      return [{ id: fixture.id, name: fixture.date ?? "", value, secondary: resolveAnalysisMetric(config.x).value(stats) ?? undefined, self: true }];
    });
    let cumulative = 0;
    return entries.map((entry, index) => {
      cumulative += entry.value;
      return { ...entry, name: entry.name || `Match ${index + 1}`, value: config.diagram === "cumulative" ? cumulative : config.diagram === "rolling" ? entries.slice(Math.max(0, index - 2), index + 1).reduce((sum, row) => sum + row.value, 0) / Math.min(3, index + 1) : entry.value };
    });
  }
  const needsSecond = ["scatter", "bubble", "table", "grouped"].includes(config.diagram);
  const matchTotals = config.diagram === "box" ? fixtures.filter((fixture) => fixture.played).map((fixture) => buildPlayerAnalysisTotals([fixture])) : [];
  return players.filter((player) => analysisRoleMatches(player, config.group)).flatMap((player): AnalysisDatum[] => {
    const stats = totals[player.id] ?? emptyPlayerAnalysisTotals();
    const value = metric.value(stats), secondary = resolveAnalysisMetric(config.x).value(stats);
    if (value === null || !metric.qualifies(stats) || (needsSecond && (secondary === null || !resolveAnalysisMetric(config.x).qualifies(stats)))) return [];
    const sizeMetric = resolveAnalysisMetric(config.size);
    if (config.diagram === "bubble" && (sizeMetric.value(stats) === null || !sizeMetric.qualifies(stats))) return [];
    const samples = config.diagram === "box" ? matchTotals.flatMap((match) => {
      const matchStats = match[player.id];
      const participated = matchStats && (metric.group.toLowerCase().includes("bowling") ? matchStats.bowlBalls > 0 : config.y === "matches" || matchStats.innings > 0);
      const sample = participated ? metric.value(matchStats) : null;
      return sample === null ? [] : [sample];
    }) : undefined;
    if (samples && samples.length < 4) return [];
    return [{ id: player.id, name: player.name, value, secondary: secondary ?? undefined, self: player.id === selected.id,
      size: sizeMetric.value(stats) ?? undefined, parts: ["stacked", "percent"].includes(config.diagram) ? phaseParts(stats, config.y) : undefined, samples }];
  });
}

export function analysisQuantile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * fraction, lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
}

export function analysisHistogram(values: readonly number[]): AnalysisDatum[] {
  if (!values.length) return [];
  const low = Math.min(...values), high = Math.max(...values);
  if (low === high) return [{ id: "0", name: String(low), value: values.length }];
  const count = Math.min(8, Math.max(2, Math.ceil(Math.sqrt(values.length))));
  const step = (high - low) / count;
  const bins = Array.from({ length: count }, (_, index) => ({ id: String(index), name: `${(low + index * step).toFixed(1)}–${(low + (index + 1) * step).toFixed(1)}`, value: 0 }));
  values.forEach((value) => { bins[Math.min(count - 1, Math.floor((value - low) / step))].value++; });
  return bins;
}

export function analysisPercentile(values: readonly number[], value: number, lowerBetter = false): number {
  if (!values.length) return 0;
  const less = values.filter((entry) => lowerBetter ? entry > value : entry < value).length;
  const ties = values.filter((entry) => entry === value).length;
  return (less + ties / 2) / values.length * 100;
}
