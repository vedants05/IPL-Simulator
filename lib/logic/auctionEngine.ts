import { Player, Team } from "@/lib/types";
import { getNextBidAmount, canTeamBidOnPlayer, canTeamAffordBid } from "./auctionRules";

// ---------------------------------------------------------------------------
// Per-lot valuation cache — computed once per team per player lot
// ---------------------------------------------------------------------------
let _cachedLotId: string | null = null;
const _valuationCache: Record<string, number> = {};

export function resetLotCache() {
  _cachedLotId = null;
  Object.keys(_valuationCache).forEach((k) => delete _valuationCache[k]);
}

export interface AuctionContext {
  remainingPlayerIds: string[];
  soldPlayerIds: string[];
  currentLotIndex: number;
  totalLots: number;
}

interface SquadComp {
  batters: number; wks: number; allrounders: number;
  spinners: number; pacers: number;
  overseas: number; indians: number; total: number;
}

// IPL structural rules — these are fixed (league rules, not preferences)
const RULES = {
  batters: 5, wks: 2, allrounders: 2, spinners: 2, pacers: 3,
  minTotal: 18, maxTotal: 25, maxOverseas: 8, minSalaryPerSlot: 20,
};

function getSquadComp(squad: Player[]): SquadComp {
  return {
    batters:     squad.filter(p => p.role === "Batsman").length,
    wks:         squad.filter(p => p.role === "WK-Batsman").length,
    allrounders: squad.filter(p => p.role === "All-Rounder").length,
    spinners:    squad.filter(p => p.role === "Spin Bowler").length,
    pacers:      squad.filter(p => p.role === "Pace Bowler").length,
    overseas:    squad.filter(p => p.nationality === "Overseas").length,
    indians:     squad.filter(p => p.nationality === "Indian").length,
    total:       squad.length,
  };
}

function totalMissingSlots(comp: SquadComp): number {
  return (
    Math.max(0, RULES.batters     - comp.batters)     +
    Math.max(0, RULES.wks         - comp.wks)         +
    Math.max(0, RULES.allrounders - comp.allrounders) +
    Math.max(0, RULES.spinners    - comp.spinners)     +
    Math.max(0, RULES.pacers      - comp.pacers)
  );
}

// ---------------------------------------------------------------------------
// Core samplers — every random value flows through one of these two
// ---------------------------------------------------------------------------

function u(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function lognormal(sigma: number): number {
  const u1 = Math.max(1e-10, Math.random());
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.exp(sigma * z);
}

// ---------------------------------------------------------------------------
// FSM — each team samples its own panic/snooze thresholds, not a global step
// ---------------------------------------------------------------------------
type FSMState = "Snoozing" | "Hunting" | "Panic";

function getFSMState(team: Team, comp: SquadComp, ctx: AuctionContext): FSMState {
  const slotsToMin = Math.max(0, RULES.minTotal - comp.total);
  const prog = ctx.totalLots > 0 ? ctx.currentLotIndex / ctx.totalLots : 0;

  // Thresholds sampled — earlier panic triggers to ensure teams fill squads
  if (slotsToMin > 0 && prog > u(0.55, 0.72)) return "Panic";
  if (comp.wks === 0  && prog > u(0.46, 0.60)) return "Panic";

  const satisfied = totalMissingSlots(comp) === 0;
  if (satisfied && team.remainingPurse < team.totalPurse * u(0.11, 0.19)) return "Snoozing";

  return "Hunting";
}

// ---------------------------------------------------------------------------
// Market-rate anchors (IPL salary-calibrated, not changed)
// ---------------------------------------------------------------------------
function starToBaseLakhs(star: number): number {
  // Anchors calibrated to IPL 2025 mega auction prices.
  // Mid-tier (2.5–3.5★) boosted so 70-80-rated players reach realistic hammer prices.
  const anchors: [number, number][] = [
    [1.0, 25], [1.5, 45], [2.0, 80], [2.5, 230],
    [3.0, 500], [3.5, 900], [4.0, 1300], [4.5, 1700], [5.0, 2200],
  ];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [s0, v0] = anchors[i];
    const [s1, v1] = anchors[i + 1];
    if (star >= s0 && star <= s1) return v0 + ((star - s0) / (s1 - s0)) * (v1 - v0);
  }
  return anchors[anchors.length - 1][1];
}

