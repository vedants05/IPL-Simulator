export type LineupPlan = "battingFirst" | "bowlingFirst";
export type LineupDropPlacement = "before" | "swap" | "after";

export interface MatchSelection {
  lineup: string[];
  impactSubs: string[];
}

export interface LineupCandidate {
  id: string;
  nationality: string;
  role: string;
  batting: number;
  bowling: number;
  isWicketkeeper: boolean;
  isPartTimeWicketkeeper?: boolean;
  isOpener?: boolean;
}

export interface LineupValidation {
  playerCount: number;
  overseasCount: number;
  wicketkeeperCount: number;
  bowlingOptionCount: number;
  isComplete: boolean;
  isValid: boolean;
}

function lineupInsertionIndex(
  lineupLength: number,
  lineupIndex: number,
  targetIndex: number,
  placement: LineupDropPlacement,
): number {
  let insertionIndex = placement === "after" ? targetIndex + 1 : targetIndex;
  if (lineupIndex >= 0 && lineupIndex < insertionIndex) insertionIndex--;
  const lengthAfterRemoval = lineupIndex >= 0 ? lineupLength - 1 : lineupLength;
  return Math.max(0, Math.min(insertionIndex, lengthAfterRemoval));
}

export function getLineupDropPosition(
  lineup: readonly string[],
  playerId: string,
  targetIndex: number,
  placement: LineupDropPlacement,
): number {
  const lineupIndex = lineup.indexOf(playerId);
  const targetHasPlayer = targetIndex < lineup.length;
  const replacesTarget = targetHasPlayer
    && (placement === "swap" || (lineupIndex < 0 && lineup.length >= 11));

  return replacesTarget
    ? targetIndex + 1
    : lineupInsertionIndex(lineup.length, lineupIndex, targetIndex, placement) + 1;
}

export function dropPlayerIntoLineup(
  lineup: readonly string[],
  impactSubs: readonly string[],
  playerId: string,
  targetIndex: number,
  placement: LineupDropPlacement,
): MatchSelection {
  const nextLineup = [...lineup];
  const nextImpactSubs = [...impactSubs];
  const lineupIndex = nextLineup.indexOf(playerId);

  if (lineupIndex >= 0) {
    if (placement === "swap" && targetIndex < nextLineup.length) {
      [nextLineup[lineupIndex], nextLineup[targetIndex]] = [nextLineup[targetIndex], nextLineup[lineupIndex]];
    } else {
      const insertionIndex = lineupInsertionIndex(nextLineup.length, lineupIndex, targetIndex, placement);
      const [movedPlayer] = nextLineup.splice(lineupIndex, 1);
      nextLineup.splice(insertionIndex, 0, movedPlayer);
    }
    return { lineup: nextLineup, impactSubs: nextImpactSubs };
  }

  const impactIndex = nextImpactSubs.indexOf(playerId);
  const targetPlayer = nextLineup[targetIndex];
  const mustReplace = Boolean(targetPlayer) && (placement === "swap" || nextLineup.length >= 11);

  if (mustReplace) {
    nextLineup[targetIndex] = playerId;
    if (impactIndex >= 0) nextImpactSubs[impactIndex] = targetPlayer;
    return { lineup: nextLineup, impactSubs: nextImpactSubs };
  }

  if (impactIndex >= 0) nextImpactSubs.splice(impactIndex, 1);
  const insertionIndex = lineupInsertionIndex(nextLineup.length, -1, targetIndex, placement);
  nextLineup.splice(insertionIndex, 0, playerId);
  return { lineup: nextLineup.slice(0, 11), impactSubs: nextImpactSubs };
}

export function dropPlayerIntoImpactSubs(
  lineup: readonly string[],
  impactSubs: readonly string[],
  playerId: string,
  targetIndex: number,
): MatchSelection {
  const nextLineup = [...lineup];
  const nextImpactSubs = [...impactSubs];
  const impactIndex = nextImpactSubs.indexOf(playerId);

  if (impactIndex >= 0) {
    if (targetIndex < nextImpactSubs.length) {
      [nextImpactSubs[impactIndex], nextImpactSubs[targetIndex]] = [nextImpactSubs[targetIndex], nextImpactSubs[impactIndex]];
    } else {
      const [movedPlayer] = nextImpactSubs.splice(impactIndex, 1);
      nextImpactSubs.splice(Math.min(targetIndex, nextImpactSubs.length), 0, movedPlayer);
    }
    return { lineup: nextLineup, impactSubs: nextImpactSubs };
  }

  const lineupIndex = nextLineup.indexOf(playerId);
  const targetPlayer = nextImpactSubs[targetIndex];

  if (lineupIndex >= 0 && targetPlayer) {
    nextLineup[lineupIndex] = targetPlayer;
    nextImpactSubs[targetIndex] = playerId;
    return { lineup: nextLineup, impactSubs: nextImpactSubs };
  }

  if (lineupIndex >= 0) nextLineup.splice(lineupIndex, 1);
  if (targetPlayer) nextImpactSubs[targetIndex] = playerId;
  else nextImpactSubs.splice(Math.min(targetIndex, nextImpactSubs.length), 0, playerId);
  return { lineup: nextLineup, impactSubs: nextImpactSubs.slice(0, 5) };
}

