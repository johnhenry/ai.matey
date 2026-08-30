/**
 * Retryability Classification Tests
 *
 * Regression tests for #70: four sites classified `isRetryable` and they
 * disagreed, so the same fault was transient or permanent depending on which
 * path reached it - and `isRetryable` is the only thing retry logic keys off.
 *
 * Covers:
 * - `RouterError` derives `ALL_BACKENDS_FAILED` retryability from the leaf
 *   failures instead of asserting it from the code
 * - every `ALL_BACKENDS_FAILED` in the router is built by `RouterError`, so the
 *   parallel and sequential paths give one answer rather than three
 * - `Bridge`'s retry loop and `defaultShouldRetry` agree on unknown errors
 * - `408` and `425` are retryable; `404`, `409` and `422` are not
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Bridge, Router } from '@johnhenry/aimatey-core';
import { createRetryMiddleware } from '@johnhenry/aimatey-middleware';
import {
  AdapterError,
  AuthenticationError,
  ErrorCode,
  NetworkError,
  RouterError,
  createErrorFromHttpResponse,
} from '@johnhenry/aimatey-errors';
import type {
  BackendAdapter,
  FrontendAdapter,
  IRChatRequest,
  IRChatResponse,
  IRStreamChunk,
} from '@johnhenry/aimatey-types';

// ============================================================================
// Test Helpers
// ============================================================================

const CAPABILITIES = {
  streaming: true,
  multiModal: false,
  tools: false,
  systemMessageStrategy: 'in-messages',
  supportsMultipleSystemMessages: true,
} as const;

const HELLO = { messages: [{ role: 'user', content: 'Hello' }] };

/** A transient, retryable failure. */
function retryableFailure(message = 'connection reset'): NetworkError {
  return new NetworkError({
    code: ErrorCode.NETWORK_ERROR,
    message,
    provenance: {},
  });
}

/** A permanent failure - retrying cannot help, the key is still wrong. */
function permanentFailure(message = 'invalid api key'): AuthenticationError {
  return new AuthenticationError({
    code: ErrorCode.INVALID_API_KEY,
    message,
    provenance: {},
  });
}

function createMockFrontend(): FrontendAdapter {
  return {
    metadata: {
      name: 'mock-frontend',
      version: '1.0.0',
      provider: 'Mock',
      capabilities: CAPABILITIES,
    },
    toIR: (request: { messages?: unknown[] }) => ({
      messages: request.messages ?? [],
      metadata: { requestId: 'test-req-id', timestamp: Date.now(), provenance: {} },
    }),
    fromIR: (response: IRChatResponse) => ({
      id: response.metadata.requestId,
      content: response.message.content,
    }),
    fromIRStream: async function* (stream: AsyncIterable<IRStreamChunk>) {
      for await (const chunk of stream) {
        yield chunk;
      }
    },
  } as unknown as FrontendAdapter;
}

interface CountingBackend {
  readonly adapter: BackendAdapter;
  attempts(): number;
}

/** Backend that always fails with `error`, counting how often it was reached. */
function createFailingBackend(name: string, error: () => unknown): CountingBackend {
  let attempts = 0;

  const adapter = {
    metadata: { name, version: '1.0.0', provider: 'Mock', capabilities: CAPABILITIES },
    fromIR: (request: unknown) => request,
    toIR: (response: unknown) => response,
    execute: async (): Promise<IRChatResponse> => {
      attempts++;
      throw error();
    },
    executeStream: async function* (): AsyncGenerator<IRStreamChunk, void, undefined> {
      attempts++;
      throw error();
    },
  } as unknown as BackendAdapter;

  return { adapter, attempts: () => attempts };
}

function createTestRequest(): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    parameters: { model: 'test-model' },
    stream: false,
    metadata: { requestId: 'test-req-id', timestamp: Date.now(), provenance: {} },
  } as IRChatRequest;
}

// ============================================================================
// RouterError derives its classification
// ============================================================================

