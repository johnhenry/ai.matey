/**
 * Router Tests
 *
 * Tests for the Router class including routing strategies,
 * fallback mechanisms, parallel dispatch, and health tracking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Router } from '@johnhenry/aimatey-core';
import type { BackendAdapter, AdapterMetadata } from '@johnhenry/aimatey-types';
import type { IRChatRequest, IRChatResponse, IRStreamChunk, IRCapabilities } from '@johnhenry/aimatey-types';

// ============================================================================
// Mock Backend Adapters
// ============================================================================

class MockBackendAdapter implements BackendAdapter {
  readonly metadata: AdapterMetadata;

  constructor(
    public name: string,
    private shouldFail: boolean = false,
    private responseText: string = 'Response',
    private delayMs: number = 0,
  ) {
    this.metadata = {
      name,
      version: '1.0.0',
      provider: 'mock',
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: false,
        systemMessageStrategy: 'in-messages' as const,
      } as IRCapabilities,
    };
  }

  fromIR(request: IRChatRequest): IRChatRequest {
    return request;
  }

  toIR(response: IRChatResponse): IRChatResponse {
    return response;
  }

  async execute(request: IRChatRequest): Promise<IRChatResponse> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    if (this.shouldFail) {
      throw new Error(`${this.name} failed`);
    }

    return {
      message: {
        role: 'assistant',
        content: `${this.responseText} from ${this.name}`,
      },
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      metadata: {
        requestId: request.metadata.requestId,
        timestamp: Date.now(),
        provenance: {
          backend: this.name,
        },
      },
    };
  }

  async *executeStream(request: IRChatRequest): AsyncGenerator<IRStreamChunk, void, undefined> {
    if (this.shouldFail) {
      throw new Error(`${this.name} failed`);
    }

    const words = `${this.responseText} from ${this.name}`.split(' ');
    let seq = 0;
    for (const word of words) {
      yield {
        type: 'content',
        sequence: seq++,
        delta: word + ' ',
      };
    }

    yield {
      type: 'done',
      sequence: seq,
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      metadata: {
        requestId: request.metadata.requestId,
        timestamp: Date.now(),
        provenance: {
          backend: this.name,
        },
      },
    };
  }
}

// ============================================================================
// Deterministic Settlement Ordering
// ============================================================================

interface Deferred<T = void> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * Resolve once every microtask pending at the time of the call has run.
 *
 * `setImmediate` schedules a macrotask, and Node drains the whole microtask
 * queue before running the next macrotask. Awaiting this is therefore a hard
 * happens-after barrier for every promise continuation already scheduled --
 * not a "wait long enough and hope" delay.
 */
function afterMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * A backend whose settlement is driven by an explicit gate promise instead of
 * a timer, so which backend settles first is a happens-before edge the test
 * owns rather than a race between two `setTimeout` delays.
 *
 * `onSettle` fires immediately before the adapter succeeds or throws, letting
 * one backend's outcome gate another's.
 */
class GatedBackendAdapter implements BackendAdapter {
  readonly metadata: AdapterMetadata;

  constructor(
    public name: string,
    private mode: 'fail' | 'succeed',
    private gate: Promise<void>,
    private onSettle?: () => void
  ) {
    this.metadata = {
      name,
      version: '1.0.0',
      provider: 'mock',
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: false,
        systemMessageStrategy: 'in-messages' as const,
      } as IRCapabilities,
    };
  }

  fromIR(request: IRChatRequest): IRChatRequest {
    return request;
  }

  toIR(response: IRChatResponse): IRChatResponse {
    return response;
  }

  async execute(request: IRChatRequest): Promise<IRChatResponse> {
    await this.gate;
    this.onSettle?.();

    if (this.mode === 'fail') {
      throw new Error(`${this.name} failed`);
    }

    return {
      message: { role: 'assistant', content: `Response from ${this.name}` },
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      metadata: {
        requestId: request.metadata.requestId,
        timestamp: Date.now(),
        provenance: { backend: this.name },
      },
    };
  }

  // eslint-disable-next-line require-yield
  async *executeStream(): AsyncGenerator<IRStreamChunk, void, undefined> {
    throw new Error(`${this.name} does not support streaming in this fixture`);
  }
}

/**
 * Build a gate that opens only after `failureHappened` has fired *and* every
 * microtask it scheduled has run -- i.e. after the router has definitively
 * recorded the failing backend's outcome. A backend gated on this cannot
 * settle before the failing one, in any interleaving.
 */
