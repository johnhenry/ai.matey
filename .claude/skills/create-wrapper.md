# Wrapper Creator Skill

Use this skill when the user asks to create a new wrapper for ai.matey. Wrappers provide familiar API surfaces (SDK-like, Proxy-based, Browser API) on top of backend adapters, enabling drop-in replacement or ergonomic interfaces.

## Wrapper Types

There are four main wrapper patterns:

1. **SDK Wrapper** - Mimics an official SDK (OpenAI, Anthropic)
2. **Browser API Wrapper** - Mimics a browser API (Chrome AI, window.ai)
3. **Proxy Wrapper** - Dynamic method calls via Proxy (Anymethod)
4. **Framework Wrapper** - Integration with a specific framework (Vercel AI SDK, LangChain)

## Prerequisites

Before starting, determine:
1. **Wrapper type** (SDK, Browser API, Proxy, Framework)
2. **Target API** (what API are you mimicking?)
3. **API documentation** (official SDK or API docs)
4. **State management** (stateless or conversational)
5. **Streaming support** (required or optional)

---

## Pattern 1: SDK Wrapper

Mimics an official SDK to provide drop-in replacement functionality.

### Example: OpenAI SDK Wrapper

#### Step 1: Define the SDK types

```typescript
/**
 * {SDK} Wrapper
 *
 * Drop-in replacement for the official {SDK} SDK using ai.matey backends.
 *
 * @module
 */

import type { BackendAdapter } from '../types/adapters.js';
import type {
  IRChatRequest,
  IRMessage,
} from '../types/ir.js';

// ============================================================================
// {SDK} SDK Types
// ============================================================================

/**
 * {SDK} SDK configuration.
 */
export interface {SDK}SDKConfig {
  /**
   * API key (optional if using custom backend).
   */
  apiKey?: string;

  /**
   * Base URL (optional).
   */
  baseURL?: string;

  /**
   * Default model.
   */
  defaultModel?: string;
}

/**
 * {SDK} message format.
 */
export interface {SDK}Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * {SDK} chat completion request.
 */
export interface {SDK}ChatCompletionParams {
  model: string;
  messages: {SDK}Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  // ... other SDK parameters
}

/**
 * {SDK} chat completion response (non-streaming).
 */
export interface {SDK}ChatCompletion {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {SDK}Message;
    finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls';
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * {SDK} streaming chunk.
 */
export interface {SDK}ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;
  }>;
}
```

#### Step 2: Implement the main classes

