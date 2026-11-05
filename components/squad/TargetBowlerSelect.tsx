"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Player } from "@/lib/types";
import { assessBowlerMatchup, type MatchupGrade } from "@/lib/logic/oppositionBowlerMatchup";

const gradeColor: Record<MatchupGrade, string> = { "!!": "text-red-500", "!": "text-orange-500", "-": "text-text-secondary", "+": "text-lime-600 dark:text-lime-400", "++": "text-emerald-500" };
const briefReason = (reason?: string) => {
  if (!reason) return "Even matchup";
  if (reason.includes("weakness against")) return reason.includes("spin") ? "Weak vs spin" : "Weak vs pace";
  if (reason.includes("strong against")) return reason.includes("spin") ? "Strong vs spin" : "Strong vs pace";
  if (reason.includes("quality")) return reason.startsWith("Bowling") ? "Quality edge" : "Quality risk";
  if (reason.includes("run control")) return reason.startsWith("Reliable") ? "Good control" : "Control risk";
  if (reason.includes("turns away")) return "Turns away";
  if (reason.includes("turns into")) return "Turns into bat";
  if (reason.includes("exposure")) return reason.startsWith("Good") ? "Phase fit" : "Phase mismatch";
  if (reason.includes("Consistent")) return "Consistent";
  if (reason.includes("inconsistent")) return "Inconsistent";
  if (reason.includes("pressure")) return reason.startsWith("Handles") ? "Handles pressure" : "Pressure risk";
  if (reason.includes("Part-time")) return "Part-time risk";
  if (reason.includes("angle")) return "New-ball angle";
  return reason.startsWith("Better") ? "Type advantage" : "Type mismatch";
};

export default function TargetBowlerSelect({ batter, position, bowlers, value, onChange }: {
  batter: Player; position: number; bowlers: Player[]; value?: string;
  onChange: (id: string | null) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const [anchor, setAnchor] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const [focus, setFocus] = useState(0);
  const ranked = useMemo(() => bowlers.map(bowler => assessBowlerMatchup(bowler, batter, position)).sort((a, b) => b.score - a.score || a.bowler.name.localeCompare(b.bowler.name)), [bowlers, batter, position]);
  const shortName = (bowler: Player) => {
    const parts = bowler.name.trim().split(/\s+/);
    const surname = parts[parts.length - 1];
    const shared = bowlers.some(other => other.id !== bowler.id && other.name.trim().split(/\s+/).pop()?.toLowerCase() === surname.toLowerCase());
    return shared && parts.length > 1 ? `${parts[0][0]}. ${surname}` : surname;
  };
  const selected = ranked.find(item => item.bowler.id === value);
  const close = () => { setAnchor(null); trigger.current?.focus(); };
  const open = () => {
    const rect = trigger.current!.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 258));
    setAnchor(window.innerHeight - rect.bottom >= 280 ? { left, top: rect.bottom + 4 } : { left, bottom: window.innerHeight - rect.top + 4 });
    setFocus(Math.max(0, ranked.findIndex(item => item.bowler.id === value) + 1));
  };
  useEffect(() => {
    if (!anchor) return;
    const dismiss = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setAnchor(null);
    };
    const reposition = (event: Event) => { if (event.type === "resize" || !(event.target instanceof Node) || !menu.current?.contains(event.target)) setAnchor(null); };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => { document.removeEventListener("pointerdown", dismiss); window.removeEventListener("resize", reposition); window.removeEventListener("scroll", reposition, true); };
  }, [anchor]);
  useEffect(() => { if (anchor) options.current[focus]?.focus({ preventScroll: true }); }, [anchor, focus]);
  return <>
    <button ref={trigger} type="button" role="combobox" title={selected?.bowler.name ?? "Auto — captain chooses"} aria-label={`Target bowler against ${batter.name}`} aria-expanded={Boolean(anchor)} aria-controls={anchor ? id : undefined} aria-haspopup="listbox"
      onClick={() => anchor ? close() : open()} onKeyDown={event => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); open(); } }}
      className="flex w-full min-w-0 items-center gap-1 rounded-sm border border-border px-1 py-0.5 text-left text-[10px] leading-tight hover:border-accent focus-visible:outline focus-visible:outline-accent">
      <span className="min-w-0 flex-1 truncate">{selected ? shortName(selected.bowler) : "Auto"}</span>{selected && <span className={`font-space-mono font-bold ${gradeColor[selected.grade]}`}>{selected.grade}</span>}<span aria-hidden="true" className="text-text-secondary">▾</span>
    </button>
    {anchor && createPortal(<div ref={menu} style={{ ...anchor, width: "min(250px, calc(100vw - 16px))", maxHeight: Math.min(320, window.innerHeight - (anchor.top ?? anchor.bottom ?? 0) - 8) }} className="fixed z-[120] flex flex-col overflow-hidden rounded-md border border-border bg-surface text-text-primary shadow-2xl">
      <div className="shrink-0 border-b border-border px-2 py-1"><div className="text-[11px] font-semibold">{batter.name} · Matchup</div><div className="text-[9px] text-text-secondary">!! Poor → − Neutral → ++ Strong</div></div>
      <div id={id} role="listbox" aria-label={`Available bowlers against ${batter.name}`} className="min-h-0 overflow-y-auto p-1" onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); close(); }
        if (event.key === "Tab") setAnchor(null);
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { event.preventDefault(); setFocus(event.key === "Home" ? 0 : event.key === "End" ? ranked.length : (focus + (event.key === "ArrowDown" ? 1 : -1) + ranked.length + 1) % (ranked.length + 1)); }
      }}>
        <button ref={element => { options.current[0] = element; }} role="option" aria-selected={!selected} tabIndex={focus === 0 ? 0 : -1} onClick={() => { onChange(null); close(); }} className="w-full rounded px-2 py-1 text-left text-[11px] hover:bg-accent/10 focus:bg-accent/10 focus:outline-none">Auto</button>
        {ranked.map((item, index) => <button key={item.bowler.id} ref={element => { options.current[index + 1] = element; }} role="option" aria-label={`${item.bowler.name}, ${item.grade}, ${briefReason(item.reasons[0])}`} title={item.bowler.name} aria-selected={value === item.bowler.id} tabIndex={focus === index + 1 ? 0 : -1} onClick={() => { onChange(item.bowler.id); close(); }} className="flex w-full items-center gap-1.5 rounded border-t border-border/30 px-2 py-1 text-left hover:bg-accent/10 focus:bg-accent/10 focus:outline-none">
          <span className={`w-4 shrink-0 font-space-mono text-[11px] font-bold ${gradeColor[item.grade]}`}>{item.grade}</span><span className="min-w-0 flex-1 text-[11px] font-semibold leading-tight">{shortName(item.bowler)}</span>
          <span className="shrink-0 text-[9px] text-text-secondary">{briefReason(item.reasons[0])}</span>
        </button>)}
        {!ranked.length && <p className="p-2 text-xs text-text-secondary">No fit bowlers in the projected bowling XI.</p>}
      </div>
    </div>, document.body)}
  </>;
}
