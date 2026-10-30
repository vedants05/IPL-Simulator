import type { Role } from "../types";

export type ChartPoint = { id: string; name: string; x: number; y: number; radius?: number; lowerEndEligible?: boolean };

export function chartLowerEndRoleMatches(role: Role, metricGroups: string[]): boolean {
  const batting = metricGroups.some((group) => group.toLowerCase().includes("batting"));
  const bowling = metricGroups.some((group) => group.toLowerCase().includes("bowling"));
  return (!batting || role === "Batsman" || role === "WK-Batsman" || role === "All-Rounder")
    && (!bowling || role === "Pace Bowler" || role === "Spin Bowler" || role === "All-Rounder");
}
export type ChartLabel = { id: string; name: string; left: number; top: number; width: number; height?: number; anchorX: number; anchorY: number; connectorX: number; connectorY: number };

function connectorTouchesCard(line: ChartLabel, card: ChartLabel): boolean {
  let enter = 0, leave = 1;
  for (const [start, delta, low, high] of [
    [line.anchorX, line.connectorX - line.anchorX, card.left - 2, card.left + card.width + 2],
    [line.anchorY, line.connectorY - line.anchorY, card.top - 2, card.top + (card.height ?? 17) + 2],
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
    && a.top < b.top + (b.height ?? 17) + 3 && a.top + (a.height ?? 17) + 3 > b.top;
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

export function chartLabelPlayers(points: ChartPoint[], selectedId: string, width: number, height: number, limit = 4): ChartPoint[] {
  const selected = points.find((point) => point.id === selectedId);
  const eligible = points.filter((point) => point.lowerEndEligible !== false);
  const result: ChartPoint[] = selected ? [selected] : [];
  const addBest = (score: (point: ChartPoint) => number) => {
    const point = [...eligible].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))[0];
    if (point && !result.some((chosen) => chosen.id === point.id)) result.push(point);
  };
  // Axes are oriented so better values are right and up. Normalising the
  // combined score prevents a wide plot from dominating the comparison.
  addBest((point) => point.x);
  addBest((point) => -point.y);
  addBest((point) => point.x / Math.max(width, 1) + (height - point.y) / Math.max(height, 1));
  const remaining = [...eligible].sort((a, b) =>
    (b.x - a.x) / Math.max(width, 1) + (a.y - b.y) / Math.max(height, 1)
    || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  if (limit > 4) for (const point of remaining) {
    if (result.length >= limit) break;
    if (!result.some((chosen) => chosen.id === point.id)) result.push(point);
  }
  return result;
}

export function chartLabels(points: ChartPoint[], selectedId: string, width: number, height: number, limit = 4, measuredWidths: Record<string, number> = {}, measuredHeights: Record<string, number> = {}): ChartLabel[] {
  if (width < 12 || height < 21 || points.length === 0) return [];
  const labels: ChartLabel[] = [];
  for (const point of chartLabelPlayers(points, selectedId, width, height, limit)) {
    if (labels.length >= limit) break;
    const labelWidth = Math.min(width - 4, measuredWidths[point.id] ?? Math.ceil(Array.from(point.name).length * 4.8 + 10));
    const labelHeight = measuredHeights[point.id] ?? 17;
    const labelAt = (left: number, top: number): ChartLabel => ({ id: point.id, name: point.name, left, top, width: labelWidth, height: labelHeight,
      anchorX: point.x, anchorY: point.y,
      connectorX: Math.max(left, Math.min(point.x, left + labelWidth)),
      connectorY: Math.max(top, Math.min(point.y, top + labelHeight)) });
    const positions: ChartLabel[] = [];
    // Search locally first. The selected label has a wider fallback so it is
    // retained even on a dense plot; other labels are omitted when too crowded.
    const maxDistance = point.id === selectedId ? Math.max(width, height) : 38;
    for (let top = 2; top + labelHeight <= height - 2; top += 4) {
      for (let left = 2; left + labelWidth <= width - 2; left += 4) {
        const candidate = labelAt(left, top);
        const distance = Math.hypot(candidate.connectorX - point.x, candidate.connectorY - point.y);
        if (distance < (point.radius ?? 4) + 2 || distance > maxDistance) continue;
        if (labels.some((other) => {
          const difference = point.x - other.anchorX;
          const labelDifference = left + labelWidth / 2 - (other.left + other.width / 2);
          return (difference > 0 && labelDifference <= 0) || (difference < 0 && labelDifference >= 0) || chartLabelsCollide(candidate, other);
        })) continue;
        const coversPoint = points.some((other) => other.id !== point.id && Math.hypot(
          other.x - Math.max(left, Math.min(other.x, left + labelWidth)),
          other.y - Math.max(top, Math.min(other.y, top + labelHeight)),
        ) < (other.radius ?? 4) + 2);
        if (coversPoint && point.id !== selectedId) continue;
        positions.push(candidate);
      }
    }
    positions.sort((a, b) => {
      const score = (item: ChartLabel) => Math.hypot(item.connectorX - point.x, item.connectorY - point.y)
        + Math.abs(item.left + item.width / 2 - point.x) * 0.05
        + (points.some((other) => other.id !== point.id && other.x >= item.left - 5 && other.x <= item.left + item.width + 5 && other.y >= item.top - 5 && other.y <= item.top + labelHeight + 5) ? 10000 : 0);
      return score(a) - score(b) || a.top - b.top || a.left - b.left;
    });
    if (positions[0]) labels.push(positions[0]);
  }
  return labels;
}
