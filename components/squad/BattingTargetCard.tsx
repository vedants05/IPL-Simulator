"use client";

import { useState } from "react";
import { toggleBattingTargetMode, type BattingTargets } from "@/lib/logic/tacticalMatchPlan";
import type { Player } from "@/lib/types";

const options = [
  { value: "attack", label: "Attack", description: "Raise this batter’s intent to at least Attack." },
  { value: "all-out", label: "All-out", description: "Raise this batter’s intent to All-out." },
  { value: "keep-strike", label: "Keep strike", description: "Favour even runs early in the over and odd runs on the last ball." },
  { value: "rotate", label: "Rotate strike", description: "Look for more singles and fewer dot balls." },
  { value: "boundaries", label: "Deal in boundaries", description: "Favour fours and sixes over singles." },
  { value: "see-off", label: "See it off", description: "Reduce risk and look for fewer boundaries." },
] as const;
const selectStyle = "h-5 w-full min-w-0 rounded border border-border bg-surface px-1.5 text-[11px] text-text-primary";
const labelStyle = "grid min-w-0 gap-px font-space-mono text-[9px] leading-none text-text-secondary";
const overs = Array.from({ length: 20 }, (_, index) => index + 1);

export default function BattingTargetCard({ type, players, targets, onChange }: {
  type: keyof BattingTargets;
  players: readonly Player[];
  targets: Readonly<Record<string, BattingTargets>>;
  onChange: (playerId: string, value: BattingTargets[typeof type]) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const player = players.find(candidate => candidate.id === selectedId) ?? players[0];
  const rule = player ? targets[player.id]?.[type] : undefined;
  const selected = rule?.modes ?? [];
  const assignedCount = players.filter(candidate => targets[candidate.id]?.[type]).length;
  const heading = type === "spin" ? "Target spin" : "Target pace";

  return (
    <section aria-label={heading} className="min-w-0 rounded-lg border border-border bg-surface px-2.5 py-2"
      style={type === "spin"
        ? { backgroundImage: "linear-gradient(145deg, rgb(180 147 107 / 0.18), transparent 75%)", boxShadow: "inset 0 2px 0 rgb(180 147 107 / 0.8)" }
        : { backgroundImage: "linear-gradient(145deg, rgb(161 161 170 / 0.15), transparent 75%)", boxShadow: "inset 0 2px 0 rgb(161 161 170 / 0.8)" }}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-anton text-sm uppercase leading-tight"><span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${type === "spin" ? "bg-[#b4936b]" : "bg-zinc-400"}`} />{heading}</h3>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-space-mono text-[9px] text-text-secondary">{assignedCount} assigned</span>
          <button type="button" disabled={!player || !selected.length} onClick={() => player && onChange(player.id, undefined)}
            aria-label={`Clear ${type} instructions for ${player?.name ?? "the selected batter"}`}
            className="min-h-6 rounded border border-accent/50 bg-accent/10 px-2 font-space-mono text-[11px] font-bold text-accent enabled:hover:bg-accent/20 focus-visible:outline focus-visible:outline-accent disabled:opacity-40">
            Clear
          </button>
        </div>
      </div>
      <label className={labelStyle}>
        Batter
        <select value={player?.id ?? ""} disabled={!player} onChange={event => setSelectedId(event.target.value)}
          className={selectStyle}>
          {!player && <option value="">No batters in this XI</option>}
          {players.map(candidate => {
            const instruction = targets[candidate.id]?.[type];
            return <option key={candidate.id} value={candidate.id}>
              {candidate.name}{instruction?.modes.length ? ` · ${instruction.modes.length} set` : ""}
            </option>;
          })}
        </select>
      </label>
      <p className="mt-1.5 font-space-mono text-[9px] leading-tight text-text-secondary">
        {selected.length ? "Combine approaches" : "Following phase plan"}
      </p>
      <div role="group" aria-label={`Approaches against ${type}`} className="mt-0.5 grid grid-cols-3 gap-1">
        {options.map(({ value, label, description }) => {
          const active = selected.includes(value);
          return <button key={value} type="button" title={description} disabled={!player} aria-pressed={active}
            onClick={() => {
              if (!player) return;
              const modes = toggleBattingTargetMode(selected, value);
              onChange(player.id, modes.length ? { fromOver: 1, untilOver: 20, ...rule, modes } : undefined);
            }}
            className={`min-h-6 rounded-sm border px-1 font-space-mono text-[9px] font-bold leading-tight disabled:opacity-40 ${active
              ? "border-accent bg-accent/15 text-text-primary"
              : "border-border text-text-secondary hover:border-accent/60 hover:text-text-primary"}`}>
            {label}
          </button>;
        })}
      </div>
      {player && rule && (
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <label className={labelStyle}>
            From over
            <select className={selectStyle} value={rule.fromOver} onChange={event => {
              const fromOver = Number(event.target.value);
              onChange(player.id, { ...rule, fromOver, untilOver: Math.max(fromOver, rule.untilOver) });
            }}>
              {overs.map(over => <option key={over} value={over}>{over}</option>)}
            </select>
          </label>
          <label className={labelStyle}>
            Through over
            <select className={selectStyle} value={rule.untilOver} onChange={event =>
              onChange(player.id, { ...rule, untilOver: Number(event.target.value) })}>
              {overs.slice(rule.fromOver - 1).map(over => <option key={over} value={over}>{over}</option>)}
            </select>
          </label>
        </div>
      )}
    </section>
  );
}
