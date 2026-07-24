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
    target: "auction-current-player",
    title: "Current player",
    text: "This card shows the player currently under the hammer. Check their role, nationality, base price and player details before deciding whether they fit your squad.",
  },
  {
    target: "auction-current-bid",
    title: "Current bid and countdown",
    text: "This panel shows the live price, the team currently leading and the time left. The countdown gives every franchise a short window to respond before the hammer falls.",
  },
  {
    target: "auction-bid-button",
    title: "Bid or pass",
    text: "Select Bid to raise the offer by the next valid increment—the exact amount is written on the button. Select Pass to skip this player and stop bidding on the current lot.",
  },
  {
    target: "auction-top-controls",
    title: "Auction controls",
    text: "Skip Set simulates the rest of the current set, while the other skip options can advance to the accelerated stage or finish the auction. Use the speed control to change the simulation pace, and Pause or Resume to stop or continue the live auction.",
  },
  {
    target: "auction-player-counts",
    title: "Sold, unsold and remaining",
    text: "These counters track the auction. Select any one to open its player list; remaining players can also be marked as automatic targets for skipped sets.",
  },
  {
    target: "auction-team-squads",
    title: "Franchise squads",
    text: "Follow every franchise's purse, squad size and RTM cards here. Select a team to expand its squad and see how your rivals are building their sides.",
  },
  {
    target: "auction-recent-sales",
    title: "Recent sales",
    text: "This log records completed sales, including each player, their winning franchise and final price. Select a sale to review more information about that auction result.",
  },
  {
    target: "auction-my-squad",
    title: "Your squad",
    text: "Your signings appear here. Use the role totals, overseas count, RTM cards and remaining purse to keep your squad balanced and within auction rules.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function getLogicalViewport() {
  const scale = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--app-scale"),
  ) || 1;

  return {
    scale,
    width: window.innerWidth / scale,
    height: window.innerHeight / scale,
  };
}

export default function AuctionGuidedTour({ onClose }: { onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = STEPS[stepIndex];

  useLayoutEffect(() => {
    const updateRect = () => {
      const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!element) {
        setRect(null);
        return;
      }
      const bounds = element.getBoundingClientRect();
      const viewport = getLogicalViewport();
      const left = Math.max(0, bounds.left / viewport.scale);
      const top = Math.max(0, bounds.top / viewport.scale);
      const right = Math.min(viewport.width, bounds.right / viewport.scale);
      const bottom = Math.min(viewport.height, bounds.bottom / viewport.scale);
      setRect({
        top,
        left,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      });
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

  if (!rect) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm border-2 border-[var(--ink)] bg-surface p-5 text-text-primary shadow-xl">
          <div className="font-anton text-xl uppercase">Auction tour unavailable</div>
          <p className="mt-2 font-barlow text-sm text-text-secondary">Start the live auction to view the guided screen tour.</p>
          <button onClick={onClose} className="mt-4 w-full bg-[var(--ink)] py-2 font-space-mono text-xs font-bold uppercase text-white">Close</button>
        </div>
      </div>
    );
  }

  const gap = 18;
  const viewport = getLogicalViewport();
  const cardWidth = Math.min(330, viewport.width - 32);
  const cardHeight = 210;
  const roomRight = viewport.width - (rect.left + rect.width);
  const roomLeft = rect.left;
  const placeRight = roomRight >= cardWidth + gap;
  const placeLeft = !placeRight && roomLeft >= cardWidth + gap;
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
  const blurPanel = "fixed bg-black/55 backdrop-blur-[4px]";

  return (
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true" aria-label="Auction screen tour">
      <div className={blurPanel} style={{ left: 0, top: 0, right: 0, height: rect.top }} />
      <div className={blurPanel} style={{ left: 0, top: rect.top, width: rect.left, height: rect.height }} />
      <div className={blurPanel} style={{ left: rect.left + rect.width, top: rect.top, right: 0, height: rect.height }} />
      <div className={blurPanel} style={{ left: 0, top: rect.top + rect.height, right: 0, bottom: 0 }} />

      <div
        className="pointer-events-none fixed rounded-[6px] border-[3px] border-white shadow-[0_0_0_2px_var(--team-accent),0_0_24px_rgba(255,255,255,.45)]"
        style={rect}
      />

      <div
        className="fixed flex min-h-[210px] flex-col border-2 border-[var(--ink)] bg-surface p-5 text-text-primary"
        style={{ left: cardLeft, top: cardTop, width: cardWidth, boxShadow: "6px 6px 0 var(--ink)" }}
      >
        <button onClick={onClose} className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded border border-[var(--ink)] hover:bg-danger hover:text-white" aria-label="Close tour">
          <X size={15} />
        </button>
        <div className="font-space-mono text-[9px] font-bold uppercase tracking-[.16em] text-text-secondary">Step {stepIndex + 1} of {STEPS.length}</div>
        <h2 className="mt-1 pr-8 font-anton text-[22px] uppercase leading-tight">{step.title}</h2>
        <p className="mt-2 flex-1 font-barlow text-[13px] leading-relaxed text-text-secondary">{step.text}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button disabled={stepIndex === 0} onClick={() => setStepIndex((value) => value - 1)} className="flex items-center gap-1 border border-[var(--ink)] px-3 py-1.5 font-space-mono text-[10px] font-bold uppercase disabled:opacity-30">
            <ArrowLeft size={12} /> Back
          </button>
          <div className="flex gap-1">
            {STEPS.map((_, index) => (
              <span
                key={index}
                className="h-2 w-2 rounded-full border border-[var(--ink)]"
                style={{ backgroundColor: index === stepIndex ? "var(--ink)" : "transparent" }}
              />
            ))}
          </div>
          <button onClick={() => stepIndex === STEPS.length - 1 ? onClose() : setStepIndex((value) => value + 1)} className="flex items-center gap-1 border border-[var(--ink)] bg-surface px-3 py-1.5 font-space-mono text-[10px] font-bold uppercase text-text-primary">
            {stepIndex === STEPS.length - 1 ? "Finish" : <>Next <ArrowRight size={12} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
