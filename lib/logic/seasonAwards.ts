import type { Player } from "@/lib/types";
import type { MatchSimulationRecord } from "@/lib/logic/matchSimulation";

export const BASE_WICKET_MVP_POINTS = 6;
export const MAIDEN_MVP_POINTS = 5;

export interface AwardSeasonStats {
  id: string;
  name: string;
  teamId: string;
  runs: number;
  balls: number;
  wickets: number;
  runsConceded: number;
  oversBowled: number;
  matches: number;
  fours?: number;
  sixes?: number;
  dotBalls?: number;
  catches?: number;
  stumpings?: number;
  runOuts?: number;
  maidens?: number;
  battingPerformanceBonus?: number;
  bowlingPerformanceBonus?: number;
}

export interface MvpAwardCandidate extends AwardSeasonStats {
  fours: number;
  sixes: number;
  dotBalls: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  maidens: number;
  battingPerformanceBonus: number;
  bowlingPerformanceBonus: number;
  seasonWicketBonus: number;
  battingMvpPoints: number;
  bowlingMvpPoints: number;
  mvpPoints: number;
}

export interface MvpEventStats {
  fours: number;
  sixes: number;
  dotBalls: number;
  catches: number;
  stumpings: number;
  runOuts: number;
}

export interface EmergingAwardCandidate extends AwardSeasonStats {
  ageAtSeasonStart: number;
  iplMatchesAtSeasonStart: number;
  battingImpact: number;
  bowlingImpact: number;
  emergingPoints: number;
}

export function oversToBalls(overs: number): number {
  const completeOvers = Math.floor(Math.max(0, overs));
  const remainingBalls = Math.max(0, Math.min(5, Math.round((overs - completeOvers) * 10)));
  return completeOvers * 6 + remainingBalls;
}

/**
 * Rewards sustained innings rather than adding flat points for every run.
 * Each run above 30 gains 0.25 points, with another 0.25 added after each
 * threshold at 50, 75 and 100. A run beyond 100 is therefore worth 1 point.
 */
export function calculateBattingPerformanceBonus(runs: number): number {
  const inningsRuns = Math.max(0, runs);
  return [30, 50, 75, 100].reduce(
    (bonus, threshold) => bonus + Math.max(0, inningsRuns - threshold) * 0.25,
    0,
  );
}

/**
 * Wickets become increasingly valuable within one innings. This rewards
 * specialist match-winning spells more than occasional one-wicket returns.
 */
export function calculateWicketPerformancePoints(wickets: number): number {
  const wicketCount = Math.max(0, Math.floor(wickets));
  const marginalValues = [BASE_WICKET_MVP_POINTS, 9, 12, 16, 21];
  let points = 0;
  for (let index = 0; index < wicketCount; index++) {
    points += marginalValues[index] ?? 33;
  }
  return points;
}

export function calculateBowlingPerformanceBonus(
  wickets: number,
  overs = 0,
  runsConceded = 0,
  maidens = 0,
): number {
  const wicketCount = Math.max(0, Math.floor(wickets));
  const bowlingBalls = oversToBalls(overs);
  const economy = bowlingBalls > 0 ? runsConceded / (bowlingBalls / 6) : Number.POSITIVE_INFINITY;
  const economyBonus = bowlingBalls >= 18
    ? economy <= 5.5
      ? 10
      : economy <= 6.5
        ? 7
        : economy <= 7.5
          ? 4
          : 0
    : 0;
  return calculateWicketPerformancePoints(wicketCount)
    - wicketCount * BASE_WICKET_MVP_POINTS
    + economyBonus
    + Math.max(0, Math.floor(maidens)) * MAIDEN_MVP_POINTS;
}

export function calculateSeasonWicketBonus(wickets: number): number {
  const wicketCount = Math.max(0, Math.floor(wickets));
  return Math.max(0, wicketCount - 10) * 1.5
    + Math.max(0, wicketCount - 15) * 2
    + Math.max(0, wicketCount - 20) * 3;
}

function emptyMvpEventStats(): MvpEventStats {
  return {
    fours: 0,
    sixes: 0,
    dotBalls: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
  };
}

