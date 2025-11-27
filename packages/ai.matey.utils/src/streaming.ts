/**
 * Streaming Utilities
 *
 * Helper functions for working with IR streams.
 *
 * @module
 */

import type {
  IRChatStream,
  IRStreamChunk,
  StreamContentChunk,
  StreamDoneChunk,
  StreamErrorChunk,
  IRMessage,
  IRChatResponse,
  IRMetadata,
  IRUsage,
  FinishReason,
} from 'ai.matey.types';

// ============================================================================
// Stream Accumulation
// ============================================================================

/**
 * Accumulated stream state.
 */
export interface StreamAccumulator {
  content: string;
  role: 'assistant';
  sequence: number;
  metadata?: Partial<IRMetadata>;
}

/**
 * Create a new stream accumulator.
 *
 * @returns Empty accumulator
 */
export function createStreamAccumulator(): StreamAccumulator {
  return {
    content: '',
    role: 'assistant',
    sequence: 0,
  };
}

/**
 * Accumulate a stream chunk.
 *
 * @param accumulator Current accumulator state
 * @param chunk Stream chunk to accumulate
 * @returns Updated accumulator
 */
export function accumulateChunk(
  accumulator: StreamAccumulator,
  chunk: IRStreamChunk
): StreamAccumulator {
  const updated = { ...accumulator, sequence: chunk.sequence };

  switch (chunk.type) {
    case 'content':
      updated.content += chunk.delta;
      break;

    case 'metadata':
      updated.metadata = {
        ...updated.metadata,
        ...chunk.metadata,
      };
      break;

    default:
      // Other chunk types don't affect accumulation
      break;
  }

  return updated;
}

/**
 * Convert accumulated state to IR message.
 *
 * @param accumulator Stream accumulator
 * @returns IR message
 */
export function accumulatorToMessage(accumulator: StreamAccumulator): IRMessage {
  return {
    role: accumulator.role,
    content: accumulator.content,
  };
}

/**
 * Convert accumulated state and done chunk to IR response.
 *
 * @param accumulator Stream accumulator
 * @param doneChunk Done chunk with finish reason and usage
 * @param requestMetadata Original request metadata
 * @returns IR chat response
 */
export function accumulatorToResponse(
  accumulator: StreamAccumulator,
  doneChunk: StreamDoneChunk,
  requestMetadata: IRMetadata
): IRChatResponse {
  return {
    message: accumulatorToMessage(accumulator),
    finishReason: doneChunk.finishReason,
    usage: doneChunk.usage,
    metadata: {
      ...requestMetadata,
      ...accumulator.metadata,
    },
  };
}

// ============================================================================
// Stream Transformation
// ============================================================================

/**
 * Transform stream chunks.
 *
 * @param stream Original stream
 * @param transformer Transform function
 * @returns Transformed stream
 */
export async function* transformStream(
  stream: IRChatStream,
  transformer: (chunk: IRStreamChunk) => IRStreamChunk | null
): IRChatStream {
  for await (const chunk of stream) {
    const transformed = transformer(chunk);
    if (transformed !== null) {
      yield transformed;
    }
  }
}

/**
 * Filter stream chunks.
 *
 * @param stream Original stream
 * @param predicate Filter predicate
 * @returns Filtered stream
 */
export async function* filterStream(
  stream: IRChatStream,
  predicate: (chunk: IRStreamChunk) => boolean
): IRChatStream {
  for await (const chunk of stream) {
    if (predicate(chunk)) {
      yield chunk;
    }
  }
}

/**
 * Map stream chunks.
 *
 * @param stream Original stream
 * @param mapper Mapping function
 * @returns Mapped stream
 */
export async function* mapStream<T>(
  stream: IRChatStream,
  mapper: (chunk: IRStreamChunk) => T
): AsyncGenerator<T, void, undefined> {
  for await (const chunk of stream) {
    yield mapper(chunk);
  }
}

/**
 * Tap into stream without modifying it.
 *
 * @param stream Original stream
 * @param callback Function to call for each chunk
 * @returns Same stream
 */
export async function* tapStream(
  stream: IRChatStream,
  callback: (chunk: IRStreamChunk) => void | Promise<void>
): IRChatStream {
  for await (const chunk of stream) {
    await callback(chunk);
    yield chunk;
  }
}

