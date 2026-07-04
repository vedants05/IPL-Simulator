import { Player, Team, SegmentFocus } from "@/lib/types";
import { getNextBidAmount, canTeamBidOnPlayer, canTeamAffordBid, getCappedRetentionSlabsForCount } from "./auctionRules";

// ---------------------------------------------------------------------------
// Per-lot valuation cache — computed once per team per player lot
// ---------------------------------------------------------------------------
let _cachedLotId: string | null = null;
const _valuationCache: Record<string, number> = {};

export function resetLotCache() {
  _cachedLotId = null;
  Object.keys(_valuationCache).forEach((k) => delete _valuationCache[k]);
}

/** Read a team's cached valuation for the current lot (0 if not yet computed). */
export function getCachedValuation(teamId: string): number {
  return _valuationCache[teamId] ?? 0;
}

export interface AuctionContext {
  remainingPlayerIds: string[];
  soldPlayerIds: string[];
  currentLotIndex: number;
  totalLots: number;
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// Player helpers — read the extended database fields with safe fallbacks
// ---------------------------------------------------------------------------

function ratingOf(p: Player): number {
  return Math.max(p.currentBatting ?? 0, p.currentBowling ?? 0);
}

/** Reputation 1-10; fallback derives from star rating for legacy data. */
function repOf(p: Player): number {
  return p.reputation ?? 5;
}

function isKeeper(p: Player): boolean {
  return !!(p.isWicketkeeper || p.isPartTimeWk || p.role === "WK-Batsman");
}

function isFinisherType(p: Player): boolean {
  return !!(p.isFinisher || ((p.battingAggression ?? 0) >= 85 && !p.isOpener && (p.currentBatting ?? 0) >= 65));
}

function isLeader(p: Player): boolean {
  return (p.captaincy ?? 0) >= 72;
}

/** Counts specialist spinners AND spin-bowling all-rounders (e.g. Narine). */
function isQualitySpinOption(p: Player, minRating = 78): boolean {
  if ((p.currentBowling ?? 0) < minRating) return false;
  if (p.role === "Spin Bowler") return true;
  return p.role === "All-Rounder" && /spin|orthodox/i.test(p.bowlingStyle ?? "");
}

/** Counts specialist pacers AND pace-bowling all-rounders. */
function isQualityPaceOption(p: Player, minRating = 78): boolean {
  if ((p.currentBowling ?? 0) < minRating) return false;
  if (p.role === "Pace Bowler") return true;
  return p.role === "All-Rounder" && /fast|medium|pace/i.test(p.bowlingStyle ?? "");
}

function potentialOf(p: Player): number {
  return Math.max(p.potentialBatting ?? 0, p.potentialBowling ?? 0);
}

function isYoungGun(p: Player): boolean {
  return p.age <= 25 && potentialOf(p) >= 85 && potentialOf(p) - ratingOf(p) >= 3;
}

// ---------------------------------------------------------------------------
// Potential upside — young players with a high ceiling command real money even
// while their current rating lags (franchises buy the next 5 years, not the
// last one). Scales with youth, ceiling height and room left to grow.
// ---------------------------------------------------------------------------
function getPotentialMult(p: Player): number {
  const cur = ratingOf(p);
  const pot = potentialOf(p);
  const gap = Math.max(0, pot - cur);
  if (p.age >= 28 || pot < 82) return 1.0;

  const ageFactor    = clamp(0.50 + ((28 - p.age) / 10) * 0.50, 0.50, 1.00);  // Less pronounced age difference
  const gapNorm      = Math.min(gap, 15) / 15;           // room to grow
  const ceilingNorm  = clamp((pot - 80) / 17, 0, 1);     // how high the ceiling is
  
  // Exponential bonus for elite potentials (like Vaibhav Suryavanshi at 97)
  let eliteBonus = pot >= 88 ? Math.pow(pot - 87, 1.4) * 0.10 : 0;
  if (pot >= 88) {
    const proximityBoost = 1.0 + clamp((15 - gap) / 15, 0, 1) * 0.50;
    eliteBonus *= proximityBoost;
  }
  
  let mult = 1.0 + ageFactor * (gapNorm * u(0.40, 0.80) + ceilingNorm * u(0.40, 0.75)) + eliteBonus;
  if (cur >= 86) {
    mult = 1.0 + (mult - 1.0) * 0.20;
  }
  if (cur <= 82) {
    const penaltyFactor = clamp((cur - 76) / 6, 0, 1); // 76 -> 0.0, 82 -> 1.0 (steeper)
    const potentialScaling = 0.20 + 0.50 * penaltyFactor; // 76 -> 0.20, 82 -> 0.70
    mult = 1.0 + (mult - 1.0) * potentialScaling;
  }
  return mult;
}

type RoleGroup = "BAT" | "WK" | "AR" | "PACE" | "SPIN";

function roleGroupOf(p: Player): RoleGroup {
  if (p.role === "WK-Batsman") return "WK";
  if (p.role === "All-Rounder") return "AR";
  if (p.role === "Pace Bowler") return "PACE";
  if (p.role === "Spin Bowler") return "SPIN";
  return "BAT";
}

/** teamLogic.csv segment focus for this player's nationality × role segment. */
function segmentFocusOf(team: Team, p: Player): number {
  const sf: SegmentFocus | undefined = team.dna.segmentFocus;
  if (!sf) return 65;
  const os = p.nationality === "Overseas";
  switch (roleGroupOf(p)) {
    case "PACE": return os ? sf.overseasPacers : sf.indianPacers;
    case "SPIN": return os ? sf.overseasSpinners : sf.indianSpinners;
    case "AR":   return os ? sf.overseasAllRounders : sf.indianAllRounders;
    default:     return os ? sf.overseasBatters : sf.indianBatters; // BAT + WK
  }
}

// ---------------------------------------------------------------------------
// Squad composition — tracks IPL structural rules AND soft roster guidelines
// (≥4 openers, ≥3 keepers incl. part-time, ≥3 ARs, ≥4 pacers 78+, ≥2 spinners 78+)
// ---------------------------------------------------------------------------
interface SquadComp {
  batters: number; wks: number; allrounders: number;
  spinners: number; pacers: number;
  overseas: number; indians: number; total: number;
  // Guideline tracking (from extended database fields)
  openers: number; keepers: number; finishers: number;
  qualityPace: number; qualitySpin: number; leaders: number;
}

// IPL structural rules — these are fixed (league rules, not preferences)
const RULES = {
  batters: 5, wks: 2, allrounders: 2, spinners: 2, pacers: 3,
  minTotal: 18, maxTotal: 25, maxOverseas: 8, minSalaryPerSlot: 30,
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
    openers:     squad.filter(p => !!p.isOpener).length,
    keepers:     squad.filter(isKeeper).length,
    finishers:   squad.filter(isFinisherType).length,
    qualityPace: squad.filter(isQualityPaceOption).length,
    qualitySpin: squad.filter(isQualitySpinOption).length,
    leaders:     squad.filter(isLeader).length,
  };
}

