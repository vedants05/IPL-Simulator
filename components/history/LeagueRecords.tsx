"use client";

import { ChevronRight, CircleDot, Medal, Sparkles, Trophy } from "lucide-react";

import {
  OTHER_LEAGUE_RECORDS,
  RETIRED_MAJOR_RECORDS,
  type MajorRecordCategoryId,
  type RetiredRecordEntry,
  qualifiesForBattingAverageRecord,
} from "@/lib/data/leagueRecords";
import { LEAGUE_HISTORY_TEAMS } from "@/lib/data/leagueHistory";
import type { Player, Team } from "@/lib/types";

interface LeagueRecordsProps {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  onOpenPlayer: (playerId: string) => void;
}

interface ResolvedRecordEntry {
  name: string;
  value: number;
  teamId: string | null;
  playerId: string | null;
  retired: boolean;
}

interface MajorRecordColumn {
  id: MajorRecordCategoryId;
  title: string;
  qualifier: string;
  accent: string;
  icon: typeof Trophy;
  format: (value: number) => string;
  liveValue: (player: Player) => number;
  qualifies: (player: Player) => boolean;
  retiredQualifies?: (entry: RetiredRecordEntry) => boolean;
}

const normalizeName = (name: string) => name.toLocaleLowerCase("en-GB").replace(/[^a-z0-9]/g, "");
const integer = (value: number) => Math.round(value).toLocaleString("en-IN");

