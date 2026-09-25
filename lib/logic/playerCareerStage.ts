import type { Player, PlayerCareerRatingHistoryEntry } from "@/lib/types";

export type PlayerCareerStage = "Young Prospect" | "Developing" | "Approaching Peak" | "At Peak" | "Slowing Down" | "Twilight";

export interface CareerStageSeason {
  season: number;
  matches: number;
  runs: number;
  wickets: number;
}

function roleRating(role: Player["role"], batting: number, bowling: number): number {
  if (role === "Pace Bowler" || role === "Spin Bowler") return bowling;
  if (role === "All-Rounder") return (batting + bowling) / 2;
  return batting;
}

function seasonPerformance(role: Player["role"], season: CareerStageSeason): number {
  const runsPerMatch = season.runs / season.matches;
  const wicketsPerMatch = season.wickets / season.matches;
  if (role === "Pace Bowler" || role === "Spin Bowler") return wicketsPerMatch;
  if (role === "All-Rounder") return runsPerMatch / 60 + wicketsPerMatch / 2;
  return runsPerMatch / 30;
}

export function getPlayerCareerStage(player: Player, seasons: CareerStageSeason[]): PlayerCareerStage {
  const current = roleRating(player.role, player.currentBatting, player.currentBowling);
  const potential = roleRating(player.role, player.potentialBatting, player.potentialBowling);
  const headroom = Math.max(0, potential - current);
  const ratings = [...(player.careerState?.ratingHistory ?? [])]
    .sort((a, b) => a.season - b.season);
  const ratingValue = (entry: PlayerCareerRatingHistoryEntry) => roleRating(player.role, entry.batting, entry.bowling);
  const twoSeasonChange = ratings.length >= 3 ? current - ratingValue(ratings[ratings.length - 3]) : null;
  const meaningfulSeasons = seasons.filter((season) => season.matches >= 5)
    .sort((a, b) => a.season - b.season);
  const performance = meaningfulSeasons.map((season) => seasonPerformance(player.role, season));
  const strongSeasons = performance.filter((score) => score >= 0.9).length;
  const recentWeak = performance.length >= 2
    && performance.slice(-2).every((score) => score < 0.85)
    && performance[performance.length - 1] <= performance[performance.length - 2] + 0.05;

  if (player.age >= 35 && twoSeasonChange !== null && twoSeasonChange <= -8 && recentWeak) return "Twilight";
  if (twoSeasonChange !== null && twoSeasonChange <= -4 && recentWeak) return "Slowing Down";
  if (player.age <= 23 && headroom >= 10 && strongSeasons < 2) return "Young Prospect";
  if (headroom >= 7 && strongSeasons < 2) return "Developing";
  if (headroom >= 3) return "Approaching Peak";
  return "At Peak";
}
