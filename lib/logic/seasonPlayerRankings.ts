import type { Player } from "@/lib/types";
import {
  PLAYER_METRICS, buildPlayerAnalysisTotals, emptyPlayerAnalysisTotals,
  type PlayerAnalysisFixture, type PlayerAnalysisTotals,
} from "./playerAnalysisMetrics";

export type StatsDiscipline = "batting" | "bowling" | "fielding";
export type SeasonStatsRecord = {
  id: string; name: string; teamId: string; matches: number;
  catches?: number; stumpings?: number; runOuts?: number;
};
export type SeasonRankingEntry = {
  id: string; name: string; teamId: string; totals: PlayerAnalysisTotals;
  highestScore: number; notOuts: number; maidens: number; wides: number; noBalls: number;
  fourWicketHauls: number; fiveWicketHauls: number;
  catches: number; stumpings: number; runOuts: number; fieldingRecorded: boolean;
};
export type SeasonRankingMetric = {
  key: string; label: string; section: string; discipline: StatsDiscipline;
  unit?: string; lowerBetter?: boolean; minimum: string; detail?: boolean;
  value: (entry: SeasonRankingEntry) => number | null;
  qualifies: (entry: SeasonRankingEntry) => boolean;
};
const ratio = (a: number, b: number, scale = 1) => b > 0 ? a / b * scale : null;
const coreOrder = ["runs", "strikeRate", "batAverage", "sixes", "fours", "fifties", "hundreds", "runsPerMatch", "matches", "boundaryRate", "wickets", "economy", "bowlAverage", "wicketsPerMatch", "dotRate"];

// Reuse the game's existing metrics and their qualification rules. Keep individual
// over / position-over combinations out of this season menu to avoid hundreds of duplicates.
export const SEASON_RANKING_METRICS: SeasonRankingMetric[] = PLAYER_METRICS.filter(metric =>
  !metric.key.startsWith("over:") && !metric.key.startsWith("position:") &&
  (!metric.key.startsWith("overs:") || /^overs:(1-6|7-12|13-16|17-20):/.test(metric.key)),
).map(metric => {
  const discipline: StatsDiscipline = metric.group.toLowerCase().includes("bowling") ? "bowling" : "batting";
  const key = metric.key;
  const section = key.startsWith("vs:") ? "Matchups"
    : /^(innings|result):/.test(key) ? "Match situations"
      : key.startsWith("overs:") || /^(powerplay|middle|death)/.test(key) ? "Innings phases"
        : "Season totals & rates";
  return {
    key, label: metric.label, section, discipline, unit: metric.unit,
    lowerBetter: metric.lowerBetter, minimum: metric.minimum,
    detail: section === "Innings phases" || section === "Matchups" || key === "dotRate",
    value: (entry: SeasonRankingEntry) => metric.value(entry.totals), qualifies: (entry: SeasonRankingEntry) => metric.qualifies(entry.totals),
  };
}).sort((a, b) => {
  const ai = coreOrder.indexOf(a.key), bi = coreOrder.indexOf(b.key);
  return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
});

const extra = (key: string, label: string, discipline: StatsDiscipline, value: SeasonRankingMetric["value"], minimum: string, qualifies: SeasonRankingMetric["qualifies"], lowerBetter = false): SeasonRankingMetric =>
  ({ key, label, discipline, section: discipline === "fielding" ? "Dismissals & involvement" : "Season totals & rates", minimum, value, qualifies, lowerBetter });
