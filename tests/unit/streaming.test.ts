/**
 * Tests for streaming.ts
 *
 * Tests for stream utilities including accumulation, transformation,
 * collection, validation, and backpressure handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  IRChatStream,
  IRStreamChunk,
  StreamContentChunk,
  StreamDoneChunk,
  StreamErrorChunk,
  IRMetadata,
} from 'ai.matey.types';
import {
  // Stream Accumulation
  createStreamAccumulator,
  accumulateChunk,
  accumulatorToMessage,
  accumulatorToResponse,
  // Stream Transformation
  transformStream,
  filterStream,
  mapStream,
  tapStream,
  // Stream Collection
  collectStream,
  streamToResponse,
  streamToText,
  // Error Handling
  catchStreamErrors,
  streamWithTimeout,
  // Stream Utilities
  isContentChunk,
  isDoneChunk,
  isErrorChunk,
  getContentDeltas,
  // Stream Validation
  validateChunkSequence,
  validateStream,
  assembleStreamChunks,
  createStreamError,
  // Backpressure
  rateLimitStream,
} from 'ai.matey.utils';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock async generator stream from chunks.
 */
async function* createMockStream(chunks: IRStreamChunk[]): IRChatStream {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/**
 * Collect all items from an async generator.
 */
async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of gen) {
    items.push(item);
  }
  return items;
}

// ============================================================================
// createStreamAccumulator Tests
// ============================================================================

describe('createStreamAccumulator', () => {
  it('should create an empty accumulator', () => {
    const acc = createStreamAccumulator();

    expect(acc.content).toBe('');
    expect(acc.role).toBe('assistant');
    expect(acc.sequence).toBe(0);
    expect(acc.metadata).toBeUndefined();
  });

  it('should create independent accumulators', () => {
    const acc1 = createStreamAccumulator();
    const acc2 = createStreamAccumulator();

    acc1.content = 'modified';
    acc1.sequence = 5;

    expect(acc2.content).toBe('');
    expect(acc2.sequence).toBe(0);
  });
});

// ============================================================================
// accumulateChunk Tests
// ============================================================================

describe('accumulateChunk', () => {
  it('should accumulate content chunks', () => {
    const acc = createStreamAccumulator();
    const chunk: StreamContentChunk = {
      type: 'content',
      delta: 'Hello',
      sequence: 0,
    };

    const result = accumulateChunk(acc, chunk);

    expect(result.content).toBe('Hello');
    expect(result.sequence).toBe(0);
  });

  it('should accumulate multiple content chunks', () => {
    let acc = createStreamAccumulator();
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: ' ', sequence: 1 },
      { type: 'content', delta: 'World', sequence: 2 },
    ];

    for (const chunk of chunks) {
      acc = accumulateChunk(acc, chunk);
    }

    expect(acc.content).toBe('Hello World');
    expect(acc.sequence).toBe(2);
  });

  it('should accumulate metadata chunks', () => {
    let acc = createStreamAccumulator();
    const metadataChunk: IRStreamChunk = {
      type: 'metadata',
      sequence: 0,
      metadata: { model: 'test-model', provider: 'test' },
    };

    acc = accumulateChunk(acc, metadataChunk);

    expect(acc.metadata).toEqual({ model: 'test-model', provider: 'test' });
  });

  it('should merge multiple metadata chunks', () => {
    let acc = createStreamAccumulator();
    const metadata1: IRStreamChunk = {
      type: 'metadata',
      sequence: 0,
      metadata: { model: 'test-model' },
    };
    const metadata2: IRStreamChunk = {
      type: 'metadata',
      sequence: 1,
      metadata: { provider: 'test' },
    };

    acc = accumulateChunk(acc, metadata1);
    acc = accumulateChunk(acc, metadata2);

    expect(acc.metadata).toEqual({ model: 'test-model', provider: 'test' });
  });

  it('should handle non-accumulating chunk types', () => {
    const acc = createStreamAccumulator();
    const startChunk: IRStreamChunk = {
      type: 'start',
      sequence: 0,
      model: 'test',
    };

    const result = accumulateChunk(acc, startChunk);

    expect(result.content).toBe('');
    expect(result.sequence).toBe(0);
  });

  it('should not mutate original accumulator', () => {
    const acc = createStreamAccumulator();
    const chunk: StreamContentChunk = {
      type: 'content',
      delta: 'Hello',
      sequence: 0,
    };

    const result = accumulateChunk(acc, chunk);

    expect(acc.content).toBe('');
    expect(result.content).toBe('Hello');
  });
});

