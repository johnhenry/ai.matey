# Research: Intermediate Representation (IR) for Universal AI Chat APIs

**Feature**: Universal AI Adapter System
**Created**: 2025-10-13
**Status**: Research Complete

## Executive Summary

This document provides comprehensive research on designing an Intermediate Representation (IR) for normalizing AI chat APIs across OpenAI, Anthropic, Gemini, Ollama, Mistral, and Chrome AI. The IR serves as a "compiler intermediate language" for AI interactions, enabling bidirectional translation between any frontend and backend provider.

**Key Findings**:
- A core IR schema can represent ~90% of common chat interactions
- System message placement is the primary normalization challenge
- Streaming requires protocol-specific adapters with unified AsyncGenerator interface
- Semantic drift (temperature ranges, token limits) requires metadata and validation
- TypeScript 5.0+ discriminated unions provide type-safe IR implementation

---

## 1. IR Schema Design

### 1.1 Core Principles

The IR must balance three competing concerns:

1. **Completeness**: Represent all common features across providers
2. **Simplicity**: Avoid complexity explosion from edge cases
3. **Extensibility**: Allow provider-specific extensions without breaking core schema

### 1.2 Field Analysis Across Providers

#### Request Field Mapping

| Semantic Concept | OpenAI | Anthropic | Gemini | Ollama | Mistral | Chrome AI |
|-----------------|---------|-----------|---------|---------|---------|-----------|
| Model ID | `model` | `model` | `model` | `model` | `model` | N/A (implicit) |
| Messages | `messages[]` | `messages[]` | `contents[]` | `prompt` (string) | `messages[]` | `prompt` + history |
| System Message | In messages array | `system` param | `systemInstruction` | First message | In messages | `initialPrompts[]` |
| Max Tokens | `max_tokens` | `max_tokens` | `maxOutputTokens` | `num_predict` | `max_tokens` | N/A |
| Temperature | `temperature` (0-2) | `temperature` (0-1) | `temperature` (0-1) | `temperature` (0-∞) | `temperature` (0-1) | N/A |
| Stop Sequences | `stop` (string[]) | `stop_sequences` | `stopSequences` | `stop` | `stop` | N/A |
| Streaming | `stream` | `stream` | `stream` | `stream` | `stream` | Always streams |
| Top P | `top_p` | `top_p` | `topP` | `top_p` | `top_p` | N/A |
| Tools/Functions | `tools[]` | `tools[]` | `tools[]` | N/A | `tools[]` | N/A |

#### Response Field Mapping

| Semantic Concept | OpenAI | Anthropic | Gemini | Ollama | Mistral | Chrome AI |
|-----------------|---------|-----------|---------|---------|---------|-----------|
| Response ID | `id` | `id` | `name` | N/A | `id` | N/A |
| Model Used | `model` | `model` | `model` | `model` | `model` | N/A |
| Content | `choices[0].message.content` | `content[0].text` | `candidates[0].content.parts[0].text` | `response` | `choices[0].message.content` | iterator values |
| Role | `choices[0].message.role` | `role` | `candidates[0].content.role` | N/A | `choices[0].message.role` | N/A |
| Finish Reason | `choices[0].finish_reason` | `stop_reason` | `finishReason` | `done_reason` | `choices[0].finish_reason` | N/A |
| Token Usage | `usage{}` | `usage{}` | `usageMetadata{}` | `eval_count`, `prompt_eval_count` | `usage{}` | N/A |

### 1.3 Recommended Universal IR Schema

