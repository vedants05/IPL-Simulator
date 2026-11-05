"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import type { Player } from "@/lib/types";

export default function TacticalRoleCard({ heading, players, count = players.length, captainId, keeperLabels = false, onOpenPlayer }: {
  heading: string;
  players: Player[];
  count?: number;
  captainId?: string;
  keeperLabels?: boolean;
  onOpenPlayer?: (id: string) => void;
}) {
  const tooltipId = useId();
  const isFullTimeKeeper = (player: Player) => player.role === "WK-Batsman" || Boolean(player.isWicketkeeper);
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);
  const show = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setAnchor({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 252)), bottom: window.innerHeight - rect.top + 8 });
  };
  return (
    <div data-tactical-role={heading} tabIndex={0} aria-label={`${heading}: ${count} players`} aria-describedby={anchor ? tooltipId : undefined}
      onMouseEnter={e => show(e.currentTarget)} onMouseLeave={() => setAnchor(null)}
      onFocus={e => show(e.currentTarget)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setAnchor(null); }}
      onKeyDown={e => { if (e.key === "Escape") setAnchor(null); }}
      className="group flex h-full min-h-0 min-w-0 flex-col rounded border border-border/40 bg-black/[0.015] px-2 py-1.5 transition-colors hover:border-accent/50 hover:bg-accent/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent dark:bg-white/[0.02]">
      <div className="flex shrink-0 items-center justify-between gap-1">
        <span className="font-space-mono text-[7.5px] font-bold uppercase leading-tight tracking-wide text-text-secondary">{heading}</span>
        <span className="shrink-0 font-anton text-[19px] leading-none text-accent">{count}</span>
      </div>
      <div className="mt-1 min-w-0 space-y-0.5 border-l-2 border-accent/35 pl-1.5">
        {players.slice(0, 2).map(player => (
          <button key={player.id} type="button" onClick={() => onOpenPlayer?.(player.id)} className="block w-full break-words text-left font-barlow text-[10px] font-semibold leading-tight text-text-primary hover:underline">
            {player.name}{player.id === captainId && <span className="ml-1 text-[8px] text-accent">(C)</span>}
            {keeperLabels && <span title={isFullTimeKeeper(player) ? "Full-time keeper" : "Part-time keeper"} className="ml-1 rounded bg-accent/10 px-0.5 font-space-mono text-[7px] font-bold text-accent">{isFullTimeKeeper(player) ? "FT" : "PT"}</span>}
          </button>
        ))}
        {!players.length && <span className="font-barlow text-[10px] text-text-secondary">None</span>}
      </div>
      {players.length > 2 && <span className="mt-auto pt-0.5 font-space-mono text-[7px] text-text-secondary">+{players.length - 2} more · hover</span>}
      {anchor && createPortal(
        <div id={tooltipId} role="tooltip" style={{ left: anchor.left, bottom: anchor.bottom, maxHeight: `calc(100vh - ${anchor.bottom + 12}px)` }}
          className="pointer-events-none fixed z-[110] w-60 overflow-y-auto rounded-md border border-border bg-surface p-3 text-text-primary shadow-xl">
          <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-1.5">
            <span className="font-barlow-condensed text-sm font-bold uppercase">{heading}</span>
            <span className="font-space-mono text-[10px] text-accent">{count} players</span>
          </div>
          <div className="space-y-1 font-barlow text-xs">
            {players.map((player, index) => <div key={player.id} className="flex items-baseline gap-2"><span className="w-4 shrink-0 font-space-mono text-[9px] text-text-secondary">{index + 1}</span><span className="min-w-0 flex-1 break-words">{player.name}{player.id === captainId ? " (Captain)" : ""}</span>{keeperLabels && <span className="shrink-0 font-space-mono text-[8px] text-accent">{isFullTimeKeeper(player) ? "Full-time" : "Part-time"}</span>}</div>)}
            {!players.length && <span className="text-text-secondary">No players in this role</span>}
          </div>
        </div>, document.body,
      )}
    </div>
  );
}
