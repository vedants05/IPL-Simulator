import {
  getHomeStadium,
  getCuratorPitch,
  getStadiumBoundaryLimits,
  type BoundaryDimensions,
  type CuratorPitch,
  type IplTeamId,
} from "@/lib/data/pitchCurator";
import type { Player, Team } from "@/lib/types";

export interface OpponentProfile {
  powerScore: number;
  isPowerHitting: boolean;
  spinStrength: number;
  paceStrength: number;
  isSpinDominant: boolean;
  isPaceDominant: boolean;
  spinVulnerable: boolean;
}

/**
 * Analyzes a team's squad to determine their tactical profile:
 * 1. Power-Hitting Score: Weighted combination of batting aggression + rating of top batters.
 * 2. Spin vs Pace Dominance: Total rating of top spin vs pace bowlers.
 * 3. Spin Vulnerability: High proportion of right-handed batters or low overall batting rating.
 */
export function analyzeOpponentProfile(
  opponentTeam: Team,
  players: Record<string, Player>,
): OpponentProfile {
  const squad = opponentTeam.squad
    .map((id) => players[id])
    .filter((p): p is Player => Boolean(p));

  // 1. Power Hitting Calculation
  const topBatters = squad
    .sort((a, b) => (b.currentBatting ?? 0) - (a.currentBatting ?? 0))
    .slice(0, 7);

  const powerHitsCount = topBatters.filter(
    (p) => (p.battingAggression ?? 65) >= 76 || (p.currentBatting ?? 0) >= 78 || p.isFinisher
  ).length;

  const avgAggression =
    topBatters.reduce((sum, p) => sum + (p.battingAggression ?? 65), 0) / Math.max(1, topBatters.length);
  const avgBattingRating =
    topBatters.reduce((sum, p) => sum + (p.currentBatting ?? 0), 0) / Math.max(1, topBatters.length);

  const powerScore = avgAggression * 0.55 + avgBattingRating * 0.45;
  const isPowerHitting = powerScore >= 74 || powerHitsCount >= 4;

  // 2. Bowling Dominance
  const topSpinners = squad.filter((p) => p.role === "Spin Bowler" && (p.currentBowling ?? 0) >= 70);
  const topPacers = squad.filter((p) => p.role === "Pace Bowler" && (p.currentBowling ?? 0) >= 70);

  const spinStrength = topSpinners.reduce((sum, p) => sum + (p.currentBowling ?? 0), 0);
  const paceStrength = topPacers.reduce((sum, p) => sum + (p.currentBowling ?? 0), 0);

  const isSpinDominant = spinStrength > paceStrength * 1.15 && topSpinners.length >= 2;
  const isPaceDominant = paceStrength > spinStrength * 1.15 && topPacers.length >= 2;

  // 3. Batting Handedness / Spin Vulnerability
  const rhbCount = topBatters.filter((p) => (p.battingStyle ?? "Right-hand") === "Right-hand").length;
  const spinVulnerable = rhbCount >= 5 || avgBattingRating < 74;

  return {
    powerScore,
    isPowerHitting,
    spinStrength,
    paceStrength,
    isSpinDominant,
    isPaceDominant,
    spinVulnerable,
  };
}

export interface AiCuratorDecision {
  pitchId: string;
  boundaries: BoundaryDimensions;
  reasoning: string;
}

/**
 * Determines the pitch and boundary dimensions selected by an AI home team
 * specifically tailored to counter-pick their upcoming opponent.
 */
