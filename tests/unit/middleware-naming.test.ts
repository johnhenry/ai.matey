/**
 * Middleware Naming Tests
 *
 * Regression tests for #71: `MiddlewareError.middlewareName` existed, was
 * typed and documented, and never held a middleware name. The four sites that
 * set it hardcoded the literal `'unknown'`; the two that actually wrap a
 * middleware failure omitted it - so a stack of eight middleware reported
 * `Middleware execution failed: <message>` with no indication of which one
 * broke. The blocker was that `MiddlewareStack` entries carried no name at all.
 *
 * Covers:
 * - an explicit `use(mw, { name })` reaches the failure message
 * - the function's own `.name` is used when no name is given
 * - an anonymous middleware falls back to its registration position
 * - the position is the *registration* index on both the streaming and the
 *   non-streaming path
 * - `use()` and `useStreaming()` still accept a single argument
 */

import { describe, it, expect } from 'vitest';
import {
  Bridge,
  MiddlewareStack,
  createMiddlewareContext,
  createStreamingMiddlewareContext,
} from '@johnhenry/aimatey-core';
import { MiddlewareError } from '@johnhenry/aimatey-errors';
import type {
  BackendAdapter,
  FrontendAdapter,
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRStreamChunk,
  Middleware,
  StreamingMiddleware,
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

function createTestRequest(): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    metadata: { requestId: 'test-req-id', timestamp: Date.now(), provenance: {} },
  };
}

/** A middleware that does nothing but pass the request along. */
function passThrough(): Middleware {
  return async (_context, next) => next();
}

function passThroughStreaming(): StreamingMiddleware {
  return async (_context, next) => next();
}

/**
 * Run `stack.execute` with a middleware chain and return the failure.
 */
async function failureFrom(stack: MiddlewareStack): Promise<MiddlewareError> {
  const context = createMiddlewareContext(createTestRequest(), {});
  return (await stack
    .execute(context, () => Promise.resolve({} as IRChatResponse))
    .catch((e: unknown) => e)) as MiddlewareError;
}

async function streamingFailureFrom(stack: MiddlewareStack): Promise<MiddlewareError> {
  const context = createStreamingMiddlewareContext(createTestRequest(), {});
  return (await stack
    .executeStream(context, () => Promise.resolve({} as unknown as IRChatStream))
    .catch((e: unknown) => e)) as MiddlewareError;
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
    fromIR: (response: IRChatResponse) => ({ id: response.metadata.requestId }),
    fromIRStream: async function* (stream: AsyncIterable<IRStreamChunk>) {
      for await (const chunk of stream) {
        yield chunk;
      }
    },
  } as unknown as FrontendAdapter;
}

function createMockBackend(): BackendAdapter {
  return {
    metadata: { name: 'mock-backend', version: '1.0.0', provider: 'Mock', capabilities: CAPABILITIES },
    fromIR: (request: unknown) => request,
    toIR: (response: unknown) => response,
    execute: async (request: IRChatRequest): Promise<IRChatResponse> => ({
      message: { role: 'assistant', content: 'Hi' },
      finishReason: 'stop',
      metadata: { requestId: request.metadata.requestId, timestamp: Date.now(), provenance: {} },
    }),
  } as unknown as BackendAdapter;
}

// ============================================================================
// The failure says which middleware failed
// ============================================================================

describe('a middleware failure names the middleware', () => {
  it('uses the name given at registration', async () => {
    const stack = new MiddlewareStack();
    stack.use(
      async () => {
        throw new Error('boom');
      },
      { name: 'rate-limit' }
    );

    const error = await failureFrom(stack);

    expect(error).toBeInstanceOf(MiddlewareError);
    expect(error.middlewareName).toBe('rate-limit');
    expect(error.message).toBe('Middleware "rate-limit" failed: boom');
  });

  it('uses the function declaration name when none is given', async () => {
    const stack = new MiddlewareStack();
    stack.use(async function redactPii(): Promise<IRChatResponse> {
      throw new Error('boom');
    });

    const error = await failureFrom(stack);

    expect(error.middlewareName).toBe('redactPii');
    expect(error.message).toContain('"redactPii"');
  });

  it('uses the inferred name of an arrow assigned to a const', async () => {
    const auditLog: Middleware = async () => {
      throw new Error('boom');
    };

    const stack = new MiddlewareStack();
    stack.use(auditLog);

    const error = await failureFrom(stack);

    expect(error.middlewareName).toBe('auditLog');
  });

  it('prefers an explicit name over the function name', async () => {
    const auditLog: Middleware = async () => {
      throw new Error('boom');
    };

    const stack = new MiddlewareStack();
    stack.use(auditLog, { name: 'audit' });

    expect((await failureFrom(stack)).middlewareName).toBe('audit');
  });

  it('never reports the old placeholder', async () => {
    const stack = new MiddlewareStack();
    stack.use(async () => {
      throw new Error('boom');
    });

    const error = await failureFrom(stack);

    expect(error.middlewareName).toBeDefined();
    expect(error.middlewareName).not.toBe('unknown');
  });
});

// ============================================================================
// The positional fallback
// ============================================================================

