/**
 * Router Class Public API
 *
 * The Router manages multiple backend adapters and provides intelligent routing,
 * fallback strategies, and parallel dispatch capabilities.
 *
 * Key features:
 * - Dynamic backend selection based on request properties
 * - Fallback chains for automatic failover
 * - Parallel dispatch to multiple backends
 * - Model-aware routing
 * - Health checking and circuit breaking
 * - Cost-aware routing (when backends provide cost estimates)
 *
 * @example
 * ```typescript
 * // Create router with multiple backends
 * const router = new Router({
 *   fallbackStrategy: 'sequential',
 *   healthCheckInterval: 30000
 * });
 *
 * // Register backends
 * router
 *   .register('openai', new OpenAIBackendAdapter({ apiKey: 'sk-...' }))
 *   .register('anthropic', new AnthropicBackendAdapter({ apiKey: 'sk-...' }))
 *   .register('gemini', new GeminiBackendAdapter({ apiKey: 'ai-...' }));
 *
 * // Configure routing
 * router
 *   .setFallbackChain(['openai', 'anthropic', 'gemini'])
 *   .setModelMapping({
 *     'gpt-4': 'openai',
 *     'claude-3-opus': 'anthropic',
 *     'gemini-pro': 'gemini'
 *   });
 *
 * // Use with bridge
 * const bridge = new Bridge(frontend, router);
 * ```
 */

import type { BackendAdapter, AdapterMetadata } from './adapters';
import type { IRChatRequest, IRChatResponse, IRChatStream } from './ir';
import type { AdapterError } from './errors';

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
 *
 * @example
 * ```typescript
 * const config: RouterConfig = {
 *   routingStrategy: 'model-based',
 *   fallbackStrategy: 'sequential',
 *   healthCheckInterval: 30000,
 *   enableCircuitBreaker: true,
 *   circuitBreakerThreshold: 5,
 *   circuitBreakerTimeout: 60000,
 *   trackLatency: true,
 *   trackCost: false
 * };
 * ```
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
   * When enabled, backends that fail repeatedly are temporarily disabled.
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
   * Custom routing function.
   * Only used when routingStrategy is 'custom'.
   */
  readonly customRouter?: CustomRoutingFunction;

  /**
   * Custom fallback function.
   * Only used when fallbackStrategy is 'custom'.
   */
  readonly customFallback?: CustomFallbackFunction;
}

/**
 * Custom routing function signature.
 *
 * @param request IR request to route
 * @param availableBackends Available backend names
 * @param context Routing context with stats and metadata
 * @returns Backend name to use, or null to use default
 *
 * @example
 * ```typescript
 * const customRouter: CustomRoutingFunction = async (request, backends, context) => {
 *   // Route expensive requests to cheaper backend
 *   const isExpensive = request.parameters?.maxTokens > 1000;
 *   if (isExpensive && backends.includes('mistral')) {
 *     return 'mistral';
 *   }
 *   return null; // Use default
 * };
 * ```
 */
export type CustomRoutingFunction = (
  request: IRChatRequest,
  availableBackends: readonly string[],
  context: RoutingContext
) => Promise<string | null>;

