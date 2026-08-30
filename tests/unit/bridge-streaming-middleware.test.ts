/**
 * Bridge Streaming Middleware Tests
 *
 * Regression tests for #46: middleware registered through `Bridge.use()` was
 * silently skipped for every streaming request, because `Bridge.use()` only
 * populated `MiddlewareStack.middleware` while `executeStream()` read the
 * always-empty `MiddlewareStack.streamingMiddleware`.
 *
 * Covers:
 * - `use()` middleware runs exactly once on both `chat()` and `chatStream()`
 * - request rewrites (PII redaction) reach the backend on the streaming path
 * - middleware errors propagate through `chatStream()`
 * - middleware ordering is preserved on the streaming path
 * - `useStreaming()` exposes stream-native middleware on the Bridge
 */

import { describe, it, expect, vi } from 'vitest';
import { Bridge } from '@johnhenry/aimatey-core';
import { MiddlewareError } from '@johnhenry/aimatey-errors';
import {
  createValidationMiddleware,
  createStreamingCostTrackingMiddleware,
} from '@johnhenry/aimatey-middleware';
import type {
  BackendAdapter,
  FrontendAdapter,
  IRChatRequest,
  IRChatResponse,
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

function createMockFrontend(): FrontendAdapter {
  return {
    metadata: {
      name: 'mock-frontend',
      version: '1.0.0',
      provider: 'Mock',
      capabilities: CAPABILITIES,
    },
    toIR: vi.fn((request: { messages?: unknown[] }) => ({
      messages: request.messages ?? [],
      metadata: {
        requestId: 'test-req-id',
        timestamp: Date.now(),
        provenance: {},
      },
    })),
    fromIR: vi.fn((response: IRChatResponse) => ({
      id: response.metadata.requestId,
      content: response.message.content,
    })),
    fromIRStream: vi.fn(async function* (stream: AsyncIterable<IRStreamChunk>) {
      for await (const chunk of stream) {
        yield chunk;
      }
    }),
  } as unknown as FrontendAdapter;
}

interface MockBackendOptions {
  readonly deltas?: readonly string[];
  readonly usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  /** Throw from `executeStream` before the first chunk is yielded. */
  readonly failStream?: Error;
  /** Throw from `executeStream` after the first chunk is yielded. */
  readonly failMidStream?: Error;
}

/** Requests the backend actually received, in order. */
interface MockBackend {
  readonly adapter: BackendAdapter;
  readonly executeRequests: IRChatRequest[];
  readonly executeStreamRequests: IRChatRequest[];
}

function createMockBackend(options: MockBackendOptions = {}): MockBackend {
  const {
    deltas = ['Hello', ' world'],
    usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    failStream,
    failMidStream,
  } = options;

  const executeRequests: IRChatRequest[] = [];
  const executeStreamRequests: IRChatRequest[] = [];

  const adapter = {
    metadata: {
      name: 'mock-backend',
      version: '1.0.0',
      provider: 'Mock',
      capabilities: CAPABILITIES,
    },
    fromIR: vi.fn((request: unknown) => request),
    toIR: vi.fn((response: unknown) => response),
    execute: vi.fn(async (request: IRChatRequest): Promise<IRChatResponse> => {
      executeRequests.push(request);
      return {
        message: { role: 'assistant', content: deltas.join('') },
        finishReason: 'stop',
        usage,
        metadata: {
          requestId: request.metadata.requestId,
          timestamp: Date.now(),
          provenance: { backend: 'mock-backend' },
        },
      };
    }),
    executeStream: vi.fn(async function* (request: IRChatRequest) {
      executeStreamRequests.push(request);
      if (failStream) {
        throw failStream;
      }

      let sequence = 0;
      yield {
        type: 'start',
        sequence: sequence++,
        metadata: {
          requestId: request.metadata.requestId,
          timestamp: Date.now(),
          provenance: { backend: 'mock-backend' },
        },
      } as IRStreamChunk;

      for (const delta of deltas) {
        yield { type: 'content', sequence: sequence++, delta, role: 'assistant' } as IRStreamChunk;
        if (failMidStream) {
          throw failMidStream;
        }
      }

      yield {
        type: 'done',
        sequence: sequence++,
        finishReason: 'stop',
        usage,
        message: { role: 'assistant', content: deltas.join('') },
      } as IRStreamChunk;
    }),
  } as unknown as BackendAdapter;

  return { adapter, executeRequests, executeStreamRequests };
}

function createBridge(backend: MockBackend): Bridge {
  return new Bridge(createMockFrontend(), backend.adapter);
}

async function drain(
  stream: AsyncIterable<IRStreamChunk>
): Promise<IRStreamChunk[]> {
  const chunks: IRStreamChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

function textOf(chunks: readonly IRStreamChunk[]): string {
  return chunks
    .filter((chunk): chunk is Extract<IRStreamChunk, { type: 'content' }> => chunk.type === 'content')
    .map((chunk) => chunk.delta)
    .join('');
}

const HELLO = { messages: [{ role: 'user', content: 'Hello' }] };

// ============================================================================
// The regression itself
// ============================================================================

describe('Bridge.use() middleware on the streaming path (#46)', () => {
  it('runs a counting middleware exactly once for chat() and once for chatStream()', async () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);

    let calls = 0;
    const counting: Middleware = async (_context, next) => {
      calls++;
      return next();
    };
    bridge.use(counting);

    await bridge.chat(HELLO as never);
    expect(calls).toBe(1);

    await drain(bridge.chatStream(HELLO as never));
    expect(calls).toBe(2);
  });

  it('still reports the middleware through getMiddleware()', () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);
    const mw: Middleware = async (_c, next) => next();

    bridge.use(mw);

    expect(bridge.getMiddleware()).toEqual([mw]);
    expect(bridge.getStreamingMiddleware()).toEqual([]);
  });

  it('does not run middleware that was removed before streaming', async () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);

    let calls = 0;
    const counting: Middleware = async (_context, next) => {
      calls++;
      return next();
    };

    bridge.use(counting);
    bridge.removeMiddleware(counting);

    await drain(bridge.chatStream(HELLO as never));

    expect(calls).toBe(0);
    expect(bridge.getMiddleware()).toEqual([]);
  });
});