// ---------------------------------------------------------------------------
// Per-auction team quirks — each team samples its own fuzzed roster targets,
// temperament and budget envelopes ONCE per auction, so team plans differ
// between auctions but stay coherent within one. Reset via resetAuctionQuirks().
// ---------------------------------------------------------------------------
interface TeamQuirks {
  openersTarget: number;
  keepersTarget: number;
  arTarget: number;
  qualityPaceTarget: number;
  qualitySpinTarget: number;
  finisherTarget: number;
  overseasBudgetPct: number;                 // target share of purse on overseas
  temperament: number;                       // whole-auction valuation bias
  roleTilt: Record<RoleGroup, number>;       // per-role budget-envelope weighting
  retentionAppetite: number;                 // <1 → trims retentions, saves for auction
}

let _teamQuirks: Record<string, TeamQuirks> = {};

export function resetAuctionQuirks() {
  _teamQuirks = {};
  _teamPlans = {};
}

function getQuirks(team: Team): TeamQuirks {
  if (!_teamQuirks[team.id]) {
    // Stochastic fuzzing of the guideline targets (±1, mostly 0) so squad
    // compositions vary between teams and between auctions
    const fuzz = () => (Math.random() < 0.55 ? 0 : Math.random() < 0.5 ? -1 : 1);
    const dna = team.dna;

    // Role budget tilt is anchored to the franchise's DNA role values, so a
    // bowling-minded team (high bowlValue) genuinely earmarks a bigger slice
    // of its purse for pacers/spinners — and then defends it in the auction.
    const tiltFor = (dnaVal: number) =>
      clamp(0.80 + ((dnaVal - 30) / 65) * 0.45, 0.78, 1.32) * u(0.90, 1.10);

    // Some franchises deliberately go light on retentions to hoard auction
    // firepower (aggressive, low-loyalty raiders); others lock their core in.
    const hunter = Math.random() < 0.35;
    const retentionAppetite = hunter
      ? u(0.70, 0.90)
      : u(0.92, 1.10) + (team.dna.loyalty / 100) * u(0.0, 0.10);

    _teamQuirks[team.id] = {
      openersTarget:     Math.max(3, 4 + fuzz()),
      keepersTarget:     Math.max(2, 3 + fuzz()),
      arTarget:          Math.max(2, 3 + fuzz()),
      // Deep pace pool + high per-team need: teams want 5 quality pacers, so
      // demand roughly matches supply and quality bowlers stay contested
      // instead of clearing cheap once a couple of slots are filled.
      qualityPaceTarget: Math.max(4, 5 + fuzz()),
      qualitySpinTarget: 2 + (Math.random() < 0.40 ? 1 : 0),
      finisherTarget:    Math.max(1, 2 + fuzz()),
      overseasBudgetPct: u(0.30, 0.42),
      temperament:       u(0.93, 1.09),
      roleTilt: {
        BAT:  tiltFor(dna.batValue),
        WK:   tiltFor(dna.batValue),
        AR:   tiltFor(dna.alrValue),
        PACE: tiltFor(dna.bowlValue),
        SPIN: tiltFor(dna.bowlValue),
      },
      retentionAppetite,
    };
  }
  return _teamQuirks[team.id];
}



