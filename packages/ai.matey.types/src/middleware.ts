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
   * Available after routing decision.
   */
  readonly backend?: BackendAdapter;

  /**
   * Backend name/identifier.
   */
  readonly backendName?: string;

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
// Middleware Builder & Utilities
// ============================================================================

/**
 * Options for creating middleware.
 */
export interface MiddlewareOptions {
  /**
   * Middleware name for debugging/logging.
   */
  name?: string;

  /**
   * Whether middleware supports streaming.
   * @default false
   */
  supportsStreaming?: boolean;

  /**
   * Whether middleware should run before routing decision.
   * @default false
   */
  runBeforeRouting?: boolean;

  /**
   * Custom configuration for this middleware.
   */
  config?: Record<string, unknown>;
}

/**
 * Middleware with metadata.
 */
export interface MiddlewareWithMetadata {
  /**
   * Middleware name.
   */
  readonly name: string;

  /**
   * Whether middleware supports streaming.
   */
  readonly supportsStreaming: boolean;

  /**
   * Whether middleware runs before routing.
   */
  readonly runBeforeRouting: boolean;

  /**
   * Middleware configuration.
   */
  readonly config: Record<string, unknown>;

  /**
   * The middleware function.
   */
  readonly middleware: Middleware;

  /**
   * The streaming middleware function (if supported).
   */
  readonly streamingMiddleware?: StreamingMiddleware;
}

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
