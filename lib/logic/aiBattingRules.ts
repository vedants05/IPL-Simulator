import type { Player } from "@/lib/types";
import type { TeamTactics } from "./teamTactics";
import { BATTING_COVERAGE_INTENTS, battingCoveragePhase, type BattingCoverage, type BattingSpecialRule, type BattingTargets, type FloaterRule } from "./tacticalMatchPlan";
import { battingIntent } from "./matchSimulation";

/** Only explicitly marked batters may be picked automatically as floaters. */
export function generateAiFloaterRules(players: readonly Player[]): FloaterRule[] {
  const eligible = players.flatMap((player, index) => {
    const position = index + 1;
    if (player.canFloat !== true || player.onlyOpensOrBenched || position < 5 || position > 8 || player.currentBatting < 65) return [];
    const pace = player.paceRating;
    const spin = player.spinRating;
    const matchup: "spin" | "pace" | null = typeof pace === "number" && typeof spin === "number" && Math.abs(pace - spin) >= 10 && Math.max(pace, spin) >= 65
      ? spin > pace ? "spin" : "pace" : null;
    const aggression = player.battingAggression ?? player.aggression ?? 65;
    if (!matchup && aggression < 75 && !player.isFinisher) return [];
    return [{ player, position, matchup, aggression, score: player.currentBatting + (matchup ? Math.abs(spin! - pace!) * 0.5 : 0) + (player.isFinisher ? 3 : 0) }];
  }).sort((a, b) => b.score - a.score || a.position - b.position);
  const candidate = eligible[0];
  if (!candidate) return [];
  return [{ playerId: candidate.player.id, earliestPosition: 4, latestPosition: Math.min(6, candidate.position - 1),
    fromOver: candidate.matchup ? 7 : 12, untilOver: candidate.matchup ? 15 : 20,
    trigger: candidate.matchup ?? "over", requiredRate: 10, protectCollapse: true }];
}