```typescript
/**
 * Universal Intermediate Representation for AI Chat Interactions
 * Version: 1.0.0
 *
 * This IR captures the common denominator of all supported providers
 * while allowing provider-specific extensions via metadata.
 */

// ============================================================================
// Core Message Types
// ============================================================================

/**
 * Message role using discriminated union for type safety
 */
type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Content can be simple text or multi-part (text + images)
 */
type MessageContent =
  | string
  | MessagePart[];

/**
 * Multi-part message content (for multimodal inputs)
 */
type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'image'; source: ImageSource }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string };

type ImageSource =
  | { type: 'url'; url: string }
  | { type: 'base64'; media_type: string; data: string };

/**
 * Universal message format
 */
interface UniversalMessage {
  role: MessageRole;
  content: MessageContent;

  /**
   * Optional message name/identifier (for tool calls, etc.)
   */
  name?: string;

  /**
   * Provider-specific metadata that doesn't fit core schema
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Request Schema
// ============================================================================

/**
 * Universal chat completion request
 */
interface UniversalChatRequest {
  /**
   * Model identifier (provider-specific, passed through)
   * Examples: "gpt-4", "claude-3-opus-20240229", "gemini-pro"
   */
  model: string;

  /**
   * Conversation messages
   * System messages should be included here with role='system'
   * Adapters handle provider-specific system message placement
   */
  messages: UniversalMessage[];

  /**
   * Temperature controls randomness
   * Normalized range: 0.0 to 1.0
   *
   * Note: OpenAI supports 0-2, adapters must scale appropriately
   * and emit semantic drift warnings
   */
  temperature?: number;

  /**
   * Maximum tokens to generate
   * Note: Some providers count this differently (completion-only vs total)
   */
  maxTokens?: number;

  /**
   * Top-p sampling (nucleus sampling)
   * Range: 0.0 to 1.0
   */
  topP?: number;

  /**
   * Sequences where generation should stop
   */
  stopSequences?: string[];

  /**
   * Enable streaming responses
   */
  stream?: boolean;

  /**
   * Tool/function definitions for tool-calling models
   */
  tools?: UniversalTool[];

  /**
   * Force specific tool usage
   */
  toolChoice?: 'auto' | 'none' | { type: 'tool'; name: string };

  /**
   * Metadata about this request
   */
  metadata?: {
    /**
     * Unique request ID for tracing
     */
    requestId?: string;

    /**
     * Which adapter created this IR
     */
    frontendAdapter?: string;

    /**
     * Original frontend format version
     */
    frontendVersion?: string;

    /**
     * Semantic version of this IR schema
     */
    irVersion?: string;

    /**
     * User-defined metadata
     */
    custom?: Record<string, unknown>;
  };

  /**
   * Provider-specific parameters that don't map to universal schema
   * Backend adapters may use these for passthrough
   */
  providerHints?: {
    openai?: Record<string, unknown>;
    anthropic?: Record<string, unknown>;
    gemini?: Record<string, unknown>;
    ollama?: Record<string, unknown>;
    mistral?: Record<string, unknown>;
    chromeai?: Record<string, unknown>;
  };
}

/**
 * Tool definition (simplified from OpenAI/Anthropic schemas)
 */
interface UniversalTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

// ============================================================================
// Response Schema
// ============================================================================

/**
 * Reason why generation stopped
 */
type FinishReason =
  | 'stop'           // Natural completion
  | 'length'         // Max tokens reached
  | 'tool_calls'     // Model wants to call tools
  | 'content_filter' // Content policy violation
  | 'error';         // Generation error

/**
 * Universal chat completion response
 */
interface UniversalChatResponse {
  /**
   * Unique response ID (if provided by backend)
   */
  id?: string;

  /**
   * Model that generated the response
   */
  model: string;

  /**
   * Generated message
   */
  message: UniversalMessage;

  /**
   * Why generation stopped
   */
  finishReason?: FinishReason;

  /**
   * Token usage statistics
   */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };

  /**
   * Response timestamp
   */
  created?: number;

  /**
   * Metadata about transformations applied
   */
  metadata?: {
    /**
     * Request ID this responds to
     */
    requestId?: string;

    /**
     * Backend adapter that generated this response
     */
    backendAdapter?: string;

    /**
     * Backend API version
     */
    backendVersion?: string;

    /**
     * Warnings about semantic drift or lossy conversions
     */
    warnings?: SemanticWarning[];

    /**
     * Latency metrics
     */
    latency?: {
      adapterMs?: number;
      backendMs?: number;
      totalMs?: number;
    };
  };

  /**
   * Raw backend response for debugging
   */
  raw?: unknown;
}

/**
 * Warning about semantic differences in translation
 */
interface SemanticWarning {
  type: 'parameter_scaling' | 'unsupported_feature' | 'message_merge' | 'token_limit';
  field: string;
  message: string;
  originalValue?: unknown;
  transformedValue?: unknown;
}

// ============================================================================
// Streaming Schema
// ============================================================================

/**
 * Chunk type for streaming responses
 */
type ChunkType =
  | 'content_delta'      // Incremental content
  | 'tool_call_delta'    // Incremental tool call
  | 'message_start'      // Stream beginning
  | 'message_end'        // Stream completion
  | 'error';             // Error occurred

/**
 * Universal streaming chunk
 */
interface UniversalStreamChunk {
  /**
   * Chunk type
   */
  type: ChunkType;

  /**
   * Sequence number for ordering
   */
  sequence: number;

  /**
   * Delta content (for content_delta type)
   */
  delta?: {
    role?: MessageRole;
    content?: string;
  };

  /**
   * Tool call delta (for tool_call_delta type)
   */
  toolCallDelta?: {
    id?: string;
    name?: string;
    arguments?: string; // Partial JSON string
  };

  /**
   * Finish reason (for message_end type)
   */
  finishReason?: FinishReason;

  /**
   * Usage stats (for message_end type)
   */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };

  /**
   * Error information (for error type)
   */
  error?: {
    message: string;
    code?: string;
    type?: string;
  };

  /**
   * Raw chunk from backend for debugging
   */
  raw?: unknown;
}

// ============================================================================
// Error Schema
// ============================================================================

/**
 * Universal error categories
 */
type ErrorCategory =
  | 'authentication'     // Invalid API key
  | 'authorization'      // Insufficient permissions
  | 'rate_limit'         // Rate limit exceeded
  | 'invalid_request'    // Malformed request
  | 'model_error'        // Model unavailable or error
  | 'network'            // Network/timeout error
  | 'server_error'       // Provider server error
  | 'unknown';           // Uncategorized error

/**
 * Universal error representation
 */
interface UniversalError extends Error {
  category: ErrorCategory;

  /**
   * HTTP status code if applicable
   */
  statusCode?: number;

  /**
   * Provider-specific error code
   */
  providerCode?: string;

  /**
   * Provider-specific error type
   */
  providerType?: string;

  /**
   * Which adapter threw this error
   */
  adapter?: string;

  /**
   * IR state when error occurred
   */
  irState?: Partial<UniversalChatRequest>;

  /**
   * Original error from provider
   */
  originalError?: unknown;

  /**
   * Suggested retry behavior
   */
  retryable?: boolean;

  /**
   * Retry after delay (seconds)
   */
  retryAfter?: number;
}
```

### 1.4 Design Rationale

**Why This Structure**:

1. **Messages Array is Primary**: All messages (including system) go in the `messages` array in IR. Adapters handle provider-specific placement (Anthropic's `system` param, Gemini's `systemInstruction`, etc.)

2. **Normalized Temperature (0-1)**: We standardize on 0-1 range since most providers use this. OpenAI backend adapter scales to 0-2 and emits a `SemanticWarning`.

3. **Metadata for Provenance**: Every request/response tracks which adapters transformed it and what warnings occurred. This enables debugging and trust.

4. **Provider Hints for Escape Hatch**: The `providerHints` field allows passing provider-specific parameters through when needed, without polluting the core schema.

5. **Discriminated Unions for Type Safety**: Using literal types (`type: 'text'`, etc.) enables TypeScript to narrow types properly.

---

## 2. Message Normalization

### 2.1 System Message Challenge

System messages are the most significant normalization challenge:

| Provider | System Message Handling |
|----------|------------------------|
| **OpenAI** | System messages can appear anywhere in `messages[]` array, typically first |
| **Anthropic** | Separate `system` parameter (string), only one allowed, not in messages array |
| **Gemini** | Separate `systemInstruction` field with structured content |
| **Chrome AI** | `initialPrompts` array with system messages separate from conversation |
| **Ollama** | System message typically first in prompt, or via `system` parameter |
| **Mistral** | System messages in `messages[]` array like OpenAI |

### 2.2 Normalization Strategy

**IR Representation**: All system messages go in `messages[]` array with `role: 'system'`

**Frontend Adapter Responsibilities**:

