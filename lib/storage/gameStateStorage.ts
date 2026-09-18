import type { PersistStorage, StateStorage, StorageValue } from "zustand/middleware";
import { uploadSave, setCloudSyncStatus } from "../supabase/cloudSaves";

/** Debounced cloud mirror of the latest persisted value. Local IndexedDB is the primary store. */
const CLOUD_SYNC_DELAY_MS = 20_000;
let cloudTimer: ReturnType<typeof setTimeout> | null = null;
let cloudLatest: StorageValue<unknown> | null = null;
let cloudInFlight = false;

function scheduleCloudSync(value: StorageValue<unknown>): void {
  if (typeof window === "undefined") return;
  cloudLatest = value;
  if (cloudTimer) return;
  cloudTimer = setTimeout(runCloudSync, CLOUD_SYNC_DELAY_MS);
}

async function runCloudSync(): Promise<void> {
  cloudTimer = null;
  if (cloudInFlight || !cloudLatest) return;
  const value = cloudLatest;
  cloudLatest = null;
  cloudInFlight = true;
  setCloudSyncStatus("syncing");
  try {
    await uploadSave(value as { state: unknown; version?: number });
    setCloudSyncStatus("synced");
  } catch (error) {
    console.warn("Cloud save sync failed:", error);
    setCloudSyncStatus("error");
  } finally {
    cloudInFlight = false;
    if (cloudLatest) scheduleCloudSync(cloudLatest);
  }
}

/** Push the newest state immediately (e.g. before sign-out or on explicit save). */
export async function flushCloudSync(): Promise<void> {
  if (cloudTimer) { clearTimeout(cloudTimer); cloudTimer = null; }
  await runCloudSync();
}

const DATABASE_NAME = "ipl-simulator-game-state";
const DATABASE_VERSION = 1;
const STORE_NAME = "saves";

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open the game-state database."));
  });
}

async function readIndexedValue(name: string): Promise<string | null> {
  const database = await openDatabase();
  if (!database) return null;
  try {
    return await new Promise<string | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(name);
      request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error("Unable to load the game state."));
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to load the game state."));
    });
  } finally {
    database.close();
  }
}

async function writeIndexedValue(name: string, value: string): Promise<boolean> {
  const database = await openDatabase();
  if (!database) return false;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(value, name);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save the game state."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Saving the game state was aborted."));
    });
    return true;
  } finally {
    database.close();
  }
}

async function deleteIndexedValue(name: string): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(name);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to delete the game state."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Deleting the game state was aborted."));
    });
  } finally {
    database.close();
  }
}

type PendingWrite = {
  value: string;
  waiters: Array<{ resolve: () => void; reject: (error: unknown) => void }>;
  scheduled: boolean;
  running: boolean;
};

const pendingWrites = new Map<string, PendingWrite>();

type PendingObjectWrite = {
  value: StorageValue<unknown>;
  waiters: Array<{ resolve: () => void; reject: (error: unknown) => void }>;
  scheduled: boolean;
  running: boolean;
};

const pendingObjectWrites = new Map<string, PendingObjectWrite>();

function scheduleObjectWrite(name: string, pending: PendingObjectWrite): void {
  if (pending.scheduled || pending.running) return;
  pending.scheduled = true;
  globalThis.setTimeout(() => {
    pending.scheduled = false;
    pending.running = true;
    const latestValue = pending.value;
    const waiters = pending.waiters.splice(0);
    scheduleCloudSync(latestValue);
    void Promise.resolve(gameStateStorage.setItem(name, JSON.stringify(latestValue)))
      .then(() => waiters.forEach((waiter) => waiter.resolve()))
      .catch((error: unknown) => waiters.forEach((waiter) => waiter.reject(error)))
      .finally(() => {
        pending.running = false;
        if (pending.waiters.length > 0) scheduleObjectWrite(name, pending);
        else pendingObjectWrites.delete(name);
      });
  }, 0);
}

async function persistValue(name: string, value: string): Promise<void> {
  if (await writeIndexedValue(name, value)) {
    removeLegacyValue(name);
  } else if (typeof localStorage !== "undefined") {
    localStorage.setItem(name, value);
  }
}

