import assert from "node:assert/strict";
import test from "node:test";

import {
  TICKING_CALENDAR_OFFSETS,
  addDaysToDateKey,
  dateKeyToLocalDate,
  localDateToDateKey,
} from "./careerCalendar";

const tickingDates = (currentDate: string) =>
  TICKING_CALENDAR_OFFSETS.map((offset) => addDaysToDateKey(currentDate, offset));

test("the ticking calendar uses the previous, current, and next five days", () => {
  assert.deepEqual(TICKING_CALENDAR_OFFSETS, [-1, 0, 1, 2, 3, 4, 5]);
  assert.deepEqual(tickingDates("2026-12-30"), [
    "2026-12-29",
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
    "2027-01-03",
    "2027-01-04",
  ]);
});

test("seven calendar tiles cross leap day without skipping or repeating a date", () => {
  assert.deepEqual(tickingDates("2028-02-28"), [
    "2028-02-27",
    "2028-02-28",
    "2028-02-29",
    "2028-03-01",
    "2028-03-02",
    "2028-03-03",
    "2028-03-04",
  ]);
});

test("date-only arithmetic remains consecutive around UK DST changes", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "Europe/London";

  try {
    assert.deepEqual(tickingDates("2026-03-29"), [
      "2026-03-28",
      "2026-03-29",
      "2026-03-30",
      "2026-03-31",
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
    ]);
    assert.deepEqual(tickingDates("2026-10-25"), [
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
    ]);
  } finally {
    if (previousTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimezone;
    }
  }
});

test("date keys round-trip through a local noon date", () => {
  const localDate = dateKeyToLocalDate("2027-04-05");

  assert.equal(localDate.getHours(), 12);
  assert.equal(localDateToDateKey(localDate), "2027-04-05");
});

test("invalid and impossible date keys are rejected", () => {
  for (const value of ["2026-2-03", "2026-02-30", "not-a-date"]) {
    assert.throws(() => dateKeyToLocalDate(value), /Invalid calendar date/);
  }
});
