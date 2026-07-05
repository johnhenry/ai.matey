/**
 * Prometheus Metrics
 *
 * Pull-based metrics endpoint: formats Bridge/Router statistics (which are
 * already tracked internally) as Prometheus text exposition format v0.0.4.
 * No new instrumentation and no dependencies.
 *
 * @module
 */

import type { GenericRequest, GenericResponse } from './types.js';
import type { Bridge, Router } from 'ai.matey.core';

/**
 * A single metric sample.
 */
export interface MetricSample {
  readonly name: string;
  readonly type: 'counter' | 'gauge' | 'summary';
  readonly help?: string;
  readonly labels?: Record<string, string>;
  readonly value: number;
}

/**
 * Format samples as Prometheus text exposition format.
 *
 * Samples with the same name share one HELP/TYPE header; label values are
 * escaped per the spec.
 */
export function formatPrometheus(samples: readonly MetricSample[]): string {
  const lines: string[] = [];
  const seenHeaders = new Set<string>();

  for (const sample of samples) {
    if (!seenHeaders.has(sample.name)) {
      seenHeaders.add(sample.name);
      if (sample.help) {
        lines.push(`# HELP ${sample.name} ${escapeHelp(sample.help)}`);
      }
      lines.push(`# TYPE ${sample.name} ${sample.type === 'summary' ? 'gauge' : sample.type}`);
    }

    const labels = sample.labels
      ? `{${Object.entries(sample.labels)
          .map(([key, value]) => `${key}="${escapeLabel(value)}"`)
          .join(',')}}`
      : '';
    lines.push(`${sample.name}${labels} ${formatValue(sample.value)}`);
  }

  return lines.join('\n') + '\n';
}

function escapeHelp(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
}

function escapeLabel(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function formatValue(value: number): string {
  if (Number.isNaN(value)) {
    return 'NaN';
  }
  if (!Number.isFinite(value)) {
    return value > 0 ? '+Inf' : '-Inf';
  }
  return String(value);
}

/**
 * Collect metrics from a Bridge's built-in statistics.
 */
export function collectBridgeMetrics(bridge: Bridge, prefix = 'ai_matey'): MetricSample[] {
  const stats = bridge.getStats();
  const samples: MetricSample[] = [
    {
      name: `${prefix}_requests_total`,
      type: 'counter',
      help: 'Total requests through the bridge',
      value: stats.totalRequests,
    },
    {
      name: `${prefix}_requests_successful_total`,
      type: 'counter',
      help: 'Successful requests',
      value: stats.successfulRequests,
    },
    {
      name: `${prefix}_requests_failed_total`,
      type: 'counter',
      help: 'Failed requests',
      value: stats.failedRequests,
    },
    {
      name: `${prefix}_streaming_requests_total`,
      type: 'counter',
      help: 'Streaming requests',
      value: stats.streamingRequests,
    },
  ];

  const latencyByQuantile: Record<string, number> = {
    '50': stats.p50LatencyMs,
    '95': stats.p95LatencyMs,
    '99': stats.p99LatencyMs,
  };
  for (const [quantile, value] of Object.entries(latencyByQuantile)) {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      samples.push({
        name: `${prefix}_request_latency_ms`,
        type: 'summary',
        help: 'Request latency percentiles in milliseconds',
        labels: { quantile },
        value,
      });
    }
  }

  for (const [code, count] of Object.entries(stats.errorBreakdown ?? {})) {
    samples.push({
      name: `${prefix}_errors_total`,
      type: 'counter',
      help: 'Errors by code',
      labels: { code },
      value: count,
    });
  }

  return samples;
}

const CIRCUIT_STATES = ['closed', 'open', 'half-open'] as const;

/**
 * Collect metrics from a Router's per-backend statistics.
 */
export function collectRouterMetrics(router: Router, prefix = 'ai_matey'): MetricSample[] {
  const samples: MetricSample[] = [];

  for (const info of router.getBackendInfo()) {
    const labels = { backend: info.name };

    samples.push(
      {
        name: `${prefix}_backend_up`,
        type: 'gauge',
        help: 'Backend health (1 = healthy)',
        labels,
        value: info.isHealthy ? 1 : 0,
      },
      {
        name: `${prefix}_backend_requests_total`,
        type: 'counter',
        help: 'Requests per backend',
        labels,
        value: info.stats.totalRequests,
      },
      {
        name: `${prefix}_backend_failures_total`,
        type: 'counter',
        help: 'Failed requests per backend',
        labels,
        value: info.stats.failedRequests,
      },
      {
        name: `${prefix}_backend_cost_usd_total`,
        type: 'counter',
        help: 'Estimated cost per backend in USD',
        labels,
        value: info.stats.totalCost ?? 0,
      }
    );

    for (const state of CIRCUIT_STATES) {
      samples.push({
        name: `${prefix}_backend_circuit_state`,
        type: 'gauge',
        help: 'Circuit breaker state (1 = active state)',
        labels: { ...labels, state },
        value: info.circuitBreakerState === state ? 1 : 0,
      });
    }

    if (typeof info.stats.averageLatencyMs === 'number') {
      samples.push({
        name: `${prefix}_backend_latency_avg_ms`,
        type: 'gauge',
        help: 'Average latency per backend in milliseconds',
        labels,
        value: info.stats.averageLatencyMs,
      });
    }
  }

  return samples;
}

/**
 * Options for the metrics handler.
 */
export interface MetricsHandlerOptions {
  readonly bridge?: Bridge;
  readonly router?: Router;
  /** Additional samples (custom gauges, cost summaries, ...). */
  readonly custom?: () => MetricSample[];
  /** Metric name prefix. @default 'ai_matey' */
  readonly prefix?: string;
}

/**
 * Create a GET /metrics handler emitting Prometheus text format.
 */
export function createMetricsHandler(
  options: MetricsHandlerOptions
): (req: GenericRequest, res: GenericResponse) => void {
  const prefix = options.prefix ?? 'ai_matey';

  return (_req: GenericRequest, res: GenericResponse): void => {
    const samples: MetricSample[] = [
      ...(options.bridge ? collectBridgeMetrics(options.bridge, prefix) : []),
      ...(options.router ? collectRouterMetrics(options.router, prefix) : []),
      ...(options.custom ? options.custom() : []),
    ];

    res.status(200);
    res.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(formatPrometheus(samples));
  };
}
