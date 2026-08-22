import type { Player } from "@/lib/types";
import type { AuctionRoleGroup } from "@/lib/logic/auctionMarket";
import { getAuctionRoleGroup } from "@/lib/logic/auctionMarket";
import { addDaysToDateKey } from "@/lib/logic/careerCalendar";
import { createScoutingGeneratedPlayer } from "@/lib/logic/careerLifecycle";
import { generateIndianStateRegenName } from "@/lib/data/indianStateRegenNames";
import { getClubOwnership } from "@/lib/data/clubOwnership";

export type ScoutingMarket = "india" | "international";
export type ScoutingAssignmentKind = "regional-scan" | "full-assignment" | "intensive-search" | "deep-scout";

export interface ScoutingRegion {
  id: string;
  name: string;
  market: ScoutingMarket;
  country: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  depth: "Limited" | "Developing" | "Strong" | "Elite";
  specialisms: string[];
  preferredRoles: AuctionRoleGroup[];
  description: string;
}

export interface ScoutingAssignment {
  id: string;
  market: ScoutingMarket;
  regionId: string;
  kind: ScoutingAssignmentKind;
  slot: number;
  startedOn: string;
  completesOn: string;
  scheduledAuctionSeason: number;
  status: "active" | "completed";
  seed: string;
  reportIds: string[];
  targetReportId?: string;
}

export interface ScoutingReport {
  id: string;
  assignmentId: string;
  playerId: string;
  regionId: string;
  market: ScoutingMarket;
  discoveredOn: string;
  scheduledAuctionSeason: number;
  confidence: number;
  currentAbilityRange: [number, number];
  potentialRange: [number, number];
  summary: string;
  isNewDiscovery: boolean;
}

export interface ScoutingNetwork {
  regionId: string;
  level: number;
  completedAssignments: number;
}

export interface ScoutingAssignmentOption {
  kind: ScoutingAssignmentKind;
  label: string;
  days: number;
  reportCount: number;
  newDiscoveryLimit: number;
  baseConfidence: number;
  description: string;
}

export const MAX_ACTIVE_SCOUTING_ASSIGNMENTS = 3;

/**
 * Calculates dynamic max scouting assignment slots (range: 2 to 4 slots).
 */
export function getMaxScoutingAssignments(teamId?: string | null): number {
  if (!teamId) return MAX_ACTIVE_SCOUTING_ASSIGNMENTS;
  const ownership = getClubOwnership(teamId);
  return Math.min(4, Math.max(2, 2 + Math.floor(ownership.scouting_investment_level / 10)));
}

export const MAX_NEW_SCOUTING_PLAYERS_PER_AUCTION = 8;
export const MAX_NEW_INDIAN_SCOUTING_PLAYERS_PER_AUCTION = 5;
export const MAX_NEW_OVERSEAS_SCOUTING_PLAYERS_PER_AUCTION = 3;
export const DEEP_SCOUT_CONFIDENCE_STEP = 10;
export const DEEP_SCOUTING_DAYS = 14;

export const SCOUTING_ASSIGNMENT_OPTIONS: ScoutingAssignmentOption[] = [
  {
    kind: "regional-scan",
    label: "Regional Scan",
    days: 14,
    reportCount: 3,
    newDiscoveryLimit: 1,
    baseConfidence: 54,
    description: "A quick sweep of the market. Broad coverage, lower certainty.",
  },
  {
    kind: "full-assignment",
    label: "Full Assignment",
    days: 28,
    reportCount: 4,
    newDiscoveryLimit: 2,
    baseConfidence: 68,
    description: "Balanced live viewing and background work across the region.",
  },
  {
    kind: "intensive-search",
    label: "Intensive Search",
    days: 56,
    reportCount: 5,
    newDiscoveryLimit: 2,
    baseConfidence: 83,
    description: "Repeated viewings and deeper checks for the most reliable reports.",
  },
];

