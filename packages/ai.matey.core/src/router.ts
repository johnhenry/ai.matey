/**
 * Router Implementation
 *
 * The Router manages multiple backend adapters with intelligent routing,
 * fallback strategies, circuit breaker pattern, and health checking.
 * It implements the BackendAdapter interface so it can be used as a backend.
 *
 * @module
 */

import type {
  BackendAdapter,
  AdapterMetadata,
} from 'ai.matey.types';
import type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRStreamChunk,
} from 'ai.matey.types';
import type {
  Router as IRouter,
  RouterConfig,
  BackendInfo,
  BackendStats,
  RouterStats,
  RoutingContext,
  ModelMapping,
  ModelPatternMapping,
  ParallelDispatchOptions,
  ParallelDispatchResult,
} from 'ai.matey.types';
import {
  AdapterError,
  ErrorCode,
} from 'ai.matey.errors';
import type { TranslationResult } from './model-translation.js';
import type { AIModel } from 'ai.matey.types';
import type { CapabilityRequirements, BackendModel } from './capability-matcher.js';
import { findBestModel } from './capability-matcher.js';
import { inferCapabilities } from './capability-inference.js';

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Internal backend state tracking.
 */
interface BackendState {
  readonly adapter: BackendAdapter;
  isHealthy: boolean;
  lastHealthCheck?: number;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  consecutiveFailures: number;
  circuitOpenedAt?: number;
  latencies: number[];
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalCost: number;
}

// ============================================================================
// Router Implementation
// ============================================================================

/**
 * Router manages multiple backend adapters with intelligent routing.
 */
export class Router implements IRouter {
  readonly metadata: AdapterMetadata;
  readonly config: RouterConfig;

  private backends: Map<string, BackendState> = new Map();
  private modelMapping: Map<string, string> = new Map(); // model -> backend (for routing)
  private modelTranslationMapping: Map<string, string> = new Map(); // model -> model (for translation)
  private backendTranslationMappings: Map<string, Map<string, string>> = new Map(); // backend -> (model -> model)
  private modelPatterns: ModelPatternMapping[] = [];
  private fallbackChain: string[] = [];
  private roundRobinIndex = 0;
  private healthCheckInterval?: NodeJS.Timeout;