```typescript
// Example: Anthropic Frontend Adapter
class AnthropicFrontendAdapter {
  toUniversal(anthropicRequest: AnthropicRequest): UniversalChatRequest {
    const messages: UniversalMessage[] = [];

    // If Anthropic has system parameter, convert to message
    if (anthropicRequest.system) {
      messages.push({
        role: 'system',
        content: anthropicRequest.system
      });
    }

    // Add conversation messages
    messages.push(...anthropicRequest.messages.map(m => ({
      role: m.role as MessageRole,
      content: m.content
    })));

    return {
      model: anthropicRequest.model,
      messages,
      temperature: anthropicRequest.temperature,
      maxTokens: anthropicRequest.max_tokens,
      // ... other fields
    };
  }
}
```

**Backend Adapter Responsibilities**:

```typescript
// Example: Anthropic Backend Adapter
class AnthropicBackendAdapter {
  toProvider(ir: UniversalChatRequest): AnthropicRequest {
    // Extract system messages
    const systemMessages = ir.messages.filter(m => m.role === 'system');
    const conversationMessages = ir.messages.filter(m => m.role !== 'system');

    // Handle multiple system messages
    let systemParam: string | undefined;
    if (systemMessages.length > 0) {
      if (systemMessages.length > 1) {
        // Merge multiple system messages with warning
        systemParam = systemMessages
          .map(m => typeof m.content === 'string' ? m.content : '')
          .join('\n\n');

        this.emitWarning({
          type: 'message_merge',
          field: 'system',
          message: `Merged ${systemMessages.length} system messages into one (Anthropic limitation)`,
          originalValue: systemMessages,
          transformedValue: systemParam
        });
      } else {
        systemParam = typeof systemMessages[0].content === 'string'
          ? systemMessages[0].content
          : undefined;
      }
    }

    return {
      model: ir.model,
      system: systemParam,
      messages: conversationMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : this.contentToString(m.content)
      })),
      temperature: ir.temperature,
      max_tokens: ir.maxTokens,
      // ... other fields
    };
  }
}
```

### 2.3 Edge Cases and Solutions

**Case 1: Multiple System Messages**

- **OpenAI/Mistral**: Pass through as-is (supported)
- **Anthropic**: Merge with newlines, emit `SemanticWarning`
- **Gemini**: Concatenate into single `systemInstruction`, emit warning
- **Chrome AI**: Use first message, warn about dropped messages
- **Ollama**: Concatenate or use first, warn

**Case 2: System Message Not First**

- **IR**: Allow anywhere in messages array
- **Backend Adapters**: Most providers expect system messages first, so adapters should reorder and emit warning if user explicitly ordered differently

**Case 3: No System Message**

- All providers handle this gracefully, no normalization needed

**Case 4: Interleaved System Messages**

- **IR**: Preserve order
- **Anthropic Backend**: Extract all system messages, merge them, warn about lost interleaving
- **OpenAI Backend**: Warn that interleaved system messages may not behave as expected

### 2.4 Implementation Example

```typescript
/**
 * Utility for handling system message normalization
 */
class SystemMessageNormalizer {
  /**
   * Extract and merge system messages for providers that only support one
   */
  static extractAndMerge(
    messages: UniversalMessage[],
    options: { separator?: string; position?: 'first' | 'all' } = {}
  ): { system?: string; remaining: UniversalMessage[]; warnings: SemanticWarning[] } {
    const { separator = '\n\n', position = 'all' } = options;
    const warnings: SemanticWarning[] = [];

    const systemMessages = messages.filter(m => m.role === 'system');
    const remaining = messages.filter(m => m.role !== 'system');

    if (systemMessages.length === 0) {
      return { remaining, warnings };
    }

    if (systemMessages.length > 1) {
      warnings.push({
        type: 'message_merge',
        field: 'system',
        message: `Merged ${systemMessages.length} system messages (provider limitation)`,
        originalValue: systemMessages.length,
        transformedValue: 1
      });
    }

    // Check if system messages were interleaved
    const firstNonSystemIndex = messages.findIndex(m => m.role !== 'system');
    const lastSystemIndex = messages.map((m, i) => m.role === 'system' ? i : -1)
      .filter(i => i !== -1)
      .pop() ?? -1;

    if (firstNonSystemIndex !== -1 && lastSystemIndex > firstNonSystemIndex) {
      warnings.push({
        type: 'message_merge',
        field: 'system',
        message: 'System messages were interleaved with conversation messages; merged into single system prompt',
        originalValue: 'interleaved',
        transformedValue: 'merged'
      });
    }

    const system = systemMessages
      .map(m => typeof m.content === 'string' ? m.content : this.contentToString(m.content))
      .join(separator);

    return { system, remaining, warnings };
  }

  /**
   * Convert MessageContent to string for providers that don't support multi-part
   */
  private static contentToString(content: MessageContent): string {
    if (typeof content === 'string') return content;
    return content
      .filter(part => part.type === 'text')
      .map(part => (part as { text: string }).text)
      .join('\n');
  }
}
```

---

## 3. Streaming Representation

### 3.1 Streaming Protocol Analysis

Different providers use fundamentally different streaming mechanisms:

| Provider | Protocol | Chunk Format | Completion Signal |
|----------|----------|--------------|-------------------|
| **OpenAI** | SSE (Server-Sent Events) | `data: {delta: {...}}` chunks | `data: [DONE]` |
| **Anthropic** | SSE with typed events | Event types: `message_start`, `content_block_delta`, `message_delta`, `message_stop` | `message_stop` event |
| **Gemini** | SSE or gRPC streaming | JSON chunks with `candidates[0].content` | `finishReason` present |
| **Ollama** | JSONL (newline-delimited JSON) | One JSON object per line with `response` field | `done: true` in final chunk |
| **Mistral** | SSE like OpenAI | Similar to OpenAI format | `data: [DONE]` |
| **Chrome AI** | AsyncIterator | JavaScript async generator yielding strings | Generator completion |

### 3.2 Unified Streaming Interface

**Core Decision**: Use `AsyncGenerator<UniversalStreamChunk>` as the universal streaming interface.

```typescript
/**
 * Streaming response type
 *
 * Backend adapters return AsyncGenerators that yield UniversalStreamChunk
 * Frontend adapters can transform these into provider-specific formats
 */
type UniversalStreamResponse = AsyncGenerator<UniversalStreamChunk, void, unknown>;

/**
 * Streaming chat method signature
 */
interface BackendAdapter {
  chatStream(request: UniversalChatRequest): UniversalStreamResponse;
}
```

