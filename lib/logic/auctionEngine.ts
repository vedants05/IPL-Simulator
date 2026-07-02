import { Player, Team, SegmentFocus } from "@/lib/types";
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
  return p.reputation ?? Math.round(p.starRating * 2);
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

/** Elite = current skill 82+/4★+, or a high-ceiling wonderkid. */
function isEliteProspect(p: Player): boolean {
  if (ratingOf(p) >= 82 || p.starRating >= 4.0) return true;
  const potRating = Math.max(p.potentialBatting ?? 0, p.potentialBowling ?? 0);
  return potRating >= 88 && p.age <= 23;
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
  roleTilt: Record<RoleGroup, number>;       // noise on category budget envelopes
}

let _teamQuirks: Record<string, TeamQuirks> = {};

export function resetAuctionQuirks() {
  _teamQuirks = {};
}

function getQuirks(team: Team): TeamQuirks {
  if (!_teamQuirks[team.id]) {
    // Stochastic fuzzing of the guideline targets (±1, mostly 0) so squad
    // compositions vary between teams and between auctions
    const fuzz = () => (Math.random() < 0.55 ? 0 : Math.random() < 0.5 ? -1 : 1);
    _teamQuirks[team.id] = {
      openersTarget:     Math.max(3, 4 + fuzz()),
      keepersTarget:     Math.max(2, 3 + fuzz()),
      arTarget:          Math.max(2, 3 + fuzz()),
      qualityPaceTarget: Math.max(3, 4 + fuzz()),
      qualitySpinTarget: 2 + (Math.random() < 0.30 ? 1 : 0),
      finisherTarget:    Math.max(1, 2 + fuzz()),
      overseasBudgetPct: u(0.30, 0.42),
      temperament:       u(0.93, 1.09),
      roleTilt: {
        BAT: u(0.88, 1.14), WK: u(0.88, 1.14), AR: u(0.88, 1.14),
        PACE: u(0.88, 1.14), SPIN: u(0.88, 1.14),
      },
    };
  }
  return _teamQuirks[team.id];
}

// ---------------------------------------------------------------------------
// FSM — panic triggers now watch the roster guidelines, not just raw counts
// ---------------------------------------------------------------------------
type FSMState = "Snoozing" | "Hunting" | "Panic";

function getFSMState(team: Team, comp: SquadComp, ctx: AuctionContext, quirks: TeamQuirks): FSMState {
  const slotsToMin = Math.max(0, RULES.minTotal - comp.total);
  const prog = ctx.totalLots > 0 ? ctx.currentLotIndex / ctx.totalLots : 0;

  if (slotsToMin > 0 && prog > u(0.50, 0.66)) return "Panic";
  if (slotsToMin >= 4 && prog > u(0.42, 0.55)) return "Panic";
  if (comp.keepers === 0 && prog > u(0.42, 0.58)) return "Panic";
  // Guideline lag panic — badly behind on multiple targets late in the auction
  const lags =
    (comp.openers     < quirks.openersTarget     - 1 ? 1 : 0) +
    (comp.keepers     < quirks.keepersTarget     - 1 ? 1 : 0) +
    (comp.qualityPace < quirks.qualityPaceTarget - 1 ? 1 : 0) +
    (comp.qualitySpin < quirks.qualitySpinTarget - 1 ? 1 : 0) +
    (comp.allrounders < quirks.arTarget          - 1 ? 1 : 0);
  if (lags >= 2 && prog > u(0.60, 0.75)) return "Panic";

  const satisfied = totalMissingSlots(comp) === 0;
  if (satisfied && team.remainingPurse < team.totalPurse * u(0.11, 0.19)) return "Snoozing";

  return "Hunting";
}

// ---------------------------------------------------------------------------
// Market-rate anchors (IPL 2025-mega calibrated).
// Marquee anchors trimmed so superstars land ~₹18-28 Cr instead of purse-killers;
// mid-tier anchors trimmed so 3.0-3.5★ players anchor at ₹4.2-7 Cr.
// ---------------------------------------------------------------------------
function starToBaseLakhs(star: number): number {
  const anchors: [number, number][] = [
    [1.0, 25], [1.5, 45], [2.0, 80], [2.5, 200],
    [3.0, 420], [3.5, 700], [4.0, 1200], [4.5, 1550], [5.0, 1950],
  ];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [s0, v0] = anchors[i];
    const [s1, v1] = anchors[i + 1];
    if (star >= s0 && star <= s1) return v0 + ((star - s0) / (s1 - s0)) * (v1 - v0);
  }
  return anchors[anchors.length - 1][1];
}

