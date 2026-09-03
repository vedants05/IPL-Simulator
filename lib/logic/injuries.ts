import type { Player } from "@/lib/types";
import { dateKeyToLocalDate } from "@/lib/logic/careerCalendar";

export type InjuryCategory = "minor" | "major";
export type InjuryWorseningRisk = "mild" | "moderate" | "severe";
export type InjurySource = "match" | "background";
export type InjuryResolution = "recovered" | "worsened";

export interface InjuryDefinition {
  id: string;
  name: string;
  category: InjuryCategory;
  minimumRecoveryDays: number;
  maximumRecoveryDays: number;
  weight: number;
  worseningRisk?: InjuryWorseningRisk;
  worsensTo?: string;
  roleAffinity?: Player["role"][];
  sourceAffinity?: InjurySource;
  seasonEnding?: boolean;
}

export interface PlayerInjury {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string;
  season: number;
  conditionId: string;
  conditionName: string;
  category: InjuryCategory;
  worseningRisk?: InjuryWorseningRisk;
  source: InjurySource;
  sourceMatchId?: string;
  startedOn: string;
  actualReturnDate: string;
  estimatedReturnEarliest: string;
  estimatedReturnLatest: string;
  matchesMissed: number;
  matchesPlayedThrough: number;
  worsenedFromConditionId?: string;
  endedOn?: string;
  resolution?: InjuryResolution;
}

export interface InjurySystemState {
  activeInjuries: Record<string, PlayerInjury>;
  injuryHistory: PlayerInjury[];
  processedInjuryMatchIds: string[];
  processedInjuryDateKeys: string[];
}

/**
 * Returns the share of the competitive season each player was unavailable.
 * Overlapping/worsened injury records are merged so the same day is never
 * counted twice. The season and injury ranges use [start, end) day intervals.
 */
export function calculateInjuryAbsenceShares(
  injuries: ReadonlyArray<PlayerInjury>,
  seasonStart: string,
  seasonEnd: string,
): Map<string, number> {
  const day = 24 * 60 * 60 * 1000;
  const windowStart = dateKeyToLocalDate(seasonStart).getTime();
  const windowEnd = dateKeyToLocalDate(seasonEnd).getTime() + day;
  const seasonDays = Math.max(1, Math.round((windowEnd - windowStart) / day));
  const rangesByPlayer = new Map<string, Array<[number, number]>>();

  injuries.forEach((injury) => {
    const start = Math.max(windowStart, dateKeyToLocalDate(injury.startedOn).getTime());
    const returnDate = injury.endedOn ?? injury.actualReturnDate;
    const end = Math.min(windowEnd, dateKeyToLocalDate(returnDate).getTime());
    if (end <= start) return;
    const ranges = rangesByPlayer.get(injury.playerId) ?? [];
    ranges.push([start, end]);
    rangesByPlayer.set(injury.playerId, ranges);
  });

  return new Map(Array.from(rangesByPlayer.entries()).map(([playerId, ranges]) => {
    const ordered = ranges.sort((left, right) => left[0] - right[0]);
    let unavailableMs = 0;
    let [currentStart, currentEnd] = ordered[0];
    ordered.slice(1).forEach(([start, end]) => {
      if (start <= currentEnd) currentEnd = Math.max(currentEnd, end);
      else {
        unavailableMs += currentEnd - currentStart;
        currentStart = start;
        currentEnd = end;
      }
    });
    unavailableMs += currentEnd - currentStart;
    return [playerId, Math.min(1, unavailableMs / day / seasonDays)];
  }));
}

export interface InjurySystemModifiers {
  /** Reserved for the future training system. Keep at 1 for the current game. */
  occurrenceChanceMultiplier: number;
  /** Reserved for the future medical staff system. Keep at 1 for the current game. */
  recoveryDurationMultiplier: number;
  /** Reserved for future medical/training effects. Keep at 1 for the current game. */
  worseningChanceMultiplier: number;
}

export const DEFAULT_INJURY_SYSTEM_MODIFIERS: InjurySystemModifiers = {
  occurrenceChanceMultiplier: 1,
  recoveryDurationMultiplier: 1,
  worseningChanceMultiplier: 1,
};

