"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Award, Bookmark, X } from "lucide-react";
import { INITIAL_ACTIVE_SEASON, useGameStore } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";
import { formatDisplayDate } from "@/lib/logic/displayDate";
import { formatStatValue } from "@/lib/logic/statFormatting";
import { formatTopSevenBattingPositions } from "@/lib/logic/playerBattingPositions";
import { classifyBowlingUsage } from "@/lib/logic/playerBowlingUsage";
import { supabase } from "@/lib/supabase/client";
import { evaluateCareerHallOfFame } from "@/lib/logic/hallOfFame";
import { getClubFigures, type ClubFigureTier } from "@/lib/data/clubFigures";
import { RecentInjuriesTile } from "@/components/player/RecentInjuriesTile";
import { SeasonMatchesTile } from "@/components/player/SeasonMatchesTile";
import { ScoutNotesTile } from "@/components/player/ScoutNotesTile";
import { AuctionValueTile } from "@/components/player/AuctionValueTile";
import { PlayerCompetitionTile } from "@/components/player/PlayerCompetitionTile";
import { getInternationalCareerStatus, type SelectionPerformance } from "@/lib/logic/internationalCareerStatus";
import { getPlayerCareerStage } from "@/lib/logic/playerCareerStage";
import type { InternationalCareerState } from "@/lib/logic/international";
import {
  getPlayerSeasonHistory,
  mergePlayerIplHistory,
  protectCompletedSeasonTeamsFromTrades,
  summarizeIplPlayerFixtures,
  summarizeIplSeasonMatchLogs,
  upsertPlayerContractHistory,
  upsertPlayerIplHistory,
  wasPlayerAcquiredViaRtm,
} from "@/lib/logic/playerHistory";
import type { HistoricalPlayerSnapshot } from "@/lib/logic/careerLifecycle";
import type { Player, IPLHistoryEntry } from "@/lib/types";

export function retiredSnapshotPlayer(snapshot: HistoricalPlayerSnapshot): Player {
  return {
    id: snapshot.id,
    name: snapshot.name,
    age: snapshot.retirementAge,
    nationality: snapshot.nationality,
    country: snapshot.country,
    state: snapshot.state,
    dateOfBirth: snapshot.dateOfBirth,
    role: snapshot.role,
    battingStyle: snapshot.battingStyle ?? "Right-hand",
    bowlingStyle: snapshot.bowlingStyle ?? null,
    bowlingHand: snapshot.bowlingHand ?? null,
    bowlingUsage: snapshot.bowlingUsage,
    paceSpeedBand: snapshot.paceSpeedBand,
    spinStyle: snapshot.spinStyle,
    careerStats: snapshot.careerStats,
    iplStats: snapshot.iplStats,
    t20iStats: snapshot.t20iStats,
    iplHistory: snapshot.iplHistory,
    basePrice: 0,
    isCapped: snapshot.isCapped ?? true,
    internationalDebutSeason: snapshot.internationalDebutSeason,
    internationalDebutCountry: snapshot.internationalDebutCountry,
    internationalDebutDate: snapshot.internationalDebutDate,
    iplTitleSeasons: snapshot.iplTitleSeasons,
    iplRunnerUpSeasons: snapshot.iplRunnerUpSeasons,
    iplOrangeCapSeasons: snapshot.iplOrangeCapSeasons,
    iplPurpleCapSeasons: snapshot.iplPurpleCapSeasons,
    iplMvpSeasons: snapshot.iplMvpSeasons,
    iplEmergingPlayerSeasons: snapshot.iplEmergingPlayerSeasons,
    isRetained: false,
    retainedByTeamId: null,
    currentTeamId: null,
    potential: "Established",
    currentBatting: snapshot.currentBatting ?? snapshot.finalRating,
    potentialBatting: snapshot.potentialBatting ?? snapshot.currentBatting ?? snapshot.finalRating,
    currentBowling: snapshot.currentBowling ?? snapshot.finalRating,
    potentialBowling: snapshot.potentialBowling ?? snapshot.currentBowling ?? snapshot.finalRating,
    isWicketkeeper: snapshot.role === "WK-Batsman",
    isOpener: snapshot.isOpener,
    hasBattedAt3: snapshot.hasBattedAt3,
    hasBattedAt4: snapshot.hasBattedAt4,
    hasBattedAt5: snapshot.hasBattedAt5,
    hasBattedAt6: snapshot.hasBattedAt6,
    hasBattedAt7: snapshot.hasBattedAt7,
    isFinisher: snapshot.isFinisher,
    reputation: snapshot.reputation,
    captaincy: snapshot.captaincy,
    battingAggression: snapshot.battingAggression ?? snapshot.aggression,
    aggression: snapshot.aggression ?? snapshot.battingAggression,
  };
}

function formatDateOfBirth(dateStr?: string | null): string {
  return dateStr?.trim() ? formatDisplayDate(dateStr.trim()) : "Not available";
}

const NATIONAL_CAP_COLORS: Record<string, string> = {
  india: "#1d4ed8", indian: "#1d4ed8", ind: "#1d4ed8",
  "south africa": "#15803d", sa: "#15803d",
  australia: "#a16207", aus: "#a16207",
  england: "#b91c1c", eng: "#b91c1c",
  pakistan: "#15803d", pak: "#15803d",
  "new zealand": "#334155", nz: "#334155",
  "west indies": "#881337", wi: "#881337",
  "sri lanka": "#1e40af", sl: "#1e40af",
  bangladesh: "#166534", ban: "#166534",
  afghanistan: "#2563eb", afg: "#2563eb",
  zimbabwe: "#b91c1c", zim: "#b91c1c",
  ireland: "#15803d", ire: "#15803d",
  scotland: "#1d4ed8", sco: "#1d4ed8",
  netherlands: "#c2410c", ned: "#c2410c",
  nepal: "#b91c1c", nep: "#b91c1c",
  "united states": "#1d4ed8", usa: "#1d4ed8",
  canada: "#b91c1c", can: "#b91c1c",
  namibia: "#1d4ed8", nam: "#1d4ed8",
  "united arab emirates": "#b91c1c", uae: "#b91c1c",
  oman: "#b91c1c", oma: "#b91c1c",
  "papua new guinea": "#b91c1c", png: "#b91c1c",
  uganda: "#b91c1c", uga: "#b91c1c",
  kenya: "#15803d", ken: "#15803d",
  "hong kong": "#b91c1c", hkg: "#b91c1c",
  malaysia: "#1d4ed8", mas: "#1d4ed8",
  italy: "#1d4ed8", ita: "#1d4ed8",
  jersey: "#b91c1c", jer: "#b91c1c",
};

export interface ProfileModalMatch {
  id: string;
  matchNumber?: number;
  played: boolean;
  winner?: string;
  date?: string;
  teamA?: string;
  teamB?: string;
  simulation?: {
    lineups?: Record<string, { startingXI?: string[]; finalXI?: string[]; impactSubs?: string[] }>;
    impactDecisions?: Array<{ teamId: string; used: boolean; incomingPlayerId?: string }>;
    innings?: Array<{
      batting: Array<{ id: string; runs?: number; balls?: number; fours?: number; sixes?: number; notOut?: boolean; dismissal?: string }>;
      bowling: Array<{ id: string; wickets?: number; overs?: number; runsConceded?: number }>;
    }>;
  };
  scorecard?: {
    inningsA: {
      batting: Array<{
        id: string;
        runs?: number;
        balls?: number;
        fours?: number;
        sixes?: number;
        notOut?: boolean;
        dismissal?: string;
      }>;
      bowling: Array<{
        id: string;
        overs?: number;
        runsConceded?: number;
        wickets?: number;
      }>;
    };
    inningsB: {
      batting: Array<{
        id: string;
        runs?: number;
        balls?: number;
        fours?: number;
        sixes?: number;
        notOut?: boolean;
        dismissal?: string;
      }>;
      bowling: Array<{
        id: string;
        overs?: number;
        runsConceded?: number;
        wickets?: number;
      }>;
    };
  };
}

interface PlayerPersonnelRelationship {
  dynamic_id: number;
  dynamic_type_name: string;
  rating: number;
  partner_name: string;
  partner_type: "player" | "staff";
  partner_id: string;
  partner_role: string;
  subject_reason: string | null;
}

const LinkedStaffProfile = dynamic(() => import("@/components/club/StaffManagementPage").then((module) => module.LinkedStaffProfile), { ssr: false });

interface PlayerProfileModalProps {
  playerId: string | null;
  onClose: () => void;
  onOpenPlayer?: (playerId: string) => void;
  customFixtures?: ProfileModalMatch[];
  additionalCareerT20Stats?: { matches: number; runs: number; wickets: number; balls?: number; dismissals?: number; bowlingInnings?: number; runsConceded?: number };
  internationalStats?: { matches: number; innings: number; runs: number; balls: number; notOuts: number; highestScore: number; bowlingInnings: number; bowlingBalls: number; runsConceded: number; wickets: number; bestBowlingWickets: number; bestBowlingRuns: number };
  internationalCareer?: InternationalCareerState | null;
  isShortlisted?: boolean;
  onToggleShortlist?: (playerId: string) => void;
}

