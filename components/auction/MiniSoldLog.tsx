"use client";
import { useState, useRef, useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

export default function MiniSoldLog() {
  const { auction, teams, players } = useGameStore();
  const [selectedSale, setSelectedSale] = useState<{ playerId: string; teamId: string; price: number; lot: number; bids?: any[] } | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setSelectedSale(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!auction) return null;

  const history = [...(auction.saleHistory ?? [])].reverse();
  const selectedPlayer = selectedSale ? players[selectedSale.playerId] : null;
  const buyerTeam = selectedSale ? teams[selectedSale.teamId] : null;

  return (
    <div
      ref={cardRef}
      className="relative flex flex-col shrink-0"
      style={{
        width: "220px",
        height: "280px",
        zIndex: selectedSale ? 40 : 10,
        border: "2px solid #16130f",
        backgroundColor: "var(--app-base-bg, #f4f1ea)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0 select-none"
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
            const isSelected = selectedSale?.playerId === sale.playerId && selectedSale?.lot === sale.lot;

            return (
              <button
                key={`${sale.playerId}-${i}`}
                onClick={() => setSelectedSale(isSelected ? null : sale)}
                className="w-full flex items-center gap-2 px-3 py-[7px] text-left hover:bg-black/5 transition-colors cursor-pointer"
                style={{
                  borderBottom: "1px solid rgba(22,19,15,.1)",
                  backgroundColor: isSelected ? "rgba(22, 19, 15, 0.08)" : undefined,
                }}
              >
                <span className="font-bold text-[16px] leading-none text-[#5a5348] w-[14px] text-center shrink-0">
                  •
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
                <span className="font-barlow-condensed font-bold text-[12px] text-[#16130f] shrink-0">
                  {crore(sale.price)}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Expanded detail popout overlay on right */}
      {selectedSale && selectedPlayer && (
        <div
          className="absolute left-full top-0 ml-2 w-[260px] bg-[#f4f1ea] border-2 border-[#16130f] p-3 shadow-2xl z-50 rounded-[4px] text-[#16130f]"
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-anton text-[16px] leading-tight uppercase">
                {selectedPlayer.name}
              </div>
              <div className="font-space-mono text-[9px] text-text-secondary">
                {selectedPlayer.role} · {selectedPlayer.nationality}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSale(null);
              }}
              className="text-[12px] font-bold text-text-secondary hover:text-text-primary px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div
            className="p-2.5 rounded mb-2 flex items-center justify-between gap-2"
            style={{ backgroundColor: buyerTeam?.primaryColor ?? "#8a8378", color: buyerTeam?.secondaryColor ?? "#ffffff" }}
          >
            <div className="min-w-0 flex-1">
              <div className="font-space-mono text-[8px] tracking-widest opacity-80 uppercase">
                SOLD TO
              </div>
              <div className="font-anton text-[13px] leading-tight truncate">
                {buyerTeam?.name ?? selectedSale.teamId}
              </div>
            </div>
            <div className="font-anton text-[16px] whitespace-nowrap shrink-0 ml-1">
              {crore(selectedSale.price)}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-1 mb-2 text-[9px] font-space-mono bg-black/5 p-2 rounded text-[#16130f]">
            <div>Matches: <span className="font-bold">{selectedPlayer.careerStats.batting.matches}</span></div>
            <div>Star Rating: <span className="font-bold">{selectedPlayer.starRating}★</span></div>
            {selectedPlayer.careerStats.batting.runs ? <div>Runs: <span className="font-bold">{selectedPlayer.careerStats.batting.runs}</span></div> : null}
            {selectedPlayer.careerStats.bowling.wickets ? <div>Wkts: <span className="font-bold">{selectedPlayer.careerStats.bowling.wickets}</span></div> : null}
          </div>

          {/* Bidding Log Summary */}
          {selectedSale.bids && selectedSale.bids.length > 0 && (
            <div>
              <div className="font-space-mono text-[8px] font-bold tracking-wider text-text-secondary mb-1 uppercase">
                Bidding Trail ({selectedSale.bids.length})
              </div>
              <div className="max-h-[80px] overflow-y-auto text-[8px] font-space-mono space-y-1 pr-1">
                {selectedSale.bids.map((b: any, bi: number) => {
                  const bTeam = teams[b.teamId];
                  return (
                    <div key={bi} className="flex justify-between items-center bg-black/5 px-1.5 py-0.5 rounded">
                      <div className="flex items-center gap-1">
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: bTeam?.primaryColor ?? "#8a8378" }}
                        />
                        <span>{bTeam?.shortName ?? b.teamId}</span>
                      </div>
                      <span className="font-bold">{crore(b.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
