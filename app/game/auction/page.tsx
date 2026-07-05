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

  // Patch Virat Kohli to be an opener dynamically for current saves
  squad.forEach(p => {
    if (p.id === "virat-kohli") {
      p.isOpener = true;
    }
  });
  
  const getEffectiveRole = (p: import("@/lib/types").Player): string => {
    if (p.role === "All-Rounder") {
      const bat = p.currentBatting ?? 0;
      const bowl = p.currentBowling ?? 0;
      if (bat - bowl >= 10) {
        return "Batsman";
      }
      if (bowl - bat >= 10) {
        const isSpin = /spin|orthodox/i.test(p.bowlingStyle ?? "");
        return isSpin ? "Spin Bowler" : "Pace Bowler";
      }
    }
    return p.role;
  };

  const isCapableBowler = (p: import("@/lib/types").Player) => {
    const effRole = getEffectiveRole(p);
    return effRole === "Pace Bowler" || effRole === "Spin Bowler" || effRole === "All-Rounder";
  };

  const isKeeper = (p: import("@/lib/types").Player) => 
    !!(p.isWicketkeeper || p.isPartTimeWk || p.role === "WK-Batsman");

  const isSpinner = (p: import("@/lib/types").Player) => {
    const effRole = getEffectiveRole(p);
    return effRole === "Spin Bowler" || (effRole === "All-Rounder" && /spin|orthodox/i.test(p.bowlingStyle ?? ""));
  };

  const isFinisherType = (p: import("@/lib/types").Player) => 
    !!(p.isFinisher || ((p.battingAggression ?? 0) >= 85 && !p.isOpener && (p.currentBatting ?? 0) >= 65));

  let selected: import("@/lib/types").Player[] = [];
  let remaining = [...squad];

  // 1. Select 2 Openers
  let openers = remaining
    .filter(p => p.isOpener)
    .sort((a, b) => playerRating(b) - playerRating(a));
  
  let selectedOpeners: import("@/lib/types").Player[] = [];
  if (openers.length >= 2) {
    selectedOpeners = openers.slice(0, 2);
  } else if (openers.length === 1) {
    selectedOpeners.push(openers[0]);
    const nextBest = remaining
      .filter(p => p.id !== openers[0].id && (getEffectiveRole(p) === "Batsman" || getEffectiveRole(p) === "WK-Batsman"))
      .sort((a, b) => playerRating(b) - playerRating(a))[0];
    if (nextBest) selectedOpeners.push(nextBest);
  } else {
    const bestBatters = remaining
      .filter(p => getEffectiveRole(p) === "Batsman" || getEffectiveRole(p) === "WK-Batsman")
      .sort((a, b) => playerRating(b) - playerRating(a));
    selectedOpeners = bestBatters.slice(0, 2);
  }

  selectedOpeners.forEach(op => {
    selected.push(op);
    remaining = remaining.filter(p => p.id !== op.id);
  });

  // 2. Include the highest rated wicketkeeper (who is not already an opener)
  const bestKeeper = remaining
    .filter(isKeeper)
    .sort((a, b) => playerRating(b) - playerRating(a))[0];
  if (bestKeeper) {
    selected.push(bestKeeper);
    remaining = remaining.filter(p => p.id !== bestKeeper.id);
  }

  // 3. Ensure the highest rated spinner is playing
  const bestSpinner = remaining
    .filter(isSpinner)
    .sort((a, b) => (b.currentBowling ?? 0) - (a.currentBowling ?? 0))[0];
  if (bestSpinner) {
    selected.push(bestSpinner);
    remaining = remaining.filter(p => p.id !== bestSpinner.id);
  }

  // 4. Fill the rest greedily to reach 12 players, adhering to bowler & all-rounder rules
  const countOverseas = () => selected.filter(p => p.nationality === "Overseas").length;
  const countBowlers = () => selected.filter(isCapableBowler).length;
  const countARs = () => selected.filter(p => getEffectiveRole(p) === "All-Rounder").length;

  // Determine if we need a second all-rounder:
  const outAndOutBowlers = squad.filter(p => getEffectiveRole(p) === "Pace Bowler" || getEffectiveRole(p) === "Spin Bowler")
    .sort((a, b) => (b.currentBowling ?? 0) - (a.currentBowling ?? 0));
  const fifthBowler = outAndOutBowlers[4];
  const needSecondAllRounder = !fifthBowler || (fifthBowler.currentBowling ?? 0) < 75;

  // Force at least 1 all-rounder in the selected lineup's bowlers
  if (countARs() < 1) {
    const bestAR = remaining
      .filter(p => getEffectiveRole(p) === "All-Rounder" && countOverseas() + (p.nationality === "Overseas" ? 1 : 0) <= 4)
      .sort((a, b) => playerRating(b) - playerRating(a))[0];
    if (bestAR) {
      selected.push(bestAR);
      remaining = remaining.filter(p => p.id !== bestAR.id);
    }
  }

  // If the 5th out and out bowler is below 75 rated, force a 2nd all-rounder
  if (needSecondAllRounder && countARs() < 2) {
    const bestAR = remaining
      .filter(p => getEffectiveRole(p) === "All-Rounder" && countOverseas() + (p.nationality === "Overseas" ? 1 : 0) <= 4)
      .sort((a, b) => playerRating(b) - playerRating(a))[0];
    if (bestAR) {
      selected.push(bestAR);
      remaining = remaining.filter(p => p.id !== bestAR.id);
    }
  }

  // Now sort the rest and fill greedily
  const countOutAndOut = () => selected.filter(p => {
    const r = getEffectiveRole(p);
    return r === "Pace Bowler" || r === "Spin Bowler";
  }).length;

  remaining.sort((a, b) => playerRating(b) - playerRating(a));

  for (const p of remaining) {
    if (selected.length >= 12) break;

    const isOS = p.nationality === "Overseas" ? 1 : 0;
    const effRole = getEffectiveRole(p);
    const isOutAndOut = effRole === "Pace Bowler" || effRole === "Spin Bowler";
    const currentARs = countARs();
    const currentOutAndOut = countOutAndOut();
    const maxAllowedBowlers = currentARs >= 2 ? 4 : 5;

    if (countOverseas() + isOS <= 4) {
      if (!isOutAndOut || (currentOutAndOut + 1 <= maxAllowedBowlers)) {
        selected.push(p);
      }
    }
  }

  if (selected.length < 12) {
    for (const p of remaining) {
      if (selected.length >= 12) break;
      if (!selected.some(s => s.id === p.id)) {
        selected.push(p);
      }
    }
  }

  // Ensure the remaining pool only has players not already selected in the XII
  remaining = remaining.filter(p => !selected.some(s => s.id === p.id));

  // 5. Post-selection Batter Replacement Rule:
  // If an all-rounder in the remaining pool has a higher or equal batting rating than a selected out-and-out batter,
  // we replace the batter (unless they are the sole wicketkeeper in the XII, or if swapping them reduces total openers below 2).
  const selectedKeepers = selected.filter(isKeeper);
  const onlyKeeperId = selectedKeepers.length === 1 ? selectedKeepers[0].id : null;

  let swapDone = true;
  while (swapDone) {
    swapDone = false;

    const remainingARs = remaining
      .filter(p => getEffectiveRole(p) === "All-Rounder")
      .sort((a, b) => (b.currentBatting ?? 0) - (a.currentBatting ?? 0));

    if (remainingARs.length === 0) break;

    const replaceableBatters = selected
      .filter(p => {
        const effRole = getEffectiveRole(p);
        const isBatter = effRole === "Batsman" || effRole === "WK-Batsman";
        const isOnlyKeeper = p.id === onlyKeeperId;
        return isBatter && !isOnlyKeeper;
      })
      .sort((a, b) => (a.currentBatting ?? 0) - (b.currentBatting ?? 0)); // lowest batting first

    if (replaceableBatters.length === 0) break;

    const bestAR = remainingARs[0];
    let foundSwap = null;

    for (const worstBatter of replaceableBatters) {
      const arBat = bestAR.currentBatting ?? 0;
      const batBat = worstBatter.currentBatting ?? 0;

      if (arBat >= batBat) {
        const currentOSCount = selected.filter(p => p.nationality === "Overseas").length;
        const nextOSCount = currentOSCount - (worstBatter.nationality === "Overseas" ? 1 : 0) + (bestAR.nationality === "Overseas" ? 1 : 0);

        const currentOpenersCount = selected.filter(p => p.isOpener).length;
        const nextOpenersCount = currentOpenersCount - (worstBatter.isOpener ? 1 : 0) + (bestAR.isOpener ? 1 : 0);

        // Evaluate out-and-out bowler cap under the swap
        const tempSelected = selected.filter(p => p.id !== worstBatter.id).concat(bestAR);
        const tempARs = tempSelected.filter(p => getEffectiveRole(p) === "All-Rounder").length;
        const tempOutAndOut = tempSelected.filter(p => {
          const r = getEffectiveRole(p);
          return r === "Pace Bowler" || r === "Spin Bowler";
        }).length;
        const maxAllowedOutAndOut = tempARs >= 2 ? 4 : 5;

        if (nextOSCount <= 4 && nextOpenersCount >= 2 && tempOutAndOut <= maxAllowedOutAndOut) {
          foundSwap = worstBatter;
          break; // Found the lowest-rated batter we can validly swap with
        }
      }
    }

    if (foundSwap) {
      selected = selected.filter(p => p.id !== foundSwap.id);
      selected.push(bestAR);
      remaining = remaining.filter(p => p.id !== bestAR.id);
      remaining.push(foundSwap);
      swapDone = true;
    }
  }

  // 6. All-Rounder Limit of 3 Rule:
  // Place an all-rounder limit at 3 unless the 4th all-rounder has a higher batting rating than all of the unselected batsmen.
  // If not true, swap the all-rounder for the best unselected batter.
  let arLimitCheckDone = false;
  while (!arLimitCheckDone) {
    arLimitCheckDone = true;

    const selectedARs = selected
      .filter(p => getEffectiveRole(p) === "All-Rounder")
      .sort((a, b) => (b.currentBatting ?? 0) - (a.currentBatting ?? 0)); // highest batting first

    if (selectedARs.length > 3) {
      const fourthAR = selectedARs[3]; 

      const unselectedBatters = remaining
        .filter(p => {
          const effRole = getEffectiveRole(p);
          return effRole === "Batsman" || effRole === "WK-Batsman";
        })
        .sort((a, b) => playerRating(b) - playerRating(a)); // highest rated first

      if (unselectedBatters.length > 0) {
        const bestUnselectedBatter = unselectedBatters[0];
        const arBat = fourthAR.currentBatting ?? 0;
        const batBat = bestUnselectedBatter.currentBatting ?? 0;

        if (arBat <= batBat) {
          selected = selected.filter(p => p.id !== fourthAR.id);
          selected.push(bestUnselectedBatter);
          remaining = remaining.filter(p => p.id !== bestUnselectedBatter.id);
          remaining.push(fourthAR);
          arLimitCheckDone = false; // re-run check
        }
      }
    }
  }

  // Arrange the lineup:
  // - 2 openers
  // - Batsmen who aren't finishers, ranked highest to lowest
  // - Finishers, ranked highest to lowest
  // - All-rounders ranked as per batting ratings (if not finishers/openers), highest to lowest
  // - Pace bowlers, highest to lowest
  // - Spin bowlers, highest to lowest
  const availableOpeners = selected
    .filter(p => p.isOpener)
    .sort((a, b) => playerRating(b) - playerRating(a));

  let finalOpeners: import("@/lib/types").Player[] = [];
  if (availableOpeners.length >= 2) {
    finalOpeners = availableOpeners.slice(0, 2);
  } else if (availableOpeners.length === 1) {
    finalOpeners.push(availableOpeners[0]);
    const nextBest = selected
      .filter(p => p.id !== availableOpeners[0].id && (getEffectiveRole(p) === "Batsman" || getEffectiveRole(p) === "WK-Batsman"))
      .sort((a, b) => playerRating(b) - playerRating(a))[0];
    if (nextBest) finalOpeners.push(nextBest);
  } else {
    const bestBatters = selected
      .filter(p => getEffectiveRole(p) === "Batsman" || getEffectiveRole(p) === "WK-Batsman")
      .sort((a, b) => playerRating(b) - playerRating(a));
    finalOpeners = bestBatters.slice(0, 2);
  }

  const finalOpenersIds = finalOpeners.map(f => f.id);
  const remainingTen = selected.filter(p => !finalOpenersIds.includes(p.id));

  const batters = remainingTen.filter(p => (getEffectiveRole(p) === "Batsman" || getEffectiveRole(p) === "WK-Batsman") && !isFinisherType(p))
    .sort((a, b) => playerRating(b) - playerRating(a));

  const finishers = remainingTen.filter(p => isFinisherType(p) && getEffectiveRole(p) !== "Pace Bowler" && getEffectiveRole(p) !== "Spin Bowler")
    .sort((a, b) => playerRating(b) - playerRating(a));

  const allrounders = remainingTen.filter(p => getEffectiveRole(p) === "All-Rounder" && !isFinisherType(p))
    .sort((a, b) => (b.currentBatting ?? 0) - (a.currentBatting ?? 0));

  const pacers = remainingTen.filter(p => getEffectiveRole(p) === "Pace Bowler")
    .sort((a, b) => playerRating(b) - playerRating(a));

  const spinners = remainingTen.filter(p => getEffectiveRole(p) === "Spin Bowler")
    .sort((a, b) => playerRating(b) - playerRating(a));

  const merged = [...finalOpeners, ...batters, ...finishers, ...allrounders, ...pacers, ...spinners];
  const leftover = remainingTen.filter(p => !merged.some(m => m.id === p.id));

  const finalLineup = [...merged, ...leftover];

  // Final Unique Filter to guarantee absolutely no duplicate player IDs
  const uniqueLineup = [];
  const seenIds = new Set();
  for (const p of finalLineup) {
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      uniqueLineup.push(p);
    }
  }
  return uniqueLineup;
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
