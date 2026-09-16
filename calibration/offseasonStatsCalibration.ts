import { applyOffseasonStatsToCareer, generateOffseasonStats } from "../lib/logic/offseasonStats";
import type { Player, Role } from "../lib/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Off-season stats calibration failed: ${message}`);
}

function player(id: string, role: Role, rating: number, nationality: "Indian" | "Overseas", capped: boolean): Player {
  return {
    id, name: `Player ${id}`, age: 26, nationality, country: nationality === "Indian" ? "India" : "Australia",
    role, battingStyle: "Right-hand Bat", bowlingStyle: role.includes("Bowler") ? "Fast" : null,
    bowlingHand: role.includes("Bowler") ? "Right-hand" : null, currentBatting: role.includes("Bowler") ? 35 : rating,
    potentialBatting: role.includes("Bowler") ? 40 : rating + 2, currentBowling: role.includes("Bowler") || role === "All-Rounder" ? rating : 20,
    potentialBowling: role.includes("Bowler") || role === "All-Rounder" ? rating + 2 : 25, reputation: Math.max(4, Math.round((rating - 55) / 4)),
    isCapped: capped, currentTeamId: "CSK", isOpener: role === "Batsman", isWicketkeeper: role === "WK-Batsman",
    careerStats: {
      batting: { matches: 20, innings: 18, runs: 400, average: 25, strikeRate: 125, fifties: 2, hundreds: 0, balls: 320, dismissals: 16 },
      bowling: { matches: 10, wickets: 12, economy: 7.5, average: 25, bestFigures: "3/20", balls: 240, runsConceded: 300 },
    },
  } as unknown as Player;
}

const roles: Role[] = ["Batsman", "WK-Batsman", "All-Rounder", "Pace Bowler", "Spin Bowler"];
const players = Object.fromEntries([
  ...Array.from({ length: 30 }, (_, index) => {
    const item = player(`ind-${index}`, roles[index % roles.length], 88 - (index % 9), "Indian", index >= 8);
    return [item.id, item] as const;
  }),
  ...Array.from({ length: 12 }, (_, index) => {
    const item = player(`os-${index}`, roles[index % roles.length], 86 - (index % 8), "Overseas", index < 8);
    return [item.id, item] as const;
  }),
]);
const performance = Object.fromEntries(Object.keys(players).map((id, index) => [id, {
  matches: 14, runs: index % 5 < 3 ? 320 + index * 4 : 80, balls: 240, wickets: index % 5 >= 2 ? 15 + index % 8 : 1,
}]));
const input = { players, performance, completedSeason: 2034, seed: "offseason-calibration", injuredPlayerIds: new Set(["ind-0"]) };
const first = generateOffseasonStats(input);
const second = generateOffseasonStats(input);

assert(JSON.stringify(first) === JSON.stringify(second), "same save and season must generate identical output");
assert(first.period.fromSeason === 2034 && first.period.toSeason === 2035, "period must span consecutive IPL seasons");
assert(first.period.players["ind-0"].matches === 0, "injured player must receive no appearances");
assert(Object.values(first.period.players).every((row) => row.matches >= 0 && row.matches <= 14), "match totals must remain within the off-season schedule");
assert(Object.values(first.period.players).every((row) => row.innings <= row.matches && row.notOuts <= row.innings), "batting aggregates must be internally valid");
assert(Object.values(first.period.players).every((row) => row.bowlingBalls <= row.matches * 24), "no player may bowl more than four overs per match");
const indiaSelections = Object.values(first.period.players).filter((row) => row.selectionStatus.startsWith("India"));
assert(indiaSelections.length > 15 && indiaSelections.length <= 21, "India must use a wider regular, rotation and reserve pool");
const indiaAppearances = indiaSelections.reduce((total, row) => total + row.matches, 0);
assert(indiaAppearances % 11 === 0 && indiaAppearances / 11 >= 10 && indiaAppearances / 11 <= 15, "India appearances must equal 11 players across 10 to 15 matches");
assert(indiaSelections.some((row) => !players[row.playerId].isCapped && first.players[row.playerId].isCapped), "an uncapped India selection must become capped");
const availableIndiaSelections = indiaSelections.filter((row) => row.matches > 0);
assert(availableIndiaSelections.filter((row) => row.selectionStatus === "India regular").length >= 8, "the leading available India players must be regulars, not reserves");
const frontlineBowlers = Object.values(first.period.players).filter((row) => {
  const role = players[row.playerId].role;
  return row.matches >= 7 && (role === "Pace Bowler" || role === "Spin Bowler");
});
assert(frontlineBowlers.length > 0 && frontlineBowlers.reduce((total, row) => total + row.wickets, 0) / frontlineBowlers.length >= 7, "frontline bowlers must take a credible number of wickets");
const careerUpdated = applyOffseasonStatsToCareer(first.players, first.period);
const sampleWithRuns = Object.values(first.period.players).find((row) => row.runs > 0)!;
const sampleWithWickets = Object.values(first.period.players).find((row) => row.wickets > 0)!;
assert(careerUpdated[sampleWithRuns.playerId].careerStats.batting.runs === first.players[sampleWithRuns.playerId].careerStats.batting.runs + sampleWithRuns.runs, "off-season runs must enter career T20 totals");
assert(careerUpdated[sampleWithWickets.playerId].careerStats.bowling.wickets === first.players[sampleWithWickets.playerId].careerStats.bowling.wickets + sampleWithWickets.wickets, "off-season wickets must enter career T20 totals");

console.log(`Off-season calibration passed: ${Object.keys(first.period.players).length} players, ${indiaSelections.length} India selections.`);
