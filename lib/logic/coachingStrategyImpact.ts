import type { TeamTactics, TeamStrategy } from "@/lib/logic/teamTactics";
import { createTeamTactics } from "@/lib/logic/teamTactics";
import type { CareerStaffState, CareerStaffContract } from "@/lib/logic/staffContracts";
import type { CuratorPitch } from "@/lib/data/pitchCurator";
import type { Team } from "@/lib/types";

export interface CoachingStaffModifiers {
  // Strategy Synergy Modifier: -0.03 to +0.03 (subtle execution multiplier)
  synergyModifier: number;

  // Phase Execution Modifiers (subtle deltas, e.g. -0.03 to +0.03)
  battingControlModifier: number;      // from batting_coach (1-20)
  paceExecutionModifier: number;       // from pace_bowling_coach (1-20)
  spinExecutionModifier: number;       // from spin_bowling_coach (1-20)
  catchingDropMultiplier: number;      // from fielding_coach (1-20), e.g. 0.90 to 1.10

  // Crisis & Pressure Management (subtle multipliers)
  collapseMitigationFactor: number;   // from head/assistant coach man_management & motivation
  chasePressureResilience: number;    // from head coach motivation

  // Summary metadata
  headCoachName: string | null;
  synergyStatus: "synergy" | "neutral" | "friction";
}

/**
 * Returns active contracted staff members for a specific team.
 */
export function getTeamStaffContracts(
  teamId: string,
  staffState?: CareerStaffState | null
): CareerStaffContract[] {
  if (!staffState || !staffState.contracts) return [];
  return Object.values(staffState.contracts).filter(
    (contract) => contract.teamId === teamId && contract.status === "contracted"
  );
}

/**
 * Helper to find a staff member with a specific role in their contract.
 */
export function findStaffByRole(
  contracts: CareerStaffContract[],
  role: string
): CareerStaffContract | null {
  return contracts.find((c) => c.roles.includes(role) || c.primaryRole === role) ?? null;
}

/**
 * Calculates subtle coaching staff multipliers for match simulation.
 * Scaling factor: 0.3% per rating point delta from baseline 10.
 * Maximum shift: ~3% to 5% impact, ensuring subtle, realistic performance influence.
 */
