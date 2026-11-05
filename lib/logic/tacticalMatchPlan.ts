export const BATTING_ROLES = ["normal", "powerplay-aggressor", "stabiliser", "spin-attacker", "pace-attacker", "finisher"] as const;
export type BattingRole = typeof BATTING_ROLES[number];
export const BATTING_COVERAGE_PHASES = ["powerplay", "earlyMiddle", "lateMiddle", "death", "chase"] as const;
export type BattingCoveragePhase = typeof BATTING_COVERAGE_PHASES[number];
export const BATTING_COVERAGE_INTENTS = { survive: -0.18, protect: -0.12, steady: -0.04, attack: 0.13, "all-out": 0.20 };
export type BattingCoverageIntent = keyof typeof BATTING_COVERAGE_INTENTS;
export type BattingCoverage = Partial<Record<BattingCoveragePhase, BattingCoverageIntent>>;
export const BATTING_TARGET_MODES = ["attack", "all-out", "keep-strike", "rotate", "boundaries", "see-off"] as const;
export type BattingTargetMode = typeof BATTING_TARGET_MODES[number];
export type BattingTargetRule = { modes: readonly BattingTargetMode[]; fromOver: number; untilOver: number };
export type BattingTargets = Partial<Record<"spin" | "pace", BattingTargetRule>>;

export const BATTING_SPECIAL_RULES = {
  "boundary-target": { label: "Team boundaries per over", thresholdLabel: "Target", min: 1, max: 3, default: 1, modes: ["attack", "boundaries"] },
  "settle-in": { label: "Settle the innings first", thresholdLabel: "Team balls", min: 1, max: 18, default: 6, modes: ["see-off", "rotate"] },
  "rebuild": { label: "Rebuild after wickets", thresholdLabel: "Wickets down", min: 1, max: 9, default: 3, modes: ["see-off"] },
  "chase-rate": { label: "Attack a rising chase rate", thresholdLabel: "Required RPO", min: 6, max: 30, default: 10, modes: ["attack", "rotate"] },
  "finish": { label: "Go all-out with wickets in hand", thresholdLabel: "Wickets left", min: 1, max: 10, default: 5, modes: ["all-out"] },
  "shield-tail": { label: "Protect the tail", thresholdLabel: "Wickets down", min: 1, max: 9, default: 7, modes: ["keep-strike"] },
} as const satisfies Record<string, { label: string; thresholdLabel: string; min: number; max: number; default: number; modes: readonly BattingTargetMode[] }>;
export type BattingSpecialRuleKind = keyof typeof BATTING_SPECIAL_RULES;
export type BattingRulePriority = 1 | 2 | 3;
export const BATTING_RULE_PRIORITIES = {
  1: { label: "Guidance", strength: 0.35 },
  2: { label: "Strong", strength: 0.7 },
  3: { label: "Must do", strength: 1 },
} as const;
export type BattingSpecialRule = { kind: BattingSpecialRuleKind; threshold: number; fromOver: number; untilOver: number; priority?: BattingRulePriority };
export const MAX_BATTING_SPECIAL_RULES = 3;

export function selectSpecialBattingRule(rules: readonly BattingSpecialRule[] | undefined, state: {
  over: number; boundariesThisOver: number; inningsBalls: number; wickets: number; requiredRate?: number;
  strikerBatting?: number; partnerBatting?: number; partnerPosition?: number;
}): BattingSpecialRule | undefined {
  const matches = rules?.filter(rule => {
    if (state.over < rule.fromOver || state.over > rule.untilOver) return false;
    switch (rule.kind) {
      case "boundary-target": return state.boundariesThisOver < rule.threshold;
      case "settle-in": return state.inningsBalls < rule.threshold;
      case "rebuild": return state.wickets >= rule.threshold;
      case "shield-tail": return state.wickets >= rule.threshold
        && state.strikerBatting !== undefined && state.partnerBatting !== undefined
        && state.strikerBatting >= state.partnerBatting + 10
        && (state.partnerBatting <= 60 || (state.partnerPosition ?? 0) >= 9);
      case "chase-rate": return state.requiredRate !== undefined && state.requiredRate >= rule.threshold;
      case "finish": return 10 - state.wickets >= rule.threshold;
    }
  });
  return matches?.reduce<BattingSpecialRule | undefined>((best, rule) =>
    !best || (rule.priority ?? 2) > (best.priority ?? 2) ? rule : best, undefined);
}