const india = (
  id: string,
  name: string,
  difficulty: ScoutingRegion["difficulty"],
  depth: ScoutingRegion["depth"],
  specialisms: string[],
  preferredRoles: AuctionRoleGroup[],
  description: string,
): ScoutingRegion => ({ id, name, market: "india", country: "India", difficulty, depth, specialisms, preferredRoles, description });

export const INDIA_SCOUTING_REGIONS: ScoutingRegion[] = [
  india("jammu-kashmir", "Jammu & Kashmir", 4, "Developing", ["Left-arm pace", "Resilient batters"], ["PACE", "BAT"], "A difficult northern network with improving pace depth."),
  india("himachal-pradesh", "Himachal Pradesh", 3, "Developing", ["Swing bowling", "Top-order technique"], ["PACE", "BAT"], "Helpful conditions reward technically sound players and swing bowlers."),
  india("punjab", "Punjab", 2, "Strong", ["Fast bowling", "Power hitting"], ["PACE", "AR", "BAT"], "A deep, athletic pathway with a strong pace tradition."),
  india("haryana", "Haryana", 3, "Strong", ["Seam bowling", "All-rounders"], ["PACE", "AR"], "Competitive district cricket produces robust seamers and all-rounders."),
  india("delhi", "Delhi", 2, "Elite", ["Elite batters", "Fast bowling"], ["BAT", "PACE", "WK"], "A dense, visible talent market with heavy competition for the best players."),
  india("uttarakhand", "Uttarakhand", 4, "Developing", ["Swing bowling", "Young prospects"], ["PACE", "BAT"], "A smaller and harder-to-cover pathway with untapped upside."),
  india("rajasthan", "Rajasthan", 3, "Strong", ["Leg spin", "Tall quicks"], ["SPIN", "PACE"], "Large distances make coverage harder, but bowling variety is excellent."),
  india("uttar-pradesh", "Uttar Pradesh", 3, "Elite", ["Pace depth", "Wicketkeepers"], ["PACE", "WK", "BAT"], "An enormous player base where good networks separate real prospects from noise."),
  india("bihar", "Bihar", 4, "Developing", ["Raw athletes", "Top-order batters"], ["BAT", "PACE"], "High-upside raw talent in a less established scouting structure."),
  india("sikkim", "Sikkim", 5, "Limited", ["Raw prospects", "Spin bowling"], ["SPIN", "BAT"], "A very small pool where extensive groundwork matters."),
  india("arunachal-pradesh", "Arunachal Pradesh", 5, "Limited", ["Raw athletes", "Unorthodox spin"], ["SPIN", "AR"], "Remote competitions can uncover unusual profiles, but rarely."),
  india("assam", "Assam", 4, "Strong", ["Seam bowling", "Athletic fielders"], ["PACE", "AR"], "The strongest north-eastern pathway with useful seam and all-round depth."),
  india("meghalaya", "Meghalaya", 5, "Limited", ["Seam bowling", "Raw prospects"], ["PACE", "AR"], "Limited depth, difficult coverage and occasional athletic upside."),
  india("nagaland", "Nagaland", 5, "Limited", ["Power hitting", "Raw athletes"], ["BAT", "AR"], "A small emerging market suited to long-horizon searches."),
  india("manipur", "Manipur", 5, "Limited", ["Athletic fielders", "Spin bowling"], ["SPIN", "AR"], "Athletic prospects are possible, though the cricket pool remains narrow."),
  india("mizoram", "Mizoram", 5, "Limited", ["Raw prospects", "Wicketkeepers"], ["WK", "BAT"], "A developing pathway where discoveries require patience."),
  india("tripura", "Tripura", 4, "Developing", ["Spin bowling", "Compact batters"], ["SPIN", "BAT"], "A modest but established pathway with useful spin profiles."),
  india("gujarat", "Gujarat", 2, "Elite", ["Top-order batters", "Spin all-rounders"], ["BAT", "AR", "SPIN"], "Deep professional structures regularly produce polished IPL prospects."),
  india("madhya-pradesh", "Madhya Pradesh", 3, "Strong", ["Multi-skilled batters", "Seam bowling"], ["BAT", "AR", "PACE"], "A broad state system with balanced role production."),
  india("jharkhand", "Jharkhand", 4, "Strong", ["Wicketkeeper-finishers", "Power hitting"], ["WK", "BAT", "AR"], "Harder to map, but capable of producing explosive middle-order talent."),
  india("west-bengal", "West Bengal", 2, "Elite", ["Fast bowling", "Technical batters"], ["PACE", "BAT"], "A mature cricket culture with elite seam and batting pathways."),
  india("chhattisgarh", "Chhattisgarh", 4, "Developing", ["Spin all-rounders", "Raw pace"], ["AR", "SPIN", "PACE"], "A newer first-class market with growing all-round depth."),
  india("odisha", "Odisha", 4, "Developing", ["Seam bowling", "Young batters"], ["PACE", "BAT"], "Scattered talent and modest depth reward persistent assignments."),
  india("maharashtra", "Maharashtra", 2, "Elite", ["Elite bowlers", "Complete batters"], ["PACE", "SPIN", "BAT"], "Mumbai and the wider state system form India's deepest elite talent market."),
  india("goa", "Goa", 4, "Developing", ["Technical batters", "Spin bowling"], ["BAT", "SPIN"], "A smaller pool with occasional technically refined players."),
  india("telangana", "Telangana", 2, "Elite", ["Stylish batters", "Fast bowling"], ["BAT", "PACE", "WK"], "An established urban pathway with high-quality batting and pace prospects."),
  india("andhra-pradesh", "Andhra Pradesh", 3, "Strong", ["Wicketkeepers", "Spin all-rounders"], ["WK", "AR", "SPIN"], "Good age-group depth and a reliable stream of middle-order players."),
  india("karnataka", "Karnataka", 2, "Elite", ["Fast bowling", "Top-order batters"], ["PACE", "BAT", "AR"], "A polished academy and club system with exceptional role depth."),
  india("kerala", "Kerala", 3, "Strong", ["Athletic pacers", "Wicketkeeper-batters"], ["PACE", "WK", "BAT"], "Athletic talent and improving professional depth."),
  india("tamil-nadu", "Tamil Nadu", 2, "Elite", ["Spin all-rounders", "Finishers"], ["AR", "SPIN", "BAT", "WK"], "A huge white-ball ecosystem rich in spin options and middle-order hitters."),
];