// ---------------------------------------------------------------------------
// PLAYER FIT — the single "how much does THIS team want THIS player" score,
// built from EVERY stat in the database crossed with the franchise's ideology
// and its current squad needs. Drives both the pre-auction target plan and the
// live valuation, so an AI's bidding reflects a coherent team-building idea.
// Returns roughly 0 (no interest) … 1 (solid regular) … 2+ (must-have target).
// ---------------------------------------------------------------------------
const BAT_ROLES = ["Batsman", "WK-Batsman"];
const BOWL_ROLES = ["Pace Bowler", "Spin Bowler"];

function computePlayerFit(
  player: Player,
  team: Team,
  comp: SquadComp,
  quirks: TeamQuirks
): number {
  const dna = team.dna;
  const rating = ratingOf(player);
  const pot = potentialOf(player);
  const rep = repOf(player);

  // 1. Core present-day ability (the backbone of the score)
  let fit = clamp((rating - 58) / 34, 0, 1.15); // 58→0, 92→1, 95→1.09

  // 2. Youth ceiling — ABSOLUTE potential, youth-weighted. This is the
  //    Riyan-Parag fix: an 87-ceiling 24yo is a prized asset even if his
  //    current rating and his growth-gap are modest.
  const youthW = clamp((29 - player.age) / 13, 0, 1); // 16yo→1, 29yo→0
  fit += clamp((pot - 74) / 20, 0, 1) * youthW * u(0.30, 0.52);

  // 3. Reputation / star power, amplified by a franchise's big-names appetite
  fit += clamp((rep - 5) / 5, 0, 1) * (0.05 + (dna.bigNamesPref / 100) * 0.22);

  // 4. Role value from franchise DNA (batValue / bowlValue / alrValue)
  const roleVal = BAT_ROLES.includes(player.role) ? dna.batValue
    : BOWL_ROLES.includes(player.role) ? dna.bowlValue
    : dna.alrValue;
  fit *= 0.86 + ((roleVal - 30) / 65) * 0.28; // 0.86 … 1.14

  // 5. Squad need — the biggest swing: does he fill a hole toward a full XI?
  const excess = getRoleExcess(player.role, comp);
  if (excess < 0)      fit += u(0.18, 0.34);   // role under strength
  else if (excess === 0) fit += u(0.02, 0.10);
  else if (excess >= 2)  fit -= u(0.14, 0.28); // already stacked here

  // 6. Specialist attributes vs concrete guideline gaps
  if (player.isOpener && comp.openers < quirks.openersTarget) fit += u(0.10, 0.24);
  if (isKeeper(player) && comp.keepers < quirks.keepersTarget) fit += u(0.12, 0.28);
  if ((player.captaincy ?? 0) >= 78 && comp.leaders < 2) fit += u(0.10, 0.24);
  if (isFinisherType(player) && comp.finishers < quirks.finisherTarget) {
    const aggNorm = clamp(((player.battingAggression ?? 70) - 70) / 29, 0, 1);
    fit += (0.06 + aggNorm * 0.18);
  }
  if (isQualityPaceOption(player) && comp.qualityPace < quirks.qualityPaceTarget) fit += u(0.06, 0.18);
  if (isQualitySpinOption(player, comp.qualitySpin === 0 ? 74 : 78) && comp.qualitySpin < quirks.qualitySpinTarget) fit += u(0.08, 0.20);

  // 7. Ideology — teamLogic.csv nationality × role segment focus
  fit += clamp((segmentFocusOf(team, player) - 62) / 33, -1, 1) * u(0.05, 0.15);

  // 8. Age-profile preference (youth seekers vs experience seekers)
  if (rating < 84) {
    if (player.age <= 24 && dna.prefYoungsters >= 60) fit += ((dna.prefYoungsters - 60) / 40) * u(0.04, 0.14);
    if (player.age >= 31 && dna.experienceFocus >= 60) fit += ((dna.experienceFocus - 60) / 40) * u(0.03, 0.12);
  }

  // 9. Loyalty pull toward a returning ex-player
  if (player.iplHistory.some(h => h.teamId === team.id)) fit += (dna.loyalty / 100) * u(0.25, 0.60);

  // 10. Overseas balance — a full overseas contingent cools foreign interest
  if (player.nationality === "Overseas" && comp.overseas >= RULES.maxOverseas - 1) fit -= u(0.10, 0.25);

  return Math.max(0, fit);
}

