/**
 * Batch Processing with Rate Limiting
 *
 * High-throughput request processing with bounded concurrency, an optional
 * token-bucket rate limit, retries, and progress reporting. Zero-dependency.
 * Extracted from docs/PATTERNS.md §6.
 *
 * @module
 */

/**
 * Configuration for the batch processor.
 */
export interface BatchProcessorConfig<TReq, TRes> {
  /** Execute one request (typically `(r) => bridge.chat(r)`). */
  readonly execute: (request: TReq) => Promise<TRes>;

  /** Maximum concurrent in-flight requests. @default 5 */
  readonly concurrency?: number;

  /** Sustained request rate (token bucket, burst = one second's tokens). */
  readonly requestsPerSecond?: number;

  /** Reject `add()` beyond this many queued requests. @default Infinity */
  readonly maxQueueSize?: number;

  /** Retry attempts per request after the first failure. @default 0 */
  readonly retries?: number;

  /** Progress callback after each settled request. */
  readonly onProgress?: (stats: BatchStats) => void;
}

/**
 * Processing statistics.
 */
export interface BatchStats {
  readonly completed: number;
  readonly failed: number;
  readonly pending: number;
  readonly inFlight: number;
}

/**
 * A batch processor instance.
 */
export interface BatchProcessor<TReq, TRes> {
  /** Enqueue one request; resolves/rejects with its result. */
  add(request: TReq): Promise<TRes>;

  /** Enqueue many; resolves when all settle. */
  addAll(requests: readonly TReq[]): Promise<PromiseSettledResult<TRes>[]>;

  /** Resolve when the queue is empty and nothing is in flight. */
  drain(): Promise<void>;

  /** Current statistics. */
  stats(): BatchStats;

  /** Stop the scheduler (pending requests are rejected). */
  dispose(): void;
}

/**
 * Create a batch processor.
 *
 * @example
 * ```typescript
 * const processor = createBatchProcessor({
 *   execute: (request) => bridge.chat(request),
 *   concurrency: 5,
 *   requestsPerSecond: 10,
 *   retries: 2,
 * });
 * const results = await processor.addAll(requests);
 * ```
 */
export function createBatchProcessor<TReq, TRes>(
  config: BatchProcessorConfig<TReq, TRes>
): BatchProcessor<TReq, TRes> {
  const concurrency = config.concurrency ?? 5;
  const maxQueueSize = config.maxQueueSize ?? Infinity;
  const retries = config.retries ?? 0;

  interface QueueItem {
    request: TReq;
    resolve: (value: TRes) => void;
    reject: (reason: unknown) => void;
    attempts: number;
  }

  const queue: QueueItem[] = [];
  let inFlight = 0;
  let completed = 0;
  let failed = 0;
  let disposed = false;
  const drainWaiters: Array<() => void> = [];

  // Token bucket (only when rate limiting is configured)
  let tokens = config.requestsPerSecond ?? Infinity;
  let refillTimer: ReturnType<typeof setInterval> | undefined;
  if (config.requestsPerSecond) {
    const perTick = config.requestsPerSecond / 10;
    refillTimer = setInterval(() => {
      tokens = Math.min(config.requestsPerSecond as number, tokens + perTick);
      pump();
    }, 100);
    // Do not hold the process open for an idle processor
    if (typeof refillTimer === 'object' && 'unref' in refillTimer) {
      refillTimer.unref();
    }
  }

  const stats = (): BatchStats => ({
    completed,
    failed,
    pending: queue.length,
    inFlight,
  });

  const notifyDrainWaiters = (): void => {
    if (queue.length === 0 && inFlight === 0) {
      while (drainWaiters.length > 0) {
        drainWaiters.shift()?.();
      }
    }
  };

  const runItem = (item: QueueItem): void => {
    inFlight++;
    item.attempts++;

    config
      .execute(item.request)
      .then((result) => {
        completed++;
        item.resolve(result);
      })
      .catch((error: unknown) => {
        if (item.attempts <= retries && !disposed) {
          // Requeue for retry (does not consume a fresh queue slot check)
          queue.push(item);
          return;
        }
        failed++;
        item.reject(error);
      })
      .finally(() => {
        inFlight--;
        config.onProgress?.(stats());
        pump();
        notifyDrainWaiters();
      });
  };

  const pump = (): void => {
    while (!disposed && inFlight < concurrency && queue.length > 0 && tokens >= 1) {
      if (config.requestsPerSecond) {
        tokens -= 1;
      }
      const item = queue.shift();
      if (item) {
        runItem(item);
      }
    }
  };

  return {
    add(request: TReq): Promise<TRes> {
      if (disposed) {
        return Promise.reject(new Error('Batch processor disposed'));
      }
      if (queue.length >= maxQueueSize) {
        return Promise.reject(new Error(`Queue full (max ${maxQueueSize})`));
      }
      return new Promise<TRes>((resolve, reject) => {
        queue.push({ request, resolve, reject, attempts: 0 });
        pump();
      });
    },

    addAll(requests: readonly TReq[]): Promise<PromiseSettledResult<TRes>[]> {
      return Promise.allSettled(requests.map((request) => this.add(request)));
    },

    drain(): Promise<void> {
      if (queue.length === 0 && inFlight === 0) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        drainWaiters.push(resolve);
      });
    },

    stats,

    dispose(): void {
      disposed = true;
      if (refillTimer) {
        clearInterval(refillTimer);
      }
      while (queue.length > 0) {
        queue.shift()?.reject(new Error('Batch processor disposed'));
      }
    },
  };
}