/** Extract exact MVP events from the canonical ball-by-ball simulation. */
export function extractMvpEventStats(
  simulation: Pick<MatchSimulationRecord, "innings">,
): Record<string, MvpEventStats> {
  const totals: Record<string, MvpEventStats> = {};
  const ensure = (playerId: string) => {
    totals[playerId] ??= emptyMvpEventStats();
    return totals[playerId];
  };

  simulation.innings.forEach((innings) => {
    innings.batting.forEach((entry) => {
      const stats = ensure(entry.id);
      stats.fours += entry.fours;
      stats.sixes += entry.sixes;
    });

    innings.oversDetail.forEach((over) => {
      over.deliveries.forEach((delivery) => {
        if (delivery.isLegal && delivery.totalRuns === 0) {
          ensure(delivery.bowlerId).dotBalls++;
        }
        const wicket = delivery.wicket;
        if (!wicket?.fielderId) return;
        const fieldingStats = ensure(wicket.fielderId);
        if (wicket.kind === "caught") fieldingStats.catches++;
        if (wicket.kind === "stumped") fieldingStats.stumpings++;
        if (wicket.kind === "run-out") fieldingStats.runOuts++;
      });
    });
  });

  return totals;
}

export function calculateMvpPoints(stats: AwardSeasonStats): MvpAwardCandidate {
  const fours = stats.fours ?? Math.floor((stats.runs || 0) * 0.4 / 4);
  const sixes = stats.sixes ?? Math.floor((stats.runs || 0) * 0.2 / 6);
  const bowlingBalls = oversToBalls(stats.oversBowled || 0);
  const dotBalls = stats.dotBalls
    ?? Math.max(0, Math.round(bowlingBalls - (stats.runsConceded || 0) / 1.6));
  const catches = stats.catches ?? 0;
  const stumpings = stats.stumpings ?? 0;
  const runOuts = stats.runOuts ?? 0;
  const maidens = stats.maidens ?? 0;
  const battingPerformanceBonus = stats.battingPerformanceBonus ?? 0;
  const bowlingPerformanceBonus = stats.bowlingPerformanceBonus ?? 0;
  const seasonWicketBonus = calculateSeasonWicketBonus(stats.wickets || 0);
  const battingMvpPoints = (fours * 2.5)
    + (sixes * 3.5)
    + battingPerformanceBonus;
  const bowlingMvpPoints = ((stats.wickets || 0) * BASE_WICKET_MVP_POINTS)
    + dotBalls
    + bowlingPerformanceBonus
    + seasonWicketBonus;
  const fieldingPoints = (catches + stumpings + runOuts) * 2.5;
  const points = Math.max(battingMvpPoints, bowlingMvpPoints)
    + Math.min(battingMvpPoints, bowlingMvpPoints) * 0.65
    + fieldingPoints;

  return {
    ...stats,
    fours,
    sixes,
    dotBalls,
    catches,
    stumpings,
    runOuts,
    maidens,
    battingPerformanceBonus,
    bowlingPerformanceBonus,
    seasonWicketBonus,
    battingMvpPoints,
    bowlingMvpPoints,
    mvpPoints: Math.round(points * 10) / 10,
  };
}

export function rankMvpCandidates(stats: AwardSeasonStats[]): MvpAwardCandidate[] {
  return stats
    .map(calculateMvpPoints)
    .filter((candidate) => candidate.mvpPoints > 0)
    .sort((left, right) => (
      right.mvpPoints - left.mvpPoints
      || right.runs - left.runs
      || right.wickets - left.wickets
      || left.name.localeCompare(right.name)
    ));
}

export function normalizeAwardWinnerName(name: string): string {
  return name.toLocaleLowerCase("en-GB").replace(/[^a-z0-9]/g, "");
}

export interface EmergingPlayerEligibility {
  eligible: boolean;
  ageAtSeasonStart: number;
  iplMatchesAtSeasonStart: number;
}

function emergingPlayerEligibilityAgainstSet({
  player,
  season,
  initialSeason,
  seasonMatches,
  previousWinners,
}: {
  player: Player;
  season: number;
  initialSeason: number;
  seasonMatches: number;
  previousWinners: ReadonlySet<string>;
}): EmergingPlayerEligibility {
  const ageAtSeasonStart = player.careerState?.lastAgedSeason === season
    ? player.age
    : player.age + Math.max(0, season - initialSeason);
  const iplMatchesAtSeasonStart = Math.max(
    0,
    (player.iplStats?.matches ?? 0) - Math.max(0, seasonMatches),
  );
  const eligible = !player.isCapped
    && ageAtSeasonStart <= 25
    && iplMatchesAtSeasonStart < 25
    && !previousWinners.has(normalizeAwardWinnerName(player.name));
  return { eligible, ageAtSeasonStart, iplMatchesAtSeasonStart };
}

