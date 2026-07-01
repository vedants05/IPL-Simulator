"use client";
import { useGameStore } from "@/lib/store/gameStore";

export default function UnsoldAnimation() {
  const { auction, players } = useGameStore();

  if (!auction?.unsoldFlash) return null;

  const { playerId } = auction.unsoldFlash;
  const player = players[playerId];

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center"
      style={{ backgroundColor: "rgba(22,19,15,0.94)" }}
    >
      <div className="text-center px-8">
        <div className="font-space-mono font-bold text-[11px] tracking-[.3em] mb-4 text-danger uppercase">
          UNSOLD
        </div>
        <div className="font-anton text-[56px] leading-none text-white mb-3 uppercase">
          {player?.name ?? playerId}
        </div>
        <div className="font-barlow text-[15px] text-text-secondary mb-5">
          No bids received — re-enters accelerated auction
        </div>
        <div className="mt-8">
          <div
            className="h-[3px] rounded-full animate-[shrink_2s_linear_forwards]"
            style={{ backgroundColor: "#d6492f", width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
