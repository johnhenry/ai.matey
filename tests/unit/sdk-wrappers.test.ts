import { describe, it, expect, beforeEach } from 'vitest';
import {
  OpenAI,
  OpenAIClient,
  Chat,
  ChatCompletions,
} from '../../src/wrappers/openai-sdk.js';
import {
  Anthropic,
  AnthropicClient,
  Messages,
} from '../../src/wrappers/anthropic-sdk.js';
import { MockBackendAdapter } from '../../src/adapters/backend/mock.js';
import { OpenAIFrontendAdapter } from '../../src/adapters/frontend/openai.js';
import { AnthropicFrontendAdapter } from '../../src/adapters/frontend/anthropic.js';
import { Bridge } from '../../src/core/bridge.js';

describe('SDK Wrappers', () => {
  describe('OpenAI SDK Wrapper', () => {
    let bridge: Bridge<OpenAIFrontendAdapter>;
    let client: OpenAIClient;

    beforeEach(() => {
      const frontend = new OpenAIFrontendAdapter();
      const backend = new MockBackendAdapter({
        responseDelay: 0,
      });
      bridge = new Bridge(frontend, backend);
      client = OpenAI(backend);
    });

    describe('OpenAI Constructor', () => {
      it('should create client with backend adapter', () => {
        const backend = new MockBackendAdapter();
        const openai = OpenAI(backend);

        expect(openai).toBeInstanceOf(OpenAIClient);
      });

      it('should have chat property', () => {
        expect(client).toHaveProperty('chat');
        expect(client.chat).toBeInstanceOf(Chat);
      });

      it('should have completions property', () => {
        expect(client.chat).toHaveProperty('completions');
        expect(client.chat.completions).toBeInstanceOf(ChatCompletions);
      });
    });

    describe('OpenAI chat.completions.create()', () => {
      it('should create completion', async () => {
        const response = await client.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'user',
              content: 'Hello!',
            },
          ],
        });

        expect(response).toBeDefined();
        expect(response.choices).toBeDefined();
        expect(response.choices.length).toBeGreaterThan(0);
        expect(response.choices[0].message).toBeDefined();
        expect(response.choices[0].message.role).toBe('assistant');
      });

      it('should support temperature parameter', async () => {
        const response = await client.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
          temperature: 0.7,
        });

        expect(response).toBeDefined();
      });

      it('should support max_tokens parameter', async () => {
        const response = await client.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 100,
        });

        expect(response).toBeDefined();
      });

      it('should support top_p parameter', async () => {
        const response = await client.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
          top_p: 0.9,
        });

        expect(response).toBeDefined();
      });

      it('should support system messages', async () => {
        const response = await client.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'Hello' },
          ],
        });

        expect(response).toBeDefined();
      });

      it('should include usage information', async () => {
        const response = await client.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response.usage).toBeDefined();
        expect(response.usage?.total_tokens).toBeGreaterThan(0);
      });

      it('should have unique id', async () => {
        const response = await client.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response.id).toBeDefined();
        expect(typeof response.id).toBe('string');
      });

      it('should have model field', async () => {
        const response = await client.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response.model).toBeDefined();
      });
    });

    describe('OpenAI Streaming', () => {
      it('should support streaming with stream: true', async () => {
        const stream = await client.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
          stream: true,
        });

        expect(stream).toBeDefined();
        expect(Symbol.asyncIterator in Object(stream)).toBe(true);

        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0]).toHaveProperty('choices');
      });

      it('should stream content deltas', async () => {
        const stream = await client.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
          stream: true,
        });

        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        const contentChunks = chunks.filter(
          (chunk) => chunk.choices[0]?.delta?.content
        );

        expect(contentChunks.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Anthropic SDK Wrapper', () => {
    let bridge: Bridge<AnthropicFrontendAdapter>;
    let client: AnthropicClient;

    beforeEach(() => {
      const frontend = new AnthropicFrontendAdapter();
      const backend = new MockBackendAdapter({
        responseDelay: 0,
      });
      bridge = new Bridge(frontend, backend);
      client = Anthropic(backend);
    });

    describe('Anthropic Constructor', () => {
      it('should create client with backend adapter', () => {
        const backend = new MockBackendAdapter();
        const anthropic = Anthropic(backend);

        expect(anthropic).toBeInstanceOf(AnthropicClient);
      });

      it('should have messages property', () => {
        expect(client).toHaveProperty('messages');
        expect(client.messages).toBeInstanceOf(Messages);
      });
    });

    describe('Anthropic messages.create()', () => {
      it('should create message', async () => {
        const response = await client.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: 'Hello!',
            },
          ],
        });

        expect(response).toBeDefined();
        expect(response.content).toBeDefined();
        expect(response.content.length).toBeGreaterThan(0);
        expect(response.content[0].type).toBe('text');
        expect(response.role).toBe('assistant');
      });

      it('should support max_tokens parameter', async () => {
        const response = await client.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 500,
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response).toBeDefined();
      });

      it('should support temperature parameter', async () => {
        const response = await client.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Test' }],
          temperature: 0.7,
        });

        expect(response).toBeDefined();
      });

      it('should support system parameter', async () => {
        const response = await client.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          system: 'You are a helpful assistant',
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response).toBeDefined();
      });

      it('should support top_p parameter', async () => {
        const response = await client.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Test' }],
          top_p: 0.9,
        });

        expect(response).toBeDefined();
      });

      it('should support top_k parameter', async () => {
        const response = await client.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Test' }],
          top_k: 40,
        });

        expect(response).toBeDefined();
      });

      it('should include usage information', async () => {
        const response = await client.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response.usage).toBeDefined();
        expect(response.usage.input_tokens).toBeGreaterThanOrEqual(0);
        expect(response.usage.output_tokens).toBeGreaterThan(0);
      });

      it('should have unique id', async () => {
        const response = await client.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response.id).toBeDefined();
        expect(typeof response.id).toBe('string');
      });

      it('should have model field', async () => {
        const response = await client.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response.model).toBeDefined();
      });

      it('should have stop_reason field', async () => {
        const response = await client.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response.stop_reason).toBeDefined();
        expect(['end_turn', 'stop_sequence', 'max_tokens']).toContain(
          response.stop_reason
        );
      });
    });

    describe('Anthropic Streaming', () => {
      it('should support streaming', async () => {
        const stream = await client.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Test' }],
          stream: true,
        });

        expect(stream).toBeDefined();
        expect(Symbol.asyncIterator in Object(stream)).toBe(true);

        const events = [];
        for await (const event of stream) {
          events.push(event);
        }

        expect(events.length).toBeGreaterThan(0);
      });

      it('should stream content blocks', async () => {
        const stream = await client.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Test' }],
          stream: true,
        });

        const events = [];
        for await (const event of stream) {
          events.push(event);
        }

        const contentEvents = events.filter(
          (event) => event.type === 'content_block_delta'
        );

        expect(contentEvents.length).toBeGreaterThan(0);
      });
    });
  });

  describe('SDK Wrapper Compatibility', () => {
    it('should maintain OpenAI SDK interface', () => {
      const backend = new MockBackendAdapter();
      const client = OpenAI(backend);

      // Check that it has the expected structure
      expect(client.chat).toBeDefined();
      expect(client.chat.completions).toBeDefined();
      expect(typeof client.chat.completions.create).toBe('function');
    });

    it('should maintain Anthropic SDK interface', () => {
      const backend = new MockBackendAdapter();
      const client = Anthropic(backend);

      // Check that it has the expected structure
      expect(client.messages).toBeDefined();
      expect(typeof client.messages.create).toBe('function');
    });

    it('should allow drop-in replacement for OpenAI SDK', async () => {
      const backend = new MockBackendAdapter();
      const openai = OpenAI(backend);

      // This should work exactly like the official SDK
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Say hello' }],
      });

      expect(completion.choices[0].message.content).toBeDefined();
    });

    it('should allow drop-in replacement for Anthropic SDK', async () => {
      const backend = new MockBackendAdapter();
      const anthropic = Anthropic(backend);

      // This should work exactly like the official SDK
      const message = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Say hello' }],
      });

      expect(message.content[0].text).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle OpenAI errors', async () => {
      const backend = new MockBackendAdapter({
        defaultResponse: {
          content: '',
          error: new Error('Test error'),
        },
      });
      const client = OpenAI(backend);

      await expect(
        client.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toThrow('Test error');
    });

    it('should handle Anthropic errors', async () => {
      const backend = new MockBackendAdapter({
        defaultResponse: {
          content: '',
          error: new Error('Test error'),
        },
      });
      const client = Anthropic(backend);

      await expect(
        client.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toThrow('Test error');
    });
  });
});
