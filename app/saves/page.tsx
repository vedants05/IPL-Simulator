"use client";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/logic/displayDate";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { clearSideStorageForSave, listSaves, fetchSaveState, deleteSave, restoreSideStorage, isGuest, leaveGuestMode, PERSIST_KEY, type CloudSaveMeta } from "@/lib/supabase/cloudSaves";
import { archiveActiveLocalSave, deleteLocalSave, gameStatePersistStorage, flushCloudSync, listLocalSaves, loadLocalSave, type LocalSaveMeta } from "@/lib/storage/gameStateStorage";

function formatStorageSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "Size pending";
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(kilobytes >= 100 ? 0 : 1)} KB`;
  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(megabytes >= 100 ? 0 : 1)} MB`;
}

export default function SavesPage() {
  const router = useRouter();
  const [saves, setSaves] = useState<CloudSaveMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [localSaves, setLocalSaves] = useState<LocalSaveMeta[]>([]);
  const [browserStorage, setBrowserStorage] = useState<{ usage: number; quota: number } | "unavailable" | null>(null);
  const localSaveId = useGameStore((s) => s.saveId);
  const localTeam = useGameStore((s) => s.userTeamId);
  const localSeason = useGameStore((s) => s.currentSeason);
  const resetGame = useGameStore((s) => s.resetGame);

  const [guest, setGuest] = useState(false);
  const measuredSaves = saves?.filter((save) => save.size_bytes != null) ?? [];
  const totalCloudBytes = measuredSaves.reduce((total, save) => total + (save.size_bytes ?? 0), 0);
  const browserStoragePercent = browserStorage && browserStorage !== "unavailable" && browserStorage.quota > 0
    ? Math.min(100, (browserStorage.usage / browserStorage.quota) * 100)
    : 0;
  useEffect(() => {
    if (!navigator.storage?.estimate) {
      setBrowserStorage("unavailable");
      return;
    }
    navigator.storage.estimate()
      .then(({ usage, quota }) => {
        if (typeof usage !== "number" || typeof quota !== "number") setBrowserStorage("unavailable");
        else setBrowserStorage({ usage, quota });
      })
      .catch(() => setBrowserStorage("unavailable"));
  }, []);
  useEffect(() => {
    listLocalSaves().then(setLocalSaves).catch(() => setLocalSaves([]));
    getSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      const name = data.user?.user_metadata?.username ?? data.user?.email ?? "";
      setEmail(name);
      if (data.user) {
        listSaves().then(setSaves).catch((e) => setError(e.message));
        // A game started as a guest (or on another account's device) uploads now.
        if (useGameStore.getState().saveId) {
          useGameStore.setState({});
          setTimeout(() => { flushCloudSync().then(() => listSaves().then(setSaves)).catch(() => {}); }, 600);
        }
      }
      else { setGuest(isGuest()); setSaves([]); }
    });
  }, []);

  const continueLocal = () => router.push("/");

  const loadBrowserSave = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      if (localSaveId && localSaveId !== id) await archiveActiveLocalSave();
      const payload = await loadLocalSave(id);
      if (!payload) throw new Error("Browser save not found.");
      await useGameStore.persist.rehydrate();
      router.push("/");
    } catch (e: any) {
      setError(e?.message ?? "Failed to load browser save.");
      setBusyId(null);
    }
  };

  const removeBrowserSave = async (id: string) => {
    if (!window.confirm("Delete this browser save? This cannot be undone.")) return;
    await deleteLocalSave(id);
    setLocalSaves((current) => current.filter((save) => save.id !== id));
  };

  const loadCloud = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      if (localSaveId && localSaveId !== id) await archiveActiveLocalSave();
      const payload = await fetchSaveState(id);
      if (!payload) throw new Error("Save not found.");
      const state = (payload.state?.state ?? {}) as { saveId?: string; userTeamId?: string };
      restoreSideStorage(payload.local_storage, state.saveId, state.userTeamId);
      await gameStatePersistStorage.setItem(PERSIST_KEY, payload.state);
      await useGameStore.persist.rehydrate();
      router.push("/");
    } catch (e: any) {
      setError(e?.message ?? "Failed to load save.");
      setBusyId(null);
    }
  };

  const removeCloud = async (id: string) => {
    if (!window.confirm("Delete this cloud save? This cannot be undone.")) return;
    setBusyId(id);
    try {
      await deleteSave(id);
      setSaves((prev) => prev?.filter((s) => s.id !== id) ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete save.");
    } finally {
      setBusyId(null);
    }
  };

  const newGame = async () => {
    await archiveActiveLocalSave();
    clearSideStorageForSave(localSaveId, localTeam);
    resetGame();
    router.push("/setup");
  };

  const signOut = async () => {
    await flushCloudSync();
    leaveGuestMode();
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <div className="border-b-2 border-hairline px-8 py-5 flex items-center justify-between bg-surface">
        <span className="font-anton text-[28px] leading-none uppercase">Your saves</span>
        <div className="flex items-center gap-4 font-space-mono text-[11px] uppercase tracking-widest text-text-secondary">
          <span>{guest ? "Guest" : email}</span>
          <button onClick={signOut} className="underline underline-offset-4 hover:text-text-primary">{guest ? "Sign in" : "Sign out"}</button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-8 space-y-6">
        {error && <div className="font-space-mono text-[11px] border border-border/40 px-3 py-2">{error}</div>}

        {localSaveId && (
          <section className="border-2 border-border bg-surface p-5 flex items-center justify-between">
            <div>
              <div className="font-space-mono text-[10px] tracking-widest uppercase text-text-secondary">On this device</div>
              <div className="font-anton text-[24px] uppercase leading-none mt-1">{localTeam} · {localSeason}</div>
            </div>
            <button onClick={continueLocal} className="font-anton text-[16px] tracking-wide px-6 py-3 border-2 border-border hover:bg-surface2">
              Continue
            </button>
          </section>
        )}

        {guest && (
          <div className="font-space-mono text-[11px] text-text-secondary border border-border/40 px-3 py-2">
            You are playing as a guest. Progress stays in this browser only. Sign in any time and your current game uploads automatically.
          </div>
        )}

        {localSaves.filter((save) => save.id !== localSaveId).length > 0 && (
          <section className="space-y-2">
            <div className="font-space-mono text-[10px] tracking-widest uppercase text-text-secondary">Browser saves</div>
            {localSaves.filter((save) => save.id !== localSaveId).map((save) => (
              <div key={save.id} className="flex items-center justify-between gap-4 border-2 border-border bg-surface p-4">
                <div>
                  <div className="font-anton text-[20px] uppercase leading-none">{save.user_team_id} · {save.current_season}</div>
                  <div className="mt-1 font-space-mono text-[10px] text-text-secondary">{formatDisplayDate(save.game_date)} · {formatStorageSize(save.size_bytes)} · saved {formatDisplayDateTime(save.updated_at)}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => loadBrowserSave(save.id)} disabled={busyId !== null} className="border-2 border-border px-4 py-2 font-anton text-[14px] tracking-wide hover:bg-surface2 disabled:opacity-50">{busyId === save.id ? "…" : "Load"}</button>
                  <button onClick={() => removeBrowserSave(save.id)} disabled={busyId !== null} className="border-2 border-border/40 px-3 font-space-mono text-[10px] uppercase tracking-widest text-text-secondary hover:text-text-primary disabled:opacity-50">Delete</button>
                </div>
              </div>
            ))}
          </section>
        )}
        <section className={`grid gap-3 ${!guest && saves !== null ? "grid-cols-3" : "grid-cols-1"}`}>
          <div className="border-2 border-border bg-surface p-4">
            <div className="font-space-mono text-[9px] uppercase tracking-widest text-text-secondary">Browser storage</div>
            <div className="mt-1 font-anton text-[28px] uppercase leading-none">
              {browserStorage === null ? "Checking…" : browserStorage === "unavailable" ? "Unavailable" : formatStorageSize(browserStorage.usage)}
            </div>
            {browserStorage && browserStorage !== "unavailable" && (
              <>
                <div className="mt-2 h-1.5 overflow-hidden bg-border">
                  <div className="h-full bg-accent" style={{ width: `${browserStoragePercent}%` }} />
                </div>
                <div className="mt-2 font-space-mono text-[9px] text-text-secondary">
                  {formatStorageSize(Math.max(0, browserStorage.quota - browserStorage.usage))} available · {browserStoragePercent.toFixed(1)}% used
                </div>
              </>
            )}
            {browserStorage === "unavailable" && <div className="mt-2 font-space-mono text-[9px] text-text-secondary">This browser does not expose a storage estimate.</div>}
          </div>
          {!guest && saves !== null && <>
            <div className="border-2 border-border bg-surface p-4">
              <div className="font-space-mono text-[9px] uppercase tracking-widest text-text-secondary">Cloud storage used</div>
              <div className="mt-1 font-anton text-[28px] uppercase leading-none">{measuredSaves.length ? formatStorageSize(totalCloudBytes) : "Size pending"}</div>
              {measuredSaves.length !== saves.length && (
                <div className="mt-2 font-space-mono text-[9px] text-text-secondary">Some save sizes are pending metadata sync.</div>
              )}
            </div>
            <div className="border-2 border-border bg-surface p-4">
              <div className="font-space-mono text-[9px] uppercase tracking-widest text-text-secondary">Cloud careers</div>
              <div className="mt-1 font-anton text-[28px] uppercase leading-none">{saves.length}</div>
              <div className="mt-2 font-space-mono text-[9px] text-text-secondary">No save-count quota is currently enforced.</div>
            </div>
          </>}
        </section>
        <section className="space-y-2" hidden={guest}>
          <div className="font-space-mono text-[10px] tracking-widest uppercase text-text-secondary">Cloud saves</div>
          {saves === null && <div className="font-space-mono text-[11px] animate-pulse">Loading…</div>}
          {saves?.length === 0 && <div className="font-space-mono text-[11px] text-text-secondary">No cloud saves yet. Play for a bit and your game will sync automatically.</div>}
          {saves?.map((save) => (
            <div key={save.id} className="border-2 border-border bg-surface p-4 flex items-center justify-between gap-4">
              <div>
                <div className="font-anton text-[20px] uppercase leading-none">
                  {save.user_team_id} · {save.current_season}
                  {save.id === localSaveId && <span className="ml-3 font-space-mono text-[10px] text-text-secondary tracking-widest">ON THIS DEVICE</span>}
                </div>
                <div className="font-space-mono text-[10px] text-text-secondary mt-1">
                  {formatDisplayDate(save.game_date)} · {formatStorageSize(save.size_bytes)} · synced {formatDisplayDateTime(save.updated_at)}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadCloud(save.id)} disabled={busyId !== null}
                  className="font-anton text-[14px] tracking-wide px-4 py-2 border-2 border-border hover:bg-surface2 disabled:opacity-50"
                >
                  {busyId === save.id ? "…" : "Load"}
                </button>
                <button
                  onClick={() => removeCloud(save.id)} disabled={busyId !== null}
                  className="font-space-mono text-[10px] tracking-widest uppercase px-3 border-2 border-border/40 text-text-secondary hover:text-text-primary disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </section>

        <button onClick={newGame} className="w-full font-anton text-[18px] tracking-wide py-4 border-2 border-border bg-text-primary text-bg hover:brightness-110">
          New game
        </button>
      </div>
    </div>
  );
}
