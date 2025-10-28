/**
 * Intermediate Representation (IR) Types
 *
 * The IR is the universal format that sits between frontend and backend adapters.
 * It represents chat requests, responses, and streams in a normalized, provider-agnostic way.
 *
 * Design principles:
 * - Provider-agnostic: No provider-specific fields in core types
 * - Extensible: Support for metadata and custom fields
 * - Type-safe: Use discriminated unions for runtime type checking
 * - Stream-friendly: First-class support for streaming responses
 *
 * @module
 */

import type { StreamMode } from './streaming.js';

// ============================================================================
// Message Types
// ============================================================================

/**
 * Message role in a conversation.
 *
 * Maps to roles across all major providers:
 * - system: Initial instructions/context (some providers use special parameter)
 * - user: Messages from the user
 * - assistant: Messages from the AI
 * - tool: Results from tool/function calls
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Text content block.
 */
export interface TextContent {
  readonly type: 'text';
  readonly text: string;
}

/**
 * Image content block.
 *
 * Supports both URLs and base64-encoded images.
 *
 * @example
 * ```typescript
 * // Image from URL
 * const imageUrl: ImageContent = {
 *   type: 'image',
 *   source: {
 *     type: 'url',
 *     url: 'https://example.com/image.jpg'
 *   }
 * };
 *
 * // Base64 image
 * const imageBase64: ImageContent = {
 *   type: 'image',
 *   source: {
 *     type: 'base64',
 *     mediaType: 'image/jpeg',
 *     data: 'iVBORw0KGgo...'
 *   }
 * };
 * ```
 */
export interface ImageContent {
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

/**
 * Tool use request (AI wants to call a tool).
 */
export interface ToolUseContent {
  readonly type: 'tool_use';
  readonly id: string;
  readonly name: string;
  readonly input: Record<string, unknown>;
}

/**
 * Tool result (response from tool execution).
 */
export interface ToolResultContent {
  readonly type: 'tool_result';
  readonly toolUseId: string;
  readonly content: string | TextContent[];
  readonly isError?: boolean;
}

/**
 * Union of all content types.
 *
 * Uses discriminated union pattern for type-safe content handling.
 */
export type MessageContent = TextContent | ImageContent | ToolUseContent | ToolResultContent;

/**
 * A message in the conversation.
 *
 * Messages can have either simple string content or structured content blocks.
 * The IR normalizes both formats into a consistent representation.
 *
 * @example
 * ```typescript
 * // Simple text message
 * const textMessage: IRMessage = {
 *   role: 'user',
 *   content: 'Hello, AI!'
 * };
 *
 * // Multi-modal message with image
 * const multiModalMessage: IRMessage = {
 *   role: 'user',
 *   content: [
 *     { type: 'text', text: 'What is in this image?' },
 *     {
 *       type: 'image',
 *       source: {
 *         type: 'url',
 *         url: 'https://example.com/photo.jpg'
 *       }
 *     }
 *   ]
 * };
 *
 * // System message
 * const systemMessage: IRMessage = {
 *   role: 'system',
 *   content: 'You are a helpful assistant.'
 * };
 * ```
 */
export interface IRMessage {
  /**
   * Message role (system, user, assistant, tool).
   */
  readonly role: MessageRole;

  /**
   * Message content.
   * Can be a simple string or array of content blocks.
   */
  readonly content: string | readonly MessageContent[];

  /**
   * Optional message name/identifier.
   * Used for tool messages or multi-user scenarios.
   */
  readonly name?: string;

  /**
   * Provider-specific metadata.
   * Stored but not processed by IR.
   */
  readonly metadata?: Record<string, unknown>;
}

// ============================================================================
// Tool/Function Definitions
// ============================================================================

/**
 * JSON Schema type definitions.
 */
export type JSONSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

/**
 * JSON Schema for tool parameters.
 *
 * Simplified schema supporting common validation patterns.
 */
export interface JSONSchema {
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

/**
 * Tool/function definition.
 *
 * Describes a tool that the AI can call.
 *
 * @example
 * ```typescript
 * const weatherTool: IRTool = {
 *   name: 'get_weather',
 *   description: 'Get current weather for a location',
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       location: {
 *         type: 'string',
 *         description: 'City name or coordinates'
 *       },
 *       units: {
 *         type: 'string',
 *         enum: ['celsius', 'fahrenheit'],
 *         default: 'celsius'
 *       }
 *     },
 *     required: ['location']
 *   }
 * };
 * ```
 */
export interface IRTool {
  /**
   * Tool name (must be valid identifier).
   */
  readonly name: string;

