/**
 * Streaming Configuration Types
 *
 * Defines how streaming responses should be delivered across the system.
 * Supports flexible streaming modes with delta (incremental) and accumulated (full text) formats.
 *
 * @module
 */

/**
 * Streaming mode determines how chunks are delivered.
 *
 * - `delta`: Stream only new content chunks (standard behavior, most efficient)
 *   - Each chunk contains only the incremental text that was just generated
 *   - Consumers must accumulate chunks to get full text
 *   - Example: chunk1="Hello", chunk2=" world", chunk3="!"
 *
 * - `accumulated`: Stream full accumulated content so far (Chrome AI behavior)
 *   - Each chunk contains all text generated up to that point
 *   - Consumers can use the latest chunk directly without accumulation
 *   - Example: chunk1="Hello", chunk2="Hello world", chunk3="Hello world!"
 */
export type StreamMode = 'delta' | 'accumulated';

/**
 * Buffer strategy for accumulated mode.
 */
export type BufferStrategy = 'memory' | 'none';

/**
 * Streaming configuration options.
 */
export interface StreamingConfig {
  /**
   * How to deliver streaming chunks.
   *
   * - `delta`: Only new content (default, most efficient)
   * - `accumulated`: Full content accumulated so far (Chrome AI style)
   *
   * @default 'delta'
   */
  mode?: StreamMode;

  /**
   * Whether to include both delta and accumulated in chunks.
   * Only applicable when mode='accumulated' at backend level.
   * When true, chunks will contain both formats for maximum flexibility.
   *
   * @default false
   */
  includeBoth?: boolean;

  /**
   * Buffer strategy for accumulated mode.
   *
   * - 'memory': Keep full buffer in memory (default, works with any provider)
   * - 'none': Don't buffer (only works if provider natively gives accumulated)
   *
   * @default 'memory'
   */
  bufferStrategy?: BufferStrategy;
}

/**
 * Options for stream conversion/transformation.
 */
export interface StreamConversionOptions {
  /**
   * Target streaming mode for conversion.
   * If specified, stream will be converted to this mode.
   */
  mode?: StreamMode;

  /**
   * Whether to preserve original format if already in target mode.
   * When true, avoids unnecessary conversion overhead.
   *
   * @default true
   */
  preserveIfMatch?: boolean;

  /**
   * Custom buffer transform function.
   * Applied to accumulated text before yielding.
   * Useful for sanitization, formatting, etc.
   */
  transform?: (text: string) => string;

  /**
   * Whether to validate chunk sequence numbers.
   * When true, throws error if chunks arrive out of order.
   *
   * @default false
   */
  validateSequence?: boolean;
}

/**
 * Default streaming configuration.
 */
export const DEFAULT_STREAMING_CONFIG: Required<StreamingConfig> = {
  mode: 'delta',
  includeBoth: false,
  bufferStrategy: 'memory',
};

/**
 * Default conversion options.
 */
export const DEFAULT_CONVERSION_OPTIONS: Required<Omit<StreamConversionOptions, 'transform'>> = {
  mode: 'delta',
  preserveIfMatch: true,
  validateSequence: false,
};