// Equal for every player who appeared. Role affects only the kind of condition,
// never whether an injury occurs.
export const POST_MATCH_INJURY_CHANCE = 0.0095;
export const DAILY_BACKGROUND_INJURY_CHANCE = 0.0001;
export const POST_MATCH_MAJOR_INJURY_SHARE = 0.10;
export const BACKGROUND_MAJOR_INJURY_SHARE = 0.08;
export const PRESEASON_SEASON_ENDING_INJURY_MIN = 1;
export const PRESEASON_SEASON_ENDING_INJURY_MAX = 2;

export const WORSENING_CHANCES: Record<InjuryWorseningRisk, number> = {
  mild: 0.02,
  moderate: 0.06,
  severe: 0.12,
};

export const INJURY_CATALOGUE: InjuryDefinition[] = [
  { id: "contusion", name: "Bruising / contusion", category: "minor", minimumRecoveryDays: 2, maximumRecoveryDays: 5, weight: 12, worseningRisk: "mild", worsensTo: "significant-contusion" },
  { id: "muscle-tightness", name: "Muscle tightness", category: "minor", minimumRecoveryDays: 2, maximumRecoveryDays: 4, weight: 13, worseningRisk: "mild", worsensTo: "muscle-strain" },
  { id: "mild-hamstring", name: "Mild hamstring strain", category: "minor", minimumRecoveryDays: 7, maximumRecoveryDays: 14, weight: 8, worseningRisk: "severe", worsensTo: "major-hamstring", roleAffinity: ["Batsman", "WK-Batsman", "All-Rounder", "Pace Bowler"] },
  { id: "mild-calf", name: "Mild calf strain", category: "minor", minimumRecoveryDays: 5, maximumRecoveryDays: 10, weight: 8, worseningRisk: "moderate", worsensTo: "major-calf", roleAffinity: ["Batsman", "All-Rounder", "Pace Bowler"] },
  { id: "mild-side", name: "Mild side strain", category: "minor", minimumRecoveryDays: 7, maximumRecoveryDays: 14, weight: 7, worseningRisk: "severe", worsensTo: "major-side", roleAffinity: ["All-Rounder", "Pace Bowler", "Spin Bowler"] },
  { id: "back-spasm", name: "Back spasm", category: "minor", minimumRecoveryDays: 3, maximumRecoveryDays: 7, weight: 7, worseningRisk: "moderate", worsensTo: "lower-back", roleAffinity: ["All-Rounder", "Pace Bowler", "Spin Bowler"] },
  { id: "shoulder-soreness", name: "Shoulder soreness", category: "minor", minimumRecoveryDays: 4, maximumRecoveryDays: 8, weight: 6, worseningRisk: "moderate", worsensTo: "shoulder-injury", roleAffinity: ["All-Rounder", "Pace Bowler", "Spin Bowler"] },
  { id: "finger-sprain", name: "Finger / thumb sprain", category: "minor", minimumRecoveryDays: 4, maximumRecoveryDays: 10, weight: 8, worseningRisk: "moderate", worsensTo: "hand-fracture", roleAffinity: ["WK-Batsman"] },
  { id: "wrist-sprain", name: "Wrist sprain", category: "minor", minimumRecoveryDays: 7, maximumRecoveryDays: 14, weight: 5, worseningRisk: "moderate", worsensTo: "major-wrist", roleAffinity: ["Batsman", "WK-Batsman", "Spin Bowler"] },
  { id: "mild-ankle", name: "Mild ankle sprain", category: "minor", minimumRecoveryDays: 5, maximumRecoveryDays: 12, weight: 7, worseningRisk: "moderate", worsensTo: "ankle-ligament" },
  { id: "knee-soreness", name: "Knee soreness", category: "minor", minimumRecoveryDays: 3, maximumRecoveryDays: 8, weight: 5, worseningRisk: "moderate", worsensTo: "knee-ligament", roleAffinity: ["WK-Batsman", "Pace Bowler"] },
  { id: "general-illness", name: "General illness", category: "minor", minimumRecoveryDays: 2, maximumRecoveryDays: 5, weight: 7, worseningRisk: "mild", worsensTo: "severe-viral", sourceAffinity: "background" },
  { id: "stomach-illness", name: "Stomach illness", category: "minor", minimumRecoveryDays: 1, maximumRecoveryDays: 3, weight: 5, worseningRisk: "mild", worsensTo: "gastrointestinal", sourceAffinity: "background" },

  { id: "significant-contusion", name: "Significant contusion", category: "major", minimumRecoveryDays: 7, maximumRecoveryDays: 14, weight: 8 },
  { id: "muscle-strain", name: "Muscle strain", category: "major", minimumRecoveryDays: 10, maximumRecoveryDays: 21, weight: 10 },
  { id: "major-hamstring", name: "Major hamstring strain", category: "major", minimumRecoveryDays: 28, maximumRecoveryDays: 56, weight: 6, roleAffinity: ["Batsman", "WK-Batsman", "All-Rounder", "Pace Bowler"] },
  { id: "major-calf", name: "Major calf strain", category: "major", minimumRecoveryDays: 21, maximumRecoveryDays: 42, weight: 6, roleAffinity: ["Batsman", "All-Rounder", "Pace Bowler"] },
  { id: "major-side", name: "Major side strain", category: "major", minimumRecoveryDays: 28, maximumRecoveryDays: 56, weight: 6, roleAffinity: ["All-Rounder", "Pace Bowler", "Spin Bowler"] },
  { id: "torn-muscle", name: "Torn muscle", category: "major", minimumRecoveryDays: 42, maximumRecoveryDays: 84, weight: 2 },
  { id: "lower-back", name: "Lower-back injury", category: "major", minimumRecoveryDays: 21, maximumRecoveryDays: 42, weight: 5, roleAffinity: ["All-Rounder", "Pace Bowler", "Spin Bowler"] },
  { id: "back-stress", name: "Back stress injury", category: "major", minimumRecoveryDays: 90, maximumRecoveryDays: 120, weight: 1, roleAffinity: ["Pace Bowler"] },
  { id: "back-disc", name: "Lower-back disc injury", category: "major", minimumRecoveryDays: 60, maximumRecoveryDays: 120, weight: 1 },
  { id: "shoulder-injury", name: "Shoulder strain / dislocation", category: "major", minimumRecoveryDays: 28, maximumRecoveryDays: 84, weight: 3, roleAffinity: ["All-Rounder", "Pace Bowler", "Spin Bowler"] },
  { id: "hand-fracture", name: "Hand / finger fracture", category: "major", minimumRecoveryDays: 28, maximumRecoveryDays: 56, weight: 4, roleAffinity: ["WK-Batsman"] },
  { id: "major-wrist", name: "Major wrist injury", category: "major", minimumRecoveryDays: 28, maximumRecoveryDays: 56, weight: 3, roleAffinity: ["Batsman", "WK-Batsman", "Spin Bowler"] },
  { id: "ankle-ligament", name: "Ankle ligament injury", category: "major", minimumRecoveryDays: 21, maximumRecoveryDays: 56, weight: 4 },
  { id: "knee-ligament", name: "Knee ligament injury", category: "major", minimumRecoveryDays: 60, maximumRecoveryDays: 180, weight: 1, roleAffinity: ["WK-Batsman", "Pace Bowler"] },
  { id: "foot-stress", name: "Foot stress fracture", category: "major", minimumRecoveryDays: 42, maximumRecoveryDays: 84, weight: 2, roleAffinity: ["Pace Bowler"] },
  { id: "severe-viral", name: "Severe viral illness", category: "major", minimumRecoveryDays: 7, maximumRecoveryDays: 14, weight: 4, sourceAffinity: "background" },
  { id: "respiratory", name: "Respiratory infection", category: "major", minimumRecoveryDays: 7, maximumRecoveryDays: 21, weight: 3, sourceAffinity: "background" },
  { id: "gastrointestinal", name: "Gastrointestinal illness", category: "major", minimumRecoveryDays: 4, maximumRecoveryDays: 8, weight: 3, sourceAffinity: "background" },
  { id: "concussion", name: "Concussion", category: "major", minimumRecoveryDays: 7, maximumRecoveryDays: 14, weight: 3, sourceAffinity: "match" },
  { id: "acl-rupture", name: "ACL rupture", category: "major", minimumRecoveryDays: 210, maximumRecoveryDays: 300, weight: 1, sourceAffinity: "background", seasonEnding: true },
  { id: "achilles-rupture", name: "Achilles tendon rupture", category: "major", minimumRecoveryDays: 210, maximumRecoveryDays: 300, weight: 1, sourceAffinity: "background", seasonEnding: true },
  { id: "shoulder-reconstruction", name: "Shoulder reconstruction", category: "major", minimumRecoveryDays: 180, maximumRecoveryDays: 270, weight: 1, sourceAffinity: "background", seasonEnding: true, roleAffinity: ["All-Rounder", "Pace Bowler", "Spin Bowler"] },
  { id: "spinal-stress-fracture", name: "Spinal stress fracture", category: "major", minimumRecoveryDays: 180, maximumRecoveryDays: 270, weight: 1, sourceAffinity: "background", seasonEnding: true, roleAffinity: ["Pace Bowler"] },
];

