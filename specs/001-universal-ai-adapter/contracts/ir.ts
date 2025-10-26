/**
 * Intermediate Representation (IR) Type Definitions
 *
 * The Universal IR serves as the technology-agnostic schema for AI chat interactions.
 * All provider-specific formats are normalized to this representation.
 *
 * Design principles:
 * - Provider-agnostic: Can represent features from any supported AI provider
 * - Lossless where possible: Preserves semantic intent across translations
 * - Extensible: Supports provider-specific metadata without breaking core schema
 * - Type-safe: Uses discriminated unions and template literals for compile-time safety
 *
 * @example
 * ```typescript
 * const request: IRChatRequest = {
 *   messages: [
 *     { role: 'user', content: 'Hello, AI!' }
 *   ],
 *   parameters: {
 *     model: 'gpt-4',
 *     temperature: 0.7
 *   },
 *   metadata: {
 *     requestId: 'req_123',
 *     timestamp: Date.now()
 *   }
 * };
 * ```
 */

// ============================================================================
// Core Message Types
// ============================================================================

/**
 * Message roles in a conversation.
 * Uses const assertion for strict literal type checking.
 */
export const MessageRole = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;

export type MessageRole = typeof MessageRole[keyof typeof MessageRole];

/**
 * Content part types for multi-modal messages.
 */
export const ContentPartType = {
  TEXT: 'text',
  IMAGE: 'image',
} as const;

export type ContentPartType = typeof ContentPartType[keyof typeof ContentPartType];

/**
 * Text content part.
 */
export interface TextContentPart {
  readonly type: 'text';
  readonly text: string;
}

/**
 * Image content part with URL or base64 data.
 *
 * @example
 * ```typescript
 * // URL reference
 * const imageUrl: ImageContentPart = {
 *   type: 'image',
 *   source: {
 *     type: 'url',
 *     url: 'https://example.com/image.jpg'
 *   }
 * };
 *
 * // Base64 encoded
 * const imageBase64: ImageContentPart = {
 *   type: 'image',
 *   source: {
 *     type: 'base64',
 *     mediaType: 'image/jpeg',
 *     data: 'iVBORw0KGgoAAAANSUhEUgA...'
 *   }
 * };
 * ```
 */
export interface ImageContentPart {
  readonly type: 'image';
  readonly source:
    | { readonly type: 'url'; readonly url: string }
    | { readonly type: 'base64'; readonly mediaType: string; readonly data: string };
}

/**
 * Union of all content part types.
 * Discriminated by the `type` field for type safety.
 */
export type ContentPart = TextContentPart | ImageContentPart;

/**
 * Message content can be simple text or multi-part array.
 */
export type MessageContent = string | readonly ContentPart[];

/**
 * A single message in a conversation.
 *
 * Normalized representation that works across all providers:
 * - OpenAI: Direct mapping to messages array
 * - Anthropic: System messages extracted to separate parameter
 * - Gemini: System messages mapped to systemInstruction
 * - Chrome AI: System messages mapped to initialPrompts
 *
 * @example
 * ```typescript
 * // Simple text message
 * const userMsg: IRMessage = {
 *   role: 'user',
 *   content: 'What is the weather?'
 * };
 *
 * // Multi-modal message with image
 * const multiModalMsg: IRMessage = {
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
 * ```
 */
export interface IRMessage {
  readonly role: MessageRole;
  readonly content: MessageContent;
  /**
   * Provider-specific metadata that doesn't fit core schema.
   * Preserved during translation but may be ignored by target provider.
   */
  readonly metadata?: Record<string, unknown>;
}

// ============================================================================
// Request Parameters
// ============================================================================

/**
 * Sampling parameters for model generation.
 *
 * These parameters control the randomness and creativity of model outputs.
 * Semantic drift warnings are issued when values differ across providers:
 * - OpenAI temperature: 0-2
 * - Anthropic temperature: 0-1
 * - Gemini temperature: 0-1
 *
 * @example
 * ```typescript
 * const params: IRParameters = {
 *   model: 'gpt-4',
 *   temperature: 0.7,
 *   maxTokens: 1000,
 *   topP: 0.9,
 *   frequencyPenalty: 0.5
 * };
 * ```
 */
export interface IRParameters {
  /**
   * Model identifier. May be provider-specific.
   * Router uses this for model-aware backend selection.
   */
  readonly model?: string;

