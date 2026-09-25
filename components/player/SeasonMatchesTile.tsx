"use client";

import { useMemo } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import type { Player, Team } from "@/lib/types";
import type { ProfileModalMatch } from "@/components/player/PlayerProfileModal";

interface SeasonMatchesTileProps {
  player: Player;
  teamId: string | null;
  season: number;
  fixtures?: ProfileModalMatch[];
  teams: Record<string, Team>;
}

export function SeasonMatchesTile({ player, teamId, season, fixtures, teams }: SeasonMatchesTileProps) {
  const injuryHistory = useGameStore((state) => state.injuryHistory);
  const activeInjury = useGameStore((state) => state.activeInjuries[player.id]);
  const matches = useMemo(() => (fixtures ?? [])
    .filter((fixture) => fixture.teamA && fixture.teamB && teamId && (fixture.teamA === teamId || fixture.teamB === teamId)
      && (!fixture.date || Number(fixture.date.slice(0, 4)) === season))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.matchNumber ?? 0) - (b.matchNumber ?? 0)), [fixtures, season, teamId]);
  const injuries = useMemo(() => activeInjury ? [...injuryHistory, activeInjury] : injuryHistory,
    [activeInjury, injuryHistory]);
  const hasPlayed = matches.some((match) => {
    const lineup = match.simulation?.lineups?.[teamId ?? ""];
    return lineup?.startingXI?.includes(player.id) || lineup?.finalXI?.includes(player.id);
  });
  const hasBowled = matches.some((match) => (match.simulation?.innings
    ?? (match.scorecard ? [match.scorecard.inningsA, match.scorecard.inningsB] : []))
    .some((innings) => innings.bowling.some((entry) => entry.id === player.id && (entry.overs ?? 0) > 0)));
  const showBowling = player.role === "Pace Bowler" || player.role === "Spin Bowler" || player.role === "All-Rounder" || hasBowled;

  return <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded border border-border bg-bg p-2" aria-label="Season matches">
    <h4 className="shrink-0 border-b border-border pb-1 font-space-mono text-[10px] font-bold uppercase text-text-primary">Season Matches</h4>
    {matches.length ? <div className="mt-1 grid min-h-0 flex-1" style={{ gridTemplateRows: `repeat(${matches.length}, minmax(0, 1fr))` }}>
      {matches.map((match) => {
        const home = match.teamA === teamId;
        const opposition = teams[(home ? match.teamB : match.teamA) ?? ""];
        const lineup = match.simulation?.lineups?.[teamId ?? ""];
        const started = Boolean(lineup?.startingXI?.includes(player.id));
        const impactUsed = match.simulation?.impactDecisions?.some((decision) => decision.teamId === teamId && decision.used && decision.incomingPlayerId === player.id);
        const impactUnused = !started && !impactUsed && Boolean(lineup?.impactSubs?.includes(player.id));
        const innings = match.simulation?.innings ?? (match.scorecard ? [match.scorecard.inningsA, match.scorecard.inningsB] : []);
        const batting = innings.flatMap((entry) => entry.batting).find((entry) => entry.id === player.id);
        const bowling = innings.flatMap((entry) => entry.bowling).find((entry) => entry.id === player.id && (entry.overs ?? 0) > 0);
        const played = started || impactUsed || Boolean(batting || bowling);
        const injured = Boolean(match.date && injuries.some((injury) => injury.playerId === player.id
          && injury.startedOn <= match.date! && match.date! < (injury.endedOn ?? injury.actualReturnDate)));
        const status = played ? impactUsed ? "Impact Sub Used" : "In Lineup"
          : !match.played ? "Upcoming" : injured ? "Injured" : impactUnused ? "Impact Sub Unused" : "Not Selected";
        const battingText = batting && ((batting.balls ?? 0) > 0 || (batting.runs ?? 0) > 0)
          ? `${batting.runs ?? 0}${batting.notOut || batting.dismissal === "not out" ? "*" : ""}(${batting.balls ?? 0})` : "DNB";
        const bowlingText = bowling ? `${bowling.wickets ?? 0}/${bowling.runsConceded ?? 0} (${bowling.overs ?? 0})` : "DNB";
        const result = match.played
          ? match.winner === teamId ? "W" : match.winner === (home ? match.teamB : match.teamA) ? "L" : "NR"
          : "";
        return <div key={match.id} className={`flex min-h-0 items-center gap-1 border-b font-space-mono text-[8px] leading-none last:border-b-0 ${status === "Injured" ? "border-red-500/20 bg-red-500/10" : "border-border/50"}`}>
          <span className="w-[26px] shrink-0 font-bold text-text-secondary">{match.matchNumber != null ? `M${match.matchNumber}` : "—"}</span>
          <span className="w-3 shrink-0 text-center font-bold text-text-secondary">{home ? "H" : "A"}</span>
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: opposition?.primaryColor ?? "var(--accent)" }} />
          <span className="w-[60px] shrink-0 whitespace-nowrap font-bold text-text-primary">vs {opposition?.shortName ?? (home ? match.teamB : match.teamA) ?? "?"}</span>
          <span className={`w-[17px] shrink-0 text-center font-bold ${result === "W" ? "text-emerald-500" : result === "L" ? "text-red-500" : "text-text-secondary"}`} aria-label={result === "W" ? "Win" : result === "L" ? "Loss" : result === "NR" ? "No result" : undefined}>{result}</span>
          <span className={`flex min-w-0 flex-1 items-center gap-1 truncate ${status === "Injured" ? "font-bold text-red-500" : "text-text-secondary"}`} title={status}>
            {status}
            {status === "Injured" && <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-sm bg-red-600 text-[10px] font-bold leading-none text-white" aria-label="Medical injury">+</span>}
          </span>
          {hasPlayed && <span className="flex w-[164px] shrink-0 items-center justify-between gap-4 border-l border-border pl-1 font-bold text-text-primary">
            <span className="w-[54px] whitespace-nowrap text-right">{played ? battingText : ""}</span>
            {showBowling && <span className="w-[84px] whitespace-nowrap text-right text-sky-500">{played ? bowlingText : ""}</span>}
          </span>}
        </div>;
      })}
    </div> : <p className="flex flex-1 items-center justify-center text-center font-space-mono text-[9px] text-text-secondary">No matches scheduled for this team this season</p>}
  </section>;
}
