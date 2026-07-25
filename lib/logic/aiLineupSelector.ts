import type { Player } from "@/lib/types";

import { MIN_BOWLING_OPTION_RATING } from "./lineupPlanner";
import { findSpecialOpenerPair, SPECIAL_OPENER_PAIRS } from "./openerPairs";

export type AiLineupMode = "battingFirst" | "bowlingFirst";

export interface AiLineupPlan {
  startingXI: string[];
  impactPlayerId: string | null;
  likelyOutgoingPlayerId: string | null;
  impactBattingPosition?: number | null;
  captainId: string | null;
  viceCaptainId: string | null;
  usesProvisionalCaptain: boolean;
}

export interface AiMatchLineups {
  battingFirst: AiLineupPlan;
  bowlingFirst: AiLineupPlan;
}

export interface AiLineupOptions {
  captainId?: string | null;
  viceCaptainId?: string | null;
  useProvisionalCaptain?: boolean;
}

export { SPECIAL_OPENER_PAIRS };

export const currentAbility = (player: Player) => (
  Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0)
);

export const isAiBowlingOption = (player: Player) => (
  (player.currentBowling ?? 0) >= MIN_BOWLING_OPTION_RATING
  && (
    player.role === "All-Rounder"
    || player.role === "Pace Bowler"
    || player.role === "Spin Bowler"
  )
);

export const isSuperstarYoungster = (player: Player) => (
  player.age <= 25
  && currentAbility(player) >= 72
  && Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0) >= 88
);

const isKeeper = (player: Player) => (
  player.role === "WK-Batsman"
  || Boolean(player.isWicketkeeper)
  || Boolean(player.isPartTimeWk)
);

const isOverseas = (player: Player) => player.nationality === "Overseas";

export const isImpactPlayerWithinOverseasLimit = (
  startingXI: readonly Player[],
  impactPlayer: Player,
) => (
  startingXI.filter(isOverseas).length + (isOverseas(impactPlayer) ? 1 : 0) <= 4
);

export const isBattingOption = (player: Player) => (
  player.role === "Batsman"
  || player.role === "WK-Batsman"
  || player.role === "All-Rounder"
);

export function selectBattingFirstImpactBowler(
  candidates: readonly Player[],
): Player | null {
  return [...candidates]
    .filter(isAiBowlingOption)
    .sort((left, right) => (
      (right.currentBowling ?? 0) - (left.currentBowling ?? 0)
      || currentAbility(right) - currentAbility(left)
      || (right.reputation ?? 0) - (left.reputation ?? 0)
    ))[0] ?? null;
}

export function selectBattingFirstOutgoingBatter(
  startingXI: readonly Player[],
  protectedIds: ReadonlySet<string> = new Set(),
): Player | null {
  const primaryKeeper = startingXI.find((player) => (
    player.role === "WK-Batsman" || Boolean(player.isWicketkeeper)
  )) ?? startingXI.find((player) => Boolean(player.isPartTimeWk));

  const rankedBowlers = startingXI
    .filter(isAiBowlingOption)
    .sort((left, right) => (
      (right.currentBowling ?? 0) - (left.currentBowling ?? 0)
      || currentAbility(right) - currentAbility(left)
    ));
  const requiredBowlerIds = new Set(rankedBowlers.slice(0, 4).map((player) => player.id));
  const fifthBowler = rankedBowlers[4];
  if (fifthBowler && (fifthBowler.currentBowling ?? 0) > 74) {
    requiredBowlerIds.add(fifthBowler.id);
  }

  const isRestricted = (player: Player) => (
    protectedIds.has(player.id)
    || player.id === primaryKeeper?.id
    || (player.reputation ?? 0) >= 10
    || requiredBowlerIds.has(player.id)
  );
  const specialistBatters = startingXI.filter((player) => (
    (player.role === "Batsman" || player.role === "WK-Batsman")
    && !isRestricted(player)
  ));
  const nonBowlingBatters = specialistBatters.filter((player) => !isAiBowlingOption(player));
  const battingSort = (left: Player, right: Player) => (
    (left.currentBatting ?? 0) - (right.currentBatting ?? 0)
    || currentAbility(left) - currentAbility(right)
  );

  if (nonBowlingBatters.length > 0) {
    return [...nonBowlingBatters].sort(battingSort)[0];
  }
  if (specialistBatters.length > 0) {
    return [...specialistBatters].sort(battingSort)[0];
  }

  return startingXI
    .filter((player) => player.role === "All-Rounder" && !isRestricted(player))
    .sort((left, right) => (
      (left.currentBowling ?? 0) - (right.currentBowling ?? 0)
      || (left.currentBatting ?? 0) - (right.currentBatting ?? 0)
    ))[0] ?? null;
}

const HIGH_BATTING_RATING = 82;
// Elite impact batters should only be preferred once we know they can enter
// in a role that suits them.  This keeps a high rating from being translated
// into an arbitrary batting slot that displaces stronger, well-positioned
// starters.
const PREMIUM_IMPACT_BATTING_RATING = 85;

/**
 * If a bowl-first plan's middle-order impact batter is weaker than every
 * batter in positions 3-7, use the strongest eligible finisher instead. A
 * finisher is intentionally introduced at eight so the top seven remain the
 * established middle order.
 */
