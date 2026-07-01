"use client";
import { useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";

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

  const sortedTeams = Object.values(teams).sort((a, b) =>
    a.id === userTeamId ? -1 : b.id === userTeamId ? 1 : a.name.localeCompare(b.name)
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-2 shrink-0" style={{ borderBottom: "2px solid #16130f" }}>
        <span className="font-space-mono font-bold text-[10px] tracking-[.14em] text-text-secondary uppercase">
          Purse / ₹Cr
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
              className="w-full flex items-center px-4 py-[7px] gap-3 text-left transition-colors hover:bg-surface"
              style={{
                borderBottom: "1px solid rgba(22,19,15,.14)",
                backgroundColor: isUser ? "#ffc400" : undefined,
              }}
            >
              <div
                className="w-[10px] h-[10px] rounded-full shrink-0"
                style={{ backgroundColor: team.primaryColor }}
              />
              <span className="font-anton text-[13px] leading-none flex-1 min-w-0 truncate text-text-primary">
                {team.shortName}
                {isUser && (
                  <span className="font-space-mono font-bold text-[9px] ml-1.5 tracking-wider">·YOU</span>
                )}
              </span>
              <span className="font-barlow-condensed font-bold text-[13px] text-text-secondary shrink-0">
                {squadCount}p
              </span>
              {rtmLeft > 0 && (
                <span
                  className="font-space-mono font-bold text-[8px] tracking-wider shrink-0 px-1.5 py-0.5 rounded-[2px]"
                  style={{ backgroundColor: "rgba(22,19,15,.12)", color: "#5a5348" }}
                >
                  {rtmLeft}RTM
                </span>
              )}
              <span
                className="font-barlow-condensed font-bold text-[15px] leading-none shrink-0"
                style={{ color: remaining > 3000 ? "#1f9d57" : "#d6492f" }}
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
                  squadPlayers.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-5 py-[5px]"
                      style={{ borderBottom: "1px solid rgba(22,19,15,.08)" }}
                    >
                      <span className="font-barlow font-medium text-[11px] text-text-primary truncate flex-1 min-w-0">
                        {p.name}
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
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