function gateAfterFailure(failureHappened: Promise<void>): Promise<void> {
  return (async () => {
    await failureHappened;
    await afterMicrotasks();
  })();
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Router - Basic Initialization', () => {
  it('should initialize with single backend', () => {
    const backend = new MockBackendAdapter('backend-1');
    const router = new Router();
    router.register('backend-1', backend);

    expect(router).toBeDefined();
    expect(router.listBackends()).toEqual(['backend-1']);
  });

  it('should initialize with multiple backends', () => {
    const router = new Router();
    router.register('backend-1', new MockBackendAdapter('backend-1'));
    router.register('backend-2', new MockBackendAdapter('backend-2'));
    router.register('backend-3', new MockBackendAdapter('backend-3'));

    expect(router).toBeDefined();
    expect(router.listBackends()).toHaveLength(3);
  });

  it('should initialize with routing strategy', () => {
    const router = new Router({
      routingStrategy: 'round-robin',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));
    router.register('backend-2', new MockBackendAdapter('backend-2'));

    expect(router).toBeDefined();
    expect(router.listBackends()).toHaveLength(2);
  });
});

describe('Router - Round-Robin Strategy', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router({
      routingStrategy: 'round-robin',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));
    router.register('backend-2', new MockBackendAdapter('backend-2'));
    router.register('backend-3', new MockBackendAdapter('backend-3'));
  });

  it('should distribute requests evenly across backends', async () => {
    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response1 = await router.execute(request);
    const response2 = await router.execute(request);
    const response3 = await router.execute(request);
    const response4 = await router.execute(request);

    expect(response1.message.content).toContain('backend-1');
    expect(response2.message.content).toContain('backend-2');
    expect(response3.message.content).toContain('backend-3');
    expect(response4.message.content).toContain('backend-1'); // Wraps around
  });
});

describe('Router - Default Backend Strategy', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router({
      routingStrategy: 'explicit',
      defaultBackend: 'backend-1', // First backend is default
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));
    router.register('backend-2', new MockBackendAdapter('backend-2'));
    router.register('backend-3', new MockBackendAdapter('backend-3'));
  });

  it('should always use default backend when no preference specified', async () => {
    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response1 = await router.execute(request);
    const response2 = await router.execute(request);
    const response3 = await router.execute(request);

    expect(response1.message.content).toContain('backend-1');
    expect(response2.message.content).toContain('backend-1');
    expect(response3.message.content).toContain('backend-1');
  });
});

describe('Router - Random Strategy', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router({
      routingStrategy: 'random',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));
    router.register('backend-2', new MockBackendAdapter('backend-2'));
    router.register('backend-3', new MockBackendAdapter('backend-3'));
  });

  it('should select backends randomly', async () => {
    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const backends = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const response = await router.execute(request);
      const content = response.message.content as string;
      if (content.includes('backend-1')) backends.add('backend-1');
      if (content.includes('backend-2')) backends.add('backend-2');
      if (content.includes('backend-3')) backends.add('backend-3');
    }

    // With 20 requests and 3 backends, we should see multiple backends
    expect(backends.size).toBeGreaterThan(1);
  });
});

describe('Router - Custom Strategy', () => {
  it('should use custom routing strategy', async () => {
    // Custom strategy: always return backend-2
    const customStrategy = async () => 'backend-2';

    const router = new Router({
      routingStrategy: 'custom',
      customRouter: customStrategy,
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));
    router.register('backend-2', new MockBackendAdapter('backend-2'));
    router.register('backend-3', new MockBackendAdapter('backend-3'));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response1 = await router.execute(request);
    const response2 = await router.execute(request);

    expect(response1.message.content).toContain('backend-2');
    expect(response2.message.content).toContain('backend-2');
  });
});

describe('Router - Sequential Fallback', () => {
  it('should fallback to next backend on failure', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
      fallbackStrategy: 'sequential',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true)); // Will fail
    router.register('backend-2', new MockBackendAdapter('backend-2', false)); // Will succeed
    router.register('backend-3', new MockBackendAdapter('backend-3', false));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response = await router.execute(request);
    expect(response.message.content).toContain('backend-2');
  });

  it('should try all backends before failing', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
      fallbackStrategy: 'sequential',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true)); // Will fail
    router.register('backend-2', new MockBackendAdapter('backend-2', true)); // Will fail
    router.register('backend-3', new MockBackendAdapter('backend-3', true)); // Will fail

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    await expect(router.execute(request)).rejects.toThrow();
  });
});

