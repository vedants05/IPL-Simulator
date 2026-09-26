import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildPlayerAnalysisTotals, emptyPlayerAnalysisTotals, metricByKey, PLAYER_METRICS } from "../lib/logic/playerAnalysisMetrics";
import { playerDashboardStructure, playerMatchPerformances, performanceBarColour } from "../lib/logic/playerAnalysisDashboard";
import { chartAxis, chartLabels, chartLabelPlayers, chartLowerEndRoleMatches, chartLabelsCollide } from "../lib/logic/playerAnalysisChart";
import type { MatchSimulationRecord } from "../lib/logic/matchSimulation";
import PlayerAnalysisPage from "../components/scouting/PlayerAnalysisPage";
import PlayerAnalysisDashboard from "../components/scouting/PlayerAnalysisDashboard";

const deliveries = Array.from({ length: 12 }, (_, index) => ({
  overNumber: index < 6 ? 7 : 12,
  strikerId: "finisher", bowlerId: "bowler",
  runsOffBat: index % 3 === 0 ? 4 : 0,
  totalRuns: index % 3 === 0 ? 4 : 0,
  isLegal: true,
  extras: { noBalls: 0, byes: 0, legByes: 0 },
}));
const fixture = {
  id: "analysis-sample", played: true,
  simulation: {
    lineups: {},
    innings: [{
      battingTeamId: "A", bowlingTeamId: "B", legalBalls: 12,
      batting: [{ id: "finisher", battingPosition: 6, runs: 32, balls: 20, fours: 4, sixes: 1, notOut: false }],
      bowling: [{ id: "bowler", balls: 12, runsConceded: 16, wickets: 0 }],
      oversDetail: [{ number: 7, deliveries: deliveries.slice(0, 6) }, { number: 12, deliveries: deliveries.slice(6) }],
    }],
  } as unknown as MatchSimulationRecord,
};

const totals = buildPlayerAnalysisTotals([fixture]);
assert.ok(PLAYER_METRICS.length > 500, "detailed metric catalogue should contain hundreds of factors");
assert.equal(metricByKey["overs:7-12:economy"].value(totals.bowler), 8);
assert.equal(metricByKey["position:6plus:runs"].value(totals.finisher), 32);
assert.equal(metricByKey["position:6plus:overs:7-12:runs"].value(totals.finisher), 16);
assert.equal(metricByKey["overs:7-12:economy"].qualifies(totals.bowler), false, "12 balls should display but not receive a qualified economy rank");
assert.equal(metricByKey["position:6plus:runs"].qualifies(totals.finisher), true);
const pageProps = {
  players: { finisher: { id: "finisher", name: "Test Finisher", role: "Batsman", age: 26, isFinisher: true, currentTeamId: "A", iplHistory: [], iplStats: { matches: 1, runs: 32, wickets: 0 }, } as any },
  teams: { A: { shortName: "A" } as any }, userTeamId: "A", currentSeason: 2027,
  fixtures: [fixture], scoutingReports: [], shortlist: [],
  onToggleShortlist: () => {}, onOpenProfile: () => {},
};
const emptyHtml = renderToStaticMarkup(React.createElement(PlayerAnalysisPage, pageProps));
assert.match(emptyHtml, /Choose a player above/);
assert.doesNotMatch(emptyHtml, /Create chart or table/);
const html = renderToStaticMarkup(React.createElement(PlayerAnalysisPage, { ...pageProps, initialPlayerId: "finisher" }));
assert.match(html, /Test Finisher/);
assert.match(html, /2027/);
assert.match(html, /Bat inns/);
assert.match(html, /50s\/100s/);
assert.doesNotMatch(html, /IPL career|Analysis season/);
assert.match(html, /Create chart or table/);
assert.match(html, /data-dashboard-structure="batting"/);
assert.match(html, /Runs × strike rate/);
assert.match(html, />middle</i);
assert.match(html, /32\(20\)/, "performance bars should show the batting score and balls faced");
assert.doesNotMatch(html, />power</i);
assert.doesNotMatch(html, />death</i);

