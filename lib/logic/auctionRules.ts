import { Player, Team, AuctionSet } from "@/lib/types";

export const TOTAL_PURSE_LAKHS = 12000; // ₹120 crore in lakhs

// IPL 2026 mega-auction retention costs
export const CAPPED_RETENTION_COSTS = [1800, 1400, 1100, 1800, 1400];
export const UNCAPPED_RETENTION_COST = 400;
export const MAX_CAPPED_RETENTIONS = 5;
export const MAX_UNCAPPED_RETENTIONS = 2;
export const MAX_TOTAL_RETENTIONS = 6;

function isPlayerCapped(player: Player): boolean {
  return player.isCapped || player.nationality === "Overseas";
}

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

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getRating(p: Player): number {
  return Math.max(p.currentBatting || 0, p.currentBowling || 0);
}

function getRoleGroup(p: Player): "WK" | "BAT" | "AR" | "PACE" | "SPIN" {
  if (p.isWicketkeeper || p.isPartTimeWk || p.role === "WK-Batsman") {
    return "WK";
  }
  if (p.role === "All-Rounder") {
    return "AR";
  }
  if (p.role === "Pace Bowler") {
    return "PACE";
  }
  if (p.role === "Spin Bowler") {
    return "SPIN";
  }
  return "BAT";
}

export function buildAuctionSets(players: Player[], isAccelerated = false): AuctionSet[] {
  if (isAccelerated) {
    return [
      {
        id: "accelerated",
        name: "Accelerated Auction",
        playerIds: shuffleArray(players.map((p) => p.id)),
        currentIndex: 0,
        isCompleted: false,
      },
    ];
  }

  // Only unretained players enter the mega auction sets
  const playerPool = players.filter((p) => !p.isRetained);

  // 1. Identify Marquee Players: anyone rated 85+ headlines the auction —
  // a proven uncapped superstar (Suryavanshi-type) is marquee billing too,
  // and must come up while teams still have full purses.
  const marqueeEligible = playerPool
    .filter((p) => getRating(p) >= 85)
    .sort((a, b) => getRating(b) - getRating(a));

  const marqueeIds = new Set(marqueeEligible.map((p) => p.id));

  // Non-marquee pool
  const nonMarquee = playerPool.filter((p) => !marqueeIds.has(p.id));

  // Separate Capped vs Uncapped
  const cappedNonMarquee = nonMarquee.filter((p) => p.isCapped);
  const uncappedPool = nonMarquee.filter((p) => !p.isCapped);

  // 2. Classify Capped Players into Set A and Set B by Role
  const isTierA = (p: Player) => {
    const rating = getRating(p);
    if (p.nationality === "Overseas" && rating >= 76) return true;
    return rating >= 80;
  };

  const cappedByRole = {
    BAT: { A: [] as Player[], B: [] as Player[] },
    AR: { A: [] as Player[], B: [] as Player[] },
    WK: { A: [] as Player[], B: [] as Player[] },
    PACE: { A: [] as Player[], B: [] as Player[] },
    SPIN: { A: [] as Player[], B: [] as Player[] },
  };

  cappedNonMarquee.forEach((p) => {
    const role = getRoleGroup(p);
    if (isTierA(p)) {
      cappedByRole[role].A.push(p);
    } else {
      cappedByRole[role].B.push(p);
    }
  });

  // 3. Classify Uncapped Players by Role
  const uncappedByRole = {
    BAT: [] as Player[],
    AR: [] as Player[],
    WK: [] as Player[],
    PACE: [] as Player[],
    SPIN: [] as Player[],
  };

  uncappedPool.forEach((p) => {
    const role = getRoleGroup(p);
    uncappedByRole[role].push(p);
  });

  const rawSets: Array<{ id: string; name: string; pool: Player[] }> = [];

  // Helper to chunk pools into sets of max 10 players, merging leftovers < 4 into previous chunk
  const addCategoryPools = (
    pools: Player[][],
    baseId: string,
    baseTitle: string,
    maxPerSet = 10,
    minSetSize = 4
  ) => {
    const allPlayers: Player[] = [];
    pools.forEach((pool) => {
      allPlayers.push(...shuffleArray(pool));
    });

    if (allPlayers.length === 0) return;

    const chunks: Player[][] = [];
    for (let i = 0; i < allPlayers.length; i += maxPerSet) {
      chunks.push(allPlayers.slice(i, i + maxPerSet));
    }

    // Merge leftover chunk < minSetSize into previous chunk
    if (chunks.length > 1 && chunks[chunks.length - 1].length < minSetSize) {
      const lastChunk = chunks.pop()!;
      chunks[chunks.length - 1].push(...lastChunk);
    }

    chunks.forEach((chunk, index) => {
      const setId = chunks.length === 1 ? baseId : `${baseId}_${index + 1}`;
      const setName =
        chunks.length === 1
          ? baseTitle
          : `${baseTitle} Set ${String.fromCharCode(65 + index)}`;
      rawSets.push({ id: setId, name: setName, pool: shuffleArray(chunk) });
    });
  };

  // Macro Order Sequence:
  // 1. Marquee Sets
  if (marqueeEligible.length > 0) {
    addCategoryPools([marqueeEligible], "marquee", "Marquee");
  }

  // 2. Capped Sequence (Tier A + Tier B by Role)
  const cappedRoles = [
    { code: "BAT" as const, title: "Capped Batters" },
    { code: "AR" as const, title: "Capped All-Rounders" },
    { code: "WK" as const, title: "Capped Wicketkeepers" },
    { code: "PACE" as const, title: "Capped Fast Bowlers" },
    { code: "SPIN" as const, title: "Capped Spinners" },
  ];

  cappedRoles.forEach(({ code, title }) => {
    addCategoryPools(
      [cappedByRole[code].A, cappedByRole[code].B],
      `capped_${code.toLowerCase()}`,
      title
    );
  });

  // 3. Uncapped Sequence
  const uncappedRoles = [
    { code: "BAT" as const, title: "Uncapped Batters" },
    { code: "AR" as const, title: "Uncapped All-Rounders" },
    { code: "WK" as const, title: "Uncapped Wicketkeepers" },
    { code: "PACE" as const, title: "Uncapped Fast Bowlers" },
    { code: "SPIN" as const, title: "Uncapped Spinners" },
  ];

  uncappedRoles.forEach(({ code, title }) => {
    addCategoryPools(
      [uncappedByRole[code]],
      `uncapped_${code.toLowerCase()}`,
      title
    );
  });

  // Format each set name with explicit Set Number (e.g. Set 1: Marquee Set A)
  return rawSets.map((s, i) => ({
    id: s.id,
    name: `Set ${i + 1}: ${s.name}`,
    playerIds: s.pool.map((p) => p.id),
    currentIndex: 0,
    isCompleted: false,
  }));
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

export function findRTMEligibleTeam(
  player: Player,
  teams: Record<string, Team>,
  winnerTeamId: string,
  requiredPurse?: number
): string | null {
  const h2026 = player.iplHistory.find(
    (h) => h.season === "2026" && h.teamId !== winnerTeamId
  );
  if (!h2026) return null;
  const team = teams[h2026.teamId];
  if (!team) return null;
  if (team.rtmCardsUsed >= team.rtmCardsTotal) return null;
  if (player.nationality === "Overseas" && team.overseasPlayersCurrent >= team.overseasPlayersMax) return null;
  if (team.squad.length >= team.maxSquadSize) return null;
  if (requiredPurse !== undefined && team.remainingPurse < requiredPurse) return null;
  return h2026.teamId;
}
