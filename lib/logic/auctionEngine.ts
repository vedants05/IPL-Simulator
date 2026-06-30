import { Player, Team, Difficulty } from "@/lib/types";
import { getNextBidAmount, canTeamBidOnPlayer, canTeamAffordBid } from "./auctionRules";

// ---------------------------------------------------------------------------
// Per-lot valuation cache — each team gets ONE valuation per player lot,
// computed once and locked in. Prevents mid-lot mind changes.
// ---------------------------------------------------------------------------
let _cachedLotId: string | null = null;
const _valuationCache: Record<string, number> = {};

export function resetLotCache() {
  _cachedLotId = null;
  Object.keys(_valuationCache).forEach((k) => delete _valuationCache[k]);
}

// ---------------------------------------------------------------------------
// Auction context passed from the store each round
// ---------------------------------------------------------------------------
export interface AuctionContext {
  remainingPlayerIds: string[]; // IDs not yet sold (excluding current lot)
  soldPlayerIds: string[];
  currentLotIndex: number;
  totalLots: number;
}

// ---------------------------------------------------------------------------
// Squad composition types
// ---------------------------------------------------------------------------
interface SquadComp {
  batters: number;
  wks: number;
  allrounders: number;
  spinners: number;
  pacers: number;
  overseas: number;
  indians: number;
  total: number;
}

// Minimum composition every team should reach
const TARGETS = {
  batters:     5,
  wks:         2,
  allrounders: 2,
  spinners:    2,
  pacers:      3,
  minTotal:    18,
  maxTotal:    25,
  maxOverseas: 8,
  minSalaryPerSlot: 20, // ₹20L floor per remaining slot
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
    Math.max(0, TARGETS.batters     - comp.batters)     +
    Math.max(0, TARGETS.wks         - comp.wks)         +
    Math.max(0, TARGETS.allrounders - comp.allrounders) +
    Math.max(0, TARGETS.spinners    - comp.spinners)     +
    Math.max(0, TARGETS.pacers      - comp.pacers)
  );
}

// ---------------------------------------------------------------------------
// FSM — three bidding modes
// ---------------------------------------------------------------------------
type FSMState = "Snoozing" | "Hunting" | "Panic";

function getFSMState(team: Team, comp: SquadComp, ctx: AuctionContext): FSMState {
  const slotsToMin = Math.max(0, TARGETS.minTotal - comp.total);
  const prog = ctx.totalLots > 0 ? ctx.currentLotIndex / ctx.totalLots : 0;

  // Panic: not at minimum squad, auction is >70% done
  if (slotsToMin > 0 && prog > 0.7) return "Panic";
  // Panic: no wicketkeeper at all and >60% of auction done
  if (comp.wks === 0 && prog > 0.6) return "Panic";

  // Snoozing: composition targets met and nearly out of budget
  const satisfied = totalMissingSlots(comp) === 0;
  if (satisfied && team.remainingPurse < team.totalPurse * 0.15) return "Snoozing";

  return "Hunting";
}

// ---------------------------------------------------------------------------
// Base star → lakhs scale (real IPL anchors)
// ---------------------------------------------------------------------------
function starToBaseLakhs(star: number): number {
  const anchors: [number, number][] = [
    [1.0, 22], [1.5, 35], [2.0, 65], [2.5, 175],
    [3.0, 375], [3.5, 700], [4.0, 1050], [4.5, 1500], [5.0, 1900],
  ];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [s0, v0] = anchors[i];
    const [s1, v1] = anchors[i + 1];
    if (star >= s0 && star <= s1) {
      return v0 + ((star - s0) / (s1 - s0)) * (v1 - v0);
    }
  }
  return anchors[anchors.length - 1][1];
}

