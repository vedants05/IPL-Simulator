"use client";
import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import RetentionPhase from "./retention";
import PlayerCard from "@/components/auction/PlayerCard";
import BidPanel from "@/components/auction/BidPanel";
import BidHistory from "@/components/auction/BidHistory";
import TeamPurseList from "@/components/auction/TeamPurseList";
import UserSquad from "@/components/auction/UserSquad";
import MiniSoldLog from "@/components/auction/MiniSoldLog";
import RTMModal from "@/components/auction/RTMModal";
import SoldAnimation from "@/components/auction/SoldAnimation";
import UnsoldAnimation from "@/components/auction/UnsoldAnimation";
import PlayerListPopup from "@/components/auction/PlayerListPopup";

type PopupTab = "sold" | "unsold" | "left" | null;

export default function AuctionPage() {
  const { auction, teams, userTeamId } = useGameStore();
  const startAuction = useGameStore((s) => s.startAuction);
  const [activePopup, setActivePopup] = useState<PopupTab>(null);
  const setPaused = useGameStore((s) => s.setPaused);

  useEffect(() => {
    if (activePopup) {
      setPaused(true);
    } else {
      setPaused(false);
    }
  }, [activePopup, setPaused]);

  const userTeam = teams[userTeamId];

  if (!userTeam) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="font-barlow text-text-secondary text-center">
          No active game.{" "}
          <a href="/setup" className="text-text-primary underline font-semibold">Start a new game</a>
        </div>
      </div>
    );
  }

  if (!auction || auction.phase === "retention") {
    return <RetentionPhase />;
  }

  if (auction.phase === "completed") {
    return <AuctionComplete />;
  }

  const needsStart = auction.phase === "live" && !auction.currentPlayer;
  const currentSet = auction.sets[auction.currentSetIndex];
  const totalLeft = auction.allPlayerIds.length - auction.soldPlayerIds.length - auction.unsoldPlayerIds.length;

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col overflow-hidden bg-bg">
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-[22px] py-[14px] shrink-0"
        style={{ borderBottom: "2px solid #16130f" }}
      >
        <div className="flex items-center gap-[14px]">
          <div className="flex items-center gap-2 bg-border px-[9px] py-[5px] rounded-[3px]">
            <div
              className="w-[7px] h-[7px] rounded-full bg-accent shrink-0"
              style={{ animation: "liveblink 1.4s infinite" }}
            />
            <span className="font-space-mono font-bold text-[11px] tracking-[.12em] text-white">LIVE</span>
          </div>
          <span className="font-anton text-[22px] leading-none text-text-primary">
            MEGA AUCTION &apos;25
          </span>
          <span className="font-space-mono text-[11px] text-text-secondary">
            SET {auction.currentSetIndex + 1}/{auction.sets.length}
            {currentSet ? ` · ${currentSet.name.toUpperCase()}` : ""}
          </span>
        </div>

        <div className="flex gap-[6px]">
          <button
            onClick={() => setActivePopup(activePopup === "sold" ? null : "sold")}
            className="px-[11px] py-[7px] hover:brightness-95 transition-all flex items-center justify-center rounded-[5px]"
            style={{
              background: "linear-gradient(var(--team-primary-tint), var(--team-primary-tint)), #1f9d57",
              border: "1.5px solid #16130f",
            }}
          >
            <span className="font-space-mono font-bold text-[10px] tracking-wider text-white leading-none">
              SOLD {auction.soldPlayerIds.length}
            </span>
          </button>
          <button
            onClick={() => setActivePopup(activePopup === "unsold" ? null : "unsold")}
            className="px-[11px] py-[7px] hover:brightness-95 transition-all flex items-center justify-center rounded-[5px]"
            style={{
              background: "linear-gradient(var(--team-primary-tint), var(--team-primary-tint)), #d6492f",
              border: "1.5px solid #16130f",
            }}
          >
            <span className="font-space-mono font-bold text-[10px] tracking-wider text-white leading-none">
              UNSOLD {auction.unsoldPlayerIds.length}
            </span>
          </button>
          <button
            onClick={() => setActivePopup(activePopup === "left" ? null : "left")}
            className="px-[11px] py-[7px] hover:brightness-95 transition-all flex items-center justify-center rounded-[5px]"
            style={{
              backgroundColor: "var(--team-primary-tint, #efece3)",
              border: "1.5px solid #16130f",
            }}
          >
            <span className="font-space-mono font-bold text-[10px] tracking-wider text-text-primary leading-none">
              LEFT {totalLeft}
            </span>
          </button>
        </div>
      </div>

      {/* 4-zone flex row */}
      <div className="flex-1 flex overflow-hidden">

        {/* Zone 1: Team Purse (top) + Sold Log (bottom) — 220px */}
        <div
          className="w-[220px] shrink-0 flex flex-col relative"
          style={{ borderRight: "2px solid #16130f" }}
        >
          <TeamPurseList />
          <MiniSoldLog />
        </div>

        {/* Zone 2: Center Lot — flex:1 */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
          <SoldAnimation />
          <UnsoldAnimation />
          <RTMModal />

          {needsStart ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-8">
                <div className="font-space-mono font-bold text-[11px] tracking-[.16em] text-text-secondary mb-4 uppercase">
                  Ready to Begin
                </div>
                <h2 className="font-anton text-[48px] leading-none text-text-primary uppercase mb-2">
                  Auction Day
                </h2>
                <p className="font-barlow text-[14px] text-text-secondary mb-8">
                  {auction.sets.reduce((s, set) => s + set.playerIds.length, 0)} players across{" "}
                  {auction.sets.length} sets
                </p>
                <button
                  onClick={startAuction}
                  className="bg-border text-accent font-anton text-[21px] tracking-wide px-10 py-5 hover:bg-black transition-colors"
                >
                  START AUCTION
                </button>
              </div>
            </div>
          ) : auction.currentPlayer ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Player card — scrollable when Player File is expanded */}
              <div className="overflow-y-auto" style={{ maxHeight: "calc(100% - 248px)" }}>
                <PlayerCard player={auction.currentPlayer} />
              </div>
              {/* Bid panel — sits directly below player content, no gap */}
              <BidPanel />
            </div>
          ) : null}
        </div>

        {/* Zone 3: Live Bids — 256px */}
        <div
          className="w-[256px] shrink-0 flex flex-col overflow-hidden"
          style={{ borderLeft: "2px solid #16130f" }}
        >
          <BidHistory />
        </div>

        {/* Zone 4: Your Squad — 264px */}
        <div
          className="w-[264px] shrink-0 flex flex-col overflow-hidden"
          style={{ borderLeft: "2px solid #16130f" }}
        >
          <UserSquad />
        </div>
      </div>

      {/* Player list popup */}
      {activePopup && (
        <PlayerListPopup type={activePopup} onClose={() => setActivePopup(null)} />
      )}
    </div>
  );
}

