/**
 * Integration Tests: Streaming Response Handling
 *
 * Tests streaming functionality across different frontend/backend combinations.
 * These tests demonstrate Phase 4 completion.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { Bridge } from 'ai.matey.core';
import { AnthropicFrontendAdapter } from 'ai.matey.frontend.anthropic';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import {
  collectStream,
  streamToText,
  validateChunkSequence,
  isContentChunk,
  isDoneChunk,
  isErrorChunk,
} from '../../src/utils/streaming.js';
import type { IRStreamChunk } from 'ai.matey.types';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Mock fetch for testing without real API calls.
 */
function createMockStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

/**
 * Create mock Anthropic SSE stream.
 */
function createAnthropicMockStream(): string[] {
  return [
    'event: message_start\n',
    'data: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","model":"claude-3-5-sonnet-20241022","usage":{"input_tokens":10,"output_tokens":0}}}\n',
    '\n',
    'event: content_block_start\n',
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n',
    '\n',
    'event: content_block_delta\n',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n',
    '\n',
    'event: content_block_delta\n',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" from"}}\n',
    '\n',
    'event: content_block_delta\n',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" Anthropic!"}}\n',
    '\n',
    'event: content_block_stop\n',
    'data: {"type":"content_block_stop","index":0}\n',
    '\n',
    'event: message_delta\n',
    'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}\n',
    '\n',
    'event: message_stop\n',
    'data: {"type":"message_stop"}\n',
    '\n',
  ];
}

/**
 * Create mock OpenAI SSE stream.
 */
function createOpenAIMockStream(): string[] {
  return [
    'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n',
    '\n',
    'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n',
    '\n',
    'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"content":" from"},"finish_reason":null}]}\n',
    '\n',
    'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"content":" OpenAI!"},"finish_reason":null}]}\n',
    '\n',
    'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n',
    '\n',
    'data: [DONE]\n',
    '\n',
  ];
}

// ============================================================================
// Test Suite: Anthropic Frontend → Anthropic Backend Streaming
// ============================================================================

describe('Anthropic Frontend → Anthropic Backend Streaming', () => {
  it('should stream response correctly', async () => {
    // Mock fetch to return Anthropic SSE stream
    const originalFetch = global.fetch;
    global.fetch = async () => createMockStreamResponse(createAnthropicMockStream());

    try {
      // Setup adapters
      const frontend = new AnthropicFrontendAdapter();
      const backend = new AnthropicBackendAdapter({
        apiKey: 'test-key',
        baseURL: 'http://localhost:3000',
      });

      // Create bridge
      const bridge = new Bridge(frontend, backend);

      // Create Anthropic-style request
      const anthropicRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user' as const,
            content: 'Hello!',
          },
        ],
        stream: true,
      };

      // Execute streaming request through bridge
      const stream = bridge.chatStream(anthropicRequest);

      // Collect all chunks (Anthropic frontend format, not IR format)
      const chunks: any[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Bridge returns frontend-formatted chunks (Anthropic SSE events)
      // Verify we have the expected Anthropic event types
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some(c => c.type === 'message_start')).toBe(true);
      expect(chunks.some(c => c.type === 'content_block_delta')).toBe(true);
      expect(chunks.some(c => c.type === 'message_stop')).toBe(true);

      // Extract text from content_block_delta events
      const contentDeltas = chunks.filter(c => c.type === 'content_block_delta');
      expect(contentDeltas.length).toBeGreaterThan(0);

      const fullText = contentDeltas
        .map(c => c.delta?.text || '')
        .join('');
      expect(fullText).toBe('Hello from Anthropic!');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should handle stream errors gracefully', async () => {
    // Mock fetch to return error
    const originalFetch = global.fetch;
    global.fetch = async () => {
      return new Response(null, { status: 401, statusText: 'Unauthorized' });
    };

    try {
      const frontend = new AnthropicFrontendAdapter();
      const backend = new AnthropicBackendAdapter({
        apiKey: 'invalid-key',
        baseURL: 'http://localhost:3000',
      });

      const bridge = new Bridge(frontend, backend);

      const anthropicRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user' as const, content: 'Hello!' }],
        stream: true,
      };

      const stream = bridge.chatStream(anthropicRequest);
      const chunks: IRStreamChunk[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Should have at least one error chunk
      const errorChunks = chunks.filter(isErrorChunk);
      expect(errorChunks.length).toBeGreaterThan(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should convert IR stream to Anthropic SSE format', async () => {
    const frontend = new AnthropicFrontendAdapter();
    const backend = new AnthropicBackendAdapter({
      apiKey: 'test-key',
      baseURL: 'http://localhost:3000',
    });

    // Mock IR stream
    async function* createMockIRStream() {
      yield {
        type: 'start' as const,
        sequence: 0,
        metadata: {
          requestId: 'req_123',
          timestamp: Date.now(),
          provenance: { backend: 'anthropic-backend' },
        },
      };
      yield {
        type: 'content' as const,
        sequence: 1,
        delta: 'Hello ',
        role: 'assistant' as const,
      };
      yield {
        type: 'content' as const,
        sequence: 2,
        delta: 'World!',
        role: 'assistant' as const,
      };
      yield {
        type: 'done' as const,
        sequence: 3,
        finishReason: 'stop' as const,
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
      };
    }

    // Convert IR stream to Anthropic format
    const anthropicStream = frontend.fromIRStream(createMockIRStream());
    const anthropicEvents = [];

    for await (const event of anthropicStream) {
      anthropicEvents.push(event);
    }

    // Verify Anthropic event structure
    expect(anthropicEvents.length).toBeGreaterThan(0);
    expect(anthropicEvents[0].type).toBe('message_start');
    expect(anthropicEvents.some(e => e.type === 'content_block_delta')).toBe(true);
    expect(anthropicEvents[anthropicEvents.length - 1].type).toBe('message_stop');
  });
});

