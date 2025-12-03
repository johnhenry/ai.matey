/**
 * Stream Utilities
 *
 * Helper functions for working with streams in React.
 *
 * @module
 */

/**
 * Options for creating a text stream.
 */
export interface CreateTextStreamOptions {
  /** Called for each chunk */
  onChunk?: (chunk: string) => void;
  /** Called when stream completes */
  onComplete?: (fullText: string) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Abort signal */
  signal?: AbortSignal;
}

/**
 * Create a controlled text stream from a fetch response with streaming body.
 *
 * This function reads a streaming response body chunk by chunk, decodes the
 * bytes as UTF-8 text, and provides callbacks for processing each chunk as it
 * arrives. It accumulates the full text and returns it when the stream completes.
 * Supports abort signals for cancellation and error handling.
 *
 * @param response - Fetch Response object with a streaming body
 * @param options - Configuration including chunk/complete/error callbacks and abort signal
 * @returns Promise resolving to the complete accumulated text
 * @throws {Error} If response body is null or if stream reading fails
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/stream');
 * const fullText = await createTextStream(response, {
 *   onChunk: (chunk) => console.log('Received:', chunk),
 *   onComplete: (text) => console.log('Done:', text),
 *   onError: (err) => console.error('Error:', err),
 *   signal: abortController.signal
 * });
 * ```
 */
export async function createTextStream(
  response: Response,
  options: CreateTextStreamOptions = {}
): Promise<string> {
  const { onChunk, onComplete, onError, signal } = options;

  if (!response.body) {
    throw new Error('Response body is null');
  }

  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      onChunk?.(chunk);
    }

    onComplete?.(fullText);
    return fullText;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    throw err;
  }
}

/**
 * Parse Server-Sent Events (SSE) stream from a fetch response.
 *
 * This async generator reads a streaming response body conforming to the
 * Server-Sent Events specification and yields parsed event objects. It handles
 * SSE event delimiters (double newlines), parses event fields (event, data, id,
 * retry), and buffers incomplete events. Supports cancellation via abort signal.
 *
 * @param response - Fetch Response object with SSE formatted body
 * @param options - Configuration including optional abort signal
 * @yields Parsed SSE events with event type, data, id, and retry fields
 * @throws {Error} If response body is null
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/chat');
 * const abortController = new AbortController();
 *
 * for await (const event of parseSSEStream(response, {
 *   signal: abortController.signal
 * })) {
 *   console.log('Event:', event.event, 'Data:', event.data);
 *   if (event.data === '[DONE]') break;
 * }
 * ```
 */
