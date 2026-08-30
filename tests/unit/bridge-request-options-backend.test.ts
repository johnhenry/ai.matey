/**
 * Bridge `RequestOptions.backend` Tests
 *
 * Regression tests for #47: the documented per-request backend override was never
 * read by `Bridge`, so a request that explicitly asked for one provider was silently
 * served by another. `Bridge.enrichRequest()` now folds `options.backend` into
 * `metadata.custom.backend` - the channel `Router` reads its explicit routing
 * decision from - and rejects a name that is not registered.
 */

import { describe, it, expect } from 'vitest';
import { Bridge, Router } from '@johnhenry/aimatey-core';
import { GenericFrontendAdapter } from '@johnhenry/aimatey-frontend';
import { AdapterError, ErrorCode } from '@johnhenry/aimatey-errors';
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

/**
 * Backend that always answers with a fixed, identifying string, so tests can tell
 * which backend actually served a request.
 *
 * Provenance now carries the same answer - #57 stopped `Bridge.enrichResponse()`
 * overwriting `provenance.backend` with the router's name - and is asserted in
 * `bridge-observability.test.ts`. These tests keep using the response body, so a
 * regression in one is not masked by a regression in the other.
 */
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
      return {
        message: { role: 'assistant', content: answer },
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        metadata: {
          requestId: request.metadata.requestId,
          timestamp: Date.now(),
          provenance: { backend: name },
        },
      };
    },

    async *executeStream(): AsyncGenerator<IRStreamChunk, void, undefined> {
      yield { type: 'content', sequence: 0, delta: answer, role: 'assistant' };
      yield {
        type: 'done',
        sequence: 1,
        finishReason: 'stop',
        message: { role: 'assistant', content: answer },
      };
    },
  } as unknown as BackendAdapter;
}

const CHEAP = 'answered by CHEAP';
const EXPENSIVE = 'answered by EXPENSIVE';

function createRouter(): Router {
  const router = new Router({ routingStrategy: 'explicit', defaultBackend: 'cheap' });
  router.register('cheap', createStaticBackend('cheap', CHEAP));
  router.register('expensive', createStaticBackend('expensive', EXPENSIVE));
  return router;
}

function createBridge(backend: BackendAdapter = createRouter()) {
  return new Bridge(new GenericFrontendAdapter(), backend);
}

function createRequest(custom?: Record<string, unknown>): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    parameters: { model: 'test-model' },
    metadata: {
      requestId: 'req-47',
      timestamp: Date.now(),
      provenance: {},
      ...(custom && { custom }),
    },
  };
}

async function collectStream(
  stream: AsyncGenerator<IRStreamChunk, void, undefined>
): Promise<string> {
  let text = '';
  for await (const chunk of stream) {
    if (chunk.type === 'content') {
      text += chunk.delta;
    }
  }
  return text;
}

// ============================================================================
// The bug: options.backend was ignored
// ============================================================================

describe('RequestOptions.backend routes the request (#47)', () => {
  it('serves chat() from the requested backend, not the default backend', async () => {
    const bridge = createBridge();

    const response = await bridge.chat(createRequest(), { backend: 'expensive' });

    expect(response.message.content).toBe(EXPENSIVE);
  });

  it('serves chatStream() from the requested backend, not the default backend', async () => {
    const bridge = createBridge();

    const text = await collectStream(bridge.chatStream(createRequest(), { backend: 'expensive' }));

    expect(text).toBe(EXPENSIVE);
  });

  it('serves executeIR() from the requested backend', async () => {
    const bridge = createBridge();

    const response = await bridge.executeIR(createRequest(), { backend: 'expensive' });

    expect(response.message.content).toBe(EXPENSIVE);
  });

  it('serves executeIRStream() from the requested backend', async () => {
    const bridge = createBridge();

    const text = await collectStream(
      bridge.executeIRStream(createRequest(), { backend: 'expensive' })
    );

    expect(text).toBe(EXPENSIVE);
  });

  it('still falls back to the default backend when no override is given', async () => {
    const bridge = createBridge();

    const response = await bridge.chat(createRequest());
    const text = await collectStream(bridge.chatStream(createRequest()));

    expect(response.message.content).toBe(CHEAP);
    expect(text).toBe(CHEAP);
  });

  it('writes the override onto metadata.custom.backend, the channel Router reads', async () => {
    let seen: IRChatRequest | undefined;
    const spy = createStaticBackend('spy', 'spy');
    const bridge = createBridge({
      ...spy,
      execute: async (request: IRChatRequest) => {
        seen = request;
        return spy.execute(request);
      },
    } as unknown as BackendAdapter);

    await bridge.chat(createRequest(), { backend: 'expensive' });

    expect(seen?.metadata.custom?.backend).toBe('expensive');
  });
});

