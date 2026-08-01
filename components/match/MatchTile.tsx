"use client";

import { Calendar, Clock, ChevronRight } from "lucide-react";
import type { Team } from "@/lib/types";
import type { UnifiedMatchRecord } from "./MatchScorecardModal";

interface MatchTileProps {
  match: UnifiedMatchRecord;
  teams: Record<string, Team>;
  variant?: "schedule" | "club" | "compact";
  onOpenScorecard?: (match: UnifiedMatchRecord) => void;
}

export default function MatchTile({
  match,
  teams,
  variant = "schedule",
  onOpenScorecard,
}: MatchTileProps) {
  const teamA = teams[match.teamA];
  const teamB = teams[match.teamB];

  const teamALabel = teamA?.shortName ?? match.teamA;
  const teamBLabel = teamB?.shortName ?? match.teamB;

  const resultText =
    match.simulation?.summary?.resultText ??
    match.archivedResultText ??
    (match.winner && match.winner !== "TIE"
      ? `${teams[match.winner]?.shortName ?? match.winner} won`
      : match.played
      ? "Match Tied"
      : null);

  // Variant 1: CLUB PROFILE CARD (Compact grid item for Club Page)
  if (variant === "club") {
    return (
      <div
        onClick={() => onOpenScorecard?.(match)}
        className="group cursor-pointer rounded-lg border border-border bg-surface p-4 transition-all hover:border-accent/60 hover:shadow-md"
      >
        <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
          <span className="font-space-mono text-[10px] font-bold uppercase text-accent">
            {match.label || `Match ${match.matchNumber}`}
          </span>
          <span className="flex items-center gap-1 font-space-mono text-[9px] uppercase text-text-secondary">
            <Clock size={11} /> {match.time ?? "19:30"}
          </span>
        </div>

        <div className="my-3 flex items-center justify-between gap-3">
          <div className="flex-1 text-center">
            <div className="font-anton text-lg text-text-primary">{teamALabel}</div>
            {match.scoreA ? (
              <div className="font-space-mono text-xs font-bold text-accent">
                {match.scoreA.runs}/{match.scoreA.wickets}
              </div>
            ) : (
              <div className="font-space-mono text-[10px] text-text-secondary">TBD</div>
            )}
          </div>

          <div className="font-space-mono text-xs font-bold text-text-secondary">VS</div>

          <div className="flex-1 text-center">
            <div className="font-anton text-lg text-text-primary">{teamBLabel}</div>
            {match.scoreB ? (
              <div className="font-space-mono text-xs font-bold text-accent">
                {match.scoreB.runs}/{match.scoreB.wickets}
              </div>
            ) : (
              <div className="font-space-mono text-[10px] text-text-secondary">TBD</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/50 pt-2.5">
          <span className="truncate font-barlow text-xs font-medium text-text-secondary">
            {resultText || "Upcoming Fixture"}
          </span>
          <span className="flex items-center font-space-mono text-[10px] font-bold uppercase text-accent group-hover:translate-x-0.5 transition-transform">
            Scorecard <ChevronRight size={12} />
          </span>
        </div>
      </div>
    );
  }

  // Variant 2: SCHEDULE ROW (Horizontal row for Full Schedule Page)
  if (variant === "schedule") {
    return (
      <div
        onClick={() => onOpenScorecard?.(match)}
        className="group flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3 transition-all hover:border-accent/60 hover:bg-surface-elevated"
      >
        <div className="flex min-w-[130px] flex-col">
          <span className="font-space-mono text-[10px] font-bold uppercase text-accent">
            {match.label || `Match ${match.matchNumber}`}
          </span>
          <span className="flex items-center gap-1 font-space-mono text-[9px] uppercase text-text-secondary">
            <Calendar size={11} /> {match.date ?? "Date TBD"}
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-right">
            <span className="font-anton text-base text-text-primary">{teamALabel}</span>
            {match.scoreA && (
              <span className="font-space-mono text-xs font-bold text-accent">
                {match.scoreA.runs}/{match.scoreA.wickets}
              </span>
            )}
          </div>

          <span className="rounded-full bg-border px-2 py-0.5 font-space-mono text-[9px] font-bold uppercase text-text-secondary">
            VS
          </span>

          <div className="flex items-center gap-2 text-left">
            {match.scoreB && (
              <span className="font-space-mono text-xs font-bold text-accent">
                {match.scoreB.runs}/{match.scoreB.wickets}
              </span>
            )}
            <span className="font-anton text-base text-text-primary">{teamBLabel}</span>
          </div>
        </div>

        <div className="flex min-w-[160px] items-center justify-end gap-2 text-right">
          <span className="truncate font-barlow text-xs font-medium text-text-secondary">
            {resultText || "Upcoming"}
          </span>
          <ChevronRight size={14} className="text-text-secondary group-hover:text-accent group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    );
  }

  // Variant 3: COMPACT PILL
  return (
    <div
      onClick={() => onOpenScorecard?.(match)}
      className="inline-flex cursor-pointer items-center gap-2 rounded border border-border bg-surface px-2.5 py-1 transition-all hover:border-accent"
    >
      <span className="font-space-mono text-[10px] font-bold uppercase text-text-primary">
        {teamALabel} vs {teamBLabel}
      </span>
      {match.played && (
        <span className="font-space-mono text-[9px] text-accent">
          ({match.scoreA?.runs}/{match.scoreA?.wickets} - {match.scoreB?.runs}/{match.scoreB?.wickets})
        </span>
      )}
    </div>
  );
}
