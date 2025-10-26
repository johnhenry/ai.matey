/**
 * Frontend and Backend Adapter Interfaces
 *
 * Adapters are the core translation layer between provider-specific formats
 * and the universal Intermediate Representation (IR).
 *
 * Architecture:
 * - Frontend Adapters: Normalize provider-specific requests → IR
 * - Backend Adapters: Transform IR → provider API calls → IR responses
 * - Both implement common interface with metadata for router decisions
 *
 * @example
 * ```typescript
 * // Using adapters directly
 * const anthropicFrontend = new AnthropicFrontendAdapter();
 * const openaiBackend = new OpenAIBackendAdapter({ apiKey: 'sk-...' });
 *
 * const irRequest = await anthropicFrontend.toIR(anthropicRequest);
 * const irResponse = await openaiBackend.execute(irRequest);
 * const anthropicResponse = await anthropicFrontend.fromIR(irResponse);
 * ```
 */

import type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRCapabilities,
  IRMetadata,
} from './ir';
import type { AdapterError } from './errors';

// ============================================================================
// Adapter Metadata
// ============================================================================

/**
 * Adapter identification and capability metadata.
 *
 * Used by router for backend selection and compatibility checking.
 *
 * @example
 * ```typescript
 * const metadata: AdapterMetadata = {
 *   name: 'openai',
 *   version: '1.0.0',
 *   provider: 'OpenAI',
 *   capabilities: {
 *     streaming: true,
 *     multiModal: true,
 *     maxContextTokens: 128000,
 *     supportedModels: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
 *     systemMessageStrategy: 'in-messages',
 *     supportsMultipleSystemMessages: true
 *   }
 * };
 * ```
 */
export interface AdapterMetadata {
  /**
   * Unique adapter identifier (lowercase, no spaces).
   * Used for routing and logging.
   */
  readonly name: string;

  /**
   * Semantic version of adapter implementation.
   */
  readonly version: string;

  /**
   * Human-readable provider name.
   */
  readonly provider: string;

  /**
   * Adapter capabilities for router decisions.
   */
  readonly capabilities: IRCapabilities;

  /**
   * Optional adapter-specific configuration.
   */
  readonly config?: Record<string, unknown>;
}

// ============================================================================
// Frontend Adapter Interface
// ============================================================================

/**
 * Frontend adapter interface.
 *
 * Frontend adapters represent how developers want to interact with AI APIs.
 * They normalize provider-specific request formats into universal IR and
 * denormalize IR responses back to provider-specific formats.
 *
 * Responsibilities:
 * - Convert provider-specific request format → IR
 * - Convert IR response → provider-specific format
 * - Handle provider-specific quirks (system message placement, etc.)
 * - Validate input according to provider's expectations
 *
 * @template TRequest Provider-specific request type
 * @template TResponse Provider-specific response type
 * @template TStreamChunk Provider-specific stream chunk type
 *
 * @example
 * ```typescript
 * // Implement Anthropic frontend adapter
 * class AnthropicFrontendAdapter implements FrontendAdapter<
 *   AnthropicRequest,
 *   AnthropicResponse,
 *   AnthropicStreamChunk
 * > {
 *   readonly metadata: AdapterMetadata = {
 *     name: 'anthropic',
 *     version: '1.0.0',
 *     provider: 'Anthropic',
 *     capabilities: {
 *       streaming: true,
 *       multiModal: false,
 *       maxContextTokens: 100000,
 *       supportedModels: ['claude-3-opus', 'claude-3-sonnet'],
 *       systemMessageStrategy: 'separate-parameter',
 *       supportsMultipleSystemMessages: false
 *     }
 *   };
 *
 *   async toIR(request: AnthropicRequest): Promise<IRChatRequest> {
 *     // Convert Anthropic format to IR
 *     return {
 *       messages: request.messages,
 *       parameters: {
 *         model: request.model,
 *         temperature: request.temperature,
 *         maxTokens: request.max_tokens
 *       },
 *       metadata: {
 *         requestId: crypto.randomUUID(),
 *         timestamp: Date.now(),
 *         provenance: {
 *           frontend: this.metadata.name
 *         }
 *       }
 *     };
 *   }
 *
 *   async fromIR(response: IRChatResponse): Promise<AnthropicResponse> {
 *     // Convert IR back to Anthropic format
 *     return {
 *       id: response.metadata.requestId,
 *       type: 'message',
 *       role: 'assistant',
 *       content: [{ type: 'text', text: response.message.content }],
 *       stop_reason: response.finishReason,
 *       usage: {
 *         input_tokens: response.usage?.promptTokens ?? 0,
 *         output_tokens: response.usage?.completionTokens ?? 0
 *       }
 *     };
 *   }
 *
 *   async *fromIRStream(stream: IRChatStream): AsyncGenerator<AnthropicStreamChunk> {
 *     for await (const chunk of stream) {
 *       if (chunk.type === 'content') {
 *         yield {
 *           type: 'content_block_delta',
 *           delta: { type: 'text_delta', text: chunk.delta }
 *         };
 *       }
 *     }
 *   }
 * }
 * ```
 */
