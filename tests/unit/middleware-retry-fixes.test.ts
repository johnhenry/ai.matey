/**
 * Middleware Retry Fixes Tests
 *
 * Tests for the fix that removed hardcoded retry limits from shouldRetry functions.
 * The maxAttempts config should be the sole controller of retry count.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createRetryMiddleware,
  createRetryPredicate,
} from 'ai.matey.middleware';
import { RateLimitError, NetworkError, ProviderError, ErrorCode } from 'ai.matey.errors';
import type { MiddlewareContext, IRChatRequest, IRChatResponse } from 'ai.matey.types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockContext(overrides?: Partial<MiddlewareContext>): MiddlewareContext {
  return {
    request: {
      messages: [{ role: 'user', content: 'Hello' }],
      metadata: {
        requestId: 'test-123',
        timestamp: Date.now(),
        provenance: {},
      },
    },
    state: {},
    ...overrides,
  } as MiddlewareContext;
}

function createMockResponse(): IRChatResponse {
  return {
    message: { role: 'assistant', content: 'Hi there!' },
    finishReason: 'stop',
    metadata: {
      requestId: 'test-123',
      timestamp: Date.now(),
      provenance: {},
    },
  };
}

// ============================================================================
// maxAttempts Configuration Tests
// ============================================================================

describe('Retry Middleware maxAttempts configuration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should respect maxAttempts=5 (more than old hardcoded limit of 3)', async () => {
    let attemptCount = 0;
    const maxAttempts = 5;

    const middleware = createRetryMiddleware({
      maxAttempts,
      initialDelay: 10,
      backoffMultiplier: 1, // No backoff for simpler timing
      useJitter: false, // Disable jitter for predictable timing
    });

    const context = createMockContext();

    // Next function that fails until the last attempt
    const next = vi.fn(async () => {
      attemptCount++;
      if (attemptCount < maxAttempts) {
        throw new NetworkError({
          code: ErrorCode.NETWORK_ERROR,
          message: 'Network failure',
          provenance: {},
        });
      }
      return createMockResponse();
    });

    const resultPromise = middleware(context, next);

    // Advance through all retry delays (4 retries with 10ms each)
    for (let i = 0; i < maxAttempts - 1; i++) {
      await vi.advanceTimersByTimeAsync(20); // Extra margin for async handling
    }

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(attemptCount).toBe(maxAttempts);
    expect(next).toHaveBeenCalledTimes(maxAttempts);
  });

  it('should respect maxAttempts=10 for highly resilient scenarios', async () => {
    let attemptCount = 0;
    const maxAttempts = 10;

    const middleware = createRetryMiddleware({
      maxAttempts,
      initialDelay: 5,
      maxDelay: 50,
      backoffMultiplier: 1, // No backoff for simpler timing
      useJitter: false, // Disable jitter for predictable timing
    });

    const context = createMockContext();

    // Next function that succeeds on attempt 8
    const next = vi.fn(async () => {
      attemptCount++;
      if (attemptCount < 8) {
        throw new RateLimitError({
          message: 'Rate limited',
          provenance: {},
        });
      }
      return createMockResponse();
    });

    const resultPromise = middleware(context, next);

    // Advance through retry delays (7 retries with 5ms each)
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(20); // Extra margin for async handling
    }

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(attemptCount).toBe(8);
  });
});

// ============================================================================
// createRetryPredicate Tests
// ============================================================================

describe('createRetryPredicate', () => {
  it('should not have hardcoded attempt limit', () => {
    const predicate = createRetryPredicate(['rate_limit']);

    // Test that predicate doesn't reject based on attempt number alone
    const rateLimitError = new RateLimitError({
      message: 'Rate limited',
      provenance: {},
    });

    // Even at high attempt numbers, should return true for matching error
    expect(predicate(rateLimitError, 1)).toBe(true);
    expect(predicate(rateLimitError, 5)).toBe(true);
    expect(predicate(rateLimitError, 10)).toBe(true);
    expect(predicate(rateLimitError, 100)).toBe(true);
  });

  it('should correctly identify rate limit errors', () => {
    const predicate = createRetryPredicate(['rate_limit']);

    const rateLimitError = new RateLimitError({
      message: 'Rate limited',
      provenance: {},
    });

    const networkError = new NetworkError({
      code: ErrorCode.NETWORK_ERROR,
      message: 'Network failure',
      provenance: {},
    });

    expect(predicate(rateLimitError, 1)).toBe(true);
    expect(predicate(networkError, 1)).toBe(false);
  });

  it('should correctly identify network errors', () => {
    const predicate = createRetryPredicate(['network']);

    const networkError = new NetworkError({
      code: ErrorCode.NETWORK_ERROR,
      message: 'Network failure',
      provenance: {},
    });

    const rateLimitError = new RateLimitError({
      message: 'Rate limited',
      provenance: {},
    });

    expect(predicate(networkError, 1)).toBe(true);
    expect(predicate(rateLimitError, 1)).toBe(false);
  });

  it('should correctly identify server errors', () => {
    const predicate = createRetryPredicate(['server']);

    const serverError = new ProviderError({
      code: ErrorCode.PROVIDER_ERROR,
      message: 'Internal server error',
      isRetryable: true,
      provenance: {},
    });

    const networkError = new NetworkError({
      code: ErrorCode.NETWORK_ERROR,
      message: 'Network failure',
      provenance: {},
    });

    expect(predicate(serverError, 1)).toBe(true);
    expect(predicate(networkError, 1)).toBe(false);
  });

  it('should handle multiple error types', () => {
    const predicate = createRetryPredicate(['rate_limit', 'network', 'server']);

    const rateLimitError = new RateLimitError({
      message: 'Rate limited',
      provenance: {},
    });

    const networkError = new NetworkError({
      code: ErrorCode.NETWORK_ERROR,
      message: 'Network failure',
      provenance: {},
    });

    const serverError = new ProviderError({
      code: ErrorCode.PROVIDER_ERROR,
      message: 'Server error',
      isRetryable: true,
      provenance: {},
    });

    expect(predicate(rateLimitError, 1)).toBe(true);
    expect(predicate(networkError, 1)).toBe(true);
    expect(predicate(serverError, 1)).toBe(true);
  });
});
