"use client";

import { useMemo, useState, type DragEvent } from "react";
import {
  Check,
  Copy,
  GripVertical,
  ShieldCheck,
  Sparkles,
  Swords,
  X,
} from "lucide-react";

import {
  dropPlayerIntoImpactSubs,
  dropPlayerIntoLineup,
  getLineupDropPosition,
  type LineupDropPlacement,
  type LineupPlan,
  validateLineup,
} from "@/lib/logic/lineupPlanner";
import {
  findOptimalImpactBattingPosition,
  selectBattingFirstOutgoingBatter,
} from "@/lib/logic/aiLineupSelector";
import {
  buildAutomaticLineupSelection,
  playerToLineupCandidate,
} from "@/lib/logic/automaticLineupBuilder";
import type { Player, Team } from "@/lib/types";

interface TacticsLineupBuilderProps {
  team: Team;
  players: Record<string, Player>;
  battingFirstXI: string[];
  bowlingFirstXI: string[];
  battingFirstImpactSubs: string[];
  bowlingFirstImpactSubs: string[];
  battingFirstImpactPlayerId?: string | null;
  battingFirstOutgoingPlayerId?: string | null;
  battingFirstImpactBattingPosition?: number | null;
  bowlingFirstImpactPlayerId?: string | null;
  bowlingFirstOutgoingPlayerId?: string | null;
  bowlingFirstImpactBattingPosition?: number | null;
  captainId?: string | null;
  viceCaptainId?: string | null;
  onChangePlan: (plan: LineupPlan, lineup: string[], impactSubs: string[]) => void;
  onChangeBothPlans: (
    battingFirstXI: string[],
    bowlingFirstXI: string[],
    battingFirstImpactSubs: string[],
    bowlingFirstImpactSubs: string[],
  ) => void;
  onChangeImpactStrategy?: (
    plan: LineupPlan,
    impactPlayerId: string | null,
    outgoingPlayerId: string | null,
    entryPosition: number | null,
  ) => void;
  onOpenPlayer: (playerId: string) => void;
}

type DragSource = "pool" | "lineup" | "impact";

interface DraggedPlayer {
  id: string;
  source: DragSource;
}

interface DragPreview {
  zone: "lineup" | "impact";
  targetIndex: number;
  placement: LineupDropPlacement;
}

const roleLabel = (role: Player["role"]) => ({
  "Batsman": "BAT",
  "WK-Batsman": "WK",
  "All-Rounder": "AR",
  "Pace Bowler": "PACE",
  "Spin Bowler": "SPIN",
}[role]);

const playerRating = (player: Player) => Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);

const keeperLabel = (player: Player, startingXI: readonly Player[] = []) => {
  const isFullTime = (player.role === "WK-Batsman" || player.isWicketkeeper) && !player.isPartTimeWk;
  if (isFullTime) return "WK";
  if (player.isPartTimeWk) {
    const hasFullTimeKeeper = startingXI.some(
      (p) => (p.role === "WK-Batsman" || p.isWicketkeeper) && !p.isPartTimeWk
    );
    if (!hasFullTimeKeeper) return "WK";
    return "PT WK";
  }
  return null;
};

const OverseasMarker = () => (
  <span
    aria-label="Overseas player"
    title="Overseas player"
    className="shrink-0 rounded-[2px] bg-[#1d55c4] px-1.5 py-0.5 font-space-mono text-[10px] font-bold leading-none text-white"
  >
    OS
  </span>
);