/** Shared eligibility rule used by both award ranking and future intake planning. */
export function getEmergingPlayerEligibility({
  player,
  season,
  initialSeason,
  seasonMatches = 0,
  previousWinnerNames,
}: {
  player: Player;
  season: number;
  initialSeason: number;
  seasonMatches?: number;
  previousWinnerNames: Iterable<string>;
}): EmergingPlayerEligibility {
  return emergingPlayerEligibilityAgainstSet({
    player,
    season,
    initialSeason,
    seasonMatches,
    previousWinners: new Set(Array.from(previousWinnerNames, normalizeAwardWinnerName)),
  });
}

export function rankEmergingPlayerCandidates({
  stats,
  players,
  season,
  initialSeason,
  previousWinnerNames,
}: {
  stats: AwardSeasonStats[];
  players: Record<string, Player>;
  season: number;
  initialSeason: number;
  previousWinnerNames: Iterable<string>;
}): EmergingAwardCandidate[] {
  const previousWinners = new Set(
    Array.from(previousWinnerNames, normalizeAwardWinnerName),
  );

  return stats.flatMap((seasonStats) => {
    const player = players[seasonStats.id];
    if (!player || seasonStats.matches <= 0) return [];
    const { eligible, ageAtSeasonStart, iplMatchesAtSeasonStart } = emergingPlayerEligibilityAgainstSet({
      player,
      season,
      initialSeason,
      seasonMatches: seasonStats.matches,
      previousWinners,
    });
    if (!eligible) return [];

    const strikeRate = seasonStats.balls > 0
      ? seasonStats.runs * 100 / seasonStats.balls
      : 0;
    const battingRateFactor = seasonStats.balls >= 20
      ? Math.max(0.82, Math.min(1.18, 1 + (strikeRate - 135) / 300))
      : 1;
    const battingImpact = seasonStats.runs * battingRateFactor;

    const bowlingBalls = oversToBalls(seasonStats.oversBowled);
    const bowlingOvers = bowlingBalls / 6;
    const economy = bowlingOvers > 0
      ? seasonStats.runsConceded / bowlingOvers
      : 0;
    const economyImpact = bowlingOvers >= 4
      ? Math.max(-35, Math.min(70, (8.5 - economy) * bowlingOvers * 2.2))
      : 0;
    const dotBalls = seasonStats.dotBalls
      ?? Math.max(0, Math.round(bowlingBalls - seasonStats.runsConceded / 1.6));
    const bowlingImpact = Math.max(0, seasonStats.wickets * 22 + dotBalls * 0.35 + economyImpact);
    const fieldingImpact = ((seasonStats.catches ?? 0) * 4) + ((seasonStats.stumpings ?? 0) * 5);

    // Public/commentator voting is represented by a small breakout bonus. The
    // actual season performance remains at least 90% of a competitive score.
    const primaryImpact = Math.max(battingImpact, bowlingImpact);
    const secondaryImpact = Math.min(battingImpact, bowlingImpact);
    const performancePoints = primaryImpact + secondaryImpact * 0.6 + fieldingImpact;
    const breakoutVoteBonus = Math.max(0, 25 - iplMatchesAtSeasonStart) * 0.7
      + Math.max(0, 25 - ageAtSeasonStart) * 1.2;
    const emergingPoints = Math.round((performancePoints + breakoutVoteBonus) * 10) / 10;

    return [{
      ...seasonStats,
      ageAtSeasonStart,
      iplMatchesAtSeasonStart,
      battingImpact: Math.round(battingImpact * 10) / 10,
      bowlingImpact: Math.round(bowlingImpact * 10) / 10,
      emergingPoints,
    }];
  }).sort((left, right) => (
    right.emergingPoints - left.emergingPoints
    || right.matches - left.matches
    || right.runs - left.runs
    || right.wickets - left.wickets
    || left.name.localeCompare(right.name)
  ));
}