### 3.3 Chunk Assembly Patterns

**Problem**: Providers stream at different granularities:
- OpenAI: Word/token fragments
- Anthropic: Token-level with explicit event types
- Ollama: Can be word or sentence level
- Gemini: Variable chunk size

**Solution**: Backend adapters normalize to consistent chunk structure

```typescript
/**
 * Example: OpenAI Backend Streaming Adapter
 */
class OpenAIBackendAdapter {
  async *chatStream(ir: UniversalChatRequest): UniversalStreamResponse {
    const response = await this.makeStreamingRequest(ir);
    let sequence = 0;

    // First chunk: message_start
    yield {
      type: 'message_start',
      sequence: sequence++,
      delta: { role: 'assistant' }
    };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue;
          if (line === 'data: [DONE]') continue;

          const data = this.parseSSE(line);
          if (!data) continue;

          const delta = data.choices?.[0]?.delta;
          if (delta?.content) {
            yield {
              type: 'content_delta',
              sequence: sequence++,
              delta: {
                content: delta.content
              }
            };
          }

          if (delta?.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              yield {
                type: 'tool_call_delta',
                sequence: sequence++,
                toolCallDelta: {
                  id: toolCall.id,
                  name: toolCall.function?.name,
                  arguments: toolCall.function?.arguments
                }
              };
            }
          }

          const finishReason = data.choices?.[0]?.finish_reason;
          if (finishReason) {
            yield {
              type: 'message_end',
              sequence: sequence++,
              finishReason: this.normalizeFinishReason(finishReason),
              usage: data.usage
            };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private parseSSE(line: string): any {
    const match = line.match(/^data: (.+)$/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
}
```

```typescript
/**
 * Example: Anthropic Backend Streaming Adapter
 */
class AnthropicBackendAdapter {
  async *chatStream(ir: UniversalChatRequest): UniversalStreamResponse {
    const response = await this.makeStreamingRequest(ir);
    let sequence = 0;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;

          const event = this.parseAnthropicEvent(line);
          if (!event) continue;

          switch (event.type) {
            case 'message_start':
              yield {
                type: 'message_start',
                sequence: sequence++,
                delta: { role: 'assistant' }
              };
              break;

            case 'content_block_delta':
              if (event.delta?.type === 'text_delta') {
                yield {
                  type: 'content_delta',
                  sequence: sequence++,
                  delta: { content: event.delta.text }
                };
              }
              break;

            case 'message_delta':
              if (event.delta?.stop_reason) {
                yield {
                  type: 'message_end',
                  sequence: sequence++,
                  finishReason: this.normalizeStopReason(event.delta.stop_reason),
                  usage: event.usage
                };
              }
              break;

            case 'message_stop':
              // Final event, already sent message_end if needed
              break;

            case 'error':
              yield {
                type: 'error',
                sequence: sequence++,
                error: {
                  message: event.error?.message ?? 'Unknown error',
                  code: event.error?.code,
                  type: event.error?.type
                }
              };
              break;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
```

```typescript
/**
 * Example: Chrome AI Backend Streaming Adapter
 */
class ChromeAIBackendAdapter {
  async *chatStream(ir: UniversalChatRequest): UniversalStreamResponse {
    let sequence = 0;

    yield {
      type: 'message_start',
      sequence: sequence++,
      delta: { role: 'assistant' }
    };

    try {
      // Chrome AI provides an async iterator directly
      const session = await this.createSession(ir);
      const stream = session.promptStreaming(this.formatPrompt(ir));

      for await (const chunk of stream) {
        yield {
          type: 'content_delta',
          sequence: sequence++,
          delta: { content: chunk }
        };
      }

      yield {
        type: 'message_end',
        sequence: sequence++,
        finishReason: 'stop'
      };
    } catch (error) {
      yield {
        type: 'error',
        sequence: sequence++,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}
```

### 3.4 Stream Cancellation

**Requirement**: Support `AbortController` for cancelling streams across all providers

```typescript
/**
 * Streaming with cancellation support
 */
interface BackendAdapter {
  chatStream(
    request: UniversalChatRequest,
    options?: { signal?: AbortSignal }
  ): UniversalStreamResponse;
}

/**
 * Example implementation
 */
class OpenAIBackendAdapter {
  async *chatStream(
    ir: UniversalChatRequest,
    options?: { signal?: AbortSignal }
  ): UniversalStreamResponse {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(this.toOpenAI(ir)),
      signal: options?.signal // Pass through abort signal
    });

    // ... streaming logic
  }
}
```

**Usage**:

```typescript
const controller = new AbortController();
const stream = backend.chatStream(request, { signal: controller.signal });

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  for await (const chunk of stream) {
    console.log(chunk);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Stream cancelled');
  }
}
```

### 3.5 Streaming Backpressure Handling

**Problem**: Consumer may process chunks slower than provider sends them

**Solution**: AsyncGenerator naturally handles backpressure - iteration pauses until consumer calls `next()`

```typescript
/**
 * Consumer controls pace of stream
 */
async function processStreamSlowly(stream: UniversalStreamResponse) {
  for await (const chunk of stream) {
    // This delay naturally applies backpressure
    await processChunk(chunk);
    await sleep(100);
  }
}
```

---

## 4. Parameter Normalization

### 4.1 Semantic Differences

Many parameters have the same name but different meanings across providers:

#### Temperature Scaling

| Provider | Range | Interpretation |
|----------|-------|----------------|
| OpenAI | 0-2 | Higher = more random, >1 is unusual |
| Anthropic | 0-1 | Standard probability scaling |
| Gemini | 0-1 | Standard probability scaling |
| Ollama | 0-∞ | Higher = more random, typically 0-2 |
| Mistral | 0-1 | Standard probability scaling |

**Normalization Strategy**:

