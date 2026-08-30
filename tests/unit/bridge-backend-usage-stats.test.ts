/**
 * Bridge backend-usage statistics & event-emission tests
 *
 * Regression tests for #68 - two things `Bridge`'s observability surface reported
 * falsely.
 *
 * `getStats().backendUsage` was derived at read time as
 * `{ [this.backend.metadata.name]: this._successfulRequests }`. `this.backend` is
 * whatever the bridge was constructed with, so on a router-backed bridge that is the
 * *router* and every success was filed under `"router"` - making per-backend usage,
 * the only thing the field exists to report, unobservable. It is now accumulated as
 * requests succeed, keyed by the backend named in the response's resolved provenance
 * (#57), which is the backend that actually answered.
 *
 * `on()` and `once()` both carried a JSDoc note saying "Event emission is not yet
 * implemented". It has been implemented for some time. The tests here pin the events
 * that actually fire, so the note cannot come back without a failure.
 */

import { describe, it, expect, vi } from 'vitest';
import { Bridge, Router } from '@johnhenry/aimatey-core';
import { GenericFrontendAdapter } from '@johnhenry/aimatey-frontend';
import { BridgeEventType } from '@johnhenry/aimatey-types';
import { ErrorCode, NetworkError } from '@johnhenry/aimatey-errors';
import type {
  AdapterMetadata,
  BackendAdapter,
  BridgeEventData,
  IRCapabilities,
  IRChatRequest,
  IRChatResponse,
  IRStreamChunk,
} from '@johnhenry/aimatey-types';

// ============================================================================
// Test Helpers
// ============================================================================

interface StaticBackendOptions {
  /**
   * Whether the adapter writes `provenance.backend` into what it returns, the way
   * every shipped backend adapter does. Set false to model an adapter that reports
   * none - the only case where the bridge's own backend name should be used.
   */
  readonly reportsProvenance?: boolean;

  /** Make every call throw, to check failures are not credited as usage. */
  readonly fails?: boolean;

  /**
   * Emit a `start` chunk carrying no `metadata` at all - a deliberate violation of
   * `StreamStartChunk`, which requires it. Real adapters written in JS, or cast through
   * `as unknown as BackendAdapter` the way this helper is, can and do produce one, and
   * `enrichStream()` guards for exactly that: it passes such a chunk through untouched
   * rather than fabricating metadata. So this is the case that actually reaches the
   * bridge-backend-name fallback on the streaming path.
   */
  readonly omitsStartMetadata?: boolean;

  /** Emit no `start` chunk at all, the other way a stream names no backend. */
  readonly omitsStartChunk?: boolean;

  /** Throw on the first N calls, then answer normally. Drives the retry tests. */
  readonly failTimes?: number;
}