// ============================================================================
// Request rewrites reach the backend
// ============================================================================

describe('request rewrites from middleware reach the backend', () => {
  const PII_PROMPT = 'My email is john@example.com and my phone is 555-123-4567';

  const redacting = () =>
    createValidationMiddleware({
      detectPII: true,
      piiAction: 'redact',
      preventPromptInjection: false,
      logWarnings: false,
    });

  it('redacts PII on the streaming path', async () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);
    bridge.use(redacting());

    await drain(bridge.chatStream({ messages: [{ role: 'user', content: PII_PROMPT }] } as never));

    expect(backend.executeStreamRequests).toHaveLength(1);
    const delivered = backend.executeStreamRequests[0]!.messages[0]!.content as string;
    expect(delivered).not.toContain('john@example.com');
    expect(delivered).not.toContain('555-123-4567');
    expect(delivered).toContain('[REDACTED_EMAIL]');
    expect(delivered).toContain('[REDACTED_PHONE]');
  });

  it('redacts PII on the non-streaming path', async () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);
    bridge.use(redacting());

    await bridge.chat({ messages: [{ role: 'user', content: PII_PROMPT }] } as never);

    expect(backend.executeRequests).toHaveLength(1);
    const delivered = backend.executeRequests[0]!.messages[0]!.content as string;
    expect(delivered).toContain('[REDACTED_EMAIL]');
    expect(delivered).toContain('[REDACTED_PHONE]');
  });

  it('passes rewrites through the whole chain in order', async () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);

    const append = (suffix: string): Middleware => async (context, next) => {
      const [message] = context.request.messages;
      context.request = {
        ...context.request,
        messages: [{ ...message!, content: `${message!.content as string}${suffix}` }],
      };
      return next();
    };

    bridge.use(append('-one'));
    bridge.use(append('-two'));

    await drain(bridge.chatStream(HELLO as never));

    expect(backend.executeStreamRequests[0]!.messages[0]!.content).toBe('Hello-one-two');
  });
});

// ============================================================================
// Error propagation
// ============================================================================

