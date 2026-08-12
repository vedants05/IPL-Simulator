import type { Player } from "@/lib/types";
import {
  clubFigureTierFloor,
  getBaseClubFigureTier,
  getClubFigureId,
  higherClubFigureTier,
  type ClubFigureProgression,
  type ClubFigureTier,
} from "@/lib/data/clubFigures";

export interface ClubFigureSeasonStats {
  teamId?: string;
  matches?: number;
  runs?: number;
  wickets?: number;
}

export interface ClubFigureSeasonAchievements {
  championTeamId?: string | null;
  championCaptainId?: string | null;
  orangeCapPlayerId?: string | null;
  purpleCapPlayerId?: string | null;
  seasonMvpPlayerId?: string | null;
  teamOfSeasonPlayerIds?: string[];
}

export function canonicalClubTeamId(teamId: string): string {
  if (teamId === "KXIP") return "PBKS";
  if (teamId === "DD") return "DC";
  return teamId;
}

export function getHistoricalClubSeasonKeys(player: Player, teamId: string): string[] {
  const canonicalTeamId = canonicalClubTeamId(teamId);
  return Array.from(new Set((player.iplHistory ?? [])
    .filter((entry) => entry.teamId !== "UNSOLD")
    .filter((entry) => canonicalClubTeamId(entry.teamId) === canonicalTeamId)
    .filter((entry) => !entry.seasonStats || entry.seasonStats.matches > 0)
    .map((entry) => String(entry.season))));
}

export function tierForClubFigureScore(points: number, seasons: number): ClubFigureTier | null {
  if (points >= 220 && seasons >= 5) return "legend";
  if (points >= 120 && seasons >= 3) return "icon";
  if (points >= 50) return "hero";
  return null;
}

export function processClubFigureSeason(input: {
  progression: ClubFigureProgression;
  players: Record<string, Player>;
  season: number;
  playerStats: Record<string, ClubFigureSeasonStats>;
  achievements?: ClubFigureSeasonAchievements;
}): ClubFigureProgression {
  const progression = { ...input.progression };
  const teamOfSeasonIds = new Set(input.achievements?.teamOfSeasonPlayerIds ?? []);

  Object.entries(input.playerStats).forEach(([playerId, stats]) => {
    const player = input.players[playerId];
    const teamId = stats.teamId ? canonicalClubTeamId(stats.teamId) : "";
    const matches = Math.max(0, Math.floor(stats.matches ?? 0));
    if (!player || !teamId || matches <= 0) return;

    const id = getClubFigureId(teamId, player.name);
    const existing = progression[id];
    if (existing?.processedSeasons.includes(input.season)) return;

    const baseTier = getBaseClubFigureTier(teamId, player.name);
    const seasonKeys = Array.from(new Set([
      ...(existing?.seasonKeys ?? []),
      ...getHistoricalClubSeasonKeys(player, teamId),
      String(input.season),
    ])).sort();
    const startingPoints = Math.max(existing?.points ?? 0, baseTier ? clubFigureTierFloor(baseTier) : 0);
    const titleWinner = canonicalClubTeamId(input.achievements?.championTeamId ?? "") === teamId;
    const seasonPoints = matches
      + Math.floor(Math.max(0, stats.runs ?? 0) / 50)
      + Math.floor(Math.max(0, stats.wickets ?? 0) / 2)
      + Number(titleWinner) * 10
      + Number(input.achievements?.orangeCapPlayerId === playerId) * 10
      + Number(input.achievements?.purpleCapPlayerId === playerId) * 10
      + Number(teamOfSeasonIds.has(playerId)) * 10
      + Number(input.achievements?.seasonMvpPlayerId === playerId) * 15
      + Number(titleWinner && input.achievements?.championCaptainId === playerId) * 10;
    const points = startingPoints + seasonPoints;
    const earnedTier = tierForClubFigureScore(points, seasonKeys.length);
    const previousTier = existing?.tier ?? baseTier;
    const tier = higherClubFigureTier(previousTier, earnedTier);
    const tierRank = { hero: 1, icon: 2, legend: 3 } as const;
    const wasPromoted = tier !== null
      && tier !== "hero"
      && (!previousTier || tierRank[tier] > tierRank[previousTier]);

    progression[id] = {
      id,
      teamId,
      playerId,
      playerName: player.name,
      points,
      seasonKeys,
      processedSeasons: [...(existing?.processedSeasons ?? []), input.season],
      tier,
      promotions: wasPromoted
        ? [...(existing?.promotions ?? []), { season: input.season, tier }]
        : existing?.promotions ?? [],
    };
  });

  return progression;
}
