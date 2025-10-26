/**
 * Middleware Function Signatures
 *
 * Middleware provides composable transformation layers for cross-cutting concerns
 * like logging, caching, telemetry, prompt rewriting, and error handling.
 *
 * Design principles:
 * - Composable: Middleware can be stacked in any order
 * - Async-first: All middleware is async for flexibility
 * - Type-safe: Strong typing for request/response flow
 * - Deterministic: Execution order is predictable
 * - Isolated: Middleware shouldn't know about other middleware
 *
 * Middleware operates on universal IR, making it provider-agnostic.
 * This means one logging middleware works with all adapters.
 *
 * @example
 * ```typescript
 * // Simple logging middleware
 * const loggingMiddleware: Middleware = async (context, next) => {
 *   console.log('Request:', context.request);
 *   const response = await next();
 *   console.log('Response:', response);
 *   return response;
 * };
 *
 * // Use with bridge
 * bridge.use(loggingMiddleware);
 * ```
 */

import type { IRChatRequest, IRChatResponse, IRChatStream, IRStreamChunk } from './ir';
import type { AdapterError } from './errors';
import type { BackendAdapter } from './adapters';

// ============================================================================
// Middleware Context
// ============================================================================

/**
 * Context passed to middleware during execution.
 *
 * Provides access to request, configuration, and shared state.
 *
 * @example
 * ```typescript
 * const middleware: Middleware = async (context, next) => {
 *   // Access request
 *   console.log('Model:', context.request.parameters?.model);
 *
 *   // Access metadata
 *   console.log('Request ID:', context.request.metadata.requestId);
 *
 *   // Store data for downstream middleware
 *   context.state.startTime = Date.now();
 *
 *   // Call next middleware
 *   const response = await next();
 *
 *   // Access state from downstream
 *   const duration = Date.now() - context.state.startTime;
 *   console.log('Duration:', duration);
 *
 *   return response;
 * };
 * ```
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
   * Each middleware can read/write to this object.
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
 *
 * Extends base context with streaming-specific information.
 */
export interface StreamingMiddlewareContext extends MiddlewareContext {
  readonly isStreaming: true;

