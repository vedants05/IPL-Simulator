"use client";
import { useGameStore } from "@/lib/store/gameStore";

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

export default function SkipSetSummaryModal() {
  const { skipSetSummary, teams, userTeamId } = useGameStore();
  const dismissSkipSetSummary = useGameStore((s) => s.dismissSkipSetSummary);

  if (!skipSetSummary) return null;

  const userTeam = teams[userTeamId];
  const { setName, results } = skipSetSummary;

  const primaryColor = userTeam?.primaryColor ?? "#16130f";
  const secondaryColor = userTeam?.secondaryColor ?? "#ffffff";

  return (
    <div
      onClick={dismissSkipSetSummary}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 select-none cursor-pointer"
      title="Click anywhere to dismiss and start next set"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#efece3] border-2 border-[#16130f] shadow-2xl rounded-[8px] flex flex-col overflow-hidden text-[#16130f] max-h-[85vh] cursor-default"
      >
        {/* Header themed to user's team */}
        <div
          className="px-6 py-4 flex items-center justify-between shrink-0 transition-colors duration-200"
          style={{
            backgroundColor: primaryColor,
            color: secondaryColor,
            borderBottom: "2px solid #16130f",
          }}
        >
          <div className="flex items-center gap-3">
            {userTeam && (
              <span
                className="font-space-mono font-bold text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full shrink-0 border border-current/20"
                style={{ backgroundColor: "rgba(0,0,0,0.15)", color: secondaryColor }}
              >
                {userTeam.shortName}
              </span>
            )}
            <h2 className="font-anton text-[22px] leading-none uppercase tracking-wide">
              {setName}
            </h2>
          </div>

          <span
            className="font-space-mono font-bold text-[10px] tracking-widest uppercase px-2.5 py-1 rounded shrink-0 border border-current/20"
            style={{ backgroundColor: "rgba(0,0,0,0.18)", color: secondaryColor }}
          >
            {results.length} Players
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#16130f]/10 p-2 space-y-1">
          {results.map((item, index) => {
            const team = item.teamId ? teams[item.teamId] : null;
            return (
              <div
                key={`${item.player.id}-${index}`}
                className="flex items-center justify-between px-4 py-2.5 rounded bg-white/70 hover:bg-white transition-all border border-[#16130f]/5 shadow-sm"
              >
                {/* Player info */}
                <div className="min-w-0 flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-barlow font-bold text-[17px] text-[#16130f] truncate leading-tight">
                      {item.player.name}
                    </span>
                    <span className="font-space-mono font-bold text-[9px] tracking-wider text-[#5a5348] uppercase bg-[#16130f]/5 px-2 py-0.5 rounded-[3px] border border-[#16130f]/10 shrink-0">
                      {item.player.role}
                    </span>
                    {item.player.nationality === "Overseas" && (
                      <span className="font-space-mono font-bold text-[9px] tracking-widest text-[#1d55c4] bg-[#1d55c4]/10 px-2 py-0.5 rounded-[3px] border border-[#1d55c4]/20 shrink-0">
                        OS
                      </span>
                    )}
                  </div>
                </div>

                {/* Outcome */}
                <div className="shrink-0 flex items-center gap-2">
                  {item.status === "sold" && team && item.price !== undefined ? (
                    <div className="flex items-center gap-2">
                      {item.usedRtm && (
                        <span className="font-space-mono font-bold text-[8px] tracking-widest uppercase bg-amber-500 text-black px-1.5 py-0.5 rounded border border-black/20">
                          RTM
                        </span>
                      )}
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded shadow-sm"
                        style={{
                          backgroundColor: team.primaryColor,
                          color: team.secondaryColor,
                          border: "1.5px solid #16130f",
                        }}
                      >
                        <span className="font-anton text-[11px] uppercase tracking-wider">
                          {team.shortName}
                        </span>
                        <span className="font-anton text-[14px]">
                          {crore(item.price)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="font-space-mono font-bold text-[10px] tracking-wider text-[#d6492f] bg-[#d6492f]/10 px-2.5 py-1 rounded uppercase border border-[#d6492f]/30">
                      UNSOLD
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Compact Themed Footer */}
        <div className="px-5 py-3 bg-[#efece3] border-t-2 border-[#16130f] flex items-center justify-between shrink-0">
          <span className="font-space-mono text-[10px] text-text-secondary">
            Click anywhere outside to continue
          </span>
          <button
            onClick={dismissSkipSetSummary}
            className="font-anton text-[17px] px-6 py-2.5 tracking-wide rounded-[5px] cursor-pointer shadow-md hover:scale-105 active:scale-95 transition-all duration-150"
            style={{
              backgroundColor: primaryColor,
              color: secondaryColor,
              border: "1.5px solid #16130f",
            }}
          >
            GO TO NEXT SET →
          </button>
        </div>
      </div>
    </div>
  );
}
