"use client";
import { useState } from "react";
import { Player } from "@/lib/types";
import { useGameStore } from "@/lib/store/gameStore";
import { PLAYERS } from "@/lib/data/players";

const PLAYERS_MAP = new Map(PLAYERS.map((p) => [p.id, p]));

interface Props {
  player: Player;
  soldPrice?: number;
  collapsible?: boolean;
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

export default function PlayerCard({ player, soldPrice, collapsible = true }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const { teams } = useGameStore();

  const seedP = PLAYERS_MAP.get(player.id);
  const isWk = player.isWicketkeeper ?? seedP?.isWicketkeeper;
  const isPtWk = player.isPartTimeWk ?? seedP?.isPartTimeWk;
  const isOpener = player.isOpener ?? seedP?.isOpener;
  const isFinisher = player.isFinisher ?? seedP?.isFinisher;

  const isFullTimeWk = isWk && !isPtWk;
  const isExpanded = !collapsible || showDetails;

  const stats = player.careerStats;
  const hasBat = stats.batting.runs > 0 || stats.batting.matches > 0;
  const hasBowl = stats.bowling.wickets > 0;

  const roleLabel = player.role === "WK-Batsman" ? "BATSMAN" : player.role.toUpperCase();

  const statCells = [
    { label: "MATCHES", value: stats.batting.matches || stats.bowling.matches || "—" },
    { label: "RUNS", value: hasBat ? stats.batting.runs.toLocaleString() : "—" },
    { label: "AVG", value: hasBat ? stats.batting.average.toFixed(1) : "—" },
    { label: "SR", value: hasBat ? stats.batting.strikeRate.toFixed(1) : "—" },
    { label: hasBowl ? "WKTs" : "50s", value: hasBowl ? stats.bowling.wickets : (hasBat ? stats.batting.fifties : "—") },
  ];

  const validHistory = player.iplHistory.filter(
    (g) => g.teamId && g.teamId.toUpperCase() !== "UNSOLD" && g.teamId.trim() !== ""
  );

  return (
    <div className="flex flex-col bg-surface overflow-hidden">
      {/* Player header banner */}
      <div
        className="px-6 py-4 flex flex-col gap-2 shrink-0"
        style={{ borderBottom: "2px solid #16130f" }}
      >
        <div className="flex justify-between items-start">
          <div className="min-w-0 flex-1 pr-4">
            {/* Player Name & Stars in the same row */}
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className="font-anton text-[42px] leading-none tracking-wide text-text-primary uppercase">
                {player.name}
              </h2>
              {/* Star rating right next to name */}
              <div className="flex gap-0.5 items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`text-[15px] ${
                      i < Math.floor(player.starRating)
                        ? "text-accent"
                        : i < player.starRating
                        ? "text-accent opacity-60"
                        : "text-muted/30"
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right side: Base / Salary price badge */}
          <div className="flex flex-col items-end shrink-0">
            <span className="font-space-mono font-bold text-[9px] tracking-widest text-text-secondary uppercase">
              {soldPrice !== undefined
                ? "SALARY"
                : player.currentTeamId
                ? "SALARY"
                : "BASE"}
            </span>
            <span className="font-anton text-[24px] leading-none text-text-primary">
              {soldPrice !== undefined
                ? crore(soldPrice)
                : player.currentTeamId
                ? crore(player.iplHistory.find((h) => h.season === "2027")?.price ?? player.iplHistory[player.iplHistory.length - 1]?.price ?? player.basePrice)
                : crore(player.basePrice)}
            </span>
          </div>
        </div>

        {/* Player tags */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            {/* 1. Role */}
            <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] border border-[#16130f] text-[#16130f] bg-transparent uppercase">
              {roleLabel}
            </span>

            {/* 2. Bowling style */}
            {player.bowlingStyle && (
              <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] border border-[#16130f] text-[#16130f] bg-transparent uppercase">
                {player.bowlingStyle.toUpperCase()}
              </span>
            )}

            {/* 3. Specialty Tabs: PART-TIME WK or WK, OPENER, FINISHER */}
            {isPtWk ? (
              <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] border border-[#16130f] text-[#16130f] bg-transparent uppercase">
                PART-TIME WK
              </span>
            ) : isFullTimeWk ? (
              <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] border border-[#16130f] text-[#16130f] bg-transparent uppercase">
                WK
              </span>
            ) : null}

            {isOpener && (
              <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] border border-[#16130f] text-[#16130f] bg-transparent uppercase">
                OPENER
              </span>
            )}

            {isFinisher && (
              <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] border border-[#16130f] text-[#16130f] bg-transparent uppercase">
                FINISHER
              </span>
            )}

            {/* 4. Overseas */}
            {player.nationality === "Overseas" && (
              <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] border border-[#16130f] text-[#16130f] bg-transparent uppercase">
                OVERSEAS
              </span>
            )}

            {/* 5. Capped / Age */}
            <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] border border-[#16130f] text-[#16130f] bg-transparent uppercase">
              {player.isCapped ? "CAPPED" : "UNCAPPED"} · AGE {player.age}
            </span>

            {/* 6. RHB / LHB */}
            <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] border border-[#16130f] text-[#16130f] bg-transparent uppercase">
              {player.battingStyle === "Right-hand" ? "RHB" : "LHB"}
            </span>

            {/* 7. Potential */}
            <span className="font-space-mono font-bold text-[9px] tracking-widest px-2 py-[3px] rounded-[3px] border border-[#16130f] text-[#16130f] bg-transparent uppercase">
              {player.potential.toUpperCase()}
            </span>
          </div>

          {/* PLAYER FILE toggle — shown when collapsible is true */}
          {collapsible && (
            <button
              onClick={() => setShowDetails((v) => !v)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-[5px] font-space-mono font-bold text-[9px] tracking-widest transition-all duration-150 cursor-pointer ${
                showDetails
                  ? "bg-[#16130f] text-white hover:bg-[#332c25]"
                  : "bg-transparent text-[#16130f] hover:bg-[#16130f] hover:text-white"
              }`}
              style={{
                border: "1.5px solid #16130f",
                borderRadius: "3px",
              }}
            >
              PLAYER FILE
              <span className="text-[8px]">{showDetails ? "▲" : "▼"}</span>
            </button>
          )}
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
            <span className="font-barlow-condensed font-bold text-[18px] leading-none text-text-primary">
              {cell.value}
            </span>
          </div>
        ))}
      </div>

      {/* Ratings — Batting & Bowling */}
      <div
        className="px-6 py-4 flex flex-col gap-4 shrink-0"
        style={{ borderBottom: "2px solid #16130f" }}
      >
        <RatingBar
          label="Batting"
          current={player.currentBatting}
          potential={player.potentialBatting}
          color="var(--team-accent, #1d55c4)"
        />
        <RatingBar
          label="Bowling"
          current={player.currentBowling}
          potential={player.potentialBowling}
          color="var(--team-bowling-bar, #ffc72c)"
        />
      </div>

      {/* Additional stats — shown when expanded or when non-collapsible */}
      {isExpanded && (
        <div className="shrink-0" style={{ borderBottom: "2px solid #16130f" }}>
          {/* Traits & Personality Ratings */}
          <div className="px-6 py-4 flex flex-col gap-3" style={{ borderBottom: "1px solid rgba(22,19,15,.15)" }}>
            <div className="font-space-mono font-bold text-[9px] tracking-widest text-text-secondary uppercase">
              Traits & Personality
            </div>
            <RatingBar
              label="Reputation"
              current={(player.reputation ?? seedP?.reputation ?? 5) * 10}
              potential={(player.reputation ?? seedP?.reputation ?? 5) * 10}
              color="#8b5cf6"
            />
            <RatingBar
              label="Captaincy"
              current={player.captaincy ?? seedP?.captaincy ?? 50}
              potential={player.captaincy ?? seedP?.captaincy ?? 50}
              color="#0284c7"
            />
            <RatingBar
              label="Batting Aggression"
              current={player.battingAggression ?? seedP?.battingAggression ?? 50}
              potential={player.battingAggression ?? seedP?.battingAggression ?? 50}
              color="#f97316"
            />
          </div>

          {/* IPL History (Valid Teams Only) */}
          {validHistory.length > 0 && (
            <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(22,19,15,.15)" }}>
              <div className="font-space-mono font-bold text-[9px] tracking-widest text-text-secondary mb-3 uppercase">
                IPL History
              </div>
              <div className="flex flex-col gap-2">
                {validHistory.map((g, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-space-mono text-[9px] text-text-secondary w-[68px]">
                        {g.season}
                      </span>
                      <span className="font-barlow font-semibold text-[12px] text-text-primary">{g.teamId}</span>
                    </div>
                    <span className="font-barlow-condensed font-bold text-[13px] text-danger">
                      {crore(g.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extended bowling stats */}
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
