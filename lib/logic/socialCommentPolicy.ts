import type { SocialPostTopic } from "@/lib/data/socialMediaPosts";

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

/**
 * The catalogue gives every comment an explicit requirements array. Match
 * posts always require scorecard evidence; other posts request it only when
 * their own declared requirement concerns form or performance. This avoids
 * treating a vague word in prose as a universal trigger rule.
 */
export function commentRequiresStatEvidence(requirements: string[], topic: SocialPostTopic): boolean {
  if (["individual_match", "clutch"].includes(topic)) return true;
  return requirements.some((requirement) => (
    requirement === "performance met the relevant batting or bowling threshold"
    || /^bought for price .* AND (played well|underperformed)/i.test(requirement)
    || /^player scored \d+\+/i.test(requirement)
    || /^player took a wicket and hit a boundary/i.test(requirement)
    || requirement === "player won MVP or player is top performer"
    || requirement === "player carried team into top 4 AND team qualified"
  ));
}

/**
 * Ball-by-ball data now verifies decisive batters, winning runs and run-outs.
 * Delivery claims without a complete event binding remain fail-closed rather
 * than being inferred from a merely close scorecard.
 */
export function hasUnverifiableDeliveryClaim(text: string): boolean {
  return /\b(needed \d+ off|hit it for a six|last-ball six|run-?out on the final|dream 20th over|final-over hero|defending (?:the )?total in the final over|super over)\b/i.test(text);
}

export function isFinalBallWinningClaim(text: string): boolean {
  return /\b(winning (?:it|a .*match|runs) (?:on|off) the (?:final|last) (?:ball|delivery)|won (?:it|the match) (?:on|off) the (?:final|last) (?:ball|delivery))\b/i.test(text);
}

/**
 * Literal figures in prose must be justified by that template's declared
 * requirements. Dynamic placeholders are excluded because their values come
 * directly from the scorecard. This prevents invented percentages, over
 * numbers, rankings and statistical claims from leaking into the feed.
 */
export function hasUnsupportedNumericClaim(
  text: string,
  requirements: string[],
  validatePerformance?: (stats: any) => boolean,
): boolean {
  const prose = text.replace(/\{[^}]+\}/g, "");
  const numbers = Array.from(prose.matchAll(/\d+(?:\.\d+)?%?/g), (match) => match[0]);
  if (!numbers.length) return false;
  const joined = requirements.join(" ").toLowerCase();
  const validatorSource = validatePerformance?.toString() ?? "";
  const isWinRequirement = /team won|won match|qualified/.test(joined);
  const firstTwoRecord = /first two matches/.test(joined);
  const firstThreeRecord = /first three matches/.test(joined);
  const oneOneRecord = /1 win 1 loss/.test(joined);
  const lastOverRequirement = /last over/.test(joined);

  return numbers.some((literal) => {
    const value = literal.replace("%", "");
    if (value === "2026" || value === "2027") return false;
    if (joined.includes(value)) return false;
    if (validatorSource.includes(value)) return false;
    if (value === "2" && /2 points/i.test(prose) && isWinRequirement) return false;
    if ((value === "0" || value === "2") && firstTwoRecord) return false;
    if ((value === "0" || value === "3") && firstThreeRecord) return false;
    if (value === "1" && oneOneRecord) return false;
    if (value === "20" && lastOverRequirement) return false;
    if (value === "4" && /top 4/i.test(prose) && /top 4/i.test(joined)) return false;
    if (value === "2" && /top 2/i.test(prose) && /top 2/i.test(joined)) return false;
    return true;
  });
}

/** Claims for which the game currently stores no trustworthy evidence. */
export function hasUnsupportedContextClaim(text: string): boolean {
  return /\b(?:nrr|net\s+run\s+rate|win\s+probability|wpa|qualification\s+probability|average\s+(?:delivery\s+)?speeds?|\d+\s*kph|speed\s+gun|field\s+(?:placement|setting|guard|adjustment)s?|poor\s+fielding|fielding\s+cost|catch(?:ing)?\s+efficiency|fielding\s+(?:discipline|error|support)|saved\s+(?:at\s+least\s+)?\d+\s+runs|post-match\s+(?:speech|comments?|interview)|dressing-room\s+(?:speech|culture)|captain\s+hugs?|wide\s+yorker|yorker\s+mark|yorker\s+execution|slower\s+ball|short-pitched\s+delivery|leg-slip|carrom\s+ball|googly|training|practice|nets?|pre-season\s+camp|fitness\s+levels?|body\s+language|humidity|dew\s+factor|pitch\s+wear|turning\s+(?:track|pitch)|flat\s+deck|green\s+(?:track|pitch)|statistically\s+(?:the\s+)?(?:highest|lowest|best|worst)|ranks?\s+(?:among|in)|league\s+average)\b/i.test(text);
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

export function performanceSentiment(tone: string): "positive" | "negative" | "neutral" {
  const lowerTone = tone.toLowerCase();
  if (["critical", "banter", "cautious"].includes(lowerTone)) return "negative";
  if (["positive", "hype", "optimistic", "supportive", "celebratory"].includes(lowerTone)) return "positive";
  return "neutral";
}

export function formatPerformanceFooter(stats: SocialPerformanceStats, scope: "match" | "season"): string {
  const label = scope === "match" ? "Match stats" : "Season stats";
  const strikeRate = stats.balls > 0 ? stats.runs / stats.balls * 100 : 0;
  const economy = stats.oversBowled > 0 ? stats.runsConceded / stats.oversBowled : 0;
  const batting = stats.balls > 0
    ? scope === "match"
      ? `${stats.runs} (${stats.balls}), ${strikeRate.toFixed(1)} SR`
      : `${stats.runs} runs in ${stats.matches} matches, ${strikeRate.toFixed(1)} SR`
    : "";
  const bowling = stats.oversBowled > 0
    ? scope === "match"
      ? `${stats.wickets}/${stats.runsConceded} in ${stats.oversBowled.toFixed(1)} ov, ${economy.toFixed(1)} Econ`
      : `${stats.wickets} wkts, ${economy.toFixed(1)} Econ`
    : "";
  const detail = [batting, bowling].filter(Boolean).join(" · ");
  return detail ? `[${label}: ${detail}]` : "";
}
