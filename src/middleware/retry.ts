/**
 * Retry Middleware
 *
 * Retries failed requests with exponential backoff.
 *
 * @module
 */

import type { Middleware, MiddlewareContext, MiddlewareNext } from '../types/middleware.js';
import type { IRChatResponse } from '../types/ir.js';
import { AdapterError } from '../errors/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for retry middleware.
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts.
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Initial delay before first retry (milliseconds).
   * @default 1000
   */
  initialDelay?: number;

  /**
   * Backoff multiplier for exponential backoff.
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Maximum delay between retries (milliseconds).
   * @default 30000 (30 seconds)
   */
  maxDelay?: number;

  /**
   * Whether to add jitter to retry delays.
   * @default true
   */
  useJitter?: boolean;

  /**
   * Custom function to determine if error is retryable.
   * @default Check error.isRetryable property
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;

  /**
   * Callback invoked before each retry.
   */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Default retry condition.
 *
 * Only retry transient errors (network issues, rate limits, server errors).
 */
function defaultShouldRetry(error: unknown, attempt: number): boolean {
  // Don't retry if we've exhausted attempts
  if (attempt >= 3) {
    return false;
  }

  // Check if error has isRetryable property
  if (error && typeof error === 'object' && 'isRetryable' in error) {
    return (error as { isRetryable: boolean }).isRetryable === true;
  }

  // For AdapterError, check isRetryable
  if (error instanceof AdapterError) {
    return error.isRetryable;
  }

  // Default: don't retry unknown errors
  return false;
}

/**
 * Calculate retry delay with exponential backoff.
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  backoffMultiplier: number,
  maxDelay: number,
  useJitter: boolean
): number {
  // Calculate exponential backoff
  let delay = initialDelay * Math.pow(backoffMultiplier, attempt);

  // Cap at max delay
  delay = Math.min(delay, maxDelay);

  // Add jitter if enabled (random value between 0 and delay)
  if (useJitter) {
    delay = Math.random() * delay;
  }

  return Math.floor(delay);
}

/**
 * Sleep for specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create retry middleware.
 *
 * Retries failed requests with exponential backoff.
 *
 * @param config Retry configuration
 * @returns Retry middleware
 *
 * @example
 * ```typescript
 * const retry = createRetryMiddleware({
 *   maxAttempts: 3,
 *   initialDelay: 1000,
 *   backoffMultiplier: 2,
 *   maxDelay: 30000
 * });
 *
 * bridge.use(retry);
 * ```
 */
export function createRetryMiddleware(config: RetryConfig = {}): Middleware {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    backoffMultiplier = 2,
    maxDelay = 30000,
    useJitter = true,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = config;

  return async (context: MiddlewareContext, next: MiddlewareNext): Promise<IRChatResponse> => {
    let lastError: unknown;
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        // Call next middleware/handler
        const response = await next();

        // Success - add retry metadata if we retried
        if (attempt > 0) {
          return {
            ...response,
            metadata: {
              ...response.metadata,
              custom: {
                ...response.metadata.custom,
                retryAttempts: attempt,
                retrySuccess: true,
              },
            },
          };
        }

        return response;
      } catch (error) {
        lastError = error;
        attempt++;

        // Check if we should retry
        const willRetry = attempt < maxAttempts && shouldRetry(error, attempt);

        if (!willRetry) {
          // No more retries - add metadata and throw
          if (error instanceof AdapterError) {
            throw new AdapterError({
              ...error,
              details: {
                ...error.details,
                retryAttempts: attempt,
                retrySuccess: false,
              },
            });
          }

          throw error;
        }

        // Calculate retry delay
        const delay = calculateDelay(
          attempt - 1, // 0-indexed for delay calculation
          initialDelay,
          backoffMultiplier,
          maxDelay,
          useJitter
        );

        // Call retry callback if provided
        if (onRetry) {
          onRetry(error, attempt, delay);
        }

        // Check if request was aborted
        if (context.signal?.aborted) {
          throw error;
        }

        // Wait before retrying
        await sleep(delay);

        // Check again if request was aborted during sleep
        if (context.signal?.aborted) {
          throw error;
        }
      }
    }

    // Should never reach here, but just in case
    throw lastError;
  };
}

// ============================================================================
// Retry Utilities
// ============================================================================

/**
 * Check if an error is a rate limit error.
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof AdapterError) {
    return error.code === 'RATE_LIMIT_EXCEEDED';
  }

  return false;
}

/**
 * Check if an error is a network error.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof AdapterError) {
    return error.code === 'NETWORK_ERROR';
  }

  return false;
}

/**
 * Check if an error is a server error (5xx).
 */
export function isServerError(error: unknown): boolean {
  if (error instanceof AdapterError) {
    return error.code === 'PROVIDER_ERROR' || error.code === 'INTERNAL_ERROR';
  }

  return false;
}

/**
 * Create a retry predicate that only retries specific error types.
 */
export function createRetryPredicate(
  errorTypes: Array<'rate_limit' | 'network' | 'server'>
): (error: unknown, attempt: number) => boolean {
  return (error: unknown, attempt: number): boolean => {
    if (attempt >= 3) {
      return false;
    }

    for (const type of errorTypes) {
      switch (type) {
        case 'rate_limit':
          if (isRateLimitError(error)) return true;
          break;
        case 'network':
          if (isNetworkError(error)) return true;
          break;
        case 'server':
          if (isServerError(error)) return true;
          break;
      }
    }

    return false;
  };
}
