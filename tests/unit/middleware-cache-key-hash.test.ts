/**
 * Cache-key hashing tests (issue #48)
 *
 * `@johnhenry/aimatey-middleware` used to derive its cache keys with Node's
 * `crypto.createHash('sha256')`, imported by the bare specifier `'crypto'`.
 * Bundlers externalize that for browser targets, so `createHash` was
 * `undefined` at runtime and the caching middleware threw
 * `TypeError: (0 , t.createHash) is not a function`.
 *
 * The cache key is an index over `JSON.stringify(...)`, not a security
 * primitive, so it is now produced by a pure-JS 128-bit hash
 * (`packages/middleware/src/hash.ts`). These tests pin down the properties
 * that matters for a cache key: determinism, portability, totality over
 * UTF-16, and collision behaviour.
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
// Internal module: not part of the package's public API, imported directly so
// the hash can be tested in isolation from the middleware that uses it.
import { stableHash } from '../../packages/middleware/src/hash.js';

// ============================================================================
// Reference implementation
// ============================================================================

const FNV_PRIME_64 = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/**
 * Straightforward FNV-1a 64-bit over UTF-16 code units, using BigInt so the
 * 64-bit arithmetic is obviously correct. The shipped implementation splits
 * the state into 32-bit lanes for speed; this is what it must agree with.
 */
function referenceFnv1a64(input: string, offset: bigint): bigint {
  let h = offset;
  for (let i = 0; i < input.length; i++) {
    const unit = input.charCodeAt(i);
    for (const byte of [unit & 0xff, (unit >>> 8) & 0xff]) {
      h = (h ^ BigInt(byte)) & MASK_64;
      h = (h * FNV_PRIME_64) & MASK_64;
    }
  }
  return h;
}

/** Murmur3 fmix32, mirrored for the reference digest. */
function referenceFmix32(value: number): number {
  let h = value >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

function referenceStableHash(input: string): string {
  const lanes = [
    referenceFnv1a64(input, 0xcbf29ce484222325n),
    referenceFnv1a64(input, 0x9e3779b97f4a7c15n),
  ];

  return lanes
    .flatMap((lane) => [Number(lane >> 32n), Number(lane & 0xffffffffn)])
    .map((word) => referenceFmix32(word).toString(16).padStart(8, '0'))
    .join('');
}

// ============================================================================
// Fixtures
// ============================================================================

const UNICODE_SAMPLES: Record<string, string> = {
  ascii: 'hello world',
  emoji: '👋🏽 hello 🌍',
  'emoji-zwj-family': '👩‍👩‍👧‍👦',
  cjk: '你好世界、こんにちは世界、안녕하세요',
  'combining-marks': 'e\u0301gale', // e + U+0301 COMBINING ACUTE ACCENT
  'precomposed-equivalent': '\u00e9gale', // single U+00E9
  rtl: 'مرحبا بالعالم',
  devanagari: 'नमस्ते दुनिया',
  'astral-plane': '𝕳𝖊𝖑𝖑𝖔 𝓦𝓸𝓻𝓵𝓭',
  'lone-high-surrogate': 'a\ud800b',
  'lone-low-surrogate': 'a\udc00b',
  'null-and-controls': 'a\u0000b\u0001c',
  'looks-like-json': '{"a":1}',
};

// These fixtures carry a `principal`, because a request without one is not
// cached at all (#44) and there would be no round-trip left to test. Caller
// scoping itself is covered in `cache-caller-scoping.test.ts`.
function makeRequest(overrides: Partial<IRChatRequest> = {}): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    metadata: { requestId: 'req-1', timestamp: 1_700_000_000_000, principal: 'caller-1' },
    ...overrides,
  } as IRChatRequest;
}

function makeContext(request: IRChatRequest): MiddlewareContext {
  return {
    request,
    isStreaming: Boolean(request.stream),
    state: {},
    config: {},
  };
}

function makeResponse(text: string): IRChatResponse {
  return {
    message: { role: 'assistant', content: text },
    finishReason: 'stop',
    metadata: { requestId: 'req-1', timestamp: 1_700_000_000_000 },
  } as IRChatResponse;
}

// ============================================================================
// stableHash
// ============================================================================

