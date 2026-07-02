"use client";
import { useGameStore } from "@/lib/store/gameStore";

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
  const userTeam = teams[userTeamId];

  if (!userTeam) return null;

  const squadPlayers = userTeam.squad.map((id) => players[id]).filter(Boolean);
  const purseInfo = auction?.teamPurses[userTeamId];
  const remaining = purseInfo?.remaining ?? userTeam.remainingPurse;
  const rtmLeft = userTeam.rtmCardsTotal - userTeam.rtmCardsUsed;

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="px-4 h-[36px] flex items-center shrink-0" style={{ borderBottom: "2px solid #16130f" }}>
        <div className="flex items-center gap-2">
          <div
            className="h-5 min-w-[22px] px-1 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 transition-colors duration-200"
            style={{ backgroundColor: "var(--team-accent)", color: "var(--team-accent-text)" }}
          >
            {userTeam.shortName}
          </div>
          <span className="font-space-mono font-bold text-[10px] tracking-widest text-text-primary uppercase">
            Your Squad
          </span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex shrink-0" style={{ borderBottom: "2px solid #16130f" }}>
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
                {group.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-[6px]"
                    style={{ borderBottom: "1px solid rgba(22,19,15,.08)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-barlow font-semibold text-[11.5px] text-text-primary truncate leading-tight">
                        {p.name}
                      </div>
                      <div className="flex items-center gap-1 mt-[1px]">
                        {p.nationality === "Overseas" && (
                          <span className="font-space-mono text-[7px] bg-accent text-border px-1 rounded-[2px] font-bold">OS</span>
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
                          className="w-2 h-2 rounded-sm transition-colors duration-200"
                          style={{ backgroundColor: si < p.starRating ? "var(--team-accent)" : "rgba(22,19,15,.12)" }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* Purse footer: REMAINING container box */}
      <div
        className="shrink-0 h-[52px] px-4 flex justify-between items-center transition-colors duration-200"
        style={{ borderTop: "2px solid #16130f", backgroundColor: "var(--app-base-bg, #f4f1ea)" }}
      >
        <span className="font-space-mono text-[9px] tracking-widest text-text-secondary uppercase">REMAINING</span>
        <span
          className="font-anton text-[20px] text-success leading-none"
        >
          {crore(remaining)}
        </span>
      </div>
    </div>
  );
}
