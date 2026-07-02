"use client";
import { useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { TEAM_THEMES } from "@/lib/theme/teams";

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

export default function SoldAnimation() {
  const { auction, teams, players } = useGameStore();
  const dismissSoldFlash = useGameStore((s) => s.dismissSoldFlash);

  const soldFlash = auction?.soldFlash;

  // Auto-dismiss safety timer so it never gets stuck
  useEffect(() => {
    if (!soldFlash) return;
    const t = setTimeout(() => {
      dismissSoldFlash();
    }, 2400);
    return () => clearTimeout(t);
  }, [soldFlash, dismissSoldFlash]);

  if (!soldFlash) return null;

  const { playerId, teamId, amount } = soldFlash;
  const team = teams[teamId];
  const player = players[playerId];

  const theme = TEAM_THEMES[teamId];
  const backgroundGradient = theme
    ? theme.overlayGradient
    : `linear-gradient(135deg, #0d1b2e 0%, #08101d 100%)`;

  const fontColor = theme?.overlayText ?? "#ffffff";
  const accentBadgeColor = theme?.accent ?? "#ffc72c";

  return (
    <div
      onClick={dismissSoldFlash}
      title="Click to dismiss"
      className="absolute inset-0 z-30 flex items-center justify-center cursor-pointer select-none transition-all duration-300"
      style={{
        backgroundImage: `${backgroundGradient}, radial-gradient(rgba(255, 255, 255, 0.10) 1.4px, transparent 1.6px)`,
        backgroundSize: "100% 100%, 14px 14px",
        opacity: 0.96,
      }}
    >
      <div className="text-center px-8 relative z-10">
        <div
          className="font-space-mono font-bold text-[13px] tracking-[.3em] mb-4 uppercase"
          style={{ color: accentBadgeColor }}
        >
          SOLD!
        </div>
        <div
          className="font-anton text-[64px] leading-none mb-3 uppercase drop-shadow-xl tracking-wide"
          style={{ color: fontColor }}
        >
          {player?.name ?? playerId}
        </div>
        <div
          className="font-barlow font-bold text-[22px] mb-6 uppercase tracking-wider"
          style={{ color: accentBadgeColor }}
        >
          {team?.name ?? teamId}
        </div>
        <div
          className="font-anton text-[60px] leading-none drop-shadow-lg text-white"
        >
          {crore(amount)}
        </div>
        <div className="mt-8 max-w-xs mx-auto">
          <div
            className="h-[4px] rounded-full animate-[shrink_2s_linear_forwards]"
            style={{ backgroundColor: accentBadgeColor, width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