```typescript
/**
 * Temperature normalization utilities
 */
class ParameterNormalizer {
  /**
   * Normalize temperature to 0-1 range for IR
   */
  static normalizeTemperature(
    value: number,
    sourceProvider: string
  ): { normalized: number; warning?: SemanticWarning } {
    if (sourceProvider === 'openai' && value > 1) {
      return {
        normalized: value / 2, // Scale 0-2 to 0-1
        warning: {
          type: 'parameter_scaling',
          field: 'temperature',
          message: 'Temperature scaled from OpenAI range (0-2) to universal range (0-1)',
          originalValue: value,
          transformedValue: value / 2
        }
      };
    }

    return { normalized: value };
  }

  /**
   * Denormalize temperature from IR to provider-specific range
   */
  static denormalizeTemperature(
    normalized: number,
    targetProvider: string
  ): { value: number; warning?: SemanticWarning } {
    if (targetProvider === 'openai') {
      return {
        value: normalized * 2, // Scale 0-1 to 0-2
        warning: {
          type: 'parameter_scaling',
          field: 'temperature',
          message: 'Temperature scaled from universal range (0-1) to OpenAI range (0-2)',
          originalValue: normalized,
          transformedValue: normalized * 2
        }
      };
    }

    return { value: normalized };
  }
}
```

#### Token Limits

| Provider | Field Name | Meaning |
|----------|-----------|----------|
| OpenAI | `max_tokens` | Max completion tokens (not including prompt) |
| Anthropic | `max_tokens` | Max completion tokens |
| Gemini | `maxOutputTokens` | Max output tokens |
| Ollama | `num_predict` | Number of tokens to predict |
| Mistral | `max_tokens` | Max completion tokens |

**All providers agree on this semantic** (completion tokens only), but field names differ.

**Normalization**: Use `maxTokens` in IR, map to provider-specific names

#### Context Window Limits

**Problem**: Providers have different max context windows:
- GPT-4: 128k tokens
- Claude 3: 200k tokens
- Gemini 1.5 Pro: 2M tokens
- Ollama (Llama 2): 4k-32k depending on model

**Solution**: Backend adapters should check token count and emit warnings

```typescript
class BackendAdapter {
  protected checkContextWindow(ir: UniversalChatRequest): SemanticWarning[] {
    const warnings: SemanticWarning[] = [];
    const estimatedTokens = this.estimateTokenCount(ir.messages);
    const contextLimit = this.getContextLimit(ir.model);

    if (estimatedTokens > contextLimit) {
      warnings.push({
        type: 'token_limit',
        field: 'messages',
        message: `Estimated ${estimatedTokens} tokens exceeds model limit of ${contextLimit}`,
        originalValue: estimatedTokens,
        transformedValue: contextLimit
      });
    }

    return warnings;
  }
}
```

#### Stop Sequences

| Provider | Support Level |
|----------|--------------|
| OpenAI | Fully supported, array of strings |
| Anthropic | Supported as `stop_sequences`, max 4 |
| Gemini | Supported as `stopSequences` |
| Ollama | Supported as `stop`, array or string |
| Mistral | Supported |
| Chrome AI | Not supported |

**Normalization**:

```typescript
/**
 * Stop sequences handling
 */
class StopSequenceNormalizer {
  static toProvider(
    stopSequences: string[] | undefined,
    provider: string
  ): { value: any; warnings: SemanticWarning[] } {
    const warnings: SemanticWarning[] = [];

    if (!stopSequences || stopSequences.length === 0) {
      return { value: undefined, warnings };
    }

    switch (provider) {
      case 'anthropic':
        if (stopSequences.length > 4) {
          warnings.push({
            type: 'unsupported_feature',
            field: 'stopSequences',
            message: 'Anthropic supports max 4 stop sequences, truncating',
            originalValue: stopSequences.length,
            transformedValue: 4
          });
          return { value: stopSequences.slice(0, 4), warnings };
        }
        return { value: stopSequences, warnings };

      case 'chromeai':
        warnings.push({
          type: 'unsupported_feature',
          field: 'stopSequences',
          message: 'Chrome AI does not support stop sequences, ignoring',
          originalValue: stopSequences,
          transformedValue: undefined
        });
        return { value: undefined, warnings };

      default:
        return { value: stopSequences, warnings };
    }
  }
}
```

### 4.2 Unsupported Parameters

When a provider doesn't support a parameter, adapters should:

1. **Emit a warning**
2. **Gracefully degrade** (drop the parameter)
3. **Document the limitation**

```typescript
interface AdapterCapabilities {
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsMultipartContent: boolean;
  supportsStopSequences: boolean;
  maxStopSequences?: number;
  temperatureRange: { min: number; max: number };
  maxContextTokens: number;
}

class BackendAdapter {
  abstract get capabilities(): AdapterCapabilities;

  protected checkCapabilities(ir: UniversalChatRequest): SemanticWarning[] {
    const warnings: SemanticWarning[] = [];

    if (ir.tools && !this.capabilities.supportsTools) {
      warnings.push({
        type: 'unsupported_feature',
        field: 'tools',
        message: `${this.name} does not support tool calling, ignoring tools`,
        originalValue: ir.tools,
        transformedValue: undefined
      });
    }

    // ... check other capabilities

    return warnings;
  }
}
```

---

## 5. TypeScript Type Design

### 5.1 Advanced Type Patterns

#### Discriminated Unions

Use discriminated unions for type-safe message parts and chunk types:

```typescript
/**
 * Discriminated union for message parts
 * TypeScript can narrow types based on 'type' field
 */
type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'image'; source: ImageSource }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string };

function processMessagePart(part: MessagePart) {
  switch (part.type) {
    case 'text':
      // TypeScript knows part.text exists here
      console.log(part.text);
      break;
    case 'image':
      // TypeScript knows part.source exists here
      console.log(part.source);
      break;
    case 'tool_use':
      // TypeScript knows part.id, part.name, part.input exist here
      console.log(part.id, part.name);
      break;
    case 'tool_result':
      // TypeScript knows part.tool_use_id, part.content exist here
      console.log(part.tool_use_id);
      break;
  }
}
```

#### Template Literal Types

Use template literals for provider names and model identifiers:

```typescript
/**
 * Template literal types for compile-time provider validation
 */
type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'mistral' | 'chromeai';

type OpenAIModel = `gpt-${string}`;
type AnthropicModel = `claude-${string}`;
type GeminiModel = `gemini-${string}`;

type ModelIdentifier = OpenAIModel | AnthropicModel | GeminiModel | string;

/**
 * Provider-specific hints with template literal keys
 */
type ProviderHints = {
  [K in ProviderName as `${K}`]?: Record<string, unknown>;
};

/**
 * Adapter names with template literals
 */
type AdapterType = 'frontend' | 'backend';
type AdapterName<T extends AdapterType, P extends ProviderName> = `${T}-${P}`;

// Examples:
type OpenAIFrontendAdapter = AdapterName<'frontend', 'openai'>; // "frontend-openai"
type AnthropicBackendAdapter = AdapterName<'backend', 'anthropic'>; // "backend-anthropic"
```