describe('RouterError derives ALL_BACKENDS_FAILED retryability from its leaves', () => {
  it('is non-retryable when every backend failed non-retryably', () => {
    const error = new RouterError({
      code: ErrorCode.ALL_BACKENDS_FAILED,
      message: 'All backends failed',
      attemptedBackends: ['a', 'b'],
      backendErrors: [permanentFailure(), permanentFailure()],
    });

    expect(error.isRetryable).toBe(false);
  });

  it('is retryable when at least one backend failed retryably', () => {
    const error = new RouterError({
      code: ErrorCode.ALL_BACKENDS_FAILED,
      message: 'All backends failed',
      attemptedBackends: ['a', 'b'],
      backendErrors: [permanentFailure(), retryableFailure()],
    });

    expect(error.isRetryable).toBe(true);
  });

  it('is non-retryable when no backend errors were carried', () => {
    const error = new RouterError({
      code: ErrorCode.ALL_BACKENDS_FAILED,
      message: 'All backends failed',
      attemptedBackends: ['a', 'b'],
    });

    expect(error.isRetryable).toBe(false);
  });

  it('is non-retryable for leaves that carry no classification at all', () => {
    const error = new RouterError({
      code: ErrorCode.ALL_BACKENDS_FAILED,
      message: 'All backends failed',
      backendErrors: [new Error('plain'), new TypeError('also plain')],
    });

    expect(error.isRetryable).toBe(false);
  });

  it('reads the flag duck-typed, so a second copy of the package still works', () => {
    // A cause from a duplicated install fails `instanceof AdapterError` but
    // still carries the flag; the classification must not be lost to that.
    const foreign = Object.assign(new Error('from another realm'), { isRetryable: true });

    const error = new RouterError({
      code: ErrorCode.ALL_BACKENDS_FAILED,
      message: 'All backends failed',
      backendErrors: [foreign],
    });

    expect(foreign).not.toBeInstanceOf(AdapterError);
    expect(error.isRetryable).toBe(true);
  });

  it('stays non-retryable for routing failures regardless of leaves', () => {
    const error = new RouterError({
      code: ErrorCode.ROUTING_FAILED,
      message: 'No route found',
      backendErrors: [retryableFailure()],
    });

    expect(error.isRetryable).toBe(false);
  });

  it('keeps the leaf failures for diagnostics', () => {
    const leaves = [permanentFailure('key a'), permanentFailure('key b')];
    const error = new RouterError({
      code: ErrorCode.ALL_BACKENDS_FAILED,
      message: 'All backends failed',
      attemptedBackends: ['a', 'b'],
      backendErrors: leaves,
    });

    expect(error.backendErrors).toEqual(leaves);
    expect(error.toJSON().details).toMatchObject({
      attemptedBackends: ['a', 'b'],
      backendErrors: [
        { name: 'AuthenticationError', code: ErrorCode.INVALID_API_KEY, isRetryable: false },
        { name: 'AuthenticationError', code: ErrorCode.INVALID_API_KEY, isRetryable: false },
      ],
    });
  });
});

// ============================================================================
// The router's ALL_BACKENDS_FAILED reflects why the backends failed
// ============================================================================

describe('Router ALL_BACKENDS_FAILED reflects why the backends failed', () => {
  it('is non-retryable when every parallel backend failed non-retryably', async () => {
    const router = new Router({ routingStrategy: 'round-robin' });
    router.register('a', createFailingBackend('a', permanentFailure).adapter);
    router.register('b', createFailingBackend('b', permanentFailure).adapter);

    const error = (await router
      .dispatchParallel(createTestRequest(), { strategy: 'all', backends: ['a', 'b'] })
      .catch((e: unknown) => e)) as AdapterError;

    expect(error.code).toBe(ErrorCode.ALL_BACKENDS_FAILED);
    expect(error.isRetryable).toBe(false);
  });

  it('stays retryable when one parallel backend failed retryably', async () => {
    const router = new Router({ routingStrategy: 'round-robin' });
    router.register('a', createFailingBackend('a', permanentFailure).adapter);
    router.register('b', createFailingBackend('b', retryableFailure).adapter);

    const error = (await router
      .dispatchParallel(createTestRequest(), { strategy: 'all', backends: ['a', 'b'] })
      .catch((e: unknown) => e)) as AdapterError;

    expect(error.code).toBe(ErrorCode.ALL_BACKENDS_FAILED);
    expect(error.isRetryable).toBe(true);
  });

  it('carries the leaf failures on the composite', async () => {
    const router = new Router({ routingStrategy: 'round-robin' });
    router.register('a', createFailingBackend('a', permanentFailure).adapter);
    router.register('b', createFailingBackend('b', permanentFailure).adapter);

    const error = (await router
      .dispatchParallel(createTestRequest(), { strategy: 'all', backends: ['a', 'b'] })
      .catch((e: unknown) => e)) as RouterError;

    expect(error).toBeInstanceOf(RouterError);
    expect(error.attemptedBackends).toEqual(['a', 'b']);
    expect(error.backendErrors).toHaveLength(2);
    expect(error.backendErrors?.every((e) => e.name === 'AuthenticationError')).toBe(true);
  });

  it('is non-retryable when parallel *fallback* exhausts every backend non-retryably', async () => {
    const router = new Router({ fallbackStrategy: 'parallel' });
    router.register('a', createFailingBackend('a', permanentFailure).adapter);
    router.register('b', createFailingBackend('b', permanentFailure).adapter);

    const error = (await router
      .execute(createTestRequest())
      .catch((e: unknown) => e)) as AdapterError;

    expect(error.code).toBe(ErrorCode.ALL_BACKENDS_FAILED);
    expect(error.isRetryable).toBe(false);
  });

  it('stays retryable when parallel fallback had one retryable leaf', async () => {
    const router = new Router({ fallbackStrategy: 'parallel' });
    router.register('a', createFailingBackend('a', permanentFailure).adapter);
    router.register('b', createFailingBackend('b', retryableFailure).adapter);

    const error = (await router
      .execute(createTestRequest())
      .catch((e: unknown) => e)) as AdapterError;

    expect(error.code).toBe(ErrorCode.ALL_BACKENDS_FAILED);
    expect(error.isRetryable).toBe(true);
  });

  it('builds every ALL_BACKENDS_FAILED through RouterError, including with no backends', async () => {
    // Sequential fallback with nothing available: nothing was attempted, so
    // there is no evidence of a transient fault and the answer is the same
    // non-retryable one the parallel paths give for all-permanent leaves.
    const router = new Router({ fallbackStrategy: 'sequential' });

    const error = (await router
      .execute(createTestRequest())
      .catch((e: unknown) => e)) as AdapterError;

    expect(error).toBeInstanceOf(RouterError);
    expect(error.code).toBe(ErrorCode.ALL_BACKENDS_FAILED);
    expect(error.isRetryable).toBe(false);
  });
});

