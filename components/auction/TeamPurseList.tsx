"use client";
import { useGameStore } from "@/lib/store/gameStore";

function crore(lakhs: number) {
  return (lakhs / 100).toFixed(1);
}

export default function TeamPurseList() {
  const { teams, userTeamId, auction } = useGameStore();

  const sortedTeams = Object.values(teams).sort((a, b) =>
    a.id === userTeamId ? -1 : b.id === userTeamId ? 1 : a.name.localeCompare(b.name)
  );

  const userTeam = teams[userTeamId];
  const rtmLeft = (userTeam?.rtmCardsTotal ?? 0) - (userTeam?.rtmCardsUsed ?? 0);
  const userSquadCount = auction?.teamPurses[userTeamId]?.squadCount ?? userTeam?.squad.length ?? 0;
  const userOverseas = userTeam?.overseasPlayersCurrent ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Zone header */}
      <div className="px-4 py-2 border-b-2 border-border shrink-0">
        <span className="font-space-mono font-bold text-[10px] tracking-[.14em] text-text-secondary uppercase">
          Purse / ₹Cr
        </span>
      </div>

      {/* Team rows */}
      <div className="flex-1 overflow-y-auto">
        {sortedTeams.map((team) => {
          const purseInfo = auction?.teamPurses[team.id];
          const remaining = purseInfo?.remaining ?? team.remainingPurse;
          const isUser = team.id === userTeamId;

          return (
            <div
              key={team.id}
              className={`flex items-center px-4 py-[7px] gap-3 ${isUser ? "bg-accent border-b border-border" : ""}`}
              style={!isUser ? { borderBottom: "1px solid rgba(22,19,15,.14)" } : {}}
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
              <span
                className="font-barlow-condensed font-bold text-[16px] leading-none shrink-0"
                style={{ color: remaining > 3000 ? "#1f9d57" : "#d6492f" }}
              >
                {crore(remaining)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Squad summary pinned bottom */}
      <div className="shrink-0 border-t-2 border-border p-3 bg-surface">
        <div className="flex items-center gap-2 mb-2">
          {userTeam && (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
              style={{ backgroundColor: userTeam.primaryColor, color: userTeam.secondaryColor }}
            >
              {userTeam.shortName.slice(0, 2)}
            </div>
          )}
          <span className="font-space-mono font-bold text-[10px] text-text-primary tracking-wide">
            YOUR SQUAD {userSquadCount}/25
          </span>
        </div>
        <div className="flex gap-2">
          <span className="font-space-mono text-[9px] font-bold tracking-wider bg-accent text-border px-2 py-[3px] rounded-[3px]">
            OS {userOverseas}/8
          </span>
          {rtmLeft > 0 && (
            <span className="font-space-mono text-[9px] font-bold tracking-wider border border-border text-text-primary px-2 py-[3px] rounded-[3px]">
              RTM ×{rtmLeft}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