const battingFixtures = (scores: number[]) => scores.map((runs, index) => ({
  id: `bat-${index}`, played: true,
  scorecard: {
    inningsA: { batting: [{ id: "test", runs, balls: Math.max(3, runs), fours: 0, sixes: 0 }], bowling: [] },
    inningsB: { batting: [], bowling: [] },
  },
}));
const performanceFixtures = [
  { runs: 80, balls: 60, dismissal: "caught", wickets: 2, conceded: 50, overs: 4 },
  { runs: 80, balls: 30, dismissal: "caught", wickets: 2, conceded: 25, overs: 4 },
  { runs: 37, balls: 20, dismissal: "not out", wickets: 2, conceded: 32, overs: 4 },
  { runs: 0, balls: 1, dismissal: "bowled", wickets: 0, conceded: 15, overs: 3.2 },
].map((performance, index) => ({
  id: `performance-${index}`, date: `2027-04-0${index + 1}`, played: true, teamA: "A", teamB: "KKR",
  scorecard: {
    inningsA: { batting: [{ id: "test", runs: performance.runs, balls: performance.balls, dismissal: performance.dismissal }], bowling: [] },
    inningsB: { batting: [], bowling: [{ id: "test", wickets: performance.wickets, runsConceded: performance.conceded, overs: performance.overs }] },
  },
}));
const battingPerformances = playerMatchPerformances(performanceFixtures, "test", false);
assert.deepEqual(battingPerformances.map((entry) => entry.label), ["80(60)", "80(30)", "37*(20)", "0(1)"]);
assert.deepEqual(battingPerformances.map((entry) => entry.rank), [2, 1, 3, 4], "equal runs must favour fewer balls, and ducks still get a bar");
const bowlingPerformances = playerMatchPerformances(performanceFixtures, "test", true);
assert.deepEqual(bowlingPerformances.map((entry) => entry.label), ["2/50 (4)", "2/25 (4)", "2/32 (4)", "0/15 (3.2)"]);
assert.deepEqual(bowlingPerformances.map((entry) => entry.rank), [3, 1, 2, 4], "equal wickets must favour better economy, and wicketless spells still get a bar");
assert.ok(battingPerformances.every((entry) => entry.opponentTeamId === "KKR"));
assert.ok(bowlingPerformances.every((entry) => entry.opponentTeamId === "KKR"));
assert.equal(playerMatchPerformances([fixture], "finisher", false)[0].opponentTeamId, "B", "simulation innings must supply the opponent");
assert.equal(performanceBarColour(5, 5), "rgb(239, 68, 68)");
assert.equal(performanceBarColour(3, 5), "rgb(245, 158, 11)");
assert.equal(performanceBarColour(1, 5), "rgb(34, 197, 94)");
assert.equal(playerMatchPerformances([...performanceFixtures, { ...performanceFixtures[0], id: "unplayed", played: false }], "test", false).length, 4);
const latestPerformances = playerMatchPerformances(battingFixtures(Array(12).fill(20)), "test", false);
assert.equal(latestPerformances.length, 10, "keep the original compact latest-ten-match structure");
assert.equal(latestPerformances[0].id, "bat-2:0");
assert.match(html, /<rect/, "performances must render as chart bars");
assert.equal(playerMatchPerformances([fixture], "finisher", false)[0].label, "32(20)", "simulation scorecards should be supported too");
const bowler = { id: "test", role: "Pace Bowler" } as any;
const batter = { id: "test", role: "Batsman" } as any;
const structureStats = emptyPlayerAnalysisTotals();
structureStats.matches = 3;
structureStats.bowlingInnings = 3;
structureStats.bowlBalls = 60;
assert.equal(playerDashboardStructure(bowler, structureStats, battingFixtures([1, 1, 1])), "bowling");
assert.equal(playerDashboardStructure(bowler, structureStats, battingFixtures([20])), "bowling-with-batting");
structureStats.innings = 2;
structureStats.balls = 40;
assert.equal(playerDashboardStructure(bowler, structureStats, battingFixtures([20, 12])), "balanced");
structureStats.bowlBalls = 6;
structureStats.bowlingInnings = 1;
assert.equal(playerDashboardStructure(batter, structureStats, battingFixtures([20, 12])), "batting");
structureStats.bowlBalls = 18;
assert.equal(playerDashboardStructure(batter, structureStats, battingFixtures([20, 12])), "batting-with-bowling");
structureStats.bowlBalls = 40;
structureStats.bowlingInnings = 2;
assert.equal(playerDashboardStructure(batter, structureStats, battingFixtures([20, 12])), "balanced");