// ---------------------------------------------------------------------------
// Guideline boost — extra role-need pressure when this player fills a roster
// guideline the team is lagging on. Scales with auction progress.
// ---------------------------------------------------------------------------
function getGuidelineBoost(
  player: Player,
  comp: SquadComp,
  quirks: TeamQuirks,
  ctx: AuctionContext
): number {
  const prog = ctx.totalLots > 0 ? ctx.currentLotIndex / ctx.totalLots : 0;
  const urgency = 0.6 + prog * 0.9; // late-auction lag matters much more
  let m = 1.0;

  if (player.isOpener && comp.openers < quirks.openersTarget) {
    const lag = quirks.openersTarget - comp.openers;
    m *= 1 + clamp(lag * u(0.05, 0.12) * urgency, 0, 0.45);
  }
  if (isKeeper(player) && comp.keepers < quirks.keepersTarget) {
    const lag = quirks.keepersTarget - comp.keepers;
    m *= 1 + clamp(lag * u(0.06, 0.14) * urgency, 0, 0.50);
  }
  if (player.role === "All-Rounder" && comp.allrounders < quirks.arTarget) {
    const lag = quirks.arTarget - comp.allrounders;
    m *= 1 + clamp(lag * u(0.05, 0.11) * urgency, 0, 0.40);
  }
  if (isQualityPaceOption(player) && comp.qualityPace < quirks.qualityPaceTarget) {
    const lag = quirks.qualityPaceTarget - comp.qualityPace;
    m *= 1 + clamp(lag * u(0.05, 0.12) * urgency, 0, 0.45);
  }
  // Quality spin is structurally scarce league-wide, so a lagging team also
  // chases best-available (74+) spinners rather than waiting for unicorns
  if (isQualitySpinOption(player, comp.qualitySpin === 0 ? 74 : 78) && comp.qualitySpin < quirks.qualitySpinTarget) {
    const lag = quirks.qualitySpinTarget - comp.qualitySpin;
    m *= 1 + clamp(lag * u(0.06, 0.14) * urgency, 0, 0.45);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Role need — sampled ranges, guideline-aware
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
// Player acquisition cost — retention slabs or auction price
// ---------------------------------------------------------------------------
function getPlayerCost(
  player: Player,
  team: Team,
  allPlayers: Record<string, Player>
): number {
  if (player.isRetained) {
    const retainedList = team.retainedPlayers || [];
    let cappedCount = 0;
    for (const id of retainedList) {
      if (id === player.id) {
        if (player.isCapped || player.nationality === "Overseas") {
          const CAPPED_RETENTION_COSTS = [1800, 1400, 1100, 1800, 1400];
          return CAPPED_RETENTION_COSTS[cappedCount] ?? 0;
        } else {
          return 400; // Uncapped
        }
      }
      const p = allPlayers[id];
      if (p && (p.isCapped || p.nationality === "Overseas")) {
        cappedCount++;
      }
    }
    return player.basePrice;
  } else {
    const entry = player.iplHistory.find(h => h.season === "2026");
    return entry ? entry.price : player.basePrice;
  }
}

// ---------------------------------------------------------------------------
// Nationality — rebalanced (Issue 2): elite internationals carry an early-slot
// PREMIUM; the budget governor only bites when a team is genuinely ahead of
// its overseas spending pace, and never collapses below 0.5 while slots+funds
// remain. Elite overseas talent (rating ≥ 85) is partially shielded.
// ---------------------------------------------------------------------------
function getNatMult(
  player: Player,
  comp: SquadComp,
  team: Team,
  allPlayers: Record<string, Player>,
  quirks: TeamQuirks
): number {
  if (player.nationality === "Overseas") {
    if (comp.overseas >= RULES.maxOverseas) return 0; // Hard IPL rule

    const squad = team.squad.map(id => allPlayers[id]).filter(Boolean);
    const overseasSpent = squad
      .filter(p => p.nationality === "Overseas")
      .reduce((sum, p) => sum + getPlayerCost(p, team, allPlayers), 0);

    // Slot pressure: premium while slots are open, taper only near the cap
    let m: number;
    if      (comp.overseas <= 3) m = u(1.00, 1.20);
    else if (comp.overseas <= 5) m = u(0.90, 1.08);
    else if (comp.overseas === 6) m = u(0.75, 0.95);
    else                          m = u(0.55, 0.85);

    // Budget governor vs the team's own sampled overseas envelope
    const overseasBudget = team.totalPurse * quirks.overseasBudgetPct;
    const pace = (comp.overseas / RULES.maxOverseas) + 0.18; // grace margin
    const expectedSpent = overseasBudget * Math.min(1, pace);
    if (overseasSpent > expectedSpent) {
      const over = overseasSpent / Math.max(1, expectedSpent) - 1;
      m *= Math.max(0.50, 1.0 - over * 0.45);
    } else if (comp.overseas > 0) {
      m *= Math.min(1.15, 1.0 + (1.0 - overseasSpent / Math.max(1, expectedSpent)) * 0.10);
    }

    // Elite shield: never harshly discount genuinely elite overseas players
    if (ratingOf(player) >= 85) m = Math.max(m, u(0.88, 1.02));

    return m;
  }
  return comp.overseas > comp.indians ? u(1.04, 1.26) : u(0.94, 1.06);
}

// ---------------------------------------------------------------------------
// Loyalty — scales with team.dna.loyalty (0-100)
// ---------------------------------------------------------------------------
function getLoyaltyMult(player: Player, team: Team): number {
  const wasMine = player.iplHistory.some(h => h.teamId === team.id);
  if (!wasMine) return u(0.96, 1.04);
  const loyaltyFactor = team.dna.loyalty / 100;
  const premiumProb = 0.10 + loyaltyFactor * 0.75;
  if (Math.random() < premiumProb) {
    return u(1.06, 1.08 + loyaltyFactor * 0.27);
  }
  return u(0.96, 1.06);
}

// ---------------------------------------------------------------------------
// Budget — continuous concave curve + per-team noise
// ---------------------------------------------------------------------------
function getBudgetMult(team: Team): number {
  const pct = team.remainingPurse / team.totalPurse;
  const exponent = u(0.65, 0.95);
  const base = 0.55 + Math.pow(Math.max(0, pct), exponent) * 0.65;
  return base * lognormal(u(0.04, 0.09));
}

// ---------------------------------------------------------------------------
// Scarcity — boost when quality alternatives in the role are running out
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

  if (remaining <= 1) return u(1.15, 1.45);
  if (remaining <= 3) return u(1.06, 1.26);
  if (remaining <= 6) return u(1.00, 1.16);
  return u(0.93, 1.07);
}

// ---------------------------------------------------------------------------
// Category depletion (Issue 6) — two forces that flatten spend across the
// auction lifecycle:
//   1. Pool-side: while MANY quality same-role players are still to come,
//      teams hold capital back (mild damper early in a category run).
//   2. Team-side: each team has a sampled budget envelope per role group;
//      once spending in that category outruns the envelope, willingness
//      decays hard — no more blowing the whole pace budget on lot one.
// ---------------------------------------------------------------------------
const ROLE_BUDGET_SHARE: Record<RoleGroup, number> = {
  BAT: 0.30, WK: 0.13, AR: 0.22, PACE: 0.23, SPIN: 0.12,
};

function getDepletionMult(
  player: Player,
  team: Team,
  allPlayers: Record<string, Player>,
  ctx: AuctionContext,
  quirks: TeamQuirks
): number {
  let m = 1.0;

  // 1. Pool abundance damper
  const minStar = player.starRating - 0.5;
  const remainingQuality = ctx.remainingPlayerIds.filter(id => {
    const p = allPlayers[id];
    return p && p.role === player.role && p.starRating >= minStar;
  }).length;
  if (remainingQuality >= 8)      m *= u(0.82, 0.94);
  else if (remainingQuality >= 5) m *= u(0.90, 1.00);

  // 2. Category budget envelope
  const group = roleGroupOf(player);
  const squad = team.squad.map(id => allPlayers[id]).filter(Boolean);
  const groupSpent = squad
    .filter(p => roleGroupOf(p) === group)
    .reduce((sum, p) => sum + getPlayerCost(p, team, allPlayers), 0);
  const envelope = team.totalPurse * ROLE_BUDGET_SHARE[group] * quirks.roleTilt[group];
  const r = groupSpent / Math.max(1, envelope);
  if (r > 1.20)      m *= u(0.40, 0.60);
  else if (r > 0.95) m *= u(0.62, 0.82);
  else if (r > 0.70) m *= u(0.82, 0.98);

  return m;
}

// ---------------------------------------------------------------------------
// Urgency — trigger thresholds and response magnitudes sampled
// ---------------------------------------------------------------------------
function getUrgencyMult(comp: SquadComp, ctx: AuctionContext): number {
  const prog    = ctx.totalLots > 0 ? ctx.currentLotIndex / ctx.totalLots : 0;
  const missing = totalMissingSlots(comp);
  if (missing > 0 && prog > u(0.65, 0.80)) return u(1.25, 1.65);
  if (missing > 0 && prog > u(0.42, 0.60)) return u(1.08, 1.30);
  return u(0.97, 1.05);
}

// ---------------------------------------------------------------------------
// Personality — data-driven from team.dna + extended player fields (Issue 8)
// ---------------------------------------------------------------------------
function getPersonalityMult(player: Player, team: Team, comp: SquadComp): number {
  const dna = team.dna;
  let m = 1.0;

  // ── Role valuation (batValue / bowlValue / alrValue, 30-95 → 0.84-1.18) ──
  const batRoles = ["Batsman", "WK-Batsman"];
  const bowlRoles = ["Pace Bowler", "Spin Bowler"];
  const roleVal = batRoles.includes(player.role) ? dna.batValue
    : bowlRoles.includes(player.role) ? dna.bowlValue
    : dna.alrValue;
  const roleNorm = (roleVal - 30) / 65;
  m *= 0.84 + roleNorm * 0.34;

  // ── Reputation → big-names preference (Issue 8) ──────────────────────────
  // The 1-10 reputation score maps straight onto bigNamesPref: star-hungry
  // teams (RCB 96, MI 87) pay visibly more for high-visibility names.
  const rep = repOf(player);
  if (rep >= 8) {
    const bigNorm = clamp((dna.bigNamesPref - 40) / 60, 0, 1);
    const repNorm = (rep - 7) / 3; // 8→0.33, 10→1.0
    m *= 1.0 + bigNorm * repNorm * u(0.12, 0.30);
  } else if (rep <= 4 && dna.bigNamesPref >= 80) {
    // Star-obsessed franchises mildly undervalue anonymous players
    m *= u(0.93, 1.00);
  }

  // ── Leadership premium (Issue 8) ─────────────────────────────────────────
  // Every team wants a captain + vice-captain; premium until 2 leaders secured
  const capt = player.captaincy ?? 0;
  if (capt >= 65) {
    const capNorm = clamp((capt - 65) / 34, 0, 1);
    if (comp.leaders === 0)      m *= 1.0 + capNorm * u(0.18, 0.40);
    else if (comp.leaders === 1) m *= 1.0 + capNorm * u(0.08, 0.22);
    else                          m *= 1.0 + capNorm * u(0.00, 0.06);
  }

  // ── Finisher premium (Issue 4) ───────────────────────────────────────────
  // Death-overs hitters are a tactical asset, priced above their raw averages.
  // Scales with batting aggression; strongest while the team lacks finishers.
  if (isFinisherType(player)) {
    const aggNorm = clamp(((player.battingAggression ?? 75) - 70) / 29, 0, 1);
    if (comp.finishers < 2) m *= 1.0 + 0.10 + aggNorm * u(0.12, 0.30);
    else                     m *= 1.0 + aggNorm * u(0.02, 0.12);
  }

  // ── Youngster preference ──────────────────────────────────────────────────
  if (player.age <= 23 && (player.potential === "Wonderkid" || player.potential === "Promising")) {
    const youthNorm = Math.max(0, (dna.prefYoungsters - 20) / 80);
    m *= 1.0 + youthNorm * u(0.08, 0.22);
  }

  // ── Experience focus ──────────────────────────────────────────────────────
  if (player.age >= 31 && player.isCapped) {
    const expNorm = Math.max(0, (dna.experienceFocus - 20) / 80);
    m *= 1.0 + expNorm * u(0.06, 0.18);
  } else if (player.age <= 22 && dna.experienceFocus >= 80) {
    const penalty = (dna.experienceFocus - 80) / 20;
    m *= 1.0 - penalty * u(0.02, 0.07);
  }

  // ── Segment focus (Issue 9) — teamLogic.csv nationality × role targeting ──
  // Focus 30 → ~0.90×, focus 95 → ~1.12×, with per-lot variance so the bias
  // stays organic rather than rigid.
  const focus = segmentFocusOf(team, player);
  const focusNorm = clamp((focus - 62.5) / 32.5, -1, 1);
  m *= 1.0 + focusNorm * u(0.04, 0.13);

  return m;
}

// ---------------------------------------------------------------------------
// Participation — whether a team enters the bidding at all
// ---------------------------------------------------------------------------
function getRoleExcess(role: string, comp: SquadComp): number {
  if (role === "WK-Batsman")  return comp.wks         - RULES.wks;
  if (role === "Batsman")     return comp.batters      - RULES.batters;
  if (role === "Pace Bowler") return comp.pacers       - RULES.pacers;
  if (role === "Spin Bowler") return comp.spinners     - RULES.spinners;
  if (role === "All-Rounder") return comp.allrounders  - RULES.allrounders;
  return 0;
}

/** True when this player would fill a roster guideline the team is behind on. */
function fillsLaggingGuideline(player: Player, comp: SquadComp, quirks: TeamQuirks): boolean {
  if (player.isOpener && comp.openers < quirks.openersTarget) return true;
  if (isKeeper(player) && comp.keepers < quirks.keepersTarget) return true;
  if (player.role === "All-Rounder" && comp.allrounders < quirks.arTarget) return true;
  if (isQualityPaceOption(player) && comp.qualityPace < quirks.qualityPaceTarget) return true;
  if (isQualitySpinOption(player, comp.qualitySpin === 0 ? 74 : 78) && comp.qualitySpin < quirks.qualitySpinTarget) return true;
  if (isFinisherType(player) && comp.finishers < quirks.finisherTarget) return true;
  return false;
}

function shouldParticipate(
  player: Player,
  team: Team,
  comp: SquadComp,
  fsm: FSMState,
  quirks: TeamQuirks
): boolean {
  if (fsm === "Panic") {
    return getRoleNeedMult(player, comp, fsm) > 1.5
      || fillsLaggingGuideline(player, comp, quirks)
      || Math.random() < u(0.18, 0.40);
  }
  if (player.role === "WK-Batsman" && comp.wks === 0) return true;

  const excess = getRoleExcess(player.role, comp);
  const star   = player.starRating;
  const dna    = team.dna;

  let chance: number;
  if (excess < 0) {
    chance = star >= 4.5 ? u(0.60, 0.85) : star >= 4.0 ? u(0.46, 0.70) : u(0.30, 0.54);
  } else if (excess === 0) {
    chance = star >= 4.5 ? u(0.28, 0.52) : star >= 3.5 ? u(0.18, 0.36) : u(0.10, 0.24);
  } else if (excess === 1) {
    chance = star >= 4.5 ? u(0.10, 0.24) : u(0.04, 0.14);
  } else {
    chance = u(0.008, 0.030);
  }

  // ── Guideline chasing: strongly boosts interest in lagging categories ────
  if (fillsLaggingGuideline(player, comp, quirks)) {
    chance += u(0.18, 0.38);
  }

  // ── Leadership hunting (Issue 8): until 2 leaders secured ────────────────
  if ((player.captaincy ?? 0) >= 75 && comp.leaders < 2) {
    chance += u(0.10, 0.25);
  }

  // ── Segment focus (Issue 9): affects QUANTITY pursued per segment ────────
  const focusNorm = clamp((segmentFocusOf(team, player) - 62.5) / 32.5, -1, 1);
  chance += focusNorm * u(0.04, 0.13);

  // ── Depth bonus ───────────────────────────────────────────────────────────
  if (excess >= 1 && star >= 3.0) {
    const depthFactor = Math.max(0, (dna.looksForDepth - 50) / 50);
    chance += depthFactor * u(0.04, 0.16) * (star / 5.0);
  }

  // ── Big-name magnetism — reputation-driven ────────────────────────────────
  if (repOf(player) >= 8) {
    const bigFactor = Math.max(0, (dna.bigNamesPref - 50) / 50);
    chance += bigFactor * u(0.05, 0.20);
  }

  // ── Youngster seekers ─────────────────────────────────────────────────────
  if (player.age <= 23 && player.potential === "Wonderkid") {
    const youthFactor = Math.max(0, (dna.prefYoungsters - 40) / 60);
    chance += youthFactor * u(0.04, 0.14);
  }

  return Math.random() < clamp(chance, 0, 0.92);
}

// ---------------------------------------------------------------------------
// Elite safety floor (Issue 1) — a genuinely good player must never clear the
// block without an opening bid while teams have space and funds. When a team
// declines to seriously pursue an elite player, it still books a "courtesy"
// valuation slightly above base price, guaranteeing opening interest without
// fuelling a bidding war.
// ---------------------------------------------------------------------------
function eliteFloorValuation(player: Player, team: Team, comp: SquadComp): number {
  if (!isEliteProspect(player)) return 0;
  if (comp.total >= RULES.maxTotal - 1) return 0;
  if (player.nationality === "Overseas" && comp.overseas >= RULES.maxOverseas) return 0;
  if (team.remainingPurse < player.basePrice * 4) return 0;
  if (getRoleExcess(player.role, comp) >= 3) return 0;

  const rating = ratingOf(player);
  const potRating = Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0);
  const prob = rating >= 88 ? 0.95
    : rating >= 85 ? 0.80
    : potRating >= 90 && player.age <= 23 ? 0.75 // hot wonderkids draw floor bids too
    : 0.55;
  if (Math.random() > prob) return 0;
  return Math.round(player.basePrice * u(1.05, 1.50));
}