const international = (
  id: string,
  name: string,
  difficulty: ScoutingRegion["difficulty"],
  depth: ScoutingRegion["depth"],
  specialisms: string[],
  preferredRoles: AuctionRoleGroup[],
  description: string,
): ScoutingRegion => ({ id, name, market: "international", country: name, difficulty, depth, specialisms, preferredRoles, description });

export const INTERNATIONAL_SCOUTING_REGIONS: ScoutingRegion[] = [
  international("australia", "Australia", 2, "Elite", ["Fast bowlers", "Power hitters"], ["PACE", "AR", "BAT"], "Elite pathways and strong data make talent easier to validate."),
  international("england", "England", 2, "Elite", ["Seam all-rounders", "White-ball batters"], ["AR", "PACE", "BAT"], "Deep professional competitions provide reliable evidence."),
  international("south-africa", "South Africa", 3, "Elite", ["High-pace bowlers", "Athletic batters"], ["PACE", "BAT", "AR"], "Exceptional athletic upside, with competition for emerging talent."),
  international("new-zealand", "New Zealand", 2, "Strong", ["Swing bowlers", "Adaptable batters"], ["PACE", "BAT", "AR"], "A small but transparent and consistently high-quality system."),
  international("west-indies", "West Indies", 4, "Strong", ["Power hitters", "Fast bowling"], ["BAT", "PACE", "AR"], "Island-by-island coverage is difficult but the T20 ceiling is enormous."),
  international("sri-lanka", "Sri Lanka", 3, "Strong", ["Mystery spin", "Spin all-rounders"], ["SPIN", "AR", "BAT"], "A technically rich system with distinctive spin profiles."),
  international("bangladesh", "Bangladesh", 3, "Strong", ["Left-arm spin", "Middle-order batters"], ["SPIN", "AR", "BAT"], "Dense domestic cricket is particularly useful for spin recruitment."),
  international("afghanistan", "Afghanistan", 5, "Strong", ["Wrist spin", "Power hitting"], ["SPIN", "AR", "BAT"], "Hard to cover, but capable of producing rare T20 match-winners."),
  international("zimbabwe", "Zimbabwe", 4, "Developing", ["Seam all-rounders", "Top-order batters"], ["AR", "BAT", "PACE"], "A smaller pathway where the best multi-skilled players stand out."),
  international("ireland", "Ireland", 3, "Developing", ["Swing bowling", "Top-order batters"], ["PACE", "BAT"], "Accessible scouting with a modest but improving player pool."),
  international("netherlands", "Netherlands", 4, "Developing", ["Multi-skilled players", "Finishers"], ["AR", "BAT", "WK"], "A compact network with useful franchise-cricket experience."),
  international("nepal", "Nepal", 5, "Developing", ["Leg spin", "Young batters"], ["SPIN", "BAT"], "High fan interest and emerging talent, with limited top-level evidence."),
  international("united-states", "United States", 4, "Developing", ["Power hitters", "Mature late bloomers"], ["BAT", "AR", "PACE"], "A fast-growing mixed pathway with unusual player backgrounds."),
  international("united-arab-emirates", "United Arab Emirates", 3, "Developing", ["Spin all-rounders", "Finishers"], ["AR", "SPIN", "BAT"], "Strong access to expatriate competitions and franchise conditions."),
  international("namibia", "Namibia", 5, "Limited", ["Seam all-rounders", "Athletic fielders"], ["AR", "PACE"], "A very small pool with occasional IPL-suitable all-round talent."),
];

