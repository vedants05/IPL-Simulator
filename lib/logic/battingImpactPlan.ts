import type { Player } from "@/lib/types";
import { selectBattingFirstOutgoingBatter } from "./aiLineupSelector";
import { worldRules } from "./worldRules";

export function projectBatFirstImpact(
  startingXI: readonly string[], finalXI: readonly string[],
  plan: { impactSubs: readonly string[]; plannedImpactPlayerId?: string | null; plannedOutgoingPlayerId?: string | null; captainId?: string | null; viceCaptainId?: string | null },
  players: Record<string, Player>,
) {
  if (!worldRules().impactPlayerEnabled) return null;
  const isOverseas = (player: Player | undefined) => player?.nationality === "Overseas";
  const legalSwap = (incoming: Player) => startingXI.filter(id => isOverseas(players[id])).length + Number(isOverseas(incoming)) <= worldRules().maxOverseasInXI;
  const startingSet = new Set(startingXI);
  const candidates = plan.impactSubs.map(id => players[id]).filter((player): player is Player => Boolean(player && !startingSet.has(player.id) && player.currentBowling >= 50 && ["Pace Bowler", "Spin Bowler", "All-Rounder"].includes(player.role)));
  const planned = candidates.find(player => player.id === plan.plannedImpactPlayerId);
  const rankedIncoming = [...(planned ? [planned] : []), ...candidates.filter(player => player.id !== planned?.id).sort((a, b) => b.currentBowling - a.currentBowling || b.currentBatting - a.currentBatting)];
  const outgoingCandidates = finalXI.map(id => players[id]).filter((player): player is Player => Boolean(player));
  const protectedIds = new Set([plan.captainId, plan.viceCaptainId].filter((id): id is string => Boolean(id)));
  const plannedOutgoing = plan.plannedOutgoingPlayerId ? players[plan.plannedOutgoingPlayerId] : undefined;
  const preferredOutgoing = plannedOutgoing && finalXI.includes(plannedOutgoing.id) ? plannedOutgoing : selectBattingFirstOutgoingBatter(outgoingCandidates, protectedIds);
  const incoming = rankedIncoming.find(legalSwap);
  if (!incoming || !preferredOutgoing) return null;
  return { incoming, outgoing: preferredOutgoing, planned };
}
