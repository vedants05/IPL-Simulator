import type { Player } from "@/lib/types";

export type OffseasonCompetitionLevel = "International" | "Domestic" | "International + Domestic";

export interface OffseasonPlayerStats {
  playerId: string;
  playerName: string;
  nationality: Player["nationality"];
  country: string;
  teamId: string | null;
  competitionLevel: OffseasonCompetitionLevel;
  selectionStatus: string;
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  notOuts: number;
  highestScore: number;
  bowlingInnings: number;
  bowlingBalls: number;
  runsConceded: number;
  wickets: number;
  bestBowlingWickets: number;
  bestBowlingRuns: number;
}

export interface OffseasonStatsPeriod {
  generatorVersion: number;
  fromSeason: number;
  toSeason: number;
  generatedAt: string;
  players: Record<string, OffseasonPlayerStats>;
}

interface SeasonPerformance {
  matches?: number;
  runs?: number;
  balls?: number;
  wickets?: number;
  runsConceded?: number;
  oversBowled?: number;
}

interface Candidate {
  player: Player;
  score: number;
  group: "BAT" | "WK" | "AR" | "PACE" | "SPIN";
}

function randomFor(seed: string): () => number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const integerAround = (random: () => number, average: number, spread: number, minimum = 0, maximum = 20) => (
  Math.round(clamp(average + (random() + random() - 1) * spread, minimum, maximum))
);

function roleGroup(player: Player): Candidate["group"] {
  if (player.role === "WK-Batsman" || player.isWicketkeeper) return "WK";
  if (player.role === "All-Rounder") return "AR";
  if (player.role === "Pace Bowler") return "PACE";
  if (player.role === "Spin Bowler") return "SPIN";
  return "BAT";
}

function ageReadiness(age: number): number {
  if (age <= 20) return 0.88;
  if (age <= 25) return 1;
  if (age <= 32) return 0.97;
  if (age <= 35) return 0.9;
  return 0.8;
}

function selectionScore(player: Player, performance: SeasonPerformance | undefined): number {
  const ability = Math.max(player.currentBatting, player.currentBowling);
  const battingImpact = clamp((performance?.runs ?? 0) / 500, 0, 1);
  const bowlingImpact = clamp((performance?.wickets ?? 0) / 24, 0, 1);
  const form = Math.max(battingImpact, bowlingImpact);
  const reputation = clamp(player.reputation ?? 5, 1, 10) * 10;
  const potential = Math.max(player.potentialBatting, player.potentialBowling);
  return ability * 0.45 + form * 20 + reputation * 0.15 + potential * 0.1 + ageReadiness(player.age) * 10;
}

function chooseIndiaSquad(players: Player[], performance: Record<string, SeasonPerformance>, injuredPlayerIds: Set<string>): Map<string, number> {
  const candidates: Candidate[] = players
    .filter((player) => player.nationality === "Indian" && !injuredPlayerIds.has(player.id))
    .map((player) => ({ player, group: roleGroup(player), score: selectionScore(player, performance[player.id]) }))
    .filter(({ player, score }) => player.isCapped || score >= 68)
    .sort((left, right) => right.score - left.score || left.player.id.localeCompare(right.player.id));
  const quotas: Record<Candidate["group"], number> = { BAT: 4, WK: 2, AR: 3, PACE: 4, SPIN: 2 };
  const selected: Candidate[] = [];
  (Object.keys(quotas) as Candidate["group"][]).forEach((group) => {
    selected.push(...candidates.filter((candidate) => candidate.group === group).slice(0, quotas[group]));
  });
  if (selected.length < 21) {
    const selectedIds = new Set(selected.map(({ player }) => player.id));
    selected.push(...candidates.filter(({ player }) => !selectedIds.has(player.id)).slice(0, 21 - selected.length));
  }
  return new Map(selected
    .slice(0, 21)
    .sort((left, right) => right.score - left.score || left.player.id.localeCompare(right.player.id))
    .map(({ player }, index) => [player.id, index]));
}

function battingPosition(player: Player): number {
  if (player.isOpener) return 1;
  if (player.hasBattedAt3) return 3;
  if (player.hasBattedAt4 || player.isCoreBatter) return 4;
  if (player.hasBattedAt5) return 5;
  if (player.hasBattedAt6 || player.isFinisher) return 6;
  if (player.hasBattedAt7 || player.role === "All-Rounder") return 7;
  if (player.role === "Batsman" || player.role === "WK-Batsman") return 3;
  return player.role === "Pace Bowler" || player.role === "Spin Bowler" ? 9 : 7;
}

const averageBallsByPosition = [24, 24, 21, 17, 14, 11, 8, 6, 4, 3, 2];

