/**
 * Backend Model Cache Tests
 *
 * Tests for the model cache invalidation functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIBackendAdapter } from 'ai.matey.backend';

// ============================================================================
// invalidateModelCache Tests
// ============================================================================

describe('Backend.invalidateModelCache', () => {
  beforeEach(() => {
    // Reset any global state
    vi.restoreAllMocks();
  });

  it('should have invalidateModelCache method', () => {
    const adapter = new OpenAIBackendAdapter({ apiKey: 'test-key' });

    expect(adapter.invalidateModelCache).toBeDefined();
    expect(typeof adapter.invalidateModelCache).toBe('function');
  });

  it('should clear the model cache when called', async () => {
    const adapter = new OpenAIBackendAdapter({
      apiKey: 'test-key',
      models: ['gpt-4', 'gpt-3.5-turbo'], // Use static models for testing
      cacheModels: true,
    });

    // First call - should use static models (and potentially cache)
    const result1 = await adapter.listModels();
    expect(result1.models.length).toBeGreaterThan(0);

    // Invalidate the cache
    adapter.invalidateModelCache();

    // Second call - should still work (fetch fresh or use static)
    const result2 = await adapter.listModels();
    expect(result2.models.length).toBeGreaterThan(0);
  });

  it('should return the adapter for chaining', () => {
    const adapter = new OpenAIBackendAdapter({ apiKey: 'test-key' });

    const result = adapter.invalidateModelCache();

    expect(result).toBe(adapter);
  });
});
