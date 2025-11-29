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
 * Create a controlled text stream from a fetch response.
 *
 * @param response - Fetch response with streaming body
 * @param options - Stream options
 * @returns Promise resolving to full text
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
 * Parse Server-Sent Events (SSE) stream.
 *
 * @param response - Fetch response with SSE body
 * @param options - Stream options
 * @returns Async generator yielding parsed events
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
 * Parse a single SSE event.
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
 * Transform a ReadableStream with a function.
 *
 * @param stream - Source stream
 * @param transform - Transform function
 * @returns Transformed stream
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
 * Merge multiple streams into one.
 *
 * @param streams - Streams to merge
 * @returns Merged stream
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
 * Create a stream from an async iterable.
 *
 * @param iterable - Async iterable source
 * @returns ReadableStream
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
 * Convert a ReadableStream to an async iterable.
 *
 * @param stream - ReadableStream source
 * @returns Async iterable
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
