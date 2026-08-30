/**
 * Caller scoping for the caching middleware (issue #44)
 *
 * The caching middleware used to key entries on model/messages/parameters
 * alone. One process answering for several users therefore had a single
 * cache bucket shared by all of them, and the second user to send a prompt
 * was handed the first user's completion -- a disclosure bug wearing a
 * performance bug's clothes.
 *
 * Entries are now scoped to a caller, taken from the middleware's own
 * `scopeKey` or from the request's `metadata.principal`. A request with
 * neither is not cached at all, unless the deployment declares itself
 * single-tenant with `unidentified: 'share'`.
 *
 * These tests pin down all four quadrants: cross-caller misses, same-caller
 * hits, the unidentified default, and the single-tenant opt-in.
 */

import { describe, it, expect } from 'vitest';
import type {
  IRChatRequest,
  IRChatResponse,
  IREmbedRequest,
  IREmbedResponse,
  MiddlewareContext,
} from '@johnhenry/aimatey-types';
import {
  createCachingMiddleware,
  InMemoryCacheStorage,
  createEmbeddingCachingMiddleware,
} from '@johnhenry/aimatey-middleware';
// Internal module, imported directly to reproduce a cache key by hand.
import { stableHash } from '../../packages/middleware/src/hash.js';

// ============================================================================
// Fixtures
// ============================================================================

function makeRequest(principal?: string, content = 'What is my account balance?'): IRChatRequest {
  return {
    messages: [{ role: 'user', content }],
    parameters: { model: 'gpt-4o' },
    metadata: {
      requestId: `req-${principal ?? 'anonymous'}`,
      timestamp: 1_700_000_000_000,
      ...(principal !== undefined && { principal }),
    },
  } as IRChatRequest;
}

function makeContext(request: IRChatRequest): MiddlewareContext {
  return { request, isStreaming: Boolean(request.stream), state: {}, config: {} };
}

/** A backend that answers with data belonging to whoever asked. */
function makeBackend(): { next: (label: string) => () => Promise<IRChatResponse>; calls: number } {
  const state = {
    calls: 0,
    next: (label: string) => async (): Promise<IRChatResponse> => {
      state.calls++;
      return {
        message: { role: 'assistant', content: `private data for ${label}` },
        finishReason: 'stop',
        metadata: { requestId: `res-${label}`, timestamp: 1_700_000_000_000 },
      } as IRChatResponse;
    },
  };
  return state;
}

function makeEmbedRequest(principal?: string, input = 'my private document'): IREmbedRequest {
  return {
    input,
    parameters: { model: 'text-embedding-3-small' },
    metadata: {
      requestId: `req-${principal ?? 'anonymous'}`,
      timestamp: 1_700_000_000_000,
      ...(principal !== undefined && { principal }),
    },
  } as IREmbedRequest;
}

function makeEmbedBackend(): {
  next: (n: number) => () => Promise<IREmbedResponse>;
  calls: number;
} {
  const state = {
    calls: 0,
    next: (n: number) => async (): Promise<IREmbedResponse> => {
      state.calls++;
      return {
        embeddings: [{ index: 0, vector: [n, n, n] }],
        model: 'text-embedding-3-small',
        metadata: { requestId: `res-${n}`, timestamp: 1_700_000_000_000 },
      } as unknown as IREmbedResponse;
    },
  };
  return state;
}

// ============================================================================
// Chat caching
// ============================================================================