function AuctionComplete() {
  const { teams, players, userTeamId } = useGameStore();
  const userTeam = teams[userTeamId];

  const roleGroups = [
    { label: "Wicketkeepers", roles: ["WK-Batsman"] },
    { label: "Batters", roles: ["Batsman"] },
    { label: "All-Rounders", roles: ["All-Rounder"] },
    { label: "Pace Bowlers", roles: ["Pace Bowler"] },
    { label: "Spin Bowlers", roles: ["Spin Bowler"] },
  ];

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="mb-8 text-center">
          <div className="font-space-mono font-bold text-[10px] tracking-[.16em] text-success mb-3 uppercase">
            Auction Complete
          </div>
          <h1 className="font-anton text-[52px] leading-none text-text-primary uppercase mb-2">
            {userTeam?.name}
          </h1>
          <p className="font-barlow text-[14px] text-text-secondary">
            {userTeam?.squad.length} players signed
          </p>
        </div>

        <div style={{ border: "2px solid #16130f" }}>
          <div className="bg-border px-6 py-4">
            <span className="font-space-mono font-bold text-[11px] tracking-widest text-accent uppercase">
              Final Squad
            </span>
          </div>
          <div>
            {roleGroups.map(({ label, roles }) => {
              const group = userTeam?.squad
                .map((id) => players[id])
                .filter((p) => p && roles.includes(p.role)) ?? [];
              if (group.length === 0) return null;
              return (
                <div key={label}>
                  <div className="px-4 py-2 bg-surface" style={{ borderTop: "1px solid rgba(22,19,15,.2)" }}>
                    <span className="font-space-mono text-[9px] tracking-widest text-text-secondary uppercase">
                      {label}
                    </span>
                  </div>
                  {group.map((p) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center px-4 py-2"
                      style={{ borderBottom: "1px solid rgba(22,19,15,.1)" }}
                    >
                      <span className="font-barlow font-semibold text-[13px] text-text-primary">{p.name}</span>
                      <div className="flex items-center gap-3">
                        {p.nationality === "Overseas" && (
                          <span className="font-space-mono text-[9px] bg-accent text-border px-2 py-[2px] rounded-[3px] font-bold">
                            OS
                          </span>
                        )}
                        <span className="font-barlow text-[12px] text-text-secondary">Age {p.age}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <div
            className="px-6 py-4 bg-surface flex justify-between items-center"
            style={{ borderTop: "2px solid #16130f" }}
          >
            <span className="font-space-mono text-[10px] text-text-secondary tracking-wider uppercase">
              Remaining Purse
            </span>
            <span className="font-barlow-condensed font-bold text-[20px] text-success">
              ₹{((userTeam?.remainingPurse ?? 0) / 100).toFixed(2)} Cr
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
