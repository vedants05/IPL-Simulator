"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { formatPrice } from "@/lib/logic/auctionRules";
import {
  buildAiMatchLineups,
  currentAbility,
  isImpactPlayerWithinOverseasLimit,
  type AiMatchLineups,
  type AiLineupPlan,
} from "@/lib/logic/aiLineupSelector";
import {
  appointAiTeamLeadership,
  type AiLeagueLeadership,
} from "@/lib/logic/aiLeadership";
import { dateKeyToLocalDate } from "@/lib/logic/careerCalendar";
import { useGameStore } from "@/lib/store/gameStore";
import type { Player, Team } from "@/lib/types";

type TeamProfileTab = "overview" | "squad" | "fixtures" | "lineups";

const TEAM_PROFILE_TABS: readonly TeamProfileTab[] = ["overview", "squad", "fixtures", "lineups"];
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
  matches: number;
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
}

interface TeamProfileCareer {
  fixtures: TeamProfileFixture[];
  standings: TeamProfileStanding[];
  playerStats: Record<string, TeamProfilePlayerStats>;
  battingFirstXI: string[];
  bowlingFirstXI: string[];
  battingFirstImpactSubs: string[];
  bowlingFirstImpactSubs: string[];
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
  aiTeamLeadership: {},
};

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
  team,
}: {
  title: string;
  description: string;
  plan: AiLineupPlan;
  players: Record<string, Player>;
  team: Team;
}) {
  const starters = plan.startingXI
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player));
  const impactPlayer = plan.impactPlayerId ? players[plan.impactPlayerId] : undefined;
  const outgoingPlayer = plan.likelyOutgoingPlayerId ? players[plan.likelyOutgoingPlayerId] : undefined;
  const overseasCount = starters.filter((player) => player.nationality === "Overseas").length;
  const totalOverseasCount = overseasCount + (impactPlayer?.nationality === "Overseas" ? 1 : 0);

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
          <div className="mt-1 text-accent">Reassessed each fixture</div>
        </div>
      </div>
      <div
        className="grid min-h-0 flex-1 px-5 py-1"
        style={{ gridTemplateRows: "repeat(11, minmax(0, 1fr))" }}
      >
        {starters.map((player, index) => {
          const isCaptain = player.id === plan.captainId;
          const isViceCaptain = player.id === plan.viceCaptainId;
          const isWicketkeeper = player.role === "WK-Batsman" || player.isWicketkeeper || player.isPartTimeWk;
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
                  className="shrink-0 rounded-[2px] px-1 py-0.5 font-space-mono text-[7px] font-bold"
                  style={{ backgroundColor: `${team.primaryColor}22`, color: team.primaryColor }}
                  title={plan.usesProvisionalCaptain ? "Provisional captain pending AI leadership rules" : "Captain"}
                >
                  C{plan.usesProvisionalCaptain ? "*" : ""}
                </span>
              )}
              {isViceCaptain && (
                <span
                  className="shrink-0 rounded-[2px] border border-border px-1 py-0.5 font-space-mono text-[7px] font-bold text-text-secondary"
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
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.14em]" style={{ color: team.primaryColor }}>
              Most likely impact substitute
            </p>
            <div className="mt-1 truncate text-[11px] font-bold text-text-primary">
              {impactPlayer?.name ?? "No eligible impact player"}
            </div>
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
          <p className="mt-1.5 truncate border-t border-border/50 pt-1.5 font-space-mono text-[7px] uppercase text-text-secondary">
            Projected change: {impactPlayer.name} in for {outgoingPlayer.name}
          </p>
        )}
      </div>
    </section>
  );
}

