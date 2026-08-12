"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

type TourStep = {
  target: string;
  title: string;
  text: string;
};

const STEPS: TourStep[] = [
  {
    target: "trade-your-players",
    title: "Choose what you will send",
    text: "Select up to three players from your squad. A player can only be traded once during the current window, so completed deals remove those players from this list.",
  },
  {
    target: "trade-target-players",
    title: "Choose a trade partner",
    text: "Pick the club you want to negotiate with. Its available squad will appear below, with a willingness label showing how open the club is to moving each player.",
  },
  {
    target: "trade-target-players",
    title: "Choose who you want",
    text: "Select up to three players to request. Reluctant players cost more in the hidden club valuation, while injuries, role needs, ability and potential also affect the deal.",
  },
  {
    target: "trade-balance",
    title: "Ask the club for help",
    text: "You do not need to build a complete deal manually. With only one side selected, this button finds an acceptable return or minimum asking price. With both sides selected, it tries to balance the package.",
  },
  {
    target: "trade-package",
    title: "Review the player swap",
    text: "The centre shows exactly who moves to each franchise. Use it to check the final package before you spend negotiation patience on a proposal.",
  },
  {
    target: "trade-patience",
    title: "Protect your patience",
    text: "Rejected proposals reduce that club's negotiation patience. At zero, the club walks away for seven in-game days before its patience fully recovers, so clear the requirement checks before submitting.",
  },
  {
    target: "trade-requirements",
    title: "Clear every requirement",
    text: "Both clubs must remain within squad, overseas and purse rules, and the target club must value your offer highly enough. Red rows explain exactly what is blocking the trade.",
  },
  {
    target: "trade-submit",
    title: "Submit and agree contracts",
    text: "Submit once both requirement panels are cleared. If an incoming player's salary changes, you will negotiate their contract before the trade is completed.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function getLogicalViewport() {
  const scale = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--app-scale"),
  ) || 1;
  return { scale, width: window.innerWidth / scale, height: window.innerHeight / scale };
}

export default function TradeHubGuidedTour({ onClose }: { onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = STEPS[stepIndex];

  useLayoutEffect(() => {
    const updateRect = () => {
      const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!element) return setRect(null);
      const bounds = element.getBoundingClientRect();
      const viewport = getLogicalViewport();
      const left = Math.max(0, bounds.left / viewport.scale);
      const top = Math.max(0, bounds.top / viewport.scale);
      const right = Math.min(viewport.width, bounds.right / viewport.scale);
      const bottom = Math.min(viewport.height, bounds.bottom / viewport.scale);
      setRect({ top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
    };
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [step.target]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setStepIndex((value) => Math.min(STEPS.length - 1, value + 1));
      if (event.key === "ArrowLeft") setStepIndex((value) => Math.max(0, value - 1));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!rect) return null;

  const gap = 18;
  const viewport = getLogicalViewport();
  const cardWidth = Math.min(350, viewport.width - 32);
  const cardHeight = 230;
  const roomRight = viewport.width - (rect.left + rect.width);
  const placeRight = roomRight >= cardWidth + gap;
  const placeLeft = !placeRight && rect.left >= cardWidth + gap;
  const cardLeft = placeRight
    ? rect.left + rect.width + gap
    : placeLeft
      ? rect.left - cardWidth - gap
      : Math.max(16, Math.min(viewport.width - cardWidth - 16, rect.left + rect.width / 2 - cardWidth / 2));
  const cardTop = placeRight || placeLeft
    ? Math.max(16, Math.min(viewport.height - cardHeight - 16, rect.top + rect.height / 2 - cardHeight / 2))
    : rect.top + rect.height + cardHeight + gap < viewport.height
      ? rect.top + rect.height + gap
      : Math.max(16, rect.top - cardHeight - gap);
  const shade = "fixed bg-black/55 backdrop-blur-[4px]";

  return (
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true" aria-label="Trade Hub guided tour">
      <div className={shade} style={{ left: 0, top: 0, right: 0, height: rect.top }} />
      <div className={shade} style={{ left: 0, top: rect.top, width: rect.left, height: rect.height }} />
      <div className={shade} style={{ left: rect.left + rect.width, top: rect.top, right: 0, height: rect.height }} />
      <div className={shade} style={{ left: 0, top: rect.top + rect.height, right: 0, bottom: 0 }} />
      <div className="pointer-events-none fixed rounded-[6px] border-[3px] border-white shadow-[0_0_0_2px_var(--team-accent),0_0_24px_rgba(255,255,255,.45)]" style={rect} />
      <div className="fixed flex min-h-[230px] flex-col border-2 border-[var(--ink)] bg-surface p-5 text-text-primary" style={{ left: cardLeft, top: cardTop, width: cardWidth, boxShadow: "6px 6px 0 var(--ink)" }}>
        <button type="button" onClick={onClose} className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded border border-[var(--ink)] hover:bg-danger hover:text-white" aria-label="Close tour"><X size={15} /></button>
        <div className="font-space-mono text-[9px] font-bold uppercase tracking-[.16em] text-text-secondary">Step {stepIndex + 1} of {STEPS.length}</div>
        <h2 className="mt-1 pr-8 font-anton text-[22px] uppercase leading-tight">{step.title}</h2>
        <p className="mt-2 flex-1 font-barlow text-[13px] leading-relaxed text-text-secondary">{step.text}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" disabled={stepIndex === 0} onClick={() => setStepIndex((value) => value - 1)} className="flex items-center gap-1 border border-[var(--ink)] px-3 py-1.5 font-space-mono text-[10px] font-bold uppercase disabled:opacity-30"><ArrowLeft size={12} /> Back</button>
          <div className="flex gap-1">{STEPS.map((_, index) => <span key={index} className="h-2 w-2 rounded-full border border-[var(--ink)]" style={{ backgroundColor: index === stepIndex ? "var(--ink)" : "transparent" }} />)}</div>
          <button type="button" onClick={() => stepIndex === STEPS.length - 1 ? onClose() : setStepIndex((value) => value + 1)} className="flex items-center gap-1 border border-[var(--ink)] bg-surface px-3 py-1.5 font-space-mono text-[10px] font-bold uppercase text-text-primary">{stepIndex === STEPS.length - 1 ? "Finish" : <>Next <ArrowRight size={12} /></>}</button>
        </div>
      </div>
    </div>
  );
}