// ============================================================================
// accumulatorToMessage Tests
// ============================================================================

describe('accumulatorToMessage', () => {
  it('should convert accumulator to message', () => {
    const acc = createStreamAccumulator();
    acc.content = 'Hello, World!';

    const message = accumulatorToMessage(acc);

    expect(message.role).toBe('assistant');
    expect(message.content).toBe('Hello, World!');
  });

  it('should handle empty content', () => {
    const acc = createStreamAccumulator();

    const message = accumulatorToMessage(acc);

    expect(message.role).toBe('assistant');
    expect(message.content).toBe('');
  });
});

// ============================================================================
// accumulatorToResponse Tests
// ============================================================================

describe('accumulatorToResponse', () => {
  it('should convert accumulator to complete response', () => {
    const acc = createStreamAccumulator();
    acc.content = 'Hello!';
    acc.sequence = 5;

    const doneChunk: StreamDoneChunk = {
      type: 'done',
      sequence: 6,
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    };

    const metadata: IRMetadata = {
      model: 'test-model',
      provider: 'test',
    };

    const response = accumulatorToResponse(acc, doneChunk, metadata);

    expect(response.message.content).toBe('Hello!');
    expect(response.message.role).toBe('assistant');
    expect(response.finishReason).toBe('stop');
    expect(response.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(response.metadata.model).toBe('test-model');
    expect(response.metadata.provider).toBe('test');
  });

  it('should merge accumulator metadata with request metadata', () => {
    const acc = createStreamAccumulator();
    acc.content = 'Test';
    acc.metadata = { streamId: 'abc123' };

    const doneChunk: StreamDoneChunk = {
      type: 'done',
      sequence: 1,
      finishReason: 'stop',
    };

    const metadata: IRMetadata = {
      model: 'test-model',
      provider: 'test',
    };

    const response = accumulatorToResponse(acc, doneChunk, metadata);

    expect(response.metadata).toEqual({
      model: 'test-model',
      provider: 'test',
      streamId: 'abc123',
    });
  });
});

// ============================================================================
// transformStream Tests
// ============================================================================

describe('transformStream', () => {
  it('should transform chunks', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'hello', sequence: 0 },
      { type: 'content', delta: 'world', sequence: 1 },
    ];

    const stream = createMockStream(chunks);
    const transformed = transformStream(stream, (chunk) => {
      if (chunk.type === 'content') {
        return { ...chunk, delta: chunk.delta.toUpperCase() };
      }
      return chunk;
    });

    const result = await collectStream(transformed);

    expect((result[0] as StreamContentChunk).delta).toBe('HELLO');
    expect((result[1] as StreamContentChunk).delta).toBe('WORLD');
  });

  it('should filter out null results', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'keep', sequence: 0 },
      { type: 'content', delta: 'remove', sequence: 1 },
      { type: 'content', delta: 'keep', sequence: 2 },
    ];

    const stream = createMockStream(chunks);
    const transformed = transformStream(stream, (chunk) => {
      if (chunk.type === 'content' && chunk.delta === 'remove') {
        return null;
      }
      return chunk;
    });

    const result = await collectStream(transformed);

    expect(result.length).toBe(2);
    expect((result[0] as StreamContentChunk).delta).toBe('keep');
    expect((result[1] as StreamContentChunk).delta).toBe('keep');
  });
});

// ============================================================================
// filterStream Tests
// ============================================================================

