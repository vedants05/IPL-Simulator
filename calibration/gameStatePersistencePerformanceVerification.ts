import assert from "node:assert/strict";

const values = new Map<string, string>();
let writeCount = 0;
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { writeCount += 1; values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  },
});

async function main() {
const { gameStatePersistStorage } = await import("../lib/storage/gameStateStorage");
const largeCareer = {
  state: {
    currentDate: "2038-05-20",
    players: Array.from({ length: 4_000 }, (_, index) => ({
      id: `player-${index}`,
      name: `Player ${index}`,
      history: Array.from({ length: 12 }, (__, season) => ({ season: 2027 + season, runs: index + season })),
    })),
  },
  version: 5,
};
const legacySerializedBytesPerUpdate = JSON.stringify(largeCareer).length;
const started = performance.now();
const writes = Array.from({ length: 20 }, (_, index) => gameStatePersistStorage.setItem(
  "performance-save",
  { ...largeCareer, state: { ...largeCareer.state, currentDate: `2038-05-${String(index + 1).padStart(2, "0")}` } },
));
const synchronousMilliseconds = performance.now() - started;
await Promise.all(writes);

assert.equal(writeCount, 1, "same-tick updates should collapse to one persisted write");
assert.equal(JSON.parse(values.get("performance-save")!).state.currentDate, "2038-05-20");
const restored = await gameStatePersistStorage.getItem("performance-save");
assert.deepEqual(restored, {
  ...largeCareer,
  state: { ...largeCareer.state, currentDate: "2038-05-20" },
}, "deferred persistence must preserve the exact Zustand storage value");
assert.ok(synchronousMilliseconds < 20, `persistence calls blocked for ${synchronousMilliseconds.toFixed(1)}ms`);

console.log("Game-state persistence performance verification passed", {
  before: { synchronousSerializations: 20, approximateSerializedBytes: legacySerializedBytesPerUpdate * 20 },
  after: { synchronousSerializations: 0, persistedWrites: writeCount },
  synchronousMilliseconds,
});
}

void main();
