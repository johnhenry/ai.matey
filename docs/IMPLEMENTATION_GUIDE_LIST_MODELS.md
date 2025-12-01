# Implementation Guide: listModels() for All Providers

## Overview

This guide details the implementation of `listModels()` for all backend providers with web-sourced fallback lists.

## Goals

1. **Every provider implements `listModels()`**
2. **Providers with APIs fetch dynamically** with caching (1 hour TTL)
3. **All providers have fallback lists** sourced from web research
4. **Default models set to cheapest options** for cost efficiency
5. **Comprehensive test coverage** using TDD approach

## Architecture Pattern

### For Providers WITH APIs (Gemini, Mistral, Cohere, Ollama)

```typescript
async listModels(options?: ListModelsOptions): Promise<ListModelsResult> {
  try {
    // 1. Check static config override first
    if (this.config.models && !options?.forceRefresh) {
      return buildStaticResult(this.config.models, 'provider');
    }

    // 2. Check cache
    if (this.config.cacheModels !== false && !options?.forceRefresh) {
      const cached = this.modelCache.get(this.metadata.name);
      if (cached) {
        return applyModelFilter(cached, options?.filter);
      }
    }

    // 3. Fetch from API
    const response = await fetch(endpoint, { headers, signal });
    if (!response.ok) throw error;

    const data = await response.json();
    const models = transformToAIModel(data);

    const result: ListModelsResult = {
      models,
      source: 'remote',
      fetchedAt: Date.now(),
      isComplete: true,
    };

    // 4. Cache the result
    if (this.config.cacheModels !== false) {
      this.modelCache.set(this.metadata.name, result, this.config.modelsCacheTTL);
    }

    // 5. Apply filter
    return applyModelFilter(result, options?.filter);

  } catch (error) {
    // 6. Fallback to DEFAULT_*_MODELS on error
    if (!options?.forceRefresh) {
      const cached = this.modelCache.get(this.metadata.name);
      if (cached) return cached;
    }

    // Return static fallback list
    const result: ListModelsResult = {
      models: [...DEFAULT_PROVIDER_MODELS],
      source: 'static',
      fetchedAt: Date.now(),
      isComplete: true,
    };
    return applyModelFilter(result, options?.filter);
  }
}
```

### For Providers WITHOUT APIs (AI21, Anthropic)

```typescript
listModels(options?: ListModelsOptions): Promise<ListModelsResult> {
  // 1. Check static config first
  if (this.config.models) {
    return Promise.resolve(buildStaticResult(this.config.models, 'provider'));
  }

  // 2. Use default models
  const result: ListModelsResult = {
    models: [...DEFAULT_PROVIDER_MODELS],
    source: 'static',
    fetchedAt: Date.now(),
    isComplete: true,
  };

  // 3. Apply filter
  return Promise.resolve(applyModelFilter(result, options?.filter));
}
```

## Implementation Steps

### Step 1: Default Model Constants (COMPLETED)

**File**: `packages/backend/src/shared.ts`

✅ Added:
- `DEFAULT_ANTHROPIC_MODELS` - Updated with Claude 4 models
- `DEFAULT_AI21_MODELS` - Jamba 1.5 models
- `DEFAULT_GEMINI_MODELS` - Gemini 2.0, 2.5, 3.0 models
- `DEFAULT_COHERE_MODELS` - Command R and Command A models
- `DEFAULT_MISTRAL_MODELS` - Mistral Small/Medium/Large, Codestral

### Step 2: AI21 Implementation (COMPLETED)

✅ Implemented:
- Fallback-only `listModels()` method
- Updated default model to `jamba-1.5-mini` (cheapest)

### Step 3: Gemini Implementation

**File**: `packages/backend/src/providers/gemini.ts`

**API Endpoint**: `GET https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`

**Response Format**:
```json
{
  "models": [
    {
      "name": "models/gemini-2.0-flash",
      "displayName": "Gemini 2.0 Flash",
      "description": "...",
      "inputTokenLimit": 1000000,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": ["generateContent"],
      ...
    }
  ],
  "nextPageToken": "..."
}
```