export interface FrontendAdapter<TRequest = unknown, TResponse = unknown, TStreamChunk = unknown> {
  /**
   * Adapter metadata for identification and capabilities.
   */
  readonly metadata: AdapterMetadata;

  /**
   * Convert provider-specific request to universal IR.
   *
   * This method normalizes the provider's request format into the universal
   * IR that can be consumed by any backend adapter.
   *
   * Responsibilities:
   * - Parse and validate provider-specific request structure
   * - Extract messages and normalize to IR message format
   * - Extract parameters and normalize to IR parameter ranges
   * - Handle provider-specific features (e.g., system message extraction)
   * - Generate request ID and metadata
   * - Emit warnings for semantic drift or unsupported features
   *
   * @param request Provider-specific request object
   * @returns Universal IR request
   * @throws {ValidationError} If request is invalid for this provider
   * @throws {AdapterConversionError} If conversion fails
   *
   * @example
   * ```typescript
   * const anthropicRequest = {
   *   model: 'claude-3-opus',
   *   messages: [{ role: 'user', content: 'Hello' }],
   *   system: 'You are helpful',
   *   temperature: 0.7,
   *   max_tokens: 1000
   * };
   *
   * const irRequest = await adapter.toIR(anthropicRequest);
   * // IR request now has normalized format usable by any backend
   * ```
   */
  toIR(request: TRequest): Promise<IRChatRequest>;

  /**
   * Convert universal IR response to provider-specific format.
   *
   * This method denormalizes an IR response back to the format expected
   * by code written against this provider's API.
   *
   * Responsibilities:
   * - Transform IR response structure to provider format
   * - Map finish reasons to provider-specific values
   * - Convert token usage to provider's format
   * - Preserve provider-specific metadata
   * - Handle semantic drift in reverse direction
   *
   * @param response Universal IR response
   * @returns Provider-specific response object
   * @throws {AdapterConversionError} If conversion fails
   *
   * @example
   * ```typescript
   * const irResponse = {
   *   message: { role: 'assistant', content: 'Hello!' },
   *   finishReason: 'stop',
   *   usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
   *   metadata: { requestId: 'req_123', timestamp: Date.now() }
   * };
   *
   * const anthropicResponse = await adapter.fromIR(irResponse);
   * // Response now matches Anthropic's expected format
   * ```
   */
  fromIR(response: IRChatResponse): Promise<TResponse>;

  /**
   * Convert universal IR stream to provider-specific stream format.
   *
   * This method wraps an IR stream and yields provider-specific chunks
   * that match the provider's streaming protocol.
   *
   * Responsibilities:
   * - Transform IR stream chunks to provider format
   * - Handle provider-specific chunk types and events
   * - Preserve streaming sequence and metadata
   * - Emit provider-specific completion events
   *
   * @param stream Universal IR stream
   * @returns Provider-specific stream of chunks
   * @throws {StreamError} If stream processing fails
   *
   * @example
   * ```typescript
   * const irStream = backend.executeStream(irRequest);
   * const anthropicStream = adapter.fromIRStream(irStream);
   *
   * for await (const chunk of anthropicStream) {
   *   if (chunk.type === 'content_block_delta') {
   *     process.stdout.write(chunk.delta.text);
   *   }
   * }
   * ```
   */
  fromIRStream(stream: IRChatStream): AsyncGenerator<TStreamChunk, void, undefined>;

