/**
 * Nested Provenance Tests
 *
 * Regression tests for #110 - `IRProvenance` was four flat fields, so it could describe
 * exactly one hop. When a backend adapter fronts *another* aimatey instance (a tunnel, a
 * gateway, a self-hosted relay, a test double wrapping a real `Router`), the near side's
 * `backend` is the transport adapter and whatever the far side's Router actually chose had
 * nowhere to go. The chain `phone -> desktop -> llama-cpp` could not be said.
 *
 * The failure was not only lossy, it was ambiguous in a way that matters: a phone could
 * report `backend: 'tunnel'` (losing llama-cpp) or `backend: 'llama-cpp'` (claiming a
 * request its own device never ran), and the type could not tell those apart. Provenance
 * is a privacy surface - "your own desktop" and "a third-party API" must not render the
 * same - so an ambiguous field makes an honest UI impossible to build.
 *
 * `upstream` nests the far side beneath the near hop. The four flat fields keep describing
 * the nearest hop, which is what every existing reader already means by them.
 */

import { describe, it, expect } from 'vitest';
import { Bridge, Router } from '@johnhenry/aimatey-core';
import { GenericFrontendAdapter } from '@johnhenry/aimatey-frontend';
import { withUpstreamProvenance } from '@johnhenry/aimatey-types';
import type {
  AdapterMetadata,
  BackendAdapter,
  IRCapabilities,
  IRChatRequest,
  IRChatResponse,
  IRProvenance,
  IRStreamChunk,
} from '@johnhenry/aimatey-types';

// ============================================================================
// Test Helpers
// ============================================================================

const ANSWER = 'answered by llama-cpp on the desktop';

/**
 * What the desktop reports for its own half of `phone -> desktop -> llama-cpp`: it ran a
 * frontend, routed, and picked a backend, none of which the phone can see for itself.
 */
const DESKTOP_PROVENANCE: IRProvenance = {
  frontend: 'openai-frontend',
  backend: 'llama-cpp',
  router: 'desktop-router',
  middleware: ['rate-limit', 'logging'],
};

/**
 * Backend that models a proxy onto another aimatey instance: it answers by forwarding, so
 * it names *itself* under `backend` and nests what the far side reported beneath it.
 *
 * @param name This adapter's own name - the hop the calling process actually talked to.
 * @param far Provenance the far side returned, or undefined for a far side that reported none.
 */
function createProxyBackend(name: string, far: IRProvenance | undefined): BackendAdapter {
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

  const provenance = (): IRProvenance => withUpstreamProvenance({ backend: name }, far);

  return {
    metadata,
    fromIR: (request: IRChatRequest) => request,
    toIR: (response: IRChatResponse) => response,

    async execute(request: IRChatRequest): Promise<IRChatResponse> {
      return {
        message: { role: 'assistant', content: ANSWER },
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        metadata: {
          requestId: request.metadata.requestId,
          timestamp: Date.now(),
          provenance: provenance(),
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
          provenance: provenance(),
        },
      };
      yield { type: 'content', sequence: 1, delta: ANSWER, role: 'assistant' };
      yield {
        type: 'done',
        sequence: 2,
        finishReason: 'stop',
        message: { role: 'assistant', content: ANSWER },
      };
    },
  } as unknown as BackendAdapter;
}

function createBridge(backend: BackendAdapter) {
  return new Bridge(new GenericFrontendAdapter(), backend);
}

