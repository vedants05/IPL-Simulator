"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { listSaves, fetchSaveState, deleteSave, restoreSideStorage, isGuest, leaveGuestMode, PERSIST_KEY, type CloudSaveMeta } from "@/lib/supabase/cloudSaves";
import { gameStatePersistStorage, flushCloudSync } from "@/lib/storage/gameStateStorage";

export default function SavesPage() {
  const router = useRouter();
  const [saves, setSaves] = useState<CloudSaveMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const localSaveId = useGameStore((s) => s.saveId);
  const localTeam = useGameStore((s) => s.userTeamId);
  const localSeason = useGameStore((s) => s.currentSeason);
  const resetGame = useGameStore((s) => s.resetGame);

  const [guest, setGuest] = useState(false);
  useEffect(() => {
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

  const loadCloud = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const payload = await fetchSaveState(id);
      if (!payload) throw new Error("Save not found.");
      restoreSideStorage(payload.local_storage);
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

  const newGame = () => {
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
                  {save.game_date} · synced {new Date(save.updated_at).toLocaleString()}
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
