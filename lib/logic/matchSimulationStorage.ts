import type { MatchSimulationRecord } from "./matchSimulation";

const DATABASE_NAME = "ipl-simulator-match-archive";
const DATABASE_VERSION = 1;
const STORE_NAME = "simulations";

interface StoredSimulation {
  key: string;
  careerId: string;
  fixtureId: string;
  simulation: MatchSimulationRecord;
  savedAt: number;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("careerId", "careerId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open the match archive."));
  });
}

const storageKey = (careerId: string, fixtureId: string) => `${careerId}:${fixtureId}`;

// IndexedDB structured-clones every simulation passed to a transaction. A
// fast-forward can complete several matches before earlier writes settle, so
// serialize archive transactions to prevent multiple full delivery graphs
// being cloned in memory at the same time.
let archiveWriteQueue: Promise<void> = Promise.resolve();

async function writeMatchSimulations(
  careerId: string,
  simulations: readonly MatchSimulationRecord[],
): Promise<void> {
  if (simulations.length === 0) return;
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    simulations.forEach((simulation) => {
      const record: StoredSimulation = {
        key: storageKey(careerId, simulation.fixtureId),
        careerId,
        fixtureId: simulation.fixtureId,
        simulation,
        savedAt: Date.now(),
      };
      store.put(record);
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save match records."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Saving match records was aborted."));
  });
  database.close();
}

export function saveMatchSimulations(
  careerId: string,
  simulations: readonly MatchSimulationRecord[],
): Promise<void> {
  if (simulations.length === 0) return Promise.resolve();
  const write = archiveWriteQueue
    .catch(() => undefined)
    .then(() => writeMatchSimulations(careerId, simulations));
  archiveWriteQueue = write;
  return write;
}

export async function loadMatchSimulations(
  careerId: string,
  fixtureIds: readonly string[],
): Promise<Record<string, MatchSimulationRecord>> {
  if (fixtureIds.length === 0) return {};
  await archiveWriteQueue.catch(() => undefined);
  const database = await openDatabase();
  if (!database) return {};
  const records = await new Promise<Record<string, MatchSimulationRecord>>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const loaded: Record<string, MatchSimulationRecord> = {};
    let remaining = fixtureIds.length;
    fixtureIds.forEach((fixtureId) => {
      const request = store.get(storageKey(careerId, fixtureId));
      request.onsuccess = () => {
        const result = request.result as StoredSimulation | undefined;
        if (result?.simulation) loaded[fixtureId] = result.simulation;
        remaining -= 1;
        if (remaining === 0) resolve(loaded);
      };
      request.onerror = () => reject(request.error ?? new Error("Unable to load a saved match."));
    });
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to load match records."));
  });
  database.close();
  return records;
}

/** Remove archived match deliveries from seasons that are no longer active. */
export async function deleteMatchSimulationsBeforeSeason(
  userTeamId: string,
  activeSeason: number,
): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result as IDBCursorWithValue | null;
      if (!cursor) return;
      const record = cursor.value as StoredSimulation;
      const [careerUser, seasonText] = record.careerId.split(":");
      const season = Number(seasonText);
      if (careerUser === userTeamId && Number.isFinite(season) && season < activeSeason) {
        cursor.delete();
      }
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to clean old match records."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Cleaning old match records was aborted."));
  });
  database.close();
}

/**
 * Local storage retains everything required for standings, scorecards and
 * summaries. Delivery arrays live in IndexedDB because a full 70-match season
 * is larger than the browser's normal local-storage quota.
 */
export function compactMatchSimulation(
  simulation: MatchSimulationRecord,
): MatchSimulationRecord {
  const compactInnings = (innings: MatchSimulationRecord["innings"][number]) => ({
    ...innings,
    oversDetail: [],
  });
  return {
    ...simulation,
    innings: [
      compactInnings(simulation.innings[0]),
      compactInnings(simulation.innings[1]),
    ],
  };
}

export function hasArchivedDeliveries(simulation: MatchSimulationRecord): boolean {
  return simulation.innings.some((innings) => innings.oversDetail.length > 0);
}
