/**
 * Bridge Class Public API
 *
 * The Bridge is the primary developer-facing API for the Universal AI Adapter System.
 * It connects a frontend adapter to one or more backend adapters, with embedded
 * router and middleware stack for orchestration and cross-cutting concerns.
 *
 * Key features:
 * - Simple API: `new Bridge(frontend, backend)` or `frontend.connect(backend)`
 * - Automatic IR translation through adapter chain
 * - Embedded router for dynamic backend selection
 * - Middleware stack for logging, caching, telemetry, etc.
 * - Both streaming and non-streaming support
 * - Full TypeScript type safety
 *
 * @example
 * ```typescript
 * // Simple usage: direct frontend-to-backend
 * const bridge = new Bridge(
 *   new AnthropicFrontendAdapter(),
 *   new OpenAIBackendAdapter({ apiKey: 'sk-...' })
 * );
 *
 * const response = await bridge.chat(anthropicRequest);
 *
 * // Advanced usage: router with multiple backends
 * const bridge = new Bridge(
 *   new OpenAIFrontendAdapter(),
 *   new Router()
 *     .register('openai', new OpenAIBackendAdapter({ apiKey: 'sk-...' }))
 *     .register('anthropic', new AnthropicBackendAdapter({ apiKey: 'sk-...' }))
 *     .setFallbackChain(['openai', 'anthropic'])
 * );
 *
 * // With middleware
 * bridge.use(loggingMiddleware);
 * bridge.use(cachingMiddleware);
 *
 * const response = await bridge.chat(openaiRequest);
 * ```
 */

import type {
  FrontendAdapter,
  BackendAdapter,
  InferFrontendRequest,
  InferFrontendResponse,
  InferFrontendStreamChunk,
} from './adapters';
import type { Router, RouterConfig } from './router';
import type { Middleware, MiddlewareContext } from './middleware';
import type { IRChatRequest, IRChatResponse, IRChatStream } from './ir';

// ============================================================================
// Bridge Configuration
// ============================================================================

/**
 * Configuration options for Bridge.
 *
 * @example
 * ```typescript
 * const config: BridgeConfig = {
 *   debug: true,
 *   timeout: 60000,
 *   retries: 3,
 *   defaultModel: 'gpt-4',
 *   routerConfig: {
 *     fallbackStrategy: 'sequential',
 *     healthCheckInterval: 30000
 *   }
 * };
 * ```
 */
export interface BridgeConfig {
  /**
   * Enable debug mode with detailed logging.
   * @default false
   */
  readonly debug?: boolean;

  /**
   * Global timeout for requests in milliseconds.
   * Can be overridden per request.
   * @default 30000
   */
  readonly timeout?: number;

  /**
   * Maximum retries for transient failures.
   * @default 0
   */
  readonly retries?: number;

  /**
   * Default model to use if not specified in request.
   */
  readonly defaultModel?: string;

  /**
   * Router configuration (if using router as backend).
   */
  readonly routerConfig?: Partial<RouterConfig>;

  /**
   * Automatically add request ID to metadata if not present.
   * @default true
   */
  readonly autoRequestId?: boolean;

  /**
   * Custom configuration options.
   */
  readonly custom?: Record<string, unknown>;
}

// ============================================================================
// Request Options
// ============================================================================

/**
 * Per-request options for overriding defaults.
 *
 * @example
 * ```typescript
 * const options: RequestOptions = {
 *   timeout: 60000,
 *   signal: abortController.signal,
 *   backend: 'anthropic', // Override router's default backend selection
 *   metadata: {
 *     userId: 'user_123',
 *     sessionId: 'session_456'
 *   }
 * };
 *
 * const response = await bridge.chat(request, options);
 * ```
 */
export interface RequestOptions {
  /**
   * Request timeout in milliseconds.
   * Overrides bridge default.
   */
  readonly timeout?: number;

  /**
   * AbortSignal for request cancellation.
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   * setTimeout(() => controller.abort(), 5000); // Cancel after 5s
   *
   * const response = await bridge.chat(request, {
   *   signal: controller.signal
   * });
   * ```
   */
  readonly signal?: AbortSignal;

  /**
   * Preferred backend identifier (for router).
   * If specified, router will try this backend first.
   */
  readonly backend?: string;

  /**
   * Additional metadata to attach to request.
   * Merged with auto-generated metadata.
   */
  readonly metadata?: Record<string, unknown>;

