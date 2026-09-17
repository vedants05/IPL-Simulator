export interface WorldRules {
  megaAuctionPurseLakhs: number;
  miniAuctionPurseLakhs: number;
  maxAuctionTargets: number;
  maxCappedRetentions: number;
  maxUncappedRetentions: number;
  maxTotalRetentions: number;
  /** Capped retention price tiers in lakhs, most expensive first. */
  cappedRetentionTiers: [number, number, number];
  uncappedRetentionCostLakhs: number;
  rtmEnabled: boolean;
  maxSquadSize: number;
  minSquadSize: number;
  maxOverseasInSquad: number;
  maxOverseasInXI: number;
  maxInjuryReplacementsPerTeam: number;
  miniTradeOverdraftLakhs: number;
}

export const DEFAULT_WORLD_RULES: WorldRules = {
  megaAuctionPurseLakhs: 12000,
  miniAuctionPurseLakhs: 12500,
  maxAuctionTargets: 5,
  maxCappedRetentions: 5,
  maxUncappedRetentions: 2,
  maxTotalRetentions: 6,
  cappedRetentionTiers: [1800, 1400, 1100],
  uncappedRetentionCostLakhs: 400,
  rtmEnabled: true,
  maxSquadSize: 25,
  minSquadSize: 18,
  maxOverseasInSquad: 8,
  maxOverseasInXI: 4,
  maxInjuryReplacementsPerTeam: 5,
  miniTradeOverdraftLakhs: 500,
};

export interface WorldRuleField {
  key: keyof WorldRules;
  label: string;
  group: string;
  min: number;
  max: number;
  step?: number;
  unit?: "lakhs" | "count" | "toggle";
  hint?: string;
}

export const WORLD_RULE_FIELDS: WorldRuleField[] = [
  { key: "megaAuctionPurseLakhs", label: "Mega auction purse", group: "Auction", min: 1000, max: 100000, step: 100, unit: "lakhs", hint: "Every team's purse when a mega auction opens." },
  { key: "miniAuctionPurseLakhs", label: "Mini auction salary cap", group: "Auction", min: 1000, max: 100000, step: 100, unit: "lakhs", hint: "Total salary cap for kept players plus mini-auction spending." },
  { key: "maxAuctionTargets", label: "Auction target slots", group: "Auction", min: 1, max: 25, unit: "count" },
  { key: "rtmEnabled", label: "Right to match cards", group: "Auction", min: 0, max: 1, unit: "toggle", hint: "RTM cards equal the unused retention slots at a mega auction." },
  { key: "maxCappedRetentions", label: "Max capped retentions", group: "Retentions", min: 0, max: 15, unit: "count" },
  { key: "maxUncappedRetentions", label: "Max uncapped retentions", group: "Retentions", min: 0, max: 15, unit: "count" },
  { key: "maxTotalRetentions", label: "Max total retentions", group: "Retentions", min: 0, max: 25, unit: "count" },
  { key: "uncappedRetentionCostLakhs", label: "Uncapped retention cost", group: "Retentions", min: 0, max: 5000, step: 50, unit: "lakhs" },
  { key: "maxSquadSize", label: "Max squad size", group: "Squad", min: 11, max: 40, unit: "count" },
  { key: "minSquadSize", label: "Min squad size", group: "Squad", min: 11, max: 40, unit: "count" },
  { key: "maxOverseasInSquad", label: "Max overseas in squad", group: "Squad", min: 0, max: 40, unit: "count" },
  { key: "maxOverseasInXI", label: "Max overseas in playing XI", group: "Squad", min: 0, max: 11, unit: "count", hint: "Also applies to the impact player substitution." },
  { key: "maxInjuryReplacementsPerTeam", label: "Injury replacements per season", group: "Squad", min: 0, max: 25, unit: "count" },
  { key: "miniTradeOverdraftLakhs", label: "Mini-auction trade overdraft", group: "Trades", min: 0, max: 10000, step: 50, unit: "lakhs", hint: "How far below zero a purse may go when completing a trade." },
];

let activeWorldRules: WorldRules = DEFAULT_WORLD_RULES;

export function normalizeWorldRules(input: Partial<WorldRules> | null | undefined): WorldRules {
  const merged = { ...DEFAULT_WORLD_RULES, ...(input ?? {}) };
  const clampField = (field: WorldRuleField) => {
    const value = merged[field.key];
    if (field.unit === "toggle") return Boolean(value);
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return DEFAULT_WORLD_RULES[field.key];
    return Math.max(field.min, Math.min(field.max, Math.round(numeric)));
  };
  const clamped = Object.fromEntries(WORLD_RULE_FIELDS.map((field) => [field.key, clampField(field)])) as unknown as WorldRules;
  const tiers = Array.isArray(merged.cappedRetentionTiers) && merged.cappedRetentionTiers.length === 3
    ? merged.cappedRetentionTiers.map((tier) => Math.max(0, Math.round(Number(tier) || 0))) as [number, number, number]
    : DEFAULT_WORLD_RULES.cappedRetentionTiers;
  return {
    ...clamped,
    cappedRetentionTiers: tiers,
    minSquadSize: Math.min(clamped.minSquadSize, clamped.maxSquadSize),
    maxTotalRetentions: Math.max(clamped.maxTotalRetentions, 0),
  };
}

/** Called by the game store whenever the save's rules load or change. */
export function setActiveWorldRules(rules: Partial<WorldRules> | null | undefined): WorldRules {
  activeWorldRules = normalizeWorldRules(rules);
  return activeWorldRules;
}

export function worldRules(): WorldRules {
  return activeWorldRules;
}

export function getCappedRetentionSlabsForCount(count: number, rules: WorldRules = activeWorldRules): number[] {
  const [top, middle, bottom] = rules.cappedRetentionTiers;
  if (count <= 0) return [];
  if (count === 1) return [top];
  if (count === 2) return [top, middle];
  if (count === 3) return [top, middle, bottom];
  if (count === 4) return [top, top, middle, bottom];
  const slabs = [top, top, middle, middle, bottom];
  while (slabs.length < count) slabs.push(bottom);
  return slabs;
}

export function getRtmCardsForRetentions(retainedCount: number, rules: WorldRules = activeWorldRules): number {
  if (!rules.rtmEnabled) return 0;
  return Math.max(0, rules.maxTotalRetentions - retainedCount);
}
