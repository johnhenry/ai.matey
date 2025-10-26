/**
 * Router Types and Interfaces
 *
 * The Router manages multiple backend adapters and provides intelligent routing,
 * fallback strategies, and parallel dispatch capabilities.
 *
 * @module
 */

import type { BackendAdapter, AdapterMetadata } from './adapters.js';
import type { IRChatRequest, IRChatResponse, IRChatStream } from './ir.js';
import type { AdapterError } from './errors.js';
import type { ModelTranslationConfig } from '../core/model-translation.js';

// ============================================================================
// Router Configuration
// ============================================================================

/**
 * Fallback strategies for handling backend failures.
 */
export const FallbackStrategy = {
  /**
   * No fallback - fail immediately if primary backend fails.
   */
  NONE: 'none',

  /**
   * Try backends sequentially in order until one succeeds.
   */
  SEQUENTIAL: 'sequential',

  /**
   * Try all backends in parallel, return first success.
   */
  PARALLEL: 'parallel',

  /**
   * Use custom fallback logic.
   */
  CUSTOM: 'custom',
} as const;

export type FallbackStrategy = typeof FallbackStrategy[keyof typeof FallbackStrategy];

/**
 * Routing strategies for selecting backends.
 */
export const RoutingStrategy = {
  /**
   * Use backend specified in request options.
   */
  EXPLICIT: 'explicit',

  /**
   * Route based on model name.
   */
  MODEL_BASED: 'model-based',

  /**
   * Route to least-cost backend.
   */
  COST_OPTIMIZED: 'cost-optimized',

  /**
   * Route to fastest backend (lowest latency).
   */
  LATENCY_OPTIMIZED: 'latency-optimized',

  /**
   * Round-robin load balancing.
   */
  ROUND_ROBIN: 'round-robin',

  /**
   * Random backend selection.
   */
  RANDOM: 'random',

  /**
   * Use custom routing logic.
   */
  CUSTOM: 'custom',
} as const;

export type RoutingStrategy = typeof RoutingStrategy[keyof typeof RoutingStrategy];

/**
 * Router configuration options.
 */
export interface RouterConfig {
  /**
   * Primary routing strategy.
   * @default 'explicit'
   */
  readonly routingStrategy?: RoutingStrategy;

  /**
   * Fallback strategy when primary backend fails.
   * @default 'sequential'
   */
  readonly fallbackStrategy?: FallbackStrategy;

  /**
   * Default backend to use if routing doesn't select one.
   */
  readonly defaultBackend?: string;

  /**
   * Interval for health checking backends (milliseconds).
   * Set to 0 to disable health checks.
   * @default 0
   */
  readonly healthCheckInterval?: number;

  /**
   * Enable circuit breaker pattern.
   * @default false
   */
  readonly enableCircuitBreaker?: boolean;

  /**
   * Number of consecutive failures before circuit breaker opens.
   * @default 5
   */
  readonly circuitBreakerThreshold?: number;

  /**
   * Time to wait before attempting to close circuit breaker (milliseconds).
   * @default 60000
   */
  readonly circuitBreakerTimeout?: number;

  /**
   * Track latency statistics per backend.
   * @default true
   */
  readonly trackLatency?: boolean;

  /**
   * Track cost per backend (requires backends to implement estimateCost).
   * @default false
   */
  readonly trackCost?: boolean;

  /**
   * Enable capability-based routing.
   * When enabled, the router will select backends based on their model capabilities
   * matching the request requirements.
   * @default false
   */
  readonly capabilityBasedRouting?: boolean;

  /**
   * Optimization strategy for capability-based routing.
   * Determines how to weigh cost, speed, and quality when selecting models.
   * @default 'balanced'
   */
  readonly optimization?: 'cost' | 'speed' | 'quality' | 'balanced';

  /**
   * Custom optimization weights for capability-based routing.
   * Must sum to 1.0. Overrides optimization preset.
   */
  readonly optimizationWeights?: {
    cost: number;     // 0-1
    speed: number;    // 0-1
    quality: number;  // 0-1
  };

  /**
   * Cache duration for model capability data in milliseconds.
   * @default 3600000 (1 hour)
   */
  readonly capabilityCacheDuration?: number;

  /**
   * Custom routing function.
   */
  readonly customRouter?: CustomRoutingFunction;

  /**
   * Custom fallback function.
   */
  readonly customFallback?: CustomFallbackFunction;

  /**
   * Model translation configuration for fallback scenarios.
   * Controls how model names are translated when falling back to different backends.
   * @default { strategy: 'hybrid', warnOnDefault: true, strictMode: false }
   */
  readonly modelTranslation?: ModelTranslationConfig;
}