const rankedSamples = [3, 2, 1].map((sixes, index) => {
  const player = { id: `rank-${index}`, name: ["Above", "Selected", "Below"][index], role: "Batsman", currentTeamId: "A" } as any;
  const stats = emptyPlayerAnalysisTotals();
  stats.matches = 2;
  stats.innings = 2;
  stats.balls = 70;
  stats.sixes = sixes;
  return { player, stats };
});
const rankingHtml = renderToStaticMarkup(React.createElement(PlayerAnalysisDashboard, {
  player: rankedSamples[1].player,
  players: rankedSamples.map((sample) => sample.player),
  playerMap: Object.fromEntries(rankedSamples.map((sample) => [sample.player.id, sample.player])),
  teams: { A: { shortName: "A" } as any },
  totals: Object.fromEntries(rankedSamples.map((sample) => [sample.player.id, sample.stats])),
  fixtures: [], structure: "batting", onExplore: () => {},
}));
assert.match(rankingHtml, /Above/);
assert.match(rankingHtml, /Selected/);
assert.match(rankingHtml, /Below/);
assert.match(rankingHtml, /#2/);
for (const selectedIndex of [0, 2]) {
  const edgeHtml = renderToStaticMarkup(React.createElement(PlayerAnalysisDashboard, {
    player: rankedSamples[selectedIndex].player,
    players: rankedSamples.map((sample) => sample.player),
    playerMap: Object.fromEntries(rankedSamples.map((sample) => [sample.player.id, sample.player])),
    teams: { A: { shortName: "A" } as any },
    totals: Object.fromEntries(rankedSamples.map((sample) => [sample.player.id, sample.stats])),
    fixtures: [], structure: "batting", onExplore: () => {},
  }));
  const tile = edgeHtml.match(/aria-label="Open Sixes ranking">([\s\S]*?)<\/button>/)?.[1];
  assert.ok(tile);
  const displayedRows = tile.split("</div>").slice(0, 3);
  assert.equal(displayedRows.length, 3);
  displayedRows.forEach((row, position) => {
    assert.ok(row.includes(`#${position + 1}`));
    assert.equal(row.includes("bg-accent/15"), position === selectedIndex, "highlight must follow the selected player to the first or last row");
    assert.equal(row.includes("text-lg"), position === selectedIndex);
    assert.equal(row.includes("text-sm"), position === selectedIndex);
  });
}
const axis = chartAxis([620, 645, 690, 715]);
assert.ok(axis.min > 0 && axis.min <= 620 && axis.max >= 715, "axes should frame the actual player distribution");
const plotted = [
  { id: "selected", name: "Selected", x: 170, y: 110 },
  { id: "near-1", name: "Nearby One", x: 184, y: 105 },
  { id: "near-2", name: "Nearby Two", x: 156, y: 121 },
  { id: "high", name: "High Performer", x: 320, y: 28 },
  { id: "low", name: "Low Performer", x: 70, y: 197 },
  { id: "other", name: "Other", x: 250, y: 135 },
];
const labels = chartLabels(plotted, "selected", 400, 230);
assert.equal(chartLowerEndRoleMatches("Pace Bowler", ["Batting", "Batting phases"]), false);
assert.equal(chartLowerEndRoleMatches("Batsman", ["Batting", "Batting phases"]), true);
assert.equal(chartLowerEndRoleMatches("WK-Batsman", ["Over batting"]), true);
assert.equal(chartLowerEndRoleMatches("All-Rounder", ["Batting", "Bowling"]), true);
assert.equal(chartLowerEndRoleMatches("Batsman", ["Bowling", "Bowling phases"]), false);
assert.equal(chartLowerEndRoleMatches("Spin Bowler", ["Bowling", "Bowling phases"]), true);
const roleFiltered = plotted.map((point) => ({ ...point, lowerEndEligible: point.id !== "low" }));
assert.equal(chartLabelPlayers(roleFiltered, "selected", 400, 230)[1].id, "near-2", "lower-end highlight must come from the relevant roles, even if a qualified specialist is further toward the lower corner");
const measuredLabels = chartLabels(plotted, "selected", 400, 230, 4, { selected: 93.25 });
assert.equal(measuredLabels.find((label) => label.id === "selected")?.width, 93.25, "layout and connector geometry must use the rendered name bar width");
assert.deepEqual(chartLabelPlayers(plotted, "selected", 400, 230).map((point) => point.id), ["selected", "low", "high", "near-1", "near-2"], "label the selected player, both ends, and the two closest neighbours");
assert.deepEqual(new Set(labels.map((label) => label.id)), new Set(["selected", "low", "high", "near-1", "near-2"]));
assert.ok(labels.length <= 5);
assert.ok(labels.some((label) => label.id === "selected"));
const optimumIsNeighbour = [
  { id: "selected", name: "Selected", x: 310, y: 40 },
  { id: "optimum", name: "Optimum", x: 320, y: 30 },
  { id: "near-1", name: "Near One", x: 290, y: 50 },
  { id: "near-2", name: "Near Two", x: 280, y: 70 },
  { id: "low", name: "Low", x: 50, y: 200 },
];
assert.deepEqual(chartLabelPlayers(optimumIsNeighbour, "selected", 400, 230).map((point) => point.id), ["selected", "low", "optimum", "near-1", "near-2"], "end-player slots must not consume either neighbour slot");
const crowded = [...plotted, ...Array.from({ length: 90 }, (_, index) => ({ id: `crowd-${index}`, name: "Crowd", x: 90 + index % 10 * 20, y: 50 + Math.floor(index / 10) * 16 }))];
assert.deepEqual(new Set(chartLabels(crowded, "selected", 400, 230).map((label) => label.id)), new Set(chartLabelPlayers(crowded, "selected", 400, 230).map((point) => point.id)), "crowding must not silently remove a chosen neighbour");
const horizontalConnector = { id: "a", name: "A", left: 100, top: 40, width: 40, anchorX: 20, anchorY: 48, connectorX: 100, connectorY: 48 };
const cardInPath = { id: "b", name: "B", left: 55, top: 40, width: 20, anchorX: 65, anchorY: 20, connectorX: 65, connectorY: 40 };
assert.equal(chartLabelsCollide(horizontalConnector, cardInPath), true, "a connector must not pass through another player's card");
const crossingConnector = { ...cardInPath, left: 50, top: 80, width: 30, anchorY: 10, connectorY: 80 };
assert.equal(chartLabelsCollide(horizontalConnector, crossingConnector), true, "connectors must not cross even when the cards are separate");
assert.equal(chartLabelsCollide(horizontalConnector, { ...crossingConnector, anchorY: 65 }), false, "separate cards and connectors should keep their positions");
for (const layout of [labels, chartLabels(crowded, "selected", 400, 230)]) {
  layout.forEach((label, index) => layout.slice(index + 1).forEach((other) => {
    assert.equal(chartLabelsCollide(label, other), false, "rendered labels must avoid card overlaps, connector crossings and lines through names");
  }));
}
for (const label of labels) {
  const labelWidth = label.width;
  assert.equal(label.connectorX, Math.max(label.left, Math.min(label.anchorX, label.left + label.width)), "connector must meet the nearest horizontal edge position");
  assert.equal(label.connectorY, Math.max(label.top, Math.min(label.anchorY, label.top + 17)), "connector must meet the nearest vertical edge position");
  assert.equal(label.width, Math.ceil(Array.from(label.name).length * 4.8 + 10), "name bars should fit the text with only small padding");
  const point = plotted.find((entry) => entry.id === label.id)!;
  const selected = plotted[0];
  if (point.id !== selected.id) {
    assert.equal(Math.sign(label.left + labelWidth / 2 - selected.x), Math.sign(point.x - selected.x), "names must preserve horizontal direction");
    assert.equal(Math.sign(label.top + 8.5 - selected.y), Math.sign(point.y - selected.y), "names must preserve vertical direction");
  }
  assert.ok(plotted.every((point) => point.id === label.id || point.x < label.left - 6 || point.x > label.left + labelWidth + 6 || point.y < label.top - 6 || point.y > label.top + 23), "a chart label must not cover another plotted player");
}
console.log(`${PLAYER_METRICS.length} player analysis factors verified, including overs 7–12 economy and No. 6 or lower runs.`);