describe('filterStream', () => {
  it('should filter chunks by predicate', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'start', sequence: 1, model: 'test' },
      { type: 'content', delta: 'World', sequence: 2 },
    ];

    const stream = createMockStream(chunks);
    const filtered = filterStream(stream, (chunk) => chunk.type === 'content');

    const result = await collectStream(filtered);

    expect(result.length).toBe(2);
    expect(result[0].type).toBe('content');
    expect(result[1].type).toBe('content');
  });

  it('should pass through all chunks when predicate always returns true', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'done', sequence: 1, finishReason: 'stop' },
    ];

    const stream = createMockStream(chunks);
    const filtered = filterStream(stream, () => true);

    const result = await collectStream(filtered);

    expect(result.length).toBe(2);
  });

  it('should return empty stream when predicate always returns false', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: 'World', sequence: 1 },
    ];

    const stream = createMockStream(chunks);
    const filtered = filterStream(stream, () => false);

    const result = await collectStream(filtered);

    expect(result.length).toBe(0);
  });
});

// ============================================================================
// mapStream Tests
// ============================================================================

describe('mapStream', () => {
  it('should map chunks to different type', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: 'World', sequence: 1 },
    ];

    const stream = createMockStream(chunks);
    const mapped = mapStream(stream, (chunk) => chunk.sequence);

    const result = await collect(mapped);

    expect(result).toEqual([0, 1]);
  });

  it('should extract specific properties', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: 'World', sequence: 1 },
    ];

    const stream = createMockStream(chunks);
    const mapped = mapStream(stream, (chunk) =>
      chunk.type === 'content' ? chunk.delta : ''
    );

    const result = await collect(mapped);

    expect(result).toEqual(['Hello', 'World']);
  });
});

// ============================================================================
// tapStream Tests
// ============================================================================

describe('tapStream', () => {
  it('should call callback for each chunk without modifying stream', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: 'World', sequence: 1 },
    ];

    const tappedChunks: IRStreamChunk[] = [];
    const stream = createMockStream(chunks);
    const tapped = tapStream(stream, (chunk) => {
      tappedChunks.push(chunk);
    });

    const result = await collectStream(tapped);

    expect(result).toEqual(chunks);
    expect(tappedChunks).toEqual(chunks);
  });

  it('should handle async callbacks', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
    ];

    let callbackExecuted = false;
    const stream = createMockStream(chunks);
    const tapped = tapStream(stream, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      callbackExecuted = true;
    });

    await collectStream(tapped);

    expect(callbackExecuted).toBe(true);
  });
});

// ============================================================================
// collectStream Tests
// ============================================================================

describe('collectStream', () => {
  it('should collect all chunks into array', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'start', sequence: 0, model: 'test' },
      { type: 'content', delta: 'Hello', sequence: 1 },
      { type: 'done', sequence: 2, finishReason: 'stop' },
    ];

    const stream = createMockStream(chunks);
    const result = await collectStream(stream);

    expect(result).toEqual(chunks);
  });

  it('should handle empty streams', async () => {
    const stream = createMockStream([]);
    const result = await collectStream(stream);

    expect(result).toEqual([]);
  });
});

// ============================================================================
// streamToResponse Tests
// ============================================================================

describe('streamToResponse', () => {
  it('should convert stream to complete response', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: ' World', sequence: 1 },
      {
        type: 'done',
        sequence: 2,
        finishReason: 'stop',
        usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 },
      },
    ];

    const metadata: IRMetadata = { model: 'test', provider: 'test' };
    const stream = createMockStream(chunks);
    const response = await streamToResponse(stream, metadata);

    expect(response.message.content).toBe('Hello World');
    expect(response.finishReason).toBe('stop');
    expect(response.usage).toEqual({ promptTokens: 5, completionTokens: 2, totalTokens: 7 });
  });

  it('should create default done chunk if missing', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
    ];

    const metadata: IRMetadata = { model: 'test', provider: 'test' };
    const stream = createMockStream(chunks);
    const response = await streamToResponse(stream, metadata);

    expect(response.message.content).toBe('Hello');
    expect(response.finishReason).toBe('stop');
  });
});

// ============================================================================
// streamToText Tests
// ============================================================================

describe('streamToText', () => {
  it('should extract text from content chunks', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: ' World', sequence: 1 },
    ];

    const stream = createMockStream(chunks);
    const text = await streamToText(stream);

    expect(text).toBe('Hello World');
  });

  it('should ignore non-content chunks', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'start', sequence: 0, model: 'test' },
      { type: 'content', delta: 'Hello', sequence: 1 },
      { type: 'done', sequence: 2, finishReason: 'stop' },
    ];

    const stream = createMockStream(chunks);
    const text = await streamToText(stream);

    expect(text).toBe('Hello');
  });

  it('should return empty string for empty stream', async () => {
    const stream = createMockStream([]);
    const text = await streamToText(stream);

    expect(text).toBe('');
  });
});

