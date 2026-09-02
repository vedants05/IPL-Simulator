"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import {
  Activity,
  CalendarDays,
  MapPin,
  Shield,
  Star,
  Trophy,
  Users,
} from "lucide-react";

import { HISTORICAL_LEAGUE_HISTORY } from "@/lib/data/leagueHistory";
import { getClubFigures, type ClubFigureTier } from "@/lib/data/clubFigures";
import { getHomeStadium } from "@/lib/data/pitchCurator";
import { getTeamAuctionDescriptor } from "@/lib/constants/auctionDescriptors";
import { formatPrice } from "@/lib/logic/auctionRules";
import type { AiLineupPlan } from "@/lib/logic/aiLineupSelector";
import type { AiLeagueLeadership, AiTeamLeadership } from "@/lib/logic/aiLeadership";
import { dateKeyToLocalDate, getSeasonScheduleAnnouncementDate } from "@/lib/logic/careerCalendar";
import { isRainAffectedMatch } from "@/lib/logic/matchWeather";
import { getPlayerSeasonHistory } from "@/lib/logic/playerHistory";
import { cacheTeamProfileCareer, getCachedTeamProfileCareer } from "@/lib/logic/teamProfileCareerCache";
import { useGameStore } from "@/lib/store/gameStore";
import type { Player, Team } from "@/lib/types";
import TeamProfileLoading from "@/components/team/TeamProfileLoading";

const PlayerProfileModal = dynamic(
  () => import("@/components/player/PlayerProfileModal").then((module) => module.PlayerProfileModal),
  { ssr: false },
);
const MatchScorecardModal = dynamic(
  () => import("@/components/match/MatchScorecardModal"),
  { ssr: false },
);

type TeamProfileTab = "overview" | "squad" | "fixtures" | "clubfigures" | "lineups";
type ClubSquadView = "general" | "bowling" | "batting";
type ClubSquadSortKey =
  | "name" | "age" | "role" | "nationality" | "rating" | "potential" | "acquisition"
  | "bowlingCA" | "bowlingPA" | "seasonMatches" | "seasonWickets" | "seasonBowlingAverage" | "seasonEconomy" | "seasonBestBowling"
  | "battingCA" | "battingPA" | "seasonRuns" | "seasonBattingAverage" | "seasonStrikeRate" | "seasonHighScore";
type ClubSquadSortDirection = "asc" | "desc";
type AiLineupModule = typeof import("@/lib/logic/aiLineupSelector");

const TEAM_PROFILE_TABS: readonly TeamProfileTab[] = ["overview", "squad", "fixtures", "clubfigures", "lineups"];
const CLUB_FIGURE_SECTIONS: Array<{ tier: ClubFigureTier; title: string; description: string }> = [
  { tier: "legend", title: "Legends", description: "The defining names in club history" },
  { tier: "icon", title: "Icons", description: "Major figures closely associated with the club" },
  { tier: "hero", title: "Heroes", description: "Memorable performers and fan favourites" },
];
const NEXT_FIXTURE_ROW_HEIGHT = 24;

function teamProfileTabFromUrl(): TeamProfileTab {
  if (typeof window === "undefined") return "overview";
  const section = new URLSearchParams(window.location.search).get("section");
  return TEAM_PROFILE_TABS.includes(section as TeamProfileTab)
    ? section as TeamProfileTab
    : "overview";
}

interface TeamProfileStanding {
  teamId: string;
  teamName: string;
  shortName: string;
  played: number;
  won: number;
  lost: number;
  noResults: number;
  points: number;
  nrr: number;
}

interface TeamProfilePlayerStats {
  id: string;
  name: string;
  teamId: string;
  runs: number;
  balls: number;
  wickets: number;
  runsConceded: number;
  oversBowled?: number;
  matches: number;
  dismissals?: number;
  highestScore?: number;
  bestBowling?: string;
}

interface TeamProfileFixture {
  id: string;
  matchNumber: number;
  round: number;
  teamA: string;
  teamB: string;
  played: boolean;
  winner?: string;
  date?: string;
  time?: string;
  scoreA?: { runs: number; wickets: number; overs: number };
  scoreB?: { runs: number; wickets: number; overs: number };
  scorecard?: {
    inningsA: {
      batting: Array<{ id: string; name: string; runs: number; balls: number; fours: number; sixes: number; dismissal: string; notOut: boolean }>;
      bowling: Array<{ id: string; name: string; overs: number; maidens: number; runsConceded: number; wickets: number }>;
      extras: number;
    };
    inningsB: {
      batting: Array<{ id: string; name: string; runs: number; balls: number; fours: number; sixes: number; dismissal: string; notOut: boolean }>;
      bowling: Array<{ id: string; name: string; overs: number; maidens: number; runsConceded: number; wickets: number }>;
      extras: number;
    };
  };
  simulation?: any;
  commentary?: string[];
}

interface TeamProfileCareer {
  fixtures: TeamProfileFixture[];
  standings: TeamProfileStanding[];
  playerStats: Record<string, TeamProfilePlayerStats>;
  battingFirstXI: string[];
  bowlingFirstXI: string[];
  battingFirstImpactSubs: string[];
  bowlingFirstImpactSubs: string[];
  battingFirstImpactPlayerId?: string | null;
  battingFirstOutgoingPlayerId?: string | null;
  battingFirstImpactBattingPosition?: number | null;
  bowlingFirstImpactPlayerId?: string | null;
  bowlingFirstOutgoingPlayerId?: string | null;
  bowlingFirstImpactBattingPosition?: number | null;
  teamLeadership?: {
    captainId?: string | null;
    viceCaptainId?: string | null;
  };
  aiTeamLeadership?: AiLeagueLeadership;
}

const EMPTY_CAREER: TeamProfileCareer = {
  fixtures: [],
  standings: [],
  playerStats: {},
  battingFirstXI: [],
  bowlingFirstXI: [],
  battingFirstImpactSubs: [],
  bowlingFirstImpactSubs: [],
  battingFirstImpactPlayerId: null,
  battingFirstOutgoingPlayerId: null,
  battingFirstImpactBattingPosition: null,
  bowlingFirstImpactPlayerId: null,
  bowlingFirstOutgoingPlayerId: null,
  bowlingFirstImpactBattingPosition: null,
  aiTeamLeadership: {},
};

let cachedCareerSnapshot: {
  storageKey: string;
  serialized: string | null;
  career: TeamProfileCareer;
} | null = null;

function normalizeTeamProfileCareer(parsed: Partial<TeamProfileCareer>): TeamProfileCareer {
  return {
    fixtures: Array.isArray(parsed.fixtures) ? parsed.fixtures : [],
    standings: Array.isArray(parsed.standings) ? parsed.standings : [],
    playerStats: parsed.playerStats && typeof parsed.playerStats === "object" ? parsed.playerStats : {},
    battingFirstXI: Array.isArray(parsed.battingFirstXI) ? parsed.battingFirstXI : [],
    bowlingFirstXI: Array.isArray(parsed.bowlingFirstXI) ? parsed.bowlingFirstXI : [],
    battingFirstImpactSubs: Array.isArray(parsed.battingFirstImpactSubs) ? parsed.battingFirstImpactSubs : [],
    bowlingFirstImpactSubs: Array.isArray(parsed.bowlingFirstImpactSubs) ? parsed.bowlingFirstImpactSubs : [],
    battingFirstImpactPlayerId: parsed.battingFirstImpactPlayerId ?? null,
    battingFirstOutgoingPlayerId: parsed.battingFirstOutgoingPlayerId ?? null,
    battingFirstImpactBattingPosition: typeof parsed.battingFirstImpactBattingPosition === "number"
      ? parsed.battingFirstImpactBattingPosition
      : null,
    bowlingFirstImpactPlayerId: parsed.bowlingFirstImpactPlayerId ?? null,
    bowlingFirstOutgoingPlayerId: parsed.bowlingFirstOutgoingPlayerId ?? null,
    bowlingFirstImpactBattingPosition: typeof parsed.bowlingFirstImpactBattingPosition === "number"
      ? parsed.bowlingFirstImpactBattingPosition
      : null,
    teamLeadership: parsed.teamLeadership,
    aiTeamLeadership: parsed.aiTeamLeadership ?? {},
  };
}

function readTeamProfileCareer(userTeamId: string): TeamProfileCareer {
  const storageKey = `ipl_career_${userTeamId}`;
  if (typeof localStorage === "undefined") return EMPTY_CAREER;
  const serialized = localStorage.getItem(storageKey);
  if (!serialized) return EMPTY_CAREER;
  try {
    return normalizeTeamProfileCareer(JSON.parse(serialized) as Partial<TeamProfileCareer>);
  } catch {
    return EMPTY_CAREER;
  }
}

const ROLE_ORDER: Record<Player["role"], number> = {
  "WK-Batsman": 0,
  Batsman: 1,
  "All-Rounder": 2,
  "Pace Bowler": 3,
  "Spin Bowler": 4,
};

const ROLE_LABELS: Record<Player["role"], string> = {
  "WK-Batsman": "Wicketkeeper",
  Batsman: "Batter",
  "All-Rounder": "All-rounder",
  "Pace Bowler": "Pace bowler",
  "Spin Bowler": "Spin bowler",
};

const playerRating = (player: Player) => Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);