function createStaticBackend(name: string, options: StaticBackendOptions = {}): BackendAdapter {
  const reportsProvenance = options.reportsProvenance ?? true;
  const answer = `answered by ${name}`;
  let callsRemainingToFail = options.failTimes ?? 0;

  const shouldFail = (): boolean => {
    if (options.fails) {
      return true;
    }
    if (callsRemainingToFail > 0) {
      callsRemainingToFail--;
      return true;
    }
    return false;
  };

  const metadata: AdapterMetadata = {
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

  return {
    metadata,
    fromIR: (request: IRChatRequest) => request,
    toIR: (response: IRChatResponse) => response,

    async execute(request: IRChatRequest): Promise<IRChatResponse> {
      if (shouldFail()) {
        // A *classified retryable* failure, not a bare Error. #70 stopped the bridge
        // retrying errors that carry no classification, on the reasoning that a real
        // backend always classifies: the HTTP adapters wrap every fetch rejection as
        // NetworkError. A bare Error here would exercise a path no real backend takes,
        // and would stop this fixture from reaching the retry it exists to test.
        throw new NetworkError({
          code: ErrorCode.NETWORK_ERROR,
          message: `${name} is down`,
        });
      }
      return {
        message: { role: 'assistant', content: answer },
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        metadata: {
          requestId: request.metadata.requestId,
          timestamp: Date.now(),
          provenance: reportsProvenance ? { backend: name } : {},
        },
      };
    },

    async *executeStream(request: IRChatRequest): AsyncGenerator<IRStreamChunk, void, undefined> {
      if (shouldFail()) {
        // A *classified retryable* failure, not a bare Error. #70 stopped the bridge
        // retrying errors that carry no classification, on the reasoning that a real
        // backend always classifies: the HTTP adapters wrap every fetch rejection as
        // NetworkError. A bare Error here would exercise a path no real backend takes,
        // and would stop this fixture from reaching the retry it exists to test.
        throw new NetworkError({
          code: ErrorCode.NETWORK_ERROR,
          message: `${name} is down`,
        });
      }
      if (!options.omitsStartChunk) {
        // `StreamStartChunk.metadata` is required, so the metadata-less variant
        // violates the declared type on purpose. It models a hand-written or JS
        // adapter that omits it - exactly the case `enrichStream()` guards for with
        // `chunk.type === 'start' && chunk.metadata`, passing such a chunk through
        // rather than fabricating metadata. The cast keeps that path reachable here.
        const bare = { type: 'start', sequence: 0 } as unknown as IRStreamChunk;
        const full: IRStreamChunk = {
          type: 'start',
          sequence: 0,
          metadata: {
            requestId: request.metadata.requestId,
            timestamp: Date.now(),
            provenance: reportsProvenance ? { backend: name } : {},
          },
        };
        yield options.omitsStartMetadata ? bare : full;
      }
      yield { type: 'content', sequence: 1, delta: answer, role: 'assistant' };
      yield {
        type: 'done',
        sequence: 2,
        finishReason: 'stop',
        message: { role: 'assistant', content: answer },
      };
    },
  } as unknown as BackendAdapter;
}

function createBridge(backend: BackendAdapter) {
  return new Bridge(new GenericFrontendAdapter(), backend);
}

function createRequest(model = 'test-model') {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    parameters: { model },
    metadata: {
      requestId: `req-68-${Math.random().toString(16).slice(2)}`,
      timestamp: Date.now(),
      provenance: {},
    },
  } satisfies IRChatRequest;
}

/** Drain a stream so the bridge reaches its success accounting. */
async function drain(stream: AsyncGenerator<unknown, void, undefined>): Promise<number> {
  let count = 0;
  for await (const _chunk of stream) {
    count++;
  }
  return count;
}

// ============================================================================
// #68 (1) - backendUsage on a router-backed bridge
// ============================================================================

