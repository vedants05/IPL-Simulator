import { Player, Team, AuctionSet } from "@/lib/types";

export const TOTAL_PURSE_LAKHS = 12000; // ₹120 crore in lakhs

// IPL 2026 mega-auction retention costs
// Capped slots 1-5: 18, 14, 11, 18, 14 Cr (in lakhs)
export const CAPPED_RETENTION_COSTS = [1800, 1400, 1100, 1800, 1400];
export const UNCAPPED_RETENTION_COST = 400; // ₹4 Cr per uncapped player
export const MAX_CAPPED_RETENTIONS = 5;
export const MAX_UNCAPPED_RETENTIONS = 2;
export const MAX_TOTAL_RETENTIONS = 6;

function isPlayerCapped(player: Player): boolean {
  return player.isCapped || player.nationality === "Overseas";
}

/** Cost to retain a specific player given which players are already retained (in order). */
export function getPlayerRetentionCost(
  playerId: string,
  alreadyRetained: string[],
  players: Record<string, Player>
): number {
  const player = players[playerId];
  if (!player) return 0;
  if (!isPlayerCapped(player)) return UNCAPPED_RETENTION_COST;
  const cappedBefore = alreadyRetained.filter((id) => {
    const p = players[id];
    return p && isPlayerCapped(p);
  }).length;
  return CAPPED_RETENTION_COSTS[cappedBefore] ?? 0;
}

/** Total purse cost for an ordered retention list. */
export function calculateTotalRetentionCost(
  retainedIds: string[],
  players: Record<string, Player>
): number {
  let cappedCount = 0;
  let total = 0;
  for (const id of retainedIds) {
    const p = players[id];
    if (!p) continue;
    if (isPlayerCapped(p)) {
      total += CAPPED_RETENTION_COSTS[cappedCount] ?? 0;
      cappedCount++;
    } else {
      total += UNCAPPED_RETENTION_COST;
    }
  }
  return total;
}

export function getNextBidAmount(currentBid: number): number {
  if (currentBid < 100) return currentBid + 5;
  if (currentBid < 200) return currentBid + 10;
  if (currentBid < 500) return currentBid + 20;
  return currentBid + 25;
}

export function formatPrice(lakhs: number): string {
  if (lakhs >= 100) {
    const crore = lakhs / 100;
    return `₹${crore % 1 === 0 ? crore.toFixed(0) : crore.toFixed(2)} Cr`;
  }
  return `₹${lakhs}L`;
}

export function buildAuctionSets(players: Player[], isAccelerated = false): AuctionSet[] {
  const marquee = players.filter((p) => p.basePrice >= 200 && !isAccelerated);
  const batsmen = players.filter(
    (p) => (p.role === "Batsman" || p.role === "WK-Batsman") && !marquee.includes(p)
  );
  const allRounders = players.filter((p) => p.role === "All-Rounder" && !marquee.includes(p));
  const paceBowlers = players.filter((p) => p.role === "Pace Bowler" && !marquee.includes(p));
  const spinBowlers = players.filter((p) => p.role === "Spin Bowler" && !marquee.includes(p));

  if (isAccelerated) {
    return [
      {
        id: "accelerated",
        name: "Accelerated Auction",
        playerIds: players.map((p) => p.id),
        currentIndex: 0,
        isCompleted: false,
      },
    ];
  }

  const sets: AuctionSet[] = [];

  if (marquee.length > 0) {
    sets.push({
      id: "marquee",
      name: "Marquee Players",
      playerIds: marquee.map((p) => p.id),
      currentIndex: 0,
      isCompleted: false,
    });
  }

  if (batsmen.length > 0) {
    sets.push({
      id: "batsmen",
      name: "Batsmen & Wicket-Keepers",
      playerIds: batsmen.map((p) => p.id),
      currentIndex: 0,
      isCompleted: false,
    });
  }

  if (allRounders.length > 0) {
    sets.push({
      id: "allrounders",
      name: "All-Rounders",
      playerIds: allRounders.map((p) => p.id),
      currentIndex: 0,
      isCompleted: false,
    });
  }

  if (paceBowlers.length > 0) {
    sets.push({
      id: "pace",
      name: "Pace Bowlers",
      playerIds: paceBowlers.map((p) => p.id),
      currentIndex: 0,
      isCompleted: false,
    });
  }

  if (spinBowlers.length > 0) {
    sets.push({
      id: "spin",
      name: "Spin Bowlers",
      playerIds: spinBowlers.map((p) => p.id),
      currentIndex: 0,
      isCompleted: false,
    });
  }

  return sets;
}

export function canTeamBidOnPlayer(team: Team, player: Player): { canBid: boolean; reason?: string } {
  if (team.squad.length >= team.maxSquadSize) {
    return { canBid: false, reason: "Squad is full (25/25)" };
  }

  if (player.nationality === "Overseas" && team.overseasPlayersCurrent >= team.overseasPlayersMax) {
    return { canBid: false, reason: "Overseas cap reached (8/8)" };
  }

  return { canBid: true };
}

export function canTeamAffordBid(team: Team, bidAmount: number): boolean {
  return team.remainingPurse >= bidAmount;
}

export function getSquadConstraintWarnings(team: Team, players: Record<string, Player>): string[] {
  const warnings: string[] = [];
  const squadPlayers = team.squad.map((id) => players[id]).filter(Boolean);

  const wks = squadPlayers.filter((p) => p.role === "WK-Batsman").length;
  if (wks < 2) {
    warnings.push(`Need at least 2 wicket-keepers (have ${wks})`);
  }

  if (team.squad.length < team.minSquadSize) {
    warnings.push(`Squad too small (${team.squad.length}/${team.minSquadSize} minimum)`);
  }

  return warnings;
}

/** Returns the teamId that has RTM rights on this player (if any), excluding the winner. */
export function findRTMEligibleTeam(
  player: Player,
  teams: Record<string, Team>,
  winnerTeamId: string
): string | null {
  const h2025 = player.iplHistory.find(
    (h) => h.season === "2025" && h.teamId !== winnerTeamId
  );
  if (!h2025) return null;
  const team = teams[h2025.teamId];
  if (!team) return null;
  if (team.rtmCardsUsed >= team.rtmCardsTotal) return null;
  if (player.nationality === "Overseas" && team.overseasPlayersCurrent >= team.overseasPlayersMax) return null;
  if (team.squad.length >= team.maxSquadSize) return null;
  return h2025.teamId;
}
