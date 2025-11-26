/**
 * Deno Adapter Tests
 *
 * Tests the Deno handler functionality including request parsing, response formatting,
 * CORS, authentication, rate limiting, and streaming.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DenoHandler } from 'ai.matey.http.deno';
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
// Mock Deno Request
// ============================================================================

function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
}): Request {
  const headers = new Headers(options.headers || {});

  const reqOptions: RequestInit = {
    method: options.method || 'POST',
    headers,
  };

  if (options.body) {
    reqOptions.body = JSON.stringify(options.body);
    headers.set('content-type', 'application/json');
  }

  return new Request(options.url || 'http://localhost/v1/messages', reqOptions);
}

const mockConnInfo = {
  remoteAddr: {
    hostname: '127.0.0.1',
  },
};

// ============================================================================
// Test Suite
// ============================================================================

describe('Deno Adapter', () => {
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
      const handler = DenoHandler(bridge);

      const req = createMockRequest({
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

      const res = await handler(req, mockConnInfo);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeTruthy();
    });

    it('should return 400 for missing body', async () => {
      const handler = DenoHandler(bridge);

      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/v1/messages',
        headers: {
          'content-type': 'application/json',
        },
      });

      const res = await handler(req, mockConnInfo);

      expect(res.status).toBe(400);
    });

    it('should apply custom headers', async () => {
      const handler = DenoHandler(bridge, {
        headers: {
          'X-Custom-Header': 'test-value',
        },
      });

      const req = createMockRequest({
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

      const res = await handler(req, mockConnInfo);

      expect(res.headers.get('X-Custom-Header')).toBe('test-value');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight request', async () => {
      const handler = DenoHandler(bridge, {
        cors: true,
      });

      const req = createMockRequest({
        method: 'OPTIONS',
        url: 'http://localhost/v1/messages',
        headers: {
          origin: 'http://example.com',
          'access-control-request-method': 'POST',
        },
      });

      const res = await handler(req, mockConnInfo);

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });

    it('should add CORS headers to responses', async () => {
      const handler = DenoHandler(bridge, {
        cors: true,
      });

      const req = createMockRequest({
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

      const res = await handler(req, mockConnInfo);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });

    it('should reject disallowed origins', async () => {
      const handler = DenoHandler(bridge, {
        cors: {
          origin: ['http://allowed.com'],
        },
      });

      const req = createMockRequest({
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

      const res = await handler(req, mockConnInfo);

      expect(res.status).toBe(403);
    });
  });

  describe('Authentication', () => {
    it('should validate bearer tokens', async () => {
      const handler = DenoHandler(bridge, {
        validateAuth: createBearerTokenValidator(['valid-token']),
      });

      const req = createMockRequest({
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

      const res = await handler(req, mockConnInfo);

      expect(res.status).toBe(200);
    });

    it('should reject invalid tokens', async () => {
      const handler = DenoHandler(bridge, {
        validateAuth: createBearerTokenValidator(['valid-token']),
      });

      const req = createMockRequest({
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

      const res = await handler(req, mockConnInfo);

      expect(res.status).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const handler = DenoHandler(bridge, {
        rateLimit: {
          max: 2,
          windowMs: 1000,
        },
      });

      const makeRequest = async () => {
        const req = createMockRequest({
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

        return await handler(req, mockConnInfo);
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
      const handler = DenoHandler(errorBridge);

      const req = createMockRequest({
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

      const res = await handler(req, mockConnInfo);

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
      const handler = DenoHandler(errorBridge, {
        onError: async (error, req, res) => {
          errorHandlerCalled = true;
          res.status(418);
          res.send({ custom: 'error' });
        },
      });

      const req = createMockRequest({
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

      const res = await handler(req, mockConnInfo);

      expect(errorHandlerCalled).toBe(true);
      expect(res.status).toBe(418);
    });
  });
});
