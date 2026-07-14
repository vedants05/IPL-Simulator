export const DAY_SIMULATION_INTERVAL_MS = 1000;

export const TICKING_CALENDAR_OFFSETS = [-1, 0, 1, 2, 3, 4, 5] as const;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Converts a persisted YYYY-MM-DD value into a local date at noon. Noon avoids
 * DST boundary surprises without letting the browser interpret the value as UTC.
 */
export function dateKeyToLocalDate(dateKey: string): Date {
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) {
    throw new Error(`Invalid calendar date: ${dateKey}`);
  }

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12);

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    throw new Error(`Invalid calendar date: ${dateKey}`);
  }

  return date;
}

export function localDateToDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysToDateKey(dateKey: string, numberOfDays: number): string {
  const date = dateKeyToLocalDate(dateKey);
  date.setDate(date.getDate() + numberOfDays);
  return localDateToDateKey(date);
}