export const ALL_SCOUTING_REGIONS = [...INDIA_SCOUTING_REGIONS, ...INTERNATIONAL_SCOUTING_REGIONS];

export function getScoutingRegion(regionId: string): ScoutingRegion | undefined {
  return ALL_SCOUTING_REGIONS.find((region) => region.id === regionId);
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function abilityBand(market: ScoutingMarket, random: () => number): readonly [number, number] {
  const roll = random();
  if (market === "india") {
    if (roll < 0.60) return [62, 69];
    if (roll < 0.92) return [68, 75];
    if (roll < 0.995) return [74, 79];
    return [80, 82];
  }
  // Overseas players reach an IPL auction through a stronger selection filter,
  // while their much smaller seasonal quota keeps the global 65/35 intake mix.
  if (roll < 0.25) return [67, 72];
  if (roll < 0.70) return [72, 77];
  if (roll < 0.98) return [77, 81];
  return [82, 85];
}

function estimatedRange(value: number, confidence: number): [number, number] {
  const margin = confidence >= 100 ? 0 : confidence >= 88 ? 1 : confidence >= 74 ? 2 : confidence >= 60 ? 3 : 5;
  return [Math.max(45, value - margin), Math.min(99, value + margin)];
}

function tightenedEstimatedRange(
  value: number,
  confidence: number,
  previousRange: [number, number],
): [number, number] {
  if (confidence >= 100) return [value, value];
  const estimated = estimatedRange(value, confidence);
  const estimatedMargin = Math.max(value - estimated[0], estimated[1] - value);
  const previousMargin = Math.max(value - previousRange[0], previousRange[1] - value);
  const margin = Math.max(1, Math.min(estimatedMargin, previousMargin - 1));
  return [Math.max(45, value - margin), Math.min(99, value + margin)];
}

function reportSummary(player: Player, region: ScoutingRegion, confidence: number): string {
  const role = player.role === "WK-Batsman" ? "wicketkeeper-batter" : player.role.toLowerCase();
  if (confidence >= 100) return `Scouting is complete. The ${role}'s current ability and potential are now fully verified.`;
  if (confidence >= 82) return `Repeated viewings identify a ${role} with a credible route to the next IPL auction.`;
  if (confidence >= 65) return `Positive live evidence on this ${role}; another viewing would tighten the projection.`;
  return `An early lead from the ${region.name} network. The role is clear, but the rating projection remains broad.`;
}

export function deepenScoutingReport(report: ScoutingReport, player: Player): ScoutingReport {
  const confidence = Math.min(100, report.confidence + DEEP_SCOUT_CONFIDENCE_STEP);
  if (confidence === report.confidence) return report;
  const currentAbility = Math.max(player.currentBatting, player.currentBowling);
  const potential = Math.max(player.potentialBatting, player.potentialBowling);
  const region = getScoutingRegion(report.regionId);
  return {
    ...report,
    confidence,
    currentAbilityRange: tightenedEstimatedRange(currentAbility, confidence, report.currentAbilityRange),
    potentialRange: tightenedEstimatedRange(potential, confidence, report.potentialRange),
    summary: region ? reportSummary(player, region, confidence) : report.summary,
  };
}

export function getPlayerScoutingConfidence(reports: ScoutingReport[], playerId: string): number {
  return reports.reduce((highest, report) => (
    report.playerId === playerId ? Math.max(highest, Math.min(100, report.confidence)) : highest
  ), 0);
}

export function getBestPlayerScoutingReport(
  reports: ScoutingReport[],
  playerId: string,
): ScoutingReport | undefined {
  return reports.reduce<ScoutingReport | undefined>((best, report) => {
    if (report.playerId !== playerId) return best;
    if (!best || report.confidence > best.confidence) return report;
    return best;
  }, undefined);
}

export function createScoutingAssignment(input: {
  market: ScoutingMarket;
  regionId: string;
  kind: ScoutingAssignmentKind;
  currentDate: string;
  currentSeason: number;
  saveSeed: string;
  assignments: ScoutingAssignment[];
  teamId?: string;
}): { assignment?: ScoutingAssignment; message: string } {
  const region = getScoutingRegion(input.regionId);
  if (!region || region.market !== input.market) return { message: "Select a valid scouting region." };
  const option = SCOUTING_ASSIGNMENT_OPTIONS.find((candidate) => candidate.kind === input.kind);
  if (!option) return { message: "Select a valid assignment type." };
  const active = input.assignments.filter((assignment) => assignment.status === "active");
  const maxSlots = getMaxScoutingAssignments(input.teamId);
  if (active.length >= maxSlots) return { message: `All ${maxSlots} scouting slots are currently occupied.` };
  const slot = [1, 2, 3, 4].find((candidate) => candidate <= maxSlots && !active.some((assignment) => assignment.slot === candidate)) ?? 1;
  const sequence = input.assignments.length + 1;
  const seed = `${input.saveSeed}:${input.currentSeason}:${input.regionId}:${input.kind}:${sequence}`;
  return {
    assignment: {
      id: `scout-${input.currentSeason}-${hashSeed(seed).toString(36)}`,
      market: input.market,
      regionId: input.regionId,
      kind: input.kind,
      slot,
      startedOn: input.currentDate,
      completesOn: addDaysToDateKey(input.currentDate, option.days),
      scheduledAuctionSeason: input.currentSeason + 1,
      status: "active",
      seed,
      reportIds: [],
    },
    message: `${option.label} started in ${region.name}.`,
  };
}

export function createDeepScoutingAssignment(input: {
  report: ScoutingReport;
  player: Player;
  currentDate: string;
  currentSeason: number;
  saveSeed: string;
  assignments: ScoutingAssignment[];
  teamId?: string;
}): { assignment?: ScoutingAssignment; message: string } {
  if (input.report.confidence >= 100) return { message: `${input.player.name} is already fully scouted.` };
  const active = input.assignments.filter((assignment) => assignment.status === "active");
  const maxSlots = getMaxScoutingAssignments(input.teamId);
  if (active.length >= maxSlots) return { message: `All ${maxSlots} scouting slots are currently occupied.` };
  if (active.some((assignment) => assignment.targetReportId === input.report.id)) {
    return { message: `${input.player.name} is already being scouted in more depth.` };
  }
  const slot = [1, 2, 3, 4].find((candidate) => candidate <= maxSlots && !active.some((assignment) => assignment.slot === candidate)) ?? 1;
  const sequence = input.assignments.length + 1;
  const seed = `${input.saveSeed}:${input.currentSeason}:${input.report.id}:deep-scout:${sequence}`;
  return {
    assignment: {
      id: `scout-${input.currentSeason}-${hashSeed(seed).toString(36)}`,
      market: input.report.market,
      regionId: input.report.regionId,
      kind: "deep-scout",
      slot,
      startedOn: input.currentDate,
      completesOn: addDaysToDateKey(input.currentDate, DEEP_SCOUTING_DAYS),
      scheduledAuctionSeason: input.report.scheduledAuctionSeason,
      status: "active",
      seed,
      reportIds: [],
      targetReportId: input.report.id,
    },
    message: `A 14-day in-depth scouting assignment has started for ${input.player.name}.`,
  };
}

export function reconcileCompletedScoutingAssignments(input: {
  currentDate: string;
  currentSeason: number;
  saveSeed: string;
  players: Record<string, Player>;
  assignments: ScoutingAssignment[];
  reports: ScoutingReport[];
  networks: Record<string, ScoutingNetwork>;
}): {
  players: Record<string, Player>;
  assignments: ScoutingAssignment[];
  reports: ScoutingReport[];
  networks: Record<string, ScoutingNetwork>;
  completedCount: number;
} {
  const due = input.assignments.filter((assignment) => (
    assignment.status === "active" && assignment.completesOn <= input.currentDate
  ));
  if (due.length === 0) return { ...input, completedCount: 0 };

  let players = { ...input.players };
  let reports = [...input.reports];
  const networks = { ...input.networks };
  const assignmentsById = new Map(input.assignments.map((assignment) => [assignment.id, assignment]));

  due.sort((left, right) => left.completesOn.localeCompare(right.completesOn) || left.id.localeCompare(right.id));
  due.forEach((assignment) => {
    if (assignment.kind === "deep-scout") {
      const report = reports.find((candidate) => candidate.id === assignment.targetReportId);
      const player = report ? players[report.playerId] : undefined;
      if (report && player) {
        reports = reports.map((candidate) => (
          candidate.id === report.id ? deepenScoutingReport(candidate, player) : candidate
        ));
      }
      assignmentsById.set(assignment.id, {
        ...assignment,
        status: "completed",
        reportIds: report ? [report.id] : [],
      });
      return;
    }
    const region = getScoutingRegion(assignment.regionId);
    const option = SCOUTING_ASSIGNMENT_OPTIONS.find((candidate) => candidate.kind === assignment.kind);
    if (!region || !option) return;
    const network = networks[region.id] ?? { regionId: region.id, level: 0, completedAssignments: 0 };
    const confidence = Math.min(96, option.baseConfidence + network.level * 4 - Math.max(0, region.difficulty - 2) * 2);
    const random = seededRandom(assignment.seed);
    const alreadyReported = new Set(reports.map((report) => report.playerId));
    const targetSeason = assignment.scheduledAuctionSeason;
    const generatedForTarget = Object.values(players).filter((player) => (
      player.careerState?.origin === "generated" && player.careerState.generatedSeason === targetSeason
    ));
    const newIndianCount = generatedForTarget.filter((player) => player.nationality === "Indian").length;
    const newOverseasCount = generatedForTarget.filter((player) => player.nationality === "Overseas").length;
    const marketCapacity = region.market === "india"
      ? Math.max(0, MAX_NEW_INDIAN_SCOUTING_PLAYERS_PER_AUCTION - newIndianCount)
      : Math.max(0, MAX_NEW_OVERSEAS_SCOUTING_PLAYERS_PER_AUCTION - newOverseasCount);
    const totalCapacity = Math.max(0, MAX_NEW_SCOUTING_PLAYERS_PER_AUCTION - generatedForTarget.length);
    const newCount = Math.min(option.newDiscoveryLimit, marketCapacity, totalCapacity);
    const discovered: Array<{ player: Player; isNew: boolean }> = [];

    for (let index = 0; index < newCount; index += 1) {
      const generatedIndex = Object.values(players).filter((player) => (
        player.careerState?.origin === "generated" && player.careerState.generatedSeason === targetSeason
      )).length;
      const preferredRole = region.preferredRoles[Math.floor(random() * region.preferredRoles.length)]
        ?? region.preferredRoles[0];
      const forcedName = region.market === "india"
        ? generateIndianStateRegenName(
          region.id,
          seededRandom(`${assignment.seed}:${generatedIndex}:state-name`),
          Object.values(players).map((candidate) => candidate.name),
        )
        : undefined;
      const player = createScoutingGeneratedPlayer({
        index: generatedIndex,
        season: targetSeason,
        seed: input.saveSeed,
        players,
        nationality: region.market === "india" ? "Indian" : "Overseas",
        country: region.country,
        forcedName,
        preferredRole,
        targetCurrentRange: abilityBand(region.market, random),
        forceYoung: region.market === "india" || random() < 0.55,
      });
      players[player.id] = player;
      alreadyReported.add(player.id);
      discovered.push({ player, isNew: true });
    }

    const remaining = region.market === "international"
      ? Math.max(0, option.reportCount - discovered.length)
      : 0;
    // We know an existing overseas player's country, so international scouts
    // may assess the existing pool. Existing Indian players have no state of
    // origin data and must never be attributed to a domestic state assignment.
    const existingCandidates = region.market === "international"
      ? Object.values(players)
        .filter((player) => player.currentTeamId === null)
        .filter((player) => player.nationality === "Overseas")
        .filter((player) => player.country === region.country)
        .filter((player) => !alreadyReported.has(player.id))
        .sort((left, right) => (
          hashSeed(`${assignment.seed}:${left.id}`) - hashSeed(`${assignment.seed}:${right.id}`)
        ))
        .slice(0, remaining)
      : [];
    existingCandidates.forEach((player) => {
      alreadyReported.add(player.id);
      discovered.push({ player, isNew: false });
    });

    const assignmentReportIds: string[] = [];
    discovered.forEach(({ player, isNew }, index) => {
      const ability = Math.max(player.currentBatting, player.currentBowling);
      const potential = Math.max(player.potentialBatting, player.potentialBowling);
      const individualConfidence = Math.max(45, Math.min(96, confidence + Math.floor(random() * 7) - 3));
      const id = `report-${hashSeed(`${assignment.id}:${player.id}:${index}`).toString(36)}`;
      assignmentReportIds.push(id);
      reports.push({
        id,
        assignmentId: assignment.id,
        playerId: player.id,
        regionId: region.id,
        market: region.market,
        discoveredOn: input.currentDate,
        scheduledAuctionSeason: isNew ? targetSeason : Math.max(input.currentSeason + 1, targetSeason),
        confidence: individualConfidence,
        currentAbilityRange: estimatedRange(ability, individualConfidence),
        potentialRange: estimatedRange(potential, individualConfidence),
        summary: reportSummary(player, region, individualConfidence),
        isNewDiscovery: isNew,
      });
    });

    networks[region.id] = {
      regionId: region.id,
      completedAssignments: network.completedAssignments + 1,
      level: Math.min(4, Math.floor((network.completedAssignments + 1) / 2)),
    };
    assignmentsById.set(assignment.id, { ...assignment, status: "completed", reportIds: assignmentReportIds });
  });

  return {
    players,
    assignments: input.assignments.map((assignment) => assignmentsById.get(assignment.id) ?? assignment),
    reports,
    networks,
    completedCount: due.length,
  };
}

export function getScoutingPlayerRoleGroup(player: Player): AuctionRoleGroup {
  return getAuctionRoleGroup(player);
}
