import { fetchPlayersFromSupabase } from "../../../lib/supabase/fetchPlayers";
import { fetchTeamsFromSupabase } from "../../../lib/supabase/fetchTeams";
import { decideAIRetentions, estimateRetentionWorth } from "../../../lib/logic/auctionEngine";
import { NextResponse } from "next/server";

// Reads live data from Supabase — compute per request, don't prerender at build.
export const dynamic = "force-dynamic";

export async function GET() {
  const [players, teams] = await Promise.all([
    fetchPlayersFromSupabase(),
    fetchTeamsFromSupabase(),
  ]);
  const playersMap = Object.fromEntries(players.map(p => [p.id, p]));

  const results = teams.map(team => {
    const squad = players.filter(p => p.currentTeamId === team.id);
    const isCapped = (p: any) => p.isCapped || p.nationality === "Overseas";

    const valuations = squad.map(p => ({
      id: p.id,
      name: p.name,
      age: p.age,
      rating: Math.max(p.currentBatting || 0, p.currentBowling || 0),
      potential: Math.max(p.potentialBatting || 0, p.potentialBowling || 0),
      nationality: p.nationality,
      role: p.role,
      isCapped: isCapped(p),
      reputation: (p as any).reputation ?? 5,
      worth: Math.round(estimateRetentionWorth(p as any, team) / 100 * 100) / 100,
    })).sort((a, b) => b.worth - a.worth);

    const retained = decideAIRetentions(team, playersMap as any);

    return {
      teamId: team.id,
      teamName: team.name,
      purse: team.totalPurse,
      valuations,
      retained: retained.map(id => ({
        id,
        name: playersMap[id]?.name ?? id,
      })),
    };
  });

  return NextResponse.json(results);
}
