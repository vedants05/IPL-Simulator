export type Nationality = "Indian" | "Overseas";
export type Role = "Batsman" | "WK-Batsman" | "All-Rounder" | "Pace Bowler" | "Spin Bowler";
export type BattingStyle = "Right-hand" | "Left-hand";
export type BowlingType = "Spinner" | "Pacer";
export type Potential = "Established" | "Promising" | "World Class" | "Wonderkid";
export type AuctionType = "mini" | "mega";
export type AuctionPhase = "pre-auction" | "retention" | "live" | "completed";
export type AIPersonality = "Conservative" | "Aggressive" | "Balanced";
export type FanBase = "Small" | "Medium" | "Large" | "Massive";

export interface BattingStats {
  matches: number;
  innings: number;
  runs: number;
  average: number;
  strikeRate: number;
  fifties: number;
  hundreds: number;
  /** Persisted denominators used to keep simulated-career rates exact. */
  balls?: number;
  dismissals?: number;
}

export interface BowlingStats {
  matches: number;
  wickets: number;
  economy: number;
  average: number;
  bestFigures: string;
  /** Persisted denominators used to keep simulated-career rates exact. */
  balls?: number;
  runsConceded?: number;
}

export interface CareerStats {
  batting: BattingStats;
  bowling: BowlingStats;
}

export interface IPLStats {
  matches: number;
  runs: number;
  battingAverage: number;
  strikeRate: number;
  bowlingInnings: number;
  bowlingAverage: number;
  wickets: number;
  /** Persisted denominators used to keep simulated-career rates exact. */
  battingBalls?: number;
  battingDismissals?: number;
  bowlingBalls?: number;
  bowlingRunsConceded?: number;
}

export interface IPLHistoryEntry {
  teamId: string;
  season: string;
  price: number;
  isRtm?: boolean;
  tradedFromTeamId?: string;
  tradedToTeamId?: string;
  tradeId?: string;
  /** Signed from the season's unsold pool after a season-ending injury. */
  isInjuryReplacement?: boolean;
  replacedPlayerId?: string;
  replacementInjuryId?: string;
  /** Compact season output retained for player profiles after fixtures roll over. */
  seasonStats?: {
    matches: number;
    runs: number;
    balls: number;
    wickets: number;
    runsConceded: number;
    oversBowled: number;
  };
}

export interface PlayerCareerRatingHistoryEntry {
  season: number;
  batting: number;
  bowling: number;
  potentialBatting: number;
  potentialBowling: number;
  captaincy?: number;
  reputation?: number;
}

export interface PlayerCareerState {
  origin: "database" | "generated";
  generatedSeason?: number;
  unsoldAuctionStreak: number;
  belowAuctionStandardSeasons: number;
  lastRetirementEvaluationSeason?: number;
  consecutiveLowUsageSeasons: number;
  lastDevelopmentSeason?: number;
  lastAgedSeason?: number;
  initialPotentialBatting: number;
  initialPotentialBowling: number;
  battingDevelopmentBank: number;
  bowlingDevelopmentBank: number;
  potentialBattingBank: number;
  potentialBowlingBank: number;
  captaincyDevelopmentBank: number;
  reputationDevelopmentBank: number;
  unrealizedPotentialBattingLoss: number;
  unrealizedPotentialBowlingLoss: number;
  consecutivePoorBattingSeasons?: number;
  consecutivePoorBowlingSeasons?: number;
  consecutivePoorReputationSeasons: number;
  eliteReputationSeasons: number;
  majorReputationAchievements: number;
  lastSeasonMatches: number;
  lastSeasonRuns: number;
  lastSeasonWickets: number;
  lastSeasonMatchesCaptained: number;
  lastSeasonMatchesViceCaptained: number;
  lastSeasonReputationPoints: number;
  ratingHistory: PlayerCareerRatingHistoryEntry[];
}

export interface Player {
  id: string;
  name: string;
  age: number;
  nationality: Nationality;
  /** Specific cricket nation. `nationality` remains the IPL Indian/overseas eligibility flag. */
  country?: string;
  role: Role;
  battingStyle: BattingStyle;
  bowlingStyle: BowlingType | null;
  bowlingHand: "Right-hand" | "Left-hand" | null;
  careerStats: CareerStats;
  iplStats: IPLStats;
  iplHistory: IPLHistoryEntry[];
  basePrice: number;
  isCapped: boolean;
  /** First season in which this player became internationally capped in the career save. */
  internationalDebutSeason?: number;
  /** Nation represented when the player first became capped. */
  internationalDebutCountry?: string;
  isRetained: boolean;
  retainedByTeamId: string | null;
  currentTeamId: string | null;
  /** Most recent completed-season trade, used to protect an incoming player at the immediately following mini auction. */
  lastTradedSeason?: number;
  lastTradedToTeamId?: string;
  potential: Potential;
  currentBatting: number;
  potentialBatting: number;
  currentBowling: number;
  potentialBowling: number;
  /** Percentile-normalized auction values. Career rules always use the raw ratings above. */
  auctionRating?: number;
  auctionBattingRating?: number;
  auctionBowlingRating?: number;
  auctionPotentialRating?: number;
  careerState?: PlayerCareerState;
  reputation?: number;
  captaincy?: number;
  isIplCaptaincyUnavailable?: boolean;
  iplCaptaincyUninterestedThroughSeason?: number;
  /** Absolute mini-auction release override; defeats every retention protection. */
  setForRelease?: boolean;
  battingAggression?: number;
  isWicketkeeper?: boolean;
  isPartTimeWk?: boolean;
  isOpener?: boolean;
  isFinisher?: boolean;
  isCoreBatter?: boolean;
  hasBattedAt3?: boolean;
  hasBattedAt4?: boolean;
  hasBattedAt5?: boolean;
  hasBattedAt6?: boolean;
  hasBattedAt7?: boolean;
  onlyOpensOrBenched?: boolean;
}

