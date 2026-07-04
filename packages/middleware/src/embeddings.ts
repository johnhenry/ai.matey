/**
 * Embedding Middleware
 *
 * Middleware for the Bridge's embedding chain (`bridge.useEmbed()`):
 * response caching and cost tracking.
 *
 * @module
 */

import { createHash } from 'crypto';
import type { EmbedMiddleware, IREmbedRequest, IREmbedResponse } from 'ai.matey.types';
import { getModelPricingInfo } from 'ai.matey.utils';

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

  /** Custom cache key generator. */
  keyGenerator?: (request: IREmbedRequest) => string;
}

interface CacheEntry {
  response: IREmbedResponse;
  expiresAt: number;
}

function defaultKeyGenerator(request: IREmbedRequest): string {
  const payload = JSON.stringify({
    input: request.input,
    model: request.parameters?.model,
    dimensions: request.parameters?.dimensions,
    inputType: request.parameters?.inputType,
  });
  return createHash('sha256').update(payload).digest('hex');
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
  const keyGenerator = config.keyGenerator ?? defaultKeyGenerator;
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
