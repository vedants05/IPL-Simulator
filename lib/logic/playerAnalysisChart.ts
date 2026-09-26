import type { Role } from "../types";

export type ChartPoint = { id: string; name: string; x: number; y: number; lowerEndEligible?: boolean };

export function chartLowerEndRoleMatches(role: Role, metricGroups: string[]): boolean {
  const batting = metricGroups.some((group) => group.toLowerCase().includes("batting"));
  const bowling = metricGroups.some((group) => group.toLowerCase().includes("bowling"));
  return (!batting || role === "Batsman" || role === "WK-Batsman" || role === "All-Rounder")
    && (!bowling || role === "Pace Bowler" || role === "Spin Bowler" || role === "All-Rounder");
}
export type ChartLabel = { id: string; name: string; left: number; top: number; width: number; anchorX: number; anchorY: number; connectorX: number; connectorY: number };

function connectorTouchesCard(line: ChartLabel, card: ChartLabel): boolean {
  let enter = 0, leave = 1;
  for (const [start, delta, low, high] of [
    [line.anchorX, line.connectorX - line.anchorX, card.left - 2, card.left + card.width + 2],
    [line.anchorY, line.connectorY - line.anchorY, card.top - 2, card.top + 19],
  ]) {
    if (Math.abs(delta) < 1e-8) { if (start < low || start > high) return false; }
    else {
      const a = (low - start) / delta, b = (high - start) / delta;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
      if (enter > leave) return false;
    }
  }
  return true;
}

function connectorsCross(a: ChartLabel, b: ChartLabel): boolean {
  const ax = a.connectorX - a.anchorX, ay = a.connectorY - a.anchorY;
  const bx = b.connectorX - b.anchorX, by = b.connectorY - b.anchorY;
  const dx = b.anchorX - a.anchorX, dy = b.anchorY - a.anchorY;
  const cross = ax * by - ay * bx;
  if (Math.abs(cross) < 1e-8) {
    if (Math.abs(dx * ay - dy * ax) > 1e-8) return false;
    const length = ax * ax + ay * ay;
    if (length < 1e-8) return false;
    const start = (dx * ax + dy * ay) / length;
    const end = start + (bx * ax + by * ay) / length;
    return Math.min(1, Math.max(start, end)) - Math.max(0, Math.min(start, end)) > 1e-6;
  }
  const t = (dx * by - dy * bx) / cross, u = (dx * ay - dy * ax) / cross;
  // Players at the same plotted position may share a starting point.
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 && !(t < 1e-6 && u < 1e-6);
}

export function chartLabelsCollide(a: ChartLabel, b: ChartLabel): boolean {
  const cardsOverlap = a.left < b.left + b.width + 3 && a.left + a.width + 3 > b.left
    && a.top < b.top + 20 && a.top + 20 > b.top;
  return cardsOverlap || connectorTouchesCard(a, b) || connectorTouchesCard(b, a) || connectorsCross(a, b);
}

export function chartAxis(values: number[], tickCount = 5) {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
  const low = Math.min(...finite), high = Math.max(...finite);
  const spread = Math.max(high - low, Math.abs(high) * 0.08, 1);
  const roughStep = spread / Math.max(1, tickCount - 1);
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= roughStep) ?? 10 * power;
  const min = low >= 0 && low <= step ? 0 : Math.floor((low - step * 0.15) / step) * step;
  const max = Math.max(min + step, Math.ceil((high + step * 0.15) / step) * step);
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => Number((min + index * step).toFixed(8)));
  return { min, max, ticks };
}

export function chartLabelPlayers(points: ChartPoint[], selectedId: string, width: number, height: number): ChartPoint[] {
  const selected = points.find((point) => point.id === selectedId);
  const candidates: ChartPoint[] = [];
  const add = (point: ChartPoint | undefined) => { if (point && !candidates.some((entry) => entry.id === point.id)) candidates.push(point); };
  const closest = (x: number, y: number, pool = points) => [...pool].sort((a, b) =>
    Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)
    || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  )[0];
  add(selected);
  // Coordinates are already oriented with better values toward the top right.
  add(closest(0, height, points.filter((point) => point.lowerEndEligible !== false)));
  add(closest(width, 0));
  if (selected) {
    const neighbours = points.filter((point) => !candidates.some((entry) => entry.id === point.id)).sort((a, b) =>
      Math.hypot(a.x - selected.x, a.y - selected.y) - Math.hypot(b.x - selected.x, b.y - selected.y)
      || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    );
    neighbours.slice(0, 2).forEach(add);
  }
  return candidates;
}