describe('middleware errors on the streaming path', () => {
  it('propagates an error thrown before next() through chatStream()', async () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);

    const failing: Middleware = async () => {
      throw new Error('middleware exploded');
    };
    bridge.use(failing);

    await expect(drain(bridge.chatStream(HELLO as never))).rejects.toThrow(/middleware exploded/);
    expect(backend.adapter.executeStream).not.toHaveBeenCalled();
  });

  it('wraps a non-MiddlewareError as a MiddlewareError, like chat() does', async () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);

    const failing: Middleware = async () => {
      throw new Error('boom');
    };
    bridge.use(failing);

    await expect(drain(bridge.chatStream(HELLO as never))).rejects.toBeInstanceOf(MiddlewareError);
    await expect(bridge.chat(HELLO as never)).rejects.toBeInstanceOf(MiddlewareError);
  });

  it('surfaces an error thrown after next() while the stream is consumed', async () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);

    const failing: Middleware = async (_context, next) => {
      await next();
      throw new Error('post-phase exploded');
    };
    bridge.use(failing);

    await expect(drain(bridge.chatStream(HELLO as never))).rejects.toThrow(/post-phase exploded/);
  });

  it('lets a backend stream error reach both the consumer and the middleware', async () => {
    const backend = createMockBackend({ failMidStream: new Error('backend died') });
    const bridge = createBridge(backend);

    let seen: unknown;
    const observing: Middleware = async (_context, next) => {
      try {
        return await next();
      } catch (error) {
        seen = error;
        throw error;
      }
    };
    bridge.use(observing);

    await expect(drain(bridge.chatStream(HELLO as never))).rejects.toThrow(/backend died/);
    expect((seen as Error).message).toMatch(/backend died/);
  });
});

// ============================================================================
// Ordering
// ============================================================================

describe('middleware ordering on the streaming path', () => {
  it('preserves onion ordering across the request and response phases', async () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);
    const log: string[] = [];

    const tracer = (name: string): Middleware => async (_context, next) => {
      log.push(`${name}-before`);
      const response = await next();
      log.push(`${name}-after`);
      return response;
    };

    bridge.use(tracer('mw1'));
    bridge.use(tracer('mw2'));
    bridge.use(tracer('mw3'));

    await drain(bridge.chatStream(HELLO as never));

    expect(log).toEqual([
      'mw1-before',
      'mw2-before',
      'mw3-before',
      'mw3-after',
      'mw2-after',
      'mw1-after',
    ]);
  });

  it('interleaves use() and useStreaming() in registration order', async () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);
    const log: string[] = [];

    const standard = (name: string): Middleware => async (_context, next) => {
      log.push(name);
      return next();
    };
    const streaming = (name: string): StreamingMiddleware => async (_context, next) => {
      log.push(name);
      return next();
    };

    bridge.use(standard('standard-1'));
    bridge.useStreaming(streaming('streaming-1'));
    bridge.use(standard('standard-2'));

    await drain(bridge.chatStream(HELLO as never));

    expect(log).toEqual(['standard-1', 'streaming-1', 'standard-2']);
  });

  it('delivers chunks before the response phase runs', async () => {
    const backend = createMockBackend({ deltas: ['a', 'b', 'c'] });
    const bridge = createBridge(backend);

    const log: string[] = [];
    const tracer: Middleware = async (_context, next) => {
      const response = await next();
      log.push('response-phase');
      return response;
    };
    bridge.use(tracer);

    for await (const chunk of bridge.chatStream(HELLO as never)) {
      if (chunk.type === 'content') {
        log.push(`chunk:${chunk.delta}`);
      }
    }

    expect(log).toEqual(['chunk:a', 'chunk:b', 'chunk:c', 'response-phase']);
  });
});

// ============================================================================
// The assembled response handed to the response phase
// ============================================================================

