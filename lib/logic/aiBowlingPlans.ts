import type { Player } from "@/lib/types";
import { getPlayableBowlingOptions, type MatchLineupPlan, type MatchTeamPlans } from "./matchSimulation";
import { projectBatFirstImpact } from "./battingImpactPlan";
import { emptyTacticalMatchPlan, type BattingCoverageIntent } from "./tacticalMatchPlan";
import { suggestBowlingOvers } from "./suggestBowlingOvers";
import { suggestLineupBattingCoverage } from "./battingRoleFit";
import { generateAiBattingTargets, generateAiBattingTeamRules, generateAiFloaterRules } from "./aiBattingRules";

const mindsets: BattingCoverageIntent[] = ["survive", "protect", "steady", "attack", "all-out"];
const phases = ["powerplay", "earlyMiddle", "lateMiddle", "death"] as const;

/** Keep individual temperament dominant while reflecting the coach's phase approach. */
export function tailorAiBattingMindset(player: Player, phase: typeof phases[number], suggested: BattingCoverageIntent, tactics: MatchTeamPlans["tactics"]): BattingCoverageIntent {
  const aggression = player.battingAggression ?? player.aggression;
  if (typeof aggression === "number" && aggression >= 96) return "all-out";
  let index = mindsets.indexOf(suggested);
  const style = phase === "powerplay" ? tactics.batting.powerplay : phase === "death" ? tactics.batting.death : tactics.batting.middle;
  const attacking = style === "attack" || style === "dominate" || style === "all-out";
  const cautious = style === "cautious" || style === "rebuild" || style === "preserve";
  if (attacking && (aggression ?? 65) >= 65) index = Math.min(4, index + 1);
  if (cautious && (aggression ?? 65) < 80) index = Math.max(0, index - 1);
  if (typeof aggression === "number" && aggression >= 88) index = Math.max(index, 3);
  if (typeof aggression === "number" && aggression <= 30) index = Math.min(index, 1);
  return mindsets[index];
}

export function projectedAiBowlingAttack(lineup: MatchLineupPlan, scenario: "battingFirst" | "bowlingFirst", players: Record<string, Player>) {
  const impact = scenario === "battingFirst" ? projectBatFirstImpact(lineup.startingXI, lineup.startingXI, lineup, players) : null;
  const ids = [...lineup.startingXI.filter(id => id !== impact?.outgoing.id), ...(impact ? [impact.incoming.id] : [])];
  return { impact, bowlers: getPlayableBowlingOptions(ids.map(id => players[id]).filter((player): player is Player => Boolean(player))) };
}

export function projectedAiBattingOrder(lineup: MatchLineupPlan, scenario: "battingFirst" | "bowlingFirst") {
  const order = [...lineup.startingXI];
  if (scenario === "bowlingFirst" && lineup.plannedImpactPlayerId && lineup.plannedOutgoingPlayerId && order.includes(lineup.plannedOutgoingPlayerId)) {
    const index = order.indexOf(lineup.plannedOutgoingPlayerId);
    order.splice(index, 1);
    order.splice(Math.max(0, Math.min(order.length, (lineup.plannedImpactBattingPosition ?? index + 1) - 1)), 0, lineup.plannedImpactPlayerId);
  }
  return order;
}

/** Generate an adaptable rotation from each projected bowling XI. */
export function addAiBowlingPlans(plans: MatchTeamPlans, players: Record<string, Player>): MatchTeamPlans {
  const matchPlans = { ...plans.tactics.matchPlans };
  for (const scenario of ["battingFirst", "bowlingFirst"] as const) {
    const lineup = plans[scenario];
    const { bowlers: attack } = projectedAiBowlingAttack(lineup, scenario, players);
    const existing = matchPlans[scenario] ?? emptyTacticalMatchPlan();
    const overs = suggestBowlingOvers(attack, existing.overs, plans.tactics.bowling.middle);
    const order = projectedAiBattingOrder(lineup, scenario);
    const battingPlayers = order.map(id => players[id]).filter((player): player is Player => Boolean(player));
    const generated = suggestLineupBattingCoverage({ lineup: battingPlayers, order, coverage: existing.battingCoverage ?? {}, tactics: { ...plans.tactics, batting: { ...plans.tactics.batting, ...existing.response } }, chasing: scenario === "bowlingFirst" });
    const effectiveTactics = { ...plans.tactics, batting: { ...plans.tactics.batting, ...existing.response } };
    for (const player of battingPlayers) {
      const coverage = generated[player.id];
      for (const phase of phases) {
        const suggested = coverage?.[phase];
        if (suggested) coverage[phase] = tailorAiBattingMindset(player, phase, suggested, effectiveTactics);
      }
    }
    for (const [id, coverage] of Object.entries(existing.battingCoverage ?? {})) generated[id] = { ...generated[id], ...coverage };
    const generatedTargets = generateAiBattingTargets(battingPlayers, effectiveTactics, generated);
    for (const [id, targets] of Object.entries(existing.battingTargets ?? {})) generatedTargets[id] = { ...generatedTargets[id], ...targets };
    const battingTeamRules = existing.battingTeamRules ?? generateAiBattingTeamRules(battingPlayers, effectiveTactics, scenario === "bowlingFirst");
    const floaters = existing.floaters ?? (existing.floater ? [existing.floater] : generateAiFloaterRules(battingPlayers));
    matchPlans[scenario] = { ...existing, overs, battingCoverage: generated, battingTargets: generatedTargets, battingTeamRules, floaters, floater: floaters[0] ?? null };
  }
  return { ...plans, tactics: { ...plans.tactics, matchPlans } };
}
