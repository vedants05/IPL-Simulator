import type { Player, Role } from "../types";

export type AuctionRoleGroup = "BAT" | "WK" | "AR" | "PACE" | "SPIN";
export type AuctionMetric = "overall" | "batting" | "bowling" | "potential";

export interface AuctionMarketRoleProfile {
  overall: number[];
  batting: number[];
  bowling: number[];
  potential: number[];
}

export interface AuctionMarketProfile {
  version: 1;
  roles: Record<AuctionRoleGroup, AuctionMarketRoleProfile>;
}

const ROLE_GROUPS: AuctionRoleGroup[] = ["BAT", "WK", "AR", "PACE", "SPIN"];

// Used only by the offline calibration script to reproduce the pre-career
// auction baseline. The live game always uses the adaptive mode.
let calibrationMode: "adaptive" | "legacy" = "adaptive";

export function setAuctionCalibrationMode(mode: "adaptive" | "legacy"): void {
  calibrationMode = mode;
}

export function getAuctionRoleGroup(player: Pick<Player, "role" | "isWicketkeeper" | "isPartTimeWk">): AuctionRoleGroup {
  if (player.role === "WK-Batsman" || (player.isWicketkeeper && !player.isPartTimeWk)) return "WK";
  if (player.role === "All-Rounder") return "AR";
  if (player.role === "Pace Bowler") return "PACE";
  if (player.role === "Spin Bowler") return "SPIN";
  return "BAT";
}

function allRounderBlend(stronger: number, weaker: number): number {
  const gap = stronger - weaker;
  return gap >= 7
    ? stronger * 0.8 + weaker * 0.2
    : stronger * 0.6 + weaker * 0.4;
}

export function getRawAuctionRating(player: Player): number {
  const batting = player.currentBatting ?? 0;
  const bowling = player.currentBowling ?? 0;
  if (calibrationMode === "legacy") return Math.max(batting, bowling);
  const role = getAuctionRoleGroup(player);
  if (role === "AR") return Math.round(allRounderBlend(Math.max(batting, bowling), Math.min(batting, bowling)));
  if (role === "PACE" || role === "SPIN") return bowling;
  return batting;
}

export function getRawAuctionPotential(player: Player): number {
  const batting = player.potentialBatting ?? player.currentBatting ?? 0;
  const bowling = player.potentialBowling ?? player.currentBowling ?? 0;
  if (calibrationMode === "legacy") return Math.max(batting, bowling);
  const role = getAuctionRoleGroup(player);
  if (role === "AR") return Math.round(allRounderBlend(Math.max(batting, bowling), Math.min(batting, bowling)));
  if (role === "PACE" || role === "SPIN") return bowling;
  return batting;
}

export function getAuctionRating(player: Player): number {
  return player.auctionRating ?? getRawAuctionRating(player);
}

export function getAuctionBattingRating(player: Player): number {
  return player.auctionBattingRating ?? player.currentBatting ?? 0;
}

export function getAuctionBowlingRating(player: Player): number {
  return player.auctionBowlingRating ?? player.currentBowling ?? 0;
}

export function getAuctionPotentialRating(player: Player): number {
  return player.auctionPotentialRating ?? getRawAuctionPotential(player);
}

export function hasOpeningSeasonDhoniRetirementGrace(player: Player): boolean {
  return player.name === "MS Dhoni"
    && player.careerState?.lastAgedSeason === 2027
    && player.careerState.lastDevelopmentSeason === undefined;
}

export function isPlayerAuctionEligible(player: Player): boolean {
  if (calibrationMode === "legacy") return true;
  if (
    player.age >= 40
    && Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0) < 80
    && !hasOpeningSeasonDhoniRetirementGrace(player)
  ) return false;
  return getRawAuctionRating(player) >= 67;
}

function emptyProfile(): AuctionMarketProfile {
  return {
    version: 1,
    roles: Object.fromEntries(ROLE_GROUPS.map((role) => [role, {
      overall: [], batting: [], bowling: [], potential: [],
    }])) as unknown as Record<AuctionRoleGroup, AuctionMarketRoleProfile>,
  };
}

