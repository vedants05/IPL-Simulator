import { getHomeStadium, type IplTeamId } from "@/lib/data/pitchCurator";
import { getClubOwnership } from "@/lib/data/clubOwnership";
import type { Team, Player } from "@/lib/types";

// ============================================================================
// 1. TICKETING & ATTENDANCE TYPES
// ============================================================================

export type MatchCategory = "platinum" | "gold" | "silver";

export interface MatchCategoryConfig {
  id: MatchCategory;
  label: string;
  priceMultiplier: number;
  demandBonus: number; // percentage bonus to crowd desire
  description: string;
  opponentTeamIds: string[];
}

export interface TicketPricingTier {
  id: "general" | "premium" | "club" | "standing";
  label: string;
  capacityShare: number; // percentage of stadium capacity allocated
  basePriceInr: number;  // baseline price per ticket
  currentPriceInr: number;
}

export interface SeasonTicketPackage {
  allocatedSeats: number;
  pricePerSeasonInr: number;
  renewalRate: number; // percentage 0-100
  soldCount: number;
  totalRevenueCr: number;
}

export interface ExpectedCrowdProjection {
  fixtureId: string;
  opponentId: string;
  opponentName: string;
  matchCategory: MatchCategory;
  matchDate: string;
  isHome: boolean;
  expectedAttendance: number;
  capacity: number;
  occupancyPercent: number;
  projectedRevenueCr: number;
  factors: {
    rivalryBoost: number;
    weekendBoost: number;
    teamFormBoost: number;
    priceElasticity: number;
  };
}

export interface TicketingState {
  tiers: TicketPricingTier[];
  seasonTickets: SeasonTicketPackage;
  matchCategories: Record<MatchCategory, MatchCategoryConfig>;
  gateReceiptsSeasonTotalCr: number;
}

export interface TicketingProjection {
  regularMatchdaySeats: number;
  weightedBasePriceInr: number;
  projectedOccupancyPercent: number;
  averageGatePerHomeMatchCr: number;
  gateReceiptsSeasonTotalCr: number;
  totalTicketingRevenueCr: number;
}

/**
 * Single generation/UI projection boundary for ticketing. Later match, supporter,
 * stadium and finance systems can supply their own demand inputs without each
 * consumer inventing a different gate-receipt formula.
 */
export function calculateTicketingProjection(
  ticketing: Pick<TicketingState, "tiers" | "seasonTickets" | "matchCategories">,
  stadiumCapacity: number,
  homeMatches = 7,
): TicketingProjection {
  const capacity = Math.max(0, Math.round(stadiumCapacity));
  const regularMatchdaySeats = Math.max(0, capacity - ticketing.seasonTickets.allocatedSeats);
  const weightedBasePriceInr = ticketing.tiers.reduce((sum, tier) => sum + tier.currentPriceInr * tier.capacityShare, 0);
  const baselineWeightedPrice = Math.max(1, ticketing.tiers.reduce((sum, tier) => sum + tier.basePriceInr * tier.capacityShare, 0));
  const categoryWeights: Record<MatchCategory, number> = { platinum: 0.2, gold: 0.35, silver: 0.45 };
  const categoryPriceMultiplier = (Object.keys(categoryWeights) as MatchCategory[]).reduce(
    (sum, category) => sum + ticketing.matchCategories[category].priceMultiplier * categoryWeights[category],
    0,
  );
  const categoryDemandBonus = (Object.keys(categoryWeights) as MatchCategory[]).reduce(
    (sum, category) => sum + ticketing.matchCategories[category].demandBonus * categoryWeights[category],
    0,
  );
  const priceRatio = weightedBasePriceInr / baselineWeightedPrice;
  const priceEffect = priceRatio >= 1 ? -(priceRatio - 1) * 0.48 : (1 - priceRatio) * 0.18;
  const occupancy = Math.max(0.62, Math.min(0.99, 0.84 + categoryDemandBonus / 100 * 0.32 + priceEffect));
  const averageGatePerHomeMatchCr = regularMatchdaySeats * weightedBasePriceInr * categoryPriceMultiplier * occupancy / 10_000_000;
  const gateReceiptsSeasonTotalCr = averageGatePerHomeMatchCr * Math.max(0, homeMatches);
  return {
    regularMatchdaySeats,
    weightedBasePriceInr: Math.round(weightedBasePriceInr),
    projectedOccupancyPercent: Number((occupancy * 100).toFixed(1)),
    averageGatePerHomeMatchCr: Number(averageGatePerHomeMatchCr.toFixed(2)),
    gateReceiptsSeasonTotalCr: Number(gateReceiptsSeasonTotalCr.toFixed(2)),
    totalTicketingRevenueCr: Number((gateReceiptsSeasonTotalCr + ticketing.seasonTickets.totalRevenueCr).toFixed(2)),
  };
}

// ============================================================================
// 2. MATCHDAY OPERATIONS TYPES
// ============================================================================

export interface SecurityLevel {
  id: "standard" | "enhanced" | "elite";
  label: string;
  costPerMatchCr: number;
  stewardsPer1000Fans: number;
  incidentMitigationRating: number; // 0 - 100
}

export interface CateringModel {
  vendorModel: "franchise_commission" | "in_house_concession";
  averageSpendPerFanInr: number;
  franchiseMarginPercent: number;
  stallsCount: number;
  satisfactionRating: number; // 0 - 100
}

