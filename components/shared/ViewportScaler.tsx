"use client";

import { useLayoutEffect, useState } from "react";

const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;

type ViewportMetrics = {
  scale: number;
  width: number;
  height: number;
};

const DEFAULT_METRICS: ViewportMetrics = {
  scale: 1,
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
};

function measureViewport(): ViewportMetrics {
  // visualViewport reports the pinch-zoomed visual area and can briefly drop
  // to a tiny value while dev tools, hot reload, or browser chrome resizes.
  // Scaling the layout from that transient value shrinks the whole game into
  // the top-left corner. innerWidth/innerHeight describe the stable CSS layout
  // viewport that the fixed app shell actually occupies.
  const viewportWidth = Number.isFinite(window.innerWidth) && window.innerWidth > 0
    ? window.innerWidth
    : DESIGN_WIDTH;
  const viewportHeight = Number.isFinite(window.innerHeight) && window.innerHeight > 0
    ? window.innerHeight
    : DESIGN_HEIGHT;
  // Preserve the authored information density on larger displays. Scaling is
  // only used to fit the minimum canvas into a smaller viewport.
  const scale = Math.max(
    0.1,
    Math.min(1, viewportWidth / DESIGN_WIDTH, viewportHeight / DESIGN_HEIGHT),
  );

  return {
    scale,
    width: viewportWidth / scale,
    height: viewportHeight / scale,
  };
}

export default function ViewportScaler({ children }: { children: React.ReactNode }) {
  const [metrics, setMetrics] = useState<ViewportMetrics>(DEFAULT_METRICS);

  useLayoutEffect(() => {
    let animationFrame = 0;

    const updateMetrics = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const next = measureViewport();
        document.documentElement.style.setProperty("--app-scale", String(next.scale));
        document.documentElement.style.setProperty("--app-inverse-scale", String(1 / next.scale));
        document.documentElement.style.setProperty("--app-viewport-width", `${next.width}px`);
        document.documentElement.style.setProperty("--app-viewport-height", `${next.height}px`);
        setMetrics(next);
      });
    };

    updateMetrics();
    window.addEventListener("resize", updateMetrics);
    window.visualViewport?.addEventListener("resize", updateMetrics);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updateMetrics);
      window.visualViewport?.removeEventListener("resize", updateMetrics);
    };
  }, []);

  return (
    <div className="app-viewport">
      <div
        className="app-canvas"
        style={{
          width: metrics.width,
          height: metrics.height,
          transform: `scale(${metrics.scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
