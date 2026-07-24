"use client";

import { useMemo, useState, type DragEvent } from "react";
import {
  Check,
  Copy,
  GripVertical,
  ShieldCheck,
  Sparkles,
  Swords,
  UserRoundCog,
  X,
} from "lucide-react";

import {
  buildRecommendedImpactSubs,
  buildRecommendedLineups,
  dropPlayerIntoImpactSubs,
  dropPlayerIntoLineup,
  getLineupDropPosition,
  type LineupCandidate,
  type LineupDropPlacement,
  type LineupPlan,
  validateLineup,
} from "@/lib/logic/lineupPlanner";
import {
  TACTICAL_ROLE_DEFINITIONS,
  autoAssignTacticalRolesForPlan,
  isPlayerEligibleForTacticalRole,
  setPlayerTacticalRole,
  type TacticalDiscipline,
  type TacticalRole,
  type TeamTactics,
} from "@/lib/logic/teamTactics";
import type { Player, Team } from "@/lib/types";

interface TacticsLineupBuilderProps {
  team: Team;
  players: Record<string, Player>;
  battingFirstXI: string[];
  bowlingFirstXI: string[];
  battingFirstImpactSubs: string[];
  bowlingFirstImpactSubs: string[];
  tactics: TeamTactics;
  onChangePlan: (plan: LineupPlan, lineup: string[], impactSubs: string[]) => void;
  onChangeBothPlans: (
    battingFirstXI: string[],
    bowlingFirstXI: string[],
    battingFirstImpactSubs: string[],
    bowlingFirstImpactSubs: string[],
  ) => void;
  onChangeTactics: (tactics: TeamTactics) => void;
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

const keeperLabel = (player: Player) => {
  if (player.isPartTimeWk) return "PT WK";
  if (player.role === "WK-Batsman" || player.isWicketkeeper) return "WK";
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

const toCandidate = (player: Player): LineupCandidate => ({
  id: player.id,
  nationality: player.nationality,
  role: player.role,
  batting: player.currentBatting,
  bowling: player.currentBowling,
  isWicketkeeper: player.role === "WK-Batsman" || Boolean(player.isWicketkeeper) || Boolean(player.isPartTimeWk),
  isPartTimeWicketkeeper: Boolean(player.isPartTimeWk),
  isOpener: player.isOpener,
});

export default function TacticsLineupBuilder({
  team,
  players,
  battingFirstXI,
  bowlingFirstXI,
  battingFirstImpactSubs,
  bowlingFirstImpactSubs,
  tactics,
  onChangePlan,
  onChangeBothPlans,
  onChangeTactics,
  onOpenPlayer,
}: TacticsLineupBuilderProps) {
  const [activePlan, setActivePlan] = useState<LineupPlan>("battingFirst");
  const [draggedPlayer, setDraggedPlayer] = useState<DraggedPlayer | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const squad = useMemo(
    () => team.squad.map((id) => players[id]).filter((player): player is Player => Boolean(player)),
    [players, team.squad],
  );
  const candidates = useMemo(() => squad.map(toCandidate), [squad]);
  const playerById = useMemo(() => new Map(squad.map((player) => [player.id, player])), [squad]);
  const activeXI = activePlan === "battingFirst" ? battingFirstXI : bowlingFirstXI;
  const otherXI = activePlan === "battingFirst" ? bowlingFirstXI : battingFirstXI;
  const activeImpactSubs = activePlan === "battingFirst" ? battingFirstImpactSubs : bowlingFirstImpactSubs;
  const otherImpactSubs = activePlan === "battingFirst" ? bowlingFirstImpactSubs : battingFirstImpactSubs;
  const activeValidation = validateLineup(activeXI, candidates);
  const battingValidation = validateLineup(battingFirstXI, candidates);
  const bowlingValidation = validateLineup(bowlingFirstXI, candidates);
  const activePlayers = activeXI.map((id) => playerById.get(id)).filter((player): player is Player => Boolean(player));
  const activeImpactPlayers = activeImpactSubs.map((id) => playerById.get(id)).filter((player): player is Player => Boolean(player));
  const activeRoles = tactics.roles[activePlan];
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
  const autoAssignRoles = () => onChangeTactics(autoAssignTacticalRolesForPlan(tactics, activePlan, activePlayers));
  const autoBuild = () => {
    const recommended = buildRecommendedLineups(candidates);
    const battingImpact = buildRecommendedImpactSubs(recommended.battingFirstXI, candidates, "battingFirst");
    const bowlingImpact = buildRecommendedImpactSubs(recommended.bowlingFirstXI, candidates, "bowlingFirst");
    onChangeBothPlans(recommended.battingFirstXI, recommended.bowlingFirstXI, battingImpact, bowlingImpact);
  };

  const fullTimeKeepers = activePlayers.filter((player) => !player.isPartTimeWk && (player.role === "WK-Batsman" || player.isWicketkeeper));
  const partTimeKeepers = activePlayers.filter((player) => player.isPartTimeWk);

  const renderRoleSelect = (player: Player, battingPosition: number, discipline: TacticalDiscipline) => {
    const definitions = TACTICAL_ROLE_DEFINITIONS.filter((definition) => definition.discipline === discipline);
    const selectedRole = definitions.find((definition) => activeRoles[definition.id] === player.id);
    const eligibleDefinitions = definitions.filter((definition) => isPlayerEligibleForTacticalRole(player, definition.id, battingPosition));
    const visibleDefinitions = selectedRole && !eligibleDefinitions.some((definition) => definition.id === selectedRole.id)
      ? [selectedRole, ...eligibleDefinitions]
      : eligibleDefinitions;
    const eligibilitySummary = eligibleDefinitions.length > 0
      ? eligibleDefinitions.map((definition) => `${definition.label}: ${definition.rule}`).join("\n")
      : `This player does not currently meet a ${discipline} specialist-role rule.`;

    return (
      <select
        value={selectedRole?.id ?? ""}
        onChange={(event) => onChangeTactics(setPlayerTacticalRole(
          tactics,
          activePlan,
          player.id,
          discipline,
          (event.target.value || null) as TacticalRole | null,
        ))}
        onMouseDown={(event) => event.stopPropagation()}
        draggable={false}
        disabled={visibleDefinitions.length === 0}
        title={eligibilitySummary}
        aria-label={`${discipline === "batting" ? "Batting" : "Bowling"} role for ${player.name}`}
        className="h-6 w-full min-w-0 border border-border bg-surface px-1 font-space-mono text-[9px] font-bold uppercase text-text-primary outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-45"
      >
        <option value="">{discipline === "batting" ? "BAT" : "BOWL"} role: none</option>
        {visibleDefinitions.map((definition) => (
          <option key={definition.id} value={definition.id}>
            {discipline === "batting" ? "BAT" : "BOWL"} - {definition.shortLabel}{definition === selectedRole && !eligibleDefinitions.includes(definition) ? " (rule!)" : ""}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div className="flex h-[calc(100vh-160px)] min-h-0 flex-col overflow-hidden border-2 border-border bg-surface">
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
          <button type="button" onClick={autoAssignRoles} className="flex items-center gap-2 border border-border bg-surface px-3 py-2 font-space-mono text-[12px] font-bold uppercase text-text-primary transition-colors hover:border-accent">
            <UserRoundCog size={16} className="text-accent" /> Auto roles
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
            <p className="mt-2 font-space-mono text-[11px] font-bold uppercase tracking-wide text-text-secondary">Drag a player into an XI or impact slot</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {sortedSquad.map((player) => {
              const inXI = activeXI.includes(player.id);
              const isImpact = activeImpactSubs.includes(player.id);
              const keeper = keeperLabel(player);
              return (
                <div
                  key={player.id}
                  draggable
                  onDragStart={(event) => beginPlayerDrag(event, player.id, "pool")}
                  onDragEnd={finishPlayerDrag}
                  className={`mb-1 grid min-h-14 cursor-grab grid-cols-[1.5rem_minmax(0,1fr)_3rem_3rem_4.75rem] items-center gap-1.5 border px-2.5 py-2 active:cursor-grabbing ${
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
                    <span className="flex items-center gap-1.5"><span className="truncate text-[14px] font-bold text-text-primary hover:underline">{player.name}</span>{player.nationality === "Overseas" && <OverseasMarker />}{keeper && <span className={`px-1.5 py-0.5 font-space-mono text-[10px] font-bold ${keeper === "PT WK" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-success/15 text-success"}`}>{keeper}</span>}</span>
                    <span className="mt-0.5 block font-space-mono text-[12px] font-bold uppercase text-text-secondary">{roleLabel(player.role)}</span>
                  </button>
                  <span className="text-center font-space-mono text-[13px] font-bold text-text-primary" title="Batting rating">{player.currentBatting}</span>
                  <span className="text-center font-space-mono text-[13px] font-bold text-text-primary" title="Bowling rating">{player.currentBowling}</span>
                  <span className={`text-center font-space-mono text-[11px] font-bold uppercase tracking-wide ${inXI ? "text-success" : isImpact ? "text-accent" : "text-text-secondary/70"}`}>
                    {inXI ? `XI #${activeXI.indexOf(player.id) + 1}` : isImpact ? `Impact #${activeImpactSubs.indexOf(player.id) + 1}` : "Available"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="min-h-0 overflow-hidden border-r border-border bg-black/[0.015] dark:bg-white/[0.015]">
          <div className="grid h-full min-h-0 grid-rows-[repeat(11,minmax(0,1fr))] gap-1 p-2">
            {Array.from({ length: 11 }, (_, index) => {
              const player = activePlayers[index];
              const keeper = player ? keeperLabel(player) : null;
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
                  className={`relative grid min-h-0 cursor-grab grid-cols-[1.5rem_2.25rem_minmax(8rem,1fr)_minmax(8.5rem,0.9fr)] items-center gap-2 overflow-hidden border bg-surface px-2.5 shadow-sm transition-[border-color,background-color,opacity,box-shadow] active:cursor-grabbing ${
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
                  <GripVertical size={17} className="text-text-secondary/55" />
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] font-anton text-[16px] text-text-primary dark:bg-white/[0.06]">{index + 1}</span>
                  <button type="button" onClick={() => onOpenPlayer(player.id)} className="min-w-0 text-left">
                    <span className="flex items-center gap-1.5"><span className="truncate text-[14px] font-bold text-text-primary hover:underline">{player.name}</span>{player.nationality === "Overseas" && <OverseasMarker />}{keeper && <span className={`px-1.5 py-0.5 font-space-mono text-[10px] font-bold ${keeper === "PT WK" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-success/15 text-success"}`}>{keeper}</span>}</span>
                    <span className="mt-0.5 block truncate font-space-mono text-[10px] font-bold uppercase text-text-secondary">{roleLabel(player.role)}{player.isOpener ? " · Opener" : ""} · BAT {player.currentBatting} · BOWL {player.currentBowling}</span>
                  </button>
                  <span className="grid min-w-0 grid-rows-2 gap-1">
                    {renderRoleSelect(player, index, "batting")}
                    {renderRoleSelect(player, index, "bowling")}
                  </span>
                </div>
              ) : (
                <div
                  key={`empty-${index}`}
                  onDragOver={(event) => previewPlayerDrop(event, index, false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    completePlayerDrop(index, "before");
                  }}
                  className={`relative flex min-h-0 items-center gap-3 overflow-hidden border border-dashed px-3 text-text-secondary ${preview ? "border-accent bg-accent/[0.07]" : "border-border/50"}`}
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
                  <GripVertical size={16} className="opacity-20" /><span className="font-anton text-[16px]">{index + 1}</span><span className="font-space-mono text-[12px] font-bold uppercase tracking-wide">Empty batting-order slot</span>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto p-3">
          <div className="border border-border bg-surface p-3 shadow-sm">
            <div className="flex items-end justify-between"><div><p className="font-space-mono text-[12px] font-bold uppercase tracking-[0.14em] text-text-secondary">Named reserves</p><h4 className="mt-1 font-anton text-[19px] uppercase text-text-primary">Impact substitutes</h4></div><span className="font-space-mono text-[12px] font-bold text-text-secondary">{activeImpactSubs.length}/5</span></div>
            <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">Drag players here from the squad, or drag these tabs onto each other to swap their order.</p>
            <div className="mt-3 space-y-1.5">
              {Array.from({ length: 5 }, (_, index) => {
                const player = activeImpactPlayers[index];
                const keeper = player ? keeperLabel(player) : null;
                const preview = dragPreview?.zone === "impact" && dragPreview.targetIndex === index;
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
                    className={`relative flex min-h-14 cursor-grab items-center gap-2 overflow-hidden border bg-accent/[0.04] px-2.5 shadow-sm active:cursor-grabbing ${
                      preview
                        ? "border-accent bg-accent/[0.1] ring-2 ring-inset ring-accent"
                        : draggedPlayer?.id === player.id && draggedPlayer.source === "impact"
                          ? "border-accent opacity-40"
                          : "border-accent/30"
                    }`}
                  >
                    {preview && (
                      <span className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 bg-accent px-2 py-1 font-space-mono text-[11px] font-bold uppercase tracking-wide text-[#16130f] shadow-md">
                        Swap with impact #{index + 1}
                      </span>
                    )}
                    <GripVertical size={16} className="text-text-secondary/55" />
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent font-anton text-[13px] text-[#16130f]">{index + 1}</span>
                    <button type="button" onClick={() => onOpenPlayer(player.id)} className="min-w-0 flex-1 text-left"><span className="flex items-center gap-1.5"><span className="truncate text-[14px] font-bold text-text-primary hover:underline">{player.name}</span>{player.nationality === "Overseas" && <OverseasMarker />}</span><span className="font-space-mono text-[11px] font-bold uppercase text-text-secondary">{roleLabel(player.role)}{keeper ? ` · ${keeper}` : ""}</span></button>
                  </div>
                ) : (
                  <div
                    key={`impact-empty-${index}`}
                    onDragOver={(event) => previewImpactDrop(event, index)}
                    onDrop={(event) => {
                      event.preventDefault();
                      completeImpactDrop(index);
                    }}
                    className={`relative flex min-h-14 items-center gap-2 overflow-hidden border border-dashed px-2.5 text-text-secondary ${preview ? "border-accent bg-accent/[0.08]" : "border-border/50"}`}
                  >
                    {preview && (
                      <span className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 bg-accent px-2 py-1 font-space-mono text-[11px] font-bold uppercase tracking-wide text-[#16130f] shadow-md">
                        Drop into impact #{index + 1}
                      </span>
                    )}
                    <GripVertical size={16} className="opacity-20" /><span className="font-anton text-[13px]">{index + 1}</span><span className="font-space-mono text-[11px] font-bold uppercase">Empty impact slot</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 border border-border bg-surface p-3 shadow-sm">
            <p className="font-space-mono text-[12px] font-bold uppercase tracking-[0.14em] text-text-secondary">Plan checks</p>
            <div className="mt-3 space-y-3 text-[13px] font-medium">
              {[
                [activeValidation.playerCount === 11, `Exactly 11 players (${activeValidation.playerCount}/11)`],
                [activeImpactSubs.length === 5, `Five impact substitutes (${activeImpactSubs.length}/5)`],
                [activeValidation.overseasCount <= 4, `Overseas limit (${activeValidation.overseasCount}/4)`],
                [activeValidation.wicketkeeperCount >= 1, fullTimeKeepers.length > 0 ? `Wicketkeeper (${fullTimeKeepers.length})` : partTimeKeepers.length > 0 ? `Part-time wicketkeeper (${partTimeKeepers.length})` : "Wicketkeeper (0)"],
                [activeValidation.bowlingOptionCount >= 5, `Bowling options (${activeValidation.bowlingOptionCount}/5)`],
              ].map(([valid, label]) => (
                <div key={String(label)} className="flex items-center gap-2.5"><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${valid ? "bg-success/[0.12] text-success" : "bg-danger/[0.12] text-danger"}`}>{valid ? <Check size={14} /> : <X size={14} />}</span><span className={valid ? "text-text-secondary" : "text-danger"}>{label}</span></div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