describe('stableHash', () => {
  it('produces a 128-bit digest as 32 lowercase hex characters', () => {
    for (const sample of Object.values(UNICODE_SAMPLES)) {
      expect(stableHash(sample)).toMatch(/^[0-9a-f]{32}$/);
    }
    expect(stableHash('')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is deterministic across repeated calls', () => {
    const input = JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] });
    const first = stableHash(input);

    for (let i = 0; i < 100; i++) {
      expect(stableHash(input)).toBe(first);
    }
  });

  it('matches an independent BigInt reference implementation', () => {
    // The shipped hash does 64-bit multiplication in 32-bit lanes; this pins
    // that expansion against arithmetic that is exact by construction.
    const inputs = [
      '',
      'a',
      'ab',
      'abc',
      ...Object.values(UNICODE_SAMPLES),
      JSON.stringify({ messages: [{ role: 'user', content: 'Hello 👋' }] }),
      'x'.repeat(1000),
    ];

    for (const input of inputs) {
      expect(stableHash(input)).toBe(referenceStableHash(input));
    }
  });

  it('is stable across releases (regression vectors)', () => {
    // Changing these values changes every existing cache key. That is
    // allowed, but it must be a deliberate, changeset-documented decision.
    expect(stableHash('')).toBe(referenceStableHash(''));
    expect(stableHash('ai.matey')).toBe(referenceStableHash('ai.matey'));
    expect(stableHash('👋')).toBe(referenceStableHash('👋'));

    // Snapshot the literal digests so an accidental algorithm change fails
    // loudly rather than silently invalidating every deployed cache.
    expect(stableHash('')).toBe('7347a9db2c773e2c92ca2f0e4bc0fbeb');
    expect(stableHash('ai.matey')).toBe('8285b592f0bd1e1c5a83e7a890ac554c');
    expect(stableHash('hello world')).toBe('40e9dde76e2fd5481b7f4c729b4ad1d4');
    expect(stableHash('\ud83d\udc4b')).toBe('3b22c0215cfd2adf83ddf35a0b6ecf8f');
  });

  it('distinguishes inputs that differ by a single character', () => {
    const base = JSON.stringify({ model: 'gpt-4o', prompt: 'summarise this document' });
    const variants = [
      base,
      base.replace('summarise', 'summarize'),
      base.replace('document', 'documenu'),
      `${base} `,
      ` ${base}`,
      base.toUpperCase(),
    ];

    const digests = new Set(variants.map(stableHash));
    expect(digests.size).toBe(variants.length);
  });

  it('distinguishes transpositions and length-preserving reorderings', () => {
    const inputs = ['ab', 'ba', 'abcd', 'abdc', 'dcba', '0123456789', '9876543210'];
    expect(new Set(inputs.map(stableHash)).size).toBe(inputs.length);
  });

  it('handles the full Unicode range without throwing and keeps samples distinct', () => {
    const digests = new Map<string, string>();

    for (const [name, sample] of Object.entries(UNICODE_SAMPLES)) {
      const digest = stableHash(sample);
      expect(digest).toMatch(/^[0-9a-f]{32}$/);

      const clash = digests.get(digest);
      expect(clash, `${name} collided with ${clash}`).toBeUndefined();
      digests.set(digest, name);
    }
  });

  it('does not conflate a surrogate pair with its component code units', () => {
    // U+1F600 is the surrogate pair \ud83d\ude00. Feeding UTF-16 code units
    // (rather than TextEncoder's UTF-8, which folds lone surrogates to
    // U+FFFD) keeps the pair and each half distinct.
    const pair = '\ud83d\ude00';
    expect(pair.length).toBe(2);

    const digests = new Set([stableHash(pair), stableHash('\ud83d'), stableHash('\ude00')]);
    expect(digests.size).toBe(3);
  });

  it('does not conflate canonically-equivalent but differently-composed strings', () => {
    // The cache key is code-unit level, not NFC-normalized: U+00E9 and
    // U+0065 U+0301 render identically but are different strings, so they
    // must hash differently.
    expect(stableHash('\u00e9')).not.toBe(stableHash('e\u0301'));
  });

  it('shows no collisions over a large set of near-identical inputs', () => {
    // 50,000 keys is well past the ~77,000-entry 50% birthday bound of a
    // 32-bit hash and nowhere near the ~2^64 bound of this one.
    const digests = new Set<string>();
    for (let i = 0; i < 50_000; i++) {
      digests.add(stableHash(`{"model":"gpt-4o","messages":[{"role":"user","content":"${i}"}]}`));
    }
    expect(digests.size).toBe(50_000);
  });

  it('keeps every hex position well distributed', () => {
    // Guards against a lane getting stuck (e.g. a zeroed half of the state):
    // each nibble position should take many different values across a
    // varied corpus.
    const samples = Array.from({ length: 4096 }, (_, i) => `cache-key-${i}-${i * 7919}`);
    const digests = samples.map(stableHash);

    for (let position = 0; position < 32; position++) {
      const seen = new Set(digests.map((d) => d[position]));
      expect(seen.size, `hex position ${position} is degenerate`).toBeGreaterThan(8);
    }
  });
});

