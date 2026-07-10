"use client";
import { useGameStore } from "@/lib/store/gameStore";
import { getNextBidAmount } from "@/lib/logic/auctionRules";

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

export default function BidHistory() {
  const { auction, teams } = useGameStore();

  if (!auction) return null;

  const history = auction.biddingHistory;
  const hasBids = !!auction.currentHighBidderTeamId;
  const nextBid = hasBids ? getNextBidAmount(auction.currentBid) : auction.currentBid;
  const bidStep = hasBids ? nextBid - auction.currentBid : 5;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 h-[36px] flex items-center justify-between shrink-0" style={{ borderBottom: "2px solid var(--ink)" }}>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full shrink-0 transition-colors duration-200"
            style={{ backgroundColor: "var(--team-accent)", animation: "liveblink 1.4s infinite" }}
          />
          <span className="font-space-mono font-bold text-[11px] tracking-widest text-text-primary uppercase">
            Live Bids
          </span>
        </div>
        <span className="font-space-mono text-[9px] text-text-secondary">
          {history.length} bids
        </span>
      </div>

      {/* Ladder */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5 box-border">
        {history.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <span className="font-space-mono text-[10px] text-text-secondary tracking-wider text-center">
              Opened at{" "}
              {auction.currentPlayer ? crore(auction.currentPlayer.basePrice) : "—"}
            </span>
          </div>
        ) : (
          history.map((entry, i) => {
            const team = teams[entry.teamId];
            const isTop = i === 0;
            return (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-[7px] rounded-[6px] overflow-hidden shrink-0 box-border transition-all duration-200 my-[3px]"
                style={
                  isTop
                    ? {
                        backgroundColor: "rgba(22, 19, 15, 0.06)",
                        border: "1.5px solid var(--ink)",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }
                    : {
                        borderBottom: "1px solid rgba(22, 19, 15, 0.1)",
                      }
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: team?.primaryColor ?? "#8a8378" }}
                  />
                  <span className={`font-barlow text-[12px] truncate text-text-primary ${isTop ? "font-bold" : "font-semibold"}`}>
                    {team?.shortName ?? entry.teamId}
                  </span>
                </div>
                <span
                  className="font-barlow-condensed font-bold text-[15px] shrink-0 ml-2"
                  style={{ color: isTop ? "var(--ink)" : "var(--text-secondary, #5a5348)" }}
                >
                  {crore(entry.amount)}
                </span>
              </div>
            );
          })
        )}
        {history.length > 0 && (
          <div className="text-center pt-2 pb-1 shrink-0">
            <span className="font-space-mono text-[9px] text-text-secondary tracking-wider">
              OPEN · {auction.currentPlayer ? crore(auction.currentPlayer.basePrice) : "—"}
            </span>
          </div>
        )}
      </div>

      {/* Structural Guardrail: Exact layout at bottom of Live Bids column containing "YOUR NEXT BID" container box */}
      <div
        className="shrink-0 h-[52px] px-4 flex items-center justify-between transition-colors duration-200"
        style={{ borderTop: "2px solid var(--ink)", backgroundColor: "var(--app-base-bg, var(--background))" }}
      >
        <span className="font-space-mono text-[9px] tracking-widest text-text-secondary uppercase">
          YOUR NEXT BID
        </span>
        <div className="flex items-baseline gap-2">
          <span className="font-anton text-[18px] leading-none text-text-primary">
            {crore(nextBid)}
          </span>
          <span className="font-space-mono font-bold text-[9px] text-success">
            +{(bidStep / 100).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
