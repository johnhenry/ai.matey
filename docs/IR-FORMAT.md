# Intermediate Representation (IR) Format

**Last Updated:** 2025-11-29

## Table of Contents

- [Overview](#overview)
- [Design Principles](#design-principles)
- [Message Types](#message-types)
- [Request Format](#request-format)
- [Response Format](#response-format)
- [Streaming Format](#streaming-format)
- [Metadata & Provenance](#metadata--provenance)
- [Tools & Function Calling](#tools--function-calling)
- [Parameters](#parameters)
- [Capabilities](#capabilities)
- [Examples](#examples)

---

## Overview

The **Intermediate Representation (IR)** is the universal format that sits between frontend and backend adapters in the ai.matey ecosystem. It represents chat requests, responses, and streams in a normalized, provider-agnostic way.

```
Client (OpenAI format)
        ↓
Frontend Adapter → IR Format → Backend Adapter
                                        ↓
                                Provider (Anthropic API)
```

The IR acts as a translation layer, allowing any client format to work with any backend provider.

---

## Design Principles

### 1. Provider-Agnostic
No provider-specific fields in core types. All providers map to the same IR structure.

### 2. Extensible
Support for metadata and custom fields allows provider-specific data to flow through without breaking compatibility.

### 3. Type-Safe
Uses TypeScript discriminated unions for runtime type checking and compile-time safety.

### 4. Stream-Friendly
First-class support for streaming responses with multiple streaming modes (delta and accumulated).

### 5. Semantic Drift Tracking
Captures transformations and compatibility warnings when converting between formats.

---

## Message Types

### MessageRole

The role of a participant in the conversation:

```typescript
type MessageRole = 'system' | 'user' | 'assistant' | 'tool';
```

**Role Mapping Across Providers:**

| IR Role | OpenAI | Anthropic | Gemini | Ollama |
|---------|---------|-----------|---------|---------|
| `system` | `system` | (separate param) | `systemInstruction` | `system` |
| `user` | `user` | `user` | `user` | `user` |
| `assistant` | `assistant` | `assistant` | `model` | `assistant` |
| `tool` | `tool` | `tool_result` | N/A | N/A |

### MessageContent

Messages can contain different types of content:

#### TextContent

Plain text content:

```typescript
interface TextContent {
  readonly type: 'text';
  readonly text: string;
}
```

**Example:**
```typescript
{
  type: 'text',
  text: 'Hello, how can I help you today?'
}
```

#### ImageContent

Image content from URL or base64:

```typescript
interface ImageContent {
  readonly type: 'image';
  readonly source:
    | {
        readonly type: 'url';
        readonly url: string;
      }
    | {
        readonly type: 'base64';
        readonly mediaType: string;
        readonly data: string;
      };
}
```

**Examples:**
```typescript
// Image from URL
{
  type: 'image',
  source: {
    type: 'url',
    url: 'https://example.com/photo.jpg'
  }
}

// Base64 image
{
  type: 'image',
  source: {
    type: 'base64',
    mediaType: 'image/jpeg',
    data: 'iVBORw0KGgo...'
  }
}
```

#### ToolUseContent

AI requesting to call a tool:

```typescript
interface ToolUseContent {
  readonly type: 'tool_use';
  readonly id: string;
  readonly name: string;
  readonly input: Record<string, unknown>;
}
```

**Example:**
```typescript
{
  type: 'tool_use',
  id: 'toolu_01A2B3C4D5E6',
  name: 'get_weather',
  input: {
    location: 'San Francisco',
    units: 'celsius'
  }
}
```

#### ToolResultContent

Result from tool execution:

```typescript
interface ToolResultContent {
  readonly type: 'tool_result';
  readonly toolUseId: string;
  readonly content: string | TextContent[];
  readonly isError?: boolean;
}
```

**Example:**
```typescript
{
  type: 'tool_result',
  toolUseId: 'toolu_01A2B3C4D5E6',
  content: 'Temperature: 18°C, Conditions: Partly cloudy',
  isError: false
}
```

### IRMessage

A complete message in the conversation:

```typescript
interface IRMessage {
  readonly role: MessageRole;
  readonly content: string | readonly MessageContent[];
  readonly name?: string;
  readonly metadata?: Record<string, unknown>;
}
```

**Examples:**

```typescript
// Simple text message
{
  role: 'user',
  content: 'Hello, AI!'
}

// Multi-modal message with image
{
  role: 'user',
  content: [
    { type: 'text', text: 'What is in this image?' },
    {
      type: 'image',
      source: {
        type: 'url',
        url: 'https://example.com/photo.jpg'
      }
    }
  ]
}

// System message
{
  role: 'system',
  content: 'You are a helpful assistant specializing in technical support.'
}
```

---

## Request Format

### IRChatRequest

The complete request structure:

```typescript
interface IRChatRequest {
  readonly messages: readonly IRMessage[];
  readonly tools?: readonly IRTool[];
  readonly toolChoice?: 'auto' | 'required' | 'none' | { readonly name: string };
  readonly parameters?: IRParameters;
  readonly metadata: IRMetadata;
  readonly stream?: boolean;
  readonly streamMode?: StreamMode;
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | `IRMessage[]` | ✅ | Conversation messages (minimum 1) |
| `tools` | `IRTool[]` | ❌ | Available tools/functions |
| `toolChoice` | `string \| object` | ❌ | Tool selection strategy |
| `parameters` | `IRParameters` | ❌ | Generation parameters (temperature, etc.) |
| `metadata` | `IRMetadata` | ✅ | Request tracking metadata |
| `stream` | `boolean` | ❌ | Enable streaming (default: false) |
| `streamMode` | `StreamMode` | ❌ | Streaming mode (default: 'delta') |

**Complete Example:**

```typescript
{
  messages: [
    {
      role: 'system',
      content: 'You are a helpful assistant.'
    },
    {
      role: 'user',
      content: 'What is the weather in Tokyo?'
    }
  ],
  tools: [
    {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name or coordinates'
          },
          units: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            default: 'celsius'
          }
        },
        required: ['location']
      }
    }
  ],
  toolChoice: 'auto',
  parameters: {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000,
    topP: 0.9
  },
  metadata: {
    requestId: 'req_abc123xyz',
    timestamp: 1701234567890,
    provenance: {
      frontend: 'openai'
    }
  },
  stream: false
}
```

---

## Response Format

### IRChatResponse

The complete response structure:

```typescript
interface IRChatResponse {
  readonly message: IRMessage;
  readonly finishReason: FinishReason;
  readonly usage?: IRUsage;
  readonly metadata: IRMetadata;
  readonly raw?: Record<string, unknown>;
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `IRMessage` | ✅ | Generated assistant message |
| `finishReason` | `FinishReason` | ✅ | Why generation stopped |
| `usage` | `IRUsage` | ❌ | Token usage statistics |
| `metadata` | `IRMetadata` | ✅ | Response tracking metadata |
| `raw` | `object` | ❌ | Provider-specific raw response |

### FinishReason

Why the generation completed:

```typescript
type FinishReason =
  | 'stop'           // Natural completion
  | 'length'         // Hit max tokens
  | 'tool_calls'     // Requested tool execution
  | 'content_filter' // Filtered by safety system
  | 'error'          // Error occurred
  | 'cancelled';     // Request cancelled
```

### IRUsage

Token usage statistics:

```typescript
interface IRUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly details?: Record<string, unknown>;
}
```

**Example Response:**

```typescript
{
  message: {
    role: 'assistant',
    content: 'The weather in Tokyo is currently 22°C with clear skies.'
  },
  finishReason: 'stop',
  usage: {
    promptTokens: 45,
    completionTokens: 18,
    totalTokens: 63
  },
  metadata: {
    requestId: 'req_abc123xyz',
    providerResponseId: 'chatcmpl-9A1B2C3D',
    timestamp: 1701234567890,
    provenance: {
      frontend: 'openai',
      backend: 'anthropic',
      middleware: ['logging', 'caching']
    }
  }
}
```

---

## Streaming Format

### Streaming Modes

The IR supports two streaming modes:

#### Delta Mode (Default)

Most efficient - each chunk contains only new content:

```typescript
// Chunk 1
{ type: 'content', delta: 'Hello', sequence: 0 }

// Chunk 2
{ type: 'content', delta: ' world', sequence: 1 }

// Chunk 3
{ type: 'content', delta: '!', sequence: 2 }
```

#### Accumulated Mode

Each chunk contains full text so far (Chrome AI style):

```typescript
// Chunk 1
{ type: 'content', delta: 'Hello', accumulated: 'Hello', sequence: 0 }

// Chunk 2
{ type: 'content', delta: ' world', accumulated: 'Hello world', sequence: 1 }

// Chunk 3
{ type: 'content', delta: '!', accumulated: 'Hello world!', sequence: 2 }
```

### Stream Chunk Types

```typescript
type IRStreamChunk =
  | StreamStartChunk
  | StreamContentChunk
  | StreamToolUseChunk
  | StreamMetadataChunk
  | StreamDoneChunk
  | StreamErrorChunk;
```

#### StreamStartChunk

Signals start of stream:

```typescript
interface StreamStartChunk {
  readonly type: 'start';
  readonly sequence: number;
  readonly metadata: IRMetadata;
}
```

#### StreamContentChunk

Content delta or accumulated:

```typescript
interface StreamContentChunk {
  readonly type: 'content';
  readonly sequence: number;
  readonly delta: string;           // Always present
  readonly accumulated?: string;    // Optional (accumulated mode)
  readonly role?: 'assistant';
}
```

#### StreamToolUseChunk

Tool call request:

```typescript
interface StreamToolUseChunk {
  readonly type: 'tool_use';
  readonly sequence: number;
  readonly id: string;
  readonly name: string;
  readonly inputDelta?: string;
}
```

#### StreamMetadataChunk

Usage or metadata updates:

```typescript
interface StreamMetadataChunk {
  readonly type: 'metadata';
  readonly sequence: number;
  readonly usage?: Partial<IRUsage>;
  readonly metadata?: Partial<IRMetadata>;
}
```

#### StreamDoneChunk

End of stream:

```typescript
interface StreamDoneChunk {
  readonly type: 'done';
  readonly sequence: number;
  readonly finishReason: FinishReason;
  readonly usage?: IRUsage;
  readonly message?: IRMessage;
}
```

#### StreamErrorChunk

Error during streaming:

```typescript
interface StreamErrorChunk {
  readonly type: 'error';
  readonly sequence: number;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
}
```

### Streaming Example

```typescript
async function processStream(stream: IRChatStream) {
  for await (const chunk of stream) {
    switch (chunk.type) {
      case 'start':
        console.log('Stream started:', chunk.metadata.requestId);
        break;

      case 'content':
        // Use delta for incremental updates
        process.stdout.write(chunk.delta);

        // Or use accumulated for full text replacement
        // console.clear();
        // console.log(chunk.accumulated || '');
        break;

      case 'tool_use':
        console.log('Tool call:', chunk.name);
        break;

      case 'metadata':
        if (chunk.usage) {
          console.log('Tokens used:', chunk.usage);
        }
        break;

      case 'done':
        console.log('\nFinished:', chunk.finishReason);
        if (chunk.usage) {
          console.log('Total tokens:', chunk.usage.totalTokens);
        }
        break;

      case 'error':
        console.error('Error:', chunk.error.message);
        break;
    }
  }
}
```

---

## Metadata & Provenance

### IRMetadata

Tracks requests through the adapter chain:

```typescript
interface IRMetadata {
  readonly requestId: string;
  readonly providerResponseId?: string;
  readonly timestamp: number;
  readonly provenance?: IRProvenance;
  readonly warnings?: readonly IRWarning[];
  readonly custom?: Record<string, unknown>;
}
```

**Field Descriptions:**

| Field | Description |
|-------|-------------|
| `requestId` | Client-generated unique ID (stable across retries) |
| `providerResponseId` | Provider's actual response ID (for correlation) |
| `timestamp` | Request timestamp (milliseconds since epoch) |
| `provenance` | Adapter chain information |
| `warnings` | Semantic drift warnings |
| `custom` | Application-specific metadata |

### IRProvenance

Tracks which adapters processed the request:

```typescript
interface IRProvenance {
  readonly frontend?: string;
  readonly backend?: string;
  readonly middleware?: readonly string[];
  readonly router?: string;
}
```

**Example:**

```typescript
{
  frontend: 'anthropic',
  backend: 'openai',
  middleware: ['logging', 'caching', 'retry'],
  router: 'load-balancer'
}
```

### IRWarning

Documents transformations and compatibility issues:

```typescript
interface IRWarning {
  readonly category: WarningCategory;
  readonly severity: WarningSeverity;
  readonly message: string;
  readonly field?: string;
  readonly originalValue?: unknown;
  readonly transformedValue?: unknown;
  readonly source?: string;
  readonly details?: Record<string, unknown>;
}

type WarningCategory =
  | 'parameter-normalized'
  | 'parameter-clamped'
  | 'parameter-unsupported'
  | 'capability-unsupported'
  | 'token-limit-exceeded'
  | 'stop-sequences-truncated'
  | 'system-message-transformed'
  | 'content-type-unsupported'
  | 'tool-unsupported'
  | 'model-substituted';

type WarningSeverity = 'info' | 'warning' | 'error';
```

**Example Warning:**

```typescript
{
  category: 'parameter-normalized',
  severity: 'info',
  message: 'Temperature normalized from 0-2 range to 0-1 range',
  field: 'temperature',
  originalValue: 1.5,
  transformedValue: 0.75,
  source: 'gemini-backend'
}
```

---

## Tools & Function Calling

### IRTool

Tool/function definition:

```typescript
interface IRTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: JSONSchema;
  readonly metadata?: Record<string, unknown>;
}
```

### JSONSchema

Parameter validation schema:

```typescript
interface JSONSchema {
  readonly type?: JSONSchemaType | readonly JSONSchemaType[];
  readonly description?: string;
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
  readonly properties?: Record<string, JSONSchema>;
  readonly required?: readonly string[];
  readonly items?: JSONSchema;
  readonly additionalProperties?: boolean | JSONSchema;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly format?: string;
  readonly default?: unknown;
  readonly examples?: readonly unknown[];
}

type JSONSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null';
```

### Tool Definition Example

```typescript
const weatherTool: IRTool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name or coordinates',
        examples: ['San Francisco', '37.7749,-122.4194']
      },
      units: {
        type: 'string',
        description: 'Temperature units',
        enum: ['celsius', 'fahrenheit'],
        default: 'celsius'
      },
      include_forecast: {
        type: 'boolean',
        description: 'Include 5-day forecast',
        default: false
      }
    },
    required: ['location']
  }
};
```

---

## Parameters

### IRParameters

Normalized generation parameters:

```typescript
interface IRParameters {
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly topP?: number;
  readonly topK?: number;
  readonly frequencyPenalty?: number;
  readonly presencePenalty?: number;
  readonly stopSequences?: readonly string[];
  readonly seed?: number;
  readonly user?: string;
  readonly custom?: Record<string, unknown>;
}
```

**Parameter Ranges:**

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| `temperature` | 0.0 - 2.0 | 0.7 | Sampling randomness (higher = more random) |
| `maxTokens` | 1 - ∞ | varies | Maximum tokens to generate |
| `topP` | 0.0 - 1.0 | 1.0 | Nucleus sampling threshold |
| `topK` | 1 - ∞ | varies | Top-K sampling limit |
| `frequencyPenalty` | -2.0 - 2.0 | 0.0 | Penalize frequent tokens |
| `presencePenalty` | -2.0 - 2.0 | 0.0 | Penalize present tokens |

**Example:**

```typescript
{
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 1000,
  topP: 0.9,
  frequencyPenalty: 0.5,
  presencePenalty: 0.2,
  stopSequences: ['\n\n', 'END'],
  seed: 42,
  user: 'user_123'
}
```

---

## Capabilities

### IRCapabilities

Describes what an adapter supports:

```typescript
interface IRCapabilities {
  readonly streaming: boolean;
  readonly multiModal: boolean;
  readonly tools?: boolean;
  readonly maxContextTokens?: number;
  readonly supportedModels?: readonly string[];
  readonly systemMessageStrategy: SystemMessageStrategy;
  readonly supportsMultipleSystemMessages: boolean;
  readonly supportsTemperature?: boolean;
  readonly supportsTopP?: boolean;
  readonly supportsTopK?: boolean;
  readonly supportsSeed?: boolean;
  readonly supportsFrequencyPenalty?: boolean;
  readonly supportsPresencePenalty?: boolean;
  readonly maxStopSequences?: number;
}

type SystemMessageStrategy =
  | 'separate-parameter'  // System in dedicated field (Anthropic, Gemini)
  | 'in-messages'         // System in message array (OpenAI, Ollama)
  | 'prepend-user'        // Prepended to first user message
  | 'not-supported';      // No system message support
```

**Example:**

```typescript
const openaiCapabilities: IRCapabilities = {
  streaming: true,
  multiModal: true,
  tools: true,
  maxContextTokens: 128000,
  supportedModels: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  systemMessageStrategy: 'in-messages',
  supportsMultipleSystemMessages: true,
  supportsTemperature: true,
  supportsTopP: true,
  supportsTopK: false,
  supportsSeed: true,
  supportsFrequencyPenalty: true,
  supportsPresencePenalty: true,
  maxStopSequences: 4
};
```

---

## Examples

### Simple Chat Request

```typescript
const request: IRChatRequest = {
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
  parameters: {
    model: 'gpt-4',
    temperature: 0.7
  },
  metadata: {
    requestId: 'req_001',
    timestamp: Date.now(),
    provenance: { frontend: 'openai' }
  }
};
```

### Multi-Turn Conversation

```typescript
const request: IRChatRequest = {
  messages: [
    {
      role: 'system',
      content: 'You are a helpful coding assistant.'
    },
    {
      role: 'user',
      content: 'How do I create a Promise in JavaScript?'
    },
    {
      role: 'assistant',
      content: 'You can create a Promise using the Promise constructor...'
    },
    {
      role: 'user',
      content: 'Can you show me an example with async/await?'
    }
  ],
  parameters: {
    model: 'claude-3-5-sonnet',
    temperature: 0.5,
    maxTokens: 2000
  },
  metadata: {
    requestId: 'req_002',
    timestamp: Date.now(),
    provenance: { frontend: 'anthropic' }
  }
};
```

### Multi-Modal Request with Image

```typescript
const request: IRChatRequest = {
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'What breed of dog is in this image?'
        },
        {
          type: 'image',
          source: {
            type: 'url',
            url: 'https://example.com/dog.jpg'
          }
        }
      ]
    }
  ],
  parameters: {
    model: 'gpt-4-vision',
    maxTokens: 500
  },
  metadata: {
    requestId: 'req_003',
    timestamp: Date.now(),
    provenance: { frontend: 'openai' }
  }
};
```

### Function Calling Request

```typescript
const request: IRChatRequest = {
  messages: [
    {
      role: 'user',
      content: 'What is the weather in Paris and Tokyo?'
    }
  ],
  tools: [
    {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name'
          },
          units: {
            type: 'string',
            enum: ['celsius', 'fahrenheit']
          }
        },
        required: ['location']
      }
    }
  ],
  toolChoice: 'auto',
  parameters: {
    model: 'gpt-4',
    temperature: 0.3
  },
  metadata: {
    requestId: 'req_004',
    timestamp: Date.now(),
    provenance: { frontend: 'openai' }
  }
};
```

### Response with Tool Calls

```typescript
const response: IRChatResponse = {
  message: {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_01ABC',
        name: 'get_weather',
        input: {
          location: 'Paris',
          units: 'celsius'
        }
      },
      {
        type: 'tool_use',
        id: 'toolu_02DEF',
        name: 'get_weather',
        input: {
          location: 'Tokyo',
          units: 'celsius'
        }
      }
    ]
  },
  finishReason: 'tool_calls',
  usage: {
    promptTokens: 125,
    completionTokens: 45,
    totalTokens: 170
  },
  metadata: {
    requestId: 'req_004',
    providerResponseId: 'chatcmpl-XYZ',
    timestamp: Date.now(),
    provenance: {
      frontend: 'openai',
      backend: 'anthropic'
    }
  }
};
```

### Tool Results and Follow-up

```typescript
const followUpRequest: IRChatRequest = {
  messages: [
    {
      role: 'user',
      content: 'What is the weather in Paris and Tokyo?'
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_01ABC',
          name: 'get_weather',
          input: { location: 'Paris', units: 'celsius' }
        }
      ]
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool_result',
          toolUseId: 'toolu_01ABC',
          content: 'Temperature: 18°C, Conditions: Partly cloudy'
        }
      ]
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_02DEF',
          name: 'get_weather',
          input: { location: 'Tokyo', units: 'celsius' }
        }
      ]
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool_result',
          toolUseId: 'toolu_02DEF',
          content: 'Temperature: 25°C, Conditions: Clear skies'
        }
      ]
    }
  ],
  parameters: {
    model: 'gpt-4'
  },
  metadata: {
    requestId: 'req_005',
    timestamp: Date.now(),
    provenance: { frontend: 'openai' }
  }
};
```

---

## TypeScript Definitions

All IR types are defined in `packages/ai.matey.types/src/ir.ts`.

For the complete, authoritative type definitions, refer to the source code:
- [ir.ts](../packages/ai.matey.types/src/ir.ts) - Core IR types
- [streaming.ts](../packages/ai.matey.types/src/streaming.ts) - Streaming configuration

---

## See Also

- [API Reference](./API.md) - Complete API documentation
- [Architecture Guide](../README.md#architecture) - System architecture overview
- [Type Definitions](../packages/ai.matey.types/readme.md) - TypeScript types package
