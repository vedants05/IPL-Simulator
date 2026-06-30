import { Player, Team, Difficulty } from "@/lib/types";
import { getNextBidAmount, canTeamBidOnPlayer, canTeamAffordBid } from "./auctionRules";

// ---------------------------------------------------------------------------
// Per-lot valuation cache
// Each team gets ONE valuation per player lot, computed once and cached.
// This prevents teams from changing their mind mid-lot and bidding erratically.
// ---------------------------------------------------------------------------
let _cachedLotId: string | null = null;
const _valuationCache: Record<string, number> = {}; // teamId → max bid (lakhs)

export function resetLotCache() {
  _cachedLotId = null;
  Object.keys(_valuationCache).forEach((k) => delete _valuationCache[k]);
}

// ---------------------------------------------------------------------------
// Realistic IPL-scale valuations
// Based on actual IPL auction results (2022–2024 mega/mini auctions).
//   5.0★ → ₹15–22Cr  |  4.5★ → ₹12–18Cr  |  4.0★ → ₹8–13Cr
//   3.5★ → ₹5–9Cr    |  3.0★ → ₹2.5–6Cr  |  2.5★ → ₹75L–2.5Cr
//   2.0★ → ₹30–100L  |  1.5★ → ₹20–50L
// ---------------------------------------------------------------------------
function starToBaseLakhs(star: number): number {
  // Piecewise linear interpolation between anchor points
  const anchors: [number, number][] = [
    [1.0, 22],
    [1.5, 35],
    [2.0, 65],
    [2.5, 175],
    [3.0, 375],
    [3.5, 700],
    [4.0, 1050],
    [4.5, 1500],
    [5.0, 1900],
  ];

  for (let i = 0; i < anchors.length - 1; i++) {
    const [s0, v0] = anchors[i];
    const [s1, v1] = anchors[i + 1];
    if (star >= s0 && star <= s1) {
      const t = (star - s0) / (s1 - s0);
      return v0 + t * (v1 - v0);
    }
  }
  return anchors[anchors.length - 1][1];
}

function computeRoleNeedMultiplier(player: Player, squad: Player[], team: Team): number {
  const sameRole = squad.filter((p) => p.role === player.role).length;
  const wkCount = squad.filter((p) => p.role === "WK-Batsman").length;

  // Desperate need
  if (sameRole === 0) return 1.25;

  // WK specifically needed (must have 2)
  if (player.role === "WK-Batsman" && wkCount < 2) return 1.2;

  // Normal need
  if (sameRole === 1) return 1.1;
  if (sameRole === 2) return 1.0;
  if (sameRole === 3) return 0.9;

  // Already well covered — much less interested
  return 0.7;
}

function computeBudgetPressureMultiplier(team: Team): number {
  // Teams with more remaining budget bid slightly more freely.
  // Teams running low get conservative fast.
  const pct = team.remainingPurse / 12000; // fraction of original purse
  if (pct > 0.7) return 1.05;
  if (pct > 0.5) return 1.0;
  if (pct > 0.3) return 0.92;
  if (pct > 0.15) return 0.82;
  return 0.70;
}

export function computeTeamValuation(
  player: Player,
  team: Team,
  allPlayers: Record<string, Player>,
  difficulty: Difficulty
): number {
  const squadPlayers = team.squad.map((id) => allPlayers[id]).filter(Boolean);

  const base = starToBaseLakhs(player.starRating);
  const needMult = computeRoleNeedMultiplier(player, squadPlayers, team);
  const budgetMult = computeBudgetPressureMultiplier(team);

  const personalityMult =
    team.aiPersonality === "Aggressive" ? 1.12 :
    team.aiPersonality === "Conservative" ? 0.88 : 1.0;

  const diffMult =
    difficulty === "Hard" ? 1.10 :
    difficulty === "Easy" ? 0.88 : 1.0;

  // Variance: ±12%, computed once and baked in (via cache)
  const variance = 0.88 + Math.random() * 0.24;

  const raw = base * needMult * budgetMult * personalityMult * diffMult * variance;

  // Hard cap: never value a player above 20% of remaining purse
  const purgeCap = team.remainingPurse * 0.20;

  // Also never value above a hard IPL-realistic ceiling per star band
  const starCap = starToBaseLakhs(player.starRating) * 1.6;

  return Math.round(Math.min(raw, purgeCap, starCap));
}

