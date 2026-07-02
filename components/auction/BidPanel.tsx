"use client";
import { useEffect, useRef } from "react";
import { useGameStore, hammerFall } from "@/lib/store/gameStore";
import { formatPrice, getNextBidAmount, canTeamBidOnPlayer, canTeamAffordBid } from "@/lib/logic/auctionRules";

function crore(lakhs: number) {
  return (lakhs / 100).toFixed(2);
}

export default function BidPanel() {
  const auction = useGameStore((s) => s.auction);
  const teams = useGameStore((s) => s.teams);
  const userTeamId = useGameStore((s) => s.userTeamId);
  const placeBid = useGameStore((s) => s.placeBid);
  const passBid = useGameStore((s) => s.passBid);

  const speed = useGameStore((s) => s.speed);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rtmTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playerId = auction?.currentPlayer?.id;
  const hasRtm = !!auction?.rtm;
  const hasSoldFlash = !!auction?.soldFlash;
  const hasUnsoldFlash = !!auction?.unsoldFlash;

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!playerId || hasRtm || hasSoldFlash || hasUnsoldFlash) return;

    timerRef.current = setInterval(() => {
      const s = useGameStore.getState();
      if (!s.auction?.currentPlayer || s.auction.rtm || s.auction.soldFlash || s.auction.unsoldFlash) {
        clearInterval(timerRef.current!);
        return;
      }
      if (s.auction.timerSeconds <= 0) {
        clearInterval(timerRef.current!);
        hammerFall();
      } else {
        s.tickTimer();
      }
    }, 1000 / speed);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playerId, hasRtm, hasSoldFlash, hasUnsoldFlash, speed]);

  useEffect(() => {
    if (rtmTimerRef.current) clearInterval(rtmTimerRef.current);
    if (!hasRtm) return;
    rtmTimerRef.current = setInterval(() => {
      useGameStore.getState().tickRTMTimer();
    }, 1000);
    return () => { if (rtmTimerRef.current) clearInterval(rtmTimerRef.current); };
  }, [hasRtm]);

  if (!auction || !auction.currentPlayer) return null;

  const player = auction.currentPlayer;
  const hasBids = !!auction.currentHighBidderTeamId;
  const nextBid = hasBids ? getNextBidAmount(auction.currentBid) : auction.currentBid;
  const userTeam = teams[userTeamId];
  const highBidder = auction.currentHighBidderTeamId ? teams[auction.currentHighBidderTeamId] : null;
  const isUserHighBidder = auction.currentHighBidderTeamId === userTeamId;

  const { canBid, reason: cantBidReason } = userTeam
    ? canTeamBidOnPlayer(userTeam, player)
    : { canBid: false, reason: "No team" };
  const canAfford = userTeam ? canTeamAffordBid(userTeam, nextBid) : false;
  const bidDisabled = !canBid || !canAfford || isUserHighBidder;
  const passDisabled = isUserHighBidder || !!auction.soldFlash || !!auction.unsoldFlash || !!auction.rtm;

  const timerSecs = auction.timerSeconds;
  const filledTicks = Math.ceil(timerSecs / 2.5);

  const bidLabel = isUserHighBidder
    ? "YOU'RE WINNING"
    : bidDisabled
    ? "CANNOT BID"
    : `BID ₹${crore(nextBid)} Cr ↑`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Bid stage: Deep stadium neutral with subtle team tinge overlay + halftone energy pattern */}
      <div className="flex flex-1 min-h-0" style={{ backgroundColor: "var(--team-bid-bg, #111622)" }}>
        {/* Main Active Central Bid Component Container with Halftone Dot Texture + Soft Team Tinge */}
        <div
          className="flex-1 flex flex-col items-center justify-center px-6 py-5 relative transition-colors duration-200"
          style={{
            backgroundColor: "var(--team-bid-bg, #111622)",
            backgroundImage: "var(--team-bid-tinge, linear-gradient(rgba(29,85,196,0.1), rgba(29,85,196,0.1))), radial-gradient(rgba(255, 255, 255, 0.08) 1.4px, transparent 1.6px)",
            backgroundSize: "100% 100%, 14px 14px",
          }}
        >
          <div
            className="font-space-mono font-bold text-[10px] tracking-[.14em] mb-2 uppercase"
            style={{ color: "var(--team-bid-muted, #8a92a3)" }}
          >
            Current Bid
          </div>
          <div
            className="font-anton leading-none mb-4 text-center"
            style={{ color: "var(--team-bid-text, #ffffff)" }}
          >
            <span className="text-[56px]">₹{crore(auction.currentBid)}</span>
            <span className="text-[24px] ml-1" style={{ color: "var(--team-bid-muted, #8a92a3)" }}>Cr</span>
          </div>
          {highBidder ? (
            <div className="flex items-center">
              <span
                className="font-space-mono font-bold text-[10px] tracking-widest bg-black/60 text-white border border-white/20 px-3 py-[4px] rounded-[4px] uppercase"
              >
                {isUserHighBidder ? "YOU lead" : `${highBidder.shortName} lead`}
              </span>
            </div>
          ) : (
            <div className="font-space-mono text-[10px] tracking-wider" style={{ color: "var(--team-bid-muted, #8a92a3)" }}>
              Opening — no bids yet
            </div>
          )}
        </div>

        {/* Solid Un-Textured Deep Neutral Block for TIME LEFT Box */}
        <div
          className="w-[148px] shrink-0 flex flex-col items-center justify-center px-4 py-5 gap-3 border-l border-white/10 transition-colors duration-200"
          style={{ backgroundColor: "var(--team-bid-bg, #111622)" }}
        >
          <div
            className="font-space-mono font-bold text-[10px] tracking-[.14em] uppercase"
            style={{ color: "var(--team-bid-muted, #8a92a3)" }}
          >
            Time Left
          </div>
          <div
            className="font-anton text-[52px] leading-none"
            style={{ color: "var(--team-bid-text, #ffffff)" }}
          >
            {timerSecs}
          </div>
          <div className="flex gap-1.5">
            {[4, 3, 2, 1].map((tick) => (
              <div
                key={tick}
                className="w-6 h-1.5 rounded-sm"
                style={{ backgroundColor: filledTicks >= tick ? "var(--team-bid-text, #ffffff)" : "rgba(255,255,255,0.2)" }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Status warnings */}
      {(!canBid && cantBidReason) && (
        <div className="px-5 py-2 bg-danger/10 font-space-mono text-[10px] tracking-wider text-danger shrink-0"
          style={{ borderTop: "1px solid rgba(214,73,47,.3)" }}>
          ⚠ {cantBidReason}
        </div>
      )}
      {canBid && !canAfford && (
        <div className="px-5 py-2 bg-danger/10 font-space-mono text-[10px] tracking-wider text-danger shrink-0"
          style={{ borderTop: "1px solid rgba(214,73,47,.3)" }}>
          ⚠ Insufficient funds ({formatPrice(userTeam?.remainingPurse ?? 0)} remaining)
        </div>
      )}

      {/* Action Bar: Main CTA Block + Separate White PASS Action Button Block */}
      <div className="flex shrink-0" style={{ borderTop: "2px solid #16130f" }}>
        <button
          onClick={() => placeBid(userTeamId, nextBid)}
          disabled={bidDisabled}
          className="flex-1 font-anton text-[21px] py-[17px] tracking-wide
            hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shrink-0 uppercase"
          style={{ backgroundColor: "var(--team-cta-bg)", color: "var(--team-cta-text)" }}
        >
          {bidLabel}
        </button>
        <button
          onClick={passBid}
          disabled={passDisabled}
          title={passDisabled ? "You're the highest bidder" : "Pass on this lot"}
          className="w-[148px] shrink-0 bg-white font-space-mono font-bold text-[12px] tracking-widest text-[#16130f]
            hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors uppercase border-l-2 border-border"
        >
          {isUserHighBidder ? "Winning" : "Pass"}
        </button>
      </div>
    </div>
  );
}
