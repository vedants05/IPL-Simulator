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
  isAcceleratedPhase?: boolean;
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

export function ratingOf(p: Player): number {
  return Math.max(p.currentBatting ?? 0, p.currentBowling ?? 0);
}

/** Reputation 1-10; fallback derives from star rating for legacy data. */
function repOf(p: Player): number {
  return p.reputation ?? 5;
}

export function isKeeper(p: Player): boolean {
  return !!(p.isWicketkeeper || p.isPartTimeWk || p.role === "WK-Batsman");
}

function isFullTimeKeeper(p: Player): boolean {
  return !!((p.isWicketkeeper || p.role === "WK-Batsman") && !p.isPartTimeWk);
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

function isSpinAllRounder(p: Player): boolean {
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
    const potentialScaling = cur < 72 ? 0.05 : (0.20 + 0.50 * penaltyFactor); // Heavily discount under 72
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

  // New constraints properties
  premiumIndians: number;
  premiumOverseas: number;
  premiumWKs: number;
  wks76: number;
  qualityKeepers: number;
  battingIndians78: number;
  bowlingIndians77: number;
  spinners75: number;
  spinners79: number;
  spinAllRounders75: number;
  totalSpinners75: number;
  openers75: number;
  coreBatters75: number;
  pacers78: number;
  spinners76: number;
  elitePacersCount: number;

  // Added batting slot coverage properties
  uncoveredBattingSlots: string[];
  overseasMiddleOrderCount: number;

  // Added Indian specific hard minimum counters
  indianBatters74: number;
  indianBatters77: number;
  indianBowlers: number;
}

// IPL structural rules — these are fixed (league rules, not preferences)
const RULES = {
  batters: 5, wks: 2, allrounders: 2, spinners: 2, pacers: 3,
  minTotal: 18, maxTotal: 25, maxOverseas: 8, minSalaryPerSlot: 30,
};

function getBattingSlotsCoverage(squad: Player[]): {
  assignment: Record<string, string>;
  uncovered: string[];
} {
  const players = squad.filter(p => ratingOf(p) >= 75).sort((a, b) => ratingOf(b) - ratingOf(a));
  const slots = ["opener1", "opener2", "slot3", "slot4", "slot5", "slot6", "slot7", "slot8"];

  const isEligible = (p: Player, slot: string): boolean => {
    if (slot === "opener1" || slot === "opener2") return !!p.isOpener;
    if (slot === "slot3") return !!p.hasBattedAt3;
    if (slot === "slot4") return !!p.hasBattedAt4;
    if (slot === "slot5") return !!p.hasBattedAt5;
    if (slot === "slot6") return !!p.hasBattedAt6;
    if (slot === "slot7") return !!p.hasBattedAt7;
    if (slot === "slot8") return p.role === "Batsman" || p.role === "WK-Batsman" || p.role === "All-Rounder";
    return false;
  };

  const match: Record<string, string> = {}; // slot -> player.id

  const findPath = (playerId: string, visited: Set<string>): boolean => {
    const player = players.find(p => p.id === playerId);
    if (!player) return false;

    for (const slot of slots) {
      if (isEligible(player, slot) && !visited.has(slot)) {
        visited.add(slot);
        const currentMatch = match[slot];
        if (currentMatch) {
          const currentMatchPlayer = players.find(p => p.id === currentMatch);
          if (currentMatchPlayer && ratingOf(currentMatchPlayer) > 80) {
            continue; // Exception: do not displace players rated > 80
          }
        }
        if (!currentMatch || findPath(currentMatch, visited)) {
          match[slot] = playerId;
          return true;
        }
      }
    }
    return false;
  };

  for (const player of players) {
    findPath(player.id, new Set<string>());
  }

  const uncovered = slots.filter(s => !match[s]);
  return {
    assignment: match,
    uncovered
  };
}

function getSquadComp(squad: Player[]): SquadComp {
  const premiumIndians = squad.filter(p => p.nationality === "Indian" && ratingOf(p) > 78).length;
  const premiumOverseas = squad.filter(p => p.nationality === "Overseas" && ratingOf(p) > 78).length;
  const premiumWKs = squad.filter(p => isKeeper(p) && ratingOf(p) > 78).length;

  const indians = squad.filter(p => p.nationality === "Indian");
  let battingIndians78 = 0;
  let bowlingIndians77 = 0;

  const indiansWithDiff = indians.map(p => ({
    player: p,
    diff: (p.currentBatting ?? 0) - (p.currentBowling ?? 0)
  })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  for (const item of indiansWithDiff) {
    const p = item.player;
    if (item.diff > 0) {
      if ((p.currentBatting ?? 0) > 78) battingIndians78++;
    } else if (item.diff < 0) {
      if ((p.currentBowling ?? 0) > 77) bowlingIndians77++;
    } else {
      if (battingIndians78 < 5 && bowlingIndians77 >= 4) {
        if ((p.currentBatting ?? 0) > 78) battingIndians78++;
      } else if (bowlingIndians77 < 4 && battingIndians78 >= 5) {
        if ((p.currentBowling ?? 0) > 77) bowlingIndians77++;
      } else if (battingIndians78 < 5 && bowlingIndians77 < 4) {
        if (5 - battingIndians78 > 4 - bowlingIndians77) {
          if ((p.currentBatting ?? 0) > 78) battingIndians78++;
        } else {
          if ((p.currentBowling ?? 0) > 77) bowlingIndians77++;
        }
      } else {
        if (battingIndians78 <= bowlingIndians77) {
          if ((p.currentBatting ?? 0) > 78) battingIndians78++;
        } else {
          if ((p.currentBowling ?? 0) > 77) bowlingIndians77++;
        }
      }
    }
  }

  const spinners75 = squad.filter(p => p.role === "Spin Bowler" && (p.currentBowling ?? 0) > 75).length;
  const spinners79 = squad.filter(p => p.role === "Spin Bowler" && (p.currentBowling ?? 0) > 79).length;
  const spinAllRounders75 = squad.filter(p => isSpinAllRounder(p) && (p.currentBowling ?? 0) > 75).length;
  const totalSpinners75 = spinners75 + spinAllRounders75;

    const wks76 = squad.filter(p => isFullTimeKeeper(p) && ratingOf(p) > 76).length;

  const { assignment, uncovered } = getBattingSlotsCoverage(squad);
  let overseasMiddleOrderCount = 0;
  const playerMap = new Map(squad.map(p => [p.id, p]));
  const middleSlots = ["slot3", "slot4", "slot5", "slot6", "slot7"];
  for (const slot of middleSlots) {
    const pId = assignment[slot];
    if (pId) {
      const p = playerMap.get(pId);
      if (p && p.nationality === "Overseas") {
        overseasMiddleOrderCount++;
      }
    }
  }

  const isIndianBatter = (p: Player) => p.nationality === "Indian" && (p.role === "Batsman" || p.role === "WK-Batsman");
  const indianBatters74 = squad.filter(p => isIndianBatter(p) && ratingOf(p) > 74).length;
  const indianBatters77 = squad.filter(p => isIndianBatter(p) && ratingOf(p) > 77).length;
  const indianBowlers = squad.filter(p => p.nationality === "Indian" && (p.role === "Pace Bowler" || p.role === "Spin Bowler")).length;

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

    premiumIndians,
    premiumOverseas,
    premiumWKs,
    wks76,
    qualityKeepers: squad.filter(p => isKeeper(p) && ratingOf(p) >= 77).length,
    battingIndians78,
    bowlingIndians77,
    spinners75,
    spinners79,
    spinAllRounders75,
    totalSpinners75,
    openers75: squad.filter(p => !!p.isOpener && ratingOf(p) >= 75).length,
    coreBatters75: squad.filter(p => !!p.isCoreBatter && ratingOf(p) >= 75).length,
    pacers78: squad.filter(p => p.role === "Pace Bowler" && (p.currentBowling ?? 0) >= 78).length,
    spinners76: squad.filter(p => p.role === "Spin Bowler" && (p.currentBowling ?? 0) >= 76).length,
    uncoveredBattingSlots: uncovered,
    overseasMiddleOrderCount,
    elitePacersCount: squad.filter(p => p.role === "Pace Bowler" && ratingOf(p) >= 80).length,
    
    indianBatters74,
    indianBatters77,
    indianBowlers,
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

  // 11. Custom Player Count requirements
  // 8 Indians and 4 overseas players with rating > 78 including 1 wicketkeeper
  if (player.nationality === "Indian" && rating > 78) {
    if ((comp.premiumIndians ?? 0) < 8) fit += u(0.35, 0.55);
  }
  if (player.nationality === "Overseas" && rating > 78) {
    if ((comp.overseas ?? 0) >= 5) {
      // Once you reach 5 overseas players reduce the need for higher-rated overseas players
      fit *= 0.60;
    } else {
      if ((comp.premiumOverseas ?? 0) < 4) {
        fit += u(0.35, 0.55);
      }
    }
  }
  if (isKeeper(player)) {
    if ((comp.keepers ?? 0) < 2) {
      fit += u(2.00, 2.80);
    }
    if (rating >= 77 && (comp.qualityKeepers ?? 0) === 0) {
      fit += u(1.80, 2.50);
    }
  }
  if (isFullTimeKeeper(player) && rating >= 76) {
    if ((comp.wks76 ?? 0) < 2) {
      fit += u(1.80, 2.60);
    }
  }

  // Opener requirements: At least 3 players who can open and 2 openers above 75 rated
  if (player.isOpener) {
    if ((comp.openers ?? 0) < 3) {
      fit += u(1.50, 2.20);
    }
    if (rating >= 75 && (comp.openers75 ?? 0) < 2) {
      fit += u(1.80, 2.60);
    }
  }

  // Core Batter requirements: At least 4 core batters above 75 rated
  if (player.isCoreBatter && rating >= 75) {
    if ((comp.coreBatters75 ?? 0) < 4) {
      fit += u(1.80, 2.60);
    }
  }

  // Pacer requirements: At least 3 pacers rated 78+ (over 77)
  if (player.role === "Pace Bowler" && (player.currentBowling ?? 0) >= 78) {
    if ((comp.pacers78 ?? 0) < 3) {
      fit += u(1.80, 2.60);
    }
  }

  // Spinner requirements: At least 2 spinners rated 76+ (over 75)
  if (player.role === "Spin Bowler" && (player.currentBowling ?? 0) >= 76) {
    if ((comp.spinners76 ?? 0) < 2) {
      fit += u(1.80, 2.60);
    }
  }

  if (player.nationality === "Indian") {
    const isBattingPrimarily = (player.currentBatting ?? 0) >= (player.currentBowling ?? 0);
    if (isBattingPrimarily && (player.currentBatting ?? 0) > 78) {
      if ((comp.battingIndians78 ?? 0) < 5) fit += u(0.35, 0.55);
    } else if (!isBattingPrimarily && (player.currentBowling ?? 0) > 77) {
      if ((comp.bowlingIndians77 ?? 0) < 4) fit += u(0.35, 0.55);
    }
  }

  // Indian specific hard minimum targets (5 batters > 74, 3 batters > 77, 4 bowlers)
  const isIndBatter = player.nationality === "Indian" && (player.role === "Batsman" || player.role === "WK-Batsman");
  if (isIndBatter) {
    if (rating > 77 && (comp.indianBatters77 ?? 0) < 3) {
      fit += u(1.80, 2.60);
    }
    if (rating > 74 && (comp.indianBatters74 ?? 0) < 5) {
      fit += u(1.50, 2.20);
    }
  }
  if (player.nationality === "Indian" && (player.role === "Pace Bowler" || player.role === "Spin Bowler")) {
    if ((comp.indianBowlers ?? 0) < 4) {
      fit += u(1.60, 2.40);
    }
  }

  // Spinner requirements: minimum of 3 spinners > 75 (total), and at least 2 must be out-and-out spinners (>75). One out-and-out must be > 79.
  if (player.role === "Spin Bowler") {
    if ((player.currentBowling ?? 0) > 79 && (comp.spinners79 ?? 0) < 1) {
      fit += u(0.45, 0.65);
    }
    if ((player.currentBowling ?? 0) > 75) {
      if ((comp.spinners75 ?? 0) < 2) {
        fit += u(0.35, 0.55);
      }
      if ((comp.totalSpinners75 ?? 0) < 3) {
        fit += u(0.30, 0.50);
      }
    }
  }

  // 12. Batting Slots Coverage and Overseas middle-order limits
  if (rating >= 75) {
    const playerEligibleSlots = [];
    if (player.isOpener) {
      playerEligibleSlots.push("opener1", "opener2");
    }
    if (player.hasBattedAt3) playerEligibleSlots.push("slot3");
    if (player.hasBattedAt4) playerEligibleSlots.push("slot4");
    if (player.hasBattedAt5) playerEligibleSlots.push("slot5");
    if (player.hasBattedAt6) playerEligibleSlots.push("slot6");
    if (player.hasBattedAt7) playerEligibleSlots.push("slot7");
    if (player.role === "Batsman" || player.role === "WK-Batsman" || player.role === "All-Rounder") {
      playerEligibleSlots.push("slot8");
    }

    const coversMissingSlot = playerEligibleSlots.some(slot =>
      comp.uncoveredBattingSlots && comp.uncoveredBattingSlots.includes(slot)
    );

    if (coversMissingSlot) {
      fit += u(0.80, 1.20);
    }
  }

  if (player.nationality === "Overseas") {
    const isPrimaryBowler = player.role === "Pace Bowler" || player.role === "Spin Bowler" || 
      (player.role === "All-Rounder" && (player.currentBowling ?? 0) >= (player.currentBatting ?? 0));
    
    if (!isPrimaryBowler) {
      const isMiddleOrderCapable = !!(player.hasBattedAt3 || player.hasBattedAt4 || player.hasBattedAt5 || player.hasBattedAt6 || player.hasBattedAt7);
      if (isMiddleOrderCapable) {
        if ((comp.overseasMiddleOrderCount ?? 0) >= 2) {
          fit *= 0.40;
        }
        if (comp.overseas >= 3) {
          fit *= 0.60;
        }
      }
    }
  }

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
  if (pot >= 88 && player.age <= 25 && rating >= 72) {
    const penaltyFactor = clamp((rating - 76) / 7, 0, 1);
    const penalty = 6 - 5 * penaltyFactor; // 76 or below -> 6, 82 -> 1.71 (rounds to 2), 83 -> 1
    q = Math.max(q, Math.round(pot - penalty));
  }

  // Twilight Veteran Penalty: For players over 35 with a rating of 81 or below,
  // apply a progressive quality tier penalty representing their declining prime.
  if (player.age > 35 && rating < 82) {
    const penalty = 3 + (player.age - 36) * 1.5; // 3 points off at 36, 4.5 at 37, 6 at 38...
    q = Math.max(40, q - penalty);
  }
  
  return Math.min(97, q);
}

function qualityToBaseLakhs(quality: number): number {
  if (quality >= 85) {
    return 1280 + ((quality - 85) / 12) * 770;
  }
  if (quality >= 75) {
    return 460 + ((quality - 75) / 10) * 820;
  }
  if (quality >= 65) {
    return 150 + ((quality - 65) / 10) * 310;
  }
  if (quality >= 55) {
    return 50 + ((quality - 55) / 10) * 100;
  }
  return Math.max(20, 20 + ((quality - 30) / 25) * 30);
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
  fitOverride?: number,
  avgPerSlot?: number
): number {
  const fit = fitOverride ?? computePlayerFit(player, team, comp, quirks);
  const effQ = effectiveQuality(player);
  const anchor = qualityToBaseLakhs(effQ);

  let premium = 0.55 + fit * 0.46;
  const rating = ratingOf(player);
  const isIndBatter = player.nationality === "Indian" && (player.role === "Batsman" || player.role === "WK-Batsman");
  const needsOpeners = player.isOpener && ((comp.openers ?? 0) < 3 || (rating >= 75 && (comp.openers75 ?? 0) < 2));
  const needsCoreBatters = player.isCoreBatter && rating >= 75 && (comp.coreBatters75 ?? 0) < 4;
  const needsPacers = player.role === "Pace Bowler" && (player.currentBowling ?? 0) >= 78 && (comp.pacers78 ?? 0) < 3;
  const needsSpinners = player.role === "Spin Bowler" && (player.currentBowling ?? 0) >= 76 && (comp.spinners76 ?? 0) < 2;
  const needsAnyWK = isKeeper(player) && (comp.keepers ?? 0) < 2;
  const needsQualityWK = isKeeper(player) && ratingOf(player) >= 77 && (comp.qualityKeepers ?? 0) === 0;
  const needsWKs76 = isFullTimeKeeper(player) && rating >= 76 && (comp.wks76 ?? 0) < 2;
  const needsIndianBatter77 = isIndBatter && rating >= 77 && (comp.indianBatters77 ?? 0) < 3;
  const needsIndianBatter74 = isIndBatter && rating >= 74 && (comp.indianBatters74 ?? 0) < 5;
  const needsIndianBowler = player.nationality === "Indian" && (player.role === "Pace Bowler" || player.role === "Spin Bowler") && (comp.indianBowlers ?? 0) < 4;
  
  const isPremiumCappedAR = player.role === "All-Rounder" && rating >= 80 && player.isCapped;
  const isElitePacer = player.role === "Pace Bowler" && rating >= 80;
  let targetMaxPremium = (needsOpeners || needsCoreBatters || needsPacers || needsSpinners || needsAnyWK || needsQualityWK || needsWKs76 || isPremiumCappedAR || isElitePacer || needsIndianBatter77 || needsIndianBatter74 || needsIndianBowler) ? 2.20 : 1.24;
  if (avgPerSlot !== undefined && avgPerSlot < 250) {
    // Scale maxPremium down linearly from targetMaxPremium to 1.10 as avgPerSlot goes from 250 Lakhs down to 100 Lakhs
    const factor = Math.max(0, Math.min(1, (avgPerSlot - 100) / 150));
    targetMaxPremium = 1.10 + (targetMaxPremium - 1.10) * factor;
  }

  premium = clamp(premium, 0.36, targetMaxPremium);
  let raw = anchor * premium * quirks.temperament * getPotentialMult(player);
  if (isKeeper(player)) {
    raw *= rating >= 80 ? 1.45 : 1.25;
  }
  if (isPremiumCappedAR) {
    raw *= 1.35; // All-Rounder base premium boost
  }
  if (isElitePacer) {
    if (comp.elitePacersCount >= 2) {
      raw *= player.nationality === "Indian" ? 0.75 : 0.65; // Milder penalty for scarce Indian pacers, steeper for Overseas
    } else {
      raw *= player.nationality === "Indian" ? 1.30 : 1.12; // Higher bonus for Indian, lower for Overseas
    }
  }

  // Bowler Stock Stack Penalty: If the team already has 3 or more pacers/spinners (of any rating),
  // apply a valuation discount for the 4th bowler onwards to discourage hoarding.
  if (player.role === "Pace Bowler" && comp.pacers >= 3) {
    const stackPenalty = comp.pacers === 3 ? 0.75 : 0.55;
    raw *= stackPenalty;
  }
  if (player.role === "Spin Bowler" && comp.spinners >= 3) {
    const stackPenalty = comp.spinners === 3 ? 0.75 : 0.55;
    raw *= stackPenalty;
  }
  if ((player.role === "Pace Bowler" || player.role === "Spin Bowler") && rating < 76 && !player.isRetained) {
    raw *= 0.65; // 35% discount for secondary/filler bowlers
  }

  // Twilight Veteran longevity penalty: For players over 35 with a rating of 81 or below,
  // apply a progressive valuation discount representing declining longevity (25% off at 36,
  // plus 5% more for every additional year, capped at 50% max discount).
  if (player.age > 35 && rating < 82) {
    const discount = Math.min(0.50, 0.25 + (player.age - 36) * 0.05);
    raw *= (1 - discount);
  }
  
  // Discount raw/low-ability players (<72) who have a high potential gap
  if (rating < 72) {
    const gap = Math.max(0, potentialOf(player) - rating);
    if (gap >= 8) {
      raw *= 0.75; // 25% discount for raw potential without current ability
    }
  }

  // Depth Discount: if squad size >= 16, bid more conservatively on non-marquee targets to keep depth players cheap
  const isMarquee = ratingOf(player) >= 84 || (player.reputation ?? 0) >= 9 || (player.role === "Pace Bowler" && ratingOf(player) >= 80);
  if (comp.total >= 16 && !isMarquee) {
    raw *= 0.85; // 15% discount on depth targets
  }
  
  let finalVal = applyQualityCeiling(raw, anchor, effQ, player);
  
  // Cap low-rated (<=74) or uncapped overseas players to at most 1 Cr above their base price
  if (player.nationality === "Overseas" && (!player.isCapped || rating <= 74)) {
    const baseLakhs = player.basePrice ?? 50;
    finalVal = Math.min(finalVal, baseLakhs + 100);
  }
  
  return finalVal;
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
  // If purse is low, dynamically scale target squad size smoothly down to at least minSquad + 3
  // (22 for AI, 21 for user) to keep target squad sizes high while maintaining slot safety.
  const minSquad = team.minSquadSize ?? 18;
  const floorTarget = minSquad + 3; // 22 for AI/user initially
  let targetSquad = 25;
  if (team.remainingPurse < 3000) {
    // Scale target squad down from 25 to floorTarget as purse goes from 3000 Lakhs down to 500 Lakhs
    const factor = Math.max(0, Math.min(1, (team.remainingPurse - 500) / 2500));
    targetSquad = Math.round(floorTarget + (25 - floorTarget) * factor);
  }
  const toBuy = clamp(targetSquad - comp.total, 1, 25);
  const avgPerSlot = team.remainingPurse / toBuy;

  // Score & rank the pool for this franchise (all stats × ideology × needs).
  const scored = pool
    .map(p => {
      const fit = computePlayerFit(p, team, comp, quirks);
      return { p, fit, val: intrinsicValue(p, team, comp, quirks, fit, avgPerSlot) };
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

  // Wicketkeeper Shortlist Guarantee: If the team lacks a premium (80+) keeper, force shortlist at least one
  const hasPremiumKeeper = squad.some(p => isKeeper(p) && ratingOf(p) >= 80);
  if (!hasPremiumKeeper) {
    const bestPoolKeeper = scored.find(s => isKeeper(s.p) && ratingOf(s.p) >= 80);
    if (bestPoolKeeper && !maxBid[bestPoolKeeper.p.id]) {
      maxBid[bestPoolKeeper.p.id] = Math.round(bestPoolKeeper.val * 1.30);
    }
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

  // --- TEMP: WICKETKEEPER CEILING BOOST ---
  if (player && isKeeper(player)) {
    ceilMult *= u(1.30, 1.50);
    carry = u(0.35, 0.55);
  }
  // ----------------------------------------

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
  // --- MID-AUCTION RE-PLANNING RULE ---
  // Delete the cached team plan if they lost a shortlist target, at regular intervals,
  // or if their purse is low (< 10 Cr) so their target squad size and slot budgets
  // dynamically scale down to reflect their actual late-auction constraints.
  if (team.remainingPurse < 1000) {
    delete _teamPlans[team.id];
  } else if (ctx && ctx.soldPlayerIds) {
    const existingPlan = _teamPlans[team.id];
    if (existingPlan) {
      const lostTarget = Object.keys(existingPlan.maxBid).some(targetId => {
        const isSold = ctx.soldPlayerIds.includes(targetId);
        const isMine = team.squad.includes(targetId);
        return isSold && !isMine;
      });
      const isInterval = ctx.soldPlayerIds.length > 0 && ctx.soldPlayerIds.length % 15 === 0;

      if (lostTarget || isInterval) {
        delete _teamPlans[team.id];
      }
    }
  }

  const squad  = team.squad.map(id => allPlayers[id]).filter(Boolean);
  const comp   = getSquadComp(squad);
  const quirks = getQuirks(team);
  const plan   = getTeamPlan(team, allPlayers);
  const rating = ratingOf(player);

  // Overseas / squad-full hard stops (the eligibility gate re-checks these too)
  if (comp.total >= RULES.maxTotal) return 0;
  if (player.nationality === "Overseas" && comp.overseas >= RULES.maxOverseas) return 0;

  // Wicketkeeper hard caps for AI teams (max 4 out-and-out keepers, max 3 overseas keepers)
  if (isFullTimeKeeper(player)) {
    const fullTimeKeepers = squad.filter(isFullTimeKeeper).length;
    if (fullTimeKeepers >= 4) return 0;

    if (player.nationality === "Overseas") {
      const overseasKeepers = squad.filter(p => isFullTimeKeeper(p) && p.nationality === "Overseas").length;
      if (overseasKeepers >= 3) return 0;
    }
  }

  const excess = getRoleExcess(player.role, comp);
  const needsBodies = comp.total < plan.targetSquad;

  const slotsToFill = Math.max(1, plan.targetSquad - comp.total);
  const avgPerSlot = team.remainingPurse / slotsToFill;

  let planned = plan.maxBid[player.id];
  let fit = computePlayerFit(player, team, comp, quirks);

  // Market correction: Rival Released Superstar Check
  const formerTeamId = player.iplHistory.find(h => h.season === "2026")?.teamId;
  let isRivalReleasedSuperstar = false;
  if (formerTeamId && formerTeamId !== team.id && ratingOf(player) >= 82) {
    const formerTeamRetainedCount = Object.values(allPlayers).filter(
      p => p.isRetained && p.retainedByTeamId === formerTeamId
    ).length;
    if (formerTeamRetainedCount <= 2) {
      isRivalReleasedSuperstar = true;
    }
  }

  if (isRivalReleasedSuperstar) {
    fit += u(0.60, 0.90);
  }

  // Emergency Shortlist Bypass: If a team has critical role deficits,
  // treat them as a planned target to bypass the unplanned price penalty
  const isIndBatter = player.nationality === "Indian" && (player.role === "Batsman" || player.role === "WK-Batsman");
  const isEmergencyWK = (isKeeper(player) && (comp.keepers ?? 0) < 2) || (isKeeper(player) && ratingOf(player) >= 77 && (comp.qualityKeepers ?? 0) === 0);
  const isEmergencyIndBowler = player.nationality === "Indian" && (player.role === "Pace Bowler" || player.role === "Spin Bowler") && (comp.indianBowlers ?? 0) < 4;
  const isEmergencyIndBatter = isIndBatter && ((ratingOf(player) > 77 && (comp.indianBatters77 ?? 0) < 3) || (ratingOf(player) > 74 && (comp.indianBatters74 ?? 0) < 5));
  
  const isEmergency = isEmergencyWK || isEmergencyIndBowler || isEmergencyIndBatter;
  if (planned === undefined && isEmergency) {
    planned = Math.round(intrinsicValue(player, team, comp, quirks, fit, avgPerSlot) * 1.15);
  }

  // Scarcity Boost for critical roles (Wicketkeepers and Premium Spinners)
  if (ctx && ctx.remainingPlayerIds) {
    const remainingPlayers = ctx.remainingPlayerIds.map(id => allPlayers[id]).filter(Boolean);
    if (isKeeper(player) && (comp.keepers ?? 0) < 2) {
      const remainingKeepers = remainingPlayers.filter(isKeeper).length;
      if (remainingKeepers <= 4) fit += 1.20;
      else if (remainingKeepers <= 8) fit += 0.60;
    }
    if (player.role === "Spin Bowler" && ratingOf(player) >= 76 && (comp.spinners76 ?? 0) < 2) {
      const remainingSpinners = remainingPlayers.filter(p => p.role === "Spin Bowler" && ratingOf(p) >= 76).length;
      if (remainingSpinners <= 4) fit += 1.20;
      else if (remainingSpinners <= 8) fit += 0.60;
    }
  }

  const highValue = ratingOf(player) >= 80 || (player.reputation ?? 0) >= 8;

  // ── Interest gate ─────────────────────────────────────────────────────────
  // A team bids if the player is on its shortlist, OR it still needs bodies,
  // OR he's a genuine quality asset worth having on the books. It backs off
  // only when a role is heavily overstacked (and he's not a planned target).
  const slotsLeft = plan.targetSquad - comp.total;
  const needsMinSquad = comp.total < 18;
  
  const progress = (ctx && ctx.currentLotIndex && ctx.totalLots) ? (ctx.currentLotIndex / ctx.totalLots) : 0;
  const isLateAuction = progress >= 0.60 || (ctx && ctx.isAcceleratedPhase);
  const isCheapFiller = rating >= 70 && (player.basePrice ?? 30) <= 50;
  const allowLateFiller = isLateAuction && isCheapFiller;

  if (planned === undefined && !needsMinSquad) {
    if (!needsBodies && !highValue && !isEmergency && !allowLateFiller) return 0;
    // Role-stacking limit relaxes when the squad is well short of a full 25 —
    // a team that still needs many bodies takes the best available even if the
    // role is a little crowded, so everyone fills out to 25.
    const excessLimit = slotsLeft >= 6 ? 3 : slotsLeft >= 3 ? 4 : 6;
    if (excess >= excessLimit && !highValue && !allowLateFiller) return 0;
    // Weak-fit filler is ignored while there's still real squad-building to do.
    let fitFloor = highValue ? 0.28 : slotsLeft >= 8 ? 0.50 : slotsLeft >= 4 ? 0.34 : 0.18;
    if (isLateAuction && rating < 75) {
      fitFloor = 0.05; // Extremely relaxed fit floor for late auction fillers
    }
    if (fit < fitFloor && !isEmergency && !allowLateFiller) return 0;
  }

  // ── Market-anchored value for EVERY interested team ───────────────────────
  let base = intrinsicValue(player, team, comp, quirks, fit, avgPerSlot);

  if (planned !== undefined) {
    // Shortlist premium — pay a touch above market for pre-formed targets.
    base = Math.max(base, planned) * u(1.0, 1.10);
  } else {
    // Off-shortlist: scale by fit so weaker fits bid modestly (but still bid,
    // so quality players find buyers instead of going unsold).
    base *= clamp(0.64 + fit * 0.40, 0.50, 1.08);
  }

  // Progress-based Valuation Discount: past 75% progress (e.g. Set 6+ or accelerated sets),
  // decrease valuations gradually to 50% discount at >=100% progress.
  if (ctx && ctx.currentLotIndex && ctx.totalLots) {
    const progress = ctx.currentLotIndex / ctx.totalLots;
    if (progress >= 0.75) {
      const factor = Math.min(1.0, (progress - 0.75) / 0.25);
      const discount = 1.0 - 0.50 * factor;
      base *= discount;
    }
  }

  if (needsBodies) {
    base = Math.max(base, player.basePrice);
  }

  // Depth floor: while the squad still needs bodies, keep the bid off the
  // floor so squad-building depth clears for a sensible price, not scraps.
  if (needsBodies) base = Math.max(base, plan.depthValue * u(0.70, 1.10));

  if (isRivalReleasedSuperstar) {
    base *= u(1.35, 1.70); // Boost valuation to drive up the bidding war
  }

  // Penalty for low-rated overseas players (precious slot shouldn't be wasted on rating < 75)
  if (player.nationality === "Overseas" && rating < 75) {
    base *= 0.50;
  }

  // ── Live scatter so identical squads still diverge in the room ────────────
  const isPrimary = rating >= 75 && rating <= 84;
  const scatterSigma = isPrimary ? u(0.18, 0.28) : u(0.09, 0.18); // Wider scatter for primary players
  base *= lognormal(scatterSigma);

  // ── Budget-per-slot concentration ─────────────────────────────────────────
  // Self-balancing squad economics: the team spends this many "fair shares"
  // (avg purse per remaining slot) on one player — stars concentrate 4-6×,
  // depth ~0.6×. Because the fair share recomputes after every buy, a team
  // that splurges on a star automatically has less per slot for the rest, so
  // it can never overspend into a short squad — it fills all the way to 25.

  // Concentrations average near 1.0 across a full build so money and slots run
  // out together — the team fills all the way to a full 25 rather than blowing
  // the purse on a handful of stars. Genuine marquee names (85+ rating) concentrate
  // hardest, so several teams bid them into the ₹12-18 Cr range, while depth stays
  // cheap enough to still round out the squad.
  const isElitePacerOption = player.role === "Pace Bowler" && ratingOf(player) >= 80;
  const marquee = ratingOf(player) >= 84 || 
                  (player.reputation ?? 0) >= 9 || 
                  (isElitePacerOption && comp.elitePacersCount < 2);
  let concentration: number;
  if (marquee)                 concentration = u(3.2, 5.2);
  else if (isRivalReleasedSuperstar) concentration = u(2.8, 4.4); // Boost concentration for rival superstars
  else if (planned !== undefined) concentration = u(2.2, 3.4);
  else if (highValue)          concentration = u(1.7, 2.7);
  else if (fit >= 0.72)        concentration = u(1.0, 1.6);
  else                         concentration = u(0.55, 1.00);

  // Premium Capped All-Rounder Youth/Potential concentration boost
  const isPremiumYoungAR = player.role === "All-Rounder" && 
                           player.isCapped && 
                           ratingOf(player) >= 80 && 
                           player.age <= 28 && 
                           potentialOf(player) >= 84;
  if (isPremiumYoungAR && !marquee) {
    concentration *= u(1.28, 1.48); // Boost concentration headroom to permit bids in the ₹8-13.5 Cr range
  }

  // Reduce concentration for secondary/filler bowlers (rating < 76)
  const isSecondaryBowler = (player.role === "Pace Bowler" || player.role === "Spin Bowler") && ratingOf(player) < 76;
  if (isSecondaryBowler && planned === undefined) {
    concentration *= u(0.60, 0.80); // Keep them cheap
  }

  // Depth Discount: if squad size >= 16, bid more conservatively on non-marquee targets to keep depth players cheap
  if (squad.length >= 16 && !marquee && planned === undefined) {
    concentration *= u(0.70, 0.90); // 10% to 30% discount on bidding concentration
  }

  // Filler Discount: if player rating < 74 and they are not an emergency target, scale concentration down heavily to keep them cheap
  const isFiller = ratingOf(player) < 74;
  if (isFiller && !isEmergency && planned === undefined) {
    concentration *= u(0.40, 0.60);
  }

  // A near-empty squad shouldn't hand its whole purse to lot one even so.
  let affordabilityCap = Math.min(avgPerSlot * concentration, team.remainingPurse * (marquee ? 0.60 : 0.50));
  if (marquee) {
    affordabilityCap *= u(1.15, 1.30);
  }
  if (isRivalReleasedSuperstar) {
    const purseLimit = team.remainingPurse * (marquee ? 0.72 : 0.64);
    affordabilityCap = Math.min(avgPerSlot * concentration, purseLimit) * u(1.15, 1.35);
  }

  // Budget Exhaustion Guard: If the team still needs bodies and their calculated affordability cap
  // is below the player's base price or the actual average remaining budget per required slot,
  // allow them to bid at least that amount (as long as they can afford it under the Purse Reserve Rule)
  // to prevent finishing with unspent budgets and short squads.
  if (needsBodies) {
    const bowlersCount = squad.filter(p => p.role === "Pace Bowler" || p.role === "Spin Bowler").length;
    const minSquad = team.minSquadSize ?? 18;
    const requiredSlotsLeft = Math.max(1, minSquad - comp.total, 5 - bowlersCount);
    const minAvgPerSlot = team.remainingPurse / requiredSlotsLeft;
    const floorCap = Math.max(player.basePrice, minAvgPerSlot);
    if (affordabilityCap < floorCap) {
      affordabilityCap = floorCap;
    }
  }

  // Dynamic Surplus Spending: If a team has a low remaining purse (< 12 Cr) and is looking at a quality player (rating >= 70),
  // they shouldn't let slot-budgeting (avgPerSlot) limit them too much. Instead, allow them to spend a portion
  // of their surplus budget (purse minus reserve for other slots) proportional to the player's quality.
  if (team.remainingPurse < 1200) {
    const reserveForOtherSlots = (slotsToFill - 1) * 30;
    const maxSpendable = Math.max(0, team.remainingPurse - reserveForOtherSlots);
    const qualityFactor = clamp((rating - 70) / 14, 0, 1);
    if (qualityFactor > 0) {
      affordabilityCap = Math.max(affordabilityCap, maxSpendable * qualityFactor);
    }
  }

  // Progressive Superstar Lift: If the player is a capped player, scale their bidding ceiling
  // progressively based on rating.
  // - <= 85 rating: 0% lift (normal slot-budgeting cap)
  // - 86 rating: 15% lift towards the superstar cap
  // - 87 rating: 40% lift towards the superstar cap
  // - >= 88 rating (or reputation = 10): 100% lift (up to 65% purse for Indian, 45% for Overseas)
  const isCappedPlayer = player.isCapped || player.nationality === "Overseas";
  let superstarFactor = 0;
  if (isCappedPlayer) {
    if ((player.reputation ?? 5) === 10) {
      superstarFactor = 1.0;
    } else {
      if (rating >= 88) {
        superstarFactor = 1.0;
      } else if (rating === 87) {
        superstarFactor = 0.40;
      } else if (rating === 86) {
        superstarFactor = 0.15;
      } else {
        superstarFactor = 0.0;
      }
    }
  }

  if (superstarFactor > 0) {
    const superstarMult = player.nationality === "Indian" ? 0.65 : 0.45;
    const superstarCap = team.remainingPurse * superstarMult;
    if (superstarCap > affordabilityCap) {
      affordabilityCap = affordabilityCap + (superstarCap - affordabilityCap) * superstarFactor;
    }
  }

  // Absolute franchise cap — no one player eats the whole purse
  const absCap = team.totalPurse * (0.20 + (team.dna.commitmentToTargets / 100) * 0.09) * u(0.92, 1.08);

  // Special Opener Pair Lockout: If the team already has an elite special opener pair,
  // and the player is an opener who cannot play in the middle order, they do not need them at all.
  if (player.isOpener && player.onlyOpensOrBenched) {
    const specialPairs = [
      ["sunil-narine", "finn-allen"],
      ["vaibhav-suryavanshi", "yashasvi-jaiswal"],
      ["travis-head", "abhishek-sharma"],
      ["shubman-gill", "sai-sudharsan"],
      ["prabhsimran-singh", "priyansh-arya"]
    ];
    const hasSpecialPair = specialPairs.some(pair => 
      team.squad.includes(pair[0]) && team.squad.includes(pair[1])
    );
    if (hasSpecialPair) {
      return 0;
    }
  }

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
  const bowlersCount = squad.filter(p => p.role === "Pace Bowler" || p.role === "Spin Bowler").length;
  const keepersCount = squad.filter(isKeeper).length;
  const spinnersCount = squad.filter(p => p.role === "Spin Bowler").length;
  const minSquad = team.minSquadSize ?? 18;

  const needsBowlers = Math.max(0, 5 - bowlersCount);
  const needsKeepers = keepersCount < 1 ? 1 : 0;
  const needsSpinners = Math.max(0, 2 - spinnersCount);

  const roleSlotsNeeded = Math.max(needsBowlers, needsSpinners) + needsKeepers;
  const slotsNeeded = Math.max(0, minSquad - squad.length, roleSlotsNeeded) - 1;
  return Math.max(0, slotsNeeded) * RULES.minSalaryPerSlot;
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
  const { canBid } = canTeamBidOnPlayer(team, player, allPlayers);
  if (!canBid) return false;
  if (!canTeamAffordBid(team, nextBid, allPlayers)) return false;

  const squad = team.squad.map(id => allPlayers[id]).filter(Boolean);

  // ---- WICKETKEEPER-OPENER EXCLUSION RULE ----
  const isOpenerWK = isKeeper(player) && (player.isOpener || player.onlyOpensOrBenched);
  if (isOpenerWK) {
    const specialPairs = [
      ["sunil-narine", "finn-allen"],
      ["yashasvi-jaiswal", "vaibhav-suryavanshi"],
      ["travis-head", "abhishek-sharma"],
      ["shubman-gill", "sai-sudharsan"],
      ["prabhsimran-singh", "priyansh-arya"]
    ];
    const hasSpecialPair = specialPairs.some(pair => 
      team.squad.some(id => id.startsWith(pair[0])) && team.squad.some(id => id.startsWith(pair[1]))
    );
    const playerRating = ratingOf(player);
    const openersAboveRating = squad.filter(p => p.isOpener && ratingOf(p) > playerRating).length;

    if (hasSpecialPair || openersAboveRating >= 2) {
      const isBenchedOpenerOnly = !!player.onlyOpensOrBenched;
      const teamKeeperCount = squad.filter(isKeeper).length;
      
      const remainingKeepers = ctx && ctx.remainingPlayerIds
        ? ctx.remainingPlayerIds.map(id => allPlayers[id]).filter(p => p && isKeeper(p))
        : [];
      const otherKeepersCount = remainingKeepers.filter(p => p.id !== player.id).length;
      const noOtherRealisticKeepers = otherKeepersCount <= 2 || teamKeeperCount === 0;

      if (isBenchedOpenerOnly || !noOtherRealisticKeepers) {
        return false;
      }
    }
  }

  if (player.nationality === "Overseas") {
    const overseas = squad.filter(p => p.nationality === "Overseas").length;
    if (overseas >= RULES.maxOverseas) return false;
  }
  if (squad.length >= RULES.maxTotal) return false;

  // Wicketkeeper hard caps for AI teams (max 4 out-and-out keepers, max 3 overseas keepers)
  if (isFullTimeKeeper(player)) {
    const fullTimeKeepers = squad.filter(isFullTimeKeeper).length;
    if (fullTimeKeepers >= 4) return false;

    if (player.nationality === "Overseas") {
      const overseasKeepers = squad.filter(p => isFullTimeKeeper(p) && p.nationality === "Overseas").length;
      if (overseasKeepers >= 3) return false;
    }
  }

  // Special Opener Pair Lockout: If the team already has an elite special opener pair,
  // and the player is an opener who cannot play in the middle order, they do not need them.
  if (player.isOpener && player.onlyOpensOrBenched) {
    const specialPairs = [
      ["sunil-narine", "finn-allen"],
      ["vaibhav-suryavanshi", "yashasvi-jaiswal"],
      ["travis-head", "abhishek-sharma"],
      ["shubman-gill", "sai-sudharsan"],
      ["prabhsimran-singh", "priyansh-arya"]
    ];
    const hasSpecialPair = specialPairs.some(pair => 
      team.squad.includes(pair[0]) && team.squad.includes(pair[1])
    );
    if (hasSpecialPair) return false;
  }

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
        continue;
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
