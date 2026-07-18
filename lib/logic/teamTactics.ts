import type { Player } from "@/lib/types";

export const TEAM_STRATEGIES = [
  "Ultra Aggressive",
  "Balanced",
  "Anchor & Explode",
  "Bowling Dominant",
] as const;

export type TeamStrategy = typeof TEAM_STRATEGIES[number];
export type TacticalPlan = "battingFirst" | "bowlingFirst";
export type TacticalDiscipline = "batting" | "bowling";
export type BattingPowerplayPlan = "cautious" | "balanced" | "attack";
export type BattingMiddlePlan = "rebuild" | "rotate" | "dominate";
export type BattingDeathPlan = "preserve" | "flexible" | "all-out";
export type CollapseResponse = "keep-attacking" | "stabilise" | "deep-rebuild";
export type ChaseApproach = "stay-with-rate" | "preserve-wickets" | "front-load";
export type BowlingPowerplayPlan = "swing-attack" | "contain" | "matchups";
export type BowlingMiddlePlan = "pace" | "balanced" | "spin-choke";
export type BowlingDeathPlan = "defensive" | "yorkers" | "wicket-hunt";
export type FieldSetting = "defensive" | "balanced" | "attacking";
export type ImpactPolicy = "extra-batter" | "extra-bowler" | "match-situation";
export type TossPreference = "bat" | "bowl" | "conditions";
export type OppositionPlan = "neutral" | "target-weak-bowler" | "play-out-stars" | "attack-pace" | "attack-spin";

export interface TacticalRoles {
  anchor: string | null;
  powerplayAggressor: string | null;
  middleOversEnforcer: string | null;
  finisher: string | null;
  newBallBowler: string | null;
  middleOversController: string | null;
  strikeSpinner: string | null;
  deathBowler: string | null;
}

export type TacticalRole = keyof TacticalRoles;
export type TacticalRolePlans = Record<TacticalPlan, TacticalRoles>;

export interface TeamTactics {
  preset: TeamStrategy;
  batting: {
    powerplay: BattingPowerplayPlan;
    middle: BattingMiddlePlan;
    death: BattingDeathPlan;
    collapseResponse: CollapseResponse;
    chaseApproach: ChaseApproach;
  };
  bowling: {
    powerplay: BowlingPowerplayPlan;
    middle: BowlingMiddlePlan;
    death: BowlingDeathPlan;
    field: FieldSetting;
  };
  impactPolicy: ImpactPolicy;
  tossPreference: TossPreference;
  oppositionPlan: OppositionPlan;
  roles: TacticalRolePlans;
}

export const TACTICAL_ROLE_DEFINITIONS: Array<{
  id: TacticalRole;
  label: string;
  shortLabel: string;
  description: string;
  rule: string;
  discipline: TacticalDiscipline;
}> = [
  { id: "anchor", label: "Anchor", shortLabel: "Anchor", description: "Protects the innings when wickets fall.", rule: "Batting positions 1-5 and BAT 55+", discipline: "batting" },
  { id: "powerplayAggressor", label: "Powerplay aggressor", shortLabel: "PP aggressor", description: "Sets the boundary tempo against the new ball.", rule: "Batting positions 1-3 and BAT 50+", discipline: "batting" },
  { id: "middleOversEnforcer", label: "Middle-overs enforcer", shortLabel: "Middle enforcer", description: "Attacks matchups after the powerplay.", rule: "Batting positions 3-7 and BAT 55+", discipline: "batting" },
  { id: "finisher", label: "Finisher", shortLabel: "Finisher", description: "Takes responsibility for the final overs.", rule: "Batting position 5 or lower and BAT 50+", discipline: "batting" },
  { id: "newBallBowler", label: "New-ball bowler", shortLabel: "New ball", description: "Leads the pace attack in the powerplay.", rule: "Pace bowler and BOWL 55+", discipline: "bowling" },
  { id: "middleOversController", label: "Middle-overs controller", shortLabel: "Middle control", description: "Builds pressure through accurate middle overs.", rule: "Any bowler with BOWL 50+", discipline: "bowling" },
  { id: "strikeSpinner", label: "Strike spinner", shortLabel: "Strike spin", description: "Provides the main spin wicket threat.", rule: "Spin bowler and BOWL 50+", discipline: "bowling" },
  { id: "deathBowler", label: "Death bowler", shortLabel: "Death", description: "Takes responsibility for the final overs.", rule: "BOWL 60+ with pace or ACC 65+", discipline: "bowling" },
];

