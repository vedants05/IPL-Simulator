import assert from "node:assert/strict";
import test from "node:test";

import { DAY_SIMULATION_INTERVAL_MS } from "./careerCalendar";
import { createDayTicker, type DayTickerController } from "./dayTicker";

interface ScheduledTask {
  callback: () => void;
  dueAt: number;
  id: number;
}

class FakeScheduler {
  private clock = 0;
  private nextId = 1;
  private readonly tasks = new Map<number, ScheduledTask>();

  readonly scheduledDelays: number[] = [];

  readonly schedule = ((callback: () => void, delay = 0) => {
    const id = this.nextId++;
    this.scheduledDelays.push(delay);
    this.tasks.set(id, { callback, dueAt: this.clock + delay, id });
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  readonly cancel = ((handle: ReturnType<typeof setTimeout>) => {
    this.tasks.delete(handle as unknown as number);
  }) as typeof clearTimeout;

  get pendingCount() {
    return this.tasks.size;
  }

  advanceBy(milliseconds: number) {
    const target = this.clock + milliseconds;

    while (true) {
      const nextTask = Array.from(this.tasks.values())
        .filter((task) => task.dueAt <= target)
        .sort((left, right) => left.dueAt - right.dueAt || left.id - right.id)[0];

      if (!nextTask) break;

      this.clock = nextTask.dueAt;
      this.tasks.delete(nextTask.id);
      nextTask.callback();
    }

    this.clock = target;
  }
}

const createHarness = (onTick: () => void = () => undefined) => {
  const scheduler = new FakeScheduler();
  const ticker = createDayTicker({
    intervalMs: DAY_SIMULATION_INTERVAL_MS,
    onTick,
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
  });

  return { scheduler, ticker };
};

test("ticks once per second and recursively schedules only after each completed tick", () => {
  let ticks = 0;
  const { scheduler, ticker } = createHarness(() => {
    ticks += 1;
  });

  assert.equal(ticker.start(), true);
  assert.equal(ticker.isRunning(), true);
  assert.deepEqual(scheduler.scheduledDelays, [1000]);

  scheduler.advanceBy(999);
  assert.equal(ticks, 0);

  scheduler.advanceBy(1);
  assert.equal(ticks, 1);
  assert.equal(scheduler.pendingCount, 1);
  assert.deepEqual(scheduler.scheduledDelays, [1000, 1000]);

  scheduler.advanceBy(2000);
  assert.equal(ticks, 3);
  assert.equal(scheduler.pendingCount, 1);
});

test("a duplicate start is rejected without creating a second timer", () => {
  let ticks = 0;
  const { scheduler, ticker } = createHarness(() => {
    ticks += 1;
  });

  assert.equal(ticker.start(), true);
  assert.equal(ticker.start(), false);
  assert.equal(scheduler.pendingCount, 1);

  scheduler.advanceBy(1000);
  assert.equal(ticks, 1);
  assert.equal(scheduler.pendingCount, 1);
});

test("stop before a pending tick cancels it and leaves the ticker idle", () => {
  let ticks = 0;
  const { scheduler, ticker } = createHarness(() => {
    ticks += 1;
  });

  ticker.start();
  scheduler.advanceBy(999);
  ticker.stop();

  assert.equal(ticker.isRunning(), false);
  assert.equal(scheduler.pendingCount, 0);

  scheduler.advanceBy(10_000);
  assert.equal(ticks, 0);
});

test("a stopped ticker can continue later without duplicating timers", () => {
  let ticks = 0;
  const { scheduler, ticker } = createHarness(() => {
    ticks += 1;
  });

  ticker.start();
  scheduler.advanceBy(1000);
  ticker.stop();
  scheduler.advanceBy(5000);

  assert.equal(ticks, 1);
  assert.equal(ticker.start(), true);
  assert.equal(scheduler.pendingCount, 1);

  scheduler.advanceBy(1000);
  assert.equal(ticks, 2);
  assert.equal(scheduler.pendingCount, 1);
});

test("stop during a tick prevents the recursive timer from being rescheduled", () => {
  const scheduler = new FakeScheduler();
  let ticks = 0;
  let ticker: DayTickerController;

  ticker = createDayTicker({
    intervalMs: DAY_SIMULATION_INTERVAL_MS,
    onTick: () => {
      ticks += 1;
      ticker.stop();
    },
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
  });

  ticker.start();
  scheduler.advanceBy(1000);

  assert.equal(ticks, 1);
  assert.equal(ticker.isRunning(), false);
  assert.equal(scheduler.pendingCount, 0);

  scheduler.advanceBy(10_000);
  assert.equal(ticks, 1);
});

test("a reentrant stop and restart still leaves exactly one pending timer", () => {
  const scheduler = new FakeScheduler();
  let ticks = 0;
  let ticker: DayTickerController;

  ticker = createDayTicker({
    intervalMs: DAY_SIMULATION_INTERVAL_MS,
    onTick: () => {
      ticks += 1;
      if (ticks === 1) {
        ticker.stop();
        ticker.start();
      }
    },
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
  });

  ticker.start();
  scheduler.advanceBy(1000);

  assert.equal(ticks, 1);
  assert.equal(ticker.isRunning(), true);
  assert.equal(scheduler.pendingCount, 1);

  scheduler.advanceBy(1000);
  assert.equal(ticks, 2);
  assert.equal(scheduler.pendingCount, 1);
});

test("a throwing tick stops cleanly and reports the error without retrying", () => {
  const scheduler = new FakeScheduler();
  const expectedError = new Error("tick failed");
  const reportedErrors: unknown[] = [];
  const ticker = createDayTicker({
    intervalMs: DAY_SIMULATION_INTERVAL_MS,
    onTick: () => {
      throw expectedError;
    },
    onError: (error) => reportedErrors.push(error),
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
  });

  ticker.start();
  scheduler.advanceBy(1000);

  assert.equal(ticker.isRunning(), false);
  assert.equal(scheduler.pendingCount, 0);
  assert.deepEqual(reportedErrors, [expectedError]);

  scheduler.advanceBy(10_000);
  assert.deepEqual(reportedErrors, [expectedError]);
});

test("dispose cancels pending work and is safe to call more than once", () => {
  let ticks = 0;
  const { scheduler, ticker } = createHarness(() => {
    ticks += 1;
  });

  ticker.start();
  ticker.dispose();
  ticker.dispose();

  assert.equal(ticker.isRunning(), false);
  assert.equal(scheduler.pendingCount, 0);

  scheduler.advanceBy(10_000);
  assert.equal(ticks, 0);
});
