import type { Player, Team } from "../types";
import { worldRules } from "./worldRules";

const quality = (p: Player) => p.role === "Pace Bowler" || p.role === "Spin Bowler"
  ? p.currentBowling : p.role === "All-Rounder" ? Math.max(p.currentBatting, p.currentBowling) : p.currentBatting;

/** Conservative public forecast, never randomised on render. Club cornerstones
 * are relative to their squad, rather than requiring a universal 88 rating.
 */
export function likelyRetentionIds(team: Team, players: Record<string, Player>): string[] {
  const rules = worldRules();
  const score = (p: Player) => quality(p)
    + Math.min(2, Math.max(0, Math.max(p.potentialBatting, p.potentialBowling) - quality(p)) * .12)
    + (p.nationality === "Indian" ? .75 : 0)
    + (p.id === team.captainContinuityId ? .75 : 0)
    - Math.min(3, Math.max(0, p.age - 34) * .4);
  const ranked = Array.from(new Set(team.squad)).map(id => players[id])
    .filter((p): p is Player => Boolean(p) && !p.setForRelease && quality(p) >= 78)
    .sort((a, b) => score(b) - score(a) || quality(b) - quality(a) || a.id.localeCompare(b.id));
  const result: string[] = [];
  let capped = 0, uncapped = 0;
  for (const player of ranked) {
    if (result.length >= Math.min(3, rules.maxTotalRetentions)) break;
    // A third name needs established quality or to be close to the second.
    if (result.length === 2 && quality(player) < 82 && score(player) < score(ranked[1]) - 3) continue;
    if (player.isCapped ? capped >= rules.maxCappedRetentions : uncapped >= rules.maxUncappedRetentions) continue;
    result.push(player.id);
    if (player.isCapped) capped++; else uncapped++;
  }
  return result;
}
