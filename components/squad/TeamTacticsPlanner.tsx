"use client";



import { useMemo, useState } from "react";

import { ArrowRight, CheckCircle2, Shield, SlidersHorizontal, Sparkles, Swords, Target, TriangleAlert } from "lucide-react";

import type { Player } from "@/lib/types";

import { getPlayableBowlingOptions, getPlayerPhaseRating, projectBatFirstImpact } from "@/lib/logic/matchSimulation";

import { applyTeamTacticsPreset, TEAM_STRATEGIES, type TeamTactics } from "@/lib/logic/teamTactics";

import { bowlingPlanWarnings, emptyTacticalMatchPlan, getFloaterRules, normalizeTacticalMatchPlan, type TacticalMatchPlan } from "@/lib/logic/tacticalMatchPlan";

import { ChoiceControl, choiceGroups, STRATEGY_DESCRIPTIONS } from "./TeamTacticsControls";



import BattingPlanEditor from "./BattingPlanEditor";
import BattingFloaterCard from "./BattingFloaterCard";
import BattingTargetCard from "./BattingTargetCard";
import BattingSpecialRulesCard from "./BattingSpecialRulesCard";
import OppositionLineupPreview from "./OppositionLineupPreview";
import { suggestBowlingOvers } from "@/lib/logic/suggestBowlingOvers";
import { findOptimalImpactBattingPosition } from "@/lib/logic/aiLineupSelector";
import { useGameStore } from "@/lib/store/gameStore";

interface Props {
  fixtures: import("@/lib/logic/playerAnalysisMetrics").PlayerAnalysisFixture[];
  bowlingFirstImpactPlayerId?: string | null;
  bowlingFirstOutgoingPlayerId?: string | null;
  bowlingFirstImpactBattingPosition?: number | null;
  battingFirstImpactPlayerId?: string | null;
  battingFirstOutgoingPlayerId?: string | null;
  captainId?: string | null;
  viceCaptainId?: string | null;

  tactics: TeamTactics;

  players: Record<string, Player>;

  battingFirstXI: string[];

  bowlingFirstXI: string[];

  battingFirstImpactSubs: string[];

  bowlingFirstImpactSubs: string[];

  onChange: (tactics: TeamTactics) => void;

  onOpenPlayingXI: () => void;
  onOpenPlayer: (playerId: string) => void;

  coachRecommendation?: { coachName: string; tactics: TeamTactics } | null;

}

const buttonStyle = "rounded border border-border px-2 py-1 font-space-mono text-[10px] font-bold uppercase transition-colors hover:border-accent focus-visible:outline focus-visible:outline-accent";



