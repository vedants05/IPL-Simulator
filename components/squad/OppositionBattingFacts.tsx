"use client";

import { useState } from "react";
import type { Player } from "@/lib/types";
import { assessBowlerMatchup } from "@/lib/logic/oppositionBowlerMatchup";

const name = (p: Player) => p.name.trim().split(/\s+/).pop();
const rating = (v?: number) => Number.isFinite(v) ? Math.max(0, Math.min(100, v!)) : 50;
function Stat({ label, value, tone = "text-text-primary" }: { label: string; value: string | number; tone?: string }) {
  return <div className="min-w-0"><dt className="text-[8px] uppercase tracking-wide text-text-secondary">{label}</dt><dd className={`text-[10px] font-semibold leading-tight ${tone}`}>{value}</dd></div>;
}

/** Qualitative tactical implications; records and advisory estimates stay distinct. */
export default function OppositionBattingFacts({ lineup, bowlers }: { lineup: Player[]; bowlers: Player[]; excluded: number }) {
  const [view, setView] = useState<"Lineup" | "Matchups" | "IPL records">("Lineup");
  if (!lineup.length) return null;
  const best = [...lineup].sort((a, b) => b.currentBatting - a.currentBatting)[0];
  const tail = lineup.findIndex((p, i) => i >= 6 && lineup.slice(i).every(b => b.currentBatting < 50));
  const depth = lineup.slice(6).filter(p => p.currentBatting >= 65).length;
  const handChange = lineup.findIndex(p => p.battingStyle !== lineup[0].battingStyle);
  const sameHand = handChange < 0 ? lineup.length : handChange;
  const match = (p: Player, position: number) => bowlers.map(b => assessBowlerMatchup(b, p, position)).sort((a, b) => b.score - a.score)[0];
  const bestMatch = match(best, lineup.indexOf(best) + 1);
  const pairs = lineup.slice(0, 5).map((p, i) => ({ batter: p, match: match(p, i + 1) }));
  const openings = (["pace", "spin"] as const).map(family => lineup.slice(0, 8).filter(p => {
    const pace = rating(p.paceRating), spin = rating(p.spinRating);
    return (family === "pace" ? pace : spin) - (pace * .6 + spin * .4) <= -10;
  }).length);
  const phases = (["powerplayBatting", "middleOversBatting", "deathBatting"] as const).map(key => lineup.slice(0, 8).filter(p => {
    const baseline = rating(p.powerplayBatting) * .3 + rating(p.middleOversBatting) * .45 + rating(p.deathBatting) * .25;
    return rating(p[key]) - baseline >= 10;
  }).length);
  const records = lineup.filter(p => (p.iplStats?.matches ?? 0) > 0);
  const runs = [...records].sort((a, b) => b.iplStats.runs - a.iplStats.runs).slice(0, 3);
  const fast = [...records].filter(p => (p.iplStats.ballsFaced ?? p.iplStats.battingBalls ?? 0) >= 100).sort((a, b) => b.iplStats.strikeRate - a.iplStats.strikeRate)[0];
  const qualified = records.filter(p => (p.iplStats.ballsFaced ?? p.iplStats.battingBalls ?? 0) >= 100);
  const avgLeader = [...qualified].sort((a, b) => b.iplStats.battingAverage - a.iplStats.battingAverage)[0];
  const sixLeader = [...records].filter(p => p.iplStats.sixes !== undefined).sort((a, b) => b.iplStats.sixes! - a.iplStats.sixes!)[0];
  const boundaryLeader = [...qualified].filter(p => p.iplStats.fours !== undefined && p.iplStats.sixes !== undefined).sort((a, b) => ((b.iplStats.fours!*4+b.iplStats.sixes!*6)/Math.max(1,b.iplStats.runs)) - ((a.iplStats.fours!*4+a.iplStats.sixes!*6)/Math.max(1,a.iplStats.runs)))[0];
  const leftCount = lineup.filter(p => p.battingStyle === "Left-hand").length;
  const topMean = Math.round(lineup.slice(0,3).reduce((sum,p)=>sum+p.currentBatting,0)/Math.min(3,lineup.length));
  const topRuns = runs.reduce((sum,p)=>sum+p.iplStats.runs,0);
  const totalRuns = records.reduce((sum,p)=>sum+p.iplStats.runs,0);
  const leftHands = lineup.slice(0,8).filter(p=>p.battingStyle === "Left-hand").length;
  return <section aria-label="Facts you should know" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface px-2 py-1">
    <header className="mb-1 flex shrink-0 items-center justify-between gap-2"><h3 className="font-anton text-xs uppercase">Facts you should know</h3><div className="flex gap-0.5" role="tablist" aria-label="Scouting facts">{(["Lineup", "Matchups", "IPL records"] as const).map(label => <button key={label} role="tab" aria-selected={view === label} onClick={() => setView(label)} className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold ${view === label ? "border-accent bg-accent/10 text-accent" : "border-border text-text-secondary hover:text-text-primary"}`}>{label}</button>)}</div></header>
    <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_1fr] gap-3 text-text-primary">
      {view === "Lineup" && <>
        <div className="flex min-h-0 min-w-0 flex-col border-r border-dashed border-border/60 pr-3">
          <div className="flex justify-between text-[8px] uppercase text-text-secondary"><span>Batting depth · BAT</span><span className="text-[#dd8999]">Pink = tail</span></div>
          <svg viewBox="0 0 290 47" preserveAspectRatio="none" className="min-h-0 w-full flex-1" role="img" aria-label="Batting ability and hand by position; gold left-hand, cyan right-hand, pink tail">{lineup.map((p,i)=><g key={p.id}><rect x={i*26+3} y={29-p.currentBatting*.27} width="19" height={p.currentBatting*.27} rx="1" fill={tail>=0&&i>=tail ? "#dd8999" : "#78bbc9"}/><circle cx={i*26+12} cy="35" r="2" fill={p.battingStyle === "Left-hand" ? "#e6b969" : "#78bbc9"}/><text x={i*26+12} y="46" textAnchor="middle" fontSize="8" fill="currentColor">{i+1}</text></g>)}</svg>
          <div className="mt-1 flex items-center justify-between gap-1 text-[9px]"><span><b className="text-[#e6b969]">L {leftCount}</b> / <b className="text-[#78bbc9]">R {lineup.length-leftCount}</b></span><span>Opening run: {sameHand} {lineup[0].battingStyle === "Left-hand" ? "LHB" : "RHB"}</span><span className="text-accent">{sameHand>=2 ? "Repeat angle" : "Switch angles"}</span></div>
        </div>
        <dl className="grid grid-cols-3 content-start gap-x-2 gap-y-1">
          <Stat label="Top 3 BAT" value={topMean}/><Stat label="Depth at 7+" value={`${depth} bats · 65+`}/><Stat label="Tail entry" value={tail>=0 ? `No. ${tail+1}` : "Deep XI"} tone="text-[#dd8999]"/>
          <Stat label="Key wicket" value={name(best) ?? best.name}/><Stat label="Counter (est.)" value={bestMatch ? `${name(bestMatch.bowler)} ${bestMatch.grade}` : "None"} tone="text-accent"/><Stat label="Save overs" value={depth ? "Middle + death" : "Top / middle"}/>
          <Stat label="80+ BAT" value={`${lineup.filter(p=>p.currentBatting>=80).length} threats`}/><Stat label="Top 8 hands" value={`${leftHands} L / ${Math.min(8,lineup.length)-leftHands} R`}/><Stat label="Tail length" value={tail>=0 ? `${lineup.length-tail} wickets` : "No clear tail"}/>
        </dl>
      </>}
      {view === "Matchups" && <>
        <div className="flex min-h-0 min-w-0 flex-col border-r border-dashed border-border/60 pr-3">
          <div className="mb-0.5 flex justify-between text-[8px] uppercase text-text-secondary"><span>Top-five counters</span><span>Estimated · quota applies</span></div>
          {pairs.map(({batter,match})=><div key={batter.id} className="grid min-h-0 flex-1 grid-cols-[1fr_18px_1fr_18px] items-center border-b border-border/25 py-0 text-[9px] leading-tight"><span className="truncate">{name(batter)}</span><span className="text-accent">←</span><span className="truncate">{match ? name(match.bowler) : "No option"}</span><b className={match && match.score>=55 ? "text-emerald-500" : "text-text-secondary"}>{match?.grade ?? "—"}</b></div>)}
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[9px]"><b className="text-accent">{openings[1]>openings[0] ? "Spin edge" : openings[0]>openings[1] ? "Pace edge" : "Mixed attack"}</b><span className="text-text-secondary">Top-eight type openings</span></div>
          <div className="grid grid-cols-2 gap-2">{openings.map((count,i)=><div key={i}><div className="flex justify-between text-[9px]"><span>{i ? "SPIN" : "PACE"}</span><b>{count}/{Math.min(8,lineup.length)}</b></div><div className="mt-0.5 flex gap-0.5">{Array.from({length:Math.min(8,lineup.length)},(_,j)=><span key={j} className="h-1.5 flex-1 rounded-full" style={{background:j<count ? i ? "#e6b969" : "#78bbc9" : "var(--border)"}}/>)}</div></div>)}</div>
          <div className="mt-2 text-[8px] uppercase text-text-secondary">Phase specialists · top eight</div>
          <div className="mt-1 flex items-center gap-2">{phases.map((count,i)=><div key={i} className="flex-1"><div className="flex justify-between text-[9px]"><span>{["PP","MID","DEATH"][i]}</span><b>{count}</b></div><div className="mt-0.5 h-1 bg-border"><div className="h-full" style={{width:`${count/Math.min(8,lineup.length)*100}%`,background:["#e6b969","#78bbc9","#dd8999"][i]}}/></div></div>)}</div>
        </div>
      </>}
      {view === "IPL records" && <>
        <div className="min-w-0 border-r border-dashed border-border/60 pr-3">
          <div className="mb-1 flex justify-between text-[8px] uppercase text-text-secondary"><span>IPL career run share</span><span>Top 3: {totalRuns ? Math.round(topRuns/totalRuns*100) : 0}% of XI</span></div>
          {runs.map(p=><div key={p.id} className="mb-1 grid grid-cols-[72px_1fr_40px] items-center gap-1 text-[9px]"><span className="truncate">{name(p)}</span><div className="h-1.5 rounded-full bg-border"><div className="h-full rounded-full bg-[#78bbc9]" style={{width:`${p.iplStats.runs/Math.max(1,runs[0].iplStats.runs)*100}%`}}/></div><b className="text-right">{p.iplStats.runs.toLocaleString()}</b></div>)}
          <div className="mt-1 flex gap-3 text-[9px]"><span><b className="text-accent">{records.some(p=>p.iplStats.hundreds !== undefined) ? records.reduce((sum,p)=>sum+(p.iplStats.hundreds??0),0) : "—"}</b> hundreds</span><span><b className="text-accent">{records.some(p=>p.iplStats.fifties !== undefined) ? records.reduce((sum,p)=>sum+(p.iplStats.fifties??0),0) : "—"}</b> fifties</span><span className="text-text-secondary">Career ≠ form</span></div>
        </div>
        <dl className="grid grid-cols-2 content-start gap-x-2 gap-y-1">
          <Stat label="Fastest · 100+ balls" value={fast ? `${name(fast)} · SR ${fast.iplStats.strikeRate.toFixed(1)}` : "No sample"} tone="text-[#e6b969]"/>
          <Stat label="Best avg · 100+ balls" value={avgLeader ? `${name(avgLeader)} · ${avgLeader.iplStats.battingAverage.toFixed(1)}` : "No sample"}/>
          <Stat label="Most sixes" value={sixLeader ? `${name(sixLeader)} · ${sixLeader.iplStats.sixes}` : "Not recorded"}/>
          <Stat label="Boundary run share" value={boundaryLeader ? `${name(boundaryLeader)} · ${Math.round((boundaryLeader.iplStats.fours!*4+boundaryLeader.iplStats.sixes!*6)/Math.max(1,boundaryLeader.iplStats.runs)*100)}%` : "Not recorded"} tone="text-[#dd8999]"/>
          <Stat label="IPL appearances" value={records.reduce((sum,p)=>sum+p.iplStats.matches,0).toLocaleString()}/><Stat label="Qualified SR samples" value={`${qualified.length}/${lineup.length} · 100+ balls`}/>
        </dl>
      </>}
    </div>
  </section>;
}
