# Backend HTTP Adapter Creator Skill

Use this skill when the user asks to create a new backend HTTP adapter for ai.matey. Backend adapters transform IR to provider API calls, execute HTTP requests, and convert responses back to IR.

## Prerequisites

Before starting, gather this information from the user:
1. **Provider name** (e.g., "Cohere", "Perplexity")
2. **API base URL** (e.g., "https://api.cohere.ai/v1")
3. **Authentication method** (Bearer token, API key header, URL parameter)
4. **Chat endpoint** (e.g., "/chat" or "/v1/chat/completions")
5. **Streaming support** (SSE, JSONL, or not supported)
6. **System message handling** (in-messages, separate-parameter, prepend-user, not-supported)
7. **Sample request/response** (actual JSON from docs)
8. **Model list endpoint** (if available)
9. **Pricing information** (for cost estimation)

## Step-by-Step Implementation

### Step 1: Create the adapter file

Create `src/adapters/backend/{provider-name}.ts` (lowercase, hyphenated).

Example: `src/adapters/backend/cohere.ts`

### Step 2: Import dependencies and define types

```typescript
/**
 * {Provider} Backend Adapter
 *
 * Adapts Universal IR to {Provider} API.
 *
 * @module
 */

import type { BackendAdapter, BackendAdapterConfig, AdapterMetadata } from '../../types/adapters.js';
import type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRMessage,
  IRStreamChunk,
  FinishReason,
} from '../../types/ir.js';
import {
  AdapterConversionError,
  NetworkError,
  ProviderError,
  StreamError,
  ErrorCode,
  createErrorFromHttpResponse,
} from '../../errors/index.js';
import { normalizeSystemMessages } from '../../utils/system-message.js';
import {
  getEffectiveStreamMode,
  mergeStreamingConfig,
} from '../../utils/streaming-modes.js';

// ============================================================================
// {Provider} API Types
// ============================================================================

/**
 * {Provider} message format.
 */
export interface {Provider}Message {
  role: 'user' | 'assistant' | 'system';  // Adjust based on provider
  content: string;
}

/**
 * {Provider} request format.
 */
export interface {Provider}Request {
  model?: string;
  messages: {Provider}Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  // ... provider-specific parameters
}

/**
 * {Provider} response format.
 */
export interface {Provider}Response {
  id?: string;
  message: {Provider}Message;
  stop_reason?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}
```

### Step 3: Create adapter class with constructor

```typescript
// ============================================================================
// {Provider} Backend Adapter
// ============================================================================

export class {Provider}BackendAdapter implements BackendAdapter<{Provider}Request, {Provider}Response> {
  readonly metadata: AdapterMetadata;
  private readonly config: BackendAdapterConfig;
  private readonly baseURL: string;

  constructor(config: BackendAdapterConfig) {
    this.config = config;
    this.baseURL = config.baseURL || 'https://api.provider.com/v1';

    // Set metadata with accurate capabilities
    this.metadata = {
      name: '{provider-lowercase}-backend',
      version: '1.0.0',
      provider: '{Provider}',
      capabilities: {
        streaming: true,  // Based on provider support
        multiModal: false,  // Based on provider support
        tools: false,  // Based on provider support
        maxContextTokens: 128000,  // Provider's context window

        // CRITICAL: System message strategy
        systemMessageStrategy: 'in-messages',  // or 'separate-parameter', etc.
        supportsMultipleSystemMessages: true,

        // Parameter support
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: false,
        supportsSeed: false,
        supportsFrequencyPenalty: false,
        supportsPresencePenalty: false,
        maxStopSequences: 4,
      },
      config: { baseURL: this.baseURL },
    };
  }
```

### Step 4: Implement fromIR() - IR to Provider Request

