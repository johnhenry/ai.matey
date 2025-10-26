/**
 * Koa Adapter Tests
 *
 * Tests the Koa middleware functionality including request parsing, response formatting,
 * CORS, authentication, rate limiting, and streaming.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Context } from 'koa';
import { KoaMiddleware } from '../../../src/http/adapters/koa/index.js';
import { Bridge } from '../../../src/core/bridge.js';
import { AnthropicFrontendAdapter } from '../../../src/adapters/frontend/anthropic.js';
import type { BackendAdapter } from '../../../src/types/adapters.js';
import type { IRChatRequest, IRChatResponse } from '../../../src/types/ir.js';
import { createBearerTokenValidator } from '../../../src/http/auth.js';

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
// Mock Koa Context
// ============================================================================

function createMockContext(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
}): Context & {
  _status: number;
  _headers: Record<string, string>;
  _body: any;
} {
  const ctx: any = {
    method: options.method || 'POST',
    url: options.url || '/v1/messages',
    originalUrl: options.url || '/v1/messages',
    headers: options.headers || {},
    query: options.query || {},
    params: options.params || {},
    ip: '127.0.0.1',
    writable: true,
    respond: true,
    _status: 200,
    _headers: {},
    _body: null,

    request: {
      body: options.body || null,
      socket: {
        remoteAddress: '127.0.0.1',
      },
    },

    response: {
      headerSent: false,
    },

    req: {
      socket: {
        remoteAddress: '127.0.0.1',
      },
    },

    res: {
      headersSent: false,
      writable: true,
      setHeader(name: string, value: string) {
        ctx._headers[name.toLowerCase()] = value;
      },
      write(chunk: string) {
        // No-op for mock
      },
      end(data?: string) {
        ctx.writable = false;
      },
      flushHeaders() {
        // No-op for mock
      },
    },

    set(name: string, value: string) {
      this._headers[name.toLowerCase()] = value;
    },

    get status() {
      return this._status;
    },

    set status(value: number) {
      this._status = value;
    },

    get body() {
      return this._body;
    },

    set body(value: any) {
      this._body = value;
    },
  };

  return ctx as Context & {
    _status: number;
    _headers: Record<string, string>;
    _body: any;
  };
}

async function mockNext() {
  // No-op for mock
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Koa Adapter', () => {
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
      const middleware = KoaMiddleware(bridge);

      const ctx = createMockContext({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Hello!' }],
        },
      });

      await middleware(ctx, mockNext);

      expect(ctx._status).toBe(200);
      expect(ctx._body).toBeTruthy();
    });

    it('should return 400 for missing body', async () => {
      const middleware = KoaMiddleware(bridge);

      const ctx = createMockContext({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'content-type': 'application/json',
        },
        body: null,
      });

      await middleware(ctx, mockNext);

      expect(ctx._status).toBe(400);
    });

    it('should apply custom headers', async () => {
      const middleware = KoaMiddleware(bridge, {
        headers: {
          'X-Custom-Header': 'test-value',
        },
      });

      const ctx = createMockContext({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Hello!' }],
        },
      });

      await middleware(ctx, mockNext);

      expect(ctx._headers['x-custom-header']).toBe('test-value');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight request', async () => {
      const middleware = KoaMiddleware(bridge, {
        cors: true,
      });

      const ctx = createMockContext({
        method: 'OPTIONS',
        url: '/v1/messages',
        headers: {
          origin: 'http://example.com',
          'access-control-request-method': 'POST',
        },
      });

      await middleware(ctx, mockNext);

      expect(ctx._status).toBe(204);
      expect(ctx._headers['access-control-allow-origin']).toBeTruthy();
    });

    it('should add CORS headers to responses', async () => {
      const middleware = KoaMiddleware(bridge, {
        cors: true,
      });

      const ctx = createMockContext({
        method: 'POST',
        url: '/v1/messages',
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

      await middleware(ctx, mockNext);

      expect(ctx._headers['access-control-allow-origin']).toBeTruthy();
    });

    it('should reject disallowed origins', async () => {
      const middleware = KoaMiddleware(bridge, {
        cors: {
          origin: ['http://allowed.com'],
        },
      });

      const ctx = createMockContext({
        method: 'POST',
        url: '/v1/messages',
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

      await middleware(ctx, mockNext);

      expect(ctx._status).toBe(403);
    });
  });

  describe('Authentication', () => {
    it('should validate bearer tokens', async () => {
      const middleware = KoaMiddleware(bridge, {
        validateAuth: createBearerTokenValidator(['valid-token']),
      });

      const ctx = createMockContext({
        method: 'POST',
        url: '/v1/messages',
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

      await middleware(ctx, mockNext);

      expect(ctx._status).toBe(200);
    });

    it('should reject invalid tokens', async () => {
      const middleware = KoaMiddleware(bridge, {
        validateAuth: createBearerTokenValidator(['valid-token']),
      });

      const ctx = createMockContext({
        method: 'POST',
        url: '/v1/messages',
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

      await middleware(ctx, mockNext);

      expect(ctx._status).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const middleware = KoaMiddleware(bridge, {
        rateLimit: {
          max: 2,
          windowMs: 1000,
        },
      });

      const makeRequest = async () => {
        const ctx = createMockContext({
          method: 'POST',
          url: '/v1/messages',
          headers: {
            'content-type': 'application/json',
          },
          body: {
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            messages: [{ role: 'user', content: 'Hello!' }],
          },
        });

        await middleware(ctx, mockNext);
        return ctx;
      };

      // First two requests should succeed
      const ctx1 = await makeRequest();
      expect(ctx1._status).toBe(200);

      const ctx2 = await makeRequest();
      expect(ctx2._status).toBe(200);

      // Third request should be rate limited
      const ctx3 = await makeRequest();
      expect(ctx3._status).toBe(429);
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
      const middleware = KoaMiddleware(errorBridge);

      const ctx = createMockContext({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Hello!' }],
        },
      });

      await middleware(ctx, mockNext);

      expect(ctx._status).toBeGreaterThanOrEqual(500);
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
      const middleware = KoaMiddleware(errorBridge, {
        onError: async (error, req, res) => {
          errorHandlerCalled = true;
          res.status(418);
          res.send({ custom: 'error' });
        },
      });

      const ctx = createMockContext({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Hello!' }],
        },
      });

      await middleware(ctx, mockNext);

      expect(errorHandlerCalled).toBe(true);
      expect(ctx._status).toBe(418);
    });
  });
});