/**
 * Custom fallback function signature.
 *
 * @param request IR request that failed
 * @param failedBackend Backend that failed
 * @param error Error from failed backend
 * @param attemptedBackends Backends already attempted
 * @param availableBackends Backends available to try
 * @returns Backend name to try next, or null to give up
 *
 * @example
 * ```typescript
 * const customFallback: CustomFallbackFunction = async (
 *   request,
 *   failedBackend,
 *   error,
 *   attempted,
 *   available
 * ) => {
 *   // Only retry on rate limit errors
 *   if (error.code === 'RATE_LIMIT_EXCEEDED') {
 *     const remaining = available.filter(b => !attempted.includes(b));
 *     return remaining[0] ?? null;
 *   }
 *   return null; // Don't retry other errors
 * };
 * ```
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
 *
 * @example
 * ```typescript
 * const stats = router.getStats();
 * console.log('Router Statistics:');
 * console.log(`  Total: ${stats.totalRequests}`);
 * console.log(`  Fallbacks: ${stats.totalFallbacks}`);
 * console.log(`  Parallel: ${stats.parallelRequests}`);
 *
 * Object.entries(stats.backendStats).forEach(([name, stats]) => {
 *   console.log(`  ${name}: ${stats.successRate}% success, ${stats.averageLatencyMs}ms avg`);
 * });
 * ```
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
 *
 * @example
 * ```typescript
 * const options: ParallelDispatchOptions = {
 *   backends: ['openai', 'anthropic', 'gemini'],
 *   strategy: 'first',
 *   timeout: 30000,
 *   cancelOnFirstSuccess: true
 * };
 *
 * const response = await router.dispatchParallel(request, options);
 * ```
 */
export interface ParallelDispatchOptions {
  /**
   * Backend names to dispatch to.
   * If not specified, uses all registered backends.
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
   * Only applies to 'first' and 'fastest' strategies.
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
  readonly failedBackends: readonly Array<{
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
 *
 * Maps model identifiers to backend names for model-based routing.
 *
 * @example
 * ```typescript
 * const mapping: ModelMapping = {
 *   'gpt-4': 'openai',
 *   'gpt-4-turbo': 'openai',
 *   'gpt-3.5-turbo': 'openai',
 *   'claude-3-opus': 'anthropic',
 *   'claude-3-sonnet': 'anthropic',
 *   'gemini-pro': 'gemini'
 * };
 *
 * router.setModelMapping(mapping);
 * ```
 */
export type ModelMapping = Record<string, string>;

/**
 * Model pattern to backend mapping.
 *
 * Supports regex patterns for flexible model matching.
 *
 * @example
 * ```typescript
 * const patterns: ModelPatternMapping[] = [
 *   { pattern: /^gpt-/, backend: 'openai' },
 *   { pattern: /^claude-/, backend: 'anthropic' },
 *   { pattern: /^gemini-/, backend: 'gemini' }
 * ];
 *
 * router.setModelPatterns(patterns);
 * ```
 */
export interface ModelPatternMapping {
  readonly pattern: RegExp;
  readonly backend: string;
}

// ============================================================================
// Main Router Interface
// ============================================================================

/**
 * Router manages multiple backend adapters with intelligent routing.
 *
 * The router acts as a BackendAdapter itself, delegating to registered
 * backends based on configuration and runtime conditions.
 *
 * @example
 * ```typescript
 * // Create and configure router
 * const router = new Router({
 *   routingStrategy: 'model-based',
 *   fallbackStrategy: 'sequential',
 *   enableCircuitBreaker: true
 * });
 *
 * // Register backends
 * router
 *   .register('openai', new OpenAIBackendAdapter({ apiKey: 'sk-...' }))
 *   .register('anthropic', new AnthropicBackendAdapter({ apiKey: 'sk-...' }))
 *   .register('gemini', new GeminiBackendAdapter({ apiKey: 'ai-...' }));
 *
 * // Configure routing
 * router
 *   .setFallbackChain(['openai', 'anthropic', 'gemini'])
 *   .setModelMapping({
 *     'gpt-4': 'openai',
 *     'claude-3-opus': 'anthropic',
 *     'gemini-pro': 'gemini'
 *   });
 *
 * // Use with bridge
 * const bridge = new Bridge(frontend, router);
 *
 * // Request automatically routed based on model
 * const response = await bridge.chat({
 *   model: 'claude-3-opus', // Routes to anthropic backend
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * ```
 */
export interface Router extends BackendAdapter {
  /**
   * Router configuration.
   */
  readonly config: RouterConfig;

  // ==========================================================================
  // Backend Management
  // ==========================================================================