// ---------------------------------------------------------------------------
// Multiplier: role need + squad composition matrix + FSM
// ---------------------------------------------------------------------------
function getRoleNeedMult(player: Player, comp: SquadComp, fsm: FSMState): number {
  const r = player.role;

  if (fsm === "Panic") {
    if (r === "WK-Batsman"  && comp.wks         < TARGETS.wks)         return 3.0;
    if (r === "Batsman"     && comp.batters      < TARGETS.batters)     return 2.5;
    if (r === "Pace Bowler" && comp.pacers       < TARGETS.pacers)      return 2.5;
    if (r === "Spin Bowler" && comp.spinners     < TARGETS.spinners)    return 2.5;
    if (r === "All-Rounder" && comp.allrounders  < TARGETS.allrounders) return 2.0;
    if (comp.total < TARGETS.minTotal) return 1.8; // Any player helps fill the squad
    return 0.5; // Role already covered — skip in panic
  }

  // Wicketkeeper priority (hardcoded because WK scarcity is critical)
  if (r === "WK-Batsman") {
    if (comp.wks === 0) return 2.0;
    if (comp.wks === 1) return 1.4;
    return 0.65; // Already have 2+ WKs
  }

  // Role balance: more bowlers → value batters more, and vice versa
  const bowlers = comp.pacers + comp.spinners;
  const hitters = comp.batters + comp.wks;
  if (bowlers > hitters + 2) {
    if (r === "Batsman")     return 1.3;
    if (r === "All-Rounder") return 1.15;
    if (r === "Pace Bowler" || r === "Spin Bowler") return 0.65;
  }
  if (hitters > bowlers + 3) {
    if (r === "Pace Bowler" || r === "Spin Bowler") return 1.3;
    if (r === "All-Rounder") return 1.15;
    if (r === "Batsman") return 0.7;
  }

  // Unfilled required slots
  if (r === "Batsman"     && comp.batters      < TARGETS.batters)     return 1.25;
  if (r === "Pace Bowler" && comp.pacers       < TARGETS.pacers)      return 1.25;
  if (r === "Spin Bowler" && comp.spinners     < TARGETS.spinners)    return 1.25;
  if (r === "All-Rounder" && comp.allrounders  < TARGETS.allrounders) return 1.2;

  // Diminishing returns for excess of this role
  let filled = 0;
  if (r === "Batsman")     filled = comp.batters      - TARGETS.batters;
  if (r === "Pace Bowler") filled = comp.pacers        - TARGETS.pacers;
  if (r === "Spin Bowler") filled = comp.spinners      - TARGETS.spinners;
  if (r === "All-Rounder") filled = comp.allrounders   - TARGETS.allrounders;
  if (filled >= 4) return 0.45;
  if (filled >= 3) return 0.6;
  if (filled >= 2) return 0.75;
  if (filled >= 1) return 0.9;

  return 1.0;
}

// ---------------------------------------------------------------------------
// Multiplier: nationality (Indians valued more; overseas limit enforced)
// ---------------------------------------------------------------------------
function getNatMult(player: Player, comp: SquadComp): number {
  if (player.nationality === "Overseas") {
    if (comp.overseas >= TARGETS.maxOverseas) return 0; // Hard block
    if (comp.overseas >= 6) return 0.68;
    if (comp.overseas >= 4) return 0.80;
    return 0.88; // Base overseas discount vs equivalent Indian
  }
  // Indian: slight premium if team is overseas-heavy
  const overseasHeavy = comp.overseas > comp.indians;
  return overseasHeavy ? 1.15 : 1.0;
}

// ---------------------------------------------------------------------------
// Multiplier: loyalty (previously owned player — not guaranteed)
// ---------------------------------------------------------------------------
function getLoyaltyMult(player: Player, team: Team): number {
  const wasMine = player.iplHistory.some(h => h.teamId === team.id);
  if (!wasMine) return 1.0;
  return Math.random() < 0.65 ? 1.18 : 1.0; // 65% chance of loyalty premium
}

// ---------------------------------------------------------------------------
// Multiplier: budget pressure (less money → more conservative)
// ---------------------------------------------------------------------------
function getBudgetMult(team: Team): number {
  const pct = team.remainingPurse / team.totalPurse;
  if (pct > 0.70) return 1.08;
  if (pct > 0.50) return 1.00;
  if (pct > 0.35) return 0.88;
  if (pct > 0.20) return 0.74;
  if (pct > 0.10) return 0.58;
  return 0.42;
}

// ---------------------------------------------------------------------------
// Multiplier: market scarcity (fewer quality players left → pay more)
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
  if (remaining <= 1) return 1.4;
  if (remaining <= 3) return 1.2;
  if (remaining <= 6) return 1.1;
  return 1.0;
}

// ---------------------------------------------------------------------------
// Multiplier: squad urgency (empty required slots near end of auction)
// ---------------------------------------------------------------------------
function getUrgencyMult(comp: SquadComp, ctx: AuctionContext): number {
  const prog  = ctx.totalLots > 0 ? ctx.currentLotIndex / ctx.totalLots : 0;
  const missing = totalMissingSlots(comp);
  if (missing > 0 && prog > 0.8) return 1.25;
  if (missing > 0 && prog > 0.6) return 1.12;
  return 1.0;
}