  /**
   * Optional: Validate provider-specific request before conversion.
   *
   * Frontend adapters can implement this to catch invalid requests early
   * before attempting IR conversion.
   *
   * @param request Provider-specific request
   * @throws {ValidationError} If request is invalid
   */
  validate?(request: TRequest): Promise<void>;
}

// ============================================================================
// Backend Adapter Interface
// ============================================================================

/**
 * Configuration options for backend adapters.
 *
 * @example
 * ```typescript
 * const config: BackendAdapterConfig = {
 *   apiKey: process.env.OPENAI_API_KEY,
 *   baseURL: 'https://api.openai.com/v1',
 *   timeout: 30000,
 *   maxRetries: 3,
 *   debug: true
 * };
 * ```
 */
export interface BackendAdapterConfig {
  /**
   * API key for authentication.
   * Should be injected from environment or secure config.
   */
  readonly apiKey: string;

  /**
   * Base URL for API endpoint.
   * Useful for proxies or alternative endpoints.
   */
  readonly baseURL?: string;

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  readonly timeout?: number;

  /**
   * Maximum number of retries for transient failures.
   * @default 0
   */
  readonly maxRetries?: number;

  /**
   * Enable debug logging.
   * @default false
   */
  readonly debug?: boolean;

  /**
   * Custom HTTP headers to include in requests.
   */
  readonly headers?: Record<string, string>;

  /**
   * Provider-specific configuration options.
   */
  readonly custom?: Record<string, unknown>;
}

/**
 * Backend adapter interface.
 *
 * Backend adapters handle actual API calls to AI providers. They transform
 * universal IR into provider-specific API requests and normalize responses
 * back to IR.
 *
 * Responsibilities:
 * - Convert IR → provider-specific API request
 * - Make HTTP request to provider API
 * - Handle authentication, headers, retries
 * - Parse provider response → IR
 * - Handle provider-specific streaming protocols
 * - Normalize provider errors to universal error types
 *
 * @example
 * ```typescript
 * // Implement OpenAI backend adapter
 * class OpenAIBackendAdapter implements BackendAdapter {
 *   readonly metadata: AdapterMetadata = {
 *     name: 'openai',
 *     version: '1.0.0',
 *     provider: 'OpenAI',
 *     capabilities: {
 *       streaming: true,
 *       multiModal: true,
 *       maxContextTokens: 128000,
 *       supportedModels: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
 *       systemMessageStrategy: 'in-messages',
 *       supportsMultipleSystemMessages: true
 *     }
 *   };
 *
 *   constructor(private config: BackendAdapterConfig) {}
 *
 *   async execute(request: IRChatRequest): Promise<IRChatResponse> {
 *     // Convert IR to OpenAI format
 *     const openaiRequest = {
 *       model: request.parameters?.model ?? 'gpt-4',
 *       messages: request.messages.map(msg => ({
 *         role: msg.role,
 *         content: msg.content
 *       })),
 *       temperature: request.parameters?.temperature,
 *       max_tokens: request.parameters?.maxTokens
 *     };
 *
 *     // Make API call
 *     const response = await fetch(`${this.config.baseURL}/chat/completions`, {
 *       method: 'POST',
 *       headers: {
 *         'Authorization': `Bearer ${this.config.apiKey}`,
 *         'Content-Type': 'application/json'
 *       },
 *       body: JSON.stringify(openaiRequest)
 *     });
 *
 *     if (!response.ok) {
 *       throw createErrorFromHttpResponse(
 *         response.status,
 *         response.statusText,
 *         await response.json(),
 *         { backend: this.metadata.name }
 *       );
 *     }
 *
 *     const openaiResponse = await response.json();
 *
 *     // Convert OpenAI response to IR
 *     return {
 *       message: {
 *         role: 'assistant',
 *         content: openaiResponse.choices[0].message.content
 *       },
 *       finishReason: openaiResponse.choices[0].finish_reason,
 *       usage: {
 *         promptTokens: openaiResponse.usage.prompt_tokens,
 *         completionTokens: openaiResponse.usage.completion_tokens,
 *         totalTokens: openaiResponse.usage.total_tokens
 *       },
 *       metadata: {
 *         ...request.metadata,
 *         provenance: {
 *           ...request.metadata.provenance,
 *           backend: this.metadata.name
 *         }
 *       }
 *     };
 *   }
 *
 *   async *executeStream(request: IRChatRequest): IRChatStream {
 *     // Streaming implementation
 *     // ... SSE parsing, chunk normalization, etc.
 *   }
 * }
 * ```
 */
