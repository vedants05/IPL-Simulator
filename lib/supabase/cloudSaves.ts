"use client";
import { getSupabaseBrowserClient } from "./browser";

export const PERSIST_KEY = "ipl-simulator-save-v5";

export interface CloudSaveMeta {
  id: string;
  name: string | null;
  user_team_id: string | null;
  current_season: number | null;
  game_date: string | null;
  updated_at: string;
}

/** The subset of persisted store state the saves row is indexed by. */
interface PersistedSaveSummary {
  saveId?: string;
  userTeamId?: string;
  currentSeason?: number;
  currentDate?: string;
  isSetupComplete?: boolean;
}

let cachedUserId: string | null | undefined;

/** Guest mode: play locally with no account. Middleware honours the cookie. */
export const GUEST_COOKIE = "ipl-guest";
export function enterGuestMode(): void {
  document.cookie = `${GUEST_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}
export function leaveGuestMode(): void {
  document.cookie = `${GUEST_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
export function isGuest(): boolean {
  return typeof document !== "undefined" && document.cookie.split(";").some((c) => c.trim().startsWith(`${GUEST_COOKIE}=1`));
}

/**
 * Side state the game keeps directly in localStorage, keyed per save/team:
 * stadium builder, career snapshots, SMAT career, season access, news pins and
 * caches. Everything under `ipl_` / `ipl-` except the main save and theme.
 */
const SIDE_KEY = /^ipl[_-]/;
const SIDE_KEY_EXCLUDE = /^ipl-simulator-save/;
export function snapshotSideStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof localStorage === "undefined") return out;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !SIDE_KEY.test(key) || SIDE_KEY_EXCLUDE.test(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) out[key] = value;
  }
  return out;
}
export function restoreSideStorage(entries: Record<string, string> | null | undefined): void {
  if (!entries || typeof localStorage === "undefined") return;
  // Clear stale side data first so a loaded save does not inherit another's.
  for (const key of Object.keys(snapshotSideStorage())) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(entries)) {
    try { localStorage.setItem(key, value); } catch { /* quota: main save still loads */ }
  }
}

/** Username availability via the `username_available` SQL function. */
export async function usernameAvailable(username: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("username_available", { candidate: username });
  if (error) {
    // Migration not applied yet: let sign-up proceed and rely on Supabase's
    // own duplicate-account error rather than blocking every sign-up.
    if (/username_available|schema cache/i.test(error.message)) {
      console.warn("username_available() missing. Run supabase/migrations/20260918120000_profiles_username_guest.sql.");
      return true;
    }
    throw error;
  }
  return Boolean(data);
}

export async function getCurrentUserId(): Promise<string | null> {
  if (cachedUserId !== undefined) return cachedUserId;
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();
  cachedUserId = data.user?.id ?? null;
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedUserId = session?.user?.id ?? null;
  });
  return cachedUserId;
}

/** Upsert the full persisted Zustand value (`{ state, version }`) for the signed-in user. */
export async function uploadSave(persisted: { state: unknown; version?: number }): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const summary = (persisted.state ?? {}) as PersistedSaveSummary;
  if (!summary.saveId || !summary.userTeamId) return;
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("saves").upsert({
    id: summary.saveId,
    user_id: userId,
    name: `${summary.userTeamId} · ${summary.currentSeason ?? ""}`.trim(),
    user_team_id: summary.userTeamId,
    current_season: summary.currentSeason ?? null,
    game_date: summary.currentDate ?? null,
    state: persisted,
    local_storage: snapshotSideStorage(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function listSaves(): Promise<CloudSaveMeta[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("saves")
    .select("id,name,user_team_id,current_season,game_date,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface CloudSavePayload { state: { state: unknown; version?: number }; local_storage: Record<string, string> | null }
export async function fetchSaveState(id: string): Promise<CloudSavePayload | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("saves").select("state,local_storage").eq("id", id).single();
  if (error) throw error;
  if (!data?.state) return null;
  return { state: data.state as CloudSavePayload["state"], local_storage: (data.local_storage as Record<string, string>) ?? null };
}

export async function deleteSave(id: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("saves").delete().eq("id", id);
  if (error) throw error;
}

export type CloudSyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";
type Listener = (status: CloudSyncStatus) => void;
const listeners = new Set<Listener>();
let currentStatus: CloudSyncStatus = "idle";

export function setCloudSyncStatus(status: CloudSyncStatus): void {
  currentStatus = status;
  listeners.forEach((listener) => listener(status));
}
export function getCloudSyncStatus(): CloudSyncStatus { return currentStatus; }
export function subscribeCloudSync(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
