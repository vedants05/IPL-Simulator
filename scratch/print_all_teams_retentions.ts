import { PLAYERS_SEED } from "../lib/data/players";
import { TEAMS_SEED } from "../lib/data/teams";
import { estimateRetentionWorth } from "../lib/logic/auctionEngine";

const ratingOf = (p: any) => Math.max(p.currentBatting || 0, p.currentBowling || 0);
const isCapped = (p: any) => p.isCapped || p.nationality === "Overseas";

const playersMap = Object.fromEntries(PLAYERS_SEED.map(p => [p.id, p]));

// Group players by their current team
const squadByTeam: Record<string, typeof PLAYERS_SEED> = {};
for (const p of PLAYERS_SEED) {
  if (!p.currentTeamId) continue;
  if (!squadByTeam[p.currentTeamId]) squadByTeam[p.currentTeamId] = [];
  squadByTeam[p.currentTeamId].push(p);
}

for (const team of TEAMS_SEED) {
  const squad = squadByTeam[team.id] ?? [];

  const scored = squad.map(p => ({
    p,
    worth: estimateRetentionWorth(p as any, team),
  }));

  const capped = scored
    .filter(({ p }) => isCapped(p))
    .sort((a, b) => b.worth - a.worth)
    .slice(0, 5);

  const uncapped = scored
    .filter(({ p }) => !isCapped(p))
    .sort((a, b) => b.worth - a.worth)
    .slice(0, 2);

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${team.name} (${team.id})`);
  console.log(`${"─".repeat(60)}`);

  console.log("  CAPPED:");
  capped.forEach(({ p, worth }, i) => {
    const rtg = ratingOf(p);
    console.log(`    ${i + 1}. ${(p.name as string).padEnd(28)} RTG:${rtg}  Age:${p.age}  Worth: ₹${(worth / 100).toFixed(1)} Cr`);
  });

  console.log("  UNCAPPED:");
  if (uncapped.length === 0) {
    console.log("    (none)");
  } else {
    uncapped.forEach(({ p, worth }, i) => {
      const rtg = ratingOf(p);
      console.log(`    ${i + 1}. ${(p.name as string).padEnd(28)} RTG:${rtg}  Age:${p.age}  Worth: ₹${(worth / 100).toFixed(1)} Cr`);
    });
  }
}
console.log(`\n${"─".repeat(60)}\n`);
