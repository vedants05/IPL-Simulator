export const DAY_SIMULATION_INTERVAL_MS = 1000;
export const FAST_DAY_SIMULATION_INTERVAL_MS = DAY_SIMULATION_INTERVAL_MS / 2;
export const SKIP_SIMULATION_MAX_SPEED_INTERVAL_MS = 50;
export const SKIP_SIMULATION_SLOW_INTERVAL_MS = 400;

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

export function findCalendarMonthIndex(
  calendarMonths: ReadonlyArray<{ month: number; year: number }>,
  dateKey: string,
): number {
  const date = dateKeyToLocalDate(dateKey);
  return calendarMonths.findIndex(({ month, year }) => (
    month === date.getMonth() && year === date.getFullYear()
  ));
}

export function getDaySimulationIntervalMs(
  currentDate: string,
  auctionDate: string,
  scheduleAnnouncementDate: string,
): number {
  return currentDate >= auctionDate && currentDate <= scheduleAnnouncementDate
    ? FAST_DAY_SIMULATION_INTERVAL_MS
    : DAY_SIMULATION_INTERVAL_MS;
}

function daysBetweenDateKeys(startDate: string, endDate: string): number {
  const start = dateKeyToLocalDate(startDate);
  const end = dateKeyToLocalDate(endDate);
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / 86_400_000);
}

export function getSkipSimulationIntervalMs(
  currentDate: string,
  startDate: string,
  targetDate: string,
): number {
  const totalDays = Math.max(daysBetweenDateKeys(startDate, targetDate), 1);
  const elapsedDays = Math.min(Math.max(daysBetweenDateKeys(startDate, currentDate), 0), totalDays);
  const remainingDays = totalDays - elapsedDays;
  const rampDays = Math.max(1, Math.min(10, Math.floor(totalDays / 3)));
  const edgeProgress = Math.min(Math.min(elapsedDays, remainingDays) / rampDays, 1);
  const smoothProgress = edgeProgress * edgeProgress * (3 - 2 * edgeProgress);

  return Math.round(
    SKIP_SIMULATION_SLOW_INTERVAL_MS
      - (SKIP_SIMULATION_SLOW_INTERVAL_MS - SKIP_SIMULATION_MAX_SPEED_INTERVAL_MS) * smoothProgress,
  );
}