// Returns cached valuation for this lot (computed once per team per player)
export function getLotValuation(
  lotId: string,
  team: Team,
  player: Player,
  allPlayers: Record<string, Player>,
  difficulty: Difficulty
): number {
  if (lotId !== _cachedLotId) {
    resetLotCache();
    _cachedLotId = lotId;
  }

  if (_valuationCache[team.id] === undefined) {
    _valuationCache[team.id] = computeTeamValuation(player, team, allPlayers, difficulty);
  }

  return _valuationCache[team.id];
}

// ---------------------------------------------------------------------------
// Budget reserve: ensure teams keep enough for minimum squad
// ---------------------------------------------------------------------------
export function minimumReserveLakhs(team: Team): number {
  const spotsStillNeeded = Math.max(0, team.minSquadSize - team.squad.length - 1);
  // Reserve ~₹20L per remaining spot (domestic minimums)
  return spotsStillNeeded * 20;
}

// ---------------------------------------------------------------------------
// Single bid eligibility check
// ---------------------------------------------------------------------------
export function canAIBidAtAmount(
  team: Team,
  player: Player,
  nextBid: number,
  lotId: string,
  allPlayers: Record<string, Player>,
  difficulty: Difficulty
): boolean {
  const { canBid } = canTeamBidOnPlayer(team, player);
  if (!canBid) return false;

  if (!canTeamAffordBid(team, nextBid)) return false;

  const reserve = minimumReserveLakhs(team);
  if (team.remainingPurse - nextBid < reserve) return false;

  const valuation = getLotValuation(lotId, team, player, allPlayers, difficulty);
  return nextBid <= valuation;
}

// ---------------------------------------------------------------------------
// Pick which AI team bids next (weighted by how much headroom they have)
// Only teams that WANT to bid are passed in.
// ---------------------------------------------------------------------------
export function pickBiddingTeam(
  interestedTeams: Team[],
  player: Player,
  lotId: string,
  allPlayers: Record<string, Player>,
  difficulty: Difficulty
): Team | null {
  if (interestedTeams.length === 0) return null;

  // Weight = (valuation - currentBid) — teams with more headroom bid more often
  const weights = interestedTeams.map((t) => {
    const val = getLotValuation(lotId, t, player, allPlayers, difficulty);
    return Math.max(1, val);
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < interestedTeams.length; i++) {
    r -= weights[i];
    if (r <= 0) return interestedTeams[i];
  }
  return interestedTeams[0];
}

// ---------------------------------------------------------------------------
// Bid timing — realistic pacing
// ---------------------------------------------------------------------------
export function nextAIBidDelay(currentBid: number): number {
  // Cheaper lots → faster decisions; expensive lots → more deliberation
  if (currentBid < 100) return 1200 + Math.random() * 800;   // 1.2–2s
  if (currentBid < 500) return 1500 + Math.random() * 1000;  // 1.5–2.5s
  if (currentBid < 1000) return 1800 + Math.random() * 1200; // 1.8–3s
  return 2000 + Math.random() * 1500;                         // 2–3.5s
}

export function buildInitialTeamPurses(
  teams: Record<string, Team>
): Record<string, { remaining: number; squadCount: number }> {
  return Object.fromEntries(
    Object.values(teams).map((t) => [
      t.id,
      { remaining: t.remainingPurse, squadCount: t.squad.length },
    ])
  );
}

export function processBid(
  currentBid: number,
  teamId: string,
  existingHistory: import("@/lib/types").BidEntry[]
): Partial<import("@/lib/types").AuctionState> {
  const entry: import("@/lib/types").BidEntry = { teamId, amount: currentBid, timestamp: Date.now() };
  return {
    currentBid,
    currentHighBidderTeamId: teamId,
    biddingHistory: [entry, ...existingHistory],
    timerSeconds: 10,
  };
}
