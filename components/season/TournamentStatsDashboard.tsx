"use client";

import { Crown, Sparkles, Target, TrendingUp, Trophy } from "lucide-react";

import type { EmergingAwardCandidate, MvpAwardCandidate } from "@/lib/logic/seasonAwards";
import { getTeamColorStyle } from "@/lib/theme/teamColors";
import type { Team } from "@/lib/types";

interface TournamentPlayerStat {
  id: string;
  name: string;
  teamId: string;
  runs: number;
  balls: number;
  wickets: number;
  runsConceded: number;
  oversBowled: number;
}

interface MatchPerformance {
  id: string;
  name: string;
  teamId: string;
  opponentId: string;
  matchNumber: number;
  runs?: number;
  balls?: number;
  wickets?: number;
  runsConceded?: number;
  overs?: number;
  dismissal?: string;
}

interface AwardRow {
  id: string;
  name: string;
  teamId: string;
  value: string;
  detail: string;
}

interface AwardBoard {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  icon: typeof Trophy;
  rows: AwardRow[];
}

function teamShortName(teams: Record<string, Team>, teamId: string) {
  return teams[teamId]?.shortName ?? teamId;
}

function AwardColumn({
  board,
  teams,
  onOpenPlayer,
}: {
  board: AwardBoard;
  teams: Record<string, Team>;
  onOpenPlayer: (playerId: string) => void;
}) {
  const Icon = board.icon;
  const leader = board.rows[0];
  return (
    <article className="flex h-full min-h-[300px] min-w-0 flex-col overflow-hidden rounded-xl border-2 border-border bg-surface shadow-sm xl:min-h-0">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
            style={{ color: board.color, borderColor: `${board.color}55`, backgroundColor: `${board.color}12` }}
          >
            <Icon size={15} />
          </span>
          <div className="min-w-0">
            <h4 className="truncate font-anton text-[14px] uppercase leading-none text-text-primary">{board.title}</h4>
            <p className="mt-1 truncate font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">{board.subtitle}</p>
          </div>
        </div>
        <span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Top 5</span>
      </header>

      {leader ? (
        <>
          <button
            type="button"
            onClick={() => onOpenPlayer(leader.id)}
            className="group relative m-3 overflow-hidden rounded-lg border border-border px-4 py-4 text-left transition-colors hover:border-accent/50"
          >
            <span className="pointer-events-none absolute inset-y-0 left-0 w-1" style={{ backgroundColor: board.color }} />
            <span className="pointer-events-none absolute -right-8 -top-12 h-28 w-28 rounded-full opacity-10 blur-2xl" style={{ backgroundColor: board.color }} />
            <span className="relative flex items-end justify-between gap-3">
              <span className="min-w-0">
                <span className="font-space-mono text-[7px] font-bold uppercase tracking-[0.16em]" style={{ color: board.color }}>Current leader</span>
                <span className="mt-1 block truncate font-anton text-[20px] uppercase leading-none text-text-primary group-hover:underline">{leader.name}</span>
                <span className="mt-2 flex items-center gap-1.5 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                  <span
                    className="h-2 w-2 rounded-full bg-[var(--team-primary-color)] dark:bg-[var(--team-primary-color-dark)]"
                    style={getTeamColorStyle(teams[leader.teamId], board.color)}
                  />
                  {teamShortName(teams, leader.teamId)} · {leader.detail}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-anton text-[25px] leading-none" style={{ color: board.color }}>{leader.value}</span>
              </span>
            </span>
          </button>

          <div className="mx-3 mb-3 grid min-h-0 flex-1 grid-rows-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
            {board.rows.slice(1, 5).map((row, index) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onOpenPlayer(row.id)}
                className="grid min-h-0 w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden px-3 py-1 text-left transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.035]"
              >
                <span className="font-space-mono text-[8px] font-bold text-text-secondary">{index + 2}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-bold leading-tight text-text-primary">{row.name}</span>
                  <span className="block truncate font-space-mono text-[7px] uppercase leading-tight text-text-secondary">{teamShortName(teams, row.teamId)} · {row.detail}</span>
                </span>
                <span className="font-space-mono text-[9px] font-bold" style={{ color: board.color }}>{row.value}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-text-secondary">
          No performances recorded yet.
        </div>
      )}
    </article>
  );
}

function PerformanceList({
  title,
  subtitle,
  color,
  icon: Icon,
  performances,
  teams,
  bowling,
  onOpenPlayer,
}: {
  title: string;
  subtitle: string;
  color: string;
  icon: typeof Trophy;
  performances: MatchPerformance[];
  teams: Record<string, Team>;
  bowling?: boolean;
  onOpenPlayer: (playerId: string) => void;
}) {
  return (
    <section className="flex h-full min-h-[300px] flex-col overflow-hidden rounded-xl border-2 border-border bg-surface shadow-sm xl:min-h-0">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border" style={{ color, borderColor: `${color}55`, backgroundColor: `${color}12` }}>
          <Icon size={17} />
        </span>
        <div>
          <h4 className="font-anton text-[16px] uppercase leading-none text-text-primary">{title}</h4>
          <p className="mt-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">{subtitle}</p>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-rows-5 divide-y divide-border overflow-hidden">
            {performances.slice(0, 5).map((performance, index) => {
              const rank = index + 1;
              const strikeRate = ((performance.runs ?? 0) / Math.max(1, performance.balls ?? 0)) * 100;
              const notOut = performance.dismissal === "not out";
              return (
                <button
                  key={`${performance.matchNumber}-${performance.id}-${rank}`}
                  type="button"
                  onClick={() => onOpenPlayer(performance.id)}
                  className="grid min-h-0 w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden px-4 py-2 text-left transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.035]"
                >
                  <span className="font-space-mono text-[8px] font-bold text-text-secondary">{rank}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-bold leading-tight text-text-primary">{performance.name}</span>
                    <span className="block truncate font-space-mono text-[7px] uppercase leading-tight text-text-secondary">
                      {teamShortName(teams, performance.teamId)} vs {teamShortName(teams, performance.opponentId)} · Match {performance.matchNumber}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-space-mono">
                    <span className="block text-[11px] font-bold" style={{ color }}>
                      {bowling
                        ? `${performance.wickets ?? 0}/${performance.runsConceded ?? 0}`
                        : `${performance.runs ?? 0}${notOut ? "*" : ""} (${performance.balls ?? 0})`}
                    </span>
                    <span className="block text-[7px] text-text-secondary">
                      {bowling ? `${performance.overs ?? 0} overs` : `SR ${strikeRate.toFixed(1)}`}
                    </span>
                  </span>
                </button>
              );
            })}
            {performances.length === 0 && (
              <div className="flex min-h-36 items-center justify-center px-5 text-center text-xs text-text-secondary">No performances recorded yet.</div>
            )}
      </div>
    </section>
  );
}

export default function TournamentStatsDashboard({
  season,
  completedMatches,
  teams,
  orangeCapLeaders,
  purpleCapLeaders,
  mvpLeaders,
  emergingPlayerLeaders,
  bestBattingPerformances,
  bestBowlingFigures,
  onOpenPlayer,
}: {
  season: number;
  completedMatches: number;
  teams: Record<string, Team>;
  orangeCapLeaders: TournamentPlayerStat[];
  purpleCapLeaders: TournamentPlayerStat[];
  mvpLeaders: MvpAwardCandidate[];
  emergingPlayerLeaders: EmergingAwardCandidate[];
  bestBattingPerformances: MatchPerformance[];
  bestBowlingFigures: MatchPerformance[];
  onOpenPlayer: (playerId: string) => void;
}) {
  const awardBoards: AwardBoard[] = [
    {
      id: "orange",
      title: "Top Run Scorers",
      subtitle: "Orange Cap",
      color: "#f97316",
      icon: TrendingUp,
      rows: orangeCapLeaders.map((player) => ({
        id: player.id,
        name: player.name,
        teamId: player.teamId,
        value: `${player.runs}`,
        detail: `SR ${((player.runs / Math.max(1, player.balls)) * 100).toFixed(1)}`,
      })),
    },
    {
      id: "purple",
      title: "Top Wicket Takers",
      subtitle: "Purple Cap",
      color: "#7e22ce",
      icon: Target,
      rows: purpleCapLeaders.map((player) => ({
        id: player.id,
        name: player.name,
        teamId: player.teamId,
        value: `${player.wickets}`,
        detail: `Econ ${(player.runsConceded / Math.max(1, player.oversBowled)).toFixed(1)}`,
      })),
    },
    {
      id: "mvp",
      title: "MVP",
      subtitle: "Most valuable players",
      color: "#d69b24",
      icon: Crown,
      rows: mvpLeaders.map((player) => ({
        id: player.id,
        name: player.name,
        teamId: player.teamId,
        value: `${player.mvpPoints}`,
        detail: `${player.runs}R · ${player.wickets}W`,
      })),
    },
    {
      id: "emerging",
      title: "Emerging Player",
      subtitle: "Age 25 or under · Fewer than 25 prior games",
      color: "#0ea5e9",
      icon: Sparkles,
      rows: emergingPlayerLeaders.map((player) => ({
        id: player.id,
        name: player.name,
        teamId: player.teamId,
        value: `${player.emergingPoints}`,
        detail: `Age ${player.ageAtSeasonStart} · ${player.iplMatchesAtSeasonStart} prior`,
      })),
    },
  ];

  return (
    <div className="h-full min-h-0 overflow-y-auto pr-1 xl:overflow-hidden">
      <div className="grid min-h-full grid-cols-1 gap-4 xl:h-full xl:grid-rows-2">
        <div className="grid min-h-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AwardColumn board={awardBoards[0]} teams={teams} onOpenPlayer={onOpenPlayer} />
          <PerformanceList
            title="Highest Scores"
            subtitle={`${season} best individual innings`}
            color="#df6b20"
            icon={TrendingUp}
            performances={bestBattingPerformances}
            teams={teams}
            onOpenPlayer={onOpenPlayer}
          />
          <AwardColumn board={awardBoards[1]} teams={teams} onOpenPlayer={onOpenPlayer} />
          <PerformanceList
            title="Best Bowling Figures"
            subtitle={`${season} most destructive spells`}
            color="#16876f"
            icon={Target}
            performances={bestBowlingFigures}
            teams={teams}
            bowling
            onOpenPlayer={onOpenPlayer}
          />
        </div>
        <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <AwardColumn board={awardBoards[2]} teams={teams} onOpenPlayer={onOpenPlayer} />
          <AwardColumn board={awardBoards[3]} teams={teams} onOpenPlayer={onOpenPlayer} />
        </div>
      </div>
    </div>
  );
}
