"use client";

import React, { useMemo } from "react";
import { X } from "lucide-react";
import { useGameStore } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";
import { formatStatValue } from "@/lib/logic/statFormatting";
import {
  getPlayerSeasonHistory,
  mergePlayerIplHistory,
  upsertPlayerIplHistory,
  wasPlayerAcquiredViaRtm,
} from "@/lib/logic/playerHistory";
import type { HistoricalPlayerSnapshot } from "@/lib/logic/careerLifecycle";
import type { Player, IPLHistoryEntry } from "@/lib/types";

function retiredSnapshotPlayer(snapshot: HistoricalPlayerSnapshot): Player {
  return {
    id: snapshot.id,
    name: snapshot.name,
    age: snapshot.retirementAge,
    nationality: snapshot.nationality,
    country: snapshot.country,
    role: snapshot.role,
    battingStyle: snapshot.battingStyle ?? "Right-hand",
    bowlingStyle: snapshot.bowlingStyle ?? null,
    bowlingHand: snapshot.bowlingHand ?? null,
    careerStats: snapshot.careerStats,
    iplStats: snapshot.iplStats,
    iplHistory: snapshot.iplHistory,
    basePrice: 0,
    isCapped: snapshot.isCapped ?? true,
    isRetained: false,
    retainedByTeamId: null,
    currentTeamId: null,
    potential: "Established",
    currentBatting: snapshot.currentBatting ?? snapshot.finalRating,
    potentialBatting: snapshot.potentialBatting ?? snapshot.currentBatting ?? snapshot.finalRating,
    currentBowling: snapshot.currentBowling ?? snapshot.finalRating,
    potentialBowling: snapshot.potentialBowling ?? snapshot.currentBowling ?? snapshot.finalRating,
    isWicketkeeper: snapshot.role === "WK-Batsman",
  };
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
}

