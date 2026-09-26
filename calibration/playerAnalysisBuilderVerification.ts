import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Player } from "../lib/types";
import { buildPlayerAnalysisTotals, emptyPlayerAnalysisTotals } from "../lib/logic/playerAnalysisMetrics";
import {
  ANALYSIS_DIAGRAMS, ANALYSIS_METRIC_CHOICES, analysisAxis, analysisTickLabel, analysisMetricTemplate,
  analysisMetricChoiceLabel, resolveAnalysisMetric, analysisData, analysisHistogram, analysisPercentile,
  analysisQuantile, changeAnalysisDiagram, defaultAnalysisConfig,
  saveTemporaryAnalysis, type TemporaryAnalysisLayout,
} from "../lib/logic/playerAnalysisBuilder";
import PlayerAnalysisBuilder, { MetricSelector } from "../components/scouting/PlayerAnalysisBuilder";
import PlayerAnalysisDashboard from "../components/scouting/PlayerAnalysisDashboard";

const axis = analysisAxis([22, 48]);
assert.deepEqual(axis.ticks, [20, 25, 30, 35, 40, 45, 50]);
assert.equal(axis.truncated, true);
assert.ok(axis.fraction(22) >= 0 && axis.fraction(48) <= 1);
const economy = analysisAxis([6.2, 8.9, 11.4], true);
assert.ok(economy.fraction(6.2) > economy.fraction(11.4), "lower economy must be further from the origin");
assert.ok(economy.min <= 6.2 && economy.max >= 11.4, "both the best and worst players must fit");
assert.equal(analysisAxis([0, 22]).fraction(0), 0, "zero must be at the start when there is no truncation");
assert.equal(analysisAxis([22, 48], false, true).min, 0, "additive stacked charts need a true zero baseline");
const narrow = analysisAxis([6.22, 6.48]);
assert.equal(new Set(narrow.ticks.map((tick) => analysisTickLabel(tick, narrow.step))).size, narrow.ticks.length, "fractional tick labels must not round into duplicates");
assert.ok(ANALYSIS_METRIC_CHOICES.length < 130, "parameterised choices should replace hundreds of repeated over entries");
assert.equal(ANALYSIS_METRIC_CHOICES.filter((metric) => /^over:\d+:economy$/.test(metric.key)).length, 1);
assert.equal(ANALYSIS_METRIC_CHOICES.filter((metric) => /^overs:\d+-\d+:economy$/.test(metric.key)).length, 1);
assert.equal(analysisMetricTemplate("overs:8-15:economy"), "overs:1-6:economy");
assert.equal(analysisMetricTemplate("position:5:overs:8-15:sr"), "position:1-2:overs:1-6:sr");
assert.equal(analysisMetricChoiceLabel("over:15:economy"), "Economy in an over");

const rangeStats = emptyPlayerAnalysisTotals();
const segment = (conceded: number, wickets: number, runs: number) => ({ innings: 0, runs, balls: 6, dismissals: 0, fours: 0, sixes: 0, wickets, bowlBalls: 6, conceded, dots: 2 });
rangeStats.segments["over:7"] = segment(6, 1, 8);
rangeStats.segments["over:8"] = segment(3, 2, 10);
rangeStats.segments["over:9"] = segment(9, 1, 12);
rangeStats.segments["over:10"] = segment(6, 1, 6);
rangeStats.segments["over:11"] = segment(100, 10, 100);
rangeStats.segments["position:5:over:7"] = segment(0, 0, 8);
rangeStats.segments["position:5:over:8"] = segment(0, 0, 10);
rangeStats.segments["position:5:over:9"] = segment(0, 0, 12);
rangeStats.segments["position:5:over:10"] = segment(0, 0, 6);
assert.equal(resolveAnalysisMetric("overs:7-10:wickets").value(rangeStats), 5);
assert.equal(resolveAnalysisMetric("overs:7-10:economy").value(rangeStats), 6);
assert.equal(resolveAnalysisMetric("overs:7-10:economy").qualifies(rangeStats), true);
assert.equal(resolveAnalysisMetric("overs:8-9:economy").qualifies(rangeStats), false);
assert.equal(resolveAnalysisMetric("position:5:overs:7-10:runs").value(rangeStats), 36);
assert.match(resolveAnalysisMetric("position:5:overs:7-10:runs").label, /No\. 5.*7–10/);
assert.throws(() => resolveAnalysisMetric("overs:20-21:runs"));