export async function* parseSSEStream(
  response: Response,
  options: { signal?: AbortSignal } = {}
): AsyncGenerator<SSEEvent, void, unknown> {
  const { signal } = options;

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Split by double newlines (SSE event delimiter)
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const eventText of events) {
        const event = parseSSEEvent(eventText);
        if (event) {
          yield event;
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const event = parseSSEEvent(buffer);
      if (event) {
        yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * SSE Event structure.
 */
export interface SSEEvent {
  /** Event type */
  event?: string;
  /** Event data */
  data: string;
  /** Event ID */
  id?: string;
  /** Retry interval */
  retry?: number;
}

/**
 * Parse a single Server-Sent Event from text.
 *
 * This internal function parses the text of a single SSE event, extracting
 * the event type, data (supporting multi-line data), id, and retry fields
 * according to the SSE specification. Returns null if no data is present.
 *
 * @param text - Raw SSE event text
 * @returns Parsed SSE event object or null if invalid
 *
 * @example
 * ```typescript
 * const event = parseSSEEvent('event: message\ndata: hello\nid: 123\n');
 * // Returns: { event: 'message', data: 'hello', id: '123' }
 * ```
 */
function parseSSEEvent(text: string): SSEEvent | null {
  const lines = text.split('\n');
  const event: SSEEvent = { data: '' };
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event.event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    } else if (line.startsWith('id:')) {
      event.id = line.slice(3).trim();
    } else if (line.startsWith('retry:')) {
      const retry = parseInt(line.slice(6).trim(), 10);
      if (!isNaN(retry)) {
        event.retry = retry;
      }
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  event.data = dataLines.join('\n');
  return event;
}

/**
 * Transform a ReadableStream by applying a function to each chunk.
 *
 * This utility creates a new ReadableStream that applies a transformation
 * function to each chunk from the source stream. The transform function can
 * be synchronous or asynchronous, allowing for complex processing pipelines.
 * Useful for modifying stream data types or content on-the-fly.
 *
 * @param stream - Source ReadableStream to transform
 * @param transform - Function to apply to each chunk (sync or async)
 * @returns New ReadableStream emitting transformed chunks
 *
 * @example
 * ```typescript
 * const textStream = fetchStream(); // ReadableStream<Uint8Array>
 * const uppercaseStream = transformStream(textStream, (chunk) => {
 *   const text = new TextDecoder().decode(chunk);
 *   return new TextEncoder().encode(text.toUpperCase());
 * });
 * ```
 */
export function transformStream<T, U>(
  stream: ReadableStream<T>,
  transform: (chunk: T) => U | Promise<U>
): ReadableStream<U> {
  const reader = stream.getReader();

  return new ReadableStream<U>({
    async pull(controller) {
      const { done, value } = await reader.read();

      if (done) {
        controller.close();
        return;
      }

      const transformed = await transform(value);
      controller.enqueue(transformed);
    },
    cancel() {
      reader.cancel();
    },
  });
}

/**
 * Merge multiple ReadableStreams into a single stream.
 *
 * This utility combines multiple source streams into one output stream,
 * reading from all sources concurrently and emitting chunks as they arrive
 * from any source. The merged stream closes when all source streams complete.
 * Useful for combining multiple AI model responses or parallel data sources.
 *
 * @param streams - Variable number of ReadableStreams to merge
 * @returns Single ReadableStream emitting chunks from all sources
 *
 * @example
 * ```typescript
 * const stream1 = fetch('/api/model1').then(r => r.body!);
 * const stream2 = fetch('/api/model2').then(r => r.body!);
 * const combined = mergeStreams(stream1, stream2);
 *
 * for await (const chunk of toAsyncIterable(combined)) {
 *   console.log('Chunk from either stream:', chunk);
 * }
 * ```
 */
export function mergeStreams<T>(...streams: ReadableStream<T>[]): ReadableStream<T> {
  const readers = streams.map((s) => s.getReader());
  let activeReaders = readers.length;

  return new ReadableStream<T>({
    async pull(controller) {
      const results = await Promise.all(
        readers.map(async (reader, index) => {
          try {
            const { done, value } = await reader.read();
            return { index, done, value };
          } catch (error) {
            return { index, done: true, value: undefined, error };
          }
        })
      );

      for (const result of results) {
        if (result.done) {
          activeReaders--;
        } else if (result.value !== undefined) {
          controller.enqueue(result.value);
        }
      }

      if (activeReaders === 0) {
        controller.close();
      }
    },
    cancel() {
      readers.forEach((reader) => reader.cancel());
    },
  });
}

/**
 * Create a ReadableStream from an async iterable source.
 *
 * This utility converts any async iterable (like async generators) into a
 * ReadableStream, making it compatible with browser streaming APIs and
 * React streaming hooks. Useful for bridging between Node.js-style async
 * iterators and Web Streams API.
 *
 * @param iterable - Any async iterable source (async generator, etc.)
 * @returns ReadableStream emitting values from the iterable
 *
 * @example
 * ```typescript
 * async function* generateData() {
 *   yield 'chunk 1';
 *   yield 'chunk 2';
 *   yield 'chunk 3';
 * }
 *
 * const stream = fromAsyncIterable(generateData());
 * const response = new Response(stream);
 * ```
 */
export function fromAsyncIterable<T>(iterable: AsyncIterable<T>): ReadableStream<T> {
  const iterator = iterable[Symbol.asyncIterator]();

  return new ReadableStream<T>({
    async pull(controller) {
      const { done, value } = await iterator.next();

      if (done) {
        controller.close();
        return;
      }

      controller.enqueue(value);
    },
    cancel() {
      iterator.return?.();
    },
  });
}

/**
 * Convert a ReadableStream to an async iterable for use in for-await loops.
 *
 * This async generator wraps a ReadableStream and yields each chunk,
 * allowing you to consume Web Streams using async iteration syntax.
 * Properly handles reader lifecycle and ensures the lock is released.
 * Useful for consuming fetch responses in a more ergonomic way.
 *
 * @param stream - ReadableStream to convert
 * @yields Each chunk from the stream
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/stream');
 * for await (const chunk of toAsyncIterable(response.body!)) {
 *   console.log('Received chunk:', chunk);
 * }
 * ```
 */
export async function* toAsyncIterable<T>(
  stream: ReadableStream<T>
): AsyncGenerator<T, void, unknown> {
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
