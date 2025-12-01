/**
 * Model Cache
 *
 * In-memory caching for model lists to reduce API calls.
 * Supports both global (shared) and instance-scoped caches.
 *
 * @module
 */

import type { ListModelsResult } from 'ai.matey.types';

// ============================================================================
// Cache Entry
// ============================================================================

/**
 * Internal cache entry with TTL tracking.
 */
interface CacheEntry {
  /**
   * Cached model list result.
   */
  readonly result: ListModelsResult;

  /**
   * When this entry expires (Unix milliseconds).
   */
  readonly expiresAt: number;
}

// ============================================================================
// Model Cache Implementation
// ============================================================================

/**
 * In-memory cache for model lists with TTL-based expiration.
 *
 * Usage:
 * ```typescript
 * const cache = new ModelCache();
 *
 * // Set with 1 hour TTL
 * cache.set('openai-backend', modelResult, 3600000);
 *
 * // Get (returns null if expired or not found)
 * const cached = cache.get('openai-backend');
 *
 * // Invalidate specific backend
 * cache.invalidate('openai-backend');
 *
 * // Clear all
 * cache.clear();
 * ```
 */
export class ModelCache {
  private cache: Map<string, CacheEntry>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Get cached model list for a backend.
   *
   * @param backendName Unique backend identifier
   * @returns Cached result or null if not found/expired
   */
  get(backendName: string): ListModelsResult | null {
    const entry = this.cache.get(backendName);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(backendName);
      return null;
    }

    // Return cached result (preserve original source)
    return entry.result;
  }

  /**
   * Cache a model list result.
   *
   * @param backendName Unique backend identifier
   * @param result Model list result to cache
   * @param ttl Time to live in milliseconds
   */
  set(backendName: string, result: ListModelsResult, ttl: number): void {
    const expiresAt = Date.now() + ttl;

    this.cache.set(backendName, {
      result,
      expiresAt,
    });
  }

  /**
   * Check if backend has cached models.
   *
   * @param backendName Unique backend identifier
   * @returns true if cache exists and not expired
   */
  has(backendName: string): boolean {
    return this.get(backendName) !== null;
  }

  /**
   * Invalidate (remove) cached models for a backend.
   *
   * @param backendName Unique backend identifier
   */
  invalidate(backendName: string): void {
    this.cache.delete(backendName);
  }

  /**
   * Clear all cached model lists.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get number of cached backends.
   */
  size(): number {
    // Count only non-expired entries
    let count = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now <= entry.expiresAt) {
        count++;
      } else {
        // Clean up expired entry
        this.cache.delete(key);
      }
    }

    return count;
  }

  /**
   * Get all cached backend names (excluding expired).
   */
  keys(): string[] {
    const keys: string[] = [];
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now <= entry.expiresAt) {
        keys.push(key);
      } else {
        // Clean up expired entry
        this.cache.delete(key);
      }
    }

    return keys;
  }
}

// ============================================================================
// Global Cache Instance
// ============================================================================

/**
 * Global model cache shared across all adapter instances.
 *
 * This is the default cache used when `modelsCacheScope: 'global'`.
 * Reduces redundant API calls when multiple adapters share the same backend.
 */
export const globalModelCache = new ModelCache();

// ============================================================================
// Cache Factory
// ============================================================================

/**
 * Create or get model cache based on scope strategy.
 *
 * @param scope Cache scope strategy
 * @returns Model cache instance
 */
export function getModelCache(scope: 'global' | 'instance' = 'global'): ModelCache {
  if (scope === 'global') {
    return globalModelCache;
  }

  // Create new instance-scoped cache
  return new ModelCache();
}