const isOverseas = (player: LineupCandidate) => player.nationality === "Overseas";

export const MIN_BOWLING_OPTION_RATING = 68;

export const isBowlingOption = (player: LineupCandidate) =>
  player.bowling >= MIN_BOWLING_OPTION_RATING
  && (
    player.role === "All-Rounder"
    || player.role === "Pace Bowler"
    || player.role === "Spin Bowler"
  );

export function validateLineup(ids: readonly string[], candidates: readonly LineupCandidate[]): LineupValidation {
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const selected = ids.map((id) => candidateById.get(id)).filter((player): player is LineupCandidate => Boolean(player));
  const overseasCount = selected.filter(isOverseas).length;
  const wicketkeeperCount = selected.filter((player) => player.isWicketkeeper).length;
  const bowlingOptionCount = selected.filter(isBowlingOption).length;
  const isComplete = selected.length === 11;

  return {
    playerCount: selected.length,
    overseasCount,
    wicketkeeperCount,
    bowlingOptionCount,
    isComplete,
    isValid: isComplete && overseasCount <= 4 && wicketkeeperCount >= 1 && bowlingOptionCount >= 5,
  };
}

function sortIntoBattingOrder(players: readonly LineupCandidate[]): string[] {
  return [...players]
    .sort((left, right) => {
      const openerDifference = Number(Boolean(right.isOpener)) - Number(Boolean(left.isOpener));
      if (openerDifference !== 0) return openerDifference;
      const specialistDifference = Number(isBowlingOption(left) && left.batting < 55) - Number(isBowlingOption(right) && right.batting < 55);
      if (specialistDifference !== 0) return specialistDifference;
      return right.batting - left.batting || right.bowling - left.bowling;
    })
    .map((player) => player.id);
}

function canAddToLineup(player: LineupCandidate, selected: readonly LineupCandidate[]): boolean {
  return !isOverseas(player) || selected.filter(isOverseas).length < 4;
}

export function buildRecommendedLineups(candidates: readonly LineupCandidate[]): {
  battingFirstXI: string[];
  bowlingFirstXI: string[];
} {
  if (candidates.length === 0) return { battingFirstXI: [], bowlingFirstXI: [] };

  const selectPlan = (plan: LineupPlan) => {
    const ranked = [...candidates].sort((left, right) => {
      const leftScore = plan === "battingFirst"
        ? left.batting * 0.68 + left.bowling * 0.32
        : left.bowling * 0.6 + left.batting * 0.4;
      const rightScore = plan === "battingFirst"
        ? right.batting * 0.68 + right.bowling * 0.32
        : right.bowling * 0.6 + right.batting * 0.4;
      return rightScore - leftScore;
    });
    const selected: LineupCandidate[] = [];
    const add = (player: LineupCandidate | undefined) => {
      if (!player || selected.some((existing) => existing.id === player.id) || !canAddToLineup(player, selected)) return;
      selected.push(player);
    };

    add([...ranked].filter((player) => player.isWicketkeeper).sort((left, right) => right.batting - left.batting)[0]);
    ranked.filter(isBowlingOption).forEach((player) => {
      if (selected.filter(isBowlingOption).length < 5) add(player);
    });
    ranked.forEach((player) => {
      if (selected.length < 11) add(player);
    });

    return selected.slice(0, 11);
  };

  const battingPlayers = selectPlan("battingFirst");
  const bowlingPlayers = selectPlan("bowlingFirst");

  return {
    battingFirstXI: sortIntoBattingOrder(battingPlayers),
    bowlingFirstXI: sortIntoBattingOrder(bowlingPlayers),
  };
}

export function buildRecommendedImpactSubs(
  lineup: readonly string[],
  candidates: readonly LineupCandidate[],
  plan: LineupPlan,
): string[] {
  return candidates
    .filter((candidate) => !lineup.includes(candidate.id))
    .sort((left, right) => {
      const leftScore = plan === "battingFirst"
        ? left.bowling * 0.65 + left.batting * 0.35
        : left.batting * 0.65 + left.bowling * 0.35;
      const rightScore = plan === "battingFirst"
        ? right.bowling * 0.65 + right.batting * 0.35
        : right.batting * 0.65 + right.bowling * 0.35;
      return rightScore - leftScore;
    })
    .slice(0, 5)
    .map((candidate) => candidate.id);
}
