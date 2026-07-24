import type { Player, Team } from "@/lib/types";

import { buildAiMatchLineups, currentAbility } from "./aiLineupSelector";

export type AiCaptainReason = "sole-elite-leader" | "indian-three-year-leader" | "best-current-leader";
export type AiViceCaptainReason = "franchise-successor" | "second-best-current-leader";

export interface AiTeamLeadership {
  teamId: string;
  season: number;
  captainId: string | null;
  viceCaptainId: string | null;
  captainReason: AiCaptainReason | null;
  viceCaptainReason: AiViceCaptainReason | null;
}

export type AiLeagueLeadership = Record<string, AiTeamLeadership>;

const leadershipRanking = (left: Player, right: Player) => (
  (right.captaincy ?? 0) - (left.captaincy ?? 0)
  || (right.reputation ?? 0) - (left.reputation ?? 0)
  || currentAbility(right) - currentAbility(left)
  || left.age - right.age
  || left.name.localeCompare(right.name)
);

function representedTeamInSeason(
  player: Player,
  teamId: string,
  season: number,
  activeSeason: number,
): boolean {
  if (season === activeSeason && player.currentTeamId === teamId) return true;
  return player.iplHistory.some((entry) => (
    Number(entry.season) === season && entry.teamId === teamId
  ));
}

export function hasConsecutiveFranchiseSeasons(
  player: Player,
  teamId: string,
  activeSeason: number,
  requiredSeasons = 3,
): boolean {
  return Array.from({ length: requiredSeasons }, (_, offset) => activeSeason - offset)
    .every((season) => representedTeamInSeason(player, teamId, season, activeSeason));
}

function isFranchiseSuccessor(player: Player, teamId: string, season: number): boolean {
  const potentialAbility = Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0);
  return hasConsecutiveFranchiseSeasons(player, teamId, season)
    && player.nationality === "Indian"
    && player.age < 28
    && (player.captaincy ?? 0) >= 60
    && potentialAbility > 83
    && potentialAbility > currentAbility(player);
}

export function appointAiTeamLeadership(
  team: Team,
  squad: readonly Player[],
  season: number,
): AiTeamLeadership {
  const organicPlans = buildAiMatchLineups(squad, { useProvisionalCaptain: false });
  const bowlingFirstIds = new Set(organicPlans.bowlingFirst.startingXI);
  const bothLineups = organicPlans.battingFirst.startingXI
    .filter((playerId) => bowlingFirstIds.has(playerId));
  const commonStarterIds = new Set(bothLineups);
  const eligible = squad
    .filter((player) => commonStarterIds.has(player.id))
    .filter((player) => !player.isIplCaptaincyUnavailable);

  const eliteLeaders = eligible
    .filter((player) => (player.captaincy ?? 0) > 86)
    .sort(leadershipRanking);
  const soleEliteLeader = eliteLeaders.length === 1 ? eliteLeaders[0] : null;
  const threeYearIndianLeaders = eligible
    .filter((player) => (
      player.nationality === "Indian"
      && (player.captaincy ?? 0) >= 75
      && hasConsecutiveFranchiseSeasons(player, team.id, season)
    ))
    .sort(leadershipRanking);
  const captain = soleEliteLeader
    ?? threeYearIndianLeaders[0]
    ?? [...eligible].sort(leadershipRanking)[0]
    ?? null;
  const captainReason: AiCaptainReason | null = captain
    ? soleEliteLeader?.id === captain.id
      ? "sole-elite-leader"
      : threeYearIndianLeaders.some((player) => player.id === captain.id)
      ? "indian-three-year-leader"
      : "best-current-leader"
    : null;

  const viceCandidates = eligible.filter((player) => player.id !== captain?.id);
  const successionCandidates = viceCandidates
    .filter((player) => isFranchiseSuccessor(player, team.id, season))
    .sort((left, right) => (
      (right.captaincy ?? 0) - (left.captaincy ?? 0)
      || Math.max(right.potentialBatting ?? 0, right.potentialBowling ?? 0)
        - Math.max(left.potentialBatting ?? 0, left.potentialBowling ?? 0)
      || leadershipRanking(left, right)
    ));
  const viceCaptain = successionCandidates[0] ?? [...viceCandidates].sort(leadershipRanking)[0] ?? null;
  const viceCaptainReason: AiViceCaptainReason | null = viceCaptain
    ? successionCandidates.some((player) => player.id === viceCaptain.id)
      ? "franchise-successor"
      : "second-best-current-leader"
    : null;

  return {
    teamId: team.id,
    season,
    captainId: captain?.id ?? null,
    viceCaptainId: viceCaptain?.id ?? null,
    captainReason,
    viceCaptainReason,
  };
}

export function appointAiLeagueLeadership(
  teams: Record<string, Team>,
  players: Record<string, Player>,
  userTeamId: string,
  season: number,
): AiLeagueLeadership {
  return Object.values(teams).reduce<AiLeagueLeadership>((appointments, team) => {
    if (team.id === userTeamId) return appointments;
    const squad = team.squad
      .map((playerId) => players[playerId])
      .filter((player): player is Player => Boolean(player));
    appointments[team.id] = appointAiTeamLeadership(team, squad, season);
    return appointments;
  }, {});
}

export function reconcileAiLeagueLeadership(
  saved: AiLeagueLeadership | undefined,
  teams: Record<string, Team>,
  players: Record<string, Player>,
  userTeamId: string,
  season: number,
): AiLeagueLeadership {
  return Object.values(teams).reduce<AiLeagueLeadership>((appointments, team) => {
    if (team.id === userTeamId) return appointments;
    const existing = saved?.[team.id];
    if (existing && existing.season === season) {
      appointments[team.id] = existing;
      return appointments;
    }

    const squad = team.squad
      .map((playerId) => players[playerId])
      .filter((player): player is Player => Boolean(player));
    appointments[team.id] = appointAiTeamLeadership(team, squad, season);
    return appointments;
  }, {});
}
