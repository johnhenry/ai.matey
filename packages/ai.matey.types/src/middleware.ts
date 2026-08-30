/**
 * Middleware Function Signatures
 *
 * Middleware provides composable transformation layers for cross-cutting concerns
 * like logging, caching, telemetry, prompt rewriting, and error handling.
 *
 * @module
 */

import type { IRChatRequest, IRChatResponse, IRChatStream, IRStreamChunk } from './ir.js';
import type { BackendAdapter } from './adapters.js';

// ============================================================================
// Middleware Context
// ============================================================================

/**
 * Context passed to middleware during execution.
 */
export interface MiddlewareContext {
  /**
   * The IR request being processed.
   * Middleware can inspect and modify this.
   */
  request: IRChatRequest;

  /**
   * Whether this is a streaming request.
   */
  readonly isStreaming: boolean;

  /**
   * Backend that will process (or processed) the request.
   *
   * Set by the bridge before the middleware chain runs, so it is available in both
   * the request phase (before `next()`) and the response phase (after it). Call
   * `backend.execute()` on it to run an extra turn of your own - an agentic tool
   * loop, a retry with a modified request, a failover - without having to be handed
   * an adapter separately.
   *
   * **It changes as the routing decision resolves.** Before the request is
   * dispatched this is whatever the bridge is about to call, which for a
   * router-backed bridge is the router itself: the specific provider is not yet
   * chosen, and executing through the router re-routes an extra turn the same way
   * the original request was routed. Once a response comes back the field is
   * narrowed to the backend that actually served it, when the router still has it
   * registered. A middleware that calls `next()` more than once sees the value for
   * its most recent dispatch.
   *
   * So an extra turn taken *before* `next()` is routed like the original request,
   * and one taken *after* it goes to the backend that just answered - which is
   * usually what a follow-up turn wants. To re-route deliberately, execute through
   * `bridge.getRouter()` instead.
   *
   * Undefined only when the context was built by hand rather than by a bridge.
   */
  backend?: BackendAdapter;

  /**
   * Name of {@link MiddlewareContext.backend}.
   *
   * Follows the same before/after rule: the router's name until a response has been
   * seen, the serving backend's name afterwards. Branching on it in the request
   * phase of a router-backed bridge therefore tells you about the router, not the
   * provider - the provider is not decided yet. The backend that served a completed
   * response is also reported on `response.metadata.provenance.backend`.
   */
  backendName?: string;

  /**
   * Shared state object for passing data between middleware.
   */
  readonly state: Record<string, unknown>;

  /**
   * Configuration from bridge.
   */
  readonly config: Record<string, unknown>;

  /**
   * Abort signal for request cancellation.
   */
  readonly signal?: AbortSignal;
}

/**
 * Context for streaming middleware.
 */
export interface StreamingMiddlewareContext extends MiddlewareContext {
  readonly isStreaming: true;

  /**
   * Current stream chunk being processed.
   */
  chunk?: IRStreamChunk;

  /**
   * Total chunks processed so far.
   */
  readonly chunksProcessed: number;

  /**
   * Whether stream has completed.
   */
  readonly streamComplete: boolean;
}

// ============================================================================
// Middleware Function Types
// ============================================================================

/**
 * Next function in middleware chain.
 */
export type MiddlewareNext = () => Promise<IRChatResponse>;

/**
 * Next function for streaming middleware chain.
 */
export type StreamingMiddlewareNext = () => Promise<IRChatStream>;

/**
 * Standard middleware function.
 */
export type Middleware = (
  context: MiddlewareContext,
  next: MiddlewareNext
) => Promise<IRChatResponse>;

/**
 * Streaming middleware function.
 */
export type StreamingMiddleware = (
  context: StreamingMiddlewareContext,
  next: StreamingMiddlewareNext
) => Promise<IRChatStream>;

// ============================================================================
// Middleware Registration
// ============================================================================
//
// There is no metadata wrapper around a middleware. `Middleware` and
// `StreamingMiddleware` are plain functions, registered with `bridge.use()` and
// `bridge.useStreaming()` in registration order.
//
// `MiddlewareOptions` and `MiddlewareWithMetadata` used to be declared here.
// They were exported, referenced by nothing, and had no registration path -
// `MiddlewareOptions.supportsStreaming` in particular read like the switch
// controlling whether a middleware ran on streams while being inert, and was
// opt-*in*, which is the behaviour #46 fixed. Both were removed in #63. Every
// `Middleware` now runs on the streaming path; the stack adapts it (see
// `adaptMiddlewareToStreaming`), and a middleware that needs chunk-level
// control is written as a `StreamingMiddleware`.

// ============================================================================
// Common Middleware Configuration
// ============================================================================

/**
 * Logger interface for logging middleware.
 */
export interface LoggingLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/**
 * Configuration for logging middleware.
 */
export interface LoggingMiddlewareConfig {
  /**
   * Minimum log level.
   * @default 'info'
   */
  level?: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Whether to log request bodies.
   * @default true
   */
  logRequests?: boolean;

  /**
   * Whether to log response bodies.
   * @default true
   */
  logResponses?: boolean;

  /**
   * Whether to log errors.
   * @default true
   */
  logErrors?: boolean;

  /**
   * Whether to sanitize sensitive data (API keys, tokens).
   * @default true
   */
  sanitize?: boolean;

  /**
   * Custom logger implementation.
   * @default console
   */
  logger?: LoggingLogger;

  /**
   * Custom log prefix.
   */
  prefix?: string;
}

/**
 * Configuration for caching middleware.
 */
export interface CachingMiddlewareConfig {
  /**
   * Cache key generator.
   * @default JSON.stringify(request)
   */
  keyGenerator?: (request: IRChatRequest) => string;

  /**
   * Cache TTL in milliseconds.
   * @default 3600000 (1 hour)
   */
  ttl?: number;

  /**
   * Maximum cache size.
   * @default 1000
   */
  maxSize?: number;

  /**
   * Cache storage implementation.
   */
  storage?: CacheStorage;
}

/**
 * Cache storage interface.
 */
export interface CacheStorage {
  get(key: string): Promise<IRChatResponse | undefined>;
  set(key: string, value: IRChatResponse, ttl?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

/**
 * Configuration for telemetry middleware.
 */
export interface TelemetryMiddlewareConfig {
  /**
   * Telemetry sink for sending metrics.
   */
  sink: TelemetrySink;

  /**
   * Whether to track request counts.
   * @default true
   */
  trackCounts?: boolean;

  /**
   * Whether to track latencies.
   * @default true
   */
  trackLatencies?: boolean;

  /**
   * Whether to track errors.
   * @default true
   */
  trackErrors?: boolean;

  /**
   * Whether to track token usage.
   * @default true
   */
  trackTokens?: boolean;
}

/**
 * Telemetry sink interface.
 */
export interface TelemetrySink {
  /**
   * Record a metric.
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void;

  /**
   * Record an event.
   */
  recordEvent(name: string, data?: Record<string, unknown>): void;
}