export function resolveSpecialBattingRule(rules: readonly BattingSpecialRule[] | undefined, state: Parameters<typeof selectSpecialBattingRule>[1]) {
  const rule = selectSpecialBattingRule(rules, state);
  return rule ? BATTING_SPECIAL_RULES[rule.kind].modes : undefined;
}

export function applySpecialBattingRuleIntent(intent: number, rule: BattingSpecialRule | undefined) {
  if (!rule) return intent;
  const strength = BATTING_RULE_PRIORITIES[rule.priority ?? 2].strength;
  const ruleIntent = applyBattingTarget(intent, BATTING_SPECIAL_RULES[rule.kind].modes);
  return intent + (ruleIntent - intent) * strength;
}

export function shapeSpecialBattingRuleRuns(
  weights: Parameters<typeof shapeBattingTargetRuns>[0],
  playerModes: readonly BattingTargetMode[] | undefined,
  rule: BattingSpecialRule | undefined,
  lastBallOfOver: boolean,
) {
  const base = shapeBattingTargetRuns(weights, playerModes, lastBallOfOver);
  if (!rule) return base;
  const target = shapeBattingTargetRuns(weights, BATTING_SPECIAL_RULES[rule.kind].modes, lastBallOfOver);
  const strength = BATTING_RULE_PRIORITIES[rule.priority ?? 2].strength;
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key,
    value + (target[key as keyof typeof target] - value) * strength,
  ])) as typeof base;
}

function battingTargetGroup(mode: BattingTargetMode) {
  if (mode === "keep-strike" || mode === "rotate") return "running";
  if (mode === "boundaries") return "scoring";
  return "intent";
}

export function toggleBattingTargetMode(modes: readonly BattingTargetMode[], mode: BattingTargetMode): BattingTargetMode[] {
  const remaining = modes.filter(previous => battingTargetGroup(previous) !== battingTargetGroup(mode));
  return modes.includes(mode) ? remaining : [...remaining, mode];
}

/** A bowler-specific over instruction replaces the corresponding player target. */
export function applyBowlerOverTargetModes(modes: readonly BattingTargetMode[] | undefined, target: string | undefined): readonly BattingTargetMode[] | undefined {
  if (target !== "rotate" && target !== "boundary") return modes;
  const mode: BattingTargetMode = target === "rotate" ? "rotate" : "boundaries";
  return [...(modes ?? []).filter(previous => battingTargetGroup(previous) !== battingTargetGroup(mode)), mode];
}

export function activeBattingTarget(targets: BattingTargets | undefined, bowlingType: "spin" | "pace" | undefined, over: number) {
  const rule = bowlingType ? targets?.[bowlingType] : undefined;
  return rule && over >= rule.fromOver && over <= rule.untilOver ? rule.modes : undefined;
}

export function applyBattingTarget(intent: number, modes: readonly BattingTargetMode[] | undefined): number {
  const mode = modes?.find(choice => battingTargetGroup(choice) === "intent");
  if (mode === "attack" || mode === "all-out") return Math.max(intent, BATTING_COVERAGE_INTENTS[mode]);
  if (mode === "see-off") return Math.min(intent, BATTING_COVERAGE_INTENTS.protect);
  return intent;
}

export function shapeBattingTargetRuns(
  weights: { dot: number; single: number; two: number; three: number; four: number; six: number },
  modes: readonly BattingTargetMode[] | undefined,
  lastBallOfOver: boolean,
) {
  if (!modes?.length) return weights;
  const shaped = { ...weights };
  if (modes.includes("keep-strike")) {
    shaped.single *= lastBallOfOver ? 1.55 : 0.65;
    shaped.three *= lastBallOfOver ? 1.25 : 0.8;
    if (!lastBallOfOver) shaped.two *= 1.25;
  } else if (modes.includes("rotate")) {
    shaped.single *= 1.4;
    shaped.dot *= 0.88;
  }
  if (modes.includes("boundaries")) {
    if (!lastBallOfOver || !modes.includes("keep-strike")) shaped.single *= 0.78;
    shaped.four *= 1.38;
    shaped.six *= 1.38;
  }
  if (modes.includes("see-off")) {
    shaped.dot *= 1.16;
    shaped.four *= 0.8;
    shaped.six *= 0.65;
  }
  return shaped;
}
export function battingCoveragePhase(over: number, powerplayEnd: number, deathStart: number): Exclude<BattingCoveragePhase, "chase"> {
  if (over <= powerplayEnd) return "powerplay";
  if (over >= deathStart) return "death";
  const earlyMiddleEnd = powerplayEnd + Math.ceil((deathStart - powerplayEnd - 1) / 2);
  return over <= earlyMiddleEnd ? "earlyMiddle" : "lateMiddle";
}

