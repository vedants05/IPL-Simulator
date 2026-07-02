"use client";
import { useGameStore } from "@/lib/store/gameStore";

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

export default function SkipSetSummaryModal() {
  const { skipSetSummary, teams } = useGameStore();
  const dismissSkipSetSummary = useGameStore((s) => s.dismissSkipSetSummary);

  if (!skipSetSummary) return null;

  const { setName, results } = skipSetSummary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div
        className="w-full max-w-xl bg-[#f4f1ea] border-2 border-[#16130f] shadow-2xl rounded-[6px] flex flex-col overflow-hidden text-[#16130f] max-h-[85vh]"
      >
        {/* Header */}
        <div
          className="px-5 py-3.5 flex items-center justify-between shrink-0 bg-[#16130f] text-white"
          style={{ borderBottom: "2px solid #16130f" }}
        >
          <h2 className="font-anton text-[22px] leading-none text-white uppercase tracking-wide">
            {setName}
          </h2>
          <span className="font-space-mono text-[10px] font-bold text-[#8a8378] uppercase tracking-wider bg-white/10 px-2.5 py-0.5 rounded">
            {results.length} Players
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#16130f]/10">
          {results.map((item, index) => {
            const team = item.teamId ? teams[item.teamId] : null;
            return (
              <div
                key={`${item.player.id}-${index}`}
                className="flex items-center justify-between px-5 py-3 bg-white/40 hover:bg-white transition-colors"
              >
                {/* Player details */}
                <div className="min-w-0 flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-anton text-[18px] text-[#16130f] truncate leading-tight">
                      {item.player.name}
                    </span>
                    <span className="font-space-mono text-[9px] text-text-secondary uppercase bg-[#16130f]/5 px-1.5 py-0.5 rounded shrink-0">
                      {item.player.role}
                    </span>
                    {item.player.nationality === "Overseas" && (
                      <span className="font-space-mono text-[9px] text-[#1d55c4] font-bold bg-[#1d55c4]/10 px-1.5 py-0.5 rounded shrink-0">
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
                        <span className="font-space-mono font-bold text-[8px] tracking-widest uppercase bg-amber-500 text-black px-1.5 py-0.5 rounded">
                          RTM
                        </span>
                      )}
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded shadow-sm"
                        style={{ backgroundColor: team.primaryColor, color: team.secondaryColor }}
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
                    <span className="font-space-mono font-bold text-[10px] tracking-wider text-[#d6492f] bg-red-50 px-2.5 py-1 rounded uppercase border border-red-200">
                      UNSOLD
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Compact Footer Action */}
        <div className="px-5 py-3 bg-surface border-t-2 border-[#16130f] flex justify-end shrink-0">
          <button
            onClick={dismissSkipSetSummary}
            className="font-anton text-[18px] px-7 py-2.5 tracking-wide text-white bg-[#16130f] hover:bg-black hover:scale-105 active:scale-95 transition-all duration-150 rounded-[4px] shadow-md cursor-pointer"
          >
            GO TO NEXT SET →
          </button>
        </div>
      </div>
    </div>
  );
}