// ============================================================================
// Stream Collection
// ============================================================================

/**
 * Collect all chunks from a stream.
 *
 * @param stream Stream to collect
 * @returns Array of all chunks
 */
export async function collectStream(stream: IRChatStream): Promise<IRStreamChunk[]> {
  const chunks: IRStreamChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

/**
 * Collect stream into a complete response.
 *
 * @param stream Stream to collect
 * @param requestMetadata Original request metadata
 * @returns Complete IR response
 */
export async function streamToResponse(
  stream: IRChatStream,
  requestMetadata: IRMetadata
): Promise<IRChatResponse> {
  let accumulator = createStreamAccumulator();
  let doneChunk: StreamDoneChunk | undefined;

  for await (const chunk of stream) {
    if (chunk.type === 'done') {
      doneChunk = chunk;
    } else {
      accumulator = accumulateChunk(accumulator, chunk);
    }
  }

  if (!doneChunk) {
    // Stream ended without done chunk - create default
    doneChunk = {
      type: 'done',
      sequence: accumulator.sequence + 1,
      finishReason: 'stop',
    };
  }

  return accumulatorToResponse(accumulator, doneChunk, requestMetadata);
}

/**
 * Collect just the content text from a stream.
 *
 * @param stream Stream to collect
 * @returns Complete text content
 */
export async function streamToText(stream: IRChatStream): Promise<string> {
  let text = '';
  for await (const chunk of stream) {
    if (chunk.type === 'content') {
      text += chunk.delta;
    }
  }
  return text;
}

// ============================================================================
// Stream Splitting/Merging
// ============================================================================

/**
 * Split a stream into multiple consumers.
 *
 * @param stream Original stream
 * @param consumerCount Number of consumers
 * @returns Array of streams, one per consumer
 */
export function splitStream(stream: IRChatStream, consumerCount: number): IRChatStream[] {
  const chunks: IRStreamChunk[] = [];
  const consumers: Array<{
    resolve: (chunk: IteratorResult<IRStreamChunk>) => void;
    queue: IRStreamChunk[];
  }> = Array.from({ length: consumerCount }, () => ({
    resolve: () => {},
    queue: [],
  }));

  let streamDone = false;
  let activeConsumers = consumerCount;

  // Start consuming the source stream
  (async () => {
    try {
      for await (const chunk of stream) {
        chunks.push(chunk);
        // Distribute to all consumers
        for (const consumer of consumers) {
          consumer.queue.push(chunk);
          if (consumer.resolve) {
            const resolver = consumer.resolve;
            consumer.resolve = () => {};
            resolver({ value: consumer.queue.shift()!, done: false });
          }
        }
      }
    } finally {
      streamDone = true;
      // Signal completion to all consumers
      for (const consumer of consumers) {
        if (consumer.resolve) {
          consumer.resolve({ value: undefined, done: true });
        }
      }
    }
  })();

  // Create consumer streams
  return consumers.map((consumer) => {
    return (async function* () {
      while (activeConsumers > 0) {
        if (consumer.queue.length > 0) {
          yield consumer.queue.shift()!;
        } else if (streamDone) {
          break;
        } else {
          // Wait for next chunk
          await new Promise<void>((resolve) => {
            consumer.resolve = (result) => {
              if (!result.done && result.value) {
                consumer.queue.push(result.value);
              }
              resolve();
            };
          });
        }
      }
    })();
  });
}

// ============================================================================
// Stream Error Handling
// ============================================================================

/**
 * Wrap stream with error handling.
 *
 * @param stream Original stream
 * @param onError Error handler
 * @returns Wrapped stream
 */
export async function* catchStreamErrors(
  stream: IRChatStream,
  onError: (error: Error) => IRStreamChunk | null
): IRChatStream {
  try {
    for await (const chunk of stream) {
      yield chunk;
    }
  } catch (error) {
    const errorChunk = onError(error as Error);
    if (errorChunk) {
      yield errorChunk;
    }
  }
}

/**
 * Add timeout to stream.
 *
 * @param stream Original stream
 * @param timeoutMs Timeout in milliseconds
 * @param onTimeout Callback when timeout occurs
 * @returns Stream with timeout
 */
export async function* streamWithTimeout(
  stream: IRChatStream,
  timeoutMs: number,
  onTimeout: () => IRStreamChunk
): IRChatStream {
  const iterator = stream[Symbol.asyncIterator]();
  let timeoutId: NodeJS.Timeout | number | undefined;

  try {
    while (true) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Stream timeout')), timeoutMs);
      });

      const result = await Promise.race([iterator.next(), timeoutPromise]);

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      if (result.done) {
        break;
      }

      yield result.value;
    }
  } catch (error) {
    if ((error as Error).message === 'Stream timeout') {
      yield onTimeout();
    } else {
      throw error;
    }
  }
}

