export type Nationality = "Indian" | "Overseas";
export type Role = "Batsman" | "WK-Batsman" | "All-Rounder" | "Pace Bowler" | "Spin Bowler";
export type BattingStyle = "Right-hand" | "Left-hand";
export type Potential = "Established" | "Promising" | "World Class" | "Wonderkid";
export type AuctionType = "mini" | "mega";
export type AuctionPhase = "pre-auction" | "retention" | "live" | "completed";
export type AIPersonality = "Conservative" | "Aggressive" | "Balanced";
export type FanBase = "Small" | "Medium" | "Large" | "Massive";

export interface PlayerAttributes {
  technique: number;
  power: number;
  timing: number;
  placement: number;
  running: number;
  pace: number;
  swing: number;
  seam: number;
  spin: number;
  flight: number;
  accuracy: number;
  variation: number;
  catching: number;
  throwing: number;
  agility: number;
  composure: number;
  leadership: number;
  determination: number;
}

export interface BattingStats {
  matches: number;
  innings: number;
  runs: number;
  average: number;
  strikeRate: number;
  fifties: number;
  hundreds: number;
}

export interface BowlingStats {
  matches: number;
  wickets: number;
  economy: number;
  average: number;
  bestFigures: string;
}

export interface CareerStats {
  batting: BattingStats;
  bowling: BowlingStats;
}

export interface IPLHistoryEntry {
  teamId: string;
  season: string;
  price: number;
}

export interface Player {
  id: string;
  name: string;
  age: number;
  nationality: Nationality;
  role: Role;
  battingStyle: BattingStyle;
  bowlingStyle: string | null;
  attributes: PlayerAttributes;
  careerStats: CareerStats;
  iplHistory: IPLHistoryEntry[];
  basePrice: number;
  isCapped: boolean;
  isRetained: boolean;
  retainedByTeamId: string | null;
  currentTeamId: string | null;
  starRating: number;
  potential: Potential;
  currentBatting: number;
  potentialBatting: number;
  currentBowling: number;
  potentialBowling: number;
  reputation?: number;
  captaincy?: number;
  battingAggression?: number;
  isWicketkeeper?: boolean;
  isPartTimeWk?: boolean;
  isOpener?: boolean;
  isFinisher?: boolean;
}

export interface BoardObjective {
  id: string;
  description: string;
  type: "finish_position" | "player_development" | "revenue";
  target: number;
  isCompleted: boolean;
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
  homeGround: string;
  city: string;
  totalPurse: number;
  spentAmount: number;
  remainingPurse: number;
  squad: string[];
  retainedPlayers: string[];
  rtmCardsUsed: number;
  rtmCardsTotal: number;
  maxSquadSize: number;
  minSquadSize: number;
  overseasPlayersCurrent: number;
  overseasPlayersMax: number;
  boardObjectives: BoardObjective[];
  fanBase: FanBase;
  prestige: number;
  aiPersonality: AIPersonality;
  dna: FranchiseDNA;
  description: string;
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
  rtm: RtmFlow | null;
  soldFlash: { playerId: string; teamId: string; amount: number } | null;
  unsoldFlash: { playerId: string } | null;
  saleHistory: Array<{ playerId: string; teamId: string; price: number; lot: number; bids: BidEntry[] }>;
}

export interface SkipSetResultItem {
  player: Player;
  status: "sold" | "unsold";
  teamId?: string;
  price?: number;
  usedRtm?: boolean;
}

export interface SkipSetSummary {
  setIndex: number;
  setName: string;
  results: SkipSetResultItem[];
}

export interface GameState {
  saveId: string;
  saveCreatedAt: string;
  currentDate: string;
  currentSeason: number;
  auctionCycle: number;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  userTeamId: string;
  auction: AuctionState | null;
  isSetupComplete: boolean;
}