function safeDateLabel(date?: string, options?: Intl.DateTimeFormatOptions) {
  if (!date) return "Date TBC";
  try {
    return dateKeyToLocalDate(date).toLocaleDateString("en-GB", options ?? {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Trophy;
}) {
  return (
    <div className="min-w-0 border border-border bg-surface p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-space-mono text-[8px] font-bold uppercase tracking-[0.14em] text-text-secondary">{label}</span>
        <Icon className="size-3 text-accent" aria-hidden="true" />
      </div>
      <div className="mt-1.5 truncate font-anton text-[22px] uppercase leading-none text-text-primary">{value}</div>
      <div className="mt-1 truncate font-space-mono text-[7px] uppercase text-text-secondary">{detail}</div>
    </div>
  );
}

function LineupColumn({
  title,
  description,
  plan,
  players,
  squad = [],
  impactCandidates,
  team,
  aiLogic,
  isUserTeam = false,
  onSelectImpactPlayer,
  onSelectImpactPosition,
}: {
  title: string;
  description: string;
  plan: AiLineupPlan;
  players: Record<string, Player>;
  squad?: Player[];
  impactCandidates?: Player[];
  team: Team;
  aiLogic: AiLineupModule;
  isUserTeam?: boolean;
  onSelectImpactPlayer?: (playerId: string) => void;
  onSelectImpactPosition?: (position: number) => void;
}) {
  const { currentAbility, isAiBowlingOption, isBattingOption } = aiLogic;
  const starters = plan.startingXI
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player));
  const startersOverseasCount = starters.filter((p) => p.nationality === "Overseas").length;
  const isImpactPlayerWithinOverseasLimit = (candidate: Player) => {
    if (candidate.nationality !== "Overseas") return true;
    return startersOverseasCount < 4;
  };

  const startersSet = new Set(plan.startingXI);
  const benchCandidates = (impactCandidates?.length ? impactCandidates : squad ?? [])
    .filter((player) => !startersSet.has(player.id) && isImpactPlayerWithinOverseasLimit(player));

  const rawImpactPlayer = plan.impactPlayerId ? players[plan.impactPlayerId] : undefined;
  let effectiveImpactPlayer = (rawImpactPlayer && isImpactPlayerWithinOverseasLimit(rawImpactPlayer))
    ? rawImpactPlayer
    : undefined;
  if (!effectiveImpactPlayer && squad && squad.length > 0) {
    const isBowlFirstPlan = title.toLowerCase().includes("bowl");
    const legalBench = squad
      .filter((p) => !startersSet.has(p.id) && isImpactPlayerWithinOverseasLimit(p))
      .sort((left, right) => {
        if (isBowlFirstPlan) {
          const leftBat = isBattingOption(left);
          const rightBat = isBattingOption(right);
          if (leftBat !== rightBat) return Number(rightBat) - Number(leftBat);
        } else {
          const leftSpecialist = left.role === "Pace Bowler" || left.role === "Spin Bowler";
          const rightSpecialist = right.role === "Pace Bowler" || right.role === "Spin Bowler";
          if (leftSpecialist !== rightSpecialist) return Number(rightSpecialist) - Number(leftSpecialist);
          const leftBowl = isAiBowlingOption(left);
          const rightBowl = isAiBowlingOption(right);
          if (leftBowl !== rightBowl) return Number(rightBowl) - Number(leftBowl);
        }
        if (isBowlFirstPlan) {
          return (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
            || (right.currentBowling ?? 0) - (left.currentBowling ?? 0)
            || currentAbility(right) - currentAbility(left);
        }
        return (right.currentBowling ?? 0) - (left.currentBowling ?? 0)
          || (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
          || currentAbility(right) - currentAbility(left);
      });
    effectiveImpactPlayer = legalBench[0];
  }

  const rawOutgoingPlayer = plan.likelyOutgoingPlayerId ? players[plan.likelyOutgoingPlayerId] : undefined;
  let effectiveOutgoingPlayer = rawOutgoingPlayer;
  if (!effectiveOutgoingPlayer && effectiveImpactPlayer && starters.length > 0) {
    const protectedIds = new Set<string>([
      ...(plan.captainId ? [plan.captainId] : []),
      ...(plan.viceCaptainId ? [plan.viceCaptainId] : []),
      ...starters.slice(0, 4).map((p) => p.id),
      ...starters.filter((p) => p.reputation === 10).map((p) => p.id),
    ]);
    const eligibleOutgoing = starters.filter((p) => !protectedIds.has(p.id));
    if (eligibleOutgoing.length > 0) {
      effectiveOutgoingPlayer = [...eligibleOutgoing].sort((left, right) => {
        if (!title.toLowerCase().includes("bowl")) {
          return (left.currentBowling ?? 0) - (right.currentBowling ?? 0)
            || currentAbility(left) - currentAbility(right);
        }
        return (left.currentBatting ?? 0) - (right.currentBatting ?? 0)
          || currentAbility(left) - currentAbility(right);
      })[0];
    }
  }

  const impactPlayer = effectiveImpactPlayer;
  const outgoingPlayer = effectiveOutgoingPlayer;
  const effectiveImpactBattingPosition = (
    plan.impactBattingPosition ?? null
  );

  const overseasCount = starters.filter((player) => player.nationality === "Overseas").length;
  const totalOverseasCount = overseasCount + (impactPlayer?.nationality === "Overseas" ? 1 : 0);
  const isBowlFirst = title.toLowerCase().includes("bowl");

  return (
    <section className="flex min-h-0 flex-col border-2 border-border bg-surface shadow-sm">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b-2 border-border px-5 py-4">
        <div>
          <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.16em] text-accent">Projected match plan</p>
          <h2 className="mt-1 font-anton text-[22px] uppercase leading-none text-text-primary">{title}</h2>
          <p className="mt-2 text-[11px] text-text-secondary">{description}</p>
        </div>
        <div className="shrink-0 text-right font-space-mono text-[8px] font-bold uppercase text-text-secondary">
          <div>{starters.length} starters · {totalOverseasCount} OS incl. impact</div>
        </div>
      </div>
      <div
        className="grid min-h-0 flex-1 px-5 py-1"
        style={{ gridTemplateRows: "repeat(11, minmax(0, 1fr))" }}
      >
        {starters.map((player, index) => {
          const isCaptain = player.id === plan.captainId;
          const isViceCaptain = player.id === plan.viceCaptainId;
          const hasFullTimeKeeper = starters.some((p) => (p.role === "WK-Batsman" || p.isWicketkeeper) && !p.isPartTimeWk);
          const isWicketkeeper = (player.role === "WK-Batsman" || player.isWicketkeeper) && !player.isPartTimeWk
            ? true
            : Boolean(player.isPartTimeWk) && !hasFullTimeKeeper;
          return (
          <div
            key={player.id}
            className="flex min-h-0 items-center border-b border-border/60 text-[10px] last:border-b-0"
          >
            <span className="flex min-w-0 flex-1 items-center gap-1.5 font-semibold text-text-primary">
              <span className="w-5 shrink-0 font-space-mono text-[9px] font-normal text-text-secondary">{index + 1}</span>
              <span className="truncate">{player.name}</span>
              {isCaptain && (
                <span
                  className="shrink-0 rounded-[2px] border border-amber-500/60 bg-amber-400 px-1 py-0.5 font-space-mono text-[7px] font-extrabold text-black shadow-sm dark:border-yellow-400/70 dark:bg-yellow-500/25 dark:text-yellow-300"
                  title={plan.usesProvisionalCaptain ? "Provisional captain pending AI leadership rules" : "Captain"}
                >
                  C{plan.usesProvisionalCaptain ? "*" : ""}
                </span>
              )}
              {isViceCaptain && (
                <span
                  className="shrink-0 rounded-[2px] border border-slate-400/70 bg-slate-300 px-1 py-0.5 font-space-mono text-[7px] font-extrabold text-black shadow-sm dark:border-sky-400/70 dark:bg-sky-500/25 dark:text-sky-300"
                  title="Vice-captain"
                >
                  VC
                </span>
              )}
              {isWicketkeeper && <span className="shrink-0 font-space-mono text-[7px] font-bold text-danger">WK</span>}
              {player.reputation === 10 && <Star className="size-2.5 shrink-0 fill-accent text-accent" aria-label="Reputation 10 player" />}
            </span>
            <span className="w-16 shrink-0 truncate text-right font-space-mono text-[7px] font-bold uppercase text-text-secondary">
              {player.role === "WK-Batsman" ? "WK" : player.role === "All-Rounder" ? "AR" : player.role === "Pace Bowler" ? "PACE" : player.role === "Spin Bowler" ? "SPIN" : "BAT"}
              {player.nationality === "Overseas" ? " · OS" : ""}
            </span>
            <span className="w-9 shrink-0 text-right font-space-mono text-[9px] font-bold text-text-primary">{currentAbility(player)}</span>
          </div>
          );
        })}
      </div>
      <div
        className="mx-5 mb-4 mt-2 shrink-0 border px-3 py-2.5"
        style={{
          borderColor: `${team.primaryColor}66`,
          backgroundColor: `${team.primaryColor}12`,
        }}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.14em]" style={{ color: team.primaryColor }}>
                Expected {isBowlFirst ? "2nd Innings" : ""} Impact substitute
              </p>
              {isUserTeam && isBowlFirst && benchCandidates.length > 0 ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <select
                    value={impactPlayer?.id ?? ""}
                    onChange={(e) => onSelectImpactPlayer?.(e.target.value)}
                    className="rounded border border-border/80 bg-surface px-2 py-1 text-[11px] font-bold text-text-primary focus:border-accent focus:outline-none"
                    aria-label="Select expected impact substitute player"
                  >
                    {benchCandidates.map((benchPlayer) => (
                      <option key={benchPlayer.id} value={benchPlayer.id}>
                        {benchPlayer.name} ({benchPlayer.role === "All-Rounder" ? "AR" : benchPlayer.role.replace(" Bowler", "")} · {currentAbility(benchPlayer)})
                      </option>
                    ))}
                  </select>
                  <span className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Position:</span>
                  <select
                    value={plan.impactBattingPosition ?? effectiveImpactBattingPosition ?? 7}
                    onChange={(e) => onSelectImpactPosition?.(Number(e.target.value))}
                    className="rounded border border-border/80 bg-surface px-2 py-1 text-[11px] font-bold text-text-primary focus:border-accent focus:outline-none"
                    aria-label="Select expected batting position"
                  >
                    {effectiveImpactBattingPosition && (
                      <option value={effectiveImpactBattingPosition}>
                        Auto choose best position (#{effectiveImpactBattingPosition})
                      </option>
                    )}
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((pos) => (
                      <option key={pos} value={pos}>
                        #{pos} {pos <= 2 ? "(Opener)" : pos <= 5 ? "(Core)" : pos <= 7 ? "(Finisher)" : "(Lower)"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="mt-1 truncate text-[11px] font-bold text-text-primary">
                  {impactPlayer?.name ?? "No eligible impact player"}
                </div>
              )}
            </div>
            {impactPlayer && (
              <div className="shrink-0 text-right">
                <div className="font-anton text-[20px] leading-none text-text-primary">{currentAbility(impactPlayer)}</div>
                <div className="mt-1 font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                  {impactPlayer.role === "All-Rounder" ? "AR" : impactPlayer.role.replace(" Bowler", "")}
                  {impactPlayer.nationality === "Overseas" ? " · OS" : ""}
                </div>
              </div>
            )}
          </div>
          {impactPlayer && outgoingPlayer && (
            <p className="truncate border-t border-border/50 pt-1.5 font-space-mono text-[7px] uppercase text-text-secondary">
              Projected change: <span className="font-bold text-text-primary">{impactPlayer.name}</span> in for <span className="font-bold text-text-primary">{outgoingPlayer.name}</span>
              {effectiveImpactBattingPosition ? <span> at number <span className="font-bold text-accent">{effectiveImpactBattingPosition}</span></span> : ""}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function MountedTeamProfilePage() {
  const params = useParams<{ teamId: string }>();
  const teams = useGameStore((state) => state.teams);
  const players = useGameStore((state) => state.players);
  const userTeamId = useGameStore((state) => state.userTeamId);
  const currentSeason = useGameStore((state) => state.currentSeason);
  const currentDate = useGameStore((state) => state.currentDate);
  const auction = useGameStore((state) => state.auction);
  const simulatedLeagueHistory = useGameStore((state) => state.simulatedLeagueHistory);
  const careerStaff = useGameStore((state) => state.careerStaff);
  const clubFigureTierOverrides = useGameStore((state) => state.clubFigureTierOverrides);
  const clubFigureProgression = useGameStore((state) => state.clubFigureProgression);
  const [hasLoadedCareer, setHasLoadedCareer] = useState(() => Boolean(
    getCachedTeamProfileCareer<TeamProfileCareer>(userTeamId),
  ));
  const [activeTab, setActiveTab] = useState<TeamProfileTab>("overview");
  const [career, setCareer] = useState<TeamProfileCareer>(() => (
    getCachedTeamProfileCareer<TeamProfileCareer>(userTeamId) ?? EMPTY_CAREER
  ));
  const [aiLineupLogic, setAiLineupLogic] = useState<AiLineupModule | null>(null);
  const [fallbackAiLeadership, setFallbackAiLeadership] = useState<AiTeamLeadership | null>(null);
  const [visibleNextFixtureCount, setVisibleNextFixtureCount] = useState(3);
  const [activeScorecard, setActiveScorecard] = useState<TeamProfileFixture | null>(null);
  const [activeResultView, setActiveResultView] = useState<"scorecard" | "summary" | "commentary">("scorecard");
  const [detailedPlayerId, setDetailedPlayerId] = useState<string | null>(null);
  const [clubSquadView, setClubSquadView] = useState<ClubSquadView>("general");
  const [clubSquadSort, setClubSquadSort] = useState<{ key: ClubSquadSortKey; direction: ClubSquadSortDirection }>({
    key: "name",
    direction: "asc",
  });
  const nextFixturesListRef = useRef<HTMLDivElement>(null);


  const rawTeamId = Array.isArray(params.teamId) ? params.teamId[0] : params.teamId;
  const teamId = decodeURIComponent(rawTeamId ?? "").toUpperCase();
  const team = teams[teamId];
  const homeStadium = getHomeStadium(teamId);
  const clubFigures = useMemo(
    () => getClubFigures(teamId, players, clubFigureTierOverrides, clubFigureProgression),
    [clubFigureProgression, clubFigureTierOverrides, players, teamId],
  );

  const teamContracts = useMemo(() => {
    if (!careerStaff || !careerStaff.contracts || !team) return [];
    return Object.values(careerStaff.contracts).filter(
      (c) => c.teamId === team.id && c.status === "contracted"
    );
  }, [careerStaff, team]);

  const headCoach = useMemo(() => {
    return teamContracts.find(
      (c) => c.roles.includes("head_coach") || c.primaryRole === "head_coach"
    );
  }, [teamContracts]);

  const mentor = useMemo(() => {
    return teamContracts.find(
      (c) => c.roles.includes("mentor") || c.primaryRole === "mentor"
    );
  }, [teamContracts]);

  useEffect(() => {
    const syncTabWithHistory = () => setActiveTab(teamProfileTabFromUrl());
    syncTabWithHistory();
    window.addEventListener("popstate", syncTabWithHistory);
    return () => window.removeEventListener("popstate", syncTabWithHistory);
  }, []);

  useEffect(() => {
    if (activeTab !== "lineups" || aiLineupLogic) return;
    let cancelled = false;
    import("@/lib/logic/aiLineupSelector").then((module) => {
      if (!cancelled) setAiLineupLogic(module);
    }).catch((error) => {
      console.error("Unable to load team profile lineup tools:", error);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, aiLineupLogic]);

  useEffect(() => {
    if (activeTab !== "overview" || !team) return;

    const list = nextFixturesListRef.current;
    if (!list) return;

    const updateVisibleCount = () => {
      const nextCount = Math.max(1, Math.floor(list.clientHeight / NEXT_FIXTURE_ROW_HEIGHT));
      setVisibleNextFixtureCount((current) => current === nextCount ? current : nextCount);
    };

    updateVisibleCount();
    const observer = new ResizeObserver(updateVisibleCount);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeTab, team]);

  useEffect(() => {
    if (!userTeamId) return;

    const cachedCareer = getCachedTeamProfileCareer<TeamProfileCareer>(userTeamId);
    if (cachedCareer) {
      setCareer(cachedCareer);
      setHasLoadedCareer(true);
      return;
    }

    try {
      setCareer(readTeamProfileCareer(userTeamId));
    } catch (error) {
      console.error("Unable to load team profile career data:", error);
      setCareer(EMPTY_CAREER);
    }
    setHasLoadedCareer(true);
  }, [userTeamId]);

  useEffect(() => {
    if (!hasLoadedCareer || !userTeamId) return;
    cacheTeamProfileCareer(userTeamId, career);
  }, [career, hasLoadedCareer, userTeamId]);

  const squad = useMemo(() => {
    if (!team) return [];
    return team.squad
      .map((playerId) => players[playerId])
      .filter((player): player is Player => Boolean(player))
      .sort((left, right) => (
        ROLE_ORDER[left.role] - ROLE_ORDER[right.role]
        || playerRating(right) - playerRating(left)
        || left.name.localeCompare(right.name)
      ));
  }, [players, team]);

  useEffect(() => {
    if (!hasLoadedCareer || !team || team.id === userTeamId || career.aiTeamLeadership?.[team.id]) {
      setFallbackAiLeadership(null);
      return;
    }
    let cancelled = false;
    const timeoutId = globalThis.setTimeout(() => {
      import("@/lib/logic/aiLeadership").then(({ appointAiTeamLeadership }) => {
        if (!cancelled) setFallbackAiLeadership(appointAiTeamLeadership(team, squad, currentSeason));
      }).catch((error) => {
        console.error("Unable to derive team profile leadership:", error);
      });
    }, 0);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timeoutId);
    };
  }, [career.aiTeamLeadership, currentSeason, hasLoadedCareer, squad, team, userTeamId]);

  const profileAiLeadership = team && team.id !== userTeamId
    ? career.aiTeamLeadership?.[team.id] ?? fallbackAiLeadership
    : null;

  const profileLineups = useMemo(() => {
    if (activeTab !== "lineups" || !team || !aiLineupLogic) return null;

    const isProfileUserTeam = teamId === userTeamId;
    const aiLeadership = profileAiLeadership;
    const {
      buildAiMatchLineups,
      currentAbility,
      findOptimalImpactBattingPosition,
      isAiBowlingOption,
      isBattingOption,
      isImpactPlayerWithinOverseasLimit,
      resolveBowlingFirstImpactPlayer,
      selectBattingFirstOutgoingBatter,
    } = aiLineupLogic;
    const designatedCaptainId = isProfileUserTeam
      ? career.teamLeadership?.captainId
      : aiLeadership?.captainId;
    const designatedViceCaptainId = isProfileUserTeam
      ? career.teamLeadership?.viceCaptainId
      : aiLeadership?.viceCaptainId;
    const generated = buildAiMatchLineups(squad, {
      captainId: designatedCaptainId,
      viceCaptainId: designatedViceCaptainId,
      useProvisionalCaptain: !designatedCaptainId,
    });
    if (!isProfileUserTeam) {
      return generated;
    }

    const squadIds = new Set(squad.map((player) => player.id));
    const useSavedPlan = (
      savedXI: readonly string[],
      savedImpactSubs: readonly string[],
      fallback: AiLineupPlan,
      isBowlingFirst?: boolean,
    ): AiLineupPlan => {
      const startingXI = Array.from(new Set(savedXI)).filter((playerId) => squadIds.has(playerId));
      if (startingXI.length !== 11) return fallback;
      const startingPlayers = startingXI
        .map((playerId) => players[playerId])
        .filter((player): player is Player => Boolean(player));
      if (isBowlingFirst && !startingPlayers.some((player) => (
        player.role === "WK-Batsman" || Boolean(player.isWicketkeeper) || Boolean(player.isPartTimeWk)
      ))) {
        return fallback;
      }
      const isEligibleImpactId = (playerId: string) => {
        const impactPlayer = players[playerId];
        return Boolean(
          impactPlayer
          && squadIds.has(playerId)
          && !startingXI.includes(playerId)
          && isImpactPlayerWithinOverseasLimit(startingPlayers, impactPlayer),
        );
      };

      const userSelectedImpactId = isBowlingFirst ? career.bowlingFirstImpactPlayerId : career.battingFirstImpactPlayerId;
      const userSelectedOutgoingId = isBowlingFirst ? career.bowlingFirstOutgoingPlayerId : career.battingFirstOutgoingPlayerId;
      let savedImpactPlayerId = (userSelectedImpactId && isEligibleImpactId(userSelectedImpactId))
        ? userSelectedImpactId
        : (savedImpactSubs
          .map((playerId) => players[playerId])
          .filter((player): player is Player => Boolean(
            player
            && isEligibleImpactId(player.id)
            && (isBowlingFirst || isAiBowlingOption(player))
          ))
          .sort((left, right) => (
            (isBowlingFirst
              ? (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
              : (right.currentBowling ?? 0) - (left.currentBowling ?? 0))
            || currentAbility(right) - currentAbility(left)
            || (right.reputation ?? 0) - (left.reputation ?? 0)
          ))[0]?.id
          ?? (fallback.impactPlayerId && isEligibleImpactId(fallback.impactPlayerId)
            ? fallback.impactPlayerId
            : null));

      if (!savedImpactPlayerId) {
        const benchPool = squad
          .filter((p) => !startingXI.includes(p.id) && isImpactPlayerWithinOverseasLimit(startingPlayers, p))
          .sort((left, right) => {
            const leftScore = isBowlingFirst
              ? (left.currentBatting ?? 0) * 0.7 + (left.currentBowling ?? 0) * 0.3
              : (left.currentBowling ?? 0) * 0.7 + (left.currentBatting ?? 0) * 0.3;
            const rightScore = isBowlingFirst
              ? (right.currentBatting ?? 0) * 0.7 + (right.currentBowling ?? 0) * 0.3
              : (right.currentBowling ?? 0) * 0.7 + (right.currentBatting ?? 0) * 0.3;
            return rightScore - leftScore || playerRating(right) - playerRating(left);
          });

        if (benchPool.length > 0) {
          savedImpactPlayerId = benchPool[0].id;
        }
      }

      let forceImpactPosition8 = false;
      let replacedOpenerImpact = false;
      const customPos = isBowlingFirst ? career.bowlingFirstImpactBattingPosition : career.battingFirstImpactBattingPosition;
      const hasValidCustomPosition = typeof customPos === "number"
        && customPos >= 1
        && customPos <= 11;
      let intendedImpactPosition = hasValidCustomPosition
        ? customPos
        : fallback.impactBattingPosition;
      if (
        isBowlingFirst
        && savedImpactPlayerId
        && !(typeof intendedImpactPosition === "number"
          && intendedImpactPosition >= 1
          && intendedImpactPosition <= 11)
      ) {
        const intendedImpactPlayer = players[savedImpactPlayerId];
        const tentativeOutgoingId = userSelectedOutgoingId ?? fallback.likelyOutgoingPlayerId;
        const tentativeOutgoingPlayer = tentativeOutgoingId
          ? startingPlayers.find((player) => player.id === tentativeOutgoingId)
          : undefined;
        if (intendedImpactPlayer && tentativeOutgoingPlayer) {
          intendedImpactPosition = findOptimalImpactBattingPosition(
            startingPlayers,
            intendedImpactPlayer,
            tentativeOutgoingPlayer,
            true,
          );
        }
      }
      if (isBowlingFirst && savedImpactPlayerId) {
        const impactRule = resolveBowlingFirstImpactPlayer(
          squad,
          startingPlayers,
          players[savedImpactPlayerId] ?? null,
          intendedImpactPosition,
        );
        if (impactRule.player) {
          savedImpactPlayerId = impactRule.player.id;
          forceImpactPosition8 = impactRule.forcePosition8;
          replacedOpenerImpact = impactRule.replacedOpener;
        }
      }

      const impactPlayerId = savedImpactPlayerId;
      let impactBattingPosition = forceImpactPosition8
        ? 8
        : (!replacedOpenerImpact && hasValidCustomPosition)
        ? customPos
        : (!replacedOpenerImpact
          && typeof intendedImpactPosition === "number"
          && intendedImpactPosition >= 1
          && intendedImpactPosition <= 11)
        ? intendedImpactPosition
        : null;

      let outgoingPlayerId = fallback.likelyOutgoingPlayerId;
      if (!isBowlingFirst && !userSelectedOutgoingId) {
        outgoingPlayerId = selectBattingFirstOutgoingBatter(
          startingPlayers,
          new Set([
            ...(designatedCaptainId ? [designatedCaptainId] : []),
            ...(designatedViceCaptainId ? [designatedViceCaptainId] : []),
          ]),
        )?.id ?? null;
      }
      if (isBowlingFirst && impactPlayerId && players[impactPlayerId]) {
        const keepers = startingPlayers.filter((p) => (p.role === "WK-Batsman" || p.isWicketkeeper) && !p.isPartTimeWk);
        const impactPlayer = players[impactPlayerId];
        const replacingOpener = isBattingOption(impactPlayer)
          && impactPlayer.isOpener
          && (intendedImpactPosition === 1 || intendedImpactPosition === 2);
        const protectedIds = new Set<string>([
          ...(designatedCaptainId ? [designatedCaptainId] : []),
          ...(designatedViceCaptainId ? [designatedViceCaptainId] : []),
          ...(replacingOpener ? [] : startingPlayers.slice(0, 2).map((p) => p.id)),
          ...startingPlayers.filter((p) => p.reputation === 10).map((p) => p.id),
        ]);
        const eligibleOutgoing = startingPlayers.filter((p) => {
          if (protectedIds.has(p.id)) return false;
          if ((p.role === "WK-Batsman" || p.isWicketkeeper) && !p.isPartTimeWk && keepers.length <= 1) return false;
          return true;
        });
        if (eligibleOutgoing.length > 0) {
          const chosen = userSelectedOutgoingId && eligibleOutgoing.some((player) => player.id === userSelectedOutgoingId)
            ? eligibleOutgoing.find((player) => player.id === userSelectedOutgoingId)
            : [...eligibleOutgoing].sort((left, right) => {
            const leftBowler = left.role === "Pace Bowler" || left.role === "Spin Bowler" || (left.currentBowling ?? 0) >= 68;
            const rightBowler = right.role === "Pace Bowler" || right.role === "Spin Bowler" || (right.currentBowling ?? 0) >= 68;
            return isBattingOption(impactPlayer)
              ? (left.currentBatting ?? 0) - (right.currentBatting ?? 0)
                || playerRating(left) - playerRating(right)
              : (Number(rightBowler) - Number(leftBowler))
                || (playerRating(left) - playerRating(right));
          })[0];
          if (chosen) outgoingPlayerId = chosen.id;
        }
      }
      if (userSelectedOutgoingId
        && userSelectedOutgoingId !== impactPlayerId
        && startingPlayers.some((player) => player.id === userSelectedOutgoingId)) {
        outgoingPlayerId = userSelectedOutgoingId;
      }
      if (
        isBowlingFirst
        && !forceImpactPosition8
        && (
          replacedOpenerImpact
          || !(typeof impactBattingPosition === "number"
            && impactBattingPosition >= 1
            && impactBattingPosition <= 11)
        )
        && impactPlayerId
        && outgoingPlayerId
      ) {
        const impactPlayer = players[impactPlayerId];
        const outgoingPlayer = startingPlayers.find((player) => player.id === outgoingPlayerId);
        if (impactPlayer && outgoingPlayer) {
          impactBattingPosition = findOptimalImpactBattingPosition(
            startingPlayers,
            impactPlayer,
            outgoingPlayer,
            true,
          );
        }
      }

      return {
        ...fallback,
        startingXI,
        impactPlayerId,
        likelyOutgoingPlayerId: outgoingPlayerId,
        impactBattingPosition,
        captainId: designatedCaptainId ?? fallback.captainId,
        viceCaptainId: designatedViceCaptainId ?? fallback.viceCaptainId,
        usesProvisionalCaptain: !designatedCaptainId,
      };
    };

    return {
      battingFirst: useSavedPlan(
        career.battingFirstXI,
        career.battingFirstImpactSubs,
        generated.battingFirst,
        false,
      ),
      bowlingFirst: useSavedPlan(
        career.bowlingFirstXI,
        career.bowlingFirstImpactSubs,
        generated.bowlingFirst,
        true,
      ),
    };
  }, [activeTab, aiLineupLogic, career, players, profileAiLeadership, squad, team, teamId, userTeamId]);

  const handleSelectBowlingFirstImpactPlayer = (playerId: string) => {
    setCareer((prev) => {
      const next = { ...prev, bowlingFirstImpactPlayerId: playerId };
      if (typeof window !== "undefined" && userTeamId) {
        try {
          const stored = localStorage.getItem(`ipl_career_${userTeamId}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            localStorage.setItem(
              `ipl_career_${userTeamId}`,
              JSON.stringify({ ...parsed, bowlingFirstImpactPlayerId: playerId }),
            );
          }
        } catch (e) {
          console.error("Failed to save bowlingFirstImpactPlayerId", e);
        }
      }
      return next;
    });
  };

  const handleSelectBowlingFirstImpactPosition = (position: number) => {
    setCareer((prev) => {
      const next = { ...prev, bowlingFirstImpactBattingPosition: position };
      if (typeof window !== "undefined" && userTeamId) {
        try {
          const stored = localStorage.getItem(`ipl_career_${userTeamId}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            localStorage.setItem(
              `ipl_career_${userTeamId}`,
              JSON.stringify({ ...parsed, bowlingFirstImpactBattingPosition: position }),
            );
          }
        } catch (e) {
          console.error("Failed to save bowlingFirstImpactBattingPosition", e);
        }
      }
      return next;
    });
  };

  const teamFixtures = useMemo(() => career.fixtures
    .filter((fixture) => fixture.teamA === teamId || fixture.teamB === teamId)
    .sort((left, right) => (
      (left.date ?? "").localeCompare(right.date ?? "")
      || (left.time ?? "").localeCompare(right.time ?? "")
      || left.matchNumber - right.matchNumber
    )), [career.fixtures, teamId]);

  const orderedStandings = useMemo(() => [...career.standings].sort((left, right) => (
    right.points - left.points
    || right.nrr - left.nrr
    || left.teamName.localeCompare(right.teamName)
  )), [career.standings]);
  const standingIndex = orderedStandings.findIndex((row) => row.teamId === teamId);
  const standing = standingIndex >= 0 ? orderedStandings[standingIndex] : undefined;

  const completedFixtures = teamFixtures.filter((fixture) => fixture.played);
  const upcomingFixtures = teamFixtures.filter((fixture) => !fixture.played);
  const rainAffectedFixtures = completedFixtures.filter(isRainAffectedMatch);
  const recentFixtures = [...completedFixtures].reverse().slice(0, 5);
  const fixtureAnnouncementDate = getSeasonScheduleAnnouncementDate(currentSeason);
  const fixturesAnnounced = currentDate >= fixtureAnnouncementDate;
  const nextFixtures = fixturesAnnounced ? upcomingFixtures.slice(0, visibleNextFixtureCount) : [];

  const teamSeasonStats = useMemo(() => Object.values(career.playerStats)
    .filter((stat) => stat.teamId === teamId), [career.playerStats, teamId]);
  const leadingRunScorer = [...teamSeasonStats].sort((left, right) => right.runs - left.runs)[0];
  const leadingWicketTaker = [...teamSeasonStats].sort((left, right) => right.wickets - left.wickets)[0];

  const bestBatter = [...squad].sort((left, right) => right.currentBatting - left.currentBatting)[0];
  const bestBowler = [...squad].sort((left, right) => right.currentBowling - left.currentBowling)[0];
  const savedLeadership = teamId === userTeamId
    ? career.teamLeadership
    : profileAiLeadership;
  const captain = savedLeadership?.captainId ? players[savedLeadership.captainId] : undefined;
  const viceCaptain = savedLeadership?.viceCaptainId ? players[savedLeadership.viceCaptainId] : undefined;

  const averageRating = squad.length > 0
    ? (squad.reduce((total, player) => total + playerRating(player), 0) / squad.length).toFixed(1)
    : "0.0";
  const averageAge = squad.length > 0
    ? (squad.reduce((total, player) => total + player.age, 0) / squad.length).toFixed(1)
    : "0.0";
  const overseasCount = squad.filter((player) => player.nationality === "Overseas").length;
  const retainedIds = new Set(team?.retainedPlayers ?? []);
  const seasonSales = new Map(
    (auction?.saleHistory ?? [])
      .filter((sale) => sale.teamId === teamId)
      .map((sale) => [sale.playerId, sale.price]),
  );
  const squadSeason = String(auction?.season ?? currentSeason);
  const squadSeasonStats = (player: Player) => career.playerStats[player.id];
  const acquisitionPrice = (player: Player) => {
    const salePrice = seasonSales.get(player.id);
    if (salePrice !== undefined) return salePrice;
    const history = getPlayerSeasonHistory(player.iplHistory, squadSeason);
    return history?.teamId === teamId && history.price > 0 ? history.price : undefined;
  };
  const clubSquadNumericValue = (player: Player, key: ClubSquadSortKey) => {
    const stats = squadSeasonStats(player);
    if (key === "age") return player.age;
    if (key === "rating") return playerRating(player);
    if (key === "potential") return Math.max(player.potentialBatting, player.potentialBowling);
    if (key === "acquisition") return acquisitionPrice(player) ?? -1;
    if (key === "bowlingCA") return player.currentBowling;
    if (key === "bowlingPA") return player.potentialBowling;
    if (key === "battingCA") return player.currentBatting;
    if (key === "battingPA") return player.potentialBatting;
    if (key === "seasonMatches") return stats?.matches ?? 0;
    if (key === "seasonWickets") return stats?.wickets ?? 0;
    if (key === "seasonBowlingAverage") return stats?.wickets ? stats.runsConceded / stats.wickets : Number.POSITIVE_INFINITY;
    if (key === "seasonEconomy") {
      const completeOvers = Math.floor(stats?.oversBowled ?? 0);
      const balls = completeOvers * 6 + Math.round(((stats?.oversBowled ?? 0) - completeOvers) * 10);
      return balls ? (stats?.runsConceded ?? 0) / (balls / 6) : Number.POSITIVE_INFINITY;
    }
    if (key === "seasonBestBowling") {
      const [wickets = "0", runs = "999"] = (stats?.bestBowling ?? "0/999").split("/");
      return Number(wickets) * 1000 - Number(runs);
    }
    if (key === "seasonRuns") return stats?.runs ?? 0;
    if (key === "seasonBattingAverage") {
      const dismissals = stats?.dismissals ?? stats?.matches ?? 0;
      return dismissals ? (stats?.runs ?? 0) / dismissals : stats?.runs ?? 0;
    }
    if (key === "seasonStrikeRate") return stats?.balls ? (stats.runs / stats.balls) * 100 : 0;
    if (key === "seasonHighScore") return stats?.highestScore ?? 0;
    return 0;
  };
  const sortedClubSquad = [...squad].sort((left, right) => {
    let comparison = 0;
    if (clubSquadSort.key === "name") comparison = left.name.localeCompare(right.name);
    else if (clubSquadSort.key === "role") comparison = left.role.localeCompare(right.role);
    else if (clubSquadSort.key === "nationality") comparison = left.nationality.localeCompare(right.nationality);
    else comparison = clubSquadNumericValue(left, clubSquadSort.key) - clubSquadNumericValue(right, clubSquadSort.key);
    return comparison === 0
      ? left.name.localeCompare(right.name)
      : comparison * (clubSquadSort.direction === "asc" ? 1 : -1);
  });
  const toggleClubSquadSort = (key: ClubSquadSortKey) => {
    setClubSquadSort((current) => ({
      key,
      direction: current.key === key
        ? current.direction === "asc" ? "desc" : "asc"
        : key === "name" || key === "role" || key === "nationality" || key === "age" ? "asc" : "desc",
    }));
  };
  const clubSquadSortIndicator = (key: ClubSquadSortKey) => (
    clubSquadSort.key === key
      ? clubSquadSort.direction === "asc" ? "\u2191" : "\u2193"
      : "\u2195"
  );
  const squadNumber = (value: number | undefined, digits = 0) => (
    value === undefined || !Number.isFinite(value) ? "\u2014" : value.toFixed(digits)
  );
  const playerNameCell = (player: Player) => (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setDetailedPlayerId(player.id)}
        className="block max-w-full truncate text-left font-semibold text-text-primary transition-colors hover:text-accent hover:underline"
      >
        {player.name}
      </button>
      <div className="mt-0.5 font-space-mono text-[7px] font-bold uppercase text-text-secondary">
        {player.nationality}{player.isCapped ? " \u00b7 Capped" : " \u00b7 Uncapped"}
      </div>
    </div>
  );
  const clubSquadColumns: Array<{
    key: ClubSquadSortKey;
    label: string;
    align?: "left" | "center" | "right";
    render: (player: Player) => ReactNode;
  }> = (() => {
    if (clubSquadView === "general") return [
      { key: "name", label: "Name", render: playerNameCell },
      { key: "age", label: "Age", align: "center", render: (player) => player.age },
      { key: "role", label: "Role", render: (player) => ROLE_LABELS[player.role] },
      { key: "nationality", label: "Nationality", render: (player) => player.nationality },
      { key: "rating", label: "CA", align: "center", render: playerRating },
      { key: "potential", label: "PA", align: "center", render: (player) => Math.max(player.potentialBatting, player.potentialBowling) },
      { key: "acquisition", label: "Acquisition", align: "right", render: (player) => {
        if (retainedIds.has(player.id) || player.isRetained) return "Retained";
        const price = acquisitionPrice(player);
        return price === undefined ? "Squad" : formatPrice(price);
      } },
    ];
    if (clubSquadView === "bowling") return [
      { key: "name", label: "Name", render: playerNameCell },
      { key: "bowlingCA", label: "Bowl CA", align: "center", render: (player) => player.currentBowling },
      { key: "bowlingPA", label: "Bowl PA", align: "center", render: (player) => player.potentialBowling },
      { key: "seasonMatches", label: "Mat", align: "center", render: (player) => squadSeasonStats(player)?.matches ?? 0 },
      { key: "seasonWickets", label: "Wkts", align: "center", render: (player) => squadSeasonStats(player)?.wickets ?? 0 },
      { key: "seasonBowlingAverage", label: "Avg", align: "center", render: (player) => {
        const stats = squadSeasonStats(player); return stats?.wickets ? squadNumber(stats.runsConceded / stats.wickets, 2) : "\u2014";
      } },
      { key: "seasonEconomy", label: "Econ", align: "center", render: (player) => {
        const stats = squadSeasonStats(player);
        const completeOvers = Math.floor(stats?.oversBowled ?? 0);
        const balls = completeOvers * 6 + Math.round(((stats?.oversBowled ?? 0) - completeOvers) * 10);
        return stats && balls ? squadNumber(stats.runsConceded / (balls / 6), 2) : "\u2014";
      } },
      { key: "seasonBestBowling", label: "Best", align: "center", render: (player) => squadSeasonStats(player)?.bestBowling ?? "\u2014" },
    ];
    return [
      { key: "name", label: "Name", render: playerNameCell },
      { key: "battingCA", label: "Bat CA", align: "center", render: (player) => player.currentBatting },
      { key: "battingPA", label: "Bat PA", align: "center", render: (player) => player.potentialBatting },
      { key: "seasonMatches", label: "Mat", align: "center", render: (player) => squadSeasonStats(player)?.matches ?? 0 },
      { key: "seasonRuns", label: "Runs", align: "center", render: (player) => squadSeasonStats(player)?.runs ?? 0 },
      { key: "seasonBattingAverage", label: "Avg", align: "center", render: (player) => {
        const stats = squadSeasonStats(player);
        const dismissals = stats?.dismissals ?? stats?.matches ?? 0;
        return stats && dismissals ? squadNumber(stats.runs / dismissals, 2) : stats?.runs ? squadNumber(stats.runs, 2) : "\u2014";
      } },
      { key: "seasonStrikeRate", label: "SR", align: "center", render: (player) => {
        const stats = squadSeasonStats(player); return stats?.balls ? squadNumber((stats.runs / stats.balls) * 100, 2) : "\u2014";
      } },
      { key: "seasonHighScore", label: "HS", align: "center", render: (player) => squadSeasonStats(player)?.highestScore ?? "\u2014" },
    ];
  })();

  const roleCounts = squad.reduce<Record<Player["role"], number>>((counts, player) => {
    counts[player.role] += 1;
    return counts;
  }, {
    Batsman: 0,
    "WK-Batsman": 0,
    "All-Rounder": 0,
    "Pace Bowler": 0,
    "Spin Bowler": 0,
  });
  const championshipSeasons = Array.from(new Set(
    [
      ...HISTORICAL_LEAGUE_HISTORY,
      ...simulatedLeagueHistory,
    ]
      .filter((season) => season.championTeamId === teamId)
      .map((season) => season.season),
  )).sort((left, right) => right - left);

  if (Object.keys(teams).length === 0) {
    return (
      <div className="app-theme-background flex h-[calc(100vh-3rem)] items-center justify-center bg-bg font-space-mono text-[10px] font-bold uppercase text-text-secondary">
        Loading team profile...
      </div>
    );
  }

  if (!team) {
    return (
      <div className="app-theme-background flex h-[calc(100vh-3rem)] flex-col items-center justify-center bg-bg p-8 text-center">
        <Shield className="size-12 text-text-secondary" aria-hidden="true" />
        <h1 className="mt-4 font-anton text-[28px] uppercase text-text-primary">Team not found</h1>
        <p className="mt-2 text-sm text-text-secondary">This team is not part of the active career.</p>
        <Link
          href="/game/overview?tab=season&subtab=standings"
          className="mt-6 border border-border bg-surface px-4 py-2 font-space-mono text-[9px] font-bold uppercase text-text-primary hover:border-accent hover:text-accent"
        >
          Return to standings
        </Link>
      </div>
    );
  }

  const isUserTeam = team.id === userTeamId;
  const standingLabel = standingIndex >= 0 ? `#${standingIndex + 1}` : "—";
  const navigateToTab = (tab: TeamProfileTab) => {
    if (tab === activeTab) return;
    const query = new URLSearchParams(window.location.search);
    if (tab === "overview") query.delete("section");
    else query.set("section", tab);
    const search = query.toString();
    setActiveTab(tab);
    window.history.pushState(
      window.history.state,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}`,
    );
  };

  const isDarkPrimary = team.id === "GT" || team.primaryColor === "#1b2133" || team.primaryColor === "#0b121f" || team.primaryColor === "#0b1426";
  const roleBarColor = isDarkPrimary ? (team.secondaryColor || "#e5b842") : team.primaryColor;
  const topBorderColor = isDarkPrimary ? (team.secondaryColor || "var(--accent)") : team.primaryColor;

  return (
    <div className="app-theme-background flex h-[calc(100vh-3rem)] min-h-0 flex-col overflow-hidden bg-bg">
      <header
        className="relative shrink-0 overflow-hidden border-b-2 border-border"
        style={{
          background: `linear-gradient(115deg, ${team.primaryColor} 0%, ${team.primaryColor} 38%, ${team.secondaryColor} 150%)`,
          color: team.secondaryColor,
        }}
      >
        <div className="absolute -right-10 -top-24 h-64 w-64 rounded-full border-[35px] border-white/10" aria-hidden="true" />
        <div className="relative flex h-[122px] items-center gap-5 px-7 py-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-current/40 text-center font-anton text-[21px] uppercase shadow-xl"
            style={{ backgroundColor: team.secondaryColor, color: team.primaryColor }}
          >
            {team.shortName.slice(0, 3)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] opacity-75">
              <span>{currentSeason} IPL team profile</span>
              {isUserTeam && <span className="border border-current/40 px-1.5 py-0.5">Your club</span>}
            </div>
            <h1 className="mt-1.5 truncate font-anton text-[30px] uppercase leading-none">{team.name}</h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 font-space-mono text-[8px] font-bold uppercase opacity-80">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3" />
                Home stadium: {team.homeGround}
              </span>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-3 divide-x divide-current/20 border border-current/30 bg-black/10 text-center backdrop-blur-sm">
            {[
              ["Position", standingLabel],
              ["Points", standing?.points ?? 0],
              ["Record", `${standing?.won ?? 0}-${standing?.lost ?? 0}`],
            ].map(([label, value]) => (
              <div key={label} className="min-w-20 px-3 py-2.5">
                <div className="font-anton text-[21px] leading-none">{value}</div>
                <div className="mt-1 font-space-mono text-[7px] font-bold uppercase tracking-wider opacity-70">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <nav className="flex h-11 shrink-0 items-center gap-1 border-b-2 border-border bg-surface px-7" aria-label="Team profile sections">
        {([
          ["overview", "Overview"],
          ["squad", `Squad (${squad.length})`],
          ["fixtures", "Fixtures"],
          ["clubfigures", "Club Figures"],
          ["lineups", "Lineups"],
        ] as Array<[TeamProfileTab, string]>).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => navigateToTab(tab)}
            className={`h-full border-b-2 px-5 font-space-mono text-[9px] font-bold uppercase tracking-[0.12em] transition-colors ${
              activeTab === tab
                ? "border-accent text-accent"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="min-h-0 flex-1 overflow-hidden p-4">
        {activeTab === "overview" && (
          <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
            <div className="grid shrink-0 grid-cols-4 gap-3">
              <MetricCard label="League position" value={standingLabel} detail={`${standing?.points ?? 0} points · NRR ${(standing?.nrr ?? 0) >= 0 ? "+" : ""}${(standing?.nrr ?? 0).toFixed(3)}`} icon={Trophy} />
              <MetricCard label="Squad strength" value={averageRating} detail={`${squad.length} players · ${overseasCount} overseas`} icon={Activity} />
              <MetricCard label="Squad age" value={averageAge} detail={`${retainedIds.size} retained players`} icon={Users} />
              <MetricCard
                label="IPL Championships"
                value={championshipSeasons.length}
                detail={championshipSeasons[0] ? `Most recent · ${championshipSeasons[0]}` : "No titles yet"}
                icon={Trophy}
              />
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[1.1fr_0.9fr_1fr] gap-3">
              <section className="flex min-h-0 flex-col justify-between overflow-hidden border border-border bg-surface p-3">
                <div>
                  <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.15em] text-accent">Club identity</p>
                  <h2 className="mt-0.5 font-anton text-[18px] uppercase leading-none text-text-primary">{team.shortName} details</h2>
                  <dl className="mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-y-2 text-[9px]">
                    <dt className="font-space-mono uppercase text-text-secondary">Home stadium</dt>
                    <dd className="truncate font-semibold text-text-primary">{team.homeGround}</dd>
                    {homeStadium && (
                      <>
                        <dt className="font-space-mono uppercase text-text-secondary">Capacity</dt>
                        <dd className="truncate font-semibold text-text-primary">{homeStadium.capacity.toLocaleString("en-GB")} seats</dd>
                      </>
                    )}
                    <dt className="font-space-mono uppercase text-text-secondary">Approach</dt>
                    <dd className="truncate font-semibold text-text-primary">{team.aiPersonality}</dd>
                    <dt className="font-space-mono uppercase text-text-secondary">Head Coach</dt>
                    <dd className="truncate font-semibold text-text-primary">{headCoach ? headCoach.fullName : "Unappointed"}</dd>
                    {mentor && (
                      <>
                        <dt className="font-space-mono uppercase text-text-secondary">Mentor</dt>
                        <dd className="truncate font-semibold text-text-primary">{mentor.fullName}</dd>
                      </>
                    )}
                  </dl>
                </div>
                {(() => {
                  const descriptor = getTeamAuctionDescriptor(team.id);
                  if (!descriptor) return null;
                  return (
                    <div className="mt-2.5 rounded border border-accent/40 bg-accent/[0.04] p-2.5">
                      <p className="font-space-mono text-[7.5px] font-bold uppercase tracking-wider text-accent">
                        Auction Focus & Tendencies
                      </p>
                      <h4 className="mt-0.5 font-anton text-[13px] uppercase text-text-primary">
                        {descriptor.title}
                      </h4>
                      <p className="mt-1 font-barlow text-[10.5px] leading-snug text-text-secondary">
                        {descriptor.detail}
                      </p>
                    </div>
                  );
                })()}
              </section>

              <section className="flex min-h-0 flex-col overflow-hidden border border-border bg-surface p-3">
                <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.15em] text-accent">Squad balance</p>
                <h2 className="mt-0.5 font-anton text-[18px] uppercase leading-none text-text-primary">Role composition</h2>
                <div className="grid min-h-0 flex-1 grid-rows-5 gap-1 pt-2">
                  {(Object.entries(roleCounts) as Array<[Player["role"], number]>).map(([role, count]) => (
                    <div key={role} className="flex min-h-0 flex-col justify-center">
                      <div className="mb-1 flex items-center justify-between font-space-mono text-[8px] font-bold uppercase">
                        <span className="text-text-secondary">{ROLE_LABELS[role]}</span>
                        <span className="text-text-primary">{count}</span>
                      </div>
                      <div className="h-1.5 shrink-0 overflow-hidden bg-border/60">
                        <div
                          className="h-full"
                          style={{
                            width: `${squad.length > 0 ? (count / squad.length) * 100 : 0}%`,
                            backgroundColor: roleBarColor,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="flex min-h-0 flex-col overflow-hidden border border-border bg-surface p-3">
                <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.15em] text-accent">Key personnel</p>
                <h2 className="mt-0.5 font-anton text-[18px] uppercase leading-none text-text-primary">Squad leaders</h2>
                <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2 pt-2">
                  {[
                    { label: "Leading batter", player: bestBatter, rating: bestBatter?.currentBatting ?? "—", metric: "BAT" },
                    { label: "Leading bowler", player: bestBowler, rating: bestBowler?.currentBowling ?? "—", metric: "BWL" },
                    { label: "Captain", player: captain, rating: captain?.captaincy ?? "—", metric: "CAP" },
                    { label: "Vice-captain", player: viceCaptain, rating: viceCaptain?.captaincy ?? "—", metric: "CAP" },
                  ].map(({ label, player, rating, metric }) => (
                    <div
                      key={label}
                      className="relative flex min-h-0 flex-col justify-between overflow-hidden rounded-[2px] border border-border bg-bg px-2 py-1.5"
                    >
                      <div className="flex items-center">
                        <span className="truncate font-space-mono text-[8px] font-bold uppercase tracking-[0.06em] text-text-secondary">{label}</span>
                      </div>
                      <div className="flex min-h-0 min-w-0 flex-1 items-end justify-between gap-2 pt-1">
                        <span className="line-clamp-2 min-w-0 pb-0.5 text-[13px] font-bold leading-[1.1] text-text-primary" title={player?.name}>
                          {player?.name ?? "No player"}
                        </span>
                        <span className="shrink-0 font-anton text-[28px] leading-[0.8] text-accent">
                          {rating}
                          <span className="ml-1 font-space-mono text-[9px] font-bold text-text-secondary">{metric}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[0.9fr_1.1fr_1fr] gap-3">
              <section className="min-h-0 overflow-hidden border border-border bg-surface p-3">
                <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.15em] text-accent">Current campaign</p>
                <h2 className="mt-0.5 font-anton text-[18px] uppercase leading-none text-text-primary">Recent form</h2>
                {recentFixtures.length > 0 ? (
                  <div className="mt-3 flex gap-2">
                    {recentFixtures.map((fixture) => {
                      const won = fixture.winner === teamId;
                      return (
                        <span
                          key={fixture.id}
                          className={`flex h-8 w-8 items-center justify-center border font-space-mono text-[9px] font-bold ${
                            won ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"
                          }`}
                          title={`${won ? "Won" : "Lost"} match ${fixture.matchNumber}`}
                        >
                          {won ? "W" : "L"}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-[10px] text-text-secondary">No completed fixtures this season.</p>
                )}
              </section>

              <section className="flex min-h-0 flex-col overflow-hidden border border-border bg-surface p-3">
                <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.15em] text-accent">Schedule</p>
                <h2 className="mt-0.5 font-anton text-[18px] uppercase leading-none text-text-primary">Next fixtures</h2>
                <div ref={nextFixturesListRef} className="mt-1.5 min-h-0 flex-1 divide-y divide-border overflow-hidden">
                  {!fixturesAnnounced && (
                    <p className="py-3 text-[10px] text-text-secondary">
                      Fixtures will be revealed on {safeDateLabel(fixtureAnnouncementDate)}.
                    </p>
                  )}
                  {fixturesAnnounced && nextFixtures.map((fixture) => {
                    const opponentId = fixture.teamA === teamId ? fixture.teamB : fixture.teamA;
                    const opponent = teams[opponentId];
                    const venue = fixture.teamA === teamId ? "Home" : "Away";
                    return (
                      <div key={fixture.id} className="grid h-6 grid-cols-[4rem_minmax(0,1fr)_3rem] items-center gap-2 text-[9px]">
                        <span className="font-space-mono text-[8px] uppercase text-text-secondary">{safeDateLabel(fixture.date, { day: "numeric", month: "short" })}</span>
                        <span className="truncate font-semibold text-text-primary">{opponent?.name ?? opponentId}</span>
                        <span className="text-right font-space-mono text-[8px] font-bold uppercase text-accent">{venue}</span>
                      </div>
                    );
                  })}
                  {upcomingFixtures.length === 0 && <p className="py-3 text-[10px] text-text-secondary">No upcoming fixtures.</p>}
                </div>
              </section>

              <section className="min-h-0 overflow-hidden border border-border bg-surface p-3">
                <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.15em] text-accent">Season output</p>
                <h2 className="mt-0.5 font-anton text-[18px] uppercase leading-none text-text-primary">Performance leaders</h2>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="border border-border bg-bg p-2">
                    <span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Most runs</span>
                    <div className="mt-1 truncate text-[10px] font-semibold text-text-primary">{leadingRunScorer?.name ?? "No data"}</div>
                    <div className="mt-0.5 font-anton text-[19px] leading-none text-accent">{leadingRunScorer?.runs ?? 0}</div>
                  </div>
                  <div className="border border-border bg-bg p-2">
                    <span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Most wickets</span>
                    <div className="mt-1 truncate text-[10px] font-semibold text-text-primary">{leadingWicketTaker?.name ?? "No data"}</div>
                    <div className="mt-0.5 font-anton text-[19px] leading-none text-accent">{leadingWicketTaker?.wickets ?? 0}</div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === "squad" && (
          <section className="flex h-full min-h-0 flex-col overflow-hidden border-2 border-border bg-surface">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b-2 border-border px-6 py-4">
              <div>
                <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.15em] text-accent">{currentSeason} registered squad</p>
                <h2 className="mt-1 font-anton text-[22px] uppercase leading-none text-text-primary">{team.shortName} playing staff</h2>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-4">
                <div className="hidden gap-5 font-space-mono text-[8px] font-bold uppercase text-text-secondary xl:flex">
                  <span>{squad.length}/{team.maxSquadSize} players</span>
                  <span>{overseasCount}/{team.overseasPlayersMax} overseas</span>
                  <span>{retainedIds.size} retained</span>
                </div>
                <div className="flex rounded border border-border bg-bg/50 p-1">
                  {(["general", "bowling", "batting"] as ClubSquadView[]).map((view) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => {
                        setClubSquadView(view);
                        setClubSquadSort({ key: "name", direction: "asc" });
                      }}
                      className={`rounded px-3 py-1.5 font-space-mono text-[9px] font-bold uppercase tracking-wider ${clubSquadView === view ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary"}`}
                    >
                      {view}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[850px] text-left text-[11px]">
                <thead className="sticky top-0 z-10 border-b border-border bg-bg font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary shadow-sm">
                  <tr>
                    {clubSquadColumns.map((column) => (
                      <th
                        key={column.key}
                        className="px-5 py-3.5"
                        aria-sort={clubSquadSort.key === column.key ? (clubSquadSort.direction === "asc" ? "ascending" : "descending") : "none"}
                      >
                        <button
                          type="button"
                          onClick={() => toggleClubSquadSort(column.key)}
                          className={`flex w-full items-center gap-1 hover:text-accent ${column.align === "center" ? "justify-center" : column.align === "right" ? "justify-end" : "justify-start"}`}
                        >
                          {column.label} <span aria-hidden="true">{clubSquadSortIndicator(column.key)}</span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {sortedClubSquad.map((player) => (
                    <tr key={player.id} className="transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]">
                      {clubSquadColumns.map((column, index) => (
                        <td
                          key={column.key}
                          className={`px-5 py-3 font-space-mono text-[10px] ${column.align === "center" ? "text-center" : column.align === "right" ? "text-right" : "text-left"} ${index === 0 ? "font-barlow text-[11px] text-text-primary" : "text-text-secondary"}`}
                        >
                          {column.render(player)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "fixtures" && (
          <section className="flex h-full min-h-0 flex-col overflow-hidden border-2 border-border bg-surface">
            <div className="flex shrink-0 items-center justify-between border-b-2 border-border px-6 py-4">
              <div>
                <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.15em] text-accent">{currentSeason} season schedule</p>
                <h2 className="mt-1 font-anton text-[22px] uppercase leading-none text-text-primary">{team.shortName} fixtures &amp; results</h2>
              </div>
              <div className="flex gap-5 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                <span>{completedFixtures.length} played</span>
                <span>{upcomingFixtures.length} upcoming</span>
                <span className="text-blue-600 dark:text-blue-300">{rainAffectedFixtures.length} rain affected</span>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-bg/40 p-4">
              <div className="grid grid-cols-2 gap-3">
                {teamFixtures.map((fixture) => {
                  const isHome = fixture.teamA === teamId;
                  const opponentId = isHome ? fixture.teamB : fixture.teamA;
                  const opponent = teams[opponentId];
                  const teamScore = isHome ? fixture.scoreA : fixture.scoreB;
                  const opponentScore = isHome ? fixture.scoreB : fixture.scoreA;
                  const won = fixture.played && fixture.winner === teamId;
                  const rainAffected = isRainAffectedMatch(fixture);
                  return (
                    <article
                      key={fixture.id}
                      onClick={() => {
                        if (fixture.played) {
                          setActiveScorecard(fixture);
                          setActiveResultView("scorecard");
                        }
                      }}
                      className={`relative overflow-hidden border border-border bg-surface px-5 py-4 shadow-sm transition-all ${
                        fixture.played ? "cursor-pointer hover:border-accent hover:shadow-md" : "cursor-default"
                      }`}
                    >
                      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: team.primaryColor }} />
                      <div className="flex items-center justify-between gap-4 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                        <span>Match {fixture.matchNumber} · {safeDateLabel(fixture.date, { weekday: "short", day: "numeric", month: "short" })} · {fixture.time ?? "TBC"}</span>
                        <span className={fixture.played ? (won ? "text-success font-bold hover:underline" : "text-danger font-bold hover:underline") : "text-accent"}>
                          {fixture.played
                            ? `${won ? "Won" : "Lost"}${rainAffected ? " · Rain affected" : ""} · View Scorecard ➔`
                            : "Upcoming"}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-full font-space-mono text-[8px] font-bold"
                          style={{ backgroundColor: opponent?.primaryColor ?? "#777", color: opponent?.secondaryColor ?? "#fff" }}
                        >
                          {opponent?.shortName.slice(0, 3) ?? opponentId.slice(0, 3)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-semibold text-text-primary">{opponent?.name ?? opponentId}</div>
                          <div className="mt-1 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                            {isHome ? "Home" : "Away"} · {isHome ? team.homeGround : opponent?.homeGround ?? "Venue TBC"}
                          </div>
                        </div>
                        <div className="text-right">
                          {fixture.played && teamScore && opponentScore ? (
                            <>
                              <div className="font-anton text-[20px] leading-none text-text-primary">{teamScore.runs}/{teamScore.wickets}</div>
                              <div className="mt-1 font-space-mono text-[8px] text-text-secondary">Opp {opponentScore.runs}/{opponentScore.wickets}</div>
                            </>
                          ) : (
                            <CalendarDays className="size-5 text-text-secondary" aria-hidden="true" />
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              {teamFixtures.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <CalendarDays className="size-10 text-text-secondary" aria-hidden="true" />
                  <h3 className="mt-3 font-anton text-[20px] uppercase text-text-primary">No fixtures available</h3>
                  <p className="mt-2 text-[11px] text-text-secondary">The career schedule has not been released yet.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "clubfigures" && (
          <div className="grid h-full min-h-0 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-3">
            {CLUB_FIGURE_SECTIONS.map(({ tier, title, description }) => {
              const tierFigures = clubFigures.filter((figure) => figure.tier === tier);
              return (
                <section key={tier} className="flex min-h-0 flex-col overflow-hidden border-2 border-border bg-surface p-5">
                  <div className="mb-3 shrink-0 border-b border-border pb-3">
                    <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.2em] text-accent">{team.shortName} club figures</p>
                    <h2 className="mt-1 font-anton text-[22px] uppercase leading-none text-text-primary">{title}</h2>
                    <p className="mt-2 text-[11px] text-text-secondary">{description}</p>
                  </div>

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {tierFigures.map((figure, index) => (
                      <button
                        key={figure.id}
                        type="button"
                        onClick={() => figure.playerId && setDetailedPlayerId(figure.playerId)}
                        disabled={!figure.isLinked}
                        className="flex w-full items-center gap-3 border border-border bg-black/[0.02] px-3 py-3 text-left transition-colors enabled:hover:border-accent enabled:hover:bg-accent/5 disabled:cursor-default dark:bg-white/[0.02]"
                        title={figure.isLinked ? `Open ${figure.name}'s player profile` : `${figure.name} is retired`}
                      >
                        <span className="w-6 shrink-0 text-center font-anton text-lg text-text-secondary">{index + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-text-primary">{figure.name}</span>
                          <span className={`mt-0.5 block font-space-mono text-[9px] font-bold uppercase tracking-wider ${figure.isLinked ? "text-success" : "text-text-secondary"}`}>
                            {!figure.isLinked
                              ? "Retired"
                              : figure.currentTeamId
                                ? `Current club: ${teams[figure.currentTeamId]?.shortName ?? figure.currentTeamId}`
                                : "Free agent"}
                          </span>
                          {figure.clubSeasons != null && (
                            <span className="mt-1 block font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">
                              {figure.legacyPoints} points · {figure.clubSeasons} club {figure.clubSeasons === 1 ? "season" : "seasons"}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                    {tierFigures.length === 0 && (
                      <div className="flex h-full min-h-32 items-center justify-center text-center font-space-mono text-[9px] font-bold uppercase text-text-secondary">
                        No {title.toLowerCase()} recorded
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {activeTab === "lineups" && profileLineups && aiLineupLogic && (
          <div className="grid h-full min-h-0 grid-cols-2 gap-5">
            <LineupColumn
              title="Bat first lineup"
              description="The stronger batting XI, with the most likely bowling Impact option highlighted."
              plan={profileLineups.battingFirst}
              players={players}
              squad={squad}
              aiLogic={aiLineupLogic}
              impactCandidates={career.battingFirstImpactSubs.map((playerId) => players[playerId]).filter((player): player is Player => Boolean(player))}
              team={team}
              isUserTeam={isUserTeam}
            />
            <LineupColumn
              title="Bowl first lineup"
              description="The stronger bowling XI, with the most likely batting Impact option highlighted."
              plan={profileLineups.bowlingFirst}
              players={players}
              squad={squad}
              aiLogic={aiLineupLogic}
              impactCandidates={career.bowlingFirstImpactSubs.map((playerId) => players[playerId]).filter((player): player is Player => Boolean(player))}
              team={team}
              isUserTeam={isUserTeam}
              onSelectImpactPlayer={handleSelectBowlingFirstImpactPlayer}
              onSelectImpactPosition={handleSelectBowlingFirstImpactPosition}
            />
          </div>
        )}
        {activeTab === "lineups" && !profileLineups && (
          <div className="grid h-full min-h-0 grid-cols-2 gap-5" aria-label="Loading projected lineups">
            {[0, 1].map((column) => (
              <div key={column} className="animate-pulse border-2 border-border bg-surface p-5">
                <div className="h-3 w-28 bg-black/10 dark:bg-white/10" />
                <div className="mt-3 h-6 w-44 bg-black/10 dark:bg-white/10" />
                <div className="mt-6 grid h-[calc(100%-4rem)] grid-rows-11 gap-1">
                  {Array.from({ length: 11 }, (_, index) => (
                    <div key={index} className="bg-black/[0.045] dark:bg-white/[0.06]" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ======================= FIXTURE SCORECARD MODAL ======================= */}
      <MatchScorecardModal
        match={activeScorecard as any}
        teams={teams}
        players={players}
        isOpen={Boolean(activeScorecard)}
        onClose={() => setActiveScorecard(null)}
      />

      {/* Player Profile Modal */}
      <PlayerProfileModal
        playerId={detailedPlayerId}
        onClose={() => setDetailedPlayerId(null)}
        customFixtures={career.fixtures}
      />
    </div>
  );
}

export default function TeamProfilePage() {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return hasMounted ? <MountedTeamProfilePage /> : <TeamProfileLoading />;
}