  /**
   * Register a backend adapter.
   *
   * @param name Unique backend identifier
   * @param adapter Backend adapter instance
   * @returns This router for chaining
   * @throws {Error} If backend name already registered
   *
   * @example
   * ```typescript
   * router
   *   .register('openai', new OpenAIBackendAdapter({ apiKey: 'sk-...' }))
   *   .register('anthropic', new AnthropicBackendAdapter({ apiKey: 'sk-...' }));
   * ```
   */
  register(name: string, adapter: BackendAdapter): this;

  /**
   * Unregister a backend adapter.
   *
   * @param name Backend identifier
   * @returns This router for chaining
   *
   * @example
   * ```typescript
   * router.unregister('openai');
   * ```
   */
  unregister(name: string): this;

  /**
   * Get a registered backend adapter.
   *
   * @param name Backend identifier
   * @returns Backend adapter or undefined if not found
   *
   * @example
   * ```typescript
   * const openai = router.get('openai');
   * if (openai) {
   *   console.log('OpenAI backend available');
   * }
   * ```
   */
  get(name: string): BackendAdapter | undefined;

  /**
   * Check if backend is registered.
   *
   * @param name Backend identifier
   * @returns true if backend is registered
   */
  has(name: string): boolean;

  /**
   * List all registered backend names.
   *
   * @returns Array of backend names
   *
   * @example
   * ```typescript
   * const backends = router.listBackends();
   * console.log('Available backends:', backends.join(', '));
   * ```
   */
  listBackends(): readonly string[];

  /**
   * Get information about all registered backends.
   *
   * @returns Array of backend info objects
   */
  getBackendInfo(): readonly BackendInfo[];

  /**
   * Get information about specific backend.
   *
   * @param name Backend identifier
   * @returns Backend info or undefined if not found
   */
  getBackendInfo(name: string): BackendInfo | undefined;

  // ==========================================================================
  // Routing Configuration
  // ==========================================================================

  /**
   * Set fallback chain for sequential failover.
   *
   * When a backend fails, router tries next backend in chain.
   *
   * @param chain Array of backend names in fallback order
   * @returns This router for chaining
   *
   * @example
   * ```typescript
   * // Try OpenAI first, fallback to Anthropic, then Gemini
   * router.setFallbackChain(['openai', 'anthropic', 'gemini']);
   * ```
   */
  setFallbackChain(chain: readonly string[]): this;

  /**
   * Get current fallback chain.
   *
   * @returns Array of backend names in fallback order
   */
  getFallbackChain(): readonly string[];

  /**
   * Set model to backend mapping.
   *
   * Used for model-based routing strategy.
   *
   * @param mapping Model identifier → backend name mapping
   * @returns This router for chaining
   *
   * @example
   * ```typescript
   * router.setModelMapping({
   *   'gpt-4': 'openai',
   *   'claude-3-opus': 'anthropic',
   *   'gemini-pro': 'gemini'
   * });
   * ```
   */
  setModelMapping(mapping: ModelMapping): this;

  /**
   * Get current model mapping.
   *
   * @returns Model → backend mapping
   */
  getModelMapping(): ModelMapping;

  /**
   * Set model pattern mappings.
   *
   * More flexible than exact model mapping, supports regex patterns.
   *
   * @param patterns Array of pattern mappings
   * @returns This router for chaining
   *
   * @example
   * ```typescript
   * router.setModelPatterns([
   *   { pattern: /^gpt-/, backend: 'openai' },
   *   { pattern: /^claude-/, backend: 'anthropic' }
   * ]);
   * ```
   */
  setModelPatterns(patterns: readonly ModelPatternMapping[]): this;

  /**
   * Get current model patterns.
   *
   * @returns Array of pattern mappings
   */
  getModelPatterns(): readonly ModelPatternMapping[];

  // ==========================================================================
  // Routing Operations
  // ==========================================================================