// ============================================================================
// Stream Utilities
// ============================================================================

/**
 * Check if a chunk is a content chunk.
 */
export function isContentChunk(chunk: IRStreamChunk): chunk is StreamContentChunk {
  return chunk.type === 'content';
}

/**
 * Check if a chunk is a done chunk.
 */
export function isDoneChunk(chunk: IRStreamChunk): chunk is StreamDoneChunk {
  return chunk.type === 'done';
}

/**
 * Check if a chunk is an error chunk.
 */
export function isErrorChunk(chunk: IRStreamChunk): chunk is StreamErrorChunk {
  return chunk.type === 'error';
}

/**
 * Get content deltas from stream.
 *
 * @param stream Stream to process
 * @returns Stream of just content deltas
 */
export async function* getContentDeltas(stream: IRChatStream): AsyncGenerator<string, void, undefined> {
  for await (const chunk of stream) {
    if (chunk.type === 'content') {
      yield chunk.delta;
    }
  }
}

/**
 * Convert an IR stream to a simple text iterator.
 * Yields content deltas as strings and throws on errors.
 *
 * @example
 * ```typescript
 * for await (const text of streamToTextIterator(stream)) {
 *   process.stdout.write(text);
 * }
 * ```
 */
export async function* streamToTextIterator(
  stream: IRChatStream
): AsyncGenerator<string, void, undefined> {
  for await (const chunk of stream) {
    if (chunk.type === 'content') {
      yield chunk.delta;
    } else if (chunk.type === 'error') {
      throw new Error(chunk.error.message);
    }
  }
}

// ============================================================================
// Stream Validation
// ============================================================================

/**
 * Validate chunk sequence numbers.
 *
 * Detects gaps or out-of-order chunks in a stream.
 *
 * @param chunks Array of chunks to validate
 * @returns Validation result
 */
export interface SequenceValidationResult {
  valid: boolean;
  gaps: number[];
  duplicates: number[];
  outOfOrder: boolean;
  expectedNext: number;
}

export function validateChunkSequence(chunks: IRStreamChunk[]): SequenceValidationResult {
  const sequences = chunks.map(c => c.sequence).filter((s): s is number => s !== undefined);
  const gaps: number[] = [];
  const duplicates: number[] = [];
  let outOfOrder = false;

  const seen = new Set<number>();
  let expectedSequence = 0;

  for (let i = 0; i < sequences.length; i++) {
    const seq = sequences[i];
    if (seq === undefined) continue;

    // Check for duplicates
    if (seen.has(seq)) {
      duplicates.push(seq);
    }
    seen.add(seq);

    // Check for out-of-order
    if (seq < expectedSequence) {
      outOfOrder = true;
    }

    // Check for gaps
    if (seq > expectedSequence) {
      for (let missing = expectedSequence; missing < seq; missing++) {
        if (!seen.has(missing)) {
          gaps.push(missing);
        }
      }
    }

    expectedSequence = Math.max(expectedSequence, seq + 1);
  }

  return {
    valid: gaps.length === 0 && duplicates.length === 0 && !outOfOrder,
    gaps,
    duplicates,
    outOfOrder,
    expectedNext: expectedSequence,
  };
}

/**
 * Create a validating stream wrapper.
 *
 * Validates chunk sequences and throws errors on invalid streams.
 *
 * @param stream Original stream
 * @param options Validation options
 * @returns Validated stream
 */
export interface StreamValidationOptions {
  /**
   * Throw error on sequence gaps.
   * @default true
   */
  strictSequence?: boolean;

  /**
   * Throw error on duplicate sequences.
   * @default true
   */
  rejectDuplicates?: boolean;