```typescript
  /**
   * Convert IR request to {Provider} format.
   *
   * Public method for testing and debugging - see what will be sent to {Provider}.
   */
  public fromIR(request: IRChatRequest): {Provider}Request {
    // CRITICAL: Normalize system messages based on strategy
    const { messages, systemParameter } = normalizeSystemMessages(
      request.messages,
      this.metadata.capabilities.systemMessageStrategy,
      this.metadata.capabilities.supportsMultipleSystemMessages
    );

    // Convert messages to provider format
    const providerMessages: {Provider}Message[] = messages.map((msg) => ({
      role: this.mapRoleToProvider(msg.role),
      content: this.extractTextContent(msg.content),
    }));

    // Build provider request
    const providerRequest: {Provider}Request = {
      model: request.parameters?.model || this.config.defaultModel || 'default-model',
      messages: providerMessages,
      temperature: this.normalizeTemperature(request.parameters?.temperature),
      max_tokens: request.parameters?.maxTokens,
      stream: request.stream || false,
    };

    // Add system parameter if separate-parameter strategy
    if (systemParameter && this.metadata.capabilities.systemMessageStrategy === 'separate-parameter') {
      (providerRequest as any).system = systemParameter;
    }

    // Add optional parameters (only if supported and provided)
    if (request.parameters?.topP !== undefined && this.metadata.capabilities.supportsTopP) {
      (providerRequest as any).top_p = request.parameters.topP;
    }

    if (request.parameters?.topK !== undefined && this.metadata.capabilities.supportsTopK) {
      (providerRequest as any).top_k = request.parameters.topK;
    }

    if (request.parameters?.stopSequences && request.parameters.stopSequences.length > 0) {
      const maxStop = this.metadata.capabilities.maxStopSequences || 4;
      (providerRequest as any).stop = request.parameters.stopSequences.slice(0, maxStop);
    }

    return providerRequest;
  }

  /**
   * Map IR role to provider role.
   */
  private mapRoleToProvider(role: 'system' | 'user' | 'assistant'): string {
    // Handle provider-specific role names
    const roleMap: Record<string, string> = {
      'system': 'system',
      'user': 'user',
      'assistant': 'assistant',  // Or 'bot', 'ai', 'model' for some providers
    };
    return roleMap[role] || 'user';
  }

  /**
   * Extract text content from IR message.
   */
  private extractTextContent(content: string | IRContentBlock[]): string {
    if (typeof content === 'string') {
      return content;
    }
    return content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');
  }

  /**
   * Normalize temperature to provider range.
   * IR uses 0-2, some providers use 0-1.
   */
  private normalizeTemperature(temp?: number): number | undefined {
    if (temp === undefined) return undefined;

    // If provider uses 0-1 range, scale down from IR's 0-2
    // return temp / 2;

    // If provider uses 0-2 like IR, pass through
    return temp;
  }
```

### Step 5: Implement toIR() - Provider Response to IR

```typescript
  /**
   * Convert {Provider} response to IR format.
   *
   * Public method for testing and debugging - parse {Provider} responses manually.
   */
  public toIR(response: {Provider}Response, originalRequest: IRChatRequest, latencyMs: number): IRChatResponse {
    // Extract message
    const message: IRMessage = {
      role: this.mapRoleFromProvider(response.message.role),
      content: response.message.content,
    };

    // Map finish reason
    const finishReason = this.mapFinishReason(response.stop_reason || 'stop');

    // Build IR response
    return {
      message,
      finishReason,
      usage: response.usage ? {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      } : undefined,
      metadata: {
        ...originalRequest.metadata,
        providerResponseId: response.id,
        provenance: {
          ...originalRequest.metadata.provenance,
          backend: this.metadata.name,
        },
        custom: {
          ...originalRequest.metadata.custom,
          latencyMs,
        },
      },
      raw: response as unknown as Record<string, unknown>,
    };
  }

  /**
   * Map provider role to IR role.
   */
  private mapRoleFromProvider(role: string): 'system' | 'user' | 'assistant' {
    const roleMap: Record<string, 'system' | 'user' | 'assistant'> = {
      'system': 'system',
      'user': 'user',
      'assistant': 'assistant',
      'bot': 'assistant',
      'ai': 'assistant',
      'model': 'assistant',
    };
    return roleMap[role.toLowerCase()] || 'assistant';
  }

  /**
   * Map provider finish reason to IR finish reason.
   */
  private mapFinishReason(reason: string): FinishReason {
    const reasonMap: Record<string, FinishReason> = {
      'stop': 'stop',
      'end_turn': 'stop',
      'complete': 'stop',
      'max_tokens': 'length',
      'length': 'length',
      'content_filter': 'content_filter',
      'safety': 'content_filter',
      'tool_calls': 'tool_calls',
      'function_call': 'tool_calls',
    };
    return reasonMap[reason.toLowerCase()] || 'stop';
  }
```

### Step 6: Implement execute() - Non-Streaming Request