  /**
   * Human-readable description of what the tool does.
   */
  readonly description: string;

  /**
   * JSON Schema for tool parameters.
   */
  readonly parameters: JSONSchema;

  /**
   * Provider-specific tool configuration.
   */
  readonly metadata?: Record<string, unknown>;
}

// ============================================================================
// Request Parameters
// ============================================================================

/**
 * Normalized request parameters.
 *
 * Common parameters across all providers, normalized to consistent ranges.
 * Provider-specific parameters can be added to `custom` field.
 *
 * @example
 * ```typescript
 * const params: IRParameters = {
 *   model: 'gpt-4',
 *   temperature: 0.7,
 *   maxTokens: 1000,
 *   topP: 0.9,
 *   frequencyPenalty: 0.0,
 *   presencePenalty: 0.0,
 *   stopSequences: ['\n\n', 'END']
 * };
 * ```
 */
export interface IRParameters {
  /**
   * Model identifier.
   * Provider-specific model name.
   */
  readonly model?: string;

  /**
   * Sampling temperature (0.0 to 2.0).
   * Higher values make output more random.
   * @default 0.7
   */
  readonly temperature?: number;

  /**
   * Maximum tokens to generate.
   * Actual limit depends on model and provider.
   */
  readonly maxTokens?: number;

  /**
   * Nucleus sampling threshold (0.0 to 1.0).
   * Alternative to temperature.
   */
  readonly topP?: number;

  /**
   * Top-K sampling limit.
   * Only consider top K tokens.
   */
  readonly topK?: number;

  /**
   * Frequency penalty (-2.0 to 2.0).
   * Penalize tokens based on frequency in text so far.
   */
  readonly frequencyPenalty?: number;

  /**
   * Presence penalty (-2.0 to 2.0).
   * Penalize tokens based on whether they appear in text so far.
   */
  readonly presencePenalty?: number;

  /**
   * Stop sequences.
   * Generation stops when any sequence is encountered.
   */
  readonly stopSequences?: readonly string[];

  /**
   * Random seed for deterministic generation.
   */
  readonly seed?: number;

  /**
   * User identifier for abuse monitoring.
   */
  readonly user?: string;

  /**
   * Provider-specific parameters.
   * Passed through to backend without modification.
   */
  readonly custom?: Record<string, unknown>;
}

// ============================================================================
// Capabilities
// ============================================================================

/**
 * System message handling strategy.
 */
export type SystemMessageStrategy = 'separate-parameter' | 'in-messages' | 'prepend-user' | 'not-supported';

/**
 * Adapter capabilities metadata.
 *
 * Describes what an adapter supports for routing and validation.
 *
 * @example
 * ```typescript
 * const openaiCapabilities: IRCapabilities = {
 *   streaming: true,
 *   multiModal: true,
 *   tools: true,
 *   maxContextTokens: 128000,
 *   supportedModels: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
 *   systemMessageStrategy: 'in-messages',
 *   supportsMultipleSystemMessages: true,
 *   supportsTemperature: true,
 *   supportsTopP: true,
 *   supportsTopK: false,
 *   supportsSeed: true
 * };
 * ```
 */
export interface IRCapabilities {
  /**
   * Supports streaming responses.
   */
  readonly streaming: boolean;

  /**
   * Supports multi-modal content (images, etc.).
   */
  readonly multiModal: boolean;

  /**
   * Supports tool/function calling.
   */
  readonly tools?: boolean;

  /**
   * Maximum context window size (tokens).
   */
  readonly maxContextTokens?: number;

  /**
   * List of supported model identifiers.
   */
  readonly supportedModels?: readonly string[];

  /**
   * How system messages are handled.
   */
  readonly systemMessageStrategy: SystemMessageStrategy;

  /**
   * Supports multiple system messages.
   */
  readonly supportsMultipleSystemMessages: boolean;

  /**
   * Supports temperature parameter.
   */
  readonly supportsTemperature?: boolean;

  /**
   * Supports topP parameter.
   */
  readonly supportsTopP?: boolean;

  /**
   * Supports topK parameter.
   */
  readonly supportsTopK?: boolean;

  /**
   * Supports seed parameter.
   */
  readonly supportsSeed?: boolean;

  /**
   * Supports frequency penalty.
   */
  readonly supportsFrequencyPenalty?: boolean;

  /**
   * Supports presence penalty.
   */
  readonly supportsPresencePenalty?: boolean;

