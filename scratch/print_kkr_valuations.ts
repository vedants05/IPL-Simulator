import { PLAYERS_SEED } from "../lib/data/players";
import { estimateRetentionWorth } from "../lib/logic/auctionEngine";

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
    loyalty: 83, prefYoungsters: 68, experienceFocus: 55, bigNamesPref: 86,
    looksForDepth: 80, alrValue: 90, batValue: 75, bowlValue: 75, commitmentToTargets: 75,
    segmentFocus: { overseasPacers: 65, indianPacers: 65, overseasSpinners: 85, indianSpinners: 85, overseasAllRounders: 95, indianAllRounders: 75, overseasBatters: 60, indianBatters: 80 }
  },
};

const ratingOf = (p: any) => Math.max(p.currentBatting || 0, p.currentBowling || 0);
const potentialOf = (p: any) => Math.max(p.potentialBatting || 0, p.potentialBowling || 0);

const kkrPlayers = PLAYERS_SEED.filter(p =>
  p.iplHistory?.some(h => h.season === "2026" && h.teamId === "KKR")
);

const scored = kkrPlayers.map(player => {
  const worth = estimateRetentionWorth(player, kkr as any);
  return {
    name: player.name,
    age: player.age,
    rating: ratingOf(player),
    potential: potentialOf(player),
    nationality: player.nationality,
    isCapped: player.isCapped || player.nationality === "Overseas",
    worth: (worth / 100).toFixed(2) + " Cr",
    rawWorth: worth,
  };
});

scored.sort((a, b) => b.rawWorth - a.rawWorth);

console.log(`\nKKR Player Valuations (${scored.length} players, with noise):\n`);
scored.forEach((s, idx) => {
  const slot = s.isCapped ? "CAP" : "UNC";
  console.log(`${String(idx + 1).padStart(2)}. [${slot}] ${s.name.padEnd(28)} Age:${s.age}  RTG:${s.rating}  POT:${s.potential}  ${s.nationality.padEnd(10)}  Worth: ${s.worth}`);
});