// ---------------------------------------------------------------------------
// Effective quality — the quality TIER a player should be priced in, lifting the
// raw quality rating for young high-ceiling prospects and for proven earners
// (prior IPL salary).
// ---------------------------------------------------------------------------
function effectiveQuality(player: Player): number {
  const rating = ratingOf(player);
  const rep = repOf(player);
  let q = 0.8 * rating + 0.2 * (rep * 10);
  
  if (isYoungGun(player)) q = Math.min(88, q + 6);
  
  // High potential superstars get elevated to elite brackets
  const pot = potentialOf(player);
  if (pot >= 88 && player.age <= 25) {
    const penaltyFactor = clamp((rating - 76) / 7, 0, 1);
    const penalty = 6 - 5 * penaltyFactor; // 76 or below -> 6, 82 -> 1.71 (rounds to 2), 83 -> 1
    q = Math.max(q, Math.round(pot - penalty));
  }
  
  return Math.min(97, q);
}

function qualityToBaseLakhs(quality: number): number {
  if (quality >= 85) {
    return 1350 + ((quality - 85) / 12) * 800;
  }
  if (quality >= 75) {
    return 780 + ((quality - 75) / 10) * 570;
  }
  if (quality >= 65) {
    return 220 + ((quality - 65) / 10) * 560;
  }
  if (quality >= 55) {
    return 100 + ((quality - 55) / 10) * 120;
  }
  return Math.max(20, 20 + ((quality - 30) / 25) * 80);
}

// ---------------------------------------------------------------------------
// Intrinsic value (lakhs) — fit crossed with the market anchor (effective quality
// tier), then quality-capped for the effective tier so a genuine mid-tier
// player can't be valued like a superstar.
// ---------------------------------------------------------------------------
function intrinsicValue(
  player: Player,
  team: Team,
  comp: SquadComp,
  quirks: TeamQuirks,
  fitOverride?: number
): number {
  const fit = fitOverride ?? computePlayerFit(player, team, comp, quirks);
  const effQ = effectiveQuality(player);
  const anchor = qualityToBaseLakhs(effQ);

  // Central valuation sits near the market anchor (premium ≈ 1.0 for a solid
  // fit), so the SECOND-highest bid — the clearing price — lands near anchor
  // rather than running to the ceiling and gutting the rest of the budget.
  const premium = clamp(0.55 + fit * 0.46, 0.36, 1.24);
  const raw = anchor * premium * quirks.temperament * getPotentialMult(player);
  return applyQualityCeiling(raw, anchor, effQ, player);
}

// ---------------------------------------------------------------------------
// PRE-AUCTION TEAM PLAN — formed ONCE, before a ball is bowled. Each team ranks
// the entire auction pool by fit, then earmarks its purse: a set of PRIMARY
// TARGETS it will pay up for (its "shortlist"), plus a depth budget for the
// remaining slots so it can still build out a full 25-man squad. During the
// auction a team bids toward these plan figures and, if a target gets away or
// goes cheap, the freed/held budget naturally flows to the alternatives.
// ---------------------------------------------------------------------------
interface TeamPlan {
  maxBid: Record<string, number>; // primary-target ceilings (lakhs)
  depthValue: number;             // avg lakhs earmarked per depth slot
  targetSquad: number;            // how many players the team wants (≤25)
}

let _teamPlans: Record<string, TeamPlan> = {};

