"use client";
import { useState } from "react";
import { enableEditor, lockEditor, unlockEditor, useEditorAccess } from "@/lib/store/editorAccessStore";

export default function EditorAccessSettings() {
  const { enabled, configured, granted } = useEditorAccess();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const enteredPassword = password;
    setPassword("");
    try {
      if (enabled) await lockEditor();
      else if (granted) await enableEditor();
      else await unlockEditor(enteredPassword);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not update editor access.");
    } finally { setBusy(false); }
  };

  return (
    <form className="flex flex-col gap-2 border-t border-border pt-2" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider">
        <span>In-game editor</span>
        <span className={enabled ? "text-accent" : "text-text-secondary"}>{enabled ? "On" : "Off"}</span>
      </div>
      {!granted && (
        <input id="editor-password" aria-label="Editor password" type="password" value={password} maxLength={256}
          onChange={(event) => setPassword(event.target.value)} autoComplete="off" spellCheck={false}
          placeholder="Editor password" disabled={busy}
          className="w-full rounded border border-border bg-bg px-2 py-2 text-[10px] text-text-primary focus:border-accent focus:outline-none" />
      )}
      <button type="submit" disabled={busy || !configured || (!granted && !password)}
        className="rounded border border-border bg-bg px-2 py-2 text-[9px] font-bold uppercase text-text-primary hover:border-accent disabled:opacity-40">
        {busy ? "Please wait…" : enabled ? "Turn editor off" : granted ? "Turn editor on" : "Unlock editor"}
      </button>
      {!configured && <p className="text-[9px] text-text-secondary">Editor access is not configured on this server.</p>}
      {granted && <p className="text-[9px] text-text-secondary">Editor unlocked for this browser. Toggle it on or off anytime.</p>}
      {error && <p role="alert" className="text-[9px] text-red-500">{error}</p>}
    </form>
  );
}
