"use client";
import { useEffect } from "react";
import { useGameStore, advanceToNextLot } from "@/lib/store/gameStore";
import RetentionPhase from "./retention";
import PlayerCard from "@/components/auction/PlayerCard";
import BidPanel from "@/components/auction/BidPanel";
import BidHistory from "@/components/auction/BidHistory";
import TeamPurseList from "@/components/auction/TeamPurseList";
import AuctionSetNav from "@/components/auction/AuctionSetNav";
import RTMModal from "@/components/auction/RTMModal";
import SoldAnimation from "@/components/auction/SoldAnimation";
import { formatPrice } from "@/lib/logic/auctionRules";

export default function AuctionPage() {
  const { auction, teams, players, userTeamId } = useGameStore();
  const startAuction = useGameStore((s) => s.startAuction);

  const userTeam = teams[userTeamId];

  // Show retention phase
  if (!auction || auction.phase === "retention") {
    return <RetentionPhase />;
  }

  // Auction complete
  if (auction.phase === "completed") {
    return <AuctionComplete />;
  }

  // Start first lot if no current player
  const needsStart = auction.phase === "live" && !auction.currentPlayer;

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col overflow-hidden bg-bg">
      {/* Auction header bar */}
      <div className="bg-surface border-b border-border px-6 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="text-xs uppercase tracking-widest text-accent">
            {auction.isAcceleratedPhase ? "⚡ Accelerated Auction" : "Mega Auction 2025"}
          </div>
          <div className="text-xs text-text-secondary">
            Set {auction.currentSetIndex + 1}/{auction.sets.length} ·{" "}
            {auction.soldPlayerIds.length} sold · {auction.unsoldPlayerIds.length} unsold
          </div>
        </div>
        {needsStart && (
          <button
            onClick={startAuction}
            className="bg-accent hover:bg-accent-hover text-white text-sm font-bold px-6 py-2 rounded-lg transition-colors"
          >
            Start Auction
          </button>
        )}
        {!needsStart && auction.currentPlayer && (
          <div className="text-xs text-text-secondary">
            {auction.sets[auction.currentSetIndex]?.name ?? ""}
          </div>
        )}
      </div>

      {/* Main 3-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Team purses + set nav */}
        <div className="w-72 shrink-0 border-r border-border bg-surface flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
            <div>
              <h3 className="text-[10px] uppercase tracking-widest text-text-secondary mb-2">Team Budgets</h3>
              <TeamPurseList />
            </div>
            <div className="flex-1">
              <AuctionSetNav />
            </div>
          </div>
        </div>

        {/* CENTER: Player card + bidding */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <SoldAnimation />
          <RTMModal />

          {needsStart ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🏏</div>
                <h2 className="text-2xl font-bold text-text-primary mb-2">Ready to Auction</h2>
                <p className="text-text-secondary mb-6">
                  {auction.sets.reduce((s, set) => s + set.playerIds.length, 0)} players across{" "}
                  {auction.sets.length} sets
                </p>
                <button
                  onClick={startAuction}
                  className="bg-accent hover:bg-accent-hover text-white font-bold px-8 py-3 rounded-lg transition-colors"
                >
                  Start Auction
                </button>
              </div>
            </div>
          ) : auction.currentPlayer ? (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-2xl mx-auto flex flex-col gap-4">
                <PlayerCard
                  player={auction.currentPlayer}
                  teamColor={
                    auction.currentHighBidderTeamId
                      ? teams[auction.currentHighBidderTeamId]?.primaryColor
                      : undefined
                  }
                />
                <BidPanel />
                <BidHistory />
              </div>
            </div>
          ) : null}
        </div>

        {/* RIGHT: User squad */}
        <div className="w-72 shrink-0 border-l border-border bg-surface flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-surface2">
            <div className="flex justify-between text-xs">
              <span className="text-text-secondary font-medium">Your Squad</span>
              <span className="text-text-primary">{userTeam?.squad.length ?? 0}/25</span>
            </div>
            {userTeam && (
              <div className="flex justify-between text-xs mt-1">
                <span className="text-text-secondary">
                  Overseas: {userTeam.overseasPlayersCurrent}/8
                </span>
                <span className="text-success font-semibold">
                  {formatPrice(userTeam.remainingPurse)}
                </span>
              </div>
            )}
            {userTeam && userTeam.rtmCardsTotal - userTeam.rtmCardsUsed > 0 && (
              <div className="text-xs text-accent mt-1">
                RTM: {userTeam.rtmCardsTotal - userTeam.rtmCardsUsed} remaining
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {userTeam?.squad.length === 0 ? (
              <div className="text-xs text-text-secondary text-center py-4">
                No players yet. Start bidding!
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {userTeam?.squad.map((id) => {
                  const p = players[id];
                  if (!p) return null;
                  const roleShort =
                    p.role === "Batsman" ? "BAT" :
                    p.role === "WK-Batsman" ? "WK" :
                    p.role === "All-Rounder" ? "AR" :
                    p.role === "Pace Bowler" ? "PACE" : "SPIN";
                  const roleColor =
                    p.role === "Batsman" ? "text-blue-400" :
                    p.role === "WK-Batsman" ? "text-teal-400" :
                    p.role === "All-Rounder" ? "text-purple-400" :
                    p.role === "Pace Bowler" ? "text-red-400" : "text-orange-400";

                  return (
                    <div key={id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono text-[9px] w-8 ${roleColor}`}>[{roleShort}]</span>
                        <span className="text-text-primary truncate max-w-[130px]">{p.name}</span>
                      </div>
                      {p.nationality === "Overseas" && (
                        <span className="text-amber-500 text-[9px]">OS</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuctionComplete() {
  const { teams, players, userTeamId } = useGameStore();
  const userTeam = teams[userTeamId];

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="max-w-2xl w-full mx-auto px-6">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-3xl font-black text-text-primary mb-2">Auction Complete!</h1>
          <p className="text-text-secondary">
            {userTeam?.name} secured {userTeam?.squad.length} players
          </p>
        </div>

        <div className="bg-surface rounded-lg border border-border p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Your Final Squad</h3>
          <div className="grid grid-cols-2 gap-2">
            {userTeam?.squad.map((id) => {
              const p = players[id];
              if (!p) return null;
              return (
                <div key={id} className="flex justify-between items-center text-xs py-1.5 border-b border-border/50">
                  <span className="text-text-primary">{p.name}</span>
                  <span className="text-text-secondary">{p.role}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-border flex justify-between">
            <span className="text-text-secondary text-sm">Remaining Purse</span>
            <span className="text-success font-bold">{formatPrice(userTeam?.remainingPurse ?? 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
