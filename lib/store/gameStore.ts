"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { gameStateStorage } from "@/lib/storage/gameStateStorage";
import { v4 as uuidv4 } from "uuid";
import {
  GameState,
  Player,
  Team,
  AuctionSet,
  SkipSetSummary,
  SkipSetResultItem,
  BidEntry,
  AuctionTargetPriority,
  AuctionType,
  TradeOffer,
  TradeRecord,
} from "@/lib/types";
import { calculateBasePrice, fetchPlayersFromSupabase } from "@/lib/supabase/fetchPlayers";
import { fetchTeamsFromSupabase } from "@/lib/supabase/fetchTeams";
import type { ClubFigureTier, ClubFigureTierOverrides } from "@/lib/data/clubFigures";
import type { LeagueHistorySeason } from "@/lib/data/leagueHistory";
import { HISTORICAL_LEAGUE_HISTORY } from "@/lib/data/leagueHistory";
import {
  OTHER_LEAGUE_RECORDS,
  RETIRED_MAJOR_RECORDS,
  qualifiesForBattingAverageRecord,
  type OtherLeagueRecord,
} from "@/lib/data/leagueRecords";
import {
  createDefaultHomeBoundaryDimensions,
  createDefaultHomePitchSelections,
  getHomeStadium,
  isPitchRegisteredForTeam,
  normalizeHomeBoundaryDimensions,
  normalizeHomePitchSelections,
  type BoundaryDimensions,
  type HomeBoundaryDimensions,
  type HomePitchSelections,
  type IplTeamId,
} from "@/lib/data/pitchCurator";
import { getSeasonAccessStorageKey } from "@/lib/config/featureFlags";
import { addDaysToDateKey } from "@/lib/logic/careerCalendar";
import {
  deriveCustomPitch,
  isCustomCuratorPitch,
  MAX_PITCHES_PER_STADIUM,
  PITCH_DESTRUCTION_DAYS,
  type CustomCuratorPitch,
  type PitchProject,
  type PitchSliderSettings,
  type PitchSoil,
} from "@/lib/logic/pitchCreator";
import {
  calculateOutfieldPreparationTiming,
  createDefaultHomeOutfieldSettings,
  normalizeBoundaryPreset,
  normalizeHomeOutfieldSettings,
  normalizeOutfieldPreparationProject,
  normalizeOutfieldSettings,
  type BoundaryPreset,
  type HomeOutfieldSettings,
  type OutfieldPreparationProject,
  type OutfieldSettings,
} from "@/lib/logic/stadiumManagement";
import {
  getPlayerSeasonHistory,
  mergePlayerIplHistory,
  upsertPlayerIplHistory,
  wasPlayerAcquiredViaRtm,
} from "@/lib/logic/playerHistory";
import {
  buildAuctionSets,
  getNextBidAmount,
  roundDownToLegalBid,
  canTeamBidOnPlayer,
  canTeamAffordBid,
  TOTAL_PURSE_LAKHS,
  MAX_AUCTION_TARGETS,
  calculateTotalRetentionCost,
  getPlayerRetentionCost,
  MAX_CAPPED_RETENTIONS,
  MAX_UNCAPPED_RETENTIONS,
  MAX_TOTAL_RETENTIONS,
  CAPPED_RETENTION_COSTS,
  UNCAPPED_RETENTION_COST,
  findRTMEligibleTeam,
} from "@/lib/logic/auctionRules";
import {
  buildInitialTeamPurses,
  processBid,
  canAIBidAtAmount,
  pickBiddingTeam,
  nextAIBidDelay,
  resetLotCache,
  resetAuctionQuirks,
  getCachedValuation,
  decideAIRetentions,
  AuctionContext,
  getLotValuation,
  ratingOf,
  isKeeper,
  computePlayerFit,
  getTeamPlan,
  getSquadComp,
  getQuirks,
  isPriorityAuctionSale,
  youngProspectAuctionStrength,
} from "@/lib/logic/auctionEngine";
import {
  applyMatchToIplCareerStats,
  applyMatchToT20CareerStats,
  type IplCareerMatchUpdate,
} from "@/lib/logic/iplCareerStats";
import {
  processBackgroundInjuries as resolveBackgroundInjuries,
  processMatchInjuries as resolveMatchInjuries,
  reconcileInjuryRecoveries,
  type InjuryProcessingResult,
  type InjurySystemState,
  type MatchInjuryParticipant,
  type PlayerInjury,
} from "@/lib/logic/injuries";
import {
  MAX_INJURY_REPLACEMENTS_PER_TEAM,
  eligibleInjuryReplacementCandidates,
  injuryQualifiesForReplacement,
  replacementForInjury,
  scoreInjuryReplacementCandidate,
  teamReplacementCount,
  type InjuryReplacementRecord,
} from "@/lib/logic/injuryReplacements";
import {
  calculateTeamTradeValue,
  calculateTradePackageValue,
  getTeamTradeWillingness,
  isTradeBalanced,
  isTradeWindowOpen,
  getTradeSalaryBand,
  isLegalTradeSalary,
  MINI_TRADE_OVERDRAFT_LAKHS,
  tradeRecordForOffer,
} from "@/lib/logic/tradeEngine";
import {
  createHistoricalPlayerSnapshot,
  initializeCareerPlayers,
  normalizeCareerSeasonPerformance,
  prepareRetentionPlayerPool,
  processPostAuctionCareer,
  processPostSeasonCareer,
  type CareerLifecycleResult,
  type CareerRetirementRecord,
  type HistoricalPlayerSnapshot,
} from "@/lib/logic/careerLifecycle";
import {
  MINI_AUCTION_PURSE_LAKHS,
  calculateMiniAuctionKeptSalary,
  enforceMiniAuctionRetentionLimits,
  getMiniAuctionContractPrice,
  selectAIMiniAuctionKeeps,
  validateMiniAuctionRetentions,
} from "@/lib/logic/miniAuctionRetention";
import { getAuctionTypeForSeason } from "@/lib/logic/auctionCycle";
import {
  applyAuctionMarketRatings,
  getAuctionBowlingRating,
  createAuctionMarketProfile,
  getAuctionRating,
  getRawAuctionRating,
  isPlayerAuctionEligible,
  normalizeAuctionMarketProfile,
  type AuctionMarketProfile,
} from "@/lib/logic/auctionMarket";
import { rankEmergingPlayerCandidates } from "@/lib/logic/seasonAwards";

export const INITIAL_ACTIVE_SEASON = 2027;

export function getSeasonDates(activeSeason: number) {
  const offseasonYear = activeSeason - 1;
  if (activeSeason === INITIAL_ACTIVE_SEASON) {
    return {
      retentionDate: `${offseasonYear}-11-15`,
      auctionDate: `${offseasonYear}-12-15`
    };
  }
  
  // Pseudo-random day between 10 and 20 for November
  const seed1 = Math.abs(Math.sin(offseasonYear * 1000));
  const retentionDay = 10 + Math.floor(seed1 * 11); // 10 to 20
  
  // Pseudo-random day between 10 and 28 for December
  const seed2 = Math.abs(Math.sin(offseasonYear * 2000));
  let auctionDay = 10 + Math.floor(seed2 * 19); // 10 to 28
  if (auctionDay === 25) {
    auctionDay = 24; // Never on the 25th
  }
  
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    retentionDate: `${offseasonYear}-11-${pad(retentionDay)}`,
    auctionDate: `${offseasonYear}-12-${pad(auctionDay)}`
  };
}

export function getActiveSeasonYear(): string {
  return String(useGameStore.getState().currentSeason);
}

// ---------------------------------------------------------------------------
// Store actions interface
// ---------------------------------------------------------------------------
interface GameStateAdditions {
  isPaused: boolean;
  speed: number;
  skipSetSummary: SkipSetSummary | null;
  auctionTargets: Record<string, number>;
  auctionTargetPriorities: Record<string, AuctionTargetPriority>;
  acceleratedPlanningState: 'nominating' | 'results' | null;
  userAcceleratedTargets: string[];
  aiAcceleratedTargets: Record<string, string[]>;
  aiAcceleratedBackups: Record<string, string[]>;
  clubFigureTierOverrides: ClubFigureTierOverrides;
  simulatedLeagueHistory: LeagueHistorySeason[];
  lastRolledOverSeason: number | null;
  careerSeasonArchives: Array<{
    season: number;
    fixtures: unknown[];
    standings: unknown[];
    playerStats: Record<string, unknown>;
    leagueRecords?: OtherLeagueRecord[];
  }>;
  careerIplProcessedMatchKeys: string[];
  careerT20ProcessedMatchKeys: string[];
  careerIplTrackingSeason: number | null;
  careerFastForwardTargetDate: string | null;
  homePitchSelections: HomePitchSelections;
  homeBoundaryDimensions: HomeBoundaryDimensions;
  boundaryPresetsByTeam: Partial<Record<IplTeamId, BoundaryPreset[]>>;
  homeOutfieldSettings: HomeOutfieldSettings;
  outfieldProjectsByTeam: Partial<Record<IplTeamId, OutfieldPreparationProject>>;
  customPitchesByTeam: Partial<Record<IplTeamId, CustomCuratorPitch[]>>;
  pitchProjectsByTeam: Partial<Record<IplTeamId, PitchProject>>;
  activeInjuries: Record<string, PlayerInjury>;
  injuryHistory: PlayerInjury[];
  processedInjuryMatchIds: string[];
  processedInjuryDateKeys: string[];
  injuryReplacementRecords: InjuryReplacementRecord[];
  tradeRecords: TradeRecord[];
  tradeOffers: TradeOffer[];
  processedAITradeDateKeys: string[];
  auctionMarketProfile: AuctionMarketProfile | null;
  retiredPlayerSnapshots: Record<string, HistoricalPlayerSnapshot>;
  lastCareerPostseasonSeason: number | null;
  lastCareerAgedSeason: number | null;
  lastCareerAuctionProcessedSeason: number | null;
  pendingRetirementIntake: number;
  lastCareerRetirements: CareerRetirementRecord[];
  careerRetirementHistory: CareerRetirementRecord[];
  lastCareerGeneratedPlayerIds: string[];
}

interface GameActions {
  initNewGame: (userTeamId: string) => Promise<void>;
  refreshPlayersFromSupabase: () => Promise<void>;
  retainPlayer: (playerId: string) => void;
  releaseRetention: (playerId: string) => void;
  confirmRetentions: () => void;
  autoRetainPlayers: () => void;
  startAuction: () => void;
  placeBid: (teamId: string, amount: number) => void;
  passBid: () => void;
  // RTM actions — user as original team (offer phase)
  exerciseRtm: () => void;
  declineRtm: () => void;
  // RTM actions — user as winner team (winner_counter phase)
  raiseCounter: (amount: number) => void;
  passCounter: () => void;
  // RTM actions — user as original team (original_match phase)
  matchCounter: () => void;
  foldToCounter: () => void;
  tickTimer: () => void;
  tickRTMTimer: () => void;
  dismissSoldFlash: () => void;
  resetGame: () => void;
  setPaused: (paused: boolean) => void;
  togglePaused: () => void;
  setUserTeam: (teamId: string) => void;
  increaseSpeed: () => void;
  decreaseSpeed: () => void;
  skipCurrentSet: () => void;
  skipAllAuction: () => void;
  skipToAcceleratedAuction: () => void;
  dismissSkipSetSummary: () => void;
  setAuctionTarget: (playerId: string, maxBidLakhs: number, priority?: AuctionTargetPriority) => void;
  removeAuctionTarget: (playerId: string) => void;
  confirmUserAcceleratedTargets: (targets: string[]) => void;
  startAcceleratedAuctionFromPlanning: () => void;
  setClubFigureTierOverride: (figureId: string, tier: ClubFigureTier) => void;
  recordSimulatedLeagueSeason: (season: LeagueHistorySeason) => void;
  recordIplMatchStats: (updates: IplCareerMatchUpdate[]) => number;
  beginNextSeasonRetention: (
    captainIdsByTeam?: Record<string, string | null | undefined>,
    auctionType?: AuctionType,
  ) => boolean;
  archiveCareerSeason: (archive: {
    season: number;
    fixtures: unknown[];
    standings: unknown[];
    playerStats: Record<string, unknown>;
    leagueRecords?: OtherLeagueRecord[];
  }) => void;
  setCareerFastForwardTarget: (targetDate: string | null) => void;
  completeOffseasonAutomatically: () => boolean;
  setHomePitchSelection: (teamId: string, pitchId: string) => void;
  setHomeBoundaryDimensions: (
    teamId: string,
    dimensions: Partial<BoundaryDimensions>,
  ) => void;
  saveBoundaryPreset: (
    teamId: string,
    name: string,
    dimensions: BoundaryDimensions,
  ) => string | null;
  applyBoundaryPreset: (teamId: string, presetId: string) => boolean;
  deleteBoundaryPreset: (teamId: string, presetId: string) => boolean;
  startOutfieldPreparation: (teamId: string, target: OutfieldSettings) => boolean;
  reconcileOutfieldProjects: () => void;
  startPitchCreation: (
    teamId: string,
    soil: PitchSoil,
    sliders: PitchSliderSettings,
  ) => boolean;
  startPitchDestruction: (teamId: string, pitchId: string) => boolean;
  reconcilePitchProjects: () => void;
  processMatchInjuries: (input: {
    matchId: string;
    date: string;
    season: number;
    seed: string;
    teamIds: [string, string];
    participants: MatchInjuryParticipant[];
  }) => InjuryProcessingResult;
  processBackgroundInjuries: (input: {
    date: string;
    season: number;
    seed: string;
    generationEnabled: boolean;
    preseason?: boolean;
    preseasonStartDate?: string;
    firstFixtureDate?: string;
    seasonFinalDate?: string;
  }) => InjuryProcessingResult;
  reconcileInjuries: (date: string) => PlayerInjury[];
  signInjuryReplacement: (input: {
    injuryId: string;
    replacementPlayerId: string;
    date: string;
    seasonFinalDate?: string;
    teamFinalLeagueDate?: string;
  }) => boolean;
  processAIInjuryReplacements: (input: {
    date: string;
    seasonFinalDate?: string;
    teamFinalLeagueDates: Record<string, string | undefined>;
  }) => InjuryReplacementRecord[];
  processCompletedAuctionCareer: () => CareerRetirementRecord[];
  executeTrade: (input: {
    proposerTeamId: string;
    recipientTeamId: string;
    offeredPlayerIds: string[];
    requestedPlayerIds: string[];
    salaries: Record<string, number>;
    date: string;
    finalDate?: string;
    auctionType?: AuctionType;
    explanation?: string;
    validateOnly?: boolean;
  }) => boolean;
  processAITrades: (input: { date: string; finalDate?: string; standingsTeamIds: string[] }) => TradeRecord[];
}

// ---------------------------------------------------------------------------
// Full store type
// ---------------------------------------------------------------------------
type Store = GameState & GameStateAdditions & GameActions;

function withAdaptiveBasePrices(players: Record<string, Player>): Record<string, Player> {
  return Object.fromEntries(Object.entries(players).map(([id, player]) => [id, {
    ...player,
    basePrice: calculateBasePrice(
      player.isCapped,
      player.nationality,
      getAuctionRating(player),
      player.reputation ?? 5,
    ),
  }]));
}

function appendHistoricalRetirees(
  existing: Record<string, HistoricalPlayerSnapshot>,
  lifecycle: CareerLifecycleResult,
  referencedPlayerIds: Set<string> = new Set(),
): Record<string, HistoricalPlayerSnapshot> {
  if (lifecycle.retirements.length === 0) return existing;
  const records = new Map(lifecycle.retirements.map((record) => [record.playerId, record]));
  const output = { ...existing };
  lifecycle.retiredPlayers.forEach((player) => {
    const record = records.get(player.id);
    // Every retiree needs a snapshot while retirement coverage is active.
    // Filtering this to major players caused lower-appearance careers to lose
    // their real IPL totals and be misreported as zero-match retirements.
    if (!record) return;
    output[player.id] = createHistoricalPlayerSnapshot(player, record);
  });
  return output;
}

function getRetiredPlayerIds(state: Pick<Store, "careerRetirementHistory" | "lastCareerRetirements" | "retiredPlayerSnapshots">): Set<string> {
  return new Set([
    ...state.careerRetirementHistory.map((record) => record.playerId),
    ...state.lastCareerRetirements.map((record) => record.playerId),
    ...Object.keys(state.retiredPlayerSnapshots),
  ]);
}

const normalizeRecordPlayerName = (name: string) => name
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("en-GB")
  .replace(/[^a-z0-9]/g, "");

function getReferencedRecordPlayerIds(
  players: Record<string, Player>,
  archives: Array<{ leagueRecords?: OtherLeagueRecord[] }>,
): Set<string> {
  const referencedNames = new Set(
    [OTHER_LEAGUE_RECORDS, ...archives.map((archive) => archive.leagueRecords ?? [])]
      .flat()
      .flatMap((record) => [...(record.playerNames ?? []), record.holder])
      .map(normalizeRecordPlayerName),
  );
  return new Set(Object.values(players)
    .filter((player) => referencedNames.has(normalizeRecordPlayerName(player.name)))
    .map((player) => player.id));
}

function getMajorRecordPlayerIds(
  players: Player[],
  existing: Record<string, HistoricalPlayerSnapshot>,
): Set<string> {
  const dynamicPlayers = [
    ...players.map((player) => ({ id: player.id, name: player.name, iplStats: player.iplStats })),
    ...Object.values(existing).map((player) => ({ id: player.id, name: player.name, iplStats: player.iplStats })),
  ];
  const resolvedNames = new Set(dynamicPlayers.map((player) => normalizeRecordPlayerName(player.name)));
  const protectedIds = new Set<string>();
  const categories = [
    {
      id: "appearances" as const,
      value: (player: (typeof dynamicPlayers)[number]) => player.iplStats.matches,
      qualifies: () => true,
    },
    {
      id: "runs" as const,
      value: (player: (typeof dynamicPlayers)[number]) => player.iplStats.runs,
      qualifies: (player: (typeof dynamicPlayers)[number]) => player.iplStats.runs > 0,
    },
    {
      id: "wickets" as const,
      value: (player: (typeof dynamicPlayers)[number]) => player.iplStats.wickets,
      qualifies: (player: (typeof dynamicPlayers)[number]) => player.iplStats.wickets > 0,
    },
    {
      id: "batting-average" as const,
      value: (player: (typeof dynamicPlayers)[number]) => player.iplStats.battingAverage,
      qualifies: (player: (typeof dynamicPlayers)[number]) => qualifiesForBattingAverageRecord(player.iplStats),
    },
  ];

  categories.forEach((category) => {
    const dynamicEntries = dynamicPlayers
      .filter(category.qualifies)
      .map((player) => ({ id: player.id, value: category.value(player) }));
    const staticEntries = RETIRED_MAJOR_RECORDS[category.id]
      .filter((entry) => !resolvedNames.has(normalizeRecordPlayerName(entry.name)))
      .filter((entry) => category.id !== "batting-average" || qualifiesForBattingAverageRecord({
        matches: entry.matches ?? 0,
        runs: entry.runs ?? 0,
        battingAverage: entry.value,
      }))
      .map((entry) => ({ id: null, value: entry.value }));
    [...dynamicEntries, ...staticEntries]
      .sort((left, right) => right.value - left.value)
      .slice(0, 5)
      .forEach((entry) => {
        if (entry.id) protectedIds.add(entry.id);
      });
  });

  return protectedIds;
}

function withoutRetiredInjuries(
  injuries: Record<string, PlayerInjury>,
  retiredIds: Set<string>,
): Record<string, PlayerInjury> {
  return Object.fromEntries(Object.entries(injuries).filter(([playerId]) => !retiredIds.has(playerId)));
}

function withoutRetiredInjuryHistory(
  injuries: PlayerInjury[],
  retiredIds: Set<string>,
): PlayerInjury[] {
  return injuries.filter((injury) => !retiredIds.has(injury.playerId));
}

function applyInjuryReplacementSigning(input: {
  injury: PlayerInjury;
  replacementPlayerId: string;
  date: string;
  season: number;
  seasonFinalDate?: string;
  teamFinalLeagueDate?: string;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  activeInjuries: Record<string, PlayerInjury>;
  records: InjuryReplacementRecord[];
  unsoldPlayerIds: readonly string[];
}): { players: Record<string, Player>; teams: Record<string, Team>; records: InjuryReplacementRecord[]; record: InjuryReplacementRecord } | null {
  const team = input.teams[input.injury.teamId];
  if (!team || replacementForInjury(input.records, input.injury.id)) return null;
  if (!injuryQualifiesForReplacement(input.injury, {
    date: input.date,
    season: input.season,
    seasonFinalDate: input.seasonFinalDate,
    teamFinalLeagueDate: input.teamFinalLeagueDate,
  })) return null;
  if (teamReplacementCount(input.records, team.id, input.season) >= MAX_INJURY_REPLACEMENTS_PER_TEAM) return null;
  const eligible = eligibleInjuryReplacementCandidates({
    injury: input.injury,
    players: input.players,
    unsoldPlayerIds: input.unsoldPlayerIds,
    records: input.records,
    season: input.season,
  });
  const replacement = eligible.find((candidate) => candidate.id === input.replacementPlayerId);
  if (!replacement) return null;
  const availableSquad = team.squad.filter((playerId) => !input.activeInjuries[playerId]);
  if (availableSquad.length >= (team.maxSquadSize ?? 25)) return null;
  const activeOverseas = availableSquad.filter(
    (playerId) => input.players[playerId]?.nationality === "Overseas",
  ).length;
  if (replacement.nationality === "Overseas" && activeOverseas >= (team.overseasPlayersMax ?? 8)) return null;

  const record: InjuryReplacementRecord = {
    id: `injury-replacement:${input.season}:${input.injury.id}:${replacement.id}`,
    season: input.season,
    teamId: team.id,
    injuryId: input.injury.id,
    injuredPlayerId: input.injury.playerId,
    injuredPlayerName: input.injury.playerName,
    replacementPlayerId: replacement.id,
    replacementPlayerName: replacement.name,
    signedOn: input.date,
    salary: replacement.basePrice,
  };
  const updatedReplacement: Player = {
    ...replacement,
    currentTeamId: team.id,
    isRetained: false,
    retainedByTeamId: null,
    iplHistory: upsertPlayerIplHistory(replacement.iplHistory, {
      teamId: team.id,
      season: String(input.season),
      price: replacement.basePrice,
      isInjuryReplacement: true,
      replacedPlayerId: input.injury.playerId,
      replacementInjuryId: input.injury.id,
    }),
  };
  const nextSquad = Array.from(new Set([...team.squad, replacement.id]));
  const nextPlayers = { ...input.players, [replacement.id]: updatedReplacement };
  const nextActiveOverseas = nextSquad.filter(
    (playerId) => !input.activeInjuries[playerId] && nextPlayers[playerId]?.nationality === "Overseas",
  ).length;
  return {
    players: nextPlayers,
    teams: {
      ...input.teams,
      [team.id]: {
        ...team,
        squad: nextSquad,
        overseasPlayersCurrent: nextActiveOverseas,
      },
    },
    records: [...input.records, record],
    record,
  };
}

function getAdditionalHomePitchIds(
  customPitchesByTeam: Partial<Record<IplTeamId, CustomCuratorPitch[]>>,
) {
  return Object.fromEntries(
    Object.entries(customPitchesByTeam).map(([teamId, pitches]) => [
      teamId,
      (pitches ?? []).map((pitch) => pitch.id),
    ]),
  ) as Partial<Record<IplTeamId, string[]>>;
}

function normalizeCustomPitches(
  value: unknown,
): Partial<Record<IplTeamId, CustomCuratorPitch[]>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const supplied = value as Record<string, unknown>;
  const normalized: Partial<Record<IplTeamId, CustomCuratorPitch[]>> = {};

  Object.keys(supplied).forEach((teamId) => {
    const stadium = getHomeStadium(teamId);
    const pitches = supplied[teamId];
    if (!stadium || !Array.isArray(pitches)) return;
    const capacity = Math.max(0, MAX_PITCHES_PER_STADIUM - stadium.pitches.length);
    const seen = new Set<string>();
    const valid = pitches.filter((pitch): pitch is CustomCuratorPitch => {
      if (
        !pitch
        || typeof pitch !== "object"
        || !isCustomCuratorPitch(pitch as CustomCuratorPitch)
      ) return false;
      const candidate = pitch as CustomCuratorPitch;
      if (
        candidate.teamId !== teamId
        || typeof candidate.id !== "string"
        || !candidate.id
        || seen.has(candidate.id)
      ) return false;
      seen.add(candidate.id);
      return true;
    }).slice(0, capacity);
    if (valid.length > 0) normalized[stadium.teamId] = valid;
  });

  return normalized;
}

function normalizePitchProjects(
  value: unknown,
): Partial<Record<IplTeamId, PitchProject>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const supplied = value as Record<string, unknown>;
  const normalized: Partial<Record<IplTeamId, PitchProject>> = {};

  Object.entries(supplied).forEach(([teamId, project]) => {
    const stadium = getHomeStadium(teamId);
    if (!stadium || !project || typeof project !== "object") return;
    const candidate = project as Partial<PitchProject>;
    if (
      candidate.teamId !== teamId
      || (candidate.kind !== "create" && candidate.kind !== "destroy")
      || typeof candidate.id !== "string"
      || typeof candidate.startedOn !== "string"
      || typeof candidate.completesOn !== "string"
    ) return;
    if (
      candidate.kind === "create"
      && candidate.pitch
      && isCustomCuratorPitch(candidate.pitch)
      && candidate.pitch.teamId === teamId
    ) {
      normalized[stadium.teamId] = candidate as PitchProject;
    } else if (
      candidate.kind === "destroy"
      && typeof candidate.pitchId === "string"
      && typeof candidate.pitchName === "string"
    ) {
      normalized[stadium.teamId] = candidate as PitchProject;
    }
  });

  return normalized;
}

function normalizeBoundaryPresetsByTeam(
  value: unknown,
): Partial<Record<IplTeamId, BoundaryPreset[]>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const supplied = value as Record<string, unknown>;
  const normalized: Partial<Record<IplTeamId, BoundaryPreset[]>> = {};

  Object.entries(supplied).forEach(([teamId, presets]) => {
    const stadium = getHomeStadium(teamId);
    if (!stadium || !Array.isArray(presets)) return;
    const seen = new Set<string>();
    const valid = presets.flatMap((preset) => {
      const candidate = normalizeBoundaryPreset(preset, stadium.teamId);
      if (!candidate || seen.has(candidate.id)) return [];
      seen.add(candidate.id);
      return [candidate];
    });
    if (valid.length > 0) normalized[stadium.teamId] = valid;
  });

  return normalized;
}

function normalizeOutfieldProjectsByTeam(
  value: unknown,
): Partial<Record<IplTeamId, OutfieldPreparationProject>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const supplied = value as Record<string, unknown>;
  const normalized: Partial<Record<IplTeamId, OutfieldPreparationProject>> = {};
  Object.entries(supplied).forEach(([teamId, project]) => {
    const stadium = getHomeStadium(teamId);
    if (!stadium) return;
    const candidate = normalizeOutfieldPreparationProject(project, stadium.teamId);
    if (candidate) normalized[stadium.teamId] = candidate;
  });
  return normalized;
}

function pickSoftSquadTarget(): number {
  const roll = Math.random();
  if (roll < 0.20) return 23;
  if (roll < 0.65) return 24;
  return 25;
}