function FittedStatus({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(25);

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    const fit = () => {
      const naturalWidth = measure.getBoundingClientRect().width;
      const availableWidth = container.clientWidth;
      if (naturalWidth > 0 && availableWidth > 0) {
        setFontSize(Math.min(25, 25 * availableWidth / naturalWidth));
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text]);

  return <div ref={containerRef} className="absolute inset-x-2 bottom-1.5 min-w-0 overflow-visible">
    <span ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute whitespace-nowrap font-barlow-condensed text-[25px] font-bold tracking-tight">{text}</span>
    <p className="whitespace-nowrap pb-0.5 font-barlow-condensed font-bold leading-[1.35] tracking-tight text-accent" style={{ fontSize }}>{text}</p>
  </div>;
}

function hallOfFameStanding(score: number): string {
  if (score >= 90) return "All-Time IPL Great";
  if (score >= 80) return "Era-Defining Career";
  if (score >= 65) return "Hall of Fame Calibre";
  if (score >= 55) return "Hall of Fame Conversation";
  if (score >= 40) return "Notable IPL Career";
  if (score >= 25) return "Established IPL Contributor";
  if (score >= 10) return "Building an IPL Record";
  return "Limited IPL Footprint";
}

function clubLegacyStanding(points: number, tier: ClubFigureTier | null): string {
  if (tier === "legend") return points >= 300 ? "Defining Club Legend" : "Club Legend";
  if (tier === "icon") return points >= 160 ? "Cornerstone of the Club" : "Club Icon";
  if (tier === "hero") return points >= 90 ? "Standout Club Hero" : "Club Hero";
  return points >= 20 ? "Building a Place at the Club" : "New to the Club's Story";
}

export function PlayerProfileModal({
  playerId,
  onClose,
  onOpenPlayer,
  customFixtures,
  additionalCareerT20Stats,
  internationalStats,
  internationalCareer,
  isShortlisted: propsIsShortlisted,
  onToggleShortlist,
}: PlayerProfileModalProps) {
  const [profileTab, setProfileTab] = useState<"info" | "stats">("info");
  const infoViewportRef = useRef<HTMLDivElement>(null);
  const [infoLayout, setInfoLayout] = useState({ scale: 1, width: 952, height: 686 });
  const [linkedPlayerId, setLinkedPlayerId] = useState<string | null>(null);
  useEffect(() => setProfileTab("info"), [playerId, linkedPlayerId]);
  const [linkedStaffId, setLinkedStaffId] = useState<string | null>(null);
  const [relationships, setRelationships] = useState<PlayerPersonnelRelationship[]>([]);
  const [relationshipsStatus, setRelationshipsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [relationshipTooltip, setRelationshipTooltip] = useState<{ text: string; left: number; top: number; below: boolean } | null>(null);
  const showRelationshipTooltip = (element: HTMLElement, text: string) => {
    const bounds = element.getBoundingClientRect();
    setRelationshipTooltip({
      text,
      left: Math.max(12, Math.min(bounds.left, window.innerWidth - 332)),
      top: bounds.top >= 100 ? bounds.top - 6 : bounds.bottom + 6,
      below: bounds.top < 100,
    });
  };
  const awardTooltipProps = (text: string) => ({
    tabIndex: 0,
    "aria-label": text,
    onMouseEnter: (event: React.MouseEvent<HTMLSpanElement>) => showRelationshipTooltip(event.currentTarget, text),
    onMouseLeave: () => setRelationshipTooltip(null),
    onFocus: (event: React.FocusEvent<HTMLSpanElement>) => showRelationshipTooltip(event.currentTarget, text),
    onBlur: () => setRelationshipTooltip(null),
  });
  useEffect(() => setRelationshipTooltip(null), [playerId, linkedPlayerId, linkedStaffId, profileTab]);
  const players = useGameStore((state) => state.players);
  const teams = useGameStore((state) => state.teams);
  const currentSeason = useGameStore((state) => state.currentSeason);
  const currentDate = useGameStore((state) => state.currentDate);
  const auction = useGameStore((state) => state.auction);
  const retiredPlayerSnapshots = useGameStore((state) => state.retiredPlayerSnapshots);
  const simulatedLeagueHistory = useGameStore((state) => state.simulatedLeagueHistory);
  const clubFigureProgression = useGameStore((state) => state.clubFigureProgression);
  const clubFigureTierOverrides = useGameStore((state) => state.clubFigureTierOverrides);
  const tradeRecords = useGameStore((state) => state.tradeRecords);
  const careerSeasonArchives = useGameStore((state) => state.careerSeasonArchives);
  const internalShortlist = useGameStore((state) => state.playerShortlist);
  const setInternalShortlist = useGameStore((state) => state.setPlayerShortlist);
  const viewedPlayerId = linkedPlayerId ?? playerId;
  const activePlayer = viewedPlayerId ? players[viewedPlayerId] ?? null : null;
  const retiredSnapshot = viewedPlayerId && !activePlayer
    ? retiredPlayerSnapshots[viewedPlayerId] ?? null
    : null;
  const relationshipSubjectName = activePlayer?.name ?? retiredSnapshot?.name;
  const hallOfFameEvaluation = useMemo(() => viewedPlayerId == null ? null : evaluateCareerHallOfFame(
    players,
    retiredPlayerSnapshots,
    simulatedLeagueHistory,
  ).find((evaluation) => evaluation.playerId === viewedPlayerId) ?? null, [players, retiredPlayerSnapshots, simulatedLeagueHistory, viewedPlayerId]);
  const isHallOfFamer = hallOfFameEvaluation?.inducted ?? false;
  const clubLegacy = useMemo(() => {
    if (!activePlayer) return null;
    const teamId = activePlayer.currentTeamId
      ?? [...activePlayer.iplHistory].reverse().find((entry) => entry.teamId && entry.teamId !== "UNSOLD")?.teamId;
    if (!teamId) return null;
    const figure = getClubFigures(teamId, players, clubFigureTierOverrides, clubFigureProgression, retiredPlayerSnapshots)
      .find((entry) => entry.playerId === activePlayer.id);
    const progress = Object.values(clubFigureProgression).find((entry) => entry.teamId === teamId && entry.playerId === activePlayer.id);
    return { teamId, points: figure?.legacyPoints ?? progress?.points ?? 0, tier: figure?.tier ?? progress?.tier ?? null };
  }, [activePlayer, players, clubFigureTierOverrides, clubFigureProgression, retiredPlayerSnapshots]);

  useEffect(() => {
    const viewport = infoViewportRef.current;
    if (!viewport || retiredSnapshot || profileTab !== "info") return;
    const updateScale = () => {
      if (!viewport.clientWidth || !viewport.clientHeight) return;
      const usableWidth = Math.max(1, viewport.clientWidth - 8);
      const scale = Math.min(1, viewport.clientHeight / 686, usableWidth / 952);
      const width = usableWidth / scale;
      const height = viewport.clientHeight / scale;
      setInfoLayout((previous) => previous.scale === scale && previous.width === width && previous.height === height
        ? previous : { scale, width, height });
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [profileTab, retiredSnapshot, viewedPlayerId]);

  useEffect(() => {
    if (!playerId || linkedStaffId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, playerId, linkedStaffId]);

  useEffect(() => {
    if (!relationshipSubjectName || profileTab !== "info") return;
    let cancelled = false;
    setRelationships([]);
    setRelationshipsStatus("loading");
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("person_dynamics_view")
          .select("dynamic_id,dynamic_type_name,rating,partner_name,partner_type,partner_id,partner_role,subject_reason")
          .eq("subject_type", "player")
          .eq("subject_name", relationshipSubjectName)
          .order("rating", { ascending: false });
        if (cancelled) return;
        if (error) throw error;
        setRelationships((data ?? []) as PlayerPersonnelRelationship[]);
        setRelationshipsStatus("ready");
      } catch {
        if (!cancelled) setRelationshipsStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [relationshipSubjectName, profileTab]);
  const detailedPlayer: Player | null = viewedPlayerId
    ? activePlayer ?? (retiredSnapshot ? retiredSnapshotPlayer(retiredSnapshot) : null)
    : null;
  const careerT20Matches = (detailedPlayer?.careerStats?.batting.matches ?? 0) + (additionalCareerT20Stats?.matches ?? 0);
  const careerT20Innings = (detailedPlayer?.careerStats?.batting.innings ?? 0) + (additionalCareerT20Stats?.matches ?? 0);
  const careerT20Runs = (detailedPlayer?.careerStats?.batting.runs ?? 0) + (additionalCareerT20Stats?.runs ?? 0);
  const careerT20BowlingMatches = (detailedPlayer?.careerStats?.bowling.matches ?? 0) + (additionalCareerT20Stats?.bowlingInnings ?? 0);
  const careerT20Wickets = (detailedPlayer?.careerStats?.bowling.wickets ?? 0) + (additionalCareerT20Stats?.wickets ?? 0);
  const baseBattingDismissals = detailedPlayer?.careerStats?.batting.dismissals
    ?? ((detailedPlayer?.careerStats?.batting.average ?? 0) > 0 ? (detailedPlayer?.careerStats?.batting.runs ?? 0) / detailedPlayer!.careerStats.batting.average : 0);
  const baseBattingBalls = detailedPlayer?.careerStats?.batting.balls
    ?? ((detailedPlayer?.careerStats?.batting.strikeRate ?? 0) > 0 ? (detailedPlayer?.careerStats?.batting.runs ?? 0) * 100 / detailedPlayer!.careerStats.batting.strikeRate : 0);
  const careerT20Average = careerT20Runs > 0 && baseBattingDismissals + (additionalCareerT20Stats?.dismissals ?? 0) > 0
    ? careerT20Runs / (baseBattingDismissals + (additionalCareerT20Stats?.dismissals ?? 0)) : 0;
  const careerT20StrikeRate = careerT20Runs > 0 && baseBattingBalls + (additionalCareerT20Stats?.balls ?? 0) > 0
    ? careerT20Runs * 100 / (baseBattingBalls + (additionalCareerT20Stats?.balls ?? 0)) : 0;
  const baseBowlingRuns = detailedPlayer?.careerStats?.bowling.runsConceded
    ?? (detailedPlayer?.careerStats?.bowling.wickets ?? 0) * (detailedPlayer?.careerStats?.bowling.average ?? 0);
  const careerT20BowlingAverage = careerT20Wickets > 0 ? (baseBowlingRuns + (additionalCareerT20Stats?.runsConceded ?? 0)) / careerT20Wickets : 0;

  const effectiveInternationalStats = useMemo(() => {
    const dbStats = detailedPlayer?.t20iStats;
    const simStats = internationalStats;
    const matches = (dbStats?.matches ?? 0) + (simStats?.matches ?? 0);
    const innings = (dbStats?.battingInnings ?? 0) + (simStats?.innings ?? 0);
    const runs = (dbStats?.runs ?? 0) + (simStats?.runs ?? 0);
    const balls = (dbStats?.ballsFaced ?? 0) + (simStats?.balls ?? 0);
    const notOuts = (dbStats?.notOuts ?? 0) + (simStats?.notOuts ?? 0);
    const highestScore = Math.max(dbStats?.highScore ?? 0, simStats?.highestScore ?? 0);
    const bowlingInnings = (dbStats?.bowlingInnings ?? 0) + (simStats?.bowlingInnings ?? 0);
    const bowlingBalls = (dbStats?.bowlingBalls ?? 0) + (simStats?.bowlingBalls ?? 0);
    const runsConceded = (dbStats?.runsConceded ?? 0) + (simStats?.runsConceded ?? 0);
    const wickets = (dbStats?.wickets ?? 0) + (simStats?.wickets ?? 0);

    let bestBowlingWickets = 0;
    let bestBowlingRuns = 0;
    const dbBestW = dbStats?.bestBowlingWickets ?? 0;
    const dbBestR = dbStats?.bestBowlingRuns ?? 0;
    const simBestW = simStats?.bestBowlingWickets ?? 0;
    const simBestR = simStats?.bestBowlingRuns ?? 0;

    if (dbBestW > simBestW || (dbBestW === simBestW && dbBestW > 0 && dbBestR <= simBestR)) {
      bestBowlingWickets = dbBestW;
      bestBowlingRuns = dbBestR;
    } else {
      bestBowlingWickets = simBestW;
      bestBowlingRuns = simBestR;
    }

    return {
      matches,
      innings,
      runs,
      balls,
      notOuts,
      highestScore,
      bowlingInnings,
      bowlingBalls,
      runsConceded,
      wickets,
      bestBowlingWickets,
      bestBowlingRuns,
    };
  }, [detailedPlayer?.t20iStats, internationalStats]);

  const isPlayerShortlisted = propsIsShortlisted !== undefined
    ? propsIsShortlisted
    : Boolean(detailedPlayer && internalShortlist.includes(detailedPlayer.id));

  const handleToggleShortlist = () => {
    if (!detailedPlayer) return;
    if (onToggleShortlist) {
      onToggleShortlist(detailedPlayer.id);
      return;
    }
    const nextList = internalShortlist.includes(detailedPlayer.id)
      ? internalShortlist.filter((id) => id !== detailedPlayer.id)
      : [...internalShortlist, detailedPlayer.id];
    setInternalShortlist(nextList);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ipl_shortlist_updated", { detail: { shortlist: nextList } }));
    }
  };

  const rosterSeason = String(auction?.season ?? currentSeason);
  const selectionPerformance = useMemo(() => {
    const result: Record<string, SelectionPerformance> = {};
    const fixtures = (customFixtures ?? []).filter((fixture) => fixture.played && (!fixture.date || Number(fixture.date.slice(0, 4)) === currentSeason))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || (b.matchNumber ?? 0) - (a.matchNumber ?? 0));
    fixtures.forEach((fixture) => {
      const innings = fixture.simulation?.innings ?? (fixture.scorecard ? [fixture.scorecard.inningsA, fixture.scorecard.inningsB] : []);
      const match = new Map<string, { runs: number; wickets: number }>();
      innings.forEach((entry) => {
        entry.batting.forEach((batting) => { const row = match.get(batting.id) ?? { runs: 0, wickets: 0 }; row.runs += batting.runs ?? 0; match.set(batting.id, row); });
        entry.bowling.forEach((bowling) => { const row = match.get(bowling.id) ?? { runs: 0, wickets: 0 }; row.wickets += bowling.wickets ?? 0; match.set(bowling.id, row); });
      });
      Object.values(fixture.simulation?.lineups ?? {}).forEach((lineup) => (lineup.finalXI ?? lineup.startingXI ?? []).forEach((id) => {
        if (!match.has(id)) match.set(id, { runs: 0, wickets: 0 });
      }));
      match.forEach((value, id) => {
        const row = result[id] ?? { matches: 0, runs: 0, wickets: 0, recent: [] };
        row.matches += 1; row.runs += value.runs; row.wickets += value.wickets;
        if (row.recent.length < 5) row.recent.push(value);
        result[id] = row;
      });
    });
    return result;
  }, [customFixtures, currentSeason]);
  const internationalCareerStatus = useMemo(() => activePlayer
    ? getInternationalCareerStatus(activePlayer, internationalCareer, players, selectionPerformance)
    : null, [activePlayer, internationalCareer, players, selectionPerformance]);

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

  // Calculate Current Season Stats from fixtures
  const seasonStats = useMemo(() => {
    if (!detailedPlayer) return null;

    let batInnings = 0;
    let runs = 0;
    let balls = 0;
    let fours = 0;
    let sixes = 0;
    let notOuts = 0;
    let highScore = 0;
    let highScoreNotOut = false;

    let bowlMatches = 0;
    let bowlBalls = 0;
    let bowlRunsConceded = 0;
    let bowlWickets = 0;
    let threeFers = 0;
    let bestWickets = 0;
    let bestRunsConceded = 999;

    const playerMatchSet = new Set<string>();

    const fixturesToScan = customFixtures ?? [];

    fixturesToScan.forEach((fixture) => {
      if (!fixture.played) return;
      if (fixture.date && Number(fixture.date.slice(0, 4)) !== currentSeason) return;
      if (!fixture.teamA || !fixture.teamB || !teams[fixture.teamA] || !teams[fixture.teamB]) return;
      if (Object.values(fixture.simulation?.lineups ?? {}).some((lineup) => (
        lineup.startingXI?.includes(detailedPlayer.id) || lineup.finalXI?.includes(detailedPlayer.id)
      ))) playerMatchSet.add(fixture.id);
      const inningsRows = fixture.simulation?.innings
        ?? (fixture.scorecard ? [fixture.scorecard.inningsA, fixture.scorecard.inningsB] : []);

      inningsRows.forEach((innings) => {
        const batEntry = innings.batting.find((b) => b.id === detailedPlayer.id);
        if (batEntry) {
          const bRuns = batEntry.runs ?? 0;
          const bBalls = batEntry.balls ?? 0;
          const bFours = batEntry.fours ?? 0;
          const bSixes = batEntry.sixes ?? 0;
          const isNotOut = (batEntry as any).notOut ?? (batEntry.dismissal === "not out");

          if (bBalls > 0 || bRuns > 0) {
            playerMatchSet.add(fixture.id);
            batInnings += 1;
            runs += bRuns;
            balls += bBalls;
            fours += bFours;
            sixes += bSixes;
            if (isNotOut) notOuts += 1;

            if (
              bRuns > highScore ||
              (bRuns === highScore && isNotOut && !highScoreNotOut)
            ) {
              highScore = bRuns;
              highScoreNotOut = isNotOut;
            }
          }
        }

        const bowlEntry = innings.bowling.find((bw) => bw.id === detailedPlayer.id);
        if (bowlEntry && (bowlEntry.overs ?? 0) > 0) {
          const bwOvers = bowlEntry.overs ?? 0;
          const bwRuns = bowlEntry.runsConceded ?? 0;
          const bwWkts = bowlEntry.wickets ?? 0;

          playerMatchSet.add(fixture.id);
          bowlMatches += 1;

          const wholeOvers = Math.floor(bwOvers);
          const fraction = Math.round((bwOvers - wholeOvers) * 10);
          bowlBalls += wholeOvers * 6 + fraction;

          bowlRunsConceded += bwRuns;
          bowlWickets += bwWkts;

          if (bwWkts >= 3) {
            threeFers += 1;
          }

          const isBetterBest =
            bwWkts > bestWickets ||
            (bwWkts === bestWickets && bwRuns < bestRunsConceded);

          if (isBetterBest) {
            bestWickets = bwWkts;
            bestRunsConceded = bwRuns;
          }
        }
      });
    });

    const matches = playerMatchSet.size;
    const dismissals = Math.max(1, batInnings - notOuts);
    const batAvg = batInnings > 0 ? formatStatValue(runs / dismissals) : "-";
    const batSR = balls > 0 ? ((runs / balls) * 100).toFixed(1) : "-";

    const bowlAvg = bowlWickets > 0 ? formatStatValue(bowlRunsConceded / bowlWickets) : "-";
    const bowlSR = bowlWickets > 0 ? (bowlBalls / bowlWickets).toFixed(1) : "-";
    const bestFiguresStr = bestWickets > 0 || bestRunsConceded < 999 ? `${bestWickets}/${bestRunsConceded === 999 ? 0 : bestRunsConceded}` : "-";

    return {
      matches,
      runs,
      batSR,
      batAvg,
      fours,
      sixes,
      highScore: highScore > 0 ? `${highScore}${highScoreNotOut ? "*" : ""}` : "-",
      bowlMatches,
      bowlWickets,
      bowlAvg,
      bowlSR,
      threeFers,
      bestFiguresStr,
    };
  }, [customFixtures, currentSeason, detailedPlayer, teams]);

  const recentForm = useMemo(() => {
    if (!detailedPlayer) return [];
    return (customFixtures ?? [])
      .filter((fixture) => fixture.played && (!fixture.date || Number(fixture.date.slice(0, 4)) === currentSeason))
      .flatMap((fixture) => {
        const innings = fixture.simulation?.innings
          ?? (fixture.scorecard ? [fixture.scorecard.inningsA, fixture.scorecard.inningsB] : []);
        const batting = innings.flatMap((entry) => entry.batting).find((entry) => entry.id === detailedPlayer.id);
        const bowling = innings.flatMap((entry) => entry.bowling).find((entry) => entry.id === detailedPlayer.id);
        const didNotBat = !batting || batting.dismissal === "did not bat"
          || ((batting.balls ?? 0) === 0 && (batting.runs ?? 0) === 0 && (!batting.dismissal || batting.dismissal === "not out"));
        const lineupTeamId = Object.entries(fixture.simulation?.lineups ?? {}).find(([, lineup]) =>
          lineup.startingXI?.includes(detailedPlayer.id) || lineup.finalXI?.includes(detailedPlayer.id)
        )?.[0];
        if (!batting && !bowling && !lineupTeamId) return [];
        const teamId = lineupTeamId ?? [fixture.teamA, fixture.teamB].find((id) => id === detailedPlayer.currentTeamId);
        const opponentId = fixture.teamA === teamId ? fixture.teamB : fixture.teamB === teamId ? fixture.teamA : null;
        return [{
          id: fixture.id,
          matchNumber: fixture.matchNumber,
          date: fixture.date,
          opponent: opponentId ? teams[opponentId]?.shortName ?? opponentId : "Match",
          runs: didNotBat ? undefined : batting?.runs,
          balls: didNotBat ? undefined : batting?.balls,
          didNotBat,
          notOut: !didNotBat && (batting?.notOut ?? batting?.dismissal === "not out"),
          wickets: bowling?.wickets,
          conceded: bowling?.runsConceded,
          bowled: (bowling?.overs ?? 0) > 0,
        }];
      })
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || (b.matchNumber ?? 0) - (a.matchNumber ?? 0))
      .slice(0, 5);
  }, [customFixtures, currentSeason, detailedPlayer, teams]);

  const formRunScale = Math.max(1, ...recentForm.map((match) => match.runs ?? 0));
  const formWicketScale = Math.max(1, ...recentForm.map((match) => match.wickets ?? 0));
  const showBattingForm = recentForm.some((match) => match.runs != null || match.didNotBat);
  const showBowlingForm = recentForm.some((match) => match.bowled);
  const formDisplayMatches = [...recentForm].reverse();
  const connectBattingForm = detailedPlayer?.role === "Batsman" || detailedPlayer?.role === "WK-Batsman" || detailedPlayer?.role === "All-Rounder";
  const connectBowlingForm = detailedPlayer?.role === "Pace Bowler" || detailedPlayer?.role === "Spin Bowler" || detailedPlayer?.role === "All-Rounder";
  const battingFormPoints = formDisplayMatches.flatMap((match, index) =>
    showBattingForm && (match.runs ?? 0) >= 1
      ? [{ x: 50 + index * 100 - (showBowlingForm && match.bowled ? 11 : 0), y: 62 - Math.max(6, Math.round((match.runs ?? 0) / formRunScale * 54)) }]
      : []);
  const bowlingFormPoints = formDisplayMatches.flatMap((match, index) =>
    showBowlingForm && match.bowled
      ? [{ x: 50 + index * 100 + (showBattingForm && (match.runs ?? 0) >= 1 ? 11 : 0), y: 62 - Math.max(6, Math.round((match.wickets ?? 0) / formWicketScale * 54)) }]
      : []);

  const currentIplHistoryStats = useMemo(
    () => detailedPlayer ? summarizeIplPlayerFixtures(customFixtures, detailedPlayer.id, {
      season: currentSeason,
      teamIds: new Set(Object.keys(teams)),
    }) : undefined,
    [customFixtures, currentSeason, detailedPlayer, teams],
  );

  const detailedPlayerHistory = useMemo(() => {
    if (!detailedPlayer) return [];
    const mergedHistory = mergePlayerIplHistory([], detailedPlayer.iplHistory);
    const currentEntry = currentSeasonHistoryByPlayer.get(detailedPlayer.id);
    let history = currentEntry ? upsertPlayerContractHistory(mergedHistory, currentEntry) : mergedHistory;

    // Only IPL fixtures may contribute to the current IPL history row.
    if (currentIplHistoryStats) {
      const currentSeasonStr = String(currentSeason);
      const resolvedSeasonStats = {
        ...currentIplHistoryStats,
        balls: 0,
        runsConceded: 0,
        oversBowled: 0,
      };
      if (!history.some((entry) => entry.season === currentSeasonStr)) {
        history = upsertPlayerIplHistory(history, {
          teamId: detailedPlayer.currentTeamId ?? "UNSOLD",
          season: currentSeasonStr,
          price: detailedPlayer.basePrice,
          seasonStats: resolvedSeasonStats,
        });
      }
      history = history.map((entry) => {
        if (entry.season === currentSeasonStr) {
          return {
            ...entry,
            seasonStats: resolvedSeasonStats,
          };
        }
        return entry;
      });
    }

    return protectCompletedSeasonTeamsFromTrades(history, detailedPlayer.id, tradeRecords);
  }, [currentSeasonHistoryByPlayer, currentIplHistoryStats, currentSeason, detailedPlayer, tradeRecords]);

  const teamHistoryIplStats = useMemo(() => {
    const bySeason = new Map<string, { matches: number; runs: number; wickets: number }>();
    if (!detailedPlayer) return bySeason;
    detailedPlayerHistory.forEach((entry) => {
      if (entry.season === String(currentSeason)) {
        if (currentIplHistoryStats) bySeason.set(entry.season, currentIplHistoryStats);
        return;
      }
      const archive = careerSeasonArchives.find((record) => String(record.season) === entry.season);
      if (archive) {
        const verified = summarizeIplSeasonMatchLogs(archive.playerMatchLogs?.[detailedPlayer.id]);
        if (verified) bySeason.set(entry.season, verified);
      } else if (Number(entry.season) < INITIAL_ACTIVE_SEASON && entry.seasonStats) {
        // Imported pre-career IPL history has no simulation match archive.
        bySeason.set(entry.season, entry.seasonStats);
      }
    });
    return bySeason;
  }, [careerSeasonArchives, currentIplHistoryStats, currentSeason, detailedPlayer, detailedPlayerHistory]);
  const careerStage = detailedPlayer ? getPlayerCareerStage(detailedPlayer,
    Array.from(teamHistoryIplStats, ([season, stats]) => ({
      season: Number(season), matches: stats.matches, runs: stats.runs, wickets: stats.wickets,
    }))) : null;

  if (linkedStaffId) return <LinkedStaffProfile staffId={linkedStaffId} customFixtures={customFixtures} onClose={() => setLinkedStaffId(null)} />;
  if (!detailedPlayer) return null;

  const currentTeam = teams[detailedPlayer.currentTeamId ?? ""];
  const isRetired = Boolean(retiredSnapshot);
  const doesNotBowl = detailedPlayer.currentBowling === 0 && detailedPlayer.potentialBowling === 0;
  const iplBowling = detailedPlayer.iplStats;
  const hasIplBowling = Boolean(iplBowling && (
    (iplBowling.bowlingInnings ?? 0) > 0 || (iplBowling.bowlingBalls ?? 0) > 0 ||
    (iplBowling.runsConceded ?? 0) > 0 || (iplBowling.bowlingRunsConceded ?? 0) > 0 ||
    (iplBowling.wickets ?? 0) > 0 || (iplBowling.bowlingAverage ?? 0) > 0 ||
    (iplBowling.economy ?? 0) > 0 || (iplBowling.fourWickets ?? 0) > 0 ||
    (iplBowling.fiveWickets ?? 0) > 0 ||
    (iplBowling.bestBowlingFigures && iplBowling.bestBowlingFigures !== "0/0" && iplBowling.bestBowlingFigures !== "-")
  ));
  const hasCareerT20Bowling = careerT20BowlingMatches > 0 || careerT20Wickets > 0 ||
    baseBowlingRuns > 0 || (additionalCareerT20Stats?.runsConceded ?? 0) > 0;
  const hasInternationalBowling = Boolean(effectiveInternationalStats && (
    effectiveInternationalStats.bowlingInnings > 0 || effectiveInternationalStats.bowlingBalls > 0 ||
    effectiveInternationalStats.runsConceded > 0 || effectiveInternationalStats.wickets > 0 ||
    effectiveInternationalStats.bestBowlingWickets > 0
  ));
  const showIplStumpings = (detailedPlayer.role === "WK-Batsman" || detailedPlayer.isWicketkeeper || detailedPlayer.isPartTimeWk)
    && (detailedPlayer.iplStats?.stumpings ?? 0) > 0;
  const nationalityLabel = detailedPlayer.nationality === "Overseas"
    && detailedPlayer.country
    && detailedPlayer.country !== "Overseas"
    ? detailedPlayer.country
    : detailedPlayer.nationality;
  const cappedCountry = String(detailedPlayer.internationalDebutCountry ?? detailedPlayer.country ?? nationalityLabel).toLowerCase();
  const cappedColor = NATIONAL_CAP_COLORS[cappedCountry] ?? "#475569";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-black/70 p-1 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={onClose}
    >
      <div
        className="flex w-[calc(100%-0.5rem)] max-w-[1800px] min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-surface text-text-primary shadow-2xl animate-in zoom-in-95 duration-200"
        style={{ height: "calc(var(--app-viewport-height, 100vh) - 0.5rem)" }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <header className="max-h-[45vh] shrink-0 overflow-y-auto border-b-2 border-border bg-surface px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <p className="font-space-mono text-[12px] font-bold uppercase text-text-secondary sm:text-[13px]">
                {detailedPlayer.role} · {currentTeam?.name
                  ?? (retiredSnapshot ? `Retired ${retiredSnapshot.retirementSeason}` : "No current club")}
              </p>
              {(() => {
                const titles = detailedPlayer.iplTitleSeasons?.length ?? 0;
                const runnersUp = detailedPlayer.iplRunnerUpSeasons?.length ?? 0;
                const orangeCaps = detailedPlayer.iplOrangeCapSeasons?.length ?? 0;
                const purpleCaps = detailedPlayer.iplPurpleCapSeasons?.length ?? 0;
                const mvps = detailedPlayer.iplMvpSeasons?.length ?? 0;
                const emerging = detailedPlayer.iplEmergingPlayerSeasons?.length ?? 0;

                if (!titles && !runnersUp && !orangeCaps && !purpleCaps && !mvps && !emerging && (isRetired || !isHallOfFamer)) return null;

                return (
                  <div className="flex flex-wrap items-center gap-1">
                    {!isRetired && isHallOfFamer && (
                      <span className="inline-flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/20 px-1.5 py-0.5 font-space-mono text-[8px] font-bold uppercase text-amber-700 dark:text-amber-300" {...awardTooltipProps("League Hall of Fame inductee")}>
                        <Award size={10} aria-hidden="true" /> Hall of Fame
                      </span>
                    )}
                    {titles > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold uppercase text-amber-600 dark:text-amber-400 border border-amber-500/30" {...awardTooltipProps(`IPL Champion: ${detailedPlayer.iplTitleSeasons?.join(", ")}`)}>
                        🏆 {titles}× Champion
                      </span>
                    )}
                    {orangeCaps > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-orange-500/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold uppercase text-orange-600 dark:text-orange-400 border border-orange-500/30" {...awardTooltipProps(`Orange Cap: ${detailedPlayer.iplOrangeCapSeasons?.join(", ")}`)}>
                        🧢 {orangeCaps}× Orange Cap
                      </span>
                    )}
                    {purpleCaps > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-purple-500/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold uppercase text-purple-600 dark:text-purple-400 border border-purple-500/30" {...awardTooltipProps(`Purple Cap: ${detailedPlayer.iplPurpleCapSeasons?.join(", ")}`)}>
                        🟣 {purpleCaps}× Purple Cap
                      </span>
                    )}
                    {mvps > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold uppercase text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" {...awardTooltipProps(`Tournament MVP: ${detailedPlayer.iplMvpSeasons?.join(", ")}`)}>
                        ⭐ {mvps}× MVP
                      </span>
                    )}
                    {emerging > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold uppercase text-sky-600 dark:text-sky-400 border border-sky-500/30" {...awardTooltipProps(`Emerging Player: ${detailedPlayer.iplEmergingPlayerSeasons?.join(", ")}`)}>
                        🌟 Emerging Player ({detailedPlayer.iplEmergingPlayerSeasons?.join(", ")})
                      </span>
                    )}
                    {runnersUp > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-500/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold uppercase text-zinc-600 dark:text-zinc-400 border border-zinc-500/30" {...awardTooltipProps(`IPL Finalist / Runner-up: ${detailedPlayer.iplRunnerUpSeasons?.join(", ")}`)}>
                        🥈 {runnersUp}× Finalist
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="flex min-w-0 items-center gap-x-3 overflow-x-auto py-1">
              <h3 className="min-w-0 shrink truncate font-anton text-[32px] uppercase leading-none text-text-primary sm:text-[38px]" title={detailedPlayer.name}>{detailedPlayer.name}</h3>
              <div className="grid min-h-10 shrink-0 grid-rows-2 self-center font-space-mono text-[12px] font-bold uppercase leading-none tracking-wider text-text-secondary sm:text-[13px]">
                <span className="flex items-center gap-2 whitespace-nowrap">
                  {nationalityLabel}{detailedPlayer.state?.trim() ? ` (${detailedPlayer.state.trim()})` : ""}
                  {detailedPlayer.nationality === "Overseas" && (
                    <span className="rounded-[2px] px-1.5 py-0.5 text-[8px] font-bold text-white" style={{ backgroundColor: currentTeam?.primaryColor ?? "var(--accent)" }}>OS</span>
                  )}
                  {detailedPlayer.isT20IRetired && (
                    <span className="rounded-[2px] border border-slate-400/40 bg-slate-500/15 px-1.5 py-0.5 text-[8px] font-bold text-text-secondary" title="Retired from T20 international cricket; still eligible for franchise cricket">T20I Retired</span>
                  )}
                  <span
                    className="rounded-[2px] border px-1.5 py-0.5 text-[8px] font-bold"
                    style={detailedPlayer.isCapped
                      ? { color: cappedColor, borderColor: `${cappedColor}80`, backgroundColor: `${cappedColor}1f` }
                      : { color: "#64748b", borderColor: "#94a3b880", backgroundColor: "#94a3b81f" }}
                  >
                    {detailedPlayer.isCapped ? "Capped" : "Uncapped"}
                  </span>
                  {detailedPlayer.isCapped && detailedPlayer.internationalDebutDate
                    && detailedPlayer.internationalDebutDate <= currentDate && (
                    <span className="rounded-[2px] border border-border bg-bg px-1.5 py-0.5 text-[8px] font-bold text-text-secondary">
                      Intl debut · {formatDateOfBirth(detailedPlayer.internationalDebutDate)}
                    </span>
                  )}
                </span>
                <span className="flex items-end whitespace-nowrap">Age {detailedPlayer.age} · {formatDateOfBirth(detailedPlayer.dateOfBirth)}</span>
              </div>
            </div>
          {/* Player details across the header */}
          <section className="mt-1.5">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 font-space-mono text-[9px]">
                {[
                  ["Batting", detailedPlayer.battingStyle],
                  ["Bats at", formatTopSevenBattingPositions(detailedPlayer)],
                  ...(!doesNotBowl ? [["Bowling", (() => {
                    if (!detailedPlayer.bowlingStyle) return "DNB";
                    const hand = detailedPlayer.bowlingHand === "Left-hand" ? "Left-arm" : detailedPlayer.bowlingHand === "Right-hand" ? "Right-arm" : "";
                    if (detailedPlayer.bowlingStyle === "Pacer") {
                      const band = detailedPlayer.paceSpeedBand;
                      let bandLabel = "Pacer";
                      if (band === "express") bandLabel = "Express Fast (150+ km/h)";
                      else if (band === "fast") bandLabel = "Fast (140-150 km/h)";
                      else if (band === "fast_medium") bandLabel = "Fast-Medium (130-140 km/h)";
                      else if (band === "medium") bandLabel = "Medium (<130 km/h)";
                      return hand ? `${hand} ${bandLabel}` : bandLabel;
                    }
                    if (detailedPlayer.bowlingStyle === "Spinner") {
                      const style = detailedPlayer.spinStyle;
                      let styleLabel = "Spinner";
                      if (style === "leg_spin") styleLabel = "Leg-spin";
                      else if (style === "off_spin") styleLabel = "Off-spin";
                      else if (style === "left_arm_orthodox") styleLabel = "Orthodox";
                      else if (style === "left_arm_wrist_spin") styleLabel = "Wrist-spin (Chinaman)";
                      else if (style === "mystery_spin") styleLabel = "Mystery Spin";
                      return hand ? `${hand} ${styleLabel}` : styleLabel;
                    }
                    return detailedPlayer.bowlingStyle;
                  })()],
                  ["Bowling Usage", (() => {
                    const usage = detailedPlayer.bowlingUsage ?? classifyBowlingUsage(detailedPlayer);
                    if (usage === "frontline") return "Frontline";
                    if (usage === "regular") return "Regular";
                    if (usage === "part_time") return "Part-time";
                    if (usage === "emergency") return "Emergency";
                    return "Does Not Bowl";
                  })()]] : []),
                ].map(([label, value]) => (
                  <span key={label} className="inline-flex items-baseline gap-1.5 leading-snug">
                    <span className="whitespace-nowrap uppercase text-text-secondary">{label}</span>
                    <span className="font-bold text-text-primary">{value}</span>
                  </span>
                ))}
              </div>
          </section>

          </div>
          <div className="flex w-full flex-wrap items-start justify-end gap-2 lg:ml-4 lg:w-auto lg:shrink-0 lg:flex-nowrap lg:items-stretch">
            {isRetired && isHallOfFamer && (
              <div
                className="mr-20 flex h-[88px] w-[132px] shrink-0 -rotate-6 flex-col items-center justify-center rounded-[18px] border-4 border-double border-amber-500 bg-gradient-to-br from-amber-200 via-yellow-100 to-amber-400 px-2 text-center text-amber-950 shadow-[0_3px_0_#92400e,0_8px_18px_rgba(120,53,15,0.35)] dark:from-amber-700 dark:via-yellow-500 dark:to-amber-800 dark:text-amber-950"
                aria-label="League Hall of Fame inductee"
              >
                <Award size={20} strokeWidth={2.5} aria-hidden="true" />
                <span className="font-anton text-[19px] uppercase leading-none tracking-wide">Hall of Fame</span>
                <span className="mt-0.5 font-space-mono text-[7px] font-bold uppercase tracking-[0.22em]">Inductee</span>
              </div>
            )}
            {!isRetired && (
              <div className="flex w-full max-w-[17rem] shrink-0 border-l-2 border-accent/50 bg-bg/60 lg:w-[17rem] lg:self-stretch">
                {[
                  ["BAT", detailedPlayer.currentBatting, detailedPlayer.potentialBatting],
                  ...(doesNotBowl
                    ? [] : [["BOWL", detailedPlayer.currentBowling, detailedPlayer.potentialBowling]]),
                ].map(([label, current, potential]) => (
                  <div key={label} className="flex min-w-0 flex-1 flex-col justify-between border-r border-border/50 px-3 py-2 last:border-r-0" aria-label={`${label} current ability ${current}, potential ability ${potential}`}>
                    <div className="flex items-start gap-1.5">
                      <span className="font-anton text-[48px] leading-none text-text-primary">{current}</span>
                      <span className="flex flex-col pt-1 font-space-mono text-text-secondary">
                        <span className="text-[7px] font-bold uppercase leading-none">PA</span>
                        <span className="font-anton text-lg leading-tight">{potential}</span>
                      </span>
                    </div>
                    <span className="font-anton text-[14px] uppercase tracking-wide text-text-secondary">{label}</span>
                  </div>
                ))}
              </div>
            )}
            {!isRetired && (
              <button
                type="button"
                onClick={handleToggleShortlist}
                className={`flex h-9 w-9 shrink-0 items-center justify-center self-start rounded border transition-all ${
                  isPlayerShortlisted
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25"
                    : "border-border bg-surface text-text-primary hover:border-accent hover:text-accent hover:bg-accent/5"
                }`}
                title={isPlayerShortlisted ? "Remove from auction shortlist" : "Add to auction shortlist"}
                aria-label={isPlayerShortlisted ? "Remove from auction shortlist" : "Add to auction shortlist"}
              >
                <Bookmark size={17} className={isPlayerShortlisted ? "fill-current" : ""} />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded border border-border bg-surface text-text-primary transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close player profile"
            >
              <X size={17} />
            </button>
          </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-surface p-3">
          <div className={`grid h-full min-h-0 grid-cols-[minmax(0,2.8fr)_minmax(300px,0.95fr)] grid-rows-[minmax(0,1fr)] gap-2.5 ${isRetired ? "min-w-[1300px]" : profileTab === "info" ? "min-w-[1050px]" : "min-w-[900px]"}`}>
            <div ref={infoViewportRef} className={`relative min-h-0 ${!isRetired && profileTab === "info" ? "overflow-hidden" : "overflow-y-auto overscroll-contain pr-1"}`}>
              {!isRetired && profileTab === "stats" && <span aria-hidden="true" className="pointer-events-none absolute right-1 top-0 z-[1] h-[34px] w-[112px] rounded-bl-lg border-b border-l border-border bg-surface" />}
              {!isRetired && <div className="absolute right-3 top-1 z-10 inline-flex rounded border border-border bg-surface/95 p-0.5 shadow-sm" role="tablist" aria-label="Player profile view">
                {(["info", "stats"] as const).map((tab) => (
                  <button key={tab} type="button" role="tab" aria-selected={profileTab === tab}
                    onClick={() => setProfileTab(tab)}
                    className={`rounded px-2 py-0.5 font-space-mono text-[8px] font-bold uppercase tracking-wide transition-colors ${profileTab === tab ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary"}`}>
                    {tab}
                  </button>
                ))}
              </div>}
              <div
                className={`grid gap-2 ${!isRetired && profileTab === "info" ? "grid-cols-[480px_minmax(244px,1fr)_212px] grid-rows-[300px_150px_minmax(0,1fr)]" : "content-start"}`}
                style={!isRetired && profileTab === "info" ? {
                  width: infoLayout.width,
                  height: infoLayout.height,
                  transform: `scale(${infoLayout.scale})`,
                  transformOrigin: "top left",
                } : undefined}
              >
            {/* Hidden Attributes tile: retained for a future return. */}
            {!isRetired && <section className="hidden order-3 rounded border border-border bg-bg p-2.5">
              <h4 className="mb-1.5 border-b border-border pb-1 font-space-mono text-[10px] font-bold uppercase text-text-primary">Hidden Attributes</h4>
              {/* Phase Breakdown */}
              {(detailedPlayer.powerplayBatting != null || detailedPlayer.powerplayBowling != null) && (
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <div className="rounded border border-border/70 bg-surface/60 p-1">
                    <div className="mb-1 text-center font-space-mono text-[7.5px] font-bold uppercase tracking-wider text-text-secondary">Batting Phases</div>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="rounded bg-bg p-1">
                        <div className="font-space-mono text-[7px] uppercase text-text-secondary">PP (1-6)</div>
                        <div className="font-anton text-[14px] text-text-primary">{detailedPlayer.powerplayBatting ?? "-"}</div>
                      </div>
                      <div className="rounded bg-bg p-1">
                        <div className="font-space-mono text-[7px] uppercase text-text-secondary">MID (7-15)</div>
                        <div className="font-anton text-[14px] text-text-primary">{detailedPlayer.middleOversBatting ?? "-"}</div>
                      </div>
                      <div className="rounded bg-bg p-1">
                        <div className="font-space-mono text-[7px] uppercase text-text-secondary">DTH (16-20)</div>
                        <div className="font-anton text-[14px] text-text-primary">{detailedPlayer.deathBatting ?? "-"}</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1">
                    <div className="mb-1 text-center font-space-mono text-[7.5px] font-bold uppercase tracking-wider text-text-secondary">Bowling Phases</div>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="rounded bg-bg p-1">
                        <div className="font-space-mono text-[7px] uppercase text-text-secondary">PP (1-6)</div>
                        <div className="font-anton text-[14px] text-text-primary">{detailedPlayer.powerplayBowling ?? "-"}</div>
                      </div>
                      <div className="rounded bg-bg p-1">
                        <div className="font-space-mono text-[7px] uppercase text-text-secondary">MID (7-15)</div>
                        <div className="font-anton text-[14px] text-text-primary">{detailedPlayer.middleOversBowling ?? "-"}</div>
                      </div>
                      <div className="rounded bg-bg p-1">
                        <div className="font-space-mono text-[7px] uppercase text-text-secondary">DTH (16-20)</div>
                        <div className="font-anton text-[14px] text-text-primary">{detailedPlayer.deathBowling ?? "-"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Match Traits */}
              {(detailedPlayer.stamina != null || detailedPlayer.consistency != null || detailedPlayer.bigMatchRating != null || detailedPlayer.pressureRating != null || detailedPlayer.battingAggression != null || detailedPlayer.aggression != null || detailedPlayer.fieldingRating != null || detailedPlayer.wicketkeepingRating != null || detailedPlayer.injuryProneness != null || detailedPlayer.paceRating != null || detailedPlayer.spinRating != null) && (
                <div className="mt-2 grid grid-cols-5 gap-1 lg:gap-1.5">
                  <div className="rounded border border-border/70 bg-surface/60 p-1 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[7px] font-bold uppercase text-text-secondary">Bat Cons</div>
                    <div className="mt-0.5 font-anton text-[14px] text-text-primary">{detailedPlayer.battingConsistency ?? detailedPlayer.stamina ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[7px] font-bold uppercase text-text-secondary">Bowl Cons</div>
                    <div className="mt-0.5 font-anton text-[14px] text-text-primary">{detailedPlayer.bowlingConsistency ?? detailedPlayer.consistency ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[7px] font-bold uppercase text-text-secondary">Aggression</div>
                    <div className="mt-0.5 font-anton text-[14px] text-text-primary">{detailedPlayer.battingAggression ?? detailedPlayer.aggression ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[7px] font-bold uppercase text-text-secondary">Big Match</div>
                    <div className="mt-0.5 font-anton text-[14px] text-text-primary">{detailedPlayer.bigMatchRating ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[7px] font-bold uppercase text-text-secondary">Pressure</div>
                    <div className="mt-0.5 font-anton text-[14px] text-text-primary">{detailedPlayer.pressureRating ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[7px] font-bold uppercase text-text-secondary">Fielding</div>
                    <div className="mt-0.5 font-anton text-[14px] text-text-primary">{detailedPlayer.fieldingRating ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[7px] font-bold uppercase text-text-secondary">Keeping</div>
                    <div className="mt-0.5 font-anton text-[14px] text-text-primary">{detailedPlayer.wicketkeepingRating ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[7px] font-bold uppercase text-text-secondary">Injury Risk</div>
                    <div className="mt-0.5 font-anton text-[14px] text-text-primary">{detailedPlayer.injuryProneness ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[7px] font-bold uppercase text-text-secondary">Vs Pace</div>
                    <div className="mt-0.5 font-anton text-[14px] text-text-primary">{detailedPlayer.paceRating ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[7px] font-bold uppercase text-text-secondary">Vs Spin</div>
                    <div className="mt-0.5 font-anton text-[14px] text-text-primary">{detailedPlayer.spinRating ?? "-"}</div>
                  </div>
                </div>
              )}
            </section>}

            {!isRetired && profileTab === "info" && (
              <section className="col-start-1 row-start-2 h-full min-w-0 self-start overflow-hidden rounded border border-border bg-bg p-1.5">
                <div className="flex items-center gap-3 border-b border-border px-1 pb-1">
                  <h4 className="font-space-mono text-[10px] font-bold uppercase text-text-primary">Form</h4>
                  <div className="flex items-center gap-2 font-space-mono text-[7px] font-bold uppercase">
                    {showBattingForm && <span className="flex items-center gap-1 text-accent"><i className="h-2 w-2 rounded-sm bg-accent" /> Batting</span>}
                    {showBowlingForm && <span className="flex items-center gap-1 text-sky-500"><i className="h-2 w-2 rounded-sm bg-sky-500" /> Bowling</span>}
                  </div>
                </div>
                {recentForm.length > 0 ? (
                  <div className="relative mt-1 grid grid-cols-5 gap-1">
                    {formDisplayMatches.map((match) => (
                      <div key={match.id} className="min-w-0 rounded border border-border/70 bg-surface/70 px-1 py-1 text-center">
                        <div className="flex min-h-5 items-center justify-center gap-1 whitespace-nowrap font-space-mono text-[8px] font-bold">
                          {showBattingForm && <span className="text-accent" title="Runs (balls)">{match.didNotBat ? "DNB" : match.runs != null ? <>{match.runs}{match.notOut && <sup className="relative -top-0.5 text-[7px]">*</sup>}({match.balls ?? 0})</> : "-"}</span>}
                          {showBowlingForm && <span className="text-sky-500" title="Wickets/runs conceded">{match.bowled ? `${match.wickets ?? 0}/${match.conceded ?? 0}` : "-"}</span>}
                        </div>
                        <div className="flex h-[62px] items-end justify-center gap-1 border-b border-border/70">
                          {showBattingForm && match.runs != null && match.runs >= 1 && (
                            <div className="w-4 shrink-0 rounded-t-sm bg-accent" style={{ height: `${Math.max(6, Math.round(match.runs / formRunScale * 54))}px` }} title={`${match.runs}${match.notOut ? "*" : ""} runs (${match.balls ?? 0} balls)`} />
                          )}
                          {showBowlingForm && match.bowled && (
                            <div className="w-4 shrink-0 rounded-t-sm bg-sky-500" style={{ height: `${Math.max(6, Math.round((match.wickets ?? 0) / formWicketScale * 54))}px` }} title={`${match.wickets ?? 0}/${match.conceded ?? 0} bowling`} />
                          )}
                        </div>
                        <div
                          className="flex min-h-5 items-center justify-center whitespace-nowrap text-center font-space-mono font-bold uppercase leading-tight text-text-secondary"
                          style={{ fontSize: `${Math.min(10, 150 / (`${match.matchNumber != null ? `M${match.matchNumber}` : "Match"} vs ${match.opponent}`).length)}px` }}
                        >
                          {match.matchNumber != null ? `M${match.matchNumber}` : "Match"} vs {match.opponent}
                        </div>
                      </div>
                    ))}
                    <svg className="pointer-events-none absolute inset-x-0 top-[25px] z-10 h-[62px] w-full overflow-visible" viewBox="0 0 500 62" preserveAspectRatio="none" aria-hidden="true">
                      {connectBattingForm && battingFormPoints.length > 0 && <g stroke="var(--accent)" fill="var(--accent)">
                        <polyline points={battingFormPoints.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" strokeWidth="1.8" strokeLinejoin="round" />
                        {battingFormPoints.map(({ x, y }, index) => <circle key={index} cx={x} cy={y} r="3" stroke="var(--surface)" strokeWidth="1" />)}
                      </g>}
                      {connectBowlingForm && bowlingFormPoints.length > 0 && <g stroke="#0ea5e9" fill="#0ea5e9">
                        <polyline points={bowlingFormPoints.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" strokeWidth="1.8" strokeLinejoin="round" />
                        {bowlingFormPoints.map(({ x, y }, index) => <circle key={index} cx={x} cy={y} r="3" stroke="var(--surface)" strokeWidth="1" />)}
                      </g>}
                    </svg>
                  </div>
                ) : (
                  <div className="px-2 py-3 text-center font-space-mono text-[9px] uppercase text-text-secondary">No appearances recorded this season</div>
                )}
              </section>
            )}

            {!isRetired && profileTab === "info" && (
              <div className="col-start-1 row-start-1 h-full min-h-0">
                <SeasonMatchesTile
                  player={detailedPlayer}
                  teamId={currentSeasonHistoryByPlayer.get(detailedPlayer.id)?.teamId ?? detailedPlayer.currentTeamId}
                  season={currentSeason}
                  fixtures={customFixtures}
                  teams={teams}
                />
              </div>
            )}

            {!isRetired && profileTab === "info" && (
              <div className="col-start-2 row-span-3 row-start-1 flex min-h-0 flex-col gap-2">
                <div className="h-[458px] shrink-0"><ScoutNotesTile player={detailedPlayer} /></div>
                <div className="ml-[88px] min-h-0 flex-1">
                  <PlayerCompetitionTile
                    player={detailedPlayer}
                    players={players}
                    teams={teams}
                    onSelectPlayer={(targetId) => {
                      if (onOpenPlayer) onOpenPlayer(targetId);
                      else setLinkedPlayerId(targetId);
                    }}
                  />
                </div>
              </div>
            )}

            {!isRetired && profileTab === "info" && (
              <div className="col-start-1 row-start-3 flex h-full items-start">
              <section className="flex h-full w-[260px] shrink-0 flex-col overflow-hidden rounded border border-border bg-bg p-2.5">
                <h4 className="mb-2 shrink-0 border-b border-border pb-1 font-space-mono text-[10px] font-bold uppercase text-text-primary">Personnel Relationships</h4>
                {relationshipsStatus === "loading" && <p className="font-space-mono text-[9px] text-text-secondary">Loading relationships...</p>}
                {relationshipsStatus === "error" && <p className="font-space-mono text-[9px] text-text-secondary">Relationships unavailable.</p>}
                {relationshipsStatus === "ready" && relationships.length === 0 && <p className="font-space-mono text-[9px] text-text-secondary">No personnel relationships recorded.</p>}
                {relationshipsStatus === "ready" && relationships.length > 0 && (
                  <div className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto pr-1" style={{ gridAutoRows: "calc((100% - 16px) / 5)" }}>
                    {relationships.map((relationship) => {
                      const targetPlayerId = relationship.partner_type === "player"
                        ? Object.values(players).find((player) => player.name === relationship.partner_name)?.id
                          ?? Object.values(retiredPlayerSnapshots).find((snapshot) => snapshot.name === relationship.partner_name)?.id
                        : null;
                      const canOpen = relationship.partner_type === "staff" || Boolean(targetPlayerId);
                      return (
                      <button
                        key={relationship.dynamic_id}
                        type="button"
                        disabled={!canOpen}
                        className="flex h-full min-h-0 w-full items-center gap-2 overflow-hidden rounded border border-border/70 bg-surface px-2 py-0.5 text-left leading-tight enabled:cursor-pointer enabled:hover:border-accent/60 enabled:hover:bg-accent/5 enabled:focus-visible:outline enabled:focus-visible:outline-2 enabled:focus-visible:outline-accent"
                        aria-label={`${relationship.partner_name}, ${relationship.dynamic_type_name}. ${relationship.subject_reason || "No reason recorded."}`}
                        onClick={() => {
                          setRelationshipTooltip(null);
                          if (relationship.partner_type === "staff") setLinkedStaffId(relationship.partner_id);
                          else if (targetPlayerId) {
                            if (onOpenPlayer) onOpenPlayer(targetPlayerId);
                            else setLinkedPlayerId(targetPlayerId);
                          }
                        }}
                        onFocus={(event) => showRelationshipTooltip(event.currentTarget, relationship.subject_reason || "No reason recorded.")}
                        onBlur={() => setRelationshipTooltip(null)}
                      >
                        <div
                          className="flex w-fit items-center gap-2"
                          onMouseEnter={(event) => showRelationshipTooltip(event.currentTarget, relationship.subject_reason || "No reason recorded.")}
                          onMouseLeave={() => setRelationshipTooltip(null)}
                        >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent/70 bg-accent/10 font-anton text-[10px] leading-none text-accent" aria-label={`Relationship strength ${relationship.rating}`}>
                          {relationship.rating}
                        </span>
                        <div className="flex flex-col leading-tight">
                          <span className="whitespace-nowrap font-space-mono text-[10px] font-bold text-text-primary">{relationship.partner_name}</span>
                          <span className="whitespace-nowrap font-space-mono text-[8px] uppercase text-accent">{relationship.dynamic_type_name}</span>
                        </div>
                        </div>
                      </button>
                    );})}
                  </div>
                )}
              </section>
              <div className="ml-2 flex h-full min-h-0 w-[300px] shrink-0 items-start">
                <AuctionValueTile player={detailedPlayer} players={players} teams={teams} auction={auction} />
              </div>
              </div>
            )}

            {!isRetired && profileTab === "info" && (
              <div className="col-start-3 row-span-3 row-start-1 flex min-h-0 flex-col gap-2" style={{ paddingTop: 34 / infoLayout.scale }}>
                <div className="grid min-h-0 flex-1 grid-rows-4 gap-2">
                  <section className="relative min-h-0 w-full overflow-hidden rounded border border-border bg-bg px-2 py-1.5">
                    <h4 className="border-b border-border pb-0.5 font-space-mono text-[9px] font-bold uppercase text-text-primary">International Career Status</h4>
                    <FittedStatus text={internationalCareerStatus ?? "Selection Untracked"} />
                  </section>
                  <section className="relative min-h-0 w-full overflow-hidden rounded border border-border bg-bg px-2 py-1.5">
                    <h4 className="border-b border-border pb-0.5 font-space-mono text-[9px] font-bold uppercase text-text-primary">Career Stage</h4>
                    <FittedStatus text={careerStage ?? "Stage Untracked"} />
                  </section>
                  <section className="relative min-h-0 w-full overflow-hidden rounded border border-border bg-bg px-2 py-1.5">
                    <h4 className="border-b border-border pb-0.5 font-space-mono text-[9px] font-bold uppercase text-text-primary">Hall of Fame {isHallOfFamer && <span className="ml-1 text-amber-500">· Inducted</span>}</h4>
                    <FittedStatus text={hallOfFameStanding(hallOfFameEvaluation?.score ?? 0)} />
                  </section>
                  <section className="relative min-h-0 w-full overflow-hidden rounded border border-border bg-bg px-2 py-1.5">
                    <h4 className="border-b border-border pb-0.5 font-space-mono text-[9px] font-bold uppercase text-text-primary">Club Legacy{clubLegacy && <span className="ml-1 text-text-secondary">· {teams[clubLegacy.teamId]?.shortName ?? clubLegacy.teamId}</span>}</h4>
                    <FittedStatus text={clubLegacy ? clubLegacyStanding(clubLegacy.points, clubLegacy.tier) : "No Club Yet"} />
                  </section>
                </div>
                {viewedPlayerId && <div className="mt-auto h-[330px] shrink-0"><RecentInjuriesTile playerId={viewedPlayerId} currentDate={currentDate} /></div>}
              </div>
            )}

            {(isRetired || profileTab === "stats") && (
              <>
            {/* Current Season Stats */}
            {!isRetired && seasonStats && (
              <section className="self-start rounded border border-border bg-bg p-2.5">
                <div className="mb-1.5 flex items-center border-b border-border pb-1">
                  <h4 className="font-space-mono text-[10px] font-bold uppercase text-text-primary">Current Season Stats ('{rosterSeason.slice(-2)})</h4>
                </div>

                <div className={`grid gap-1.5 ${seasonStats.bowlMatches > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {/* Batting Season Stats */}
                  <div className="space-y-1 rounded border border-border/80 bg-surface p-1.5">
                    <div className="font-anton text-[11px] uppercase text-accent border-b border-border/40 pb-1">Batting Figures</div>
                    <div className="grid grid-cols-7 gap-1.5 text-center">
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Matches</div>
                        <div className="font-anton text-[14px] text-text-primary mt-0.5">{seasonStats.matches}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Runs</div>
                        <div className="font-anton text-[14px] text-text-primary mt-0.5">{seasonStats.runs}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">SR</div>
                        <div className="font-anton text-[14px] text-text-primary mt-0.5">{seasonStats.batSR}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Average</div>
                        <div className="font-anton text-[14px] text-text-primary mt-0.5">{seasonStats.batAvg}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">4s</div>
                        <div className="font-anton text-[14px] text-text-primary mt-0.5">{seasonStats.fours}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">6s</div>
                        <div className="font-anton text-[14px] text-text-primary mt-0.5">{seasonStats.sixes}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary whitespace-nowrap">H. Score</div>
                        <div className="font-anton text-[14px] text-accent mt-0.5">{seasonStats.highScore}</div>
                      </div>
                    </div>
                  </div>

                  {/* Bowling Season Stats */}
                  {seasonStats.bowlMatches > 0 && <div className="space-y-1 rounded border border-border/80 bg-surface p-1.5">
                    <div className="font-anton text-[11px] uppercase text-accent border-b border-border/40 pb-1">Bowling Figures</div>
                    <div className="grid grid-cols-6 gap-1.5 text-center">
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Matches</div>
                        <div className="font-anton text-[14px] text-text-primary mt-0.5">{seasonStats.bowlMatches}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Wickets</div>
                        <div className="font-anton text-[14px] text-text-primary mt-0.5">{seasonStats.bowlWickets}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Bowl Avg</div>
                        <div className="font-anton text-[14px] text-text-primary mt-0.5">{seasonStats.bowlAvg}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Bowl SR</div>
                        <div className="font-anton text-[14px] text-text-primary mt-0.5">{seasonStats.bowlSR}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">3fers</div>
                        <div className="font-anton text-[14px] text-text-primary mt-0.5">{seasonStats.threeFers}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary whitespace-nowrap">B. Figs</div>
                        <div className="font-anton text-[14px] text-accent mt-0.5">{seasonStats.bestFiguresStr}</div>
                      </div>
                    </div>
                  </div>}
                </div>
              </section>
            )}

            {/* All-Time IPL Stats */}
            <section className={`self-start rounded border border-border bg-bg p-2.5 ${isRetired ? "order-3" : ""}`}>
              <h4 className="mb-1.5 border-b border-border pb-1 font-space-mono text-[10px] font-bold uppercase text-text-primary">IPL All-Time Stats</h4>
              <div className="space-y-1.5">
                <div>
                  <div className="mb-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-accent">Batting</div>
                  <div className="grid grid-cols-[0.8fr_0.7fr_0.75fr_0.85fr_0.85fr_1fr_1fr_0.6fr_0.65fr_0.7fr_0.7fr_0.9fr] gap-1 lg:gap-1.5">
                    {[
                      ["Matches", detailedPlayer.iplStats?.matches ?? 0],
                      ["Innings", detailedPlayer.iplStats?.innings ?? 0],
                      ["Not Outs", detailedPlayer.iplStats?.notOuts ?? 0],
                      ["Runs", detailedPlayer.iplStats?.runs ?? 0],
                      ["Balls", detailedPlayer.iplStats?.ballsFaced ?? detailedPlayer.iplStats?.battingBalls ?? 0],
                      ["Average", (detailedPlayer.iplStats?.battingAverage ?? 0) > 0 ? formatStatValue(Number(detailedPlayer.iplStats?.battingAverage)) : "-"],
                      ["Bat SR", (detailedPlayer.iplStats?.strikeRate ?? 0) > 0 ? formatStatValue(Number(detailedPlayer.iplStats?.strikeRate)) : "-"],
                      ["50s", detailedPlayer.iplStats?.fifties ?? 0],
                      ["100s", detailedPlayer.iplStats?.hundreds ?? 0],
                      ["Fours", detailedPlayer.iplStats?.fours ?? 0],
                      ["Sixes", detailedPlayer.iplStats?.sixes ?? 0],
                      ["H. Score", detailedPlayer.iplStats?.highScore || "-"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex min-w-0 flex-col rounded border border-border bg-surface px-1 py-1 text-center">
                        <div className="flex h-5 items-center justify-center whitespace-nowrap font-space-mono text-[7px] font-bold uppercase leading-none text-text-secondary">{label}</div>
                        <div className="mt-0.5 font-anton text-[14px] leading-tight text-text-primary">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {hasIplBowling && <div>
                  <div className="mb-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-accent">Bowling</div>
                  <div className="grid grid-cols-[0.72fr_0.7fr_1.15fr_0.82fr_0.9fr_0.9fr_1fr_0.8fr_0.8fr] gap-1 lg:gap-1.5">
                    {[
                      ["Innings", detailedPlayer.iplStats?.bowlingInnings ?? 0],
                      ["Overs", (() => {
                        const balls = detailedPlayer.iplStats?.bowlingBalls ?? 0;
                        if (balls === 0) return "-";
                        return `${Math.floor(balls / 6)}.${balls % 6}`;
                      })()],
                      ["Runs Conceded", (() => {
                        const balls = detailedPlayer.iplStats?.bowlingBalls ?? 0;
                        const runs = detailedPlayer.iplStats?.runsConceded ?? detailedPlayer.iplStats?.bowlingRunsConceded ?? 0;
                        return balls > 0 ? runs : "-";
                      })()],
                      ["Wickets", detailedPlayer.iplStats?.wickets ?? 0],
                      ["Average", (() => {
                        const wkts = detailedPlayer.iplStats?.wickets ?? 0;
                        const runs = detailedPlayer.iplStats?.runsConceded ?? detailedPlayer.iplStats?.bowlingRunsConceded ?? 0;
                        const avg = Number(detailedPlayer.iplStats?.bowlingAverage ?? 0);
                        if (wkts > 0) {
                          return formatStatValue(avg > 0 ? avg : runs / wkts);
                        }
                        return "-";
                      })()],
                      ["Economy", (() => {
                        const balls = detailedPlayer.iplStats?.bowlingBalls ?? 0;
                        const runs = detailedPlayer.iplStats?.runsConceded ?? detailedPlayer.iplStats?.bowlingRunsConceded ?? 0;
                        if (balls > 0) {
                          const eco = (detailedPlayer.iplStats?.economy ?? 0) > 0
                            ? Number(detailedPlayer.iplStats?.economy)
                            : (runs / (balls / 6));
                          return formatStatValue(eco);
                        }
                        return "-";
                      })()],
                      ["Best Figures", detailedPlayer.iplStats?.bestBowlingFigures && detailedPlayer.iplStats.bestBowlingFigures !== "0/0" ? detailedPlayer.iplStats.bestBowlingFigures : "-"],
                      ["4W Hauls", detailedPlayer.iplStats?.fourWickets ?? 0],
                      ["5W Hauls", detailedPlayer.iplStats?.fiveWickets ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="flex min-w-0 flex-col rounded border border-border bg-surface px-1 py-1 text-center">
                        <div className="flex h-5 items-center justify-center whitespace-nowrap font-space-mono text-[7px] font-bold uppercase leading-none text-text-secondary">{label}</div>
                        <div className="mt-0.5 font-anton text-[14px] leading-tight text-text-primary">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>}

                <div>
                  <div className="mb-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-accent">Fielding</div>
                  <div className={`grid gap-2 ${showIplStumpings ? "grid-cols-3" : "grid-cols-2"}`}>
                    {[
                      ["Catches", detailedPlayer.iplStats?.catches ?? 0],
                      ...(showIplStumpings ? [["Stumpings", detailedPlayer.iplStats?.stumpings ?? 0]] : []),
                      ["Run Outs", detailedPlayer.iplStats?.runOuts ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded border border-border bg-surface px-1 py-1 text-center">
                        <div className="font-space-mono text-[7px] font-bold uppercase leading-none text-text-secondary">{label}</div>
                        <div className="mt-0.5 font-anton text-[14px] leading-tight text-text-primary">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Career T20 Stats */}
            <section className={`self-start rounded border border-border bg-bg p-2.5 ${isRetired ? "order-1" : ""}`}>
              <h4 className="mb-1.5 border-b border-border pb-1 font-space-mono text-[10px] font-bold uppercase text-text-primary">Career T20 Stats</h4>
              <div className={`grid gap-1.5 ${hasCareerT20Bowling ? "grid-cols-8" : "grid-cols-5"}`}>
                {[
                  ["Matches", careerT20Matches],
                  ["Bat Inns", careerT20Innings],
                  ["Runs", careerT20Runs],
                  ["Bat Avg", careerT20Average > 0 ? formatStatValue(careerT20Average) : "-"],
                  ["SR", careerT20StrikeRate > 0 ? formatStatValue(careerT20StrikeRate) : "-"],
                  ...(hasCareerT20Bowling ? [
                    ["Bowl Inns", careerT20BowlingMatches],
                    ["Wickets", careerT20Wickets],
                    ["Bowl Avg", careerT20BowlingAverage > 0 ? formatStatValue(careerT20BowlingAverage) : "-"],
                  ] : []),
                ].map(([label, value]) => (
                  <div key={label} className="rounded border border-border bg-surface px-1 py-1 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[7px] font-bold uppercase leading-none text-text-secondary">{label}</div>
                    <div className="mt-0.5 font-anton text-[14px] leading-tight text-text-primary">{value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className={`self-start rounded border border-border bg-bg p-2.5 ${isRetired ? "order-2" : ""}`}>
              <h4 className="mb-1.5 border-b border-border pb-1 font-space-mono text-[10px] font-bold uppercase text-text-primary">International T20</h4>
              <div className={`grid gap-1.5 ${hasInternationalBowling ? "grid-cols-8" : "grid-cols-5"}`}>
                {[
                  ["Matches", effectiveInternationalStats?.matches ?? 0], ["Innings", effectiveInternationalStats?.innings ?? 0],
                  ["Runs", effectiveInternationalStats?.runs ?? 0], ["Highest", effectiveInternationalStats?.highestScore ?? 0],
                  ["Strike rate", effectiveInternationalStats?.balls ? formatStatValue(effectiveInternationalStats.runs * 100 / effectiveInternationalStats.balls) : "-"],
                  ...(hasInternationalBowling ? [
                    ["Wickets", effectiveInternationalStats?.wickets ?? 0],
                    ["Economy", effectiveInternationalStats?.bowlingBalls ? formatStatValue(effectiveInternationalStats.runsConceded * 6 / effectiveInternationalStats.bowlingBalls) : "-"],
                    ["Best", effectiveInternationalStats?.bowlingInnings && effectiveInternationalStats.bestBowlingWickets > 0 ? `${effectiveInternationalStats.bestBowlingWickets}/${effectiveInternationalStats.bestBowlingRuns}` : "-"],
                  ] : []),
                ].map(([label, value]) => <div key={label} className="rounded border border-border bg-surface px-1 py-1 text-center"><div className="font-space-mono text-[7px] uppercase text-text-secondary">{label}</div><div className="font-anton text-[14px] text-text-primary">{value}</div></div>)}
              </div>
            </section>

              </>
            )}
              </div>
            </div>
            {/* Team History */}
            <section className="h-full min-h-0 overflow-y-auto overscroll-contain rounded border border-border bg-bg p-3">
              <h4 className="mb-2 border-b border-border pb-1.5 font-space-mono text-[10px] font-bold uppercase text-text-primary">Team History</h4>
              <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto_auto] gap-2 border-b border-border pb-1.5 font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                <span>Season</span>
                <span>Team</span>
                <span className="text-right">Price</span>
                <span className="text-right">Method</span>
              </div>
              <div className="min-h-0">
                {[...detailedPlayerHistory]
                  .filter((entry) => entry.teamId && entry.teamId !== "UNSOLD")
                  .sort((a, b) => Number(b.season) - Number(a.season))
                  .map((entry) => {
                    const iplStats = teamHistoryIplStats.get(entry.season);
                    const trade = tradeRecords.find((record) => record.season === Number(entry.season) && [...record.outgoingPlayerIds, ...record.incomingPlayerIds].includes(detailedPlayer.id));
                    const movedFromId = trade?.outgoingPlayerIds.includes(detailedPlayer.id) ? trade.fromTeamId : trade?.toTeamId;
                    const movedToId = trade?.outgoingPlayerIds.includes(detailedPlayer.id) ? trade.toTeamId : trade?.fromTeamId;
                    const exchangeIds = trade?.outgoingPlayerIds.includes(detailedPlayer.id) ? trade.incomingPlayerIds : trade?.outgoingPlayerIds;
                    return (
                    <React.Fragment key={`${entry.season}-${entry.teamId}`}>
                    {trade && <div className="my-1 border-y border-accent/40 bg-accent/10 px-2 py-1 font-space-mono text-[7px] font-bold uppercase leading-tight text-text-primary">{detailedPlayer.name} was traded from {teams[movedFromId ?? ""]?.shortName ?? movedFromId} to {teams[movedToId ?? ""]?.shortName ?? movedToId} in exchange for {(exchangeIds ?? []).map((id) => players[id]?.name ?? id).join(" + ")}</div>}
                    <div
                      className="grid min-h-7 grid-cols-[3rem_minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border/60 py-0.5 text-[9px]"
                    >
                      <span className="font-space-mono text-text-secondary">{entry.season}</span>
                      <span className="min-w-0 font-semibold text-text-primary">
                        <span className="block truncate">{teams[entry.teamId]?.name ?? entry.teamId}</span>
                        {iplStats && (
                          <span className="mt-0.5 block whitespace-nowrap font-space-mono text-[7px] font-bold text-accent">
                            {iplStats.matches} Mts&nbsp;&nbsp;&nbsp;{iplStats.runs} Rs&nbsp;&nbsp;&nbsp;{iplStats.wickets} Ws
                          </span>
                        )}
                      </span>
                      <span className="text-right font-space-mono text-text-primary">{entry.price > 0 ? formatPrice(entry.price) : "—"}</span>
                      <span className="text-right font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                        {entry.isInjuryReplacement ? "Injury replacement" : entry.isRtm ? "RTM" : "Signed"}
                      </span>
                    </div>
                    </React.Fragment>
                    );
                  })}
                {detailedPlayerHistory.every((entry) => !entry.teamId || entry.teamId === "UNSOLD") && (
                  <p className="py-5 text-center text-xs text-text-secondary">No team history recorded.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
      {relationshipTooltip && createPortal(
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[200] max-w-[320px] rounded border border-accent/50 bg-surface px-3 py-2 font-space-mono text-[10px] leading-snug text-text-primary shadow-xl"
          style={{ left: relationshipTooltip.left, top: relationshipTooltip.top, transform: relationshipTooltip.below ? undefined : "translateY(-100%)" }}
        >
          {relationshipTooltip.text}
        </div>,
        document.body
      )}
    </div>
  );
}