// ---------------------------------------------------------------------------
// Role need — every return is a sampled range, not a hardcoded point
// ---------------------------------------------------------------------------
function getRoleNeedMult(player: Player, comp: SquadComp, fsm: FSMState): number {
  const r = player.role;

  if (fsm === "Panic") {
    if (r === "WK-Batsman"  && comp.wks         < RULES.wks)         return u(2.5, 3.6);
    if (r === "Batsman"     && comp.batters      < RULES.batters)     return u(1.9, 3.1);
    if (r === "Pace Bowler" && comp.pacers       < RULES.pacers)      return u(1.9, 3.1);
    if (r === "Spin Bowler" && comp.spinners     < RULES.spinners)    return u(1.9, 3.1);
    if (r === "All-Rounder" && comp.allrounders  < RULES.allrounders) return u(1.5, 2.5);
    if (comp.total < RULES.minTotal)                                   return u(1.3, 2.1);
    return u(0.30, 0.65); // Role covered in panic — mostly skipped
  }

  if (r === "WK-Batsman") {
    if (comp.wks === 0) return u(1.6, 2.5);
    if (comp.wks === 1) return u(1.1, 1.7);
    return u(0.45, 0.80);
  }

  const bowlers = comp.pacers + comp.spinners;
  const hitters = comp.batters + comp.wks;
  if (bowlers > hitters + 2) {
    if (r === "Batsman")                              return u(1.15, 1.50);
    if (r === "All-Rounder")                          return u(1.05, 1.28);
    if (r === "Pace Bowler" || r === "Spin Bowler")   return u(0.45, 0.80);
  }
  if (hitters > bowlers + 3) {
    if (r === "Pace Bowler" || r === "Spin Bowler")   return u(1.15, 1.50);
    if (r === "All-Rounder")                          return u(1.05, 1.28);
    if (r === "Batsman")                              return u(0.50, 0.85);
  }

  if (r === "Batsman"     && comp.batters      < RULES.batters)      return u(1.08, 1.42);
  if (r === "Pace Bowler" && comp.pacers       < RULES.pacers)       return u(1.08, 1.42);
  if (r === "Spin Bowler" && comp.spinners     < RULES.spinners)     return u(1.08, 1.42);
  if (r === "All-Rounder" && comp.allrounders  < RULES.allrounders)  return u(1.05, 1.38);

  let excess = 0;
  if (r === "Batsman")     excess = comp.batters      - RULES.batters;
  if (r === "Pace Bowler") excess = comp.pacers        - RULES.pacers;
  if (r === "Spin Bowler") excess = comp.spinners      - RULES.spinners;
  if (r === "All-Rounder") excess = comp.allrounders   - RULES.allrounders;
  if (excess >= 4) return u(0.28, 0.58);
  if (excess >= 3) return u(0.42, 0.72);
  if (excess >= 2) return u(0.58, 0.88);
  if (excess >= 1) return u(0.74, 1.04);

  return u(0.88, 1.12); // At exactly target — slight noise either side
}

// ---------------------------------------------------------------------------
// Nationality — values are ranges around IPL-calibrated anchors
// ---------------------------------------------------------------------------
function getNatMult(player: Player, comp: SquadComp): number {
  if (player.nationality === "Overseas") {
    if (comp.overseas >= RULES.maxOverseas) return 0; // Hard IPL rule
    // Overseas premium declines only as team fills slots (IPL reality: first 4 slots are coveted)
    if (comp.overseas >= 6) return u(0.68, 0.88);
    if (comp.overseas >= 4) return u(0.80, 1.02);
    if (comp.overseas >= 2) return u(0.90, 1.12);
    return u(0.96, 1.18); // First 2 overseas slots get a premium
  }
  return comp.overseas > comp.indians ? u(1.04, 1.26) : u(0.94, 1.06);
}

// ---------------------------------------------------------------------------
// Loyalty — probability of premium AND size of premium both sampled
// ---------------------------------------------------------------------------
function getLoyaltyMult(player: Player, team: Team): number {
  const wasMine = player.iplHistory.some(h => h.teamId === team.id);
  if (!wasMine) return u(0.96, 1.04);
  return Math.random() < u(0.50, 0.78)
    ? u(1.06, 1.30)   // loyalty premium — size varies per team
    : u(0.96, 1.06);  // no premium this time
}