const definitionById = new Map(INJURY_CATALOGUE.map((definition) => [definition.id, definition]));

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function injuryRandom(seed: string): number {
  let value = hashSeed(seed) || 1;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967296;
}

export function addInjuryDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function estimateSpread(durationDays: number): number {
  if (durationDays <= 3) return 0;
  if (durationDays <= 7) return 1;
  if (durationDays <= 14) return 2;
  if (durationDays <= 30) return 3;
  if (durationDays <= 60) return 5;
  if (durationDays <= 120) return 10;
  return 14;
}

function chooseWeightedDefinition(
  category: InjuryCategory,
  player: Player,
  source: InjurySource,
  seed: string,
): InjuryDefinition {
  const candidates = INJURY_CATALOGUE
    .filter((definition) => definition.category === category && !definition.seasonEnding)
    .map((definition) => {
      const roleMultiplier = definition.roleAffinity?.includes(player.role) ? 3 : 1;
      const sourceMultiplier = definition.sourceAffinity === source
        ? 3
        : definition.sourceAffinity
          ? 0
          : 1;
      return { definition, weight: definition.weight * roleMultiplier * sourceMultiplier };
    });
  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let target = injuryRandom(`${seed}:definition`) * totalWeight;
  for (const candidate of candidates) {
    target -= candidate.weight;
    if (target <= 0) return candidate.definition;
  }
  return candidates[candidates.length - 1].definition;
}

