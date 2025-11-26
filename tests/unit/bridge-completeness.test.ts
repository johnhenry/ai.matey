/**
 * Bridge Completeness Tests
 *
 * Tests for the logical completeness gaps identified in the Bridge class.
 * Covers: removeMiddleware, event emission, checkHealth, getConfig, retry logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Bridge } from 'ai.matey.core';
import { BridgeEventType } from 'ai.matey.types';
import type {
  FrontendAdapter,
  BackendAdapter,
  Middleware,
  IRChatRequest,
  IRChatResponse,
  BridgeEventData,
} from 'ai.matey.types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockFrontend(): FrontendAdapter {
  return {
    metadata: {
      name: 'mock-frontend',
      version: '1.0.0',
      provider: 'Mock',
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: false,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: true,
      },
    },
    toIR: vi.fn((request: any) => ({
      messages: request.messages || [],
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
    fromIRStream: vi.fn(async function* (stream) {
      for await (const chunk of stream) {
        yield chunk;
      }
    }),
  } as unknown as FrontendAdapter;
}

function createMockBackend(options?: {
  healthCheck?: () => Promise<boolean>;
  shouldFail?: boolean;
  failCount?: number;
}): BackendAdapter {
  let callCount = 0;
  const failCount = options?.failCount ?? 0;

  return {
    metadata: {
      name: 'mock-backend',
      version: '1.0.0',
      provider: 'Mock',
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: false,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: true,
      },
    },
    fromIR: vi.fn((request) => request),
    toIR: vi.fn((response) => response),
    execute: vi.fn(async (request: IRChatRequest) => {
      callCount++;
      if (options?.shouldFail || (failCount > 0 && callCount <= failCount)) {
        throw new Error('Backend execution failed');
      }
      return {
        message: { role: 'assistant', content: 'Hello!' },
        finishReason: 'stop',
        metadata: {
          requestId: request.metadata.requestId,
          provenance: { backend: 'mock-backend' },
        },
      } as IRChatResponse;
    }),
    executeStream: vi.fn(async function* () {
      yield { type: 'start', sequence: 0 };
      yield { type: 'content', sequence: 1, delta: 'Hello', role: 'assistant' };
      yield { type: 'done', sequence: 2, finishReason: 'stop', message: { role: 'assistant', content: 'Hello' } };
    }),
    healthCheck: options?.healthCheck ?? (async () => true),
  } as unknown as BackendAdapter;
}

function createTestMiddleware(name: string): Middleware {
  const middleware: Middleware = async function(context, next) {
    context.state[`${name}-before`] = true;
    const result = await next();
    context.state[`${name}-after`] = true;
    return result;
  };
  Object.defineProperty(middleware, 'name', { value: name, writable: true });
  return middleware;
}

// ============================================================================
// removeMiddleware Tests
// ============================================================================

describe('Bridge.removeMiddleware', () => {
  it('should remove a specific middleware from the stack', () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend();
    const bridge = new Bridge(frontend, backend);

    const middleware1 = createTestMiddleware('mw1');
    const middleware2 = createTestMiddleware('mw2');
    const middleware3 = createTestMiddleware('mw3');

    bridge.use(middleware1).use(middleware2).use(middleware3);
    expect(bridge.getMiddleware()).toHaveLength(3);

    bridge.removeMiddleware(middleware2);

    const remaining = bridge.getMiddleware();
    expect(remaining).toHaveLength(2);
    expect(remaining).toContain(middleware1);
    expect(remaining).not.toContain(middleware2);
    expect(remaining).toContain(middleware3);
  });

  it('should return the bridge for chaining', () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend();
    const bridge = new Bridge(frontend, backend);

    const middleware = createTestMiddleware('mw');
    bridge.use(middleware);

    const result = bridge.removeMiddleware(middleware);
    expect(result).toBe(bridge);
  });

  it('should do nothing if middleware is not in the stack', () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend();
    const bridge = new Bridge(frontend, backend);

    const middleware1 = createTestMiddleware('mw1');
    const middleware2 = createTestMiddleware('mw2');

    bridge.use(middleware1);
    bridge.removeMiddleware(middleware2); // Not in stack

    expect(bridge.getMiddleware()).toHaveLength(1);
    expect(bridge.getMiddleware()).toContain(middleware1);
  });
});

// ============================================================================
// Event Emission Tests
// ============================================================================

describe('Bridge Event Emission', () => {
  it('should emit REQUEST_START event when chat begins', async () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend();
    const bridge = new Bridge(frontend, backend);

    const events: BridgeEventData[] = [];
    bridge.on(BridgeEventType.REQUEST_START, (event) => {
      events.push(event);
    });

    await bridge.chat({ messages: [{ role: 'user', content: 'Hello' }] } as any);

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].type).toBe(BridgeEventType.REQUEST_START);
  });

  it('should emit REQUEST_SUCCESS event on successful chat', async () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend();
    const bridge = new Bridge(frontend, backend);

    const events: BridgeEventData[] = [];
    bridge.on(BridgeEventType.REQUEST_SUCCESS, (event) => {
      events.push(event);
    });

    await bridge.chat({ messages: [{ role: 'user', content: 'Hello' }] } as any);

    expect(events.length).toBe(1);
    expect(events[0].type).toBe(BridgeEventType.REQUEST_SUCCESS);
  });

  it('should emit REQUEST_ERROR event on failed chat', async () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend({ shouldFail: true });
    const bridge = new Bridge(frontend, backend);

    const events: BridgeEventData[] = [];
    bridge.on(BridgeEventType.REQUEST_ERROR, (event) => {
      events.push(event);
    });

    await expect(bridge.chat({ messages: [{ role: 'user', content: 'Hello' }] } as any))
      .rejects.toThrow();

    expect(events.length).toBe(1);
    expect(events[0].type).toBe(BridgeEventType.REQUEST_ERROR);
  });

  it('should emit STREAM_START event when streaming begins', async () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend();
    const bridge = new Bridge(frontend, backend);

    const events: BridgeEventData[] = [];
    bridge.on(BridgeEventType.STREAM_START, (event) => {
      events.push(event);
    });

    const stream = bridge.chatStream({ messages: [{ role: 'user', content: 'Hello' }] } as any);
    for await (const _ of stream) {
      // consume stream
    }

    expect(events.length).toBe(1);
    expect(events[0].type).toBe(BridgeEventType.STREAM_START);
  });

  it('should emit STREAM_COMPLETE event when streaming completes', async () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend();
    const bridge = new Bridge(frontend, backend);

    const events: BridgeEventData[] = [];
    bridge.on(BridgeEventType.STREAM_COMPLETE, (event) => {
      events.push(event);
    });

    const stream = bridge.chatStream({ messages: [{ role: 'user', content: 'Hello' }] } as any);
    for await (const _ of stream) {
      // consume stream
    }

    expect(events.length).toBe(1);
    expect(events[0].type).toBe(BridgeEventType.STREAM_COMPLETE);
  });

  it('should emit to wildcard listeners', async () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend();
    const bridge = new Bridge(frontend, backend);

    const events: BridgeEventData[] = [];
    bridge.on('*', (event) => {
      events.push(event);
    });

    await bridge.chat({ messages: [{ role: 'user', content: 'Hello' }] } as any);

    // Should receive both REQUEST_START and REQUEST_SUCCESS
    expect(events.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// checkHealth Tests
// ============================================================================

describe('Bridge.checkHealth', () => {
  it('should return true when backend is healthy', async () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend({ healthCheck: async () => true });
    const bridge = new Bridge(frontend, backend);

    const isHealthy = await bridge.checkHealth();
    expect(isHealthy).toBe(true);
  });

  it('should return false when backend is unhealthy', async () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend({ healthCheck: async () => false });
    const bridge = new Bridge(frontend, backend);

    const isHealthy = await bridge.checkHealth();
    expect(isHealthy).toBe(false);
  });

  it('should return true when backend has no healthCheck method', async () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend();
    delete (backend as any).healthCheck;
    const bridge = new Bridge(frontend, backend);

    const isHealthy = await bridge.checkHealth();
    expect(isHealthy).toBe(true);
  });
});

// ============================================================================
// getConfig Tests
// ============================================================================

describe('Bridge.getConfig', () => {
  it('should return a copy of the configuration', () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend();
    const bridge = new Bridge(frontend, backend, {
      timeout: 5000,
      retries: 3,
      debug: true,
    });

    const config = bridge.getConfig();

    expect(config.timeout).toBe(5000);
    expect(config.retries).toBe(3);
    expect(config.debug).toBe(true);
  });

  it('should return readonly config that cannot modify original', () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend();
    const bridge = new Bridge(frontend, backend, { timeout: 5000 });

    const config = bridge.getConfig();

    // The config should be a copy, not a reference
    expect(config).not.toBe(bridge.config);
    expect(config.timeout).toBe(bridge.config.timeout);
  });
});

// ============================================================================
// Retry Logic Tests
// ============================================================================

describe('Bridge Retry Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should retry on transient failure', async () => {
    const frontend = createMockFrontend();
    // Fail first 2 times, succeed on 3rd
    const backend = createMockBackend({ failCount: 2 });
    const bridge = new Bridge(frontend, backend, { retries: 3 });

    const chatPromise = bridge.chat({ messages: [{ role: 'user', content: 'Hello' }] } as any);

    // Advance through retry delays (1s, 2s exponential backoff)
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    const response = await chatPromise;

    expect(response).toBeDefined();
    expect(backend.execute).toHaveBeenCalledTimes(3);
  });

  it('should throw after exhausting retries', async () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend({ shouldFail: true });
    const bridge = new Bridge(frontend, backend, { retries: 2 });

    const chatPromise = bridge.chat({ messages: [{ role: 'user', content: 'Hello' }] } as any);

    // Advance through retry delays (1s, 2s exponential backoff)
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(chatPromise).rejects.toThrow();

    // Initial + 2 retries = 3 calls
    expect(backend.execute).toHaveBeenCalledTimes(3);
  });

  it('should not retry when retries is 0', async () => {
    const frontend = createMockFrontend();
    const backend = createMockBackend({ shouldFail: true });
    const bridge = new Bridge(frontend, backend, { retries: 0 });

    await expect(
      bridge.chat({ messages: [{ role: 'user', content: 'Hello' }] } as any)
    ).rejects.toThrow();

    expect(backend.execute).toHaveBeenCalledTimes(1);
  });
});
