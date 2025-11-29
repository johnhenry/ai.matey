/**
 * Tests for model-cache.ts
 *
 * Tests for the ModelCache class and cache utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ModelCache,
  globalModelCache,
  getModelCache,
} from 'ai.matey.utils';
import type { ListModelsResult } from 'ai.matey.types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockResult(models: string[]): ListModelsResult {
  return {
    models: models.map(id => ({ id, name: id, ownedBy: 'test' })),
    source: 'api',
    fetchedAt: Date.now(),
    isComplete: true,
  };
}

// ============================================================================
// ModelCache Tests
// ============================================================================

describe('ModelCache', () => {
  describe('constructor', () => {
    it('should create empty cache', () => {
      const cache = new ModelCache();
      expect(cache.size()).toBe(0);
      expect(cache.keys()).toEqual([]);
    });
  });

  describe('get()', () => {
    it('should return null for non-existent keys', () => {
      const cache = new ModelCache();
      expect(cache.get('non-existent')).toBeNull();
    });

    it('should return cached result', () => {
      const cache = new ModelCache();
      const result = createMockResult(['gpt-4', 'gpt-3.5-turbo']);

      cache.set('openai', result, 60000);

      const cached = cache.get('openai');
      expect(cached).not.toBeNull();
      expect(cached?.models).toHaveLength(2);
    });

    it('should update source to "cache" on retrieval', () => {
      const cache = new ModelCache();
      const result = createMockResult(['gpt-4']);

      cache.set('openai', result, 60000);

      const cached = cache.get('openai');
      expect(cached?.source).toBe('cache');
    });

    it('should return null for expired entries', () => {
      vi.useFakeTimers();

      const cache = new ModelCache();
      const result = createMockResult(['gpt-4']);

      cache.set('openai', result, 1000); // 1 second TTL

      // Advance time past TTL
      vi.advanceTimersByTime(2000);

      const cached = cache.get('openai');
      expect(cached).toBeNull();

      vi.useRealTimers();
    });

    it('should delete expired entries on access', () => {
      vi.useFakeTimers();

      const cache = new ModelCache();
      const result = createMockResult(['gpt-4']);

      cache.set('openai', result, 1000);

      // Advance time past TTL
      vi.advanceTimersByTime(2000);

      // Access triggers deletion
      cache.get('openai');

      // Verify entry is gone
      expect(cache.has('openai')).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('set()', () => {
    it('should store result with TTL', () => {
      const cache = new ModelCache();
      const result = createMockResult(['claude-3-sonnet']);

      cache.set('anthropic', result, 60000);

      expect(cache.has('anthropic')).toBe(true);
    });

    it('should overwrite existing entry', () => {
      const cache = new ModelCache();
      const result1 = createMockResult(['model1']);
      const result2 = createMockResult(['model2', 'model3']);

      cache.set('backend', result1, 60000);
      cache.set('backend', result2, 60000);

      const cached = cache.get('backend');
      expect(cached?.models).toHaveLength(2);
    });

    it('should handle different backends', () => {
      const cache = new ModelCache();

      cache.set('openai', createMockResult(['gpt-4']), 60000);
      cache.set('anthropic', createMockResult(['claude']), 60000);
      cache.set('gemini', createMockResult(['gemini-pro']), 60000);

      expect(cache.size()).toBe(3);
      expect(cache.get('openai')?.models[0].id).toBe('gpt-4');
      expect(cache.get('anthropic')?.models[0].id).toBe('claude');
      expect(cache.get('gemini')?.models[0].id).toBe('gemini-pro');
    });
  });

  describe('has()', () => {
    it('should return false for non-existent keys', () => {
      const cache = new ModelCache();
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should return true for existing non-expired keys', () => {
      const cache = new ModelCache();
      cache.set('openai', createMockResult(['gpt-4']), 60000);
      expect(cache.has('openai')).toBe(true);
    });

    it('should return false for expired keys', () => {
      vi.useFakeTimers();

      const cache = new ModelCache();
      cache.set('openai', createMockResult(['gpt-4']), 1000);

      vi.advanceTimersByTime(2000);

      expect(cache.has('openai')).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('invalidate()', () => {
    it('should remove specific entry', () => {
      const cache = new ModelCache();
      cache.set('openai', createMockResult(['gpt-4']), 60000);
      cache.set('anthropic', createMockResult(['claude']), 60000);

      cache.invalidate('openai');

      expect(cache.has('openai')).toBe(false);
      expect(cache.has('anthropic')).toBe(true);
    });

    it('should handle non-existent keys gracefully', () => {
      const cache = new ModelCache();
      expect(() => cache.invalidate('non-existent')).not.toThrow();
    });
  });

  describe('clear()', () => {
    it('should remove all entries', () => {
      const cache = new ModelCache();
      cache.set('openai', createMockResult(['gpt-4']), 60000);
      cache.set('anthropic', createMockResult(['claude']), 60000);
      cache.set('gemini', createMockResult(['gemini-pro']), 60000);

      expect(cache.size()).toBe(3);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.keys()).toEqual([]);
    });

    it('should handle empty cache', () => {
      const cache = new ModelCache();
      expect(() => cache.clear()).not.toThrow();
    });
  });

  describe('size()', () => {
    it('should return 0 for empty cache', () => {
      const cache = new ModelCache();
      expect(cache.size()).toBe(0);
    });

    it('should return correct count', () => {
      const cache = new ModelCache();
      cache.set('a', createMockResult(['m1']), 60000);
      cache.set('b', createMockResult(['m2']), 60000);
      cache.set('c', createMockResult(['m3']), 60000);

      expect(cache.size()).toBe(3);
    });

    it('should exclude expired entries', () => {
      vi.useFakeTimers();

      const cache = new ModelCache();
      cache.set('short', createMockResult(['m1']), 1000);
      cache.set('long', createMockResult(['m2']), 60000);

      vi.advanceTimersByTime(2000);

      expect(cache.size()).toBe(1);

      vi.useRealTimers();
    });

    it('should clean up expired entries when calculating size', () => {
      vi.useFakeTimers();

      const cache = new ModelCache();
      cache.set('expired', createMockResult(['m1']), 1000);

      vi.advanceTimersByTime(2000);

      // Size calculation should trigger cleanup
      cache.size();

      // Verify cleanup happened
      expect(cache.has('expired')).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('keys()', () => {
    it('should return empty array for empty cache', () => {
      const cache = new ModelCache();
      expect(cache.keys()).toEqual([]);
    });

    it('should return all keys', () => {
      const cache = new ModelCache();
      cache.set('openai', createMockResult(['gpt-4']), 60000);
      cache.set('anthropic', createMockResult(['claude']), 60000);

      const keys = cache.keys();
      expect(keys).toHaveLength(2);
      expect(keys).toContain('openai');
      expect(keys).toContain('anthropic');
    });

    it('should exclude expired keys', () => {
      vi.useFakeTimers();

      const cache = new ModelCache();
      cache.set('expired', createMockResult(['m1']), 1000);
      cache.set('valid', createMockResult(['m2']), 60000);

      vi.advanceTimersByTime(2000);

      const keys = cache.keys();
      expect(keys).toEqual(['valid']);

      vi.useRealTimers();
    });
  });
});

// ============================================================================
// globalModelCache Tests
// ============================================================================

describe('globalModelCache', () => {
  beforeEach(() => {
    globalModelCache.clear();
  });

  afterEach(() => {
    globalModelCache.clear();
  });

  it('should be a ModelCache instance', () => {
    expect(globalModelCache).toBeInstanceOf(ModelCache);
  });

  it('should persist across multiple accesses', () => {
    globalModelCache.set('test', createMockResult(['model']), 60000);

    // Access from different reference
    const cache = getModelCache('global');
    expect(cache.has('test')).toBe(true);
  });

  it('should be shared by multiple callers', () => {
    const cache1 = getModelCache('global');
    const cache2 = getModelCache('global');

    cache1.set('shared', createMockResult(['model']), 60000);

    expect(cache2.has('shared')).toBe(true);
    expect(cache1).toBe(cache2);
  });
});

// ============================================================================
// getModelCache Tests
// ============================================================================

describe('getModelCache', () => {
  afterEach(() => {
    globalModelCache.clear();
  });

  it('should return global cache by default', () => {
    const cache = getModelCache();
    expect(cache).toBe(globalModelCache);
  });

  it('should return global cache when scope is "global"', () => {
    const cache = getModelCache('global');
    expect(cache).toBe(globalModelCache);
  });

  it('should return new instance when scope is "instance"', () => {
    const cache1 = getModelCache('instance');
    const cache2 = getModelCache('instance');

    expect(cache1).toBeInstanceOf(ModelCache);
    expect(cache2).toBeInstanceOf(ModelCache);
    expect(cache1).not.toBe(cache2);
  });

  it('should create isolated instance caches', () => {
    const instanceCache = getModelCache('instance');

    instanceCache.set('instance-only', createMockResult(['model']), 60000);

    expect(instanceCache.has('instance-only')).toBe(true);
    expect(globalModelCache.has('instance-only')).toBe(false);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('ModelCache Edge Cases', () => {
  it('should handle very short TTLs', () => {
    vi.useFakeTimers();

    const cache = new ModelCache();
    cache.set('short', createMockResult(['m']), 1); // 1ms TTL

    vi.advanceTimersByTime(2);

    expect(cache.get('short')).toBeNull();

    vi.useRealTimers();
  });

  it('should handle very long TTLs', () => {
    const cache = new ModelCache();
    const longTTL = 365 * 24 * 60 * 60 * 1000; // 1 year

    cache.set('long', createMockResult(['m']), longTTL);

    expect(cache.has('long')).toBe(true);
  });

  it('should handle special characters in backend names', () => {
    const cache = new ModelCache();

    cache.set('backend/with/slashes', createMockResult(['m1']), 60000);
    cache.set('backend:with:colons', createMockResult(['m2']), 60000);
    cache.set('backend.with.dots', createMockResult(['m3']), 60000);

    expect(cache.has('backend/with/slashes')).toBe(true);
    expect(cache.has('backend:with:colons')).toBe(true);
    expect(cache.has('backend.with.dots')).toBe(true);
  });

  it('should handle empty model results', () => {
    const cache = new ModelCache();
    const emptyResult: ListModelsResult = {
      models: [],
      source: 'api',
      fetchedAt: Date.now(),
      isComplete: true,
    };

    cache.set('empty', emptyResult, 60000);

    const cached = cache.get('empty');
    expect(cached).not.toBeNull();
    expect(cached?.models).toHaveLength(0);
  });

  it('should preserve model metadata', () => {
    const cache = new ModelCache();
    const result: ListModelsResult = {
      models: [{
        id: 'gpt-4',
        name: 'GPT-4',
        description: 'Advanced model',
        ownedBy: 'openai',
        capabilities: {
          maxTokens: 8192,
          contextWindow: 128000,
          supportsStreaming: true,
        },
      }],
      source: 'api',
      fetchedAt: Date.now(),
      isComplete: true,
    };

    cache.set('openai', result, 60000);

    const cached = cache.get('openai');
    expect(cached?.models[0].description).toBe('Advanced model');
    expect(cached?.models[0].capabilities?.maxTokens).toBe(8192);
  });
});
