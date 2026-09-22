"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp, Crown, Search, Target, TrendingUp, X } from "lucide-react";

import { getTeamColorStyle } from "@/lib/theme/teamColors";
import type { Team } from "@/lib/types";
import type { TournamentPlayerStat } from "./TournamentStatsDashboard";

interface TournamentLeaderboardModalProps {
  isOpen: boolean;
  type: "orange" | "purple";
  season: number;
  players: TournamentPlayerStat[];
  teams: Record<string, Team>;
  onClose: () => void;
  onOpenPlayer: (playerId: string) => void;
}

function getLegalBalls(overs: number): number {
  return Math.floor(overs) * 6 + Math.round((overs - Math.floor(overs)) * 10);
}

function teamShortName(teams: Record<string, Team>, teamId: string) {
  return teams[teamId]?.shortName ?? teamId;
}

function getBattingAvg(player: TournamentPlayerStat): number {
  if (player.dismissals && player.dismissals > 0) {
    return player.runs / player.dismissals;
  }
  return player.runs;
}

function getBattingSR(player: TournamentPlayerStat): number {
  return player.balls > 0 ? (player.runs / player.balls) * 100 : 0;
}

function getBowlingEcon(player: TournamentPlayerStat): number {
  const balls = getLegalBalls(player.oversBowled);
  return balls > 0 ? (player.runsConceded / balls) * 6 : 999;
}

function getBowlingAvg(player: TournamentPlayerStat): number {
  return player.wickets > 0 ? player.runsConceded / player.wickets : 9999;
}

function getBowlingSR(player: TournamentPlayerStat): number {
  const balls = getLegalBalls(player.oversBowled);
  return player.wickets > 0 ? balls / player.wickets : 9999;
}

function getBestBowlingScore(player: TournamentPlayerStat): number {
  if (!player.bestBowling || player.bestBowling === "0/0") return 0;
  const parts = player.bestBowling.split("/");
  const w = parseInt(parts[0], 10) || 0;
  const r = parseInt(parts[1], 10) || 0;
  return w * 1000 - r;
}

function SortHeader({
  colKey,
  label,
  align = "right",
  className = "",
  sortKey,
  sortAsc,
  themeColor,
  onSort,
}: {
  colKey: string;
  label: string;
  align?: "left" | "center" | "right";
  className?: string;
  sortKey: string;
  sortAsc: boolean;
  themeColor: string;
  onSort: (key: string) => void;
}) {
  const isSorted = sortKey === colKey;
  const alignClass =
    align === "left"
      ? "justify-start text-left"
      : align === "center"
      ? "justify-center text-center"
      : "justify-end text-right";

  return (
    <th
      className={`px-3 py-2.5 transition-colors select-none cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.04] ${className}`}
      onClick={() => onSort(colKey)}
    >
      <button
        type="button"
        className={`group flex w-full items-center gap-1 font-space-mono text-[9px] uppercase tracking-wider transition-colors ${alignClass} ${
          isSorted
            ? "font-bold text-text-primary"
            : "text-text-secondary hover:text-text-primary"
        }`}
        title={`Sort by ${label} (${
          isSorted
            ? sortAsc
              ? "ascending"
              : "descending"
            : "click to sort"
        })`}
      >
        <span
          className={
            isSorted ? "underline decoration-2 underline-offset-4" : ""
          }
          style={{ textDecorationColor: isSorted ? themeColor : undefined }}
        >
          {label}
        </span>
        <span className="inline-flex shrink-0 items-center">
          {isSorted ? (
            sortAsc ? (
              <ChevronUp size={12} style={{ color: themeColor }} />
            ) : (
              <ChevronDown size={12} style={{ color: themeColor }} />
            )
          ) : (
            <ArrowUpDown
              size={9}
              className="opacity-20 group-hover:opacity-75 transition-opacity"
            />
          )}
        </span>
      </button>
    </th>
  );
}