const emptyRoles = (): TacticalRoles => ({
  anchor: null,
  powerplayAggressor: null,
  middleOversEnforcer: null,
  finisher: null,
  newBallBowler: null,
  middleOversController: null,
  strikeSpinner: null,
  deathBowler: null,
});

const emptyRolePlans = (): TacticalRolePlans => ({
  battingFirst: emptyRoles(),
  bowlingFirst: emptyRoles(),
});

const PRESET_SETTINGS: Record<TeamStrategy, Omit<TeamTactics, "preset" | "roles">> = {
  "Ultra Aggressive": {
    batting: { powerplay: "attack", middle: "dominate", death: "all-out", collapseResponse: "keep-attacking", chaseApproach: "front-load" },
    bowling: { powerplay: "swing-attack", middle: "pace", death: "wicket-hunt", field: "attacking" },
    impactPolicy: "extra-batter",
    tossPreference: "bowl",
    oppositionPlan: "target-weak-bowler",
  },
  Balanced: {
    batting: { powerplay: "balanced", middle: "rotate", death: "flexible", collapseResponse: "stabilise", chaseApproach: "stay-with-rate" },
    bowling: { powerplay: "matchups", middle: "balanced", death: "yorkers", field: "balanced" },
    impactPolicy: "match-situation",
    tossPreference: "conditions",
    oppositionPlan: "neutral",
  },
  "Anchor & Explode": {
    batting: { powerplay: "cautious", middle: "rebuild", death: "all-out", collapseResponse: "deep-rebuild", chaseApproach: "preserve-wickets" },
    bowling: { powerplay: "contain", middle: "balanced", death: "yorkers", field: "defensive" },
    impactPolicy: "match-situation",
    tossPreference: "bat",
    oppositionPlan: "play-out-stars",
  },
  "Bowling Dominant": {
    batting: { powerplay: "balanced", middle: "rotate", death: "flexible", collapseResponse: "stabilise", chaseApproach: "stay-with-rate" },
    bowling: { powerplay: "swing-attack", middle: "spin-choke", death: "yorkers", field: "attacking" },
    impactPolicy: "extra-bowler",
    tossPreference: "bowl",
    oppositionPlan: "play-out-stars",
  },
};

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";

const normalizeRoleSet = (value: unknown): TacticalRoles => {
  const raw = isObject(value) ? value : {};
  const normalized = emptyRoles();
  const usedByDiscipline: Record<TacticalDiscipline, Set<string>> = {
    batting: new Set<string>(),
    bowling: new Set<string>(),
  };

  TACTICAL_ROLE_DEFINITIONS.forEach(({ id, discipline }) => {
    const playerId = typeof raw[id] === "string" ? raw[id] as string : null;
    if (!playerId || usedByDiscipline[discipline].has(playerId)) return;
    normalized[id] = playerId;
    usedByDiscipline[discipline].add(playerId);
  });
  return normalized;
};

const normalizeRolePlans = (value: unknown): TacticalRolePlans => {
  const raw = isObject(value) ? value : {};
  if (isObject(raw.battingFirst) || isObject(raw.bowlingFirst)) {
    return {
      battingFirst: normalizeRoleSet(raw.battingFirst),
      bowlingFirst: normalizeRoleSet(raw.bowlingFirst),
    };
  }

  // Older saves stored one role map. Carry it into both match plans.
  return {
    battingFirst: normalizeRoleSet(raw),
    bowlingFirst: normalizeRoleSet(raw),
  };
};

export function createTeamTactics(preset: TeamStrategy = "Balanced", roles: unknown = emptyRolePlans()): TeamTactics {
  const settings = PRESET_SETTINGS[preset];
  return {
    preset,
    batting: { ...settings.batting },
    bowling: { ...settings.bowling },
    impactPolicy: settings.impactPolicy,
    tossPreference: settings.tossPreference,
    oppositionPlan: settings.oppositionPlan,
    roles: normalizeRolePlans(roles),
  };
}

