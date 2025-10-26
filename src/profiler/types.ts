/**
 * Performance profiler types
 */

/**
 * Performance measurement
 */
export interface PerformanceMeasurement {
  readonly name: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly duration: number;
  readonly memory?: {
    readonly heapUsed: number;
    readonly heapTotal: number;
    readonly external: number;
  };
  readonly metadata?: Record<string, unknown>;
}

/**
 * Performance profile - collection of measurements
 */
export interface PerformanceProfile {
  readonly id: string;
  readonly measurements: readonly PerformanceMeasurement[];
  readonly totalDuration: number;
  readonly peakMemory?: number;
  readonly startTime: number;
  readonly endTime: number;
}

/**
 * Profiler configuration
 */
export interface ProfilerConfig {
  /** Enable profiling */
  readonly enabled: boolean;

  /** Collect memory statistics */
  readonly collectMemory: boolean;

  /** Sample interval for memory profiling (ms) */
  readonly memorySampleInterval?: number;

  /** Maximum number of profiles to keep */
  readonly maxProfiles?: number;

  /** Custom event handler */
  readonly onMeasurement?: (measurement: PerformanceMeasurement) => void;
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  readonly name: string;
  readonly runs: number;
  readonly totalDuration: number;
  readonly averageDuration: number;
  readonly minDuration: number;
  readonly maxDuration: number;
  readonly medianDuration: number;
  readonly standardDeviation: number;
  readonly throughput: number; // operations per second
  readonly memory?: {
    readonly average: number;
    readonly peak: number;
  };
}

/**
 * Benchmark suite
 */
export interface BenchmarkSuite {
  readonly name: string;
  readonly results: readonly BenchmarkResult[];
  readonly timestamp: number;
  readonly environment: {
    readonly platform: string;
    readonly nodeVersion: string;
    readonly cpuModel?: string;
    readonly totalMemory?: number;
  };
}
