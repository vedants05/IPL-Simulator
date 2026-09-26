import React from "react";
import { createRoot } from "react-dom/client";
import PlayerAnalysisDashboard from "../components/scouting/PlayerAnalysisDashboard";
import PlayerAnalysisBuilder from "../components/scouting/PlayerAnalysisBuilder";
import { buildPlayerAnalysisTotals } from "../lib/logic/playerAnalysisMetrics";
import { changeAnalysisDiagram, defaultAnalysisConfig, type AnalysisDiagram } from "../lib/logic/playerAnalysisBuilder";
import type { Player } from "../lib/types";

const players = Array.from({ length: 24 }, (_, index) => ({ id: `player-${index}`, name: index === 0 ? "Venkatesh Chandrasekharan" : `Long Player Name ${index + 1}`, role: "All-Rounder", currentTeamId: index % 2 ? "B" : "A", iplHistory: [] } as unknown as Player));
const fixtures = Array.from({ length: 10 }, (_, match) => ({ id: `match-${match}`, date: `2027-04-${String(match + 1).padStart(2, "0")}`, played: true, teamA: "A", teamB: "B", scorecard: {
  inningsA: { batting: players.map((player, index) => ({ id: player.id, runs: 20 + index * 3 + match * 5, balls: 20 + index, fours: 3, sixes: 1, dismissal: match < 8 ? "caught" : "not out" })), bowling: [] },
  inningsB: { batting: [], bowling: players.map((player, index) => ({ id: player.id, balls: 24, runsConceded: 20 + index + match, wickets: (index + match) % 4 })) },
} }));
const totals = buildPlayerAnalysisTotals(fixtures);
players.forEach((player) => {
  const stats = totals[player.id];
  stats.dots = 90;
  (["powerplay", "middle", "death"] as const).forEach((phase, index) => { const weight = [0.3, 0.5, 0.2][index]; stats.phase[phase] = { runs: stats.runs * weight, balls: stats.balls * weight, wickets: stats.wickets * weight, bowlBalls: stats.bowlBalls * weight, conceded: stats.conceded * weight }; });
  for (let over = 1; over <= 20; over++) stats.segments[`over:${over}`] = { innings: 10, runs: stats.runs / 20, balls: stats.balls / 20, dismissals: 0, fours: stats.fours / 20, sixes: stats.sixes / 20, wickets: stats.wickets / 20, bowlBalls: stats.bowlBalls / 20, conceded: stats.conceded / 20, dots: stats.dots / 20 };
});
const base = defaultAnalysisConfig(players[0]);
const root = createRoot(document.getElementById("root")!);
const ids = ["comparison", "phases", "ranking-a", "core", "ranking-b", "matches", "matchups", "ranking-c"];
const api = {
  render(diagrams: AnalysisDiagram[], hidden: string[] = []) {
    root.render(<div style={{ height: "100vh", maxWidth: 1500, margin: "0 auto", overflow: "hidden", padding: 20, background: "var(--background)", color: "var(--ink)" }}><header style={{ height: 190 }}><h1 style={{ fontFamily: "Impact", fontSize: 24 }}>PLAYER ANALYSIS LAYOUT STRESS TEST</h1><p>Long names · 24 qualifying players · {diagrams.join(", ") || "Default"}</p></header><main style={{ height: "calc(100% - 190px)", display: "flex", minHeight: 0 }}><PlayerAnalysisDashboard player={players[0]} players={players} playerMap={Object.fromEntries(players.map((player) => [player.id, player]))} teams={{ A: { shortName: "KKR", primaryColor: "#7561bd" }, B: { shortName: "RCB", primaryColor: "#d44f56" } } as never} totals={totals} fixtures={fixtures} structure="balanced" season={2027} onExplore={() => {}} hiddenTiles={hidden} customTiles={diagrams.map((diagram, index) => ({ id: `custom-${index}`, config: { ...changeAnalysisDiagram(base, diagram, players[0]), radar: ["runs", "strikeRate", "wickets", "economy", "boundaryRate"] } }))} onRemoveTile={() => {}} onEditTile={() => {}} onExpandTile={() => {}} /></main></div>);
  },
  ids,
  renderPreview(diagram: AnalysisDiagram) {
    root.render(<div style={{ height: "100vh", padding: 20, display: "flex", overflow: "hidden" }}><PlayerAnalysisBuilder key={diagram} player={players[0]} players={players} teams={{ A: { primaryColor: "#7561bd" }, B: { primaryColor: "#d44f56" } } as never} totals={totals} fixtures={fixtures} season={2027} onClose={() => {}} initialConfig={changeAnalysisDiagram(base, diagram, players[0])} /></div>);
  },
  measurePreview() {
    const scatter = document.querySelector('[data-player-scatter="true"]')!;
    const bounds = scatter.querySelector('[role="img"]')!.getBoundingClientRect();
    const labels = Array.from(scatter.querySelectorAll('[data-scatter-label]'));
    const issues: string[] = [];
    if (bounds.height < 150) issues.push("preview plot too short");
    if (labels.length < 4 || labels.length > 5 || !scatter.querySelector('[data-scatter-label="player-0"]')) issues.push("preview representative labels missing");
    const colours = new Set(Array.from(scatter.querySelectorAll('[data-scatter-point]:not([data-scatter-point="player-0"])')).map((point) => getComputedStyle(point).backgroundColor));
    if (!colours.has('rgb(117, 97, 189)') || !colours.has('rgb(212, 79, 86)')) issues.push("preview team colours missing");
    for (const label of labels) {
      const rect = label.getBoundingClientRect();
      if (rect.left < bounds.left || rect.right > bounds.right || rect.top < bounds.top || rect.bottom > bounds.bottom) issues.push("preview label outside plot");
    }
    return { width: innerWidth, height: innerHeight, issues };
  },
  measure() {
    const dashboard = document.querySelector("[data-dashboard-structure]") as HTMLElement | null;
    const bounds = dashboard?.getBoundingClientRect();
    const issues: string[] = [];
    const tiles = Array.from(document.querySelectorAll("section")).map((tile) => {
      const rect = tile.getBoundingClientRect(), title = tile.querySelector("h3")?.textContent ?? "";
      if (bounds && (rect.bottom > bounds.bottom + 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.left < bounds.left - 1)) issues.push(`${title}: outside dashboard`);
      if (tile.scrollHeight > tile.clientHeight + 2) issues.push(`${title}: vertical content overflow ${tile.scrollHeight}/${tile.clientHeight}`);
      if (tile.scrollWidth > tile.clientWidth + 2) issues.push(`${title}: horizontal content overflow`);
      const heading = tile.querySelector("h3")!.getBoundingClientRect();
      for (const control of Array.from(tile.querySelectorAll('button[title="Remove analysis"], button[title="Edit analysis"], button[title="Expand analysis"]'))) {
        const c = control.getBoundingClientRect();
        if (heading.right > c.left + 1 && heading.bottom > c.top + 1 && heading.top < c.bottom) issues.push(`${title}: header/control overlap`);
      }
      for (const label of Array.from(tile.querySelectorAll("svg[role=img] text"))) {
        const text = label.getBoundingClientRect();
        if (text.right > rect.right + 1 || text.left < rect.left - 1 || text.bottom > rect.bottom + 1 || text.top < rect.top - 1) issues.push(`${title}: chart label outside tile (${label.textContent})`);
      }
      for (const svg of Array.from(tile.querySelectorAll("svg[role=img]"))) {
        const labels = Array.from(svg.querySelectorAll("text"));
        for (let first = 0; first < labels.length; first++) for (let second = first + 1; second < labels.length; second++) {
          const a = labels[first].getBoundingClientRect(), b = labels[second].getBoundingClientRect();
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) issues.push(`${title}: chart labels overlap (${labels[first].textContent} / ${labels[second].textContent})`);
        }
      }
      for (const label of Array.from(tile.querySelectorAll("span"))) {
        if (!label.textContent?.startsWith("vs ") || label.children.length) continue;
        const text = label.getBoundingClientRect();
        if (text.bottom > rect.bottom - 2 || text.right > rect.right || text.left < rect.left) issues.push(`${title}: opponent label clipped`);
      }
      const isGraph = tile.closest('[data-analysis-region="graphs"]');
      if (isGraph && (rect.width < 300 || rect.height < 200)) issues.push(`${title}: graph squeezed below readable dimensions`);
      for (const scatter of Array.from(tile.querySelectorAll('[data-player-scatter="true"]'))) {
        const plot = scatter.querySelector('[role="img"]')!.getBoundingClientRect();
        const labels = Array.from(scatter.querySelectorAll('[data-scatter-label]'));
        if (labels.length < 4 || labels.length > 5) issues.push(`${title}: expected endpoints and nearby name bars`);
        if (!scatter.querySelector('[data-scatter-label="player-0"]')) issues.push(`${title}: selected label missing`);
        const colours = new Set(Array.from(scatter.querySelectorAll('[data-scatter-point]:not([data-scatter-point="player-0"])')).map((point) => getComputedStyle(point).backgroundColor));
        if (!colours.has('rgb(117, 97, 189)') || !colours.has('rgb(212, 79, 86)')) issues.push(`${title}: team colours missing`);
        for (let first = 0; first < labels.length; first++) {
          const a = labels[first].getBoundingClientRect();
          if (a.left < plot.left || a.right > plot.right || a.top < plot.top || a.bottom > plot.bottom) issues.push(`${title}: name bar outside plot`);
          for (let second = first + 1; second < labels.length; second++) {
            const b = labels[second].getBoundingClientRect();
            if (Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)) issues.push(`${title}: scatter name bars overlap`);
          }
        }
        if (scatter.querySelectorAll('[data-scatter-connector]').length !== labels.length) issues.push(`${title}: label connector missing`);
      }
      return { title, width: Math.round(rect.width), height: Math.round(rect.height) };
    });
    if (document.documentElement.scrollHeight > window.innerHeight + 1) issues.push("page scrolls vertically");
    return { width: innerWidth, height: innerHeight, tiles, issues };
  },
};
(window as unknown as { analysisTest: typeof api }).analysisTest = api;
api.render([]);
