"use client";

import { Award, Crown, Medal, Sparkles, Trophy } from "lucide-react";
import type { CSSProperties } from "react";
import type { LeagueHistorySeason, LeagueHistoryTeam } from "@/lib/data/leagueHistory";

type LegacyCategory = "titles" | "runnerUps" | "mvps" | "emerging" | "orangeCaps" | "purpleCaps";

interface LegacyEntry {
  season: number;
  name?: string;
}

interface LegacyRow {
  team: LeagueHistoryTeam;
  titles: LegacyEntry[];
  runnerUps: LegacyEntry[];
  mvps: LegacyEntry[];
  emerging: LegacyEntry[];
  orangeCaps: LegacyEntry[];
  purpleCaps: LegacyEntry[];
}

interface LeagueLegacyPageProps {
  seasons: LeagueHistorySeason[];
  teams: Record<string, LeagueHistoryTeam>;
}

const LINEAGE: Record<string, string> = { DD: "DC", KXIP: "PBKS" };
const canonicalTeamId = (teamId: string) => LINEAGE[teamId] ?? teamId;

const columns: Array<{ key: LegacyCategory; label: string; shortLabel: string; color: string }> = [
  { key: "titles", label: "Championship titles", shortLabel: "Titles", color: "#d69b24" },
  { key: "runnerUps", label: "Runner-up finishes", shortLabel: "Runners-up", color: "#94a3b8" },
  { key: "mvps", label: "Most Valuable Players", shortLabel: "MVPs", color: "#f59e0b" },
  { key: "emerging", label: "Emerging Players", shortLabel: "Emerging", color: "#0ea5e9" },
  { key: "orangeCaps", label: "Orange Caps", shortLabel: "Orange Caps", color: "#f97316" },
  { key: "purpleCaps", label: "Purple Caps", shortLabel: "Purple Caps", color: "#7e22ce" },
];

function buildRows(seasons: LeagueHistorySeason[], teams: Record<string, LeagueHistoryTeam>): LegacyRow[] {
  const ids = new Set<string>(Object.keys(teams).map(canonicalTeamId));
  seasons.forEach((season) => {
    ids.add(canonicalTeamId(season.championTeamId));
    ids.add(canonicalTeamId(season.runnerUpTeamId));
    ids.add(canonicalTeamId(season.mvp?.teamId ?? ""));
    ids.add(canonicalTeamId(season.emergingPlayer?.teamId ?? ""));
    ids.add(canonicalTeamId(season.orangeCap.teamId));
    ids.add(canonicalTeamId(season.purpleCap.teamId));
  });
  ids.delete("");

  return Array.from(ids).map((teamId) => {
    const team = teams[teamId] ?? { id: teamId, name: teamId, shortName: teamId, primaryColor: "#64748b", secondaryColor: "#ffffff" };
    const row: LegacyRow = { team, titles: [], runnerUps: [], mvps: [], emerging: [], orangeCaps: [], purpleCaps: [] };
    seasons.forEach((season) => {
      if (canonicalTeamId(season.championTeamId) === teamId) row.titles.push({ season: season.season });
      if (canonicalTeamId(season.runnerUpTeamId) === teamId) row.runnerUps.push({ season: season.season });
      if (season.mvp && canonicalTeamId(season.mvp.teamId) === teamId) row.mvps.push({ season: season.season, name: season.mvp.name });
      if (season.emergingPlayer && canonicalTeamId(season.emergingPlayer.teamId) === teamId) row.emerging.push({ season: season.season, name: season.emergingPlayer.name });
      if (canonicalTeamId(season.orangeCap.teamId) === teamId) row.orangeCaps.push({ season: season.season, name: season.orangeCap.name });
      if (canonicalTeamId(season.purpleCap.teamId) === teamId) row.purpleCaps.push({ season: season.season, name: season.purpleCap.name });
    });
    return row;
  }).sort((left, right) => (
    right.titles.length - left.titles.length
    || right.runnerUps.length - left.runnerUps.length
    || left.team.name.localeCompare(right.team.name)
  ));
}

function LegacyCell({ entries, label, color }: { entries: LegacyEntry[]; label: string; color: string }) {
  const groupedWinners = new Map<string, number[]>();
  entries.forEach((entry) => {
    if (!entry.name) return;
    groupedWinners.set(entry.name, [...(groupedWinners.get(entry.name) ?? []), entry.season]);
  });
  const details = entries.length === 0
    ? [`No ${label.toLowerCase()} recorded`]
    : groupedWinners.size > 0
      ? Array.from(groupedWinners.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, years]) => `${name} — ${years.sort((left, right) => left - right).join(", ")}`)
      : [entries.map((entry) => entry.season).sort((left, right) => left - right).join(", ")];
  return (
    <div className="group relative flex h-full items-center justify-center focus-within:z-50 hover:z-50">
      <button type="button" className="flex h-7 min-w-10 items-center justify-center rounded-md border border-transparent font-anton text-[17px] leading-none transition-colors hover:border-border hover:bg-bg focus-visible:border-accent focus-visible:outline-none" style={{ color }} aria-label={`${entries.length} ${label}. ${details.join(", ")}`}>
        {entries.length}
      </button>
      <div role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+5px)] left-1/2 z-50 hidden w-56 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-left shadow-2xl group-hover:block group-focus-within:block">
        <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.16em]" style={{ color }}>{label}</p>
        <div className="mt-2 space-y-1">
          {details.map((detail) => <p key={detail} className="text-[10px] font-semibold text-text-primary">{detail}</p>)}
        </div>
      </div>
    </div>
  );
}

