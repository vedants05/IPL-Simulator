"use client";
import { useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";

export default function UnsoldAnimation() {
  const { auction, players } = useGameStore();
  const dismissSoldFlash = useGameStore((s) => s.dismissSoldFlash);

  const unsoldFlash = auction?.unsoldFlash;

  useEffect(() => {
    if (!unsoldFlash) return;
    const t = setTimeout(() => {
      dismissSoldFlash();
    }, 2400);
    return () => clearTimeout(t);
  }, [unsoldFlash, dismissSoldFlash]);

  if (!unsoldFlash) return null;

  const { playerId } = unsoldFlash;
  const player = players[playerId];

  return (
    <div
      onClick={dismissSoldFlash}
      title="Click to dismiss"
      className="absolute inset-0 z-30 flex items-center justify-center cursor-pointer select-none transition-all duration-300"
      style={{
        backgroundColor: "rgba(16, 12, 12, 0.96)",
        backgroundImage: "linear-gradient(180deg, rgba(36, 15, 17, 0.96) 0%, rgba(16, 8, 8, 0.98) 100%), radial-gradient(rgba(255, 255, 255, 0.09) 1.4px, transparent 1.6px)",
        backgroundSize: "100% 100%, 14px 14px",
      }}
    >
      <div className="text-center px-8 relative z-10">
        <div className="font-space-mono font-bold text-[12px] tracking-[.3em] mb-4 text-danger uppercase">
          UNSOLD
        </div>
        <div className="font-anton text-[64px] leading-none text-white mb-3 uppercase drop-shadow-xl tracking-wide">
          {player?.name ?? playerId}
        </div>
        <div className="font-barlow text-[15px] text-text-secondary mb-6">
          {auction?.isAcceleratedPhase
            ? "Player goes unsold"
            : "No bids received — re-enters accelerated auction"}
        </div>
        <div className="mt-8 max-w-xs mx-auto">
          <div
            className="h-[4px] rounded-full animate-[shrink_2s_linear_forwards]"
            style={{ backgroundColor: "#d6492f", width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