/** Add targeted instructions only when there is evidence of a clear matchup. */
export function generateAiBattingTargets(players: readonly Player[], tactics: TeamTactics, coverage: Readonly<Record<string, BattingCoverage>> = {}): Record<string, BattingTargets> {
  const candidates = players.flatMap((player, index) => {
    const { paceRating: pace, spinRating: spin } = player;
    if (!Number.isFinite(pace) || !Number.isFinite(spin) || Math.abs(pace! - spin!) < 12 || player.currentBatting < 55) return [];
    const aggression = player.battingAggression ?? player.aggression ?? 65;
    const stronger = spin! > pace! ? "spin" : "pace";
    const weaker = stronger === "spin" ? "pace" : "spin";
    const strongerRating = Math.max(spin!, pace!);
    const weakerRating = Math.min(spin!, pace!);
    // Rotation tempers weak matchups without forcing an aggressive batter to see them off.
    const type = strongerRating >= 65 && aggression >= 65 ? stronger : weakerRating <= 50 && aggression < 85 ? weaker : null;
    if (!type) return [];
    const attacking = type === stronger;
    const modes: BattingTargets["spin"] = {
      modes: attacking ? [aggression >= 90 && tactics.batting.middle === "dominate" ? "all-out" : "attack"] : ["rotate"],
      fromOver: type === "spin" ? 7 : 1,
      untilOver: type === "spin" ? 15 : 6,
    };
    if (attacking) {
      const minimum = modes.modes[0] === "all-out" ? BATTING_COVERAGE_INTENTS["all-out"] : BATTING_COVERAGE_INTENTS.attack;
      const changesIntent = Array.from({ length: modes.untilOver - modes.fromOver + 1 }, (_, offset) => modes.fromOver + offset).some(over => {
        const phase = battingCoveragePhase(over, 6, 16);
        const selected = coverage[player.id]?.[phase];
        const baseline = selected ? BATTING_COVERAGE_INTENTS[selected] : battingIntent(tactics, over, 0, 0);
        return baseline < minimum;
      });
      if (!changesIntent) return [];
    }
    return [{ player, index, type, rule: modes, score: Math.abs(pace! - spin!) + player.currentBatting * 0.1 }];
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  return Object.fromEntries(candidates.slice(0, 4).map(({ player, type, rule }) => [player.id, { [type]: rule }]));
}

/** Choose complementary situational rules from the coach's approach and XI. */
export function generateAiBattingTeamRules(players: readonly Player[], tactics: TeamTactics, chasing: boolean): BattingSpecialRule[] {
  const candidates: { score: number; rule: BattingSpecialRule }[] = [];
  const battingDepth = players.slice(5, 8).filter(player => player.currentBatting >= 65).length;
  const top = players.slice(0, 5);
  const attackingTop = top.filter(player => (player.battingAggression ?? player.aggression ?? 65) >= 80).length;
  const explosiveTop = top.filter(player => (player.battingAggression ?? player.aggression ?? 65) >= 90).length;
  const topAverage = top.length ? top.reduce((sum, player) => sum + player.currentBatting, 0) / top.length : 0;
  const tail = players.slice(8);
  const weakTail = tail.filter(player => player.currentBatting < 55).length;
  const finisherCount = players.slice(4, 8).filter(player => player.currentBatting >= 65 && (player.isFinisher || (player.battingAggression ?? player.aggression ?? 65) >= 75)).length;
  const cautious = tactics.batting.powerplay === "cautious";
  const attacking = tactics.batting.powerplay === "attack" || tactics.batting.middle === "dominate";

  if (tactics.batting.collapseResponse !== "keep-attacking") {
    const deep = tactics.batting.collapseResponse === "deep-rebuild";
    candidates.push({ score: 65 + (deep ? 14 : 0) + (battingDepth < 2 ? 8 : 0), rule: {
      kind: "rebuild", threshold: deep ? 2 : 3, fromOver: 1, untilOver: deep ? 9 : 7,
      priority: deep && attackingTop <= 1 ? 2 : 1,
    } });
  }
  if (chasing) {
    const frontLoad = tactics.batting.chaseApproach === "front-load";
    candidates.push({ score: 76 + (frontLoad ? 5 : 0), rule: {
      kind: "chase-rate", threshold: frontLoad ? 10 : tactics.batting.chaseApproach === "preserve-wickets" ? 13 : 12,
      fromOver: frontLoad ? 5 : 7, untilOver: 20, priority: frontLoad && battingDepth >= 2 ? 2 : 1,
    } });
  }
  if (tactics.batting.death === "all-out" && (battingDepth >= 1 || finisherCount >= 1)) {
    candidates.push({ score: 67 + finisherCount * 5 + battingDepth * 3, rule: {
      kind: "finish", threshold: battingDepth >= 2 ? 4 : 6, fromOver: battingDepth >= 2 && finisherCount >= 2 ? 15 : 16,
      untilOver: 20, priority: finisherCount >= 2 && battingDepth >= 2 ? 2 : 1,
    } });
  }
  if (cautious && explosiveTop === 0 && top.length >= 2) {
    candidates.push({ score: 69 + (topAverage < 75 ? 8 : 0), rule: {
      kind: "settle-in", threshold: attackingTop === 0 ? 6 : 3, fromOver: 1, untilOver: 2,
      priority: attackingTop === 0 && tactics.batting.collapseResponse === "deep-rebuild" ? 2 : 1,
    } });
  }
  if (attacking && topAverage >= 70 && attackingTop >= 2) {
    candidates.push({ score: 69 + attackingTop * 3 + (tactics.batting.middle === "dominate" ? 6 : 0), rule: {
      kind: "boundary-target", threshold: 1, fromOver: tactics.batting.powerplay === "attack" ? 1 : 7,
      untilOver: tactics.batting.middle === "dominate" ? 15 : 6, priority: attackingTop >= 4 && battingDepth >= 2 ? 2 : 1,
    } });
  }
  if (weakTail >= 2 && players.some(player => player.currentBatting >= 75)) {
    candidates.push({ score: 64 + weakTail * 4 + (battingDepth < 2 ? 7 : 0), rule: {
      kind: "shield-tail", threshold: weakTail >= 3 ? 7 : 8, fromOver: 10, untilOver: 20,
      priority: weakTail >= 3 ? 3 : 2,
    } });
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3).map(candidate => candidate.rule);
}