/**
 * Custom routing function signature.
 */
export type CustomRoutingFunction = (
  request: IRChatRequest,
  availableBackends: readonly string[],
  context: RoutingContext
) => Promise<string | null>;

/**
 * Custom fallback function signature.
 */
export type CustomFallbackFunction = (
  request: IRChatRequest,
  failedBackend: string,
  error: AdapterError,
  attemptedBackends: readonly string[],
  availableBackends: readonly string[]
) => Promise<string | null>;

/**
 * Context provided to routing functions.
 */
export interface RoutingContext {
  /**
   * Backend statistics for making informed decisions.
   */
  readonly stats: RouterStats;

  /**
   * Request metadata.
   */
  readonly metadata: Record<string, unknown>;

  /**
   * Preferred backend from request options (if any).
   */
  readonly preferredBackend?: string;
}

// ============================================================================
// Backend Registry
// ============================================================================

/**
 * Information about a registered backend.
 */
export interface BackendInfo {
  /**
   * Backend identifier.
   */
  readonly name: string;

  /**
   * Backend adapter instance.
   */
  readonly adapter: BackendAdapter;

  /**
   * Backend metadata.
   */
  readonly metadata: AdapterMetadata;

  /**
   * Whether backend is currently healthy.
   */
  readonly isHealthy: boolean;

  /**
   * Last health check timestamp.
   */
  readonly lastHealthCheck?: number;

  /**
   * Circuit breaker state.
   */
  readonly circuitBreakerState: 'closed' | 'open' | 'half-open';

  /**
   * Consecutive failures count (for circuit breaker).
   */
  readonly consecutiveFailures: number;

  /**
   * Statistics for this backend.
   */
  readonly stats: BackendStats;
}

/**
 * Statistics for a single backend.
 */
export interface BackendStats {
  /**
   * Total requests routed to this backend.
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
   * Average latency in milliseconds.
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
   * Total estimated cost (if tracking enabled).
   */
  readonly totalCost?: number;

  /**
   * Average cost per request (if tracking enabled).
   */
  readonly averageCost?: number;
}

// ============================================================================
// Router Statistics
// ============================================================================

/**
 * Overall router statistics.
 */
export interface RouterStats {
  /**
   * Total requests routed.
   */
  readonly totalRequests: number;

  /**
   * Requests that succeeded on first try.
   */
  readonly successfulRequests: number;

  /**
   * Requests that failed completely.
   */
  readonly failedRequests: number;

  /**
   * Requests that required fallback.
   */
  readonly totalFallbacks: number;

  /**
   * Parallel/fan-out requests.
   */
  readonly parallelRequests: number;

  /**
   * Per-backend statistics.
   */
  readonly backendStats: Record<string, BackendStats>;

  /**
   * When statistics were last reset.
   */
  readonly sinceTimestamp: number;
}

// ============================================================================
// Parallel Dispatch Options
// ============================================================================

/**
 * Strategy for handling parallel dispatch results.
 */
export const ParallelStrategy = {
  /**
   * Return first successful response, cancel others.
   */
  FIRST: 'first',

  /**
   * Wait for all responses, return array of results.
   */
  ALL: 'all',

  /**
   * Return fastest successful response (with timeout).
   */
  FASTEST: 'fastest',

  /**
   * Use custom aggregation logic.
   */
  CUSTOM: 'custom',
} as const;

export type ParallelStrategy = typeof ParallelStrategy[keyof typeof ParallelStrategy];

/**
 * Options for parallel dispatch.
 */
export interface ParallelDispatchOptions {
  /**
   * Backend names to dispatch to.
   */
  readonly backends?: readonly string[];

  /**
   * Parallel dispatch strategy.
   * @default 'first'
   */
  readonly strategy?: ParallelStrategy;

  /**
   * Timeout for parallel requests (milliseconds).
   */
  readonly timeout?: number;

  /**
   * Cancel remaining requests on first success.
   * @default true
   */
  readonly cancelOnFirstSuccess?: boolean;

  /**
   * Custom aggregation function for 'custom' strategy.
   */
  readonly customAggregator?: (
    responses: Array<{ backend: string; response: IRChatResponse; latencyMs: number }>
  ) => IRChatResponse;
}

/**
 * Result of parallel dispatch.
 */
export interface ParallelDispatchResult {
  /**
   * Primary response (based on strategy).
   */
  readonly response: IRChatResponse;

  /**
   * All responses (only for 'all' strategy).
   */
  readonly allResponses?: Array<{
    readonly backend: string;
    readonly response: IRChatResponse;
    readonly latencyMs: number;
  }>;

