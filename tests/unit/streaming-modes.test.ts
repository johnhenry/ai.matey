/**
 * Tests for streaming-modes.ts
 *
 * Tests for stream mode detection, conversion, and configuration.
 */

import { describe, it, expect } from 'vitest';
import type { IRChatStream, StreamContentChunk, StreamChunk, StreamingConfig } from 'ai.matey.types';
import {
  createAccumulatorState,
  detectChunkMode,
  needsConversion,
  convertStreamMode,
  convertChunkMode,
  getEffectiveStreamMode,
  mergeStreamingConfig,
  ensureStreamMode,
  addAccumulatedToStream,
  stripAccumulatedFromStream,
} from 'ai.matey.utils';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock async generator stream from chunks.
 */
async function* createMockStream(chunks: StreamChunk[]): IRChatStream {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/**
 * Collect all chunks from a stream into an array.
 */
async function collectStream(stream: IRChatStream): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

// ============================================================================
// createAccumulatorState Tests
// ============================================================================

describe('createAccumulatorState', () => {
  it('should create an empty accumulator state', () => {
    const state = createAccumulatorState();

    expect(state.accumulated).toBe('');
    expect(state.chunkCount).toBe(0);
    expect(state.lastSequence).toBe(-1);
  });

  it('should create independent state objects', () => {
    const state1 = createAccumulatorState();
    const state2 = createAccumulatorState();

    state1.accumulated = 'test';
    state1.chunkCount = 5;

    expect(state2.accumulated).toBe('');
    expect(state2.chunkCount).toBe(0);
  });
});

// ============================================================================
// detectChunkMode Tests
// ============================================================================

describe('detectChunkMode', () => {
  it('should detect delta mode for delta-only chunks', () => {
    const chunk: StreamContentChunk = {
      type: 'content',
      delta: 'Hello',
    };

    expect(detectChunkMode(chunk)).toBe('delta');
  });

  it('should detect accumulated mode for accumulated-only chunks', () => {
    const chunk: StreamContentChunk = {
      type: 'content',
      delta: 'Hello',
      accumulated: 'Hello',
    };

    expect(detectChunkMode(chunk)).toBe('accumulated');
  });

  it('should prefer accumulated when both are present', () => {
    const chunk: StreamContentChunk = {
      type: 'content',
      delta: ' World',
      accumulated: 'Hello World',
    };

    expect(detectChunkMode(chunk)).toBe('accumulated');
  });

  it('should detect accumulated mode when only accumulated is set', () => {
    const chunk = {
      type: 'content' as const,
      delta: '', // Empty delta
      accumulated: 'Hello',
    };

    expect(detectChunkMode(chunk)).toBe('accumulated');
  });
});

// ============================================================================
// needsConversion Tests
// ============================================================================

describe('needsConversion', () => {
  describe('with preserveIfMatch = true (default)', () => {
    it('should return false when chunk is already in delta mode and target is delta', () => {
      const chunk: StreamContentChunk = {
        type: 'content',
        delta: 'Hello',
      };

      expect(needsConversion(chunk, 'delta')).toBe(false);
    });

    it('should return false when chunk is already in accumulated mode and target is accumulated', () => {
      const chunk: StreamContentChunk = {
        type: 'content',
        delta: 'Hello',
        accumulated: 'Hello',
      };

      expect(needsConversion(chunk, 'accumulated')).toBe(false);
    });

    it('should return true when chunk needs conversion to accumulated', () => {
      const chunk: StreamContentChunk = {
        type: 'content',
        delta: 'Hello',
      };

      expect(needsConversion(chunk, 'accumulated')).toBe(true);
    });

    it('should return false when chunk has delta and target is delta', () => {
      const chunk: StreamContentChunk = {
        type: 'content',
        delta: 'Hello',
        accumulated: 'Hello', // Has both, but delta is present
      };

      expect(needsConversion(chunk, 'delta')).toBe(false);
    });
  });

  describe('with preserveIfMatch = false', () => {
    it('should always return true regardless of current mode', () => {
      const deltaChunk: StreamContentChunk = {
        type: 'content',
        delta: 'Hello',
      };

      expect(needsConversion(deltaChunk, 'delta', false)).toBe(true);

      const accChunk: StreamContentChunk = {
        type: 'content',
        delta: 'Hello',
        accumulated: 'Hello',
      };

      expect(needsConversion(accChunk, 'accumulated', false)).toBe(true);
    });
  });
});

// ============================================================================
// convertChunkMode Tests
// ============================================================================

describe('convertChunkMode', () => {
  describe('converting to delta mode', () => {
    it('should remove accumulated field', () => {
      const state = createAccumulatorState();
      const chunk: StreamContentChunk = {
        type: 'content',
        delta: 'Hello',
        accumulated: 'Hello',
        sequence: 0,
        role: 'assistant',
      };

      const result = convertChunkMode(chunk, 'delta', state);

      expect(result.delta).toBe('Hello');
      expect(result.accumulated).toBeUndefined();
      expect(result.sequence).toBe(0);
      expect(result.role).toBe('assistant');
    });

    it('should update accumulator state', () => {
      const state = createAccumulatorState();
      const chunk: StreamContentChunk = {
        type: 'content',
        delta: 'Hello',
      };

      convertChunkMode(chunk, 'delta', state);

      expect(state.accumulated).toBe('Hello');
    });
  });

  describe('converting to accumulated mode', () => {
    it('should add accumulated field', () => {
      const state = createAccumulatorState();
      const chunk: StreamContentChunk = {
        type: 'content',
        delta: 'Hello',
        sequence: 0,
      };

      const result = convertChunkMode(chunk, 'accumulated', state);

      expect(result.delta).toBe('Hello');
      expect(result.accumulated).toBe('Hello');
    });

    it('should accumulate across multiple chunks', () => {
      const state = createAccumulatorState();

      const chunk1: StreamContentChunk = { type: 'content', delta: 'Hello' };
      const chunk2: StreamContentChunk = { type: 'content', delta: ' World' };

      const result1 = convertChunkMode(chunk1, 'accumulated', state);
      const result2 = convertChunkMode(chunk2, 'accumulated', state);

      expect(result1.accumulated).toBe('Hello');
      expect(result2.accumulated).toBe('Hello World');
    });

    it('should apply transform function if provided', () => {
      const state = createAccumulatorState();
      const chunk: StreamContentChunk = { type: 'content', delta: 'hello' };
      const transform = (text: string) => text.toUpperCase();

      const result = convertChunkMode(chunk, 'accumulated', state, transform);

      expect(result.accumulated).toBe('HELLO');
    });
  });
});

// ============================================================================
// convertStreamMode Tests
// ============================================================================

describe('convertStreamMode', () => {
  it('should pass through non-content chunks unchanged', async () => {
    const chunks: StreamChunk[] = [
      { type: 'start', model: 'test-model' },
      { type: 'content', delta: 'Hello' },
      { type: 'finish', finishReason: 'stop' },
    ];

    const stream = createMockStream(chunks);
    const converted = convertStreamMode(stream, { mode: 'accumulated' });
    const result = await collectStream(converted);

    expect(result[0]).toEqual({ type: 'start', model: 'test-model' });
    expect(result[2]).toEqual({ type: 'finish', finishReason: 'stop' });
  });

  it('should convert delta stream to accumulated', async () => {
    const chunks: StreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0 },
      { type: 'content', delta: ' World', sequence: 1 },
    ];

    const stream = createMockStream(chunks);
    const converted = convertStreamMode(stream, { mode: 'accumulated' });
    const result = await collectStream(converted);

    expect(result[0]).toMatchObject({
      type: 'content',
      delta: 'Hello',
      accumulated: 'Hello',
    });
    expect(result[1]).toMatchObject({
      type: 'content',
      delta: ' World',
      accumulated: 'Hello World',
    });
  });

  it('should validate sequence order when validateSequence is true', async () => {
    const chunks: StreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 1 },
      { type: 'content', delta: 'World', sequence: 0 }, // Out of order!
    ];

    const stream = createMockStream(chunks);
    const converted = convertStreamMode(stream, {
      mode: 'accumulated',
      validateSequence: true,
    });

    await expect(collectStream(converted)).rejects.toThrow('Out of order chunk');
  });

  it('should not validate sequence when validateSequence is false', async () => {
    const chunks: StreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 1 },
      { type: 'content', delta: 'World', sequence: 0 },
    ];

    const stream = createMockStream(chunks);
    const converted = convertStreamMode(stream, {
      mode: 'accumulated',
      validateSequence: false,
    });

    const result = await collectStream(converted);
    expect(result.length).toBe(2);
  });

  it('should skip conversion when preserveIfMatch is true and already in target mode', async () => {
    const chunks: StreamChunk[] = [
      { type: 'content', delta: 'Hello', accumulated: 'Hello' },
    ];

    const stream = createMockStream(chunks);
    const converted = convertStreamMode(stream, {
      mode: 'accumulated',
      preserveIfMatch: true,
    });

    const result = await collectStream(converted);
    expect(result[0]).toEqual(chunks[0]);
  });

  it('should apply transform function to accumulated text', async () => {
    const chunks: StreamChunk[] = [
      { type: 'content', delta: 'hello' },
      { type: 'content', delta: ' world' },
    ];

    const stream = createMockStream(chunks);
    const converted = convertStreamMode(stream, {
      mode: 'accumulated',
      transform: (text) => text.toUpperCase(),
    });

    const result = await collectStream(converted);

    expect((result[0] as StreamContentChunk).accumulated).toBe('HELLO');
    expect((result[1] as StreamContentChunk).accumulated).toBe('HELLO WORLD');
  });
});

