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
  const hasOkARBowlers = squad.filter(p => p.role === "All-Rounder" && (p.currentBowling ?? 0) >= 75).length >= 2;
  const maxPacers = 5;
  // Cap is 3 out-and-out bowlers if the starting lineup has 4+ All-Rounders;
  // otherwise 4 if there's an elite AR bowler (>=80) OR 2+ ok AR bowlers (>=75) in the squad, else 5.
  const getMaxOutAndOut = (lineup: import("@/lib/types").Player[]) => {
    const lineupARCount = lineup.filter(p => p.role === "All-Rounder").length;
    return lineupARCount >= 4 ? 3 : (hasEliteARBowler || hasOkARBowlers ? 4 : 5);
  };

  // 1. Select 2 Openers
  const specialPairs = [
    ["virat-kohli", "phil-salt"],
    ["sunil-narine", "finn-allen"],
    ["yashasvi-jaiswal", "vaibhav-suryavanshi"],
    ["travis-head", "abhishek-sharma"],
    ["shubman-gill", "sai-sudharsan"],
    ["prabhsimran-singh", "priyansh-arya"]
  ];

  const chosenOpeners: import("@/lib/types").Player[] = [];

  const activePair = specialPairs.find(pair =>
    squad.some(p => p.id === pair[0]) && squad.some(p => p.id === pair[1])
  );

  if (activePair) {
    const p1 = virtualSquad.find(p => p.id === activePair[0])!;
    const p2 = virtualSquad.find(p => p.id === activePair[1])!;
    const nextOSCount = (p1.nationality === "Overseas" ? 1 : 0) + (p2.nationality === "Overseas" ? 1 : 0);
    const nextOutAndOut = (isOutAndOut(p1) ? 1 : 0) + (isOutAndOut(p2) ? 1 : 0);
    const nextPacers = (p1.role === "Pace Bowler" ? 1 : 0) + (p2.role === "Pace Bowler" ? 1 : 0);

    if (nextOSCount <= 4 && nextOutAndOut <= getMaxOutAndOut([p1, p2]) && nextPacers <= maxPacers) {
      chosenOpeners.push(p1, p2);
    }
  }

  const openersPool = remaining
    .filter(p => p.isOpener)
    .sort((a, b) => rating(b) - rating(a));

  for (const op of openersPool) {
    if (chosenOpeners.length >= 2) break;
    const isOS = op.nationality === "Overseas";
    const nextOSCount = countOS(chosenOpeners) + (isOS ? 1 : 0);
    const nextOutAndOut = countOutAndOut(chosenOpeners) + (isOutAndOut(op) ? 1 : 0);
    const nextPacers = countPacers(chosenOpeners) + (op.role === "Pace Bowler" ? 1 : 0);
    if (nextOSCount <= 4 && nextOutAndOut <= getMaxOutAndOut([...chosenOpeners, op]) && nextPacers <= maxPacers) {
      chosenOpeners.push(op);
    }
  }

  // If we don't have 2 openers, fill with the highest rated non-openers (as fallbacks)
  let remainingNonOpeners = remaining
    .filter(p => !chosenOpeners.some(o => o.id === p.id))
    .filter(p => p.role === "Batsman" || p.role === "WK-Batsman" || p.role === "All-Rounder")
    .sort((a, b) => rating(b) - rating(a));

  if (remainingNonOpeners.length === 0) {
    remainingNonOpeners = remaining
      .filter(p => !chosenOpeners.some(o => o.id === p.id))
      .sort((a, b) => rating(b) - rating(a));
  }

  while (chosenOpeners.length < 2 && remainingNonOpeners.length > 0) {
    const nextOpener = remainingNonOpeners.shift()!;
    const isOS = nextOpener.nationality === "Overseas";
    const nextOSCount = countOS(chosenOpeners) + (isOS ? 1 : 0);
    const nextOutAndOut = countOutAndOut(chosenOpeners) + (isOutAndOut(nextOpener) ? 1 : 0);
    const nextPacers = countPacers(chosenOpeners) + (nextOpener.role === "Pace Bowler" ? 1 : 0);
    if (nextOSCount <= 4 && nextOutAndOut <= getMaxOutAndOut([...chosenOpeners, nextOpener]) && nextPacers <= maxPacers) {
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

    if (keeperPool.length > 0) {
      let selectedKeeper = keeperPool.find(keeper => {
        const isOS = keeper.nationality === "Overseas";
        const nextOSCount = countOS(selected) + (isOS ? 1 : 0);
        const nextOutAndOut = countOutAndOut(selected) + (isOutAndOut(keeper) ? 1 : 0);
        const nextPacers = countPacers(selected) + (keeper.role === "Pace Bowler" ? 1 : 0);
        return nextOSCount <= 4 && nextOutAndOut <= getMaxOutAndOut([...selected, keeper]) && nextPacers <= maxPacers;
      });

      if (!selectedKeeper) {
        selectedKeeper = keeperPool[0];

        // Resolve violations: swap out an overseas or conflicting player to make space
        const isOS = selectedKeeper.nationality === "Overseas";
        const nextOSCount = countOS(selected) + (isOS ? 1 : 0);
        const nextOutAndOut = countOutAndOut(selected) + (isOutAndOut(selectedKeeper) ? 1 : 0);
        const nextPacers = countPacers(selected) + (selectedKeeper.role === "Pace Bowler" ? 1 : 0);

        const violatesOS = nextOSCount > 4;
        const violatesOutAndOut = nextOutAndOut > getMaxOutAndOut([...selected, selectedKeeper]);
        const violatesPacers = nextPacers > maxPacers;

        if (violatesOS || violatesOutAndOut || violatesPacers) {
          for (let i = 0; i < selected.length; i++) {
            const playerToReplace = selected[i];
            if (isKeeper(playerToReplace)) continue;
            
            const replacementCandidates = remaining.filter(rep => {
              const hypoSelected = selected.map(p => p.id === playerToReplace.id ? rep : p);
              hypoSelected.push(selectedKeeper);
              
              const testOS = countOS(hypoSelected);
              const testOutAndOut = countOutAndOut(hypoSelected);
              const testPacers = countPacers(hypoSelected);
              return testOS <= 4 && testOutAndOut <= getMaxOutAndOut(hypoSelected) && testPacers <= maxPacers;
            }).sort((a, b) => rating(b) - rating(a));

            if (replacementCandidates.length > 0) {
              const bestRep = replacementCandidates[0];
              selected = selected.map(p => p.id === playerToReplace.id ? bestRep : p);
              remaining = remaining.filter(p => p.id !== bestRep.id);
              remaining.push(playerToReplace);
              break;
            }
          }
        }
      }

      selected.push(selectedKeeper);
      remaining = remaining.filter(p => p.id !== selectedKeeper.id);
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
      if (nextOSCount <= 4 && nextOutAndOut <= getMaxOutAndOut([...selected, spin]) && nextPacers <= maxPacers) {
        selected.push(spin);
        remaining = remaining.filter(p => p.id !== spin.id);
        break;
      }
    }
  }

  // Ensure at least 3 out-and-out bowlers are selected (if available in the squad)
  const squadOutAndOutCount = virtualSquad.filter(isOutAndOut).length;
  const targetOutAndOut = Math.min(3, squadOutAndOutCount);
  if (countOutAndOut(selected) < targetOutAndOut) {
    const outAndOutPool = remaining
      .filter(isOutAndOut)
      .sort((a, b) => rating(b) - rating(a));

    for (const bowler of outAndOutPool) {
      if (countOutAndOut(selected) >= targetOutAndOut) break;
      if (selected.length >= 12) break;
      const isOS = bowler.nationality === "Overseas";
      const nextOSCount = countOS(selected) + (isOS ? 1 : 0);
      const nextOutAndOut = countOutAndOut(selected) + (isOutAndOut(bowler) ? 1 : 0);
      const nextPacers = countPacers(selected) + (bowler.role === "Pace Bowler" ? 1 : 0);
      if (nextOSCount <= 4 && nextOutAndOut <= getMaxOutAndOut([...selected, bowler]) && nextPacers <= maxPacers) {
        selected.push(bowler);
        remaining = remaining.filter(p => p.id !== bowler.id);
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
    if (nextOSCount <= 4 && nextOutAndOut <= getMaxOutAndOut([...selected, bowler]) && nextPacers <= maxPacers) {
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
    if (nextOSCount <= 4 && nextOutAndOut <= getMaxOutAndOut([...selected, bowler]) && nextPacers <= maxPacers) {
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
    if (nextOSCount <= 4 && nextOutAndOut <= getMaxOutAndOut([...selected, p]) && nextPacers <= maxPacers) {
      selected.push(p);
    }
  }

  // 5. Force-fill to 12 if squad has 12+ players but OS limit or bowler limit blocked us
  if (selected.length < 12 && squad.length >= 12) {
    const leftover = squad.filter(p => !selected.some(s => s.id === p.id) && !p.onlyOpensOrBenched).sort((a, b) => rating(b) - rating(a));
    for (const p of leftover) {
      if (selected.length >= 12) break;
      selected.push(p);
    }
  }

  // --- SMART OVERSEAS / SUB-78 REPLACEMENT RULE ---
  if (selected.length === 12) {
    const originalBowling70Count = getBowling70Count(selected);
    const under78Players = selected
      .filter(p => rating(p) < 78)
      .sort((a, b) => rating(a) - rating(b)); // replace lowest first

    for (const targetPlayer of under78Players) {
      const bench = virtualSquad.filter(p => !selected.some(s => s.id === p.id) && !p.onlyOpensOrBenched);
      
      // Find highest-rated overseas player on the bench who is better than targetPlayer
      const overseasBenchCandidates = bench
        .filter(p => p.nationality === "Overseas" && rating(p) > rating(targetPlayer))
        .sort((a, b) => rating(b) - rating(a));

      if (overseasBenchCandidates.length === 0) continue;
      const overseasBenchPlayer = overseasBenchCandidates[0];

      // Identify the 4 overseas players currently in the team
      const currentOSList = selected.filter(p => p.nationality === "Overseas");

      // If the XII currently has LESS than 4 Overseas players OR the target player is already Overseas (direct swap), we can replace them!
      if (currentOSList.length < 4 || targetPlayer.nationality === "Overseas") {
        // SAFETY: Do not remove targetPlayer if they are the only keeper in selected
        const isTargetKeeper = isKeeper(targetPlayer);
        const selectedKeepersCount = selected.filter(isKeeper).length;
        const incomingIsKeeper = isKeeper(overseasBenchPlayer);
        
        if (!isTargetKeeper || selectedKeepersCount > 1 || incomingIsKeeper) {
          const hypotheticalSelected = selected.map(p => p.id === targetPlayer.id ? overseasBenchPlayer : p);
          const nextOSCount = countOS(hypotheticalSelected);
          const nextOutAndOut = countOutAndOut(hypotheticalSelected);
          const nextPacers = countPacers(hypotheticalSelected);
          const testBowling70Count = getBowling70Count(hypotheticalSelected);
          const bowlingCountIsSafe = testBowling70Count >= 5 || testBowling70Count >= originalBowling70Count;

          if (nextOSCount <= 4 && nextOutAndOut <= getMaxOutAndOut(hypotheticalSelected) && nextPacers <= maxPacers && bowlingCountIsSafe) {
            selected = hypotheticalSelected;
            break;
          }
        }
      }

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
        } else if (osPlayer.role === "Spin Bowler") {
          const matchingRoleBench = indianBench.filter(p => p.role === "Spin Bowler");
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
          // Check limits on the hypothetical post-swap team configuration
          const hypotheticalSelected = selected.map(p => p.id === osPlayer.id ? counterpart! : p);
          
          // Replace target player with the new overseas bench player in our hypothetical XII
          const postSwapSelected = hypotheticalSelected.map(p => p.id === targetPlayer.id ? overseasBenchPlayer : p);
          
          const nextOSCount = countOS(postSwapSelected);
          const nextOutAndOut = countOutAndOut(postSwapSelected);
          const nextPacers = countPacers(postSwapSelected);
          const testBowling70Count = getBowling70Count(postSwapSelected);
          const bowlingCountIsSafe = testBowling70Count >= 5 || testBowling70Count >= originalBowling70Count;

          if (nextOSCount <= 4 && nextOutAndOut <= getMaxOutAndOut(postSwapSelected) && nextPacers <= maxPacers && bowlingCountIsSafe) {
            swapCandidates.push({ osPlayer, counterpart, diff });
          }
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

        // SAFETY: Loop and find the first swap candidate that doesn't leave the XII without a wicketkeeper
        let bestSwap = null;
        for (const candidate of swapCandidates) {
          const isTargetKeeper = isKeeper(targetPlayer);
          const selectedKeepersCount = selected.filter(isKeeper).length;
          
          // The candidate would swap out `candidate.osPlayer` for `candidate.counterpart` (Indian),
          // AND swap out `targetPlayer` for `overseasBenchPlayer`.
          // We check if this resulting XII will still have a keeper.
          const hypotheticalLineup = selected.map(p => p.id === candidate.osPlayer.id ? candidate.counterpart : p);
          const postSwapLineup = hypotheticalLineup.map(p => p.id === targetPlayer.id ? overseasBenchPlayer : p);
          
          if (postSwapLineup.some(isKeeper)) {
            bestSwap = candidate;
            break;
          }
        }
        
        if (bestSwap) {
          // Execute swaps in selected array
          selected = selected.map(p => p.id === bestSwap.osPlayer.id ? bestSwap.counterpart : p);
          selected = selected.map(p => p.id === targetPlayer.id ? overseasBenchPlayer : p);
          break; // Swap executed, stop.
        }
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

  // ===========================================================================
  // ASSIGNMENT MODE: "SEQUENTIAL" (position-by-position, top-down)
  // To switch back to constraint-based (most-constrained-first), comment out
  // the SEQUENTIAL block below and uncomment the CONSTRAINT-BASED block.
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // SEQUENTIAL MODE (ACTIVE)
  // Goes position 3 → 4 → 5 → 6 → 7 in order.
  // For each slot:
  //   1. Pick the highest-rated player who prefers this slot.
  //   2. If none prefer it, pick the highest-rated player who has NO remaining
  //      preferred slots still open (i.e., all their preferred positions in the
  //      remaining slots have already been filled). This prevents players from
  //      being dumped into slots they can't play when they still have options.
  //   3. If all remaining players still have future preferred slots, skip and
  //      come back at the end (filled greedily then).
  // ---------------------------------------------------------------------------
  // ===========================================================================
  // ASSIGNMENT MODE: "HYBRID" (sequential position-by-position with look-ahead constraint checking)
  // Goes position 3 → 4 → 5 → 6 → 7 in order.
  // For each slot, it:
  //   1. Checks candidates who prefer the slot, sorted by batting rating descending.
  //   2. Performs a look-ahead check: skips a candidate if assigning them leaves
  //      any other remaining player with zero preferred options in the remaining slots.
  //   3. Falls back to rating descending if constraints are satisfied, ensuring
  //      that if both players can play 5 and 7, the higher-rated one lands at 5.
  // ===========================================================================
  const assignLineupFrom = (
    startPos: number,
    currentLineup: import("@/lib/types").Player[],
    pool: import("@/lib/types").Player[]
  ): import("@/lib/types").Player[] => {
    let unassigned = [...pool];
    const lineup = [...currentLineup];

    const getSatisfiableSlots = (p: import("@/lib/types").Player, slots: number[]) =>
      slots.filter(s => prefersPosition(p, s));

    const assignSequentialWithConstraints = (
      slots: number[],
      players: import("@/lib/types").Player[]
    ): Record<number, import("@/lib/types").Player> => {
      const assignments: Record<number, import("@/lib/types").Player> = {};
      let remainingPlayers = [...players];

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const remainingSlots = slots.slice(i + 1);

        // Find all players who prefer this slot
        const candidates = remainingPlayers
          .filter(p => prefersPosition(p, slot))
          .sort((a, b) => getBatRating(b) - getBatRating(a));

        let chosen: import("@/lib/types").Player | undefined = undefined;

        // Try to find a candidate where assigning them doesn't strand any other player
        for (const candidate of candidates) {
          let strandsAnyone = false;
          if (getBatRating(candidate) <= 80) {
            for (const other of remainingPlayers) {
              if (other.id === candidate.id) continue;

              const wasSatisfiable = getSatisfiableSlots(other, slots.slice(i)).length > 0;
              const willBeSatisfiable = getSatisfiableSlots(other, remainingSlots).length > 0;

              if (wasSatisfiable && !willBeSatisfiable) {
                strandsAnyone = true;
                break;
              }
            }
          }

          if (!strandsAnyone) {
            chosen = candidate;
            break;
          }
        }

        // If all candidates would strand someone, or no one prefers this slot,
        // fall back to the highest rated player who prefers this slot
        if (!chosen && candidates.length > 0) {
          chosen = candidates[0];
        }

        // If still no player found, fall back to the highest rated player overall
        if (!chosen && remainingPlayers.length > 0) {
          const sorted = [...remainingPlayers].sort((a, b) => getBatRating(b) - getBatRating(a));
          chosen = sorted[0];
        }

        if (chosen) {
          assignments[slot] = chosen;
          remainingPlayers = remainingPlayers.filter(p => p.id !== chosen.id);
        }
      }

      // Fill remaining empty slots with any unassigned players
      for (const slot of slots) {
        if (!assignments[slot] && remainingPlayers.length > 0) {
          const sorted = [...remainingPlayers].sort((a, b) => getBatRating(b) - getBatRating(a));
          assignments[slot] = sorted[0];
          remainingPlayers = remainingPlayers.filter(p => p.id !== sorted[0].id);
        }
      }

      return assignments;
    };

    // --- PHASE 1: Core Batters (positions startPos → 7) ---
    const corePool = unassigned.filter(p =>
      p.isCoreBatter &&
      !p.isFinisher &&
      (p.role === "Batsman" || p.role === "WK-Batsman" || p.role === "All-Rounder")
    );
    const maxCoreSlots = Math.max(0, 8 - startPos);
    const coreSlotsCount = Math.min(corePool.length, maxCoreSlots);
    const coreSlots = Array.from({ length: coreSlotsCount }, (_, i) => startPos + i);

    const coreAssignments = assignSequentialWithConstraints(coreSlots, corePool);
    const assignedCoreIds = new Set(Object.values(coreAssignments).map(p => p.id));
    unassigned = unassigned.filter(p => !assignedCoreIds.has(p.id));

    let nextPos = startPos + coreSlotsCount;

    // --- PHASE 2: Finishers (positions nextPos → 7) ---
    const finishersPool = unassigned.filter(p => p.isFinisher);
    const maxFinisherSlots = Math.max(0, 8 - nextPos);
    const finisherSlotsCount = Math.min(finishersPool.length, maxFinisherSlots);
    const finisherSlots = Array.from({ length: finisherSlotsCount }, (_, i) => nextPos + i);

    const finisherAssignments = assignSequentialWithConstraints(finisherSlots, finishersPool);
    const assignedFinisherIds = new Set(Object.values(finisherAssignments).map(p => p.id));
    unassigned = unassigned.filter(p => !assignedFinisherIds.has(p.id));

    nextPos += finisherSlotsCount;

    // Push the assignments in order
    for (let pos = startPos; pos < nextPos; pos++) {
      const chosen = coreAssignments[pos] || finisherAssignments[pos];
      if (chosen) {
        lineup.push(chosen);
      }
    }

    // --- PHASE 3: Remaining players after position 7 ---
    const hasBatting = unassigned.filter(p => getBatRating(p) > 0)
      .sort((a, b) => getBatRating(b) - getBatRating(a));
    const zeroBatting = unassigned.filter(p => getBatRating(p) <= 0)
      .sort((a, b) => getBowlRating(a) - getBowlRating(b));

    lineup.push(...hasBatting, ...zeroBatting);
    return lineup;
  };

  // ---------------------------------------------------------------------------
  // CONSTRAINT-BASED MODE (INACTIVE — uncomment to re-enable)
  // Assigns most-constrained players (fewest preferred slots) first.
  // To activate: comment out the SEQUENTIAL block above and uncomment below.
  // ---------------------------------------------------------------------------
  /*
  const assignConstrained = (
    slots: number[],
    players: import("@/lib/types").Player[]
  ): Record<number, import("@/lib/types").Player> => {
    const assignments: Record<number, import("@/lib/types").Player> = {};
    const sortedPlayers = [...players].sort((a, b) => {
      const aPrefCount = slots.filter(s => prefersPosition(a, s)).length;
      const bPrefCount = slots.filter(s => prefersPosition(b, s)).length;
      if (aPrefCount !== bPrefCount) return aPrefCount - bPrefCount;
      return getBatRating(b) - getBatRating(a);
    });
    for (const p of sortedPlayers) {
      let assignedSlot = slots.find(s => prefersPosition(p, s) && !assignments[s]);
      if (assignedSlot === undefined) assignedSlot = slots.find(s => !assignments[s]);
      if (assignedSlot !== undefined) assignments[assignedSlot] = p;
    }
    return assignments;
  };

  const assignLineupFrom = (
    startPos: number,
    currentLineup: import("@/lib/types").Player[],
    pool: import("@/lib/types").Player[]
  ): import("@/lib/types").Player[] => {
    let unassigned = [...pool];
    const lineup = [...currentLineup];
    const corePool = unassigned.filter(p =>
      p.isCoreBatter && !p.isFinisher &&
      (p.role === "Batsman" || p.role === "WK-Batsman" || p.role === "All-Rounder")
    );
    const coreSlotsToFill = Math.min(corePool.length, Math.max(0, 8 - startPos));
    const coreSlots = Array.from({ length: coreSlotsToFill }, (_, i) => startPos + i);
    const coreAssignments = assignConstrained(coreSlots, corePool);
    const assignedCoreIds = new Set(Object.values(coreAssignments).map(p => p.id));
    unassigned = unassigned.filter(p => !assignedCoreIds.has(p.id));
    let nextPos = startPos + coreSlotsToFill;
    const finishersPool = unassigned.filter(p => p.isFinisher);
    const finisherSlotsToFill = Math.min(finishersPool.length, Math.max(0, 8 - nextPos));
    const finisherSlots = Array.from({ length: finisherSlotsToFill }, (_, i) => nextPos + i);
    const finisherAssignments = assignConstrained(finisherSlots, finishersPool);
    const assignedFinisherIds = new Set(Object.values(finisherAssignments).map(p => p.id));
    unassigned = unassigned.filter(p => !assignedFinisherIds.has(p.id));
    nextPos += finisherSlotsToFill;
    for (let pos = startPos; pos < nextPos; pos++) {
      const chosen = coreAssignments[pos] || finisherAssignments[pos];
      if (chosen) lineup.push(chosen);
    }
    const hasBatting = unassigned.filter(p => getBatRating(p) > 0).sort((a, b) => getBatRating(b) - getBatRating(a));
    const zeroBatting = unassigned.filter(p => getBatRating(p) <= 0).sort((a, b) => getBowlRating(a) - getBowlRating(b));
    lineup.push(...hasBatting, ...zeroBatting);
    return lineup;
  };
  */

  // Generate initial draft lineup
  const initialOpeners: import("@/lib/types").Player[] = [];
  let draftUnassigned = [...selected];

  // Check special pairs for forced opening assignment
  const lineupSpecialPairs = [
    ["virat-kohli", "phil-salt"],
    ["sunil-narine", "finn-allen"],
    ["yashasvi-jaiswal", "vaibhav-suryavanshi"],
    ["travis-head", "abhishek-sharma"],
    ["shubman-gill", "sai-sudharsan"],
    ["prabhsimran-singh", "priyansh-arya"]
  ];

  const lineupActivePair = lineupSpecialPairs.find(pair =>
    draftUnassigned.some(p => p.id === pair[0]) && draftUnassigned.some(p => p.id === pair[1])
  );

  if (lineupActivePair) {
    const p1 = draftUnassigned.find(p => p.id === lineupActivePair[0])!;
    const p2 = draftUnassigned.find(p => p.id === lineupActivePair[1])!;
    initialOpeners.push(p1, p2);
  } else {
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

  // --- BENCH ALL-ROUNDER SWAP FOR WEAK BATTER AT POSITION 8 ---
  // If pos 8 has a non-finisher batter rated < 78, try to replace them with the
  // highest-rated bench All-Rounder that satisfies the OS and bowler-cap rules.
  {
    const pos8Weak = mappedLineup[7];
    if (
      pos8Weak &&
      !pos8Weak.isFinisher &&
      (pos8Weak.currentBatting ?? 0) < 78 &&
      (pos8Weak.role === "Batsman" || pos8Weak.role === "WK-Batsman")
    ) {
      const benchARs = squad
        .filter(p => !mappedLineup.some(m => m?.id === p.id) && p.role === "All-Rounder")
        .sort((a, b) =>
          Math.max(b.currentBatting ?? 0, b.currentBowling ?? 0) -
          Math.max(a.currentBatting ?? 0, a.currentBowling ?? 0)
        );

      for (const ar of benchARs) {
        const hypo = [...mappedLineup];
        hypo[7] = ar;
        const nextOSCount = countOS(hypo);
        const nextOutAndOut = countOutAndOut(hypo);
        const nextPacers = countPacers(hypo);
        if (nextOSCount <= 4 && nextOutAndOut <= getMaxOutAndOut(hypo) && nextPacers <= maxPacers) {
          mappedLineup[7] = ar;
          break;
        }
      }
    }
  }

  // --- HIGH-RATED BATTER PROMOTION ---
  // If a non-bowler with currentBatting > 81 ends up at position 8 (index 7),
  // swap them with the lowest batting-rated player in positions 3–7 (indices 2–6),
  // as long as that player's batting rating is lower.
  const pos8Player = mappedLineup[7];
  if (
    pos8Player &&
    !pos8Player.isFinisher &&
    (pos8Player.currentBatting ?? 0) > 81 &&
    pos8Player.role !== "Pace Bowler" &&
    pos8Player.role !== "Spin Bowler"
  ) {
    let lowestIdx = -1;
    let lowestBatRating = pos8Player.currentBatting ?? 0;

    for (let i = 2; i <= 6; i++) {
      const candidate = mappedLineup[i];
      if (!candidate) continue;
      const batR = candidate.currentBatting ?? 0;
      if (batR < lowestBatRating) {
        lowestBatRating = batR;
        lowestIdx = i;
      }
    }

    if (lowestIdx !== -1) {
      const temp = mappedLineup[7];
      mappedLineup[7] = mappedLineup[lowestIdx];
      mappedLineup[lowestIdx] = temp;
    }
  }

  // --- BENCH BATTER UPGRADE FOR WEAK BATTER AT POSITION 8 ---
  // Before trying an AR, check if a bench batter (Batsman/WK-Batsman) can improve
  // position 8. Candidates are sorted by rating desc, tiebroken by battingAggression
  // desc. Only swaps if the candidate is strictly better than the current player
  // (higher rating, or same rating but higher aggression). Falls through to the AR
  // rule below if no eligible upgrade exists.
  {
    const pos8Weak = mappedLineup[7];
    if (
      pos8Weak &&
      !pos8Weak.isFinisher &&
      (pos8Weak.currentBatting ?? 0) < 78 &&
      (pos8Weak.role === "Batsman" || pos8Weak.role === "WK-Batsman")
    ) {
      const currentBatR = pos8Weak.currentBatting ?? 0;
      const currentAgg = pos8Weak.battingAggression ?? 0;
      const currentMaxOO = getMaxOutAndOut(mappedLineup);

      const benchBatters = squad
        .filter(p =>
          !mappedLineup.some(m => m?.id === p.id) &&
          !p.onlyOpensOrBenched &&
          (p.role === "Batsman" || p.role === "WK-Batsman")
        )
        .sort((a, b) => {
          const rDiff = (b.currentBatting ?? 0) - (a.currentBatting ?? 0);
          if (rDiff !== 0) return rDiff;
          return (b.battingAggression ?? 0) - (a.battingAggression ?? 0);
        });

      for (const batter of benchBatters) {
        const benchBatR = batter.currentBatting ?? 0;
        const benchAgg = batter.battingAggression ?? 0;

        // Only upgrade if strictly better; if equal or worse, stop looking
        if (benchBatR < currentBatR) break;
        if (benchBatR === currentBatR && benchAgg <= currentAgg) continue;

        const hypo = [...mappedLineup];
        hypo[7] = batter;
        const nextOSCount = countOS(hypo);
        const nextOutAndOut = countOutAndOut(hypo);
        const nextPacers = countPacers(hypo);
        if (nextOSCount <= 4 && nextOutAndOut <= currentMaxOO && nextPacers <= maxPacers) {
          mappedLineup[7] = batter;
          break;
        }
      }
    }
  }

  // --- BENCH ALL-ROUNDER SWAP FOR WEAK BATTER AT POSITION 8 ---

  // Runs last. If pos 8 still has a non-finisher batter rated < 78, try to replace
  // them with the highest-rated bench All-Rounder that satisfies the OS and bowler-cap
  // rules. The bowler cap is evaluated on the pre-swap lineup so that adding an AR
  // does not retroactively tighten the cap against itself.
  {
    const pos8Weak = mappedLineup[7];
    if (
      pos8Weak &&
      !pos8Weak.isFinisher &&
      (pos8Weak.currentBatting ?? 0) < 78 &&
      (pos8Weak.role === "Batsman" || pos8Weak.role === "WK-Batsman")
    ) {
      const benchARs = squad
        .filter(p => !mappedLineup.some(m => m?.id === p.id) && !p.onlyOpensOrBenched && p.role === "All-Rounder" && Math.max(p.currentBatting ?? 0, p.currentBowling ?? 0) > 74)
        .sort((a, b) =>
          Math.max(b.currentBatting ?? 0, b.currentBowling ?? 0) -
          Math.max(a.currentBatting ?? 0, a.currentBowling ?? 0)
        );

      for (const ar of benchARs) {
        const hypo = [...mappedLineup];
        hypo[7] = ar;
        const nextOSCount = countOS(hypo);
        const nextOutAndOut = countOutAndOut(hypo);
        const nextPacers = countPacers(hypo);
        if (nextOSCount <= 4 && nextOutAndOut <= getMaxOutAndOut(hypo) && nextPacers <= maxPacers) {
          mappedLineup[7] = ar;
          break;
        }
      }
    }
  }

  // --- POSITION 9 (index 8) OUT-AND-OUT BATTER SUBSTITUTE RULE ---
  // If the player at position 9 (index 8) is a pure/out-and-out batter (Batsman or WK-Batsman),
  // substitute them with the highest-rated All-Rounder or Bowler on the bench.
  // Must respect OS limits, out-and-out/pacer limits, and ensure we do not leave the XII without a keeper.
  {
    const pos9Player = mappedLineup[8];
    if (
      pos9Player &&
      (pos9Player.role === "Batsman" || pos9Player.role === "WK-Batsman")
    ) {
      // Find eligible All-Rounders or Bowlers on the bench
      const benchSubstitutes = squad
        .filter(p => 
          !mappedLineup.some(m => m?.id === p.id) && 
          !p.onlyOpensOrBenched && 
          (p.role === "All-Rounder" || p.role === "Pace Bowler" || p.role === "Spin Bowler")
        )
        .sort((a, b) => playerRating(b) - playerRating(a));

      for (const sub of benchSubstitutes) {
        const hypo = [...mappedLineup];
        hypo[8] = sub;

        // Check if substitution retains a keeper in the lineup
        const hasKeeper = hypo.some(isKeeper);
        if (!hasKeeper) continue;

        const nextOSCount = countOS(hypo);
        const nextOutAndOut = countOutAndOut(hypo);
        const nextPacers = countPacers(hypo);

        if (nextOSCount <= 4 && nextOutAndOut <= getMaxOutAndOut(hypo) && nextPacers <= maxPacers) {
          mappedLineup[8] = sub;
          break;
        }
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
                    <span className="text-[8px] font-space-mono text-[#16130f]/50 w-3.5 shrink-0">{idx === 11 ? "I.S." : idx + 1}</span>
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
