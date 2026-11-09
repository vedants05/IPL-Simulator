export interface DayTickerController {
  isRunning: () => boolean;
  start: () => boolean;
  stop: () => void;
  dispose: () => void;
}

interface DayTickerOptions {
  intervalMs: number | (() => number);
  onTick: () => void | Promise<void>;
  onError?: (error: unknown) => void;
  schedule?: typeof setTimeout;
  cancel?: typeof clearTimeout;
}

/**
 * Runs at most one recursive timer. If onTick stops the controller, no follow-up
 * timer is queued, which keeps simulation stops on completed-day boundaries.
 */
export function createDayTicker({
  intervalMs,
  onTick,
  onError,
  schedule = setTimeout,
  cancel = clearTimeout,
}: DayTickerOptions): DayTickerController {
  let running = false;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearPendingTimer = () => {
    if (timer === null) return;
    cancel(timer);
    timer = null;
  };

  const queueNextTick = (run: number) => {
    const nextIntervalMs = typeof intervalMs === "function" ? intervalMs() : intervalMs;
    timer = schedule(() => {
      timer = null;
      if (!running || run !== generation) return;

      try {
        const tickResult = onTick();
        if (tickResult instanceof Promise) {
          void tickResult.then(() => {
            if (running && run === generation && timer === null) queueNextTick(run);
          }).catch((error) => {
            if (run !== generation) return;
            running = false;
            clearPendingTimer();
            onError?.(error);
          });
          return;
        }
      } catch (error) {
        if (run !== generation) return;
        running = false;
        clearPendingTimer();
        onError?.(error);
        return;
      }

      if (running && run === generation && timer === null) {
        queueNextTick(run);
      }
    }, nextIntervalMs);
  };

  return {
    isRunning: () => running,
    start: () => {
      if (running) return false;
      running = true;
      generation += 1;
      clearPendingTimer();
      queueNextTick(generation);
      return true;
    },
    stop: () => {
      running = false;
      generation += 1;
      clearPendingTimer();
    },
    dispose: () => {
      running = false;
      generation += 1;
      clearPendingTimer();
    },
  };
}
