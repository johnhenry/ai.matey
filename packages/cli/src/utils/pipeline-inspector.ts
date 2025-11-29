/**
 * CLI Pipeline Inspector - visualize pipeline execution
 */

// Local debug types (from debug module)
export type DebugLevel = 'off' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
export type DebugEventType =
  | 'pipeline_start'
  | 'pipeline_end'
  | 'middleware_start'
  | 'middleware_end'
  | 'adapter_call'
  | 'adapter_response'
  | 'adapter_stream_chunk'
  | 'error'
  | 'warning';

export interface TraceStep {
  readonly name: string;
  readonly type: 'middleware' | 'adapter' | 'router';
  readonly startTime: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly error?: Error;
  readonly metadata?: Record<string, unknown>;
}

export interface PipelineTrace {
  readonly requestId: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly events: readonly unknown[];
  readonly steps: readonly TraceStep[];
  readonly error?: Error;
}

export interface DebugStats {
  readonly totalRequests: number;
  readonly totalEvents: number;
  readonly eventsByType: Record<DebugEventType, number>;
  readonly averageDuration: number;
  readonly errorCount: number;
  readonly warningCount: number;
}

/**
 * Format a trace for CLI display
 */
export function formatTrace(trace: PipelineTrace): string {
  const lines: string[] = [];

  lines.push(`\n┌─ Pipeline Trace: ${trace.requestId}`);
  lines.push(`├─ Duration: ${trace.duration ? `${trace.duration}ms` : 'in progress'}`);
  lines.push(`├─ Status: ${trace.error ? '✗ Error' : '✓ Success'}`);

  if (trace.steps.length > 0) {
    lines.push(`└─ Steps:`);

    for (let i = 0; i < trace.steps.length; i++) {
      const step = trace.steps[i]!;
      const isLast = i === trace.steps.length - 1;
      const prefix = isLast ? '   └─' : '   ├─';

      lines.push(
        `${prefix} ${step.name} (${step.type}) - ${step.duration ? `${step.duration}ms` : 'running'}`
      );

      if (step.error) {
        lines.push(`${isLast ? '      ' : '   │  '}✗ ${step.error.message}`);
      }
    }
  }

  if (trace.error) {
    lines.push(`\nError: ${trace.error.message}`);
  }

  return lines.join('\n');
}

/**
 * Format multiple traces
 */
export function formatTraces(traces: readonly PipelineTrace[]): string {
  if (traces.length === 0) {
    return 'No traces available';
  }

  return traces.map(formatTrace).join('\n\n');
}

/**
 * Format debug statistics
 */
export function formatStats(stats: DebugStats): string {
  const lines: string[] = [];

  lines.push('\n┌─ Debug Statistics');
  lines.push(`├─ Total Requests: ${stats.totalRequests}`);
  lines.push(`├─ Total Events: ${stats.totalEvents}`);
  lines.push(`├─ Average Duration: ${stats.averageDuration.toFixed(2)}ms`);
  lines.push(`├─ Errors: ${stats.errorCount}`);
  lines.push(`├─ Warnings: ${stats.warningCount}`);

  const eventTypes = Object.entries(stats.eventsByType);
  if (eventTypes.length > 0) {
    lines.push(`└─ Events by Type:`);

    for (let i = 0; i < eventTypes.length; i++) {
      const [type, count] = eventTypes[i]!;
      const isLast = i === eventTypes.length - 1;
      const prefix = isLast ? '   └─' : '   ├─';
      lines.push(`${prefix} ${type}: ${count}`);
    }
  }

  return lines.join('\n');
}

/**
 * Create a simple visualization of pipeline flow
 */
export function visualizePipeline(trace: PipelineTrace): string {
  const lines: string[] = [];

  lines.push('\nPipeline Flow:');
  lines.push('─'.repeat(60));

  let offset = 0;
  const totalDuration = trace.duration || Date.now() - trace.startTime;
  const scale = 50 / totalDuration;

  for (const step of trace.steps) {
    if (!step.duration) continue;

    const barLength = Math.max(1, Math.floor(step.duration * scale));
    const bar = '█'.repeat(barLength);
    const status = step.error ? '✗' : '✓';

    lines.push(`${status} ${step.name.padEnd(20)} ${bar} ${step.duration}ms`);
    offset += step.duration;
  }

  lines.push('─'.repeat(60));
  lines.push(`Total: ${totalDuration}ms`);

  return lines.join('\n');
}