function generatePlayerStats(input: {
  player: Player;
  matches: number;
  competitionLevel: OffseasonCompetitionLevel;
  selectionStatus: string;
  seed: string;
}): OffseasonPlayerStats {
  const { player, matches, competitionLevel, selectionStatus } = input;
  const random = randomFor(`${input.seed}:${player.id}`);
  const position = battingPosition(player);
  const internationalShare = competitionLevel === "International" ? 1 : competitionLevel === "International + Domestic" ? 0.65 : 0;
  const difficulty = 1 + internationalShare * 0.08;
  const form = (random() + random() + random() - 1.5) * 0.12;
  let innings = 0;
  let runs = 0;
  let balls = 0;
  let notOuts = 0;
  let highestScore = 0;
  let bowlingBalls = 0;
  let bowlingInnings = 0;
  let runsConceded = 0;
  let wickets = 0;
  let bestBowlingWickets = 0;
  let bestBowlingRuns = 0;

  for (let match = 0; match < matches; match += 1) {
    const bats = random() < (position <= 6 ? 0.97 : clamp(0.88 - (position - 7) * 0.1, 0.48, 0.88));
    if (bats) {
      innings += 1;
      const meanBalls = averageBallsByPosition[position - 1];
      const dismissalProbability = clamp((1 / meanBalls) * difficulty * (1 - (player.currentBatting - 70) * 0.008 - form), 0.012, 0.42);
      const availableBalls = integerAround(random, meanBalls * 1.8, meanBalls * 1.5, 1, 75);
      let faced = 0;
      let dismissed = false;
      while (faced < availableBalls) {
        faced += 1;
        if (random() < dismissalProbability) { dismissed = true; break; }
      }
      const aggression = clamp(player.battingAggression ?? (player.isFinisher ? 78 : 62), 25, 95);
      const expectedStrikeRate = clamp(82 + player.currentBatting * 0.62 + aggression * 0.22 + form * 100 - internationalShare * 7, 75, 205);
      const inningsNoise = clamp(0.58 + random() * 0.84, 0.45, 1.5);
      const scored = Math.max(0, Math.round(faced * expectedStrikeRate / 100 * inningsNoise - (faced <= 2 ? random() * 2 : 0)));
      balls += faced;
      runs += scored;
      highestScore = Math.max(highestScore, scored);
      if (!dismissed) notOuts += 1;
    }

    const bowlingAverage = player.role === "Pace Bowler" || player.role === "Spin Bowler"
      ? 20.4
      : player.role === "All-Rounder" ? 16.8 : player.bowlingStyle ? 4.2 : 0;
    let spellBalls = 0;
    if (bowlingAverage > 0 && random() < clamp(bowlingAverage / 23, 0.14, 0.96)) {
      spellBalls = integerAround(random, bowlingAverage, 13, 1, 24);
    }
    bowlingBalls += spellBalls;
    if (spellBalls > 0) {
      bowlingInnings += 1;
      const expectedEconomy = clamp(11.1 - player.currentBowling * 0.045 + internationalShare * 0.45 - form * 8, 4.7, 13.5);
      const conceded = Math.max(0, Math.round(spellBalls / 6 * expectedEconomy * clamp(0.62 + random() * 0.78, 0.45, 1.55)));
      const wicketProbability = clamp(0.03 + (player.currentBowling - 45) * 0.0011 + form * 0.08 - internationalShare * 0.004, 0.008, 0.09);
      let spellWickets = 0;
      for (let ball = 0; ball < spellBalls; ball += 1) if (random() < wicketProbability) spellWickets += 1;
      spellWickets = Math.min(10, spellWickets);
      runsConceded += conceded;
      wickets += spellWickets;
      if (spellWickets > bestBowlingWickets || (spellWickets === bestBowlingWickets && (bestBowlingRuns === 0 || conceded < bestBowlingRuns))) {
        bestBowlingWickets = spellWickets;
        bestBowlingRuns = conceded;
      }
    }
  }

  return {
    playerId: player.id,
    playerName: player.name,
    nationality: player.nationality,
    country: player.country ?? (player.nationality === "Indian" ? "India" : "Overseas"),
    teamId: player.currentTeamId,
    competitionLevel,
    selectionStatus,
    matches,
    innings,
    runs,
    balls,
    notOuts,
    highestScore,
    bowlingInnings,
    bowlingBalls,
    runsConceded,
    wickets,
    bestBowlingWickets,
    bestBowlingRuns,
  };
}

