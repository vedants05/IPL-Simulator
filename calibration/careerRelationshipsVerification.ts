import { strict as assert } from "node:assert";
import {
  applyCareerRelationshipEvent, documentedRelationships, emptyCareerRelationshipState,
  progressCareerRelationships, progressInternationalRelationships, relationshipId, relationshipSoftCap,
  relationshipsForPerson, type RelationshipMatch,
} from "../lib/logic/careerRelationships";
import { emptyCareerStaffState } from "../lib/logic/staffContracts";
import type { Player } from "../lib/types";

const player = (id: string, role: Player["role"] = "Batsman"): Player => ({
  id, name: id, role, age: 26, iplHistory: [], currentBatting: 75, currentBowling: 35,
  reputation: 6, iplStats: { matches: 30, runs: 0, battingAverage: 0, strikeRate: 0, bowlingInnings: 0, bowlingAverage: 0, wickets: 0 },
} as unknown as Player);
const players = { a: player("a"), b: player("b"), c: player("c", "Pace Bowler") };
const staff = emptyCareerStaffState();
const match = (number: number): RelationshipMatch => ({ id: `m-${number}`, teams: [{ teamId: "T", playerIds: ["a", "b", "c"], openingIds: ["a", "b"], bowlerIds: ["c"], paceIds: ["c"], spinIds: [] }] });
const first = progressCareerRelationships({ state: emptyCareerRelationshipState(), season: 2027, players, staff, matches: Array.from({ length: 12 }, (_, index) => match(index)) });
const openingId = relationshipId("opening_partners", { kind: "player", id: "a", name: "a" }, { kind: "player", id: "b", name: "b" });
assert.ok(first.records[openingId], "repeated openers should form a relationship");
assert.equal(first.records[openingId].source, "career");
assert.deepEqual(progressCareerRelationships({ state: first, season: 2027, players, staff, matches: [match(99)] }), first, "archive replay must not progress relationships twice");
assert.equal(Object.values(first.records).filter((record) => record.source === "career" && record.subject.id === "a").length, 1, "only one new bond per player per season");
const second = progressCareerRelationships({ state: first, season: 2028, players, staff, matches: Array.from({ length: 12 }, (_, index) => match(index + 12)) });
assert.ok(second.records[openingId].rating > first.records[openingId].rating);
const dormant = progressCareerRelationships({ state: second, season: 2029, players, staff, matches: [] });
assert.equal(dormant.records[openingId].status, "dormant");
assert.ok(dormant.records[openingId].rating < second.records[openingId].rating);
assert.equal(relationshipSoftCap(1), 2);
assert.equal(relationshipSoftCap(6), 5);
assert.equal(relationshipSoftCap(14), 8);

const subject = { kind: "player" as const, id: "a", name: "a" };
const partner = { kind: "player" as const, id: "b", name: "b" };
let explicit = emptyCareerRelationshipState();
explicit = applyCareerRelationshipEvent(explicit, { id: "bond-1", season: 2027, type: "personal_bond", subject, partner, reason: "Shared a team bonding event." });
assert.equal(Object.keys(explicit.records).length, 0, "one event must not create a personal bond");
explicit = applyCareerRelationshipEvent(explicit, { id: "bond-2", season: 2027, type: "personal_bond", subject, partner, reason: "Continued the friendship." });
assert.equal(Object.keys(explicit.records).length, 1);
const repeated = applyCareerRelationshipEvent(explicit, { id: "bond-2", season: 2027, type: "personal_bond", subject, partner, reason: "Continued the friendship." });
assert.deepEqual(repeated, explicit, "event replay must be idempotent");
assert.deepEqual(applyCareerRelationshipEvent(explicit, { id: "idol-event", season: 2027, type: "idol", subject, partner, reason: "No progression." }), explicit, "idols cannot progress");

const seededPlayers = { head: { ...player("head"), name: "Travis Head" }, abhishek: { ...player("abhishek"), name: "Abhishek Sharma" } };
const seeded = documentedRelationships(seededPlayers, staff);
const startingPair = Object.values(seeded).find((record) => record.type === "opening_partners" && record.subject.id === "head" && record.partner.id === "abhishek");
assert.ok(startingPair && startingPair.rating >= 90 && startingPair.source === "documented");
assert.ok(relationshipsForPerson(emptyCareerRelationshipState(), seededPlayers, staff, { kind: "player", id: "head", name: "Travis Head" }).some(({ record }) => record.id === startingPair.id));

