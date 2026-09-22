import type { Player, BowlingUsage } from "../types";

/**
 * Classifies or backfills a player's bowling usage role based on:
 * 1. Specialist role (WK never bowls, specialist bowlers are frontline)
 * 2. Bowling ability & career/IPL bowling frequency
 * 3. Specific player overrides
 */
export function classifyBowlingUsage(player: Partial<Player>): BowlingUsage {
  // 1. Wicketkeepers never bowl
  if (player.isWicketkeeper || player.role === "WK-Batsman") {
    return "does_not_bowl";
  }

  // 2. Pure specialist bowlers
  if (player.role === "Pace Bowler" || player.role === "Spin Bowler") {
    return "frontline";
  }

  const t20Matches = Number(player.careerStats?.bowling?.matches ?? player.careerStats?.batting?.matches) || 0;
  // We can check IPL or career stats
  const iplMatches = Number(player.iplStats?.matches) || 0;
  const iplInns = Number(player.iplStats?.bowlingInnings) || 0;
  const sampleMatches = t20Matches > 0 ? t20Matches : iplMatches;
  const sampleInns = iplInns;
  const bowlRatio = sampleMatches > 0 ? sampleInns / sampleMatches : 0;
  const bowlRating = Number(player.currentBowling) || 0;

  // 3. All-Rounders
  if (player.role === "All-Rounder") {
    if (player.name === "Shivam Dube") return "part_time";
    if (bowlRatio >= 0.80 || bowlRating >= 83) return "frontline";
    if (bowlRatio >= 0.38 || bowlRating >= 72) return "regular";
    if (bowlRatio >= 0.12 || bowlRating >= 58) return "part_time";
    return "emergency";
  }

  // 4. Batters
  if (player.role === "Batsman") {
    if (bowlRating === 0 || !player.bowlingStyle || (sampleInns === 0 && bowlRating < 55)) {
      return "does_not_bowl";
    }
    if (bowlRatio >= 0.20 && bowlRating >= 65) {
      return "part_time";
    }
    if (sampleInns > 0 || bowlRating >= 40) {
      return "emergency";
    }
    return "does_not_bowl";
  }

  return "does_not_bowl";
}