describe('getStats().backendUsage attributes to the backend that served (#68)', () => {
  it('splits round-robin traffic across the registered backends', async () => {
    // The exact reproduction from the issue: four requests, two backends.
    // Before the fix this reported { router: 4 }.
    const router = new Router({ routingStrategy: 'round-robin' });
    router.register('cheap', createStaticBackend('cheap'));
    router.register('expensive', createStaticBackend('expensive'));
    const bridge = createBridge(router);

    for (let i = 0; i < 4; i++) {
      await bridge.chat(createRequest());
    }

    const stats = bridge.getStats();
    expect(stats.backendUsage).toEqual({ cheap: 2, expensive: 2 });
    expect(stats.successfulRequests).toBe(4);
    // The router's own name is not a key - it served nothing itself.
    expect(stats.backendUsage).not.toHaveProperty('router');
  });

  it('attributes explicit per-request routing to the named backend', async () => {
    const router = new Router({ routingStrategy: 'explicit', defaultBackend: 'cheap' });
    router.register('cheap', createStaticBackend('cheap'));
    router.register('expensive', createStaticBackend('expensive'));
    const bridge = createBridge(router);

    await bridge.chat(createRequest(), { backend: 'expensive' });
    await bridge.chat(createRequest(), { backend: 'expensive' });
    await bridge.chat(createRequest(), { backend: 'cheap' });
    await bridge.chat(createRequest()); // falls to defaultBackend

    expect(bridge.getStats().backendUsage).toEqual({ cheap: 2, expensive: 2 });
  });

  it('attributes model-based routing to the mapped backend', async () => {
    const router = new Router({ routingStrategy: 'model-based' });
    router.register('openai-backend', createStaticBackend('openai-backend'));
    router.register('anthropic-backend', createStaticBackend('anthropic-backend'));
    router.setModelMapping({
      'gpt-4': 'openai-backend',
      'claude-3': 'anthropic-backend',
    });
    const bridge = createBridge(router);

    await bridge.chat(createRequest('gpt-4'));
    await bridge.chat(createRequest('claude-3'));
    await bridge.chat(createRequest('claude-3'));

    expect(bridge.getStats().backendUsage).toEqual({
      'openai-backend': 1,
      'anthropic-backend': 2,
    });
  });

  it('attributes custom routing to whichever backend the function picked', async () => {
    const router = new Router({
      routingStrategy: 'custom',
      customRouter: async () => 'expensive',
    });
    router.register('cheap', createStaticBackend('cheap'));
    router.register('expensive', createStaticBackend('expensive'));
    const bridge = createBridge(router);

    await bridge.chat(createRequest());
    await bridge.chat(createRequest());

    expect(bridge.getStats().backendUsage).toEqual({ expensive: 2 });
  });

  it('keeps per-backend counts summing to successfulRequests', async () => {
    const router = new Router({ routingStrategy: 'round-robin' });
    router.register('a', createStaticBackend('a'));
    router.register('b', createStaticBackend('b'));
    router.register('c', createStaticBackend('c'));
    const bridge = createBridge(router);

    for (let i = 0; i < 7; i++) {
      await bridge.chat(createRequest());
    }

    const stats = bridge.getStats();
    const total = Object.values(stats.backendUsage).reduce((a, b) => a + b, 0);
    expect(total).toBe(stats.successfulRequests);
    expect(total).toBe(7);
  });
});

// ============================================================================
// #68 (1) - a single-backend bridge is unchanged
// ============================================================================

describe('backendUsage on a single-backend bridge is unchanged (#68)', () => {
  it('files every success under the backend name, as before', async () => {
    const bridge = createBridge(createStaticBackend('solo'));

    await bridge.chat(createRequest());
    await bridge.chat(createRequest());
    await bridge.chat(createRequest());

    const stats = bridge.getStats();
    expect(stats.backendUsage).toEqual({ solo: 3 });
    expect(stats.backendUsage.solo).toBe(stats.successfulRequests);
  });

  it('falls back to the bridge backend name when the adapter reports no provenance', async () => {
    const bridge = createBridge(createStaticBackend('quiet', { reportsProvenance: false }));

    await bridge.chat(createRequest());
    await bridge.chat(createRequest());

    expect(bridge.getStats().backendUsage).toEqual({ quiet: 2 });
  });

  it('counts successes only - a failure is in failedRequests, not backendUsage', async () => {
    const bridge = createBridge(createStaticBackend('flaky', { fails: true }));

    await expect(bridge.chat(createRequest())).rejects.toThrow();

    const stats = bridge.getStats();
    expect(stats.failedRequests).toBe(1);
    expect(stats.successfulRequests).toBe(0);
    expect(stats.backendUsage).toEqual({});
  });

  it('reports an empty breakdown before anything has been served', () => {
    const bridge = createBridge(createStaticBackend('solo'));

    expect(bridge.getStats().backendUsage).toEqual({});
  });

  it('hands back a copy, so a caller cannot corrupt the running totals', async () => {
    const bridge = createBridge(createStaticBackend('solo'));
    await bridge.chat(createRequest());

    const stats = bridge.getStats();
    (stats.backendUsage as Record<string, number>).solo = 999;
    (stats.backendUsage as Record<string, number>).injected = 1;

    expect(bridge.getStats().backendUsage).toEqual({ solo: 1 });
  });
});

// ============================================================================
// #68 (1) - retries, router fallback, and response-replacing middleware
// ============================================================================