// ============================================================================
// Precedence
// ============================================================================

describe('RequestOptions.backend precedence', () => {
  it('wins over a backend already set on request metadata.custom', async () => {
    const bridge = createBridge();

    const response = await bridge.chat(createRequest({ backend: 'cheap' }), {
      backend: 'expensive',
    });

    expect(response.message.content).toBe(EXPENSIVE);
  });

  it('wins over an untyped backend key passed through options.metadata', async () => {
    const bridge = createBridge();

    const response = await bridge.chat(createRequest(), {
      metadata: { backend: 'cheap' },
      backend: 'expensive',
    });

    expect(response.message.content).toBe(EXPENSIVE);
  });

  it('applies to the streaming path with the same precedence', async () => {
    const bridge = createBridge();

    const text = await collectStream(
      bridge.chatStream(createRequest({ backend: 'cheap' }), {
        metadata: { backend: 'cheap' },
        backend: 'expensive',
      })
    );

    expect(text).toBe(EXPENSIVE);
  });

  it('leaves a hand-set metadata.custom.backend alone when no override is given', async () => {
    const bridge = createBridge();

    const response = await bridge.chat(createRequest({ backend: 'expensive' }));

    expect(response.message.content).toBe(EXPENSIVE);
  });

  it('preserves other option metadata alongside the override', async () => {
    let seen: IRChatRequest | undefined;
    const spy = createStaticBackend('spy', 'spy');
    const bridge = createBridge({
      ...spy,
      execute: async (request: IRChatRequest) => {
        seen = request;
        return spy.execute(request);
      },
    } as unknown as BackendAdapter);

    await bridge.chat(createRequest(), {
      backend: 'expensive',
      metadata: { tenantId: 'acme' },
    });

    expect(seen?.metadata.custom).toMatchObject({ backend: 'expensive', tenantId: 'acme' });
  });
});

// ============================================================================
// Unregistered backend names
// ============================================================================

describe('RequestOptions.backend with an unregistered name', () => {
  it('rejects chat() with a ROUTING_FAILED AdapterError', async () => {
    const bridge = createBridge();

    await expect(bridge.chat(createRequest(), { backend: 'antropic' })).rejects.toThrow(
      AdapterError
    );

    await expect(bridge.chat(createRequest(), { backend: 'antropic' })).rejects.toMatchObject({
      code: ErrorCode.ROUTING_FAILED,
      isRetryable: false,
    });
  });

  it('names the typo and the registered backends in the message', async () => {
    const bridge = createBridge();

    await expect(bridge.chat(createRequest(), { backend: 'antropic' })).rejects.toThrow(
      /Requested backend 'antropic' is not registered\. Registered backends: cheap, expensive/
    );
  });

  it('rejects chatStream() the same way', async () => {
    const bridge = createBridge();

    await expect(
      collectStream(bridge.chatStream(createRequest(), { backend: 'antropic' }))
    ).rejects.toMatchObject({ code: ErrorCode.ROUTING_FAILED });
  });

  it('rejects executeIR() and executeIRStream() the same way', async () => {
    const bridge = createBridge();

    await expect(bridge.executeIR(createRequest(), { backend: 'antropic' })).rejects.toMatchObject({
      code: ErrorCode.ROUTING_FAILED,
    });

    await expect(
      collectStream(bridge.executeIRStream(createRequest(), { backend: 'antropic' }))
    ).rejects.toMatchObject({ code: ErrorCode.ROUTING_FAILED });
  });

  it('does not reject a registered backend whose circuit breaker is open - fallback applies', async () => {
    const router = createRouter();
    router.openCircuitBreaker('expensive');
    const bridge = createBridge(router);

    const response = await bridge.chat(createRequest(), { backend: 'expensive' });

    // Router's own fallback machinery handles this; the bridge must not pre-empt it.
    expect(response.message.content).toBe(CHEAP);
  });

  it('stays inert on a bridge whose backend is a single adapter, not a router', async () => {
    const bridge = createBridge(createStaticBackend('solo', CHEAP));

    const response = await bridge.chat(createRequest(), { backend: 'not-a-backend' });

    expect(response.message.content).toBe(CHEAP);
  });

  it('leaves the legacy metadata.custom.backend channel lenient', async () => {
    // Backwards compatibility: the undocumented channel keeps its pre-#47 behaviour,
    // silently falling through to strategy selection. Tightening it is a follow-up.
    const bridge = createBridge();

    const response = await bridge.chat(createRequest({ backend: 'antropic' }));

    expect(response.message.content).toBe(CHEAP);
  });
});