```typescript
  async execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
    try {
      // Convert IR to provider format
      const providerRequest = this.fromIR(request);
      providerRequest.stream = false;

      // Build endpoint URL
      const endpoint = `${this.baseURL}/chat`;  // Adjust based on provider

      // Track start time for latency
      const startTime = Date.now();

      // Make HTTP request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(providerRequest),
        signal,
      });

      // Handle HTTP errors
      if (!response.ok) {
        const errorBody = await response.text();
        throw createErrorFromHttpResponse(
          response.status,
          response.statusText,
          errorBody,
          { backend: this.metadata.name }
        );
      }

      // Parse response
      const data = (await response.json()) as {Provider}Response;

      // Convert to IR
      const latencyMs = Date.now() - startTime;
      return this.toIR(data, request, latencyMs);

    } catch (error) {
      // Re-throw known error types
      if (error instanceof NetworkError || error instanceof ProviderError) {
        throw error;
      }

      // Wrap unknown errors
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `{Provider} request failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: true,
        provenance: { backend: this.metadata.name },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Get HTTP headers for {Provider} API.
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Choose authentication method based on provider:

      // Option 1: Bearer token (most common)
      'Authorization': `Bearer ${this.config.apiKey}`,

      // Option 2: Custom header
      // 'X-API-Key': this.config.apiKey,

      // Option 3: Different header name
      // 'api-key': this.config.apiKey,
    };

    // Add provider-specific headers
    // Example: Anthropic version header
    // headers['anthropic-version'] = '2023-06-01';

    // Add browser mode header if enabled
    if (this.config.browserMode) {
      // Add provider-specific browser compatibility header if needed
      // headers['provider-browser-access'] = 'true';
    }

    // Merge with custom headers (custom headers can override)
    return { ...headers, ...this.config.headers };
  }
