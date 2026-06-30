"use client";
import { useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";

export default function AuctionSetNav() {
  const { auction, players } = useGameStore();
  const [openSet, setOpenSet] = useState<string | null>(auction?.sets[0]?.id ?? null);

  if (!auction) return null;

  const soldIds = new Set(auction.soldPlayerIds);
  const unsoldIds = new Set(auction.unsoldPlayerIds);

  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      <h4 className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Auction Sets</h4>
      {auction.sets.map((set, si) => {
        const sold = set.playerIds.filter((id) => soldIds.has(id)).length;
        const total = set.playerIds.length;
        const isCurrent = si === auction.currentSetIndex;
        const isOpen = openSet === set.id;

        return (
          <div key={set.id} className={`rounded border ${isCurrent ? "border-accent/60 bg-accent/5" : "border-border bg-surface"}`}>
            <button
              onClick={() => setOpenSet(isOpen ? null : set.id)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-surface2 rounded"
            >
              <span className={`font-medium ${isCurrent ? "text-accent" : "text-text-primary"}`}>
                {set.name}
              </span>
              <span className="text-text-secondary font-mono">{sold}/{total}</span>
            </button>

            {isOpen && (
              <div className="border-t border-border/50 px-3 pb-2 max-h-56 overflow-y-auto">
                {set.playerIds.map((id, pi) => {
                  const p = players[id];
                  const isCur = si === auction.currentSetIndex && pi === set.currentIndex;
                  const isSold = soldIds.has(id);
                  const isUnsold = unsoldIds.has(id);

                  return (
                    <div
                      key={id}
                      className={`flex items-center justify-between py-1.5 text-[11px] border-b border-border/30 last:border-0
                        ${isCur ? "text-gold font-semibold" : isSold ? "text-text-secondary" : isUnsold ? "text-danger/70" : "text-text-primary"}`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span>{isCur ? "→" : isSold ? "✓" : isUnsold ? "✗" : "·"}</span>
                        <span className="truncate max-w-[150px]">{p?.name ?? id}</span>
                      </span>
                      {isSold && p && (
                        <span className="text-gold font-mono text-[10px]">
                          {formatPrice(
                            p.iplHistory[p.iplHistory.length - 1]?.price ?? p.basePrice
                          )}
                        </span>
                      )}
                      {isUnsold && <span className="text-danger/70 text-[10px]">Unsold</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
