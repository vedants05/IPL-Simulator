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
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
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
