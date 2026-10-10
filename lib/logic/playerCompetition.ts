import type { Player, Team } from "@/lib/types";
import type { PlayerInjury } from "@/lib/logic/injuries";

export type CompetitionRole = "opener" | "keeper" | "finisher" | "middle" | "allrounder" | "pace" | "spin";
export interface CompetitionEntry {
  player: Player;
  rank: number;
  reason: string;
}
export interface PlayerCompetition {
  team: Team | null;
  role: CompetitionRole;
  roleLabel: string;
  projectedForUserTeam: boolean;
  order: CompetitionEntry[];
  selectedRank: number;
  leagueRival: Player | null;
  leagueRivalTeam: Team | null;
  leagueReason: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function competitionRole(player: Player): CompetitionRole {
  if (player.role === "WK-Batsman" || (player.isWicketkeeper && !player.isPartTimeWk)) return "keeper";
  if (player.isOpener || player.onlyOpensOrBenched) return "opener";
  if (player.role === "All-Rounder") return "allrounder";
  if (player.role === "Pace Bowler") return "pace";
  if (player.role === "Spin Bowler") return "spin";
  if (player.isFinisher) return "finisher";
  return "middle";
}

const roleLabels: Record<CompetitionRole, string> = {
  opener: "Opening batters", keeper: "Wicketkeepers", finisher: "Finishers",
  middle: "Middle order batters", allrounder: "All-rounders",
  pace: "Pace bowlers", spin: "Spin bowlers",
};
const singularRole: Record<CompetitionRole, string> = {
  opener: "opener", keeper: "wicketkeeper", finisher: "finisher",
  middle: "middle order batter", allrounder: "all-rounder",
  pace: "pace bowler", spin: "spin bowler",
};

function roleMatch(candidate: Player, role: CompetitionRole): boolean {
  if (competitionRole(candidate) === role) return true;
  if (role === "opener") return Boolean(candidate.isOpener || candidate.onlyOpensOrBenched);
  if (role === "keeper") return Boolean(candidate.isWicketkeeper || candidate.isPartTimeWk);
  if (role === "finisher") return Boolean(candidate.isFinisher);
  if (role === "middle") return candidate.role === "Batsman" || candidate.role === "WK-Batsman";
  return false;
}

interface ScorePart { key: string; value: number; label: string }
function scoreParts(player: Player, role: CompetitionRole, season: number, injured: boolean): ScorePart[] {
  const stats = player.iplStats;
  const matches = Math.max(0, stats.matches);
  const sample = clamp(matches / 25, 0, 1);
  const battingRole = role === "opener" || role === "keeper" || role === "finisher" || role === "middle";
  const bowlingRole = role === "pace" || role === "spin";
  const batting = stats.innings && stats.innings >= 8
    ? clamp((stats.battingAverage - 23) * 0.65 + (stats.strikeRate - 125) * 0.17, -12, 18) * sample : 0;
  const economy = stats.economy || (stats.bowlingBalls && stats.runsConceded ? stats.runsConceded * 6 / stats.bowlingBalls : 0);
  const bowling = stats.bowlingInnings >= 8
    ? clamp((stats.wickets / stats.bowlingInnings - 0.8) * 15 + (economy ? (8.6 - economy) * 3 : 0), -12, 18) * sample : 0;
  const recent = player.iplHistory.filter((entry) => Number(entry.season) >= season - 1 && entry.seasonStats && entry.seasonStats.matches >= 4)
    .sort((a, b) => Number(b.season) - Number(a.season))[0]?.seasonStats;
  const recentBatting = recent ? clamp((recent.runs / recent.matches - 20) * 0.22, -6, 7) : 0;
  const recentBowling = recent ? clamp((recent.wickets / recent.matches - 0.7) * 6, -6, 7) : 0;
  return [
    { key: "role", value: competitionRole(player) === role ? 7 : 2, label: "a more direct fit for this role" },
    { key: "record", value: battingRole ? batting : bowlingRole ? bowling : batting * 0.5 + bowling * 0.5, label: "a stronger IPL record in this role" },
    { key: "recent", value: battingRole ? recentBatting : bowlingRole ? recentBowling : (recentBatting + recentBowling) / 2, label: "stronger recent season output" },
    { key: "experience", value: Math.min(12, Math.log1p(matches) * 2.5), label: "more IPL experience" },
    { key: "capped", value: player.isCapped ? 3 : 0, label: "international experience" },
    { key: "base", value: clamp((player.basePrice - 30) / 35, 0, 5), label: "a higher public base price" },
    { key: "availability", value: injured ? -16 : 0, label: "current availability" },
  ];
}

function relativeReason(subject: Player, competitor: Player, role: CompetitionRole, season: number, injuredIds: Set<string>, above: boolean): string {
  const subjectParts = scoreParts(subject, role, season, injuredIds.has(subject.id));
  const otherParts = scoreParts(competitor, role, season, injuredIds.has(competitor.id));
  const differences = otherParts.map((part, index) => ({
    label: part.label,
    advantage: (part.value - subjectParts[index].value) * (above ? 1 : -1),
  })).sort((a, b) => b.advantage - a.advantage);
  const best = differences.find((item) => item.advantage > 1.5);
  if (best?.label === "current availability") return above
    ? "Available while this player is injured"
    : "Currently injured; this player is available";
  if (best) return above ? `Ahead through ${best.label}` : `Behind on ${best.label}`;
  return above ? "Narrowly ahead on the available evidence" : "Narrowly behind on the available evidence";
}

function leagueSimilarity(subject: Player, other: Player): number {
  const subjectRole = competitionRole(subject);
  const otherRole = competitionRole(other);
  const rolePenalty = subjectRole === otherRole ? 0 : subject.role === other.role ? 16 : 60;
  const matchDistance = Math.abs(Math.log1p(subject.iplStats.matches) - Math.log1p(other.iplStats.matches)) * 8;
  const ageDistance = Math.abs(subject.age - other.age) * 1.6;
  const priceDistance = Math.abs(Math.log1p(subject.basePrice) - Math.log1p(other.basePrice)) * 8;
  const bowlingStylePenalty = subject.bowlingStyle && other.bowlingStyle && subject.bowlingStyle !== other.bowlingStyle ? 8 : 0;
  const nationalityPenalty = subject.nationality !== other.nationality ? 10 : 0;
  const battingStylePenalty = subject.battingStyle !== other.battingStyle ? 3 : 0;
  return rolePenalty + matchDistance + ageDistance + priceDistance + bowlingStylePenalty + nationalityPenalty + battingStylePenalty;
}

export function getPlayerCompetition(
  player: Player,
  players: Record<string, Player>,
  teams: Record<string, Team>,
  userTeamId: string,
  season: number,
  activeInjuries: Record<string, PlayerInjury>,
): PlayerCompetition {
  const team = teams[player.currentTeamId ?? ""] ?? teams[userTeamId] ?? null;
  const projectedForUserTeam = !player.currentTeamId || !teams[player.currentTeamId];
  const role = competitionRole(player);
  const injuredIds = new Set(Object.keys(activeInjuries));
  const teammates = team?.squad.map((id) => players[id]).filter((candidate): candidate is Player => !!candidate) ?? [];
  const candidates = [player, ...teammates.filter((candidate) => candidate.id !== player.id && roleMatch(candidate, role))];
  const order = candidates.map((candidate) => ({
    player: candidate,
    score: scoreParts(candidate, role, season, injuredIds.has(candidate.id)).reduce((sum, part) => sum + part.value, 0),
  })).sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name));
  const selectedRank = order.findIndex((entry) => entry.player.id === player.id) + 1;
  const ranked = order.map((entry, index): CompetitionEntry => ({
    player: entry.player,
    rank: index + 1,
    reason: entry.player.id === player.id ? "Profiled player" : relativeReason(player, entry.player, role, season, injuredIds, index + 1 < selectedRank),
  }));
  const leagueCandidates = Object.values(players)
    .filter((candidate) => candidate.id !== player.id && candidate.currentTeamId && candidate.currentTeamId !== team?.id);
  const sameRoleCandidates = leagueCandidates.filter((candidate) => competitionRole(candidate) === role);
  const leagueRival = (sameRoleCandidates.length ? sameRoleCandidates : leagueCandidates)
    .sort((a, b) => leagueSimilarity(player, a) - leagueSimilarity(player, b) || a.name.localeCompare(b.name))[0] ?? null;
  const leagueRivalTeam = leagueRival ? teams[leagueRival.currentTeamId ?? ""] ?? null : null;
  const leagueReason = leagueRival
    ? [competitionRole(leagueRival) === role ? `same ${singularRole[role]} role` : "similar playing role",
      Math.abs(leagueRival.age - player.age) <= 3 ? "similar age" : null,
      leagueRival.nationality === player.nationality ? "same IPL eligibility" : null,
      Math.abs(leagueRival.iplStats.matches - player.iplStats.matches) <= 20 ? "similar IPL experience" : null,
    ].filter(Boolean).join(" · ")
    : "No comparable player is currently signed to another club.";
  return { team, role, roleLabel: roleLabels[role], projectedForUserTeam, order: ranked, selectedRank, leagueRival, leagueRivalTeam, leagueReason };
}
