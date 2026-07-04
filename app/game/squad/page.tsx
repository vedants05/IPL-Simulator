"use client";
import { useGameStore } from "@/lib/store/gameStore";

export default function SquadPage() {
  const { teams, userTeamId, players } = useGameStore();
  const userTeam = teams[userTeamId];

  if (!userTeam) return (
    <div className="flex items-center justify-center h-full font-barlow text-text-secondary">
      No active game.
    </div>
  );

  const squadPlayers = userTeam.squad.map((id) => players[id]).filter(Boolean)
    .sort((a, b) => {
      const ratingA = Math.max(a.currentBatting || 0, a.currentBowling || 0);
      const ratingB = Math.max(b.currentBatting || 0, b.currentBowling || 0);
      return ratingB - ratingA;
    });

  const roleGroups = [
    { label: "Wicketkeepers", roles: ["WK-Batsman"] },
    { label: "Batters", roles: ["Batsman"] },
    { label: "All-Rounders", roles: ["All-Rounder"] },
    { label: "Pace Bowlers", roles: ["Pace Bowler"] },
    { label: "Spin Bowlers", roles: ["Spin Bowler"] },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-anton text-[40px] leading-none text-text-primary uppercase">
          {userTeam.name} Squad
        </h1>
        <p className="font-barlow text-[13px] text-text-secondary mt-1">
          {squadPlayers.length} players · {userTeam.overseasPlayersCurrent} overseas
        </p>
      </div>

      {squadPlayers.length === 0 ? (
        <div className="border-2 border-border p-12 text-center">
          <p className="font-barlow text-[14px] text-text-secondary">
            Your squad is empty. Head to the <a href="/game/auction" className="underline font-semibold text-text-primary">Auction</a>!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {roleGroups.map(({ label, roles }) => {
            const group = squadPlayers.filter((p) => roles.includes(p.role));
            if (group.length === 0) return null;
            return (
              <div key={label}>
                <div className="font-space-mono font-bold text-[9px] tracking-widest text-text-secondary uppercase mb-2">
                  {label}
                </div>
                <div style={{ border: "2px solid #16130f" }}>
                  {group.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-5 py-4"
                      style={i < group.length - 1 ? { borderBottom: "1px solid rgba(22,19,15,.12)" } : {}}
                    >
                      <div>
                        <div className="font-barlow font-semibold text-[14px] text-text-primary">{p.name}</div>
                        <div className="font-space-mono text-[9px] tracking-wider text-text-secondary mt-0.5">
                          AGE {p.age} · {p.nationality.toUpperCase()} · {p.isCapped ? "CAPPED" : "UNCAPPED"}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {p.nationality === "Overseas" && (
                          <span className="font-space-mono text-[9px] bg-accent text-border px-2 py-[2px] rounded-[3px] font-bold">
                            OS
                          </span>
                        )}
                        <div className="font-space-mono text-[9px] text-text-secondary bg-[#16130f]/5 px-2 py-[2px] rounded font-bold">
                          RTG: {Math.max(p.currentBatting || 0, p.currentBowling || 0)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