// ============================================================================
// getEffectiveStreamMode Tests
// ============================================================================

describe('getEffectiveStreamMode', () => {
  it('should return requestMode when provided', () => {
    const result = getEffectiveStreamMode('accumulated', 'delta', { mode: 'delta' });
    expect(result).toBe('accumulated');
  });

  it('should return conversionMode when requestMode not provided', () => {
    const result = getEffectiveStreamMode(undefined, 'accumulated', { mode: 'delta' });
    expect(result).toBe('accumulated');
  });

  it('should return config mode when no request or conversion mode', () => {
    const result = getEffectiveStreamMode(undefined, undefined, { mode: 'accumulated' });
    expect(result).toBe('accumulated');
  });

  it('should return default delta mode when nothing specified', () => {
    const result = getEffectiveStreamMode(undefined, undefined, undefined);
    expect(result).toBe('delta');
  });

  it('should return delta when config mode is undefined', () => {
    const result = getEffectiveStreamMode(undefined, undefined, {});
    expect(result).toBe('delta');
  });
});

// ============================================================================
// mergeStreamingConfig Tests
// ============================================================================

describe('mergeStreamingConfig', () => {
  it('should return defaults when no configs provided', () => {
    const result = mergeStreamingConfig();

    expect(result.mode).toBe('delta');
    expect(result.includeBoth).toBe(false);
    expect(result.bufferStrategy).toBe('memory'); // Default
  });

  it('should apply config values', () => {
    const config: StreamingConfig = {
      mode: 'accumulated',
      includeBoth: true,
      bufferStrategy: 'line',
    };

    const result = mergeStreamingConfig(config);

    expect(result.mode).toBe('accumulated');
    expect(result.includeBoth).toBe(true);
    expect(result.bufferStrategy).toBe('line');
  });

  it('should give priority to first config (earlier wins)', () => {
    const highPriority: StreamingConfig = { mode: 'accumulated' };
    const lowPriority: StreamingConfig = { mode: 'delta' };

    const result = mergeStreamingConfig(highPriority, lowPriority);

    expect(result.mode).toBe('accumulated');
  });

  it('should handle undefined configs gracefully', () => {
    const config: StreamingConfig = { mode: 'accumulated' };

    const result = mergeStreamingConfig(undefined, config, undefined);

    expect(result.mode).toBe('accumulated');
  });

  it('should only override defined properties', () => {
    const partial: StreamingConfig = { mode: 'accumulated' };

    const result = mergeStreamingConfig(partial);

    expect(result.mode).toBe('accumulated');
    expect(result.includeBoth).toBe(false); // Default
    expect(result.bufferStrategy).toBe('memory'); // Default
  });
});