const cohortPlayers = {
  youth1: { ...player("youth1"), age: 20, youthPathwayId: "Karnataka:669", careerState: { origin: "generated", generatedSeason: 2027 } },
  youth2: { ...player("youth2"), age: 21, youthPathwayId: "Karnataka:669", careerState: { origin: "generated", generatedSeason: 2027 } },
} as unknown as Record<string, Player>;
const cohort = progressCareerRelationships({ state: emptyCareerRelationshipState(), season: 2027, players: cohortPlayers, staff, matches: [] });
assert.equal(Object.values(cohort.records).filter((record) => record.type === "domestic_roots").length, 1);
const cohortLater = progressCareerRelationships({ state: cohort, season: 2028, players: cohortPlayers, staff, matches: [] });
assert.equal(Object.values(cohortLater.records).find((record) => record.type === "domestic_roots")?.rating, Object.values(cohort.records).find((record) => record.type === "domestic_roots")?.rating, "background roots do not progress");

const longCareerPlayers = Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`long-${index}`, player(`long-${index}`)]));
let longCareer = emptyCareerRelationshipState();
for (let season = 2027; season <= 2040; season += 1) {
  const matches: RelationshipMatch[] = Array.from({ length: 14 }, (_, index) => ({
    id: `${season}-${index}`,
    teams: [{ teamId: "T", playerIds: Object.keys(longCareerPlayers), openingIds: [], bowlerIds: [], paceIds: [], spinIds: [] }],
  }));
  const before = Object.values(longCareer.records).filter((record) => record.source === "career").length;
  longCareer = progressCareerRelationships({ state: longCareer, season, players: longCareerPlayers, staff, matches });
  const after = Object.values(longCareer.records).filter((record) => record.source === "career").length;
  assert.ok(after - before <= 5, "one new bond per person per season must prevent relationship floods");
}
assert.ok(longCareer.activeSeasons["player:long-0"] >= 14);
assert.ok(Object.values(longCareer.records).filter((record) => record.source === "career").length > 3, "long-serving players should gain more relationships over time");
const internationals = progressInternationalRelationships({
  state: emptyCareerRelationshipState(), players, staff, season: 2027,
  fixtures: Array.from({ length: 5 }, (_, index) => ({ id: `intl-${index}`, played: true, xiA: ["a", "b"], xiB: ["c"] })),
});
assert.equal(Object.values(internationals.records).filter((record) => record.type === "national_teammates").length, 1);
assert.deepEqual(progressInternationalRelationships({ state: internationals, players, staff, season: 2027, fixtures: [{ id: "intl-0", played: true, xiA: ["a", "b"] }] }), internationals);
const coachingStaff = emptyCareerStaffState();
coachingStaff.contracts = {
  leader: { staffId: "leader", staffSlug: "leader", fullName: "Leader", teamId: "T", roles: ["head_coach"], status: "contracted", startSeason: 2027, experienceYears: 18 },
  assistant: { staffId: "assistant", staffSlug: "assistant", fullName: "Assistant", teamId: "T", roles: ["batting_coach"], status: "contracted", startSeason: 2027, experienceYears: 5 },
} as unknown as typeof coachingStaff.contracts;
const staffFirst = progressCareerRelationships({ state: emptyCareerRelationshipState(), season: 2027, players, staff: coachingStaff, matches: [] });
assert.equal(Object.values(staffFirst.records).filter((record) => record.type === "trusted_colleague" && record.source === "career").length, 0);
const staffSecond = progressCareerRelationships({ state: staffFirst, season: 2028, players, staff: coachingStaff, matches: [] });
assert.equal(Object.values(staffSecond.records).filter((record) => record.type === "trusted_colleague" && record.source === "career").length, 1, "staff bonds need sustained collaboration");
const prospect = { ...player("prospect"), age: 21, currentBatting: 76, potentialBatting: 88, potentialBowling: 40, careerState: { origin: "generated", generatedSeason: 2027 } } as unknown as Player;
const backed = progressCareerRelationships({
  state: emptyCareerRelationshipState(), season: 2027, players: { prospect }, staff: coachingStaff,
  seasonPlayerStats: { prospect: { runs: 250, matches: 10 } },
  matches: Array.from({ length: 10 }, (_, index) => ({ id: `backed-${index}`, teams: [{ teamId: "T", playerIds: ["prospect"], openingIds: [], bowlerIds: [], paceIds: [], spinIds: [] }] })),
});
assert.equal(Object.values(backed.records).filter((record) => record.type === "talent_champion").length, 1, "a coach can champion a productive young prospect");
const coachPerson = { kind: "staff" as const, id: "leader", name: "Leader" };
const assistantPerson = { kind: "staff" as const, id: "assistant", name: "Assistant" };
const essential = applyCareerRelationshipEvent(emptyCareerRelationshipState(), { id: "retain-request", season: 2028, type: "essential_staff", subject: coachPerson, partner: assistantPerson, reason: "Head coach requested retention." });
assert.equal(Object.values(essential.records).filter((record) => record.type === "essential_staff").length, 1);
console.log("Career relationship verification passed");