  /**
   * Skip middleware execution for this request.
   * Useful for debugging or bypass scenarios.
   * @default false
   */
  readonly skipMiddleware?: boolean;

  /**
   * Custom request options.
   */
  readonly custom?: Record<string, unknown>;
}

// ============================================================================
// Bridge Events
// ============================================================================

/**
 * Event types emitted by Bridge.
 */
export const BridgeEventType = {
  /**
   * Request started.
   */
  REQUEST_START: 'request:start',

  /**
   * Request completed successfully.
   */
  REQUEST_SUCCESS: 'request:success',

  /**
   * Request failed with error.
   */
  REQUEST_ERROR: 'request:error',

  /**
   * Request cancelled by client.
   */
  REQUEST_CANCELLED: 'request:cancelled',

  /**
   * Streaming started.
   */
  STREAM_START: 'stream:start',

  /**
   * Stream chunk received.
   */
  STREAM_CHUNK: 'stream:chunk',

  /**
   * Stream completed.
   */
  STREAM_COMPLETE: 'stream:complete',

  /**
   * Stream error.
   */
  STREAM_ERROR: 'stream:error',

  /**
   * Backend selected by router.
   */
  BACKEND_SELECTED: 'backend:selected',

  /**
   * Backend failover occurred.
   */
  BACKEND_FAILOVER: 'backend:failover',

  /**
   * Middleware executed.
   */
  MIDDLEWARE_EXECUTED: 'middleware:executed',
} as const;

export type BridgeEventType = typeof BridgeEventType[keyof typeof BridgeEventType];

/**
 * Base event interface.
 */
export interface BridgeEvent {
  readonly type: BridgeEventType;
  readonly timestamp: number;
  readonly requestId?: string;
}

/**
 * Request event with request details.
 */
export interface RequestEvent extends BridgeEvent {
  readonly type:
    | typeof BridgeEventType.REQUEST_START
    | typeof BridgeEventType.REQUEST_SUCCESS
    | typeof BridgeEventType.REQUEST_ERROR
    | typeof BridgeEventType.REQUEST_CANCELLED;
  readonly request: IRChatRequest;
  readonly response?: IRChatResponse;
  readonly error?: Error;
  readonly durationMs?: number;
}

/**
 * Stream event with stream details.
 */
export interface StreamEvent extends BridgeEvent {
  readonly type:
    | typeof BridgeEventType.STREAM_START
    | typeof BridgeEventType.STREAM_CHUNK
    | typeof BridgeEventType.STREAM_COMPLETE
    | typeof BridgeEventType.STREAM_ERROR;
  readonly request: IRChatRequest;
  readonly chunkSequence?: number;
  readonly error?: Error;
  readonly durationMs?: number;
}

/**
 * Backend event with backend details.
 */
export interface BackendEvent extends BridgeEvent {
  readonly type:
    | typeof BridgeEventType.BACKEND_SELECTED
    | typeof BridgeEventType.BACKEND_FAILOVER;
  readonly backend: string;
  readonly previousBackend?: string;
  readonly reason?: string;
}

/**
 * Middleware event with middleware details.
 */
export interface MiddlewareEvent extends BridgeEvent {
  readonly type: typeof BridgeEventType.MIDDLEWARE_EXECUTED;
  readonly middlewareName: string;
  readonly durationMs: number;
  readonly phase: 'request' | 'response';
}

/**
 * Union of all event types.
 */
export type BridgeEventData = RequestEvent | StreamEvent | BackendEvent | MiddlewareEvent;

/**
 * Event listener function.
 */
export type BridgeEventListener = (event: BridgeEventData) => void | Promise<void>;

// ============================================================================
// Bridge Statistics
// ============================================================================

/**
 * Runtime statistics collected by Bridge.
 *
 * Useful for monitoring, debugging, and optimization.
 *
 * @example
 * ```typescript
 * const stats = bridge.getStats();
 * console.log(`Total requests: ${stats.totalRequests}`);
 * console.log(`Success rate: ${stats.successRate}%`);
 * console.log(`Avg latency: ${stats.averageLatencyMs}ms`);
 * ```
 */
export interface BridgeStats {
  /**
   * Total requests processed.
   */
  readonly totalRequests: number;

  /**
   * Successful requests.
   */
  readonly successfulRequests: number;

  /**
   * Failed requests.
   */
  readonly failedRequests: number;

  /**
   * Success rate (0-100).
   */
  readonly successRate: number;