// ---------------------------------------------------------------------------
// Multiplier: team behavioral personality
// ---------------------------------------------------------------------------
function getPersonalityMult(player: Player, team: Team, comp: SquadComp): number {
  const curBat  = player.currentBatting  ?? 0;
  const curBowl = player.currentBowling  ?? 0;
  let m = 1.0;

  switch (team.id) {
    case "MI":
      // Elite assets + youth prospects
      if (player.starRating >= 4.5) m *= 1.15;
      if (player.age <= 22 && player.potential === "Wonderkid") m *= 1.2;
      break;

    case "CSK":
      // Veterans + all-rounders + spin
      if (player.age >= 33) m *= 1.15;
      if (player.role === "All-Rounder") m *= 1.2;
      if (player.role === "Spin Bowler") m *= 1.12;
      break;

    case "RCB":
      // Marquee stars + explosive top-order; reckless early
      if (player.starRating >= 5.0) m *= 1.3;
      if ((player.role === "Batsman" || player.role === "WK-Batsman") && curBat >= 85) m *= 1.2;
      if (team.remainingPurse > team.totalPurse * 0.6) m *= 1.12; // Reckless with flush purse
      break;

    case "KKR":
      // All-rounders + adaptable middle order
      if (player.role === "All-Rounder") m *= 1.25;
      if ((player.role === "Batsman" || player.role === "WK-Batsman") && player.starRating >= 3.5) m *= 1.1;
      break;

    case "RR":
      // Value hunting: never overpay; loves specialist spin + undervalued gems
      m *= 0.85;
      if (player.role === "Spin Bowler") m *= 1.2;
      if (player.starRating <= 2.5 && player.potential === "Promising") m *= 1.15;
      break;

    case "SRH":
      // High-impact overseas talent + aggressive batters + pace
      if (player.nationality === "Overseas") m *= 1.15;
      if (player.role === "Pace Bowler") m *= 1.12;
      if ((player.role === "Batsman" || player.role === "WK-Batsman") && curBat >= 82) m *= 1.15;
      break;
  }

  return m;
}

// ---------------------------------------------------------------------------
// Participation check — not every team bids on every player even if they
// need that role. Models teams "saving" for their own targets.
// ---------------------------------------------------------------------------
function getRoleExcess(role: string, comp: SquadComp): number {
  if (role === "WK-Batsman")  return comp.wks         - TARGETS.wks;
  if (role === "Batsman")     return comp.batters      - TARGETS.batters;
  if (role === "Pace Bowler") return comp.pacers       - TARGETS.pacers;
  if (role === "Spin Bowler") return comp.spinners     - TARGETS.spinners;
  if (role === "All-Rounder") return comp.allrounders  - TARGETS.allrounders;
  return 0;
}

function shouldParticipate(player: Player, team: Team, comp: SquadComp, fsm: FSMState): boolean {
  if (fsm === "Panic") return true; // Always in panic
  const excess = getRoleExcess(player.role, comp);

  // Base participation chance by role saturation
  let chance = excess < 0  ? 0.82  // Role is missing
    : excess === 0          ? 0.65  // Role at target
    : excess === 1          ? 0.42  // Slight excess
    : excess === 2          ? 0.22  // Too many
    :                         0.08; // Way over-staffed

  // WK: if no keeper at all, always participate (regardless of role)
  if (player.role === "WK-Batsman" && comp.wks === 0) return true;

  // Team personality modifiers
  if (team.id === "RR") chance *= 0.70;  // Value hunters — very selective
  if (team.id === "RCB" && player.starRating >= 4.5) chance = Math.min(0.95, chance * 1.4);
  if (team.id === "MI" && player.starRating >= 4.5) chance = Math.min(0.90, chance * 1.2);

  return Math.random() < Math.min(0.95, chance);
}