function sanitizeImpactPlayerOverseasLimit(
  squad: readonly Player[],
  startingXI: readonly Player[],
  impactPlayer: Player | null,
  mode: AiLineupMode = "bowlingFirst",
): Player | null {
  if (!impactPlayer) return null;
  const startersOverseas = startingXI.filter(isOverseas).length;
  if (startersOverseas < 4 || !isOverseas(impactPlayer)) return impactPlayer;

  const startingIds = new Set(startingXI.map((p) => p.id));
  const legalBench = squad
    .filter((p) => (
      !startingIds.has(p.id)
      && (mode === "battingFirst" ? isAiBowlingOption(p) : isBattingOption(p))
      && isImpactPlayerWithinOverseasLimit(startingXI, p)
    ))
    .sort((left, right) => (
      (mode === "bowlingFirst"
        ? (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
        : (right.currentBowling ?? 0) - (left.currentBowling ?? 0))
      || currentAbility(right) - currentAbility(left)
      || (right.reputation ?? 0) - (left.reputation ?? 0)
    ));

  if (legalBench.length > 0) return legalBench[0];

  const anyLegalBench = squad
    .filter((p) => !startingIds.has(p.id) && isImpactPlayerWithinOverseasLimit(startingXI, p))
    .sort((left, right) => currentAbility(right) - currentAbility(left));

  return anyLegalBench[0] ?? null;
}

export function applyBowlingFirstImpactFinisherRule(
  squad: readonly Player[],
  startingXI: readonly Player[],
  impactPlayer: Player | null,
): { player: Player | null; forcePosition8: boolean; replacedOpener: boolean } {
  const safeImpactPlayer = sanitizeImpactPlayerOverseasLimit(squad, startingXI, impactPlayer, "bowlingFirst");
  if (
    !safeImpactPlayer
    || !isBattingOption(safeImpactPlayer)
    || safeImpactPlayer.isOpener
    || safeImpactPlayer.isFinisher
  ) {
    return { player: safeImpactPlayer, forcePosition8: false, replacedOpener: false };
  }

  const middleOrder = startingXI.slice(2, 7);
  const impactBattingRating = safeImpactPlayer.currentBatting ?? 0;
  if (
    middleOrder.length !== 5
    || !middleOrder.every((player) => impactBattingRating < (player.currentBatting ?? 0))
  ) {
    return { player: safeImpactPlayer, forcePosition8: false, replacedOpener: false };
  }

  const startingIds = new Set(startingXI.map((player) => player.id));
  const finisher = squad
    .filter((player) => (
      !startingIds.has(player.id)
      && isBattingOption(player)
      && Boolean(player.isFinisher)
      && isImpactPlayerWithinOverseasLimit(startingXI, player)
    ))
    .sort((left, right) => (
      (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
      || currentAbility(right) - currentAbility(left)
      || (right.reputation ?? 0) - (left.reputation ?? 0)
    ))[0] ?? null;

  return finisher
    ? { player: finisher, forcePosition8: true, replacedOpener: false }
    : { player: safeImpactPlayer, forcePosition8: false, replacedOpener: false };
}

/**
 * Resolves the complete bowl-first batting impact rule chain. A weak opener
 * selected for #1/#2 is replaced by the strongest middle-order option, which
 * then flows through the middle-order/finisher rule above.
 */
export function resolveBowlingFirstImpactPlayer(
  squad: readonly Player[],
  startingXI: readonly Player[],
  impactPlayer: Player | null,
  impactPosition?: number | null,
): { player: Player | null; forcePosition8: boolean; replacedOpener: boolean } {
  const safeImpactPlayer = sanitizeImpactPlayerOverseasLimit(squad, startingXI, impactPlayer, "bowlingFirst");
  const bothStartingOpeners = Boolean(startingXI[0]?.isOpener && startingXI[1]?.isOpener);
  const isWeakStartingOpener = Boolean(
    safeImpactPlayer
    && safeImpactPlayer.isOpener
    && (impactPosition === 1 || impactPosition === 2)
    && bothStartingOpeners
    && (safeImpactPlayer.currentBatting ?? 0) < (startingXI[0]?.currentBatting ?? 0)
    && (safeImpactPlayer.currentBatting ?? 0) < (startingXI[1]?.currentBatting ?? 0),
  );

  if (!isWeakStartingOpener) {
    return applyBowlingFirstImpactFinisherRule(squad, startingXI, safeImpactPlayer);
  }

  const startingIds = new Set(startingXI.map((player) => player.id));
  const middleOrderImpact = squad
    .filter((player) => (
      !startingIds.has(player.id)
      && isBattingOption(player)
      && !player.isOpener
      && !player.isFinisher
      && isImpactPlayerWithinOverseasLimit(startingXI, player)
    ))
    .sort((left, right) => (
      (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
      || currentAbility(right) - currentAbility(left)
      || (right.reputation ?? 0) - (left.reputation ?? 0)
    ))[0] ?? null;

  if (!middleOrderImpact) {
    return { player: safeImpactPlayer, forcePosition8: false, replacedOpener: false };
  }

  const resolved = applyBowlingFirstImpactFinisherRule(squad, startingXI, middleOrderImpact);
  return { ...resolved, replacedOpener: true };
}

export const MIN_GENUINE_BATTERS = 5;
export const MAX_SPECIALIST_BOWLERS = 5;

export const isGenuineBatter = (player: Player) => (
  player.role === "Batsman" || player.role === "WK-Batsman"
);

export const isSpecialistBowler = (player: Player) => (
  player.role === "Pace Bowler" || player.role === "Spin Bowler"
);

export const maxSpecialistBowlersFor = (lineup: readonly Player[]) => {
  const allRounders = lineup.filter((player) => player.role === "All-Rounder");
  if (allRounders.length >= 4) return 3;
  const hasEliteAllRounder = allRounders.some((player) => (player.currentBowling ?? 0) >= 80);
  const hasTwoStrongAllRounders = allRounders.filter(
    (player) => (player.currentBowling ?? 0) >= 75,
  ).length >= 2;
  return hasEliteAllRounder || hasTwoStrongAllRounders ? 4 : MAX_SPECIALIST_BOWLERS;
};

function getOpeningPair(squad: readonly Player[]): Player[] {
  // A designated partnership takes precedence over every individual opener
  // preference, including a wicketkeeper who normally opens. The keeper is
  // still selected separately by the XI balance rules, but must not split an
  // intact special pair such as Head/Abhishek.
  const specialPair = findSpecialOpenerPair(squad);
  if (specialPair) return specialPair;

  const forcedKeeperOpeners = squad
    .filter((player) => isKeeper(player) && (player.isOpener || player.onlyOpensOrBenched))
    .sort((left, right) => (
      (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
      || currentAbility(right) - currentAbility(left)
    ));
  if (forcedKeeperOpeners.length > 0) {
    const otherOpener = squad
      .filter((player) => player.id !== forcedKeeperOpeners[0].id && player.isOpener)
      .sort((left, right) => (
        (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
        || currentAbility(right) - currentAbility(left)
      ))[0];
    const fallbackOpener = squad
      .filter((player) => player.id !== forcedKeeperOpeners[0].id && isBattingOption(player))
      .sort((left, right) => (
        (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
        || currentAbility(right) - currentAbility(left)
      ))[0];
    return [forcedKeeperOpeners[0], otherOpener ?? fallbackOpener].filter((player): player is Player => Boolean(player));
  }

  const flaggedOpeners = squad
    .filter((player) => player.isOpener)
    .sort((left, right) => (
      (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
      || currentAbility(right) - currentAbility(left)
      || (right.reputation ?? 0) - (left.reputation ?? 0)
    ));

  if (flaggedOpeners.length >= 2) return flaggedOpeners.slice(0, 2);

  const fallbackBatters = squad
    .filter((player) => !flaggedOpeners.some((opener) => opener.id === player.id))
    .filter((player) => (
      player.role === "Batsman"
      || player.role === "WK-Batsman"
      || player.role === "All-Rounder"
    ))
    .sort((left, right) => (
      (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
      || currentAbility(right) - currentAbility(left)
    ));

  return [...flaggedOpeners, ...fallbackBatters].slice(0, 2);
}

function getCaptain(squad: readonly Player[], requestedCaptainId?: string | null) {
  const requestedCaptain = requestedCaptainId
    ? squad.find((player) => player.id === requestedCaptainId)
    : undefined;
  if (requestedCaptain) {
    return { player: requestedCaptain, provisional: false };
  }

  const provisionalCaptain = [...squad]
    .filter((player) => !player.isIplCaptaincyUnavailable)
    .sort((left, right) => (
      (right.captaincy ?? 0) - (left.captaincy ?? 0)
      || (right.reputation ?? 0) - (left.reputation ?? 0)
      || currentAbility(right) - currentAbility(left)
    ))[0] ?? [...squad].sort((left, right) => currentAbility(right) - currentAbility(left))[0];

  return { player: provisionalCaptain, provisional: true };
}

function preferredPosition(player: Player, position: number): boolean {
  if (position === 3) return Boolean(player.hasBattedAt3);
  if (position === 4) return Boolean(player.hasBattedAt4);
  if (position === 5) return Boolean(player.hasBattedAt5);
  if (position === 6) return Boolean(player.hasBattedAt6);
  if (position === 7) return Boolean(player.hasBattedAt7);
  return false;
}

export function orderStartingXI(
  selected: readonly Player[],
  openingPair: readonly Player[],
  mode?: AiLineupMode,
  fullSquad?: readonly Player[],
  protectedPlayerIds: ReadonlySet<string> = new Set(),
): Player[] {
  const openerIds = new Set(openingPair.map((player) => player.id));
  const ordered = openingPair.filter((player) => selected.some((candidate) => candidate.id === player.id));
  let remaining = selected.filter((player) => !openerIds.has(player.id));

  const assignSequentially = (players: readonly Player[], positions: readonly number[]) => {
    const assignments: Player[] = [];
    let pool = [...players];

    positions.forEach((position, positionIndex) => {
      const laterPositions = positions.slice(positionIndex + 1);
      const preferred = pool
        .filter((player) => preferredPosition(player, position))
        .sort((left, right) => (
          (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
          || currentAbility(right) - currentAbility(left)
        ));
      const chosen = preferred.find((candidate) => (
        (candidate.currentBatting ?? 0) > 80
        || !pool.some((other) => (
          other.id !== candidate.id
          && preferredPosition(other, position)
          && !laterPositions.some((laterPosition) => preferredPosition(other, laterPosition))
        ))
      )) ?? preferred[0] ?? [...pool].sort((left, right) => (
        (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
        || currentAbility(right) - currentAbility(left)
      ))[0];

      if (chosen) {
        assignments.push(chosen);
        pool = pool.filter((player) => player.id !== chosen.id);
      }
    });

    return assignments;
  };

  // Core batters: top & middle order batters (positions 3-5).
  // Includes core batters and batters with explicit top/middle position flags (hasBattedAt3..5).
  const coreBatters = remaining.filter((player) => (
    (
      player.isCoreBatter
      || Boolean(player.hasBattedAt3 || player.hasBattedAt4 || player.hasBattedAt5)
    )
    && (
      player.role === "Batsman"
      || player.role === "WK-Batsman"
      || player.role === "All-Rounder"
    )
  ));
  const corePositions = Array.from(
    { length: Math.min(coreBatters.length, 5) },
    (_, index) => index + 3,
  );
  const orderedCore = assignSequentially(coreBatters, corePositions);
  ordered.push(...orderedCore);
  const orderedCoreIds = new Set(orderedCore.map((player) => player.id));
  remaining = remaining.filter((player) => !orderedCoreIds.has(player.id));

  const nextPosition = 3 + orderedCore.length;
  const finishers = remaining.filter((player) => (
    player.role === "Batsman"
    || player.role === "WK-Batsman"
    || player.role === "All-Rounder"
  ));
  const finisherPositions = Array.from(
    { length: Math.min(finishers.length, Math.max(0, 8 - nextPosition)) },
    (_, index) => nextPosition + index,
  );
  const orderedFinishers = assignSequentially(finishers, finisherPositions);
  ordered.push(...orderedFinishers);
  const orderedFinisherIds = new Set(orderedFinishers.map((player) => player.id));
  remaining = remaining.filter((player) => !orderedFinisherIds.has(player.id));

  ordered.push(...remaining.sort((left, right) => (
    Number(isAiBowlingOption(left) && (left.currentBatting ?? 0) < 55)
      - Number(isAiBowlingOption(right) && (right.currentBatting ?? 0) < 55)
    || (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
    || (right.currentBowling ?? 0) - (left.currentBowling ?? 0)
  )));

  const result = ordered.slice(0, 11);

  if (result.length >= 8) {
    const isCoreBatter = (p: Player) => Boolean(
      p.isCoreBatter || p.hasBattedAt3 || p.hasBattedAt4 || p.hasBattedAt5,
    );
    const isBatterOrAllRounder = (p: Player) => (
      p.role === "Batsman" || p.role === "WK-Batsman" || p.role === "All-Rounder"
    );

    const p5 = result[4];
    const p6 = result[5];
    const p7 = result[6];
    const num8 = result[7];

    if (p5 && p6 && p7 && num8) {
      const allFourAreBattersOrARs = (
        isBatterOrAllRounder(p5)
        && isBatterOrAllRounder(p6)
        && isBatterOrAllRounder(p7)
        && isBatterOrAllRounder(num8)
      );

      const num8IsEligibleCoreBatter = (num8.currentBatting ?? 0) > 78
        && isCoreBatter(num8)
        && Boolean(num8.hasBattedAt5 || preferredPosition(num8, 5));

      if (allFourAreBattersOrARs && num8IsEligibleCoreBatter) {
        const num8Bat = num8.currentBatting ?? 0;
        const p5Bat = p5.currentBatting ?? 0;
        const p6Bat = p6.currentBatting ?? 0;
        const p7Bat = p7.currentBatting ?? 0;

        const isLowerThanAllThree = num8Bat < p5Bat && num8Bat < p6Bat && num8Bat < p7Bat;

        if (!isLowerThanAllThree) {
          result[4] = num8;
          result[5] = p5;
          result[6] = p6;
          result[7] = p7;
        }
      }
    }
  }

  // If at the end of everything there is a batter at position 8 or below (index >= 7),
  // remove them from the XI and swap them with the best available All-Rounder from the bench,
  // or if no All-Rounders, the best available Bowler, or if none, the candidate with highest potential ability.
  let replacedCount = 0;
  const replacedBatterIds = new Set<string>();
  for (let idx = 7; idx < result.length; idx++) {
    const p = result[idx];
    if (!p || replacedBatterIds.has(p.id)) continue;
    const isBatterAt8OrBelow = (player: Player) => (
      player.role === "Batsman"
      || player.role === "WK-Batsman"
      || (!isAiBowlingOption(player) && player.role !== "All-Rounder")
    );

    if (isBatterAt8OrBelow(p) && (p.reputation ?? 0) < 10 && !protectedPlayerIds.has(p.id)) {
      replacedBatterIds.add(p.id);

      const currentXIIds = new Set(result.map((starter) => starter.id));
      const pool = fullSquad || selected;
      let benchCandidates = pool.filter((candidate) => !currentXIIds.has(candidate.id));

      const lowerAllRounders = result.slice(7).filter((candidate) => candidate.role === "All-Rounder" && candidate.id !== p.id);
      benchCandidates = [...benchCandidates, ...lowerAllRounders];

      if (benchCandidates.length === 0) {
        benchCandidates = result.slice(7).filter((candidate) => candidate.id !== p.id);
      }

      const validCandidates = benchCandidates;

      const allRounders = validCandidates.filter((candidate) => candidate.role === "All-Rounder");
      const bowlers = validCandidates.filter((candidate) => isAiBowlingOption(candidate) || candidate.role === "Pace Bowler" || candidate.role === "Spin Bowler");

      let replacement: Player | undefined;
      const potentialAbility = (player: Player) => Math.max(
        player.potentialBatting ?? player.currentBatting ?? 0,
        player.potentialBowling ?? player.currentBowling ?? 0,
      );

      if (allRounders.length > 0) {
        replacement = [...allRounders].sort((left, right) => (
          currentAbility(right) - currentAbility(left)
          || potentialAbility(right) - potentialAbility(left)
        ))[0];
      } else if (bowlers.length > 0) {
        replacement = [...bowlers].sort((left, right) => (
          potentialAbility(right) - potentialAbility(left)
          || currentAbility(right) - currentAbility(left)
        ))[0];
      } else if (validCandidates.length > 0) {
        replacement = [...validCandidates].sort((left, right) => (
          potentialAbility(right) - potentialAbility(left)
          || currentAbility(right) - currentAbility(left)
        ))[0];
      }

      if (replacement) {
        const existingIdx = result.findIndex((starter) => starter.id === replacement!.id);
        if (existingIdx !== -1) {
          result[idx] = replacement;
          result[existingIdx] = p;
        } else {
          result[idx] = replacement;
        }
        replacedCount++;
      }
    }
  }

  return result;

  return result;
}

function selectionScore(player: Player, mode: AiLineupMode): number {
  const rating = currentAbility(player);
  // Superstar youngsters rise above every player rated 79 or below, but the
  // protected score remains below the floor for an 80-rated senior player.
  const abilityScore = isSuperstarYoungster(player) && rating < 80
    ? 79_500
    : rating * 1_000;
  const planFit = mode === "battingFirst"
    ? (player.currentBatting ?? 0) * 2 + (player.currentBowling ?? 0) * 0.05
    : (player.currentBowling ?? 0) * 2 + (player.currentBatting ?? 0) * 0.05;
  return abilityScore + planFit;
}

function lineupScore(selected: readonly Player[], mode: AiLineupMode): number {
  const battingOptions = selected.filter(isBattingOption).length;
  const bowlingOptions = selected.filter(isAiBowlingOption).length;
  const hasPace = selected.some((player) => (
    isAiBowlingOption(player)
    && (player.role === "Pace Bowler" || player.bowlingStyle === "Pacer")
  ));
  const hasSpin = selected.some((player) => (
    isAiBowlingOption(player)
    && (player.role === "Spin Bowler" || player.bowlingStyle === "Spinner")
  ));

  // Bowling quality score: bonus for 4 bowling options above 75 and 5th above 70
  const bowlers75Plus = selected.filter((p) => isAiBowlingOption(p) && (p.currentBowling ?? 0) >= 75).length;
  const bowlers70Plus = selected.filter((p) => isAiBowlingOption(p) && (p.currentBowling ?? 0) >= 70).length;
  const bowlingQualityBonus = Math.min(4, bowlers75Plus) * 30 + Math.min(5, bowlers70Plus) * 15;

  return selected.reduce((total, player) => total + selectionScore(player, mode), 0)
    + (mode === "battingFirst" ? battingOptions : bowlingOptions) * 140
    + (hasPace ? 80 : 0)
    + (hasSpin ? 80 : 0)
    + bowlingQualityBonus;
}

function hasBaseBalance(selected: readonly Player[], _mode: AiLineupMode) {
  const genuineCount = selected.filter(isGenuineBatter).length;
  if (genuineCount < 3) return false;
  if (genuineCount < 5) {
    const qualifyingArs = selected.filter((player) => player.role === "All-Rounder" && (player.currentBatting ?? 0) > 75);
    const neededExceptions = 5 - genuineCount;
    if (qualifyingArs.length < neededExceptions) return false;
  }

  return selected.length === 11
    && selected.filter(isOverseas).length <= 4
    && selected.some(isKeeper)
    && selected.filter(isAiBowlingOption).length >= 5
    && selected.filter(isSpecialistBowler).length <= maxSpecialistBowlersFor(selected)
    && selected.some((player) => isAiBowlingOption(player) && (player.role === "Pace Bowler" || player.bowlingStyle === "Pacer"))
    && selected.some((player) => isAiBowlingOption(player) && (player.role === "Spin Bowler" || player.bowlingStyle === "Spinner"));
}

interface SelectionSearchState {
  players: Player[];
  additiveScore: number;
}

function selectionStateKey(selected: readonly Player[]): string {
  const allRounders = selected.filter((player) => player.role === "All-Rounder");
  const hasPace = selected.some((player) => (
    isAiBowlingOption(player)
    && (player.role === "Pace Bowler" || player.bowlingStyle === "Pacer")
  ));
  const hasSpin = selected.some((player) => (
    isAiBowlingOption(player)
    && (player.role === "Spin Bowler" || player.bowlingStyle === "Spinner")
  ));

  return [
    selected.length,
    selected.filter(isOverseas).length,
    Number(selected.some(isKeeper)),
    Math.min(7, selected.filter(isBattingOption).length),
    Math.min(6, selected.filter(isAiBowlingOption).length),
    Math.min(MIN_GENUINE_BATTERS, selected.filter(isGenuineBatter).length),
    Math.min(MAX_SPECIALIST_BOWLERS + 1, selected.filter(isSpecialistBowler).length),
    Math.min(4, allRounders.length),
    Number(allRounders.some((player) => (player.currentBowling ?? 0) >= 80)),
    Math.min(2, allRounders.filter((player) => (player.currentBowling ?? 0) >= 75).length),
    Number(hasPace),
    Number(hasSpin),
  ].join("|");
}

function additiveSelectionScore(player: Player, mode: AiLineupMode): number {
  const planOptionBonus = mode === "battingFirst"
    ? (isBattingOption(player) ? 140 : 0)
    : (isAiBowlingOption(player) ? 140 : 0);
  return selectionScore(player, mode) + planOptionBonus;
}

function selectStartingPlayers(
  squad: readonly Player[],
  mode: AiLineupMode,
  openingPair: readonly Player[],
  captain: Player | undefined,
  viceCaptain: Player | undefined,
): Player[] {
  const openingIds = new Set(openingPair.map((player) => player.id));
  const mandatoryIds = new Set<string>(openingIds);
  squad.filter((player) => player.reputation === 10).forEach((player) => mandatoryIds.add(player.id));
  if (captain) mandatoryIds.add(captain.id);
  if (viceCaptain) mandatoryIds.add(viceCaptain.id);

  const leadershipIds = new Set(
    [captain?.id, viceCaptain?.id].filter((id): id is string => Boolean(id)),
  );
  const eligible = squad.filter((player) => (
    !player.onlyOpensOrBenched || openingIds.has(player.id) || leadershipIds.has(player.id)
  ));
  const mandatory = eligible.filter((player) => mandatoryIds.has(player.id));
  if (mandatory.length > 11) {
    const mandatoryKeeper = mandatory.find(isKeeper)
      ?? eligible.filter(isKeeper).sort((left, right) => currentAbility(right) - currentAbility(left))[0];
    const selected = [...mandatory]
      .filter((player) => leadershipIds.has(player.id))
      .concat(mandatoryKeeper && !leadershipIds.has(mandatoryKeeper.id) ? [mandatoryKeeper] : [])
      .concat([...mandatory]
        .filter((player) => !leadershipIds.has(player.id) && player.id !== mandatoryKeeper?.id)
      .sort((left, right) => selectionScore(right, mode) - selectionScore(left, mode))
      .slice(0, Math.max(0, 11 - (leadershipIds.size + Number(Boolean(mandatoryKeeper && !leadershipIds.has(mandatoryKeeper.id)))))));
    return orderStartingXI(
      selected,
      openingPair,
      mode,
      squad,
      leadershipIds,
    );
  }

  const optional = eligible.filter((player) => !mandatoryIds.has(player.id));
  let bestPreferred: { players: Player[]; score: number } | null = null;
  let bestFallback: { players: Player[]; score: number } | null = null;

  const consider = (selected: readonly Player[]) => {
    if (!hasBaseBalance(selected, mode)) return;
    const battingOptions = selected.filter(isBattingOption).length;
    const score = lineupScore(selected, mode);
    const candidate = { players: [...selected], score };

    if (!bestFallback || score > bestFallback.score) {
      bestFallback = candidate;
    }

    const meetsPreferredPlan = mode === "battingFirst"
      ? battingOptions >= 7
      : battingOptions >= 6;
    if (meetsPreferredPlan && (!bestPreferred || score > bestPreferred.score)) {
      bestPreferred = candidate;
    }
  };

  let states = new Map<string, SelectionSearchState>();
  const mandatoryState: SelectionSearchState = {
    players: [...mandatory],
    additiveScore: mandatory.reduce(
      (total, player) => total + additiveSelectionScore(player, mode),
      0,
    ),
  };
  states.set(selectionStateKey(mandatoryState.players), mandatoryState);

  optional.forEach((player) => {
    const nextStates = new Map<string, SelectionSearchState>(states);
    states.forEach((state) => {
      if (state.players.length >= 11) return;
      if (isOverseas(player) && state.players.filter(isOverseas).length >= 4) return;

      const included: SelectionSearchState = {
        players: [...state.players, player],
        additiveScore: state.additiveScore + additiveSelectionScore(player, mode),
      };
      const key = selectionStateKey(included.players);
      const existing = nextStates.get(key);
      if (!existing || included.additiveScore > existing.additiveScore) {
        nextStates.set(key, included);
      }
    });
    states = nextStates;
  });

  states.forEach((state) => {
    if (state.players.length === 11) {
      consider(state.players);
    }
  });

  const preferredResult = bestPreferred as { players: Player[]; score: number } | null;
  const fallbackResult = bestFallback as { players: Player[]; score: number } | null;
  const selected = preferredResult?.players ?? fallbackResult?.players;
  if (selected) return orderStartingXI(selected, openingPair, mode, squad, leadershipIds);

  const fallback = [...mandatory];
  [...optional]
    .sort((left, right) => selectionScore(right, mode) - selectionScore(left, mode))
    .forEach((player) => {
      if (fallback.length >= 11) return;
      if (isOverseas(player) && fallback.filter(isOverseas).length >= 4) return;
      fallback.push(player);
    });
  return orderStartingXI(fallback, openingPair, mode, squad, leadershipIds);
}

function selectImpactPlayer(
  squad: readonly Player[],
  startingXI: readonly Player[],
  mode: AiLineupMode,
  protectedIds: ReadonlySet<string>,
  battingFirstOutgoingProtectedIds: ReadonlySet<string> = protectedIds,
) {
  const startingIds = new Set(startingXI.map((player) => player.id));
  let bench = squad.filter((player) => (
    !startingIds.has(player.id)
    && (mode === "battingFirst" ? isAiBowlingOption(player) : isBattingOption(player))
  ));

  let legalBench = bench.filter((player) => (
    isImpactPlayerWithinOverseasLimit(startingXI, player)
  ));

  if (legalBench.length === 0) {
    const allLegalBench = squad.filter((player) => (
      !startingIds.has(player.id)
      && isImpactPlayerWithinOverseasLimit(startingXI, player)
    ));
    if (allLegalBench.length === 0) return { impactPlayer: null, outgoingPlayer: null };
    legalBench = allLegalBench;
  }

  const openingPair = getOpeningPair(squad);

  const evaluateCandidate = (candidate: Player) => {
    if (
      candidate.role === "All-Rounder"
      && (candidate.currentBatting ?? 0) > 75
    ) {
      const pureBatters = startingXI.filter((player, index) => {
        if (index < 2) return false;
        if (player.role !== "Batsman") return false;
        if (protectedIds.has(player.id)) return false;
        if (isKeeper(player)) return false;
        return true;
      });

      if (pureBatters.length > 0) {
        const chosenOutgoing = [...pureBatters].sort((left, right) => {
          const leftPos = startingXI.indexOf(left) + 1;
          const rightPos = startingXI.indexOf(right) + 1;
          const leftOutOfPos = !preferredPosition(left, leftPos);
          const rightOutOfPos = !preferredPosition(right, rightPos);

          return Number(rightOutOfPos) - Number(leftOutOfPos)
            || currentAbility(left) - currentAbility(right)
            || right.age - left.age
            || (left.reputation ?? 0) - (right.reputation ?? 0)
            || rightPos - leftPos;
        })[0];

        if ((candidate.currentBatting ?? 0) > (chosenOutgoing.currentBatting ?? 0)) {
          const postSubStarters = startingXI
            .filter((player) => player.id !== chosenOutgoing.id)
            .concat(candidate);
          const orderedPostSub = orderStartingXI(postSubStarters, openingPair);
          const posIndex = orderedPostSub.findIndex((player) => player.id === candidate.id);
          const position = posIndex !== -1 ? posIndex + 1 : 11;
          const inPreferredPos = preferredPosition(candidate, position);
          return { outgoing: chosenOutgoing, position, inPreferredPos };
        }
      }
    }

    const outgoingCandidates = startingXI
      .filter((player, index) => {
        const allowOpenerReplacement = mode === "bowlingFirst"
          && isBattingOption(candidate)
          && candidate.isOpener;
        const isOpeningPairPlayer = startingXI.indexOf(player) < 2;
        if (protectedIds.has(player.id) && !(allowOpenerReplacement && isOpeningPairPlayer)) return false;
        if (mode === "battingFirst" && index < 2) return false;
        // Bat first: the impact bowler replaces the lowest-priority eligible
        // batter after that batter has completed their innings.
        if (mode === "battingFirst") {
          if (!isBattingOption(player)) return false;
        }
        if (isKeeper(player) && startingXI.filter(isKeeper).length <= 1) return false;
        return true;
      })
      .sort((left, right) => {
        if (mode === "battingFirst") {
          return (left.currentBatting ?? 0) - (right.currentBatting ?? 0)
            || currentAbility(left) - currentAbility(right);
        }
        if (isBattingOption(candidate)) {
          return (left.currentBatting ?? 0) - (right.currentBatting ?? 0)
            || currentAbility(left) - currentAbility(right);
        }
        return (left.currentBatting ?? 0) - (right.currentBatting ?? 0)
          || currentAbility(left) - currentAbility(right);
      });

    const outgoing = (mode === "battingFirst"
      ? selectBattingFirstOutgoingBatter(startingXI, battingFirstOutgoingProtectedIds)
      : mode === "bowlingFirst"
      && isBattingOption(candidate)
      && (candidate.currentBatting ?? 0) >= PREMIUM_IMPACT_BATTING_RATING
      ? [...outgoingCandidates].sort((left, right) => {
        const leftPosition = findOptimalImpactBattingPosition(startingXI, candidate, left, true);
        const rightPosition = findOptimalImpactBattingPosition(startingXI, candidate, right, true);
        const leftComfortable = Number(canPlayerBatAtPosition(candidate, leftPosition));
        const rightComfortable = Number(canPlayerBatAtPosition(candidate, rightPosition));
        return rightComfortable - leftComfortable
          || Number(rightPosition <= 8) - Number(leftPosition <= 8)
          || (left.currentBatting ?? 0) - (right.currentBatting ?? 0)
          || currentAbility(left) - currentAbility(right);
      })[0]
      : outgoingCandidates[0]) ?? null;
    if (!outgoing) {
      return { outgoing: null, position: 11, inPreferredPos: false };
    }

    const position = isBattingOption(candidate)
      ? findOptimalImpactBattingPosition(startingXI, candidate, outgoing, mode === "bowlingFirst")
      : 11;
    const inPreferredPos = canPlayerBatAtPosition(candidate, position);

    return { outgoing, position, inPreferredPos };
  };

  const sortedLegalBench = [...legalBench].sort((left, right) => {
    if (mode === "bowlingFirst") {
      const leftEval = evaluateCandidate(left);
      const rightEval = evaluateCandidate(right);

      const leftPremium = (left.currentBatting ?? 0) >= PREMIUM_IMPACT_BATTING_RATING;
      const rightPremium = (right.currentBatting ?? 0) >= PREMIUM_IMPACT_BATTING_RATING;
      const leftComfortable = Number(leftEval.inPreferredPos && leftEval.position <= 8);
      const rightComfortable = Number(rightEval.inPreferredPos && rightEval.position <= 8);

      // For an 85+ incoming batter, comfort of the entry slot is the first
      // constraint; batting quality is the tie-breaker among comfortable
      // options.  This prevents a lower-rated but convenient bench player
      // from winning solely because they happen to fit an earlier slot.
      if (leftPremium || rightPremium) {
        if (leftComfortable !== rightComfortable) return rightComfortable - leftComfortable;
        if (leftPremium !== rightPremium) return Number(rightPremium) - Number(leftPremium);
        if (leftPremium && rightPremium) {
          return (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
            || currentAbility(right) - currentAbility(left)
            || (right.reputation ?? 0) - (left.reputation ?? 0);
        }
      }

      const leftPrefFit = Number(leftEval.position <= 7 && leftEval.inPreferredPos);
      const rightPrefFit = Number(rightEval.position <= 7 && rightEval.inPreferredPos);
      if (leftPrefFit !== rightPrefFit) return rightPrefFit - leftPrefFit;

      const leftTop7 = Number(leftEval.position <= 7);
      const rightTop7 = Number(rightEval.position <= 7);
      if (leftTop7 !== rightTop7) return rightTop7 - leftTop7;
    }

    const leftRelevant = mode === "battingFirst" ? (left.currentBowling ?? 0) : (left.currentBatting ?? 0);
    const rightRelevant = mode === "battingFirst" ? (right.currentBowling ?? 0) : (right.currentBatting ?? 0);
    return rightRelevant - leftRelevant
      || currentAbility(right) - currentAbility(left)
      || (right.reputation ?? 0) - (left.reputation ?? 0);
  });

  const initialImpactPlayer = sortedLegalBench[0] ?? null;
  const initialEval = initialImpactPlayer ? evaluateCandidate(initialImpactPlayer) : null;
  const impactRule = mode === "bowlingFirst"
    ? resolveBowlingFirstImpactPlayer(squad, startingXI, initialImpactPlayer, initialEval?.position)
    : { player: initialImpactPlayer, forcePosition8: false, replacedOpener: false };
  const impactPlayer = impactRule.player;
  if (!impactPlayer) return { impactPlayer: null, outgoingPlayer: null };

  const finalEval = evaluateCandidate(impactPlayer);
  return {
    impactPlayer,
    outgoingPlayer: finalEval.outgoing,
    impactBattingPosition: impactRule.forcePosition8 ? 8 : null,
  };
}

export function validateLineupPlan(plan: AiLineupPlan, squad: readonly Player[], mode?: AiLineupMode): boolean {
  if (plan.startingXI.length !== 11) return false;
  const starters = plan.startingXI.map((id) => squad.find((p) => p.id === id)).filter((p): p is Player => Boolean(p));
  if (starters.length !== 11) return false;

  const overseasCount = starters.filter(isOverseas).length;
  const impactPlayer = plan.impactPlayerId ? squad.find((p) => p.id === plan.impactPlayerId) : null;
  const totalOverseas = overseasCount + (impactPlayer && isOverseas(impactPlayer) ? 1 : 0);
  if (totalOverseas > 4) return false;

  if (!starters.some(isKeeper)) return false;
  if (starters.filter(isAiBowlingOption).length < 5) return false;

  const hasPace = starters.some((p) => isAiBowlingOption(p) && (p.role === "Pace Bowler" || p.bowlingStyle === "Pacer"));
  const hasSpin = starters.some((p) => isAiBowlingOption(p) && (p.role === "Spin Bowler" || p.bowlingStyle === "Spinner"));
  if (!hasPace || !hasSpin) return false;

  if (plan.captainId && !plan.startingXI.includes(plan.captainId)) return false;
  if (plan.viceCaptainId && !plan.startingXI.includes(plan.viceCaptainId)) return false;

  if (plan.likelyOutgoingPlayerId) {
    if (plan.captainId && plan.likelyOutgoingPlayerId === plan.captainId) return false;
    if (plan.viceCaptainId && plan.likelyOutgoingPlayerId === plan.viceCaptainId) return false;
    const outgoing = squad.find((p) => p.id === plan.likelyOutgoingPlayerId);
    if (outgoing && outgoing.reputation === 10) return false;
    if (outgoing && isKeeper(outgoing) && starters.filter(isKeeper).length <= 1) return false;
    if (outgoing && mode === "battingFirst" && plan.startingXI.slice(0, 2).includes(outgoing.id)) return false;
  }

  return true;
}

export function canPlayerBatAtPosition(player: Player, position: number): boolean {
  if (position === 1 || position === 2) return Boolean(player.isOpener);
  if (position === 3) return Boolean(player.hasBattedAt3 || player.isCoreBatter);
  if (position === 4) return Boolean(player.hasBattedAt4 || player.isCoreBatter);
  if (position === 5) return Boolean(player.hasBattedAt5 || player.isCoreBatter);
  if (position === 6) return Boolean(player.hasBattedAt6 || player.role === "All-Rounder" || player.isFinisher || player.isCoreBatter);
  if (position === 7) return Boolean(player.hasBattedAt7 || player.role === "All-Rounder" || player.isFinisher || player.isCoreBatter);
  return true;
}

export function findOptimalImpactBattingPosition(
  startingXI: readonly Player[],
  impactPlayer: Player,
  outgoingPlayer: Player,
  protectHighRatedOrder = false,
): number {
  const baseBatters = startingXI.filter((p) => p.id !== outgoingPlayer.id);

  let preferredPosOrder = [7, 6, 5, 4, 3, 2, 1];
  if (impactPlayer.isOpener) {
    preferredPosOrder = [2, 1, 3];
  } else if (impactPlayer.hasBattedAt3) {
    preferredPosOrder = [3, 4, 5, 2, 1];
  } else if (impactPlayer.hasBattedAt4) {
    preferredPosOrder = [4, 5, 6, 7, 3];
  } else if (impactPlayer.hasBattedAt5 || (impactPlayer.isCoreBatter && !impactPlayer.hasBattedAt6 && !impactPlayer.hasBattedAt7)) {
    preferredPosOrder = [5, 6, 7, 4];
  } else if (impactPlayer.isFinisher || (impactPlayer.role === "All-Rounder" && !impactPlayer.isCoreBatter)) {
    preferredPosOrder = [6, 7, 5];
  }
  if (!preferredPosOrder.includes(8)) preferredPosOrder.push(8);

  const originalPositions = new Map(startingXI.map((player, index) => [player.id, index + 1]));
  const highRatedPlayersToProtect = protectHighRatedOrder
    ? startingXI.filter((player) => (
      player.id !== outgoingPlayer.id
      && isBattingOption(player)
      && (player.currentBatting ?? 0) >= HIGH_BATTING_RATING
      && (player.currentBatting ?? 0) > (impactPlayer.currentBatting ?? 0)
    ))
    : [];

  for (const candidatePos of preferredPosOrder) {
    if (!canPlayerBatAtPosition(impactPlayer, candidatePos)) continue;

    const insertedLineup: Player[] = [];
    let inserted = false;

    for (let i = 0; i < baseBatters.length; i++) {
      const currentPos = insertedLineup.length + 1;
      if (currentPos === candidatePos && !inserted) {
        insertedLineup.push(impactPlayer);
        inserted = true;
      }
      insertedLineup.push(baseBatters[i]);
    }
    if (!inserted) {
      insertedLineup.push(impactPlayer);
    }

    // Test both orientations of a two-opener combination. When the incoming
    // player completes a designated partnership, also test its canonical
    // order (for example Head #1, Abhishek #2) before the generic variants.
    const testLineups: Player[][] = [insertedLineup];
    if (insertedLineup[0]?.isOpener && insertedLineup[1]?.isOpener) {
      testLineups.push([
        insertedLineup[1],
        insertedLineup[0],
        ...insertedLineup.slice(2),
      ]);
    }
    const specialPair = findSpecialOpenerPair(insertedLineup);
    if (specialPair) {
      const specialIds = new Set(specialPair.map((player) => player.id));
      testLineups.unshift([
        ...specialPair,
        ...insertedLineup.filter((player) => !specialIds.has(player.id)),
      ]);
    }

    const uniqueLineups = Array.from(new Map(
      testLineups.map((lineup) => [lineup.map((player) => player.id).join("|"), lineup]),
    ).values());

    for (const testLineup of uniqueLineups) {
      const actualImpactPosition = testLineup.findIndex((player) => player.id === impactPlayer.id) + 1;
      if (!canPlayerBatAtPosition(impactPlayer, actualImpactPosition)) continue;

      const preservesHighRatedOrder = highRatedPlayersToProtect.every((player) => {
        const originalPosition = originalPositions.get(player.id);
        const nextPosition = testLineup.findIndex((candidate) => candidate.id === player.id) + 1;
        // Positions one and two are equally natural for recognised openers, so
        // swapping them is not treated as displacing a high-rated batter.
        if (player.isOpener && (originalPosition === 1 || originalPosition === 2) && nextPosition <= 2) {
          return true;
        }
        return nextPosition === originalPosition;
      });
      if (!preservesHighRatedOrder) continue;

      const allMovedPlayersFit = testLineup.slice(0, 7).every((player, index) => {
        if (!isBattingOption(player)) return true;
        const position = index + 1;
        const originalPosition = originalPositions.get(player.id);
        if (player.id !== impactPlayer.id && originalPosition === position) return true;
        return canPlayerBatAtPosition(player, position);
      });

      if (allMovedPlayersFit) {
        return actualImpactPosition;
      }
    }
  }

  return 7;
}

function optimiseStrongAllRounderBowlFirstImpact(
  squad: readonly Player[],
  startingXI: readonly Player[],
  impactPlayer: Player | null,
  outgoingPlayer: Player | null,
  openingPair: readonly Player[],
  protectedIds: ReadonlySet<string>,
): {
  startingXI: Player[];
  impactPlayer: Player;
  outgoingPlayer: Player;
  forcedImpactBattingPosition: number | null;
} | null {
  if (
    !impactPlayer
    || impactPlayer.role !== "All-Rounder"
    || (impactPlayer.currentBatting ?? 0) < 80
    || (impactPlayer.currentBowling ?? 0) < 75
  ) {
    return null;
  }

  const originalSecondInningsBatting = startingXI.reduce(
    (total, player) => total + (player.currentBatting ?? 0),
    0,
  ) - (outgoingPlayer?.currentBatting ?? 0) + (impactPlayer.currentBatting ?? 0);

  const removableSpecialists = startingXI
    .filter((player) => isSpecialistBowler(player) && !protectedIds.has(player.id))
    .sort((left, right) => (
      (left.currentBowling ?? 0) - (right.currentBowling ?? 0)
      || currentAbility(left) - currentAbility(right)
    ));

  let best: {
    startingXI: Player[];
    impactPlayer: Player;
    outgoingPlayer: Player;
    forcedImpactBattingPosition: number | null;
    secondInningsBatting: number;
    startingBowling: number;
  } | null = null;

  removableSpecialists.forEach((removedSpecialist) => {
    const trialXI = startingXI
      .filter((player) => player.id !== removedSpecialist.id)
      .concat(impactPlayer);
    if (!hasBaseBalance(trialXI, "bowlingFirst")) return;

    const orderedTrialXI = orderStartingXI(
      trialXI,
      openingPair,
      "bowlingFirst",
      squad,
      protectedIds,
    );
    const trialIds = new Set(orderedTrialXI.map((player) => player.id));
    const pureBatter = squad
      .filter((player) => (
        !trialIds.has(player.id)
        && (player.role === "Batsman" || player.role === "WK-Batsman")
        && !isAiBowlingOption(player)
        && isImpactPlayerWithinOverseasLimit(orderedTrialXI, player)
      ))
      .sort((left, right) => (
        (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
        || currentAbility(right) - currentAbility(left)
        || (right.reputation ?? 0) - (left.reputation ?? 0)
      ))[0];
    if (!pureBatter) return;

    const resolvedImpact = resolveBowlingFirstImpactPlayer(
      squad,
      orderedTrialXI,
      pureBatter,
      pureBatter.isOpener ? 1 : null,
    );
    const finalImpact = resolvedImpact.player;
    if (!finalImpact || isAiBowlingOption(finalImpact)) return;

    const keepers = orderedTrialXI.filter(isKeeper);
    const trialOutgoing = [...orderedTrialXI]
      .filter((player) => (
        !protectedIds.has(player.id)
        && !(isKeeper(player) && keepers.length <= 1)
      ))
      .sort((left, right) => (
        (left.currentBatting ?? 0) - (right.currentBatting ?? 0)
        || currentAbility(left) - currentAbility(right)
      ))[0];
    if (!trialOutgoing) return;

    const secondInningsBatting = orderedTrialXI.reduce(
      (total, player) => total + (player.currentBatting ?? 0),
      0,
    ) - (trialOutgoing.currentBatting ?? 0) + (finalImpact.currentBatting ?? 0);
    if (secondInningsBatting <= originalSecondInningsBatting) return;

    const startingBowling = orderedTrialXI.reduce(
      (total, player) => total + (player.currentBowling ?? 0),
      0,
    );
    if (
      !best
      || secondInningsBatting > best.secondInningsBatting
      || (
        secondInningsBatting === best.secondInningsBatting
        && startingBowling > best.startingBowling
      )
    ) {
      best = {
        startingXI: orderedTrialXI,
        impactPlayer: finalImpact,
        outgoingPlayer: trialOutgoing,
        forcedImpactBattingPosition: resolvedImpact.forcePosition8 ? 8 : null,
        secondInningsBatting,
        startingBowling,
      };
    }
  });

  const selectedBest = best as {
    startingXI: Player[];
    impactPlayer: Player;
    outgoingPlayer: Player;
    forcedImpactBattingPosition: number | null;
  } | null;
  if (!selectedBest) return null;
  return {
    startingXI: selectedBest.startingXI,
    impactPlayer: selectedBest.impactPlayer,
    outgoingPlayer: selectedBest.outgoingPlayer,
    forcedImpactBattingPosition: selectedBest.forcedImpactBattingPosition,
  };
}

function buildPlan(
  squad: readonly Player[],
  mode: AiLineupMode,
  options: AiLineupOptions,
): AiLineupPlan {
  if (squad.length === 0) {
    return {
      startingXI: [],
      impactPlayerId: null,
      likelyOutgoingPlayerId: null,
      captainId: null,
      viceCaptainId: null,
      usesProvisionalCaptain: true,
    };
  }

  const openingPair = getOpeningPair(squad);
  const shouldUseProvisionalCaptain = options.useProvisionalCaptain ?? true;
  const captainSelection = options.captainId || shouldUseProvisionalCaptain
    ? getCaptain(squad, options.captainId)
    : { player: undefined, provisional: false };
  const viceCaptain = options.viceCaptainId
    ? squad.find((player) => player.id === options.viceCaptainId)
    : undefined;

  let startingPlayers = selectStartingPlayers(
    squad,
    mode,
    openingPair,
    captainSelection.player,
    viceCaptain,
  );
  const protectedIds = new Set<string>([
    ...openingPair.map((player) => player.id),
    ...squad.filter((player) => player.reputation === 10).map((player) => player.id),
    ...(captainSelection.player ? [captainSelection.player.id] : []),
    ...(viceCaptain ? [viceCaptain.id] : []),
  ]);
  const leadershipProtectedIds = new Set<string>([
    ...(captainSelection.player ? [captainSelection.player.id] : []),
    ...(viceCaptain ? [viceCaptain.id] : []),
  ]);
  let { impactPlayer, outgoingPlayer, impactBattingPosition: forcedImpactBattingPosition } = selectImpactPlayer(
    squad,
    startingPlayers,
    mode,
    protectedIds,
    leadershipProtectedIds,
  );

  if (mode === "bowlingFirst") {
    const optimisedImpactStructure = optimiseStrongAllRounderBowlFirstImpact(
      squad,
      startingPlayers,
      impactPlayer,
      outgoingPlayer,
      openingPair,
      protectedIds,
    );
    if (optimisedImpactStructure) {
      startingPlayers = optimisedImpactStructure.startingXI;
      impactPlayer = optimisedImpactStructure.impactPlayer;
      outgoingPlayer = optimisedImpactStructure.outgoingPlayer;
      forcedImpactBattingPosition = optimisedImpactStructure.forcedImpactBattingPosition;
    }
  }

  if (!impactPlayer && squad.length > 11) {
    const startingIds = new Set(startingPlayers.map((p) => p.id));
    const legalBench = squad
      .filter((p) => !startingIds.has(p.id) && isImpactPlayerWithinOverseasLimit(startingPlayers, p))
      .sort((left, right) => {
        if (mode === "bowlingFirst") {
          return (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
            || (right.currentBowling ?? 0) - (left.currentBowling ?? 0)
            || currentAbility(right) - currentAbility(left);
        }
        return (right.currentBowling ?? 0) - (left.currentBowling ?? 0)
          || (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
          || currentAbility(right) - currentAbility(left);
      });
    if (legalBench.length > 0) {
      impactPlayer = legalBench[0];
      const eligibleOutgoing = startingPlayers.filter((p) => !protectedIds.has(p.id));
      outgoingPlayer = eligibleOutgoing.sort((left, right) => currentAbility(left) - currentAbility(right))[0] ?? null;
      if (mode === "bowlingFirst") {
        const impactRule = resolveBowlingFirstImpactPlayer(
          squad,
          startingPlayers,
          impactPlayer,
          impactPlayer?.isOpener ? 1 : null,
        );
        impactPlayer = impactRule.player;
        forcedImpactBattingPosition = impactRule.forcePosition8 ? 8 : null;
      }
    }
  }

  let impactBattingPosition: number | null = forcedImpactBattingPosition ?? null;
  if (impactPlayer && outgoingPlayer && isBattingOption(impactPlayer)) {
    impactBattingPosition ??= findOptimalImpactBattingPosition(
      startingPlayers,
      impactPlayer,
      outgoingPlayer,
      mode === "bowlingFirst",
    );
  }

  return {
    startingXI: startingPlayers.map((player) => player.id),
    impactPlayerId: impactPlayer?.id ?? null,
    likelyOutgoingPlayerId: outgoingPlayer?.id ?? null,
    impactBattingPosition,
    captainId: captainSelection.player?.id ?? null,
    viceCaptainId: viceCaptain?.id ?? null,
    usesProvisionalCaptain: captainSelection.provisional,
  };
}

/**
 * Produces fresh plans from the current squad and current-ability values.
 * Matchday XII selector derives batFirst and bowlFirst formations with 10 shared core players.
 */
export function buildAiMatchLineups(
  squad: readonly Player[],
  options: AiLineupOptions = {},
): AiMatchLineups {
  const batFirstPlan = buildPlan(squad, "battingFirst", options);
  const bowlFirstPlan = buildPlan(squad, "bowlingFirst", options);

  return {
    battingFirst: batFirstPlan,
    bowlingFirst: bowlFirstPlan,
  };
}
