/**
 * Bridge Implementation
 *
 * The Bridge connects frontend and backend adapters with middleware support.
 * It's the main entry point for making requests through the universal adapter system.
 *
 * @module
 */

import type {
  FrontendAdapter,
  BackendAdapter,
  InferFrontendRequest,
  InferFrontendResponse,
  InferFrontendStreamChunk,
} from 'ai.matey.types';
import type { IRChatRequest, IRChatResponse } from 'ai.matey.types';
import type {
  BridgeConfig,
  RequestOptions,
  Bridge as IBridge,
  BridgeStats,
  BridgeEventType,
  BridgeEventListener,
} from 'ai.matey.types';
import type { Middleware } from 'ai.matey.types';
import type {
  ListModelsOptions,
  ListModelsResult,
} from 'ai.matey.types';
import { MiddlewareStack, createMiddlewareContext, createStreamingMiddlewareContext } from './middleware-stack.js';
import { AdapterError, ErrorCode, ValidationError } from 'ai.matey.errors';
import { validateIRChatRequest } from 'ai.matey.utils';

// ============================================================================
// Bridge Implementation
// ============================================================================

/**
 * Bridge connects frontend and backend adapters.
 *
 * @template TFrontend Frontend adapter type
 */
export class Bridge<TFrontend extends FrontendAdapter = FrontendAdapter>
  implements IBridge<TFrontend>
{
  readonly frontend: TFrontend;
  readonly backend: BackendAdapter;
  readonly config: BridgeConfig;
  private middlewareStack: MiddlewareStack;

  // Statistics tracking
  private _totalRequests = 0;
  private _successfulRequests = 0;
  private _failedRequests = 0;
  private _streamingRequests = 0;
  private _latencies: number[] = [];
  private _errorCounts: Record<string, number> = {};
  private _statsResetTimestamp = Date.now();

  // Event listeners (stored for future event emission)
  private _eventListeners: Map<string, Set<BridgeEventListener>> = new Map();

  /**
   * Create a new Bridge instance.
   *
   * @param frontend Frontend adapter
   * @param backend Backend adapter
   * @param config Bridge configuration
   */
  constructor(
    frontend: TFrontend,
    backend: BackendAdapter,
    config: Partial<BridgeConfig> = {}
  ) {
    this.frontend = frontend;
    this.backend = backend;
    this.config = {
      debug: config.debug ?? false,
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 0,
      autoRequestId: config.autoRequestId ?? true,
      defaultModel: config.defaultModel,
      routerConfig: config.routerConfig,
      custom: config.custom,
    };
    this.middlewareStack = new MiddlewareStack();
  }

  // ==========================================================================
  // Core Request Methods
  // ==========================================================================

  /**
   * Execute a non-streaming chat completion request.
   */
  async chat(
    request: InferFrontendRequest<TFrontend>,
    options?: RequestOptions
  ): Promise<InferFrontendResponse<TFrontend>> {
    const startTime = Date.now();
    this._totalRequests++;

    try {
      // Step 1: Convert frontend request to IR
      const irRequest = await this.frontend.toIR(request as any);

      // Step 2: Ensure metadata has requestId and timestamp
      const enrichedRequest = this.enrichRequest(irRequest, options);

      // Step 3: Validate IR request
      validateIRChatRequest(enrichedRequest, {
        frontend: this.frontend.metadata.name,
      });

      // Step 4: Create middleware context
      const context = createMiddlewareContext(
        enrichedRequest,
        this.config as Record<string, unknown>,
        options?.signal
      );

      // Step 5: Execute middleware stack + backend
      const irResponse = await this.middlewareStack.execute(context, async () => {
        // Call backend adapter
        return await this.backend.execute(enrichedRequest, options?.signal);
      });

      // Step 6: Enrich response with provenance
      const enrichedResponse = this.enrichResponse(irResponse, enrichedRequest);

      // Step 7: Convert IR response to frontend format
      const frontendResponse = await this.frontend.fromIR(enrichedResponse);

      // Track success
      this._successfulRequests++;
      this._latencies.push(Date.now() - startTime);

      return frontendResponse as InferFrontendResponse<TFrontend>;
    } catch (error) {
      // Track failure
      this._failedRequests++;
      const errorCode = error instanceof AdapterError ? error.code : 'UNKNOWN';
      this._errorCounts[errorCode] = (this._errorCounts[errorCode] || 0) + 1;

      // Re-throw adapter errors, wrap others
      if (error instanceof AdapterError) {
        throw error;
      }

      throw new AdapterError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Bridge execution failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: false,
        cause: error instanceof Error ? error : undefined,
        provenance: {},
      });
    }
  }

  /**
   * Execute a streaming chat completion request.
   */
  async *chatStream(
    request: InferFrontendRequest<TFrontend>,
    options?: RequestOptions
  ): AsyncGenerator<InferFrontendStreamChunk<TFrontend>, void, undefined> {
    const startTime = Date.now();
    this._totalRequests++;
    this._streamingRequests++;

    try {
      // Step 1: Convert frontend request to IR
      const irRequest = await this.frontend.toIR(request as any);

      // Step 2: Ensure streaming is enabled
      const streamingRequest: IRChatRequest = {
        ...irRequest,
        stream: true,
      };

      // Step 3: Ensure metadata has requestId and timestamp
      const enrichedRequest = this.enrichRequest(streamingRequest, options);

      // Step 4: Validate IR request
      validateIRChatRequest(enrichedRequest, {
        frontend: this.frontend.metadata.name,
      });

      // Step 5: Create streaming middleware context
      const context = createStreamingMiddlewareContext(
        enrichedRequest,
        this.config as Record<string, unknown>,
        options?.signal
      );

      // Step 6: Execute middleware stack + backend
      const irStream = await this.middlewareStack.executeStream(context, async () => {
        // Call backend adapter streaming
        return this.backend.executeStream(enrichedRequest, options?.signal);
      });

      // Step 7: Convert IR stream to frontend format
      const frontendStream = this.frontend.fromIRStream(irStream);

      // Step 8: Yield chunks to caller
      for await (const chunk of frontendStream) {
        yield chunk as InferFrontendStreamChunk<TFrontend>;
      }

      // Track success (after stream completes)
      this._successfulRequests++;
      this._latencies.push(Date.now() - startTime);
    } catch (error) {
      // Track failure
      this._failedRequests++;
      const errorCode = error instanceof AdapterError ? error.code : 'UNKNOWN';
      this._errorCounts[errorCode] = (this._errorCounts[errorCode] || 0) + 1;

      // Re-throw adapter errors, wrap others
      if (error instanceof AdapterError) {
        throw error;
      }

      throw new AdapterError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Bridge streaming failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: false,
        cause: error instanceof Error ? error : undefined,
        provenance: {},
      });
    }
  }

  // ==========================================================================
  // Model Listing
  // ==========================================================================

  /**
   * List available models from the backend.
   *
   * This delegates directly to the backend adapter's listModels() method.
   * Useful for discovering available models before making requests.
   *
   * @param options Options for listing models (filtering, cache control)
   * @returns List of available models, or null if backend doesn't support listing
   */
  async listModels(options?: ListModelsOptions): Promise<ListModelsResult | null> {
    if (!this.backend.listModels) {
      return null; // Backend doesn't support model listing
    }

    return await this.backend.listModels(options);
  }

  /**
   * Check if a specific model is available from the backend.
   *
   * @param modelId Model identifier to check
   * @returns true if model is available, false otherwise
   */
  async hasModel(modelId: string): Promise<boolean> {
    const result = await this.listModels();
    if (!result) return true; // Can't check, assume available

    return result.models.some((m) => m.id === modelId);
  }

  /**
   * Validate that a model is available (optional safety check).
   *
   * Note: This is an optional validation - the system doesn't automatically
   * validate models since cross-provider translation is supported.
   *
   * @param modelId Model identifier to validate
   * @throws {ValidationError} If model is not available
   */
  async validateModel(modelId: string): Promise<void> {
    const available = await this.hasModel(modelId);
    if (!available) {
      throw new ValidationError({
        code: ErrorCode.UNSUPPORTED_MODEL,
        message: `Model "${modelId}" is not available from backend "${this.backend.metadata.name}"`,
        validationDetails: [
          {
            field: 'model',
            value: modelId,
            reason: `Model not available from backend "${this.backend.metadata.name}"`,
            expected: 'Available model ID from backend',
          },
        ],
        provenance: {
          frontend: this.frontend.metadata.name,
          backend: this.backend.metadata.name,
        },
      });
    }
  }

  // ==========================================================================
  // Middleware Management
  // ==========================================================================

  /**
   * Add middleware to the bridge's middleware stack.
   */
  use(middleware: Middleware): Bridge<TFrontend> {
    this.middlewareStack.use(middleware);
    return this;
  }

  /**
   * Remove middleware from the stack (not implemented for locked stacks).
   */
  removeMiddleware(_middleware: Middleware): Bridge<TFrontend> {
    throw new Error('removeMiddleware not yet implemented');
  }

  /**
   * Clear all middleware from the stack.
   */
  clearMiddleware(): Bridge<TFrontend> {
    this.middlewareStack.clear();
    return this;
  }

  /**
   * Get all middleware in the stack.
   */
  getMiddleware(): readonly Middleware[] {
    return this.middlewareStack.getMiddleware();
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Register an event listener.
   *
   * Note: Event emission is not yet implemented. Listeners are stored
   * for future use when event emission is added.
   *
   * @param event Event type to listen for, or '*' for all events
   * @param listener Callback function
   */
  on(event: BridgeEventType | '*', listener: BridgeEventListener): Bridge<TFrontend> {
    const key = event as string;
    if (!this._eventListeners.has(key)) {
      this._eventListeners.set(key, new Set());
    }
    this._eventListeners.get(key)!.add(listener);
    return this;
  }

  /**
   * Remove an event listener.
   *
   * @param event Event type
   * @param listener Callback function to remove
   */
  off(event: BridgeEventType | '*', listener: BridgeEventListener): Bridge<TFrontend> {
    const key = event as string;
    const listeners = this._eventListeners.get(key);
    if (listeners) {
      listeners.delete(listener);
    }
    return this;
  }

  /**
   * Register a one-time event listener.
   *
   * Note: Event emission is not yet implemented. Listeners are stored
   * for future use when event emission is added.
   *
   * @param event Event type to listen for
   * @param listener Callback function
   */
  once(event: BridgeEventType, listener: BridgeEventListener): Bridge<TFrontend> {
    const wrappedListener: BridgeEventListener = (eventData) => {
      this.off(event, wrappedListener);
      return listener(eventData);
    };
    return this.on(event, wrappedListener);
  }

  // ==========================================================================
  // Statistics & Monitoring
  // ==========================================================================

  /**
   * Get runtime statistics for this bridge.
   *
   * @returns Bridge statistics including request counts, latencies, and error breakdown
   */
  getStats(): BridgeStats {
    const sortedLatencies = [...this._latencies].sort((a, b) => a - b);
    const len = sortedLatencies.length;

    const getPercentile = (p: number): number => {
      if (len === 0) return 0;
      const index = Math.ceil((p / 100) * len) - 1;
      return sortedLatencies[Math.max(0, Math.min(index, len - 1))];
    };

    const avgLatency = len > 0
      ? sortedLatencies.reduce((a, b) => a + b, 0) / len
      : 0;

    return {
      totalRequests: this._totalRequests,
      successfulRequests: this._successfulRequests,
      failedRequests: this._failedRequests,
      successRate: this._totalRequests > 0
        ? (this._successfulRequests / this._totalRequests) * 100
        : 100,
      streamingRequests: this._streamingRequests,
      averageLatencyMs: Math.round(avgLatency),
      p50LatencyMs: getPercentile(50),
      p95LatencyMs: getPercentile(95),
      p99LatencyMs: getPercentile(99),
      backendUsage: {
        [this.backend.metadata.name]: this._successfulRequests,
      },
      errorBreakdown: { ...this._errorCounts },
      sinceTimestamp: this._statsResetTimestamp,
    };
  }

  /**
   * Reset all statistics to zero.
   */
  resetStats(): void {
    this._totalRequests = 0;
    this._successfulRequests = 0;
    this._failedRequests = 0;
    this._streamingRequests = 0;
    this._latencies = [];
    this._errorCounts = {};
    this._statsResetTimestamp = Date.now();
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get router instance (returns null for basic Bridge).
   */
  getRouter(): null {
    return null;
  }

  /**
   * Clone bridge with new configuration.
   */
  clone(config: Partial<BridgeConfig>): Bridge<TFrontend> {
    return new Bridge(this.frontend, this.backend, {
      ...this.config,
      ...config,
    });
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    // Cleanup logic if needed
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Enrich request with metadata (requestId, timestamp, provenance) and apply defaults.
   */
  private enrichRequest(
    request: IRChatRequest,
    options?: RequestOptions
  ): IRChatRequest {
    // Always generate requestId if missing (frontend adapters should provide it)
    const requestId = request.metadata?.requestId || this.generateRequestId();

    const timestamp = request.metadata?.timestamp ?? Date.now();

    // Apply default model if not specified in request
    const model = request.parameters?.model || this.config.defaultModel;

    return {
      ...request,
      parameters: {
        ...request.parameters,
        ...(model && { model }),
      },
      metadata: {
        ...request.metadata,
        requestId,
        timestamp,
        provenance: {
          ...request.metadata?.provenance,
          frontend: this.frontend.metadata.name,
        },
        custom: {
          ...request.metadata?.custom,
          ...options?.metadata,
        },
      },
    };
  }

  /**
   * Enrich response with provenance and timing.
   */
  private enrichResponse(
    response: IRChatResponse,
    request: IRChatRequest
  ): IRChatResponse {
    return {
      ...response,
      metadata: {
        ...response.metadata,
        requestId: request.metadata.requestId,
        provenance: {
          ...response.metadata.provenance,
          frontend: this.frontend.metadata.name,
          backend: this.backend.metadata.name,
        },
      },
    };
  }

  /**
   * Generate unique request ID.
   */
  private generateRequestId(): string {
    // Use standard UUID v4 for request IDs
    return crypto.randomUUID();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new Bridge instance.
 *
 * @param frontend Frontend adapter
 * @param backend Backend adapter
 * @param config Bridge configuration
 * @returns Bridge instance
 */
export function createBridge<TFrontend extends FrontendAdapter>(
  frontend: TFrontend,
  backend: BackendAdapter,
  config?: Partial<BridgeConfig>
): Bridge<TFrontend> {
  return new Bridge(frontend, backend, config);
}