describe('backendUsage counts each request once, whatever the path there (#68)', () => {
  it('credits a retried-then-successful request exactly once', async () => {
    vi.useFakeTimers();
    try {
      // Fails twice, succeeds on the third attempt. The bridge counts one request;
      // backendUsage must agree rather than crediting one per attempt.
      const bridge = new Bridge(
        new GenericFrontendAdapter(),
        createStaticBackend('flappy', { failTimes: 2 }),
        { retries: 2 }
      );

      const pending = bridge.chat(createRequest());
      await vi.runAllTimersAsync();
      await pending;

      const stats = bridge.getStats();
      expect(stats.backendUsage).toEqual({ flappy: 1 });
      expect(stats.successfulRequests).toBe(1);
      expect(stats.totalRequests).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('credits nothing when every retry attempt fails', async () => {
    vi.useFakeTimers();
    try {
      const bridge = new Bridge(
        new GenericFrontendAdapter(),
        createStaticBackend('doomed', { fails: true }),
        { retries: 2 }
      );

      const pending = bridge.chat(createRequest());
      const assertion = expect(pending).rejects.toThrow();
      await vi.runAllTimersAsync();
      await assertion;

      const stats = bridge.getStats();
      expect(stats.backendUsage).toEqual({});
      expect(stats.failedRequests).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('credits the backend that answered after a router fallback, not the one first tried', async () => {
    const router = new Router({ routingStrategy: 'explicit', defaultBackend: 'primary' });
    router.register('primary', createStaticBackend('primary', { fails: true }));
    router.register('backup', createStaticBackend('backup'));
    router.setFallbackChain(['primary', 'backup']);
    const bridge = createBridge(router);

    const response = await bridge.chat(createRequest());

    // Whoever actually answered is who gets the credit.
    expect(response.metadata.provenance?.backend).toBe('backup');
    expect(bridge.getStats().backendUsage).toEqual({ backup: 1 });
  });

  it('survives a middleware that replaces the response wholesale', async () => {
    const bridge = createBridge(createStaticBackend('solo'));
    bridge.use(async (context, next) => {
      await next();
      // A brand-new object with no provenance at all - the tally must fall back
      // rather than throw or record undefined.
      return {
        message: { role: 'assistant', content: 'replaced' },
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        metadata: {
          requestId: context.request.metadata.requestId,
          timestamp: Date.now(),
        },
      } as IRChatResponse;
    });

    const response = await bridge.chat(createRequest());

    expect(response.message.content).toBe('replaced');
    expect(bridge.getStats().backendUsage).toEqual({ solo: 1 });
    expect(Object.keys(bridge.getStats().backendUsage)).not.toContain('undefined');
  });

  it('never keys the breakdown on undefined or an empty string', async () => {
    const bridge = createBridge(createStaticBackend('quiet', { reportsProvenance: false }));

    await bridge.chat(createRequest());
    await drain(bridge.chatStream(createRequest()));

    const keys = Object.keys(bridge.getStats().backendUsage);
    expect(keys).toEqual(['quiet']);
    expect(keys).not.toContain('undefined');
    expect(keys).not.toContain('');
  });

  it('agrees with the provenance the caller sees, and neither says "router"', async () => {
    // Guards the #57 precedence rule this fix consumes: if resolveProvenance() ever
    // regressed to clobbering provenance.backend with the bridge's own backend name,
    // both the response and this breakdown would say the router's name and this fails.
    const router = new Router({ routingStrategy: 'explicit', defaultBackend: 'cheap' });
    router.register('cheap', createStaticBackend('cheap'));
    router.register('expensive', createStaticBackend('expensive'));
    const bridge = createBridge(router);

    const response = await bridge.chat(createRequest(), { backend: 'expensive' });

    const servedBy = response.metadata.provenance?.backend;
    expect(servedBy).toBe('expensive');
    expect(bridge.getStats().backendUsage).toEqual({ [servedBy as string]: 1 });
    // The router names itself under `router`, and only there.
    expect(response.metadata.provenance?.router).toBeDefined();
    expect(Object.keys(bridge.getStats().backendUsage)).not.toContain(
      response.metadata.provenance?.router
    );
  });
});

// ============================================================================
// #68 (1) - the streaming path
// ============================================================================

describe('backendUsage counts the streaming path too (#68)', () => {
  it('attributes a routed stream to the backend that served it', async () => {
    const router = new Router({ routingStrategy: 'explicit', defaultBackend: 'cheap' });
    router.register('cheap', createStaticBackend('cheap'));
    router.register('expensive', createStaticBackend('expensive'));
    const bridge = createBridge(router);

    await drain(bridge.chatStream(createRequest(), { backend: 'expensive' }));
    await drain(bridge.chatStream(createRequest()));

    const stats = bridge.getStats();
    expect(stats.backendUsage).toEqual({ cheap: 1, expensive: 1 });
    expect(stats.streamingRequests).toBe(2);
  });

  it('splits round-robin streaming traffic across backends', async () => {
    const router = new Router({ routingStrategy: 'round-robin' });
    router.register('cheap', createStaticBackend('cheap'));
    router.register('expensive', createStaticBackend('expensive'));
    const bridge = createBridge(router);

    for (let i = 0; i < 4; i++) {
      await drain(bridge.chatStream(createRequest()));
    }

    expect(bridge.getStats().backendUsage).toEqual({ cheap: 2, expensive: 2 });
  });

  it('agrees with chat() - both paths accumulate into the same breakdown', async () => {
    const router = new Router({ routingStrategy: 'explicit', defaultBackend: 'cheap' });
    router.register('cheap', createStaticBackend('cheap'));
    router.register('expensive', createStaticBackend('expensive'));
    const bridge = createBridge(router);

    await bridge.chat(createRequest(), { backend: 'cheap' });
    await drain(bridge.chatStream(createRequest(), { backend: 'cheap' }));
    await bridge.chat(createRequest(), { backend: 'expensive' });

    const stats = bridge.getStats();
    expect(stats.backendUsage).toEqual({ cheap: 2, expensive: 1 });
    expect(Object.values(stats.backendUsage).reduce((a, b) => a + b, 0)).toBe(
      stats.successfulRequests
    );
  });

  it('files a single-backend stream under the backend name, as before', async () => {
    const bridge = createBridge(createStaticBackend('solo'));

    await drain(bridge.chatStream(createRequest()));
    await drain(bridge.chatStream(createRequest()));

    expect(bridge.getStats().backendUsage).toEqual({ solo: 2 });
  });

  it('falls back to the bridge backend name when a stream reports no provenance', async () => {
    const bridge = createBridge(createStaticBackend('quiet', { reportsProvenance: false }));

    await drain(bridge.chatStream(createRequest()));

    expect(bridge.getStats().backendUsage).toEqual({ quiet: 1 });
  });

  it('falls back to the bridge backend name when the start chunk has no metadata', async () => {
    // enrichStream() leaves a metadata-less start chunk alone rather than fabricating
    // one, so nothing upstream can supply a name here - this is the case the fallback
    // in recordBackendUsage() exists for.
    const bridge = createBridge(createStaticBackend('bare', { omitsStartMetadata: true }));

    await drain(bridge.chatStream(createRequest()));

    expect(bridge.getStats().backendUsage).toEqual({ bare: 1 });
  });

  it('falls back to the bridge backend name when the stream has no start chunk', async () => {
    const bridge = createBridge(createStaticBackend('headless', { omitsStartChunk: true }));

    await drain(bridge.chatStream(createRequest()));

    expect(bridge.getStats().backendUsage).toEqual({ headless: 1 });
  });

  it('does not credit a stream that failed', async () => {
    const bridge = createBridge(createStaticBackend('flaky', { fails: true }));

    await expect(drain(bridge.chatStream(createRequest()))).rejects.toThrow();

    const stats = bridge.getStats();
    expect(stats.failedRequests).toBe(1);
    expect(stats.backendUsage).toEqual({});
  });
});

// ============================================================================
// #68 (1) - resetStats()
// ============================================================================

describe('resetStats() clears backendUsage (#68)', () => {
  it('clears the breakdown along with the other counters', async () => {
    const router = new Router({ routingStrategy: 'round-robin' });
    router.register('cheap', createStaticBackend('cheap'));
    router.register('expensive', createStaticBackend('expensive'));
    const bridge = createBridge(router);

    await bridge.chat(createRequest());
    await drain(bridge.chatStream(createRequest()));
    expect(Object.keys(bridge.getStats().backendUsage).length).toBeGreaterThan(0);

    bridge.resetStats();

    const stats = bridge.getStats();
    expect(stats.backendUsage).toEqual({});
    expect(stats.successfulRequests).toBe(0);
    expect(stats.totalRequests).toBe(0);
  });

  it('accumulates cleanly again after a reset', async () => {
    const router = new Router({ routingStrategy: 'explicit', defaultBackend: 'cheap' });
    router.register('cheap', createStaticBackend('cheap'));
    router.register('expensive', createStaticBackend('expensive'));
    const bridge = createBridge(router);

    await bridge.chat(createRequest(), { backend: 'cheap' });
    await bridge.chat(createRequest(), { backend: 'cheap' });
    bridge.resetStats();

    await bridge.chat(createRequest(), { backend: 'expensive' });

    // No residue from before the reset.
    expect(bridge.getStats().backendUsage).toEqual({ expensive: 1 });
  });
});

// ============================================================================
// #68 (2) - events really are emitted
// ============================================================================

describe('Bridge events are emitted (#68)', () => {
  function collect(bridge: Bridge): BridgeEventData[] {
    const seen: BridgeEventData[] = [];
    bridge.on('*', (event) => {
      seen.push(event);
    });
    return seen;
  }

  it('emits request:start and request:success from chat()', async () => {
    const bridge = createBridge(createStaticBackend('solo'));
    const seen = collect(bridge);

    await bridge.chat(createRequest());

    expect(seen.map((e) => e.type)).toEqual([
      BridgeEventType.REQUEST_START,
      BridgeEventType.REQUEST_SUCCESS,
    ]);
  });

  it('emits request:error from a failing chat()', async () => {
    const bridge = createBridge(createStaticBackend('flaky', { fails: true }));
    const seen = collect(bridge);

    await expect(bridge.chat(createRequest())).rejects.toThrow();

    expect(seen.map((e) => e.type)).toEqual([
      BridgeEventType.REQUEST_START,
      BridgeEventType.REQUEST_ERROR,
    ]);
  });

  it('emits stream:start and stream:complete from chatStream()', async () => {
    const bridge = createBridge(createStaticBackend('solo'));
    const seen = collect(bridge);

    await drain(bridge.chatStream(createRequest()));

    expect(seen.map((e) => e.type)).toEqual([
      BridgeEventType.STREAM_START,
      BridgeEventType.STREAM_COMPLETE,
    ]);
  });

  it('emits stream:error from a failing chatStream()', async () => {
    const bridge = createBridge(createStaticBackend('flaky', { fails: true }));
    const seen = collect(bridge);

    await expect(drain(bridge.chatStream(createRequest()))).rejects.toThrow();

    expect(seen.map((e) => e.type)).toEqual([
      BridgeEventType.STREAM_START,
      BridgeEventType.STREAM_ERROR,
    ]);
  });

  it('delivers to a listener registered for one specific event type', async () => {
    const bridge = createBridge(createStaticBackend('solo'));
    const successes: BridgeEventData[] = [];
    bridge.on(BridgeEventType.REQUEST_SUCCESS, (event) => {
      successes.push(event);
    });

    await bridge.chat(createRequest());
    await bridge.chat(createRequest());

    expect(successes).toHaveLength(2);
    expect(successes[0]?.type).toBe(BridgeEventType.REQUEST_SUCCESS);
  });

  it('carries the request, response and duration on a success event', async () => {
    const bridge = createBridge(createStaticBackend('solo'));
    const seen = collect(bridge);

    await bridge.chat(createRequest());

    const success = seen.find((e) => e.type === BridgeEventType.REQUEST_SUCCESS);
    expect(success).toBeDefined();
    expect(success).toMatchObject({
      requestId: expect.any(String),
      durationMs: expect.any(Number),
    });
    expect((success as { response?: IRChatResponse }).response?.metadata.provenance?.backend).toBe(
      'solo'
    );
  });

  it('fires a once() listener exactly once', async () => {
    const bridge = createBridge(createStaticBackend('solo'));
    let calls = 0;
    bridge.once(BridgeEventType.REQUEST_START, () => {
      calls++;
    });

    await bridge.chat(createRequest());
    await bridge.chat(createRequest());

    expect(calls).toBe(1);
  });

  it('stops delivering after off()', async () => {
    const bridge = createBridge(createStaticBackend('solo'));
    let calls = 0;
    const listener = () => {
      calls++;
    };
    bridge.on(BridgeEventType.REQUEST_START, listener);

    await bridge.chat(createRequest());
    bridge.off(BridgeEventType.REQUEST_START, listener);
    await bridge.chat(createRequest());

    expect(calls).toBe(1);
  });

  it('does not let a throwing listener fail the request or silence the others', async () => {
    const bridge = createBridge(createStaticBackend('solo'));
    let reached = 0;
    bridge.on('*', () => {
      throw new Error('listener blew up');
    });
    bridge.on('*', () => {
      reached++;
    });

    await expect(bridge.chat(createRequest())).resolves.toBeDefined();
    expect(reached).toBe(2);
  });

  it('emits exactly the six event types on() documents, and no others', async () => {
    // Pins both halves of the on() JSDoc: the six that fire, and the five that are
    // declared on BridgeEventType but that nothing emits. If one of the latter ever
    // starts firing, the doc has gone stale again and this fails.
    const emitted = new Set<string>();
    const record = (bridge: Bridge) =>
      bridge.on('*', (event) => {
        emitted.add(event.type);
      });

    const ok = createBridge(createStaticBackend('solo'));
    record(ok);
    await ok.chat(createRequest());
    await drain(ok.chatStream(createRequest()));

    const bad = createBridge(createStaticBackend('flaky', { fails: true }));
    record(bad);
    await expect(bad.chat(createRequest())).rejects.toThrow();
    await expect(drain(bad.chatStream(createRequest()))).rejects.toThrow();

    expect([...emitted].sort()).toEqual(
      [
        BridgeEventType.REQUEST_START,
        BridgeEventType.REQUEST_SUCCESS,
        BridgeEventType.REQUEST_ERROR,
        BridgeEventType.STREAM_START,
        BridgeEventType.STREAM_COMPLETE,
        BridgeEventType.STREAM_ERROR,
      ].sort()
    );

    for (const never of [
      BridgeEventType.REQUEST_CANCELLED,
      BridgeEventType.STREAM_CHUNK,
      BridgeEventType.BACKEND_SELECTED,
      BridgeEventType.BACKEND_FAILOVER,
      BridgeEventType.MIDDLEWARE_EXECUTED,
    ]) {
      expect(emitted.has(never)).toBe(false);
    }
  });

  it('stays silent on executeIR(), which is documented not to emit', async () => {
    const bridge = createBridge(createStaticBackend('solo'));
    const seen = collect(bridge);

    await bridge.executeIR(createRequest());
    await drain(bridge.executeIRStream(createRequest()));

    expect(seen).toEqual([]);
    expect(bridge.getStats().backendUsage).toEqual({});
  });

  it('names the routed backend in the success event on a router-backed bridge', async () => {
    const router = new Router({ routingStrategy: 'explicit', defaultBackend: 'cheap' });
    router.register('cheap', createStaticBackend('cheap'));
    router.register('expensive', createStaticBackend('expensive'));
    const bridge = createBridge(router);
    const seen = collect(bridge);

    await bridge.chat(createRequest(), { backend: 'expensive' });

    const success = seen.find((e) => e.type === BridgeEventType.REQUEST_SUCCESS);
    expect((success as { response?: IRChatResponse }).response?.metadata.provenance?.backend).toBe(
      'expensive'
    );
  });
});
