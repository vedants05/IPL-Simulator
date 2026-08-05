import type { Player, Team } from "@/lib/types";
import type { PlayerInjury } from "./injuries";
import { getPlayerSeasonHistory } from "./playerHistory";
import { isPlayerAuctionEligible } from "./auctionMarket";

export const MAX_INJURY_REPLACEMENTS_PER_TEAM = 5;

export interface InjuryReplacementRecord {
  id: string;
  season: number;
  teamId: string;
  injuryId: string;
  injuredPlayerId: string;
  injuredPlayerName: string;
  replacementPlayerId: string;
  replacementPlayerName: string;
  signedOn: string;
  salary: number;
}

export interface InjuryReplacementWindow {
  date: string;
  season: number;
  seasonFinalDate?: string;
  teamFinalLeagueDate?: string;
}

export function injuryQualifiesForReplacement(
  injury: PlayerInjury,
  window: InjuryReplacementWindow,
): boolean {
  return injury.season === window.season
    && injury.category === "major"
    && Boolean(window.seasonFinalDate)
    && injury.actualReturnDate > window.seasonFinalDate!
    && Boolean(window.teamFinalLeagueDate)
    && window.date <= window.teamFinalLeagueDate!;
}

export function getInjuredPlayerSalary(player: Player, teamId: string, season: number): number {
  const activeContract = getPlayerSeasonHistory(player.iplHistory, String(season));
  if (activeContract?.teamId === teamId && activeContract.price > 0) return activeContract.price;
  const latestContract = [...(player.iplHistory ?? [])]
    .filter((entry) => entry.teamId === teamId && entry.price > 0 && Number(entry.season) <= season)
    .sort((left, right) => Number(right.season) - Number(left.season))[0];
  return Math.round(latestContract?.price ?? 0);
}

export function teamReplacementCount(
  records: readonly InjuryReplacementRecord[],
  teamId: string,
  season: number,
): number {
  return records.filter((record) => record.teamId === teamId && record.season === season).length;
}

export function replacementForInjury(
  records: readonly InjuryReplacementRecord[],
  injuryId: string,
): InjuryReplacementRecord | undefined {
  return records.find((record) => record.injuryId === injuryId);
}

export function eligibleInjuryReplacementCandidates(input: {
  injury: PlayerInjury;
  players: Record<string, Player>;
  unsoldPlayerIds: readonly string[];
  records: readonly InjuryReplacementRecord[];
  season: number;
}): Player[] {
  const injuredPlayer = input.players[input.injury.playerId];
  if (!injuredPlayer) return [];
  const salaryCeiling = getInjuredPlayerSalary(injuredPlayer, input.injury.teamId, input.season);
  if (salaryCeiling <= 0) return [];
  const alreadySigned = new Set(input.records.map((record) => record.replacementPlayerId));
  return Array.from(new Set(input.unsoldPlayerIds))
    .map((playerId) => input.players[playerId])
    .filter((player): player is Player => Boolean(player))
    .filter((player) => player.currentTeamId === null)
    .filter((player) => !alreadySigned.has(player.id))
    .filter((player) => player.basePrice > 0 && player.basePrice <= salaryCeiling)
    .filter(isPlayerAuctionEligible);
}

const rating = (player: Player) => Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
const potential = (player: Player) => Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0);

export function scoreInjuryReplacementCandidate(input: {
  candidate: Player;
  injuredPlayer: Player;
  team: Team;
  players: Record<string, Player>;
  activeInjuries: Record<string, PlayerInjury>;
}): number {
  const { candidate, injuredPlayer, team, players, activeInjuries } = input;
  const availableSquad = team.squad
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player) && !activeInjuries[player.id]);
  const sameRoleCount = availableSquad.filter((player) => player.role === injuredPlayer.role).length;
  const candidateRoleCount = availableSquad.filter((player) => player.role === candidate.role).length;
  const roleNeed = candidate.role === injuredPlayer.role
    ? 20 + Math.max(0, 3 - sameRoleCount) * 7
    : Math.max(0, 3 - candidateRoleCount) * 5;
  const youthUpside = candidate.age <= 25
    ? Math.max(0, potential(candidate) - rating(candidate)) * 1.4 + Math.max(0, 26 - candidate.age)
    : 0;
  const overseasNeed = candidate.nationality === "Overseas"
    ? Math.max(0, 6 - availableSquad.filter((player) => player.nationality === "Overseas").length) * 3
    : 4;
  const priceEfficiency = Math.max(0, 200 - candidate.basePrice) / 40;
  return rating(candidate) * 4 + potential(candidate) * 1.2 + roleNeed + youthUpside + overseasNeed + priceEfficiency;
}