  /**
   * Current stream chunk being processed.
   * Only available in stream middleware.
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
 *
 * Call this to pass control to the next middleware (or backend).
 * Must be called exactly once per middleware invocation.
 *
 * @returns Promise resolving to IR response
 */
export type MiddlewareNext = () => Promise<IRChatResponse>;

/**
 * Next function for streaming middleware chain.
 *
 * @returns Promise resolving to IR stream
 */
export type StreamingMiddlewareNext = () => Promise<IRChatStream>;

/**
 * Standard middleware function.
 *
 * Middleware has three phases:
 * 1. Pre-processing: Execute before calling next()
 * 2. Next call: Invoke next middleware/backend
 * 3. Post-processing: Execute after next() returns
 *
 * @param context Middleware context with request and state
 * @param next Function to call next middleware in chain
 * @returns Modified or original response
 * @throws Can throw errors to abort request chain
 *
 * @example
 * ```typescript
 * // Request/response logging
 * const loggingMiddleware: Middleware = async (context, next) => {
 *   const start = Date.now();
 *   console.log('[REQUEST]', context.request.metadata.requestId);
 *
 *   try {
 *     const response = await next();
 *     const duration = Date.now() - start;
 *     console.log('[RESPONSE]', context.request.metadata.requestId, `${duration}ms`);
 *     return response;
 *   } catch (error) {
 *     const duration = Date.now() - start;
 *     console.error('[ERROR]', context.request.metadata.requestId, `${duration}ms`, error);
 *     throw error;
 *   }
 * };
 *
 * // Request transformation
 * const promptRewriteMiddleware: Middleware = async (context, next) => {
 *   // Modify request before backend
 *   context.request = {
 *     ...context.request,
 *     messages: context.request.messages.map(msg => ({
 *       ...msg,
 *       content: typeof msg.content === 'string'
 *         ? msg.content.replace(/please/gi, '')
 *         : msg.content
 *     }))
 *   };
 *
 *   return next();
 * };
 *
 * // Response caching
 * const cachingMiddleware: Middleware = async (context, next) => {
 *   const cacheKey = JSON.stringify(context.request);
 *   const cached = cache.get(cacheKey);
 *
 *   if (cached) {
 *     console.log('Cache hit');
 *     return cached;
 *   }
 *
 *   const response = await next();
 *   cache.set(cacheKey, response);
 *   return response;
 * };
 * ```
 */
export type Middleware = (context: MiddlewareContext, next: MiddlewareNext) => Promise<IRChatResponse>;

/**
 * Streaming middleware function.
 *
 * For streaming requests, middleware can:
 * - Transform stream chunks
 * - Buffer/aggregate chunks
 * - Filter chunks
 * - Add metadata to chunks
 *
 * @param context Streaming middleware context
 * @param next Function to call next middleware in chain
 * @returns Modified or original stream
 *
 * @example
 * ```typescript
 * // Stream chunk logging
 * const streamLoggingMiddleware: StreamingMiddleware = async (context, next) => {
 *   const stream = await next();
 *
 *   async function* wrappedStream() {
 *     let chunkCount = 0;
 *     for await (const chunk of stream) {
 *       console.log(`Chunk ${chunkCount++}:`, chunk.type);
 *       yield chunk;
 *     }
 *   }
 *
 *   return wrappedStream();
 * };
 *
 * // Stream chunk transformation
 * const uppercaseStreamMiddleware: StreamingMiddleware = async (context, next) => {
 *   const stream = await next();
 *
 *   async function* transformedStream() {
 *     for await (const chunk of stream) {
 *       if (chunk.type === 'content') {
 *         yield {
 *           ...chunk,
 *           delta: chunk.delta.toUpperCase()
 *         };
 *       } else {
 *         yield chunk;
 *       }
 *     }
 *   }
 *
 *   return transformedStream();
 * };
 * ```
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
 *
 * Wraps middleware function with metadata for debugging and introspection.
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

/**
 * Create middleware with metadata.
 *
 * @example
 * ```typescript
 * const logging = createMiddleware({
 *   name: 'logging',
 *   supportsStreaming: true,
 *   config: { logLevel: 'info' }
 * }, async (context, next) => {
 *   console.log('Request:', context.request.metadata.requestId);
 *   return next();
 * });
 * ```
 */
export function createMiddleware(
  options: MiddlewareOptions,
  middleware: Middleware,
  streamingMiddleware?: StreamingMiddleware
): MiddlewareWithMetadata {
  return {
    name: options.name ?? 'anonymous',
    supportsStreaming: options.supportsStreaming ?? false,
    runBeforeRouting: options.runBeforeRouting ?? false,
    config: options.config ?? {},
    middleware,
    streamingMiddleware,
  };
}

/**
 * Compose multiple middleware into single middleware function.
 *
 * Executes middleware in order:
 * - Request phase: first → last → backend
 * - Response phase: backend → last → first
 *
 * @param middleware Array of middleware functions
 * @returns Composed middleware function
 *
 * @example
 * ```typescript
 * const composed = composeMiddleware([
 *   loggingMiddleware,
 *   cachingMiddleware,
 *   telemetryMiddleware
 * ]);
 *
 * bridge.use(composed);
 * ```
 */
export function composeMiddleware(middleware: readonly Middleware[]): Middleware {
  return async (context: MiddlewareContext, next: MiddlewareNext) => {
    let index = -1;

    async function dispatch(i: number): Promise<IRChatResponse> {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;

      if (i >= middleware.length) {
        return next();
      }

      return middleware[i](context, () => dispatch(i + 1));
    }

    return dispatch(0);
  };
}

// ============================================================================
// Common Middleware Patterns
// ============================================================================

/**
 * Create error handling middleware.
 *
 * Catches errors from downstream middleware/backend and handles them.
 *
 * @example
 * ```typescript
 * const errorHandler = createErrorHandler({
 *   onError: async (error, context) => {
 *     console.error('Request failed:', error);
 *     // Could emit metrics, send alerts, etc.
 *
 *     // Transform error or rethrow
 *     if (error.isRetryable) {
 *       // Could implement retry logic here
 *     }
 *     throw error;
 *   }
 * });
 * ```
 */
export function createErrorHandler(options: {
  name?: string;
  onError: (error: AdapterError, context: MiddlewareContext) => Promise<void | never>;
}): MiddlewareWithMetadata {
  return createMiddleware(
    {
      name: options.name ?? 'error-handler',
      supportsStreaming: true,
    },
    async (context, next) => {
      try {
        return await next();
      } catch (error) {
        if (error instanceof Error) {
          await options.onError(error as AdapterError, context);
        }
        throw error;
      }
    }
  );
}

/**
 * Create timing middleware.
 *
 * Tracks request duration and adds to context/metadata.
 *
 * @example
 * ```typescript
 * const timing = createTimingMiddleware({
 *   onComplete: (duration, context) => {
 *     console.log(`Request ${context.request.metadata.requestId} took ${duration}ms`);
 *   }
 * });
 * ```
 */
export function createTimingMiddleware(options?: {
  name?: string;
  onComplete?: (durationMs: number, context: MiddlewareContext) => void;
}): MiddlewareWithMetadata {
  return createMiddleware(
    {
      name: options?.name ?? 'timing',
    },
    async (context, next) => {
      const start = Date.now();
      try {
        const response = await next();
        const duration = Date.now() - start;
        options?.onComplete?.(duration, context);
        return response;
      } catch (error) {
        const duration = Date.now() - start;
        options?.onComplete?.(duration, context);
        throw error;
      }
    }
  );
}

/**
 * Create request transformation middleware.
 *
 * Transforms requests before they reach backend.
 *
 * @example
 * ```typescript
 * const transform = createRequestTransformer({
 *   transform: async (request) => ({
 *     ...request,
 *     parameters: {
 *       ...request.parameters,
 *       temperature: Math.min(request.parameters?.temperature ?? 0.7, 0.9)
 *     }
 *   })
 * });
 * ```
 */
export function createRequestTransformer(options: {
  name?: string;
  transform: (request: IRChatRequest, context: MiddlewareContext) => Promise<IRChatRequest>;
}): MiddlewareWithMetadata {
  return createMiddleware(
    {
      name: options.name ?? 'request-transformer',
    },
    async (context, next) => {
      context.request = await options.transform(context.request, context);
      return next();
    }
  );
}

/**
 * Create response transformation middleware.
 *
 * Transforms responses before they're returned to caller.
 *
 * @example
 * ```typescript
 * const transform = createResponseTransformer({
 *   transform: async (response) => ({
 *     ...response,
 *     message: {
 *       ...response.message,
 *       content: response.message.content.toUpperCase()
 *     }
 *   })
 * });
 * ```
 */
export function createResponseTransformer(options: {
  name?: string;
  transform: (
    response: IRChatResponse,
    context: MiddlewareContext
  ) => Promise<IRChatResponse>;
}): MiddlewareWithMetadata {
  return createMiddleware(
    {
      name: options.name ?? 'response-transformer',
    },
    async (context, next) => {
      const response = await next();
      return options.transform(response, context);
    }
  );
}

/**
 * Create conditional middleware.
 *
 * Only executes middleware if condition is met.
 *
 * @example
 * ```typescript
 * const conditionalCache = createConditionalMiddleware({
 *   condition: (context) => {
 *     // Only cache non-streaming requests
 *     return !context.isStreaming;
 *   },
 *   middleware: cachingMiddleware
 * });
 * ```
 */
export function createConditionalMiddleware(options: {
  name?: string;
  condition: (context: MiddlewareContext) => boolean | Promise<boolean>;
  middleware: Middleware;
}): MiddlewareWithMetadata {
  return createMiddleware(
    {
      name: options.name ?? 'conditional',
    },
    async (context, next) => {
      const shouldExecute = await options.condition(context);
      if (shouldExecute) {
        return options.middleware(context, next);
      }
      return next();
    }
  );
}

// ============================================================================
// Built-in Middleware Examples
// ============================================================================

/**
 * Configuration for logging middleware.
 */
export interface LoggingMiddlewareConfig {
  /**
   * Log level.
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
   * Custom logger function.
   */
  logger?: (level: string, message: string, data?: unknown) => void;
}

/**
 * Create logging middleware.
 *
 * Logs requests, responses, and errors with configurable detail.
 *
 * @example
 * ```typescript
 * const logging = createLoggingMiddleware({
 *   level: 'info',
 *   logRequests: true,
 *   logResponses: true,
 *   logger: (level, message, data) => {
 *     console.log(`[${level.toUpperCase()}] ${message}`, data);
 *   }
 * });
 *
 * bridge.use(logging);
 * ```
 */
export function createLoggingMiddleware(
  config?: LoggingMiddlewareConfig
): MiddlewareWithMetadata {
  // Implementation would go here
  throw new Error('Not implemented - this is a contract definition');
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
   * Defaults to in-memory Map.
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
 * Create caching middleware.
 *
 * Caches responses to avoid redundant API calls.
 *
 * @example
 * ```typescript
 * const caching = createCachingMiddleware({
 *   ttl: 3600000, // 1 hour
 *   maxSize: 500,
 *   keyGenerator: (request) => {
 *     // Custom cache key based on messages
 *     return JSON.stringify(request.messages);
 *   }
 * });
 *
 * bridge.use(caching);
 * ```
 */
export function createCachingMiddleware(
  config?: CachingMiddlewareConfig
): MiddlewareWithMetadata {
  // Implementation would go here
  throw new Error('Not implemented - this is a contract definition');
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

/**
 * Create telemetry middleware.
 *
 * Emits metrics and events for monitoring.
 *
 * @example
 * ```typescript
 * const telemetry = createTelemetryMiddleware({
 *   sink: {
 *     recordMetric: (name, value, tags) => {
 *       console.log(`Metric: ${name} = ${value}`, tags);
 *     },
 *     recordEvent: (name, data) => {
 *       console.log(`Event: ${name}`, data);
 *     }
 *   },
 *   trackCounts: true,
 *   trackLatencies: true,
 *   trackTokens: true
 * });
 *
 * bridge.use(telemetry);
 * ```
 */
export function createTelemetryMiddleware(
  config: TelemetryMiddlewareConfig
): MiddlewareWithMetadata {
  // Implementation would go here
  throw new Error('Not implemented - this is a contract definition');
}
