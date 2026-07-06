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
import SkipSetSummaryModal from "@/components/auction/SkipSetSummaryModal";

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
            MEGA AUCTION &apos;27
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

          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Active Set Banner */}
            <div
              className="h-[36px] px-6 flex items-center justify-between shrink-0 bg-surface text-[#16130f]"
              style={{ borderBottom: "2px solid #16130f" }}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-space-mono font-bold text-[9px] tracking-widest uppercase bg-[#16130f] text-white px-2 py-0.5 rounded-[3px]">
                  SET {auction.currentSetIndex + 1} OF {auction.sets.length}
                </span>
                <span className="font-space-mono font-bold text-[11px] tracking-wider text-text-primary uppercase">
                  {currentSet?.name ? currentSet.name.replace(/^Set \d+:\s*/i, "") : ""}
                </span>
              </div>
            </div>

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
              <>
                {/* Player card — scrollable when Player File is expanded */}
                <div className="overflow-y-auto" style={{ maxHeight: "calc(100% - 280px)" }}>
                  <PlayerCard player={auction.currentPlayer} />
                </div>
                {/* Bid panel — sits directly below player content, no gap */}
                <BidPanel />
              </>
            ) : null}
          </div>
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
          className="w-[264px] shrink-0 flex flex-col relative z-30"
          style={{ borderLeft: "2px solid #16130f" }}
        >
          <UserSquad />
        </div>
      </div>

      {/* Player list popup */}
      {activePopup && (
        <PlayerListPopup type={activePopup} onClose={() => setActivePopup(null)} />
      )}

      {/* Skip set summary overlay */}
      <SkipSetSummaryModal />
    </div>
  );
}

const ROLE_GROUPS = [
  { label: "WK", roles: ["WK-Batsman"] },
  { label: "BAT", roles: ["Batsman"] },
  { label: "AR", roles: ["All-Rounder"] },
  { label: "PACE", roles: ["Pace Bowler"] },
  { label: "SPIN", roles: ["Spin Bowler"] },
] as const;

function playerRating(p: { currentBatting?: number; currentBowling?: number }) {
  return Math.max(p.currentBatting ?? 0, p.currentBowling ?? 0);
}