export interface EventExpenditure {
  lightAndSoundPerMatchCr: number;
  fireworksAndPyroCr: number;
  fanEngageDJsAndCheerCr: number;
  sanitationAndCleanupCr: number;
}

export interface MatchdayOperationsState {
  securityLevel: SecurityLevel["id"];
  catering: CateringModel;
  eventExpenses: EventExpenditure;
  totalCostPerMatchCr: number;
  seasonalOperationalSpendCr: number;
  safetyRating: number; // 0 - 100
}

// ============================================================================
// 3. HOSPITALITY OPERATIONS TYPES
// ============================================================================

export interface CorporateBox {
  id: string;
  name: string;
  capacity: number;
  leasedSeasonally: boolean;
  clientName: string;
  leaseAmountSeasonCr: number;
  cateringTier: "gourmet_5star" | "premium_buffet" | "standard_platter";
}

export interface LoungeSuite {
  id: string;
  name: string;
  capacity: number;
  dayPassPriceInr: number;
  averageOccupancyPercent: number;
  revenueSeasonCr: number;
}

export interface PremiumExperiencePackage {
  id: string;
  title: string;
  description: string;
  pricePerPersonInr: number;
  soldPerMatch: number;
  inclusions: string[];
}

export interface HospitalityState {
  boxes: CorporateBox[];
  lounges: LoungeSuite[];
  premiumPackages: PremiumExperiencePackage[];
  totalHospitalityRevenueCr: number;
  vipRetentionRatePercent: number;
}

// ============================================================================
// 4. SPONSORSHIPS TYPES
// ============================================================================

export interface SponsorshipDeal {
  id: string;
  category: "shirt_front" | "shirt_back" | "chest_arm" | "helmet_cap" | "stadium_naming" | "stand_naming" | "secondary_partner";
  partnerName: string;
  industry: string;
  annualValueCr: number;
  yearsRemaining: number;
  satisfactionPercent: number;
  bonusTrigger: string;
  bonusAmountCr: number;
  logoColor: string;
}

export interface SponsorshipState {
  deals: SponsorshipDeal[];
  totalAnnualSponsorshipCr: number;
  reputationMultiplier: number;
}

// ============================================================================
// 5. MERCHANDISING TYPES
// ============================================================================

export interface MerchandiseItem {
  id: string;
  name: string;
  category: "apparel" | "headwear" | "equipment" | "souvenirs";
  productionCostInr: number;
  retailPriceInr: number;
  stockLevel: number;
  projectedAnnualSales: number;
  unitsSoldSeason: number;
  isMarqueePlayerSpecial?: boolean;
}

export interface MerchandisingState {
  catalog: MerchandiseItem[];
  ecommerceSharePercent: number; // vs stadium megastore
  totalMerchRevenueCr: number;
  totalMerchCostCr: number;
  grossMerchProfitCr: number;
}

// ============================================================================
// 6. MARKETING TYPES
// ============================================================================

export interface MarketingCampaign {
  id: string;
  name: string;
  tagline: string;
  channel: "city_billboards" | "digital_social" | "grassroots_clinics" | "celebrity_collab";
  budgetCr: number;
  reachImpressionsMillions: number;
  fanAcquisitionEstimate: number;
  active: boolean;
}

export interface PlayerPromoActivation {
  playerId: string;
  playerName: string;
  brandAmbassadorDaysRemaining: number;
  socialReachBoostPercent: number;
}

export interface MarketingState {
  campaigns: MarketingCampaign[];
  promotions: PlayerPromoActivation[];
  annualMarketingBudgetCr: number;
  brandEquityScore: number; // 0 - 100
  globalFollowersMillions: number;
}

// ============================================================================
// 7. UPGRADEABLE FACILITIES TYPES (No training facilities)
// ============================================================================

export type FacilityType = "medical" | "admin" | "scouting" | "commercial";

export interface FacilityLevel {
  level: number;
  name: string;
  upgradeCostCr: number;
  constructionDays: number;
  annualMaintenanceCr: number;
  benefits: string[];
}

export interface ClubFacility {
  type: FacilityType;
  name: string;
  currentLevel: number;
  maxLevel: number;
  levels: FacilityLevel[];
  isUpgrading: boolean;
  upgradeTargetLevel?: number;
  upgradeDaysRemaining?: number;
}

export interface FacilitiesState {
  facilities: Record<FacilityType, ClubFacility>;
  totalAnnualMaintenanceCr: number;
}

// ============================================================================
// 8. BROADCAST & COMPETITION INCOME TYPES
// ============================================================================

export interface BroadcastIncomeState {
  centralPoolShareCr: number;      // BCCI TV/Digital pool distribution (~₹420-460 Cr)
  tvViewershipBonusCr: number;     // Highest TRP bonus
  overseasRightsShareCr: number;   // International feeds
  competitionPrizeMoneyCr: number; // Finishes 1st: ₹20 Cr, 2nd: ₹12.5 Cr, 3rd: ₹7 Cr, 4th: ₹6.5 Cr
  currentProjectedPrizeCr: number;
  totalBroadcastIncomeCr: number;
}

// ============================================================================
// 9. OPERATING COSTS TYPES
// ============================================================================

export interface OperatingCostsState {
  squadSalariesCr: number;        // Player payroll from auction/contracts
  coachingStaffSalariesCr: number;
  travelAndHotelsCr: number;      // Flights, 5-star hotels, luxury transit
  stadiumAndTurfUpkeepCr: number; // Pitch curators, groundsmen, utilities
  administrativeCorporateCr: number; // Legal, licensing, office salaries
  totalOperatingCostsCr: number;
}

