"use client";

import { useLayoutEffect, useRef } from "react";
import type { Player } from "@/lib/types";

export default function FittedRatingTiers({ tiers, onOpenPlayer }: {
  tiers: { label: string; players: Player[]; color: string; elite?: boolean }[];
  onOpenPlayer?: (id: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const fit = () => {
      // Prefer readable names and a balanced grid, then give crowded tiers more room.
      const tiles = Array.from(grid.children) as HTMLElement[];
      for (const size of [9.5, 9, 8.5, 8, 7.5, 7, 6]) {
        grid.style.setProperty("--tier-name-size", `${size}px`);
        for (const left of [50, 55, 60, 65, 70, 45, 40, 35, 30]) {
          grid.style.gridTemplateColumns = `${left}fr ${100 - left}fr`;
          for (const top of [50, 55, 60, 65, 70, 45, 40, 35, 30]) {
            grid.style.gridTemplateRows = `${top}fr ${100 - top}fr`;
            if (tiles.every(tile => {
              const names = tile.lastElementChild as HTMLElement;
              return names.scrollHeight <= names.clientHeight + 1 && names.scrollWidth <= names.clientWidth + 1;
            })) return;
          }
        }
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(grid);
    let disposed = false;
    void document.fonts.ready.then(() => { if (!disposed) fit(); });
    document.fonts.addEventListener("loadingdone", fit);
    return () => { disposed = true; observer.disconnect(); document.fonts.removeEventListener("loadingdone", fit); };
  }, [tiers]);

  return (
    <div ref={gridRef} data-rating-tiers className="mt-1.5 grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5">
      {tiers.map(tier => (
        <div key={tier.label} className={`flex min-h-0 min-w-0 flex-col rounded border p-1.5 ${tier.elite ? "border-accent/40 bg-accent/[0.04]" : "border-border/60 bg-black/[0.02] dark:bg-white/[0.02]"}`}>
          <div className="flex shrink-0 items-center justify-between gap-1 font-space-mono text-[8.5px] font-bold leading-tight">
            <span className={tier.color}>{tier.label}</span>
            <span className="font-anton text-[13px] text-text-primary">{tier.players.length}</span>
          </div>
          <div className="mt-1 flex min-h-0 min-w-0 flex-1 content-start flex-wrap gap-x-1 gap-y-0.5 overflow-hidden">
            {tier.players.map(player => (
              <button key={player.id} type="button" onClick={() => onOpenPlayer?.(player.id)}
                className={`max-w-full break-words rounded px-1 py-0.5 text-left font-barlow leading-tight text-text-primary hover:underline ${tier.elite ? "bg-accent/20 font-semibold" : "bg-black/5 dark:bg-white/10"}`}
                style={{ fontSize: "var(--tier-name-size, 9.5px)" }}>{player.name}</button>
            ))}
            {!tier.players.length && <span className="font-barlow text-[9px] italic text-text-secondary">None</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
