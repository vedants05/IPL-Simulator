export interface DayTickerController {
  isRunning: () => boolean;
  start: () => boolean;
  stop: () => void;
  dispose: () => void;
}

interface DayTickerOptions {
  intervalMs: number;
  onTick: () => void;
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
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearPendingTimer = () => {
    if (timer === null) return;
    cancel(timer);
    timer = null;
  };

  const queueNextTick = () => {
    timer = schedule(() => {
      timer = null;
      if (!running) return;

      try {
        onTick();
      } catch (error) {
        running = false;
        clearPendingTimer();
        onError?.(error);
        return;
      }

      if (running && timer === null) {
        queueNextTick();
      }
    }, intervalMs);
  };

  return {
    isRunning: () => running,
    start: () => {
      if (running) return false;
      running = true;
      clearPendingTimer();
      queueNextTick();
      return true;
    },
    stop: () => {
      running = false;
      clearPendingTimer();
    },
    dispose: () => {
      running = false;
      clearPendingTimer();
    },
  };
}