function getTeamPlan(team: Team, allPlayers: Record<string, Player>): TeamPlan {
  if (_teamPlans[team.id]) return _teamPlans[team.id];

  const quirks = getQuirks(team);
  const squad = team.squad.map(id => allPlayers[id]).filter(Boolean);
  const comp = getSquadComp(squad);

  // Auction pool = everyone not retained and not already bought this auction.
  const pool = Object.values(allPlayers).filter(
    p => !p.isRetained && (p.currentTeamId == null)
  );

  // Teams aim to fill out a full squad (24-25) — depth wins tournaments.
  const targetSquad = clamp(Math.round(u(24.0, 25.4)), 24, 25);
  const toBuy = clamp(targetSquad - comp.total, 6, 25);

  // Score & rank the pool for this franchise (all stats × ideology × needs).
  const scored = pool
    .map(p => {
      const fit = computePlayerFit(p, team, comp, quirks);
      return { p, fit, val: intrinsicValue(p, team, comp, quirks, fit) };
    })
    .sort((a, b) => (b.fit * b.val) - (a.fit * a.val));

  // Earmark the purse: a chunk for primary targets, the rest for depth.
  const purse = team.remainingPurse;
  const starBudget = purse * u(0.60, 0.74);
  const primaryCap = Math.max(3, Math.round(toBuy * u(0.38, 0.55)));

  const maxBid: Record<string, number> = {};
  let spend = 0;
  let primaries = 0;
  for (const s of scored) {
    if (primaries >= primaryCap) break;
    if (s.fit < 0.55) break; // below this it's depth, not a target
    const expectedCost = s.val * 0.82; // what they expect to actually pay
    if (spend + expectedCost > starBudget) continue; // can't fund this one → skip to cheaper targets
    maxBid[s.p.id] = Math.round(s.val);
    spend += expectedCost;
    primaries++;
  }

  const depthSlots = Math.max(1, toBuy - primaries);
  const depthReserve = Math.max(purse * 0.12, purse - spend);
  const depthValue = depthReserve / depthSlots;

  const plan: TeamPlan = { maxBid, depthValue, targetSquad };
  _teamPlans[team.id] = plan;
  return plan;
}
function getRoleExcess(role: string, comp: SquadComp): number {
  if (role === "WK-Batsman")  return comp.wks         - RULES.wks;
  if (role === "Batsman")     return comp.batters      - RULES.batters;
  if (role === "Pace Bowler") return comp.pacers       - RULES.pacers;
  if (role === "Spin Bowler") return comp.spinners     - RULES.spinners;
  if (role === "All-Rounder") return comp.allrounders  - RULES.allrounders;
  return 0;
}