  // Stats
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalFallbacks: 0,
    parallelRequests: 0,
    sinceTimestamp: Date.now(),
  };

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = {
      routingStrategy: config.routingStrategy ?? 'explicit',
      fallbackStrategy: config.fallbackStrategy ?? 'sequential',
      defaultBackend: config.defaultBackend,
      healthCheckInterval: config.healthCheckInterval ?? 0,
      enableCircuitBreaker: config.enableCircuitBreaker ?? false,
      circuitBreakerThreshold: config.circuitBreakerThreshold ?? 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout ?? 60000,
      trackLatency: config.trackLatency ?? true,
      trackCost: config.trackCost ?? false,
      capabilityBasedRouting: config.capabilityBasedRouting ?? false,
      optimization: config.optimization ?? 'balanced',
      optimizationWeights: config.optimizationWeights,
      capabilityCacheDuration: config.capabilityCacheDuration ?? 3600000, // 1 hour
      customRouter: config.customRouter,
      customFallback: config.customFallback,
      modelTranslation: config.modelTranslation ?? {
        strategy: 'hybrid',
        warnOnDefault: true,
        strictMode: false,
      },
    };

    this.metadata = {
      name: 'router',
      version: '1.0.0',
      provider: 'Universal Router',
      capabilities: {
        streaming: true,
        multiModal: true,
        tools: true,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: true,
      },
      config: this.config as Record<string, unknown>,
    };

    // Start health checking if enabled
    if (this.config.healthCheckInterval && this.config.healthCheckInterval > 0) {
      this.startHealthChecking();
    }
  }

  // ==========================================================================
  // Format Conversion (Not Applicable for Router)
  // ==========================================================================

  /**
   * Convert IR request to provider format.
   * Not applicable for Router - use the specific backend adapter instead.
   */
  fromIR(_request: IRChatRequest): unknown {
    throw new Error('fromIR() not applicable for Router - route to a specific backend first');
  }

  /**
   * Convert provider response to IR format.
   * Not applicable for Router - use the specific backend adapter instead.
   */
  toIR(_response: unknown, _originalRequest: IRChatRequest, _latencyMs: number): IRChatResponse {
    throw new Error('toIR() not applicable for Router - route to a specific backend first');
  }

  // ==========================================================================
  // Backend Management
  // ==========================================================================

  /**
   * Register a backend adapter.
   */
  register(name: string, adapter: BackendAdapter): Router {
    if (this.backends.has(name)) {
      throw new AdapterError({
        code: ErrorCode.ROUTING_FAILED,
        message: `Backend '${name}' is already registered`,
        isRetryable: false,
        provenance: { router: this.metadata.name },
      });
    }

    this.backends.set(name, {
      adapter,
      isHealthy: true,
      circuitBreakerState: 'closed',
      consecutiveFailures: 0,
      latencies: [],
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalCost: 0,
    });

    return this;
  }

  /**
   * Unregister a backend adapter.
   */
  unregister(name: string): Router {
    if (!this.backends.has(name)) {
      throw new AdapterError({
        code: ErrorCode.ROUTING_FAILED,
        message: `Backend '${name}' is not registered`,
        isRetryable: false,
        provenance: { router: this.metadata.name },
      });
    }

    // Check if it's the default backend
    if (this.config.defaultBackend === name) {
      throw new AdapterError({
        code: ErrorCode.ROUTING_FAILED,
        message: `Cannot unregister default backend '${name}'`,
        isRetryable: false,
        provenance: { router: this.metadata.name },
      });
    }

    // Check if it's the last backend
    if (this.backends.size === 1) {
      throw new AdapterError({
        code: ErrorCode.ROUTING_FAILED,
        message: `Cannot unregister last backend '${name}'`,
        isRetryable: false,
        provenance: { router: this.metadata.name },
      });
    }

    this.backends.delete(name);
    return this;
  }

  /**
   * Get a registered backend adapter.
   */
  get(name: string): BackendAdapter | undefined {
    return this.backends.get(name)?.adapter;
  }

  /**
   * Check if backend is registered.
   */
  has(name: string): boolean {
    return this.backends.has(name);
  }

  /**
   * List all registered backend names.
   */
  listBackends(): readonly string[] {
    return Array.from(this.backends.keys());
  }

  /**
   * Get information about all or specific backend.
   */
  getBackendInfo(): BackendInfo[];
  getBackendInfo(name: string): BackendInfo | undefined;
  getBackendInfo(name?: string): BackendInfo | BackendInfo[] | undefined {
    if (name !== undefined) {
      const state = this.backends.get(name);
      if (!state) return undefined;
      return this.createBackendInfo(name, state);
    }

    const infos: BackendInfo[] = [];
    for (const [backendName, state] of this.backends.entries()) {
      infos.push(this.createBackendInfo(backendName, state));
    }
    return infos;
  }

  // ==========================================================================
  // Routing Configuration
  // ==========================================================================

  /**
   * Set fallback chain for sequential failover.
   */
  setFallbackChain(chain: readonly string[]): Router {
    // Validate all backends exist
    for (const name of chain) {
      if (!this.backends.has(name)) {
        throw new AdapterError({
          code: ErrorCode.ROUTING_FAILED,
          message: `Backend '${name}' in fallback chain is not registered`,
          isRetryable: false,
          provenance: { router: this.metadata.name },
        });
      }
    }
    this.fallbackChain = [...chain];
    return this;
  }

  /**
   * Get current fallback chain.
   */
  getFallbackChain(): readonly string[] {
    return this.fallbackChain;
  }

  /**
   * Set model to backend mapping.
   */
  setModelMapping(mapping: ModelMapping): Router {
    this.modelMapping.clear();
    for (const [model, backend] of Object.entries(mapping)) {
      if (!this.backends.has(backend)) {
        throw new AdapterError({
          code: ErrorCode.ROUTING_FAILED,
          message: `Backend '${backend}' in model mapping is not registered`,
          isRetryable: false,
          provenance: { router: this.metadata.name },
        });
      }
      this.modelMapping.set(model, backend);
    }
    return this;
  }

  /**
   * Get current model mapping.
   */
  getModelMapping(): ModelMapping {
    const mapping: ModelMapping = {};
    for (const [model, backend] of this.modelMapping.entries()) {
      mapping[model] = backend;
    }
    return mapping;
  }

  /**
   * Set model name translation mapping (for fallback scenarios).
   * Maps source model names to target model names.
   *
   * @example
   * ```typescript
   * router.setModelTranslationMapping({
   *   'gpt-4': 'claude-3-5-sonnet-20241022',
   *   'gpt-3.5-turbo': 'claude-3-5-haiku-20241022'
   * });
   * ```
   */
  setModelTranslationMapping(mapping: ModelMapping): Router {
    this.modelTranslationMapping.clear();
    for (const [sourceModel, targetModel] of Object.entries(mapping)) {
      this.modelTranslationMapping.set(sourceModel, targetModel);
    }
    return this;
  }

  /**
   * Get current model translation mapping.
   */
  getModelTranslationMapping(): ModelMapping {
    const mapping: ModelMapping = {};
    for (const [source, target] of this.modelTranslationMapping.entries()) {
      mapping[source] = target;
    }
    return mapping;
  }

  /**
   * Set backend-specific model translation mapping.
   * This takes priority over global model translation mapping.
   *
   * @example
   * ```typescript
   * router.setBackendTranslationMapping('anthropic', {
   *   'gpt-4': 'claude-3-5-sonnet-20241022',
   *   'gpt-3.5-turbo': 'claude-3-5-haiku-20241022'
   * });
   * ```
   */
  setBackendTranslationMapping(backendName: string, mapping: ModelMapping): Router {
    // Validate backend exists
    if (!this.backends.has(backendName)) {
      throw new AdapterError({
        code: ErrorCode.ROUTING_FAILED,
        message: `Backend '${backendName}' is not registered`,
        isRetryable: false,
        provenance: { router: this.metadata.name },
      });
    }

    // Create or get existing backend mapping
    let backendMapping = this.backendTranslationMappings.get(backendName);
    if (!backendMapping) {
      backendMapping = new Map();
      this.backendTranslationMappings.set(backendName, backendMapping);
    }

    // Clear and populate mapping
    backendMapping.clear();
    for (const [sourceModel, targetModel] of Object.entries(mapping)) {
      backendMapping.set(sourceModel, targetModel);
    }

    return this;
  }

  /**
   * Get backend-specific model translation mapping.
   */
  getBackendTranslationMapping(backendName: string): ModelMapping {
    const backendMapping = this.backendTranslationMappings.get(backendName);
    if (!backendMapping) {
      return {};
    }

    const mapping: ModelMapping = {};
    for (const [source, target] of backendMapping.entries()) {
      mapping[source] = target;
    }
    return mapping;
  }

  /**
   * Set model pattern mappings.
   */
  setModelPatterns(patterns: readonly ModelPatternMapping[]): Router {
    // Validate all backends exist
    for (const pattern of patterns) {
      if (!this.backends.has(pattern.backend)) {
        throw new AdapterError({
          code: ErrorCode.ROUTING_FAILED,
          message: `Backend '${pattern.backend}' in model pattern is not registered`,
          isRetryable: false,
          provenance: { router: this.metadata.name },
        });
      }
    }
    this.modelPatterns = [...patterns];
    return this;
  }

  /**
   * Get current model patterns.
   */
  getModelPatterns(): readonly ModelPatternMapping[] {
    return this.modelPatterns;
  }

  // ==========================================================================
  // Routing Operations
  // ==========================================================================

  /**
   * Select backend for a request.
   */
  async selectBackend(request: IRChatRequest, preferredBackend?: string): Promise<string> {
    const context: RoutingContext = {
      stats: this.getStats(),
      metadata: request.metadata?.custom || {},
      preferredBackend,
    };

    // Try explicit preference first
    if (preferredBackend && this.isBackendAvailable(preferredBackend)) {
      return preferredBackend;
    }

    // Try capability-based routing if enabled
    if (this.config.capabilityBasedRouting) {
      const capabilityBackend = await this.selectBackendByCapabilities(request);
      if (capabilityBackend) {
        return capabilityBackend;
      }
    }

    // Apply routing strategy
    const strategy = this.config.routingStrategy || 'explicit';
    let selectedBackend: string | null = null;

    switch (strategy) {
      case 'explicit':
        selectedBackend = this.routeExplicit(preferredBackend);
        break;

      case 'model-based':
        selectedBackend = this.routeByModel(request);
        break;

      case 'cost-optimized':
        selectedBackend = this.routeByCost(request);
        break;

      case 'latency-optimized':
        selectedBackend = this.routeByLatency();
        break;

      case 'round-robin':
        selectedBackend = this.routeRoundRobin();
        break;

      case 'random':
        selectedBackend = this.routeRandom();
        break;

      case 'custom':
        if (this.config.customRouter) {
          selectedBackend = await this.config.customRouter(
            request,
            this.getAvailableBackends(),
            context
          );
        }
        break;
    }

    // Fallback to default backend
    if (!selectedBackend && this.config.defaultBackend) {
      selectedBackend = this.config.defaultBackend;
    }

    // Final fallback: first available backend
    if (!selectedBackend) {
      const available = this.getAvailableBackends();
      selectedBackend = available[0] || null;
    }

    if (!selectedBackend) {
      throw new AdapterError({
        code: ErrorCode.NO_BACKEND_AVAILABLE,
        message: 'No available backend for routing',
        isRetryable: false,
        provenance: { router: this.metadata.name },
      });
    }

    return selectedBackend;
  }

  /**
   * Execute request with automatic backend selection and fallback.
   */
  async execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
    this.stats.totalRequests++;

    const preferredBackend = request.metadata?.custom?.backend as string | undefined;
    const attemptedBackends: string[] = [];

    try {
      // Select primary backend
      const primaryBackend = await this.selectBackend(request, preferredBackend);
      attemptedBackends.push(primaryBackend);

      // Translate model for this backend
      const originalModel = request.parameters?.model ?? '';
      const translationResult = this.translateModelForBackend(originalModel, primaryBackend);

      // Create request with translated model
      const translatedRequest: IRChatRequest = {
        ...request,
        parameters: {
          ...request.parameters,
          model: translationResult.translated,
        },
      };

      // Log translation if applicable
      if (translationResult.wasTranslated) {
        console.log(
          `[Router] Model translated: ${originalModel} → ${translationResult.translated} ` +
          `(source: ${translationResult.source}, backend: ${primaryBackend})`
        );
      }

      // Try primary backend
      const response = await this.executeOnBackend(primaryBackend, translatedRequest, signal);
      this.stats.successfulRequests++;
      return response;
    } catch (primaryError) {
      // Handle fallback
      if (this.config.fallbackStrategy === 'none') {
        this.stats.failedRequests++;
        throw primaryError;
      }

      try {
        const response = await this.executeFallback(
          request,
          attemptedBackends,
          primaryError as AdapterError,
          signal
        );
        this.stats.successfulRequests++;
        this.stats.totalFallbacks++;
        return response;
      } catch (fallbackError) {
        this.stats.failedRequests++;
        throw fallbackError;
      }
    }
  }

  /**
   * Execute streaming request with automatic backend selection and fallback.
   */
  async *executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream {
    this.stats.totalRequests++;

    const preferredBackend = request.metadata?.custom?.backend as string | undefined;
    const attemptedBackends: string[] = [];

    try {
      // Select primary backend
      const primaryBackend = await this.selectBackend(request, preferredBackend);
      attemptedBackends.push(primaryBackend);

      // Translate model for this backend
      const originalModel = request.parameters?.model ?? '';
      const translationResult = this.translateModelForBackend(originalModel, primaryBackend);

      // Create request with translated model
      const translatedRequest: IRChatRequest = {
        ...request,
        parameters: {
          ...request.parameters,
          model: translationResult.translated,
        },
      };

      // Log translation if applicable
      if (translationResult.wasTranslated) {
        console.log(
          `[Router] Model translated: ${originalModel} → ${translationResult.translated} ` +
          `(source: ${translationResult.source}, backend: ${primaryBackend})`
        );
      }

      // Try primary backend streaming
      const stream = await this.executeStreamOnBackend(primaryBackend, translatedRequest, signal);

      for await (const chunk of stream) {
        yield chunk;
      }

      this.stats.successfulRequests++;
    } catch (primaryError) {
      // For streaming, fallback is more complex - yield error chunk
      this.stats.failedRequests++;

      yield {
        type: 'error',
        sequence: 0,
        error: {
          code: primaryError instanceof AdapterError ? primaryError.code : 'UNKNOWN_ERROR',
          message: primaryError instanceof Error ? primaryError.message : String(primaryError),
        },
      } as IRStreamChunk;
    }
  }

  /**
   * Dispatch request to multiple backends in parallel.
   */
  async dispatchParallel(
    request: IRChatRequest,
    options: ParallelDispatchOptions = {},
    signal?: AbortSignal
  ): Promise<ParallelDispatchResult> {
    this.stats.totalRequests++;
    this.stats.parallelRequests++;

    const {
      backends: targetBackends,
      strategy = 'first',
      timeout,
      cancelOnFirstSuccess = true,
    } = options;

    // Determine which backends to use
    const backendsToUse = targetBackends && targetBackends.length > 0
      ? targetBackends.filter(name => this.isBackendAvailable(name))
      : this.getAvailableBackends();

    if (backendsToUse.length === 0) {
      throw new AdapterError({
        code: ErrorCode.NO_BACKEND_AVAILABLE,
        message: 'No available backends for parallel dispatch',
        isRetryable: false,
        provenance: { router: this.metadata.name },
      });
    }

    const startTime = Date.now();
    const abortController = new AbortController();
    const combinedSignal = signal
      ? this.combineSignals([signal, abortController.signal])
      : abortController.signal;

    // Create timeout if specified
    let timeoutId: NodeJS.Timeout | undefined;
    if (timeout) {
      timeoutId = setTimeout(() => abortController.abort(), timeout);
    }

    try {
      const promises = backendsToUse.map(async (backendName) => {
        const backendStartTime = Date.now();
        try {
          const response = await this.executeOnBackend(backendName, request, combinedSignal);
          return {
            backend: backendName,
            response,
            latencyMs: Date.now() - backendStartTime,
            success: true,
          };
        } catch (error) {
          return {
            backend: backendName,
            error: error instanceof AdapterError ? error : this.wrapError(error),
            success: false,
          };
        }
      });

      let results: Awaited<typeof promises[0]>[];

      if (strategy === 'first') {
        // Return first successful response
        const firstSuccess = await Promise.race(promises);
        if (cancelOnFirstSuccess) {
          abortController.abort();
        }
        results = [firstSuccess];
      } else {
        // Wait for all responses
        results = await Promise.all(promises);
      }

      // Process results
      const successful = results.filter(r => r.success);
      const failed = results
        .filter(r => !r.success)
        .map(r => ({
          backend: r.backend,
          error: r.error as AdapterError,
        }));

      if (successful.length === 0) {
        throw new AdapterError({
          code: ErrorCode.ALL_BACKENDS_FAILED,
          message: `All parallel backends failed: ${failed.map(f => f.backend).join(', ')}`,
          isRetryable: true,
          provenance: { router: this.metadata.name },
        });
      }

      const firstSuccess = successful[0];
      if (!firstSuccess || !firstSuccess.response) {
        throw new AdapterError({
          code: ErrorCode.INTERNAL_ERROR,
          message: 'No successful response in parallel dispatch',
          isRetryable: false,
          provenance: { router: this.metadata.name },
        });
      }

      return {
        response: firstSuccess.response,
        allResponses: strategy === 'all'
          ? successful.map(s => ({
              backend: s.backend,
              response: s.response!,
              latencyMs: s.latencyMs!,
            }))
          : undefined,
        successfulBackends: successful.map(s => s.backend),
        failedBackends: failed,
        totalTimeMs: Date.now() - startTime,
      };
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  // ==========================================================================
  // Health & Circuit Breaking
  // ==========================================================================

  /**
   * Check health of all or specific backend.
   */
  async checkHealth(): Promise<Record<string, boolean>>;
  async checkHealth(name: string): Promise<boolean>;
  async checkHealth(name?: string): Promise<boolean | Record<string, boolean>> {
    if (name !== undefined) {
      const state = this.backends.get(name);
      if (!state) return false;

      try {
        const healthy = state.adapter.healthCheck
          ? await state.adapter.healthCheck()
          : true;
        state.isHealthy = healthy;
        state.lastHealthCheck = Date.now();
        return healthy;
      } catch {
        state.isHealthy = false;
        state.lastHealthCheck = Date.now();
        return false;
      }
    }

    // Check all backends
    const results: Record<string, boolean> = {};
    const promises = Array.from(this.backends.entries()).map(async ([backendName, state]) => {
      try {
        const healthy = state.adapter.healthCheck
          ? await state.adapter.healthCheck()
          : true;
        state.isHealthy = healthy;
        state.lastHealthCheck = Date.now();
        results[backendName] = healthy;
      } catch {
        state.isHealthy = false;
        state.lastHealthCheck = Date.now();
        results[backendName] = false;
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Manually open circuit breaker for a backend.
   */
  openCircuitBreaker(name: string, timeoutMs?: number): void {
    const state = this.backends.get(name);
    if (!state) {
      throw new AdapterError({
        code: ErrorCode.ROUTING_FAILED,
        message: `Backend '${name}' not found`,
        isRetryable: false,
        provenance: { router: this.metadata.name },
      });
    }

    state.circuitBreakerState = 'open';
    state.circuitOpenedAt = Date.now();

    // Auto-close after timeout
    if (timeoutMs || this.config.circuitBreakerTimeout) {
      setTimeout(() => {
        if (state.circuitBreakerState === 'open') {
          state.circuitBreakerState = 'half-open';
        }
      }, timeoutMs || this.config.circuitBreakerTimeout);
    }
  }

  /**
   * Manually close circuit breaker for a backend.
   */
  closeCircuitBreaker(name: string): void {
    const state = this.backends.get(name);
    if (!state) {
      throw new AdapterError({
        code: ErrorCode.ROUTING_FAILED,
        message: `Backend '${name}' not found`,
        isRetryable: false,
        provenance: { router: this.metadata.name },
      });
    }

    state.circuitBreakerState = 'closed';
    state.consecutiveFailures = 0;
    state.circuitOpenedAt = undefined;
  }

  /**
   * Reset circuit breaker statistics.
   */
  resetCircuitBreaker(name?: string): void {
    if (name) {
      const state = this.backends.get(name);
      if (state) {
        state.consecutiveFailures = 0;
        state.circuitBreakerState = 'closed';
        state.circuitOpenedAt = undefined;
      }
    } else {
      for (const state of this.backends.values()) {
        state.consecutiveFailures = 0;
        state.circuitBreakerState = 'closed';
        state.circuitOpenedAt = undefined;
      }
    }
  }

  // ==========================================================================
  // Statistics & Monitoring
  // ==========================================================================

  /**
   * Get router statistics.
   */
  getStats(): RouterStats {
    const backendStats: Record<string, BackendStats> = {};

    for (const [name, state] of this.backends.entries()) {
      backendStats[name] = this.calculateBackendStats(state);
    }

    return {
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      totalFallbacks: this.stats.totalFallbacks,
      parallelRequests: this.stats.parallelRequests,
      backendStats,
      sinceTimestamp: this.stats.sinceTimestamp,
    };
  }

  /**
   * Reset router statistics.
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalFallbacks: 0,
      parallelRequests: 0,
      sinceTimestamp: Date.now(),
    };

    for (const state of this.backends.values()) {
      state.totalRequests = 0;
      state.successfulRequests = 0;
      state.failedRequests = 0;
      state.latencies = [];
      state.totalCost = 0;
    }
  }

  /**
   * Get statistics for specific backend.
   */
  getBackendStats(name: string): BackendStats | undefined {
    const state = this.backends.get(name);
    if (!state) return undefined;
    return this.calculateBackendStats(state);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Clone router with new configuration.
   */
  clone(config: Partial<RouterConfig>): Router {
    const newRouter = new Router({ ...this.config, ...config });

    // Copy backend registrations
    for (const [name, state] of this.backends.entries()) {
      newRouter.register(name, state.adapter);
    }

    // Copy model mappings
    newRouter.modelMapping = new Map(this.modelMapping);
    newRouter.modelPatterns = [...this.modelPatterns];
    newRouter.fallbackChain = [...this.fallbackChain];

    return newRouter;
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Execute request on specific backend.
   */
  private async executeOnBackend(
    name: string,
    request: IRChatRequest,
    signal?: AbortSignal
  ): Promise<IRChatResponse> {
    const state = this.backends.get(name);
    if (!state) {
      throw new AdapterError({
        code: ErrorCode.ROUTING_FAILED,
        message: `Backend '${name}' not found`,
        isRetryable: false,
        provenance: { router: this.metadata.name },
      });
    }

    // Check circuit breaker
    if (this.config.enableCircuitBreaker) {
      this.checkCircuitBreaker(name, state);
    }

    state.totalRequests++;
    const startTime = Date.now();

    try {
      const response = await state.adapter.execute(request, signal);

      // Track success
      state.successfulRequests++;
      state.consecutiveFailures = 0;

      if (this.config.trackLatency) {
        const latency = Date.now() - startTime;
        state.latencies.push(latency);
        // Keep only last 100 latencies
        if (state.latencies.length > 100) {
          state.latencies.shift();
        }
      }

      // Track cost
      if (this.config.trackCost && state.adapter.estimateCost) {
        const cost = await state.adapter.estimateCost(request);
        if (cost !== null) {
          state.totalCost += cost;
        }
      }

      // Update circuit breaker
      if (state.circuitBreakerState === 'half-open') {
        state.circuitBreakerState = 'closed';
      }

      return response;
    } catch (error) {
      // Track failure
      state.failedRequests++;
      state.consecutiveFailures++;

      // Update circuit breaker
      if (
        this.config.enableCircuitBreaker &&
        state.consecutiveFailures >= (this.config.circuitBreakerThreshold || 5)
      ) {
        this.openCircuitBreaker(name);
      }

      throw error;
    }
  }

  /**
   * Execute streaming request on specific backend.
   */
  private async executeStreamOnBackend(
    name: string,
    request: IRChatRequest,
    signal?: AbortSignal
  ): Promise<IRChatStream> {
    const state = this.backends.get(name);
    if (!state) {
      throw new AdapterError({
        code: ErrorCode.ROUTING_FAILED,
        message: `Backend '${name}' not found`,
        isRetryable: false,
        provenance: { router: this.metadata.name },
      });
    }

    // Check circuit breaker
    if (this.config.enableCircuitBreaker) {
      this.checkCircuitBreaker(name, state);
    }

    state.totalRequests++;

    return state.adapter.executeStream(request, signal);
  }

  /**
   * Execute fallback strategy.
   */
  private async executeFallback(
    request: IRChatRequest,
    attemptedBackends: string[],
    error: AdapterError,
    signal?: AbortSignal
  ): Promise<IRChatResponse> {
    const strategy = this.config.fallbackStrategy || 'sequential';

    if (strategy === 'sequential') {
      return this.fallbackSequential(request, attemptedBackends, signal);
    } else if (strategy === 'parallel') {
      return this.fallbackParallel(request, attemptedBackends, signal);
    } else if (strategy === 'custom' && this.config.customFallback) {
      const available = this.getAvailableBackends().filter(
        name => !attemptedBackends.includes(name)
      );
      const nextBackend = await this.config.customFallback(
        request,
        attemptedBackends[attemptedBackends.length - 1]!,
        error,
        attemptedBackends,
        available
      );

      if (nextBackend && !attemptedBackends.includes(nextBackend)) {
        attemptedBackends.push(nextBackend);
        return this.executeOnBackend(nextBackend, request, signal);
      }
    }

    throw error;
  }

  /**
   * Translate model name for a specific backend.
   *
   * Applies translation strategy: backend-specific exact → global exact → pattern → default → passthrough
   */
  private translateModelForBackend(
    modelName: string,
    backendName: string
  ): TranslationResult {
    const strategy = this.config.modelTranslation?.strategy ?? 'hybrid';
    const strictMode = this.config.modelTranslation?.strictMode ?? false;

    // 0. Try backend-specific exact match (highest priority)
    if (strategy !== 'none') {
      const backendMapping = this.backendTranslationMappings.get(backendName);
      if (backendMapping) {
        const backendExactMatch = backendMapping.get(modelName);
        if (backendExactMatch) {
          return {
            translated: backendExactMatch,
            source: 'exact',
            wasTranslated: true,
          };
        }
      }
    }

    // 1. Try global exact match (all strategies except 'none')
    if (strategy !== 'none') {
      const exactMatch = this.modelTranslationMapping.get(modelName);
      if (exactMatch) {
        return {
          translated: exactMatch,
          source: 'exact',
          wasTranslated: true,
        };
      }
    }

    // 2. Try pattern match (pattern and hybrid strategies)
    if (strategy === 'pattern' || strategy === 'hybrid') {
      // Sort patterns by priority (higher priority first)
      const sortedPatterns = [...this.modelPatterns].sort((a, b) => {
        const priorityA = a.priority ?? 0;
        const priorityB = b.priority ?? 0;
        return priorityB - priorityA;
      });

      for (const patternMapping of sortedPatterns) {
        if (patternMapping.pattern.test(modelName)) {
          // Use targetModel if specified, otherwise original model
          const translated = patternMapping.targetModel ?? modelName;
          return {
            translated,
            source: 'pattern',
            wasTranslated: patternMapping.targetModel !== undefined,
          };
        }
      }
    }

    // 3. Try backend default (hybrid strategy only)
    if (strategy === 'hybrid') {
      const backendState = this.backends.get(backendName);
      const defaultModel = (backendState?.adapter as any).config?.defaultModel;

      if (defaultModel) {
        // Emit warning if configured
        if (this.config.modelTranslation?.warnOnDefault) {
          // Note: Event emission would be added in a later task
          console.warn(
            `[Router] Using backend default model for '${modelName}': '${defaultModel}' (backend: ${backendName})`
          );
        }

        return {
          translated: defaultModel,
          source: 'default',
          wasTranslated: true,
        };
      }
    }

    // 4. No translation found
    if (strictMode) {
      throw new AdapterError({
        code: ErrorCode.ROUTING_FAILED,
        message: `No translation found for model: ${modelName}`,
        isRetryable: false,
        provenance: { router: this.metadata.name, backend: backendName },
      });
    }

    // Return original model (passthrough)
    return {
      translated: modelName,
      source: 'none',
      wasTranslated: false,
    };
  }

  /**
   * Sequential fallback: try backends one by one.
   */
  private async fallbackSequential(
    request: IRChatRequest,
    attemptedBackends: string[],
    signal?: AbortSignal
  ): Promise<IRChatResponse> {
    const available = this.getAvailableBackends().filter(
      name => !attemptedBackends.includes(name)
    );

    // Use fallback chain if configured
    const candidates = this.fallbackChain.length > 0
      ? this.fallbackChain.filter(name => available.includes(name))
      : available;

    let lastError: Error | undefined;

    for (const backendName of candidates) {
      try {
        attemptedBackends.push(backendName);

        // Translate model for this backend
        const originalModel = request.parameters?.model ?? '';
        const translationResult = this.translateModelForBackend(originalModel, backendName);

        // Create request with translated model
        const translatedRequest: IRChatRequest = {
          ...request,
          parameters: {
            ...request.parameters,
            model: translationResult.translated,
          },
        };

        // Log translation if applicable
        if (translationResult.wasTranslated) {
          console.log(
            `[Router] Model translated: ${originalModel} → ${translationResult.translated} ` +
            `(source: ${translationResult.source}, backend: ${backendName})`
          );
        }

        return await this.executeOnBackend(backendName, translatedRequest, signal);
      } catch (error) {
        lastError = error as Error;
        continue;
      }
    }

    throw lastError || new AdapterError({
      code: ErrorCode.ALL_BACKENDS_FAILED,
      message: 'All fallback backends failed',
      isRetryable: false,
      provenance: { router: this.metadata.name },
    });
  }

  /**
   * Parallel fallback: try all remaining backends at once.
   */
  private async fallbackParallel(
    request: IRChatRequest,
    attemptedBackends: string[],
    signal?: AbortSignal
  ): Promise<IRChatResponse> {
    const available = this.getAvailableBackends().filter(
      name => !attemptedBackends.includes(name)
    );

    if (available.length === 0) {
      throw new AdapterError({
        code: ErrorCode.NO_BACKEND_AVAILABLE,
        message: 'No available fallback backends',
        isRetryable: false,
        provenance: { router: this.metadata.name },
      });
    }

    // Create promises with model translation for each backend
    const originalModel = request.parameters?.model ?? '';
    const promises = available.map(backendName => {
      // Translate model for this backend
      const translationResult = this.translateModelForBackend(originalModel, backendName);

      // Create request with translated model
      const translatedRequest: IRChatRequest = {
        ...request,
        parameters: {
          ...request.parameters,
          model: translationResult.translated,
        },
      };

      // Log translation if applicable
      if (translationResult.wasTranslated) {
        console.log(
          `[Router] Model translated: ${originalModel} → ${translationResult.translated} ` +
          `(source: ${translationResult.source}, backend: ${backendName})`
        );
      }

      return this.executeOnBackend(backendName, translatedRequest, signal);
    });

    try {
      return await Promise.race(promises);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check circuit breaker state.
   */
  private checkCircuitBreaker(name: string, state: BackendState): void {
    if (state.circuitBreakerState === 'open') {
      // Check if timeout has passed
      const timeout = this.config.circuitBreakerTimeout || 60000;
      if (state.circuitOpenedAt && Date.now() - state.circuitOpenedAt > timeout) {
        state.circuitBreakerState = 'half-open';
      } else {
        throw new AdapterError({
          code: ErrorCode.PROVIDER_UNAVAILABLE,
          message: `Circuit breaker is open for backend '${name}'`,
          isRetryable: true,
          provenance: { router: this.metadata.name, backend: name },
        });
      }
    }
  }

  /**
   * Get list of available backends.
   */
  private getAvailableBackends(): string[] {
    const available: string[] = [];

    for (const [name, state] of this.backends.entries()) {
      if (state.isHealthy && state.circuitBreakerState !== 'open') {
        available.push(name);
      }
    }

    return available;
  }

  /**
   * Check if backend is available.
   */
  private isBackendAvailable(name: string): boolean {
    const state = this.backends.get(name);
    if (!state) return false;
    return state.isHealthy && state.circuitBreakerState !== 'open';
  }

  /**
   * Routing: explicit backend selection.
   */
  private routeExplicit(preferredBackend?: string): string | null {
    if (preferredBackend && this.isBackendAvailable(preferredBackend)) {
      return preferredBackend;
    }
    return null;
  }

  /**
   * Routing: model-based selection.
   */
  private routeByModel(request: IRChatRequest): string | null {
    const model = request.parameters?.model;
    if (!model) return null;

    // Check exact mapping
    const exactMatch = this.modelMapping.get(model);
    if (exactMatch && this.isBackendAvailable(exactMatch)) {
      return exactMatch;
    }

    // Check pattern matching
    for (const pattern of this.modelPatterns) {
      if (pattern.pattern.test(model) && this.isBackendAvailable(pattern.backend)) {
        return pattern.backend;
      }
    }

    return null;
  }

  /**
   * Routing: cost-optimized selection.
   */
  private routeByCost(_request: IRChatRequest): string | null {
    if (!this.config.trackCost) return null;

    let bestBackend: string | null = null;
    let lowestAvgCost = Infinity;

    for (const [name, state] of this.backends.entries()) {
      if (!this.isBackendAvailable(name)) continue;

      const stats = this.calculateBackendStats(state);
      const avgCost = stats.averageCost || 0;

      if (avgCost < lowestAvgCost) {
        lowestAvgCost = avgCost;
        bestBackend = name;
      }
    }

    return bestBackend;
  }

  /**
   * Routing: latency-optimized selection.
   */
  private routeByLatency(): string | null {
    if (!this.config.trackLatency) return null;

    let bestBackend: string | null = null;
    let lowestLatency = Infinity;

    for (const [name, state] of this.backends.entries()) {
      if (!this.isBackendAvailable(name)) continue;

      const stats = this.calculateBackendStats(state);
      const avgLatency = stats.averageLatencyMs;

      if (avgLatency < lowestLatency) {
        lowestLatency = avgLatency;
        bestBackend = name;
      }
    }

    return bestBackend;
  }

  /**
   * Routing: round-robin selection.
   */
  private routeRoundRobin(): string | null {
    const available = this.getAvailableBackends();
    if (available.length === 0) return null;

    const backend = available[this.roundRobinIndex % available.length];
    this.roundRobinIndex++;

    return backend || null;
  }

  /**
   * Routing: random selection.
   */
  private routeRandom(): string | null {
    const available = this.getAvailableBackends();
    if (available.length === 0) return null;

    const index = Math.floor(Math.random() * available.length);
    return available[index] || null;
  }

  /**
   * Select backend based on capability requirements.
   * Returns the backend name with the best matching model, or null if none match.
   */
  private async selectBackendByCapabilities(request: IRChatRequest): Promise<string | null> {
    // Extract capability requirements from request metadata
    const capabilityRequirements = request.metadata?.custom?.capabilityRequirements as CapabilityRequirements | undefined;

    // Build requirements from config if not provided
    const requirements: CapabilityRequirements = {
      required: capabilityRequirements?.required,
      preferred: capabilityRequirements?.preferred,
      optimization: capabilityRequirements?.optimization || this.config.optimization || 'balanced',
      weights: capabilityRequirements?.weights || this.config.optimizationWeights,
    };

    // Collect available models from all backends
    const availableModels: BackendModel[] = [];

    for (const backendName of this.getAvailableBackends()) {
      const backend = this.backends.get(backendName)?.adapter;
      if (!backend) continue;

      // Try to get models from backend's listModels()
      if (typeof backend.listModels === 'function') {
        try {
          const result = await backend.listModels();
          for (const model of result.models) {
            availableModels.push({ model, backend: backendName });
          }
        } catch (error) {
          // If listModels fails, try to infer from requested model
          const requestedModel = request.parameters?.model;
          if (requestedModel) {
            const inferredModel: AIModel = {
              id: requestedModel,
              name: requestedModel,
              capabilities: inferCapabilities(requestedModel),
            };
            availableModels.push({ model: inferredModel, backend: backendName });
          }
        }
      } else {
        // Backend doesn't support listModels, try to infer from requested model
        const requestedModel = request.parameters?.model;
        if (requestedModel) {
          const inferredModel: AIModel = {
            id: requestedModel,
            name: requestedModel,
            capabilities: inferCapabilities(requestedModel),
          };
          availableModels.push({ model: inferredModel, backend: backendName });
        }
      }
    }

    if (availableModels.length === 0) {
      return null;
    }

    // Find best match
    const bestMatch = findBestModel(requirements, availableModels);

    if (!bestMatch || !bestMatch.meetsRequirements) {
      return null;
    }

    return bestMatch.backend;
  }

  /**
   * Calculate backend statistics.
   */
  private calculateBackendStats(state: BackendState): BackendStats {
    const successRate = state.totalRequests > 0
      ? (state.successfulRequests / state.totalRequests) * 100
      : 0;

    const sortedLatencies = [...state.latencies].sort((a, b) => a - b);
    const avgLatency = sortedLatencies.length > 0
      ? sortedLatencies.reduce((a, b) => a + b, 0) / sortedLatencies.length
      : 0;

    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
    const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
    const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;

    const avgCost = state.totalRequests > 0
      ? state.totalCost / state.totalRequests
      : 0;

    return {
      totalRequests: state.totalRequests,
      successfulRequests: state.successfulRequests,
      failedRequests: state.failedRequests,
      successRate,
      averageLatencyMs: avgLatency,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      p99LatencyMs: p99,
      totalCost: this.config.trackCost ? state.totalCost : undefined,
      averageCost: this.config.trackCost ? avgCost : undefined,
    };
  }

  /**
   * Create backend info from state.
   */
  private createBackendInfo(name: string, state: BackendState): BackendInfo {
    return {
      name,
      adapter: state.adapter,
      metadata: state.adapter.metadata,
      isHealthy: state.isHealthy,
      lastHealthCheck: state.lastHealthCheck,
      circuitBreakerState: state.circuitBreakerState,
      consecutiveFailures: state.consecutiveFailures,
      stats: this.calculateBackendStats(state),
    };
  }

  /**
   * Start periodic health checking.
   */
  private startHealthChecking(): void {
    if (this.healthCheckInterval) return;

    const interval = this.config.healthCheckInterval || 0;
    if (interval <= 0) return;

    this.healthCheckInterval = setInterval(() => {
      this.checkHealth().catch(() => {
        // Ignore errors in background health checks
      });
    }, interval);
  }

  /**
   * Combine multiple abort signals.
   */
  private combineSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    return controller.signal;
  }

  /**
   * Wrap unknown error as AdapterError.
   */
  private wrapError(error: unknown): AdapterError {
    if (error instanceof AdapterError) {
      return error;
    }

    return new AdapterError({
      code: ErrorCode.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : String(error),
      isRetryable: false,
      provenance: { router: this.metadata.name },
      cause: error instanceof Error ? error : undefined,
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Router instance.
 */
export function createRouter(config?: Partial<RouterConfig>): Router {
  return new Router(config);
}
