"use client";
import { useGameStore } from "@/lib/store/gameStore";
import StarRating from "@/components/shared/StarRating";

export default function SquadPage() {
  const { teams, userTeamId, players } = useGameStore();
  const userTeam = teams[userTeamId];

  if (!userTeam) return (
    <div className="flex items-center justify-center h-full text-text-secondary">
      No active game.
    </div>
  );

  const squadPlayers = userTeam.squad.map((id) => players[id]).filter(Boolean)
    .sort((a, b) => b.starRating - a.starRating);

  const roleOrder = ["WK-Batsman", "Batsman", "All-Rounder", "Pace Bowler", "Spin Bowler"];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-black text-text-primary mb-1">{userTeam.name} Squad</h1>
      <p className="text-text-secondary text-sm mb-6">
        {squadPlayers.length} players · {userTeam.overseasPlayersCurrent} overseas
      </p>

      {roleOrder.map((role) => {
        const group = squadPlayers.filter((p) => p.role === role);
        if (group.length === 0) return null;
        return (
          <div key={role} className="mb-6">
            <h3 className="text-xs uppercase tracking-widest text-text-secondary mb-2">{role}s</h3>
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="divide-y divide-border">
                {group.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-text-primary">{p.name}</div>
                      <div className="text-xs text-text-secondary">
                        Age {p.age} · {p.nationality} · {p.isCapped ? "Capped" : "Uncapped"}
                      </div>
                    </div>
                    <StarRating rating={p.starRating} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {squadPlayers.length === 0 && (
        <div className="bg-surface rounded-lg border border-border p-12 text-center">
          <div className="text-4xl mb-3">🏏</div>
          <div className="text-text-secondary">Your squad is empty. Head to the Auction!</div>
        </div>
      )}
    </div>
  );
}