export interface BackendAdapter {
  /**
   * Adapter metadata for identification and capabilities.
   */
  readonly metadata: AdapterMetadata;

  /**
   * Execute non-streaming chat completion request.
   *
   * Transforms IR request to provider format, makes API call,
   * and normalizes response back to IR.
   *
   * Responsibilities:
   * - Convert IR request to provider-specific format
   * - Handle system message placement per provider requirements
   * - Make authenticated HTTP request to provider API
   * - Parse provider response
   * - Normalize response to IR format
   * - Handle provider-specific errors
   * - Apply semantic drift warnings if needed
   *
   * @param request Universal IR request
   * @param signal Optional AbortSignal for cancellation
   * @returns Universal IR response
   * @throws {AuthenticationError} If API key is invalid
   * @throws {ValidationError} If request is invalid for this provider
   * @throws {ProviderError} If provider API returns error
   * @throws {NetworkError} If network request fails
   * @throws {AdapterConversionError} If response parsing fails
   *
   * @example
   * ```typescript
   * const adapter = new OpenAIBackendAdapter({ apiKey: 'sk-...' });
   *
   * const irRequest: IRChatRequest = {
   *   messages: [{ role: 'user', content: 'Hello!' }],
   *   parameters: { model: 'gpt-4', temperature: 0.7 },
   *   metadata: { requestId: 'req_123', timestamp: Date.now() }
   * };
   *
   * const irResponse = await adapter.execute(irRequest);
   * console.log(irResponse.message.content); // AI's response
   * ```
   */
  execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse>;

  /**
   * Execute streaming chat completion request.
   *
   * Transforms IR request to provider format, initiates streaming request,
   * and normalizes stream chunks to IR format.
   *
   * Responsibilities:
   * - Convert IR request to provider-specific streaming format
   * - Establish streaming connection (SSE, WebSocket, etc.)
   * - Parse provider-specific stream format
   * - Normalize chunks to IR stream chunks
   * - Handle stream interruptions and errors
   * - Emit final completion chunk with accumulated state
   *
   * Stream guarantees:
   * - Chunks arrive in sequence order (sequence numbers increment)
   * - Last chunk is always type 'done' (even on error)
   * - Stream can be cancelled via AbortSignal
   * - Errors are thrown, stream terminates gracefully
   *
   * @param request Universal IR request
   * @param signal Optional AbortSignal for cancellation
   * @returns Universal IR stream of chunks
   * @throws {AuthenticationError} If API key is invalid
   * @throws {ValidationError} If request is invalid for this provider
   * @throws {ProviderError} If provider API returns error
   * @throws {NetworkError} If network request fails
   * @throws {StreamError} If stream parsing or processing fails
   *
   * @example
   * ```typescript
   * const adapter = new OpenAIBackendAdapter({ apiKey: 'sk-...' });
   *
   * const irRequest: IRChatRequest = {
   *   messages: [{ role: 'user', content: 'Write a story' }],
   *   parameters: { model: 'gpt-4' },
   *   metadata: { requestId: 'req_123', timestamp: Date.now() },
   *   stream: true
   * };
   *
   * const stream = adapter.executeStream(irRequest);
   *
   * for await (const chunk of stream) {
   *   if (chunk.type === 'content') {
   *     process.stdout.write(chunk.delta);
   *   } else if (chunk.type === 'done') {
   *     console.log('\nFinish reason:', chunk.finishReason);
   *   }
   * }
   * ```
   */
  executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream;

