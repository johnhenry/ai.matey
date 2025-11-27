/**
 * Generic Frontend Adapter Tests
 *
 * Tests for the passthrough frontend adapter that accepts IR format directly.
 */

import { describe, it, expect } from 'vitest';
import {
  GenericFrontendAdapter,
  createGenericFrontend,
} from 'ai.matey.frontend.generic';
import type { IRChatRequest, IRChatResponse, IRStreamChunk } from 'ai.matey.types';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestRequest(content = 'Hello'): IRChatRequest {
  return {
    messages: [{ role: 'user', content }],
    parameters: {
      model: 'test-model',
      temperature: 0.7,
    },
    metadata: {
      requestId: 'test-123',
      timestamp: Date.now(),
      provenance: {},
    },
  };
}

function createTestResponse(content = 'Hello back!'): IRChatResponse {
  return {
    message: { role: 'assistant', content },
    finishReason: 'stop',
    usage: {
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    },
    metadata: {
      requestId: 'test-123',
      timestamp: Date.now(),
      provenance: { backend: 'test-backend' },
    },
  };
}

async function* createTestStream(): AsyncGenerator<IRStreamChunk, void, undefined> {
  yield { type: 'start', sequence: 0, metadata: { requestId: 'test-123', timestamp: Date.now(), provenance: {} } };
  yield { type: 'content', sequence: 1, delta: 'Hello', role: 'assistant' };
  yield { type: 'content', sequence: 2, delta: ' world', role: 'assistant' };
  yield { type: 'done', sequence: 3, finishReason: 'stop', message: { role: 'assistant', content: 'Hello world' } };
}

// ============================================================================
// Construction Tests
// ============================================================================