export function migrateBattingCoverage(coverage: unknown, role?: unknown): BattingCoverage {
  const saved = object(coverage);
  const defaults: BattingCoverage = {};
  if (role === "powerplay-aggressor") defaults.powerplay = "attack";
  if (role === "finisher") defaults.death = "attack";
  const middleDefault = role === "stabiliser" ? "steady"
    : role === "spin-attacker" || role === "pace-attacker" ? "attack" : undefined;
  const valid = (intent: unknown): intent is BattingCoverageIntent =>
    typeof intent === "string" && Object.prototype.hasOwnProperty.call(BATTING_COVERAGE_INTENTS, intent);
  const middle = valid(saved.middle) ? saved.middle : middleDefault;
  if (middle) defaults.earlyMiddle = defaults.lateMiddle = middle;
  for (const phase of BATTING_COVERAGE_PHASES) {
    const intent = saved[phase];
    if (valid(intent)) defaults[phase] = intent;
  }
  return defaults;
}
export const BATTING_TRIGGERS = ["early-wickets", "quick-wickets", "spin", "pace", "required-rate", "wickets-in-hand"] as const;
export const BATTING_ACTIONS = ["defend", "stabilise", "attack", "all-out"] as const;
export type BattingRule = {
  trigger: typeof BATTING_TRIGGERS[number];
  action: typeof BATTING_ACTIONS[number];
  threshold: number;
  over: number;
  balls: number;
  untilOver: number;
  releaseRate: number;
};
export const defaultBattingRule: BattingRule = {
  trigger: "early-wickets", action: "defend", threshold: 3, over: 8,
  balls: 12, untilOver: 10, releaseRate: 10,
};
export type OverAssignment = { playerId: string; mode: "fixed" | "preferred"; suggested?: true };
export type FloaterRule = {
  playerId: string;
  earliestPosition: number;
  latestPosition: number;
  fromOver: number;
  trigger: "over" | "spin" | "pace" | "required-rate" | "wickets";
  requiredRate: number;
  untilOver?: number;
  wickets?: number;
  protectCollapse?: boolean;
};
export interface TacticalMatchPlan {
  overs: (OverAssignment | null)[];
  roles: Record<string, BattingRole>;
  floater: FloaterRule | null;
  floaters?: FloaterRule[];
  battingRules?: Record<string, BattingRule[]>;
  battingCoverage?: Record<string, BattingCoverage>;
  battingTargets?: Record<string, BattingTargets>;
  battingTeamRules?: BattingSpecialRule[];
  response?: Partial<import("./teamTactics").TeamTactics["batting"]>;
}
export const emptyTacticalMatchPlan = (): TacticalMatchPlan => ({ overs: Array(20).fill(null), roles: {}, floater: null });
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const integer = (value: unknown, min: number, max: number, fallback: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;

export const MAX_BATTING_FLOATERS = 3;

export function getFloaterRules(plan: Pick<TacticalMatchPlan, "floater" | "floaters"> | null | undefined): readonly FloaterRule[] {
  return plan?.floaters ?? (plan?.floater ? [plan.floater] : []);
}

function normalizeFloaterRule(value: unknown): FloaterRule | null {
  const rule = object(value);
  if (typeof rule.playerId !== "string" || !rule.playerId) return null;
  const trigger = ["over", "spin", "pace", "required-rate", "wickets"].includes(String(rule.trigger)) ? rule.trigger as FloaterRule["trigger"] : "over";
  const wickets = integer(rule.wickets, 1, 9, 3);
  const earliest = Math.max(integer(rule.earliestPosition, 3, 11, 4), trigger === "wickets" ? wickets + 2 : 3);
  const fromOver = integer(rule.fromOver, 1, 20, 14);
  return {
    playerId: rule.playerId, earliestPosition: earliest,
    latestPosition: integer(rule.latestPosition, earliest, 11, Math.max(6, earliest)),
    fromOver, trigger, requiredRate: integer(rule.requiredRate, 1, 30, 10),
    ...(rule.untilOver !== undefined ? { untilOver: integer(rule.untilOver, fromOver, 20, 20) } : {}),
    ...(trigger === "wickets" || rule.wickets !== undefined ? { wickets } : {}),
    ...(rule.protectCollapse === true ? { protectCollapse: true } : {}),
  };
}

// Both rules conflict only if they could request the same batting entry.
// Spin and pace are exclusive; wicket/rate thresholds can be true together.
export function floaterRulesConflict(a: FloaterRule, b: FloaterRule): boolean {
  if (a.playerId === b.playerId) return true;
  if ((a.trigger === "spin" && b.trigger === "pace") || (a.trigger === "pace" && b.trigger === "spin")) return false;
  for (let over = Math.max(a.fromOver, b.fromOver); over <= Math.min(a.untilOver ?? 20, b.untilOver ?? 20); over++) {
    for (let slot = Math.max(a.earliestPosition, b.earliestPosition); slot <= Math.min(a.latestPosition, b.latestPosition); slot++) {
      const wickets = slot - 2;
      if ([a, b].every(rule => (rule.trigger !== "wickets" || wickets >= (rule.wickets ?? 3))
        && (!rule.protectCollapse || wickets < 3 || over > 8))) return true;
    }
  }
  return false;
}

export function normalizeFloaterRules(values: readonly unknown[]): FloaterRule[] {
  const rules: FloaterRule[] = [];
  for (const value of values.slice(0, MAX_BATTING_FLOATERS)) {
    const rule = normalizeFloaterRule(value);
    if (rule && !rules.some(other => floaterRulesConflict(rule, other))) rules.push(rule);
  }
  return rules;
}

export function floaterRuleError(rule: FloaterRule, order: readonly string[], others: readonly FloaterRule[]): string | undefined {
  const position = order.indexOf(rule.playerId) + 1;
  if (position < 4) return "Choose a batter from No. 4 or later.";
  if (rule.trigger === "wickets" && rule.earliestPosition < (rule.wickets ?? 3) + 2) return `With ${rule.wickets ?? 3} wickets down, use No. ${(rule.wickets ?? 3) + 2} or later.`;
  if (rule.earliestPosition >= position || rule.latestPosition >= position) return `Promotion must be earlier than their usual No. ${position} slot.`;
  if (rule.latestPosition < rule.earliestPosition || (rule.untilOver ?? 20) < rule.fromOver) return "The end of each range must follow its start.";
  if (others.some(other => other.playerId === rule.playerId)) return "This batter already has a floater rule.";
  if (others.some(other => floaterRulesConflict(rule, other))) return "Overlaps another floater. Change the overs, slots or bowling trigger.";
}

export function normalizeTacticalMatchPlan(value: unknown): TacticalMatchPlan {
  const raw = object(value);
  const overs = Array.from({ length: 20 }, (_, index): OverAssignment | null => {
    const slot = object(Array.isArray(raw.overs) ? raw.overs[index] : null);
    return typeof slot.playerId === "string" && slot.playerId && (slot.mode === "fixed" || slot.mode === "preferred")
      ? { playerId: slot.playerId, mode: slot.mode, ...(slot.suggested === true ? { suggested: true } : {}) } : null;
  });
  const legacyRoles = object(raw.roles);
  const floaters = normalizeFloaterRules(Array.isArray(raw.floaters) ? raw.floaters : [raw.floater]);
  const floater = floaters[0] ?? null;
  const battingRules: Record<string, BattingRule[]> = Object.fromEntries(
    Object.entries(object(raw.battingRules)).filter(([, rules]) => Array.isArray(rules)).map(([id, rules]) => [
      id, (rules as unknown[]).slice(0, 3).map(object).filter(rule =>
        BATTING_TRIGGERS.includes(rule.trigger as BattingRule["trigger"]) &&
        BATTING_ACTIONS.includes(rule.action as BattingRule["action"])
      ).map(rule => {
        const threshold = integer(rule.threshold, 1, rule.trigger === "required-rate" ? 30 : 9, 3);
        return {
          trigger: rule.trigger as BattingRule["trigger"],
          action: rule.action as BattingRule["action"],
          threshold, over: integer(rule.over, 1, 20, 8),
          balls: integer(rule.balls, 1, 30, 12), untilOver: integer(rule.untilOver, 2, 21, 10),
          releaseRate: rule.trigger === "required-rate"
            ? integer(rule.releaseRate, 0, threshold - 1, threshold - 1)
            : defaultBattingRule.releaseRate,
        };
      }),
    ]),
  );
  const rawResponse = object(raw.response);
  // Convert existing player rules into one deduplicated team rule list.
  // An explicit empty list clears rules instead of reimporting legacy data.
  const savedTeamRules = Array.isArray(raw.battingTeamRules) ? raw.battingTeamRules
    : Object.values(object(raw.battingSpecialRules)).flatMap(value => Array.isArray(value) ? value : []);
  const battingTeamRules = savedTeamRules.flatMap(value => {
      const saved = object(value);
      if (typeof saved.kind !== "string" || !Object.prototype.hasOwnProperty.call(BATTING_SPECIAL_RULES, saved.kind)) return [];
      const kind = saved.kind as BattingSpecialRuleKind;
      const spec = BATTING_SPECIAL_RULES[kind];
      const fromOver = integer(saved.fromOver, 1, 20, 1);
      return [{
        kind, fromOver, untilOver: integer(saved.untilOver, fromOver, 20, 20),
        threshold: integer(saved.threshold, spec.min, spec.max, spec.default),
        priority: integer(saved.priority, 1, 3, 2) as BattingRulePriority,
      }];
    }).filter((rule, index, rules) => Array.isArray(raw.battingTeamRules) || rules.findIndex(other => other.kind === rule.kind
      && other.threshold === rule.threshold && other.fromOver === rule.fromOver
      && other.untilOver === rule.untilOver && other.priority === rule.priority) === index).slice(0, MAX_BATTING_SPECIAL_RULES);
  const savedCoverage = object(raw.battingCoverage);
  const battingTargets = Object.fromEntries(Object.entries(object(raw.battingTargets)).flatMap(([id, value]) => {
    const saved = object(value);
    const targets: BattingTargets = {};
    for (const type of ["spin", "pace"] as const) {
      const target = saved[type];
      const rule = object(target);
      const choices = Array.isArray(rule.modes) ? rule.modes : [typeof target === "string" ? target : rule.mode];
      let modes: BattingTargetMode[] = [];
      for (const choice of choices) {
        if (!BATTING_TARGET_MODES.includes(choice as BattingTargetMode)) continue;
        const mode = choice as BattingTargetMode;
        modes = [...modes.filter(previous => battingTargetGroup(previous) !== battingTargetGroup(mode)), mode];
      }
      if (!modes.length) continue;
      const fromOver = integer(rule.fromOver, 1, 20, 1);
      targets[type] = { modes, fromOver, untilOver: integer(rule.untilOver, fromOver, 20, 20) };
    }
    return Object.keys(targets).length ? [[id, targets] as const] : [];
  }));
  const battingCoverage = Object.fromEntries(Array.from(new Set([...Object.keys(savedCoverage), ...Object.keys(legacyRoles)])).flatMap(id => {
    const coverage = migrateBattingCoverage(savedCoverage[id], legacyRoles[id]);
    return Object.keys(coverage).length ? [[id, coverage]] : [];
  }));
  const response: NonNullable<TacticalMatchPlan["response"]> = {};
  if (rawResponse.powerplay === "cautious" || rawResponse.powerplay === "balanced" || rawResponse.powerplay === "attack") response.powerplay = rawResponse.powerplay;
  if (rawResponse.middle === "rebuild" || rawResponse.middle === "rotate" || rawResponse.middle === "dominate") response.middle = rawResponse.middle;
  if (rawResponse.death === "preserve" || rawResponse.death === "flexible" || rawResponse.death === "all-out") response.death = rawResponse.death;
  if (rawResponse.collapseResponse === "keep-attacking" || rawResponse.collapseResponse === "stabilise" || rawResponse.collapseResponse === "deep-rebuild") response.collapseResponse = rawResponse.collapseResponse;
  if (rawResponse.chaseApproach === "stay-with-rate" || rawResponse.chaseApproach === "preserve-wickets" || rawResponse.chaseApproach === "front-load") response.chaseApproach = rawResponse.chaseApproach;
  return { overs, roles: {}, floater,
    ...(Array.isArray(raw.floaters) || floaters.length ? { floaters } : {}),
    ...(Object.keys(battingRules).length ? { battingRules } : {}),
    ...(Object.keys(battingCoverage).length ? { battingCoverage } : {}),
    ...(Object.keys(battingTargets).length ? { battingTargets } : {}),
    ...(battingTeamRules.length ? { battingTeamRules } : {}),
    ...(Object.keys(response).length ? { response } : {}),
  };
}

export function normalizeMatchPlans(value: unknown): Partial<Record<"battingFirst" | "bowlingFirst", TacticalMatchPlan>> | undefined {
  const raw = object(value);
  if (!raw.battingFirst && !raw.bowlingFirst) return undefined;
  return Object.fromEntries((["battingFirst", "bowlingFirst"] as const).filter(key => raw[key]).map(key => [key, normalizeTacticalMatchPlan(raw[key])]));
}

// Fixed late overs keep their meaning in shortened innings by moving with the
// death phase. Earlier slots retain their number; collisions favour late slots.
export function matchOverAssignments(plan: TacticalMatchPlan | undefined, inningsOvers: number): (OverAssignment | null)[] {
  const result: (OverAssignment | null)[] = Array(inningsOvers).fill(null);
  if (!plan) return result;
  plan.overs.forEach((slot, index) => {
    const mapped = index >= 15 && inningsOvers < 20 ? inningsOvers - (20 - index) : index;
    if (mapped >= 0 && mapped < inningsOvers && slot) result[mapped] = slot;
  });
  return result;
}

export function bowlingPlanWarnings(plan: TacticalMatchPlan, availableIds: readonly string[]): string[] {
  const warnings: string[] = [];
  const counts = new Map<string, number>();
  plan.overs.forEach((slot, index) => {
    if (!slot) return;
    counts.set(slot.playerId, (counts.get(slot.playerId) ?? 0) + 1);
    if (!availableIds.includes(slot.playerId)) warnings.push(`Over ${index + 1}: assigned player is outside this XI / Impact options.`);
    if (index > 0 && plan.overs[index - 1]?.playerId === slot.playerId) warnings.push(`Overs ${index}–${index + 1}: a bowler cannot bowl consecutive overs.`);
  });
  for (const count of Array.from(counts.values())) if (count > 4) warnings.push(`A bowler has ${count} overs assigned (maximum 4).`);
  return warnings;
}

// Check future fixed slots as well as quota and alternating overs. Memoisation
// keeps the 20-over search bounded; invalid saved plans fall back to automatic.
export function canCompleteAssignedOvers(
  nextOver: number, totalOvers: number, previousId: string | null,
  capacity: ReadonlyMap<string, number>, slots: readonly (OverAssignment | null)[],
): boolean {
  const ids = Array.from(capacity.keys());
  const remaining = ids.map(id => Math.max(0, capacity.get(id) ?? 0));
  const memo = new Set<string>();
  function visit(over: number, previous: number): boolean {
    if (over > totalOvers) return true;
    if (remaining.reduce((a, b) => a + b, 0) < totalOvers - over + 1) return false;
    const reserved = ids.map(() => 0);
    let lastFixed = -1;
    for (let future = over; future <= totalOvers; future++) {
      const assignment = slots[future - 1];
      const fixedIndex = assignment?.mode === "fixed" ? ids.indexOf(assignment.playerId) : -1;
      if (fixedIndex >= 0) {
        reserved[fixedIndex]++;
        if (reserved[fixedIndex] > remaining[fixedIndex] || fixedIndex === lastFixed || (future === over && fixedIndex === previous)) return false;
      }
      lastFixed = fixedIndex;
    }
    const key = `${over}:${previous}:${remaining.join(",")}`;
    if (memo.has(key)) return false;
    const slot = slots[over - 1];
    const fixed = slot?.mode === "fixed" ? ids.indexOf(slot.playerId) : -1;
    // Unknown/inactive players cannot constrain the rest of the innings.
    const candidates = fixed >= 0 ? [fixed] : ids.map((_, index) => index).sort((a, b) => remaining[b] - remaining[a]);
    for (const index of candidates) {
      if (index === previous || remaining[index] <= 0) continue;
      remaining[index]--;
      if (visit(over + 1, index)) { remaining[index]++; return true; }
      remaining[index]++;
    }
    memo.add(key);
    return false;
  }
  return visit(nextOver, previousId ? ids.indexOf(previousId) : -1);
}

export function chooseFloater(
  rules: FloaterRule | readonly FloaterRule[] | null | undefined, order: readonly string[], nextIndex: number,
  activeIds: readonly string[], legalBalls: number, inningsOvers: number,
  bowlingType: "spin" | "pace" | undefined, requiredRate?: number, wickets = 0,
): string | undefined {
  const candidates = normalizeFloaterRules(Array.isArray(rules) ? rules : [rules]).filter(rule => {
    if (!activeIds.includes(rule.playerId)) return false;
    const index = order.indexOf(rule.playerId);
    const position = nextIndex + 1;
    // Only promote an unused player. Never hold back the natural next batter.
    if (index <= nextIndex || position < wickets + 2 || position < rule.earliestPosition || position > rule.latestPosition) return false;
    const threshold = Math.max(1, Math.ceil(rule.fromOver * inningsOvers / 20));
    const over = Math.floor(legalBalls / 6) + 1;
    if (over < threshold) return false;
    if (rule.untilOver !== undefined && over > Math.ceil(rule.untilOver * inningsOvers / 20)) return false;
    if (rule.protectCollapse && wickets >= 3 && over <= Math.ceil(8 * inningsOvers / 20)) return false;
    if (rule.trigger === "wickets" && wickets < (rule.wickets ?? 3)) return false;
    if (rule.trigger === "spin" && bowlingType !== "spin") return false;
    if (rule.trigger === "pace" && bowlingType !== "pace") return false;
    if (rule.trigger === "required-rate" && (requiredRate === undefined || requiredRate < rule.requiredRate)) return false;
    return true;
  });
  // Shortened innings can compress distinct over windows into the same over.
  // Leave an ambiguous entry in the normal order rather than favouring a rule.
  return candidates.length === 1 ? candidates[0].playerId : undefined;
}

export function battingRoleIntent(role: BattingRole | undefined, over: number, totalOvers: number, recentWickets: number, bowlingType: "spin" | "pace" | undefined): number {
  if (role === "powerplay-aggressor" && over <= Math.max(1, Math.round(totalOvers * 0.3))) return 0.10;
  if (role === "stabiliser" && recentWickets >= 2) return -0.10;
  if (role === "spin-attacker" && bowlingType === "spin") return 0.08;
  if (role === "pace-attacker" && bowlingType === "pace") return 0.08;
  if (role === "finisher" && over > Math.floor(totalOvers * 0.75)) return 0.12;
  return 0;
}

const battingRuleIntent: Record<BattingRule["action"], number> = {
  defend: -0.18, stabilise: -0.10, attack: 0.13, "all-out": 0.20,
};

export function resolveBattingRule(
  rules: readonly BattingRule[] | undefined,
  starts: (number | undefined)[],
  state: {
    over: number; wickets: number; recentWickets: number; batterBalls: number;
    bowlingType?: "spin" | "pace"; requiredRate?: number;
  },
): number | undefined {
  let intent: number | undefined;
  rules?.forEach((rule, index) => {
    const { over, wickets, recentWickets, batterBalls, bowlingType, requiredRate } = state;
    const start = starts[index];
    let matches: boolean;
    switch (rule.trigger) {
      case "early-wickets": matches = over < rule.over && wickets >= rule.threshold; break;
      case "quick-wickets": matches = recentWickets >= rule.threshold; break;
      case "spin":
      case "pace": matches = over >= rule.over && bowlingType === rule.trigger; break;
      case "required-rate":
        matches = requiredRate !== undefined && (start === undefined
          ? requiredRate > rule.threshold : requiredRate >= rule.releaseRate);
        break;
      case "wickets-in-hand": matches = start !== undefined || (over >= rule.over && 10 - wickets >= rule.threshold); break;
    }
    const recovery = rule.action === "defend" || rule.action === "stabilise"
      || rule.trigger === "early-wickets" || rule.trigger === "quick-wickets";
    if (start === undefined && !matches) return;
    // Wicket triggers latch after activation so the batter gets the full recovery window.
    if (!matches && rule.trigger !== "early-wickets" && rule.trigger !== "quick-wickets") {
      if (!recovery) starts[index] = undefined;
      return;
    }
    if (recovery && (over >= rule.untilOver || (start !== undefined && batterBalls - start >= rule.balls))) return;
    starts[index] ??= batterBalls;
    intent ??= battingRuleIntent[rule.action];
  });
  return intent;
}
