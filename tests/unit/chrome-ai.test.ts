/**
 * Chrome AI backend adapter tests
 *
 * The Prompt API (`LanguageModel` global) is Chrome-only, so these tests
 * exercise the adapter through its `languageModel` injection seam with a
 * scripted fake, following the same pattern as `litert-lm.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { ChromeAIBackendAdapter } from 'ai.matey.backend.browser';
import type {
  LanguageModelAPI,
  LanguageModelAvailability,
  LanguageModelCreateOptions,
  LanguageModelPromptOptions,
  LanguageModelSession,
} from 'ai.matey.backend.browser';
import type { IRChatRequest, StreamContentChunk, StreamErrorChunk } from 'ai.matey.types';

// ============================================================================
// Fake LanguageModel
// ============================================================================

interface FakeState {
  createCalls: LanguageModelCreateOptions[];
  promptCalls: Array<{ input: string; options?: LanguageModelPromptOptions }>;
  destroyed: number;
}

function makeFakeLanguageModel(
  options: {
    availability?: LanguageModelAvailability;
    replyText?: string;
    streamChunks?: string[];
    inputUsage?: number;
    inputQuota?: number;
  } = {}
): { languageModel: LanguageModelAPI; state: FakeState } {
  const state: FakeState = { createCalls: [], promptCalls: [], destroyed: 0 };

  const session: LanguageModelSession = {
    inputUsage: options.inputUsage,
    inputQuota: options.inputQuota,
    // eslint-disable-next-line @typescript-eslint/require-await -- fake SDK surface
    prompt: async (input, promptOptions) => {
      state.promptCalls.push({ input, options: promptOptions });
      return options.replyText ?? 'Hello!';
    },
    promptStreaming: (input, promptOptions) => {
      state.promptCalls.push({ input, options: promptOptions });
      const chunks = options.streamChunks ?? ['Hello', '!'];
      return new ReadableStream<string>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });
    },
    destroy: () => {
      state.destroyed++;
    },
  };

  const languageModel: LanguageModelAPI = {
    // eslint-disable-next-line @typescript-eslint/require-await -- fake SDK surface
    availability: async () => options.availability ?? 'available',
    // eslint-disable-next-line @typescript-eslint/require-await -- fake SDK surface
    create: async (createOptions) => {
      state.createCalls.push(createOptions ?? {});
      return session;
    },
  };

  return { languageModel, state };
}

function makeRequest(overrides: Partial<IRChatRequest> = {}): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hi there' }],
    parameters: {},
    metadata: { requestId: 'r1', timestamp: Date.now(), provenance: {} },
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ChromeAIBackendAdapter', () => {
  describe('checkAvailability / healthCheck', () => {
    it('reports the underlying tri-state availability', async () => {
      const { languageModel } = makeFakeLanguageModel({ availability: 'downloadable' });
      const adapter = new ChromeAIBackendAdapter({ languageModel });
      expect(await adapter.checkAvailability()).toBe('downloadable');
    });

    it('reports unavailable when no LanguageModel global is present', async () => {
      const adapter = new ChromeAIBackendAdapter({});
      expect(await adapter.checkAvailability()).toBe('unavailable');
      expect(await adapter.healthCheck()).toBe(false);
    });

    it('healthCheck is true for any state other than unavailable', async () => {
      const { languageModel } = makeFakeLanguageModel({ availability: 'downloading' });
      const adapter = new ChromeAIBackendAdapter({ languageModel });
      expect(await adapter.healthCheck()).toBe(true);
    });
  });

  describe('execute()', () => {
    it('maps multi-turn history to initialPrompts and the last message to prompt()', async () => {
      const { languageModel, state } = makeFakeLanguageModel({ replyText: 'Four' });
      const adapter = new ChromeAIBackendAdapter({ languageModel });

      const response = await adapter.execute(
        makeRequest({
          messages: [
            { role: 'system', content: 'You are terse.' },
            { role: 'user', content: 'What is 2+2?' },
            { role: 'assistant', content: '4' },
            { role: 'user', content: 'And doubled?' },
          ],
        })
      );

      expect(state.createCalls[0]?.initialPrompts).toEqual([
        { role: 'system', content: 'You are terse.' },
        { role: 'user', content: 'What is 2+2?' },
        { role: 'assistant', content: '4' },
      ]);
      expect(state.promptCalls[0]?.input).toBe('And doubled?');
      expect(response.message.content).toBe('Four');
      expect(response.metadata.provenance?.backend).toBe('chrome-ai-backend');
    });

    it('maps responseFormat to responseConstraint and marks responseFormatEnforced', async () => {
      const { languageModel, state } = makeFakeLanguageModel();
      const adapter = new ChromeAIBackendAdapter({ languageModel });

      const schema = {
        type: 'object' as const,
        properties: { answer: { type: 'string' as const } },
        required: ['answer'],
      };

      const response = await adapter.execute(
        makeRequest({ responseFormat: { type: 'json_schema', schema } })
      );

      expect(state.promptCalls[0]?.options?.responseConstraint).toEqual(schema);
      expect(response.metadata.custom?.responseFormatEnforced).toBe(true);
    });

    it('omits responseFormatEnforced when no responseFormat is requested', async () => {
      const { languageModel } = makeFakeLanguageModel();
      const adapter = new ChromeAIBackendAdapter({ languageModel });
      const response = await adapter.execute(makeRequest());
      expect(response.metadata.custom?.responseFormatEnforced).toBeUndefined();
    });

    it('surfaces inputUsage/inputQuota under metadata.custom when available', async () => {
      const { languageModel } = makeFakeLanguageModel({ inputUsage: 42, inputQuota: 4096 });
      const adapter = new ChromeAIBackendAdapter({ languageModel });
      const response = await adapter.execute(makeRequest());
      expect(response.metadata.custom?.inputUsage).toBe(42);
      expect(response.metadata.custom?.inputQuota).toBe(4096);
    });

    it('omits inputUsage/inputQuota when the session does not report them', async () => {
      const { languageModel } = makeFakeLanguageModel();
      const adapter = new ChromeAIBackendAdapter({ languageModel });
      const response = await adapter.execute(makeRequest());
      expect(response.metadata.custom?.inputUsage).toBeUndefined();
    });

    it('warns when tools are requested (not supported)', async () => {
      const { languageModel } = makeFakeLanguageModel();
      const adapter = new ChromeAIBackendAdapter({ languageModel });

      const response = await adapter.execute(
        makeRequest({
          tools: [{ name: 'noop', description: '', parameters: { type: 'object', properties: {} } }],
        })
      );

      expect(
        response.metadata.warnings?.some((warning) => warning.category === 'tool-unsupported')
      ).toBe(true);
    });

    it('warns when the last message is not role:user', async () => {
      const { languageModel } = makeFakeLanguageModel();
      const adapter = new ChromeAIBackendAdapter({ languageModel });

      const response = await adapter.execute(
        makeRequest({
          messages: [
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello!' },
          ],
        })
      );

      expect(
        response.metadata.warnings?.some(
          (warning) => warning.category === 'system-message-transformed'
        )
      ).toBe(true);
    });

    it('warns and drops non-text content blocks', async () => {
      const { languageModel } = makeFakeLanguageModel();
      const adapter = new ChromeAIBackendAdapter({ languageModel });

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
        })
      );

      expect(
        response.metadata.warnings?.some((warning) => warning.category === 'content-type-unsupported')
      ).toBe(true);
    });

    it('destroys the session after use', async () => {
      const { languageModel, state } = makeFakeLanguageModel();
      const adapter = new ChromeAIBackendAdapter({ languageModel });
      await adapter.execute(makeRequest());
      expect(state.destroyed).toBe(1);
    });

    it('throws a ProviderError when unavailable', async () => {
      const { languageModel } = makeFakeLanguageModel({ availability: 'unavailable' });
      const adapter = new ChromeAIBackendAdapter({ languageModel });
      await expect(adapter.execute(makeRequest())).rejects.toThrow(/unavailable/i);
    });
  });

  describe('executeStream()', () => {
    it('streams content chunks and assembles the done message', async () => {
      const { languageModel } = makeFakeLanguageModel({ streamChunks: ['One', ' two', ' three'] });
      const adapter = new ChromeAIBackendAdapter({ languageModel });

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

    it('includes warnings on the start chunk', async () => {
      const { languageModel } = makeFakeLanguageModel();
      const adapter = new ChromeAIBackendAdapter({ languageModel });

      const chunks = [];
      for await (const chunk of adapter.executeStream(
        makeRequest({
          tools: [{ name: 'noop', description: '', parameters: { type: 'object', properties: {} } }],
        })
      )) {
        chunks.push(chunk);
      }

      const start = chunks.find((chunk) => chunk.type === 'start');
      expect(
        start?.type === 'start' &&
          start.metadata.warnings?.some((warning) => warning.category === 'tool-unsupported')
      ).toBe(true);
    });

    it('yields an error chunk when unavailable', async () => {
      const { languageModel } = makeFakeLanguageModel({ availability: 'unavailable' });
      const adapter = new ChromeAIBackendAdapter({ languageModel });

      const chunks = [];
      for await (const chunk of adapter.executeStream(makeRequest())) {
        chunks.push(chunk);
      }

      const error = chunks.find((chunk): chunk is StreamErrorChunk => chunk.type === 'error');
      expect(error?.error.message).toMatch(/unavailable/i);
    });

    it('destroys the session after streaming completes', async () => {
      const { languageModel, state } = makeFakeLanguageModel({ streamChunks: ['a', 'b'] });
      const adapter = new ChromeAIBackendAdapter({ languageModel });

      for await (const _chunk of adapter.executeStream(makeRequest())) {
        // drain
      }

      expect(state.destroyed).toBe(1);
    });
  });
});