export default function LeagueRecords({ players, teams, onOpenPlayer }: LeagueRecordsProps) {
  const playerList = Object.values(players).filter((player) => player.iplStats.matches > 0);
  const playersByName = new Map(playerList.map((player) => [normalizeName(player.name), player]));

  const columnDefinitions: MajorRecordColumn[] = [
    {
      id: "appearances",
      title: "Most Games",
      qualifier: "Career appearances",
      accent: "#2779d8",
      icon: Medal,
      format: integer,
      liveValue: (player) => player.iplStats.matches,
      qualifies: () => true,
    },
    {
      id: "runs",
      title: "Most IPL Runs",
      qualifier: "Career aggregate",
      accent: "#df6b20",
      icon: Trophy,
      format: integer,
      liveValue: (player) => player.iplStats.runs,
      qualifies: (player) => player.iplStats.runs > 0,
    },
    {
      id: "wickets",
      title: "Most IPL Wickets",
      qualifier: "Career aggregate",
      accent: "#7344b5",
      icon: CircleDot,
      format: integer,
      liveValue: (player) => player.iplStats.wickets,
      qualifies: (player) => player.iplStats.wickets > 0,
    },
    {
      id: "batting-average",
      title: "Batting Average",
      qualifier: "50 games · 1,000 runs",
      accent: "#16876f",
      icon: Sparkles,
      format: (value) => value.toFixed(2),
      liveValue: (player) => player.iplStats.battingAverage,
      qualifies: (player) => qualifiesForBattingAverageRecord(player.iplStats),
      retiredQualifies: (entry) => qualifiesForBattingAverageRecord({
        matches: entry.matches ?? 0,
        runs: entry.runs ?? 0,
        battingAverage: entry.value,
      }),
    },
  ];

  const resolveEntries = (column: MajorRecordColumn): ResolvedRecordEntry[] => {
    const liveEntries = playerList
      .filter(column.qualifies)
      .map((player) => ({
        name: player.name,
        value: column.liveValue(player),
        teamId: player.currentTeamId,
        playerId: player.id,
        retired: false,
      }));
    const liveNames = new Set(liveEntries.map((entry) => normalizeName(entry.name)));
    const retiredEntries = RETIRED_MAJOR_RECORDS[column.id]
      .filter((entry) => column.retiredQualifies?.(entry) ?? true)
      .filter((entry) => !liveNames.has(normalizeName(entry.name)))
      .map((entry) => ({ ...entry, playerId: null, retired: true }));

    return [...liveEntries, ...retiredEntries]
      .sort((left, right) => right.value - left.value)
      .slice(0, 5);
  };

  const getTeam = (teamId: string | null) => {
    if (!teamId) return null;
    return teams[teamId] ?? LEAGUE_HISTORY_TEAMS[teamId] ?? null;
  };

  return (
    <section className="flex h-[calc(100vh-200px)] min-h-[500px] flex-col overflow-hidden border-2 border-border bg-surface">
      <header className="relative flex shrink-0 items-center justify-between overflow-hidden border-b-2 border-[#aac0da] bg-[#e9eff7] px-5 py-3 text-[#172337] dark:border-[#4f79b7]/45 dark:bg-[#10151e] dark:text-white">
        <div className="pointer-events-none absolute -left-16 -top-20 h-44 w-44 rounded-full bg-[#5c8cc6]/15 blur-3xl dark:bg-[#245da8]/30" />
        <div className="pointer-events-none absolute -right-12 -top-20 h-44 w-44 rounded-full bg-[#c8913f]/12 blur-3xl dark:bg-[#9b6823]/22" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#a7751c]/40 bg-white/45 dark:border-[#d6ad55]/45 dark:bg-[#d6ad55]/10">
            <Trophy size={20} className="text-[#946514] dark:text-[#e7c576]" />
          </div>
          <div>
            <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.26em] text-[#326da9] dark:text-[#83aee8]">League archive</p>
            <h3 className="mt-0.5 font-anton text-[24px] uppercase leading-none tracking-wide">IPL Record Book</h3>
          </div>
        </div>
        <p className="relative hidden max-w-xl text-right text-[10px] leading-relaxed text-[#607087] dark:text-white/50 lg:block">
          Live database leaders combined with retired all-time greats. Rate records use qualification thresholds.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_17rem] gap-3 bg-[linear-gradient(180deg,rgba(30,60,100,0.035),transparent_18rem)] p-3">
        <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-3">
          {columnDefinitions.map((column) => {
            const Icon = column.icon;
            const entries = resolveEntries(column);
            return (
              <article key={column.id} className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border border-border bg-surface shadow-sm">
                <div className="flex items-center justify-between border-b border-[#16130f]/10 px-3 py-2">
                  <div className="min-w-0">
                    <h4 className="truncate font-anton text-[16px] uppercase leading-none text-text-primary">{column.title}</h4>
                    <p className="mt-1 truncate font-space-mono text-[7px] font-bold uppercase text-text-secondary">{column.qualifier}</p>
                  </div>
                  <span className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${column.accent}16`, color: column.accent }}>
                    <Icon size={13} />
                  </span>
                </div>

                <div className="grid min-h-0 grid-rows-5">
                  {entries.map((entry, index) => {
                    const team = getTeam(entry.teamId);
                    const content = (
                      <>
                        <span className="font-anton text-[14px]" style={{ color: index === 0 ? column.accent : "var(--text-secondary)" }}>{index + 1}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] font-semibold text-text-primary">{entry.name}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                            {team && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: team.primaryColor }} />}
                            {entry.retired ? "Retired" : entry.teamId ? team?.shortName ?? entry.teamId : "Free agent"}
                          </span>
                        </span>
                        <span className={`font-space-mono font-bold ${index === 0 ? "text-[15px]" : "text-[11px]"}`} style={{ color: index === 0 ? column.accent : "var(--ink)" }}>
                          {column.format(entry.value)}
                        </span>
                        {entry.playerId ? <ChevronRight size={12} className="text-text-secondary/60" /> : <span />}
                      </>
                    );
                    const rowClass = `grid min-h-0 grid-cols-[1.5rem_minmax(0,1fr)_auto_0.75rem] items-center gap-2 border-b border-[#16130f]/10 px-3 text-left last:border-b-0 ${index === 0 ? "bg-black/[0.025] dark:bg-white/[0.025]" : ""}`;

                    return entry.playerId ? (
                      <button key={`${column.id}-${entry.name}`} type="button" onClick={() => onOpenPlayer(entry.playerId!)} className={`${rowClass} hover:bg-black/[0.04] dark:hover:bg-white/[0.04]`}>
                        {content}
                      </button>
                    ) : (
                      <div key={`${column.id}-${entry.name}`} className={rowClass}>{content}</div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>

        <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border border-border bg-surface shadow-sm">
          <div className="border-b border-[#16130f]/10 px-3 py-2">
            <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.2em] text-[#9b6823]">Across every era</p>
            <h4 className="mt-1 font-anton text-[16px] uppercase leading-none text-text-primary">Other Records</h4>
          </div>
          <div className="grid min-h-0 grid-rows-8">
            {OTHER_LEAGUE_RECORDS.map((record) => {
              const linkedPlayer = record.playerNames
                ?.map((name) => playersByName.get(normalizeName(name)))
                .find((player): player is Player => Boolean(player));
              const content = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-space-mono text-[7px] font-bold uppercase tracking-wide text-text-secondary">{record.label}</span>
                    <span className="mt-0.5 block truncate text-[10px] font-semibold text-text-primary">{record.holder}</span>
                    <span className="mt-0.5 block truncate font-space-mono text-[7px] text-text-secondary">{record.detail}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-anton text-[17px] leading-none text-[#9b6823]">{record.value}</span>
                    {linkedPlayer && <ChevronRight size={11} className="ml-auto mt-1 text-text-secondary/60" />}
                  </span>
                </>
              );
              const rowClass = "flex min-h-0 items-center gap-2 border-b border-[#16130f]/10 px-3 py-1.5 text-left last:border-b-0";
              return linkedPlayer ? (
                <button key={record.id} type="button" onClick={() => onOpenPlayer(linkedPlayer.id)} className={`${rowClass} hover:bg-black/[0.035] dark:hover:bg-white/[0.035]`}>{content}</button>
              ) : (
                <div key={record.id} className={rowClass}>{content}</div>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}
