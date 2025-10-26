/**
 * Debug logger - collects and emits debug events
 */

import type {
  DebugConfig,
  DebugEvent,
  DebugEventType,
  DebugLevel,
  PipelineTrace,
  TraceStep,
  DebugStats,
} from './types.js';

/**
 * Debug levels in order of severity
 */
const DEBUG_LEVELS: Record<DebugLevel, number> = {
  off: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

/**
 * Default debug configuration
 */
export const DEFAULT_DEBUG_CONFIG: DebugConfig = {
  enabled: false,
  level: 'info',
  console: true,
  collect: false,
  maxEvents: 1000,
  pretty: true,
  stackTraces: true,
};

/**
 * Debug logger
 */
export class DebugLogger {
  private config: DebugConfig;
  private events: DebugEvent[] = [];
  private traces: Map<string, PipelineTrace> = new Map();
  private stats = {
    totalRequests: 0,
    totalEvents: 0,
    eventsByType: {} as Record<DebugEventType, number>,
    averageDuration: 0,
    errorCount: 0,
    warningCount: 0,
  };

  constructor(config: Partial<DebugConfig> = {}) {
    this.config = { ...DEFAULT_DEBUG_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  configure(config: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): DebugConfig {
    return this.config;
  }

  /**
   * Check if logging is enabled for a level
   */
  isEnabled(level: DebugLevel): boolean {
    if (!this.config.enabled) return false;
    return DEBUG_LEVELS[level] <= DEBUG_LEVELS[this.config.level];
  }

  /**
   * Log a debug event
   */
  log(
    type: DebugEventType,
    message: string,
    level: DebugLevel = 'info',
    data?: unknown
  ): void {
    if (!this.isEnabled(level)) return;

    // Filter by type if configured
    if (this.config.filterTypes && !this.config.filterTypes.includes(type)) {
      return;
    }

    const event: DebugEvent = {
      type,
      timestamp: Date.now(),
      level,
      message,
      data,
    };

    // Collect event
    if (this.config.collect) {
      this.collectEvent(event);
    }

    // Log to console
    if (this.config.console) {
      this.logToConsole(event);
    }

    // Call custom handler
    if (this.config.onEvent) {
      this.config.onEvent(event);
    }

    // Update stats
    this.updateStats(event);
  }

  /**
   * Log error
   */
  error(message: string, error?: Error, data?: unknown): void {
    const event: DebugEvent = {
      type: 'error',
      timestamp: Date.now(),
      level: 'error',
      message,
      error,
      data,
    };

    if (this.config.collect) {
      this.collectEvent(event);
    }

    if (this.config.console) {
      this.logToConsole(event);
    }

    if (this.config.onEvent) {
      this.config.onEvent(event);
    }

    this.updateStats(event);
  }

  /**
   * Log warning
   */
  warn(message: string, data?: unknown): void {
    this.log('warning', message, 'warn', data);
  }

  /**
   * Log info
   */
  info(message: string, data?: unknown): void {
    this.log('pipeline_start', message, 'info', data);
  }

  /**
   * Log debug
   */
  debug(message: string, data?: unknown): void {
    this.log('pipeline_start', message, 'debug', data);
  }

  /**
   * Log trace
   */
  trace(message: string, data?: unknown): void {
    this.log('pipeline_start', message, 'trace', data);
  }

  /**
   * Start a new pipeline trace
   */
  startTrace(requestId: string): void {
    const trace: PipelineTrace = {
      requestId,
      startTime: Date.now(),
      events: [],
      steps: [],
    };

    this.traces.set(requestId, trace);
    this.stats.totalRequests++;

    this.log('pipeline_start', `Pipeline started: ${requestId}`, 'debug', {
      requestId,
    });
  }

  /**
   * End a pipeline trace
   */
  endTrace(requestId: string, error?: Error): PipelineTrace | undefined {
    const trace = this.traces.get(requestId);
    if (!trace) return undefined;

    const endTime = Date.now();
    const duration = endTime - trace.startTime;

    const completedTrace: PipelineTrace = {
      ...trace,
      endTime,
      duration,
      error,
    };

    this.traces.set(requestId, completedTrace);

    this.log('pipeline_end', `Pipeline completed: ${requestId}`, 'debug', {
      requestId,
      duration,
      error: error?.message,
    });

    return completedTrace;
  }

  /**
   * Add a step to a trace
   */
  addTraceStep(requestId: string, step: TraceStep): void {
    const trace = this.traces.get(requestId);
    if (!trace) return;

    const updatedTrace: PipelineTrace = {
      ...trace,
      steps: [...trace.steps, step],
    };

    this.traces.set(requestId, updatedTrace);
  }

  /**
   * Get a trace
   */
  getTrace(requestId: string): PipelineTrace | undefined {
    return this.traces.get(requestId);
  }

  /**
   * Get all traces
   */
  getAllTraces(): readonly PipelineTrace[] {
    return Array.from(this.traces.values());
  }

  /**
   * Get collected events
   */
  getEvents(): readonly DebugEvent[] {
    return this.events;
  }

  /**
   * Get statistics
   */
  getStats(): DebugStats {
    return this.stats;
  }

  /**
   * Clear all collected data
   */
  clear(): void {
    this.events = [];
    this.traces.clear();
    this.stats = {
      totalRequests: 0,
      totalEvents: 0,
      eventsByType: {} as Record<DebugEventType, number>,
      averageDuration: 0,
      errorCount: 0,
      warningCount: 0,
    };
  }

  /**
   * Collect an event
   */
  private collectEvent(event: DebugEvent): void {
    this.events.push(event);

    // Trim if max exceeded
    if (this.config.maxEvents && this.events.length > this.config.maxEvents) {
      this.events.shift();
    }
  }

  /**
   * Log to console
   */
  private logToConsole(event: DebugEvent): void {
    const timestamp = new Date(event.timestamp).toISOString();
    const prefix = `[${timestamp}] [${event.level.toUpperCase()}] [${event.type}]`;

    if (this.config.pretty) {
      // Pretty print
      const colors = {
        error: '\x1b[31m',
        warn: '\x1b[33m',
        info: '\x1b[36m',
        debug: '\x1b[90m',
        trace: '\x1b[90m',
        off: '',
      };

      const reset = '\x1b[0m';
      const color = colors[event.level];

      console.log(`${color}${prefix}${reset} ${event.message}`);

      if (event.data) {
        console.log(`${color}  Data:${reset}`, event.data);
      }

      if (event.error && this.config.stackTraces) {
        console.error(`${color}  Error:${reset}`, event.error);
      }
    } else {
      // Simple print
      console.log(`${prefix} ${event.message}`, event.data || '');

      if (event.error && this.config.stackTraces) {
        console.error('  Error:', event.error);
      }
    }
  }

  /**
   * Update statistics
   */
  private updateStats(event: DebugEvent): void {
    this.stats.totalEvents++;

    // Count by type
    if (!this.stats.eventsByType[event.type]) {
      this.stats.eventsByType[event.type] = 0;
    }
    this.stats.eventsByType[event.type]++;

    // Count errors and warnings
    if (event.level === 'error') {
      this.stats.errorCount++;
    } else if (event.level === 'warn') {
      this.stats.warningCount++;
    }

    // Update average duration
    if (event.duration !== undefined) {
      const totalDuration =
        this.stats.averageDuration * (this.stats.totalRequests - 1) +
        event.duration;
      this.stats.averageDuration = totalDuration / this.stats.totalRequests;
    }
  }
}

/**
 * Global debug logger instance
 */
export const debugLogger = new DebugLogger();