  /**
   * Sampling temperature (0-2 normalized range).
   * Lower = more deterministic, higher = more creative.
   * Adapters scale to provider-specific ranges.
   */
  readonly temperature?: number;

  /**
   * Maximum tokens to generate in response.
   * Different providers have different token counting methods.
   */
  readonly maxTokens?: number;

  /**
   * Nucleus sampling threshold (0-1).
   * Only tokens with cumulative probability up to topP are considered.
   */
  readonly topP?: number;

  /**
   * Top-K sampling limit.
   * Only the K most likely tokens are considered.
   * Not supported by all providers.
   */
  readonly topK?: number;

  /**
   * Frequency penalty (-2 to 2, normalized).
   * Reduces repetition by penalizing frequently used tokens.
   */
  readonly frequencyPenalty?: number;

  /**
   * Presence penalty (-2 to 2, normalized).
   * Encourages talking about new topics by penalizing tokens that have appeared.
   */
  readonly presencePenalty?: number;

  /**
   * Stop sequences that halt generation.
   * When encountered, generation stops and the stop sequence is not included.
   */
  readonly stopSequences?: readonly string[];

  /**
   * Provider-specific parameters that don't fit core schema.
   * Preserved through IR but may be ignored by adapters.
   */
  readonly custom?: Record<string, unknown>;
}

// ============================================================================
// Request & Response Types
// ============================================================================

/**
 * Metadata attached to requests and responses for tracing and debugging.
 *
 * @example
 * ```typescript
 * const metadata: IRMetadata = {
 *   requestId: 'req_abc123',
 *   timestamp: Date.now(),
 *   provenance: {
 *     frontend: 'anthropic',
 *     backend: 'openai'
 *   },
 *   semanticVersion: '1.0'
 * };
 * ```
 */
export interface IRMetadata {
  /**
   * Unique request identifier for tracing through the system.
   */
  readonly requestId: string;

  /**
   * Timestamp when request entered the system (milliseconds since epoch).
   */
  readonly timestamp: number;

  /**
   * Adapter provenance for debugging translation issues.
   */
  readonly provenance?: {
    readonly frontend?: string;
    readonly backend?: string;
  };

  /**
   * Semantic version marker for IR compatibility tracking.
   */
  readonly semanticVersion?: string;

  /**
   * Warnings about semantic drift or lossy conversions.
   */
  readonly warnings?: readonly string[];

  /**
   * Additional custom metadata.
   */
  readonly custom?: Record<string, unknown>;
}

/**
 * Universal chat completion request.
 *
 * This is the normalized format all frontend adapters produce
 * and all backend adapters consume.
 *
 * @example
 * ```typescript
 * const request: IRChatRequest = {
 *   messages: [
 *     { role: 'system', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: 'What is 2+2?' }
 *   ],
 *   parameters: {
 *     model: 'gpt-4',
 *     temperature: 0.7,
 *     maxTokens: 100
 *   },
 *   metadata: {
 *     requestId: crypto.randomUUID(),
 *     timestamp: Date.now()
 *   }
 * };
 * ```
 */
export interface IRChatRequest {
  /**
   * Conversation messages in chronological order.
   * System messages may be merged or repositioned by adapters.
   */
  readonly messages: readonly IRMessage[];

  /**
   * Model and sampling parameters.
   */
  readonly parameters?: IRParameters;

  /**
   * Request metadata for tracing and debugging.
   */
  readonly metadata: IRMetadata;

  /**
   * Whether to stream the response.
   * If true, backend should use streaming protocol.
   */
  readonly stream?: boolean;
}

/**
 * Finish reasons for chat completions.
 */
export const FinishReason = {
  /**
   * Model reached natural stopping point.
   */
  STOP: 'stop',

  /**
   * Hit maximum token limit.
   */
  LENGTH: 'length',

  /**
   * Content was filtered by safety systems.
   */
  CONTENT_FILTER: 'content_filter',

  /**
   * Request was cancelled by client.
   */
  CANCELLED: 'cancelled',

  /**
   * Error occurred during generation.
   */
  ERROR: 'error',
} as const;

export type FinishReason = typeof FinishReason[keyof typeof FinishReason];

/**
 * Token usage statistics for a completion.
 *
 * Different providers count tokens differently, so these are approximate.
 */