#### Const Type Parameters

Use `as const` for literal type preservation:

```typescript
/**
 * Const type parameters preserve literal types
 */
const MESSAGE_ROLES = ['system', 'user', 'assistant', 'tool'] as const;
type MessageRole = typeof MESSAGE_ROLES[number]; // 'system' | 'user' | 'assistant' | 'tool'

const CHUNK_TYPES = [
  'content_delta',
  'tool_call_delta',
  'message_start',
  'message_end',
  'error'
] as const;
type ChunkType = typeof CHUNK_TYPES[number];

/**
 * Const assertions for configuration
 */
const ADAPTER_CONFIG = {
  openai: {
    endpoint: 'https://api.openai.com/v1',
    temperatureRange: [0, 2],
    supportsStreaming: true
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1',
    temperatureRange: [0, 1],
    supportsStreaming: true
  }
} as const;

type AdapterConfig = typeof ADAPTER_CONFIG;
type OpenAIConfig = typeof ADAPTER_CONFIG['openai'];
```

#### Advanced Generics

Use generics for type-safe adapter implementations:

```typescript
/**
 * Generic adapter interfaces with type parameters
 */
interface FrontendAdapter<TRequest = unknown, TResponse = unknown> {
  readonly name: ProviderName;
  readonly version: string;

  toUniversal(request: TRequest): UniversalChatRequest;
  fromUniversal(response: UniversalChatResponse): TResponse;
}

interface BackendAdapter<TRequest = unknown, TResponse = unknown> {
  readonly name: ProviderName;
  readonly version: string;
  readonly capabilities: AdapterCapabilities;

  toProvider(ir: UniversalChatRequest): TRequest;
  fromProvider(response: TResponse): UniversalChatResponse;

  chat(ir: UniversalChatRequest): Promise<UniversalChatResponse>;
  chatStream(ir: UniversalChatRequest, options?: { signal?: AbortSignal }): UniversalStreamResponse;
}

/**
 * Strongly-typed OpenAI adapter
 */
interface OpenAIChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface OpenAIChatResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

class OpenAIBackendAdapter implements BackendAdapter<OpenAIChatRequest, OpenAIChatResponse> {
  readonly name = 'openai' as const;
  readonly version = '1.0.0';
  readonly capabilities = {
    supportsStreaming: true,
    supportsTools: true,
    supportsMultipartContent: true,
    supportsStopSequences: true,
    temperatureRange: { min: 0, max: 2 },
    maxContextTokens: 128000
  };

  toProvider(ir: UniversalChatRequest): OpenAIChatRequest {
    // Type-safe conversion
    return {
      model: ir.model,
      messages: ir.messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : this.contentToString(m.content)
      })),
      temperature: ir.temperature ? ir.temperature * 2 : undefined, // Scale to OpenAI range
      max_tokens: ir.maxTokens,
      stream: ir.stream
    };
  }

  fromProvider(response: OpenAIChatResponse): UniversalChatResponse {
    // Type-safe conversion
    return {
      id: response.id,
      model: response.model,
      message: {
        role: 'assistant',
        content: response.choices[0].message.content
      },
      finishReason: this.normalizeFinishReason(response.choices[0].finish_reason),
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      }
    };
  }

  async chat(ir: UniversalChatRequest): Promise<UniversalChatResponse> {
    const request = this.toProvider(ir);
    const response = await this.makeRequest(request);
    return this.fromProvider(response);
  }

  async *chatStream(
    ir: UniversalChatRequest,
    options?: { signal?: AbortSignal }
  ): UniversalStreamResponse {
    // Implementation from section 3.3
    // ...
  }

  private contentToString(content: MessageContent): string {
    // ...
  }

  private normalizeFinishReason(reason: string): FinishReason {
    // ...
  }

  private async makeRequest(request: OpenAIChatRequest): Promise<OpenAIChatResponse> {
    // ...
  }
}
```

#### Branded Types

Use branded types for compile-time validation of IDs:

```typescript
/**
 * Branded types for type-safe IDs
 */
declare const RequestIdBrand: unique symbol;
declare const ResponseIdBrand: unique symbol;

type RequestId = string & { readonly [RequestIdBrand]: never };
type ResponseId = string & { readonly [ResponseIdBrand]: never };

function createRequestId(): RequestId {
  return crypto.randomUUID() as RequestId;
}

function createResponseId(): ResponseId {
  return crypto.randomUUID() as ResponseId;
}

// This prevents accidentally mixing IDs
interface UniversalChatRequest {
  metadata?: {
    requestId?: RequestId; // Only accepts RequestId, not arbitrary string
  };
}

interface UniversalChatResponse {
  id?: ResponseId; // Only accepts ResponseId
  metadata?: {
    requestId?: RequestId; // Links back to request
  };
}
```

#### Conditional Types

Use conditional types for adapter capability detection:

```typescript
/**
 * Conditional types for capability-based behavior
 */
type SupportsStreaming<T extends BackendAdapter> =
  T['capabilities']['supportsStreaming'] extends true ? T : never;

type SupportsTools<T extends BackendAdapter> =
  T['capabilities']['supportsTools'] extends true ? T : never;

/**
 * Extract adapters that support specific features
 */
type StreamingAdapter = SupportsStreaming<BackendAdapter>;
type ToolCallingAdapter = SupportsTools<BackendAdapter>;

/**
 * Conditional return types based on request
 */
type ChatResult<T extends UniversalChatRequest> =
  T['stream'] extends true
    ? UniversalStreamResponse
    : Promise<UniversalChatResponse>;

function chat<T extends UniversalChatRequest>(request: T): ChatResult<T> {
  // Return type is conditional based on request.stream
  if (request.stream) {
    return this.chatStream(request) as ChatResult<T>;
  }
  return this.chatNonStreaming(request) as ChatResult<T>;
}
```

### 5.2 Complete Type-Safe Example