describe('createCachingMiddleware caller scoping', () => {
  it('does not serve one caller the response cached for another', async () => {
    const storage = new InMemoryCacheStorage(100);
    const caching = createCachingMiddleware({ storage, ttl: 60_000 });
    const backend = makeBackend();

    const alice = await caching(makeContext(makeRequest('alice')), backend.next('alice'));
    const bob = await caching(makeContext(makeRequest('bob')), backend.next('bob'));

    expect(backend.calls).toBe(2);
    expect(alice.message.content).toBe('private data for alice');
    expect(bob.message.content).toBe('private data for bob');
    expect(bob.metadata.custom?.cacheHit).toBe(false);
    expect(bob.metadata.custom?.cacheKey).not.toBe(alice.metadata.custom?.cacheKey);
  });

  it('still serves the same caller from the cache', async () => {
    const storage = new InMemoryCacheStorage(100);
    const caching = createCachingMiddleware({ storage, ttl: 60_000 });
    const backend = makeBackend();

    const first = await caching(makeContext(makeRequest('alice')), backend.next('alice'));
    const second = await caching(makeContext(makeRequest('alice')), backend.next('alice'));

    expect(backend.calls).toBe(1);
    expect(second.metadata.custom?.cacheHit).toBe(true);
    expect(second.message.content).toBe(first.message.content);
  });

  it('keeps different prompts from the same caller apart', async () => {
    const caching = createCachingMiddleware({ storage: new InMemoryCacheStorage(100) });
    const backend = makeBackend();

    await caching(makeContext(makeRequest('alice', 'Hello')), backend.next('alice'));
    await caching(makeContext(makeRequest('alice', 'Goodbye')), backend.next('alice'));

    expect(backend.calls).toBe(2);
  });

  describe('no caller identity supplied', () => {
    it('does not cache the response, and says why', async () => {
      const storage = new InMemoryCacheStorage(100);
      const caching = createCachingMiddleware({ storage, ttl: 60_000 });
      const backend = makeBackend();

      const first = await caching(makeContext(makeRequest()), backend.next('alice'));
      const second = await caching(makeContext(makeRequest()), backend.next('bob'));

      expect(backend.calls).toBe(2);
      expect(second.message.content).toBe('private data for bob');
      // Nothing was written, so nothing can later be read by the wrong caller.
      expect(storage.getStats().size).toBe(0);

      for (const response of [first, second]) {
        expect(response.metadata.custom?.cacheBypassed).toBe(true);
        expect(response.metadata.custom?.cacheHit).toBe(false);
        expect(response.metadata.custom?.cacheKey).toBeUndefined();
        expect(response.metadata.warnings?.map((w) => w.category)).toContain('cache-bypassed');
      }
    });

    it('treats an empty principal as no identity at all', async () => {
      const storage = new InMemoryCacheStorage(100);
      const caching = createCachingMiddleware({ storage });
      const backend = makeBackend();

      await caching(makeContext(makeRequest('')), backend.next('alice'));
      await caching(makeContext(makeRequest('')), backend.next('bob'));

      expect(backend.calls).toBe(2);
      expect(storage.getStats().size).toBe(0);
    });

    it('treats a scopeKey function returning undefined as no identity at all', async () => {
      const storage = new InMemoryCacheStorage(100);
      const caching = createCachingMiddleware({ storage, scopeKey: () => undefined });
      const backend = makeBackend();

      await caching(makeContext(makeRequest()), backend.next('alice'));
      await caching(makeContext(makeRequest()), backend.next('bob'));

      expect(backend.calls).toBe(2);
      expect(storage.getStats().size).toBe(0);
    });
  });

  describe("single-tenant opt-in (unidentified: 'share')", () => {
    it('shares one cache across every unidentified caller', async () => {
      const storage = new InMemoryCacheStorage(100);
      const caching = createCachingMiddleware({ storage, ttl: 60_000, unidentified: 'share' });
      const backend = makeBackend();

      const first = await caching(makeContext(makeRequest()), backend.next('alice'));
      const second = await caching(makeContext(makeRequest()), backend.next('bob'));

      expect(backend.calls).toBe(1);
      expect(second.metadata.custom?.cacheHit).toBe(true);
      expect(second.message.content).toBe(first.message.content);
      expect(second.metadata.warnings?.map((w) => w.category) ?? []).not.toContain(
        'cache-bypassed'
      );
    });

    it('produces exactly the keys it produced before caller scoping existed', async () => {
      // An existing single-tenant cache (Redis, Memcached, ...) must survive
      // the upgrade: `scope` is undefined here, JSON.stringify drops it, and
      // the hashed payload is byte-for-byte what it always was.
      const caching = createCachingMiddleware({ unidentified: 'share' });
      const backend = makeBackend();

      const response = await caching(makeContext(makeRequest()), backend.next('alice'));

      const legacyPayload = JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'What is my account balance?' }],
        temperature: undefined,
        maxTokens: undefined,
        topP: undefined,
        topK: undefined,
        stopSequences: undefined,
        tools: undefined,
        toolChoice: undefined,
      });
      expect(response.metadata.custom?.cacheKey).toBe(stableHash(legacyPayload));
    });

    it('still separates callers that do identify themselves', async () => {
      const storage = new InMemoryCacheStorage(100);
      const caching = createCachingMiddleware({ storage, unidentified: 'share' });
      const backend = makeBackend();

      await caching(makeContext(makeRequest('alice')), backend.next('alice'));
      await caching(makeContext(makeRequest('bob')), backend.next('bob'));

      expect(backend.calls).toBe(2);
    });
  });

  describe('precedence', () => {
    it('lets the deployment scopeKey override the request principal', async () => {
      // Identity derived out of band (an async-local store, a per-tenant
      // middleware instance) is authoritative over what the request claims.
      const storage = new InMemoryCacheStorage(100);
      const caching = createCachingMiddleware({ storage, scopeKey: 'one-tenant' });
      const backend = makeBackend();

      await caching(makeContext(makeRequest('alice')), backend.next('alice'));
      const second = await caching(makeContext(makeRequest('bob')), backend.next('bob'));

      expect(backend.calls).toBe(1);
      expect(second.metadata.custom?.cacheHit).toBe(true);
    });

    it('falls back to the principal when scopeKey is not set', async () => {
      const storage = new InMemoryCacheStorage(100);
      const caching = createCachingMiddleware({ storage });
      const backend = makeBackend();

      await caching(makeContext(makeRequest('alice')), backend.next('alice'));
      await caching(makeContext(makeRequest('alice')), backend.next('alice'));

      expect(backend.calls).toBe(1);
    });

    it('leaves a custom keyGenerator entirely in charge', async () => {
      // Supplying a generator is the documented way to take over scoping;
      // it must not be second-guessed, even for unidentified requests.
      const storage = new InMemoryCacheStorage(100);
      const caching = createCachingMiddleware({ storage, keyGenerator: () => 'fixed-key' });
      const backend = makeBackend();

      await caching(makeContext(makeRequest()), backend.next('alice'));
      const second = await caching(makeContext(makeRequest()), backend.next('bob'));

      expect(backend.calls).toBe(1);
      expect(second.metadata.custom?.cacheKey).toBe('fixed-key');
    });
  });
});