const batted = (e: SeasonRankingEntry) => e.totals.innings > 0;
const bowled = (e: SeasonRankingEntry) => e.totals.bowlBalls > 0;
const fielded = (e: SeasonRankingEntry) => e.fieldingRecorded && e.totals.matches > 0;
SEASON_RANKING_METRICS.push(
  extra("highestScore", "Highest score", "batting", e => e.highestScore, "1 batting innings", batted),
  extra("ballsFaced", "Balls faced", "batting", e => e.totals.balls, "1 batting innings", batted),
  extra("notOuts", "Not outs", "batting", e => e.notOuts, "1 batting innings", batted),
  extra("boundaryRuns", "Runs from boundaries", "batting", e => e.totals.fours * 4 + e.totals.sixes * 6, "1 batting innings", batted),
  extra("boundaryRunShare", "Boundary share of runs", "batting", e => ratio(e.totals.fours * 4 + e.totals.sixes * 6, e.totals.runs, 100), "60 balls faced", e => e.totals.balls >= 60),
  extra("bowlStrikeRate", "Bowling strike rate", "bowling", e => ratio(e.totals.bowlBalls, e.totals.wickets), "60 balls and 2 wickets", e => e.totals.bowlBalls >= 60 && e.totals.wickets >= 2, true),
  extra("ballsBowled", "Balls bowled", "bowling", e => e.totals.bowlBalls, "1 ball bowled", bowled),
  extra("runsConceded", "Runs conceded", "bowling", e => e.totals.conceded, "1 ball bowled", bowled, true),
  extra("maidens", "Maiden overs", "bowling", e => e.maidens, "1 ball bowled", bowled),
  extra("fourWicketHauls", "Four-wicket hauls", "bowling", e => e.fourWicketHauls, "1 bowling innings; exactly 4 wickets", bowled),
  extra("fiveWicketHauls", "Five-wicket hauls", "bowling", e => e.fiveWicketHauls, "1 bowling innings; 5 or more wickets", bowled),
  extra("wides", "Wides conceded", "bowling", e => e.wides, "1 ball bowled", bowled, true),
  extra("noBalls", "No-balls conceded", "bowling", e => e.noBalls, "1 ball bowled", bowled, true),
  extra("catches", "Catches", "fielding", e => e.catches, "1 appearance with fielding records", fielded),
  extra("stumpings", "Stumpings", "fielding", e => e.stumpings, "1 appearance with fielding records", fielded),
  extra("runOuts", "Run-outs", "fielding", e => e.runOuts, "1 appearance with fielding records", fielded),
  extra("fieldingDismissals", "Total fielding dismissals", "fielding", e => e.catches + e.stumpings + e.runOuts, "Catches + stumpings + credited run-outs", fielded),
  extra("catchesPerMatch", "Catches per match", "fielding", e => ratio(e.catches, e.totals.matches), "4 matches with fielding records", e => fielded(e) && e.totals.matches >= 4),
  extra("stumpingsPerMatch", "Stumpings per match", "fielding", e => ratio(e.stumpings, e.totals.matches), "4 matches with fielding records", e => fielded(e) && e.totals.matches >= 4),
  extra("runOutsPerMatch", "Run-outs per match", "fielding", e => ratio(e.runOuts, e.totals.matches), "4 matches with fielding records", e => fielded(e) && e.totals.matches >= 4),
  extra("dismissalsPerMatch", "Fielding dismissals per match", "fielding", e => ratio(e.catches + e.stumpings + e.runOuts, e.totals.matches), "4 matches with fielding records", e => fielded(e) && e.totals.matches >= 4),
);
SEASON_RANKING_METRICS.find(m => m.key === "boundaryRunShare")!.unit = "%";

function emptyEntry(id: string, name: string, teamId: string): SeasonRankingEntry {
  return { id, name, teamId, totals: emptyPlayerAnalysisTotals(), highestScore: 0, notOuts: 0, maidens: 0, wides: 0, noBalls: 0, fourWicketHauls: 0, fiveWicketHauls: 0, catches: 0, stumpings: 0, runOuts: 0, fieldingRecorded: false };
}
function addTotals(target: PlayerAnalysisTotals, source: PlayerAnalysisTotals) {
  for (const key of ["matches", "innings", "runs", "balls", "dismissals", "fours", "sixes", "fifties", "hundreds", "bowlingInnings", "bowlBalls", "conceded", "wickets", "dots"] as const) target[key] += source[key];
  for (const phase of ["powerplay", "middle", "death"] as const) {
    for (const key of ["runs", "balls", "wickets", "bowlBalls", "conceded"] as const) target.phase[phase][key] += source.phase[phase][key];
  }
  for (const [key, segment] of Object.entries(source.segments)) {
    if (!target.segments[key]) target.segments[key] = { ...segment };
    else for (const field of Object.keys(segment) as Array<keyof typeof segment>) target.segments[key][field] += segment[field];
  }
}

