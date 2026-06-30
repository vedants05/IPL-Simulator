"use client";
import { useGameStore } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";
import TeamBadge from "@/components/shared/TeamBadge";

export default function BidHistory() {
  const { auction, teams } = useGameStore();

  if (!auction) return null;

  const history = auction.biddingHistory;

  return (
    <div className="bg-surface rounded-lg border border-border p-3 max-h-48 overflow-y-auto">
      <h4 className="text-[10px] uppercase tracking-widest text-text-secondary mb-2">Bid History</h4>
      {history.length === 0 ? (
        <div className="text-xs text-text-secondary py-2 text-center">
          Opened at {auction.currentPlayer ? formatPrice(auction.currentPlayer.basePrice) : "—"}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {history.map((entry, i) => {
            const team = teams[entry.teamId];
            return (
              <div key={i} className={`flex items-center justify-between text-xs ${i === 0 ? "text-text-primary" : "text-text-secondary"}`}>
                <div className="flex items-center gap-1.5">
                  {team && <TeamBadge team={team} size="xs" />}
                  <span>{team?.shortName ?? entry.teamId} bids</span>
                </div>
                <span className={`font-semibold font-mono ${i === 0 ? "text-gold" : ""}`}>
                  {formatPrice(entry.amount)}
                </span>
              </div>
            );
          })}
          <div className="text-xs text-text-secondary text-center pt-1 border-t border-border mt-1">
            Opened at {auction.currentPlayer ? formatPrice(auction.currentPlayer.basePrice) : "—"}
          </div>
        </div>
      )}
    </div>
  );
}