  /**
   * Backends that succeeded.
   */
  readonly successfulBackends: readonly string[];

  /**
   * Backends that failed.
   */
  readonly failedBackends: Array<{
    readonly backend: string;
    readonly error: AdapterError;
  }>;

  /**
   * Total time for parallel dispatch (milliseconds).
   */
  readonly totalTimeMs: number;
}

// ============================================================================
// Model Mapping
// ============================================================================

/**
 * Model to backend mapping.
 */
export type ModelMapping = Record<string, string>;

/**
 * Model pattern to backend mapping.
 */
export interface ModelPatternMapping {
  /**
   * Regular expression pattern to match model names.
   */
  readonly pattern: RegExp;

  /**
   * Backend name to route matching models to.
   */
  readonly backend: string;

  /**
   * Optional target model name to use (for translation during fallback).
   * If not specified, original model name is passed through.
   */
  readonly targetModel?: string;

  /**
   * Pattern matching priority (higher = checked first).
   * @default 0
   */
  readonly priority?: number;
}

// ============================================================================
// Main Router Interface
// ============================================================================

/**
 * Router manages multiple backend adapters with intelligent routing.
 */
export interface Router extends BackendAdapter<unknown, unknown> {
  /**
   * Router configuration.
   */
  readonly config: RouterConfig;

  // ==========================================================================
  // Backend Management
  // ==========================================================================

  /**
   * Register a backend adapter.
   */
  register(name: string, adapter: BackendAdapter): Router;

  /**
   * Unregister a backend adapter.
   */
  unregister(name: string): Router;

  /**
   * Get a registered backend adapter.
   */
  get(name: string): BackendAdapter | undefined;

  /**
   * Check if backend is registered.
   */
  has(name: string): boolean;

  /**
   * List all registered backend names.
   */
  listBackends(): readonly string[];

  /**
   * Get information about all registered backends.
   */
  getBackendInfo(): BackendInfo[];
  /**
   * Get information about specific backend.
   */
  getBackendInfo(name: string): BackendInfo | undefined;

  // ==========================================================================
  // Routing Configuration
  // ==========================================================================

  /**
   * Set fallback chain for sequential failover.
   */
  setFallbackChain(chain: readonly string[]): Router;

  /**
   * Get current fallback chain.
   */
  getFallbackChain(): readonly string[];

  /**
   * Set model to backend mapping.
   */
  setModelMapping(mapping: ModelMapping): Router;

  /**
   * Get current model mapping.
   */
  getModelMapping(): ModelMapping;

  /**
   * Set model pattern mappings.
   */
  setModelPatterns(patterns: readonly ModelPatternMapping[]): Router;

  /**
   * Get current model patterns.
   */
  getModelPatterns(): readonly ModelPatternMapping[];

  // ==========================================================================
  // Routing Operations
  // ==========================================================================

  /**
   * Select backend for a request.
   */
  selectBackend(request: IRChatRequest, preferredBackend?: string): Promise<string>;

  /**
   * Execute request with automatic backend selection and fallback.
   */
  execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse>;

  /**
   * Execute streaming request with automatic backend selection and fallback.
   */
  executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream;

  /**
   * Dispatch request to multiple backends in parallel.
   */
  dispatchParallel(
    request: IRChatRequest,
    options?: ParallelDispatchOptions,
    signal?: AbortSignal
  ): Promise<ParallelDispatchResult>;

  // ==========================================================================
  // Health & Circuit Breaking
  // ==========================================================================

  /**
   * Check health of all backends.
   */
  checkHealth(): Promise<Record<string, boolean>>;
  /**
   * Check health of specific backend.
   */
  checkHealth(name: string): Promise<boolean>;

  /**
   * Manually open circuit breaker for a backend.
   */
  openCircuitBreaker(name: string, timeoutMs?: number): void;

  /**
   * Manually close circuit breaker for a backend.
   */
  closeCircuitBreaker(name: string): void;

  /**
   * Reset circuit breaker statistics.
   */
  resetCircuitBreaker(name?: string): void;

  // ==========================================================================
  // Statistics & Monitoring
  // ==========================================================================

  /**
   * Get router statistics.
   */
  getStats(): RouterStats;

  /**
   * Reset router statistics.
   */
  resetStats(): void;

  /**
   * Get statistics for specific backend.
   */
  getBackendStats(name: string): BackendStats | undefined;

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Clone router with new configuration.
   */
  clone(config: Partial<RouterConfig>): Router;

  /**
   * Clean up resources.
   */
  dispose(): void;
}
