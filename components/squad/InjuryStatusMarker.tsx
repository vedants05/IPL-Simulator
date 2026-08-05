"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getInjuryReturnLabel, type PlayerInjury } from "@/lib/logic/injuries";

interface InjuryStatusMarkerProps {
  injury?: PlayerInjury;
}

export function InjuryStatusMarker({ injury }: InjuryStatusMarkerProps) {
  const markerRef = useRef<HTMLSpanElement | null>(null);
  const [popupPosition, setPopupPosition] = useState<{
    left: number;
    top: number;
    opensAbove: boolean;
  } | null>(null);

  if (!injury) return null;

  const isMajor = injury.category === "major";
  const returnLabel = getInjuryReturnLabel(injury);
  const riskLabel = injury.worseningRisk
    ? `${injury.worseningRisk[0].toUpperCase()}${injury.worseningRisk.slice(1)}`
    : "Mild";

  const showPopup = () => {
    const marker = markerRef.current;
    if (!marker || typeof window === "undefined") return;
    const bounds = marker.getBoundingClientRect();
    const popupWidth = 240;
    const pagePadding = 8;
    const opensAbove = bounds.top >= 150;
    setPopupPosition({
      left: Math.min(
        window.innerWidth - popupWidth - pagePadding,
        Math.max(pagePadding, bounds.left + bounds.width / 2 - popupWidth / 2),
      ),
      top: opensAbove ? bounds.top - 8 : bounds.bottom + 8,
      opensAbove,
    });
  };

  return (
    <>
      <span
        ref={markerRef}
        aria-label={`Injured: ${injury.conditionName}`}
        onMouseEnter={showPopup}
        onMouseLeave={() => setPopupPosition(null)}
        className={`inline-flex shrink-0 cursor-help items-center rounded-[2px] px-1.5 py-0.5 font-space-mono text-[7px] font-extrabold uppercase leading-none tracking-tight ${
          isMajor
            ? "bg-red-600 text-white ring-1 ring-inset ring-red-700/40"
            : "bg-amber-400 text-amber-950 ring-1 ring-inset ring-amber-600/40"
        }`}
      >
        Inj
      </span>

      {popupPosition && typeof document !== "undefined" && createPortal(
        <div
          role="tooltip"
          className={`pointer-events-none fixed z-[10000] w-60 overflow-hidden rounded-md border-2 bg-surface text-left shadow-2xl ${
            isMajor ? "border-red-600" : "border-amber-500"
          }`}
          style={{
            left: popupPosition.left,
            top: popupPosition.top,
            transform: popupPosition.opensAbove ? "translateY(-100%)" : undefined,
          }}
        >
          <div className={`flex items-center justify-between gap-3 px-3 py-2 ${
            isMajor ? "bg-red-600 text-white" : "bg-amber-400 text-amber-950"
          }`}>
            <span className="font-space-mono text-[8px] font-extrabold uppercase tracking-[0.14em]">
              Injury report
            </span>
            <span className="rounded-sm border border-current/30 px-1.5 py-0.5 font-space-mono text-[7px] font-bold uppercase">
              {injury.category}
            </span>
          </div>
          <div className="space-y-2 px-3 py-2.5 text-text-primary">
            <div className="font-barlow text-[13px] font-bold leading-tight">
              {injury.conditionName}
            </div>
            <div className="border-t border-border pt-2 font-space-mono text-[9px] leading-relaxed text-text-secondary">
              {returnLabel}
            </div>
            <div className={`rounded-sm px-2 py-1.5 font-space-mono text-[8px] font-bold uppercase leading-relaxed ${
              isMajor
                ? "bg-red-500/10 text-red-700 dark:text-red-300"
                : "bg-amber-500/10 text-amber-800 dark:text-amber-300"
            }`}>
              {isMajor ? "Unavailable for selection" : `${riskLabel} worsening risk if selected`}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
