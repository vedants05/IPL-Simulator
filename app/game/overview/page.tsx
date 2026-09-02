"use client";
import { useState, useEffect, useLayoutEffect, useMemo, useRef, Suspense, Fragment, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useGameStore, getSeasonDates, INITIAL_ACTIVE_SEASON } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";
import { getTradeWindowDates, isTradeWindowOpen } from "@/lib/logic/tradeEngine";
import {
  addDaysToDateKey,
  dateKeyToLocalDate,
  daysBetweenDateKeys,
  findCalendarMonthIndex,
  getCareerCalendarStep,
  getCareerFastForwardStep,
  getDaySimulationIntervalMs,
  getSkipSimulationIntervalMs,
  isCareerCalendarAtImpasse,
  isCareerFastForwardTargetPending,
  TICKING_CALENDAR_OFFSETS,
} from "@/lib/logic/careerCalendar";
import { createDayTicker, type DayTickerController } from "@/lib/logic/dayTicker";
import {
  buildAiMatchLineups,
  findOptimalImpactBattingPosition,
  selectBattingFirstImpactBowler,
} from "@/lib/logic/aiLineupSelector";
import { type LineupPlan, validateLineup } from "@/lib/logic/lineupPlanner";
import {
  buildAutomaticLineupSelection,
  playerToLineupCandidate,
  type AutomaticLineupSelection,
} from "@/lib/logic/automaticLineupBuilder";
import { findSpecialOpenerPair } from "@/lib/logic/openerPairs";
import {
  generateBalancedLeagueFixtures,
  generateKnockoutFixtures,
  getLeagueSeasonStartDate,
  getMatchDisplayName,
  getKnockoutStageLabel,
  LEAGUE_FIXTURE_COUNT,
  LEAGUE_FIXTURE_SCHEDULE_VERSION,
  PLAYOFF_TBD_TEAM_ID,
  TOTAL_FIXTURE_COUNT,
  type KnockoutStage,
} from "@/lib/logic/leagueSchedule";
import {
  createTeamTactics,
  normalizeTeamTactics,
  type TeamTactics,
} from "@/lib/logic/teamTactics";
import {
  getPlayerSeasonHistory,
  mergePlayerIplHistory,
  upsertPlayerIplHistory,
  wasPlayerAcquiredViaRtm,
} from "@/lib/logic/playerHistory";
import {
  FIXTURE_SIMULATION_ENABLED,
  SEASON_ACCESS_ENABLED,
} from "@/lib/config/featureFlags";
import { getClubSeasonHistory, LAST_HISTORICAL_CLUB_SEASON } from "@/lib/data/clubHistory";
import { getAuctionTypeForSeason } from "@/lib/logic/auctionCycle";
import { getClubFigures, type ClubFigureTier } from "@/lib/data/clubFigures";
import { selectTeamOfSeason } from "@/lib/logic/teamOfSeason";
import { HISTORICAL_LEAGUE_HISTORY, LEAGUE_HISTORY_TEAMS } from "@/lib/data/leagueHistory";
import { OTHER_LEAGUE_RECORDS } from "@/lib/data/leagueRecords";
import { computeDynamicLeagueRecords } from "@/lib/logic/leagueRecordTracker";
import { appendRainAffectedResultLabel, isRainAffectedMatch } from "@/lib/logic/matchWeather";
import type { IplCareerMatchUpdate } from "@/lib/logic/iplCareerStats";
import type { CareerReputationAchievements } from "@/lib/logic/careerLifecycle";
import { formatStatValue } from "@/lib/logic/statFormatting";
import {
  DEEP_SCOUTING_DAYS,
  getBestPlayerScoutingReport,
  getPlayerScoutingConfidence,
  getScoutingRegion,
  SCOUTING_ASSIGNMENT_OPTIONS,
} from "@/lib/logic/scoutingAssignments";
import {
  createPlayerInjury,
  getInjuryReturnLabel,
  getPlayerMinorInjury,
  isPlayerMajorInjured,
  type InjuryProcessingResult,
  type PlayerInjury,
} from "@/lib/logic/injuries";
import {
  getInjuryReplacementPoolIds,
  getInjuredPlayerSalary,
  injuryQualifiesForReplacement,
  replacementForInjury,
} from "@/lib/logic/injuryReplacements";
import { getTeamColorStyle } from "@/lib/theme/teamColors";
import { cacheTeamProfileCareer } from "@/lib/logic/teamProfileCareerCache";
import { loadStaffDirectory } from "@/lib/logic/staffDirectoryClient";
import {
  captureSeasonStartBattingAbilities,
  captureSeasonStartBowlingAbilities,
} from "@/lib/logic/seasonAbilitySnapshot";
import {
  calculateBattingPerformanceBonus,
  calculateBowlingPerformanceBonus,
  extractMvpEventStats,
  rankEmergingPlayerCandidates,
  rankMvpCandidates,
} from "@/lib/logic/seasonAwards";
const LeagueHallOfFame = dynamic(() => import("@/components/history/LeagueHallOfFame"), { ssr: false });
const LeagueRecords = dynamic(() => import("@/components/history/LeagueRecords"), { ssr: false });
const MinorRecords = dynamic(() => import("@/components/history/MinorRecords"), { ssr: false });
import { applyMinorRecordBaselineUpdates, MINOR_RECORDS, type MinorRecord } from "@/lib/data/minorRecords";
import { trackMinorRecordsOnMatchComplete } from "@/lib/logic/minorRecordTracker";
const CaptaincyPage = dynamic(() => import("@/components/squad/CaptaincyPage"), { ssr: false });
const SquadAnalysisPage = dynamic(() => import("@/components/squad/SquadAnalysisPage"), { ssr: false });
const InjuryHubPage = dynamic(() => import("@/components/squad/InjuryHubPage"), { ssr: false });
import { InjuryStatusMarker } from "@/components/squad/InjuryStatusMarker";
const TradeHubPage = dynamic(() => import("@/components/scouting/TradeHubPage"), { ssr: false });
const SeasonDataAnalysisPage = dynamic(() => import("@/components/scouting/SeasonDataAnalysisPage"), { ssr: false });
const ScoutingAssignmentsPage = dynamic(() => import("@/components/scouting/ScoutingAssignmentsPage"), { ssr: false });
import TacticsLineupBuilder from "@/components/squad/TacticsLineupBuilder";
const TeamTacticsPage = dynamic(() => import("@/components/squad/TeamTacticsPage"), { ssr: false });
const PitchCuratorPage = dynamic(() => import("@/components/club/PitchCuratorPage"), { ssr: false });
const StadiumManagementPage = dynamic(() => import("@/components/club/StadiumManagementPage"), { ssr: false });
const StaffManagementPage = dynamic(() => import("@/components/club/StaffManagementPage"), { ssr: false });
const BoardOverviewPage = dynamic(() => import("@/components/club/BoardOverviewPage"), { ssr: false });
const SupportersPage = dynamic(() => import("@/components/club/SupportersPage"), { ssr: false });
const SocialMediaPage = dynamic(() => import("@/components/social/SocialMediaPage"), { ssr: false });
const NewsPage = dynamic(() => import("@/components/news/NewsPage"), { ssr: false });
import { getClubOwnership } from "@/lib/data/clubOwnership";
import { checkEmergencyBudgetExtensionApproval, STAFF_SALARY_MODEL_VERSION } from "@/lib/logic/staffContracts";
import {
  calculateSeasonUnderperformancePressure,
  calculateEffectiveJobPressure,
  getStaffJobSecurityState,
} from "@/lib/logic/staffJobSecurity";
import { calculateStaffExpectedRanks } from "@/lib/logic/staffPerformanceReview";
import { PlayerProfileModal } from "@/components/player/PlayerProfileModal";
import { PlayoffDiagramContent, ScheduleTileContent } from "@/components/season/ScheduleTileContent";
import TournamentStatsDashboard from "@/components/season/TournamentStatsDashboard";
import { getCuratorPitch, getDefaultCuratorPitch, getHomeStadium, HOME_STADIUMS } from "@/lib/data/pitchCurator";
import {
  calculateGroundScoringImpact,
  calculateOutfieldScoringImpact,
  calculateOutfieldSpeedRating,
  getDefaultOutfieldSettings,
} from "@/lib/logic/stadiumManagement";
import {
  createIntelligentAiTactics,
  getMatchPreparationWarnings,
  oversFromBalls,
  simulateInstantMatch,
  type MatchGroundConditions,
  type MatchInnings,
  type MatchLineupPlan,
  type MatchSimulationInput,
  type MatchSimulationRecord,
  type MatchTeamPlans,
} from "@/lib/logic/matchSimulation";
import {
  compactMatchSimulation,
  deleteMatchSimulationsBeforeSeason,
  hasArchivedDeliveries,
  loadMatchSimulations,
  saveMatchSimulations,
  waitForPendingMatchSimulationWrites,
} from "@/lib/logic/matchSimulationStorage";
import BallByBallSummary from "@/components/match/BallByBallSummary";
import PlayableMatchEngine, { type PlayableMatchSession } from "@/components/match/PlayableMatchEngine";
import {
  EMPTY_TEAM_LEADERSHIP,
  getCaptainChangeGamesRemaining,
  normalizeTeamLeadership,
  restoreTeamLeadershipContinuity,
  type TeamLeadership,
} from "@/lib/logic/captaincy";
import {
  appointAiLeagueLeadership,
  appointAiTeamLeadership,
  reconcileAiLeagueLeadership,
  type AiLeagueLeadership,
} from "@/lib/logic/aiLeadership";
import {
  buildCareerEmailDrafts,
  getCareerEmailReadKeys,
  orderCareerEmailThread,
  reconcileCareerEmails,
  restoreCareerEmailReadState,
  type CareerEmail,
  type CareerEmailAction,
  type CareerEmailLineupStatus,
} from "@/lib/logic/careerEmails";
import type { IPLHistoryEntry, Player, Team } from "@/lib/types";
import {
  Inbox as InboxIcon,
  Briefcase,
  Users,
  Sliders,
  HeartHandshake,
  Activity,
  Search,
  FileText,
  Calendar,
  Table,
  Trophy,
  History as HistoryIcon,
  Lock,
  Check,
  X,
  UserCheck,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Heart,
  Info,
  DollarSign,
  Play,
  SkipForward,
  Mail,
  MailOpen,
  ArrowUpRight,
  Crown,
  ShieldCheck,
} from "lucide-react";

interface PlayerStats {
  id: string;
  name: string;
  teamId: string;
  runs: number;
  balls: number;
  wickets: number;
  runsConceded: number;
  oversBowled: number;
  matches: number;
  dismissals?: number;
  highestScore: number;
  bestBowling: string;
  fours?: number;
  sixes?: number;
  dotBalls?: number;
  catches?: number;
  stumpings?: number;
  runOuts?: number;
  maidens?: number;
  battingPerformanceBonus?: number;
  bowlingPerformanceBonus?: number;
  mvpPoints?: number;
  matchesCaptained?: number;
  matchesViceCaptained?: number;
}

interface LeagueStandings {
  teamId: string;
  teamName: string;
  shortName: string;
  played: number;
  won: number;
  lost: number;
  noResults: number;
  points: number;
  nrr: number;
  wicketsTaken: number;
}

interface ScorecardPlayer {
  name: string;
  id: string;
  runs?: number;
  balls?: number;
  fours?: number;
  sixes?: number;
  overs?: number;
  wickets?: number;
  runsConceded?: number;
  maidens?: number;
  dismissal?: string;
  wides?: number;
  noBalls?: number;
}

interface InningsScorecard {
  batting: ScorecardPlayer[];
  bowling: ScorecardPlayer[];
  extras: number;
}

interface MatchScorecard {
  inningsA: InningsScorecard;
  inningsB: InningsScorecard;
}

interface Match {
  id: string;
  matchNumber: number;
  round: number;
  teamA: string;
  teamB: string;
  played: boolean;
  scoreA?: { runs: number; wickets: number; overs: number };
  scoreB?: { runs: number; wickets: number; overs: number };
  winner?: string;
  commentary?: string[];
  scorecard?: MatchScorecard;
  simulation?: MatchSimulationRecord;
  date?: string;
  time?: string;
  stage?: KnockoutStage;
  label?: string;
  archivedResultText?: string;
}

function toIplCareerMatchUpdate(match: Match, season: number): IplCareerMatchUpdate | null {
  if (!match.played || !match.simulation) return null;
  const fixtureSeasonText = String(match.date ?? "").slice(0, 4);
  const fixtureSeason = Number(fixtureSeasonText);
  if (fixtureSeasonText && Number.isFinite(fixtureSeason) && fixtureSeason !== season) return null;
  return {
    key: `${season}:${match.simulation.fixtureId}:${match.simulation.seed}`,
    simulation: match.simulation,
  };
}

function calculateSeasonAwardLeaders(
  stats: Record<string, PlayerStats>,
  players: Record<string, Player>,
  season: number,
  simulatedHistory: Array<{ season: number; emergingPlayer?: { name: string } }>,
) {
  const seasonStats = Object.values(stats);
  const previousEmergingWinners = [
    ...HISTORICAL_LEAGUE_HISTORY,
    ...simulatedHistory,
  ]
    .filter((record) => record.season < season && record.emergingPlayer)
    .map((record) => record.emergingPlayer!.name);
  return {
    mvp: rankMvpCandidates(seasonStats)[0] ?? null,
    emerging: rankEmergingPlayerCandidates({
      stats: seasonStats,
      players,
      season,
      initialSeason: INITIAL_ACTIVE_SEASON,
      previousWinnerNames: previousEmergingWinners,
    })[0] ?? null,
  };
}

function buildCareerReputationAchievements(
  fixtures: Match[],
  stats: Record<string, PlayerStats>,
  awards: ReturnType<typeof calculateSeasonAwardLeaders>,
  players: Record<string, Player>,
): CareerReputationAchievements {
  const final = fixtures.find((fixture) => fixture.stage === "final" && fixture.played && fixture.winner);
  const winningLineup = final?.winner ? final.simulation?.lineups[final.winner] : undefined;
  const finalPlayerIds = new Set<string>();
  if (final?.simulation) {
    Object.values(final.simulation.lineups).forEach((lineup) => {
      [...lineup.startingXI, ...lineup.finalXI].forEach((playerId) => finalPlayerIds.add(playerId));
    });
  }
  const playerOfMatchCounts: Record<string, number> = {};
  const playoffPlayerOfMatchCounts: Record<string, number> = {};
  fixtures.forEach((fixture) => {
    const playerId = fixture.played ? fixture.simulation?.playerOfTheMatchId : undefined;
    if (!playerId) return;
    playerOfMatchCounts[playerId] = (playerOfMatchCounts[playerId] ?? 0) + 1;
    if (fixture.stage) {
      playoffPlayerOfMatchCounts[playerId] = (playoffPlayerOfMatchCounts[playerId] ?? 0) + 1;
    }
  });
  const seasonStats = Object.values(stats);
  const orangeCap = [...seasonStats]
    .filter((entry) => entry.runs > 0)
    .sort((left, right) => right.runs - left.runs || left.name.localeCompare(right.name))[0];
  const purpleCap = [...seasonStats]
    .filter((entry) => entry.wickets > 0)
    .sort((left, right) => right.wickets - left.wickets || left.name.localeCompare(right.name))[0];
  return {
    seasonMvpPlayerId: awards.mvp?.id ?? null,
    emergingPlayerId: awards.emerging?.id ?? null,
    orangeCapPlayerId: orangeCap?.id ?? null,
    purpleCapPlayerId: purpleCap?.id ?? null,
    championCaptainId: winningLineup?.captainId ?? null,
    championFinalPlayerIds: Array.from(finalPlayerIds),
    championTeamId: final?.winner ?? null,
    teamOfSeasonPlayerIds: selectTeamOfSeason(players, seasonStats).map((selection) => selection.player.id),
    playerOfMatchCounts,
    playoffPlayerOfMatchCounts,
  };
}

function fixturesForCareerHistory(fixtures: Match[]) {
  return fixtures
    .filter((fixture) => Boolean(fixture.stage) || fixture.matchNumber > LEAGUE_FIXTURE_COUNT)
    .map((fixture) => ({
      id: fixture.id,
      matchNumber: fixture.matchNumber,
      round: fixture.round,
      teamA: fixture.teamA,
      teamB: fixture.teamB,
      played: fixture.played,
      scoreA: fixture.scoreA,
      scoreB: fixture.scoreB,
      winner: fixture.winner,
      date: fixture.date,
      time: fixture.time,
      stage: fixture.stage,
      label: fixture.label,
      archivedResultText: fixture.simulation?.resultText ?? fixture.archivedResultText,
    }));
}

function getArchivedPartnershipContribution(
  innings: MatchInnings,
  partnershipIndex: number,
  batterId: string | undefined,
): { runs: number; balls: number } | null {
  if (!batterId || innings.oversDetail.length === 0) return null;
  let activePartnershipIndex = 0;
  let runs = 0;
  let balls = 0;
  for (const over of innings.oversDetail) {
    for (const delivery of over.deliveries) {
      if (activePartnershipIndex === partnershipIndex && delivery.strikerId === batterId) {
        runs += delivery.runsOffBat;
        if (delivery.isLegal) balls += 1;
      }
      if (delivery.wicket) activePartnershipIndex += 1;
      if (activePartnershipIndex > partnershipIndex) return { runs, balls };
    }
  }
  return activePartnershipIndex === partnershipIndex ? { runs, balls } : null;
}

type MatchResultView = "scorecard" | "summary" | "ball-by-ball";
const CAREER_FAST_FORWARD_RECOVERY_KEY = "ipl-career-fast-forward-target";

interface PendingMatchPreparation {
  matchId: string;
  errors: string[];
  warnings: string[];
  warningDestination: "playingxi" | "tactics";
}

const isIncomingImpactPlayer = (match: Match, playerId: string) => (
  match.simulation?.impactDecisions.some((decision) => (
    decision.used && decision.incomingPlayerId === playerId
  )) ?? false
);

const isOutgoingImpactPlayer = (match: Match, playerId: string) => (
  match.simulation?.impactDecisions.some((decision) => (
    decision.used && decision.outgoingPlayerId === playerId
  )) ?? false
);

interface RetentionDeadline {
  year: number;
  month: number;
  day: number;
}

type RosterView = "general" | "bowling" | "batting" | "ipl";
type RosterSortKey =
  | "name" | "age" | "role" | "nationality" | "rating" | "potential" | "salary"
  | "bowlingCA" | "bowlingPA" | "seasonMatches" | "seasonWickets" | "seasonBowlingAverage" | "seasonEconomy" | "seasonBestBowling"
  | "battingCA" | "battingPA" | "seasonRuns" | "seasonBattingAverage" | "seasonStrikeRate" | "seasonHighScore"
  | "iplMatches" | "iplRuns" | "iplBattingAverage" | "iplStrikeRate" | "iplWickets" | "iplBowlingAverage";
type SortDirection = "asc" | "desc";

// ============================================================================
// Static Data Templates
// ============================================================================

const generateNextRetentionDeadline = (activeSeason: number): RetentionDeadline => {
  const retentionDate = getSeasonDates(activeSeason + 1).retentionDate;
  return {
    year: Number(retentionDate.slice(0, 4)),
    month: Number(retentionDate.slice(5, 7)) - 1,
    day: Number(retentionDate.slice(8, 10)),
  };
};

// Helper to calculate rating of player
const getPlayerRating = (p: Player) => Math.max(p.currentBatting ?? 0, p.currentBowling ?? 0);
const getCompactPlayerRole = (role: Player["role"]) => ({
  Batsman: "BAT",
  "WK-Batsman": "WK",
  "All-Rounder": "AR",
  "Pace Bowler": "PACE",
  "Spin Bowler": "SPIN",
}[role]);
const normalizeLeagueHistoryPlayerName = (name: string) => name.toLocaleLowerCase("en-GB").replace(/[^a-z0-9]/g, "");
const CALENDAR_SELECTED_COLOR = "#2563eb";

function ClubProfileSummaryTile({
  team,
  season,
  headCoach,
  mentor,
  captain,
  viceCaptain,
  featuredPlayers,
}: {
  team: Team;
  season: number;
  headCoach?: string | null;
  mentor?: string | null;
  captain: Player | null;
  viceCaptain: Player | null;
  featuredPlayers: readonly Player[];
}) {
  return (
    <Link
      href={`/game/teams/${team.id}`}
      className="group relative flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-surface p-6 text-left transition-colors hover:border-accent lg:col-span-2 lg:row-span-3"
      style={{
        backgroundImage: `linear-gradient(135deg, ${team.primaryColor}24 0%, transparent 52%)`,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: team.primaryColor }}
      />
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#16130f]/10 pb-4">
        <div>
          <div className="font-space-mono text-[8px] font-bold uppercase tracking-[0.2em] text-text-secondary">
            Your club · Season {season}
          </div>
          <div className="mt-1 font-anton text-[18px] uppercase text-text-primary">Club Profile</div>
        </div>
        <span className="flex items-center gap-1.5 rounded border border-border bg-surface/75 px-3 py-2 font-space-mono text-[8px] font-bold uppercase text-text-primary transition-colors group-hover:border-accent group-hover:text-accent">
          Open profile <ArrowUpRight size={12} />
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-5 text-center">
        <div
          className="flex size-28 shrink-0 items-center justify-center rounded-full border-[6px] border-white/75 font-anton text-[30px] shadow-lg"
          style={{ backgroundColor: team.primaryColor, color: team.secondaryColor }}
        >
          {team.shortName}
        </div>
        <div className="mt-5 min-w-0">
          <h3 className="max-w-3xl font-anton text-[clamp(30px,3.25vw,48px)] uppercase leading-[0.92] text-text-primary">
            {team.name}
          </h3>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">
            <span>{team.city}</span>
            <span className="size-1 rounded-full bg-accent" />
            <span>{team.homeGround}</span>
          </div>
        </div>
      </div>

      <div className="grid shrink-0 gap-3 border-t border-[#16130f]/10 pt-4 md:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <div className="rounded-lg border border-border bg-surface/75 p-3">
          <div className="font-space-mono text-[7px] font-bold uppercase tracking-[0.16em] text-text-secondary">Leadership</div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
            <div className="min-w-0">
              <div className="font-space-mono text-[6px] font-bold uppercase text-accent">Head Coach</div>
              <div className="mt-0.5 truncate font-barlow text-xs font-bold text-text-primary">{headCoach ?? "Unappointed"}</div>
            </div>
            {mentor && (
              <div className="min-w-0">
                <div className="font-space-mono text-[6px] font-bold uppercase text-accent">Mentor</div>
                <div className="mt-0.5 truncate font-barlow text-xs font-bold text-text-primary">{mentor}</div>
              </div>
            )}
            <div className="min-w-0">
              <div className="font-space-mono text-[6px] font-bold uppercase text-accent">Captain</div>
              <div className="mt-0.5 truncate font-barlow text-xs font-bold text-text-primary">{captain?.name ?? "Not appointed"}</div>
            </div>
            <div className="min-w-0">
              <div className="font-space-mono text-[6px] font-bold uppercase text-accent">Vice-captain</div>
              <div className="mt-0.5 truncate font-barlow text-xs font-bold text-text-primary">{viceCaptain?.name ?? "Not appointed"}</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface/75 p-3">
          <div className="font-space-mono text-[7px] font-bold uppercase tracking-[0.16em] text-text-secondary">Leading players</div>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {featuredPlayers.map((player) => (
              <div key={player.id} className="min-w-0">
                <div className="truncate font-barlow text-[10px] font-bold text-text-primary">{player.name}</div>
                <div className="mt-0.5 font-space-mono text-[7px] font-bold text-accent">{getPlayerRating(player)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

function ManagerOfficeSummaryTile({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full min-h-0 cursor-pointer flex-col items-stretch justify-start overflow-hidden rounded-lg border-2 border-border bg-surface p-5 text-left align-top transition-colors hover:border-accent"
    >
      <div className="mb-4 flex shrink-0 items-start justify-between border-b border-[#16130f]/10 pb-2">
        <div className="font-anton text-[14px] uppercase text-text-primary">OFFICE SUMMARY</div>
      </div>
      <div className="space-y-4">
        <div>
          <div className="mb-1 flex justify-between font-space-mono text-xs text-text-secondary">
            <span>BOARD CONFIDENCE</span>
            <span className="font-bold text-text-primary">--%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-[#16130f]/10">
            <div className="h-full bg-success" style={{ width: "0%" }} />
          </div>
        </div>
        <div className="font-space-mono text-xs text-text-secondary">
          CONTRACT: <span className="font-bold text-text-primary">--</span>
        </div>
      </div>
    </button>
  );
}

function PitchCuratorSummaryTile({
  stadiumName,
  pitchName,
  pitchCount,
  scoreRange,
  onOpen,
}: {
  stadiumName: string;
  pitchName: string;
  pitchCount: number;
  scoreRange: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="cursor-pointer overflow-hidden rounded-lg border-2 border-border bg-surface p-5 text-left transition-colors hover:border-accent"
    >
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-[#16130f]/10 pb-2">
        <div>
          <div className="font-anton text-[14px] uppercase text-text-primary">PITCH CURATOR</div>
          <div className="mt-1 truncate font-space-mono text-[7px] font-bold uppercase text-text-secondary">{stadiumName}</div>
        </div>
        <span className="rounded-full bg-accent/15 px-2 py-1 font-space-mono text-[7px] font-bold uppercase text-accent">
          {pitchCount} pitches
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <div className="min-w-0">
          <div className="font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Current surface</div>
          <div className="mt-1 truncate text-[11px] font-bold text-text-primary">{pitchName}</div>
        </div>
        <div className="text-right">
          <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Expected</div>
          <div className="mt-1 font-anton text-[16px] leading-none text-success">{scoreRange}</div>
        </div>
      </div>
    </button>
  );
}

function StadiumManagementSummaryTile({
  stadiumName,
  capacity,
  straightMetres,
  wideMetres,
  outfieldSpeed,
  onOpen,
}: {
  stadiumName: string;
  capacity: number;
  straightMetres: number;
  wideMetres: number;
  outfieldSpeed: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="cursor-pointer overflow-hidden rounded-lg border-2 border-border bg-surface p-5 text-left transition-colors hover:border-accent"
    >
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-[#16130f]/10 pb-2">
        <div className="min-w-0">
          <div className="font-anton text-[14px] uppercase text-text-primary">STADIUM MANAGEMENT</div>
          <div className="mt-1 truncate font-space-mono text-[7px] font-bold uppercase text-text-secondary">
            {stadiumName}
          </div>
        </div>
        <span className="rounded-full bg-success/15 px-2 py-1 font-space-mono text-[7px] font-bold uppercase text-success">
          {outfieldSpeed}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Capacity</div>
          <div className="mt-1 font-anton text-[16px] leading-none text-text-primary">
            {new Intl.NumberFormat("en-GB").format(capacity)}
          </div>
        </div>
        <div>
          <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Straight</div>
          <div className="mt-1 font-anton text-[16px] leading-none text-text-primary">{straightMetres}M</div>
        </div>
        <div>
          <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Wide</div>
          <div className="mt-1 font-anton text-[16px] leading-none text-text-primary">{wideMetres}M</div>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Main component
// ============================================================================
function OverviewPageContent() {
  const router = useRouter();
  const {
    teams,
    userTeamId,
    players,
    currentDate,
    currentSeason,
    fixtureSeed,
    auction,
    clubFigureTierOverrides,
    clubFigureProgression,
    simulatedLeagueHistory,
    careerSeasonArchives,
    homePitchSelections,
    homeBoundaryDimensions,
    boundaryPresetsByTeam,
    homeOutfieldSettings,
    outfieldProjectsByTeam,
    customPitchesByTeam,
    pitchProjectsByTeam,
    setHomePitchSelection,
    setHomeBoundaryDimensions,
    saveBoundaryPreset,
    applyBoundaryPreset,
    deleteBoundaryPreset,
    startOutfieldPreparation,
    reconcileOutfieldProjects,
    startPitchCreation,
    startPitchDestruction,
    reconcilePitchProjects,
    recordSimulatedLeagueSeason,
    recordIplMatchStats,
    beginNextSeasonRetention,
    archiveCareerSeason,
    careerFastForwardTargetDate,
    setCareerFastForwardTarget,
    completeOffseasonAutomatically,
    activeInjuries,
    injuryHistory,
    injuryReplacementRecords,
    tradeRecords,
    tradeNegotiationCooldowns,
    retiredPlayerSnapshots,
    lastCareerRetirements,
    careerRetirementHistory,
    processMatchInjuries,
    processBackgroundInjuries,
    reconcileInjuries,
    signInjuryReplacement,
    processAIInjuryReplacements,
    executeTrade,
    setTradeNegotiationCooldown,
    processAITrades,
    scoutingReports,
    scoutingAssignments,
    reconcileScoutingAssignments,
    reconcileAIStaffRecruitment,
    careerStaff,
    initializeCareerStaff,
  } = useGameStore();
  const matchArchiveCareerId = `${userTeamId}:${currentSeason}:${fixtureSeed}`;
  const userTeam = teams[userTeamId];
  const injuryReplacementPoolIds = useMemo(
    () => getInjuryReplacementPoolIds(players, auction),
    [auction, players],
  );
  const userHomeStadium = getHomeStadium(userTeamId);
  const userDefaultPitch = getDefaultCuratorPitch(userTeamId);
  const userCustomPitches = userHomeStadium
    ? customPitchesByTeam[userHomeStadium.teamId] ?? []
    : [];
  const userSelectedPitch = getCuratorPitch(
    userHomeStadium ? homePitchSelections[userHomeStadium.teamId] : "",
  ) ?? userCustomPitches.find((pitch) => (
    pitch.id === (userHomeStadium ? homePitchSelections[userHomeStadium.teamId] : "")
  )) ?? userDefaultPitch;
  const userPitchProject = userHomeStadium
    ? pitchProjectsByTeam[userHomeStadium.teamId] ?? null
    : null;
  const userBoundaryDimensions = userHomeStadium
    ? homeBoundaryDimensions[userHomeStadium.teamId]
    : { straightMetres: 70, wideMetres: 70 };
  const userBoundaryPresets = userHomeStadium
    ? boundaryPresetsByTeam[userHomeStadium.teamId] ?? []
    : [];
  const userOutfieldSettings = userHomeStadium
    ? homeOutfieldSettings[userHomeStadium.teamId]
    : getDefaultOutfieldSettings(userTeamId);
  const userOutfieldProject = userHomeStadium
    ? outfieldProjectsByTeam[userHomeStadium.teamId] ?? null
    : null;
  const userOutfieldImpact = userOutfieldSettings
    ? calculateOutfieldScoringImpact(userTeamId, userOutfieldSettings)
    : null;

  useEffect(() => {
    reconcilePitchProjects();
    reconcileOutfieldProjects();
    reconcileScoutingAssignments(currentDate);
    reconcileAIStaffRecruitment(currentDate);
  }, [careerStaff.initialized, currentDate, reconcileAIStaffRecruitment, reconcileOutfieldProjects, reconcilePitchProjects, reconcileScoutingAssignments]);

  // Dynamically generate months based on currentSeason
  const CALENDAR_MONTHS = useMemo(() => {
    return Array.from({ length: 12 }, (_, offset) => {
      const month = (11 + offset) % 12;
      const year = currentSeason - 1 + Math.floor((11 + offset) / 12);
      return { month, year, label: new Date(year, month).toLocaleString("en-GB", { month: "long" }) };
    });
  }, [currentSeason]);

  // Redirect back to auction if not completed or not continued to season
  useEffect(() => {
    if (typeof window !== "undefined") {
      const continued = localStorage.getItem(`ipl_continued_to_season_${userTeamId}`) === "true";
      if (!SEASON_ACCESS_ENABLED || !auction || auction.phase !== "completed" || !continued) {
        router.replace("/game/auction");
      }
    }
  }, [auction, router, userTeamId]);

  // --------------------------------------------------------------------------
  // Core UI Tabs State
  // --------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<"home" | "club" | "squad" | "scouting" | "season" | "league" | "history">("home");
  const [activeSubTab, _setActiveSubTab] = useState<string>("overview");
  const [expandedLeagueHistorySeason, setExpandedLeagueHistorySeason] = useState<number | null>(null);

  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const subtabParam = searchParams.get("subtab");

  // Read URL params reactively whenever they change
  useEffect(() => {
    if (tabParam === "home" && subtabParam === "office") {
      router.replace("/game/overview?tab=club&subtab=office", { scroll: false });
      return;
    }
    if (tabParam === "scouting" && subtabParam === "trades") {
      router.replace("/game/overview?tab=league&subtab=trades", { scroll: false });
      return;
    }
    if (tabParam === "league" && subtabParam === "board") {
      router.replace("/game/overview?tab=league&subtab=overview", { scroll: false });
      return;
    }
    if (tabParam === "home" || tabParam === "club" || tabParam === "squad" || tabParam === "scouting" || tabParam === "season" || tabParam === "league" || tabParam === "history") {
      setActiveTab(tabParam as any);
      _setActiveSubTab(subtabParam || "overview");
    }
  }, [router, tabParam, subtabParam]);

  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab: string; subtab?: string }>;
      if (customEvent.detail?.tab && ["home", "club", "squad", "scouting", "season", "league", "history"].includes(customEvent.detail.tab)) {
        setActiveTab(customEvent.detail.tab as any);
        _setActiveSubTab(customEvent.detail.subtab || "overview");
      }
    };
    window.addEventListener("ipl_switch_tab", handleSwitchTab);
    return () => window.removeEventListener("ipl_switch_tab", handleSwitchTab);
  }, []);

  const setActiveSubTab = (newSubTab: string) => {
    _setActiveSubTab(newSubTab);
    router.push(`/game/overview?tab=${activeTab}&subtab=${newSubTab}`, { scroll: false });
  };

  // --------------------------------------------------------------------------
  // Simulation & Career States (Saved in LocalStorage)
  // --------------------------------------------------------------------------
  const [fixtures, setFixtures] = useState<Match[]>([]);
  const [detailedFixtureSimulations, setDetailedFixtureSimulations] = useState<Record<string, MatchSimulationRecord>>({});
  const [standings, setStandings] = useState<LeagueStandings[]>([]);
  const [standingsView, setStandingsView] = useState<"league" | "playoffs">("league");
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({});
  const [seasonStartBattingAbilities, setSeasonStartBattingAbilities] = useState<Record<string, number>>({});
  const [seasonStartBowlingAbilities, setSeasonStartBowlingAbilities] = useState<Record<string, number>>({});
  const [minorRecords, setMinorRecords] = useState<MinorRecord[]>(MINOR_RECORDS);
  const [inbox, setInbox] = useState<CareerEmail[]>([]);
  const [isCareerLoaded, setIsCareerLoaded] = useState(false);
  const careerStaffNeedsProfileSync = !careerStaff.initialized
    || careerStaff.salaryModelVersion < STAFF_SALARY_MODEL_VERSION
    || Object.values(careerStaff.contracts).some((contract) => (
      !contract.roleRatings || Object.keys(contract.roleRatings).length === 0
    ));

  useEffect(() => {
    if (!isCareerLoaded || !careerStaffNeedsProfileSync) return;
    let active = true;
    void loadStaffDirectory()
      .then((directory) => {
        if (active) initializeCareerStaff(
          directory.members as Parameters<typeof initializeCareerStaff>[0],
          directory.assignments,
        );
      })
      .catch((error) => {
        if (!active) return;
        console.error("Unable to initialize career staff:", error);
      });
    return () => { active = false; };
  }, [careerStaffNeedsProfileSync, initializeCareerStaff, isCareerLoaded]);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [battingFirstXI, setBattingFirstXI] = useState<string[]>([]);
  const [bowlingFirstXI, setBowlingFirstXI] = useState<string[]>([]);
  const [battingFirstImpactSubs, setBattingFirstImpactSubs] = useState<string[]>([]);
  const [bowlingFirstImpactSubs, setBowlingFirstImpactSubs] = useState<string[]>([]);
  const [battingFirstImpactPlayerId, setBattingFirstImpactPlayerId] = useState<string | null>(null);
  const [battingFirstOutgoingPlayerId, setBattingFirstOutgoingPlayerId] = useState<string | null>(null);
  const [battingFirstImpactBattingPosition, setBattingFirstImpactBattingPosition] = useState<number | null>(null);
  const [bowlingFirstImpactPlayerId, setBowlingFirstImpactPlayerId] = useState<string | null>(null);
  const [bowlingFirstOutgoingPlayerId, setBowlingFirstOutgoingPlayerId] = useState<string | null>(null);
  const [bowlingFirstImpactBattingPosition, setBowlingFirstImpactBattingPosition] = useState<number | null>(null);
  const [teamTactics, setTeamTactics] = useState<TeamTactics>(() => createTeamTactics());
  const [teamLeadership, setTeamLeadership] = useState<TeamLeadership>(() => ({ ...EMPTY_TEAM_LEADERSHIP }));
  const [aiTeamLeadership, setAiTeamLeadership] = useState<AiLeagueLeadership>({});
  const [activeCommentary, setActiveCommentary] = useState<string[] | null>(null);
  const [activeScorecard, setActiveScorecard] = useState<Match | null>(null);
  const [activeMatchResultView, setActiveMatchResultView] = useState<MatchResultView>("scorecard");
  const [activeScorecardInningsTeam, setActiveScorecardInningsTeam] = useState<"teamA" | "teamB">("teamA");
  const [pendingMatchPreparation, setPendingMatchPreparation] = useState<PendingMatchPreparation | null>(null);
  const [activePlayedMatch, setActivePlayedMatch] = useState<PlayableMatchSession | null>(null);
  const [shortlist, setShortlist] = useState<string[]>([]);

  // Club profiles are reached from this page, so keep their read-only career
  // projection in memory. This avoids synchronously reading and parsing the
  // complete localStorage career save during navigation.
  useEffect(() => {
    if (!isCareerLoaded || !userTeamId) return;
    cacheTeamProfileCareer(userTeamId, {
      fixtures,
      standings,
      playerStats,
      battingFirstXI,
      bowlingFirstXI,
      battingFirstImpactSubs,
      bowlingFirstImpactSubs,
      battingFirstImpactPlayerId,
      battingFirstOutgoingPlayerId,
      battingFirstImpactBattingPosition,
      bowlingFirstImpactPlayerId,
      bowlingFirstOutgoingPlayerId,
      bowlingFirstImpactBattingPosition,
      teamLeadership,
      aiTeamLeadership,
    });
  }, [
    aiTeamLeadership,
    battingFirstImpactBattingPosition,
    battingFirstImpactPlayerId,
    battingFirstImpactSubs,
    battingFirstOutgoingPlayerId,
    battingFirstXI,
    bowlingFirstImpactBattingPosition,
    bowlingFirstImpactPlayerId,
    bowlingFirstImpactSubs,
    bowlingFirstOutgoingPlayerId,
    bowlingFirstXI,
    fixtures,
    isCareerLoaded,
    playerStats,
    standings,
    teamLeadership,
    userTeamId,
  ]);
  
  // Local state for interactive tools
  const [searchQuery, setSearchQuery] = useState("");
  const [filterNationality, setFilterNationality] = useState<"all" | "indian_capped" | "indian_uncapped" | "overseas">("all");
  const [filterRole, setFilterRole] = useState<"all" | "Batsman" | "WK-Batsman" | "All-Rounder" | "Pace Bowler" | "Spin Bowler">("all");
  const [minRating, setMinRating] = useState<number>(60);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const userGamesPlayed = useMemo(() => fixtures.filter((fixture) => (
    fixture.played && (fixture.teamA === userTeamId || fixture.teamB === userTeamId)
  )).length, [fixtures, userTeamId]);
  useEffect(() => {
    if (!activeScorecard) return;
    setActiveScorecardInningsTeam(
      activeScorecard.simulation?.battingFirstTeamId === activeScorecard.teamB ? "teamB" : "teamA",
    );
  }, [activeScorecard?.id]);

  // Keep the season fixture graph compact. Full deliveries are hydrated only
  // for views that genuinely inspect them, then released when the view closes.
  const detailedFixtures = useMemo(() => {
    if (Object.keys(detailedFixtureSimulations).length === 0) return fixtures;
    return fixtures.map((fixture) => (
      detailedFixtureSimulations[fixture.id]
        ? { ...fixture, simulation: detailedFixtureSimulations[fixture.id] }
        : fixture
    ));
  }, [detailedFixtureSimulations, fixtures]);
  useEffect(() => {
    const needsLeagueDetails = activeSubTab === "social"
      || activeSubTab === "news"
      || activeSubTab === "seasonanalysis";
    if (!needsLeagueDetails) {
      setDetailedFixtureSimulations((current) => Object.keys(current).length > 0 ? {} : current);
      return;
    }
    const fixtureIds = fixtures
      .filter((fixture) => fixture.simulation && !hasArchivedDeliveries(fixture.simulation))
      .map((fixture) => fixture.id);
    if (fixtureIds.length === 0) return;
    let cancelled = false;
    void loadMatchSimulations(matchArchiveCareerId, fixtureIds)
      .then((archived) => {
        if (!cancelled) setDetailedFixtureSimulations(archived);
      })
      .catch((error) => console.error("Unable to hydrate detailed match view:", error));
    return () => { cancelled = true; };
  }, [activeSubTab, fixtures, matchArchiveCareerId]);

  // A scorecard carries compact innings immediately; hydrate only its full
  // delivery archive for the existing ball-by-ball tab.
  useEffect(() => {
    if (!activeScorecard?.simulation || hasArchivedDeliveries(activeScorecard.simulation)) return;
    let cancelled = false;
    void loadMatchSimulations(matchArchiveCareerId, [activeScorecard.id])
      .then((archived) => {
        if (cancelled || !archived[activeScorecard.id]) return;
        setActiveScorecard((current) => current?.id === activeScorecard.id
          ? { ...current, simulation: archived[activeScorecard.id] }
          : current);
      })
      .catch((error) => console.error("Unable to hydrate match scorecard archive:", error));
    return () => { cancelled = true; };
  }, [activeScorecard?.id, activeScorecard?.simulation, matchArchiveCareerId]);

  // Day-by-day career ticking simulation states & refs
  const [isSimulatingDays, setIsSimulatingDays] = useState(false);
  const [isCalendarClosing, setIsCalendarClosing] = useState(false);
  const [seasonTransitionStage, setSeasonTransitionStage] = useState<string | null>(null);
  const [fastForwardElapsedMs, setFastForwardElapsedMs] = useState(0);
  const fastForwardStartedAtRef = useRef<number | null>(null);
  const fastForwardOriginDateRef = useRef<string | null>(null);
  const [pendingSkipTargetDate, setPendingSkipTargetDate] = useState<string | null>(null);
  const fixturesRef = useRef<Match[]>([]);
  const lastCareerSaveRef = useRef<string | null>(null);
  const careerSaveStateRef = useRef<Record<string, any> | null>(null);
  const playerStatsRef = useRef<Record<string, PlayerStats>>({});
  const advanceOneDayRef = useRef<() => void>(() => undefined);
  const dayTickerRef = useRef<DayTickerController | null>(null);
  const calendarAnimationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipStartDateRef = useRef<string | null>(null);
  const skipTargetDateRef = useRef<string | null>(null);
  const autoSimUserFixturesRef = useRef(false);
  const continueButtonRef = useRef<HTMLButtonElement | null>(null);
  const calendarStopButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasSimulatingDaysRef = useRef(false);
  const seasonRolloverInProgressRef = useRef(false);

  if (dayTickerRef.current === null) {
    dayTickerRef.current = createDayTicker({
      intervalMs: () => {
        const simulationDate = useGameStore.getState().currentDate;
        const skipStartDate = skipStartDateRef.current;
        const skipTargetDate = skipTargetDateRef.current;
        if (skipStartDate && skipTargetDate) {
          return getSkipSimulationIntervalMs(simulationDate, skipStartDate, skipTargetDate);
        }

        const season = useGameStore.getState().currentSeason;
        const auctionDate = getSeasonDates(season).auctionDate;
        const seasonStart = new Date(season, 2, 31);
        while (seasonStart.getDay() !== 6) seasonStart.setDate(seasonStart.getDate() - 1);
        seasonStart.setDate(seasonStart.getDate() - 7);
        const scheduleAnnouncement = new Date(seasonStart);
        scheduleAnnouncement.setDate(scheduleAnnouncement.getDate() - 21);
        const scheduleAnnouncementDate = `${scheduleAnnouncement.getFullYear()}-${String(scheduleAnnouncement.getMonth() + 1).padStart(2, "0")}-${String(scheduleAnnouncement.getDate()).padStart(2, "0")}`;

        const baseInterval = getDaySimulationIntervalMs(simulationDate, auctionDate, scheduleAnnouncementDate);
        const finalDate = fixturesRef.current
          .find((fixture) => fixture.stage === "final")?.date;
        const retentionDate = getSeasonDates(season + 1).retentionDate;
        // The post-final/offseason stretch has no user fixtures to wait for,
        // so day-by-day simulation runs 1.5x faster until retention day.
        return finalDate && simulationDate > finalDate && simulationDate < retentionDate
          ? Math.max(1, Math.round(baseInterval / 1.5))
          : baseInterval;
      },
      onTick: async () => {
        advanceOneDayRef.current();
        // Skip simulation can generate another match every few milliseconds.
        // Apply storage backpressure so full ball-by-ball archives reach
        // IndexedDB before the ticker creates more large delivery graphs.
        if (skipTargetDateRef.current) {
          await waitForPendingMatchSimulationWrites();
        }
      },
      onError: (error) => {
        console.error("Day-by-day simulation stopped unexpectedly:", error);
        skipStartDateRef.current = null;
        skipTargetDateRef.current = null;
        autoSimUserFixturesRef.current = false;
        // The fast-forward target is persisted independently of the ticker.
        // Clear it on failure so the reload watchdog cannot repeatedly restart
        // the same failing calendar event and leave its overlay blocking input.
        useGameStore.getState().setCareerFastForwardTarget(null);
        sessionStorage.removeItem(CAREER_FAST_FORWARD_RECOVERY_KEY);
        setIsSimulatingDays(false);
        setToastMessage(
          error instanceof Error
            ? `Fast-forward stopped: ${error.message}`
            : "Fast-forward stopped because the next event could not be completed.",
        );
        setTimeout(() => setToastMessage(null), 3000);
      },
    });
  }

  useEffect(() => {
    fixturesRef.current = fixtures;
  }, [fixtures]);

  useEffect(() => {
    playerStatsRef.current = playerStats;
  }, [playerStats]);

  useEffect(() => {
    return () => {
      dayTickerRef.current?.dispose();
      if (calendarAnimationTimeoutRef.current) clearTimeout(calendarAnimationTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (isSimulatingDays) {
      calendarStopButtonRef.current?.focus();
    } else if (wasSimulatingDaysRef.current) {
      continueButtonRef.current?.focus();
    }

    wasSimulatingDaysRef.current = isSimulatingDays;
  }, [isSimulatingDays]);

  const [calendarMonthIndex, setCalendarMonthIndex] = useState(3); // Start calendar view at index 3 (March)
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(20); // Start selected calendar day on first match (March 20)
  const [retentionDeadline, setRetentionDeadline] = useState<RetentionDeadline | null>(null);
  const squadOverviewListRef = useRef<HTMLDivElement | null>(null);
  const [visibleSquadOverviewCount, setVisibleSquadOverviewCount] = useState(0);
  const scoutingOverviewListRef = useRef<HTMLDivElement | null>(null);
  const [visibleScoutingOverviewCount, setVisibleScoutingOverviewCount] = useState(10);
  const currentCalendarMonth = CALENDAR_MONTHS[calendarMonthIndex];
  const calendarDaysInMonth = new Date(currentCalendarMonth.year, currentCalendarMonth.month + 1, 0).getDate();
  const calendarFirstWeekday = new Date(currentCalendarMonth.year, currentCalendarMonth.month, 1).getDay();
  const selectedCalendarDateString = selectedCalendarDay === null
    ? ""
    : `${currentCalendarMonth.year}-${String(currentCalendarMonth.month + 1).padStart(2, "0")}-${String(selectedCalendarDay).padStart(2, "0")}`;
  const canSkipToSelectedCalendarDate = selectedCalendarDateString > currentDate;

  useEffect(() => {
    if (!careerFastForwardTargetDate) {
      fastForwardStartedAtRef.current = null;
      fastForwardOriginDateRef.current = null;
      setFastForwardElapsedMs(0);
      return;
    }
    if (fastForwardStartedAtRef.current === null) {
      fastForwardStartedAtRef.current = Date.now();
      fastForwardOriginDateRef.current = currentDate;
    }
    const updateElapsed = () => setFastForwardElapsedMs(
      Date.now() - (fastForwardStartedAtRef.current ?? Date.now()),
    );
    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 250);
    return () => window.clearInterval(intervalId);
  }, [careerFastForwardTargetDate]);

  const fastForwardProgress = (() => {
    if (!careerFastForwardTargetDate || !fastForwardOriginDateRef.current) return 0;
    const toUtcDay = (dateKey: string) => {
      const date = dateKeyToLocalDate(dateKey);
      return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
    };
    const totalDays = Math.max(1, toUtcDay(careerFastForwardTargetDate) - toUtcDay(fastForwardOriginDateRef.current));
    const completedDays = Math.max(0, toUtcDay(currentDate) - toUtcDay(fastForwardOriginDateRef.current));
    return Math.min(1, completedDays / totalDays);
  })();
  const fastForwardRemainingSeconds = fastForwardProgress > 0.02
    ? Math.max(0, Math.ceil((fastForwardElapsedMs / 1000) * ((1 - fastForwardProgress) / fastForwardProgress)))
    : null;
  const pendingUserMatchdayFixture = useMemo(
    () => fixtures
      .filter((match) => (
      !match.played
      && (match.date ?? "") <= currentDate
      && (match.teamA === userTeamId || match.teamB === userTeamId)
      ))
      .sort((left, right) => (
        (left.date ?? "").localeCompare(right.date ?? "")
        || (left.time ?? "").localeCompare(right.time ?? "")
        || left.matchNumber - right.matchNumber
      ))[0] ?? null,
    [currentDate, fixtures, userTeamId],
  );
  const isTickerAtImpasse = Boolean(pendingUserMatchdayFixture);
  const inGameDate = dateKeyToLocalDate(currentDate);
  const openCalendarAtCurrentDate = () => {
    const currentMonthIndex = findCalendarMonthIndex(CALENDAR_MONTHS, currentDate);
    if (currentMonthIndex >= 0) setCalendarMonthIndex(currentMonthIndex);
    setSelectedCalendarDay(inGameDate.getDate());
    setPendingSkipTargetDate(null);
    setActiveSubTab("calendar");
  };
  const homeCalendarDaysInMonth = new Date(inGameDate.getFullYear(), inGameDate.getMonth() + 1, 0).getDate();
  const homeCalendarFirstWeekday = new Date(inGameDate.getFullYear(), inGameDate.getMonth(), 1).getDay();
  const homeCalendarWeekCount = Math.max(5, Math.ceil((homeCalendarFirstWeekday + homeCalendarDaysInMonth) / 7));

  // Calculate announcement date (3 weeks before startSaturday)
  const expectedStartDateObj = new Date(currentSeason, 2, 31);
  while (expectedStartDateObj.getDay() !== 6) {
    expectedStartDateObj.setDate(expectedStartDateObj.getDate() - 1);
  }
  expectedStartDateObj.setDate(expectedStartDateObj.getDate() - 7); // Second last Saturday of March

  const announcementDate = new Date(expectedStartDateObj);
  announcementDate.setDate(expectedStartDateObj.getDate() - 21); // 3 weeks before

  const userFriendlyAnnouncementDate = announcementDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const formattedAnnouncementDate = `${announcementDate.getFullYear()}-${String(announcementDate.getMonth() + 1).padStart(2, "0")}-${String(announcementDate.getDate()).padStart(2, "0")}`;
  const seasonStartDateString = `${expectedStartDateObj.getFullYear()}-${String(expectedStartDateObj.getMonth() + 1).padStart(2, "0")}-${String(expectedStartDateObj.getDate()).padStart(2, "0")}`;
  const auctionDateString = getSeasonDates(currentSeason).auctionDate;
  const retentionDateString = retentionDeadline
    ? `${retentionDeadline.year}-${String(retentionDeadline.month + 1).padStart(2, "0")}-${String(retentionDeadline.day).padStart(2, "0")}`
    : "";

  const isFixturesAnnounced = currentDate >= formattedAnnouncementDate;

  const mostRecentPlayedFixtureId = useMemo(() => {
    const playedFixtures = fixtures
      .filter((match) => match.played)
      .sort((left, right) => (
        (left.date ?? "").localeCompare(right.date ?? "")
        || (left.time ?? "").localeCompare(right.time ?? "")
        || left.round - right.round
        || left.matchNumber - right.matchNumber
      ));
    return playedFixtures[playedFixtures.length - 1]?.id ?? null;
  }, [fixtures]);

  const scrollToMostRecentFixture = useCallback(() => {
    if (!mostRecentPlayedFixtureId) return;
    document.getElementById(`fixture-card-${mostRecentPlayedFixtureId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [mostRecentPlayedFixtureId]);

  const fixturesByDate = useMemo(() => {
    const groupedFixtures = new Map<string, Match[]>();
    if (!isFixturesAnnounced) return groupedFixtures;

    fixtures.forEach((match) => {
      if (!match.date) return;
      const matches = groupedFixtures.get(match.date) ?? [];
      matches.push(match);
      groupedFixtures.set(match.date, matches);
    });

    return groupedFixtures;
  }, [fixtures, isFixturesAnnounced]);

  const openingMatchDateString = useMemo(() => {
    return getLeagueSeasonStartDate(currentSeason);
  }, [currentSeason]);

  const calendarTradeWindow = useMemo(() => {
    const finalDate = fixtures.find((fixture) => fixture.stage === "final")?.date;
    return finalDate ? getTradeWindowDates(finalDate, currentSeason) : undefined;
  }, [currentSeason, fixtures]);

  const getCalendarDayData = (dateString: string) => {
    const dayMatches = fixturesByDate.get(dateString) ?? [];
    const isOpeningMatchDay = dateString === openingMatchDateString;
    const isPreAnnouncementOpeningMatch = isOpeningMatchDay && !isFixturesAnnounced;
    return {
      date: dateKeyToLocalDate(dateString),
      dayMatches,
      hasAuction: dateString === auctionDateString,
      hasRetention: dateString === retentionDateString,
      hasUserMatch: dayMatches.some((match) => match.teamA === userTeamId || match.teamB === userTeamId),
      isAnnouncement: dateString === formattedAnnouncementDate,
      isTradeWindowOpening: dateString === calendarTradeWindow?.startsOn,
      isTradeWindowClosing: dateString === calendarTradeWindow?.endsOn,
      isOpeningMatchDay,
      isPreAnnouncementOpeningMatch,
    };
  };

  useEffect(() => {
    const list = squadOverviewListRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;

    const updateVisibleCount = () => {
      const rowHeight = 44;
      const overflowLineHeight = 28;
      const totalPlayers = userTeam?.squad.length ?? 0;
      const rowsWithoutOverflowLine = Math.max(0, Math.floor(list.clientHeight / rowHeight));
      const nextCount = totalPlayers <= rowsWithoutOverflowLine
        ? totalPlayers
        : Math.max(0, Math.floor((list.clientHeight - overflowLineHeight) / rowHeight));
      setVisibleSquadOverviewCount(nextCount);
    };

    const observer = new ResizeObserver(updateVisibleCount);
    observer.observe(list);
    updateVisibleCount();
    return () => observer.disconnect();
  }, [activeTab, activeSubTab, userTeam?.squad.length]);
  


  // Toast notifier helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Build sensible defaults while persisted match plans are being loaded.
  useEffect(() => {
    if (userTeam && battingFirstXI.length === 0 && bowlingFirstXI.length === 0) {
      const squad = userTeam.squad
        .map((id) => players[id])
        .filter((player): player is Player => Boolean(player));
      const recommended = buildAutomaticLineupSelection(squad, {
        captainId: teamLeadership.captainId,
        viceCaptainId: teamLeadership.viceCaptainId,
        useProvisionalCaptain: !teamLeadership.captainId,
      });
      setBattingFirstXI(recommended.battingFirstXI);
      setBowlingFirstXI(recommended.bowlingFirstXI);
      setBattingFirstImpactSubs(recommended.battingFirstImpactSubs);
      setBowlingFirstImpactSubs(recommended.bowlingFirstImpactSubs);
      setBattingFirstImpactPlayerId(recommended.battingFirstImpactPlayerId);
      setBattingFirstOutgoingPlayerId(recommended.battingFirstOutgoingPlayerId);
      setBattingFirstImpactBattingPosition(recommended.battingFirstImpactBattingPosition);
      setBowlingFirstImpactPlayerId(recommended.bowlingFirstImpactPlayerId);
      setBowlingFirstOutgoingPlayerId(recommended.bowlingFirstOutgoingPlayerId);
      setBowlingFirstImpactBattingPosition(recommended.bowlingFirstImpactBattingPosition);
    }
  }, [
    battingFirstXI.length,
    bowlingFirstXI.length,
    players,
    teamLeadership.captainId,
    teamLeadership.viceCaptainId,
    userTeam,
  ]);

  // Load and save state from LocalStorage
  useEffect(() => {
    setIsCareerLoaded(false);
    const saved = localStorage.getItem(`ipl_career_${userTeamId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const savedSeason = Number.isFinite(Number(parsed.season))
          ? Number(parsed.season)
          : Number(String(parsed.fixtures?.[0]?.date ?? "").slice(0, 4));

        // Season statistics are deliberately isolated by year. A career save
        // left behind by the previous season must never seed the new cap race.
        if (Number.isFinite(savedSeason) && savedSeason !== currentSeason) {
          localStorage.removeItem(`ipl_career_${userTeamId}`);
          initCareer();
          setIsCareerLoaded(true);
          return;
        }
        
        // Self-healing validation: check if loaded fixtures are valid (no days with > 2 matches, starts on second-last Sat of March)
        let isValidSchedule = true;
        if (
          parsed.fixtures
          && (parsed.fixtures.length === LEAGUE_FIXTURE_COUNT || parsed.fixtures.length === TOTAL_FIXTURE_COUNT)
        ) {
          const embeddedSimulations = (parsed.fixtures as Match[])
            .filter((fixture) => fixture.simulation && hasArchivedDeliveries(fixture.simulation))
            .map((fixture) => fixture.simulation!);
          if (embeddedSimulations.length > 0) {
            void saveMatchSimulations(matchArchiveCareerId, embeddedSimulations)
              .catch((error) => console.error("Unable to migrate embedded match archives:", error));
          }
          // Local storage keeps the compact simulation as the canonical
          // scorecard. Rebuild the legacy UI shape on load instead of storing
          // the same batting and bowling tables twice for every match.
          parsed.fixtures = (parsed.fixtures as Match[]).map((fixture) => {
            if (!fixture.simulation) return fixture;
            return {
              ...fixture,
              commentary: fixture.commentary ?? fixture.simulation.summary,
              scorecard: fixture.scorecard ?? simulationToLegacyScorecard(
                fixture.simulation,
                fixture.teamA,
                fixture.teamB,
              ),
              simulation: compactMatchSimulation(fixture.simulation),
            };
          });
          const persistedLeagueFixtures = parsed.fixtures.slice(0, LEAGUE_FIXTURE_COUNT);
          const expectedStartDate = new Date(currentSeason, 2, 31);
          while (expectedStartDate.getDay() !== 6) {
            expectedStartDate.setDate(expectedStartDate.getDate() - 1);
          }

          // Regenerate old, untouched schedules so existing local careers pick
          // up the balanced two-month fixture layout without losing results.
          if (parsed.scheduleVersion !== LEAGUE_FIXTURE_SCHEDULE_VERSION
            && !persistedLeagueFixtures.some((fixture: Match) => fixture.played)) {
            isValidSchedule = false;
          }
          parsed.fixtures = parsed.fixtures.map((fixture: Match, index: number) => ({
            ...fixture,
            matchNumber: index + 1,
          }));
          if (parsed.fixtures.length === LEAGUE_FIXTURE_COUNT) {
            const finalLeagueDate = persistedLeagueFixtures.at(-1)?.date;
            if (finalLeagueDate) {
              const savedTopFour = Array.isArray(parsed.standings)
                ? parsed.standings.slice(0, 4).map((entry: LeagueStandings) => entry.teamId)
                : [];
              parsed.fixtures.push(...generateKnockoutFixtures(finalLeagueDate, currentSeason, savedTopFour));
            }
          }
          expectedStartDate.setDate(expectedStartDate.getDate() - 7);
          const expectedDateString = `${expectedStartDate.getFullYear()}-${String(expectedStartDate.getMonth() + 1).padStart(2, "0")}-${String(expectedStartDate.getDate()).padStart(2, "0")}`;

          if (persistedLeagueFixtures[0].date !== expectedDateString) {
            isValidSchedule = false;
          } else {
            const matchCountsByDate: Record<string, number> = {};
            for (const m of persistedLeagueFixtures) {
              if (!m.date) { isValidSchedule = false; break; }
              matchCountsByDate[m.date] = (matchCountsByDate[m.date] || 0) + 1;
              if (matchCountsByDate[m.date] > 2) {
                isValidSchedule = false;
                break;
              }
            }
          }
        } else {
          isValidSchedule = false;
        }

        if (parsed.fixtures && parsed.fixtures.length > 0 && isValidSchedule) {
          fixturesRef.current = parsed.fixtures;
          setFixtures(parsed.fixtures);
          setStandings(calculateStandings(parsed.fixtures));
        } else {
          // Regenerate only the schedule so lineup, tactics and season stats in
          // an existing career survive fixture-version migrations.
          const regeneratedFixtures = generateLeagueFixtures();
          parsed.fixtures = regeneratedFixtures;
          parsed.scheduleVersion = LEAGUE_FIXTURE_SCHEDULE_VERSION;
          fixturesRef.current = regeneratedFixtures;
          setFixtures(regeneratedFixtures);
          setStandings(calculateStandings(regeneratedFixtures));
          localStorage.setItem(`ipl_career_${userTeamId}`, JSON.stringify(parsed));
        }
        if (parsed.playerStats) {
          playerStatsRef.current = parsed.playerStats;
          setPlayerStats(parsed.playerStats);
        }
        const loadedSeasonStartBattingAbilities = parsed.seasonStartBattingAbilitiesSeason === currentSeason
          && parsed.seasonStartBattingAbilities
          && typeof parsed.seasonStartBattingAbilities === "object"
          ? parsed.seasonStartBattingAbilities as Record<string, number>
          : captureSeasonStartBattingAbilities(players, currentSeason);
        setSeasonStartBattingAbilities(loadedSeasonStartBattingAbilities);
        const loadedSeasonStartBowlingAbilities = parsed.seasonStartBowlingAbilitiesSeason === currentSeason
          && parsed.seasonStartBowlingAbilities
          && typeof parsed.seasonStartBowlingAbilities === "object"
          ? parsed.seasonStartBowlingAbilities as Record<string, number>
          : captureSeasonStartBowlingAbilities(players, currentSeason);
        setSeasonStartBowlingAbilities(loadedSeasonStartBowlingAbilities);
        if (parsed.seasonStartBattingAbilitiesSeason !== currentSeason || !parsed.seasonStartBattingAbilities) {
          parsed.seasonStartBattingAbilitiesSeason = currentSeason;
          parsed.seasonStartBattingAbilities = loadedSeasonStartBattingAbilities;
          localStorage.setItem(`ipl_career_${userTeamId}`, JSON.stringify(parsed));
        }
        if (parsed.seasonStartBowlingAbilitiesSeason !== currentSeason || !parsed.seasonStartBowlingAbilities) {
          parsed.seasonStartBowlingAbilitiesSeason = currentSeason;
          parsed.seasonStartBowlingAbilities = loadedSeasonStartBowlingAbilities;
          localStorage.setItem(`ipl_career_${userTeamId}`, JSON.stringify(parsed));
        }
        const loadedRecords = applyMinorRecordBaselineUpdates(
          Array.isArray(parsed.minorRecords) && parsed.minorRecords.length > 0
            ? parsed.minorRecords
            : MINOR_RECORDS,
        );
        setMinorRecords(loadedRecords);
        // Historical views use compact league/knockout summaries; full
        // scorecards and delivery archives are only needed for the active
        // season. Remove older IndexedDB match archives after rollover.
        void deleteMatchSimulationsBeforeSeason(userTeamId, currentSeason)
          .catch((error) => console.error("Unable to clean old match archives:", error));
        const loadedInbox = restoreCareerEmailReadState(parsed.inbox, parsed.readEmailDedupeKeys);
        setInbox(loadedInbox);
        // Older saves only stored `unread` on each email. Backfill a separate
        // read ledger so regenerated drafts cannot make read messages unread.
        const loadedReadKeys = Array.from(new Set([
          ...(Array.isArray(parsed.readEmailDedupeKeys)
            ? parsed.readEmailDedupeKeys.filter((key: unknown): key is string => typeof key === "string")
            : []),
          ...getCareerEmailReadKeys(loadedInbox),
        ]));
        if (JSON.stringify(parsed.readEmailDedupeKeys ?? []) !== JSON.stringify(loadedReadKeys)) {
          parsed.readEmailDedupeKeys = loadedReadKeys;
          localStorage.setItem(`ipl_career_${userTeamId}`, JSON.stringify(parsed));
        }
        if (
          parsed.activePlayedMatch?.version === 1
          && typeof parsed.activePlayedMatch.fixtureId === "string"
          && Number.isFinite(parsed.activePlayedMatch.revealedDeliveries)
        ) {
          setActivePlayedMatch(parsed.activePlayedMatch);
        } else {
          setActivePlayedMatch(null);
        }
        const legacyXI = Array.isArray(parsed.startingXI) ? parsed.startingXI : [];
        const loadedBattingXI = Array.isArray(parsed.battingFirstXI) ? parsed.battingFirstXI : legacyXI;
        const loadedBowlingXI = Array.isArray(parsed.bowlingFirstXI) ? parsed.bowlingFirstXI : legacyXI;

        const currentSquadPlayers = (userTeam?.squad ?? [])
          .map((id) => players[id])
          .filter((player): player is Player => Boolean(player));
        const userSquadCandidates = currentSquadPlayers.map((player) => ({
            id: player.id,
            nationality: player.nationality,
            role: player.role,
            batting: player.currentBatting,
            bowling: player.currentBowling,
            isWicketkeeper: player.role === "WK-Batsman" || Boolean(player.isWicketkeeper) || Boolean(player.isPartTimeWk),
            isPartTimeWicketkeeper: Boolean(player.isPartTimeWk),
            isOpener: player.isOpener,
          }));

        const validSquadIds = new Set(userSquadCandidates.map((candidate) => candidate.id));
        const isValidXI = (lineup: string[]) => (
          lineup.length === 11
          && new Set(lineup).size === 11
          && lineup.every((id) => validSquadIds.has(id))
        );
        const loadedBattingImpactSubs = Array.isArray(parsed.battingFirstImpactSubs) ? parsed.battingFirstImpactSubs : [];
        const loadedBowlingImpactSubs = Array.isArray(parsed.bowlingFirstImpactSubs) ? parsed.bowlingFirstImpactSubs : [];
        const isValidImpactBench = (bench: string[], lineup: string[]) => (
          bench.length === 5
          && new Set(bench).size === 5
          && bench.every((id) => validSquadIds.has(id) && !lineup.includes(id))
        );
        const savedPlanIsValid = (
          isValidXI(loadedBattingXI)
          && isValidXI(loadedBowlingXI)
          && isValidImpactBench(loadedBattingImpactSubs, loadedBattingXI)
          && isValidImpactBench(loadedBowlingImpactSubs, loadedBowlingXI)
        );

        if (savedPlanIsValid) {
          setBattingFirstXI(loadedBattingXI);
          setBowlingFirstXI(loadedBowlingXI);
          setBattingFirstImpactSubs(loadedBattingImpactSubs);
          setBowlingFirstImpactSubs(loadedBowlingImpactSubs);
        } else {
          const rebuiltPlan = buildAutomaticLineupSelection(currentSquadPlayers, {
            captainId: parsed.teamLeadership?.captainId,
            viceCaptainId: parsed.teamLeadership?.viceCaptainId,
            useProvisionalCaptain: !parsed.teamLeadership?.captainId,
          });
          setBattingFirstXI(rebuiltPlan.battingFirstXI);
          setBowlingFirstXI(rebuiltPlan.bowlingFirstXI);
          setBattingFirstImpactSubs(rebuiltPlan.battingFirstImpactSubs);
          setBowlingFirstImpactSubs(rebuiltPlan.bowlingFirstImpactSubs);
          setBattingFirstImpactPlayerId(rebuiltPlan.battingFirstImpactPlayerId);
          setBattingFirstOutgoingPlayerId(rebuiltPlan.battingFirstOutgoingPlayerId);
          setBattingFirstImpactBattingPosition(rebuiltPlan.battingFirstImpactBattingPosition);
          setBowlingFirstImpactPlayerId(rebuiltPlan.bowlingFirstImpactPlayerId);
          setBowlingFirstOutgoingPlayerId(rebuiltPlan.bowlingFirstOutgoingPlayerId);
          setBowlingFirstImpactBattingPosition(rebuiltPlan.bowlingFirstImpactBattingPosition);
          parsed.battingFirstXI = rebuiltPlan.battingFirstXI;
          parsed.bowlingFirstXI = rebuiltPlan.bowlingFirstXI;
          parsed.battingFirstImpactSubs = rebuiltPlan.battingFirstImpactSubs;
          parsed.bowlingFirstImpactSubs = rebuiltPlan.bowlingFirstImpactSubs;
          parsed.startingXI = rebuiltPlan.battingFirstXI;
          parsed.battingFirstImpactPlayerId = rebuiltPlan.battingFirstImpactPlayerId;
          parsed.battingFirstOutgoingPlayerId = rebuiltPlan.battingFirstOutgoingPlayerId;
          parsed.battingFirstImpactBattingPosition = rebuiltPlan.battingFirstImpactBattingPosition;
          parsed.bowlingFirstImpactPlayerId = rebuiltPlan.bowlingFirstImpactPlayerId;
          parsed.bowlingFirstOutgoingPlayerId = rebuiltPlan.bowlingFirstOutgoingPlayerId;
          parsed.bowlingFirstImpactBattingPosition = rebuiltPlan.bowlingFirstImpactBattingPosition;
          localStorage.setItem(`ipl_career_${userTeamId}`, JSON.stringify(parsed));
        }
        if (typeof parsed.battingFirstImpactPlayerId === "string" || parsed.battingFirstImpactPlayerId === null) {
          setBattingFirstImpactPlayerId(parsed.battingFirstImpactPlayerId);
        }
        if (typeof parsed.battingFirstOutgoingPlayerId === "string" || parsed.battingFirstOutgoingPlayerId === null) {
          setBattingFirstOutgoingPlayerId(parsed.battingFirstOutgoingPlayerId);
        }
        if (typeof parsed.battingFirstImpactBattingPosition === "number" || parsed.battingFirstImpactBattingPosition === null) {
          setBattingFirstImpactBattingPosition(parsed.battingFirstImpactBattingPosition);
        }
        if (typeof parsed.bowlingFirstImpactPlayerId === "string" || parsed.bowlingFirstImpactPlayerId === null) {
          setBowlingFirstImpactPlayerId(parsed.bowlingFirstImpactPlayerId);
        }
        if (typeof parsed.bowlingFirstOutgoingPlayerId === "string" || parsed.bowlingFirstOutgoingPlayerId === null) {
          setBowlingFirstOutgoingPlayerId(parsed.bowlingFirstOutgoingPlayerId);
        }
        if (typeof parsed.bowlingFirstImpactBattingPosition === "number" || parsed.bowlingFirstImpactBattingPosition === null) {
          setBowlingFirstImpactBattingPosition(parsed.bowlingFirstImpactBattingPosition);
        }
        setTeamTactics(normalizeTeamTactics(parsed.teamTactics, parsed.teamStrategy));
        const loadedUserGamesPlayed = Array.isArray(parsed.fixtures)
          ? parsed.fixtures.filter((fixture: Match) => (
              fixture.played && (fixture.teamA === userTeamId || fixture.teamB === userTeamId)
            )).length
          : 0;
        const userSquadPlayers = (userTeam?.squad ?? [])
          .map((id) => players[id])
          .filter((player): player is Player => Boolean(player));
        const hasCaptainContinuity = Object.prototype.hasOwnProperty.call(userTeam ?? {}, "captainContinuityId");
        const hasViceCaptainContinuity = Object.prototype.hasOwnProperty.call(userTeam ?? {}, "viceCaptainContinuityId");
        const loadedLeadership = restoreTeamLeadershipContinuity(
          parsed.teamLeadership,
          userSquadPlayers,
          {
            // Retention-confirmed franchise continuity is authoritative. A
            // missing continuity value falls back to the career-page copy so
            // older saves can be migrated without losing valid appointments.
            captainId: hasCaptainContinuity ? userTeam?.captainContinuityId ?? null : undefined,
            viceCaptainId: hasViceCaptainContinuity ? userTeam?.viceCaptainContinuityId ?? null : undefined,
          },
          loadedUserGamesPlayed,
          currentSeason,
        );
        setTeamLeadership(loadedLeadership);
        if (userTeam && (userTeam.captainContinuityId !== loadedLeadership.captainId
          || userTeam.viceCaptainContinuityId !== loadedLeadership.viceCaptainId)) {
          const currentTeams = useGameStore.getState().teams;
          useGameStore.setState({
            teams: {
              ...currentTeams,
              [userTeamId]: {
                ...currentTeams[userTeamId],
                captainContinuityId: loadedLeadership.captainId,
                viceCaptainContinuityId: loadedLeadership.viceCaptainId,
              },
            },
          });
        }
        if (JSON.stringify(parsed.teamLeadership ?? {}) !== JSON.stringify(loadedLeadership)) {
          parsed.teamLeadership = loadedLeadership;
          localStorage.setItem(`ipl_career_${userTeamId}`, JSON.stringify(parsed));
        }
        const loadedAiTeamLeadership = reconcileAiLeagueLeadership(
          parsed.aiTeamLeadership,
          teams,
          players,
          userTeamId,
          currentSeason,
        );
        setAiTeamLeadership(loadedAiTeamLeadership);
        if (JSON.stringify(parsed.aiTeamLeadership ?? {}) !== JSON.stringify(loadedAiTeamLeadership)) {
          parsed.aiTeamLeadership = loadedAiTeamLeadership;
          localStorage.setItem(`ipl_career_${userTeamId}`, JSON.stringify(parsed));
        }
        if (parsed.shortlist) setShortlist(parsed.shortlist);
        const savedDeadline = parsed.retentionDeadline as RetentionDeadline | undefined;
        const nextDeadline = savedDeadline ?? generateNextRetentionDeadline(currentSeason);
        setRetentionDeadline(nextDeadline);
        if (!savedDeadline) {
          localStorage.setItem(`ipl_career_${userTeamId}`, JSON.stringify({ ...parsed, retentionDeadline: nextDeadline }));
        }
        careerSaveStateRef.current = parsed;
      } catch (e) {
        console.error("Error loading career save:", e);
      }
    } else {
      // Initialize Career
      careerSaveStateRef.current = null;
      initCareer();
    }
    setIsCareerLoaded(true);
  }, [userTeamId]);

  const saveCareerState = useCallback((updatedData: any) => {
    const storageKey = `ipl_career_${userTeamId}`;
    let latestSavedState = careerSaveStateRef.current ?? {};
    if (careerSaveStateRef.current === null) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) latestSavedState = JSON.parse(saved);
      } catch (error) {
        console.error("Unable to merge latest career save:", error);
      }
    }

    const fallbackState = {
      season: currentSeason,
      scheduleVersion: LEAGUE_FIXTURE_SCHEDULE_VERSION,
      fixtures,
      standings,
      playerStats,
      seasonStartBattingAbilities,
      seasonStartBattingAbilitiesSeason: currentSeason,
      seasonStartBowlingAbilities,
      seasonStartBowlingAbilitiesSeason: currentSeason,
      inbox,
      battingFirstXI,
      bowlingFirstXI,
      battingFirstImpactSubs,
      bowlingFirstImpactSubs,
      battingFirstImpactPlayerId,
      battingFirstOutgoingPlayerId,
      battingFirstImpactBattingPosition,
      bowlingFirstImpactPlayerId,
      bowlingFirstOutgoingPlayerId,
      bowlingFirstImpactBattingPosition,
      startingXI: battingFirstXI,
      teamTactics,
      teamStrategy: teamTactics?.preset ?? "custom",
      teamLeadership,
      aiTeamLeadership,
      shortlist,
      retentionDeadline,
    };
    const currentState = {
      ...fallbackState,
      ...latestSavedState,
      ...updatedData,
      season: currentSeason,
      scheduleVersion: LEAGUE_FIXTURE_SCHEDULE_VERSION,
      // Keep the legacy XI synchronized only when the batting-first XI changes.
      startingXI: updatedData.battingFirstXI
        ?? latestSavedState.startingXI
        ?? latestSavedState.battingFirstXI
        ?? battingFirstXI,
      teamStrategy: updatedData.teamTactics?.preset
        ?? latestSavedState.teamStrategy
        ?? teamTactics?.preset
        ?? "custom",
    };
    const persistedReadKeys = Array.isArray(latestSavedState.readEmailDedupeKeys)
      ? latestSavedState.readEmailDedupeKeys.filter((key: unknown): key is string => typeof key === "string")
      : [];
    currentState.readEmailDedupeKeys = Array.from(new Set([
      ...persistedReadKeys,
      ...getCareerEmailReadKeys(currentState.inbox),
    ]));
    currentState.inbox = restoreCareerEmailReadState(
      currentState.inbox,
      currentState.readEmailDedupeKeys,
    );
    // These fields are retained only as migration inputs for older saves.
    // Do not keep them in new saves because they duplicate canonical values.
    delete currentState.startingXI;
    delete currentState.teamStrategy;
    if (Array.isArray(currentState.fixtures)) {
      const alreadySavedSimulationKeys = new Set(
        (Array.isArray(latestSavedState.fixtures) ? latestSavedState.fixtures as Match[] : [])
          .filter((fixture) => fixture.simulation)
          .map((fixture) => `${fixture.id}:${fixture.simulation?.version}:${fixture.simulation?.seed}`),
      );
      const completeSimulations = (currentState.fixtures as Match[])
        .filter((fixture) => (
          fixture.simulation
          && hasArchivedDeliveries(fixture.simulation)
          && !alreadySavedSimulationKeys.has(
            `${fixture.id}:${fixture.simulation.version}:${fixture.simulation.seed}`,
          )
        ))
        .map((fixture) => fixture.simulation!);
      if (completeSimulations.length > 0) {
        void saveMatchSimulations(matchArchiveCareerId, completeSimulations)
          .catch((error) => console.error("Unable to archive ball-by-ball match records:", error));
      }
      currentState.fixtures = (currentState.fixtures as Match[]).map((fixture) => (
        fixture.simulation
          ? {
            ...fixture,
            // Both fields are derived from the compact simulation during load.
            // Omitting them prevents 74 duplicate scorecards and summaries
            // from exhausting the synchronous local-storage quota.
            commentary: undefined,
            scorecard: undefined,
            simulation: compactMatchSimulation(fixture.simulation),
          }
          : fixture
      ));
    }
    const serializedState = JSON.stringify(currentState);
    if (lastCareerSaveRef.current === serializedState) return;
    try {
      localStorage.setItem(storageKey, serializedState);
      careerSaveStateRef.current = currentState;
      lastCareerSaveRef.current = serializedState;
    } catch (error) {
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        throw new Error(
          "Career storage is full. Fast-forward has stopped safely at the last completed date; reload once to compact the existing save.",
        );
      }
      throw error;
    }
  }, [userTeamId, currentSeason, fixtures, standings, playerStats, seasonStartBattingAbilities, seasonStartBowlingAbilities, inbox, battingFirstXI, bowlingFirstXI, battingFirstImpactSubs, bowlingFirstImpactSubs, battingFirstImpactPlayerId, battingFirstOutgoingPlayerId, battingFirstImpactBattingPosition, bowlingFirstImpactPlayerId, bowlingFirstOutgoingPlayerId, bowlingFirstImpactBattingPosition, teamTactics, teamLeadership, aiTeamLeadership, shortlist, retentionDeadline, matchArchiveCareerId]);

  useEffect(() => {
    if (
      seasonRolloverInProgressRef.current
      || !isCareerLoaded
      || !userTeamId
      || (battingFirstXI.length === 0 && bowlingFirstXI.length === 0)
    ) return;
    saveCareerState({
      battingFirstXI,
      bowlingFirstXI,
      battingFirstImpactSubs,
      bowlingFirstImpactSubs,
    });
  }, [isCareerLoaded, userTeamId, battingFirstXI, bowlingFirstXI, battingFirstImpactSubs, bowlingFirstImpactSubs, saveCareerState]);

  // Backfill completed fixtures in an existing active-season save. The store
  // records stable match keys, so reloading or revisiting this page cannot add
  // the same scorecard to a player's IPL career twice.
  useEffect(() => {
    if (!isCareerLoaded) return;
    const updates = fixtures
      .map((fixture) => toIplCareerMatchUpdate(fixture, currentSeason))
      .filter((update): update is IplCareerMatchUpdate => Boolean(update));
    if (updates.length > 0) recordIplMatchStats(updates);
  }, [currentSeason, fixtures, isCareerLoaded, recordIplMatchStats]);

  // Commit a completed season on Final day. Previously this only happened when
  // the following retention window began, leaving both history pages stale.
  useEffect(() => {
    if (!isCareerLoaded || simulatedLeagueHistory.some((season) => season.season === currentSeason)) return;

    const final = fixtures.find((fixture) => fixture.stage === "final" && fixture.played && fixture.winner);
    if (!final?.winner) return;

    const orangeCap = Object.values(playerStats)
      .filter((stats) => stats.runs > 0 && teams[stats.teamId])
      .sort((left, right) => right.runs - left.runs || left.name.localeCompare(right.name))[0];
    const purpleCap = Object.values(playerStats)
      .filter((stats) => stats.wickets > 0 && teams[stats.teamId])
      .sort((left, right) => right.wickets - left.wickets || left.name.localeCompare(right.name))[0];
    if (!orangeCap || !purpleCap) return;
    const seasonAwards = calculateSeasonAwardLeaders(
      playerStats,
      players,
      currentSeason,
      simulatedLeagueHistory,
    );
    if (!seasonAwards.mvp) return;

    recordSimulatedLeagueSeason({
      season: currentSeason,
      championTeamId: final.winner,
      runnerUpTeamId: final.winner === final.teamA ? final.teamB : final.teamA,
      orangeCap: { name: orangeCap.name, teamId: orangeCap.teamId },
      purpleCap: { name: purpleCap.name, teamId: purpleCap.teamId },
      emergingPlayer: seasonAwards.emerging
        ? { name: seasonAwards.emerging.name, teamId: seasonAwards.emerging.teamId }
        : undefined,
      mvp: { name: seasonAwards.mvp.name, teamId: seasonAwards.mvp.teamId },
      source: "career",
      standings: standings.map((standing) => ({
        teamId: standing.teamId,
        teamName: standing.teamName,
        played: standing.played,
        won: standing.won,
        lost: standing.lost,
        noResults: standing.noResults,
        points: standing.points,
        nrr: standing.nrr,
      })),
    });
    archiveCareerSeason({
      season: currentSeason,
      fixtures: fixturesForCareerHistory(fixtures),
      standings,
      playerStats,
      reputationAchievements: buildCareerReputationAchievements(fixtures, playerStats, seasonAwards, players),
      leagueRecords: computeDynamicLeagueRecords(
        fixtures as any[],
        players,
        teams,
        careerSeasonArchives.find((archive) => archive.season < currentSeason)?.leagueRecords ?? OTHER_LEAGUE_RECORDS,
      ),
    });
  }, [
    archiveCareerSeason,
    careerSeasonArchives,
    currentSeason,
    fixtures,
    isCareerLoaded,
    playerStats,
    players,
    recordSimulatedLeagueSeason,
    simulatedLeagueHistory,
    standings,
    teams,
  ]);



  // Initialize all career details
  const initCareer = () => {
    if (!userTeam) return;
    const squad = userTeam.squad
      .map((id) => players[id])
      .filter((player): player is Player => Boolean(player));
    const initialTeamLeadership = restoreTeamLeadershipContinuity(
      teamLeadership,
      squad,
      {
        captainId: userTeam.captainContinuityId,
        viceCaptainId: userTeam.viceCaptainContinuityId,
      },
      0,
      currentSeason,
    );
    const recommendedLineups = buildAutomaticLineupSelection(squad, {
      captainId: initialTeamLeadership.captainId,
      viceCaptainId: initialTeamLeadership.viceCaptainId,
      useProvisionalCaptain: !initialTeamLeadership.captainId,
    });
    const initialBattingFirstXI = battingFirstXI.length > 0 ? battingFirstXI : recommendedLineups.battingFirstXI;
    const initialBowlingFirstXI = bowlingFirstXI.length > 0 ? bowlingFirstXI : recommendedLineups.bowlingFirstXI;
    const initialBattingImpactSubs = battingFirstImpactSubs.length > 0
      ? battingFirstImpactSubs
      : recommendedLineups.battingFirstImpactSubs;
    const initialBowlingImpactSubs = bowlingFirstImpactSubs.length > 0
      ? bowlingFirstImpactSubs
      : recommendedLineups.bowlingFirstImpactSubs;
    const initialTeamTactics = normalizeTeamTactics(teamTactics);
    const initialAiTeamLeadership = appointAiLeagueLeadership(
      teams,
      players,
      userTeamId,
      currentSeason,
    );
    // 1. Generate fixtures
    const GeneratedFixtures = generateLeagueFixtures();
    // 2. Generate standings
    const initialStandings = Object.values(teams).map(t => ({
      teamId: t.id,
      teamName: t.name,
      shortName: t.shortName,
      played: 0,
      won: 0,
      lost: 0,
      noResults: 0,
      points: 0,
      nrr: 0.0,
      wicketsTaken: 0
    }));

    // 3. Generate initial inbox messages
    const initialInbox: CareerEmail[] = [];
    const nextRetentionDeadline = generateNextRetentionDeadline(currentSeason);
    const initialSeasonStartBattingAbilities = captureSeasonStartBattingAbilities(players, currentSeason);
    const initialSeasonStartBowlingAbilities = captureSeasonStartBowlingAbilities(players, currentSeason);

    // Set and save
    fixturesRef.current = GeneratedFixtures;
    playerStatsRef.current = {};
    setFixtures(GeneratedFixtures);
    setStandings(initialStandings);
    setInbox(initialInbox);
    setPlayerStats({});
    setSeasonStartBattingAbilities(initialSeasonStartBattingAbilities);
    setSeasonStartBowlingAbilities(initialSeasonStartBowlingAbilities);
    setMinorRecords(MINOR_RECORDS);
    setRetentionDeadline(nextRetentionDeadline);
    setBattingFirstXI(initialBattingFirstXI);
    setBowlingFirstXI(initialBowlingFirstXI);
    setBattingFirstImpactSubs(initialBattingImpactSubs);
    setBowlingFirstImpactSubs(initialBowlingImpactSubs);
    setTeamTactics(initialTeamTactics);
    setTeamLeadership(initialTeamLeadership);
    setAiTeamLeadership(initialAiTeamLeadership);
    
    saveCareerState({
      fixtures: GeneratedFixtures,
      standings: initialStandings,
      inbox: initialInbox,
      playerStats: {},
      seasonStartBattingAbilities: initialSeasonStartBattingAbilities,
      seasonStartBattingAbilitiesSeason: currentSeason,
      seasonStartBowlingAbilities: initialSeasonStartBowlingAbilities,
      seasonStartBowlingAbilitiesSeason: currentSeason,
      minorRecords: MINOR_RECORDS,
      retentionDeadline: nextRetentionDeadline,
      battingFirstXI: initialBattingFirstXI,
      bowlingFirstXI: initialBowlingFirstXI,
      battingFirstImpactSubs: initialBattingImpactSubs,
      bowlingFirstImpactSubs: initialBowlingImpactSubs,
      teamTactics: initialTeamTactics,
      teamLeadership: initialTeamLeadership,
      aiTeamLeadership: initialAiTeamLeadership,
    });
  };

  // --------------------------------------------------------------------------
  // Career Methods
  // --------------------------------------------------------------------------
  
  // Generates the balanced schedule, retaining the old search as an emergency
  // fallback so a career can still initialize if malformed team data is loaded.
  const generateLeagueFixtures = (): Match[] => {
    if (!userTeam) return [];
    const withKnockouts = (leagueFixtures: Match[]) => {
      const finalLeagueDate = leagueFixtures[leagueFixtures.length - 1]?.date;
      return finalLeagueDate
        ? [...leagueFixtures, ...generateKnockoutFixtures(finalLeagueDate, currentSeason)]
        : leagueFixtures;
    };

    const previousSeason = simulatedLeagueHistory.find((season) => season.season === currentSeason - 1)
      ?? HISTORICAL_LEAGUE_HISTORY.find((season) => season.season === currentSeason - 1);
    const reigningChampionTeamId = previousSeason?.championTeamId;
    if (!reigningChampionTeamId || !teams[reigningChampionTeamId]) {
      throw new Error(`Cannot generate ${currentSeason} fixtures without the ${currentSeason - 1} champion`);
    }

    try {
      return withKnockouts(generateBalancedLeagueFixtures(Object.keys(teams), currentSeason, reigningChampionTeamId, fixtureSeed));
    } catch (error) {
      console.error("Balanced fixture generation failed; using legacy scheduler.", error);
    }

    const teamIds = Object.keys(teams);
    const includesReigningChampion = (match: { teamA: string; teamB: string }) => (
      match.teamA === reigningChampionTeamId || match.teamB === reigningChampionTeamId
    );
    // Stable within one career, but different for each new save.
    const seed = Array.from(`${currentSeason}:${fixtureSeed}`).reduce((value, character) => (
      (Math.imul(value, 31) + character.charCodeAt(0)) | 0
    ), 7);
    const pseudoRandom = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    const shuffled = [...teamIds].sort((a, b) => {
      const valA = pseudoRandom(seed + a.charCodeAt(0) + (a.charCodeAt(1) || 0));
      const valB = pseudoRandom(seed + b.charCodeAt(0) + (b.charCodeAt(1) || 0));
      return valA - valB;
    });

    const groupA = shuffled.slice(0, 5);
    const groupB = shuffled.slice(5, 10);

    // Build the pool of matches:
    // 1. Cross-group matches: 2 fixtures against every team in opposite group.
    // Group A vs Group B pairs:
    const crossGroupPairs = new Map<string, { teamA: string; teamB: string }[]>();
    for (const ta of groupA) {
      for (const tb of groupB) {
        const key = ta < tb ? `${ta}_${tb}` : `${tb}_${ta}`;
        if (!crossGroupPairs.has(key)) {
          crossGroupPairs.set(key, []);
        }
        crossGroupPairs.get(key)!.push({ teamA: ta, teamB: tb });
        crossGroupPairs.get(key)!.push({ teamA: tb, teamB: ta });
      }
    }

    const firstFixtures: { teamA: string; teamB: string }[] = [];
    const secondFixtures: { teamA: string; teamB: string }[] = [];

    // Distribute cross group matches: first goes to firstFixtures, second goes to secondFixtures
    crossGroupPairs.forEach((list) => {
      const pickFirst = pseudoRandom(seed + list[0].teamA.charCodeAt(0) + list[0].teamB.charCodeAt(0)) > 0.5;
      if (pickFirst) {
        firstFixtures.push(list[0]);
        secondFixtures.push(list[1]);
      } else {
        firstFixtures.push(list[1]);
        secondFixtures.push(list[0]);
      }
    });

    // 2. In-group matches: 1 fixture against each team in their group
    const inGroupMatches: { teamA: string; teamB: string }[] = [];
    for (let i = 0; i < groupA.length; i++) {
      for (let j = i + 1; j < groupA.length; j++) {
        const homeFirst = pseudoRandom(seed + i * 7 + j * 13) > 0.5;
        inGroupMatches.push({
          teamA: homeFirst ? groupA[i] : groupA[j],
          teamB: homeFirst ? groupA[j] : groupA[i]
        });
      }
    }
    for (let i = 0; i < groupB.length; i++) {
      for (let j = i + 1; j < groupB.length; j++) {
        const homeFirst = pseudoRandom(seed + i * 11 + j * 17) > 0.5;
        inGroupMatches.push({
          teamA: homeFirst ? groupB[i] : groupB[j],
          teamB: homeFirst ? groupB[j] : groupB[i]
        });
      }
    }

    // In-group matches only play once, so we put them in the first half of the season pool
    firstFixtures.push(...inGroupMatches);

    const allMatchesPool = [...firstFixtures, ...secondFixtures];

    // Find the second last Saturday of March of the next season year
    const nextSeasonYear = currentSeason;
    const startSaturday = new Date(nextSeasonYear, 2, 31); // March 31
    while (startSaturday.getDay() !== 6) { // 6 = Saturday
      startSaturday.setDate(startSaturday.getDate() - 1);
    }
    startSaturday.setDate(startSaturday.getDate() - 7); // Second last Saturday

    // Helper to calculate exact dayOffset, timeLabel, and dateString for any slot index
    // - Week 0: Sat (0), Sun (1) (only 1 game on first Sunday), Mon (2), Tue (3), Wed (4), Thu (5), Fri (6) -> 7 slots
    // - Week 1+: Sat (0), Sun AM (1), Sun PM (1), Mon (2), Tue (3), Wed (4), Thu (5), Fri (6) -> 8 slots
    const getSlotDetails = (slotIdx: number) => {
      let dayOffset = 0;
      let timeLabel = "19:30";

      if (slotIdx < 7) {
        dayOffset = slotIdx;
        timeLabel = "19:30";
      } else {
        const relativeSlot = slotIdx - 7;
        const weekIndex = Math.floor(relativeSlot / 8) + 1;
        const intraWeekSlot = relativeSlot % 8;

        if (intraWeekSlot === 0) {
          dayOffset = weekIndex * 7 + 0; // Saturday
          timeLabel = "19:30";
        } else if (intraWeekSlot === 1) {
          dayOffset = weekIndex * 7 + 1; // Sunday Morning
          timeLabel = "15:30";
        } else if (intraWeekSlot === 2) {
          dayOffset = weekIndex * 7 + 1; // Sunday Afternoon
          timeLabel = "19:30";
        } else {
          dayOffset = weekIndex * 7 + (intraWeekSlot - 1); // Monday to Friday
          timeLabel = "19:30";
        }
      }

      const matchDate = new Date(startSaturday);
      matchDate.setDate(startSaturday.getDate() + dayOffset);
      const dateString = `${matchDate.getFullYear()}-${String(matchDate.getMonth() + 1).padStart(2, "0")}-${String(matchDate.getDate()).padStart(2, "0")}`;

      return { dayOffset, timeLabel, dateString };
    };

    // Phase 1: Try to schedule with all constraints active (including 3 matches in 5 days)
    for (let attempt = 0; attempt < 3000; attempt++) {
      const pool = [...allMatchesPool];
      
      // Shuffle the pool
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(pseudoRandom(seed + attempt * 7919 + i * 104729) * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      const scheduled: Match[] = [];
      const playedDays = new Map<string, number[]>();
      for (const tid of teamIds) {
        playedDays.set(tid, []);
      }

      let slotIndex = 0;
      let success = true;

      while (pool.length > 0) {
        const { dayOffset, timeLabel, dateString } = getSlotDetails(slotIndex);

        // Try to find a match in the pool that fits the slot constraints
        let foundIdx = -1;
        for (let i = 0; i < pool.length; i++) {
          const m = pool[i];
          if (slotIndex === 0 && !includesReigningChampion(m)) continue;
          const daysA = playedDays.get(m.teamA)!;
          const daysB = playedDays.get(m.teamB)!;

          const lastA = daysA.length > 0 ? daysA[daysA.length - 1] : -10;
          const lastB = daysB.length > 0 ? daysB[daysB.length - 1] : -10;

          // First 5 games (slots 0-4) must have all 10 teams playing once
          if (slotIndex < 5) {
            if (daysA.length > 0 || daysB.length > 0) continue;
          }

          // Back-to-back constraint (must have at least 1 day gap, so dayOffset - last > 1)
          if (dayOffset - lastA <= 1 || dayOffset - lastB <= 1) continue;

          // Rolling 5-day window constraint: no team plays 3 matches in any 5-day window [dayOffset - 4, dayOffset]
          const windowStart = dayOffset - 4;
          const windowEnd = dayOffset - 1;
          const countA = daysA.filter(d => d >= windowStart && d <= windowEnd).length;
          const countB = daysB.filter(d => d >= windowStart && d <= windowEnd).length;
          if (countA >= 2 || countB >= 2) continue;

          // Split fixture constraint: 1st cross-group match in first 7 games, 2nd in last 7 games for both teams
          const isCross = (groupA.includes(m.teamA) && groupB.includes(m.teamB)) ||
                          (groupB.includes(m.teamA) && groupA.includes(m.teamB));
          if (isCross) {
            const alreadyPlayed = scheduled.some(s => 
              (s.teamA === m.teamA && s.teamB === m.teamB) || 
              (s.teamA === m.teamB && s.teamB === m.teamA)
            );
            const matchesA = daysA.length;
            const matchesB = daysB.length;

            if (!alreadyPlayed) {
              if (matchesA >= 7 || matchesB >= 7) continue;
            } else {
              if (matchesA < 7 || matchesB < 7) continue;
            }
          }

          foundIdx = i;
          break;
        }

        if (foundIdx === -1) {
          success = false;
          break; // Try next shuffle
        }

        const match = pool.splice(foundIdx, 1)[0];
        playedDays.get(match.teamA)!.push(dayOffset);
        playedDays.get(match.teamB)!.push(dayOffset);

        scheduled.push({
          id: `match_${slotIndex}_${nextSeasonYear}_${match.teamA}_${match.teamB}`,
          matchNumber: slotIndex + 1,
          round: Math.floor(slotIndex / 5) + 1, // Round 1 to 14
          teamA: match.teamA,
          teamB: match.teamB,
          played: false,
          date: dateString,
          time: timeLabel
        });

        slotIndex++;
      }

      if (success) {
        return withKnockouts(scheduled);
      }
    }

    // Phase 2: Relax the 3-matches-in-5-days constraint, but strictly enforce no back-to-back matches
    console.warn("Fixture scheduler falling back to relaxed 3-in-5 constraint search...");
    for (let attempt = 0; attempt < 3000; attempt++) {
      const pool = [...allMatchesPool];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(pseudoRandom(seed + 1_000_003 + attempt * 7919 + i * 104729) * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      const scheduled: Match[] = [];
      const playedDays = new Map<string, number[]>();
      for (const tid of teamIds) {
        playedDays.set(tid, []);
      }

      let slotIndex = 0;
      let success = true;

      while (pool.length > 0) {
        const { dayOffset, timeLabel, dateString } = getSlotDetails(slotIndex);

        let foundIdx = -1;
        for (let i = 0; i < pool.length; i++) {
          const m = pool[i];
          if (slotIndex === 0 && !includesReigningChampion(m)) continue;
          const daysA = playedDays.get(m.teamA)!;
          const daysB = playedDays.get(m.teamB)!;

          const lastA = daysA.length > 0 ? daysA[daysA.length - 1] : -10;
          const lastB = daysB.length > 0 ? daysB[daysB.length - 1] : -10;

          // First 5 games (slots 0-4) must have all 10 teams playing once
          if (slotIndex < 5) {
            if (daysA.length > 0 || daysB.length > 0) continue;
          }

          // Back-to-back constraint (must have at least 1 day gap, so dayOffset - last > 1)
          if (dayOffset - lastA <= 1 || dayOffset - lastB <= 1) continue;

          // Split fixture constraint: 1st cross-group match in first 7 games, 2nd in last 7 games for both teams
          const isCross = (groupA.includes(m.teamA) && groupB.includes(m.teamB)) ||
                          (groupB.includes(m.teamA) && groupA.includes(m.teamB));
          if (isCross) {
            const alreadyPlayed = scheduled.some(s => 
              (s.teamA === m.teamA && s.teamB === m.teamB) || 
              (s.teamA === m.teamB && s.teamB === m.teamA)
            );
            const matchesA = daysA.length;
            const matchesB = daysB.length;

            if (!alreadyPlayed) {
              if (matchesA >= 7 || matchesB >= 7) continue;
            } else {
              if (matchesA < 7 || matchesB < 7) continue;
            }
          }

          foundIdx = i;
          break;
        }

        if (foundIdx === -1) {
          success = false;
          break; // Try next shuffle
        }

        const match = pool.splice(foundIdx, 1)[0];
        playedDays.get(match.teamA)!.push(dayOffset);
        playedDays.get(match.teamB)!.push(dayOffset);

        scheduled.push({
          id: `match_${slotIndex}_${nextSeasonYear}_${match.teamA}_${match.teamB}`,
          matchNumber: slotIndex + 1,
          round: Math.floor(slotIndex / 5) + 1, // Round 1 to 14
          teamA: match.teamA,
          teamB: match.teamB,
          played: false,
          date: dateString,
          time: timeLabel
        });

        slotIndex++;
      }

      if (success) {
        return withKnockouts(scheduled);
      }
    }

    // Fallback: This structured fallback is guaranteed to succeed and respects Sunday limits + 1-day rest
    console.warn("Scheduler using absolute structured fallback...");
    const openingFixtureIndex = allMatchesPool.findIndex(includesReigningChampion);
    const orderedMatchesPool = openingFixtureIndex <= 0
      ? allMatchesPool
      : [
          allMatchesPool[openingFixtureIndex],
          ...allMatchesPool.slice(0, openingFixtureIndex),
          ...allMatchesPool.slice(openingFixtureIndex + 1),
        ];
    return orderedMatchesPool.map((m, idx) => {
      const { timeLabel, dateString } = getSlotDetails(idx);
      return {
        id: `match_${idx}_${nextSeasonYear}_${m.teamA}_${m.teamB}`,
        matchNumber: idx + 1,
        round: Math.floor(idx / 5) + 1,
        teamA: m.teamA,
        teamB: m.teamB,
        played: false,
        date: dateString,
        time: timeLabel
      };
    });
  };

  const getSimulationSquad = (teamId: string, batsFirst: boolean): Player[] => {
    const liveInjuries = useGameStore.getState().activeInjuries;
    const availablePlayers = Object.values(players)
      .filter((player) => (
        player.currentTeamId === teamId
        && !isPlayerMajorInjured(liveInjuries, player.id)
      ))
      .sort((left, right) => getPlayerRating(right) - getPlayerRating(left));

    if (teamId !== userTeamId) {
      const leadership = aiTeamLeadership[teamId];
      const aiPlans = buildAiMatchLineups(availablePlayers, {
        captainId: leadership?.captainId,
        viceCaptainId: leadership?.viceCaptainId,
        useProvisionalCaptain: !leadership?.captainId,
      });
      const selectedIds = batsFirst
        ? aiPlans.battingFirst.startingXI
        : aiPlans.bowlingFirst.startingXI;
      return selectedIds
        .map((playerId) => players[playerId])
        .filter((player): player is Player => Boolean(player));
    }

    const configuredIds = batsFirst ? battingFirstXI : bowlingFirstXI;
    const validation = validateLineup(configuredIds, availablePlayers.map((player) => ({
      id: player.id,
      nationality: player.nationality,
      role: player.role,
      batting: player.currentBatting,
      bowling: player.currentBowling,
      isWicketkeeper: player.role === "WK-Batsman" || Boolean(player.isWicketkeeper) || Boolean(player.isPartTimeWk),
      isPartTimeWicketkeeper: Boolean(player.isPartTimeWk),
      isOpener: player.isOpener,
      onlyOpensOrBenched: player.onlyOpensOrBenched,
    })));
    if (!validation.isValid) return availablePlayers.slice(0, 11);

    const configuredPlayers = configuredIds
      .map((id) => players[id])
      .filter((player): player is Player => Boolean(
        player
        && player.currentTeamId === teamId
        && !isPlayerMajorInjured(liveInjuries, player.id)
      ));
    const configuredIdSet = new Set(configuredPlayers.map((player) => player.id));
    const fallbackPlayers = availablePlayers.filter((player) => !configuredIdSet.has(player.id));
    return [...configuredPlayers, ...fallbackPlayers].slice(0, 11);
  };

  // Toggle shortlist helper
  const toggleShortlist = (pid: string) => {
    let next: string[];
    if (shortlist.includes(pid)) {
      next = shortlist.filter(id => id !== pid);
      showToast("Removed from Auction Shortlist");
    } else {
      next = [...shortlist, pid];
      showToast("Added to Auction Shortlist");
    }
    setShortlist(next);
    saveCareerState({ shortlist: next });
  };

  // Play and simulate match logic
  const getGroundScoringModifier = (homeTeamId: string) => {
    const homeStadium = getHomeStadium(homeTeamId);
    if (!homeStadium) return 1;
    const configuredDimensions = homeBoundaryDimensions[homeStadium.teamId]
      ?? homeStadium.defaultBoundaryDimensions;
    const configuredOutfield = homeOutfieldSettings[homeStadium.teamId]
      ?? getDefaultOutfieldSettings(homeStadium.teamId);
    if (!configuredOutfield) return 1;
    return calculateGroundScoringImpact(
      homeStadium.teamId,
      configuredDimensions,
      configuredOutfield,
    ).modifier;
  };

  const getMatchConditions = (match: Match): MatchGroundConditions | null => {
    const previousSeason = simulatedLeagueHistory.find((season) => season.season === currentSeason - 1)
      ?? HISTORICAL_LEAGUE_HISTORY.find((season) => season.season === currentSeason - 1);
    const hash = (value: string) => Array.from(value).reduce(
      (result, character) => (Math.imul(result, 31) + character.charCodeAt(0)) | 0,
      17,
    ) >>> 0;
    const stage = match.stage;
    let stadiumTeamId = match.teamA;
    let pitchId: string | undefined;

    if (stage === "final") {
      stadiumTeamId = previousSeason?.championTeamId ?? match.teamA;
    } else if (stage === "qualifier2") {
      stadiumTeamId = previousSeason?.runnerUpTeamId ?? match.teamA;
    } else if (stage === "qualifier1" || stage === "eliminator") {
      const playoffTeamIds = new Set(
        standings.slice(0, 4).map((entry) => entry.teamId),
      );
      const neutralVenuePool = HOME_STADIUMS.filter(
        (candidate) => !playoffTeamIds.has(candidate.teamId),
      );
      const qualifier1Pool = neutralVenuePool;
      const qualifier1 = [...qualifier1Pool].sort((a, b) => hash(`${currentSeason}:qualifier1:${a.id}`) - hash(`${currentSeason}:qualifier1:${b.id}`))[0];
      const qualifier1Teams = new Set([qualifier1?.teamId]);
      const eliminatorPool = stage === "eliminator"
        ? neutralVenuePool.filter(
            (candidate) => !qualifier1Teams.has(candidate.teamId),
          )
        : [];
      const selected = stage === "qualifier1"
        ? qualifier1
        : [...eliminatorPool].sort((a, b) => hash(`${currentSeason}:eliminator:${a.id}`) - hash(`${currentSeason}:eliminator:${b.id}`))[0];
      stadiumTeamId = selected?.teamId ?? match.teamA;
      pitchId = selected?.pitches[hash(`${currentSeason}:${match.id}:pitch`) % selected.pitches.length]?.id;
    }

    const stadium = getHomeStadium(stadiumTeamId);
    if (!stadium) return null;
    const selectedPitchId = pitchId
      ?? homePitchSelections[stadium.teamId]
      ?? stadium.defaultPitchId;
    const pitch = getCuratorPitch(selectedPitchId)
      ?? (customPitchesByTeam[stadium.teamId] ?? []).find((candidate) => candidate.id === selectedPitchId)
      ?? getDefaultCuratorPitch(stadium.teamId);
    const boundaries = homeBoundaryDimensions[stadium.teamId]
      ?? stadium.defaultBoundaryDimensions;
    const outfield = homeOutfieldSettings[stadium.teamId]
      ?? getDefaultOutfieldSettings(stadium.teamId);
    if (!pitch || !outfield) return null;
    const groundImpact = calculateGroundScoringImpact(
      stadium.teamId,
      boundaries,
      outfield,
    );
    return {
      // For league matches this remains teamA. At playoff venues it identifies
      // the stadium owner, which also prevents either participant receiving a
      // false home-ground advantage at a neutral venue.
      homeTeamId: stadiumTeamId,
      stadiumId: stadium.id,
      stadiumName: stadium.name,
      pitch,
      boundaries,
      outfield,
      outfieldSpeedRating: calculateOutfieldSpeedRating(stadium.teamId, outfield),
      adjustedExpectedScore: {
        min: Math.round(pitch.expectedFirstInningsScore.min * groundImpact.modifier),
        max: Math.round(pitch.expectedFirstInningsScore.max * groundImpact.modifier),
      },
      groundScoringModifier: groundImpact.modifier,
      // Deliberately isolated so a future league/season rule can change it
      // without modifying delivery generation.
      chasingScoringBonus: 0,
    };
  };

  const getTeamSquad = (teamId: string) => {
    const configuredIds = teams[teamId]?.squad ?? [];
    const configured = configuredIds
      .map((playerId) => players[playerId])
      .filter((player): player is Player => Boolean(player) && player.currentTeamId === teamId);
    if (configured.length > 0) return configured;
    return Object.values(players).filter((player) => player.currentTeamId === teamId);
  };

  const getSelectableTeamSquad = (teamId: string) => (
    getTeamSquad(teamId).filter((player) => (
      !isPlayerMajorInjured(useGameStore.getState().activeInjuries, player.id)
    ))
  );

  const toMatchLineupPlan = (
    startingXI: readonly string[],
    impactSubs: readonly string[],
    impactPlayerId: string | null | undefined,
    outgoingPlayerId: string | null | undefined,
    impactBattingPosition: number | null | undefined,
    captainId: string | null | undefined,
    viceCaptainId: string | null | undefined,
  ): MatchLineupPlan => ({
    startingXI: [...startingXI],
    impactSubs: [...impactSubs],
    plannedImpactPlayerId: impactPlayerId,
    plannedOutgoingPlayerId: outgoingPlayerId,
    plannedImpactBattingPosition: impactBattingPosition,
    captainId,
    viceCaptainId,
  });

  const tuneAiPlanForPitch = (
    startingXI: readonly string[],
    impactSubs: readonly string[],
    plan: LineupPlan,
    pitch: MatchGroundConditions["pitch"] | undefined,
    protectedIds: ReadonlySet<string>,
  ) => {
    if (!pitch) return { startingXI: [...startingXI], impactSubs: [...impactSubs] };
    const favouredStyle = pitch.favours.includes("spin-bowlers")
      ? "Spinner"
      : (
          pitch.favours.includes("pace-bowlers")
          || pitch.favours.includes("high-rated-pace-bowlers")
        )
        ? "Pacer"
        : null;
    if (!favouredStyle) return { startingXI: [...startingXI], impactSubs: [...impactSubs] };

    const targetOptions = favouredStyle === "Spinner" ? 2 : 3;
    let nextXI = [...startingXI];
    let nextSubs = [...impactSubs];
    const squad = getSelectableTeamSquad(players[nextXI[0]]?.currentTeamId ?? "");
    const candidates = squad.map(playerToLineupCandidate);
    const isStyle = (player: Player | undefined) => Boolean(
      player
      && (
        player.bowlingStyle === favouredStyle
        || (favouredStyle === "Spinner" && player.role === "Spin Bowler")
        || (favouredStyle === "Pacer" && player.role === "Pace Bowler")
      )
      && player.currentBowling >= 68
    );
    const countStyleOptions = () => nextXI
      .map((id) => players[id])
      .filter(isStyle)
      .length;

    while (countStyleOptions() < targetOptions) {
      const incoming = squad
        .filter((player) => !nextXI.includes(player.id) && isStyle(player))
        .sort((left, right) => (
          right.currentBowling - left.currentBowling
          || getPlayerRating(right) - getPlayerRating(left)
        ))[0];
      if (!incoming) break;

      const keepers = nextXI.filter((id) => {
        const player = players[id];
        return player?.role === "WK-Batsman" || player?.isWicketkeeper || player?.isPartTimeWk;
      });
      const outgoing = nextXI
        .map((id, index) => ({ player: players[id], index }))
        .filter(({ player, index }) => Boolean(
          player
          && index >= 4
          && !protectedIds.has(player.id)
          && (player.reputation ?? 0) < 10
          && !isStyle(player)
          && !(
            (player.role === "WK-Batsman" || player.isWicketkeeper || player.isPartTimeWk)
            && keepers.length <= 1
          )
          && player.currentBowling <= incoming.currentBowling + 2
        ))
        .sort((left, right) => (
          Number(right.index >= 7) - Number(left.index >= 7)
          || left.player.currentBowling - right.player.currentBowling
          || getPlayerRating(left.player) - getPlayerRating(right.player)
        ))[0];
      if (!outgoing?.player) break;

      const proposed = [...nextXI];
      proposed[outgoing.index] = incoming.id;
      if (!validateLineup(proposed, candidates, plan).isValid) break;
      nextXI = proposed;
      nextSubs = nextSubs
        .filter((id) => id !== incoming.id)
        .concat(outgoing.player.id)
        .slice(0, 5);
    }

    return { startingXI: nextXI, impactSubs: nextSubs };
  };

  const repairUserSelectionForMajorInjuries = (
    selection: {
      battingFirstXI: string[];
      bowlingFirstXI: string[];
      battingFirstImpactSubs: string[];
      bowlingFirstImpactSubs: string[];
    },
    teamId: string,
  ) => {
    const liveInjuries = useGameStore.getState().activeInjuries;
    const squad = getTeamSquad(teamId);
    const available = squad.filter((player) => !isPlayerMajorInjured(liveInjuries, player.id));
    const candidates = available.map(playerToLineupCandidate);
    const replacePlan = (startingXI: string[], impactSubs: string[], plan: LineupPlan) => {
      const nextXI = [...startingXI];
      const nextSubs = [...impactSubs];
      const selected = new Set(nextXI);
      const injuredIds = new Set(
        [...nextXI, ...nextSubs].filter((id) => isPlayerMajorInjured(liveInjuries, id)),
      );
      const replacementFor = (playerId: string, excluded: Set<string>) => {
        const injured = players[playerId];
        return available
          .filter((candidate) => !excluded.has(candidate.id) && !injuredIds.has(candidate.id))
          .sort((left, right) => (
            Number(left.role === injured?.role) - Number(right.role === injured?.role)
            || getPlayerRating(right) - getPlayerRating(left)
          ))[0];
      };

      for (let index = 0; index < nextXI.length; index += 1) {
        const playerId = nextXI[index];
        if (!isPlayerMajorInjured(liveInjuries, playerId)) continue;
        selected.delete(playerId);
        const replacement = replacementFor(playerId, selected);
        if (!replacement) return null;
        nextXI[index] = replacement.id;
        selected.add(replacement.id);
      }

      const used = new Set(nextXI);
      for (let index = 0; index < nextSubs.length; index += 1) {
        const playerId = nextSubs[index];
        if (!isPlayerMajorInjured(liveInjuries, playerId)) {
          used.add(playerId);
          continue;
        }
        const replacement = replacementFor(playerId, used);
        if (!replacement) return null;
        nextSubs[index] = replacement.id;
        used.add(replacement.id);
      }

      return validateLineup(nextXI, candidates, plan).isValid
        ? { startingXI: nextXI, impactSubs: nextSubs }
        : null;
    };

    const batting = replacePlan(selection.battingFirstXI, selection.battingFirstImpactSubs, "battingFirst");
    const bowling = replacePlan(selection.bowlingFirstXI, selection.bowlingFirstImpactSubs, "bowlingFirst");
    return batting && bowling
      ? {
          battingFirstXI: batting.startingXI,
          bowlingFirstXI: bowling.startingXI,
          battingFirstImpactSubs: batting.impactSubs,
          bowlingFirstImpactSubs: bowling.impactSubs,
        }
      : null;
  };

  const buildTeamMatchPlans = (
    teamId: string,
    userSelection?: {
      battingFirstXI: string[];
      bowlingFirstXI: string[];
      battingFirstImpactSubs: string[];
      bowlingFirstImpactSubs: string[];
    },
    conditions?: MatchGroundConditions,
    match?: Match,
    assistantManageUser = true,
  ): MatchTeamPlans => {
    const isUserControlled = teamId === userTeamId;
    if (isUserControlled && !assistantManageUser) {
      const requestedSelection = userSelection ?? {
        battingFirstXI,
        bowlingFirstXI,
        battingFirstImpactSubs,
        bowlingFirstImpactSubs,
      };
      const currentSquad = getTeamSquad(teamId);
      const liveInjuries = useGameStore.getState().activeInjuries;
      const selectableSquad = currentSquad.filter((player) => !isPlayerMajorInjured(liveInjuries, player.id));
      const currentSquadIds = new Set(currentSquad.map((player) => player.id));
      const savedIds = [
        ...requestedSelection.battingFirstXI,
        ...requestedSelection.bowlingFirstXI,
        ...requestedSelection.battingFirstImpactSubs,
        ...requestedSelection.bowlingFirstImpactSubs,
      ];
      const requestedPlanIsCurrent = (
        requestedSelection.battingFirstXI.length === 11
        && requestedSelection.bowlingFirstXI.length === 11
        && requestedSelection.battingFirstImpactSubs.length === 5
        && requestedSelection.bowlingFirstImpactSubs.length === 5
        && savedIds.every((playerId) => currentSquadIds.has(playerId))
      );
      const selection = requestedPlanIsCurrent
        ? requestedSelection
        : buildAutomaticLineupSelection(selectableSquad, {
            captainId: teamLeadership.captainId,
            viceCaptainId: teamLeadership.viceCaptainId,
            useProvisionalCaptain: !teamLeadership.captainId,
          });
      const repairedSelection = requestedPlanIsCurrent
        ? repairUserSelectionForMajorInjuries(selection, teamId)
        : null;
      const playableSelection = repairedSelection ?? (requestedPlanIsCurrent
        ? buildAutomaticLineupSelection(selectableSquad, {
            captainId: teamLeadership.captainId,
            viceCaptainId: teamLeadership.viceCaptainId,
            useProvisionalCaptain: !teamLeadership.captainId,
          })
        : selection);
      return {
        teamId,
        isUserControlled: true,
        tactics: teamTactics,
        battingFirst: toMatchLineupPlan(
          playableSelection.battingFirstXI,
          playableSelection.battingFirstImpactSubs,
          requestedPlanIsCurrent && !userSelection ? battingFirstImpactPlayerId : null,
          requestedPlanIsCurrent && !userSelection ? battingFirstOutgoingPlayerId : null,
          requestedPlanIsCurrent && !userSelection ? battingFirstImpactBattingPosition : null,
          teamLeadership.captainId,
          teamLeadership.viceCaptainId,
        ),
        bowlingFirst: toMatchLineupPlan(
          playableSelection.bowlingFirstXI,
          playableSelection.bowlingFirstImpactSubs,
          requestedPlanIsCurrent && !userSelection ? bowlingFirstImpactPlayerId : null,
          requestedPlanIsCurrent && !userSelection ? bowlingFirstOutgoingPlayerId : null,
          requestedPlanIsCurrent && !userSelection ? bowlingFirstImpactBattingPosition : null,
          teamLeadership.captainId,
          teamLeadership.viceCaptainId,
        ),
      };
    }

    const selectableSquad = getSelectableTeamSquad(teamId);
    const liveInjuries = useGameStore.getState().activeInjuries;
    const healthySquad = selectableSquad.filter((player) => !liveInjuries[player.id]);
    const isFacingUserTeam = Boolean(
      match
      && teamId !== userTeamId
      && (match.teamA === userTeamId || match.teamB === userTeamId),
    );
    // AI teams avoid playing through minor injuries in routine league matches
    // when they can still name both complete plans. Knockouts and depleted
    // squads may justify accepting the worsening risk.
    const squad = isFacingUserTeam
      ? selectableSquad
      : (!match?.stage && healthySquad.length >= 16 ? healthySquad : selectableSquad);
    const leadership = isUserControlled ? teamLeadership : aiTeamLeadership[teamId];
    const selection = buildAutomaticLineupSelection(squad, {
      captainId: leadership?.captainId,
      viceCaptainId: leadership?.viceCaptainId,
      useProvisionalCaptain: !leadership?.captainId,
    });
    const recommended = buildAiMatchLineups(squad, {
      captainId: leadership?.captainId,
      viceCaptainId: leadership?.viceCaptainId,
      useProvisionalCaptain: !leadership?.captainId,
    });
    const pitch = conditions?.pitch ?? getDefaultCuratorPitch(teamId);
    const protectedIds = new Set([
      leadership?.captainId,
      leadership?.viceCaptainId,
      recommended.battingFirst.captainId,
      recommended.battingFirst.viceCaptainId,
      recommended.bowlingFirst.captainId,
      recommended.bowlingFirst.viceCaptainId,
    ].filter((id): id is string => Boolean(id)));
    const tunedBattingFirst = isFacingUserTeam
      ? { startingXI: selection.battingFirstXI, impactSubs: selection.battingFirstImpactSubs }
      : tuneAiPlanForPitch(
          selection.battingFirstXI,
          selection.battingFirstImpactSubs,
          "battingFirst",
          pitch,
          protectedIds,
        );
    const tunedBowlingFirst = isFacingUserTeam
      ? { startingXI: selection.bowlingFirstXI, impactSubs: selection.bowlingFirstImpactSubs }
      : tuneAiPlanForPitch(
          selection.bowlingFirstXI,
          selection.bowlingFirstImpactSubs,
          "bowlingFirst",
          pitch,
          protectedIds,
        );
    return {
      teamId,
      isUserControlled,
      tactics: pitch
        ? createIntelligentAiTactics(teams[teamId], pitch, careerStaff)
        : createTeamTactics(teams[teamId]?.aiPersonality === "Aggressive" ? "Ultra Aggressive" : "Balanced"),
      battingFirst: toMatchLineupPlan(
        tunedBattingFirst.startingXI,
        tunedBattingFirst.impactSubs,
        tunedBattingFirst.impactSubs.includes(recommended.battingFirst.impactPlayerId ?? "")
          ? recommended.battingFirst.impactPlayerId
          : null,
        tunedBattingFirst.startingXI.includes(recommended.battingFirst.likelyOutgoingPlayerId ?? "")
          ? recommended.battingFirst.likelyOutgoingPlayerId
          : null,
        recommended.battingFirst.impactBattingPosition,
        recommended.battingFirst.captainId,
        recommended.battingFirst.viceCaptainId,
      ),
      bowlingFirst: toMatchLineupPlan(
        tunedBowlingFirst.startingXI,
        tunedBowlingFirst.impactSubs,
        tunedBowlingFirst.impactSubs.includes(recommended.bowlingFirst.impactPlayerId ?? "")
          ? recommended.bowlingFirst.impactPlayerId
          : null,
        tunedBowlingFirst.startingXI.includes(recommended.bowlingFirst.likelyOutgoingPlayerId ?? "")
          ? recommended.bowlingFirst.likelyOutgoingPlayerId
          : null,
        recommended.bowlingFirst.impactBattingPosition,
        recommended.bowlingFirst.captainId,
        recommended.bowlingFirst.viceCaptainId,
      ),
    };
  };

  const getRecentFormAdjustments = (match: Match): { batting: Record<string, number>; bowling: Record<string, number> } => {
    const involvedTeamIds = new Set([match.teamA, match.teamB]);
    const recent = fixtures
      .filter((fixture) => (
        fixture.played
        && fixture.simulation
        && (involvedTeamIds.has(fixture.teamA) || involvedTeamIds.has(fixture.teamB))
      ))
      .slice(-20);
    const battingPerformances = new Map<string, number[]>();
    const bowlingPerformances = new Map<string, number[]>();
    recent.forEach((fixture) => {
      const matchBatting = new Map<string, number>();
      const matchBowling = new Map<string, number>();
      fixture.simulation?.innings.forEach((innings) => {
        innings.batting.forEach((entry) => {
          if (entry.didNotBat) return;
          const strikeRate = entry.balls > 0 ? entry.runs * 100 / entry.balls : 0;
          const battingForm = entry.runs >= 50
            ? Math.min(2, 1 + (entry.runs - 50) / 50)
            : entry.runs >= 35 && strikeRate >= 150
              ? 0.8
              : entry.balls >= 5 && entry.runs < 10
                ? -1.2
                : entry.runs < 20
                  ? -0.4
                  : 0;
          matchBatting.set(entry.id, battingForm);
        });
        innings.bowling.forEach((entry) => {
          if (entry.balls === 0) return;
          const economy = entry.runsConceded / (entry.balls / 6);
          matchBowling.set(entry.id, Math.min(5, Math.max(-5, entry.wickets * 1.3 + (8 - economy) * 0.4)));
        });
      });
      Object.values(fixture.simulation?.lineups ?? {}).forEach((lineup) => {
        [...lineup.startingXI, ...lineup.finalXI].forEach((playerId) => {
          if (!matchBatting.has(playerId)) matchBatting.set(playerId, 0);
          if (!matchBowling.has(playerId)) matchBowling.set(playerId, 0);
        });
      });
      const append = (target: Map<string, number[]>, performance: number, playerId: string) => {
        const values = target.get(playerId) ?? [];
        values.push(Math.min(5, Math.max(-5, performance)));
        target.set(playerId, values.slice(-5));
      };
      matchBatting.forEach((value, playerId) => append(battingPerformances, value, playerId));
      matchBowling.forEach((value, playerId) => append(bowlingPerformances, value, playerId));
    });
    const calculate = (performances: Map<string, number[]>) => Object.fromEntries(Array.from(performances, ([playerId, values]) => {
      const weights = values.map((_, index) => index + 1);
      const weightedAverage = values.reduce(
        (sum, value, index) => sum + value * weights[index],
        0,
      ) / weights.reduce((sum, weight) => sum + weight, 0);
      const excellentMatches = values.filter((value) => value >= 1).length;
      const decayed = weightedAverage > 0 && excellentMatches < 2 ? 0 : weightedAverage;
      return [playerId, Math.max(-2.5, Math.min(2, decayed))];
    }));
    const isPlayoff = Boolean(match.stage);
    const applyMatchContext = (base: Record<string, number>) => Object.fromEntries(
      Object.entries(base).map(([playerId, value]) => [playerId, isPlayoff ? value * 1.75 : value]),
    );
    return {
      batting: applyMatchContext(calculate(battingPerformances)),
      bowling: applyMatchContext(calculate(bowlingPerformances)),
    };
  };

  const simulationToLegacyScorecard = (
    simulation: MatchSimulationRecord,
    teamA: string,
    teamB: string,
  ): MatchScorecard => {
    const teamAInnings = simulation.innings.find((innings) => innings.battingTeamId === teamA)!;
    const teamBInnings = simulation.innings.find((innings) => innings.battingTeamId === teamB)!;
    const convertInnings = (innings: MatchInnings): InningsScorecard => ({
      batting: innings.batting.map((entry) => ({
        id: entry.id,
        name: entry.name,
        runs: entry.runs,
        balls: entry.balls,
        fours: entry.fours,
        sixes: entry.sixes,
        dismissal: entry.dismissal,
      })),
      bowling: innings.bowling.map((entry) => ({
        id: entry.id,
        name: entry.name,
        overs: entry.overs,
        wickets: entry.wickets,
        runsConceded: entry.runsConceded,
        maidens: entry.maidens,
        wides: entry.wides,
        noBalls: entry.noBalls,
      })),
      extras: innings.extras.total,
    });
    return {
      inningsA: convertInnings(teamAInnings),
      inningsB: convertInnings(teamBInnings),
    };
  };

  const getSeasonFinalDate = () => (
    fixturesRef.current.find((fixture) => fixture.stage === "final")?.date
  );

  useEffect(() => {
    if (!isCareerLoaded || standings.length === 0) return;
    processAITrades({
      date: currentDate,
      finalDate: getSeasonFinalDate(),
      standingsTeamIds: standings.map((standing) => standing.teamId),
    });
  }, [currentDate, currentSeason, isCareerLoaded, processAITrades, standings]);

  const getTeamFinalLeagueDate = (teamId: string) => fixturesRef.current
    .filter((fixture) => !fixture.stage && (fixture.teamA === teamId || fixture.teamB === teamId))
    .map((fixture) => fixture.date)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);

  const processAIReplacementSignings = (date: string) => processAIInjuryReplacements({
    date,
    seasonFinalDate: getSeasonFinalDate(),
    teamFinalLeagueDates: Object.fromEntries(Object.keys(teams).map((teamId) => [
      teamId,
      getTeamFinalLeagueDate(teamId),
    ])),
  });

  const publishUserInjuryUpdates = (result: InjuryProcessingResult, date: string) => {
    const updates = [
      ...result.created.map((injury) => ({ injury, kind: "created" as const })),
      ...result.worsened.map((injury) => ({ injury, kind: "worsened" as const })),
      ...result.recovered.map((injury) => ({ injury, kind: "recovered" as const })),
    ].filter(({ injury }) => (
      injury.teamId === userTeamId || players[injury.playerId]?.currentTeamId === userTeamId
    ));
    if (updates.length === 0) return;

    setInbox((currentInbox) => {
      const existingIds = new Set(currentInbox.map((message) => message.dedupeKey));
      let sequence = currentInbox
        .filter((message) => message.date === date)
        .reduce((highest, message) => Math.max(highest, message.daySequence), 0);
      const messages: CareerEmail[] = updates.flatMap(({ injury, kind }) => {
        const dedupeKey = `injury:${kind}:${injury.id}`;
        if (existingIds.has(dedupeKey)) return [];
        sequence += 1;
        const isRecovery = kind === "recovered";
        const isWorsening = kind === "worsened";
        const replacementEligible = !isRecovery && injuryQualifiesForReplacement(injury, {
          date,
          season: currentSeason,
          seasonFinalDate: getSeasonFinalDate(),
          teamFinalLeagueDate: getTeamFinalLeagueDate(userTeamId),
        });
        const replacementSigned = Boolean(replacementForInjury(injuryReplacementRecords, injury.id));
        const riskLabel = injury.worseningRisk
          ? `${injury.worseningRisk[0].toUpperCase()}${injury.worseningRisk.slice(1)} risk of worsening if selected.`
          : "The player is unavailable for selection.";
        const statusText = isRecovery
          ? `${injury.playerName} has recovered from ${injury.conditionName.toLowerCase()} and is available at full ability.`
          : `${injury.playerName} has ${isWorsening ? "aggravated an existing condition and now has" : "been diagnosed with"} ${injury.conditionName.toLowerCase()}.

${injury.category === "minor" ? riskLabel : "This is a major condition and the player cannot be selected."}

${getInjuryReturnLabel(injury, getSeasonFinalDate())}${replacementEligible
  ? "\n\nThe player is eligible for a season injury replacement from the unsold auction pool."
  : ""}`;
        return [{
          id: `${dedupeKey}:${sequence}`,
          templateId: `injury-${kind}`,
          dedupeKey,
          threadId: `medical:${injury.playerId}`,
          daySequence: sequence,
          sender: "Medical Update",
          subject: isRecovery
            ? `${injury.playerName} cleared to return`
            : isWorsening
              ? `${injury.playerName}'s injury has worsened`
              : `${injury.playerName}: ${injury.conditionName}`,
          preview: isRecovery
            ? "Available for selection at full ability."
            : injury.category === "major"
              ? "Unavailable for selection."
              : `${injury.worseningRisk ?? "mild"} risk of worsening if selected.`,
          body: statusText,
          category: "squad" as const,
          priority: injury.category === "major" && !isRecovery ? "urgent" as const : "important" as const,
          date,
          unread: true,
          requiresAction: replacementEligible,
          actionCompleted: replacementEligible ? replacementSigned : false,
          actions: [{ label: replacementEligible ? "Choose injury replacement" : "Open Injury Hub", kind: "navigate" as const, tab: "squad" as const, subtab: "injuryhub" }],
        }];
      });
      if (messages.length === 0) return currentInbox;
      const nextInbox = [...messages, ...currentInbox];
      saveCareerState({ inbox: nextInbox });
      return nextInbox;
    });
  };

  const processCompletedMatchInjuries = (match: Match): InjuryProcessingResult => {
    if (!match.simulation) return { created: [], worsened: [], recovered: [] };
    const participantsById = new Map<string, { player: Player; teamId: string }>();
    Object.values(match.simulation.lineups).forEach((lineup) => {
      Array.from(new Set([...lineup.startingXI, ...lineup.finalXI])).forEach((playerId) => {
        const player = players[playerId];
        if (player) participantsById.set(playerId, { player, teamId: lineup.teamId });
      });
    });
    const date = match.date ?? currentDate;
    const result = processMatchInjuries({
      matchId: match.id,
      date,
      season: currentSeason,
      seed: `${fixtureSeed}:${match.id}`,
      teamIds: [match.teamA, match.teamB],
      participants: Array.from(participantsById.values()),
    });
    processAIReplacementSignings(date);
    publishUserInjuryUpdates(result, date);
    return result;
  };

  const processCalendarInjuries = (date: string) => {
    const finalDate = getSeasonFinalDate();
    const firstFixtureDate = fixturesRef.current
      .map((fixture) => fixture.date)
      .filter((fixtureDate): fixtureDate is string => Boolean(fixtureDate))
      .sort()[0];
    const liveAuction = useGameStore.getState().auction;
    const backgroundResult = processBackgroundInjuries({
      date,
      season: currentSeason,
      seed: fixtureSeed,
      preseason: Boolean(firstFixtureDate && date <= firstFixtureDate),
      preseasonStartDate: auctionDateString,
      firstFixtureDate,
      seasonFinalDate: finalDate,
      generationEnabled: Boolean(
        liveAuction?.phase === "completed"
        && finalDate
        && date <= finalDate
      ),
    });
    const result: InjuryProcessingResult = backgroundResult;
    processAIReplacementSignings(date);
    publishUserInjuryUpdates(result, date);
    return result;
  };

  useEffect(() => {
    if (!isCareerLoaded || fixturesRef.current.length < TOTAL_FIXTURE_COUNT || auction?.phase !== "completed") return;
    const recovered = reconcileInjuries(currentDate);
    if (recovered.length > 0) {
      publishUserInjuryUpdates({ created: [], worsened: [], recovered }, currentDate);
    }
    processAIReplacementSignings(currentDate);
  // Retry after the separately persisted fixture calendar finishes loading as
  // well as on date changes. Without that retry, a reloaded April save checks
  // against an empty calendar and silently rejects every replacement.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auction?.phase, currentDate, fixtures.length, isCareerLoaded]);

  // Compact career saves deliberately omit the duplicate legacy scorecard,
  // keeping the canonical innings inside `simulation`. Every route that can
  // load or replace fixtures (including a new-season rollover) must expose the
  // derived scorecard to the UI, not only the initial local-storage loader.
  useEffect(() => {
    let repaired = false;
    const repairedFixtures = fixtures.map((fixture) => {
      if (fixture.scorecard || !fixture.simulation) return fixture;
      const hasBothInnings = fixture.simulation.innings.some(
        (innings) => innings.battingTeamId === fixture.teamA,
      ) && fixture.simulation.innings.some(
        (innings) => innings.battingTeamId === fixture.teamB,
      );
      if (!hasBothInnings) return fixture;
      repaired = true;
      return {
        ...fixture,
        commentary: fixture.commentary ?? fixture.simulation.summary,
        scorecard: simulationToLegacyScorecard(
          fixture.simulation,
          fixture.teamA,
          fixture.teamB,
        ),
      };
    });
    if (!repaired) return;
    fixturesRef.current = repairedFixtures;
    setFixtures(repairedFixtures);
    setActiveScorecard((current) => {
      if (!current || current.scorecard) return current;
      return repairedFixtures.find((fixture) => fixture.id === current.id) ?? current;
    });
  }, [fixtures]);

  const resolveKnockoutBracket = (
    sourceFixtures: Match[],
    leagueTable: LeagueStandings[],
  ): Match[] => {
    const leagueComplete = sourceFixtures.filter((fixture) => !fixture.stage)
      .every((fixture) => fixture.played);
    if (!leagueComplete) return sourceFixtures;

    const topFour = leagueTable.slice(0, 4).map((entry) => entry.teamId);
    const qualifier1 = sourceFixtures.find((fixture) => fixture.stage === "qualifier1");
    const eliminator = sourceFixtures.find((fixture) => fixture.stage === "eliminator");
    const qualifier2 = sourceFixtures.find((fixture) => fixture.stage === "qualifier2");
    const qualifier1Winner = qualifier1?.played ? qualifier1.winner : undefined;
    const qualifier1Loser = qualifier1Winner && qualifier1
      ? qualifier1.teamA === qualifier1Winner ? qualifier1.teamB : qualifier1.teamA
      : undefined;
    const eliminatorWinner = eliminator?.played ? eliminator.winner : undefined;
    const qualifier2Winner = qualifier2?.played ? qualifier2.winner : undefined;

    return sourceFixtures.map((fixture) => {
      if (fixture.stage === "qualifier1" && topFour.length === 4 && !fixture.played) {
        return { ...fixture, teamA: topFour[0], teamB: topFour[1] };
      }
      if (fixture.stage === "eliminator" && topFour.length === 4 && !fixture.played) {
        return { ...fixture, teamA: topFour[2], teamB: topFour[3] };
      }
      if (
        fixture.stage === "qualifier2"
        && !fixture.played
        && qualifier1Loser
        && eliminatorWinner
      ) {
        return { ...fixture, teamA: qualifier1Loser, teamB: eliminatorWinner };
      }
      if (
        fixture.stage === "final"
        && !fixture.played
        && qualifier1Winner
        && qualifier2Winner
      ) {
        return { ...fixture, teamA: qualifier1Winner, teamB: qualifier2Winner };
      }
      return fixture;
    });
  };

  const buildPlayableMatchInput = (
    match: Match,
    userSelection?: {
      battingFirstXI: string[];
      bowlingFirstXI: string[];
      battingFirstImpactSubs: string[];
      bowlingFirstImpactSubs: string[];
    },
  ): MatchSimulationInput => {
    if (!FIXTURE_SIMULATION_ENABLED) throw new Error("Fixture simulation is not currently enabled.");
    const conditions = getMatchConditions(match);
    const teamA = teams[match.teamA];
    const teamB = teams[match.teamB];
    if (!conditions || !teamA || !teamB) {
      throw new Error("The match stadium, pitch or team data is incomplete.");
    }
    const liveInjuries = useGameStore.getState().activeInjuries;
    const containsMajorInjury = (plans: MatchTeamPlans) => [
      ...plans.battingFirst.startingXI,
      ...plans.battingFirst.impactSubs,
      ...plans.bowlingFirst.startingXI,
      ...plans.bowlingFirst.impactSubs,
    ].some((playerId) => isPlayerMajorInjured(liveInjuries, playerId));
    let teamAPlans = buildTeamMatchPlans(match.teamA, userSelection, conditions, match, false);
    let teamBPlans = buildTeamMatchPlans(match.teamB, userSelection, conditions, match, false);
    if (containsMajorInjury(teamAPlans)) {
      teamAPlans = match.teamA === userTeamId
        ? buildTeamMatchPlans(match.teamA, userSelection, conditions, match, false)
        : buildTeamMatchPlans(match.teamA, undefined, conditions, match, true);
    }
    if (containsMajorInjury(teamBPlans)) {
      teamBPlans = match.teamB === userTeamId
        ? buildTeamMatchPlans(match.teamB, userSelection, conditions, match, false)
        : buildTeamMatchPlans(match.teamB, undefined, conditions, match, true);
    }
    if (containsMajorInjury(teamAPlans) || containsMajorInjury(teamBPlans)) {
      throw new Error("A major-injured player remained in a generated match squad.");
    }
    return {
      fixtureId: match.id,
      matchNumber: match.matchNumber,
      date: match.date,
      time: match.time,
      seed: `${currentSeason}:${fixtureSeed}:${match.id}`,
      teamA,
      teamB,
      players,
      teamAPlans,
      teamBPlans,
      conditions,
      battingFormAdjustments: getRecentFormAdjustments(match).batting,
      bowlingFormAdjustments: getRecentFormAdjustments(match).bowling,
      seasonBattingStats: playerStats,
      stage: match.stage,
      isKnockout: Boolean(match.stage),
    };
  };

  const buildSimulatedMatch = (
    match: Match,
    userSelection?: {
      battingFirstXI: string[];
      bowlingFirstXI: string[];
      battingFirstImpactSubs: string[];
      bowlingFirstImpactSubs: string[];
    },
    // A user simulation must use the saved match plan by default. Assistant
    // management is opt-in for explicit recovery/auto-management flows.
    assistantManageUser = false,
  ): Match => {
    if (!FIXTURE_SIMULATION_ENABLED) {
      throw new Error("Fixture simulation is not currently enabled.");
    }
    const conditions = getMatchConditions(match);
    const teamA = teams[match.teamA];
    const teamB = teams[match.teamB];
    if (!conditions || !teamA || !teamB) {
      throw new Error("The match stadium, pitch or team data is incomplete.");
    }
    const liveInjuries = useGameStore.getState().activeInjuries;
    const containsMajorInjury = (plans: MatchTeamPlans) => [
      ...plans.battingFirst.startingXI,
      ...plans.battingFirst.impactSubs,
      ...plans.bowlingFirst.startingXI,
      ...plans.bowlingFirst.impactSubs,
    ].some((playerId) => isPlayerMajorInjured(liveInjuries, playerId));
    let teamAPlans = buildTeamMatchPlans(match.teamA, userSelection, conditions, match, assistantManageUser);
    let teamBPlans = buildTeamMatchPlans(match.teamB, userSelection, conditions, match, assistantManageUser);
    // Final shared safety boundary: no simulation route, including bulk/end of
    // season automation, may pass a major-injured player to the match engine.
    if (containsMajorInjury(teamAPlans)) {
      teamAPlans = match.teamA === userTeamId && !assistantManageUser
        ? buildTeamMatchPlans(match.teamA, userSelection, conditions, match, false)
        : buildTeamMatchPlans(match.teamA, undefined, conditions, match, true);
    }
    if (containsMajorInjury(teamBPlans)) {
      teamBPlans = match.teamB === userTeamId && !assistantManageUser
        ? buildTeamMatchPlans(match.teamB, userSelection, conditions, match, false)
        : buildTeamMatchPlans(match.teamB, undefined, conditions, match, true);
    }
    if (containsMajorInjury(teamAPlans) || containsMajorInjury(teamBPlans)) {
      throw new Error("A major-injured player remained in a generated match squad.");
    }
    const simulation = simulateInstantMatch({
      fixtureId: match.id,
      matchNumber: match.matchNumber,
      date: match.date,
      time: match.time,
      seed: `${currentSeason}:${fixtureSeed}:${match.id}`,
      teamA,
      teamB,
      players,
      teamAPlans,
      teamBPlans,
      conditions,
      battingFormAdjustments: getRecentFormAdjustments(match).batting,
      bowlingFormAdjustments: getRecentFormAdjustments(match).bowling,
      seasonBattingStats: playerStats,
      stage: match.stage,
      isKnockout: Boolean(match.stage),
    });
    if (match.stage && !simulation.winnerId) {
      const superOverHash = Array.from(`${fixtureSeed}:${match.id}`).reduce(
        (value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619),
        2166136261,
      );
      const superOverWinnerId = (superOverHash >>> 0) % 2 === 0 ? match.teamA : match.teamB;
      simulation.winnerId = superOverWinnerId;
      simulation.resultText = `${teams[superOverWinnerId].name} won after a Super Over.`;
      simulation.summary = [
        ...simulation.summary.slice(0, -2),
        simulation.resultText,
        ...simulation.summary.slice(-1),
      ];
    }
    const teamAInnings = simulation.innings.find((innings) => innings.battingTeamId === match.teamA)!;
    const teamBInnings = simulation.innings.find((innings) => innings.battingTeamId === match.teamB)!;
    return {
      ...match,
      played: true,
      winner: simulation.winnerId ?? undefined,
      scoreA: {
        runs: teamAInnings.runs,
        wickets: teamAInnings.wickets,
        overs: teamAInnings.overs,
      },
      scoreB: {
        runs: teamBInnings.runs,
        wickets: teamBInnings.wickets,
        overs: teamBInnings.overs,
      },
      commentary: simulation.summary,
      scorecard: simulationToLegacyScorecard(simulation, match.teamA, match.teamB),
      simulation,
    };
  };

  const commitSimulatedMatch = (
    simulatedMatch: Match,
    sourceFixtures = fixturesRef.current,
    sourceStats = playerStatsRef.current,
  ) => {
    if (simulatedMatch.simulation && hasArchivedDeliveries(simulatedMatch.simulation)) {
      void saveMatchSimulations(matchArchiveCareerId, [simulatedMatch.simulation])
        .catch((error) => console.error("Unable to archive completed match details:", error));
    }
    const memoryMatch = simulatedMatch.simulation
      ? { ...simulatedMatch, simulation: compactMatchSimulation(simulatedMatch.simulation) }
      : simulatedMatch;
    let nextFixtures = sourceFixtures.map((fixture) => (
      fixture.id === memoryMatch.id ? memoryMatch : fixture
    ));
    const nextPlayerStats = Object.fromEntries(
      Object.entries(sourceStats).map(([playerId, stats]) => [playerId, { ...stats }]),
    ) as Record<string, PlayerStats>;
    if (simulatedMatch.scorecard) {
      accumulateStats(
        simulatedMatch.scorecard,
        simulatedMatch.teamA,
        simulatedMatch.teamB,
        nextPlayerStats,
        simulatedMatch.simulation,
      );
    }
    const careerUpdate = toIplCareerMatchUpdate(simulatedMatch, currentSeason);
    if (careerUpdate) recordIplMatchStats([careerUpdate]);
    processCompletedMatchInjuries(simulatedMatch);

    const recordCheck = trackMinorRecordsOnMatchComplete(simulatedMatch, minorRecords, teams, currentSeason);
    let nextMinorRecords = minorRecords;
    let nextInbox = inbox;
    if (recordCheck.brokenRecordNotices.length > 0) {
      nextMinorRecords = recordCheck.updatedRecords;
      setMinorRecords(nextMinorRecords);
      
      const newEmails = recordCheck.brokenRecordNotices.map((notice, idx) => {
        const recordTitle = notice.split('"')[1] ?? "IPL Record";
        const emailId = `record_broken_${recordTitle.replace(/\s+/g, "_")}_${Date.now()}_${idx}`;
        return {
          id: emailId,
          templateId: "record_broken",
          dedupeKey: emailId,
          threadId: "records_announcement",
          daySequence: 99 + idx,
          sender: "IPL Stat Operations",
          subject: `🚨 RECORD BROKEN: ${recordTitle}`,
          preview: `The all-time record for "${recordTitle}" has been broken!`,
          body: `A historic moment in the IPL!

The all-time record for "${recordTitle}" has been broken.

${notice}

This record has been officially verified and added to the IPL Minor Records archive.`,
          category: "league" as const,
          priority: "normal" as const,
          date: currentDate,
          unread: true,
          requiresAction: false,
          actionCompleted: false,
          actions: [],
        };
      });
      nextInbox = [...newEmails, ...inbox];
      setInbox(nextInbox);
    }

    const nextStandings = calculateStandings(nextFixtures);
    nextFixtures = resolveKnockoutBracket(nextFixtures, nextStandings);
    fixturesRef.current = nextFixtures;
    playerStatsRef.current = nextPlayerStats;
    setFixtures(nextFixtures);
    setPlayerStats(nextPlayerStats);
    setStandings(nextStandings);
    saveCareerState({
      fixtures: nextFixtures,
      playerStats: nextPlayerStats,
      standings: nextStandings,
      minorRecords: nextMinorRecords,
      inbox: nextInbox,
    });
    return { nextFixtures, nextPlayerStats, nextStandings };
  };

  const getUserLineupErrors = () => {
    const squad = getTeamSquad(userTeamId);
    const candidates = squad.map(playerToLineupCandidate);
    const describe = (
      plan: LineupPlan,
      ids: readonly string[],
      subs: readonly string[],
      impactPlayerId: string | null,
      outgoingPlayerId: string | null,
    ) => {
      const validation = validateLineup(ids, candidates, plan);
      const label = plan === "battingFirst" ? "Bat-first XI" : "Bowl-first XI";
      const problems: string[] = [];
      if (new Set(ids).size !== ids.length) problems.push(`${label} contains the same player more than once.`);
      if (validation.playerCount !== 11) problems.push(`${label} must contain exactly 11 eligible squad players.`);
      if (validation.overseasCount > 4) problems.push(`${label} has ${validation.overseasCount} overseas players; the maximum is 4.`);
      if (validation.wicketkeeperCount < 1) problems.push(`${label} needs a wicketkeeper.`);
      const requiredBowlers = plan === "bowlingFirst" ? 5 : 4;
      if (validation.bowlingOptionCount < requiredBowlers) {
        problems.push(`${label} needs at least ${requiredBowlers} recognised bowling options.`);
      }
      if (subs.length !== 5 || new Set(subs).size !== subs.length) {
        problems.push(`${label} must name five different Impact substitutes.`);
      }
      if (subs.some((id) => ids.includes(id) || !candidates.some((candidate) => candidate.id === id))) {
        problems.push(`${label} has an ineligible Impact substitute.`);
      }
      const majorInjuredIds = Array.from(new Set([...ids, ...subs].filter((id) => (
        isPlayerMajorInjured(activeInjuries, id)
      ))));
      majorInjuredIds.forEach((playerId) => {
        const injury = activeInjuries[playerId];
        problems.push(`${players[playerId]?.name ?? injury.playerName} cannot be selected because of a major ${injury.conditionName.toLowerCase()}.`);
      });
      const selectedImpact = impactPlayerId ? players[impactPlayerId] : null;
      const selectedOutgoing = outgoingPlayerId ? players[outgoingPlayerId] : null;
      const overseasStarters = ids.filter((id) => players[id]?.nationality === "Overseas").length;
      if (
        selectedImpact?.nationality === "Overseas"
        && overseasStarters - Number(selectedOutgoing?.nationality === "Overseas") >= 4
      ) {
        problems.push(`${label}'s selected Impact change would introduce a fifth overseas player.`);
      }
      return problems;
    };
    return Array.from(new Set([
      ...describe(
        "battingFirst",
        battingFirstXI,
        battingFirstImpactSubs,
        battingFirstImpactPlayerId,
        battingFirstOutgoingPlayerId,
      ),
      ...describe(
        "bowlingFirst",
        bowlingFirstXI,
        bowlingFirstImpactSubs,
        bowlingFirstImpactPlayerId,
        bowlingFirstOutgoingPlayerId,
      ),
    ]));
  };

  const getUserPreparationWarnings = (match: Match) => {
    const conditions = getMatchConditions(match);
    if (!conditions) return ["The selected stadium conditions could not be loaded."];
    const simulatedPlans = buildTeamMatchPlans(userTeamId, undefined, conditions, match, false);
    const battingFirstIds = simulatedPlans.battingFirst.startingXI;
    const bowlingFirstIds = simulatedPlans.bowlingFirst.startingXI;
    const warnings = [
      ...getMatchPreparationWarnings(
        battingFirstIds.map((id) => players[id]).filter((player): player is Player => Boolean(player)),
        simulatedPlans.tactics,
        conditions,
      ),
      ...getMatchPreparationWarnings(
        bowlingFirstIds.map((id) => players[id]).filter((player): player is Player => Boolean(player)),
        simulatedPlans.tactics,
        conditions,
      ),
    ];
    const selectedIds = Array.from(new Set([
      ...battingFirstIds,
      ...bowlingFirstIds,
      ...simulatedPlans.battingFirst.impactSubs,
      ...simulatedPlans.bowlingFirst.impactSubs,
    ]));
    const injuryWarnings = selectedIds.flatMap((playerId) => {
      const injury = getPlayerMinorInjury(activeInjuries, playerId);
      if (!injury) return [];
      const risk = injury.worseningRisk
        ? `${injury.worseningRisk[0].toUpperCase()}${injury.worseningRisk.slice(1)}`
        : "Mild";
      return [`${players[playerId]?.name ?? injury.playerName} is carrying ${injury.conditionName.toLowerCase()}. ${risk} risk of injury worsening if selected.`];
    });
    return Array.from(new Set([...injuryWarnings, ...warnings]));
  };

  const runFixtureSimulation = (
    matchId: string,
    userSelection?: {
      battingFirstXI: string[];
      bowlingFirstXI: string[];
      battingFirstImpactSubs: string[];
      bowlingFirstImpactSubs: string[];
    },
  ) => {
    const match = fixturesRef.current.find((fixture) => fixture.id === matchId);
    if (!match || match.played) return;
    try {
      const simulatedMatch = buildSimulatedMatch(match, userSelection);
      commitSimulatedMatch(simulatedMatch);
      setPendingMatchPreparation(null);
      setActiveCommentary(null);
      setActiveMatchResultView("scorecard");
      setActiveScorecard(simulatedMatch);
      showToast(simulatedMatch.simulation?.resultText ?? "Match simulation completed.");
    } catch (error) {
      console.error("Unable to simulate fixture:", error);
      showToast(error instanceof Error ? error.message : "Unable to simulate this fixture.");
    }
  };

  const prepareUserFixtureSimulation = (match: Match) => {
    const warnings = getUserPreparationWarnings(match);
    if (warnings.length > 0) {
      const containsInjuryWarning = warnings.some((warning) => warning.includes("risk of injury worsening"));
      setPendingMatchPreparation({
        matchId: match.id,
        errors: [],
        warnings,
        warningDestination: containsInjuryWarning ? "playingxi" : "tactics",
      });
      return;
    }
    runFixtureSimulation(match.id);
  };

  const startPlayableMatch = (match: Match) => {
    if (match.played || (match.teamA !== userTeamId && match.teamB !== userTeamId)) return;
    const errors = getUserLineupErrors();
    if (errors.length > 0) {
      showToast(errors[0]);
      return;
    }
    try {
      // Validate every dependency before creating a resumable career entry.
      buildPlayableMatchInput(match);
      const session: PlayableMatchSession = {
        version: 1,
        fixtureId: match.id,
        revealedDeliveries: 0,
        decisions: {
          deliveryControls: {},
          bowlerByOver: {},
          batterByWicket: {},
          impactByTeam: {},
        },
      };
      setActivePlayedMatch(session);
      saveCareerState({ activePlayedMatch: session });
    } catch (error) {
      console.error("Unable to start playable match:", error);
      showToast(error instanceof Error ? error.message : "Unable to start this match.");
    }
  };

  const savePlayableMatchSession = (session: PlayableMatchSession) => {
    setActivePlayedMatch(session);
    // Every callback follows a completed delivery or an explicit match
    // decision, making reload resume at a stable delivery boundary.
    saveCareerState({ activePlayedMatch: session });
  };

  const completePlayableMatch = (simulation: MatchSimulationRecord) => {
    const match = fixturesRef.current.find((fixture) => fixture.id === simulation.fixtureId);
    if (!match || match.played) {
      setActivePlayedMatch(null);
      saveCareerState({ activePlayedMatch: null });
      return;
    }
    const teamAInnings = simulation.innings.find((innings) => innings.battingTeamId === match.teamA)!;
    const teamBInnings = simulation.innings.find((innings) => innings.battingTeamId === match.teamB)!;
    const completedMatch: Match = {
      ...match,
      played: true,
      winner: simulation.winnerId,
      scoreA: { runs: teamAInnings.runs, wickets: teamAInnings.wickets, overs: teamAInnings.overs },
      scoreB: { runs: teamBInnings.runs, wickets: teamBInnings.wickets, overs: teamBInnings.overs },
      commentary: simulation.summary,
      scorecard: simulationToLegacyScorecard(simulation, match.teamA, match.teamB),
      simulation,
    };
    setActivePlayedMatch(null);
    commitSimulatedMatch(completedMatch);
    saveCareerState({ activePlayedMatch: null });
    setActiveMatchResultView("scorecard");
    setActiveCommentary(null);
    setActiveScorecard(completedMatch);
    showToast(simulation.resultText);
  };

  const simulateAiFixturesOnDate = (date: string) => {
    let nextFixtures = [...fixturesRef.current];
    const nextPlayerStats = Object.fromEntries(
      Object.entries(playerStatsRef.current).map(([playerId, stats]) => [playerId, { ...stats }]),
    ) as Record<string, PlayerStats>;
    const matches = nextFixtures.filter((match) => (
      !match.played
      && match.date === date
      && match.teamA !== userTeamId
      && match.teamB !== userTeamId
    ));
    const careerUpdates: IplCareerMatchUpdate[] = [];
    let nextMinorRecords = minorRecords;
    const allNotices: string[] = [];

    matches.forEach((match) => {
      const simulatedMatch = buildSimulatedMatch(match);
      if (simulatedMatch.simulation && hasArchivedDeliveries(simulatedMatch.simulation)) {
        void saveMatchSimulations(matchArchiveCareerId, [simulatedMatch.simulation])
          .catch((error) => console.error("Unable to archive completed AI match details:", error));
      }
      const memoryMatch = simulatedMatch.simulation
        ? { ...simulatedMatch, simulation: compactMatchSimulation(simulatedMatch.simulation) }
        : simulatedMatch;
      nextFixtures = nextFixtures.map((fixture) => (
        fixture.id === match.id ? memoryMatch : fixture
      ));
      if (simulatedMatch.scorecard) {
        accumulateStats(
          simulatedMatch.scorecard,
          simulatedMatch.teamA,
          simulatedMatch.teamB,
          nextPlayerStats,
          simulatedMatch.simulation,
        );
      }
      const careerUpdate = toIplCareerMatchUpdate(simulatedMatch, currentSeason);
      if (careerUpdate) careerUpdates.push(careerUpdate);
      processCompletedMatchInjuries(simulatedMatch);

      const recordCheck = trackMinorRecordsOnMatchComplete(simulatedMatch, nextMinorRecords, teams, currentSeason);
      if (recordCheck.brokenRecordNotices.length > 0) {
        nextMinorRecords = recordCheck.updatedRecords;
        allNotices.push(...recordCheck.brokenRecordNotices);
      }
    });

    if (matches.length > 0) {
      recordIplMatchStats(careerUpdates);
      let nextInbox = inbox;
      if (allNotices.length > 0) {
        setMinorRecords(nextMinorRecords);
        const newEmails = allNotices.map((notice, idx) => {
          const recordTitle = notice.split('"')[1] ?? "IPL Record";
          const emailId = `record_broken_${recordTitle.replace(/\s+/g, "_")}_${Date.now()}_${idx}`;
          return {
            id: emailId,
            templateId: "record_broken",
            dedupeKey: emailId,
            threadId: "records_announcement",
            daySequence: 99 + idx,
            sender: "IPL Stat Operations",
            subject: `🚨 RECORD BROKEN: ${recordTitle}`,
            preview: `The all-time record for "${recordTitle}" has been broken!`,
            body: `A historic moment in the IPL!

The all-time record for "${recordTitle}" has been broken.

${notice}

This record has been officially verified and added to the IPL Minor Records archive.`,
            category: "league" as const,
            priority: "normal" as const,
            date: currentDate,
            unread: true,
            requiresAction: false,
            actionCompleted: false,
            actions: [],
          };
        });
        nextInbox = [...newEmails, ...inbox];
        setInbox(nextInbox);
      }

      const nextStandings = calculateStandings(nextFixtures);
      nextFixtures = resolveKnockoutBracket(nextFixtures, nextStandings);
      fixturesRef.current = nextFixtures;
      playerStatsRef.current = nextPlayerStats;
      setFixtures(nextFixtures);
      setPlayerStats(nextPlayerStats);
      setStandings(nextStandings);
      saveCareerState({
        fixtures: nextFixtures,
        playerStats: nextPlayerStats,
        standings: nextStandings,
        minorRecords: nextMinorRecords,
        inbox: nextInbox,
      });
    }
    return { nextFixtures, nextPlayerStats, simulatedCount: matches.length };
  };

  const autoFixAndSimulatePendingMatch = () => {
    if (!pendingMatchPreparation) return;
    const squad = getSelectableTeamSquad(userTeamId);
    const selection = buildAutomaticLineupSelection(squad, {
      captainId: teamLeadership.captainId,
      viceCaptainId: teamLeadership.viceCaptainId,
      useProvisionalCaptain: !teamLeadership.captainId,
    });
    setBattingFirstXI(selection.battingFirstXI);
    setBowlingFirstXI(selection.bowlingFirstXI);
    setBattingFirstImpactSubs(selection.battingFirstImpactSubs);
    setBowlingFirstImpactSubs(selection.bowlingFirstImpactSubs);
    setBattingFirstImpactPlayerId(null);
    setBattingFirstOutgoingPlayerId(null);
    setBattingFirstImpactBattingPosition(null);
    setBowlingFirstImpactPlayerId(null);
    setBowlingFirstOutgoingPlayerId(null);
    setBowlingFirstImpactBattingPosition(null);
    saveCareerState({
      ...selection,
      battingFirstImpactPlayerId: null,
      battingFirstOutgoingPlayerId: null,
      battingFirstImpactBattingPosition: null,
      bowlingFirstImpactPlayerId: null,
      bowlingFirstOutgoingPlayerId: null,
      bowlingFirstImpactBattingPosition: null,
    });
    runFixtureSimulation(pendingMatchPreparation.matchId, selection);
  };

  const stopSimulating = useCallback(() => {
    dayTickerRef.current?.stop();
    skipStartDateRef.current = null;
    skipTargetDateRef.current = null;
    autoSimUserFixturesRef.current = false;
    setIsCalendarClosing(true);
    setIsSimulatingDays(false);
    if (calendarAnimationTimeoutRef.current) clearTimeout(calendarAnimationTimeoutRef.current);
    calendarAnimationTimeoutRef.current = setTimeout(() => {
      setIsCalendarClosing(false);
      calendarAnimationTimeoutRef.current = null;
    }, 430);
  }, []);

  const cancelCareerFastForward = useCallback((message = "Fast-forward stopped. Your career is safe at the last completed date.") => {
    stopSimulating();
    useGameStore.getState().setCareerFastForwardTarget(null);
    sessionStorage.removeItem(CAREER_FAST_FORWARD_RECOVERY_KEY);
    setPendingSkipTargetDate(null);
    showToast(message);
  }, [stopSimulating]);

  const rolloverToNextSeason = async () => {
    const liveState = useGameStore.getState();
    if (
      liveState.auction?.phase === "retention"
      && liveState.auction.season === liveState.currentSeason
    ) {
      stopSimulating();
      router.replace("/game/auction");
      return true;
    }
    if (isCareerCalendarAtImpasse(liveState.currentDate, fixturesRef.current)) {
      // Never enter postseason lifecycle work while matchday state is still
      // incomplete. This guard protects every rollover caller, including
      // restored fast-forwards and future UI controls, rather than relying on
      // each caller to remember the ordering requirement.
      autoSimUserFixturesRef.current = true;
      if (dayTickerRef.current?.start()) setIsSimulatingDays(true);
      showToast("Finishing overdue fixtures before opening retention...");
      return false;
    }
    if (seasonRolloverInProgressRef.current) return false;
    seasonRolloverInProgressRef.current = true;
    // Stop before doing any postseason work so a queued tick or a rapid second
    // click cannot enter the expensive rollover a second time.
    stopSimulating();

    try {
    // requestAnimationFrame can be throttled or suspended while Chrome is
    // under memory pressure, leaving the transition parked at the previous
    // diagnostic stage forever. A zero-delay task yields for painting without
    // depending on animation-frame scheduling.
    const yieldToBrowser = () => new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });
    setSeasonTransitionStage(`Transition 1/8 · Validating ${fixturesRef.current.length} season fixtures...`);
    await yieldToBrowser();
    const final = fixturesRef.current.find((fixture) => fixture.stage === "final" && fixture.played && fixture.winner);
    if (!final?.winner) {
      useGameStore.getState().setCareerFastForwardTarget(null);
      sessionStorage.removeItem(CAREER_FAST_FORWARD_RECOVERY_KEY);
      showToast("Cannot begin the offseason until the season final has a recorded winner.");
      seasonRolloverInProgressRef.current = false;
      setSeasonTransitionStage(null);
      return false;
    }
    const runnerUpTeamId = final.winner === final.teamA ? final.teamB : final.teamA;

    // Self-healing: Re-accumulate player stats from played fixtures if playerStatsRef is empty
    setSeasonTransitionStage(`Transition 2/8 · Checking saved statistics for ${Object.keys(playerStatsRef.current).length} players...`);
    await yieldToBrowser();
    let statsRecord = { ...playerStatsRef.current };
    if (Object.keys(statsRecord).length === 0) {
      setSeasonTransitionStage(`Transition 2/8 · Rebuilding statistics from ${fixturesRef.current.filter((fixture) => fixture.played).length} completed matches...`);
      await yieldToBrowser();
      (fixturesRef.current ?? []).forEach((match) => {
        if (match.played && match.simulation?.innings) {
          Object.values(match.simulation.lineups).forEach((lineup) => {
            const participants = new Set([...lineup.startingXI, ...lineup.finalXI]);
            participants.forEach((playerId) => {
              const player = players[playerId];
              if (!statsRecord[playerId]) {
                statsRecord[playerId] = {
                  id: playerId,
                  name: player?.name ?? playerId,
                  teamId: lineup.teamId,
                  runs: 0,
                  balls: 0,
                  wickets: 0,
                  runsConceded: 0,
                  oversBowled: 0,
                  matches: 0,
                  highestScore: 0,
                  bestBowling: "0/0",
                };
              }
              statsRecord[playerId].matches += 1;
            });
            if (lineup.captainId && participants.has(lineup.captainId)) {
              statsRecord[lineup.captainId].matchesCaptained = (statsRecord[lineup.captainId].matchesCaptained ?? 0) + 1;
            }
            if (lineup.viceCaptainId && lineup.viceCaptainId !== lineup.captainId && participants.has(lineup.viceCaptainId)) {
              statsRecord[lineup.viceCaptainId].matchesViceCaptained = (statsRecord[lineup.viceCaptainId].matchesViceCaptained ?? 0) + 1;
            }
          });
          match.simulation.innings.forEach((inn) => {
            (inn.batting ?? []).forEach((b) => {
              const pId = (b as any).playerId || b.name;
              if (!statsRecord[pId]) {
                statsRecord[pId] = {
                  id: pId,
                  name: b.name,
                  teamId: inn.battingTeamId,
                  runs: 0,
                  balls: 0,
                  wickets: 0,
                  runsConceded: 0,
                  oversBowled: 0,
                  matches: 0,
                  highestScore: 0,
                  bestBowling: "0/0",
                };
              }
              statsRecord[pId].runs += b.runs ?? 0;
              statsRecord[pId].balls += b.balls ?? 0;
            });
            (inn.bowling ?? []).forEach((bw) => {
              const pId = (bw as any).playerId || bw.name;
              if (!statsRecord[pId]) {
                statsRecord[pId] = {
                  id: pId,
                  name: bw.name,
                  teamId: inn.bowlingTeamId,
                  runs: 0,
                  balls: 0,
                  wickets: 0,
                  runsConceded: 0,
                  oversBowled: 0,
                  matches: 0,
                  highestScore: 0,
                  bestBowling: "0/0",
                };
              }
              statsRecord[pId].wickets += bw.wickets ?? 0;
              statsRecord[pId].runsConceded += bw.runsConceded ?? 0;
            });
          });
        }
      });
      playerStatsRef.current = statsRecord;
      setPlayerStats(statsRecord);
    }

    setSeasonTransitionStage(`Transition 3/8 · Ranking awards from ${Object.keys(statsRecord).length} player records...`);
    await yieldToBrowser();
    const allStatsList = Object.values(statsRecord).map((st) => ({
      ...st,
      teamId: teams[st.teamId] ? st.teamId : (players[st.id]?.currentTeamId ?? Object.keys(teams)[0] ?? "CSK"),
    }));

    const rankedBatters = [...allStatsList]
      .filter((stats) => stats.runs > 0)
      .sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name));
    const rankedBowlers = [...allStatsList]
      .filter((stats) => stats.wickets > 0)
      .sort((a, b) => b.wickets - a.wickets || a.name.localeCompare(b.name));

    // Fallback candidates if season statistics had zero entries
    const fallbackPlayer = Object.values(players)[0] ?? { name: "Player", currentTeamId: final.winner };
    const orangeCap = rankedBatters[0] ?? {
      name: allStatsList[0]?.name ?? fallbackPlayer.name,
      teamId: allStatsList[0]?.teamId ?? fallbackPlayer.currentTeamId ?? final.winner,
    };
    const purpleCap = rankedBowlers[0] ?? {
      name: allStatsList[0]?.name ?? fallbackPlayer.name,
      teamId: allStatsList[0]?.teamId ?? fallbackPlayer.currentTeamId ?? final.winner,
    };
    const seasonAwards = calculateSeasonAwardLeaders(
      statsRecord,
      players,
      currentSeason,
      simulatedLeagueHistory,
    );
    const mvpName = seasonAwards.mvp?.name ?? allStatsList[0]?.name ?? fallbackPlayer.name;
    const mvpTeamId = seasonAwards.mvp?.teamId
      ?? allStatsList[0]?.teamId
      ?? fallbackPlayer.currentTeamId
      ?? final.winner;

    const postseasonState = useGameStore.getState();
    setSeasonTransitionStage(`Transition 4/8 · Saving league-history summary for season ${currentSeason}...`);
    await yieldToBrowser();
    if (!postseasonState.simulatedLeagueHistory.some((season) => season.season === currentSeason)) {
      recordSimulatedLeagueSeason({
        season: currentSeason,
        championTeamId: final.winner,
        runnerUpTeamId,
        orangeCap: { name: orangeCap.name, teamId: orangeCap.teamId },
        purpleCap: { name: purpleCap.name, teamId: purpleCap.teamId },
        emergingPlayer: seasonAwards.emerging
          ? { name: seasonAwards.emerging.name, teamId: seasonAwards.emerging.teamId }
          : undefined,
        mvp: {
          name: mvpName,
          teamId: mvpTeamId,
        },
        source: "career",
        standings: standings.map((standing) => ({
          teamId: standing.teamId,
          teamName: standing.teamName,
          played: standing.played,
          won: standing.won,
          lost: standing.lost,
          noResults: standing.noResults,
          points: standing.points,
          nrr: standing.nrr,
        })),
      });
    }
    setSeasonTransitionStage(`Transition 5/8 · Preparing detailed postseason archive for season ${currentSeason}...`);
    await yieldToBrowser();
    if (postseasonState.lastCareerPostseasonSeason !== currentSeason) {
      await archiveCareerSeason({
        season: currentSeason,
        fixtures: fixturesForCareerHistory(fixturesRef.current),
        standings,
        playerStats: statsRecord,
        reputationAchievements: buildCareerReputationAchievements(fixturesRef.current, statsRecord, seasonAwards, players),
        leagueRecords: computeDynamicLeagueRecords(
          fixturesRef.current as any[],
          players,
          teams,
          careerSeasonArchives.find((archive) => archive.season < currentSeason)?.leagueRecords ?? OTHER_LEAGUE_RECORDS,
        ),
      }, setSeasonTransitionStage);
    }
    setSeasonTransitionStage(`Transition 6/8 · Preparing captaincy continuity for ${Object.keys(teams).length} teams...`);
    await yieldToBrowser();
    const captainIdsByTeam: Record<string, string | null> = {
      ...Object.fromEntries(Object.entries(aiTeamLeadership).map(([teamId, leadership]) => [
        teamId,
        leadership.captainId ?? teams[teamId]?.captainContinuityId ?? null,
      ])),
      [userTeamId]: teamLeadership.captainId ?? teams[userTeamId]?.captainContinuityId ?? null,
    };
    const viceCaptainIdsByTeam: Record<string, string | null> = {
      ...Object.fromEntries(Object.entries(aiTeamLeadership).map(([teamId, leadership]) => [
        teamId,
        leadership.viceCaptainId ?? teams[teamId]?.viceCaptainContinuityId ?? null,
      ])),
      [userTeamId]: teamLeadership.viceCaptainId ?? teams[userTeamId]?.viceCaptainContinuityId ?? null,
    };
    setSeasonTransitionStage(`Transition 7/8 · Building season ${currentSeason + 1} retention pool and lifecycle state...`);
    await yieldToBrowser();
    const advanced = await beginNextSeasonRetention(
      captainIdsByTeam,
      viceCaptainIdsByTeam,
      undefined,
      setSeasonTransitionStage,
    );
    if (!advanced) {
      seasonRolloverInProgressRef.current = false;
      setSeasonTransitionStage(null);
      return false;
    }
    setSeasonTransitionStage(`Transition 8/8 · Opening season ${currentSeason + 1} retention screen...`);
    await yieldToBrowser();
    // The completed totals are safely archived above; live totals now belong
    // to the new season and must start from zero.
    playerStatsRef.current = {};
    setPlayerStats({});
    const stateAfterRollover = useGameStore.getState();
    const persistedFastForwardTarget = stateAfterRollover.careerFastForwardTargetDate;
    // A target equal to the date we just reached is complete. Older code
    // treated that stale value as a multi-season request and synchronously ran
    // retention plus the whole auction, which could lock up the browser.
    const fastForwardTarget = isCareerFastForwardTargetPending(
      persistedFastForwardTarget,
      stateAfterRollover.currentDate,
    ) ? persistedFastForwardTarget : null;
    if (!fastForwardTarget && persistedFastForwardTarget) {
      useGameStore.getState().setCareerFastForwardTarget(null);
      sessionStorage.removeItem(CAREER_FAST_FORWARD_RECOVERY_KEY);
    }
    if (fastForwardTarget) {
      const auctionCompleted = await completeOffseasonAutomatically();
      if (!auctionCompleted) {
        useGameStore.getState().setCareerFastForwardTarget(null);
        sessionStorage.removeItem(CAREER_FAST_FORWARD_RECOVERY_KEY);
        stopSimulating();
        showToast("Automatic offseason simulation could not complete safely.");
        router.push("/game/auction");
        return false;
      }
      localStorage.setItem(`ipl_continued_to_season_${userTeamId}`, "true");
      localStorage.removeItem(`ipl_career_${userTeamId}`);
      stopSimulating();
      // The large Zustand save can be at the browser quota during an auction.
      // Carry the small target in both session storage and the reload URL so
      // automatic match simulation cannot silently become manual afterwards.
      sessionStorage.setItem(CAREER_FAST_FORWARD_RECOVERY_KEY, fastForwardTarget);
      window.location.assign(`/game/overview?tab=home&fastForwardTarget=${encodeURIComponent(fastForwardTarget)}`);
      return true;
    }
    localStorage.removeItem(`ipl_continued_to_season_${userTeamId}`);
    stopSimulating();
    router.push("/game/auction");
    return true;
    } catch (error) {
      seasonRolloverInProgressRef.current = false;
      setSeasonTransitionStage(null);
      useGameStore.getState().setCareerFastForwardTarget(null);
      sessionStorage.removeItem(CAREER_FAST_FORWARD_RECOVERY_KEY);
      stopSimulating();
      showToast(error instanceof Error ? error.message : "The offseason transition could not be completed safely.");
      return false;
    }
  };

  const advanceOneDay = () => {
    const currentDateString = useGameStore.getState().currentDate;
    const skipTargetDate = skipTargetDateRef.current;

    // Close fixtures only when the calendar is already on their date. A user
    // fixture has priority: no same-day AI result is generated until the user
    // has played or simulated their own match.
    const closingFixtureDate = fixturesRef.current
      .filter((match) => !match.played && Boolean(match.date && match.date <= currentDateString))
      .map((match) => match.date as string)
      .sort()[0];
    if (closingFixtureDate) {
      if (!FIXTURE_SIMULATION_ENABLED) {
        stopSimulating();
        useGameStore.getState().setCareerFastForwardTarget(null);
        sessionStorage.removeItem(CAREER_FAST_FORWARD_RECOVERY_KEY);
        showToast("Paused before the fixtures begin. Fixture simulation is not currently enabled.");
        return;
      }

      const userFixture = fixturesRef.current.find((match) => (
        !match.played
        && match.date === closingFixtureDate
        && (match.teamA === userTeamId || match.teamB === userTeamId)
      ));
      if (userFixture) {
        if (
          autoSimUserFixturesRef.current
          && skipTargetDate
          && closingFixtureDate <= skipTargetDate
        ) {
          try {
            const simulatedMatch = buildSimulatedMatch(userFixture, undefined, true);
            commitSimulatedMatch(
              simulatedMatch,
              fixturesRef.current,
              playerStatsRef.current,
            );
          } catch (error) {
            console.error("Unable to auto-simulate calendar fixture:", error);
            stopSimulating();
            useGameStore.getState().setCareerFastForwardTarget(null);
            sessionStorage.removeItem(CAREER_FAST_FORWARD_RECOVERY_KEY);
            showToast(error instanceof Error ? error.message : "Unable to auto-simulate your fixture.");
          }
          return;
        }
        stopSimulating();
        showToast("Paused at matchday. Choose Play fixture or Simulate fixture.");
        return;
      }

      // All user action for this date is complete, so the remaining league
      // fixtures can now be resolved as the day closes.
      simulateAiFixturesOnDate(closingFixtureDate);
    }

    const unplayedMatches = fixturesRef.current.filter((match) => !match.played);
    const {
      nextDate: nextDateString,
      blockedByFixture: fixtureBlocksProgress,
    } = skipTargetDate
      ? getCareerFastForwardStep(
        currentDateString,
        unplayedMatches,
        skipTargetDate,
        retentionDateString,
      )
      : getCareerCalendarStep(currentDateString, unplayedMatches);
    const isCatchingUpCurrentDate = nextDateString <= currentDateString;
    if (isCatchingUpCurrentDate) {
      processCalendarInjuries(nextDateString);
      processAITrades({
        date: nextDateString,
        finalDate: getSeasonFinalDate(),
        standingsTeamIds: standings.map((standing) => standing.teamId),
      });
    } else {
      let injuryDate = addDaysToDateKey(currentDateString, 1);
      while (injuryDate <= nextDateString) {
        processCalendarInjuries(injuryDate);
        // Fast-forward must run the same daily trade pass as manual calendar
        // progression; jumping directly to Retention Day previously skipped
        // every eligible post-final trade date.
        processAITrades({
          date: injuryDate,
          finalDate: getSeasonFinalDate(),
          standingsTeamIds: standings.map((standing) => standing.teamId),
        });
        injuryDate = addDaysToDateKey(injuryDate, 1);
      }
    }

    if (fixtureBlocksProgress) {
      // Defensive guard for malformed/overdue saves. Normal current-day
      // fixtures were closed above, and future fixtures never block arrival.
      stopSimulating();
      showToast("A fixture is still awaiting completion on the current date.");
      return;
    }

    // A requested calendar target wins over a coincident season boundary. This
    // lets "Skip to retention" land on Retention Day without opening the
    // retention screen as part of the skip itself.
    if (!isCatchingUpCurrentDate && skipTargetDate && nextDateString >= skipTargetDate) {
      useGameStore.setState({ currentDate: skipTargetDate });
      stopSimulating();
      showToast("Reached selected calendar date.");
      return;
    }

    // Milestones pause on the milestone date before another timer is queued.
    if (
      !isCatchingUpCurrentDate
      && retentionDateString
      && retentionDateString > currentDateString
      && nextDateString >= retentionDateString
    ) {
      rolloverToNextSeason();
      return;
    }

    if (!isCatchingUpCurrentDate && nextDateString === auctionDateString) {
      useGameStore.setState({ currentDate: nextDateString });
      stopSimulating();
      showToast("Paused: Player Auction today!");
      return;
    }

    if (!isCatchingUpCurrentDate) {
      // Enter the next date before any of its fixtures are resolved.
      useGameStore.setState({ currentDate: nextDateString });
      const arrivingUserFixture = fixturesRef.current.find((match) => (
        !match.played
        && match.date === nextDateString
        && (match.teamA === userTeamId || match.teamB === userTeamId)
      ));
      if (arrivingUserFixture && !autoSimUserFixturesRef.current) {
        stopSimulating();
        showToast("Paused at matchday. Choose Play fixture or Simulate fixture.");
      }
    }
  };

  useLayoutEffect(() => {
    advanceOneDayRef.current = advanceOneDay;
  });

  const startSimulating = useCallback(() => {
    const simulationDate = useGameStore.getState().currentDate;
    const followingDate = addDaysToDateKey(simulationDate, 1);
    const requestedTarget = skipTargetDateRef.current;

    if (isCareerCalendarAtImpasse(simulationDate, fixturesRef.current)) {
      const earliestOverdueDate = fixturesRef.current
        .filter((match) => !match.played && Boolean(match.date && match.date <= simulationDate))
        .map((match) => match.date as string)
        .sort()[0];
      if (!earliestOverdueDate) return;

      const unresolvedUserFixture = fixturesRef.current.find((match) => (
        !match.played
        && match.date === earliestOverdueDate
        && (match.teamA === userTeamId || match.teamB === userTeamId)
      ));
      if (unresolvedUserFixture && earliestOverdueDate < simulationDate) {
        // Repair careers whose date was incorrectly advanced past matchday by
        // the old rollover bug. These games were part of an automatic skip and
        // must not require the user to play months-old fixtures manually.
        try {
          const simulatedMatch = buildSimulatedMatch(unresolvedUserFixture, undefined, true);
          commitSimulatedMatch(simulatedMatch, fixturesRef.current, playerStatsRef.current);
          if (dayTickerRef.current?.start()) setIsSimulatingDays(true);
        } catch (error) {
          cancelCareerFastForward(
            error instanceof Error ? error.message : "Unable to repair the overdue fixture.",
          );
        }
      } else if (unresolvedUserFixture) {
        continueButtonRef.current?.focus();
        showToast("Choose Play fixture or Simulate fixture before continuing the calendar.");
      } else {
        simulateAiFixturesOnDate(earliestOverdueDate);
        if (dayTickerRef.current?.start()) {
          setIsSimulatingDays(true);
        }
      }
      return;
    }

    // Retention is a navigation boundary, but overdue fixtures must be
    // resolved first. The old ordering attempted rollover before this impasse
    // repair, so a final left unplayed on Retention Day made every Continue or
    // Skip-to-retention click repeat the same failed rollover forever.
    if (
      retentionDateString
      && (simulationDate >= retentionDateString || followingDate >= retentionDateString)
      && (!requestedTarget || requestedTarget > retentionDateString)
    ) {
      rolloverToNextSeason();
      return;
    }

    if (calendarAnimationTimeoutRef.current) {
      clearTimeout(calendarAnimationTimeoutRef.current);
      calendarAnimationTimeoutRef.current = null;
    }
    setIsCalendarClosing(false);
    if (dayTickerRef.current?.start()) {
      setIsSimulatingDays(true);
    }
  }, [cancelCareerFastForward, retentionDateString, router, userTeamId]);

  const skipToCalendarDate = useCallback((
    targetDate: string,
    autoSimUserFixtures = false,
  ) => {
    const simulationDate = useGameStore.getState().currentDate;
    if (targetDate <= simulationDate) return;
    skipStartDateRef.current = simulationDate;
    skipTargetDateRef.current = targetDate;
    autoSimUserFixturesRef.current = autoSimUserFixtures;
    setPendingSkipTargetDate(null);
    startSimulating();
  }, [startSimulating]);

  useEffect(() => {
    const startFastForward = (targetDate: string) => {
      if (targetDate <= useGameStore.getState().currentDate) return;
      sessionStorage.setItem(CAREER_FAST_FORWARD_RECOVERY_KEY, targetDate);
      setCareerFastForwardTarget(targetDate);
      skipToCalendarDate(targetDate, true);
    };
    const handler = (event: Event) => {
      const kind = (event as CustomEvent<{ kind: "season" | "retention" | "year" | "three-years" }>).detail?.kind;
      if (kind === "season") {
        const finalDate = fixturesRef.current
          .map((fixture) => fixture.date ?? "")
          .sort((left, right) => right.localeCompare(left))[0];
        if (finalDate) startFastForward(finalDate);
        return;
      }
      if (kind === "retention") {
        const liveState = useGameStore.getState();
        const liveDate = liveState.currentDate;
        // This command is an explicit stop boundary. Always discard any
        // older one-year/three-year target before rollover; otherwise the
        // rollover sees that future target and synchronously runs retention,
        // the full auction, and another season from this single click. That
        // workload grows with long careers and can freeze or crash the tab.
        liveState.setCareerFastForwardTarget(null);
        sessionStorage.removeItem(CAREER_FAST_FORWARD_RECOVERY_KEY);
        skipStartDateRef.current = null;
        skipTargetDateRef.current = null;
        autoSimUserFixturesRef.current = false;
        // Derive this from the active season instead of the hydrated deadline,
        // which can briefly still describe the season that has just finished.
        const retentionTarget = getSeasonDates(currentSeason + 1).retentionDate;
        if (retentionTarget <= liveDate) {
          // The saved deadline is stale: finish the overdue rollover now,
          // rather than refusing the request or jumping across a season
          // without running retention, trades, injuries, and offseason work.
          if (isCareerCalendarAtImpasse(liveDate, fixturesRef.current)) {
            // A skip can land on Retention Day before that day's final is
            // closed. Resume with automatic user-fixture resolution; once all
            // overdue fixtures are complete, startSimulating crosses the
            // retention boundary normally.
            autoSimUserFixturesRef.current = true;
            startSimulating();
          } else {
            rolloverToNextSeason();
          }
        } else {
          startFastForward(retentionTarget);
        }
        return;
      }
      const years = kind === "three-years" ? 3 : 1;
      const source = dateKeyToLocalDate(useGameStore.getState().currentDate);
      const targetYear = source.getFullYear() + years;
      const month = source.getMonth();
      const day = Math.min(source.getDate(), new Date(targetYear, month + 1, 0).getDate());
      startFastForward(`${targetYear}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    };
    window.addEventListener("ipl-career-fast-forward", handler);
    return () => window.removeEventListener("ipl-career-fast-forward", handler);
  }, [currentSeason, retentionDateString, rolloverToNextSeason, setCareerFastForwardTarget, showToast, skipToCalendarDate, startSimulating]);

  // Restore an in-progress multi-season job only after initCareer has created
  // the new season's fixtures. This prevents an empty fixture list from making
  // the calendar jump directly past every match.
  useEffect(() => {
    if (!isCareerLoaded || fixturesRef.current.length < TOTAL_FIXTURE_COUNT) return;
    const recoveryTarget = searchParams.get("fastForwardTarget")
      ?? sessionStorage.getItem(CAREER_FAST_FORWARD_RECOVERY_KEY);
    if (!recoveryTarget) return;
    const liveDate = useGameStore.getState().currentDate;
    if (recoveryTarget <= liveDate) {
      sessionStorage.removeItem(CAREER_FAST_FORWARD_RECOVERY_KEY);
      return;
    }
    if (useGameStore.getState().careerFastForwardTargetDate !== recoveryTarget) {
      setCareerFastForwardTarget(recoveryTarget);
    }
    if (!dayTickerRef.current?.isRunning()) {
      skipToCalendarDate(recoveryTarget, true);
    }
  }, [fixtures.length, isCareerLoaded, searchParams, setCareerFastForwardTarget, skipToCalendarDate]);

  useEffect(() => {
    if (
      !isCareerLoaded
      || !careerFastForwardTargetDate
      || fixturesRef.current.length < TOTAL_FIXTURE_COUNT
    ) return;
    if (currentDate >= careerFastForwardTargetDate) {
      setCareerFastForwardTarget(null);
      sessionStorage.removeItem(CAREER_FAST_FORWARD_RECOVERY_KEY);
      stopSimulating();
      showToast("Career fast-forward complete.");
      return;
    }
    if (!dayTickerRef.current?.isRunning()) skipToCalendarDate(careerFastForwardTargetDate, true);
  }, [careerFastForwardTargetDate, currentDate, fixtures.length, isCareerLoaded, setCareerFastForwardTarget, skipToCalendarDate, stopSimulating]);

  // A season rollover reloads the page. If hydration or a long synchronous
  // match calculation leaves the ticker stopped, resume the persisted job
  // without requiring the user to press the button again.
  useEffect(() => {
    if (
      !isCareerLoaded
      || !careerFastForwardTargetDate
      || fixturesRef.current.length < TOTAL_FIXTURE_COUNT
    ) return;
    const watchdogId = window.setInterval(() => {
      const liveDate = useGameStore.getState().currentDate;
      if (
        liveDate < careerFastForwardTargetDate
        && !dayTickerRef.current?.isRunning()
      ) {
        skipToCalendarDate(careerFastForwardTargetDate, true);
      }
    }, 1000);
    return () => window.clearInterval(watchdogId);
  }, [careerFastForwardTargetDate, fixtures.length, isCareerLoaded, skipToCalendarDate]);

  const countUserFixturesBeforeCalendarDate = (targetDate: string) => {
    const simulationDate = useGameStore.getState().currentDate;
    return fixturesRef.current.filter((match) => (
      !match.played
      && Boolean(match.date)
      && (match.date ?? "") > simulationDate
      && (match.date ?? "") <= targetDate
      && (match.teamA === userTeamId || match.teamB === userTeamId)
    )).length;
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape"
        || (!dayTickerRef.current?.isRunning() && !useGameStore.getState().careerFastForwardTargetDate)
      ) return;
      event.preventDefault();
      cancelCareerFastForward();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelCareerFastForward]);

  // Calculate league standings from actual group-stage results and scorecards.
  const calculateStandings = (allMatches: Match[]): LeagueStandings[] => {
    const records: Record<string, LeagueStandings> = {};
    const runTotals: Record<string, { scored: number; facedBalls: number; conceded: number; bowledBalls: number }> = {};
    const getTeamTieBreakValue = (teamId: string) => {
      const str = `${currentSeason}:${fixtureSeed}:${teamId}`;
      let hash = 2166136261;
      for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0) / 4294967296;
    };
    const randomTieBreak = new Map(Object.keys(teams).map(teamId => [teamId, getTeamTieBreakValue(teamId)]));

    const oversToBalls = (overs: number | undefined) => {
      if (overs === undefined || overs < 0) return 0;
      const completeOvers = Math.floor(overs);
      const balls = Math.round((overs - completeOvers) * 10);
      return completeOvers * 6 + Math.min(Math.max(balls, 0), 5);
    };

    const wicketsFromScorecard = (match: Match, bowlingTeamId: string) => {
      if (!match.scorecard) return undefined;
      const bowling = bowlingTeamId === match.teamA
        ? match.scorecard.inningsB.bowling
        : match.scorecard.inningsA.bowling;
      return bowling.reduce((total, bowler) => total + (bowler.wickets ?? 0), 0);
    };
    
    // Init records
    Object.values(teams).forEach(t => {
      records[t.id] = {
        teamId: t.id,
        teamName: t.name,
        shortName: t.shortName,
        played: 0,
        won: 0,
        lost: 0,
        noResults: 0,
        points: 0,
        nrr: 0.0,
        wicketsTaken: 0
      };
      runTotals[t.id] = { scored: 0, facedBalls: 0, conceded: 0, bowledBalls: 0 };
    });

    allMatches.filter(m => m.played && !m.stage).forEach(m => {
      const recA = records[m.teamA];
      const recB = records[m.teamB];
      if (!recA || !recB) return;

      recA.played++;
      recB.played++;

      if (m.winner === m.teamA) {
        recA.won++;
        recA.points += 2;
        recB.lost++;
      } else if (m.winner === m.teamB) {
        recB.won++;
        recB.points += 2;
        recA.lost++;
      } else {
        recA.noResults++;
        recB.noResults++;
        recA.points++;
        recB.points++;
      }

      if (m.scoreA && m.scoreB) {
        // An all-out innings counts as the full 20 overs for NRR purposes.
        const ballsA = m.scoreA.wickets >= 10 ? 120 : oversToBalls(m.scoreA.overs);
        const ballsB = m.scoreB.wickets >= 10 ? 120 : oversToBalls(m.scoreB.overs);
        runTotals[m.teamA].scored += m.scoreA.runs;
        runTotals[m.teamA].facedBalls += ballsA;
        runTotals[m.teamA].conceded += m.scoreB.runs;
        runTotals[m.teamA].bowledBalls += ballsB;
        runTotals[m.teamB].scored += m.scoreB.runs;
        runTotals[m.teamB].facedBalls += ballsB;
        runTotals[m.teamB].conceded += m.scoreA.runs;
        runTotals[m.teamB].bowledBalls += ballsA;
        recA.wicketsTaken += wicketsFromScorecard(m, m.teamA) ?? m.scoreB.wickets;
        recB.wicketsTaken += wicketsFromScorecard(m, m.teamB) ?? m.scoreA.wickets;
      }
    });

    Object.values(records).forEach(rec => {
      const totals = runTotals[rec.teamId];
      if (totals.facedBalls > 0 && totals.bowledBalls > 0) {
        rec.nrr = parseFloat(((totals.scored / (totals.facedBalls / 6)) - (totals.conceded / (totals.bowledBalls / 6))).toFixed(3));
      }
    });

    const headToHeadPoints = (teamId: string, opponentId: string) => allMatches
      .filter(match => match.played && match.round <= 14 &&
        ((match.teamA === teamId && match.teamB === opponentId) || (match.teamA === opponentId && match.teamB === teamId)))
      .reduce((points, match) => points + (match.winner === teamId ? 2 : 0), 0);

    return Object.values(records).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.nrr !== a.nrr) return b.nrr - a.nrr;
      const headToHeadDifference = headToHeadPoints(b.teamId, a.teamId) - headToHeadPoints(a.teamId, b.teamId);
      if (headToHeadDifference !== 0) return headToHeadDifference;
      if (b.wicketsTaken !== a.wicketsTaken) return b.wicketsTaken - a.wicketsTaken;
      return (randomTieBreak.get(a.teamId) ?? 0) - (randomTieBreak.get(b.teamId) ?? 0);
    });
  };

  // Accumulate simulated match scorecard stats into players career stats
  const accumulateStats = (
    scorecard: MatchScorecard,
    teamA: string,
    teamB: string,
    newStats: Record<string, PlayerStats>,
    simulation?: MatchSimulationRecord,
  ) => {
    const addBatting = (bat: ScorecardPlayer, teamId: string) => {
      if (!newStats[bat.id]) {
        newStats[bat.id] = {
          id: bat.id,
          name: bat.name,
          teamId,
          runs: 0,
          balls: 0,
          wickets: 0,
          runsConceded: 0,
          oversBowled: 0,
          matches: 0,
          highestScore: 0,
          bestBowling: "0/0"
        };
      }
      const pStat = newStats[bat.id];
      if (!simulation) pStat.matches++;
      pStat.runs += bat.runs ?? 0;
      pStat.balls += bat.balls ?? 0;
      pStat.battingPerformanceBonus = (pStat.battingPerformanceBonus ?? 0)
        + calculateBattingPerformanceBonus(bat.runs ?? 0);
      if (!simulation) {
        pStat.fours = (pStat.fours ?? 0) + (bat.fours ?? 0);
        pStat.sixes = (pStat.sixes ?? 0) + (bat.sixes ?? 0);
      }
      if (bat.dismissal && bat.dismissal !== "not out" && bat.dismissal !== "did not bat") {
        pStat.dismissals = (pStat.dismissals ?? 0) + 1;
      }
      if ((bat.runs ?? 0) > pStat.highestScore) {
        pStat.highestScore = bat.runs ?? 0;
      }
    };

    const addBowling = (bowl: ScorecardPlayer, teamId: string) => {
      if (!newStats[bowl.id]) {
        newStats[bowl.id] = {
          id: bowl.id,
          name: bowl.name,
          teamId,
          runs: 0,
          balls: 0,
          wickets: 0,
          runsConceded: 0,
          oversBowled: 0,
          matches: 0,
          highestScore: 0,
          bestBowling: "0/0"
        };
      }
      const pStat = newStats[bowl.id];
      pStat.wickets += bowl.wickets ?? 0;
      pStat.bowlingPerformanceBonus = (pStat.bowlingPerformanceBonus ?? 0)
        + calculateBowlingPerformanceBonus(
          bowl.wickets ?? 0,
          bowl.overs ?? 0,
          bowl.runsConceded ?? 0,
          bowl.maidens ?? 0,
        );
      pStat.maidens = (pStat.maidens ?? 0) + (bowl.maidens ?? 0);
      pStat.runsConceded += bowl.runsConceded ?? 0;
      const oversToLegalBalls = (overs: number) => (
        Math.floor(overs) * 6 + Math.round((overs - Math.floor(overs)) * 10)
      );
      pStat.oversBowled = oversFromBalls(
        oversToLegalBalls(pStat.oversBowled)
        + oversToLegalBalls(bowl.overs ?? 0),
      );

      const currentBestWkts = parseInt(pStat.bestBowling.split("/")[0]) || 0;
      const currentBestRuns = parseInt(pStat.bestBowling.split("/")[1]) || 999;
      const newWkts = bowl.wickets ?? 0;
      const newRuns = bowl.runsConceded ?? 0;
      
      if (newWkts > currentBestWkts || (newWkts === currentBestWkts && newRuns < currentBestRuns)) {
        pStat.bestBowling = `${newWkts}/${newRuns}`;
      }
    };

    // Innings A is teamA batting, teamB bowling
    scorecard.inningsA.batting.forEach(b => addBatting(b, teamA));
    scorecard.inningsA.bowling.forEach(b => addBowling(b, teamB));

    // Innings B is teamB batting, teamA bowling
    scorecard.inningsB.batting.forEach(b => addBatting(b, teamB));
    scorecard.inningsB.bowling.forEach(b => addBowling(b, teamA));

    if (simulation) {
      Object.values(simulation.lineups).forEach((lineup) => {
        const participants = new Set([...lineup.startingXI, ...lineup.finalXI]);
        participants.forEach((playerId) => {
          const player = players[playerId];
          if (!player) return;
          if (!newStats[playerId]) {
            newStats[playerId] = {
              id: playerId,
              name: player.name,
              teamId: lineup.teamId,
              runs: 0,
              balls: 0,
              wickets: 0,
              runsConceded: 0,
              oversBowled: 0,
              matches: 0,
              highestScore: 0,
              bestBowling: "0/0",
            };
          }
          newStats[playerId].matches++;
        });
        if (lineup.captainId && participants.has(lineup.captainId)) {
          newStats[lineup.captainId].matchesCaptained = (newStats[lineup.captainId].matchesCaptained ?? 0) + 1;
        }
        if (lineup.viceCaptainId && lineup.viceCaptainId !== lineup.captainId && participants.has(lineup.viceCaptainId)) {
          newStats[lineup.viceCaptainId].matchesViceCaptained = (newStats[lineup.viceCaptainId].matchesViceCaptained ?? 0) + 1;
        }
      });

      const exactMvpEvents = extractMvpEventStats(simulation);
      Object.entries(exactMvpEvents).forEach(([playerId, events]) => {
        const player = players[playerId];
        if (!newStats[playerId] && player) {
          const lineup = Object.values(simulation.lineups).find((entry) => (
            entry.startingXI.includes(playerId) || entry.finalXI.includes(playerId)
          ));
          newStats[playerId] = {
            id: playerId,
            name: player.name,
            teamId: lineup?.teamId ?? player.currentTeamId ?? "",
            runs: 0,
            balls: 0,
            wickets: 0,
            runsConceded: 0,
            oversBowled: 0,
            matches: 0,
            highestScore: 0,
            bestBowling: "0/0",
          };
        }
        const stats = newStats[playerId];
        if (!stats) return;
        stats.fours = (stats.fours ?? 0) + events.fours;
        stats.sixes = (stats.sixes ?? 0) + events.sixes;
        stats.dotBalls = (stats.dotBalls ?? 0) + events.dotBalls;
        stats.catches = (stats.catches ?? 0) + events.catches;
        stats.stumpings = (stats.stumpings ?? 0) + events.stumpings;
        stats.runOuts = (stats.runOuts ?? 0) + events.runOuts;
      });
    }
  };



  // --------------------------------------------------------------------------
  // Roster details selection helper
  // --------------------------------------------------------------------------
  const [detailedPlayerId, setDetailedPlayerId] = useState<string | null>(null);
  const [rosterView, setRosterView] = useState<RosterView>("general");
  const [rosterSort, setRosterSort] = useState<{ key: RosterSortKey; direction: SortDirection }>({
    key: "name",
    direction: "asc",
  });
  const detailedPlayer = detailedPlayerId ? players[detailedPlayerId] : null;
  const rosterSeason = String(auction?.season ?? currentSeason);
  const currentSeasonHistoryByPlayer = useMemo(() => {
    const historyByPlayer = new Map<string, IPLHistoryEntry>();

    Object.values(players).forEach((player) => {
      const entry = getPlayerSeasonHistory(player.iplHistory, rosterSeason);
      if (entry && entry.teamId !== "UNSOLD" && entry.price > 0) {
        historyByPlayer.set(player.id, entry);
      }
    });

    (auction?.saleHistory ?? []).forEach((sale) => {
      historyByPlayer.set(sale.playerId, {
        teamId: sale.teamId,
        season: rosterSeason,
        price: sale.price,
        isRtm: wasPlayerAcquiredViaRtm(sale),
      });
    });

    return historyByPlayer;
  }, [auction?.saleHistory, players, rosterSeason]);
  const detailedPlayerHistory = detailedPlayer
    ? (() => {
        const mergedHistory = mergePlayerIplHistory([], detailedPlayer.iplHistory);
        const currentEntry = currentSeasonHistoryByPlayer.get(detailedPlayer.id);
        return currentEntry ? upsertPlayerIplHistory(mergedHistory, currentEntry) : mergedHistory;
      })()
    : [];
  const sortedRosterPlayers = useMemo(() => {
    const rosterPlayers = (userTeam?.squad ?? []).map((id) => players[id]).filter((player): player is Player => Boolean(player));
    const directionMultiplier = rosterSort.direction === "asc" ? 1 : -1;

    return rosterPlayers.sort((left, right) => {
      let comparison = 0;
      const leftSeason = playerStats[left.id];
      const rightSeason = playerStats[right.id];
      const numericValue = (player: Player, stats: PlayerStats | undefined, key: RosterSortKey) => {
        if (key === "age") return player.age;
        if (key === "rating") return getPlayerRating(player);
        if (key === "potential") return Math.max(player.potentialBatting, player.potentialBowling);
        if (key === "bowlingCA") return player.currentBowling;
        if (key === "bowlingPA") return player.potentialBowling;
        if (key === "battingCA") return player.currentBatting;
        if (key === "battingPA") return player.potentialBatting;
        if (key === "seasonMatches") return stats?.matches ?? 0;
        if (key === "seasonWickets") return stats?.wickets ?? 0;
        if (key === "seasonBowlingAverage") return stats?.wickets ? stats.runsConceded / stats.wickets : Number.POSITIVE_INFINITY;
        if (key === "seasonEconomy") {
          const legalBalls = stats?.oversBowled
            ? Math.floor(stats.oversBowled) * 6 + Math.round((stats.oversBowled - Math.floor(stats.oversBowled)) * 10)
            : 0;
          return legalBalls ? stats!.runsConceded / (legalBalls / 6) : Number.POSITIVE_INFINITY;
        }
        if (key === "seasonBestBowling") return Number(stats?.bestBowling?.split("/")[0] ?? 0) * 1000 - Number(stats?.bestBowling?.split("/")[1] ?? 999);
        if (key === "seasonRuns") return stats?.runs ?? 0;
        if (key === "seasonBattingAverage") {
          const dismissals = stats?.dismissals ?? stats?.matches ?? 0;
          return dismissals ? (stats?.runs ?? 0) / dismissals : stats?.runs ?? 0;
        }
        if (key === "seasonStrikeRate") return stats?.balls ? (stats.runs / stats.balls) * 100 : 0;
        if (key === "seasonHighScore") return stats?.highestScore ?? 0;
        if (key === "iplMatches") return player.iplStats?.matches ?? 0;
        if (key === "iplRuns") return player.iplStats?.runs ?? 0;
        if (key === "iplBattingAverage") return player.iplStats?.battingAverage ?? 0;
        if (key === "iplStrikeRate") return player.iplStats?.strikeRate ?? 0;
        if (key === "iplWickets") return player.iplStats?.wickets ?? 0;
        if (key === "iplBowlingAverage") return player.iplStats?.bowlingAverage || Number.POSITIVE_INFINITY;
        return 0;
      };
      if (rosterSort.key === "name") comparison = left.name.localeCompare(right.name);
      if (rosterSort.key === "role") comparison = left.role.localeCompare(right.role);
      if (rosterSort.key === "nationality") comparison = left.nationality.localeCompare(right.nationality);
      if (rosterSort.key === "salary") {
        comparison = (currentSeasonHistoryByPlayer.get(left.id)?.price ?? -1)
          - (currentSeasonHistoryByPlayer.get(right.id)?.price ?? -1);
      } else if (!(["name", "role", "nationality"] as RosterSortKey[]).includes(rosterSort.key)) {
        comparison = numericValue(left, leftSeason, rosterSort.key) - numericValue(right, rightSeason, rosterSort.key);
      }

      return comparison === 0
        ? left.name.localeCompare(right.name)
        : comparison * directionMultiplier;
    });
  }, [currentSeasonHistoryByPlayer, playerStats, players, rosterSort, userTeam?.squad]);

  const toggleRosterSort = (key: RosterSortKey) => {
    setRosterSort((current) => ({
      key,
      direction: current.key === key
        ? current.direction === "asc" ? "desc" : "asc"
        : key === "name" || key === "role" || key === "nationality" || key === "age" ? "asc" : "desc",
    }));
  };

  const rosterSortIndicator = (key: RosterSortKey) =>
    rosterSort.key === key ? (rosterSort.direction === "asc" ? "↑" : "↓") : "↕";

  const renderRosterPlayerName = (player: Player) => (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate">{player.name}</span>
      <InjuryStatusMarker injury={activeInjuries[player.id]} />
    </span>
  );

  const rosterColumns: Array<{
    key: RosterSortKey; label: string; align?: "left" | "center" | "right";
    render: (player: Player) => React.ReactNode;
  }> = (() => {
    const season = (player: Player) => playerStats[player.id];
    const number = (value: number | undefined, digits = 0) => value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(digits);
    if (rosterView === "general") return [
      { key: "name", label: "Name", render: renderRosterPlayerName },
      { key: "age", label: "Age", align: "center", render: (player) => player.age },
      { key: "role", label: "Role", render: (player) => player.role },
      { key: "nationality", label: "Nationality", render: (player) => player.nationality },
      { key: "rating", label: "CA", align: "center", render: (player) => getPlayerRating(player) },
      { key: "potential", label: "PA", align: "center", render: (player) => Math.max(player.potentialBatting, player.potentialBowling) },
      { key: "salary", label: `${rosterSeason} Salary`, align: "right", render: (player) => {
        const entry = currentSeasonHistoryByPlayer.get(player.id); return entry ? formatPrice(entry.price) : "—";
      } },
    ];
    if (rosterView === "bowling") return [
      { key: "name", label: "Name", render: renderRosterPlayerName },
      { key: "bowlingCA", label: "Bowl CA", align: "center", render: (player) => player.currentBowling },
      { key: "bowlingPA", label: "Bowl PA", align: "center", render: (player) => player.potentialBowling },
      { key: "seasonMatches", label: "Mat", align: "center", render: (player) => season(player)?.matches ?? 0 },
      { key: "seasonWickets", label: "Wkts", align: "center", render: (player) => season(player)?.wickets ?? 0 },
      { key: "seasonBowlingAverage", label: "Avg", align: "center", render: (player) => { const stats = season(player); return stats?.wickets ? number(stats.runsConceded / stats.wickets, 2) : "—"; } },
      { key: "seasonEconomy", label: "Econ", align: "center", render: (player) => { const stats = season(player); const balls = stats?.oversBowled ? Math.floor(stats.oversBowled) * 6 + Math.round((stats.oversBowled - Math.floor(stats.oversBowled)) * 10) : 0; return stats && balls ? number(stats.runsConceded / (balls / 6), 2) : "—"; } },
      { key: "seasonBestBowling", label: "Best", align: "center", render: (player) => season(player)?.bestBowling ?? "—" },
    ];
    if (rosterView === "batting") return [
      { key: "name", label: "Name", render: renderRosterPlayerName },
      { key: "battingCA", label: "Bat CA", align: "center", render: (player) => player.currentBatting },
      { key: "battingPA", label: "Bat PA", align: "center", render: (player) => player.potentialBatting },
      { key: "seasonMatches", label: "Mat", align: "center", render: (player) => season(player)?.matches ?? 0 },
      { key: "seasonRuns", label: "Runs", align: "center", render: (player) => season(player)?.runs ?? 0 },
      { key: "seasonBattingAverage", label: "Avg", align: "center", render: (player) => { const stats = season(player); const outs = stats?.dismissals ?? stats?.matches ?? 0; return stats && outs ? number(stats.runs / outs, 2) : stats?.runs ? number(stats.runs, 2) : "—"; } },
      { key: "seasonStrikeRate", label: "SR", align: "center", render: (player) => { const stats = season(player); return stats?.balls ? number((stats.runs / stats.balls) * 100, 2) : "—"; } },
      { key: "seasonHighScore", label: "HS", align: "center", render: (player) => season(player)?.highestScore ?? "—" },
    ];
    return [
      { key: "name", label: "Name", render: renderRosterPlayerName },
      { key: "iplMatches", label: "Matches", align: "center", render: (player) => player.iplStats?.matches ?? 0 },
      { key: "iplRuns", label: "Runs", align: "center", render: (player) => player.iplStats?.runs ?? 0 },
      { key: "iplBattingAverage", label: "Bat Avg", align: "center", render: (player) => number(player.iplStats?.battingAverage, 1) },
      { key: "iplStrikeRate", label: "SR", align: "center", render: (player) => number(player.iplStats?.strikeRate, 1) },
      { key: "iplWickets", label: "Wkts", align: "center", render: (player) => player.iplStats?.wickets ?? 0 },
      { key: "iplBowlingAverage", label: "Bowl Avg", align: "center", render: (player) => player.iplStats?.wickets ? number(player.iplStats?.bowlingAverage, 1) : "—" },
    ];
  })();

  const handleMatchPlanChange = (plan: LineupPlan, lineup: string[], impactSubs: string[]) => {
    if (plan === "bowlingFirst") {
      const hasWicketkeeper = lineup.some((playerId) => {
        const player = players[playerId];
        return Boolean(player && (
          player.role === "WK-Batsman"
          || player.isWicketkeeper
          || player.isPartTimeWk
        ));
      });
      if (!hasWicketkeeper) {
        showToast("Bowl-first XI must include a wicketkeeper.");
        return;
      }
    }
    if (plan === "battingFirst") {
      setBattingFirstXI(lineup);
      setBattingFirstImpactSubs(impactSubs);
      saveCareerState({ battingFirstXI: lineup, battingFirstImpactSubs: impactSubs });
    } else {
      setBowlingFirstXI(lineup);
      setBowlingFirstImpactSubs(impactSubs);
      saveCareerState({ bowlingFirstXI: lineup, bowlingFirstImpactSubs: impactSubs });
    }
  };

  const handleBothMatchPlansChange = (
    nextBattingFirstXI: string[],
    nextBowlingFirstXI: string[],
    nextBattingFirstImpactSubs: string[],
    nextBowlingFirstImpactSubs: string[],
    impactStrategy: Pick<AutomaticLineupSelection,
      | "battingFirstImpactPlayerId"
      | "battingFirstOutgoingPlayerId"
      | "battingFirstImpactBattingPosition"
      | "bowlingFirstImpactPlayerId"
      | "bowlingFirstOutgoingPlayerId"
      | "bowlingFirstImpactBattingPosition"
    >,
  ) => {
    const hasWicketkeeper = nextBowlingFirstXI.some((playerId) => {
      const player = players[playerId];
      return Boolean(player && (
        player.role === "WK-Batsman"
        || player.isWicketkeeper
        || player.isPartTimeWk
      ));
    });
    if (!hasWicketkeeper) {
      showToast("Bowl-first XI must include a wicketkeeper.");
      return;
    }
    setBattingFirstXI(nextBattingFirstXI);
    setBowlingFirstXI(nextBowlingFirstXI);
    setBattingFirstImpactSubs(nextBattingFirstImpactSubs);
    setBowlingFirstImpactSubs(nextBowlingFirstImpactSubs);
    setBattingFirstImpactPlayerId(impactStrategy.battingFirstImpactPlayerId);
    setBattingFirstOutgoingPlayerId(impactStrategy.battingFirstOutgoingPlayerId);
    setBattingFirstImpactBattingPosition(impactStrategy.battingFirstImpactBattingPosition);
    setBowlingFirstImpactPlayerId(impactStrategy.bowlingFirstImpactPlayerId);
    setBowlingFirstOutgoingPlayerId(impactStrategy.bowlingFirstOutgoingPlayerId);
    setBowlingFirstImpactBattingPosition(impactStrategy.bowlingFirstImpactBattingPosition);
    saveCareerState({
      battingFirstXI: nextBattingFirstXI,
      bowlingFirstXI: nextBowlingFirstXI,
      battingFirstImpactSubs: nextBattingFirstImpactSubs,
      bowlingFirstImpactSubs: nextBowlingFirstImpactSubs,
      ...impactStrategy,
    });
    showToast("Both match plans have been rebuilt.");
  };

  const handleTacticsChange = (nextTactics: TeamTactics) => {
    setTeamTactics(nextTactics);
    saveCareerState({ teamTactics: nextTactics });
  };

  const handleImpactStrategyChange = (
    plan: LineupPlan,
    impactPlayerId: string | null,
    outgoingPlayerId: string | null,
    entryPosition: number | null,
  ) => {
    let persistedImpactPlayerId = impactPlayerId;
    if (plan === "battingFirst" && persistedImpactPlayerId === null) {
      const impactCandidates = battingFirstImpactSubs
        .map((id) => players[id])
        .filter((player): player is Player => Boolean(player));
      const impactBowler = selectBattingFirstImpactBowler(impactCandidates);
      persistedImpactPlayerId = impactBowler?.id ?? null;
    }

    const persistedOutgoingPlayerId = outgoingPlayerId;
    let persistedEntryPosition = entryPosition;
    if (plan === "bowlingFirst" && persistedEntryPosition === null) {
      const starters = bowlingFirstXI
        .map((id) => players[id])
        .filter((player): player is Player => Boolean(player));
      const impact = (impactPlayerId && players[impactPlayerId])
        ?? bowlingFirstImpactSubs
          .map((id) => players[id])
          .filter((player): player is Player => Boolean(player))
          .sort((left, right) => (right.currentBatting ?? 0) - (left.currentBatting ?? 0))[0];
      const outgoing = (outgoingPlayerId && players[outgoingPlayerId]) ?? starters[starters.length - 1];
      if (impact && outgoing && starters.length > 0) {
        persistedEntryPosition = findOptimalImpactBattingPosition(starters, impact, outgoing, true);
      }
    }
    if (plan === "battingFirst") {
      setBattingFirstImpactPlayerId(persistedImpactPlayerId);
      setBattingFirstOutgoingPlayerId(persistedOutgoingPlayerId);
      setBattingFirstImpactBattingPosition(entryPosition);
      saveCareerState({
        battingFirstImpactPlayerId: persistedImpactPlayerId,
        battingFirstOutgoingPlayerId: persistedOutgoingPlayerId,
        battingFirstImpactBattingPosition: entryPosition,
      });
    } else {
      setBowlingFirstImpactPlayerId(impactPlayerId);
      setBowlingFirstOutgoingPlayerId(outgoingPlayerId);
      setBowlingFirstImpactBattingPosition(persistedEntryPosition);
      saveCareerState({
        bowlingFirstImpactPlayerId: impactPlayerId,
        bowlingFirstOutgoingPlayerId: outgoingPlayerId,
        bowlingFirstImpactBattingPosition: persistedEntryPosition,
      });
    }
  };

  const handleLeadershipChange = (nextLeadership: TeamLeadership) => {
    const squad = (userTeam?.squad ?? [])
      .map((id) => players[id])
      .filter((player): player is Player => Boolean(player));
    const normalizedLeadership = normalizeTeamLeadership(nextLeadership, squad, userGamesPlayed, currentSeason);
    setTeamLeadership(normalizedLeadership);
    saveCareerState({ teamLeadership: normalizedLeadership });

    const currentTeams = useGameStore.getState().teams;
    if (userTeamId && currentTeams[userTeamId]) {
      useGameStore.setState({
        teams: {
          ...currentTeams,
          [userTeamId]: {
            ...currentTeams[userTeamId],
            captainContinuityId: normalizedLeadership.captainId,
            viceCaptainContinuityId: normalizedLeadership.viceCaptainId,
          },
        },
      });
    }
  };

  // --------------------------------------------------------------------------
  // Navigation mapping
  // --------------------------------------------------------------------------
  const mainTabConfig = {
    home: {
      label: "Home",
      icon: InboxIcon,
      subtabs: ["overview", "inbox", "social", "news", "calendar"]
    },
    squad: {
      label: "Squad",
      icon: Users,
      subtabs: ["overview", "roster", "analysis", "playingxi", "captaincy", "tactics", "injuryhub"]
    },
    club: {
      label: "Club",
      icon: ShieldCheck,
      subtabs: ["overview", "supporters", "board", "office", "staffmanagement", "pitchcurator", "stadiummanagement"]
    },
    scouting: {
      label: "Scouting",
      icon: Search,
      subtabs: ["overview", "assignments", "search", "planner"]
    },
    season: {
      label: "Season",
      icon: Trophy,
      subtabs: ["overview", "fixtures", "standings", "stats"]
    },
    league: {
      label: "League",
      icon: Table,
      subtabs: ["overview", "staff", "trades", "injuries", "seasonanalysis", "minorrecords"]
    },
    history: {
      label: "History",
      icon: HistoryIcon,
      subtabs: ["overview", "records", "clubhistory", "clubfigures", "leaguehistory", "leaguehalloffame"]
    }
  };

  // Format tab label for rendering
  const getSubTabLabel = (subtab: string): string => {
    if (subtab === "overview") return "Overview";
    if (subtab === "board") return "Board & Ownership";
    if (subtab === "supporters") return "Supporters";
    if (subtab === "roster") return "Roster Overview";
    if (subtab === "analysis") return "Squad Analysis";
    if (subtab === "playingxi") return "Playing XIs";
    if (subtab === "captaincy") return "Captaincy";
    if (subtab === "tactics") return "Team Tactics";
    if (subtab === "injuryhub") return "Injury Hub";
    if (subtab === "search") return "Player Search";
    if (subtab === "assignments") return "Scouting Assignments";
    if (subtab === "seasonanalysis") return "Season Data Analysis";
    if (subtab === "reports") return "Scout Reports";
    if (subtab === "planner") return "Auction Planner";
    if (subtab === "trades") return "Trade Hub";
    if (subtab === "injuries") return "Injuries";
    if (subtab === "fixtures") return "Fixtures & Results";
    if (subtab === "standings") return "Standings";
    if (subtab === "stats") return "Tournament Key Players";
    if (subtab === "office") return "Manager Office";
    if (subtab === "staffmanagement") return "Staff Management";
    if (subtab === "staff") return "Staff";
    if (subtab === "pitchcurator") return "Pitch Curator";
    if (subtab === "stadiummanagement") return "Stadium Management";
    if (subtab === "calendar") return "Season Calendar";
    if (subtab === "social") return "Social Media";
    if (subtab === "news") return "News";
    if (subtab === "records") return "Records";
    if (subtab === "minorrecords") return "Minor Records";
    if (subtab === "clubhistory") return "Club History";
    if (subtab === "clubfigures") return "Club Figures";
    if (subtab === "leaguehistory") return "League History";
    if (subtab === "leaguehalloffame") return "League Hall of Fame";
    return subtab.toUpperCase();
  };

  // Derive subtabs based on active main tab
  const activeSubTabs = mainTabConfig[activeTab].subtabs;

  // Filtered player search calculations
  const filteredSearchList = useMemo(() => {
    return Object.values(players)
      .filter((p): p is Player => !!p && p.currentTeamId !== userTeamId)
      .filter((p) => (p.careerState?.generatedSeason ?? currentSeason) <= currentSeason)
      .filter(p => {
        if (searchQuery) {
          return (p?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
      })
      .filter(p => {
        if (filterNationality === "overseas") return p.nationality === "Overseas";
        if (filterNationality === "indian_capped") return p.nationality === "Indian" && p.isCapped;
        if (filterNationality === "indian_uncapped") return p.nationality === "Indian" && !p.isCapped;
        return true;
      })
      .filter(p => {
        if (filterRole !== "all") return p.role === filterRole;
        return true;
      })
      .filter(p => getPlayerRating(p) >= minRating)
      .sort((a,b) => getPlayerRating(b) - getPlayerRating(a))
      .slice(0, 15); // Show top 15 results
  }, [players, searchQuery, filterNationality, filterRole, minRating, userTeamId, currentSeason]);

  const bestScoutingPlayers = useMemo(() => Object.values(players)
    .filter((player): player is Player => !!player && (player.careerState?.generatedSeason ?? currentSeason) <= currentSeason)
    .sort((a, b) => {
      const abilityDifference = getPlayerRating(b) - getPlayerRating(a);
      if (abilityDifference !== 0) return abilityDifference;
      const potentialDifference = Math.max(b.potentialBatting, b.potentialBowling) - Math.max(a.potentialBatting, a.potentialBowling);
      return potentialDifference || a.name.localeCompare(b.name);
    }), [players, currentSeason]);

  useEffect(() => {
    const list = scoutingOverviewListRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;

    const updateVisibleCount = () => {
      const rowHeight = 44;
      const overflowLineHeight = 28;
      const totalPlayers = bestScoutingPlayers.length;
      if (list.clientHeight <= 0) return;
      const rowsWithoutOverflowLine = Math.max(0, Math.floor(list.clientHeight / rowHeight));
      const nextCount = totalPlayers <= rowsWithoutOverflowLine
        ? totalPlayers
        : Math.max(1, Math.floor((list.clientHeight - overflowLineHeight) / rowHeight));
      setVisibleScoutingOverviewCount(nextCount);
    };

    const observer = new ResizeObserver(updateVisibleCount);
    observer.observe(list);
    const animationFrame = requestAnimationFrame(updateVisibleCount);
    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [activeTab, activeSubTab, bestScoutingPlayers.length]);

  // Derived Orange/Purple Cap lists
  const orangeCapLeaders = useMemo(() => {
    return Object.values(playerStats)
      .sort((a,b) => b.runs - a.runs)
      .slice(0, 5);
  }, [playerStats]);

  const purpleCapLeaders = useMemo(() => {
    return Object.values(playerStats)
      .sort((a,b) => b.wickets - a.wickets)
      .slice(0, 5);
  }, [playerStats]);

  const mvpLeaders = useMemo(() => {
    return rankMvpCandidates(Object.values(playerStats)).slice(0, 5);
  }, [playerStats]);

  const emergingPlayerLeaders = useMemo(() => {
    const previousWinnerNames = [
      ...HISTORICAL_LEAGUE_HISTORY,
      ...simulatedLeagueHistory,
    ]
      .filter((record) => record.season < currentSeason && record.emergingPlayer)
      .map((record) => record.emergingPlayer!.name);
    return rankEmergingPlayerCandidates({
      stats: Object.values(playerStats),
      players,
      season: currentSeason,
      initialSeason: INITIAL_ACTIVE_SEASON,
      previousWinnerNames,
    }).slice(0, 5);
  }, [currentSeason, playerStats, players, simulatedLeagueHistory]);

  const bestBattingPerformances = useMemo(() => fixtures
    .filter((match) => match.played && match.scorecard)
    .flatMap((match) => [
      ...match.scorecard!.inningsA.batting.map((performance) => ({
        ...performance,
        teamId: match.teamA,
        opponentId: match.teamB,
        matchNumber: match.matchNumber,
      })),
      ...match.scorecard!.inningsB.batting.map((performance) => ({
        ...performance,
        teamId: match.teamB,
        opponentId: match.teamA,
        matchNumber: match.matchNumber,
      })),
    ])
    .filter((performance) => (performance.balls ?? 0) > 0)
    .sort((left, right) => (
      (right.runs ?? 0) - (left.runs ?? 0)
      || (
        ((right.runs ?? 0) / Math.max(1, right.balls ?? 0))
        - ((left.runs ?? 0) / Math.max(1, left.balls ?? 0))
      )
      || (right.sixes ?? 0) - (left.sixes ?? 0)
    ))
    .slice(0, 10), [fixtures]);

  const bestBowlingFigures = useMemo(() => fixtures
    .filter((match) => match.played && match.scorecard)
    .flatMap((match) => [
      ...match.scorecard!.inningsA.bowling.map((performance) => ({
        ...performance,
        teamId: match.teamB,
        opponentId: match.teamA,
        matchNumber: match.matchNumber,
      })),
      ...match.scorecard!.inningsB.bowling.map((performance) => ({
        ...performance,
        teamId: match.teamA,
        opponentId: match.teamB,
        matchNumber: match.matchNumber,
      })),
    ])
    .filter((performance) => (performance.overs ?? 0) > 0 || (performance.wickets ?? 0) > 0)
    .sort((left, right) => (
      (right.wickets ?? 0) - (left.wickets ?? 0)
      || (left.runsConceded ?? 0) - (right.runsConceded ?? 0)
      || (left.overs ?? 0) - (right.overs ?? 0)
    ))
    .slice(0, 10), [fixtures]);
  const emailLineupCandidates = useMemo(() => (userTeam?.squad ?? [])
    .map((id) => players[id])
    .filter((player): player is Player => Boolean(player))
    .map((player) => ({
      id: player.id,
      nationality: player.nationality,
      role: player.role,
      batting: player.currentBatting,
      bowling: player.currentBowling,
      isWicketkeeper: player.role === "WK-Batsman" || Boolean(player.isWicketkeeper) || Boolean(player.isPartTimeWk),
      isPartTimeWicketkeeper: Boolean(player.isPartTimeWk),
      isOpener: player.isOpener,
      onlyOpensOrBenched: player.onlyOpensOrBenched,
    })), [players, userTeam?.squad]);
  const clubFeaturedPlayers = useMemo(() => (userTeam?.squad ?? [])
    .map((id) => players[id])
    .filter((player): player is Player => Boolean(player))
    .sort((left, right) => (
      getPlayerRating(right) - getPlayerRating(left)
      || (right.reputation ?? 0) - (left.reputation ?? 0)
      || left.name.localeCompare(right.name)
    ))
    .slice(0, 5), [players, userTeam?.squad]);
  const supporterFixtures = useMemo(() => {
    const byId = new Map<string, Match>();
    careerSeasonArchives.forEach((archive) => {
      ((archive.fixtures ?? []) as Match[]).forEach((fixture) => byId.set(fixture.id, fixture));
    });
    fixtures.forEach((fixture) => byId.set(fixture.id, fixture));
    return Array.from(byId.values()).map((fixture) => ({
      ...fixture,
      playerOfTheMatchId: fixture.simulation?.playerOfTheMatchId ?? null,
    }));
  }, [careerSeasonArchives, fixtures]);
  const userSupporterStaff = useMemo(() => Object.values(careerStaff.contracts)
    .filter((contract) => contract.teamId === userTeamId && contract.status === "contracted")
    .map((contract) => ({
      id: contract.staffId,
      fullName: contract.fullName,
      primaryRole: contract.primaryRole.replaceAll("_", " "),
      roles: contract.roles,
      currentAbility: contract.currentAbility,
      reputation: contract.reputation,
      loyalty: contract.loyalty,
      tenureSeasons: contract.startSeason ? Math.max(0, currentSeason - contract.startSeason + 1) : 0,
    })), [careerStaff.contracts, currentSeason, userTeamId]);
  const supporterClubEvents = useMemo(() => {
    const tradeEvents = tradeRecords
      .filter((record) => record.fromTeamId === userTeamId || record.toTeamId === userTeamId)
      .map((record) => {
        const arrivals = record.toTeamId === userTeamId ? record.incomingPlayerIds : record.outgoingPlayerIds;
        const departures = record.fromTeamId === userTeamId ? record.outgoingPlayerIds : record.incomingPlayerIds;
        const names = (ids: string[]) => ids.map((id) => players[id]?.name ?? "a player").join(", ");
        return {
          id: `supporters-trade-${record.id}`,
          date: record.date,
          season: record.season,
          category: "squad" as const,
          kind: "trade",
          title: arrivals.length ? `Trade brought in ${names(arrivals)}` : `Trade departure: ${names(departures)}`,
          detail: `${arrivals.length ? `Arrivals: ${names(arrivals)}. ` : ""}${departures.length ? `Departures: ${names(departures)}.` : ""}`,
          impact: arrivals.length * 2 - departures.length * 2,
        };
      });
    const staffEvents = careerStaff.employmentHistory
      .filter((event) => event.teamId === userTeamId || event.paidByTeamId === userTeamId)
      .map((event) => {
        const staffName = careerStaff.contracts[event.staffId]?.fullName ?? careerStaff.generatedProfiles[event.staffId]?.fullName ?? "Staff member";
        const positive = event.kind === "appointed" || event.kind === "contract_renewed";
        return {
          id: `supporters-staff-${event.id}`,
          date: event.effectiveOn,
          season: event.season,
          category: "staff" as const,
          kind: event.kind,
          title: `${staffName} ${event.kind.replaceAll("_", " ")}`,
          detail: `${event.roles.map((role) => role.replaceAll("_", " ")).join(", ")}${event.compensation ? ` · compensation ₹${event.compensation.toFixed(1)} Cr` : ""}`,
          impact: positive ? 2 : event.kind === "released" ? -3 : -1,
          subjectId: event.staffId,
        };
      });
    const injuries = [...injuryHistory, ...Object.values(activeInjuries)]
      .filter((injury, index, all) => injury.teamId === userTeamId && all.findIndex((item) => item.id === injury.id) === index)
      .map((injury) => ({
        id: `supporters-injury-${injury.id}`,
        date: injury.endedOn ?? injury.startedOn,
        season: injury.season,
        category: "injuries" as const,
        kind: injury.endedOn ? "recovery" : "injury",
        title: injury.endedOn ? `${injury.playerName} returned from injury` : `${injury.playerName} suffered ${injury.conditionName}`,
        detail: `${injury.category} injury · ${injury.matchesMissed} match${injury.matchesMissed === 1 ? "" : "es"} missed`,
        impact: injury.endedOn ? Math.min(4, 1 + injury.matchesMissed) : -Math.min(7, 2 + injury.matchesMissed),
        subjectId: injury.playerId,
      }));
    const recruitmentEvents = (userTeam?.squad ?? []).flatMap((playerId) => {
      const player = players[playerId];
      return (player?.iplHistory ?? [])
        .filter((entry) => entry.teamId === userTeamId && Number(entry.season) >= 2025)
        .map((entry) => ({
          id: `supporters-recruitment-${playerId}-${entry.season}`,
          date: `${entry.season}-02-01`,
          season: Number(entry.season),
          category: "squad" as const,
          kind: entry.isRtm ? "rtm" : entry.isInjuryReplacement ? "injury_replacement" : "recruitment",
          title: `${player.name} joined for ₹${entry.price.toFixed(1)} Cr`,
          detail: entry.isRtm ? "Signed through Right to Match" : entry.isInjuryReplacement ? "Signed as an injury replacement" : "Auction or retention squad investment",
          impact: Math.min(5, 1 + entry.price / 6),
          subjectId: playerId,
        }));
    });
    return [...tradeEvents, ...staffEvents, ...injuries, ...recruitmentEvents];
  }, [activeInjuries, careerStaff.contracts, careerStaff.employmentHistory, careerStaff.generatedProfiles, injuryHistory, players, tradeRecords, userTeam?.squad, userTeamId]);

  const userHeadCoach = useMemo(() => {
    if (!careerStaff || !careerStaff.contracts || !userTeamId) return null;
    return Object.values(careerStaff.contracts).find(
      (c) => c.teamId === userTeamId && c.status === "contracted" && (c.roles.includes("head_coach") || c.primaryRole === "head_coach")
    ) ?? null;
  }, [careerStaff, userTeamId]);

  const userMentor = useMemo(() => {
    if (!careerStaff || !careerStaff.contracts || !userTeamId) return null;
    return Object.values(careerStaff.contracts).find(
      (c) => c.teamId === userTeamId && c.status === "contracted" && (c.roles.includes("mentor") || c.primaryRole === "mentor")
    ) ?? null;
  }, [careerStaff, userTeamId]);
  const emailLineupStatus = useMemo<CareerEmailLineupStatus>(() => {
    const battingValidation = validateLineup(battingFirstXI, emailLineupCandidates);
    const bowlingValidation = validateLineup(bowlingFirstXI, emailLineupCandidates);
    const candidateIds = new Set(emailLineupCandidates.map((player) => player.id));
    const impactPlanIsValid = (lineup: string[], impactSubs: string[]) => (
      impactSubs.length === 5
      && new Set(impactSubs).size === 5
      && impactSubs.every((id) => candidateIds.has(id) && !lineup.includes(id))
    );

    return {
      battingFirstValid: battingValidation.isValid && impactPlanIsValid(battingFirstXI, battingFirstImpactSubs),
      bowlingFirstValid: bowlingValidation.isValid && impactPlanIsValid(bowlingFirstXI, bowlingFirstImpactSubs),
      battingFirstCount: battingValidation.playerCount,
      bowlingFirstCount: bowlingValidation.playerCount,
      battingImpactCount: battingFirstImpactSubs.length,
      bowlingImpactCount: bowlingFirstImpactSubs.length,
      battingOverseasCount: battingValidation.overseasCount,
      bowlingOverseasCount: bowlingValidation.overseasCount,
      battingWicketkeepers: battingValidation.wicketkeeperCount,
      bowlingWicketkeepers: bowlingValidation.wicketkeeperCount,
      battingBowlingOptions: battingValidation.bowlingOptionCount,
      bowlingBowlingOptions: bowlingValidation.bowlingOptionCount,
    };
  }, [
    battingFirstImpactSubs,
    battingFirstXI,
    bowlingFirstImpactSubs,
    bowlingFirstXI,
    emailLineupCandidates,
  ]);
  const careerEmailDrafts = useMemo(() => {
    if (!userTeam) return [];
    return buildCareerEmailDrafts({
      currentDate,
      season: currentSeason,
      initialSeason: INITIAL_ACTIVE_SEASON,
      fixtureAnnouncementDate: formattedAnnouncementDate,
      fixturesAnnounced: isFixturesAnnounced,
      userTeamId,
      userTeam,
      teams,
      players,
      fixtures,
      standings,
      playerStats,
      leadership: teamLeadership,
      captainChangeGamesRemaining: getCaptainChangeGamesRemaining(teamLeadership, userGamesPlayed),
      lineup: emailLineupStatus,
      tacticsPreset: teamTactics.preset,
      homePitchName: userSelectedPitch?.name ?? "Current home pitch",
    });
  }, [
    currentDate,
    currentSeason,
    emailLineupStatus,
    fixtures,
    formattedAnnouncementDate,
    isFixturesAnnounced,
    playerStats,
    players,
    standings,
    teamLeadership,
    teamTactics.preset,
    teams,
    userGamesPlayed,
    userTeam,
    userTeamId,
    userSelectedPitch?.name,
  ]);

  useEffect(() => {
    if (!isCareerLoaded || !userTeam) return;
    const nextInbox = reconcileCareerEmails(inbox, careerEmailDrafts);
    if (nextInbox === inbox) return;
    setInbox(nextInbox);
    saveCareerState({ inbox: nextInbox });
  }, [careerEmailDrafts, inbox, isCareerLoaded, userTeam]);

  const leagueHistoryPlayerByName = useMemo(() => {
    const playerByName = new Map<string, Player>();
    Object.values(players).forEach((player) => {
      playerByName.set(normalizeLeagueHistoryPlayerName(player.name), player);
    });
    return playerByName;
  }, [players]);

  const inboxThreads = Array.from(inbox.reduce((threads, message) => {
    const thread = threads.get(message.threadId) ?? [];
    thread.push(message);
    threads.set(message.threadId, thread);
    return threads;
  }, new Map<string, CareerEmail[]>())).map(([threadId, messages]) => {
    const newestMessages = [...messages].sort((left, right) => (
      right.date.localeCompare(left.date)
      || right.daySequence - left.daySequence
      || right.id.localeCompare(left.id)
    ));
    return {
      threadId,
      messages: orderCareerEmailThread(messages),
      latest: newestMessages[0],
      unreadCount: messages.filter((message) => message.unread).length,
    };
  }).sort((left, right) => (
    right.latest.date.localeCompare(left.latest.date)
    || right.latest.daySequence - left.latest.daySequence
    || right.latest.id.localeCompare(left.latest.id)
  ));
  const selectedMessage = selectedMsgId ? inbox.find((message) => message.id === selectedMsgId) ?? null : null;
  const selectedThread = selectedMessage
    ? inboxThreads.find((thread) => thread.threadId === selectedMessage.threadId) ?? null
    : null;

  const markThreadRead = (threadId: string, selectedId: string) => {
    setSelectedMsgId(selectedId);
    const nextInbox = inbox.map((message) => (
      message.threadId === threadId && message.unread ? { ...message, unread: false } : message
    ));
    if (nextInbox.some((message, index) => message !== inbox[index])) {
      setInbox(nextInbox);
      saveCareerState({ inbox: nextInbox });
    }
  };

  const markAllInboxRead = () => {
    if (!inbox.some((message) => message.unread)) return;
    const nextInbox = inbox.map((message) => (
      message.unread ? { ...message, unread: false } : message
    ));
    setInbox(nextInbox);
    saveCareerState({ inbox: nextInbox });
  };

  useEffect(() => {
    if (activeSubTab !== "inbox" || inboxThreads.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        activeEl.getAttribute("contenteditable") === "true"
      )) {
        return;
      }

      e.preventDefault();

      const currentIndex = selectedThread 
        ? inboxThreads.findIndex((t) => t.threadId === selectedThread.threadId) 
        : -1;

      let nextIndex = 0;
      if (e.key === "ArrowDown") {
        if (currentIndex === -1) {
          nextIndex = 0;
        } else {
          nextIndex = Math.min(currentIndex + 1, inboxThreads.length - 1);
        }
      } else if (e.key === "ArrowUp") {
        if (currentIndex === -1) {
          nextIndex = 0;
        } else {
          nextIndex = Math.max(currentIndex - 1, 0);
        }
      }

      const targetThread = inboxThreads[nextIndex];
      if (targetThread) {
        markThreadRead(targetThread.threadId, targetThread.latest.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSubTab, inboxThreads, selectedThread]);

  useEffect(() => {
    if (activeSubTab !== "inbox" || !selectedThread) return;
    const element = document.getElementById(`email-thread-${selectedThread.threadId}`);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    }
  }, [selectedThread?.threadId, activeSubTab]);

  // Guard clause for uninitialized games
  if (!userTeam) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="font-barlow text-text-secondary text-center">
          No active game.{" "}
          <a href="/setup" className="text-text-primary underline font-semibold">Start a new game</a>
        </div>
      </div>
    );
  }

  const clubSeasonHistoryBySeason = new Map(
    getClubSeasonHistory(userTeamId, userTeam.name).map((season) => [season.season, season]),
  );
  simulatedLeagueHistory.forEach((season) => {
    clubSeasonHistoryBySeason.set(season.season, {
      season: season.season,
      clubName: userTeam.name,
      outcome: season.championTeamId === userTeamId
        ? "Champions"
        : season.runnerUpTeamId === userTeamId
          ? "Runners-up"
          : "League season",
    });
  });
  const clubSeasonHistory = Array.from(clubSeasonHistoryBySeason.values())
    .sort((left, right) => right.season - left.season);
  const latestClubHistorySeason = clubSeasonHistory[0]?.season ?? LAST_HISTORICAL_CLUB_SEASON;
  const clubTitles = clubSeasonHistory.filter((season) => season.outcome === "Champions");
  const clubRunnerUpFinishes = clubSeasonHistory.filter((season) => season.outcome === "Runners-up");
  const clubSeasonsPlayed = clubSeasonHistory.filter((season) => season.outcome !== "Did not participate").length;
  const clubFigures = getClubFigures(userTeamId, players, clubFigureTierOverrides, clubFigureProgression);
  const clubFigureSections: Array<{ tier: ClubFigureTier; title: string; description: string }> = [
    { tier: "legend", title: "Legends", description: "The defining names in club history" },
    { tier: "icon", title: "Icons", description: "Major figures closely associated with the club" },
    { tier: "hero", title: "Heroes", description: "Memorable performers and fan favourites" },
  ];
  const leagueHistoryBySeason = new Map(HISTORICAL_LEAGUE_HISTORY.map((season) => [season.season, season]));
  simulatedLeagueHistory.forEach((season) => leagueHistoryBySeason.set(season.season, season));
  const leagueHistorySeasons = Array.from(leagueHistoryBySeason.values()).sort((left, right) => right.season - left.season);
  const careerLeagueHistoryCount = leagueHistorySeasons.filter((season) => season.source === "career").length;
  const getLeagueHistoryTeam = (teamId: string) => {
    const liveTeam = teams[teamId];
    if (liveTeam) {
      return {
        id: liveTeam.id,
        name: liveTeam.name,
        shortName: liveTeam.shortName,
        primaryColor: liveTeam.primaryColor,
        secondaryColor: liveTeam.secondaryColor,
      };
    }
    return LEAGUE_HISTORY_TEAMS[teamId] ?? {
      id: teamId,
      name: teamId,
      shortName: teamId,
      primaryColor: "#5b6472",
      secondaryColor: "#ffffff",
    };
  };
  const nextUserFixture = fixtures
    .filter((fixture) => !fixture.played && (fixture.teamA === userTeamId || fixture.teamB === userTeamId))
    .sort((left, right) => (left.date ?? "").localeCompare(right.date ?? "") || (left.time ?? "").localeCompare(right.time ?? "") || left.round - right.round)[0];
  const nextOpponentId = nextUserFixture
    ? nextUserFixture.teamA === userTeamId ? nextUserFixture.teamB : nextUserFixture.teamA
    : null;
  const nextOpponent = nextOpponentId ? teams[nextOpponentId] : null;
  const nextOpponentSquad = nextOpponent
    ? nextOpponent.squad.map((playerId) => players[playerId]).filter((player): player is Player => Boolean(player))
    : [];
  const nextOpponentCaptainId = nextOpponentId
    ? (aiTeamLeadership[nextOpponentId]?.captainId
      ?? (nextOpponent ? appointAiTeamLeadership(nextOpponent, nextOpponentSquad, currentSeason).captainId : null))
    : null;
  const nextOpponentCaptain = nextOpponentCaptainId ? players[nextOpponentCaptainId] : undefined;
  const nextOpponentBatters = nextOpponentSquad
    .slice()
    .sort((left, right) => (right.currentBatting ?? 0) - (left.currentBatting ?? 0) || getPlayerRating(right) - getPlayerRating(left))
    .slice(0, 2);
  const nextOpponentBowlers = nextOpponentSquad
    .filter((player) => (player.currentBowling ?? 0) > 0)
    .sort((left, right) => (right.currentBowling ?? 0) - (left.currentBowling ?? 0) || getPlayerRating(right) - getPlayerRating(left))
    .slice(0, 2);
  const nextOpponentStandingIndex = nextOpponentId
    ? standings.findIndex((standing) => standing.teamId === nextOpponentId)
    : -1;
  const nextOpponentStanding = nextOpponentStandingIndex >= 0 ? standings[nextOpponentStandingIndex] : null;
  const nextFixtureVenue = nextUserFixture ? teams[nextUserFixture.teamA]?.homeGround : null;

  const handleEmailAction = (action: CareerEmailAction) => {
    if (action.kind === "player" && action.entityId && players[action.entityId]) {
      setDetailedPlayerId(action.entityId);
      return;
    }

    if (action.kind === "fixture" && action.entityId) {
      const fixture = fixtures.find((candidate) => candidate.id === action.entityId);
      if (fixture?.played) {
        setActiveMatchResultView("summary");
        setActiveCommentary(fixture.commentary ?? []);
        setActiveScorecard(fixture);
        return;
      }
    }

    if (action.tab && action.subtab) {
      setActiveTab(action.tab);
      router.push(`/game/overview?tab=${action.tab}&subtab=${action.subtab}`, { scroll: false });
    }
  };

  const handleInjuryReplacementSigning = (injuryId: string, replacementPlayerId: string) => {
    const injury = Object.values(activeInjuries).find((candidate) => candidate.id === injuryId);
    const replacement = players[replacementPlayerId];
    if (!injury || !replacement) return false;
    const signed = signInjuryReplacement({
      injuryId,
      replacementPlayerId,
      date: currentDate,
      seasonFinalDate: getSeasonFinalDate(),
      teamFinalLeagueDate: getTeamFinalLeagueDate(userTeamId),
    });
    if (!signed) {
      showToast("That player is no longer eligible for this injury replacement.");
      return false;
    }
    setInbox((currentInbox) => {
      const nextInbox = currentInbox.map((message) => (
        message.threadId === `medical:${injury.playerId}`
          ? { ...message, actionCompleted: true }
          : message
      ));
      saveCareerState({ inbox: nextInbox });
      return nextInbox;
    });
    showToast(`${replacement.name} signed as ${injury.playerName}'s injury replacement.`);
    return true;
  };

  const activePlayedFixture = activePlayedMatch
    ? fixtures.find((fixture) => fixture.id === activePlayedMatch.fixtureId && !fixture.played)
    : undefined;
  let activePlayedInput: MatchSimulationInput | null = null;
  if (activePlayedFixture) {
    try {
      activePlayedInput = buildPlayableMatchInput(activePlayedFixture);
    } catch (error) {
      console.error("Unable to restore playable match:", error);
    }
  }

  return (
    <div className={`app-theme-background overview-page h-[calc(100vh-3rem)] flex overflow-hidden bg-bg relative ${activeTab === "history" ? "compact-history" : ""}`}>
      {seasonTransitionStage && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-[#0b1018]/95 px-6 text-white backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="w-full max-w-md border-2 border-white/15 bg-[#111925] p-8 text-center shadow-2xl">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-accent" />
            <p className="mt-6 font-space-mono text-[9px] font-bold uppercase tracking-[0.24em] text-accent">
              Season transition
            </p>
            <h2 className="mt-3 font-anton text-3xl uppercase">Preparing retention</h2>
            <p className="mt-3 text-sm text-white/65">{seasonTransitionStage}</p>
          </div>
        </div>
      )}
      {/* Global Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] bg-[var(--ink)] text-bg border border-border/20 px-4 py-3 rounded shadow-lg text-xs font-space-mono font-semibold uppercase tracking-wider animate-in fade-in slide-in-from-bottom-3 duration-200">
          {toastMessage}
        </div>
      )}
      {activePlayedMatch && activePlayedInput && (
        <PlayableMatchEngine
          input={activePlayedInput}
          userTeamId={userTeamId}
          session={activePlayedMatch}
          onSessionChange={savePlayableMatchSession}
          onComplete={completePlayableMatch}
        />
      )}

      {/* Fast-forward runs behind a stable progress screen rather than flashing calendar days. */}
      {false && careerFastForwardTargetDate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0b1018]/95 px-6 text-white backdrop-blur-sm" role="status" aria-live="polite">
          <div className="w-full max-w-lg border-2 border-white/15 bg-[#111925] p-8 shadow-2xl">
            <p className="font-space-mono text-[9px] font-bold uppercase tracking-[0.24em] text-accent">Career simulation in progress</p>
            <h2 className="mt-3 font-anton text-3xl uppercase">Fast-forwarding</h2>
            <p className="mt-2 text-sm text-white/60">Simulating every match, retention window and auction through {careerFastForwardTargetDate}.</p>
            <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(1, fastForwardProgress * 100)}%` }} />
            </div>
            <div className="mt-3 flex justify-between font-space-mono text-[10px] font-bold uppercase tracking-wider text-white/65">
              <span>{Math.round(fastForwardProgress * 100)}% · {currentDate}</span>
              <span>{fastForwardRemainingSeconds === null ? "Calculating time" : `About ${fastForwardRemainingSeconds}s left`}</span>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 font-space-mono text-[9px] uppercase text-white/45">
              <span>Elapsed {(fastForwardElapsedMs / 1000).toFixed(1)}s</span>
              <button
                type="button"
                onClick={() => cancelCareerFastForward()}
                className="border border-white/20 px-3 py-2 font-space-mono text-[9px] font-bold uppercase tracking-wider text-white/75 transition hover:border-white/50 hover:text-white"
              >
                Stop simulation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticking Calendar Overlay */}
      {(careerFastForwardTargetDate || isSimulatingDays || isCalendarClosing) && (
        <div
          className={`${isSimulatingDays ? "ticking-calendar-drop" : "ticking-calendar-pull-up"} fixed inset-x-0 top-0 z-[120] flex items-center gap-3 border-b-2 border-border bg-surface px-3 py-3 shadow-2xl sm:px-5`}
          role="region"
          aria-label="Day-by-day simulation calendar"
        >
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            Current simulation date: {dateKeyToLocalDate(currentDate).toLocaleDateString("en-GB", { dateStyle: "full" })}
          </p>
          {/* Yesterday, today, and the next five days. */}
          <div className="min-w-0 flex-1 overflow-x-auto px-1 py-1">
            <div className="mx-auto flex w-max items-center gap-2 sm:gap-3">
              {TICKING_CALENDAR_OFFSETS.map((offset) => {
                const tileDateString = addDaysToDateKey(currentDate, offset);
                const {
                  date: tileDate,
                  dayMatches,
                  hasAuction,
                  hasRetention,
                  hasUserMatch,
                  isAnnouncement,
                  isPreAnnouncementOpeningMatch,
                } = getCalendarDayData(tileDateString);
                const isCurrentDay = offset === 0;

                return (
                  <div
                    key={tileDateString}
                    aria-current={isCurrentDay ? "date" : undefined}
                    className={`flex size-20 shrink-0 flex-col justify-between rounded-md border-2 p-1.5 text-left transition-all sm:size-24 sm:p-2
                      ${isCurrentDay
                        ? "scale-[1.03] border-accent bg-accent/5 shadow-lg ring-2 ring-accent/25"
                        : isAnnouncement
                          ? "border-success bg-success/5"
                          : isPreAnnouncementOpeningMatch
                            ? "border-accent bg-accent/5"
                            : "border-border bg-surface"}
                      ${offset < 0 ? "opacity-[0.55]" : ""}`}
                  >
                    <div className="flex w-full items-start justify-between gap-1">
                      <time
                        dateTime={tileDateString}
                        aria-label={tileDate.toLocaleDateString("en-GB", { dateStyle: "full" })}
                        className="font-space-mono text-[10px] font-bold leading-tight text-text-primary sm:text-[11px]"
                      >
                        <span className="block text-[7px] uppercase tracking-wide text-text-secondary sm:text-[8px]">
                          {tileDate.toLocaleDateString("en-GB", { weekday: "short" })}
                        </span>
                        {tileDate.getDate()} {tileDate.toLocaleDateString("en-GB", { month: "short" })}
                      </time>
                      {hasUserMatch && <span className="mt-1 size-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />}
                    </div>

                    <div className="mt-1 flex w-full flex-grow flex-col justify-end">
                      {dayMatches.length > 0 && (
                        <div className="w-full space-y-0.5">
                          {dayMatches.slice(0, 2).map((match) => {
                            const isUserGame = match.teamA === userTeamId || match.teamB === userTeamId;
                            const opponentId = match.teamA === userTeamId ? match.teamB : match.teamA;
                            const opponent = teams[opponentId];

                            return (
                              <div
                                key={match.id}
                                className={`w-full truncate rounded px-1 py-0.5 text-center font-space-mono text-[8px] font-bold uppercase leading-tight
                                  ${isUserGame ? "text-white" : "border border-border/40 bg-[#16130f]/5 text-text-primary"}`}
                                style={isUserGame && userTeam ? { backgroundColor: userTeam.primaryColor, color: userTeam.secondaryColor } : undefined}
                              >
                                {isUserGame
                                  ? `${match.played ? (match.winner === userTeamId ? "W" : "L") : "Playing"} · vs ${opponent?.shortName ?? opponentId}`
                                  : `${teams[match.teamA]?.shortName ?? match.teamA} v ${teams[match.teamB]?.shortName ?? match.teamB}`}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {(hasAuction || hasRetention || isAnnouncement || isPreAnnouncementOpeningMatch) && (
                        <div className="mt-0.5 w-full text-center font-anton text-[8px] uppercase leading-none tracking-wider sm:text-[9px]">
                          {hasAuction && <span className="block text-success">Auction</span>}
                          {hasRetention && <span className="block text-danger">Retention</span>}
                          {isAnnouncement && <span className="block rounded border border-success/30 bg-success/15 py-0.5 text-success">Fixtures</span>}
                          {isPreAnnouncementOpeningMatch && <span className="block rounded border border-accent/40 bg-accent/15 py-0.5 text-accent">Season Opener</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            ref={calendarStopButtonRef}
            type="button"
            onClick={() => cancelCareerFastForward()}
            className="flex shrink-0 items-center gap-2 rounded bg-danger px-3 py-2.5 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white shadow-md transition-all hover:bg-danger/90 active:scale-95 sm:px-5 sm:text-xs"
            aria-label="Stop day-by-day simulation (Escape)"
          >
            <span className="size-2 rounded-sm bg-white" aria-hidden="true" />
            Stop <span className="hidden sm:inline">(Esc)</span>
          </button>
        </div>
      )}



      {/* ----------------------------------------------------------------------
          Main Content Column
          ---------------------------------------------------------------------- */}
      <section className="app-theme-background flex-grow flex flex-col overflow-hidden bg-bg">
        {/* Top Sub-navigation Bar */}
        <header className="border-b-2 border-hairline bg-surface shrink-0 px-8 py-3 flex items-center justify-between">
          <div className="flex gap-1 overflow-x-auto py-1">
            {activeSubTabs.map((subtab) => {
              const isActive = activeSubTab === subtab;
              return (
                <button
                  key={subtab}
                  onClick={() => setActiveSubTab(subtab)}
                  className={`px-4 py-1.5 text-[10px] font-space-mono font-bold tracking-widest uppercase border-[1.5px] rounded transition-all duration-150 active:scale-95
                    ${isActive 
                      ? "bg-[var(--ink)] text-bg border-[var(--ink)]" 
                      : "bg-surface text-text-secondary border-transparent hover:bg-[#16130f]/5"}`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {getSubTabLabel(subtab)}
                    {subtab === "inbox" && inbox.some((message) => message.unread) && (
                      <span className="min-w-4 rounded-full bg-danger px-1 py-0.5 text-center text-[8px] leading-none text-white shadow-sm ring-1 ring-white/25">
                        {inbox.filter((message) => message.unread).length}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!isSimulatingDays && (
              isTickerAtImpasse && pendingUserMatchdayFixture ? (
                <>
                  <button
                    type="button"
                    onClick={() => startPlayableMatch(pendingUserMatchdayFixture)}
                    disabled={!FIXTURE_SIMULATION_ENABLED}
                    className="flex items-center gap-1.5 rounded border border-accent bg-surface px-3.5 py-1.5 font-space-mono text-[9px] font-bold uppercase tracking-wider text-accent shadow-sm transition-all hover:bg-accent/10 active:scale-95 disabled:opacity-45"
                  >
                    <Play className="size-3 fill-current" aria-hidden="true" />
                    Play fixture
                  </button>
                  <button
                    ref={continueButtonRef}
                    type="button"
                    onClick={() => prepareUserFixtureSimulation(pendingUserMatchdayFixture)}
                    disabled={!FIXTURE_SIMULATION_ENABLED}
                    className="flex items-center gap-1.5 rounded bg-accent px-3.5 py-1.5 font-space-mono text-[9px] font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-accent/85 active:scale-95 disabled:opacity-45"
                  >
                    <SkipForward className="size-3" aria-hidden="true" />
                    Simulate fixture
                  </button>
                </>
              ) : (
                <button
                  ref={continueButtonRef}
                  type="button"
                  onClick={startSimulating}
                  aria-label="Continue day-by-day simulation"
                  className="flex items-center gap-1.5 rounded bg-success px-3.5 py-1.5 font-space-mono text-[9px] font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-success/80 active:scale-95"
                >
                  <Play className="size-3 fill-current" aria-hidden="true" />
                  Continue
                </button>
              )
            )}
          </div>
        </header>

        {/* Dynamic Detail Body Screen */}
        <div className={`flex min-h-0 flex-1 flex-col ${activeSubTab === "overview" || activeTab === "history" || (activeTab === "league" && activeSubTab === "minorrecords") ? "overflow-y-auto p-8" : "overflow-hidden"}`}>
          
          {/* ==================================================================
              MAIN TAB: HOME
              ================================================================== */}
          {activeTab === "home" && (
            <>
              {/* Home Overview tab */}
              {activeSubTab === "overview" && (
                <div className="grid grid-cols-[minmax(16rem,0.85fr)_minmax(30rem,1.5fr)_minmax(16rem,0.85fr)] gap-6 h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
                  {/* Inbox column */}
                  <div
                    onClick={() => setActiveSubTab("inbox")}
                    className="group flex min-h-0 cursor-pointer flex-col overflow-hidden rounded-lg border-2 border-border bg-surface p-5 transition-colors hover:border-accent"
                  >
                    <div className="flex shrink-0 items-center justify-between border-b border-[#16130f]/10 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--ink)] text-bg shadow-sm">
                          <Mail size={17} strokeWidth={1.9} aria-hidden="true" />
                        </span>
                        <div>
                          <div className="font-anton text-[15px] uppercase leading-none text-text-primary">INBOX MESSAGES</div>
                          <div className="mt-1 font-space-mono text-[8px] font-bold uppercase tracking-[0.16em] text-text-secondary">Club communications</div>
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-1 font-space-mono text-[8px] font-bold uppercase tracking-wide ${inbox.some((message) => message.unread) ? "bg-danger text-white shadow-sm" : "bg-success/10 text-success"}`}>
                        {inbox.filter(m => m.unread).length} UNREAD
                      </span>
                    </div>
                    <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto py-3">
                      {inboxThreads.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border p-5 text-center">
                          <MailOpen size={22} className="mb-2 text-text-secondary/40" aria-hidden="true" />
                          <p className="text-xs font-barlow text-text-secondary">No messages.</p>
                        </div>
                      ) : inboxThreads.slice(0, 5).map((thread) => (
                        <div
                          key={thread.threadId}
                          onClick={(e) => {
                            e.stopPropagation();
                            markThreadRead(thread.threadId, thread.latest.id);
                            setActiveSubTab("inbox");
                          }}
                          className={`rounded-lg border px-3 py-2.5 text-xs transition-colors cursor-pointer hover:border-accent/50 hover:bg-accent/[0.02] ${
                            thread.unreadCount > 0
                              ? "border-accent/35 bg-accent/[0.055]"
                              : "border-transparent bg-bg/35 group-hover:border-border/70"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full font-space-mono text-[9px] font-bold uppercase ${thread.unreadCount > 0 ? "bg-[var(--ink)] text-bg" : "bg-black/[0.055] text-text-secondary dark:bg-white/[0.07]"}`}>
                              {thread.latest.sender.slice(0, 1)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className={`truncate text-[11px] text-text-primary ${thread.unreadCount > 0 ? "font-extrabold" : "font-semibold"}`}>{thread.latest.subject}</div>
                                {thread.messages.length > 1 && (
                                  <span className="ml-auto shrink-0 rounded-full bg-black/[0.055] px-1.5 py-0.5 font-space-mono text-[8px] text-text-secondary dark:bg-white/[0.07]">{thread.messages.length}</span>
                                )}
                              </div>
                              <div className="mt-0.5 truncate text-[10px] leading-snug text-text-secondary">{thread.latest.preview}</div>
                              <div className="mt-1 flex items-center justify-between gap-2 font-space-mono text-[8px] uppercase tracking-wide text-text-secondary/80">
                                <span className="truncate">{thread.latest.sender}</span>
                                <span className="shrink-0">{thread.latest.date}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex shrink-0 items-center justify-between border-t border-[#16130f]/10 pt-2 font-space-mono text-[8px] font-bold uppercase tracking-[0.14em] text-text-secondary">
                      <span>{inboxThreads.length} conversations</span>
                      <span className="inline-flex items-center gap-1 text-text-primary transition-colors group-hover:text-accent">Open inbox <ArrowUpRight size={11} /></span>
                    </div>
                  </div>

                  {/* Main column */}
                  <div className="grid min-h-0 grid-rows-3 gap-6">
                    <div
                      onClick={() => isFixturesAnnounced && nextUserFixture && router.push("/game/overview?tab=season&subtab=fixtures")}
                      className={`group relative overflow-hidden rounded-lg border-2 border-border bg-surface transition-all ${isFixturesAnnounced && nextUserFixture ? "cursor-pointer hover:border-accent hover:shadow-md" : "cursor-default"}`}
                    >
                      {nextOpponent && (
                        <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: nextOpponent.primaryColor }} />
                      )}
                      {nextOpponent && (
                        <div
                          className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full opacity-15 blur-3xl"
                          style={{ backgroundColor: nextOpponent.primaryColor }}
                        />
                      )}

                      {!isFixturesAnnounced || !nextUserFixture || !nextOpponent ? (
                        <div className="relative flex h-full flex-col p-4">
                          <div className="flex items-center justify-between border-b border-[#16130f]/10 pb-2">
                            <div className="font-anton text-[19px] uppercase text-text-primary">Next Opponent</div>
                            <span className="font-space-mono text-[9px] font-bold uppercase tracking-wider text-text-secondary">Scouting brief</span>
                          </div>
                          <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                            <Lock size={22} className="mb-2 text-text-secondary/45" />
                            <p className="font-anton text-[19px] uppercase text-text-primary">
                              {!isFixturesAnnounced ? "Awaiting fixture announcement" : "Season schedule complete"}
                            </p>
                            <p className="mt-1.5 max-w-sm text-[12px] text-text-secondary">
                              {!isFixturesAnnounced ? `The opposition dossier will unlock on ${userFriendlyAnnouncementDate}.` : "There are no remaining fixtures to scout."}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="relative flex h-full min-h-0 flex-col p-4">
                          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#16130f]/10 pb-2">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Link
                                href={`/game/teams/${nextOpponent.id}`}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-space-mono text-[11px] font-extrabold shadow-sm hover:opacity-90 transition-opacity"
                                style={{ backgroundColor: nextOpponent.primaryColor, color: nextOpponent.secondaryColor }}
                                title={`View ${nextOpponent.name} team profile`}
                              >
                                {nextOpponent.shortName}
                              </Link>
                              <div className="min-w-0">
                                <p className="font-space-mono text-[9px] font-bold uppercase tracking-[0.16em] text-text-secondary">Next opponent · Scouting brief</p>
                                <Link
                                  href={`/game/teams/${nextOpponent.id}`}
                                  className="mt-1 block truncate font-anton text-[24px] uppercase leading-none text-text-primary hover:text-accent hover:underline transition-colors"
                                >
                                  {nextOpponent.name}
                                </Link>
                                <div className="mt-1 flex items-center gap-2 font-space-mono text-[9px] font-bold uppercase text-text-secondary">
                                  <span>{nextOpponentStandingIndex >= 0 ? `${nextOpponentStandingIndex + 1}${nextOpponentStandingIndex === 0 ? "st" : nextOpponentStandingIndex === 1 ? "nd" : nextOpponentStandingIndex === 2 ? "rd" : "th"} in league` : "Pre-season"}</span>
                                  <span className="text-border">·</span>
                                  <span>{nextOpponentStanding ? `${nextOpponentStanding.won}W ${nextOpponentStanding.lost}L` : "No record"}</span>
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-anton text-[20px] uppercase leading-none text-text-primary">
                                {nextUserFixture.date ? dateKeyToLocalDate(nextUserFixture.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "TBC"}
                              </p>
                              <p className="mt-1 font-space-mono text-[9px] font-bold uppercase text-text-secondary">{nextUserFixture.time ?? "Time TBC"} · Match {nextUserFixture.matchNumber}</p>
                              <p className="mt-1 max-w-40 truncate text-[10px] font-medium text-text-secondary" title={nextFixtureVenue ?? "Venue TBC"}>{nextFixtureVenue ?? "Venue TBC"}</p>
                            </div>
                          </div>

                          <div className="grid min-h-0 flex-1 grid-cols-[1.1fr_1fr_1fr] gap-2 pt-2">
                            <div className="flex min-w-0 flex-col justify-center border border-[#16130f]/10 bg-black/[0.025] px-2.5 py-2 dark:bg-white/[0.025]">
                              <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.14em] text-text-secondary">Captain</p>
                              {nextOpponentCaptain ? (
                                <div className="mt-1.5 flex min-w-0 items-center gap-2">
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[0.05] font-anton text-[12px] text-text-primary dark:bg-white/[0.06]">
                                    {nextOpponentCaptain.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-[12px] font-bold text-text-primary">{nextOpponentCaptain.name}</span>
                                    <span className="mt-0.5 block truncate font-space-mono text-[8px] uppercase text-text-secondary">{nextOpponentCaptain.role}</span>
                                  </span>
                                </div>
                              ) : (
                                <span className="mt-1.5 text-[11px] text-text-secondary">Not selected</span>
                              )}
                            </div>

                            <div className="flex min-w-0 flex-col justify-center border border-[#16130f]/10 bg-black/[0.025] px-2.5 py-2 dark:bg-white/[0.025]">
                              <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.14em] text-text-secondary">Key batters</p>
                              <div className="mt-1.5 space-y-1">
                                {nextOpponentBatters.map((player) => (
                                  <div key={`opp-batter-${player.id}`} className="flex min-w-0 items-center justify-between gap-2">
                                    <span className="truncate text-[12px] font-semibold text-text-primary">{player.name}</span>
                                    <span className="shrink-0 rounded-sm bg-black/[0.06] px-1 py-0.5 font-space-mono text-[9px] font-bold text-text-secondary dark:bg-white/[0.08]">{player.currentBatting}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="flex min-w-0 flex-col justify-center border border-[#16130f]/10 bg-black/[0.025] px-2.5 py-2 dark:bg-white/[0.025]">
                              <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.14em] text-text-secondary">Key bowlers</p>
                              <div className="mt-1.5 space-y-1">
                                {nextOpponentBowlers.map((player) => (
                                  <div key={`opp-bowler-${player.id}`} className="flex min-w-0 items-center justify-between gap-2">
                                    <span className="truncate text-[12px] font-semibold text-text-primary">{player.name}</span>
                                    <span className="shrink-0 rounded-sm bg-black/[0.06] px-1 py-0.5 font-space-mono text-[9px] font-bold text-text-secondary dark:bg-white/[0.08]">{player.currentBowling}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div onClick={openCalendarAtCurrentDate} className="row-span-2 flex h-full min-h-0 cursor-pointer flex-col overflow-hidden rounded-lg border-2 border-border bg-surface p-3 transition-colors hover:border-accent">
                    <div className="grid h-full min-h-0 grid-rows-[auto_auto_auto_minmax(0,1fr)]">
                      <div className="mb-1 flex items-start justify-between border-b border-[#16130f]/10 pb-1">
                        <div className="font-anton text-[16px] uppercase text-text-primary">SEASON CALENDAR</div>
                      </div>
                      
                      {/* Mini Month Label */}
                      <div className="mb-1 flex justify-between font-space-mono text-[9px] uppercase text-text-secondary">
                        <span>{inGameDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
                        <span className="text-success font-bold">DAY {inGameDate.getDate()} · ACTIVE</span>
                      </div>

                      {/* Mini Weekday Headers */}
                      <div className="mb-1 grid grid-cols-7 gap-0.5 text-center font-space-mono text-[8px] font-bold text-text-secondary">
                        <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
                      </div>

                      {/* Mini Days Grid */}
                      <div
                        className="grid h-full min-h-0 grid-cols-7 gap-0.5"
                        style={{ gridTemplateRows: `repeat(${homeCalendarWeekCount}, minmax(0, 1fr))` }}
                      >
                        {Array.from({ length: homeCalendarFirstWeekday }).map((_, idx) => (
                          <div key={`mini-empty-${idx}`} className="min-h-0 rounded-sm border border-dashed border-border/25 bg-[#16130f]/[0.015]" />
                        ))}

                        {Array.from({ length: homeCalendarDaysInMonth }).map((_, idx) => {
                          const day = idx + 1;
                          const dateString = `${inGameDate.getFullYear()}-${String(inGameDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                          const dayData = getCalendarDayData(dateString);
                          const isCurrentDay = day === inGameDate.getDate();
                          const hasRingedEvent = dayData.hasAuction || dayData.hasRetention || dayData.hasUserMatch || dayData.isTradeWindowOpening || dayData.isTradeWindowClosing;
                          const surfaceClass = isCurrentDay
                            ? "border-accent/60 bg-accent/[0.07] shadow-sm"
                            : dayData.isAnnouncement
                              ? "border-success bg-success/5"
                              : "border-border/60 bg-surface";
                          const ringClass = isCurrentDay
                            ? "ring-1 ring-inset ring-accent/20"
                            : dayData.isAnnouncement
                              ? "ring-1 ring-success/20"
                              : hasRingedEvent
                                ? "ring-1 ring-accent/30"
                                : "";
                          
                          return (
                            <div
                              key={`mini-${dateString}`}
                              className={`relative min-h-0 rounded-sm border p-1 font-space-mono text-[9px] font-bold leading-none text-text-primary ${surfaceClass} ${ringClass}`}
                              title={[
                                dateString,
                                isCurrentDay ? "Current in-game day" : "",
                                dayData.hasAuction ? "Auction Day" : "",
                                dayData.hasRetention ? "Retention Deadline" : "",
                                dayData.isAnnouncement ? "Fixture Announcement" : "",
                                dayData.isTradeWindowOpening ? "Trade Window Opens" : "",
                                dayData.isTradeWindowClosing ? "Trade Window Closes" : "",
                                dayData.hasUserMatch ? "Your team has a match" : "",
                              ].filter(Boolean).join(" · ")}
                            >
                              <span className={`absolute left-1 top-1 ${isCurrentDay ? "text-accent" : ""}`}>{day}</span>
                              {dayData.hasUserMatch && (
                                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                              )}
                              {dayData.dayMatches.length > 0 && (
                                <div className="absolute inset-x-0.5 bottom-0.5 top-[14px] flex flex-col justify-end gap-px overflow-hidden">
                                  {dayData.dayMatches.slice(0, 2).map((match) => {
                                    const isTbdA = !match.teamA || match.teamA === PLAYOFF_TBD_TEAM_ID || match.teamA.includes("TBD");
                                    const isTbdB = !match.teamB || match.teamB === PLAYOFF_TBD_TEAM_ID || match.teamB.includes("TBD");
                                    const display = getMatchDisplayName(match, teams);
                                    const isUserGame = (match.teamA === userTeamId || match.teamB === userTeamId) && !isTbdA && !isTbdB;
                                    const opponentId = match.teamA === userTeamId ? match.teamB : match.teamA;
                                    const opponent = teams[opponentId];
                                    const teamALabel = !match.teamA || match.teamA === PLAYOFF_TBD_TEAM_ID ? "TBD" : teams[match.teamA]?.shortName ?? match.teamA;
                                    const teamBLabel = !match.teamB || match.teamB === PLAYOFF_TBD_TEAM_ID ? "TBD" : teams[match.teamB]?.shortName ?? match.teamB;
                                    const fixtureTextClass = `${teamALabel.length + teamBLabel.length > 6 ? "text-[6px]" : "text-[8px]"} whitespace-nowrap`;

                                    if (isTbdA && isTbdB && display.isPlayoffTbd) {
                                      return (
                                        <div
                                          key={`mini-fixture-${match.id}`}
                                          className="flex min-h-0 items-center justify-center overflow-hidden rounded-[2px] border border-accent/40 bg-accent/10 px-1 py-1 text-center font-space-mono text-[8px] font-bold uppercase leading-none text-accent shadow-sm"
                                          title={display.label}
                                        >
                                          <span className="truncate">{display.label}</span>
                                        </div>
                                      );
                                    }

                                    return isUserGame ? (
                                      <div
                                        key={`mini-fixture-${match.id}`}
                                        className={`flex min-h-0 items-center justify-center overflow-hidden rounded-[2px] px-0.5 py-1 text-center font-space-mono font-bold uppercase leading-none tracking-[-0.03em] ${fixtureTextClass}`}
                                        style={{ backgroundColor: userTeam.primaryColor, color: userTeam.secondaryColor }}
                                      >
                                        <span
                                          className="whitespace-nowrap rounded-[2px] border border-white/20 px-1 py-0.5 shadow-sm"
                                          style={opponent ? { backgroundColor: opponent.primaryColor, color: opponent.secondaryColor } : undefined}
                                        >
                                          vs {opponent?.shortName ?? opponentId}
                                        </span>
                                      </div>
                                    ) : (
                                      <div
                                        key={`mini-fixture-${match.id}`}
                                        className={`flex min-h-0 items-center justify-center gap-1 overflow-hidden rounded-[2px] border border-border/70 bg-surface px-1 py-1 font-space-mono font-bold uppercase leading-none tracking-[-0.03em] text-text-primary shadow-sm ${fixtureTextClass}`}
                                        title={`${!match.teamA || match.teamA === PLAYOFF_TBD_TEAM_ID ? "TBD" : teams[match.teamA]?.name ?? match.teamA} vs ${!match.teamB || match.teamB === PLAYOFF_TBD_TEAM_ID ? "TBD" : teams[match.teamB]?.name ?? match.teamB}`}
                                      >
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: teams[match.teamA]?.primaryColor ?? "#777777" }} />
                                        <span className="whitespace-nowrap">{teamALabel}</span>
                                        <span className="shrink-0 text-text-secondary">v</span>
                                        <span className="whitespace-nowrap">{teamBLabel}</span>
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: teams[match.teamB]?.primaryColor ?? "#777777" }} />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {(dayData.hasAuction || dayData.hasRetention || dayData.isAnnouncement) && (
                                <span className={`absolute bottom-1 right-1 text-[6px] font-extrabold uppercase ${dayData.hasRetention ? "text-danger" : "text-success"}`}>
                                  {dayData.hasAuction ? "A" : dayData.hasRetention ? "R" : "F"}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {Array.from({ length: Math.max(0, homeCalendarWeekCount * 7 - homeCalendarFirstWeekday - homeCalendarDaysInMonth) }).map((_, idx) => (
                          <div key={`mini-trailing-empty-${idx}`} className="min-h-0 rounded-sm border border-dashed border-border/25 bg-[#16130f]/[0.015]" />
                        ))}
                      </div>
                    </div>
                  </div>

                  </div>

                  {/* Right column */}
                  <div className="grid min-h-0 grid-rows-3 gap-6">
                    <ManagerOfficeSummaryTile onOpen={() => router.push("/game/overview?tab=club&subtab=office")} />

                    <div
                      onClick={() => isFixturesAnnounced && router.push("/game/overview?tab=season&subtab=fixtures")}
                      className={`flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-surface p-5 transition-colors ${isFixturesAnnounced ? "cursor-pointer hover:border-accent" : "cursor-default"}`}
                    >
                      <>
                      <h3 className="shrink-0 font-anton text-[14px] uppercase text-text-primary border-b border-[#16130f]/10 pb-2 mb-3">RECENT &amp; NEXT FIXTURES</h3>
                      {!isFixturesAnnounced ? (
                        <div className="flex min-h-0 flex-1 items-center justify-center text-center font-space-mono text-xs uppercase text-text-secondary">
                          Fixtures not yet announced
                        </div>
                      ) : (
                      <div className="grid min-h-0 flex-1 grid-rows-5 overflow-hidden">
                        {(() => {
                          const userFixtures = fixtures
                            .filter((fixture) => (
                              !fixture.stage
                              && fixture.matchNumber <= LEAGUE_FIXTURE_COUNT
                              && (fixture.teamA === userTeamId || fixture.teamB === userTeamId)
                            ))
                            .sort((a, b) => (
                              (a.date ?? "").localeCompare(b.date ?? "")
                              || (a.time ?? "").localeCompare(b.time ?? "")
                              || a.round - b.round
                              || a.matchNumber - b.matchNumber
                            ));

                          if (userFixtures.length === 0) {
                            return (
                              <div className="flex h-full items-center justify-center text-center font-space-mono text-xs uppercase text-text-secondary">
                                No upcoming fixtures
                              </div>
                            );
                          }

                          const firstUnplayedIndex = userFixtures.findIndex((fixture) => !fixture.played);
                          const remainingFixtures = firstUnplayedIndex < 0
                            ? 0
                            : userFixtures.length - firstUnplayedIndex;
                          const startIndex = firstUnplayedIndex < 0
                            ? Math.max(0, userFixtures.length - 5)
                            : firstUnplayedIndex === 0
                              ? 0
                              : remainingFixtures <= 5
                                ? Math.max(0, userFixtures.length - 5)
                                : Math.max(0, firstUnplayedIndex - 1);
                          const nextFixtureId = firstUnplayedIndex >= 0
                            ? userFixtures[firstUnplayedIndex]?.id
                            : undefined;

                          return userFixtures.slice(startIndex, startIndex + 5).map((fixture, index) => {
                            const opponentId = fixture.teamA === userTeamId ? fixture.teamB : fixture.teamA;
                            const opponent = teams[opponentId];
                            const fixtureDate = fixture.date ? dateKeyToLocalDate(fixture.date) : null;
                            const isNextFixture = fixture.id === nextFixtureId;
                            const userScore = fixture.teamA === userTeamId ? fixture.scoreA : fixture.scoreB;
                            const opponentScore = fixture.teamA === userTeamId ? fixture.scoreB : fixture.scoreA;
                            const outcome = fixture.played
                              ? fixture.winner === userTeamId
                                ? "W"
                                : fixture.winner
                                  ? "L"
                                  : "T"
                              : null;
                            const scoreline = userScore && opponentScore
                              ? `${userScore.runs}/${userScore.wickets}-${opponentScore.runs}/${opponentScore.wickets}`
                              : "Result";

                            return (
                              <div
                                key={`next-fixture-${fixture.id}`}
                                className={`grid min-h-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#16130f]/10 px-1.5 text-text-primary ${
                                  isNextFixture
                                    ? "bg-accent/15 ring-1 ring-inset ring-accent/30"
                                    : index % 2 === 0
                                      ? "bg-black/[0.055] dark:bg-white/[0.07]"
                                      : "bg-black/[0.015] dark:bg-white/[0.025]"
                                }`}
                              >
                                <div className="flex flex-col items-center justify-center leading-none">
                                  <span className="font-space-mono text-[12px] font-bold">{fixtureDate?.getDate() ?? "-"}</span>
                                  <span className="mt-0.5 font-space-mono text-[6px] uppercase text-text-secondary">
                                    {fixtureDate?.toLocaleDateString("en-GB", { month: "short" }) ?? ""}
                                  </span>
                                </div>
                                <span className="truncate text-[10px] font-medium">vs {opponent?.shortName ?? opponentId}</span>
                                {fixture.played && outcome ? (
                                  <div className="whitespace-nowrap text-right font-space-mono text-[8px] font-bold leading-none text-text-secondary">
                                    <span>{scoreline}</span>
                                    <span className={`ml-1 font-black ${
                                      outcome === "W"
                                        ? "text-success"
                                        : outcome === "L"
                                          ? "text-danger"
                                          : "text-text-secondary"
                                    }`}>{outcome}</span>
                                  </div>
                                ) : (
                                  <span className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                                    {fixture.teamA === userTeamId ? "Home" : "Away"}
                                  </span>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                      )}
                      </>
                    </div>

                    <div onClick={() => router.push("/game/overview?tab=season&subtab=standings")} className="flex min-h-0 cursor-pointer flex-col overflow-hidden rounded-lg border-2 border-border bg-surface p-5 pb-6 transition-colors hover:border-accent">
                      <div className="flex min-h-0 w-full flex-1 flex-col">
                        <h3 className="shrink-0 font-anton text-[14px] uppercase text-text-primary border-b border-[#16130f]/10 pb-2 mb-3">LEAGUE TABLE</h3>
                        <div className="flex min-h-0 flex-1 flex-col">
                          <div className="grid shrink-0 grid-cols-[1fr_1.4rem_1.4rem_3rem_2rem] gap-1 pb-1 text-[8px] font-space-mono font-bold text-text-secondary uppercase">
                            <span>Team</span>
                            <span className="text-center">W</span>
                            <span className="text-center">L</span>
                            <span className="text-right">NRR</span>
                            <span className="text-right">Pts</span>
                          </div>
                          <div className="grid min-h-0 flex-1 grid-rows-5">
                            {(() => {
                              const userPosition = standings.findIndex(row => row.teamId === userTeamId);
                              const start = userPosition < 4 ? 0 : userPosition < 7 ? 3 : 5;
                              return standings.slice(start, start + 5).map((row, index) => {
                                const position = start + index + 1;
                                return (
                                  <div key={row.teamId} className={`grid min-h-0 grid-cols-[1fr_1.4rem_1.4rem_3rem_2rem] items-center gap-1 border-b border-[#16130f]/10 text-[10px] ${row.teamId === userTeamId ? "font-bold text-accent" : "text-text-primary"}`}>
                                    <span className="truncate"><span className="mr-1 font-space-mono text-text-secondary">{position}.</span>{row.shortName}</span>
                                    <span className="text-center font-space-mono">{row.won}</span>
                                    <span className="text-center font-space-mono">{row.lost}</span>
                                    <span className="text-right font-space-mono">{row.nrr >= 0 ? "+" : ""}{row.nrr.toFixed(2)}</span>
                                    <span className="text-right font-space-mono">{row.points}</span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSubTab === "social" && (
                <SocialMediaPage
                  team={userTeam}
                  players={players}
                  playerStats={playerStats}
                  battingFirstXI={battingFirstXI}
                  bowlingFirstXI={bowlingFirstXI}
                  fixtures={detailedFixtures}
                  captainId={teamLeadership.captainId}
                  impactPlayerIds={[battingFirstImpactPlayerId, bowlingFirstImpactPlayerId]}
                  currentDate={currentDate}
                  currentSeason={currentSeason}
                />
              )}

              {activeSubTab === "news" && (
                <NewsPage
                  userTeamId={userTeamId}
                  players={players}
                  teams={teams}
                  playerStats={playerStats}
                  standings={standings}
                  retirements={lastCareerRetirements}
                  retirementHistory={careerRetirementHistory}
                  retiredPlayerSnapshots={retiredPlayerSnapshots}
                  currentSeason={currentSeason}
                  fixtures={detailedFixtures}
                  currentDate={currentDate}
                  clubFigureProgression={clubFigureProgression}
                  onViewAllFixtures={() => {
                    setActiveTab("season");
                    _setActiveSubTab("fixtures");
                    router.push("/game/overview?tab=season&subtab=fixtures", { scroll: false });
                  }}
                />
              )}

              {/* Inbox page */}
              {activeSubTab === "inbox" && (
                <div className="grid h-full flex-1 min-h-0 grid-cols-1 overflow-hidden rounded-xl border border-border bg-surface shadow-[0_18px_50px_rgba(22,19,15,0.08)] lg:grid-cols-[minmax(19rem,0.92fr)_minmax(0,2.2fr)]">
                  <aside className="flex min-h-0 flex-col border-r border-border bg-bg/45">
                    <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--ink)] text-bg shadow-sm">
                          <InboxIcon size={19} strokeWidth={1.9} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="font-anton text-[18px] uppercase leading-none text-text-primary">Inbox</h2>
                          <p className="mt-1 whitespace-nowrap font-space-mono text-[6px] font-bold uppercase tracking-[0.08em] text-text-secondary">
                            {inboxThreads.length} conversations
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={markAllInboxRead}
                          disabled={!inbox.some((message) => message.unread)}
                          className="whitespace-nowrap rounded border border-border bg-surface px-1.5 py-1.5 font-space-mono text-[6px] font-bold uppercase tracking-normal text-text-secondary transition-colors enabled:hover:border-accent enabled:hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Mark all as read
                        </button>
                        <span className={`whitespace-nowrap rounded-full px-1.5 py-1 font-space-mono text-[6px] font-bold uppercase tracking-normal ${inbox.some((message) => message.unread) ? "bg-danger text-white shadow-sm" : "bg-success/10 text-success"}`}>
                          {inbox.filter((message) => message.unread).length} unread
                        </span>
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                      {inboxThreads.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/70 p-8 text-center">
                          <MailOpen size={28} className="mb-3 text-text-secondary/35" aria-hidden="true" />
                          <div className="text-xs font-barlow text-text-secondary">No messages.</div>
                        </div>
                      ) : (
                        inboxThreads.map((thread) => {
                          const isSelected = selectedThread?.threadId === thread.threadId;
                          return (
                            <button
                              key={thread.threadId}
                              id={`email-thread-${thread.threadId}`}
                              onClick={() => markThreadRead(thread.threadId, thread.latest.id)}
                              className={`group relative flex w-full gap-3 rounded-lg border p-3 text-left transition-all duration-150 ${
                                isSelected
                                  ? "border-accent/50 bg-surface shadow-[0_5px_18px_rgba(22,19,15,0.08)]"
                                  : thread.unreadCount > 0
                                    ? "border-accent/20 bg-accent/[0.045] hover:border-accent/45 hover:bg-surface"
                                    : "border-transparent hover:border-border hover:bg-surface/80"
                              }`}
                            >
                              {thread.unreadCount > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-accent shadow-sm" aria-label={`${thread.unreadCount} unread`} />}
                              <span className={`flex size-9 shrink-0 items-center justify-center rounded-full font-space-mono text-[10px] font-bold uppercase ${
                                isSelected || thread.unreadCount > 0
                                  ? "bg-[var(--ink)] text-bg"
                                  : "bg-black/[0.055] text-text-secondary dark:bg-white/[0.07]"
                              }`}>
                                {thread.latest.sender.slice(0, 1)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2 pr-3">
                                  <span className={`min-w-0 flex-1 truncate font-space-mono text-[9px] uppercase tracking-wide ${thread.unreadCount > 0 ? "font-extrabold text-text-primary" : "font-bold text-text-secondary"}`}>
                                    {thread.latest.sender}
                                  </span>
                                  <span className="shrink-0 font-space-mono text-[8px] text-text-secondary/80">{thread.latest.date}</span>
                                </span>
                                <span className={`mt-1 block truncate text-[12px] leading-snug text-text-primary ${thread.unreadCount > 0 ? "font-extrabold" : "font-semibold"}`}>
                                  {thread.latest.subject}
                                </span>
                                <span className="mt-1 block truncate text-[10px] leading-snug text-text-secondary">{thread.latest.preview}</span>
                                <span className="mt-2 flex items-center gap-1.5">
                                  <span className="rounded-full border border-border/80 bg-bg/60 px-2 py-0.5 font-space-mono text-[7px] font-bold uppercase tracking-wide text-text-secondary">
                                    {thread.latest.category}
                                  </span>
                                  {thread.messages.length > 1 && (
                                    <span className="rounded-full bg-black/[0.055] px-2 py-0.5 font-space-mono text-[7px] font-bold text-text-secondary dark:bg-white/[0.07]">
                                      {thread.messages.length}
                                    </span>
                                  )}
                                  {thread.latest.requiresAction && (
                                    <span className={`rounded-full px-2 py-0.5 font-space-mono text-[7px] font-bold uppercase tracking-wide ${thread.latest.actionCompleted ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                                      {thread.latest.actionCompleted ? "Complete" : "Action"}
                                    </span>
                                  )}
                                </span>
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </aside>

                  <section className="flex h-full min-h-0 flex-col overflow-hidden bg-bg/25">
                    {selectedThread ? (
                      <>
                        <div className="flex min-h-[58px] shrink-0 items-center justify-between border-b border-border bg-surface px-5 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-bg text-text-secondary">
                              <MailOpen size={15} strokeWidth={1.8} aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <div className="font-space-mono text-[8px] font-bold uppercase tracking-[0.16em] text-text-secondary">Conversation</div>
                              <div className="mt-0.5 truncate text-[11px] font-semibold text-text-primary">{selectedThread.latest.subject}</div>
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full border border-border bg-bg/70 px-2.5 py-1 font-space-mono text-[8px] font-bold text-text-secondary">
                            {selectedThread.messages.length} {selectedThread.messages.length === 1 ? "message" : "messages"}
                          </span>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-5">
                          <div className="mx-auto flex max-w-5xl flex-col gap-4">
                            {selectedThread.messages.map((msg) => (
                              <article key={msg.id} className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_8px_28px_rgba(22,19,15,0.055)]">
                                <header className="border-b border-border/80 bg-bg/35 px-6 py-5">
                                  <div className="flex items-start gap-3">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] font-space-mono text-[11px] font-bold uppercase text-bg shadow-sm" aria-hidden="true">
                                      {msg.sender.slice(0, 1)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate font-barlow text-[14px] font-bold text-text-primary">{msg.sender}</div>
                                      <div className="mt-0.5 font-space-mono text-[8px] uppercase tracking-wide text-text-secondary">
                                        To <span className="font-bold text-text-primary/75">You</span>
                                      </div>
                                    </div>
                                    <time
                                      dateTime={msg.date}
                                      className="shrink-0 rounded-md border border-border/80 bg-surface px-2.5 py-1.5 text-right font-space-mono text-[8px] font-bold uppercase tracking-wide text-text-secondary"
                                    >
                                      {dateKeyToLocalDate(msg.date).toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </time>
                                  </div>
                                  <h2 className="mt-5 max-w-4xl font-anton text-[25px] uppercase leading-tight tracking-[0.015em] text-text-primary">{msg.subject}</h2>
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">{msg.category}</span>
                                    {msg.priority !== "normal" && (
                                      <span className={`rounded-full px-2.5 py-1 font-space-mono text-[7px] font-bold uppercase tracking-wider ${msg.priority === "urgent" ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"}`}>
                                        {msg.priority}
                                      </span>
                                    )}
                                    {msg.requiresAction && (
                                      <span className={`rounded-full px-2.5 py-1 font-space-mono text-[7px] font-bold uppercase tracking-wider ${msg.actionCompleted ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                                        {msg.actionCompleted ? "Completed" : "Action required"}
                                      </span>
                                    )}
                                  </div>
                                </header>
                                <div className="max-w-4xl whitespace-pre-line px-6 py-6 font-barlow text-[14px] leading-7 text-text-secondary">{msg.body}</div>
                              </article>
                            ))}
                          </div>
                        </div>

                        <div className="flex min-h-[62px] shrink-0 items-center justify-between gap-3 border-t border-border bg-surface px-5 py-3 shadow-[0_-8px_24px_rgba(22,19,15,0.035)]">
                          <span className="font-space-mono text-[8px] font-bold uppercase tracking-[0.15em] text-text-secondary/70">Email actions</span>
                          <div className="flex items-center gap-2">
                            {selectedThread.latest.actions.length > 0 ? (
                              selectedThread.latest.actions.map((action) => (
                                <button
                                  key={`${selectedThread.latest.id}:${action.label}`}
                                  type="button"
                                  onClick={() => handleEmailAction(action)}
                                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--ink)] bg-[var(--ink)] px-3.5 py-2 font-space-mono text-[8px] font-bold uppercase tracking-wider text-bg shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:bg-accent"
                                >
                                  {action.label}
                                  <ArrowUpRight size={12} aria-hidden="true" />
                                </button>
                              ))
                            ) : (
                              <span className="rounded-full border border-border bg-bg/60 px-3 py-1.5 font-space-mono text-[8px] uppercase tracking-wider text-text-secondary/60">No actions for this email</span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center text-text-secondary">
                          <span className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-border bg-surface shadow-sm">
                            <MailOpen size={28} className="text-text-secondary/35" aria-hidden="true" />
                          </span>
                          <span className="font-anton text-[18px] uppercase text-text-primary">Select a message to read</span>
                          <span className="mt-2 max-w-xs text-[11px] leading-relaxed text-text-secondary">Choose a conversation from the inbox to open it here.</span>
                        </div>
                        <div className="flex min-h-[62px] shrink-0 items-center border-t border-border bg-surface px-5 py-3">
                          <span className="font-space-mono text-[8px] uppercase tracking-wider text-text-secondary/60">Email actions</span>
                        </div>
                      </>
                    )}
                  </section>
                </div>
              )}

              {/* Calendar page */}
              {activeSubTab === "calendar" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full h-full flex-1 min-h-0 overflow-hidden">
                  {/* Left part: Calendar Grid */}
                  <div className="lg:col-span-2 bg-surface border-2 border-border p-5 flex flex-col h-full overflow-hidden">
                    <div className="flex flex-col h-full">
                      {/* Calendar Header with switcher */}
                      <div className="flex justify-between items-center mb-4 border-b border-[#16130f]/10 pb-3 shrink-0">
                        <div>
                          <h3 className="font-anton text-[20px] text-text-primary uppercase leading-none">{currentSeason} Season Calendar</h3>
                          <span className="font-space-mono text-[9px] text-text-secondary uppercase mt-1">December {currentSeason - 1} to November {currentSeason}</span>
                        </div>
                        <div className="flex items-center gap-3 bg-[#16130f]/5 px-3 py-1.5 border border-border rounded">
                          <button
                            onClick={() => {
                              setCalendarMonthIndex(index => index - 1);
                              setSelectedCalendarDay(1);
                              setPendingSkipTargetDate(null);
                            }}
                            disabled={calendarMonthIndex === 0}
                            className="text-text-primary hover:text-accent disabled:opacity-30 disabled:pointer-events-none font-bold text-xs uppercase transition-all"
                          >
                            ←
                          </button>
                          <span className="font-space-mono text-[10px] font-bold uppercase min-w-[90px] text-center">
                            {currentCalendarMonth.label} {currentCalendarMonth.year}
                          </span>
                          <button
                            onClick={() => {
                              setCalendarMonthIndex(index => index + 1);
                              setSelectedCalendarDay(1);
                              setPendingSkipTargetDate(null);
                            }}
                            disabled={calendarMonthIndex === CALENDAR_MONTHS.length - 1}
                            className="text-text-primary hover:text-accent disabled:opacity-30 disabled:pointer-events-none font-bold text-xs uppercase transition-all"
                          >
                            →
                          </button>
                        </div>
                      </div>

                      {/* Weekday Labels */}
                      <div className="grid grid-cols-7 gap-1 text-center font-space-mono text-[9px] font-bold text-text-secondary uppercase mb-2 shrink-0">
                        <div>Sun</div>
                        <div>Mon</div>
                        <div>Tue</div>
                        <div>Wed</div>
                        <div>Thu</div>
                        <div>Fri</div>
                        <div>Sat</div>
                      </div>

                      {/* Days Grid: Stretch to fill layout without scrollbars */}
                      <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-0">
                        {/* Render empty leading cells */}
                        {Array.from({ length: calendarFirstWeekday }).map((_, idx) => (
                          <div key={`empty-${idx}`} className="w-full h-full bg-[#16130f]/2 border border-dashed border-border/20 rounded-md" />
                        ))}

                        {/* Render days */}
                        {Array.from({ length: calendarDaysInMonth }).map((_, idx) => {
                          const day = idx + 1;
                          const isSelected = selectedCalendarDay === day;
                          const dateString = `${currentCalendarMonth.year}-${String(currentCalendarMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                          const {
                            dayMatches,
                            hasAuction,
                            hasRetention: hasRetentionDeadline,
                            hasUserMatch,
                            isAnnouncement: isAnnouncementDay,
                            isTradeWindowOpening,
                            isTradeWindowClosing,
                            isPreAnnouncementOpeningMatch,
                          } = getCalendarDayData(dateString);
                          const unselectedDayStateClass = isAnnouncementDay || isTradeWindowOpening || isTradeWindowClosing
                            ? "border-success bg-success/5 ring-2 ring-success/20"
                            : isPreAnnouncementOpeningMatch
                              ? "border-accent bg-accent/5 ring-2 ring-accent/25"
                              : hasAuction || hasRetentionDeadline || hasUserMatch
                                ? "border-border bg-surface ring-2 ring-accent/30"
                                : "border-border bg-surface";

                          return (
                            <button
                              key={`day-${day}`}
                              type="button"
                              aria-pressed={isSelected}
                              aria-label={`${isSelected ? "Selected: " : ""}${day} ${currentCalendarMonth.label} ${currentCalendarMonth.year}`}
                              onClick={() => {
                                setSelectedCalendarDay(day);
                                setPendingSkipTargetDate(null);
                              }}
                              style={isSelected ? {
                                backgroundColor: CALENDAR_SELECTED_COLOR,
                                borderColor: "#1d4ed8",
                                boxShadow: "inset 0 0 0 2px #1e3a8a, 0 3px 10px rgba(22, 19, 15, 0.28)",
                              } : undefined}
                              className={`relative flex h-full w-full flex-col justify-between rounded-md border-2 p-2 text-left transition-all duration-150 hover:border-accent
                                ${isSelected
                                  ? "z-10 text-white"
                                  : unselectedDayStateClass}`}
                            >
                              <div className="flex justify-between items-center w-full">
                                <span className={`font-space-mono text-[11px] font-bold transition-colors ${
                                  isSelected
                                    ? "flex size-6 items-center justify-center rounded-full bg-white text-[#1d4ed8] shadow-sm"
                                    : "text-text-primary"
                                }`}>
                                  {day}
                                </span>
                                <span className="flex items-center gap-1">
                                  {isSelected && (
                                    <span className="rounded-sm bg-white/95 px-1.5 py-0.5 font-space-mono text-[6px] font-bold uppercase tracking-wide text-[#1d4ed8]">
                                      Selected
                                    </span>
                                  )}
                                  {hasUserMatch && (
                                    <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${isSelected ? "bg-white" : "bg-accent"}`} />
                                  )}
                                </span>
                              </div>

                              {/* Mini match labels */}
                              {dayMatches.length > 0 && (
                                <div className="mt-1 space-y-0.5 w-full shrink-0">
                                  {dayMatches.map(m => {
                                    const isUserGame = m.teamA === userTeamId || m.teamB === userTeamId;
                                    const opponentId = m.teamA === userTeamId ? m.teamB : m.teamA;
                                    const opp = teams[opponentId];
                                    const knockoutLabel = getKnockoutStageLabel(m);
                                    const hasUnresolvedPlayoffTeam = [m.teamA, m.teamB].some(
                                      (teamId) => !teamId || teamId === PLAYOFF_TBD_TEAM_ID || teamId.includes("TBD"),
                                    );

                                    return (
                                      <div
                                        key={m.id}
                                        className={`w-full text-[9px] py-1 px-1 rounded text-center truncate font-space-mono font-bold leading-tight uppercase
                                          ${isUserGame 
                                            ? "text-white"
                                            : isSelected
                                              ? "border border-white/40 bg-white/15 text-white"
                                              : "bg-[#16130f]/5 border border-border/40 text-text-primary"}`}
                                        style={isUserGame && userTeam ? { backgroundColor: userTeam.primaryColor, color: userTeam.secondaryColor } : undefined}
                                      >
                                        {knockoutLabel && hasUnresolvedPlayoffTeam ? (
                                          <span>{knockoutLabel}</span>
                                        ) : isUserGame ? (
                                          <div className="flex flex-col items-center justify-center gap-1 py-0.5 leading-none">
                                            <span 
                                              className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full border border-white/10 shadow-sm leading-none shrink-0"
                                              style={opp ? { backgroundColor: opp.primaryColor, color: opp.secondaryColor } : undefined}
                                            >
                                              vs {opp?.shortName ?? opponentId}
                                            </span>
                                            <span className="text-[7.5px] font-bold mt-0.5 opacity-90">
                                              {m.played ? "FINAL" : "PLAYING"}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="flex items-center justify-center gap-0.5">
                                            <span
                                              className="calendar-team-name"
                                              style={{ "--calendar-team-color": teams[m.teamA]?.primaryColor ?? "#777777" } as CSSProperties}
                                            >
                                              {teams[m.teamA]?.shortName ?? m.teamA}
                                            </span>
                                            <span className="text-text-secondary font-medium"> v </span>
                                            <span
                                              className="calendar-team-name"
                                              style={{ "--calendar-team-color": teams[m.teamB]?.primaryColor ?? "#777777" } as CSSProperties}
                                            >
                                              {teams[m.teamB]?.shortName ?? m.teamB}
                                            </span>
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Large, bold, readable event badge */}
                              {(hasAuction || hasRetentionDeadline || isAnnouncementDay || isTradeWindowOpening || isTradeWindowClosing || isPreAnnouncementOpeningMatch) && (
                                <div className="w-full text-[9px] font-anton tracking-wider uppercase mt-1 leading-none">
                                  {hasAuction && <span className="text-success block">AUCTION</span>}
                                  {hasRetentionDeadline && <span className="text-danger block">RETENTION</span>}
                                  {isAnnouncementDay && <span className="text-success block bg-success/15 border border-success/30 py-1 px-1.5 rounded text-center">FIXTURES</span>}
                                  {isTradeWindowOpening && <span className="text-success block bg-success/15 border border-success/30 py-1 px-1.5 rounded text-center">TRADES OPEN</span>}
                                  {isTradeWindowClosing && <span className="text-warning block bg-warning/15 border border-warning/30 py-1 px-1.5 rounded text-center">TRADES CLOSE</span>}
                                  {isPreAnnouncementOpeningMatch && <span className="text-accent block bg-accent/15 border border-accent/40 py-1 px-1.5 rounded text-center">SEASON OPENER</span>}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right part: Detail Inspector Panel */}
                  <div className="flex h-full min-h-0 flex-col gap-2">
                    <div className="order-2 min-h-0 flex-1 overflow-y-auto border-2 border-border bg-surface p-5">
                      <div>
                      <h4 className="font-anton text-[16px] text-text-primary uppercase border-b border-[#16130f]/10 pb-2 mb-4">
                        Details: {selectedCalendarDay} {currentCalendarMonth.label} {currentCalendarMonth.year}
                      </h4>

                      {(() => {
                        const dateString = `${currentCalendarMonth.year}-${String(currentCalendarMonth.month + 1).padStart(2, "0")}-${String(selectedCalendarDay).padStart(2, "0")}`;
                        const isRetentionDay = dateString === retentionDateString;
                        const isAuctionDay = dateString === auctionDateString;
                        const isAnnouncementDay = dateString === formattedAnnouncementDate;
                        const isTradeWindowOpening = dateString === calendarTradeWindow?.startsOn;
                        const isTradeWindowClosing = dateString === calendarTradeWindow?.endsOn;

                        if (!isFixturesAnnounced) {
                          const isTournamentMonth = currentCalendarMonth.month === 2 || currentCalendarMonth.month === 3 || currentCalendarMonth.month === 4;
                          return (
                            <div className="space-y-4">
                              {isRetentionDay && (
                                <div className="border border-danger/20 bg-danger/5 rounded p-3">
                                  <span className="font-space-mono text-[9px] bg-danger text-white px-2 py-0.5 rounded font-bold uppercase">Retention Deadline</span>
                                  <p className="mt-2 text-xs text-text-secondary">Franchises must submit their retained players list by today.</p>
                                </div>
                              )}
                              {isAuctionDay && (
                                <div className="border border-success/20 bg-success/5 rounded p-3">
                                  <span className="font-space-mono text-[9px] bg-success text-white px-2 py-0.5 rounded font-bold uppercase">Player Auction</span>
                                  <p className="mt-2 text-xs text-text-secondary">The Player Auction takes place today. Teams will complete their squads.</p>
                                </div>
                              )}
                              {isAnnouncementDay && (
                                <div className="border border-success/20 bg-success/5 rounded p-3">
                                  <span className="font-space-mono text-[9px] bg-success text-white px-2 py-0.5 rounded font-bold uppercase">Schedule Announcement</span>
                                  <p className="mt-2 text-xs text-text-secondary">The complete fixture list and match schedule for the new season are officially announced today!</p>
                                </div>
                              )}
                              {isTradeWindowOpening && (
                                <div className="rounded border border-success/20 bg-success/5 p-3"><span className="rounded bg-success px-2 py-0.5 font-space-mono text-[9px] font-bold uppercase text-white">Trade Window Opens</span><p className="mt-2 text-xs text-text-secondary">The trade window is now open. Clubs can configure and complete player trades until {calendarTradeWindow?.endsOn}.</p></div>
                              )}
                              {isTradeWindowClosing && (
                                <div className="rounded border border-warning/20 bg-warning/5 p-3"><span className="rounded bg-warning px-2 py-0.5 font-space-mono text-[9px] font-bold uppercase text-white">Trade Window Closes</span><p className="mt-2 text-xs text-text-secondary">The trade window closes today. This is the final day to complete player trades this season.</p></div>
                              )}
                              {dateString === openingMatchDateString && (
                                <div className="border border-accent/30 bg-accent/10 rounded p-3">
                                  <span className="font-space-mono text-[9px] bg-accent text-white px-2 py-0.5 rounded font-bold uppercase">Season Opener</span>
                                  <h5 className="font-anton text-[14px] uppercase text-text-primary mt-1.5">IPL Opening Match (Match 1)</h5>
                                  <p className="mt-1 text-xs text-text-secondary">
                                    The first match of the {currentSeason} season takes place today. Teams &amp; fixture details will be published on schedule announcement day ({userFriendlyAnnouncementDate}).
                                  </p>
                                </div>
                              )}
                              {isTournamentMonth && !isAnnouncementDay && dateString !== openingMatchDateString && (
                                <div className="border border-border/60 bg-[#16130f]/5 rounded p-3 text-center py-6">
                                  <span className="font-space-mono text-[9px] bg-[#16130f]/10 text-text-secondary px-2 py-0.5 rounded font-bold uppercase">Locked</span>
                                  <p className="mt-3 text-xs text-text-secondary">League fixtures have not been announced yet.</p>
                                  <p className="mt-1 text-[11px] font-bold text-accent">Schedule release: {userFriendlyAnnouncementDate}</p>
                                </div>
                              )}
                              {!isRetentionDay && !isAuctionDay && !isAnnouncementDay && !isTradeWindowOpening && !isTradeWindowClosing && !isTournamentMonth && (
                                <div className="text-xs font-barlow text-text-secondary py-8 text-center">
                                  No calendar events recorded for this day.
                                </div>
                              )}
                            </div>
                          );
                        }

                        const dayMatches = fixturesByDate.get(dateString) ?? [];
                        if (dayMatches.length === 0 && !isRetentionDay && !isAuctionDay && !isAnnouncementDay && !isTradeWindowOpening && !isTradeWindowClosing) {
                          return (
                            <div className="text-xs font-barlow text-text-secondary py-8 text-center">
                              No calendar events recorded for this day.
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-4">
                            {isRetentionDay && (
                              <div className="border border-danger/20 bg-danger/5 rounded p-3">
                                <span className="font-space-mono text-[9px] bg-danger text-white px-2 py-0.5 rounded font-bold uppercase">Retention Deadline</span>
                                <p className="mt-2 text-xs text-text-secondary">Franchises must submit their retained players list by today.</p>
                              </div>
                            )}
                            {isAuctionDay && (
                              <div className="border border-success/20 bg-success/5 rounded p-3">
                                <span className="font-space-mono text-[9px] bg-success text-white px-2 py-0.5 rounded font-bold uppercase">Player Auction</span>
                                <p className="mt-2 text-xs text-text-secondary">The Player Auction takes place today. Teams will complete their squads.</p>
                              </div>
                            )}
                            {isAnnouncementDay && (
                              <div className="border border-success/20 bg-success/5 rounded p-3">
                                <span className="font-space-mono text-[9px] bg-success text-white px-2 py-0.5 rounded font-bold uppercase">Schedule Announcement</span>
                                <p className="mt-2 text-xs text-text-secondary">The complete fixture list and match schedule for the new season are officially announced today!</p>
                              </div>
                            )}
                            {isTradeWindowOpening && (
                              <div className="rounded border border-success/20 bg-success/5 p-3"><span className="rounded bg-success px-2 py-0.5 font-space-mono text-[9px] font-bold uppercase text-white">Trade Window Opens</span><p className="mt-2 text-xs text-text-secondary">The trade window is now open. Clubs can configure and complete player trades until {calendarTradeWindow?.endsOn}.</p></div>
                            )}
                            {isTradeWindowClosing && (
                              <div className="rounded border border-warning/20 bg-warning/5 p-3"><span className="rounded bg-warning px-2 py-0.5 font-space-mono text-[9px] font-bold uppercase text-white">Trade Window Closes</span><p className="mt-2 text-xs text-text-secondary">The trade window closes today. This is the final day to complete player trades this season.</p></div>
                            )}
                            {dayMatches.map((m) => {
                              const isUserGame = m.teamA === userTeamId || m.teamB === userTeamId;
                              const knockoutLabel = getKnockoutStageLabel(m);
                              const teamAName = teams[m.teamA]?.name
                                ?? (m.teamA === PLAYOFF_TBD_TEAM_ID ? "To be determined" : m.teamA);
                              const teamBName = teams[m.teamB]?.name
                                ?? (m.teamB === PLAYOFF_TBD_TEAM_ID ? "To be determined" : m.teamB);
                              const teamAShortName = teams[m.teamA]?.shortName
                                ?? (m.teamA === PLAYOFF_TBD_TEAM_ID ? "TBD" : m.teamA.slice(0, 3));
                              const teamBShortName = teams[m.teamB]?.shortName
                                ?? (m.teamB === PLAYOFF_TBD_TEAM_ID ? "TBD" : m.teamB.slice(0, 3));
                              return (
                                <div
                                  key={m.id}
                                  className={`border-2 rounded p-3 flex flex-col justify-between transition-colors
                                    ${isUserGame ? "border-accent bg-accent/5" : "border-border bg-surface"}`}
                                >
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="font-space-mono text-[9px] font-bold text-text-secondary uppercase">
                                      {knockoutLabel ?? `Match ${m.matchNumber}`} · {m.time}
                                    </span>
                                    {isUserGame && (
                                      <span
                                        className="font-space-mono text-[8px] font-bold px-1.5 py-0.5 rounded text-white"
                                        style={userTeam ? { backgroundColor: userTeam.primaryColor, color: userTeam.secondaryColor } : undefined}
                                      >
                                        YOUR MATCH
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-xs font-bold text-text-primary gap-4">
                                    <div className="flex items-center gap-2 flex-1 truncate">
                                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ backgroundColor: teams[m.teamA]?.primaryColor ?? "#ccc", color: teams[m.teamA]?.secondaryColor ?? "#000" }}>
                                        {teamAShortName.slice(0, 3)}
                                      </span>
                                      <span className="truncate">{teamAName}</span>
                                    </div>
                                    <span className="text-text-secondary font-normal font-space-mono text-[9px] shrink-0">vs</span>
                                    <div className="flex items-center gap-2 flex-row-reverse flex-1 truncate">
                                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ backgroundColor: teams[m.teamB]?.primaryColor ?? "#ccc", color: teams[m.teamB]?.secondaryColor ?? "#000" }}>
                                        {teamBShortName.slice(0, 3)}
                                      </span>
                                      <span className="truncate text-right">{teamBName}</span>
                                    </div>
                                  </div>
                                  {m.played && m.scoreA && m.scoreB && (
                                    <div className="mt-3 pt-2 border-t border-border/40 flex justify-between items-center text-xs font-space-mono">
                                      <span className="text-text-secondary">Result:</span>
                                      <span className="font-bold text-success">
                                        {m.winner === userTeamId ? "YOU WON" : `${teams[m.winner ?? ""]?.name} won`}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                      </div>
                    </div>
                    {pendingSkipTargetDate ? (
                      <div className="order-1 flex min-h-9 w-full shrink-0 items-center gap-2 border border-accent bg-accent/5 px-2 py-1.5">
                        <span className="min-w-0 flex-1 font-space-mono text-[8px] font-bold uppercase leading-relaxed text-text-primary">
                          {countUserFixturesBeforeCalendarDate(pendingSkipTargetDate) > 0
                            ? `${countUserFixturesBeforeCalendarDate(pendingSkipTargetDate)} ${
                                countUserFixturesBeforeCalendarDate(pendingSkipTargetDate) === 1 ? "match" : "matches"
                              } will take place before this date. Continuing will automatically simulate ${
                                countUserFixturesBeforeCalendarDate(pendingSkipTargetDate) === 1 ? "it" : "them"
                              } with the same pitch-aware selection and tactics preparation used by AI teams before continuing to ${dateKeyToLocalDate(pendingSkipTargetDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.`
                            : `Simulate to ${dateKeyToLocalDate(pendingSkipTargetDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}?`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPendingSkipTargetDate(null)}
                          className="border border-border px-2 py-1 font-space-mono text-[8px] font-bold uppercase text-text-secondary hover:text-text-primary"
                        >
                          Cancel
                        </button>
                        {countUserFixturesBeforeCalendarDate(pendingSkipTargetDate) > 0 ? (
                          <button
                            type="button"
                            onClick={() => skipToCalendarDate(pendingSkipTargetDate, true)}
                            className="border border-[var(--ink)] bg-[var(--ink)] px-2 py-1 font-space-mono text-[8px] font-bold uppercase text-bg"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => skipToCalendarDate(pendingSkipTargetDate)}
                            className="border border-[var(--ink)] bg-[var(--ink)] px-2 py-1 font-space-mono text-[8px] font-bold uppercase text-bg"
                          >
                            Confirm
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingSkipTargetDate(selectedCalendarDateString)}
                        disabled={!canSkipToSelectedCalendarDate || isSimulatingDays || isTickerAtImpasse}
                        className="order-1 w-full shrink-0 border border-border bg-surface py-6 font-space-mono text-[9px] font-bold uppercase tracking-widest text-text-primary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isTickerAtImpasse
                          ? "Play your fixture first"
                          : selectedCalendarDateString === currentDate
                          ? "Current date"
                          : selectedCalendarDateString < currentDate
                            ? "Date has passed"
                            : "Skip to this date"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ==================================================================
              MAIN TAB: CLUB
              ================================================================== */}
          {activeTab === "club" && (
            <>
              {activeSubTab === "overview" && (
                <div className="grid min-h-[500px] grid-cols-1 gap-4 lg:h-[calc(100vh-200px)] lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)_minmax(280px,.8fr)] lg:grid-rows-3 lg:overflow-hidden">
                  <ClubProfileSummaryTile
                    team={userTeam}
                    season={currentSeason}
                    headCoach={userHeadCoach ? userHeadCoach.fullName : null}
                    mentor={userMentor ? userMentor.fullName : null}
                    captain={teamLeadership.captainId ? players[teamLeadership.captainId] ?? null : null}
                    viceCaptain={teamLeadership.viceCaptainId ? players[teamLeadership.viceCaptainId] ?? null : null}
                    featuredPlayers={clubFeaturedPlayers}
                  />
                  <ManagerOfficeSummaryTile onOpen={() => setActiveSubTab("office")} />
                  {userHomeStadium && userSelectedPitch && (
                    <PitchCuratorSummaryTile
                      stadiumName={userHomeStadium.name}
                      pitchName={userSelectedPitch.name}
                      pitchCount={userHomeStadium.pitches.length + userCustomPitches.length}
                      scoreRange={`${userSelectedPitch.expectedFirstInningsScore.min}–${userSelectedPitch.expectedFirstInningsScore.max}`}
                      onOpen={() => setActiveSubTab("pitchcurator")}
                    />
                  )}
                  {userHomeStadium && (
                    <StadiumManagementSummaryTile
                      stadiumName={userHomeStadium.name}
                      capacity={userHomeStadium.capacity}
                      straightMetres={userBoundaryDimensions.straightMetres}
                      wideMetres={userBoundaryDimensions.wideMetres}
                      outfieldSpeed={userOutfieldImpact?.label ?? userHomeStadium.outfield.speed}
                      onOpen={() => setActiveSubTab("stadiummanagement")}
                    />
                  )}
                </div>
              )}

              {activeSubTab === "office" && (() => {
                const userOwnership = getClubOwnership(userTeamId);
                const expectedRanks = calculateStaffExpectedRanks({
                  teamIds: Object.keys(teams),
                  teams,
                  players,
                  staffState: careerStaff,
                  previousSeason: null,
                });
                const expectedPos = expectedRanks.overall[userTeamId] ?? 3;
                const userStandingIdx = standings.findIndex((row) => row.teamId === userTeamId);
                const realPos = userStandingIdx >= 0 ? userStandingIdx + 1 : 1;
                const posDiff = expectedPos - realPos;
                const patienceMod = userOwnership.patience_modifier;

                const rawPressure = calculateSeasonUnderperformancePressure(expectedPos, realPos);
                const effectivePressure = calculateEffectiveJobPressure({
                  rawPressure,
                  teamId: userTeamId,
                  ownershipPatienceModifier: patienceMod,
                });
                const securityState = getStaffJobSecurityState(effectivePressure);

                const strokeOffset = 251.2 * (1 - effectivePressure / 100);

                const securityBadgeClasses: Record<string, { label: string; color: string }> = {
                  secure: { label: "SECURE", color: "text-emerald-500" },
                  stable: { label: "STABLE", color: "text-emerald-400" },
                  under_scrutiny: { label: "UNDER SCRUTINY", color: "text-amber-400" },
                  under_pressure: { label: "UNDER PRESSURE", color: "text-amber-500" },
                  serious_risk: { label: "SERIOUS RISK", color: "text-rose-400" },
                  expected_dismissal: { label: "EXPECTED DISMISSAL", color: "text-rose-500" },
                  immediate_dismissal: { label: "IMMEDIATE DISMISSAL", color: "text-red-600" },
                };

                const activeSecurity = securityBadgeClasses[securityState] ?? securityBadgeClasses.secure;

                return (
                  <div className="grid h-full min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Left Column: 3-Section Expected Position Bar */}
                    <div className="flex flex-col justify-between border-2 border-border bg-surface p-5 shadow-sm">
                      <div>
                        <div className="flex items-center justify-between border-b border-[#16130f]/10 pb-2">
                          <h3 className="font-anton text-[16px] uppercase text-text-primary">BOARD EXPECTATION & STANDING</h3>
                          <span className="font-space-mono text-[9px] font-bold uppercase text-accent">
                            {userOwnership.consortium_name}
                          </span>
                        </div>

                        {/* 3-Section Bar: Expected Position | Difference | Real Position */}
                        <div className="mt-8 grid grid-cols-3 gap-2 rounded border border-border/70 bg-background/50 p-4 text-center">
                          {/* Section 1: Expected Position */}
                          <div className="flex flex-col items-center justify-center border-r border-border/60 pr-2">
                            <span className="font-space-mono text-[9px] font-bold uppercase tracking-wider text-text-secondary">EXPECTED</span>
                            <span className="mt-1.5 font-anton text-2xl uppercase text-accent">#{expectedPos}</span>
                          </div>

                          {/* Section 2: Difference in Positions */}
                          <div className="flex flex-col items-center justify-center border-r border-border/60 px-2">
                            <span className="font-space-mono text-[9px] font-bold uppercase tracking-wider text-text-secondary">DIFFERENCE</span>
                            <span className={`mt-1.5 font-anton text-2xl uppercase ${posDiff >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                              {posDiff > 0 ? `+${posDiff}` : posDiff}
                            </span>
                          </div>

                          {/* Section 3: Real Position */}
                          <div className="flex flex-col items-center justify-center pl-2">
                            <span className="font-space-mono text-[9px] font-bold uppercase tracking-wider text-text-secondary">REAL POSITION</span>
                            <span className="mt-1.5 font-anton text-2xl uppercase text-text-primary">#{realPos}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Head Coach Security & Pressure Gauge */}
                    <div className="flex flex-col items-center justify-between border-2 border-border bg-surface p-5 shadow-sm">
                      <h3 className="w-full border-b border-[#16130f]/10 pb-2 text-center font-anton text-[16px] uppercase text-text-primary">
                        HEAD COACH JOB SECURITY
                      </h3>

                      <div className="relative flex h-48 w-48 items-center justify-center my-2">
                        <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" stroke="rgba(22,19,15,.1)" strokeWidth="8" fill="transparent" />
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            stroke={effectivePressure >= 65 ? "#ef4444" : effectivePressure >= 35 ? "#f59e0b" : "var(--success)"}
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={251.2}
                            strokeDashoffset={strokeOffset}
                            strokeLinecap="round"
                            className="transition-all duration-500"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="font-anton text-[36px] leading-none text-text-primary">{effectivePressure}%</span>
                          <span className={`mt-1 font-space-mono text-[9px] font-bold uppercase ${activeSecurity.color}`}>
                            {activeSecurity.label}
                          </span>
                        </div>
                      </div>

                      <div className="w-full rounded border border-border/80 bg-background/50 p-3 text-center">
                        <span className="font-space-mono text-[9px] uppercase text-text-secondary">Sacking Threat Level</span>
                        <div className={`mt-1 font-anton text-sm uppercase ${activeSecurity.color}`}>
                          {effectivePressure < 35 ? "No Immediate Dismissal Risk" : effectivePressure < 65 ? "Board Warning Sent by CEO" : "Critical Job Security Risk"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {activeSubTab === "board" && (
                <BoardOverviewPage teamId={userTeamId} mode="club" />
              )}

              {activeSubTab === "supporters" && userTeam && (
                <SupportersPage
                  team={userTeam}
                  fixtures={supporterFixtures}
                  standingPosition={Math.max(0, standings.findIndex((standing) => standing.teamId === userTeamId)) + 1}
                  squadPlayers={userTeam.squad.map((playerId) => players[playerId]).filter((player): player is Player => Boolean(player))}
                  playerStats={Object.fromEntries(Object.entries(playerStats).map(([playerId, stats]) => [playerId, {
                    matches: stats.matches,
                    runs: stats.runs,
                    wickets: stats.wickets,
                    strikeRate: stats.balls > 0 ? stats.runs / stats.balls * 100 : undefined,
                    economy: stats.oversBowled > 0 ? stats.runsConceded / stats.oversBowled : undefined,
                    runsConceded: stats.runsConceded,
                    oversBowled: stats.oversBowled,
                    catches: stats.catches,
                    stumpings: stats.stumpings,
                    runOuts: stats.runOuts,
                  }]))}
                  staff={userSupporterStaff}
                  ownership={getClubOwnership(userTeamId)}
                  captainId={teamLeadership.captainId}
                  viceCaptainId={teamLeadership.viceCaptainId}
                  activeInjuryCount={userTeam.squad.filter((playerId) => Boolean(activeInjuries[playerId])).length}
                  clubEvents={supporterClubEvents}
                  departmentReviews={careerStaff.performanceReviews
                    .filter((review) => review.teamId === userTeamId)
                    .map((review) => ({
                      season: review.season,
                      expectedPosition: review.expectedPosition,
                      finalPosition: review.finalPosition,
                      wonTitle: review.wonTitle,
                      batting: review.departments.batting,
                      bowling: review.departments.bowling,
                      fielding: review.departments.fielding,
                    }))}
                  boardContext={{
                    annualStaffBudget: careerStaff.financesByTeam[userTeamId]?.annualBudget,
                    committedStaffSalary: careerStaff.financesByTeam[userTeamId]?.committedSalary,
                    compensationPaid: careerStaff.financesByTeam[userTeamId]?.compensationPaid,
                    activeProjects: Number(Boolean(userPitchProject)) + Number(Boolean(userOutfieldProject)),
                  }}
                  currentSeason={currentSeason}
                  onOpenPlayer={setDetailedPlayerId}
                />
              )}

              {activeSubTab === "staffmanagement" && (
                <StaffManagementPage teams={Object.values(teams)} mode="club" />
              )}

              {activeSubTab === "pitchcurator" && (
                <PitchCuratorPage
                  teamId={userTeamId}
                  teamName={userTeam?.name ?? userTeamId}
                  currentDate={currentDate}
                  selectedPitchId={userSelectedPitch?.id ?? ""}
                  boundaryDimensions={
                    userBoundaryDimensions
                  }
                  customPitches={userCustomPitches}
                  project={userPitchProject}
                  onSelectPitch={(pitchId) => setHomePitchSelection(userTeamId, pitchId)}
                  onCreatePitch={(soil, sliders) => startPitchCreation(userTeamId, soil, sliders)}
                  onDestroyPitch={(pitchId) => startPitchDestruction(userTeamId, pitchId)}
                />
              )}

              {activeSubTab === "stadiummanagement" && userHomeStadium && userSelectedPitch && userOutfieldSettings && (
                <StadiumManagementPage
                  teamId={userTeamId}
                  teamName={userTeam?.name ?? userTeamId}
                  dimensions={userBoundaryDimensions}
                  presets={userBoundaryPresets}
                  currentPitchName={userSelectedPitch.name}
                  currentPitchScoreRange={userSelectedPitch.expectedFirstInningsScore}
                  currentDate={currentDate}
                  outfieldSettings={userOutfieldSettings}
                  outfieldProject={userOutfieldProject}
                  onApplyDimensions={(nextDimensions) => {
                    setHomeBoundaryDimensions(userTeamId, nextDimensions);
                  }}
                  onSavePreset={(name, nextDimensions) => (
                    saveBoundaryPreset(userTeamId, name, nextDimensions)
                  )}
                  onApplyPreset={(presetId) => applyBoundaryPreset(userTeamId, presetId)}
                  onDeletePreset={(presetId) => deleteBoundaryPreset(userTeamId, presetId)}
                  onStartOutfieldPreparation={(settings) => (
                    startOutfieldPreparation(userTeamId, settings)
                  )}
                />
              )}
            </>
          )}

          {/* ==================================================================
              MAIN TAB: SQUAD
              ================================================================== */}
          {activeTab === "squad" && (
            <>
              {/* Squad Overview tab */}
              {activeSubTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
                  <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_7.75rem] gap-3">
                    {/* Roster overview */}
                    <div onClick={() => setActiveSubTab("roster")} className="squad-overview-tile flex min-h-0 cursor-pointer flex-col overflow-hidden rounded-lg border-2 border-border bg-surface p-5 transition-colors hover:border-accent">
                    <div className="flex items-end justify-between gap-3 border-b border-[#16130f]/10 pb-2 mb-3 shrink-0">
                      <h4 className="squad-overview-title whitespace-nowrap font-anton uppercase">SQUAD OVERVIEW</h4>
                      <div className="squad-overview-summary min-w-0 truncate font-space-mono text-text-secondary uppercase">
                        {userTeam.squad.length} Players · {userTeam.overseasPlayersCurrent} Overseas
                      </div>
                    </div>
                    <div className="squad-overview-grid squad-overview-heading grid gap-2 border-b border-[#16130f]/10 pb-1.5 font-space-mono font-bold text-text-secondary uppercase shrink-0">
                      <span>Player</span>
                      <span className="text-center">Age</span>
                      <span className="text-center">Role</span>
                      <span className="squad-overview-ability-grid grid">
                        <span className="text-center">CA</span>
                        <span aria-hidden="true" />
                        <span className="text-center">PA</span>
                      </span>
                    </div>

                    <div ref={squadOverviewListRef} className="min-h-0 flex-1 overflow-hidden">
                      {userTeam.squad
                        .map(id => players[id])
                        .filter(Boolean)
                        .slice(0, visibleSquadOverviewCount)
                        .map(player => (
                          <div
                            key={player.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setDetailedPlayerId(player.id);
                            }}
                            className="squad-overview-grid squad-overview-row grid h-11 items-center gap-2 border-b border-[#16130f]/10 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                          >
                            <span className="flex min-w-0 items-center gap-1">
                              <span className="min-w-0 truncate font-semibold text-text-primary">{player.name}</span>
                              {player.nationality === "Overseas" && (
                                <span
                                  className="shrink-0 rounded-[2px] px-1 py-0.5 font-space-mono text-[7px] font-bold leading-none text-white"
                                  style={{ backgroundColor: userTeam.primaryColor }}
                                >
                                  OS
                                </span>
                              )}
                            </span>
                            <span className="text-center font-space-mono text-text-secondary">{player.age}</span>
                            <span className="squad-overview-role truncate text-center font-space-mono uppercase text-text-secondary">{player.role}</span>
                            <span className="squad-overview-ability-grid grid items-center">
                              {player.role === "All-Rounder" ? (
                                <>
                                  <span
                                    className="squad-overview-allrounder-rating flex flex-col items-center text-center font-space-mono font-bold leading-tight text-text-primary"
                                    title={`Batting ${player.currentBatting}, Bowling ${player.currentBowling}`}
                                  >
                                    <span className="whitespace-nowrap">Bat {player.currentBatting}</span>
                                    <span className="whitespace-nowrap">Bowl {player.currentBowling}</span>
                                  </span>
                                  <span aria-hidden="true" />
                                  <span
                                    className="squad-overview-allrounder-rating flex flex-col items-center text-center font-space-mono font-bold leading-tight text-text-primary"
                                    title={`Batting ${player.potentialBatting}, Bowling ${player.potentialBowling}`}
                                  >
                                    <span className="whitespace-nowrap">Bat {player.potentialBatting}</span>
                                    <span className="whitespace-nowrap">Bowl {player.potentialBowling}</span>
                                  </span>
                                </>
                              ) : player.role === "Pace Bowler" || player.role === "Spin Bowler" ? (
                                <>
                                  <span className="squad-overview-rating text-center font-space-mono font-bold text-text-primary">{player.currentBowling}</span>
                                  <span aria-hidden="true" />
                                  <span className="squad-overview-rating text-center font-space-mono font-bold text-text-primary">{player.potentialBowling}</span>
                                </>
                              ) : (
                                <>
                                  <span className="squad-overview-rating text-center font-space-mono font-bold text-text-primary">{player.currentBatting}</span>
                                  <span aria-hidden="true" />
                                  <span className="squad-overview-rating text-center font-space-mono font-bold text-text-primary">{player.potentialBatting}</span>
                                </>
                              )}
                            </span>
                          </div>
                        ))}
                      {userTeam.squad.length > visibleSquadOverviewCount && (
                        <div className="flex h-7 items-center justify-center font-space-mono text-[9px] font-bold uppercase text-text-secondary">
                          + {userTeam.squad.length - visibleSquadOverviewCount} players
                        </div>
                      )}
                    </div>
                    </div>

                    {/* Squad analysis */}
                    {(() => {
                      const squadPlayers = userTeam.squad
                        .map((id) => players[id])
                        .filter((player): player is Player => Boolean(player));
                      const averageAge = squadPlayers.length > 0
                        ? squadPlayers.reduce((total, player) => total + player.age, 0) / squadPlayers.length
                        : 0;
                      const elitePlayers = squadPlayers.filter((player) => getPlayerRating(player) >= 80).length;
                      const growthPlayers = squadPlayers.filter((player) => (
                        Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0)
                        > getPlayerRating(player)
                      )).length;

                      return (
                        <button
                          type="button"
                          onClick={() => setActiveSubTab("analysis")}
                          className="group flex min-h-0 flex-col justify-between overflow-hidden rounded-lg border-2 border-border bg-surface p-3 text-left transition-all hover:border-accent hover:shadow-md"
                        >
                          <div className="flex items-center justify-between border-b border-[#16130f]/10 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent">
                                <Activity size={14} aria-hidden="true" />
                              </span>
                              <div>
                                <h4 className="font-anton text-[14px] uppercase leading-none text-text-primary">Squad Analysis</h4>
                                <p className="mt-1 font-space-mono text-[7px] font-bold uppercase tracking-wide text-text-secondary">
                                  Depth, development and balance
                                </p>
                              </div>
                            </div>
                            <span className="flex items-center gap-1 font-space-mono text-[8px] font-bold uppercase text-accent">
                              Open <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-2">
                            {[
                              ["Average age", averageAge.toFixed(1)],
                              ["80+ players", elitePlayers],
                              ["Growth players", growthPlayers],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded border border-border/60 bg-bg/40 px-2 py-1.5">
                                <div className="font-anton text-[15px] leading-none text-text-primary">{value}</div>
                                <div className="mt-1 truncate font-space-mono text-[6.5px] font-bold uppercase text-text-secondary">{label}</div>
                              </div>
                            ))}
                          </div>
                        </button>
                      );
                    })()}
                  </div>

                  <div className="grid h-full min-h-0 grid-cols-[1fr_1fr] gap-3">
                    {/* Playing XIs Preview Tile */}
                    {(() => {
                      const batFirstSub = (battingFirstImpactPlayerId && players[battingFirstImpactPlayerId])
                        || (battingFirstImpactSubs.length > 0 && players[battingFirstImpactSubs[0]])
                        || null;
                      const bowlFirstSub = (bowlingFirstImpactPlayerId && players[bowlingFirstImpactPlayerId])
                        || (bowlingFirstImpactSubs.length > 0 && players[bowlingFirstImpactSubs[0]])
                        || null;
                      const batFirstOS = battingFirstXI.filter((id) => players[id]?.nationality === "Overseas").length;
                      const bowlFirstOS = bowlingFirstXI.filter((id) => players[id]?.nationality === "Overseas").length;
                      const batFirstStarters = battingFirstXI.map((id) => players[id]).filter((p): p is Player => Boolean(p));
                      const bowlFirstStarters = bowlingFirstXI.map((id) => players[id]).filter((p): p is Player => Boolean(p));

                      const lineupPlans = [
                        {
                          key: "bat-first",
                          label: "Bat First XI",
                          ids: battingFirstXI,
                          starters: batFirstStarters,
                          overseas: batFirstOS,
                          impact: batFirstSub,
                          dotClass: "bg-[#d87945]",
                          textClass: "text-[#b5572f] dark:text-[#e58a5c]",
                          washClass: "bg-[#d87945]/[0.045]",
                        },
                        {
                          key: "bowl-first",
                          label: "Bowl First XI",
                          ids: bowlingFirstXI,
                          starters: bowlFirstStarters,
                          overseas: bowlFirstOS,
                          impact: bowlFirstSub,
                          dotClass: "bg-[#4f8fd7]",
                          textClass: "text-[#326da9] dark:text-[#6aa5e5]",
                          washClass: "bg-[#4f8fd7]/[0.045]",
                        },
                      ];

                      return (
                        <button
                          type="button"
                          onClick={() => setActiveSubTab("playingxi")}
                          className="group col-span-1 flex h-full min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-surface p-3 text-left transition-all hover:border-accent hover:shadow-md"
                        >
                          <div className="mb-2 flex shrink-0 items-center justify-between border-b border-[#16130f]/10 pb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-anton text-[14px] uppercase leading-none text-text-primary">Playing XIs</h4>
                              <span className="rounded-full bg-accent/15 px-2 py-0.5 font-space-mono text-[8px] font-bold uppercase text-[#9a6b12] dark:text-accent">
                                Matchday
                              </span>
                            </div>
                            <span className="font-space-mono text-[9px] font-bold uppercase text-accent group-hover:underline">
                              Manage XIs →
                            </span>
                          </div>

                          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2.5">
                            {lineupPlans.map((plan) => (
                              <div key={plan.key} className={`flex min-h-0 flex-col overflow-hidden rounded-md border border-border/70 ${plan.washClass}`}>
                                <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-surface/75 px-2 py-1.5">
                                  <span className={`flex items-center gap-1.5 font-space-mono text-[8px] font-extrabold uppercase tracking-wide ${plan.textClass}`}>
                                    <span className={`size-1.5 shrink-0 rounded-full ${plan.dotClass}`} />
                                    {plan.label}
                                  </span>
                                  <span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                                    {plan.ids.length}/11 · {plan.overseas}/4 OS
                                  </span>
                                </div>

                                <div className="grid min-h-0 flex-1 grid-rows-11 divide-y divide-border/45">
                                  {Array.from({ length: 11 }, (_, index) => {
                                    const player = plan.starters[index];
                                    return (
                                      <div key={`${plan.key}-${index}`} className="grid min-h-0 grid-cols-[1.15rem_minmax(0,1fr)_auto] items-center gap-1.5 px-2">
                                        <span className={`font-space-mono text-[7px] font-extrabold tabular-nums ${player ? plan.textClass : "text-text-secondary/45"}`}>
                                          {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <span className={`flex min-w-0 items-center gap-1 text-[9px] leading-none ${player ? "font-semibold text-text-primary" : "font-medium italic text-text-secondary/45"}`}>
                                          <span className="truncate">{player ? player.name : "Empty slot"}</span>
                                          {player && <InjuryStatusMarker injury={activeInjuries[player.id]} />}
                                        </span>
                                        {player && (
                                          <span className="flex shrink-0 items-center gap-1">
                                            {player.id === teamLeadership?.captainId && <span className="font-space-mono text-[6px] font-extrabold text-accent">C</span>}
                                            {player.id === teamLeadership?.viceCaptainId && <span className="font-space-mono text-[6px] font-extrabold text-accent">VC</span>}
                                            {player.nationality === "Overseas" && <span className="size-1 rounded-full bg-accent" title="Overseas player" />}
                                            <span className="font-space-mono text-[6.5px] font-bold uppercase text-text-secondary">{getCompactPlayerRole(player.role)}</span>
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 bg-surface/75 px-2 py-1 font-space-mono text-[7px] uppercase text-text-secondary">
                                  <span className="shrink-0">Impact</span>
                                  <strong className="truncate text-right text-text-primary">{plan.impact ? plan.impact.name : "Auto"}</strong>
                                </div>
                              </div>
                            ))}
                          </div>
                        </button>
                      );
                    })()}

                    {/* Right Column: Stacks Tactics, Captaincy, and Injury Hub vertically */}
                    <div className="flex h-full min-h-0 flex-col gap-3">
                      {/* Team Tactics Preview Tile */}
                    <button
                      type="button"
                      onClick={() => setActiveSubTab("tactics")}
                      className="group flex min-h-0 flex-col justify-between overflow-hidden rounded-lg border-2 border-border bg-surface p-3 text-left transition-all hover:border-accent hover:shadow-md"
                      style={{ flex: "1.5 1 0%" }}
                    >
                      <div>
                        <div className="mb-2 flex items-center justify-between border-b border-[#16130f]/10 pb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-anton text-[14px] uppercase text-text-primary">Team Tactics</h4>
                            <span className="rounded bg-accent/15 px-1.5 py-0.5 font-space-mono text-[10px] font-bold text-accent uppercase">
                              {teamTactics.preset}
                            </span>
                          </div>
                          <span className="font-space-mono text-[10px] font-bold uppercase text-accent group-hover:underline">
                            Edit Tactics →
                          </span>
                        </div>

                        <div className="space-y-1.5 font-space-mono text-[9px]">
                          {/* Batting Strategy */}
                          <div className="rounded border border-border/50 bg-black/[0.02] p-1.5 dark:bg-white/[0.02]">
                            <div className="font-bold uppercase text-text-secondary text-[8.5px] mb-1 tracking-wider">Batting Approach</div>
                            <div className="grid grid-cols-3 gap-1">
                              <div>PP: <span className="font-bold text-text-primary capitalize">{teamTactics.batting.powerplay}</span></div>
                              <div>MID: <span className="font-bold text-text-primary capitalize">{teamTactics.batting.middle}</span></div>
                              <div>DEATH: <span className="font-bold text-text-primary capitalize">{teamTactics.batting.death}</span></div>
                            </div>
                          </div>

                          {/* Bowling Strategy */}
                          <div className="rounded border border-border/50 bg-black/[0.02] p-1.5 dark:bg-white/[0.02]">
                            <div className="font-bold uppercase text-text-secondary text-[8.5px] mb-1 tracking-wider">Bowling Approach</div>
                            <div className="grid grid-cols-3 gap-1">
                              <div>PP: <span className="font-bold text-text-primary capitalize">{teamTactics.bowling.powerplay}</span></div>
                              <div>MID: <span className="font-bold text-text-primary capitalize">{teamTactics.bowling.middle}</span></div>
                              <div>DEATH: <span className="font-bold text-text-primary capitalize">{teamTactics.bowling.death}</span></div>
                            </div>
                          </div>

                          {/* Preferences summary */}
                          <div className="flex items-center justify-between pt-0.5 text-[9.5px] text-text-secondary">
                            <span>Toss: <strong className="text-text-primary capitalize">{teamTactics.tossPreference}</strong></span>
                            <span>Impact: <strong className="text-text-primary capitalize">{teamTactics.impactPolicy.replace("-", " ")}</strong></span>
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Captaincy Preview Tile */}
                    {(() => {
                      const captain = teamLeadership?.captainId ? players[teamLeadership.captainId] : null;
                      const viceCaptain = teamLeadership?.viceCaptainId ? players[teamLeadership.viceCaptainId] : null;
                      const appointments = [
                        {
                          key: "captain",
                          label: "Captain",
                          player: captain,
                          icon: Crown,
                          iconClass: "bg-accent text-[#16130f]",
                          borderClass: captain ? "border-accent/45" : "border-border/60",
                        },
                        {
                          key: "vice-captain",
                          label: "Vice-captain",
                          player: viceCaptain,
                          icon: ShieldCheck,
                          iconClass: "bg-success/[0.14] text-success",
                          borderClass: viceCaptain ? "border-success/40" : "border-border/60",
                        },
                      ];

                      return (
                        <button
                          type="button"
                          onClick={() => setActiveSubTab("captaincy")}
                          className="group flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-surface p-3 text-left transition-all hover:border-accent hover:shadow-md"
                          style={{ flex: "1 1 0%" }}
                        >
                          <div className="mb-2 flex shrink-0 items-center justify-between border-b border-[#16130f]/10 pb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-anton text-[14px] uppercase leading-none text-text-primary">Captaincy</h4>
                              <span className="rounded-full bg-success/10 px-2 py-0.5 font-space-mono text-[8px] font-bold uppercase text-success">
                                Leadership
                              </span>
                            </div>
                            <span className="font-space-mono text-[9px] font-bold uppercase text-accent group-hover:underline">
                              Manage →
                            </span>
                          </div>

                          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
                            {appointments.map((appointment) => {
                              const LeaderIcon = appointment.icon;
                              return (
                                <div key={appointment.key} className={`flex min-w-0 flex-col justify-between rounded-md border bg-bg/35 p-2 ${appointment.borderClass}`}>
                                  <div className="flex items-center gap-2">
                                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${appointment.iconClass}`}>
                                      <LeaderIcon size={13} strokeWidth={2} aria-hidden="true" />
                                    </span>
                                    <span className="font-space-mono text-[7px] font-extrabold uppercase tracking-[0.12em] text-text-secondary">
                                      {appointment.label}
                                    </span>
                                  </div>
                                  {appointment.player ? (
                                    <div className="mt-2 min-w-0">
                                      <div className="truncate text-[11px] font-bold leading-none text-text-primary">{appointment.player.name}</div>
                                      <div className="mt-1 truncate font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                                        {getCompactPlayerRole(appointment.player.role)} · Captaincy {appointment.player.captaincy ?? 50}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mt-2 text-[10px] font-semibold leading-none text-text-secondary">Not appointed</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </button>
                      );
                    })()}

                    {/* Injury Hub Preview Tile */}
                    {(() => {
                      const scopedActive = Object.values(activeInjuries).filter((injury) => (
                        players[injury.playerId]?.currentTeamId === userTeam.id || injury.teamId === userTeam.id
                      ));
                      const majorCount = scopedActive.filter((injury) => injury.category === "major").length;
                      const minorCount = scopedActive.filter((injury) => injury.category === "minor").length;
                      const recoveredCount = injuryHistory.filter((injury) => (
                        injury.teamId === userTeam.id
                      )).length;

                      return (
                        <button
                          type="button"
                          onClick={() => setActiveSubTab("injuryhub")}
                          className="group flex min-h-0 flex-col justify-between overflow-hidden rounded-lg border-2 border-border bg-surface p-2.5 text-left transition-all hover:border-accent hover:shadow-md"
                          style={{ flex: "0.7 1 0%" }}
                        >
                          <div className="mb-1.5 flex shrink-0 items-center justify-between border-b border-[#16130f]/10 pb-1.5 w-full">
                            <div className="flex items-center gap-1.5">
                              <span className="flex size-6 items-center justify-center rounded-full bg-danger/15 text-danger">
                                <Activity size={12} aria-hidden="true" />
                              </span>
                              <div>
                                <h4 className="font-anton text-[13px] uppercase leading-none text-text-primary">Injury Hub</h4>
                                <p className="mt-0.5 font-space-mono text-[6.5px] font-bold uppercase tracking-wide text-text-secondary">
                                  Squad availability & physical condition
                                </p>
                              </div>
                            </div>
                            <span className="font-space-mono text-[8px] font-bold uppercase text-accent group-hover:underline">
                              Open Hub →
                            </span>
                          </div>

                          <div className="grid grid-cols-4 gap-1.5 w-full">
                            <div className="rounded border border-border/60 bg-bg/40 px-1.5 py-1 text-center">
                              <div className="font-anton text-[14px] leading-none text-text-primary">{scopedActive.length}</div>
                              <div className="mt-0.5 truncate font-space-mono text-[6px] font-bold uppercase text-text-secondary">Active</div>
                            </div>
                            <div className="rounded border border-border/60 bg-bg/40 px-1.5 py-1 text-center">
                              <div className="font-anton text-[14px] leading-none text-amber-600 dark:text-amber-300">{minorCount}</div>
                              <div className="mt-0.5 truncate font-space-mono text-[6px] font-bold uppercase text-text-secondary">Minor</div>
                            </div>
                            <div className="rounded border border-border/60 bg-bg/40 px-1.5 py-1 text-center">
                              <div className="font-anton text-[14px] leading-none text-danger">{majorCount}</div>
                              <div className="mt-0.5 truncate font-space-mono text-[6px] font-bold uppercase text-text-secondary">Major</div>
                            </div>
                            <div className="rounded border border-border/60 bg-bg/40 px-1.5 py-1 text-center">
                              <div className="font-anton text-[14px] leading-none text-success">{recoveredCount}</div>
                              <div className="mt-0.5 truncate font-space-mono text-[6px] font-bold uppercase text-text-secondary">Recovered</div>
                            </div>
                          </div>
                        </button>
                      );
                    })()}
                    </div>
                  </div>

                </div>
              )}

              {/* Roster Overview page */}
              {activeSubTab === "roster" && (
                <div className="border-2 border-border bg-surface h-full flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
                    <div><h3 className="font-anton text-[18px] uppercase text-text-primary">Squad Analysis</h3><p className="font-space-mono text-[8px] uppercase tracking-wider text-text-secondary">Every column sorts both directions</p></div>
                    <div className="flex rounded border border-border bg-bg/50 p-1">
                      {(["general", "bowling", "batting", "ipl"] as RosterView[]).map((view) => (
                        <button key={view} type="button" onClick={() => { setRosterView(view); setRosterSort({ key: "name", direction: "asc" }); }} className={`rounded px-3 py-1.5 font-space-mono text-[9px] font-bold uppercase tracking-wider ${rosterView === view ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary"}`}>
                          {view === "ipl" ? "IPL Career" : view}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto flex-1 overflow-y-auto">
                    <table className="w-full min-w-[850px] text-left font-barlow text-xs divide-y divide-[#16130f]/10">
                      <thead className="sticky top-0 z-10 bg-surface text-[9px] font-space-mono text-text-secondary uppercase shadow-sm">
                        <tr>{rosterColumns.map((column) => (
                          <th key={column.key} className="px-5 py-3.5" aria-sort={rosterSort.key === column.key ? (rosterSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                            <button type="button" onClick={() => toggleRosterSort(column.key)} className={`flex w-full items-center gap-1 hover:text-accent ${column.align === "center" ? "justify-center" : column.align === "right" ? "justify-end" : "justify-start"}`}>
                              {column.label} <span aria-hidden="true">{rosterSortIndicator(column.key)}</span>
                            </button>
                          </th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-[#16130f]/10">
                        {sortedRosterPlayers.map((player) => (
                          <tr key={player.id} onClick={() => setDetailedPlayerId(player.id)} className="cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                            {rosterColumns.map((column, index) => (
                              <td key={column.key} className={`px-5 py-4 font-space-mono text-[10px] ${column.align === "center" ? "text-center" : column.align === "right" ? "text-right" : "text-left"} ${index === 0 ? "font-barlow text-xs font-semibold text-text-primary" : "text-text-secondary"}`}>
                                {column.render(player)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <table className="hidden w-full text-left font-barlow text-xs divide-y divide-[#16130f]/10">
                      <thead className="bg-[#16130f]/5 text-[9px] font-space-mono text-text-secondary uppercase">
                        <tr>
                          <th className="px-6 py-3.5" aria-sort={rosterSort.key === "name" ? (rosterSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                            <button type="button" onClick={() => toggleRosterSort("name")} className="flex w-full items-center gap-1 text-left hover:text-accent">
                              Name <span aria-hidden="true">{rosterSortIndicator("name")}</span>
                            </button>
                          </th>
                          <th className="px-6 py-3.5" aria-sort={rosterSort.key === "role" ? (rosterSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                            <button type="button" onClick={() => toggleRosterSort("role")} className="flex w-full items-center gap-1 text-left hover:text-accent">
                              Role <span aria-hidden="true">{rosterSortIndicator("role")}</span>
                            </button>
                          </th>
                          <th className="px-6 py-3.5" aria-sort={rosterSort.key === "nationality" ? (rosterSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                            <button type="button" onClick={() => toggleRosterSort("nationality")} className="flex w-full items-center gap-1 text-left hover:text-accent">
                              Nationality <span aria-hidden="true">{rosterSortIndicator("nationality")}</span>
                            </button>
                          </th>
                          <th className="px-6 py-3.5" aria-sort={rosterSort.key === "rating" ? (rosterSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                            <button type="button" onClick={() => toggleRosterSort("rating")} className="flex w-full items-center justify-center gap-1 hover:text-accent">
                              Rating <span aria-hidden="true">{rosterSortIndicator("rating")}</span>
                            </button>
                          </th>
                          <th className="px-6 py-3.5" aria-sort={rosterSort.key === "salary" ? (rosterSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                            <button type="button" onClick={() => toggleRosterSort("salary")} className="flex w-full items-center justify-end gap-1 hover:text-accent">
                              {rosterSeason} Salary <span aria-hidden="true">{rosterSortIndicator("salary")}</span>
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#16130f]/10">
                        {sortedRosterPlayers.map(p => {
                          const currentSalaryEntry = currentSeasonHistoryByPlayer.get(p.id);
                          const acquisitionLabel = p.isRetained
                            ? " (Retained)"
                            : currentSalaryEntry?.isInjuryReplacement
                              ? " (Injury replacement)"
                            : currentSalaryEntry?.isRtm
                              ? " (RTM)"
                              : "";
                          return (
                            <tr
                              key={p.id}
                              onClick={() => setDetailedPlayerId(p.id)}
                              className="hover:bg-black/5 cursor-pointer transition-colors"
                            >
                              <td className="px-6 py-4 font-semibold text-text-primary flex items-center gap-2">
                                {p.name}
                                {battingFirstXI.includes(p.id) && bowlingFirstXI.includes(p.id) ? (
                                  <span className="rounded bg-success/20 px-1.5 py-0.5 font-space-mono text-[8px] font-bold text-success">BOTH XI</span>
                                ) : battingFirstXI.includes(p.id) ? (
                                  <span className="rounded bg-[#d87945]/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold text-[#b5572f]">BAT XI</span>
                                ) : bowlingFirstXI.includes(p.id) ? (
                                  <span className="rounded bg-[#4f8fd7]/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold text-[#326da9]">BOWL XI</span>
                                ) : null}
                                {(battingFirstImpactSubs.includes(p.id) || bowlingFirstImpactSubs.includes(p.id)) && (
                                  <span className="rounded bg-accent/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold text-[#9a6b12] dark:text-accent">IMPACT</span>
                                )}
                              </td>
                              <td className="px-6 py-4 font-space-mono text-[10px] uppercase text-text-secondary">{p.role}</td>
                              <td className="px-6 py-4 text-text-secondary">{p.nationality}</td>
                              <td className="px-6 py-4 text-center font-bold text-success font-space-mono text-[11px]">{getPlayerRating(p)}</td>
                              <td className="px-6 py-4 text-right font-space-mono text-[10px] text-text-primary">
                                {currentSalaryEntry ? `${formatPrice(currentSalaryEntry.price)}${acquisitionLabel}` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Squad Analysis page */}
              {activeSubTab === "analysis" && (
                <SquadAnalysisPage
                  userTeam={userTeam}
                  teams={teams}
                  players={players}
                  onOpenPlayer={setDetailedPlayerId}
                />
              )}

              {/* Playing XI page */}
              {activeSubTab === "playingxi" && (
                <TacticsLineupBuilder
                  team={userTeam}
                  players={players}
                  battingFirstXI={battingFirstXI}
                  bowlingFirstXI={bowlingFirstXI}
                  battingFirstImpactSubs={battingFirstImpactSubs}
                  bowlingFirstImpactSubs={bowlingFirstImpactSubs}
                  battingFirstImpactPlayerId={battingFirstImpactPlayerId}
                  battingFirstOutgoingPlayerId={battingFirstOutgoingPlayerId}
                  battingFirstImpactBattingPosition={battingFirstImpactBattingPosition}
                  bowlingFirstImpactPlayerId={bowlingFirstImpactPlayerId}
                  bowlingFirstOutgoingPlayerId={bowlingFirstOutgoingPlayerId}
                  bowlingFirstImpactBattingPosition={bowlingFirstImpactBattingPosition}
                  captainId={teamLeadership?.captainId}
                  viceCaptainId={teamLeadership?.viceCaptainId}
                  activeInjuries={activeInjuries}
                  onChangePlan={handleMatchPlanChange}
                  onChangeBothPlans={handleBothMatchPlansChange}
                  onChangeImpactStrategy={handleImpactStrategyChange}
                  onOpenPlayer={setDetailedPlayerId}
                />
              )}

              {activeSubTab === "captaincy" && (
                <CaptaincyPage
                  team={userTeam}
                  players={players}
                  leadership={teamLeadership}
                  gamesPlayed={userGamesPlayed}
                  activeSeason={currentSeason}
                  onChange={handleLeadershipChange}
                  onOpenPlayer={setDetailedPlayerId}
                />
              )}

              {activeSubTab === "tactics" && (
                <TeamTacticsPage
                  tactics={teamTactics}
                  onChange={handleTacticsChange}
                  onOpenPlayingXI={() => setActiveSubTab("playingxi")}
                  coachRecommendation={userTeam && userSelectedPitch && userHeadCoach ? {
                    coachName: userHeadCoach.fullName,
                    tactics: createIntelligentAiTactics(userTeam, userSelectedPitch, careerStaff),
                  } : null}
                />
              )}

              {activeSubTab === "injuryhub" && (
                <InjuryHubPage
                  mode="club"
                  userTeamId={userTeamId}
                  activeInjuries={activeInjuries}
                  injuryHistory={injuryHistory}
                  replacementRecords={injuryReplacementRecords}
                  replacementPoolIds={injuryReplacementPoolIds}
                  currentDate={currentDate}
                  currentSeason={currentSeason}
                  teamFinalLeagueDate={getTeamFinalLeagueDate(userTeamId)}
                  onSignReplacement={handleInjuryReplacementSigning}
                  players={players}
                  teams={teams}
                  seasonFinalDate={fixtures.find((fixture) => fixture.stage === "final")?.date}
                />
              )}

            </>
          )}

          {/* ==================================================================
              MAIN TAB: SCOUTING
              ================================================================== */}
          {activeTab === "scouting" && (
            <>
              {activeSubTab === "assignments" && (
                <ScoutingAssignmentsPage
                  shortlist={shortlist}
                  onToggleShortlist={toggleShortlist}
                />
              )}
              {/* Scouting Overview tab */}
              {activeSubTab === "overview" && (
                <div className="grid h-[calc(100vh-200px)] min-h-[500px] grid-cols-12 grid-rows-[minmax(0,1.55fr)_minmax(0,0.75fr)] gap-4 overflow-hidden">
                  {/* Database search */}
                  <div onClick={() => setActiveSubTab("search")} className="col-span-7 flex min-h-0 cursor-pointer flex-col overflow-hidden rounded-lg border-2 border-border bg-surface p-5 transition-colors hover:border-accent">
                    <h4 className="font-anton text-[14px] uppercase border-b border-[#16130f]/10 pb-2 mb-3 shrink-0">GLOBAL SEARCH</h4>
                    <div className="grid grid-cols-[minmax(0,8rem)_2rem_2.5rem_5.5rem_minmax(0,1fr)] gap-1 border-b border-[#16130f]/10 pb-1.5 font-space-mono text-[10px] font-bold text-text-secondary uppercase shrink-0">
                      <span>Player</span>
                      <span className="text-center">Age</span>
                      <span className="text-center">Team</span>
                      <span className="text-left">Role</span>
                      <span className="grid grid-cols-[7rem_2rem_7rem] justify-center">
                        <span className="text-center">CA</span>
                        <span aria-hidden="true" />
                        <span className="text-center">PA</span>
                      </span>
                    </div>
                    <div ref={scoutingOverviewListRef} className="relative min-h-0 flex-1 overflow-hidden">
                      {bestScoutingPlayers.slice(0, visibleScoutingOverviewCount).map(player => (
                        <div
                          key={player.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDetailedPlayerId(player.id);
                          }}
                          className="grid h-11 grid-cols-[minmax(0,8rem)_2rem_2.5rem_5.5rem_minmax(0,1fr)] items-center gap-1 border-b border-[#16130f]/10 text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                        >
                          <span className="flex min-w-0 items-center gap-1">
                            <span className="truncate font-semibold text-text-primary">{player.name}</span>
                            {player.nationality === "Overseas" && (
                              <span
                                className="shrink-0 rounded-[2px] bg-[#1d55c4] px-1 py-0.5 font-space-mono text-[10px] font-bold leading-none text-white"
                              >
                                OS
                              </span>
                            )}
                          </span>
                          <span className="text-center font-space-mono text-text-secondary">{player.age}</span>
                          <span className="truncate text-center font-space-mono font-bold text-text-secondary">{teams[player.currentTeamId ?? ""]?.shortName ?? "—"}</span>
                          <span className="truncate font-space-mono uppercase text-text-secondary">{player.role}</span>
                          <div className="grid grid-cols-[7rem_2rem_7rem] items-center justify-center">
                            {player.role === "All-Rounder" ? (
                              <>
                                <div className="flex flex-col items-center text-center font-space-mono font-bold leading-tight text-text-primary">
                                  <span className="whitespace-nowrap">Bat {player.currentBatting}</span>
                                  <span className="whitespace-nowrap">Bowl {player.currentBowling}</span>
                                </div>
                                <span aria-hidden="true" />
                                <div className="flex flex-col items-center text-center font-space-mono font-bold leading-tight text-text-primary">
                                  <span className="whitespace-nowrap">Bat {player.potentialBatting}</span>
                                  <span className="whitespace-nowrap">Bowl {player.potentialBowling}</span>
                                </div>
                              </>
                            ) : player.role === "Pace Bowler" || player.role === "Spin Bowler" ? (
                              <>
                                <span className="text-center font-space-mono font-bold text-text-primary">{player.currentBowling}</span>
                                <span aria-hidden="true" />
                                <span className="text-center font-space-mono font-bold text-text-primary">{player.potentialBowling}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-center font-space-mono font-bold text-text-primary">{player.currentBatting}</span>
                                <span aria-hidden="true" />
                                <span className="text-center font-space-mono font-bold text-text-primary">{player.potentialBatting}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      {bestScoutingPlayers.length > visibleScoutingOverviewCount && (
                        <div className="absolute inset-x-0 bottom-0 flex h-7 items-center justify-center bg-surface font-space-mono text-[10px] font-bold uppercase text-text-secondary">
                          + {bestScoutingPlayers.length - visibleScoutingOverviewCount} players
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="contents">
                    <div onClick={() => setActiveSubTab("assignments")} className="col-span-5 flex min-h-0 cursor-pointer flex-col overflow-hidden rounded-lg border-2 border-border bg-surface p-4 transition-colors hover:border-accent">
                      <div className="flex min-h-0 flex-1 flex-col">
                        <div className="flex items-center justify-between border-b border-[#16130f]/10 pb-2"><h4 className="font-anton text-[14px] uppercase">Scouting assignments</h4><span className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">{scoutingAssignments.filter((assignment) => assignment.status === "active").length}/3 active</span></div>
                        <div className="mt-2 grid min-h-0 flex-1 grid-cols-3 items-stretch gap-2">
                          {[1, 2, 3].map((slot) => {
                            const assignment = scoutingAssignments.find((candidate) => candidate.status === "active" && candidate.slot === slot);
                            if (!assignment) return <div key={slot} className="flex min-w-0 flex-col items-center justify-center rounded border border-dashed border-border bg-bg/40 px-2 py-3 text-center"><div className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Scout slot {slot}</div><div className="mt-1 font-space-mono text-[8px] font-bold uppercase text-accent">Available</div></div>;
                            const region = getScoutingRegion(assignment.regionId);
                            const option = SCOUTING_ASSIGNMENT_OPTIONS.find((candidate) => candidate.kind === assignment.kind);
                            const targetReport = assignment.targetReportId ? scoutingReports.find((report) => report.id === assignment.targetReportId) : undefined;
                            const targetPlayer = targetReport ? players[targetReport.playerId] : undefined;
                            const totalDays = assignment.kind === "deep-scout" ? DEEP_SCOUTING_DAYS : option?.days ?? Math.max(daysBetweenDateKeys(assignment.startedOn, assignment.completesOn), 1);
                            const remainingDays = Math.max(daysBetweenDateKeys(currentDate, assignment.completesOn), 0);
                            const progress = Math.min(100, Math.max(0, ((totalDays - remainingDays) / totalDays) * 100));
                            const assignmentLabel = assignment.kind === "deep-scout" ? "In-depth player scout" : option?.label ?? "Scouting assignment";
                            return <div key={slot} className="flex min-w-0 flex-col rounded border border-border bg-bg/40 px-2.5 py-2"><div className="flex items-center justify-between gap-1 font-space-mono text-[7px] font-bold uppercase"><span className="truncate text-accent">Slot {slot} · {assignment.market === "india" ? "India" : "International"}</span><span className="shrink-0 text-text-primary">{remainingDays}d</span></div><div className="mt-1 truncate font-anton text-[12px] uppercase leading-tight text-text-primary">{targetPlayer?.name ?? region?.name ?? assignment.regionId}</div><div className="mt-1 truncate font-space-mono text-[7px] font-bold uppercase text-text-secondary">{assignmentLabel}</div><div className="mt-auto min-w-0 pt-1 font-space-mono text-[7px] uppercase text-text-secondary"><div className="truncate">{region?.depth ?? "Player"} depth · {option?.reportCount ?? 1} report{option?.reportCount === 1 ? "" : "s"}</div><div className="truncate">{totalDays} days · Due {assignment.completesOn}</div></div><div className="mt-1.5 h-1 overflow-hidden rounded bg-border"><div className="h-full bg-accent" style={{ width: `${progress}%` }} /></div></div>;
                          })}
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between font-space-mono text-[9px] font-bold uppercase text-accent"><span>Open interactive maps</span><span>→</span></div>
                    </div>

                    {/* Auction planner */}
                    <div onClick={() => setActiveSubTab("planner")} className="col-span-12 flex min-h-0 cursor-pointer flex-col justify-between overflow-hidden rounded-lg border-2 border-border bg-surface p-4 transition-colors hover:border-accent">
                    <div>
                      <h4 className="font-anton text-[14px] uppercase border-b border-[#16130f]/10 pb-2 mb-4">AUCTION PLANNER</h4>
                      <div className="space-y-2 text-xs font-space-mono text-text-secondary">
                        <div>CAP LIMIT: <span className="font-bold text-text-primary">₹120.00 Cr</span></div>
                        <div>SHORTLISTED: <span className="font-bold text-text-primary">{shortlist.length} Players</span></div>
                      </div>
                    </div>

                    </div>

                  </div>
                </div>
              )}

              {/* Player Search page */}
              {activeSubTab === "search" && (
                <div className="flex flex-col gap-6 h-full flex-1 min-h-0 overflow-hidden">
                  {/* Search filters */}
                  <div className="bg-surface border-2 border-border p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block font-space-mono text-[9px] tracking-widest text-text-secondary uppercase mb-2">Search Name</label>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Type player name..."
                        className="w-full bg-[#16130f]/5 border border-border px-3 py-2 text-xs rounded outline-none text-text-primary focus:border-[var(--ink)]"
                      />
                    </div>
                    <div>
                      <label className="block font-space-mono text-[9px] tracking-widest text-text-secondary uppercase mb-2">Nationality</label>
                      <select
                        value={filterNationality}
                        onChange={(e: any) => setFilterNationality(e.target.value)}
                        className="w-full bg-surface border border-border px-3 py-2 text-xs rounded outline-none text-text-primary"
                      >
                        <option value="all">All Talents</option>
                        <option value="indian_capped">Indian Capped</option>
                        <option value="indian_uncapped">Indian Uncapped</option>
                        <option value="overseas">Overseas</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-space-mono text-[9px] tracking-widest text-text-secondary uppercase mb-2">Role</label>
                      <select
                        value={filterRole}
                        onChange={(e: any) => setFilterRole(e.target.value)}
                        className="w-full bg-surface border border-border px-3 py-2 text-xs rounded outline-none text-text-primary"
                      >
                        <option value="all">All Roles</option>
                        <option value="Batsman">Batter</option>
                        <option value="WK-Batsman">Wicketkeeper-Batter</option>
                        <option value="All-Rounder">All-Rounder</option>
                        <option value="Pace Bowler">Pace Bowler</option>
                        <option value="Spin Bowler">Spin Bowler</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-space-mono text-[9px] tracking-widest text-text-secondary uppercase mb-2">Minimum Rating: {minRating}</label>
                      <input
                        type="range"
                        min="50"
                        max="90"
                        value={minRating}
                        onChange={(e) => setMinRating(parseInt(e.target.value))}
                        className="w-full accent-[var(--ink)]"
                      />
                    </div>
                  </div>

                  {/* Results table */}
                  <div className="border-2 border-border bg-surface flex-1 overflow-y-auto">
                    <table className="w-full text-left font-barlow text-xs divide-y divide-[#16130f]/10">
                      <thead className="bg-[#16130f]/5 text-[9px] font-space-mono text-text-secondary uppercase">
                        <tr>
                          <th className="px-6 py-3.5">Name</th>
                          <th className="px-6 py-3.5">Role</th>
                          <th className="px-6 py-3.5">Nationality</th>
                          <th className="px-6 py-3.5 text-center">Rating</th>
                          <th className="px-6 py-3.5">Current Team</th>
                          <th className="px-6 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#16130f]/10">
                        {filteredSearchList.map(p => (
                          <tr key={p.id} className="hover:bg-black/5 transition-colors">
                            <td className="px-6 py-4 font-semibold text-text-primary">
                              <button
                                type="button"
                                onClick={() => setDetailedPlayerId(p.id)}
                                className="text-left font-semibold text-text-primary underline-offset-2 transition-colors hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                                aria-label={`Open ${p.name}'s player profile`}
                              >
                                {p.name}
                              </button>
                            </td>
                            <td className="px-6 py-4 font-space-mono text-[10px] text-text-secondary uppercase">{p.role}</td>
                            <td className="px-6 py-4 text-text-secondary">{p.nationality}</td>
                            <td className="px-6 py-4 text-center font-bold text-success font-space-mono text-[11px]">{getPlayerRating(p)}</td>
                            <td className="px-6 py-4 text-text-secondary">{p.currentTeamId ? teams[p.currentTeamId]?.shortName : "UNSOLD"}</td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => toggleShortlist(p.id)}
                                className={`px-3 py-1 font-space-mono text-[9px] font-bold border rounded transition-all
                                  ${shortlist.includes(p.id) ? "bg-[var(--ink)] text-bg border-[var(--ink)]" : "border-border text-text-primary hover:bg-black/5"}`}
                              >
                                {shortlist.includes(p.id) ? "Shortlisted ✓" : "Add Shortlist"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Auction Planner page */}
              {activeSubTab === "planner" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full flex-1 min-h-0">
                  {/* Cap details */}
                  <div className="bg-surface border-2 border-border p-5">
                    <h3 className="font-anton text-[16px] text-text-primary uppercase border-b border-[#16130f]/10 pb-2 mb-4">CAP LIMIT DETAILS</h3>
                    <div className="space-y-4 font-space-mono text-xs">
                      <div className="flex justify-between border-b border-[#16130f]/5 pb-1">
                        <span className="text-text-secondary">TOTAL SALARY CAP</span>
                        <span className="font-bold text-text-primary">₹120.00 Cr</span>
                      </div>
                      <div className="flex justify-between border-b border-[#16130f]/5 pb-1">
                        <span className="text-text-secondary">SPENT PURSE</span>
                        <span className="font-bold text-text-primary">₹{(userTeam.spentAmount / 100).toFixed(2)} Cr</span>
                      </div>
                      <div className="flex justify-between border-b border-[#16130f]/5 pb-1">
                        <span className="text-text-secondary">CAP SPACE</span>
                        <span className="font-bold text-accent">₹{(userTeam.remainingPurse / 100).toFixed(2)} Cr</span>
                      </div>
                    </div>
                  </div>

                  {/* Shortlist list */}
                  <div className="bg-surface border-2 border-border p-5 flex flex-col h-full overflow-hidden">
                    <h3 className="font-anton text-[16px] text-text-primary uppercase border-b border-[#16130f]/10 pb-2 mb-4 font-bold shrink-0">SHORTLIST TARGETS</h3>
                    <div className="space-y-3 flex-1 overflow-y-auto pr-2 divide-y divide-[#16130f]/5">
                      {shortlist.length === 0 ? (
                        <div className="text-xs font-barlow text-text-secondary p-4 text-center">Shortlist is empty. Add players from player search.</div>
                      ) : (
                        shortlist.map(id => players[id]).filter(Boolean).map(p => {
                          const scoutingConfidence = getPlayerScoutingConfidence(scoutingReports, p.id);
                          const isFullyScouted = scoutingConfidence >= 100;
                          const scoutingReport = getBestPlayerScoutingReport(scoutingReports, p.id);
                          return (
                          <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                {isFullyScouted ? (
                                  <button
                                    type="button"
                                    onClick={() => setDetailedPlayerId(p.id)}
                                    className="text-left font-bold text-text-primary underline-offset-2 transition-colors hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                                    aria-label={`Open ${p.name}'s player profile`}
                                  >
                                    {p.name}
                                  </button>
                                ) : (
                                  <span className="font-bold text-text-primary">{p.name}</span>
                                )}
                                {!isFullyScouted && (
                                  <span className="font-space-mono text-[8px] font-bold uppercase text-warning">
                                    Player not fully scouted{scoutingConfidence > 0 ? ` (${scoutingConfidence}%)` : ""}
                                  </span>
                                )}
                              </div>
                              <div className="font-space-mono text-[9px] text-text-secondary mt-0.5">
                                RTG: {isFullyScouted
                                  ? getPlayerRating(p)
                                  : scoutingReport
                                    ? `${scoutingReport.currentAbilityRange[0]}–${scoutingReport.currentAbilityRange[1]}`
                                    : "Unknown"} · {p.role.toUpperCase()}
                              </div>
                            </div>
                            <button onClick={() => toggleShortlist(p.id)} className="text-danger font-space-mono text-[9px] font-bold border border-danger/20 rounded px-2.5 py-1 hover:bg-danger/5">
                              Remove
                            </button>
                          </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

            </>
          )}


          {/* ==================================================================
              MAIN TAB: SEASON
              ================================================================== */}
          {activeTab === "season" && (
            <>
              {/* Season Overview tab */}
              {activeSubTab === "overview" && (
                <div className="grid grid-cols-3 gap-6 h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
                  {/* Fixtures progress */}
                  <div onClick={() => isFixturesAnnounced && setActiveSubTab("fixtures")} className={`flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-surface p-5 transition-colors ${isFixturesAnnounced ? "cursor-pointer hover:border-accent" : "opacity-75"}`}>
                    {fixtures.filter((fixture) => !fixture.stage && fixture.matchNumber <= LEAGUE_FIXTURE_COUNT).length > 0
                      && fixtures.filter((fixture) => !fixture.stage && fixture.matchNumber <= LEAGUE_FIXTURE_COUNT).every((fixture) => fixture.played) ? (
                      <ScheduleTileContent
                        fixtures={fixtures}
                        teams={teams}
                        userTeamId={userTeamId}
                        isFixturesAnnounced={isFixturesAnnounced}
                        variant="overview"
                      />
                    ) : (
                    <div className="flex min-h-0 flex-1 flex-col">
                      <div className="mb-3 flex shrink-0 items-end justify-between border-b border-[#16130f]/10 pb-2">
                        <h4 className="font-anton text-[16px] uppercase">SEASON SCHEDULE</h4>
                        {isFixturesAnnounced && (
                          <span className="font-space-mono text-[9px] font-bold uppercase text-text-secondary">
                            {fixtures.filter((fixture) => !fixture.stage && fixture.played).length}/{LEAGUE_FIXTURE_COUNT} league matches played
                          </span>
                        )}
                      </div>
                      {isFixturesAnnounced ? (
                        (() => {
                          const upcomingFixtures = fixtures
                            .filter((fixture) => !fixture.played)
                            .sort((left, right) => (left.date ?? "").localeCompare(right.date ?? "") || (left.time ?? "").localeCompare(right.time ?? ""))
                            .slice(0, 5);

                          if (upcomingFixtures.length === 0) {
                            return (
                              <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                                <Check size={20} className="mb-2 text-success" />
                                <p className="font-anton text-sm uppercase text-text-primary">Schedule complete</p>
                                <p className="mt-1 text-xs text-text-secondary">No upcoming league fixtures.</p>
                              </div>
                            );
                          }

                          return (
                            <div className="flex min-h-0 flex-1 flex-col">
                              <div className="mb-2 shrink-0 text-center">
                                <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">Next league fixtures</span>
                              </div>
                              <div className="grid min-h-0 flex-1 gap-2" style={{ gridTemplateRows: `repeat(${upcomingFixtures.length}, minmax(0, 1fr))` }}>
                                {upcomingFixtures.map((fixture) => {
                                  const teamA = teams[fixture.teamA];
                                  const teamB = teams[fixture.teamB];
                                  const involvesUser = fixture.teamA === userTeamId || fixture.teamB === userTeamId;
                                  const fixtureDate = fixture.date ? dateKeyToLocalDate(fixture.date) : null;

                                  return (
                                    <div
                                      key={fixture.id}
                                      className="flex min-h-0 flex-col justify-center border border-border px-2.5 py-2 text-center"
                                      style={involvesUser ? {
                                        backgroundColor: `${userTeam.primaryColor}38`,
                                        borderColor: userTeam.primaryColor,
                                        boxShadow: `inset 4px 0 0 ${userTeam.primaryColor}, inset -4px 0 0 ${userTeam.primaryColor}`,
                                      } : undefined}
                                    >
                                      <div className="truncate font-space-mono text-[11px] font-medium uppercase text-text-secondary">
                                        {fixtureDate?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) ?? "Date TBD"}
                                        {" · "}{fixture.time ?? "Time TBD"}{" · "}Match {fixture.matchNumber}
                                      </div>
                                      <div className="my-1.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 font-anton text-[16px] uppercase leading-none text-text-primary">
                                        <span
                                          className="flex min-w-0 items-center justify-end gap-1.5 truncate px-1 py-1 text-right"
                                        >
                                          <span className="truncate">{teamA?.shortName ?? fixture.teamA}</span>
                                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: teamA?.primaryColor ?? "#777777" }} />
                                        </span>
                                        <span className="font-space-mono text-[10px] font-bold text-text-secondary">VS</span>
                                        <span
                                          className="flex min-w-0 items-center gap-1.5 truncate px-1 py-1 text-left"
                                        >
                                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: teamB?.primaryColor ?? "#777777" }} />
                                          <span className="truncate">{teamB?.shortName ?? fixture.teamB}</span>
                                        </span>
                                      </div>
                                      <div className="truncate font-space-mono text-[11px] font-medium uppercase text-text-secondary">
                                        {fixture.simulation?.conditions?.stadiumName
                                          ?? (fixture.stage ? getMatchConditions(fixture)?.stadiumName : undefined)
                                          ?? teamA?.homeGround
                                          ?? "Stadium TBD"}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-2 shrink-0 border-t border-[#16130f]/10 pt-2 text-right font-space-mono text-[9px] font-bold uppercase text-accent">View full schedule →</div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="font-space-mono text-[9px] text-text-secondary space-y-2">
                          <span className="font-bold text-accent uppercase block font-space-mono text-[10px] bg-accent/10 py-0.5 px-1.5 rounded w-max">Announcing soon</span>
                          <p className="font-barlow text-xs text-text-secondary">Fixtures will be announced on {userFriendlyAnnouncementDate}.</p>
                        </div>
                      )}
                    </div>
                    )}
                  </div>

                  {/* Points Table standings */}
                  <div onClick={() => setActiveSubTab("standings")} className="flex min-h-0 cursor-pointer flex-col overflow-hidden rounded-lg border-2 border-border bg-surface p-5 transition-colors hover:border-accent">
                    <h4 className="font-anton text-[14px] uppercase border-b border-[#16130f]/10 pb-2 mb-4 shrink-0">STANDINGS</h4>
                    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_2rem_2rem_2rem_2.5rem] gap-1 border-b border-[#16130f]/10 pb-2 font-space-mono text-[8px] font-bold uppercase text-text-secondary shrink-0">
                      <span aria-hidden="true" />
                      <span>Team</span>
                      <span className="relative right-3 text-center">W</span>
                      <span className="relative right-3 text-center">L</span>
                      <span className="relative right-3 text-center">NR</span>
                      <span className="relative right-3 text-center">Pts</span>
                    </div>
                    <div
                      className="grid min-h-0 flex-1"
                      style={{ gridTemplateRows: `repeat(${Math.max(standings.length, 1)}, minmax(0, 1fr))` }}
                    >
                      {standings.map((row, index) => (
                        <div key={row.teamId} className={`grid min-h-0 grid-cols-[1.5rem_minmax(0,1fr)_2rem_2rem_2rem_2.5rem] items-center gap-1 border-b border-[#16130f]/10 text-[10px] text-text-primary ${row.teamId === userTeamId ? "bg-black/5 font-bold dark:bg-white/5" : ""}`}>
                          <span className="relative right-2 text-center font-space-mono text-sm font-bold text-text-secondary">{index + 1}</span>
                          <Link
                            href={`/game/teams/${row.teamId}`}
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                            className="truncate text-xs underline-offset-2 transition-colors hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                            aria-label={`Open ${row.teamName} team profile`}
                          >
                            {row.teamName}
                          </Link>
                          <span className="relative right-3 text-center font-space-mono">{row.won}</span>
                          <span className="relative right-3 text-center font-space-mono">{row.lost}</span>
                          <span className="relative right-3 text-center font-space-mono">{row.noResults}</span>
                          <span className="relative right-3 text-center font-space-mono text-xs font-bold">{row.points}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tournament key players */}
                  <div
                    onClick={() => setActiveSubTab("stats")}
                    className="group relative flex min-h-0 cursor-pointer flex-col overflow-hidden rounded-xl border-2 border-border bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
                  >
                    <div className="pointer-events-none absolute -right-10 -top-16 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />
                    <div className="relative mb-3 flex shrink-0 items-start justify-between border-b border-border pb-3">
                      <div>
                        <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.18em] text-text-secondary">{currentSeason} award races</p>
                        <h4 className="mt-1 font-anton text-[17px] uppercase leading-none text-text-primary">Tournament Key Players</h4>
                      </div>
                      <ArrowUpRight size={16} className="text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </div>

                    <div className="relative grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-2">
                      {[
                        {
                          label: "Top runs",
                          name: orangeCapLeaders[0]?.name,
                          value: orangeCapLeaders[0] ? `${orangeCapLeaders[0].runs} runs` : "Awaiting matches",
                          color: "#f97316",
                        },
                        {
                          label: "Highest score",
                          name: bestBattingPerformances[0]?.name,
                          value: bestBattingPerformances[0]
                            ? `${bestBattingPerformances[0].runs ?? 0}${bestBattingPerformances[0].dismissal === "not out" ? "*" : ""} (${bestBattingPerformances[0].balls ?? 0})`
                            : "Awaiting matches",
                          color: "#df6b20",
                        },
                        {
                          label: "Top wickets",
                          name: purpleCapLeaders[0]?.name,
                          value: purpleCapLeaders[0] ? `${purpleCapLeaders[0].wickets} wickets` : "Awaiting matches",
                          color: "#7e22ce",
                        },
                        {
                          label: "Best figures",
                          name: bestBowlingFigures[0]?.name,
                          value: bestBowlingFigures[0]
                            ? `${bestBowlingFigures[0].wickets ?? 0}/${bestBowlingFigures[0].runsConceded ?? 0}`
                            : "Awaiting matches",
                          color: "#16876f",
                        },
                        {
                          label: "MVP",
                          name: mvpLeaders[0]?.name,
                          value: mvpLeaders[0] ? `${mvpLeaders[0].mvpPoints} pts` : "Awaiting matches",
                          color: "#d69b24",
                        },
                        {
                          label: "Emerging",
                          name: emergingPlayerLeaders[0]?.name,
                          value: emergingPlayerLeaders[0] ? `${emergingPlayerLeaders[0].emergingPoints} pts` : "Awaiting matches",
                          color: "#0ea5e9",
                        },
                      ].map((category) => (
                        <div key={category.label} className="flex min-h-0 min-w-0 flex-col justify-center rounded-lg border border-border bg-black/[0.015] px-2.5 py-2 dark:bg-white/[0.025]">
                          <div className="flex items-center gap-1.5 font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                            <span className="truncate">{category.label}</span>
                          </div>
                          <div className="mt-1 truncate text-[10px] font-bold text-text-primary">{category.name ?? "No leader"}</div>
                          <div className="mt-0.5 truncate font-space-mono text-[8px] font-bold" style={{ color: category.color }}>{category.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Fixtures & Results page */}
              {activeSubTab === "fixtures" && (
                <div className="flex h-full flex-1 min-h-0 flex-col overflow-hidden border-2 border-border bg-surface">
                  <div
                    className="relative flex shrink-0 items-center justify-between overflow-hidden border-b-2 border-border px-6 py-4"
                    style={{ background: `linear-gradient(105deg, ${userTeam.primaryColor}28 0%, transparent 58%)` }}
                  >
                    <div className="relative">
                      <p className="font-space-mono text-[9px] font-bold uppercase tracking-[0.18em] text-text-secondary">{currentSeason} season · Match centre</p>
                      <h3 className="mt-1 font-anton text-[24px] uppercase leading-none text-text-primary">Fixtures &amp; Results</h3>
                    </div>
                    {isFixturesAnnounced && (
                      <div className="relative flex items-center gap-3">
                        <button
                          type="button"
                          onClick={scrollToMostRecentFixture}
                          disabled={!mostRecentPlayedFixtureId}
                          className="flex shrink-0 items-center gap-2 border border-border bg-surface/80 px-3 py-2 font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-primary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-primary"
                        >
                          <HistoryIcon size={13} />
                          Most recent fixture
                        </button>
                        <div className="grid grid-cols-4 divide-x divide-[#16130f]/15 border border-border bg-surface/80">
                          {[
                            ["Played", fixtures.filter((match) => match.played).length],
                            ["Upcoming", fixtures.filter((match) => !match.played).length],
                            ["Your club", fixtures.filter((match) => match.teamA === userTeamId || match.teamB === userTeamId).length],
                            ["Rain affected", fixtures.filter((match) => match.played && isRainAffectedMatch(match)).length],
                          ].map(([label, value]) => (
                            <div key={label} className="min-w-24 px-4 py-2 text-center">
                              <div className="font-anton text-xl leading-none text-text-primary">{value}</div>
                              <div className="mt-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">{label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {!isFixturesAnnounced ? (
                    <div className="flex flex-1 flex-col items-center justify-center bg-bg/40 p-8 text-center">
                      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-surface text-[24px] shadow-sm">
                        <Lock size={24} />
                      </div>
                      <h4 className="font-anton text-[22px] uppercase tracking-wide text-text-primary">Schedule under wraps</h4>
                      <p className="mt-2 max-w-sm text-sm text-text-secondary">
                        The league is finalising all 70 fixtures. The complete match calendar will be released on:
                      </p>
                      <span className="mt-4 border border-accent/30 bg-accent/10 px-4 py-2 font-space-mono text-xs font-bold uppercase text-accent">
                        {userFriendlyAnnouncementDate}
                      </span>
                    </div>
                  ) : (
                    (() => {
                      const sortedFixtures = [...fixtures].sort((left, right) =>
                        (left.date ?? "").localeCompare(right.date ?? "")
                        || (left.time ?? "").localeCompare(right.time ?? "")
                        || left.round - right.round
                      );
                      const nextFixtureId = sortedFixtures.find((match) => !match.played)?.id;
                      const fixturesByDay = new Map<string, Match[]>();
                      sortedFixtures.forEach((match) => {
                        const date = match.date ?? "Date TBD";
                        fixturesByDay.set(date, [...(fixturesByDay.get(date) ?? []), match]);
                      });

                      return (
                        <div className="min-h-0 flex-1 overflow-y-auto bg-bg/40 p-5">
                          <div className="space-y-6">
                            {Array.from(fixturesByDay.entries()).map(([date, dayFixtures]) => {
                              const dateLabel = date === "Date TBD"
                                ? date
                                : dateKeyToLocalDate(date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
                              return (
                                <section key={date}>
                                  <div className="mb-2 flex items-center gap-3">
                                    <h4 className="shrink-0 font-anton text-[15px] uppercase text-text-primary">{dateLabel}</h4>
                                    <div className="h-px flex-1 bg-[#16130f]/15" />
                                    <span className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                                      {dayFixtures.length} match{dayFixtures.length === 1 ? "" : "es"}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                    {dayFixtures.map((match) => {
                                      const teamA = teams[match.teamA];
                                      const teamB = teams[match.teamB];
                                      const isUserMatch = match.teamA === userTeamId || match.teamB === userTeamId;
                                      const isNextFixture = match.id === nextFixtureId;
                                      const winner = match.winner ? teams[match.winner] : null;
                                      const statusLabel = match.played ? "Final" : isNextFixture ? "Next up" : "Upcoming";

                                      const canSimulateUserMatch = (
                                        FIXTURE_SIMULATION_ENABLED
                                        &&
                                        isUserMatch
                                        && !match.played
                                        && Boolean(match.date)
                                        && (match.date ?? "") <= currentDate
                                      );

                                      return (
                                        <article
                                          key={match.id}
                                          id={`fixture-card-${match.id}`}
                                          onClick={() => {
                                            if (!match.played) return;
                                            setActiveMatchResultView("scorecard");
                                            setActiveCommentary(null);
                                            setActiveScorecard(match);
                                          }}
                                          className={`group relative overflow-hidden border bg-surface p-4 text-left shadow-sm transition-all ${match.played ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : "cursor-default"}`}
                                          style={isUserMatch ? {
                                            borderColor: userTeam.primaryColor,
                                            background: `linear-gradient(110deg, ${userTeam.primaryColor}24 0%, var(--surface) 60%)`,
                                          } : { borderColor: "var(--border)" }}
                                        >
                                          <div className="absolute inset-x-0 top-0 flex h-1">
                                            <span className="flex-1" style={{ backgroundColor: teamA?.primaryColor ?? "#777" }} />
                                            <span className="flex-1" style={{ backgroundColor: teamB?.primaryColor ?? "#777" }} />
                                          </div>

                                          <div className="mb-3 flex items-center justify-between pt-1 font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">
                                            <span>{match.label ?? `Match ${match.matchNumber}`} · {match.time ?? "Time TBD"}</span>
                                            <span className={`border px-2 py-0.5 ${match.played ? "border-success/30 bg-success/10 text-success" : isNextFixture ? "border-accent/30 bg-accent/10 text-accent" : "border-border bg-black/[0.03]"}`}>
                                              {statusLabel}
                                            </span>
                                          </div>

                                          <div className="grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] items-center gap-3">
                                            <div className="min-w-0 text-center">
                                              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full font-space-mono text-[10px] font-bold" style={{ backgroundColor: teamA?.primaryColor ?? "#777", color: teamA?.secondaryColor ?? "#fff" }}>
                                                {teamA?.shortName.slice(0, 3) ?? "TBD"}
                                              </div>
                                              <div className="truncate text-sm font-bold text-text-primary">{teamA?.name ?? "To be decided"}</div>
                                              {match.played && match.scoreA && <div className="mt-1 font-anton text-xl text-text-primary">{match.scoreA.runs}/{match.scoreA.wickets}</div>}
                                            </div>

                                            <div className="text-center">
                                              <div className="font-space-mono text-[9px] font-bold uppercase text-text-secondary">VS</div>
                                            </div>

                                            <div className="min-w-0 text-center">
                                              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full font-space-mono text-[10px] font-bold" style={{ backgroundColor: teamB?.primaryColor ?? "#777", color: teamB?.secondaryColor ?? "#fff" }}>
                                                {teamB?.shortName.slice(0, 3) ?? "TBD"}
                                              </div>
                                              <div className="truncate text-sm font-bold text-text-primary">{teamB?.name ?? "To be decided"}</div>
                                              {match.played && match.scoreB && <div className="mt-1 font-anton text-xl text-text-primary">{match.scoreB.runs}/{match.scoreB.wickets}</div>}
                                            </div>
                                          </div>

                                          <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#16130f]/10 pt-2">
                                            <span className="truncate font-space-mono text-[8px] uppercase text-text-secondary">
                                              {match.simulation?.conditions?.stadiumName
                                                ?? (match.stage ? getMatchConditions(match)?.stadiumName : undefined)
                                                ?? teamA?.homeGround
                                                ?? "Venue TBD"}
                                            </span>
                                            {canSimulateUserMatch ? (
                                              <div className="flex shrink-0 gap-2">
                                                <button
                                                  type="button"
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    startPlayableMatch(match);
                                                  }}
                                                  className="rounded border border-[#16130f]/30 bg-surface px-3 py-1.5 font-space-mono text-[8px] font-bold uppercase text-text-primary transition-colors hover:border-accent hover:text-accent"
                                                >
                                                  Play match
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    prepareUserFixtureSimulation(match);
                                                  }}
                                                  className="rounded border border-accent bg-accent px-3 py-1.5 font-space-mono text-[8px] font-bold uppercase text-white transition-colors hover:bg-accent/85"
                                                >
                                                  Simulate match
                                                </button>
                                              </div>
                                            ) : match.played || !FIXTURE_SIMULATION_ENABLED || isUserMatch ? (
                                              <span className={`shrink-0 text-right font-space-mono text-[8px] font-bold uppercase ${match.played ? "text-success" : "text-text-secondary"}`}>
                                                {match.played
                                                  ? appendRainAffectedResultLabel(
                                                    match.simulation?.resultText ?? `${winner?.shortName ?? "Match"} won`,
                                                    isRainAffectedMatch(match),
                                                  )
                                                  : !FIXTURE_SIMULATION_ENABLED
                                                    ? "Simulation locked"
                                                    : (match.date ?? "") > currentDate ? "Your fixture" : "Awaiting match"}
                                              </span>
                                            ) : null}
                                          </div>
                                        </article>
                                      );
                                    })}
                                  </div>
                                </section>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {/* Standings page */}
              {activeSubTab === "standings" && (
                <div className="standings-panel h-full min-h-0 flex-1 overflow-hidden border-2 border-border bg-surface flex flex-col">
                  {(() => {
                    const playoffFixtures = fixtures.filter((fixture) => Boolean(fixture.stage));
                    const playoffsHaveStarted = playoffFixtures.length > 0;
                    const finalFixture = playoffFixtures.find((fixture) => fixture.stage === "final");
                    const championTeamId = finalFixture?.winner;
                    const runnerUpTeamId = finalFixture?.winner
                      ? (finalFixture.teamA === finalFixture.winner ? finalFixture.teamB : finalFixture.teamA)
                      : undefined;
                    const visibleView = playoffsHaveStarted ? standingsView : "league";
                    return (
                      <>
                        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-black/[0.025] px-5 py-3 dark:bg-white/[0.025]">
                          <div>
                            <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.2em] text-accent">{currentSeason} season</p>
                            <h3 className="mt-0.5 font-anton text-lg uppercase text-text-primary">Standings</h3>
                          </div>
                          {playoffsHaveStarted && (
                            <div className="flex rounded border border-border bg-surface p-1" role="tablist" aria-label="Standings view">
                              <button
                                type="button"
                                role="tab"
                                aria-selected={visibleView === "league"}
                                onClick={() => setStandingsView("league")}
                                className={`rounded px-3 py-1.5 font-space-mono text-[8px] font-bold uppercase tracking-wider transition-colors ${visibleView === "league" ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary"}`}
                              >
                                League table
                              </button>
                              <button
                                type="button"
                                role="tab"
                                aria-selected={visibleView === "playoffs"}
                                onClick={() => setStandingsView("playoffs")}
                                className={`rounded px-3 py-1.5 font-space-mono text-[8px] font-bold uppercase tracking-wider transition-colors ${visibleView === "playoffs" ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary"}`}
                              >
                                Playoffs
                              </button>
                            </div>
                          )}
                        </div>

                        {visibleView === "playoffs" ? (
                          <div className="min-h-0 flex-1 overflow-auto p-5">
                            <div className="isolate min-h-[240px] border border-border bg-surface p-4">
                              <PlayoffDiagramContent
                                fixtures={playoffFixtures}
                                teams={teams}
                                standings={standings}
                                championTeamId={championTeamId}
                                runnerUpTeamId={runnerUpTeamId}
                              />
                            </div>
                          </div>
                        ) : (
                  <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
                    <table className="points-table w-full text-left font-barlow divide-y divide-[#16130f]/10">
                      <colgroup>
                        <col style={{ width: "6%" }} />
                        <col style={{ width: "48%" }} />
                        <col style={{ width: "5.5%" }} />
                        <col style={{ width: "5.5%" }} />
                        <col style={{ width: "5.5%" }} />
                        <col style={{ width: "5.5%" }} />
                        <col style={{ width: "14%" }} />
                        <col style={{ width: "10%" }} />
                      </colgroup>
                      <thead className="points-table-header bg-[#16130f]/5 font-space-mono text-text-secondary uppercase tracking-wider">
                        <tr>
                          <th className="points-table-compact-stat text-center">Pos</th>
                          <th>Team</th>
                          <th className="points-table-compact-stat text-center">P</th>
                          <th className="points-table-compact-stat text-center">W</th>
                          <th className="points-table-compact-stat text-center">L</th>
                          <th className="points-table-compact-stat text-center">NR</th>
                          <th className="points-table-compact-stat text-center">NRR</th>
                          <th className="points-table-compact-stat text-center font-bold">Pts</th>
                        </tr>
                      </thead>
                      <tbody className="points-table-body divide-y divide-[#16130f]/10">
                        {standings.map((row, idx) => (
                          <tr key={row.teamId} className={`hover:bg-black/5 transition-colors ${row.teamId === userTeamId ? "bg-accent/5 font-bold" : ""}`}>
                            <td className="points-table-compact-stat points-table-position text-center font-bold text-text-secondary font-space-mono">#{idx + 1}</td>
                            <td className="points-table-team truncate font-bold text-text-primary">
                              <Link
                                href={`/game/teams/${row.teamId}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                }}
                                className="inline-block max-w-full truncate underline-offset-2 transition-colors hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                                aria-label={`Open ${row.teamName} team profile`}
                              >
                                {row.teamName}
                              </Link>
                            </td>
                            <td className="points-table-compact-stat text-center font-space-mono text-text-secondary">{row.played}</td>
                            <td className="points-table-compact-stat text-center text-success font-bold font-space-mono">{row.won}</td>
                            <td className="points-table-compact-stat text-center text-danger font-bold font-space-mono">{row.lost}</td>
                            <td className="points-table-compact-stat text-center font-space-mono text-text-secondary">{row.noResults}</td>
                            <td className="points-table-compact-stat text-center font-space-mono font-medium text-text-primary">{row.nrr >= 0 ? "+" : ""}{row.nrr.toFixed(3)}</td>
                            <td className="points-table-compact-stat points-table-points text-center font-bold font-space-mono text-text-primary">{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Tournament Stats page */}
              {activeSubTab === "stats" && (
                <TournamentStatsDashboard
                  season={currentSeason}
                  completedMatches={fixtures.filter((match) => match.played).length}
                  teams={teams}
                  orangeCapLeaders={orangeCapLeaders}
                  purpleCapLeaders={purpleCapLeaders}
                  mvpLeaders={mvpLeaders}
                  emergingPlayerLeaders={emergingPlayerLeaders}
                  bestBattingPerformances={bestBattingPerformances}
                  bestBowlingFigures={bestBowlingFigures}
                  onOpenPlayer={setDetailedPlayerId}
                />
              )}
            </>
          )}

          {/* ==================================================================
              MAIN TAB: LEAGUE
              ================================================================== */}
          {activeTab === "league" && (
            <>
              {activeSubTab === "trades" && (
                <TradeHubPage
                  currentDate={currentDate}
                  currentSeason={currentSeason}
                  finalDate={getSeasonFinalDate()}
                  auctionType={getAuctionTypeForSeason(currentSeason + 1)}
                  userTeamId={userTeamId}
                  players={players}
                  teams={teams}
                  tradeRecords={tradeRecords}
                  negotiationCooldowns={tradeNegotiationCooldowns}
                  injuredPlayerIds={Object.keys(activeInjuries)}
                  onExecuteTrade={executeTrade}
                  onSetNegotiationCooldown={setTradeNegotiationCooldown}
                />
              )}
              {activeSubTab === "overview" && (() => {
                const rivalContracts = Object.values(careerStaff.contracts).filter((contract) => (
                  contract.status === "contracted" && Boolean(contract.teamId) && contract.teamId !== userTeamId
                ));
                const rivalStaffEvents = careerStaff.employmentHistory.filter((event) => (
                  event.season === currentSeason && Boolean(event.teamId) && event.teamId !== userTeamId
                ));
                const recentStaffEvents = rivalStaffEvents.slice(-2).reverse();
                const leagueInjuries = Object.values(activeInjuries);
                const majorInjuries = leagueInjuries.filter((injury) => injury.category === "major");
                const injuredClubs = new Set(leagueInjuries.map((injury) => injury.teamId)).size;
                const featuredInjuries = [...leagueInjuries]
                  .sort((left, right) => left.estimatedReturnLatest.localeCompare(right.estimatedReturnLatest))
                  .slice(0, 2);
                const finalDate = getSeasonFinalDate();
                const tradeWindow = finalDate ? getTradeWindowDates(finalDate, currentSeason) : undefined;
                const tradeWindowOpen = isTradeWindowOpen(currentDate, finalDate, currentSeason);
                const seasonTrades = tradeRecords.filter((record) => record.season === currentSeason);
                const recentTrades = seasonTrades.slice(-2).reverse();
                const playedMatches = fixtures.filter((fixture) => fixture.played).length;
                const seasonProgress = Math.round((playedMatches / Math.max(1, fixtures.length)) * 100);
                const verifiedRecords = minorRecords.filter((record) => record.verified);
                const recordCategories = new Set(minorRecords.map((record) => record.category)).size;
                const featuredRecords = verifiedRecords.slice(0, 2);

                return (
                  <div className="grid h-[calc(100vh-200px)] min-h-[560px] grid-cols-12 grid-rows-2 gap-4 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setActiveSubTab("staff")}
                      className="group relative col-span-4 flex min-h-0 flex-col overflow-hidden rounded-xl border-2 border-border bg-surface p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
                    >
                      <div className="pointer-events-none absolute -right-12 -top-14 size-36 rounded-full bg-sky-500/10 blur-3xl" />
                      <div className="relative flex items-start justify-between border-b border-border pb-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400"><Briefcase size={18} aria-hidden="true" /></span>
                          <div><p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-text-secondary">League personnel</p><h3 className="mt-1 font-anton text-lg uppercase leading-none text-text-primary">Staff Activity</h3></div>
                        </div>
                        <ArrowUpRight size={15} className="text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>
                      <div className="relative mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-bg/70 p-3"><p className="font-anton text-3xl leading-none text-text-primary">{rivalContracts.length}</p><p className="mt-1 font-space-mono text-[8px] font-bold uppercase text-text-secondary">Rival staff in post</p></div>
                        <div className="rounded-lg bg-bg/70 p-3"><p className="font-anton text-3xl leading-none text-text-primary">{rivalStaffEvents.length}</p><p className="mt-1 font-space-mono text-[8px] font-bold uppercase text-text-secondary">Moves this season</p></div>
                      </div>
                      <div className="relative mt-3 min-h-0 flex-1 space-y-1.5 overflow-hidden">
                        {recentStaffEvents.length > 0 ? recentStaffEvents.map((event) => (
                          <div key={event.id} className="flex items-center justify-between gap-3 border-t border-border/70 pt-1.5 text-[11px]">
                            <span className="truncate font-semibold text-text-primary">{careerStaff.contracts[event.staffId]?.fullName ?? "Staff member"}</span>
                            <span className="shrink-0 font-space-mono text-[8px] font-bold uppercase text-text-secondary">{teams[event.teamId ?? ""]?.shortName ?? "League"} · {event.kind.replaceAll("_", " ")}</span>
                          </div>
                        )) : <p className="pt-2 text-xs text-text-secondary">No rival appointments or departures this season.</p>}
                      </div>
                      <span className="relative mt-2 inline-flex items-center gap-1 font-space-mono text-[8px] font-bold uppercase tracking-wider text-accent">Open league staff <ChevronRight size={12} /></span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSubTab("injuries")}
                      className="group relative col-span-4 flex min-h-0 flex-col overflow-hidden rounded-xl border-2 border-border bg-surface p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
                    >
                      <div className="pointer-events-none absolute -right-12 -top-14 size-36 rounded-full bg-red-500/10 blur-3xl" />
                      <div className="relative flex items-start justify-between border-b border-border pb-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center rounded-lg bg-danger/10 text-danger"><Activity size={18} aria-hidden="true" /></span>
                          <div><p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-text-secondary">Medical report</p><h3 className="mt-1 font-anton text-lg uppercase leading-none text-text-primary">Active Injuries</h3></div>
                        </div>
                        <ArrowUpRight size={15} className="text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>
                      <div className="relative mt-3 flex items-end gap-5">
                        <div><p className="font-anton text-4xl leading-none text-text-primary">{leagueInjuries.length}</p><p className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Active cases</p></div>
                        <div className="pb-0.5 font-space-mono text-[8px] font-bold uppercase leading-relaxed text-text-secondary"><span className="text-danger">{majorInjuries.length} major</span><br />{injuredClubs} clubs affected</div>
                      </div>
                      <div className="relative mt-3 min-h-0 flex-1 space-y-1.5 overflow-hidden">
                        {featuredInjuries.length > 0 ? featuredInjuries.map((injury) => (
                          <div key={injury.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md bg-bg/70 px-3 py-2">
                            <span className="min-w-0"><span className="block truncate text-[11px] font-semibold text-text-primary">{injury.playerName}</span><span className="block truncate font-space-mono text-[8px] uppercase text-text-secondary">{teams[injury.teamId]?.shortName ?? injury.teamId} · {injury.conditionName}</span></span>
                            <span className="self-center font-space-mono text-[8px] font-bold uppercase text-text-secondary">to {injury.estimatedReturnEarliest}</span>
                          </div>
                        )) : <p className="rounded-md bg-success/5 px-3 py-2 text-xs text-success">No active injuries across the league.</p>}
                      </div>
                      <span className="relative mt-2 inline-flex items-center gap-1 font-space-mono text-[8px] font-bold uppercase tracking-wider text-accent">Open injury report <ChevronRight size={12} /></span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSubTab("trades")}
                      className={`group relative col-span-4 flex min-h-0 flex-col overflow-hidden rounded-xl border-2 bg-surface p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${tradeWindowOpen ? "border-success/50 hover:border-success" : "border-border hover:border-accent"}`}
                    >
                      <div className={`pointer-events-none absolute -right-12 -top-14 size-36 rounded-full blur-3xl ${tradeWindowOpen ? "bg-emerald-500/15" : "bg-slate-500/10"}`} />
                      <div className="relative flex items-start justify-between border-b border-border pb-3">
                        <div className="flex items-center gap-3">
                          <span className={`flex size-9 items-center justify-center rounded-lg ${tradeWindowOpen ? "bg-success/10 text-success" : "bg-black/5 text-text-secondary dark:bg-white/5"}`}><HeartHandshake size={18} aria-hidden="true" /></span>
                          <div><p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-text-secondary">League transactions</p><h3 className="mt-1 font-anton text-lg uppercase leading-none text-text-primary">Trade Hub</h3></div>
                        </div>
                        <ArrowUpRight size={15} className="text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>
                      {tradeWindowOpen ? (
                        <>
                          <div className="relative mt-3 flex items-center justify-between"><span className="rounded bg-success/10 px-2 py-1 font-space-mono text-[8px] font-bold uppercase text-success">Trade window open</span><span className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Closes {tradeWindow?.endsOn}</span></div>
                          <div className="relative mt-3 min-h-0 flex-1 space-y-1.5 overflow-hidden">
                            {recentTrades.length > 0 ? recentTrades.map((record) => {
                              const outgoing = record.outgoingPlayerIds.map((id) => players[id]?.name ?? id).join(" + ");
                              const incoming = record.incomingPlayerIds.map((id) => players[id]?.name ?? id).join(" + ");
                              return <div key={record.id} className="rounded-md bg-bg/70 px-3 py-2"><div className="font-space-mono text-[8px] font-bold uppercase text-success">{teams[record.fromTeamId]?.shortName ?? record.fromTeamId} ↔ {teams[record.toTeamId]?.shortName ?? record.toTeamId}</div><div className="mt-1 truncate text-[11px] text-text-primary">{outgoing} / {incoming}</div></div>;
                            }) : <div className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-text-secondary">No completed deals yet. Open the builder to explore available moves.</div>}
                          </div>
                          <span className="relative mt-2 inline-flex items-center gap-1 font-space-mono text-[8px] font-bold uppercase tracking-wider text-success">Build a trade <ChevronRight size={12} /></span>
                        </>
                      ) : (
                        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center py-4 text-center">
                          <Lock size={22} className="mb-3 text-text-secondary" aria-hidden="true" />
                          <p className="font-anton text-2xl uppercase leading-none text-text-primary">Trade Window Closed</p>
                          <p className="mt-2 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                            {tradeWindow ? (currentDate < tradeWindow.startsOn ? `Opens ${tradeWindow.startsOn}` : `Closed ${tradeWindow.endsOn}`) : "Dates awaiting season schedule"}
                          </p>
                          <p className="mt-3 text-xs text-text-secondary">{seasonTrades.length} completed {seasonTrades.length === 1 ? "deal" : "deals"} recorded this season</p>
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSubTab("seasonanalysis")}
                      className="group relative col-span-7 flex min-h-0 overflow-hidden rounded-xl border-2 border-border bg-surface p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
                    >
                      <div className="pointer-events-none absolute -bottom-20 -right-10 size-48 rounded-full bg-violet-500/10 blur-3xl" />
                      <div className="relative flex w-[42%] shrink-0 flex-col border-r border-border pr-5">
                        <div className="flex items-center justify-between"><span className="flex size-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400"><TrendingUp size={18} aria-hidden="true" /></span><ArrowUpRight size={15} className="text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
                        <p className="mt-auto font-anton text-4xl leading-none text-text-primary">{playedMatches}<span className="text-xl text-text-secondary">/{fixtures.length}</span></p>
                        <h3 className="mt-2 font-anton text-xl uppercase leading-none text-text-primary">Season Analysis</h3>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-violet-500" style={{ width: `${seasonProgress}%` }} /></div>
                        <p className="mt-1 font-space-mono text-[8px] font-bold uppercase text-text-secondary">{seasonProgress}% of matches complete</p>
                      </div>
                      <div className="relative grid min-w-0 flex-1 grid-cols-2 content-center gap-3 pl-5">
                        <div className="rounded-lg bg-bg/70 p-4"><p className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Leading runs</p><p className="mt-2 truncate text-sm font-bold text-text-primary">{orangeCapLeaders[0]?.name ?? "Awaiting matches"}</p><p className="mt-1 font-anton text-xl text-orange-500">{orangeCapLeaders[0] ? `${orangeCapLeaders[0].runs} runs` : "—"}</p></div>
                        <div className="rounded-lg bg-bg/70 p-4"><p className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Leading wickets</p><p className="mt-2 truncate text-sm font-bold text-text-primary">{purpleCapLeaders[0]?.name ?? "Awaiting matches"}</p><p className="mt-1 font-anton text-xl text-purple-600 dark:text-purple-400">{purpleCapLeaders[0] ? `${purpleCapLeaders[0].wickets} wickets` : "—"}</p></div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSubTab("minorrecords")}
                      className="group relative col-span-5 flex min-h-0 flex-col overflow-hidden rounded-xl border-2 border-border bg-surface p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
                    >
                      <div className="pointer-events-none absolute -bottom-16 -right-8 size-40 rounded-full bg-amber-500/10 blur-3xl" />
                      <div className="relative flex items-start justify-between border-b border-border pb-3">
                        <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-warning/10 text-warning"><Trophy size={18} aria-hidden="true" /></span><div><p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-text-secondary">Competition archive</p><h3 className="mt-1 font-anton text-lg uppercase leading-none text-text-primary">Minor Records</h3></div></div>
                        <ArrowUpRight size={15} className="text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>
                      <div className="relative mt-3 grid grid-cols-[auto_auto_1fr] items-end gap-5"><div><p className="font-anton text-3xl leading-none text-text-primary">{minorRecords.length}</p><p className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Records</p></div><div><p className="font-anton text-3xl leading-none text-success">{verifiedRecords.length}</p><p className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Verified</p></div><p className="pb-0.5 text-right font-space-mono text-[8px] font-bold uppercase text-text-secondary">{recordCategories} categories</p></div>
                      <div className="relative mt-3 grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-hidden">
                        {featuredRecords.map((record) => <div key={record.id} className="min-w-0 rounded-lg bg-bg/70 p-3"><p className="line-clamp-2 text-[10px] font-semibold leading-tight text-text-primary">{record.title}</p><p className="mt-2 truncate font-anton text-lg text-warning">{record.value}</p><p className="truncate font-space-mono text-[8px] uppercase text-text-secondary">{record.holder}</p></div>)}
                      </div>
                      <span className="relative mt-2 inline-flex items-center gap-1 font-space-mono text-[8px] font-bold uppercase tracking-wider text-accent">Browse the archive <ChevronRight size={12} /></span>
                    </button>
                  </div>
                );
              })()}
              {activeSubTab === "injuries" && (
                <InjuryHubPage
                  mode="league"
                  userTeamId={userTeamId}
                  activeInjuries={activeInjuries}
                  injuryHistory={injuryHistory}
                  replacementRecords={injuryReplacementRecords}
                  replacementPoolIds={injuryReplacementPoolIds}
                  currentDate={currentDate}
                  currentSeason={currentSeason}
                  players={players}
                  teams={teams}
                  seasonFinalDate={fixtures.find((fixture) => fixture.stage === "final")?.date}
                />
              )}
              {activeSubTab === "staff" && (
                <StaffManagementPage teams={Object.values(teams)} mode="league" />
              )}
              {activeSubTab === "seasonanalysis" && (
                <SeasonDataAnalysisPage fixtures={detailedFixtures} teams={teams} players={players} seasonStartBattingAbilities={seasonStartBattingAbilities} seasonStartBowlingAbilities={seasonStartBowlingAbilities} userTeamId={userTeamId} />
              )}
              {activeSubTab === "minorrecords" && (
                <MinorRecords minorRecords={minorRecords} />
              )}
            </>
          )}

          {/* ==================================================================
              MAIN TAB: HISTORY
              ================================================================== */}
          {activeTab === "history" && (
            <>
              {activeSubTab === "overview" && (
                <div className="relative h-[calc(100vh-200px)] min-h-[500px] overflow-hidden bg-[radial-gradient(circle_at_center,rgba(45,107,181,0.075),transparent_52%)] dark:bg-[radial-gradient(circle_at_center,rgba(45,107,181,0.08),transparent_52%)]">
                  <div className="grid h-full grid-cols-12 grid-rows-2 gap-4">
                    {[
                      {
                        subtab: "clubhistory",
                        title: "Club History",
                        description: "Follow your franchise through every campaign, honour and defining milestone.",
                        icon: HistoryIcon,
                        position: "col-span-4 col-start-1 row-start-1",
                        accent: "#d6ad55",
                        lightAccent: "#9a6b12",
                        highlights: ["Seasons", "Honours", "Trophy cabinet"],
                        featured: false,
                      },
                      {
                        subtab: "leaguehistory",
                        title: "League History",
                        description: "Revisit every final, champion, cap winner and saved career season.",
                        icon: Trophy,
                        position: "col-span-4 col-start-1 row-start-2",
                        accent: "#4f8fd7",
                        lightAccent: "#326da9",
                        highlights: ["Finalists", "Cap winners", "League tables"],
                        featured: false,
                      },
                      {
                        subtab: "records",
                        title: "Records",
                        description: "Explore the career leaders, great single-season performances and landmark matches that define the IPL.",
                        icon: FileText,
                        position: "col-span-4 col-start-5 row-span-2 row-start-1",
                        accent: "#e7c576",
                        lightAccent: "#946514",
                        highlights: ["Appearances", "Runs", "Wickets", "Match records"],
                        featured: true,
                      },
                      {
                        subtab: "clubfigures",
                        title: "Club Figures",
                        description: "Meet the legends, icons and heroes who shaped your franchise identity.",
                        icon: Users,
                        position: "col-span-4 col-start-9 row-start-1",
                        accent: "#8d68c7",
                        lightAccent: "#6f4ca7",
                        highlights: ["Legends", "Icons", "Heroes"],
                        featured: false,
                      },
                      {
                        subtab: "leaguehalloffame",
                        title: "League Hall of Fame",
                        description: "Celebrate the players, captains and match-winners who became immortal.",
                        icon: UserCheck,
                        position: "col-span-4 col-start-9 row-start-2",
                        accent: "#d87945",
                        lightAccent: "#b5572f",
                        highlights: ["First ballot", "Greatest players", "Career eras"],
                        featured: false,
                      },
                    ].map(({ subtab, title, description, icon: Icon, position, accent, lightAccent, highlights, featured }) => (
                      <button
                        key={subtab}
                        type="button"
                        onClick={() => setActiveSubTab(subtab)}
                        className={`history-archive-tile group relative flex min-h-0 flex-col overflow-hidden border-2 border-border bg-surface2 text-left text-text-primary shadow-[0_7px_22px_rgba(64,52,35,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(64,52,35,0.14)] dark:shadow-sm dark:hover:shadow-[0_14px_32px_rgba(0,0,0,0.3)] ${featured ? "p-6" : "p-5"} ${position}`}
                        style={{
                          "--history-tile-accent-light": lightAccent,
                          "--history-tile-accent-dark": accent,
                          borderTopColor: "var(--history-tile-accent)",
                        } as CSSProperties}
                      >
                        <span className="pointer-events-none absolute inset-x-0 top-0 h-1" style={{ backgroundColor: "var(--history-tile-accent)" }} />
                        <span className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full opacity-[0.09] blur-3xl dark:opacity-20" style={{ backgroundColor: "var(--history-tile-accent)" }} />
                        <span className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-[#8fb5dd]/20 blur-3xl dark:bg-[#2d6bb5]/15" />

                        <span className="relative flex items-start justify-between gap-3">
                          <span
                            className={`flex shrink-0 items-center justify-center rounded-full border ${featured ? "h-14 w-14" : "h-10 w-10"}`}
                            style={{ borderColor: "color-mix(in srgb, var(--history-tile-accent) 48%, transparent)", backgroundColor: "color-mix(in srgb, var(--history-tile-accent) 9%, transparent)", color: "var(--history-tile-accent)" }}
                          >
                            <Icon size={featured ? 25 : 18} />
                          </span>
                          <ChevronRight size={featured ? 19 : 15} className="transition-transform group-hover:translate-x-1" style={{ color: "var(--history-tile-accent)" }} />
                        </span>

                        <span className={`relative flex flex-1 flex-col ${featured ? "justify-center py-6" : "justify-end pt-3"}`}>
                          <span className="block font-space-mono text-[8px] font-bold uppercase tracking-[0.22em] text-accent">History archive</span>
                          <span className={`mt-2 block font-anton uppercase leading-none tracking-wide ${featured ? "text-[34px]" : "text-[23px]"}`}>{title}</span>
                          <span className={`mt-3 block leading-relaxed text-text-secondary ${featured ? "max-w-sm text-[12px]" : "max-w-md text-[11px]"}`}>{description}</span>

                          <span className={featured ? "mt-7 grid grid-cols-2 gap-1.5" : "mt-4 flex flex-wrap gap-1.5"}>
                            {highlights.map((highlight) => (
                              <span
                                key={highlight}
                                className={`border px-2 py-1 font-space-mono font-bold uppercase tracking-wider text-text-secondary ${featured ? "text-center text-[8px]" : "text-[7px]"}`}
                                style={{ borderColor: "color-mix(in srgb, var(--history-tile-accent) 32%, transparent)", backgroundColor: "color-mix(in srgb, var(--history-tile-accent) 6%, transparent)" }}
                              >
                                {highlight}
                              </span>
                            ))}
                          </span>
                        </span>

                        <span className="relative flex items-center justify-between border-t border-border pt-3 font-space-mono text-[8px] font-bold uppercase tracking-[0.16em] text-text-secondary">
                          <span>Open archive</span>
                          <span className="transition-colors" style={{ color: "var(--history-tile-accent)" }}>View</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeSubTab === "clubhistory" && (
                <div className="grid h-[calc(100vh-200px)] min-h-[500px] grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] gap-6 overflow-hidden">
                  <section className="flex min-h-0 flex-col overflow-hidden border-2 border-border bg-surface p-5">
                    <div className="mb-4 flex shrink-0 items-end justify-between border-b border-[#16130f]/10 pb-3">
                      <div>
                        <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.2em] text-text-secondary">IPL record through {latestClubHistorySeason}</p>
                        <h3 className="mt-1 font-anton text-[22px] uppercase leading-none text-text-primary">{userTeam.name}</h3>
                      </div>
                      <div className="flex gap-6 text-right font-space-mono">
                        <div><div className="text-xl font-bold text-text-primary">{clubSeasonsPlayed}</div><div className="text-[8px] uppercase text-text-secondary">Seasons</div></div>
                        <div><div className="text-xl font-bold text-text-primary">{clubTitles.length}</div><div className="text-[8px] uppercase text-text-secondary">Titles</div></div>
                        <div><div className="text-xl font-bold text-text-primary">{clubRunnerUpFinishes.length}</div><div className="text-[8px] uppercase text-text-secondary">Runners-up</div></div>
                      </div>
                    </div>

                    <div className="grid shrink-0 grid-cols-[4.5rem_minmax(0,1fr)_9rem] border-b border-[#16130f]/10 pb-2 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                      <span>Season</span>
                      <span>Club</span>
                      <span>IPL outcome</span>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {clubSeasonHistory.map((season) => {
                        const isTitle = season.outcome === "Champions";
                        const isRunnerUp = season.outcome === "Runners-up";
                        return (
                          <div
                            key={season.season}
                            className={`grid min-h-11 grid-cols-[4.5rem_minmax(0,1fr)_9rem] items-center border-b border-[#16130f]/10 text-xs ${isTitle ? "bg-black/5 font-bold dark:bg-white/5" : ""}`}
                          >
                            <span className="font-space-mono text-sm font-bold text-text-primary">{season.season}</span>
                            <span className="truncate pr-4 text-text-primary">{season.clubName}</span>
                            <span className={`font-space-mono text-[10px] uppercase ${isTitle || isRunnerUp ? "font-bold text-text-primary" : "text-text-secondary"}`}>
                              {season.outcome}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <aside className="flex min-h-0 flex-col overflow-hidden border-2 border-border bg-surface p-5">
                    <div className="mb-4 shrink-0 border-b border-[#16130f]/10 pb-3">
                      <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.2em] text-text-secondary">Honours</p>
                      <h3 className="mt-1 font-anton text-[20px] uppercase leading-none text-text-primary">IPL Trophy Cabinet</h3>
                    </div>

                    {clubTitles.length > 0 ? (
                      <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-y-auto pr-1">
                        {clubTitles.slice().reverse().map((title) => (
                          <div key={title.season} className="relative flex min-h-44 flex-col items-center justify-end overflow-hidden border border-[#d4c8b2] bg-gradient-to-b from-[#fffdf8] to-[#eee4d2] p-3 shadow-sm dark:border-[#16130f]/10 dark:from-white/10 dark:to-black/20 dark:shadow-none">
                            <div className="pointer-events-none absolute inset-x-4 top-3 h-20 rounded-full bg-[#d6ad55]/20 blur-2xl dark:bg-white/20" />
                            <img src="/images/ipl-trophy.png" alt="Gold IPL championship trophy" className="relative min-h-0 w-full flex-1 object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.35)]" />
                            <div className="mt-2 shrink-0 text-center">
                              <div className="font-anton text-lg leading-none text-text-primary">{title.season}</div>
                              <div className="mt-1 font-space-mono text-[7px] font-bold uppercase tracking-widest text-text-secondary">IPL Champions</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                        <img src="/images/ipl-trophy.png" alt="IPL trophy silhouette" className="h-36 object-contain opacity-15 grayscale" />
                        <p className="mt-4 font-anton text-base uppercase text-text-primary">No IPL titles yet</p>
                        <p className="mt-1 max-w-52 text-xs text-text-secondary">The first championship won in this career will be added to the cabinet.</p>
                      </div>
                    )}
                  </aside>
                </div>
              )}

              {activeSubTab === "clubfigures" && (
                <div className="grid h-[calc(100vh-200px)] min-h-[500px] grid-cols-1 gap-5 overflow-hidden lg:grid-cols-3">
                  {clubFigureSections.map(({ tier, title, description }) => {
                    const tierFigures = clubFigures.filter((figure) => figure.tier === tier);
                    return (
                      <section key={tier} className="flex min-h-0 flex-col overflow-hidden border-2 border-border bg-surface p-5">
                        <div className="mb-3 shrink-0 border-b border-[#16130f]/10 pb-3">
                          <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.2em] text-text-secondary">Club figures</p>
                          <h3 className="mt-1 font-anton text-[22px] uppercase leading-none text-text-primary">{title}</h3>
                          <p className="mt-2 text-[11px] text-text-secondary">{description}</p>
                        </div>

                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                          {tierFigures.map((figure, index) => (
                            <button
                              key={figure.id}
                              type="button"
                              onClick={() => figure.playerId && setDetailedPlayerId(figure.playerId)}
                              disabled={!figure.isLinked}
                              className="flex w-full items-center gap-3 border border-[#16130f]/10 bg-black/[0.02] px-3 py-3 text-left transition-colors enabled:hover:border-accent enabled:hover:bg-accent/5 disabled:cursor-default dark:bg-white/[0.02]"
                              title={figure.isLinked ? `Open ${figure.name}'s player profile` : `${figure.name} is retired`}
                            >
                              <span className="w-6 shrink-0 text-center font-anton text-lg text-text-secondary">{index + 1}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold text-text-primary">{figure.name}</span>
                                <span className={`mt-0.5 block font-space-mono text-[9px] font-bold uppercase tracking-wider ${figure.isLinked ? "text-success" : "text-text-secondary"}`}>
                                  {!figure.isLinked
                                    ? "Retired"
                                    : figure.currentTeamId
                                      ? `Current Club: ${teams[figure.currentTeamId]?.shortName ?? figure.currentTeamId}`
                                      : "Free Agent"}
                                </span>
                                {figure.clubSeasons != null && (
                                  <span className="mt-1 block font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">
                                    {figure.legacyPoints} points · {figure.clubSeasons} club {figure.clubSeasons === 1 ? "season" : "seasons"}
                                  </span>
                                )}
                              </span>
                              {figure.isLinked && <ChevronRight size={14} className="shrink-0 text-text-secondary" />}
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}

              {activeSubTab === "leaguehistory" && (
                <section className="flex h-[calc(100vh-200px)] min-h-[500px] flex-col overflow-hidden border-2 border-border bg-surface">
                  <div
                    className="relative shrink-0 overflow-hidden border-b-2 border-border px-6 py-5 text-text-primary"
                    style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--surface2) 94%, #d97706 6%), var(--surface))" }}
                  >
                    <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-orange-400/15 blur-3xl dark:bg-orange-500/20" />
                    <div className="pointer-events-none absolute right-24 top-0 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl dark:bg-purple-600/25" />
                    <div className="relative flex items-end justify-between gap-6">
                      <div>
                        <p className="font-space-mono text-[9px] font-bold uppercase tracking-[0.24em] text-text-secondary">The complete honours archive</p>
                        <div className="mt-2 flex items-center gap-3">
                          <Trophy size={25} className="text-amber-400" />
                          <h3 className="font-anton text-[30px] uppercase leading-none">IPL League History</h3>
                        </div>
                        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-text-secondary">
                          Every final and individual cap winner from the inaugural season. Career seasons will be saved separately with an expandable final league table.
                        </p>
                      </div>
                      <div className="hidden shrink-0 gap-8 text-right md:flex">
                        <div>
                          <div className="font-anton text-[28px] leading-none">{HISTORICAL_LEAGUE_HISTORY.length}</div>
                          <div className="mt-1 font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">Official seasons</div>
                        </div>
                        <div>
                          <div className="font-anton text-[28px] leading-none">{careerLeagueHistoryCount}</div>
                          <div className="mt-1 font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">Career seasons</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-auto">
                    <div className="min-w-[1340px]">
                      <div className="sticky top-0 z-10 grid grid-cols-[5rem_minmax(30rem,2.2fr)_minmax(9.5rem,0.75fr)_minmax(9.5rem,0.75fr)_minmax(9.5rem,0.75fr)_minmax(9.5rem,0.75fr)_2.5rem] items-center border-b border-border bg-surface2 px-5 py-3 font-space-mono text-[8px] font-bold uppercase tracking-[0.14em] text-text-secondary shadow-sm">
                        <span>Season</span>
                        <span>Finalists</span>
                        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-orange-500" />Orange Cap</span>
                        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-purple-700" />Purple Cap</span>
                        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-500" />Emerging Player</span>
                        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />MVP</span>
                        <span />
                      </div>

                      {leagueHistorySeasons.map((season) => {
                        const champion = getLeagueHistoryTeam(season.championTeamId);
                        const runnerUp = getLeagueHistoryTeam(season.runnerUpTeamId);
                        const orangeCapTeam = getLeagueHistoryTeam(season.orangeCap.teamId);
                        const purpleCapTeam = getLeagueHistoryTeam(season.purpleCap.teamId);
                        const emergingPlayerTeam = season.emergingPlayer
                          ? getLeagueHistoryTeam(season.emergingPlayer.teamId)
                          : null;
                        const mvpTeam = season.mvp ? getLeagueHistoryTeam(season.mvp.teamId) : null;
                        const orangeCapPlayer = leagueHistoryPlayerByName.get(normalizeLeagueHistoryPlayerName(season.orangeCap.name));
                        const purpleCapPlayer = leagueHistoryPlayerByName.get(normalizeLeagueHistoryPlayerName(season.purpleCap.name));
                        const emergingPlayerProfile = season.emergingPlayer
                          ? leagueHistoryPlayerByName.get(normalizeLeagueHistoryPlayerName(season.emergingPlayer.name))
                          : null;
                        const mvpPlayer = season.mvp
                          ? leagueHistoryPlayerByName.get(normalizeLeagueHistoryPlayerName(season.mvp.name))
                          : null;
                        const seasonArchive = careerSeasonArchives.find((archive) => archive.season === season.season);
                        const archivedFixtures = (seasonArchive?.fixtures ?? []) as Match[];
                        const canExpand = season.source === "career" && Boolean(season.standings?.length || archivedFixtures.length);
                        const isExpanded = canExpand && expandedLeagueHistorySeason === season.season;

                        return (
                          <div key={`${season.source}-${season.season}`} className={season.source === "career" ? "bg-accent/[0.035]" : ""}>
                            <div
                              role={canExpand ? "button" : undefined}
                              tabIndex={canExpand ? 0 : undefined}
                              onClick={canExpand ? () => setExpandedLeagueHistorySeason(isExpanded ? null : season.season) : undefined}
                              onKeyDown={canExpand ? (event) => {
                                if (event.target !== event.currentTarget) return;
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setExpandedLeagueHistorySeason(isExpanded ? null : season.season);
                                }
                              } : undefined}
                              aria-expanded={canExpand ? isExpanded : undefined}
                              className={`grid min-h-[74px] w-full grid-cols-[5rem_minmax(30rem,2.2fr)_minmax(9.5rem,0.75fr)_minmax(9.5rem,0.75fr)_minmax(9.5rem,0.75fr)_minmax(9.5rem,0.75fr)_2.5rem] items-center border-b border-[#16130f]/10 px-5 text-left transition-colors ${canExpand ? "cursor-pointer hover:bg-accent/[0.07]" : "cursor-default"}`}
                            >
                              <span>
                                <span className="block font-anton text-[21px] leading-none text-text-primary">{season.season}</span>
                                <span className={`mt-1 block font-space-mono text-[7px] font-bold uppercase tracking-wider ${season.source === "career" ? "text-accent" : "text-text-secondary"}`}>
                                  {season.source === "career" ? "Career season" : "Official record"}
                                </span>
                              </span>

                              <span className="flex min-w-0 items-center gap-3 pr-5">
                                <span
                                  className="flex shrink-0 items-center gap-2 border border-[var(--team-primary-color)] bg-[var(--team-primary-color)] px-3 py-2 shadow-sm dark:border-[var(--team-primary-color-dark)] dark:bg-[var(--team-primary-color-dark)]"
                                  style={{ ...getTeamColorStyle(champion), color: champion.secondaryColor }}
                                  title={`${champion.name}, champions`}
                                >
                                  <Trophy size={13} className="shrink-0" />
                                  <span className="whitespace-nowrap font-bold">{champion.name}</span>
                                  <span className="shrink-0 font-space-mono text-[7px] font-bold uppercase opacity-70">Champion</span>
                                </span>
                                <span className="shrink-0 font-space-mono text-[8px] font-bold uppercase text-text-secondary">def.</span>
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--team-primary-color)] dark:bg-[var(--team-primary-color-dark)]" style={getTeamColorStyle(runnerUp)} />
                                  <span className="truncate text-xs font-semibold text-text-primary">{runnerUp.name}</span>
                                </span>
                              </span>

                              <span className="min-w-0 pr-4">
                                {orangeCapPlayer ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setDetailedPlayerId(orangeCapPlayer.id);
                                    }}
                                    className="group flex max-w-full items-center gap-1 text-[13px] font-bold text-text-primary hover:text-accent"
                                    title={`Open ${orangeCapPlayer.name}'s player profile`}
                                  >
                                    <span className="truncate group-hover:underline">{season.orangeCap.name}</span>
                                    <ChevronRight size={12} className="shrink-0 opacity-55" />
                                  </button>
                                ) : (
                                  <span className="block truncate text-[13px] font-bold text-text-primary">{season.orangeCap.name}</span>
                                )}
                                <span className="mt-1 flex items-center gap-1.5 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                                  <span className="h-2 w-2 rounded-full bg-[var(--team-primary-color)] dark:bg-[var(--team-primary-color-dark)]" style={getTeamColorStyle(orangeCapTeam)} />
                                  {orangeCapTeam.shortName}
                                </span>
                              </span>

                              <span className="min-w-0 pr-4">
                                {purpleCapPlayer ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setDetailedPlayerId(purpleCapPlayer.id);
                                    }}
                                    className="group flex max-w-full items-center gap-1 text-[13px] font-bold text-text-primary hover:text-accent"
                                    title={`Open ${purpleCapPlayer.name}'s player profile`}
                                  >
                                    <span className="truncate group-hover:underline">{season.purpleCap.name}</span>
                                    <ChevronRight size={12} className="shrink-0 opacity-55" />
                                  </button>
                                ) : (
                                  <span className="block truncate text-[13px] font-bold text-text-primary">{season.purpleCap.name}</span>
                                )}
                                <span className="mt-1 flex items-center gap-1.5 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                                  <span className="h-2 w-2 rounded-full bg-[var(--team-primary-color)] dark:bg-[var(--team-primary-color-dark)]" style={getTeamColorStyle(purpleCapTeam)} />
                                  {purpleCapTeam.shortName}
                                </span>
                              </span>

                              <span className="min-w-0 pr-4">
                                {season.emergingPlayer ? (
                                  <>
                                    {emergingPlayerProfile ? (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setDetailedPlayerId(emergingPlayerProfile.id);
                                        }}
                                        className="group flex max-w-full items-center gap-1 text-[13px] font-bold text-text-primary hover:text-accent"
                                        title={`Open ${emergingPlayerProfile.name}'s player profile`}
                                      >
                                        <span className="truncate group-hover:underline">{season.emergingPlayer.name}</span>
                                        <ChevronRight size={12} className="shrink-0 opacity-55" />
                                      </button>
                                    ) : (
                                      <span className="block truncate text-[13px] font-bold text-text-primary">{season.emergingPlayer.name}</span>
                                    )}
                                    <span className="mt-1 flex items-center gap-1.5 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                                      <span className="h-2 w-2 rounded-full bg-[var(--team-primary-color)] dark:bg-[var(--team-primary-color-dark)]" style={getTeamColorStyle(emergingPlayerTeam)} />
                                      {emergingPlayerTeam?.shortName}
                                    </span>
                                  </>
                                ) : (
                                  <span className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Not recorded</span>
                                )}
                              </span>

                              <span className="min-w-0 pr-4">
                                {season.mvp ? (
                                  <>
                                    {mvpPlayer ? (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setDetailedPlayerId(mvpPlayer.id);
                                        }}
                                        className="group flex max-w-full items-center gap-1 text-[13px] font-bold text-text-primary hover:text-accent"
                                        title={`Open ${mvpPlayer.name}'s player profile`}
                                      >
                                        <span className="truncate group-hover:underline">{season.mvp.name}</span>
                                        <ChevronRight size={12} className="shrink-0 opacity-55" />
                                      </button>
                                    ) : (
                                      <span className="block truncate text-[13px] font-bold text-text-primary">{season.mvp.name}</span>
                                    )}
                                    <span className="mt-1 flex items-center gap-1.5 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                                      <span className="h-2 w-2 rounded-full bg-[var(--team-primary-color)] dark:bg-[var(--team-primary-color-dark)]" style={getTeamColorStyle(mvpTeam)} />
                                      {mvpTeam?.shortName}
                                    </span>
                                  </>
                                ) : (
                                  <span className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Not recorded</span>
                                )}
                              </span>

                              <span className="flex justify-end text-text-secondary">
                                {canExpand && <ChevronDown size={17} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />}
                              </span>
                            </div>

                            {isExpanded && (
                              <div className="border-b-2 border-accent/30 bg-black/[0.025] px-10 py-5 dark:bg-white/[0.025]">
                                <div className="mb-5 flex items-end justify-between">
                                  <div>
                                    <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-accent">Saved career season</p>
                                    <h4 className="mt-1 font-anton text-[18px] uppercase text-text-primary">{season.season} Season Review</h4>
                                  </div>
                                  <span className="font-space-mono text-[8px] uppercase text-text-secondary">Playoffs and final standings</span>
                                </div>

                                <div className="isolate mb-6 min-h-[205px] border border-border bg-surface p-4">
                                  <PlayoffDiagramContent
                                    fixtures={archivedFixtures}
                                    teams={teams}
                                    standings={season.standings}
                                    championTeamId={season.championTeamId}
                                    runnerUpTeamId={season.runnerUpTeamId}
                                  />
                                </div>

                                {season.standings && <div className="overflow-hidden border border-border bg-surface">
                                  <div className="grid grid-cols-[3rem_minmax(14rem,1fr)_4rem_4rem_4rem_4rem_5rem_4rem] border-b border-border bg-black/[0.04] px-3 py-2 font-space-mono text-[8px] font-bold uppercase text-text-secondary dark:bg-white/[0.04]">
                                    <span>Pos</span><span>Team</span><span className="text-center">P</span><span className="text-center">W</span><span className="text-center">L</span><span className="text-center">NR</span><span className="text-center">NRR</span><span className="text-center">Pts</span>
                                  </div>
                                  {season.standings.map((standing, index) => {
                                    const standingTeam = getLeagueHistoryTeam(standing.teamId);
                                    return (
                                      <div key={standing.teamId} className={`grid grid-cols-[3rem_minmax(14rem,1fr)_4rem_4rem_4rem_4rem_5rem_4rem] items-center border-b border-[#16130f]/10 px-3 py-2 text-xs last:border-b-0 ${standing.teamId === userTeamId ? "bg-accent/[0.08] font-bold" : ""}`}>
                                        <span className="font-space-mono font-bold text-text-primary">{index + 1}</span>
                                        <span className="flex min-w-0 items-center gap-2 font-semibold text-text-primary"><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--team-primary-color)] dark:bg-[var(--team-primary-color-dark)]" style={getTeamColorStyle(standingTeam)} /><span className="truncate">{standing.teamName || standingTeam.name}</span></span>
                                        <span className="text-center font-space-mono text-text-secondary">{standing.played}</span>
                                        <span className="text-center font-space-mono text-text-secondary">{standing.won}</span>
                                        <span className="text-center font-space-mono text-text-secondary">{standing.lost}</span>
                                        <span className="text-center font-space-mono text-text-secondary">{standing.noResults}</span>
                                        <span className="text-center font-space-mono text-text-secondary">{standing.nrr > 0 ? "+" : ""}{standing.nrr.toFixed(3)}</span>
                                        <span className="text-center font-space-mono font-bold text-text-primary">{standing.points}</span>
                                      </div>
                                    );
                                  })}
                                </div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}

              {activeSubTab === "leaguehalloffame" && (
                <LeagueHallOfFame
                  players={players}
                  teams={teams}
                  onOpenPlayer={setDetailedPlayerId}
                />
              )}

              {activeSubTab === "records" && (
                <LeagueRecords
                  players={players}
                  retiredPlayerSnapshots={retiredPlayerSnapshots}
                  teams={teams}
                  onOpenPlayer={setDetailedPlayerId}
                  fixtures={fixtures}
                  seasonArchives={careerSeasonArchives}
                />
              )}

              {activeSubTab !== "overview" && activeSubTab !== "records" && activeSubTab !== "minorrecords" && activeSubTab !== "clubhistory" && activeSubTab !== "clubfigures" && activeSubTab !== "leaguehistory" && activeSubTab !== "leaguehalloffame" && (
                <div className="bg-surface border-2 border-border p-8 text-center h-[calc(100vh-200px)] min-h-[500px] flex flex-col items-center justify-center">
                  <h3 className="font-anton text-[18px] text-text-primary uppercase">{getSubTabLabel(activeSubTab)}</h3>
                  <p className="mt-3 text-xs text-text-secondary">No history has been recorded yet.</p>
                </div>
              )}
            </>
          )}

        </div>
      </section>

      {/* ==================================================================
          MODAL: PLAYER DETAILED STATS POPUP
          ================================================================== */}
      <PlayerProfileModal
        playerId={detailedPlayerId}
        onClose={() => setDetailedPlayerId(null)}
        customFixtures={fixtures}
      />
      {(false as boolean) && detailedPlayer && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-12 backdrop-blur-sm animate-in fade-in duration-200"
          onMouseDown={() => setDetailedPlayerId(null)}
        >
          <div
            className="flex max-h-[calc(100vh-6rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border-2 border-border bg-surface text-text-primary shadow-2xl animate-in zoom-in-95 duration-200"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between border-b-2 border-border bg-surface px-6 py-4">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-space-mono text-[9px] font-bold uppercase tracking-widest text-text-secondary">Player Profile</span>
                  {detailedPlayer.nationality === "Overseas" && (
                    <span
                      className="rounded-[2px] px-1.5 py-0.5 font-space-mono text-[8px] font-bold text-white"
                      style={{ backgroundColor: teams[detailedPlayer.currentTeamId ?? ""]?.primaryColor ?? "var(--accent)" }}
                    >
                      OS
                    </span>
                  )}
                </div>
                <h3 className="truncate font-anton text-[28px] uppercase leading-none text-text-primary">{detailedPlayer.name}</h3>
                <p className="mt-2 font-space-mono text-[10px] uppercase text-text-secondary">
                  {detailedPlayer.role} · Age {detailedPlayer.age} · {teams[detailedPlayer.currentTeamId ?? ""]?.name ?? "No current club"}
                </p>
              </div>
              <button
                onClick={() => setDetailedPlayerId(null)}
                className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-surface text-text-primary transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Close player profile"
              >
                <X size={17} />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto bg-surface p-6">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <section className="rounded border border-border bg-bg p-4 lg:col-span-1">
                  <h4 className="mb-3 border-b border-border pb-2 font-anton text-[13px] uppercase text-text-primary">Player Details</h4>
                  <div className="space-y-2.5 font-space-mono text-[10px]">
                    {[
                      ["Nationality", detailedPlayer.nationality],
                      ["Batting", detailedPlayer.battingStyle],
                      ["Bowling", (() => {
                        if (!detailedPlayer.bowlingStyle) return "DNB";
                        if (!detailedPlayer.bowlingHand) return detailedPlayer.bowlingStyle;
                        const hand = detailedPlayer.bowlingHand === "Left-hand" ? "Left handed" : "Right handed";
                        const type = detailedPlayer.bowlingStyle === "Spinner" ? "spinner" : "pacer";
                        return `${hand} ${type}`;
                      })()],
                      ["Status", detailedPlayer.isCapped ? "Capped" : "Uncapped"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
                        <span className="uppercase text-text-secondary">{label}</span>
                        <span className="text-right font-bold text-text-primary">{value}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded border border-border bg-bg p-4 lg:col-span-2">
                  <h4 className="mb-3 border-b border-border pb-2 font-anton text-[13px] uppercase text-text-primary">Ability</h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["Batting CA", detailedPlayer.currentBatting],
                      ["Batting PA", detailedPlayer.potentialBatting],
                      ["Bowling CA", detailedPlayer.currentBowling],
                      ["Bowling PA", detailedPlayer.potentialBowling],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded border border-border bg-surface p-3 text-center">
                        <div className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">{label}</div>
                        <div className="mt-1 font-anton text-[24px] text-text-primary">{value}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded border border-border bg-bg p-4 lg:col-span-3">
                  <h4 className="mb-3 border-b border-border pb-2 font-anton text-[13px] uppercase text-text-primary">Career T20 Stats</h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                    {[
                      ["Matches", detailedPlayer.careerStats?.batting.matches ?? 0],
                      ["Bat Inns", detailedPlayer.careerStats?.batting.innings ?? 0],
                      ["Runs", detailedPlayer.careerStats?.batting.runs ?? 0],
                      ["Bat Avg", detailedPlayer.careerStats?.batting.average ?? 0],
                      ["Strike Rate", detailedPlayer.careerStats?.batting.strikeRate ?? 0],
                      ["Bowl Inns", detailedPlayer.careerStats?.bowling.matches ?? 0],
                      ["Wickets", detailedPlayer.careerStats?.bowling.wickets ?? 0],
                      ["Bowl Avg", detailedPlayer.careerStats?.bowling.average ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded border border-border bg-surface px-2 py-3 text-center">
                        <div className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">{label}</div>
                        <div className="mt-1 font-anton text-[18px] text-text-primary">{formatStatValue(Number(value))}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded border border-border bg-bg p-4 lg:col-span-3">
                  <h4 className="mb-3 border-b border-border pb-2 font-anton text-[13px] uppercase text-text-primary">IPL Stats</h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                    {[
                      ["Matches", detailedPlayer.iplStats?.matches ?? 0],
                      ["Runs", detailedPlayer.iplStats?.runs ?? 0],
                      ["Bat Avg", detailedPlayer.iplStats?.battingAverage ?? 0],
                      ["Strike Rate", detailedPlayer.iplStats?.strikeRate ?? 0],
                      ["Bowl Inns", detailedPlayer.iplStats?.bowlingInnings ?? 0],
                      ["Wickets", detailedPlayer.iplStats?.wickets ?? 0],
                      ["Bowl Avg", detailedPlayer.iplStats?.bowlingAverage ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded border border-border bg-surface px-2 py-3 text-center">
                        <div className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">{label}</div>
                        <div className="mt-1 font-anton text-[18px] text-text-primary">{formatStatValue(Number(value))}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded border border-border bg-bg p-4 lg:col-span-3">
                  <h4 className="mb-3 border-b border-border pb-2 font-anton text-[13px] uppercase text-text-primary">Team History</h4>
                  <div className="grid grid-cols-[4rem_minmax(0,1fr)_5rem_4rem] gap-3 border-b border-border pb-2 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                    <span>Season</span>
                    <span>Team</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">Method</span>
                  </div>
                  <div>
                    {[...detailedPlayerHistory]
                      .filter(entry => entry.teamId && entry.teamId !== "UNSOLD")
                      .sort((a, b) => Number(b.season) - Number(a.season))
                      .map(entry => {
                        const trade = tradeRecords.find(record => record.season === Number(entry.season) && [...record.outgoingPlayerIds, ...record.incomingPlayerIds].includes(detailedPlayer.id));
                        const movedFromId = trade?.outgoingPlayerIds.includes(detailedPlayer.id) ? trade.fromTeamId : trade?.toTeamId;
                        const movedToId = trade?.outgoingPlayerIds.includes(detailedPlayer.id) ? trade.toTeamId : trade?.fromTeamId;
                        const exchangeIds = trade?.outgoingPlayerIds.includes(detailedPlayer.id) ? trade.incomingPlayerIds : trade?.outgoingPlayerIds;
                        return <Fragment key={`${entry.season}-${entry.teamId}`}>
                        {trade && <div className="my-2 border-y border-accent/40 bg-accent/10 px-3 py-2 font-space-mono text-[8px] font-bold uppercase text-text-primary">{detailedPlayer.name} was traded from {teams[movedFromId ?? ""]?.shortName ?? movedFromId} to {teams[movedToId ?? ""]?.shortName ?? movedToId} in exchange for {(exchangeIds ?? []).map(id => players[id]?.name ?? id).join(" + ")}</div>}
                        <div className="grid min-h-9 grid-cols-[4rem_minmax(0,1fr)_5rem_4rem] items-center gap-3 border-b border-border/60 text-[10px]">
                          <span className="font-space-mono text-text-secondary">{entry.season}</span>
                          <span className="truncate font-semibold text-text-primary">{teams[entry.teamId]?.name ?? entry.teamId}</span>
                          <span className="text-right font-space-mono text-text-primary">{entry.price > 0 ? formatPrice(entry.price) : "—"}</span>
                          <span className="text-right font-space-mono text-[8px] font-bold uppercase text-text-secondary">{entry.isInjuryReplacement ? "Injury replacement" : entry.isRtm ? "RTM" : "Signed"}</span>
                        </div></Fragment>;
                      })}
                    {detailedPlayerHistory.every(entry => !entry.teamId || entry.teamId === "UNSOLD") && (
                      <p className="py-5 text-center text-xs text-text-secondary">No team history recorded.</p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingMatchPreparation && (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded border-2 border-border bg-surface shadow-xl">
            <div className="flex items-start justify-between border-b-2 border-accent bg-[var(--ink)] p-5">
              <div>
                <div className={`font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] ${
                  pendingMatchPreparation.errors.length > 0 ? "text-red-300" : "text-amber-300"
                }`}>
                  {pendingMatchPreparation.errors.length > 0 ? "Match blocked" : "Match-plan warning"}
                </div>
                <h3 className="mt-1 font-anton text-[22px] uppercase text-white">
                  {pendingMatchPreparation.errors.length > 0
                    ? "Your XIs are not match-ready"
                    : "Review your lineup issues"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingMatchPreparation(null)}
                className="flex h-8 w-8 items-center justify-center rounded border border-white/30 bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Close match preparation"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {(pendingMatchPreparation.errors.length > 0
                ? pendingMatchPreparation.errors
                : pendingMatchPreparation.warnings
              ).map((message) => (
                <div
                  key={message}
                  className={`rounded border p-3 font-space-mono text-[9px] leading-relaxed ${
                    pendingMatchPreparation.errors.length > 0
                      ? "border-danger/30 bg-danger/5 text-text-primary"
                      : "border-warning/30 bg-warning/5 text-text-primary"
                  }`}
                >
                  {message}
                </div>
              ))}

              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => {
                    const destination = pendingMatchPreparation.errors.length > 0
                      ? "playingxi"
                      : pendingMatchPreparation.warningDestination;
                    setPendingMatchPreparation(null);
                    setActiveTab("squad");
                    router.push(`/game/overview?tab=squad&subtab=${destination}`, { scroll: false });
                  }}
                  className="rounded border-2 border-border px-4 py-2 font-space-mono text-[9px] font-bold uppercase text-text-primary hover:border-accent"
                >
                  Amend lineup
                </button>
                {pendingMatchPreparation.errors.length > 0 ? (
                  <button
                    type="button"
                    onClick={autoFixAndSimulatePendingMatch}
                    className="rounded border-2 border-accent bg-accent px-4 py-2 font-space-mono text-[9px] font-bold uppercase text-white"
                  >
                    Auto-fix &amp; simulate
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => runFixtureSimulation(pendingMatchPreparation.matchId)}
                    className="rounded border-2 border-accent bg-accent px-4 py-2 font-space-mono text-[9px] font-bold uppercase text-white"
                  >
                    Ignore &amp; continue
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          MODAL: DETAILED SCORECARD AND SIM COMMENTARY POPUP
          ================================================================== */}
      {activeScorecard && (
        <div className="fixed inset-0 bg-black/60 z-[95] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto py-10 animate-in fade-in duration-200">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded border-2 border-border bg-surface text-left font-barlow shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b-2 border-accent bg-[#16130f] p-5 dark:bg-[#0f1420]">
              <div>
                <span className="font-space-mono text-[9px] font-bold text-accent uppercase">MATCH {activeScorecard.matchNumber} · RESULT</span>
                <h3 className="mt-0.5 font-anton text-[24px] uppercase leading-tight text-white">
                  {teams[activeScorecard.teamA]?.name} vs {teams[activeScorecard.teamB]?.name}
                </h3>
              </div>
              <button
                onClick={() => {
                  setActiveScorecard(null);
                  setActiveCommentary(null);
                  setActiveMatchResultView("scorecard");
                }}
                className="flex h-8 w-8 items-center justify-center rounded border border-white/30 bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
              {/* Scores summary */}
              <div className="flex justify-between items-center bg-[#16130f]/5 border border-border p-4 rounded text-center">
                <div className="flex-1">
                  <div className="font-anton text-[18px] text-text-primary">{teams[activeScorecard.teamA]?.shortName}</div>
                  <div className="font-anton text-[28px] text-accent mt-1">
                    {activeScorecard.scoreA?.runs}/{activeScorecard.scoreA?.wickets}
                  </div>
                  <div className="font-space-mono text-[9px] text-text-secondary mt-1">{activeScorecard.scoreA?.overs} Overs</div>
                </div>
                <div className="font-anton text-[20px] text-text-secondary font-bold px-4">VS</div>
                <div className="flex-1">
                  <div className="font-anton text-[18px] text-text-primary">{teams[activeScorecard.teamB]?.shortName}</div>
                  <div className="font-anton text-[28px] text-accent mt-1">
                    {activeScorecard.scoreB?.runs}/{activeScorecard.scoreB?.wickets}
                  </div>
                  <div className="font-space-mono text-[9px] text-text-secondary mt-1">{activeScorecard.scoreB?.overs} Overs</div>
                </div>
              </div>

              {/* Match Result announcement */}
              <div className="text-center font-anton text-[16px] text-success bg-success/5 border border-success/15 py-2.5 uppercase tracking-wide">
                {appendRainAffectedResultLabel(
                  activeScorecard.simulation?.resultText
                    ?? (activeScorecard.winner
                      ? `${teams[activeScorecard.winner]?.name ?? activeScorecard.winner} won the match`
                      : "Match tied"),
                  isRainAffectedMatch(activeScorecard),
                )}
              </div>

              {/* Detail Tabs selector */}
              <div className="flex gap-2 border-b border-[#16130f]/10 pb-3">
                <button
                  onClick={() => {
                    setActiveCommentary(null);
                    setActiveMatchResultView("scorecard");
                  }}
                  className={`px-4 py-1.5 font-space-mono text-[10px] font-bold uppercase rounded border transition-all
                    ${activeMatchResultView === "scorecard" ? "bg-[var(--ink)] text-bg border-[var(--ink)]" : "border-border text-text-secondary hover:bg-black/5"}`}
                >
                  Scorecard
                </button>
                <button
                  onClick={() => {
                    setActiveCommentary(activeScorecard.commentary ?? []);
                    setActiveMatchResultView("summary");
                  }}
                  className={`px-4 py-1.5 font-space-mono text-[10px] font-bold uppercase rounded border transition-all
                    ${activeMatchResultView === "summary" ? "bg-[var(--ink)] text-bg border-[var(--ink)]" : "border-border text-text-secondary hover:bg-black/5"}`}
                >
                  Match Summary
                </button>
                {activeScorecard.simulation && (
                  <button
                    onClick={() => {
                      setActiveCommentary(null);
                      setActiveMatchResultView("ball-by-ball");
                    }}
                    className={`px-4 py-1.5 font-space-mono text-[10px] font-bold uppercase rounded border transition-all
                      ${activeMatchResultView === "ball-by-ball" ? "bg-[var(--ink)] text-bg border-[var(--ink)]" : "border-border text-text-secondary hover:bg-black/5"}`}
                  >
                    Ball by ball
                  </button>
                )}
              </div>

              {activeMatchResultView === "scorecard" && activeScorecard.scorecard && (
                <div className="flex flex-wrap gap-2">
                  {(["teamA", "teamB"] as const).map((inningsTeam) => {
                    const teamId = activeScorecard[inningsTeam];
                    const isActive = activeScorecardInningsTeam === inningsTeam;
                    return (
                      <button
                        key={inningsTeam}
                        type="button"
                        onClick={() => setActiveScorecardInningsTeam(inningsTeam)}
                        aria-pressed={isActive}
                        className={`rounded border px-4 py-2 font-space-mono text-[9px] font-bold uppercase transition-colors ${
                          isActive
                            ? "border-accent bg-accent text-white"
                            : "border-border bg-surface text-text-secondary hover:border-accent hover:text-text-primary"
                        }`}
                      >
                        {teams[teamId]?.name ?? teamId}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Scorecard tab */}
              {activeMatchResultView === "scorecard" && activeScorecard.scorecard && (
                <div className="flex flex-col gap-6">
                  {activeScorecardInningsTeam === "teamA" && (
                    <>
                  {/* Innings 1 scorecard */}
                  <div className={activeScorecard.simulation?.battingFirstTeamId === activeScorecard.teamB ? "order-3" : "order-1"}>
                    <h4 className="font-anton text-[13px] text-text-primary border-l-4 border-accent pl-2 mb-3 uppercase">
                      {teams[activeScorecard.teamA]?.name} Batting
                    </h4>
                    <table className="w-full text-left font-barlow text-xs divide-y divide-[#16130f]/10">
                      <thead className="bg-[#16130f]/5 text-[8px] font-space-mono text-text-secondary uppercase">
                        <tr>
                          <th className="px-4 py-2">Batsman</th>
                          <th className="px-4 py-2 text-center">Runs</th>
                          <th className="px-4 py-2 text-center">Balls</th>
                          <th className="px-4 py-2 text-center">4s</th>
                          <th className="px-4 py-2 text-center">6s</th>
                          <th className="px-4 py-2 text-right">SR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeScorecard.scorecard.inningsA.batting.filter(b=>(b.balls ?? 0) > 0).map(b => (
                          <tr key={b.id} className="border-b border-[#16130f]/5">
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2 font-semibold">
                                <span>{b.name}</span>
                                {isIncomingImpactPlayer(activeScorecard, b.id) && (
                                  <span className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 font-space-mono text-[7px] font-bold uppercase text-success">
                                    <span aria-hidden="true">→</span> In
                                  </span>
                                )}
                                {isOutgoingImpactPlayer(activeScorecard, b.id) && (
                                  <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 font-space-mono text-[7px] font-bold uppercase text-red-700">
                                    <span aria-hidden="true">←</span> Out
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 font-space-mono text-[7px] text-text-secondary">{b.dismissal ?? "not out"}</div>
                            </td>
                            <td className="px-4 py-2 text-center font-bold text-text-primary">{b.runs}</td>
                            <td className="px-4 py-2 text-center text-text-secondary font-space-mono">{b.balls}</td>
                            <td className="px-4 py-2 text-center text-text-secondary font-space-mono">{b.fours}</td>
                            <td className="px-4 py-2 text-center text-text-secondary font-space-mono">{b.sixes}</td>
                            <td className="px-4 py-2 text-right text-text-secondary font-space-mono">
                              {((b.runs ?? 0) / (b.balls ?? 1) * 100).toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="font-space-mono text-[9px] font-bold">
                        <tr className="border-t border-border">
                          <td className="px-4 py-2 uppercase">Extras</td>
                          <td className="px-4 py-2 text-center">{activeScorecard.scorecard.inningsA.extras}</td>
                          <td colSpan={4} className="px-4 py-2 text-right uppercase">
                            Total {activeScorecard.scoreA?.runs}/{activeScorecard.scoreA?.wickets}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Innings 1 Bowling */}
                  <div className={activeScorecard.simulation?.battingFirstTeamId === activeScorecard.teamB ? "order-4" : "order-2"}>
                    <h4 className="font-anton text-[13px] text-text-primary border-l-4 border-accent pl-2 mb-3 uppercase">
                      {teams[activeScorecard.teamB]?.name} Bowling
                    </h4>
                    <table className="w-full text-left font-barlow text-xs divide-y divide-[#16130f]/10">
                      <thead className="bg-[#16130f]/5 text-[8px] font-space-mono text-text-secondary uppercase">
                        <tr>
                          <th className="px-4 py-2">Bowler</th>
                          <th className="px-4 py-2 text-center">Overs</th>
                          <th className="px-4 py-2 text-center">M</th>
                          <th className="px-4 py-2 text-center">Wickets</th>
                          <th className="px-4 py-2 text-center">Runs</th>
                          <th className="px-4 py-2 text-center">WD/NB</th>
                          <th className="px-4 py-2 text-right">Econ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeScorecard.scorecard.inningsA.bowling.filter(bowl => (bowl.overs ?? 0) > 0).map(bowl => (
                          <tr key={bowl.id} className="border-b border-[#16130f]/5">
                            <td className="px-4 py-2 font-semibold">
                              <span className="inline-flex items-center gap-2">
                                <span>{bowl.name}</span>
                                {isIncomingImpactPlayer(activeScorecard, bowl.id) && (
                                  <span className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 font-space-mono text-[7px] font-bold uppercase text-success">
                                    <span aria-hidden="true">→</span> In
                                  </span>
                                )}
                                {isOutgoingImpactPlayer(activeScorecard, bowl.id) && (
                                  <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 font-space-mono text-[7px] font-bold uppercase text-red-700">
                                    <span aria-hidden="true">←</span> Out
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-center font-space-mono">{bowl.overs}</td>
                            <td className="px-4 py-2 text-center font-space-mono">{bowl.maidens ?? 0}</td>
                            <td className="px-4 py-2 text-center font-bold text-purple-700 font-space-mono">{bowl.wickets}</td>
                            <td className="px-4 py-2 text-center font-space-mono">{bowl.runsConceded}</td>
                            <td className="px-4 py-2 text-center font-space-mono">{bowl.wides ?? 0}/{bowl.noBalls ?? 0}</td>
                            <td className="px-4 py-2 text-right font-space-mono">
                              {((bowl.runsConceded ?? 0) / (bowl.overs ?? 1)).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                    </>
                  )}

                  {activeScorecardInningsTeam === "teamB" && (
                    <>
                  {/* Innings 2 scorecard */}
                  <div className={activeScorecard.simulation?.battingFirstTeamId === activeScorecard.teamB ? "order-1" : "order-3"}>
                    <h4 className="font-anton text-[13px] text-text-primary border-l-4 border-accent pl-2 mb-3 uppercase">
                      {teams[activeScorecard.teamB]?.name} Batting
                    </h4>
                    <table className="w-full text-left font-barlow text-xs divide-y divide-[#16130f]/10">
                      <thead className="bg-[#16130f]/5 text-[8px] font-space-mono text-text-secondary uppercase">
                        <tr>
                          <th className="px-4 py-2">Batsman</th>
                          <th className="px-4 py-2 text-center">Runs</th>
                          <th className="px-4 py-2 text-center">Balls</th>
                          <th className="px-4 py-2 text-center">4s</th>
                          <th className="px-4 py-2 text-center">6s</th>
                          <th className="px-4 py-2 text-right">SR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeScorecard.scorecard.inningsB.batting.filter(b=>(b.balls ?? 0) > 0).map(b => (
                          <tr key={b.id} className="border-b border-[#16130f]/5">
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2 font-semibold">
                                <span>{b.name}</span>
                                {isOutgoingImpactPlayer(activeScorecard, b.id) && (
                                  <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 font-space-mono text-[7px] font-bold uppercase text-red-700">
                                    <span aria-hidden="true">←</span> Out
                                  </span>
                                )}
                                {isIncomingImpactPlayer(activeScorecard, b.id) && (
                                  <span className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 font-space-mono text-[7px] font-bold uppercase text-success">
                                    <span aria-hidden="true">→</span> In
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 font-space-mono text-[7px] text-text-secondary">{b.dismissal ?? "not out"}</div>
                            </td>
                            <td className="px-4 py-2 text-center font-bold text-text-primary">{b.runs}</td>
                            <td className="px-4 py-2 text-center text-text-secondary font-space-mono">{b.balls}</td>
                            <td className="px-4 py-2 text-center text-text-secondary font-space-mono">{b.fours}</td>
                            <td className="px-4 py-2 text-center text-text-secondary font-space-mono">{b.sixes}</td>
                            <td className="px-4 py-2 text-right text-text-secondary font-space-mono">
                              {((b.runs ?? 0) / (b.balls ?? 1) * 100).toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="font-space-mono text-[9px] font-bold">
                        <tr className="border-t border-border">
                          <td className="px-4 py-2 uppercase">Extras</td>
                          <td className="px-4 py-2 text-center">{activeScorecard.scorecard.inningsB.extras}</td>
                          <td colSpan={4} className="px-4 py-2 text-right uppercase">
                            Total {activeScorecard.scoreB?.runs}/{activeScorecard.scoreB?.wickets}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Innings 2 Bowling */}
                  <div className={activeScorecard.simulation?.battingFirstTeamId === activeScorecard.teamB ? "order-2" : "order-4"}>
                    <h4 className="font-anton text-[13px] text-text-primary border-l-4 border-accent pl-2 mb-3 uppercase">
                      {teams[activeScorecard.teamA]?.name} Bowling
                    </h4>
                    <table className="w-full text-left font-barlow text-xs divide-y divide-[#16130f]/10">
                      <thead className="bg-[#16130f]/5 text-[8px] font-space-mono text-text-secondary uppercase">
                        <tr>
                          <th className="px-4 py-2">Bowler</th>
                          <th className="px-4 py-2 text-center">Overs</th>
                          <th className="px-4 py-2 text-center">M</th>
                          <th className="px-4 py-2 text-center">Wickets</th>
                          <th className="px-4 py-2 text-center">Runs</th>
                          <th className="px-4 py-2 text-center">WD/NB</th>
                          <th className="px-4 py-2 text-right">Econ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeScorecard.scorecard.inningsB.bowling.filter(bowl => (bowl.overs ?? 0) > 0).map(bowl => (
                          <tr key={bowl.id} className="border-b border-[#16130f]/5">
                            <td className="px-4 py-2 font-semibold">
                              <span className="inline-flex items-center gap-2">
                                <span>{bowl.name}</span>
                                {isOutgoingImpactPlayer(activeScorecard, bowl.id) && (
                                  <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 font-space-mono text-[7px] font-bold uppercase text-red-700">
                                    <span aria-hidden="true">←</span> Out
                                  </span>
                                )}
                                {isIncomingImpactPlayer(activeScorecard, bowl.id) && (
                                  <span className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 font-space-mono text-[7px] font-bold uppercase text-success">
                                    <span aria-hidden="true">→</span> In
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-center font-space-mono">{bowl.overs}</td>
                            <td className="px-4 py-2 text-center font-space-mono">{bowl.maidens ?? 0}</td>
                            <td className="px-4 py-2 text-center font-bold text-purple-700 font-space-mono">{bowl.wickets}</td>
                            <td className="px-4 py-2 text-center font-space-mono">{bowl.runsConceded}</td>
                            <td className="px-4 py-2 text-center font-space-mono">{bowl.wides ?? 0}/{bowl.noBalls ?? 0}</td>
                            <td className="px-4 py-2 text-right font-space-mono">
                              {((bowl.runsConceded ?? 0) / (bowl.overs ?? 1)).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                    </>
                  )}

                  {activeScorecard.simulation && (
                    <div className="order-5 grid gap-4 md:grid-cols-2">
                      {activeScorecard.simulation.innings
                        .filter((innings) => innings.battingTeamId === activeScorecard[activeScorecardInningsTeam])
                        .map((innings) => (
                        <div key={innings.inningsNumber} className="contents">
                        <div className="rounded border border-border bg-bg p-4">
                          <h4 className="font-anton text-[13px] uppercase text-text-primary">
                            {teams[innings.battingTeamId]?.shortName ?? innings.battingTeamId} innings detail
                          </h4>
                          <div className="mt-3">
                            <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Fall of wickets</div>
                            <p className="mt-1 font-space-mono text-[8px] leading-relaxed text-text-primary">
                              {innings.fallOfWickets.length > 0
                                ? innings.fallOfWickets.map((wicket) => `${wicket.score}-${wicket.wicket} (${wicket.playerName}, ${wicket.over})`).join(" · ")
                                : "No wickets lost"}
                            </p>
                          </div>
                        </div>
                        <div className="rounded border border-border bg-bg p-4">
                          <h4 className="font-anton text-[13px] uppercase text-text-primary">Partnership tree</h4>
                          {innings.partnerships.length > 0 ? (
                            <div className="relative mt-4 space-y-3" role="list" aria-label="Batting partnerships">
                              <span className="pointer-events-none absolute bottom-4 left-1/2 top-4 w-px -translate-x-1/2 bg-border" aria-hidden="true" />
                              {innings.partnerships.map((partnership, partnershipIndex) => {
                                const archivedLeftContribution = getArchivedPartnershipContribution(
                                  innings,
                                  partnershipIndex,
                                  partnership.batterIds[0],
                                );
                                const archivedRightContribution = getArchivedPartnershipContribution(
                                  innings,
                                  partnershipIndex,
                                  partnership.batterIds[1],
                                );
                                const leftRuns = partnership.batterRuns?.[0] ?? archivedLeftContribution?.runs;
                                const rightRuns = partnership.batterRuns?.[1] ?? archivedRightContribution?.runs;
                                const leftBalls = partnership.batterBalls?.[0] ?? archivedLeftContribution?.balls;
                                const rightBalls = partnership.batterBalls?.[1] ?? archivedRightContribution?.balls;
                                // Each half of the tree represents this partnership only. Scaling
                                // against innings totals made the bars unrelated to the contribution
                                // figures displayed alongside them.
                                const partnershipRuns = Math.max(1, partnership.runs);
                                const leftWidth = leftRuns === undefined ? 0 : Math.min(100, (leftRuns / partnershipRuns) * 100);
                                const rightWidth = rightRuns === undefined ? 0 : Math.min(100, (rightRuns / partnershipRuns) * 100);
                                return (
                                  <div
                                    key={`${partnershipIndex}-${partnership.batterIds.join("-")}`}
                                    className="relative grid grid-cols-[3.25rem_minmax(0,1fr)_4.5rem_minmax(0,1fr)_3.25rem] items-end gap-2"
                                    role="listitem"
                                  >
                                    <div className="pb-0.5 text-right font-space-mono text-[8px] font-bold text-text-primary">
                                      {leftRuns ?? "—"}{leftBalls === undefined ? "" : ` (${leftBalls})`}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="mb-1.5 truncate text-right font-space-mono text-[9px] font-semibold text-text-primary">
                                        {partnership.batterNames[0] ?? "Unknown"}
                                      </div>
                                      <div className="relative h-2 rounded-l bg-black/[0.06] dark:bg-white/[0.08]">
                                        <span className="absolute inset-y-0 right-0 rounded-l bg-accent" style={{ width: `${leftWidth}%` }} />
                                      </div>
                                    </div>
                                    <div className="relative z-10 rounded border border-accent/40 bg-surface px-1.5 py-1.5 text-center shadow-sm">
                                      <div className="font-anton text-[14px] leading-none text-accent">{partnership.runs}</div>
                                      <div className="mt-0.5 font-space-mono text-[6px] font-bold uppercase text-text-secondary">
                                        {partnership.balls} balls
                                      </div>
                                    </div>
                                    <div className="min-w-0">
                                      <div className="mb-1.5 truncate font-space-mono text-[9px] font-semibold text-text-primary">
                                        {partnership.batterNames[1] ?? "Unknown"}
                                      </div>
                                      <div className="relative h-2 rounded-r bg-black/[0.06] dark:bg-white/[0.08]">
                                        <span className="absolute inset-y-0 left-0 rounded-r bg-accent" style={{ width: `${rightWidth}%` }} />
                                      </div>
                                    </div>
                                    <div className="pb-0.5 font-space-mono text-[8px] font-bold text-text-primary">
                                      {rightRuns ?? "—"}{rightBalls === undefined ? "" : ` (${rightBalls})`}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="mt-3 font-space-mono text-[8px] text-text-secondary">No partnership data available</p>
                          )}
                        </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Match log tab */}
              {activeMatchResultView === "summary" && (
                <div className="space-y-4">
                  {activeScorecard.simulation && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      {[
                        ["Toss", `${teams[activeScorecard.simulation.tossWinnerId]?.shortName ?? activeScorecard.simulation.tossWinnerId} chose to ${activeScorecard.simulation.tossDecision}`],
                        ["Stadium", activeScorecard.simulation.conditions.stadiumName],
                        ["Pitch", activeScorecard.simulation.conditions.pitchName],
                        ["Ground", `${activeScorecard.simulation.conditions.boundaries.straightMetres}m straight · ${activeScorecard.simulation.conditions.boundaries.wideMetres}m wide`],
                        ["Player of match", activeScorecard.simulation.playerOfTheMatchName],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded border border-border bg-bg p-3">
                          <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">{label}</div>
                          <div className="mt-1 font-space-mono text-[9px] font-bold text-text-primary">{value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-4 rounded border border-border bg-[#16130f]/5 p-4 font-mono text-xs">
                  {(activeScorecard.commentary ?? []).map((line, index) => (
                    <div key={index} className="border-b border-[#16130f]/5 pb-2">
                      <span className="text-text-secondary font-bold mr-2">[{String(index + 1).padStart(2, "0")}]</span>
                      <span className="text-text-primary">{line}</span>
                    </div>
                  ))}
                  </div>
                  {activeScorecard.simulation && (
                    <div className="grid gap-3 md:grid-cols-2">
                      {activeScorecard.simulation.impactDecisions.map((decision) => (
                        <div key={decision.teamId} className="rounded border border-border bg-bg p-4">
                          <div className="font-space-mono text-[8px] font-bold uppercase text-accent">
                            {teams[decision.teamId]?.name ?? decision.teamId} · Impact Player
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-text-primary">{decision.explanation}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeMatchResultView === "ball-by-ball" && activeScorecard.simulation && (
                hasArchivedDeliveries(activeScorecard.simulation) ? (
                  <BallByBallSummary simulation={activeScorecard.simulation} teams={teams} />
                ) : (
                  <div className="rounded border border-border bg-bg p-8 text-center">
                    <div className="font-anton text-[18px] uppercase text-text-primary">Delivery archive unavailable</div>
                    <p className="mt-2 text-xs text-text-secondary">
                      The scorecard is saved, but this browser does not contain the match&apos;s full ball-by-ball archive.
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper utility to check if round matches are ready to be simulated
  function roundMatchesReadyToSim(round: number) {
    const unplayed = fixtures.filter(f => !f.played).sort((a,b)=>a.round - b.round);
    return unplayed.length > 0 && unplayed[0].round === round;
  }
}

export default function OverviewPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-bg">
        <div className="font-space-mono text-[11px] font-bold text-text-secondary animate-pulse uppercase tracking-widest">
          Loading Career Hub...
        </div>
      </div>
    }>
      <OverviewPageContent />
    </Suspense>
  );
}