export function createPlayerInjury({
  player,
  teamId,
  season,
  date,
  source,
  seed,
  category,
  conditionId,
  sourceMatchId,
  worsenedFromConditionId,
  modifiers = DEFAULT_INJURY_SYSTEM_MODIFIERS,
}: {
  player: Player;
  teamId: string;
  season: number;
  date: string;
  source: InjurySource;
  seed: string;
  category: InjuryCategory;
  conditionId?: string;
  sourceMatchId?: string;
  worsenedFromConditionId?: string;
  modifiers?: InjurySystemModifiers;
}): PlayerInjury {
  const definition = conditionId
    ? definitionById.get(conditionId)
    : chooseWeightedDefinition(category, player, source, seed);
  if (!definition || definition.category !== category) {
    throw new Error(`Unknown ${category} injury definition: ${conditionId ?? "generated"}`);
  }
  const recoveryRange = definition.maximumRecoveryDays - definition.minimumRecoveryDays;
  const sampledDays = definition.minimumRecoveryDays
    + Math.floor(injuryRandom(`${seed}:duration`) * (recoveryRange + 1));
  const recoveryDays = Math.max(1, Math.round(sampledDays * modifiers.recoveryDurationMultiplier));
  const spread = estimateSpread(recoveryDays);
  const earliestDays = Math.max(definition.minimumRecoveryDays, recoveryDays - spread);
  const latestDays = Math.min(definition.maximumRecoveryDays, recoveryDays + spread);
  return {
    id: `${season}:${date}:${player.id}:${source}:${definition.id}`,
    playerId: player.id,
    playerName: player.name,
    teamId,
    season,
    conditionId: definition.id,
    conditionName: definition.name,
    category,
    worseningRisk: definition.worseningRisk,
    source,
    sourceMatchId,
    startedOn: date,
    actualReturnDate: addInjuryDays(date, recoveryDays),
    estimatedReturnEarliest: addInjuryDays(date, earliestDays),
    estimatedReturnLatest: addInjuryDays(date, latestDays),
    matchesMissed: 0,
    matchesPlayedThrough: 0,
    worsenedFromConditionId,
  };
}

