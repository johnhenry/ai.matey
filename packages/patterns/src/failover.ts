/**
 * Automatic Failover Middleware
 *
 * Bridge-level failover: when the primary backend fails, retry the request
 * against fallback adapters in order. For Router users, prefer the Router's
 * built-in fallback chains — this pattern serves plain-Bridge setups.
 * Extracted from docs/PATTERNS.md §3.
 *
 * @module
 */

import { AdapterError } from 'ai.matey.errors';
import type { BackendAdapter, Middleware } from 'ai.matey.types';

/**
 * Configuration for the failover middleware.
 */
export interface FailoverConfig {
  /** Backends to try, in order, after the primary fails. */
  readonly fallbacks: readonly BackendAdapter[];

  /**
   * Decide whether an error triggers failover.
   * @default retryable AdapterErrors and all non-Adapter errors
   */
  readonly shouldFailover?: (error: Error) => boolean;

  /** Observability hook fired on each failover hop. */
  readonly onFailover?: (info: { to: string; error: Error }) => void;
}

/**
 * Create failover middleware for a Bridge.
 *
 * @example
 * ```typescript
 * bridge.use(createFailoverMiddleware({
 *   fallbacks: [new AnthropicBackendAdapter({ apiKey }), new GroqBackendAdapter({ apiKey })],
 * }));
 * ```
 */
export function createFailoverMiddleware(config: FailoverConfig): Middleware {
  const shouldFailover =
    config.shouldFailover ??
    ((error: Error) => (error instanceof AdapterError ? error.isRetryable : true));

  return async (context, next) => {
    try {
      return await next();
    } catch (primaryError) {
      const error = primaryError instanceof Error ? primaryError : new Error(String(primaryError));

      if (!shouldFailover(error)) {
        throw error;
      }

      let lastError: Error = error;
      for (const fallback of config.fallbacks) {
        config.onFailover?.({ to: fallback.metadata.name, error: lastError });
        try {
          return await fallback.execute(context.request, context.signal);
        } catch (fallbackError) {
          lastError =
            fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
          if (!shouldFailover(lastError)) {
            throw lastError;
          }
        }
      }

      throw lastError;
    }
  };
}
