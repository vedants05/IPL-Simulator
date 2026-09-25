"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { formatPrice } from "@/lib/logic/auctionRules";
import { estimateAuctionValue, type ValueFactor } from "@/lib/logic/auctionValueEstimate";
import { useGameStore } from "@/lib/store/gameStore";
import type { AuctionState, Player, Team } from "@/lib/types";

interface Props {
  player: Player;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  auction: AuctionState | null;
}

const tone = (factor: ValueFactor) => factor.direction === "up" ? "text-emerald-600 dark:text-emerald-400" : factor.direction === "down" ? "text-rose-600 dark:text-rose-400" : "text-text-secondary";
const directionLabel = (factor: ValueFactor) => factor.direction === "up" ? "Raises value" : factor.direction === "down" ? "Reduces value" : "Neutral";
type DiagramBox = { x: number; y: number; halfWidth: number; halfHeight: number };
type DiagramPoint = { x: number; y: number };
type Connector = { x1: number; y1: number; x2: number; y2: number };

function overlap(a: DiagramBox, b: DiagramBox, gap: number): boolean {
  return Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth + gap
    && Math.abs(a.y - b.y) < a.halfHeight + b.halfHeight + gap;
}

export function layoutFactors(sizes: DiagramBox[], centre: DiagramBox, width: number, height: number, labels: string[]): Array<DiagramPoint | null> {
  const count = sizes.length;
  const byArea = sizes.map((_, index) => index).sort((a, b) => sizes[b].halfWidth * sizes[b].halfHeight - sizes[a].halfWidth * sizes[a].halfHeight);
  const bySector = sizes.map((_, index) => index);
  const orders = [byArea, ...Array.from({ length: count }, (_, shift) => [
    ...bySector.slice(shift), ...bySector.slice(0, shift),
  ]), ...Array.from({ length: count }, (_, shift) => [
    ...byArea.slice(shift), ...byArea.slice(0, shift),
  ])];
  let best: Array<DiagramPoint | null> = sizes.map(() => null);
  for (const gap of [5, 2, 0]) {
    for (const order of orders) {
      const placed: Array<DiagramBox | null> = sizes.map(() => null);
      const points: Array<DiagramPoint | null> = sizes.map(() => null);
      for (const index of order) {
        const size = sizes[index];
        const jitter = (labels[index].split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 13 - 6) * 0.015;
        const preferred = -Math.PI / 2 + index * 2 * Math.PI / count + jitter;
        let chosen: DiagramBox | null = null;
        let bestScore = Infinity;
        const minX = Math.ceil(size.halfWidth + 2);
        const maxX = Math.floor(width - size.halfWidth - 2);
        const minY = Math.ceil(size.halfHeight + 2);
        const maxY = Math.floor(height - size.halfHeight - 2);
        for (let y = minY; y <= maxY; y += 3) {
          for (let x = minX; x <= maxX; x += 3) {
            const candidate = { x, y, halfWidth: size.halfWidth, halfHeight: size.halfHeight };
            if (overlap(candidate, centre, 7) || placed.some((other) => other && overlap(candidate, other, gap))) continue;
            const dx = x - centre.x;
            const dy = y - centre.y;
            const angle = Math.atan2(dy, dx);
            const angleDifference = Math.abs(Math.atan2(Math.sin(angle - preferred), Math.cos(angle - preferred)));
            const radius = Math.hypot(dx / width, dy / height);
            const score = angleDifference * 70 + Math.abs(radius - 0.38) * 30;
            if (score < bestScore) { bestScore = score; chosen = candidate; }
          }
        }
        if (chosen) {
          placed[index] = chosen;
          points[index] = { x: chosen.x, y: chosen.y };
        }
      }
      if (points.filter(Boolean).length > best.filter(Boolean).length) best = points;
      if (best.every(Boolean)) return best;
    }
  }
  return best;
}

function edgeToward(from: DiagramBox, to: DiagramBox): DiagramPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const fraction = Math.min(dx === 0 ? Infinity : from.halfWidth / Math.abs(dx), dy === 0 ? Infinity : from.halfHeight / Math.abs(dy));
  return { x: from.x + dx * fraction, y: from.y + dy * fraction };
}