  /**
   * Select backend for a request.
   *
   * Uses configured routing strategy to determine which backend to use.
   * Does not execute the request, just returns the backend name.
   *
   * @param request IR request to route
   * @param preferredBackend Optional preferred backend from request options
   * @returns Selected backend name
   * @throws {RouterError} If no suitable backend found
   *
   * @example
   * ```typescript
   * const backend = await router.selectBackend(request);
   * console.log(`Routing to backend: ${backend}`);
   * ```
   */
  selectBackend(request: IRChatRequest, preferredBackend?: string): Promise<string>;

  /**
   * Execute request with automatic backend selection and fallback.
   *
   * This is the main execution method inherited from BackendAdapter.
   * Implements routing logic, fallback, and error handling.
   *
   * @param request IR request
   * @param signal Optional abort signal
   * @returns IR response
   * @throws {RouterError} If all backends fail
   */
  execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse>;

  /**
   * Execute streaming request with automatic backend selection and fallback.
   *
   * @param request IR request
   * @param signal Optional abort signal
   * @returns IR stream
   * @throws {RouterError} If all backends fail
   */
  executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream;

  /**
   * Dispatch request to multiple backends in parallel.
   *
   * Useful for comparing responses, consensus, or getting fastest response.
   *
   * @param request IR request
   * @param options Parallel dispatch options
   * @param signal Optional abort signal
   * @returns Parallel dispatch result
   * @throws {RouterError} If all backends fail
   *
   * @example
   * ```typescript
   * // Get first successful response
   * const result = await router.dispatchParallel(request, {
   *   backends: ['openai', 'anthropic'],
   *   strategy: 'first'
   * });
   *
   * // Get all responses for comparison
   * const result = await router.dispatchParallel(request, {
   *   strategy: 'all'
   * });
   *
   * result.allResponses?.forEach(({ backend, response }) => {
   *   console.log(`${backend}:`, response.message.content);
   * });
   * ```
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
   *
   * @returns Map of backend name → health status
   *
   * @example
   * ```typescript
   * const health = await router.checkHealth();
   * Object.entries(health).forEach(([backend, healthy]) => {
   *   console.log(`${backend}: ${healthy ? 'healthy' : 'unhealthy'}`);
   * });
   * ```
   */
  checkHealth(): Promise<Record<string, boolean>>;

  /**
   * Check health of specific backend.
   *
   * @param name Backend identifier
   * @returns true if backend is healthy
   */
  checkHealth(name: string): Promise<boolean>;

  /**
   * Manually open circuit breaker for a backend.
   *
   * Temporarily disables a backend.
   *
   * @param name Backend identifier
   * @param timeoutMs Time until circuit breaker attempts to close (ms)
   */
  openCircuitBreaker(name: string, timeoutMs?: number): void;

  /**
   * Manually close circuit breaker for a backend.
   *
   * Re-enables a backend.
   *
   * @param name Backend identifier
   */
  closeCircuitBreaker(name: string): void;

  /**
   * Reset circuit breaker statistics.
   *
   * Clears failure counts for all or specific backend.
   *
   * @param name Optional backend identifier (resets all if omitted)
   */
  resetCircuitBreaker(name?: string): void;

  // ==========================================================================
  // Statistics & Monitoring
  // ==========================================================================

  /**
   * Get router statistics.
   *
   * @returns Current statistics snapshot
   */
  getStats(): RouterStats;

  /**
   * Reset router statistics.
   *
   * Clears all collected statistics and starts fresh.
   */
  resetStats(): void;

  /**
   * Get statistics for specific backend.
   *
   * @param name Backend identifier
   * @returns Backend statistics or undefined if not found
   */
  getBackendStats(name: string): BackendStats | undefined;

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Clone router with new configuration.
   *
   * Creates new router instance with same backends but different config.
   *
   * @param config New configuration to merge with existing
   * @returns New router instance
   */
  clone(config: Partial<RouterConfig>): Router;

  /**
   * Clean up resources.
   *
   * Stops health check intervals, clears circuit breaker timers, etc.
   */
  dispose(): void;
}