export function calculateCoachingStaffModifiers(
  teamId: string,
  staffState: CareerStaffState | null | undefined,
  tactics: TeamTactics
): CoachingStaffModifiers {
  const defaultResult: CoachingStaffModifiers = {
    synergyModifier: 0,
    battingControlModifier: 0,
    paceExecutionModifier: 0,
    spinExecutionModifier: 0,
    catchingDropMultiplier: 1.0,
    collapseMitigationFactor: 0,
    chasePressureResilience: 0,
    headCoachName: null,
    synergyStatus: "neutral",
  };

  if (!staffState) return defaultResult;

  const teamContracts = getTeamStaffContracts(teamId, staffState);
  if (teamContracts.length === 0) return defaultResult;

  const headCoach = findStaffByRole(teamContracts, "head_coach") || findStaffByRole(teamContracts, "coach");
  const battingCoach = findStaffByRole(teamContracts, "batting_coach");
  const paceCoach = findStaffByRole(teamContracts, "pace_bowling_coach");
  const spinCoach = findStaffByRole(teamContracts, "spin_bowling_coach");
  const fieldingCoach = findStaffByRole(teamContracts, "fielding_coach");
  const assistantCoach = findStaffByRole(teamContracts, "assistant_coach");

  let synergyModifier = 0;
  let synergyStatus: "synergy" | "neutral" | "friction" = "neutral";

  // 1. Strategy Alignment (Head Coach preferred_team_strategy vs Active Tactic Preset)
  if (headCoach) {
    const rawStrategy = (headCoach.preferredTeamStrategy ?? "").toLowerCase();
    const activePreset = tactics.preset.toLowerCase();

    const isAggressiveCoach = rawStrategy.includes("attack") || rawStrategy.includes("aggressive");
    const isAggressiveTactic = activePreset.includes("aggressive");

    const isBalancedCoach = rawStrategy.includes("balanced") || rawStrategy.includes("adaptive") || rawStrategy.includes("flexible");
    const isBalancedTactic = activePreset.includes("balanced");

    const isDefensiveCoach = rawStrategy.includes("youth") || rawStrategy.includes("anchor");
    const isDefensiveTactic = activePreset.includes("anchor");

    const isBowlingCoach = rawStrategy.includes("data") || rawStrategy.includes("bowling") || rawStrategy.includes("intensity");
    const isBowlingTactic = activePreset.includes("bowling");

    if (
      (isAggressiveCoach && isAggressiveTactic) ||
      (isBalancedCoach && isBalancedTactic) ||
      (isDefensiveCoach && isDefensiveTactic) ||
      (isBowlingCoach && isBowlingTactic)
    ) {
      synergyModifier = 0.02; // +2% subtle synergy boost
      synergyStatus = "synergy";
    } else if (
      (isAggressiveCoach && isDefensiveTactic) ||
      (isDefensiveCoach && isAggressiveTactic)
    ) {
      synergyModifier = -0.015; // -1.5% subtle friction penalty
      synergyStatus = "friction";
    }
  }

  // 2. Specialist Coaching Modifiers (0.3% per rating point delta above/below 10)
  const getRatingDelta = (coach: CareerStaffContract | null, attrKey: keyof CareerStaffContract["coachingAttributes"]): number => {
    if (!coach || !coach.coachingAttributes) return 0;
    const rating = coach.coachingAttributes[attrKey] ?? 10;
    return rating - 10;
  };

  // Batting Coach Execution (-2.7% to +3.0%)
  const battingDelta = getRatingDelta(battingCoach, "batting_coaching");
  const battingControlModifier = battingDelta * 0.003;

  // Pace Bowling Execution (-2.7% to +3.0%)
  const paceDelta = getRatingDelta(paceCoach, "pace_bowling_coaching");
  const paceExecutionModifier = paceDelta * 0.003;

  // Spin Bowling Execution (-2.7% to +3.0%)
  const spinDelta = getRatingDelta(spinCoach, "spin_bowling_coaching");
  const spinExecutionModifier = spinDelta * 0.003;

  // Fielding Catch Drop Multiplier (0.90 to 1.10, i.e. -10% drops for rating 20)
  const fieldingDelta = getRatingDelta(fieldingCoach, "fielding_coaching");
  const catchingDropMultiplier = 1.0 - (fieldingDelta * 0.01);

  // 3. Crisis & Pressure Management (Head + Assistant Coach man_management & motivation)
  const headManMgmt = getRatingDelta(headCoach, "man_management");
  const headMotiv = getRatingDelta(headCoach, "motivation");
  const asstManMgmt = getRatingDelta(assistantCoach, "man_management");
  const asstMotiv = getRatingDelta(assistantCoach, "motivation");

  const combinedLeaderDelta = (headManMgmt * 0.6) + (headMotiv * 0.4) + (asstManMgmt * 0.3) + (asstMotiv * 0.2);
  const collapseMitigationFactor = combinedLeaderDelta * 0.004; // subtle collapse reduction
  const chasePressureResilience = headMotiv * 0.003;          // subtle chase resilience

  return {
    synergyModifier,
    battingControlModifier,
    paceExecutionModifier,
    spinExecutionModifier,
    catchingDropMultiplier: Math.max(0.85, Math.min(1.15, catchingDropMultiplier)),
    collapseMitigationFactor,
    chasePressureResilience,
    headCoachName: headCoach?.fullName ?? null,
    synergyStatus,
  };
}

/**
 * Derives AI Team Tactics based on their active Head Coach's strategy, philosophy, and tactical knowledge.
 */
