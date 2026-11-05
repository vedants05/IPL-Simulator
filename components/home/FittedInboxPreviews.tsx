"use client";

import { Children, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Show only complete cards, then share any spare height between those cards. */
export default function FittedInboxPreviews({ children }: { children: ReactNode }) {
  const listRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [count, setCount] = useState(1);
  const cards = Children.toArray(children);

  useLayoutEffect(() => {
    const list = listRef.current;
    const measure = measureRef.current;
    if (!list || !measure) return;
    const fit = () => {
      if (!list.clientWidth || !list.clientHeight) return;
      setWidth(list.clientWidth);
      const style = getComputedStyle(list);
      const available = list.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const gap = parseFloat(style.rowGap) || 0;
      let used = 0;
      let visible = 0;
      for (const card of Array.from(measure.children)) {
        const height = (card as HTMLElement).offsetHeight + 1;
        const needed = height + (visible ? gap : 0);
        if (used + needed > available) break;
        used += needed;
        visible += 1;
      }
      setCount(Math.max(1, visible));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(list);
    Array.from(measure.children).forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [children, width]);

  return (
    <div ref={listRef} className="grid min-h-0 min-w-0 flex-1 gap-2 overflow-hidden py-3" style={{ gridTemplateRows: `repeat(${Math.min(count, cards.length)}, minmax(min-content, 1fr))` }}>
      {cards.slice(0, count)}
      <div ref={measureRef} aria-hidden="true" className="invisible pointer-events-none fixed left-0 top-0 h-0 overflow-hidden" style={{ width }}>
        {cards}
      </div>
    </div>
  );
}