// ---------------------------------------------------------------------------
// Budget — continuous concave curve + per-team noise, no step thresholds
// ---------------------------------------------------------------------------
function getBudgetMult(team: Team): number {
  const pct = team.remainingPurse / team.totalPurse;
  // Higher floor (0.55) so teams with depleted purses still bid competitively.
  // Teams with budget should spend it — upper range ~1.20.
  const exponent = u(0.65, 0.95);
  const base = 0.55 + Math.pow(Math.max(0, pct), exponent) * 0.65;
  return base * lognormal(u(0.04, 0.09));
}

// ---------------------------------------------------------------------------
// Scarcity — ranges not fixed points; baseline noise even when plentiful
// ---------------------------------------------------------------------------
function getScarcityMult(
  player: Player,
  allPlayers: Record<string, Player>,
  ctx: AuctionContext
): number {
  const minStar = player.starRating - 0.5;
  const remaining = ctx.remainingPlayerIds.filter(id => {
    const p = allPlayers[id];
    return p && p.role === player.role && p.starRating >= minStar;
  }).length;

  if (remaining <= 1) return u(1.22, 1.58);
  if (remaining <= 3) return u(1.08, 1.32);
  if (remaining <= 6) return u(1.00, 1.20);
  return u(0.93, 1.07); // Noise even when plenty of alternatives
}

// ---------------------------------------------------------------------------
// Urgency — both the trigger thresholds and the response magnitudes are sampled
// ---------------------------------------------------------------------------
function getUrgencyMult(comp: SquadComp, ctx: AuctionContext): number {
  const prog    = ctx.totalLots > 0 ? ctx.currentLotIndex / ctx.totalLots : 0;
  const missing = totalMissingSlots(comp);
  // Earlier panic + stronger multipliers so teams buy enough players
  if (missing > 0 && prog > u(0.65, 0.80)) return u(1.25, 1.65);
  if (missing > 0 && prog > u(0.42, 0.60)) return u(1.08, 1.30);
  return u(0.97, 1.05);
}

// ---------------------------------------------------------------------------
// Personality — every bonus and threshold is a sampled range
// ---------------------------------------------------------------------------
function getPersonalityMult(player: Player, team: Team): number {
  const curBat = player.currentBatting ?? 0;
  let m = 1.0;

  switch (team.id) {
    case "MI":
      if (player.starRating >= 4.5)                                 m *= u(1.07, 1.23);
      if (player.age <= 22 && player.potential === "Wonderkid")     m *= u(1.10, 1.30);
      break;

    case "CSK":
      if (player.age >= 33)                                         m *= u(1.07, 1.23);
      if (player.role === "All-Rounder")                            m *= u(1.10, 1.30);
      if (player.role === "Spin Bowler")                            m *= u(1.04, 1.20);
      break;

    case "RCB":
      if (player.starRating >= 5.0)                                 m *= u(1.16, 1.44);
      if ((player.role === "Batsman" || player.role === "WK-Batsman") && curBat >= 85)
                                                                    m *= u(1.10, 1.30);
      if (team.remainingPurse > team.totalPurse * u(0.48, 0.72))   m *= u(1.05, 1.19);
      break;

    case "KKR":
      if (player.role === "All-Rounder")                            m *= u(1.13, 1.37);
      if ((player.role === "Batsman" || player.role === "WK-Batsman") && player.starRating >= 3.5)
                                                                    m *= u(1.03, 1.17);
      break;

    case "RR":
      m *= u(0.76, 0.94);
      if (player.role === "Spin Bowler")                            m *= u(1.10, 1.30);
      if (player.starRating <= 2.5 && player.potential === "Promising")
                                                                    m *= u(1.08, 1.24);
      break;

    case "SRH":
      if (player.nationality === "Overseas")                        m *= u(1.07, 1.23);
      if (player.role === "Pace Bowler")                            m *= u(1.04, 1.20);
      if ((player.role === "Batsman" || player.role === "WK-Batsman") && curBat >= 82)
                                                                    m *= u(1.07, 1.23);
      break;
  }

  return m;
}

// ---------------------------------------------------------------------------
// Participation — base rates AND personality modifiers are ranges
// ---------------------------------------------------------------------------
function getRoleExcess(role: string, comp: SquadComp): number {
  if (role === "WK-Batsman")  return comp.wks         - RULES.wks;
  if (role === "Batsman")     return comp.batters      - RULES.batters;
  if (role === "Pace Bowler") return comp.pacers       - RULES.pacers;
  if (role === "Spin Bowler") return comp.spinners     - RULES.spinners;
  if (role === "All-Rounder") return comp.allrounders  - RULES.allrounders;
  return 0;
}

