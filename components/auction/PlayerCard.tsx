"use client";
import { Player } from "@/lib/types";
import { useGameStore } from "@/lib/store/gameStore";

interface Props {
  player: Player;
}

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)}`;
}

function crNum(lakhs: number) {
  return (lakhs / 100).toFixed(2);
}

export default function PlayerCard({ player }: Props) {
  const auction = useGameStore((s) => s.auction);
  const lotIndex = auction?.currentLotIndex ?? 0;
  const stats = player.careerStats;

  const isBatter = player.role === "Batsman" || player.role === "WK-Batsman";
  const isBowler = player.role === "Pace Bowler" || player.role === "Spin Bowler";
  const isAllRounder = player.role === "All-Rounder";

  const primaryRating = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);

  const statCells: Array<{ label: string; value: string | number; highlight?: boolean }> = isBowler
    ? [
        { label: "MATCHES", value: stats.bowling.wickets > 0 ? stats.batting.matches : "—" },
        { label: "WICKETS", value: stats.bowling.wickets > 0 ? stats.bowling.wickets : "—" },
        { label: "ECONOMY", value: stats.bowling.wickets > 0 ? stats.bowling.economy.toFixed(2) : "—" },
        { label: "AVG", value: stats.bowling.wickets > 0 ? stats.bowling.average.toFixed(1) : "—", highlight: true },
        { label: "RATING", value: primaryRating || "—" },
      ]
    : [
        { label: "MATCHES", value: stats.batting.matches || "—" },
        { label: "RUNS", value: stats.batting.matches > 0 ? stats.batting.runs.toLocaleString() : "—" },
        { label: "AVG", value: stats.batting.matches > 0 ? stats.batting.average.toFixed(1) : "—" },
        { label: "SR", value: stats.batting.matches > 0 ? stats.batting.strikeRate.toFixed(1) : "—", highlight: true },
        { label: "RATING", value: primaryRating || "—" },
      ];

  const roleLabel =
    player.role === "WK-Batsman" ? "WICKETKEEPER" :
    player.role === "All-Rounder" ? "ALL-ROUNDER" :
    player.role === "Pace Bowler" ? "PACE BOWLER" :
    player.role === "Spin Bowler" ? "SPIN BOWLER" : "BATSMAN";

  const nationalityLabel = player.nationality === "Overseas"
    ? `OVERSEAS · ${player.battingStyle?.slice(0, 3).toUpperCase() ?? "INT"}`
    : "INDIA";

  return (
    <div className="flex flex-col border-b-2 border-border">
      {/* Identity band */}
      <div className="px-6 py-[18px] border-b-2 border-border">
        {/* Kicker */}
        <div className="font-space-mono font-bold text-[10px] tracking-[.16em] text-danger mb-2 uppercase">
          ■ ON THE BLOCK · LOT {lotIndex + 1}
        </div>

        {/* Name row */}
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <h2 className="font-anton text-[48px] leading-none uppercase text-text-primary truncate flex-1 min-w-0">
            {player.name}
          </h2>
          <div className="text-right shrink-0">
            <div className="font-space-mono font-bold text-[9px] tracking-widest text-text-secondary mb-0.5">BASE</div>
            <div className="font-barlow-condensed font-bold text-[22px] leading-none text-text-primary">
              {crore(player.basePrice)} Cr
            </div>
          </div>
        </div>

        {/* Chips */}
        <div className="flex items-center gap-[7px] flex-wrap">
          <span
            className="font-space-mono font-bold text-[10px] tracking-widest px-[7px] py-[3px] rounded-[3px] bg-border text-bg"
          >
            {roleLabel}
          </span>
          {player.nationality === "Overseas" && (
            <span className="font-space-mono font-bold text-[10px] tracking-widest px-[7px] py-[3px] rounded-[3px] bg-accent text-border border border-border">
              {nationalityLabel}
            </span>
          )}
          <span className="font-space-mono font-bold text-[10px] tracking-widest px-[7px] py-[3px] rounded-[3px] border border-border text-text-primary">
            {player.isCapped ? "CAPPED" : "UNCAPPED"} · {player.age}
          </span>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex">
        {statCells.map((cell, i) => (
          <div
            key={cell.label}
            className="flex-1 min-w-0 flex flex-col items-center justify-center py-3 px-2"
            style={i < statCells.length - 1 ? { borderRight: "1px solid rgba(22,19,15,.18)" } : {}}
          >
            <span className="font-space-mono text-[9px] tracking-widest text-text-secondary mb-1 uppercase">
              {cell.label}
            </span>
            <span
              className="font-barlow-condensed font-bold text-[22px] leading-none"
              style={{ color: cell.highlight ? "#d6492f" : "#16130f" }}
            >
              {cell.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
