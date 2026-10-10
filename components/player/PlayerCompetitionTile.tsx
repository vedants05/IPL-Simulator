"use client";

import { useMemo } from "react";
import { getPlayerCompetition } from "@/lib/logic/playerCompetition";
import { useGameStore } from "@/lib/store/gameStore";
import type { Player, Team } from "@/lib/types";

interface Props {
  player: Player;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  onSelectPlayer: (playerId: string) => void;
}

export function PlayerCompetitionTile({ player, players, teams, onSelectPlayer }: Props) {
  const userTeamId = useGameStore((state) => state.userTeamId);
  const currentSeason = useGameStore((state) => state.currentSeason);
  const activeInjuries = useGameStore((state) => state.activeInjuries);
  const competition = useMemo(() => getPlayerCompetition(
    player, players, teams, userTeamId, currentSeason, activeInjuries,
  ), [player, players, teams, userTeamId, currentSeason, activeInjuries]);

  return <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded border border-border bg-bg p-2" aria-label="Player competition">
    <div className="flex shrink-0 items-baseline gap-1 border-b border-border pb-1 whitespace-nowrap">
      <h4 className="shrink-0 font-space-mono text-[9px] font-bold uppercase text-text-primary">Player Competition</h4>
      <span className="min-w-0 truncate font-space-mono text-[10px] text-text-secondary" title={`${competition.team?.shortName ?? "No team"} ${competition.roleLabel}`}>
        · {competition.team?.shortName ?? "No team"} {competition.roleLabel}
      </span>
    </div>
    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto py-1.5 pr-0.5">
      {competition.order.map(({ player: candidate, rank, reason }) => {
        const isSelected = candidate.id === player.id;
        return <button key={candidate.id} type="button" disabled={isSelected} onClick={() => onSelectPlayer(candidate.id)}
          title={isSelected ? undefined : reason}
          aria-label={isSelected ? `${candidate.name}, age ${candidate.age}, ${candidate.nationality === "Overseas" ? "Overseas" : "Indian"}, this player` : `${candidate.name}, age ${candidate.age}, ${candidate.nationality === "Overseas" ? "Overseas" : "Indian"}, ranked ${rank < competition.selectedRank ? "above" : "below"} this player. ${reason}`}
          className={`block w-full min-w-0 rounded border px-1.5 py-1 text-left transition-colors ${isSelected ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/60 hover:bg-accent/5"}`}>
          <span className="flex items-start justify-between gap-1 font-space-mono leading-tight">
            <span className="min-w-0 break-words text-[9px] font-bold text-text-primary">{rank}. {candidate.name}</span>
            <span className="shrink-0 whitespace-nowrap text-[7px] text-accent" aria-label={candidate.role === "All-Rounder" ? `Batting ${candidate.currentBatting}, bowling ${candidate.currentBowling}` : candidate.role === "Pace Bowler" || candidate.role === "Spin Bowler" ? `Bowling ${candidate.currentBowling}` : `Batting ${candidate.currentBatting}`}>
              {candidate.role === "All-Rounder"
                ? `BT${candidate.currentBatting}/BL${candidate.currentBowling}`
                : candidate.role === "Pace Bowler" || candidate.role === "Spin Bowler"
                  ? `BL${candidate.currentBowling}`
                  : `BT${candidate.currentBatting}`}
            </span>
          </span>
          <span className="block font-space-mono text-[7px] leading-snug text-text-secondary">Age {candidate.age} · {candidate.nationality === "Overseas" ? "Overseas" : "Indian"}</span>
        </button>;
      })}
    </div>
    <div className="shrink-0 border-t border-border pt-1">
      <h5 className="mb-0.5 font-space-mono text-[9px] font-bold uppercase text-text-primary">League Competition</h5>
      {competition.leagueRival ? <button type="button" onClick={() => onSelectPlayer(competition.leagueRival!.id)} className="flex w-full min-w-0 items-center justify-between gap-1 rounded border border-border bg-surface px-1.5 py-1 text-left hover:border-accent/60 hover:bg-accent/5">
        <span className="min-w-0 truncate font-space-mono text-[9px] font-bold text-text-primary" title={competition.leagueRival.name}>{competition.leagueRival.name}</span>
        <span className="shrink-0 font-space-mono text-[7px] font-bold uppercase text-accent">{competition.leagueRivalTeam?.shortName ?? "League"}</span>
      </button> : <p className="font-space-mono text-[8px] text-text-secondary">No comparable player signed</p>}
    </div>
  </section>;
}