```typescript
/**
 * Complete example showing all TypeScript patterns
 */

// 1. Provider registry with const assertion
const PROVIDERS = {
  openai: {
    name: 'openai',
    endpoint: 'https://api.openai.com/v1',
    models: ['gpt-4', 'gpt-3.5-turbo'] as const
  },
  anthropic: {
    name: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1',
    models: ['claude-3-opus', 'claude-3-sonnet'] as const
  }
} as const;

type ProviderRegistry = typeof PROVIDERS;
type ProviderName = keyof ProviderRegistry;

// 2. Template literal types for model identifiers
type OpenAIModel = typeof PROVIDERS.openai.models[number];
type AnthropicModel = typeof PROVIDERS.anthropic.models[number];
type AnyModel = OpenAIModel | AnthropicModel;

// 3. Discriminated union for adapters
type Adapter =
  | { type: 'frontend'; provider: ProviderName; adapter: FrontendAdapter }
  | { type: 'backend'; provider: ProviderName; adapter: BackendAdapter };

// 4. Generic bridge with type parameters
class Bridge<
  TFrontend extends FrontendAdapter = FrontendAdapter,
  TBackend extends BackendAdapter = BackendAdapter
> {
  constructor(
    private frontend: TFrontend,
    private backend: TBackend,
    private router: Router = new Router()
  ) {}

  async chat<T extends UniversalChatRequest>(
    request: T
  ): Promise<UniversalChatResponse> {
    const warnings: SemanticWarning[] = [];

    // Frontend -> IR
    const ir = this.frontend.toUniversal(request);

    // Check backend capabilities
    const capabilityWarnings = this.checkCapabilities(ir);
    warnings.push(...capabilityWarnings);

    // Backend -> Provider -> IR
    const response = await this.backend.chat(ir);

    // Add warnings to metadata
    if (warnings.length > 0) {
      response.metadata = {
        ...response.metadata,
        warnings
      };
    }

    return response;
  }

  chatStream<T extends UniversalChatRequest>(
    request: T,
    options?: { signal?: AbortSignal }
  ): UniversalStreamResponse {
    const ir = this.frontend.toUniversal(request);
    return this.backend.chatStream(ir, options);
  }

  private checkCapabilities(ir: UniversalChatRequest): SemanticWarning[] {
    const warnings: SemanticWarning[] = [];
    const caps = this.backend.capabilities;

    if (ir.tools && !caps.supportsTools) {
      warnings.push({
        type: 'unsupported_feature',
        field: 'tools',
        message: `${this.backend.name} does not support tools`,
        originalValue: ir.tools,
        transformedValue: undefined
      });
    }

    if (ir.stream && !caps.supportsStreaming) {
      warnings.push({
        type: 'unsupported_feature',
        field: 'stream',
        message: `${this.backend.name} does not support streaming`,
        originalValue: true,
        transformedValue: false
      });
    }

    return warnings;
  }
}

// 5. Usage with full type safety
const openaiBackend: BackendAdapter<OpenAIChatRequest, OpenAIChatResponse> =
  new OpenAIBackendAdapter();
const anthropicFrontend: FrontendAdapter =
  new AnthropicFrontendAdapter();

const bridge = new Bridge(anthropicFrontend, openaiBackend);

// Type-safe request
const request: UniversalChatRequest = {
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are helpful' },
    { role: 'user', content: 'Hello' }
  ],
  temperature: 0.7
};

// Compile-time error if types don't match
const response = await bridge.chat(request);
```

---

## 6. Design Decisions & Rationale

### 6.1 Core Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **All messages in array** | Simplifies IR, adapters handle placement | Adapters must know provider conventions |
| **Temperature 0-1** | Majority of providers use this | OpenAI requires scaling |
| **AsyncGenerator for streaming** | Native JS, natural backpressure | No bidirectional streaming |
| **Warnings over errors** | Maximize compatibility | Silent degradation possible |
| **Provider hints escape hatch** | Support edge cases | Can bypass normalization |
| **Metadata tracking** | Debugging and trust | Additional overhead |
| **Branded types for IDs** | Compile-time safety | More complex types |

### 6.2 Alternative Approaches Considered

#### Alternative 1: Multiple IR Schemas

**Approach**: Define separate IRs for different capability levels (basic chat, tool calling, multimodal, etc.)

**Rejected Because**:
- Increases complexity for developers (which IR to use?)
- Adapters would need to handle multiple IR formats
- Capability detection can be handled with metadata instead

#### Alternative 2: Provider-Specific IR Extensions

**Approach**: Create `OpenAIUniversalChatRequest extends UniversalChatRequest` with OpenAI-specific fields

**Rejected Because**:
- Breaks universality - frontend/backend pairs would need to align on extensions
- Provider hints + metadata achieve same goal with more flexibility

#### Alternative 3: Protobuf/Binary IR

**Approach**: Use Protocol Buffers or similar for IR instead of TypeScript types

**Rejected Because**:
- Adds complexity (codegen, runtime serialization)
- JSON is more debuggable
- Performance gain minimal for typical usage
- **Could revisit** if performance becomes critical

#### Alternative 4: Observable Streams

**Approach**: Use RxJS Observables instead of AsyncGenerator for streaming

**Rejected Because**:
- Adds dependency on RxJS
- AsyncGenerator is native and sufficient
- Can wrap with Observable if needed

### 6.3 Future Extensibility

The IR is designed to evolve with versioning:

```typescript
interface UniversalChatRequest {
  metadata?: {
    irVersion?: string; // "1.0.0", "1.1.0", etc.
  };
}
```

**Versioning Strategy**:

- **Patch versions (1.0.x)**: Bug fixes, clarifications, no schema changes
- **Minor versions (1.x.0)**: Additive changes (new optional fields)
- **Major versions (x.0.0)**: Breaking changes (removed fields, changed semantics)

**Backward Compatibility**:

Adapters should handle multiple IR versions:

```typescript
class BackendAdapter {
  toProvider(ir: UniversalChatRequest): ProviderRequest {
    const version = ir.metadata?.irVersion ?? '1.0.0';

    if (version.startsWith('1.')) {
      return this.handleV1(ir);
    } else if (version.startsWith('2.')) {
      return this.handleV2(ir);
    }

    throw new Error(`Unsupported IR version: ${version}`);
  }
}
```

---

## 7. Implementation Recommendations

### 7.1 Phased Implementation