describe('Router - Parallel Fallback', () => {
  it('should try all backends in parallel and use first success', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
      fallbackStrategy: 'parallel',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true)); // Will fail
    router.register('backend-2', new MockBackendAdapter('backend-2', false)); // Will succeed
    router.register('backend-3', new MockBackendAdapter('backend-3', false)); // Will succeed

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response = await router.execute(request);
    // Should get response from backend-2 or backend-3
    expect(response.message.content).toMatch(/backend-[23]/);
  });

  it('should fail if all backends fail in parallel', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
      fallbackStrategy: 'parallel',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true));
    router.register('backend-2', new MockBackendAdapter('backend-2', true));
    router.register('backend-3', new MockBackendAdapter('backend-3', true));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    await expect(router.execute(request)).rejects.toThrow();
  });

  it('should return a slower success instead of aborting on a faster failure', async () => {
    // Regression test (#36): fallbackParallel() previously used Promise.race()
    // over the raw (rejecting) backend promises, so a fast failure would
    // reject the whole dispatch immediately even though a slower backend
    // was still in flight and would have succeeded.
    //
    // The ordering here is deterministic, not a timing race: the succeeding
    // fallback's gate cannot open until the failing fallback has thrown and
    // every microtask that throw scheduled has run. There is no interleaving
    // in which the success settles first.
    const failureHappened = deferred();

    const router = new Router({
      routingStrategy: 'round-robin',
      fallbackStrategy: 'parallel',
    });
    // Primary fails, pushing execution into fallbackParallel().
    router.register('backend-1', new GatedBackendAdapter('backend-1', 'fail', Promise.resolve()));
    // Fallback that fails, and settles first by construction.
    router.register(
      'backend-2',
      new GatedBackendAdapter('backend-2', 'fail', Promise.resolve(), () =>
        failureHappened.resolve()
      )
    );
    // Fallback that succeeds, gated to settle strictly after backend-2 failed.
    router.register(
      'backend-3',
      new GatedBackendAdapter('backend-3', 'succeed', gateAfterFailure(failureHappened.promise))
    );

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response = await router.execute(request);
    expect(response.message.content).toContain('backend-3');
  });
});

describe('Router - dispatchParallel "first" strategy', () => {
  it('should resolve with a slower success rather than a faster failure', async () => {
    // Regression test (#36): dispatchParallel()'s 'first' strategy raced on
    // Promise.race() over wrapped { success, ... } results (which always
    // fulfill), so it returned whichever backend *settled* first -- even a
    // failure -- instead of waiting for the first genuine success.
    //
    // Settlement order is fixed by construction rather than by racing two
    // timers: the failing backend's gate is already resolved, and the
    // succeeding backend's gate cannot open until that failure has been
    // raised and the microtasks it scheduled have drained.
    const failGate = deferred();
    const failureHappened = deferred();

    const router = new Router({ routingStrategy: 'round-robin' });
    router.register(
      'backend-fast-fail',
      new GatedBackendAdapter('backend-fast-fail', 'fail', failGate.promise, () =>
        failureHappened.resolve()
      )
    );
    router.register(
      'backend-slow-success',
      new GatedBackendAdapter(
        'backend-slow-success',
        'succeed',
        gateAfterFailure(failureHappened.promise)
      )
    );

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const dispatch = router.dispatchParallel(request, {
      strategy: 'first',
      backends: ['backend-fast-fail', 'backend-slow-success'],
    });

    // Both legs are in flight before either can settle; opening this gate
    // makes the failure the first settlement.
    failGate.resolve();

    const result = await dispatch;

    expect(result.response.message.content).toContain('backend-slow-success');
    expect(result.successfulBackends).toEqual(['backend-slow-success']);
  });

  it('should throw ALL_BACKENDS_FAILED only once every backend has failed', async () => {
    // The complement of the test above (#36): waiting for a success must not
    // become waiting forever. The second backend is gated to fail strictly
    // after the first, and the rejection must name both -- proving the
    // dispatch waited for the whole field rather than settling on the first
    // failure it saw.
    const firstFailed = deferred();

    const router = new Router({ routingStrategy: 'round-robin' });
    router.register(
      'backend-1',
      new GatedBackendAdapter('backend-1', 'fail', Promise.resolve(), () => firstFailed.resolve())
    );
    router.register(
      'backend-2',
      new GatedBackendAdapter('backend-2', 'fail', gateAfterFailure(firstFailed.promise))
    );

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    await expect(
      router.dispatchParallel(request, {
        strategy: 'first',
        backends: ['backend-1', 'backend-2'],
      })
    ).rejects.toThrow(/All parallel backends failed: backend-1, backend-2/);
  });
});