export interface TokenUsage {
  /**
   * Tokens in the input prompt.
   */
  readonly promptTokens: number;

  /**
   * Tokens generated in the completion.
   */
  readonly completionTokens: number;

  /**
   * Total tokens (prompt + completion).
   */
  readonly totalTokens: number;
}

/**
 * Universal chat completion response.
 *
 * Backend adapters normalize provider responses to this format.
 *
 * @example
 * ```typescript
 * const response: IRChatResponse = {
 *   message: {
 *     role: 'assistant',
 *     content: '2+2 equals 4.'
 *   },
 *   finishReason: 'stop',
 *   usage: {
 *     promptTokens: 20,
 *     completionTokens: 8,
 *     totalTokens: 28
 *   },
 *   metadata: {
 *     requestId: 'req_abc123',
 *     timestamp: Date.now(),
 *     provenance: {
 *       frontend: 'anthropic',
 *       backend: 'openai'
 *     }
 *   }
 * };
 * ```
 */
export interface IRChatResponse {
  /**
   * The generated assistant message.
   */
  readonly message: IRMessage;

  /**
   * Why generation stopped.
   */
  readonly finishReason: FinishReason;

  /**
   * Token usage statistics (if available from provider).
   */
  readonly usage?: TokenUsage;

  /**
   * Response metadata, including request ID for correlation.
   */
  readonly metadata: IRMetadata;

  /**
   * Provider-specific response data that doesn't fit core schema.
   */
  readonly custom?: Record<string, unknown>;
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Type of streaming chunk.
 */
export const StreamChunkType = {
  /**
   * Content delta (incremental text or content).
   */
  CONTENT: 'content',

  /**
   * Metadata update (usage, finish reason, etc.).
   */
  METADATA: 'metadata',

  /**
   * Stream completion marker.
   */
  DONE: 'done',
} as const;

export type StreamChunkType = typeof StreamChunkType[keyof typeof StreamChunkType];

/**
 * Content delta in a streaming response.
 *
 * @example
 * ```typescript
 * const chunk: ContentStreamChunk = {
 *   type: 'content',
 *   delta: 'Hello',
 *   sequence: 0,
 *   metadata: {
 *     requestId: 'req_abc123',
 *     timestamp: Date.now()
 *   }
 * };
 * ```
 */
export interface ContentStreamChunk {
  readonly type: 'content';

  /**
   * Incremental content to append to previous chunks.
   */
  readonly delta: string;

  /**
   * Sequence number for ordering (starts at 0).
   */
  readonly sequence: number;

  /**
   * Chunk metadata.
   */
  readonly metadata: IRMetadata;
}

/**
 * Metadata update during streaming.
 *
 * Sent when usage information or other metadata becomes available,
 * often at the end of the stream.
 */
export interface MetadataStreamChunk {
  readonly type: 'metadata';

  /**
   * Sequence number for ordering.
   */
  readonly sequence: number;

  /**
   * Updated usage information.
   */
  readonly usage?: TokenUsage;

  /**
   * Why generation stopped.
   */
  readonly finishReason?: FinishReason;

  /**
   * Chunk metadata.
   */
  readonly metadata: IRMetadata;
}

/**
 * Final chunk indicating stream completion.
 *
 * Always the last chunk in a stream, even if error occurred.
 */
export interface DoneStreamChunk {
  readonly type: 'done';

  /**
   * Sequence number (should be highest).
   */
  readonly sequence: number;

  /**
   * Final usage statistics.
   */
  readonly usage?: TokenUsage;

  /**
   * Why generation stopped.
   */
  readonly finishReason: FinishReason;

  /**
   * Chunk metadata.
   */
  readonly metadata: IRMetadata;

