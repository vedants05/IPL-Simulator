import { strict as assert } from "node:assert";
import { createScoutingGeneratedPlayer, initializeCareerPlayers } from "../lib/logic/careerLifecycle";
import type { Player } from "../lib/types";

const veteran = (id: string, role: Player["role"], batting: number, bowling: number): Player => ({
  id,
  name: id,
  role,
  age: 35,
  country: "India",
  nationality: "Indian",
  battingStyle: "Right-hand",
  bowlingStyle: role === "Pace Bowler" ? "Pacer" : role === "Spin Bowler" ? "Spinner" : null,
  currentBatting: batting,
  currentBowling: bowling,
  reputation: 9,
  iplStats: { matches: 100, runs: 0, battingAverage: 0, strikeRate: 0, bowlingInnings: 0, bowlingAverage: 0, wickets: 0 },
} as Player);

const players = {
  batter: veteran("batter", "Batsman", 90, 35),
  pacer: veteran("pacer", "Pace Bowler", 30, 90),
  spinner: veteran("spinner", "Spin Bowler", 35, 89),
  keeper: veteran("keeper", "WK-Batsman", 87, 30),
  allrounder: veteran("allrounder", "All-Rounder", 85, 82),
};
const roleIds = { BAT: "batter", PACE: "pacer", SPIN: "spinner", WK: "keeper", AR: "allrounder" } as const;
let idols = 0;
for (const [preferredRole, expectedId] of Object.entries(roleIds) as Array<[keyof typeof roleIds, string]>) {
  for (let index = 0; index < 100; index += 1) {
    const input = { index, season: 2032, seed: `idol-verification-${preferredRole}`, players, nationality: "Indian" as const, country: "India", preferredRole };
    const generated = createScoutingGeneratedPlayer(input);
    const repeated = createScoutingGeneratedPlayer(input);
    assert.deepEqual(generated.idol, repeated.idol, "idol assignment must be deterministic");
    if (!generated.idol) continue;
    idols += 1;
    assert.equal(generated.idol.playerId, expectedId, "idol must match the regen role");
    assert.ok(generated.idol.rating >= 80 && generated.idol.rating <= 95);
  }
}
assert.ok(idols >= 60 && idols <= 140, `expected a minority of regens to have an idol, got ${idols}/500`);
const legacy = createScoutingGeneratedPlayer({ index: 700, season: 2032, seed: "legacy-idol", players, nationality: "Indian", country: "India", preferredRole: "PACE" });
legacy.careerState = { ...legacy.careerState!, idolGenerationVersion: undefined };
legacy.idol = undefined;
const migrated = initializeCareerPlayers({ ...players, [legacy.id]: legacy }, 2032)[legacy.id];
assert.equal(migrated.careerState?.idolGenerationVersion, 1);
assert.deepEqual(initializeCareerPlayers({ ...players, [legacy.id]: migrated }, 2032)[legacy.id].idol, migrated.idol, "legacy idol decision must persist, including a no-idol result");
console.log(`Regen idol verification passed: ${idols}/500 generated idols`);
