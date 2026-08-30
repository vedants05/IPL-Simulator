import type { Player } from "@/lib/types";

export interface TeamLeadership {
  captainId: string | null;
  viceCaptainId: string | null;
  captainChangeLockedUntilGamesPlayed: number | null;
  temporaryUninterestedThroughSeason: Record<string, number>;
  permanentlyUninterestedPlayerIds: string[];
}

export interface TeamLeadershipContinuity {
  captainId?: string | null;
  viceCaptainId?: string | null;
}

export const CAPTAIN_CHANGE_COOLDOWN_GAMES = 3;

export const EMPTY_TEAM_LEADERSHIP: TeamLeadership = {
  captainId: null,
  viceCaptainId: null,
  captainChangeLockedUntilGamesPlayed: null,
  temporaryUninterestedThroughSeason: {},
  permanentlyUninterestedPlayerIds: [],
};

const isObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === "object"
);

export const isInterestedInIplCaptaincy = (player: Player, activeSeason = 0): boolean => (
  !player.isIplCaptaincyUnavailable
  && (
    player.iplCaptaincyUninterestedThroughSeason === undefined
    || (activeSeason > 0 && player.iplCaptaincyUninterestedThroughSeason < activeSeason)
  )
);

export interface CaptaincyInterestStatus {
  interested: boolean;
  temporarilyUnavailable: boolean;
  permanentlyUnavailable: boolean;
  uninterestedThroughSeason: number | null;
}

export function getCaptaincyInterestStatus(
  player: Player,
  leadership: TeamLeadership,
  activeSeason: number,
): CaptaincyInterestStatus {
  if (player.isIplCaptaincyUnavailable || leadership.permanentlyUninterestedPlayerIds.includes(player.id)) {
    return {
      interested: false,
      temporarilyUnavailable: false,
      permanentlyUnavailable: true,
      uninterestedThroughSeason: null,
    };
  }

  const uninterestedThroughSeason = Math.max(
    leadership.temporaryUninterestedThroughSeason[player.id] ?? -1,
    player.iplCaptaincyUninterestedThroughSeason ?? -1,
  );
  const temporarilyUnavailable = uninterestedThroughSeason >= activeSeason;
  return {
    interested: !temporarilyUnavailable,
    temporarilyUnavailable,
    permanentlyUnavailable: false,
    uninterestedThroughSeason: temporarilyUnavailable ? uninterestedThroughSeason : null,
  };
}

export const getCaptainChangeGamesRemaining = (
  leadership: TeamLeadership,
  gamesPlayed: number,
): number => Math.max(
  0,
  (leadership.captainChangeLockedUntilGamesPlayed ?? gamesPlayed) - gamesPlayed,
);

export const sortByCaptaincy = (players: Player[]): Player[] => (
  [...players].sort((left, right) => (
    (right.captaincy ?? 50) - (left.captaincy ?? 50)
    || left.name.localeCompare(right.name)
  ))
);