// ============================================================================
// ensureStreamMode Tests
// ============================================================================

describe('ensureStreamMode', () => {
  it('should convert stream to specified mode', async () => {
    const chunks: StreamChunk[] = [
      { type: 'content', delta: 'Hello' },
      { type: 'content', delta: ' World' },
    ];

    const stream = createMockStream(chunks);
    const ensured = ensureStreamMode(stream, 'accumulated');
    const result = await collectStream(ensured);

    expect((result[0] as StreamContentChunk).accumulated).toBe('Hello');
    expect((result[1] as StreamContentChunk).accumulated).toBe('Hello World');
  });

  it('should preserve chunks already in target mode', async () => {
    const chunks: StreamChunk[] = [
      { type: 'content', delta: 'Hello', accumulated: 'Hello' },
    ];

    const stream = createMockStream(chunks);
    const ensured = ensureStreamMode(stream, 'accumulated');
    const result = await collectStream(ensured);

    expect(result[0]).toEqual(chunks[0]);
  });
});

// ============================================================================
// addAccumulatedToStream Tests
// ============================================================================

describe('addAccumulatedToStream', () => {
  it('should add accumulated field to content chunks', async () => {
    const chunks: StreamChunk[] = [
      { type: 'content', delta: 'Hello' },
      { type: 'content', delta: ' World' },
    ];

    const stream = createMockStream(chunks);
    const augmented = addAccumulatedToStream(stream);
    const result = await collectStream(augmented);

    expect((result[0] as StreamContentChunk).delta).toBe('Hello');
    expect((result[0] as StreamContentChunk).accumulated).toBe('Hello');
    expect((result[1] as StreamContentChunk).delta).toBe(' World');
    expect((result[1] as StreamContentChunk).accumulated).toBe('Hello World');
  });

  it('should pass through non-content chunks unchanged', async () => {
    const chunks: StreamChunk[] = [
      { type: 'start', model: 'test-model' },
      { type: 'content', delta: 'Hello' },
      { type: 'finish', finishReason: 'stop' },
    ];

    const stream = createMockStream(chunks);
    const augmented = addAccumulatedToStream(stream);
    const result = await collectStream(augmented);

    expect(result[0]).toEqual({ type: 'start', model: 'test-model' });
    expect(result[2]).toEqual({ type: 'finish', finishReason: 'stop' });
  });

  it('should preserve existing properties on content chunks', async () => {
    const chunks: StreamChunk[] = [
      { type: 'content', delta: 'Hello', sequence: 0, role: 'assistant' },
    ];

    const stream = createMockStream(chunks);
    const augmented = addAccumulatedToStream(stream);
    const result = await collectStream(augmented);

    const contentChunk = result[0] as StreamContentChunk;
    expect(contentChunk.sequence).toBe(0);
    expect(contentChunk.role).toBe('assistant');
  });
});