export function applyTeamTacticsPreset(tactics: TeamTactics, preset: TeamStrategy): TeamTactics {
  return createTeamTactics(preset, tactics.roles);
}

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (
  typeof value === "string" && allowed.includes(value as T) ? value as T : fallback
);

export function normalizeTeamTactics(value: unknown, legacyStrategy?: unknown): TeamTactics {
  const raw = isObject(value) ? value as Partial<TeamTactics> : {};
  const preset = oneOf(raw.preset ?? legacyStrategy, TEAM_STRATEGIES, "Balanced");
  const fallback = createTeamTactics(preset);
  const batting = isObject(raw.batting) ? raw.batting : {} as Partial<TeamTactics["batting"]>;
  const bowling = isObject(raw.bowling) ? raw.bowling : {} as Partial<TeamTactics["bowling"]>;

  return {
    preset,
    batting: {
      powerplay: oneOf(batting.powerplay, ["cautious", "balanced", "attack"], fallback.batting.powerplay),
      middle: oneOf(batting.middle, ["rebuild", "rotate", "dominate"], fallback.batting.middle),
      death: oneOf(batting.death, ["preserve", "flexible", "all-out"], fallback.batting.death),
      collapseResponse: oneOf(batting.collapseResponse, ["keep-attacking", "stabilise", "deep-rebuild"], fallback.batting.collapseResponse),
      chaseApproach: oneOf(batting.chaseApproach, ["stay-with-rate", "preserve-wickets", "front-load"], fallback.batting.chaseApproach),
    },
    bowling: {
      powerplay: oneOf(bowling.powerplay, ["swing-attack", "contain", "matchups"], fallback.bowling.powerplay),
      middle: oneOf(bowling.middle, ["pace", "balanced", "spin-choke"], fallback.bowling.middle),
      death: oneOf(bowling.death, ["defensive", "yorkers", "wicket-hunt"], fallback.bowling.death),
      field: oneOf(bowling.field, ["defensive", "balanced", "attacking"], fallback.bowling.field),
    },
    impactPolicy: oneOf(raw.impactPolicy, ["extra-batter", "extra-bowler", "match-situation"], fallback.impactPolicy),
    tossPreference: oneOf(raw.tossPreference, ["bat", "bowl", "conditions"], fallback.tossPreference),
    oppositionPlan: oneOf(raw.oppositionPlan, ["neutral", "target-weak-bowler", "play-out-stars", "attack-pace", "attack-spin"], fallback.oppositionPlan),
    roles: normalizeRolePlans(raw.roles),
  };
}

export function isPlayerEligibleForTacticalRole(player: Player, role: TacticalRole, battingPosition: number): boolean {
  const accuracy = player.attributes?.accuracy ?? 0;
  switch (role) {
    case "anchor": return battingPosition <= 4 && player.currentBatting >= 55;
    case "powerplayAggressor": return battingPosition <= 2 && player.currentBatting >= 50;
    case "middleOversEnforcer": return battingPosition >= 2 && battingPosition <= 6 && player.currentBatting >= 55;
    case "finisher": return battingPosition >= 4 && player.currentBatting >= 50;
    case "newBallBowler": return player.currentBowling >= 55 && player.bowlingStyle === "Pacer";
    case "middleOversController": return player.currentBowling >= 50;
    case "strikeSpinner": return player.currentBowling >= 50 && player.bowlingStyle === "Spinner";
    case "deathBowler": return player.currentBowling >= 60 && (player.bowlingStyle === "Pacer" || accuracy >= 65);
  }
}

const attribute = (player: Player, key: keyof Player["attributes"]) => player.attributes?.[key] ?? 50;