export default function TeamProfilePage() {
  const params = useParams<{ teamId: string }>();
  const teams = useGameStore((state) => state.teams);
  const players = useGameStore((state) => state.players);
  const userTeamId = useGameStore((state) => state.userTeamId);
  const currentSeason = useGameStore((state) => state.currentSeason);
  const auction = useGameStore((state) => state.auction);
  const simulatedLeagueHistory = useGameStore((state) => state.simulatedLeagueHistory);
  const [hasMounted, setHasMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TeamProfileTab>("overview");
  const [career, setCareer] = useState<TeamProfileCareer>(EMPTY_CAREER);
  const [visibleNextFixtureCount, setVisibleNextFixtureCount] = useState(3);
  const nextFixturesListRef = useRef<HTMLDivElement>(null);
  const profileLineupsCacheRef = useRef<{
    career: TeamProfileCareer;
    squad: readonly Player[];
    teamId: string;
    userTeamId: string;
    lineups: AiMatchLineups;
  } | null>(null);

  const rawTeamId = Array.isArray(params.teamId) ? params.teamId[0] : params.teamId;
  const teamId = decodeURIComponent(rawTeamId ?? "").toUpperCase();
  const team = teams[teamId];

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const syncTabWithHistory = () => setActiveTab(teamProfileTabFromUrl());
    syncTabWithHistory();
    window.addEventListener("popstate", syncTabWithHistory);
    return () => window.removeEventListener("popstate", syncTabWithHistory);
  }, []);

  useEffect(() => {
    if (!hasMounted || activeTab !== "overview" || !team) return;

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
  }, [activeTab, hasMounted, team]);

  useEffect(() => {
    if (!hasMounted || !userTeamId) return;

    const savedCareer = localStorage.getItem(`ipl_career_${userTeamId}`);
    if (!savedCareer) {
      setCareer(EMPTY_CAREER);
      return;
    }

    try {
      const parsed = JSON.parse(savedCareer) as Partial<TeamProfileCareer>;
      let aiTeamLeadership = parsed.aiTeamLeadership ?? {};
      const existingAiLeadership = aiTeamLeadership[teamId];
      if (
        team
        && team.id !== userTeamId
        && (!existingAiLeadership || existingAiLeadership.season !== currentSeason)
      ) {
        const teamSquad = team.squad
          .map((playerId) => players[playerId])
          .filter((player): player is Player => Boolean(player));
        aiTeamLeadership = {
          ...aiTeamLeadership,
          [team.id]: appointAiTeamLeadership(team, teamSquad, currentSeason),
        };
        localStorage.setItem(`ipl_career_${userTeamId}`, JSON.stringify({
          ...parsed,
          aiTeamLeadership,
        }));
      }

      setCareer({
        fixtures: Array.isArray(parsed.fixtures) ? parsed.fixtures : [],
        standings: Array.isArray(parsed.standings) ? parsed.standings : [],
        playerStats: parsed.playerStats && typeof parsed.playerStats === "object" ? parsed.playerStats : {},
        battingFirstXI: Array.isArray(parsed.battingFirstXI) ? parsed.battingFirstXI : [],
        bowlingFirstXI: Array.isArray(parsed.bowlingFirstXI) ? parsed.bowlingFirstXI : [],
        battingFirstImpactSubs: Array.isArray(parsed.battingFirstImpactSubs) ? parsed.battingFirstImpactSubs : [],
        bowlingFirstImpactSubs: Array.isArray(parsed.bowlingFirstImpactSubs) ? parsed.bowlingFirstImpactSubs : [],
        teamLeadership: parsed.teamLeadership,
        aiTeamLeadership,
      });
    } catch (error) {
      console.error("Unable to load team profile career data:", error);
      setCareer(EMPTY_CAREER);
    }
  }, [currentSeason, hasMounted, players, team, teamId, userTeamId]);

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

  const profileLineups = useMemo(() => {
    const cached = profileLineupsCacheRef.current;
    if (
      cached
      && cached.career === career
      && cached.squad === squad
      && cached.teamId === teamId
      && cached.userTeamId === userTeamId
    ) {
      return cached.lineups;
    }
    if (activeTab !== "lineups") return null;

    const isProfileUserTeam = teamId === userTeamId;
    const aiLeadership = career.aiTeamLeadership?.[teamId];
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
      profileLineupsCacheRef.current = {
        career,
        squad,
        teamId,
        userTeamId,
        lineups: generated,
      };
      return generated;
    }

    const squadIds = new Set(squad.map((player) => player.id));
    const useSavedPlan = (
      savedXI: readonly string[],
      savedImpactSubs: readonly string[],
      fallback: AiLineupPlan,
    ): AiLineupPlan => {
      const startingXI = Array.from(new Set(savedXI)).filter((playerId) => squadIds.has(playerId));
      if (startingXI.length !== 11) return fallback;
      const startingPlayers = startingXI
        .map((playerId) => players[playerId])
        .filter((player): player is Player => Boolean(player));
      const isEligibleImpactId = (playerId: string) => {
        const impactPlayer = players[playerId];
        return Boolean(
          impactPlayer
          && squadIds.has(playerId)
          && !startingXI.includes(playerId)
          && isImpactPlayerWithinOverseasLimit(startingPlayers, impactPlayer),
        );
      };
      const savedImpactPlayerId = savedImpactSubs.find(isEligibleImpactId);
      const impactPlayerId = savedImpactPlayerId
        ?? (fallback.impactPlayerId && isEligibleImpactId(fallback.impactPlayerId)
          ? fallback.impactPlayerId
          : null);

      return {
        ...fallback,
        startingXI,
        impactPlayerId,
        likelyOutgoingPlayerId: null,
        captainId: designatedCaptainId ?? fallback.captainId,
        viceCaptainId: designatedViceCaptainId ?? fallback.viceCaptainId,
        usesProvisionalCaptain: !designatedCaptainId,
      };
    };

    const lineups = {
      battingFirst: useSavedPlan(
        career.battingFirstXI,
        career.battingFirstImpactSubs,
        generated.battingFirst,
      ),
      bowlingFirst: useSavedPlan(
        career.bowlingFirstXI,
        career.bowlingFirstImpactSubs,
        generated.bowlingFirst,
      ),
    };
    profileLineupsCacheRef.current = {
      career,
      squad,
      teamId,
      userTeamId,
      lineups,
    };
    return lineups;
  }, [activeTab, career, players, squad, teamId, userTeamId]);

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
  const recentFixtures = [...completedFixtures].reverse().slice(0, 5);
  const nextFixtures = upcomingFixtures.slice(0, visibleNextFixtureCount);

  const teamSeasonStats = useMemo(() => Object.values(career.playerStats)
    .filter((stat) => stat.teamId === teamId), [career.playerStats, teamId]);
  const leadingRunScorer = [...teamSeasonStats].sort((left, right) => right.runs - left.runs)[0];
  const leadingWicketTaker = [...teamSeasonStats].sort((left, right) => right.wickets - left.wickets)[0];

  const bestBatter = [...squad].sort((left, right) => right.currentBatting - left.currentBatting)[0];
  const bestBowler = [...squad].sort((left, right) => right.currentBowling - left.currentBowling)[0];
  const savedLeadership = teamId === userTeamId
    ? career.teamLeadership
    : career.aiTeamLeadership?.[teamId];
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

  if (!hasMounted) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center bg-bg">
        <span className="font-space-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">Loading team profile…</span>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex h-[calc(100vh-3rem)] flex-col items-center justify-center bg-bg p-8 text-center">
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

  return (
    <div className="flex h-[calc(100vh-3rem)] min-h-0 flex-col overflow-hidden bg-bg">
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
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-3" /> {team.city}</span>
              <span>{team.homeGround}</span>
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
              <section className="min-h-0 overflow-hidden border border-border bg-surface p-3">
                <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.15em] text-accent">Club identity</p>
                <h2 className="mt-0.5 font-anton text-[18px] uppercase leading-none text-text-primary">{team.shortName} details</h2>
                <dl className="mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-y-2 text-[9px]">
                  <dt className="font-space-mono uppercase text-text-secondary">Home city</dt>
                  <dd className="truncate font-semibold text-text-primary">{team.city}</dd>
                  <dt className="font-space-mono uppercase text-text-secondary">Ground</dt>
                  <dd className="truncate font-semibold text-text-primary">{team.homeGround}</dd>
                  <dt className="font-space-mono uppercase text-text-secondary">Approach</dt>
                  <dd className="truncate font-semibold text-text-primary">{team.aiPersonality}</dd>
                </dl>
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
                            backgroundColor: team.primaryColor,
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
                      className="relative flex min-h-0 flex-col justify-between overflow-hidden border border-border bg-bg px-2 py-1.5"
                      style={{ borderTopColor: team.primaryColor, borderTopWidth: 2 }}
                    >
                      <div className="flex items-center">
                        <span className="truncate font-space-mono text-[8px] font-bold uppercase tracking-[0.06em] text-text-secondary">{label}</span>
                      </div>
                      <div className="flex min-h-0 min-w-0 flex-1 items-end justify-between gap-2 pt-1">
                        <span className="line-clamp-2 min-w-0 text-[13px] font-bold leading-[0.95] text-text-primary" title={player?.name}>
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
                  {nextFixtures.map((fixture) => {
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
            <div className="flex shrink-0 items-center justify-between border-b-2 border-border px-6 py-4">
              <div>
                <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.15em] text-accent">{currentSeason} registered squad</p>
                <h2 className="mt-1 font-anton text-[22px] uppercase leading-none text-text-primary">{team.shortName} playing staff</h2>
              </div>
              <div className="flex gap-5 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                <span>{squad.length}/{team.maxSquadSize} players</span>
                <span>{overseasCount}/{team.overseasPlayersMax} overseas</span>
                <span>{retainedIds.size} retained</span>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full table-fixed text-left text-[11px]">
                <thead className="sticky top-0 z-10 border-b border-border bg-bg font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">
                  <tr>
                    <th className="w-[28%] px-6 py-3">Player</th>
                    <th className="w-[18%] px-4 py-3">Role</th>
                    <th className="w-[8%] px-4 py-3 text-center">Age</th>
                    <th className="w-[10%] px-4 py-3 text-center">Bat</th>
                    <th className="w-[10%] px-4 py-3 text-center">Bowl</th>
                    <th className="w-[10%] px-4 py-3 text-center">Overall</th>
                    <th className="w-[16%] px-6 py-3 text-right">Acquisition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {squad.map((player) => {
                    const purchasePrice = seasonSales.get(player.id);
                    const retained = retainedIds.has(player.id) || player.isRetained;
                    return (
                      <tr key={player.id} className="transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]">
                        <td className="px-6 py-3">
                          <div className="truncate font-semibold text-text-primary">{player.name}</div>
                          <div className="mt-0.5 font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                            {player.nationality}{player.isCapped ? " · Capped" : " · Uncapped"}
                          </div>
                        </td>
                        <td className="truncate px-4 py-3 text-text-secondary">{ROLE_LABELS[player.role]}</td>
                        <td className="px-4 py-3 text-center font-space-mono text-text-secondary">{player.age}</td>
                        <td className="px-4 py-3 text-center font-space-mono font-bold text-text-primary">{player.currentBatting}</td>
                        <td className="px-4 py-3 text-center font-space-mono font-bold text-text-primary">{player.currentBowling}</td>
                        <td className="px-4 py-3 text-center font-space-mono font-bold text-accent">{playerRating(player)}</td>
                        <td className="px-6 py-3 text-right font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                          {retained ? "Retained" : purchasePrice !== undefined ? formatPrice(purchasePrice) : "Squad"}
                        </td>
                      </tr>
                    );
                  })}
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
                  return (
                    <article
                      key={fixture.id}
                      className="relative overflow-hidden border border-border bg-surface px-5 py-4 shadow-sm"
                    >
                      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: team.primaryColor }} />
                      <div className="flex items-center justify-between gap-4 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                        <span>Match {fixture.matchNumber} · {safeDateLabel(fixture.date, { weekday: "short", day: "numeric", month: "short" })} · {fixture.time ?? "TBC"}</span>
                        <span className={fixture.played ? won ? "text-success" : "text-danger" : "text-accent"}>
                          {fixture.played ? won ? "Won" : "Lost" : "Upcoming"}
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

        {activeTab === "lineups" && profileLineups && (
          <div className="grid h-full min-h-0 grid-cols-2 gap-5">
            <LineupColumn
              title="Bat first lineup"
              description="The stronger batting XI, with the most likely bowling Impact option highlighted."
              plan={profileLineups.battingFirst}
              players={players}
              team={team}
            />
            <LineupColumn
              title="Bowl first lineup"
              description="The stronger bowling XI, with the most likely batting Impact option highlighted."
              plan={profileLineups.bowlingFirst}
              players={players}
              team={team}
            />
          </div>
        )}
      </main>
    </div>
  );
}
