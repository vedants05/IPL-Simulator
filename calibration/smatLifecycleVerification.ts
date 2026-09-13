import { performance } from "node:perf_hooks";
import { createSmatSeason, reconcileSmatCareer, SMAT_TEAMS, type SmatCareerState } from "../lib/logic/smat";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const retentionDate = "2027-11-15";
const initial: SmatCareerState = {
  version: 1,
  activeSeason: createSmatSeason(2027, retentionDate, {}),
  history: [],
  playerCareerStats: {},
};
const started = performance.now();
const completed = reconcileSmatCareer(initial, 2027, retentionDate, retentionDate, {});
const elapsed = performance.now() - started;
const active = completed.activeSeason!;

assert(SMAT_TEAMS.length === 38, "SMAT must contain 38 teams");
assert(Object.values(active.squads).flat().every((player) => !/ Player \d+$/.test(player.name)), "Generated players must have proper names");
assert(active.startsOn === "2027-10-21" && active.endsOn === "2027-11-12", "SMAT dates must follow the retention-relative schedule");
assert(active.fixtures.length === 141, `Expected 141 matches, received ${active.fixtures.length}`);
assert(active.fixtures.every((match) => match.played), "Every due match must be simulated during a calendar skip");
assert(active.fixtures.every((match) => match.scorecard?.inningsA.batting.length === 11 && match.scorecard.inningsB.batting.length === 11), "Every played match must retain an aggregate scorecard");
assert(Object.values(active.tables).filter((table) => table.length > 0).map((table) => table.length).join(",") === "8,8,8,8,6,4,4", "Group structure is incorrect");
assert(completed.history.length === 1, "Completed season must create one archive");
assert(JSON.stringify(completed.history[0]).length < 15_000, "Compact archive exceeded 15 KB");
assert(elapsed < 500, `Full season simulation exceeded 500ms (${elapsed.toFixed(1)}ms)`);

const repeated = reconcileSmatCareer(completed, 2027, retentionDate, retentionDate, {});
assert(repeated.history.length === 1, "Reconciliation duplicated a completed archive");
assert(JSON.stringify(repeated.playerCareerStats) === JSON.stringify(completed.playerCareerStats), "Reconciliation duplicated player career totals");

const next = reconcileSmatCareer(completed, 2028, "2028-11-10", "2028-10-01", {});
const prior = completed.history[0];
const nextPlateIds = new Set(next.activeSeason!.fixtures.filter((match) => match.stage === "plate-group").flatMap((match) => [match.teamA, match.teamB]));
prior.promoted.forEach((id) => assert(!nextPlateIds.has(id), `${id} was promoted but remained in Plate`));
prior.relegated.forEach((id) => assert(nextPlateIds.has(id), `${id} was relegated but did not enter Plate`));

console.log(`SMAT lifecycle passed: 38 teams, 141 matches, ${elapsed.toFixed(1)}ms, ${JSON.stringify(completed.history[0]).length} byte archive.`);