  /**
   * Maximum allowed gap before error.
   * @default 0
   */
  maxGap?: number;

  /**
   * Callback for validation warnings.
   */
  onWarning?: (message: string) => void;
}

export async function* validateStream(
  stream: IRChatStream,
  options: StreamValidationOptions = {}
): IRChatStream {
  const {
    strictSequence = true,
    rejectDuplicates = true,
    maxGap = 0,
    onWarning,
  } = options;

  let expectedSequence = 0;
  const seen = new Set<number>();

  for await (const chunk of stream) {
    const seq = chunk.sequence;
    if (seq === undefined) {
      yield chunk;
      continue;
    }

    // Check for duplicates
    if (seen.has(seq)) {
      const message = `Duplicate sequence number: ${seq}`;
      if (rejectDuplicates) {
        throw new Error(message);
      } else if (onWarning) {
        onWarning(message);
      }
    }
    seen.add(seq);

    // Check for gaps
    const gap = seq - expectedSequence;
    if (gap > maxGap) {
      const message = `Sequence gap detected: expected ${expectedSequence}, got ${seq} (gap: ${gap})`;
      if (strictSequence) {
        throw new Error(message);
      } else if (onWarning) {
        onWarning(message);
      }
    }

    // Check for out-of-order
    if (seq < expectedSequence) {
      const message = `Out-of-order chunk: sequence ${seq} after ${expectedSequence}`;
      if (strictSequence) {
        throw new Error(message);
      } else if (onWarning) {
        onWarning(message);
      }
    }

    expectedSequence = Math.max(expectedSequence, seq + 1);
    yield chunk;
  }
}

/**
 * Assemble stream chunks into a complete message.
 *
 * Alternative to streamToResponse that returns just the assembled message.
 *
 * @param stream Stream to assemble
 * @returns Assembled message text
 */
export async function assembleStreamChunks(stream: IRChatStream): Promise<string> {
  return streamToText(stream);
}

/**
 * Create an error chunk.
 *
 * Helper for creating properly formatted error chunks.
 *
 * @param code Error code
 * @param message Error message
 * @param sequence Sequence number
 * @param details Optional error details
 * @returns Error chunk
 */
export function createStreamError(
  code: string,
  message: string,
  sequence: number,
  details?: Record<string, unknown>
): StreamErrorChunk {
  return {
    type: 'error',
    sequence,
    error: {
      code,
      message,
      details,
    },
  };
}

// ============================================================================
// Backpressure Handling
// ============================================================================

/**
 * Add backpressure control to stream.
 *
 * Buffers chunks and allows consumer to control flow.
 *
 * @param stream Original stream
 * @param bufferSize Maximum buffer size before pausing
 * @returns Stream with backpressure control
 */
export async function* streamWithBackpressure(
  stream: IRChatStream,
  bufferSize: number = 10
): IRChatStream {
  const buffer: IRStreamChunk[] = [];
  let sourceComplete = false;
  let sourceError: Error | null = null;

  // Start consuming source stream in background
  (async () => {
    try {
      for await (const chunk of stream) {
        // Wait if buffer is full
        while (buffer.length >= bufferSize) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        buffer.push(chunk);
      }
    } catch (error) {
      sourceError = error as Error;
    } finally {
      sourceComplete = true;
    }
  })();

  // Yield chunks with backpressure
  while (!sourceComplete || buffer.length > 0 || sourceError) {
    if (sourceError) {
      throw sourceError;
    }

    if (buffer.length > 0) {
      yield buffer.shift()!;
    } else if (!sourceComplete) {
      // Wait for more chunks
      await new Promise(resolve => setTimeout(resolve, 10));
    } else {
      break;
    }
  }
}

/**
 * Rate limit stream chunks.
 *
 * Ensures chunks are yielded at a maximum rate.
 *
 * @param stream Original stream
 * @param chunksPerSecond Maximum chunks per second
 * @returns Rate-limited stream
 */
export async function* rateLimitStream(
  stream: IRChatStream,
  chunksPerSecond: number
): IRChatStream {
  const delayMs = 1000 / chunksPerSecond;
  let lastYieldTime = 0;

  for await (const chunk of stream) {
    const now = Date.now();
    const timeSinceLastYield = now - lastYieldTime;

    if (timeSinceLastYield < delayMs) {
      await new Promise(resolve => setTimeout(resolve, delayMs - timeSinceLastYield));
    }

    lastYieldTime = Date.now();
    yield chunk;
  }
}

