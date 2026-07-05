/**
 * Cost-Optimized Provider Selection
 *
 * A cost-optimizing Router plus a budget-window middleware: route to the
 * cheapest capable backend and enforce a spending ceiling. Extracted from
 * docs/PATTERNS.md §4.
 *
 * @module
 */

import { Router } from 'ai.matey.core';
import { AdapterError, ErrorCode } from 'ai.matey.errors';
import type { RouterConfig } from 'ai.matey.types';
import type { BackendAdapter, Middleware } from 'ai.matey.types';

/**
 * Configuration for the cost optimizer.
 */
export interface CostOptimizerConfig {
  /** Backends keyed by name. */
  readonly backends: Readonly<Record<string, BackendAdapter>>;

  /** Optional budget ceiling over a sliding window. */
  readonly budget?: {
    /** Spending ceiling in USD within the window. */
    readonly limitUSD: number;
    /** Window length in milliseconds. @default 3600000 (1 hour) */
    readonly windowMs?: number;
    /** What to do when the ceiling is hit. @default 'error' */
    readonly onExceeded?: 'error' | 'allow';
  };

  /** Extra Router configuration. */
  readonly routerConfig?: Partial<RouterConfig>;
}

/**
 * Result of createCostOptimizer.
 */
export interface CostOptimizer {
  /** Cost-optimizing router (usable as a Bridge backend). */
  readonly router: Router;

  /** Budget-enforcing middleware (no-op when no budget configured). */
  readonly middleware: Middleware;

  /** Spend recorded within the current window, in USD. */
  getSpend(): number;

  /** Record spend (call from cost-tracking middleware or manually). */
  recordSpend(costUSD: number): void;
}

/**
 * Create a cost-optimized router with an optional budget window.
 *
 * @example
 * ```typescript
 * const { router, middleware, recordSpend } = createCostOptimizer({
 *   backends: { cheap, premium },
 *   budget: { limitUSD: 10, windowMs: 3600_000 },
 * });
 * const bridge = new Bridge(frontend, router).use(middleware);
 * ```
 */
export function createCostOptimizer(config: CostOptimizerConfig): CostOptimizer {
  const router = new Router({
    trackCost: true,
    capabilityBasedRouting: true,
    optimization: 'cost',
    ...config.routerConfig,
  });

  for (const [name, adapter] of Object.entries(config.backends)) {
    router.register(name, adapter);
  }

  // Sliding-window spend ledger
  const windowMs = config.budget?.windowMs ?? 3_600_000;
  let entries: Array<{ at: number; costUSD: number }> = [];

  const prune = (): void => {
    const cutoff = Date.now() - windowMs;
    entries = entries.filter((entry) => entry.at >= cutoff);
  };

  const getSpend = (): number => {
    prune();
    return entries.reduce((sum, entry) => sum + entry.costUSD, 0);
  };

  const recordSpend = (costUSD: number): void => {
    entries.push({ at: Date.now(), costUSD });
  };

  const middleware: Middleware = async (_context, next) => {
    if (config.budget && getSpend() >= config.budget.limitUSD) {
      if ((config.budget.onExceeded ?? 'error') === 'error') {
        throw new AdapterError({
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: `Budget of $${config.budget.limitUSD} exceeded for the current window`,
          isRetryable: true,
          provenance: { router: router.metadata.name },
        });
      }
    }
    return next();
  };

  return { router, middleware, getSpend, recordSpend };
}
