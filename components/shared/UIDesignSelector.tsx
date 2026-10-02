"use client";

import { useEffect, useState } from "react";
import { Columns2, PanelsTopLeft, PanelLeft } from "lucide-react";
import { applyUIDesign, getStoredUIDesign, normalizeUIDesign, UI_DESIGN_CHANGED_EVENT, UI_DESIGN_STORAGE_KEY, UI_DESIGNS, type UIDesign } from "@/lib/theme/uiDesign";

export default function UIDesignSelector() {
  const [design, setDesign] = useState<UIDesign>("original");
  useEffect(() => {
    const sync = () => setDesign(normalizeUIDesign(document.documentElement.getAttribute("data-ui-design")));
    const storage = (event: StorageEvent) => {
      if (event.key === UI_DESIGN_STORAGE_KEY || event.key === null) {
        document.documentElement.setAttribute("data-ui-design", getStoredUIDesign());
        sync();
      }
    };
    sync();
    window.addEventListener(UI_DESIGN_CHANGED_EVENT, sync);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(UI_DESIGN_CHANGED_EVENT, sync);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return <div className="flex flex-col gap-2 border-t border-[var(--ink)]/15 pt-2">
    <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">UI design</span>
    <div className="grid grid-cols-3 overflow-hidden rounded border border-[var(--ink)]" role="radiogroup" aria-label="UI design">
      {UI_DESIGNS.map((option, index) => {
        const Icon = option === "original" ? PanelsTopLeft : option === "modern" ? Columns2 : PanelLeft;
        const selected = design === option;
        return <button key={option} type="button" role="radio" aria-checked={selected} tabIndex={selected ? 0 : -1}
          onClick={() => applyUIDesign(option)}
          onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
            const next = event.key === "Home" ? 0 : event.key === "End" ? UI_DESIGNS.length - 1 : (index + direction + UI_DESIGNS.length) % UI_DESIGNS.length;
            applyUIDesign(UI_DESIGNS[next]);
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
          }}
          className={`flex min-w-0 flex-col items-center justify-center gap-1 border-r border-[var(--ink)] px-1 py-2 font-space-mono text-[10px] font-bold uppercase last:border-r-0 ${selected ? "bg-[var(--ink)] text-[var(--surface)]" : "bg-surface text-text-secondary hover:bg-surface2"}`}>
          <Icon size={12} aria-hidden="true" />{option === "original" ? "Original" : option === "modern" ? "Modern" : "Sidebar"}
        </button>;
      })}
    </div>
  </div>;
}