describe('Router - Custom Fallback', () => {
  it('should use custom fallback strategy', async () => {
    // Custom fallback: Return backend-3 directly
    const customFallback = async () => 'backend-3';

    const router = new Router({
      routingStrategy: 'round-robin',
      fallbackStrategy: 'custom',
      customFallback,
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true));
    router.register('backend-2', new MockBackendAdapter('backend-2', false));
    router.register('backend-3', new MockBackendAdapter('backend-3', false));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response = await router.execute(request);
    expect(response.message.content).toContain('backend-3');
  });
});

describe('Router - Model Mapping', () => {
  it('should map model names to specific backends', async () => {
    const router = new Router({
      routingStrategy: 'model-based',
    });
    router.register('openai-backend', new MockBackendAdapter('openai-backend'));
    router.register('anthropic-backend', new MockBackendAdapter('anthropic-backend'));
    router.register('gemini-backend', new MockBackendAdapter('gemini-backend'));

    router.setModelMapping({
      'gpt-4': 'openai-backend',
      'claude-3': 'anthropic-backend',
      'gemini-pro': 'gemini-backend',
    });

    const request1: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'gpt-4' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const request2: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'claude-3' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response1 = await router.execute(request1);
    const response2 = await router.execute(request2);

    expect(response1.message.content).toContain('openai-backend');
    expect(response2.message.content).toContain('anthropic-backend');
  });
});

describe('Router - Streaming Support', () => {
  it('should stream responses through router', async () => {
    const router = new Router();
    router.register('backend-1', new MockBackendAdapter('backend-1'));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: true,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const stream = router.executeStream(request);
    const chunks: IRStreamChunk[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some(c => c.type === 'content')).toBe(true);
    expect(chunks.some(c => c.type === 'done')).toBe(true);
  });

  it('should fallback on streaming failure', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
      fallbackStrategy: 'sequential',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true));
    router.register('backend-2', new MockBackendAdapter('backend-2', false));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: true,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const stream = router.executeStream(request);
    const chunks: IRStreamChunk[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    const lastChunk = chunks[chunks.length - 1];
    if (lastChunk.type === 'done') {
      expect(lastChunk.metadata.provenance?.backend).toBe('backend-2');
    }
  });
});

describe('Router - Health Tracking', () => {
  it('should track backend health statistics', async () => {
    const router = new Router();
    router.register('backend-1', new MockBackendAdapter('backend-1'));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    await router.execute(request);
    await router.execute(request);

    const stats = router.getStats();
    expect(stats).toBeDefined();
    expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
  });

  it('should track failures separately', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
      fallbackStrategy: 'sequential',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true));
    router.register('backend-2', new MockBackendAdapter('backend-2', false));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    await router.execute(request);

    const stats = router.getStats();
    expect(stats.totalRequests).toBeGreaterThanOrEqual(1);
  });
});

describe('Router - Error Handling', () => {
  it('should throw error when executing with no backends', async () => {
    const router = new Router();

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    await expect(router.execute(request)).rejects.toThrow();
  });

  it('should throw error when all backends fail with no fallback', async () => {
    const router = new Router({
      fallbackStrategy: 'none',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    await expect(router.execute(request)).rejects.toThrow();
  });

  it('should handle invalid model mapping gracefully', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));
    router.register('backend-2', new MockBackendAdapter('backend-2'));

    router.setModelMapping({
      'gpt-4': 'backend-1',
    });

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'unknown-model' }, // Not in mapping
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    // Should fall back to routing strategy
    const response = await router.execute(request);
    expect(response).toBeDefined();
  });
});

describe('Router - Single Backend Edge Cases', () => {
  it('should work with single backend and round-robin strategy', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response1 = await router.execute(request);
    const response2 = await router.execute(request);

    expect(response1.message.content).toContain('backend-1');
    expect(response2.message.content).toContain('backend-1');
  });

  it('should work with single backend with default backend', async () => {
    const router = new Router({
      defaultBackend: 'backend-1',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response = await router.execute(request);
    expect(response.message.content).toContain('backend-1');
  });
});
