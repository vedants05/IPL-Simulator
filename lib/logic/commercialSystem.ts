import { getHomeStadium, type IplTeamId } from "@/lib/data/pitchCurator";
import { getClubOwnership } from "@/lib/data/clubOwnership";
import type { Team, Player } from "@/lib/types";
import { type InjurySystemModifiers, DEFAULT_INJURY_SYSTEM_MODIFIERS } from "@/lib/logic/injuries";

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
  /** Forecast for the full home schedule. Kept separate from receipts already earned. */
  projectedGateReceiptsCr?: number;
  actualGateReceiptsCr?: number;
  settledMatchIds?: string[];
}

export interface SupporterCommercialContext {
  overallHappiness?: number;
  supporterHappiness?: number;
  homeAtmosphere?: number;
  squadApproval?: number;
  topPlayerApproval?: number;
  topPlayerName?: string;
  mood?: string;
}

export interface TicketingProjection {
  regularMatchdaySeats: number;
  weightedBasePriceInr: number;
  projectedOccupancyPercent: number;
  averageGatePerHomeMatchCr: number;
  gateReceiptsSeasonTotalCr: number;
  totalTicketingRevenueCr: number;
  supporterDemandModifierPercent?: number;
}

/**
 * Single generation/UI projection boundary for ticketing. Integrates supporter
 * sentiment, player popularity, and venue capacity into realistic demand elasticity.
 */