export function generateOffseasonStats(input: {
  players: Record<string, Player>;
  performance: Record<string, SeasonPerformance>;
  completedSeason: number;
  seed: string;
  injuredPlayerIds?: Set<string>;
}): { period: OffseasonStatsPeriod; players: Record<string, Player> } {
  const indiaSquad = chooseIndiaSquad(Object.values(input.players), input.performance, input.injuredPlayerIds ?? new Set());
  const indiaScheduleRandom = randomFor(`${input.seed}:${input.completedSeason}:india-schedule`);
  const indiaMatches = integerAround(indiaScheduleRandom, 12.5, 2.5, 10, 15);
  const indiaAppearances = new Map<string, number>();
  Array.from(indiaSquad.entries()).forEach(([playerId, rank]) => {
    indiaAppearances.set(playerId, Math.min(indiaMatches, rank < 11 ? 5 : rank < 16 ? 2 : 1));
  });
  let appearancesRemaining = indiaMatches * 11 - Array.from(indiaAppearances.values()).reduce((sum, value) => sum + value, 0);
  while (appearancesRemaining > 0) {
    const available = Array.from(indiaSquad.entries()).filter(([playerId]) => (indiaAppearances.get(playerId) ?? 0) < indiaMatches);
    if (available.length === 0) break;
    const weighted = available.map(([playerId, rank]) => ({ playerId, weight: rank < 11 ? 1 : rank < 16 ? 0.48 : 0.22 }));
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    let roll = indiaScheduleRandom() * totalWeight;
    const selected = weighted.find((item) => ((roll -= item.weight) <= 0)) ?? weighted[weighted.length - 1];
    indiaAppearances.set(selected.playerId, (indiaAppearances.get(selected.playerId) ?? 0) + 1);
    appearancesRemaining -= 1;
  }
  const updatedPlayers = { ...input.players };
  const stats: Record<string, OffseasonPlayerStats> = {};

  Object.values(input.players).forEach((originalPlayer) => {
    let player = originalPlayer;
    const random = randomFor(`${input.seed}:${input.completedSeason}:opportunity:${player.id}`);
    const score = selectionScore(player, input.performance[player.id]);
    const injured = input.injuredPlayerIds?.has(player.id) ?? false;
    let competitionLevel: OffseasonCompetitionLevel = "Domestic";
    let selectionStatus = "Domestic regular";
    let averageMatches = 7;
    let spread = 4;

    if (player.nationality === "Indian" && indiaSquad.has(player.id)) {
      const squadRank = indiaSquad.get(player.id)!;
      const internationalRegular = squadRank < 11;
      const rotationPlayer = squadRank >= 11 && squadRank < 16;
      competitionLevel = internationalRegular ? "International" : "International + Domestic";
      selectionStatus = internationalRegular ? "India regular" : rotationPlayer ? "India rotation" : "India reserve";
      averageMatches = internationalRegular ? 10 : rotationPlayer ? 6 : 2;
      spread = 4;
      if (!player.isCapped) {
        player = {
          ...player,
          isCapped: true,
          internationalDebutSeason: player.internationalDebutSeason ?? input.completedSeason,
          internationalDebutCountry: player.internationalDebutCountry ?? "India",
        };
        updatedPlayers[player.id] = player;
      }
    } else if (player.nationality === "Indian") {
      selectionStatus = score >= 72 ? "Established domestic" : player.age <= 23 ? "Young prospect" : "Domestic fringe";
      averageMatches = score >= 72 ? 8 : player.age <= 23 ? 6 : 4;
    } else if (player.isCapped && score >= 77) {
      competitionLevel = "International";
      selectionStatus = "International regular";
      averageMatches = 10;
    } else if (player.isCapped && score >= 68) {
      competitionLevel = "International + Domestic";
      selectionStatus = "International rotation";
      averageMatches = 7;
    } else {
      competitionLevel = "Domestic";
      selectionStatus = score >= 65 ? "Franchise regular" : "Franchise fringe";
      averageMatches = score >= 65 ? 8 : 4;
    }

    const matches = injured ? 0 : player.nationality === "Indian" && indiaSquad.has(player.id)
      ? indiaAppearances.get(player.id) ?? 0
      : integerAround(random, averageMatches, spread, 0, 14);
    stats[player.id] = generatePlayerStats({
      player,
      matches,
      competitionLevel,
      selectionStatus: injured ? "Injured / unavailable" : selectionStatus,
      seed: `${input.seed}:${input.completedSeason}:offseason`,
    });
  });

  return {
    players: updatedPlayers,
    period: {
      generatorVersion: 4,
      fromSeason: input.completedSeason,
      toSeason: input.completedSeason + 1,
      generatedAt: `${input.completedSeason}-06-01`,
      players: stats,
    },
  };
}

