/**
 * Function Backend Adapter Tests
 *
 * Tests for the generic function-based backend adapter that accepts
 * async functions for execute and executeStream operations.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  FunctionBackendAdapter,
  type ExecuteFunction,
  type ExecuteStreamFunction,
  type FunctionBackendConfig,
} from 'ai.matey.backend.browser';
import type { IRChatRequest, IRChatResponse, IRStreamChunk } from 'ai.matey.types';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestRequest(content = 'Hello'): IRChatRequest {
  return {
    messages: [{ role: 'user', content }],
    metadata: {
      requestId: 'test-123',
      provenance: {},
    },
  };
}

function createTestResponse(content = 'Hello back!'): IRChatResponse {
  return {
    message: { role: 'assistant', content },
    finishReason: 'stop',
    metadata: {
      requestId: 'test-123',
      provenance: { backend: 'function-backend' },
    },
  };
}

async function* createTestStream(chunks: string[]): AsyncGenerator<IRStreamChunk> {
  let sequence = 0;
  yield { type: 'start', sequence: sequence++ } as IRStreamChunk;

  for (const chunk of chunks) {
    yield {
      type: 'content',
      sequence: sequence++,
      delta: chunk,
      role: 'assistant',
    } as IRStreamChunk;
  }

  yield {
    type: 'done',
    sequence: sequence++,
    finishReason: 'stop',
    message: { role: 'assistant', content: chunks.join('') },
  } as IRStreamChunk;
}

// ============================================================================
// Basic Construction Tests
// ============================================================================

describe('FunctionBackendAdapter', () => {
  describe('construction', () => {
    it('should create adapter with execute function only', () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();

      const adapter = new FunctionBackendAdapter({ execute: executeFn });

      expect(adapter.metadata.name).toBe('function-backend');
      expect(adapter.metadata.provider).toBe('Function');
    });

    it('should create adapter with custom metadata', () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();

      const adapter = new FunctionBackendAdapter({
        execute: executeFn,
        metadata: {
          name: 'custom-backend',
          provider: 'CustomProvider',
          version: '2.0.0',
        },
      });

      expect(adapter.metadata.name).toBe('custom-backend');
      expect(adapter.metadata.provider).toBe('CustomProvider');
      expect(adapter.metadata.version).toBe('2.0.0');
    });

    it('should create adapter with both execute and executeStream functions', () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();
      const executeStreamFn: ExecuteStreamFunction = async function* () {
        yield* createTestStream(['Hello']);
      };

      const adapter = new FunctionBackendAdapter({
        execute: executeFn,
        executeStream: executeStreamFn,
      });

      expect(adapter.metadata.capabilities.streaming).toBe(true);
    });

    it('should set streaming capability to false when no stream function provided', () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();

      const adapter = new FunctionBackendAdapter({ execute: executeFn });

      expect(adapter.metadata.capabilities.streaming).toBe(false);
    });
  });

  // ==========================================================================
  // Execute Tests
  // ==========================================================================

  describe('execute', () => {
    it('should call execute function with request', async () => {
      const executeFn = vi.fn<ExecuteFunction>(async (request) => {
        return createTestResponse(`Echo: ${(request.messages[0]?.content as string) || ''}`);
      });

      const adapter = new FunctionBackendAdapter({ execute: executeFn });
      const request = createTestRequest('Test message');

      const response = await adapter.execute(request);

      expect(executeFn).toHaveBeenCalledWith(request, undefined);
      expect(response.message.content).toBe('Echo: Test message');
    });

    it('should pass abort signal to execute function', async () => {
      const executeFn = vi.fn<ExecuteFunction>(async () => createTestResponse());
      const adapter = new FunctionBackendAdapter({ execute: executeFn });
      const request = createTestRequest();
      const controller = new AbortController();

      await adapter.execute(request, controller.signal);

      expect(executeFn).toHaveBeenCalledWith(request, controller.signal);
    });

    it('should propagate errors from execute function', async () => {
      const executeFn: ExecuteFunction = async () => {
        throw new Error('Custom error');
      };

      const adapter = new FunctionBackendAdapter({ execute: executeFn });
      const request = createTestRequest();

      await expect(adapter.execute(request)).rejects.toThrow('Custom error');
    });

    it('should add backend name to response metadata', async () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();

      const adapter = new FunctionBackendAdapter({
        execute: executeFn,
        metadata: { name: 'my-custom-backend' },
      });
      const request = createTestRequest();

      const response = await adapter.execute(request);

      expect(response.metadata.provenance.backend).toBe('my-custom-backend');
    });
  });

  // ==========================================================================
  // Execute Stream Tests
  // ==========================================================================

  describe('executeStream', () => {
    it('should call executeStream function with request', async () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();
      const executeStreamFn = vi.fn<ExecuteStreamFunction>(async function* () {
        yield* createTestStream(['Hello', ' World']);
      });

      const adapter = new FunctionBackendAdapter({
        execute: executeFn,
        executeStream: executeStreamFn,
      });
      const request = createTestRequest();

      const chunks: IRStreamChunk[] = [];
      for await (const chunk of adapter.executeStream(request)) {
        chunks.push(chunk);
      }

      expect(executeStreamFn).toHaveBeenCalledWith(request, undefined);
      expect(chunks.length).toBe(4); // start, 2 content, done
    });

    it('should pass abort signal to executeStream function', async () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();
      const executeStreamFn = vi.fn<ExecuteStreamFunction>(async function* () {
        yield* createTestStream(['Test']);
      });

      const adapter = new FunctionBackendAdapter({
        execute: executeFn,
        executeStream: executeStreamFn,
      });
      const request = createTestRequest();
      const controller = new AbortController();

      const chunks: IRStreamChunk[] = [];
      for await (const chunk of adapter.executeStream(request, controller.signal)) {
        chunks.push(chunk);
      }

      expect(executeStreamFn).toHaveBeenCalledWith(request, controller.signal);
    });

    it('should throw when streaming not supported', async () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();

      const adapter = new FunctionBackendAdapter({ execute: executeFn });
      const request = createTestRequest();

      // Should throw or yield error chunk
      const chunks: IRStreamChunk[] = [];
      for await (const chunk of adapter.executeStream(request)) {
        chunks.push(chunk);
        if (chunk.type === 'error') break;
      }

      const errorChunk = chunks.find(c => c.type === 'error');
      expect(errorChunk).toBeDefined();
      expect((errorChunk as any).error.message).toContain('streaming');
    });

    it('should yield content chunks with delta and role', async () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();
      const executeStreamFn: ExecuteStreamFunction = async function* () {
        yield* createTestStream(['Hello', ' ', 'World']);
      };

      const adapter = new FunctionBackendAdapter({
        execute: executeFn,
        executeStream: executeStreamFn,
      });
      const request = createTestRequest();

      const contentChunks: IRStreamChunk[] = [];
      for await (const chunk of adapter.executeStream(request)) {
        if (chunk.type === 'content') {
          contentChunks.push(chunk);
        }
      }

      expect(contentChunks).toHaveLength(3);
      expect(contentChunks[0]?.delta).toBe('Hello');
      expect(contentChunks[1]?.delta).toBe(' ');
      expect(contentChunks[2]?.delta).toBe('World');
    });
  });

  // ==========================================================================
  // fromIR / toIR Tests
  // ==========================================================================

  describe('fromIR', () => {
    it('should return request unchanged by default', () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();
      const adapter = new FunctionBackendAdapter({ execute: executeFn });
      const request = createTestRequest();

      const result = adapter.fromIR(request);

      expect(result).toEqual(request);
    });

    it('should use custom fromIR function when provided', () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();
      const customFromIR = (request: IRChatRequest) => ({
        ...request,
        custom: true,
      });

      const adapter = new FunctionBackendAdapter({
        execute: executeFn,
        fromIR: customFromIR,
      });
      const request = createTestRequest();

      const result = adapter.fromIR(request);

      expect((result as any).custom).toBe(true);
    });
  });

  describe('toIR', () => {
    it('should return response unchanged by default', () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();
      const adapter = new FunctionBackendAdapter({ execute: executeFn });
      const response = createTestResponse();
      const request = createTestRequest();

      const result = adapter.toIR(response, request, 100);

      expect(result.message.content).toBe(response.message.content);
    });

    it('should use custom toIR function when provided', () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();
      const customToIR = (response: IRChatResponse, _request: IRChatRequest, latencyMs: number) => ({
        ...response,
        metadata: {
          ...response.metadata,
          custom: { latencyMs },
        },
      });

      const adapter = new FunctionBackendAdapter({
        execute: executeFn,
        toIR: customToIR,
      });
      const response = createTestResponse();
      const request = createTestRequest();

      const result = adapter.toIR(response, request, 150);

      expect(result.metadata.custom?.latencyMs).toBe(150);
    });
  });

  // ==========================================================================
  // Optional Methods Tests
  // ==========================================================================

  describe('healthCheck', () => {
    it('should return true by default', async () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();
      const adapter = new FunctionBackendAdapter({ execute: executeFn });

      const result = await adapter.healthCheck?.();

      expect(result).toBe(true);
    });

    it('should use custom healthCheck when provided', async () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();
      const healthCheckFn = vi.fn(async () => false);

      const adapter = new FunctionBackendAdapter({
        execute: executeFn,
        healthCheck: healthCheckFn,
      });

      const result = await adapter.healthCheck?.();

      expect(healthCheckFn).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('estimateCost', () => {
    it('should return null by default', async () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();
      const adapter = new FunctionBackendAdapter({ execute: executeFn });
      const request = createTestRequest();

      const result = await adapter.estimateCost?.(request);

      expect(result).toBeNull();
    });

    it('should use custom estimateCost when provided', async () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();
      const estimateCostFn = vi.fn(async () => 0.05);

      const adapter = new FunctionBackendAdapter({
        execute: executeFn,
        estimateCost: estimateCostFn,
      });
      const request = createTestRequest();

      const result = await adapter.estimateCost?.(request);

      expect(estimateCostFn).toHaveBeenCalledWith(request);
      expect(result).toBe(0.05);
    });
  });

  describe('listModels', () => {
    it('should return empty list by default', async () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();
      const adapter = new FunctionBackendAdapter({ execute: executeFn });

      const result = await adapter.listModels?.();

      expect(result?.models).toEqual([]);
      expect(result?.source).toBe('static');
    });

    it('should use custom listModels when provided', async () => {
      const executeFn: ExecuteFunction = async () => createTestResponse();
      const models = [{ id: 'custom-model', name: 'Custom Model', ownedBy: 'test' }];
      const listModelsFn = vi.fn(async () => ({
        models,
        source: 'remote' as const,
        fetchedAt: Date.now(),
        isComplete: true,
      }));

      const adapter = new FunctionBackendAdapter({
        execute: executeFn,
        listModels: listModelsFn,
      });

      const result = await adapter.listModels?.();

      expect(listModelsFn).toHaveBeenCalled();
      expect(result?.models).toEqual(models);
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('integration', () => {
    it('should work with echo-style function', async () => {
      const echoExecute: ExecuteFunction = async (request) => {
        const userMessage = request.messages.find(m => m.role === 'user');
        const content = typeof userMessage?.content === 'string'
          ? userMessage.content
          : 'No content';

        return {
          message: { role: 'assistant', content: `Echo: ${content}` },
          finishReason: 'stop',
          metadata: {
            requestId: request.metadata.requestId,
            provenance: {},
          },
        };
      };

      const adapter = new FunctionBackendAdapter({
        execute: echoExecute,
        metadata: { name: 'echo-backend' },
      });

      const response = await adapter.execute(createTestRequest('Testing 123'));

      expect(response.message.content).toBe('Echo: Testing 123');
    });

    it('should work with stateful function (conversation tracking)', async () => {
      const conversationHistory: string[] = [];

      const statefulExecute: ExecuteFunction = async (request) => {
        const userMessage = request.messages.find(m => m.role === 'user');
        const content = typeof userMessage?.content === 'string'
          ? userMessage.content
          : '';

        conversationHistory.push(content);

        return {
          message: {
            role: 'assistant',
            content: `Message ${conversationHistory.length}: ${content}`,
          },
          finishReason: 'stop',
          metadata: {
            requestId: request.metadata.requestId,
            provenance: {},
          },
        };
      };

      const adapter = new FunctionBackendAdapter({ execute: statefulExecute });

      await adapter.execute(createTestRequest('First'));
      await adapter.execute(createTestRequest('Second'));
      const response = await adapter.execute(createTestRequest('Third'));

      expect(response.message.content).toBe('Message 3: Third');
      expect(conversationHistory).toEqual(['First', 'Second', 'Third']);
    });

    it('should work with delayed response function', async () => {
      const delayedExecute: ExecuteFunction = async (request) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return createTestResponse('Delayed response');
      };

      const adapter = new FunctionBackendAdapter({ execute: delayedExecute });

      const start = Date.now();
      const response = await adapter.execute(createTestRequest());
      const elapsed = Date.now() - start;

      expect(response.message.content).toBe('Delayed response');
      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some timing variance
    });
  });
});
