/**
 * Transform Middleware Tests
 *
 * Tests for request/response transformation middleware.
 */

import { describe, it, expect, vi } from 'vitest';
import { createTransformMiddleware } from 'ai.matey.middleware.transform';
import type { MiddlewareContext, MiddlewareNext } from 'ai.matey.types';
import type { IRChatRequest, IRChatResponse, IRMessage } from 'ai.matey.types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockContext(request: Partial<IRChatRequest> = {}): MiddlewareContext {
  const defaultRequest: IRChatRequest = {
    messages: [{ role: 'user', content: 'Hello' }],
    metadata: {
      requestId: 'test-123',
      timestamp: Date.now(),
    },
    ...request,
  };

  return {
    request: defaultRequest,
    backend: {
      metadata: {
        name: 'mock',
        version: '1.0.0',
        provider: 'mock',
      },
    } as any,
    state: new Map(),
    signal: undefined,
  };
}

function createMockResponse(content: string = 'Response'): IRChatResponse {
  return {
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: content }],
    },
    finishReason: 'stop',
    metadata: {
      requestId: 'test-123',
      timestamp: Date.now(),
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Transform Middleware', () => {
  describe('createTransformMiddleware', () => {
    it('should pass through when no transforms configured', async () => {
      const middleware = createTransformMiddleware();
      const context = createMockContext();
      const originalRequest = { ...context.request };
      const mockResponse = createMockResponse();
      const next: MiddlewareNext = vi.fn().mockResolvedValue(mockResponse);

      const result = await middleware(context, next);

      expect(next).toHaveBeenCalled();
      expect(result).toBe(mockResponse);
      // Request should be unchanged
      expect(context.request.messages).toEqual(originalRequest.messages);
    });

    it('should transform request with transformRequest', async () => {
      const middleware = createTransformMiddleware({
        transformRequest: (request) => ({
          ...request,
          parameters: { ...request.parameters, temperature: 0.5 },
        }),
      });

      const context = createMockContext();
      const mockResponse = createMockResponse();
      const next: MiddlewareNext = vi.fn().mockResolvedValue(mockResponse);

      await middleware(context, next);

      // Context.request is modified in place
      expect(context.request.parameters?.temperature).toBe(0.5);
    });

    it('should transform response with transformResponse', async () => {
      const middleware = createTransformMiddleware({
        transformResponse: (response) => ({
          ...response,
          metadata: {
            ...response.metadata,
            transformed: true,
          },
        }),
      });

      const context = createMockContext();
      const mockResponse = createMockResponse();
      const next: MiddlewareNext = vi.fn().mockResolvedValue(mockResponse);

      const result = await middleware(context, next);

      expect((result.metadata as any).transformed).toBe(true);
    });

    it('should transform individual messages with transformMessages', async () => {
      const middleware = createTransformMiddleware({
        transformMessages: (message: IRMessage) => ({
          ...message,
          content: typeof message.content === 'string'
            ? message.content.toUpperCase()
            : message.content,
        }),
      });

      const context = createMockContext({
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'world' },
        ],
      });
      const mockResponse = createMockResponse();
      const next: MiddlewareNext = vi.fn().mockResolvedValue(mockResponse);

      await middleware(context, next);

      // Context.request is modified in place
      expect(context.request.messages[0].content).toBe('HELLO');
      expect(context.request.messages[1].content).toBe('WORLD');
    });

    it('should apply transforms in correct order: messages -> request -> response', async () => {
      const order: string[] = [];

      const middleware = createTransformMiddleware({
        transformMessages: (msg) => {
          order.push('messages');
          return msg;
        },
        transformRequest: (req) => {
          order.push('request');
          return req;
        },
        transformResponse: (res) => {
          order.push('response');
          return res;
        },
      });

      const context = createMockContext();
      const mockResponse = createMockResponse();
      const next: MiddlewareNext = vi.fn().mockResolvedValue(mockResponse);

      await middleware(context, next);

      expect(order).toEqual(['messages', 'request', 'response']);
    });

    it('should support async transformers', async () => {
      const middleware = createTransformMiddleware({
        transformRequest: async (request) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            ...request,
            parameters: { ...request.parameters, async: true },
          };
        },
      });

      const context = createMockContext();
      const mockResponse = createMockResponse();
      const next: MiddlewareNext = vi.fn().mockResolvedValue(mockResponse);

      await middleware(context, next);

      expect(context.request.parameters?.async).toBe(true);
    });

    it('should add system message prefix', async () => {
      const middleware = createTransformMiddleware({
        transformRequest: (request) => ({
          ...request,
          messages: [
            { role: 'system' as const, content: 'You are a helpful assistant.' },
            ...request.messages,
          ],
        }),
      });

      const context = createMockContext({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      const mockResponse = createMockResponse();
      const next: MiddlewareNext = vi.fn().mockResolvedValue(mockResponse);

      await middleware(context, next);

      expect(context.request.messages.length).toBe(2);
      expect(context.request.messages[0].role).toBe('system');
      expect(context.request.messages[0].content).toBe('You are a helpful assistant.');
    });

    it('should filter sensitive content from response', async () => {
      const middleware = createTransformMiddleware({
        transformResponse: (response) => {
          const content = response.message.content;
          if (Array.isArray(content)) {
            return {
              ...response,
              message: {
                ...response.message,
                content: content.map((c) => {
                  if (c.type === 'text') {
                    return { ...c, text: c.text.replace(/password/gi, '[REDACTED]') };
                  }
                  return c;
                }),
              },
            };
          }
          return response;
        },
      });

      const context = createMockContext();
      const mockResponse = createMockResponse('Your password is secret123');
      const next: MiddlewareNext = vi.fn().mockResolvedValue(mockResponse);

      const result = await middleware(context, next);

      const textContent = result.message.content;
      if (Array.isArray(textContent) && textContent[0].type === 'text') {
        expect(textContent[0].text).toContain('[REDACTED]');
        expect(textContent[0].text).not.toContain('password');
      }
    });

    it('should handle transformer errors', async () => {
      const middleware = createTransformMiddleware({
        transformRequest: () => {
          throw new Error('Transform error');
        },
      });

      const context = createMockContext();
      const next: MiddlewareNext = vi.fn();

      await expect(middleware(context, next)).rejects.toThrow('Transform error');
      expect(next).not.toHaveBeenCalled();
    });
  });
});