// ---------------------------------------------------------------------------
// Helper: pick next player in sets
// ---------------------------------------------------------------------------
function pickNextLot(sets: AuctionSet[]): { setIndex: number; playerIndex: number } | null {
  for (let si = 0; si < sets.length; si++) {
    const set = sets[si];
    if (!set.isCompleted) {
      const unauctionedCount = set.playerIds.length - set.currentIndex;
      if (unauctionedCount > 0) {
        // Pick a random index from the remaining unauctioned players in this set
        const offset = Math.floor(Math.random() * unauctionedCount);
        const randomIndex = set.currentIndex + offset;

        // Swap randomly selected player into current lot position
        if (randomIndex !== set.currentIndex) {
          const temp = set.playerIds[set.currentIndex];
          set.playerIds[set.currentIndex] = set.playerIds[randomIndex];
          set.playerIds[randomIndex] = temp;
        }

        return { setIndex: si, playerIndex: set.currentIndex };
      }
    }
  }
  return null;
}

function allSetsComplete(sets: AuctionSet[]): boolean {
  return sets.every((s) => s.isCompleted);
}

function getAvailableAuctionPlayerIds(
  players: Record<string, Player>,
  teams: Record<string, Team>,
  resolvedPlayerIds: Iterable<string> = [],
): string[] {
  const contractedPlayerIds = new Set(Object.values(teams).flatMap((team) => team.squad));
  const resolved = new Set(resolvedPlayerIds);
  return Object.values(players)
    .filter((player) => (
      !contractedPlayerIds.has(player.id)
      && !resolved.has(player.id)
      && isPlayerAuctionEligible(player)
    ))
    .map((player) => player.id);
}

function removeResolvedAuctionTargets<T>(
  targets: Record<string, T>,
  resolvedPlayerIds: Iterable<string>
): Record<string, T> {
  const remainingTargets = { ...targets };
  Array.from(resolvedPlayerIds).forEach((playerId) => delete remainingTargets[playerId]);
  return remainingTargets;
}

function getTargetBidBlockReason(
  team: Team,
  player: Player,
  bidAmount: number,
  players: Record<string, Player>,
  boughtEarlierInSkip: boolean,
  protectedTargetReserve = 0
): string | null {
  if (team.remainingPurse - bidAmount < protectedTargetReserve) {
    return "Funds reserved for higher-priority targets";
  }
  if (boughtEarlierInSkip && !canTeamAffordBid(team, bidAmount, players)) {
    return "Insufficient Purse remaining after earlier skipped purchases";
  }

  if (team.squad.length >= team.maxSquadSize) return "Max Squad Size Reached";
  if (player.nationality === "Overseas" && team.overseasPlayersCurrent >= team.overseasPlayersMax) {
    return "Hit Overseas Limit";
  }
  if (team.remainingPurse < bidAmount) return "Insufficient Purse";
  if (!canTeamAffordBid(team, bidAmount, players)) {
    const squad = team.squad.map((id) => players[id]).filter(Boolean);
    const isKeeperPlayer = (p: Player) => !!(p.isWicketkeeper || p.isPartTimeWk || p.role === "WK-Batsman");
    const bowlers = squad.filter((p) => p.role === "Pace Bowler" || p.role === "Spin Bowler").length;
    const spinners = squad.filter((p) => p.role === "Spin Bowler").length;
    const keepers = squad.filter(isKeeperPlayer).length;
    const indianBowlers = squad.filter((p) => p.nationality === "Indian" && (p.role === "Pace Bowler" || p.role === "Spin Bowler")).length;
    const rating = getAuctionRating;
    const indianBatters = squad.filter((p) => p.nationality === "Indian" && (p.role === "Batsman" || p.role === "WK-Batsman"));
    const missingRoles = bowlers < 5 || spinners < 2 || keepers < 2 || indianBowlers < 4 ||
      indianBatters.filter((p) => rating(p) > 74).length < 5 ||
      indianBatters.filter((p) => rating(p) > 77).length < 3;
    return missingRoles ? "Other roles required" : "Insufficient Purse - You need to purchase more players!";
  }
  return null;
}

function canTeamBidDuringSkip(
  t: Team,
  p: Player,
  nextBid: number,
  playerId: string,
  newPlayers: Record<string, Player>,
  ctx: AuctionContext,
  userTeamId: string,
  targetMaxBid?: number,
  protectedTargetReserve = 0,
  isSkipAll = false
): boolean {
  if (t.id === userTeamId) {
    if (isSkipAll) {
      if (t.squad.length >= (t.maxSquadSize ?? 25)) return false;
      const { canBid } = canTeamBidOnPlayer(t, p, newPlayers, false);
      if (!canBid) return false;
      if (!canTeamAffordBid(t, nextBid, newPlayers)) return false;
      if (t.remainingPurse - nextBid < protectedTargetReserve) return false;
      if (targetMaxBid !== undefined) {
        return nextBid <= targetMaxBid;
      } else {
        return canAIBidAtAmount(t, p, nextBid, playerId, newPlayers, ctx);
      }
    } else {
      // Skipping must leave the user with one accelerated-auction squad slot and,
      // once the 18-player minimum is reached, ₹2 Cr. The final ₹50L is a
      // hard floor for every skipped purchase; manual bidding remains untouched.
      if (t.squad.length >= 24) return false;
      if (t.remainingPurse - nextBid < 50) return false;
      if (t.squad.length >= (t.minSquadSize ?? 18) && t.remainingPurse >= 200 && t.remainingPurse - nextBid < 200) return false;
      const { canBid } = canTeamBidOnPlayer(t, p, newPlayers, false);
      if (!canBid) return false;
      if (!canTeamAffordBid(t, nextBid, newPlayers)) return false;
      if (t.remainingPurse - nextBid < protectedTargetReserve) return false;
      if (targetMaxBid !== undefined) return nextBid <= targetMaxBid;

      const squad = t.squad.map(id => newPlayers[id]).filter(Boolean);

    // ---- WICKETKEEPER-OPENER EXCLUSION RULE ----
    const isOpenerWK = isKeeper(p) && (p.isOpener || p.onlyOpensOrBenched);
    if (isOpenerWK) {
      const specialPairs = [
        ["sunil-narine", "finn-allen"],
        ["yashasvi-jaiswal", "vaibhav-suryavanshi"],
        ["travis-head", "abhishek-sharma"],
        ["shubman-gill", "sai-sudharsan"],
        ["prabhsimran-singh", "priyansh-arya"]
      ];
      const hasSpecialPair = specialPairs.some(pair => 
        t.squad.some(id => id.startsWith(pair[0])) && t.squad.some(id => id.startsWith(pair[1]))
      );
      const playerRating = ratingOf(p);
      const openersAboveRating = squad.filter(x => x.isOpener && ratingOf(x) > playerRating).length;

      if (hasSpecialPair || openersAboveRating >= 2) {
        return false;
      }
    }

    if (p.nationality === "Overseas") {
      const overseas = squad.filter(x => x.nationality === "Overseas").length;
      if (overseas >= 8) return false;
    }

    const currentSquadSize = squad.length;
    const minSquad = t.minSquadSize ?? 18;
    if (currentSquadSize >= minSquad) {
      if (currentSquadSize >= t.maxSquadSize) return false;
    } else {
      if (currentSquadSize >= t.maxSquadSize) return false;
    }

    const slotsToMinimum = Math.max(0, minSquad - currentSquadSize);
    const fillerReserve = Math.max(0, slotsToMinimum - 1) * 30;

    if (currentSquadSize < minSquad) {
      const slotsNeeded = minSquad - currentSquadSize;
      const neededReserve = Math.max((slotsNeeded - 1) * 30, fillerReserve);
      if (t.remainingPurse - nextBid < neededReserve) return false;
    } else {
      // Even if above minSquad, retain the normal affordability checks.
      if (t.remainingPurse - nextBid < fillerReserve) return false;

      // Lower cushion from 200 Lakhs to 50 Lakhs to prevent bidding lockouts for cheap backups
      if (t.remainingPurse >= 50 && nextBid >= 50) {
        if (t.remainingPurse - nextBid < 50) return false;
      }
      if (t.remainingPurse - nextBid < 0) return false;
    }

    const valuation = getLotValuation(playerId, t, p, newPlayers, ctx);
    if (valuation === 0) return false;
    if (nextBid > valuation) return false;

    return true;
    }
  } else {
    return canAIBidAtAmount(t, p, nextBid, playerId, newPlayers, ctx);
  }
}

function getProtectedTargetReserve(
  currentPlayerId: string,
  pendingTargetIds: Set<string>,
  targets: Record<string, number>,
  priorities: Record<string, AuctionTargetPriority>,
  team: Team,
  players: Record<string, Player>
): number {
  const rank: Record<AuctionTargetPriority, number> = { low: 0, medium: 1, high: 2 };
  const currentPriority = priorities[currentPlayerId] ?? "medium";
  return Array.from(pendingTargetIds).reduce((reserve, playerId) => {
    const priority = priorities[playerId] ?? "medium";
    if (rank[priority] <= rank[currentPriority]) return reserve;
    const player = players[playerId];
    if (!player) return reserve;
    if (!canTeamBidOnPlayer(team, player, players, false).canBid) return reserve;
    if (!canTeamAffordBid(team, player.basePrice, players)) return reserve;
    return reserve + (targets[playerId] ?? 0);
  }, 0);
}

function canAffordTargetRtm(
  team: Team,
  amount: number,
  players: Record<string, Player>,
  isUserTeam: boolean,
  priority: AuctionTargetPriority,
  protectedReserve: number
): boolean {
  if (!canTeamAffordBid(team, amount, players)) return false;
  if (isUserTeam && team.remainingPurse - amount < 50) return false;
  return !isUserTeam || priority === "high" || team.remainingPurse - amount >= protectedReserve;
}