export default function LeagueLegacyPage({ seasons, teams }: LeagueLegacyPageProps) {
  const rows = buildRows(seasons, teams);
  const totalHonours = rows.reduce((sum, row) => sum + columns.reduce((columnSum, column) => columnSum + row[column.key].length, 0), 0);
  const firstSeason = Math.min(...seasons.map((season) => season.season));
  const latestSeason = Math.max(...seasons.map((season) => season.season));

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[500px] flex-col overflow-hidden rounded-xl border-2 border-border bg-surface shadow-sm">
      <header className="relative flex h-[78px] shrink-0 items-center justify-between overflow-hidden border-b border-border px-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(214,155,36,.16),transparent_38%)]" />
        <div className="relative flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg border border-warning/30 bg-warning/10 text-warning"><Crown size={20} /></span><div><p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.2em] text-warning">League archive</p><h2 className="font-anton text-2xl uppercase leading-none text-text-primary">Franchise Legacy</h2><p className="mt-1 text-[9px] text-text-secondary">Every championship finish and individual season honour, by franchise lineage.</p></div></div>
        <div className="relative grid grid-cols-3 gap-2 text-center"><div className="rounded-lg border border-border bg-bg/70 px-4 py-2"><b className="block font-anton text-xl leading-none text-text-primary">{rows.length}</b><span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Teams</span></div><div className="rounded-lg border border-border bg-bg/70 px-4 py-2"><b className="block font-anton text-xl leading-none text-text-primary">{seasons.length}</b><span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Seasons</span></div><div className="rounded-lg border border-border bg-bg/70 px-4 py-2"><b className="block font-anton text-xl leading-none text-warning">{totalHonours}</b><span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Honours</span></div></div>
      </header>

      <div className="grid shrink-0 grid-cols-4 border-b border-border bg-bg/45">
        {[{ icon: Trophy, label: "Archive span", value: `${firstSeason}–${latestSeason}` }, { icon: Medal, label: "Champions", value: seasons.length }, { icon: Award, label: "Individual awards", value: seasons.reduce((sum, season) => sum + 2 + Number(Boolean(season.mvp)) + Number(Boolean(season.emergingPlayer)), 0) }, { icon: Sparkles, label: "Live career seasons", value: seasons.filter((season) => season.source === "career").length }].map(({ icon: Icon, label, value }) => <div key={label} className="flex items-center justify-center gap-2 border-r border-border px-3 py-2 last:border-r-0"><Icon size={13} className="text-accent" /><span><b className="block font-anton text-sm leading-none text-text-primary">{value}</b><span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">{label}</span></span></div>)}
      </div>

      <div className="relative min-h-0 flex-1 px-4 pb-3 pt-2">
        <div className="grid h-full grid-rows-[30px_repeat(var(--legacy-rows),minmax(0,1fr))]" style={{ "--legacy-rows": rows.length } as CSSProperties}>
          <div className="grid grid-cols-[minmax(190px,1.45fr)_repeat(6,minmax(82px,1fr))] items-center border-b-2 border-border bg-bg/60 px-2">
            <span className="font-space-mono text-[8px] font-bold uppercase tracking-[0.16em] text-text-secondary">Franchise</span>
            {columns.map((column) => <span key={column.key} className="text-center font-space-mono text-[7px] font-bold uppercase tracking-wide text-text-secondary">{column.shortLabel}</span>)}
          </div>
          {rows.map((row) => <div key={row.team.id} className="grid min-h-0 grid-cols-[minmax(190px,1.45fr)_repeat(6,minmax(82px,1fr))] items-center border-b border-border/60 px-2 last:border-b-0 hover:bg-bg/55"><div className="flex min-w-0 items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded text-[8px] font-black" style={{ backgroundColor: row.team.primaryColor, color: row.team.secondaryColor }}>{row.team.shortName.slice(0, 4)}</span><span className="truncate text-[10px] font-bold text-text-primary">{row.team.name}</span></div>{columns.map((column) => <LegacyCell key={column.key} entries={row[column.key]} label={column.label} color={column.color} />)}</div>)}
        </div>
      </div>
    </div>
  );
}
