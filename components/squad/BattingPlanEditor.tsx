"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import BattingRuleMarkers from "./BattingRuleMarkers";
import type { Player } from "@/lib/types";
import { battingFitPhases as columns, battingReviewCategories, prepareBattingRoleFit, reviewBattingPhasePlan, suggestLineupBattingCoverage, type BattingReviewCategory, type BattingRoleFit } from "@/lib/logic/battingRoleFit";
import type { TeamTactics } from "@/lib/logic/teamTactics";
import {
  normalizeTacticalMatchPlan,
  getFloaterRules,
  type BattingCoverage, type BattingCoverageIntent, type BattingCoveragePhase, type TacticalMatchPlan,
} from "@/lib/logic/tacticalMatchPlan";

type GridPhase = Exclude<BattingCoveragePhase, "chase">;
const coverageLabels: Record<GridPhase, string> = {
  powerplay: "Powerplay", earlyMiddle: "Early middle", lateMiddle: "Late middle", death: "Death overs",
};
const coverageRanges = { powerplay: "1–6", earlyMiddle: "7–11", lateMiddle: "12–15", death: "16–20" };
const phaseColors: Record<GridPhase, string> = {
  powerplay: "[--batting-phase:#f59e0b]",
  earlyMiddle: "[--batting-phase:#0ea5e9]",
  lateMiddle: "[--batting-phase:#10b981]",
  death: "[--batting-phase:#a78bfa]",
};
const phaseTint = "bg-[color-mix(in_srgb,var(--batting-phase)_10%,var(--surface))]";
const phaseHeading = "bg-[color-mix(in_srgb,var(--batting-phase)_23%,var(--surface))] text-[color:color-mix(in_srgb,var(--batting-phase)_42%,var(--ink))]";
const gridBorder = "border-[color:var(--batting-grid-line)]";
const choiceGrid = "grid w-full grid-cols-5";
const playerText = "text-xs font-semibold leading-tight";
const coverageChoices = [
  { value: "survive", label: "Survive", fullLabel: "Survive" },
  { value: "protect", label: "Rotate", fullLabel: "Rotate strike" },
  { value: "steady", label: "Steady", fullLabel: "Steady" },
  { value: "attack", label: "Attack", fullLabel: "Attack" },
  { value: "all-out", label: "All-out", fullLabel: "All-out" },
] as const;

const suitabilityColors = [
  "#c83232", "#c83232", "#d14530", "#db5c2c", "#df7524", "#e3901b",
  "#dfa916", "#d3aa16", "#9bac24", "#57a53b", "#23984a",
];