export function createAuctionMarketProfile(players: Iterable<Player>): AuctionMarketProfile {
  const profile = emptyProfile();
  Array.from(players).forEach((player) => {
    const role = getAuctionRoleGroup(player);
    profile.roles[role].overall.push(getRawAuctionRating(player));
    profile.roles[role].batting.push(player.currentBatting ?? 0);
    profile.roles[role].bowling.push(player.currentBowling ?? 0);
    profile.roles[role].potential.push(getRawAuctionPotential(player));
  });
  ROLE_GROUPS.forEach((role) => {
    (Object.keys(profile.roles[role]) as AuctionMetric[]).forEach((metric) => {
      profile.roles[role][metric].sort((left, right) => left - right);
    });
  });
  return profile;
}

export function normalizeAuctionMarketProfile(value: unknown, fallbackPlayers: Iterable<Player>): AuctionMarketProfile {
  if (!value || typeof value !== "object" || (value as AuctionMarketProfile).version !== 1) {
    return createAuctionMarketProfile(fallbackPlayers);
  }
  const supplied = value as AuctionMarketProfile;
  const fallback = createAuctionMarketProfile(fallbackPlayers);
  const normalized = emptyProfile();
  ROLE_GROUPS.forEach((role) => {
    (Object.keys(normalized.roles[role]) as AuctionMetric[]).forEach((metric) => {
      const ratings = supplied.roles?.[role]?.[metric];
      normalized.roles[role][metric] = Array.isArray(ratings) && ratings.length > 0
        ? ratings.filter(Number.isFinite).map(Number).sort((a, b) => a - b)
        : fallback.roles[role][metric];
    });
  });
  return normalized;
}

function quantile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const position = Math.max(0, Math.min(1, percentile)) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function normalizedMetricByPlayer(
  players: Player[],
  rawValue: (player: Player) => number,
  baseline: number[],
): Map<string, number> {
  const sorted = [...players].sort((left, right) => rawValue(left) - rawValue(right) || left.id.localeCompare(right.id));
  const result = new Map<string, number>();
  let index = 0;
  while (index < sorted.length) {
    const value = rawValue(sorted[index]);
    let end = index;
    while (end + 1 < sorted.length && rawValue(sorted[end + 1]) === value) end += 1;
    const percentile = sorted.length <= 1 ? 0.5 : ((index + end) / 2) / (sorted.length - 1);
    const normalized = Math.round(quantile(baseline, percentile));
    for (let cursor = index; cursor <= end; cursor += 1) result.set(sorted[cursor].id, normalized);
    index = end + 1;
  }
  return result;
}

export function applyAuctionMarketRatings(
  players: Record<string, Player>,
  baseline: AuctionMarketProfile,
): Record<string, Player> {
  const byRole = Object.fromEntries(ROLE_GROUPS.map((role) => [role, [] as Player[]])) as Record<AuctionRoleGroup, Player[]>;
  Object.values(players).forEach((player) => byRole[getAuctionRoleGroup(player)].push(player));
  const output = { ...players };

  ROLE_GROUPS.forEach((role) => {
    const rolePlayers = byRole[role];
    if (rolePlayers.length === 0) return;
    const profile = baseline.roles[role];
    const overall = normalizedMetricByPlayer(rolePlayers, getRawAuctionRating, profile.overall);
    const batting = normalizedMetricByPlayer(rolePlayers, (player) => player.currentBatting ?? 0, profile.batting);
    const bowling = normalizedMetricByPlayer(rolePlayers, (player) => player.currentBowling ?? 0, profile.bowling);
    const potential = normalizedMetricByPlayer(rolePlayers, getRawAuctionPotential, profile.potential);
    rolePlayers.forEach((player) => {
      output[player.id] = {
        ...player,
        auctionRating: overall.get(player.id),
        auctionBattingRating: batting.get(player.id),
        auctionBowlingRating: bowling.get(player.id),
        auctionPotentialRating: potential.get(player.id),
      };
    });
  });
  return output;
}

export function roleForGeneratedPlayer(group: AuctionRoleGroup): Role {
  if (group === "WK") return "WK-Batsman";
  if (group === "AR") return "All-Rounder";
  if (group === "PACE") return "Pace Bowler";
  if (group === "SPIN") return "Spin Bowler";
  return "Batsman";
}
