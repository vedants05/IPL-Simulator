export function formatStatValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}
