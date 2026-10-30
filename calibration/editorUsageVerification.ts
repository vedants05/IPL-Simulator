import assert from "node:assert/strict";
import { normalizeEditorUsage, recordEditorUsage } from "../lib/logic/editorUsage";
import { DEFAULT_WORLD_RULES } from "../lib/logic/worldRules";
import { refreshEditorAccess } from "../lib/store/editorAccessStore";

const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  },
});

async function main() {
  const clean = { editorUsed: false, editorFirstUsedAt: null };
  assert.deepEqual(normalizeEditorUsage({}), clean);
  assert.deepEqual(normalizeEditorUsage({ worldRules: DEFAULT_WORLD_RULES }), clean);
  for (const evidence of [
    { playerOverrides: { player: { currentBatting: 80 } } },
    { frozenPlayerAttributes: { player: { currentBatting: 80 } } },
    { staffOverrides: { coach: { reputation: 90 } } },
    { frozenStaffAttributes: { coach: { reputation: 90 } } },
    { worldRules: { ...DEFAULT_WORLD_RULES, maxOverseasInXI: 5 } },
    { careerStaff: { employmentHistory: [{ id: "coach:2028:editor-appointed:1" }] } },
  ]) {
    assert.deepEqual(normalizeEditorUsage(evidence), { editorUsed: true, editorFirstUsedAt: null });
  }
  const firstUsedAt = "2026-10-13T14:00:00.000Z";
  const used = recordEditorUsage(clean, firstUsedAt);
  assert.deepEqual(used, { editorUsed: true, editorFirstUsedAt: firstUsedAt });
  assert.deepEqual(recordEditorUsage(used, "2026-10-14T14:00:00.000Z"), used);
  assert.deepEqual(recordEditorUsage({ editorUsed: true, editorFirstUsedAt: null }), { editorUsed: true, editorFirstUsedAt: null });

  const { useGameStore } = await import("../lib/store/gameStore");
  const { gameStatePersistStorage } = await import("../lib/storage/gameStateStorage");
  const { PERSIST_KEY } = await import("../lib/supabase/cloudSaves");
  // The mocked in-memory storage keeps existing browser saves out of this test.
  const initial = useGameStore.getState();
  useGameStore.setState({ saveId: "editor-usage-career-a", ...clean });
  useGameStore.getState().setWorldRules({ maxOverseasInXI: 5 });
  assert.equal(useGameStore.getState().editorUsed, false, "locked editor actions must not mark a career");

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ configured: true, granted: true, enabled: true });
    await refreshEditorAccess();
    assert.equal(useGameStore.getState().editorUsed, false, "unlocking alone is not editor use");
    useGameStore.getState().applyPlayerEdit("missing-player", { currentBatting: 99 });
    useGameStore.getState().setTeamFinances("missing-team", { totalPurse: 99999 });
    assert.equal(useGameStore.getState().editorUsed, false, "rejected edits must not mark a career");

    useGameStore.getState().setWorldRules({ maxOverseasInXI: 5 });
    assert.equal(useGameStore.getState().editorUsed, true);
    const recordedAt = useGameStore.getState().editorFirstUsedAt;
    assert.ok(recordedAt);
    useGameStore.getState().resetWorldRules();
    assert.equal(useGameStore.getState().editorUsed, true, "resetting edited rules must retain editor history");
    assert.equal(useGameStore.getState().editorFirstUsedAt, recordedAt);

    const partialize = useGameStore.persist.getOptions().partialize!;
    const snapshot = partialize(useGameStore.getState()) as Record<string, unknown>;
    assert.equal(snapshot.editorUsed, true);
    assert.equal(snapshot.editorFirstUsedAt, recordedAt);
    await gameStatePersistStorage.setItem("editor-history-roundtrip", { state: snapshot, version: 5 });
    const restored = await gameStatePersistStorage.getItem("editor-history-roundtrip");
    assert.equal((restored?.state as typeof snapshot).editorUsed, true);
    // Archives and cloud uploads both carry this entire persisted state envelope.
    const copiedEnvelope = JSON.parse(JSON.stringify(restored));
    assert.equal(copiedEnvelope.state.editorUsed, true);

    const merge = useGameStore.persist.getOptions().merge!;
    const reloaded = merge(snapshot, initial);
    assert.equal(reloaded.editorUsed, true);
    assert.equal(reloaded.editorFirstUsedAt, recordedAt);
    const otherCareer = merge({ saveId: "career-b", worldRules: DEFAULT_WORLD_RULES }, reloaded);
    assert.equal(otherCareer.editorUsed, false, "loading another career must not inherit this flag");
    assert.equal(otherCareer.editorFirstUsedAt, null);
    useGameStore.getState().resetGame();
    assert.equal(useGameStore.getState().editorUsed, false);
    assert.equal(useGameStore.getState().editorFirstUsedAt, null);
    await gameStatePersistStorage.removeItem!(PERSIST_KEY);
    console.log("Editor usage checks passed: per-career tracking, first-use date, rejected/locked edits, sticky history, migration and save/load persistence.");
  } finally { globalThis.fetch = originalFetch; }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