**Phase 1: Core IR + Basic Adapters**
- Define core types (`UniversalChatRequest`, `UniversalChatResponse`, `UniversalMessage`)
- Implement OpenAI and Anthropic adapters (frontend + backend)
- Implement basic Bridge class
- Non-streaming only

**Phase 2: Streaming**
- Add `UniversalStreamChunk` type
- Implement streaming for OpenAI and Anthropic
- Add cancellation support via `AbortSignal`

**Phase 3: Additional Providers**
- Gemini adapters
- Ollama adapters
- Mistral adapters
- Chrome AI adapters

**Phase 4: Router & Middleware**
- Implement Router class
- Middleware system
- Dynamic backend selection
- Parallel dispatch

**Phase 5: Advanced Features**
- Tool calling support
- Multimodal content
- Semantic drift detection
- Performance optimization

### 7.2 Testing Strategy

**Unit Tests**:
- Each adapter should have round-trip tests: `Provider -> IR -> Provider`
- Test semantic warnings are emitted correctly
- Test unsupported features are handled gracefully

**Integration Tests**:
- Test real API calls (with mocking/recording)
- Test streaming cancellation
- Test error handling

**Type Tests**:
```typescript
/**
 * Compile-time type tests
 */
import { expectType } from 'tsd';

// Test discriminated unions work
declare const chunk: UniversalStreamChunk;
if (chunk.type === 'content_delta') {
  expectType<string | undefined>(chunk.delta?.content);
  expectType<undefined>(chunk.toolCallDelta); // Should not exist
}

// Test generic constraints
declare const bridge: Bridge<FrontendAdapter, BackendAdapter>;
expectType<Promise<UniversalChatResponse>>(
  bridge.chat({} as UniversalChatRequest)
);
```

### 7.3 Documentation Requirements

**For Each Adapter**:
- Supported features matrix
- Known semantic differences
- Example usage
- Migration guide from direct API usage

**For IR**:
- Field reference with examples
- Versioning policy
- Extension guidelines

**For Developers**:
- Quick start guide
- Common patterns
- Troubleshooting guide
- Performance considerations

---

## 8. Open Questions & Future Research

### 8.1 Unresolved Issues

1. **Multi-turn Tool Calling**: How to represent complex tool-calling flows where models make multiple tool calls with intermediate results?

2. **Streaming Tool Calls**: Tool calls can be streamed incrementally (partial JSON). How to assemble and validate?

3. **Image Input Normalization**: Different providers accept images differently (URL vs base64 vs file upload). How to normalize?

4. **Cost Tracking**: Should IR include cost estimation/tracking? How to normalize pricing across providers?

5. **Prompt Caching**: Anthropic and others support prompt caching. How to represent cache keys in IR?

6. **Function Calling vs Tools**: OpenAI has legacy function calling and newer tool calling. Consolidate?

### 8.2 Performance Optimization

**Potential Improvements**:

1. **Compiled Adapters**: Pre-generate adapter code for common paths to reduce overhead

2. **Streaming Optimization**: Use native TransformStreams instead of AsyncGenerator for better performance

3. **Binary IR Option**: Provide optional binary serialization for high-throughput scenarios

4. **Adapter Pool**: Reuse adapter instances instead of creating new ones per request

### 8.3 Governance Considerations

**Questions**:

1. Should this IR align with emerging standards like Model Context Protocol (MCP)?

2. How to handle provider Terms of Service that may prohibit routing/proxying?

3. Should there be a governance body for IR versioning and evolution?

4. How to handle security/privacy when routing across trust boundaries?

---

## 9. Conclusion

This research demonstrates that a Universal Intermediate Representation for AI chat APIs is both **feasible and practical**. The key insights are:

1. **Core Commonality Exists**: ~90% of chat interactions can be represented with a simple core schema

2. **System Messages are the Main Challenge**: Adapters can normalize system message placement, with warnings for lossy conversions

3. **Streaming is Solvable**: AsyncGenerator provides a clean abstraction over different streaming protocols

4. **Semantic Drift is Manageable**: Metadata and warnings make semantic differences visible and debuggable

5. **TypeScript 5.0+ is Sufficient**: Modern TypeScript provides excellent type safety without external tools

The proposed IR balances **simplicity** (easy to understand and implement), **completeness** (covers real use cases), and **extensibility** (can evolve with ecosystem).

**Next Steps**:
1. Validate IR schema with stakeholders
2. Implement Phase 1 (Core IR + basic adapters)
3. Test with real applications
4. Iterate based on feedback

---

## Appendix A: Provider API Documentation

- **OpenAI**: https://platform.openai.com/docs/api-reference/chat
- **Anthropic**: https://docs.anthropic.com/en/api/messages
- **Google Gemini**: https://ai.google.dev/docs/gemini_api_overview
- **Ollama**: https://github.com/ollama/ollama/blob/main/docs/api.md
- **Mistral**: https://docs.mistral.ai/api/
- **Chrome AI**: https://developer.chrome.com/docs/ai/built-in

## Appendix B: Related Standards

- **Model Context Protocol (MCP)**: https://modelcontextprotocol.io/
- **OpenAPI Specification**: https://spec.openapis.org/oas/latest.html
- **JSON Schema**: https://json-schema.org/
- **LLVM IR Design**: https://llvm.org/docs/LangRef.html (inspiration for IR design)

## Appendix C: Code Repository Structure

```
src/
├── types/
│   ├── ir.ts                    # Core IR type definitions
│   ├── streaming.ts             # Streaming types
│   ├── errors.ts                # Error types
│   └── index.ts
├── adapters/
│   ├── frontend/
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   ├── gemini.ts
│   │   ├── ollama.ts
│   │   ├── mistral.ts
│   │   └── chromeai.ts
│   ├── backend/
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   ├── gemini.ts
│   │   ├── ollama.ts
│   │   ├── mistral.ts
│   │   └── chromeai.ts
│   └── index.ts
├── core/
│   ├── bridge.ts                # Main Bridge class
│   ├── router.ts                # Router implementation
│   ├── middleware.ts            # Middleware system
│   └── index.ts
├── utils/
│   ├── normalizers.ts           # Parameter normalization
│   ├── validators.ts            # Request/response validation
│   ├── token-counter.ts         # Token counting utilities
│   └── index.ts
└── index.ts                     # Public API exports
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-13
**Authors**: Research Team
**Status**: Complete - Ready for Review
