import type { MatchSimulationRecord } from "@/lib/logic/matchSimulation";
import type { CareerStats, IPLStats, Player } from "@/lib/types";

export interface IplCareerMatchUpdate {
  key: string;
  simulation: MatchSimulationRecord;
}

interface MatchContribution {
  matches: number;
  runs: number;
  balls: number;
  dismissals: number;
  battingInnings: number;
  fifties: number;
  hundreds: number;
  bowlingInnings: number;
  bowlingBalls: number;
  bowlingRunsConceded: number;
  wickets: number;
  bestBowlingWickets: number;
  bestBowlingRuns: number;
}

function emptyContribution(): MatchContribution {
  return {
    matches: 0,
    runs: 0,
    balls: 0,
    dismissals: 0,
    battingInnings: 0,
    fifties: 0,
    hundreds: 0,
    bowlingInnings: 0,
    bowlingBalls: 0,
    bowlingRunsConceded: 0,
    wickets: 0,
    bestBowlingWickets: 0,
    bestBowlingRuns: Number.POSITIVE_INFINITY,
  };
}

function historicalBattingBalls(stats: IPLStats): number {
  if (typeof stats.battingBalls === "number") return stats.battingBalls;
  return stats.runs > 0 && stats.strikeRate > 0
    ? Math.max(1, Math.round(stats.runs * 100 / stats.strikeRate))
    : 0;
}

function historicalDismissals(stats: IPLStats): number {
  if (typeof stats.battingDismissals === "number") return stats.battingDismissals;
  return stats.runs > 0 && stats.battingAverage > 0
    ? Math.max(1, Math.round(stats.runs / stats.battingAverage))
    : 0;
}

function historicalBowlingRuns(stats: IPLStats): number {
  if (typeof stats.bowlingRunsConceded === "number") return stats.bowlingRunsConceded;
  return stats.wickets > 0 && stats.bowlingAverage > 0
    ? Math.max(0, Math.round(stats.wickets * stats.bowlingAverage))
    : 0;
}

function applyContribution(stats: IPLStats, contribution: MatchContribution): IPLStats {
  const runs = stats.runs + contribution.runs;
  const battingBalls = historicalBattingBalls(stats) + contribution.balls;
  const battingDismissals = historicalDismissals(stats) + contribution.dismissals;
  const wickets = stats.wickets + contribution.wickets;
  const bowlingRunsConceded = historicalBowlingRuns(stats) + contribution.bowlingRunsConceded;
  const bowlingBalls = (stats.bowlingBalls ?? 0) + contribution.bowlingBalls;

  return {
    ...stats,
    matches: stats.matches + contribution.matches,
    runs,
    battingAverage: battingDismissals > 0 ? runs / battingDismissals : runs,
    strikeRate: battingBalls > 0 ? runs * 100 / battingBalls : 0,
    bowlingInnings: stats.bowlingInnings + contribution.bowlingInnings,
    bowlingAverage: wickets > 0 ? bowlingRunsConceded / wickets : 0,
    wickets,
    battingBalls,
    battingDismissals,
    bowlingBalls,
    bowlingRunsConceded,
  };
}

function historicalT20BattingBalls(stats: CareerStats): number {
  if (typeof stats.batting.balls === "number") return stats.batting.balls;
  return stats.batting.runs > 0 && stats.batting.strikeRate > 0
    ? Math.max(1, Math.round(stats.batting.runs * 100 / stats.batting.strikeRate))
    : 0;
}

function historicalT20Dismissals(stats: CareerStats): number {
  if (typeof stats.batting.dismissals === "number") return stats.batting.dismissals;
  return stats.batting.runs > 0 && stats.batting.average > 0
    ? Math.max(1, Math.round(stats.batting.runs / stats.batting.average))
    : 0;
}

function historicalT20BowlingRuns(stats: CareerStats): number {
  if (typeof stats.bowling.runsConceded === "number") return stats.bowling.runsConceded;
  return stats.bowling.wickets > 0 && stats.bowling.average > 0
    ? Math.max(0, Math.round(stats.bowling.wickets * stats.bowling.average))
    : 0;
}

function historicalT20BowlingBalls(stats: CareerStats, runsConceded: number): number {
  if (typeof stats.bowling.balls === "number") return stats.bowling.balls;
  return runsConceded > 0 && stats.bowling.economy > 0
    ? Math.max(1, Math.round(runsConceded * 6 / stats.bowling.economy))
    : 0;
}

function parseBestFigures(figures: string): { wickets: number; runs: number } {
  const match = figures.match(/(\d+)\s*\/\s*(\d+)/);
  return match
    ? { wickets: Number(match[1]), runs: Number(match[2]) }
    : { wickets: 0, runs: Number.POSITIVE_INFINITY };
}

function isBetterBowlingFigures(
  candidateWickets: number,
  candidateRuns: number,
  currentWickets: number,
  currentRuns: number,
): boolean {
  return candidateWickets > currentWickets
    || (candidateWickets === currentWickets && candidateWickets > 0 && candidateRuns < currentRuns);
}