// ============================================================================
// High-Level Stream Utilities
// ============================================================================

/**
 * Rich result from collecting a stream.
 * Provides content, message, all chunks, and metadata.
 */
export interface CollectedStream {
  /**
   * Full accumulated text content.
   */
  readonly content: string;

  /**
   * The final message.
   */
  readonly message: IRMessage;

  /**
   * All chunks received.
   */
  readonly chunks: readonly IRStreamChunk[];

  /**
   * Finish reason from done chunk.
   */
  readonly finishReason: FinishReason;

  /**
   * Token usage if provided.
   */
  readonly usage?: IRUsage;

  /**
   * Request ID from start chunk.
   */
  readonly requestId?: string;
}

/**
 * Collect a stream into a rich result with content, message, and metadata.
 *
 * @example
 * ```typescript
 * const stream = backend.executeStream(request);
 * const result = await collectStreamFull(stream);
 * console.log(result.content);
 * console.log('Tokens:', result.usage?.totalTokens);
 * ```
 */
export async function collectStreamFull(stream: IRChatStream): Promise<CollectedStream> {
  const chunks: IRStreamChunk[] = [];
  let content = '';
  let requestId: string | undefined;
  let usage: IRUsage | undefined;
  let finishReason: FinishReason = 'stop';
  let message: IRMessage | undefined;

  for await (const chunk of stream) {
    chunks.push(chunk);

    switch (chunk.type) {
      case 'start':
        requestId = chunk.metadata?.requestId;
        break;

      case 'content':
        content += chunk.delta;
        break;

      case 'done':
        finishReason = chunk.finishReason;
        usage = chunk.usage;
        message = chunk.message;
        break;

      case 'error':
        throw new Error(chunk.error.message);
    }
  }

  return {
    content,
    message: message ?? { role: 'assistant', content },
    chunks,
    finishReason,
    usage,
    requestId,
  };
}

/**
 * Options for processing a stream with callbacks.
 */
export interface ProcessStreamOptions {
  /**
   * Called for each content chunk.
   */
  readonly onContent?: (delta: string, accumulated: string) => void;

  /**
   * Called when stream starts.
   */
  readonly onStart?: (requestId: string) => void;

  /**
   * Called when stream ends.
   */
  readonly onDone?: (result: CollectedStream) => void;

  /**
   * Called on error.
   */
  readonly onError?: (error: Error) => void;
}

/**
 * Process a stream with callbacks while also returning the collected result.
 *
 * @example
 * ```typescript
 * const result = await processStream(stream, {
 *   onContent: (delta) => process.stdout.write(delta),
 *   onDone: () => console.log('\nDone!'),
 * });
 * ```
 */
export async function processStream(
  stream: IRChatStream,
  options: ProcessStreamOptions = {}
): Promise<CollectedStream> {
  const chunks: IRStreamChunk[] = [];
  let content = '';
  let requestId: string | undefined;
  let usage: IRUsage | undefined;
  let finishReason: FinishReason = 'stop';
  let message: IRMessage | undefined;

  try {
    for await (const chunk of stream) {
      chunks.push(chunk);

      switch (chunk.type) {
        case 'start':
          requestId = chunk.metadata?.requestId;
          options.onStart?.(requestId ?? '');
          break;

        case 'content':
          content += chunk.delta;
          options.onContent?.(chunk.delta, content);
          break;

        case 'done':
          finishReason = chunk.finishReason;
          usage = chunk.usage;
          message = chunk.message;
          break;

        case 'error':
          const error = new Error(chunk.error.message);
          options.onError?.(error);
          throw error;
      }
    }

    const result: CollectedStream = {
      content,
      message: message ?? { role: 'assistant', content },
      chunks,
      finishReason,
      usage,
      requestId,
    };

    options.onDone?.(result);
    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    options.onError?.(err);
    throw err;
  }
}

/**
 * Convert an IR stream to a line-by-line iterator.
 * Buffers content and yields complete lines.
 *
 * @example
 * ```typescript
 * for await (const line of streamToLines(stream)) {
 *   console.log('Line:', line);
 * }
 * ```
 */