function shouldParticipate(player: Player, team: Team, comp: SquadComp, fsm: FSMState): boolean {
  if (fsm === "Panic") {
    // In panic: always bid if the role is genuinely needed
    return getRoleNeedMult(player, comp, fsm) > 1.5 || Math.random() < u(0.18, 0.40);
  }
  if (player.role === "WK-Batsman" && comp.wks === 0) return true;

  const excess = getRoleExcess(player.role, comp);
  const star   = player.starRating;

  // Base chance is itself a range — so even two teams with the same squad
  // composition independently draw different participation thresholds
  let chance: number;
  if (excess < 0) {
    // Role needed — significantly more interest, especially for mid-tier players
    chance = star >= 4.5 ? u(0.60, 0.85) : star >= 4.0 ? u(0.46, 0.70) : u(0.30, 0.54);
  } else if (excess === 0) {
    // At target — roughly doubled vs before so bidding wars happen
    chance = star >= 4.5 ? u(0.28, 0.52) : star >= 3.5 ? u(0.18, 0.36) : u(0.10, 0.24);
  } else if (excess === 1) {
    // Slight overshoot — some opportunistic bidding
    chance = star >= 4.5 ? u(0.10, 0.24) : u(0.04, 0.14);
  } else {
    chance = u(0.008, 0.030);
  }

  if (team.id === "RCB" && star >= 4.5)                       chance += u(0.07, 0.23);
  if (team.id === "MI"  && star >= 4.5)                       chance += u(0.04, 0.16);
  if (team.id === "CSK" && player.age >= 33)                  chance += u(0.03, 0.13);
  if (team.id === "KKR" && player.role === "All-Rounder")     chance += u(0.04, 0.16);
  if (team.id === "SRH" && player.nationality === "Overseas") chance += u(0.05, 0.18);
  if (team.id === "RR")                                       chance *= u(0.50, 0.75);

  return Math.random() < Math.min(0.90, chance);
}

// ---------------------------------------------------------------------------
// Core valuation — everything stochastic, locked in once via the cache
// ---------------------------------------------------------------------------
export function computeTeamValuation(
  player: Player,
  team: Team,
  allPlayers: Record<string, Player>,
  ctx: AuctionContext
): number {
  const squad = team.squad.map(id => allPlayers[id]).filter(Boolean);
  const comp  = getSquadComp(squad);
  const fsm   = getFSMState(team, comp, ctx);

  if (fsm === "Snoozing") {
    // Snoozing teams bid at roughly base price but with noise (might sneak a value bid)
    return Math.round(player.basePrice * lognormal(u(0.08, 0.18)));
  }

  if (!shouldParticipate(player, team, comp, fsm)) return 0;

  const base = starToBaseLakhs(player.starRating);

  // Form: range of both the floor and the rating sensitivity
  const relevantRating = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
  const formMult = relevantRating > 0
    ? u(0.86, 0.94) + (relevantRating / 100) * u(0.14, 0.26)
    : u(0.94, 1.06);

  const roleNeed    = getRoleNeedMult(player, comp, fsm);
  if (roleNeed < 0.1) return 0;

  const natMult     = getNatMult(player, comp);
  if (natMult === 0) return 0;

  const loyalty     = getLoyaltyMult(player, team);
  const personality = getPersonalityMult(player, team);
  const budget      = getBudgetMult(team);
  const scarcity    = getScarcityMult(player, allPlayers, ctx);
  const urgency     = getUrgencyMult(comp, ctx);

  // Private market read: sigma is itself sampled so some lots are "consensus"
  // (teams agree on value, σ≈0.18) and some are "contested" (teams wildly
  // disagree, σ≈0.38), creating unpredictable bidding wars
  const lnSigma = u(0.18, 0.38);
  const lnVar   = lognormal(lnSigma);

  const raw = base * formMult * roleNeed * natMult * loyalty * personality * budget * scarcity * urgency * lnVar;

  // Commitment: fraction of purse this team will risk on a single player.
  // Raised mean so teams don't hoard purse — realistic IPL spending patterns.
  const commitMean = u(0.22, 0.42);
  const commitPct  = Math.max(0.10, Math.min(0.58, commitMean * lognormal(u(0.15, 0.28))));
  const purseCap   = team.remainingPurse * commitPct;

  // Soft ceiling: the market-rate multiplier is sampled so sometimes
  // teams are willing to pay 2× base, sometimes 2.8× (perceived scarcity)
  const ceilMult = u(1.70, 2.90);
  const softCeil = base * ceilMult;
  const carryPct = u(0.08, 0.28); // how much of over-ceiling raw carries through
  const cappedRaw = raw > softCeil
    ? softCeil + (raw - softCeil) * carryPct
    : raw;

  return Math.round(Math.min(cappedRaw, purseCap));
}