export const offseasonBattingAverage = (stats: OffseasonPlayerStats) => {
  const dismissals = stats.innings - stats.notOuts;
  return dismissals > 0 ? stats.runs / dismissals : null;
};

export const offseasonBattingStrikeRate = (stats: OffseasonPlayerStats) => stats.balls > 0 ? stats.runs * 100 / stats.balls : null;
export const offseasonBowlingAverage = (stats: OffseasonPlayerStats) => stats.wickets > 0 ? stats.runsConceded / stats.wickets : null;
export const offseasonBowlingEconomy = (stats: OffseasonPlayerStats) => stats.bowlingBalls > 0 ? stats.runsConceded * 6 / stats.bowlingBalls : null;
export const offseasonBowlingStrikeRate = (stats: OffseasonPlayerStats) => stats.wickets > 0 ? stats.bowlingBalls / stats.wickets : null;
export const offseasonOvers = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

function inferredBattingBalls(player: Player): number {
  const stats = player.careerStats.batting;
  return stats.balls ?? (stats.runs > 0 && stats.strikeRate > 0 ? Math.max(1, Math.round(stats.runs * 100 / stats.strikeRate)) : 0);
}

function inferredDismissals(player: Player): number {
  const stats = player.careerStats.batting;
  return stats.dismissals ?? (stats.runs > 0 && stats.average > 0 ? Math.max(1, Math.round(stats.runs / stats.average)) : 0);
}

function inferredBowlingRuns(player: Player): number {
  const stats = player.careerStats.bowling;
  return stats.runsConceded ?? (stats.wickets > 0 && stats.average > 0 ? Math.max(0, Math.round(stats.wickets * stats.average)) : 0);
}

function inferredBowlingBalls(player: Player, runsConceded: number): number {
  const stats = player.careerStats.bowling;
  return stats.balls ?? (runsConceded > 0 && stats.economy > 0 ? Math.max(1, Math.round(runsConceded * 6 / stats.economy)) : 0);
}

function parsedBestFigures(figures: string): { wickets: number; runs: number } {
  const match = figures.match(/(\d+)\s*\/\s*(\d+)/);
  return match ? { wickets: Number(match[1]), runs: Number(match[2]) } : { wickets: 0, runs: Number.POSITIVE_INFINITY };
}

export function offseasonPeriodKey(period: OffseasonStatsPeriod): string {
  return `offseason-t20:${period.fromSeason}:${period.toSeason}:v${period.generatorVersion}`;
}

export function applyOffseasonStatsToCareer(players: Record<string, Player>, period: OffseasonStatsPeriod): Record<string, Player> {
  const updated = { ...players };
  Object.values(period.players).forEach((row) => {
    const player = updated[row.playerId];
    if (!player || row.matches <= 0) return;
    const battingBalls = inferredBattingBalls(player) + row.balls;
    const dismissals = inferredDismissals(player) + row.innings - row.notOuts;
    const runs = player.careerStats.batting.runs + row.runs;
    const priorBowlingRuns = inferredBowlingRuns(player);
    const bowlingRuns = priorBowlingRuns + row.runsConceded;
    const bowlingBalls = inferredBowlingBalls(player, priorBowlingRuns) + row.bowlingBalls;
    const wickets = player.careerStats.bowling.wickets + row.wickets;
    const priorBest = parsedBestFigures(player.careerStats.bowling.bestFigures);
    const newBest = row.bestBowlingWickets > priorBest.wickets
      || (row.bestBowlingWickets === priorBest.wickets && row.bestBowlingWickets > 0 && row.bestBowlingRuns < priorBest.runs);
    updated[row.playerId] = {
      ...player,
      careerStats: {
        batting: {
          ...player.careerStats.batting,
          matches: player.careerStats.batting.matches + row.matches,
          innings: player.careerStats.batting.innings + row.innings,
          runs,
          average: dismissals > 0 ? runs / dismissals : runs,
          strikeRate: battingBalls > 0 ? runs * 100 / battingBalls : 0,
          balls: battingBalls,
          dismissals,
        },
        bowling: {
          ...player.careerStats.bowling,
          matches: player.careerStats.bowling.matches + row.bowlingInnings,
          wickets,
          economy: bowlingBalls > 0 ? bowlingRuns * 6 / bowlingBalls : 0,
          average: wickets > 0 ? bowlingRuns / wickets : 0,
          bestFigures: newBest ? `${row.bestBowlingWickets}/${row.bestBowlingRuns}` : player.careerStats.bowling.bestFigures,
          balls: bowlingBalls,
          runsConceded: bowlingRuns,
        },
      },
    };
  });
  return updated;
}
