/**
 * Bridge Types and Interfaces
 *
 * The Bridge is the primary developer-facing API for the Universal AI Adapter System.
 * It connects a frontend adapter to one or more backend adapters, with embedded
 * router and middleware stack for orchestration and cross-cutting concerns.
 *
 * @module
 */

import type {
  FrontendAdapter,
  BackendAdapter,
  InferFrontendRequest,
  InferFrontendResponse,
  InferFrontendStreamChunk,
} from './adapters.js';
import type { Router, RouterConfig } from './router.js';
import type { Middleware } from './middleware.js';
import type { IRChatRequest, IRChatResponse } from './ir.js';

// ============================================================================
// Bridge Configuration
// ============================================================================

/**
 * Configuration options for Bridge.
 */
export interface BridgeConfig {
  /**
   * Enable debug mode with detailed logging.
   * @default false
   */
  readonly debug?: boolean;

  /**
   * Global timeout for requests in milliseconds.
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
 */
export interface RequestOptions {
  /**
   * Request timeout in milliseconds.
   */
  readonly timeout?: number;

  /**
   * AbortSignal for request cancellation.
   */
  readonly signal?: AbortSignal;

  /**
   * Preferred backend identifier (for router).
   */
  readonly backend?: string;

  /**
   * Additional metadata to attach to request.
   */
  readonly metadata?: Record<string, unknown>;

  /**
   * Skip middleware execution for this request.
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
  REQUEST_START: 'request:start',
  REQUEST_SUCCESS: 'request:success',
  REQUEST_ERROR: 'request:error',
  REQUEST_CANCELLED: 'request:cancelled',
  STREAM_START: 'stream:start',
  STREAM_CHUNK: 'stream:chunk',
  STREAM_COMPLETE: 'stream:complete',
  STREAM_ERROR: 'stream:error',
  BACKEND_SELECTED: 'backend:selected',
  BACKEND_FAILOVER: 'backend:failover',
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
 * @template TFrontend Frontend adapter type
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
   */
  chat(
    request: InferFrontendRequest<TFrontend>,
    options?: RequestOptions
  ): Promise<InferFrontendResponse<TFrontend>>;

  /**
   * Execute a streaming chat completion request.
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
   */
  use(middleware: Middleware): Bridge<TFrontend>;

  /**
   * Remove middleware from the stack.
   */
  removeMiddleware(middleware: Middleware): Bridge<TFrontend>;

  /**
   * Clear all middleware from the stack.
   */
  clearMiddleware(): Bridge<TFrontend>;

  /**
   * Get all middleware in the stack.
   */
  getMiddleware(): readonly Middleware[];

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Register event listener.
   */
  on(event: BridgeEventType | '*', listener: BridgeEventListener): Bridge<TFrontend>;

  /**
   * Unregister event listener.
   */
  off(event: BridgeEventType | '*', listener: BridgeEventListener): Bridge<TFrontend>;

  /**
   * Register one-time event listener.
   */
  once(event: BridgeEventType, listener: BridgeEventListener): Bridge<TFrontend>;

  // ==========================================================================
  // Statistics & Monitoring
  // ==========================================================================

  /**
   * Get runtime statistics.
   */
  getStats(): BridgeStats;

  /**
   * Reset statistics.
   */
  resetStats(): void;

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get router instance (if backend is a router).
   */
  getRouter(): Router | null;

  /**
   * Clone bridge with new configuration.
   */
  clone(config: Partial<BridgeConfig>): Bridge<TFrontend>;

  /**
   * Clean up resources.
   */
  dispose(): void;
}

// ============================================================================
// Bridge Factory Functions
// ============================================================================

/**
 * Bridge builder for fluent API.
 */
export interface BridgeBuilder<TFrontend extends FrontendAdapter = FrontendAdapter> {
  withFrontend<T extends FrontendAdapter>(frontend: T): BridgeBuilder<T>;
  withBackend(backend: BackendAdapter | Router): BridgeBuilder<TFrontend>;
  withConfig(config: Partial<BridgeConfig>): BridgeBuilder<TFrontend>;
  withMiddleware(middleware: Middleware): BridgeBuilder<TFrontend>;
  build(): Bridge<TFrontend>;
}