  /**
   * Total streaming requests.
   */
  readonly streamingRequests: number;

  /**
   * Average request latency in milliseconds.
   */
  readonly averageLatencyMs: number;

  /**
   * P50 latency in milliseconds.
   */
  readonly p50LatencyMs: number;

  /**
   * P95 latency in milliseconds.
   */
  readonly p95LatencyMs: number;

  /**
   * P99 latency in milliseconds.
   */
  readonly p99LatencyMs: number;

  /**
   * Backend usage breakdown (backend name → request count).
   */
  readonly backendUsage: Record<string, number>;

  /**
   * Error breakdown (error code → count).
   */
  readonly errorBreakdown: Record<string, number>;

  /**
   * When statistics were last reset.
   */
  readonly sinceTimestamp: number;
}

// ============================================================================
// Main Bridge Interface
// ============================================================================

/**
 * The Bridge connects frontend and backend adapters with routing and middleware.
 *
 * This is the main developer-facing API. Create a bridge with your desired
 * frontend adapter and backend adapter(s), optionally add middleware, and
 * start making requests.
 *
 * @template TFrontend Frontend adapter type
 *
 * @example
 * ```typescript
 * // Simple bridge: Anthropic frontend → OpenAI backend
 * const simpleBridge = new Bridge(
 *   new AnthropicFrontendAdapter(),
 *   new OpenAIBackendAdapter({ apiKey: 'sk-...' })
 * );
 *
 * // Request using Anthropic format
 * const response = await simpleBridge.chat({
 *   model: 'claude-3-opus',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   system: 'You are helpful'
 * });
 *
 * // Router-based bridge with multiple backends
 * const router = new Router()
 *   .register('openai', new OpenAIBackendAdapter({ apiKey: 'sk-...' }))
 *   .register('anthropic', new AnthropicBackendAdapter({ apiKey: 'sk-...' }))
 *   .setFallbackChain(['openai', 'anthropic']);
 *
 * const advancedBridge = new Bridge(
 *   new OpenAIFrontendAdapter(),
 *   router,
 *   { debug: true, timeout: 60000 }
 * );
 *
 * // Add middleware
 * advancedBridge.use(loggingMiddleware);
 * advancedBridge.use(cachingMiddleware);
 *
 * // Make request - will try OpenAI, fallback to Anthropic if needed
 * const response = await advancedBridge.chat({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 *
 * // Streaming
 * const stream = advancedBridge.chatStream({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Tell me a story' }]
 * });
 *
 * for await (const chunk of stream) {
 *   process.stdout.write(chunk.delta);
 * }
 * ```
 */
export interface Bridge<TFrontend extends FrontendAdapter = FrontendAdapter> {
  /**
   * Frontend adapter for this bridge.
   */
  readonly frontend: TFrontend;

  /**
   * Backend adapter or router.
   */
  readonly backend: BackendAdapter | Router;

  /**
   * Bridge configuration.
   */
  readonly config: BridgeConfig;

  // ==========================================================================
  // Core Request Methods
  // ==========================================================================

  /**
   * Execute a non-streaming chat completion request.
   *
   * This is the primary method for making AI requests. It:
   * 1. Validates provider-specific request format
   * 2. Converts request to IR via frontend adapter
   * 3. Runs request through middleware stack
   * 4. Routes to backend (or uses router for dynamic selection)
   * 5. Runs response through middleware stack
   * 6. Converts IR response back to provider format via frontend adapter
   *
   * @param request Provider-specific request (typed to frontend adapter)
   * @param options Optional per-request options
   * @returns Provider-specific response (typed to frontend adapter)
   * @throws {ValidationError} If request is invalid
   * @throws {AuthenticationError} If API key is invalid
   * @throws {RateLimitError} If rate limited
   * @throws {ProviderError} If backend API fails
   * @throws {RouterError} If all backends fail (when using router)
   * @throws {MiddlewareError} If middleware fails
   *
   * @example
   * ```typescript
   * // Simple request
   * const response = await bridge.chat({
   *   model: 'gpt-4',
   *   messages: [
   *     { role: 'system', content: 'You are helpful' },
   *     { role: 'user', content: 'What is 2+2?' }
   *   ],
   *   temperature: 0.7
   * });
   *
   * console.log(response.choices[0].message.content);
   *
   * // With options
   * const controller = new AbortController();
   * const response = await bridge.chat(request, {
   *   timeout: 60000,
   *   signal: controller.signal,
   *   backend: 'anthropic' // Prefer Anthropic backend
   * });
   * ```
   */
  chat(
    request: InferFrontendRequest<TFrontend>,
    options?: RequestOptions
  ): Promise<InferFrontendResponse<TFrontend>>;

