"use client";
import { useGameStore } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";

export default function OverviewPage() {
  const { teams, userTeamId, players, currentDate } = useGameStore();
  const userTeam = teams[userTeamId];

  if (!userTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="font-barlow text-text-secondary">
          No active game.{" "}
          <a href="/setup" className="text-text-primary underline font-semibold">Start a new game</a>
        </div>
      </div>
    );
  }

  const squadPlayers = userTeam.squad.map((id) => players[id]).filter(Boolean);

  const stats = [
    { label: "REMAINING PURSE", value: formatPrice(userTeam.remainingPurse), highlight: true },
    { label: "SQUAD SIZE", value: `${userTeam.squad.length}/25` },
    { label: "OVERSEAS", value: `${userTeam.overseasPlayersCurrent}/8` },
    { label: "PRESTIGE", value: `${userTeam.prestige}/10` },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="font-space-mono font-bold text-[10px] tracking-[.14em] text-text-secondary mb-2 uppercase">
          {currentDate} · Pre-Season
        </div>
        <h1 className="font-anton text-[40px] leading-none text-text-primary uppercase">{userTeam.name}</h1>
        <p className="font-barlow text-[13px] text-text-secondary mt-1">{userTeam.homeGround}</p>
      </div>

      {/* Stats */}
      <div className="flex border-2 border-border mb-8">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="flex-1 flex flex-col items-center justify-center py-5 px-4"
            style={i < stats.length - 1 ? { borderRight: "2px solid #16130f" } : {}}
          >
            <div className="font-space-mono text-[9px] tracking-widest text-text-secondary mb-2 uppercase">
              {stat.label}
            </div>
            <div
              className="font-barlow-condensed font-bold text-[22px] leading-none"
              style={{ color: stat.highlight ? "#1f9d57" : "#16130f" }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Squad table */}
      <div style={{ border: "2px solid #16130f" }}>
        <div className="px-5 py-3 bg-border">
          <span className="font-space-mono font-bold text-[10px] tracking-widest text-accent uppercase">
            Current Squad
          </span>
        </div>
        {squadPlayers.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-barlow text-[13px] text-text-secondary">
              No players yet. Head to the{" "}
              <a href="/game/auction" className="text-text-primary font-semibold underline">Auction</a>.
            </p>
          </div>
        ) : (
          squadPlayers.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: i < squadPlayers.length - 1 ? "1px solid rgba(22,19,15,.1)" : undefined }}
            >
              <div>
                <span className="font-barlow font-semibold text-[13px] text-text-primary">{p.name}</span>
                {p.nationality === "Overseas" && (
                  <span className="font-space-mono text-[9px] bg-accent text-border px-1.5 py-[2px] rounded-[3px] font-bold ml-2">
                    OS
                  </span>
                )}
              </div>
              <span className="font-space-mono text-[10px] text-text-secondary tracking-wider">{p.role.toUpperCase()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
