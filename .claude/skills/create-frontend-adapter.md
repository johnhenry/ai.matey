# Frontend Adapter Creator Skill

Use this skill when the user asks to create a new frontend adapter for ai.matey. Frontend adapters convert provider-specific request formats to Universal IR and IR responses back to provider formats.

## Prerequisites

Before starting, gather this information from the user:
1. **Provider name** (e.g., "Cohere", "Perplexity")
2. **Provider API documentation URL**
3. **Message format** (how the provider structures chat messages)
4. **System message strategy** (in-messages, separate-parameter, prepend-user, or not-supported)
5. **Supported parameters** (temperature, topP, topK, etc.)
6. **Streaming format** (SSE, JSONL, or custom)
7. **Sample request/response** (actual JSON from the provider's API docs)

## Step-by-Step Implementation

### Step 1: Create the adapter file

Create `src/adapters/frontend/{provider-name}.ts` (lowercase, hyphenated).

Example: `src/adapters/frontend/cohere.ts`

### Step 2: Define provider types

At the top of the file, define the provider's request/response types:

```typescript
/**
 * {Provider} Frontend Adapter
 *
 * Converts {Provider} API format to Universal IR and vice versa.
 *
 * @module
 */

import type { FrontendAdapter, AdapterMetadata } from '../../types/adapters.js';
import type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRStreamChunk,
  IRMessage,
  IRContentBlock,
  FinishReason,
} from '../../types/ir.js';
import type { StreamConversionOptions } from '../../types/streaming.js';
import {
  AdapterConversionError,
  ErrorCode,
} from '../../errors/index.js';
import { convertStreamMode } from '../../utils/streaming-modes.js';

// ============================================================================
// {Provider} API Types
// ============================================================================

/**
 * {Provider} message format.
 */
export interface {Provider}Message {
  role: 'user' | 'assistant' | 'system';  // Adjust based on provider
  content: string;  // Or more complex structure
}

/**
 * {Provider} chat request format.
 */
export interface {Provider}ChatRequest {
  model?: string;
  messages: {Provider}Message[];
  temperature?: number;
  max_tokens?: number;
  // ... other provider-specific parameters
}

/**
 * {Provider} chat response format.
 */
export interface {Provider}ChatResponse {
  id?: string;
  message: {Provider}Message;
  stop_reason?: string;  // Or finish_reason, etc.
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  // ... other provider-specific fields
}

/**
 * {Provider} stream chunk format (if streaming supported).
 */
export interface {Provider}StreamChunk {
  type: 'content_delta' | 'message_end';  // Provider's event types
  delta?: { text: string };
  // ... other chunk fields
}
```

### Step 3: Define metadata

Create the adapter metadata with accurate capabilities:

```typescript
// ============================================================================
// {Provider} Frontend Adapter
// ============================================================================

export class {Provider}FrontendAdapter implements FrontendAdapter<
  {Provider}ChatRequest,
  {Provider}ChatResponse,
  {Provider}StreamChunk
> {
  readonly metadata: AdapterMetadata = {
    name: '{provider-lowercase}-frontend',
    version: '1.0.0',
    provider: '{Provider Name}',
    capabilities: {
      streaming: true,  // Set based on provider support
      multiModal: false,  // Set based on provider support
      tools: false,  // Set based on provider support
      maxContextTokens: 128000,  // Provider's context window

      // CRITICAL: System message strategy
      // Options: 'in-messages', 'separate-parameter', 'prepend-user', 'not-supported'
      systemMessageStrategy: 'in-messages',
      supportsMultipleSystemMessages: true,

      // Parameter support
      supportsTemperature: true,
      supportsTopP: true,
      supportsTopK: false,  // Most don't support topK
      supportsSeed: false,
      supportsFrequencyPenalty: false,
      supportsPresencePenalty: false,
      maxStopSequences: 4,
    },
  };
```

**System Message Strategy Guide:**
- `'in-messages'`: System messages in the messages array (like OpenAI)
- `'separate-parameter'`: System extracted to separate field (like Anthropic)
- `'prepend-user'`: System message prepended to first user message
- `'not-supported'`: System messages not supported (will be dropped)

### Step 4: Implement toIR() - Request Conversion

Convert provider format → Universal IR:

```typescript
  async toIR(request: {Provider}ChatRequest): Promise<IRChatRequest> {
    try {
      // Convert messages
      const messages: IRMessage[] = request.messages.map((msg) => {
        // Handle role mapping
        const role = this.mapRoleToIR(msg.role);

        // Handle content conversion
        let content: string | IRContentBlock[];
        if (typeof msg.content === 'string') {
          content = msg.content;
        } else {
          // If provider uses structured content (like image blocks)
          content = msg.content.map((block) => {
            if (block.type === 'text') {
              return { type: 'text', text: block.text };
            } else if (block.type === 'image') {
              // Map image format
              return {
                type: 'image',
                source: {
                  type: block.source.type,
                  url: block.source.url,
                  data: block.source.data,
                  mediaType: block.source.media_type
                }
              };
            }
            return { type: 'text', text: JSON.stringify(block) };
          });
        }

        return { role, content };
      });

      // Map parameters
      // IMPORTANT: Normalize parameters to IR ranges
      const parameters: IRChatRequest['parameters'] = {
        model: request.model,
        temperature: request.temperature,  // Usually 0-1 or 0-2
        topP: request.top_p,
        topK: request.top_k,
        maxTokens: request.max_tokens,
        stopSequences: request.stop_sequences,
      };

      // Create IR request
      return {
        messages,
        parameters,
        stream: false,
        metadata: {
          requestId: crypto.randomUUID(),
          timestamp: Date.now(),
          provenance: {
            frontend: this.metadata.name,
          },
        },
      };
    } catch (error) {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: `Failed to convert {Provider} request to IR: ${error instanceof Error ? error.message : String(error)}`,
        provenance: { frontend: this.metadata.name },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Map provider role to IR role.
   */
  private mapRoleToIR(role: string): 'system' | 'user' | 'assistant' {
    // Handle role name differences
    // Some providers use 'bot', 'ai', 'model' instead of 'assistant'
    if (role === 'bot' || role === 'ai' || role === 'model') {
      return 'assistant';
    }
    return role as 'system' | 'user' | 'assistant';
  }
```

**Parameter Mapping Considerations:**

- **Temperature**: Most providers use 0-1, but OpenAI uses 0-2. Normalize accordingly.
- **Top-K**: Not universally supported. Check provider docs.
- **Max Tokens**: Field name varies (max_tokens, maxTokens, maximum_tokens).
- **Stop Sequences**: Some providers call it "stop", others "stop_sequences".

### Step 5: Implement fromIR() - Response Conversion

Convert IR → provider format:

```typescript
  async fromIR(response: IRChatResponse): Promise<{Provider}ChatResponse> {
    try {
      // Convert message
      const message: {Provider}Message = {
        role: this.mapRoleFromIR(response.message.role),
        content: this.extractTextContent(response.message.content),
      };

      // Map finish reason
      const stop_reason = this.mapFinishReason(response.finishReason);

      // Build response
      const providerResponse: {Provider}ChatResponse = {
        id: response.metadata.providerResponseId,
        message,
        stop_reason,
        usage: response.usage ? {
          input_tokens: response.usage.promptTokens,
          output_tokens: response.usage.completionTokens,
        } : undefined,
      };

      return providerResponse;
    } catch (error) {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: `Failed to convert IR to {Provider} format: ${error instanceof Error ? error.message : String(error)}`,
        provenance: { frontend: this.metadata.name },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Map IR role to provider role.
   */
  private mapRoleFromIR(role: 'system' | 'user' | 'assistant'): string {
    // Reverse of mapRoleToIR
    // If provider uses different names, map them here
    return role;
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
   * Map IR finish reason to provider format.
   */
  private mapFinishReason(reason: FinishReason): string {
    // Map IR reasons to provider equivalents
    switch (reason) {
      case 'stop':
        return 'COMPLETE';  // Or 'end_turn', 'stop', etc.
      case 'length':
        return 'MAX_TOKENS';  // Or 'length', 'max_tokens', etc.
      case 'content_filter':
        return 'CONTENT_FILTER';
      case 'tool_calls':
        return 'TOOL_USE';
      default:
        return 'COMPLETE';
    }
  }
```

**Finish Reason Mapping:**

Standard IR values:
- `'stop'` - Natural completion
- `'length'` - Max tokens reached
- `'content_filter'` - Content policy violation
- `'tool_calls'` - Function/tool call initiated

Map these to provider equivalents.

### Step 6: Implement fromIRStream() - Stream Conversion

Convert IR stream → provider stream format:

```typescript
  async *fromIRStream(
    stream: IRChatStream,
    options?: StreamConversionOptions
  ): AsyncGenerator<{Provider}StreamChunk, void, undefined> {
    try {
      // Apply stream mode conversion if requested
      const processedStream = options ? convertStreamMode(stream, options) : stream;

      for await (const chunk of processedStream) {
        switch (chunk.type) {
          case 'start':
            // Some providers send a start event
            yield {
              type: 'message_start',
              message: {
                id: chunk.metadata.requestId,
                role: 'assistant',
              },
            };
            break;

          case 'content':
            // Content delta
            yield {
              type: 'content_delta',
              delta: {
                text: chunk.delta,
              },
              index: 0,
            };
            break;

          case 'done':
            // Final event with finish reason
            yield {
              type: 'message_end',
              finish_reason: this.mapFinishReason(chunk.finishReason),
              usage: chunk.usage ? {
                input_tokens: chunk.usage.promptTokens,
                output_tokens: chunk.usage.completionTokens,
              } : undefined,
            };
            break;

          case 'error':
            // Re-throw errors
            throw new AdapterConversionError({
              code: ErrorCode.ADAPTER_CONVERSION_ERROR,
              message: `Stream error: ${chunk.error.message}`,
              provenance: { frontend: this.metadata.name },
            });
        }
      }
    } catch (error) {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: `Stream conversion failed: ${error instanceof Error ? error.message : String(error)}`,
        provenance: { frontend: this.metadata.name },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
```

**Stream Format Considerations:**

Different providers use different streaming formats:
- **SSE (Server-Sent Events)**: OpenAI, Anthropic style
- **JSONL (newline-delimited JSON)**: Ollama style
- **Custom protocols**: Some providers have unique formats

Match your chunk structure to the provider's expected format.

### Step 7: Export the adapter

Add to `src/adapters/frontend/index.ts`:

```typescript
// {Provider} frontend adapter
export {
  {Provider}FrontendAdapter,
  type {Provider}ChatRequest,
  type {Provider}ChatResponse,
  type {Provider}StreamChunk,
  type {Provider}Message,
} from './{provider-lowercase}.js';
```

### Step 8: Test the adapter

Create a test file `tests/adapters/frontend/{provider-lowercase}.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { {Provider}FrontendAdapter } from '../../../src/adapters/frontend/{provider-lowercase}.js';

describe('{Provider}FrontendAdapter', () => {
  const adapter = new {Provider}FrontendAdapter();

  describe('toIR', () => {
    it('should convert simple request', async () => {
      const request = {
        model: 'provider-model',
        messages: [
          { role: 'user', content: 'Hello!' }
        ],
        temperature: 0.7,
      };

      const ir = await adapter.toIR(request);

      expect(ir.messages).toHaveLength(1);
      expect(ir.messages[0]).toEqual({
        role: 'user',
        content: 'Hello!'
      });
      expect(ir.parameters?.temperature).toBe(0.7);
      expect(ir.metadata.requestId).toBeDefined();
    });

    it('should handle system messages', async () => {
      const request = {
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hi' }
        ]
      };

      const ir = await adapter.toIR(request);

      expect(ir.messages).toHaveLength(2);
      expect(ir.messages[0].role).toBe('system');
    });
  });

  describe('fromIR', () => {
    it('should convert IR response', async () => {
      const irResponse = {
        message: { role: 'assistant' as const, content: 'Hello there!' },
        finishReason: 'stop' as const,
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        metadata: {
          requestId: 'test-123',
          timestamp: Date.now(),
          providerResponseId: 'resp-456',
          provenance: { backend: 'test' }
        }
      };

      const response = await adapter.fromIR(irResponse);

      expect(response.message.content).toBe('Hello there!');
      expect(response.message.role).toBe('assistant');
      expect(response.usage?.input_tokens).toBe(10);
      expect(response.usage?.output_tokens).toBe(5);
    });
  });
});
```

## Common Patterns & Best Practices

### 1. Role Name Mapping

Create helper methods for consistent role mapping:

```typescript
private mapRoleToIR(role: string): 'system' | 'user' | 'assistant' {
  const roleMap: Record<string, 'system' | 'user' | 'assistant'> = {
    'user': 'user',
    'assistant': 'assistant',
    'system': 'system',
    'bot': 'assistant',      // Provider-specific
    'ai': 'assistant',       // Provider-specific
    'model': 'assistant',    // Provider-specific
    'human': 'user',         // Provider-specific
  };
  return roleMap[role.toLowerCase()] || 'user';
}
```

### 2. Parameter Validation

Add validation for provider-specific constraints:

```typescript
private validateParameters(params: {Provider}ChatRequest): void {
  if (params.temperature !== undefined) {
    if (params.temperature < 0 || params.temperature > 1) {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: `Temperature must be between 0 and 1, got ${params.temperature}`,
        provenance: { frontend: this.metadata.name }
      });
    }
  }

  if (params.max_tokens !== undefined && params.max_tokens < 1) {
    throw new AdapterConversionError({
      code: ErrorCode.ADAPTER_CONVERSION_ERROR,
      message: `max_tokens must be positive, got ${params.max_tokens}`,
      provenance: { frontend: this.metadata.name }
    });
  }
}
```

### 3. Content Block Handling

For multimodal providers, handle different content types:

```typescript
private convertContentToIR(content: ProviderContent): string | IRContentBlock[] {
  if (typeof content === 'string') {
    return content;
  }

  return content.map((block) => {
    switch (block.type) {
      case 'text':
        return { type: 'text', text: block.text };

      case 'image':
      case 'image_url':
        return {
          type: 'image',
          source: {
            type: block.url ? 'url' : 'base64',
            url: block.url,
            data: block.data,
            mediaType: block.media_type || 'image/png'
          }
        };

      case 'tool_use':
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input
        };

      default:
        // Fallback for unknown types
        return { type: 'text', text: JSON.stringify(block) };
    }
  });
}
```

### 4. Error Handling

Always wrap conversions in try-catch with proper error types:

```typescript
try {
  // Conversion logic
} catch (error) {
  throw new AdapterConversionError({
    code: ErrorCode.ADAPTER_CONVERSION_ERROR,
    message: `Conversion failed: ${error.message}`,
    provenance: { frontend: this.metadata.name },
    cause: error instanceof Error ? error : undefined
  });
}
```

## Checklist

Before submitting the adapter, verify:

- [ ] Provider types accurately reflect API documentation
- [ ] Metadata capabilities are correct
- [ ] System message strategy is properly set
- [ ] toIR() handles all message formats
- [ ] fromIR() converts responses correctly
- [ ] fromIRStream() maps chunk types properly
- [ ] Role names are mapped correctly
- [ ] Finish reasons are mapped both ways
- [ ] Parameters are validated and normalized
- [ ] Content blocks (text/image/tool) are handled
- [ ] Error handling with proper error types
- [ ] Tests cover common cases
- [ ] Exported in index.ts
- [ ] JSDoc comments are complete

## Example Reference Adapters

Study these existing adapters for patterns:

- **Simple**: `src/adapters/frontend/ollama.ts` - Basic string messages
- **Moderate**: `src/adapters/frontend/openai.ts` - Content blocks, tools
- **Complex**: `src/adapters/frontend/anthropic.ts` - System parameter, strict validation

## Next Steps

After creating the frontend adapter, you typically need:

1. **Backend adapter** - To actually call the provider's API
2. **Integration tests** - Test frontend + backend together
3. **Documentation** - Add provider to README supported providers table
4. **Examples** - Create usage examples in `examples/` directory
