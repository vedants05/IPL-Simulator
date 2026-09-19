"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Cloud, CloudOff, LogOut, FolderOpen, RefreshCw } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getCloudSyncStatus, subscribeCloudSync, isGuest, leaveGuestMode, type CloudSyncStatus } from "@/lib/supabase/cloudSaves";
import { flushCloudSync } from "@/lib/storage/gameStateStorage";

const STATUS_LABEL: Record<CloudSyncStatus, string> = {
  idle: "Not synced yet",
  syncing: "Saving to cloud…",
  synced: "Saved to cloud",
  error: "Cloud save failed",
  offline: "Offline",
};

export default function CloudAccountPanel({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [username, setUsername] = useState<string>("");
  const [status, setStatus] = useState<CloudSyncStatus>(getCloudSyncStatus());
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    getSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      setUsername(data.user?.user_metadata?.username ?? data.user?.email ?? "");
      setGuest(!data.user && isGuest());
    });
    return subscribeCloudSync((next) => {
      setStatus(next);
      if (next === "synced") setLastSynced(new Date());
    });
  }, []);

  const saveNow = async () => {
    setBusy(true);
    try { await flushCloudSync(); } finally { setBusy(false); }
  };

  const signOut = async () => {
    setBusy(true);
    await flushCloudSync();
    leaveGuestMode();
    await getSupabaseBrowserClient().auth.signOut();
    onNavigate?.();
    router.replace("/login");
    router.refresh();
  };

  const rowClass = "w-full flex items-center justify-between px-3 py-1.5 rounded border border-[var(--ink)] hover:bg-[var(--ink)]/5 text-[10px] font-bold cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50";

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--ink)]/15 pt-2">
      <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">Account</span>
      <div className="text-[10px] truncate" title={username}>{guest ? "Guest" : username || "Signed out"}</div>
      <div className="flex items-center gap-1.5 text-[9px] text-text-secondary">
        {guest || status === "error" || status === "offline" ? <CloudOff size={11} /> : <Cloud size={11} className={status === "syncing" ? "animate-pulse" : ""} />}
        <span>{guest ? "Cloud saves off · this browser only" : `${STATUS_LABEL[status]}${lastSynced && status === "synced" ? ` · ${lastSynced.toLocaleTimeString()}` : ""}`}</span>
      </div>
      {guest ? (
        <button onClick={() => { onNavigate?.(); router.push("/login?switch=1"); }} className={rowClass}>
          <span className="flex items-center gap-1.5"><Cloud size={11} /> Sign in</span>
        </button>
      ) : (
        <button onClick={saveNow} disabled={busy} className={rowClass}>
          <span className="flex items-center gap-1.5"><RefreshCw size={11} className={busy ? "animate-spin" : ""} /> Save to cloud now</span>
        </button>
      )}
      <button onClick={() => { onNavigate?.(); router.push("/saves"); }} className={rowClass}>
        <span className="flex items-center gap-1.5"><FolderOpen size={11} /> My saves</span>
      </button>
      {!guest && (
        <button onClick={signOut} disabled={busy} className={rowClass}>
          <span className="flex items-center gap-1.5"><LogOut size={11} /> Sign out</span>
        </button>
      )}
    </div>
  );
}
