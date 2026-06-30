"use client";
import { useGameStore } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";

export default function OverviewPage() {
  const { teams, userTeamId, players, currentDate } = useGameStore();
  const userTeam = teams[userTeamId];

  if (!userTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary">No active game. <a href="/setup" className="text-accent underline">Start a new game</a></div>
      </div>
    );
  }

  const squadPlayers = userTeam.squad.map((id) => players[id]).filter(Boolean);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-text-primary">{userTeam.name}</h1>
        <p className="text-text-secondary">{userTeam.homeGround} · {currentDate}</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Remaining Purse", value: formatPrice(userTeam.remainingPurse), color: "text-success" },
          { label: "Squad Size", value: `${userTeam.squad.length}/25`, color: "text-text-primary" },
          { label: "Overseas", value: `${userTeam.overseasPlayersCurrent}/8`, color: "text-text-primary" },
          { label: "Prestige", value: `${userTeam.prestige}/10`, color: "text-gold" },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface rounded-lg border border-border p-4">
            <div className="text-xs text-text-secondary mb-1">{stat.label}</div>
            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Current Squad</h3>
        </div>
        {squadPlayers.length === 0 ? (
          <div className="p-8 text-center text-text-secondary text-sm">
            No players yet. Head to the <a href="/game/auction" className="text-accent underline">Auction</a>.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {squadPlayers.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-text-primary">{p.name}</span>
                <span className="text-text-secondary">{p.role}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
