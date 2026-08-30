/**
 * Middleware Error Classification Tests
 *
 * Regression tests for #65: `MiddlewareStack` re-labelled every failure that
 * merely passed *through* a middleware as a `MiddlewareError`, and
 * `MiddlewareError` hard-coded `isRetryable: false`. A retryable `NetworkError`
 * raised by the backend therefore reached the retry middleware already
 * reclassified as non-retryable, so `createRetryMiddleware` stopped retrying as
 * soon as any middleware was registered after it - and the error the caller
 * finally saw claimed a transient network failure was permanent.
 *
 * Covers:
 * - retry happens the configured number of times wherever retry sits in the chain
 * - the surfaced error keeps the original `code` and `isRetryable`
 * - the same backend failure surfaces as the same error with 0, 1 and 3 middleware
 * - failures a middleware raises *itself* are still wrapped
 * - `MiddlewareError` carries the retryability of its cause
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Bridge,
  MiddlewareStack,
  createMiddlewareContext,
  createStreamingMiddlewareContext,
} from '@johnhenry/aimatey-core';
import { createRetryMiddleware } from '@johnhenry/aimatey-middleware';
import {
  AdapterError,
  ErrorCode,
  MiddlewareError,
  NetworkError,
  ValidationError,
} from '@johnhenry/aimatey-errors';
import type {
  BackendAdapter,
  FrontendAdapter,
  IRChatRequest,
  IRChatResponse,
  IRStreamChunk,
  Middleware,
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
      metadata: {
        requestId: 'test-req-id',
        timestamp: Date.now(),
        provenance: {},
      },
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

interface FailingBackend {
  readonly adapter: BackendAdapter;
  /** Number of times the backend was actually reached. */
  attempts(): number;
}

/** Backend that always fails with `error`, counting how often it was reached. */
function createFailingBackend(error: unknown): FailingBackend {
  let attempts = 0;

  const adapter = {
    metadata: {
      name: 'failing-backend',
      version: '1.0.0',
      provider: 'Mock',
      capabilities: CAPABILITIES,
    },
    fromIR: (request: unknown) => request,
    toIR: (response: unknown) => response,
    execute: async (): Promise<IRChatResponse> => {
      attempts++;
      throw error;
    },
    executeStream: async function* (): AsyncGenerator<IRStreamChunk, void, undefined> {
      attempts++;
      throw error;
    },
  } as unknown as BackendAdapter;

  return { adapter, attempts: () => attempts };
}

function transientNetworkError(): NetworkError {
  return new NetworkError({
    code: ErrorCode.NETWORK_ERROR,
    message: 'transient',
    provenance: {},
  });
}

/** A middleware that does nothing but pass the request along. */
function passThrough(): Middleware {
  return async (_context, next) => next();
}

function createTestRequest(): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    metadata: {
      requestId: 'test-req-id',
      timestamp: Date.now(),
      provenance: {},
    },
  };
}

/** Retry that is fast enough to run on real timers. */
function fastRetry(maxAttempts: number): Middleware {
  return createRetryMiddleware({
    maxAttempts,
    initialDelay: 1,
    backoffMultiplier: 1,
    useJitter: false,
  });
}

// ============================================================================
// Retry is not disabled by its position in the chain
// ============================================================================

describe('createRetryMiddleware is not disabled by its position in the chain', () => {
  it('retries a retryable backend error when it is registered last', async () => {
    const backend = createFailingBackend(transientNetworkError());
    const bridge = new Bridge(createMockFrontend(), backend.adapter);

    bridge.use(passThrough());
    bridge.use(fastRetry(3));

    await expect(bridge.chat(HELLO as never)).rejects.toThrow();
    expect(backend.attempts()).toBe(3);
  });

  it('retries a retryable backend error when a middleware is registered after it', async () => {
    const backend = createFailingBackend(transientNetworkError());
    const bridge = new Bridge(createMockFrontend(), backend.adapter);

    bridge.use(fastRetry(3));
    bridge.use(passThrough());

    await expect(bridge.chat(HELLO as never)).rejects.toThrow();
    expect(backend.attempts()).toBe(3);
  });

  it('retries a retryable backend error from the middle of a three-middleware chain', async () => {
    const backend = createFailingBackend(transientNetworkError());
    const bridge = new Bridge(createMockFrontend(), backend.adapter);

    bridge.use(passThrough());
    bridge.use(fastRetry(3));
    bridge.use(passThrough());

    await expect(bridge.chat(HELLO as never)).rejects.toThrow();
    expect(backend.attempts()).toBe(3);
  });

  it('reaches the backend the same number of times wherever retry sits', async () => {
    const positions: readonly number[] = [0, 1, 2];
    const reached: number[] = [];

    for (const position of positions) {
      const backend = createFailingBackend(transientNetworkError());
      const bridge = new Bridge(createMockFrontend(), backend.adapter);

      const chain: Middleware[] = [passThrough(), passThrough()];
      chain.splice(position, 0, fastRetry(4));
      for (const middleware of chain) {
        bridge.use(middleware);
      }

      await expect(bridge.chat(HELLO as never)).rejects.toThrow();
      reached.push(backend.attempts());
    }

    expect(reached).toEqual([4, 4, 4]);
  });
});

// ============================================================================
// The surfaced error keeps its classification
// ============================================================================

