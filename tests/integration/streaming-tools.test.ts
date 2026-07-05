/**
 * Integration Tests: Streaming Tool-Call Handling
 *
 * Verifies that streamed tool-call deltas flow end-to-end: provider SSE →
 * backend IR chunks → assembled done message → frontend re-emission in
 * native formats, including cross-provider combinations.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { Bridge } from 'ai.matey.core';
import { AnthropicFrontendAdapter, OpenAIFrontendAdapter } from 'ai.matey.frontend';
import { AnthropicBackendAdapter, OpenAIBackendAdapter } from 'ai.matey.backend';
import type { IRChatRequest, IRStreamChunk, StreamToolUseChunk } from 'ai.matey.types';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function makeIRRequest(): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Weather in SF and NYC?' }],
    parameters: { model: 'test-model' },
    stream: true,
    metadata: { requestId: 'req-stream-1', timestamp: Date.now(), provenance: {} },
  };
}

async function collect(stream: AsyncIterable<IRStreamChunk>): Promise<IRStreamChunk[]> {
  const chunks: IRStreamChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

/**
 * OpenAI SSE stream: two parallel tool calls, args split across chunks,
 * trailing include_usage chunk after finish_reason.
 */
function openaiToolCallStream(): string[] {
  const c = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;
  const base = { id: 'chatcmpl-t1', object: 'chat.completion.chunk', created: 1, model: 'gpt-x' };
  return [
    c({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] }),
    c({ ...base, choices: [{ index: 0, delta: { content: 'Checking.' }, finish_reason: null }] }),
    c({
      ...base,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              { index: 0, id: 'call_sf', type: 'function', function: { name: 'get_weather', arguments: '' } },
            ],
          },
          finish_reason: null,
        },
      ],
    }),
    c({
      ...base,
      choices: [
        { index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"loc' } }] }, finish_reason: null },
      ],
    }),
    c({
      ...base,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              { index: 0, function: { arguments: 'ation":"SF"}' } },
              { index: 1, id: 'call_nyc', type: 'function', function: { name: 'get_weather', arguments: '{"location":' } },
            ],
          },
          finish_reason: null,
        },
      ],
    }),
    c({
      ...base,
      choices: [
        { index: 0, delta: { tool_calls: [{ index: 1, function: { arguments: '"NYC"}' } }] }, finish_reason: null },
      ],
    }),
    c({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] }),
    // Trailing usage chunk (stream_options.include_usage)
    c({ ...base, choices: [], usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 } }),
    'data: [DONE]\n\n',
  ];
}

/**
 * Anthropic SSE stream: text block followed by a tool_use block with
 * input_json_delta fragments and stop_reason tool_use.
 */
