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
  const nextBid = getNextBidAmount(auction.currentBid);
  const increment = nextBid - auction.currentBid;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 border-b-2 border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full bg-danger shrink-0"
            style={{ animation: "liveblink 1.4s infinite" }}
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
      <div className="flex-1 overflow-y-auto py-2 px-3 flex flex-col gap-1.5">
        {history.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <span className="font-space-mono text-[10px] text-text-secondary tracking-wider text-center">
              Opened at{"\n"}{auction.currentPlayer ? crore(auction.currentPlayer.basePrice) : "—"}
            </span>
          </div>
        ) : (
          history.map((entry, i) => {
            const team = teams[entry.teamId];
            const isTop = i === 0;
            return (
              <div
                key={i}
                className={`flex items-center justify-between px-3 py-[7px] rounded-[5px] ${
                  isTop ? "bg-accent border border-border" : ""
                }`}
                style={!isTop ? { borderBottom: "1px solid rgba(22,19,15,.1)" } : {}}
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
                  style={{ color: isTop ? "#16130f" : "#5a5348" }}
                >
                  {crore(entry.amount)}
                </span>
              </div>
            );
          })
        )}
        {history.length > 0 && (
          <div className="text-center pt-2 pb-1">
            <span className="font-space-mono text-[9px] text-text-secondary tracking-wider">
              OPEN · {auction.currentPlayer ? crore(auction.currentPlayer.basePrice) : "—"}
            </span>
          </div>
        )}
      </div>

      {/* Footer: next bid */}
      <div className="shrink-0 border-t-2 border-border bg-surface px-4 py-3">
        <div className="font-space-mono font-bold text-[9px] tracking-widest text-text-secondary mb-1 uppercase">
          Your Next Bid
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-barlow-condensed font-bold text-[20px] leading-none text-text-primary">
            {crore(nextBid)}
          </span>
          <span className="font-space-mono font-bold text-[10px] text-success tracking-wider">
            +{(increment / 100).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
