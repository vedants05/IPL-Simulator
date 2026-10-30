import type { InternationalCareerState } from "@/lib/logic/international";

const DB_NAME = "ipl-simulator-international";
const STORE_NAME = "careers";
let latest: { key: string; state: InternationalCareerState } | null = null;
const listeners = new Set<(key: string, state: InternationalCareerState) => void>();
export function subscribeInternationalCareer(listener: (key: string, state: InternationalCareerState) => void) {
  listeners.add(listener);
  if (latest) listener(latest.key, latest.state);
  return () => { listeners.delete(listener); };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadInternationalCareer(key: string): Promise<InternationalCareerState | null> {
  if (typeof indexedDB === "undefined") return null;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveInternationalCareer(key: string, state: InternationalCareerState): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(state, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  latest = { key, state };
  listeners.forEach(listener => listener(key, state));
}

