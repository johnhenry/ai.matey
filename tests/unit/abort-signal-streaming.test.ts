/**
 * AbortSignal Streaming Tests
 *
 * Tests that AbortSignal is properly checked inside streaming loops
 * in Bridge, Router, and Chat (wrapper) classes.
 */

import { describe, it, expect, vi } from 'vitest';
import { Bridge } from 'ai.matey.core';
import type {
  FrontendAdapter,
  BackendAdapter,
  IRChatRequest,
  IRChatResponse,
  IRStreamChunk,
} from 'ai.matey.types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockFrontend(): FrontendAdapter {
  return {
    metadata: {
      name: 'mock-frontend',
      version: '1.0.0',
      provider: 'Mock',
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: false,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: true,
      },
    },
    toIR: vi.fn((request: any) => ({
      messages: request.messages || [],
      metadata: {
        requestId: 'test-req-id',
        timestamp: Date.now(),
        provenance: {},
      },
    })),
    fromIR: vi.fn((response: IRChatResponse) => ({
      id: response.metadata.requestId,
      content: response.message.content,
    })),
    fromIRStream: vi.fn(async function* (stream) {
      for await (const chunk of stream) {
        yield chunk;
      }
    }),
  } as unknown as FrontendAdapter;
}

/**
 * Create a mock backend that yields many chunks with a controllable delay.
 * This allows us to abort mid-stream.
 */
function createSlowMockBackend(chunkCount: number = 10): BackendAdapter {
  return {
    metadata: {
      name: 'mock-backend',
      version: '1.0.0',
      provider: 'Mock',
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: false,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: true,
      },
    },
    fromIR: vi.fn((request) => request),
    toIR: vi.fn((response) => response),
    execute: vi.fn(async (request: IRChatRequest) => {
      return {
        message: { role: 'assistant', content: 'Hello!' },
        finishReason: 'stop',
        metadata: {
          requestId: request.metadata.requestId,
          provenance: { backend: 'mock-backend' },
        },
      } as IRChatResponse;
    }),
    executeStream: vi.fn(async function* () {
      yield { type: 'start', sequence: 0 } as IRStreamChunk;
      for (let i = 1; i <= chunkCount; i++) {
        yield {
          type: 'content',
          sequence: i,
          delta: `chunk${i} `,
          role: 'assistant',
        } as IRStreamChunk;
      }
      yield {
        type: 'done',
        sequence: chunkCount + 1,
        finishReason: 'stop',
        message: { role: 'assistant', content: 'complete' },
      } as IRStreamChunk;
    }),
  } as unknown as BackendAdapter;
}

// ============================================================================
// Bridge.chatStream AbortSignal Tests
// ============================================================================

describe('Bridge.chatStream AbortSignal support', () => {
  it('should stop yielding chunks when signal is aborted mid-stream', async () => {
    const frontend = createMockFrontend();
    const backend = createSlowMockBackend(20);
    const bridge = new Bridge(frontend, backend);

    const controller = new AbortController();
    const chunks: any[] = [];

    const stream = bridge.chatStream(
      { messages: [{ role: 'user', content: 'Hello' }] } as any,
      { signal: controller.signal }
    );

    let count = 0;
    for await (const chunk of stream) {
      chunks.push(chunk);
      count++;
      // Abort after receiving 3 chunks
      if (count >= 3) {
        controller.abort();
      }
    }

    // Should have stopped early -- not all 22 chunks (start + 20 content + done)
    expect(chunks.length).toBeLessThan(22);
    // Should have at least the 3 we consumed before aborting
    expect(chunks.length).toBeGreaterThanOrEqual(3);
  });

  it('should not yield any chunks when signal is already aborted', async () => {
    const frontend = createMockFrontend();
    const backend = createSlowMockBackend(10);
    const bridge = new Bridge(frontend, backend);

    const controller = new AbortController();
    controller.abort(); // Pre-abort

    const chunks: any[] = [];
    const stream = bridge.chatStream(
      { messages: [{ role: 'user', content: 'Hello' }] } as any,
      { signal: controller.signal }
    );

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    // Should yield zero chunks since signal was already aborted
    expect(chunks.length).toBe(0);
  });

  it('should yield all chunks when no signal is provided', async () => {
    const frontend = createMockFrontend();
    const backend = createSlowMockBackend(5);
    const bridge = new Bridge(frontend, backend);

    const chunks: any[] = [];
    const stream = bridge.chatStream(
      { messages: [{ role: 'user', content: 'Hello' }] } as any,
    );

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    // Should receive all chunks: start + 5 content + done = 7
    expect(chunks.length).toBe(7);
  });

  it('should yield all chunks when signal is never aborted', async () => {
    const frontend = createMockFrontend();
    const backend = createSlowMockBackend(5);
    const bridge = new Bridge(frontend, backend);

    const controller = new AbortController();
    const chunks: any[] = [];
    const stream = bridge.chatStream(
      { messages: [{ role: 'user', content: 'Hello' }] } as any,
      { signal: controller.signal }
    );

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    // Should receive all chunks: start + 5 content + done = 7
    expect(chunks.length).toBe(7);
  });
});

// ============================================================================
// Wrapper Chat.stream AbortSignal Tests
// ============================================================================

describe('Chat.stream (wrapper) AbortSignal support', () => {
  it('should stop streaming when signal is aborted mid-stream', async () => {
    const { Chat } = await import('ai.matey.wrapper');

    const mockBackend = {
      execute: vi.fn(async () => ({
        message: { role: 'assistant', content: 'Hello' },
        finishReason: 'stop',
        metadata: { requestId: 'req_1', provenance: {} },
      })),
      executeStream: vi.fn(async function* () {
        for (let i = 0; i < 20; i++) {
          yield {
            type: 'content' as const,
            sequence: i,
            delta: `word${i} `,
            role: 'assistant' as const,
          };
        }
        yield {
          type: 'done' as const,
          sequence: 20,
          finishReason: 'stop' as const,
          message: { role: 'assistant' as const, content: 'complete' },
        };
      }),
    };

    const chat = new Chat({
      backend: mockBackend,
    });

    const controller = new AbortController();
    const chunks: any[] = [];

    const stream = chat.stream('Hello', { signal: controller.signal });

    // stream() returns AsyncGenerator when no callbacks
    let count = 0;
    for await (const chunk of stream as AsyncGenerator<any>) {
      chunks.push(chunk);
      count++;
      if (count >= 3) {
        controller.abort();
      }
    }

    // Should have stopped before receiving all 20 content chunks
    expect(chunks.length).toBeLessThan(20);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
  });
});
