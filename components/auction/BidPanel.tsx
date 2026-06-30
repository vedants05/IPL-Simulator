"use client";
import { useEffect, useRef } from "react";
import { useGameStore, hammerFall } from "@/lib/store/gameStore";
import { formatPrice, getNextBidAmount, canTeamBidOnPlayer, canTeamAffordBid } from "@/lib/logic/auctionRules";
import TeamBadge from "@/components/shared/TeamBadge";

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

  // Main countdown — restarts each time the player changes or modals open/close
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

  // RTM countdown
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

  const timerPct = Math.max(0, (auction.timerSeconds / 10) * 100);
  const timerColor =
    auction.timerSeconds > 6 ? "bg-success" :
    auction.timerSeconds > 3 ? "bg-gold" : "bg-danger";

  return (
    <div className="flex flex-col gap-4">
      {/* Current bid display */}
      <div className="bg-surface rounded-lg border border-border p-4 text-center">
        <div className="text-xs uppercase tracking-widest text-text-secondary mb-1">Current Bid</div>
        <div className="text-4xl font-black text-gold">{formatPrice(auction.currentBid)}</div>
        {highBidder ? (
          <div className="mt-2 flex items-center justify-center gap-2">
            <TeamBadge team={highBidder} size="sm" />
            <span className="text-sm text-text-primary font-medium">{highBidder.name}</span>
          </div>
        ) : (
          <div className="mt-2 text-sm text-text-secondary">Opening bid — no bidder yet</div>
        )}
      </div>

      {/* Timer */}
      <div>
        <div className="flex justify-between text-xs text-text-secondary mb-1">
          <span>Time remaining</span>
          <span className={auction.timerSeconds <= 3 ? "text-danger font-bold animate-pulse" : ""}>{auction.timerSeconds}s</span>
        </div>
        <div className="h-2 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${timerColor}`}
            style={{ width: `${timerPct}%` }}
          />
        </div>
      </div>

      {/* Status messages */}
      {!canBid && cantBidReason && (
        <div className="bg-danger/10 border border-danger/30 rounded text-danger text-xs px-3 py-2">
          ⚠ {cantBidReason}
        </div>
      )}
      {canBid && !canAfford && (
        <div className="bg-danger/10 border border-danger/30 rounded text-danger text-xs px-3 py-2">
          ⚠ Insufficient funds ({formatPrice(userTeam?.remainingPurse ?? 0)} remaining)
        </div>
      )}
      {isUserHighBidder && (
        <div className="bg-success/10 border border-success/30 rounded text-success text-xs px-3 py-2">
          ✓ You are the highest bidder
        </div>
      )}

      {/* Bid / Pass buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => placeBid(userTeamId, nextBid)}
          disabled={bidDisabled}
          className="flex-1 bg-gold hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-3 rounded-lg text-sm transition-colors"
        >
          BID {formatPrice(nextBid)} ↑
        </button>
        <button
          className="px-5 bg-surface2 hover:bg-border text-text-secondary font-medium py-3 rounded-lg text-sm transition-colors border border-border"
        >
          PASS
        </button>
      </div>

      <div className="text-center text-xs text-text-secondary">
        Increment: +{formatPrice(nextBid - auction.currentBid)}
      </div>
    </div>
  );
}