// ============================================================================
// catchStreamErrors Tests
// ============================================================================

describe('catchStreamErrors', () => {
  it('should pass through chunks when no error occurs', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
    ];

    const stream = createMockStream(chunks);
    const wrapped = catchStreamErrors(stream, () => null);

    const result = await collectStream(wrapped);

    expect(result).toEqual(chunks);
  });

  it('should catch errors and yield error chunk', async () => {
    async function* errorStream(): IRChatStream {
      yield { type: 'content', delta: 'Hello', sequence: 0 };
      throw new Error('Stream error');
    }

    const onError = (error: Error): IRStreamChunk => ({
      type: 'error',
      sequence: 1,
      error: { code: 'STREAM_ERROR', message: error.message },
    });

    const wrapped = catchStreamErrors(errorStream(), onError);
    const result = await collectStream(wrapped);

    expect(result.length).toBe(2);
    expect(result[0].type).toBe('content');
    expect(result[1].type).toBe('error');
    expect((result[1] as StreamErrorChunk).error.message).toBe('Stream error');
  });

  it('should not yield anything when onError returns null', async () => {
    async function* errorStream(): IRChatStream {
      throw new Error('Silent error');
    }

    const wrapped = catchStreamErrors(errorStream(), () => null);
    const result = await collectStream(wrapped);

    expect(result.length).toBe(0);
  });
});

// ============================================================================
// streamWithTimeout Tests
// ============================================================================

describe('streamWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should pass through chunks when no timeout', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
    ];

    const stream = createMockStream(chunks);
    const timeoutStream = streamWithTimeout(stream, 1000, () => ({
      type: 'error',
      sequence: 999,
      error: { code: 'TIMEOUT', message: 'Timeout' },
    }));

    const collectPromise = collectStream(timeoutStream);
    await vi.advanceTimersByTimeAsync(0);
    const result = await collectPromise;

    expect(result).toEqual(chunks);
  });

  it('should yield timeout chunk when stream times out', async () => {
    async function* slowStream(): IRChatStream {
      yield { type: 'content', delta: 'Hello', sequence: 0 };
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Takes 5 seconds
      yield { type: 'content', delta: 'World', sequence: 1 };
    }

    const timeoutStream = streamWithTimeout(slowStream(), 100, () => ({
      type: 'error',
      sequence: 999,
      error: { code: 'TIMEOUT', message: 'Stream timeout' },
    }));

    const collectPromise = collectStream(timeoutStream);

    // Advance past the timeout
    await vi.advanceTimersByTimeAsync(150);

    const result = await collectPromise;

    expect(result.length).toBe(2);
    expect(result[0].type).toBe('content');
    expect(result[1].type).toBe('error');
    expect((result[1] as StreamErrorChunk).error.code).toBe('TIMEOUT');
  });
});

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('isContentChunk', () => {
  it('should return true for content chunks', () => {
    const chunk: IRStreamChunk = { type: 'content', delta: 'Hello', sequence: 0 };
    expect(isContentChunk(chunk)).toBe(true);
  });

  it('should return false for non-content chunks', () => {
    const startChunk: IRStreamChunk = { type: 'start', sequence: 0, model: 'test' };
    const doneChunk: IRStreamChunk = { type: 'done', sequence: 1, finishReason: 'stop' };

    expect(isContentChunk(startChunk)).toBe(false);
    expect(isContentChunk(doneChunk)).toBe(false);
  });
});

describe('isDoneChunk', () => {
  it('should return true for done chunks', () => {
    const chunk: IRStreamChunk = { type: 'done', sequence: 0, finishReason: 'stop' };
    expect(isDoneChunk(chunk)).toBe(true);
  });

  it('should return false for non-done chunks', () => {
    const contentChunk: IRStreamChunk = { type: 'content', delta: 'Hello', sequence: 0 };
    expect(isDoneChunk(contentChunk)).toBe(false);
  });
});

