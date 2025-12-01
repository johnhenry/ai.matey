---
name: update-backend-model-lists
description: Check and update hard-coded model lists in backend providers that lack dynamic model listing APIs
trigger: Use when asked to check or update provider model lists, verify model list currency, or as part of quarterly maintenance
---

# Update Backend Model Lists Skill

Use this skill when checking or updating hard-coded model lists for backend providers that don't provide public APIs for dynamic model discovery.

## Context

Some backend providers have hard-coded model lists because they don't provide public APIs to fetch available models dynamically. These lists must be manually updated when providers release new models to ensure users can access the latest capabilities.

**Providers with Hard-coded Lists:**
1. **Anthropic** - ⚠️ **Primary Source**: No public `/models` endpoint, hard-coded list is only option
2. **OpenAI** - ℹ️ **Fallback Only**: Has `/v1/models` API (preferred), hard-coded list for offline/error scenarios

## Prerequisites

Before starting, you'll need:
1. Access to provider documentation (links provided below)
2. Ability to read TypeScript source files
3. Ability to run tests (`npm test`)
4. Permission to commit changes

## Step-by-Step Update Process

### Step 1: Check Anthropic Model List

**File Location:** `packages/backend/src/providers/anthropic.ts`
**Constant:** `DEFAULT_ANTHROPIC_MODELS` (lines 141-212)
**Documentation:** [Anthropic Models Overview](https://docs.anthropic.com/claude/docs/models-overview)

**Process:**
1. Read the current model list from `packages/backend/src/providers/anthropic.ts`
2. Fetch or web search for latest Anthropic model documentation
3. Compare current list with documentation:
   - Check for new models
   - Check for deprecated/removed models
   - Verify model capabilities (vision, tools, JSON, streaming)
   - Verify token limits (maxTokens, contextWindow)
4. If changes are needed, update the `DEFAULT_ANTHROPIC_MODELS` constant

**Current Models (as of last update):**
- claude-3-5-sonnet-20241022
- claude-3-5-haiku-20241022
- claude-3-opus-20240229
- claude-3-sonnet-20240229
- claude-3-haiku-20240307

**Model Entry Format:**
```typescript
{
  id: 'model-id',
  name: 'Model Display Name',
  provider: 'Anthropic',
  maxTokens: 8192,        // Max output tokens
  contextWindow: 200000,   // Total context window
  capabilities: {
    streaming: true,
    functionCalling: true,
    vision: true,          // Check docs
    jsonMode: true,
  },
}
```

### Step 2: Check OpenAI Model List (Lower Priority)

**File Location:** `packages/backend/src/shared.ts`
**Constant:** `DEFAULT_OPENAI_MODELS` (lines 225-330)
**Documentation:** [OpenAI Models](https://platform.openai.com/docs/models)
**API Endpoint:** `GET /v1/models` (actively used by adapter)

**Process:**
1. **Note**: OpenAI adapter uses `/v1/models` API as primary source with caching
2. The fallback list is only used when:
   - API is unreachable (network error)
   - User is offline
   - API returns error
3. Read the current fallback list from `packages/backend/src/shared.ts`
4. Fetch or web search for latest OpenAI model documentation
5. Compare fallback list with documentation:
   - Check for new major models (GPT-4, GPT-3.5 variants)
   - Check for deprecated models
   - Verify capabilities and token limits
6. If major changes are needed, update the `DEFAULT_OPENAI_MODELS` constant

**Current Models (as of last update):**
- gpt-4-turbo-preview
- gpt-4
- gpt-3.5-turbo
- gpt-3.5-turbo-16k

**Priority:** **LOW** - OpenAI adapter fetches models dynamically from API. This fallback list is rarely used and only needs updates when:
- Major new model families are released (e.g., GPT-5)
- Models in fallback list are deprecated/removed
- Capability metadata needs correction

**Recommendation:** Focus on Anthropic updates first, OpenAI fallback list is less critical.

### Step 3: Providers Ready for listModels() Implementation

**Providers with APIs (Not Yet Implemented):**

The following providers have model listing APIs but haven't implemented `listModels()` yet. Consider implementing these when needed:

1. **Gemini** - ✅ HAS API
   - **Endpoint**: `GET https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
   - **Documentation**: [Gemini Models API](https://ai.google.dev/api/models)
   - **Features**: Pagination (50/page), detailed metadata, token limits
   - **Implementation**: Should implement `listModels()` to fetch dynamically

2. **Ollama** - ✅ HAS API
   - **Endpoint**: `GET http://localhost:11434/api/tags`
   - **Documentation**: [Ollama List Models](https://docs.ollama.com/api/tags)
   - **Features**: Lists locally installed models with size, quantization info
   - **Implementation**: Should implement `listModels()` for local discovery

3. **Cohere** - ✅ HAS API
   - **Endpoint**: List Models endpoint (see docs for exact URL)
   - **Documentation**: [Cohere List Models](https://docs.cohere.com/reference/list-models)
   - **Features**: Filtering, pagination, endpoint compatibility info
   - **Implementation**: Should implement `listModels()` to fetch dynamically

4. **Mistral** - ✅ HAS API
   - **Endpoint**: `GET https://api.mistral.ai/v1/models`
   - **Documentation**: [Mistral Models Endpoint](https://docs.mistral.ai/api/endpoint/models)
   - **Features**: Returns BaseModelCard/FTModelCard objects
   - **Implementation**: Should implement `listModels()` to fetch dynamically

5. **AWS Bedrock** - ✅ HAS API
   - **Endpoint**: `ListFoundationModels` (AWS SDK)
   - **Documentation**: [AWS Bedrock API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_ListFoundationModels.html)
   - **Features**: Filter by inference type, modality, provider
   - **Implementation**: Should implement `listModels()` using AWS SDK

6. **Replicate** - ✅ HAS API
   - **Endpoint**: `GET https://api.replicate.com/v1/models`
   - **Documentation**: [Replicate HTTP API](https://replicate.com/docs/reference/http)
   - **Features**: Paginated public models, search capability
   - **Implementation**: Should implement `listModels()` to fetch dynamically

7. **HuggingFace** - ✅ HAS API
   - **Endpoint**: `GET https://huggingface.co/api/models`
   - **Documentation**: [HuggingFace Hub API](https://huggingface.co/docs/hub/en/api)
   - **Features**: Full OpenAPI spec, comprehensive model metadata
   - **Implementation**: Should implement `listModels()` to fetch dynamically

**Provider Without API (Needs Fallback List):**

8. **AI21** - ❌ NO API
   - **Reason**: No list models endpoint in documentation
   - **Current Approach**: Model names specified directly in API calls
   - **Action Needed**: Create `DEFAULT_AI21_MODELS` fallback list similar to Anthropic
   - **Known Models**: jamba-instruct-preview, jamba-mini, jamba-large, j2-ultra, j2-mid, j2-light
   - **Documentation**: [AI21 API Reference](https://docs.ai21.com/reference/introduction)
   - **Priority**: MEDIUM - Should create fallback list for consistency

### Step 4: Update Model Counts in Roadmap

**File Location:** `docs/ROADMAP.md`
**Section:** "Maintenance Tasks > Provider Model List Updates"

After updating model lists, update the roadmap documentation:
1. Update "Current models" counts for each provider
2. Update model ID lists if they changed
3. Update the last update timestamp

### Step 5: Run Tests

After making any changes:

```bash
# Run all tests to ensure nothing broke
npm test

# If tests fail, investigate and fix issues
# Common issues:
# - Type mismatches
# - Missing capabilities
# - Invalid model IDs in tests
```

### Step 6: Commit Changes

If changes were made, commit with appropriate message:

```bash
# If Anthropic models were updated
git add packages/backend/src/providers/anthropic.ts docs/ROADMAP.md
git commit -m "chore: update Anthropic model list"

# If OpenAI models were updated
git add packages/backend/src/shared.ts docs/ROADMAP.md
git commit -m "chore: update OpenAI model list"

# If both were updated
git add packages/backend/src/providers/anthropic.ts packages/backend/src/shared.ts docs/ROADMAP.md
git commit -m "chore: update provider model lists (Anthropic, OpenAI)"
```

## Update Schedule

**Quarterly Reviews:** Jan 1, Apr 1, Jul 1, Oct 1
- Check both Anthropic and OpenAI model lists
- Update as needed
- Document changes in roadmap

**Immediate Updates:** When major model releases are announced
- Monitor provider announcements
- Update within 1 week of major release
- Prioritize models with new capabilities (vision, tools, etc.)

## Model Capability Metadata

When adding or updating models, ensure complete metadata:

```typescript
{
  id: string;              // Model ID (used in API calls)
  name: string;            // Display name (user-friendly)
  provider: string;        // Provider name (must match metadata.provider)
  maxTokens: number;       // Max OUTPUT tokens (not total context)
  contextWindow: number;   // Total context window (input + output)
  capabilities: {
    streaming: boolean;           // Supports streaming responses
    functionCalling: boolean;     // Supports tool/function calls
    vision: boolean;              // Supports image inputs
    jsonMode: boolean;            // Supports JSON mode/structured output
  }
}
```

**Important Distinctions:**
- `maxTokens`: Maximum **output** tokens the model can generate
- `contextWindow`: Total **context** size (input + output combined)
- Always verify from official documentation

## Verification Checklist

Before committing updates:

- [ ] Checked Anthropic documentation for new models
- [ ] Checked OpenAI documentation for new models
- [ ] Verified all model IDs are correct
- [ ] Verified all capability flags are accurate
- [ ] Verified token limits (maxTokens and contextWindow)
- [ ] Updated model counts in ROADMAP.md
- [ ] Ran `npm test` successfully
- [ ] Committed changes with appropriate message
- [ ] Checked for deprecated models to remove

## Advanced: Implementing listModels() for New Providers

If a provider now offers a model listing API:

**Step 1:** Identify the API endpoint
- Check provider documentation
- Test the endpoint with authentication
- Understand the response format

**Step 2:** Implement `listModels()` method
```typescript
async listModels(options?: ListModelsOptions): Promise<ListModelsResult> {
  try {
    const response = await fetch(`${this.baseURL}/models`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: 'Failed to fetch models',
        provenance: { backend: this.metadata.name },
      });
    }

    const data = await response.json();

    // Map provider format to AIModel format
    const models: AIModel[] = data.models.map((model: any) => ({
      id: model.id,
      name: model.name || model.id,
      provider: this.metadata.provider,
      contextWindow: model.context_length || 128000,
      capabilities: {
        streaming: true,
        functionCalling: model.supports_tools || false,
        vision: model.supports_vision || false,
      },
    }));

    return {
      models,
      provider: this.metadata.provider,
      source: 'api',
      fetchedAt: Date.now(),
    };

  } catch (error) {
    throw new ProviderError({
      code: ErrorCode.PROVIDER_ERROR,
      message: `Failed to list models: ${error.message}`,
      provenance: { backend: this.metadata.name },
      cause: error instanceof Error ? error : undefined,
    });
  }
}
```

**Step 3:** Add caching
- Use `modelCache` utilities from `utils/model-cache.js`
- Set appropriate TTL (default: 1 hour)
- Support `forceRefresh` option

**Step 4:** Write tests
- Test API success case
- Test error handling
- Test caching behavior
- Test filter options

## Resources

**Provider Documentation:**
- [Anthropic Models](https://docs.anthropic.com/claude/docs/models-overview)
- [OpenAI Models](https://platform.openai.com/docs/models)
- [Gemini Models](https://ai.google.dev/models)
- [Ollama Models](https://ollama.com/library)

**Related Files:**
- `packages/backend/src/providers/anthropic.ts` - Anthropic adapter
- `packages/backend/src/providers/openai.ts` - OpenAI adapter
- `packages/backend/src/shared.ts` - Shared utilities and constants
- `packages/ai.matey.types/src/adapters.ts` - Type definitions
- `docs/ROADMAP.md` - Roadmap with maintenance tasks

**Utilities:**
- `buildStaticResult()` - Convert arrays to `ListModelsResult`
- `applyModelFilter()` - Filter models by capabilities
- `getModelCache()` - Cache management

## Common Issues & Solutions

### Issue: Provider documentation is unclear about capabilities

**Solution:**
- Test the model directly with API requests
- Check provider's official examples
- Look for changelog/release notes
- When in doubt, mark capability as `false` (safer)

### Issue: Model appears in docs but isn't available yet

**Solution:**
- Check release date in documentation
- Verify via API call if possible
- Add comment in code about future availability
- Wait for GA (General Availability) before adding

### Issue: Deprecated models still in use

**Solution:**
- Check provider's deprecation timeline
- Add comment noting deprecation date
- Keep in list until removal date
- Update documentation to warn users

### Issue: Different regions have different models

**Solution:**
- Document region-specific models in comments
- Add all available models (users can configure baseURL)
- Note regional availability in model metadata

## Example: Adding a New Anthropic Model

Suppose Anthropic releases "claude-3-5-opus-20250101":

```typescript
// In packages/backend/src/providers/anthropic.ts
export const DEFAULT_ANTHROPIC_MODELS: readonly AIModel[] = [
  // NEW MODEL - Added 2025-01-30
  {
    id: 'claude-3-5-opus-20250101',
    name: 'Claude 3.5 Opus',
    provider: 'Anthropic',
    maxTokens: 8192,
    contextWindow: 200000,
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: true,
      jsonMode: true,
    },
  },
  // ... existing models
] as const;
```

Then update `docs/ROADMAP.md`:
```markdown
**Current models**: 6 models (claude-3-5-opus-20250101, claude-3-5-sonnet-20241022, ...)
```

Run tests, commit:
```bash
npm test
git add packages/backend/src/providers/anthropic.ts docs/ROADMAP.md
git commit -m "chore: add Claude 3.5 Opus to Anthropic model list"
```

## Notes

- This skill should be run quarterly or when major model releases occur
- Always verify information from official provider documentation
- When in doubt about capabilities, test with real API calls
- Keep the ROADMAP.md synchronized with code changes
- Document your changes in commit messages for future reference

---

**Last Updated:** 2025-11-30
**Maintainer:** ai.matey development team