function getAIAcceleratedNominationsAndBackups(
  team: Team,
  unsoldPlayerIds: string[],
  allPlayers: Record<string, Player>,
  auction: any
): { targets: string[]; backups: string[] } {
  const quirks = getQuirks(team);
  const squad = team.squad.map(id => allPlayers[id]).filter(Boolean);
  const comp = getSquadComp(squad);
  const plan = getTeamPlan(team, allPlayers);
  
  // Calculate remaining open squad spaces (max 25 players)
  const slotsLeft = Math.max(0, 25 - squad.length);
  if (slotsLeft <= 0) return { targets: [], backups: [] };

  const ctx: AuctionContext = {
    remainingPlayerIds: unsoldPlayerIds,
    soldPlayerIds: auction.soldPlayerIds ?? [],
    currentLotIndex: auction.currentLotIndex,
    totalLots: auction.allPlayerIds.length,
    isAcceleratedPhase: true,
    auctionType: auction.type,
  };

  const scored = unsoldPlayerIds
    .map(id => {
      const p = allPlayers[id];
      if (!p) return null;

      // 1. Fit Squad Rules: Check if this player can legally be bid on (overseas cap, role limit, squad full)
      const { canBid } = canTeamBidOnPlayer(team, p, allPlayers);
      if (!canBid) return null;

      // 2. Budget / Affordability: Check if they can afford this player at base price and have enough reserved for other slots
      if (!canTeamAffordBid(team, p.basePrice, allPlayers)) return null;
      if (team.remainingPurse < p.basePrice) return null;

      // 3. Keepers/Bowler constraints check
      if (p.nationality === "Overseas" && comp.overseas >= 8) return null;

      // 4. Valuation check: Does the team actually value this player at least at base price?
      const valuation = getLotValuation(p.id, team, p, allPlayers, ctx);
      if (valuation < p.basePrice) return null;

      // 5. Fit check: Fit score must be positive
      const fit = computePlayerFit(p, team, comp, quirks);
      if (fit <= 0 && !isPriorityAuctionSale(p)) return null;

      const rating = ratingOf(p);
      const isKeeperPriority = isKeeper(p) && (comp.keepers ?? 0) < 2;
      const isBowlerPriority = (p.role === "Pace Bowler" || p.role === "Spin Bowler") && rating >= 75;
      
      let score = fit * rating;
      if (isKeeperPriority) score += 50;
      if (isBowlerPriority) score += 30;
      score += youngProspectAuctionStrength(p) * (auction.type === "mini" ? 80 : 45);
      // Add extra weight based on how much the team values the player relative to base price
      score += (valuation / p.basePrice) * 10;

      return { id, score, fit };
    })
    .filter((x): x is { id: string; score: number; fit: number } => x !== null);

  scored.sort((a, b) => b.score - a.score);

  // Nominate the best options, capped by available slots and max of 5 nominations
  const nomCount = Math.min(5, slotsLeft);
  const targets = scored.slice(0, nomCount).map(x => x.id);
  const backups = scored.slice(nomCount, nomCount * 2).map(x => x.id);
  return { targets, backups };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useGameStore = create<Store>()(
  persist(
    (set, get) => ({
      // ----- State -----
      saveId: "",
      saveCreatedAt: "",
      fixtureSeed: "",
      currentDate: "2026-11-15",
      currentSeason: INITIAL_ACTIVE_SEASON,
      auctionCycle: 1,
      players: {},
      teams: {},
      userTeamId: "",
      auction: null,
      isSetupComplete: false,
      isPaused: false,
      speed: 1,
      skipSetSummary: null,
      auctionTargets: {},
      auctionTargetPriorities: {},
      acceleratedPlanningState: null,
      userAcceleratedTargets: [],
      aiAcceleratedTargets: {},
      aiAcceleratedBackups: {},
      clubFigureTierOverrides: {},
      simulatedLeagueHistory: [],
      lastRolledOverSeason: null,
      careerSeasonArchives: [],
      careerIplProcessedMatchKeys: [],
      careerT20ProcessedMatchKeys: [],
      careerIplTrackingSeason: null,
      careerFastForwardTargetDate: null,
      homePitchSelections: createDefaultHomePitchSelections(),
      homeBoundaryDimensions: createDefaultHomeBoundaryDimensions(),
      boundaryPresetsByTeam: {},
      homeOutfieldSettings: createDefaultHomeOutfieldSettings(),
      outfieldProjectsByTeam: {},
      customPitchesByTeam: {},
      pitchProjectsByTeam: {},
      activeInjuries: {},
      injuryHistory: [],
      processedInjuryMatchIds: [],
      processedInjuryDateKeys: [],
      injuryReplacementRecords: [],
      tradeRecords: [],
      tradeOffers: [],
      processedAITradeDateKeys: [],
      auctionMarketProfile: null,
      retiredPlayerSnapshots: {},
      lastCareerPostseasonSeason: null,
      lastCareerAgedSeason: null,
      lastCareerAuctionProcessedSeason: null,
      pendingRetirementIntake: 0,
      lastCareerRetirements: [],
      careerRetirementHistory: [],
      lastCareerGeneratedPlayerIds: [],

      // ----- Actions -----
      initNewGame: async (userTeamId) => {
        if (typeof window !== "undefined") {
          localStorage.removeItem(getSeasonAccessStorageKey(userTeamId));
        }
        const [fetchedPlayers, fetchedTeams] = await Promise.all([
          fetchPlayersFromSupabase(),
          fetchTeamsFromSupabase(),
        ]);
        if (fetchedPlayers.length === 0) {
          throw new Error("The player roster did not load. No game state was created.");
        }
        if (fetchedTeams.length === 0 || !fetchedTeams.some((team) => team.id === userTeamId)) {
          throw new Error("The selected IPL team did not load. No game state was created.");
        }
        const validTeamIds = new Set(fetchedTeams.map((team) => team.id));
        const responseHasTeamAssignments = fetchedPlayers.some((player) => (
          Boolean(player.currentTeamId && validTeamIds.has(player.currentTeamId))
        ));
        const startingTeamByPlayer = new Map(fetchedPlayers.map((player) => {
          const historicalTeamId = [...(player.iplHistory ?? [])]
            .filter((entry) => (
              entry.teamId !== "UNSOLD"
              && validTeamIds.has(entry.teamId)
            ))
            .sort((left, right) => Number(right.season) - Number(left.season))[0]?.teamId;
          const currentTeamId = (
            player.currentTeamId
            && validTeamIds.has(player.currentTeamId)
          )
            ? player.currentTeamId
            : null;
          const startingTeamId = responseHasTeamAssignments
            ? currentTeamId
            : historicalTeamId ?? null;
          return [player.id, startingTeamId] as const;
        }));

        let playersMap: Record<string, Player> = {};
        fetchedPlayers.forEach((p: Player) => {
          playersMap[p.id] = { ...p, currentTeamId: null, isRetained: false, retainedByTeamId: null };
        });

        let teamsMap: Record<string, Team> = {};
        fetchedTeams.forEach((t) => {
          const teamPlayers = fetchedPlayers.filter((player) => (
            startingTeamByPlayer.get(player.id) === t.id
          ));
          teamsMap[t.id] = {
            ...t,
            squad: teamPlayers.map((p: Player) => p.id),
            retainedPlayers: [],
            remainingPurse: TOTAL_PURSE_LAKHS,
            spentAmount: 0,
            minSquadSize: 18,
            softSquadTarget: t.id === userTeamId ? 24 : pickSoftSquadTarget(),
          };
        });
        if ((teamsMap[userTeamId]?.squad.length ?? 0) === 0) {
          throw new Error(`No contracted players were loaded for ${userTeamId}. No game state was created.`);
        }

        const newSaveId = uuidv4();
        const initializedPlayers = initializeCareerPlayers(playersMap, INITIAL_ACTIVE_SEASON - 1);
        const auctionMarketProfile = createAuctionMarketProfile(Object.values(initializedPlayers));
        const preparedPool = prepareRetentionPlayerPool({
          players: initializedPlayers,
          teams: teamsMap,
          season: INITIAL_ACTIVE_SEASON,
          seed: newSaveId,
          baselineMarketProfile: auctionMarketProfile,
        });
        const openingAuctionType = getAuctionTypeForSeason(INITIAL_ACTIVE_SEASON);
        const openingTeamByPlayer = new Map(
          Object.values(preparedPool.teams).flatMap((team) => team.squad.map((playerId) => [playerId, team.id] as const)),
        );
        playersMap = withAdaptiveBasePrices(Object.fromEntries(Object.entries(preparedPool.players).map(([id, player]) => {
          const teamId = openingTeamByPlayer.get(id) ?? null;
          return [id, {
            ...player,
            currentTeamId: teamId,
            isRetained: openingAuctionType === "mini" && teamId !== null,
            retainedByTeamId: openingAuctionType === "mini" ? teamId : null,
          }];
        })));
        teamsMap = Object.fromEntries(Object.entries(preparedPool.teams).map(([id, team]) => {
          const retainedPlayers = openingAuctionType === "mini"
            ? enforceMiniAuctionRetentionLimits(
                team,
                team.squad.filter((playerId) => Boolean(playersMap[playerId])),
                playersMap,
                INITIAL_ACTIVE_SEASON,
              )
            : [];
          const spentAmount = openingAuctionType === "mini"
            ? calculateMiniAuctionKeptSalary(retainedPlayers, id, playersMap, INITIAL_ACTIVE_SEASON)
            : 0;
          return [id, {
            ...team,
            retainedPlayers,
            totalPurse: openingAuctionType === "mini" ? MINI_AUCTION_PURSE_LAKHS : TOTAL_PURSE_LAKHS,
            spentAmount,
            remainingPurse: Math.max(0, (openingAuctionType === "mini" ? MINI_AUCTION_PURSE_LAKHS : TOTAL_PURSE_LAKHS) - spentAmount),
            rtmCardsTotal: openingAuctionType === "mini" ? 0 : MAX_TOTAL_RETENTIONS,
          }];
        }));
        if (openingAuctionType === "mini") {
          const retainedIds = new Set(Object.values(teamsMap).flatMap((team) => team.retainedPlayers));
          playersMap = Object.fromEntries(Object.entries(playersMap).map(([id, player]) => [id, {
            ...player,
            isRetained: retainedIds.has(id),
            retainedByTeamId: retainedIds.has(id) ? player.currentTeamId : null,
          }]));
        }
        set({
          saveId: newSaveId,
          saveCreatedAt: new Date().toISOString(),
          fixtureSeed: uuidv4(),
          currentDate: getSeasonDates(INITIAL_ACTIVE_SEASON).retentionDate,
          currentSeason: INITIAL_ACTIVE_SEASON,
          auctionCycle: 1,
          players: playersMap,
          teams: teamsMap,
          userTeamId,
          auctionTargets: {},
          auctionTargetPriorities: {},
          clubFigureTierOverrides: {},
          simulatedLeagueHistory: [],
          lastRolledOverSeason: null,
          careerSeasonArchives: [],
          careerIplProcessedMatchKeys: [],
          careerT20ProcessedMatchKeys: [],
          careerIplTrackingSeason: INITIAL_ACTIVE_SEASON,
          careerFastForwardTargetDate: null,
          homePitchSelections: createDefaultHomePitchSelections(),
          homeBoundaryDimensions: createDefaultHomeBoundaryDimensions(),
          boundaryPresetsByTeam: {},
          homeOutfieldSettings: createDefaultHomeOutfieldSettings(),
          outfieldProjectsByTeam: {},
          customPitchesByTeam: {},
          pitchProjectsByTeam: {},
          activeInjuries: {},
          injuryHistory: [],
          processedInjuryMatchIds: [],
          processedInjuryDateKeys: [],
          injuryReplacementRecords: [],
          tradeRecords: [],
          tradeOffers: [],
          processedAITradeDateKeys: [],
          auctionMarketProfile,
          retiredPlayerSnapshots: appendHistoricalRetirees(
            {},
            preparedPool,
            getReferencedRecordPlayerIds(initializedPlayers, []),
          ),
          lastCareerPostseasonSeason: null,
          lastCareerAgedSeason: INITIAL_ACTIVE_SEASON,
          lastCareerAuctionProcessedSeason: null,
          pendingRetirementIntake: 0,
          lastCareerRetirements: preparedPool.retirements,
          careerRetirementHistory: preparedPool.retirements,
          lastCareerGeneratedPlayerIds: preparedPool.generatedPlayers.map((player) => player.id),
          auction: {
            type: openingAuctionType,
            season: INITIAL_ACTIVE_SEASON,
            phase: "retention",
            allPlayerIds: [],
            soldPlayerIds: [],
            unsoldPlayerIds: [],
            currentLotIndex: 0,
            currentPlayer: null,
            currentBid: 0,
            currentHighBidderTeamId: null,
            biddingHistory: [],
            timerSeconds: 10,
            sets: [],
            currentSetIndex: 0,
            teamPurses: {},
            isAcceleratedPhase: false,
            rtm: null,
            soldFlash: null,
            unsoldFlash: null,
            saleHistory: [],
          },
          isSetupComplete: false,
        });
      },

      refreshPlayersFromSupabase: async () => {
        const fetchedPlayers = await fetchPlayersFromSupabase(true);
        if (fetchedPlayers.length === 0) {
          throw new Error("The player contract roster could not be loaded.");
        }
        const state = get();
        if (Object.keys(state.players).length === 0) return;

        const retiredPlayerIds = getRetiredPlayerIds(state);
        const refreshedPlayers = Object.fromEntries(
          Object.entries(state.players).filter(([playerId]) => !retiredPlayerIds.has(playerId)),
        );
        const careerSeason = String(state.auction?.season ?? state.currentSeason);
        const finalSalesByPlayer = new Map<string, NonNullable<typeof state.auction>["saleHistory"][number]>();
        (state.auction?.saleHistory ?? []).forEach((sale) => finalSalesByPlayer.set(sale.playerId, sale));

        fetchedPlayers.forEach((freshPlayer) => {
          // Missing from the active map can mean retired, not newly added to
          // the database. Retirement history is authoritative for this save.
          if (retiredPlayerIds.has(freshPlayer.id)) return;
          const savedPlayer = state.players[freshPlayer.id];
          if (!savedPlayer) {
            refreshedPlayers[freshPlayer.id] = freshPlayer;
            return;
          }

          let iplHistory = mergePlayerIplHistory(freshPlayer.iplHistory, savedPlayer.iplHistory);
          if (state.currentSeason === INITIAL_ACTIVE_SEASON) {
            const canonicalOpeningContract = getPlayerSeasonHistory(freshPlayer.iplHistory, "2026");
            if (canonicalOpeningContract) {
              iplHistory = upsertPlayerIplHistory(iplHistory, canonicalOpeningContract);
            }
          }
          const finalSale = finalSalesByPlayer.get(savedPlayer.id);
          const existingCareerEntry = getPlayerSeasonHistory(iplHistory, careerSeason);

          if (finalSale) {
            iplHistory = upsertPlayerIplHistory(iplHistory, {
              teamId: finalSale.teamId,
              season: careerSeason,
              price: finalSale.price,
              isRtm: wasPlayerAcquiredViaRtm(finalSale),
            });
          } else if (savedPlayer.currentTeamId) {
            const team = state.teams[savedPlayer.currentTeamId];
            const isRetained = savedPlayer.isRetained || team?.retainedPlayers.includes(savedPlayer.id);
            const reconstructedPrice = existingCareerEntry?.price
              || (isRetained
                ? getPlayerRetentionCost(savedPlayer.id, team?.retainedPlayers ?? [savedPlayer.id], state.players)
                : savedPlayer.basePrice);

            iplHistory = upsertPlayerIplHistory(iplHistory, {
              teamId: savedPlayer.currentTeamId,
              season: careerSeason,
              price: reconstructedPrice,
              isRtm: existingCareerEntry?.isRtm,
            });
          }

          refreshedPlayers[freshPlayer.id] = {
            ...freshPlayer,
            age: savedPlayer.age,
            currentBatting: savedPlayer.currentBatting,
            currentBowling: savedPlayer.currentBowling,
            potentialBatting: savedPlayer.potentialBatting,
            potentialBowling: savedPlayer.potentialBowling,
            potential: savedPlayer.potential,
            country: savedPlayer.country ?? freshPlayer.country,
            careerState: savedPlayer.careerState,
            currentTeamId: savedPlayer.currentTeamId,
            isRetained: savedPlayer.isRetained,
            retainedByTeamId: savedPlayer.retainedByTeamId,
            iplStats: savedPlayer.iplStats ?? freshPlayer.iplStats,
            careerStats: savedPlayer.careerStats ?? freshPlayer.careerStats,
            iplHistory,
          };
        });
        const currentPlayerId = state.auction?.currentPlayer?.id;
        const refreshedCurrentPlayer = currentPlayerId
          ? refreshedPlayers[currentPlayerId] ?? state.auction?.currentPlayer ?? null
          : null;
        const refreshedSummary = state.skipSetSummary
          ? {
              ...state.skipSetSummary,
              results: state.skipSetSummary.results.map((result) => ({
                ...result,
                player: refreshedPlayers[result.player.id] ?? result.player,
              })),
            }
          : null;

        const refreshedMarketPlayers = withAdaptiveBasePrices(applyAuctionMarketRatings(
          refreshedPlayers,
          state.auctionMarketProfile ?? createAuctionMarketProfile(Object.values(refreshedPlayers)),
        ));
        set({
          players: refreshedMarketPlayers,
          teams: Object.fromEntries(Object.entries(state.teams).map(([teamId, team]) => [teamId, {
            ...team,
            squad: team.squad.filter((id) => !retiredPlayerIds.has(id)),
            retainedPlayers: team.retainedPlayers.filter((id) => !retiredPlayerIds.has(id)),
            captainContinuityId: team.captainContinuityId && retiredPlayerIds.has(team.captainContinuityId)
              ? null
              : team.captainContinuityId,
          }])),
          auction: state.auction
            ? {
                ...state.auction,
                allPlayerIds: state.auction.allPlayerIds.filter((id) => !retiredPlayerIds.has(id)),
                soldPlayerIds: state.auction.soldPlayerIds.filter((id) => !retiredPlayerIds.has(id)),
                unsoldPlayerIds: state.auction.unsoldPlayerIds.filter((id) => !retiredPlayerIds.has(id)),
                sets: state.auction.sets.map((set) => ({
                  ...set,
                  playerIds: set.playerIds.filter((id) => !retiredPlayerIds.has(id)),
                })),
                currentPlayer: currentPlayerId && retiredPlayerIds.has(currentPlayerId) ? null : refreshedCurrentPlayer,
                ...(currentPlayerId && retiredPlayerIds.has(currentPlayerId)
                  ? { currentBid: 0, currentHighBidderTeamId: null, biddingHistory: [] }
                  : {}),
              }
            : null,
          auctionTargets: removeResolvedAuctionTargets(state.auctionTargets, retiredPlayerIds),
          auctionTargetPriorities: removeResolvedAuctionTargets(state.auctionTargetPriorities, retiredPlayerIds),
          skipSetSummary: refreshedSummary,
        });
      },

      retainPlayer: (playerId) => {
        const { teams, userTeamId, players, auction, currentSeason } = get();
        const team = teams[userTeamId];
        if (!team) return;
        if (team.retainedPlayers.includes(playerId)) return;

        const player = players[playerId];
        if (!player) return;
        if (auction?.type === "mini") {
          if (player.setForRelease) return;
          if (!team.squad.includes(playerId) || player.currentTeamId !== userTeamId) return;
          const newRetained = [...team.retainedPlayers, playerId];
          const validation = validateMiniAuctionRetentions({ team, keptIds: newRetained, players, season: currentSeason });
          if (!validation.valid) return;
          set((state) => ({
            teams: {
              ...state.teams,
              [userTeamId]: {
                ...team,
                retainedPlayers: newRetained,
                totalPurse: MINI_AUCTION_PURSE_LAKHS,
                remainingPurse: validation.remainingPurse,
                spentAmount: validation.totalSalary,
              },
            },
            players: {
              ...state.players,
              [playerId]: { ...player, isRetained: true, retainedByTeamId: userTeamId },
            },
          }));
          return;
        }
        if (team.retainedPlayers.length >= MAX_TOTAL_RETENTIONS) return;
        if (!isPlayerAuctionEligible(player)) return;

        const isPlayerCapped = player.isCapped || player.nationality === "Overseas";
        const cappedCount = team.retainedPlayers.filter((id) => {
          const p = players[id];
          return p && (p.isCapped || p.nationality === "Overseas");
        }).length;
        const uncappedCount = team.retainedPlayers.length - cappedCount;

        if (isPlayerCapped && cappedCount >= MAX_CAPPED_RETENTIONS) return;
        if (!isPlayerCapped && uncappedCount >= MAX_UNCAPPED_RETENTIONS) return;

        const newRetained = [...team.retainedPlayers, playerId];
        const newTotalCost = calculateTotalRetentionCost(newRetained, players);

        set((state) => ({
          teams: {
            ...state.teams,
            [userTeamId]: {
              ...team,
              retainedPlayers: newRetained,
              remainingPurse: TOTAL_PURSE_LAKHS - newTotalCost,
              spentAmount: newTotalCost,
            },
          },
          players: {
            ...state.players,
            [playerId]: { ...player, isRetained: true, retainedByTeamId: userTeamId },
          },
        }));
      },

      releaseRetention: (playerId) => {
        const { teams, userTeamId, players, auction, currentSeason } = get();
        const team = teams[userTeamId];
        if (!team) return;
        if (!team.retainedPlayers.includes(playerId)) return;

        const player = players[playerId];
        const newRetained = team.retainedPlayers.filter((id) => id !== playerId);
        const newTotalCost = auction?.type === "mini"
          ? calculateMiniAuctionKeptSalary(newRetained, userTeamId, players, currentSeason)
          : calculateTotalRetentionCost(newRetained, players);
        const totalPurse = auction?.type === "mini" ? MINI_AUCTION_PURSE_LAKHS : TOTAL_PURSE_LAKHS;

        set((state) => ({
          teams: {
            ...state.teams,
            [userTeamId]: {
              ...team,
              retainedPlayers: newRetained,
              totalPurse,
              remainingPurse: Math.max(0, totalPurse - newTotalCost),
              spentAmount: newTotalCost,
            },
          },
          players: {
            ...state.players,
            [playerId]: { ...player, isRetained: false, retainedByTeamId: null },
          },
        }));
      },

      autoRetainPlayers: () => {
        const { teams, userTeamId, players, auction, currentSeason } = get();
        const team = teams[userTeamId];
        if (!team) return;

        if (auction?.type === "mini") {
          const autoRetainedIds = selectAIMiniAuctionKeeps(team, players, currentSeason);
          const validation = validateMiniAuctionRetentions({ team, keptIds: autoRetainedIds, players, season: currentSeason });
          if (!validation.valid) return;
          const retainedSet = new Set(autoRetainedIds);
          const updatedPlayers = { ...players };
          team.squad.forEach((playerId) => {
            const player = updatedPlayers[playerId];
            if (!player) return;
            updatedPlayers[playerId] = {
              ...player,
              isRetained: retainedSet.has(playerId),
              retainedByTeamId: retainedSet.has(playerId) ? userTeamId : null,
            };
          });
          set({
            teams: {
              ...teams,
              [userTeamId]: {
                ...team,
                retainedPlayers: autoRetainedIds,
                totalPurse: MINI_AUCTION_PURSE_LAKHS,
                remainingPurse: validation.remainingPurse,
                spentAmount: validation.totalSalary,
                rtmCardsTotal: 0,
              },
            },
            players: updatedPlayers,
          });
          return;
        }

        const resetTeams = { ...teams };
        const resetPlayers = { ...players };

        team.retainedPlayers.forEach((pid) => {
          const p = resetPlayers[pid];
          if (p) resetPlayers[pid] = { ...p, isRetained: false, retainedByTeamId: null };
        });

        resetTeams[userTeamId] = {
          ...team,
          retainedPlayers: [],
          remainingPurse: TOTAL_PURSE_LAKHS,
          spentAmount: 0,
        };

        const autoRetainedIds = decideAIRetentions(resetTeams[userTeamId], resetPlayers);

        autoRetainedIds.forEach((pid) => {
          const p = resetPlayers[pid];
          if (p) resetPlayers[pid] = { ...p, isRetained: true, retainedByTeamId: userTeamId };
        });

        const newTotalCost = calculateTotalRetentionCost(autoRetainedIds, resetPlayers);

        set({
          teams: {
            ...teams,
            [userTeamId]: {
              ...team,
              retainedPlayers: autoRetainedIds,
              remainingPurse: TOTAL_PURSE_LAKHS - newTotalCost,
              spentAmount: newTotalCost,
            },
          },
          players: resetPlayers,
        });
      },

      confirmRetentions: () => {
        const currentState = get();
        const { teams, userTeamId } = currentState;
        const retiredPlayerIds = getRetiredPlayerIds(currentState);
        const activePlayers = Object.fromEntries(
          Object.entries(currentState.players).filter(([playerId]) => !retiredPlayerIds.has(playerId)),
        );
        const auctionMarketProfile = normalizeAuctionMarketProfile(
          currentState.auctionMarketProfile,
          Object.values(activePlayers),
        );
        const marketPlayers = withAdaptiveBasePrices(applyAuctionMarketRatings(
          activePlayers,
          auctionMarketProfile,
        ));
        const players = Object.fromEntries(Object.entries(marketPlayers).map(([id, player]) => [
          id,
          isPlayerAuctionEligible(player)
            ? player
            : { ...player, isRetained: false, retainedByTeamId: null },
        ]));

        if (currentState.auction?.type === "mini") {
          const selections: Record<string, string[]> = {};
          for (const team of Object.values(teams)) {
            const keptIds = team.id === userTeamId
              ? team.retainedPlayers
              : selectAIMiniAuctionKeeps(team, players, currentState.currentSeason);
            const validation = validateMiniAuctionRetentions({
              team,
              keptIds,
              players,
              season: currentState.currentSeason,
            });
            // Never enter an auction with an impossible or negative purse.
            // The UI exposes the user-team validation; AI selection is also
            // checked here so corrupted saves cannot bypass the invariant.
            if (!validation.valid) return;
            selections[team.id] = keptIds;
          }

          const keptByPlayer = new Map<string, string>();
          Object.entries(selections).forEach(([teamId, playerIds]) => {
            playerIds.forEach((playerId) => keptByPlayer.set(playerId, teamId));
          });
          const updatedPlayers = Object.fromEntries(Object.entries(players).map(([playerId, player]) => {
            const retainedTeamId = keptByPlayer.get(playerId);
            if (!retainedTeamId) {
              const previousTeam = player.currentTeamId ? teams[player.currentTeamId] : undefined;
              const releasedCaptain = previousTeam?.captainContinuityId === playerId;
              return [playerId, {
                ...player,
                currentTeamId: null,
                isRetained: false,
                retainedByTeamId: null,
                iplCaptaincyUninterestedThroughSeason: releasedCaptain
                  ? currentState.currentSeason
                  : player.iplCaptaincyUninterestedThroughSeason,
              }];
            }
            const contractPrice = getMiniAuctionContractPrice(
              player,
              retainedTeamId,
              currentState.currentSeason,
            );
            return [playerId, {
              ...player,
              currentTeamId: retainedTeamId,
              isRetained: true,
              retainedByTeamId: retainedTeamId,
              iplHistory: upsertPlayerIplHistory(player.iplHistory, {
                teamId: retainedTeamId,
                season: String(currentState.currentSeason),
                price: contractPrice,
              }),
            }];
          })) as Record<string, Player>;

          const updatedTeams = Object.fromEntries(Object.values(teams).map((team) => {
            const keptIds = selections[team.id];
            const totalSalary = calculateMiniAuctionKeptSalary(
              keptIds,
              team.id,
              players,
              currentState.currentSeason,
            );
            return [team.id, {
              ...team,
              totalPurse: MINI_AUCTION_PURSE_LAKHS,
              retainedPlayers: keptIds,
              squad: keptIds,
              captainContinuityId: keptIds.includes(team.captainContinuityId ?? "")
                ? team.captainContinuityId
                : null,
              viceCaptainContinuityId: keptIds.includes(team.viceCaptainContinuityId ?? "")
                ? team.viceCaptainContinuityId
                : null,
              spentAmount: totalSalary,
              remainingPurse: Math.max(0, MINI_AUCTION_PURSE_LAKHS - totalSalary),
              overseasPlayersCurrent: keptIds.filter(
                (playerId) => updatedPlayers[playerId]?.nationality === "Overseas",
              ).length,
              rtmCardsTotal: 0,
              rtmCardsUsed: 0,
            }];
          })) as Record<string, Team>;
          const allPlayerIds = getAvailableAuctionPlayerIds(updatedPlayers, updatedTeams);
          const sets = buildAuctionSets(allPlayerIds.map((id) => updatedPlayers[id]).filter(Boolean));
          const teamPurses = buildInitialTeamPurses(updatedTeams);
          const dates = getSeasonDates(currentState.currentSeason);
          set((state) => ({
            teams: updatedTeams,
            players: updatedPlayers,
            auctionMarketProfile,
            currentDate: dates.auctionDate,
            isSetupComplete: true,
            auction: state.auction ? {
              ...state.auction,
              phase: "live",
              allPlayerIds,
              sets,
              teamPurses,
              rtm: null,
            } : null,
          }));
          return;
        }

        // Fresh per-auction AI quirks (fuzzed roster targets, temperament,
        // budget envelopes) — sampled once per auction inside the engine
        resetAuctionQuirks();

        // Build player pool: all non-retained players
        const allPlayerIds = Object.values(players)
          .filter((p) => !retiredPlayerIds.has(p.id) && !p.isRetained && isPlayerAuctionEligible(p))
          .map((p) => p.id);

        // AI teams: engine weighs each player's estimated worth against the
        // retention slab costs (loyalty DNA, reputation, age, potential…)
        const updatedTeams = { ...teams };
        const updatedPlayers = { ...players };

        // A completed-season squad is only the retention candidate list. Once
        // retention choices are being confirmed, every unretained player is
        // formally released before the auction begins.
        Object.entries(updatedPlayers).forEach(([playerId, player]) => {
          if (player.isRetained) return;
          updatedPlayers[playerId] = {
            ...player,
            currentTeamId: null,
            retainedByTeamId: null,
          };
        });

        Object.values(teams).forEach((team) => {
          if (team.id === userTeamId) return;

          const retainedIds = decideAIRetentions(team, players);
          const releasedCaptainId = team.captainContinuityId;
          if (
            releasedCaptainId
            && !retainedIds.includes(releasedCaptainId)
            && updatedPlayers[releasedCaptainId]
          ) {
            updatedPlayers[releasedCaptainId] = {
              ...updatedPlayers[releasedCaptainId],
              iplCaptaincyUninterestedThroughSeason: get().currentSeason,
            };
          }
          retainedIds.forEach((pid) => {
            const p = players[pid];
            if (!p) return;
            const retentionCost = getPlayerRetentionCost(pid, retainedIds, players);
            const updatedHistory = [
              ...p.iplHistory.filter((h) => h.season !== getActiveSeasonYear()),
              { teamId: team.id, season: getActiveSeasonYear(), price: retentionCost },
            ];
            updatedPlayers[pid] = {
              ...p,
              isRetained: true,
              retainedByTeamId: team.id,
              currentTeamId: team.id,
              iplHistory: updatedHistory,
            };
            const poolIdx = allPlayerIds.indexOf(pid);
            if (poolIdx !== -1) allPlayerIds.splice(poolIdx, 1);
          });

          const totalCost = calculateTotalRetentionCost(retainedIds, updatedPlayers);

          updatedTeams[team.id] = {
            ...team,
            retainedPlayers: retainedIds,
            captainContinuityId: retainedIds.includes(team.captainContinuityId ?? "")
              ? team.captainContinuityId
              : null,
            viceCaptainContinuityId: retainedIds.includes(team.viceCaptainContinuityId ?? "")
              ? team.viceCaptainContinuityId
              : null,
            remainingPurse: TOTAL_PURSE_LAKHS - totalCost,
            spentAmount: totalCost,
            squad: retainedIds,
            // The previous season's full-squad counter must not survive the
            // retention cut. Auction eligibility reads this field directly.
            overseasPlayersCurrent: retainedIds.filter(
              (playerId) => updatedPlayers[playerId]?.nationality === "Overseas",
            ).length,
            // RTM cards = 6 minus number of retentions (per IPL rules)
            rtmCardsTotal: Math.max(0, MAX_TOTAL_RETENTIONS - retainedIds.length),
          };
        });

        // User team retentions history update
        const userTeam = updatedTeams[userTeamId];
        const releasedUserCaptainId = userTeam.captainContinuityId;
        if (
          releasedUserCaptainId
          && !userTeam.retainedPlayers.includes(releasedUserCaptainId)
          && updatedPlayers[releasedUserCaptainId]
        ) {
          updatedPlayers[releasedUserCaptainId] = {
            ...updatedPlayers[releasedUserCaptainId],
            iplCaptaincyUninterestedThroughSeason: get().currentSeason,
          };
        }
        const validUserRetainedPlayers = userTeam.retainedPlayers.filter((pid) => (
          Boolean(updatedPlayers[pid]) && isPlayerAuctionEligible(updatedPlayers[pid])
        ));
        validUserRetainedPlayers.forEach((pid) => {
          const p = updatedPlayers[pid];
          if (!p) return;
          const retentionCost = getPlayerRetentionCost(pid, validUserRetainedPlayers, players);
          const updatedHistory = [
            ...p.iplHistory.filter((h) => h.season !== getActiveSeasonYear()),
            { teamId: userTeamId, season: getActiveSeasonYear(), price: retentionCost },
          ];
          updatedPlayers[pid] = {
            ...p,
            isRetained: true,
            retainedByTeamId: userTeamId,
            currentTeamId: userTeamId,
            iplHistory: updatedHistory,
          };
        });

        updatedTeams[userTeamId] = {
          ...userTeam,
          retainedPlayers: validUserRetainedPlayers,
          squad: validUserRetainedPlayers,
          captainContinuityId: validUserRetainedPlayers.includes(userTeam.captainContinuityId ?? "")
            ? userTeam.captainContinuityId
            : null,
          viceCaptainContinuityId: validUserRetainedPlayers.includes(userTeam.viceCaptainContinuityId ?? "")
            ? userTeam.viceCaptainContinuityId
            : null,
          overseasPlayersCurrent: validUserRetainedPlayers.filter(
            (playerId) => updatedPlayers[playerId]?.nationality === "Overseas",
          ).length,
          rtmCardsTotal: Math.max(0, MAX_TOTAL_RETENTIONS - validUserRetainedPlayers.length),
        };

        const sets = buildAuctionSets(
          allPlayerIds.map((id) => updatedPlayers[id]).filter(Boolean)
        );

        const teamPurses = buildInitialTeamPurses(updatedTeams);
        const dates = getSeasonDates(get().currentSeason);

        set((state) => ({
          teams: updatedTeams,
          players: updatedPlayers,
          auctionMarketProfile,
          currentDate: dates.auctionDate,
          isSetupComplete: true,
          auction: state.auction
            ? {
                ...state.auction,
                phase: "live",
                allPlayerIds,
                sets,
                teamPurses,
              }
            : null,
        }));
      },

      startAuction: () => {
        const { auction, players, teams } = get();
        if (!auction || auction.phase !== "live") return;

        const updatedTeams = { ...teams };

        let activeSets = auction.sets;
        if (!activeSets || activeSets.length === 0) {
          const resolvedPlayerIds = [...auction.soldPlayerIds, ...auction.unsoldPlayerIds];
          const availablePlayerIds = getAvailableAuctionPlayerIds(players, teams, resolvedPlayerIds);
          const availablePlayers = availablePlayerIds
            .map((playerId) => players[playerId])
            .filter(Boolean)
            .map((player) => ({ ...player, isRetained: false, retainedByTeamId: null, currentTeamId: null }));
          activeSets = buildAuctionSets(availablePlayers);
          set((state) => ({
            players: Object.fromEntries(Object.entries(state.players).map(([playerId, player]) => [
              playerId,
              availablePlayerIds.includes(playerId)
                ? { ...player, isRetained: false, retainedByTeamId: null, currentTeamId: null }
                : player,
            ])),
            auction: state.auction ? {
              ...state.auction,
              allPlayerIds: Array.from(new Set([
                ...state.auction.soldPlayerIds,
                ...state.auction.unsoldPlayerIds,
                ...availablePlayerIds,
              ])),
              sets: activeSets,
              currentSetIndex: 0,
            } : null,
          }));
        }

        if (activeSets.length === 0) return;

        const next = pickNextLot(activeSets);
        if (!next) return;

        const currentSet = activeSets[next.setIndex];
        const playerId = currentSet.playerIds[next.playerIndex];
        const player = get().players[playerId];
        if (!player) return;

        set((state) => ({
          teams: updatedTeams,
          auction: state.auction
            ? {
                ...state.auction,
                currentSetIndex: next.setIndex,
                currentPlayer: player,
                currentBid: player.basePrice,
                currentHighBidderTeamId: null,
                biddingHistory: [],
                timerSeconds: 10,
                rtm: null,
                soldFlash: null,
                unsoldFlash: null,
              }
            : null,
        }));

        // Fresh lot — reset AI valuation cache and kick off first round
        resetLotCache();
        scheduleAIBids(player);
      },

      placeBid: (teamId, amount) => {
        const { auction, teams, players } = get();
        if (!auction || !auction.currentPlayer) return;

        const team = teams[teamId];
        if (!team) return;

        const { canBid } = canTeamBidOnPlayer(team, auction.currentPlayer, players, teamId !== get().userTeamId);
        if (!canBid) return;
        if (!canTeamAffordBid(
          team,
          amount,
          players,
          auction.isAcceleratedPhase ? "accelerated-5-plus-5" : "original"
        )) return;

        const updates = processBid(amount, teamId, auction.biddingHistory);

        set((state) => ({
          auction: state.auction ? { ...state.auction, ...updates } : null,
        }));
      },

      passBid: () => {
        const { auction, players } = get();
        if (!auction?.currentPlayer) return;
        simulateRemainingBids(auction.currentPlayer);
      },

      // ---- RTM: user is original team, AI is winner ----

      exerciseRtm: () => {
        const { auction, teams, userTeamId, players } = get();
        if (!auction?.rtm || auction.rtm.phase !== "offer") return;
        if (auction.rtm.originalTeamId !== userTeamId) return;
        if (!auction.currentPlayer) return;

        const { winnerTeamId, baseAmount } = auction.rtm;
        const userTeam = teams[userTeamId];
        if (userTeam && !canTeamAffordBid(userTeam, baseAmount, players)) return; // Cannot afford RTM

        const player = auction.currentPlayer;
        const winnerValuation = getCachedValuation(winnerTeamId);

        // Winner AI counter decision: counter if their valuation > soldAmount by ≥5%
        if (winnerValuation > baseAmount * 1.05) {
          // AI counters to some point between baseAmount and their valuation
          let counterAmount = baseAmount;
          const target = Math.min(winnerValuation, Math.round(baseAmount * 1.25));
          while (counterAmount < target) {
            counterAmount = getNextBidAmount(counterAmount);
          }
          if (counterAmount <= baseAmount) counterAmount = getNextBidAmount(baseAmount);

          set((s) => ({
            auction: s.auction?.rtm
              ? {
                  ...s.auction,
                  rtm: { ...s.auction.rtm, phase: "original_match" as const, raisedAmount: counterAmount, timerSeconds: 15 },
                }
              : s.auction,
          }));
        } else {
          // AI doesn't counter → user gets player at baseAmount
          doRTMTransfer(userTeamId, winnerTeamId, player, baseAmount, baseAmount);
        }
      },

      declineRtm: () => {
        const { auction } = get();
        if (!auction?.rtm) return;
        const { winnerTeamId, baseAmount } = auction.rtm;
        set((s) => {
          const a = s.auction;
          if (!a?.currentPlayer) return {};
          return {
            auction: {
              ...a,
              rtm: null,
              soldFlash: { playerId: a.currentPlayer.id, teamId: winnerTeamId, amount: baseAmount },
              saleHistory: [...(a.saleHistory ?? []), { playerId: a.currentPlayer.id, teamId: winnerTeamId, price: baseAmount, lot: a.currentLotIndex, bids: a.biddingHistory }],
            },
          };
        });
        setTimeout(() => advanceToNextLot(), 2200);
      },

      // ---- RTM: user is winner, AI is original team ----

      raiseCounter: (amount) => {
        const { auction, teams, userTeamId } = get();
        if (!auction?.rtm || auction.rtm.phase !== "winner_counter") return;
        if (auction.rtm.winnerTeamId !== userTeamId) return;
        if (!auction.currentPlayer) return;

        const userTeam = teams[userTeamId];
        if (userTeam && userTeam.remainingPurse < amount) return; // Cannot afford raised amount

        const { originalTeamId, baseAmount } = auction.rtm;
        const player = auction.currentPlayer;
        const aiValuation = getCachedValuation(originalTeamId);

        if (aiValuation >= amount) {
          // AI matches counter: AI (original) gets player at amount
          doRTMTransfer(originalTeamId, userTeamId, player, amount, baseAmount);
        } else {
          // AI folds: user keeps player but pays 'amount' (extra above baseAmount)
          doWinnerKeepsAtCounter(userTeamId, baseAmount, amount, player);
        }
      },

      passCounter: () => {
        const { auction, userTeamId } = get();
        if (!auction?.rtm || auction.rtm.phase !== "winner_counter") return;
        if (auction.rtm.winnerTeamId !== userTeamId) return;
        if (!auction.currentPlayer) return;

        const { originalTeamId, baseAmount } = auction.rtm;
        const player = auction.currentPlayer;
        // User doesn't raise → AI original gets player at baseAmount
        doRTMTransfer(originalTeamId, userTeamId, player, baseAmount, baseAmount);
      },

      // ---- RTM: user is original team, counter-bid phase ----

      matchCounter: () => {
        const { auction, teams, userTeamId } = get();
        if (!auction?.rtm || auction.rtm.phase !== "original_match") return;
        if (auction.rtm.originalTeamId !== userTeamId) return;
        if (!auction.currentPlayer) return;

        const { winnerTeamId, baseAmount, raisedAmount } = auction.rtm;
        const userTeam = teams[userTeamId];
        if (userTeam && userTeam.remainingPurse < raisedAmount) return; // Cannot afford raised amount

        const player = auction.currentPlayer;
        doRTMTransfer(userTeamId, winnerTeamId, player, raisedAmount, baseAmount);
      },

      foldToCounter: () => {
        const { auction, userTeamId } = get();
        if (!auction?.rtm || auction.rtm.phase !== "original_match") return;
        if (auction.rtm.originalTeamId !== userTeamId) return;
        if (!auction.currentPlayer) return;

        const { winnerTeamId, baseAmount, raisedAmount } = auction.rtm;
        const player = auction.currentPlayer;
        doWinnerKeepsAtCounter(winnerTeamId, baseAmount, raisedAmount, player);
      },

      tickTimer: () => {
        const { auction, isPaused } = get();
        if (isPaused) return;
        if (!auction || auction.phase !== "live" || !auction.currentPlayer) return;
        if (auction.rtm) return;
        if (auction.soldFlash) return;
        if (auction.unsoldFlash) return;

        if (auction.timerSeconds <= 0) {
          hammerFall();
          return;
        }

        set((state) => ({
          auction: state.auction
            ? { ...state.auction, timerSeconds: state.auction.timerSeconds - 1 }
            : null,
        }));
      },

      tickRTMTimer: () => {
        const { auction, isPaused } = get();
        if (isPaused) return;
        if (!auction?.rtm) return;

        if (auction.rtm.timerSeconds <= 0) {
          // Auto-action on timeout based on phase and user role
          const { rtm } = auction;
          const { userTeamId } = get();
          if (rtm.phase === "offer" && rtm.originalTeamId === userTeamId) get().declineRtm();
          if (rtm.phase === "winner_counter" && rtm.winnerTeamId === userTeamId) get().passCounter();
          if (rtm.phase === "original_match" && rtm.originalTeamId === userTeamId) get().foldToCounter();
          return;
        }

        set((state) => ({
          auction: state.auction?.rtm
            ? { ...state.auction, rtm: { ...state.auction.rtm, timerSeconds: state.auction.rtm.timerSeconds - 1 } }
            : state.auction,
        }));
      },

      dismissSoldFlash: () => {
        set((state) => ({
          auction: state.auction ? { ...state.auction, soldFlash: null, unsoldFlash: null } : null,
        }));
      },

      setPaused: (paused: boolean) => {
        set({ isPaused: paused });
      },

      togglePaused: () => {
        set((state) => ({ isPaused: !state.isPaused }));
      },

      setUserTeam: (teamId: string) => {
        if (!get().teams[teamId]) return;
        set({ userTeamId: teamId });
      },

      increaseSpeed: () => {
        set((state) => {
          let nextSpeed = state.speed;
          if (state.speed === 1) nextSpeed = 2;
          else if (state.speed === 2) nextSpeed = 4;
          else if (state.speed === 4) nextSpeed = 8;
          return { speed: nextSpeed };
        });
      },

      decreaseSpeed: () => {
        set((state) => {
          let nextSpeed = state.speed;
          if (state.speed === 8) nextSpeed = 4;
          else if (state.speed === 4) nextSpeed = 2;
          else if (state.speed === 2) nextSpeed = 1;
          return { speed: nextSpeed };
        });
      },

      dismissSkipSetSummary: () => {
        const state = get();
        if (state.acceleratedPlanningState) {
          set({ skipSetSummary: null, isPaused: true });
        } else {
          set({ skipSetSummary: null, isPaused: false });
          advanceToNextLot();
        }
      },

      setAuctionTarget: (playerId, maxBidLakhs, priority = "medium") => {
        const { players, teams, userTeamId, auctionTargets } = get();
        const player = players[playerId];
        const userTeam = teams[userTeamId];
        if (!player || !Number.isFinite(maxBidLakhs) || maxBidLakhs < player.basePrice) return;
        if (!userTeam) return;
        if (!canTeamBidOnPlayer(userTeam, player, players, false).canBid) return;
        if (!canTeamAffordBid(userTeam, player.basePrice, players)) return;
        if (auctionTargets[playerId] === undefined && Object.keys(auctionTargets).length >= MAX_AUCTION_TARGETS) return;
        const legalMaxBid = roundDownToLegalBid(player.basePrice, maxBidLakhs);
        set((state) => ({
          auctionTargets: { ...state.auctionTargets, [playerId]: legalMaxBid },
          auctionTargetPriorities: { ...state.auctionTargetPriorities, [playerId]: priority },
        }));
      },

      removeAuctionTarget: (playerId) => {
        set((state) => {
          const auctionTargets = { ...state.auctionTargets };
          const auctionTargetPriorities = { ...state.auctionTargetPriorities };
          delete auctionTargets[playerId];
          delete auctionTargetPriorities[playerId];
          return { auctionTargets, auctionTargetPriorities };
        });
      },

      confirmUserAcceleratedTargets: (targets) => {
        const state = get();
        const { auction, players, teams, userTeamId } = state;
        if (!auction) return;

        const aiTargets: Record<string, string[]> = {};
        const aiBackups: Record<string, string[]> = {};
        Object.values(teams).forEach((team) => {
          if (team.id === userTeamId) return;
          const result = getAIAcceleratedNominationsAndBackups(team, auction.unsoldPlayerIds, players, auction);
          aiTargets[team.id] = result.targets;
          aiBackups[team.id] = result.backups;
        });

        set({
          userAcceleratedTargets: targets,
          aiAcceleratedTargets: aiTargets,
          aiAcceleratedBackups: aiBackups,
          acceleratedPlanningState: 'results',
        });
      },

      startAcceleratedAuctionFromPlanning: () => {
        const state = get();
        const { auction, players, userAcceleratedTargets, aiAcceleratedTargets, aiAcceleratedBackups } = state;
        if (!auction) return;

        const allNominatedIds = new Set<string>();
        userAcceleratedTargets.forEach((id) => allNominatedIds.add(id));
        Object.values(aiAcceleratedTargets).forEach((ids) => {
          ids.forEach((id) => allNominatedIds.add(id));
        });
        Object.values(aiAcceleratedBackups).forEach((ids) => {
          ids.forEach((id) => allNominatedIds.add(id));
        });
        auction.unsoldPlayerIds.forEach((id) => {
          const player = players[id];
          if (player && isPriorityAuctionSale(player)) allNominatedIds.add(id);
        });

        const unsoldPlayers = Array.from(allNominatedIds)
          .map((id) => players[id])
          .filter(Boolean)
          .sort((a, b) => (a.basePrice - b.basePrice) || (ratingOf(b) - ratingOf(a)));

        const updatedAuctionTargets = { ...state.auctionTargets };
        const updatedAuctionTargetPriorities = { ...state.auctionTargetPriorities };
        
        userAcceleratedTargets.forEach((id) => {
          const p = players[id];
          if (!p) return;
          const userTeam = state.teams[state.userTeamId];
          if (!userTeam) return;
          
          const ctx: AuctionContext = {
            remainingPlayerIds: Array.from(allNominatedIds),
            soldPlayerIds: auction.soldPlayerIds ?? [],
            currentLotIndex: auction.currentLotIndex,
            totalLots: auction.allPlayerIds.length,
            isAcceleratedPhase: true,
            auctionType: auction.type,
          };
          const valuation = getLotValuation(p.id, userTeam, p, players, ctx);
          
          updatedAuctionTargets[id] = Math.max(p.basePrice, valuation);
          updatedAuctionTargetPriorities[id] = "high";
        });

        if (unsoldPlayers.length > 0) {
          const acceleratedSets = [{
            id: "accelerated",
            name: "Accelerated Auction",
            playerIds: unsoldPlayers.map((p) => p.id),
            currentIndex: 0,
            isCompleted: false,
          }];

          const firstPlayer = unsoldPlayers[0];

          set((s) => ({
            acceleratedPlanningState: null,
            isPaused: false,
            auctionTargets: updatedAuctionTargets,
            auctionTargetPriorities: updatedAuctionTargetPriorities,
            auction: s.auction
              ? {
                  ...s.auction,
                  sets: acceleratedSets,
                  currentSetIndex: 0,
                  currentLotIndex: s.auction.currentLotIndex + 1,
                  currentPlayer: firstPlayer,
                  currentBid: firstPlayer.basePrice,
                  currentHighBidderTeamId: null,
                  biddingHistory: [],
                  timerSeconds: 10,
                  isAcceleratedPhase: true,
                  acceleratedPass: 1,
                  unsoldPlayerIds: [],
                  soldFlash: null,
                  unsoldFlash: null,
                }
              : null,
          }));

          resetLotCache();
          scheduleAIBids(firstPlayer);
        } else {
          set((s) => ({
            acceleratedPlanningState: null,
            auction: s.auction
              ? {
                  ...s.auction,
                  phase: "completed",
                  currentPlayer: null,
                }
              : null,
          }));
          get().processCompletedAuctionCareer();
        }
      },

      skipCurrentSet: () => {
        const state = get();
        const { auction, players, teams, userTeamId, auctionTargets, auctionTargetPriorities } = state;
        if (!auction || auction.phase !== "live") return;

        const currentSet = auction.sets[auction.currentSetIndex];
        if (!currentSet || currentSet.isCompleted) return;

        set({ speed: 1 });
        _hammerLotId = null;

        const newTeams = { ...teams };
        const newPlayers = { ...players };
        const newSoldIds = [...(auction.soldPlayerIds ?? [])];
        const newUnsoldIds = [...(auction.unsoldPlayerIds ?? [])];
        const newSaleHistory = [...(auction.saleHistory ?? [])];
        let currentLotIndex = auction.currentLotIndex;

        const setPlayerIds = currentSet.playerIds;
        const startIndex = currentSet.currentIndex;
        const playersToAuctionIds = setPlayerIds.slice(startIndex);
        const pendingTargetIds = new Set(
          Object.keys(auctionTargets).filter(
            (id) => !auction.soldPlayerIds.includes(id) && !auction.unsoldPlayerIds.includes(id)
          )
        );

        const results: SkipSetResultItem[] = [];
        const totalLots = auction.sets.reduce((sum, s) => sum + s.playerIds.length, 0);

        // The first player in this slice is the one already on the block, so it
        // keeps the current lot number; only subsequent players advance the lot.
        let isFirstProcessed = true;
        let userPurchasesDuringSkip = 0;

        playersToAuctionIds.forEach((playerId) => {
          const player = newPlayers[playerId];
          if (!player) return;

          const isCurrentLiveLot = isFirstProcessed && auction.currentPlayer?.id === player.id;
          if (!isFirstProcessed) currentLotIndex++;
          isFirstProcessed = false;
          resetLotCache();

          const ctx: AuctionContext = {
            remainingPlayerIds: auction.allPlayerIds.filter(
              (id) => !newSoldIds.includes(id) && id !== player.id
            ),
            soldPlayerIds: newSoldIds,
            currentLotIndex,
            totalLots,
            isAcceleratedPhase: auction.isAcceleratedPhase,
            auctionType: auction.type,
          };

          let currentBid = isCurrentLiveLot ? auction.currentBid : player.basePrice;
          let highBidderTeamId: string | null = isCurrentLiveLot
            ? auction.currentHighBidderTeamId
            : null;
          let biddingHistory: BidEntry[] = isCurrentLiveLot
            ? [...auction.biddingHistory]
            : [];

          let iterations = 0;
          const MAX_ITER = 300;
          const targetMaxBid = auctionTargets[player.id];
          const targetPriority = auctionTargetPriorities[player.id] ?? "medium";
          pendingTargetIds.delete(player.id);
          const protectedTargetReserve = getProtectedTargetReserve(
            player.id, pendingTargetIds, auctionTargets, auctionTargetPriorities, newTeams[userTeamId], newPlayers
          );
          while (iterations < MAX_ITER) {
            iterations++;
            const nextBid: number = highBidderTeamId ? getNextBidAmount(currentBid) : currentBid;

            const interested: Team[] = Object.values(newTeams).filter((t: Team): boolean => {
              if (t.id === highBidderTeamId) return false;
              if (t.id === userTeamId) {
                return targetMaxBid !== undefined && canTeamBidDuringSkip(
                  t, player, nextBid, player.id, newPlayers, ctx, userTeamId, targetMaxBid, protectedTargetReserve
                );
              }
              if (auction.isAcceleratedPhase) {
                return canAIBidAtAmount(t, player, nextBid, player.id, newPlayers, ctx);
              } else {
                return canAIBidAtAmount(t, player, nextBid, player.id, newPlayers, ctx);
              }
            });

            if (interested.length === 0) break;

            const bidder: Team | null | undefined = interested.find((team: Team) => team.id === userTeamId && targetMaxBid !== undefined)
              ?? pickBiddingTeam(interested, player, player.id, newPlayers, ctx);
            if (!bidder) break;

            currentBid = nextBid;
            highBidderTeamId = bidder.id;
            biddingHistory = [{ teamId: bidder.id, amount: nextBid, timestamp: Date.now() }, ...biddingHistory];
          }

          if (!highBidderTeamId) {
            newUnsoldIds.push(player.id);
            results.push({
              player,
              status: "unsold",
              targetRemainsActive: targetMaxBid !== undefined && !auction.isAcceleratedPhase,
              targetMissReason: targetMaxBid !== undefined && auction.isAcceleratedPhase
                ? getTargetBidBlockReason(newTeams[userTeamId], player, player.basePrice, newPlayers, userPurchasesDuringSkip > 0, protectedTargetReserve) ?? "Too expensive"
                : undefined,
            });
          } else {
            let finalWinnerId = highBidderTeamId;
            let finalPrice = currentBid;
            let usedRtm = false;

            const rtmTeamId = findRTMEligibleTeam(player, newTeams, highBidderTeamId, currentBid);

            if (rtmTeamId) {
              const rtmTeam = newTeams[rtmTeamId];
              const aiOrigValuation = rtmTeamId === userTeamId && targetMaxBid !== undefined
                ? targetMaxBid
                : getCachedValuation(rtmTeamId);
              const loyaltyBonus = 1.0 + (rtmTeam?.dna.loyalty ?? 50) / 100 * 0.25;
              const rtmCeiling = rtmTeamId === userTeamId ? aiOrigValuation : aiOrigValuation * loyaltyBonus;

              if (rtmCeiling >= currentBid && canAffordTargetRtm(rtmTeam, currentBid, newPlayers, rtmTeamId === userTeamId, targetPriority, protectedTargetReserve)) {
                const winnerTeam = newTeams[highBidderTeamId];
                const aiWinnerValuation = getCachedValuation(highBidderTeamId);

                if (aiWinnerValuation > currentBid * 1.05 && winnerTeam.remainingPurse >= currentBid * 1.05) {
                  let counterAmount = currentBid;
                  const target = Math.min(aiWinnerValuation, Math.round(currentBid * 1.25));
                  while (counterAmount < target) counterAmount = getNextBidAmount(counterAmount);
                  if (counterAmount <= currentBid) counterAmount = getNextBidAmount(currentBid);

                  if (rtmCeiling >= counterAmount && canAffordTargetRtm(rtmTeam, counterAmount, newPlayers, rtmTeamId === userTeamId, targetPriority, protectedTargetReserve)) {
                    finalWinnerId = rtmTeamId;
                    finalPrice = counterAmount;
                    usedRtm = true;
                  } else {
                    finalWinnerId = highBidderTeamId;
                    finalPrice = counterAmount;
                  }
                } else {
                  finalWinnerId = rtmTeamId;
                  finalPrice = currentBid;
                  usedRtm = true;
                }
              }
            }

            // A skipped-auction target is a hard ceiling, including RTM counters.
            if (finalWinnerId === userTeamId && targetMaxBid !== undefined && rtmTeamId &&
                (finalPrice > targetMaxBid || (targetPriority !== "high" && newTeams[userTeamId].remainingPurse - finalPrice < protectedTargetReserve))) {
              finalWinnerId = rtmTeamId;
              finalPrice = currentBid;
              usedRtm = true;
            }

            const winnerTeam = newTeams[finalWinnerId];
            if (winnerTeam) {
              newTeams[finalWinnerId] = {
                ...winnerTeam,
                squad: [...winnerTeam.squad, player.id],
                remainingPurse: winnerTeam.remainingPurse - finalPrice,
                spentAmount: winnerTeam.spentAmount + finalPrice,
                rtmCardsUsed: usedRtm ? winnerTeam.rtmCardsUsed + 1 : winnerTeam.rtmCardsUsed,
                overseasPlayersCurrent:
                  player.nationality === "Overseas"
                    ? winnerTeam.overseasPlayersCurrent + 1
                    : winnerTeam.overseasPlayersCurrent,
              };
            }

            // Record the sale under the active IPL season, matching the
            // live hammerFall / doRTMTransfer flow so skip-sold and live-sold
            // players have identical, accurate iplHistory.
            const updatedHistory = [
              ...player.iplHistory.filter((h) => h.season !== getActiveSeasonYear()),
              { teamId: finalWinnerId, season: getActiveSeasonYear(), price: finalPrice, isRtm: usedRtm },
            ];

            newPlayers[player.id] = {
              ...player,
              currentTeamId: finalWinnerId,
              iplHistory: updatedHistory,
            };

            newSoldIds.push(player.id);

            newSaleHistory.push({
              playerId: player.id,
              teamId: finalWinnerId,
              price: finalPrice,
              lot: currentLotIndex,
              bids: biddingHistory,
            });

            let targetMissReason: string | undefined;
            if (targetMaxBid !== undefined && finalWinnerId !== userTeamId) {
              if (targetPriority !== "high" && newTeams[userTeamId].remainingPurse - finalPrice < protectedTargetReserve) {
                targetMissReason = "Funds reserved for higher-priority targets";
              } else if (usedRtm && finalPrice <= targetMaxBid) {
                targetMissReason = `${newTeams[finalWinnerId]?.name ?? finalWinnerId} exercised RTM`;
              } else if (finalPrice > targetMaxBid) {
                targetMissReason = "Too expensive";
              } else {
                targetMissReason = getTargetBidBlockReason(
                  newTeams[userTeamId], player, currentBid, newPlayers, userPurchasesDuringSkip > 0, protectedTargetReserve
                ) ?? "Too expensive";
              }
            }

            if (finalWinnerId === userTeamId) userPurchasesDuringSkip++;

            results.push({
              player: newPlayers[player.id],
              status: "sold",
              teamId: finalWinnerId,
              price: finalPrice,
              usedRtm,
              targetMissReason,
            });
          }
        });

        const updatedSets = auction.sets.map((s, i) => {
          if (i === auction.currentSetIndex) {
            return {
              ...s,
              currentIndex: s.playerIds.length,
              isCompleted: true,
            };
          }
          return s;
        });

        const updatedPurses: Record<string, { remaining: number; squadCount: number }> = {};
        Object.values(newTeams).forEach((t) => {
          updatedPurses[t.id] = { remaining: t.remainingPurse, squadCount: t.squad.length };
        });

        if (auction.isAcceleratedPhase) {
          ensureMinimumSquadSizes(newTeams, newPlayers);
          const updatedPurses: Record<string, { remaining: number; squadCount: number }> = {};
          Object.values(newTeams).forEach((t) => {
            updatedPurses[t.id] = { remaining: t.remainingPurse, squadCount: t.squad.length };
          });
          set({
            teams: newTeams,
            players: newPlayers,
            auctionTargets: removeResolvedAuctionTargets(auctionTargets, results.map((result) => result.player.id)),
            auctionTargetPriorities: removeResolvedAuctionTargets(auctionTargetPriorities, results.map((result) => result.player.id)),
            isPaused: false,
            skipSetSummary: null,
            auction: {
              ...auction,
              sets: updatedSets,
              phase: "completed",
              currentLotIndex,
              currentPlayer: null,
              soldPlayerIds: newSoldIds,
              unsoldPlayerIds: newUnsoldIds,
              saleHistory: newSaleHistory,
              teamPurses: updatedPurses,
              soldFlash: null,
              unsoldFlash: null,
              rtm: null,
            },
          });
          get().processCompletedAuctionCareer();
        } else {
          const soldResultIds = results
            .filter((result) => result.status === "sold")
            .map((result) => result.player.id);
          set({
            teams: newTeams,
            players: newPlayers,
            auctionTargets: removeResolvedAuctionTargets(auctionTargets, soldResultIds),
            auctionTargetPriorities: removeResolvedAuctionTargets(auctionTargetPriorities, soldResultIds),
            isPaused: true,
            skipSetSummary: {
              setIndex: auction.currentSetIndex,
              setName: currentSet.name,
              results,
            },
            auction: {
              ...auction,
              sets: updatedSets,
              currentLotIndex,
              soldPlayerIds: newSoldIds,
              unsoldPlayerIds: newUnsoldIds,
              saleHistory: newSaleHistory,
              teamPurses: updatedPurses,
              soldFlash: null,
              unsoldFlash: null,
              rtm: null,
            },
          });
        }
      },

      skipAllAuction: () => {
        const state = get();
        const { auction, players, teams, userTeamId, auctionTargets, auctionTargetPriorities } = state;
        if (!auction || auction.phase !== "live") return;

        _hammerLotId = null;

        const newTeams = { ...teams };
        const newPlayers = { ...players };
        let newSoldIds = [...(auction.soldPlayerIds ?? [])];
        let newUnsoldIds = [...(auction.unsoldPlayerIds ?? [])];
        let newSaleHistory = [...(auction.saleHistory ?? [])];
        let currentLotIndex = auction.currentLotIndex;
        const totalLots = auction.allPlayerIds.length;
        const targetResults = new Map<string, SkipSetResultItem>();
        let userPurchasesDuringSkip = 0;

        // Gather all remaining players across all remaining sets
        const remainingPlayerIds: string[] = [];
        
        // 1. Current set remaining players
        const currentSet = auction.sets[auction.currentSetIndex];
        if (currentSet && !currentSet.isCompleted) {
          remainingPlayerIds.push(...currentSet.playerIds.slice(currentSet.currentIndex));
        }

        // 2. Future sets players
        for (let i = auction.currentSetIndex + 1; i < auction.sets.length; i++) {
          remainingPlayerIds.push(...auction.sets[i].playerIds);
        }

        const pendingTargetIds = new Set(remainingPlayerIds.filter((id) => auctionTargets[id] !== undefined));
        let isFirstProcessed = true;
        const simulateOne = (playerId: string) => {
          const player = newPlayers[playerId];
          if (!player) return;

          const isCurrentLiveLot = isFirstProcessed && auction.currentPlayer?.id === player.id;
          isFirstProcessed = false;
          resetLotCache();

          const ctx: AuctionContext = {
            remainingPlayerIds: auction.allPlayerIds.filter(
              (id) => !newSoldIds.includes(id) && id !== player.id
            ),
            soldPlayerIds: newSoldIds,
            currentLotIndex,
            totalLots,
            isAcceleratedPhase: auction.isAcceleratedPhase,
            auctionType: auction.type,
          };

          let currentBid = isCurrentLiveLot ? auction.currentBid : player.basePrice;
          let highBidderTeamId: string | null = isCurrentLiveLot
            ? auction.currentHighBidderTeamId
            : null;
          let biddingHistory: BidEntry[] = isCurrentLiveLot
            ? [...auction.biddingHistory]
            : [];

          let iterations = 0;
          const MAX_ITER = 300;
          const targetMaxBid = auctionTargets[player.id];
          const targetPriority = auctionTargetPriorities[player.id] ?? "medium";
          pendingTargetIds.delete(player.id);
          const protectedTargetReserve = getProtectedTargetReserve(
            player.id, pendingTargetIds, auctionTargets, auctionTargetPriorities, newTeams[userTeamId], newPlayers
          );
          while (iterations < MAX_ITER) {
            iterations++;
            const nextBid: number = highBidderTeamId ? getNextBidAmount(currentBid) : currentBid;

            const interested: Team[] = Object.values(newTeams).filter((t: Team): boolean => {
              if (t.id === highBidderTeamId) return false;
              return canTeamBidDuringSkip(t, player, nextBid, player.id, newPlayers, ctx, userTeamId, targetMaxBid, protectedTargetReserve, true);
            });

            if (interested.length === 0) break;

            const bidder: Team | null | undefined = interested.find((team: Team) => team.id === userTeamId && targetMaxBid !== undefined)
              ?? pickBiddingTeam(interested, player, player.id, newPlayers, ctx);
            if (!bidder) break;

            currentBid = nextBid;
            highBidderTeamId = bidder.id;
            biddingHistory = [{ teamId: bidder.id, amount: nextBid, timestamp: Date.now() }, ...biddingHistory];
          }

          if (!highBidderTeamId) {
            newUnsoldIds.push(player.id);
            if (targetMaxBid !== undefined) {
              targetResults.set(player.id, {
                player,
                status: "unsold",
                targetMissReason: getTargetBidBlockReason(
                  newTeams[userTeamId], player, player.basePrice, newPlayers, userPurchasesDuringSkip > 0, protectedTargetReserve
                ) ?? "Too expensive",
              });
            }
          } else {
            let finalWinnerId = highBidderTeamId;
            let finalPrice = currentBid;
            let usedRtm = false;

            const rtmTeamId = findRTMEligibleTeam(player, newTeams, highBidderTeamId, currentBid);

            if (rtmTeamId) {
              const rtmTeam = newTeams[rtmTeamId];
              const aiOrigValuation = rtmTeamId === userTeamId && targetMaxBid !== undefined
                ? targetMaxBid
                : getCachedValuation(rtmTeamId) || getLotValuation(player.id, rtmTeam, player, newPlayers, ctx);
              const loyaltyBonus = 1.0 + (rtmTeam?.dna.loyalty ?? 50) / 100 * 0.25;
              const rtmCeiling = rtmTeamId === userTeamId ? aiOrigValuation : aiOrigValuation * loyaltyBonus;

              if (rtmCeiling >= currentBid && canAffordTargetRtm(rtmTeam, currentBid, newPlayers, rtmTeamId === userTeamId, targetPriority, protectedTargetReserve)) {
                const winnerTeam = newTeams[highBidderTeamId];
                const aiWinnerValuation = getCachedValuation(highBidderTeamId) || getLotValuation(player.id, winnerTeam, player, newPlayers, ctx);

                if (aiWinnerValuation > currentBid * 1.05 && winnerTeam.remainingPurse >= currentBid * 1.05) {
                  let counterAmount = currentBid;
                  const target = Math.min(aiWinnerValuation, Math.round(currentBid * 1.25));
                  while (counterAmount < target) counterAmount = getNextBidAmount(counterAmount);
                  if (counterAmount <= currentBid) counterAmount = getNextBidAmount(currentBid);

                  if (rtmCeiling >= counterAmount && canAffordTargetRtm(rtmTeam, counterAmount, newPlayers, rtmTeamId === userTeamId, targetPriority, protectedTargetReserve)) {
                    finalWinnerId = rtmTeamId;
                    finalPrice = counterAmount;
                    usedRtm = true;
                  } else {
                    finalWinnerId = highBidderTeamId;
                    finalPrice = counterAmount;
                  }
                } else {
                  finalWinnerId = rtmTeamId;
                  finalPrice = currentBid;
                  usedRtm = true;
                }
              }
            }

            if (finalWinnerId === userTeamId && targetMaxBid !== undefined && rtmTeamId &&
                (finalPrice > targetMaxBid || (targetPriority !== "high" && newTeams[userTeamId].remainingPurse - finalPrice < protectedTargetReserve))) {
              finalWinnerId = rtmTeamId;
              finalPrice = currentBid;
              usedRtm = true;
            }

            const winnerTeam = newTeams[finalWinnerId];
            if (winnerTeam) {
              newTeams[finalWinnerId] = {
                ...winnerTeam,
                squad: [...winnerTeam.squad, player.id],
                remainingPurse: winnerTeam.remainingPurse - finalPrice,
                spentAmount: winnerTeam.spentAmount + finalPrice,
                rtmCardsUsed: usedRtm ? winnerTeam.rtmCardsUsed + 1 : winnerTeam.rtmCardsUsed,
                overseasPlayersCurrent:
                  player.nationality === "Overseas"
                    ? winnerTeam.overseasPlayersCurrent + 1
                    : winnerTeam.overseasPlayersCurrent,
              };
            }

            const updatedHistory = [
              ...player.iplHistory.filter((h) => h.season !== getActiveSeasonYear()),
              { teamId: finalWinnerId, season: getActiveSeasonYear(), price: finalPrice, isRtm: usedRtm },
            ];

            newPlayers[player.id] = {
              ...player,
              currentTeamId: finalWinnerId,
              iplHistory: updatedHistory,
            };

            newSoldIds.push(player.id);

            newSaleHistory.push({
              playerId: player.id,
              teamId: finalWinnerId,
              price: finalPrice,
              lot: currentLotIndex,
              bids: biddingHistory,
            });

            if (targetMaxBid !== undefined) {
              let targetMissReason: string | undefined;
              if (finalWinnerId !== userTeamId) {
                if (targetPriority !== "high" && newTeams[userTeamId].remainingPurse - finalPrice < protectedTargetReserve) {
                  targetMissReason = "Funds reserved for higher-priority targets";
                } else if (usedRtm && finalPrice <= targetMaxBid) {
                  targetMissReason = `${newTeams[finalWinnerId]?.name ?? finalWinnerId} exercised RTM`;
                } else if (finalPrice > targetMaxBid) {
                  targetMissReason = "Too expensive";
                } else {
                  targetMissReason = getTargetBidBlockReason(
                    newTeams[userTeamId], player, currentBid, newPlayers, userPurchasesDuringSkip > 0, protectedTargetReserve
                  ) ?? "Too expensive";
                }
              }
              targetResults.set(player.id, {
                player: newPlayers[player.id],
                status: "sold",
                teamId: finalWinnerId,
                price: finalPrice,
                usedRtm,
                targetMissReason,
              });
              if (finalWinnerId === userTeamId) userPurchasesDuringSkip++;
            }
          }
          currentLotIndex++;
        };

        // Simulate all remaining players in regular sets
        remainingPlayerIds.forEach(simulateOne);

        const updatedSets = auction.sets.map((s) => ({
          ...s,
          currentIndex: s.playerIds.length,
          isCompleted: true,
        }));

        // Now run the automated accelerated simulation loop until no more progress is made
        let currentPass = 1;
        let lastUnsoldCount = newUnsoldIds.length;
        let madeProgress = true;

        while (newUnsoldIds.length > 0 && madeProgress && currentPass === 1) {
          const playersToSimulate = [...newUnsoldIds];
          newUnsoldIds = []; // Clear for the current round's unsold players
          
          playersToSimulate.forEach((playerId) => {
            const player = newPlayers[playerId];
            if (!player) return;

            const ctx: AuctionContext = {
              remainingPlayerIds: playersToSimulate.filter(id => id !== player.id),
              soldPlayerIds: newSoldIds,
              currentLotIndex,
              totalLots,
              isAcceleratedPhase: true,
              acceleratedPass: currentPass,
              auctionType: auction.type,
            };

            let currentBid = player.basePrice;
            let highBidderTeamId: string | null = null;
            let biddingHistory: BidEntry[] = [];

            let iterations = 0;
            const MAX_ITER = 300;
            
            const targetMaxBid = undefined;
            const targetPriority = "medium";
            const protectedTargetReserve = 0;

            while (iterations < MAX_ITER) {
              iterations++;
              const nextBid: number = highBidderTeamId ? getNextBidAmount(currentBid) : currentBid;

              const interested: Team[] = Object.values(newTeams).filter((t: Team): boolean => {
                if (t.id === highBidderTeamId) return false;
                return canTeamBidDuringSkip(t, player, nextBid, player.id, newPlayers, ctx, userTeamId, targetMaxBid, protectedTargetReserve, true);
              });

              if (interested.length === 0) break;

              const bidder: Team | null | undefined = pickBiddingTeam(interested, player, player.id, newPlayers, ctx);
              if (!bidder) break;

              currentBid = nextBid;
              highBidderTeamId = bidder.id;
              biddingHistory = [{ teamId: bidder.id, amount: nextBid, timestamp: Date.now() }, ...biddingHistory];
            }

            if (!highBidderTeamId) {
              newUnsoldIds.push(player.id);
            } else {
              const winnerTeam = newTeams[highBidderTeamId];
              newTeams[highBidderTeamId] = {
                ...winnerTeam,
                squad: [...winnerTeam.squad, player.id],
                remainingPurse: winnerTeam.remainingPurse - currentBid,
                spentAmount: winnerTeam.spentAmount + currentBid,
                overseasPlayersCurrent:
                  player.nationality === "Overseas"
                    ? winnerTeam.overseasPlayersCurrent + 1
                    : winnerTeam.overseasPlayersCurrent,
              };

              newPlayers[player.id] = {
                ...player,
                currentTeamId: highBidderTeamId,
                iplHistory: [
                  ...player.iplHistory.filter((h) => h.season !== getActiveSeasonYear()),
                  { teamId: highBidderTeamId, season: getActiveSeasonYear(), price: currentBid, isRtm: false },
                ],
              };

              newSoldIds.push(player.id);

              newSaleHistory.push({
                playerId: player.id,
                teamId: highBidderTeamId,
                price: currentBid,
                lot: currentLotIndex,
                bids: biddingHistory,
              });
            }
            currentLotIndex++;
          });

          madeProgress = newUnsoldIds.length < lastUnsoldCount;
          lastUnsoldCount = newUnsoldIds.length;
          currentPass++;
        }

        // Fill remaining slots to target sizes
        ensureMinimumSquadSizes(newTeams, newPlayers, true);

        const updatedPurses: Record<string, { remaining: number; squadCount: number }> = {};
        Object.values(newTeams).forEach((t) => {
          updatedPurses[t.id] = { remaining: t.remainingPurse, squadCount: t.squad.length };
        });

        set({
          teams: newTeams,
          players: newPlayers,
          auctionTargets: {},
          auctionTargetPriorities: {},
          isPaused: false,
          acceleratedPlanningState: null,
          userAcceleratedTargets: [],
          aiAcceleratedTargets: {},
          aiAcceleratedBackups: {},
          skipSetSummary: null,
          auction: {
            ...auction,
            sets: updatedSets,
            phase: "completed",
            currentLotIndex,
            currentPlayer: null,
            soldPlayerIds: newSoldIds,
            unsoldPlayerIds: newUnsoldIds,
            saleHistory: newSaleHistory,
            teamPurses: updatedPurses,
            soldFlash: null,
            unsoldFlash: null,
          },
        });
        get().processCompletedAuctionCareer();
      },

      skipToAcceleratedAuction: () => {
        const state = get();
        const { auction, players, teams, userTeamId, auctionTargets, auctionTargetPriorities } = state;
        if (!auction || auction.phase !== "live") return;

        _hammerLotId = null;

        const newTeams = { ...teams };
        const newPlayers = { ...players };
        let newSoldIds = [...(auction.soldPlayerIds ?? [])];
        let newUnsoldIds = [...(auction.unsoldPlayerIds ?? [])];
        let newSaleHistory = [...(auction.saleHistory ?? [])];
        let currentLotIndex = auction.currentLotIndex;
        const totalLots = auction.allPlayerIds.length;

        const remainingPlayerIds: string[] = [];

        const currentSet = auction.sets[auction.currentSetIndex];
        if (currentSet && !currentSet.isCompleted) {
          remainingPlayerIds.push(...currentSet.playerIds.slice(currentSet.currentIndex));
        }

        for (let i = auction.currentSetIndex + 1; i < auction.sets.length; i++) {
          remainingPlayerIds.push(...auction.sets[i].playerIds);
        }

        const pendingTargetIds = new Set(remainingPlayerIds.filter((id) => auctionTargets[id] !== undefined));
        let isFirstProcessed = true;
        const simulateOne = (playerId: string) => {
          const player = newPlayers[playerId];
          if (!player) return;

          const isCurrentLiveLot = isFirstProcessed && auction.currentPlayer?.id === player.id;
          isFirstProcessed = false;
          resetLotCache();

          const ctx: AuctionContext = {
            remainingPlayerIds: auction.allPlayerIds.filter(
              (id) => !newSoldIds.includes(id) && id !== player.id
            ),
            soldPlayerIds: newSoldIds,
            currentLotIndex,
            totalLots,
            isAcceleratedPhase: auction.isAcceleratedPhase,
            auctionType: auction.type,
          };

          let currentBid = isCurrentLiveLot ? auction.currentBid : player.basePrice;
          let highBidderTeamId: string | null = isCurrentLiveLot
            ? auction.currentHighBidderTeamId
            : null;
          let biddingHistory: BidEntry[] = isCurrentLiveLot
            ? [...auction.biddingHistory]
            : [];

          let iterations = 0;
          const MAX_ITER = 300;
          const targetMaxBid = auctionTargets[player.id];
          const targetPriority = auctionTargetPriorities[player.id] ?? "medium";
          pendingTargetIds.delete(player.id);
          const protectedTargetReserve = getProtectedTargetReserve(
            player.id, pendingTargetIds, auctionTargets, auctionTargetPriorities, newTeams[userTeamId], newPlayers
          );
          while (iterations < MAX_ITER) {
            iterations++;
            const nextBid: number = highBidderTeamId ? getNextBidAmount(currentBid) : currentBid;

            const interested: Team[] = Object.values(newTeams).filter((t: Team): boolean => {
              if (t.id === highBidderTeamId) return false;
              return canTeamBidDuringSkip(t, player, nextBid, player.id, newPlayers, ctx, userTeamId, targetMaxBid, protectedTargetReserve);
            });

            if (interested.length === 0) break;

            const bidder: Team | null | undefined = interested.find((team: Team) => team.id === userTeamId && targetMaxBid !== undefined)
              ?? pickBiddingTeam(interested, player, player.id, newPlayers, ctx);
            if (!bidder) break;

            currentBid = nextBid;
            highBidderTeamId = bidder.id;
            biddingHistory = [{ teamId: bidder.id, amount: nextBid, timestamp: Date.now() }, ...biddingHistory];
          }

          if (!highBidderTeamId) {
            newUnsoldIds.push(player.id);
          } else {
            let finalWinnerId = highBidderTeamId;
            let finalPrice = currentBid;
            let usedRtm = false;

            const rtmTeamId = findRTMEligibleTeam(player, newTeams, highBidderTeamId, currentBid);

            if (rtmTeamId) {
              const rtmTeam = newTeams[rtmTeamId];
              const aiOrigValuation = rtmTeamId === userTeamId && targetMaxBid !== undefined
                ? targetMaxBid
                : getCachedValuation(rtmTeamId) || getLotValuation(player.id, rtmTeam, player, newPlayers, ctx);
              const loyaltyBonus = 1.0 + (rtmTeam?.dna.loyalty ?? 50) / 100 * 0.25;
              const rtmCeiling = rtmTeamId === userTeamId ? aiOrigValuation : aiOrigValuation * loyaltyBonus;

              if (rtmCeiling >= currentBid && canAffordTargetRtm(rtmTeam, currentBid, newPlayers, rtmTeamId === userTeamId, targetPriority, protectedTargetReserve)) {
                const winnerTeam = newTeams[highBidderTeamId];
                const aiWinnerValuation = getCachedValuation(highBidderTeamId) || getLotValuation(player.id, winnerTeam, player, newPlayers, ctx);

                if (aiWinnerValuation > currentBid * 1.05 && winnerTeam.remainingPurse >= currentBid * 1.05) {
                  let counterAmount = currentBid;
                  const target = Math.min(aiWinnerValuation, Math.round(currentBid * 1.25));
                  while (counterAmount < target) counterAmount = getNextBidAmount(counterAmount);
                  if (counterAmount <= currentBid) counterAmount = getNextBidAmount(currentBid);

                  if (rtmCeiling >= counterAmount && canAffordTargetRtm(rtmTeam, counterAmount, newPlayers, rtmTeamId === userTeamId, targetPriority, protectedTargetReserve)) {
                    finalWinnerId = rtmTeamId;
                    finalPrice = counterAmount;
                    usedRtm = true;
                  } else {
                    finalWinnerId = highBidderTeamId;
                    finalPrice = counterAmount;
                  }
                } else {
                  finalWinnerId = rtmTeamId;
                  finalPrice = currentBid;
                  usedRtm = true;
                }
              }
            }

            if (finalWinnerId === userTeamId && targetMaxBid !== undefined && rtmTeamId &&
                (finalPrice > targetMaxBid || (targetPriority !== "high" && newTeams[userTeamId].remainingPurse - finalPrice < protectedTargetReserve))) {
              finalWinnerId = rtmTeamId;
              finalPrice = currentBid;
              usedRtm = true;
            }

            const winnerTeam = newTeams[finalWinnerId];
            if (winnerTeam) {
              newTeams[finalWinnerId] = {
                ...winnerTeam,
                squad: [...winnerTeam.squad, player.id],
                remainingPurse: winnerTeam.remainingPurse - finalPrice,
                spentAmount: winnerTeam.spentAmount + finalPrice,
                rtmCardsUsed: usedRtm ? winnerTeam.rtmCardsUsed + 1 : winnerTeam.rtmCardsUsed,
                overseasPlayersCurrent:
                  player.nationality === "Overseas"
                    ? winnerTeam.overseasPlayersCurrent + 1
                    : winnerTeam.overseasPlayersCurrent,
              };
            }

            const updatedHistory = [
              ...player.iplHistory.filter((h) => h.season !== getActiveSeasonYear()),
              { teamId: finalWinnerId, season: getActiveSeasonYear(), price: finalPrice, isRtm: usedRtm },
            ];

            newPlayers[player.id] = {
              ...player,
              currentTeamId: finalWinnerId,
              iplHistory: updatedHistory,
            };

            newSoldIds.push(player.id);

            newSaleHistory.push({
              playerId: player.id,
              teamId: finalWinnerId,
              price: finalPrice,
              lot: currentLotIndex,
              bids: biddingHistory,
            });
          }
          currentLotIndex++;
        };

        remainingPlayerIds.forEach(simulateOne);

        // The user must enter accelerated planning with the official minimum
        // squad. Prefer the cheapest unsold legal backups and preserve ₹2 Cr
        // whenever the available purse makes that possible.
        const userTeam = newTeams[userTeamId];
        if (userTeam && userTeam.squad.length < (userTeam.minSquadSize ?? 18)) {
          const minimum = userTeam.minSquadSize ?? 18;
          const required = minimum - userTeam.squad.length;
          const candidates = Array.from(new Set(newUnsoldIds))
            .map(id => newPlayers[id])
            .filter((candidate): candidate is Player =>
              !!candidate && !candidate.currentTeamId &&
              canTeamBidOnPlayer(newTeams[userTeamId], candidate, newPlayers, false).canBid
            )
            .sort((a, b) => (a.basePrice - b.basePrice) || (ratingOf(b) - ratingOf(a)));
          const cheapestRequired = candidates.slice(0, required);
          const canPreserveTwoCrore = cheapestRequired.length === required &&
            cheapestRequired.reduce((total, candidate) => total + candidate.basePrice, 0) <= userTeam.remainingPurse - 200;

          for (const candidate of candidates) {
            const currentUserTeam = newTeams[userTeamId];
            if (currentUserTeam.squad.length >= minimum) break;
            if (candidate.basePrice > currentUserTeam.remainingPurse) continue;
            if (currentUserTeam.remainingPurse - candidate.basePrice < 50) continue;
            if (canPreserveTwoCrore && currentUserTeam.remainingPurse - candidate.basePrice < 200) continue;
            if (!canTeamBidOnPlayer(currentUserTeam, candidate, newPlayers, false).canBid) continue;

            newTeams[userTeamId] = {
              ...currentUserTeam,
              squad: [...currentUserTeam.squad, candidate.id],
              remainingPurse: currentUserTeam.remainingPurse - candidate.basePrice,
              spentAmount: currentUserTeam.spentAmount + candidate.basePrice,
              overseasPlayersCurrent: candidate.nationality === "Overseas"
                ? currentUserTeam.overseasPlayersCurrent + 1
                : currentUserTeam.overseasPlayersCurrent,
            };
            newPlayers[candidate.id] = {
              ...candidate,
              currentTeamId: userTeamId,
              iplHistory: [
                ...candidate.iplHistory.filter(history => history.season !== getActiveSeasonYear()),
                { teamId: userTeamId, season: getActiveSeasonYear(), price: candidate.basePrice, isRtm: false },
              ],
            };
            newSoldIds.push(candidate.id);
            newUnsoldIds = newUnsoldIds.filter(id => id !== candidate.id);
            newSaleHistory.push({
              playerId: candidate.id,
              teamId: userTeamId,
              price: candidate.basePrice,
              lot: currentLotIndex++,
              bids: [{ teamId: userTeamId, amount: candidate.basePrice, timestamp: Date.now() }],
            });
          }
        }

        const updatedSets = auction.sets.map((s) => ({
          ...s,
          currentIndex: s.playerIds.length,
          isCompleted: true,
        }));

        _lastAccelUnsoldCount = newUnsoldIds.length;
        const unsoldPlayers = newUnsoldIds
          .map((id) => newPlayers[id])
          .filter(Boolean);

        const updatedPurses: Record<string, { remaining: number; squadCount: number }> = {};
        Object.values(newTeams).forEach((t) => {
          updatedPurses[t.id] = { remaining: t.remainingPurse, squadCount: t.squad.length };
        });

        if (unsoldPlayers.length > 0) {
          const soldDuringSkipIds = remainingPlayerIds.filter((id) => newSoldIds.includes(id));
          set({
            teams: newTeams,
            players: newPlayers,
            auctionTargets: removeResolvedAuctionTargets(auctionTargets, soldDuringSkipIds),
            auctionTargetPriorities: removeResolvedAuctionTargets(auctionTargetPriorities, soldDuringSkipIds),
            isPaused: true,
            acceleratedPlanningState: 'nominating',
            userAcceleratedTargets: [],
            aiAcceleratedTargets: {},
            aiAcceleratedBackups: {},
            skipSetSummary: remainingPlayerIds.length > 0 ? {
              setIndex: -1,
              setName: "Simulation Results",
              results: remainingPlayerIds.map((id) => {
                const p = newPlayers[id];
                const wasSold = newSoldIds.includes(id);
                const historyEntry = p.iplHistory.find((h) => h.season === getActiveSeasonYear());
                return {
                  player: p,
                  status: wasSold ? "sold" as const : "unsold" as const,
                  price: wasSold && historyEntry ? historyEntry.price : undefined,
                  teamId: wasSold && p.currentTeamId ? p.currentTeamId : undefined,
                  usedRtm: wasSold && historyEntry ? historyEntry.isRtm : false,
                };
              }),
            } : null,
            auction: {
              ...auction,
              sets: updatedSets,
              currentSetIndex: auction.sets.length - 1,
              currentLotIndex,
              currentPlayer: null,
              soldPlayerIds: newSoldIds,
              unsoldPlayerIds: newUnsoldIds,
              saleHistory: newSaleHistory,
              teamPurses: updatedPurses,
              soldFlash: null,
              unsoldFlash: null,
              rtm: null,
            },
          });
        } else {
          ensureMinimumSquadSizes(newTeams, newPlayers);
          const updatedPurses: Record<string, { remaining: number; squadCount: number }> = {};
          Object.values(newTeams).forEach((t) => {
            updatedPurses[t.id] = { remaining: t.remainingPurse, squadCount: t.squad.length };
          });
          set({
            teams: newTeams,
            players: newPlayers,
            auctionTargets: removeResolvedAuctionTargets(auctionTargets, remainingPlayerIds),
            auctionTargetPriorities: removeResolvedAuctionTargets(auctionTargetPriorities, remainingPlayerIds),
            isPaused: false,
            skipSetSummary: null,
            auction: {
              ...auction,
              sets: updatedSets,
              phase: "completed",
              currentLotIndex,
              currentPlayer: null,
              soldPlayerIds: newSoldIds,
              unsoldPlayerIds: [],
              saleHistory: newSaleHistory,
              teamPurses: updatedPurses,
              soldFlash: null,
              unsoldFlash: null,
              rtm: null,
            },
          });
          get().processCompletedAuctionCareer();
        }
      },

      setClubFigureTierOverride: (figureId, tier) => {
        set((state) => ({
          clubFigureTierOverrides: {
            ...state.clubFigureTierOverrides,
            [figureId]: tier,
          },
        }));
      },

      setHomePitchSelection: (teamId, pitchId) => {
        const stadium = getHomeStadium(teamId);
        if (!stadium) return;
        set((state) => {
          const customPitches = state.customPitchesByTeam[stadium.teamId] ?? [];
          const isCustomPitch = customPitches.some((pitch) => pitch.id === pitchId);
          const project = state.pitchProjectsByTeam[stadium.teamId];
          const isBeingDestroyed = project?.kind === "destroy" && project.pitchId === pitchId;
          if (
            (!isPitchRegisteredForTeam(teamId, pitchId) && !isCustomPitch)
            || isBeingDestroyed
          ) return state;
          return {
            homePitchSelections: normalizeHomePitchSelections(
              {
                ...state.homePitchSelections,
                [teamId]: pitchId,
              },
              getAdditionalHomePitchIds(state.customPitchesByTeam),
            ),
          };
        });
      },

      setHomeBoundaryDimensions: (teamId, dimensions) => {
        const stadium = getHomeStadium(teamId);
        if (!stadium) return;
        set((state) => ({
          homeBoundaryDimensions: normalizeHomeBoundaryDimensions({
            ...state.homeBoundaryDimensions,
            [stadium.teamId]: {
              ...state.homeBoundaryDimensions[stadium.teamId],
              ...dimensions,
            },
          }),
        }));
      },

      saveBoundaryPreset: (teamId, name, dimensions) => {
        const stadium = getHomeStadium(teamId);
        const state = get();
        const trimmedName = name.trim().slice(0, 32);
        if (!stadium || teamId !== state.userTeamId || !trimmedName) return null;
        const normalizedDimensions = normalizeHomeBoundaryDimensions({
          ...state.homeBoundaryDimensions,
          [stadium.teamId]: dimensions,
        })[stadium.teamId];
        const existing = (state.boundaryPresetsByTeam[stadium.teamId] ?? [])
          .find((preset) => preset.name.toLocaleLowerCase("en-GB") === trimmedName.toLocaleLowerCase("en-GB"));
        const preset: BoundaryPreset = {
          id: existing?.id ?? `boundary-preset-${uuidv4()}`,
          teamId: stadium.teamId,
          name: trimmedName,
          dimensions: normalizedDimensions,
          createdOn: existing?.createdOn ?? state.currentDate,
        };
        set((current) => ({
          boundaryPresetsByTeam: {
            ...current.boundaryPresetsByTeam,
            [stadium.teamId]: [
              ...(current.boundaryPresetsByTeam[stadium.teamId] ?? [])
                .filter((candidate) => candidate.id !== preset.id),
              preset,
            ],
          },
        }));
        return preset.id;
      },

      applyBoundaryPreset: (teamId, presetId) => {
        const stadium = getHomeStadium(teamId);
        const state = get();
        if (!stadium || teamId !== state.userTeamId) return false;
        const preset = (state.boundaryPresetsByTeam[stadium.teamId] ?? [])
          .find((candidate) => candidate.id === presetId);
        if (!preset) return false;
        state.setHomeBoundaryDimensions(stadium.teamId, preset.dimensions);
        return true;
      },

      deleteBoundaryPreset: (teamId, presetId) => {
        const stadium = getHomeStadium(teamId);
        const state = get();
        if (!stadium || teamId !== state.userTeamId) return false;
        const presets = state.boundaryPresetsByTeam[stadium.teamId] ?? [];
        if (!presets.some((preset) => preset.id === presetId)) return false;
        set((current) => ({
          boundaryPresetsByTeam: {
            ...current.boundaryPresetsByTeam,
            [stadium.teamId]: presets.filter((preset) => preset.id !== presetId),
          },
        }));
        return true;
      },

      startOutfieldPreparation: (teamId, target) => {
        const stadium = getHomeStadium(teamId);
        const state = get();
        if (!stadium || teamId !== state.userTeamId || state.outfieldProjectsByTeam[stadium.teamId]) {
          return false;
        }
        const current = state.homeOutfieldSettings[stadium.teamId];
        const normalizedTarget = normalizeOutfieldSettings(target, stadium.teamId);
        if (
          current.grassHeightMm === normalizedTarget.grassHeightMm
          && current.moisturePercent === normalizedTarget.moisturePercent
          && current.firmnessGmax === normalizedTarget.firmnessGmax
        ) return false;
        const timing = calculateOutfieldPreparationTiming(
          stadium.teamId,
          current,
          normalizedTarget,
        );
        if (timing.totalDays < 1) return false;
        const project: OutfieldPreparationProject = {
          id: `outfield-project-${uuidv4()}`,
          teamId: stadium.teamId,
          startedOn: state.currentDate,
          completesOn: addDaysToDateKey(state.currentDate, timing.totalDays),
          preparationDays: timing.totalDays,
          target: normalizedTarget,
        };
        set((currentState) => ({
          outfieldProjectsByTeam: {
            ...currentState.outfieldProjectsByTeam,
            [stadium.teamId]: project,
          },
        }));
        return true;
      },

      reconcileOutfieldProjects: () => {
        set((state) => {
          const nextProjects = { ...state.outfieldProjectsByTeam };
          const nextSettings = { ...state.homeOutfieldSettings };
          let changed = false;
          Object.entries(state.outfieldProjectsByTeam).forEach(([teamId, project]) => {
            if (!project || project.completesOn > state.currentDate) return;
            const stadium = getHomeStadium(teamId);
            if (stadium) {
              nextSettings[stadium.teamId] = normalizeOutfieldSettings(
                project.target,
                stadium.teamId,
              );
              delete nextProjects[stadium.teamId];
            } else {
              delete nextProjects[teamId as IplTeamId];
            }
            changed = true;
          });
          if (!changed) return state;
          return {
            homeOutfieldSettings: nextSettings,
            outfieldProjectsByTeam: nextProjects,
          };
        });
      },

      startPitchCreation: (teamId, soil, sliders) => {
        const stadium = getHomeStadium(teamId);
        const state = get();
        if (!stadium || teamId !== state.userTeamId || state.pitchProjectsByTeam[stadium.teamId]) {
          return false;
        }
        const existingCustomPitches = state.customPitchesByTeam[stadium.teamId] ?? [];
        if (stadium.pitches.length + existingCustomPitches.length >= MAX_PITCHES_PER_STADIUM) {
          return false;
        }

        const pitch = deriveCustomPitch({
          id: `custom-pitch-${uuidv4()}`,
          teamId: stadium.teamId,
          stadium,
          soil,
          sliders,
          createdOn: state.currentDate,
        });
        const project: PitchProject = {
          id: `pitch-project-${uuidv4()}`,
          kind: "create",
          teamId: stadium.teamId,
          startedOn: state.currentDate,
          completesOn: addDaysToDateKey(state.currentDate, pitch.creationDays),
          pitch,
        };
        set((current) => ({
          pitchProjectsByTeam: {
            ...current.pitchProjectsByTeam,
            [stadium.teamId]: project,
          },
        }));
        return true;
      },

      startPitchDestruction: (teamId, pitchId) => {
        const stadium = getHomeStadium(teamId);
        const state = get();
        if (!stadium || teamId !== state.userTeamId || state.pitchProjectsByTeam[stadium.teamId]) {
          return false;
        }
        const pitch = (state.customPitchesByTeam[stadium.teamId] ?? [])
          .find((candidate) => candidate.id === pitchId);
        if (!pitch || state.homePitchSelections[stadium.teamId] === pitchId) return false;

        const project: PitchProject = {
          id: `pitch-project-${uuidv4()}`,
          kind: "destroy",
          teamId: stadium.teamId,
          startedOn: state.currentDate,
          completesOn: addDaysToDateKey(state.currentDate, PITCH_DESTRUCTION_DAYS),
          pitchId,
          pitchName: pitch.name,
        };
        set((current) => ({
          pitchProjectsByTeam: {
            ...current.pitchProjectsByTeam,
            [stadium.teamId]: project,
          },
        }));
        return true;
      },

      reconcilePitchProjects: () => {
        set((state) => {
          const nextProjects = { ...state.pitchProjectsByTeam };
          const nextCustomPitches: Partial<Record<IplTeamId, CustomCuratorPitch[]>> = Object.fromEntries(
            Object.entries(state.customPitchesByTeam).map(([teamId, pitches]) => [
              teamId,
              [...(pitches ?? [])],
            ]),
          );
          let changed = false;

          Object.entries(state.pitchProjectsByTeam).forEach(([teamId, project]) => {
            if (!project || project.completesOn > state.currentDate) return;
            const stadium = getHomeStadium(teamId);
            if (!stadium) {
              delete nextProjects[teamId as IplTeamId];
              changed = true;
              return;
            }
            const customPitches = nextCustomPitches[stadium.teamId] ?? [];
            if (project.kind === "create") {
              const hasCapacity = stadium.pitches.length + customPitches.length < MAX_PITCHES_PER_STADIUM;
              const alreadyExists = customPitches.some((pitch) => pitch.id === project.pitch.id);
              if (hasCapacity && !alreadyExists) {
                nextCustomPitches[stadium.teamId] = [
                  ...customPitches,
                  { ...project.pitch, createdOn: project.completesOn },
                ];
              }
            } else {
              nextCustomPitches[stadium.teamId] = customPitches
                .filter((pitch) => pitch.id !== project.pitchId);
            }
            delete nextProjects[stadium.teamId];
            changed = true;
          });

          if (!changed) return state;
          return {
            customPitchesByTeam: nextCustomPitches,
            pitchProjectsByTeam: nextProjects,
            homePitchSelections: normalizeHomePitchSelections(
              state.homePitchSelections,
              getAdditionalHomePitchIds(nextCustomPitches),
            ),
          };
        });
      },

      recordSimulatedLeagueSeason: (season) => {
        set((state) => ({
          simulatedLeagueHistory: [
            { ...season, source: "career" as const },
            ...state.simulatedLeagueHistory.filter((record) => record.season !== season.season),
          ].sort((left, right) => right.season - left.season),
        }));
      },

      recordIplMatchStats: (updates) => {
        let applied = 0;
        set((state) => {
          const isCurrentTrackingSeason = state.careerIplTrackingSeason === state.currentSeason;
          const processedIplKeys = new Set(
            isCurrentTrackingSeason ? state.careerIplProcessedMatchKeys : [],
          );
          const processedT20Keys = new Set(
            isCurrentTrackingSeason ? state.careerT20ProcessedMatchKeys : [],
          );
          let updatedPlayers = state.players;

          updates.forEach((update) => {
            let appliedThisMatch = false;
            if (!processedIplKeys.has(update.key)) {
              updatedPlayers = applyMatchToIplCareerStats(updatedPlayers, update.simulation);
              processedIplKeys.add(update.key);
              appliedThisMatch = true;
            }
            if (!processedT20Keys.has(update.key)) {
              updatedPlayers = applyMatchToT20CareerStats(updatedPlayers, update.simulation);
              processedT20Keys.add(update.key);
              appliedThisMatch = true;
            }
            if (appliedThisMatch) applied += 1;
          });

          if (applied === 0 && isCurrentTrackingSeason) return state;
          return {
            players: updatedPlayers,
            careerIplProcessedMatchKeys: Array.from(processedIplKeys),
            careerT20ProcessedMatchKeys: Array.from(processedT20Keys),
            careerIplTrackingSeason: state.currentSeason,
          };
        });
        return applied;
      },

      beginNextSeasonRetention: (captainIdsByTeam, requestedAuctionType) => {
        let advanced = false;
        set((state) => {
          if (
            state.lastRolledOverSeason === state.currentSeason
            || (state.auction?.phase === "retention" && state.auction.season === state.currentSeason)
          ) return state;

          const completedSeason = state.currentSeason;
          const nextSeason = completedSeason + 1;
          const nextAuctionType = requestedAuctionType ?? getAuctionTypeForSeason(nextSeason);
          const dates = getSeasonDates(nextSeason);
          const fallbackPostseason = state.lastCareerPostseasonSeason === completedSeason
            ? { players: state.players, teams: state.teams, retirements: [], retiredPlayers: [] }
            : processPostSeasonCareer({
                players: state.players,
                teams: state.teams,
                performance: {},
                completedSeason,
                seed: state.saveId || state.fixtureSeed,
                injuredPlayerIds: new Set(Object.keys(state.activeInjuries)),
              });
          const marketProfile = normalizeAuctionMarketProfile(
            state.auctionMarketProfile,
            Object.values(fallbackPostseason.players),
          );
          const preparedPool = prepareRetentionPlayerPool({
            players: fallbackPostseason.players,
            teams: fallbackPostseason.teams,
            season: nextSeason,
            seed: state.saveId || state.fixtureSeed,
            baselineMarketProfile: marketProfile,
          });
          const careerRetirements = [...fallbackPostseason.retirements, ...preparedPool.retirements];
          const retiredIds = new Set(careerRetirements.map((record) => record.playerId));
          const reconciledInjuries = reconcileInjuryRecoveries({
            activeInjuries: withoutRetiredInjuries(state.activeInjuries, retiredIds),
            injuryHistory: withoutRetiredInjuryHistory(state.injuryHistory, retiredIds),
            processedInjuryMatchIds: state.processedInjuryMatchIds,
            processedInjuryDateKeys: state.processedInjuryDateKeys,
          }, dates.retentionDate).state;
          const miniSquadIds = new Set(Object.values(preparedPool.teams).flatMap((team) => team.squad));
          const resetPlayers = withAdaptiveBasePrices(Object.fromEntries(Object.entries(preparedPool.players).map(([id, player]) => [
            id,
            {
              ...player,
              isRetained: nextAuctionType === "mini" && miniSquadIds.has(id),
              retainedByTeamId: nextAuctionType === "mini" && miniSquadIds.has(id)
                ? player.currentTeamId
                : null,
              iplCaptaincyUninterestedThroughSeason:
                (player.iplCaptaincyUninterestedThroughSeason ?? -1) >= nextSeason
                  ? player.iplCaptaincyUninterestedThroughSeason
                  : undefined,
            },
          ])));
          const resetTeams = Object.fromEntries(Object.entries(preparedPool.teams).map(([id, team]) => [
            id,
            {
              ...team,
              // Preserve the completed squad so the retention screen can
              // choose from it. confirmRetentions releases everyone else.
              retainedPlayers: nextAuctionType === "mini"
                ? team.squad.filter((playerId) => Boolean(resetPlayers[playerId]))
                : [],
              captainContinuityId: captainIdsByTeam
                ? (captainIdsByTeam[id] && resetPlayers[captainIdsByTeam[id]!] ? captainIdsByTeam[id] : null)
                : (team.captainContinuityId && resetPlayers[team.captainContinuityId] ? team.captainContinuityId : null),
              viceCaptainContinuityId: team.viceCaptainContinuityId && resetPlayers[team.viceCaptainContinuityId]
                ? team.viceCaptainContinuityId
                : null,
              totalPurse: nextAuctionType === "mini" ? MINI_AUCTION_PURSE_LAKHS : TOTAL_PURSE_LAKHS,
              remainingPurse: nextAuctionType === "mini"
                ? Math.max(0, MINI_AUCTION_PURSE_LAKHS - calculateMiniAuctionKeptSalary(
                    team.squad.filter((playerId) => Boolean(resetPlayers[playerId])),
                    team.id,
                    resetPlayers,
                    nextSeason,
                  ))
                : TOTAL_PURSE_LAKHS,
              spentAmount: nextAuctionType === "mini"
                ? calculateMiniAuctionKeptSalary(
                    team.squad.filter((playerId) => Boolean(resetPlayers[playerId])),
                    team.id,
                    resetPlayers,
                    nextSeason,
                  )
                : 0,
              rtmCardsTotal: nextAuctionType === "mini" ? 0 : MAX_TOTAL_RETENTIONS,
              softSquadTarget: id === state.userTeamId ? 24 : pickSoftSquadTarget(),
            },
          ]));
          advanced = true;
          return {
            currentSeason: nextSeason,
            currentDate: dates.retentionDate,
            auctionCycle: state.auctionCycle + 1,
            fixtureSeed: uuidv4(),
            players: resetPlayers,
            teams: resetTeams,
            auction: {
              type: nextAuctionType,
              season: nextSeason,
              phase: "retention",
              allPlayerIds: [],
              soldPlayerIds: [],
              unsoldPlayerIds: [],
              currentLotIndex: 0,
              currentPlayer: null,
              currentBid: 0,
              currentHighBidderTeamId: null,
              biddingHistory: [],
              timerSeconds: 10,
              sets: [],
              currentSetIndex: 0,
              teamPurses: {},
              isAcceleratedPhase: false,
              rtm: null,
              soldFlash: null,
              unsoldFlash: null,
              saleHistory: [],
            },
            isSetupComplete: false,
            isPaused: false,
            skipSetSummary: null,
            auctionTargets: {},
            auctionTargetPriorities: {},
            acceleratedPlanningState: null,
            userAcceleratedTargets: [],
            aiAcceleratedTargets: {},
            aiAcceleratedBackups: {},
            lastRolledOverSeason: completedSeason,
            careerIplProcessedMatchKeys: [],
            careerT20ProcessedMatchKeys: [],
            careerIplTrackingSeason: nextSeason,
            activeInjuries: reconciledInjuries.activeInjuries,
            injuryHistory: [],
            processedInjuryMatchIds: [],
            processedInjuryDateKeys: [],
            // Trade records are scoped to the active season's trade window.
            // Start the new retention phase with a clean ledger so prior-season
            // completed trades do not appear in the current season's history.
            tradeRecords: [],
            tradeOffers: [],
            processedAITradeDateKeys: state.processedAITradeDateKeys,
            auctionMarketProfile: marketProfile,
            retiredPlayerSnapshots: appendHistoricalRetirees(
              appendHistoricalRetirees(
                state.retiredPlayerSnapshots,
                fallbackPostseason,
                getReferencedRecordPlayerIds(state.players, state.careerSeasonArchives),
              ),
              preparedPool,
              getReferencedRecordPlayerIds(state.players, state.careerSeasonArchives),
            ),
            lastCareerPostseasonSeason: completedSeason,
            lastCareerAgedSeason: nextSeason,
            lastCareerAuctionProcessedSeason: null,
            pendingRetirementIntake: 0,
            lastCareerRetirements: careerRetirements,
            careerRetirementHistory: [
              ...state.careerRetirementHistory,
              ...careerRetirements,
            ].filter((record, index, records) => records.findIndex((candidate) => candidate.playerId === record.playerId && candidate.season === record.season) === index),
            lastCareerGeneratedPlayerIds: preparedPool.generatedPlayers.map((player) => player.id),
          };
        });
        return advanced;
      },

      archiveCareerSeason: (archive) => {
        set((state) => {
          const compactArchive = { ...archive, playerStats: {} };
          const careerSeasonArchives = [
            compactArchive,
            ...state.careerSeasonArchives.filter((record) => record.season !== archive.season),
          ].sort((left, right) => right.season - left.season);
          if (state.lastCareerPostseasonSeason === archive.season) return { careerSeasonArchives };

          // Keep a compact per-season contribution on the player's history.
          // The full fixture archive is intentionally compacted for storage,
          // but profiles must still be able to show a player's 2027/2028/etc.
          // output after the live fixtures have rolled over.
          const archivedSeason = String(archive.season);
          const archivedStats = archive.playerStats as Record<string, {
            matches?: number;
            runs?: number;
            balls?: number;
            wickets?: number;
            runsConceded?: number;
            oversBowled?: number;
          }>;
          const playersWithSeasonStats = Object.fromEntries(Object.entries(state.players).map(([id, player]) => {
            const stats = archivedStats[id];
            if (!stats) return [id, player];
            const seasonStats = {
              matches: stats.matches ?? 0,
              runs: stats.runs ?? 0,
              balls: stats.balls ?? 0,
              wickets: stats.wickets ?? 0,
              runsConceded: stats.runsConceded ?? 0,
              oversBowled: stats.oversBowled ?? 0,
            };
            return [id, {
              ...player,
              iplHistory: player.iplHistory.map((entry) => (
                entry.season === archivedSeason ? { ...entry, seasonStats } : entry
              )),
            }];
          }));

          const injuredPlayerIds = new Set([
            ...Object.keys(state.activeInjuries),
            ...state.injuryHistory
              .filter((injury) => injury.season === archive.season)
              .map((injury) => injury.playerId),
          ]);
          const performance = normalizeCareerSeasonPerformance(archive.playerStats);
          const previousEmergingWinners = [
            ...HISTORICAL_LEAGUE_HISTORY,
            ...state.simulatedLeagueHistory,
          ]
            .filter((record) => record.season < archive.season && record.emergingPlayer)
            .map((record) => record.emergingPlayer!.name);
          const emergingCandidates = rankEmergingPlayerCandidates({
            stats: Object.entries(performance).map(([id, stats]) => ({
              ...stats,
              id,
              name: stats.name ?? state.players[id]?.name ?? id,
              teamId: stats.teamId ?? state.players[id]?.currentTeamId ?? "",
            })),
            players: state.players,
            season: archive.season,
            initialSeason: INITIAL_ACTIVE_SEASON,
            previousWinnerNames: previousEmergingWinners,
          });
          const emergingByPlayerId = new Map(emergingCandidates.map((candidate) => [candidate.id, candidate]));
          const developmentPerformance = Object.fromEntries(Object.entries(performance).map(([id, stats]) => {
            const emerging = emergingByPlayerId.get(id);
            return [id, {
              ...stats,
              emergingPoints: emerging?.emergingPoints ?? 0,
              emergingBattingImpact: emerging?.battingImpact ?? 0,
              emergingBowlingImpact: emerging?.bowlingImpact ?? 0,
            }];
          }));
          const lifecycle = processPostSeasonCareer({
            players: state.players,
            teams: state.teams,
            performance: developmentPerformance,
            completedSeason: archive.season,
            seed: state.saveId || state.fixtureSeed,
            injuredPlayerIds,
          });
          const retiredIds = new Set(lifecycle.retirements.map((record) => record.playerId));
          const developedPlayersWithSeasonStats = Object.fromEntries(Object.entries(lifecycle.players).map(([id, player]) => [
            id,
            {
              ...player,
              iplHistory: playersWithSeasonStats[id]?.iplHistory ?? player.iplHistory,
            },
          ]));
          return {
            careerSeasonArchives,
            players: developedPlayersWithSeasonStats,
            teams: lifecycle.teams,
            activeInjuries: withoutRetiredInjuries(state.activeInjuries, retiredIds),
            injuryHistory: withoutRetiredInjuryHistory(state.injuryHistory, retiredIds),
            auctionTargets: removeResolvedAuctionTargets(state.auctionTargets, retiredIds),
            auctionTargetPriorities: removeResolvedAuctionTargets(state.auctionTargetPriorities, retiredIds),
            retiredPlayerSnapshots: appendHistoricalRetirees(
              state.retiredPlayerSnapshots,
              lifecycle,
              getReferencedRecordPlayerIds(state.players, careerSeasonArchives),
            ),
            lastCareerPostseasonSeason: archive.season,
            pendingRetirementIntake: state.pendingRetirementIntake + lifecycle.retirements.length,
            lastCareerRetirements: lifecycle.retirements,
            careerRetirementHistory: [
              ...state.careerRetirementHistory,
              ...lifecycle.retirements,
            ].filter((record, index, records) => records.findIndex((candidate) => candidate.playerId === record.playerId && candidate.season === record.season) === index),
          };
        });
      },

      processMatchInjuries: (input) => {
        let result: InjuryProcessingResult = { created: [], worsened: [], recovered: [] };
        set((state) => {
          const injuryState: InjurySystemState = {
            activeInjuries: state.activeInjuries,
            injuryHistory: state.injuryHistory,
            processedInjuryMatchIds: state.processedInjuryMatchIds,
            processedInjuryDateKeys: state.processedInjuryDateKeys,
          };
          const processed = resolveMatchInjuries(injuryState, input);
          result = processed.result;
          return processed.state;
        });
        return result;
      },

      processBackgroundInjuries: (input) => {
        let result: InjuryProcessingResult = { created: [], worsened: [], recovered: [] };
        set((state) => {
          const injuryState: InjurySystemState = {
            activeInjuries: state.activeInjuries,
            injuryHistory: state.injuryHistory,
            processedInjuryMatchIds: state.processedInjuryMatchIds,
            processedInjuryDateKeys: state.processedInjuryDateKeys,
          };
          const squadPlayers = Object.values(state.teams).flatMap((team) => (
            team.squad
              .map((playerId) => state.players[playerId])
              .filter((player): player is Player => Boolean(player) && player.currentTeamId === team.id)
              .map((player) => ({ player, teamId: team.id }))
          ));
          const processed = resolveBackgroundInjuries(injuryState, { ...input, squadPlayers });
          result = processed.result;
          return processed.state;
        });
        return result;
      },

      reconcileInjuries: (date) => {
        let recovered: PlayerInjury[] = [];
        set((state) => {
          const injuryState: InjurySystemState = {
            activeInjuries: state.activeInjuries,
            injuryHistory: state.injuryHistory,
            processedInjuryMatchIds: state.processedInjuryMatchIds,
            processedInjuryDateKeys: state.processedInjuryDateKeys,
          };
          const reconciled = reconcileInjuryRecoveries(injuryState, date);
          recovered = reconciled.recovered;
          return reconciled.state;
        });
        return recovered;
      },

      signInjuryReplacement: (input) => {
        let signed = false;
        set((state) => {
          const injury = Object.values(state.activeInjuries).find((candidate) => candidate.id === input.injuryId);
          if (!injury || injury.teamId !== state.userTeamId) return state;
          const result = applyInjuryReplacementSigning({
            injury,
            replacementPlayerId: input.replacementPlayerId,
            date: input.date,
            season: state.currentSeason,
            seasonFinalDate: input.seasonFinalDate,
            teamFinalLeagueDate: input.teamFinalLeagueDate,
            players: state.players,
            teams: state.teams,
            activeInjuries: state.activeInjuries,
            records: state.injuryReplacementRecords,
            unsoldPlayerIds: state.auction?.unsoldPlayerIds ?? [],
          });
          if (!result) return state;
          signed = true;
          return {
            players: result.players,
            teams: result.teams,
            injuryReplacementRecords: result.records,
          };
        });
        return signed;
      },

      processAIInjuryReplacements: (input) => {
        const signedRecords: InjuryReplacementRecord[] = [];
        set((state) => {
          let players = state.players;
          let teams = state.teams;
          let records = state.injuryReplacementRecords;
          const injuries = Object.values(state.activeInjuries)
            .filter((injury) => injury.teamId !== state.userTeamId)
            .sort((left, right) => left.startedOn.localeCompare(right.startedOn) || left.id.localeCompare(right.id));
          injuries.forEach((injury) => {
            const team = teams[injury.teamId];
            const injuredPlayer = players[injury.playerId];
            if (!team || !injuredPlayer || replacementForInjury(records, injury.id)) return;
            const teamFinalLeagueDate = input.teamFinalLeagueDates[team.id];
            if (!injuryQualifiesForReplacement(injury, {
              date: input.date,
              season: state.currentSeason,
              seasonFinalDate: input.seasonFinalDate,
              teamFinalLeagueDate,
            })) return;
            const candidates = eligibleInjuryReplacementCandidates({
              injury,
              players,
              unsoldPlayerIds: state.auction?.unsoldPlayerIds ?? [],
              records,
              season: state.currentSeason,
            }).filter((candidate) => {
              const availableSquad = team.squad.filter((playerId) => !state.activeInjuries[playerId]);
              if (availableSquad.length >= (team.maxSquadSize ?? 25)) return false;
              if (candidate.nationality !== "Overseas") return true;
              return availableSquad.filter((playerId) => players[playerId]?.nationality === "Overseas").length
                < (team.overseasPlayersMax ?? 8);
            });
            const selected = candidates.sort((left, right) => (
              scoreInjuryReplacementCandidate({ candidate: right, injuredPlayer, team, players, activeInjuries: state.activeInjuries })
              - scoreInjuryReplacementCandidate({ candidate: left, injuredPlayer, team, players, activeInjuries: state.activeInjuries })
              || left.id.localeCompare(right.id)
            ))[0];
            if (!selected) return;
            const result = applyInjuryReplacementSigning({
              injury,
              replacementPlayerId: selected.id,
              date: input.date,
              season: state.currentSeason,
              seasonFinalDate: input.seasonFinalDate,
              teamFinalLeagueDate,
              players,
              teams,
              activeInjuries: state.activeInjuries,
              records,
              unsoldPlayerIds: state.auction?.unsoldPlayerIds ?? [],
            });
            if (!result) return;
            players = result.players;
            teams = result.teams;
            records = result.records;
            signedRecords.push(result.record);
          });
          if (signedRecords.length === 0) return state;
          return { players, teams, injuryReplacementRecords: records };
        });
        return signedRecords;
      },

      executeTrade: (input) => {
        let completed = false;
        set((state) => {
          const auctionType = input.auctionType ?? getAuctionTypeForSeason(state.currentSeason + 1);
          if (
            !isTradeWindowOpen(input.date, input.finalDate, state.currentSeason)
            || input.proposerTeamId === input.recipientTeamId
            || input.offeredPlayerIds.length < 1
            || input.offeredPlayerIds.length > 3
            || input.requestedPlayerIds.length < 1
            || input.requestedPlayerIds.length > 3
          ) return state;
          const proposer = state.teams[input.proposerTeamId];
          const recipient = state.teams[input.recipientTeamId];
          if (!proposer || !recipient) return state;
          const allIds = [...input.offeredPlayerIds, ...input.requestedPlayerIds];
          if (new Set(allIds).size !== allIds.length) return state;
          if (allIds.some((id) => !state.players[id])) return state;
          if (state.tradeRecords.some((record) => (
            record.season === state.currentSeason
            && [...record.outgoingPlayerIds, ...record.incomingPlayerIds].some((id) => allIds.includes(id))
          ))) return state;
          if (!input.offeredPlayerIds.every((id) => proposer.squad.includes(id))
            || !input.requestedPlayerIds.every((id) => recipient.squad.includes(id))) return state;

          const offeredPlayers = input.offeredPlayerIds.map((id) => state.players[id]);
          const requestedPlayers = input.requestedPlayerIds.map((id) => state.players[id]);
          const projectedSquad = (team: Team, removeIds: string[], addIds: string[]) => [
            ...team.squad.filter((id) => !removeIds.includes(id)),
            ...addIds,
          ];
          const proposerSquad = projectedSquad(proposer, input.offeredPlayerIds, input.requestedPlayerIds);
          const recipientSquad = projectedSquad(recipient, input.requestedPlayerIds, input.offeredPlayerIds);
          const overseasCount = (ids: string[]) => ids.filter((id) => state.players[id]?.nationality !== "Indian").length;
          const tradeOverseasLimit = (team: Team) => Math.max(
            team.overseasPlayersMax ?? 8,
            overseasCount(team.squad),
          );
          if (overseasCount(proposerSquad) > tradeOverseasLimit(proposer) || overseasCount(recipientSquad) > tradeOverseasLimit(recipient)) return state;

          const value = (team: Team, player: Player) => calculateTeamTradeValue({
            player,
            team,
            players: state.players,
            season: state.currentSeason,
            auctionType,
            currentInjured: Boolean(state.activeInjuries[player.id]),
          });
          const willingness = (team: Team, player: Player) => getTeamTradeWillingness({
            player,
            team,
            players: state.players,
            season: state.currentSeason,
            currentInjured: Boolean(state.activeInjuries[player.id]),
          });
          const recipientOutgoingValue = calculateTradePackageValue(requestedPlayers.map((player) => value(recipient, player)));
          const recipientIncomingValue = calculateTradePackageValue(offeredPlayers.map((player) => value(recipient, player)));
          const recipientWillingness = requestedPlayers.reduce((best, player) => {
            const current = willingness(recipient, player);
            const ranks = { available: 0, open: 1, reluctant: 2, "highly-reluctant": 3 };
            return ranks[current] > ranks[best] ? current : best;
          }, "available" as ReturnType<typeof getTeamTradeWillingness>);
          // The user controls the proposer and may knowingly accept an uneven
          // return. Only the opposing AI club's valuation can reject the deal.
          if (!isTradeBalanced({ offeredValue: recipientIncomingValue, requestedValue: recipientOutgoingValue, requestedWillingness: recipientWillingness })) return state;

          const currentSalary = (player: Player) => getPlayerSeasonHistory(player.iplHistory, String(state.currentSeason))?.price ?? player.basePrice;
          const salaryFor = (player: Player) => Math.max(1, Math.round(input.salaries[player.id] ?? currentSalary(player)));
          if (auctionType === "mini" && requestedPlayers.some((player) => (
            salaryFor(player) < getTradeSalaryBand(player, state.currentSeason).minimum
            || salaryFor(player) > getTradeSalaryBand(player, state.currentSeason).maximum
            || !isLegalTradeSalary(salaryFor(player))
          ))) return state;
          const proposedProposerPurse = proposer.remainingPurse
            + offeredPlayers.reduce((sum, player) => sum + currentSalary(player), 0)
            - requestedPlayers.reduce((sum, player) => sum + salaryFor(player), 0);
          const proposedRecipientPurse = recipient.remainingPurse
            + requestedPlayers.reduce((sum, player) => sum + currentSalary(player), 0)
            - offeredPlayers.reduce((sum, player) => sum + salaryFor(player), 0);
          if (auctionType === "mini" && (proposedProposerPurse < -MINI_TRADE_OVERDRAFT_LAKHS || proposedRecipientPurse < -MINI_TRADE_OVERDRAFT_LAKHS)) return state;

          const tradeId = `trade-${state.currentSeason}-${state.tradeRecords.length + 1}-${input.date}`;
          const nextPlayers = { ...state.players };
          const transfer = (player: Player, fromTeamId: string, toTeamId: string) => {
            const salary = salaryFor(player);
            nextPlayers[player.id] = {
              ...player,
              currentTeamId: toTeamId,
              lastTradedSeason: state.currentSeason,
              lastTradedToTeamId: toTeamId,
              basePrice: salary,
              isRetained: auctionType === "mega",
              retainedByTeamId: auctionType === "mega" ? toTeamId : null,
              // A post-final trade must never rewrite the completed season's
              // team, salary or statistics. The transaction is recorded in
              // tradeRecords and the next season creates its own roster row.
              iplHistory: player.iplHistory,
            };
          };
          offeredPlayers.forEach((player) => transfer(player, proposer.id, recipient.id));
          requestedPlayers.forEach((player) => transfer(player, recipient.id, proposer.id));
          const swapTeam = (team: Team, outgoing: string[], incoming: string[], newPurse: number): Team => ({
            ...team,
            squad: projectedSquad(team, outgoing, incoming),
            retainedPlayers: auctionType === "mega"
              ? projectedSquad(team, outgoing, incoming)
              : team.retainedPlayers.filter((id) => !outgoing.includes(id)),
            remainingPurse: newPurse,
            spentAmount: Math.max(0, team.totalPurse - newPurse),
            overseasPlayersCurrent: overseasCount(projectedSquad(team, outgoing, incoming)),
            captainContinuityId: outgoing.includes(team.captainContinuityId ?? "") ? null : team.captainContinuityId,
            viceCaptainContinuityId: outgoing.includes(team.viceCaptainContinuityId ?? "") ? null : team.viceCaptainContinuityId,
          });
          const offer: TradeOffer = {
            id: tradeId,
            season: state.currentSeason,
            date: input.date,
            proposerTeamId: proposer.id,
            recipientTeamId: recipient.id,
            offeredPlayerIds: [...input.offeredPlayerIds],
            requestedPlayerIds: [...input.requestedPlayerIds],
            status: "accepted",
            explanation: input.explanation,
          };
          const record = tradeRecordForOffer({ offer, date: input.date, salaries: Object.fromEntries(allIds.map((id) => [id, salaryFor(state.players[id])])), explanation: input.explanation });
          if (input.validateOnly) {
            completed = true;
            return state;
          }
          completed = true;
          return {
            players: nextPlayers,
            teams: {
              ...state.teams,
              [proposer.id]: swapTeam(proposer, input.offeredPlayerIds, input.requestedPlayerIds, proposedProposerPurse),
              [recipient.id]: swapTeam(recipient, input.requestedPlayerIds, input.offeredPlayerIds, proposedRecipientPurse),
            },
            tradeRecords: [...state.tradeRecords, record],
            tradeOffers: [...state.tradeOffers, offer],
          };
        });
        return completed;
      },

      processAITrades: ({ date, finalDate, standingsTeamIds }) => {
        const snapshot = get();
        if (!isTradeWindowOpen(date, finalDate, snapshot.currentSeason) || snapshot.processedAITradeDateKeys.includes(date)) return [];
        // Calendar simulation advances between fixtures rather than visiting
        // every calendar day. Do not require a handful of exact day numbers,
        // otherwise most saves never invoke the AI trade pass at all.
        set((state) => ({ processedAITradeDateKeys: [...state.processedAITradeDateKeys, date] }));
        const state = get();
        const auctionType = getAuctionTypeForSeason(state.currentSeason + 1);
        const family = (player: Player) => player.role === "Pace Bowler" ? "pace" : player.role === "Spin Bowler" ? "spin" : player.role === "WK-Batsman" ? "keeper" : player.role === "All-Rounder" ? "allrounder" : "bat";
        const strength = (player: Player) => Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
        const tradeCount = (teamId: string) => state.tradeRecords.filter((record) => record.season === state.currentSeason && (record.fromTeamId === teamId || record.toTeamId === teamId)).length;
        const rankOf = (teamId: string) => { const index = standingsTeamIds.indexOf(teamId); return index >= 0 ? index + 1 : 5; };
          const desiredRoleDepth: Record<string, number> = {
            bat: 5,
            pace: 3,
            spin: 2,
            keeper: 1,
            allrounder: 2,
          };
          const severeWeakness = (team: Team) => {
            const squad = team.squad.map((id) => state.players[id]).filter((p): p is Player => Boolean(p));
            const topAverage = squad.map(strength).sort((a, b) => b - a).slice(0, 11).reduce((sum, value) => sum + value, 0) / Math.max(1, Math.min(11, squad.length));
            return topAverage < 76 || Object.entries(desiredRoleDepth).some(([role, target]) => (
              squad.filter((player) => family(player) === role).length < target
            ));
          };
        const capFor = (team: Team) => { const rank = rankOf(team.id); if (rank <= 3) return 1; if (rank >= 9) return severeWeakness(team) ? 4 : 3; if (rank >= 7) return severeWeakness(team) ? 3 : 2; return severeWeakness(team) ? 2 : 1; };
        const hash = (value: string) => Array.from(value).reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
        const teams = Object.values(state.teams).filter((team) => team.id !== state.userTeamId && tradeCount(team.id) < capFor(team));
        const ordered = teams.sort((a, b) => rankOf(b.id) - rankOf(a.id));
        for (const seeker of ordered) {
          if (rankOf(seeker.id) <= 3 && hash(`${date}:${seeker.id}`) % 100 >= 8) continue;
          const seekerPlayers = seeker.squad.map((id) => state.players[id]).filter((p): p is Player => Boolean(p));
          const roleCounts = new Map<string, number>();
          ["bat", "pace", "spin", "keeper", "allrounder"].forEach((role) => roleCounts.set(role, 0));
          seekerPlayers.forEach((p) => roleCounts.set(family(p), (roleCounts.get(family(p)) ?? 0) + 1));
          const roleStrength = (role: string) => seekerPlayers
            .filter((player) => family(player) === role)
            .map(strength)
            .sort((a, b) => b - a)[0] ?? 0;
          // Compare each role with the depth it actually needs. Previously the
          // raw smallest group nearly always selected wicketkeeper, even when
          // the club already had a perfectly adequate first-choice keeper.
          const need = Array.from(roleCounts.keys()).sort((left, right) => {
            const leftDeficit = Math.max(0, (desiredRoleDepth[left] ?? 1) - (roleCounts.get(left) ?? 0));
            const rightDeficit = Math.max(0, (desiredRoleDepth[right] ?? 1) - (roleCounts.get(right) ?? 0));
            return rightDeficit - leftDeficit || roleStrength(left) - roleStrength(right);
          })[0] ?? "pace";
          const surplusRole = Array.from(roleCounts.keys()).sort((left, right) => {
            const leftSurplus = (roleCounts.get(left) ?? 0) - (desiredRoleDepth[left] ?? 1);
            const rightSurplus = (roleCounts.get(right) ?? 0) - (desiredRoleDepth[right] ?? 1);
            return rightSurplus - leftSurplus || roleStrength(right) - roleStrength(left);
          })[0];
          const likelyStartingIds = new Set(seekerPlayers.slice().sort((a, b) => strength(b) - strength(a)).slice(0, 11).map((p) => p.id));
          const outgoing = seekerPlayers
            .filter((p) => family(p) === surplusRole && p.id !== seeker.captainContinuityId && p.id !== seeker.viceCaptainContinuityId && strength(p) <= 84)
            .sort((a, b) => Number(likelyStartingIds.has(a.id)) - Number(likelyStartingIds.has(b.id)) || strength(a) - strength(b));
          for (const partner of ordered) {
            if (partner.id === seeker.id || tradeCount(partner.id) >= capFor(partner)) continue;
            const targets = partner.squad.map((id) => state.players[id]).filter((p): p is Player => Boolean(p) && family(p) === need && p.id !== partner.captainContinuityId && p.id !== partner.viceCaptainContinuityId).sort((a, b) => strength(b) - strength(a));
            for (const offered of outgoing) for (const requested of targets) {
              const offeredRating = strength(offered);
              const requestedRating = strength(requested);
              // Solving a role shortage does not justify dumping a genuine
              // starter for a player who is not good enough to enter the XI.
              if (likelyStartingIds.has(offered.id) && requestedRating < offeredRating - 2) continue;
              if (offeredRating >= 80 && requestedRating < 78) continue;
              if (offeredRating - requestedRating > 4) continue;
              const seekerIncoming = calculateTeamTradeValue({ player: requested, team: seeker, players: state.players, season: state.currentSeason, auctionType, currentInjured: Boolean(state.activeInjuries[requested.id]) });
              const seekerOutgoing = calculateTeamTradeValue({ player: offered, team: seeker, players: state.players, season: state.currentSeason, auctionType, currentInjured: Boolean(state.activeInjuries[offered.id]) });
              const partnerIncoming = calculateTeamTradeValue({ player: offered, team: partner, players: state.players, season: state.currentSeason, auctionType, currentInjured: Boolean(state.activeInjuries[offered.id]) });
              const partnerOutgoing = calculateTeamTradeValue({ player: requested, team: partner, players: state.players, season: state.currentSeason, auctionType, currentInjured: Boolean(state.activeInjuries[requested.id]) });
              // The initiating club is actively solving a squad weakness, so
              // it may accept a small raw-value loss when the incoming role is
              // materially more useful. The selling club still applies its
              // full willingness premium to protect stars and core players.
              if (seekerIncoming < seekerOutgoing * 0.94) continue;
              if (!isTradeBalanced({ offeredValue: partnerIncoming, requestedValue: partnerOutgoing, requestedWillingness: getTeamTradeWillingness({ player: requested, team: partner, players: state.players, season: state.currentSeason, currentInjured: Boolean(state.activeInjuries[requested.id]) }) })) continue;
              const before = get().tradeRecords.length;
              const completed = get().executeTrade({ proposerTeamId: seeker.id, recipientTeamId: partner.id, offeredPlayerIds: [offered.id], requestedPlayerIds: [requested.id], salaries: { [requested.id]: getTradeSalaryBand(requested, state.currentSeason).demand }, date, finalDate, auctionType, explanation: `AI trade: ${seeker.shortName} addressed ${need} depth` });
              if (completed) return get().tradeRecords.slice(before);
            }
          }
        }

        // A one-for-one-only market almost never clears: the receiving club
        // correctly asks for a premium, while role-for-role players are often
        // close in value. For a genuine weakness, let a club offer two
        // expendable players for one better-fitting player. This remains a
        // low-frequency fallback and is passed through executeTrade, which
        // enforces the same overseas, purse and AI valuation checks as a
        // user-created deal.
        for (const seeker of ordered) {
          if (rankOf(seeker.id) <= 3 || tradeCount(seeker.id) >= capFor(seeker)) continue;
          const seekerPlayers = seeker.squad
            .map((id) => state.players[id])
            .filter((player): player is Player => Boolean(player));
          const roleCounts = new Map<string, number>(["bat", "pace", "spin", "keeper", "allrounder"].map((role) => [role, 0]));
          seekerPlayers.forEach((player) => roleCounts.set(family(player), (roleCounts.get(family(player)) ?? 0) + 1));
          const need = Array.from(roleCounts.keys()).sort((left, right) => {
            const leftDeficit = Math.max(0, (desiredRoleDepth[left] ?? 1) - (roleCounts.get(left) ?? 0));
            const rightDeficit = Math.max(0, (desiredRoleDepth[right] ?? 1) - (roleCounts.get(right) ?? 0));
            return rightDeficit - leftDeficit;
          })[0] ?? "pace";
          const likelyStartingIds = new Set(seekerPlayers.slice().sort((a, b) => strength(b) - strength(a)).slice(0, 11).map((player) => player.id));
          const outgoingPool = seekerPlayers
            .filter((player) => !likelyStartingIds.has(player.id)
              && player.id !== seeker.captainContinuityId
              && player.id !== seeker.viceCaptainContinuityId
              && strength(player) <= 81)
            .sort((left, right) => strength(left) - strength(right))
            .slice(0, 8);
          if (outgoingPool.length < 2) continue;

          for (const partner of ordered) {
            if (partner.id === seeker.id || tradeCount(partner.id) >= capFor(partner)) continue;
            const targets = partner.squad
              .map((id) => state.players[id])
              .filter((player): player is Player => Boolean(player)
                && family(player) === need
                && player.id !== partner.captainContinuityId
                && player.id !== partner.viceCaptainContinuityId
                && strength(player) <= 84)
              .sort((left, right) => strength(right) - strength(left))
              .slice(0, 8);
            for (const requested of targets) {
              const requestedForSeeker = calculateTeamTradeValue({ player: requested, team: seeker, players: state.players, season: state.currentSeason, auctionType, currentInjured: Boolean(state.activeInjuries[requested.id]) });
              const requestedForPartner = calculateTeamTradeValue({ player: requested, team: partner, players: state.players, season: state.currentSeason, auctionType, currentInjured: Boolean(state.activeInjuries[requested.id]) });
              for (let first = 0; first < outgoingPool.length; first += 1) for (let second = first + 1; second < outgoingPool.length; second += 1) {
                const offered = [outgoingPool[first], outgoingPool[second]];
                const offeredForSeeker = calculateTradePackageValue(offered.map((player) => calculateTeamTradeValue({ player, team: seeker, players: state.players, season: state.currentSeason, auctionType, currentInjured: Boolean(state.activeInjuries[player.id]) })));
                const offeredForPartner = calculateTradePackageValue(offered.map((player) => calculateTeamTradeValue({ player, team: partner, players: state.players, season: state.currentSeason, auctionType, currentInjured: Boolean(state.activeInjuries[player.id]) })));
                if (requestedForSeeker < offeredForSeeker * 0.82) continue;
                if (!isTradeBalanced({
                  offeredValue: offeredForPartner,
                  requestedValue: requestedForPartner,
                  requestedWillingness: getTeamTradeWillingness({ player: requested, team: partner, players: state.players, season: state.currentSeason, currentInjured: Boolean(state.activeInjuries[requested.id]) }),
                })) continue;
                const before = get().tradeRecords.length;
                const completed = get().executeTrade({
                  proposerTeamId: seeker.id,
                  recipientTeamId: partner.id,
                  offeredPlayerIds: offered.map((player) => player.id),
                  requestedPlayerIds: [requested.id],
                  salaries: { [requested.id]: getTradeSalaryBand(requested, state.currentSeason).demand },
                  date,
                  finalDate,
                  auctionType,
                  explanation: `AI trade: ${seeker.shortName} used depth to address ${need}`,
                });
                if (completed) return get().tradeRecords.slice(before);
              }
            }
          }
        }
        return [];
      },

      processCompletedAuctionCareer: () => {
        let retirements: CareerRetirementRecord[] = [];
        set((state) => {
          const auction = state.auction;
          if (
            !auction
            || auction.phase !== "completed"
            || state.lastCareerAuctionProcessedSeason === auction.season
          ) return state;
          const lifecycle = processPostAuctionCareer({
            players: state.players,
            teams: state.teams,
            auctionedPlayerIds: auction.allPlayerIds,
            season: auction.season,
          });
          retirements = lifecycle.retirements;
          const retiredIds = new Set(retirements.map((record) => record.playerId));
          return {
            players: lifecycle.players,
            teams: lifecycle.teams,
            auction: {
              ...auction,
              allPlayerIds: auction.allPlayerIds.filter((id) => !retiredIds.has(id)),
              soldPlayerIds: auction.soldPlayerIds.filter((id) => !retiredIds.has(id)),
              unsoldPlayerIds: auction.unsoldPlayerIds.filter((id) => !retiredIds.has(id)),
              sets: auction.sets.map((set) => ({
                ...set,
                playerIds: set.playerIds.filter((id) => !retiredIds.has(id)),
              })),
            },
            activeInjuries: withoutRetiredInjuries(state.activeInjuries, retiredIds),
            injuryHistory: withoutRetiredInjuryHistory(state.injuryHistory, retiredIds),
            auctionTargets: removeResolvedAuctionTargets(state.auctionTargets, retiredIds),
            auctionTargetPriorities: removeResolvedAuctionTargets(state.auctionTargetPriorities, retiredIds),
            retiredPlayerSnapshots: appendHistoricalRetirees(
              state.retiredPlayerSnapshots,
              lifecycle,
              getReferencedRecordPlayerIds(state.players, state.careerSeasonArchives),
            ),
            lastCareerAuctionProcessedSeason: auction.season,
            pendingRetirementIntake: state.pendingRetirementIntake + retirements.length,
            lastCareerRetirements: retirements,
          };
        });
        return retirements;
      },

      setCareerFastForwardTarget: (targetDate) => set({ careerFastForwardTargetDate: targetDate }),

      completeOffseasonAutomatically: () => {
        const initial = get();
        if (initial.auction?.phase !== "retention") return false;
        initial.autoRetainPlayers();
        get().confirmRetentions();
        // Retention validation can reject a stale/corrupted selection without
        // changing the auction phase. Retry once from the freshly updated
        // store state, then stop safely instead of entering an auction with
        // no committed retention lists.
        if (get().auction?.phase === "retention") {
          get().autoRetainPlayers();
          get().confirmRetentions();
        }
        if (get().auction?.phase === "retention") return false;
        get().startAuction();
        for (let pass = 0; pass < 6; pass += 1) {
          const state = get();
          if (state.auction?.phase === "completed") return true;
          if (state.auction?.phase !== "live") return false;
          state.skipAllAuction();
          const afterSkip = get();
          if (afterSkip.auction?.phase === "completed") return true;
          if (afterSkip.acceleratedPlanningState === "nominating") {
            afterSkip.confirmUserAcceleratedTargets([]);
          }
          if (get().acceleratedPlanningState === "results") {
            get().startAcceleratedAuctionFromPlanning();
          }
        }
        return get().auction?.phase === "completed";
      },

      resetGame: () => {
        set({
          saveId: "",
          saveCreatedAt: "",
          fixtureSeed: "",
          currentDate: "2026-11-15",
          currentSeason: INITIAL_ACTIVE_SEASON,
          auctionCycle: 1,
          players: {},
          teams: {},
          userTeamId: "",
          auction: null,
          isSetupComplete: false,
          isPaused: false,
          speed: 1,
          skipSetSummary: null,
          auctionTargets: {},
          auctionTargetPriorities: {},
          acceleratedPlanningState: null,
          userAcceleratedTargets: [],
          aiAcceleratedTargets: {},
          aiAcceleratedBackups: {},
          clubFigureTierOverrides: {},
          simulatedLeagueHistory: [],
          lastRolledOverSeason: null,
          careerSeasonArchives: [],
          careerIplProcessedMatchKeys: [],
          careerT20ProcessedMatchKeys: [],
          careerIplTrackingSeason: null,
          careerFastForwardTargetDate: null,
          homePitchSelections: createDefaultHomePitchSelections(),
          homeBoundaryDimensions: createDefaultHomeBoundaryDimensions(),
          boundaryPresetsByTeam: {},
          homeOutfieldSettings: createDefaultHomeOutfieldSettings(),
          outfieldProjectsByTeam: {},
          customPitchesByTeam: {},
          pitchProjectsByTeam: {},
          activeInjuries: {},
          injuryHistory: [],
          processedInjuryMatchIds: [],
          processedInjuryDateKeys: [],
          injuryReplacementRecords: [],
          tradeRecords: [],
          tradeOffers: [],
          processedAITradeDateKeys: [],
          auctionMarketProfile: null,
          retiredPlayerSnapshots: {},
          lastCareerPostseasonSeason: null,
          lastCareerAgedSeason: null,
          lastCareerAuctionProcessedSeason: null,
          pendingRetirementIntake: 0,
          lastCareerRetirements: [],
          careerRetirementHistory: [],
          lastCareerGeneratedPlayerIds: [],
        });
      },
    }),
    {
      name: "ipl-simulator-save-v5",
      storage: createJSONStorage(() => gameStateStorage),
      partialize: (state) => ({
        saveId: state.saveId,
        saveCreatedAt: state.saveCreatedAt,
        fixtureSeed: state.fixtureSeed,
        currentDate: state.currentDate,
        currentSeason: state.currentSeason,
        auctionCycle: state.auctionCycle,
        players: state.players,
        teams: state.teams,
        userTeamId: state.userTeamId,
        auction: state.auction,
        isSetupComplete: state.isSetupComplete,
        isPaused: state.isPaused,
        speed: state.speed,
        auctionTargets: state.auctionTargets,
        auctionTargetPriorities: state.auctionTargetPriorities,
        clubFigureTierOverrides: state.clubFigureTierOverrides,
        simulatedLeagueHistory: state.simulatedLeagueHistory,
        lastRolledOverSeason: state.lastRolledOverSeason,
        careerSeasonArchives: state.careerSeasonArchives,
        careerIplProcessedMatchKeys: state.careerIplProcessedMatchKeys,
        careerT20ProcessedMatchKeys: state.careerT20ProcessedMatchKeys,
        careerIplTrackingSeason: state.careerIplTrackingSeason,
        careerFastForwardTargetDate: state.careerFastForwardTargetDate,
        homePitchSelections: state.homePitchSelections,
        homeBoundaryDimensions: state.homeBoundaryDimensions,
        boundaryPresetsByTeam: state.boundaryPresetsByTeam,
        homeOutfieldSettings: state.homeOutfieldSettings,
        outfieldProjectsByTeam: state.outfieldProjectsByTeam,
        customPitchesByTeam: state.customPitchesByTeam,
        pitchProjectsByTeam: state.pitchProjectsByTeam,
        activeInjuries: state.activeInjuries,
        injuryHistory: state.injuryHistory,
        processedInjuryMatchIds: state.processedInjuryMatchIds,
        processedInjuryDateKeys: state.processedInjuryDateKeys,
        tradeRecords: state.tradeRecords,
        tradeOffers: state.tradeOffers,
        processedAITradeDateKeys: state.processedAITradeDateKeys,
        auctionMarketProfile: state.auctionMarketProfile,
        retiredPlayerSnapshots: state.retiredPlayerSnapshots,
        lastCareerPostseasonSeason: state.lastCareerPostseasonSeason,
        lastCareerAgedSeason: state.lastCareerAgedSeason,
        lastCareerAuctionProcessedSeason: state.lastCareerAuctionProcessedSeason,
        pendingRetirementIntake: state.pendingRetirementIntake,
        careerRetirementHistory: state.careerRetirementHistory,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<Store>;
        const persistedCurrentSeason = p.currentSeason ?? current.currentSeason;
        const migratedCurrentSeason = persistedCurrentSeason === 2026
          ? INITIAL_ACTIVE_SEASON
          : persistedCurrentSeason;
        const migratedAuction = p.auction
          ? {
              ...p.auction,
              season: p.auction.season === 2026 ? INITIAL_ACTIVE_SEASON : p.auction.season,
            }
          : p.auction;
        const migratedFixtureSeed = p.fixtureSeed || p.saveId || current.fixtureSeed;
        const migratedTeams = p.teams
          ? Object.fromEntries(Object.entries(p.teams).map(([id, team]) => [
              id,
              {
                ...team,
                minSquadSize: 18,
                softSquadTarget: id === p.userTeamId ? 24 : (team.softSquadTarget ?? pickSoftSquadTarget()),
              },
            ]))
          : current.teams;
        const migratedPlayers = initializeCareerPlayers(
          p.players ? { ...p.players } : current.players,
          migratedCurrentSeason - 1,
        );
        const persistedRetiredPlayerIds = new Set([
          ...(p.careerRetirementHistory ?? p.lastCareerRetirements ?? []).map((record) => record.playerId),
          ...Object.keys(p.retiredPlayerSnapshots ?? {}),
        ]);
        persistedRetiredPlayerIds.forEach((playerId) => delete migratedPlayers[playerId]);
        Object.entries(migratedPlayers).forEach(([id, player]) => {
          if (player.name.trim().toLocaleLowerCase("en-GB") === "ajinkya rahane") {
            delete migratedPlayers[id];
          }
        });
        const cleanedTeams = Object.fromEntries(Object.entries(migratedTeams).map(([id, team]) => [
          id,
          {
            ...team,
            squad: team.squad.filter((playerId) => Boolean(migratedPlayers[playerId])),
            retainedPlayers: team.retainedPlayers.filter((playerId) => Boolean(migratedPlayers[playerId])),
            captainContinuityId: team.captainContinuityId && migratedPlayers[team.captainContinuityId]
              ? team.captainContinuityId
              : null,
          },
        ]));
        Object.entries(migratedPlayers).forEach(([id, player]) => {
          if (player.name !== "Riyan Parag") return;
          migratedPlayers[id] = {
            ...player,
            isCoreBatter: true,
            isFinisher: false,
          };
        });
        const persistedAuctionSeason = String(migratedAuction?.season ?? migratedCurrentSeason);
        const sanitizedAuction = migratedAuction
          ? {
              ...migratedAuction,
              allPlayerIds: migratedAuction.allPlayerIds.filter((id) => !persistedRetiredPlayerIds.has(id)),
              soldPlayerIds: migratedAuction.soldPlayerIds.filter((id) => !persistedRetiredPlayerIds.has(id)),
              unsoldPlayerIds: migratedAuction.unsoldPlayerIds.filter((id) => !persistedRetiredPlayerIds.has(id)),
              sets: migratedAuction.sets.map((set) => ({
                ...set,
                playerIds: set.playerIds.filter((id) => !persistedRetiredPlayerIds.has(id)),
              })),
              saleHistory: migratedAuction.saleHistory.filter((sale) => !persistedRetiredPlayerIds.has(sale.playerId)),
              currentPlayer: migratedAuction.currentPlayer && persistedRetiredPlayerIds.has(migratedAuction.currentPlayer.id)
                ? null
                : migratedAuction.currentPlayer,
              ...(migratedAuction.currentPlayer && persistedRetiredPlayerIds.has(migratedAuction.currentPlayer.id)
                ? { currentBid: 0, currentHighBidderTeamId: null, biddingHistory: [] }
                : {}),
            }
          : migratedAuction;
        const persistedFinalSales = new Map<string, NonNullable<typeof p.auction>["saleHistory"][number]>();
        (sanitizedAuction?.saleHistory ?? []).forEach((sale) => persistedFinalSales.set(sale.playerId, sale));
        persistedFinalSales.forEach((sale, playerId) => {
          const player = migratedPlayers[playerId];
          if (!player) return;
          migratedPlayers[playerId] = {
            ...player,
            iplHistory: upsertPlayerIplHistory(player.iplHistory, {
              teamId: sale.teamId,
              season: persistedAuctionSeason,
              price: sale.price,
              isRtm: wasPlayerAcquiredViaRtm(sale),
            }),
          };
        });
        const customPitchesByTeam = normalizeCustomPitches(p.customPitchesByTeam);
        const pitchProjectsByTeam = normalizePitchProjects(p.pitchProjectsByTeam);
        const auctionMarketProfile = normalizeAuctionMarketProfile(
          p.auctionMarketProfile,
          Object.values(migratedPlayers),
        );
        const marketPlayers = withAdaptiveBasePrices(applyAuctionMarketRatings(
          migratedPlayers,
          auctionMarketProfile,
        ));
        const expectedRetentionAuctionType = sanitizedAuction?.phase === "retention"
          ? getAuctionTypeForSeason(sanitizedAuction.season)
          : sanitizedAuction?.type;
        const requiresRetentionCycleMigration = Boolean(
          sanitizedAuction?.phase === "retention"
          && expectedRetentionAuctionType
          && sanitizedAuction.type !== expectedRetentionAuctionType,
        );
        let cyclePlayers = marketPlayers;
        let cycleTeams = cleanedTeams;
        if (requiresRetentionCycleMigration && expectedRetentionAuctionType === "mini" && sanitizedAuction) {
          cyclePlayers = { ...marketPlayers };
          cycleTeams = Object.fromEntries(Object.entries(cleanedTeams).map(([id, team]) => {
            const retainedPlayers = team.squad.filter((playerId) => Boolean(cyclePlayers[playerId]));
            retainedPlayers.forEach((playerId) => {
              cyclePlayers[playerId] = {
                ...cyclePlayers[playerId],
                currentTeamId: id,
                isRetained: true,
                retainedByTeamId: id,
              };
            });
            const spentAmount = calculateMiniAuctionKeptSalary(retainedPlayers, id, cyclePlayers, sanitizedAuction.season);
            return [id, {
              ...team,
              retainedPlayers,
              totalPurse: MINI_AUCTION_PURSE_LAKHS,
              spentAmount,
              remainingPurse: Math.max(0, MINI_AUCTION_PURSE_LAKHS - spentAmount),
              rtmCardsTotal: 0,
              rtmCardsUsed: 0,
            }];
          }));
        }
        const cycleAuction = sanitizedAuction && expectedRetentionAuctionType
          ? { ...sanitizedAuction, type: expectedRetentionAuctionType }
          : sanitizedAuction;
        return {
          ...current,
          ...p,
          currentSeason: migratedCurrentSeason,
          fixtureSeed: migratedFixtureSeed,
          auction: cycleAuction ?? null,
          teams: cycleTeams,
          players: cyclePlayers,
          auctionTargets: removeResolvedAuctionTargets(p.auctionTargets ?? {}, persistedRetiredPlayerIds),
          auctionTargetPriorities: removeResolvedAuctionTargets(p.auctionTargetPriorities ?? {}, persistedRetiredPlayerIds),
          clubFigureTierOverrides: p.clubFigureTierOverrides ?? {},
          simulatedLeagueHistory: p.simulatedLeagueHistory ?? [],
          lastRolledOverSeason: p.lastRolledOverSeason ?? null,
          careerSeasonArchives: p.careerSeasonArchives ?? [],
          careerIplProcessedMatchKeys: p.careerIplProcessedMatchKeys ?? [],
          careerT20ProcessedMatchKeys: p.careerT20ProcessedMatchKeys ?? [],
          careerIplTrackingSeason: p.careerIplTrackingSeason ?? null,
          careerFastForwardTargetDate: p.careerFastForwardTargetDate ?? null,
          activeInjuries: p.activeInjuries ?? {},
          injuryHistory: p.injuryHistory ?? [],
          processedInjuryMatchIds: p.processedInjuryMatchIds ?? [],
          processedInjuryDateKeys: p.processedInjuryDateKeys ?? [],
          injuryReplacementRecords: p.injuryReplacementRecords ?? [],
          tradeRecords: p.tradeRecords ?? [],
          tradeOffers: p.tradeOffers ?? [],
          processedAITradeDateKeys: p.processedAITradeDateKeys ?? [],
          auctionMarketProfile,
          retiredPlayerSnapshots: p.retiredPlayerSnapshots ?? {},
          lastCareerPostseasonSeason: p.lastCareerPostseasonSeason ?? null,
          lastCareerAgedSeason: p.lastCareerAgedSeason ?? null,
          lastCareerAuctionProcessedSeason: p.lastCareerAuctionProcessedSeason ?? null,
          pendingRetirementIntake: p.pendingRetirementIntake ?? 0,
          lastCareerRetirements: [],
          careerRetirementHistory: p.careerRetirementHistory ?? p.lastCareerRetirements ?? [],
          lastCareerGeneratedPlayerIds: [],
          homePitchSelections: normalizeHomePitchSelections(
            p.homePitchSelections,
            getAdditionalHomePitchIds(customPitchesByTeam),
          ),
          homeBoundaryDimensions: normalizeHomeBoundaryDimensions(
            p.homeBoundaryDimensions
              ?? (p as Partial<Store> & { homeBoundaryLengths?: unknown }).homeBoundaryLengths,
          ),
          boundaryPresetsByTeam: normalizeBoundaryPresetsByTeam(p.boundaryPresetsByTeam),
          homeOutfieldSettings: normalizeHomeOutfieldSettings(p.homeOutfieldSettings),
          outfieldProjectsByTeam: normalizeOutfieldProjectsByTeam(p.outfieldProjectsByTeam),
          customPitchesByTeam,
          pitchProjectsByTeam,
        };
      },
    }
  )
);

// ---------------------------------------------------------------------------
// RTM transfer helpers — called by both user RTM actions and AI-vs-AI RTM
// ---------------------------------------------------------------------------

/**
 * Transfer a player from winnerTeam to originalTeam (RTM exercised + accepted).
 * winnerTeam is refunded refundAmount (= hammer price).
 * originalTeam pays transferPrice (= hammer price or raised counter amount).
 */
function doRTMTransfer(
  originalTeamId: string,
  winnerTeamId: string,
  player: Player,
  transferPrice: number,
  refundAmount: number,
) {
  const state = useGameStore.getState();
  const origTeam = state.teams[originalTeamId];
  if (!origTeam || origTeam.remainingPurse < transferPrice) {
    // Original team cannot afford transferPrice -> fallback: winner team keeps player!
    doWinnerKeepsAtCounter(winnerTeamId, refundAmount, refundAmount, player);
    return;
  }

  useGameStore.setState((s) => {
    const newTeams = { ...s.teams };

    newTeams[winnerTeamId] = {
      ...newTeams[winnerTeamId],
      squad: newTeams[winnerTeamId].squad.filter((id) => id !== player.id),
      remainingPurse: newTeams[winnerTeamId].remainingPurse + refundAmount,
      spentAmount: newTeams[winnerTeamId].spentAmount - refundAmount,
      overseasPlayersCurrent:
        player.nationality === "Overseas"
          ? newTeams[winnerTeamId].overseasPlayersCurrent - 1
          : newTeams[winnerTeamId].overseasPlayersCurrent,
    };

    newTeams[originalTeamId] = {
      ...newTeams[originalTeamId],
      squad: [...newTeams[originalTeamId].squad, player.id],
      remainingPurse: newTeams[originalTeamId].remainingPurse - transferPrice,
      spentAmount: newTeams[originalTeamId].spentAmount + transferPrice,
      rtmCardsUsed: newTeams[originalTeamId].rtmCardsUsed + 1,
      overseasPlayersCurrent:
        player.nationality === "Overseas"
          ? newTeams[originalTeamId].overseasPlayersCurrent + 1
          : newTeams[originalTeamId].overseasPlayersCurrent,
    };

    const updatedHistory = [
      ...player.iplHistory.filter(h => h.season !== getActiveSeasonYear()),
      { teamId: originalTeamId, season: getActiveSeasonYear(), price: transferPrice, isRtm: true }
    ];
    const newPlayers = { ...s.players, [player.id]: { ...player, currentTeamId: originalTeamId, iplHistory: updatedHistory } };
    const newPurses = {
      ...(s.auction?.teamPurses ?? {}),
      [originalTeamId]: { remaining: newTeams[originalTeamId].remainingPurse, squadCount: newTeams[originalTeamId].squad.length },
      [winnerTeamId]: { remaining: newTeams[winnerTeamId].remainingPurse, squadCount: newTeams[winnerTeamId].squad.length },
    };

    return {
      teams: newTeams,
      players: newPlayers,
      auction: s.auction
        ? {
            ...s.auction,
            rtm: null,
            soldFlash: { playerId: player.id, teamId: originalTeamId, amount: transferPrice },
            teamPurses: newPurses,
            saleHistory: [
              ...(s.auction.saleHistory ?? []),
              { playerId: player.id, teamId: originalTeamId, price: transferPrice, lot: s.auction.currentLotIndex, bids: s.auction.biddingHistory },
            ],
          }
        : null,
    };
  });
  setTimeout(() => advanceToNextLot(), 2200);
}

/**
 * Winner keeps the player but pays the counter amount (not just the hammer price).
 * Used when original team folds or when user (winner) raises and AI (original) folds.
 */
function doWinnerKeepsAtCounter(
  winnerTeamId: string,
  soldAmount: number,
  raisedAmount: number,
  player: Player,
) {
  const extra = raisedAmount - soldAmount;
  useGameStore.setState((s) => {
    const newTeams = { ...s.teams };
    newTeams[winnerTeamId] = {
      ...newTeams[winnerTeamId],
      remainingPurse: newTeams[winnerTeamId].remainingPurse - extra,
      spentAmount: newTeams[winnerTeamId].spentAmount + extra,
    };
    const newPurses = {
      ...(s.auction?.teamPurses ?? {}),
      [winnerTeamId]: { remaining: newTeams[winnerTeamId].remainingPurse, squadCount: newTeams[winnerTeamId].squad.length },
    };
    const storedPlayer = s.players[player.id] ?? player;
    const updatedHistory = [
      ...storedPlayer.iplHistory.filter(history => history.season !== getActiveSeasonYear()),
      { teamId: winnerTeamId, season: getActiveSeasonYear(), price: raisedAmount, isRtm: false },
    ];
    return {
      teams: newTeams,
      players: {
        ...s.players,
        [player.id]: { ...storedPlayer, currentTeamId: winnerTeamId, iplHistory: updatedHistory },
      },
      auction: s.auction
        ? {
            ...s.auction,
            rtm: null,
            soldFlash: { playerId: player.id, teamId: winnerTeamId, amount: raisedAmount },
            teamPurses: newPurses,
            saleHistory: [
              ...(s.auction.saleHistory ?? []),
              { playerId: player.id, teamId: winnerTeamId, price: raisedAmount, lot: s.auction.currentLotIndex, bids: s.auction.biddingHistory },
            ],
          }
        : null,
    };
  });
  setTimeout(() => advanceToNextLot(), 2200);
}

/**
 * Fast-forward the AI bidding for the current lot synchronously.
 * Called when the user presses PASS — runs all remaining AI bids instantly,
 * then hands off to hammerFall so the player sells (or goes unsold) normally.
 */
function simulateRemainingBids(player: Player) {
  // Guard: if hammer already fired for this lot, don't re-simulate
  if (_hammerLotId === player.id) return;

  const state = useGameStore.getState();
  const { auction, teams, players: allPlayers, userTeamId } = state;
  if (!auction || !auction.currentPlayer || auction.currentPlayer.id !== player.id) return;

  const lotId = player.id;
  let currentBid = auction.currentBid;
  let highBidderTeamId = auction.currentHighBidderTeamId;
  let biddingHistory = [...auction.biddingHistory];

  const totalLots = auction.sets.reduce((sum, s) => sum + s.playerIds.length, 0);
  const ctx: AuctionContext = {
    remainingPlayerIds: auction.allPlayerIds.filter(
      id => !auction.soldPlayerIds.includes(id) && id !== player.id,
    ),
    soldPlayerIds: auction.soldPlayerIds,
    currentLotIndex: auction.currentLotIndex,
    totalLots,
    isAcceleratedPhase: auction.isAcceleratedPhase,
    auctionType: auction.type,
  };

  let iterations = 0;
  const MAX_ITER = 300;

  while (iterations < MAX_ITER) {
    iterations++;
    const nextBid = getNextBidAmount(currentBid);

    const interested = Object.values(teams).filter(t => {
      if (t.id === userTeamId) return false;           // user decides for themselves
      if (t.id === highBidderTeamId) return false;     // can't outbid yourself
      return canAIBidAtAmount(t, player, nextBid, lotId, allPlayers, ctx);
    });

    if (interested.length === 0) break;

    const bidder = pickBiddingTeam(interested, player, lotId, allPlayers, ctx);
    if (!bidder) break;

    currentBid = nextBid;
    highBidderTeamId = bidder.id;
    biddingHistory = [{ teamId: bidder.id, amount: nextBid, timestamp: Date.now() }, ...biddingHistory];
  }

  // Commit the simulated result to the store, then trigger hammer
  useGameStore.setState(s => ({
    auction: s.auction
      ? { ...s.auction, currentBid, currentHighBidderTeamId: highBidderTeamId, biddingHistory }
      : null,
  }));

  hammerFall();
}

function hammerFall() {
  const state = useGameStore.getState();
  const { auction, teams, players, userTeamId } = state;
  if (!auction || !auction.currentPlayer) return;

  const player = auction.currentPlayer;

  // Idempotency: prevent double-hammer from timer race + rapid PASS clicks
  if (_hammerLotId === player.id) return;
  _hammerLotId = player.id;

  const highBidder = auction.currentHighBidderTeamId;

  if (!highBidder) {
    // No bids → unsold: show UNSOLD animation for 2.2s then advance
    useGameStore.setState((s) => ({
      auction: s.auction
        ? {
            ...s.auction,
            unsoldPlayerIds: [...s.auction.unsoldPlayerIds, player.id],
            unsoldFlash: { playerId: player.id },
            soldFlash: null,
            timerSeconds: 0,
          }
        : null,
    }));
    setTimeout(() => advanceToNextLot(), 2200);
    return;
  }

  // Sold to highBidder
  const soldAmount = auction.currentBid;

  // Commit winner's team state (deduct purse, add to squad)
  useGameStore.setState((s) => {
    const newTeams = { ...s.teams };
    newTeams[highBidder] = {
      ...newTeams[highBidder],
      squad: [...newTeams[highBidder].squad, player.id],
      remainingPurse: newTeams[highBidder].remainingPurse - soldAmount,
      spentAmount: newTeams[highBidder].spentAmount + soldAmount,
      overseasPlayersCurrent:
        player.nationality === "Overseas"
          ? newTeams[highBidder].overseasPlayersCurrent + 1
          : newTeams[highBidder].overseasPlayersCurrent,
    };
    const updatedHistory = [
      ...player.iplHistory.filter(h => h.season !== getActiveSeasonYear()),
      { teamId: highBidder, season: getActiveSeasonYear(), price: soldAmount }
    ];
    const newPlayers = { ...s.players, [player.id]: { ...player, currentTeamId: highBidder, iplHistory: updatedHistory } };
    const newPurses = {
      ...(s.auction?.teamPurses ?? {}),
      [highBidder]: { remaining: newTeams[highBidder].remainingPurse, squadCount: newTeams[highBidder].squad.length },
    };
    const newSoldIds = [...(s.auction?.soldPlayerIds ?? []), player.id];
    return {
      teams: newTeams,
      players: newPlayers,
      auctionTargets: removeResolvedAuctionTargets(s.auctionTargets, [player.id]),
      auctionTargetPriorities: removeResolvedAuctionTargets(s.auctionTargetPriorities, [player.id]),
      auction: s.auction ? { ...s.auction, soldPlayerIds: newSoldIds, teamPurses: newPurses } : null,
    };
  });

  // Find RTM-eligible team (any team, not just user)
  const currentState = useGameStore.getState();
  const rtmTeamId = findRTMEligibleTeam(player, currentState.teams, highBidder, soldAmount);

  if (!rtmTeamId) {
    // No RTM: flash and advance
    useGameStore.setState((s) => ({
      auction: s.auction
        ? {
            ...s.auction,
            soldFlash: { playerId: player.id, teamId: highBidder, amount: soldAmount },
            saleHistory: [...(s.auction.saleHistory ?? []), { playerId: player.id, teamId: highBidder, price: soldAmount, lot: auction.currentLotIndex, bids: auction.biddingHistory }],
          }
        : null,
    }));
    setTimeout(() => advanceToNextLot(), 2200);
    return;
  }

  const isUserOriginal = rtmTeamId === userTeamId;
  const isUserWinner = highBidder === userTeamId;

  if (!isUserOriginal && !isUserWinner) {
    // AI-vs-AI RTM: resolve silently
    const aiOrigValuation = getCachedValuation(rtmTeamId);
    const rtmTeam = teams[rtmTeamId];
    const loyaltyBonus = 1.0 + (rtmTeam?.dna.loyalty ?? 50) / 100 * 0.25;
    if (aiOrigValuation * loyaltyBonus > soldAmount) {
      // AI original exercises RTM
      const aiWinnerValuation = getCachedValuation(highBidder);
      if (aiWinnerValuation > soldAmount * 1.05) {
        // Winner AI counters
        let counterAmount = soldAmount;
        const target = Math.min(aiWinnerValuation, Math.round(soldAmount * 1.25));
        while (counterAmount < target) counterAmount = getNextBidAmount(counterAmount);
        if (counterAmount <= soldAmount) counterAmount = getNextBidAmount(soldAmount);
        // Original AI matches counter?
        if (aiOrigValuation * loyaltyBonus >= counterAmount) {
          doRTMTransfer(rtmTeamId, highBidder, player, counterAmount, soldAmount);
        } else {
          doWinnerKeepsAtCounter(highBidder, soldAmount, counterAmount, player);
        }
      } else {
        // Winner AI doesn't counter: original gets at soldAmount
        doRTMTransfer(rtmTeamId, highBidder, player, soldAmount, soldAmount);
      }
    } else {
      // AI declines RTM
      useGameStore.setState((s) => ({
        auction: s.auction
          ? {
              ...s.auction,
              soldFlash: { playerId: player.id, teamId: highBidder, amount: soldAmount },
              saleHistory: [...(s.auction.saleHistory ?? []), { playerId: player.id, teamId: highBidder, price: soldAmount, lot: auction.currentLotIndex, bids: auction.biddingHistory }],
            }
          : null,
      }));
      setTimeout(() => advanceToNextLot(), 2200);
    }
    return;
  }

  if (isUserOriginal) {
    // User is original team: show "offer" modal
    useGameStore.setState((s) => ({
      auction: s.auction
        ? { ...s.auction, rtm: { phase: "offer", originalTeamId: rtmTeamId, winnerTeamId: highBidder, baseAmount: soldAmount, raisedAmount: 0, timerSeconds: 15 } }
        : null,
    }));
    return;
  }

  // User is winner, AI is original: AI decides to RTM or not
  const rtmTeam = teams[rtmTeamId];
  const loyaltyBonus = 1.0 + (rtmTeam?.dna.loyalty ?? 50) / 100 * 0.25;
  const aiOrigValuation = getCachedValuation(rtmTeamId);
  if (aiOrigValuation * loyaltyBonus > soldAmount) {
    // AI exercises RTM → show "winner_counter" modal to user
    useGameStore.setState((s) => ({
      auction: s.auction
        ? { ...s.auction, rtm: { phase: "winner_counter", originalTeamId: rtmTeamId, winnerTeamId: highBidder, baseAmount: soldAmount, raisedAmount: 0, timerSeconds: 15 } }
        : null,
    }));
  } else {
    // AI declines RTM: user keeps player
    useGameStore.setState((s) => ({
      auction: s.auction
        ? {
            ...s.auction,
            soldFlash: { playerId: player.id, teamId: highBidder, amount: soldAmount },
            saleHistory: [...(s.auction.saleHistory ?? []), { playerId: player.id, teamId: highBidder, price: soldAmount, lot: auction.currentLotIndex, bids: auction.biddingHistory }],
          }
        : null,
    }));
    setTimeout(() => advanceToNextLot(), 2200);
  }
}

function advanceToNextLot() {
  // Reset idempotency guard for the next lot
  _hammerLotId = null;

  const state = useGameStore.getState();
  const { auction, players, teams, userTeamId } = state;
  if (!auction) return;

  // Clear flash and rtm state
  useGameStore.setState((s) => ({
    auction: s.auction ? { ...s.auction, soldFlash: null, unsoldFlash: null, rtm: null } : null,
  }));

  // Advance current set index
  const newSets = auction.sets.map((set, si) => {
    if (si === auction.currentSetIndex) {
      const newIndex = set.currentIndex + 1;
      return {
        ...set,
        currentIndex: newIndex,
        isCompleted: newIndex >= set.playerIds.length,
      };
    }
    return set;
  });

  // Find next lot
  const next = pickNextLot(newSets);

  if (!next) {
    if (!auction.isAcceleratedPhase && state.acceleratedPlanningState === null) {
      useGameStore.setState({
        acceleratedPlanningState: 'nominating',
        userAcceleratedTargets: [],
        aiAcceleratedTargets: {},
        isPaused: true,
      });
      return;
    }

    // Regular-auction unsold players may enter one accelerated set. Once a
    // player is unsold in that set, the result is final for this auction.
    const madeProgress = !auction.isAcceleratedPhase && auction.unsoldPlayerIds.length > 0;
    if (madeProgress) {
      _lastAccelUnsoldCount = auction.unsoldPlayerIds.length;
      const unsoldPlayers = auction.unsoldPlayerIds
        .map((id) => players[id])
        .filter(Boolean);

      if (unsoldPlayers.length > 0) {
        const acceleratedSets = [{
          id: "accelerated",
          name: "Accelerated Auction",
          playerIds: unsoldPlayers.map((p) => p.id),
          currentIndex: 0,
          isCompleted: false,
        }];

        const firstPlayer = unsoldPlayers[0];

        useGameStore.setState((s) => ({
          auction: s.auction
            ? {
                ...s.auction,
                sets: acceleratedSets,
                currentSetIndex: 0,
                currentLotIndex: s.auction.currentLotIndex + 1,
                currentPlayer: firstPlayer,
                currentBid: firstPlayer.basePrice,
                currentHighBidderTeamId: null,
                biddingHistory: [],
                timerSeconds: 10,
                isAcceleratedPhase: true,
                unsoldPlayerIds: [],
                soldFlash: null,
                unsoldFlash: null,
              }
            : null,
        }));

        resetLotCache();
        scheduleAIBids(firstPlayer);
        return;
      }
    }

    // Auction complete
    const currentTeams = { ...useGameStore.getState().teams };
    const currentPlayers = { ...useGameStore.getState().players };
    ensureMinimumSquadSizes(currentTeams, currentPlayers);

    useGameStore.setState((s) => ({
      teams: currentTeams,
      players: currentPlayers,
      auctionTargets: {},
      auctionTargetPriorities: {},
      auction: s.auction ? { ...s.auction, phase: "completed", currentPlayer: null, soldFlash: null, unsoldFlash: null } : null,
    }));
    useGameStore.getState().processCompletedAuctionCareer();
    return;
  }

  const currentSet = newSets[next.setIndex];
  const playerId = currentSet.playerIds[next.playerIndex];
  const player = players[playerId];

  useGameStore.setState((s) => ({
    auction: s.auction
      ? {
          ...s.auction,
          sets: newSets,
          currentSetIndex: next.setIndex,
          currentLotIndex: s.auction.currentLotIndex + 1,
          currentPlayer: player,
          currentBid: player.basePrice,
          currentHighBidderTeamId: null,
          biddingHistory: [],
          timerSeconds: 10,
        }
      : null,
  }));

  // Reset per-lot AI valuation cache so each player gets fresh valuations
  resetLotCache();

  // Schedule first AI bid round
  scheduleAIBids(player);
}

/**
 * AI bidding — one team bids per round, then schedules the next round.
 * This prevents the previous cascade where all 9 teams fired simultaneously
 * and re-fired each other, causing bids to shoot to ₹49Cr in seconds.
 *
 * Flow:
 *   1. Wait a realistic delay (based on current bid size)
 *   2. Find all AI teams that still want to bid (under their cached valuation)
 *   3. Pick one team (weighted by remaining headroom)
 *   4. That team bids once
 *   5. Schedule the next round — stops naturally when no team wants to bid
 */
function scheduleAIBids(player: Player) {
  if (_aiBidsTimeoutId) {
    clearTimeout(_aiBidsTimeoutId);
    _aiBidsTimeoutId = null;
  }

  const state = useGameStore.getState();
  const { auction } = state;
  if (!auction?.currentPlayer) return;

  const delay = nextAIBidDelay(auction.currentBid);
  const lotId = player.id; // stable ID for the valuation cache
  const speed = state.speed;
  const speedAdjustedDelay = delay / speed;

  _aiBidsTimeoutId = setTimeout(() => {
    _aiBidsTimeoutId = null;
    const s = useGameStore.getState();
    const { auction: a, teams, players: allPlayers, userTeamId } = s;

    // Guard: lot must still be the same player and auction active
    if (!a || !a.currentPlayer || a.currentPlayer.id !== player.id) return;
    if (a.phase !== "live") return;
    if (a.rtm || a.soldFlash || a.unsoldFlash) return;

    if (s.isPaused) {
      scheduleAIBids(player);
      return;
    }

    const hasBids = !!a.currentHighBidderTeamId;
    const nextBid = hasBids ? getNextBidAmount(a.currentBid) : a.currentBid;

    // Build auction context for AI engine
    const totalLots = a.sets.reduce((sum, s) => sum + s.playerIds.length, 0);
    const ctx: AuctionContext = {
      remainingPlayerIds: a.allPlayerIds.filter(
        id => !a.soldPlayerIds.includes(id) && id !== player.id
      ),
      soldPlayerIds: a.soldPlayerIds,
      currentLotIndex: a.currentLotIndex,
      totalLots,
      isAcceleratedPhase: a.isAcceleratedPhase,
      auctionType: a.type,
    };

    // Collect AI teams that both CAN and WANT to bid
    const interested = Object.values(teams).filter((t) => {
      if (t.id === userTeamId) return false;
      if (t.id === a.currentHighBidderTeamId) return false; // already highest bidder
      return canAIBidAtAmount(t, player, nextBid, lotId, allPlayers, ctx);
    });

    if (interested.length === 0) return; // nobody wants to bid — let timer run

    // Pick ONE team to bid this round
    const biddingTeam = pickBiddingTeam(interested, player, lotId, allPlayers, ctx);
    if (!biddingTeam) return;

    useGameStore.getState().placeBid(biddingTeam.id, nextBid);

    // Schedule next round — the chain continues until no one bids
    scheduleAIBids(player);
  }, speedAdjustedDelay);
}

// ---------------------------------------------------------------------------
// Hammer idempotency guard — prevents the same lot from being hammered twice
// (race between timer fire + PASS click, or rapid PASS double-click)
// ---------------------------------------------------------------------------
let _hammerLotId: string | null = null;
let _aiBidsTimeoutId: NodeJS.Timeout | null = null;

// Tracks the unsold count entering the current accelerated round, so repeated
// accelerated rounds stop once a whole pass clears no one.
let _lastAccelUnsoldCount = Infinity;

function ensureMinimumSquadSizes(
  teams: Record<string, Team>,
  players: Record<string, Player>,
  fillToTarget = false
) {
  const userTeamId = useGameStore.getState().userTeamId;
  const isWK = (p: Player) => !!(p.isWicketkeeper || p.isPartTimeWk || p.role === "WK-Batsman");
  const isFullTimeKeeper = (p: Player) => !!((p.isWicketkeeper || p.role === "WK-Batsman") && !p.isPartTimeWk);
  const isIndianBatter = (p: Player) => p.nationality === "Indian" && (p.role === "Batsman" || p.role === "WK-Batsman");
  const isSpinBowlingPlayer = (p: Player) => p.role === "Spin Bowler" || /spin|orthodox/i.test(p.bowlingStyle ?? "");
  const ratingOf = getAuctionRating;

  const getMinSize = (t: Team) => fillToTarget ? (t.softSquadTarget ?? 24) : 18;

  const getBowlersCount = (t: Team) => t.squad.map(id => players[id]).filter(p => p && (p.role === "Pace Bowler" || p.role === "Spin Bowler")).length;
  const getKeepersCount = (t: Team) => t.squad.map(id => players[id]).filter(p => p && isWK(p)).length;
  const getSpinnersCount = (t: Team) => t.squad.map(id => players[id]).filter(p => p && p.role === "Spin Bowler").length;
  const getQualitySpinOptionsCount = (t: Team) => t.squad.map(id => players[id]).filter(p => p && isSpinBowlingPlayer(p) && getAuctionBowlingRating(p) > 74).length;
  const getIndianBowlersCount = (t: Team) => t.squad.map(id => players[id]).filter(p => p && p.nationality === "Indian" && (p.role === "Pace Bowler" || p.role === "Spin Bowler")).length;
  const getIndianBattersCount = (t: Team) => t.squad.map(id => players[id]).filter(p => p && isIndianBatter(p)).length;
  
  const shortTeams = Object.values(teams).filter(t => 
    t.squad.length < getMinSize(t) || 
    getBowlersCount(t) < 5 || 
    getKeepersCount(t) < 2 || 
    getSpinnersCount(t) < 2 ||
    getQualitySpinOptionsCount(t) < 2 ||
    getIndianBowlersCount(t) < 4 ||
    (t.id !== userTeamId && getIndianBattersCount(t) < 5)
  );
  if (shortTeams.length === 0) return;

  const takenPlayerIds = new Set<string>();
  Object.values(teams).forEach(t => t.squad.forEach(id => takenPlayerIds.add(id)));

  const pool = Object.values(players).filter(
    p => !p.isRetained
      && !takenPlayerIds.has(p.id)
      && p.currentTeamId === null
      && isPlayerAuctionEligible(p)
  );

  const sortedPool = [...pool].sort((a, b) => {
    if (a.isCapped !== b.isCapped) return a.isCapped ? 1 : -1;
    const priceA = a.basePrice ?? 30;
    const priceB = b.basePrice ?? 30;
    if (priceA !== priceB) return priceA - priceB;
    return (a.currentBatting + a.currentBowling) - (b.currentBatting + b.currentBowling);
  });

  for (const team of shortTeams) {
    while (
      team.squad.length < 25 &&
      (team.squad.length < getMinSize(team) || 
       getBowlersCount(team) < 5 || 
       getKeepersCount(team) < 2 || 
       getSpinnersCount(team) < 2 ||
       getQualitySpinOptionsCount(team) < 2 ||
       getIndianBowlersCount(team) < 4 ||
       (team.id !== userTeamId && getIndianBattersCount(team) < 5)) && 
      sortedPool.length > 0
    ) {
      const needsBowler = getBowlersCount(team) < 5;
      const needsKeeper = getKeepersCount(team) < 2;
      const needsSpinner = getSpinnersCount(team) < 2;
      const needsQualitySpinOption = getQualitySpinOptionsCount(team) < 2;
      const needsIndianBowler = getIndianBowlersCount(team) < 4;
      const needsIndianBatter = team.id !== userTeamId && getIndianBattersCount(team) < 5;
      
      let candidateIdx = 0;
      let candidate = null;

      while (candidateIdx < sortedPool.length) {
        const tempCandidate = sortedPool[candidateIdx];
        const isBowler = tempCandidate.role === "Pace Bowler" || tempCandidate.role === "Spin Bowler";
        const isSpinner = tempCandidate.role === "Spin Bowler";
        const isQualitySpinOption = isSpinBowlingPlayer(tempCandidate) && getAuctionBowlingRating(tempCandidate) > 74;
        const isWkCandidate = isWK(tempCandidate);
        const isIndBowler = tempCandidate.nationality === "Indian" && isBowler;
        const isIndBatter = isIndianBatter(tempCandidate);
        const rating = ratingOf(tempCandidate);
        const isIndian77PlusPriority = tempCandidate.nationality === "Indian" && rating >= 77;
        
        const overseasCount = team.squad.map(id => players[id]).filter(p => p && p.nationality === "Overseas").length;
        const overseasOk = !(tempCandidate.nationality === "Overseas" && overseasCount >= 8);

        const overseasKeeperCount = team.squad.map(id => players[id]).filter(
          p => p && p.nationality === "Overseas" && isWK(p)
        ).length;
        const overseasKeeperOk = !(
          tempCandidate.nationality === "Overseas" && isWK(tempCandidate) && overseasKeeperCount >= 3
        );

        if (overseasOk && overseasKeeperOk) {
          if (needsIndianBatter && isIndBatter) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          }
          if (isIndian77PlusPriority) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          }
          if (needsKeeper && isWkCandidate) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          } else if (needsIndianBowler && isIndBowler) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          } else if (!needsKeeper && !needsIndianBatter && !needsIndianBowler && needsQualitySpinOption && isQualitySpinOption) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          } else if (!needsKeeper && !needsIndianBatter && !needsIndianBowler && !needsQualitySpinOption && needsSpinner && isSpinner) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          } else if (!needsKeeper && !needsIndianBatter && !needsIndianBowler && !needsQualitySpinOption && !needsSpinner && needsBowler && isBowler) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          } else if (!needsKeeper && !needsIndianBatter && !needsIndianBowler && !needsQualitySpinOption && !needsSpinner && !needsBowler) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          }
        }
        candidateIdx++;
      }

      if (!candidate && team.squad.length < getMinSize(team)) {
        // Fallback: If we couldn't find a matching candidate, accept any player to fill the squad to minSquadSize
        candidateIdx = 0;
        while (candidateIdx < sortedPool.length) {
          const tempCandidate = sortedPool[candidateIdx];
          const overseasCount = team.squad.map(id => players[id]).filter(p => p && p.nationality === "Overseas").length;
          const overseasOk = !(tempCandidate.nationality === "Overseas" && overseasCount >= 8);

          const overseasKeeperCount = team.squad.map(id => players[id]).filter(
            p => p && p.nationality === "Overseas" && isWK(p)
          ).length;
          const overseasKeeperOk = !(
            tempCandidate.nationality === "Overseas" && isWK(tempCandidate) && overseasKeeperCount >= 3
          );

          if (overseasOk && overseasKeeperOk) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          }
          candidateIdx++;
        }
      }

      if (!candidate) {
        // No candidate could be found, break to prevent infinite loop
        break;
      }

      const cost = candidate.basePrice ?? 30;
      if (team.squad.length >= 18 && team.remainingPurse < cost) {
        // If they already have 18 players, they can't buy any more if they can't afford them!
        break;
      }

      team.squad.push(candidate.id);
      const actualCost = Math.min(team.remainingPurse, cost);
      team.remainingPurse = Math.max(0, team.remainingPurse - actualCost);
      team.spentAmount += actualCost;

      players[candidate.id] = {
        ...candidate,
        currentTeamId: team.id,
        iplHistory: [
          { teamId: team.id, season: getActiveSeasonYear(), price: cost },
          ...(candidate.iplHistory ?? [])
        ]
      };
    }
  }
}

export { hammerFall, advanceToNextLot, scheduleAIBids, ensureMinimumSquadSizes };
export type { }; // keep module boundary

if (typeof globalThis !== "undefined") {
  (globalThis as any).__getGameStoreState = useGameStore.getState;
}
