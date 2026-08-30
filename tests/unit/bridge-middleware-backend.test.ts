/**
 * Middleware Context Backend Tests
 *
 * Regression tests for #64: `MiddlewareContext.backend` and `.backendName` were
 * declared and documented - "backend that will process (or processed) the request,
 * available after routing decision" - but never populated, on either path, for either
 * backend type. A middleware therefore could not execute an extra turn of its own,
 * which rules out agentic tool loops, retry-with-modified-request and failover; and a
 * middleware branching on `backendName` silently took its fallback path every time.
 *
 * The bridge now seeds both fields before the chain runs and narrows them to the
 * backend that actually served the request once that is known.
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
  MiddlewareContext,
  StreamingMiddlewareContext,
} from '@johnhenry/aimatey-types';

// ============================================================================
// Test Helpers
// ============================================================================

/** Backend that echoes an identifying answer and reports its own provenance. */
function createStaticBackend(name: string, answer: string): BackendAdapter {
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
      const last = request.messages[request.messages.length - 1];
      const asked = typeof last?.content === 'string' ? last.content : '';
      return {
        message: { role: 'assistant', content: `${answer}:${asked}` },
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        metadata: {
          requestId: request.metadata.requestId,
          timestamp: Date.now(),
          provenance: { backend: name },
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
          provenance: { backend: name },
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

function createRouter(): Router {
  const router = new Router({ routingStrategy: 'explicit', defaultBackend: 'cheap' });
  router.register('cheap', createStaticBackend('cheap', 'CHEAP'));
  router.register('expensive', createStaticBackend('expensive', 'EXPENSIVE'));
  return router;
}

function createBridge(backend: BackendAdapter) {
  return new Bridge(new GenericFrontendAdapter(), backend);
}

function createRequest(content = 'Hello') {
  return {
    messages: [{ role: 'user', content }],
    parameters: { model: 'test-model' },
    metadata: {
      requestId: 'req-64',
      timestamp: Date.now(),
      provenance: {},
    },
  } satisfies IRChatRequest;
}

async function drain(stream: AsyncGenerator<unknown, void, undefined>): Promise<void> {
  for await (const _chunk of stream) {
    // consume
  }
}

interface Seen {
  readonly before?: { backend?: BackendAdapter; backendName?: string };
  readonly after?: { backend?: BackendAdapter; backendName?: string };
}

/** Record `backend`/`backendName` on both sides of `next()`. */
function recorder(seen: { value: Seen }) {
  return async (
    context: MiddlewareContext,
    next: () => Promise<IRChatResponse>
  ): Promise<IRChatResponse> => {
    seen.value = {
      ...seen.value,
      before: { backend: context.backend, backendName: context.backendName },
    };
    const response = await next();
    seen.value = {
      ...seen.value,
      after: { backend: context.backend, backendName: context.backendName },
    };
    return response;
  };
}

// ============================================================================
// The bug: both fields were always undefined
// ============================================================================

describe('MiddlewareContext.backend is populated (#64)', () => {
  it('is defined on chat() for a plain backend adapter', async () => {
    const adapter = createStaticBackend('solo', 'SOLO');
    const bridge = createBridge(adapter);
    const seen: { value: Seen } = { value: {} };
    bridge.use(recorder(seen));

    await bridge.chat(createRequest());

    expect(seen.value.before?.backend).toBe(adapter);
    expect(seen.value.before?.backendName).toBe('solo');
    expect(seen.value.after?.backendName).toBe('solo');
  });

  it('is defined on chatStream() for a plain backend adapter', async () => {
    const adapter = createStaticBackend('solo', 'SOLO');
    const bridge = createBridge(adapter);
    const seen: { value: Seen } = { value: {} };
    bridge.use(recorder(seen));

    await drain(bridge.chatStream(createRequest()));

    expect(seen.value.before?.backend).toBe(adapter);
    expect(seen.value.before?.backendName).toBe('solo');
  });

  it('is defined on chat() for a router', async () => {
    const bridge = createBridge(createRouter());
    const seen: { value: Seen } = { value: {} };
    bridge.use(recorder(seen));

    await bridge.chat(createRequest());

    expect(seen.value.before?.backend).toBeDefined();
    expect(seen.value.before?.backendName).toBeDefined();
  });

  it('is defined on chatStream() for a router', async () => {
    const bridge = createBridge(createRouter());
    const seen: { value: Seen } = { value: {} };
    bridge.use(recorder(seen));

    await drain(bridge.chatStream(createRequest()));

    expect(seen.value.before?.backend).toBeDefined();
    expect(seen.value.before?.backendName).toBeDefined();
  });

  it('is defined for stream-native middleware too', async () => {
    const router = createRouter();
    const bridge = createBridge(router);
    let context: StreamingMiddlewareContext | undefined;
    let seededBackend: BackendAdapter | undefined;
    let seededName: string | undefined;
    bridge.useStreaming((ctx, next) => {
      context = ctx;
      seededBackend = ctx.backend;
      seededName = ctx.backendName;
      return next();
    });

    await drain(bridge.chatStream(createRequest()));

    expect(seededBackend).toBe(router);
    expect(seededName).toBe(router.metadata.name);
    expect(context?.isStreaming).toBe(true);
    // Narrowed by the time the stream has been drained.
    expect(context?.backendName).toBe('cheap');
  });

  it('is defined on executeIR() and executeIRStream()', async () => {
    const bridge = createBridge(createRouter());
    const seen: { value: Seen } = { value: {} };
    bridge.use(recorder(seen));

    await bridge.executeIR(createRequest());
    expect(seen.value.before?.backendName).toBeDefined();

    seen.value = {};
    await drain(bridge.executeIRStream(createRequest()));
    expect(seen.value.before?.backendName).toBeDefined();
  });
});

// ============================================================================
// A router narrows to the backend that actually served the request
// ============================================================================

describe('a router narrows to the selected backend (#64)', () => {
  it('names the router before dispatch and the selected backend after, on chat()', async () => {
    const router = createRouter();
    const bridge = createBridge(router);
    const seen: { value: Seen } = { value: {} };
    bridge.use(recorder(seen));

    await bridge.chat(createRequest(), { backend: 'expensive' });

    // Before the request is dispatched the provider is genuinely not chosen yet.
    expect(seen.value.before?.backend).toBe(router);
    expect(seen.value.before?.backendName).toBe(router.metadata.name);
    // Afterwards it names the backend that answered - not the router.
    expect(seen.value.after?.backendName).toBe('expensive');
    expect(seen.value.after?.backend).toBe(router.get('expensive'));
  });

  it('names the selected backend after the stream starts, on chatStream()', async () => {
    const router = createRouter();
    const bridge = createBridge(router);
    const seen: { value: Seen } = { value: {} };
    bridge.use(recorder(seen));

    await drain(bridge.chatStream(createRequest(), { backend: 'expensive' }));

    expect(seen.value.after?.backendName).toBe('expensive');
    expect(seen.value.after?.backend).toBe(router.get('expensive'));
  });

  it('follows a different routing decision on a second request', async () => {
    const router = createRouter();
    const bridge = createBridge(router);
    const seen: { value: Seen } = { value: {} };
    bridge.use(recorder(seen));

    await bridge.chat(createRequest(), { backend: 'cheap' });
    expect(seen.value.after?.backendName).toBe('cheap');

    await bridge.chat(createRequest(), { backend: 'expensive' });
    expect(seen.value.after?.backendName).toBe('expensive');
  });

  it('keeps `backendName` in step with `backend.metadata.name`', async () => {
    const bridge = createBridge(createRouter());
    const seen: { value: Seen } = { value: {} };
    bridge.use(recorder(seen));

    await bridge.chat(createRequest(), { backend: 'expensive' });

    expect(seen.value.after?.backend?.metadata.name).toBe(seen.value.after?.backendName);
  });
});

// ============================================================================
// The empty-reply bug: a middleware taking a second turn
// ============================================================================

describe('a middleware can take a second turn through context.backend (#64)', () => {
  it('gets a real second response from ctx.backend.execute() on a plain adapter', async () => {
    const bridge = createBridge(createStaticBackend('solo', 'SOLO'));

    bridge.use(async (context, next) => {
      const first = await next();

      const backend = context.backend;
      // The guard that used to always fire, leaving the user with an empty reply.
      if (!backend) {
        return first;
      }

      return backend.execute({
        ...context.request,
        messages: [...context.request.messages, { role: 'user', content: 'follow-up' }],
      });
    });

    const response = await bridge.chat(createRequest('first'));

    expect(response.message.content).toBe('SOLO:follow-up');
  });

  it('gets a real second response from ctx.backend.execute() on a router', async () => {
    const bridge = createBridge(createRouter());

    bridge.use(async (context, next) => {
      const first = await next();
      const backend = context.backend;
      if (!backend) {
        return first;
      }
      return backend.execute({
        ...context.request,
        messages: [...context.request.messages, { role: 'user', content: 'follow-up' }],
      });
    });

    const response = await bridge.chat(createRequest('first'), { backend: 'expensive' });

    // The follow-up stays on the backend that answered the first turn.
    expect(response.message.content).toBe('EXPENSIVE:follow-up');
    expect(response.metadata.provenance?.backend).toBe('expensive');
  });

  it('routes a turn taken before next() through the router', async () => {
    const bridge = createBridge(createRouter());
    let routed: string | undefined;

    bridge.use(async (context, next) => {
      const preflight = await context.backend!.execute({
        ...context.request,
        metadata: {
          ...context.request.metadata,
          custom: { ...context.request.metadata.custom, backend: 'cheap' },
        },
      });
      routed = preflight.metadata.provenance?.backend;
      return next();
    });

    await bridge.chat(createRequest(), { backend: 'expensive' });

    // The seed is the router, so it honours the routing metadata it is handed.
    expect(routed).toBe('cheap');
  });
});
