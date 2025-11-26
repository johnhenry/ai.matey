/**
 * Fastify Adapter Tests
 *
 * Tests the Fastify handler functionality including request parsing, response formatting,
 * CORS, authentication, rate limiting, and streaming.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { FastifyHandler } from 'ai.matey.http.fastify';
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
// Mock Fastify Request/Reply
// ============================================================================

function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
}): FastifyRequest {
  const req: any = {
    method: options.method || 'POST',
    url: options.url || '/v1/messages',
    headers: options.headers || {},
    body: options.body || null,
    params: options.params || {},
    query: options.query || {},
    ip: '127.0.0.1',
    socket: {
      remoteAddress: '127.0.0.1',
    },
  };

  return req as FastifyRequest;
}

function createMockReply(): FastifyReply & {
  _statusCode: number;
  _headers: Record<string, string>;
  _body: any;
  sent: boolean;
} {
  const reply: any = {
    _statusCode: 200,
    _headers: {},
    _body: null,
    sent: false,

    raw: {
      headersSent: false,
      writable: true,
      setHeader(name: string, value: string) {
        reply._headers[name.toLowerCase()] = value;
      },
      write(chunk: string) {
        // No-op for mock
      },
      end(data?: string) {
        reply.sent = true;
      },
      flushHeaders() {
        // No-op for mock
      },
    },

    code(statusCode: number) {
      this._statusCode = statusCode;
      return this;
    },

    header(name: string, value: string) {
      this._headers[name.toLowerCase()] = value;
      return this;
    },

    send(data: any) {
      this._body = data;
      this.sent = true;
      return this;
    },
  };

  return reply as FastifyReply & {
    _statusCode: number;
    _headers: Record<string, string>;
    _body: any;
    sent: boolean;
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Fastify Adapter', () => {
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
      const handler = FastifyHandler(bridge);

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

      const reply = createMockReply();

      await handler(req, reply);

      expect(reply._statusCode).toBe(200);
      expect(reply._body).toBeTruthy();
    });

    it('should return 400 for missing body', async () => {
      const handler = FastifyHandler(bridge);

      const req = createMockRequest({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'content-type': 'application/json',
        },
        body: null,
      });

      const reply = createMockReply();

      await handler(req, reply);

      expect(reply._statusCode).toBe(400);
    });

    it('should apply custom headers', async () => {
      const handler = FastifyHandler(bridge, {
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

      const reply = createMockReply();

      await handler(req, reply);

      expect(reply._headers['x-custom-header']).toBe('test-value');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight request', async () => {
      const handler = FastifyHandler(bridge, {
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

      const reply = createMockReply();

      await handler(req, reply);

      expect(reply._statusCode).toBe(204);
      expect(reply._headers['access-control-allow-origin']).toBeTruthy();
    });

    it('should add CORS headers to responses', async () => {
      const handler = FastifyHandler(bridge, {
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

      const reply = createMockReply();

      await handler(req, reply);

      expect(reply._headers['access-control-allow-origin']).toBeTruthy();
    });

    it('should reject disallowed origins', async () => {
      const handler = FastifyHandler(bridge, {
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

      const reply = createMockReply();

      await handler(req, reply);

      expect(reply._statusCode).toBe(403);
    });
  });

  describe('Authentication', () => {
    it('should validate bearer tokens', async () => {
      const handler = FastifyHandler(bridge, {
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

      const reply = createMockReply();

      await handler(req, reply);

      expect(reply._statusCode).toBe(200);
    });

    it('should reject invalid tokens', async () => {
      const handler = FastifyHandler(bridge, {
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

      const reply = createMockReply();

      await handler(req, reply);

      expect(reply._statusCode).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const handler = FastifyHandler(bridge, {
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

        const reply = createMockReply();
        await handler(req, reply);
        return reply;
      };

      // First two requests should succeed
      const reply1 = await makeRequest();
      expect(reply1._statusCode).toBe(200);

      const reply2 = await makeRequest();
      expect(reply2._statusCode).toBe(200);

      // Third request should be rate limited
      const reply3 = await makeRequest();
      expect(reply3._statusCode).toBe(429);
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
      const handler = FastifyHandler(errorBridge);

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

      const reply = createMockReply();

      await handler(req, reply);

      expect(reply._statusCode).toBeGreaterThanOrEqual(500);
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
      const handler = FastifyHandler(errorBridge, {
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

      const reply = createMockReply();

      await handler(req, reply);

      expect(errorHandlerCalled).toBe(true);
      expect(reply._statusCode).toBe(418);
    });
  });
});