// ---------------------------------------------------------------------------
// Tier-dependent price discipline (Issues 3 + 5).
// Mid-tier (3.0-3.5★) valuations hit a much lower soft ceiling with tiny
// carry-through AND a hard cap around ₹9-11 Cr, so average players cannot be
// valued like superstars. Marquee ceilings are tightened so a superstar costs
// ₹18-28 Cr, not half the purse.
// ---------------------------------------------------------------------------
function applyTierCeiling(raw: number, base: number, star: number): number {
  let ceilMult: number, carry: number, hardCap = Infinity;

  if (star <= 2.5) {
    ceilMult = u(1.90, 3.00); carry = u(0.10, 0.25);
  } else if (star <= 3.0) {
    ceilMult = u(1.30, 1.70); carry = u(0.04, 0.10); hardCap = u(720, 950);
  } else if (star <= 3.5) {
    ceilMult = u(1.20, 1.55); carry = u(0.04, 0.10); hardCap = u(850, 1150);
  } else if (star <= 4.0) {
    ceilMult = u(1.35, 1.80); carry = u(0.06, 0.14);
  } else {
    ceilMult = u(1.30, 1.65); carry = u(0.05, 0.12);
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
  const fsm    = getFSMState(team, comp, ctx, quirks);

  if (fsm === "Snoozing") {
    return Math.round(player.basePrice * lognormal(u(0.08, 0.18)));
  }

  if (!shouldParticipate(player, team, comp, fsm, quirks)) {
    // Not actively pursuing — but elite players still get a floor bid (Issue 1)
    return eliteFloorValuation(player, team, comp);
  }

  const base = starToBaseLakhs(player.starRating);

  // Form: rating sensitivity, floor and slope both sampled
  const relevantRating = ratingOf(player);
  const formMult = relevantRating > 0
    ? u(0.86, 0.94) + (relevantRating / 100) * u(0.14, 0.26)
    : u(0.94, 1.06);

  const roleNeed = getRoleNeedMult(player, comp, fsm);
  if (roleNeed < 0.1) return eliteFloorValuation(player, team, comp);

  const natMult = getNatMult(player, comp, team, allPlayers, quirks);
  if (natMult === 0) return 0;

  const guideline   = getGuidelineBoost(player, comp, quirks, ctx);
  const loyalty     = getLoyaltyMult(player, team);
  const personality = getPersonalityMult(player, team, comp);
  const budget      = getBudgetMult(team);
  const scarcity    = getScarcityMult(player, allPlayers, ctx);
  const depletion   = getDepletionMult(player, team, allPlayers, ctx, quirks);
  const urgency     = getUrgencyMult(comp, ctx);

  // Private market read: mid-tier players price on consensus (small sigma) so
  // they can't randomly explode; contested elite lots still diverge wildly.
  const isMidTier = player.starRating >= 3.0 && player.starRating <= 3.5;
  const lnSigma = isMidTier ? u(0.12, 0.22) : u(0.18, 0.36);
  const lnVar   = lognormal(lnSigma);

  const raw = base * formMult * roleNeed * natMult * guideline * loyalty
    * personality * budget * scarcity * depletion * urgency
    * quirks.temperament * lnVar;

  // Tier-dependent ceiling (Issues 3 + 5)
  const cappedRaw = applyTierCeiling(raw, base, player.starRating);

  // Commitment: per-team fraction of REMAINING purse on one player,
  // tightened so a single superstar can't gut the squad build (Issue 5)
  const commitBase = 0.10 + (team.dna.commitmentToTargets / 100) * 0.26; // 0.13-0.36
  const commitMean = u(commitBase * 0.85, commitBase * 1.15);
  const commitPct  = clamp(commitMean * lognormal(u(0.12, 0.22)), 0.08, 0.38);
  const purseCap   = team.remainingPurse * commitPct;

  // Absolute franchise cap: even the most aggressive team never plans more
  // than ~a quarter-to-third of its TOTAL purse on one lot
  const absCap = team.totalPurse * (0.20 + (team.dna.commitmentToTargets / 100) * 0.09) * u(0.92, 1.08);

  let value = Math.min(cappedRaw, purseCap, absCap);

  // Elite floor: a top player a team CAN afford is always worth ≥ base price
  if (isEliteProspect(player) && value < player.basePrice
      && team.remainingPurse >= player.basePrice * 4) {
    value = player.basePrice * u(1.05, 1.35);
  }

  return Math.round(value);
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
function estimateRetentionWorth(player: Player, team: Team): number {
  let worth = starToBaseLakhs(player.starRating);

  // Skill: same shape as auction form multiplier
  const rating = ratingOf(player);
  if (rating > 0) worth *= 0.90 + (rating / 100) * 0.20;

  // Age curve: youth appreciates, veterans depreciate
  if      (player.age <= 24) worth *= u(1.05, 1.20);
  else if (player.age <= 29) worth *= u(1.00, 1.10);
  else if (player.age <= 33) worth *= u(0.88, 1.00);
  else                        worth *= u(0.70, 0.90);

  // Potential upside
  if (player.potential === "Wonderkid")      worth *= u(1.10, 1.30);
  else if (player.potential === "Promising") worth *= u(1.02, 1.15);

  // Reputation & leadership & finishing — the extended database fields
  const rep = repOf(player);
  if (rep >= 8) worth *= 1 + (rep - 7) * u(0.04, 0.10);
  if ((player.captaincy ?? 0) >= 80) worth *= u(1.04, 1.14);
  if (isFinisherType(player) && (player.battingAggression ?? 0) >= 85) worth *= u(1.02, 1.12);

  // Team lens: role valuation + segment focus shade the worth estimate
  const dna = team.dna;
  const batRoles = ["Batsman", "WK-Batsman"];
  const bowlRoles = ["Pace Bowler", "Spin Bowler"];
  const roleVal = batRoles.includes(player.role) ? dna.batValue
    : bowlRoles.includes(player.role) ? dna.bowlValue
    : dna.alrValue;
  worth *= 0.90 + ((roleVal - 30) / 65) * 0.20;
  const focusNorm = clamp((segmentFocusOf(team, player) - 62.5) / 32.5, -1, 1);
  worth *= 1 + focusNorm * u(0.02, 0.08);

  // Per-run noise so retention sets differ between saves
  worth *= lognormal(u(0.10, 0.16));

  return worth;
}

export function decideAIRetentions(
  team: Team,
  allPlayers: Record<string, Player>
): string[] {
  const squad = team.squad.map(id => allPlayers[id]).filter(Boolean);
  const loyaltyNorm = team.dna.loyalty / 100;

  // Spend guard: leave enough purse to build an 18-25 squad at auction.
  // High-loyalty teams tolerate committing more of the purse to retentions.
  const maxRetentionSpend = team.totalPurse * u(0.44, 0.58) * (0.92 + loyaltyNorm * 0.16);

  const isCappedPlayer = (p: Player) => p.isCapped || p.nationality === "Overseas";

  const cappedCandidates = squad
    .filter(isCappedPlayer)
    .map(p => ({ p, worth: estimateRetentionWorth(p, team) }))
    .sort((a, b) => b.worth - a.worth);

  const uncappedCandidates = squad
    .filter(p => !isCappedPlayer(p))
    .map(p => ({ p, worth: estimateRetentionWorth(p, team) }))
    .sort((a, b) => b.worth - a.worth);

  const retained: string[] = [];
  let cappedUsed = 0;
  let uncappedUsed = 0;
  let totalSpend = 0;

  // ── Capped retentions: worth vs slab cost, loyalty lowers the bar ─────────
  for (const { p, worth } of cappedCandidates) {
    if (cappedUsed >= MAX_CAPPED || retained.length >= MAX_TOTAL) break;
    const slabCost = RETENTION_SLABS[cappedUsed];
    if (totalSpend + slabCost > maxRetentionSpend) break;

    // Base bar: the player must be worth roughly the slab. Loyalty discounts
    // the bar by up to ~22%; disloyal teams demand a clear surplus. The bar
    // escalates with each slab used — the 4th/5th retention (₹18/14 Cr again)
    // must be justified against the auction flexibility it forfeits.
    let bar = slabCost * (1.06 - loyaltyNorm * 0.24) * (1 + cappedUsed * 0.06);

    // Iconic-star override: high-loyalty franchises protect faces of the
    // franchise (rep ≥ 9) even at a real financial deficit.
    const rep = repOf(p);
    if (rep >= 9 && loyaltyNorm >= 0.6 && ratingOf(p) >= 80) {
      bar = Math.min(bar, slabCost * u(0.55, 0.75));
    }
    // Elite young cornerstone: everyone fights to keep a sub-27 superstar
    if (ratingOf(p) >= 88 && p.age <= 27) {
      bar = Math.min(bar, slabCost * u(0.70, 0.88));
    }

    if (worth >= bar) {
      retained.push(p.id);
      cappedUsed++;
      totalSpend += slabCost;
    }
    // No break on decline: a later candidate with an override may still
    // qualify at this same slab price.
  }

  // ── Uncapped retentions: cheap slab, so the bar is a value multiple ──────
  for (const { p, worth } of uncappedCandidates) {
    if (uncappedUsed >= MAX_UNCAPPED || retained.length >= MAX_TOTAL) break;
    if (totalSpend + UNCAPPED_SLAB > maxRetentionSpend) break;

    // Retain when worth clearly exceeds the ₹4 Cr slab; loyalty + youth help
    let bar = UNCAPPED_SLAB * u(1.35, 2.10) * (1.05 - loyaltyNorm * 0.15);
    if (p.age <= 23 && (p.potential === "Wonderkid" || p.potential === "Promising")) {
      bar *= u(0.75, 0.92);
    }

    if (worth >= bar) {
      retained.push(p.id);
      uncappedUsed++;
      totalSpend += UNCAPPED_SLAB;
    }
  }

  return retained;
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
