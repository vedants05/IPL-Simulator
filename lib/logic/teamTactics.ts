import { normalizeMatchPlans, type TacticalMatchPlan } from "./tacticalMatchPlan";

export const TEAM_STRATEGIES = [
  "Ultra Aggressive",
  "Balanced",
  "Anchor & Explode",
  "Bowling Dominant",
] as const;

export type TeamStrategy = typeof TEAM_STRATEGIES[number];
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
export type OppositionApproach = "defensive" | "neutral" | "attacking";
export type BowlerBattingApproach = "survive" | "normal" | "exploit" | "all-out";
export type BowlerOverTarget = "follow" | "see-off" | "rotate" | "boundary" | "attack" | "react";
export interface BowlerBattingInstruction { approach: BowlerBattingApproach; overs: BowlerOverTarget[] }
export type OpponentPlanChanges = { batting: Record<string, import("./tacticalMatchPlan").BattingCoverage>; bowling: Record<string, import("./tacticalMatchPlan").OverAssignment> };

export interface TeamTactics {
  opponentPlanChanges?: Record<string, Partial<Record<"battingFirst" | "bowlingFirst", OpponentPlanChanges>>>;
  bowlerBattingInstructions?: Record<string, BowlerBattingInstruction>;
  oppositionTargetBowlers?: Record<string, string>;
  oppositionApproaches?: Record<string, OppositionApproach>;
  matchPlans?: Partial<Record<"battingFirst" | "bowlingFirst", TacticalMatchPlan>>;
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
}

const PRESET_SETTINGS: Record<TeamStrategy, Omit<TeamTactics, "preset">> = {
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

export function createTeamTactics(preset: TeamStrategy = "Balanced"): TeamTactics {
  const settings = PRESET_SETTINGS[preset];
  return {
    preset,
    batting: { ...settings.batting },
    bowling: { ...settings.bowling },
    impactPolicy: settings.impactPolicy,
    tossPreference: settings.tossPreference,
    oppositionPlan: settings.oppositionPlan,
  };
}

export function applyTeamTacticsPreset(tactics: TeamTactics, preset: TeamStrategy): TeamTactics {
  return { ...createTeamTactics(preset), matchPlans: tactics.matchPlans, oppositionApproaches: tactics.oppositionApproaches, oppositionTargetBowlers: tactics.oppositionTargetBowlers, bowlerBattingInstructions: tactics.bowlerBattingInstructions, opponentPlanChanges: tactics.opponentPlanChanges };
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
    opponentPlanChanges: isObject(raw.opponentPlanChanges) ? Object.fromEntries(Object.entries(raw.opponentPlanChanges).filter(([, value]) => isObject(value)).map(([team, value]) => [team, Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([scenario, data]) => {
      if (!['battingFirst', 'bowlingFirst'].includes(scenario) || !isObject(data)) return [];
      const candidate = normalizeMatchPlans({ battingFirst: { overs: Array.from({length:20}, (_, i) => isObject(data.bowling) ? data.bowling[String(i)] : null), battingCoverage: data.batting } })?.battingFirst;
      return [[scenario, { batting: candidate?.battingCoverage ?? {}, bowling: Object.fromEntries((candidate?.overs ?? []).flatMap((entry, i) => entry ? [[String(i), entry]] : [])) }]];
    }))])) : {},
    bowlerBattingInstructions: isObject(raw.bowlerBattingInstructions) ? Object.fromEntries(Object.entries(raw.bowlerBattingInstructions).flatMap(([id, entry]) => {
      if (!isObject(entry)) return [];
      return [[id, { approach: oneOf(entry.approach, ["survive", "normal", "exploit", "all-out"] as const, "normal"), overs: Array.from({ length: 4 }, (_, i) => oneOf(Array.isArray(entry.overs) && !(i === 0 && entry.overs[i] === "react") ? entry.overs[i] : undefined, ["follow", "see-off", "rotate", "boundary", "attack", "react"] as const, "follow")) }]];
    })) : {},
    oppositionTargetBowlers: isObject(raw.oppositionTargetBowlers)
      ? Object.fromEntries(Object.entries(raw.oppositionTargetBowlers).filter(([, bowlerId]) => typeof bowlerId === "string" && bowlerId.length > 0)) as Record<string, string>
      : {},
    oppositionApproaches: isObject(raw.oppositionApproaches)
      ? Object.fromEntries(Object.entries(raw.oppositionApproaches).filter(([, approach]) => ["defensive", "neutral", "attacking"].includes(approach))) as Record<string, OppositionApproach>
      : {},
    matchPlans: normalizeMatchPlans(raw.matchPlans),
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