export async function* streamToLines(
  stream: IRChatStream
): AsyncGenerator<string, void, undefined> {
  let buffer = '';

  for await (const chunk of stream) {
    if (chunk.type === 'content') {
      buffer += chunk.delta;

      // Yield complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        yield line;
      }
    } else if (chunk.type === 'error') {
      throw new Error(chunk.error.message);
    }
  }

  // Yield remaining buffer if not empty
  if (buffer) {
    yield buffer;
  }
}

/**
 * Create a throttled version of a stream that limits how often chunks are yielded.
 * Batches content chunks that arrive faster than the interval.
 * Unlike rateLimitStream, this merges content chunks rather than delaying them.
 *
 * @param stream - The source stream
 * @param intervalMs - Minimum milliseconds between yields
 *
 * @example
 * ```typescript
 * // Update UI at most every 50ms
 * for await (const chunk of throttleStream(stream, 50)) {
 *   updateUI(chunk);
 * }
 * ```
 */
export async function* throttleStream(
  stream: IRChatStream,
  intervalMs: number
): IRChatStream {
  let lastYield = 0;
  let pendingChunk: IRStreamChunk | null = null;

  for await (const chunk of stream) {
    const now = Date.now();

    // Always yield start, done, and error chunks immediately
    if (chunk.type !== 'content') {
      if (pendingChunk) {
        yield pendingChunk;
        pendingChunk = null;
      }
      yield chunk;
      lastYield = now;
      continue;
    }

    // For content chunks, throttle
    if (now - lastYield >= intervalMs) {
      if (pendingChunk && pendingChunk.type === 'content') {
        // Merge pending with current
        const merged: IRStreamChunk = {
          type: 'content',
          sequence: chunk.sequence,
          delta: pendingChunk.delta + chunk.delta,
          accumulated: chunk.accumulated,
        };
        yield merged;
        pendingChunk = null;
      } else {
        yield chunk;
      }
      lastYield = now;
    } else {
      // Accumulate into pending
      if (pendingChunk && pendingChunk.type === 'content') {
        pendingChunk = {
          type: 'content',
          sequence: chunk.sequence,
          delta: pendingChunk.delta + chunk.delta,
          accumulated: chunk.accumulated,
        };
      } else {
        pendingChunk = chunk;
      }
    }
  }

  // Yield any remaining pending chunk
  if (pendingChunk) {
    yield pendingChunk;
  }
}

/**
 * Split a stream into multiple streams that can be consumed independently.
 * Each returned stream receives all chunks from the source.
 * Alias for splitStream with a simpler interface.
 *
 * @param stream - The source stream
 * @param count - Number of streams to create
 *
 * @example
 * ```typescript
 * const [stream1, stream2] = teeStream(originalStream, 2);
 *
 * // Consume independently
 * const [result1, result2] = await Promise.all([
 *   collectStreamFull(stream1),
 *   processStream(stream2, { onContent: console.log }),
 * ]);
 * ```
 */
export function teeStream(
  stream: IRChatStream,
  count: number = 2
): IRChatStream[] {
  const queues: IRStreamChunk[][] = Array.from({ length: count }, () => []);
  const resolvers: Array<(() => void) | null> = Array(count).fill(null);
  let done = false;
  let error: Error | null = null;

  // Start consuming the source stream
  (async () => {
    try {
      for await (const chunk of stream) {
        for (let i = 0; i < count; i++) {
          const queue = queues[i];
          if (queue) {
            queue.push(chunk);
          }
          resolvers[i]?.();
        }
      }
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
    } finally {
      done = true;
      for (const resolve of resolvers) {
        resolve?.();
      }
    }
  })();

  // Create output generators
  return queues.map((queue, index): IRChatStream => {
    return (async function* (): IRChatStream {
      let cursor = 0;

      while (true) {
        // Yield any queued chunks
        while (cursor < queue.length) {
          const chunk = queue[cursor++];
          if (chunk) {
            yield chunk;
          }
        }

        // Check if done
        if (done) {
          if (error) throw error;
          return;
        }

        // Wait for more chunks
        await new Promise<void>((resolve) => {
          resolvers[index] = resolve;
        });
        resolvers[index] = null;
      }
    })();
  });
}