```typescript
// ============================================================================
// Chat Completions
// ============================================================================

class ChatCompletions {
  constructor(
    private backend: BackendAdapter,
    private config: {SDK}SDKConfig
  ) {}

  /**
   * Create a chat completion.
   */
  create(params: {SDK}ChatCompletionParams & { stream?: false }): Promise<{SDK}ChatCompletion>;
  create(params: {SDK}ChatCompletionParams & { stream: true }): AsyncIterable<{SDK}ChatCompletionChunk>;
  create(
    params: {SDK}ChatCompletionParams
  ): Promise<{SDK}ChatCompletion> | AsyncIterable<{SDK}ChatCompletionChunk> {
    if (params.stream) {
      return this.createStreaming(params);
    }
    return this.createNonStreaming(params);
  }

  /**
   * Non-streaming completion.
   */
  private async createNonStreaming(
    params: {SDK}ChatCompletionParams
  ): Promise<{SDK}ChatCompletion> {
    // Convert to IR
    const request: IRChatRequest = {
      messages: params.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      parameters: {
        model: params.model || this.config.defaultModel,
        temperature: params.temperature,
        maxTokens: params.max_tokens,
      },
      stream: false,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        provenance: {
          frontend: '{sdk-lowercase}-wrapper',
        },
      },
    };

    // Execute via backend
    const response = await this.backend.execute(request);

    // Convert to SDK format
    const completion: {SDK}ChatCompletion = {
      id: response.metadata.providerResponseId || response.metadata.requestId,
      object: 'chat.completion',
      created: Math.floor(response.metadata.timestamp / 1000),
      model: params.model || 'unknown',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: this.extractText(response.message.content),
          },
          finish_reason: this.mapFinishReason(response.finishReason),
        },
      ],
      usage: response.usage ? {
        prompt_tokens: response.usage.promptTokens,
        completion_tokens: response.usage.completionTokens,
        total_tokens: response.usage.totalTokens,
      } : undefined,
    };

    return completion;
  }

  /**
   * Streaming completion.
   */
  private async *createStreaming(
    params: {SDK}ChatCompletionParams
  ): AsyncIterable<{SDK}ChatCompletionChunk> {
    // Convert to IR
    const request: IRChatRequest = {
      messages: params.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      parameters: {
        model: params.model || this.config.defaultModel,
        temperature: params.temperature,
        maxTokens: params.max_tokens,
      },
      stream: true,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        provenance: {
          frontend: '{sdk-lowercase}-wrapper',
        },
      },
    };

    // Execute streaming
    const stream = this.backend.executeStream(request);

    const id = request.metadata.requestId;
    const created = Math.floor(request.metadata.timestamp / 1000);

    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        yield {
          id,
          object: 'chat.completion.chunk',
          created,
          model: params.model || 'unknown',
          choices: [
            {
              index: 0,
              delta: {
                content: chunk.delta,
              },
              finish_reason: null,
            },
          ],
        };
      } else if (chunk.type === 'done') {
        yield {
          id,
          object: 'chat.completion.chunk',
          created,
          model: params.model || 'unknown',
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: this.mapFinishReason(chunk.finishReason),
            },
          ],
        };
      }
    }
  }

  /**
   * Extract text content from IR message.
   */
  private extractText(content: string | IRContentBlock[]): string {
    if (typeof content === 'string') {
      return content;
    }
    return content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');
  }

  /**
   * Map IR finish reason to SDK format.
   */
  private mapFinishReason(reason: FinishReason): 'stop' | 'length' | 'content_filter' | 'tool_calls' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      case 'tool_calls':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }
}

// ============================================================================
// Main SDK Client
// ============================================================================

/**
 * {SDK} SDK-compatible client.
 */
export class {SDK} {
  readonly chat: {
    completions: ChatCompletions;
  };

  constructor(
    backend: BackendAdapter,
    config: {SDK}SDKConfig = {}
  ) {
    const completions = new ChatCompletions(backend, config);

    this.chat = {
      completions,
    };
  }
}

// Convenience export
export const {SDK}Client = {SDK};
```

#### Step 3: Export and document

Add to `src/wrappers/index.ts`:

```typescript
// {SDK} wrapper
export {
  {SDK},
  {SDK}Client,
  type {SDK}SDKConfig,
  type {SDK}Message,
  type {SDK}ChatCompletionParams,
  type {SDK}ChatCompletion,
  type {SDK}ChatCompletionChunk,
  ChatCompletions as {SDK}ChatCompletions,
} from './{sdk-lowercase}.js';
```

---

## Pattern 2: Browser API Wrapper

Mimics a browser API (like Chrome AI) for compatibility.

### Example: Chrome AI Style Wrapper