// ============================================================================
// stripAccumulatedFromStream Tests
// ============================================================================

describe('stripAccumulatedFromStream', () => {
  it('should remove accumulated field from content chunks', async () => {
    const chunks: StreamChunk[] = [
      { type: 'content', delta: 'Hello', accumulated: 'Hello' },
      { type: 'content', delta: ' World', accumulated: 'Hello World' },
    ];

    const stream = createMockStream(chunks);
    const stripped = stripAccumulatedFromStream(stream);
    const result = await collectStream(stripped);

    expect((result[0] as StreamContentChunk).delta).toBe('Hello');
    expect((result[0] as StreamContentChunk).accumulated).toBeUndefined();
    expect((result[1] as StreamContentChunk).delta).toBe(' World');
    expect((result[1] as StreamContentChunk).accumulated).toBeUndefined();
  });

  it('should pass through non-content chunks unchanged', async () => {
    const chunks: StreamChunk[] = [
      { type: 'start', model: 'test-model' },
      { type: 'content', delta: 'Hello', accumulated: 'Hello' },
      { type: 'finish', finishReason: 'stop' },
    ];

    const stream = createMockStream(chunks);
    const stripped = stripAccumulatedFromStream(stream);
    const result = await collectStream(stripped);

    expect(result[0]).toEqual({ type: 'start', model: 'test-model' });
    expect(result[2]).toEqual({ type: 'finish', finishReason: 'stop' });
  });

  it('should preserve other properties on content chunks', async () => {
    const chunks: StreamChunk[] = [
      { type: 'content', delta: 'Hello', accumulated: 'Hello', sequence: 0, role: 'assistant' },
    ];

    const stream = createMockStream(chunks);
    const stripped = stripAccumulatedFromStream(stream);
    const result = await collectStream(stripped);

    const contentChunk = result[0] as StreamContentChunk;
    expect(contentChunk.delta).toBe('Hello');
    expect(contentChunk.sequence).toBe(0);
    expect(contentChunk.role).toBe('assistant');
    expect(contentChunk.accumulated).toBeUndefined();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Streaming Mode Integration', () => {
  it('should round-trip delta -> accumulated -> delta', async () => {
    const originalChunks: StreamChunk[] = [
      { type: 'start', model: 'test' },
      { type: 'content', delta: 'Hello' },
      { type: 'content', delta: ' World' },
      { type: 'finish', finishReason: 'stop' },
    ];

    // Convert to accumulated
    const stream1 = createMockStream(originalChunks);
    const accumulated = addAccumulatedToStream(stream1);

    // Convert back to delta-only
    const stripped = stripAccumulatedFromStream(accumulated);
    const result = await collectStream(stripped);

    // Content chunks should have delta but no accumulated
    const contentChunks = result.filter(c => c.type === 'content') as StreamContentChunk[];
    expect(contentChunks[0].delta).toBe('Hello');
    expect(contentChunks[0].accumulated).toBeUndefined();
    expect(contentChunks[1].delta).toBe(' World');
    expect(contentChunks[1].accumulated).toBeUndefined();
  });

  it('should handle empty streams', async () => {
    const stream = createMockStream([]);
    const converted = convertStreamMode(stream, { mode: 'accumulated' });
    const result = await collectStream(converted);

    expect(result).toEqual([]);
  });

  it('should handle streams with only non-content chunks', async () => {
    const chunks: StreamChunk[] = [
      { type: 'start', model: 'test' },
      { type: 'finish', finishReason: 'stop' },
    ];

    const stream = createMockStream(chunks);
    const converted = convertStreamMode(stream, { mode: 'accumulated' });
    const result = await collectStream(converted);

    expect(result).toEqual(chunks);
  });
});
