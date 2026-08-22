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
  battingFirstImpactPlayerId: string | null;
  battingFirstOutgoingPlayerId: string | null;
  battingFirstImpactBattingPosition: number | null;
  bowlingFirstImpactPlayerId: string | null;
  bowlingFirstOutgoingPlayerId: string | null;
  bowlingFirstImpactBattingPosition: number | null;
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

  const batFirstPrimarySubId = recommended.battingFirst.impactPlayerId;
  const bowlFirstPrimarySubId = recommended.bowlingFirst.impactPlayerId;

  const batFirstBench = buildRecommendedImpactSubs(
    battingFirstXI,
    candidates,
    "battingFirst",
  );
  if (batFirstPrimarySubId) {
    const filtered = batFirstBench.filter((id) => id !== batFirstPrimarySubId);
    batFirstBench.splice(0, batFirstBench.length, batFirstPrimarySubId, ...filtered.slice(0, 4));
  }

  const bowlFirstBench = buildRecommendedImpactSubs(
    bowlingFirstXI,
    candidates,
    "bowlingFirst",
  );
  if (bowlFirstPrimarySubId) {
    const filtered = bowlFirstBench.filter((id) => id !== bowlFirstPrimarySubId);
    bowlFirstBench.splice(0, bowlFirstBench.length, bowlFirstPrimarySubId, ...filtered.slice(0, 4));
  }

  return {
    battingFirstXI,
    bowlingFirstXI,
    battingFirstImpactSubs: batFirstBench,
    bowlingFirstImpactSubs: bowlFirstBench,
    battingFirstImpactPlayerId: recommended.battingFirst.impactPlayerId,
    battingFirstOutgoingPlayerId: recommended.battingFirst.likelyOutgoingPlayerId,
    battingFirstImpactBattingPosition: recommended.battingFirst.impactBattingPosition ?? null,
    bowlingFirstImpactPlayerId: recommended.bowlingFirst.impactPlayerId,
    bowlingFirstOutgoingPlayerId: recommended.bowlingFirst.likelyOutgoingPlayerId,
    bowlingFirstImpactBattingPosition: recommended.bowlingFirst.impactBattingPosition ?? null,
  };
}