**Transform Logic**:
```typescript
private transformGeminiModel(model: any): AIModel {
  return {
    id: model.name.replace('models/', ''),
    name: model.displayName,
    description: model.description,
    ownedBy: 'google',
    capabilities: {
      maxTokens: model.outputTokenLimit,
      contextWindow: model.inputTokenLimit,
      supportsStreaming: true,
      supportsVision: model.supportedGenerationMethods?.includes('generateContent'),
      supportsTools: true,
      supportsJSON: true,
    },
  };
}
```

**Default Model**: `gemini-2.0-flash-lite` (cheapest)

### Step 4: Mistral Implementation

**File**: `packages/backend/src/providers/mistral.ts`

**API Endpoint**: `GET https://api.mistral.ai/v1/models`

**Response Format**:
```json
{
  "object": "list",
  "data": [
    {
      "id": "mistral-small-2501",
      "object": "model",
      "created": 1234567890,
      "owned_by": "mistralai",
      ...
    }
  ]
}
```

**Transform Logic**:
```typescript
private transformMistralModel(model: any): AIModel {
  return {
    id: model.id,
    name: model.id,
    ownedBy: 'mistralai',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 32000,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: true,
      supportsJSON: true,
    },
  };
}
```

**Default Model**: `mistral-small-2501` (cheapest at $0.20/$0.60 per 1M tokens)

### Step 5: Cohere Implementation

**File**: `packages/backend/src/providers/cohere.ts`

**API Endpoint**: `GET https://api.cohere.ai/v1/models` (exact endpoint TBD from docs)

**Response Format**: (To be determined from API)

**Default Model**: `command-r7b` (cheapest)

### Step 6: Ollama Implementation

**File**: `packages/backend/src/providers/ollama.ts`

**API Endpoint**: `GET http://localhost:11434/api/tags`

**Response Format**:
```json
{
  "models": [
    {
      "name": "llama3.2:latest",
      "modified_at": "2024-12-01T12:00:00Z",
      "size": 1234567890,
      "digest": "sha256:...",
      "details": {
        "format": "gguf",
        "family": "llama",
        "parameter_size": "3B",
        "quantization_level": "Q4_0"
      }
    }
  ]
}
```

**Transform Logic**:
```typescript
private transformOllamaModel(model: any): AIModel {
  return {
    id: model.name,
    name: model.name,
    ownedBy: 'ollama',
    capabilities: {
      maxTokens: 4096,
      contextWindow: 8192,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: false,
      supportsJSON: false,
    },
  };
}
```

**Note**: Ollama has no default model (user must pull models locally)

### Step 7: Update Default Models

Update `defaultModel` in constructors for all providers:

| Provider | Current Default | New Default (Cheapest) |
|----------|----------------|------------------------|
| Anthropic | claude-3-haiku-20240307 | claude-3-5-haiku-20241022 |
| OpenAI | (none) | gpt-4o-mini |
| AI21 | jamba-instruct | ✅ jamba-1.5-mini |
| Gemini | (TBD) | gemini-2.0-flash-lite |
| Mistral | (TBD) | mistral-small-2501 |
| Cohere | (TBD) | command-r7b |
| DeepSeek | (none) | deepseek-chat |
| Groq | llama-3.3-70b-versatile | llama-3.1-8b-instant |

### Step 8: Model Cache Setup

All providers with APIs need model cache:

```typescript
import { getModelCache } from '../utils/model-cache.js';

class ProviderBackendAdapter {
  private modelCache = getModelCache(this.config.modelsCacheScope || 'global');

  invalidateModelCache(): this {
    this.modelCache.invalidate(this.metadata.name);
    return this;
  }
}
```

### Step 9: Test Coverage (TDD)

**Test Files**:
- `tests/unit/backend/ai21.test.ts` ✅
- `tests/unit/backend/gemini.test.ts`
- `tests/unit/backend/mistral.test.ts`
- `tests/unit/backend/cohere.test.ts`
- `tests/unit/backend/ollama.test.ts`

**Test Cases per Provider**:
1. **listModels() with static config override**
2. **listModels() with API success** (cached)
3. **listModels() with API error** (fallback to DEFAULT_MODELS)
4. **listModels() with forceRefresh** (bypasses cache)
5. **listModels() with filter** (filters by capabilities)
6. **invalidateModelCache()** (clears cache)

