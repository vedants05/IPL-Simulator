import { Player, Team, AuctionSet } from "@/lib/types";

export const TOTAL_PURSE_LAKHS = 12000; // ₹120 crore in lakhs
export const MAX_AUCTION_TARGETS = 5;

// IPL 2026 mega-auction retention costs
export const CAPPED_RETENTION_COSTS = [1800, 1400, 1100, 1800, 1400];
export const UNCAPPED_RETENTION_COST = 400;
export const MAX_CAPPED_RETENTIONS = 5;
export const MAX_UNCAPPED_RETENTIONS = 2;
export const MAX_TOTAL_RETENTIONS = 6;

function isPlayerCapped(player: Player): boolean {
  return player.isCapped || player.nationality === "Overseas";
}

export function getCappedRetentionSlabsForCount(count: number): number[] {
  if (count <= 1) return [1800];
  if (count === 2) return [1800, 1400];
  if (count === 3) return [1800, 1400, 1100];
  if (count === 4) return [1800, 1800, 1400, 1100];
  return [1800, 1800, 1400, 1400, 1100]; // count >= 5
}

export function getPlayerRetentionCost(
  playerId: string,
  alreadyRetained: string[],
  players: Record<string, Player>
): number {
  const player = players[playerId];
  if (!player) return 0;
  if (!isPlayerCapped(player)) return UNCAPPED_RETENTION_COST;

  const retainedList = alreadyRetained.includes(playerId)
    ? alreadyRetained
    : [...alreadyRetained, playerId];

  const cappedPlayers = retainedList
    .filter((id) => {
      const p = players[id];
      return p && isPlayerCapped(p);
    })
    .map((id) => players[id])
    .sort((a, b) => {
      const rA = Math.max(a.currentBatting || 0, a.currentBowling || 0);
      const rB = Math.max(b.currentBatting || 0, b.currentBowling || 0);
      if (rB !== rA) return rB - rA;
      return a.id.localeCompare(b.id);
    });

  const slabs = getCappedRetentionSlabsForCount(cappedPlayers.length);
  const idx = cappedPlayers.findIndex((p) => p.id === playerId);
  if (idx === -1) return 0;
  return slabs[idx] ?? 0;
}

export function calculateTotalRetentionCost(
  retainedIds: string[],
  players: Record<string, Player>
): number {
  const cappedPlayers = retainedIds
    .filter((id) => {
      const p = players[id];
      return p && isPlayerCapped(p);
    })
    .map((id) => players[id])
    .sort((a, b) => {
      const rA = Math.max(a.currentBatting || 0, a.currentBowling || 0);
      const rB = Math.max(b.currentBatting || 0, b.currentBowling || 0);
      if (rB !== rA) return rB - rA;
      return a.id.localeCompare(b.id);
    });

  const slabs = getCappedRetentionSlabsForCount(cappedPlayers.length);
  
  let total = 0;
  cappedPlayers.forEach((p, idx) => {
    total += slabs[idx] ?? 0;
  });

  const uncappedCount = retainedIds.length - cappedPlayers.length;
  total += uncappedCount * UNCAPPED_RETENTION_COST;

  return total;
}

export function getNextBidAmount(currentBid: number): number {
  if (currentBid < 100) return currentBid + 5;
  if (currentBid < 200) return currentBid + 10;
  if (currentBid < 500) return currentBid + 20;
  return currentBid + 25;
}