  /**
   * Optional: Health check to verify backend is available.
   *
   * Used by router for backend selection and failover.
   *
   * @returns true if backend is healthy and available
   */
  healthCheck?(): Promise<boolean>;

  /**
   * Optional: Estimate cost for a request.
   *
   * Useful for cost-aware routing decisions.
   *
   * @param request IR request to estimate cost for
   * @returns Estimated cost in USD (or null if unavailable)
   */
  estimateCost?(request: IRChatRequest): Promise<number | null>;
}

// ============================================================================
// Adapter Registry
// ============================================================================

/**
 * Registry for managing available adapters.
 *
 * Used internally by routers and bridges to discover and instantiate adapters.
 *
 * @example
 * ```typescript
 * const registry = new AdapterRegistry();
 *
 * // Register frontend adapters
 * registry.registerFrontend('anthropic', AnthropicFrontendAdapter);
 * registry.registerFrontend('openai', OpenAIFrontendAdapter);
 *
 * // Register backend adapters
 * registry.registerBackend('anthropic', AnthropicBackendAdapter);
 * registry.registerBackend('openai', OpenAIBackendAdapter);
 *
 * // Get adapter
 * const frontend = registry.getFrontend('anthropic');
 * const backend = registry.getBackend('openai', { apiKey: 'sk-...' });
 * ```
 */
export interface AdapterRegistry {
  /**
   * Register a frontend adapter type.
   *
   * @param name Unique adapter identifier
   * @param adapterClass Frontend adapter constructor
   */
  registerFrontend<T extends FrontendAdapter>(
    name: string,
    adapterClass: new () => T
  ): void;

  /**
   * Register a backend adapter type.
   *
   * @param name Unique adapter identifier
   * @param adapterClass Backend adapter constructor
   */
  registerBackend<T extends BackendAdapter>(
    name: string,
    adapterClass: new (config: BackendAdapterConfig) => T
  ): void;

  /**
   * Get frontend adapter instance by name.
   *
   * @param name Adapter identifier
   * @returns Frontend adapter instance
   * @throws {Error} If adapter not found
   */
  getFrontend(name: string): FrontendAdapter;

  /**
   * Get backend adapter instance by name.
   *
   * @param name Adapter identifier
   * @param config Backend configuration
   * @returns Backend adapter instance
   * @throws {Error} If adapter not found
   */
  getBackend(name: string, config: BackendAdapterConfig): BackendAdapter;

  /**
   * List all registered frontend adapters.
   */
  listFrontends(): string[];

  /**
   * List all registered backend adapters.
   */
  listBackends(): string[];

  /**
   * Check if frontend adapter is registered.
   */
  hasFrontend(name: string): boolean;

  /**
   * Check if backend adapter is registered.
   */
  hasBackend(name: string): boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Adapter pair for type-safe frontend/backend combinations.
 *
 * @example
 * ```typescript
 * type AnthropicToOpenAI = AdapterPair<
 *   AnthropicFrontendAdapter,
 *   OpenAIBackendAdapter
 * >;
 * ```
 */
export type AdapterPair<
  TFrontend extends FrontendAdapter = FrontendAdapter,
  TBackend extends BackendAdapter = BackendAdapter
> = {
  readonly frontend: TFrontend;
  readonly backend: TBackend;
};

/**
 * Infer provider request type from frontend adapter.
 */
export type InferFrontendRequest<T extends FrontendAdapter> = T extends FrontendAdapter<
  infer TRequest,
  any,
  any
>
  ? TRequest
  : never;

/**
 * Infer provider response type from frontend adapter.
 */
export type InferFrontendResponse<T extends FrontendAdapter> = T extends FrontendAdapter<
  any,
  infer TResponse,
  any
>
  ? TResponse
  : never;

/**
 * Infer provider stream chunk type from frontend adapter.
 */
export type InferFrontendStreamChunk<T extends FrontendAdapter> = T extends FrontendAdapter<
  any,
  any,
  infer TStreamChunk
>
  ? TStreamChunk
  : never;
