"use client";
import { useGameStore } from "@/lib/store/gameStore";
import { getNextBidAmount, canTeamBidOnPlayer, canTeamAffordBid } from "@/lib/logic/auctionRules";

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

export default function BidHistory() {
  const { auction, teams, userTeamId } = useGameStore();
  const passBid = useGameStore((s) => s.passBid);

  if (!auction) return null;

  const history = auction.biddingHistory;
  const nextBid = getNextBidAmount(auction.currentBid);
  const isUserHighBidder = auction.currentHighBidderTeamId === userTeamId;

  const userTeam = teams[userTeamId];
  const player = auction.currentPlayer;
  const { canBid } = userTeam && player ? canTeamBidOnPlayer(userTeam, player) : { canBid: false };
  const canAfford = userTeam ? canTeamAffordBid(userTeam, nextBid) : false;
  // Disable PASS during sold/unsold flash and RTM so rapid clicks don't queue extra hammers
  const passDisabled = isUserHighBidder || !!auction.soldFlash || !!auction.unsoldFlash || !!auction.rtm;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between shrink-0" style={{ borderBottom: "2px solid #16130f" }}>
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

      {/* Footer: PASS button */}
      <div className="shrink-0 h-[52px] flex items-center" style={{ borderTop: "2px solid #16130f" }}>
        <button
          onClick={passBid}
          disabled={passDisabled}
          title={passDisabled ? "You're the highest bidder" : "Skip to auction result"}
          className="w-full h-full font-space-mono font-bold text-[12px] tracking-widest text-text-primary bg-bg
            hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors uppercase"
        >
          {passDisabled ? "You're Winning — Wait" : "Pass"}
        </button>
      </div>
    </div>
  );
}