  /**
   * Complete accumulated message.
   */
  readonly message?: IRMessage;
}

/**
 * Union of all stream chunk types.
 * Discriminated by the `type` field for type safety.
 */
export type IRStreamChunk = ContentStreamChunk | MetadataStreamChunk | DoneStreamChunk;

/**
 * Async iterator for streaming responses.
 *
 * @example
 * ```typescript
 * async function consumeStream(stream: IRChatStream) {
 *   for await (const chunk of stream) {
 *     if (chunk.type === 'content') {
 *       process.stdout.write(chunk.delta);
 *     } else if (chunk.type === 'done') {
 *       console.log('\nStream complete:', chunk.finishReason);
 *     }
 *   }
 * }
 * ```
 */
export type IRChatStream = AsyncGenerator<IRStreamChunk, void, undefined>;

// ============================================================================
// Capability Metadata
// ============================================================================

/**
 * Declares adapter capabilities for routing and compatibility checking.
 *
 * Used by router to make intelligent backend selection decisions
 * and to warn developers about unsupported features.
 *
 * @example
 * ```typescript
 * const capabilities: IRCapabilities = {
 *   streaming: true,
 *   multiModal: true,
 *   maxContextTokens: 128000,
 *   supportedModels: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
 *   systemMessageStrategy: 'in-messages',
 *   supportsMultipleSystemMessages: true
 * };
 * ```
 */
export interface IRCapabilities {
  /**
   * Supports streaming responses.
   */
  readonly streaming: boolean;

  /**
   * Supports multi-modal content (text + images).
   */
  readonly multiModal: boolean;

  /**
   * Maximum context window in tokens.
   */
  readonly maxContextTokens?: number;

  /**
   * List of model identifiers this adapter supports.
   */
  readonly supportedModels: readonly string[];

  /**
   * How system messages are handled.
   * - 'in-messages': System messages in messages array (OpenAI)
   * - 'separate-parameter': System parameter separate from messages (Anthropic)
   * - 'system-instruction': systemInstruction field (Gemini)
   * - 'initial-prompts': initialPrompts array (Chrome AI)
   */
  readonly systemMessageStrategy:
    | 'in-messages'
    | 'separate-parameter'
    | 'system-instruction'
    | 'initial-prompts';

  /**
   * Whether provider supports multiple system messages.
   * If false, adapter must merge multiple system messages.
   */
  readonly supportsMultipleSystemMessages: boolean;

  /**
   * Temperature range for this provider.
   */
  readonly temperatureRange?: {
    readonly min: number;
    readonly max: number;
  };

  /**
   * Additional provider-specific capabilities.
   */
  readonly custom?: Record<string, unknown>;
}

// ============================================================================
// Semantic Transform Tracking
// ============================================================================

/**
 * Documents a parameter transformation that may alter semantic meaning.
 *
 * Used for transparency when adapters must scale, clamp, or approximate
 * values due to provider differences.
 *
 * @example
 * ```typescript
 * const transform: SemanticTransform = {
 *   parameter: 'temperature',
 *   originalValue: 1.5,
 *   transformedValue: 0.75,
 *   reason: 'Scaled from OpenAI range (0-2) to Anthropic range (0-1)',
 *   fidelity: 'approximate'
 * };
 * ```
 */
export interface SemanticTransform {
  /**
   * Parameter name that was transformed.
   */
  readonly parameter: string;

  /**
   * Original value from source format.
   */
  readonly originalValue: unknown;

  /**
   * Transformed value for target format.
   */
  readonly transformedValue: unknown;

  /**
   * Human-readable explanation of the transformation.
   */
  readonly reason: string;

  /**
   * Semantic fidelity level:
   * - 'lossless': Perfect semantic preservation
   * - 'approximate': May produce slightly different behavior
   * - 'lossy': Significant semantic change or feature unsupported
   */
  readonly fidelity: 'lossless' | 'approximate' | 'lossy';
}

/**
 * Collection of semantic transforms for a request.
 *
 * Attached to metadata.warnings for developer visibility.
 */
export interface SemanticTransforms {
  readonly transforms: readonly SemanticTransform[];
  readonly summary: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if content is multi-part.
 */
export function isMultiPartContent(content: MessageContent): content is readonly ContentPart[] {
  return Array.isArray(content);
}

/**
 * Type guard to check if chunk is content delta.
 */
export function isContentChunk(chunk: IRStreamChunk): chunk is ContentStreamChunk {
  return chunk.type === 'content';
}

/**
 * Type guard to check if chunk is metadata update.
 */
export function isMetadataChunk(chunk: IRStreamChunk): chunk is MetadataStreamChunk {
  return chunk.type === 'metadata';
}

/**
 * Type guard to check if chunk is stream completion.
 */
export function isDoneChunk(chunk: IRStreamChunk): chunk is DoneStreamChunk {
  return chunk.type === 'done';
}
