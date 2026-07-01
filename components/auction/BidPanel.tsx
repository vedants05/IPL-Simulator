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
  const tickTimer = useGameStore((s) => s.tickTimer);
  const tickRTMTimer = useGameStore((s) => s.tickRTMTimer);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rtmTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playerId = auction?.currentPlayer?.id;
  const rtmOpen = auction?.rtmWindowOpen;
  const hasSoldFlash = !!auction?.soldFlash;

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!playerId || rtmOpen || hasSoldFlash) return;

    timerRef.current = setInterval(() => {
      const s = useGameStore.getState();
      if (!s.auction?.currentPlayer || s.auction.rtmWindowOpen || s.auction.soldFlash) {
        clearInterval(timerRef.current!);
        return;
      }
      if (s.auction.timerSeconds <= 0) {
        clearInterval(timerRef.current!);
        hammerFall();
      } else {
        s.tickTimer();
      }
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playerId, rtmOpen, hasSoldFlash]);

  useEffect(() => {
    if (rtmTimerRef.current) clearInterval(rtmTimerRef.current);
    if (!rtmOpen) return;
    rtmTimerRef.current = setInterval(() => {
      useGameStore.getState().tickRTMTimer();
    }, 1000);
    return () => { if (rtmTimerRef.current) clearInterval(rtmTimerRef.current); };
  }, [rtmOpen]);

  if (!auction || !auction.currentPlayer) return null;

  const player = auction.currentPlayer;
  const nextBid = getNextBidAmount(auction.currentBid);
  const userTeam = teams[userTeamId];
  const highBidder = auction.currentHighBidderTeamId ? teams[auction.currentHighBidderTeamId] : null;
  const isUserHighBidder = auction.currentHighBidderTeamId === userTeamId;

  const { canBid, reason: cantBidReason } = userTeam
    ? canTeamBidOnPlayer(userTeam, player)
    : { canBid: false, reason: "No team" };
  const canAfford = userTeam ? canTeamAffordBid(userTeam, nextBid) : false;
  const bidDisabled = !canBid || !canAfford || isUserHighBidder;

  const timerSecs = auction.timerSeconds;
  // 4 tick segments (each = 2.5s)
  const filledTicks = Math.ceil(timerSecs / 2.5);

  const bidLabel = bidDisabled
    ? isUserHighBidder ? "WINNING" : "CANNOT BID"
    : `BID ₹${crore(nextBid)} Cr ↑`;

  return (
    <div className="flex flex-col flex-1">
      {/* Bid block: yellow + timer side by side */}
      <div className="flex flex-1">
        {/* Yellow bid panel */}
        <div className="flex-1 bg-accent flex flex-col items-center justify-center px-6 py-[22px]">
          <div className="font-space-mono font-bold text-[11px] tracking-[.16em] text-border mb-3 uppercase">
            Current Bid
          </div>
          <div className="font-anton leading-none text-border mb-4 text-center">
            <span className="text-[64px]">₹{crore(auction.currentBid)}</span>
            <span className="text-[28px] ml-1">Cr</span>
          </div>
          {highBidder ? (
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                style={{ backgroundColor: highBidder.primaryColor, color: highBidder.secondaryColor }}
              >
                {highBidder.shortName.slice(0, 2)}
              </div>
              <span className="font-barlow font-bold text-[12px] text-border">{highBidder.shortName}</span>
              <span className="font-space-mono font-bold text-[9px] tracking-widest bg-border text-accent px-2 py-[2px] rounded-[3px]">
                HIGH BIDDER
              </span>
            </div>
          ) : (
            <div className="font-space-mono text-[10px] text-border/60 tracking-wider">
              Opening — no bids yet
            </div>
          )}
        </div>

        {/* Dark timer panel */}
        <div className="w-[160px] shrink-0 bg-border flex flex-col items-center justify-center px-5 py-6 gap-4">
          <div className="font-space-mono font-bold text-[10px] tracking-[.16em] text-bg/60 uppercase">
            Time Left
          </div>
          <div
            className="font-anton text-[56px] leading-none text-accent"
            style={{ color: timerSecs <= 3 ? "#ffc400" : "#ffc400" }}
          >
            {timerSecs}
          </div>
          {/* 4 tick segments */}
          <div className="flex gap-1.5">
            {[4, 3, 2, 1].map((tick) => (
              <div
                key={tick}
                className="w-7 h-1.5 rounded-sm"
                style={{ backgroundColor: filledTicks >= tick ? "#ffc400" : "rgba(244,241,234,.18)" }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Status messages */}
      {(!canBid && cantBidReason) && (
        <div className="px-6 py-2 bg-danger/10 border-t-2 border-t-danger/30 font-space-mono text-[10px] tracking-wider text-danger">
          ⚠ {cantBidReason}
        </div>
      )}
      {canBid && !canAfford && (
        <div className="px-6 py-2 bg-danger/10 border-t-2 border-t-danger/30 font-space-mono text-[10px] tracking-wider text-danger">
          ⚠ Insufficient funds ({formatPrice(userTeam?.remainingPurse ?? 0)} remaining)
        </div>
      )}

      {/* Action bar */}
      <div className="flex border-t-2 border-border shrink-0">
        <button
          onClick={() => placeBid(userTeamId, nextBid)}
          disabled={bidDisabled}
          className="flex-1 bg-border text-accent font-anton text-[21px] py-[17px] tracking-wide transition-colors
            hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {bidLabel}
        </button>
        <button
          onClick={passBid}
          disabled={isUserHighBidder}
          title={isUserHighBidder ? "You're the highest bidder" : "Skip to auction result"}
          className="px-7 font-space-mono font-bold text-[13px] tracking-widest text-text-primary bg-bg
            border-l-2 border-border hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          PASS
        </button>
      </div>
    </div>
  );
}
