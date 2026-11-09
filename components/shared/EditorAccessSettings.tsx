"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { enableEditor, lockEditor, unlockEditor, useEditorAccess } from "@/lib/store/editorAccessStore";
import { setDeveloperToolsEnabled } from "@/lib/logic/developerTools";

export default function EditorAccessSettings() {
  const { enabled, configured, granted } = useEditorAccess();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [developerUnlocked, setDeveloperUnlocked] = useState(false);
  const [developerEnabled, setDeveloperEnabled] = useState(false);
  const [developerPanelOpen, setDeveloperPanelOpen] = useState(false);
  useEffect(() => {
    try {
      const unlocked = sessionStorage.getItem("ipl-developer-tools-unlocked") === "1";
      setDeveloperUnlocked(unlocked);
      setDeveloperEnabled(unlocked && sessionStorage.getItem("ipl-developer-tools-enabled") === "1");
    } catch { /* Developer tools remain available for this session. */ }
  }, []);
  const submit = async () => {
    if (busy) return;
    if (password === "AshwinEditor") {
      setPassword("");
      setError("");
      setDeveloperUnlocked(true);
      setDeveloperEnabled(true);
      setDeveloperPanelOpen(true);
      try {
        sessionStorage.setItem("ipl-developer-tools-unlocked", "1");
      } catch { /* Continue without session persistence. */ }
      setDeveloperToolsEnabled(true);
      return;
    }
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
      {(!granted || !developerUnlocked) && (
        <div className="relative">
        <input id="editor-password" aria-label="Editor password" type={showPassword ? "text" : "password"} value={password} maxLength={256}
          onChange={(event) => setPassword(event.target.value)} autoComplete="off" spellCheck={false}
          placeholder="Editor password" disabled={busy}
          className="w-full rounded border border-border bg-bg py-2 pl-2 pr-8 text-[10px] text-text-primary focus:border-accent focus:outline-none" />
        <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 flex items-center px-2 text-text-secondary hover:text-text-primary">{showPassword ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
        </div>
      )}
      <button type="submit" disabled={busy || (password !== "AshwinEditor" && (!configured || (!granted && !password)))}
        className="rounded border border-border bg-bg px-2 py-2 text-[9px] font-bold uppercase text-text-primary hover:border-accent disabled:opacity-40">
        {busy ? "Please wait…" : password === "AshwinEditor" ? "Open developer tools" : enabled ? "Turn editor off" : granted ? "Turn editor on" : "Unlock editor"}
      </button>
      {!configured && <p className="text-[9px] text-text-secondary">Editor access is not configured on this server.</p>}
      {granted && <p className="text-[9px] text-text-secondary">Editor unlocked for this browser. Toggle it on or off anytime.</p>}
      {developerUnlocked && <div className="flex flex-col gap-1 border-t border-border pt-2">
        <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider"><span>Developer tools</span><span className={developerEnabled ? "text-accent" : "text-text-secondary"}>{developerEnabled ? "On" : "Off"}</span></div>
        <button type="button" aria-pressed={developerEnabled} onClick={() => {
          const next = !developerEnabled;
          setDeveloperEnabled(next);
          if (!next) setDeveloperPanelOpen(false);
          setDeveloperToolsEnabled(next);
        }} className="rounded border border-border bg-bg px-2 py-2 text-[9px] font-bold uppercase text-text-primary hover:border-accent">Turn developer tools {developerEnabled ? "off" : "on"}</button>
        {developerEnabled && <button type="button" onClick={() => setDeveloperPanelOpen(true)} className="rounded border border-border bg-bg px-2 py-2 text-[9px] font-bold uppercase text-text-primary hover:border-accent">Open developer tools</button>}
      </div>}
      {error && <p role="alert" className="text-[9px] text-red-500">{error}</p>}
      {developerEnabled && developerPanelOpen && typeof document !== "undefined" && createPortal(<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4" onClick={() => setDeveloperPanelOpen(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="developer-tools-title" className="w-full max-w-md rounded-lg border-2 border-border bg-surface p-5 text-text-primary shadow-xl" onClick={event => event.stopPropagation()}>
          <div className="flex items-center justify-between gap-4"><h2 id="developer-tools-title" className="font-anton text-xl uppercase">Developer tools</h2><button type="button" onClick={() => setDeveloperPanelOpen(false)} className="rounded border border-border px-2 py-1 text-xs" aria-label="Close developer tools">Close</button></div>
          <p className="mt-3 text-sm text-text-secondary">Developer tools are enabled. New tools can be added here as the game develops.</p>
        </section>
      </div>, document.body)}
    </form>
  );
}