// ============================================================================
// Chat caching middleware round-trip
// ============================================================================

describe('createCachingMiddleware cache-key round-trip', () => {
  it('serves a repeated identical request from the cache', async () => {
    const middleware = createCachingMiddleware({ storage: new InMemoryCacheStorage(10) });
    let calls = 0;
    const next = async (): Promise<IRChatResponse> => {
      calls++;
      return makeResponse(`response ${calls}`);
    };

    const request = makeRequest({ messages: [{ role: 'user', content: 'Hello' }] });

    const first = await middleware(makeContext(request), next);
    const second = await middleware(makeContext(makeRequest({ ...request })), next);

    expect(calls).toBe(1);
    expect(second.metadata.custom?.cacheHit).toBe(true);
    expect(second.message.content).toBe(first.message.content);
  });

  it('does not serve a different request from the cache', async () => {
    const middleware = createCachingMiddleware({ storage: new InMemoryCacheStorage(10) });
    let calls = 0;
    const next = async (): Promise<IRChatResponse> => {
      calls++;
      return makeResponse(`response ${calls}`);
    };

    await middleware(
      makeContext(makeRequest({ messages: [{ role: 'user', content: 'Hello' }] })),
      next
    );
    const second = await middleware(
      makeContext(makeRequest({ messages: [{ role: 'user', content: 'Goodbye' }] })),
      next
    );

    expect(calls).toBe(2);
    expect(second.metadata.custom?.cacheHit).toBe(false);
    expect(second.message.content).toBe('response 2');
  });

  it('round-trips requests whose content is emoji, CJK and combining marks', async () => {
    const middleware = createCachingMiddleware({ storage: new InMemoryCacheStorage(100) });
    let calls = 0;
    const next = async (): Promise<IRChatResponse> => {
      calls++;
      return makeResponse(`response ${calls}`);
    };

    const contents = Object.values(UNICODE_SAMPLES);

    // Cold pass: every distinct message must reach the backend exactly once.
    for (const content of contents) {
      await middleware(makeContext(makeRequest({ messages: [{ role: 'user', content }] })), next);
    }
    expect(calls).toBe(contents.length);

    // Warm pass: every one of them must now hit the cache.
    for (const content of contents) {
      const response = await middleware(
        makeContext(makeRequest({ messages: [{ role: 'user', content }] })),
        next
      );
      expect(response.metadata.custom?.cacheHit).toBe(true);
    }
    expect(calls).toBe(contents.length);
  });

  it('scopes keys by scopeKey so tenants do not share entries', async () => {
    const storage = new InMemoryCacheStorage(10);
    let calls = 0;
    const next = async (): Promise<IRChatResponse> => {
      calls++;
      return makeResponse(`response ${calls}`);
    };

    const tenantA = createCachingMiddleware({ storage, scopeKey: 'tenant-a' });
    const tenantB = createCachingMiddleware({ storage, scopeKey: 'tenant-b' });
    const request = makeRequest({ messages: [{ role: 'user', content: 'Hello' }] });

    await tenantA(makeContext(request), next);
    await tenantB(makeContext(request), next);

    expect(calls).toBe(2);
  });
});

// ============================================================================
// Embedding caching middleware round-trip
// ============================================================================

describe('createEmbeddingCachingMiddleware cache-key round-trip', () => {
  const embedResponse = (n: number): IREmbedResponse =>
    ({
      embeddings: [[n, n, n]],
      metadata: { requestId: `req-${n}`, timestamp: 1_700_000_000_000 },
    }) as unknown as IREmbedResponse;

  const embedRequest = (input: string | string[]): IREmbedRequest =>
    ({
      input,
      parameters: { model: 'text-embedding-3-small' },
      metadata: { requestId: 'req-1', timestamp: 1_700_000_000_000, principal: 'caller-1' },
    }) as unknown as IREmbedRequest;

  it('caches repeated inputs and separates different ones, including Unicode', async () => {
    const middleware = createEmbeddingCachingMiddleware({ ttl: 60_000 });
    let calls = 0;
    const next = async (): Promise<IREmbedResponse> => embedResponse(++calls);

    const inputs = ['hello', 'hello world', '👋🏽 hello 🌍', '你好世界', 'égale', 'égale'];

    for (const input of inputs) {
      await middleware(embedRequest(input), next);
    }
    expect(calls).toBe(inputs.length);

    for (const input of inputs) {
      await middleware(embedRequest(input), next);
    }
    expect(calls).toBe(inputs.length);
  });
});