export function deriveAITeamTactics(
  team: Pick<Team, "id" | "aiPersonality">,
  staffState: CareerStaffState | null | undefined,
  pitch: CuratorPitch
): TeamTactics {
  const fallbackPreset: TeamStrategy = team.aiPersonality === "Aggressive"
    ? "Ultra Aggressive"
    : team.aiPersonality === "Conservative"
      ? "Anchor & Explode"
      : "Balanced";
  const defaultTactics = createTeamTactics(fallbackPreset);

  if (!staffState) return defaultTactics;

  const teamContracts = getTeamStaffContracts(team.id, staffState);
  const headCoach = findStaffByRole(teamContracts, "head_coach") || findStaffByRole(teamContracts, "coach");

  if (!headCoach) return defaultTactics;

  const rawStrategy = (headCoach.preferredTeamStrategy ?? "").toLowerCase();
  const rawPhilosophy = (headCoach.coachingPhilosophy ?? "").toLowerCase();
  const tacticalKnowledge = headCoach.coachingAttributes?.tactical_knowledge ?? 10;
  const preferences = headCoach.traitPreferences ?? {};

  // 1. Determine Preset Strategy
  let preset: TeamStrategy = fallbackPreset;
  if (rawStrategy.includes("attack") || rawStrategy.includes("aggressive")) {
    preset = "Ultra Aggressive";
  } else if (rawStrategy.includes("intensity")) {
    preset = pitch.expectedFirstInningsScore.max >= 190 ? "Ultra Aggressive" : "Bowling Dominant";
  } else if (rawStrategy.includes("data") || rawStrategy.includes("bowling")) {
    preset = "Bowling Dominant";
  } else if (rawStrategy.includes("youth") || rawStrategy.includes("anchor")) {
    preset = "Anchor & Explode";
  }

  const tactics = createTeamTactics(preset);

  // 2. Determine Sub-Tactics based on Philosophy
  if (rawPhilosophy.includes("tactical")) {
    tactics.oppositionPlan = "target-weak-bowler";
    tactics.bowling.powerplay = "matchups";
    tactics.tossPreference = "conditions";
  } else if (rawPhilosophy.includes("pragmatic")) {
    tactics.batting.powerplay = "attack";
    tactics.batting.death = "all-out";
    tactics.bowling.death = "yorkers";
    tactics.tossPreference = "bowl";
  } else if (rawPhilosophy.includes("technical")) {
    tactics.batting.middle = "rotate";
    tactics.bowling.field = "balanced";
  } else if (rawPhilosophy.includes("developmental")) {
    tactics.batting.collapseResponse = "stabilise";
    tactics.batting.chaseApproach = "stay-with-rate";
  }

  // Preferences only select existing tactics; they do not add another raw
  // performance multiplier, keeping the total coaching effect bounded.
  if ((preferences.batting_aggression ?? 50) >= 72) {
    tactics.batting.powerplay = "attack";
    tactics.batting.death = "all-out";
  } else if ((preferences.batting_aggression ?? 50) <= 38) {
    tactics.batting.powerplay = "cautious";
  }
  if ((preferences.bowling_attack_bias ?? 50) >= 72) {
    tactics.bowling.field = "attacking";
    tactics.bowling.death = "wicket-hunt";
  }

  // Tactical knowledge controls adaptation breadth, not a direct strength
  // bonus. Average coaches retain their identity; elite coaches read surfaces.
  if (tacticalKnowledge >= 13) {
    tactics.tossPreference = "conditions";
    if (pitch.expectedFirstInningsScore.max >= 200) tactics.batting.death = "all-out";
    if (pitch.expectedFirstInningsScore.max <= 175) tactics.batting.collapseResponse = "stabilise";
  }

  // 3. Pitch Adaptation for High Tactical Knowledge (16+)
  if (tacticalKnowledge >= 16) {
    if (pitch.favours.includes("spin-bowlers")) {
      tactics.bowling.middle = "spin-choke";
      tactics.oppositionPlan = "attack-spin";
    } else if (pitch.favours.includes("pace-bowlers") || pitch.favours.includes("high-rated-pace-bowlers")) {
      tactics.bowling.powerplay = "swing-attack";
    }
  }

  return tactics;
}
