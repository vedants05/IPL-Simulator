"use client";
import { useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";

export default function SoldAnimation() {
  const { auction, teams, players } = useGameStore();
  const dismissSoldFlash = useGameStore((s) => s.dismissSoldFlash);

  if (!auction?.soldFlash) return null;

  const { playerId, teamId, amount } = auction.soldFlash;
  const team = teams[teamId];
  const player = players[playerId];

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center"
      style={{ backgroundColor: team?.primaryColor ? `${team.primaryColor}e6` : "#0f1117e6" }}
    >
      <div className="text-center px-8 animate-pulse">
        <div className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: team?.secondaryColor ?? "#fff" }}>
          Sold!
        </div>
        <div className="text-5xl font-black text-white mb-2">{player?.name ?? playerId}</div>
        <div className="text-xl font-bold mb-4" style={{ color: team?.secondaryColor ?? "#fff" }}>
          {team?.name ?? teamId}
        </div>
        <div className="text-4xl font-black text-white">{formatPrice(amount)}</div>
        <div className="mt-6">
          <div
            className="h-1 rounded-full animate-[shrink_2s_linear_forwards]"
            style={{ backgroundColor: team?.secondaryColor ?? "#fff", width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
