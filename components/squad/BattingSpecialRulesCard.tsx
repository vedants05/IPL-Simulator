"use client";

import { useState } from "react";
import { BATTING_SPECIAL_RULES, BATTING_RULE_PRIORITIES, MAX_BATTING_SPECIAL_RULES, type BattingSpecialRule, type BattingSpecialRuleKind } from "@/lib/logic/tacticalMatchPlan";

const field = "h-6 min-w-0 rounded border border-border bg-surface px-1 text-[11px] text-text-primary";
const action = "h-6 shrink-0 rounded border border-border px-1.5 text-[10px] hover:border-accent focus-visible:outline focus-visible:outline-accent disabled:opacity-40";
const kinds = Object.keys(BATTING_SPECIAL_RULES) as BattingSpecialRuleKind[];
const ruleHighlight = [
  "border-red-400/40 border-l-red-400 bg-red-400/10",
  "border-yellow-500/40 border-l-yellow-500 bg-yellow-400/15",
  "border-pink-400/40 border-l-pink-400 bg-pink-400/15",
] as const;

export default function BattingSpecialRulesCard({ rules: selected, chasing, onChange }: {
  rules: readonly BattingSpecialRule[];
  chasing: boolean;
  onChange: (value: BattingSpecialRule[]) => void;
}) {
  const [kind, setKind] = useState<BattingSpecialRuleKind>("boundary-target");
  function replace(index: number, patch: Partial<BattingSpecialRule>) {
    onChange(selected.map((rule, i) => i === index ? { ...rule, ...patch } : rule));
  }

  return (
    <section aria-label="Team batting rules" className="flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-surface px-2.5 py-2 sm:col-span-2 lg:col-span-3 min-[1360px]:col-span-1">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="shrink-0 font-anton text-sm uppercase leading-tight">Team batting rules</h3>
          <p className="text-[9px] leading-tight text-text-secondary" title="Highest matching priority wins; ties use the first listed rule. Guidance gently influences, Strong strongly influences, Must do overrides player plans. Targets remain subject to match outcomes.">Team-wide · Guidance / Strong / Must do</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-space-mono text-[9px] text-text-secondary">{selected.length}/3 active</span>
          <button type="button" className={action} disabled={!selected.length} onClick={() => onChange([])}>Clear all</button>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1">
        <select aria-label="Rule to add" className={field} value={kind} onChange={event => setKind(event.target.value as BattingSpecialRuleKind)}>
          {kinds.filter(value => chasing || value !== "chase-rate").map(value => <option key={value} value={value}>{BATTING_SPECIAL_RULES[value].label}</option>)}
        </select>
        <button type="button" className={action} disabled={selected.length >= MAX_BATTING_SPECIAL_RULES}
          onClick={() => onChange([...selected, {
            kind, threshold: BATTING_SPECIAL_RULES[kind].default, priority: 2,
            fromOver: kind === "finish" ? 16 : 1, untilOver: kind === "rebuild" ? 10 : 20,
          }])}>+ Add</button>
      </div>
      {!selected.length && <p className="mt-3 text-xs leading-relaxed text-text-secondary">Set shared boundary targets, rebuild after wickets or attack with wickets in hand. The boundary target counts both batters each over; targets guide decisions, not guaranteed outcomes.</p>}
      <div className="mt-1 grid min-h-0 flex-1 grid-rows-[repeat(3,minmax(0,1fr))] gap-1">
        {selected.map((rule, index) => {
          const spec = BATTING_SPECIAL_RULES[rule.kind];
          return <div key={index} className={`grid grid-cols-[minmax(0,1fr)_5.25rem_repeat(3,3rem)_auto] items-center gap-x-2 gap-y-1 rounded border border-l-2 px-1.5 ${ruleHighlight[index]}`}>
            <span className="min-w-0 text-[11px] leading-tight">{index + 1}. {spec.label}</span>
            <div className="grid justify-items-center gap-1 justify-self-center text-[8px] leading-none text-text-secondary">
              <span className="uppercase tracking-wider">{BATTING_RULE_PRIORITIES[rule.priority ?? 2].label}</span>
              <div role="group" aria-label={`Priority for rule ${index + 1}`} className="flex h-6 items-center gap-0.5 rounded border border-border bg-background/40 p-0.5">
                {([1, 2, 3] as const).map(priority => <button key={priority} type="button"
                  aria-label={`${priority}/3 ${BATTING_RULE_PRIORITIES[priority].label}`}
                  title={`${priority}/3 · ${BATTING_RULE_PRIORITIES[priority].label}`}
                  aria-pressed={(rule.priority ?? 2) === priority} onClick={() => replace(index, { priority })}
                  className={`flex h-full w-6 items-center justify-center rounded-sm transition-colors focus-visible:outline focus-visible:outline-accent ${(rule.priority ?? 2) === priority ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/60" : "text-text-secondary hover:bg-accent/10 hover:text-text-primary"}`}>
                  <span aria-hidden="true" className="flex h-3 items-end gap-0.5">
                    {([1, 2, 3] as const).map(level => <span key={level} className={`w-[3px] rounded-[1px] ${level <= priority ? "bg-current" : "bg-text-secondary/20"}`}
                      style={{ height: `${level * 3 + 2}px` }} />)}
                  </span>
                </button>)}
              </div>
            </div>
            <label className="grid gap-px whitespace-nowrap text-[8px] leading-none text-text-secondary">{spec.thresholdLabel === "Wickets down" ? "Wkts" : spec.thresholdLabel}
              <select aria-label={`${spec.thresholdLabel} for rule ${index + 1}`} className={`${field} w-11`} value={rule.threshold}
                onChange={event => replace(index, { threshold: Number(event.target.value) })}>
                {Array.from({ length: spec.max - spec.min + 1 }, (_, i) => spec.min + i).map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="grid gap-px text-[8px] leading-none text-text-secondary">From
              <select aria-label={`From over for rule ${index + 1}`} className={`${field} w-11`} value={rule.fromOver}
                onChange={event => { const fromOver = Number(event.target.value); replace(index, { fromOver, untilOver: Math.max(fromOver, rule.untilOver) }); }}>
                {Array.from({ length: 20 }, (_, i) => i + 1).map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="grid gap-px text-[8px] leading-none text-text-secondary">Through
              <select aria-label={`Through over for rule ${index + 1}`} className={`${field} w-11`} value={rule.untilOver}
                onChange={event => replace(index, { untilOver: Number(event.target.value) })}>
                {Array.from({ length: 21 - rule.fromOver }, (_, i) => rule.fromOver + i).map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <div className="flex items-end gap-0.5 pt-2">
              <button type="button" aria-label={`Remove rule ${index + 1}`} className={action}
                onClick={() => onChange(selected.filter((_, i) => i !== index))}>×</button>
            </div>
          </div>;
        })}
      </div>
    </section>
  );
}