export function PlayerProfileModal({
  playerId,
  onClose,
  customFixtures,
}: PlayerProfileModalProps) {
  const players = useGameStore((state) => state.players);
  const teams = useGameStore((state) => state.teams);
  const currentSeason = useGameStore((state) => state.currentSeason);
  const auction = useGameStore((state) => state.auction);
  const retiredPlayerSnapshots = useGameStore((state) => state.retiredPlayerSnapshots);

  const activePlayer = playerId ? players[playerId] ?? null : null;
  const retiredSnapshot = playerId && !activePlayer
    ? retiredPlayerSnapshots[playerId] ?? null
    : null;
  const detailedPlayer: Player | null = playerId
    ? activePlayer ?? (retiredSnapshot ? retiredSnapshotPlayer(retiredSnapshot) : null)
    : null;

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
    let history = currentEntry ? upsertPlayerIplHistory(mergedHistory, currentEntry) : mergedHistory;

    // Attach live current season stats if available from current season fixtures
    if (seasonStats && seasonStats.matches > 0) {
      const currentSeasonStr = String(currentSeason);
      history = history.map((entry) => {
        if (entry.season === currentSeasonStr) {
          return {
            ...entry,
            seasonStats: {
              matches: seasonStats.matches,
              runs: seasonStats.runs,
              balls: 0,
              wickets: seasonStats.bowlWickets,
              runsConceded: 0,
              oversBowled: 0,
            },
          };
        }
        return entry;
      });
    }

    return history;
  }, [currentSeasonHistoryByPlayer, currentSeason, detailedPlayer, seasonStats]);

  if (!detailedPlayer) return null;

  const currentTeam = teams[detailedPlayer.currentTeamId ?? ""];
  const nationalityLabel = detailedPlayer.nationality === "Overseas"
    && detailedPlayer.country
    && detailedPlayer.country !== "Overseas"
    ? detailedPlayer.country
    : detailedPlayer.nationality;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 sm:p-12 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border-2 border-border bg-surface text-text-primary shadow-2xl animate-in zoom-in-95 duration-200"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b-2 border-border bg-surface px-6 py-4">
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
            </div>
            <h3 className="truncate font-anton text-[28px] uppercase leading-none text-text-primary">{detailedPlayer.name}</h3>
            <p className="mt-2 font-space-mono text-[10px] uppercase text-text-secondary">
              {detailedPlayer.role} · Age {detailedPlayer.age} · {currentTeam?.name
                ?? (retiredSnapshot ? `Retired ${retiredSnapshot.retirementSeason}` : "No current club")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-surface text-text-primary transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Close player profile"
          >
            <X size={17} />
          </button>
        </div>

        {/* Content Body */}
        <div className="min-h-0 overflow-y-auto bg-surface p-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Player Details */}
            <section className="rounded border border-border bg-bg p-4 lg:col-span-1">
              <h4 className="mb-3 border-b border-border pb-2 font-anton text-[13px] uppercase text-text-primary">Player Details</h4>
              <div className="space-y-2.5 font-space-mono text-[10px]">
                {[
                  ["Nationality", nationalityLabel],
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

            {/* Ability */}
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

            {/* Career T20 Stats */}
            <section className="rounded border border-border bg-bg p-4 lg:col-span-3">
              <h4 className="mb-3 border-b border-border pb-2 font-anton text-[13px] uppercase text-text-primary">Career T20 Stats</h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {[
                  ["Matches", detailedPlayer.careerStats?.batting.matches ?? 0],
                  ["Bat Inns", detailedPlayer.careerStats?.batting.innings ?? 0],
                  ["Runs", detailedPlayer.careerStats?.batting.runs ?? 0],
                  ["Bat Avg", detailedPlayer.careerStats?.batting.average ?? 0],
                  ["SR", detailedPlayer.careerStats?.batting.strikeRate ?? 0],
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

            {/* All-Time IPL Stats */}
            <section className="rounded border border-border bg-bg p-4 lg:col-span-3">
              <h4 className="mb-3 border-b border-border pb-2 font-anton text-[13px] uppercase text-text-primary">IPL All-Time Stats</h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {[
                  ["Matches", detailedPlayer.iplStats?.matches ?? 0],
                  ["Runs", detailedPlayer.iplStats?.runs ?? 0],
                  ["Bat Avg", detailedPlayer.iplStats?.battingAverage ?? 0],
                  ["SR", detailedPlayer.iplStats?.strikeRate ?? 0],
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

            {/* Current Season Stats */}
            {seasonStats && (
              <section className="rounded border border-border bg-bg p-4 lg:col-span-3">
                <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                  <h4 className="font-anton text-[13px] uppercase text-text-primary">Current Season Stats ('{rosterSeason.slice(-2)})</h4>
                  <span className="font-space-mono text-[9px] font-bold text-accent uppercase">{seasonStats.matches} Matches Played</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Batting Season Stats */}
                  <div className="rounded border border-border/80 bg-surface p-3 space-y-2">
                    <div className="font-anton text-[11px] uppercase text-accent border-b border-border/40 pb-1">Batting Figures</div>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 text-center">
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
                  <div className="rounded border border-border/80 bg-surface p-3 space-y-2">
                    <div className="font-anton text-[11px] uppercase text-accent border-b border-border/40 pb-1">Bowling Figures</div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
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
                  .filter((entry) => entry.teamId && entry.teamId !== "UNSOLD")
                  .sort((a, b) => Number(b.season) - Number(a.season))
                  .map((entry) => (
                    <div
                      key={`${entry.season}-${entry.teamId}`}
                      className="grid min-h-9 grid-cols-[4rem_minmax(0,1fr)_5rem_4rem] items-center gap-3 border-b border-border/60 text-[10px]"
                    >
                      <span className="font-space-mono text-text-secondary">{entry.season}</span>
                      <span className="min-w-0 truncate font-semibold text-text-primary">
                        {teams[entry.teamId]?.name ?? entry.teamId}
                        {entry.seasonStats && (
                          <span className="ml-2 font-space-mono text-[8px] font-normal text-text-secondary">
                            {entry.seasonStats.runs} runs · {entry.seasonStats.wickets} wkts
                          </span>
                        )}
                      </span>
                      <span className="text-right font-space-mono text-text-primary">{entry.price > 0 ? formatPrice(entry.price) : "—"}</span>
                      <span className="text-right font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                        {entry.isRtm ? "RTM" : "Signed"}
                      </span>
                    </div>
                  ))}
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
