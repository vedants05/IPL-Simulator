"use client";
import { useState, useRef, useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { Player } from "@/lib/types";
import PlayerCard from "./PlayerCard";

function crore(lakhs: number) {
  return (lakhs / 100).toFixed(1);
}

const ROLE_SHORT: Record<string, string> = {
  "Batsman": "BAT",
  "WK-Batsman": "WK",
  "All-Rounder": "AR",
  "Pace Bowler": "PACE",
  "Spin Bowler": "SPIN",
};

export default function TeamPurseList() {
  const { teams, players, userTeamId, auction } = useGameStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const popoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedPlayer) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoutRef.current && !popoutRef.current.contains(e.target as Node)) {
        setSelectedPlayer(null);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [selectedPlayer]);

  const sortedTeams = Object.values(teams).sort((a, b) =>
    a.id === userTeamId ? -1 : b.id === userTeamId ? 1 : a.name.localeCompare(b.name)
  );

  return (
    <div className="flex-1 overflow-y-auto relative">
      <div className="px-4 h-[36px] flex items-center shrink-0" style={{ borderBottom: "2px solid #16130f" }}>
        <span className="font-space-mono font-bold text-[10px] tracking-[.14em] text-text-primary uppercase">
          Purse / <span className="text-[12px] font-sans font-bold">₹</span>Cr
        </span>
      </div>

      {sortedTeams.map((team) => {
        const purseInfo = auction?.teamPurses[team.id];
        const remaining = purseInfo?.remaining ?? team.remainingPurse;
        const squadCount = purseInfo?.squadCount ?? team.squad.length;
        const rtmLeft = team.rtmCardsTotal - team.rtmCardsUsed;
        const isUser = team.id === userTeamId;
        const isOpen = expanded === team.id;
        const squadPlayers = team.squad.map((id) => players[id]).filter(Boolean);

        return (
          <div key={team.id}>
            {/* Team row */}
            <button
              onClick={() => setExpanded(isOpen ? null : team.id)}
              className="w-full flex items-center px-3 py-[7px] gap-2 text-left transition-colors duration-200 hover:bg-surface cursor-pointer"
              style={{
                borderBottom: "1px solid rgba(22,19,15,.14)",
                backgroundColor: isUser ? "var(--team-primary-tint)" : undefined,
              }}
            >
              <div
                className="w-[9px] h-[9px] rounded-full shrink-0"
                style={{ backgroundColor: team.primaryColor }}
              />
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <span className="font-anton text-[13px] leading-none truncate text-text-primary">
                  {team.shortName}
                </span>
                {isUser && (
                  <span className="font-space-mono font-bold text-[8px] tracking-wider shrink-0" style={{ color: "var(--team-primary)" }}>
                    -YOU
                  </span>
                )}
              </div>
              <span className="font-barlow-condensed font-bold text-[13px] text-text-secondary shrink-0">
                {squadCount}p
              </span>
              {rtmLeft > 0 && (
                <span
                  className="font-space-mono font-bold text-[8px] tracking-wider shrink-0 px-1.5 py-0.5 rounded-[2px]"
                  style={{
                    backgroundColor: "rgba(22,19,15,.12)",
                    color: "#5a5348",
                  }}
                >
                  {rtmLeft}RTM
                </span>
              )}
              <span
                className="font-barlow-condensed font-bold text-[15px] leading-none shrink-0 text-text-primary"
              >
                {crore(remaining)}
              </span>
              <span className="font-space-mono text-[9px] text-text-secondary shrink-0">
                {isOpen ? "▲" : "▼"}
              </span>
            </button>

            {/* Squad dropdown */}
            {isOpen && (
              <div className="bg-surface" style={{ borderBottom: "1px solid rgba(22,19,15,.2)" }}>
                {/* RTM info row */}
                <div
                  className="flex items-center justify-between px-5 py-2"
                  style={{ borderBottom: "1px solid rgba(22,19,15,.14)", backgroundColor: "rgba(22,19,15,.04)" }}
                >
                  <span className="font-space-mono text-[9px] tracking-wider text-text-secondary uppercase">RTM Cards</span>
                  <span className="font-barlow-condensed font-bold text-[14px]" style={{ color: rtmLeft > 0 ? "#1f9d57" : "#5a5348" }}>
                    {rtmLeft} / {team.rtmCardsTotal}
                  </span>
                </div>

                {squadPlayers.length === 0 ? (
                  <div className="px-5 py-3 font-space-mono text-[9px] text-text-secondary tracking-wider">
                    No players yet
                  </div>
                ) : (
                  squadPlayers.map((p) => {
                    const isSelected = selectedPlayer?.id === p.id;
                    const wasRetained = team.retainedPlayers.includes(p.id);
                    const sale = auction?.saleHistory.find((s: any) => s.playerId === p.id);
                    const price = sale?.price ?? p.iplHistory.find((h) => h.season === "2027")?.price ?? p.iplHistory.find((h) => h.season === "2026")?.price;
                    const priceStr = price ? ` (₹${(price / 100).toFixed(1)}Cr)` : "";

                    const isRtm = !!p.iplHistory.find((h) => h.season === "2027")?.isRtm;

                    let rowBg = undefined;
                    let rowBorder = "1px solid rgba(22,19,15,.08)";
                    if (isSelected) {
                      rowBg = "rgba(22, 19, 15, 0.08)";
                    } else if (wasRetained) {
                      rowBg = `${team.primaryColor}18`;
                      rowBorder = `1px solid ${team.primaryColor}33`;
                    }

                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPlayer(isSelected ? null : p)}
                        className="flex items-center justify-between px-5 py-[5px] hover:bg-black/5 cursor-pointer transition-colors duration-150 group select-none"
                        style={{
                          borderBottom: rowBorder,
                          backgroundColor: rowBg,
                        }}
                        title="Click to view player file"
                      >
                        <span className="font-barlow font-medium text-[11px] text-text-primary group-hover:text-black group-hover:underline truncate flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                          <span>{p.name}</span>
                          {priceStr && <span className="text-[9.5px] text-text-secondary font-mono font-medium">{priceStr}</span>}
                          {isRtm && <span className="text-[7.5px] font-space-mono font-extrabold bg-[#1d55c4]/15 text-[#1d55c4] px-1 rounded-[2px] tracking-wide uppercase leading-none py-0.5 shrink-0">RTM</span>}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {p.nationality === "Overseas" && (
                            <span className="font-space-mono text-[8px] bg-accent text-border px-1 rounded-[2px] font-bold">OS</span>
                          )}
                          <span className="font-space-mono text-[8px] text-text-secondary tracking-wider">
                            {ROLE_SHORT[p.role] ?? p.role}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Side Popout Card (Opens on left, right next to Squad/Purse column) */}
      {selectedPlayer && (
        <div
          ref={popoutRef}
          className="absolute right-full top-0 mr-0 w-[380px] max-h-[85vh] bg-surface border-2 border-[#16130f] shadow-2xl z-[100] rounded-l-[4px] flex flex-col overflow-hidden text-[#16130f]"
        >
          {/* Popout Header matching team theme */}
          <div
            className="px-4 py-2.5 flex items-center justify-between shrink-0 transition-colors duration-200"
            style={{
              backgroundColor: "var(--team-bid-bg, #111622)",
              backgroundImage: "var(--team-bid-tinge)",
              borderBottom: "2px solid #16130f",
              color: "var(--team-bid-text, #ffffff)",
            }}
          >
            <div
              className="font-space-mono font-bold text-[10px] tracking-widest uppercase"
              style={{ color: "var(--team-accent, #ffc72c)" }}
            >
              Player Details
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPlayer(null);
              }}
              className="w-6 h-6 flex items-center justify-center rounded font-bold text-[12px] hover:bg-red-600 hover:text-white transition-all duration-150 cursor-pointer active:scale-95"
              style={{ color: "var(--team-bid-text, #ffffff)" }}
            >
              ✕
            </button>
          </div>
          {/* Full PlayerCard */}
          <div className="flex-1 overflow-y-auto">
            {(() => {
              const sale = auction?.saleHistory.find((s: any) => s.playerId === selectedPlayer.id);
              const salary = sale?.price ?? selectedPlayer.iplHistory.find((h) => h.season === "2027")?.price ?? selectedPlayer.iplHistory[selectedPlayer.iplHistory.length - 1]?.price ?? selectedPlayer.basePrice;
              return <PlayerCard player={selectedPlayer} soldPrice={salary} collapsible={false} />;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