function applyQualityCeiling(raw: number, base: number, quality: number, player?: Player): number {
  let ceilMult: number, carry: number, hardCap = Infinity;

  const hasElitePotential = player && potentialOf(player) >= 88 && player.age <= 25;

  if (quality <= 55) {
    ceilMult = u(1.70, 2.60); carry = u(0.08, 0.20);
  } else if (quality <= 65) {
    ceilMult = u(1.20, 1.50); carry = u(0.04, 0.10); hardCap = u(650, 850);
  } else if (quality <= 75) {
    ceilMult = u(1.14, 1.40); carry = u(0.04, 0.10); hardCap = u(800, 1050);
  } else if (quality <= 85) {
    ceilMult = u(1.12, 1.36); carry = u(0.05, 0.12);
  } else {
    ceilMult = u(1.15, 1.42); carry = u(0.05, 0.12);
  }

  if (hasElitePotential) {
    // Elite prospects can command astronomical bids (carrying values up to 1.8x softCeil with high carry through)
    ceilMult *= u(1.40, 1.70);
    carry = u(0.35, 0.55);
  }

  const softCeil = base * ceilMult;
  const capped = raw > softCeil ? softCeil + (raw - softCeil) * carry : raw;
  return Math.min(capped, hardCap);
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
  const squad  = team.squad.map(id => allPlayers[id]).filter(Boolean);
  const comp   = getSquadComp(squad);
  const quirks = getQuirks(team);
  const plan   = getTeamPlan(team, allPlayers);

  // Overseas / squad-full hard stops (the eligibility gate re-checks these too)
  if (comp.total >= RULES.maxTotal) return 0;
  if (player.nationality === "Overseas" && comp.overseas >= RULES.maxOverseas) return 0;

  const excess = getRoleExcess(player.role, comp);
  const needsBodies = comp.total < plan.targetSquad;
  const planned = plan.maxBid[player.id];
  const fit = computePlayerFit(player, team, comp, quirks);
  const highValue = ratingOf(player) >= 80 || (player.reputation ?? 0) >= 8;

  // ── Interest gate ─────────────────────────────────────────────────────────
  // A team bids if the player is on its shortlist, OR it still needs bodies,
  // OR he's a genuine quality asset worth having on the books. It backs off
  // only when a role is heavily overstacked (and he's not a planned target).
  const slotsLeft = plan.targetSquad - comp.total;
  if (planned === undefined) {
    if (!needsBodies && !highValue) return 0;
    // Role-stacking limit relaxes when the squad is well short of a full 25 —
    // a team that still needs many bodies takes the best available even if the
    // role is a little crowded, so everyone fills out to 25.
    const excessLimit = slotsLeft >= 6 ? 3 : slotsLeft >= 3 ? 4 : 6;
    if (excess >= excessLimit && !highValue) return 0;
    // Weak-fit filler is ignored while there's still real squad-building to do.
    const fitFloor = highValue ? 0.28 : slotsLeft >= 8 ? 0.50 : slotsLeft >= 4 ? 0.34 : 0.18;
    if (fit < fitFloor) return 0;
  }

  // ── Market-anchored value for EVERY interested team ───────────────────────
  let base = intrinsicValue(player, team, comp, quirks, fit);

  if (planned !== undefined) {
    // Shortlist premium — pay a touch above market for pre-formed targets.
    base = Math.max(base, planned) * u(1.0, 1.10);
  } else {
    // Off-shortlist: scale by fit so weaker fits bid modestly (but still bid,
    // so quality players find buyers instead of going unsold).
    base *= clamp(0.64 + fit * 0.40, 0.50, 1.08);
  }

  // Depth floor: while the squad still needs bodies, keep the bid off the
  // floor so squad-building depth clears for a sensible price, not scraps.
  if (needsBodies) base = Math.max(base, plan.depthValue * u(0.70, 1.10));

  // ── Live scatter so identical squads still diverge in the room ────────────
  base *= lognormal(u(0.09, 0.18));

  // ── Budget-per-slot concentration ─────────────────────────────────────────
  // Self-balancing squad economics: the team spends this many "fair shares"
  // (avg purse per remaining slot) on one player — stars concentrate 4-6×,
  // depth ~0.6×. Because the fair share recomputes after every buy, a team
  // that splurges on a star automatically has less per slot for the rest, so
  // it can never overspend into a short squad — it fills all the way to 25.
  const slotsToFill = Math.max(1, plan.targetSquad - comp.total);
  const avgPerSlot = team.remainingPurse / slotsToFill;
  // Concentrations average near 1.0 across a full build so money and slots run
  // out together — the team fills all the way to a full 25 rather than blowing
  // the purse on a handful of stars. Genuine marquee names (85+ rating) concentrate
  // hardest, so several teams bid them into the ₹12-18 Cr range, while depth stays
  // cheap enough to still round out the squad.
  const marquee = ratingOf(player) >= 84 || (player.reputation ?? 0) >= 9;
  let concentration: number;
  if (marquee)                 concentration = u(3.2, 5.2);
  else if (planned !== undefined) concentration = u(2.2, 3.4);
  else if (highValue)          concentration = u(1.7, 2.7);
  else if (fit >= 0.72)        concentration = u(1.0, 1.6);
  else                         concentration = u(0.55, 1.00);
  // A near-empty squad shouldn't hand its whole purse to lot one even so.
  let affordabilityCap = Math.min(avgPerSlot * concentration, team.remainingPurse * (ratingOf(player) >= 84 ? 0.60 : 0.50));
  if (ratingOf(player) >= 84) {
    affordabilityCap *= u(1.15, 1.30);
  }

  // Absolute franchise cap — no one player eats the whole purse
  const absCap = team.totalPurse * (0.20 + (team.dna.commitmentToTargets / 100) * 0.09) * u(0.92, 1.08);

  const value = Math.min(base, affordabilityCap, absCap, team.remainingPurse);
  return Math.round(Math.max(0, value));
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
// AI retention decisions (pre-auction) — replaces the naive "top 3 capped +
// top 1 uncapped by stars" heuristic. Each candidate's estimated market worth
// (skill, age curve, potential, reputation, leadership, finishing) is weighed
// against the explicit slab costs (18/14/11/18/14 Cr capped, 4 Cr uncapped).
// Loyalty DNA lowers the retention bar and can override a modest deficit for
// iconic high-reputation stars; stochastic noise varies outcomes per run.
// ---------------------------------------------------------------------------
const RETENTION_SLABS = [1800, 1400, 1100, 1800, 1400];
const UNCAPPED_SLAB = 400;
const MAX_CAPPED = 5;
const MAX_UNCAPPED = 2;
const MAX_TOTAL = 6;

/** Estimated market worth in lakhs — used only for retention decisions. */
export function estimateRetentionWorth(player: Player, team: Team): number {
  const rating = ratingOf(player);
  const rep = repOf(player);
  let worth = qualityToBaseLakhs(0.8 * rating + 0.2 * (rep * 10));

  // Skill: same shape as auction form multiplier
  if (rating > 0) worth *= 0.50 + Math.pow(rating / 100, 2.5) * 0.80;

  // Age curve: youth appreciates, but do not discount veterans
  if (player.age <= 24) worth *= u(1.05, 1.20);
  else if (player.age <= 29) worth *= u(1.00, 1.10);

  // Veteran decline penalty for players aged over 34 who are 81 rated or below
  if (player.age > 34 && rating <= 81) {
    worth *= 0.50;
  }

  // Superstars rated >= 86 are prioritized heavily
  if (rating >= 86) {
    worth *= 2.5;
  }

  // Elite superstars rated >= 90 receive an additional multiplier
  if (rating >= 90) {
    worth *= 1.30;
  }

  // Potential upside — same ceiling logic as the auction valuation, so a
  // Parag-type (79 now, 86 ceiling, age 24) is valued on his next 5 years
  worth *= getPotentialMult(player);
  if (player.potential === "Wonderkid")      worth *= u(1.05, 1.18);
  else if (player.potential === "Promising") worth *= u(1.00, 1.10);

  // Reputation & leadership & finishing — shaded by franchise mentality:
  // star-hungry teams (bigNamesPref) overvalue reputation in retention too,
  // youth-focused teams (prefYoungsters) overweight the potential upside
  if (rep >= 8) worth *= 1 + (rep - 7) * u(0.04, 0.10) * (0.70 + 0.60 * (team.dna.bigNamesPref / 100));
  if ((player.captaincy ?? 0) >= 80) worth *= u(1.04, 1.14);
  if (isFinisherType(player) && (player.battingAggression ?? 0) >= 85) worth *= u(1.02, 1.12);
  if (isYoungGun(player)) worth *= 1 + 0.15 * Math.max(0, (team.dna.prefYoungsters - 40) / 60);

  // Boost for young Indian talents with high potential (e.g. Angkrish Raghuvanshi)
  if (player.nationality === "Indian" && player.age <= 24 && potentialOf(player) >= 84) {
    worth *= 1.30;
  }

  // Premium for established Indian players rated 84+ (e.g. Harshit Rana over Pathirana)
  if (player.nationality === "Indian" && rating >= 84) {
    worth *= 1.15;
  }



  // Per-run noise so retention sets differ between saves. High-reputation
  // players get a tighter read — no franchise misjudges its own superstar.
  worth *= lognormal(rep >= 8 ? u(0.05, 0.09) : u(0.10, 0.16));

  return worth;
}

export function decideAIRetentions(
  team: Team,
  allPlayers: Record<string, Player>
): string[] {
  const squad = team.squad.map(id => allPlayers[id]).filter(Boolean);
  const loyaltyNorm = team.dna.loyalty / 100;
  const quirks = getQuirks(team);
  const appetite = quirks.retentionAppetite; // <1 → hunter, saves for auction

  // Spend guard: leave enough purse to build an 18-25 squad at auction.
  // High-loyalty teams tolerate committing more of the purse to retentions,
  // and icon-rich squads (multiple rep-9 faces) stretch further still —
  // real MI/CSK-type franchises spent ₹75 Cr keeping their cores together.
  // Auction-hunter franchises (low appetite) deliberately keep the guard low
  // so they arrive at the auction with a war chest for the big names.
  const iconCount = squad.filter(p => repOf(p) >= 9).length;
  const iconStretch = 1 + Math.min(2, Math.max(0, iconCount - 3)) * 0.05;
  const maxRetentionSpend = team.totalPurse * u(0.46, 0.60) * (0.92 + loyaltyNorm * 0.16) * iconStretch * appetite;
  // Cornerstones may push total retention spend beyond the normal guard —
  // a franchise NEVER auctions its face to save auction budget
  const cornerstoneSpendCap = team.totalPurse * 0.72;

  const isCappedPlayer = (p: Player) => p.isCapped || p.nationality === "Overseas";

  // Franchise cornerstones: elite, high-reputation faces (Rohit/Kohli/Bumrah
  // class) plus any rep-10 legend (Dhoni). Processed FIRST and effectively
  // never released — a franchise never auctions its identity.
  const isCornerstone = (p: Player) =>
    repOf(p) >= 9 || ratingOf(p) >= 84 || potentialOf(p) >= 88;

  // 1. Score all players (both capped and uncapped)
  const allCandidates = squad.map(p => {
    const worth = estimateRetentionWorth(p, team);
    const cornerstone = isCornerstone(p);
    const isRep10 = repOf(p) === 10;
    return { p, worth, isCapped: isCappedPlayer(p), cornerstone, isRep10 };
  });

  // Sort: rep-10 legends first, then cornerstones, then all others — all sub-sorted by worth
  allCandidates.sort((a, b) => {
    const aRep10 = a.isRep10 ? 2 : a.cornerstone ? 1 : 0;
    const bRep10 = b.isRep10 ? 2 : b.cornerstone ? 1 : 0;
    if (bRep10 !== aRep10) return bRep10 - aRep10;
    if (Math.abs(b.worth - a.worth) > 0.001) return b.worth - a.worth;

    // Tie-breaker: same ability (rating) and age -> select Indian first
    const aRtg = ratingOf(a.p);
    const bRtg = ratingOf(b.p);
    if (aRtg === bRtg && a.p.age === b.p.age) {
      const aInd = a.p.nationality === "Indian" ? 1 : 0;
      const bInd = b.p.nationality === "Indian" ? 1 : 0;
      return bInd - aInd;
    }
    return b.worth - a.worth;
  });

  // 2. Perform trial evaluations to find a stable capped player count
  // We try targeting 5 down to 0 capped players, and select the first target that is fully satisfied.
  for (let targetCapped = MAX_CAPPED; targetCapped >= 0; targetCapped--) {
    const slabs = getCappedRetentionSlabsForCount(targetCapped);
    const retainedList: string[] = [];
    let cappedUsed = 0;
    let uncappedUsed = 0;
    let totalSpend = 0;

    for (const { p, worth, isCapped, cornerstone } of allCandidates) {
      if (retainedList.length >= MAX_TOTAL) break;

      // Check slot limits
      if (isCapped) {
        if (cappedUsed >= targetCapped) continue;
      } else {
        if (uncappedUsed >= MAX_UNCAPPED) continue;
      }

      const slabCost = isCapped ? slabs[cappedUsed] : UNCAPPED_SLAB;
      const spendCap = cornerstone ? cornerstoneSpendCap : maxRetentionSpend;

      if (totalSpend + slabCost > spendCap) {
        if (cornerstone) continue; // never let a cheaper non-icon block the queue
        break;
      }

      if (cornerstone) {
        retainedList.push(p.id);
        if (isCapped) cappedUsed++; else uncappedUsed++;
        totalSpend += slabCost;
        continue;
      }

      // Base bar checks depending on capped vs uncapped
      let bar = 0;
      if (isCapped) {
        bar = slabCost * (1.00 - loyaltyNorm * 0.15) * (1 + cappedUsed * 0.04) * (1.5 - appetite * 0.5);
        bar = Math.min(bar, slabCost * 1.15); // The bar should never be more than 15% above the slab cost

        if (ratingOf(p) >= 86) {
          bar = Math.min(bar, slabCost * 0.40);
        }

        // Iconic-star override: EVERY franchise protects a rep-9/10 face of the franchise
        const rep = repOf(p);
        if (rep >= 9 && ratingOf(p) >= 78) {
          bar = Math.min(bar, slabCost * (0.42 + (1 - loyaltyNorm) * 0.28) * u(0.95, 1.10));
        } else if (rep >= 8 && loyaltyNorm >= 0.5 && ratingOf(p) >= 80) {
          bar = Math.min(bar, slabCost * u(0.72, 0.92));
        }
        // Elite young cornerstone
        if (ratingOf(p) >= 84 && p.age <= 27) {
          bar = Math.min(bar, slabCost * u(0.68, 0.86));
        } else if (potentialOf(p) >= 88 && p.age <= 25) {
          bar = Math.min(bar, slabCost * u(0.72, 0.90));
        }
      } else {
        bar = UNCAPPED_SLAB * u(1.35, 2.10) * (1.05 - loyaltyNorm * 0.15);
        if (p.age <= 23 && (p.potential === "Wonderkid" || p.potential === "Promising")) {
          bar *= u(0.75, 0.92);
        }
      }

      if (worth >= bar) {
        retainedList.push(p.id);
        if (isCapped) cappedUsed++; else uncappedUsed++;
        totalSpend += slabCost;
      }
    }

    // If we successfully retained exactly the target count of capped players (or if we targeted 0), this is our stable solution
    if (cappedUsed === targetCapped || targetCapped === 0) {
      return retainedList;
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// Bid timing — three-zone mixture, weights shift as price rises.
// ---------------------------------------------------------------------------
export function nextAIBidDelay(currentBid: number): number {
  const r = Math.random();

  if (currentBid < 300) {
    if (r < 0.62) return u(300,  1100);
    if (r < 0.88) return u(1200, 2500);
    return              u(3000, 5000);
  }
  if (currentBid < 1200) {
    if (r < 0.35) return u(500,  1500);
    if (r < 0.72) return u(2000, 4500);
    return              u(5000, 8500);
  }
  if (r < 0.18) return u(800,  2000);
  if (r < 0.58) return u(3000, 6000);
  return              u(6500, 10000);
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
