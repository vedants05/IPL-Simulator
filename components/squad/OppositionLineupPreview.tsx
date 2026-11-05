"use client";

import { useMemo } from "react";
import type { Player, Team } from "@/lib/types";
import { buildAiMatchLineups } from "@/lib/logic/aiLineupSelector";
import { useGameStore } from "@/lib/store/gameStore";
import type { OppositionApproach } from "@/lib/logic/teamTactics";
import TargetBowlerSelect from "./TargetBowlerSelect";
import OppositionBattingFacts from "./OppositionBattingFacts";
import OpponentPlanChangesPanel from "./OpponentPlanChanges";
import OppositionBowlersPreview from "./OppositionBowlersPreview";
import { projectedOppositionBowlers } from "@/lib/logic/oppositionBowlingLineup";

const roleLabel: Record<string, string> = { Batsman: "BAT", "WK-Batsman": "WK", "All-Rounder": "AR", "Pace Bowler": "PACE", "Spin Bowler": "SPIN" };
const rowGrid = "grid grid-cols-[214px_82px_82px_90px_104px_minmax(90px,1fr)]";

function battingTraits(player: Player) {
  const metrics = [
    { label: "Pace", rating: player.paceRating },
    { label: "Spin", rating: player.spinRating },
    { label: "Powerplay", rating: player.powerplayBatting },
    { label: "Middle overs", rating: player.middleOversBatting },
    { label: "Death overs", rating: player.deathBatting },
  ].filter((metric): metric is { label: string; rating: number } => typeof metric.rating === "number" && Number.isFinite(metric.rating));
  const ranked = [...metrics].sort((a, b) => b.rating - a.rating);
  // Neutral/default ratings are not scouting findings. Only describe clear traits.
  const strengths = ranked.filter(metric => metric.rating >= 65).slice(0, 2).map(metric => metric.label);
  const weaknesses = [...ranked].reverse().filter(metric => metric.rating <= 35).slice(0, 2).map(metric => metric.label);
  return { strengths, weaknesses };
}

