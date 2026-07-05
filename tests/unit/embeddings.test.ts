/**
 * Embeddings tests
 *
 * Covers the embedding utilities, Bridge.embed (chunking, dimension
 * normalization, middleware chain, unsupported-backend error), Router.embed
 * (candidate selection + fallback), the OpenAI-compatible backend embed
 * path, and the embedding middleware.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Bridge, Router } from 'ai.matey.core';
import { OpenAIBackendAdapter, GroqBackendAdapter } from 'ai.matey.backend';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend';
import {
  chunkEmbedInputs,
  normalizeDimensions,
  cosineSimilarity,
  supportsEmbeddings,
  openaiEmbedRequestToIR,
  irToOpenAIEmbedResponse,
} from 'ai.matey.utils';
import {
  createEmbeddingCachingMiddleware,
  createEmbeddingCostTrackingMiddleware,
} from 'ai.matey.middleware';
import type {
  BackendAdapter,
  IREmbedRequest,
  IREmbedResponse,
  AdapterMetadata,
} from 'ai.matey.types';

// ============================================================================
// Test helpers
// ============================================================================

function makeEmbedBackend(options: {
  name?: string;
  dimensions?: number;
  maxBatch?: number;
  nativeDimensions?: boolean;
  fail?: boolean;
}): BackendAdapter & { embedCalls: IREmbedRequest[] } {
  const dimensions = options.dimensions ?? 4;
  const embedCalls: IREmbedRequest[] = [];

  const metadata: AdapterMetadata = {
    name: options.name ?? 'mock-embed',
    version: '1.0.0',
    provider: 'Mock',
    capabilities: {
      streaming: false,
      multiModal: false,
      tools: false,
      embeddings: true,
      maxEmbeddingBatchSize: options.maxBatch,
      supportsEmbeddingDimensions: options.nativeDimensions ?? false,
      systemMessageStrategy: 'in-messages',
      supportsMultipleSystemMessages: false,
    },
  };

  return {
    metadata,
    embedCalls,
    fromIR: () => ({}),
    toIR: () => {
      throw new Error('not used');
    },
    execute: () => {
      throw new Error('not used');
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock generator interface
    executeStream: async function* () {
      throw new Error('not used');
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock interface
    embed: async (request: IREmbedRequest): Promise<IREmbedResponse> => {
      if (options.fail) {
        throw new Error('embed failed');
      }
      embedCalls.push(request);
      const inputs = typeof request.input === 'string' ? [request.input] : request.input;
      return {
        embeddings: inputs.map((_, index) => ({
          index,
          vector: new Array<number>(dimensions).fill(0.5),
        })),
        model: request.parameters?.model ?? 'mock-embedding-model',
        dimensions,
        usage: { promptTokens: inputs.length * 3, totalTokens: inputs.length * 3 },
        metadata: request.metadata,
      };
    },
  };
}

function makeBridge(backend: BackendAdapter): Bridge {
  return new Bridge(new OpenAIFrontendAdapter(), backend);
}

// ============================================================================
// Utilities
// ============================================================================

describe('embedding utilities', () => {
  it('chunks inputs by batch size preserving order', () => {
    const batches = chunkEmbedInputs(['a', 'b', 'c', 'd', 'e'], { maxBatchSize: 2 });
    expect(batches).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });

  it('chunks by token budget when configured', () => {
    const batches = chunkEmbedInputs(['aaaa', 'bbbb', 'cc'], {
      maxBatchSize: 10,
      maxTokensPerBatch: 2,
      estimateTokens: (text) => Math.ceil(text.length / 4),
    });
    expect(batches).toEqual([['aaaa', 'bbbb'], ['cc']]);
  });

  it('truncates and re-normalizes vectors', () => {
    const normalized = normalizeDimensions([3, 4, 100], 2, 'truncate');
    expect(normalized).toHaveLength(2);
    const norm = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1);
  });

  it('pads short vectors with zeros', () => {
    expect(normalizeDimensions([1, 2], 4, 'pad')).toEqual([1, 2, 0, 0]);
  });

  it('computes cosine similarity', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(() => cosineSimilarity([1], [1, 2])).toThrow();
  });

  it('round-trips the OpenAI wire format', () => {
    const ir = openaiEmbedRequestToIR({ model: 'text-embedding-3-small', input: ['x', 'y'] });
    expect(ir.input).toEqual(['x', 'y']);
    expect(ir.parameters?.model).toBe('text-embedding-3-small');

    const wire = irToOpenAIEmbedResponse({
      embeddings: [{ index: 0, vector: [0.1, 0.2] }],
      model: 'text-embedding-3-small',
      dimensions: 2,
      usage: { promptTokens: 2, totalTokens: 2 },
      metadata: ir.metadata,
    });
    expect(wire.object).toBe('list');
    expect(wire.data[0]?.embedding).toEqual([0.1, 0.2]);
    expect(wire.usage.prompt_tokens).toBe(2);
  });

  it('detects embedding support including capability opt-out', () => {
    expect(supportsEmbeddings(makeEmbedBackend({}))).toBe(true);
    expect(supportsEmbeddings(new OpenAIBackendAdapter({ apiKey: 'k' }))).toBe(true);
    // Groq inherits embed() from the OpenAI adapter but opts out via capability
    expect(supportsEmbeddings(new GroqBackendAdapter({ apiKey: 'k' }))).toBe(false);
  });
});

// ============================================================================
// Bridge.embed
// ============================================================================

describe('Bridge.embed', () => {
  it('embeds a single input', async () => {
    const backend = makeEmbedBackend({});
    const response = await makeBridge(backend).embed('hello');

    expect(response.embeddings).toHaveLength(1);
    expect(response.dimensions).toBe(4);
    expect(backend.embedCalls).toHaveLength(1);
  });

  it('chunks batches beyond the backend limit and merges in order', async () => {
    const backend = makeEmbedBackend({ maxBatch: 2 });
    const response = await makeBridge(backend).embed(['a', 'b', 'c', 'd', 'e']);

    expect(backend.embedCalls).toHaveLength(3);
    expect(response.embeddings.map((e) => e.index)).toEqual([0, 1, 2, 3, 4]);
    // Usage summed across batches (3 tokens per input)
    expect(response.usage?.promptTokens).toBe(15);
  });

  it('normalizes dimensions client-side with a warning', async () => {
    const backend = makeEmbedBackend({ dimensions: 4, nativeDimensions: false });
    const response = await makeBridge(backend).embed('hello', { dimensions: 2 });

    expect(response.dimensions).toBe(2);
    expect(response.embeddings[0]?.vector).toHaveLength(2);
    expect(response.metadata.warnings?.[0]?.category).toBe('parameter-normalized');
  });

  it('throws native-only when the provider lacks dimensions support', async () => {
    const backend = makeEmbedBackend({ nativeDimensions: false });
    await expect(
      makeBridge(backend).embed('hello', { dimensions: 2, dimensionStrategy: 'native-only' })
    ).rejects.toThrow(/native embedding dimensions/);
  });

  it('throws UNSUPPORTED_FEATURE for non-embedding backends', async () => {
    const backend = new GroqBackendAdapter({ apiKey: 'k' });
    await expect(makeBridge(backend).embed('hello')).rejects.toThrow(/does not support embeddings/);
  });

  it('runs embed middleware around execution', async () => {
    const backend = makeEmbedBackend({});
    const order: string[] = [];
    const bridge = makeBridge(backend)
      .useEmbed(async (request, next) => {
        order.push('outer-before');
        const response = await next(request);
        order.push('outer-after');
        return response;
      })
      .useEmbed(async (request, next) => {
        order.push('inner-before');
        const response = await next(request);
        order.push('inner-after');
        return response;
      });

    await bridge.embed('hello');
    expect(order).toEqual(['outer-before', 'inner-before', 'inner-after', 'outer-after']);
  });
});

// ============================================================================
// Router.embed
// ============================================================================

describe('Router.embed', () => {
  it('routes to an embedding-capable backend', async () => {
    const chatOnly = new GroqBackendAdapter({ apiKey: 'k' });
    const embedder = makeEmbedBackend({ name: 'embedder' });

    const router = new Router();
    router.register('chat-only', chatOnly).register('embedder', embedder);

    const response = await router.embed({
      input: 'hello',
      metadata: { requestId: 'r1', timestamp: Date.now(), provenance: {} },
    });

    expect(response.embeddings).toHaveLength(1);
    expect(embedder.embedCalls).toHaveLength(1);
  });

  it('falls back to the next candidate on failure', async () => {
    const failing = makeEmbedBackend({ name: 'failing', fail: true });
    const working = makeEmbedBackend({ name: 'working' });

    const router = new Router({ fallbackStrategy: 'sequential' });
    router.register('failing', failing).register('working', working);
    router.setFallbackChain(['failing', 'working']);

    const response = await router.embed({
      input: 'hello',
      metadata: { requestId: 'r2', timestamp: Date.now(), provenance: {} },
    });

    expect(response.embeddings).toHaveLength(1);
    expect(working.embedCalls).toHaveLength(1);
  });

  it('throws when no backend supports embeddings', async () => {
    const router = new Router();
    router.register('chat-only', new GroqBackendAdapter({ apiKey: 'k' }));

    await expect(
      router.embed({
        input: 'hello',
        metadata: { requestId: 'r3', timestamp: Date.now(), provenance: {} },
      })
    ).rejects.toThrow(/No registered backend supports embeddings/);
  });
});

// ============================================================================
// OpenAI-compatible backend embed path
// ============================================================================

describe('OpenAI backend embed', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to /embeddings and normalizes the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          object: 'list',
          data: [
            { object: 'embedding', index: 1, embedding: [0.3, 0.4] },
            { object: 'embedding', index: 0, embedding: [0.1, 0.2] },
          ],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 4, total_tokens: 4 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const backend = new OpenAIBackendAdapter({ apiKey: 'test-key' });
    const response = await backend.embed!({
      input: ['first', 'second'],
      parameters: { dimensions: 2 },
      metadata: { requestId: 'r4', timestamp: Date.now(), provenance: {} },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/embeddings');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('text-embedding-3-small');
    expect(body.dimensions).toBe(2);

    // Sorted by index despite out-of-order provider response
    expect(response.embeddings.map((e) => e.index)).toEqual([0, 1]);
    expect(response.embeddings[0]?.vector).toEqual([0.1, 0.2]);
    expect(response.usage?.promptTokens).toBe(4);
  });
});

// ============================================================================
// Embedding middleware
// ============================================================================

describe('embedding middleware', () => {
  it('caches identical requests', async () => {
    const backend = makeEmbedBackend({});
    const bridge = makeBridge(backend).useEmbed(createEmbeddingCachingMiddleware());

    await bridge.embed('same input');
    await bridge.embed('same input');
    await bridge.embed('different input');

    expect(backend.embedCalls).toHaveLength(2);
  });

  it('tracks cost from usage and registry pricing', async () => {
    const backend = makeEmbedBackend({});
    const costs: number[] = [];
    const bridge = makeBridge(backend).useEmbed(
      createEmbeddingCostTrackingMiddleware({
        costPer1M: 1.0,
        onCost: (record) => costs.push(record.costUSD),
      })
    );

    await bridge.embed(['a', 'b']); // 6 tokens at $1/1M
    expect(costs).toHaveLength(1);
    expect(costs[0]).toBeCloseTo(6 / 1_000_000);
  });
});