describe('the response a middleware observes on the streaming path', () => {
  it('carries the real content, usage and finish reason', async () => {
    const backend = createMockBackend({
      deltas: ['Hello', ' world'],
      usage: { promptTokens: 7, completionTokens: 3, totalTokens: 10 },
    });
    const bridge = createBridge(backend);

    let observed: IRChatResponse | undefined;
    const observing: Middleware = async (_context, next) => {
      observed = await next();
      return observed;
    };
    bridge.use(observing);

    await drain(bridge.chatStream(HELLO as never));

    expect(observed?.message.content).toBe('Hello world');
    expect(observed?.finishReason).toBe('stop');
    expect(observed?.usage).toEqual({ promptTokens: 7, completionTokens: 3, totalTokens: 10 });
  });

  it('is explicitly marked as assembled from a stream', async () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);

    let observed: IRChatResponse | undefined;
    const observing: Middleware = async (_context, next) => {
      observed = await next();
      return observed;
    };
    bridge.use(observing);

    await drain(bridge.chatStream(HELLO as never));

    expect(observed?.metadata.custom?.assembledFromStream).toBe(true);
    expect(observed?.metadata.warnings ?? []).toContainEqual(
      expect.objectContaining({
        category: 'capability-unsupported',
        severity: 'info',
        source: 'middleware-stack',
      })
    );
  });

  it('reports finishReason "cancelled" when the consumer abandons the stream', async () => {
    const backend = createMockBackend({ deltas: ['a', 'b', 'c'] });
    const bridge = createBridge(backend);

    let observed: IRChatResponse | undefined;
    const observing: Middleware = async (_context, next) => {
      observed = await next();
      return observed;
    };
    bridge.use(observing);

    for await (const chunk of bridge.chatStream(HELLO as never)) {
      if (chunk.type === 'content') {
        break;
      }
    }

    expect(observed?.finishReason).toBe('cancelled');
    expect(observed?.message.content).toBe('a');
  });

  it('replays a short-circuited response as a stream without calling the backend', async () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);

    const shortCircuit: Middleware = async (context) => ({
      message: { role: 'assistant', content: 'from cache' },
      finishReason: 'stop',
      metadata: context.request.metadata,
    });
    bridge.use(shortCircuit);

    const chunks = await drain(bridge.chatStream(HELLO as never));

    expect(backend.adapter.executeStream).not.toHaveBeenCalled();
    expect(textOf(chunks)).toBe('from cache');
    expect(chunks[0]?.type).toBe('start');
    expect(chunks.at(-1)?.type).toBe('done');
  });

  it('rejects a second next() call rather than silently skipping the chain', async () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);

    const doubleNext: Middleware = async (_context, next) => {
      await next();
      return next();
    };
    bridge.use(doubleNext);

    await expect(drain(bridge.chatStream(HELLO as never))).rejects.toBeInstanceOf(MiddlewareError);
  });
});

// ============================================================================
// Stream-native middleware
// ============================================================================

describe('Bridge.useStreaming()', () => {
  it('runs stream-native middleware on chatStream() only', async () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);

    let calls = 0;
    const streaming: StreamingMiddleware = async (_context, next) => {
      calls++;
      return next();
    };
    bridge.useStreaming(streaming);

    await bridge.chat(HELLO as never);
    expect(calls).toBe(0);

    await drain(bridge.chatStream(HELLO as never));
    expect(calls).toBe(1);

    expect(bridge.getStreamingMiddleware()).toEqual([streaming]);
    expect(bridge.getMiddleware()).toEqual([]);
  });

  it('lets stream-native middleware transform chunks', async () => {
    const backend = createMockBackend({ deltas: ['a', 'b'] });
    const bridge = createBridge(backend);

    const upperCase: StreamingMiddleware = async (_context, next) => {
      const stream = await next();
      return (async function* () {
        for await (const chunk of stream) {
          yield chunk.type === 'content' ? { ...chunk, delta: chunk.delta.toUpperCase() } : chunk;
        }
      })();
    };
    bridge.useStreaming(upperCase);

    const chunks = await drain(bridge.chatStream(HELLO as never));

    expect(textOf(chunks)).toBe('AB');
  });

  it('makes createStreamingCostTrackingMiddleware reachable from the Bridge', async () => {
    const backend = createMockBackend({
      usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
    });
    const bridge = createBridge(backend);

    const costs: unknown[] = [];
    bridge.useStreaming(
      createStreamingCostTrackingMiddleware({
        onCost: (cost) => {
          costs.push(cost);
        },
      })
    );

    await drain(bridge.chatStream(HELLO as never));

    expect(costs).toHaveLength(1);
    expect(costs[0]).toMatchObject({ inputTokens: 1000, outputTokens: 500 });
  });

  it('removes stream-native middleware through removeStreamingMiddleware()', async () => {
    const backend = createMockBackend();
    const bridge = createBridge(backend);

    let calls = 0;
    const streaming: StreamingMiddleware = async (_context, next) => {
      calls++;
      return next();
    };

    bridge.useStreaming(streaming);
    bridge.removeStreamingMiddleware(streaming);

    await drain(bridge.chatStream(HELLO as never));

    expect(calls).toBe(0);
    expect(bridge.getStreamingMiddleware()).toEqual([]);
  });
});
