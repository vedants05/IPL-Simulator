import { deriveIplSeasonRosterStats } from "../lib/logic/iplSeasonRosterStats";

const innings = (runs: number) => ({
  batting: [{ id: "batter", name: "Batter", runs, balls: 20, dismissal: "caught" }],
  bowling: [{ id: "bowler", name: "Bowler", overs: 4, runsConceded: 20, wickets: 2 }],
});
const fixture = (id: string, date: string, runs: number, teamB = "B") => ({
  id, date, played: true, teamA: "A", teamB,
  scorecard: { inningsA: innings(runs), inningsB: { batting: [], bowling: [] } },
});
const stats = deriveIplSeasonRosterStats([
  fixture("old", "2026-04-01", 80),
  fixture("current", "2027-04-01", 40),
  fixture("duplicate", "2027-04-02", 60, "DOMESTIC"),
  fixture("current", "2027-04-01", 40),
], 2027, new Set(["A", "B"]));

if (stats.batter?.runs !== 40 || stats.batter?.matches !== 1
  || stats.bowler?.wickets !== 2 || stats.bowler?.oversBowled !== 4) {
  throw new Error(`Season roster stats leaked across fixtures: ${JSON.stringify(stats)}`);
}
const compact = deriveIplSeasonRosterStats([{
  id: "compact", date: "2027-05-01", played: true, teamA: "A", teamB: "B",
  simulation: { innings: [{ ...innings(25), battingTeamId: "A", bowlingTeamId: "B" }] },
}], 2027, new Set(["A", "B"]));
if (compact.batter?.runs !== 25 || compact.bowler?.wickets !== 2) {
  throw new Error(`Compact simulation scorecard missing: ${JSON.stringify(compact)}`);
}
console.log("IPL season roster stats verification passed");