describe('GenericFrontendAdapter', () => {
  describe('construction', () => {
    it('should create adapter with default configuration', () => {
      const adapter = new GenericFrontendAdapter();

      expect(adapter.metadata.name).toBe('generic-frontend');
      expect(adapter.metadata.provider).toBe('Generic');
      expect(adapter.metadata.version).toBe('1.0.0');
    });

    it('should create adapter with custom name', () => {
      const adapter = new GenericFrontendAdapter({ name: 'my-custom-frontend' });

      expect(adapter.metadata.name).toBe('my-custom-frontend');
    });

    it('should report full capabilities', () => {
      const adapter = new GenericFrontendAdapter();

      expect(adapter.metadata.capabilities.streaming).toBe(true);
      expect(adapter.metadata.capabilities.multiModal).toBe(true);
      expect(adapter.metadata.capabilities.tools).toBe(true);
      expect(adapter.metadata.capabilities.systemMessageStrategy).toBe('in-messages');
      expect(adapter.metadata.capabilities.supportsMultipleSystemMessages).toBe(true);
    });

    it('should include custom capabilities', () => {
      const adapter = new GenericFrontendAdapter({
        maxContextTokens: 128000,
        supportedModels: ['gpt-4', 'claude-3'],
      });

      expect(adapter.metadata.capabilities.maxContextTokens).toBe(128000);
      expect(adapter.metadata.capabilities.supportedModels).toEqual(['gpt-4', 'claude-3']);
    });
  });

  describe('factory function', () => {
    it('should create adapter via createGenericFrontend', () => {
      const adapter = createGenericFrontend();

      expect(adapter).toBeInstanceOf(GenericFrontendAdapter);
      expect(adapter.metadata.name).toBe('generic-frontend');
    });

    it('should pass config to factory function', () => {
      const adapter = createGenericFrontend({ name: 'factory-frontend' });

      expect(adapter.metadata.name).toBe('factory-frontend');
    });
  });

  // ==========================================================================
  // toIR Tests (Request Passthrough)
  // ==========================================================================

  describe('toIR', () => {
    it('should pass through request unchanged', async () => {
      const adapter = new GenericFrontendAdapter({ trackProvenance: false });
      const request = createTestRequest();

      const result = await adapter.toIR(request);

      expect(result).toEqual(request);
    });

    it('should add provenance by default', async () => {
      const adapter = new GenericFrontendAdapter();
      const request = createTestRequest();

      const result = await adapter.toIR(request);

      expect(result.metadata.provenance?.frontend).toBe('generic-frontend');
    });

    it('should use custom name in provenance', async () => {
      const adapter = new GenericFrontendAdapter({ name: 'my-frontend' });
      const request = createTestRequest();

      const result = await adapter.toIR(request);

      expect(result.metadata.provenance?.frontend).toBe('my-frontend');
    });

    it('should preserve existing provenance fields', async () => {
      const adapter = new GenericFrontendAdapter();
      const request: IRChatRequest = {
        ...createTestRequest(),
        metadata: {
          requestId: 'test-123',
          timestamp: Date.now(),
          provenance: {
            backend: 'existing-backend',
            middleware: ['logger'],
          },
        },
      };

      const result = await adapter.toIR(request);

      expect(result.metadata.provenance?.backend).toBe('existing-backend');
      expect(result.metadata.provenance?.middleware).toEqual(['logger']);
      expect(result.metadata.provenance?.frontend).toBe('generic-frontend');
    });

    it('should not modify provenance when disabled', async () => {
      const adapter = new GenericFrontendAdapter({ trackProvenance: false });
      const request = createTestRequest();

      const result = await adapter.toIR(request);

      expect(result.metadata.provenance?.frontend).toBeUndefined();
    });

    it('should preserve all request fields', async () => {
      const adapter = new GenericFrontendAdapter({ trackProvenance: false });
      const request: IRChatRequest = {
        messages: [
          { role: 'system', content: 'Be helpful' },
          { role: 'user', content: 'Hello' },
        ],
        parameters: {
          model: 'gpt-4',
          temperature: 0.5,
          maxTokens: 1000,
          topP: 0.9,
        },
        tools: [
          {
            name: 'get_weather',
            description: 'Get weather',
            parameters: { type: 'object', properties: {} },
          },
        ],
        toolChoice: 'auto',
        stream: true,
        metadata: {
          requestId: 'test-456',
          timestamp: 1234567890,
          provenance: {},
          custom: { userId: 'user-123' },
        },
      };

      const result = await adapter.toIR(request);

      expect(result.messages).toEqual(request.messages);
      expect(result.parameters).toEqual(request.parameters);
      expect(result.tools).toEqual(request.tools);
      expect(result.toolChoice).toBe('auto');
      expect(result.stream).toBe(true);
      expect(result.metadata.custom).toEqual({ userId: 'user-123' });
    });
  });

  // ==========================================================================
  // fromIR Tests (Response Passthrough)
  // ==========================================================================

  describe('fromIR', () => {
    it('should pass through response unchanged', async () => {
      const adapter = new GenericFrontendAdapter();
      const response = createTestResponse();

      const result = await adapter.fromIR(response);

      expect(result).toEqual(response);
    });

    it('should preserve all response fields', async () => {
      const adapter = new GenericFrontendAdapter();
      const response: IRChatResponse = {
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Here is the weather' },
            { type: 'tool_use', id: 'tool-1', name: 'get_weather', input: { city: 'NYC' } },
          ],
        },
        finishReason: 'tool_calls',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          details: { cachedTokens: 20 },
        },
        metadata: {
          requestId: 'test-789',
          timestamp: Date.now(),
          provenance: { frontend: 'generic', backend: 'openai' },
          warnings: [
            { category: 'parameter-normalized', severity: 'info', message: 'temp adjusted' },
          ],
        },
        raw: { originalResponse: { id: 'chatcmpl-123' } },
      };

      const result = await adapter.fromIR(response);

      expect(result).toEqual(response);
    });
  });

  // ==========================================================================
  // fromIRStream Tests (Stream Passthrough)
  // ==========================================================================

  describe('fromIRStream', () => {
    it('should pass through stream chunks unchanged', async () => {
      const adapter = new GenericFrontendAdapter();
      const stream = createTestStream();

      const chunks: IRStreamChunk[] = [];
      for await (const chunk of adapter.fromIRStream(stream)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(4);
      expect(chunks[0].type).toBe('start');
      expect(chunks[1].type).toBe('content');
      expect((chunks[1] as any).delta).toBe('Hello');
      expect(chunks[2].type).toBe('content');
      expect((chunks[2] as any).delta).toBe(' world');
      expect(chunks[3].type).toBe('done');
    });

    it('should handle empty stream', async () => {
      const adapter = new GenericFrontendAdapter();
      async function* emptyStream(): AsyncGenerator<IRStreamChunk, void, undefined> {
        // Empty
      }

      const chunks: IRStreamChunk[] = [];
      for await (const chunk of adapter.fromIRStream(emptyStream())) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(0);
    });

    it('should handle stream with error chunk', async () => {
      const adapter = new GenericFrontendAdapter();
      async function* errorStream(): AsyncGenerator<IRStreamChunk, void, undefined> {
        yield { type: 'start', sequence: 0, metadata: { requestId: 'test', timestamp: Date.now(), provenance: {} } };
        yield { type: 'error', sequence: 1, error: { code: 'RATE_LIMIT', message: 'Too many requests' } };
      }

      const chunks: IRStreamChunk[] = [];
      for await (const chunk of adapter.fromIRStream(errorStream())) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[1].type).toBe('error');
      expect((chunks[1] as any).error.code).toBe('RATE_LIMIT');
    });
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================

  describe('validate', () => {
    it('should not validate by default', async () => {
      const adapter = new GenericFrontendAdapter();
      const invalidRequest = {} as IRChatRequest;

      // Should not throw
      await expect(adapter.validate(invalidRequest)).resolves.toBeUndefined();
    });

    it('should validate when enabled', async () => {
      const adapter = new GenericFrontendAdapter({ validateRequests: true });
      const invalidRequest = {} as IRChatRequest;

      await expect(adapter.validate(invalidRequest)).rejects.toThrow('at least one message');
    });

    it('should validate requestId', async () => {
      const adapter = new GenericFrontendAdapter({ validateRequests: true });
      const request = {
        messages: [{ role: 'user', content: 'Hello' }],
        metadata: { timestamp: Date.now(), provenance: {} },
      } as IRChatRequest;

      await expect(adapter.validate(request)).rejects.toThrow('requestId');
    });

    it('should validate timestamp', async () => {
      const adapter = new GenericFrontendAdapter({ validateRequests: true });
      const request = {
        messages: [{ role: 'user', content: 'Hello' }],
        metadata: { requestId: 'test', provenance: {} },
      } as IRChatRequest;

      await expect(adapter.validate(request)).rejects.toThrow('timestamp');
    });

    it('should pass validation for valid request', async () => {
      const adapter = new GenericFrontendAdapter({ validateRequests: true });
      const request = createTestRequest();

      await expect(adapter.validate(request)).resolves.toBeUndefined();
    });
  });
});