export function chartLabels(points: ChartPoint[], selectedId: string, width: number, height: number, limit = 5, measuredWidths: Record<string, number> = {}): ChartLabel[] {
  if (width <= 0 || height <= 0 || points.length === 0) return [];
  const selected = points.find((point) => point.id === selectedId);
  const candidates = chartLabelPlayers(points, selectedId, width, height);
  const labels: ChartLabel[] = [];
  const labelHeight = 17;
  const nudges: number[][] = [];
  for (let x = -12; x <= 12; x += 2) for (let y = -12; y <= 12; y += 2) nudges.push([x, y]);
  nudges.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
  for (const point of candidates) {
    if (labels.length >= limit) break;
    const labelWidth = measuredWidths[point.id] ?? Math.ceil(Array.from(point.name).length * 4.8 + 10);
    // Keep names next to their dots and on their actual side of the selected player.
    // Use compact alternatives when the preferred side is crowded or near an edge.
    const horizontal = selected && point.id !== selectedId ? Math.sign(point.x - selected.x) : 0;
    const vertical = selected && point.id !== selectedId ? Math.sign(point.y - selected.y) : 0;
    const side = horizontal < 0 ? -labelWidth - 10 : 10;
    const above = vertical > 0 ? 10 : -labelHeight - 10;
    const offsets = [
      ...(point.id === selectedId ? [[-labelWidth / 2, -labelHeight - 18], [-labelWidth / 2, 18]] : []),
      [side, -labelHeight / 2],
      [-labelWidth / 2, above],
      [side, above],
      [-labelWidth / 2, vertical > 0 ? -labelHeight - 10 : 10],
      [horizontal < 0 ? 10 : -labelWidth - 10, -labelHeight / 2],
      ...[22, 34, 46].flatMap((gap) => [
        [horizontal < 0 ? -labelWidth - gap : gap, -labelHeight / 2],
        [-labelWidth / 2, vertical > 0 ? gap : -labelHeight - gap],
      ]),
    ];
    const labelAt = (left: number, top: number): ChartLabel => ({ id: point.id, name: point.name, left, top, width: labelWidth,
      anchorX: point.x, anchorY: point.y,
      connectorX: Math.max(left, Math.min(point.x, left + labelWidth)),
      connectorY: Math.max(top, Math.min(point.y, top + labelHeight)) });
    const blocksAnotherAnchor = (label: ChartLabel) => candidates.some((other) => {
      if (other.id === point.id || Math.hypot(other.x - point.x, other.y - point.y) < 1e-6) return false;
      const dx = label.connectorX - point.x, dy = label.connectorY - point.y;
      const fraction = Math.max(0, Math.min(1, ((other.x - point.x) * dx + (other.y - point.y) * dy) / Math.max(1e-8, dx * dx + dy * dy)));
      return Math.hypot(other.x - point.x - fraction * dx, other.y - point.y - fraction * dy) < 3;
    });
    for (const [dx, dy] of offsets.flatMap(([x, y]) => nudges.map(([nx, ny]) => [x + nx, y + ny]))) {
      const left = point.x + dx, top = point.y + dy;
      if (left < 2 || top < 2 || left + labelWidth > width - 2 || top + labelHeight > height - 2) continue;
      if (selected && point.id !== selectedId) {
        if (horizontal < 0 && left + labelWidth / 2 >= selected.x) continue;
        if (horizontal > 0 && left + labelWidth / 2 <= selected.x) continue;
        if (vertical < 0 && top + labelHeight / 2 >= selected.y) continue;
        if (vertical > 0 && top + labelHeight / 2 <= selected.y) continue;
      }
      if (points.some((other) => other.id !== point.id && other.x >= left - 6 && other.x <= left + labelWidth + 6 && other.y >= top - 6 && other.y <= top + labelHeight + 6)) continue;
      const candidate = labelAt(left, top);
      if (blocksAnotherAnchor(candidate)) continue;
      if (labels.some((label) => chartLabelsCollide(candidate, label))) continue;
      // Clamping to the rectangle gives the closest edge (or corner), so a line
      // never runs across the name to reach an arbitrary side of the bar.
      labels.push(candidate);
      break;
    }
    if (!labels.some((label) => label.id === point.id)) {
      // Dense point clouds can block every compact offset. Keep the chosen player
      // and find the closest available bar position instead of dropping their name.
      let best: { left: number; top: number; score: number } | undefined;
      for (let top = 2; top + labelHeight <= height - 2; top += 8) {
        for (let left = 2; left + labelWidth <= width - 2; left += 8) {
          const candidate = labelAt(left, top);
          if (blocksAnotherAnchor(candidate) || labels.some((label) => chartLabelsCollide(candidate, label))) continue;
          const covered = points.filter((other) => other.x >= left - 6 && other.x <= left + labelWidth + 6 && other.y >= top - 6 && other.y <= top + labelHeight + 6);
          if (covered.some((other) => candidates.some((candidate) => candidate.id === other.id))) continue;
          const wrongSide = selected && point.id !== selectedId ?
            (horizontal !== 0 && Math.sign(left + labelWidth / 2 - selected.x) !== horizontal ? 1 : 0)
            + (vertical !== 0 && Math.sign(top + labelHeight / 2 - selected.y) !== vertical ? 1 : 0) : 0;
          const connectorX = Math.max(left, Math.min(point.x, left + labelWidth));
          const connectorY = Math.max(top, Math.min(point.y, top + labelHeight));
          const score = wrongSide * 1_000_000 + covered.length * 10_000 + Math.hypot(point.x - connectorX, point.y - connectorY);
          if (!best || score < best.score) best = { left, top, score };
        }
      }
      if (best) {
        const { left, top } = best;
        labels.push({ id: point.id, name: point.name, left, top, width: labelWidth, anchorX: point.x, anchorY: point.y,
          connectorX: Math.max(left, Math.min(point.x, left + labelWidth)),
          connectorY: Math.max(top, Math.min(point.y, top + labelHeight)) });
      }
    }
  }
  return labels;
}