// ---------------------------------------------------------------------------
// Core valuation
// ---------------------------------------------------------------------------
export function computeTeamValuation(
  player: Player,
  team: Team,
  allPlayers: Record<string, Player>,
  difficulty: Difficulty,
  ctx: AuctionContext
): number {
  const squad = team.squad.map(id => allPlayers[id]).filter(Boolean);
  const comp  = getSquadComp(squad);
  const fsm   = getFSMState(team, comp, ctx);

  // Snoozing: only bid at base price
  if (fsm === "Snoozing") return player.basePrice;

  // Participation check: team might sit this lot out
  if (!shouldParticipate(player, team, comp, fsm)) return 0;

  // Base market rate from star rating
  const base = starToBaseLakhs(player.starRating);

  // Form factor: current batting/bowling rating shifts valuation vs star tier
  const relevantRating = Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
  const formMult = relevantRating > 0 ? 0.80 + (relevantRating / 100) * 0.40 : 1.0;

  const roleNeed    = getRoleNeedMult(player, comp, fsm);
  if (roleNeed === 0) return 0;

  const natMult     = getNatMult(player, comp);
  if (natMult === 0) return 0;

  const loyalty     = getLoyaltyMult(player, team);
  const personality = getPersonalityMult(player, team, comp);
  const budget      = getBudgetMult(team);
  const scarcity    = getScarcityMult(player, allPlayers, ctx);
  const urgency     = getUrgencyMult(comp, ctx);
  const diffMult    = difficulty === "Hard" ? 1.10 : difficulty === "Easy" ? 0.88 : 1.0;

  // Wider variance (±20%) so identical-star players sell at different prices
  const variance = 0.80 + Math.random() * 0.40;

  const raw = base * formMult * roleNeed * natMult * loyalty * personality * budget * scarcity * urgency * diffMult * variance;

  // Purse safety net: 40% of remaining purse — generous enough to not dominate
  // but stops reckless over-spending late in auction
  const purseCap = team.remainingPurse * 0.40;

  // Star-band ceiling: max 2× the base market rate for this tier
  const starCap = fsm === "Panic"
    ? player.basePrice * 15
    : starToBaseLakhs(player.starRating) * 2.0;

  return Math.round(Math.min(raw, purseCap, starCap));
}

// ---------------------------------------------------------------------------
// Cached lot valuation (computed once per team per player lot)
// ---------------------------------------------------------------------------
export function getLotValuation(
  lotId: string,
  team: Team,
  player: Player,
  allPlayers: Record<string, Player>,
  difficulty: Difficulty,
  ctx: AuctionContext
): number {
  if (lotId !== _cachedLotId) {
    resetLotCache();
    _cachedLotId = lotId;
  }
  if (_valuationCache[team.id] === undefined) {
    _valuationCache[team.id] = computeTeamValuation(player, team, allPlayers, difficulty, ctx);
  }
  return _valuationCache[team.id];
}

// ---------------------------------------------------------------------------
// Purse reserve: keep enough for remaining minimum squad slots
// ---------------------------------------------------------------------------
export function minimumReserveLakhs(team: Team, allPlayers: Record<string, Player>): number {
  const squad = team.squad.map(id => allPlayers[id]).filter(Boolean);
  const slotsNeeded = Math.max(0, TARGETS.minTotal - squad.length - 1);
  return slotsNeeded * TARGETS.minSalaryPerSlot;
}

// ---------------------------------------------------------------------------
// Hard eligibility check — must pass all hard rules before soft valuation
// ---------------------------------------------------------------------------
export function canAIBidAtAmount(
  team: Team,
  player: Player,
  nextBid: number,
  lotId: string,
  allPlayers: Record<string, Player>,
  difficulty: Difficulty,
  ctx: AuctionContext
): boolean {
  // Basic eligibility (role, already in squad, etc.)
  const { canBid } = canTeamBidOnPlayer(team, player);
  if (!canBid) return false;

  // Can afford
  if (!canTeamAffordBid(team, nextBid)) return false;

  const squad = team.squad.map(id => allPlayers[id]).filter(Boolean);

  // Hard overseas cap
  if (player.nationality === "Overseas") {
    const overseas = squad.filter(p => p.nationality === "Overseas").length;
    if (overseas >= TARGETS.maxOverseas) return false;
  }

  // Squad full
  if (squad.length >= TARGETS.maxTotal) return false;

  // Purse-to-slot safety: after this bid, still afford remaining minimum slots
  const reserve = minimumReserveLakhs(team, allPlayers);
  if (team.remainingPurse - nextBid < reserve) return false;

  // Soft valuation gate
  const valuation = getLotValuation(lotId, team, player, allPlayers, difficulty, ctx);
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
  difficulty: Difficulty,
  ctx: AuctionContext
): Team | null {
  if (interestedTeams.length === 0) return null;

  const weights = interestedTeams.map(t =>
    Math.max(1, getLotValuation(lotId, t, player, allPlayers, difficulty, ctx))
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
// Bid timing — realistic pacing based on bid size
// ---------------------------------------------------------------------------
export function nextAIBidDelay(currentBid: number): number {
  if (currentBid < 100)  return 1200 + Math.random() * 800;
  if (currentBid < 500)  return 1500 + Math.random() * 1000;
  if (currentBid < 1000) return 1800 + Math.random() * 1200;
  return 2000 + Math.random() * 1500;
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