function selectPotentialLineup(squad: import("@/lib/types").Player[]): import("@/lib/types").Player[] {
  if (squad.length === 0) return [];

  // Map players to virtual roles for potential XII selection purposes
  const virtualSquad = squad.map(p => {
    let role = p.role;
    if (p.role === "All-Rounder") {
      const bat = p.currentBatting ?? 0;
      const bowl = p.currentBowling ?? 0;
      if (bowl >= bat + 10) {
        const isSpin = !!(
          p.bowlingStyle?.toLowerCase().includes("spin") ||
          p.bowlingStyle?.toLowerCase().includes("orthodox") ||
          p.bowlingStyle?.toLowerCase().includes("spinner") ||
          p.bowlingStyle?.toLowerCase().includes("off-break") ||
          p.bowlingStyle?.toLowerCase().includes("leg-break")
        );
        role = isSpin ? "Spin Bowler" : "Pace Bowler";
      } else if (bat >= bowl + 10) {
        role = "Batsman";
      }
    }
    return { ...p, role };
  });

  // Helper rating function
  const rating = (p: import("@/lib/types").Player) => Math.max(p.currentBatting ?? 0, p.currentBowling ?? 0);
  const isKeeper = (p: import("@/lib/types").Player) => !!(p.isWicketkeeper || p.isPartTimeWk || p.role === "WK-Batsman");
  const isOutAndOut = (p: import("@/lib/types").Player) => p.role === "Pace Bowler" || p.role === "Spin Bowler";
  const isSpinner = (p: import("@/lib/types").Player) => {
    if (p.role === "Spin Bowler") return true;
    const isSpinStyle = !!(
      p.bowlingStyle?.toLowerCase().includes("spin") ||
      p.bowlingStyle?.toLowerCase().includes("orthodox") ||
      p.bowlingStyle?.toLowerCase().includes("spinner") ||
      p.bowlingStyle?.toLowerCase().includes("off-break") ||
      p.bowlingStyle?.toLowerCase().includes("leg-break")
    );
    return isSpinStyle;
  };

  let selected: import("@/lib/types").Player[] = [];
  let remaining = [...virtualSquad];

  const countOS = (list: import("@/lib/types").Player[]) => list.filter(p => p.nationality === "Overseas").length;
  const countOutAndOut = (list: import("@/lib/types").Player[]) => list.filter(isOutAndOut).length;
  const countPacers = (list: import("@/lib/types").Player[]) => list.filter(p => p.role === "Pace Bowler").length;

  const hasEliteARBowler = squad.some(p => p.role === "All-Rounder" && (p.currentBowling ?? 0) >= 80);
  const maxPacers = hasEliteARBowler ? 4 : 5;

  // 1. Select 2 Openers
  const openersPool = remaining
    .filter(p => p.isOpener)
    .sort((a, b) => rating(b) - rating(a));

  const chosenOpeners: import("@/lib/types").Player[] = [];
  for (const op of openersPool) {
    if (chosenOpeners.length >= 2) break;
    const isOS = op.nationality === "Overseas";
    const nextOSCount = countOS(chosenOpeners) + (isOS ? 1 : 0);
    const nextOutAndOut = countOutAndOut(chosenOpeners) + (isOutAndOut(op) ? 1 : 0);
    const nextPacers = countPacers(chosenOpeners) + (op.role === "Pace Bowler" ? 1 : 0);
    if (nextOSCount <= 4 && nextOutAndOut <= 5 && nextPacers <= maxPacers) {
      chosenOpeners.push(op);
    }
  }

  // If we don't have 2 openers, fill with the highest rated non-openers (as fallbacks)
  const remainingNonOpeners = remaining
    .filter(p => !chosenOpeners.some(o => o.id === p.id))
    .sort((a, b) => rating(b) - rating(a));

  while (chosenOpeners.length < 2 && remainingNonOpeners.length > 0) {
    const nextOpener = remainingNonOpeners.shift()!;
    const isOS = nextOpener.nationality === "Overseas";
    const nextOSCount = countOS(chosenOpeners) + (isOS ? 1 : 0);
    const nextOutAndOut = countOutAndOut(chosenOpeners) + (isOutAndOut(nextOpener) ? 1 : 0);
    const nextPacers = countPacers(chosenOpeners) + (nextOpener.role === "Pace Bowler" ? 1 : 0);
    if (nextOSCount <= 4 && nextOutAndOut <= 5 && nextPacers <= maxPacers) {
      chosenOpeners.push(nextOpener);
    }
  }

  // Add chosen openers to selected list and remove from remaining pool
  for (const op of chosenOpeners) {
    selected.push(op);
    remaining = remaining.filter(p => p.id !== op.id);
  }

  // Filter out any "Only Opener" / benched players who weren't selected as openers
  remaining = remaining.filter(p => !p.onlyOpensOrBenched);

  // 2. Select 1 Wicketkeeper (if not already selected in the openers)
  const keeperAlreadySelected = selected.some(isKeeper);
  if (!keeperAlreadySelected) {
    const keeperPool = remaining
      .filter(isKeeper)
      .sort((a, b) => rating(b) - rating(a));

    for (const keeper of keeperPool) {
      const isOS = keeper.nationality === "Overseas";
      const nextOSCount = countOS(selected) + (isOS ? 1 : 0);
      const nextOutAndOut = countOutAndOut(selected) + (isOutAndOut(keeper) ? 1 : 0);
      const nextPacers = countPacers(selected) + (keeper.role === "Pace Bowler" ? 1 : 0);
      if (nextOSCount <= 4 && nextOutAndOut <= 5 && nextPacers <= maxPacers) {
        selected.push(keeper);
        remaining = remaining.filter(p => p.id !== keeper.id);
        break;
      }
    }
  }

  // Ensure at least one spin bowler is selected as part of the proactive bowler minimums
  const hasSpinBowler = selected.some(isSpinner);
  if (!hasSpinBowler && virtualSquad.some(isSpinner)) {
    const spinPool = remaining
      .filter(isSpinner)
      .sort((a, b) => (b.currentBowling ?? 0) - (a.currentBowling ?? 0));

    for (const spin of spinPool) {
      if (selected.length >= 12) break;
      const isOS = spin.nationality === "Overseas";
      const nextOSCount = countOS(selected) + (isOS ? 1 : 0);
      const nextOutAndOut = countOutAndOut(selected) + (isOutAndOut(spin) ? 1 : 0);
      const nextPacers = countPacers(selected) + (spin.role === "Pace Bowler" ? 1 : 0);
      if (nextOSCount <= 4 && nextOutAndOut <= 5 && nextPacers <= maxPacers) {
        selected.push(spin);
        remaining = remaining.filter(p => p.id !== spin.id);
        break;
      }
    }
  }

  // 3. Add bowlers to meet minimum requirements (4 rated >75, 5th rated >70)
  const getBowling75Count = (list: import("@/lib/types").Player[]) => list.filter(p => (p.currentBowling ?? 0) > 75).length;
  const getBowling70Count = (list: import("@/lib/types").Player[]) => list.filter(p => (p.currentBowling ?? 0) > 70).length;

  // Proactively select >75 bowlers
  const bowlers75Pool = remaining
    .filter(p => (p.currentBowling ?? 0) > 75)
    .sort((a, b) => (b.currentBowling ?? 0) - (a.currentBowling ?? 0));

  for (const bowler of bowlers75Pool) {
    if (getBowling75Count(selected) >= 4) break;
    if (selected.length >= 12) break;
    const isOS = bowler.nationality === "Overseas";
    const nextOSCount = countOS(selected) + (isOS ? 1 : 0);
    const nextOutAndOut = countOutAndOut(selected) + (isOutAndOut(bowler) ? 1 : 0);
    const nextPacers = countPacers(selected) + (bowler.role === "Pace Bowler" ? 1 : 0);
    if (nextOSCount <= 4 && nextOutAndOut <= 5 && nextPacers <= maxPacers) {
      selected.push(bowler);
      remaining = remaining.filter(p => p.id !== bowler.id);
    }
  }

  // Proactively select >70 bowlers to reach at least 5 bowlers rated >70
  const bowlers70Pool = remaining
    .filter(p => (p.currentBowling ?? 0) > 70)
    .sort((a, b) => (b.currentBowling ?? 0) - (a.currentBowling ?? 0));

  for (const bowler of bowlers70Pool) {
    if (getBowling70Count(selected) >= 5) break;
    if (selected.length >= 12) break;
    const isOS = bowler.nationality === "Overseas";
    const nextOSCount = countOS(selected) + (isOS ? 1 : 0);
    const nextOutAndOut = countOutAndOut(selected) + (isOutAndOut(bowler) ? 1 : 0);
    const nextPacers = countPacers(selected) + (bowler.role === "Pace Bowler" ? 1 : 0);
    if (nextOSCount <= 4 && nextOutAndOut <= 5 && nextPacers <= maxPacers) {
      selected.push(bowler);
      remaining = remaining.filter(p => p.id !== bowler.id);
    }
  }

  // 4. Fill the remaining spots up to 12 greedily with the highest-rated players, respecting the 4 OS limit and limits on bowlers/pacers
  remaining.sort((a, b) => rating(b) - rating(a));

  for (const p of remaining) {
    if (selected.length >= 12) break;
    const isOS = p.nationality === "Overseas";
    const nextOSCount = countOS(selected) + (isOS ? 1 : 0);
    const nextOutAndOut = countOutAndOut(selected) + (isOutAndOut(p) ? 1 : 0);
    const nextPacers = countPacers(selected) + (p.role === "Pace Bowler" ? 1 : 0);
    if (nextOSCount <= 4 && nextOutAndOut <= 5 && nextPacers <= maxPacers) {
      selected.push(p);
    }
  }

  // 5. Force-fill to 12 if squad has 12+ players but OS limit or bowler limit blocked us
  if (selected.length < 12 && squad.length >= 12) {
    const leftover = squad.filter(p => !selected.some(s => s.id === p.id)).sort((a, b) => rating(b) - rating(a));
    for (const p of leftover) {
      if (selected.length >= 12) break;
      selected.push(p);
    }
  }

  // --- SMART OVERSEAS / SUB-75 REPLACEMENT RULE ---
  if (selected.length === 12) {
    const under75Players = selected
      .filter(p => rating(p) < 75)
      .sort((a, b) => rating(a) - rating(b)); // replace lowest first

    for (const targetPlayer of under75Players) {
      const bench = virtualSquad.filter(p => !selected.some(s => s.id === p.id));
      
      // Find highest-rated overseas player on the bench who is better than targetPlayer
      const overseasBenchCandidates = bench
        .filter(p => p.nationality === "Overseas" && rating(p) > rating(targetPlayer))
        .sort((a, b) => rating(b) - rating(a));

      if (overseasBenchCandidates.length === 0) continue;
      const overseasBenchPlayer = overseasBenchCandidates[0];

      // Identify the 4 overseas players currently in the team
      const currentOSList = selected.filter(p => p.nationality === "Overseas");
      const swapCandidates: {
        osPlayer: import("@/lib/types").Player;
        counterpart: import("@/lib/types").Player;
        diff: number;
      }[] = [];

      for (const osPlayer of currentOSList) {
        let counterpart: import("@/lib/types").Player | undefined;
        let diff = 999;

        const indianBench = bench.filter(p => p.nationality === "Indian");

        if (osPlayer.role === "Batsman") {
          const matchingRoleBench = indianBench.filter(p => p.role === "Batsman");
          if (matchingRoleBench.length > 0) {
            // closest in currentBatting
            const sorted = matchingRoleBench.sort((a, b) => 
              Math.abs((a.currentBatting ?? 0) - (osPlayer.currentBatting ?? 0)) - 
              Math.abs((b.currentBatting ?? 0) - (osPlayer.currentBatting ?? 0))
            );
            counterpart = sorted[0];
            diff = (osPlayer.currentBatting ?? 0) - (counterpart.currentBatting ?? 0);
          }
        } else if (isKeeper(osPlayer)) {
          const matchingRoleBench = indianBench.filter(isKeeper);
          if (matchingRoleBench.length > 0) {
            const sorted = matchingRoleBench.sort((a, b) => 
              Math.abs((a.currentBatting ?? 0) - (osPlayer.currentBatting ?? 0)) - 
              Math.abs((b.currentBatting ?? 0) - (osPlayer.currentBatting ?? 0))
            );
            counterpart = sorted[0];
            diff = (osPlayer.currentBatting ?? 0) - (counterpart.currentBatting ?? 0);
          }
        } else if (isSpinner(osPlayer)) {
          const matchingRoleBench = indianBench.filter(isSpinner);
          if (matchingRoleBench.length > 0) {
            const sorted = matchingRoleBench.sort((a, b) => 
              Math.abs((a.currentBowling ?? 0) - (osPlayer.currentBowling ?? 0)) - 
              Math.abs((b.currentBowling ?? 0) - (osPlayer.currentBowling ?? 0))
            );
            counterpart = sorted[0];
            diff = (osPlayer.currentBowling ?? 0) - (counterpart.currentBowling ?? 0);
          }
        } else if (osPlayer.role === "Pace Bowler") {
          const matchingRoleBench = indianBench.filter(p => p.role === "Pace Bowler");
          if (matchingRoleBench.length > 0) {
            const sorted = matchingRoleBench.sort((a, b) => 
              Math.abs((a.currentBowling ?? 0) - (osPlayer.currentBowling ?? 0)) - 
              Math.abs((b.currentBowling ?? 0) - (osPlayer.currentBowling ?? 0))
            );
            counterpart = sorted[0];
            diff = (osPlayer.currentBowling ?? 0) - (counterpart.currentBowling ?? 0);
          }
        } else if (osPlayer.role === "All-Rounder") {
          const matchingRoleBench = indianBench.filter(p => p.role === "All-Rounder");
          if (matchingRoleBench.length > 0) {
            const osSum = (osPlayer.currentBatting ?? 0) + (osPlayer.currentBowling ?? 0);
            const sorted = matchingRoleBench.sort((a, b) => {
              const aSum = (a.currentBatting ?? 0) + (a.currentBowling ?? 0);
              const bSum = (b.currentBatting ?? 0) + (b.currentBowling ?? 0);
              return Math.abs(aSum - osSum) - Math.abs(bSum - osSum);
            });
            counterpart = sorted[0];
            const cpSum = (counterpart.currentBatting ?? 0) + (counterpart.currentBowling ?? 0);
            diff = osSum - cpSum;
          }
        }

        if (counterpart && diff <= 3) {
          swapCandidates.push({ osPlayer, counterpart, diff });
        }
      }

      if (swapCandidates.length > 0) {
        // Sort based on tiebreaker rules:
        // 1. Smallest difference (diff ascending)
        // 2. Keep highest rated overseas player in the team (so swap out the lower rated one -> rating ascending)
        // 3. Keep overseas player with higher salary (so swap out the lower salary one -> iplHistory price ascending)
        // 4. Keep player with higher reputation (reputation ascending)
        // 5. Choose randomly
        swapCandidates.sort((a, b) => {
          if (a.diff !== b.diff) return a.diff - b.diff;

          const rA = rating(a.osPlayer);
          const rB = rating(b.osPlayer);
          if (rA !== rB) return rA - rB; // swap out the lower rated first

          const getPrice = (p: import("@/lib/types").Player) => 
            p.iplHistory && p.iplHistory.length > 0 ? p.iplHistory[p.iplHistory.length - 1].price : p.basePrice;
          const pA = getPrice(a.osPlayer);
          const pB = getPrice(b.osPlayer);
          if (pA !== pB) return pA - pB; // swap out the lower price first

          const repA = a.osPlayer.reputation ?? 0;
          const repB = b.osPlayer.reputation ?? 0;
          if (repA !== repB) return repA - repB; // swap out the lower reputation first

          return Math.random() - 0.5;
        });

        const bestSwap = swapCandidates[0];
        
        // Execute swaps in selected array
        selected = selected.map(p => p.id === bestSwap.osPlayer.id ? bestSwap.counterpart : p);
        selected = selected.map(p => p.id === targetPlayer.id ? overseasBenchPlayer : p);
        break; // Swap executed, stop.
      }
    }
  }

  // --- LINEUP ORDERING BLOCK ---
  const getBatRating = (p: import("@/lib/types").Player) => p.currentBatting ?? 0;
  const getBowlRating = (p: import("@/lib/types").Player) => p.currentBowling ?? 0;

  // Helper to check position preference
  const prefersPosition = (p: import("@/lib/types").Player, pos: number): boolean => {
    if (pos === 3) return !!p.hasBattedAt3;
    if (pos === 4) return !!p.hasBattedAt4;
    if (pos === 5) return !!p.hasBattedAt5;
    if (pos === 6) return !!p.hasBattedAt6;
    if (pos === 7) return !!p.hasBattedAt7;
    return false;
  };

  // Reusable assignment function starting from a specific position downwards
  const assignLineupFrom = (
    startPos: number,
    currentLineup: import("@/lib/types").Player[],
    pool: import("@/lib/types").Player[]
  ): import("@/lib/types").Player[] => {
    let unassigned = [...pool];
    const lineup = [...currentLineup];
    let currentPos = startPos;

    // 2. Core Batters (Positions startPos downwards, up to position 7)
    while (currentPos <= 7) {
      const corePool = unassigned.filter(p => 
        p.isCoreBatter && 
        !p.isFinisher && 
        (p.role === "Batsman" || p.role === "WK-Batsman" || p.role === "All-Rounder")
      );

      if (corePool.length === 0) break;

      const matchingPref = corePool.filter(p => prefersPosition(p, currentPos));
      let chosen: import("@/lib/types").Player;
      if (matchingPref.length > 0) {
        chosen = matchingPref.sort((a, b) => getBatRating(b) - getBatRating(a))[0];
      } else {
        chosen = corePool.sort((a, b) => getBatRating(b) - getBatRating(a))[0];
      }

      lineup.push(chosen);
      unassigned = unassigned.filter(p => p.id !== chosen.id);
      currentPos++;
    }

    // 3. Finishers (Continuing from currentPos down to position 7)
    while (currentPos <= 7) {
      const finishersPool = unassigned.filter(p => p.isFinisher);

      if (finishersPool.length === 0) break;

      const matchingPref = finishersPool.filter(p => prefersPosition(p, currentPos));
      let chosen: import("@/lib/types").Player;
      if (matchingPref.length > 0) {
        chosen = matchingPref.sort((a, b) => getBatRating(b) - getBatRating(a))[0];
      } else {
        chosen = finishersPool.sort((a, b) => getBatRating(b) - getBatRating(a))[0];
      }

      lineup.push(chosen);
      unassigned = unassigned.filter(p => p.id !== chosen.id);
      currentPos++;
    }

    // 4. Remaining players after Position 7
    const hasBatting = unassigned.filter(p => getBatRating(p) > 0)
      .sort((a, b) => getBatRating(b) - getBatRating(a));

    const zeroBatting = unassigned.filter(p => getBatRating(p) <= 0)
      .sort((a, b) => getBowlRating(a) - getBowlRating(b)); // lowest to highest bowling

    const finalRemainder = [...hasBatting, ...zeroBatting];
    lineup.push(...finalRemainder);

    return lineup;
  };

  // Generate initial draft lineup
  const initialOpeners: import("@/lib/types").Player[] = [];
  let draftUnassigned = [...selected];

  // 1. Openers (Positions 1 & 2)
  const openersList = draftUnassigned
    .filter(p => p.isOpener)
    .sort((a, b) => getBatRating(b) - getBatRating(a));

  for (const op of openersList) {
    if (initialOpeners.length >= 2) break;
    initialOpeners.push(op);
  }

  const remainingSortedByBat = [...draftUnassigned]
    .filter(p => !initialOpeners.some(f => f.id === p.id))
    .sort((a, b) => getBatRating(b) - getBatRating(a));

  while (initialOpeners.length < 2 && remainingSortedByBat.length > 0) {
    initialOpeners.push(remainingSortedByBat.shift()!);
  }

  for (const op of initialOpeners) {
    draftUnassigned = draftUnassigned.filter(p => p.id !== op.id);
  }

  // Construct initial lineup
  let finalLineup = assignLineupFrom(3, initialOpeners, draftUnassigned);

  // --- POST-SELECTION SWAP RULE FOR POSITIONS 3 & 4 (MAX ONCE, PURE BATTERS ONLY) ---
  let swapDone = false;
  let targetIdx = -1;
  let chosenFinisher: import("@/lib/types").Player | null = null;

  // Evaluate Position 3 (index 2) eligibility
  let pos3Eligible = false;
  let pos3BestFinisher: import("@/lib/types").Player | null = null;
  if (finalLineup[2] && (finalLineup[2].currentBatting ?? 0) < 78) {
    const currentRating = finalLineup[2].currentBatting ?? 0;
    const candidates = finalLineup.slice(3).filter(p => 
      p.isFinisher && 
      p.role === "Batsman" && 
      p.hasBattedAt3 && 
      (p.currentBatting ?? 0) > currentRating
    );
    if (candidates.length > 0) {
      pos3Eligible = true;
      pos3BestFinisher = candidates.sort((a, b) => getBatRating(b) - getBatRating(a))[0];
    }
  }

  // Evaluate Position 4 (index 3) eligibility
  let pos4Eligible = false;
  let pos4BestFinisher: import("@/lib/types").Player | null = null;
  if (finalLineup[3] && (finalLineup[3].currentBatting ?? 0) < 78) {
    const currentRating = finalLineup[3].currentBatting ?? 0;
    const candidates = finalLineup.slice(4).filter(p => 
      p.isFinisher && 
      p.role === "Batsman" && 
      p.hasBattedAt4 && 
      (p.currentBatting ?? 0) > currentRating
    );
    if (candidates.length > 0) {
      pos4Eligible = true;
      pos4BestFinisher = candidates.sort((a, b) => getBatRating(b) - getBatRating(a))[0];
    }
  }

  // If both are eligible, perform swap on the lowest rated first
  if (pos3Eligible && pos4Eligible) {
    const r3 = finalLineup[2].currentBatting ?? 0;
    const r4 = finalLineup[3].currentBatting ?? 0;
    if (r3 <= r4) {
      targetIdx = 2; // Position 3
      chosenFinisher = pos3BestFinisher;
    } else {
      targetIdx = 3; // Position 4
      chosenFinisher = pos4BestFinisher;
    }
    swapDone = true;
  } else if (pos3Eligible) {
    targetIdx = 2;
    chosenFinisher = pos3BestFinisher;
    swapDone = true;
  } else if (pos4Eligible) {
    targetIdx = 3;
    chosenFinisher = pos4BestFinisher;
    swapDone = true;
  }

  // Execute the swap and re-run assignment for downstream spots
  if (swapDone && chosenFinisher && targetIdx !== -1) {
    // Lock openers and the promoted finisher at targetIdx
    const lockedLineup: import("@/lib/types").Player[] = [];
    for (let i = 0; i < targetIdx; i++) {
      lockedLineup.push(finalLineup[i]);
    }
    lockedLineup.push(chosenFinisher);

    // Remaining pool is total selected minus locked players
    const lockedIds = new Set(lockedLineup.map(l => l.id));
    const remainingPool = selected.filter(p => !lockedIds.has(p.id));

    // Reassign all spots below targetIdx
    finalLineup = assignLineupFrom(targetIdx + 1, lockedLineup, remainingPool);
  }

  // Map back to the original squad players (restoring their real roles for UI purposes)
  const mappedLineup = finalLineup.map(vp => squad.find(s => s.id === vp.id)!);

  // --- END OF DECISION SWAP FOR PURE BATTER AT POSITION 8 ---
  // Position 8 corresponds to index 7
  if (mappedLineup[7] && mappedLineup[7].role === "Batsman") {
    // Check 1: Swap with index 6 if it's an All-Rounder
    if (mappedLineup[6] && mappedLineup[6].role === "All-Rounder") {
      const temp = mappedLineup[7];
      mappedLineup[7] = mappedLineup[6];
      mappedLineup[6] = temp;

      // Check 2: Swap with index 5 if it's an All-Rounder
      if (mappedLineup[5] && mappedLineup[5].role === "All-Rounder") {
        const temp2 = mappedLineup[6];
        mappedLineup[6] = mappedLineup[5];
        mappedLineup[5] = temp2;
      }
    }
  }

  return mappedLineup;
}


