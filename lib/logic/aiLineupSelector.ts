import type { Player } from "@/lib/types";

import { MIN_BOWLING_OPTION_RATING } from "./lineupPlanner";

export type AiLineupMode = "battingFirst" | "bowlingFirst";

export interface AiLineupPlan {
  startingXI: string[];
  impactPlayerId: string | null;
  likelyOutgoingPlayerId: string | null;
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

export const SPECIAL_OPENER_PAIRS = [
  ["virat-kohli", "phil-salt"],
  ["sunil-narine", "finn-allen"],
  ["yashasvi-jaiswal", "vaibhav-suryavanshi"],
  ["travis-head", "abhishek-sharma"],
  ["shubman-gill", "sai-sudharsan"],
  ["prabhsimran-singh", "priyansh-arya"],
] as const;

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

const isBattingOption = (player: Player) => (
  (player.currentBatting ?? 0) >= 68
  && (
    player.role === "Batsman"
    || player.role === "WK-Batsman"
    || player.role === "All-Rounder"
  )
);

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

const idMatches = (playerId: string, prefix: string) => (
  playerId === prefix || playerId.startsWith(`${prefix}-`) || playerId.startsWith(prefix)
);

function getOpeningPair(squad: readonly Player[]): Player[] {
  for (const [firstPrefix, secondPrefix] of SPECIAL_OPENER_PAIRS) {
    const first = squad.find((player) => idMatches(player.id, firstPrefix));
    const second = squad.find((player) => idMatches(player.id, secondPrefix));
    if (first && second) return [first, second];
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

function orderStartingXI(selected: readonly Player[], openingPair: readonly Player[]): Player[] {
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

  // Mirror the auction Potential XII ordering: locked openers first, genuine
  // core batters next, then finishers, followed by the remaining lower order.
  const coreBatters = remaining.filter((player) => (
    player.isCoreBatter
    && !player.isFinisher
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
  const finishers = remaining.filter((player) => player.isFinisher);
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

  return ordered.slice(0, 11);
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

  return selected.reduce((total, player) => total + selectionScore(player, mode), 0)
    + (mode === "battingFirst" ? battingOptions : bowlingOptions) * 140
    + (hasPace ? 80 : 0)
    + (hasSpin ? 80 : 0);
}

function hasBaseBalance(selected: readonly Player[]) {
  return selected.length === 11
    && selected.filter(isOverseas).length <= 4
    && selected.some(isKeeper)
    && selected.filter(isAiBowlingOption).length >= 5
    && selected.filter(isGenuineBatter).length >= MIN_GENUINE_BATTERS
    && selected.filter(isSpecialistBowler).length <= maxSpecialistBowlersFor(selected);
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
    Math.min(6, selected.filter(isBattingOption).length),
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

  const eligible = squad.filter((player) => !player.onlyOpensOrBenched || openingIds.has(player.id));
  const mandatory = eligible.filter((player) => mandatoryIds.has(player.id));
  if (mandatory.length > 11) {
    return orderStartingXI(
      [...mandatory]
        .sort((left, right) => selectionScore(right, mode) - selectionScore(left, mode))
        .slice(0, 11),
      openingPair,
    );
  }

  const optional = eligible.filter((player) => !mandatoryIds.has(player.id));
  let bestPreferred: { players: Player[]; score: number } | null = null;
  let bestFallback: { players: Player[]; score: number } | null = null;

  const consider = (selected: readonly Player[]) => {
    if (!hasBaseBalance(selected)) return;
    const battingOptions = selected.filter(isBattingOption).length;
    const bowlingOptions = selected.filter(isAiBowlingOption).length;
    const score = lineupScore(selected, mode);
    const candidate = { players: [...selected], score };

    if (!bestFallback || score > bestFallback.score) {
      bestFallback = candidate;
    }

    const meetsPreferredPlan = mode === "battingFirst"
      ? battingOptions >= 6
      : bowlingOptions >= 6;
    if (meetsPreferredPlan && (!bestPreferred || score > bestPreferred.score)) {
      bestPreferred = candidate;
    }
  };

  // Keep only the strongest partial XI for each balance signature. Selection
  // score is additive, while every non-additive rule (keeper, overseas,
  // batting/bowling depth and the dynamic bowler cap) is represented in the
  // signature. This produces the same optimal result without enumerating every
  // 11-player combination in a 24-26 player squad.
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
  if (selected) return orderStartingXI(selected, openingPair);

  // A malformed or unusually small squad still gets the strongest possible
  // preview, while normal auction-built squads always use the valid branch.
  const fallback = [...mandatory];
  [...optional]
    .sort((left, right) => selectionScore(right, mode) - selectionScore(left, mode))
    .forEach((player) => {
      if (fallback.length >= 11) return;
      if (isOverseas(player) && fallback.filter(isOverseas).length >= 4) return;
      fallback.push(player);
    });
  return orderStartingXI(fallback, openingPair);
}

function selectImpactPlayer(
  squad: readonly Player[],
  startingXI: readonly Player[],
  mode: AiLineupMode,
  protectedIds: ReadonlySet<string>,
) {
  const startingIds = new Set(startingXI.map((player) => player.id));
  const bench = squad.filter((player) => (
    !startingIds.has(player.id)
    && !player.onlyOpensOrBenched
    && (mode === "battingFirst" ? isAiBowlingOption(player) : isBattingOption(player))
  ));

  const legalBench = bench.filter((player) => (
    isImpactPlayerWithinOverseasLimit(startingXI, player)
  ));

  const impactPlayer = [...legalBench].sort((left, right) => {
    const leftRelevant = mode === "battingFirst" ? left.currentBowling : left.currentBatting;
    const rightRelevant = mode === "battingFirst" ? right.currentBowling : right.currentBatting;
    return rightRelevant - leftRelevant
      || currentAbility(right) - currentAbility(left)
      || (right.reputation ?? 0) - (left.reputation ?? 0);
  })[0] ?? null;

  if (!impactPlayer) return { impactPlayer: null, outgoingPlayer: null };

  const outgoingCandidates = startingXI
    .filter((player) => !protectedIds.has(player.id))
    .sort((left, right) => {
      if (mode === "battingFirst") {
        return (left.currentBowling ?? 0) - (right.currentBowling ?? 0)
          || currentAbility(left) - currentAbility(right);
      }
      return (left.currentBatting ?? 0) - (right.currentBatting ?? 0)
        || currentAbility(left) - currentAbility(right);
    });

  return { impactPlayer, outgoingPlayer: outgoingCandidates[0] ?? null };
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
  const startingPlayers = selectStartingPlayers(
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
  const { impactPlayer, outgoingPlayer } = selectImpactPlayer(
    squad,
    startingPlayers,
    mode,
    protectedIds,
  );

  return {
    startingXI: startingPlayers.map((player) => player.id),
    impactPlayerId: impactPlayer?.id ?? null,
    likelyOutgoingPlayerId: outgoingPlayer?.id ?? null,
    captainId: captainSelection.player?.id ?? null,
    viceCaptainId: viceCaptain?.id ?? null,
    usesProvisionalCaptain: captainSelection.provisional,
  };
}

/**
 * Produces fresh plans from the current squad and current-ability values. The
 * match engine should call this before every fixture rather than persisting one
 * AI XI for the whole season.
 */
export function buildAiMatchLineups(
  squad: readonly Player[],
  options: AiLineupOptions = {},
): AiMatchLineups {
  return {
    battingFirst: buildPlan(squad, "battingFirst", options),
    bowlingFirst: buildPlan(squad, "bowlingFirst", options),
  };
}
