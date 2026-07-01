"use client";
import { useGameStore } from "@/lib/store/gameStore";

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

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
      style={{ backgroundColor: team?.primaryColor ? `${team.primaryColor}f2` : "#16130ff2" }}
    >
      <div className="text-center px-8">
        <div
          className="font-space-mono font-bold text-[11px] tracking-[.3em] mb-4 uppercase"
          style={{ color: team?.secondaryColor ?? "#ffc400" }}
        >
          SOLD!
        </div>
        <div className="font-anton text-[56px] leading-none text-white mb-3 uppercase">
          {player?.name ?? playerId}
        </div>
        <div
          className="font-barlow font-bold text-[18px] mb-5"
          style={{ color: team?.secondaryColor ?? "#ffc400" }}
        >
          {team?.name ?? teamId}
        </div>
        <div className="font-barlow-condensed font-bold text-[52px] leading-none text-white">
          {crore(amount)}
        </div>
        <div className="mt-8">
          <div
            className="h-[3px] rounded-full animate-[shrink_2s_linear_forwards]"
            style={{ backgroundColor: team?.secondaryColor ?? "#ffc400", width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
