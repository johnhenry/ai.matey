/**
 * Express Adapter Tests
 *
 * Tests the Express middleware functionality including request parsing, response formatting,
 * CORS, authentication, rate limiting, and streaming.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ExpressMiddleware } from 'ai.matey.http.express';
import { Bridge } from 'ai.matey.core';
import { AnthropicFrontendAdapter } from 'ai.matey.frontend.anthropic';
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
// Mock Express Request/Response
// ============================================================================

function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
}): Request {
  const req: any = {
    method: options.method || 'POST',
    url: options.url || '/v1/messages',
    originalUrl: options.url || '/v1/messages',
    headers: options.headers || {},
    body: options.body || null,
    params: options.params || {},
    query: options.query || {},
    ip: '127.0.0.1',
    socket: {
      remoteAddress: '127.0.0.1',
    },
  };

  return req as Request;
}

function createMockResponse(): Response & {
  _statusCode: number;
  _headers: Record<string, string>;
  _body: any;
  _chunks: string[];
} {
  const res: any = {
    _statusCode: 200,
    _headers: {},
    _body: null,
    _chunks: [],
    headersSent: false,
    writable: true,

    status(code: number) {
      this._statusCode = code;
      return this;
    },

    setHeader(name: string, value: string) {
      this._headers[name.toLowerCase()] = value;
    },

    getHeader(name: string) {
      return this._headers[name.toLowerCase()];
    },

    json(data: any) {
      this._body = data;
      this.headersSent = true;
      return this;
    },

    send(data: any) {
      this._body = data;
      this.headersSent = true;
      return this;
    },

    write(chunk: string) {
      this._chunks.push(chunk);
    },

    end(data?: string) {
      if (data) {
        this._body = data;
      }
      this.headersSent = true;
      this.writable = false;
    },

    flushHeaders() {
      // No-op for mock
    },
  };

  Object.defineProperty(res, 'statusCode', {
    get() {
      return this._statusCode;
    },
    set(value) {
      this._statusCode = value;
    },
  });

  return res as Response & {
    _statusCode: number;
    _headers: Record<string, string>;
    _body: any;
    _chunks: string[];
  };
}

function createMockNext(): NextFunction {
  return ((error?: any) => {
    if (error) {
      throw error;
    }
  }) as NextFunction;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Express Adapter', () => {
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
      const middleware = ExpressMiddleware(bridge);

      const req = createMockRequest({
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

      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res._statusCode).toBe(200);
      expect(res._body).toBeTruthy();
    });

    it('should return 400 for missing body', async () => {
      const middleware = ExpressMiddleware(bridge);

      const req = createMockRequest({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'content-type': 'application/json',
        },
        body: null,
      });

      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res._statusCode).toBe(400);
    });

    it('should apply custom headers', async () => {
      const middleware = ExpressMiddleware(bridge, {
        headers: {
          'X-Custom-Header': 'test-value',
        },
      });

      const req = createMockRequest({
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

      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res._headers['x-custom-header']).toBe('test-value');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight request', async () => {
      const middleware = ExpressMiddleware(bridge, {
        cors: true,
      });

      const req = createMockRequest({
        method: 'OPTIONS',
        url: '/v1/messages',
        headers: {
          origin: 'http://example.com',
          'access-control-request-method': 'POST',
        },
      });

      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res._statusCode).toBe(204);
      expect(res._headers['access-control-allow-origin']).toBeTruthy();
    });

    it('should add CORS headers to responses', async () => {
      const middleware = ExpressMiddleware(bridge, {
        cors: true,
      });

      const req = createMockRequest({
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

      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res._headers['access-control-allow-origin']).toBeTruthy();
    });

    it('should reject disallowed origins', async () => {
      const middleware = ExpressMiddleware(bridge, {
        cors: {
          origin: ['http://allowed.com'],
        },
      });

      const req = createMockRequest({
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

      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res._statusCode).toBe(403);
    });
  });

  describe('Authentication', () => {
    it('should validate bearer tokens', async () => {
      const middleware = ExpressMiddleware(bridge, {
        validateAuth: createBearerTokenValidator(['valid-token']),
      });

      const req = createMockRequest({
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

      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res._statusCode).toBe(200);
    });

    it('should reject invalid tokens', async () => {
      const middleware = ExpressMiddleware(bridge, {
        validateAuth: createBearerTokenValidator(['valid-token']),
      });

      const req = createMockRequest({
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

      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res._statusCode).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const middleware = ExpressMiddleware(bridge, {
        rateLimit: {
          max: 2,
          windowMs: 1000,
        },
      });

      const makeRequest = async () => {
        const req = createMockRequest({
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

        const res = createMockResponse();
        const next = createMockNext();
        await middleware(req, res, next);
        return res;
      };

      // First two requests should succeed
      const res1 = await makeRequest();
      expect(res1._statusCode).toBe(200);

      const res2 = await makeRequest();
      expect(res2._statusCode).toBe(200);

      // Third request should be rate limited
      const res3 = await makeRequest();
      expect(res3._statusCode).toBe(429);
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
      const middleware = ExpressMiddleware(errorBridge);

      const req = createMockRequest({
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

      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res._statusCode).toBeGreaterThanOrEqual(500);
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
      const middleware = ExpressMiddleware(errorBridge, {
        onError: async (error, req, res) => {
          errorHandlerCalled = true;
          res.status(418);
          res.send({ custom: 'error' });
        },
      });

      const req = createMockRequest({
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

      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(errorHandlerCalled).toBe(true);
      expect(res._statusCode).toBe(418);
    });
  });
});
