"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";
import { formatDisplayDate } from "@/lib/logic/displayDate";
import HomeSettings from "@/components/home/HomeSettings";
import CareerPreview, { type HomeCareerPreview } from "@/components/home/CareerPreview";
import TeamBadge from "@/components/shared/TeamBadge";
import { careerSnapshotStorageKey, legacyCareerSnapshotStorageKey, parseCareerSnapshot } from "@/lib/logic/careerSnapshotStorage";
import type { GameState } from "@/lib/types";
import { PERSIST_KEY } from "@/lib/supabase/cloudSaves";
import { archiveActiveLocalSave, gameStatePersistStorage, listLocalSaves, loadLocalSave, readLocalSavePreview, type LocalSaveMeta } from "@/lib/storage/gameStateStorage";

export default function HomePage() {
  const router = useRouter();
  const teams = useGameStore((state) => state.teams);
  const [latest, setLatest] = useState<LocalSaveMeta | null>(null);
  const [preview, setPreview] = useState<HomeCareerPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tileClass = "block w-full border-2 border-border bg-surface px-6 py-5 text-left text-text-primary transition-colors hover:bg-surface2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text-primary";

  useEffect(() => {
    let active = true;
    const readSaves = async () => {
      try {
        const saves = await listLocalSaves();
        const persisted = await gameStatePersistStorage.getItem(PERSIST_KEY);
        const current = persisted?.state as { saveId?: string; userTeamId?: string; currentSeason?: number; currentDate?: string } | undefined;
        // Older careers may have an active record without a named local slot.
        const legacyActive = current?.saveId && current.userTeamId && !saves.some(save => save.id === current.saveId)
          ? { id: current.saveId, user_team_id: current.userTeamId, current_season: current.currentSeason ?? null, game_date: current.currentDate ?? null, updated_at: "", size_bytes: 0 }
          : null;
        const selected = legacyActive ?? saves.find(save => save.user_team_id) ?? null;
        if (active) setLatest(selected);
        if (selected) {
          try {
            const slot = await readLocalSavePreview(selected.id);
            const state = (current?.saveId === selected.id ? persisted?.state : slot?.state.state) as Partial<GameState> | undefined;
            const teamId = selected.user_team_id ?? "";
            const key = careerSnapshotStorageKey(selected.id, teamId);
            const legacyKey = legacyCareerSnapshotStorageKey(teamId);
            // The live scoped cache can be newer than the last archived mirror.
            const serialized = localStorage.getItem(key) ?? slot?.local_storage[key]
              ?? (current?.saveId === selected.id ? localStorage.getItem(legacyKey) : null)
              ?? slot?.local_storage[legacyKey];
            let snapshot: { season?: number; fixtures?: HomeCareerPreview["fixtures"]; standings?: HomeCareerPreview["standings"] } = {};
            try { if (serialized) snapshot = parseCareerSnapshot(serialized); } catch { /* Optional season preview must not block Continue. */ }
            const snapshotSeason = Number(snapshot.season ?? String(snapshot.fixtures?.[0]?.date ?? "").slice(0, 4));
            if (snapshotSeason !== selected.current_season) snapshot = {};
            const savedTeams = state?.teams ?? {};
            const phase = state?.auction?.phase;
            const seasonStarted = snapshot.fixtures?.some(match => match.played || (match.date && state?.currentDate && match.date <= state.currentDate));
            const seasonComplete = snapshot.fixtures?.length && snapshot.fixtures.every(match => match.played);
            const phaseLabel = phase === "retention" ? "Retentions" : phase === "live" ? "Auction in progress" : phase === "pre-auction" ? "Auction preparation" : seasonComplete ? "Season complete" : seasonStarted ? "Season" : "Pre-season";
            if (active) setPreview({ team: savedTeams[teamId], teams: savedTeams, phase: phaseLabel, fixtures: Array.isArray(snapshot.fixtures) ? snapshot.fixtures : [], standings: Array.isArray(snapshot.standings) ? snapshot.standings : [] });
          } catch { if (active) setPreview(null); }
        }
      } catch {
        if (active) setError("Your recent career could not be loaded. Open Load Career to choose a save.");
      } finally {
        if (active) setLoading(false);
      }
    };
    const onReady = () => {
      const state = useGameStore.getState();
      if (!state.isPaused) state.setPaused(true);
      if (state.careerFastForwardTargetDate) state.setCareerFastForwardTarget(null);
      void readSaves();
    };
    const unsubscribe = useGameStore.persist.onFinishHydration(onReady);
    if (useGameStore.persist.hasHydrated()) onReady();
    else void Promise.resolve(useGameStore.persist.rehydrate()).then(() => {
      if (active && !useGameStore.persist.hasHydrated()) {
        setLoading(false);
        setError("Your recent career could not be loaded.");
      }
    }).catch(() => {
      if (active) { setLoading(false); setError("Your recent career could not be loaded."); }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const continueCareer = async () => {
    if (!latest || opening) return;
    setOpening(true);
    setError(null);
    try {
      const activeId = useGameStore.getState().saveId;
      if (activeId !== latest.id) {
        if (activeId) await archiveActiveLocalSave();
        const loaded = await loadLocalSave(latest.id);
        if (!loaded) throw new Error("That career is no longer available. Choose another save from Load Career.");
        await useGameStore.persist.rehydrate();
      }
      router.push("/resume");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to continue this career.");
      setOpening(false);
    }
  };

  return (
    <div className="app-theme-shell min-h-screen bg-bg text-text-primary flex flex-col">
      <main className="app-theme-background relative flex-1 px-5 py-8 sm:px-8">
        <HomeSettings teamId={latest?.user_team_id ?? undefined} />
        <header className="mb-9 pr-12">
          <h1 className="font-anton text-5xl uppercase tracking-wide sm:text-6xl">IPL Manager</h1>
          <p className="mt-3 font-space-mono text-[10px] uppercase tracking-widest text-text-secondary">Build your team. Shape your legacy.</p>
        </header>
        <div className="grid max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-12">
        <div>
        <nav aria-label="Career" className="flex w-full max-w-sm flex-col gap-4">
          <Link href="/setup" className={tileClass}><span className="font-anton text-[24px] uppercase tracking-wide">Start Career</span></Link>
          <button type="button" aria-label="Continue Career" data-save-id={latest?.id} onClick={continueCareer} disabled={!latest || loading || opening} className={`${tileClass} disabled:cursor-not-allowed disabled:opacity-50`}>
            <span className="block font-anton text-[24px] uppercase tracking-wide">{opening ? "Opening Career..." : "Continue Career"}</span>
            <span className="mt-2 block font-space-mono text-[11px] uppercase leading-relaxed tracking-wide text-text-secondary">
              {loading ? "Loading recent save..." : latest ? <>
                <span className="mb-3 flex items-center gap-3 font-bold text-text-primary">{preview?.team && <TeamBadge team={preview.team} size="md" />}{preview?.team?.name ?? teams[latest.user_team_id ?? ""]?.name ?? latest.user_team_id}</span>
                <span className="mb-1 block">Manager: You</span>
                <span>{latest.current_season} Season{latest.game_date ? ` · ${formatDisplayDate(latest.game_date)}` : ""}</span>
                {preview && <span className="mt-1 block">{preview.phase}</span>}
              </> : "No saved career yet"}
            </span>
          </button>
          {!loading && latest && <p className="-mt-1 font-space-mono text-[10px] leading-relaxed text-text-secondary">{latest.updated_at && Number.isFinite(Date.parse(latest.updated_at)) ? <>Last saved on this device <time dateTime={latest.updated_at}>{new Date(latest.updated_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time></> : "Local career · Save time unavailable"}</p>}
          <Link href="/saves" className={tileClass}><span className="font-anton text-[24px] uppercase tracking-wide">Load Career</span></Link>
        </nav>
        {error && <p role="alert" className="mt-5 max-w-sm font-space-mono text-[11px] leading-relaxed text-danger">{error}</p>}
        </div>
        <CareerPreview preview={preview} loading={loading} hasSave={Boolean(latest)} />
        </div>
      </main>
    </div>
  );
}
