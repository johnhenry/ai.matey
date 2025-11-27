/**
 * Stream Utilities
 *
 * Helper functions for working with IR streams.
 *
 * @module
 */

import type {
  IRChatStream,
  IRStreamChunk,
  IRMessage,
  IRUsage,
  FinishReason,
} from 'ai.matey.types';

// ============================================================================
// Stream Collection
// ============================================================================

/**
 * Result of collecting a stream.
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
 * Collect a stream into a single result.
 *
 * @example
 * ```typescript
 * const stream = backend.executeStream(request);
 * const result = await collectStream(stream);
 * console.log(result.content);
 * ```
 */
export async function collectStream(stream: IRChatStream): Promise<CollectedStream> {
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
        requestId = chunk.metadata.requestId;
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

// ============================================================================
// Stream Transformation
// ============================================================================

/**
 * Options for transforming a stream.
 */
export interface TransformStreamOptions {
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
  options: TransformStreamOptions = {}
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
          requestId = chunk.metadata.requestId;
          options.onStart?.(requestId);
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

// ============================================================================
// Stream to Text Iterator
// ============================================================================

/**
 * Convert an IR stream to a simple text iterator.
 *
 * @example
 * ```typescript
 * for await (const text of streamToText(stream)) {
 *   process.stdout.write(text);
 * }
 * ```
 */
export async function* streamToText(
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
// Stream to Lines
// ============================================================================

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

// ============================================================================
// Throttled Stream
// ============================================================================

/**
 * Create a throttled version of a stream that limits how often chunks are yielded.
 * Useful for rate-limiting UI updates.
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
): AsyncGenerator<IRStreamChunk, void, undefined> {
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
      if (pendingChunk) {
        // Merge pending with current
        const merged: IRStreamChunk = {
          ...chunk,
          delta: (pendingChunk as { delta: string }).delta + chunk.delta,
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
          ...chunk,
          delta: pendingChunk.delta + chunk.delta,
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

// ============================================================================
// Stream Tee
// ============================================================================

/**
 * Split a stream into multiple streams that can be consumed independently.
 * Each returned stream receives all chunks from the source.
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
 *   collectStream(stream1),
 *   processStream(stream2, { onContent: console.log }),
 * ]);
 * ```
 */
export function teeStream(
  stream: IRChatStream,
  count: number = 2
): AsyncGenerator<IRStreamChunk, void, undefined>[] {
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
  return queues.map((queue, index): AsyncGenerator<IRStreamChunk, void, undefined> => {
    return (async function* (): AsyncGenerator<IRStreamChunk, void, undefined> {
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
