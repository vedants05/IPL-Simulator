import type { Player } from "../types";
import type { PlayerAnalysisFixture, PlayerAnalysisTotals } from "./playerAnalysisMetrics";

export type PlayerDashboardStructure = "bowling" | "bowling-with-batting" | "balanced" | "batting-with-bowling" | "batting";

export type PlayerMatchPerformance = {
  id: string; date: string; label: string; rank: number; opponentTeamId?: string;
  runs: number; balls: number; wickets: number; conceded: number; notOut: boolean;
};

export function playerMatchPerformances(fixtures: readonly PlayerAnalysisFixture[], playerId: string, bowling: boolean): PlayerMatchPerformance[] {
  const entries = fixtures.flatMap((fixture) => {
    if (!fixture.played) return [];
    const innings = fixture.simulation?.innings ?? (fixture.scorecard ? [fixture.scorecard.inningsA, fixture.scorecard.inningsB] : []);
    return innings.flatMap((innings, index): PlayerMatchPerformance[] => {
      const batter = innings.batting.find((entry) => entry.id === playerId);
      const bowler = innings.bowling.find((entry) => entry.id === playerId);
      const balls = bowling ? bowler?.balls ?? (Math.floor(bowler?.overs ?? 0) * 6 + Math.round(((bowler?.overs ?? 0) % 1) * 10)) : batter?.balls ?? 0;
      const runs = batter?.runs ?? 0;
      if (bowling ? !bowler || balls === 0 : !batter || ("didNotBat" in batter && batter.didNotBat) || (balls === 0 && runs === 0)) return [];
      const notOut = batter ? "notOut" in batter ? batter.notOut === true : batter.dismissal?.trim().toLowerCase() === "not out" : false;
      const wickets = bowler?.wickets ?? 0, conceded = bowler?.runsConceded ?? 0;
      const overs = `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ""}`;
      const opponentTeamId = bowling
        ? "battingTeamId" in innings && typeof innings.battingTeamId === "string" ? innings.battingTeamId : index === 0 ? fixture.teamA : fixture.teamB
        : "bowlingTeamId" in innings && typeof innings.bowlingTeamId === "string" ? innings.bowlingTeamId : index === 0 ? fixture.teamB : fixture.teamA;
      return [{ id: `${fixture.id}:${index}`, date: fixture.date ?? "", runs, balls, wickets, conceded, notOut, rank: 0, opponentTeamId,
        label: bowling ? `${wickets}/${conceded} (${overs})` : `${runs}${notOut ? "*" : ""}(${balls})` }];
    });
  }).sort((a, b) => a.date.localeCompare(b.date)).slice(-10);
  const compare = (a: PlayerMatchPerformance, b: PlayerMatchPerformance) => bowling
    ? b.wickets - a.wickets || a.conceded / a.balls - b.conceded / b.balls || a.conceded - b.conceded
    : b.runs - a.runs || a.balls - b.balls || Number(b.notOut) - Number(a.notOut);
  const ranked = [...entries].sort(compare);
  ranked.forEach((entry, index) => { entry.rank = index > 0 && compare(entry, ranked[index - 1]) === 0 ? ranked[index - 1].rank : index + 1; });
  return entries;
}

export function performanceBarColour(rank: number, worstRank: number): string {
  const quality = worstRank <= 1 ? 1 : Math.max(0, Math.min(1, (worstRank - rank) / (worstRank - 1)));
  const red = [239, 68, 68], amber = [245, 158, 11], green = [34, 197, 94];
  const start = quality <= 0.5 ? red : amber, end = quality <= 0.5 ? amber : green;
  const fraction = quality <= 0.5 ? quality * 2 : (quality - 0.5) * 2;
  return `rgb(${start.map((value, index) => Math.round(value + (end[index] - value) * fraction)).join(", ")})`;
}

export function playerDashboardStructure(
  player: Player,
  stats: PlayerAnalysisTotals,
  fixtures: readonly PlayerAnalysisFixture[],
): PlayerDashboardStructure {
  const battingScores = fixtures.flatMap((fixture) => {
    if (!fixture.played) return [];
    const innings = fixture.simulation?.innings ?? (fixture.scorecard ? [fixture.scorecard.inningsA, fixture.scorecard.inningsB] : []);
    return innings.flatMap((entry) => entry.batting.filter((batter) => batter.id === player.id && ((batter.balls ?? 0) > 0 || (batter.runs ?? 0) > 0)).map((batter) => batter.runs ?? 0));
  });
  const meaningfulBatting = battingScores.some((runs) => runs >= 20) || battingScores.filter((runs) => runs >= 10).length >= 2;
  const meaningfulBowling = stats.bowlBalls >= 18;
  const listedBowler = player.role === "Pace Bowler" || player.role === "Spin Bowler";
  const listedBatter = player.role === "Batsman" || player.role === "WK-Batsman";
  const regularBatting = meaningfulBatting && stats.innings >= 2 && stats.balls >= Math.max(24, stats.matches * 8);
  const regularBowling = stats.bowlingInnings >= 2 && stats.bowlBalls >= Math.max(24, stats.matches * 12);

  if (listedBowler) return regularBatting ? "balanced" : meaningfulBatting ? "bowling-with-batting" : "bowling";
  if (listedBatter) return regularBowling ? "balanced" : meaningfulBowling ? "batting-with-bowling" : "batting";
  if (regularBatting && regularBowling) return "balanced";
  if (regularBowling) return meaningfulBatting ? "bowling-with-batting" : "bowling";
  if (regularBatting) return meaningfulBowling ? "batting-with-bowling" : "batting";
  if (meaningfulBatting && meaningfulBowling) return "balanced";
  if (meaningfulBatting) return "batting";
  if (meaningfulBowling) return "bowling";
  return "balanced";
}
