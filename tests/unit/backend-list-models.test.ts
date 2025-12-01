/**
 * Backend listModels() Tests
 *
 * Comprehensive tests for all backend providers' listModels() implementations.
 * Following TDD approach - tests written before implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GeminiBackendAdapter,
  MistralBackendAdapter,
  CohereBackendAdapter,
  OllamaBackendAdapter,
  AI21BackendAdapter,
  AnthropicBackendAdapter,
} from 'ai.matey.backend';
import {
  DEFAULT_GEMINI_MODELS,
  DEFAULT_MISTRAL_MODELS,
  DEFAULT_COHERE_MODELS,
  DEFAULT_AI21_MODELS,
  DEFAULT_ANTHROPIC_MODELS,
} from '../../packages/backend/src/shared.js';

// ============================================================================
// Test Helpers
// ============================================================================

const mockFetch = (response: any) => {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => response,
  });
};

const mockFetchError = (error: Error) => {
  global.fetch = vi.fn().mockRejectedValueOnce(error);
};

// ============================================================================
// Gemini Backend Tests
// ============================================================================

describe('GeminiBackendAdapter.listModels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return static config models when provided', async () => {
    const adapter = new GeminiBackendAdapter({
      apiKey: 'test-key',
      models: ['gemini-pro', 'gemini-flash'],
    });

    const result = await adapter.listModels();

    expect(result.source).toBe('static');
    expect(result.models).toHaveLength(2);
    expect(result.models[0].id).toBe('gemini-pro');
  });

  it('should fetch from API and cache result', async () => {
    mockFetch({
      models: [
        {
          name: 'models/gemini-2.0-flash',
          displayName: 'Gemini 2.0 Flash',
          description: 'Fast model',
          inputTokenLimit: 1000000,
          outputTokenLimit: 8192,
          supportedGenerationMethods: ['generateContent'],
        },
      ],
    });

    const adapter = new GeminiBackendAdapter({ apiKey: 'test-key' });
    const result = await adapter.listModels();

    expect(result.source).toBe('remote');
    expect(result.models).toHaveLength(1);
    expect(result.models[0].id).toBe('gemini-2.0-flash');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const cachedResult = await adapter.listModels();
    expect(cachedResult.source).toBe('remote');
    expect(global.fetch).toHaveBeenCalledTimes(1); // No additional call
  });

  it('should fallback to DEFAULT_GEMINI_MODELS on API error', async () => {
    mockFetchError(new Error('Network error'));

    const adapter = new GeminiBackendAdapter({ apiKey: 'test-key' });
    const result = await adapter.listModels();

    expect(result.source).toBe('static');
    expect(result.models).toEqual(DEFAULT_GEMINI_MODELS);
  });

  it('should respect forceRefresh option', async () => {
    mockFetch({ models: [{ name: 'models/test-1' }] });
    const adapter = new GeminiBackendAdapter({ apiKey: 'test-key' });

    await adapter.listModels(); // Fill cache

    mockFetch({ models: [{ name: 'models/test-2' }] });
    await adapter.listModels({ forceRefresh: true });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should filter models by capabilities', async () => {
    const adapter = new GeminiBackendAdapter({
      apiKey: 'test-key',
      models: DEFAULT_GEMINI_MODELS,
    });

    const result = await adapter.listModels({
      filter: { supportsVision: true },
    });

    expect(result.models.every((m) => m.capabilities?.supportsVision)).toBe(true);
  });

  it('should have invalidateModelCache method', () => {
    const adapter = new GeminiBackendAdapter({ apiKey: 'test-key' });

    expect(adapter.invalidateModelCache).toBeDefined();
    const result = adapter.invalidateModelCache();
    expect(result).toBe(adapter); // Should return this for chaining
  });
});

// ============================================================================
// Mistral Backend Tests
// ============================================================================

describe('MistralBackendAdapter.listModels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return static config models when provided', async () => {
    const adapter = new MistralBackendAdapter({
      apiKey: 'test-key',
      models: ['mistral-small', 'mistral-large'],
    });

    const result = await adapter.listModels();

    expect(result.source).toBe('static');
    expect(result.models).toHaveLength(2);
  });

  it('should fetch from API and cache result', async () => {
    mockFetch({
      object: 'list',
      data: [
        {
          id: 'mistral-small-2501',
          object: 'model',
          created: 1234567890,
          owned_by: 'mistralai',
        },
      ],
    });

    const adapter = new MistralBackendAdapter({ apiKey: 'test-key' });
    const result = await adapter.listModels();

    expect(result.source).toBe('remote');
    expect(result.models).toHaveLength(1);
    expect(result.models[0].id).toBe('mistral-small-2501');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should fallback to DEFAULT_MISTRAL_MODELS on API error', async () => {
    mockFetchError(new Error('API error'));

    const adapter = new MistralBackendAdapter({ apiKey: 'test-key' });
    const result = await adapter.listModels();

    expect(result.source).toBe('static');
    expect(result.models).toEqual(DEFAULT_MISTRAL_MODELS);
  });

  it('should invalidate cache', async () => {
    mockFetch({ object: 'list', data: [] });
    const adapter = new MistralBackendAdapter({ apiKey: 'test-key' });

    await adapter.listModels();
    adapter.invalidateModelCache();

    mockFetch({ object: 'list', data: [] });
    await adapter.listModels();

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// Cohere Backend Tests
// ============================================================================

describe('CohereBackendAdapter.listModels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return static config models when provided', async () => {
    const adapter = new CohereBackendAdapter({
      apiKey: 'test-key',
      models: ['command-r', 'command-r-plus'],
    });

    const result = await adapter.listModels();

    expect(result.source).toBe('static');
    expect(result.models).toHaveLength(2);
  });

  it('should fetch from API and cache result', async () => {
    mockFetch({
      models: [
        {
          name: 'command-r7b',
          endpoints: ['chat'],
        },
      ],
    });

    const adapter = new CohereBackendAdapter({ apiKey: 'test-key' });
    const result = await adapter.listModels();

    expect(result.source).toBe('remote');
    expect(result.models.length).toBeGreaterThan(0);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should fallback to DEFAULT_COHERE_MODELS on API error', async () => {
    mockFetchError(new Error('Network error'));

    const adapter = new CohereBackendAdapter({ apiKey: 'test-key' });
    const result = await adapter.listModels();

    expect(result.source).toBe('static');
    expect(result.models).toEqual(DEFAULT_COHERE_MODELS);
  });
});

// ============================================================================
// Ollama Backend Tests
// ============================================================================

describe('OllamaBackendAdapter.listModels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return static config models when provided', async () => {
    const adapter = new OllamaBackendAdapter({
      models: ['llama3.2', 'mistral'],
    });

    const result = await adapter.listModels();

    expect(result.source).toBe('static');
    expect(result.models).toHaveLength(2);
  });

  it('should fetch from local API', async () => {
    mockFetch({
      models: [
        {
          name: 'llama3.2:latest',
          modified_at: '2024-12-01T12:00:00Z',
          size: 1234567890,
          details: {
            format: 'gguf',
            family: 'llama',
            parameter_size: '3B',
            quantization_level: 'Q4_0',
          },
        },
      ],
    });

    const adapter = new OllamaBackendAdapter({});
    const result = await adapter.listModels();

    expect(result.source).toBe('remote');
    expect(result.models).toHaveLength(1);
    expect(result.models[0].id).toBe('llama3.2:latest');
  });

  it('should handle API error gracefully', async () => {
    mockFetchError(new Error('Ollama not running'));

    const adapter = new OllamaBackendAdapter({});
    const result = await adapter.listModels();

    // Ollama should return empty list when no local models
    expect(result.source).toBe('static');
    expect(result.models).toEqual([]);
  });
});

// ============================================================================
// AI21 Backend Tests (Already Implemented)
// ============================================================================

describe('AI21BackendAdapter.listModels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return static config models when provided', async () => {
    const adapter = new AI21BackendAdapter({
      apiKey: 'test-key',
      models: ['jamba-mini', 'jamba-large'],
    });

    const result = await adapter.listModels();

    expect(result.source).toBe('static');
    expect(result.models).toHaveLength(2);
  });

  it('should return DEFAULT_AI21_MODELS when no config', async () => {
    const adapter = new AI21BackendAdapter({ apiKey: 'test-key' });
    const result = await adapter.listModels();

    expect(result.source).toBe('static');
    expect(result.models).toEqual(DEFAULT_AI21_MODELS);
  });

  it('should filter models by capabilities', async () => {
    const adapter = new AI21BackendAdapter({ apiKey: 'test-key' });
    const result = await adapter.listModels({
      filter: { supportsTools: true },
    });

    expect(result.models.every((m) => m.capabilities?.supportsTools)).toBe(true);
  });
});

// ============================================================================
// Anthropic Backend Tests
// ============================================================================

describe('AnthropicBackendAdapter.listModels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return updated DEFAULT_ANTHROPIC_MODELS', async () => {
    const adapter = new AnthropicBackendAdapter({ apiKey: 'test-key' });
    const result = await adapter.listModels();

    expect(result.source).toBe('static');
    expect(result.models).toEqual(DEFAULT_ANTHROPIC_MODELS);

    // Verify Claude 4 models are included
    const modelIds = result.models.map((m) => m.id);
    expect(modelIds).toContain('claude-opus-4.5-20251124');
    expect(modelIds).toContain('claude-sonnet-4.5-20250929');
  });

  it('should include 6 models total', async () => {
    const adapter = new AnthropicBackendAdapter({ apiKey: 'test-key' });
    const result = await adapter.listModels();

    expect(result.models).toHaveLength(6); // Claude 4 + 3.5 models
  });
});