// ============================================================================
// 10. FINANCE DASHBOARD & LEDGER TYPES
// ============================================================================

export interface LedgerTransaction {
  id: string;
  date: string;
  type: "credit" | "debit";
  category: "broadcast" | "sponsorship" | "ticketing" | "hospitality" | "merchandise" | "prize_money" | "payroll" | "operations" | "facilities" | "travel";
  description: string;
  amountCr: number;
}

export interface FinanceDashboardState {
  startingCashBalanceCr: number;
  currentCashBalanceCr: number;
  projectedEndSeasonCashCr: number;
  totalIncomeCr: number;
  totalExpenditureCr: number;
  netOperatingProfitCr: number;
  profitMarginPercent: number;
  transactions: LedgerTransaction[];
}

// ============================================================================
// MASTER COMMERCIAL STATE
// ============================================================================

export interface CommercialState {
  teamId: string;
  season: number;
  ticketing: TicketingState;
  matchdayOps: MatchdayOperationsState;
  hospitality: HospitalityState;
  sponsorships: SponsorshipState;
  merchandising: MerchandisingState;
  marketing: MarketingState;
  facilities: FacilitiesState;
  broadcast: BroadcastIncomeState;
  operatingCosts: OperatingCostsState;
  finance: FinanceDashboardState;
}

// ============================================================================
// FACILITY DEFINITIONS (Levels 1 to 5)
// ============================================================================

export const FACILITY_DEFINITIONS: Record<FacilityType, { name: string; levels: FacilityLevel[] }> = {
  medical: {
    name: "Medical & Sports Science Centre",
    levels: [
      {
        level: 1,
        name: "Standard Clinic",
        upgradeCostCr: 0,
        constructionDays: 0,
        annualMaintenanceCr: 0.8,
        benefits: ["Basic first-aid & physiotherapy", "Standard recovery timelines"],
      },
      {
        level: 2,
        name: "Specialized Physio Hub",
        upgradeCostCr: 4.5,
        constructionDays: 45,
        annualMaintenanceCr: 1.5,
        benefits: ["5% faster injury recovery times", "Ultrasound and soft-tissue diagnostics"],
      },
      {
        level: 3,
        name: "Sports Biomechanics Lab",
        upgradeCostCr: 9.0,
        constructionDays: 70,
        annualMaintenanceCr: 2.4,
        benefits: ["10% faster injury recovery times", "Reduces fast-bowler micro-trauma wear", "Cryotherapy recovery baths"],
      },
      {
        level: 4,
        name: "High-Performance Medical Institute",
        upgradeCostCr: 16.0,
        constructionDays: 100,
        annualMaintenanceCr: 3.8,
        benefits: ["15% faster injury recovery times", "Early detection of stress fractures", "Lowers severe injury chance by 20%"],
      },
      {
        level: 5,
        name: "World-Class Sports Science Complex",
        upgradeCostCr: 25.0,
        constructionDays: 140,
        annualMaintenanceCr: 5.5,
        benefits: ["22% faster recovery times across squad", "Maximum injury protection for elite pace attack", "Hyperbaric recovery suites"],
      },
    ],
  },
  admin: {
    name: "Administrative HQ & Executive Campus",
    levels: [
      {
        level: 1,
        name: "Leased City Office",
        upgradeCostCr: 0,
        constructionDays: 0,
        annualMaintenanceCr: 1.0,
        benefits: ["Basic club operations", "Standard administrative handling"],
      },
      {
        level: 2,
        name: "Dedicated Club Headquarters",
        upgradeCostCr: 3.5,
        constructionDays: 40,
        annualMaintenanceCr: 1.8,
        benefits: ["Improves executive communication", "+5% board confidence buffer"],
      },
      {
        level: 3,
        name: "Franchise Operations Center",
        upgradeCostCr: 7.5,
        constructionDays: 60,
        annualMaintenanceCr: 2.8,
        benefits: ["5% reduction in administrative friction costs", "Attracts tier-1 executive talent", "Streamlined player contract filings"],
      },
      {
        level: 4,
        name: "Modern Corporate Campus",
        upgradeCostCr: 14.0,
        constructionDays: 90,
        annualMaintenanceCr: 4.0,
        benefits: ["10% reduction in departmental overheads", "Global media conference auditorium", "+10% board patience cushion"],
      },
      {
        level: 5,
        name: "Global Sports Enterprise HQ",
        upgradeCostCr: 22.0,
        constructionDays: 130,
        annualMaintenanceCr: 5.8,
        benefits: ["State-of-the-art franchise landmark", "Unlocks prestigious global corporate partnerships", "Maximum club stature"],
      },
    ],
  },
  scouting: {
    name: "Global Scouting & Analytics Lab",
    levels: [
      {
        level: 1,
        name: "Regional Scouting Desk",
        upgradeCostCr: 0,
        constructionDays: 0,
        annualMaintenanceCr: 0.6,
        benefits: ["Basic state & domestic tournament scouting", "Standard scouting reports"],
      },
      {
        level: 2,
        name: "Domestic Video & Data Room",
        upgradeCostCr: 3.0,
        constructionDays: 35,
        annualMaintenanceCr: 1.2,
        benefits: ["5% faster scouting report completion", "Reveals second-tier prospect attributes accurately"],
      },
      {
        level: 3,
        name: "Overseas Talent Tracking Network",
        upgradeCostCr: 6.5,
        constructionDays: 55,
        annualMaintenanceCr: 2.0,
        benefits: ["10% faster scouting assignments", "Tracks emerging talent across all major T20 leagues", "Pinpoints clutch temperament early"],
      },
      {
        level: 4,
        name: "AI Analytics & Ball-Tracking Lab",
        upgradeCostCr: 12.0,
        constructionDays: 85,
        annualMaintenanceCr: 3.2,
        benefits: ["15% faster scouting assignments", "Complete release of hidden potential bands", "Uncovers bargain gems in auction"],
      },
      {
        level: 5,
        name: "Global Predictive Intelligence Hub",
        upgradeCostCr: 18.5,
        constructionDays: 120,
        annualMaintenanceCr: 4.6,
        benefits: ["25% faster scouting assignments", "Instant complete scouting data on all international prospects", "Flawless talent projections"],
      },
    ],
  },
  commercial: {
    name: "Commercial & Fan Retail Complex",
    levels: [
      {
        level: 1,
        name: "Matchday Pop-Up Kiosks",
        upgradeCostCr: 0,
        constructionDays: 0,
        annualMaintenanceCr: 0.5,
        benefits: ["Basic stadium matchday merchandise sales", "Standard concession royalties"],
      },
      {
        level: 2,
        name: "Official Stadium Megastore",
        upgradeCostCr: 4.0,
        constructionDays: 45,
        annualMaintenanceCr: 1.4,
        benefits: ["+5% merchandise profit margins", "Dedicated matchday retail lines"],
      },
      {
        level: 3,
        name: "Interactive Fan Experience Zone",
        upgradeCostCr: 8.5,
        constructionDays: 70,
        annualMaintenanceCr: 2.6,
        benefits: ["+8% merchandise profit margins", "+10% hospitality and concession footfall", "E-sports and batting simulator booths"],
      },
      {
        level: 4,
        name: "Commercial Flagship Boulevard",
        upgradeCostCr: 15.0,
        constructionDays: 100,
        annualMaintenanceCr: 4.2,
        benefits: ["+12% merchandise profit margins", "Year-round tourist footfall and sales", "Premier event hosting space"],
      },
      {
        level: 5,
        name: "Franchise Megaplex & Entertainment City",
        upgradeCostCr: 24.0,
        constructionDays: 140,
        annualMaintenanceCr: 6.0,
        benefits: ["+18% merchandise profit margins", "+20% matchday ancillary revenue", "Year-round dining, museum & shopping destination"],
      },
    ],
  },
};

