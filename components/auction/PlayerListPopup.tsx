"use client";
import { useState } from "react";
import { Target, X } from "lucide-react";
import { useGameStore } from "@/lib/store/gameStore";
import { AuctionTargetPriority, Player } from "@/lib/types";
import { MAX_AUCTION_TARGETS, canTeamAffordBid, canTeamBidOnPlayer } from "@/lib/logic/auctionRules";
import PlayerCard from "./PlayerCard";

type PopupType = "sold" | "unsold" | "left";

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

const CATEGORIES: Array<{ label: string; roles: string[]; marquee?: boolean }> = [
  { label: "Marquee Players", roles: ["Batsman", "WK-Batsman", "All-Rounder", "Pace Bowler", "Spin Bowler"], marquee: true },
  { label: "Wicketkeepers", roles: ["WK-Batsman"] },
  { label: "All-Rounders", roles: ["All-Rounder"] },
  { label: "Batsmen", roles: ["Batsman"] },
  { label: "Fast Bowlers", roles: ["Pace Bowler"] },
  { label: "Spinners", roles: ["Spin Bowler"] },
];

const TARGET_PRIORITIES: Array<{ value: AuctionTargetPriority; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function PlayerRow({
  player,
  type,
  soldPrice,
  buyerTeamName,
  buyerColor,
  targetMax,
  targetPriority,
  onSetTarget,
  onRemoveTarget,
}: {
  player: Player;
  type: PopupType;
  soldPrice?: number;
  buyerTeamName?: string;
  buyerColor?: string;
  targetMax?: number;
  targetPriority?: AuctionTargetPriority;
  onSetTarget?: (maxBidLakhs: number, priority: AuctionTargetPriority) => void;
  onRemoveTarget?: () => void;
}) {
  const players = useGameStore((state) => state.players);
  const userTeam = useGameStore((state) => state.teams[state.userTeamId]);
  const auctionTargets = useGameStore((state) => state.auctionTargets);
  const [isOpen, setIsOpen] = useState(false);
  const [showTargetEditor, setShowTargetEditor] = useState(false);
  const [maxBidCrore, setMaxBidCrore] = useState(
    ((targetMax ?? player.basePrice) / 100).toFixed(2)
  );
  const [priority, setPriority] = useState<AuctionTargetPriority>(targetPriority ?? "medium");
  const parsedMaxLakhs = Number(maxBidCrore) * 100;
  const invalidLimit = !Number.isFinite(parsedMaxLakhs) || parsedMaxLakhs < player.basePrice;
  const bidEligibility = userTeam
    ? canTeamBidOnPlayer(userTeam, player, players, false)
    : { canBid: false, reason: "No active team" };
  const canAffordOpeningBid = userTeam
    ? canTeamAffordBid(userTeam, player.basePrice, players)
    : false;
  const impossibleTargetReason = !bidEligibility.canBid
    ? bidEligibility.reason ?? "Squad rules prevent bidding for this player"
    : !canAffordOpeningBid
      ? "Insufficient purse or required squad reserve for the opening bid"
      : null;
  const targetLimitReached = targetMax === undefined && Object.keys(auctionTargets ?? {}).length >= MAX_AUCTION_TARGETS;
  const targetButtonLocked = impossibleTargetReason !== null;
  const targetButtonDisabled = targetButtonLocked || targetLimitReached;

  return (
    <div className="flex flex-col border-b border-border/10">
      <div
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center justify-between px-6 py-[9px] hover:bg-black/5 cursor-pointer transition-colors select-none"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">

          <div className="min-w-0">
            <div className="font-barlow font-semibold text-[13px] text-text-primary truncate leading-tight">
              {player.name}
            </div>
            <div className="flex items-center gap-1.5 mt-[1px]">
              {player.nationality === "Overseas" && (
                <span
                  className="font-space-mono text-[7px] px-1 rounded-[2px] font-bold"
                  style={{ backgroundColor: "var(--team-accent)", color: "var(--team-accent-text)" }}
                >
                  OS
                </span>
              )}
              <span className="font-space-mono text-[8px] text-muted">
                {player.isCapped ? "CAPPED" : "UNCAPPED"} · AGE {player.age}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          {type === "left" && (
            <button
              disabled={targetButtonDisabled}
              onClick={(e) => {
                e.stopPropagation();
                if (targetButtonDisabled) return;
                setMaxBidCrore(((targetMax ?? player.basePrice) / 100).toFixed(2));
                setPriority(targetPriority ?? "medium");
                setShowTargetEditor((value) => !value);
              }}
              className="flex items-center gap-1 rounded border px-2 py-1 font-space-mono text-[8px] font-bold tracking-wider transition-colors"
              style={targetMax !== undefined ? {
                backgroundColor: "var(--team-accent)",
                borderColor: "var(--team-accent)",
                color: "var(--team-accent-text)",
                } : {
                backgroundColor: targetButtonDisabled ? "rgba(22, 19, 15, 0.06)" : "transparent",
                borderColor: targetButtonDisabled ? "rgba(22, 19, 15, 0.25)" : "var(--ink)",
                color: targetButtonDisabled ? "rgba(22, 19, 15, 0.45)" : "var(--ink)",
              }}
              title={
                targetButtonLocked
                  ? `Cannot mark as target: ${impossibleTargetReason}`
                  : targetLimitReached
                    ? `Target limit reached (${MAX_AUCTION_TARGETS}/${MAX_AUCTION_TARGETS})`
                  : "Set an automatic bid limit for skipped auction simulation"
              }
            >
              <Target size={10} />
              {targetMax !== undefined
                ? `${(targetPriority ?? "medium").toUpperCase()} · ${crore(targetMax)}`
                : targetButtonLocked
                  ? "UNAVAILABLE"
                  : targetLimitReached
                    ? "LIMIT"
                  : "TARGET"}
            </button>
          )}
          {type === "sold" && buyerTeamName && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: buyerColor ?? "#8a8378" }} />
              <span className="font-space-mono text-[9px] text-text-secondary font-bold">{buyerTeamName}</span>
            </div>
          )}
          <span
            className="font-barlow-condensed font-bold text-[14px]"
            style={{ color: type === "sold" ? "#1f9d57" : type === "unsold" ? "#d6492f" : "var(--ink)" }}
          >
            {type === "sold" && soldPrice != null
              ? crore(soldPrice)
              : crore(player.basePrice)}
          </span>
          <span className="font-space-mono text-[9px] text-text-secondary shrink-0">
            {isOpen ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {type === "left" && showTargetEditor && (
        <div
          className="flex items-center gap-3 border-t border-border/20 bg-surface2 px-6 py-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-0 flex-1">
            <div className="font-space-mono text-[9px] font-bold uppercase tracking-wider text-text-primary">
              Skip-auction maximum bid
            </div>
            <div className="font-barlow text-[10px] text-text-secondary">
              Choose a priority and maximum bid. Only used when you skip. Minimum {crore(player.basePrice)}.
            </div>
            {impossibleTargetReason && (
              <div className="mt-1 font-barlow text-[10px] font-semibold text-danger">
                Cannot set target: {impossibleTargetReason}
              </div>
            )}
          </div>
          <div
            className="flex h-8 overflow-hidden rounded border border-border bg-surface"
            role="radiogroup"
            aria-label={`Target priority for ${player.name}`}
          >
            {TARGET_PRIORITIES.map(({ value, label }) => {
              const isSelected = priority === value;

              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setPriority(value)}
                  className="flex items-center gap-1.5 border-r border-border px-2.5 font-space-mono text-[9px] font-bold uppercase transition-colors last:border-r-0"
                  style={isSelected ? {
                    backgroundColor: "var(--team-accent)",
                    color: "var(--team-accent-text)",
                  } : {
                    color: "var(--ink)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-3 w-3 items-center justify-center rounded-full border"
                    style={{ borderColor: isSelected ? "currentColor" : "var(--border)" }}
                  >
                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center overflow-hidden rounded border border-border bg-surface">
            <span className="px-2 font-space-mono text-[10px] font-bold text-text-secondary">₹</span>
            <input
              type="number"
              min={(player.basePrice / 100).toFixed(2)}
              step="0.05"
              value={maxBidCrore}
              onChange={(e) => setMaxBidCrore(e.target.value)}
              className="h-8 w-20 bg-transparent px-1 font-space-mono text-[11px] font-bold text-text-primary outline-none"
              aria-label={`Maximum skipped-auction bid for ${player.name} in crore`}
            />
            <span className="pr-2 font-space-mono text-[9px] text-text-secondary">Cr</span>
          </div>
          <button
            disabled={invalidLimit || !!impossibleTargetReason}
            onClick={() => {
              onSetTarget?.(parsedMaxLakhs, priority);
              setShowTargetEditor(false);
            }}
            className="h-8 rounded px-3 font-space-mono text-[9px] font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: "var(--team-accent)", color: "var(--team-accent-text)" }}
          >
            Save target
          </button>
          {targetMax !== undefined && (
            <button
              onClick={() => {
                onRemoveTarget?.();
                setShowTargetEditor(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded border border-danger text-danger hover:bg-danger hover:text-white"
              title="Remove target"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Expanded profile dropdown */}
      {isOpen && (
        <div className="bg-surface/50 border-t border-b border-border/20 p-2 overflow-hidden">
          <PlayerCard player={player} soldPrice={soldPrice} collapsible={false} />
        </div>
      )}
    </div>
  );
}

export default function PlayerListPopup({
  type,
  onClose,
}: {
  type: PopupType;
  onClose: () => void;
}) {
  const { auction, players, teams, userTeamId, auctionTargets, auctionTargetPriorities, setAuctionTarget, removeAuctionTarget } = useGameStore();
  if (!auction) return null;

  const ids =
    type === "sold"
      ? auction.soldPlayerIds
      : type === "unsold"
      ? auction.unsoldPlayerIds
      : auction.allPlayerIds.filter(
          (id) =>
            !auction.soldPlayerIds.includes(id) &&
            !auction.unsoldPlayerIds.includes(id)
        );

  const playerList = ids.map((id) => players[id]).filter(Boolean) as Player[];
  const saleMap = new Map((auction.saleHistory ?? []).map((s) => [s.playerId, s]));
  const userTeam = teams[userTeamId];
  const protectedTargetFunds = Object.entries(auctionTargets).reduce((total, [playerId, maxBid]) => {
    const priority = auctionTargetPriorities[playerId] ?? "medium";
    const player = players[playerId];
    if (priority === "low" || !player || !userTeam) return total;
    if (!canTeamBidOnPlayer(userTeam, player, players, false).canBid) return total;
    if (!canTeamAffordBid(userTeam, player.basePrice, players)) return total;
    return total + maxBid;
  }, 0);

  const labelMap: Record<PopupType, string> = {
    sold: "SOLD PLAYERS",
    unsold: "UNSOLD PLAYERS",
    left: "UPCOMING PLAYERS",
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center"
      style={{ backgroundColor: "rgba(22,19,15,.65)", paddingTop: "48px", paddingBottom: "32px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full flex flex-col rounded-[8px] overflow-hidden shadow-2xl transition-colors duration-200 bg-surface"
        style={{
          maxWidth: "680px",
          border: "2px solid var(--ink)",
          maxHeight: "calc(100vh - 80px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0 transition-colors duration-200"
          style={{ backgroundColor: "var(--team-bid-bg, #1b2133)", borderBottom: "2px solid var(--ink)" }}
        >
          <div>
            <div className="font-space-mono font-bold text-[9px] tracking-[.16em] uppercase mb-1" style={{ color: "var(--team-accent, #1d55c4)" }}>
              {labelMap[type]}
            </div>
            <div className="font-anton text-[30px] leading-none uppercase" style={{ color: "var(--team-bid-text, #ffffff)" }}>
              {playerList.length} Players
            </div>
            {type === "left" && Object.keys(auctionTargets).length > 0 && (
              <div className="mt-1 space-y-0.5 font-space-mono text-[8px] font-bold uppercase tracking-wider" style={{ color: "var(--team-bid-muted, #9aa4bc)" }}>
                <div>{Object.keys(auctionTargets).length} skip target{Object.keys(auctionTargets).length === 1 ? "" : "s"} active</div>
                <div>High + Medium target ceilings: {crore(protectedTargetFunds)}</div>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center font-bold transition-all duration-150 rounded shrink-0 text-[14px] cursor-pointer hover:!bg-red-600 hover:!text-white hover:scale-105 active:scale-95"
            style={{ backgroundColor: "var(--team-accent, #1d55c4)", color: "var(--team-accent-text, #ffffff)" }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {playerList.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="font-space-mono text-[10px] text-text-secondary tracking-wider">
                No players in this section
              </span>
            </div>
          ) : type === "left" ? (
            /* Group Upcoming Players by Auction Sets */
            auction.sets.map((set, setIdx) => {
              const upcomingInSet = set.playerIds
                .filter((id) => ids.includes(id))
                .map((id) => players[id])
                .filter(Boolean) as Player[];

              if (upcomingInSet.length === 0) return null;

              return (
                <div key={set.id}>
                  {/* Set Header */}
                  <div
                    className="px-6 py-2 sticky top-0 z-10 flex items-center justify-between transition-colors duration-200"
                    style={{
                      backgroundColor: "var(--team-bid-bg, #1b2133)",
                      borderBottom: "1px solid rgba(255,255,255,.1)",
                    }}
                  >
                    <span
                      className="font-space-mono font-bold text-[9.5px] tracking-widest uppercase"
                      style={{ color: "var(--team-accent, #1d55c4)" }}
                    >
                      {set.name.toUpperCase()} ({upcomingInSet.length})
                    </span>
                    {setIdx === auction.currentSetIndex && (
                      <span className="font-space-mono font-bold text-[8px] bg-accent text-border px-1.5 py-0.5 rounded-[2px]">
                        CURRENT SET
                      </span>
                    )}
                  </div>

                  {/* Player rows in Set */}
                  {upcomingInSet.map((p) => (
                    <PlayerRow
                      key={p.id}
                      player={p}
                      type={type}
                      targetMax={auctionTargets[p.id]}
                      targetPriority={auctionTargetPriorities[p.id]}
                      onSetTarget={(maxBid, priority) => setAuctionTarget(p.id, maxBid, priority)}
                      onRemoveTarget={() => removeAuctionTarget(p.id)}
                    />
                  ))}
                </div>
              );
            })
          ) : (
            /* Group Sold / Unsold Players by Category */
            CATEGORIES.map((cat) => {
              let categoryPlayers: Player[];
              if (cat.marquee) {
                categoryPlayers = playerList.filter(
                  (p) => (p.reputation ?? 0) >= 8 || Math.max(p.currentBatting ?? 0, p.currentBowling ?? 0) >= 85
                );
              } else {
                categoryPlayers = playerList.filter(
                  (p) => !((p.reputation ?? 0) >= 8 || Math.max(p.currentBatting ?? 0, p.currentBowling ?? 0) >= 85) && cat.roles.includes(p.role)
                );
              }

              if (categoryPlayers.length === 0) return null;

              return (
                <div key={cat.label}>
                  {/* Category header */}
                  <div
                    className="px-6 py-2 sticky top-0 z-10 transition-colors duration-200"
                    style={{
                      backgroundColor: "var(--team-bid-bg, #1b2133)",
                      borderBottom: "1px solid rgba(255,255,255,.1)",
                    }}
                  >
                    <span
                      className="font-space-mono font-bold text-[9px] tracking-widest uppercase"
                      style={{ color: "var(--team-accent, #1d55c4)" }}
                    >
                      {cat.label} ({categoryPlayers.length})
                    </span>
                  </div>

                  {/* Player rows with dropdown */}
                  {categoryPlayers.map((p) => {
                    const sale = saleMap.get(p.id);
                    const buyer = sale ? teams[sale.teamId] : undefined;
                    return (
                      <PlayerRow
                        key={p.id}
                        player={p}
                        type={type}
                        soldPrice={sale?.price}
                        buyerTeamName={buyer?.shortName}
                        buyerColor={buyer?.primaryColor}
                      />
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