const roleScore = (player: Player, role: TacticalRole) => {
  switch (role) {
    case "anchor": return player.currentBatting * 2 + attribute(player, "technique") + attribute(player, "composure");
    case "powerplayAggressor": return player.currentBatting + attribute(player, "power") + (player.battingAggression ?? 50) + (player.isOpener ? 20 : 0);
    case "middleOversEnforcer": return player.currentBatting + attribute(player, "timing") + attribute(player, "placement");
    case "finisher": return player.currentBatting + attribute(player, "power") + attribute(player, "composure") + (player.isFinisher ? 25 : 0);
    case "newBallBowler": return player.currentBowling * 2 + attribute(player, "swing") + attribute(player, "seam");
    case "middleOversController": return player.currentBowling * 2 + attribute(player, "accuracy") + attribute(player, "variation");
    case "strikeSpinner": return player.currentBowling * 2 + attribute(player, "spin") + attribute(player, "flight") + attribute(player, "variation");
    case "deathBowler": return player.currentBowling * 2 + attribute(player, "accuracy") + attribute(player, "variation");
  }
};

export function autoAssignTacticalRoles(playersInBattingOrder: readonly Player[]): TacticalRoles {
  const result = emptyRoles();
  const positions = new Map(playersInBattingOrder.map((player, index) => [player.id, index]));
  const usedByDiscipline: Record<TacticalDiscipline, Set<string>> = {
    batting: new Set<string>(),
    bowling: new Set<string>(),
  };
  const assignmentOrder: TacticalRole[] = [
    "powerplayAggressor",
    "finisher",
    "middleOversEnforcer",
    "anchor",
    "strikeSpinner",
    "newBallBowler",
    "deathBowler",
    "middleOversController",
  ];

  assignmentOrder.forEach((role) => {
    const definition = TACTICAL_ROLE_DEFINITIONS.find((item) => item.id === role)!;
    const player = playersInBattingOrder
      .filter((candidate) => !usedByDiscipline[definition.discipline].has(candidate.id))
      .filter((candidate) => isPlayerEligibleForTacticalRole(candidate, role, positions.get(candidate.id) ?? 99))
      .slice()
      .sort((left, right) => roleScore(right, role) - roleScore(left, role))[0];
    if (!player) return;
    result[role] = player.id;
    usedByDiscipline[definition.discipline].add(player.id);
  });

  return result;
}

export function autoAssignTacticalRolesForPlan(
  tactics: TeamTactics,
  plan: TacticalPlan,
  playersInBattingOrder: readonly Player[],
): TeamTactics {
  return {
    ...tactics,
    roles: {
      ...tactics.roles,
      [plan]: autoAssignTacticalRoles(playersInBattingOrder),
    },
  };
}

export function setPlayerTacticalRole(
  tactics: TeamTactics,
  plan: TacticalPlan,
  playerId: string,
  discipline: TacticalDiscipline,
  role: TacticalRole | null,
): TeamTactics {
  if (role && TACTICAL_ROLE_DEFINITIONS.find((definition) => definition.id === role)?.discipline !== discipline) return tactics;
  const planRoles = { ...tactics.roles[plan] };

  TACTICAL_ROLE_DEFINITIONS
    .filter((definition) => definition.discipline === discipline)
    .forEach((definition) => {
      if (planRoles[definition.id] === playerId) planRoles[definition.id] = null;
    });
  if (role) planRoles[role] = playerId;

  return {
    ...tactics,
    roles: {
      ...tactics.roles,
      [plan]: planRoles,
    },
  };
}

export function getTacticsRiskProfile(tactics: TeamTactics): { tempo: number; risk: number; wicketIntent: number } {
  const tempo = ({ cautious: 0, balanced: 1, attack: 2 }[tactics.batting.powerplay])
    + ({ rebuild: 0, rotate: 1, dominate: 2 }[tactics.batting.middle])
    + ({ preserve: 0, flexible: 1, "all-out": 2 }[tactics.batting.death]);
  const risk = tempo + (tactics.bowling.field === "attacking" ? 2 : tactics.bowling.field === "balanced" ? 1 : 0);
  const wicketIntent = (tactics.bowling.powerplay === "swing-attack" ? 2 : tactics.bowling.powerplay === "matchups" ? 1 : 0)
    + (tactics.bowling.death === "wicket-hunt" ? 2 : tactics.bowling.death === "yorkers" ? 1 : 0)
    + (tactics.bowling.field === "attacking" ? 2 : tactics.bowling.field === "balanced" ? 1 : 0);
  return { tempo, risk, wicketIntent };
}
