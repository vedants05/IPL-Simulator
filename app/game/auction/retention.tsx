"use client";
import { useGameStore } from "@/lib/store/gameStore";
import { formatPrice, getRetentionCost, TOTAL_PURSE_LAKHS } from "@/lib/logic/auctionRules";
import StarRating from "@/components/shared/StarRating";

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
  const totalCost = retainedIds.reduce((sum, _, idx) => sum + getRetentionCost(idx + 1), 0);
  const purseAfter = TOTAL_PURSE_LAKHS - totalCost;

  const cappedSlotsFull = retainedIds.filter((id) => {
    const p = players[id];
    return p?.isCapped || p?.nationality === "Overseas";
  }).length >= 3;

  const uncappedSlotsFull = retainedIds.filter((id) => {
    const p = players[id];
    return !p?.isCapped && p?.nationality === "Indian";
  }).length >= 3;

  return (
    <div className="min-h-screen bg-bg text-text-primary p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="text-xs uppercase tracking-widest text-accent mb-2">Mega Auction 2025</div>
          <h1 className="text-3xl font-black text-text-primary mb-1">Select Retentions</h1>
          <p className="text-text-secondary">
            You can retain up to 6 players (max 3 capped/overseas, max 3 uncapped Indian).
            Each retention deducts from your ₹120 Cr purse.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Player list */}
          <div className="col-span-2">
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface2">
                <h3 className="text-sm font-semibold text-text-primary">
                  {userTeam.name} — Current Squad ({squadPlayers.length} players)
                </h3>
              </div>
              <div className="divide-y divide-border">
                {squadPlayers.map((player) => {
                  const retainedIdx = retainedIds.indexOf(player.id);
                  const isRetained = retainedIdx !== -1;
                  const slot = isRetained ? retainedIdx + 1 : null;
                  const cost = isRetained ? getRetentionCost(retainedIdx + 1) : null;

                  const isUncapped = !player.isCapped && player.nationality === "Indian";
                  const canAdd =
                    !isRetained &&
                    retainedIds.length < 6 &&
                    (isUncapped ? !uncappedSlotsFull : !cappedSlotsFull);

                  return (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between px-4 py-3 ${isRetained ? "bg-accent/5" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        {isRetained ? (
                          <span className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold">
                            {slot}
                          </span>
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-border flex items-center justify-center text-text-secondary text-xs">
                            —
                          </span>
                        )}
                        <div>
                          <div className="text-sm font-medium text-text-primary">{player.name}</div>
                          <div className="text-xs text-text-secondary">
                            {player.role} · {player.isCapped ? "Capped" : "Uncapped"} · Age {player.age}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <StarRating rating={player.starRating} size="sm" />
                        {isRetained && cost !== null && (
                          <span className="text-xs text-gold font-semibold w-20 text-right">
                            -{formatPrice(cost)}
                          </span>
                        )}
                        {isRetained ? (
                          <button
                            onClick={() => releaseRetention(player.id)}
                            className="text-xs text-danger hover:text-red-400 border border-danger/30 hover:border-danger px-2 py-1 rounded transition-colors"
                          >
                            Release
                          </button>
                        ) : (
                          <button
                            onClick={() => canAdd && retainPlayer(player.id, retainedIds.length + 1)}
                            disabled={!canAdd}
                            className="text-xs text-accent hover:text-accent-hover border border-accent/30 hover:border-accent disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded transition-colors"
                          >
                            Retain
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Summary panel */}
          <div className="flex flex-col gap-4">
            <div className="bg-surface rounded-lg border border-border p-4">
              <h3 className="text-xs uppercase tracking-widest text-text-secondary mb-3">Retention Summary</h3>

              {retainedIds.length === 0 ? (
                <p className="text-sm text-text-secondary">No players retained yet.</p>
              ) : (
                <div className="flex flex-col gap-2 mb-3">
                  {retainedIds.map((id, idx) => {
                    const p = players[id];
                    return (
                      <div key={id} className="flex justify-between text-xs">
                        <span className="text-text-secondary">
                          Slot {idx + 1}: <span className="text-text-primary">{p?.name}</span>
                        </span>
                        <span className="text-gold">-{formatPrice(getRetentionCost(idx + 1))}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-border pt-3 mt-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary">Total Purse</span>
                  <span className="text-text-primary">{formatPrice(TOTAL_PURSE_LAKHS)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary">Retention Deductions</span>
                  <span className="text-danger">-{formatPrice(totalCost)}</span>
                </div>
                <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-border">
                  <span className="text-text-primary">Purse for Auction</span>
                  <span className="text-success">{formatPrice(purseAfter)}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-lg border border-border p-4">
              <h3 className="text-xs uppercase tracking-widest text-text-secondary mb-2">RTM Cards</h3>
              <p className="text-sm text-text-primary font-semibold">
                {Math.max(0, 3 - retainedIds.length)} RTM cards
              </p>
              <p className="text-xs text-text-secondary mt-1">
                You receive 1 RTM card for each of the first 3 players you do NOT retain.
              </p>
            </div>

            <button
              onClick={confirmRetentions}
              className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 rounded-lg transition-colors text-sm"
            >
              Confirm & Go to Auction →
            </button>

            {retainedIds.length === 0 && (
              <p className="text-xs text-text-secondary text-center">
                Proceeding with 0 retentions. You will receive 3 RTM cards.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
