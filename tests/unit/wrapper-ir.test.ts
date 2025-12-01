/**
 * IR Wrapper Tests
 *
 * Tests for the IR-native chat wrapper with conversation state management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Chat,
  createChat,
  collectStream,
  processStream,
  streamToText,
  streamToLines,
  throttleStream,
  teeStream,
} from 'ai.matey.wrapper';
import type { ChatBackend, ChatConfig, StreamOptions } from 'ai.matey.wrapper';
import type { IRChatRequest, IRChatResponse, IRStreamChunk, IRChatStream } from 'ai.matey.types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockBackend(options: {
  response?: Partial<IRChatResponse>;
  streamChunks?: string[];
  executeDelay?: number;
} = {}): ChatBackend {
  const defaultResponse: IRChatResponse = {
    message: { role: 'assistant', content: options.response?.message?.content ?? 'Mock response' },
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    metadata: {
      requestId: 'mock-123',
      timestamp: Date.now(),
      provenance: { backend: 'mock-backend' },
    },
  };

  return {
    execute: vi.fn(async (request: IRChatRequest) => {
      if (options.executeDelay) {
        await new Promise(resolve => setTimeout(resolve, options.executeDelay));
      }
      return { ...defaultResponse, ...options.response };
    }),
    executeStream: vi.fn(async function* (request: IRChatRequest): IRChatStream {
      const chunks = options.streamChunks ?? ['Hello', ' ', 'world'];
      let sequence = 0;

      yield {
        type: 'start',
        sequence: sequence++,
        metadata: { requestId: 'stream-123', timestamp: Date.now(), provenance: {} },
      };

      for (const chunk of chunks) {
        yield { type: 'content', sequence: sequence++, delta: chunk, role: 'assistant' };
      }

      yield {
        type: 'done',
        sequence: sequence++,
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: chunks.length, totalTokens: 10 + chunks.length },
        message: { role: 'assistant', content: chunks.join('') },
      };
    }),
  };
}

async function* createTestStream(chunks: string[]): IRChatStream {
  let sequence = 0;
  yield { type: 'start', sequence: sequence++, metadata: { requestId: 'test', timestamp: Date.now(), provenance: {} } };
  for (const chunk of chunks) {
    yield { type: 'content', sequence: sequence++, delta: chunk, role: 'assistant' };
  }
  yield {
    type: 'done',
    sequence: sequence++,
    finishReason: 'stop',
    message: { role: 'assistant', content: chunks.join('') },
  };
}

// ============================================================================
// Chat Class Tests
// ============================================================================

describe('Chat', () => {
  describe('construction', () => {
    it('should create chat with minimal config', () => {
      const backend = createMockBackend();
      const chat = new Chat({ backend });

      expect(chat.messages).toHaveLength(0);
      expect(chat.isLoading).toBe(false);
      expect(chat.error).toBeNull();
      expect(chat.requestCount).toBe(0);
    });

    it('should create chat via factory function', () => {
      const backend = createMockBackend();
      const chat = createChat({ backend });

      expect(chat).toBeInstanceOf(Chat);
    });

    it('should accept configuration options', () => {
      const backend = createMockBackend();
      const chat = new Chat({
        backend,
        systemPrompt: 'Be helpful',
        historyLimit: 50,
        defaultParameters: { model: 'gpt-4', temperature: 0.7 },
      });

      expect(chat.messages).toHaveLength(0);
    });
  });

  describe('send', () => {
    it('should send message and receive response', async () => {
      const backend = createMockBackend({ response: { message: { role: 'assistant', content: 'Hi there!' } } });
      const chat = new Chat({ backend });

      const response = await chat.send('Hello');

      expect(response.content).toBe('Hi there!');
      expect(response.finishReason).toBe('stop');
      expect(chat.messages).toHaveLength(2); // user + assistant
    });

    it('should maintain conversation history', async () => {
      const backend = createMockBackend();
      const chat = new Chat({ backend });

      await chat.send('First message');
      await chat.send('Second message');

      expect(chat.messages).toHaveLength(4); // 2 user + 2 assistant
      expect(chat.messages[0].role).toBe('user');
      expect(chat.messages[0].content).toBe('First message');
      expect(chat.messages[2].role).toBe('user');
      expect(chat.messages[2].content).toBe('Second message');
    });

    it('should include system prompt in requests', async () => {
      const backend = createMockBackend();
      const chat = new Chat({ backend, systemPrompt: 'You are helpful.' });

      await chat.send('Hello');

      const execute = backend.execute as ReturnType<typeof vi.fn>;
      const request = execute.mock.calls[0][0] as IRChatRequest;
      expect(request.messages[0].role).toBe('system');
      expect(request.messages[0].content).toBe('You are helpful.');
    });

    it('should track loading state', async () => {
      const backend = createMockBackend({ executeDelay: 50 });
      const chat = new Chat({ backend });

      expect(chat.isLoading).toBe(false);

      const promise = chat.send('Hello');
      expect(chat.isLoading).toBe(true);

      await promise;
      expect(chat.isLoading).toBe(false);
    });

    it('should track usage', async () => {
      const backend = createMockBackend();
      const chat = new Chat({ backend });

      await chat.send('Hello');

      expect(chat.totalUsage.promptTokens).toBe(10);
      expect(chat.totalUsage.completionTokens).toBe(5);
      expect(chat.totalUsage.totalTokens).toBe(15);
    });

    it('should accumulate usage across requests', async () => {
      const backend = createMockBackend();
      const chat = new Chat({ backend });

      await chat.send('First');
      await chat.send('Second');

      expect(chat.totalUsage.totalTokens).toBe(30);
      expect(chat.requestCount).toBe(2);
    });

    it('should handle errors', async () => {
      const backend = createMockBackend();
      (backend.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('API Error'));
      const chat = new Chat({ backend });

      await expect(chat.send('Hello')).rejects.toThrow('API Error');
      expect(chat.error?.message).toBe('API Error');
      expect(chat.isLoading).toBe(false);
    });

    it('should respect history limit', async () => {
      const backend = createMockBackend();
      const chat = new Chat({ backend, historyLimit: 4 });

      await chat.send('First');
      await chat.send('Second');
      await chat.send('Third');

      expect(chat.messages.length).toBeLessThanOrEqual(4);
    });
  });

  describe('stream', () => {
    it('should stream response with callbacks', async () => {
      const backend = createMockBackend({ streamChunks: ['Hello', ' ', 'world'] });
      const chat = new Chat({ backend });

      const chunks: string[] = [];
      const response = await chat.stream('Hi', {
        onChunk: ({ delta }) => chunks.push(delta),
      });

      expect(chunks).toEqual(['Hello', ' ', 'world']);
      expect(response.content).toBe('Hello world');
    });

    it('should call onStart callback', async () => {
      const backend = createMockBackend();
      const chat = new Chat({ backend });

      let startCalled = false;
      await chat.stream('Hi', {
        onStart: () => { startCalled = true; },
      });

      expect(startCalled).toBe(true);
    });

    it('should call onDone callback', async () => {
      const backend = createMockBackend();
      const chat = new Chat({ backend });

      let doneResponse: any = null;
      await chat.stream('Hi', {
        onDone: (response) => { doneResponse = response; },
      });

      expect(doneResponse).not.toBeNull();
      expect(doneResponse.content).toBe('Hello world');
    });

    it('should call onError on failure', async () => {
      const backend = createMockBackend();
      (backend.executeStream as ReturnType<typeof vi.fn>).mockImplementationOnce(async function* () {
        yield { type: 'start', sequence: 0, metadata: { requestId: 'test', timestamp: Date.now(), provenance: {} } };
        yield { type: 'error', sequence: 1, error: { code: 'ERROR', message: 'Stream failed' } };
      });
      const chat = new Chat({ backend });

      let errorCaught: Error | null = null;
      await expect(chat.stream('Hi', {
        onError: (err) => { errorCaught = err; },
      })).rejects.toThrow();

      expect(errorCaught).not.toBeNull();
    });

    it('should fall back to non-streaming if executeStream not available', async () => {
      const backend = createMockBackend();
      delete (backend as any).executeStream;
      const chat = new Chat({ backend });

      const response = await chat.stream('Hi', {
        onDone: () => {}, // Callback triggers callback mode which returns Promise<ChatResponse>
      });

      expect(response.content).toBe('Mock response');
    });
  });

  describe('state management', () => {
    it('should clear conversation', async () => {
      const backend = createMockBackend();
      const chat = new Chat({ backend });

      await chat.send('Hello');
      expect(chat.messages.length).toBeGreaterThan(0);

      chat.clear();

      expect(chat.messages).toHaveLength(0);
      expect(chat.error).toBeNull();
      expect(chat.totalUsage.totalTokens).toBe(0);
      expect(chat.requestCount).toBe(0);
    });

    it('should add message without sending', () => {
      const backend = createMockBackend();
      const chat = new Chat({ backend });

      chat.addMessage({ role: 'user', content: 'Injected message' });

      expect(chat.messages).toHaveLength(1);
      expect(backend.execute).not.toHaveBeenCalled();
    });

    it('should remove last messages', async () => {
      const backend = createMockBackend();
      const chat = new Chat({ backend });

      await chat.send('Hello');
      expect(chat.messages).toHaveLength(2);

      const removed = chat.removeLastMessages(1);

      expect(removed).toHaveLength(1);
      expect(chat.messages).toHaveLength(1);
    });

    it('should provide state snapshot', async () => {
      const backend = createMockBackend();
      const chat = new Chat({ backend });

      await chat.send('Hello');
      const state = chat.state;

      expect(state.messages).toHaveLength(2);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.requestCount).toBe(1);
    });
  });

  describe('events', () => {
    it('should emit message event', async () => {
      const backend = createMockBackend();
      const chat = new Chat({ backend });

      const messages: any[] = [];
      chat.on('message', (data) => messages.push(data));

      await chat.send('Hello');

      expect(messages).toHaveLength(1);
      expect(messages[0].message.role).toBe('assistant');
    });

    it('should emit state-change event', async () => {
      const backend = createMockBackend();
      const chat = new Chat({ backend });

      let stateChanges = 0;
      chat.on('state-change', () => stateChanges++);

      await chat.send('Hello');

      expect(stateChanges).toBeGreaterThan(0);
    });

    it('should emit error event', async () => {
      const backend = createMockBackend();
      (backend.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Test error'));
      const chat = new Chat({ backend });

      let errorEvent: any = null;
      chat.on('error', (data) => { errorEvent = data; });

      await expect(chat.send('Hello')).rejects.toThrow();

      expect(errorEvent).not.toBeNull();
      expect(errorEvent.error.message).toBe('Test error');
    });

    it('should allow unsubscribing from events', async () => {
      const backend = createMockBackend();
      const chat = new Chat({ backend });

      let count = 0;
      const unsubscribe = chat.on('message', () => count++);

      await chat.send('First');
      expect(count).toBe(1);

      unsubscribe();
      await chat.send('Second');
      expect(count).toBe(1); // Still 1, not incremented
    });
  });
});

// ============================================================================
// Stream Utilities Tests
// ============================================================================

describe('Stream Utilities', () => {
  describe('collectStream', () => {
    it('should collect stream into single result', async () => {
      const stream = createTestStream(['Hello', ' ', 'world']);

      const result = await collectStream(stream);

      expect(result.content).toBe('Hello world');
      expect(result.finishReason).toBe('stop');
      expect(result.chunks.length).toBe(5); // start + 3 content + done
    });

    it('should handle empty stream', async () => {
      async function* emptyStream(): IRChatStream {
        yield { type: 'start', sequence: 0, metadata: { requestId: 'test', timestamp: Date.now(), provenance: {} } };
        yield { type: 'done', sequence: 1, finishReason: 'stop' };
      }

      const result = await collectStream(emptyStream());

      expect(result.content).toBe('');
    });

    it('should throw on error chunk', async () => {
      async function* errorStream(): IRChatStream {
        yield { type: 'start', sequence: 0, metadata: { requestId: 'test', timestamp: Date.now(), provenance: {} } };
        yield { type: 'error', sequence: 1, error: { code: 'ERR', message: 'Failed' } };
      }

      await expect(collectStream(errorStream())).rejects.toThrow('Failed');
    });
  });

  describe('processStream', () => {
    it('should process stream with callbacks', async () => {
      const stream = createTestStream(['A', 'B', 'C']);

      const deltas: string[] = [];
      const accumulated: string[] = [];

      await processStream(stream, {
        onContent: (delta, acc) => {
          deltas.push(delta);
          accumulated.push(acc);
        },
      });

      expect(deltas).toEqual(['A', 'B', 'C']);
      expect(accumulated).toEqual(['A', 'AB', 'ABC']);
    });

    it('should call onStart and onDone', async () => {
      const stream = createTestStream(['X']);

      let started = false;
      let done = false;

      await processStream(stream, {
        onStart: () => { started = true; },
        onDone: () => { done = true; },
      });

      expect(started).toBe(true);
      expect(done).toBe(true);
    });
  });

  describe('streamToText', () => {
    it('should convert stream to text iterator', async () => {
      const stream = createTestStream(['Hello', ' ', 'world']);

      const texts: string[] = [];
      for await (const text of streamToText(stream)) {
        texts.push(text);
      }

      expect(texts).toEqual(['Hello', ' ', 'world']);
    });
  });

  describe('streamToLines', () => {
    it('should yield complete lines', async () => {
      const stream = createTestStream(['Hello\nWorld', '\nEnd']);

      const lines: string[] = [];
      for await (const line of streamToLines(stream)) {
        lines.push(line);
      }

      expect(lines).toEqual(['Hello', 'World', 'End']);
    });

    it('should handle content without newlines', async () => {
      const stream = createTestStream(['No', 'Lines']);

      const lines: string[] = [];
      for await (const line of streamToLines(stream)) {
        lines.push(line);
      }

      expect(lines).toEqual(['NoLines']);
    });
  });

  describe('throttleStream', () => {
    it('should yield all chunks eventually', async () => {
      const stream = createTestStream(['A', 'B', 'C']);

      const chunks: IRStreamChunk[] = [];
      for await (const chunk of throttleStream(stream, 10)) {
        chunks.push(chunk);
      }

      // Should have start, some content (possibly merged), and done
      expect(chunks.some(c => c.type === 'start')).toBe(true);
      expect(chunks.some(c => c.type === 'done')).toBe(true);
    });

    it('should always yield non-content chunks immediately', async () => {
      async function* testStream(): IRChatStream {
        yield { type: 'start', sequence: 0, metadata: { requestId: 'test', timestamp: Date.now(), provenance: {} } };
        yield { type: 'content', sequence: 1, delta: 'A', role: 'assistant' };
        yield { type: 'done', sequence: 2, finishReason: 'stop' };
      }

      const chunks: IRStreamChunk[] = [];
      for await (const chunk of throttleStream(testStream(), 1000)) {
        chunks.push(chunk);
      }

      expect(chunks[0].type).toBe('start');
      expect(chunks[chunks.length - 1].type).toBe('done');
    });
  });

  describe('teeStream', () => {
    it('should split stream into multiple streams', async () => {
      const stream = createTestStream(['Hello']);
      const [stream1, stream2] = teeStream(stream, 2);

      const [result1, result2] = await Promise.all([
        collectStream(stream1),
        collectStream(stream2),
      ]);

      expect(result1.content).toBe('Hello');
      expect(result2.content).toBe('Hello');
    });

    it('should allow independent consumption', async () => {
      const stream = createTestStream(['A', 'B']);
      const [stream1, stream2] = teeStream(stream, 2);

      // Consume first stream completely
      const result1 = await collectStream(stream1);

      // Then consume second stream
      const result2 = await collectStream(stream2);

      expect(result1.content).toBe('AB');
      expect(result2.content).toBe('AB');
    });
  });
});
