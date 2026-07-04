import { PLAYERS_SEED } from "../lib/data/players";
import { estimateRetentionWorth } from "../lib/logic/auctionEngine";

// Replicate KKR object
const kkr = {
  id: "KKR",
  name: "Kolkata Knight Riders",
  shortName: "KKR",
  totalPurse: 12000,
  spentAmount: 0,
  remainingPurse: 12000,
  squad: [] as string[],
  retainedPlayers: [] as string[],
  rtmCardsUsed: 0,
  rtmCardsTotal: 6,
  maxSquadSize: 25,
  minSquadSize: 18,
  overseasPlayersCurrent: 0,
  overseasPlayersMax: 8,
  boardObjectives: [],
  fanBase: "Large",
  prestige: 9,
  aiPersonality: "Balanced",
  dna: { 
    loyalty: 83, 
    prefYoungsters: 68, 
    experienceFocus: 55, 
    bigNamesPref: 86, 
    looksForDepth: 80, 
    alrValue: 90, 
    batValue: 75, 
    bowlValue: 75, 
    commitmentToTargets: 75,
    segmentFocus: { 
      overseasPacers: 65, 
      indianPacers: 65, 
      overseasSpinners: 85, 
      indianSpinners: 85, 
      overseasAllRounders: 95, 
      indianAllRounders: 75, 
      overseasBatters: 60, 
      indianBatters: 80 
    } 
  },
  description: "Three-time champions. Retaining Narine & Russell. Strong overseas core, seeking Indian stars.",
};

const ratingOf = (p: any) => Math.max(p.currentBatting || 0, p.currentBowling || 0);
const repOf = (p: any) => p.reputation || 0;
const potentialOf = (p: any) => Math.max(p.potentialBatting || 0, p.potentialBowling || 0);

const miller = PLAYERS_SEED.find(p => p.id === "david-miller")!;
const worth = estimateRetentionWorth(miller, kkr as any);

console.log(`David Miller (Age: ${miller.age}, RTG: ${ratingOf(miller)}, POT: ${potentialOf(miller)})`);
console.log(`Retention Valuation: ${(worth/100).toFixed(2)} Cr`);