// ============================================================================
// SPONSORSHIP DEAL PRESETS PER FRANCHISE PROFILE
// ============================================================================

const FRANCHISE_SPONSOR_TIERS: Record<string, {
  frontSponsor: string;
  frontVal: number;
  backSponsor: string;
  backVal: number;
  secondaryBrand: string;
  secondaryVal: number;
  brandPrestige: number;
}> = {
  csk: { frontSponsor: "TVS Eurogrip", frontVal: 36, backSponsor: "India Cements", backVal: 18, secondaryBrand: "Gulf Oil", secondaryVal: 9, brandPrestige: 96 },
  mi: { frontSponsor: "Slice Card", frontVal: 38, backSponsor: "DHL Express", backVal: 19, secondaryBrand: "Astral Pipes", secondaryVal: 10, brandPrestige: 98 },
  rcb: { frontSponsor: "Qatar Airways", frontVal: 35, backSponsor: "Puma Sportswear", backVal: 17, secondaryBrand: "Happilo", secondaryVal: 8.5, brandPrestige: 95 },
  kkr: { frontSponsor: "Joy Cosmetics", frontVal: 28, backSponsor: "BKT Tires", backVal: 14, secondaryBrand: "Lux Cozi", secondaryVal: 7.5, brandPrestige: 88 },
  srh: { frontSponsor: "FanCraze", frontVal: 24, backSponsor: "BKT Tires", backVal: 12, secondaryBrand: "Kuhl Fans", secondaryVal: 6, brandPrestige: 78 },
  rr: { frontSponsor: "Luminous Power", frontVal: 25, backSponsor: "Reliance Jio", backVal: 13, secondaryBrand: "BKT Tires", secondaryVal: 6.5, brandPrestige: 80 },
  dc: { frontSponsor: "Greenpanel", frontVal: 23, backSponsor: "DP World", backVal: 12, secondaryBrand: "JBL Audio", secondaryVal: 6, brandPrestige: 76 },
  pbks: { frontSponsor: "EbixCash", frontVal: 20, backSponsor: "BKT Tires", backVal: 10, secondaryBrand: "Hindware", secondaryVal: 5, brandPrestige: 72 },
  gt: { frontSponsor: "Ather Energy", frontVal: 26, backSponsor: "Capri Loans", backVal: 13, secondaryBrand: "Simpolo", secondaryVal: 7, brandPrestige: 82 },
  lsg: { frontSponsor: "My11Circle", frontVal: 24, backSponsor: "Greenply", backVal: 12, secondaryBrand: "Too Yumm!", secondaryVal: 6, brandPrestige: 78 },
};

// ============================================================================
// FACTORY / GENERATOR FUNCTION
// ============================================================================

