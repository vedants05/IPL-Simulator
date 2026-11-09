"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function DeveloperTooltip() {
  const [tooltip, setTooltip] = useState<{ text: string; left: number; top: number; above: boolean } | null>(null);
  useEffect(() => {
    let active: HTMLElement | null = null;
    const show = (event: Event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-developer-tooltip]") : null;
      if (!target || target === active) return;
      const text = target.dataset.developerTooltip;
      if (!text) return;
      active = target;
      const rect = target.getBoundingClientRect();
      const above = rect.bottom + 180 > window.innerHeight && rect.top > 180;
      setTooltip({ text, left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)), top: above ? rect.top - 8 : rect.bottom + 8, above });
    };
    const hide = (event: Event) => {
      if (!active) return;
      const related = event instanceof MouseEvent || event instanceof FocusEvent ? event.relatedTarget : null;
      if (related instanceof Node && active.contains(related)) return;
      active = null;
      setTooltip(null);
    };
    const clear = () => { active = null; setTooltip(null); };
    document.addEventListener("pointerover", show);
    document.addEventListener("pointerout", hide);
    document.addEventListener("focusin", show);
    document.addEventListener("focusout", hide);
    window.addEventListener("scroll", clear, true);
    window.addEventListener("resize", clear);
    window.addEventListener("ipl-developer-tools-changed", clear);
    return () => {
      document.removeEventListener("pointerover", show);
      document.removeEventListener("pointerout", hide);
      document.removeEventListener("focusin", show);
      document.removeEventListener("focusout", hide);
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("resize", clear);
      window.removeEventListener("ipl-developer-tools-changed", clear);
    };
  }, []);
  if (!tooltip || typeof document === "undefined") return null;
  return createPortal(<div role="tooltip" className="pointer-events-none fixed z-[10000] w-max max-w-[320px] whitespace-pre-line rounded border border-accent bg-surface px-3 py-2 font-space-mono text-[11px] leading-relaxed text-text-primary shadow-xl" style={{ left: tooltip.left, top: tooltip.top, transform: tooltip.above ? "translateY(-100%)" : undefined }}>
    <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-accent">Developer details</div>{tooltip.text}
  </div>, document.body);
}
