"use client";
import { useGameStore } from "@/lib/store/gameStore";
import {
  formatPrice,
  TOTAL_PURSE_LAKHS,
  MAX_CAPPED_RETENTIONS,
  MAX_UNCAPPED_RETENTIONS,
  MAX_TOTAL_RETENTIONS,
  getPlayerRetentionCost,
  calculateTotalRetentionCost,
} from "@/lib/logic/auctionRules";

export default function RetentionPhase() {
  const { teams, players, userTeamId } = useGameStore();
  const retainPlayer = useGameStore((s) => s.retainPlayer);
  const releaseRetention = useGameStore((s) => s.releaseRetention);
  const confirmRetentions = useGameStore((s) => s.confirmRetentions);

  const userTeam = teams[userTeamId];
  if (!userTeam) return null;

  const squadPlayers = userTeam.squad
    .map((id) => players[id])
    .filter(Boolean)
    .sort((a, b) => b.starRating - a.starRating);

  const retainedIds = userTeam.retainedPlayers;
  const totalCost = calculateTotalRetentionCost(retainedIds, players);
  const purseAfter = TOTAL_PURSE_LAKHS - totalCost;
  const rtmCards = Math.max(0, MAX_TOTAL_RETENTIONS - retainedIds.length);

  const cappedCount = retainedIds.filter((id) => {
    const p = players[id];
    return p?.isCapped || p?.nationality === "Overseas";
  }).length;
  const uncappedCount = retainedIds.length - cappedCount;

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* Header */}
      <div className="border-b-2 border-border px-8 py-6">
        <div className="font-space-mono font-bold text-[10px] tracking-[.16em] text-text-secondary mb-2 uppercase">
          Mega Auction 2026 · Pre-Season
        </div>
        <h1 className="font-anton text-[44px] leading-none text-text-primary uppercase">
          Select Retentions
        </h1>
        <p className="font-barlow text-[13px] text-text-secondary mt-2">
          Up to {MAX_TOTAL_RETENTIONS} players (max {MAX_CAPPED_RETENTIONS} capped/overseas · max {MAX_UNCAPPED_RETENTIONS} uncapped Indian). Each retention deducts from your ₹120 Cr purse.
        </p>
      </div>

      <div className="flex overflow-hidden" style={{ height: "calc(100vh - 140px)" }}>
        {/* Player list */}
        <div className="flex-1 overflow-y-auto" style={{ borderRight: "2px solid #16130f" }}>
          <div className="border-b-2 border-border px-6 py-3 bg-surface">
            <span className="font-space-mono font-bold text-[10px] tracking-widest text-text-secondary uppercase">
              {userTeam.name} — {squadPlayers.length} players
            </span>
          </div>

          {squadPlayers.map((player) => {
            const retainedIdx = retainedIds.indexOf(player.id);
            const isRetained = retainedIdx !== -1;
            const slot = isRetained ? retainedIdx + 1 : null;
            const cost = isRetained
              ? getPlayerRetentionCost(player.id, retainedIds.slice(0, retainedIdx), players)
              : null;

            const isPlayerCapped = player.isCapped || player.nationality === "Overseas";
            const canAdd =
              !isRetained &&
              retainedIds.length < MAX_TOTAL_RETENTIONS &&
              (isPlayerCapped ? cappedCount < MAX_CAPPED_RETENTIONS : uncappedCount < MAX_UNCAPPED_RETENTIONS);

            return (
              <div
                key={player.id}
                className={`flex items-center justify-between px-6 py-4 ${isRetained ? "bg-marquee" : ""}`}
                style={{ borderBottom: "1px solid rgba(22,19,15,.12)" }}
              >
                <div className="flex items-center gap-4">
                  {isRetained ? (
                    <div className="w-7 h-7 rounded-full bg-border flex items-center justify-center font-space-mono font-bold text-[11px] text-accent shrink-0">
                      {slot}
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full border-2 border-border flex items-center justify-center text-text-secondary text-xs shrink-0">
                      —
                    </div>
                  )}
                  <div>
                    <div className="font-barlow font-semibold text-[14px] text-text-primary">{player.name}</div>
                    <div className="font-space-mono text-[9px] tracking-wider text-text-secondary mt-0.5">
                      {player.role.toUpperCase()} · {player.isCapped ? "CAPPED" : "UNCAPPED"} · AGE {player.age}
                      {player.nationality === "Overseas" && " · OVERSEAS"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  {/* Stars */}
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: i < player.starRating ? "#ffc400" : "rgba(22,19,15,.15)" }}
                      />
                    ))}
                  </div>

                  {isRetained && cost !== null && (
                    <span className="font-barlow-condensed font-bold text-[14px] text-danger w-24 text-right">
                      -{formatPrice(cost)}
                    </span>
                  )}

                  {isRetained ? (
                    <button
                      onClick={() => releaseRetention(player.id)}
                      className="font-space-mono font-bold text-[10px] tracking-wider text-danger border border-danger px-3 py-1.5 rounded-[3px] hover:bg-danger hover:text-white transition-colors"
                    >
                      RELEASE
                    </button>
                  ) : (
                    <button
                      onClick={() => canAdd && retainPlayer(player.id)}
                      disabled={!canAdd}
                      className="font-space-mono font-bold text-[10px] tracking-wider text-text-primary border border-border px-3 py-1.5 rounded-[3px]
                        hover:bg-border hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      RETAIN
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary sidebar */}
        <div className="w-[280px] shrink-0 flex flex-col">
          <div className="flex-1 overflow-y-auto p-5">
            <div className="font-space-mono font-bold text-[9px] tracking-widest text-text-secondary mb-4 uppercase">
              Retention Summary
            </div>

            {retainedIds.length === 0 ? (
              <p className="font-barlow text-[13px] text-text-secondary">No players retained yet.</p>
            ) : (
              <div className="flex flex-col gap-3 mb-4">
                {retainedIds.map((id, idx) => {
                  const p = players[id];
                  const c = getPlayerRetentionCost(id, retainedIds.slice(0, idx), players);
                  const isCapped = p?.isCapped || p?.nationality === "Overseas";
                  return (
                    <div key={id} className="flex justify-between items-center">
                      <div>
                        <span className="font-space-mono text-[9px] tracking-wider text-text-secondary">
                          {isCapped ? "CAPPED" : "UNCAPPED"}{" "}
                        </span>
                        <span className="font-barlow font-semibold text-[12px] text-text-primary">{p?.name}</span>
                      </div>
                      <span className="font-barlow-condensed font-bold text-[13px] text-danger">
                        -{formatPrice(c)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="border-t-2 border-border pt-4 mt-4 flex flex-col gap-2">
              <div className="flex justify-between text-[12px]">
                <span className="font-barlow text-text-secondary">Total Purse</span>
                <span className="font-barlow-condensed font-bold text-[14px] text-text-primary">{formatPrice(TOTAL_PURSE_LAKHS)}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="font-barlow text-text-secondary">Deductions</span>
                <span className="font-barlow-condensed font-bold text-[14px] text-danger">-{formatPrice(totalCost)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-border pt-3 mt-1">
                <span className="font-barlow font-semibold text-[13px] text-text-primary">Auction Purse</span>
                <span className="font-barlow-condensed font-bold text-[18px] text-success">{formatPrice(purseAfter)}</span>
              </div>
            </div>

            {/* Slot counters */}
            <div className="mt-4 flex gap-3">
              <div className="flex-1 border border-border p-3 rounded-[3px]">
                <div className="font-space-mono text-[8px] tracking-wider text-text-secondary mb-1">CAPPED/OS</div>
                <div className="font-barlow-condensed font-bold text-[18px]" style={{ color: cappedCount >= MAX_CAPPED_RETENTIONS ? "#d6492f" : "#16130f" }}>
                  {cappedCount}/{MAX_CAPPED_RETENTIONS}
                </div>
              </div>
              <div className="flex-1 border border-border p-3 rounded-[3px]">
                <div className="font-space-mono text-[8px] tracking-wider text-text-secondary mb-1">UNCAPPED</div>
                <div className="font-barlow-condensed font-bold text-[18px]" style={{ color: uncappedCount >= MAX_UNCAPPED_RETENTIONS ? "#d6492f" : "#16130f" }}>
                  {uncappedCount}/{MAX_UNCAPPED_RETENTIONS}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-border/30 pt-4">
              <div className="font-space-mono font-bold text-[9px] tracking-widest text-text-secondary mb-2 uppercase">RTM Cards</div>
              <div className="font-barlow-condensed font-bold text-[28px] text-text-primary">
                {rtmCards}
              </div>
              <p className="font-barlow text-[11px] text-text-secondary mt-1">
                {MAX_TOTAL_RETENTIONS} total slots minus retentions used.
              </p>
            </div>
          </div>

          {/* Confirm button */}
          <div className="p-4 border-t-2 border-border bg-surface">
            <button
              onClick={confirmRetentions}
              className="w-full bg-border text-accent font-anton text-[18px] tracking-wide py-4 hover:bg-black transition-colors"
            >
              CONFIRM & GO TO AUCTION →
            </button>
            {retainedIds.length === 0 && (
              <p className="font-space-mono text-[9px] text-text-secondary text-center mt-2 tracking-wider">
                Proceeding with 0 retentions · {MAX_TOTAL_RETENTIONS} RTM cards
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