export function createDefaultCommercialState(
  teamId: string,
  season: number,
  customCapacity?: number,
  squadPlayers?: Player[],
): CommercialState {
  const stadium = getHomeStadium(teamId);
  const capacity = customCapacity && customCapacity > 0
    ? customCapacity
    : (stadium?.capacity ?? 45000);

  const sponsorPreset = FRANCHISE_SPONSOR_TIERS[teamId.toLowerCase()] ?? {
    frontSponsor: "National Corp",
    frontVal: 24,
    backSponsor: "Logistics India",
    backVal: 12,
    secondaryBrand: "Power Beverages",
    secondaryVal: 6,
    brandPrestige: 75,
  };

  // 1. Ticketing
  const ticketingTiers: TicketPricingTier[] = [
    { id: "standing", label: "Bleachers & Lower East", capacityShare: 0.35, basePriceInr: 950, currentPriceInr: 950 },
    { id: "general", label: "General Grandstand", capacityShare: 0.40, basePriceInr: 1750, currentPriceInr: 1750 },
    { id: "premium", label: "Premium Covered Tier", capacityShare: 0.18, basePriceInr: 4500, currentPriceInr: 4500 },
    { id: "club", label: "Club Pavilion Balcony", capacityShare: 0.07, basePriceInr: 9500, currentPriceInr: 9500 },
  ];

  const seasonTicketSeats = Math.round(capacity * 0.18);
  const seasonTicketPrice = 14000;
  const seasonTickets: SeasonTicketPackage = {
    allocatedSeats: seasonTicketSeats,
    pricePerSeasonInr: seasonTicketPrice,
    renewalRate: 91,
    soldCount: Math.round(seasonTicketSeats * 0.94),
    totalRevenueCr: Number(((seasonTicketSeats * 0.94 * seasonTicketPrice) / 10000000).toFixed(2)),
  };

  const matchCategories: Record<MatchCategory, MatchCategoryConfig> = {
    platinum: {
      id: "platinum",
      label: "Platinum (Mega Rivalry)",
      priceMultiplier: 1.45,
      demandBonus: 35,
      description: "Highest demand marquee fixtures (CSK, MI, RCB, and Playoff clashes).",
      opponentTeamIds: ["csk", "mi", "rcb"].filter((id) => id !== teamId.toLowerCase()),
    },
    gold: {
      id: "gold",
      label: "Gold (High Interest)",
      priceMultiplier: 1.18,
      demandBonus: 18,
      description: "Top-tier weekend fixtures with heavyweight championship contenders.",
      opponentTeamIds: ["kkr", "rr", "srh", "gt"].filter((id) => id !== teamId.toLowerCase()),
    },
    silver: {
      id: "silver",
      label: "Silver (Standard Matchday)",
      priceMultiplier: 1.0,
      demandBonus: 0,
      description: "Standard regular league fixtures against competitive rivals.",
      opponentTeamIds: ["dc", "pbks", "lsg"].filter((id) => id !== teamId.toLowerCase()),
    },
  };
  const initialTicketingProjection = calculateTicketingProjection({
    tiers: ticketingTiers,
    seasonTickets,
    matchCategories,
  }, capacity);

  // 2. Matchday Ops
  const matchdayOps: MatchdayOperationsState = {
    securityLevel: "enhanced",
    catering: {
      vendorModel: "franchise_commission",
      averageSpendPerFanInr: 420,
      franchiseMarginPercent: 28,
      stallsCount: Math.round(capacity / 750),
      satisfactionRating: 84,
    },
    eventExpenses: {
      lightAndSoundPerMatchCr: 0.22,
      fireworksAndPyroCr: 0.15,
      fanEngageDJsAndCheerCr: 0.12,
      sanitationAndCleanupCr: 0.16,
    },
    totalCostPerMatchCr: 0.95,
    seasonalOperationalSpendCr: 6.65,
    safetyRating: 92,
  };

  // 3. Hospitality
  const boxCount = Math.max(18, Math.round(capacity / 1200));
  const boxes: CorporateBox[] = Array.from({ length: boxCount }, (_, i) => ({
    id: `box-${i + 1}`,
    name: `Corporate Box ${100 + i + 1}`,
    capacity: 20,
    leasedSeasonally: i < Math.round(boxCount * 0.85),
    clientName: i < Math.round(boxCount * 0.85) ? `Corporate Partner ${i + 1}` : "Available for Matchday",
    leaseAmountSeasonCr: Number((0.75 + (i % 4) * 0.15).toFixed(2)),
    cateringTier: i % 3 === 0 ? "gourmet_5star" : "premium_buffet",
  }));

  const lounges: LoungeSuite[] = [
    { id: "captains-lounge", name: "The Captain's Club Lounge", capacity: 250, dayPassPriceInr: 12500, averageOccupancyPercent: 88, revenueSeasonCr: 2.1 },
    { id: "presidents-suite", name: "Presidential Pavilion Lounge", capacity: 150, dayPassPriceInr: 18000, averageOccupancyPercent: 92, revenueSeasonCr: 2.45 },
    { id: "dugout-terrace", name: "Dugout Terrace Club", capacity: 400, dayPassPriceInr: 8500, averageOccupancyPercent: 82, revenueSeasonCr: 1.95 },
  ];

  const premiumPackages: PremiumExperiencePackage[] = [
    {
      id: "toss-and-dugout",
      title: "The Inner Sanctum Experience",
      description: "Pitch-side access during the coin toss, meet-and-greet with team mentor, and front-row seats.",
      pricePerPersonInr: 35000,
      soldPerMatch: 15,
      inclusions: ["Toss viewing pass", "Signed match jersey", "Gourmet lounge dining", "VIP parking pass"],
    },
    {
      id: "postmatch-legends",
      title: "Legends Dining & Batting Masterclass",
      description: "Exclusive post-match cocktail reception with franchise icons and premium hospitality box seat.",
      pricePerPersonInr: 25000,
      soldPerMatch: 25,
      inclusions: ["Post-match player interaction", "Customised gift bag", "Executive lounge access"],
    },
  ];

  const totalHospitalityRevenueCr = Number((
    boxes.filter((b) => b.leasedSeasonally).reduce((sum, b) => sum + b.leaseAmountSeasonCr, 0)
    + lounges.reduce((sum, l) => sum + l.revenueSeasonCr, 0)
    + 1.8
  ).toFixed(2));

  // 4. Sponsorships
  const deals: SponsorshipDeal[] = [
    {
      id: "shirt-front",
      category: "shirt_front",
      partnerName: sponsorPreset.frontSponsor,
      industry: "Consumer & Tech",
      annualValueCr: sponsorPreset.frontVal,
      yearsRemaining: 2,
      satisfactionPercent: 94,
      bonusTrigger: "IPL Final Qualification",
      bonusAmountCr: 5.0,
      logoColor: "#10b981",
    },
    {
      id: "shirt-back",
      category: "shirt_back",
      partnerName: sponsorPreset.backSponsor,
      industry: "Logistics & Heavy Industry",
      annualValueCr: sponsorPreset.backVal,
      yearsRemaining: 1,
      satisfactionPercent: 89,
      bonusTrigger: "Top-4 Playoff Berth",
      bonusAmountCr: 2.5,
      logoColor: "#3b82f6",
    },
    {
      id: "chest-arm",
      category: "chest_arm",
      partnerName: sponsorPreset.secondaryBrand,
      industry: "Automotive & Energy",
      annualValueCr: sponsorPreset.secondaryVal,
      yearsRemaining: 3,
      satisfactionPercent: 92,
      bonusTrigger: "Playoff Qualification",
      bonusAmountCr: 1.0,
      logoColor: "#f59e0b",
    },
    {
      id: "stadium-naming",
      category: "stadium_naming",
      partnerName: `${stadium?.name.split(" ")[0] ?? "City"} Commercial Bank`,
      industry: "Banking & Finance",
      annualValueCr: 14.5,
      yearsRemaining: 4,
      satisfactionPercent: 90,
      bonusTrigger: "Highest Home Gate Attendance",
      bonusAmountCr: 1.5,
      logoColor: "#8b5cf6",
    },
    {
      id: "stand-naming",
      category: "stand_naming",
      partnerName: "Orbit Beverages",
      industry: "Food & Beverage",
      annualValueCr: 7.2,
      yearsRemaining: 2,
      satisfactionPercent: 86,
      bonusTrigger: "None",
      bonusAmountCr: 0,
      logoColor: "#ec4899",
    },
    {
      id: "secondary-partner",
      category: "secondary_partner",
      partnerName: "Apollo Health Network",
      industry: "Healthcare",
      annualValueCr: 5.4,
      yearsRemaining: 2,
      satisfactionPercent: 88,
      bonusTrigger: "Fair Play Award Winner",
      bonusAmountCr: 0.5,
      logoColor: "#14b8a6",
    },
  ];

  const totalAnnualSponsorshipCr = Number(deals.reduce((sum, d) => sum + d.annualValueCr, 0).toFixed(2));

  // 5. Merchandising
  const catalog: MerchandiseItem[] = [
    { id: "prod-match-jersey", name: "Official Match Playing Jersey", category: "apparel", productionCostInr: 950, retailPriceInr: 3499, stockLevel: 25000, projectedAnnualSales: 65000, unitsSoldSeason: 12400 },
    { id: "prod-fan-replica", name: "Supporter Replica T-Shirt", category: "apparel", productionCostInr: 380, retailPriceInr: 1299, stockLevel: 42000, projectedAnnualSales: 110000, unitsSoldSeason: 28500 },
    { id: "prod-training-polo", name: "Club Training & Travel Polo", category: "apparel", productionCostInr: 580, retailPriceInr: 1999, stockLevel: 14000, projectedAnnualSales: 35000, unitsSoldSeason: 8100 },
    { id: "prod-team-cap", name: "Official Franchise Cap", category: "headwear", productionCostInr: 220, retailPriceInr: 799, stockLevel: 30000, projectedAnnualSales: 85000, unitsSoldSeason: 19400 },
    { id: "prod-hoodie", name: "Varsity Zip-Up Winter Hoodie", category: "apparel", productionCostInr: 1100, retailPriceInr: 3299, stockLevel: 10000, projectedAnnualSales: 22000, unitsSoldSeason: 5200 },
    { id: "prod-autograph-bat", name: "Signature Commemorative Bat", category: "equipment", productionCostInr: 850, retailPriceInr: 2499, stockLevel: 8000, projectedAnnualSales: 16000, unitsSoldSeason: 3800 },
    { id: "prod-flags-pins", name: "Matchday Flags & Enamel Badges", category: "souvenirs", productionCostInr: 45, retailPriceInr: 199, stockLevel: 60000, projectedAnnualSales: 150000, unitsSoldSeason: 41000 },
  ];

  const totalMerchRevenueCr = Number(catalog.reduce((sum, item) => sum + (item.unitsSoldSeason * item.retailPriceInr) / 10000000, 0).toFixed(2));
  const totalMerchCostCr = Number(catalog.reduce((sum, item) => sum + (item.unitsSoldSeason * item.productionCostInr) / 10000000, 0).toFixed(2));
  const grossMerchProfitCr = Number((totalMerchRevenueCr - totalMerchCostCr).toFixed(2));

  // 6. Marketing
  const campaigns: MarketingCampaign[] = [
    {
      id: "camp-city-takeover",
      name: "Citywide Banner & Transit Takeover",
      tagline: `Unite Behind ${teamId.toUpperCase()} This Summer`,
      channel: "city_billboards",
      budgetCr: 4.5,
      reachImpressionsMillions: 45.0,
      fanAcquisitionEstimate: 120000,
      active: true,
    },
    {
      id: "camp-digital-buzz",
      name: "Short-Form Video & Creator Collabs",
      tagline: "Behind the Dugout: Unfiltered Access",
      channel: "digital_social",
      budgetCr: 3.2,
      reachImpressionsMillions: 110.0,
      fanAcquisitionEstimate: 240000,
      active: true,
    },
    {
      id: "camp-grassroots",
      name: "Junior Cricket Festival & School Clinics",
      tagline: "Tomorrow's Champions Start Here",
      channel: "grassroots_clinics",
      budgetCr: 2.1,
      reachImpressionsMillions: 8.5,
      fanAcquisitionEstimate: 65000,
      active: true,
    },
  ];

  const marqueePlayer = squadPlayers?.find((p) => (p.currentBatting >= 82 || p.currentBowling >= 82) && (p.reputation ?? 5) >= 8);
  const promotions: PlayerPromoActivation[] = marqueePlayer ? [
    {
      playerId: marqueePlayer.id,
      playerName: marqueePlayer.name,
      brandAmbassadorDaysRemaining: 3,
      socialReachBoostPercent: 32,
    },
  ] : [];

  // 7. Facilities
  const facilities: Record<FacilityType, ClubFacility> = {
    medical: {
      type: "medical",
      name: FACILITY_DEFINITIONS.medical.name,
      currentLevel: 2,
      maxLevel: 5,
      levels: FACILITY_DEFINITIONS.medical.levels,
      isUpgrading: false,
    },
    admin: {
      type: "admin",
      name: FACILITY_DEFINITIONS.admin.name,
      currentLevel: 2,
      maxLevel: 5,
      levels: FACILITY_DEFINITIONS.admin.levels,
      isUpgrading: false,
    },
    scouting: {
      type: "scouting",
      name: FACILITY_DEFINITIONS.scouting.name,
      currentLevel: 2,
      maxLevel: 5,
      levels: FACILITY_DEFINITIONS.scouting.levels,
      isUpgrading: false,
    },
    commercial: {
      type: "commercial",
      name: FACILITY_DEFINITIONS.commercial.name,
      currentLevel: 2,
      maxLevel: 5,
      levels: FACILITY_DEFINITIONS.commercial.levels,
      isUpgrading: false,
    },
  };

  const totalAnnualMaintenanceCr = Number(Object.values(facilities).reduce((sum, f) => {
    const activeLevel = f.levels.find((l) => l.level === f.currentLevel);
    return sum + (activeLevel?.annualMaintenanceCr ?? 1.0);
  }, 0).toFixed(2));

  // 8. Broadcast
  const broadcast: BroadcastIncomeState = {
    centralPoolShareCr: 440.0,
    tvViewershipBonusCr: Number((12.0 * (sponsorPreset.brandPrestige / 100)).toFixed(2)),
    overseasRightsShareCr: 18.5,
    competitionPrizeMoneyCr: 0,
    currentProjectedPrizeCr: 12.5,
    totalBroadcastIncomeCr: Number((440.0 + 12.0 * (sponsorPreset.brandPrestige / 100) + 18.5).toFixed(2)),
  };

  // 9. Operating Costs
  const squadSalariesCr = squadPlayers && squadPlayers.length > 0
    ? Number((squadPlayers.reduce((sum, p) => sum + (p.basePrice ?? 50), 0) / 100).toFixed(2))
    : 104.5;

  const operatingCosts: OperatingCostsState = {
    squadSalariesCr: Math.max(85.0, squadSalariesCr),
    coachingStaffSalariesCr: 16.5,
    travelAndHotelsCr: 14.2,
    stadiumAndTurfUpkeepCr: 11.8,
    administrativeCorporateCr: 12.4,
    totalOperatingCostsCr: Number((Math.max(85.0, squadSalariesCr) + 16.5 + 14.2 + 11.8 + 12.4).toFixed(2)),
  };

  // 10. Finance & Transactions
  const totalIncome = Number((
    broadcast.totalBroadcastIncomeCr
    + totalAnnualSponsorshipCr
    + seasonTickets.totalRevenueCr
    + initialTicketingProjection.gateReceiptsSeasonTotalCr
    + totalHospitalityRevenueCr
    + totalMerchRevenueCr
  ).toFixed(2));

  const totalExpenditure = Number((
    operatingCosts.totalOperatingCostsCr
    + matchdayOps.seasonalOperationalSpendCr
    + totalMerchCostCr
    + campaigns.reduce((sum, c) => sum + c.budgetCr, 0)
    + totalAnnualMaintenanceCr
  ).toFixed(2));

  const startingCash = 78.5;
  const netProfit = Number((totalIncome - totalExpenditure).toFixed(2));

  const ledger: LedgerTransaction[] = [
    { id: "tx-1", date: `${season}-02-15`, type: "credit", category: "broadcast", description: "BCCI Media Rights Central Distribution - Tranche 1", amountCr: 220.0 },
    { id: "tx-2", date: `${season}-02-28`, type: "credit", category: "sponsorship", description: `${sponsorPreset.frontSponsor} Principal Shirt Sponsorship Initial Fee`, amountCr: sponsorPreset.frontVal / 2 },
    { id: "tx-3", date: `${season}-03-05`, type: "credit", category: "ticketing", description: "Season Ticket Corporate & Public Renewal Proceeds", amountCr: seasonTickets.totalRevenueCr },
    { id: "tx-4", date: `${season}-03-10`, type: "debit", category: "payroll", description: "Squad Player Contracts - Advance Signing Installment", amountCr: 35.0 },
    { id: "tx-5", date: `${season}-03-15`, type: "debit", category: "operations", description: "Charter Flights & Five-Star Hotel Pre-Bookings Across India", amountCr: 8.5 },
    { id: "tx-6", date: `${season}-03-20`, type: "credit", category: "hospitality", description: "Corporate Luxury Boxes Full Season Leases", amountCr: totalHospitalityRevenueCr * 0.7 },
  ];

  const finance: FinanceDashboardState = {
    startingCashBalanceCr: startingCash,
    currentCashBalanceCr: Number((startingCash + 185.2).toFixed(2)),
    projectedEndSeasonCashCr: Number((startingCash + netProfit).toFixed(2)),
    totalIncomeCr: totalIncome,
    totalExpenditureCr: totalExpenditure,
    netOperatingProfitCr: netProfit,
    profitMarginPercent: Number(((netProfit / Math.max(1, totalIncome)) * 100).toFixed(1)),
    transactions: ledger,
  };

  return {
    teamId,
    season,
    ticketing: {
      tiers: ticketingTiers,
      seasonTickets,
      matchCategories,
      gateReceiptsSeasonTotalCr: initialTicketingProjection.gateReceiptsSeasonTotalCr,
    },
    matchdayOps,
    hospitality: {
      boxes,
      lounges,
      premiumPackages,
      totalHospitalityRevenueCr,
      vipRetentionRatePercent: 91,
    },
    sponsorships: {
      deals,
      totalAnnualSponsorshipCr,
      reputationMultiplier: sponsorPreset.brandPrestige / 80,
    },
    merchandising: {
      catalog,
      ecommerceSharePercent: 58,
      totalMerchRevenueCr,
      totalMerchCostCr,
      grossMerchProfitCr,
    },
    marketing: {
      campaigns,
      promotions,
      annualMarketingBudgetCr: Number(campaigns.reduce((sum, c) => sum + c.budgetCr, 0).toFixed(2)),
      brandEquityScore: sponsorPreset.brandPrestige,
      globalFollowersMillions: Number((sponsorPreset.brandPrestige * 0.38).toFixed(1)),
    },
    facilities: {
      facilities,
      totalAnnualMaintenanceCr,
    },
    broadcast,
    operatingCosts,
    finance,
  };
}

