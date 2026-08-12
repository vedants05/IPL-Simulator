import type { Player } from "@/lib/types";
import { calculateMvpPoints, oversToBalls, type AwardSeasonStats } from "@/lib/logic/seasonAwards";
import { getTopSevenBattingPositions } from "@/lib/logic/playerBattingPositions";

export interface TeamOfSeasonSelection {
  player: Player;
  stats: AwardSeasonStats;
  selectionRole: string;
  battingStrikeRate: number;
  bowlingEconomy: number | null;
  impactScore: number;
  isImpactPlayer?: boolean;
}

interface Candidate extends TeamOfSeasonSelection {
  battingScore: number;
  bowlingScore: number;
  allRoundScore: number;
}

function toCandidate(player: Player, stats: AwardSeasonStats): Candidate {
  const battingStrikeRate = stats.balls > 0 ? stats.runs * 100 / stats.balls : 0;
  const bowlingBalls = oversToBalls(stats.oversBowled);
  const bowlingEconomy = bowlingBalls > 0 ? stats.runsConceded / (bowlingBalls / 6) : null;
  const battingScore = stats.runs
    + Math.max(-35, Math.min(90, (battingStrikeRate - 130) * Math.min(stats.balls, 250) / 250));
  const economyImpact = bowlingEconomy === null
    ? 0
    : Math.max(-45, Math.min(65, (8.5 - bowlingEconomy) * Math.max(3, bowlingBalls / 12)));
  const bowlingScore = stats.wickets * 24 + economyImpact + (stats.dotBalls ?? 0) * 0.3;
  return {
    player,
    stats,
    selectionRole: "",
    battingStrikeRate,
    bowlingEconomy,
    impactScore: calculateMvpPoints(stats).mvpPoints,
    battingScore,
    bowlingScore,
    allRoundScore: battingScore + bowlingScore * 0.9,
  };
}

