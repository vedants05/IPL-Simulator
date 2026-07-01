"use client";
import { useGameStore } from "@/lib/store/gameStore";

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

export default function SoldLog() {
  const { auction, players, teams } = useGameStore();

  if (!auction) return null;

  const history = [...(auction.saleHistory ?? [])].reverse();

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="px-4 py-2 border-b-2 border-border flex items-center justify-between shrink-0">
        <span className="font-space-mono font-bold text-[11px] tracking-widest text-text-primary uppercase">
          Sold Log
        </span>
        <span className="font-space-mono text-[9px] text-text-secondary">
          {history.length} · scroll ↑ from start
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="flex items-center justify-center h-20">
            <span className="font-space-mono text-[10px] text-text-secondary tracking-wider">
              No sales yet
            </span>
          </div>
        ) : (
          history.map((sale, i) => {
            const player = players[sale.playerId];
            const team = teams[sale.teamId];
            const isMarquee = sale.price >= 1000; // ≥₹10 Cr

            return (
              <div
                key={`${sale.playerId}-${i}`}
                className="flex items-center gap-3 px-4 py-[8px]"
                style={{
                  borderBottom: "1px solid rgba(22,19,15,.1)",
                  backgroundColor: isMarquee ? "#fff6d6" : undefined,
                }}
              >
                {/* Lot number */}
                <span className="font-barlow-condensed font-bold text-[11px] text-muted w-[28px] shrink-0">
                  L{sale.lot + 1}
                </span>

                {/* Player + team */}
                <div className="flex-1 min-w-0">
                  <div className="font-barlow font-semibold text-[11.5px] text-text-primary truncate leading-tight">
                    {player?.name ?? sale.playerId}
                  </div>
                  <div className="flex items-center gap-1 mt-[2px]">
                    <div
                      className="w-[7px] h-[7px] rounded-full shrink-0"
                      style={{ backgroundColor: team?.primaryColor ?? "#8a8378" }}
                    />
                    <span className="font-space-mono font-semibold text-[9px] text-text-secondary tracking-wide">
                      {team?.shortName ?? sale.teamId}
                    </span>
                  </div>
                </div>

                {/* Price */}
                <span
                  className="font-barlow-condensed font-bold text-[14px] shrink-0"
                  style={{ color: isMarquee ? "#d6492f" : "#16130f" }}
                >
                  {crore(sale.price)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
