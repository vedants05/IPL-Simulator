"use client";
import { useState } from "react";
import { Player } from "@/lib/types";
import { useGameStore } from "@/lib/store/gameStore";

interface Props {
  player: Player;
}

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

function RatingBar({
  label,
  current,
  potential,
  color,
}: {
  label: string;
  current: number;
  potential: number;
  color: string;
}) {
  const isEmpty = current === 0 && potential === 0;
  const hasPotential = !isEmpty && potential > current;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-space-mono text-[9px] tracking-widest text-text-secondary uppercase">
          {label}
        </span>
        {isEmpty ? (
          <span className="font-space-mono text-[9px] text-muted tracking-wider">N/A</span>
        ) : (
          <span className="font-barlow-condensed font-bold text-[13px]" style={{ color }}>
            {current}
            {hasPotential && (
              <span className="font-barlow text-[11px] text-text-secondary ml-1">→ {potential}</span>
            )}
          </span>
        )}
      </div>
      <div
        className="relative h-[5px] rounded-sm overflow-hidden"
        style={{ backgroundColor: "rgba(22,19,15,.12)" }}
      >
        {hasPotential && (
          <div
            className="absolute inset-y-0 left-0 rounded-sm opacity-25"
            style={{ width: `${potential}%`, backgroundColor: color }}
          />
        )}
        {!isEmpty && (
          <div
            className="absolute inset-y-0 left-0 rounded-sm"
            style={{ width: `${current}%`, backgroundColor: color }}
          />
        )}
      </div>
    </div>
  );
}

