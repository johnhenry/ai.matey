/**
 * Telemetry Middleware
 *
 * Tracks metrics, events, and performance data for requests and responses.
 *
 * @module
 */

import type { Middleware, MiddlewareContext, MiddlewareNext, TelemetrySink } from 'ai.matey.types';
import type { IRChatResponse } from 'ai.matey.types';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for telemetry middleware.
 */
export interface TelemetryConfig {
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

  /**
   * Custom tags to add to all metrics.
   */
  tags?: Record<string, string>;

  /**
   * Sample rate (0.0 to 1.0).
   * @default 1.0 (100%)
   */
  sampleRate?: number;
}

/**
 * Metric names.
 */
export const MetricNames = {
  REQUEST_COUNT: 'ai.adapter.request.count',
  REQUEST_DURATION: 'ai.adapter.request.duration',
  REQUEST_ERROR: 'ai.adapter.request.error',
  TOKEN_PROMPT: 'ai.adapter.tokens.prompt',
  TOKEN_COMPLETION: 'ai.adapter.tokens.completion',
  TOKEN_TOTAL: 'ai.adapter.tokens.total',
} as const;

/**
 * Event names.
 */
export const EventNames = {
  REQUEST_START: 'ai.adapter.request.start',
  REQUEST_COMPLETE: 'ai.adapter.request.complete',
  REQUEST_ERROR: 'ai.adapter.request.error',
} as const;

// ============================================================================
// Sampling
// ============================================================================

/**
 * Determine if this request should be sampled.
 */
function shouldSample(sampleRate: number): boolean {
  return Math.random() < sampleRate;
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create telemetry middleware.
 *
 * Tracks metrics and events for monitoring and observability.
 *
 * @param config Telemetry configuration
 * @returns Telemetry middleware
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
export function createTelemetryMiddleware(config: TelemetryConfig): Middleware {
  const {
    sink,
    trackCounts = true,
    trackLatencies = true,
    trackErrors = true,
    trackTokens = true,
    tags = {},
    sampleRate = 1.0,
  } = config;

  return async (context: MiddlewareContext, next: MiddlewareNext): Promise<IRChatResponse> => {
    // Check if we should sample this request
    const sampled = shouldSample(sampleRate);

    const startTime = Date.now();
    const requestId = context.request.metadata.requestId;

    // Build base tags
    const baseTags: Record<string, string> = {
      ...tags,
      request_id: requestId,
      model: context.request.parameters?.model ?? 'unknown',
      stream: String(context.request.stream ?? false),
      frontend: context.request.metadata.provenance?.frontend ?? 'unknown',
    };

    // Record request start event
    if (sampled) {
      sink.recordEvent(EventNames.REQUEST_START, {
        requestId,
        model: context.request.parameters?.model,
        messageCount: context.request.messages.length,
        stream: context.request.stream,
        timestamp: startTime,
      });
    }

    try {
      // Call next middleware/handler
      const response = await next();

      const duration = Date.now() - startTime;

      // Add backend to tags
      const responseTags: Record<string, string> = {
        ...baseTags,
        backend: response.metadata.provenance?.backend ?? 'unknown',
        finish_reason: response.finishReason,
      };

      // Record metrics
      if (sampled) {
        // Track request count
        if (trackCounts) {
          sink.recordMetric(MetricNames.REQUEST_COUNT, 1, {
            ...responseTags,
            status: 'success',
          });
        }

        // Track latency
        if (trackLatencies) {
          sink.recordMetric(MetricNames.REQUEST_DURATION, duration, responseTags);
        }

        // Track token usage
        if (trackTokens && response.usage) {
          if (response.usage.promptTokens) {
            sink.recordMetric(MetricNames.TOKEN_PROMPT, response.usage.promptTokens, responseTags);
          }
          if (response.usage.completionTokens) {
            sink.recordMetric(
              MetricNames.TOKEN_COMPLETION,
              response.usage.completionTokens,
              responseTags
            );
          }
          if (response.usage.totalTokens) {
            sink.recordMetric(MetricNames.TOKEN_TOTAL, response.usage.totalTokens, responseTags);
          }
        }

        // Record completion event
        sink.recordEvent(EventNames.REQUEST_COMPLETE, {
          requestId,
          duration,
          backend: response.metadata.provenance?.backend,
          finishReason: response.finishReason,
          usage: response.usage,
          timestamp: Date.now(),
        });
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Add error info to tags
      const errorTags: Record<string, string> = {
        ...baseTags,
        error_type: error instanceof Error ? error.name : 'unknown',
      };

      // Record error metrics
      if (sampled) {
        if (trackCounts) {
          sink.recordMetric(MetricNames.REQUEST_COUNT, 1, {
            ...errorTags,
            status: 'error',
          });
        }

        if (trackLatencies) {
          sink.recordMetric(MetricNames.REQUEST_DURATION, duration, errorTags);
        }

        if (trackErrors) {
          sink.recordMetric(MetricNames.REQUEST_ERROR, 1, errorTags);
        }

        // Record error event
        sink.recordEvent(EventNames.REQUEST_ERROR, {
          requestId,
          duration,
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.name : 'unknown',
          timestamp: Date.now(),
        });
      }

      // Re-throw error
      throw error;
    }
  };
}

// ============================================================================
// Built-in Sinks
// ============================================================================

/**
 * Console telemetry sink for development/debugging.
 */
export class ConsoleTelemetrySink implements TelemetrySink {
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    console.log('[Telemetry Metric]', { name, value, tags });
  }

  recordEvent(name: string, data?: Record<string, unknown>): void {
    console.log('[Telemetry Event]', { name, data });
  }
}

/**
 * In-memory telemetry sink for testing.
 */
export class InMemoryTelemetrySink implements TelemetrySink {
  private metrics: Array<{ name: string; value: number; tags?: Record<string, string> }> = [];
  private events: Array<{ name: string; data?: Record<string, unknown> }> = [];

  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.push({ name, value, tags });
  }

  recordEvent(name: string, data?: Record<string, unknown>): void {
    this.events.push({ name, data });
  }

  getMetrics(): Array<{ name: string; value: number; tags?: Record<string, string> }> {
    return [...this.metrics];
  }

  getEvents(): Array<{ name: string; data?: Record<string, unknown> }> {
    return [...this.events];
  }

  clear(): void {
    this.metrics = [];
    this.events = [];
  }
}