const players = [0, 1, 2].map((index) => ({ id: `player-${index}`, name: ["Selected Player", "Second Player", "Third Player"][index], role: "All-Rounder", currentTeamId: "A", iplHistory: [] } as unknown as Player));
const fixtures = Array.from({ length: 6 }, (_, match) => ({
  id: `match-${match}`, date: `2027-04-0${match + 1}`, played: true, teamA: "A", teamB: "B",
  scorecard: {
    inningsA: { batting: players.map((player, index) => ({ id: player.id, runs: 20 + index * 12 + match * 5, balls: 20, fours: 3, sixes: 1, dismissal: match < 4 ? "caught" : "not out" })), bowling: [] },
    inningsB: { batting: [], bowling: players.map((player, index) => ({ id: player.id, balls: 24, runsConceded: 20 + index * 10 + match, wickets: (index + match) % 4 })) },
  },
}));
const totals = buildPlayerAnalysisTotals(fixtures);
players.forEach((player) => {
  const stats = totals[player.id];
  stats.dots = 60;
  const weights = [0.3, 0.5, 0.2];
  (["powerplay", "middle", "death"] as const).forEach((phase, index) => {
    stats.phase[phase] = { runs: stats.runs * weights[index], balls: stats.balls * weights[index], wickets: stats.wickets * weights[index], bowlBalls: stats.bowlBalls * weights[index], conceded: stats.conceded * weights[index] };
  });
  for (let over = 1; over <= 20; over++) stats.segments[`over:${over}`] = { ...segment(stats.conceded / 20, stats.wickets / 20, stats.runs / 20), balls: stats.balls / 20, bowlBalls: stats.bowlBalls / 20, fours: stats.fours / 20, sixes: stats.sixes / 20 };
});
const props = { player: players[0], players, totals, fixtures, season: 2027, onClose: () => {} };
const base = defaultAnalysisConfig(players[0]);
let temporary: TemporaryAnalysisLayout = { hidden: [], custom: [] };
for (let index = 0; index < 3; index++) temporary = saveTemporaryAnalysis(temporary, `custom-${index}`, base);
assert.equal(saveTemporaryAnalysis(temporary, "custom-fourth", base), temporary, "a fourth simultaneous custom analysis must be refused");
const edited = saveTemporaryAnalysis(temporary, "custom-1", { ...base, y: "runs" }, true);
assert.equal(edited.custom.length, 3, "editing at the limit must replace rather than append");
assert.equal(edited.custom[1].config.y, "runs");
const freed = { ...temporary, custom: temporary.custom.filter((tile) => tile.id !== "custom-1") };
assert.equal(saveTemporaryAnalysis(freed, "custom-replacement", base).custom.length, 3, "removing a custom tile must free its slot");
const dashboardProps = { ...props, playerMap: Object.fromEntries(players.map((player) => [player.id, player])), teams: {}, structure: "balanced" as const, onExplore: () => {}, onRemoveTile: () => {}, onEditTile: () => {} };
const defaultDashboard = renderToStaticMarkup(React.createElement(PlayerAnalysisDashboard, dashboardProps));
assert.match(defaultDashboard, /data-analysis-count="8"/);
assert.match(defaultDashboard, /Remove Batting/);
const hiddenTiles = ["comparison", "phases", "ranking-a", "core", "ranking-b", "matches", "matchups", "ranking-c"];
const emptyDashboard = renderToStaticMarkup(React.createElement(PlayerAnalysisDashboard, { ...dashboardProps, hiddenTiles }));
assert.match(emptyDashboard, /No analyses selected/);
assert.doesNotMatch(emptyDashboard, /<section/);
const singleDashboard = renderToStaticMarkup(React.createElement(PlayerAnalysisDashboard, { ...dashboardProps, hiddenTiles, customTiles: [{ id: "custom-test", config: base }] }));
assert.match(singleDashboard, /data-analysis-count="1"/);
assert.match(singleDashboard, /data-analysis-region="graphs"/);
assert.match(singleDashboard, /grid-template-columns:repeat\(1, minmax\(0, 1fr\)\)/);
assert.match(singleDashboard, /Edit Scatter/);
assert.doesNotMatch(singleDashboard, /Player data analysis builder|Diagram categories/);
const twoDashboard = renderToStaticMarkup(React.createElement(PlayerAnalysisDashboard, { ...dashboardProps, hiddenTiles, customTiles: [1, 2].map((id) => ({ id: `custom-${id}`, config: base })) }));
assert.match(twoDashboard, /data-analysis-count="2"/);
assert.match(twoDashboard, /grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/);
assert.doesNotMatch(twoDashboard, /overflow-y-auto/, "stats grid must not scroll vertically");
const fullDashboard = renderToStaticMarkup(React.createElement(PlayerAnalysisDashboard, { ...dashboardProps, customTiles: [1, 2, 3].map((id) => ({ id: `custom-${id}`, config: base })) }));
assert.match(fullDashboard, /data-analysis-count="11"/);
assert.equal((fullDashboard.match(/<section/g) ?? []).length, 11, "all default and three extra tiles must render on the same page");
assert.doesNotMatch(fullDashboard, /Analysis pages|Previous|Next|overflow-y-auto/);
assert.match(fullDashboard, /minmax\(0, 1.8fr\) minmax\(0, 1fr\)/, "graphs receive most of the available width while compact lists have two columns");
assert.equal(ANALYSIS_DIAGRAMS.length, 20);
assert.ok(ANALYSIS_DIAGRAMS.every((diagram) => diagram.category !== ("Patterns" as string)));
for (const diagram of ANALYSIS_DIAGRAMS) {
  const config = changeAnalysisDiagram(base, diagram.key, players[0]);
  const rows = analysisData(config, players[0], players, totals, fixtures);
  assert.ok(rows.length > 0, `${diagram.name} should have data`);
  const html = renderToStaticMarkup(React.createElement(PlayerAnalysisBuilder, { ...props, initialConfig: config }));
  assert.doesNotMatch(html, /NaN|Infinity|height="-/, `${diagram.name} should render valid chart geometry`);
  assert.match(html, /Diagram categories/);
  assert.match(html, new RegExp(`${diagram.category} diagram types`));
  assert.match(html, /aria-selected="true"/);
  assert.doesNotMatch(html, /placeholder="Find data"/, "search belongs inside the closed dropdown, not beside every selector");
}
const scalarRows = analysisData({ ...base, diagram: "bars", y: "runs", grouping: "matches" }, players[0], players, totals, fixtures);
const barHtml = renderToStaticMarkup(React.createElement(PlayerAnalysisBuilder, { ...props, initialConfig: { ...base, diagram: "horizontal", y: "economy", grouping: "players" } }));
const economyBars = Array.from(barHtml.matchAll(/<rect x="180"[^>]*width="([^"]+)"[^>]*><title>([^<]+)<\/title>/g)).map((match) => ({ width: Number(match[1]), value: Number(match[2].split("Economy: ")[1]?.split(" · ")[0]) }));
assert.equal(economyBars.length, 3);
economyBars.sort((a, b) => a.value - b.value);
assert.ok(economyBars[0].width < economyBars[2].width, "lower economy must produce a smaller magnitude bar");
const cumulativeRows = analysisData({ ...base, diagram: "cumulative", y: "runs", grouping: "matches" }, players[0], players, totals, fixtures);
assert.equal(cumulativeRows.at(-1)?.value, scalarRows.reduce((sum, row) => sum + row.value, 0));
const rollingRows = analysisData({ ...base, diagram: "rolling", y: "runs", grouping: "matches" }, players[0], players, totals, fixtures);
assert.equal(rollingRows[3].value, (scalarRows[1].value + scalarRows[2].value + scalarRows[3].value) / 3);
assert.equal(analysisHistogram([1, 2, 3, 4, 5, 5]).reduce((sum, bin) => sum + bin.value, 0), 6);
assert.equal(analysisQuantile([10, 20, 30, 40], 0.5), 25);
assert.ok(analysisPercentile([6, 8, 10], 6, true) > analysisPercentile([6, 8, 10], 10, true));
const selectorHtml = renderToStaticMarkup(React.createElement(MetricSelector, { value: "overs:8-15:economy", onChange: () => {}, label: "Spoke 1" }));
assert.match(selectorHtml, /Spoke 1 first over/);
assert.match(selectorHtml, /Spoke 1 last over/);
assert.doesNotMatch(selectorHtml, /Search spokes?/i);
console.log("20 analysis previews, compact metric choices, editable ranges, axis direction, tick spacing and distribution calculations verified.");
