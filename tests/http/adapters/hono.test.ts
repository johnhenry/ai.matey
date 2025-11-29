/**
 * Hono Adapter Tests
 *
 * Tests the Hono middleware functionality including request parsing, response formatting,
 * CORS, authentication, rate limiting, and streaming.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Context } from 'hono';
import { HonoMiddleware } from 'ai.matey.http';
import { Bridge } from 'ai.matey.core';
import { AnthropicFrontendAdapter } from 'ai.matey.frontend';
import type { BackendAdapter } from 'ai.matey.types';
import type { IRChatRequest, IRChatResponse } from 'ai.matey.types';
import { createBearerTokenValidator } from 'ai.matey.http.core';

// ============================================================================
// Mock Backend Adapter
// ============================================================================

class MockBackendAdapter implements BackendAdapter {
  metadata = {
    name: 'mock-backend',
    version: '1.0.0',
    provider: 'mock' as const,
    capabilities: {
      streaming: true,
      multiModal: false,
      tools: false,
      maxContextTokens: 4096,
      systemMessageStrategy: 'in-messages' as const,
      supportsMultipleSystemMessages: true,
    },
  };

  executionCount = 0;

  async execute(request: IRChatRequest): Promise<IRChatResponse> {
    this.executionCount++;

    return {
      message: {
        role: 'assistant',
        content: 'Mock response',
      },
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
      metadata: {
        requestId: request.metadata.requestId,
        timestamp: Date.now(),
        provenance: {
          frontend: request.metadata.provenance?.frontend,
          backend: this.metadata.name,
        },
      },
    };
  }

  async *executeStream(request: IRChatRequest): AsyncGenerator<any> {
    yield {
      type: 'message_start',
      message: {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'mock',
        usage: { input_tokens: 10, output_tokens: 0 },
      },
    };

    yield {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'Hello' },
    };

    yield {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: ' streaming' },
    };

    yield {
      type: 'message_stop',
    };
  }
}

// ============================================================================
// Mock Hono Context
// ============================================================================

function createMockContext(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
}): Context & { res: Response | null } {
  const headers = new Headers(options.headers || {});

  const ctx: any = {
    res: null,

    req: {
      method: options.method || 'POST',
      url: options.url || 'http://localhost/v1/messages',

      raw: {
        headers,
      },

      header(name: string): string | undefined {
        return headers.get(name) || undefined;
      },

      param(): Record<string, string> {
        return options.params || {};
      },

      query(): Record<string, string> {
        return options.query || {};
      },

      async json() {
        return options.body || null;
      },
    },

    body: options.body || null,

    header(name: string, value: string) {
      if (!this.res) {
        headers.set(name, value);
      }
    },

    json(data: any, status?: number) {
      const responseHeaders = new Headers(headers);
      responseHeaders.set('Content-Type', 'application/json');

      return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: responseHeaders,
      });
    },

    text(text: string, status?: number) {
      const responseHeaders = new Headers(headers);
      responseHeaders.set('Content-Type', 'text/plain');

      return new Response(text, {
        status: status || 200,
        headers: responseHeaders,
      });
    },
  };

  return ctx as Context & { res: Response | null };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Hono Adapter', () => {
  let frontend: AnthropicFrontendAdapter;
  let backend: MockBackendAdapter;
  let bridge: Bridge;

  beforeEach(() => {
    frontend = new AnthropicFrontendAdapter();
    backend = new MockBackendAdapter();
    bridge = new Bridge(frontend, backend);
  });

  describe('Basic Request Handling', () => {
    it('should handle a simple POST request', async () => {
      const middleware = HonoMiddleware(bridge);

      const c = createMockContext({
        method: 'POST',
        url: 'http://localhost/v1/messages',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Hello!' }],
        },
      });

      const res = await middleware(c);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeTruthy();
    });

    it('should return 400 for missing body', async () => {
      const middleware = HonoMiddleware(bridge);

      const c = createMockContext({
        method: 'POST',
        url: 'http://localhost/v1/messages',
        headers: {
          'content-type': 'application/json',
        },
        body: null,
      });

      const res = await middleware(c);

      expect(res.status).toBe(400);
    });

    it('should apply custom headers', async () => {
      const middleware = HonoMiddleware(bridge, {
        headers: {
          'X-Custom-Header': 'test-value',
        },
      });

      const c = createMockContext({
        method: 'POST',
        url: 'http://localhost/v1/messages',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Hello!' }],
        },
      });

      const res = await middleware(c);

      expect(res.headers.get('X-Custom-Header')).toBe('test-value');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight request', async () => {
      const middleware = HonoMiddleware(bridge, {
        cors: true,
      });

      const c = createMockContext({
        method: 'OPTIONS',
        url: 'http://localhost/v1/messages',
        headers: {
          origin: 'http://example.com',
          'access-control-request-method': 'POST',
        },
      });

      const res = await middleware(c);

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });

    it('should add CORS headers to responses', async () => {
      const middleware = HonoMiddleware(bridge, {
        cors: true,
      });

      const c = createMockContext({
        method: 'POST',
        url: 'http://localhost/v1/messages',
        headers: {
          'content-type': 'application/json',
          origin: 'http://example.com',
        },
        body: {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Hello!' }],
        },
      });

      const res = await middleware(c);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });

    it('should reject disallowed origins', async () => {
      const middleware = HonoMiddleware(bridge, {
        cors: {
          origin: ['http://allowed.com'],
        },
      });

      const c = createMockContext({
        method: 'POST',
        url: 'http://localhost/v1/messages',
        headers: {
          'content-type': 'application/json',
          origin: 'http://notallowed.com',
        },
        body: {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Hello!' }],
        },
      });

      const res = await middleware(c);

      expect(res.status).toBe(403);
    });
  });

  describe('Authentication', () => {
    it('should validate bearer tokens', async () => {
      const middleware = HonoMiddleware(bridge, {
        validateAuth: createBearerTokenValidator(['valid-token']),
      });

      const c = createMockContext({
        method: 'POST',
        url: 'http://localhost/v1/messages',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer valid-token',
        },
        body: {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Hello!' }],
        },
      });

      const res = await middleware(c);

      expect(res.status).toBe(200);
    });

    it('should reject invalid tokens', async () => {
      const middleware = HonoMiddleware(bridge, {
        validateAuth: createBearerTokenValidator(['valid-token']),
      });

      const c = createMockContext({
        method: 'POST',
        url: 'http://localhost/v1/messages',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer invalid-token',
        },
        body: {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Hello!' }],
        },
      });

      const res = await middleware(c);

      expect(res.status).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const middleware = HonoMiddleware(bridge, {
        rateLimit: {
          max: 2,
          windowMs: 1000,
        },
      });

      const makeRequest = async () => {
        const c = createMockContext({
          method: 'POST',
          url: 'http://localhost/v1/messages',
          headers: {
            'content-type': 'application/json',
          },
          body: {
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            messages: [{ role: 'user', content: 'Hello!' }],
          },
        });

        return await middleware(c);
      };

      // First two requests should succeed
      const res1 = await makeRequest();
      expect(res1.status).toBe(200);

      const res2 = await makeRequest();
      expect(res2.status).toBe(200);

      // Third request should be rate limited
      const res3 = await makeRequest();
      expect(res3.status).toBe(429);
    });
  });

  describe('Error Handling', () => {
    it('should handle backend errors', async () => {
      const errorBackend: BackendAdapter = {
        ...backend,
        async execute() {
          throw new Error('Backend error');
        },
      };

      const errorBridge = new Bridge(frontend, errorBackend);
      const middleware = HonoMiddleware(errorBridge);

      const c = createMockContext({
        method: 'POST',
        url: 'http://localhost/v1/messages',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Hello!' }],
        },
      });

      const res = await middleware(c);

      expect(res.status).toBeGreaterThanOrEqual(500);
    });

    it('should use custom error handler', async () => {
      let errorHandlerCalled = false;

      const errorBackend: BackendAdapter = {
        ...backend,
        async execute() {
          throw new Error('Test error');
        },
      };

      const errorBridge = new Bridge(frontend, errorBackend);
      const middleware = HonoMiddleware(errorBridge, {
        onError: async (error, req, res) => {
          errorHandlerCalled = true;
          res.status(418);
          res.send({ custom: 'error' });
        },
      });

      const c = createMockContext({
        method: 'POST',
        url: 'http://localhost/v1/messages',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Hello!' }],
        },
      });

      const res = await middleware(c);

      expect(errorHandlerCalled).toBe(true);
      expect(res.status).toBe(418);
    });
  });
});