export function normalizeTeamLeadership(
  value: unknown,
  squad: Player[],
  gamesPlayed = 0,
  activeSeason = 0,
): TeamLeadership {
  const raw = isObject(value) ? value : {};
  const squadById = new Map(squad.map((player) => [player.id, player]));
  const permanentlyUninterestedPlayerIds = new Set<string>();
  if (Array.isArray(raw.permanentlyUninterestedPlayerIds)) {
    raw.permanentlyUninterestedPlayerIds.forEach((playerId) => {
      if (typeof playerId === "string" && squadById.has(playerId)) permanentlyUninterestedPlayerIds.add(playerId);
    });
  }
  const rawTemporaryInterest = isObject(raw.temporaryUninterestedThroughSeason)
    ? raw.temporaryUninterestedThroughSeason
    : {};
  const temporaryUninterestedThroughSeason: Record<string, number> = {};

  Object.entries(rawTemporaryInterest).forEach(([playerId, value]) => {
    const player = squadById.get(playerId);
    if (!player || !isInterestedInIplCaptaincy(player, activeSeason) || typeof value !== "number" || !Number.isFinite(value)) return;
    if (player.age >= 33) {
      permanentlyUninterestedPlayerIds.add(playerId);
      return;
    }
    const unavailableThroughSeason = Math.floor(value);
    if (unavailableThroughSeason >= activeSeason) {
      temporaryUninterestedThroughSeason[playerId] = unavailableThroughSeason;
    }
  });

  // Migrate the previous three-game interest cooldown into the longer rule.
  const legacyTemporaryInterest = isObject(raw.temporaryUninterestedUntilGamesPlayed)
    ? raw.temporaryUninterestedUntilGamesPlayed
    : {};
  Object.entries(legacyTemporaryInterest).forEach(([playerId, value]) => {
    const player = squadById.get(playerId);
    if (!player || !isInterestedInIplCaptaincy(player, activeSeason) || typeof value !== "number" || value <= gamesPlayed) return;
    if (player.age >= 33) {
      permanentlyUninterestedPlayerIds.add(playerId);
    } else {
      temporaryUninterestedThroughSeason[playerId] ??= activeSeason + 1;
    }
  });

  const isEligible = (playerId: string) => {
    const player = squadById.get(playerId);
    return Boolean(
      player
      && isInterestedInIplCaptaincy(player, activeSeason)
      && !permanentlyUninterestedPlayerIds.has(playerId)
      && temporaryUninterestedThroughSeason[playerId] === undefined,
    );
  };
  const captainId = typeof raw.captainId === "string" && isEligible(raw.captainId)
    ? raw.captainId
    : null;
  const viceCaptainId = typeof raw.viceCaptainId === "string"
    && raw.viceCaptainId !== captainId
    && isEligible(raw.viceCaptainId)
    ? raw.viceCaptainId
    : null;
  const rawLock = raw.captainChangeLockedUntilGamesPlayed;
  const captainChangeLockedUntilGamesPlayed = captainId
    && typeof rawLock === "number"
    && Number.isFinite(rawLock)
    && Math.floor(rawLock) > gamesPlayed
    ? Math.floor(rawLock)
    : null;

  return {
    captainId,
    viceCaptainId,
    captainChangeLockedUntilGamesPlayed,
    temporaryUninterestedThroughSeason,
    permanentlyUninterestedPlayerIds: Array.from(permanentlyUninterestedPlayerIds),
  };
}

/**
 * Restores the previous season's leadership appointments after the auction has
 * rebuilt the squad. Explicit null continuity values clear released leaders;
 * undefined values retain legacy saved appointments for older careers.
 */
export function restoreTeamLeadershipContinuity(
  value: unknown,
  squad: Player[],
  continuity: TeamLeadershipContinuity,
  gamesPlayed = 0,
  activeSeason = 0,
): TeamLeadership {
  const raw = isObject(value) ? value : {};
  const squadIds = new Set(squad.map((player) => player.id));
  const restoreId = (continuityId: string | null | undefined, savedId: unknown): string | null => {
    const candidateId = continuityId === undefined ? savedId : continuityId;
    return typeof candidateId === "string" && squadIds.has(candidateId)
      ? candidateId
      : null;
  };
  const captainId = restoreId(continuity.captainId, raw.captainId);
  const viceCaptainId = restoreId(continuity.viceCaptainId, raw.viceCaptainId);

  // Normalize cooldown and interest metadata separately from the incumbent
  // appointments. Interest controls whether a player accepts a new role; it
  // must not silently remove an existing captain or vice-captain who was kept
  // by the franchise. Retention membership is authoritative at rollover.
  const normalized = normalizeTeamLeadership({
    ...raw,
    captainId: null,
    viceCaptainId: null,
  }, squad, gamesPlayed, activeSeason);

  return {
    ...normalized,
    captainId,
    viceCaptainId: viceCaptainId !== captainId ? viceCaptainId : null,
    captainChangeLockedUntilGamesPlayed: null,
  };
}

