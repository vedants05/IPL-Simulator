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
  const tickTimer = useGameStore((s) => s.tickTimer);
  const tickRTMTimer = useGameStore((s) => s.tickRTMTimer);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rtmTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playerId = auction?.currentPlayer?.id;
  const rtmOpen = auction?.rtmWindowOpen;
  const hasSoldFlash = !!auction?.soldFlash;
  const hasUnsoldFlash = !!auction?.unsoldFlash;

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!playerId || rtmOpen || hasSoldFlash || hasUnsoldFlash) return;

    timerRef.current = setInterval(() => {
      const s = useGameStore.getState();
      if (!s.auction?.currentPlayer || s.auction.rtmWindowOpen || s.auction.soldFlash || s.auction.unsoldFlash) {
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
  }, [playerId, rtmOpen, hasSoldFlash, hasUnsoldFlash]);

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
  const filledTicks = Math.ceil(timerSecs / 2.5);

  const bidLabel = isUserHighBidder
    ? "YOU'RE WINNING"
    : bidDisabled
    ? "CANNOT BID"
    : `BID ₹${crore(nextBid)} Cr ↑`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Bid block: yellow + timer */}
      <div className="flex flex-1 min-h-0">
        {/* Yellow bid panel */}
        <div className="flex-1 bg-accent flex flex-col items-center justify-center px-6 py-5">
          <div className="font-space-mono font-bold text-[11px] tracking-[.16em] text-border mb-3 uppercase">
            Current Bid
          </div>
          <div className="font-anton leading-none text-border mb-4 text-center">
            <span className="text-[56px]">₹{crore(auction.currentBid)}</span>
            <span className="text-[24px] ml-1">Cr</span>
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
                {isUserHighBidder ? "YOU — HIGH" : "HIGH BIDDER"}
              </span>
            </div>
          ) : (
            <div className="font-space-mono text-[10px] text-border/60 tracking-wider">
              Opening — no bids yet
            </div>
          )}
        </div>

        {/* Dark timer panel */}
        <div className="w-[148px] shrink-0 bg-border flex flex-col items-center justify-center px-4 py-5 gap-3">
          <div className="font-space-mono font-bold text-[10px] tracking-[.16em] text-bg/60 uppercase">
            Time Left
          </div>
          <div className="font-anton text-[52px] leading-none text-accent">
            {timerSecs}
          </div>
          <div className="flex gap-1.5">
            {[4, 3, 2, 1].map((tick) => (
              <div
                key={tick}
                className="w-6 h-1.5 rounded-sm"
                style={{ backgroundColor: filledTicks >= tick ? "#ffc400" : "rgba(244,241,234,.18)" }}
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

      {/* BID button — full width */}
      <button
        onClick={() => placeBid(userTeamId, nextBid)}
        disabled={bidDisabled}
        className="w-full bg-border text-accent font-anton text-[21px] py-[17px] tracking-wide
          hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        style={{ borderTop: "2px solid #16130f" }}
      >
        {bidLabel}
      </button>
    </div>
  );
}