  /**
   * Execute a streaming chat completion request.
   *
   * Similar to `chat()` but returns an async generator that yields
   * provider-specific stream chunks as they arrive.
   *
   * Stream characteristics:
   * - Chunks arrive in order
   * - Can be cancelled via AbortSignal
   * - Errors are thrown, stream terminates
   * - Final chunk indicates completion
   *
   * @param request Provider-specific request (typed to frontend adapter)
   * @param options Optional per-request options
   * @returns Async generator of provider-specific stream chunks
   * @throws {ValidationError} If request is invalid
   * @throws {AuthenticationError} If API key is invalid
   * @throws {StreamError} If streaming fails
   * @throws {RouterError} If all backends fail (when using router)
   *
   * @example
   * ```typescript
   * // Stream a response
   * const stream = bridge.chatStream({
   *   model: 'gpt-4',
   *   messages: [{ role: 'user', content: 'Write a poem' }]
   * });
   *
   * let fullResponse = '';
   * for await (const chunk of stream) {
   *   const text = chunk.choices?.[0]?.delta?.content ?? '';
   *   fullResponse += text;
   *   process.stdout.write(text);
   * }
   *
   * // With cancellation
   * const controller = new AbortController();
   * setTimeout(() => controller.abort(), 5000); // Cancel after 5s
   *
   * try {
   *   for await (const chunk of bridge.chatStream(request, {
   *     signal: controller.signal
   *   })) {
   *     process.stdout.write(chunk.choices[0].delta.content);
   *   }
   * } catch (error) {
   *   if (error.code === 'STREAM_CANCELLED') {
   *     console.log('Stream cancelled');
   *   }
   * }
   * ```
   */
  chatStream(
    request: InferFrontendRequest<TFrontend>,
    options?: RequestOptions
  ): AsyncGenerator<InferFrontendStreamChunk<TFrontend>, void, undefined>;

  // ==========================================================================
  // Middleware Management
  // ==========================================================================

  /**
   * Add middleware to the bridge's middleware stack.
   *
   * Middleware executes in the order it's added:
   * - Request phase: first added → last added → backend
   * - Response phase: backend → last added → first added
   *
   * @param middleware Middleware function to add
   * @returns This bridge for chaining
   *
   * @example
   * ```typescript
   * bridge
   *   .use(loggingMiddleware)
   *   .use(cachingMiddleware)
   *   .use(telemetryMiddleware);
   *
   * // Request flow: logging → caching → telemetry → backend
   * // Response flow: backend → telemetry → caching → logging
   * ```
   */
  use(middleware: Middleware): this;

  /**
   * Remove middleware from the stack.
   *
   * @param middleware Middleware function to remove
   * @returns This bridge for chaining
   */
  removeMiddleware(middleware: Middleware): this;

  /**
   * Clear all middleware from the stack.
   *
   * @returns This bridge for chaining
   */
  clearMiddleware(): this;

  /**
   * Get all middleware in the stack.
   *
   * @returns Array of middleware functions
   */
  getMiddleware(): readonly Middleware[];

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Register event listener.
   *
   * Listen to bridge events for monitoring, logging, or debugging.
   *
   * @param event Event type or '*' for all events
   * @param listener Event listener function
   * @returns This bridge for chaining
   *
   * @example
   * ```typescript
   * // Listen to specific events
   * bridge.on('request:success', (event) => {
   *   console.log(`Request ${event.requestId} completed in ${event.durationMs}ms`);
   * });
   *
   * bridge.on('backend:failover', (event) => {
   *   console.log(`Failover from ${event.previousBackend} to ${event.backend}`);
   * });
   *
   * // Listen to all events
   * bridge.on('*', (event) => {
   *   console.log(`Event: ${event.type}`, event);
   * });
   * ```
   */
  on(event: BridgeEventType | '*', listener: BridgeEventListener): this;

  /**
   * Unregister event listener.
   *
   * @param event Event type or '*' for all events
   * @param listener Event listener function to remove
   * @returns This bridge for chaining
   */
  off(event: BridgeEventType | '*', listener: BridgeEventListener): this;