export default function TacticsLineupBuilder({
  team,
  players,
  battingFirstXI,
  bowlingFirstXI,
  battingFirstImpactSubs,
  bowlingFirstImpactSubs,
  battingFirstImpactPlayerId,
  battingFirstOutgoingPlayerId,
  battingFirstImpactBattingPosition,
  bowlingFirstImpactPlayerId,
  bowlingFirstOutgoingPlayerId,
  bowlingFirstImpactBattingPosition,
  captainId,
  viceCaptainId,
  onChangePlan,
  onChangeBothPlans,
  onChangeImpactStrategy,
  onOpenPlayer,
}: TacticsLineupBuilderProps) {
  const [activePlan, setActivePlan] = useState<LineupPlan>("battingFirst");
  const [draggedPlayer, setDraggedPlayer] = useState<DraggedPlayer | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [autoOutgoingByPlan, setAutoOutgoingByPlan] = useState<Record<LineupPlan, boolean>>({
    battingFirst: battingFirstOutgoingPlayerId == null,
    bowlingFirst: bowlingFirstOutgoingPlayerId == null,
  });

  const currentImpactPlayerId = activePlan === "battingFirst"
    ? battingFirstImpactPlayerId
    : bowlingFirstImpactPlayerId;
  const currentOutgoingPlayerId = activePlan === "battingFirst"
    ? battingFirstOutgoingPlayerId
    : bowlingFirstOutgoingPlayerId;
  const currentImpactPosition = activePlan === "battingFirst"
    ? battingFirstImpactBattingPosition
    : bowlingFirstImpactBattingPosition;
  const squad = useMemo(
    () => team.squad.map((id) => players[id]).filter((player): player is Player => Boolean(player)),
    [players, team.squad],
  );
  const candidates = useMemo(() => squad.map(playerToLineupCandidate), [squad]);
  const playerById = useMemo(() => new Map(squad.map((player) => [player.id, player])), [squad]);
  const activeXI = activePlan === "battingFirst" ? battingFirstXI : bowlingFirstXI;
  const otherXI = activePlan === "battingFirst" ? bowlingFirstXI : battingFirstXI;
  const activeImpactSubs = activePlan === "battingFirst" ? battingFirstImpactSubs : bowlingFirstImpactSubs;
  const otherImpactSubs = activePlan === "battingFirst" ? bowlingFirstImpactSubs : battingFirstImpactSubs;
  const activeValidation = validateLineup(activeXI, candidates, activePlan);
  const battingValidation = validateLineup(battingFirstXI, candidates, "battingFirst");
  const bowlingValidation = validateLineup(bowlingFirstXI, candidates, "bowlingFirst");
  const activePlayers = activeXI.map((id) => playerById.get(id)).filter((player): player is Player => Boolean(player));
  const activeImpactPlayers = activeImpactSubs.map((id) => playerById.get(id)).filter((player): player is Player => Boolean(player));
  const autoBattingFirstOutgoingPlayer = useMemo(() => (
    selectBattingFirstOutgoingBatter(
      battingFirstXI.map((id) => playerById.get(id)).filter((player): player is Player => Boolean(player)),
      new Set([captainId, viceCaptainId].filter((id): id is string => Boolean(id))),
    )
  ), [battingFirstXI, captainId, playerById, viceCaptainId]);
  const autoImpactPosition = useMemo(() => {
    if (activePlan !== "bowlingFirst") return null;
    const startersOverseas = activePlayers.filter((p) => p.nationality === "Overseas").length;
    const legalImpactPlayers = activeImpactPlayers.filter((p) => p.nationality !== "Overseas" || startersOverseas < 4);
    const impactCandidate = currentImpactPlayerId ? playerById.get(currentImpactPlayerId) : null;
    const impactPlayer = (impactCandidate && (impactCandidate.nationality !== "Overseas" || startersOverseas < 4))
      ? impactCandidate
      : [...legalImpactPlayers].sort((left, right) => (
        (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
      ))[0];
    const outgoingPlayer = (currentOutgoingPlayerId && playerById.get(currentOutgoingPlayerId))
      ?? activePlayers[activePlayers.length - 1];
    if (!impactPlayer || !outgoingPlayer) return null;
    return findOptimalImpactBattingPosition(activePlayers, impactPlayer, outgoingPlayer, true);
  }, [activePlan, activeImpactPlayers, activePlayers, currentImpactPlayerId, currentOutgoingPlayerId, playerById]);
  const sortedSquad = [...squad]
    .sort((left, right) => Math.max(right.currentBatting, right.currentBowling) - Math.max(left.currentBatting, left.currentBowling));

  const setActivePlanState = (lineup: string[], impactSubs: string[]) => onChangePlan(activePlan, lineup, impactSubs);

  const beginPlayerDrag = (event: DragEvent<HTMLDivElement>, playerId: string, source: DragSource) => {
    setDraggedPlayer({ id: playerId, source });
    setDragPreview(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", playerId);
  };

  const finishPlayerDrag = () => {
    setDraggedPlayer(null);
    setDragPreview(null);
  };

  const previewPlayerDrop = (event: DragEvent<HTMLDivElement>, targetIndex: number, hasPlayer: boolean) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!draggedPlayer) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerRatio = bounds.height > 0 ? (event.clientY - bounds.top) / bounds.height : 0.5;
    let placement: LineupDropPlacement = !hasPlayer
      ? "before"
      : pointerRatio < 0.28
        ? "before"
        : pointerRatio > 0.72
          ? "after"
          : "swap";
    if (!activeXI.includes(draggedPlayer.id) && activeXI.length >= 11) placement = "swap";
    setDragPreview((current) => current?.zone === "lineup" && current.targetIndex === targetIndex && current.placement === placement
      ? current
      : { zone: "lineup", targetIndex, placement });
  };

  const completePlayerDrop = (targetIndex: number, placement: LineupDropPlacement) => {
    if (!draggedPlayer) return;
    const next = dropPlayerIntoLineup(activeXI, activeImpactSubs, draggedPlayer.id, targetIndex, placement);
    setActivePlanState(next.lineup, next.impactSubs);
    finishPlayerDrag();
  };

  const previewImpactDrop = (event: DragEvent<HTMLDivElement>, targetIndex: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!draggedPlayer) return;
    setDragPreview((current) => current?.zone === "impact" && current.targetIndex === targetIndex
      ? current
      : { zone: "impact", targetIndex, placement: "swap" });
  };

  const completeImpactDrop = (targetIndex: number) => {
    if (!draggedPlayer) return;
    const next = dropPlayerIntoImpactSubs(activeXI, activeImpactSubs, draggedPlayer.id, targetIndex);
    setActivePlanState(next.lineup, next.impactSubs);
    finishPlayerDrag();
  };

  const copyOtherPlan = () => setActivePlanState([...otherXI], [...otherImpactSubs]);
  const autoBuild = () => {
    const recommended = buildAutomaticLineupSelection(squad, {
      captainId,
      viceCaptainId,
      useProvisionalCaptain: !captainId,
    });
    onChangeBothPlans(
      recommended.battingFirstXI,
      recommended.bowlingFirstXI,
      recommended.battingFirstImpactSubs,
      recommended.bowlingFirstImpactSubs,
    );
  };

  const fullTimeKeepers = activePlayers.filter((player) => !player.isPartTimeWk && (player.role === "WK-Batsman" || player.isWicketkeeper));
  const partTimeKeepers = activePlayers.filter((player) => player.isPartTimeWk);

  const handleQuickSubIntoXI = (player: Player) => {
    if (activeXI.includes(player.id)) return;
    const targetPos = activeXI.length < 11 ? activeXI.length : 10;
    const next = dropPlayerIntoLineup(activeXI, activeImpactSubs, player.id, targetPos, "swap");
    setActivePlanState(next.lineup, next.impactSubs);
  };

  return (
    <div className="flex h-full flex-1 min-h-0 flex-col overflow-hidden border-2 border-border bg-surface">
      <div className="flex shrink-0 items-center justify-between border-b-2 border-border bg-[linear-gradient(110deg,rgba(var(--team-primary-rgb),0.12),transparent_48%)] px-5 py-3">
        <div>
          <p className="font-space-mono text-[12px] font-bold uppercase tracking-[0.18em] text-text-secondary">Matchday selection</p>
          <h3 className="mt-1 font-anton text-[26px] uppercase leading-none text-text-primary">Playing XI Builder</h3>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={autoBuild} className="flex items-center gap-2 border border-border bg-surface px-3 py-2 font-space-mono text-[12px] font-bold uppercase text-text-primary transition-colors hover:border-accent">
            <Sparkles size={16} className="text-accent" /> Auto-build both
          </button>
          <button type="button" onClick={copyOtherPlan} className="flex items-center gap-2 border border-border bg-surface px-3 py-2 font-space-mono text-[12px] font-bold uppercase text-text-primary transition-colors hover:border-accent">
            <Copy size={16} /> Copy other plan
          </button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 border-b border-border bg-black/[0.025] dark:bg-white/[0.025]">
        {(["battingFirst", "bowlingFirst"] as const).map((plan) => {
          const isActive = activePlan === plan;
          const validation = plan === "battingFirst" ? battingValidation : bowlingValidation;
          const impactCount = plan === "battingFirst" ? battingFirstImpactSubs.length : bowlingFirstImpactSubs.length;
          return (
            <button key={plan} type="button" onClick={() => setActivePlan(plan)} className={`relative flex items-center justify-center gap-3 px-5 py-3 text-left transition-colors ${isActive ? "bg-surface text-text-primary" : "text-text-secondary hover:bg-black/[0.025] dark:hover:bg-white/[0.025]"}`}>
              <span className={`flex h-10 w-10 items-center justify-center rounded-full ${isActive ? "bg-accent text-[#16130f]" : "border border-border"}`}>
                {plan === "battingFirst" ? <Swords size={18} /> : <ShieldCheck size={18} />}
              </span>
              <span>
                <span className="block font-anton text-[19px] uppercase leading-none">{plan === "battingFirst" ? "Bat first plan" : "Bowl first plan"}</span>
                <span className="mt-1 block font-space-mono text-[12px] font-bold uppercase tracking-wide">XI {validation.playerCount}/11 · Impact {impactCount}/5</span>
              </span>
              {isActive && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(20rem,0.9fr)_minmax(28rem,1.3fr)_minmax(18rem,0.8fr)]">
        <section className="flex min-h-0 flex-col border-r border-border">
          <div className="shrink-0 border-b border-border p-3">
            <div className="flex items-center justify-between">
              <div><p className="font-space-mono text-[12px] font-bold uppercase tracking-[0.14em] text-text-secondary">Available squad</p><h4 className="mt-1 font-anton text-[20px] uppercase text-text-primary">Player pool</h4></div>
              <span className="font-space-mono text-[12px] font-bold text-text-secondary">{squad.length} players</span>
            </div>
            <p className="mt-2 font-space-mono text-[11px] font-bold uppercase tracking-wide text-text-secondary">Drag a player into an XI or impact slot, or click + XI</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {sortedSquad.map((player) => {
              const inXI = activeXI.includes(player.id);
              const isImpact = activeImpactSubs.includes(player.id);
              const keeper = keeperLabel(player, activePlayers);
              return (
                <div
                  key={player.id}
                  draggable
                  onDragStart={(event) => beginPlayerDrag(event, player.id, "pool")}
                  onDragEnd={finishPlayerDrag}
                  className={`mb-1 grid min-h-14 cursor-grab grid-cols-[1.5rem_minmax(0,1fr)_3rem_3rem_5.5rem] items-center gap-1.5 border px-2.5 py-2 active:cursor-grabbing ${
                    draggedPlayer?.id === player.id && draggedPlayer.source === "pool"
                      ? "border-accent opacity-40"
                      : inXI
                        ? "border-success/45 bg-success/[0.06]"
                        : isImpact
                          ? "border-accent/50 bg-accent/[0.05]"
                          : "border-transparent hover:border-border"
                  }`}
                >
                  <GripVertical size={16} className="text-text-secondary/55" />
                  <button type="button" onClick={() => onOpenPlayer(player.id)} className="min-w-0 text-left">
                    <span className="flex min-h-4 items-center gap-1.5 leading-none"><span className="truncate text-[14px] font-bold leading-none text-text-primary hover:underline">{player.name}</span>{player.nationality === "Overseas" && <OverseasMarker />}{keeper && <span className={`inline-flex items-center px-1.5 py-0.5 font-space-mono text-[10px] font-bold leading-none ${keeper === "PT WK" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-success/15 text-success"}`}>{keeper}</span>}</span>
                    <span className="mt-0.5 block font-space-mono text-[12px] font-bold uppercase text-text-secondary">{roleLabel(player.role)}</span>
                  </button>
                  <span className="text-center font-space-mono text-[13px] font-bold text-text-primary" title="Batting rating">{player.currentBatting}</span>
                  <span className="text-center font-space-mono text-[13px] font-bold text-text-primary" title="Bowling rating">{player.currentBowling}</span>
                  <div className="flex flex-col items-center justify-center gap-1 min-w-0">
                    <span className={`text-center font-space-mono text-[10px] font-bold uppercase tracking-wide ${inXI ? "text-success" : isImpact ? "text-accent" : "text-text-secondary/70"}`}>
                      {inXI ? `XI #${activeXI.indexOf(player.id) + 1}` : isImpact ? `Impact #${activeImpactSubs.indexOf(player.id) + 1}` : "Available"}
                    </span>
                    {!inXI && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickSubIntoXI(player);
                        }}
                        className="px-2 py-0.5 font-space-mono text-[9px] font-bold uppercase bg-accent text-[#16130f] rounded hover:bg-accent/80 transition-colors shadow-sm"
                        title={`Sub ${player.name} into Playing XI`}
                      >
                        + XI
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="min-h-0 overflow-hidden border-r border-border bg-black/[0.015] dark:bg-white/[0.015]">
          <div className="grid h-full min-h-0 grid-rows-[repeat(11,minmax(0,1fr))] gap-1 p-2">
            {Array.from({ length: 11 }, (_, index) => {
              const player = activePlayers[index];
              const keeper = player ? keeperLabel(player, activePlayers) : null;
              const preview = dragPreview?.zone === "lineup" && dragPreview.targetIndex === index ? dragPreview : null;
              const dropPosition = preview && draggedPlayer
                ? getLineupDropPosition(activeXI, draggedPlayer.id, index, preview.placement)
                : index + 1;
              return player ? (
                <div
                  key={player.id}
                  draggable
                  onDragStart={(event) => beginPlayerDrag(event, player.id, "lineup")}
                  onDragOver={(event) => previewPlayerDrop(event, index, true)}
                  onDrop={(event) => {
                    event.preventDefault();
                    const placement = dragPreview?.zone === "lineup" && dragPreview.targetIndex === index ? dragPreview.placement : "swap";
                    completePlayerDrop(index, placement);
                  }}
                  onDragEnd={finishPlayerDrag}
                  title="Drop in the centre to swap positions, or on the top/bottom edge to insert"
                  className={`relative grid min-h-0 cursor-grab grid-cols-[1.5rem_2.25rem_minmax(8rem,1fr)] items-center gap-2 overflow-hidden border bg-surface px-2.5 shadow-sm transition-[border-color,background-color,opacity,box-shadow] active:cursor-grabbing ${
                    preview?.placement === "swap"
                      ? "border-accent bg-accent/[0.09] ring-2 ring-inset ring-accent"
                      : draggedPlayer?.id === player.id && draggedPlayer.source === "lineup"
                        ? "border-accent opacity-40"
                        : "border-border"
                  }`}
                >
                  {preview?.placement === "swap" && (
                    <span className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 bg-accent px-2 py-1 font-space-mono text-[11px] font-bold uppercase tracking-wide text-[#16130f] shadow-md">
                      Swap with #{index + 1}
                    </span>
                  )}
                  {(preview?.placement === "before" || preview?.placement === "after") && (
                    <span className={`pointer-events-none absolute inset-x-0 z-20 flex items-center ${preview.placement === "before" ? "top-0" : "bottom-0"}`}>
                      <span className="h-1 flex-1 bg-accent" />
                      <span className="bg-accent px-2 py-0.5 font-space-mono text-[11px] font-bold uppercase tracking-wide text-[#16130f] shadow-md">
                        {draggedPlayer?.source === "lineup" ? "Move to" : "Insert at"} #{dropPosition}
                      </span>
                      <span className="h-1 flex-1 bg-accent" />
                    </span>
                  )}
                  <span className="flex h-full max-h-full w-6 shrink-0 items-center justify-center self-center overflow-hidden">
                    <GripVertical size={17} className="block text-text-secondary/55" />
                  </span>
                  <span className="flex h-[min(2rem,calc(100%_-_0.25rem))] aspect-square shrink-0 items-center justify-center self-center rounded-full bg-black/[0.05] font-anton text-[16px] leading-none text-text-primary dark:bg-white/[0.06]">
                    {index + 1}
                  </span>
                  <button type="button" onClick={() => onOpenPlayer(player.id)} className="flex h-full min-h-0 min-w-0 flex-col justify-center self-center overflow-hidden text-left">
                    <span className="flex min-h-4 items-center gap-1.5 leading-none"><span className="truncate text-[14px] font-bold leading-none text-text-primary hover:underline">{player.name}</span>{player.nationality === "Overseas" && <OverseasMarker />}{keeper && <span className={`inline-flex items-center px-1.5 py-0.5 font-space-mono text-[10px] font-bold leading-none ${keeper === "PT WK" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-success/15 text-success"}`}>{keeper}</span>}</span>
                    <span className="mt-1 block truncate font-space-mono text-[10px] font-bold uppercase leading-none text-text-secondary [@media(max-height:650px)]:hidden">{roleLabel(player.role)}{player.isOpener ? " · Opener" : ""} · BAT {player.currentBatting} · BOWL {player.currentBowling}</span>
                  </button>
                </div>
              ) : (
                <div
                  key={`empty-${index}`}
                  onDragOver={(event) => previewPlayerDrop(event, index, false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    completePlayerDrop(index, "before");
                  }}
                  className={`relative grid min-h-0 grid-cols-[1.5rem_2.25rem_minmax(0,1fr)] items-center gap-2 overflow-hidden border border-dashed px-2.5 text-text-secondary ${preview ? "border-accent bg-accent/[0.07]" : "border-border/50"}`}
                >
                  {preview && (
                    <span className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center">
                      <span className="h-1 flex-1 bg-accent" />
                      <span className="bg-accent px-2 py-0.5 font-space-mono text-[11px] font-bold uppercase tracking-wide text-[#16130f] shadow-md">
                        {draggedPlayer?.source === "lineup" ? "Move to" : "Insert at"} #{dropPosition}
                      </span>
                      <span className="h-1 flex-1 bg-accent" />
                    </span>
                  )}
                  <span className="flex h-full w-6 items-center justify-center"><GripVertical size={16} className="block opacity-20" /></span>
                  <span className="flex h-[min(2rem,calc(100%_-_0.25rem))] aspect-square items-center justify-center font-anton text-[16px] leading-none">{index + 1}</span>
                  <span className="flex items-center font-space-mono text-[12px] font-bold uppercase tracking-wide">Empty batting-order slot</span>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto_auto] gap-2 overflow-hidden p-2 [@media(max-height:850px)]:gap-1 [@media(max-height:850px)]:p-1">
          <div className="flex h-full min-h-0 flex-col overflow-hidden border border-border bg-surface p-2 shadow-sm [@media(max-height:850px)]:p-1">
            <div className="flex items-end justify-between"><div><p className="font-space-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary [@media(max-height:650px)]:hidden">Named reserves</p><h4 className="font-anton text-[17px] uppercase leading-none text-text-primary [@media(max-height:650px)]:text-[14px]">Impact substitutes</h4></div><span className="font-space-mono text-[11px] font-bold leading-none text-text-secondary">{activeImpactSubs.length}/5</span></div>
            <p className="mt-1 text-[11px] leading-tight text-text-secondary [@media(max-height:900px)]:hidden">Drag players here from the squad, or drag these tabs onto each other to swap their order.</p>
            <div className="mt-1.5 grid min-h-0 flex-1 grid-rows-5 gap-1 [@media(max-height:650px)]:mt-1 [@media(max-height:650px)]:gap-0.5">
              {Array.from({ length: 5 }, (_, index) => {
                const player = activeImpactPlayers[index];
                const keeper = player ? keeperLabel(player, activePlayers) : null;
                const preview = dragPreview?.zone === "impact" && dragPreview.targetIndex === index;
                const startersOverseas = activePlayers.filter((p) => p.nationality === "Overseas").length;
                const isPlayerIneligibleOS = Boolean(player && player.nationality === "Overseas" && startersOverseas >= 4);
                return player ? (
                  <div
                    key={player.id}
                    draggable
                    onDragStart={(event) => beginPlayerDrag(event, player.id, "impact")}
                    onDragOver={(event) => previewImpactDrop(event, index)}
                    onDrop={(event) => {
                      event.preventDefault();
                      completeImpactDrop(index);
                    }}
                    onDragEnd={finishPlayerDrag}
                    className={`relative flex h-full min-h-0 cursor-grab items-center gap-1.5 overflow-hidden border px-2 shadow-sm active:cursor-grabbing [@media(max-height:650px)]:px-1 ${
                      isPlayerIneligibleOS
                        ? "border-red-500/40 bg-red-500/[0.04]"
                        : preview
                          ? "border-accent bg-accent/[0.1] ring-2 ring-inset ring-accent"
                          : draggedPlayer?.id === player.id && draggedPlayer.source === "impact"
                            ? "border-accent opacity-40"
                            : "border-accent/30 bg-accent/[0.04]"
                    }`}
                  >
                    {preview && (
                      <span className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 bg-accent px-2 py-1 font-space-mono text-[11px] font-bold uppercase tracking-wide text-[#16130f] shadow-md">
                        Swap with impact #{index + 1}
                      </span>
                    )}
                    <GripVertical size={14} className="shrink-0 text-text-secondary/55 [@media(max-height:650px)]:hidden" />
                    <span className={`flex h-[min(1.5rem,calc(100%_-_0.125rem))] aspect-square shrink-0 items-center justify-center rounded-full font-anton text-[12px] leading-none [@media(max-height:650px)]:text-[10px] ${isPlayerIneligibleOS ? "bg-red-500 text-white" : "bg-accent text-[#16130f]"}`}>{index + 1}</span>
                    <button type="button" onClick={() => onOpenPlayer(player.id)} className="flex h-full min-h-0 min-w-0 flex-1 flex-col justify-center overflow-hidden text-left"><span className="flex items-center gap-1 text-[13px] font-bold leading-none text-text-primary"><span className="truncate hover:underline">{player.name}</span>{player.nationality === "Overseas" && <OverseasMarker />}</span><span className="mt-0.5 font-space-mono text-[9px] font-bold uppercase leading-none text-text-primary/75 [@media(max-height:800px)]:hidden">{roleLabel(player.role)}{keeper ? ` · ${keeper}` : ""}</span></button>
                    {isPlayerIneligibleOS && (
                      <span className="shrink-0 rounded border border-red-500/30 bg-red-500/15 px-1.5 py-0.5 font-space-mono text-[9px] font-bold text-red-600 dark:text-red-400" title="Starting XI already has 4 Overseas players; this player cannot be subbed in">
                        Ineligible (4 OS)
                      </span>
                    )}
                  </div>
                ) : (
                  <div
                    key={`impact-empty-${index}`}
                    onDragOver={(event) => previewImpactDrop(event, index)}
                    onDrop={(event) => {
                      event.preventDefault();
                      completeImpactDrop(index);
                    }}
                    className={`relative flex h-full min-h-0 items-center gap-1.5 overflow-hidden border border-dashed px-2 text-text-secondary [@media(max-height:650px)]:px-1 ${preview ? "border-accent bg-accent/[0.08]" : "border-border/50"}`}
                  >
                    {preview && (
                      <span className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 bg-accent px-2 py-1 font-space-mono text-[11px] font-bold uppercase tracking-wide text-[#16130f] shadow-md">
                        Drop into impact #{index + 1}
                      </span>
                    )}
                    <GripVertical size={14} className="opacity-20 [@media(max-height:650px)]:hidden" /><span className="font-anton text-[12px] leading-none">{index + 1}</span><span className="font-space-mono text-[10px] font-bold uppercase leading-none">Empty impact slot</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Impact Substitute Strategy Card */}
          <div className="shrink-0 border border-border bg-surface p-2 shadow-sm [@media(max-height:850px)]:p-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-space-mono text-[8px] font-bold uppercase leading-none tracking-[0.12em] text-accent [@media(max-height:650px)]:hidden">
                  Impact Strategy ({activePlan === "battingFirst" ? "Bat First Plan" : "Bowl First Plan"})
                </p>
                <h4 className="mt-0.5 font-anton text-[16px] uppercase leading-none text-text-primary [@media(max-height:650px)]:mt-0 [@media(max-height:650px)]:text-[13px]">
                  Expected Match Change
                </h4>
              </div>
            </div>
            <p className="mt-1 text-[10px] leading-tight text-text-primary/75 [@media(max-height:900px)]:hidden">
              Select the player coming in and player subbed out{activePlan === "bowlingFirst" ? ", then choose the entry position." : "."}
            </p>

            <div className="mt-1.5 space-y-1 [@media(max-height:650px)]:mt-1 [@media(max-height:650px)]:space-y-0.5">
              {/* 1. Player Coming In */}
              <div>
                <label className="block font-space-mono text-[8px] font-bold uppercase leading-none text-text-secondary [@media(max-height:650px)]:sr-only">
                  Player Coming In ({activePlan === "battingFirst" ? "Impact Bowler" : "Impact Batter"})
                </label>
                <select
                  value={currentImpactPlayerId ?? ""}
                  onChange={(e) => onChangeImpactStrategy?.(
                    activePlan,
                    e.target.value || null,
                    autoOutgoingByPlan[activePlan] ? null : currentOutgoingPlayerId ?? null,
                    activePlan === "bowlingFirst" ? currentImpactPosition ?? null : null,
                  )}
                  className="mt-0.5 h-7 w-full rounded border border-border/80 bg-background px-2 py-0 text-[10px] font-bold text-text-primary focus:border-accent focus:outline-none [@media(max-height:650px)]:mt-0 [@media(max-height:650px)]:h-5 [@media(max-height:650px)]:text-[9px]"
                  style={{ color: "var(--ink)", backgroundColor: "var(--surface2)", colorScheme: "light" }}
                  aria-label="Select player coming in"
                >
                  <option value="">Auto (Highest Rated Bench Option)</option>
                  {activeImpactPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({roleLabel(player.role)} · {playerRating(player)})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Player Going Out */}
              <div>
                <label className="block font-space-mono text-[8px] font-bold uppercase leading-none text-text-secondary [@media(max-height:650px)]:sr-only">
                  Player Going Out (Subbed Out)
                </label>
                <select
                  value={autoOutgoingByPlan[activePlan] ? "" : currentOutgoingPlayerId ?? ""}
                  onChange={(e) => {
                    const useAuto = e.target.value === "";
                    setAutoOutgoingByPlan((current) => ({ ...current, [activePlan]: useAuto }));
                    onChangeImpactStrategy?.(
                      activePlan,
                      currentImpactPlayerId ?? null,
                      useAuto ? null : e.target.value,
                      activePlan === "bowlingFirst" ? currentImpactPosition ?? null : null,
                    );
                  }}
                  className="mt-0.5 h-7 w-full rounded border border-border/80 bg-background px-2 py-0 text-[10px] font-bold text-text-primary focus:border-accent focus:outline-none [@media(max-height:650px)]:mt-0 [@media(max-height:650px)]:h-5 [@media(max-height:650px)]:text-[9px]"
                  style={{ color: "var(--ink)", backgroundColor: "var(--surface2)", colorScheme: "light" }}
                  aria-label="Select player going out"
                >
                  <option value="">Auto ({activePlan === "battingFirst" ? "Lowest Priority Player" : "Lowest Rated Batting Option"})</option>
                  {activePlayers.map((player, idx) => {
                    const isKeeperPlayer = (player.role === "WK-Batsman" || player.isWicketkeeper) && fullTimeKeepers.length <= 1;
                    return (
                      <option key={player.id} value={player.id} disabled={isKeeperPlayer}>
                        #{idx + 1} {player.name} ({roleLabel(player.role)} · {playerRating(player)}){isKeeperPlayer ? " (Keeper)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 3. Entry Position (only relevant when bowling first) */}
              {activePlan === "bowlingFirst" && <div>
                <label className="block font-space-mono text-[8px] font-bold uppercase leading-none text-text-secondary [@media(max-height:650px)]:sr-only">
                  Entry Batting / Bowling Position
                </label>
                <select
                  value={currentImpactPosition ?? ""}
                  onChange={(e) => onChangeImpactStrategy?.(
                    activePlan,
                    currentImpactPlayerId ?? null,
                    currentOutgoingPlayerId ?? null,
                    e.target.value === "" ? null : Number(e.target.value),
                  )}
                  className="mt-0.5 h-7 w-full rounded border border-border/80 bg-background px-2 py-0 text-[10px] font-bold text-text-primary focus:border-accent focus:outline-none [@media(max-height:650px)]:mt-0 [@media(max-height:650px)]:h-5 [@media(max-height:650px)]:text-[9px]"
                  style={{ color: "var(--ink)", backgroundColor: "var(--surface2)", colorScheme: "light" }}
                  aria-label="Select entry position"
                >
                  <option value="">
                    {autoImpactPosition ? `Auto choose best position (#${autoImpactPosition})` : "Auto choose best position"}
                  </option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((pos) => (
                    <option key={pos} value={pos}>
                      Position #{pos} {pos <= 2 ? "(Opener)" : pos <= 5 ? "(Core)" : pos <= 7 ? "(Finisher)" : "(Lower)"}
                    </option>
                  ))}
                </select>
              </div>}
            </div>

            {/* Projected Change Summary Banner */}
            {(() => {
              const inPl = (currentImpactPlayerId && playerById.get(currentImpactPlayerId))
                || [...activeImpactPlayers].sort((left, right) => (
                  activePlan === "bowlingFirst"
                    ? (right.currentBatting ?? 0) - (left.currentBatting ?? 0)
                    : (right.currentBowling ?? 0) - (left.currentBowling ?? 0)
                ))[0];
              const outPl = autoOutgoingByPlan[activePlan] && activePlan === "battingFirst"
                ? autoBattingFirstOutgoingPlayer
                : (currentOutgoingPlayerId && playerById.get(currentOutgoingPlayerId)) || activePlayers[activePlayers.length - 1];
              const pos = currentImpactPosition ?? autoImpactPosition ?? "auto";
              if (!inPl || !outPl) return null;
              return (
                <div className="mt-1 truncate border-t border-border/50 pt-1 font-space-mono text-[8px] uppercase leading-none text-text-primary/75 [@media(max-height:650px)]:mt-0.5 [@media(max-height:650px)]:pt-0.5 [@media(max-height:650px)]:text-[7px]">
                  Projected change: <span className="font-bold text-text-primary">{inPl.name}</span> in for <span className="font-bold text-text-primary">{outPl.name}</span>{activePlan === "bowlingFirst" ? <> at number <span className="font-bold text-accent">{pos}</span></> : null}
                </div>
              );
            })()}
          </div>

          <div className="shrink-0 border border-border bg-surface p-2 shadow-sm [@media(max-height:850px)]:p-1">
            <p className="font-space-mono text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-text-secondary [@media(max-height:650px)]:text-[8px]">Plan checks</p>
            <div className="mt-1 grid grid-cols-3 gap-x-1.5 gap-y-1 text-[9px] font-medium leading-none [@media(max-height:650px)]:mt-0.5 [@media(max-height:650px)]:gap-y-0.5 [@media(max-height:650px)]:text-[8px]">
              {[
                [activeValidation.playerCount === 11, `XI (${activeValidation.playerCount}/11)`],
                [activeImpactSubs.length === 5, `Impact (${activeImpactSubs.length}/5)`],
                [activeValidation.overseasCount <= 4, `Overseas (${activeValidation.overseasCount}/4)`],
                [activeValidation.wicketkeeperCount >= 1, fullTimeKeepers.length > 0 ? `Keeper (${fullTimeKeepers.length})` : partTimeKeepers.length > 0 ? `PT keeper (${partTimeKeepers.length})` : "Keeper (0)"],
                [activeValidation.bowlingOptionCount >= 5, `Bowling (${activeValidation.bowlingOptionCount}/5)`],
              ].map(([valid, label]) => (
                <div key={String(label)} className="flex min-w-0 items-center gap-1"><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full [@media(max-height:650px)]:h-3 [@media(max-height:650px)]:w-3 ${valid ? "bg-success/[0.12] text-success" : "bg-danger/[0.12] text-danger"}`}>{valid ? <Check size={10} /> : <X size={10} />}</span><span className={`truncate ${valid ? "text-text-secondary" : "text-danger"}`}>{label}</span></div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