export default function PlayerCard({ player }: Props) {
  const auction = useGameStore((s) => s.auction);
  const lotIndex = auction?.currentLotIndex ?? 0;
  const stats = player.careerStats;
  const [showDetails, setShowDetails] = useState(false);

  const hasBat = stats.batting.matches > 0;
  const hasBowl = stats.bowling.wickets > 0;

  const roleLabel =
    player.role === "WK-Batsman" ? "WICKETKEEPER" :
    player.role === "All-Rounder" ? "ALL-ROUNDER" :
    player.role === "Pace Bowler" ? "PACE BOWLER" :
    player.role === "Spin Bowler" ? "SPIN BOWLER" : "BATSMAN";

  const statCells: Array<{ label: string; value: string | number; highlight?: boolean }> =
    hasBowl && !hasBat
      ? [
          { label: "MATCHES", value: stats.bowling.matches },
          { label: "WICKETS", value: stats.bowling.wickets },
          { label: "ECON", value: stats.bowling.economy.toFixed(2) },
          { label: "AVG", value: stats.bowling.average.toFixed(1), highlight: true },
          { label: "BEST", value: stats.bowling.bestFigures },
        ]
      : [
          { label: "MATCHES", value: hasBat ? stats.batting.matches : "—" },
          { label: "RUNS", value: hasBat ? stats.batting.runs.toLocaleString() : "—" },
          { label: "AVG", value: hasBat ? stats.batting.average.toFixed(1) : "—" },
          { label: "SR", value: hasBat ? stats.batting.strikeRate.toFixed(1) : "—", highlight: true },
          { label: hasBowl ? "WKTs" : "50s", value: hasBowl ? stats.bowling.wickets : (hasBat ? stats.batting.fifties : "—") },
        ];

  return (
    <div className="flex flex-col" style={{ borderBottom: "2px solid #16130f" }}>
      {/* Identity band */}
      <div className="px-6 py-4" style={{ borderBottom: "2px solid #16130f" }}>
        {/* Kicker */}
        <div className="font-space-mono font-bold text-[10px] tracking-[.16em] text-danger mb-2 uppercase">
          ■ ON THE BLOCK · LOT {lotIndex + 1}
        </div>

        {/* Name + base price */}
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="font-anton text-[40px] leading-none uppercase text-text-primary truncate flex-1 min-w-0">
            {player.name}
          </h2>
          <div className="text-right shrink-0">
            <div className="font-space-mono font-bold text-[9px] tracking-widest text-text-secondary mb-0.5">BASE</div>
            <div className="font-barlow-condensed font-bold text-[20px] leading-none text-text-primary">
              {crore(player.basePrice)}
            </div>
          </div>
        </div>

        {/* Chips row + MORE INFO button on right */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] bg-border text-bg">
              {roleLabel}
            </span>
            {player.nationality === "Overseas" && (
              <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] bg-accent text-border border border-border">
                OVERSEAS
              </span>
            )}
            <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] border border-border text-text-primary">
              {player.isCapped ? "CAPPED" : "UNCAPPED"} · AGE {player.age}
            </span>
            <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] border border-border text-text-secondary">
              {player.battingStyle === "Right-hand" ? "RHB" : "LHB"}
            </span>
            {player.bowlingStyle && (
              <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] border border-border text-text-secondary">
                {player.bowlingStyle}
              </span>
            )}
            <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] border border-border text-text-secondary">
              {player.potential.toUpperCase()}
            </span>
          </div>

          {/* MORE INFO toggle */}
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-[5px] font-space-mono font-bold text-[9px] tracking-widest transition-colors"
            style={{
              border: "1.5px solid #16130f",
              backgroundColor: showDetails ? "#16130f" : "transparent",
              color: showDetails ? "#ffc400" : "#16130f",
              borderRadius: "3px",
            }}
          >
            PLAYER FILE
            <span className="text-[8px]">{showDetails ? "▲" : "▼"}</span>
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex shrink-0" style={{ borderBottom: "2px solid #16130f" }}>
        {statCells.map((cell, i) => (
          <div
            key={cell.label}
            className="flex-1 min-w-0 flex flex-col items-center justify-center py-2 px-1"
            style={i < statCells.length - 1 ? { borderRight: "1px solid rgba(22,19,15,.18)" } : {}}
          >
            <span className="font-space-mono text-[8px] tracking-widest text-text-secondary mb-0.5 uppercase">
              {cell.label}
            </span>
            <span
              className="font-barlow-condensed font-bold text-[18px] leading-none"
              style={{ color: cell.highlight ? "#d6492f" : "#16130f" }}
            >
              {cell.value}
            </span>
          </div>
        ))}
      </div>

      {/* Ratings — always show both bars */}
      <div
        className="px-6 py-4 flex flex-col gap-4 shrink-0"
        style={{ borderBottom: "2px solid #16130f" }}
      >
        <RatingBar
          label="Batting"
          current={player.currentBatting}
          potential={player.potentialBatting}
          color="#004BA0"
        />
        <RatingBar
          label="Bowling"
          current={player.currentBowling}
          potential={player.potentialBowling}
          color="#d6492f"
        />
      </div>

      {/* PLAYER FILE — expandable details */}
      {showDetails && (
        <div className="shrink-0" style={{ borderBottom: "2px solid #16130f" }}>
          {/* IPL History */}
          {player.iplHistory.length > 0 && (
            <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(22,19,15,.15)" }}>
              <div className="font-space-mono font-bold text-[9px] tracking-widest text-text-secondary mb-3 uppercase">
                IPL History
              </div>
              <div className="flex flex-col gap-2">
                {[...player.iplHistory].reverse().map((h, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-space-mono text-[9px] text-muted w-[32px]">{h.season}</span>
                      <span className="font-barlow font-semibold text-[12px] text-text-primary">{h.teamId}</span>
                    </div>
                    <span className="font-barlow-condensed font-bold text-[13px] text-danger">
                      {crore(h.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extended bowling stats (for players with bowling data) */}
          {hasBowl && (
            <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(22,19,15,.15)" }}>
              <div className="font-space-mono font-bold text-[9px] tracking-widest text-text-secondary mb-3 uppercase">
                Bowling
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                <div className="flex justify-between text-[12px]">
                  <span className="font-barlow text-text-secondary">Wickets</span>
                  <span className="font-barlow-condensed font-bold text-text-primary">{stats.bowling.wickets}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="font-barlow text-text-secondary">Economy</span>
                  <span className="font-barlow-condensed font-bold text-text-primary">{stats.bowling.economy.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="font-barlow text-text-secondary">Average</span>
                  <span className="font-barlow-condensed font-bold text-text-primary">{stats.bowling.average.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="font-barlow text-text-secondary">Best</span>
                  <span className="font-barlow-condensed font-bold text-text-primary">{stats.bowling.bestFigures}</span>
                </div>
              </div>
            </div>
          )}

          {/* Extended batting stats */}
          {hasBat && (
            <div className="px-6 py-4">
              <div className="font-space-mono font-bold text-[9px] tracking-widest text-text-secondary mb-3 uppercase">
                Batting
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                <div className="flex justify-between text-[12px]">
                  <span className="font-barlow text-text-secondary">Runs</span>
                  <span className="font-barlow-condensed font-bold text-text-primary">{stats.batting.runs.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="font-barlow text-text-secondary">Average</span>
                  <span className="font-barlow-condensed font-bold text-text-primary">{stats.batting.average.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="font-barlow text-text-secondary">Strike Rate</span>
                  <span className="font-barlow-condensed font-bold text-text-primary">{stats.batting.strikeRate.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="font-barlow text-text-secondary">50s / 100s</span>
                  <span className="font-barlow-condensed font-bold text-text-primary">{stats.batting.fifties} / {stats.batting.hundreds}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
