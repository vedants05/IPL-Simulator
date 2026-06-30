"use client";
import { useGameStore } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";
import TeamBadge from "@/components/shared/TeamBadge";

export default function RTMModal() {
  const { auction, teams, userTeamId } = useGameStore();
  const useRTM = useGameStore((s) => s.useRTM);
  const declineRTM = useGameStore((s) => s.declineRTM);

  if (!auction?.rtmWindowOpen || !auction.currentPlayer) return null;

  const player = auction.currentPlayer;
  const winnerTeam = teams[auction.currentHighBidderTeamId!];
  const userTeam = teams[userTeamId];
  const rtmLeft = (userTeam?.rtmCardsTotal ?? 0) - (userTeam?.rtmCardsUsed ?? 0);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-accent rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-widest text-accent mb-2">Right to Match</div>
          <h2 className="text-2xl font-black text-text-primary mb-1">{player.name}</h2>
          <p className="text-text-secondary text-sm">
            Sold to {winnerTeam?.name} for{" "}
            <span className="text-gold font-bold">{formatPrice(auction.currentBid)}</span>
          </p>
        </div>

        <div className="bg-surface2 rounded-lg p-4 mb-6 border border-border">
          <p className="text-sm text-text-secondary text-center">
            This player was in your squad last season. You can match the winning bid and retain them.
          </p>
          <div className="mt-3 flex justify-center gap-6 text-sm">
            <div className="text-center">
              <div className="text-text-secondary text-xs">RTM Cards Remaining</div>
              <div className="text-accent font-bold text-lg">{rtmLeft}</div>
            </div>
            <div className="text-center">
              <div className="text-text-secondary text-xs">Match Price</div>
              <div className="text-gold font-bold text-lg">{formatPrice(auction.currentBid)}</div>
            </div>
            <div className="text-center">
              <div className="text-text-secondary text-xs">Time</div>
              <div className={`font-bold text-lg ${auction.rtmTimerSeconds <= 5 ? "text-danger" : "text-text-primary"}`}>
                {auction.rtmTimerSeconds}s
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={useRTM}
            className="flex-1 bg-accent hover:bg-accent-hover text-white font-bold py-3 rounded-lg transition-colors"
          >
            USE RTM — {formatPrice(auction.currentBid)}
          </button>
          <button
            onClick={declineRTM}
            className="flex-1 bg-surface2 hover:bg-border text-text-secondary font-medium py-3 rounded-lg transition-colors border border-border"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
