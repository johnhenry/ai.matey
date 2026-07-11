/**
 * LiteRT-LM backend adapter tests
 *
 * @litert-lm/core is browser/WebGPU-only, so these tests exercise the adapter
 * through its `engineModule` injection seam with a scripted fake engine.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LiteRtLmBackendAdapter,
  clearLiteRtLmEngineCache,
  type LiteRtLmModule,
} from 'ai.matey.backend.browser';
import type { IRChatRequest, StreamContentChunk } from 'ai.matey.types';

// ============================================================================
// Fake engine
// ============================================================================

interface FakeState {
  createCalls: Array<{ model: unknown; maxNumTokens?: number }>;
  conversations: Array<{
    preface?: { messages: Array<{ role: string; content: string }> };
    sent: string[];
    cancelled: boolean;
  }>;
  deleted: number;
}

function makeFakeModule(
  replyChunks: string[] = ['Hello', ' from', ' Gemma'],
  options: { delayMs?: number } = {}
): { module: LiteRtLmModule; state: FakeState } {
  const state: FakeState = { createCalls: [], conversations: [], deleted: 0 };

  const module: LiteRtLmModule = {
    Engine: {
      // eslint-disable-next-line @typescript-eslint/require-await -- fake SDK surface
      create: async (createOptions) => {
        state.createCalls.push({
          model: createOptions.model,
          maxNumTokens: createOptions.mainExecutorSettings?.maxNumTokens,
        });
        return {
          // eslint-disable-next-line @typescript-eslint/require-await -- fake SDK surface
          createConversation: async (conversationOptions) => {
            const record = {
              preface: conversationOptions?.preface,
              sent: [] as string[],
              cancelled: false,
            };
            state.conversations.push(record);
            return {
              // eslint-disable-next-line @typescript-eslint/require-await -- fake SDK surface
              sendMessage: async (text: string) => {
                record.sent.push(text);
                return { content: [{ type: 'text', text: replyChunks.join('') }] };
              },
              sendMessageStreaming: (text: string) => {
                record.sent.push(text);
                return (async function* () {
                  for (const chunk of replyChunks) {
                    if (options.delayMs) {
                      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
                    }
                    yield { content: [{ type: 'text', text: chunk }] };
                  }
                })();
              },
              cancel: () => {
                record.cancelled = true;
              },
            };
          },
          // eslint-disable-next-line @typescript-eslint/require-await -- fake SDK surface
          delete: async () => {
            state.deleted++;
          },
        };
      },
    },
  };

  return { module, state };
}

function makeRequest(overrides: Partial<IRChatRequest> = {}): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hi there' }],
    parameters: {},
    metadata: { requestId: 'r1', timestamp: Date.now(), provenance: {} },
    ...overrides,
  };
}

beforeEach(() => {
  clearLiteRtLmEngineCache();
});

// ============================================================================
// Tests
// ============================================================================

describe('LiteRtLmBackendAdapter', () => {
  it('streams content chunks and assembles the done message', async () => {
    const { module } = makeFakeModule(['One', ' two', ' three']);
    const adapter = new LiteRtLmBackendAdapter({ model: 'https://x/m.litertlm', engineModule: module });

    const chunks = [];
    for await (const chunk of adapter.executeStream(makeRequest())) {
      chunks.push(chunk);
    }

    const deltas = chunks
      .filter((chunk): chunk is StreamContentChunk => chunk.type === 'content')
      .map((chunk) => chunk.delta);
    expect(deltas).toEqual(['One', ' two', ' three']);

    const done = chunks.find((chunk) => chunk.type === 'done');
    expect(done?.type === 'done' && done.message?.content).toBe('One two three');
    expect(done?.type === 'done' && done.finishReason).toBe('stop');
  });

  it('execute() consumes the stream into a response', async () => {
    const { module } = makeFakeModule(['Complete answer']);
    const adapter = new LiteRtLmBackendAdapter({ model: 'https://x/m.litertlm', engineModule: module });

    const response = await adapter.execute(makeRequest());
    expect(response.message.content).toBe('Complete answer');
    expect(response.metadata.provenance?.backend).toBe('litert-lm-backend');
  });

  it('maps system messages to the conversation preface', async () => {
    const { module, state } = makeFakeModule();
    const adapter = new LiteRtLmBackendAdapter({ model: 'https://x/m.litertlm', engineModule: module });

    await adapter.execute(
      makeRequest({
        messages: [
          { role: 'system', content: 'You are terse.' },
          { role: 'user', content: 'Hi' },
        ],
      })
    );

    expect(state.conversations[0]?.preface?.messages).toEqual([
      { role: 'system', content: 'You are terse.' },
    ]);
    expect(state.conversations[0]?.sent).toEqual(['Hi']);
  });

  it('flattens prior turns into a transcript prefix with a warning', async () => {
    const { module, state } = makeFakeModule();
    const adapter = new LiteRtLmBackendAdapter({ model: 'https://x/m.litertlm', engineModule: module });

    const response = await adapter.execute(
      makeRequest({
        messages: [
          { role: 'user', content: 'What is 2+2?' },
          { role: 'assistant', content: '4' },
          { role: 'user', content: 'And doubled?' },
        ],
      })
    );

    const sent = state.conversations[0]?.sent[0] ?? '';
    expect(sent).toContain('Previous conversation:');
    expect(sent).toContain('User: What is 2+2?');
    expect(sent).toContain('Assistant: 4');
    expect(sent).toContain('User: And doubled?');

    expect(
      response.metadata.warnings?.some((warning) => warning.category === 'system-message-transformed')
    ).toBe(true);
  });

  it('warns when dropping unsupported parameters, tools, and non-text content', async () => {
    const { module } = makeFakeModule();
    const adapter = new LiteRtLmBackendAdapter({ model: 'https://x/m.litertlm', engineModule: module });

    const response = await adapter.execute(
      makeRequest({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this' },
              { type: 'image', source: { type: 'url', url: 'https://x/cat.png' } },
            ],
          },
        ],
        parameters: { temperature: 0.7, topK: 40 },
        tools: [
          { name: 'noop', description: '', parameters: { type: 'object', properties: {} } },
        ],
      })
    );

    const categories = (response.metadata.warnings ?? []).map((warning) => warning.category);
    expect(categories).toContain('parameter-unsupported');
    expect(categories).toContain('tool-unsupported');
    expect(categories).toContain('content-type-unsupported');
  });

  it('cancels the conversation on abort', async () => {
    const { module, state } = makeFakeModule(['a', 'b', 'c', 'd'], { delayMs: 10 });
    const adapter = new LiteRtLmBackendAdapter({ model: 'https://x/m.litertlm', engineModule: module });

    const controller = new AbortController();
    const chunks = [];
    for await (const chunk of adapter.executeStream(makeRequest(), controller.signal)) {
      chunks.push(chunk);
      if (chunks.filter((c) => c.type === 'content').length === 1) {
        controller.abort();
      }
    }

    expect(state.conversations[0]?.cancelled).toBe(true);
    expect(chunks.at(-1)?.type).toBe('error');
  });

  it('caches one engine per model URL across adapter instances', async () => {
    const { module, state } = makeFakeModule();
    const first = new LiteRtLmBackendAdapter({ model: 'https://x/same.litertlm', engineModule: module });
    const second = new LiteRtLmBackendAdapter({ model: 'https://x/same.litertlm', engineModule: module });

    await first.execute(makeRequest());
    await second.execute(makeRequest());

    expect(state.createCalls).toHaveLength(1);
    expect(state.createCalls[0]?.maxNumTokens).toBe(8192);
  });

  it('dispose() deletes the engine and clears the cache entry', async () => {
    const { module, state } = makeFakeModule();
    const adapter = new LiteRtLmBackendAdapter({ model: 'https://x/m.litertlm', engineModule: module });

    await adapter.execute(makeRequest());
    await adapter.dispose();
    expect(state.deleted).toBe(1);

    await adapter.execute(makeRequest());
    expect(state.createCalls).toHaveLength(2); // cache entry was cleared
  });

  it('yields a friendly error when the peer module is missing', async () => {
    const adapter = new LiteRtLmBackendAdapter({ model: 'https://x/m.litertlm' });

    const chunks = [];
    for await (const chunk of adapter.executeStream(makeRequest())) {
      chunks.push(chunk);
    }

    const error = chunks.find((chunk) => chunk.type === 'error');
    expect(error?.type === 'error' && error.error.message).toContain('@litert-lm/core');
  });

  it('advertises accurate capabilities', () => {
    const adapter = new LiteRtLmBackendAdapter({ model: 'https://x/m.litertlm' });
    const caps = adapter.metadata.capabilities;

    expect(caps.streaming).toBe(true);
    expect(caps.tools).toBe(false);
    expect(caps.multiModal).toBe(false);
    expect(caps.supportsTemperature).toBe(false);
  });
});
