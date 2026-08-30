/**
 * Embedding Middleware
 *
 * Middleware for the Bridge's embedding chain (`bridge.useEmbed()`):
 * response caching and cost tracking.
 *
 * @module
 */

import { stableHash } from './hash.js';
import type {
  EmbedMiddleware,
  IREmbedRequest,
  IREmbedResponse,
  IRWarning,
} from '@johnhenry/aimatey-types';
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
   * Supplying one takes over key derivation completely: `scopeKey`,
   * `metadata.principal` and `unidentified` are all bypassed, and the
   * generator MUST itself mix in caller identity if the cache is shared
   * across users.
   */
  keyGenerator?: (request: IREmbedRequest) => string;

  /**
   * A tenant/user/session identifier (or a function deriving one from the
   * request) mixed into the *default* cache key, taking precedence over
   * `request.metadata.principal`.
   *
   * Returning `undefined` or `''` from the function form means "this
   * request has no identity", and `unidentified` then decides what happens.
   * Ignored when a custom `keyGenerator` is supplied.
   */
  scopeKey?: string | ((request: IREmbedRequest) => string | undefined);

  /**
   * What to do with a request that carries no caller identity -- no
   * `scopeKey`, no `metadata.principal`.
   *
   * - `'bypass'` (default): do not cache it, and return the response with a
   *   `cache-bypassed` warning. Nothing is stored, so nothing can later be
   *   handed to the wrong caller.
   * - `'share'`: cache it in one unscoped bucket shared by every
   *   unidentified caller -- correct for a single-tenant deployment, wrong
   *   anywhere the cache outlives one user's session.
   *
   * Embeddings are deterministic per model, which makes it tempting to
   * treat them as safe to share. The vector is not the risk: *possession of
   * a cache hit* is, because it reveals that some other caller embedded
   * exactly this text. So the same default applies here as for chat.
   *
   * @default 'bypass'
   */
  unidentified?: 'bypass' | 'share';
}

interface CacheEntry {
  response: IREmbedResponse;
  expiresAt: number;
}

/**
 * Resolve the caller scope an embedding cache entry belongs to.
 *
 * `scopeKey` wins over `metadata.principal`; `undefined` means the request
 * carries no identity at all.
 */
function resolveEmbedCacheScope(
  request: IREmbedRequest,
  scopeKey?: string | ((request: IREmbedRequest) => string | undefined)
): string | undefined {
  const explicit = typeof scopeKey === 'function' ? scopeKey(request) : scopeKey;
  if (explicit !== undefined && explicit !== '') {
    return explicit;
  }

  const principal = request.metadata?.principal;
  return principal !== undefined && principal !== '' ? principal : undefined;
}

/**
 * The warning attached to an embedding response that was not cached because
 * the request carried no caller identity.
 */
const CACHE_BYPASSED_WARNING: IRWarning = {
  category: 'cache-bypassed',
  severity: 'warning',
  message:
    'Embedding response was not cached: the request carries no caller identity, and ' +
    'caching it could serve it to a different caller. Set metadata.principal on the ' +
    "request (bridge.embed(input, { principal })), pass scopeKey, or set unidentified: 'share' " +
    'if this deployment serves a single tenant.',
  field: 'metadata.principal',
  source: 'embedding-caching-middleware',
};

/**
 * The default embedding cache key for a request within a resolved caller
 * `scope`.
 *
 * `scope` is dropped from the hashed payload when undefined, so an
 * explicitly shared cache keeps the keys it had before caller scoping
 * existed.
 */
function defaultCacheKey(request: IREmbedRequest, scope: string | undefined): string {
  const payload = JSON.stringify({
    scope,
    input: request.input,
    model: request.parameters?.model,
    dimensions: request.parameters?.dimensions,
    inputType: request.parameters?.inputType,
  });
  // Cache index only -- see `./hash.ts` for why this is not Node crypto.
  return stableHash(payload);
}

/**
 * Cache embedding responses by input + parameters.
 *
 * Embeddings are deterministic per model, making them ideal cache
 * candidates — repeated embedding of the same documents costs nothing.
 *
 * Entries are scoped to a caller: a request with no `scopeKey` and no
 * `metadata.principal` is not cached at all unless the deployment declares
 * itself single-tenant with `unidentified: 'share'`.
 *
 * @example
 * ```typescript
 * bridge.useEmbed(createEmbeddingCachingMiddleware({ ttl: 24 * 3600 * 1000 }));
 *
 * await bridge.embed(documents, { principal: `tenant-${tenantId}` });
 * ```
 */
export function createEmbeddingCachingMiddleware(
  config: EmbeddingCachingConfig = {}
): EmbedMiddleware {
  const ttl = config.ttl ?? 3_600_000;
  const maxEntries = config.maxEntries ?? 1000;
  const unidentified = config.unidentified ?? 'bypass';
  const cache = new Map<string, CacheEntry>();

  return async (request, next) => {
    let key: string;
    if (config.keyGenerator) {
      key = config.keyGenerator(request);
    } else {
      const scope = resolveEmbedCacheScope(request, config.scopeKey);

      if (scope === undefined && unidentified === 'bypass') {
        const response = await next(request);
        return {
          ...response,
          metadata: {
            ...response.metadata,
            warnings: [...(response.metadata.warnings ?? []), CACHE_BYPASSED_WARNING],
          },
        };
      }

      key = defaultCacheKey(request, scope);
    }

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
