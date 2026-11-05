import type { Player } from "@/lib/types";
import type { AiLineupPlan } from "./aiLineupSelector";

/** Bowling innings after the bat-first plan's intended impact swap. */
export function projectedOppositionBowlers(plan: AiLineupPlan, players: Record<string, Player>): Player[] {
  const swaps = Boolean(plan.impactPlayerId && plan.likelyOutgoingPlayerId && plan.startingXI.includes(plan.likelyOutgoingPlayerId));
  const ids = swaps ? plan.startingXI.filter(id => id !== plan.likelyOutgoingPlayerId).concat(plan.impactPlayerId!) : plan.startingXI;
  return Array.from(new Set(ids)).map(id => players[id]).filter((p): p is Player => {
    if (!p || p.currentBowling <= 0 || p.bowlingUsage === "emergency" || p.bowlingUsage === "does_not_bowl") return false;
    if (p.bowlingUsage) return ["frontline", "regular", "part_time"].includes(p.bowlingUsage);
    // Legacy players without usage metadata: recognised bowling roles only.
    return p.currentBowling >= 50 && ["Pace Bowler", "Spin Bowler", "All-Rounder"].includes(p.role);
  });
}

