"use client";
import { useGameStore } from "@/lib/store/gameStore";
import { TEAM_THEMES } from "@/lib/theme/teams";

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

export default function SkipSetSummaryModal() {
  const { skipSetSummary, teams, userTeamId } = useGameStore();
  const dismissSkipSetSummary = useGameStore((s) => s.dismissSkipSetSummary);

  if (!skipSetSummary) return null;

  const userTeam = teams[userTeamId];
  const { setName, results } = skipSetSummary;

  const theme = TEAM_THEMES[userTeamId];
  const headerGradient = theme?.overlayGradient ?? "linear-gradient(135deg, #1c180c 0%, #0d0b06 100%)";
  const headerText = theme?.overlayText ?? "#ffffff";
  const accent = theme?.accent ?? "#ffc72c";
  const ctaBg = theme?.ctaBg ?? accent;
  const ctaText = theme?.ctaText ?? "#16130f";

  const soldCount = results.filter((r) => r.status === "sold").length;

  return (
    <div
      onClick={dismissSkipSetSummary}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#efece3] border-2 border-[#16130f] shadow-2xl rounded-[10px] flex flex-col overflow-hidden text-[#16130f] max-h-[85vh] cursor-default"
      >
        {/* Header — dark team overlay gradient with subtle dot texture (matches SOLD screen) */}
        <div
          className="px-6 pt-5 pb-4 shrink-0 relative"
          style={{
            backgroundImage: `${headerGradient}, radial-gradient(rgba(255,255,255,0.08) 1.2px, transparent 1.4px)`,
            backgroundSize: "100% 100%, 13px 13px",
            borderBottom: "2px solid #16130f",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div
                className="font-space-mono font-bold text-[10px] tracking-[.28em] uppercase mb-1.5"
                style={{ color: accent }}
              >
                Set Complete · Skipped
              </div>
              <h2
                className="font-anton text-[26px] leading-none uppercase tracking-wide truncate"
                style={{ color: headerText }}
              >
                {setName}
              </h2>
            </div>

            {userTeam && (
              <div className="flex items-center gap-2 shrink-0 pt-1">
                <span
                  className="font-anton text-[13px] tracking-wider uppercase px-2.5 py-1 rounded-[5px]"
                  style={{ backgroundColor: accent, color: ctaText }}
                >
                  {userTeam.shortName}
                </span>
              </div>
            )}
          </div>

          {/* Summary counts */}
          <div className="flex items-center gap-4 mt-3">
            <span className="font-space-mono text-[10px] tracking-widest uppercase" style={{ color: headerText, opacity: 0.85 }}>
              <span className="font-bold" style={{ color: accent }}>{soldCount}</span> Sold
            </span>
            <span className="font-space-mono text-[10px] tracking-widest uppercase" style={{ color: headerText, opacity: 0.85 }}>
              <span className="font-bold" style={{ color: accent }}>{results.length - soldCount}</span> Unsold
            </span>
            <span className="font-space-mono text-[10px] tracking-widest uppercase ml-auto" style={{ color: headerText, opacity: 0.6 }}>
              {results.length} Players
            </span>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {results.map((item, index) => {
            const team = item.teamId ? teams[item.teamId] : null;
            const isSold = item.status === "sold" && team && item.price !== undefined;
            return (
              <div
                key={`${item.player.id}-${index}`}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-[6px] hover:bg-[#16130f]/[0.04] transition-colors"
                style={{ borderBottom: index < results.length - 1 ? "1px solid rgba(22,19,15,.08)" : undefined }}
              >
                {/* Player info */}
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <span className="font-barlow font-bold text-[15px] text-[#16130f] truncate leading-tight">
                    {item.player.name}
                  </span>
                  <span className="font-space-mono font-bold text-[8px] tracking-wider text-[#5a5348] uppercase bg-[#16130f]/[0.06] px-1.5 py-0.5 rounded-[3px] shrink-0">
                    {item.player.role}
                  </span>
                  {item.player.nationality === "Overseas" && (
                    <span className="font-space-mono font-bold text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-[3px] shrink-0" style={{ color: accent, backgroundColor: `${accent}1a` }}>
                      OS
                    </span>
                  )}
                </div>

                {/* Outcome */}
                <div className="shrink-0 flex items-center gap-1.5">
                  {isSold ? (
                    <>
                      {item.usedRtm && (
                        <span className="font-space-mono font-bold text-[8px] tracking-widest uppercase text-[#16130f]/60 border border-[#16130f]/15 px-1.5 py-0.5 rounded-[3px]">
                          RTM
                        </span>
                      )}
                      <span
                        className="font-anton text-[11px] uppercase tracking-wider px-2 py-1 rounded-l-[5px]"
                        style={{ backgroundColor: team!.primaryColor, color: team!.secondaryColor }}
                      >
                        {team!.shortName}
                      </span>
                      <span className="font-anton text-[13px] text-[#16130f] px-2 py-1 -ml-1.5 bg-[#16130f]/[0.06] rounded-r-[5px]">
                        {crore(item.price!)}
                      </span>
                    </>
                  ) : (
                    <span className="font-space-mono font-bold text-[9px] tracking-widest text-[#d6492f] bg-[#d6492f]/[0.08] px-2 py-1 rounded-[4px] uppercase">
                      Unsold
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#e6e2d6] border-t-2 border-[#16130f] flex items-center justify-end gap-4 shrink-0">
          <button
            onClick={dismissSkipSetSummary}
            className="font-anton text-[15px] px-6 py-2 tracking-wide rounded-[6px] cursor-pointer transition-all duration-150 hover:brightness-110 active:scale-[0.97]"
            style={{
              backgroundColor: ctaBg,
              color: ctaText,
              border: "1.5px solid #16130f",
            }}
          >
            NEXT SET →
          </button>
        </div>
      </div>
    </div>
  );
}
