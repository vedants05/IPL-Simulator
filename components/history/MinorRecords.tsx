"use client";
import { useMemo, useState } from "react";
import { MINOR_RECORDS } from "@/lib/data/minorRecords";

const labels: Record<string, string> = {
  all: "All records", batting_position: "Batting positions", partnership_position: "Partnerships",
  season_batting: "Season batting", season_bowling: "Season bowling", milestone: "Milestones",
  fielding: "Fielding", team: "Team records",
};

export default function MinorRecords() {
  const [category, setCategory] = useState("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const records = useMemo(() => MINOR_RECORDS.filter((record) => (
    (category === "all" || record.category === category) && (!verifiedOnly || record.verified)
  )), [category, verifiedOnly]);
  return (
    <section className="compact-history min-h-[calc(100vh-200px)] bg-surface px-5 py-5 text-text-primary sm:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div><p className="font-space-mono text-[9px] font-bold uppercase tracking-[0.18em] text-accent">History archive</p><h1 className="mt-1 font-anton text-2xl uppercase">Minor Records</h1><p className="mt-1 text-xs text-text-secondary">Small, specialist IPL records. Each entry is editable data.</p></div>
        <label className="flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} /> Verified only</label>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">{Object.entries(labels).map(([key, label]) => <button key={key} type="button" onClick={() => setCategory(key)} className={`rounded border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${category === key ? "border-accent bg-accent/10 text-accent" : "border-border text-text-secondary hover:text-text-primary"}`}>{label}</button>)}</div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{records.map((record) => <article key={record.id} className="rounded border border-border bg-bg p-4"><p className="font-space-mono text-[9px] font-bold uppercase tracking-wide text-text-secondary">{labels[record.category]}</p><h2 className="mt-2 text-sm font-bold text-text-primary">{record.title}</h2><p className="mt-3 font-space-mono text-xl font-bold text-accent">{record.value}</p><p className="mt-1 text-xs text-text-secondary">{record.holder}{record.season ? ` · ${record.season}` : ""}</p><p className={`mt-3 text-[10px] ${record.verified ? "text-success" : "text-warning"}`}>{record.verified ? "Verified record" : "Requires source verification"}{record.source ? ` · ${record.source}` : ""}</p></article>)}</div>
    </section>
  );
}
