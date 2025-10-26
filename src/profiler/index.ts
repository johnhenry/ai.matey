/**
 * Performance profiler - measure timing and memory usage
 */

export type {
  PerformanceMeasurement,
  PerformanceProfile,
  ProfilerConfig,
  BenchmarkResult,
  BenchmarkSuite,
} from './types.js';

export {
  Profiler,
  profiler,
  DEFAULT_PROFILER_CONFIG,
  benchmark,
  createBenchmarkSuite,
} from './profiler.js';

export { createProfilerMiddleware } from './middleware.js';