export function buildSeasonRankingEntries(fixtures: readonly PlayerAnalysisFixture[], players: Record<string, Player>, fieldingStats: Record<string, SeasonStatsRecord>) {
  const individuals: Record<string, SeasonRankingEntry> = {};
  const teams: Record<string, SeasonRankingEntry> = {};
  const seen = new Set<string>();
  let detailedMatches = 0, scoredMatches = 0;
  for (const fixture of fixtures) {
    if (!fixture.played || seen.has(fixture.id)) continue;
    seen.add(fixture.id);
    const innings = fixture.simulation?.innings ?? (fixture.scorecard ? [fixture.scorecard.inningsA, fixture.scorecard.inningsB] : []);
    if (!innings.length) continue;
    scoredMatches += 1;
    if (fixture.simulation && fixture.simulation.innings.every(i => i.oversDetail.flatMap(o => o.deliveries).filter(d => d.isLegal).length === i.legalBalls)) detailedMatches += 1;
    const totals = buildPlayerAnalysisTotals([fixture], players);
    for (const stats of Object.values(totals)) { stats.innings = 0; stats.dismissals = 0; }
    const affiliations: Record<string, string> = {};
    innings.forEach((inning, index) => {
      const batTeam = "battingTeamId" in inning && typeof inning.battingTeamId === "string" ? inning.battingTeamId : index === 0 ? fixture.teamA : fixture.teamB;
      const bowlTeam = "bowlingTeamId" in inning && typeof inning.bowlingTeamId === "string" ? inning.bowlingTeamId : index === 0 ? fixture.teamB : fixture.teamA;
      for (const p of inning.batting) affiliations[p.id] = batTeam ?? "";
      for (const p of inning.bowling) affiliations[p.id] = bowlTeam ?? "";
      if (batTeam) teams[batTeam] ??= emptyEntry(batTeam, batTeam, batTeam);
      if (bowlTeam) teams[bowlTeam] ??= emptyEntry(bowlTeam, bowlTeam, bowlTeam);
      // Count zero-ball dismissals, and distinguish not-out batters from DNBs.
      for (const p of inning.batting) {
        const s = totals[p.id];
        const dismissal = p.dismissal?.toLowerCase();
        const didNotBat = ("didNotBat" in p && p.didNotBat) || dismissal === "did not bat";
        const dismissed = !didNotBat && ("notOut" in p ? !p.notOut : Boolean(dismissal && dismissal !== "not out"));
        const batted = !didNotBat && ((p.balls ?? 0) > 0 || (p.runs ?? 0) > 0 || dismissed || ("notOut" in p && p.notOut));
        if (s && batted) { s.innings += 1; if (dismissed) s.dismissals += 1; }
        const entry = individuals[p.id] ??= emptyEntry(p.id, players[p.id]?.name ?? p.id, batTeam ?? "");
        entry.highestScore = Math.max(entry.highestScore, p.runs ?? 0);
        if (batted && !dismissed) {
          entry.notOuts += 1;
          if (batTeam) teams[batTeam].notOuts += 1;
        }
      }
      if (batTeam) teams[batTeam].highestScore = Math.max(teams[batTeam].highestScore, inning.batting.reduce((sum, p) => sum + (p.runs ?? 0), 0));
      for (const p of inning.bowling) {
        const entry = individuals[p.id] ??= emptyEntry(p.id, players[p.id]?.name ?? p.id, bowlTeam ?? "");
        for (const target of [entry, ...(bowlTeam ? [teams[bowlTeam]] : [])]) {
          target.maidens += "maidens" in p ? Number(p.maidens ?? 0) : 0;
          target.wides += "wides" in p ? Number(p.wides ?? 0) : 0;
          target.noBalls += "noBalls" in p ? Number(p.noBalls ?? 0) : 0;
          if (p.wickets === 4) target.fourWicketHauls += 1;
          if ((p.wickets ?? 0) >= 5) target.fiveWicketHauls += 1;
        }
      }
    });
    for (const [teamId, lineup] of Object.entries(fixture.simulation?.lineups ?? {})) for (const id of [...lineup.startingXI, ...lineup.finalXI]) affiliations[id] = teamId;
    const teamMatchTotals: Record<string, PlayerAnalysisTotals> = {};
    for (const [id, stats] of Object.entries(totals)) {
      const teamId = affiliations[id] ?? fieldingStats[id]?.teamId ?? "";
      const entry = individuals[id] ??= emptyEntry(id, players[id]?.name ?? fieldingStats[id]?.name ?? id, teamId);
      entry.teamId = teamId;
      addTotals(entry.totals, stats);
      if (teamId) addTotals(teamMatchTotals[teamId] ??= emptyPlayerAnalysisTotals(), stats);
    }
    for (const [teamId, stats] of Object.entries(teamMatchTotals)) {
      stats.matches = 1;
      stats.innings = innings.some((i, index) => ("battingTeamId" in i ? i.battingTeamId : index === 0 ? fixture.teamA : fixture.teamB) === teamId) ? 1 : 0;
      stats.bowlingInnings = innings.some((i, index) => ("bowlingTeamId" in i ? i.bowlingTeamId : index === 0 ? fixture.teamB : fixture.teamA) === teamId) ? 1 : 0;
      addTotals((teams[teamId] ??= emptyEntry(teamId, teamId, teamId)).totals, stats);
    }
  }
  // Fielding counts are already stored in the season summary, including compact saves.
  for (const s of Object.values(fieldingStats)) {
    if (s.catches === undefined && s.stumpings === undefined && s.runOuts === undefined) continue;
    const entry = individuals[s.id] ??= emptyEntry(s.id, players[s.id]?.name ?? s.name, s.teamId);
    if (!entry.totals.matches) entry.totals.matches = s.matches;
    for (const target of [entry, (teams[s.teamId] ??= emptyEntry(s.teamId, s.teamId, s.teamId))]) {
      target.fieldingRecorded = true;
      target.catches += s.catches ?? 0; target.stumpings += s.stumpings ?? 0; target.runOuts += s.runOuts ?? 0;
    }
  }
  return { players: Object.values(individuals), teams: Object.values(teams), scoredMatches, detailedMatches };
}

export function rankSeasonEntries(entries: SeasonRankingEntry[], metric: SeasonRankingMetric, qualifiedOnly = true) {
  return entries.flatMap(entry => {
    const value = metric.value(entry);
    const qualified = metric.qualifies(entry);
    return value === null || !Number.isFinite(value) || (qualifiedOnly && !qualified) ? [] : [{ entry, value, qualified }];
  }).sort((a, b) => (metric.lowerBetter ? a.value - b.value : b.value - a.value) || a.entry.name.localeCompare(b.entry.name));
}