  /**
   * Register one-time event listener.
   *
   * Listener is automatically removed after first invocation.
   *
   * @param event Event type
   * @param listener Event listener function
   * @returns This bridge for chaining
   */
  once(event: BridgeEventType, listener: BridgeEventListener): this;

  // ==========================================================================
  // Statistics & Monitoring
  // ==========================================================================

  /**
   * Get runtime statistics.
   *
   * @returns Current statistics snapshot
   *
   * @example
   * ```typescript
   * const stats = bridge.getStats();
   * console.log('Statistics:');
   * console.log(`  Total: ${stats.totalRequests}`);
   * console.log(`  Success: ${stats.successfulRequests}`);
   * console.log(`  Failed: ${stats.failedRequests}`);
   * console.log(`  Rate: ${stats.successRate}%`);
   * console.log(`  Avg latency: ${stats.averageLatencyMs}ms`);
   * console.log(`  P95 latency: ${stats.p95LatencyMs}ms`);
   * ```
   */
  getStats(): BridgeStats;

  /**
   * Reset statistics.
   *
   * Clears all collected statistics and starts fresh.
   *
   * @example
   * ```typescript
   * bridge.resetStats();
   * // Statistics now start from zero
   * ```
   */
  resetStats(): void;

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get router instance (if backend is a router).
   *
   * @returns Router instance or null if using single backend
   */
  getRouter(): Router | null;

  /**
   * Clone bridge with new configuration.
   *
   * Creates a new bridge instance with the same frontend/backend
   * but different configuration. Middleware and event listeners
   * are not copied.
   *
   * @param config New configuration to merge with existing
   * @returns New bridge instance
   *
   * @example
   * ```typescript
   * const debugBridge = bridge.clone({
   *   debug: true,
   *   timeout: 120000
   * });
   *
   * // Original bridge unchanged, debug bridge has debug enabled
   * ```
   */
  clone(config: Partial<BridgeConfig>): Bridge<TFrontend>;

  /**
   * Clean up resources.
   *
   * Should be called when bridge is no longer needed to release
   * resources (event listeners, timers, etc.).
   *
   * @example
   * ```typescript
   * const bridge = new Bridge(frontend, backend);
   * try {
   *   await bridge.chat(request);
   * } finally {
   *   bridge.dispose();
   * }
   * ```
   */
  dispose(): void;
}

// ============================================================================
// Bridge Factory Functions
// ============================================================================

/**
 * Create a bridge with fluent API.
 *
 * Alternative constructor pattern with method chaining.
 *
 * @example
 * ```typescript
 * const bridge = createBridge()
 *   .withFrontend(new OpenAIFrontendAdapter())
 *   .withBackend(new OpenAIBackendAdapter({ apiKey: 'sk-...' }))
 *   .withConfig({ debug: true })
 *   .withMiddleware(loggingMiddleware)
 *   .withMiddleware(cachingMiddleware)
 *   .build();
 * ```
 */
export interface BridgeBuilder<TFrontend extends FrontendAdapter = any> {
  withFrontend<T extends FrontendAdapter>(frontend: T): BridgeBuilder<T>;
  withBackend(backend: BackendAdapter | Router): this;
  withConfig(config: Partial<BridgeConfig>): this;
  withMiddleware(middleware: Middleware): this;
  build(): Bridge<TFrontend>;
}

/**
 * Create a new bridge builder.
 */
export function createBridge(): BridgeBuilder {
  // Implementation would go here
  throw new Error('Not implemented - this is a contract definition');
}

// ============================================================================
// Convenience Extension Methods
// ============================================================================

/**
 * Extension methods added to FrontendAdapter for convenience.
 *
 * Allows `frontend.connect(backend)` as alternative to `new Bridge(frontend, backend)`.
 */
declare module './adapters' {
  interface FrontendAdapter {
    /**
     * Create a bridge by connecting this frontend to a backend.
     *
     * Convenience method equivalent to `new Bridge(this, backend, config)`.
     *
     * @param backend Backend adapter or router
     * @param config Optional bridge configuration
     * @returns New bridge instance
     *
     * @example
     * ```typescript
     * const frontend = new AnthropicFrontendAdapter();
     * const backend = new OpenAIBackendAdapter({ apiKey: 'sk-...' });
     *
     * const bridge = frontend.connect(backend, {
     *   debug: true,
     *   timeout: 60000
     * });
     *
     * const response = await bridge.chat(anthropicRequest);
     * ```
     */
    connect(backend: BackendAdapter | Router, config?: BridgeConfig): Bridge<this>;
  }
}