// ---------------------------------------------------------------------------
// Cached lot valuation
// ---------------------------------------------------------------------------
export function getLotValuation(
  lotId: string,
  team: Team,
  player: Player,
  allPlayers: Record<string, Player>,
  ctx: AuctionContext
): number {
  if (lotId !== _cachedLotId) {
    resetLotCache();
    _cachedLotId = lotId;
  }
  if (_valuationCache[team.id] === undefined) {
    _valuationCache[team.id] = computeTeamValuation(player, team, allPlayers, ctx);
  }
  return _valuationCache[team.id];
}

// ---------------------------------------------------------------------------
// Purse reserve safety check
// ---------------------------------------------------------------------------
export function minimumReserveLakhs(team: Team, allPlayers: Record<string, Player>): number {
  const squad = team.squad.map(id => allPlayers[id]).filter(Boolean);
  const slotsNeeded = Math.max(0, RULES.minTotal - squad.length - 1);
  return slotsNeeded * RULES.minSalaryPerSlot;
}

// ---------------------------------------------------------------------------
// Hard eligibility gate (IPL rules — not probabilistic)
// ---------------------------------------------------------------------------
export function canAIBidAtAmount(
  team: Team,
  player: Player,
  nextBid: number,
  lotId: string,
  allPlayers: Record<string, Player>,
  ctx: AuctionContext
): boolean {
  const { canBid } = canTeamBidOnPlayer(team, player);
  if (!canBid) return false;
  if (!canTeamAffordBid(team, nextBid)) return false;

  const squad = team.squad.map(id => allPlayers[id]).filter(Boolean);

  if (player.nationality === "Overseas") {
    const overseas = squad.filter(p => p.nationality === "Overseas").length;
    if (overseas >= RULES.maxOverseas) return false;
  }
  if (squad.length >= RULES.maxTotal) return false;

  const reserve = minimumReserveLakhs(team, allPlayers);
  if (team.remainingPurse - nextBid < reserve) return false;

  const valuation = getLotValuation(lotId, team, player, allPlayers, ctx);
  if (valuation === 0) return false;
  if (nextBid > valuation) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Pick which AI team bids (weighted by valuation headroom)
// ---------------------------------------------------------------------------
export function pickBiddingTeam(
  interestedTeams: Team[],
  player: Player,
  lotId: string,
  allPlayers: Record<string, Player>,
  ctx: AuctionContext
): Team | null {
  if (interestedTeams.length === 0) return null;

  const weights = interestedTeams.map(t =>
    Math.max(1, getLotValuation(lotId, t, player, allPlayers, ctx))
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < interestedTeams.length; i++) {
    r -= weights[i];
    if (r <= 0) return interestedTeams[i];
  }
  return interestedTeams[0];
}

// ---------------------------------------------------------------------------
// Bid timing — three-zone mixture, weights shift as price rises.
// Every band has all three zones; only the probabilities change.
// At low prices most bids are fast but ~12% can still take 3-5s.
// At high prices most bids are slow but ~18% are instant counters.
// ---------------------------------------------------------------------------
export function nextAIBidDelay(currentBid: number): number {
  const r = Math.random();

  if (currentBid < 300) {
    if (r < 0.62) return u(300,  1100);   // 62% quick
    if (r < 0.88) return u(1200, 2500);   // 26% normal
    return              u(3000, 5000);     // 12% slow
  }
  if (currentBid < 1200) {
    if (r < 0.35) return u(500,  1500);   // 35% quick
    if (r < 0.72) return u(2000, 4500);   // 37% normal
    return              u(5000, 8500);     // 28% slow
  }
  // High money — deliberation heavy
  if (r < 0.18) return u(800,  2000);    // 18% quick counter
  if (r < 0.58) return u(3000, 6000);    // 40% normal
  return              u(6500, 10000);     // 42% long think
}

export function buildInitialTeamPurses(
  teams: Record<string, Team>
): Record<string, { remaining: number; squadCount: number }> {
  return Object.fromEntries(
    Object.values(teams).map(t => [
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