  /**
   * Maximum number of stop sequences.
   */
  readonly maxStopSequences?: number;
}

// ============================================================================
// Metadata
// ============================================================================

/**
 * Warning severity levels.
 */
export type WarningSeverity = 'info' | 'warning' | 'error';

/**
 * Warning categories for semantic drift and compatibility issues.
 */
export type WarningCategory =
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

/**
 * Semantic drift warning.
 *
 * Documents transformations and compatibility issues that occur
 * when converting between provider formats.
 *
 * @example
 * ```typescript
 * const warning: IRWarning = {
 *   category: 'parameter-normalized',
 *   severity: 'info',
 *   message: 'Temperature normalized from 0-2 range to 0-1 range',
 *   field: 'temperature',
 *   originalValue: 1.5,
 *   transformedValue: 0.75,
 *   source: 'openai-backend'
 * };
 * ```
 */
export interface IRWarning {
  /**
   * Warning category.
   */
  readonly category: WarningCategory;

  /**
   * Severity level.
   */
  readonly severity: WarningSeverity;

  /**
   * Human-readable warning message.
   */
  readonly message: string;

  /**
   * Field or parameter that caused the warning.
   */
  readonly field?: string;

  /**
   * Original value before transformation.
   */
  readonly originalValue?: unknown;

  /**
   * Transformed value after normalization.
   */
  readonly transformedValue?: unknown;

  /**
   * Source adapter that generated the warning.
   */
  readonly source?: string;

  /**
   * Additional context or details.
   */
  readonly details?: Record<string, unknown>;
}

/**
 * Provenance tracking for request/response chain.
 */
export interface IRProvenance {
  /**
   * Frontend adapter name.
   */
  readonly frontend?: string;

  /**
   * Backend adapter name.
   */
  readonly backend?: string;

  /**
   * Middleware chain (in order of execution).
   */
  readonly middleware?: readonly string[];

  /**
   * Router name (if applicable).
   */
  readonly router?: string;
}

/**
 * Request/response metadata.
 *
 * Tracks provenance, timing, warnings, and custom metadata throughout the adapter chain.
 *
 * @example
 * ```typescript
 * const metadata: IRMetadata = {
 *   requestId: 'req_abc123',
 *   timestamp: Date.now(),
 *   provenance: {
 *     frontend: 'anthropic',
 *     backend: 'openai',
 *     middleware: ['logging', 'caching']
 *   },
 *   warnings: [
 *     {
 *       category: 'parameter-normalized',
 *       severity: 'info',
 *       message: 'Temperature scaled from 0-2 to 0-1 range',
 *       field: 'temperature'
 *     }
 *   ],
 *   custom: {
 *     userId: 'user_123',
 *     sessionId: 'session_456'
 *   }
 * };
 * ```
 */
export interface IRMetadata {
  /**
   * Unique request identifier.
   * Generated by the client (frontend adapter or Bridge).
   * Stable across retries and fallbacks for correlation.
   */
  readonly requestId: string;

  /**
   * Provider's response identifier.
   * Set by backend adapter from the provider's actual response ID.
   * Examples: OpenAI's "chatcmpl-xxx", Anthropic's "msg_xxx".
   * Useful for correlating with provider logs and billing.
   */
  readonly providerResponseId?: string;

  /**
   * Request timestamp (milliseconds since epoch).
   */
  readonly timestamp: number;

  /**
   * Adapter chain provenance.
   */
  readonly provenance?: IRProvenance;

  /**
   * Semantic drift warnings collected during processing.
   * Documents any transformations or compatibility issues.
   */
  readonly warnings?: readonly IRWarning[];

  /**
   * Custom metadata fields.
   * Can be used by middleware or application code.
   */
  readonly custom?: Record<string, unknown>;
}

// ============================================================================
// Structured Output Schema
// ============================================================================

/**
 * Extraction modes for structured output.
 *
 * Different strategies for extracting structured data from LLMs.
 */
export type ExtractionMode =
  | 'tools'       // Function/tool calling (most reliable)
  | 'json'        // JSON response format mode
  | 'md_json'     // Extract from markdown code blocks
  | 'json_schema'; // JSON schema mode (OpenAI-specific)

/**
 * Schema information for structured output.
 *
 * Used to carry schema information through the IR adapter pipeline.
 * Enables structured data extraction with validation across all providers.
 *
 * @since 0.2.0
 */
export interface IRSchema {
  /**
   * Schema type identifier.
   */
  type: 'zod' | 'json-schema';

  /**
   * The actual schema object.
   * - For 'zod': Zod schema instance
   * - For 'json-schema': JSON Schema object
   */
  schema: any;

  /**
   * Extraction mode preference.
   *
   * Backend adapters should honor this when possible.
   * @default 'tools'
   */
  mode?: ExtractionMode;