export function reconcileInjuryRecoveries(
  state: InjurySystemState,
  date: string,
): { state: InjurySystemState; recovered: PlayerInjury[] } {
  const activeInjuries = { ...state.activeInjuries };
  const recovered: PlayerInjury[] = [];
  Object.entries(activeInjuries).forEach(([playerId, injury]) => {
    if (injury.actualReturnDate > date) return;
    const resolved = { ...injury, endedOn: injury.actualReturnDate, resolution: "recovered" as const };
    recovered.push(resolved);
    delete activeInjuries[playerId];
  });
  if (recovered.length === 0) return { state, recovered };
  return {
    state: {
      ...state,
      activeInjuries,
      injuryHistory: [...recovered, ...state.injuryHistory],
    },
    recovered,
  };
}

export interface MatchInjuryParticipant {
  player: Player;
  teamId: string;
}

export interface ProcessMatchInjuriesInput {
  matchId: string;
  date: string;
  season: number;
  seed: string;
  teamIds: [string, string];
  participants: MatchInjuryParticipant[];
  modifiers?: InjurySystemModifiers;
}

export interface InjuryProcessingResult {
  created: PlayerInjury[];
  worsened: PlayerInjury[];
  recovered: PlayerInjury[];
}

export function processMatchInjuries(
  initialState: InjurySystemState,
  input: ProcessMatchInjuriesInput,
): { state: InjurySystemState; result: InjuryProcessingResult } {
  const reconciled = reconcileInjuryRecoveries(initialState, input.date);
  if (reconciled.state.processedInjuryMatchIds.includes(input.matchId)) {
    return { state: reconciled.state, result: { created: [], worsened: [], recovered: reconciled.recovered } };
  }
  const modifiers = input.modifiers ?? DEFAULT_INJURY_SYSTEM_MODIFIERS;
  const activeInjuries = { ...reconciled.state.activeInjuries };
  const history = [...reconciled.state.injuryHistory];
  const participantsById = new Map(input.participants.map((entry) => [entry.player.id, entry]));
  const created: PlayerInjury[] = [];
  const worsened: PlayerInjury[] = [];

  Object.entries(activeInjuries).forEach(([playerId, injury]) => {
    if (!input.teamIds.includes(injury.teamId)) return;
    if (injury.category === "major" && !participantsById.has(playerId)) {
      activeInjuries[playerId] = { ...injury, matchesMissed: injury.matchesMissed + 1 };
    }
  });

  input.participants.forEach(({ player, teamId }) => {
    const active = activeInjuries[player.id];
    if (active?.category === "major") return;
    if (active?.category === "minor") {
      const updatedMinor = { ...active, matchesPlayedThrough: active.matchesPlayedThrough + 1 };
      const risk = active.worseningRisk ? WORSENING_CHANCES[active.worseningRisk] : 0;
      const worsens = injuryRandom(`${input.seed}:${input.matchId}:${player.id}:worsen`)
        < risk * modifiers.worseningChanceMultiplier;
      if (!worsens) {
        activeInjuries[player.id] = updatedMinor;
        return;
      }
      const definition = definitionById.get(active.conditionId);
      const majorConditionId = definition?.worsensTo;
      const resolvedMinor = {
        ...updatedMinor,
        endedOn: input.date,
        resolution: "worsened" as const,
      };
      history.unshift(resolvedMinor);
      const major = createPlayerInjury({
        player,
        teamId,
        season: input.season,
        date: input.date,
        source: "match",
        sourceMatchId: input.matchId,
        seed: `${input.seed}:${input.matchId}:${player.id}:major`,
        category: "major",
        conditionId: majorConditionId,
        worsenedFromConditionId: active.conditionId,
        modifiers,
      });
      activeInjuries[player.id] = major;
      worsened.push(major);
      return;
    }

    const occurrenceRoll = injuryRandom(`${input.seed}:${input.matchId}:${player.id}:occurrence`);
    if (occurrenceRoll >= POST_MATCH_INJURY_CHANCE * modifiers.occurrenceChanceMultiplier) return;
    const category: InjuryCategory = injuryRandom(`${input.seed}:${input.matchId}:${player.id}:category`)
      < POST_MATCH_MAJOR_INJURY_SHARE
      ? "major"
      : "minor";
    const injury = createPlayerInjury({
      player,
      teamId,
      season: input.season,
      date: input.date,
      source: "match",
      sourceMatchId: input.matchId,
      seed: `${input.seed}:${input.matchId}:${player.id}`,
      category,
      modifiers,
    });
    activeInjuries[player.id] = injury;
    created.push(injury);
  });

  return {
    state: {
      activeInjuries,
      injuryHistory: history,
      processedInjuryMatchIds: [...reconciled.state.processedInjuryMatchIds, input.matchId],
      processedInjuryDateKeys: reconciled.state.processedInjuryDateKeys,
    },
    result: { created, worsened, recovered: reconciled.recovered },
  };
}