export default function OppositionLineupPreview({ defaultPlan, planChanges, onPlanChanges, instructions, onInstructionChange, fixtures, battingXI, team, players, approaches, onApproachChange, bowlers, targetBowlers, onTargetBowlerChange, onOpenPlayer }: {
  defaultPlan: import("@/lib/logic/tacticalMatchPlan").TacticalMatchPlan; planChanges: import("@/lib/logic/teamTactics").OpponentPlanChanges; onPlanChanges: (changes: import("@/lib/logic/teamTactics").OpponentPlanChanges) => void;
  instructions: Record<string, import("@/lib/logic/teamTactics").BowlerBattingInstruction>; onInstructionChange: (id: string, instruction: import("@/lib/logic/teamTactics").BowlerBattingInstruction) => void;
  fixtures: import("@/lib/logic/playerAnalysisMetrics").PlayerAnalysisFixture[]; battingXI: Player[];
  team: Team; players: Record<string, Player>;
  approaches: Record<string, OppositionApproach>;
  onApproachChange: (playerId: string, approach: OppositionApproach) => void;
  onOpenPlayer: (playerId: string) => void;
  bowlers: Player[];
  targetBowlers: Record<string, string>;
  onTargetBowlerChange: (playerId: string, bowlerId: string | null) => void;
}) {
  const injuries = useGameStore(state => state.activeInjuries);
  const prediction = useMemo(() => {
    const contracted = team.squad.map(id => players[id]).filter((p): p is Player => Boolean(p) && p.currentTeamId === team.id);
    const squad = contracted.length ? contracted : Object.values(players).filter(p => p.currentTeamId === team.id);
    const available = squad.filter(p => !injuries[p.id]);
    const plan = buildAiMatchLineups(available).battingFirst;
    const ids = plan.startingXI;
    return { lineup: Array.from(new Set(ids)).map(id => players[id]).filter(Boolean), bowling: projectedOppositionBowlers(plan, players), excluded: squad.length - available.length };
  }, [team, players, injuries]);

  return <div className="grid min-h-0 w-full flex-1 grid-cols-1 grid-rows-[auto_minmax(150px,1fr)] gap-2 xl:grid-cols-[720px_minmax(0,1fr)]"><section aria-label={`${team.name} predicted batting eleven`} className="flex w-full max-w-[720px] shrink-0 flex-col rounded-lg border border-border bg-surface">
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-0.5">
      <h3 className="font-anton text-xs uppercase leading-tight">{team.shortName} · Predicted batting XI</h3>
      <span className="font-space-mono text-[9px] text-text-secondary">{prediction.lineup.length} available picks{prediction.excluded > 0 ? ` · ${prediction.excluded} injured excluded` : ""}</span>
    </header>
    <div className="flex flex-col overflow-x-auto">
      <div className={`${rowGrid} min-w-[680px] shrink-0 border-b border-border px-2 py-0.5 font-space-mono text-[9px] uppercase text-text-secondary`}>
        <span>Batting order</span><span>Details</span><span className="-my-0.5 border-l border-dashed border-border/60 py-0.5 pl-2 text-emerald-500">Strengths</span><span className="-my-0.5 border-l border-dashed border-border/60 py-0.5 pl-2 text-red-500">Weaknesses</span><span className="-my-0.5 border-l border-dashed border-border/60 py-0.5 pl-2">Approach</span><span className="pl-1">Target bowler</span>
      </div>
      {prediction.lineup.map((player, index) => {
        const { strengths, weaknesses } = battingTraits(player);
        return <div key={player.id} className={`${rowGrid} h-8 min-h-8 min-w-[680px] shrink-0 items-center border-b border-border/40 px-2 last:border-b-0`}>
          <div className="flex min-w-0 items-center gap-1.5 pr-2">
            <span className="w-4 shrink-0 font-space-mono text-[10px] text-accent">{index + 1}</span>
            <div className="flex min-w-0 flex-1 items-center gap-1.5"><button type="button" onClick={() => onOpenPlayer(player.id)} className="rounded-sm text-left font-barlow text-xs font-semibold leading-tight hover:text-accent hover:underline focus-visible:outline focus-visible:outline-accent">{player.name}</button><span className="shrink-0 font-space-mono text-[9px] text-text-secondary">{roleLabel[player.role] ?? player.role}{player.nationality === "Overseas" ? " · OS" : ""}</span></div>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap text-[10px] leading-tight text-text-secondary"><span>{player.battingStyle === "Left-hand" ? "LHB" : player.battingStyle === "Right-hand" ? "RHB" : "—"}</span><span>BAT <strong className="text-text-primary">{player.currentBatting}</strong></span></div>
          {[strengths, weaknesses].map((values, i) => <div key={i} className="flex flex-col justify-center self-stretch whitespace-nowrap border-l border-dashed border-border/60 py-0.5 pl-2 pr-1 text-[10px] leading-tight">
            {values.map(description => <div key={description}>{description}</div>)}
            {!values.length && <span className="text-text-secondary">—</span>}
          </div>)}
          <div className="flex h-full items-center border-l border-dashed border-border/60 pl-2" role="group" aria-label={`Approach against ${player.name}`}>
            <div className="inline-flex overflow-hidden rounded-sm border border-border">
              {(["defensive", "neutral", "attacking"] as const).map(approach => <button key={approach} type="button" aria-label={approach} title={approach.charAt(0).toUpperCase() + approach.slice(1)} aria-pressed={(approaches[player.id] ?? "neutral") === approach} onClick={() => onApproachChange(player.id, approach)} className={`shrink-0 border-r border-border px-1 py-0.5 font-space-mono text-[9px] font-bold leading-none last:border-r-0 focus-visible:outline focus-visible:outline-accent ${(approaches[player.id] ?? "neutral") === approach ? "bg-accent text-black" : "text-text-secondary hover:bg-accent/10 hover:text-text-primary"}`}>{{ defensive: "DEF", neutral: "NEU", attacking: "ATT" }[approach]}</button>)}
            </div>
          </div>
          <div className="min-w-0 pl-1"><TargetBowlerSelect batter={player} position={index + 1} bowlers={bowlers.filter(bowler => !injuries[bowler.id])} value={targetBowlers[player.id]} onChange={bowlerId => onTargetBowlerChange(player.id, bowlerId)} /></div>
        </div>;
      })}
      {!prediction.lineup.length && <p className="p-3 text-xs text-text-secondary">No fit players available.</p>}
    </div>
  </section><OppositionBattingFacts lineup={prediction.lineup} bowlers={bowlers.filter(bowler => !injuries[bowler.id])} excluded={prediction.excluded} /><OppositionBowlersPreview instructions={instructions} onInstructionChange={onInstructionChange} team={team} bowlers={prediction.bowling} fixtures={fixtures} battingXI={battingXI} /><OpponentPlanChangesPanel teamName={team.shortName} batters={battingXI} bowlers={bowlers.filter(p => !injuries[p.id])} plan={defaultPlan} changes={planChanges} onChange={onPlanChanges} /></div>;
}
