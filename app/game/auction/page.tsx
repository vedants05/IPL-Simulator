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

function TeamSquadCard({
  team,
  players,
  isUser,
}: {
  team: import("@/lib/types").Team;
  players: Record<string, import("@/lib/types").Player>;
  isUser: boolean;
}) {
  const squad = team.squad.map((id) => players[id]).filter(Boolean);
  const overseas = squad.filter((p) => p.nationality === "Overseas").length;

  return (
    <div
      style={{ border: isUser ? "3px solid #16130f" : "2px solid #16130f" }}
      className="flex flex-col bg-surface2"
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
      <div className="p-2.5 space-y-1.5">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {ordered.map((team) => (
            <TeamSquadCard
              key={team.id}
              team={team}
              players={players}
              isUser={team.id === userTeamId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
