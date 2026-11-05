"use client";

import { useEffect, useState } from "react";
import { floaterRuleError, MAX_BATTING_FLOATERS, type FloaterRule } from "@/lib/logic/tacticalMatchPlan";
import type { Player } from "@/lib/types";

const selectStyle = "h-5 w-full min-w-0 rounded border border-border bg-surface px-1.5 text-[11px] text-text-primary";
const labelStyle = "grid min-w-0 gap-px font-space-mono text-[9px] leading-none text-text-secondary";
const numbers = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

export default function BattingFloaterCard({ players, order, rules, chasing, onChange }: {
  players: readonly Player[];
  order: readonly string[];
  rules: readonly FloaterRule[];
  chasing: boolean;
  onChange: (rules: FloaterRule[]) => void;
}) {
  const [active, setActive] = useState(0);
  const [draft, setDraft] = useState<FloaterRule | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { setDraft(null); setError(""); }, [rules]);
  const rule = draft ?? rules[active] ?? null;
  const candidates = players.flatMap(player => {
    const slot = order.indexOf(player.id) + 1;
    return slot > 3 ? [{ player, slot }] : [];
  });
  const selected = candidates.find(({ player }) => player.id === rule?.playerId);
  const hasThreshold = rule?.trigger === "wickets" || rule?.trigger === "required-rate";
  const maxSlot = selected ? selected.slot - 1 : 3;
  const minSlot = rule?.trigger === "wickets" ? (rule.wickets ?? 3) + 2 : 3;
  const earliest = Math.max(minSlot, Math.min(rule?.earliestPosition ?? 4, maxSlot));
  const latest = Math.min(rule?.latestPosition ?? 6, maxSlot);
  const save = (candidate: FloaterRule) => {
    const slot = order.indexOf(candidate.playerId) + 1;
    const maxPosition = slot - 1;
    const wickets = Math.max(1, Math.min(candidate.wickets ?? 3, maxPosition - 2));
    const minimum = candidate.trigger === "wickets" ? wickets + 2 : 3;
    const earliestPosition = Math.min(maxPosition, Math.max(minimum, candidate.earliestPosition));
    const next = { ...candidate, ...(candidate.trigger === "wickets" ? { wickets } : {}), earliestPosition,
      latestPosition: Math.min(maxPosition, Math.max(earliestPosition, candidate.latestPosition)) };
    const problem = floaterRuleError(next, order, rules.filter((_, index) => index !== active));
    setError(problem ?? "");
    if (problem) { setDraft(next); return; }
    setDraft(null);
    onChange(active < rules.length ? rules.map((value, index) => index === active ? next : value) : [...rules, next]);
  };
  const update = (patch: Partial<FloaterRule>) => {
    if (rule && selected) save({ ...rule, ...patch });
  };
  const remove = () => {
    setDraft(null); setError("");
    onChange(rules.filter((_, index) => index !== active));
    setActive(Math.max(0, active - 1));
  };

  return (
    <section aria-label="Batting floater" className="flex w-full max-w-[270px] flex-col rounded-lg border border-border bg-surface px-2.5 py-2"
      style={{ backgroundImage: "linear-gradient(145deg, rgb(244 63 94 / 0.12), transparent 75%)", boxShadow: "inset 0 2px 0 rgb(251 113 133 / 0.7)" }}>
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <h3 className="flex items-center gap-1 font-anton text-sm uppercase leading-tight" title="Up to three non-conflicting floaters. Moves up at the next eligible wicket."><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />Batting floaters</h3>
        <div className="flex items-center gap-0.5">
          {rules.map((value, index) => <button key={value.playerId} type="button" aria-label={`Edit floater ${index + 1}`} aria-pressed={active === index}
            title={players.find(player => player.id === value.playerId)?.name}
            onClick={() => { setActive(index); setDraft(null); setError(""); }}
            className={`h-4 w-4 rounded-sm border text-[9px] ${active === index ? "border-accent bg-accent/15 text-text-primary" : "border-border text-text-secondary"}`}>{index + 1}</button>)}
          <button type="button" aria-label="Add floater" disabled={rules.length >= MAX_BATTING_FLOATERS || (active >= rules.length && rules.length > 0)}
            onClick={() => { setActive(rules.length); setDraft(null); setError(""); }} className="h-4 w-4 rounded-sm border border-border text-xs disabled:opacity-30">+</button>
          <button type="button" aria-label="Remove selected floater" disabled={!rule} onClick={remove} className="h-4 w-4 rounded-sm border border-border text-xs disabled:opacity-30">×</button>
        </div>
      </div>
      {error && <p role="alert" className="mb-1 text-[9px] leading-tight text-red-600 dark:text-red-400">{error} Draft not applied.</p>}
        {rule && selected && (rule.earliestPosition > maxSlot || rule.protectCollapse) && (
          <p className="mt-0.5 text-[10px] leading-tight text-text-secondary">
            {rule.earliestPosition > maxSlot
              ? "This player has moved up. Set a new slot range to enable promotion."
              : "Early collapse protection applies."}
          </p>
        )}
      <div className="grid flex-1 grid-cols-2 content-between gap-x-2 gap-y-1">
        <label className={`${labelStyle} col-span-2`}>
          Player
          <select className={selectStyle} value={rule?.playerId ?? ""} onChange={event => {
            const candidate = candidates.find(({ player }) => player.id === event.target.value);
            if (!candidate) return remove();
            save({
              playerId: candidate.player.id,
              earliestPosition: Math.min(4, candidate.slot - 1),
              latestPosition: Math.min(6, candidate.slot - 1),
              fromOver: 14, trigger: "over", requiredRate: 10,
            });
          }}>
            <option value="">No floater</option>
            {rule && !selected && <option value={rule.playerId}>Unavailable in this batting order</option>}
            {candidates.map(({ player, slot }) => <option key={player.id} value={player.id} disabled={rules.some((other, index) => index !== active && other.playerId === player.id)}>No. {slot} · {player.name}</option>)}
          </select>
        </label>
        {rule && selected && <>
          <label className={labelStyle}>
            From over
            <select className={selectStyle} value={rule.fromOver} onChange={event => {
              const fromOver = Number(event.target.value);
              update({ fromOver, untilOver: Math.max(fromOver, rule.untilOver ?? 20) });
            }}>
              {numbers(1, 20).map(over => <option key={over} value={over}>{over}</option>)}
            </select>
          </label>
          <label className={labelStyle}>
            Through over
            <select className={selectStyle} value={rule.untilOver ?? 20} onChange={event => update({ untilOver: Number(event.target.value) })}>
              {numbers(rule.fromOver, 20).map(over => <option key={over} value={over}>{over}</option>)}
            </select>
          </label>
          <label className={labelStyle}>
            Earliest slot
            <select className={selectStyle} value={earliest} onChange={event => {
              const earliestPosition = Number(event.target.value);
              update({ earliestPosition, latestPosition: Math.max(earliestPosition, latest) });
            }}>
              {numbers(minSlot, maxSlot).map(slot => <option key={slot} value={slot}>No. {slot}</option>)}
            </select>
          </label>
          <label className={labelStyle}>
            Latest slot
            <select className={selectStyle} value={latest} onChange={event => update({ latestPosition: Number(event.target.value) })}>
              {numbers(earliest, maxSlot).map(slot => <option key={slot} value={slot}>No. {slot}</option>)}
            </select>
          </label>
          <label className={`${labelStyle} ${hasThreshold ? "" : "col-span-2"}`}>
            Trigger
            <select className={selectStyle} value={rule.trigger} onChange={event => update({ trigger: event.target.value as FloaterRule["trigger"] })}>
              <option value="over">Any bowling</option>
              <option value="spin">Spin</option>
              <option value="pace">Pace</option>
              <option value="wickets">Wickets down</option>
              {(chasing || rule.trigger === "required-rate") && <option value="required-rate">Chase pressure</option>}
            </select>
          </label>
          {rule.trigger === "wickets" && <label className={labelStyle}>
            Wickets down
            <select className={selectStyle} value={rule.wickets ?? 3} onChange={event => update({ wickets: Number(event.target.value) })}>
              {numbers(1, Math.max(1, maxSlot - 2)).map(wickets => <option key={wickets} value={wickets}>{wickets}+</option>)}
            </select>
          </label>}
          {rule.trigger === "required-rate" && <label className={labelStyle}>
            Required RPO
            <select className={selectStyle} value={rule.requiredRate} onChange={event => update({ requiredRate: Number(event.target.value) })}>
              {numbers(1, 30).map(rate => <option key={rate} value={rate}>{rate}+</option>)}
            </select>
          </label>}
        </>}
      </div>
    </section>
  );
}