export default function TournamentLeaderboardModal({
  isOpen,
  type,
  season,
  players,
  teams,
  onClose,
  onOpenPlayer,
}: TournamentLeaderboardModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const isOrange = type === "orange";
  const defaultSortKey = isOrange ? "runs" : "wickets";
  const [sortKey, setSortKey] = useState<string>(defaultSortKey);
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const themeColor = isOrange ? "#f97316" : "#9333ea";
  const title = isOrange ? "Orange Cap Leaderboard" : "Purple Cap Leaderboard";
  const subtitle = isOrange
    ? `Season ${season} · Top Run Scorers`
    : `Season ${season} · Top Wicket Takers`;
  const Icon = isOrange ? TrendingUp : Target;

  useEffect(() => {
    setSortKey(isOrange ? "runs" : "wickets");
    setSortAsc(false);
  }, [isOrange]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      const shouldDefaultAsc =
        key === "pos" ||
        key === "player" ||
        key === "team" ||
        (!isOrange && (key === "econ" || key === "avg" || key === "sr"));
      setSortAsc(shouldDefaultAsc);
    }
  };

  const isNonDefaultSort = sortKey !== defaultSortKey || sortAsc !== false;

  const sortedAndFilteredPlayers = useMemo(() => {
    let result = [...players];

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((player) => {
        const nameMatch = player.name.toLowerCase().includes(query);
        const team = teams[player.teamId];
        const teamMatch =
          (team?.name && team.name.toLowerCase().includes(query)) ||
          (team?.shortName && team.shortName.toLowerCase().includes(query)) ||
          player.teamId.toLowerCase().includes(query);
        return nameMatch || teamMatch;
      });
    }

    result.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case "pos": {
          const rankA = players.findIndex((p) => p.id === a.id) + 1;
          const rankB = players.findIndex((p) => p.id === b.id) + 1;
          diff = rankA - rankB;
          break;
        }
        case "player":
          diff = a.name.localeCompare(b.name);
          break;
        case "team": {
          const tA = teamShortName(teams, a.teamId);
          const tB = teamShortName(teams, b.teamId);
          diff = tA.localeCompare(tB);
          break;
        }
        case "matches":
          diff = (a.matches ?? 0) - (b.matches ?? 0);
          break;
        case "battingInnings":
          diff = (a.battingInnings ?? 0) - (b.battingInnings ?? 0);
          break;
        case "runs":
          diff = a.runs - b.runs;
          break;
        case "balls":
          diff = a.balls - b.balls;
          break;
        case "sr":
          diff = isOrange
            ? getBattingSR(a) - getBattingSR(b)
            : getBowlingSR(a) - getBowlingSR(b);
          break;
        case "avg":
          diff = isOrange
            ? getBattingAvg(a) - getBattingAvg(b)
            : getBowlingAvg(a) - getBowlingAvg(b);
          break;
        case "highestScore":
          diff = (a.highestScore ?? 0) - (b.highestScore ?? 0);
          break;
        case "fours":
          diff = (a.fours ?? 0) - (b.fours ?? 0);
          break;
        case "sixes":
          diff = (a.sixes ?? 0) - (b.sixes ?? 0);
          break;
        case "oversBowled":
          diff = getLegalBalls(a.oversBowled) - getLegalBalls(b.oversBowled);
          break;
        case "wickets":
          diff = a.wickets - b.wickets;
          break;
        case "runsConceded":
          diff = a.runsConceded - b.runsConceded;
          break;
        case "econ":
          diff = getBowlingEcon(a) - getBowlingEcon(b);
          break;
        case "bestBowling":
          diff = getBestBowlingScore(a) - getBestBowlingScore(b);
          break;
        case "maidens":
          diff = (a.maidens ?? 0) - (b.maidens ?? 0);
          break;
        default:
          diff = 0;
      }

      if (diff === 0) {
        if (isOrange) {
          if (b.runs !== a.runs) return b.runs - a.runs;
          return getBattingSR(b) - getBattingSR(a);
        } else {
          if (b.wickets !== a.wickets) return b.wickets - a.wickets;
          return getBowlingEcon(a) - getBowlingEcon(b);
        }
      }

      return sortAsc ? diff : -diff;
    });

    return result;
  }, [players, searchQuery, teams, sortKey, sortAsc, isOrange]);

  if (!isOpen) return null;

  // The true tournament leader is always players[0]
  const leader = players[0];

  return (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center overflow-hidden bg-black/75 p-2 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={onClose}
    >
      <div
        className="flex h-[92vh] sm:h-auto max-h-[92vh] w-[calc(100%-0.5rem)] sm:w-full max-w-5xl flex-col overflow-hidden rounded-xl border-2 border-border bg-surface text-text-primary shadow-2xl animate-in zoom-in-95 duration-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative flex shrink-0 flex-col gap-2.5 border-b-2 border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border"
              style={{
                color: themeColor,
                borderColor: `${themeColor}55`,
                backgroundColor: `${themeColor}15`,
              }}
            >
              <Icon size={18} className="sm:h-5 sm:w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="rounded px-1.5 py-0.5 font-space-mono text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-white"
                  style={{ backgroundColor: themeColor }}
                >
                  {isOrange ? "Orange Cap" : "Purple Cap"}
                </span>
                <span className="font-space-mono text-[8px] sm:text-[9px] font-bold uppercase text-text-secondary">
                  {players.length} Players
                </span>
              </div>
              <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary sm:text-2xl leading-tight">
                {title}
              </h3>
              <p className="font-space-mono text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-text-secondary">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search
                size={13}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search player or team..."
                className="w-full rounded-lg border border-border bg-bg/50 py-1 pl-8 pr-7 font-space-mono text-xs text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors hover:border-text-secondary hover:text-text-primary"
              title="Close modal (Esc)"
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Current Leader Spotlight Banner */}
        {leader && (
          <div
            className="relative shrink-0 border-b border-border px-4 py-2.5 sm:px-5 sm:py-3"
            style={{
              background: `linear-gradient(to right, ${themeColor}18, ${themeColor}06, transparent)`,
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
                  style={{
                    color: themeColor,
                    borderColor: `${themeColor}60`,
                    backgroundColor: `${themeColor}25`,
                  }}
                >
                  <Crown size={15} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="font-space-mono text-[8px] font-bold uppercase tracking-wider"
                      style={{ color: themeColor }}
                    >
                      Current Leader
                    </span>
                    <span className="font-space-mono text-[8px] text-text-secondary">·</span>
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={getTeamColorStyle(teams[leader.teamId], themeColor)}
                    />
                    <span className="font-space-mono text-[8px] font-bold uppercase text-text-secondary truncate">
                      {teams[leader.teamId]?.name ?? leader.teamId}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenPlayer(leader.id)}
                    className="truncate font-anton text-base sm:text-lg uppercase text-text-primary transition-colors hover:underline hover:text-accent text-left block max-w-full"
                  >
                    {leader.name}
                  </button>
                </div>
              </div>

              {/* Leader Key Figures */}
              <div className="flex items-center gap-3 sm:gap-5 font-space-mono shrink-0">
                <div className="text-right">
                  <span className="block text-[7px] sm:text-[8px] font-bold uppercase text-text-secondary">
                    {isOrange ? "Total Runs" : "Total Wickets"}
                  </span>
                  <span
                    className="font-anton text-xl sm:text-2xl leading-none"
                    style={{ color: themeColor }}
                  >
                    {isOrange ? leader.runs : leader.wickets}
                  </span>
                </div>

                {isOrange ? (
                  <>
                    <div className="text-right">
                      <span className="block text-[7px] sm:text-[8px] font-bold uppercase text-text-secondary">
                        Strike Rate
                      </span>
                      <span className="text-[11px] sm:text-xs font-bold text-text-primary">
                        {((leader.runs / Math.max(1, leader.balls)) * 100).toFixed(1)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[7px] sm:text-[8px] font-bold uppercase text-text-secondary">
                        Average
                      </span>
                      <span className="text-[11px] sm:text-xs font-bold text-text-primary">
                        {leader.dismissals && leader.dismissals > 0
                          ? (leader.runs / leader.dismissals).toFixed(2)
                          : leader.runs > 0
                          ? `${leader.runs}*`
                          : "—"}
                      </span>
                    </div>
                    <div className="hidden sm:block text-right">
                      <span className="block text-[7px] sm:text-[8px] font-bold uppercase text-text-secondary">
                        4s / 6s
                      </span>
                      <span className="text-[11px] sm:text-xs font-bold text-text-primary">
                        {leader.fours ?? 0} / {leader.sixes ?? 0}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-right">
                      <span className="block text-[7px] sm:text-[8px] font-bold uppercase text-text-secondary">
                        Economy
                      </span>
                      <span className="text-[11px] sm:text-xs font-bold text-text-primary">
                        {(() => {
                          const balls = getLegalBalls(leader.oversBowled);
                          return balls > 0
                            ? ((leader.runsConceded / balls) * 6).toFixed(2)
                            : "—";
                        })()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[7px] sm:text-[8px] font-bold uppercase text-text-secondary">
                        Average
                      </span>
                      <span className="text-[11px] sm:text-xs font-bold text-text-primary">
                        {leader.wickets > 0
                          ? (leader.runsConceded / leader.wickets).toFixed(2)
                          : "—"}
                      </span>
                    </div>
                    <div className="hidden sm:block text-right">
                      <span className="block text-[7px] sm:text-[8px] font-bold uppercase text-text-secondary">
                        Best Spell
                      </span>
                      <span className="text-[11px] sm:text-xs font-bold text-text-primary">
                        {leader.bestBowling && leader.bestBowling !== "0/0"
                          ? leader.bestBowling
                          : "—"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Leaderboard Table */}
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
          {sortedAndFilteredPlayers.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center p-6 text-center text-text-secondary">
              <p className="text-sm font-medium">
                {searchQuery
                  ? `No players found matching "${searchQuery}"`
                  : "No stats recorded yet this season."}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-2 font-space-mono text-xs text-accent underline underline-offset-2"
                >
                  Clear search filter
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left font-barlow divide-y divide-border">
              <thead className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur font-space-mono text-[9px] uppercase tracking-wider text-text-secondary">
                <tr>
                  <SortHeader
                    colKey="pos"
                    label="Pos"
                    align="center"
                    className="w-12"
                    sortKey={sortKey}
                    sortAsc={sortAsc}
                    themeColor={themeColor}
                    onSort={handleSort}
                  />
                  <SortHeader
                    colKey="player"
                    label="Player"
                    align="left"
                    sortKey={sortKey}
                    sortAsc={sortAsc}
                    themeColor={themeColor}
                    onSort={handleSort}
                  />
                  <SortHeader
                    colKey="team"
                    label="Team"
                    align="left"
                    className="w-20"
                    sortKey={sortKey}
                    sortAsc={sortAsc}
                    themeColor={themeColor}
                    onSort={handleSort}
                  />
                  <SortHeader
                    colKey="matches"
                    label="Mat"
                    align="center"
                    className="w-14"
                    sortKey={sortKey}
                    sortAsc={sortAsc}
                    themeColor={themeColor}
                    onSort={handleSort}
                  />
                  {isOrange ? (
                    <>
                      <SortHeader
                        colKey="battingInnings"
                        label="Inns"
                        align="center"
                        className="w-14"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                      <SortHeader
                        colKey="runs"
                        label="Runs"
                        align="right"
                        className="w-16"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                      <SortHeader
                        colKey="balls"
                        label="BF"
                        align="right"
                        className="w-14"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                      <SortHeader
                        colKey="sr"
                        label="SR"
                        align="right"
                        className="w-16"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                      <SortHeader
                        colKey="avg"
                        label="Avg"
                        align="right"
                        className="w-16"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                      <SortHeader
                        colKey="highestScore"
                        label="HS"
                        align="right"
                        className="w-14"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                      <SortHeader
                        colKey="fours"
                        label="4s"
                        align="right"
                        className="w-14"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                      <SortHeader
                        colKey="sixes"
                        label="6s"
                        align="right"
                        className="w-14"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                    </>
                  ) : (
                    <>
                      <SortHeader
                        colKey="oversBowled"
                        label="Overs"
                        align="right"
                        className="w-16"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                      <SortHeader
                        colKey="wickets"
                        label="Wkts"
                        align="right"
                        className="w-16"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                      <SortHeader
                        colKey="runsConceded"
                        label="Runs"
                        align="right"
                        className="w-14"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                      <SortHeader
                        colKey="econ"
                        label="Econ"
                        align="right"
                        className="w-16"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                      <SortHeader
                        colKey="avg"
                        label="Avg"
                        align="right"
                        className="w-16"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                      <SortHeader
                        colKey="sr"
                        label="SR"
                        align="right"
                        className="w-14"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                      <SortHeader
                        colKey="bestBowling"
                        label="BBI"
                        align="right"
                        className="w-16"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                      <SortHeader
                        colKey="maidens"
                        label="Mdns"
                        align="right"
                        className="w-14"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        themeColor={themeColor}
                        onSort={handleSort}
                      />
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-space-mono text-xs">
                {sortedAndFilteredPlayers.map((player) => {
                  const tournamentRank = players.findIndex((p) => p.id === player.id) + 1;
                  const legalBalls = getLegalBalls(player.oversBowled);
                  const battingStrikeRate =
                    player.balls > 0
                      ? ((player.runs / player.balls) * 100).toFixed(1)
                      : "0.0";
                  const battingAvg =
                    player.dismissals && player.dismissals > 0
                      ? (player.runs / player.dismissals).toFixed(2)
                      : player.runs > 0
                      ? `${player.runs}*`
                      : "—";

                  const bowlingEcon =
                    legalBalls > 0
                      ? ((player.runsConceded / legalBalls) * 6).toFixed(2)
                      : "0.00";
                  const bowlingAvg =
                    player.wickets > 0
                      ? (player.runsConceded / player.wickets).toFixed(2)
                      : "—";
                  const bowlingSR =
                    player.wickets > 0
                      ? (legalBalls / player.wickets).toFixed(1)
                      : "—";

                  const isTop1 = tournamentRank === 1;
                  const isTop2 = tournamentRank === 2;
                  const isTop3 = tournamentRank === 3;

                  return (
                    <tr
                      key={player.id}
                      onClick={() => onOpenPlayer(player.id)}
                      className="cursor-pointer transition-colors hover:bg-black/[0.035] dark:hover:bg-white/[0.04]"
                    >
                      {/* Pos / Rank */}
                      <td className="px-3 py-2 text-center">
                        {isTop1 ? (
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm"
                            style={{ backgroundColor: themeColor }}
                            title={isOrange ? "Rank 1 (Orange Cap)" : "Rank 1 (Purple Cap)"}
                          >
                            1
                          </span>
                        ) : isTop2 ? (
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-[9px] font-bold text-white dark:bg-slate-500"
                            title="Rank 2"
                          >
                            2
                          </span>
                        ) : isTop3 ? (
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-700 text-[9px] font-bold text-white dark:bg-amber-600"
                            title="Rank 3"
                          >
                            3
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-text-secondary">
                            {tournamentRank}
                          </span>
                        )}
                      </td>

                      {/* Player Info */}
                      <td className="px-4 py-2 font-barlow">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={getTeamColorStyle(teams[player.teamId], themeColor)}
                          />
                          <div className="min-w-0">
                            <span className="block truncate font-bold text-text-primary hover:text-accent">
                              {player.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Team */}
                      <td className="px-3 py-2 font-space-mono text-[10px] font-bold uppercase text-text-secondary">
                        {teamShortName(teams, player.teamId)}
                      </td>

                      {/* Matches */}
                      <td className="px-3 py-2 text-center text-text-secondary">
                        {player.matches ?? "—"}
                      </td>

                      {isOrange ? (
                        <>
                          {/* Batting Inns */}
                          <td className="px-3 py-2 text-center text-text-secondary">
                            {player.battingInnings ?? "—"}
                          </td>
                          {/* Runs */}
                          <td
                            className={`px-3 py-2 text-right font-bold text-sm ${
                              sortKey === "runs" ? "underline underline-offset-2 decoration-1" : ""
                            }`}
                            style={{ color: themeColor }}
                          >
                            {player.runs}
                          </td>
                          {/* Balls Faced */}
                          <td className={`px-3 py-2 text-right text-text-secondary ${sortKey === "balls" ? "font-bold text-text-primary" : ""}`}>
                            {player.balls}
                          </td>
                          {/* Strike Rate */}
                          <td className={`px-3 py-2 text-right font-medium ${sortKey === "sr" ? "font-bold text-text-primary underline underline-offset-2" : "text-text-primary"}`}>
                            {battingStrikeRate}
                          </td>
                          {/* Average */}
                          <td className={`px-3 py-2 text-right ${sortKey === "avg" ? "font-bold text-text-primary underline underline-offset-2" : "text-text-secondary"}`}>
                            {battingAvg}
                          </td>
                          {/* Highest Score */}
                          <td className={`px-3 py-2 text-right ${sortKey === "highestScore" ? "font-bold text-text-primary" : "text-text-primary"}`}>
                            {player.highestScore ?? "—"}
                          </td>
                          {/* 4s */}
                          <td className={`px-3 py-2 text-right ${sortKey === "fours" ? "font-bold text-text-primary" : "text-text-secondary"}`}>
                            {player.fours ?? 0}
                          </td>
                          {/* 6s */}
                          <td className={`px-3 py-2 text-right ${sortKey === "sixes" ? "font-bold text-text-primary" : "text-text-secondary"}`}>
                            {player.sixes ?? 0}
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Overs */}
                          <td className={`px-3 py-2 text-right ${sortKey === "oversBowled" ? "font-bold text-text-primary underline underline-offset-2" : "text-text-secondary"}`}>
                            {player.oversBowled.toFixed(1)}
                          </td>
                          {/* Wickets */}
                          <td
                            className={`px-3 py-2 text-right font-bold text-sm ${
                              sortKey === "wickets" ? "underline underline-offset-2 decoration-1" : ""
                            }`}
                            style={{ color: themeColor }}
                          >
                            {player.wickets}
                          </td>
                          {/* Runs Conceded */}
                          <td className={`px-3 py-2 text-right ${sortKey === "runsConceded" ? "font-bold text-text-primary" : "text-text-secondary"}`}>
                            {player.runsConceded}
                          </td>
                          {/* Economy */}
                          <td className={`px-3 py-2 text-right font-medium ${sortKey === "econ" ? "font-bold text-text-primary underline underline-offset-2" : "text-text-primary"}`}>
                            {bowlingEcon}
                          </td>
                          {/* Bowling Average */}
                          <td className={`px-3 py-2 text-right ${sortKey === "avg" ? "font-bold text-text-primary underline underline-offset-2" : "text-text-secondary"}`}>
                            {bowlingAvg}
                          </td>
                          {/* Bowling Strike Rate */}
                          <td className={`px-3 py-2 text-right ${sortKey === "sr" ? "font-bold text-text-primary underline underline-offset-2" : "text-text-secondary"}`}>
                            {bowlingSR}
                          </td>
                          {/* BBI */}
                          <td className={`px-3 py-2 text-right ${sortKey === "bestBowling" ? "font-bold text-text-primary underline underline-offset-2" : "text-text-primary"}`}>
                            {player.bestBowling && player.bestBowling !== "0/0"
                              ? player.bestBowling
                              : "—"}
                          </td>
                          {/* Maidens */}
                          <td className={`px-3 py-2 text-right ${sortKey === "maidens" ? "font-bold text-text-primary" : "text-text-secondary"}`}>
                            {player.maidens ?? 0}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-4 py-2 sm:px-5 sm:py-3 text-[9px] font-space-mono text-text-secondary">
          <div className="flex items-center gap-3">
            <span>
              {isOrange
                ? "Official tie-breaker: Highest strike rate, followed by fewer balls faced."
                : "Official tie-breaker: Lowest economy rate, followed by fewer runs conceded."}
            </span>
            {isNonDefaultSort && (
              <button
                type="button"
                onClick={() => {
                  setSortKey(defaultSortKey);
                  setSortAsc(false);
                }}
                className="font-bold underline underline-offset-2 transition-colors hover:text-text-primary"
                style={{ color: themeColor }}
              >
                Reset sorting
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span>
              Showing {sortedAndFilteredPlayers.length} of {players.length} players
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border px-2.5 py-1 text-[10px] font-bold uppercase transition-colors hover:border-text-secondary hover:text-text-primary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