export interface ProcessBackgroundInjuriesInput {
  date: string;
  season: number;
  seed: string;
  generationEnabled: boolean;
  preseason?: boolean;
  preseasonStartDate?: string;
  firstFixtureDate?: string;
  seasonFinalDate?: string;
  squadPlayers: Array<{ player: Player; teamId: string }>;
  modifiers?: InjurySystemModifiers;
}

export function processBackgroundInjuries(
  initialState: InjurySystemState,
  input: ProcessBackgroundInjuriesInput,
): { state: InjurySystemState; result: InjuryProcessingResult } {
  const reconciled = reconcileInjuryRecoveries(initialState, input.date);
  const dateKey = `${input.season}:${input.date}`;
  if (!input.generationEnabled) {
    return { state: reconciled.state, result: { created: [], worsened: [], recovered: reconciled.recovered } };
  }
  const modifiers = input.modifiers ?? DEFAULT_INJURY_SYSTEM_MODIFIERS;
  const activeInjuries = { ...reconciled.state.activeInjuries };
  const created: PlayerInjury[] = [];
  const processedKeys = [...reconciled.state.processedInjuryDateKeys];
  const legacyPreseasonBatchKey = `${input.season}:preseason-season-ending`;
  if (
    input.preseason
    && input.preseasonStartDate
    && input.firstFixtureDate
    && !processedKeys.includes(legacyPreseasonBatchKey)
  ) {
    const targetRange = PRESEASON_SEASON_ENDING_INJURY_MAX - PRESEASON_SEASON_ENDING_INJURY_MIN + 1;
    const targetCount = PRESEASON_SEASON_ENDING_INJURY_MIN
      + Math.floor(injuryRandom(`${input.seed}:${input.season}:preseason-major-count`) * targetRange);
    const windowStart = addInjuryDays(input.preseasonStartDate, 1);
    const preferredWindowEnd = addInjuryDays(input.firstFixtureDate, -3);
    const windowEnd = preferredWindowEnd >= windowStart ? preferredWindowEnd : input.firstFixtureDate;
    const windowDays = Math.max(
      1,
      Math.round((Date.parse(`${windowEnd}T00:00:00Z`) - Date.parse(`${windowStart}T00:00:00Z`)) / 86_400_000) + 1,
    );

    for (let index = 0; index < targetCount; index += 1) {
      const eventKey = `${input.season}:preseason-season-ending:${index}`;
      if (processedKeys.includes(eventKey)) continue;
      const segmentStart = Math.floor(index * windowDays / targetCount);
      const segmentEndExclusive = Math.max(segmentStart + 1, Math.floor((index + 1) * windowDays / targetCount));
      const segmentLength = segmentEndExclusive - segmentStart;
      const randomOffset = Math.floor(
        injuryRandom(`${input.seed}:${input.season}:preseason-date:${index}`) * segmentLength,
      );
      const scheduledDate = addInjuryDays(windowStart, segmentStart + randomOffset);
      if (scheduledDate > input.date) continue;

      const seasonEndingDefinitions = INJURY_CATALOGUE.filter((definition) => (
        definition.seasonEnding
        && (!input.seasonFinalDate || addInjuryDays(scheduledDate, definition.minimumRecoveryDays) > input.seasonFinalDate)
      ));
      const eligible = input.squadPlayers
        .filter(({ player }) => !activeInjuries[player.id])
        .sort((left, right) => (
          injuryRandom(`${input.seed}:${input.season}:preseason-player:${index}:${left.player.id}`)
          - injuryRandom(`${input.seed}:${input.season}:preseason-player:${index}:${right.player.id}`)
        ));
      const selected = eligible[0];
      const definitionIndex = Math.floor(
        injuryRandom(`${input.seed}:${input.season}:preseason-condition:${index}`)
        * seasonEndingDefinitions.length,
      );
      const definition = seasonEndingDefinitions[definitionIndex];
      if (!definition || !selected) {
        processedKeys.push(eventKey);
        continue;
      }
      const injury = createPlayerInjury({
        player: selected.player,
        teamId: selected.teamId,
        season: input.season,
        date: scheduledDate,
        source: "background",
        seed: `${input.seed}:${input.season}:${selected.player.id}:preseason-season-ending:${index}`,
        category: "major",
        conditionId: definition.id,
        modifiers,
      });
      activeInjuries[selected.player.id] = injury;
      created.push(injury);
      processedKeys.push(eventKey);
    }
  }

  if (!processedKeys.includes(dateKey)) {
    input.squadPlayers.forEach(({ player, teamId }) => {
      if (activeInjuries[player.id]) return;
      const occurs = injuryRandom(`${input.seed}:${dateKey}:${player.id}:background`)
        < DAILY_BACKGROUND_INJURY_CHANCE * modifiers.occurrenceChanceMultiplier;
      if (!occurs) return;
      // The dedicated preseason batch supplies exactly 1-2 major cases.
      // Other background conditions before the first fixture remain minor.
      const category: InjuryCategory = input.preseason
        ? "minor"
        : injuryRandom(`${input.seed}:${dateKey}:${player.id}:background-category`)
            < BACKGROUND_MAJOR_INJURY_SHARE
          ? "major"
          : "minor";
      const injury = createPlayerInjury({
        player,
        teamId,
        season: input.season,
        date: input.date,
        source: "background",
        seed: `${input.seed}:${dateKey}:${player.id}:background-injury`,
        category,
        modifiers,
      });
      activeInjuries[player.id] = injury;
      created.push(injury);
    });
    processedKeys.push(dateKey);
  }
  return {
    state: {
      ...reconciled.state,
      activeInjuries,
      processedInjuryDateKeys: processedKeys,
    },
    result: { created, worsened: [], recovered: reconciled.recovered },
  };
}

export function isPlayerMajorInjured(
  activeInjuries: Record<string, PlayerInjury>,
  playerId: string,
): boolean {
  return activeInjuries[playerId]?.category === "major";
}

export function getPlayerMinorInjury(
  activeInjuries: Record<string, PlayerInjury>,
  playerId: string,
): PlayerInjury | null {
  const injury = activeInjuries[playerId];
  return injury?.category === "minor" ? injury : null;
}

export function getInjuryReturnLabel(injury: PlayerInjury, seasonFinalDate?: string): string {
  if (seasonFinalDate && injury.actualReturnDate > seasonFinalDate) {
    return "Will return after the season concludes";
  }
  const format = (dateKey: string) => new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  if (injury.estimatedReturnEarliest === injury.estimatedReturnLatest) {
    return `Expected ${format(injury.estimatedReturnEarliest)}`;
  }
  return `Expected ${format(injury.estimatedReturnEarliest)} – ${format(injury.estimatedReturnLatest)}`;
}
