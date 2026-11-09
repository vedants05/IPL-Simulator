"use client";

import { useMemo, useState } from "react";
import type { Player, Team } from "@/lib/types";
import { projectedAiBattingOrder, projectedAiBowlingAttack } from "@/lib/logic/aiBowlingPlans";
import { getPlayerPhaseRating, type MatchTeamPlans } from "@/lib/logic/matchSimulation";
import { emptyTacticalMatchPlan, getFloaterRules, type BattingSpecialRule, type BattingTargetMode } from "@/lib/logic/tacticalMatchPlan";
import { developerPlayerRatings } from "@/lib/logic/developerTools";
import BattingPlanEditor from "./BattingPlanEditor";
import { ChoiceControl, choiceGroups } from "./TeamTacticsControls";

type RuleSummary = { text: string; priority?: 1 | 2 | 3 };

function RuleTile({ label, entries }: { label: string; entries: RuleSummary[] }) {
  const [page, setPage] = useState(0);
  const pages: RuleSummary[][] = [];
  let lines = 0;
  for (const entry of entries) {
    const estimatedLines = Math.max(1, Math.ceil(entry.text.length / 43));
    if (!pages.length || pages[pages.length - 1].length === 3 || lines + estimatedLines > 7) {
      pages.push([]);
      lines = 0;
    }
    pages[pages.length - 1].push(entry);
    lines += estimatedLines;
  }
  const current = Math.min(page, Math.max(0, pages.length - 1));
  return <div className="h-[126px] min-w-0 overflow-hidden rounded border border-border bg-surface p-2.5">
    <div className="flex items-center justify-between gap-1"><h4 className="font-anton text-xs uppercase">{label}</h4>{pages.length > 1 && <div className="flex items-center gap-1 font-space-mono text-[9px] text-text-secondary" aria-label={`${label} pages`}><button type="button" aria-label={`Previous ${label} page`} disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded border border-border px-1 disabled:opacity-40">‹</button><span>{current + 1} / {pages.length}</span><button type="button" aria-label={`Next ${label} page`} disabled={current === pages.length - 1} onClick={() => setPage(current + 1)} className="rounded border border-border px-1 disabled:opacity-40">›</button></div>}</div>
    {entries.length ? <ul className={`mt-1 space-y-1 text-[10px] leading-[1.2] text-text-secondary ${label === "Team batting rules" ? "" : "list-disc pl-3"}`}>{pages[current]?.map(({ text, priority }, index) => <li key={index} className={priority ? "flex items-start gap-1.5" : undefined}>{priority && <span role="img" aria-label={`Priority: ${priority === 1 ? "Guidance" : priority === 2 ? "Strong" : "Must do"}`} title={priority === 1 ? "Guidance" : priority === 2 ? "Strong" : "Must do"} className="mt-0.5 inline-flex h-4 shrink-0 items-center rounded border border-accent/40 bg-accent/10 px-1 text-accent"><span aria-hidden="true" className="flex h-3 items-end gap-0.5">{([1, 2, 3] as const).map(level => <span key={level} className={`w-[3px] rounded-[1px] ${level <= priority ? "bg-current" : "bg-text-secondary/20"}`} style={{ height: `${level * 3 + 2}px` }} />)}</span></span>}<span>{text}</span></li>)}</ul> : <p className="mt-1 text-[10px] text-text-secondary">None set.</p>}
  </div>;
}

const phaseTone = (player: Player, phase: "powerplay" | "middle" | "death") => {
  const rating = getPlayerPhaseRating(player, "bowling", phase);
  const ratings = [player.powerplayBowling, player.middleOversBowling, player.deathBowling].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const distinct = ratings.length >= 2 && Math.max(...ratings) - Math.min(...ratings) >= 3;
  return rating != null && rating <= 40 ? "bg-red-500/40 border-red-700/70"
    : rating != null && rating <= 45 ? "bg-yellow-400/30 border-yellow-600/60"
    : distinct && rating != null && rating > 50 && rating === Math.max(...ratings) ? "bg-emerald-600/55 border-emerald-700"
    : distinct && rating != null && rating > 50 && rating > Math.min(...ratings) ? "bg-emerald-500/15 border-emerald-500/35"
    : "border-[color:color-mix(in_srgb,var(--ink)_46%,var(--surface))]";
};

export default function DeveloperOppositionTactics({ teams, players, scenario, getPlans, onOpenPlayer }: {
  teams: Team[];
  players: Record<string, Player>;
  scenario: "battingFirst" | "bowlingFirst";
  getPlans: (teamId: string) => MatchTeamPlans;
  onOpenPlayer: (id: string) => void;
}) {
  const [selected, setSelected] = useState(teams[0]?.id ?? "");
  const [view, setView] = useState<"batting" | "bowling">("batting");
  const teamId = teams.some(team => team.id === selected) ? selected : teams[0]?.id;
  const plans = useMemo(() => teamId ? getPlans(teamId) : null, [teamId, getPlans]);
  if (!plans) return <p className="text-sm text-text-secondary">No opposition teams available.</p>;
  const lineup = plans[scenario];
  const plan = plans.tactics.matchPlans?.[scenario] ?? emptyTacticalMatchPlan();
  const bowling = plan.overs;
  const batting = { ...plans.tactics.batting, ...plan.response };
  const name = (id: string) => players[id]?.name ?? id;
  const battingOrder = projectedAiBattingOrder(lineup, scenario);
  const battingPlayers = battingOrder.map(id => players[id]).filter((player): player is Player => Boolean(player));
  const { bowlers, impact } = projectedAiBowlingAttack(lineup, scenario, players);
  const sortedBowlers = [...bowlers].sort((a, b) => b.currentBowling - a.currentBowling || a.name.localeCompare(b.name));
  const modeText: Record<BattingTargetMode, string> = { attack: "attack", "all-out": "go all-out", "keep-strike": "keep the strike", rotate: "rotate the strike", boundaries: "look for boundaries", "see-off": "see off the bowling" };
  const formatTargets = (type: "spin" | "pace") => Object.entries(plan.battingTargets ?? {}).flatMap(([id, targets]) => {
    const target = targets[type];
    return target ? [`${name(id)} should ${target.modes.map(mode => modeText[mode]).join(" and ")} against ${type} from over ${target.fromOver} through over ${target.untilOver}.`] : [];
  });
  const describeTeamRule = (rule: BattingSpecialRule) => {
    const action: Record<BattingSpecialRule["kind"], string> = {
      "boundary-target": `Aim for ${rule.threshold} ${rule.threshold === 1 ? "boundary" : "boundaries"} per over`,
      "settle-in": `Settle the innings for its first ${rule.threshold} balls`,
      rebuild: `Rebuild when ${rule.threshold} wickets are down`,
      "chase-rate": `Attack when the required rate reaches ${rule.threshold} runs per over`,
      finish: `Go all-out with at least ${rule.threshold} wickets in hand`,
      "shield-tail": `Protect the tail when ${rule.threshold} wickets are down and the partner is substantially weaker`,
    };
    return `${action[rule.kind]} from over ${rule.fromOver} through over ${rule.untilOver}.`;
  };
  const cards: [string, RuleSummary[]][] = [
    ["Batting floaters", getFloaterRules(plan).map(rule => ({ text: `${name(rule.playerId)} may be promoted to positions ${rule.earliestPosition}–${rule.latestPosition} from over ${rule.fromOver}${rule.untilOver ? ` through over ${rule.untilOver}` : ""} when ${rule.trigger === "over" ? "the over window is reached" : rule.trigger === "spin" || rule.trigger === "pace" ? `facing ${rule.trigger}` : rule.trigger === "required-rate" ? `the required rate reaches ${rule.requiredRate} runs per over` : `${rule.wickets ?? 3} wickets are down`}${rule.protectCollapse ? ", unless early wickets have caused a collapse" : ""}.` }))],
    ["Target spin", formatTargets("spin").map(text => ({ text }))],
    ["Target pace", formatTargets("pace").map(text => ({ text }))],
    ["Team batting rules", [...(plan.battingTeamRules ?? [])].sort((a, b) => (b.priority ?? 2) - (a.priority ?? 2)).map(rule => ({ text: describeTeamRule(rule), priority: rule.priority ?? 2 }))],
  ];
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-1.5">
      <div className="grid min-w-0 flex-1 grid-cols-3 gap-1 sm:grid-cols-5 lg:grid-cols-9" role="group" aria-label="Opposition team">
        {teams.map(team => {
          const active = team.id === teamId;
          const primary = team.primaryColor || "#64748b";
          const secondary = team.secondaryColor || "#ffffff";
          return <button key={team.id} type="button" aria-label={team.name} title={team.name} aria-pressed={active} onClick={() => setSelected(team.id)}
            style={{ backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${primary} ${active ? 38 : 19}%, var(--surface)), var(--surface))`, borderColor: `color-mix(in srgb, ${primary} ${active ? 85 : 48}%, var(--border))`, boxShadow: `inset 0 -3px 0 ${primary}${active ? `, inset 0 0 0 1px ${primary}` : ""}` }}
            className="flex min-w-0 items-center justify-center gap-2 rounded border px-2 py-1 font-barlow text-base font-extrabold leading-tight text-text-primary transition-[filter] hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"><span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full border" style={{ backgroundColor: primary, borderColor: secondary }} /><span>{team.shortName}</span></button>;
        })}
      </div>
      <div className="flex shrink-0 rounded border border-border p-0.5" role="group" aria-label="Opposition plan view">{(["batting", "bowling"] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={`rounded px-3 py-1 font-space-mono text-[10px] font-bold uppercase ${view === value ? "bg-accent text-black" : "text-text-secondary hover:text-text-primary"}`}>{value} plan</button>)}</div>
    </div>
    {view === "batting" && <section id="opposition-batting-plan" className="space-y-3">
    <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${scenario === "bowlingFirst" ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
      <ChoiceControl title="Powerplay" value={batting.powerplay} options={choiceGroups.battingPowerplay} descriptionInHeader compact={scenario === "bowlingFirst"} readOnly onChange={() => {}} />
      <ChoiceControl title="Middle overs" value={batting.middle} options={choiceGroups.battingMiddle} descriptionInHeader compact={scenario === "bowlingFirst"} readOnly onChange={() => {}} />
      <ChoiceControl title="Death overs" value={batting.death} options={choiceGroups.battingDeath} descriptionInHeader compact={scenario === "bowlingFirst"} readOnly onChange={() => {}} />
      <ChoiceControl title="After a collapse" value={batting.collapseResponse} options={choiceGroups.collapse} descriptionInHeader compact={scenario === "bowlingFirst"} readOnly onChange={() => {}} />
      {scenario === "bowlingFirst" && <ChoiceControl title="Chase pressure" value={batting.chaseApproach} options={choiceGroups.chase} descriptionInHeader compact readOnly onChange={() => {}} />}
    </div>
      <BattingPlanEditor plan={plan} otherPlan={plans.tactics.matchPlans?.[scenario === "battingFirst" ? "bowlingFirst" : "battingFirst"]} players={battingPlayers} order={battingOrder} tactics={plans.tactics} chasing={scenario === "bowlingFirst"} readOnly onChange={() => {}} onOpenPlayer={onOpenPlayer} impact={scenario === "bowlingFirst" && lineup.plannedImpactPlayerId && lineup.plannedOutgoingPlayerId ? { incoming: lineup.plannedImpactPlayerId, outgoing: name(lineup.plannedOutgoingPlayerId) } : undefined} />
      <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, sentences]) => <RuleTile key={`${teamId}-${scenario}-${label}`} label={label} entries={sentences} />)}</div>
    </section>}
    {view === "bowling" && <section id="opposition-bowling-plan" className="space-y-3"><h3 className="font-anton uppercase">Bowling plan</h3>
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      <ChoiceControl title="Powerplay" value={plans.tactics.bowling.powerplay} options={choiceGroups.bowlingPowerplay} descriptionInHeader readOnly onChange={() => {}} />
      <ChoiceControl title="Middle overs" value={plans.tactics.bowling.middle} options={choiceGroups.bowlingMiddle} descriptionInHeader readOnly onChange={() => {}} />
      <ChoiceControl title="Death overs" value={plans.tactics.bowling.death} options={choiceGroups.bowlingDeath} descriptionInHeader readOnly onChange={() => {}} />
    </div>
    <section className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex flex-wrap items-center gap-3"><h4 className="font-anton text-sm uppercase">20-over bowling planner</h4><div className="flex flex-wrap items-center gap-3 text-[10px] text-text-secondary"><span className="inline-flex items-center gap-1"><i className="h-2 w-3 rounded-sm border border-red-700/70 bg-red-500/40" />Poor</span><span className="inline-flex items-center gap-1"><i className="h-2 w-3 rounded-sm border border-yellow-600/60 bg-yellow-400/30" />Weak</span><span className="inline-flex items-center gap-1"><i className="h-2 w-3 rounded-sm border border-emerald-500/35 bg-emerald-500/15" />Stronger</span><span className="inline-flex items-center gap-1"><i className="h-2 w-3 rounded-sm border border-emerald-700 bg-emerald-600/55" />Best</span><span>P = preferred, F = fixed, A = automatic</span></div></div>
      <div className="overflow-x-auto pb-1"><div className="min-w-[650px]">
        <div className="grid grid-cols-[285px_repeat(20,minmax(0,1fr))_36px] gap-1 text-center font-space-mono text-[10px] font-bold"><span /><span className="col-span-6 rounded bg-amber-500/10 py-1 text-amber-500">POWERPLAY</span><span className="col-span-9 rounded bg-sky-500/10 py-1 text-sky-500">MIDDLE</span><span className="col-span-5 rounded bg-violet-500/10 py-1 text-violet-400">DEATH</span></div>
        <div className="mt-2 grid grid-cols-[285px_repeat(20,minmax(0,1fr))_36px] gap-1 text-center font-space-mono text-[10px] text-text-secondary"><span className="text-left">BOWLER · BOWL</span>{Array.from({ length: 20 }, (_, i) => <span key={i}>{i + 1}</span>)}<span>OVERS</span></div>
        {sortedBowlers.map(player => <div key={player.id} className="mt-0.5 grid grid-cols-[285px_repeat(20,minmax(0,1fr))_36px] items-stretch gap-1 border-b border-border/30 py-0.5"><div className="flex items-center gap-2 pr-2 text-xs font-semibold"><button type="button" onClick={() => onOpenPlayer(player.id)} data-developer-tooltip={developerPlayerRatings(player)} className="text-left hover:text-accent hover:underline">{player.name}</button>{impact?.incoming.id === player.id && <small className="text-sky-500">IMPACT</small>}<span className="font-space-mono text-[10px] text-text-secondary">{player.currentBowling}</span></div>{Array.from({ length: 20 }, (_, i) => { const slot = bowling[i]; const phase = i < 6 ? "powerplay" : i < 15 ? "middle" : "death"; const assigned = slot?.playerId === player.id; return <div key={i} role="img" aria-label={`Over ${i + 1}, ${player.name}${assigned ? `, ${slot.mode}` : ""}`} data-developer-tooltip={`${player.name} · ${phase} bowling: ${getPlayerPhaseRating(player, "bowling", phase) ?? "Not set"}\n${developerPlayerRatings(player)}`} className={`flex min-h-6 items-center justify-center rounded-sm border text-[10px] font-bold ${assigned ? slot.mode === "fixed" ? "border-accent bg-accent text-black" : "border-accent border-dashed bg-accent/15 text-accent" : phaseTone(player, phase)}`}>{assigned ? slot.mode === "fixed" ? "F" : "P" : ""}</div>; })}<span className="self-center text-center font-space-mono text-[10px] text-text-secondary">{bowling.filter(slot => slot?.playerId === player.id).length}/4</span></div>)}
        <div className="mt-1 grid grid-cols-[285px_repeat(20,minmax(0,1fr))_36px] items-center gap-1"><span className="text-[10px] text-text-secondary">Captain chooses</span>{Array.from({ length: 20 }, (_, i) => <span key={i} className="text-center text-[9px] text-sky-500">{bowling[i] ? "" : "A"}</span>)}</div>
      </div></div>
    </section></section>}
  </section>;
}
