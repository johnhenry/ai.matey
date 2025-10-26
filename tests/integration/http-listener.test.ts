/**
 * HTTP Listener Integration Tests
 *
 * Tests the HTTP listener functionality including request parsing, response formatting,
 * CORS, authentication, rate limiting, and streaming.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';
import { Readable } from 'stream';
import { NodeHTTPListener, createSimpleListener } from '../../src/http/listener.js';
import { Bridge } from '../../src/core/bridge.js';
import { AnthropicFrontendAdapter } from '../../src/adapters/frontend/anthropic.js';
import { OpenAIFrontendAdapter } from '../../src/adapters/frontend/openai.js';
import type { BackendAdapter } from '../../src/types/adapters.js';
import type { IRChatRequest, IRChatResponse } from '../../src/types/ir.js';
import { createBearerTokenValidator } from '../../src/http/auth.js';

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
// Mock HTTP Request/Response
// ============================================================================

function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
}): IncomingMessage {
  const req = new Readable() as IncomingMessage;
  req.method = options.method || 'POST';
  req.url = options.url || '/v1/messages';
  req.headers = options.headers || {};

  // Add socket for IP address detection
  (req as any).socket = {
    remoteAddress: '127.0.0.1',
  };

  // Simulate request body
  if (options.body) {
    const bodyStr = JSON.stringify(options.body);
    req.push(bodyStr);
    req.push(null);
  } else {
    req.push(null);
  }

  return req;
}

function createMockResponse(): ServerResponse & {
  _statusCode?: number;
  _headers: Record<string, string>;
  _body: string;
  _chunks: string[];
} {
  const res: any = {
    statusCode: 200,
    _statusCode: undefined,
    _headers: {},
    _body: '',
    _chunks: [],
    writable: true,
    _eventListeners: {} as Record<string, Function[]>,

    setHeader(name: string, value: string) {
      this._headers[name.toLowerCase()] = value;
    },

    getHeader(name: string) {
      return this._headers[name.toLowerCase()];
    },

    write(chunk: string) {
      this._chunks.push(chunk);
    },

    end(data?: string) {
      if (data) {
        this._body = data;
      }
      this.writable = false;
    },

    flushHeaders() {
      // No-op for mock
    },

    on(event: string, callback: Function) {
      if (!this._eventListeners[event]) {
        this._eventListeners[event] = [];
      }
      this._eventListeners[event].push(callback);
    },
  };

  Object.defineProperty(res, 'statusCode', {
    get() {
      return this._statusCode ?? 200;
    },
    set(value) {
      this._statusCode = value;
    },
  });

  return res as ServerResponse & {
    _statusCode?: number;
    _headers: Record<string, string>;
    _body: string;
    _chunks: string[];
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('HTTP Listener', () => {
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
      const listener = NodeHTTPListener(bridge);

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

      await listener(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._body).toBeTruthy();

      const response = JSON.parse(res._body);
      expect(response).toBeDefined();
    });

    it('should return 400 for missing body', async () => {
      const listener = NodeHTTPListener(bridge);

      const req = createMockRequest({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'content-type': 'application/json',
        },
      });

      const res = createMockResponse();

      await listener(req, res);

      expect(res.statusCode).toBe(400);
    });

    it('should apply custom headers', async () => {
      const listener = NodeHTTPListener(bridge, {
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

      await listener(req, res);

      expect(res._headers['x-custom-header']).toBe('test-value');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight request', async () => {
      const listener = NodeHTTPListener(bridge, {
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

      await listener(req, res);

      expect(res.statusCode).toBe(204);
      expect(res._headers['access-control-allow-origin']).toBeTruthy();
    });

    it('should add CORS headers to responses', async () => {
      const listener = NodeHTTPListener(bridge, {
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

      await listener(req, res);

      expect(res._headers['access-control-allow-origin']).toBeTruthy();
    });

    it('should reject disallowed origins', async () => {
      const listener = NodeHTTPListener(bridge, {
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

      await listener(req, res);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Authentication', () => {
    it('should validate bearer tokens', async () => {
      const listener = NodeHTTPListener(bridge, {
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

      await listener(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('should reject invalid tokens', async () => {
      const listener = NodeHTTPListener(bridge, {
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

      await listener(req, res);

      expect(res.statusCode).toBe(401);
    });

    it('should reject requests without auth header', async () => {
      const listener = NodeHTTPListener(bridge, {
        validateAuth: createBearerTokenValidator(['valid-token']),
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

      await listener(req, res);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const listener = NodeHTTPListener(bridge, {
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
        await listener(req, res);
        return res;
      };

      // First two requests should succeed
      const res1 = await makeRequest();
      expect(res1.statusCode).toBe(200);

      const res2 = await makeRequest();
      expect(res2.statusCode).toBe(200);

      // Third request should be rate limited
      const res3 = await makeRequest();
      expect(res3.statusCode).toBe(429);
    });

    it('should include rate limit headers', async () => {
      const listener = NodeHTTPListener(bridge, {
        rateLimit: {
          max: 10,
          windowMs: 60000,
          headers: true,
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

      await listener(req, res);

      expect(res._headers['x-ratelimit-limit']).toBe('10');
      expect(res._headers['x-ratelimit-remaining']).toBe('9');
      expect(res._headers['x-ratelimit-reset']).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle backend errors', async () => {
      // Create backend that throws error
      const errorBackend: BackendAdapter = {
        ...backend,
        async execute() {
          throw new Error('Backend error');
        },
      };

      const errorBridge = new Bridge(frontend, errorBackend);
      const listener = NodeHTTPListener(errorBridge);

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

      await listener(req, res);

      expect(res.statusCode).toBeGreaterThanOrEqual(500);
      expect(res._body).toContain('error');
    });

    it('should use custom error handler', async () => {
      let errorHandlerCalled = false;

      // Create backend that throws error
      const errorBackend: BackendAdapter = {
        ...backend,
        async execute() {
          throw new Error('Test error');
        },
      };

      const errorBridge = new Bridge(frontend, errorBackend);
      const errorListener = NodeHTTPListener(errorBridge, {
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

      await errorListener(req, res);

      expect(errorHandlerCalled).toBe(true);
      expect(res.statusCode).toBe(418);
    });
  });

  describe('Simple Listener', () => {
    it('should create simple listener with defaults', async () => {
      const listener = createSimpleListener(bridge);

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

      await listener(req, res);

      expect(res.statusCode).toBe(200);
    });
  });
});