export default function TeamTacticsPlanner(props: Props) {

  const { tactics, players, onChange, onOpenPlayingXI, onOpenPlayer, coachRecommendation } = props;

  const [tab, setTab] = useState<"batting" | "bowling" | "decisions" | "opposition">("bowling");

  const [scenario, setScenario] = useState<"battingFirst" | "bowlingFirst">("battingFirst");

  const [mode, setMode] = useState<"fixed" | "preferred">("fixed");
  const [suggestionIncomplete, setSuggestionIncomplete] = useState(false);
  const [oppositionTeamId, setOppositionTeamId] = useState("");
  const leagueTeams = useGameStore(state => state.teams);
  const userTeamId = useGameStore(state => state.userTeamId);
  const oppositionTeams = Object.values(leagueTeams)
    .filter(team => team.id !== userTeamId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const selectedOpposition = oppositionTeams.some(team => team.id === oppositionTeamId) ? oppositionTeamId : "";

  const plan = tactics.matchPlans?.[scenario] ?? emptyTacticalMatchPlan();
  const normalizedPlan = useMemo(() => normalizeTacticalMatchPlan(plan), [plan]);
  const matchupTargets = normalizedPlan.battingTargets ?? {};
  const specialRules = normalizedPlan.battingTeamRules ?? [];

  const xi = scenario === "battingFirst" ? props.battingFirstXI : props.bowlingFirstXI;

  const subs = scenario === "battingFirst" ? props.battingFirstImpactSubs : props.bowlingFirstImpactSubs;

  const playerList = Array.from(new Set([...xi, ...subs])).map(id => players[id]).filter((p): p is Player => Boolean(p));

  const chaseOrder = [...xi];
  const maxOverseas = useGameStore(state => state.worldRules.maxOverseasInXI);
  const starters = xi.map(id => players[id]).filter((p): p is Player => Boolean(p));
  const selectedOutgoing = starters.find(p => p.id === props.bowlingFirstOutgoingPlayerId);
  const outgoing = selectedOutgoing ?? starters[starters.length - 1];
  const outgoingIndex = xi.indexOf(outgoing?.id ?? "");
  const overseasCount = starters.filter(p => p.nationality === "Overseas").length;
  const legalReserves = playerList.filter(p => !xi.includes(p.id)
    && (p.nationality !== "Overseas" || overseasCount < maxOverseas));
  const selectedIncoming = legalReserves.find(p => p.id === props.bowlingFirstImpactPlayerId);
  const chaseImpact = scenario === "bowlingFirst" && outgoing
    ? selectedIncoming ?? legalReserves.sort((a, b) => b.currentBatting - a.currentBatting)[0]
    : undefined;
  if (chaseImpact && outgoing) {
    chaseOrder.splice(outgoingIndex, 1);
    const position = props.bowlingFirstImpactBattingPosition
      ?? findOptimalImpactBattingPosition(starters, chaseImpact, outgoing, true)
      ?? outgoingIndex + 1;
    chaseOrder.splice(Math.max(0, Math.min(chaseOrder.length, position - 1)), 0, chaseImpact.id);
  }
  const battingList = chaseOrder
    .map(id => players[id]).filter((player): player is Player => Boolean(player));

  const bowlers = getPlayableBowlingOptions(playerList).sort((a, b) => {

    const aStarter = xi.includes(a.id), bStarter = xi.includes(b.id);

    if (aStarter !== bStarter) return aStarter ? -1 : 1;

    if (aStarter) return xi.indexOf(a.id) - xi.indexOf(b.id);

    return b.currentBowling - a.currentBowling || (b.bowlingEconomyControl ?? 0) - (a.bowlingEconomyControl ?? 0) || a.name.localeCompare(b.name);

  });

  const impact = scenario === "battingFirst" && xi.length === 11
    ? projectBatFirstImpact(xi, xi, {
        impactSubs: subs,
        plannedImpactPlayerId: props.battingFirstImpactPlayerId,
        plannedOutgoingPlayerId: props.battingFirstOutgoingPlayerId,
        captainId: props.captainId,
        viceCaptainId: props.viceCaptainId,
      }, players)
    : null;
  const attackIds = [...xi.filter(id => id !== impact?.outgoing.id), ...(impact ? [impact.incoming.id] : [])];
  const attack = getPlayableBowlingOptions(attackIds.map(id => players[id]).filter((p): p is Player => Boolean(p)));
  const warnings = bowlingPlanWarnings(plan, bowlers.map(p => p.id));
  if (suggestionIncomplete) warnings.push("Some overs remain automatic. Review fixed assignments and available bowlers.");
  if (plan.overs.some(slot => slot?.mode === "fixed" && !attack.some(p => p.id === slot.playerId))) {
    warnings.push("A fixed over is assigned to a bowler outside the projected bowling XI.");
  }
  if (attack.length < 5) warnings.push("The projected bowling XI needs five eligible bowlers to cover 20 overs.");


  const fixedCount = plan.overs.filter(slot => slot?.mode === "fixed").length;

  const preferredCount = plan.overs.filter(slot => slot?.mode === "preferred").length;

  const updatePlan = (update: Partial<TacticalMatchPlan>) => {
    setSuggestionIncomplete(false);
    onChange({ ...tactics, matchPlans: { ...tactics.matchPlans, [scenario]: { ...plan, ...update } } });
  };

  const updateBatting = (update: Partial<TeamTactics["batting"]>) => onChange({ ...tactics, batting: { ...tactics.batting, ...update } });

  const updateBowling = (update: Partial<TeamTactics["bowling"]>) => onChange({ ...tactics, bowling: { ...tactics.bowling, ...update } });

  const floaters = getFloaterRules(normalizedPlan);

  const assignedNames = useMemo(() => Array.from(new Set(plan.overs.flatMap(slot => slot ? [slot.playerId] : []))), [plan.overs]);



  function assignOver(playerId: string, index: number) {

    const overs = [...plan.overs];

    overs[index] = overs[index]?.playerId === playerId && overs[index]?.mode === mode ? null : { playerId, mode };

    updatePlan({ overs });

  }



  function suggestOvers() {
    const overs = suggestBowlingOvers(attack, plan.overs, tactics.bowling.middle);
    updatePlan({ overs });
    setSuggestionIncomplete(overs.some(slot => slot === null));
  }



  return <div className="team-tactics-page flex h-full min-h-0 flex-1 flex-col overflow-hidden border border-border bg-background text-text-primary">

    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3 py-1">

      <div className="flex items-center gap-2"><SlidersHorizontal size={15} className="text-accent" /><h2 className="font-anton text-base uppercase">Team tactics</h2></div>

      <div className="flex flex-wrap items-center gap-2">{(tab === "batting" || tab === "bowling") && <button type="button" className={buttonStyle} onClick={() => {
        const other = scenario === "battingFirst" ? "bowlingFirst" : "battingFirst";
        const copied = normalizeTacticalMatchPlan(tactics.matchPlans?.[other] ?? emptyTacticalMatchPlan());
        onChange({ ...tactics, matchPlans: { ...tactics.matchPlans, [scenario]: copied } });
        setSuggestionIncomplete(false);
      }}>{scenario === "battingFirst" ? "Copy bowl first plan" : "Copy bat first plan"}</button>}<div className="flex rounded border border-border p-0.5" aria-label="Match plan">

        {(["battingFirst", "bowlingFirst"] as const).map(key => <button key={key} aria-pressed={scenario === key} onClick={() => { setScenario(key); setSuggestionIncomplete(false); }} className={`${buttonStyle} border-0 ${scenario === key ? "bg-accent text-black" : "text-text-secondary"}`}>{key === "battingFirst" ? "Bat first" : "Bowl first / chase"}</button>)}

      </div><button className={buttonStyle} onClick={onOpenPlayingXI}>Edit XI <ArrowRight size={12} className="ml-1 inline" /></button></div>

    </header>

    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-3">

      <div className="flex min-w-0 overflow-x-auto" role="tablist" aria-label="Tactics sections">{([{ id: "batting", label: "Batting plan", Icon: Swords }, { id: "bowling", label: "Bowling plan", Icon: Shield }, { id: "decisions", label: "Match decisions", Icon: SlidersHorizontal }, { id: "opposition", label: "Opposition instructions", Icon: Target }] as const).map(({ id, label, Icon }) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-space-mono text-xs font-bold uppercase ${tab === id ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-text-primary"}`}><Icon size={14} />{label}</button>)}</div>

      <span className="hidden font-space-mono text-[10px] text-text-secondary lg:block">
        {xi.length}/11 players{tab === "bowling" && ` · ${fixedCount} fixed · ${20 - fixedCount - preferredCount} auto overs`}
      </span>

    </div>

    <div className={tab === "bowling" ? "grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 xl:grid-cols-[minmax(0,1fr)_245px]" : `${tab === "opposition" ? "opposition-tactics-content " : ""}min-h-0 flex-1 overflow-y-auto p-3`}>

      <main className={`flex min-w-0 flex-col gap-3 ${tab === "batting" ? "min-h-full" : tab === "opposition" ? "h-full min-h-0" : ""}`}>

        {tab === "bowling" && <>

          <section className="rounded-lg border border-border bg-surface p-3">

            <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h3 className="font-anton text-sm uppercase" title="Click a cell to assign an over. Click it again to clear.">20-over bowling planner</h3><div className="flex flex-wrap items-center gap-3 text-[10px] text-text-secondary"><span className="inline-flex items-center gap-1"><i className="h-2 w-3 rounded-sm border border-emerald-500/35 bg-emerald-500/15" />Stronger phase</span><span className="inline-flex items-center gap-1"><i className="h-2 w-3 rounded-sm border border-emerald-500/60 bg-emerald-500/30" />Best phase</span><span>Relative to each bowler</span></div></div><div className="flex flex-wrap gap-2">

              <div className="flex rounded border border-border p-0.5">{(["fixed", "preferred"] as const).map(value => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)} className={`${buttonStyle} border-0 ${mode === value ? "bg-accent text-black" : "text-text-secondary"}`}>{value}</button>)}</div>

              <button className={buttonStyle} onClick={suggestOvers}><Sparkles size={12} className="mr-1 inline" />Suggest overs</button>

              <button className={buttonStyle} onClick={() => updatePlan({ overs: Array(20).fill(null) })}>Clear All</button>

            </div></div>

            <div className="overflow-x-auto pb-1"><div className="min-w-[650px]">

              <div className="grid grid-cols-[285px_repeat(20,minmax(0,1fr))_36px] gap-1 text-center font-space-mono text-[10px] font-bold"><span /><span className="col-span-6 rounded bg-amber-500/10 py-1 text-amber-500">POWERPLAY</span><span className="col-span-9 rounded bg-sky-500/10 py-1 text-sky-500">MIDDLE</span><span className="col-span-5 rounded bg-violet-500/10 py-1 text-violet-400">DEATH</span></div>

              <div className="mt-2 grid grid-cols-[285px_repeat(20,minmax(0,1fr))_36px] gap-1 text-center font-space-mono text-[10px] text-text-secondary"><span className="text-left">BOWLER · BOWL</span>{Array.from({ length: 20 }, (_, i) => <span key={i}>{i + 1}</span>)}<span>OVERS</span></div>

              {bowlers.map(player => {

                const count = plan.overs.filter(slot => slot?.playerId === player.id).length;

                return <div key={player.id} className="mt-0.5 grid grid-cols-[285px_repeat(20,minmax(0,1fr))_36px] items-stretch gap-1 border-b border-border/30 py-0.5">

                  <div className="flex min-w-0 items-center justify-between gap-2 pr-2"><div className="flex min-w-0 flex-1 items-center gap-2"><div className="whitespace-nowrap text-xs font-semibold leading-tight"><button type="button" onClick={() => onOpenPlayer(player.id)} className="rounded-sm text-left hover:text-accent hover:underline focus-visible:outline focus-visible:outline-accent">{player.name}</button>{!xi.includes(player.id) && (
                    player.id === impact?.incoming.id
                      ? <small className="ml-1 rounded bg-sky-500/20 px-1 text-sky-400" title="Projected to bowl after the Bat First substitution">SELECTED</small>
                      : <small className="ml-1 text-accent">IMPACT</small>
                  )}</div><div className="shrink-0 whitespace-nowrap font-space-mono text-[10px] text-text-secondary">{player.currentBowling}</div></div></div>

                  {plan.overs.map((slot, i) => {

                    const phase = i < 6 ? "powerplay" : i < 15 ? "middle" : "death";

                    const rating = getPlayerPhaseRating(player, "bowling", phase);

                    const phaseRatings = [player.powerplayBowling, player.middleOversBowling, player.deathBowling].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
                    const best = Math.max(...phaseRatings);
                    const average = phaseRatings.reduce((sum, value) => sum + value, 0) / phaseRatings.length;
                    const distinctStrength = phaseRatings.length >= 2 && best - Math.min(...phaseRatings) >= 3;
                    const isBestPhase = distinctStrength && rating === best;
                    const isStrongerPhase = distinctStrength && rating != null && rating >= average + 2;
                    const strengthClass = isBestPhase ? "bg-emerald-500/30 border-emerald-500/60" : isStrongerPhase ? "bg-emerald-500/15 border-emerald-500/35" : "border-[color:color-mix(in_srgb,var(--ink)_46%,var(--surface))]";

                    return <button key={i} aria-label={`Over ${i + 1}, ${player.name}${slot?.playerId === player.id ? `, ${slot.mode}` : ""}`} aria-pressed={slot?.playerId === player.id} onClick={() => assignOver(player.id, i)} className={`min-h-6 rounded-sm border text-[10px] font-bold transition-colors focus-visible:outline focus-visible:outline-accent ${slot?.playerId === player.id ? slot.mode === "fixed" ? "border-accent bg-accent text-black" : "border-accent border-dashed bg-accent/15 text-accent" : `${strengthClass} hover:border-accent hover:brightness-125`}`}>{slot?.playerId === player.id ? slot.mode === "fixed" ? "F" : "P" : ""}</button>; })}

                <span className={`self-center text-center font-space-mono text-[10px] ${count > 4 ? "text-red-500" : "text-text-secondary"}`}>{count}/4</span>
                </div>;

              })}

              <div className="mt-1 grid grid-cols-[285px_repeat(20,minmax(0,1fr))_36px] items-center gap-1">
                <span className="text-[10px] leading-none text-text-secondary">Captain chooses / clear over</span>
                {plan.overs.map((slot, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Clear over ${i + 1} to automatic`}
                    onClick={() => updatePlan({ overs: plan.overs.map((s, j) => j === i ? null : s) })}
                    className={`h-4 rounded text-[9px] leading-none focus-visible:outline focus-visible:outline-accent ${!slot ? "bg-sky-500/10 text-sky-500" : "text-text-secondary hover:bg-accent/10"}`}
                  >
                    {!slot ? "A" : "×"}
                  </button>
                ))}
              </div>

            </div></div>

            {!bowlers.length && <p className="py-8 text-center text-sm text-text-secondary">Select your XI in Playing XIs to start planning overs.</p>}

          </section>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3"><ChoiceControl title="Powerplay" value={tactics.bowling.powerplay} options={choiceGroups.bowlingPowerplay} descriptionInHeader onChange={powerplay => updateBowling({ powerplay })} /><ChoiceControl title="Middle overs" value={tactics.bowling.middle} options={choiceGroups.bowlingMiddle} descriptionInHeader onChange={middle => updateBowling({ middle })} /><ChoiceControl title="Death overs" value={tactics.bowling.death} options={choiceGroups.bowlingDeath} descriptionInHeader onChange={death => updateBowling({ death })} /></div>

        </>}

        {tab === "batting" && <>

          <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${scenario === "bowlingFirst" ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            <ChoiceControl title="Powerplay" value={plan.response?.powerplay ?? tactics.batting.powerplay}
              options={choiceGroups.battingPowerplay} descriptionInHeader compact={scenario === "bowlingFirst"}
              onChange={powerplay => updatePlan({ response: { ...plan.response, powerplay } })} />
            <ChoiceControl title="Middle overs" value={plan.response?.middle ?? tactics.batting.middle}
              options={choiceGroups.battingMiddle} descriptionInHeader compact={scenario === "bowlingFirst"}
              onChange={middle => updatePlan({ response: { ...plan.response, middle } })} />
            <ChoiceControl title="Death overs" value={plan.response?.death ?? tactics.batting.death}
              options={choiceGroups.battingDeath} descriptionInHeader compact={scenario === "bowlingFirst"}
              onChange={death => updatePlan({ response: { ...plan.response, death } })} />
            <ChoiceControl title="After a collapse" value={plan.response?.collapseResponse ?? tactics.batting.collapseResponse}
              options={choiceGroups.collapse} descriptionInHeader compact={scenario === "bowlingFirst"}
              onChange={collapseResponse => updatePlan({ response: { ...plan.response, collapseResponse } })} />
            {scenario === "bowlingFirst" && <ChoiceControl title="Chase pressure" descriptionInHeader compact
              value={plan.response?.chaseApproach ?? tactics.batting.chaseApproach} options={choiceGroups.chase}
              onChange={chaseApproach => updatePlan({ response: { ...plan.response, chaseApproach } })} />}
          </div>
          <BattingPlanEditor key={scenario} plan={plan} players={battingList} order={chaseOrder}
            otherPlan={tactics.matchPlans?.[scenario === "battingFirst" ? "bowlingFirst" : "battingFirst"]}
            tactics={tactics} chasing={scenario === "bowlingFirst"}
            onChange={updatePlan} onOpenPlayer={onOpenPlayer}
            impact={chaseImpact && outgoing ? { incoming: chaseImpact.id, outgoing: outgoing.name } : undefined} />
          <div className="-mt-1 grid flex-1 content-stretch gap-2 sm:grid-cols-2 lg:grid-cols-[270px_repeat(2,minmax(0,17rem))] min-[1360px]:grid-cols-[270px_repeat(2,minmax(0,17rem))_minmax(0,1fr)]">
            <BattingFloaterCard key={scenario} players={battingList} order={chaseOrder} rules={floaters}
              chasing={scenario === "bowlingFirst"} onChange={next => updatePlan({ floaters: next, floater: next[0] ?? null })} />
            {(["spin", "pace"] as const).map(type => (
              <BattingTargetCard key={`${scenario}-${type}`} type={type}
                players={battingList} targets={matchupTargets}
                onChange={(playerId, value) => {
                  const battingTargets = { ...matchupTargets };
                  const playerTargets = { ...battingTargets[playerId] };
                  if (value) playerTargets[type] = value;
                  else delete playerTargets[type];
                  if (Object.keys(playerTargets).length) battingTargets[playerId] = playerTargets;
                  else delete battingTargets[playerId];
                  updatePlan({ battingTargets });
                }} />
            ))}
            <BattingSpecialRulesCard key={`${scenario}-special`} rules={specialRules}
              chasing={scenario === "bowlingFirst"} onChange={battingTeamRules => updatePlan({ battingTeamRules })} />
          </div>
        </>}

        {tab === "decisions" && <>

          <section className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-anton text-lg uppercase">Team approach</h3>
                <p className="text-xs text-text-secondary">Team presets set defaults. Each XI can set its own batting approach and player instructions.</p>
              </div>
              {coachRecommendation && <button className={buttonStyle} onClick={() => onChange({ ...coachRecommendation.tactics, matchPlans: tactics.matchPlans, oppositionApproaches: tactics.oppositionApproaches, oppositionTargetBowlers: tactics.oppositionTargetBowlers, opponentPlanChanges: tactics.opponentPlanChanges, bowlerBattingInstructions: tactics.bowlerBattingInstructions })}><Sparkles size={13} className="mr-2 inline" />Apply {coachRecommendation.coachName}&apos;s approach · {coachRecommendation.tactics.preset}</button>}
            </div>
            <div className="grid grid-cols-2 gap-2">{TEAM_STRATEGIES.map(preset => <button key={preset} aria-pressed={tactics.preset === preset} onClick={() => onChange(applyTeamTacticsPreset(tactics, preset))} className={`rounded border p-3 text-left ${tactics.preset === preset ? "border-accent bg-accent/10" : "border-border hover:border-accent"}`}><strong className="font-barlow-condensed text-lg uppercase">{preset}</strong><p className="mt-1 text-xs text-text-secondary">{STRATEGY_DESCRIPTIONS[preset]}</p></button>)}</div>

          </section>


        </>}

        {tab === "opposition" && <>
          <section className="rounded-lg border border-border bg-surface p-1.5" aria-label="Choose opposition team">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-9" role="group" aria-label="Opposition team">
              {oppositionTeams.map(team => {
                const selected = selectedOpposition === team.id;
                const primary = team.primaryColor || "#64748b";
                const secondary = team.secondaryColor || "#ffffff";
                return (
                  <button key={team.id} type="button" aria-label={team.name} title={team.name} aria-pressed={selected}
                    onClick={() => setOppositionTeamId(team.id)}
                    style={{
                      backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${primary} ${selected ? 38 : 19}%, var(--surface)), var(--surface))`,
                      borderColor: `color-mix(in srgb, ${primary} ${selected ? 85 : 48}%, var(--border))`,
                      boxShadow: `inset 0 -3px 0 ${primary}${selected ? `, inset 0 0 0 1px ${primary}` : ""}`,
                    }}
                    className="flex min-w-0 items-center justify-center gap-2 rounded border px-2 py-1 font-barlow text-base font-extrabold leading-tight text-text-primary transition-[filter] hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
                    <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full border" style={{ backgroundColor: primary, borderColor: secondary }} />
                    <span>{team.shortName}</span>
                  </button>
                );
              })}
            </div>
          </section>
          {selectedOpposition && <OppositionLineupPreview defaultPlan={normalizedPlan} planChanges={tactics.opponentPlanChanges?.[selectedOpposition]?.[scenario] ?? { batting: {}, bowling: {} }} onPlanChanges={(changes) => onChange({ ...tactics, opponentPlanChanges: { ...tactics.opponentPlanChanges, [selectedOpposition]: { ...tactics.opponentPlanChanges?.[selectedOpposition], [scenario]: changes } } })} instructions={tactics.bowlerBattingInstructions ?? {}} onInstructionChange={(id, instruction) => onChange({ ...tactics, bowlerBattingInstructions: { ...tactics.bowlerBattingInstructions, [id]: instruction } })} fixtures={props.fixtures} battingXI={xi.map(id => players[id]).filter((p): p is Player => Boolean(p))} key={selectedOpposition} team={leagueTeams[selectedOpposition]} players={players} onOpenPlayer={onOpenPlayer} approaches={tactics.oppositionApproaches ?? {}} onApproachChange={(playerId, approach) => onChange({ ...tactics, oppositionApproaches: { ...tactics.oppositionApproaches, [playerId]: approach } })} bowlers={attack} targetBowlers={tactics.oppositionTargetBowlers ?? {}} onTargetBowlerChange={(playerId, bowlerId) => {
            const targets = { ...tactics.oppositionTargetBowlers };
            if (bowlerId) targets[playerId] = bowlerId; else delete targets[playerId];
            onChange({ ...tactics, oppositionTargetBowlers: targets });
          }} />}
        </>}

      </main>

      {tab === "bowling" && <aside className="flex min-w-0 flex-col gap-3">
        <section className="rounded-lg border border-border bg-surface p-3"><h3 className="mb-3 flex items-center gap-2 font-anton text-lg uppercase">{warnings.length ? <TriangleAlert size={17} className="text-amber-500" /> : <CheckCircle2 size={17} className="text-emerald-500" />}Plan check</h3>

          <div className="grid grid-cols-3 gap-2 text-center">{[[fixedCount, "Fixed"], [preferredCount, "Preferred"], [20 - fixedCount - preferredCount, "Auto"]].map(([value, label]) => <div key={label} className="rounded bg-accent/5 py-2"><strong className="block font-barlow-condensed text-2xl font-bold">{value}</strong><small className="text-[10px] text-text-secondary">{label}</small></div>)}</div>

          <div className="mt-3 space-y-2 text-xs leading-relaxed">{warnings.map((warning, i) => <p key={i} className="text-amber-500">{warning}</p>)}{!warnings.length && <p className="text-emerald-500">No assignment conflicts. Auto overs remain with the captain.</p>}{xi.length !== 11 && <p className="text-amber-500">Complete your XI before playing.</p>}{floaters.some(rule => !playerList.some(p => p.id === rule.playerId)) && <p className="text-amber-500">A floater is outside this XI / Impact options.</p>}{assignedNames.some(id => !xi.includes(id)) && <p className="text-text-secondary">Impact bowlers can only bowl after entering the match.</p>}</div>

        </section>

        <section className="rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed text-text-secondary"><h3 className="mb-2 font-anton text-base uppercase text-text-primary">How the plan plays</h3><p><strong className="text-text-primary">Fixed</strong> overs are protected when legal. <strong className="text-text-primary">Preferred</strong> gives the captain flexibility. Empty overs are automatic.</p><p className="mt-2">Live manual choices take priority. Injuries and substitutions trigger a legal replacement. In shortened innings, final-five-over assignments move to the finish.</p><p className="mt-2">Player roles, the floater and over assignments belong to this XI plan.</p><p className="mt-2 text-accent">Changes save automatically.</p></section>

      </aside>}

    </div>

  </div>;

}

