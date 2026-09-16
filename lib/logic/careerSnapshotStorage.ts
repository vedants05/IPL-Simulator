import type { MatchSimulationRecord } from "./matchSimulation";
import { compactMatchSimulation } from "./matchSimulationStorage";
import { decodeCompressedJson, encodeCompressedJson } from "./compressedStorage";

interface SnapshotFixture extends Record<string, unknown> {
  simulation?: MatchSimulationRecord;
}

export const careerSnapshotStorageKey = (teamId: string) => `ipl_career_${teamId}`;

/**
 * The overview snapshot is a small active-season cache, not the canonical
 * career database. Never place derived scorecards, commentary, delivery data,
 * or legacy aliases in localStorage: those values are rebuilt from the compact
 * simulation or hydrated from the IndexedDB match archive.
 */
export function compactCareerSnapshot<T extends Record<string, any>>(state: T): T {
  const compact: Record<string, any> = { ...state };
  delete compact.startingXI;
  delete compact.teamStrategy;
  if (Array.isArray(compact.fixtures)) {
    compact.fixtures = compact.fixtures.map((fixture: SnapshotFixture) => fixture.simulation ? {
      ...fixture,
      commentary: undefined,
      scorecard: undefined,
      simulation: compactMatchSimulation(fixture.simulation),
    } : fixture);
  }
  return compact as T;
}

export function serializeCareerSnapshot(state: Record<string, any>, alreadyCompact = false): string {
  return encodeCompressedJson(alreadyCompact ? state : compactCareerSnapshot(state));
}

export function parseCareerSnapshot(serialized: string): Record<string, any> {
  return decodeCompressedJson(serialized);
}

export function writeCareerSnapshot(storage: Storage, key: string, state: Record<string, any>): string {
  const serialized = serializeCareerSnapshot(state);
  storage.setItem(key, serialized);
  return serialized;
}
