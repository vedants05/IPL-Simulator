import { getClubOwnership } from "../data/clubOwnership";

export interface SeasonPerformanceOutcome {
  season: number;
  teamId: string;
  expectedPosition: number;
  finalPosition: number;
  reachedPlayoffs: boolean;
  reachedFinal: boolean;
  wonTitle: boolean;
}

/**
 * Calculates season-end Board Confidence change based on Option A Playoff vs Title curve.
 */
export function calculateSeasonBoardConfidenceChange(outcome: SeasonPerformanceOutcome): number {
  const ownership = getClubOwnership(outcome.teamId);
  const trophyObsession = ownership.trophy_obsession_level;

  let delta = 0;

  // Base position delta (+4 per position above expectation, -4 per position below)
  const positionGap = outcome.expectedPosition - outcome.finalPosition;
  delta += positionGap * 4;

  // Option A Playoff vs Title Board Confidence Evaluation Curve
  if (outcome.wonTitle) {
    delta += 30; // Grand Final victory is a massive success for all boards
  } else if (outcome.reachedFinal) {
    delta += 15;
  } else if (outcome.reachedPlayoffs) {
    // Low Trophy Obsession (RR 13, GT 14) -> Making Playoffs is a full success (+20)
    // High Trophy Obsession (MI 20, RCB 18) -> Playoff exit before Final gives 0 bonus
    if (trophyObsession <= 14) {
      delta += 20;
    } else if (trophyObsession <= 17) {
      delta += 8;
    } else {
      delta += 0; // High trophy obsession demands Finals/Title!
    }
  } else {
    // Missed playoffs completely
    delta -= 15;
  }

  return delta;
}

export function getInitialBoardConfidence(_teamId: string): number {
  return 75; // Initial baseline 75%
}

export function updateBoardConfidence(currentConfidence: number, delta: number): number {
  return Math.min(100, Math.max(0, currentConfidence + delta));
}
