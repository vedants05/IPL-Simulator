import type { Player } from "@/lib/types";

/** Capture batting ratings before the active season's development is applied. */
export function captureSeasonStartBattingAbilities(
  playerPool: Record<string, Player>,
  season: number,
): Record<string, number> {
  return Object.fromEntries(Object.values(playerPool).map((player) => {
    const historyBeforeSeason = player.careerState?.ratingHistory
      ?.filter((entry) => entry.season < season)
      .sort((left, right) => right.season - left.season)[0];
    const ability = player.careerState?.lastDevelopmentSeason === season && historyBeforeSeason
      ? historyBeforeSeason.batting
      : player.currentBatting;
    return [player.id, ability];
  }));
}

/** Capture bowling ratings before the active season's development is applied. */
export function captureSeasonStartBowlingAbilities(
  playerPool: Record<string, Player>,
  season: number,
): Record<string, number> {
  return Object.fromEntries(Object.values(playerPool).map((player) => {
    const historyBeforeSeason = player.careerState?.ratingHistory
      ?.filter((entry) => entry.season < season)
      .sort((left, right) => right.season - left.season)[0];
    const ability = player.careerState?.lastDevelopmentSeason === season && historyBeforeSeason
      ? historyBeforeSeason.bowling
      : player.currentBowling;
    return [player.id, ability];
  }));
}