export function roundDownToLegalBid(basePrice: number, requestedAmount: number): number {
  if (requestedAmount <= basePrice) return basePrice;
  if (requestedAmount < 100) {
    return Math.max(basePrice, Math.floor(requestedAmount / 5) * 5);
  }
  if (requestedAmount < 200) {
    return Math.max(basePrice, 100 + Math.floor((requestedAmount - 100) / 10) * 10);
  }
  if (requestedAmount < 500) {
    return Math.max(basePrice, 200 + Math.floor((requestedAmount - 200) / 20) * 20);
  }
  return Math.max(basePrice, 500 + Math.floor((requestedAmount - 500) / 25) * 25);
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
  const isFullTime = (p.isWicketkeeper || p.role === "WK-Batsman") && !p.isPartTimeWk;
  if (isFullTime) {
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

  // Quality score for set-tiering: current ability dominates, ceiling and
  // reputation pull genuinely promising / marquee names into earlier sets
  const qualityScore = (p: Player): number => {
    const rating = getRating(p);
    const pot = Math.max(p.potentialBatting || 0, p.potentialBowling || 0);
    const rep = p.reputation ?? 5;
    return rating + Math.max(0, pot - rating) * 0.35 + rep * 1.2;
  };

  // Rank a pool by quality and slice into tiers of 10 (A = best 10, B = next
  // 10, …). A trailing tier of < 4 players merges into the previous one.
  const buildTiers = (pool: Player[], maxPerSet = 10, minSetSize = 4): Player[][] => {
    if (pool.length === 0) return [];
    const sorted = [...pool].sort((a, b) => qualityScore(b) - qualityScore(a));
    const chunks: Player[][] = [];
    for (let i = 0; i < sorted.length; i += maxPerSet) {
      chunks.push(sorted.slice(i, i + maxPerSet));
    }
    if (chunks.length > 1 && chunks[chunks.length - 1].length < minSetSize) {
      const lastChunk = chunks.pop()!;
      chunks[chunks.length - 1].push(...lastChunk);
    }
    return chunks;
  };

  // 1. Marquee: anyone rated 85+ headlines the auction — a proven uncapped
  // superstar (Suryavanshi-type) is marquee billing too, and must come up
  // while teams still have full purses.
  const marqueeEligible = playerPool.filter((p) => getRating(p) >= 84);
  const marqueeIds = new Set(marqueeEligible.map((p) => p.id));
  const nonMarquee = playerPool.filter((p) => !marqueeIds.has(p.id));

  const rawSets: Array<{ id: string; name: string; pool: Player[] }> = [];

  const marqueeTiers = buildTiers(marqueeEligible);
  marqueeTiers.forEach((chunk, i) => {
    rawSets.push({
      id: marqueeTiers.length === 1 ? "marquee" : `marquee_${i + 1}`,
      name: marqueeTiers.length === 1 ? "Marquee" : `Marquee Set ${String.fromCharCode(65 + i)}`,
      pool: shuffleArray(chunk),
    });
  });

  // 2. Capped then uncapped, in round-robin tier order: every category's
  // Set A first (best 10 of each role), then every Set B, then C, … so the
  // auction's quality — and the money — tapers evenly instead of one role's
  // full pool draining budgets before another role has even started.
  const ROLE_ORDER = [
    { code: "BAT" as const, title: "Batters" },
    { code: "AR" as const, title: "All-Rounders" },
    { code: "WK" as const, title: "Wicketkeepers" },
    { code: "PACE" as const, title: "Fast Bowlers" },
    { code: "SPIN" as const, title: "Spinners" },
  ];

  const addRoundRobinTiers = (pool: Player[], prefix: "capped" | "uncapped") => {
    const byRole: Record<string, Player[]> = { BAT: [], AR: [], WK: [], PACE: [], SPIN: [] };
    pool.forEach((p) => byRole[getRoleGroup(p)].push(p));

    const tiersByRole: Record<string, Player[][]> = {};
    let maxTiers = 0;
    ROLE_ORDER.forEach(({ code }) => {
      tiersByRole[code] = buildTiers(byRole[code]);
      maxTiers = Math.max(maxTiers, tiersByRole[code].length);
    });

    const titleCase = prefix === "capped" ? "Capped" : "Uncapped";
    for (let tier = 0; tier < maxTiers; tier++) {
      ROLE_ORDER.forEach(({ code, title }) => {
        const chunk = tiersByRole[code][tier];
        if (!chunk) return; // this role ran out of tiers — skip
        const single = tiersByRole[code].length === 1;
        rawSets.push({
          id: single ? `${prefix}_${code.toLowerCase()}` : `${prefix}_${code.toLowerCase()}_${tier + 1}`,
          name: single
            ? `${titleCase} ${title}`
            : `${titleCase} ${title} Set ${String.fromCharCode(65 + tier)}`,
          pool: shuffleArray(chunk),
        });
      });
    }
  };

  addRoundRobinTiers(nonMarquee.filter((p) => p.isCapped), "capped");
  addRoundRobinTiers(nonMarquee.filter((p) => !p.isCapped), "uncapped");

  // Format each set name with explicit Set Number (e.g. Set 1: Marquee Set A)
  return rawSets.map((s, i) => ({
    id: s.id,
    name: `Set ${i + 1}: ${s.name}`,
    playerIds: s.pool.map((p) => p.id),
    currentIndex: 0,
    isCompleted: false,
  }));
}

const isKeeper = (p: Player) => !!(p.isWicketkeeper || p.isPartTimeWk || p.role === "WK-Batsman");

export function canTeamBidOnPlayer(
  team: Team,
  player: Player,
  allPlayers?: Record<string, Player>,
  enforceAllRounderLimit = true
): { canBid: boolean; reason?: string } {
  if (team.squad.length >= team.maxSquadSize) {
    return { canBid: false, reason: "Squad is full (25/25)" };
  }

  if (player.nationality === "Overseas" && team.overseasPlayersCurrent >= team.overseasPlayersMax) {
    return { canBid: false, reason: "Overseas cap reached (8/8)" };
  }

  if (enforceAllRounderLimit && player.role === "All-Rounder" && allPlayers) {
    const squadPlayers = team.squad.map(id => allPlayers[id]).filter(Boolean);
    const allRoundersCount = squadPlayers.filter(p => p.role === "All-Rounder").length;
    if (allRoundersCount >= 6) {
      return { canBid: false, reason: "All-rounder limit reached (6/6)" };
    }
  }

  return { canBid: true };
}

export function canTeamAffordBid(team: Team, bidAmount: number, players?: Record<string, Player>): boolean {
  // Purse Reserve Rule: must keep at least 30 Lakhs for each remaining slot to reach the minimum players
  // AND satisfy the 5 specialist bowler requirement, 2 spinners, 2 keepers, 4 Indian bowlers, and 5 Indian batters > 74 (with 3 > 77).
  const minSquad = team.minSquadSize ?? 18;
  let slotsNeeded = Math.max(0, minSquad - team.squad.length - 1);
  if (players) {
    const squadPlayers = team.squad.map(id => players[id]).filter(Boolean);
    const bowlersCount = squadPlayers.filter(p => p.role === "Pace Bowler" || p.role === "Spin Bowler").length;
    const keepersCount = squadPlayers.filter(isKeeper).length;
    const spinnersCount = squadPlayers.filter(p => p.role === "Spin Bowler").length;
    
    const isIndianBatter = (p: Player) => p.nationality === "Indian" && (p.role === "Batsman" || p.role === "WK-Batsman");
    const ratingOf = (p: Player) => Math.max(p.currentBatting ?? 0, p.currentBowling ?? 0);
    
    const indianBowlersCount = squadPlayers.filter(p => p.nationality === "Indian" && (p.role === "Pace Bowler" || p.role === "Spin Bowler")).length;
    const indianBatters74Count = squadPlayers.filter(p => isIndianBatter(p) && ratingOf(p) > 74).length;
    const indianBatters77Count = squadPlayers.filter(p => isIndianBatter(p) && ratingOf(p) > 77).length;

    const needsBowlers = Math.max(0, 5 - bowlersCount);
    const needsKeepers = keepersCount < 2 ? 2 - keepersCount : 0;
    const needsSpinners = Math.max(0, 2 - spinnersCount);
    const needsIndianBowlers = Math.max(0, 4 - indianBowlersCount);
    const needsIndianBatters77 = Math.max(0, 3 - indianBatters77Count);
    const needsIndianBatters74 = Math.max(0, 5 - indianBatters74Count);
    
    const totalIndianBattersSlotsNeeded = Math.max(needsIndianBatters74, needsIndianBatters77);
    const bowlerSlotsNeeded = Math.max(needsBowlers, needsSpinners, needsIndianBowlers);
    const batterKeeperSlotsNeeded = Math.max(needsKeepers, totalIndianBattersSlotsNeeded);

    const roleSlotsNeeded = bowlerSlotsNeeded + batterKeeperSlotsNeeded;
    slotsNeeded = Math.max(0, minSquad - team.squad.length, roleSlotsNeeded) - 1;
  }
  const reservePerSlot = (team.squad.length >= 16) ? 15 : 30; // Lower reserve from 30L to 15L for final slots to prevent bidding blockages
  const fillerSlotsNeeded = Math.max(0, 22 - team.squad.length - 1);
  const fillerReserve = fillerSlotsNeeded * 30; // Reserve 30L per slot to reach 22 players
  const reserve = Math.max(Math.max(0, slotsNeeded) * reservePerSlot, fillerReserve);
  return team.remainingPurse - bidAmount >= reserve;
}

export function getSquadConstraintWarnings(team: Team, players: Record<string, Player>): string[] {
  const warnings: string[] = [];
  const squadPlayers = team.squad.map((id) => players[id]).filter(Boolean);

  const wks = squadPlayers.filter(isKeeper).length;
  if (wks < 2) {
    warnings.push(`Need at least 2 wicket-keepers (have ${wks})`);
  }

  const bowlersCount = squadPlayers.filter(p => p.role === "Pace Bowler" || p.role === "Spin Bowler").length;
  if (bowlersCount < 5) {
    warnings.push(`Need at least 5 specialist bowlers (have ${bowlersCount})`);
  }

  const spinnersCount = squadPlayers.filter(p => p.role === "Spin Bowler").length;
  if (spinnersCount < 2) {
    warnings.push(`Need at least 2 specialist spinners (have ${spinnersCount})`);
  }

  const indianBowlersCount = squadPlayers.filter(p => p.nationality === "Indian" && (p.role === "Pace Bowler" || p.role === "Spin Bowler")).length;
  if (indianBowlersCount < 4) {
    warnings.push(`Need at least 4 Indian out-and-out bowlers (have ${indianBowlersCount})`);
  }

  const isIndianBatter = (p: Player) => p.nationality === "Indian" && (p.role === "Batsman" || p.role === "WK-Batsman");
  const ratingOf = (p: Player) => Math.max(p.currentBatting ?? 0, p.currentBowling ?? 0);

  const indianBatters74Count = squadPlayers.filter(p => isIndianBatter(p) && ratingOf(p) > 74).length;
  if (indianBatters74Count < 5) {
    warnings.push(`Need at least 5 Indian batters/WKs rated >74 (have ${indianBatters74Count})`);
  }

  const indianBatters77Count = squadPlayers.filter(p => isIndianBatter(p) && ratingOf(p) > 77).length;
  if (indianBatters77Count < 3) {
    warnings.push(`Need at least 3 Indian batters/WKs rated >77 (have ${indianBatters77Count})`);
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
  if (requiredPurse !== undefined) {
    const reserve = Math.max(0, team.minSquadSize - team.squad.length - 1) * 30;
    if (team.remainingPurse - requiredPurse < reserve) return null;
  }
  return h2026.teamId;
}
