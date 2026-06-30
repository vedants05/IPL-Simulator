"use client";
import { useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";

export default function TeamPurseList() {
  const { teams, players, userTeamId, auction } = useGameStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  const sortedTeams = Object.values(teams).sort((a, b) =>
    a.id === userTeamId ? -1 : b.id === userTeamId ? 1 : a.name.localeCompare(b.name)
  );

  return (
    <div className="flex flex-col gap-1">
      {sortedTeams.map((team) => {
        const purseInfo = auction?.teamPurses[team.id];
        const remaining = purseInfo?.remaining ?? team.remainingPurse;
        const squadCount = purseInfo?.squadCount ?? team.squad.length;
        const isUser = team.id === userTeamId;

        const purseColor =
          remaining > 3000 ? "text-success" :
          remaining > 1500 ? "text-gold" : "text-danger";

        const squadWarning = squadCount < team.minSquadSize;
        const isExpanded = expanded === team.id;

        const squadPlayers = team.squad.map((id) => players[id]).filter(Boolean);

        return (
          <div key={team.id} className={`rounded border ${isUser ? "border-accent/50 bg-accent/5" : "border-border bg-surface"}`}>
            <button
              onClick={() => setExpanded(isExpanded ? null : team.id)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-surface2 transition-colors rounded"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{ backgroundColor: team.primaryColor, color: team.secondaryColor }}
                >
                  {team.shortName.slice(0, 2)}
                </span>
                <span className={`font-medium ${isUser ? "text-accent" : "text-text-primary"}`}>
                  {team.shortName}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-mono font-semibold ${purseColor}`}>
                  {formatPrice(remaining)}
                </span>
                <span className={`font-mono ${squadWarning ? "text-danger" : "text-text-secondary"}`}>
                  {squadCount}/{team.minSquadSize}
                </span>
                <span className="text-text-secondary">{isExpanded ? "▲" : "▼"}</span>
              </div>
            </button>

            {isExpanded && (
              <div className="px-3 pb-2 border-t border-border/50">
                <div className="max-h-40 overflow-y-auto mt-1 flex flex-col gap-1">
                  {squadPlayers.length === 0 ? (
                    <div className="text-xs text-text-secondary py-1">No players yet</div>
                  ) : (
                    squadPlayers.map((p) => (
                      <div key={p.id} className="flex justify-between text-[10px]">
                        <span className="text-text-secondary truncate max-w-[140px]">{p.name}</span>
                        <span className="text-text-secondary ml-1 shrink-0">{p.role.slice(0, 4)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