function schedulePersistedWrite(name: string, pending: PendingWrite): void {
  if (pending.scheduled || pending.running) return;
  pending.scheduled = true;
  globalThis.setTimeout(() => {
    pending.scheduled = false;
    if (pending.running || pending.waiters.length === 0) return;

    const value = pending.value;
    const waiters = pending.waiters.splice(0);
    pending.running = true;
    void persistValue(name, value)
      .catch((error) => {
        try {
          if (typeof localStorage !== "undefined") localStorage.setItem(name, value);
        } catch (fallbackError) {
          waiters.forEach((waiter) => waiter.reject(fallbackError ?? error));
          return false;
        }
        return true;
      })
      .then((saved) => {
        if (saved !== false) waiters.forEach((waiter) => waiter.resolve());
      })
      .finally(() => {
        pending.running = false;
        if (pending.waiters.length > 0) {
          // Writes received during the transaction are represented by only the
          // newest string. Every caller resolves once that newest state lands.
          schedulePersistedWrite(name, pending);
        } else if (!pending.scheduled) {
          pendingWrites.delete(name);
        }
      });
  }, 0);
}

/** Keep at most one in-flight and one pending serialized Zustand save. */
function queuePersistedWrite(name: string, value: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const pending = pendingWrites.get(name) ?? {
      value,
      waiters: [],
      scheduled: false,
      running: false,
    };
    pending.value = value;
    pending.waiters.push({ resolve, reject });
    pendingWrites.set(name, pending);
    schedulePersistedWrite(name, pending);
  });
}

function readLegacyValue(name: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

function removeLegacyValue(name: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(name);
  } catch {
    // IndexedDB remains authoritative even if storage access is restricted.
  }
}

/**
 * Persist the main save in IndexedDB, which has a much larger quota than
 * localStorage. Existing v5 localStorage saves migrate on first read without
 * changing their serialized Zustand format or losing progress.
 */
export const gameStateStorage: StateStorage = {
  getItem: async (name) => {
    let indexedValue: string | null = null;
    try {
      indexedValue = await readIndexedValue(name);
    } catch {
      // Some privacy modes expose IndexedDB but reject database operations.
    }
    if (indexedValue !== null) {
      removeLegacyValue(name);
      return indexedValue;
    }

    const legacyKeys = [
      name,
      "ipl-simulator-save-v5",
      "ipl-simulator-save-v4",
      "ipl-simulator-save-v3",
      "ipl-simulator-save-v2",
      "ipl-simulator-save",
    ];
    for (const key of legacyKeys) {
      const legacyValue = readLegacyValue(key);
      if (legacyValue !== null) {
        try {
          if (await writeIndexedValue(name, legacyValue)) {
            removeLegacyValue(key);
          }
        } catch {
          // Keep the original localStorage value when migration is unavailable.
        }
        return legacyValue;
      }
    }
    return null;
  },

  setItem: async (name, value) => {
    await queuePersistedWrite(name, value);
  },

  removeItem: async (name) => {
    try {
      await deleteIndexedValue(name);
    } catch {
      // Still remove the legacy copy below.
    }
    removeLegacyValue(name);
  },
};

/**
 * Zustand's createJSONStorage serializes the complete career synchronously for
 * every state update. Defer and coalesce that work so rapid simulation updates
 * paint first, while retaining exactly the same persisted JSON representation.
 */
export const gameStatePersistStorage: PersistStorage<unknown> = {
  getItem: async (name) => {
    const serialized = await gameStateStorage.getItem(name);
    return serialized === null ? null : JSON.parse(serialized) as StorageValue<unknown>;
  },
  setItem: (name, value) => new Promise<void>((resolve, reject) => {
    const pending = pendingObjectWrites.get(name) ?? { value, waiters: [], scheduled: false, running: false };
    pending.value = value;
    pending.waiters.push({ resolve, reject });
    pendingObjectWrites.set(name, pending);
    scheduleObjectWrite(name, pending);
  }),
  removeItem: (name) => gameStateStorage.removeItem?.(name) ?? Promise.resolve(),
};
