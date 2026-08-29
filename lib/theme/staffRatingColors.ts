export const STAFF_RATING_COLORS = {
  low: "#ef4444",
  developing: "#facc15",
  strong: "#3b82f6",
  elite: "#22c55e",
} as const;

/** Fixed 1–20 staff-attribute bands. These deliberately bypass skin colours. */
export function getStaffRatingColor(value: number): string {
  if (value <= 4) return STAFF_RATING_COLORS.low;
  if (value <= 9) return STAFF_RATING_COLORS.developing;
  if (value <= 14) return STAFF_RATING_COLORS.strong;
  return STAFF_RATING_COLORS.elite;
}

/** The same four staff bands scaled from the 1–20 system to 0–100 preferences. */
export function getStaffPreferenceColor(value: number): string {
  const bounded = Math.max(0, Math.min(100, value));
  if (bounded < 25) return STAFF_RATING_COLORS.low;
  if (bounded < 50) return STAFF_RATING_COLORS.developing;
  if (bounded < 75) return STAFF_RATING_COLORS.strong;
  return STAFF_RATING_COLORS.elite;
}
