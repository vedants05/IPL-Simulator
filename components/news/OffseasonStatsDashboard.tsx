"use client";

import { useEffect, useMemo, useState } from "react";
import type { Team } from "@/lib/types";
import type { OffseasonPlayerStats, OffseasonStatsPeriod } from "@/lib/logic/offseasonStats";
import {
  offseasonBattingAverage,
  offseasonBattingStrikeRate,
  offseasonBowlingAverage,
  offseasonBowlingEconomy,
  offseasonBowlingStrikeRate,
  offseasonOvers,
} from "@/lib/logic/offseasonStats";

type Category = "International" | "Domestic" | "Franchises";
type Discipline = "batting" | "bowling";

const CATEGORIES: Category[] = ["International", "Domestic", "Franchises"];
const PAGE_SIZE = 11;

function categoryFor(row: OffseasonPlayerStats): Category {
  if (row.competitionLevel.includes("International")) return "International";
  return row.nationality === "Indian" ? "Domestic" : "Franchises";
}

export default function OffseasonStatsDashboard({ period, teams, layout, onOpenPlayer }: {
  period: OffseasonStatsPeriod | null;
  teams: Record<string, Team>;
  layout: "cricinfo" | "cricbuzz";
  onOpenPlayer?: (playerId: string) => void;
}) {
  const [category, setCategory] = useState<Category | null>(null);
  const [discipline, setDiscipline] = useState<Discipline>("batting");
  const [search, setSearch] = useState("");
  const [nationality, setNationality] = useState<"all" | "Indian" | "Overseas">("all");
  const [page, setPage] = useState(0);
  const accent = layout === "cricbuzz" ? "#009270" : "#038dcc";
  const rows = useMemo(() => Object.values(period?.players ?? {}), [period]);
  const categoryRows = useMemo(() => Object.fromEntries(CATEGORIES.map((item) => [item, rows.filter((row) => categoryFor(row) === item)])) as Record<Category, OffseasonPlayerStats[]>, [rows]);
  const visibleRows = useMemo(() => {
    if (!category) return [];
    const query = search.trim().toLocaleLowerCase("en-GB");
    return categoryRows[category]
      .filter((row) => nationality === "all" || row.nationality === nationality)
      .filter((row) => !query || row.playerName.toLocaleLowerCase("en-GB").includes(query))
      .filter((row) => discipline === "batting" ? row.innings > 0 : row.bowlingBalls > 0)
      .sort((left, right) => discipline === "batting"
        ? right.runs - left.runs || right.matches - left.matches
        : right.wickets - left.wickets || left.runsConceded - right.runsConceded);
  }, [category, categoryRows, discipline, nationality, search]);
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const pagedRows = visibleRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => setPage(0), [category, discipline, nationality, search]);

  if (!period) return <section className="absolute inset-x-0 bottom-0 top-10 z-40 flex items-center justify-center overflow-hidden bg-[#f2f4f7] p-5 text-[#17202a]"><div className="border border-slate-200 bg-white px-8 py-14 text-center"><h2 className="text-lg font-black uppercase">No off-season period generated yet</h2><p className="mt-2 text-xs text-slate-500">Statistics appear after an IPL season is archived.</p></div></section>;

  return (
    <section className={`absolute inset-x-0 bottom-0 top-10 z-40 flex flex-col overflow-hidden p-4 ${layout === "cricbuzz" ? "bg-[#f5f5f5] text-[#222]" : "bg-[#f2f4f7] text-[#17202a]"}`}>
      <header className="flex shrink-0 items-center justify-between border border-slate-200 bg-white px-4 py-2.5">
        <div className="min-w-0"><p className="text-[8px] font-extrabold uppercase tracking-[0.18em]" style={{ color: accent }}>Off-season T20 statistics</p><h2 className="mt-0.5 truncate text-lg font-black">{period.fromSeason} IPL end → {period.toSeason} IPL start</h2><p className="text-[10px] text-slate-500">Separate from all IPL records and career totals.</p></div>
        <div className="ml-4 shrink-0 px-3 py-1.5 text-center text-white" style={{ backgroundColor: accent }}><div className="text-base font-black">{period.toSeason}</div><div className="text-[7px] font-bold uppercase">IPL season</div></div>
      </header>

      {!category ? (
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 pt-4">
          {CATEGORIES.map((item) => {
            const records = categoryRows[item];
            const batting = [...records].filter((row) => row.innings > 0).sort((a, b) => b.runs - a.runs).slice(0, 5);
            const bowling = [...records].filter((row) => row.bowlingBalls > 0).sort((a, b) => b.wickets - a.wickets).slice(0, 5);
            return <button key={item} type="button" onClick={() => setCategory(item)} className="flex min-h-0 flex-col overflow-hidden border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="shrink-0 border-b border-slate-200 pb-3"><p className="text-[8px] font-bold uppercase text-slate-400">{records.length} players</p><h3 className="mt-1 text-xl font-black uppercase" style={{ color: accent }}>{item}</h3><p className="mt-1 text-[10px] text-slate-500">Open complete batting and bowling records</p></div>
              <div className="grid min-h-0 flex-1 grid-rows-2 gap-3 pt-3">
                {[{ label: "Batting leaders", list: batting, value: (row: OffseasonPlayerStats) => `${row.runs} runs` }, { label: "Bowling leaders", list: bowling, value: (row: OffseasonPlayerStats) => `${row.wickets} wkts` }].map((board) => <div key={board.label} className="min-h-0 overflow-hidden"><h4 className="mb-1.5 text-[8px] font-black uppercase tracking-wide text-slate-500">{board.label}</h4>{board.list.map((row, index) => <div key={row.playerId} className="flex h-6 items-center gap-2 border-t border-slate-100 text-[10px]"><span className="w-4 text-slate-400">{index + 1}</span><span className="min-w-0 flex-1 truncate font-bold">{row.playerName}</span><span className="font-bold" style={{ color: accent }}>{board.value(row)}</span></div>)}</div>)}
              </div>
              <span className="mt-2 shrink-0 text-[8px] font-black uppercase" style={{ color: accent }}>View {item} statistics →</span>
            </button>;
          })}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col pt-3">
          <div className="flex shrink-0 items-center gap-2 border border-slate-200 bg-white p-2">
            <button type="button" onClick={() => setCategory(null)} className="h-8 border border-slate-300 px-3 text-[8px] font-black uppercase">← Categories</button>
            <div className="mr-auto ml-1"><h3 className="text-base font-black uppercase" style={{ color: accent }}>{category}</h3><p className="text-[8px] font-bold uppercase text-slate-400">{visibleRows.length} {discipline} records</p></div>
            {(["batting", "bowling"] as Discipline[]).map((item) => <button key={item} type="button" onClick={() => setDiscipline(item)} className="h-8 px-4 text-[8px] font-black uppercase text-white" style={{ backgroundColor: discipline === item ? accent : "#94a3b8" }}>{item}</button>)}
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player" className="h-8 w-40 border border-slate-300 px-2 text-[10px] outline-none" />
            <select value={nationality} onChange={(event) => setNationality(event.target.value as typeof nationality)} className="h-8 border border-slate-300 px-2 text-[9px] font-bold"><option value="all">All players</option><option value="Indian">Indian</option><option value="Overseas">Overseas</option></select>
          </div>
          <div className="mt-2 min-h-0 flex-1 overflow-hidden border border-slate-200 bg-white">
            <table className="h-full w-full table-fixed text-[10px]">
              <thead className="h-8 bg-slate-50 text-[7px] font-bold uppercase text-slate-500"><tr>{discipline === "batting" ? <><th className="w-8">#</th><th className="text-left">Player</th><th className="w-28 text-left">Status</th><th>Mat</th><th>Inn</th><th>Runs</th><th>Balls</th><th>NO</th><th>HS</th><th>Avg</th><th>SR</th></> : <><th className="w-8">#</th><th className="text-left">Player</th><th className="w-28 text-left">Status</th><th>Mat</th><th>Overs</th><th>Runs</th><th>Wkts</th><th>Best</th><th>Avg</th><th>Econ</th><th>SR</th></>}</tr></thead>
              <tbody>{pagedRows.map((row, index) => <tr key={row.playerId} className="border-t border-slate-100 text-center hover:bg-slate-50"><td className="text-slate-400">{page * PAGE_SIZE + index + 1}</td><td className="truncate text-left"><button type="button" onClick={() => onOpenPlayer?.(row.playerId)} className="truncate font-bold hover:underline">{row.playerName}</button><span className="ml-1 text-[7px] font-bold uppercase text-slate-400">{row.country}</span></td><td className="truncate text-left text-[8px] font-bold uppercase text-slate-500">{row.selectionStatus}</td>{discipline === "batting" ? <><td>{row.matches}</td><td>{row.innings}</td><td className="font-black" style={{ color: accent }}>{row.runs}</td><td>{row.balls}</td><td>{row.notOuts}</td><td>{row.highestScore}</td><td>{offseasonBattingAverage(row)?.toFixed(2) ?? "—"}</td><td>{offseasonBattingStrikeRate(row)?.toFixed(2) ?? "—"}</td></> : <><td>{row.matches}</td><td>{offseasonOvers(row.bowlingBalls)}</td><td>{row.runsConceded}</td><td className="font-black" style={{ color: accent }}>{row.wickets}</td><td>{row.bestBowlingWickets}/{row.bestBowlingRuns}</td><td>{offseasonBowlingAverage(row)?.toFixed(2) ?? "—"}</td><td>{offseasonBowlingEconomy(row)?.toFixed(2) ?? "—"}</td><td>{offseasonBowlingStrikeRate(row)?.toFixed(2) ?? "—"}</td></>}</tr>)}</tbody>
            </table>
            {pagedRows.length === 0 && <div className="flex h-full items-center justify-center text-xs text-slate-500">No records match these filters.</div>}
          </div>
          <div className="mt-2 flex h-8 shrink-0 items-center justify-between border border-slate-200 bg-white px-3 text-[8px] font-bold uppercase text-slate-500"><span>Rows {visibleRows.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, visibleRows.length)} of {visibleRows.length}</span><div className="flex gap-1"><button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="border border-slate-300 px-3 py-1 disabled:opacity-30">Previous</button><span className="px-2 py-1">{page + 1}/{pageCount}</span><button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="border border-slate-300 px-3 py-1 disabled:opacity-30">Next</button></div></div>
        </div>
      )}
    </section>
  );
}
