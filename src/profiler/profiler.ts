/**
 * Performance profiler - measures timing and memory usage
 */

import type {
  PerformanceMeasurement,
  PerformanceProfile,
  ProfilerConfig,
  BenchmarkResult,
  BenchmarkSuite,
} from './types.js';

/**
 * Default profiler configuration
 */
export const DEFAULT_PROFILER_CONFIG: ProfilerConfig = {
  enabled: false,
  collectMemory: false,
  memorySampleInterval: 100,
  maxProfiles: 100,
};

/**
 * Performance profiler
 */
export class Profiler {
  private config: ProfilerConfig;
  private profiles: Map<string, PerformanceProfile> = new Map();
  private activeMeasurements: Map<string, { name: string; startTime: number }> = new Map();

  constructor(config: Partial<ProfilerConfig> = {}) {
    this.config = { ...DEFAULT_PROFILER_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  configure(config: Partial<ProfilerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Start a measurement
   */
  start(id: string, name: string): void {
    if (!this.config.enabled) return;

    this.activeMeasurements.set(id, {
      name,
      startTime: performance.now(),
    });
  }

  /**
   * End a measurement
   */
  end(id: string, metadata?: Record<string, unknown>): PerformanceMeasurement | undefined {
    if (!this.config.enabled) return undefined;

    const active = this.activeMeasurements.get(id);
    if (!active) return undefined;

    const endTime = performance.now();
    const duration = endTime - active.startTime;

    const measurement: PerformanceMeasurement = {
      name: active.name,
      startTime: active.startTime,
      endTime,
      duration,
      memory: this.config.collectMemory ? this.getMemoryUsage() : undefined,
      metadata,
    };

    this.activeMeasurements.delete(id);

    if (this.config.onMeasurement) {
      this.config.onMeasurement(measurement);
    }

    return measurement;
  }

  /**
   * Measure an async function
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<{ result: T; measurement: PerformanceMeasurement }> {
    const id = `${name}-${Date.now()}-${Math.random()}`;

    this.start(id, name);

    try {
      const result = await fn();
      const measurement = this.end(id, metadata);

      return {
        result,
        measurement: measurement!,
      };
    } catch (error) {
      this.end(id, { ...metadata, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const mem = process.memoryUsage();
      return {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
      };
    }
    return undefined;
  }

  /**
   * Create a new profile
   */
  createProfile(id: string): void {
    const profile: PerformanceProfile = {
      id,
      measurements: [],
      totalDuration: 0,
      startTime: performance.now(),
      endTime: 0,
    };

    this.profiles.set(id, profile);

    // Trim if max exceeded
    if (this.config.maxProfiles && this.profiles.size > this.config.maxProfiles) {
      const oldest = Array.from(this.profiles.keys())[0];
      if (oldest) {
        this.profiles.delete(oldest);
      }
    }
  }

  /**
   * Add measurement to profile
   */
  addMeasurementToProfile(profileId: string, measurement: PerformanceMeasurement): void {
    const profile = this.profiles.get(profileId);
    if (!profile) return;

    const measurements = [...profile.measurements, measurement];
    const totalDuration = measurements.reduce((sum, m) => sum + m.duration, 0);

    const peakMemory = this.config.collectMemory
      ? Math.max(
          profile.peakMemory || 0,
          measurement.memory?.heapUsed || 0
        )
      : undefined;

    const updatedProfile: PerformanceProfile = {
      ...profile,
      measurements,
      totalDuration,
      peakMemory,
    };

    this.profiles.set(profileId, updatedProfile);
  }

  /**
   * Complete a profile
   */
  completeProfile(profileId: string): PerformanceProfile | undefined {
    const profile = this.profiles.get(profileId);
    if (!profile) return undefined;

    const completedProfile: PerformanceProfile = {
      ...profile,
      endTime: performance.now(),
    };

    this.profiles.set(profileId, completedProfile);

    return completedProfile;
  }

  /**
   * Get a profile
   */
  getProfile(id: string): PerformanceProfile | undefined {
    return this.profiles.get(id);
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): readonly PerformanceProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Clear all profiles
   */
  clear(): void {
    this.profiles.clear();
    this.activeMeasurements.clear();
  }
}

/**
 * Run a benchmark
 */
export async function benchmark(
  name: string,
  fn: () => Promise<void>,
  options?: {
    runs?: number;
    warmup?: number;
    collectMemory?: boolean;
  }
): Promise<BenchmarkResult> {
  const runs = options?.runs ?? 100;
  const warmup = options?.warmup ?? 10;

  // Warmup runs
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  // Actual runs
  const durations: number[] = [];
  const memoryUsages: number[] = [];

  for (let i = 0; i < runs; i++) {
    const startTime = performance.now();
    const startMemory = options?.collectMemory && typeof process !== 'undefined'
      ? process.memoryUsage().heapUsed
      : 0;

    await fn();

    const endTime = performance.now();
    const endMemory = options?.collectMemory && typeof process !== 'undefined'
      ? process.memoryUsage().heapUsed
      : 0;

    durations.push(endTime - startTime);
    if (options?.collectMemory) {
      memoryUsages.push(endMemory - startMemory);
    }
  }

  // Calculate statistics
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const averageDuration = totalDuration / runs;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  // Calculate median
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const medianDuration =
    runs % 2 === 0
      ? (sortedDurations[runs / 2 - 1]! + sortedDurations[runs / 2]!) / 2
      : sortedDurations[Math.floor(runs / 2)]!;

  // Calculate standard deviation
  const variance =
    durations.reduce((sum, d) => sum + Math.pow(d - averageDuration, 2), 0) / runs;
  const standardDeviation = Math.sqrt(variance);

  // Calculate throughput (ops/sec)
  const throughput = (1000 * runs) / totalDuration;

  const result: BenchmarkResult = {
    name,
    runs,
    totalDuration,
    averageDuration,
    minDuration,
    maxDuration,
    medianDuration,
    standardDeviation,
    throughput,
    memory: options?.collectMemory
      ? {
          average: memoryUsages.reduce((sum, m) => sum + m, 0) / runs,
          peak: Math.max(...memoryUsages),
        }
      : undefined,
  };

  return result;
}

/**
 * Create a benchmark suite
 */
export async function createBenchmarkSuite(
  name: string,
  benchmarks: Array<{ name: string; fn: () => Promise<void>; options?: Parameters<typeof benchmark>[2] }>
): Promise<BenchmarkSuite> {
  const results: BenchmarkResult[] = [];

  for (const bench of benchmarks) {
    const result = await benchmark(bench.name, bench.fn, bench.options);
    results.push(result);
  }

  const suite: BenchmarkSuite = {
    name,
    results,
    timestamp: Date.now(),
    environment: {
      platform: typeof process !== 'undefined' ? process.platform : 'unknown',
      nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
    },
  };

  return suite;
}

/**
 * Global profiler instance
 */
export const profiler = new Profiler();
