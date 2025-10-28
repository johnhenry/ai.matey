/**
 * Retry Logic for Structured Output
 *
 * Provides retry mechanism for validation failures to improve robustness.
 *
 * @module
 */

import type { BackendAdapter } from '../types/adapters.js';
import type { IRMessage } from '../types/ir.js';
import type { ExtractionMode, GenerateObjectResult } from './types.js';
import { generateObject } from './generate-object.js';

export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   * @default 2
   */
  maxRetries?: number;

  /**
   * Callback called before each retry attempt
   * Receives the error, attempt number, and max attempts
   */
  onRetry?: (error: Error, attempt: number, maxAttempts: number) => void;

  /**
   * Whether to increase temperature on retries
   * Can help model produce different outputs
   * @default false
   */
  increaseTemperatureOnRetry?: boolean;

  /**
   * Temperature increase per retry
   * Only used if increaseTemperatureOnRetry is true
   * @default 0.2
   */
  temperatureIncrement?: number;
}

/**
 * Generate object with automatic retry on validation failures.
 *
 * Retries up to `maxRetries` times if:
 * - JSON parsing fails
 * - Schema validation fails
 * - Model generates invalid output
 *
 * Does NOT retry on:
 * - Network errors
 * - Authentication errors
 * - Invalid schema errors (user error)
 * - Abort signal triggered
 *
 * @example
 * ```typescript
 * const result = await generateObjectWithRetry({
 *   backend,
 *   schema: UserSchema,
 *   messages: [...],
 *   maxRetries: 3,
 *   onRetry: (error, attempt, max) => {
 *     console.log(`Retry ${attempt}/${max}: ${error.message}`);
 *   },
 * });
 * ```
 */
export async function generateObjectWithRetry<T = any>(options: {
  backend: BackendAdapter;
  schema: any;
  messages: readonly IRMessage[];
  model?: string;
  mode?: ExtractionMode;
  name?: string;
  description?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onFinish?: (data: T) => void;
} & RetryOptions): Promise<GenerateObjectResult<T>> {
  const {
    maxRetries = 2,
    onRetry,
    increaseTemperatureOnRetry = false,
    temperatureIncrement = 0.2,
    ...generateOptions
  } = options;

  const initialTemperature = options.temperature ?? 0.0;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Adjust temperature for retries if configured
      const currentTemperature = increaseTemperatureOnRetry
        ? initialTemperature + (attempt * temperatureIncrement)
        : initialTemperature;

      const result = await generateObject<T>({
        ...generateOptions,
        temperature: currentTemperature,
      });

      // Success - return result
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on certain error types
      if (shouldNotRetry(lastError, options.signal)) {
        throw lastError;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= maxRetries) {
        throw lastError;
      }

      // Call retry callback if provided
      if (onRetry) {
        onRetry(lastError, attempt + 1, maxRetries);
      }

      // Brief delay before retry (exponential backoff)
      await sleep(Math.min(1000 * Math.pow(2, attempt), 5000));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Unknown error during retry');
}

/**
 * Determine if an error should NOT be retried.
 *
 * Don't retry on:
 * - Network errors (temporary, should use network-level retry)
 * - Authentication errors (won't be fixed by retry)
 * - Invalid schema errors (user error)
 * - Abort signal (user cancelled)
 */
function shouldNotRetry(error: Error, signal?: AbortSignal): boolean {
  const errorMessage = error.message.toLowerCase();

  // User cancelled
  if (signal?.aborted) {
    return true;
  }

  // Invalid schema (user error)
  if (errorMessage.includes('invalid schema')) {
    return true;
  }

  // Network errors (should use network-level retry)
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound')
  ) {
    return true;
  }

  // Authentication errors
  if (
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('forbidden') ||
    errorMessage.includes('api key') ||
    errorMessage.includes('authentication')
  ) {
    return true;
  }

  // Rate limit (should use backoff at higher level)
  if (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests')
  ) {
    return true;
  }

  // All other errors are retryable (JSON parse, validation, etc.)
  return false;
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Export for backwards compatibility and convenience
 */
export { generateObject, generateObjectStream } from './generate-object.js';
