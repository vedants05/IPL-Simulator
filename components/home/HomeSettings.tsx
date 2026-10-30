"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Settings } from "lucide-react";
import ThemeSelector from "@/components/shared/ThemeSelector";
import UIDesignSelector from "@/components/shared/UIDesignSelector";
import { switchColorMode } from "@/components/shared/TeamThemeProvider";
import { getStoredAppearanceTheme, type AppearanceTheme } from "@/lib/theme/appearance";

export default function HomeSettings({ teamId }: { teamId?: string }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<AppearanceTheme>("light");
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => { setTheme(getStoredAppearanceTheme()); }, []);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector('[aria-modal="true"]')) return;
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);

  return (
    <div className="absolute right-5 top-5 z-50 sm:right-8">
      <button ref={button} type="button" title="Open Settings" aria-label="Open Settings" aria-expanded={open} aria-controls={open ? panelId : undefined}
        onClick={() => { if (!open) setTheme(getStoredAppearanceTheme()); setOpen(value => !value); }}
        className="relative z-50 flex h-7 w-7 items-center justify-center rounded border-[1.5px] border-[var(--ink)] bg-surface text-text-primary hover:bg-surface2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
        <Settings size={13} aria-hidden="true" />
      </button>
      {open && <>
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
        <div id={panelId} role="dialog" aria-label="Settings" className="absolute right-0 top-full z-50 mt-2 flex w-64 max-w-[calc(100vw-2.5rem)] flex-col gap-3 rounded border-2 border-[var(--ink)] bg-surface p-4 text-text-primary shadow-xl">
          <div className="border-b border-[var(--ink)]/15 pb-2 font-space-mono text-[10px] font-bold uppercase tracking-wider">Settings</div>
          <ThemeSelector value={theme} onChange={value => { setTheme(value); switchColorMode(value, teamId); }} />
          <UIDesignSelector />
        </div>
      </>}
    </div>
  );
}