// ============================================================================
// STORAGE & LOCALSTORAGE SYNC
// ============================================================================

export function getCommercialStorageKey(teamId: string, season: number): string {
  return `ipl_commercial_state_${teamId.toLowerCase()}_${season}`;
}

function mergeCommercialStateDefaults<T>(defaults: T, saved: unknown): T {
  if (Array.isArray(defaults)) {
    return (Array.isArray(saved) ? saved : defaults) as T;
  }

  if (defaults !== null && typeof defaults === "object") {
    const savedObject = saved !== null && typeof saved === "object" && !Array.isArray(saved)
      ? saved as Record<string, unknown>
      : {};
    const merged: Record<string, unknown> = { ...savedObject };

    for (const [key, defaultValue] of Object.entries(defaults as Record<string, unknown>)) {
      merged[key] = mergeCommercialStateDefaults(defaultValue, savedObject[key]);
    }

    return merged as T;
  }

  return (saved === undefined || saved === null ? defaults : saved) as T;
}

export function loadCommercialState(
  teamId: string,
  season: number,
  customCapacity?: number,
  squadPlayers?: Player[],
): CommercialState {
  if (typeof window === "undefined") {
    return createDefaultCommercialState(teamId, season, customCapacity, squadPlayers);
  }

  try {
    const raw = localStorage.getItem(getCommercialStorageKey(teamId, season));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CommercialState>;
      if (parsed.teamId === teamId && parsed.season === season && parsed.ticketing && parsed.facilities) {
        const defaults = createDefaultCommercialState(teamId, season, customCapacity, squadPlayers);
        const hydrated = mergeCommercialStateDefaults(defaults, parsed);
        localStorage.setItem(getCommercialStorageKey(teamId, season), JSON.stringify(hydrated));
        return hydrated;
      }
    }
  } catch (error) {
    console.error("Failed to parse commercial state from storage, resetting to default:", error);
  }

  const defaultState = createDefaultCommercialState(teamId, season, customCapacity, squadPlayers);
  try {
    localStorage.setItem(getCommercialStorageKey(teamId, season), JSON.stringify(defaultState));
  } catch (e) {
    // quota exceeded or private mode
  }
  return defaultState;
}

export function saveCommercialState(state: CommercialState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getCommercialStorageKey(state.teamId, state.season), JSON.stringify(state));
  } catch (error) {
    console.error("Unable to persist commercial state:", error);
  }
}