function RoleFitMeter({ playerName, roleName, fit }: { playerName: string; roleName: string; fit: BattingRoleFit }) {
  const tooltipId = useId();
  const [anchor, setAnchor] = useState<CSSProperties | null>(null);
  const { score, factors } = fit;

  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [anchor]);

  const show = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const width = Math.min(276, window.innerWidth - 16);
    const spaceAbove = rect.top - 14;
    const spaceBelow = window.innerHeight - rect.bottom - 14;
    const above = spaceAbove >= 250 || spaceAbove >= spaceBelow;
    setAnchor({
      width,
      left: Math.max(8, Math.min(rect.left + (rect.width - width) / 2, window.innerWidth - width - 8)),
      maxHeight: Math.max(0, above ? spaceAbove : spaceBelow),
      ...(above ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    });
  };

  return (
    <>
      <div role="meter" tabIndex={0} aria-label={`Role fit for ${playerName}`}
        aria-valuemin={0} aria-valuemax={10} aria-valuenow={score} aria-valuetext={`${score} out of 10`}
        aria-describedby={anchor ? tooltipId : undefined}
        onMouseEnter={event => show(event.currentTarget)} onMouseLeave={() => setAnchor(null)}
        onFocus={event => show(event.currentTarget)} onBlur={() => setAnchor(null)}
        onKeyDown={event => { if (event.key === "Escape") setAnchor(null); }}
        className="cursor-help rounded-sm focus-visible:outline focus-visible:outline-accent">
        <span aria-hidden="true" className="flex gap-0.5">
          {Array.from({ length: 10 }, (_, index) => (
            <span key={index} className="h-2.5 w-1 rounded-[1px] bg-[color:var(--batting-grid-line)]"
              style={index < score ? { backgroundColor: suitabilityColors[score] } : undefined} />
          ))}
        </span>
      </div>
      {anchor && createPortal(
        <div id={tooltipId} role="tooltip" style={anchor}
          className="pointer-events-none fixed z-[110] overflow-hidden rounded-lg border border-accent/60 bg-surface text-text-primary shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-accent/30 bg-accent/10 px-3 py-2">
            <div className="min-w-0">
              <div className="font-space-mono text-[9px] font-bold uppercase tracking-widest text-accent">Batting role fit</div>
              <div className="mt-0.5 font-barlow-condensed text-base font-bold leading-tight">{roleName}</div>
              <div className="font-barlow text-[11px] leading-tight text-text-secondary">{fit.positionDemand}</div>
            </div>
            <div className="shrink-0 rounded border border-accent/40 bg-surface px-2 py-1 text-center">
              <span className="font-anton text-xl leading-none">{score}</span>
              <span className="ml-0.5 font-space-mono text-[10px] text-text-secondary">/10</span>
            </div>
          </div>
          <dl className="space-y-0.5 px-3 py-2">
            {factors.map(({ label, points, max }) => (
              <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <dt className="font-barlow text-[11px] font-semibold leading-tight">{label}</dt>
                <dd className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-1 w-8 overflow-hidden rounded-full bg-border/40">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${(points / max) * 100}%` }} />
                  </span>
                  <span className="min-w-[7ch] whitespace-nowrap text-right font-space-mono text-[9px] tabular-nums">
                    {points.toFixed(2)}<span className="text-text-secondary">/{max}</span>
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-t border-border/40 px-3 py-1.5">
            <span className="font-space-mono text-[9px] font-bold tabular-nums text-text-secondary">{fit.total.toFixed(2)} pts before rounding</span>
            {fit.lowEvidence && <span className="font-barlow text-[10px] text-text-secondary">Some ratings estimated</span>}
          </div>
        </div>, document.body,
      )}
    </>
  );
}

// Role names follow the same order as the batting positions below.
const roleNames = {
  defensive: ["Watchful opener", "Top-order anchor", "Innings anchor", "Lower-order shield", "Tail-end blocker"],
  steady: ["Tempo opener", "Strike rotator", "Middle-order builder", "Lower-order stabiliser", "Tail-end partner"],
  powerplay: ["Powerplay enforcer", "Top-order enforcer", "Powerplay pinch hitter", "Lower-order pinch hitter", "Tail-end pinch hitter"],
  earlyMiddle: ["Post-powerplay hitter", "Middle-overs enforcer", "Middle-overs attacker", "Middle-overs pinch hitter", "Tail-end disruptor"],
  lateMiddle: ["Late-burst opener", "Late-overs accelerator", "Back-end accelerator", "Lower-order accelerator", "Tail-end accelerator"],
  finish: ["Set-batter finisher", "Top-order finisher", "Middle-order finisher", "Finisher", "Tail-end hitter"],
  build: ["Build-and-burst opener", "Innings builder", "Bridge batter", "Late-overs closer", "Tail-end closer"],
  pressure: ["Opening aggressor", "Top-order aggressor", "Middle-order aggressor", "Lower-order aggressor", "Tail-end aggressor"],
} as const;

function battingPlanStyle(coverage: BattingCoverage): keyof typeof roleNames {
  const { powerplay, earlyMiddle, lateMiddle, death } = coverage;
  const phases = [powerplay, earlyMiddle, lateMiddle, death];
  const isAggressive = (choice?: BattingCoverageIntent) => choice === "attack" || choice === "all-out";
  const isDefensive = (choice?: BattingCoverageIntent) => choice === "survive" || choice === "protect";

  if (isAggressive(death) && !isAggressive(powerplay) && !isAggressive(earlyMiddle)) {
    if (isAggressive(lateMiddle) || isDefensive(powerplay) || isDefensive(earlyMiddle)) return "build";
    return "finish";
  }
  if (phases.filter(isAggressive).length > 1) return "pressure";
  if (isAggressive(powerplay)) return "powerplay";
  if (isAggressive(earlyMiddle)) return "earlyMiddle";
  if (isAggressive(lateMiddle)) return "lateMiddle";
  return phases.some(isDefensive) ? "defensive" : "steady";
}

function battingPlanRole(player: Pick<Player, "role" | "currentBatting">, position: number, coverage: BattingCoverage = {}): string {
  const { powerplay, earlyMiddle, lateMiddle, death, chase } = coverage;
  const phases = [powerplay, earlyMiddle, lateMiddle, death];
  const allOutCount = phases.filter(choice => choice === "all-out").length;
  const chaseRole = chase === "attack" ? "Chase aggressor" : chase === "all-out" ? "Chase launcher" : "";
  const chaseLabel = chaseRole ? ` / ${chaseRole}` : "";
  if (allOutCount === phases.length) {
    const name = position === 1 || position === 2 ? "Explosive opener" : "Brute";
    return `${name}${chaseLabel}`;
  }
  if (phases.every(choice => !choice)) return chaseRole || "Team plan";

  const band = position === 0 ? 3 : position <= 2 ? 0 : position <= 4 ? 1 : position <= 6 ? 2 : position <= 8 ? 3 : 4;
  const style = battingPlanStyle(coverage);
  const bowls = player.role === "All-Rounder" || player.role === "Pace Bowler" || player.role === "Spin Bowler";
  const batting = player.currentBatting ?? 0;
  const closing = style === "finish" || style === "build";
  const holding = style === "defensive" || style === "steady";
  let name: string = roleNames[style][band];

  if (bowls && batting < 55) {
    if (band === 0) name = holding ? "Defensive opener" : "Pinch opener";
    else if (band <= 2) name = holding ? "Wicket guard" : "Promoted pinch hitter";
    else if (band === 3) name = holding ? "Lower-order blocker" : "Lower-order pinch hitter";
  } else if (bowls && batting < 74 && band >= 3 && !holding) {
    name = closing ? "Cameo finisher" : "Cameo hitter";
  } else if (bowls && batting >= 74 && band === 4) {
    if (holding) name = "Deep batting cover";
    else if (closing) name = "Deep finisher";
  }

  if (allOutCount > 0) {
    const intensity = allOutCount === 1 ? "Burst" : allOutCount === 2 ? "Power" : "Relentless";
    let hittingRole: string;
    if (bowls && batting < 55 && band < 4) hittingRole = band === 0 ? "pinch opener" : "pinch hitter";
    else if (bowls && batting >= 55 && batting < 74 && band >= 3) hittingRole = closing ? "cameo finisher" : "cameo hitter";
    else if (band === 0) hittingRole = closing ? "set-batter finisher" : "opener";
    else if (band === 4) hittingRole = bowls && batting >= 74 && closing ? "deep finisher" : "tail-end hitter";
    else if (closing) hittingRole = ["top-order finisher", "middle-order finisher", "finisher"][band - 1];
    else if (style === "powerplay") hittingRole = "enforcer";
    else if (style === "lateMiddle") hittingRole = "accelerator";
    else hittingRole = ["top-order hitter", "middle-order hitter", "lower-order hitter"][band - 1];
    name = `${intensity} ${hittingRole}`;
  }

  return `${name}${chaseLabel}`;
}

// Measure the available titles in the same font as the cells. Only the
// naming categories matter here, so use one value per rating and intent band.
const roleWidthTitles = (() => {
  const titles = new Set(["Team plan", "Chase aggressor", "Chase launcher"]);
  const intents = ["steady", "protect", "attack", "all-out"] as const;
  const profiles = [
    { role: "Batsman", currentBatting: 80 },
    ...[40, 65, 80].map(currentBatting => ({ role: "All-Rounder" as const, currentBatting })),
  ] as const;
  for (const player of profiles) for (const position of [1, 3, 5, 7, 9]) {
    for (const powerplay of intents) for (const earlyMiddle of intents) {
      for (const lateMiddle of intents) for (const death of intents) {
        titles.add(battingPlanRole(player, position, { powerplay, earlyMiddle, lateMiddle, death }));
      }
    }
  }
  return Array.from(titles);
})();

export default function BattingPlanEditor({ plan, otherPlan, players, order, tactics, chasing, impact, onChange, onOpenPlayer }: {
  plan: TacticalMatchPlan; players: Player[]; order: string[];
  otherPlan?: TacticalMatchPlan;
  tactics: TeamTactics; chasing: boolean;
  impact?: { incoming: string; outgoing: string };
  onChange: (update: Partial<TacticalMatchPlan>) => void; onOpenPlayer: (id: string) => void;
}) {
  const [reviewCategory, setReviewCategory] = useState<BattingReviewCategory>("Overview");
  const normalizedPlan = normalizeTacticalMatchPlan(plan);
  const battingCoverage = normalizedPlan.battingCoverage ?? {};
  const fitContext = {
    lineup: players,
    order,
    coverage: battingCoverage,
    tactics: { ...tactics, batting: { ...tactics.batting, ...normalizedPlan.response } },
    chasing,
  };
  const rows = players.map(player => {
    const position = order.indexOf(player.id) + 1;
    const coverage = battingCoverage[player.id] ?? {};
    const assessment = prepareBattingRoleFit(player, position, fitContext);
    const suggestedCoverage = assessment.suggest(coverage);
    return {
      player, position, coverage, suggestedCoverage,
      fit: assessment.evaluate(coverage),
      roleName: battingPlanRole(player, position, coverage),
      hasSuggestion: columns.some(phase => suggestedCoverage[phase] !== coverage[phase]),
    };
  });
  const review = reviewBattingPhasePlan(fitContext, new Map(rows.map(row => [row.player.id, row.fit])))[reviewCategory];
  const autoSelectAll = () => {
    const next = suggestLineupBattingCoverage(fitContext);
    if (rows.some(({ player, coverage }) => columns.some(phase => next[player.id]?.[phase] !== coverage[phase]))) {
      onChange({ roles: {}, battingCoverage: next });
    }
  };
  const otherCoverage = otherPlan ? normalizeTacticalMatchPlan(otherPlan).battingCoverage : undefined;
  const copyableRows = rows.filter(({ player, coverage }) =>
    columns.some(phase => coverage[phase] !== otherCoverage?.[player.id]?.[phase]),
  );
  const copyOtherPlan = () => {
    const next = { ...battingCoverage };
    for (const { player, coverage } of copyableRows) {
      const copied = { ...coverage };
      for (const phase of columns) {
        const instruction = otherCoverage?.[player.id]?.[phase];
        if (instruction) copied[phase] = instruction;
        else delete copied[phase];
      }
      next[player.id] = copied;
    }
    if (copyableRows.length) onChange({ roles: {}, battingCoverage: next });
  };
  const clearableRows = rows.filter(({ coverage }) => columns.some(phase => coverage[phase] !== undefined));
  const clearAll = () => {
    if (!clearableRows.length) return;
    const next = { ...battingCoverage };
    for (const { player, coverage } of clearableRows) {
      const cleared = { ...coverage };
      for (const phase of columns) delete cleared[phase];
      next[player.id] = cleared;
    }
    onChange({ roles: {}, battingCoverage: next });
  };

  const grid = "xl:grid-cols-[minmax(9rem,11rem)_2.25rem_repeat(4,minmax(0,11rem))_minmax(61px,1fr)_max-content_max-content] min-[1440px]:grid-cols-[minmax(9rem,11rem)_2.25rem_repeat(4,minmax(0,11rem))_minmax(61px,1fr)_max-content_max-content_10rem]";
  const rowGrid = "xl:col-start-1 xl:col-span-9 xl:[grid-template-columns:subgrid]";

  return <section className="rounded-lg border border-border bg-surface p-3 xl:shrink-0 [--batting-grid-line:color-mix(in_srgb,var(--ink)_46%,var(--surface))]">
    {/* Reserve the full XI's tracks so review copy and empty selections cannot resize the tile. */}
    <div className={`xl:grid xl:[grid-template-rows:26px_33px_repeat(11,20px)] ${grid}`}>
      <div className={`mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 xl:grid xl:gap-x-0 ${rowGrid}`}>
        {/* The toolbar copy can wrap within the table without widening its columns. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 xl:relative xl:col-span-8 xl:pr-52 xl:[contain:inline-size]">
          <h3 className="font-anton text-sm uppercase">Player batting plan</h3>
          <p className="text-xs text-text-secondary">Select a phase instruction. Select it again to follow the team plan.</p>
          <p className="text-xs text-text-secondary"><strong className="text-text-primary">!</strong> Better fit for this phase</p>
          <div className="flex items-center gap-1 xl:absolute xl:right-1 xl:top-1/2 xl:-translate-y-1/2">
            <button type="button" onClick={clearAll} disabled={!clearableRows.length}
              title="Clear batting phase selections for this XI"
              className="whitespace-nowrap rounded border border-accent/50 bg-accent/10 px-1.5 py-0.5 font-space-mono text-[10px] font-bold text-text-primary enabled:hover:bg-accent/20 focus-visible:outline focus-visible:outline-accent disabled:opacity-40">
              Clear All
            </button>
            <button type="button" onClick={copyOtherPlan} disabled={!copyableRows.length}
              title={chasing ? "Copy player batting instructions from Bat First" : "Copy player batting instructions from Bowl First / Chase"}
              className="whitespace-nowrap rounded border border-accent/50 bg-accent/10 px-1.5 py-0.5 font-space-mono text-[10px] font-bold text-text-primary enabled:hover:bg-accent/20 focus-visible:outline focus-visible:outline-accent disabled:opacity-40">
              Copy Other Plan
            </button>
          </div>
        </div>
        <button type="button" onClick={autoSelectAll} disabled={!rows.length}
          className="justify-self-end whitespace-nowrap rounded border border-accent/50 bg-accent/10 px-1.5 py-0.5 font-space-mono text-[10px] font-bold text-text-primary enabled:hover:bg-accent/20 focus-visible:outline focus-visible:outline-accent disabled:opacity-40 xl:mr-2">
          Auto Select All
        </button>
      </div>
      <div className={`hidden items-end text-center text-[10px] uppercase leading-3 text-text-secondary xl:grid ${rowGrid}`}>
        <span className="text-left font-space-mono">Batter</span>
        <span className="font-space-mono">Hand</span>
        {columns.map(column => <div key={column} className={`overflow-hidden rounded-t-sm border border-r-0 ${gridBorder} ${phaseColors[column]} ${phaseTint}`}>
          <div className={`border-b py-0.5 font-space-mono font-bold ${gridBorder} ${phaseHeading}`}>
            {coverageLabels[column]}<span> · {coverageRanges[column]}</span>
          </div>
          <div className={`${choiceGrid} font-barlow-condensed text-[9px] font-semibold normal-case text-text-primary`}>
            {coverageChoices.map(({ value, label }) => <span key={value} className={`whitespace-nowrap border-r py-px last:border-r-0 ${gridBorder}`}>{label}</span>)}
          </div>
        </div>)}
        <span className={`self-stretch content-end border-l px-0.5 text-left font-space-mono ${gridBorder}`}>Rules</span>
        <div className={`self-stretch content-end border-l pl-2 text-left ${gridBorder}`}>
          <div className="font-space-mono text-xs font-bold leading-none">Role</div>
          <div aria-hidden="true" className={`invisible h-0 overflow-hidden whitespace-nowrap normal-case ${playerText}`}>
            {roleWidthTitles.map(title => <div key={title}>{title}</div>)}
          </div>
        </div>
        <span className="self-stretch content-end px-2 text-left font-space-mono text-xs font-bold leading-none">Role fit</span>
      </div>
      {rows.map(({ player, position, coverage, roleName, fit, suggestedCoverage, hasSuggestion }) => {
        const battingHand = player.battingStyle === "Left-hand" ? "LHB" : player.battingStyle === "Right-hand" ? "RHB" : "—";
        const saveCoverage = (next: BattingCoverage) => {
          onChange({ roles: {}, battingCoverage: { ...battingCoverage, [player.id]: next } });
        };
        const autoSelectRole = () => {
          if (hasSuggestion) saveCoverage(suggestedCoverage);
        };
        return <div key={player.id} className={`grid grid-cols-1 items-center gap-1 border-b py-0.5 sm:grid-cols-2 lg:grid-cols-3 xl:items-stretch xl:gap-0 xl:py-0 ${gridBorder} ${rowGrid}`}>
          <div className="flex min-w-0 items-center gap-2">
            <span className="w-4 shrink-0 font-space-mono text-xs text-accent">{position || "IP"}</span>
            <div className={`flex min-w-0 items-center gap-1 ${playerText}`}>
              <button type="button" className="min-w-0 text-left hover:text-accent hover:underline"
                aria-label={`Open ${player.name} profile`} onClick={() => onOpenPlayer(player.id)}>{player.name}</button>
              {impact?.incoming === player.id && (
                <span title={`Replaces ${impact.outgoing}`}
                  className="shrink-0 rounded-sm bg-accent/15 px-1 py-px font-space-mono text-[8px] font-bold leading-none text-accent">
                  Impact
                </span>
              )}
            </div>
          </div>
          <span title={player.battingStyle} className="self-center text-center font-space-mono text-[9px] font-bold text-text-secondary">
            {battingHand}
          </span>
          {columns.map(column => {
            const activeChoice = coverage[column];
            const setChoice = (value?: BattingCoverageIntent) => {
              const next = { ...coverage };
              if (value) next[column] = value;
              else delete next[column];
              saveCoverage(next);
            };
            return (
            <div key={column} className={`flex min-w-0 flex-col xl:border-l ${gridBorder} ${phaseColors[column]}`}>
              <span className={`mb-0.5 block rounded px-1 text-[10px] font-bold uppercase xl:hidden ${phaseHeading}`}>{coverageLabels[column]}</span>
                <fieldset className={`${choiceGrid} min-w-0 flex-1 rounded-sm border xl:rounded-none xl:border-0 ${gridBorder} ${phaseTint}`}
                  aria-label={coverageLabels[column] + " approach for " + player.name}>
                  {coverageChoices.map(({ value, label, fullLabel }) => {
                    const selected = value === activeChoice;
                    const recommended = !selected && value === suggestedCoverage[column];
                    const description = recommended ? `${fullLabel} · Better fit for this phase` : fullLabel;
                    return (
                      <button key={value} type="button" aria-label={description} aria-pressed={selected}
                        title={description} onClick={() => setChoice(selected ? undefined : value)}
                        className={`flex min-h-[22px] cursor-pointer items-center justify-center whitespace-nowrap border-r px-0.5 font-barlow-condensed text-[9px] font-semibold last:border-r-0 focus-visible:outline focus-visible:outline-accent xl:min-h-[19px] ${gridBorder} ${selected ? "bg-accent text-black" : "text-text-secondary hover:bg-accent/10"}`}>
                        <span className="xl:hidden">{label}</span>
                        {selected && <Check size={10} aria-hidden="true" className="hidden xl:block" />}
                        {recommended && <span aria-hidden="true" className="ml-0.5 text-[11px] font-extrabold leading-none text-text-primary xl:ml-0">!</span>}
                      </button>
                    );
                  })}
                </fieldset>
            </div>
            );
          })}
          <div className={`flex min-w-0 items-center xl:border-l ${gridBorder}`}>
            <span className="mr-1 text-xs text-text-secondary xl:hidden">Rules</span>
            <BattingRuleMarkers playerId={player.id} playerName={player.name}
              floaters={getFloaterRules(normalizedPlan)} targets={normalizedPlan.battingTargets?.[player.id]} />
          </div>
          <div className={`flex items-center gap-1 pl-2 xl:whitespace-nowrap xl:border-l ${playerText} ${gridBorder}`}>
            <span className="text-text-secondary xl:hidden">Role</span>
            <span className="xl:w-0 xl:min-w-full xl:whitespace-nowrap">{roleName}</span>
          </div>
          <div className={`flex items-center gap-2 px-2 ${playerText}`}>
            <span className="text-text-secondary xl:hidden">Role fit</span>
            <RoleFitMeter playerName={player.name} roleName={roleName} fit={fit} />
            <button type="button" onClick={autoSelectRole}
              aria-label={`Auto-select role for ${player.name}`}
              title="Choose the best fitting instruction in each batting phase"
              className="rounded px-1.5 text-[10px] leading-4 text-text-secondary ring-1 ring-inset ring-border hover:bg-accent/10 hover:text-text-primary focus-visible:outline focus-visible:outline-accent">
              Auto
            </button>
            <button type="button" onClick={() => {
              const cleared = { ...coverage };
              for (const phase of columns) delete cleared[phase];
              saveCoverage(cleared);
            }} disabled={!columns.some(phase => coverage[phase] !== undefined)}
              aria-label={`Clear batting phase selections for ${player.name}`}
              title={`Clear ${player.name}'s phase selections`}
              className="rounded px-1 text-[12px] leading-4 text-text-secondary ring-1 ring-inset ring-border enabled:hover:bg-accent/10 enabled:hover:text-text-primary focus-visible:outline focus-visible:outline-accent disabled:opacity-40">
              ×
            </button>
          </div>
        </div>;
      })}
      {rows.length > 0 && (
        <aside aria-label="Batting plan pros and cons"
          className="mt-2 px-2.5 py-2 xl:col-span-full min-[1440px]:col-span-1 min-[1440px]:col-start-10 min-[1440px]:row-start-1 min-[1440px]:[grid-row-end:span_13] min-[1440px]:min-h-0 min-[1440px]:overflow-y-auto min-[1440px]:w-40 min-[1440px]:justify-self-end min-[1440px]:mt-0">
          <label className="mb-2 flex items-center gap-2 font-space-mono text-[10px] font-bold uppercase text-text-secondary">
            Review
            <select value={reviewCategory} onChange={event => setReviewCategory(event.target.value as BattingReviewCategory)}
              className="min-w-0 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-normal normal-case text-text-primary min-[1440px]:flex-1">
              {battingReviewCategories.map(category => <option key={category}>{category}</option>)}
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2 min-[1440px]:grid-cols-1">
            {([
              { label: "Pros", items: review.pros, empty: "No clear strengths yet.", color: "text-emerald-600 dark:text-emerald-400" },
              { label: "Cons", items: review.cons, empty: "No issues flagged here.", color: "text-red-700 dark:text-red-400" },
            ]).map(({ label, items, empty, color }) => (
              <div key={label}>
                <h4 className={`font-space-mono text-[10px] font-bold uppercase ${color}`}>{label}</h4>
                {items.length ? (
                  <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[11px] leading-tight text-text-primary">
                    {items.map(item => <li key={item}>{item}</li>)}
                  </ul>
                ) : <p className="mt-0.5 text-[11px] leading-tight text-text-secondary">{empty}</p>}
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
    {!players.length && <p className="py-8 text-sm text-text-secondary">Select your XI to set batting approaches.</p>}
  </section>;
}