describe('the error surfaced to the caller keeps its classification', () => {
  it('preserves code and isRetryable through a middleware chain', async () => {
    const original = transientNetworkError();
    const backend = createFailingBackend(original);
    const bridge = new Bridge(createMockFrontend(), backend.adapter);

    bridge.use(passThrough());

    const error = await bridge.chat(HELLO as never).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe(ErrorCode.NETWORK_ERROR);
    expect((error as AdapterError).isRetryable).toBe(true);
  });

  it('surfaces the very error the backend threw', async () => {
    const original = transientNetworkError();
    const backend = createFailingBackend(original);
    const bridge = new Bridge(createMockFrontend(), backend.adapter);

    bridge.use(passThrough());
    bridge.use(passThrough());

    await expect(bridge.chat(HELLO as never)).rejects.toBe(original);
  });

  it('preserves classification through MiddlewareStack.execute()', async () => {
    const stack = new MiddlewareStack();
    stack.use(passThrough());

    const original = transientNetworkError();
    const context = createMiddlewareContext(createTestRequest(), {});

    await expect(
      stack.execute(context, () => Promise.reject(original))
    ).rejects.toBe(original);
  });

  it('preserves classification through MiddlewareStack.executeStream()', async () => {
    const stack = new MiddlewareStack();
    stack.use(passThrough());

    const original = transientNetworkError();
    const context = createStreamingMiddlewareContext(createTestRequest(), {});

    await expect(
      stack.executeStream(context, () => Promise.reject(original))
    ).rejects.toBe(original);
  });
});

// ============================================================================
// The error does not depend on how many middleware are registered
// ============================================================================

describe('the error a caller sees does not depend on how many middleware are registered', () => {
  it('produces the same error for an AdapterError backend failure with zero, one and three middleware', async () => {
    const seen: { name: string; code: string; isRetryable: boolean }[] = [];

    for (const count of [0, 1, 3]) {
      const backend = createFailingBackend(transientNetworkError());
      const bridge = new Bridge(createMockFrontend(), backend.adapter);
      for (let i = 0; i < count; i++) {
        bridge.use(passThrough());
      }

      const error = (await bridge.chat(HELLO as never).catch((e: unknown) => e)) as AdapterError;
      seen.push({ name: error.name, code: error.code, isRetryable: error.isRetryable });
    }

    expect(seen[1]).toEqual(seen[0]);
    expect(seen[2]).toEqual(seen[0]);
    expect(seen[0]).toEqual({
      name: 'NetworkError',
      code: ErrorCode.NETWORK_ERROR,
      isRetryable: true,
    });
  });

  it('produces the same error for a non-AdapterError backend failure with zero, one and three middleware', async () => {
    const seen: { name: string; code: string }[] = [];

    for (const count of [0, 1, 3]) {
      const backend = createFailingBackend(new TypeError('fetch failed'));
      const bridge = new Bridge(createMockFrontend(), backend.adapter);
      for (let i = 0; i < count; i++) {
        bridge.use(passThrough());
      }

      const error = (await bridge.chat(HELLO as never).catch((e: unknown) => e)) as AdapterError;
      seen.push({ name: error.name, code: error.code });
    }

    expect(seen[1]).toEqual(seen[0]);
    expect(seen[2]).toEqual(seen[0]);
  });
});

// ============================================================================
// Failures a middleware raises itself are still wrapped
// ============================================================================

describe('failures raised by a middleware itself', () => {
  it('wraps a plain Error thrown by a middleware in a MiddlewareError', async () => {
    const stack = new MiddlewareStack();
    stack.use(async () => {
      throw new Error('middleware bug');
    });

    const context = createMiddlewareContext(createTestRequest(), {});
    const error = await stack
      .execute(context, () => Promise.resolve({} as IRChatResponse))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MiddlewareError);
    expect((error as MiddlewareError).code).toBe(ErrorCode.MIDDLEWARE_ERROR);
  });

  it('lets an AdapterError thrown by a middleware through with its own classification', async () => {
    const stack = new MiddlewareStack();
    const validationError = new ValidationError({
      code: ErrorCode.INVALID_REQUEST,
      message: 'bad request',
      validationDetails: [],
      provenance: {},
    });
    stack.use(async () => {
      throw validationError;
    });

    const context = createMiddlewareContext(createTestRequest(), {});

    await expect(
      stack.execute(context, () => Promise.resolve({} as IRChatResponse))
    ).rejects.toBe(validationError);
  });
});

// ============================================================================
// MiddlewareError classification
// ============================================================================

describe('MiddlewareError', () => {
  it('carries the retryability of the error it wraps', () => {
    const error = new MiddlewareError({
      message: 'wrapped',
      cause: transientNetworkError(),
    });

    expect(error.isRetryable).toBe(true);
  });

  it('is non-retryable without a cause', () => {
    expect(new MiddlewareError({ message: 'no cause' }).isRetryable).toBe(false);
  });

  it('is non-retryable for a cause that carries no classification', () => {
    const error = new MiddlewareError({
      message: 'wrapped',
      cause: new Error('plain'),
    });

    expect(error.isRetryable).toBe(false);
  });

  it('is non-retryable for a non-retryable cause', () => {
    const error = new MiddlewareError({
      message: 'wrapped',
      cause: new ValidationError({
        code: ErrorCode.INVALID_REQUEST,
        message: 'bad request',
        validationDetails: [],
        provenance: {},
      }),
    });

    expect(error.isRetryable).toBe(false);
  });
});

// ============================================================================
// Bridge-level retry (config.retries) is unblocked too
// ============================================================================

describe('Bridge config.retries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a retryable backend error even with middleware registered', async () => {
    const backend = createFailingBackend(transientNetworkError());
    const bridge = new Bridge(createMockFrontend(), backend.adapter, { retries: 2 });

    bridge.use(passThrough());

    const settled = bridge.chat(HELLO as never).catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    await settled;

    expect(backend.attempts()).toBe(3);
  });
});