describe('isErrorChunk', () => {
  it('should return true for error chunks', () => {
    const chunk: IRStreamChunk = {
      type: 'error',
      sequence: 0,
      error: { code: 'ERROR', message: 'Error' },
    };
    expect(isErrorChunk(chunk)).toBe(true);
  });

  it('should return false for non-error chunks', () => {
    const contentChunk: IRStreamChunk = { type: 'content', delta: 'Hello', sequence: 0 };
    expect(isErrorChunk(contentChunk)).toBe(false);
  });
});

// ============================================================================
// getContentDeltas Tests
// ============================================================================

describe('getContentDeltas', () => {
  it('should extract just the delta strings', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'start', sequence: 0, model: 'test' },
      { type: 'content', delta: 'Hello', sequence: 1 },
      { type: 'content', delta: ' World', sequence: 2 },
      { type: 'done', sequence: 3, finishReason: 'stop' },
    ];

    const stream = createMockStream(chunks);
    const deltas = getContentDeltas(stream);
    const result = await collect(deltas);

    expect(result).toEqual(['Hello', ' World']);
  });
});

// ============================================================================
// validateChunkSequence Tests
// ============================================================================

describe('validateChunkSequence', () => {
  it('should return valid for sequential chunks', () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: 'World', sequence: 1 },
      { type: 'done', sequence: 2, finishReason: 'stop' },
    ];

    const result = validateChunkSequence(chunks);

    expect(result.valid).toBe(true);
    expect(result.gaps).toEqual([]);
    expect(result.duplicates).toEqual([]);
    expect(result.outOfOrder).toBe(false);
    expect(result.expectedNext).toBe(3);
  });

  it('should detect gaps in sequence', () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: 'World', sequence: 3 }, // Gap: 1, 2 missing
    ];

    const result = validateChunkSequence(chunks);

    expect(result.valid).toBe(false);
    expect(result.gaps).toEqual([1, 2]);
  });

  it('should detect duplicate sequences', () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: 'World', sequence: 0 }, // Duplicate
    ];

    const result = validateChunkSequence(chunks);

    expect(result.valid).toBe(false);
    expect(result.duplicates).toEqual([0]);
  });

  it('should detect out-of-order chunks', () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 1 },
      { type: 'content', delta: 'World', sequence: 0 }, // Out of order
    ];

    const result = validateChunkSequence(chunks);

    expect(result.valid).toBe(false);
    expect(result.outOfOrder).toBe(true);
  });

  it('should handle chunks without sequence numbers', () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello' } as IRStreamChunk,
      { type: 'content', delta: 'World' } as IRStreamChunk,
    ];

    const result = validateChunkSequence(chunks);

    // No sequence numbers = valid but expectedNext is 0
    expect(result.gaps).toEqual([]);
    expect(result.duplicates).toEqual([]);
    expect(result.expectedNext).toBe(0);
  });
});

// ============================================================================
// validateStream Tests
// ============================================================================

describe('validateStream', () => {
  it('should pass through valid streams', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: 'World', sequence: 1 },
    ];

    const stream = createMockStream(chunks);
    const validated = validateStream(stream);
    const result = await collectStream(validated);

    expect(result).toEqual(chunks);
  });

  it('should throw on duplicate sequences when rejectDuplicates is true', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: 'World', sequence: 0 }, // Duplicate
    ];

    const stream = createMockStream(chunks);
    const validated = validateStream(stream, { rejectDuplicates: true });

    await expect(collectStream(validated)).rejects.toThrow('Duplicate sequence number: 0');
  });

  it('should throw on sequence gaps when strictSequence is true', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: 'World', sequence: 5 }, // Gap of 5
    ];

    const stream = createMockStream(chunks);
    const validated = validateStream(stream, { strictSequence: true, maxGap: 0 });

    await expect(collectStream(validated)).rejects.toThrow('Sequence gap detected');
  });

  it('should allow gaps up to maxGap', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: 'World', sequence: 2 }, // Gap of 2
    ];

    const stream = createMockStream(chunks);
    const validated = validateStream(stream, { strictSequence: true, maxGap: 3 });
    const result = await collectStream(validated);

    expect(result.length).toBe(2);
  });

  it('should call onWarning instead of throwing when strict is false', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: 'World', sequence: 0 }, // Duplicate
    ];

    const warnings: string[] = [];
    const stream = createMockStream(chunks);
    const validated = validateStream(stream, {
      rejectDuplicates: false,
      strictSequence: false, // Also disable strict sequence (prevents out-of-order error)
      onWarning: (msg) => warnings.push(msg),
    });

    await collectStream(validated);

    // Should get warnings for both duplicate and out-of-order
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.includes('Duplicate sequence number'))).toBe(true);
  });

  it('should pass through chunks without sequence numbers', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello' } as IRStreamChunk,
    ];

    const stream = createMockStream(chunks);
    const validated = validateStream(stream);
    const result = await collectStream(validated);

    expect(result).toEqual(chunks);
  });
});

