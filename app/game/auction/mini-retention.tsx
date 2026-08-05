"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";
import {
  MINI_AUCTION_PURSE_LAKHS,
  enforceMiniAuctionRetentionLimits,
  getMiniAuctionContractPrice,
  selectAIMiniAuctionKeeps,
  validateMiniAuctionRetentions,
} from "@/lib/logic/miniAuctionRetention";

export default function MiniRetentionPhase() {
  const { teams, players, userTeamId, currentSeason } = useGameStore();
  const retainPlayer = useGameStore((state) => state.retainPlayer);
  const releaseRetention = useGameStore((state) => state.releaseRetention);
  const autoRetainPlayers = useGameStore((state) => state.autoRetainPlayers);
  const confirmRetentions = useGameStore((state) => state.confirmRetentions);
  const initNewGame = useGameStore((state) => state.initNewGame);
  const refreshPlayersFromSupabase = useGameStore((state) => state.refreshPlayersFromSupabase);
  const repairAttempted = useRef(false);
  const contractRefreshAttempted = useRef(false);
  const [repairError, setRepairError] = useState<string | null>(null);
  const [isVerifyingContracts, setIsVerifyingContracts] = useState(currentSeason === 2027);
  const [contractError, setContractError] = useState<string | null>(null);
  const team = teams[userTeamId];
  const legalKeptIds = team
    ? enforceMiniAuctionRetentionLimits(team, team.retainedPlayers, players, currentSeason)
    : [];

  const verifyOpeningContracts = useCallback(async () => {
    setIsVerifyingContracts(true);
    setContractError(null);
    try {
      await refreshPlayersFromSupabase();
    } catch (error: unknown) {
      setContractError(error instanceof Error ? error.message : "Contract data could not be verified.");
    } finally {
      setIsVerifyingContracts(false);
    }
  }, [refreshPlayersFromSupabase]);

  useEffect(() => {
    if (
      currentSeason !== 2027
      || !userTeamId
      || !team
      || team.squad.length > 0
      || repairAttempted.current
    ) return;
    repairAttempted.current = true;
    void initNewGame(userTeamId).catch((error: unknown) => {
      setRepairError(error instanceof Error ? error.message : "The opening squad could not be reloaded.");
    });
  }, [currentSeason, initNewGame, team, userTeamId]);

  useEffect(() => {
    if (!team || legalKeptIds.length === team.retainedPlayers.length) return;
    const legalIds = new Set(legalKeptIds);
    team.retainedPlayers.forEach((playerId) => {
      if (!legalIds.has(playerId)) releaseRetention(playerId);
    });
  }, [legalKeptIds, releaseRetention, team]);

  useEffect(() => {
    if (
      currentSeason !== 2027
      || !team
      || team.squad.length === 0
      || contractRefreshAttempted.current
    ) return;
    contractRefreshAttempted.current = true;
    void verifyOpeningContracts();
  }, [currentSeason, team, verifyOpeningContracts]);

  if (!team) return null;

  if (currentSeason === 2027 && team.squad.length === 0) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center bg-bg px-8 text-center text-text-primary">
        <div>
          <h1 className="font-anton text-[36px] uppercase">Reloading contracted squad</h1>
          <p className="mt-2 font-barlow text-[13px] text-text-secondary">
            {repairError ?? "The original roster did not finish loading. Repairing the 2027 retention list now..."}
          </p>
        </div>
      </div>
    );
  }

  const keptIds = team.retainedPlayers;
  const validation = validateMiniAuctionRetentions({ team, keptIds, players, season: currentSeason });
  const aiValidationErrors = Object.values(teams).flatMap((aiTeam) => {
    if (aiTeam.id === userTeamId) return [];
    const aiKeptIds = selectAIMiniAuctionKeeps(aiTeam, players, currentSeason);
    const aiValidation = validateMiniAuctionRetentions({
      team: aiTeam,
      keptIds: aiKeptIds,
      players,
      season: currentSeason,
    });
    return aiValidation.errors.map((error) => `${aiTeam.shortName ?? aiTeam.id}: ${error}`);
  });
  const squadPlayers = team.squad
    .map((playerId) => players[playerId])
    .filter(Boolean)
    .sort((left, right) => (
      Math.max(right.currentBatting, right.currentBowling)
      - Math.max(left.currentBatting, left.currentBowling)
    ));

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col overflow-hidden bg-bg text-text-primary">
      <div className="shrink-0 border-b-2 border-border px-8 py-6">
        <div className="mb-2 font-space-mono text-[10px] font-bold uppercase tracking-[.16em] text-text-secondary">
          Mini Auction {currentSeason} · Contract Decisions
        </div>
        <h1 className="font-anton text-[44px] uppercase leading-none">Keep or Release</h1>
        <p className="mt-2 font-barlow text-[13px] text-text-secondary">
          Kept players retain their existing salary. Your auction purse is ₹125 Cr minus kept-player salaries. Mini auctions have no retention limits, slabs or RTM cards.
        </p>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex-1 overflow-y-auto border-r-2 border-border">
          {squadPlayers.map((player) => {
            const isKept = keptIds.includes(player.id);
            const salary = getMiniAuctionContractPrice(player, team.id, currentSeason);
            return (
              <div key={player.id} className={`flex items-center justify-between border-b border-border/60 px-6 py-4 ${isKept ? "bg-marquee" : ""}`}>
                <div>
                  <div className="font-barlow text-[14px] font-semibold">{player.name}</div>
                  <div className="mt-0.5 font-space-mono text-[9px] uppercase tracking-wider text-text-secondary">
                    {player.role} · Age {player.age} · Rating {Math.max(player.currentBatting, player.currentBowling)}
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <span className="w-24 text-right font-barlow-condensed text-[14px] font-bold">
                    {formatPrice(salary)}
                  </span>
                  <button
                    onClick={() => isKept ? releaseRetention(player.id) : retainPlayer(player.id)}
                    disabled={player.setForRelease}
                    className={`w-24 rounded-[3px] border px-3 py-1.5 font-space-mono text-[10px] font-bold tracking-wider transition-colors ${
                      isKept
                        ? "border-danger text-danger hover:bg-danger hover:text-white"
                        : "border-border text-text-primary hover:bg-border"
                    }`}
                  >
                    {player.setForRelease ? "SET TO RELEASE" : isKept ? "RELEASE" : "KEEP"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="flex w-[300px] shrink-0 flex-col">
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-4 font-space-mono text-[9px] font-bold uppercase tracking-widest text-text-secondary">Contract Summary</div>
            <div className="space-y-3 border-b border-border pb-4 font-barlow text-[13px]">
              <div className="flex justify-between"><span>Players kept</span><strong>{keptIds.length}</strong></div>
              <div className="flex justify-between"><span>Players released</span><strong>{squadPlayers.length - keptIds.length}</strong></div>
              <div className="flex justify-between"><span>Salary cap</span><strong>{formatPrice(MINI_AUCTION_PURSE_LAKHS)}</strong></div>
              <div className="flex justify-between"><span>Kept salaries</span><strong className="text-danger">-{formatPrice(validation.totalSalary)}</strong></div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="font-barlow font-semibold">Auction purse</span>
              <strong className="font-barlow-condensed text-[22px] text-success">{formatPrice(validation.remainingPurse)}</strong>
            </div>
            {validation.errors.length > 0 && (
              <div className="mt-4 rounded border border-danger bg-danger/10 p-3">
                {validation.errors.map((error) => <p key={error} className="font-barlow text-[11px] text-danger">{error}</p>)}
              </div>
            )}
            {contractError && (
              <div className="mt-4 rounded border border-danger bg-danger/10 p-3">
                <p className="font-barlow text-[11px] text-danger">{contractError}</p>
                <button onClick={() => void verifyOpeningContracts()} className="mt-2 font-space-mono text-[9px] font-bold underline">
                  RETRY CONTRACT CHECK
                </button>
              </div>
            )}
            {!isVerifyingContracts && aiValidationErrors.length > 0 && (
              <div className="mt-4 rounded border border-danger bg-danger/10 p-3">
                {aiValidationErrors.map((error) => <p key={error} className="font-barlow text-[11px] text-danger">{error}</p>)}
              </div>
            )}
            <p className="mt-4 font-space-mono text-[9px] leading-relaxed text-text-secondary">RTM cards: 0 · Existing contract salaries are carried into the new season.</p>
          </div>
          <div className="space-y-2 border-t-2 border-border bg-surface p-4">
            <button onClick={autoRetainPlayers} className="w-full rounded border border-border py-2.5 font-space-mono text-[10px] font-bold">AUTO-SELECT RELEASES</button>
            <button
              onClick={confirmRetentions}
              disabled={!validation.valid || aiValidationErrors.length > 0 || isVerifyingContracts || Boolean(contractError)}
              className="w-full border-2 border-border py-4 font-anton text-[18px] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: "var(--team-cta-bg, var(--ink))", color: "var(--team-cta-text, #fff)" }}
            >
              {isVerifyingContracts ? "VERIFYING CONTRACTS..." : "CONFIRM & GO TO AUCTION →"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
