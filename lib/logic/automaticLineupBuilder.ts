import type { Player } from "@/lib/types";

import { buildAiMatchLineups, type AiLineupOptions } from "./aiLineupSelector";
import {
  buildRecommendedImpactSubs,
  type LineupCandidate,
} from "./lineupPlanner";

export interface AutomaticLineupSelection {
  battingFirstXI: string[];
  bowlingFirstXI: string[];
  battingFirstImpactSubs: string[];
  bowlingFirstImpactSubs: string[];
}

export function playerToLineupCandidate(player: Player): LineupCandidate {
  return {
    id: player.id,
    nationality: player.nationality,
    role: player.role,
    batting: player.currentBatting,
    bowling: player.currentBowling,
    isWicketkeeper: player.role === "WK-Batsman"
      || Boolean(player.isWicketkeeper)
      || Boolean(player.isPartTimeWk),
    isPartTimeWicketkeeper: Boolean(player.isPartTimeWk),
    isOpener: player.isOpener,
    onlyOpensOrBenched: player.onlyOpensOrBenched,
  };
}

/**
 * Canonical implementation behind both first-season lineup initialization and
 * the Playing XIs "Auto-build both" action.
 */
export function buildAutomaticLineupSelection(
  squad: readonly Player[],
  options: AiLineupOptions = {},
): AutomaticLineupSelection {
  const candidates = squad.map(playerToLineupCandidate);
  const recommended = buildAiMatchLineups(squad, options);
  const battingFirstXI = recommended.battingFirst.startingXI;
  const bowlingFirstXI = recommended.bowlingFirst.startingXI;
  return {
    battingFirstXI,
    bowlingFirstXI,
    battingFirstImpactSubs: buildRecommendedImpactSubs(
      battingFirstXI,
      candidates,
      "battingFirst",
    ),
    bowlingFirstImpactSubs: buildRecommendedImpactSubs(
      bowlingFirstXI,
      candidates,
      "bowlingFirst",
    ),
  };
}
