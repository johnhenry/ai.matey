import { describe, it, expect } from 'vitest';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
import { DeepSeekBackendAdapter } from 'ai.matey.backend.deepseek';
import { GroqBackendAdapter } from 'ai.matey.backend.groq';
import {
  MockBackendAdapter,
  createEchoBackend,
  createErrorBackend,
  createDelayedBackend,
} from 'ai.matey.backend.mock';
import type { IRChatRequest } from 'ai.matey.types';

describe('Backend Adapters', () => {
  const mockRequest: IRChatRequest = {
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello!' }],
      },
    ],
    parameters: {
      model: 'test-model',
      temperature: 0.7,
      maxTokens: 100,
    },
    metadata: {
      requestId: 'test-123',
      timestamp: Date.now(),
    },
  };

  describe('OpenAIBackendAdapter', () => {
    it('should create adapter with config', () => {
      const adapter = new OpenAIBackendAdapter({
        apiKey: 'test-key',
        baseURL: 'https://api.openai.com/v1',
      });

      expect(adapter).toBeDefined();
      expect(adapter.metadata.name).toBe('openai-backend');
    });

    it('should provide metadata', () => {
      const adapter = new OpenAIBackendAdapter({ apiKey: 'test-key' });
      const metadata = adapter.metadata;

      expect(metadata.name).toBe('openai-backend');
      expect(metadata.capabilities.streaming).toBe(true);
      expect(metadata.capabilities.tools).toBe(true);
      expect(metadata.capabilities.multiModal).toBe(true);
    });
  });

  describe('AnthropicBackendAdapter', () => {
    it('should create adapter with config', () => {
      const adapter = new AnthropicBackendAdapter({
        apiKey: 'test-key',
      });

      expect(adapter).toBeDefined();
      expect(adapter.metadata.name).toBe('anthropic-backend');
    });

    it('should provide metadata with correct capabilities', () => {
      const adapter = new AnthropicBackendAdapter({ apiKey: 'test-key' });
      const metadata = adapter.metadata;

      expect(metadata.name).toBe('anthropic-backend');
      expect(metadata.capabilities.streaming).toBe(true);
      expect(metadata.capabilities.tools).toBe(true);
      expect(metadata.capabilities.multiModal).toBe(true);
    });

    it('should handle custom base URL', () => {
      const adapter = new AnthropicBackendAdapter({
        apiKey: 'test-key',
        baseURL: 'https://custom.api.com',
      });

      expect(adapter).toBeDefined();
    });
  });

  describe('DeepSeekBackendAdapter', () => {
    it('should create adapter with config', () => {
      const adapter = new DeepSeekBackendAdapter({
        apiKey: 'test-key',
      });

      expect(adapter).toBeDefined();
      expect(adapter.metadata.name).toBe('deepseek-backend');
    });

    it('should provide metadata', () => {
      const adapter = new DeepSeekBackendAdapter({ apiKey: 'test-key' });
      const metadata = adapter.metadata;

      expect(metadata.name).toBe('deepseek-backend');
      expect(metadata.capabilities.streaming).toBe(true);
    });
  });

  describe('GroqBackendAdapter', () => {
    it('should create adapter with config', () => {
      const adapter = new GroqBackendAdapter({
        apiKey: 'test-key',
      });

      expect(adapter).toBeDefined();
      expect(adapter.metadata.name).toBe('groq-backend');
    });

    it('should provide metadata', () => {
      const adapter = new GroqBackendAdapter({ apiKey: 'test-key' });
      const metadata = adapter.metadata;

      expect(metadata.name).toBe('groq-backend');
      expect(metadata.capabilities.streaming).toBe(true);
      expect(metadata.capabilities.tools).toBe(true);
    });
  });

  describe('MockBackendAdapter', () => {
    it('should create mock adapter', () => {
      const adapter = new MockBackendAdapter();

      expect(adapter).toBeDefined();
      expect(adapter.metadata.name).toBe('mock');
    });

    it('should execute mock request', async () => {
      const adapter = new MockBackendAdapter({
        defaultResponse: 'Test response',
      });

      const response = await adapter.execute(mockRequest);

      expect(response).toBeDefined();
      expect(response.message.role).toBe('assistant');
      expect(response.message.content).toBeDefined();
      expect(response.finishReason).toBe('stop');
    });

    it('should support streaming', async () => {
      const adapter = new MockBackendAdapter({
        defaultResponse: 'Test streaming response',
        simulateStreaming: true,
        streamChunkDelay: 0,
      });

      const stream = adapter.executeStream(mockRequest);
      const chunks = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].type).toBe('start');
      expect(chunks[chunks.length - 1].type).toBe('done');
    });

    it('should use echo backend', async () => {
      const adapter = createEchoBackend();
      const response = await adapter.execute(mockRequest);

      expect(response.message.content[0].type).toBe('text');
      expect((response.message.content[0] as { text: string }).text).toContain('Echo:');
    });

    it('should use error backend', async () => {
      const adapter = createErrorBackend(new Error('Test error'));

      await expect(adapter.execute(mockRequest)).rejects.toThrow('Test error');
    });

    it('should use delayed backend', async () => {
      const adapter = createDelayedBackend(50);
      const start = Date.now();

      await adapter.execute(mockRequest);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some timing variance
    });

    it('should support custom response', async () => {
      const adapter = new MockBackendAdapter({
        defaultResponse: {
          content: 'Custom response',
          usage: {
            inputTokens: 10,
            outputTokens: 20,
          },
        },
      });

      const response = await adapter.execute(mockRequest);

      expect((response.message.content[0] as { text: string }).text).toBe('Custom response');
      expect(response.usage?.totalTokens).toBe(30);
    });

    it('should track request history', async () => {
      const adapter = new MockBackendAdapter({
        defaultResponse: 'Test response',
      });

      await adapter.execute(mockRequest);
      await adapter.execute(mockRequest);

      expect(adapter.lastRequest).toEqual(mockRequest);
      expect(adapter.allRequests.length).toBe(2);

      adapter.clearHistory();
      expect(adapter.lastRequest).toBeUndefined();
      expect(adapter.allRequests.length).toBe(0);
    });
  });

  describe('Backend Adapter Common Interface', () => {
    const adapters = [
      { name: 'OpenAI', adapter: new OpenAIBackendAdapter({ apiKey: 'test' }) },
      { name: 'Anthropic', adapter: new AnthropicBackendAdapter({ apiKey: 'test' }) },
      { name: 'DeepSeek', adapter: new DeepSeekBackendAdapter({ apiKey: 'test' }) },
      { name: 'Groq', adapter: new GroqBackendAdapter({ apiKey: 'test' }) },
      { name: 'Mock', adapter: new MockBackendAdapter() },
    ];

    adapters.forEach(({ name, adapter }) => {
      describe(`${name} Adapter Interface`, () => {
        it('should have required properties', () => {
          expect(adapter.metadata).toBeDefined();
          expect(adapter.metadata.name).toBeDefined();
          expect(typeof adapter.metadata.name).toBe('string');
        });

        it('should have execute method', () => {
          expect(typeof adapter.execute).toBe('function');
        });

        it('should have executeStream method', () => {
          expect(typeof adapter.executeStream).toBe('function');
        });

        it('should have metadata property', () => {
          expect(adapter.metadata).toBeDefined();
          expect(typeof adapter.metadata).toBe('object');
          expect(adapter.metadata.name).toBeDefined();
          expect(adapter.metadata.capabilities).toBeDefined();
        });
      });
    });
  });
});