// Segment focus — from teamLogic.csv: how strongly a franchise targets each
// nationality × role segment (all fields 0–100, ~30 = avoids, ~95 = obsessed)
export interface SegmentFocus {
  overseasPacers: number;
  indianPacers: number;
  overseasSpinners: number;
  indianSpinners: number;
  overseasAllRounders: number;
  indianAllRounders: number;
  overseasBatters: number;
  indianBatters: number;
}

// Franchise auction DNA — controls AI bidding behaviour (all fields 0–100)
export interface FranchiseDNA {
  loyalty: number;             // tendency to target ex-players
  prefYoungsters: number;      // preference for young high-potential players
  experienceFocus: number;     // preference for capped/experienced veterans
  bigNamesPref: number;        // preference for elite star-rated players
  looksForDepth: number;       // willingness to buy depth beyond starting XI
  alrValue: number;            // how highly all-rounders are valued
  batValue: number;            // how highly batters/WK-batters are valued
  bowlValue: number;           // how highly bowlers are valued
  commitmentToTargets: number; // how far a team pushes beyond their base valuation
  segmentFocus?: SegmentFocus; // nationality × role targeting (teamLogic.csv)
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  textColor?: string;
  homeGround: string;
  city: string;
  totalPurse: number;
  spentAmount: number;
  remainingPurse: number;
  squad: string[];
  retainedPlayers: string[];
  captainContinuityId?: string | null;
  viceCaptainContinuityId?: string | null;
  rtmCardsUsed: number;
  rtmCardsTotal: number;
  maxSquadSize: number;
  minSquadSize: number;
  softSquadTarget?: number; // hidden AI planning target; not a hard squad rule
  overseasPlayersCurrent: number;
  overseasPlayersMax: number;
  fanBase: FanBase;
  prestige: number;
  aiPersonality: AIPersonality;
  dna: FranchiseDNA;
}

export interface BidEntry {
  teamId: string;
  amount: number;
  timestamp: number;
}

export interface AuctionSet {
  id: string;
  name: string;
  playerIds: string[];
  currentIndex: number;
  isCompleted: boolean;
}

// RTM flow — set whenever user interaction is required (AI-vs-AI resolves silently)
export interface RtmFlow {
  phase: "offer" | "winner_counter" | "original_match";
  originalTeamId: string;   // team with RTM right
  winnerTeamId: string;     // team that won the initial bid
  baseAmount: number;       // hammer price
  raisedAmount: number;     // counter bid (non-zero from winner_counter phase onwards)
  timerSeconds: number;
}

export interface AuctionState {
  type: AuctionType;
  season: number;
  phase: AuctionPhase;
  allPlayerIds: string[];
  soldPlayerIds: string[];
  unsoldPlayerIds: string[];
  currentLotIndex: number;
  currentPlayer: Player | null;
  currentBid: number;
  currentHighBidderTeamId: string | null;
  biddingHistory: BidEntry[];
  timerSeconds: number;
  sets: AuctionSet[];
  currentSetIndex: number;
  teamPurses: Record<string, { remaining: number; squadCount: number }>;
  isAcceleratedPhase: boolean;
  acceleratedPass?: number;
  rtm: RtmFlow | null;
  soldFlash: { playerId: string; teamId: string; amount: number } | null;
  unsoldFlash: { playerId: string } | null;
  saleHistory: Array<{ playerId: string; teamId: string; price: number; lot: number; bids: BidEntry[] }>;
}

export type TradeWillingness = "available" | "open" | "reluctant" | "highly-reluctant";

export interface TradeRecord {
  id: string;
  season: number;
  date: string;
  fromTeamId: string;
  toTeamId: string;
  outgoingPlayerIds: string[];
  incomingPlayerIds: string[];
  salaries: Record<string, number>;
  explanation?: string;
}

export interface TradeOffer {
  id: string;
  season: number;
  date: string;
  proposerTeamId: string;
  recipientTeamId: string;
  offeredPlayerIds: string[];
  requestedPlayerIds: string[];
  status: "pending" | "accepted" | "rejected" | "countered" | "expired";
  explanation?: string;
  counterOfferIds?: string[];
}

export interface SkipSetResultItem {
  player: Player;
  status: "sold" | "unsold";
  teamId?: string;
  price?: number;
  usedRtm?: boolean;
  targetMissReason?: string;
  targetRemainsActive?: boolean;
}

export interface SkipSetSummary {
  setIndex: number;
  setName: string;
  results: SkipSetResultItem[];
}

export type AuctionTargetPriority = "high" | "medium" | "low";

export interface GameState {
  saveId: string;
  saveCreatedAt: string;
  fixtureSeed: string;
  currentDate: string;
  currentSeason: number;
  auctionCycle: number;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  userTeamId: string;
  auction: AuctionState | null;
  isSetupComplete: boolean;
}
