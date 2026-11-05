"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { BattingTargetMode, BattingTargets, FloaterRule } from "@/lib/logic/tacticalMatchPlan";

const modeLabels: Record<BattingTargetMode, string> = {
  attack: "Attack", "all-out": "All-out", "keep-strike": "Keep strike",
  rotate: "Rotate strike", boundaries: "Deal in boundaries", "see-off": "See it off",
};

function RuleMarker({ preview, heading, description, playerName }: {
  preview: string; heading: string; description: string; playerName: string;
}) {
  const id = useId();
  const [anchor, setAnchor] = useState<CSSProperties | null>(null);
  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [anchor]);
  const show = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const width = Math.min(240, window.innerWidth - 16);
    const above = rect.top > 180 || rect.top > window.innerHeight - rect.bottom;
    setAnchor({
      width,
      left: Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8)),
      maxHeight: Math.max(0, above ? rect.top - 14 : window.innerHeight - rect.bottom - 14),
      ...(above ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    });
  };
  return <>
    <button type="button" aria-label={`${heading} for ${playerName}`}
      aria-describedby={anchor ? id : undefined}
      onMouseEnter={event => show(event.currentTarget)} onMouseLeave={() => setAnchor(null)}
      onFocus={event => show(event.currentTarget)} onBlur={() => setAnchor(null)}
      onClick={event => show(event.currentTarget)}
      onKeyDown={event => { if (event.key === "Escape") setAnchor(null); }}
      className="flex h-3.5 w-[18px] shrink-0 cursor-help items-center justify-center rounded-sm border border-emerald-500/50 bg-emerald-500/15 font-barlow-condensed text-[8px] font-bold leading-none text-[color:color-mix(in_srgb,#10b981_55%,var(--ink))] focus-visible:outline focus-visible:outline-emerald-500">
      {preview}
    </button>
    {anchor && createPortal(<div id={id} role="tooltip" style={anchor}
      className="pointer-events-none fixed z-[110] overflow-hidden rounded-lg border border-emerald-500/50 bg-surface text-text-primary shadow-xl">
      <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
        <div className="font-barlow-condensed text-sm font-bold">{heading}</div>
        <div className="text-[10px] leading-tight text-text-secondary">{playerName}</div>
      </div>
      <p className="px-3 py-2 text-xs leading-snug">{description}</p>
    </div>, document.body)}
  </>;
}

export default function BattingRuleMarkers({ playerId, playerName, floaters, targets }: {
  playerId: string; playerName: string; floaters: readonly FloaterRule[]; targets?: BattingTargets;
}) {
  const floatRule = floaters.find(rule => rule.playerId === playerId);
  const trigger = floatRule?.trigger === "wickets" ? ` with ${floatRule.wickets ?? 3}+ wickets down`
    : floatRule?.trigger === "required-rate" ? ` when the required rate reaches ${floatRule.requiredRate}+ RPO`
    : floatRule?.trigger === "spin" ? " against spin"
    : floatRule?.trigger === "pace" ? " against pace" : " against any bowling";
  return <div className="flex min-w-[60px] flex-nowrap items-center gap-px px-0.5" aria-label={`Rules for ${playerName}`}>
    {floatRule && <RuleMarker preview="Fltr" heading="Floater" playerName={playerName}
      description={`Promote at the next eligible wicket into No. ${floatRule.earliestPosition}–${floatRule.latestPosition}, during overs ${floatRule.fromOver}–${floatRule.untilOver ?? 20}${trigger}. Otherwise bats in the usual slot.${floatRule.protectCollapse ? " No promotion with 3+ wickets down in the first 8 overs." : ""}`} />}
    {(["spin", "pace"] as const).map(type => {
      const rule = targets?.[type];
      if (!rule?.modes.length) return null;
      return <RuleMarker key={type} preview={type === "spin" ? "SPN" : "PCE"}
        heading={type === "spin" ? "Target spin" : "Target pace"} playerName={playerName}
        description={`${rule.modes.map(mode => modeLabels[mode]).join(" · ")}. Against ${type} during overs ${rule.fromOver}–${rule.untilOver}.`} />;
    })}
  </div>;
}