```typescript
/**
 * {Browser API} Wrapper
 *
 * Mimics the {Browser API} interface using ai.matey backends.
 *
 * @module
 */

import type { BackendAdapter } from '../types/adapters.js';
import type { IRChatRequest, IRMessage } from '../types/ir.js';
import { trimHistory } from '../utils/conversation-history.js';

// ============================================================================
// {Browser API} Types
// ============================================================================

export interface {API}CreateOptions {
  /**
   * Initial prompts (system messages).
   */
  initialPrompts?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;

  /**
   * Temperature (0-1).
   */
  temperature?: number;

  /**
   * Top-K sampling.
   */
  topK?: number;

  /**
   * Maximum tokens to generate.
   */
  maxTokens?: number;

  /**
   * Model to use.
   */
  model?: string;

  /**
   * Maximum conversation history size.
   * - 0: No history (stateless)
   * - -1: Unlimited history
   * - N > 0: Keep last N pairs
   * @default 0
   */
  maxHistorySize?: number;
}

export interface {API}Session {
  /**
   * Send a prompt and get a complete response.
   */
  prompt(input: string): Promise<string>;

  /**
   * Send a prompt and get a streaming response.
   */
  promptStreaming(input: string): AsyncIterable<string>;

  /**
   * Destroy the session.
   */
  destroy(): void;

  /**
   * Clone the session.
   */
  clone(): {API}Session;

  /**
   * Token tracking.
   */
  tokensSoFar?: number;
  maxTokens?: number;
  tokensLeft?: number;
}

export interface {API}LanguageModelAPI {
  /**
   * Create a new session.
   */
  create(options?: {API}CreateOptions): Promise<{API}Session>;

  /**
   * Check capabilities.
   */
  capabilities(): Promise<{
    available: 'yes' | 'no' | 'after-download';
    defaultTemperature?: number;
    defaultTopK?: number;
    maxTopK?: number;
  }>;
}

// ============================================================================
// Session Implementation
// ============================================================================

class SessionImpl implements {API}Session {
  private conversationHistory: IRMessage[];
  private destroyed = false;
  private _tokensSoFar = 0;

  constructor(
    private backend: BackendAdapter,
    private options: {API}CreateOptions
  ) {
    this.conversationHistory = options.initialPrompts?.map((p) => ({
      role: p.role,
      content: p.content,
    })) || [];
  }

  get tokensSoFar(): number {
    return this._tokensSoFar;
  }

  get maxTokens(): number {
    return this.options.maxTokens || 1024;
  }

  get tokensLeft(): number {
    return Math.max(0, this.maxTokens - this._tokensSoFar);
  }

  async prompt(input: string): Promise<string> {
    if (this.destroyed) {
      throw new Error('Session has been destroyed');
    }

    // Add user message
    this.conversationHistory.push({ role: 'user', content: input });

    // Build request
    const request: IRChatRequest = {
      messages: [...this.conversationHistory],
      parameters: {
        model: this.options.model,
        temperature: this.options.temperature,
        topK: this.options.topK,
        maxTokens: this.options.maxTokens,
      },
      stream: false,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        provenance: { frontend: '{api-lowercase}-wrapper' },
      },
    };

    // Execute
    const response = await this.backend.execute(request);

    // Add response to history
    this.conversationHistory.push(response.message);

    // Trim history if configured
    if (this.options.maxHistorySize !== undefined && this.options.maxHistorySize !== -1) {
      this.conversationHistory = trimHistory(
        this.conversationHistory,
        this.options.maxHistorySize,
        'smart'
      );
    }

    // Update token count
    if (response.usage) {
      this._tokensSoFar = response.usage.totalTokens;
    }

    // Extract text
    return typeof response.message.content === 'string'
      ? response.message.content
      : response.message.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
  }

  async *promptStreaming(input: string): AsyncIterable<string> {
    if (this.destroyed) {
      throw new Error('Session has been destroyed');
    }

    this.conversationHistory.push({ role: 'user', content: input });

    const request: IRChatRequest = {
      messages: [...this.conversationHistory],
      parameters: {
        model: this.options.model,
        temperature: this.options.temperature,
        topK: this.options.topK,
        maxTokens: this.options.maxTokens,
      },
      stream: true,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        provenance: { frontend: '{api-lowercase}-wrapper' },
      },
    };

    let fullContent = '';
    const stream = this.backend.executeStream(request);

    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        fullContent += chunk.delta;
        yield chunk.delta;
      } else if (chunk.type === 'done') {
        if (chunk.message) {
          this.conversationHistory.push(chunk.message);
        }

        if (this.options.maxHistorySize !== undefined && this.options.maxHistorySize !== -1) {
          this.conversationHistory = trimHistory(
            this.conversationHistory,
            this.options.maxHistorySize,
            'smart'
          );
        }

        if (chunk.usage) {
          this._tokensSoFar = chunk.usage.totalTokens;
        }
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.conversationHistory = [];
    this._tokensSoFar = 0;
  }

  clone(): {API}Session {
    return new SessionImpl(this.backend, {
      ...this.options,
      initialPrompts: this.options.initialPrompts,
    });
  }
}

// ============================================================================
// Language Model API
// ============================================================================

export function {API}LanguageModel(
  backend: BackendAdapter
): {API}LanguageModelAPI {
  return {
    async create(options: {API}CreateOptions = {}): Promise<{API}Session> {
      return new SessionImpl(backend, options);
    },

    async capabilities(): Promise<{
      available: 'yes' | 'no' | 'after-download';
      defaultTemperature?: number;
      defaultTopK?: number;
      maxTopK?: number;
    }> {
      const isHealthy = backend.healthCheck ? await backend.healthCheck() : true;
      return {
        available: isHealthy ? 'yes' : 'no',
        defaultTemperature: 0.7,
        defaultTopK: 40,
        maxTopK: 100,
      };
    },
  };
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Create a window.ai-style object.
 */
export function create{API}(backend: BackendAdapter) {
  return {
    languageModel: {API}LanguageModel(backend),
  };
}

/**
 * Polyfill for global API.
 */
export function polyfill{API}(backend: BackendAdapter): void {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).ai = create{API}(backend);
  }
}
```

