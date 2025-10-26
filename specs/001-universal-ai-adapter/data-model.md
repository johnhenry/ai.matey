# Data Model: Universal AI Adapter System

**Feature Branch**: `001-universal-ai-adapter`
**Created**: 2025-10-13
**Status**: Draft
**Version**: 1.0.0

## Table of Contents

1. [Introduction](#introduction)
2. [Universal IR Types](#universal-ir-types)
3. [Adapter Interfaces](#adapter-interfaces)
4. [Bridge Class](#bridge-class)
5. [Router Class](#router-class)
6. [Middleware Interface](#middleware-interface)
7. [Capability Metadata](#capability-metadata)
8. [Error Types](#error-types)
9. [Configuration Types](#configuration-types)
10. [Type Relationships](#type-relationships)
11. [State Transitions](#state-transitions)
12. [Invariants](#invariants)
13. [Validation Rules](#validation-rules)

---

## Introduction

This document defines the complete data model for the Universal AI Adapter System. All types use TypeScript 5.0+ features including discriminated unions, template literal types, and const type parameters for maximum type safety.

**Design Principles**:
- All messages flow through a universal Intermediate Representation (IR)
- Adapters are responsible for provider-specific translations
- Type safety prevents incompatible adapter combinations at compile time
- Semantic drift is tracked and surfaced through metadata

---

## Universal IR Types

### UniversalMessage

Represents a single conversation turn with role, content, and metadata.

```typescript
interface UniversalMessage {
  /**
   * Message role using discriminated union
   *
   * Validation:
   * - MUST be one of: 'system' | 'user' | 'assistant' | 'tool'
   * - System messages SHOULD appear at start of conversation
   * - Roles MUST alternate between user and assistant in conversation flow
   */
  role: MessageRole;

  /**
   * Message content - can be simple text or multi-part
   *
   * Validation:
   * - If string: MUST NOT be empty
   * - If array: MUST contain at least one part
   * - Multi-part content MUST be validated by type
   */
  content: MessageContent;

  /**
   * Optional identifier for tool calls or named entities
   *
   * Validation:
   * - REQUIRED when role is 'tool'
   * - MUST match a tool_use_id in previous messages for tool results
   */
  name?: string;

  /**
   * Provider-specific metadata that doesn't fit core schema
   * Used for passthrough of non-universal features
   */
  metadata?: Record<string, unknown>;
}

/**
 * Message role enumeration
 * Const assertion preserves literal types
 */
type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Message content - discriminated union of string or multi-part
 */
type MessageContent =
  | string
  | MessagePart[];

/**
 * Multi-part message content (for multimodal inputs)
 * Discriminated union enables type narrowing
 */
type MessagePart =
  | TextPart
  | ImagePart
  | ToolUsePart
  | ToolResultPart;

interface TextPart {
  type: 'text';
  /**
   * Text content
   * Validation: MUST NOT be empty
   */
  text: string;
}

interface ImagePart {
  type: 'image';
  /**
   * Image source - URL or base64
   * Validation: Source type MUST be valid
   */
  source: ImageSource;
}

interface ToolUsePart {
  type: 'tool_use';
  /**
   * Unique identifier for this tool call
   * Validation: MUST be unique within conversation
   */
  id: string;
  /**
   * Tool function name
   * Validation: MUST match a tool definition if tools provided
   */
  name: string;
  /**
   * Tool input parameters (JSON-serializable)
   * Validation: MUST match tool schema if defined
   */
  input: unknown;
}

interface ToolResultPart {
  type: 'tool_result';
  /**
   * ID of the tool_use this responds to
   * Validation: MUST reference a previous tool_use
   */
  tool_use_id: string;
  /**
   * Result content from tool execution
   * Validation: MUST NOT be empty
   */
  content: string;
}

type ImageSource =
  | URLImageSource
  | Base64ImageSource;

interface URLImageSource {
  type: 'url';
  /**
   * Public URL to image
   * Validation: MUST be valid HTTP/HTTPS URL
   */
  url: string;
}

interface Base64ImageSource {
  type: 'base64';
  /**
   * MIME type (e.g., 'image/png', 'image/jpeg')
   * Validation: MUST be valid image MIME type
   */
  media_type: string;
  /**
   * Base64-encoded image data (without data: prefix)
   * Validation: MUST be valid base64
   */
  data: string;
}
```

**Relationships**:
- `UniversalMessage` is contained in `UniversalChatRequest.messages[]`
- `UniversalMessage` is the result in `UniversalChatResponse.message`
- `MessagePart` enables multimodal and tool-calling capabilities

**State Transitions**:
- Messages are immutable once created
- Tool use messages MUST be followed by tool result messages
- Assistant messages with tool calls await tool results before continuation

---

### UniversalChatRequest

The universal request format representing a chat completion request.

```typescript
interface UniversalChatRequest {
  /**
   * Model identifier (provider-specific, passed through)
   *
   * Examples: "gpt-4", "claude-3-opus-20240229", "gemini-pro"
   *
   * Validation:
   * - MUST NOT be empty
   * - Backend adapter MUST validate model availability
   */
  model: string;

  /**
   * Conversation messages including system messages
   *
   * System messages SHOULD have role='system'
   * Adapters handle provider-specific system message placement
   *
   * Validation:
   * - MUST contain at least one message
   * - MUST NOT be empty array
   * - SHOULD alternate between user/assistant (flexible for system)
   * - System messages CAN appear anywhere, adapters reorder if needed
   */
  messages: UniversalMessage[];

  /**
   * Temperature controls randomness
   * Normalized range: 0.0 to 1.0
   *
   * Validation:
   * - IF provided, MUST be >= 0.0 AND <= 1.0
   * - Adapters scale to provider-specific ranges with warnings
   */
  temperature?: number;

  /**
   * Maximum tokens to generate in completion
   *
   * Validation:
   * - IF provided, MUST be > 0
   * - Backend adapter MUST check against model limits
   * - Note: Some providers count differently (completion vs total)
   */
  maxTokens?: number;

  /**
   * Top-p sampling (nucleus sampling)
   *
   * Validation:
   * - IF provided, MUST be >= 0.0 AND <= 1.0
   * - SHOULD NOT be used together with temperature (provider-dependent)
   */
  topP?: number;

  /**
   * Sequences where generation should stop
   *
   * Validation:
   * - Each sequence MUST NOT be empty
   * - Some providers have limits (e.g., Anthropic: max 4)
   */
  stopSequences?: string[];

  /**
   * Enable streaming responses
   *
   * Validation:
   * - Backend MUST check capabilities.supportsStreaming
   */
  stream?: boolean;

  /**
   * Tool/function definitions for tool-calling models
   *
   * Validation:
   * - Each tool MUST have unique name
   * - Backend MUST check capabilities.supportsTools
   */
  tools?: UniversalTool[];

  /**
   * Control tool usage behavior
   *
   * Validation:
   * - IF tools not provided, MUST be undefined
   * - IF type='tool', name MUST reference defined tool
   */
  toolChoice?: ToolChoice;

  /**
   * Request metadata for tracing and debugging
   */
  metadata?: RequestMetadata;

  /**
   * Provider-specific parameters (escape hatch)
   * Backend adapters MAY use these for passthrough
   *
   * Note: Using provider hints bypasses normalization
   */
  providerHints?: ProviderHints;
}

/**
 * Tool choice configuration
 */
type ToolChoice =
  | 'auto'    // Model decides whether to use tools
  | 'none'    // Never use tools
  | { type: 'tool'; name: string };  // Force specific tool

/**
 * Tool definition (OpenAI/Anthropic compatible schema)
 */
interface UniversalTool {
  /**
   * Tool type - always 'function' for now
   * Future: 'plugin', 'api', etc.
   */
  type: 'function';

  /**
   * Function definition
   */
  function: {
    /**
     * Function name - must be valid identifier
     * Validation: MUST match [a-zA-Z_][a-zA-Z0-9_]*
     */
    name: string;

    /**
     * Human-readable description
     */
    description?: string;

    /**
     * JSON Schema for function parameters
     * Validation: MUST be valid JSON Schema
     */
    parameters?: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/**
 * Request metadata for provenance and debugging
 */
interface RequestMetadata {
  /**
   * Unique request ID for tracing
   * Branded type prevents mixing with other IDs
   */
  requestId?: RequestId;

  /**
   * Frontend adapter that created this IR
   * Format: "frontend-{provider}"
   */
  frontendAdapter?: string;

  /**
   * Original frontend format version
   * Format: semver (e.g., "1.0.0")
   */
  frontendVersion?: string;

  /**
   * IR schema version
   * Format: semver (e.g., "1.0.0")
   * Allows adapters to handle multiple IR versions
   */
  irVersion?: string;

  /**
   * User-defined metadata
   * Application-specific tags, tracking IDs, etc.
   */
  custom?: Record<string, unknown>;
}

/**
 * Provider-specific hints (escape hatch)
 */
interface ProviderHints {
  openai?: Record<string, unknown>;
  anthropic?: Record<string, unknown>;
  gemini?: Record<string, unknown>;
  ollama?: Record<string, unknown>;
  mistral?: Record<string, unknown>;
  chromeai?: Record<string, unknown>;
}

/**
 * Branded type for request IDs
 * Prevents accidental mixing with other string types
 */
declare const RequestIdBrand: unique symbol;
type RequestId = string & { readonly [RequestIdBrand]: never };
```

**Relationships**:
- `UniversalChatRequest` is created by `FrontendAdapter.toUniversal()`
- `UniversalChatRequest` is consumed by `BackendAdapter.chat()` or `BackendAdapter.chatStream()`
- `UniversalChatRequest.messages` contains array of `UniversalMessage`
- `UniversalChatRequest.tools` contains array of `UniversalTool`

**Invariants**:
- `messages` MUST NOT be empty
- `temperature` MUST be in range [0, 1] if provided
- `maxTokens` MUST be positive if provided
- `topP` MUST be in range [0, 1] if provided
- Tool names MUST be unique within `tools` array
- If `toolChoice.type === 'tool'`, the named tool MUST exist in `tools`

---

### UniversalChatResponse

The universal response format representing a completed chat response.

```typescript
interface UniversalChatResponse {
  /**
   * Unique response ID (if provided by backend)
   * Branded type for type safety
   */
  id?: ResponseId;

  /**
   * Model that generated the response
   * May differ from request if router redirected
   *
   * Validation: MUST NOT be empty
   */
  model: string;

  /**
   * Generated message from assistant
   *
   * Validation:
   * - role MUST be 'assistant' or 'tool'
   * - content MUST NOT be empty unless tool_use present
   */
  message: UniversalMessage;

  /**
   * Why generation stopped
   *
   * Validation:
   * - MUST be provided unless error occurred
   */
  finishReason?: FinishReason;

  /**
   * Token usage statistics
   */
  usage?: TokenUsage;

  /**
   * Response timestamp (Unix epoch seconds)
   */
  created?: number;

  /**
   * Response metadata for debugging and warnings
   */
  metadata?: ResponseMetadata;

  /**
   * Raw backend response for debugging
   * Only populated in debug mode
   */
  raw?: unknown;
}

/**
 * Reason why generation stopped
 * Normalized across all providers
 */
type FinishReason =
  | 'stop'           // Natural completion
  | 'length'         // Max tokens reached
  | 'tool_calls'     // Model wants to call tools
  | 'content_filter' // Content policy violation
  | 'error';         // Generation error

/**
 * Token usage statistics
 */
interface TokenUsage {
  /**
   * Tokens in the prompt
   */
  promptTokens?: number;

  /**
   * Tokens in the completion
   */
  completionTokens?: number;

  /**
   * Total tokens (prompt + completion)
   * Invariant: totalTokens === promptTokens + completionTokens
   */
  totalTokens?: number;
}

/**
 * Response metadata
 */
interface ResponseMetadata {
  /**
   * Request ID this responds to
   * Links back to originating request
   */
  requestId?: RequestId;

  /**
   * Backend adapter that generated this response
   * Format: "backend-{provider}"
   */
  backendAdapter?: string;

  /**
   * Backend API version
   */
  backendVersion?: string;

  /**
   * Warnings about semantic drift or lossy conversions
   * SHOULD be empty for lossless translations
   */
  warnings?: SemanticWarning[];

  /**
   * Latency metrics for observability
   */
  latency?: LatencyMetrics;
}

/**
 * Latency metrics
 */
interface LatencyMetrics {
  /**
   * Adapter translation overhead (ms)
   */
  adapterMs?: number;

  /**
   * Backend API call time (ms)
   */
  backendMs?: number;

  /**
   * Total end-to-end time (ms)
   * Invariant: totalMs >= adapterMs + backendMs
   */
  totalMs?: number;
}

/**
 * Warning about semantic differences in translation
 */
interface SemanticWarning {
  /**
   * Category of semantic drift
   */
  type: SemanticWarningType;

  /**
   * Field that was affected
   */
  field: string;

  /**
   * Human-readable warning message
   */
  message: string;

  /**
   * Original value before transformation
   */
  originalValue?: unknown;

  /**
   * Transformed value after conversion
   */
  transformedValue?: unknown;
}

type SemanticWarningType =
  | 'parameter_scaling'      // Parameter scaled to different range
  | 'unsupported_feature'    // Feature not supported by backend
  | 'message_merge'          // Multiple messages merged into one
  | 'token_limit';           // Token limit exceeded or adjusted

/**
 * Branded type for response IDs
 */
declare const ResponseIdBrand: unique symbol;
type ResponseId = string & { readonly [ResponseIdBrand]: never };
```

**Relationships**:
- `UniversalChatResponse` is returned by `BackendAdapter.chat()`
- `UniversalChatResponse` is transformed by `FrontendAdapter.fromUniversal()`
- `UniversalChatResponse.message` is a `UniversalMessage` with role 'assistant'
- `UniversalChatResponse.metadata.requestId` links back to originating request

**Invariants**:
- `model` MUST NOT be empty
- `message.role` MUST be 'assistant' or 'tool'
- `usage.totalTokens` MUST equal `promptTokens + completionTokens` if all provided
- `metadata.latency.totalMs` MUST be >= sum of component latencies

---

### UniversalStreamChunk

Represents a fragment of a streaming response.

```typescript
interface UniversalStreamChunk {
  /**
   * Chunk type - discriminated union
   * Enables type narrowing based on chunk type
   *
   * Validation:
   * - First chunk SHOULD be 'message_start'
   * - Last chunk SHOULD be 'message_end' or 'error'
   */
  type: ChunkType;

  /**
   * Sequence number for ordering
   *
   * Validation:
   * - MUST start at 0
   * - MUST increment by 1 for each chunk
   * - Consumers MUST handle out-of-order delivery
   */
  sequence: number;

  /**
   * Delta content (for content_delta type)
   * MUST be present when type === 'content_delta'
   */
  delta?: ContentDelta;

  /**
   * Tool call delta (for tool_call_delta type)
   * MUST be present when type === 'tool_call_delta'
   */
  toolCallDelta?: ToolCallDelta;

  /**
   * Finish reason (for message_end type)
   * MUST be present when type === 'message_end'
   */
  finishReason?: FinishReason;

  /**
   * Usage stats (for message_end type)
   * MAY be present when type === 'message_end'
   */
  usage?: TokenUsage;

  /**
   * Error information (for error type)
   * MUST be present when type === 'error'
   */
  error?: StreamError;

  /**
   * Raw chunk from backend for debugging
   * Only populated in debug mode
   */
  raw?: unknown;
}

/**
 * Chunk type enumeration
 */
type ChunkType =
  | 'content_delta'      // Incremental content
  | 'tool_call_delta'    // Incremental tool call
  | 'message_start'      // Stream beginning
  | 'message_end'        // Stream completion
  | 'error';             // Error occurred

/**
 * Content delta for streaming text
 */
interface ContentDelta {
  /**
   * Role (only in first delta)
   */
  role?: MessageRole;

  /**
   * Incremental content string
   * Consumers MUST concatenate deltas
   */
  content?: string;
}

/**
 * Tool call delta for streaming tool calls
 */
interface ToolCallDelta {
  /**
   * Tool call ID (only in first delta)
   */
  id?: string;

  /**
   * Tool function name (only in first delta)
   */
  name?: string;

  /**
   * Partial JSON string for tool arguments
   * Consumers MUST concatenate and parse when complete
   */
  arguments?: string;
}

/**
 * Stream error information
 */
interface StreamError {
  /**
   * Error message
   * Validation: MUST NOT be empty
   */
  message: string;

  /**
   * Provider error code
   */
  code?: string;

  /**
   * Provider error type
   */
  type?: string;
}

/**
 * Streaming response type
 * AsyncGenerator provides natural backpressure and cancellation
 */
type UniversalStreamResponse = AsyncGenerator<UniversalStreamChunk, void, unknown>;
```

**Relationships**:
- `UniversalStreamChunk` is yielded by `BackendAdapter.chatStream()`
- Chunks assemble into a complete `UniversalChatResponse`
- `UniversalStreamChunk.sequence` enables ordering and gap detection

**State Transitions**:
1. `message_start` - Stream begins, establishes role
2. `content_delta` (multiple) - Content accumulates
3. `tool_call_delta` (multiple, optional) - Tool calls accumulate
4. `message_end` - Stream completes successfully
5. `error` - Stream terminates with error (terminal state)

**Invariants**:
- First chunk SHOULD have `sequence === 0`
- Sequence numbers MUST increment by 1
- Exactly one `message_start` chunk per stream
- Exactly one terminal chunk (`message_end` or `error`)
- `content_delta` chunks MUST have `delta.content` defined
- `tool_call_delta` chunks MUST have `toolCallDelta` defined
- `message_end` chunks MUST have `finishReason` defined
- `error` chunks MUST have `error` defined

---

## Adapter Interfaces

### FrontendAdapter

Accepts provider-specific request format and translates to universal IR.

```typescript
/**
 * Frontend adapter interface
 * Translates provider-specific request -> Universal IR
 * Translates Universal IR -> provider-specific response
 *
 * Type Parameters:
 * - TRequest: Provider-specific request type
 * - TResponse: Provider-specific response type
 */
interface FrontendAdapter<TRequest = unknown, TResponse = unknown> {
  /**
   * Adapter identification
   * Format: "frontend-{provider}"
   */
  readonly name: AdapterName<'frontend', ProviderName>;

  /**
   * Adapter version (semver)
   */
  readonly version: string;

  /**
   * Provider this adapter fronts
   */
  readonly provider: ProviderName;

  /**
   * Convert provider-specific request to Universal IR
   *
   * Responsibilities:
   * - Normalize system message placement into messages array
   * - Scale parameters to universal ranges
   * - Validate input structure
   * - Populate metadata.frontendAdapter
   *
   * Validation:
   * - MUST return valid UniversalChatRequest
   * - MUST NOT throw on valid provider input
   * - SHOULD emit warnings for lossy conversions
   *
   * @param request Provider-specific request
   * @returns Universal IR request
   * @throws AdapterError if request is invalid
   */
  toUniversal(request: TRequest): UniversalChatRequest;

  /**
   * Convert Universal IR response to provider-specific format
   *
   * Responsibilities:
   * - Restore provider-specific field names
   * - Format response according to provider conventions
   * - Include semantic warnings if present
   *
   * Validation:
   * - MUST return valid provider response
   * - MUST preserve all essential information
   *
   * @param response Universal IR response
   * @returns Provider-specific response
   * @throws AdapterError if response cannot be converted
   */
  fromUniversal(response: UniversalChatResponse): TResponse;

  /**
   * Convert streaming chunk to provider-specific format
   *
   * Used when streaming is enabled
   *
   * @param chunk Universal stream chunk
   * @returns Provider-specific chunk format
   */
  fromUniversalStream?(chunk: UniversalStreamChunk): unknown;
}

/**
 * Provider name enumeration
 */
type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'mistral' | 'chromeai';

/**
 * Template literal type for adapter names
 */
type AdapterName<T extends AdapterType, P extends ProviderName> = `${T}-${P}`;
type AdapterType = 'frontend' | 'backend';
```

**Relationships**:
- `FrontendAdapter` is the first stage in Bridge request flow
- `FrontendAdapter.toUniversal()` creates `UniversalChatRequest`
- `FrontendAdapter.fromUniversal()` consumes `UniversalChatResponse`
- Multiple frontend adapters can target the same backend

**Invariants**:
- `name` MUST follow format "frontend-{provider}"
- `provider` MUST match provider in `name`
- `toUniversal()` output MUST be valid `UniversalChatRequest`
- `fromUniversal()` MUST preserve essential response information

---

### BackendAdapter

Accepts universal IR and translates to provider-specific API calls.

```typescript
/**
 * Backend adapter interface
 * Translates Universal IR -> provider API calls
 * Translates provider response -> Universal IR
 *
 * Type Parameters:
 * - TRequest: Provider-specific request type
 * - TResponse: Provider-specific response type
 */
interface BackendAdapter<TRequest = unknown, TResponse = unknown> {
  /**
   * Adapter identification
   * Format: "backend-{provider}"
   */
  readonly name: AdapterName<'backend', ProviderName>;

  /**
   * Adapter version (semver)
   */
  readonly version: string;

  /**
   * Provider this adapter targets
   */
  readonly provider: ProviderName;

  /**
   * Capability metadata
   * Used by router for compatibility checks
   */
  readonly capabilities: AdapterCapabilities;

  /**
   * Configuration for this adapter
   */
  readonly config: BackendAdapterConfig;

  /**
   * Convert Universal IR to provider-specific request
   *
   * Responsibilities:
   * - Handle system message placement per provider conventions
   * - Scale parameters from universal ranges
   * - Check capabilities and emit warnings
   * - Validate token limits
   *
   * Validation:
   * - MUST check capabilities before conversion
   * - MUST emit warnings for unsupported features
   * - MUST handle system message merging correctly
   *
   * @param ir Universal IR request
   * @returns Provider-specific request
   * @throws AdapterError if IR cannot be converted
   */
  toProvider(ir: UniversalChatRequest): TRequest;

  /**
   * Convert provider-specific response to Universal IR
   *
   * Responsibilities:
   * - Normalize finish reasons
   * - Normalize token usage reporting
   * - Populate metadata.backendAdapter
   * - Include semantic warnings
   *
   * @param response Provider-specific response
   * @returns Universal IR response
   * @throws AdapterError if response cannot be converted
   */
  fromProvider(response: TResponse): UniversalChatResponse;

  /**
   * Execute non-streaming chat completion
   *
   * Responsibilities:
   * - Make HTTP request to provider
   * - Handle authentication
   * - Handle provider errors
   * - Track latency metrics
   *
   * Validation:
   * - MUST respect AbortSignal if provided
   * - MUST convert provider errors to UniversalError
   *
   * @param ir Universal IR request
   * @param options Optional execution options
   * @returns Promise resolving to Universal IR response
   * @throws UniversalError on failure
   */
  chat(
    ir: UniversalChatRequest,
    options?: ChatOptions
  ): Promise<UniversalChatResponse>;

  /**
   * Execute streaming chat completion
   *
   * Responsibilities:
   * - Establish streaming connection
   * - Parse provider streaming format
   * - Normalize chunks to Universal IR
   * - Handle stream cancellation
   * - Clean up resources on completion/error
   *
   * Validation:
   * - MUST check capabilities.supportsStreaming
   * - MUST yield chunks in sequence order
   * - MUST emit message_start as first chunk
   * - MUST emit message_end or error as final chunk
   * - MUST handle AbortSignal for cancellation
   *
   * @param ir Universal IR request
   * @param options Optional execution options
   * @returns AsyncGenerator yielding Universal IR chunks
   * @throws UniversalError on failure
   */
  chatStream(
    ir: UniversalChatRequest,
    options?: ChatOptions
  ): UniversalStreamResponse;

  /**
   * Health check for provider availability
   *
   * @returns Promise resolving to true if healthy
   */
  healthCheck?(): Promise<boolean>;

  /**
   * Estimate token count for messages
   *
   * Used for context window validation
   *
   * @param messages Messages to estimate
   * @returns Estimated token count
   */
  estimateTokens?(messages: UniversalMessage[]): number;
}

/**
 * Chat execution options
 */
interface ChatOptions {
  /**
   * AbortSignal for cancellation
   * Adapters MUST respect this signal
   */
  signal?: AbortSignal;

  /**
   * Timeout in milliseconds
   * Overrides adapter default timeout
   */
  timeout?: number;

  /**
   * Enable debug mode
   * Populates raw fields in responses
   */
  debug?: boolean;
}

/**
 * Backend adapter configuration
 */
interface BackendAdapterConfig {
  /**
   * API endpoint URL
   * Validation: MUST be valid HTTP/HTTPS URL
   */
  endpoint: string;

  /**
   * API key for authentication
   * Stored securely, never logged
   */
  apiKey?: string;

  /**
   * Request timeout in milliseconds
   * Default: 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Maximum retry attempts
   * Default: 3
   */
  maxRetries?: number;

  /**
   * Custom headers
   */
  headers?: Record<string, string>;

  /**
   * Provider-specific options
   */
  providerOptions?: Record<string, unknown>;
}
```

**Relationships**:
- `BackendAdapter` is the second stage in Bridge request flow
- `BackendAdapter.toProvider()` consumes `UniversalChatRequest`
- `BackendAdapter.fromProvider()` creates `UniversalChatResponse`
- `BackendAdapter.chatStream()` yields `UniversalStreamChunk`
- Multiple backend adapters can be registered in Router

**Invariants**:
- `name` MUST follow format "backend-{provider}"
- `provider` MUST match provider in `name`
- `capabilities` MUST accurately reflect provider features
- `chat()` and `chatStream()` MUST respect `signal` for cancellation
- `chatStream()` MUST yield `message_start` first, terminal chunk last
- `chatStream()` sequence numbers MUST start at 0 and increment by 1

---

## Bridge Class

The primary developer-facing API that connects frontend to backend.

```typescript
/**
 * Bridge connects frontend and backend adapters
 * Main entry point for developers
 *
 * Type Parameters:
 * - TFrontend: Frontend adapter type
 * - TBackend: Backend adapter type
 *
 * Invariants:
 * - Frontend and backend MUST be compatible (validated at construction)
 * - Router MUST be initialized before first request
 * - Middleware stack MUST be deterministic
 */
class Bridge<
  TFrontend extends FrontendAdapter = FrontendAdapter,
  TBackend extends BackendAdapter = BackendAdapter
> {
  /**
   * Frontend adapter
   * Translates incoming requests to Universal IR
   */
  private readonly frontend: TFrontend;

  /**
   * Backend adapter or router
   * Translates Universal IR to provider calls
   */
  private readonly backend: TBackend | Router;

  /**
   * Middleware stack
   * Executes in registration order
   */
  private readonly middleware: Middleware[];

  /**
   * Bridge configuration
   */
  private readonly config: BridgeConfig;

  /**
   * Construct bridge with frontend and backend
   *
   * Validation:
   * - Adapters MUST be compatible
   * - Adapter versions MUST be valid semver
   *
   * @param frontend Frontend adapter
   * @param backend Backend adapter or router
   * @param config Optional configuration
   * @throws BridgeError if adapters are incompatible
   */
  constructor(
    frontend: TFrontend,
    backend: TBackend | Router,
    config?: Partial<BridgeConfig>
  );

  /**
   * Add middleware to the stack
   *
   * Middleware executes in registration order:
   * - Request flow: middleware[0] -> middleware[1] -> ... -> backend
   * - Response flow: backend -> ... -> middleware[1] -> middleware[0]
   *
   * Validation:
   * - Middleware MUST NOT be added after first request
   *
   * @param middleware Middleware function or object
   * @returns This bridge for chaining
   */
  use(middleware: Middleware): this;

  /**
   * Execute non-streaming chat completion
   *
   * Flow:
   * 1. Frontend.toUniversal(request)
   * 2. Middleware (request phase)
   * 3. Backend.chat(ir)
   * 4. Middleware (response phase)
   * 5. Frontend.fromUniversal(response)
   *
   * Validation:
   * - Request MUST be valid for frontend adapter
   * - Backend capabilities MUST support request features
   *
   * @param request Provider-specific request (frontend format)
   * @param options Optional execution options
   * @returns Promise resolving to provider-specific response
   * @throws UniversalError on failure at any stage
   */
  async chat<TRequest, TResponse>(
    request: TRequest,
    options?: ChatOptions
  ): Promise<TResponse>;

  /**
   * Execute streaming chat completion
   *
   * Flow:
   * 1. Frontend.toUniversal(request)
   * 2. Middleware (request phase)
   * 3. Backend.chatStream(ir)
   * 4. Middleware (chunk phase, optional)
   * 5. Yield chunks
   *
   * Validation:
   * - Request MUST be valid for frontend adapter
   * - Backend MUST support streaming (capabilities.supportsStreaming)
   *
   * @param request Provider-specific request (frontend format)
   * @param options Optional execution options
   * @returns AsyncGenerator yielding chunks
   * @throws UniversalError on failure
   */
  chatStream<TRequest>(
    request: TRequest,
    options?: ChatOptions
  ): AsyncGenerator<unknown, void, unknown>;

  /**
   * Get current backend (useful when using router)
   *
   * @returns Backend adapter or router
   */
  getBackend(): TBackend | Router;

  /**
   * Get middleware stack
   *
   * @returns Copy of middleware array
   */
  getMiddleware(): readonly Middleware[];

  /**
   * Health check for entire bridge
   *
   * Checks frontend, backend, and middleware health
   *
   * @returns Promise resolving to health status
   */
  async healthCheck(): Promise<BridgeHealthStatus>;
}

/**
 * Bridge configuration
 */
interface BridgeConfig {
  /**
   * Enable debug mode
   * Populates raw fields and adds debug logs
   * Default: false
   */
  debug?: boolean;

  /**
   * Enable request/response validation
   * Default: true in development, false in production
   */
  validate?: boolean;

  /**
   * Default timeout for requests (ms)
   * Can be overridden per request
   * Default: 30000
   */
  timeout?: number;

  /**
   * Throw on semantic warnings
   * If true, warnings become errors
   * Default: false
   */
  strictMode?: boolean;

  /**
   * Enable latency tracking
   * Default: true
   */
  trackLatency?: boolean;
}

/**
 * Bridge health status
 */
interface BridgeHealthStatus {
  /**
   * Overall health
   */
  healthy: boolean;

  /**
   * Frontend adapter health
   */
  frontend: {
    name: string;
    version: string;
    healthy: boolean;
  };

  /**
   * Backend adapter health
   */
  backend: {
    name: string;
    version: string;
    healthy: boolean;
    latency?: number;
  };

  /**
   * Middleware health
   */
  middleware: Array<{
    name: string;
    healthy: boolean;
    error?: string;
  }>;

  /**
   * Health check timestamp
   */
  timestamp: number;
}
```

**Relationships**:
- `Bridge` composes `FrontendAdapter` and `BackendAdapter`
- `Bridge` manages `Middleware` stack
- `Bridge` delegates to `Router` for dynamic backend selection
- `Bridge.chat()` returns frontend-formatted response

**State Transitions**:
1. **Construction**: Frontend and backend are set, middleware stack is empty
2. **Configuration**: Middleware is added via `use()`
3. **Locked**: After first request, middleware stack is immutable
4. **Active**: Processing requests through middleware pipeline

**Invariants**:
- Middleware stack MUST NOT change after first request
- Frontend and backend MUST NOT be null
- Middleware MUST execute in registration order
- All errors MUST be converted to `UniversalError` before throwing

---

## Router Class

Manages backend registry and handles dynamic routing.

```typescript
/**
 * Router manages multiple backends and handles dynamic selection
 *
 * Capabilities:
 * - Backend registration and discovery
 * - Model-aware routing
 * - Fallback on failure
 * - Parallel dispatch (fan-out)
 * - Load balancing
 *
 * Invariants:
 * - At least one backend MUST be registered
 * - Backend names MUST be unique
 * - Default backend MUST exist in registry
 */
class Router {
  /**
   * Registered backends
   * Key: backend name, Value: backend adapter
   */
  private readonly backends: Map<string, BackendAdapter>;

  /**
   * Model-to-backend mapping
   * Enables model-aware routing
   */
  private readonly modelMap: Map<string, string[]>;

  /**
   * Router configuration
   */
  private readonly config: RouterConfig;

  /**
   * Construct router with configuration
   *
   * @param config Router configuration
   */
  constructor(config?: Partial<RouterConfig>);

  /**
   * Register a backend adapter
   *
   * Validation:
   * - Backend name MUST be unique
   * - Backend MUST have valid capabilities
   *
   * @param backend Backend adapter to register
   * @returns This router for chaining
   * @throws RouterError if backend name conflicts
   */
  register(backend: BackendAdapter): this;

  /**
   * Register multiple backends
   *
   * @param backends Backend adapters to register
   * @returns This router for chaining
   */
  registerAll(backends: BackendAdapter[]): this;

  /**
   * Unregister a backend
   *
   * Validation:
   * - MUST NOT unregister default backend
   * - MUST NOT unregister if it's the only backend
   *
   * @param name Backend name
   * @returns This router for chaining
   * @throws RouterError if backend cannot be removed
   */
  unregister(name: string): this;

  /**
   * Get backend by name
   *
   * @param name Backend name
   * @returns Backend adapter or undefined
   */
  get(name: string): BackendAdapter | undefined;

  /**
   * List all registered backends
   *
   * @returns Array of backend adapters
   */
  list(): BackendAdapter[];

  /**
   * Select backend for request
   *
   * Selection algorithm:
   * 1. Check request routing hints
   * 2. Model-aware routing (if model specified)
   * 3. Capability matching
   * 4. Load balancing
   * 5. Fallback to default
   *
   * Validation:
   * - Selected backend MUST support request capabilities
   * - Selected backend MUST be healthy
   *
   * @param ir Universal IR request
   * @param options Routing options
   * @returns Selected backend adapter
   * @throws RouterError if no suitable backend found
   */
  select(
    ir: UniversalChatRequest,
    options?: RoutingOptions
  ): BackendAdapter;

  /**
   * Execute request with automatic fallback
   *
   * Flow:
   * 1. Select primary backend
   * 2. Attempt request
   * 3. On failure, select fallback backend
   * 4. Retry with fallback
   * 5. Track failures for circuit breaking
   *
   * @param ir Universal IR request
   * @param options Routing options
   * @returns Promise resolving to response
   * @throws UniversalError if all backends fail
   */
  async chat(
    ir: UniversalChatRequest,
    options?: RoutingOptions
  ): Promise<UniversalChatResponse>;

  /**
   * Execute streaming request with automatic fallback
   *
   * @param ir Universal IR request
   * @param options Routing options
   * @returns AsyncGenerator yielding chunks
   * @throws UniversalError if all backends fail
   */
  chatStream(
    ir: UniversalChatRequest,
    options?: RoutingOptions
  ): UniversalStreamResponse;

  /**
   * Execute request on multiple backends in parallel (fan-out)
   *
   * Use cases:
   * - A/B testing
   * - Consensus
   * - Latency optimization (race)
   *
   * @param ir Universal IR request
   * @param options Fan-out options
   * @returns Promise resolving to array of responses
   */
  async fanOut(
    ir: UniversalChatRequest,
    options: FanOutOptions
  ): Promise<UniversalChatResponse[]>;

  /**
   * Map model to backends
   *
   * Enables automatic routing based on model name
   *
   * @param model Model identifier
   * @param backends Backend names that support this model
   * @returns This router for chaining
   */
  mapModel(model: string, backends: string[]): this;

  /**
   * Health check for all backends
   *
   * @returns Promise resolving to health status map
   */
  async healthCheckAll(): Promise<Map<string, boolean>>;
}

/**
 * Router configuration
 */
interface RouterConfig {
  /**
   * Default backend name
   * Used when no specific routing applies
   * Default: first registered backend
   */
  defaultBackend?: string;

  /**
   * Fallback strategy
   * Default: 'sequential'
   */
  fallbackStrategy?: FallbackStrategy;

  /**
   * Maximum retry attempts across backends
   * Default: 3
   */
  maxRetries?: number;

  /**
   * Circuit breaker configuration
   * Prevents cascading failures
   */
  circuitBreaker?: CircuitBreakerConfig;

  /**
   * Load balancing strategy
   * Default: 'round-robin'
   */
  loadBalancing?: LoadBalancingStrategy;

  /**
   * Enable health checks
   * Default: true
   */
  healthChecks?: boolean;

  /**
   * Health check interval (ms)
   * Default: 60000 (1 minute)
   */
  healthCheckInterval?: number;
}

/**
 * Routing options for individual requests
 */
interface RoutingOptions {
  /**
   * Preferred backend name
   * Overrides automatic selection
   */
  preferredBackend?: string;

  /**
   * Backend names to exclude
   */
  excludeBackends?: string[];

  /**
   * Required capabilities
   * Filters backends by capability
   */
  requiredCapabilities?: Partial<AdapterCapabilities>;

  /**
   * Execution options
   */
  chatOptions?: ChatOptions;
}

/**
 * Fan-out execution options
 */
interface FanOutOptions {
  /**
   * Backends to fan out to
   * If empty, fans out to all registered backends
   */
  backends?: string[];

  /**
   * Fan-out mode
   * - 'all': Wait for all responses
   * - 'race': Return first response, cancel others
   * - 'fastest-n': Return first N responses
   */
  mode: 'all' | 'race' | 'fastest-n';

  /**
   * Number of responses for 'fastest-n' mode
   */
  n?: number;

  /**
   * Timeout for fan-out operation (ms)
   */
  timeout?: number;

  /**
   * Execution options for each backend
   */
  chatOptions?: ChatOptions;
}

type FallbackStrategy =
  | 'sequential'    // Try backends one at a time
  | 'parallel'      // Try all backends simultaneously
  | 'none';         // No fallback, fail immediately

type LoadBalancingStrategy =
  | 'round-robin'   // Rotate through backends
  | 'random'        // Random selection
  | 'least-loaded'  // Select backend with fewest active requests
  | 'latency';      // Select backend with lowest latency

/**
 * Circuit breaker configuration
 * Prevents cascading failures by temporarily disabling failing backends
 */
interface CircuitBreakerConfig {
  /**
   * Enable circuit breaker
   * Default: true
   */
  enabled?: boolean;

  /**
   * Failure threshold before opening circuit
   * Default: 5
   */
  failureThreshold?: number;

  /**
   * Reset timeout when circuit is open (ms)
   * Default: 60000 (1 minute)
   */
  resetTimeout?: number;

  /**
   * Success threshold for half-open -> closed transition
   * Default: 2
   */
  successThreshold?: number;
}
```

**Relationships**:
- `Router` manages multiple `BackendAdapter` instances
- `Router` can be used as backend in `Bridge`
- `Router.select()` chooses `BackendAdapter` based on request
- `Router.fanOut()` dispatches to multiple backends in parallel

**State Transitions**:
1. **Empty**: No backends registered (invalid state)
2. **Ready**: At least one backend registered
3. **Active**: Processing requests
4. **Circuit Open**: Backend temporarily disabled due to failures
5. **Circuit Half-Open**: Backend being tested for recovery
6. **Circuit Closed**: Backend fully operational

**Invariants**:
- At least one backend MUST be registered before routing
- Backend names MUST be unique within router
- Default backend MUST exist in registry
- Circuit breaker state transitions MUST be atomic
- Fan-out operations MUST cancel remaining requests when mode='race' completes

---

## Middleware Interface

Composable transformation layer for cross-cutting concerns.

```typescript
/**
 * Middleware function signature
 *
 * Middleware can:
 * - Inspect/modify requests before backend
 * - Inspect/modify responses after backend
 * - Short-circuit request (return response directly)
 * - Add metadata (logging, tracing)
 * - Transform streams (buffering, filtering)
 *
 * Invariants:
 * - Middleware MUST call next() unless short-circuiting
 * - Middleware MUST propagate errors (or transform them)
 * - Middleware MUST be async-safe
 * - Middleware MUST NOT mutate IR (create new objects)
 */
type Middleware = (
  context: MiddlewareContext,
  next: MiddlewareNext
) => Promise<UniversalChatResponse | UniversalStreamResponse>;

/**
 * Middleware context
 * Provides request, response, and metadata access
 */
interface MiddlewareContext {
  /**
   * Universal IR request
   * Middleware MAY create modified copy
   */
  request: UniversalChatRequest;

  /**
   * Response (only available in response phase)
   */
  response?: UniversalChatResponse;

  /**
   * Execution phase
   */
  phase: MiddlewarePhase;

  /**
   * Shared state across middleware
   * Useful for passing data between middleware
   */
  state: Map<string, unknown>;

  /**
   * Request metadata
   */
  metadata: {
    /**
     * Request ID
     */
    requestId: RequestId;

    /**
     * Request start timestamp
     */
    startTime: number;

    /**
     * Frontend adapter name
     */
    frontendAdapter: string;

    /**
     * Backend adapter name (may be undefined during request phase)
     */
    backendAdapter?: string;

    /**
     * Custom user metadata
     */
    custom?: Record<string, unknown>;
  };

  /**
   * Abort signal for cancellation
   */
  signal?: AbortSignal;

  /**
   * Bridge configuration (read-only)
   */
  config: Readonly<BridgeConfig>;
}

/**
 * Middleware phase
 */
type MiddlewarePhase =
  | 'request'     // Before backend execution
  | 'response'    // After backend execution (non-streaming)
  | 'stream'      // During stream chunk processing
  | 'error';      // Error handling

/**
 * Next function in middleware chain
 */
type MiddlewareNext = () => Promise<UniversalChatResponse | UniversalStreamResponse>;

/**
 * Middleware composition utility
 * Chains multiple middleware into single function
 */
function composeMiddleware(middleware: Middleware[]): Middleware;

/**
 * Built-in middleware creators
 */
namespace MiddlewareBuiltins {
  /**
   * Logging middleware
   * Logs requests and responses
   */
  function logging(config?: LoggingConfig): Middleware;

  /**
   * Telemetry middleware
   * Tracks latency and success rates
   */
  function telemetry(config?: TelemetryConfig): Middleware;

  /**
   * Caching middleware
   * Caches responses based on request hash
   */
  function caching(config?: CachingConfig): Middleware;

  /**
   * Prompt transformation middleware
   * Transforms prompts before backend
   */
  function promptTransform(
    transformer: (request: UniversalChatRequest) => UniversalChatRequest
  ): Middleware;

  /**
   * Error handling middleware
   * Catches and transforms errors
   */
  function errorHandler(
    handler: (error: UniversalError, context: MiddlewareContext) => UniversalChatResponse
  ): Middleware;

  /**
   * Rate limiting middleware
   * Enforces rate limits
   */
  function rateLimit(config?: RateLimitConfig): Middleware;

  /**
   * Retry middleware
   * Retries failed requests
   */
  function retry(config?: RetryConfig): Middleware;
}

/**
 * Logging middleware configuration
 */
interface LoggingConfig {
  /**
   * Log level
   * Default: 'info'
   */
  level?: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Include request bodies
   * Default: false (for privacy)
   */
  includeRequests?: boolean;

  /**
   * Include response bodies
   * Default: false (for privacy)
   */
  includeResponses?: boolean;

  /**
   * Custom logger
   */
  logger?: Logger;
}

/**
 * Telemetry middleware configuration
 */
interface TelemetryConfig {
  /**
   * Telemetry sink
   */
  sink: TelemetrySink;

  /**
   * Sample rate (0-1)
   * Default: 1.0 (100%)
   */
  sampleRate?: number;

  /**
   * Custom metrics to track
   */
  metrics?: string[];
}

/**
 * Caching middleware configuration
 */
interface CachingConfig {
  /**
   * Cache implementation
   */
  cache: Cache;

  /**
   * Time-to-live in milliseconds
   * Default: 3600000 (1 hour)
   */
  ttl?: number;

  /**
   * Cache key generator
   * Default: hash of request
   */
  keyGenerator?: (request: UniversalChatRequest) => string;

  /**
   * Exclude parameters from cache key
   * Default: ['metadata', 'providerHints']
   */
  excludeFields?: string[];
}

/**
 * Rate limit middleware configuration
 */
interface RateLimitConfig {
  /**
   * Maximum requests per window
   */
  maxRequests: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Rate limit key generator
   * Default: constant (global rate limit)
   */
  keyGenerator?: (context: MiddlewareContext) => string;

  /**
   * Handler when rate limit exceeded
   */
  onLimitExceeded?: (context: MiddlewareContext) => UniversalError;
}

/**
 * Retry middleware configuration
 */
interface RetryConfig {
  /**
   * Maximum retry attempts
   * Default: 3
   */
  maxAttempts?: number;

  /**
   * Retry delay in milliseconds
   * Default: 1000
   */
  retryDelayMs?: number;

  /**
   * Exponential backoff multiplier
   * Default: 2
   */
  backoffMultiplier?: number;

  /**
   * Retry condition
   * Default: retry on retryable errors
   */
  shouldRetry?: (error: UniversalError) => boolean;
}

/**
 * Logger interface
 */
interface Logger {
  debug(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
}

/**
 * Telemetry sink interface
 */
interface TelemetrySink {
  track(event: string, properties: Record<string, unknown>): void;
  flush(): Promise<void>;
}

/**
 * Cache interface
 */
interface Cache {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

**Relationships**:
- `Middleware` is registered with `Bridge.use()`
- `Middleware` operates on `UniversalChatRequest` and `UniversalChatResponse`
- `Middleware` can short-circuit request flow
- Multiple middleware compose into pipeline

**State Transitions**:
1. **Request Phase**: Middleware receives request, may modify, calls next()
2. **Backend Execution**: Request reaches backend adapter
3. **Response Phase**: Middleware receives response, may modify, returns
4. **Error Phase**: If error occurs, error-handling middleware executes

**Invariants**:
- Middleware MUST call `next()` unless short-circuiting
- Middleware MUST NOT mutate IR (create new objects instead)
- Middleware execution order MUST be deterministic
- Middleware MUST be async-safe (no race conditions)
- Error-handling middleware MUST be last in stack

---

## Capability Metadata

Declares adapter capabilities for routing and validation.

```typescript
/**
 * Adapter capability metadata
 * Used by router for compatibility checks and routing decisions
 *
 * Invariants:
 * - All fields MUST accurately reflect adapter capabilities
 * - Temperature range MUST have min < max
 * - Max stop sequences MUST be >= 0
 * - Max context tokens MUST be > 0
 */
interface AdapterCapabilities {
  /**
   * Supports streaming responses
   *
   * Validation:
   * - If false, chatStream() MAY throw
   */
  supportsStreaming: boolean;

  /**
   * Supports tool/function calling
   *
   * Validation:
   * - If false, requests with tools SHOULD emit warning
   */
  supportsTools: boolean;

  /**
   * Supports multi-part content (text + images)
   *
   * Validation:
   * - If false, multi-part content MUST be converted to text-only
   */
  supportsMultipartContent: boolean;

  /**
   * Supports stop sequences
   *
   * Validation:
   * - If false, stopSequences SHOULD be ignored with warning
   */
  supportsStopSequences: boolean;

  /**
   * Maximum number of stop sequences supported
   * undefined means unlimited
   *
   * Example: Anthropic supports max 4
   */
  maxStopSequences?: number;

  /**
   * Temperature range supported by provider
   *
   * Validation:
   * - min MUST be < max
   * - Adapters MUST scale IR temperature (0-1) to this range
   */
  temperatureRange: {
    min: number;
    max: number;
  };

  /**
   * Top-p sampling supported
   */
  supportsTopP: boolean;

  /**
   * Maximum context window in tokens
   *
   * Used for token limit validation
   *
   * Validation:
   * - MUST be > 0
   * - Adapters SHOULD check messages against this limit
   */
  maxContextTokens: number;

  /**
   * Supported message roles
   *
   * Default: ['system', 'user', 'assistant']
   *
   * Example: Some providers don't support 'tool' role
   */
  supportedRoles?: MessageRole[];

  /**
   * System message handling
   */
  systemMessageHandling: SystemMessageCapability;

  /**
   * Supported content types
   */
  supportedContentTypes?: ContentType[];

  /**
   * Provider-specific capabilities
   * Used for advanced routing logic
   */
  providerSpecific?: Record<string, unknown>;
}

/**
 * System message capability
 */
interface SystemMessageCapability {
  /**
   * How system messages are handled
   * - 'parameter': Separate system parameter (Anthropic)
   * - 'first': First message in array (OpenAI)
   * - 'any': Can appear anywhere (OpenAI)
   * - 'none': Not supported
   */
  placement: 'parameter' | 'first' | 'any' | 'none';

  /**
   * Supports multiple system messages
   * If false, adapter MUST merge multiple system messages
   */
  supportsMultiple: boolean;

  /**
   * Supports interleaved system messages
   * If false, adapter MUST extract and reorder
   */
  supportsInterleaved: boolean;
}

/**
 * Content type enumeration
 */
type ContentType =
  | 'text'           // Plain text
  | 'image_url'      // Image via URL
  | 'image_base64'   // Image as base64
  | 'tool_use'       // Tool call
  | 'tool_result';   // Tool result

/**
 * Capability checking utilities
 */
namespace CapabilityChecks {
  /**
   * Check if backend supports request
   *
   * Returns warnings for unsupported features
   * Throws if request is fundamentally incompatible
   *
   * @param capabilities Adapter capabilities
   * @param request Universal IR request
   * @returns Array of semantic warnings
   * @throws AdapterError if incompatible
   */
  function checkCompatibility(
    capabilities: AdapterCapabilities,
    request: UniversalChatRequest
  ): SemanticWarning[];

  /**
   * Check if temperature is in range
   *
   * @param capabilities Adapter capabilities
   * @param temperature Temperature value
   * @returns Scaled value and optional warning
   */
  function checkTemperature(
    capabilities: AdapterCapabilities,
    temperature: number
  ): { value: number; warning?: SemanticWarning };

  /**
   * Check if token count is within limits
   *
   * @param capabilities Adapter capabilities
   * @param messages Messages to check
   * @returns Optional warning if limit exceeded
   */
  function checkTokenLimit(
    capabilities: AdapterCapabilities,
    messages: UniversalMessage[]
  ): SemanticWarning | undefined;

  /**
   * Check if content types are supported
   *
   * @param capabilities Adapter capabilities
   * @param message Message to check
   * @returns Array of warnings for unsupported content
   */
  function checkContentTypes(
    capabilities: AdapterCapabilities,
    message: UniversalMessage
  ): SemanticWarning[];
}
```

**Relationships**:
- `AdapterCapabilities` is field in `BackendAdapter`
- `Router.select()` uses capabilities for routing decisions
- `CapabilityChecks` validates requests against capabilities
- Capabilities generate `SemanticWarning` when mismatches occur

**Invariants**:
- `temperatureRange.min` MUST be < `temperatureRange.max`
- `maxContextTokens` MUST be > 0
- `maxStopSequences` MUST be >= 0 if defined
- Capabilities MUST accurately reflect provider limitations

---

## Error Types

Universal error hierarchy for consistent error handling.

```typescript
/**
 * Base universal error class
 * All adapter errors extend this
 *
 * Invariants:
 * - category MUST be set
 * - message MUST be descriptive
 * - adapter MUST be set to indicate source
 */
class UniversalError extends Error {
  /**
   * Error category for handling logic
   */
  readonly category: ErrorCategory;

  /**
   * HTTP status code if applicable
   */
  readonly statusCode?: number;

  /**
   * Provider-specific error code
   * Preserved for debugging
   */
  readonly providerCode?: string;

  /**
   * Provider-specific error type
   */
  readonly providerType?: string;

  /**
   * Adapter that threw this error
   * Format: "frontend-{provider}" or "backend-{provider}"
   */
  readonly adapter?: string;

  /**
   * IR state when error occurred
   * Useful for debugging
   */
  readonly irState?: Partial<UniversalChatRequest>;

  /**
   * Original error from provider
   * For debugging and advanced error handling
   */
  readonly originalError?: unknown;

  /**
   * Whether this error is retryable
   * Used by retry middleware and router fallback
   */
  readonly retryable: boolean;

  /**
   * Retry after delay in seconds
   * Set by rate limit errors
   */
  readonly retryAfter?: number;

  /**
   * Error timestamp
   */
  readonly timestamp: number;

  constructor(params: UniversalErrorParams);

  /**
   * Convert to JSON for serialization
   */
  toJSON(): UniversalErrorJSON;

  /**
   * Create from provider error
   */
  static fromProviderError(
    error: unknown,
    adapter: string,
    category: ErrorCategory
  ): UniversalError;
}

/**
 * Error category enumeration
 */
type ErrorCategory =
  | 'authentication'     // Invalid API key
  | 'authorization'      // Insufficient permissions
  | 'rate_limit'         // Rate limit exceeded
  | 'invalid_request'    // Malformed request
  | 'model_error'        // Model unavailable or error
  | 'network'            // Network/timeout error
  | 'server_error'       // Provider server error
  | 'adapter_error'      // Adapter internal error
  | 'validation_error'   // Request validation failed
  | 'unknown';           // Uncategorized error

/**
 * Error constructor parameters
 */
interface UniversalErrorParams {
  message: string;
  category: ErrorCategory;
  statusCode?: number;
  providerCode?: string;
  providerType?: string;
  adapter?: string;
  irState?: Partial<UniversalChatRequest>;
  originalError?: unknown;
  retryable?: boolean;
  retryAfter?: number;
}

/**
 * JSON representation of error
 */
interface UniversalErrorJSON {
  name: string;
  message: string;
  category: ErrorCategory;
  statusCode?: number;
  providerCode?: string;
  providerType?: string;
  adapter?: string;
  retryable: boolean;
  retryAfter?: number;
  timestamp: number;
  stack?: string;
}

/**
 * Specific error types
 */

/**
 * Authentication error
 * Thrown when API key is invalid or missing
 */
class AuthenticationError extends UniversalError {
  constructor(message: string, adapter?: string, originalError?: unknown);
}

/**
 * Authorization error
 * Thrown when API key lacks permissions
 */
class AuthorizationError extends UniversalError {
  constructor(message: string, adapter?: string, originalError?: unknown);
}

/**
 * Rate limit error
 * Thrown when rate limit is exceeded
 */
class RateLimitError extends UniversalError {
  constructor(
    message: string,
    retryAfter?: number,
    adapter?: string,
    originalError?: unknown
  );
}

/**
 * Invalid request error
 * Thrown when request validation fails
 */
class InvalidRequestError extends UniversalError {
  /**
   * Validation errors
   */
  readonly validationErrors: ValidationError[];

  constructor(
    message: string,
    validationErrors: ValidationError[],
    adapter?: string
  );
}

/**
 * Model error
 * Thrown when model is unavailable or fails
 */
class ModelError extends UniversalError {
  /**
   * Model that failed
   */
  readonly model: string;

  constructor(
    message: string,
    model: string,
    adapter?: string,
    originalError?: unknown
  );
}

/**
 * Network error
 * Thrown on network failures or timeouts
 */
class NetworkError extends UniversalError {
  constructor(message: string, adapter?: string, originalError?: unknown);
}

/**
 * Server error
 * Thrown on provider server errors (5xx)
 */
class ServerError extends UniversalError {
  constructor(
    message: string,
    statusCode: number,
    adapter?: string,
    originalError?: unknown
  );
}

/**
 * Adapter error
 * Thrown on adapter internal errors
 */
class AdapterError extends UniversalError {
  constructor(message: string, adapter?: string, originalError?: unknown);
}

/**
 * Validation error
 * Thrown when request/response validation fails
 */
class ValidationError extends UniversalError {
  /**
   * Field that failed validation
   */
  readonly field: string;

  /**
   * Validation rule that failed
   */
  readonly rule: string;

  /**
   * Expected value or format
   */
  readonly expected?: unknown;

  /**
   * Actual value that failed
   */
  readonly actual?: unknown;

  constructor(
    field: string,
    rule: string,
    expected?: unknown,
    actual?: unknown
  );
}

/**
 * Bridge error
 * Thrown by Bridge class
 */
class BridgeError extends UniversalError {
  constructor(message: string, originalError?: unknown);
}

/**
 * Router error
 * Thrown by Router class
 */
class RouterError extends UniversalError {
  constructor(message: string, originalError?: unknown);
}

/**
 * Error utilities
 */
namespace ErrorUtils {
  /**
   * Check if error is retryable
   */
  function isRetryable(error: UniversalError): boolean;

  /**
   * Get retry delay for error
   * Returns delay in milliseconds
   */
  function getRetryDelay(error: UniversalError, attempt: number): number;

  /**
   * Convert HTTP status to error category
   */
  function statusToCategory(status: number): ErrorCategory;

  /**
   * Format error for display
   */
  function formatError(error: UniversalError): string;
}
```

**Relationships**:
- All errors extend `UniversalError`
- Errors are thrown by adapters, bridge, router, and middleware
- `UniversalError.retryable` controls retry middleware behavior
- `UniversalError.irState` provides debugging context

**Invariants**:
- `category` MUST be set
- `message` MUST NOT be empty
- `retryable` MUST accurately reflect retryability
- `statusCode` MUST be valid HTTP status if set
- `timestamp` MUST be set at construction time

---

## Configuration Types

Configuration for bridge, router, and adapters.

```typescript
/**
 * Bridge configuration
 * Controls bridge behavior
 */
interface BridgeConfig {
  /**
   * Enable debug mode
   * Populates raw fields and adds debug logs
   * Default: false
   */
  debug?: boolean;

  /**
   * Enable request/response validation
   * Default: true in development, false in production
   */
  validate?: boolean;

  /**
   * Default timeout for requests (ms)
   * Can be overridden per request
   * Default: 30000
   *
   * Validation: MUST be > 0
   */
  timeout?: number;

  /**
   * Throw on semantic warnings
   * If true, warnings become errors
   * Default: false
   */
  strictMode?: boolean;

  /**
   * Enable latency tracking
   * Adds overhead but provides metrics
   * Default: true
   */
  trackLatency?: boolean;

  /**
   * Middleware configuration
   */
  middleware?: MiddlewareConfig;
}

/**
 * Router configuration
 * Controls routing behavior
 */
interface RouterConfig {
  /**
   * Default backend name
   * Used when no specific routing applies
   * Default: first registered backend
   *
   * Validation: MUST reference registered backend
   */
  defaultBackend?: string;

  /**
   * Fallback strategy
   * Default: 'sequential'
   */
  fallbackStrategy?: FallbackStrategy;

  /**
   * Maximum retry attempts across backends
   * Default: 3
   *
   * Validation: MUST be >= 0
   */
  maxRetries?: number;

  /**
   * Circuit breaker configuration
   * Prevents cascading failures
   */
  circuitBreaker?: CircuitBreakerConfig;

  /**
   * Load balancing strategy
   * Default: 'round-robin'
   */
  loadBalancing?: LoadBalancingStrategy;

  /**
   * Enable health checks
   * Default: true
   */
  healthChecks?: boolean;

  /**
   * Health check interval (ms)
   * Default: 60000 (1 minute)
   *
   * Validation: MUST be >= 1000
   */
  healthCheckInterval?: number;

  /**
   * Model mapping
   * Maps model names to backend names
   */
  modelMapping?: Record<string, string[]>;
}

/**
 * Middleware configuration
 * Controls middleware behavior
 */
interface MiddlewareConfig {
  /**
   * Enable built-in logging middleware
   * Default: false
   */
  logging?: boolean | LoggingConfig;

  /**
   * Enable built-in telemetry middleware
   * Default: false
   */
  telemetry?: boolean | TelemetryConfig;

  /**
   * Enable built-in caching middleware
   * Default: false
   */
  caching?: boolean | CachingConfig;

  /**
   * Enable built-in retry middleware
   * Default: false
   */
  retry?: boolean | RetryConfig;

  /**
   * Enable built-in rate limiting middleware
   * Default: false
   */
  rateLimit?: boolean | RateLimitConfig;

  /**
   * Custom middleware
   */
  custom?: Middleware[];
}

/**
 * Backend adapter configuration
 */
interface BackendAdapterConfig {
  /**
   * API endpoint URL
   *
   * Validation: MUST be valid HTTP/HTTPS URL
   */
  endpoint: string;

  /**
   * API key for authentication
   * Stored securely, never logged
   *
   * Validation: MUST NOT be empty
   */
  apiKey?: string;

  /**
   * Request timeout in milliseconds
   * Default: 30000 (30 seconds)
   *
   * Validation: MUST be > 0
   */
  timeout?: number;

  /**
   * Maximum retry attempts
   * Default: 3
   *
   * Validation: MUST be >= 0
   */
  maxRetries?: number;

  /**
   * Custom headers
   * Used for additional authentication, tracking, etc.
   */
  headers?: Record<string, string>;

  /**
   * Provider-specific options
   * Passed through to provider client
   */
  providerOptions?: Record<string, unknown>;

  /**
   * HTTP client configuration
   */
  httpClient?: HttpClientConfig;
}

/**
 * HTTP client configuration
 */
interface HttpClientConfig {
  /**
   * User agent string
   */
  userAgent?: string;

  /**
   * Connection timeout (ms)
   * Default: 5000
   */
  connectTimeout?: number;

  /**
   * Follow redirects
   * Default: true
   */
  followRedirects?: boolean;

  /**
   * Maximum redirects
   * Default: 5
   */
  maxRedirects?: number;

  /**
   * Proxy configuration
   */
  proxy?: ProxyConfig;

  /**
   * TLS/SSL configuration
   */
  tls?: TLSConfig;
}

/**
 * Proxy configuration
 */
interface ProxyConfig {
  /**
   * Proxy URL
   */
  url: string;

  /**
   * Proxy authentication
   */
  auth?: {
    username: string;
    password: string;
  };
}

/**
 * TLS/SSL configuration
 */
interface TLSConfig {
  /**
   * Reject unauthorized certificates
   * Default: true
   */
  rejectUnauthorized?: boolean;

  /**
   * CA certificates
   */
  ca?: string | Buffer | Array<string | Buffer>;

  /**
   * Client certificate
   */
  cert?: string | Buffer;

  /**
   * Client private key
   */
  key?: string | Buffer;
}

/**
 * Configuration validation utilities
 */
namespace ConfigValidation {
  /**
   * Validate bridge configuration
   *
   * @param config Configuration to validate
   * @returns Validated configuration with defaults
   * @throws ValidationError if invalid
   */
  function validateBridgeConfig(
    config?: Partial<BridgeConfig>
  ): BridgeConfig;

  /**
   * Validate router configuration
   *
   * @param config Configuration to validate
   * @returns Validated configuration with defaults
   * @throws ValidationError if invalid
   */
  function validateRouterConfig(
    config?: Partial<RouterConfig>
  ): RouterConfig;

  /**
   * Validate backend adapter configuration
   *
   * @param config Configuration to validate
   * @returns Validated configuration with defaults
   * @throws ValidationError if invalid
   */
  function validateBackendAdapterConfig(
    config: BackendAdapterConfig
  ): BackendAdapterConfig;

  /**
   * Apply default values to configuration
   *
   * @param config Partial configuration
   * @param defaults Default values
   * @returns Complete configuration
   */
  function applyDefaults<T>(
    config: Partial<T>,
    defaults: T
  ): T;
}
```

**Relationships**:
- `BridgeConfig` is passed to `Bridge` constructor
- `RouterConfig` is passed to `Router` constructor
- `BackendAdapterConfig` is field in `BackendAdapter`
- Configurations control behavior of components

**Invariants**:
- `timeout` MUST be > 0 if set
- `maxRetries` MUST be >= 0
- `endpoint` MUST be valid URL
- `healthCheckInterval` MUST be >= 1000 ms
- Configuration defaults MUST be sensible

---

## Type Relationships

### Entity-Relationship Diagram (Conceptual)

```
┌─────────────────────┐
│  FrontendAdapter    │
│  - name             │
│  - provider         │
│  - toUniversal()    │
│  - fromUniversal()  │
└──────────┬──────────┘
           │ creates
           ▼
┌─────────────────────────┐
│ UniversalChatRequest    │
│ - model                 │
│ - messages[]            │◄────┐
│ - temperature           │     │
│ - tools[]               │     │
└──────────┬──────────────┘     │
           │ processed by       │
           ▼                     │
┌─────────────────────┐         │
│     Bridge          │         │
│  - frontend         │         │
│  - backend/router   │         │
│  - middleware[]     │         │
│  - chat()           │         │
│  - chatStream()     │         │
└──────────┬──────────┘         │
           │ delegates to       │
           ▼                     │
┌─────────────────────┐         │
│     Router          │         │
│  - backends[]       │         │
│  - select()         │         │
│  - fanOut()         │         │
└──────────┬──────────┘         │
           │ selects            │
           ▼                     │
┌─────────────────────────┐     │
│   BackendAdapter        │     │
│  - name                 │     │
│  - capabilities         │     │
│  - toProvider()         │     │
│  - fromProvider()       │     │
│  - chat()               │     │
│  - chatStream()         │     │
└──────────┬──────────────┘     │
           │ returns            │
           ▼                     │
┌──────────────────────────┐    │
│ UniversalChatResponse    │    │
│ - model                  │    │
│ - message                │    │
│ - finishReason           │    │
│ - metadata.warnings[]    │    │
└──────────────────────────┘    │
                                │
┌──────────────────────────┐    │
│ UniversalMessage         │────┘
│ - role                   │ contained in
│ - content                │
│ - metadata               │
└──────────────────────────┘

┌──────────────────────────┐
│ Middleware               │
│ - operates on IR         │
│ - request phase          │
│ - response phase         │
└──────────────────────────┘
           │ intercepts
           └──────────────────► UniversalChatRequest
           └──────────────────► UniversalChatResponse
```

### Type Dependency Graph

```
MessageRole ──┐
MessageContent│
MessagePart ──┴──► UniversalMessage ──┬──► UniversalChatRequest ──┐
                                      │                           │
FinishReason ──┐                      │                           │
TokenUsage ────┴──► UniversalChatResponse                         │
                                      │                           │
ChunkType ─────────► UniversalStreamChunk ◄─────────────────────┘
                                      │
                                      │
SemanticWarning ──────────────────────┤
                                      │
AdapterCapabilities ──► BackendAdapter◄──► Router
                           │               │
FrontendAdapter ───────────┤               │
                           ▼               │
                        Bridge ◄───────────┘
                           │
Middleware ────────────────┘
                           │
UniversalError ────────────┴─► All Components
                           │
BridgeConfig ──────────────┤
RouterConfig ──────────────┤
BackendAdapterConfig ──────┘
```

---

## State Transitions

### Bridge State Machine

```
┌───────────┐
│   Init    │ Initial state
└─────┬─────┘
      │ use(middleware)
      ▼
┌───────────┐
│Configuring│ Adding middleware
└─────┬─────┘
      │ chat() / chatStream()
      ▼
┌───────────┐
│  Locked   │ Middleware locked
└─────┬─────┘
      │ processing requests
      ▼
┌───────────┐
│  Active   │ Processing requests
└─────┬─────┘
      │ error
      ▼
┌───────────┐
│   Error   │ Error state (recoverable)
└─────┬─────┘
      │ retry
      └───► Active
```

### Streaming State Machine

```
┌───────────┐
│   Start   │
└─────┬─────┘
      │ chatStream()
      ▼
┌───────────┐
│message_start│ Emitted first
└─────┬─────┘
      │
      ▼
┌───────────┐
│content_delta│ Emitted 0+ times
└─────┬─────┘
      │
      ▼
┌────────────────┐
│tool_call_delta │ Emitted 0+ times (if tools)
└─────┬──────────┘
      │
      ├──► message_end (normal completion)
      │
      └──► error (error termination)
```

### Circuit Breaker State Machine

```
┌────────┐
│ Closed │ Normal operation
└────┬───┘
     │ failure threshold reached
     ▼
┌────────┐
│  Open  │ All requests fail immediately
└────┬───┘
     │ reset timeout elapsed
     ▼
┌───────────┐
│ Half-Open │ Testing recovery
└─────┬─────┘
     │
     ├──► Closed (success threshold reached)
     │
     └──► Open (failure detected)
```

---

## Invariants

### Global Invariants

1. **IR Immutability**: Once created, IR objects MUST NOT be mutated
2. **Type Safety**: All IR types MUST be strongly typed
3. **Error Propagation**: All errors MUST be converted to `UniversalError`
4. **Cancellation**: All async operations MUST respect `AbortSignal`
5. **Sequence Numbers**: Stream chunk sequences MUST be monotonically increasing

### Bridge Invariants

1. `frontend` and `backend` MUST NOT be null after construction
2. Middleware stack MUST NOT change after first request
3. Middleware MUST execute in registration order
4. All requests MUST flow through middleware pipeline

### Router Invariants

1. At least one backend MUST be registered before routing
2. Backend names MUST be unique
3. Default backend MUST exist in registry
4. Circuit breaker transitions MUST be atomic
5. Fan-out operations MUST cancel pending requests when appropriate

### Adapter Invariants

1. Adapter name MUST match format "{type}-{provider}"
2. Frontend `toUniversal()` output MUST be valid `UniversalChatRequest`
3. Backend `fromProvider()` output MUST be valid `UniversalChatResponse`
4. Capabilities MUST accurately reflect provider features
5. Adapters MUST emit warnings for lossy conversions

### Streaming Invariants

1. First chunk MUST be `message_start` (sequence 0)
2. Last chunk MUST be `message_end` or `error`
3. Sequence numbers MUST increment by 1
4. Content deltas MUST be concatenatable
5. Stream MUST close on error or completion

### Message Invariants

1. `messages` array MUST NOT be empty
2. System messages SHOULD appear first (but adapters handle placement)
3. Tool use messages MUST be followed by tool result messages
4. Message roles SHOULD alternate user/assistant (flexible)

---

## Validation Rules

### Request Validation

```typescript
/**
 * Validation rules for UniversalChatRequest
 */
const REQUEST_VALIDATION_RULES = {
  model: {
    required: true,
    type: 'string',
    minLength: 1,
    message: 'Model must be non-empty string'
  },

  messages: {
    required: true,
    type: 'array',
    minLength: 1,
    itemType: 'UniversalMessage',
    message: 'Messages must be non-empty array'
  },

  temperature: {
    required: false,
    type: 'number',
    min: 0.0,
    max: 1.0,
    message: 'Temperature must be between 0.0 and 1.0'
  },

  maxTokens: {
    required: false,
    type: 'number',
    min: 1,
    message: 'Max tokens must be positive'
  },

  topP: {
    required: false,
    type: 'number',
    min: 0.0,
    max: 1.0,
    message: 'Top-p must be between 0.0 and 1.0'
  },

  stopSequences: {
    required: false,
    type: 'array',
    itemType: 'string',
    itemMinLength: 1,
    message: 'Stop sequences must be non-empty strings'
  },

  tools: {
    required: false,
    type: 'array',
    itemType: 'UniversalTool',
    uniqueBy: 'function.name',
    message: 'Tool names must be unique'
  },

  toolChoice: {
    required: false,
    dependsOn: 'tools',
    validator: (value, request) => {
      if (value?.type === 'tool') {
        const toolExists = request.tools?.some(t => t.function.name === value.name);
        return toolExists || 'Tool choice references undefined tool';
      }
      return true;
    }
  }
};
```

### Message Validation

```typescript
/**
 * Validation rules for UniversalMessage
 */
const MESSAGE_VALIDATION_RULES = {
  role: {
    required: true,
    type: 'enum',
    values: ['system', 'user', 'assistant', 'tool'],
    message: 'Role must be valid MessageRole'
  },

  content: {
    required: true,
    validator: (value) => {
      if (typeof value === 'string') {
        return value.length > 0 || 'Content string must not be empty';
      }
      if (Array.isArray(value)) {
        return value.length > 0 || 'Content array must not be empty';
      }
      return 'Content must be string or array';
    }
  },

  name: {
    required: (message) => message.role === 'tool',
    type: 'string',
    minLength: 1,
    message: 'Name is required for tool role'
  }
};
```

### Response Validation

```typescript
/**
 * Validation rules for UniversalChatResponse
 */
const RESPONSE_VALIDATION_RULES = {
  model: {
    required: true,
    type: 'string',
    minLength: 1,
    message: 'Model must be non-empty string'
  },

  message: {
    required: true,
    type: 'UniversalMessage',
    validator: (message) => {
      const validRoles = ['assistant', 'tool'];
      return validRoles.includes(message.role) ||
        'Response message role must be assistant or tool';
    }
  },

  finishReason: {
    required: false,
    type: 'enum',
    values: ['stop', 'length', 'tool_calls', 'content_filter', 'error'],
    message: 'Finish reason must be valid FinishReason'
  },

  usage: {
    required: false,
    type: 'object',
    validator: (usage) => {
      if (usage?.totalTokens && usage?.promptTokens && usage?.completionTokens) {
        return usage.totalTokens === usage.promptTokens + usage.completionTokens ||
          'Total tokens must equal prompt + completion tokens';
      }
      return true;
    }
  }
};
```

### Chunk Validation

```typescript
/**
 * Validation rules for UniversalStreamChunk
 */
const CHUNK_VALIDATION_RULES = {
  type: {
    required: true,
    type: 'enum',
    values: ['content_delta', 'tool_call_delta', 'message_start', 'message_end', 'error'],
    message: 'Chunk type must be valid ChunkType'
  },

  sequence: {
    required: true,
    type: 'number',
    min: 0,
    integer: true,
    message: 'Sequence must be non-negative integer'
  },

  delta: {
    required: (chunk) => chunk.type === 'content_delta',
    type: 'object',
    message: 'Delta required for content_delta chunks'
  },

  toolCallDelta: {
    required: (chunk) => chunk.type === 'tool_call_delta',
    type: 'object',
    message: 'Tool call delta required for tool_call_delta chunks'
  },

  finishReason: {
    required: (chunk) => chunk.type === 'message_end',
    type: 'enum',
    values: ['stop', 'length', 'tool_calls', 'content_filter', 'error'],
    message: 'Finish reason required for message_end chunks'
  },

  error: {
    required: (chunk) => chunk.type === 'error',
    type: 'object',
    message: 'Error required for error chunks'
  }
};
```

### Configuration Validation

```typescript
/**
 * Validation rules for BridgeConfig
 */
const BRIDGE_CONFIG_VALIDATION_RULES = {
  timeout: {
    required: false,
    type: 'number',
    min: 1,
    message: 'Timeout must be positive'
  },

  debug: {
    required: false,
    type: 'boolean'
  },

  validate: {
    required: false,
    type: 'boolean'
  },

  strictMode: {
    required: false,
    type: 'boolean'
  },

  trackLatency: {
    required: false,
    type: 'boolean'
  }
};

/**
 * Validation rules for BackendAdapterConfig
 */
const BACKEND_CONFIG_VALIDATION_RULES = {
  endpoint: {
    required: true,
    type: 'string',
    validator: (value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:' ||
          'Endpoint must be valid HTTP/HTTPS URL';
      } catch {
        return 'Endpoint must be valid URL';
      }
    }
  },

  apiKey: {
    required: false,
    type: 'string',
    minLength: 1,
    message: 'API key must not be empty if provided'
  },

  timeout: {
    required: false,
    type: 'number',
    min: 1,
    message: 'Timeout must be positive'
  },

  maxRetries: {
    required: false,
    type: 'number',
    min: 0,
    integer: true,
    message: 'Max retries must be non-negative integer'
  }
};
```

---

## Appendix: Type Utilities

### Helper Types

```typescript
/**
 * Extract adapter type from adapter name
 */
type ExtractAdapterType<T extends string> =
  T extends `${infer Type}-${string}` ? Type : never;

/**
 * Extract provider from adapter name
 */
type ExtractProvider<T extends string> =
  T extends `${string}-${infer Provider}` ? Provider : never;

/**
 * Make specific fields required
 */
type RequireFields<T, K extends keyof T> =
  T & Required<Pick<T, K>>;

/**
 * Make specific fields optional
 */
type OptionalFields<T, K extends keyof T> =
  Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Deep readonly
 */
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Deep partial
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Async or sync result
 */
type MaybePromise<T> = T | Promise<T>;

/**
 * Extract async result type
 */
type Awaited<T> = T extends Promise<infer U> ? U : T;
```

---

## Document Metadata

**Version**: 1.0.0
**Created**: 2025-10-13
**Status**: Draft
**Authors**: Claude Code
**Related Documents**:
- Feature Specification: `/Users/johnhenry/Projects/ai.matey.universal/specs/001-universal-ai-adapter/spec.md`
- Research Document: `/Users/johnhenry/Projects/ai.matey.universal/specs/001-universal-ai-adapter/research.md`

**Change History**:
- 2025-10-13: Initial version created

**Review Status**: Pending Review