**Example Test Structure**:
```typescript
describe('ProviderBackendAdapter', () => {
  describe('listModels', () => {
    it('should return static config models when provided', async () => {
      const adapter = new ProviderBackendAdapter({
        apiKey: 'test',
        models: ['model-1', 'model-2'],
      });

      const result = await adapter.listModels();

      expect(result.source).toBe('static');
      expect(result.models).toHaveLength(2);
    });

    it('should fetch from API and cache', async () => {
      // Mock successful API response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const result = await adapter.listModels();

      expect(result.source).toBe('remote');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const cachedResult = await adapter.listModels();
      expect(global.fetch).toHaveBeenCalledTimes(1); // No new call
    });

    it('should fallback to DEFAULT_MODELS on API error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const result = await adapter.listModels();

      expect(result.source).toBe('static');
      expect(result.models).toEqual(DEFAULT_PROVIDER_MODELS);
    });

    it('should respect forceRefresh option', async () => {
      // Fill cache first
      await adapter.listModels();

      // Force refresh
      await adapter.listModels({ forceRefresh: true });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should filter models by capabilities', async () => {
      const result = await adapter.listModels({
        filter: { supportsVision: true }
      });

      expect(result.models.every(m => m.capabilities?.supportsVision)).toBe(true);
    });
  });

  describe('invalidateModelCache', () => {
    it('should clear the cache', async () => {
      await adapter.listModels(); // Fill cache
      adapter.invalidateModelCache();
      await adapter.listModels(); // Should fetch again

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
```

## Dependencies

**New Imports Needed**:
```typescript
import { getModelCache } from '../utils/model-cache.js';
import { buildStaticResult, applyModelFilter, DEFAULT_PROVIDER_MODELS } from '../shared.js';
import type { ListModelsOptions, ListModelsResult, ModelCapabilityFilter } from 'ai.matey.types';
```

**New Types** (if not already defined):
```typescript
export interface ListModelsOptions {
  forceRefresh?: boolean;
  filter?: ModelCapabilityFilter;
}

export interface ListModelsResult {
  models: AIModel[];
  source: 'static' | 'remote';
  fetchedAt: number;
  isComplete: boolean;
}

export interface ModelCapabilityFilter {
  supportsStreaming?: boolean;
  supportsVision?: boolean;
  supportsTools?: boolean;
  supportsJSON?: boolean;
}
```

## Error Handling

**Strategy**:
1. Try static config override first
2. Try cache (if enabled and not forceRefresh)
3. Try API fetch
4. On API error, try returning cached result
5. As last resort, return DEFAULT_MODELS fallback

**Never throw errors** - always return a result (either from API, cache, or fallback)

## Pricing and Default Models

**Cost Per 1M Tokens (Input/Output)**:
- Gemini 2.0 Flash-Lite: ~$0.10 / $0.30
- Mistral Small: $0.20 / $0.60
- Cohere Command R7B: $0.15 / $0.60
- Claude 3.5 Haiku: $0.80 / $4.00
- GPT-4o Mini: $0.15 / $0.60
- Jamba 1.5 Mini: $0.20 / $0.40

## Success Criteria

- ✅ All 24 backend providers implement `listModels()`
- ✅ All providers with APIs fetch dynamically with caching
- ✅ All providers have fallback lists from web research
- ✅ Default models set to cheapest options
- ✅ 100% test coverage for `listModels()` methods
- ✅ Documentation updated (skill + roadmap)
- ✅ All tests passing

## Timeline

1. Write tests for Gemini - 15 min
2. Implement Gemini listModels() - 20 min
3. Write tests for Mistral - 10 min
4. Implement Mistral listModels() - 20 min
5. Write tests for Cohere - 10 min
6. Implement Cohere listModels() - 20 min
7. Write tests for Ollama - 10 min
8. Implement Ollama listModels() - 15 min
9. Update default models - 10 min
10. Run all tests and fix - 15 min
11. Update documentation - 10 min

**Total**: ~2.5 hours

---

*Implementation begins now following TDD approach*
