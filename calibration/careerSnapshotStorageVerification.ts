import assert from "node:assert/strict";
import { compactCareerSnapshot, parseCareerSnapshot, serializeCareerSnapshot, writeCareerSnapshot } from "../lib/logic/careerSnapshotStorage";
import { parseSmatCareer, serializeSmatCareer } from "../lib/logic/smatStorage";
import type { SmatCareerState } from "../lib/logic/smat";
import LZString from "lz-string";

const innings = (inningsNumber: 1 | 2) => ({
  inningsNumber,
  battingTeamId: "CSK",
  bowlingTeamId: "MI",
  runs: 178,
  wickets: 6,
  legalBalls: 120,
  overs: 20,
  batting: Array.from({ length: 11 }, (_, i) => ({ playerId: `player-${i}`, playerName: `Player ${i}`, runs: 20, balls: 15, fours: 2, sixes: 1, dismissal: "caught", strikeRate: 133.33 })),
  bowling: Array.from({ length: 6 }, (_, i) => ({ playerId: `bowler-${i}`, playerName: `Bowler ${i}`, overs: 4, runs: 30, wickets: 1, economy: 7.5 })),
  extras: { wides: 2, noBalls: 0, byes: 0, legByes: 0, total: 2 },
  oversDetail: Array.from({ length: 20 }, () => ({ balls: Array.from({ length: 6 }, () => ({ commentary: "A detailed delivery record" })) })),
  fallOfWickets: [],
  partnerships: [],
});
const fixture = (id: number) => ({
  id: `fixture-${id}`, date: `2027-04-${String(id % 28 + 1).padStart(2, "0")}`,
  teamA: "CSK", teamB: "MI", played: true,
  commentary: Array.from({ length: 40 }, () => "A duplicated match summary"),
  scorecard: { batting: Array.from({ length: 22 }, () => ({ playerName: "A player", runs: 20 })) },
  simulation: { version: 1, seed: `seed-${id}`, fixtureId: `fixture-${id}`, innings: [innings(1), innings(2)], summary: ["Match result"] },
});

const snapshot = { season: 2027, fixtures: Array.from({ length: 74 }, (_, i) => fixture(i)), shortlist: ["player-1"], startingXI: ["player-1"] };
const legacy = JSON.stringify(snapshot);
assert.deepEqual(parseCareerSnapshot(legacy), snapshot, "existing JSON saves remain readable");
assert.deepEqual(parseCareerSnapshot(`lz16:${LZString.compressToUTF16(legacy)}`), snapshot, "previously compressed saves remain readable");

const serialized = serializeCareerSnapshot(snapshot);
const restored = parseCareerSnapshot(serialized);
assert.equal(restored.fixtures.length, 74);
assert.deepEqual(restored.shortlist, snapshot.shortlist);
assert.equal(restored.fixtures[0].simulation.innings[0].batting.length, 11);
assert.deepEqual(restored.fixtures[0].simulation.innings[0].oversDetail, []);
assert.equal(restored.fixtures[0].commentary, undefined);
assert.equal(restored.fixtures[0].scorecard, undefined);
assert.equal(restored.startingXI, undefined);
assert.ok(serialized.length < legacy.length / 5, `compressed snapshot should leave quota headroom: ${serialized.length} vs ${legacy.length}`);
assert.deepEqual(parseCareerSnapshot(serializeCareerSnapshot(compactCareerSnapshot(restored))), restored);

const values = new Map<string, string>();
const storage = {
  setItem(key: string, value: string) {
    const total = Array.from(values.entries()).reduce((sum, [storedKey, storedValue]) =>
      sum + (storedKey === key ? 0 : storedKey.length + storedValue.length), key.length + value.length);
    if (total > 5_000_000) throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    values.set(key, value);
  },
  getItem(key: string) { return values.get(key) ?? null; },
} as Storage;
values.set("other-save", "x".repeat(4_000_000));
assert.throws(() => storage.setItem("ipl_career_CSK", legacy), { name: "QuotaExceededError" });
writeCareerSnapshot(storage, "ipl_career_CSK", snapshot);
assert.deepEqual(parseCareerSnapshot(storage.getItem("ipl_career_CSK")!), restored);
console.log(`Career snapshot compression passed (${legacy.length} to ${serialized.length} characters).`);

const smat: SmatCareerState = {
  version: 1, history: [], playerCareerStats: {},
  activeSeason: {
    season: 2027, retentionDate: "2027-11-01", startsOn: "2027-11-01", endsOn: "2027-12-01",
    squads: {}, fixtures: Array.from({ length: 80 }, (_, i) => ({
      id: `smat-${i}`, date: "2027-11-20", stage: "elite-group" as const, group: "A",
      teamA: "DELHI", teamB: "MUMBAI", played: true,
      scorecard: {
        inningsA: { batting: Array.from({ length: 11 }, (_, j) => ({ playerId: `a-${j}`, name: `Player ${j}`, runs: 25, balls: 20, dismissed: true })), bowling: [] },
        inningsB: { batting: [], bowling: Array.from({ length: 11 }, (_, j) => ({ playerId: `b-${j}`, name: `Bowler ${j}`, balls: 20, runs: 25, wickets: 1 })) },
      },
    })), tables: {}, playerStats: {}, completed: false,
  },
};
assert.deepEqual(parseSmatCareer(JSON.stringify(smat)), smat);
assert.deepEqual(parseSmatCareer(`lz16:${LZString.compressToUTF16(JSON.stringify(smat))}`), smat);
const compactSmat = serializeSmatCareer(smat);
assert.deepEqual(parseSmatCareer(compactSmat), smat);
assert.ok(compactSmat.length < JSON.stringify(smat).length / 5);
console.log(`SMAT compression passed (${JSON.stringify(smat).length} to ${compactSmat.length} characters).`);
