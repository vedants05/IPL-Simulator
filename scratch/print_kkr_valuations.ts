import { PLAYERS_SEED } from "../lib/data/players";

const rep10Players = PLAYERS_SEED.filter(p => p.reputation === 10);

console.log(`Found ${rep10Players.length} reputation-10 players:\n`);
rep10Players.forEach((p, idx) => {
  const rating = Math.max(p.currentBatting || 0, p.currentBowling || 0);
  console.log(`${idx + 1}. ${p.name} (Age: ${p.age}, RTG: ${rating}, Role: ${p.role}, Nationality: ${p.nationality})`);
});