export function calculateTicketingProjection(
  ticketing: Pick<TicketingState, "tiers" | "seasonTickets" | "matchCategories">,
  stadiumCapacity: number,
  homeMatchesOrContext?: number | SupporterCommercialContext,
  supporterImpactArg?: SupporterCommercialContext,
): TicketingProjection {
  const homeMatches = typeof homeMatchesOrContext === "number" ? homeMatchesOrContext : 7;
  const supporterImpact = typeof homeMatchesOrContext === "object" ? homeMatchesOrContext : supporterImpactArg;
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

  // Supporter happiness & squad/player morale influence on ticket willingness-to-pay
  const happiness = supporterImpact?.overallHappiness ?? supporterImpact?.supporterHappiness ?? 65;
  const squadApproval = supporterImpact?.squadApproval ?? 65;
  const starApproval = supporterImpact?.topPlayerApproval ?? 65;
  const atmosphere = supporterImpact?.homeAtmosphere ?? 60;

  const happinessEffect = ((happiness - 65) / 100) * 0.14;
  const squadEffect = ((squadApproval - 65) / 100) * 0.08;
  const starEffect = ((starApproval - 65) / 100) * 0.06;
  const atmosphereEffect = ((atmosphere - 65) / 100) * 0.05;
  const supporterTotalEffect = happinessEffect + squadEffect + starEffect + atmosphereEffect;

  const occupancy = Math.max(0.55, Math.min(0.99, 0.84 + categoryDemandBonus / 100 * 0.32 + priceEffect + supporterTotalEffect));
  const averageGatePerHomeMatchCr = regularMatchdaySeats * weightedBasePriceInr * categoryPriceMultiplier * occupancy / 10_000_000;
  const gateReceiptsSeasonTotalCr = averageGatePerHomeMatchCr * Math.max(0, homeMatches);
  return {
    regularMatchdaySeats,
    weightedBasePriceInr: Math.round(weightedBasePriceInr),
    projectedOccupancyPercent: Number((occupancy * 100).toFixed(1)),
    averageGatePerHomeMatchCr: Number(averageGatePerHomeMatchCr.toFixed(2)),
    gateReceiptsSeasonTotalCr: Number(gateReceiptsSeasonTotalCr.toFixed(2)),
    totalTicketingRevenueCr: Number((gateReceiptsSeasonTotalCr + ticketing.seasonTickets.totalRevenueCr).toFixed(2)),
    supporterDemandModifierPercent: Number((supporterTotalEffect * 100).toFixed(1)),
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
// 7. HIGH-PERFORMANCE, SCOUTING & CLUB OPERATIONS
// ============================================================================

export type OperationCategory = "sports_science" | "scouting_network" | "prep_camps" | "logistics_travel";

export interface OperationTierOption {
  id: string;
  name: string;
  providerOrPartner: string;
  annualCostCr: number;
  setupCostCr: number;
  benefits: string[];
  impactSummary: string;
  reputationRequired: number; // minimum club brand prestige
}

export interface ClubOperationProgramme {
  category: OperationCategory;
  name: string;
  activeTierId: string;
  tierOptions: OperationTierOption[];
}

export interface OperationsState {
  programmes: Record<OperationCategory, ClubOperationProgramme>;
  totalAnnualOperatingInvestmentCr: number;
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
  operations: OperationsState;
  broadcast: BroadcastIncomeState;
  operatingCosts: OperatingCostsState;
  finance: FinanceDashboardState;
}

// ============================================================================
// HIGH-PERFORMANCE & OPERATIONAL PROGRAMME DEFINITIONS
// Realistic franchise partnerships and operational tiers
// ============================================================================

export const OPERATION_PROGRAMME_DEFINITIONS: Record<
  OperationCategory,
  { name: string; tierOptions: OperationTierOption[] }
> = {
  sports_science: {
    name: "Sports Science, Medical & Recovery Network",
    tierOptions: [
      {
        id: "clinic_basic",
        name: "Standard Medical & Physio Retainer",
        providerOrPartner: "Local Municipal Sports Clinic",
        annualCostCr: 1.2,
        setupCostCr: 0,
        benefits: [
          "BCCI standard injury triage & first-aid",
          "Standard recovery timelines across squad",
          "Local physiotherapy consulting during match weeks",
        ],
        impactSummary: "Baseline care for minor strains; standard rehabilitation times.",
        reputationRequired: 0,
      },
      {
        id: "institute_partnership",
        name: "Super-Specialty Orthopaedic Partnership",
        providerOrPartner: "Apollo / Kokilaben Sports Medicine Network",
        annualCostCr: 3.5,
        setupCostCr: 1.5,
        benefits: [
          "15% faster recovery from soft-tissue and groin strains",
          "Dedicated squad biomechanist and cryotherapy access",
          "Continuous biometric load monitoring and early stress detection",
        ],
        impactSummary: "Significantly cuts down minor injury durations and detects fatigue early.",
        reputationRequired: 65,
      },
      {
        id: "global_high_performance",
        name: "Elite Global Sports Science Consortium",
        providerOrPartner: "Red Bull Athlete Performance Center & London Orthopaedic",
        annualCostCr: 7.8,
        setupCostCr: 3.2,
        benefits: [
          "28% faster recovery times across all injury categories",
          "Maximum protection against bowler stress fractures and tendon tears",
          "Immediate air-evacuation & consultation with world-leading specialists",
          "Customized circadian sleep & post-match recovery pods",
        ],
        impactSummary: "World-class care ensuring premier pace bowlers and key batters stay match-ready.",
        reputationRequired: 80,
      },
    ],
  },
  scouting_network: {
    name: "Domestic & Global Talent Identification",
    tierOptions: [
      {
        id: "regional_domestic",
        name: "Regional State Trophy Scouts",
        providerOrPartner: "Zonal BCCI Talent Scouts",
        annualCostCr: 0.8,
        setupCostCr: 0,
        benefits: [
          "Ranji Trophy and Syed Mushtaq Ali Trophy coverage",
          "Standard scouting reports on prominent domestic prospects",
        ],
        impactSummary: "Covers mainstream domestic cricket and standard auction names.",
        reputationRequired: 0,
      },
      {
        id: "national_analytics",
        name: "Nationwide Video & Ball-Tracking Analytics Bureau",
        providerOrPartner: "CricViz & Specialized Video Scouting Bureau",
        annualCostCr: 2.8,
        setupCostCr: 1.0,
        benefits: [
          "Accurate ratings and release of hidden potential bands for all domestic players",
          "Pinpoints clutch temperament and strike rate vs high pace/spin",
          "Discovers high-ceiling uncapped domestic talents before the auction",
        ],
        impactSummary: "Uncovers undervalued domestic talents and clarifies true skill potential.",
        reputationRequired: 65,
      },
      {
        id: "global_academy_network",
        name: "Global Franchise Scouting & Emerging Leagues Network",
        providerOrPartner: "Worldwide Talent Bureau (Caribbean, SA20, BBL & Associate)",
        annualCostCr: 5.5,
        setupCostCr: 2.0,
        benefits: [
          "Year-round observation across CPL, SA20, BBL, PSL, and global T20s",
          "Instant scouting access to elite international overseas breakout stars",
          "Exclusive data on hidden overseas spinners and 145kph+ raw pace talents",
        ],
        impactSummary: "Ensures franchise dominates mini-auctions with proprietary overseas intelligence.",
        reputationRequired: 80,
      },
    ],
  },
  prep_camps: {
    name: "Pre-Season Conditioning & Tactical Camps",
    tierOptions: [
      {
        id: "camp_local",
        name: "Local Pre-Tournament Camp (7 Days)",
        providerOrPartner: "Home Franchise Stadium Facilities",
        annualCostCr: 0.9,
        setupCostCr: 0,
        benefits: [
          "Brief 1-week warm-up squad assembling before tournament opener",
          "Standard match simulation against local state bowlers",
        ],
        impactSummary: "Standard pre-season routine; players find form gradually in opening games.",
        reputationRequired: 0,
      },
      {
        id: "camp_specialized",
        name: "Dedicated High-Performance Centre Camp (14 Days)",
        providerOrPartner: "Alur / Centre of Excellence Intensive Camp",
        annualCostCr: 2.6,
        setupCostCr: 0.8,
        benefits: [
          "Intensive 2-week match-situation scenarios and scenario simulation",
          "+5% opening fixture team synergy & sharp match fitness",
          "Personalized batting aggression and death-overs execution drills",
        ],
        impactSummary: "Squad hits the ground running with sharp fielding and tactical clarity from match 1.",
        reputationRequired: 65,
      },
      {
        id: "camp_overseas_tour",
        name: "International Warm-Up & High-Altitude Conditioning (21 Days)",
        providerOrPartner: "Dubai ICC Academy / UK Summer Base",
        annualCostCr: 6.2,
        setupCostCr: 2.5,
        benefits: [
          "3-week elite training under varied pitch and climate conditions",
          "+10% squad confidence and maximum tactical cohesion",
          "Full squad cohesion bonding, leadership seminars, and match scenarios",
        ],
        impactSummary: "Peak athletic conditioning that carries the team deep into playoff pressure moments.",
        reputationRequired: 80,
      },
    ],
  },
  logistics_travel: {
    name: "Franchise Transit, Hotel & Matchday Logistics",
    tierOptions: [
      {
        id: "travel_commercial",
        name: "Commercial Domestic Aviation & 5-Star Group Bookings",
        providerOrPartner: "Commercial Scheduled Airlines",
        annualCostCr: 6.5,
        setupCostCr: 0,
        benefits: [
          "Premium airline group bookings between tournament venues",
          "5-star hotel accommodations with private squad dining halls",
        ],
        impactSummary: "Standard IPL logistical arrangements with typical airport transit fatigue.",
        reputationRequired: 0,
      },
      {
        id: "travel_private_charter",
        name: "Dedicated Private Jet Charters & Luxury Team Motorcoaches",
        providerOrPartner: "Private Aviation Charter Fleet",
        annualCostCr: 12.5,
        setupCostCr: 1.5,
        benefits: [
          "Direct charter flights between city matches without commercial airport transit delays",
          "Luxury custom air-conditioned sleeper coaches for city transfers",
          "Significantly reduces travel fatigue and preserves bowler recovery between back-to-back games",
        ],
        impactSummary: "Minimizes travel fatigue during brutal 3-games-in-5-days road trips.",
        reputationRequired: 70,
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

  // 7. Operations & High-Performance Programmes
  const initialTierSelection: Record<OperationCategory, string> = {
    sports_science: sponsorPreset.brandPrestige >= 85 ? "institute_partnership" : "clinic_basic",
    scouting_network: sponsorPreset.brandPrestige >= 85 ? "national_analytics" : "regional_domestic",
    prep_camps: sponsorPreset.brandPrestige >= 85 ? "camp_specialized" : "camp_local",
    logistics_travel: sponsorPreset.brandPrestige >= 85 ? "travel_private_charter" : "travel_commercial",
  };

  const programmes: Record<OperationCategory, ClubOperationProgramme> = {
    sports_science: {
      category: "sports_science",
      name: OPERATION_PROGRAMME_DEFINITIONS.sports_science.name,
      activeTierId: initialTierSelection.sports_science,
      tierOptions: OPERATION_PROGRAMME_DEFINITIONS.sports_science.tierOptions,
    },
    scouting_network: {
      category: "scouting_network",
      name: OPERATION_PROGRAMME_DEFINITIONS.scouting_network.name,
      activeTierId: initialTierSelection.scouting_network,
      tierOptions: OPERATION_PROGRAMME_DEFINITIONS.scouting_network.tierOptions,
    },
    prep_camps: {
      category: "prep_camps",
      name: OPERATION_PROGRAMME_DEFINITIONS.prep_camps.name,
      activeTierId: initialTierSelection.prep_camps,
      tierOptions: OPERATION_PROGRAMME_DEFINITIONS.prep_camps.tierOptions,
    },
    logistics_travel: {
      category: "logistics_travel",
      name: OPERATION_PROGRAMME_DEFINITIONS.logistics_travel.name,
      activeTierId: initialTierSelection.logistics_travel,
      tierOptions: OPERATION_PROGRAMME_DEFINITIONS.logistics_travel.tierOptions,
    },
  };

  const totalAnnualOperatingInvestmentCr = Number(
    Object.values(programmes).reduce((sum, p) => {
      const active = p.tierOptions.find((t) => t.id === p.activeTierId);
      return sum + (active?.annualCostCr ?? 1.0);
    }, 0).toFixed(2)
  );

  const operations: OperationsState = {
    programmes,
    totalAnnualOperatingInvestmentCr,
  };

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
    + totalAnnualOperatingInvestmentCr
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
      projectedGateReceiptsCr: initialTicketingProjection.gateReceiptsSeasonTotalCr,
      actualGateReceiptsCr: 0,
      settledMatchIds: [],
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
    operations,
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
      if (parsed.teamId === teamId && parsed.season === season && parsed.ticketing && (parsed.operations || (parsed as any).facilities)) {
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

export function syncCommercialFinance(state: CommercialState): CommercialState {
  const { broadcast, sponsorships, ticketing, hospitality, merchandising, operatingCosts, matchdayOps, marketing, operations, finance } = state;

  const totalGateAndSeasonCr = Number(
    (ticketing.seasonTickets.totalRevenueCr + (ticketing.projectedGateReceiptsCr ?? ticketing.gateReceiptsSeasonTotalCr)).toFixed(2)
  );

  const totalIncomeCr = Number(
    (
      broadcast.totalBroadcastIncomeCr +
      sponsorships.totalAnnualSponsorshipCr +
      totalGateAndSeasonCr +
      hospitality.totalHospitalityRevenueCr +
      merchandising.totalMerchRevenueCr
    ).toFixed(2)
  );

  const operationsOtherCr = Number(
    (
      operatingCosts.coachingStaffSalariesCr +
      operatingCosts.travelAndHotelsCr +
      operatingCosts.administrativeCorporateCr +
      operatingCosts.stadiumAndTurfUpkeepCr
    ).toFixed(2)
  );

  const totalExpenditureCr = Number(
    (
      operatingCosts.squadSalariesCr +
      operationsOtherCr +
      matchdayOps.seasonalOperationalSpendCr +
      merchandising.totalMerchCostCr +
      marketing.annualMarketingBudgetCr +
      operations.totalAnnualOperatingInvestmentCr
    ).toFixed(2)
  );

  const netOperatingProfitCr = Number((totalIncomeCr - totalExpenditureCr).toFixed(2));
  const profitMarginPercent = Number(((netOperatingProfitCr / Math.max(1, totalIncomeCr)) * 100).toFixed(1));
  const projectedEndSeasonCashCr = Number((finance.startingCashBalanceCr + netOperatingProfitCr).toFixed(2));

  return {
    ...state,
    finance: {
      ...finance,
      totalIncomeCr,
      totalExpenditureCr,
      netOperatingProfitCr,
      profitMarginPercent,
      projectedEndSeasonCashCr,
    },
  };
}

export function saveCommercialState(state: CommercialState): void {
  if (typeof window === "undefined") return;
  try {
    const synchronized = syncCommercialFinance(state);
    localStorage.setItem(getCommercialStorageKey(synchronized.teamId, synchronized.season), JSON.stringify(synchronized));
  } catch (error) {
    console.error("Unable to persist commercial state:", error);
  }
}

/** Posts a real cash movement and its matching audit entry as one atomic update. */
export function postCommercialTransaction(
  state: CommercialState,
  transaction: LedgerTransaction,
): CommercialState {
  if (state.finance.transactions.some((entry) => entry.id === transaction.id)) return state;
  const cashDelta = transaction.type === "credit" ? transaction.amountCr : -transaction.amountCr;
  return syncCommercialFinance({
    ...state,
    finance: {
      ...state.finance,
      currentCashBalanceCr: Number((state.finance.currentCashBalanceCr + cashDelta).toFixed(2)),
      transactions: [transaction, ...state.finance.transactions],
    },
  });
}

export interface MatchdaySettlementResult {
  gateReceiptCr: number;
  hospitalityTakeCr: number;
  matchdayCostCr: number;
  netMatchdayCashCr: number;
  attendance: number;
  occupancyPercent: number;
}

/**
 * Settles dynamic gate receipts, F&B concessions, and matchday operations expenses
 * when a user's home match is completed. Credits the cash ledger and updates season metrics.
 */
export function processHomeMatchCommercialSettlement(
  teamId: string,
  season: number,
  matchId: string,
  matchDate: string,
  opponentTeamId: string,
  opponentTeamName: string,
  stadiumCapacity: number,
  squadPlayers?: Player[],
  supporterContext?: SupporterCommercialContext,
): MatchdaySettlementResult | null {
  const state = loadCommercialState(teamId, season, stadiumCapacity, squadPlayers);
  if (state.ticketing.settledMatchIds?.includes(matchId)) {
    return null;
  }

  // 1. Determine demand category based on opponent stature
  const marqueeTeams = new Set(["MI", "CSK", "RCB", "KKR"]);
  const tier2Teams = new Set(["RR", "SRH", "DC", "GT"]);
  let category: MatchCategory = "silver";
  const opp = opponentTeamId.toUpperCase();
  if (marqueeTeams.has(opp)) {
    category = "platinum";
  } else if (tier2Teams.has(opp)) {
    category = "gold";
  }

  const catConfig = state.ticketing.matchCategories[category] ?? state.ticketing.matchCategories.gold;
  const regularSeats = Math.max(0, stadiumCapacity - state.ticketing.seasonTickets.allocatedSeats);
  const weightedPrice = state.ticketing.tiers.reduce(
    (sum, tier) => sum + tier.currentPriceInr * tier.capacityShare,
    0
  );

  // Price sensitivity & demand calculation
  const baselineWeighted = Math.max(1, state.ticketing.tiers.reduce((s, t) => s + t.basePriceInr * t.capacityShare, 0));
  const priceRatio = weightedPrice / baselineWeighted;
  const priceElasticity = priceRatio >= 1 ? -(priceRatio - 1) * 0.45 : (1 - priceRatio) * 0.15;

  // Supporter happiness & star player demand influence
  const happiness = supporterContext?.overallHappiness ?? supporterContext?.supporterHappiness ?? 65;
  const squadApproval = supporterContext?.squadApproval ?? 65;
  const starApproval = supporterContext?.topPlayerApproval ?? 65;
  const atmosphere = supporterContext?.homeAtmosphere ?? 65;

  const happinessEffect = ((happiness - 65) / 100) * 0.14;
  const squadEffect = ((squadApproval - 65) / 100) * 0.08;
  const starEffect = ((starApproval - 65) / 100) * 0.06;
  const atmosphereEffect = ((atmosphere - 65) / 100) * 0.05;
  const supporterTotalEffect = happinessEffect + squadEffect + starEffect + atmosphereEffect;

  const occupancy = Math.max(0.55, Math.min(0.99, 0.85 + (catConfig.demandBonus / 100) * 0.3 + priceElasticity + supporterTotalEffect));

  const attendance = Math.round(regularSeats * occupancy + state.ticketing.seasonTickets.soldCount);
  const gateReceiptCr = Number(
    ((regularSeats * weightedPrice * catConfig.priceMultiplier * occupancy) / 10_000_000).toFixed(2)
  );

  // 2. Hospitality & Catering take with fan atmosphere multiplier
  const fnbSpendMultiplier = Math.max(0.85, Math.min(1.25, 0.85 + (happiness / 100) * 0.20 + (atmosphere / 100) * 0.15));
  const avgFnbSpend = Math.round(state.matchdayOps.catering.averageSpendPerFanInr * fnbSpendMultiplier);
  const fnbMargin = state.matchdayOps.catering.franchiseMarginPercent / 100;
  const fnbTakeCr = (attendance * avgFnbSpend * fnbMargin) / 10_000_000;

  const loungesDayPassCr = state.hospitality.lounges.reduce((sum, l) => {
    return sum + (l.capacity * (l.averageOccupancyPercent / 100) * l.dayPassPriceInr) / 10_000_000;
  }, 0);

  const hospitalityTakeCr = Number((fnbTakeCr + loungesDayPassCr).toFixed(2));

  // 3. Matchday Operational Costs
  const matchdayCostCr = Number(state.matchdayOps.totalCostPerMatchCr.toFixed(2));

  // 4. Net Cash
  const netMatchdayCashCr = Number((gateReceiptCr + hospitalityTakeCr - matchdayCostCr).toFixed(2));

  // 5. Build Ledger Transactions with dynamic supporter atmosphere narrative
  const fanContextNarrative = supporterContext?.topPlayerName && starApproval >= 75
    ? `Star Pull: ${supporterContext.topPlayerName}`
    : happiness >= 75
    ? "Buzzing Atmosphere"
    : happiness <= 45
    ? "Subdued Demand"
    : null;

  const gateDescription = fanContextNarrative
    ? `Home Match vs ${opponentTeamName} - Gate Receipts (${Math.round(occupancy * 100)}% attendance · ${fanContextNarrative})`
    : `Home Match vs ${opponentTeamName} - Gate Receipts (${Math.round(occupancy * 100)}% attendance)`;

  const newTransactions: LedgerTransaction[] = [
    {
      id: `tx-gate-${matchId}`,
      date: matchDate,
      type: "credit",
      category: "ticketing",
      description: gateDescription,
      amountCr: gateReceiptCr,
    },
    {
      id: `tx-hosp-${matchId}`,
      date: matchDate,
      type: "credit",
      category: "hospitality",
      description: `Home Match vs ${opponentTeamName} - Concessions & VIP Lounges Take`,
      amountCr: hospitalityTakeCr,
    },
    {
      id: `tx-ops-${matchId}`,
      date: matchDate,
      type: "debit",
      category: "operations",
      description: `Home Match vs ${opponentTeamName} - Matchday Stewards & Stadium Production`,
      amountCr: matchdayCostCr,
    },
  ];

  const updatedSettledIds = [...(state.ticketing.settledMatchIds ?? []), matchId];
  const currentActual = state.ticketing.actualGateReceiptsCr ?? 0;
  const updatedActual = Number((currentActual + gateReceiptCr).toFixed(2));
  const updatedCash = Number((state.finance.currentCashBalanceCr + netMatchdayCashCr).toFixed(2));

  const nextState: CommercialState = {
    ...state,
    ticketing: {
      ...state.ticketing,
      actualGateReceiptsCr: updatedActual,
      settledMatchIds: updatedSettledIds,
    },
    finance: {
      ...state.finance,
      currentCashBalanceCr: updatedCash,
      transactions: [newTransactions[0], newTransactions[1], newTransactions[2], ...state.finance.transactions],
    },
  };

  saveCommercialState(nextState);

  return {
    gateReceiptCr,
    hospitalityTakeCr,
    matchdayCostCr,
    netMatchdayCashCr,
    attendance,
    occupancyPercent: Math.round(occupancy * 100),
  };
}

/**
 * Releases scheduled BCCI central media pool tranches as league milestones are reached.
 */
export function checkAndReleaseBcciTranches(
  teamId: string,
  season: number,
  playedMatchCount: number,
  matchDate: string,
  stadiumCapacity: number,
  squadPlayers?: Player[],
): void {
  const state = loadCommercialState(teamId, season, stadiumCapacity, squadPlayers);
  const existingTx = state.finance.transactions;

  // Mid-season tranche: after 7 matches played
  if (playedMatchCount >= 7 && !existingTx.some((t) => t.id === `tx-bcci-tranche2-${season}`)) {
    const tranche2AmountCr = 132.0; // 30% of central media pool
    const newTx: LedgerTransaction = {
      id: `tx-bcci-tranche2-${season}`,
      date: matchDate,
      type: "credit",
      category: "broadcast",
      description: "BCCI Media Rights Central Distribution - Tranche 2 (Mid-Season Milestone)",
      amountCr: tranche2AmountCr,
    };
    const nextState: CommercialState = {
      ...state,
      finance: {
        ...state.finance,
        currentCashBalanceCr: Number((state.finance.currentCashBalanceCr + tranche2AmountCr).toFixed(2)),
        transactions: [newTx, ...state.finance.transactions],
      },
    };
    saveCommercialState(nextState);
  }
}

/**
 * Awards post-season BCCI media rights final tranche and official tournament prize purse.
 */
export function processSeasonEndCommercialSettlement(
  teamId: string,
  season: number,
  finishRank: number,
  stadiumCapacity: number,
  squadPlayers?: Player[],
): void {
  const state = loadCommercialState(teamId, season, stadiumCapacity, squadPlayers);
  const existingTx = state.finance.transactions;
  if (existingTx.some((t) => t.id === `tx-bcci-final-tranche-${season}`)) {
    return;
  }

  const finalTrancheCr = 88.0; // 20% of central pool
  const prizeByRank: Record<number, { title: string; prizeCr: number }> = {
    1: { title: "IPL Champions Trophy & Gold Medals Purse", prizeCr: 20.0 },
    2: { title: "IPL Runners-Up Finalists Purse", prizeCr: 12.5 },
    3: { title: "IPL 3rd Place (Qualifier 2) Podium Purse", prizeCr: 7.0 },
    4: { title: "IPL 4th Place (Eliminator) Qualification Purse", prizeCr: 6.5 },
  };

  const prizeInfo = prizeByRank[finishRank] ?? { title: "IPL League Stage Central Pool Share", prizeCr: 0.0 };

  const finalTx: LedgerTransaction[] = [
    {
      id: `tx-bcci-final-tranche-${season}`,
      date: `${season}-05-28`,
      type: "credit",
      category: "broadcast",
      description: "BCCI Media Rights Central Distribution - Final Post-Season Tranche",
      amountCr: finalTrancheCr,
    },
  ];

  if (prizeInfo.prizeCr > 0) {
    finalTx.unshift({
      id: `tx-bcci-prize-${season}`,
      date: `${season}-05-29`,
      type: "credit",
      category: "prize_money",
      description: `BCCI Official Prize: ${prizeInfo.title}`,
      amountCr: prizeInfo.prizeCr,
    });
  }

  const totalAddedCash = finalTrancheCr + prizeInfo.prizeCr;
  const activeCampaigns = state.marketing.campaigns.filter((campaign) => campaign.active);
  const campaignFanGrowthMillions = activeCampaigns.reduce((sum, campaign) => (
    sum + Math.sqrt(Math.max(0, campaign.budgetCr)) * campaign.fanAcquisitionEstimate / Math.max(1, campaign.budgetCr) / 1_000_000
  ), 0);
  const performanceBrandChange = finishRank <= 2 ? 3 : finishRank <= 4 ? 1 : finishRank >= 8 ? -2 : 0;
  const nextDeals = state.sponsorships.deals.map((deal) => ({
    ...deal,
    yearsRemaining: Math.max(0, deal.yearsRemaining - 1),
    satisfactionPercent: Math.max(35, Math.min(100, deal.satisfactionPercent + (finishRank <= 4 ? 3 : finishRank >= 8 ? -4 : 0))),
  }));
  const nextState: CommercialState = {
    ...state,
    broadcast: {
      ...state.broadcast,
      competitionPrizeMoneyCr: prizeInfo.prizeCr,
      totalBroadcastIncomeCr: Number((state.broadcast.totalBroadcastIncomeCr + prizeInfo.prizeCr).toFixed(2)),
    },
    sponsorships: {
      ...state.sponsorships,
      deals: nextDeals,
    },
    marketing: {
      ...state.marketing,
      brandEquityScore: Math.max(0, Math.min(100, state.marketing.brandEquityScore + performanceBrandChange)),
      globalFollowersMillions: Number((state.marketing.globalFollowersMillions + campaignFanGrowthMillions).toFixed(2)),
    },
    finance: {
      ...state.finance,
      currentCashBalanceCr: Number((state.finance.currentCashBalanceCr + totalAddedCash).toFixed(2)),
      transactions: [...finalTx, ...state.finance.transactions],
    },
  };

  saveCommercialState(nextState);
}

/**
 * Returns dynamic injury system modifiers based on the club's active High-Performance Sports Science contract.
 */
export function getInjurySystemModifiersFromCommercial(
  teamId: string,
  season: number,
  stadiumCapacity = 45000,
): InjurySystemModifiers {
  try {
    const state = loadCommercialState(teamId, season, stadiumCapacity);
    const sportsScienceTier = state.operations?.programmes?.sports_science?.activeTierId;
    if (sportsScienceTier === "global_high_performance") {
      return {
        occurrenceChanceMultiplier: 0.60,
        recoveryDurationMultiplier: 0.65,
        worseningChanceMultiplier: 0.45,
      };
    }
    if (sportsScienceTier === "institute_partnership") {
      return {
        occurrenceChanceMultiplier: 0.80,
        recoveryDurationMultiplier: 0.82,
        worseningChanceMultiplier: 0.70,
      };
    }
  } catch (e) {
    // fallback
  }
  return DEFAULT_INJURY_SYSTEM_MODIFIERS;
}
