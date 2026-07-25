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
  onlyOpensOrBenched?: boolean;
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
      const leftForcedKeeperOpener = left.isWicketkeeper && (left.isOpener || left.onlyOpensOrBenched);
      const rightForcedKeeperOpener = right.isWicketkeeper && (right.isOpener || right.onlyOpensOrBenched);
      const openerDifference = Number(Boolean(right.isOpener)) - Number(Boolean(left.isOpener));
      const forcedKeeperDifference = Number(Boolean(rightForcedKeeperOpener)) - Number(Boolean(leftForcedKeeperOpener));
      if (forcedKeeperDifference !== 0) return forcedKeeperDifference;
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

export function sanitizeLineupBatterAt8OrBelow(
  selected: readonly LineupCandidate[],
  candidates: readonly LineupCandidate[],
): LineupCandidate[] {
  let result = [...selected];

  const checkAndReplaceAt = (index: number) => {
    const p = result[index];
    if (!p) return false;
    const isBatterAt8OrBelow = !isBowlingOption(p) && p.role !== "All-Rounder";
    if (!isBatterAt8OrBelow) return false;

    const startersWithoutP = result.filter((starter) => starter.id !== p.id);
    const overseasCountWithoutP = startersWithoutP.filter(isOverseas).length;

    const bench = candidates.filter((c) => (
      !result.some((starter) => starter.id === c.id)
      && (!isOverseas(c) || overseasCountWithoutP < 4)
    ));

    const allRounders = bench.filter((c) => c.role === "All-Rounder");
    const bowlers = bench.filter(isBowlingOption);

    const replacement = allRounders.sort((a, b) => (b.batting + b.bowling) - (a.batting + a.bowling))[0]
      ?? bowlers.sort((a, b) => b.bowling - a.bowling)[0]
      ?? bench.sort((a, b) => Math.max(b.batting, b.bowling) - Math.max(a.batting, a.bowling))[0];

    if (replacement) {
      result[index] = replacement;
      return true;
    }
    return false;
  };

  for (let idx = 7; idx < result.length; idx++) {
    checkAndReplaceAt(idx);
  }

  const orderedIds = sortIntoBattingOrder(result);
  const orderedPlayers = orderedIds.map((id) => result.find((p) => p?.id === id)!).filter(Boolean);
  for (let idx = 7; idx < orderedPlayers.length; idx++) {
    const p = orderedPlayers[idx];
    if (p && !isBowlingOption(p) && p.role !== "All-Rounder") {
      const realIndex = result.findIndex((starter) => starter.id === p.id);
      if (realIndex !== -1) {
        checkAndReplaceAt(realIndex);
      }
    }
  }

  return result;
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

  const battingPlayers = sanitizeLineupBatterAt8OrBelow(selectPlan("battingFirst"), candidates);
  const bowlingPlayers = sanitizeLineupBatterAt8OrBelow(selectPlan("bowlingFirst"), candidates);

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
  const starters = candidates.filter((candidate) => lineup.includes(candidate.id));
  const overseasStarters = starters.filter(isOverseas).length;
  const available = candidates.filter((candidate) => (
    !lineup.includes(candidate.id)
    && overseasStarters + (isOverseas(candidate) ? 1 : 0) <= 4
  ));
  const preferred = available.filter((candidate) => (
    plan === "battingFirst" ? isBowlingOption(candidate) : (
      candidate.role === "Batsman"
      || candidate.role === "WK-Batsman"
      || candidate.role === "All-Rounder"
    )
  ));

  if (plan === "battingFirst") {
    const specialistBackupBatters = available.filter((candidate) => (
      candidate.role === "Batsman" || candidate.role === "WK-Batsman"
    ));
    const allBackupBatters = available.filter((candidate) => (
      candidate.role === "Batsman"
      || candidate.role === "WK-Batsman"
      || candidate.role === "All-Rounder"
    ));
    const hasTwoRecognisedOpeners = starters.filter((candidate) => candidate.isOpener).length >= 2;
    const backupBatter = [...(
      specialistBackupBatters.length > 0 ? specialistBackupBatters : allBackupBatters
    )].sort((left, right) => (
      // A player restricted to opening/bench duty is a weaker generic backup
      // unless the XI has fewer than two recognised openers.
      Number(hasTwoRecognisedOpeners && Boolean(left.onlyOpensOrBenched))
        - Number(hasTwoRecognisedOpeners && Boolean(right.onlyOpensOrBenched))
      || right.batting - left.batting
      || right.bowling - left.bowling
    ))[0];

    const selected: LineupCandidate[] = [];

    [...preferred]
      .filter((candidate) => candidate.id !== backupBatter?.id)
      .sort((left, right) => right.bowling - left.bowling || right.batting - left.batting)
      .forEach((candidate) => {
        if (selected.length < 4) selected.push(candidate);
      });

    // Keep the emergency batter in the named five, but after the four bowling
    // options so no first-entry fallback can treat them as the automatic
    // incoming impact player.
    if (backupBatter && selected.length < 5) selected.push(backupBatter);

    [...available]
      .filter((candidate) => !selected.some((chosen) => chosen.id === candidate.id))
      .sort((left, right) => right.bowling - left.bowling || right.batting - left.batting)
      .forEach((candidate) => {
        if (selected.length < 5) selected.push(candidate);
      });

    return selected.map((candidate) => candidate.id);
  }

  const ranked = (preferred.length >= 5 ? preferred : available).sort((left, right) => {
    // Bowl-first impact substitutes are selected for the second innings: the
    // highest-rated eligible batter must lead the list, independent of the
    // source order of the substitutes.
    return right.batting - left.batting || right.bowling - left.bowling;
  });
  return ranked.slice(0, 5).map((candidate) => candidate.id);
}