// ============================================================================
// Embedding caching
// ============================================================================

describe('createEmbeddingCachingMiddleware caller scoping', () => {
  it('does not serve one caller the embedding cached for another', async () => {
    const caching = createEmbeddingCachingMiddleware({ ttl: 60_000 });
    const backend = makeEmbedBackend();

    const alice = await caching(makeEmbedRequest('alice'), backend.next(1));
    const bob = await caching(makeEmbedRequest('bob'), backend.next(2));

    expect(backend.calls).toBe(2);
    expect(bob.embeddings).not.toEqual(alice.embeddings);
  });

  it('still serves the same caller from the cache', async () => {
    const caching = createEmbeddingCachingMiddleware({ ttl: 60_000 });
    const backend = makeEmbedBackend();

    await caching(makeEmbedRequest('alice'), backend.next(1));
    await caching(makeEmbedRequest('alice'), backend.next(2));

    expect(backend.calls).toBe(1);
  });

  it('does not cache a request with no caller identity, and says why', async () => {
    const caching = createEmbeddingCachingMiddleware({ ttl: 60_000 });
    const backend = makeEmbedBackend();

    await caching(makeEmbedRequest(), backend.next(1));
    const second = await caching(makeEmbedRequest(), backend.next(2));

    expect(backend.calls).toBe(2);
    expect(second.metadata.warnings?.map((w) => w.category)).toContain('cache-bypassed');
  });

  it("shares one cache across unidentified callers under unidentified: 'share'", async () => {
    const caching = createEmbeddingCachingMiddleware({ ttl: 60_000, unidentified: 'share' });
    const backend = makeEmbedBackend();

    const first = await caching(makeEmbedRequest(), backend.next(1));
    const second = await caching(makeEmbedRequest(), backend.next(2));

    expect(backend.calls).toBe(1);
    expect(second.embeddings).toEqual(first.embeddings);
  });

  it('lets the deployment scopeKey override the request principal', async () => {
    const caching = createEmbeddingCachingMiddleware({ scopeKey: 'one-tenant' });
    const backend = makeEmbedBackend();

    await caching(makeEmbedRequest('alice'), backend.next(1));
    await caching(makeEmbedRequest('bob'), backend.next(2));

    expect(backend.calls).toBe(1);
  });
});