export function selectTeamOfSeason(
  players: Record<string, Player>,
  seasonStats: AwardSeasonStats[],
): TeamOfSeasonSelection[] {
  const candidates = seasonStats
    .filter((stats) => stats.matches > 0)
    .map((stats) => players[stats.id] ? toCandidate(players[stats.id], stats) : null)
    .filter((candidate): candidate is Candidate => Boolean(candidate));
  if (candidates.length < 12) return [];

  const positionCandidates = new Map<number, Candidate[]>();
  for (let position = 1; position <= 7; position += 1) {
    positionCandidates.set(position, candidates.filter(({ player }) => (
      getTopSevenBattingPositions(player).includes(position)
    )));
  }
  if (Array.from(positionCandidates.values()).some((pool) => pool.length === 0)) return [];

  const isKeeper = (candidate: Candidate) => candidate.player.role === "WK-Batsman" || Boolean(candidate.player.isWicketkeeper);
  const eligibleKeepers = candidates.filter((candidate) => (
    isKeeper(candidate) && getTopSevenBattingPositions(candidate.player).length > 0
  ));
  const keeperOptions: Array<{ candidate?: Candidate; position?: number }> = eligibleKeepers.length > 0
    ? eligibleKeepers.flatMap((candidate) => getTopSevenBattingPositions(candidate.player).map((position) => ({ candidate, position })))
    : [{}];

  let bestTopSeven: Candidate[] = [];
  let bestTopSevenScore = Number.NEGATIVE_INFINITY;
  keeperOptions.forEach((keeperOption) => {
    const assigned = new Map<number, Candidate>();
    const usedIds = new Set<string>();
    let overseas = 0;
    if (keeperOption.candidate && keeperOption.position) {
      assigned.set(keeperOption.position, keeperOption.candidate);
      usedIds.add(keeperOption.candidate.player.id);
      overseas = keeperOption.candidate.player.nationality === "Overseas" ? 1 : 0;
    }

    const remainingPositions = [1, 2, 3, 4, 5, 6, 7]
      .filter((position) => !assigned.has(position))
      .sort((left, right) => (positionCandidates.get(left)?.length ?? 0) - (positionCandidates.get(right)?.length ?? 0));
    for (const position of remainingPositions) {
      const choice = [...(positionCandidates.get(position) ?? [])]
        .filter((candidate) => !usedIds.has(candidate.player.id))
        .filter((candidate) => candidate.player.nationality === "Indian" || overseas < 4)
        .sort((left, right) => right.battingScore - left.battingScore || right.impactScore - left.impactScore)[0];
      if (!choice) return;
      assigned.set(position, choice);
      usedIds.add(choice.player.id);
      if (choice.player.nationality === "Overseas") overseas += 1;
    }
    const ordered = [1, 2, 3, 4, 5, 6, 7].map((position) => assigned.get(position)!);
    const score = ordered.reduce((total, candidate) => total + candidate.battingScore, 0);
    if (score > bestTopSevenScore) {
      bestTopSeven = ordered;
      bestTopSevenScore = score;
    }
  });
  if (bestTopSeven.length !== 7) return [];

  const selected = [...bestTopSeven];
  const selectedIds = new Set(selected.map((candidate) => candidate.player.id));
  let overseasCount = selected.filter((candidate) => candidate.player.nationality === "Overseas").length;
  selected.forEach((candidate, index) => {
    candidate.selectionRole = isKeeper(candidate)
      ? `Batting position #${index + 1} · Wicketkeeper`
      : `Batting position #${index + 1}`;
  });

  const available = (pool: Candidate[]) => pool
    .filter((candidate) => !selectedIds.has(candidate.player.id))
    .filter((candidate) => candidate.player.nationality === "Indian" || overseasCount < 4);
  const rankedLegalGroup = (
    pool: Candidate[],
    count: number,
    score: (candidate: Candidate) => number,
    startingOverseasCount = overseasCount,
  ) => {
    const group: Candidate[] = [];
    let groupOverseasCount = startingOverseasCount;
    [...pool]
      .filter((candidate) => !selectedIds.has(candidate.player.id))
      .sort((left, right) => score(right) - score(left) || right.impactScore - left.impactScore)
      .some((candidate) => {
        if (candidate.player.nationality === "Overseas" && groupOverseasCount >= 4) return false;
        group.push(candidate);
        if (candidate.player.nationality === "Overseas") groupOverseasCount += 1;
        return group.length >= count;
      });
    return group;
  };
  const add = (candidate: Candidate, role: string) => {
    candidate.selectionRole = role;
    selected.push(candidate);
    selectedIds.add(candidate.player.id);
    if (candidate.player.nationality === "Overseas") overseasCount += 1;
  };

  const allRounders = candidates.filter(({ player }) => player.role === "All-Rounder");
  const numberEight = available(allRounders)
    .sort((left, right) => right.allRoundScore - left.allRoundScore || right.impactScore - left.impactScore)[0];
  if (!numberEight) return [];
  add(numberEight, "All-rounder");

  const specialistBowlers = candidates.filter(({ player }) => (
    player.role === "Pace Bowler" || player.role === "Spin Bowler"
  ));
  const fourBowlerGroup = rankedLegalGroup(specialistBowlers, 4, (candidate) => candidate.bowlingScore);
  if (fourBowlerGroup.length < 4) return [];
  const fourthBowler = fourBowlerGroup[3];
  const extraAllRounderCandidates = available(allRounders)
    .sort((left, right) => right.allRoundScore - left.allRoundScore || right.impactScore - left.impactScore);
  const fourthBowlerComparisonScore = fourthBowler.bowlingScore + fourthBowler.battingScore * 0.15;
  const extraAllRounder = extraAllRounderCandidates.find((candidate) => {
    if (candidate.stats.wickets < Math.max(6, Math.ceil(fourthBowler.stats.wickets * 0.5))) return false;
    if (candidate.allRoundScore < fourthBowlerComparisonScore * 1.2) return false;
    const overseasAfterAllRounder = overseasCount + Number(candidate.player.nationality === "Overseas");
    return rankedLegalGroup(specialistBowlers, 3, (bowler) => bowler.bowlingScore, overseasAfterAllRounder).length === 3;
  });

  if (extraAllRounder) {
    add(extraAllRounder, "All-rounder");
    const threeBowlerGroup = rankedLegalGroup(specialistBowlers, 3, (candidate) => candidate.bowlingScore);
    if (threeBowlerGroup.length < 3) return [];
    threeBowlerGroup.forEach((bowler) => add(
      bowler,
      bowler.player.role === "Spin Bowler" ? "Spin bowler" : "Pace bowler",
    ));
  } else {
    fourBowlerGroup.forEach((bowler) => add(
      bowler,
      bowler.player.role === "Spin Bowler" ? "Spin bowler" : "Pace bowler",
    ));
  }

  if (selected.length !== 12) return [];
  selected[11].isImpactPlayer = true;
  return selected;
}
