/**
 * Embedding Middleware
 *
 * Middleware for the Bridge's embedding chain (`bridge.useEmbed()`):
 * response caching and cost tracking.
 *
 * @module
 */

import { stableHash } from './hash.js';
import type { EmbedMiddleware, IREmbedRequest, IREmbedResponse } from '@johnhenry/aimatey-types';
import { getModelPricingInfo } from '@johnhenry/aimatey-utils';

// ============================================================================
// Caching
// ============================================================================

/**
 * Configuration for embedding caching middleware.
 */
export interface EmbeddingCachingConfig {
  /** Time-to-live in milliseconds. @default 3600000 (1 hour) */
  ttl?: number;

  /** Maximum cached entries (LRU-ish eviction of oldest). @default 1000 */
  maxEntries?: number;

  /**
   * Custom cache key generator.
   *
   * **Multi-tenant warning**: if you supply a custom generator, it MUST
   * itself mix in caller/tenant identity when the cache is shared across
   * users -- this option entirely replaces `scopeKey` below.
   */
  keyGenerator?: (request: IREmbedRequest) => string;

  /**
   * A tenant/user/session identifier (or a function deriving one from the
   * request) mixed into the *default* cache key generator.
   *
   * **Multi-tenant deployments sharing a single cache MUST set this** (or
   * supply a fully custom `keyGenerator` that itself scopes by identity) --
   * otherwise two different callers embedding the same input collide on the
   * same cache key and one can receive the other's cached response.
   * Ignored when a custom `keyGenerator` is supplied.
   */
  scopeKey?: string | ((request: IREmbedRequest) => string);
}

interface CacheEntry {
  response: IREmbedResponse;
  expiresAt: number;
}

/**
 * Build the default embedding cache key generator, optionally scoped by
 * `scopeKey`.
 *
 * **Multi-tenant warning**: without `scopeKey`, this hashes only
 * input/model/parameters -- it has no notion of caller identity, so a
 * shared cache will serve one caller's embedding to a different caller who
 * embeds the same input. Pass `scopeKey` (or a custom `keyGenerator`) to
 * scope the cache by tenant/user/session.
 */
function createDefaultKeyGenerator(
  scopeKey?: string | ((request: IREmbedRequest) => string)
): (request: IREmbedRequest) => string {
  return (request: IREmbedRequest): string => {
    const payload = JSON.stringify({
      scope: typeof scopeKey === 'function' ? scopeKey(request) : scopeKey,
      input: request.input,
      model: request.parameters?.model,
      dimensions: request.parameters?.dimensions,
      inputType: request.parameters?.inputType,
    });
    // Cache index only -- see `./hash.ts` for why this is not Node crypto.
    return stableHash(payload);
  };
}

/**
 * Cache embedding responses by input + parameters.
 *
 * Embeddings are deterministic per model, making them ideal cache
 * candidates — repeated embedding of the same documents costs nothing.
 *
 * @example
 * ```typescript
 * bridge.useEmbed(createEmbeddingCachingMiddleware({ ttl: 24 * 3600 * 1000 }));
 * ```
 */
export function createEmbeddingCachingMiddleware(
  config: EmbeddingCachingConfig = {}
): EmbedMiddleware {
  const ttl = config.ttl ?? 3_600_000;
  const maxEntries = config.maxEntries ?? 1000;
  const keyGenerator = config.keyGenerator ?? createDefaultKeyGenerator(config.scopeKey);
  const cache = new Map<string, CacheEntry>();

  return async (request, next) => {
    const key = keyGenerator(request);
    const cached = cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.response;
    }

    const response = await next(request);

    if (cache.size >= maxEntries) {
      // Evict the oldest entry (Map preserves insertion order)
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) {
        cache.delete(oldest);
      }
    }
    cache.set(key, { response, expiresAt: Date.now() + ttl });

    return response;
  };
}

// ============================================================================
// Cost Tracking
// ============================================================================

/**
 * A recorded embedding cost event.
 */
export interface EmbeddingCostRecord {
  requestId: string;
  model: string;
  promptTokens: number;
  costUSD: number;
  timestamp: number;
}

/**
 * Configuration for embedding cost tracking.
 */
export interface EmbeddingCostTrackingConfig {
  /** Called for each priced request. */
  onCost?: (record: EmbeddingCostRecord) => void;

  /**
   * Price per 1M input tokens; defaults to the shared model registry's
   * price for the request's model (0 when unknown).
   */
  costPer1M?: number;
}

/**
 * Track embedding spend using registry pricing and reported usage.
 *
 * @example
 * ```typescript
 * const costs: EmbeddingCostRecord[] = [];
 * bridge.useEmbed(createEmbeddingCostTrackingMiddleware({ onCost: (r) => costs.push(r) }));
 * ```
 */
export function createEmbeddingCostTrackingMiddleware(
  config: EmbeddingCostTrackingConfig = {}
): EmbedMiddleware {
  return async (request, next) => {
    const response = await next(request);

    const promptTokens = response.usage?.promptTokens ?? 0;
    const model = response.model;
    const per1M = config.costPer1M ?? getModelPricingInfo(model)?.inputPer1M ?? 0;
    const costUSD = (promptTokens / 1_000_000) * per1M;

    config.onCost?.({
      requestId: response.metadata.requestId,
      model,
      promptTokens,
      costUSD,
      timestamp: Date.now(),
    });

    return response;
  };
}
