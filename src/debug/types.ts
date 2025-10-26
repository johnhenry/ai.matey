/**
 * Debug system types
 */

/**
 * Debug level
 */
export type DebugLevel = 'off' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Debug event types
 */
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

/**
 * Debug event
 */
export interface DebugEvent {
  readonly type: DebugEventType;
  readonly timestamp: number;
  readonly level: DebugLevel;
  readonly message: string;
  readonly data?: unknown;
  readonly duration?: number;
  readonly error?: Error;
}

/**
 * Debug configuration
 */
export interface DebugConfig {
  /** Enable debug mode */
  readonly enabled: boolean;

  /** Debug level */
  readonly level: DebugLevel;

  /** Log to console */
  readonly console: boolean;

  /** Collect events in memory */
  readonly collect: boolean;

  /** Maximum number of events to collect */
  readonly maxEvents?: number;

  /** Custom event handler */
  readonly onEvent?: (event: DebugEvent) => void;

  /** Filter events by type */
  readonly filterTypes?: readonly DebugEventType[];

  /** Pretty print output */
  readonly pretty?: boolean;

  /** Include stack traces for errors */
  readonly stackTraces?: boolean;
}

/**
 * Pipeline trace - complete execution trace
 */
export interface PipelineTrace {
  readonly requestId: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly events: readonly DebugEvent[];
  readonly steps: readonly TraceStep[];
  readonly error?: Error;
}

/**
 * Trace step - single pipeline step
 */
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

/**
 * Debug statistics
 */
export interface DebugStats {
  readonly totalRequests: number;
  readonly totalEvents: number;
  readonly eventsByType: Record<DebugEventType, number>;
  readonly averageDuration: number;
  readonly errorCount: number;
  readonly warningCount: number;
}
