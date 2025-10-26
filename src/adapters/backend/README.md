# Backend Adapters

Backend adapters convert the Universal Intermediate Representation (IR) into provider-specific API calls and execute them against the provider's API.

## Overview

A backend adapter takes an IR request, translates it to the provider's API format, makes the HTTP request, and converts the response back to IR.

```typescript
// IR request (provider-agnostic)
const irRequest = await frontend.toIR(request);

// Backend executes against provider API
const irResponse = await backendAdapter.execute(irRequest);

// Response is in IR format, ready for frontend conversion
```

## Available Backend Adapters

| Adapter | Provider | API URL | Multi-Modal | Streaming | Tools |
|---------|----------|---------|-------------|-----------|-------|
| [OpenAI](#openai-backend-adapter) | OpenAI | api.openai.com | ✅ | ✅ | ✅ |
| [Anthropic](#anthropic-backend-adapter) | Anthropic | api.anthropic.com | ✅ | ✅ | ✅ |
| [Gemini](#gemini-backend-adapter) | Google | generativelanguage.googleapis.com | ✅ | ✅ | ✅ |
| [Mistral](#mistral-backend-adapter) | Mistral AI | api.mistral.ai | ❌ | ✅ | ✅ |
| [Ollama](#ollama-backend-adapter) | Ollama | localhost:11434 | ❌ | ✅ | ❌ |
| [Chrome AI](#chrome-ai-backend-adapter) | Browser | window.ai | ❌ | ✅ | ❌ |

---

## OpenAI Backend Adapter

Execute requests against OpenAI Chat Completions API.

### Configuration

```typescript
import { OpenAIBackendAdapter } from 'ai.matey';

const backend = new OpenAIBackendAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',  // optional
  organization: 'org-123',  // optional
  headers: {  // optional
    'Custom-Header': 'value'
  }
});
```

### API Details

- **Base URL**: `https://api.openai.com/v1`
- **Endpoint**: `/chat/completions`
- **Authentication**: Bearer token (API key)
- **Rate Limits**: Varies by model and tier
- **Docs**: https://platform.openai.com/docs/api-reference/chat

### Usage

```typescript
// Execute non-streaming request
const irResponse = await backend.execute(irRequest);

// Execute streaming request
const stream = backend.executeStream(irRequest);
for await (const chunk of stream) {
  if (chunk.type === 'content') {
    console.log(chunk.delta);
  }
}

// Health check
const isHealthy = await backend.healthCheck();

// Cost estimation
const estimatedCost = await backend.estimateCost(irRequest);
```

### Supported Models

- `gpt-4` - Most capable model
- `gpt-4-turbo` - Latest GPT-4 Turbo
- `gpt-3.5-turbo` - Fast and efficient
- `gpt-4o` - GPT-4 Omni (multi-modal)
- `gpt-4o-mini` - Smaller, faster GPT-4 Omni

### Features

- ✅ System messages (in messages array)
- ✅ Multi-modal (text + images via URLs or base64)
- ✅ Function/tool calling
- ✅ Streaming (SSE format)
- ✅ JSON mode
- ✅ Reproducible outputs (seed parameter)
- ✅ Frequency and presence penalties

### Parameter Mappings

| IR Parameter | OpenAI Parameter | Notes |
|--------------|------------------|-------|
| `model` | `model` | From `parameters.model` |
| `messages` | `messages` | Direct mapping |
| `temperature` | `temperature` | 0-2 range |
| `maxTokens` | `max_tokens` | |
| `topP` | `top_p` | |
| `frequencyPenalty` | `frequency_penalty` | -2 to 2 |
| `presencePenalty` | `presence_penalty` | -2 to 2 |
| `stopSequences` | `stop` | Max 4 sequences |
| `seed` | `seed` | For reproducibility |

### Error Handling

- `401` - Invalid API key → `AuthenticationError`
- `429` - Rate limit exceeded → `RateLimitError`
- `500` - Server error → `ProviderError` (retryable)
- `400` - Invalid request → `ValidationError`

---

## Anthropic Backend Adapter

Execute requests against Anthropic Messages API.

### Configuration

```typescript
import { AnthropicBackendAdapter } from 'ai.matey';

const backend = new AnthropicBackendAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com/v1',  // optional
  headers: {  // optional
    'Custom-Header': 'value'
  }
});
```

### API Details

- **Base URL**: `https://api.anthropic.com/v1`
- **Endpoint**: `/messages`
- **Authentication**: `x-api-key` header
- **API Version**: `2023-06-01` (required header)
- **Rate Limits**: Varies by tier
- **Docs**: https://docs.anthropic.com/claude/reference/messages_post

### Supported Models

- `claude-3-5-sonnet-20241022` - Most intelligent (recommended)
- `claude-3-opus-20240229` - Most capable (legacy)
- `claude-3-sonnet-20240229` - Balanced
- `claude-3-haiku-20240307` - Fast and compact

### Features

- ✅ System prompt as separate parameter
- ✅ Multi-modal (text + images via URLs or base64)
- ✅ Tool calling
- ✅ Streaming (SSE with event types)
- ✅ Top-K sampling
- ❌ Frequency/presence penalties (not supported)

### Parameter Mappings

| IR Parameter | Anthropic Parameter | Notes |
|--------------|---------------------|-------|
| `model` | `model` | From `parameters.model` |
| `messages` | `messages` + `system` | System extracted to separate param |
| `temperature` | `temperature` | 0-1 range |
| `maxTokens` | `max_tokens` | **Required by Anthropic** |
| `topP` | `top_p` | |
| `topK` | `top_k` | Anthropic-specific |
| `stopSequences` | `stop_sequences` | Max 4 sequences |

### Important Notes

- **`max_tokens` is required** - Anthropic API will reject requests without it (defaults to 4096)
- System messages are extracted from messages array and placed in `system` parameter
- Only `user` and `assistant` roles allowed in messages (system is separate)
- Streaming uses SSE with event types: `message_start`, `content_block_delta`, `message_stop`

### Error Handling

- `401` - Invalid API key → `AuthenticationError`
- `429` - Rate limit exceeded → `RateLimitError`
- `529` - Overloaded → `ProviderError` (retryable)
- `400` - Invalid request → `ValidationError`

---

## Gemini Backend Adapter

Execute requests against Google Gemini API.

### Configuration

```typescript
import { GeminiBackendAdapter } from 'ai.matey';

const backend = new GeminiBackendAdapter({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta',  // optional
});
```

### API Details

- **Base URL**: `https://generativelanguage.googleapis.com/v1beta`
- **Endpoint**: `/models/{model}:generateContent` (non-streaming)
- **Streaming Endpoint**: `/models/{model}:streamGenerateContent`
- **Authentication**: API key as query parameter
- **Rate Limits**: 60 requests per minute (free tier)
- **Docs**: https://ai.google.dev/docs

### Supported Models

- `gemini-pro` - Text generation
- `gemini-pro-vision` - Multi-modal (text + images)
- `gemini-1.5-pro` - Latest with 1M token context
- `gemini-1.5-flash` - Faster, more efficient

### Features

- ✅ System instructions (separate from contents)
- ✅ Multi-modal (text + images)
- ✅ Function declarations (tool calling)
- ✅ Streaming (chunked responses)
- ✅ Large context windows (up to 1M tokens)
- ✅ Top-K sampling

### Parameter Mappings

| IR Parameter | Gemini Parameter | Notes |
|--------------|------------------|-------|
| `model` | Model in URL path | |
| `messages` | `contents` | Converted to parts format |
| `temperature` | `generationConfig.temperature` | |
| `maxTokens` | `generationConfig.maxOutputTokens` | |
| `topP` | `generationConfig.topP` | |
| `topK` | `generationConfig.topK` | |
| `stopSequences` | `generationConfig.stopSequences` | |

### Important Notes

- System messages converted to `systemInstruction` parameter
- Messages converted to `contents` with `parts` structure
- Role `assistant` mapped to `model` in Gemini format
- Streaming returns SSE format with `data:` prefix

### Error Handling

- `400` - Invalid argument → `ValidationError`
- `403` - Permission denied → `AuthorizationError`
- `429` - Resource exhausted → `RateLimitError`
- `500` - Internal error → `ProviderError` (retryable)

---

## Mistral Backend Adapter

Execute requests against Mistral AI API.

### Configuration

```typescript
import { MistralBackendAdapter } from 'ai.matey';

const backend = new MistralBackendAdapter({
  apiKey: process.env.MISTRAL_API_KEY,
  baseURL: 'https://api.mistral.ai/v1',  // optional
});
```

### API Details

- **Base URL**: `https://api.mistral.ai/v1`
- **Endpoint**: `/chat/completions`
- **Authentication**: Bearer token (API key)
- **Rate Limits**: Varies by tier
- **Docs**: https://docs.mistral.ai/api/

### Supported Models

- `mistral-large-latest` - Most capable
- `mistral-small` - Fast and efficient
- `mistral-medium` - Balanced performance
- `open-mistral-7b` - Open source, fast

### Features

- ✅ System messages (in messages array)
- ✅ Tool calling (function declarations)
- ✅ Streaming (SSE format)
- ✅ Random seed for reproducibility
- ✅ Safe prompt mode
- ❌ Multi-modal (text only)

### Parameter Mappings

| IR Parameter | Mistral Parameter | Notes |
|--------------|-------------------|-------|
| `model` | `model` | |
| `messages` | `messages` | |
| `temperature` | `temperature` | 0-1 range |
| `maxTokens` | `max_tokens` | |
| `topP` | `top_p` | |
| `seed` | `random_seed` | |

### Important Notes

- API is similar to OpenAI format
- Supports `safe_prompt` for content filtering
- Streaming uses standard SSE format with `data:` prefix

### Error Handling

- `401` - Invalid API key → `AuthenticationError`
- `429` - Rate limit exceeded → `RateLimitError`
- `500` - Server error → `ProviderError` (retryable)

---

## Ollama Backend Adapter

Execute requests against local Ollama server.

### Configuration

```typescript
import { OllamaBackendAdapter } from 'ai.matey';

const backend = new OllamaBackendAdapter({
  baseURL: 'http://localhost:11434',  // default
  // No API key required for local deployment
});
```

### API Details

- **Base URL**: `http://localhost:11434` (default)
- **Endpoint**: `/api/chat`
- **Authentication**: None (local server)
- **Rate Limits**: None (local)
- **Docs**: https://github.com/ollama/ollama/blob/main/docs/api.md

### Supported Models

Any model available in your local Ollama installation:
- `llama2` - Meta's Llama 2
- `llama2:70b` - Larger Llama 2 variant
- `mistral` - Mistral 7B
- `codellama` - Code-specialized Llama
- `phi` - Microsoft Phi models
- And many more...

List models: `ollama list`

### Features

- ✅ Local execution (no API keys)
- ✅ System messages
- ✅ Streaming (JSONL format)
- ✅ Top-K sampling
- ✅ Custom model parameters
- ❌ Multi-modal (text only)
- ❌ Tool calling

### Parameter Mappings

| IR Parameter | Ollama Parameter | Notes |
|--------------|------------------|-------|
| `model` | `model` | Local model name |
| `messages` | `messages` | |
| `temperature` | `options.temperature` | |
| `maxTokens` | `options.num_predict` | |
| `topP` | `options.top_p` | |
| `topK` | `options.top_k` | |
| `stopSequences` | `options.stop` | |

### Important Notes

- Requires Ollama server running locally (`ollama serve`)
- Install models with `ollama pull <model-name>`
- Streaming uses JSONL format (one JSON object per line) instead of SSE
- Parameters are in `options` object
- No authentication or rate limiting

### Error Handling

- Connection refused → `NetworkError` (server not running)
- Model not found → `ProviderError`
- Out of memory → `ProviderError`

---

## Chrome AI Backend Adapter

Execute requests using browser's built-in Chrome AI API.

### Configuration

```typescript
import { ChromeAIBackendAdapter } from 'ai.matey';

// No configuration needed - uses browser API
const backend = new ChromeAIBackendAdapter();
```

### API Details

- **Platform**: Browser only (Chrome 127+)
- **API**: `window.ai` (Prompt API)
- **Authentication**: None (browser-native)
- **Rate Limits**: None
- **Docs**: https://developer.chrome.com/docs/ai/built-in

### Supported Models

- Browser's built-in model (Gemini Nano)
- No model selection available

### Features

- ✅ Browser-native (no API keys or network requests)
- ✅ Privacy-preserving (runs locally)
- ✅ Streaming
- ✅ System prompt
- ❌ Multi-turn conversations (single prompt)
- ❌ Multi-modal (text only)
- ❌ Tool calling
- ❌ Model selection

### Parameter Mappings

| IR Parameter | Chrome AI Parameter | Notes |
|--------------|---------------------|-------|
| `messages` | `prompt` | Concatenated into single prompt |
| `temperature` | `temperature` | |
| `topK` | `topK` | |

### Important Notes

- **Browser only** - requires Chrome 127+ with AI features enabled
- **Experimental API** - subject to change
- Single-turn only - all messages concatenated into one prompt
- Runs locally in browser (no network requests)
- Requires user opt-in to Chrome AI features

### Error Handling

- API not available → `ProviderError`
- Session creation fails → `ProviderError`

### Checking Availability

```typescript
const isAvailable = typeof window !== 'undefined' &&
                   'ai' in window &&
                   typeof window.ai?.createTextSession === 'function';

if (!isAvailable) {
  console.error('Chrome AI not available');
}
```

---

## Common Backend Operations

All backend adapters implement the same interface:

### Execute Non-Streaming Request

```typescript
const irResponse = await backend.execute(irRequest, signal);
```

- `irRequest`: Universal IR chat request
- `signal`: Optional AbortSignal for cancellation
- Returns: `IRChatResponse` with message, usage, metadata

### Execute Streaming Request

```typescript
const stream = backend.executeStream(irRequest, signal);

for await (const chunk of stream) {
  switch (chunk.type) {
    case 'start':
      // Stream started, metadata available
      break;
    case 'content':
      // Content delta
      console.log(chunk.delta);
      break;
    case 'done':
      // Stream completed
      console.log('Finish reason:', chunk.finishReason);
      break;
    case 'error':
      // Error occurred
      console.error(chunk.error);
      break;
  }
}
```

### Health Check

```typescript
const isHealthy = await backend.healthCheck();
```

Returns `true` if backend is accessible and healthy.

### Cost Estimation

```typescript
const estimatedCost = await backend.estimateCost(irRequest);
```

Returns estimated cost in USD, or `null` if not available.

---

## Creating Custom Backend Adapters

To create a custom backend adapter, implement the `BackendAdapter` interface:

```typescript
import type { BackendAdapter, AdapterMetadata } from 'ai.matey';
import type { IRChatRequest, IRChatResponse, IRChatStream } from 'ai.matey';

export class CustomBackendAdapter implements BackendAdapter {
  readonly metadata: AdapterMetadata = {
    name: 'custom-backend',
    version: '1.0.0',
    provider: 'Custom Provider',
    capabilities: {
      streaming: true,
      multiModal: false,
      tools: false,
      systemMessageStrategy: 'in-messages',
      // ... more capabilities
    },
  };

  constructor(private config: BackendAdapterConfig) {
    // Initialize configuration
  }

  async execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
    // 1. Convert IR → provider format
    const providerRequest = this.toProviderFormat(request);

    // 2. Make HTTP request
    const response = await fetch(this.config.baseURL, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(providerRequest),
      signal,
    });

    // 3. Convert provider response → IR
    const providerResponse = await response.json();
    return this.toIR(providerResponse, request);
  }

  async *executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream {
    // Implement streaming...
  }

  async healthCheck(): Promise<boolean> {
    // Check if provider is accessible
  }

  async estimateCost(request: IRChatRequest): Promise<number | null> {
    // Estimate request cost
  }
}
```

See [../../types/adapters.ts](../../types/adapters.ts) for full interface details.

---

## Router Integration

Backend adapters work seamlessly with the Router for failover:

```typescript
import { Router, OpenAIBackendAdapter, AnthropicBackendAdapter } from 'ai.matey';

const router = new Router()
  .register('openai', new OpenAIBackendAdapter({ apiKey: '...' }))
  .register('anthropic', new AnthropicBackendAdapter({ apiKey: '...' }))
  .setFallbackChain(['openai', 'anthropic']);

// Router selects backend and handles failover automatically
const irResponse = await router.execute(irRequest);
```

See [ROADMAP.md](../../ROADMAP.md) for planned improvements to model translation during fallback.