  /**
   * Schema name (for tool calling).
   * @default 'extract'
   */
  name?: string;

  /**
   * Schema description.
   *
   * Used to guide the model when generating structured data.
   */
  description?: string;

  /**
   * Whether to validate the response against the schema.
   *
   * When true, backend adapters should validate responses
   * and add warnings to metadata if validation fails.
   *
   * @default true
   */
  validate?: boolean;
}

// ============================================================================
// Chat Request
// ============================================================================

/**
 * Universal chat completion request.
 *
 * This is the normalized format that all frontend adapters convert to
 * and all backend adapters consume.
 *
 * @example
 * ```typescript
 * const request: IRChatRequest = {
 *   messages: [
 *     { role: 'system', content: 'You are helpful.' },
 *     { role: 'user', content: 'Hello!' }
 *   ],
 *   parameters: {
 *     model: 'gpt-4',
 *     temperature: 0.7,
 *     maxTokens: 1000
 *   },
 *   metadata: {
 *     requestId: 'req_abc123',
 *     timestamp: Date.now(),
 *     provenance: {
 *       frontend: 'openai'
 *     }
 *   },
 *   stream: false
 * };
 * ```
 */
export interface IRChatRequest {
  /**
   * Conversation messages.
   * Must contain at least one message.
   */
  readonly messages: readonly IRMessage[];

  /**
   * Tool/function definitions.
   * Optional, for function calling.
   */
  readonly tools?: readonly IRTool[];

  /**
   * Tool choice strategy.
   * - 'auto': Model decides whether to call tools
   * - 'required': Model must call a tool
   * - 'none': Model cannot call tools
   * - { name: string }: Force specific tool
   */
  readonly toolChoice?: 'auto' | 'required' | 'none' | { readonly name: string };

  /**
   * Request parameters.
   */
  readonly parameters?: IRParameters;

  /**
   * Request metadata.
   */
  readonly metadata: IRMetadata;

  /**
   * Whether to stream the response.
   * @default false
   */
  readonly stream?: boolean;

  /**
   * Preferred streaming mode (hint to backend).
   *
   * - `delta`: Request incremental chunks only (most efficient)
   * - `accumulated`: Request full accumulated text in each chunk
   *
   * This is a preference hint - backends may choose to:
   * - Provide only delta (always safe, universal)
   * - Provide both delta and accumulated (maximum flexibility)
   * - Provide only accumulated (if that's native format)
   *
   * Frontends and wrappers can convert between modes as needed.
   *
   * @default 'delta'
   */
  readonly streamMode?: StreamMode;

  /**
   * Optional schema for structured output.
   *
   * When provided, the backend should attempt to return
   * structured data matching the schema. Backends implement
   * this via:
   * - Tool calling (most providers)
   * - JSON mode (OpenAI, some others)
   * - Prompt engineering (fallback)
   *
   * The schema can be a Zod schema or JSON Schema object.
   * Backends should validate responses when validate flag is true.
   *
   * @since 0.2.0
   *
   * @example
   * ```typescript
   * import { z } from 'zod'
   *
   * const request: IRChatRequest = {
   *   messages: [{ role: 'user', content: 'Extract user...' }],
   *   schema: {
   *     type: 'zod',
   *     schema: z.object({ name: z.string(), age: z.number() }),
   *     mode: 'tools',
   *     validate: true
   *   },
   *   // ... other fields
   * }
   * ```
   */
  readonly schema?: IRSchema;
}

// ============================================================================
// Chat Response
// ============================================================================

/**
 * Finish reason for generation.
 */
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' | 'cancelled';

/**
 * Token usage statistics.
 */
export interface IRUsage {
  /**
   * Tokens in the prompt.
   */
  readonly promptTokens: number;

  /**
   * Tokens in the completion.
   */
  readonly completionTokens: number;

  /**
   * Total tokens (prompt + completion).
   */
  readonly totalTokens: number;

  /**
   * Provider-specific usage details.
   */
  readonly details?: Record<string, unknown>;
}

/**
 * Universal chat completion response.
 *
 * Normalized format that all backend adapters convert to
 * and all frontend adapters consume.
 *
 * @example
 * ```typescript
 * const response: IRChatResponse = {
 *   message: {
 *     role: 'assistant',
 *     content: 'Hello! How can I help you today?'
 *   },
 *   finishReason: 'stop',
 *   usage: {
 *     promptTokens: 15,
 *     completionTokens: 10,
 *     totalTokens: 25
 *   },
 *   metadata: {
 *     requestId: 'req_abc123',
 *     timestamp: Date.now(),
 *     provenance: {
 *       frontend: 'openai',
 *       backend: 'openai'
 *     }
 *   }
 * };
 * ```
 */
export interface IRChatResponse {
  /**
   * Generated message from the assistant.
   */
  readonly message: IRMessage;

