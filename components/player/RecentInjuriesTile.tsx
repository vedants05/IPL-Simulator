"use client";

import { useMemo } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import type { PlayerInjury } from "@/lib/logic/injuries";

const DAY_MS = 24 * 60 * 60 * 1000;

function injuryPosition(injury: PlayerInjury): { x: number; y: number } {
  const id = injury.conditionId.toLowerCase();
  if (id.includes("concussion")) return { x: 50, y: 18 };
  if (id.includes("shoulder")) return { x: 32, y: 48 };
  if (id.includes("finger") || id.includes("hand") || id.includes("wrist")) return { x: 18, y: 88 };
  if (id.includes("hamstring")) return { x: 40, y: 118 };
  if (id.includes("knee") || id.includes("acl")) return { x: 42, y: 143 };
  if (id.includes("calf")) return { x: 58, y: 157 };
  if (id.includes("ankle") || id.includes("achilles") || id.includes("foot")) return { x: 59, y: 177 };
  if (id.includes("back") || id.includes("spinal")) return { x: 54, y: 83 };
  if (id.includes("side")) return { x: 37, y: 75 };
  if (id.includes("stomach") || id.includes("gastro")) return { x: 50, y: 77 };
  if (id.includes("respiratory")) return { x: 50, y: 54 };
  if (id.includes("illness") || id.includes("viral")) return { x: 50, y: 46 };
  return { x: 50, y: 69 };
}

function daysOut(injury: PlayerInjury): number {
  const start = Date.parse(`${injury.startedOn}T00:00:00Z`);
  const end = Date.parse(`${injury.endedOn ?? injury.actualReturnDate}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(1, Math.round((end - start) / DAY_MS)) : 0;
}

export function RecentInjuriesTile({ playerId, currentDate }: { playerId: string; currentDate: string }) {
  const activeInjury = useGameStore((state) => state.activeInjuries[playerId]);
  const injuryHistory = useGameStore((state) => state.injuryHistory);
  const injuries = useMemo(() => {
    const cutoff = Date.parse(`${currentDate}T00:00:00Z`) - 365 * DAY_MS;
    const unique = new Map<string, PlayerInjury>();
    for (const injury of injuryHistory) {
      if (injury.playerId === playerId && Date.parse(`${injury.startedOn}T00:00:00Z`) >= cutoff) unique.set(injury.id, injury);
    }
    if (activeInjury) unique.set(activeInjury.id, activeInjury);
    return Array.from(unique.values()).sort((a, b) => b.startedOn.localeCompare(a.startedOn)).slice(0, 3);
  }, [activeInjury, currentDate, injuryHistory, playerId]);

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded border border-border bg-bg p-2.5" aria-label="Recent injuries">
      <h4 className="border-b border-border pb-1 font-space-mono text-[10px] font-bold uppercase text-text-primary">Recent Injuries</h4>
      <div className="flex min-h-0 flex-1 items-center justify-center py-2">
        <svg viewBox="0 0 100 190" className="h-full max-h-[340px] w-auto max-w-full" role="img" aria-label={injuries.length ? `Body diagram showing ${injuries.length} recent injuries` : "Body diagram with no recent injuries"}>
          <g fill="var(--surface)" stroke="var(--text-secondary)" strokeOpacity="0.65" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
            <circle cx="50" cy="17" r="12" />
            <path d="M44 28 L43 34 L31 39 L29 69 L35 97 L65 97 L71 69 L69 39 L57 34 L56 28 Z" />
            <path d="M31 40 L25 43 L18 72 L12 91 L18 94 L25 76 L34 52 Z" />
            <path d="M69 40 L75 43 L82 72 L88 91 L82 94 L75 76 L66 52 Z" />
            <path d="M35 97 L48 98 L47 136 L43 177 L34 177 L33 137 Z" />
            <path d="M65 97 L52 98 L53 136 L57 177 L66 177 L67 137 Z" />
            <path d="M34 177 L43 177 L45 184 L32 184 Z" />
            <path d="M57 177 L66 177 L68 184 L55 184 Z" />
          </g>
          {injuries.map((injury, index) => {
            const { x, y } = injuryPosition(injury);
            const color = injury.category === "minor" ? "#eab308" : "#ef4444";
            return <g key={injury.id} transform={`translate(${x + (index % 2 ? 3 : -3)}, ${y})`}>
              <circle r="9" fill={color} opacity="0.22" />
              <circle r="4.5" fill={color} stroke="var(--surface)" strokeWidth="1.5" />
            </g>;
          })}
        </svg>
      </div>
      {injuries.length ? (
        <div className="space-y-1.5 border-t border-border pt-2">
          {injuries.map((injury) => (
            <div key={injury.id} className="flex gap-1.5 font-space-mono text-[9px] leading-snug text-text-primary">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${injury.category === "minor" ? "bg-yellow-500" : "bg-red-500"}`} />
              <span className="min-w-0">
                <span className="block font-bold">{injury.conditionName}</span>
                <span className="block text-text-secondary">{daysOut(injury)} {daysOut(injury) === 1 ? "day" : "days"} {activeInjury?.id === injury.id ? "expected" : "out"}</span>
              </span>
            </div>
          ))}
        </div>
      ) : <p className="border-t border-border pt-2 text-center font-space-mono text-[9px] text-text-secondary">No injuries in the past year</p>}
    </section>
  );
}
