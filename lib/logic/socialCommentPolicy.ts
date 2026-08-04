import type { SeasonPhase, SocialPostTopic } from "@/lib/data/socialMediaPosts";

export interface SocialPerformanceStats {
  runs: number;
  balls: number;
  wickets: number;
  runsConceded: number;
  oversBowled: number;
  matches: number;
  fours?: number;
  sixes?: number;
}

const PERFORMANCE_LANGUAGE = /\b(form|performance|performing|deliver(?:ing|ed)?|contribut(?:ion|ed)|knock|innings|runs?|wickets?|spell|economy|strike rate|scor(?:e|ing)|batting|bowling|batter|bowler|hitting|sixes?|boundar(?:y|ies)|flop|slump|underperform(?:ing)?|out of form|failure|failures|consistency|momentum)\b/i;
const POSITIVE_LANGUAGE = /\b(great|excellent|elite|brilliant|outstanding|superb|strong|quality|masterclass|hero|star|praise|firing|carrying|value|bargain|impact|match[- ]winning|dominant|positive)\b/i;
const NEGATIVE_LANGUAGE = /\b(poor|bad|struggl|flop|slump|underperform|failure|failures|drop|dropped|expensive|leaking|critical|concern|disappoint|not enough|weak|waste)\b/i;

export function isPlayerPerformanceComment(text: string, topic: SocialPostTopic, phase: SeasonPhase): boolean {
  // Auction, retention and selection posts can mention a player's role or
  // potential without claiming that they performed in a match.
  if (["post_auction", "pre_season", "next_season"].includes(phase)) return false;
  if (!text.includes("{a}")) return false;
  if (!PERFORMANCE_LANGUAGE.test(text)) return false;
  return topic !== "captaincy" && topic !== "venue";
}

export function performanceScope(topic: SocialPostTopic): "match" | "season" {
  return ["individual_match", "clutch"].includes(topic) ? "match" : "season";
}

export function passesPerformanceEvidence(
  stats: SocialPerformanceStats | undefined,
  isBatter: boolean,
  sentiment: "positive" | "negative" | "neutral",
  scope: "match" | "season",
): boolean {
  if (!stats) return false;
  const strikeRate = stats.balls > 0 ? stats.runs / stats.balls * 100 : 0;
  const econ = stats.oversBowled > 0 ? stats.runsConceded / stats.oversBowled : Number.POSITIVE_INFINITY;

  if (scope === "match") {
    if (isBatter) {
      if (stats.balls <= 0) return false;
      if (sentiment === "positive") return stats.runs >= 30 || (stats.runs >= 25 && strikeRate >= 150);
      // A bad individual batting reaction is scorecard-specific: ducks and
      // low-impact innings qualify, rather than judging a player merely for
      // consuming a particular number of balls.
      if (sentiment === "negative") {
        const boundaries = (stats.fours ?? 0) + (stats.sixes ?? 0);
        return (stats.runs <= 10 && boundaries === 0) || (stats.runs <= 5 && boundaries <= 1);
      }
      return stats.runs >= 20;
    }
    if (stats.oversBowled <= 0) return false;
    if (sentiment === "positive") return stats.wickets >= 2 || (stats.oversBowled >= 3 && econ <= 6.5);
    if (sentiment === "negative") return stats.oversBowled >= 2 && stats.wickets <= 1 && econ >= 10;
    return stats.wickets >= 1 || (stats.oversBowled >= 3 && econ <= 7.5);
  }

  if (stats.matches < 2) return false;
  if (isBatter) {
    const average = stats.runs / stats.matches;
    if (sentiment === "positive") return stats.runs >= 60 && average >= 25 && strikeRate >= 115;
    if (sentiment === "negative") return stats.balls >= 20 && (average <= 20 || strikeRate <= 105);
    return stats.runs >= 40;
  }
  if (stats.oversBowled < 4) return false;
  const wicketsPerMatch = stats.wickets / stats.matches;
  if (sentiment === "positive") return stats.wickets >= 3 && wicketsPerMatch >= 1 && econ <= 9;
  if (sentiment === "negative") return stats.oversBowled >= 6 && (econ >= 10 || wicketsPerMatch < 0.5);
  return stats.wickets >= 2 || econ <= 8;
}

export function performanceSentiment(text: string, tone: string): "positive" | "negative" | "neutral" {
  const lowerTone = tone.toLowerCase();
  if (NEGATIVE_LANGUAGE.test(text) || ["critical", "banter", "cautious"].includes(lowerTone)) return "negative";
  if (POSITIVE_LANGUAGE.test(text) || ["positive", "hype", "optimistic", "supportive", "celebratory"].includes(lowerTone)) return "positive";
  return "neutral";
}

export function formatPerformanceFooter(stats: SocialPerformanceStats, scope: "match" | "season"): string {
  const label = scope === "match" ? "Match stats" : "Season stats";
  const batting = stats.balls > 0 ? `${stats.runs} (${stats.balls})` : "";
  const bowling = stats.oversBowled > 0
    ? `${stats.wickets}/${stats.runsConceded} in ${stats.oversBowled.toFixed(1)} ov`
    : "";
  const detail = [batting, bowling].filter(Boolean).join(" · ");
  return detail ? `[${label}: ${detail}]` : "";
}