export function determineAiHomeCuratorDecision(
  homeTeamId: string,
  awayTeamId: string,
  players: Record<string, Player>,
  teams: Record<string, Team>,
): AiCuratorDecision {
  const stadium = getHomeStadium(homeTeamId);
  const homeTeam = teams[homeTeamId];
  const awayTeam = teams[awayTeamId];

  if (!stadium || !homeTeam || !awayTeam) {
    return {
      pitchId: stadium?.defaultPitchId ?? "flat-track",
      boundaries: stadium?.defaultBoundaryDimensions ?? { straightMetres: 70, wideMetres: 67 },
      reasoning: "Standard default stadium configuration.",
    };
  }

  const homeProfile = analyzeOpponentProfile(homeTeam, players);
  const awayProfile = analyzeOpponentProfile(awayTeam, players);

  const availablePitches = stadium.pitches;
  const defaultLimits = getStadiumBoundaryLimits(homeTeamId) ?? {
    minimum: 60,
    straightMaximum: 75,
    wideMaximum: 72,
  };

  let chosenPitch = availablePitches.find((p) => p.id === stadium.defaultPitchId) ?? availablePitches[0];
  let straightMetres = stadium.defaultBoundaryDimensions.straightMetres;
  let wideMetres = stadium.defaultBoundaryDimensions.wideMetres;
  let reasoning = "";

  // Strategy 1: Counter Opponent Power-Hitting
  if (awayProfile.isPowerHitting) {
    // Expand boundaries towards maximum allowed limits to turn 6s into catches
    straightMetres = Math.min(defaultLimits.straightMaximum, straightMetres + 4);
    wideMetres = Math.min(defaultLimits.wideMaximum, wideMetres + 4);

    // Prefer a slow / turner / green pitch if available to stifle boundary hit rate
    const slowerPitch = availablePitches.find(
      (p) => p.type === "turner" || p.type === "slow" || p.type === "green"
    );
    if (slowerPitch) {
      chosenPitch = slowerPitch;
      reasoning = `Expanded boundaries (${straightMetres}m/${wideMetres}m) and selected ${slowerPitch.name} to neutralize ${awayTeam.shortName}'s power-hitting line-up.`;
    } else {
      reasoning = `Expanded boundaries to ${straightMetres}m/${wideMetres}m to contain ${awayTeam.shortName}'s explosive power hitters.`;
    }
  }
  // Strategy 2: Counter Spin-Dominant Opponent (if Home AI has stronger Pace)
  else if (awayProfile.isSpinDominant && homeProfile.paceStrength >= homeProfile.spinStrength) {
    const pacePitch = availablePitches.find(
      (p) => p.type === "green" || p.type === "hard" || p.favours.includes("pace-bowlers")
    );
    if (pacePitch) {
      chosenPitch = pacePitch;
      reasoning = `Selected ${pacePitch.name} to bypass ${awayTeam.shortName}'s spin attack and unleash home pace bowlers.`;
    }
  }
  // Strategy 3: Exploit Spin Vulnerabilities (if Home AI has Strong Spin Attack)
  else if (awayProfile.spinVulnerable && homeProfile.spinStrength >= 140) {
    const spinPitch = availablePitches.find(
      (p) => p.type === "turner" || p.type === "slow" || p.favours.includes("spin-bowlers")
    );
    if (spinPitch) {
      chosenPitch = spinPitch;
      reasoning = `Prepared ${spinPitch.name} to exploit ${awayTeam.shortName}'s spin vulnerability.`;
    }
  }
  // Strategy 4: Home Advantage Power Boosting
  else if (homeProfile.isPowerHitting && !awayProfile.isPowerHitting) {
    // Bring boundaries in slightly to maximize home team's boundary scoring
    straightMetres = Math.max(defaultLimits.minimum, straightMetres - 2);
    wideMetres = Math.max(defaultLimits.minimum, wideMetres - 2);
    const flatPitch = availablePitches.find((p) => p.type === "flat" || p.type === "hard");
    if (flatPitch) {
      chosenPitch = flatPitch;
      reasoning = `Brought boundaries in (${straightMetres}m/${wideMetres}m) on ${flatPitch.name} to maximize home team's hitting advantage.`;
    }
  }

  if (!reasoning) {
    reasoning = `Standard home pitch conditions prepared against ${awayTeam.shortName}.`;
  }

  return {
    pitchId: chosenPitch.id,
    boundaries: { straightMetres, wideMetres },
    reasoning,
  };
}