```

### Step 7: Implement executeStream() - Streaming Request

Choose the appropriate streaming pattern for your provider:

#### Pattern A: SSE (Server-Sent Events) - Used by OpenAI, Anthropic

```typescript
  async *executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream {
    try {
      // Convert IR to provider format with streaming enabled
      const providerRequest = this.fromIR(request);
      providerRequest.stream = true;

      // Get streaming configuration
      const streamingConfig = mergeStreamingConfig(this.config.streaming);
      const effectiveMode = getEffectiveStreamMode(
        request.streamMode,
        undefined,
        streamingConfig
      );
      const includeBoth = streamingConfig.includeBoth || effectiveMode === 'accumulated';

      // Make HTTP request
      const endpoint = `${this.baseURL}/chat`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(providerRequest),
        signal,
      });

      // Handle HTTP errors
      if (!response.ok) {
        const errorBody = await response.text();
        throw createErrorFromHttpResponse(
          response.status,
          response.statusText,
          errorBody,
          { backend: this.metadata.name }
        );
      }

      if (!response.body) {
        throw new StreamError({
          code: ErrorCode.STREAM_ERROR,
          message: 'No response body',
          provenance: { backend: this.metadata.name },
        });
      }

      // Yield start chunk
      let sequence = 0;
      yield {
        type: 'start',
        sequence: sequence++,
        metadata: {
          ...request.metadata,
          provenance: {
            ...request.metadata.provenance,
            backend: this.metadata.name,
          },
        },
      } as IRStreamChunk;

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let contentBuffer = '';  // Accumulate full content

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode chunk
          buffer += decoder.decode(value, { stream: true });

          // Split by newlines
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';  // Keep incomplete line in buffer

          for (const line of lines) {
            // SSE format: "data: {json}"
            if (!line.trim() || !line.startsWith('data: ')) continue;

            const data = line.slice(6).trim();  // Remove "data: " prefix

            // Handle SSE terminator
            if (data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data);

              // Extract content delta
              // Adjust path based on provider's response structure
              const delta = chunk.delta?.content || chunk.message?.content || '';

              if (delta) {
                contentBuffer += delta;

                // Build content chunk
                const contentChunk: IRStreamChunk = {
                  type: 'content',
                  sequence: sequence++,
                  delta: delta,
                  role: 'assistant',
                };

                // Add accumulated field if configured
                if (includeBoth) {
                  (contentChunk as any).accumulated = contentBuffer;
                }

                yield contentChunk;
              }

              // Check for finish
              if (chunk.finish_reason || chunk.stop_reason) {
                const message: IRMessage = {
                  role: 'assistant',
                  content: contentBuffer,
                };

                yield {
                  type: 'done',
                  sequence: sequence++,
                  finishReason: this.mapFinishReason(chunk.finish_reason || chunk.stop_reason),
                  usage: chunk.usage ? {
                    promptTokens: chunk.usage.input_tokens,
                    completionTokens: chunk.usage.output_tokens,
                    totalTokens: chunk.usage.input_tokens + chunk.usage.output_tokens,
                  } : undefined,
                  message,
                } as IRStreamChunk;
              }

            } catch (parseError) {
              console.warn('Failed to parse SSE chunk:', data, parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      // Yield error chunk
      yield {
        type: 'error',
        sequence: 0,
        error: {
          code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      } as IRStreamChunk;
    }
  }
```

#### Pattern B: JSONL (Newline-Delimited JSON) - Used by Ollama

```typescript
  async *executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream {
    try {
      const providerRequest = this.fromIR(request);
      providerRequest.stream = true;

      // ... (same setup as SSE)

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let contentBuffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Split by newlines
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              // Each line is a complete JSON object
              const chunk = JSON.parse(line);

              // Extract content
              const delta = chunk.message?.content || '';
              if (delta) {
                contentBuffer += delta;

                const contentChunk: IRStreamChunk = {
                  type: 'content',
                  sequence: sequence++,
                  delta: delta,
                  role: 'assistant',
                };

                if (includeBoth) {
                  (contentChunk as any).accumulated = contentBuffer;
                }

                yield contentChunk;
              }

              // Check for completion (Ollama uses "done: true")
              if (chunk.done) {
                yield {
                  type: 'done',
                  sequence: sequence++,
                  finishReason: 'stop',
                  message: { role: 'assistant', content: contentBuffer },
                } as IRStreamChunk;
              }

            } catch (parseError) {
              console.warn('Failed to parse JSONL chunk:', line, parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      yield {
        type: 'error',
        sequence: 0,
        error: {
          code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      } as IRStreamChunk;
    }
  }
```

### Step 8: Implement Optional Methods

#### Health Check

```typescript
  async healthCheck(): Promise<boolean> {
    try {
      // Make a simple request to check if API is reachable
      const response = await fetch(`${this.baseURL}/models`, {  // Or any simple endpoint
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),  // 5 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }
```

#### Cost Estimation

```typescript
  async estimateCost(request: IRChatRequest): Promise<number | null> {
    // Define pricing (per 1M tokens)
    const pricing = {
      'model-name-1': { input: 0.50, output: 1.50 },
      'model-name-2': { input: 3.00, output: 15.00 },
    };

    const model = request.parameters?.model || this.config.defaultModel || '';
    const modelPricing = pricing[model as keyof typeof pricing];

    if (!modelPricing) {
      return null;  // Pricing not available for this model
    }

    // Rough token estimation (4 chars ≈ 1 token)
    const inputTokens = request.messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : '';
      return sum + Math.ceil(content.length / 4);
    }, 0);

    const outputTokens = request.parameters?.maxTokens || 1024;

    // Calculate cost
    const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
    const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

    return inputCost + outputCost;
  }
```

#### List Models

```typescript
  async listModels(options?: ListModelsOptions): Promise<ListModelsResult> {
    // If provider has a models endpoint
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

### Step 9: Export the adapter

Add to `src/adapters/backend/index.ts`:

```typescript
// {Provider} backend adapter
export {
  {Provider}BackendAdapter,
  type {Provider}Request,
  type {Provider}Response,
  type {Provider}Message,
} from './{provider-lowercase}.js';
```

### Step 10: Test the adapter

Create `tests/adapters/backend/{provider-lowercase}.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { {Provider}BackendAdapter } from '../../../src/adapters/backend/{provider-lowercase}.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('{Provider}BackendAdapter', () => {
  const adapter = new {Provider}BackendAdapter({
    apiKey: 'test-key-123',
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fromIR', () => {
    it('should convert IR to provider format', () => {
      const irRequest = {
        messages: [
          { role: 'user' as const, content: 'Hello!' }
        ],
        parameters: {
          model: 'test-model',
          temperature: 0.7,
          maxTokens: 100,
        },
        stream: false,
        metadata: {
          requestId: 'test-123',
          timestamp: Date.now(),
          provenance: { frontend: 'test' }
        }
      };

      const providerRequest = adapter.fromIR(irRequest);

      expect(providerRequest.model).toBe('test-model');
      expect(providerRequest.messages).toHaveLength(1);
      expect(providerRequest.messages[0].content).toBe('Hello!');
      expect(providerRequest.temperature).toBe(0.7);
      expect(providerRequest.max_tokens).toBe(100);
    });
  });

  describe('execute', () => {
    it('should make successful request', async () => {
      const mockResponse = {
        id: 'resp-123',
        message: { role: 'assistant', content: 'Hello there!' },
        stop_reason: 'stop',
        usage: { input_tokens: 10, output_tokens: 5 }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const irRequest = {
        messages: [{ role: 'user' as const, content: 'Hi' }],
        parameters: {},
        stream: false,
        metadata: {
          requestId: 'test',
          timestamp: Date.now(),
          provenance: {}
        }
      };

      const response = await adapter.execute(irRequest);

      expect(response.message.content).toBe('Hello there!');
      expect(response.finishReason).toBe('stop');
      expect(response.usage?.promptTokens).toBe(10);
    });
  });
});
```

## Common Patterns & Best Practices

### 1. API Key in URL Parameter

Some providers (like Gemini) use API key in URL:

```typescript
private getEndpoint(path: string): string {
  return `${this.baseURL}${path}?key=${this.config.apiKey}`;
}
```

### 2. Temperature Scaling

If provider uses different range than IR:

```typescript
private normalizeTemperature(temp?: number): number | undefined {
  if (temp === undefined) return undefined;
  // IR: 0-2, Provider: 0-1
  return Math.min(Math.max(temp / 2, 0), 1);
}
```

### 3. Retry Logic

For transient errors:

```typescript
private async fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on rate limit (429) or server error (5xx)
      if (response.status === 429 || response.status >= 500) {
        await this.delay(Math.pow(2, attempt) * 1000);  // Exponential backoff
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
  }

  throw lastError;
}

private delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 4. Browser Compatibility

For providers requiring special browser headers:

```typescript
private getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${this.config.apiKey}`,
  };

  // Add browser-specific header if browserMode enabled
  if (this.config.browserMode) {
    headers['provider-browser-access'] = 'true';
  }

  return { ...headers, ...this.config.headers };
}
```

### 5. Model Caching

For listModels() implementation:

```typescript
import { getModelCache } from '../../utils/model-cache.js';

private modelCache = getModelCache(this.config.modelsCacheScope || 'global');

async listModels(options?: ListModelsOptions): Promise<ListModelsResult> {
  // Check cache first
  const cached = await this.modelCache.get('models');
  if (cached && !options?.refresh) {
    return cached;
  }

  // Fetch from API
  const models = await this.fetchModelsFromAPI();

  // Cache result
  await this.modelCache.set('models', models, this.config.modelsCacheTTL);

  return models;
}
```

## Checklist

Before submitting the adapter, verify:

- [ ] Constructor initializes config and baseURL
- [ ] Metadata capabilities are accurate
- [ ] fromIR() handles system messages with normalizeSystemMessages()
- [ ] fromIR() maps all supported parameters
- [ ] toIR() preserves metadata and adds backend provenance
- [ ] getHeaders() implements correct authentication
- [ ] execute() handles HTTP errors properly
- [ ] executeStream() parses provider's streaming format correctly
- [ ] executeStream() supports accumulated mode configuration
- [ ] Finish reasons mapped correctly
- [ ] Role names mapped correctly
- [ ] Temperature normalized if needed
- [ ] Optional methods implemented (healthCheck, estimateCost, listModels)
- [ ] Error handling with proper error types
- [ ] Tests cover common cases and edge cases
- [ ] Exported in index.ts
- [ ] JSDoc comments complete

## Example Reference Adapters

Study these existing adapters for patterns:

- **Simple**: `src/adapters/backend/ollama.ts` - JSONL streaming, no auth
- **Moderate**: `src/adapters/backend/openai.ts` - SSE streaming, Bearer token
- **Complex**: `src/adapters/backend/anthropic.ts` - SSE with events, custom headers

## Next Steps

After creating the backend adapter:

1. **Integration tests** - Test with real API (use test keys)
2. **Frontend adapter** - Create matching frontend adapter
3. **Documentation** - Add to README supported providers table
4. **Examples** - Create usage examples
5. **Cost data** - Add pricing for estimateCost()
