import type { LeagueHistorySeason } from "@/lib/data/leagueHistory";
import type { Player } from "@/lib/types";

const honourFields = ["iplTitleSeasons", "iplRunnerUpSeasons", "iplOrangeCapSeasons", "iplPurpleCapSeasons", "iplMvpSeasons", "iplEmergingPlayerSeasons"] as const;
type HonourField = typeof honourFields[number];
type HonoursPlayer = Pick<Player, "name" | "iplHistory" | HonourField>;

/** Merge database honours with completed results belonging to this save. */
export function playerHonours(player: HonoursPlayer, history: readonly LeagueHistorySeason[], includeHistorical = false): Record<HonourField, number[]> {
  const honours = Object.fromEntries(honourFields.map(field => [field, new Set(player[field] ?? [])])) as Record<HonourField, Set<number>>;
  const normalizedName = player.name.trim().toLocaleLowerCase();
  for (const season of history) {
    if (season.source !== "career" && !includeHistorical) continue;
    const contracts = player.iplHistory.filter(entry => Number(entry.season) === season.season && entry.teamId !== "UNSOLD");
    if (contracts.some(entry => entry.teamId === season.championTeamId)) honours.iplTitleSeasons.add(season.season);
    if (contracts.some(entry => entry.teamId === season.runnerUpTeamId)) honours.iplRunnerUpSeasons.add(season.season);
    for (const [field, award] of [
      ["iplOrangeCapSeasons", season.orangeCap],
      ["iplPurpleCapSeasons", season.purpleCap],
      ["iplMvpSeasons", season.mvp],
      ["iplEmergingPlayerSeasons", season.emergingPlayer],
    ] as const) {
      if (award?.name.trim().toLocaleLowerCase() === normalizedName) honours[field].add(season.season);
    }
  }
  return Object.fromEntries(honourFields.map(field => [field, Array.from(honours[field]).sort((a, b) => a - b)])) as Record<HonourField, number[]>;
}