function anthropicToolUseStream(): string[] {
  const c = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;
  return [
    c({
      type: 'message_start',
      message: {
        id: 'msg_t1',
        type: 'message',
        role: 'assistant',
        model: 'claude-x',
        usage: { input_tokens: 25, output_tokens: 0 },
      },
    }),
    c({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
    c({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Let me check.' } }),
    c({ type: 'content_block_stop', index: 0 }),
    c({
      type: 'content_block_start',
      index: 1,
      content_block: { type: 'tool_use', id: 'toolu_sf', name: 'get_weather', input: {} },
    }),
    c({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"loca' } }),
    c({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: 'tion":"SF"}' } }),
    c({ type: 'content_block_stop', index: 1 }),
    c({ type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 12 } }),
    c({ type: 'message_stop' }),
  ];
}

/** Anthropic stream that ends with max_tokens (regression: stop reason was fabricated). */
function anthropicMaxTokensStream(): string[] {
  const c = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;
  return [
    c({
      type: 'message_start',
      message: {
        id: 'msg_t2',
        type: 'message',
        role: 'assistant',
        model: 'claude-x',
        usage: { input_tokens: 10, output_tokens: 0 },
      },
    }),
    c({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
    c({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Truncat' } }),
    c({ type: 'content_block_stop', index: 0 }),
    c({ type: 'message_delta', delta: { stop_reason: 'max_tokens' }, usage: { output_tokens: 7 } }),
    c({ type: 'message_stop' }),
  ];
}

function withMockFetch<T>(chunks: string[], fn: () => Promise<T>): Promise<T> {
  const originalFetch = global.fetch;
  global.fetch = (() => Promise.resolve(createMockStreamResponse(chunks))) as typeof fetch;
  return fn().finally(() => {
    global.fetch = originalFetch;
  });
}

// ============================================================================
// Backend IR chunk emission
// ============================================================================

describe('OpenAI backend streaming tool calls', () => {
  it('emits tool_use chunks and assembles the done message', async () => {
    await withMockFetch(openaiToolCallStream(), async () => {
      const backend = new OpenAIBackendAdapter({ apiKey: 'test-key' });
      const chunks = await collect(backend.executeStream(makeIRRequest()));

      const toolChunks = chunks.filter(
        (chunk): chunk is StreamToolUseChunk => chunk.type === 'tool_use'
      );
      expect(toolChunks.length).toBeGreaterThan(0);
      // Every tool chunk carries id and name (resolved from accumulation state)
      for (const chunk of toolChunks) {
        expect(chunk.id).toBeTruthy();
        expect(chunk.name).toBe('get_weather');
      }

      const done = chunks.find((chunk) => chunk.type === 'done');
      expect(done).toBeDefined();
      if (done?.type !== 'done') return;

      expect(done.finishReason).toBe('tool_calls');
      // Usage from the trailing include_usage chunk is folded in
      expect(done.usage).toEqual({ promptTokens: 20, completionTokens: 15, totalTokens: 35 });

      expect(done.message?.content).toEqual([
        { type: 'text', text: 'Checking.' },
        { type: 'tool_use', id: 'call_sf', name: 'get_weather', input: { location: 'SF' } },
        { type: 'tool_use', id: 'call_nyc', name: 'get_weather', input: { location: 'NYC' } },
      ]);
    });
  });

  it('sends stream_options.include_usage on streaming requests', () => {
    const backend = new OpenAIBackendAdapter({ apiKey: 'test-key' });
    const wire = backend.fromIR(makeIRRequest());
    expect(wire.stream_options).toEqual({ include_usage: true });
  });
});

describe('Anthropic backend streaming tool use', () => {
  it('emits tool_use chunks and assembles the done message', async () => {
    await withMockFetch(anthropicToolUseStream(), async () => {
      const backend = new AnthropicBackendAdapter({ apiKey: 'test-key' });
      const chunks = await collect(backend.executeStream(makeIRRequest()));

      const toolChunks = chunks.filter(
        (chunk): chunk is StreamToolUseChunk => chunk.type === 'tool_use'
      );
      // Announce chunk + two argument fragments
      expect(toolChunks).toHaveLength(3);
      expect(toolChunks[0]).toMatchObject({ id: 'toolu_sf', name: 'get_weather', inputDelta: '' });
      expect(toolChunks[1]?.inputDelta).toBe('{"loca');
      expect(toolChunks[2]?.inputDelta).toBe('tion":"SF"}');

      const done = chunks.find((chunk) => chunk.type === 'done');
      if (done?.type !== 'done') {
        expect.fail('missing done chunk');
      }
      expect(done.finishReason).toBe('tool_calls');
      expect(done.usage).toEqual({ promptTokens: 25, completionTokens: 12, totalTokens: 37 });
      expect(done.message?.content).toEqual([
        { type: 'text', text: 'Let me check.' },
        { type: 'tool_use', id: 'toolu_sf', name: 'get_weather', input: { location: 'SF' } },
      ]);
    });
  });

  it('reports the real stop reason (max_tokens regression)', async () => {
    await withMockFetch(anthropicMaxTokensStream(), async () => {
      const backend = new AnthropicBackendAdapter({ apiKey: 'test-key' });
      const chunks = await collect(backend.executeStream(makeIRRequest()));

      const done = chunks.find((chunk) => chunk.type === 'done');
      if (done?.type !== 'done') {
        expect.fail('missing done chunk');
      }
      expect(done.finishReason).toBe('length');
      expect(done.usage).toEqual({ promptTokens: 10, completionTokens: 7, totalTokens: 17 });
    });
  });
});

// ============================================================================
// Cross-provider round trips through the Bridge
// ============================================================================

describe('Cross-provider streaming tool calls', () => {
  it('Anthropic backend → OpenAI frontend re-emits index-based tool_calls deltas', async () => {
    await withMockFetch(anthropicToolUseStream(), async () => {
      const bridge = new Bridge(
        new OpenAIFrontendAdapter(),
        new AnthropicBackendAdapter({ apiKey: 'test-key' })
      );

      const chunks: any[] = [];
      for await (const chunk of bridge.chatStream({
        model: 'gpt-x',
        messages: [{ role: 'user', content: 'Weather in SF?' }],
        stream: true,
      })) {
        chunks.push(chunk);
      }

      const toolDeltas = chunks
        .flatMap((chunk) => chunk.choices?.[0]?.delta?.tool_calls ?? [])
        .filter(Boolean);
      expect(toolDeltas.length).toBeGreaterThan(0);

      // First delta announces id/name; later deltas carry only arguments
      expect(toolDeltas[0]).toMatchObject({
        index: 0,
        id: 'toolu_sf',
        type: 'function',
        function: { name: 'get_weather' },
      });
      const args = toolDeltas.map((d: any) => d.function?.arguments ?? '').join('');
      expect(JSON.parse(args)).toEqual({ location: 'SF' });

      const finish = chunks.find((chunk) => chunk.choices?.[0]?.finish_reason);
      expect(finish?.choices[0].finish_reason).toBe('tool_calls');
    });
  });

  it('OpenAI backend → Anthropic frontend re-emits content_block tool_use events', async () => {
    await withMockFetch(openaiToolCallStream(), async () => {
      const bridge = new Bridge(
        new AnthropicFrontendAdapter(),
        new OpenAIBackendAdapter({ apiKey: 'test-key' })
      );

      const events: any[] = [];
      for await (const event of bridge.chatStream({
        model: 'claude-x',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Weather in SF and NYC?' }],
        stream: true,
      })) {
        events.push(event);
      }

      // Text block at index 0, tool blocks at 1 and 2
      const blockStarts = events.filter((event) => event.type === 'content_block_start');
      expect(blockStarts.map((event) => event.content_block.type)).toEqual([
        'text',
        'tool_use',
        'tool_use',
      ]);
      expect(blockStarts[1].content_block).toMatchObject({ id: 'call_sf', name: 'get_weather' });

      const jsonDeltas = events.filter(
        (event) =>
          event.type === 'content_block_delta' && event.delta.type === 'input_json_delta'
      );
      const sfArgs = jsonDeltas
        .filter((event) => event.index === 1)
        .map((event) => event.delta.partial_json)
        .join('');
      expect(JSON.parse(sfArgs)).toEqual({ location: 'SF' });

      const messageDelta = events.find((event) => event.type === 'message_delta');
      expect(messageDelta?.delta.stop_reason).toBe('tool_use');

      // Every opened block is closed exactly once
      const stops = events.filter((event) => event.type === 'content_block_stop');
      expect(stops).toHaveLength(blockStarts.length);
    });
  });

  it('tool-only Anthropic stream does not fabricate an empty text block', async () => {
    const toolOnly = anthropicToolUseStream().filter(
      (line) => !line.includes('"text_delta"') && !(line.includes('"index":0') && line.includes('content_block'))
    );
    await withMockFetch(toolOnly, async () => {
      const bridge = new Bridge(
        new AnthropicFrontendAdapter(),
        new AnthropicBackendAdapter({ apiKey: 'test-key' })
      );

      const events: any[] = [];
      for await (const event of bridge.chatStream({
        model: 'claude-x',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Weather in SF?' }],
        stream: true,
      })) {
        events.push(event);
      }

      const blockStarts = events.filter((event) => event.type === 'content_block_start');
      expect(blockStarts).toHaveLength(1);
      expect(blockStarts[0].content_block.type).toBe('tool_use');
    });
  });

  it('malformed streamed tool arguments degrade to empty object', async () => {
    const c = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;
    const base = { id: 'chatcmpl-bad', object: 'chat.completion.chunk', created: 1, model: 'gpt-x' };
    const malformed = [
      c({
        ...base,
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                { index: 0, id: 'call_bad', type: 'function', function: { name: 'get_weather', arguments: '{"loc' } },
              ],
            },
            finish_reason: null,
          },
        ],
      }),
      c({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] }),
      'data: [DONE]\n\n',
    ];

    await withMockFetch(malformed, async () => {
      const backend = new OpenAIBackendAdapter({ apiKey: 'test-key' });
      const chunks = await collect(backend.executeStream(makeIRRequest()));

      const done = chunks.find((chunk) => chunk.type === 'done');
      if (done?.type !== 'done') {
        expect.fail('missing done chunk');
      }
      expect(done.message?.content).toEqual([
        { type: 'tool_use', id: 'call_bad', name: 'get_weather', input: {} },
      ]);
    });
  });
});
