"use client";

import { useMemo, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { buildPlayerAnalysisTotals, type PlayerAnalysisFixture } from "@/lib/logic/playerAnalysisMetrics";
import { assessBowlerMatchup } from "@/lib/logic/oppositionBowlerMatchup";
import { oppositionOverLikelihood } from "@/lib/logic/oppositionOverLikelihood";
import type { Player, Team } from "@/lib/types";

const likelihoodColour = (ratio: number) => ratio >= 0.67 ? "#087b4b" : ratio >= 0.34 ? "#8a6200" : "#a22f3e";

function bowlingSummary(player: Player) {
  const arm = player.bowlingHand === "Left-hand" ? "LA" : player.bowlingHand === "Right-hand" ? "RA" : "?A";
  const type = player.bowlingStyle === "Spinner"
    ? player.spinStyle ? ({ off_spin: "Offspin", leg_spin: "Legspin", left_arm_orthodox: "Ortho", left_arm_wrist_spin: "Wrist", mystery_spin: "Myst" } as const)[player.spinStyle] : "Spin"
    : player.paceSpeedBand ? ({ express: "Exp", fast: "Fast", fast_medium: "Fast-Med", medium: "Medium" } as const)[player.paceSpeedBand] : "Pace";
  return `${player.currentBowling} · ${arm} ${type}`;
}

export default function OppositionBowlersPreview({ instructions, onInstructionChange, team, bowlers, fixtures, battingXI }: { instructions: Record<string, import("@/lib/logic/teamTactics").BowlerBattingInstruction>; onInstructionChange: (id: string, instruction: import("@/lib/logic/teamTactics").BowlerBattingInstruction) => void; team: Team; bowlers: Player[]; fixtures: PlayerAnalysisFixture[]; battingXI: Player[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sortedBowlers = [...bowlers].sort((a, b) => b.currentBowling - a.currentBowling || a.name.localeCompare(b.name));
  const selected = sortedBowlers.some(p => p.id === selectedId) ? selectedId : sortedBowlers[0]?.id;
  const season = useGameStore(state => state.currentSeason);
  const bowler = bowlers.find(p => p.id === selected);
  const recent = bowler?.iplHistory.filter(h => (Number(h.season) === season || Number(h.season) === season - 1) && h.seasonStats && h.seasonStats.oversBowled > 0).sort ( (a, b) => Number(b.season) - Number(a.season))[0];
  const totals = useMemo(() => buildPlayerAnalysisTotals(fixtures), [fixtures]);
  const live = bowler ? totals[bowler.id] : undefined;
  const stats = recent?.seasonStats;
  const matchups = bowler ? battingXI.map((batter, i) => ({ batter, position: i + 1, assessment: assessBowlerMatchup(bowler, batter, i + 1) })) : [];
  const phaseRatings = [bowler?.powerplayBowling ?? 50, bowler?.middleOversBowling ?? 50, bowler?.deathBowling ?? 50];
  const recordedOvers = Array.from({ length: 20 }, (_, i) => live?.segments[`over:${i + 1}`]?.bowlBalls ?? 0);
  const hasOverData = recordedOvers.some(Boolean);
  const overWeights = oppositionOverLikelihood(phaseRatings, recordedOvers, live?.bowlingInnings ?? 0);
  const likely = matchups.map(m => {
    const peak = [4, 5, 8, 10, 12, 14, 16, 17, 18, 19, 20][m.position - 1] ?? 20;
    const exposure = overWeights.reduce((sum, weight, i) => sum + weight * Math.exp(-Math.pow((i + 1 - peak) / 4, 2) / 2), 0);
    return { ...m, exposure };
  }).sort((a, b) => b.exposure - a.exposure).slice(0, 4);
  const best = [...likely].sort((a, b) => a.assessment.score - b.assessment.score)[0];
  const instruction = bowler ? instructions[bowler.id] ?? { approach: "normal" as const, overs: ["follow", "follow", "follow", "follow"] as import("@/lib/logic/teamTactics").BowlerOverTarget[] } : undefined;
  const expectedOvers = bowler ? live?.bowlingInnings && live.bowlBalls ? Math.min(4, live.bowlBalls / 6 / live.bowlingInnings) : stats?.matches && stats.oversBowled > 0 ? Math.min(4, stats.oversBowled / stats.matches) : bowler.bowlingUsage === "part_time" ? 1.5 : bowler.bowlingUsage === "regular" ? 3 : bowler.bowlingUsage === "frontline" || bowler.role === "Pace Bowler" || bowler.role === "Spin Bowler" ? 3.5 : 2 : 0;
  const expectedSource = live?.bowlingInnings && live.bowlBalls ? "Based on this season’s bowling innings" : stats?.matches && stats.oversBowled > 0 ? "Based on last available season’s matches" : "Estimated from bowling role";
  const teamColour = team.primaryColor || "var(--accent)";
  return <section aria-label={`${team.name} bowlers`} className="col-start-1 min-h-48 min-w-0 self-stretch rounded-lg border border-border bg-surface xl:col-start-2 xl:row-start-1 xl:min-h-0">
    <header className="flex items-center justify-between border-b border-border px-2 py-0.5"><h3 className="font-anton text-xs uppercase">{team.shortName} · Bowlers</h3><span className="font-space-mono text-[9px] text-text-secondary">Projected bowling XI</span></header>
    <div role="tablist" aria-label="Opposition bowler" className="grid gap-px border-b border-border bg-surface p-1" style={{ gridTemplateColumns: `repeat(${Math.max(1, bowlers.length)}, minmax(0, 1fr))` }}>
      {sortedBowlers.map(player => <button key={player.id} type="button" role="tab" aria-selected={selected === player.id} title={player.name} onClick={() => setSelectedId(player.id)}
        style={{ background: `color-mix(in srgb, ${teamColour} ${selected === player.id ? 23 : 5}%, var(--surface))`, borderColor: `color-mix(in srgb, ${teamColour} ${selected === player.id ? 75 : 22}%, var(--border))`, boxShadow: selected === player.id ? `inset 0 -2px 0 ${teamColour}` : undefined }}
        className={`[container-type:inline-size] min-w-0 rounded-sm border px-1 py-1 font-barlow-condensed text-[12px] font-bold leading-tight transition-[filter] hover:brightness-110 focus-visible:outline focus-visible:outline-accent text-text-primary`}><span className="block overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: `clamp(8px, ${Math.min(14, 170 / Math.max(player.name.length, 1))}cqi, 12px)` }}>{player.name}</span><span className="mt-0.5 block whitespace-nowrap text-[10px] font-medium text-text-secondary">{bowlingSummary(player)}</span></button>)}
      {!bowlers.length && <span className="bg-surface px-2 py-1 text-xs text-text-secondary">No available bowling options.</span>}
    </div>
    {bowler && <div className="p-2 text-text-primary">
      <div className="flex items-center justify-between gap-3 rounded border border-border px-3 py-1.5" style={{ background: `color-mix(in srgb, ${teamColour} 12%, var(--surface))` }}><div><h4 className="font-anton text-base">{bowler.name}</h4><p className="text-[10px] text-text-secondary">{bowler.role} · {bowler.nationality} · {bowler.age} years</p></div><span className="font-space-mono text-xs font-bold">BOWL {bowler.currentBowling}</span></div>
      <div className="mt-2 grid grid-cols-[125px_minmax(0,1fr)] gap-2">
        <div className="rounded border border-border p-2"><h5 className="font-space-mono text-[9px] uppercase text-text-secondary">{live?.bowlBalls ? `${season} season` : recent ? `${recent.season} season` : "Season bowling"}</h5>{live?.bowlBalls ? <div className="mt-1 space-y-1 text-xs"><p><b>{live.matches}</b> matches</p><p><b>{live.wickets}</b> wickets</p><p><b>{(live.conceded * 6 / live.bowlBalls).toFixed(2)}</b> economy</p><p><b>{Math.floor(live.bowlBalls / 6)}.{live.bowlBalls % 6}</b> overs</p></div> : stats ? <div className="mt-1 space-y-1 text-xs"><p><b>{stats.matches}</b> matches</p><p><b>{stats.wickets}</b> wickets</p><p><b>{(stats.runsConceded / stats.oversBowled).toFixed(2)}</b> economy</p><p><b>{stats.bestBowling || "—"}</b> best</p></div> : <p className="mt-1 text-[10px] text-text-secondary">No season figures available.</p>}</div>
        <div className="rounded border border-border p-2"><div className="flex items-center gap-3"><h5 className="font-space-mono text-[9px] uppercase text-text-secondary">Likely overs · {hasOverData ? "profile + season usage" : "profile estimate"}</h5><div aria-label="Over likelihood: red is low, amber is medium, green is high" className="flex items-center gap-1 text-[9px] text-text-secondary"><span>Less likely</span>{[0, 0.5, 1].map(level => <span key={level} aria-hidden="true" className="h-2.5 w-3 border border-border" style={{ background: likelihoodColour(level) }} />)}<span>More likely</span></div></div><div className="mt-2 grid grid-cols-[repeat(20,minmax(0,1fr))] gap-px">{overWeights.map((weight, i) => <span key={i} title={`Over ${i + 1}`} className="border border-border py-1 text-center text-[9px] font-bold text-white" style={{ background: likelihoodColour(weight) }}>{i + 1}</span>)}</div><p className="mt-2 text-[10px]"><b>Potential encounters:</b> {likely.length ? likely.map(m => `${m.batter.name} (${m.assessment.grade})`).join(" · ") : "No clear overlap"}</p><p className="mt-1 text-[10px]"><b>Best batter to face:</b> {best ? best.batter.name : "No clear estimate"}</p></div>
      </div>
      {instruction && <div className="mt-2 min-h-[125px] rounded border border-border p-2">
        <div className="flex items-center gap-3"><span className="font-space-mono text-[10px] uppercase text-text-secondary">Approach</span><div role="group" aria-label={`Batting approach against ${bowler.name}`} className="inline-flex overflow-hidden rounded border border-border bg-background">{(["survive", "normal", "exploit", "all-out"] as const).map(value => <button key={value} type="button" aria-pressed={instruction.approach === value} onClick={() => onInstructionChange(bowler.id, { ...instruction, approach: value })} className={`border-r border-border px-3 py-1 font-space-mono text-[10px] font-bold last:border-r-0 focus-visible:outline focus-visible:outline-accent ${instruction.approach === value ? "bg-accent text-black" : "text-text-secondary hover:bg-accent/10 hover:text-text-primary"}`}>{value === "all-out" ? "All out" : value[0].toUpperCase() + value.slice(1)}</button>)}</div><span className="ml-auto whitespace-nowrap font-space-mono text-[9px] text-text-secondary" title={expectedSource}>Expected: <b className="text-text-primary">~{expectedOvers.toFixed(1)} overs</b></span></div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} role="group" aria-label={`${bowler.name} over ${i + 1} target`}><div className="mb-1 font-space-mono text-[9px] uppercase text-text-secondary">Over {i + 1}</div><div className="grid grid-cols-3 gap-0.5">{([ ["follow", "Approach", "Follow the selected approach"], ["see-off", "See off", "Reduce risk to see off the over"], ["rotate", "Rotate", "Prioritise strike rotation"], ["boundary", "4s/6s", "Seek boundaries"], ["attack", "Attack", "Attack the bowler"], ["react", "React last", "React to this bowler’s previous over"] ] as const).filter(([value]) => i > 0 || value !== "react").map(([value, label, title]) => <button key={value} type="button" title={title} aria-label={title} aria-pressed={(instruction.overs[i] ?? "follow") === value} onClick={() => { const overs = Array.from({ length: 4 }, (_, index) => instruction.overs[index] ?? "follow"); overs[i] = value; onInstructionChange(bowler.id, { ...instruction, overs }); }} className={`rounded-sm border px-0.5 py-1 text-[9px] font-semibold leading-none focus-visible:outline focus-visible:outline-accent ${(instruction.overs[i] ?? "follow") === value ? "border-accent bg-accent/20 text-accent" : "border-border text-text-secondary hover:text-text-primary"}`}>{label}</button>)}</div></div>)}</div>
      </div>}
    </div>}
  </section>;
}

