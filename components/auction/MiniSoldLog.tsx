"use client";
import { useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { AuctionState } from "@/lib/types";

type SaleEntry = AuctionState["saleHistory"][number];

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

function BidHistoryPopup({ sale, onClose }: { sale: SaleEntry; onClose: () => void }) {
  const { players, teams } = useGameStore();
  const player = players[sale.playerId];
  const buyerTeam = teams[sale.teamId];

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-50 flex flex-col bg-bg"
      style={{ border: "2px solid #16130f", maxHeight: "320px" }}
    >
      {/* Popup header */}
      <div
        className="flex items-center justify-between px-4 py-2 bg-border shrink-0"
        style={{ borderBottom: "2px solid #16130f" }}
      >
        <div className="min-w-0 flex-1">
          <div className="font-space-mono font-bold text-[9px] tracking-widest text-accent uppercase">
            LOT {sale.lot + 1} · BID HISTORY
          </div>
          <div className="font-barlow font-bold text-[12px] text-white truncate">
            {player?.name ?? sale.playerId}
          </div>
        </div>
        <button
          onClick={onClose}
          className="font-space-mono text-[11px] text-accent hover:text-white ml-3 shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Sold-to row */}
      <div className="flex items-center justify-between px-4 py-2 bg-accent shrink-0"
        style={{ borderBottom: "1px solid rgba(22,19,15,.3)" }}>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: buyerTeam?.primaryColor ?? "#8a8378" }}
          />
          <span className="font-barlow font-bold text-[12px] text-border">
            {buyerTeam?.shortName ?? sale.teamId}
          </span>
          <span className="font-space-mono font-bold text-[8px] tracking-wider bg-border text-accent px-1.5 py-[2px] rounded-[3px]">
            SOLD TO
          </span>
        </div>
        <span className="font-barlow-condensed font-bold text-[15px] text-border">
          {crore(sale.price)}
        </span>
      </div>

      {/* Bid history */}
      <div className="flex-1 overflow-y-auto">
        {sale.bids.length === 0 ? (
          <div className="flex items-center justify-center py-4">
            <span className="font-space-mono text-[9px] text-text-secondary tracking-wider">
              No bid history recorded
            </span>
          </div>
        ) : (
          sale.bids.map((bid, i) => {
            const team = teams[bid.teamId];
            return (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-[6px]"
                style={{ borderBottom: "1px solid rgba(22,19,15,.08)" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: team?.primaryColor ?? "#8a8378" }}
                  />
                  <span className="font-barlow font-semibold text-[11px] text-text-primary truncate">
                    {team?.shortName ?? bid.teamId}
                  </span>
                </div>
                <span className="font-barlow-condensed font-bold text-[13px] text-text-primary shrink-0 ml-2">
                  {crore(bid.amount)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function MiniSoldLog() {
  const { auction, players, teams } = useGameStore();
  const [selectedSale, setSelectedSale] = useState<SaleEntry | null>(null);

  if (!auction) return null;

  const history = [...(auction.saleHistory ?? [])].reverse();

  return (
    <div
      className="shrink-0 flex flex-col relative"
      style={{ borderTop: "2px solid #16130f", height: "220px" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: "2px solid #16130f" }}
      >
        <span className="font-space-mono font-bold text-[10px] tracking-widest text-text-primary uppercase">
          Sold Log
        </span>
        <span className="font-space-mono text-[9px] text-text-secondary">
          {history.length}
        </span>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="font-space-mono text-[9px] text-text-secondary tracking-wider">
              No sales yet
            </span>
          </div>
        ) : (
          history.map((sale, i) => {
            const player = players[sale.playerId];
            const team = teams[sale.teamId];
            const isMarquee = sale.price >= 1000;

            return (
              <button
                key={`${sale.playerId}-${i}`}
                onClick={() => setSelectedSale(selectedSale?.playerId === sale.playerId && selectedSale?.lot === sale.lot ? null : sale)}
                className="w-full flex items-center gap-2 px-3 py-[7px] text-left hover:bg-surface transition-colors"
                style={{
                  borderBottom: "1px solid rgba(22,19,15,.1)",
                  backgroundColor: isMarquee ? "#fff6d6" : undefined,
                }}
              >
                <span className="font-barlow-condensed font-bold text-[10px] text-muted w-[22px] shrink-0">
                  L{sale.lot + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-barlow font-semibold text-[11px] text-text-primary truncate leading-tight">
                    {player?.name ?? sale.playerId}
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-[6px] h-[6px] rounded-full shrink-0"
                      style={{ backgroundColor: team?.primaryColor ?? "#8a8378" }}
                    />
                    <span className="font-space-mono text-[8px] text-text-secondary tracking-wide">
                      {team?.shortName ?? sale.teamId}
                    </span>
                  </div>
                </div>
                <span
                  className="font-barlow-condensed font-bold text-[12px] shrink-0"
                  style={{ color: isMarquee ? "#d6492f" : "#16130f" }}
                >
                  {crore(sale.price)}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Popup overlay (positioned absolute within this panel) */}
      {selectedSale && (
        <BidHistoryPopup
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
        />
      )}
    </div>
  );
}