export function recommendTeamLeadership(
  squad: Player[],
  leadership: TeamLeadership = EMPTY_TEAM_LEADERSHIP,
  gamesPlayed = 0,
  activeSeason = 0,
): TeamLeadership {
  const normalized = normalizeTeamLeadership(leadership, squad, gamesPlayed, activeSeason);
  const candidates = sortByCaptaincy(squad.filter((player) => (
    getCaptaincyInterestStatus(player, normalized, activeSeason).interested
  )));
  if (normalized.captainId) {
    return {
      ...normalized,
      viceCaptainId: normalized.viceCaptainId
        ?? candidates.find((player) => player.id !== normalized.captainId)?.id
        ?? null,
    };
  }

  return {
    ...normalized,
    captainId: candidates[0]?.id ?? null,
    viceCaptainId: candidates[1]?.id ?? null,
  };
}

export function appointCaptain(
  leadership: TeamLeadership,
  playerId: string,
  squad: Player[],
  gamesPlayed = 0,
  activeSeason = 0,
): TeamLeadership {
  const normalized = normalizeTeamLeadership(leadership, squad, gamesPlayed, activeSeason);
  if (normalized.captainId) return normalized;
  const player = squad.find((candidate) => candidate.id === playerId);
  if (!player || !getCaptaincyInterestStatus(player, normalized, activeSeason).interested) return normalized;

  return normalizeTeamLeadership({
    ...normalized,
    captainId: playerId,
    viceCaptainId: normalized.viceCaptainId === playerId ? null : normalized.viceCaptainId,
  }, squad, gamesPlayed, activeSeason);
}

export function confirmCaptainChange(
  leadership: TeamLeadership,
  playerId: string,
  squad: Player[],
  gamesPlayed: number,
  activeSeason: number,
): TeamLeadership {
  const normalized = normalizeTeamLeadership(leadership, squad, gamesPlayed, activeSeason);
  if (!normalized.captainId) return appointCaptain(normalized, playerId, squad, gamesPlayed, activeSeason);
  if (getCaptainChangeGamesRemaining(normalized, gamesPlayed) > 0) return normalized;
  if (normalized.captainId === playerId) return normalized;

  const player = squad.find((candidate) => candidate.id === playerId);
  if (!player || !getCaptaincyInterestStatus(player, normalized, activeSeason).interested) return normalized;

  const outgoingCaptainId = normalized.captainId;
  const outgoingCaptain = squad.find((candidate) => candidate.id === outgoingCaptainId);
  const unavailableUntil = gamesPlayed + CAPTAIN_CHANGE_COOLDOWN_GAMES;
  const outgoingCaptainIsPermanent = (outgoingCaptain?.age ?? 0) >= 33;
  return normalizeTeamLeadership({
    ...normalized,
    captainId: playerId,
    viceCaptainId: normalized.viceCaptainId === playerId ? null : normalized.viceCaptainId,
    captainChangeLockedUntilGamesPlayed: unavailableUntil,
    temporaryUninterestedThroughSeason: {
      ...normalized.temporaryUninterestedThroughSeason,
      ...(outgoingCaptainIsPermanent ? {} : { [outgoingCaptainId]: activeSeason + 1 }),
    },
    permanentlyUninterestedPlayerIds: outgoingCaptainIsPermanent
      ? [...normalized.permanentlyUninterestedPlayerIds, outgoingCaptainId]
      : normalized.permanentlyUninterestedPlayerIds,
  }, squad, gamesPlayed, activeSeason);
}

export function appointViceCaptain(
  leadership: TeamLeadership,
  playerId: string,
  squad: Player[],
  gamesPlayed = 0,
  activeSeason = 0,
): TeamLeadership {
  const normalized = normalizeTeamLeadership(leadership, squad, gamesPlayed, activeSeason);
  const player = squad.find((candidate) => candidate.id === playerId);
  if (!player || !getCaptaincyInterestStatus(player, normalized, activeSeason).interested) return normalized;
  if (normalized.captainId === playerId || normalized.viceCaptainId === playerId) return normalized;

  return normalizeTeamLeadership({
    ...normalized,
    viceCaptainId: playerId,
  }, squad, gamesPlayed, activeSeason);
}
