import type { Player } from "@/lib/types";
import type { InternationalCareerState, InternationalPlayerProfile } from "@/lib/logic/international";
import { INTERNATIONAL_TEAMS } from "@/lib/logic/international";

export interface SelectionPerformance {
  matches: number;
  runs: number;
  wickets: number;
  recent: Array<{ runs: number; wickets: number }>;
}

export type InternationalCareerStatus =
  | "National Team Captain" | "In the First XI" | "In the Squad"
  | "Call-Up Expected" | "Selection Contender" | "On the Selection Radar"
  | "Distant from Selection" | "T20I Retired" | "Selection Untracked";

const clamp = (value: number) => Math.max(0, Math.min(100, value));

function roleOf(profile: InternationalPlayerProfile): string {
  if (profile.role === "WK-Batsman" || profile.isWicketkeeper) return "keeper";
  if (profile.role === "Pace Bowler") return "pace";
  if (profile.role === "Spin Bowler") return "spin";
  if (profile.role === "All-Rounder") return "all-rounder";
  return profile.isOpener || profile.battingPositions?.some((position) => position <= 2) ? "opener" : "batter";
}

function merit(profile: InternationalPlayerProfile, player: Player | undefined, performance: SelectionPerformance | undefined): number {
  const role = roleOf(profile);
  const bowling = role === "pace" || role === "spin";
  const allRounder = role === "all-rounder";
  const ability = allRounder ? profile.batting * 0.5 + profile.bowling * 0.5
    : bowling ? profile.bowling : profile.batting;
  const matches = performance?.matches ?? player?.careerState?.lastSeasonMatches ?? 0;
  const runs = performance?.runs ?? player?.careerState?.lastSeasonRuns ?? 0;
  const wickets = performance?.wickets ?? player?.careerState?.lastSeasonWickets ?? 0;
  const battingImpact = clamp(matches ? runs / matches / 0.5 : 50);
  const bowlingImpact = clamp(matches ? wickets / matches / 0.025 : 50);
  const seasonImpact = allRounder ? (battingImpact + bowlingImpact) / 2 : bowling ? bowlingImpact : battingImpact;
  const recent = performance?.recent.slice(0, 5) ?? [];
  const recentBatting = recent.length ? clamp(recent.reduce((sum, row) => sum + row.runs, 0) / recent.length / 0.5) : 50;
  const recentBowling = recent.length ? clamp(recent.reduce((sum, row) => sum + row.wickets, 0) / recent.length / 0.025) : 50;
  const recentImpact = allRounder ? (recentBatting + recentBowling) / 2 : bowling ? recentBowling : recentBatting;
  // A short season is blended with a neutral result so one match does not dominate.
  const seasonWeight = Math.min(1, matches / 5);
  const recentWeight = Math.min(1, recent.length / 5);
  return ability * 0.5 + (50 + (seasonImpact - 50) * seasonWeight) * 0.35
    + (50 + (recentImpact - 50) * recentWeight) * 0.15;
}

export function getInternationalCareerStatus(
  player: Player,
  career: InternationalCareerState | null | undefined,
  players: Record<string, Player>,
  performance: Record<string, SelectionPerformance>,
): InternationalCareerStatus {
  if (player.isT20IRetired) return "T20I Retired";
  const nation = INTERNATIONAL_TEAMS.find((team) => team.name === (player.country ?? (player.nationality === "Indian" ? "India" : "")));
  if (!nation?.core || !career?.teams[nation.id]) return "Selection Untracked";
  const team = career.teams[nation.id];
  const id = `full:${player.id}`;
  if (team.captainId === id) return "National Team Captain";
  if (team.preferredXI.includes(id)) return "In the First XI";
  if (team.squad.includes(id)) return "In the Squad";

  const profile = career.profiles[id];
  if (!profile) return "Distant from Selection";
  const role = roleOf(profile);
  const score = merit(profile, player, performance[player.id]);
  const peers = Object.values(career.profiles).filter((candidate) =>
    candidate.countryId === nation.id && !candidate.isT20IRetired && roleOf(candidate) === role);
  const outside = peers.filter((candidate) => !team.squad.includes(candidate.id))
    .sort((a, b) => merit(b, b.fullPlayerId ? players[b.fullPlayerId] : undefined, b.fullPlayerId ? performance[b.fullPlayerId] : undefined)
      - merit(a, a.fullPlayerId ? players[a.fullPlayerId] : undefined, a.fullPlayerId ? performance[a.fullPlayerId] : undefined));
  const squadScores = peers.filter((candidate) => team.squad.includes(candidate.id))
    .map((candidate) => merit(candidate, candidate.fullPlayerId ? players[candidate.fullPlayerId] : undefined,
      candidate.fullPlayerId ? performance[candidate.fullPlayerId] : undefined));
  const cutoff = squadScores.length ? Math.min(...squadScores) : nation.strength;
  const matches = performance[player.id]?.matches ?? player.careerState?.lastSeasonMatches ?? 0;
  const runs = performance[player.id]?.runs ?? player.careerState?.lastSeasonRuns ?? 0;
  const wickets = performance[player.id]?.wickets ?? player.careerState?.lastSeasonWickets ?? 0;
  const callUpQualified = player.currentBatting >= 86 || player.currentBowling >= 86
    || runs >= 400 || wickets >= 21
    || (Math.max(player.currentBatting, player.currentBowling) >= Math.max(78, nation.strength - 13)
      && matches >= 5 && (runs >= 250 || wickets >= 12));
  const outsideRank = outside.findIndex((candidate) => candidate.id === id);
  if (team.pendingDebuts[id] !== undefined || player.internationalCallUpSeason !== undefined && !player.internationalDebutDate
    || callUpQualified && outsideRank >= 0 && outsideRank < 2) return "Call-Up Expected";
  if (score >= cutoff - 8) return "Selection Contender";
  if (score >= cutoff - 18) return "On the Selection Radar";
  return "Distant from Selection";
}