  /**
   * Why generation finished.
   */
  readonly finishReason: FinishReason;

  /**
   * Token usage statistics.
   */
  readonly usage?: IRUsage;

  /**
   * Response metadata.
   * Includes original request metadata plus backend provenance.
   */
  readonly metadata: IRMetadata;

  /**
   * Provider-specific response data.
   */
  readonly raw?: Record<string, unknown>;
}

// ============================================================================
// Streaming
// ============================================================================

/**
 * Stream chunk types.
 */
export type StreamChunkType = 'start' | 'content' | 'tool_use' | 'metadata' | 'done' | 'error';

/**
 * Base stream chunk interface.
 */
export interface BaseStreamChunk {
  readonly type: StreamChunkType;
  readonly sequence: number;
}

/**
 * Start of stream chunk.
 */
export interface StreamStartChunk extends BaseStreamChunk {
  readonly type: 'start';
  readonly metadata: IRMetadata;
}

/**
 * Content chunk with flexible streaming support.
 *
 * Supports both delta (incremental) and accumulated (full text) streaming modes:
 *
 * **Delta Mode (default):**
 * - `delta` contains only the new text generated in this chunk
 * - Consumers must accumulate deltas to get full text
 * - Most efficient for network and memory
 *
 * **Accumulated Mode (optional):**
 * - `accumulated` contains all text generated so far
 * - Each chunk has the complete text up to that point
 * - Useful for UIs that want to replace text (Chrome AI style)
 *
 * **Backward Compatibility:**
 * - `delta` is ALWAYS present (universal standard)
 * - `accumulated` is optional (provided when backend configured for it)
 *
 * @example
 * ```typescript
 * // Delta-only chunk (standard)
 * { type: 'content', delta: ' world', sequence: 2 }
 *
 * // With both formats (configured backend)
 * { type: 'content', delta: ' world', accumulated: 'Hello world', sequence: 2 }
 * ```
 */
export interface StreamContentChunk extends BaseStreamChunk {
  readonly type: 'content';

  /**
   * Incremental text delta (new content only).
   * ALWAYS present for maximum compatibility.
   * Contains only the text generated in this chunk.
   */
  readonly delta: string;

  /**
   * Accumulated text (full content so far).
   * Optional - provided when backend is configured for accumulated mode.
   * Contains all text generated from the start up to and including this chunk.
   */
  readonly accumulated?: string;

  readonly role?: 'assistant';
}

/**
 * Tool use chunk.
 */
export interface StreamToolUseChunk extends BaseStreamChunk {
  readonly type: 'tool_use';
  readonly id: string;
  readonly name: string;
  readonly inputDelta?: string;
}

/**
 * Metadata chunk (usage, etc.).
 */
export interface StreamMetadataChunk extends BaseStreamChunk {
  readonly type: 'metadata';
  readonly usage?: Partial<IRUsage>;
  readonly metadata?: Partial<IRMetadata>;
}

/**
 * Done chunk (end of stream).
 */
export interface StreamDoneChunk extends BaseStreamChunk {
  readonly type: 'done';
  readonly finishReason: FinishReason;
  readonly usage?: IRUsage;
  readonly message?: IRMessage;
}

/**
 * Error chunk.
 */
export interface StreamErrorChunk extends BaseStreamChunk {
  readonly type: 'error';
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
}

/**
 * Union of all stream chunk types.
 *
 * Uses discriminated union for type-safe chunk handling.
 */
export type IRStreamChunk =
  | StreamStartChunk
  | StreamContentChunk
  | StreamToolUseChunk
  | StreamMetadataChunk
  | StreamDoneChunk
  | StreamErrorChunk;

/**
 * Async generator for streaming responses.
 *
 * Yields IR stream chunks as they arrive from the backend.
 *
 * @example
 * ```typescript
 * async function processStream(stream: IRChatStream) {
 *   for await (const chunk of stream) {
 *     switch (chunk.type) {
 *       case 'start':
 *         console.log('Stream started:', chunk.metadata.requestId);
 *         break;
 *       case 'content':
 *         process.stdout.write(chunk.delta);
 *         break;
 *       case 'done':
 *         console.log('\nStream finished:', chunk.finishReason);
 *         break;
 *       case 'error':
 *         console.error('Stream error:', chunk.error.message);
 *         break;
 *     }
 *   }
 * }
 * ```
 */
export type IRChatStream = AsyncGenerator<IRStreamChunk, void, undefined>;
