"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Bookmark, X } from "lucide-react";
import { useGameStore } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";
import { formatStatValue } from "@/lib/logic/statFormatting";
import { formatTopSevenBattingPositions } from "@/lib/logic/playerBattingPositions";
import { classifyBowlingUsage } from "@/lib/logic/playerBowlingUsage";
import {
  getPlayerSeasonHistory,
  mergePlayerIplHistory,
  protectCompletedSeasonTeamsFromTrades,
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
  try {
    if (!dateStr || typeof dateStr !== "string" || !dateStr.trim()) return "Not available";
    const date = new Date(`${dateStr.trim()}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return typeof dateStr === "string" ? dateStr : "Not available";
  }
}

export interface ProfileModalMatch {
  id: string;
  played: boolean;
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

interface PlayerProfileModalProps {
  playerId: string | null;
  onClose: () => void;
  customFixtures?: ProfileModalMatch[];
  currentSeasonStats?: {
    matches: number;
    runs: number;
    balls?: number;
    wickets: number;
    runsConceded?: number;
    oversBowled?: number;
    battingInnings?: number;
    dismissals?: number;
    highestScore?: number;
    bestBowling?: string;
    fours?: number;
    sixes?: number;
    dotBalls?: number;
    catches?: number;
    stumpings?: number;
    runOuts?: number;
    maidens?: number;
    powerplayWickets?: number;
  };
  additionalCareerT20Stats?: { matches: number; runs: number; wickets: number; balls?: number; dismissals?: number; bowlingInnings?: number; runsConceded?: number };
  internationalStats?: { matches: number; innings: number; runs: number; balls: number; notOuts: number; highestScore: number; bowlingInnings: number; bowlingBalls: number; runsConceded: number; wickets: number; bestBowlingWickets: number; bestBowlingRuns: number };
  isShortlisted?: boolean;
  onToggleShortlist?: (playerId: string) => void;
}

export function PlayerProfileModal({
  playerId,
  onClose,
  customFixtures,
  currentSeasonStats,
  additionalCareerT20Stats,
  internationalStats,
  isShortlisted: propsIsShortlisted,
  onToggleShortlist,
}: PlayerProfileModalProps) {
  const players = useGameStore((state) => state.players);
  const teams = useGameStore((state) => state.teams);
  const currentSeason = useGameStore((state) => state.currentSeason);
  const auction = useGameStore((state) => state.auction);
  const retiredPlayerSnapshots = useGameStore((state) => state.retiredPlayerSnapshots);
  const tradeRecords = useGameStore((state) => state.tradeRecords);
  const internalShortlist = useGameStore((state) => state.playerShortlist);
  const setInternalShortlist = useGameStore((state) => state.setPlayerShortlist);
  const viewportRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const [profileScale, setProfileScale] = useState(1);

  const activePlayer = playerId ? players[playerId] ?? null : null;
  const retiredSnapshot = playerId && !activePlayer
    ? retiredPlayerSnapshots[playerId] ?? null
    : null;
  const careerT20Matches = (activePlayer?.careerStats?.batting.matches ?? 0) + (additionalCareerT20Stats?.matches ?? 0);
  const careerT20Innings = (activePlayer?.careerStats?.batting.innings ?? 0) + (additionalCareerT20Stats?.matches ?? 0);
  const careerT20Runs = (activePlayer?.careerStats?.batting.runs ?? 0) + (additionalCareerT20Stats?.runs ?? 0);
  const careerT20BowlingMatches = (activePlayer?.careerStats?.bowling.matches ?? 0) + (additionalCareerT20Stats?.bowlingInnings ?? 0);
  const careerT20Wickets = (activePlayer?.careerStats?.bowling.wickets ?? 0) + (additionalCareerT20Stats?.wickets ?? 0);
  const baseBattingDismissals = activePlayer?.careerStats?.batting.dismissals
    ?? ((activePlayer?.careerStats?.batting.average ?? 0) > 0 ? (activePlayer?.careerStats?.batting.runs ?? 0) / activePlayer!.careerStats.batting.average : 0);
  const baseBattingBalls = activePlayer?.careerStats?.batting.balls
    ?? ((activePlayer?.careerStats?.batting.strikeRate ?? 0) > 0 ? (activePlayer?.careerStats?.batting.runs ?? 0) * 100 / activePlayer!.careerStats.batting.strikeRate : 0);
  const careerT20Average = careerT20Runs > 0 && baseBattingDismissals + (additionalCareerT20Stats?.dismissals ?? 0) > 0
    ? careerT20Runs / (baseBattingDismissals + (additionalCareerT20Stats?.dismissals ?? 0)) : 0;
  const careerT20StrikeRate = careerT20Runs > 0 && baseBattingBalls + (additionalCareerT20Stats?.balls ?? 0) > 0
    ? careerT20Runs * 100 / (baseBattingBalls + (additionalCareerT20Stats?.balls ?? 0)) : 0;
  const baseBowlingRuns = activePlayer?.careerStats?.bowling.runsConceded
    ?? (activePlayer?.careerStats?.bowling.wickets ?? 0) * (activePlayer?.careerStats?.bowling.average ?? 0);
  const careerT20BowlingAverage = careerT20Wickets > 0 ? (baseBowlingRuns + (additionalCareerT20Stats?.runsConceded ?? 0)) / careerT20Wickets : 0;
  const detailedPlayer: Player | null = playerId
    ? activePlayer ?? (retiredSnapshot ? retiredSnapshotPlayer(retiredSnapshot) : null)
    : null;

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

  useLayoutEffect(() => {
    if (!detailedPlayer) return;

    let animationFrame = 0;
    const fitProfile = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const viewport = viewportRef.current;
        const profile = profileRef.current;
        if (!viewport || !profile) return;

        const availableWidth = Math.max(1, viewport.clientWidth - 16);
        const availableHeight = Math.max(1, viewport.clientHeight - 16);
        const nextScale = Math.min(
          1,
          availableWidth / Math.max(1, profile.scrollWidth),
          availableHeight / Math.max(1, profile.scrollHeight),
        );
        setProfileScale((current) => Math.abs(current - nextScale) < 0.001 ? current : nextScale);
      });
    };

    fitProfile();
    const resizeObserver = new ResizeObserver(fitProfile);
    if (viewportRef.current) resizeObserver.observe(viewportRef.current);
    if (profileRef.current) resizeObserver.observe(profileRef.current);
    window.addEventListener("resize", fitProfile);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", fitProfile);
      resizeObserver.disconnect();
    };
  }, [detailedPlayer]);

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
      if (!fixture.played || !fixture.scorecard) return;

      [fixture.scorecard.inningsA, fixture.scorecard.inningsB].forEach((innings) => {
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
  }, [customFixtures, detailedPlayer]);

  const detailedPlayerHistory = useMemo(() => {
    if (!detailedPlayer) return [];
    const mergedHistory = mergePlayerIplHistory([], detailedPlayer.iplHistory);
    const currentEntry = currentSeasonHistoryByPlayer.get(detailedPlayer.id);
    let history = currentEntry ? upsertPlayerContractHistory(mergedHistory, currentEntry) : mergedHistory;

    // Attach live current season stats if available from current season fixtures
    const savedSeasonStats = currentSeasonStats && currentSeasonStats.matches > 0
      ? currentSeasonStats
      : null;
    if (savedSeasonStats || (seasonStats && seasonStats.matches > 0)) {
      const currentSeasonStr = String(currentSeason);
      const resolvedSeasonStats = savedSeasonStats
        ? {
            matches: savedSeasonStats.matches,
            runs: savedSeasonStats.runs,
            balls: savedSeasonStats.balls ?? 0,
            wickets: savedSeasonStats.wickets,
            runsConceded: savedSeasonStats.runsConceded ?? 0,
            oversBowled: savedSeasonStats.oversBowled ?? 0,
            battingInnings: savedSeasonStats.battingInnings,
            dismissals: savedSeasonStats.dismissals,
            highestScore: savedSeasonStats.highestScore,
            bestBowling: savedSeasonStats.bestBowling,
            fours: savedSeasonStats.fours,
            sixes: savedSeasonStats.sixes,
            dotBalls: savedSeasonStats.dotBalls,
            catches: savedSeasonStats.catches,
            stumpings: savedSeasonStats.stumpings,
            runOuts: savedSeasonStats.runOuts,
            maidens: savedSeasonStats.maidens,
            powerplayWickets: savedSeasonStats.powerplayWickets,
          }
        : {
            matches: seasonStats!.matches,
            runs: seasonStats!.runs,
            balls: 0,
            wickets: seasonStats!.bowlWickets,
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
  }, [currentSeasonHistoryByPlayer, currentSeason, currentSeasonStats, detailedPlayer, seasonStats, tradeRecords]);

  if (!detailedPlayer) return null;

  const currentTeam = teams[detailedPlayer.currentTeamId ?? ""];
  const isRetired = Boolean(retiredSnapshot);
  const nationalityLabel = detailedPlayer.nationality === "Overseas"
    && detailedPlayer.country
    && detailedPlayer.country !== "Overseas"
    ? detailedPlayer.country
    : detailedPlayer.nationality;

  return (
    <div
      ref={viewportRef}
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-black/70 p-2 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={onClose}
    >
      <div
        ref={profileRef}
        className="flex w-[calc(100%-1rem)] max-w-[1560px] shrink-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-surface text-text-primary shadow-2xl animate-in zoom-in-95 duration-200"
        style={{ transform: `scale(${profileScale})`, transformOrigin: "center" }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b-2 border-border bg-surface px-4 py-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-space-mono text-[9px] font-bold uppercase tracking-widest text-text-secondary">Player Profile</span>
              {detailedPlayer.nationality === "Overseas" && (
                <span
                  className="rounded-[2px] px-1.5 py-0.5 font-space-mono text-[8px] font-bold text-white"
                  style={{ backgroundColor: currentTeam?.primaryColor ?? "var(--accent)" }}
                >
                  OS
                </span>
              )}
              {detailedPlayer.isT20IRetired && (
                <span
                  className="rounded-[2px] border border-slate-400/40 bg-slate-500/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold uppercase text-text-secondary"
                  title="Retired from T20 international cricket; still eligible for franchise cricket"
                >
                  T20I Retired
                </span>
              )}
            </div>
            <h3 className={`${isRetired ? "whitespace-normal" : "truncate"} font-anton text-[25px] uppercase leading-none text-text-primary`}>{detailedPlayer.name}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <p className="font-space-mono text-[9px] uppercase text-text-secondary">
                {detailedPlayer.role} · Age {detailedPlayer.age} · {currentTeam?.name
                  ?? (retiredSnapshot ? `Retired ${retiredSnapshot.retirementSeason}` : "No current club")}
              </p>
              {(() => {
                const titles = detailedPlayer.iplTitleSeasons?.length ?? 0;
                const runnersUp = detailedPlayer.iplRunnerUpSeasons?.length ?? 0;
                const orangeCaps = detailedPlayer.iplOrangeCapSeasons?.length ?? 0;
                const purpleCaps = detailedPlayer.iplPurpleCapSeasons?.length ?? 0;
                const mvps = detailedPlayer.iplMvpSeasons?.length ?? 0;
                const emerging = detailedPlayer.iplEmergingPlayerSeasons?.length ?? 0;

                if (!titles && !runnersUp && !orangeCaps && !purpleCaps && !mvps && !emerging) return null;

                return (
                  <div className="flex flex-wrap items-center gap-1">
                    {titles > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold uppercase text-amber-600 dark:text-amber-400 border border-amber-500/30" title={`IPL Champion: ${detailedPlayer.iplTitleSeasons?.join(", ")}`}>
                        🏆 {titles}× Champion
                      </span>
                    )}
                    {orangeCaps > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-orange-500/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold uppercase text-orange-600 dark:text-orange-400 border border-orange-500/30" title={`Orange Cap: ${detailedPlayer.iplOrangeCapSeasons?.join(", ")}`}>
                        🧢 {orangeCaps}× Orange Cap
                      </span>
                    )}
                    {purpleCaps > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-purple-500/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold uppercase text-purple-600 dark:text-purple-400 border border-purple-500/30" title={`Purple Cap: ${detailedPlayer.iplPurpleCapSeasons?.join(", ")}`}>
                        🟣 {purpleCaps}× Purple Cap
                      </span>
                    )}
                    {mvps > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold uppercase text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" title={`Tournament MVP: ${detailedPlayer.iplMvpSeasons?.join(", ")}`}>
                        ⭐ {mvps}× MVP
                      </span>
                    )}
                    {emerging > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold uppercase text-sky-600 dark:text-sky-400 border border-sky-500/30" title={`Emerging Player: ${detailedPlayer.iplEmergingPlayerSeasons?.join(", ")}`}>
                        🌟 Emerging Player ({detailedPlayer.iplEmergingPlayerSeasons?.join(", ")})
                      </span>
                    )}
                    {runnersUp > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-500/15 px-1.5 py-0.5 font-space-mono text-[8px] font-bold uppercase text-zinc-600 dark:text-zinc-400 border border-zinc-500/30" title={`IPL Finalist / Runner-up: ${detailedPlayer.iplRunnerUpSeasons?.join(", ")}`}>
                        🥈 {runnersUp}× Finalist
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-2">
            {!isRetired && (
              <button
                type="button"
                onClick={handleToggleShortlist}
                className={`flex h-9 items-center gap-1.5 rounded border px-3 font-space-mono text-[9px] font-bold uppercase tracking-wider transition-all ${
                  isPlayerShortlisted
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25"
                    : "border-border bg-surface text-text-primary hover:border-accent hover:text-accent hover:bg-accent/5"
                }`}
                title={isPlayerShortlisted ? "Remove from auction shortlist" : "Add to auction shortlist"}
              >
                <Bookmark size={13} className={isPlayerShortlisted ? "fill-current" : ""} />
                <span>{isPlayerShortlisted ? "Shortlisted" : "Add to Shortlist"}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-surface text-text-primary transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close player profile"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="bg-surface p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)_minmax(300px,0.95fr)] gap-2.5">
            {/* Player Details */}
            <section className={`col-start-1 row-start-1 rounded border border-border bg-bg p-3 ${isRetired ? "col-span-2" : ""}`}>
              <h4 className="mb-2 border-b border-border pb-1.5 font-anton text-[12px] uppercase text-text-primary">Player Details</h4>
              <div className={`${isRetired ? "grid grid-cols-4 sm:grid-cols-7 gap-2" : "space-y-1.5"} font-space-mono text-[9px]`}>
                {[
                  ["Nationality", nationalityLabel],
                  ["Date of Birth", formatDateOfBirth(detailedPlayer.dateOfBirth)],
                  ["State", detailedPlayer.state?.trim() || "Not available"],
                  ["Status", detailedPlayer.isCapped ? "Capped" : "Uncapped"],
                  ["International Debut Date", formatDateOfBirth(detailedPlayer.internationalDebutDate)],
                  ["Batting", detailedPlayer.battingStyle],
                  ["Bats at", formatTopSevenBattingPositions(detailedPlayer)],
                  ["Bowling", (() => {
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
                  })()],
                ].map(([label, value]) => (
                  <div key={label} className={`flex gap-2 border-b border-border/60 pb-1 ${isRetired ? "min-w-0 flex-col items-start justify-start" : "items-center justify-between"}`}>
                    <span className="shrink-0 whitespace-nowrap uppercase text-text-secondary">{label}</span>
                    <span className={`${isRetired ? "whitespace-normal text-left" : "whitespace-nowrap text-right"} font-bold text-text-primary`}>{value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Ability */}
            {!isRetired && <section className="col-start-2 row-start-1 rounded border border-border bg-bg p-3">
              <h4 className="mb-2 border-b border-border pb-1.5 font-anton text-[12px] uppercase text-text-primary">Ability & Phase Ratings</h4>
              <div className="grid grid-cols-4 gap-2">
                {[
                  ["Batting CA", detailedPlayer.currentBatting],
                  ["Batting PA", detailedPlayer.potentialBatting],
                  ["Bowling CA", detailedPlayer.currentBowling],
                  ["Bowling PA", detailedPlayer.potentialBowling],
                ].map(([label, value]) => (
                  <div key={label} className="rounded border border-border bg-surface p-2 text-center">
                    <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">{label}</div>
                    <div className="mt-0.5 font-anton text-[21px] text-text-primary">{value}</div>
                  </div>
                ))}
              </div>

              {/* Phase Breakdown */}
              {(detailedPlayer.powerplayBatting != null || detailedPlayer.powerplayBowling != null) && (
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <div className="rounded border border-border/70 bg-surface/60 p-2">
                    <div className="mb-1 text-center font-space-mono text-[7.5px] font-bold uppercase tracking-wider text-text-secondary">Batting Phases</div>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="rounded bg-bg p-1">
                        <div className="font-space-mono text-[6.5px] uppercase text-text-secondary">PP (1-6)</div>
                        <div className="font-anton text-[14px] text-text-primary">{detailedPlayer.powerplayBatting ?? "-"}</div>
                      </div>
                      <div className="rounded bg-bg p-1">
                        <div className="font-space-mono text-[6.5px] uppercase text-text-secondary">MID (7-15)</div>
                        <div className="font-anton text-[14px] text-text-primary">{detailedPlayer.middleOversBatting ?? "-"}</div>
                      </div>
                      <div className="rounded bg-bg p-1">
                        <div className="font-space-mono text-[6.5px] uppercase text-text-secondary">DTH (16-20)</div>
                        <div className="font-anton text-[14px] text-text-primary">{detailedPlayer.deathBatting ?? "-"}</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-2">
                    <div className="mb-1 text-center font-space-mono text-[7.5px] font-bold uppercase tracking-wider text-text-secondary">Bowling Phases</div>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="rounded bg-bg p-1">
                        <div className="font-space-mono text-[6.5px] uppercase text-text-secondary">PP (1-6)</div>
                        <div className="font-anton text-[14px] text-text-primary">{detailedPlayer.powerplayBowling ?? "-"}</div>
                      </div>
                      <div className="rounded bg-bg p-1">
                        <div className="font-space-mono text-[6.5px] uppercase text-text-secondary">MID (7-15)</div>
                        <div className="font-anton text-[14px] text-text-primary">{detailedPlayer.middleOversBowling ?? "-"}</div>
                      </div>
                      <div className="rounded bg-bg p-1">
                        <div className="font-space-mono text-[6.5px] uppercase text-text-secondary">DTH (16-20)</div>
                        <div className="font-anton text-[14px] text-text-primary">{detailedPlayer.deathBowling ?? "-"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Match Traits */}
              {(detailedPlayer.stamina != null || detailedPlayer.consistency != null || detailedPlayer.bigMatchRating != null || detailedPlayer.pressureRating != null || detailedPlayer.battingAggression != null || detailedPlayer.aggression != null || detailedPlayer.fieldingRating != null || detailedPlayer.wicketkeepingRating != null || detailedPlayer.injuryProneness != null || detailedPlayer.paceRating != null || detailedPlayer.spinRating != null) && (
                <div className="mt-2.5 grid grid-cols-5 gap-1.5 lg:gap-2">
                  <div className="rounded border border-border/70 bg-surface/60 p-1.5 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[6px] font-bold uppercase text-text-secondary lg:text-[6.5px]">Bat Cons</div>
                    <div className="mt-0.5 font-anton text-[15px] text-text-primary">{detailedPlayer.battingConsistency ?? detailedPlayer.stamina ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1.5 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[6px] font-bold uppercase text-text-secondary lg:text-[6.5px]">Bowl Cons</div>
                    <div className="mt-0.5 font-anton text-[15px] text-text-primary">{detailedPlayer.bowlingConsistency ?? detailedPlayer.consistency ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1.5 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[6px] font-bold uppercase text-text-secondary lg:text-[6.5px]">Aggression</div>
                    <div className="mt-0.5 font-anton text-[15px] text-text-primary">{detailedPlayer.battingAggression ?? detailedPlayer.aggression ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1.5 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[6px] font-bold uppercase text-text-secondary lg:text-[6.5px]">Big Match</div>
                    <div className="mt-0.5 font-anton text-[15px] text-text-primary">{detailedPlayer.bigMatchRating ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1.5 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[6px] font-bold uppercase text-text-secondary lg:text-[6.5px]">Pressure</div>
                    <div className="mt-0.5 font-anton text-[15px] text-text-primary">{detailedPlayer.pressureRating ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1.5 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[6px] font-bold uppercase text-text-secondary lg:text-[6.5px]">Fielding</div>
                    <div className="mt-0.5 font-anton text-[15px] text-text-primary">{detailedPlayer.fieldingRating ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1.5 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[6px] font-bold uppercase text-text-secondary lg:text-[6.5px]">Keeping</div>
                    <div className="mt-0.5 font-anton text-[15px] text-text-primary">{detailedPlayer.wicketkeepingRating ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1.5 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[6px] font-bold uppercase text-text-secondary lg:text-[6.5px]">Injury Risk</div>
                    <div className="mt-0.5 font-anton text-[15px] text-text-primary">{detailedPlayer.injuryProneness ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1.5 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[6px] font-bold uppercase text-text-secondary lg:text-[6.5px]">Vs Pace</div>
                    <div className="mt-0.5 font-anton text-[15px] text-text-primary">{detailedPlayer.paceRating ?? "-"}</div>
                  </div>
                  <div className="rounded border border-border/70 bg-surface/60 p-1.5 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[6px] font-bold uppercase text-text-secondary lg:text-[6.5px]">Vs Spin</div>
                    <div className="mt-0.5 font-anton text-[15px] text-text-primary">{detailedPlayer.spinRating ?? "-"}</div>
                  </div>
                </div>
              )}
            </section>}

            {/* Career T20 Stats */}
            <section className="col-span-2 col-start-1 row-start-2 self-start rounded border border-border bg-bg p-3">
              <h4 className="mb-2 border-b border-border pb-1.5 font-anton text-[12px] uppercase text-text-primary">Career T20 Stats</h4>
              <div className="grid grid-cols-8 gap-2">
                {[
                  ["Matches", careerT20Matches],
                  ["Bat Inns", careerT20Innings],
                  ["Runs", careerT20Runs],
                  ["Bat Avg", careerT20Average > 0 ? formatStatValue(careerT20Average) : "-"],
                  ["SR", careerT20StrikeRate > 0 ? formatStatValue(careerT20StrikeRate) : "-"],
                  ["Bowl Inns", careerT20BowlingMatches],
                  ["Wickets", careerT20Wickets],
                  ["Bowl Avg", careerT20BowlingAverage > 0 ? formatStatValue(careerT20BowlingAverage) : "-"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded border border-border bg-surface px-1 py-2 text-center">
                    <div className="whitespace-nowrap font-space-mono text-[7px] font-bold uppercase leading-none text-text-secondary">{label}</div>
                    <div className="mt-1 font-anton text-[17px] leading-tight text-text-primary">{value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="col-span-2 col-start-1 self-start rounded border border-border bg-bg p-3">
              <h4 className="mb-2 border-b border-border pb-1.5 font-anton text-[12px] uppercase text-text-primary">International T20</h4>
              <div className="grid grid-cols-8 gap-2">
                {[
                  ["Matches", effectiveInternationalStats?.matches ?? 0], ["Innings", effectiveInternationalStats?.innings ?? 0],
                  ["Runs", effectiveInternationalStats?.runs ?? 0], ["Highest", effectiveInternationalStats?.highestScore ?? 0],
                  ["Strike rate", effectiveInternationalStats?.balls ? formatStatValue(effectiveInternationalStats.runs * 100 / effectiveInternationalStats.balls) : "-"],
                  ["Wickets", effectiveInternationalStats?.wickets ?? 0],
                  ["Economy", effectiveInternationalStats?.bowlingBalls ? formatStatValue(effectiveInternationalStats.runsConceded * 6 / effectiveInternationalStats.bowlingBalls) : "-"],
                  ["Best", effectiveInternationalStats?.bowlingInnings && effectiveInternationalStats.bestBowlingWickets > 0 ? `${effectiveInternationalStats.bestBowlingWickets}/${effectiveInternationalStats.bestBowlingRuns}` : "-"],
                ].map(([label, value]) => <div key={label} className="rounded border border-border bg-surface px-1 py-2 text-center"><div className="font-space-mono text-[6px] uppercase text-text-secondary">{label}</div><div className="font-anton text-[15px] text-text-primary">{value}</div></div>)}
              </div>
            </section>

            {/* All-Time IPL Stats */}
            <section className="col-span-2 col-start-1 row-start-3 self-start rounded border border-border bg-bg p-3">
              <h4 className="mb-2 border-b border-border pb-1.5 font-anton text-[12px] uppercase text-text-primary">IPL All-Time Stats</h4>
              <div className="space-y-2">
                <div>
                  <div className="mb-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-accent">Batting</div>
                  <div className="grid grid-cols-[0.8fr_0.7fr_0.75fr_0.85fr_0.85fr_1fr_1fr_0.6fr_0.65fr_0.7fr_0.7fr_0.9fr] gap-1.5 lg:gap-2">
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
                      <div key={label} className="flex min-w-0 flex-col rounded border border-border bg-surface px-1 py-1.5 text-center">
                        <div className="flex h-5 items-center justify-center whitespace-nowrap font-space-mono text-[6px] font-bold uppercase leading-none text-text-secondary lg:text-[7px]">{label}</div>
                        <div className="mt-0.5 font-anton text-[16px] leading-tight text-text-primary">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-accent">Bowling</div>
                  <div className="grid grid-cols-[0.72fr_0.7fr_1.15fr_0.82fr_0.9fr_0.9fr_1fr_0.8fr_0.8fr] gap-1.5 lg:gap-2">
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
                      <div key={label} className="flex min-w-0 flex-col rounded border border-border bg-surface px-1 py-1.5 text-center">
                        <div className="flex h-5 items-center justify-center whitespace-nowrap font-space-mono text-[6px] font-bold uppercase leading-none text-text-secondary lg:text-[7px]">{label}</div>
                        <div className="mt-0.5 font-anton text-[16px] leading-tight text-text-primary">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-accent">Fielding</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["Catches", detailedPlayer.iplStats?.catches ?? 0],
                      ["Stumpings", detailedPlayer.iplStats?.stumpings ?? 0],
                      ["Run Outs", detailedPlayer.iplStats?.runOuts ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded border border-border bg-surface px-1 py-1.5 text-center">
                        <div className="font-space-mono text-[7px] font-bold uppercase leading-none text-text-secondary">{label}</div>
                        <div className="mt-0.5 font-anton text-[16px] leading-tight text-text-primary">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Current Season Stats */}
            {!isRetired && seasonStats && (
              <section className="col-span-2 col-start-1 row-start-4 self-start rounded border border-border bg-bg p-3">
                <div className="mb-2 flex items-center justify-between border-b border-border pb-1.5">
                  <h4 className="font-anton text-[12px] uppercase text-text-primary">Current Season Stats ('{rosterSeason.slice(-2)})</h4>
                  <span className="font-space-mono text-[9px] font-bold text-accent uppercase">{seasonStats.matches} Matches Played</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Batting Season Stats */}
                  <div className="space-y-1 rounded border border-border/80 bg-surface p-2">
                    <div className="font-anton text-[11px] uppercase text-accent border-b border-border/40 pb-1">Batting Figures</div>
                    <div className="grid grid-cols-7 gap-2 text-center">
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Matches</div>
                        <div className="font-anton text-[16px] text-text-primary mt-0.5">{seasonStats.matches}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Runs</div>
                        <div className="font-anton text-[16px] text-text-primary mt-0.5">{seasonStats.runs}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">SR</div>
                        <div className="font-anton text-[16px] text-text-primary mt-0.5">{seasonStats.batSR}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Average</div>
                        <div className="font-anton text-[16px] text-text-primary mt-0.5">{seasonStats.batAvg}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">4s</div>
                        <div className="font-anton text-[16px] text-text-primary mt-0.5">{seasonStats.fours}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">6s</div>
                        <div className="font-anton text-[16px] text-text-primary mt-0.5">{seasonStats.sixes}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary whitespace-nowrap">H. Score</div>
                        <div className="font-anton text-[16px] text-accent mt-0.5">{seasonStats.highScore}</div>
                      </div>
                    </div>
                  </div>

                  {/* Bowling Season Stats */}
                  <div className="space-y-1 rounded border border-border/80 bg-surface p-2">
                    <div className="font-anton text-[11px] uppercase text-accent border-b border-border/40 pb-1">Bowling Figures</div>
                    <div className="grid grid-cols-6 gap-2 text-center">
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Matches</div>
                        <div className="font-anton text-[16px] text-text-primary mt-0.5">{seasonStats.bowlMatches}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Wickets</div>
                        <div className="font-anton text-[16px] text-text-primary mt-0.5">{seasonStats.bowlWickets}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Bowl Avg</div>
                        <div className="font-anton text-[16px] text-text-primary mt-0.5">{seasonStats.bowlAvg}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Bowl SR</div>
                        <div className="font-anton text-[16px] text-text-primary mt-0.5">{seasonStats.bowlSR}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">3fers</div>
                        <div className="font-anton text-[16px] text-text-primary mt-0.5">{seasonStats.threeFers}</div>
                      </div>
                      <div>
                        <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary whitespace-nowrap">B. Figs</div>
                        <div className="font-anton text-[16px] text-accent mt-0.5">{seasonStats.bestFiguresStr}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Team History */}
            <section className="col-start-3 row-span-4 row-start-1 min-h-0 self-start overflow-hidden rounded border border-border bg-bg p-3">
              <h4 className="mb-2 border-b border-border pb-1.5 font-anton text-[12px] uppercase text-text-primary">Team History</h4>
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
                        {entry.seasonStats && (
                          <span className="mt-0.5 block whitespace-nowrap font-space-mono text-[7px] font-bold text-accent">
                            {entry.seasonStats.matches} Mts&nbsp;&nbsp;&nbsp;{entry.seasonStats.runs} Rs&nbsp;&nbsp;&nbsp;{entry.seasonStats.wickets} Ws
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
    </div>
  );
}
