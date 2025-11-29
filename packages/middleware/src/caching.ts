/**
 * Caching Middleware
 *
 * Caches responses with TTL-based expiration and LRU eviction.
 *
 * @module
 */

import type { Middleware, MiddlewareContext, MiddlewareNext, CacheStorage } from 'ai.matey.types';
import type { IRChatRequest, IRChatResponse } from 'ai.matey.types';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for caching middleware.
 */
export interface CachingConfig {
  /**
   * Cache key generator function.
   * @default Default implementation based on request hash
   */
  keyGenerator?: (request: IRChatRequest) => string;

  /**
   * Cache TTL in milliseconds.
   * @default 3600000 (1 hour)
   */
  ttl?: number;

  /**
   * Maximum cache size (number of entries).
   * @default 1000
   */
  maxSize?: number;

  /**
   * Cache storage implementation.
   * @default InMemoryCacheStorage
   */
  storage?: CacheStorage;

  /**
   * Whether to cache streaming responses.
   * @default false
   */
  cacheStreaming?: boolean;
}

// ============================================================================
// Default Key Generator
// ============================================================================

/**
 * Default cache key generator.
 *
 * Generates cache key from model, messages, and parameters.
 * Excludes metadata and streaming flag.
 */
function defaultKeyGenerator(request: IRChatRequest): string {
  // Create a stable cache key from request
  const cacheableData = {
    model: request.parameters?.model,
    messages: request.messages,
    temperature: request.parameters?.temperature,
    maxTokens: request.parameters?.maxTokens,
    topP: request.parameters?.topP,
    topK: request.parameters?.topK,
    stopSequences: request.parameters?.stopSequences,
    tools: request.tools,
    toolChoice: request.toolChoice,
  };

  // Generate hash
  const json = JSON.stringify(cacheableData);
  return createHash('sha256').update(json).digest('hex');
}

// ============================================================================
// In-Memory Cache Storage with LRU
// ============================================================================

interface CacheEntry {
  value: IRChatResponse;
  expiresAt: number;
}

/**
 * In-memory cache storage with LRU eviction.
 */
export class InMemoryCacheStorage implements CacheStorage {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): Promise<IRChatResponse | undefined> {
    const entry = this.cache.get(key);

    if (!entry) {
      return Promise.resolve(undefined);
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return Promise.resolve(undefined);
    }

    // Update access order (LRU)
    this.updateAccessOrder(key);

    return Promise.resolve(entry.value);
  }

  set(key: string, value: IRChatResponse, ttl: number = 3600000): Promise<void> {
    // Evict if at max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    // Store entry
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });

    // Update access order
    this.updateAccessOrder(key);

    return Promise.resolve();
  }

  has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return Promise.resolve(false);
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return Promise.resolve(false);
    }

    return Promise.resolve(true);
  }

  delete(key: string): Promise<boolean> {
    this.removeFromAccessOrder(key);
    return Promise.resolve(this.cache.delete(key));
  }

  clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];
    return Promise.resolve();
  }

  /**
   * Get cache statistics.
   */
  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Update LRU access order.
   */
  private updateAccessOrder(key: string): void {
    // Remove from current position
    this.removeFromAccessOrder(key);

    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order.
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Evict least recently used entry.
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) {
      return;
    }

    // Get least recently used key (first in array)
    const lruKey = this.accessOrder[0];

    if (lruKey) {
      this.cache.delete(lruKey);
      this.accessOrder.shift();
    }
  }

  /**
   * Clean up expired entries.
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // Use Array.from to avoid iteration issues
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    }
  }
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create caching middleware.
 *
 * Caches responses with TTL-based expiration and LRU eviction.
 *
 * @param config Caching configuration
 * @returns Caching middleware
 *
 * @example
 * ```typescript
 * const caching = createCachingMiddleware({
 *   ttl: 3600000, // 1 hour
 *   maxSize: 1000,
 *   cacheStreaming: false
 * });
 *
 * bridge.use(caching);
 * ```
 */
export function createCachingMiddleware(config: CachingConfig = {}): Middleware {
  const {
    keyGenerator = defaultKeyGenerator,
    ttl = 3600000, // 1 hour
    maxSize = 1000,
    storage = new InMemoryCacheStorage(maxSize),
    cacheStreaming = false,
  } = config;

  return async (context: MiddlewareContext, next: MiddlewareNext): Promise<IRChatResponse> => {
    // Skip caching for streaming requests unless explicitly enabled
    if (context.request.stream && !cacheStreaming) {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator(context.request);

    // Check cache
    const cachedResponse = await storage.get(cacheKey);

    if (cachedResponse) {
      // Cache hit - add cache metadata
      return {
        ...cachedResponse,
        metadata: {
          ...cachedResponse.metadata,
          custom: {
            ...cachedResponse.metadata.custom,
            cacheHit: true,
            cacheKey,
          },
        },
      };
    }

    // Cache miss - call next middleware/handler
    const response = await next();

    // Store in cache
    await storage.set(cacheKey, response, ttl);

    // Add cache metadata
    return {
      ...response,
      metadata: {
        ...response.metadata,
        custom: {
          ...response.metadata.custom,
          cacheHit: false,
          cacheKey,
        },
      },
    };
  };
}
