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
}

export interface BoardObjective {
  id: string;
  description: string;
  type: "finish_position" | "player_development" | "revenue";
  target: number;
  isCompleted: boolean;
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
  rtmEligibleTeamId: string | null;
  rtmWindowOpen: boolean;
  rtmTimerSeconds: number;
  soldFlash: { playerId: string; teamId: string; amount: number } | null;
  saleHistory: Array<{ playerId: string; teamId: string; price: number; lot: number; bids: BidEntry[] }>;
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
