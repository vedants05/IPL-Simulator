"use client";
import { useState, useRef, useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { Player } from "@/lib/types";
import PlayerCard from "./PlayerCard";

const ROLE_GROUPS = [
  { label: "WK", role: "WK-Batsman" },
  { label: "BAT", role: "Batsman" },
  { label: "AR", role: "All-Rounder" },
  { label: "PACE", role: "Pace Bowler" },
  { label: "SPIN", role: "Spin Bowler" },
];

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

export default function UserSquad() {
  const { teams, players, userTeamId, auction } = useGameStore();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const popoutRef = useRef<HTMLDivElement>(null);
  const userTeam = teams[userTeamId];

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

  if (!userTeam) return null;

  const squadPlayers = userTeam.squad.map((id) => players[id]).filter(Boolean);
  const purseInfo = auction?.teamPurses[userTeamId];
  const remaining = purseInfo?.remaining ?? userTeam.remainingPurse;
  const rtmLeft = userTeam.rtmCardsTotal - userTeam.rtmCardsUsed;

  return (
    <div className="flex flex-col h-full bg-surface relative">
      {/* Header */}
      <div
        className="px-4 h-[36px] flex items-center shrink-0"
        style={{ borderBottom: "2px solid #16130f" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-5 min-w-[22px] px-1.5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 shadow-sm"
            style={{ backgroundColor: userTeam.primaryColor, color: userTeam.secondaryColor }}
          >
            {userTeam.shortName}
          </div>
          <span className="font-space-mono font-bold text-[10px] tracking-widest text-text-primary uppercase">
            Your Squad
          </span>
        </div>
      </div>

      {/* Stats bar */}
      <div
        className="flex shrink-0"
        style={{ borderBottom: "2px solid #16130f" }}
      >
        {[
          { label: "PLAYERS", value: `${squadPlayers.length}/25` },
          { label: "OS", value: `${userTeam.overseasPlayersCurrent}/8` },
          { label: "RTM", value: `×${rtmLeft}` },
        ].map((s, i) => (
          <div
            key={s.label}
            className="flex-1 flex flex-col items-center py-2"
            style={i < 2 ? { borderRight: "1px solid rgba(22,19,15,.18)" } : {}}
          >
            <span className="font-space-mono text-[8px] tracking-widest text-text-secondary mb-0.5">{s.label}</span>
            <span className="font-barlow-condensed font-bold text-[16px] leading-none text-text-primary">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Squad by role */}
      <div className="flex-1 overflow-y-auto">
        {squadPlayers.length === 0 ? (
          <div className="flex items-center justify-center h-20">
            <span className="font-space-mono text-[10px] text-text-secondary tracking-wider">
              No players yet
            </span>
          </div>
        ) : (
          ROLE_GROUPS.map(({ label, role }) => {
            const group = squadPlayers.filter((p) => p.role === role);
            if (group.length === 0) return null;
            return (
              <div key={role}>
                <div
                  className="px-3 py-[5px] bg-bg"
                  style={{ borderBottom: "1px solid rgba(22,19,15,.18)" }}
                >
                  <span className="font-space-mono font-bold text-[8px] tracking-widest text-text-secondary uppercase">
                    {label} ({group.length})
                  </span>
                </div>
                {group.map((p) => {
                  const isSelected = selectedPlayer?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlayer(isSelected ? null : p)}
                      className="flex items-center justify-between px-3 py-[6px] hover:bg-black/5 cursor-pointer transition-colors duration-150 group select-none"
                      style={{
                        borderBottom: "1px solid rgba(22,19,15,.08)",
                        backgroundColor: isSelected ? "rgba(22, 19, 15, 0.08)" : undefined,
                      }}
                      title="Click to view player file"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-barlow font-semibold text-[11.5px] text-text-primary group-hover:text-black group-hover:underline truncate leading-tight">
                          {p.name}
                        </div>
                        <div className="flex items-center gap-1 mt-[1px]">
                          {p.nationality === "Overseas" && (
                            <span
                              className="font-space-mono text-[7px] text-white px-1 rounded-[2px] font-bold"
                              style={{ backgroundColor: userTeam.primaryColor }}
                            >
                              OS
                            </span>
                          )}
                          <span className="font-space-mono text-[8px] text-text-secondary">
                            {p.battingStyle === "Right-hand" ? "RHB" : "LHB"}
                            {p.bowlingStyle ? ` · ${p.bowlingStyle.split(" ").slice(0, 2).join(" ")}` : ""}
                          </span>
                        </div>
                      </div>
                      {/* Star dots */}
                      <div className="flex gap-0.5 shrink-0 ml-2">
                        {Array.from({ length: 5 }).map((_, si) => (
                          <div
                            key={si}
                            className="w-2 h-2 rounded-sm"
                            style={{
                              backgroundColor: si < p.starRating ? userTeam.primaryColor : "rgba(22,19,15,.12)",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* Purse footer: REMAINING container box */}
      <div
        className="shrink-0 h-[52px] px-4 flex justify-between items-center"
        style={{ borderTop: "2px solid #16130f" }}
      >
        <span className="font-space-mono text-[9px] tracking-widest text-text-secondary uppercase">REMAINING</span>
        <span className="font-anton text-[20px] text-success leading-none">
          {crore(remaining)}
        </span>
      </div>

      {/* Side Popout Card (Opens on left, right next to Squad column) */}
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