// ============================================================================
// Test Suite: OpenAI Frontend → Anthropic Backend Streaming
// ============================================================================

describe('OpenAI Frontend → Anthropic Backend Streaming', () => {
  it('should translate between OpenAI and Anthropic streaming formats', async () => {
    // Mock fetch to return Anthropic SSE stream
    const originalFetch = global.fetch;
    global.fetch = async () => createMockStreamResponse(createAnthropicMockStream());

    try {
      // Setup OpenAI frontend with Anthropic backend
      const frontend = new OpenAIFrontendAdapter();
      const backend = new AnthropicBackendAdapter({
        apiKey: 'test-key',
        baseURL: 'http://localhost:3000',
      });

      const bridge = new Bridge(frontend, backend);

      // Create OpenAI-style request
      const openaiRequest = {
        model: 'gpt-4',
        messages: [
          {
            role: 'system' as const,
            content: 'You are helpful.',
          },
          {
            role: 'user' as const,
            content: 'Hello!',
          },
        ],
        temperature: 0.7,
        stream: true,
      };

      // Execute streaming request
      const stream = bridge.chatStream(openaiRequest);

      // Collect OpenAI-formatted chunks (not IR chunks)
      const chunks: any[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Bridge returns OpenAI SSE format chunks
      // Verify we have proper OpenAI chunk structure
      expect(chunks.length).toBeGreaterThan(0);

      // OpenAI chunks have choices array with delta
      const contentChunks = chunks.filter(c =>
        c.choices?.[0]?.delta?.content
      );
      expect(contentChunks.length).toBeGreaterThan(0);

      // Assemble text from delta content
      const text = contentChunks
        .map(c => c.choices[0].delta.content)
        .join('');

      expect(text).toBe('Hello from Anthropic!');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should handle system message normalization in streaming', async () => {
    const originalFetch = global.fetch;
    let capturedRequestBody: any = null;

    // Mock fetch to capture request and return stream
    global.fetch = async (url, options) => {
      if (options?.body) {
        capturedRequestBody = JSON.parse(options.body as string);
      }
      return createMockStreamResponse(createAnthropicMockStream());
    };

    try {
      const frontend = new OpenAIFrontendAdapter();
      const backend = new AnthropicBackendAdapter({
        apiKey: 'test-key',
        baseURL: 'http://localhost:3000',
      });

      const bridge = new Bridge(frontend, backend);

      const openaiRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'system' as const, content: 'System prompt here.' },
          { role: 'user' as const, content: 'Hello!' },
        ],
        stream: true,
      };

      const stream = bridge.chatStream(openaiRequest);
      const chunks = await collectStream(stream);

      // Verify system message was extracted to Anthropic's system parameter
      expect(capturedRequestBody).toBeDefined();
      expect(capturedRequestBody.system).toBe('System prompt here.');
      expect(capturedRequestBody.messages.length).toBe(1);
      expect(capturedRequestBody.messages[0].role).toBe('user');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

// ============================================================================
// Test Suite: Stream Utility Functions
// ============================================================================

describe('Stream Utility Functions', () => {
  it('should validate chunk sequences correctly', () => {
    const validChunks: IRStreamChunk[] = [
      { type: 'start', sequence: 0, metadata: { requestId: 'req_1', timestamp: Date.now(), provenance: {} } },
      { type: 'content', sequence: 1, delta: 'Hello', role: 'assistant' },
      { type: 'content', sequence: 2, delta: ' World', role: 'assistant' },
      { type: 'done', sequence: 3, finishReason: 'stop' },
    ];

    const validation = validateChunkSequence(validChunks);
    expect(validation.valid).toBe(true);
    expect(validation.gaps).toEqual([]);
    expect(validation.duplicates).toEqual([]);
    expect(validation.outOfOrder).toBe(false);
  });

  it('should detect sequence gaps', () => {
    const chunksWithGap: IRStreamChunk[] = [
      { type: 'start', sequence: 0, metadata: { requestId: 'req_1', timestamp: Date.now(), provenance: {} } },
      { type: 'content', sequence: 1, delta: 'Hello', role: 'assistant' },
      { type: 'content', sequence: 3, delta: ' World', role: 'assistant' }, // Gap at sequence 2
      { type: 'done', sequence: 4, finishReason: 'stop' },
    ];

    const validation = validateChunkSequence(chunksWithGap);
    expect(validation.valid).toBe(false);
    expect(validation.gaps).toContain(2);
  });

  it('should detect duplicate sequences', () => {
    const chunksWithDuplicate: IRStreamChunk[] = [
      { type: 'start', sequence: 0, metadata: { requestId: 'req_1', timestamp: Date.now(), provenance: {} } },
      { type: 'content', sequence: 1, delta: 'Hello', role: 'assistant' },
      { type: 'content', sequence: 1, delta: ' duplicate', role: 'assistant' }, // Duplicate
      { type: 'done', sequence: 2, finishReason: 'stop' },
    ];

    const validation = validateChunkSequence(chunksWithDuplicate);
    expect(validation.valid).toBe(false);
    expect(validation.duplicates).toContain(1);
  });

  it('should detect out-of-order chunks', () => {
    const chunksOutOfOrder: IRStreamChunk[] = [
      { type: 'start', sequence: 0, metadata: { requestId: 'req_1', timestamp: Date.now(), provenance: {} } },
      { type: 'content', sequence: 2, delta: 'World', role: 'assistant' }, // Out of order
      { type: 'content', sequence: 1, delta: 'Hello ', role: 'assistant' },
      { type: 'done', sequence: 3, finishReason: 'stop' },
    ];

    const validation = validateChunkSequence(chunksOutOfOrder);
    expect(validation.valid).toBe(false);
    expect(validation.outOfOrder).toBe(true);
  });

  it('should assemble stream chunks into text', async () => {
    async function* createTestStream() {
      yield { type: 'start' as const, sequence: 0, metadata: { requestId: 'req_1', timestamp: Date.now(), provenance: {} } };
      yield { type: 'content' as const, sequence: 1, delta: 'Hello ', role: 'assistant' as const };
      yield { type: 'content' as const, sequence: 2, delta: 'streaming ', role: 'assistant' as const };
      yield { type: 'content' as const, sequence: 3, delta: 'world!', role: 'assistant' as const };
      yield { type: 'done' as const, sequence: 4, finishReason: 'stop' as const };
    }

    const text = await streamToText(createTestStream());
    expect(text).toBe('Hello streaming world!');
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Streaming Performance', () => {
  it('should handle large streams efficiently', async () => {
    const chunkCount = 1000;

    async function* createLargeStream() {
      yield {
        type: 'start' as const,
        sequence: 0,
        metadata: { requestId: 'req_1', timestamp: Date.now(), provenance: {} },
      };

      for (let i = 1; i <= chunkCount; i++) {
        yield {
          type: 'content' as const,
          sequence: i,
          delta: `chunk${i} `,
          role: 'assistant' as const,
        };
      }

      yield {
        type: 'done' as const,
        sequence: chunkCount + 1,
        finishReason: 'stop' as const,
      };
    }

    const startTime = Date.now();
    const chunks = await collectStream(createLargeStream());
    const duration = Date.now() - startTime;

    expect(chunks.length).toBe(chunkCount + 2); // start + content chunks + done
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });

  it('should validate large streams efficiently', async () => {
    const chunkCount = 1000;

    async function* createLargeStream() {
      for (let i = 0; i <= chunkCount; i++) {
        if (i === 0) {
          yield { type: 'start' as const, sequence: i, metadata: { requestId: 'req_1', timestamp: Date.now(), provenance: {} } };
        } else if (i === chunkCount) {
          yield { type: 'done' as const, sequence: i, finishReason: 'stop' as const };
        } else {
          yield { type: 'content' as const, sequence: i, delta: 'x', role: 'assistant' as const };
        }
      }
    }

    const chunks = await collectStream(createLargeStream());

    const startTime = Date.now();
    const validation = validateChunkSequence(chunks);
    const duration = Date.now() - startTime;

    expect(validation.valid).toBe(true);
    expect(duration).toBeLessThan(100); // Validation should be fast
  });
});