---

## Pattern 3: Proxy Wrapper

Dynamic method calls using JavaScript Proxy (like Anymethod).

See `src/wrappers/anymethod.ts` for complete reference implementation.

**Key Concepts:**
- Use `Proxy` to intercept property access
- Convert method names to natural language prompts
- Support both async (`.$`) and streaming (`.$$`) namespaces
- Manage conversation history automatically
- Optional JSON parsing

---

## Pattern 4: Framework Wrapper

Integration with specific frameworks (Vercel AI SDK, LangChain, etc.).

### Example: Vercel AI SDK Provider

```typescript
/**
 * Vercel AI SDK Provider Wrapper
 *
 * Integrates ai.matey with Vercel AI SDK.
 *
 * @module
 */

import type { BackendAdapter } from '../types/adapters.js';
import type { LanguageModelV1 } from '@ai-sdk/provider';

export function createAIMateyProvider(backend: BackendAdapter): LanguageModelV1 {
  return {
    specificationVersion: 'v1',
    provider: 'ai-matey',
    modelId: backend.metadata.name,

    async doGenerate(options) {
      const response = await backend.execute({
        messages: options.prompt.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        parameters: {
          temperature: options.temperature,
          maxTokens: options.maxTokens,
        },
        stream: false,
        metadata: {
          requestId: crypto.randomUUID(),
          timestamp: Date.now(),
          provenance: { frontend: 'vercel-ai-sdk' },
        },
      });

      return {
        text: typeof response.message.content === 'string'
          ? response.message.content
          : '',
        finishReason: response.finishReason,
        usage: {
          promptTokens: response.usage?.promptTokens || 0,
          completionTokens: response.usage?.completionTokens || 0,
        },
      };
    },

    async doStream(options) {
      // Similar streaming implementation
    },
  };
}
```

---

## Common Patterns & Best Practices

### 1. Conversation History Management

Always use the shared `trimHistory` utility:

```typescript
import { trimHistory } from '../utils/conversation-history.js';

if (maxHistorySize !== -1) {
  this.conversationHistory = trimHistory(
    this.conversationHistory,
    maxHistorySize,
    'smart'  // Preserves system messages
  );
}
```

### 2. Token Estimation

Provide rough token tracking:

```typescript
if (response.usage) {
  this._tokensSoFar = response.usage.totalTokens;
} else {
  // Rough estimate: 4 chars ≈ 1 token
  this._tokensSoFar += Math.ceil(input.length / 4);
  this._tokensSoFar += Math.ceil(output.length / 4);
}
```

### 3. Streaming State Management

Track full content during streaming:

```typescript
let fullContent = '';

for await (const chunk of stream) {
  if (chunk.type === 'content') {
    fullContent += chunk.delta;
    yield chunk.delta;
  } else if (chunk.type === 'done') {
    // Save fullContent to history
    this.conversationHistory.push({
      role: 'assistant',
      content: fullContent
    });
  }
}
```

### 4. Consistent Error Handling

Wrap backend errors appropriately:

```typescript
try {
  return await this.backend.execute(request);
} catch (error) {
  throw new Error(
    `{Wrapper} execution failed: ${error.message}`
  );
}
```

## Checklist

Before submitting the wrapper, verify:

- [ ] Types match target API accurately
- [ ] Request conversion to IR is correct
- [ ] Response conversion from IR is correct
- [ ] Streaming is implemented if required
- [ ] Conversation history managed correctly
- [ ] Token tracking implemented if applicable
- [ ] Error handling with clear messages
- [ ] Tests cover main use cases
- [ ] Exported in index.ts
- [ ] JSDoc comments complete
- [ ] Usage examples in documentation

## Example Reference Wrappers

Study these existing wrappers:

- **SDK**: `src/wrappers/openai-sdk.ts` - Full SDK replacement
- **Browser API**: `src/wrappers/chrome-ai-legacy.ts` - Browser API compat
- **Proxy**: `src/wrappers/anymethod.ts` - Dynamic method calls

## Next Steps

After creating the wrapper:

1. **Integration tests** - Test with multiple backends
2. **Documentation** - Add usage examples
3. **Comparison guide** - Document differences from original API
4. **Migration guide** - Help users switch to your wrapper
