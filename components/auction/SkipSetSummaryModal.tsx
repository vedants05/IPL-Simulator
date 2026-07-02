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
  const cleanSetName = setName.replace(/^Set \d+:\s*/i, "");

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none">
      <div
        className="w-full max-w-2xl bg-[#f4f1ea] border-2 border-[#16130f] shadow-2xl rounded-[8px] flex flex-col overflow-hidden text-[#16130f] max-h-[90vh]"
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between shrink-0"
          style={{ backgroundColor: "var(--team-cta-bg, #111622)", color: "#ffffff", borderBottom: "2px solid #16130f" }}
        >
          <div>
            <div className="font-space-mono text-[9px] font-bold tracking-[.2em] text-white/70 uppercase mb-0.5">
              SET SIMULATION COMPLETED
            </div>
            <h2 className="font-anton text-[26px] leading-none text-white uppercase tracking-wide">
              {cleanSetName}
            </h2>
          </div>
          <span className="font-space-mono text-[11px] font-bold text-white/90 bg-white/10 px-3 py-1 rounded border border-white/20">
            {results.length} Players
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {results.map((item, index) => {
            const team = item.teamId ? teams[item.teamId] : null;
            return (
              <div
                key={`${item.player.id}-${index}`}
                className="flex items-center justify-between p-3 rounded border border-[#16130f]/15 bg-white shadow-sm"
              >
                {/* Player details */}
                <div className="min-w-0 flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-anton text-[17px] text-[#16130f] truncate leading-tight">
                      {item.player.name}
                    </span>
                    <span className="font-space-mono text-[9px] text-[#16130f]/60 uppercase bg-[#16130f]/5 px-1.5 py-0.5 rounded shrink-0">
                      {item.player.role}
                    </span>
                    {item.player.nationality === "Overseas" && (
                      <span className="font-space-mono text-[9px] text-[#1d55c4] font-bold bg-[#1d55c4]/10 px-1.5 py-0.5 rounded shrink-0">
                        OS
                      </span>
                    )}
                  </div>
                  <div className="font-space-mono text-[9px] text-text-secondary mt-0.5">
                    Base: ₹{(item.player.basePrice / 100).toFixed(2)} Cr · {item.player.starRating}★
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
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded"
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
                    <span className="font-space-mono font-bold text-[10px] tracking-wider text-red-600 bg-red-100 px-2.5 py-1 rounded uppercase border border-red-200">
                      UNSOLD
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Action */}
        <div className="p-4 bg-[#efece3] border-t-2 border-[#16130f] flex items-center justify-between shrink-0">
          <span className="font-space-mono text-[10px] text-text-secondary">
            Press button below to begin simulating the next set
          </span>
          <button
            onClick={dismissSkipSetSummary}
            className="font-anton text-[18px] px-8 py-3.5 tracking-wide text-white bg-[#16130f] hover:bg-black hover:scale-105 active:scale-95 transition-all duration-150 rounded-[4px] shadow-lg cursor-pointer"
          >
            GO TO NEXT SET →
          </button>
        </div>
      </div>
    </div>
  );
}