// ============================================================================
// assembleStreamChunks Tests
// ============================================================================

describe('assembleStreamChunks', () => {
  it('should assemble content into complete text', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: ' World', sequence: 1 },
    ];

    const stream = createMockStream(chunks);
    const text = await assembleStreamChunks(stream);

    expect(text).toBe('Hello World');
  });
});

// ============================================================================
// createStreamError Tests
// ============================================================================

describe('createStreamError', () => {
  it('should create a properly formatted error chunk', () => {
    const errorChunk = createStreamError('RATE_LIMIT', 'Rate limit exceeded', 5);

    expect(errorChunk.type).toBe('error');
    expect(errorChunk.sequence).toBe(5);
    expect(errorChunk.error.code).toBe('RATE_LIMIT');
    expect(errorChunk.error.message).toBe('Rate limit exceeded');
    expect(errorChunk.error.details).toBeUndefined();
  });

  it('should include optional details', () => {
    const errorChunk = createStreamError('RATE_LIMIT', 'Rate limit exceeded', 5, {
      retryAfter: 60,
      limit: 100,
    });

    expect(errorChunk.error.details).toEqual({
      retryAfter: 60,
      limit: 100,
    });
  });
});

// ============================================================================
// rateLimitStream Tests
// ============================================================================

describe('rateLimitStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should add delay between chunks', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: 'World', sequence: 1 },
    ];

    const stream = createMockStream(chunks);
    // 10 chunks per second = 100ms delay
    const rateLimited = rateLimitStream(stream, 10);

    const results: IRStreamChunk[] = [];
    const collectPromise = (async () => {
      for await (const chunk of rateLimited) {
        results.push(chunk);
      }
    })();

    // First chunk should come immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(results.length).toBe(1);

    // Second chunk after 100ms
    await vi.advanceTimersByTimeAsync(100);
    expect(results.length).toBe(2);

    await collectPromise;
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Streaming Integration', () => {
  it('should chain multiple stream operations', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'start', sequence: 0, model: 'test' },
      { type: 'content', delta: 'hello', sequence: 1 },
      { type: 'content', delta: 'world', sequence: 2 },
      { type: 'done', sequence: 3, finishReason: 'stop' },
    ];

    const stream = createMockStream(chunks);

    // Filter to content only, then transform to uppercase
    const filtered = filterStream(stream, (c) => c.type === 'content');
    const transformed = transformStream(filtered, (c) => {
      if (c.type === 'content') {
        return { ...c, delta: c.delta.toUpperCase() };
      }
      return c;
    });

    const result = await collectStream(transformed);

    expect(result.length).toBe(2);
    expect((result[0] as StreamContentChunk).delta).toBe('HELLO');
    expect((result[1] as StreamContentChunk).delta).toBe('WORLD');
  });

  it('should accumulate, transform, and collect', async () => {
    const chunks: IRStreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: ' ', sequence: 1 },
      { type: 'content', delta: 'World', sequence: 2 },
      { type: 'done', sequence: 3, finishReason: 'stop' },
    ];

    const metadata: IRMetadata = { model: 'test', provider: 'test' };
    const stream = createMockStream(chunks);
    const response = await streamToResponse(stream, metadata);

    expect(response.message.content).toBe('Hello World');
    expect(response.finishReason).toBe('stop');
  });
});
