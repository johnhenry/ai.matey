/**
 * Bridge Router & Provenance Tests
 *
 * Regression tests for #57 - two ways a router-backed Bridge failed to report what
 * it had actually done.
 *
 * `getRouter()` was hardcoded to `return null`, with a return type of the literal
 * `null` rather than `Router | null`, so the router a bridge was built on was
 * unreachable through the bridge.
 *
 * `enrichResponse()` overwrote `provenance.backend` with `this.backend.metadata.name`,
 * which for a router-backed bridge is the *router* - discarding the adapter that
 * actually answered. The streaming path applied no provenance at all, so the two
 * paths disagreed about the same request.
 */

import { describe, it, expect } from 'vitest';
import { Bridge, Router } from '@johnhenry/aimatey-core';
import { GenericFrontendAdapter } from '@johnhenry/aimatey-frontend';
import type {
  AdapterMetadata,
  BackendAdapter,
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
   * none, which is the only case where the bridge's own backend name should be used.
   */
  readonly reportsProvenance?: boolean;
}

/**
 * Backend that answers with a fixed, identifying string so tests can tell which
 * backend served a request, and reports its own provenance on both paths.
 */
function createStaticBackend(
  name: string,
  answer: string,
  options: StaticBackendOptions = {}
): BackendAdapter {
  const reportsProvenance = options.reportsProvenance ?? true;

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
      yield {
        type: 'start',
        sequence: 0,
        metadata: {
          requestId: request.metadata.requestId,
          timestamp: Date.now(),
          provenance: reportsProvenance ? { backend: name } : {},
        },
      };
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

const CHEAP = 'answered by CHEAP';
const EXPENSIVE = 'answered by EXPENSIVE';

function createRouter(options: StaticBackendOptions = {}): Router {
  const router = new Router({ routingStrategy: 'explicit', defaultBackend: 'cheap' });
  router.register('cheap', createStaticBackend('cheap', CHEAP, options));
  router.register('expensive', createStaticBackend('expensive', EXPENSIVE, options));
  return router;
}

function createBridge(backend: BackendAdapter) {
  return new Bridge(new GenericFrontendAdapter(), backend);
}

function createRequest(messages: IRChatRequest['messages'] = [{ role: 'user', content: 'Hello' }]) {
  return {
    messages,
    parameters: { model: 'test-model' },
    metadata: {
      requestId: 'req-57',
      timestamp: Date.now(),
      provenance: {},
    },
  } satisfies IRChatRequest;
}

/** Collect the `start` chunk of a stream, which is where response provenance rides. */
async function startChunkOf(
  stream: AsyncGenerator<IRStreamChunk, void, undefined>
): Promise<IRStreamChunk | undefined> {
  let start: IRStreamChunk | undefined;
  for await (const chunk of stream) {
    if (chunk.type === 'start') {
      start ??= chunk;
    }
  }
  return start;
}

// ============================================================================
// #57 (1) - getRouter()
// ============================================================================

describe('Bridge.getRouter() (#57)', () => {
  it('returns the router a router-backed bridge was constructed with', () => {
    const router = createRouter();
    const bridge = createBridge(router);

    expect(bridge.getRouter()).toBe(router);
  });

  it('returns null for a bridge over a plain backend adapter', () => {
    const bridge = createBridge(createStaticBackend('solo', CHEAP));

    expect(bridge.getRouter()).toBeNull();
  });

  it('hands back a usable router, not just a truthy value', () => {
    const bridge = createBridge(createRouter());

    const router = bridge.getRouter();

    expect(router?.listBackends()).toEqual(['cheap', 'expensive']);
    expect(router?.has('expensive')).toBe(true);
  });

  it('survives clone(), which carries the same backend over', () => {
    const router = createRouter();
    const bridge = createBridge(router);

    expect(bridge.clone({ debug: true }).getRouter()).toBe(router);
  });
});

// ============================================================================
// #57 (2) - provenance.backend
// ============================================================================

describe('response provenance names the backend that answered (#57)', () => {
  it('reports the routed backend on chat(), not the router', async () => {
    const bridge = createBridge(createRouter());

    const response = await bridge.chat(createRequest(), { backend: 'expensive' });

    expect(response.message.content).toBe(EXPENSIVE);
    expect(response.metadata.provenance?.backend).toBe('expensive');
  });

  it('reports the default backend on chat() when no override is given', async () => {
    const bridge = createBridge(createRouter());

    const response = await bridge.chat(createRequest());

    expect(response.metadata.provenance?.backend).toBe('cheap');
  });

  it('reports the routed backend on chatStream(), not the router', async () => {
    const bridge = createBridge(createRouter());

    const start = await startChunkOf(bridge.chatStream(createRequest(), { backend: 'expensive' }));

    expect(start?.type).toBe('start');
    expect(start?.type === 'start' && start.metadata.provenance?.backend).toBe('expensive');
  });

  it('reports the routed backend on executeIR()', async () => {
    const bridge = createBridge(createRouter());

    const response = await bridge.executeIR(createRequest(), { backend: 'expensive' });

    expect(response.metadata.provenance?.backend).toBe('expensive');
  });

  it('reports the routed backend on executeIRStream()', async () => {
    const bridge = createBridge(createRouter());

    const start = await startChunkOf(
      bridge.executeIRStream(createRequest(), { backend: 'expensive' })
    );

    expect(start?.type === 'start' && start.metadata.provenance?.backend).toBe('expensive');
  });

  it('records the router under provenance.router, so the routing layer stays visible', async () => {
    const router = createRouter();
    const bridge = createBridge(router);

    const response = await bridge.chat(createRequest(), { backend: 'expensive' });

    expect(response.metadata.provenance?.router).toBe(router.metadata.name);
  });

  it('leaves provenance.router unset for a bridge over a plain adapter', async () => {
    const bridge = createBridge(createStaticBackend('solo', CHEAP));

    const response = await bridge.chat(createRequest());

    expect(response.metadata.provenance?.router).toBeUndefined();
  });

  it('always stamps the frontend, which the bridge does know', async () => {
    const bridge = createBridge(createRouter());

    const response = await bridge.chat(createRequest());
    const start = await startChunkOf(bridge.chatStream(createRequest()));

    expect(response.metadata.provenance?.frontend).toBe('generic-frontend');
    expect(start?.type === 'start' && start.metadata.provenance?.frontend).toBe('generic-frontend');
  });
});

describe('provenance.backend falls back to the bridge backend (#57)', () => {
  it('uses the bridge backend name on chat() when the adapter reported none', async () => {
    const bridge = createBridge(createStaticBackend('solo', CHEAP, { reportsProvenance: false }));

    const response = await bridge.chat(createRequest());

    expect(response.metadata.provenance?.backend).toBe('solo');
  });

  it('uses the bridge backend name on chatStream() when the adapter reported none', async () => {
    const bridge = createBridge(createStaticBackend('solo', CHEAP, { reportsProvenance: false }));

    const start = await startChunkOf(bridge.chatStream(createRequest()));

    expect(start?.type === 'start' && start.metadata.provenance?.backend).toBe('solo');
  });

  it('does not invent metadata on a start chunk that carries none', async () => {
    const bare = {
      ...createStaticBackend('bare', CHEAP),
      async *executeStream(): AsyncGenerator<IRStreamChunk, void, undefined> {
        yield { type: 'start', sequence: 0 } as unknown as IRStreamChunk;
        yield { type: 'content', sequence: 1, delta: CHEAP, role: 'assistant' };
      },
    } as unknown as BackendAdapter;
    const bridge = createBridge(bare);

    const start = await startChunkOf(bridge.chatStream(createRequest()));

    expect(start).toEqual({ type: 'start', sequence: 0 });
  });
});