// ============================================================================
// The two retry implementations agree on unknown errors
// ============================================================================

describe('the two retry implementations agree on unclassified errors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function attemptsUnderBridgeRetry(error: () => unknown): Promise<number> {
    const backend = createFailingBackend('b', error);
    const bridge = new Bridge(createMockFrontend(), backend.adapter, { retries: 2 });

    const settled = bridge.chat(HELLO as never).catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    await settled;

    return backend.attempts();
  }

  async function attemptsUnderRetryMiddleware(error: () => unknown): Promise<number> {
    const backend = createFailingBackend('b', error);
    const bridge = new Bridge(createMockFrontend(), backend.adapter);
    bridge.use(createRetryMiddleware({ maxAttempts: 3, initialDelay: 1, useJitter: false }));

    const settled = bridge.chat(HELLO as never).catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    await settled;

    return backend.attempts();
  }

  it('neither retries an unclassified error', async () => {
    const viaBridge = await attemptsUnderBridgeRetry(() => new Error('unclassified'));
    const viaMiddleware = await attemptsUnderRetryMiddleware(() => new Error('unclassified'));

    expect(viaBridge).toBe(1);
    expect(viaMiddleware).toBe(1);
    expect(viaBridge).toBe(viaMiddleware);
  });

  it('neither retries a thrown non-Error', async () => {
    expect(await attemptsUnderBridgeRetry(() => 'a string')).toBe(1);
    expect(await attemptsUnderRetryMiddleware(() => 'a string')).toBe(1);
  });

  it('both still retry a classified retryable error', async () => {
    expect(await attemptsUnderBridgeRetry(retryableFailure)).toBe(3);
    expect(await attemptsUnderRetryMiddleware(retryableFailure)).toBe(3);
  });

  it('neither retries a classified non-retryable error', async () => {
    expect(await attemptsUnderBridgeRetry(permanentFailure)).toBe(1);
    expect(await attemptsUnderRetryMiddleware(permanentFailure)).toBe(1);
  });

  it('both honour the flag duck-typed, across a package boundary', async () => {
    const foreign = () => Object.assign(new Error('from another realm'), { isRetryable: true });

    expect(await attemptsUnderBridgeRetry(foreign)).toBe(3);
    expect(await attemptsUnderRetryMiddleware(foreign)).toBe(3);
  });
});

// ============================================================================
// HTTP status classification
// ============================================================================

describe('createErrorFromHttpResponse retryability', () => {
  const classify = (statusCode: number): boolean =>
    createErrorFromHttpResponse(statusCode, 'Status Text', {}, {}).isRetryable;

  it('treats 408 Request Timeout as retryable', () => {
    // The one status whose entire meaning is "the server wants another
    // attempt"; it fell through to `statusCode >= 500` and came back false.
    expect(classify(408)).toBe(true);
  });

  it('treats 425 Too Early as retryable', () => {
    expect(classify(425)).toBe(true);
  });

  it.each([404, 409, 422, 405, 410])('treats %i as non-retryable', (statusCode) => {
    // Checked rather than assumed: a missing resource, a state conflict and a
    // semantically invalid payload all reproduce on an identical retry.
    expect(classify(statusCode)).toBe(false);
  });

  it.each([500, 502, 503, 504])('keeps %i retryable', (statusCode) => {
    expect(classify(statusCode)).toBe(true);
  });

  it('keeps the classified branches untouched', () => {
    expect(createErrorFromHttpResponse(401, 'Unauthorized', {}, {}).isRetryable).toBe(false);
    expect(createErrorFromHttpResponse(403, 'Forbidden', {}, {}).isRetryable).toBe(false);
    expect(createErrorFromHttpResponse(400, 'Bad Request', {}, {}).isRetryable).toBe(false);
    expect(createErrorFromHttpResponse(429, 'Too Many Requests', {}, {}).isRetryable).toBe(true);
  });

  it('makes a 408 actually retry rather than merely report as retryable', async () => {
    vi.useFakeTimers();
    try {
      const backend = createFailingBackend('b', () =>
        createErrorFromHttpResponse(408, 'Request Timeout', {}, {})
      );
      const bridge = new Bridge(createMockFrontend(), backend.adapter, { retries: 2 });

      const settled = bridge.chat(HELLO as never).catch((e: unknown) => e);
      await vi.runAllTimersAsync();
      await settled;

      expect(backend.attempts()).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