export function AuctionValueTile({ player, players, teams, auction }: Props) {
  const [expanded, setExpanded] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLButtonElement>(null);
  const factorRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [positions, setPositions] = useState<Array<DiagramPoint | null>>([]);
  const [connectors, setConnectors] = useState<Array<Connector | null>>([]);
  const currentSeason = useGameStore((state) => state.currentSeason);
  const activeInjury = useGameStore((state) => state.activeInjuries[player.id]);
  const estimate = useMemo(() => estimateAuctionValue(player, players, teams, auction, currentSeason, activeInjury), [player, players, teams, auction, currentSeason, activeInjury]);
  const half = Math.ceil(estimate.factors.length / 2);
  const left = estimate.factors.slice(0, half);
  const right = estimate.factors.slice(half);
  const [hovered, setHovered] = useState<number | null>(null);
  const diagramFactors = [...estimate.factors].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)).slice(0, 8);
  const factorKey = diagramFactors.map((factor) => `${factor.group}:${factor.brief}`).join("|");
  const hiddenCount = estimate.factors.length - positions.filter(Boolean).length;

  useLayoutEffect(() => {
    const container = diagramRef.current;
    const price = priceRef.current;
    if (!container || !price) return;
    const measure = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      const priceBox = { x: width / 2, y: height / 2, halfWidth: price.offsetWidth / 2, halfHeight: price.offsetHeight / 2 };
      const sizes = diagramFactors.map((_, index) => {
        const element = factorRefs.current[index];
        return { x: 0, y: 0, halfWidth: (element?.offsetWidth ?? 0) / 2, halfHeight: (element?.offsetHeight ?? 0) / 2 };
      });
      if (sizes.some((size) => !size.halfWidth || !size.halfHeight)) return;
      const nextPositions = layoutFactors(sizes, priceBox, width, height, diagramFactors.map((factor) => factor.group));
      setPositions(nextPositions);
      setConnectors(diagramFactors.map((_, index) => {
        const point = nextPositions[index];
        if (!point) return null;
        const factorBox = { ...sizes[index], ...point };
        const start = edgeToward(factorBox, priceBox);
        const end = edgeToward(priceBox, factorBox);
        const distance = Math.hypot(factorBox.x - priceBox.x, factorBox.y - priceBox.y) || 1;
        return {
          x1: start.x, y1: start.y,
          x2: end.x + (factorBox.x - priceBox.x) / distance * 4,
          y2: end.y + (factorBox.y - priceBox.y) / distance * 4,
        };
      }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(price);
    factorRefs.current.slice(0, diagramFactors.length).forEach((element) => { if (element) observer.observe(element); });
    measure();
    return () => observer.disconnect();
  }, [factorKey, estimate.low, estimate.high, player.basePrice]);

  return <>
    <section className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden rounded border border-border bg-bg p-1.5" aria-label="Auction value estimate">
      <button type="button" onClick={() => setExpanded(true)} className="flex items-center justify-between border-b border-border pb-0.5 text-left hover:text-accent" aria-label="Open auction value details">
        <h4 className="font-space-mono text-[10px] font-bold uppercase">Auction Value</h4>
        <span className="font-space-mono text-[7px] uppercase text-text-secondary">{hiddenCount > 0 ? `+${hiddenCount} more · ` : ""}Details ↗</span>
      </button>
      <div ref={diagramRef} className="relative min-h-0 flex-1 overflow-hidden rounded bg-gradient-to-b from-accent/5 via-transparent to-accent/5">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <marker id="auction-value-arrow-up" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#059669" /></marker>
            <marker id="auction-value-arrow-down" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#e11d48" /></marker>
            <marker id="auction-value-arrow-flat" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#64748b" /></marker>
          </defs>
          {diagramFactors.map((factor, index) => {
            const line = connectors[index];
            if (!line) return null;
            const color = factor.direction === "up" ? "#059669" : factor.direction === "down" ? "#e11d48" : "#64748b";
            return <line key={factor.group} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={color} strokeWidth={hovered === index ? 2.7 : 1.7} strokeOpacity={hovered == null || hovered === index ? 0.9 : 0.2} markerEnd={`url(#auction-value-arrow-${factor.direction})`} className="transition-all duration-200" />;
          })}
        </svg>
        {diagramFactors.map((factor, index) => <button ref={(element) => { factorRefs.current[index] = element; }} key={factor.group} type="button" onClick={() => setExpanded(true)} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(index)} onBlur={() => setHovered(null)} title={factor.reason} aria-label={`${factor.group}, ${directionLabel(factor)}. ${factor.reason}`} className={`absolute z-10 box-border flex w-max -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-lg border bg-surface px-1.5 py-1 text-center font-space-mono shadow-sm transition-colors ${tone(factor)} ${hovered === index ? "border-current bg-accent/10" : "border-border"}`} style={{ left: positions[index]?.x ?? 0, top: positions[index]?.y ?? 0, visibility: positions[index] ? "visible" : "hidden" }}>
          <span className="block whitespace-nowrap text-[8px] font-bold leading-[10px]">{factor.group}</span>
          <span className="block whitespace-nowrap text-[7px] leading-[9px] opacity-80">{factor.brief}</span>
        </button>)}
        <button ref={priceRef} type="button" onClick={() => setExpanded(true)} className="absolute left-1/2 top-1/2 z-20 flex min-h-[68px] w-[80px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-xl border-2 border-accent/60 bg-surface px-1 text-center shadow-[0_0_16px_rgba(0,0,0,0.12)] transition-transform hover:scale-105" aria-label={`Estimated auction range ${formatPrice(estimate.low)} to ${formatPrice(estimate.high)}. Open factors`}>
          <span className="font-space-mono text-[7px] font-bold uppercase leading-tight text-text-secondary">Est. range</span>
          <span className="block whitespace-nowrap font-anton text-[11px] leading-tight text-accent">{formatPrice(estimate.low)}</span>
          <span className="block font-space-mono text-[7px] leading-none text-text-secondary">to</span>
          <span className="block whitespace-nowrap font-anton text-[11px] leading-tight text-accent">{formatPrice(estimate.high)}</span>
          <span className="font-space-mono text-[7px] leading-tight text-text-secondary">Base {formatPrice(player.basePrice)}</span>
        </button>
      </div>
    </section>
    {expanded && createPortal(<div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4" onMouseDown={() => setExpanded(false)}>
      <section role="dialog" aria-modal="true" aria-label="Auction value factors" onMouseDown={(event) => event.stopPropagation()} className="flex max-h-[85vh] w-full max-w-[720px] flex-col rounded-lg border border-border bg-surface p-4 text-text-primary shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
          <div><h3 className="font-anton text-xl uppercase">{player.name} · Auction Value</h3><p className="font-space-mono text-xs text-text-secondary">Approximate range: <strong className="text-accent">{formatPrice(estimate.low)}–{formatPrice(estimate.high)}</strong> · Base price {formatPrice(player.basePrice)}</p></div>
          <button type="button" onClick={() => setExpanded(false)} aria-label="Close auction value details" className="rounded border border-border p-1 hover:text-accent"><X size={18} /></button>
        </div>
        <p className="py-2 font-space-mono text-[11px] text-text-secondary">Current batting or bowling ability sets the price tier. Public records, base price and current squad needs adjust the range. Previous sale prices are excluded. Actual bids depend on the teams and purses in the auction.</p>
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)] gap-2 overflow-y-auto">
          <div className="space-y-2">{left.map((factor) => <div key={factor.group} className="flex items-center gap-1 rounded border border-border bg-bg p-2 text-right">
            <div className="min-w-0 flex-1"><div className="flex flex-wrap justify-end gap-2"><h4 className="font-anton text-sm uppercase">{factor.group}</h4><span className={`font-space-mono text-[9px] font-bold uppercase ${tone(factor)}`}>{directionLabel(factor)}</span></div><p className="mt-1 font-space-mono text-[11px] leading-snug text-text-secondary">{factor.reason}</p></div><ArrowRight size={18} className={`shrink-0 ${tone(factor)}`} aria-hidden="true" />
          </div>)}</div>
          <div className="sticky top-0 flex h-fit flex-col items-center rounded border border-accent/40 bg-accent/5 p-2 text-center font-anton text-sm text-accent"><span>{formatPrice(estimate.low)}</span><span className="font-space-mono text-[9px] text-text-secondary">TO</span><span>{formatPrice(estimate.high)}</span></div>
          <div className="space-y-2">{right.map((factor) => <div key={factor.group} className="flex items-center gap-1 rounded border border-border bg-bg p-2">
            <ArrowLeft size={18} className={`shrink-0 ${tone(factor)}`} aria-hidden="true" /><div className="min-w-0"><div className="flex flex-wrap gap-2"><h4 className="font-anton text-sm uppercase">{factor.group}</h4><span className={`font-space-mono text-[9px] font-bold uppercase ${tone(factor)}`}>{directionLabel(factor)}</span></div><p className="mt-1 font-space-mono text-[11px] leading-snug text-text-secondary">{factor.reason}</p></div>
          </div>)}</div>
        </div>
      </section>
    </div>, document.body)}
  </>;
}