function createRequest(): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    parameters: { model: 'test-model' },
    metadata: {
      requestId: 'req-110',
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

/**
 * Walk to the end of the chain - the consumer story the nested shape exists to support,
 * and the thing a flat `chain?: string[]` could not have answered per-hop.
 */
function farthestHop(provenance: IRProvenance): IRProvenance {
  let hop = provenance;
  while (hop.upstream !== undefined) {
    hop = hop.upstream;
  }
  return hop;
}

// ============================================================================
// #110 (1) - withUpstreamProvenance()
// ============================================================================

describe('withUpstreamProvenance() (#110)', () => {
  it('nests the far side beneath the proxy hop', () => {
    const result = withUpstreamProvenance({ backend: 'tunnel' }, DESKTOP_PROVENANCE);

    expect(result).toEqual({ backend: 'tunnel', upstream: DESKTOP_PROVENANCE });
  });

  it('keeps the proxy naming itself, not the backend the far side chose', () => {
    const result = withUpstreamProvenance({ backend: 'tunnel' }, DESKTOP_PROVENANCE);

    expect(result.backend).toBe('tunnel');
    expect(result.upstream?.backend).toBe('llama-cpp');
  });

  it('drops an undefined upstream rather than recording an empty hop', () => {
    const result = withUpstreamProvenance({ backend: 'tunnel' }, undefined);

    expect(result).toEqual({ backend: 'tunnel' });
    expect('upstream' in result).toBe(false);
  });

  it('drops an empty upstream, which is what an adapter reporting nothing returns', () => {
    const result = withUpstreamProvenance({ backend: 'tunnel' }, {});

    expect('upstream' in result).toBe(false);
  });

  it('drops an upstream whose every field is undefined', () => {
    const result = withUpstreamProvenance({ backend: 'tunnel' }, { backend: undefined });

    expect('upstream' in result).toBe(false);
  });

  it('replaces an upstream already present on the local hop', () => {
    const stale: IRProvenance = { backend: 'stale' };

    const result = withUpstreamProvenance({ backend: 'tunnel', upstream: stale }, {
      backend: 'fresh',
    });

    expect(result.upstream).toEqual({ backend: 'fresh' });
  });

  it('preserves depth when the far side had itself been proxying', () => {
    const relayed = withUpstreamProvenance({ backend: 'gateway' }, DESKTOP_PROVENANCE);

    const result = withUpstreamProvenance({ backend: 'tunnel' }, relayed);

    expect(result.backend).toBe('tunnel');
    expect(result.upstream?.backend).toBe('gateway');
    expect(result.upstream?.upstream?.backend).toBe('llama-cpp');
    expect(farthestHop(result).backend).toBe('llama-cpp');
  });

  it('does not mutate either input', () => {
    const local: IRProvenance = { backend: 'tunnel' };
    const far: IRProvenance = { backend: 'llama-cpp' };

    withUpstreamProvenance(local, far);

    expect(local).toEqual({ backend: 'tunnel' });
    expect(far).toEqual({ backend: 'llama-cpp' });
  });
});

// ============================================================================
// #110 (2) - the chain crosses a wire
// ============================================================================

describe('a nested chain survives JSON round-trip (#110)', () => {
  /** `phone -> desktop -> llama-cpp`, as the phone would report it. */
  const chain: IRProvenance = {
    frontend: 'openai-frontend',
    backend: 'tunnel',
    router: 'phone-router',
    middleware: ['auth'],
    upstream: DESKTOP_PROVENANCE,
  };

  it('deep-equals itself after JSON.parse(JSON.stringify(...))', () => {
    const roundTripped = JSON.parse(JSON.stringify(chain)) as IRProvenance;

    expect(roundTripped).toEqual(chain);
  });

  it('keeps a three-hop chain intact across the wire', () => {
    const threeHops = withUpstreamProvenance({ backend: 'tunnel' }, chain);

    const roundTripped = JSON.parse(JSON.stringify(threeHops)) as IRProvenance;

    expect(roundTripped).toEqual(threeHops);
    expect(farthestHop(roundTripped).backend).toBe('llama-cpp');
  });

  it('keeps each hop distinguishable, which a flattened chain would not', () => {
    const roundTripped = JSON.parse(JSON.stringify(chain)) as IRProvenance;

    expect(roundTripped.middleware).toEqual(['auth']);
    expect(roundTripped.upstream?.middleware).toEqual(['rate-limit', 'logging']);
    expect(roundTripped.router).toBe('phone-router');
    expect(roundTripped.upstream?.router).toBe('desktop-router');
  });
});

// ============================================================================
// #110 (3) - the Bridge carries a chain without clobbering the near hop
// ============================================================================

describe('a proxying backend keeps its own hop through the Bridge (#110)', () => {
  it('reports the proxy under backend and the far side under upstream on chat()', async () => {
    const bridge = createBridge(createProxyBackend('tunnel', DESKTOP_PROVENANCE));

    const response = await bridge.chat(createRequest());
    const provenance = response.metadata.provenance;

    expect(provenance?.backend).toBe('tunnel');
    expect(provenance?.upstream).toEqual(DESKTOP_PROVENANCE);
  });

  it('does not adopt the far side backend as the backend this process talked to', async () => {
    const bridge = createBridge(createProxyBackend('tunnel', DESKTOP_PROVENANCE));

    const response = await bridge.chat(createRequest());

    expect(response.metadata.provenance?.backend).not.toBe('llama-cpp');
  });

  it('stamps the near frontend over the near hop and leaves the far frontend nested', async () => {
    const bridge = createBridge(createProxyBackend('tunnel', DESKTOP_PROVENANCE));

    const response = await bridge.chat(createRequest());
    const provenance = response.metadata.provenance;

    expect(provenance?.frontend).toBe('generic-frontend');
    expect(provenance?.upstream?.frontend).toBe('openai-frontend');
  });

  it('carries the chain on chatStream(), matching chat()', async () => {
    const bridge = createBridge(createProxyBackend('tunnel', DESKTOP_PROVENANCE));

    const start = await startChunkOf(bridge.chatStream(createRequest()));

    expect(start?.type === 'start' && start.metadata.provenance?.backend).toBe('tunnel');
    expect(start?.type === 'start' && start.metadata.provenance?.upstream).toEqual(
      DESKTOP_PROVENANCE
    );
  });

  it('carries the chain on executeIR()', async () => {
    const bridge = createBridge(createProxyBackend('tunnel', DESKTOP_PROVENANCE));

    const response = await bridge.executeIR(createRequest());

    expect(response.metadata.provenance?.upstream).toEqual(DESKTOP_PROVENANCE);
  });

  it('keeps the near router near and the far router nested', async () => {
    const router = new Router({ routingStrategy: 'explicit', defaultBackend: 'tunnel' });
    router.register('tunnel', createProxyBackend('tunnel', DESKTOP_PROVENANCE));
    const bridge = createBridge(router);

    const response = await bridge.chat(createRequest());
    const provenance = response.metadata.provenance;

    expect(provenance?.router).toBe(router.metadata.name);
    expect(provenance?.upstream?.router).toBe('desktop-router');
  });

  it('reaches the far end of the chain from the response', async () => {
    const bridge = createBridge(createProxyBackend('tunnel', DESKTOP_PROVENANCE));

    const response = await bridge.chat(createRequest());

    expect(farthestHop(response.metadata.provenance ?? {}).backend).toBe('llama-cpp');
  });
});

// ============================================================================
// #110 (4) - single-hop readers are unchanged
// ============================================================================

describe('existing single-hop readers still read the nearest hop (#110)', () => {
  it('credits backendUsage to the proxy, not the backend it forwarded to', async () => {
    const bridge = createBridge(createProxyBackend('tunnel', DESKTOP_PROVENANCE));

    await bridge.chat(createRequest());
    await bridge.chat(createRequest());
    const stats = bridge.getStats();

    expect(stats.backendUsage).toEqual({ tunnel: 2 });
    expect(stats.backendUsage).not.toHaveProperty('llama-cpp');
  });

  it('leaves upstream unset for a backend that did not forward', async () => {
    const bridge = createBridge(createProxyBackend('solo', undefined));

    const response = await bridge.chat(createRequest());

    expect(response.metadata.provenance?.upstream).toBeUndefined();
    expect(response.metadata.provenance?.backend).toBe('solo');
  });

  it('leaves upstream unset on the streaming path too', async () => {
    const bridge = createBridge(createProxyBackend('solo', undefined));

    const start = await startChunkOf(bridge.chatStream(createRequest()));

    expect(start?.type === 'start' && start.metadata.provenance?.upstream).toBeUndefined();
  });

  it('keeps the #57 shape a single-hop reader already depended on', async () => {
    const bridge = createBridge(createProxyBackend('solo', undefined));

    const response = await bridge.chat(createRequest());

    expect(response.metadata.provenance).toEqual({
      frontend: 'generic-frontend',
      backend: 'solo',
    });
  });
});
