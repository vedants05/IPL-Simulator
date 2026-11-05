"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Info, Search } from "lucide-react";
import { readableOn } from "@/lib/theme/teams";
import type { Player, Team } from "@/lib/types";
import type { PlayerAnalysisFixture } from "@/lib/logic/playerAnalysisMetrics";
import {
  SEASON_RANKING_METRICS, buildSeasonRankingEntries, rankSeasonEntries,
  type SeasonStatsRecord, type StatsDiscipline,
} from "@/lib/logic/seasonPlayerRankings";

interface Props {
  fixtures: PlayerAnalysisFixture[];
  players: Record<string, Player>;
  teams: Record<string, Team>;
  seasonStats: Record<string, SeasonStatsRecord>;
  season: number;
  userTeamId: string;
  onOpenPlayer: (id: string) => void;
}
const display = (value: number | null, unit = "") => value === null || !Number.isFinite(value) ? "—" : `${value.toLocaleString("en-GB", { maximumFractionDigits: 2 })}${unit}`;

export default function SeasonPlayerStatsPage({ fixtures, players, teams, seasonStats, season, userTeamId, onOpenPlayer }: Props) {
  const [discipline, setDiscipline] = useState<StatsDiscipline>("batting");
  const [selection, setSelection] = useState({ batting: "runs", bowling: "wickets", fielding: "catches" });
  const [mode, setMode] = useState<"players" | "teams">("players");
  const [metricSearch, setMetricSearch] = useState("");
  const [entitySearch, setEntitySearch] = useState("");
  const [qualifiedOnly, setQualifiedOnly] = useState(true);
  const data = useMemo(() => buildSeasonRankingEntries(fixtures, players, seasonStats), [fixtures, players, seasonStats]);
  const metric = SEASON_RANKING_METRICS.find(item => item.discipline === discipline && item.key === selection[discipline])!;
  const sections = useMemo(() => {
    const groups = new Map<string, typeof SEASON_RANKING_METRICS>();
    for (const item of SEASON_RANKING_METRICS) {
      if (item.discipline !== discipline || !item.label.toLowerCase().includes(metricSearch.trim().toLowerCase())) continue;
      const group = groups.get(item.section) ?? [];
      group.push(item);
      groups.set(item.section, group);
    }
    return Array.from(groups.entries());
  }, [discipline, metricSearch]);
  const rankings = useMemo(() => rankSeasonEntries(mode === "players" ? data.players : data.teams, metric, qualifiedOnly), [data, mode, metric, qualifiedOnly]);
  const rows = rankings.map((row, index) => ({ ...row, rank: index > 0 && row.value === rankings[index - 1].value ? rankings.findIndex(r => r.value === row.value) + 1 : index + 1 }))
    .filter(({ entry }) => `${mode === "teams" ? teams[entry.id]?.name ?? entry.name : entry.name} ${teams[entry.teamId]?.name ?? entry.teamId}`.toLowerCase().includes(entitySearch.trim().toLowerCase()));
  const buttonStyle = (selected: boolean) => selected ? "border-text-primary bg-text-primary text-bg" : "border-transparent text-text-secondary hover:border-border hover:text-text-primary";
  const rankingInfo = `${season} season · ${discipline}. ${metric.lowerBetter ? "Lowest first" : "Highest first"}. Minimum: ${metric.minimum}.${mode === "teams" ? ` Team rates use combined totals${discipline === "batting" ? "; batting runs exclude extras" : ""}.` : ""}${metric.detail ? ` Delivery-based statistics cover ${data.detailedMatches} of ${data.scoredMatches} recorded matches.` : ""}`;

  return (
    <section data-ranking-mode={mode} data-discipline={discipline} className="season-player-stats grid h-full min-h-0 flex-1 grid-cols-[minmax(300px,32%)_minmax(0,1fr)] gap-3 p-3" aria-label="Player Stats">
      <aside className="flex min-h-0 min-w-0 flex-col gap-2">
        <div className="flex shrink-0 gap-1 rounded border border-border bg-surface p-1" role="group" aria-label="Player stats category">
          {(["batting", "bowling", "fielding"] as const).map(category => (
            <button key={category} type="button" data-category={category} aria-pressed={discipline === category} onClick={() => { setDiscipline(category); setMetricSearch(""); }} className={`min-w-0 flex-1 rounded-sm border px-3 py-2 font-space-mono text-[14px] font-bold uppercase tracking-wide transition-colors ${buttonStyle(discipline === category)}`}>{category}</button>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-border bg-surface">
          <div className="stats-sidebar-heading shrink-0 border-b border-border p-3">
            <h3 className="font-anton text-[17px] uppercase text-text-primary">{discipline} rankings</h3>
            <label className="mt-2 flex items-center gap-2 rounded border border-border bg-bg px-2 py-2 text-text-secondary">
              <Search size={13} /><input aria-label="Find a statistic" value={metricSearch} onChange={event => setMetricSearch(event.target.value)} placeholder="Find a statistic…" className="min-w-0 flex-1 bg-transparent text-[12px] text-text-primary outline-none" />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2" aria-label={`${discipline} statistics`}>
            {sections.map(([title, items]) => (
              <div key={title} className="mb-3 last:mb-0">
                <h4 className="px-2 pb-1 pt-2 font-space-mono text-[9px] font-bold uppercase tracking-wide text-text-secondary">{title}</h4>
                {items.map(item => <button key={item.key} type="button" data-statistic aria-pressed={metric.key === item.key} onClick={() => setSelection(current => ({ ...current, [discipline]: item.key }))} className={`my-0.5 flex w-full items-center justify-between gap-2 rounded border px-3 py-2 text-left text-[13px] leading-snug transition-colors ${metric.key === item.key ? "border-accent/50 bg-accent/10 font-bold text-text-primary" : "border-transparent text-text-secondary hover:border-border hover:bg-surface2 hover:text-text-primary"}`}><span>{item.label}</span>{metric.key === item.key && <ChevronRight size={14} className="shrink-0 text-accent" />}</button>)}
              </div>
            ))}
            {!sections.length && <p className="p-3 text-[12px] text-text-secondary">No matching statistics.</p>}
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded border border-border bg-surface">
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-1.5" data-ranking-toolbar>
          <h2 className="min-w-0 flex-1 truncate font-anton text-[18px] leading-tight text-text-primary" title={mode === "teams" && metric.key === "highestScore" ? "Highest team batting total" : metric.label}>{mode === "teams" && metric.key === "highestScore" ? "Highest team batting total" : metric.label}</h2>
          <span tabIndex={0} title={rankingInfo} aria-label={rankingInfo} className="shrink-0 text-text-secondary"><Info size={13} /></span>
          <label className="flex w-[180px] min-w-0 items-center gap-1.5 rounded border border-border bg-bg px-2 py-1 text-text-secondary"><Search size={12} className="shrink-0" /><input aria-label="Search rankings" value={entitySearch} onChange={event => setEntitySearch(event.target.value)} placeholder={mode === "players" ? "Search player or team…" : "Search team…"} className="w-full min-w-0 bg-transparent text-[11px] text-text-primary outline-none" /></label>
          <div className="flex shrink-0 gap-0.5 rounded border border-border p-0.5" role="group" aria-label="Rank players or teams">{(["players", "teams"] as const).map(option => <button key={option} type="button" aria-pressed={mode === option} onClick={() => setMode(option)} className={`rounded-sm border px-2 py-1 font-space-mono text-[9px] font-bold uppercase ${buttonStyle(mode === option)}`}>{option}</button>)}</div>
          <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[10px] text-text-secondary"><input type="checkbox" checked={qualifiedOnly} onChange={event => setQualifiedOnly(event.target.checked)} className="accent-[var(--accent)]" />Qualified only</label>
        </header>
        <div className={`min-h-0 flex-1 ${mode === "teams" ? "overflow-hidden" : "overflow-auto"}`}>
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="sticky top-0 z-10 bg-surface2 font-space-mono text-[9px] uppercase text-text-secondary"><tr><th className="p-3">Rank</th><th className="p-3">{mode === "players" ? "Player / team" : "Team"}</th><th className="p-3 text-right">Matches</th>{discipline === "batting" ? <><th className="p-3 text-right">Runs</th><th className="p-3 text-right">Balls</th><th className="p-3 text-right">SR</th></> : discipline === "bowling" ? <><th className="p-3 text-right">Wkts</th><th className="p-3 text-right">Balls</th><th className="p-3 text-right">Econ</th></> : <><th className="p-3 text-right">Catches</th><th className="p-3 text-right">Stumpings</th><th className="p-3 text-right">Run-outs</th></>}<th className="max-w-[160px] p-3 text-right text-accent">{metric.label}</th></tr></thead>
            <tbody>{rows.map(({ entry, value, rank, qualified }) => <tr key={entry.id} data-podium={rank <= 3 ? rank : undefined} data-user-team={entry.teamId === userTeamId || entry.id === userTeamId} className={`border-t border-border/50 ${entry.teamId === userTeamId ? "bg-accent/5" : ""}`}><td className="p-3 font-space-mono font-bold text-accent"><span className="stats-rank">{rank}</span></td><td className="min-w-[150px] p-3">{mode === "players" ? <><button type="button" onClick={() => onOpenPlayer(entry.id)} className="inline-flex items-center gap-2 text-left font-semibold text-text-primary hover:text-accent"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full ring-1 ring-text-primary/25" style={{ backgroundColor: teams[entry.teamId]?.primaryColor ?? "#5b6472" }} />{entry.name}</button><div className="mt-0.5 text-[10px] text-text-secondary">{teams[entry.teamId]?.name ?? entry.teamId}</div></> : <span className="inline-flex max-w-full items-center rounded border border-white/20 px-3 py-1.5 text-[12px] font-bold leading-snug shadow-sm" style={{ backgroundColor: teams[entry.id]?.primaryColor ?? "#5b6472", color: readableOn(teams[entry.id]?.primaryColor ?? "#5b6472"), borderLeft: `4px solid ${teams[entry.id]?.secondaryColor ?? "#ffffff"}`, overflowWrap: "anywhere" }}>{teams[entry.id]?.name ?? entry.name}</span>}{!qualified && <span className="mt-1 block text-[9px] text-amber-500">Below minimum</span>}</td><td className="p-3 text-right font-space-mono text-text-secondary">{entry.totals.matches}</td>{discipline === "batting" ? <><td className="p-3 text-right">{entry.totals.runs}</td><td className="p-3 text-right">{entry.totals.balls}</td><td className="p-3 text-right">{display(entry.totals.balls ? entry.totals.runs * 100 / entry.totals.balls : null)}</td></> : discipline === "bowling" ? <><td className="p-3 text-right">{entry.totals.wickets}</td><td className="p-3 text-right">{entry.totals.bowlBalls}</td><td className="p-3 text-right">{display(entry.totals.bowlBalls ? entry.totals.conceded * 6 / entry.totals.bowlBalls : null)}</td></> : <><td className="p-3 text-right">{entry.catches}</td><td className="p-3 text-right">{entry.stumpings}</td><td className="p-3 text-right">{entry.runOuts}</td></>}<td className="p-3 text-right font-space-mono font-bold text-accent">{display(value, metric.unit)}</td></tr>)}</tbody>
          </table>
          {!rows.length && <div className="p-10 text-center text-[13px] text-text-secondary">{entitySearch ? "No matching players or teams." : data.scoredMatches ? "No recorded performances meet this statistic’s requirements yet." : "Rankings will appear after matches have been played."}</div>}
        </div>
        <footer className="shrink-0 border-t border-border px-4 py-2 font-space-mono text-[9px] text-text-secondary">{rows.length} {mode} · {data.scoredMatches} recorded matches</footer>
      </div>
    </section>
  );
}