describe('an anonymous middleware falls back to its position', () => {
  it('names an anonymous middleware by registration index', async () => {
    const stack = new MiddlewareStack();
    stack.use(passThrough());
    stack.use(passThrough());
    stack.use(async () => {
      throw new Error('boom');
    });

    const error = await failureFrom(stack);

    // The factories in this repo all `return async (context, next) => {...}`,
    // so the position is what most real chains will report.
    expect(error.middlewareName).toBe('middleware[2]');
    expect(error.message).toBe('Middleware "middleware[2]" failed: boom');
  });

  it('discards a function name that identifies nothing', async () => {
    // `createConversationHistoryMiddleware` really does produce a function
    // named `middleware`; `Middleware "middleware" failed` names no more than
    // the `'unknown'` this replaced, so the position wins.
    const middleware: Middleware = async () => {
      throw new Error('boom');
    };

    const stack = new MiddlewareStack();
    stack.use(passThrough());
    stack.use(middleware);

    expect((await failureFrom(stack)).middlewareName).toBe('middleware[1]');
  });

  it('uses the registration index, not the position in the standard chain', async () => {
    const stack = new MiddlewareStack();
    stack.use(passThrough()); // registration 0
    stack.useStreaming(passThroughStreaming()); // registration 1, skipped here
    stack.use(async () => {
      throw new Error('boom');
    }); // registration 2

    // Counting only the `use()` entries would call this `middleware[1]` and
    // the same middleware `middleware[2]` on the streaming path.
    expect((await failureFrom(stack)).middlewareName).toBe('middleware[2]');
  });

  it('gives the same middleware the same name on the streaming path', async () => {
    const build = (): MiddlewareStack => {
      const stack = new MiddlewareStack();
      stack.use(passThrough());
      stack.useStreaming(passThroughStreaming());
      stack.use(async () => {
        throw new Error('boom');
      });
      return stack;
    };

    const standard = await failureFrom(build());
    const streaming = await streamingFailureFrom(build());

    expect(streaming.middlewareName).toBe(standard.middlewareName);
    expect(streaming.middlewareName).toBe('middleware[2]');
  });
});

// ============================================================================
// Streaming registrations
// ============================================================================

describe('streaming middleware is named too', () => {
  it('uses the name given at registration', async () => {
    const stack = new MiddlewareStack();
    stack.useStreaming(
      async () => {
        throw new Error('boom');
      },
      { name: 'chunk-filter' }
    );

    const error = await streamingFailureFrom(stack);

    expect(error.middlewareName).toBe('chunk-filter');
    expect(error.message).toBe('Streaming middleware "chunk-filter" failed: boom');
  });

  it('falls back to the registration index', async () => {
    const stack = new MiddlewareStack();
    stack.useStreaming(passThroughStreaming());
    stack.useStreaming(async () => {
      throw new Error('boom');
    });

    expect((await streamingFailureFrom(stack)).middlewareName).toBe('middleware[1]');
  });
});

// ============================================================================
// The lock guards stop lying
// ============================================================================

describe('lock-guard errors', () => {
  it('names the middleware that could not be added', () => {
    const stack = new MiddlewareStack();
    stack.lock();

    const rateLimit: Middleware = async (_context, next) => next();
    const error = (() => {
      try {
        stack.use(rateLimit);
        return undefined;
      } catch (e: unknown) {
        return e as MiddlewareError;
      }
    })();

    expect(error?.middlewareName).toBe('rateLimit');
  });

  it('reports no name rather than the "unknown" placeholder', () => {
    const stack = new MiddlewareStack();
    stack.lock();

    const error = (() => {
      try {
        stack.use(async (_context, next) => next());
        return undefined;
      } catch (e: unknown) {
        return e as MiddlewareError;
      }
    })();

    expect(error).toBeInstanceOf(MiddlewareError);
    expect(error?.middlewareName).toBeUndefined();
  });
});

// ============================================================================
// The registration signature stays backward compatible
// ============================================================================

describe('registration stays backward compatible', () => {
  it('accepts use() and useStreaming() with a single argument', async () => {
    const bridge = new Bridge(createMockFrontend(), createMockBackend());

    expect(() => bridge.use(passThrough())).not.toThrow();
    expect(() => bridge.useStreaming(passThroughStreaming())).not.toThrow();

    await expect(
      bridge.chat({ messages: [{ role: 'user', content: 'Hello' }] } as never)
    ).resolves.toBeDefined();
  });

  it('keeps remove() working for middleware registered with a name', () => {
    const stack = new MiddlewareStack();
    const middleware = passThrough();

    stack.use(middleware, { name: 'named' });

    expect(stack.getMiddleware()).toEqual([middleware]);
    expect(stack.remove(middleware)).toBe(true);
    expect(stack.getMiddleware()).toEqual([]);
  });

  it('names a middleware registered through the bridge', async () => {
    const bridge = new Bridge(createMockFrontend(), createMockBackend());
    bridge.use(
      async () => {
        throw new Error('boom');
      },
      { name: 'guard' }
    );

    const error = (await bridge
      .chat({ messages: [{ role: 'user', content: 'Hello' }] } as never)
      .catch((e: unknown) => e)) as MiddlewareError;

    expect(error).toBeInstanceOf(MiddlewareError);
    expect(error.middlewareName).toBe('guard');
    expect(error.message).toContain('"guard"');
  });
});