function applyT20Contribution(stats: CareerStats, contribution: MatchContribution): CareerStats {
  const runs = stats.batting.runs + contribution.runs;
  const battingBalls = historicalT20BattingBalls(stats) + contribution.balls;
  const dismissals = historicalT20Dismissals(stats) + contribution.dismissals;
  const wickets = stats.bowling.wickets + contribution.wickets;
  const historicalRunsConceded = historicalT20BowlingRuns(stats);
  const bowlingRunsConceded = historicalRunsConceded + contribution.bowlingRunsConceded;
  const bowlingBalls = historicalT20BowlingBalls(stats, historicalRunsConceded)
    + contribution.bowlingBalls;
  const existingBest = parseBestFigures(stats.bowling.bestFigures);
  const hasNewBest = isBetterBowlingFigures(
    contribution.bestBowlingWickets,
    contribution.bestBowlingRuns,
    existingBest.wickets,
    existingBest.runs,
  );

  return {
    batting: {
      ...stats.batting,
      matches: stats.batting.matches + contribution.matches,
      innings: stats.batting.innings + contribution.battingInnings,
      runs,
      average: dismissals > 0 ? runs / dismissals : runs,
      strikeRate: battingBalls > 0 ? runs * 100 / battingBalls : 0,
      fifties: stats.batting.fifties + contribution.fifties,
      hundreds: stats.batting.hundreds + contribution.hundreds,
      balls: battingBalls,
      dismissals,
    },
    bowling: {
      ...stats.bowling,
      matches: stats.bowling.matches + contribution.bowlingInnings,
      wickets,
      economy: bowlingBalls > 0 ? bowlingRunsConceded / (bowlingBalls / 6) : 0,
      average: wickets > 0 ? bowlingRunsConceded / wickets : 0,
      bestFigures: hasNewBest
        ? `${contribution.bestBowlingWickets}/${contribution.bestBowlingRuns}`
        : stats.bowling.bestFigures,
      balls: bowlingBalls,
      runsConceded: bowlingRunsConceded,
    },
  };
}

function collectMatchContributions(simulation: MatchSimulationRecord): Map<string, MatchContribution> {
  const contributions = new Map<string, MatchContribution>();
  const contributionFor = (playerId: string) => {
    const existing = contributions.get(playerId) ?? emptyContribution();
    contributions.set(playerId, existing);
    return existing;
  };

  Object.values(simulation.lineups).forEach((lineup) => {
    new Set([...lineup.startingXI, ...lineup.finalXI]).forEach((playerId) => {
      contributionFor(playerId).matches = 1;
    });
  });

  simulation.innings.forEach((innings) => {
    innings.batting.forEach((entry) => {
      if (entry.didNotBat) return;
      const contribution = contributionFor(entry.id);
      contribution.battingInnings += 1;
      contribution.runs += entry.runs;
      contribution.balls += entry.balls;
      contribution.dismissals += Number(!entry.notOut);
      contribution.hundreds += Number(entry.runs >= 100);
      contribution.fifties += Number(entry.runs >= 50 && entry.runs < 100);
    });
    innings.bowling.forEach((entry) => {
      if (entry.balls <= 0 && entry.runsConceded <= 0 && entry.wickets <= 0) return;
      const contribution = contributionFor(entry.id);
      contribution.bowlingInnings += 1;
      contribution.bowlingBalls += entry.balls;
      contribution.bowlingRunsConceded += entry.runsConceded;
      contribution.wickets += entry.wickets;
      if (isBetterBowlingFigures(
        entry.wickets,
        entry.runsConceded,
        contribution.bestBowlingWickets,
        contribution.bestBowlingRuns,
      )) {
        contribution.bestBowlingWickets = entry.wickets;
        contribution.bestBowlingRuns = entry.runsConceded;
      }
    });
  });
  return contributions;
}

export function applyMatchToIplCareerStats(
  players: Record<string, Player>,
  simulation: MatchSimulationRecord,
): Record<string, Player> {
  const contributions = collectMatchContributions(simulation);

  if (contributions.size === 0) return players;
  const updatedPlayers = { ...players };
  contributions.forEach((contribution, playerId) => {
    const player = players[playerId];
    if (!player) return;
    updatedPlayers[playerId] = {
      ...player,
      iplStats: applyContribution(player.iplStats, contribution),
    };
  });
  return updatedPlayers;
}

export function applyMatchToT20CareerStats(
  players: Record<string, Player>,
  simulation: MatchSimulationRecord,
): Record<string, Player> {
  const contributions = collectMatchContributions(simulation);
  if (contributions.size === 0) return players;
  const updatedPlayers = { ...players };
  contributions.forEach((contribution, playerId) => {
    const player = players[playerId];
    if (!player) return;
    updatedPlayers[playerId] = {
      ...player,
      careerStats: applyT20Contribution(player.careerStats, contribution),
    };
  });
  return updatedPlayers;
}