function TeamSquadCard({
  team,
  players,
  isUser,
  positionIndex,
}: {
  team: import("@/lib/types").Team;
  players: Record<string, import("@/lib/types").Player>;
  isUser: boolean;
  positionIndex: number;
}) {
  const squad = Array.from(new Set(team.squad)).map((id) => players[id]).filter(Boolean);
  const overseas = squad.filter((p) => p.nationality === "Overseas").length;
  const lineup = selectPotentialLineup(squad);

  // Find the primary wicketkeeper (highest rated keeper in the lineup)
  const isKeeperRole = (p: import("@/lib/types").Player) =>
    !!(p.isWicketkeeper || p.isPartTimeWk || p.role === "WK-Batsman");
  const wkCandidates = lineup.filter(isKeeperRole).sort((a, b) => playerRating(b) - playerRating(a));
  const primaryWkId = wkCandidates[0]?.id;

  // Find the captain (highest captaincy rating, tiebreaker overall rating)
  const captainCandidates = [...lineup].sort((a, b) => {
    const capDiff = (b.captaincy ?? 0) - (a.captaincy ?? 0);
    if (capDiff !== 0) return capDiff;
    return playerRating(b) - playerRating(a);
  });
  const captainId = captainCandidates[0]?.id;

  // Left vs Right layout variables
  const isLeftCol = positionIndex % 2 === 0;

  return (
    <div className="relative flex flex-col items-stretch gap-y-4 lg:gap-y-0">
      {/* Main Squad Card (Takes full column width) */}
      <div
        style={{ border: isUser ? "3px solid #16130f" : "2px solid #16130f" }}
        className="w-full flex flex-col bg-surface2 z-0 relative"
      >
        {/* Team header — franchise colours */}
        <div
          className="px-4 py-3 flex items-center justify-between shrink-0"
          style={{ backgroundColor: team.primaryColor, color: team.secondaryColor, borderBottom: "2px solid #16130f" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ backgroundColor: team.secondaryColor, color: team.primaryColor }}
            >
              {team.shortName.slice(0, 3)}
            </div>
            <span className="font-anton text-[16px] leading-none uppercase tracking-wide truncate">
              {team.name}
            </span>
            {isUser && (
              <span className="font-space-mono font-bold text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded shrink-0"
                style={{ backgroundColor: "rgba(0,0,0,0.22)", color: team.secondaryColor }}>
                YOU
              </span>
            )}
          </div>
          <span className="font-anton text-[16px] shrink-0">{squad.length}</span>
        </div>

        {/* Stat strip */}
        <div className="flex items-stretch text-center shrink-0" style={{ borderBottom: "1px solid rgba(22,19,15,.15)" }}>
          {[
            { l: "SPENT", v: `₹${(team.spentAmount / 100).toFixed(1)}Cr` },
            { l: "LEFT", v: `₹${(team.remainingPurse / 100).toFixed(1)}Cr` },
            { l: "OVERSEAS", v: `${overseas}/8` },
          ].map((s, i) => (
            <div key={s.l} className="flex-1 py-2" style={i < 2 ? { borderRight: "1px solid rgba(22,19,15,.12)" } : {}}>
              <div className="font-space-mono text-[8px] tracking-widest text-text-secondary uppercase">{s.l}</div>
              <div className="font-barlow-condensed font-bold text-[15px] text-text-primary leading-tight">{s.v}</div>
            </div>
          ))}
        </div>

        {/* Squad by role group */}
        <div className="p-2.5 space-y-1.5 flex-1 min-w-0">
          {ROLE_GROUPS.map(({ label, roles }) => {
            const group = squad
              .filter((p) => (roles as readonly string[]).includes(p.role))
              .sort((a, b) => playerRating(b) - playerRating(a));
            if (group.length === 0) return null;
            return (
              <div key={label} className="flex gap-2">
                <span className="font-space-mono font-bold text-[9px] tracking-wider text-text-secondary uppercase w-[34px] shrink-0 pt-1">
                  {label}
                </span>
                <div className="flex flex-wrap gap-1 flex-1">
                  {group.map((p) => {
                    const wasRetained = team.retainedPlayers.includes(p.id);
                    const sale = p.iplHistory.find((h) => h.season === "2027");
                    const price = sale?.price ?? p.iplHistory.find((h) => h.season === "2026")?.price;
                    const isRtm = sale?.isRtm;
                    const priceStr = price ? `(₹${(price / 100).toFixed(1)}Cr)` : "";

                    const bgStyle = wasRetained 
                      ? { backgroundColor: `${team.primaryColor}18`, borderColor: team.primaryColor }
                      : { backgroundColor: "rgba(22,19,15,0.05)", borderColor: "rgba(22,19,15,0.1)" };

                    return (
                      <span
                        key={p.id}
                        style={bgStyle}
                        className="font-barlow text-[11px] leading-tight px-1.5 py-0.5 rounded-[3px] border inline-flex items-center gap-1"
                        title={`${p.role} · rating ${playerRating(p)}${wasRetained ? " · retained" : ""}${isRtm ? " · bought via RTM" : ""}`}
                      >
                        <span className="font-semibold text-text-primary">{p.name}</span>
                        <span className="text-text-secondary"> {playerRating(p)}</span>
                        {priceStr && <span className="text-[9px] text-text-secondary font-mono font-medium"> {priceStr}</span>}
                        {isRtm && <span className="text-[7.5px] font-space-mono font-extrabold bg-[#1d55c4]/15 text-[#1d55c4] px-1 rounded-[2px] tracking-wide uppercase leading-none py-0.5">RTM</span>}
                        {p.nationality === "Overseas" && <span className="text-[8px] text-[#1d55c4] font-bold"> OS</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Potential XII Tile */}
      {lineup.length > 0 && (
        <div
          style={{ backgroundColor: "#ffffff" }}
          className={`w-full lg:w-[170px] shrink-0 p-2.5 border-2 border-[#16130f] shadow-xl flex flex-col gap-1.5 transition-all duration-200 lg:hover:-translate-y-1 hover:shadow-2xl z-10
            ${isLeftCol 
              ? "lg:absolute lg:right-full lg:mr-5 lg:top-0 rounded lg:rounded-r-none" 
              : "lg:absolute lg:left-full lg:ml-5 lg:top-0 rounded lg:rounded-l-none"}
          `}
        >
          <div className="font-space-mono text-[8.5px] tracking-widest text-[#16130f] uppercase font-bold border-b border-[#16130f]/15 pb-1 flex items-center justify-between">
            <span>★ Potential XII</span>
            <span className="text-[8px] opacity-75">{lineup.filter(p => p.nationality === "Overseas").length} OS</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {lineup.map((p, idx) => {
              const isWK = p.id === primaryWkId;
              const isCaptain = p.id === captainId;
              return (
                <div key={p.id} className="flex justify-between items-center text-[10px] py-[1px] border-b border-[#16130f]/5 last:border-0 leading-tight">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[8px] font-space-mono text-[#16130f]/50 w-3.5 shrink-0">{idx + 1}</span>
                    <span className="font-medium text-[#16130f] truncate" title={p.name}>
                      {p.name}{isCaptain ? " (C)" : ""}
                    </span>
                    {p.nationality === "Overseas" && <span className="text-[7px] text-[#1d55c4] font-extrabold shrink-0" title="Overseas Player">OS</span>}
                    {isWK && <span className="text-[7px] text-danger font-extrabold shrink-0" title="Wicketkeeper">WK</span>}
                  </div>
                  <span className="font-bold text-[#16130f]/75 text-[8.5px] pl-1 shrink-0">{playerRating(p)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AuctionComplete() {
  const { teams, players, userTeamId } = useGameStore();

  const userTeam = teams[userTeamId];

  // User team first, then the rest by spend (biggest spenders lead)
  const ordered = Object.values(teams).sort((a, b) => {
    if (a.id === userTeamId) return -1;
    if (b.id === userTeamId) return 1;
    return b.spentAmount - a.spentAmount;
  });

  // Calculate sold players in the current auction season
  const soldPlayersList = Object.values(players)
    .filter((p) => p.currentTeamId && p.iplHistory.some((h) => h.season === "2027") && !p.isRetained)
    .map((p) => {
      const sale = p.iplHistory.find((h) => h.season === "2027");
      return {
        player: p,
        teamId: p.currentTeamId!,
        price: sale?.price ?? p.basePrice,
      };
    })
    .sort((a, b) => b.price - a.price);

  const topBuys = soldPlayersList.slice(0, 5);
  const totalSpentAll = Object.values(teams).reduce((acc, t) => acc + t.spentAmount, 0);
  const totalSold = soldPlayersList.length;
  const avgPrice = totalSold > 0 ? (totalSpentAll / totalSold).toFixed(1) : "0.0";

  // User squad details
  const userSquad = userTeam?.squad.map((id) => players[id]).filter(Boolean) || [];
  const userAvgRating = userSquad.length > 0
    ? (userSquad.reduce((acc, p) => acc + playerRating(p), 0) / userSquad.length).toFixed(1)
    : "0.0";
  const userOverseas = userSquad.filter((p) => p.nationality === "Overseas").length;

  return (
    <div className="min-h-screen bg-bg overflow-y-auto">
      <div className="max-w-6xl mx-auto p-8">
        <div className="mb-8 text-center">
          <div className="font-space-mono font-bold text-[10px] tracking-[.16em] text-success mb-2 uppercase">
            Auction Completed
          </div>
          <h1 className="font-anton text-[48px] leading-none text-text-primary uppercase mb-2">
            MEGA AUCTION SUMMARY
          </h1>
          <p className="font-barlow text-[14px] text-text-secondary">
            Simulations completed · Franchise squads finalized for Season &apos;27
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* User Franchise Performance Card */}
          <div className="bg-surface border-2 border-[#16130f] rounded-[8px] p-5 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-2 mb-4">
                {userTeam && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                    style={{ backgroundColor: userTeam.primaryColor, color: userTeam.secondaryColor }}
                  >
                    {userTeam.shortName.slice(0, 3)}
                  </div>
                )}
                <h3 className="font-anton text-[18px] tracking-wide text-text-primary uppercase">
                  YOUR FRANCHISE
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="font-space-mono text-[9px] tracking-widest text-text-secondary uppercase">
                    Spent
                  </div>
                  <div className="font-barlow-condensed font-bold text-[22px] text-text-primary">
                    ₹{((userTeam?.spentAmount ?? 0) / 100).toFixed(2)} Cr
                  </div>
                </div>
                <div>
                  <div className="font-space-mono text-[9px] tracking-widest text-text-secondary uppercase">
                    Purse Left
                  </div>
                  <div className="font-barlow-condensed font-bold text-[22px] text-accent">
                    ₹{((userTeam?.remainingPurse ?? 0) / 100).toFixed(2)} Cr
                  </div>
                </div>
                <div>
                  <div className="font-space-mono text-[9px] tracking-widest text-text-secondary uppercase">
                    Squad Size
                  </div>
                  <div className="font-barlow-condensed font-bold text-[22px] text-text-primary">
                    {userSquad.length} / 25
                  </div>
                </div>
                <div>
                  <div className="font-space-mono text-[9px] tracking-widest text-text-secondary uppercase">
                    Avg Rating
                  </div>
                  <div className="font-barlow-condensed font-bold text-[22px] text-success">
                    {userAvgRating}
                  </div>
                </div>
              </div>
            </div>
            <div className="font-space-mono text-[9px] tracking-wide text-text-secondary border-t border-[#16130f]/10 pt-3">
              Overseas Players: {userOverseas} (Limit 8)
            </div>
          </div>

          {/* League Stats Card */}
          <div className="bg-surface border-2 border-[#16130f] rounded-[8px] p-5 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-anton text-[18px] tracking-wide text-text-primary uppercase">
                  MARKET STATS
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="font-space-mono text-[9px] tracking-widest text-text-secondary uppercase">
                    Total Volume
                  </div>
                  <div className="font-barlow-condensed font-bold text-[22px] text-text-primary">
                    ₹{(totalSpentAll / 100).toFixed(1)} Cr
                  </div>
                </div>
                <div>
                  <div className="font-space-mono text-[9px] tracking-widest text-text-secondary uppercase">
                    Players Sold
                  </div>
                  <div className="font-barlow-condensed font-bold text-[22px] text-text-primary">
                    {totalSold}
                  </div>
                </div>
                <div>
                  <div className="font-space-mono text-[9px] tracking-widest text-text-secondary uppercase">
                    Avg Price
                  </div>
                  <div className="font-barlow-condensed font-bold text-[22px] text-text-primary">
                    ₹{(parseFloat(avgPrice) / 100).toFixed(2)} Cr
                  </div>
                </div>
                <div>
                  <div className="font-space-mono text-[9px] tracking-widest text-text-secondary uppercase">
                    Unsold Lots
                  </div>
                  <div className="font-barlow-condensed font-bold text-[22px] text-danger">
                    {Object.values(players).filter((p) => !p.currentTeamId).length}
                  </div>
                </div>
              </div>
            </div>
            <div className="font-space-mono text-[9px] tracking-wide text-text-secondary border-t border-[#16130f]/10 pt-3">
              Accelerated round deals factored.
            </div>
          </div>

          {/* Top Buys Card */}
          <div className="bg-surface border-2 border-[#16130f] rounded-[8px] p-5 flex flex-col shadow-sm">
            <h3 className="font-anton text-[18px] tracking-wide text-text-primary uppercase mb-3">
              TOP 5 EXPENSIVE BUYS
            </h3>
            <div className="flex-1 flex flex-col justify-center divide-y divide-[#16130f]/10">
              {topBuys.map((buy, idx) => {
                const buyer = teams[buy.teamId];
                return (
                  <div key={buy.player.id} className="py-1.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-space-mono font-bold text-[10px] text-text-secondary">
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-text-primary truncate">{buy.player.name}</span>
                      <span className="font-space-mono text-[8px] bg-[#16130f]/5 px-1.5 py-0.5 rounded text-text-secondary">
                        {buy.player.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                      <span
                        className="font-anton text-[9px] px-1.5 py-0.5 rounded uppercase"
                        style={{ backgroundColor: buyer?.primaryColor, color: buyer?.secondaryColor }}
                      >
                        {buyer?.shortName}
                      </span>
                      <span className="font-bold text-text-primary">
                        ₹{(buy.price / 100).toFixed(2)} Cr
                      </span>
                    </div>
                  </div>
                );
              })}
              {topBuys.length === 0 && (
                <div className="text-center font-space-mono text-[10px] text-text-secondary py-4">
                  No auction sales recorded.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-anton text-[24px] tracking-wide text-text-primary uppercase">
            FINAL FRANCHISE SQUADS
          </h2>
          <div className="font-space-mono text-[10px] text-text-secondary">
            ® = Retained · OS = Overseas · Rating = Peak skill
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-10 gap-x-16">
          {ordered.map((team, idx) => (
            <TeamSquadCard
              key={team.id}
              team={team}
              players={players}
              isUser={team.id === userTeamId}
              positionIndex={idx}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
