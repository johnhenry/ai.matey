/**
 * HTTP upgrade tests
 *
 * Covers the Prometheus metrics module, built-in health/metrics/embeddings
 * endpoints on CoreHTTPHandler, per-route rate limiting, and the WebSocket
 * streaming handler with a fake socket.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  CoreHTTPHandler,
  formatPrometheus,
  collectBridgeMetrics,
  type GenericRequest,
  type GenericResponse,
} from 'ai.matey.http.core';
import { createWebSocketHandler, type WebSocketLike } from 'ai.matey.http/websocket';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend';
import { MockBackendAdapter } from 'ai.matey.backend.browser';
import type {
  AdapterMetadata,
  BackendAdapter,
  IREmbedRequest,
  IREmbedResponse,
} from 'ai.matey.types';

// ============================================================================
// Helpers
// ============================================================================

function makeRequest(overrides: Partial<GenericRequest> = {}): GenericRequest {
  return {
    method: 'GET',
    url: '/health',
    headers: {},
    body: null,
    ip: '127.0.0.1',
    ...overrides,
  };
}

interface CapturedResponse extends GenericResponse {
  statusCode: number;
  sent: unknown;
  headers: Record<string, string>;
}

function makeResponse(): CapturedResponse {
  const captured: CapturedResponse = {
    statusCode: 200,
    sent: undefined,
    headers: {},
    status(code) {
      captured.statusCode = code;
    },
    header(name, value) {
      captured.headers[name] = value;
    },
    send(data) {
      captured.sent = data;
    },
    stream: () => Promise.resolve(),
    isWritable: () => true,
  };
  return captured;
}

function makeBridge(backend?: BackendAdapter): Bridge {
  return new Bridge(
    new OpenAIFrontendAdapter(),
    backend ?? new MockBackendAdapter({ defaultResponse: 'ok' })
  );
}

function embedBackend(): BackendAdapter {
  const metadata: AdapterMetadata = {
    name: 'embed-mock',
    version: '1.0.0',
    provider: 'Mock',
    capabilities: {
      streaming: false,
      multiModal: false,
      tools: false,
      embeddings: true,
      systemMessageStrategy: 'in-messages',
      supportsMultipleSystemMessages: false,
    },
  };
  return {
    metadata,
    fromIR: (request) => request,
    toIR: () => {
      throw new Error('unused');
    },
    execute: () => {
      throw new Error('unused');
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock generator interface
    executeStream: async function* () {
      throw new Error('unused');
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock interface
    embed: async (request: IREmbedRequest): Promise<IREmbedResponse> => {
      const inputs = typeof request.input === 'string' ? [request.input] : request.input;
      return {
        embeddings: inputs.map((_, index) => ({ index, vector: [0.1, 0.2] })),
        model: request.parameters?.model ?? 'mock-embed',
        dimensions: 2,
        usage: { promptTokens: inputs.length, totalTokens: inputs.length },
        metadata: request.metadata,
      };
    },
  };
}

// ============================================================================
// Prometheus formatting
// ============================================================================

describe('formatPrometheus', () => {
  it('formats samples with headers and escaped labels', () => {
    const text = formatPrometheus([
      { name: 'x_total', type: 'counter', help: 'Total x', value: 3 },
      { name: 'x_total', type: 'counter', labels: { backend: 'a"b' }, value: 4 },
      { name: 'y_gauge', type: 'gauge', value: 1.5 },
    ]);

    expect(text).toContain('# HELP x_total Total x');
    expect(text).toContain('# TYPE x_total counter');
    expect(text).toContain('x_total 3');
    expect(text).toContain('x_total{backend="a\\"b"} 4');
    expect(text).toContain('y_gauge 1.5');
    // Header emitted once per metric name
    expect(text.match(/# TYPE x_total/g)).toHaveLength(1);
  });

  it('collects bridge counters', async () => {
    const bridge = makeBridge();
    await bridge.chat({ model: 'm', messages: [{ role: 'user', content: 'hi' }] });

    const samples = collectBridgeMetrics(bridge);
    const total = samples.find((sample) => sample.name === 'ai_matey_requests_total');
    expect(total?.value).toBe(1);
  });
});

// ============================================================================
// Built-in endpoints
// ============================================================================

describe('CoreHTTPHandler built-in endpoints', () => {
  it('serves /health, /health/ready, and /health/live', async () => {
    const handler = new CoreHTTPHandler({
      bridge: makeBridge(),
      health: { enabled: true },
    });

    for (const path of ['/health', '/health/ready', '/health/live']) {
      const res = makeResponse();
      await handler.handle(makeRequest({ url: path }), res);
      expect(res.statusCode, path).toBe(200);
      expect(res.sent, path).toBeDefined();
    }

    handler.dispose();
  });

  it('serves Prometheus metrics and honors auth', async () => {
    const handler = new CoreHTTPHandler({
      bridge: makeBridge(),
      metrics: { enabled: true },
      validateAuth: (req) => req.headers.authorization === 'Bearer ok',
    });

    const denied = makeResponse();
    await handler.handle(makeRequest({ url: '/metrics' }), denied);
    expect(denied.statusCode).toBe(401);

    const allowed = makeResponse();
    await handler.handle(
      makeRequest({ url: '/metrics', headers: { authorization: 'Bearer ok' } }),
      allowed
    );
    expect(allowed.statusCode).toBe(200);
    expect(String(allowed.sent)).toContain('ai_matey_requests_total');

    handler.dispose();
  });

  it('serves OpenAI-format embeddings', async () => {
    const handler = new CoreHTTPHandler({
      bridge: makeBridge(embedBackend()),
      embeddings: { enabled: true },
    });

    const res = makeResponse();
    await handler.handle(
      makeRequest({
        method: 'POST',
        url: '/v1/embeddings',
        body: { model: 'mock-embed', input: ['a', 'b'] },
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    const body = res.sent as { object: string; data: unknown[] };
    expect(body.object).toBe('list');
    expect(body.data).toHaveLength(2);

    handler.dispose();
  });

  it('rejects embeddings requests missing model/input', async () => {
    const handler = new CoreHTTPHandler({
      bridge: makeBridge(embedBackend()),
      embeddings: { enabled: true },
    });

    const res = makeResponse();
    await handler.handle(
      makeRequest({ method: 'POST', url: '/v1/embeddings', body: { model: 'x' } }),
      res
    );
    expect(res.statusCode).toBe(400);

    handler.dispose();
  });
});

// ============================================================================
// Per-route rate limiting
// ============================================================================

describe('per-route rate limiting', () => {
  it('applies the route limit instead of the global one', async () => {
    const handler = new CoreHTTPHandler({
      bridge: makeBridge(),
      rateLimit: { max: 100 },
      routes: [
        {
          path: '/v1/chat/completions',
          frontend: new OpenAIFrontendAdapter(),
          rateLimit: { max: 1 },
        },
      ],
    });

    const request = () =>
      makeRequest({
        method: 'POST',
        url: '/v1/chat/completions',
        body: { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
      });

    const first = makeResponse();
    await handler.handle(request(), first);
    expect(first.statusCode).toBe(200);

    const second = makeResponse();
    await handler.handle(request(), second);
    expect(second.statusCode).toBe(429);

    handler.dispose();
  });
});

// ============================================================================
// WebSocket handler
// ============================================================================

interface FakeSocket extends WebSocketLike {
  emit(type: 'message' | 'close' | 'error', data?: unknown): void;
  outbox: Array<{ type: string; [key: string]: unknown }>;
}

function makeFakeSocket(): FakeSocket {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const outbox: FakeSocket['outbox'] = [];
  return {
    outbox,
    send(data: string) {
      outbox.push(JSON.parse(data) as FakeSocket['outbox'][number]);
    },
    close: vi.fn(),
    on(type, listener) {
      const existing = listeners.get(type) ?? [];
      existing.push(listener);
      listeners.set(type, existing);
    },
    emit(type, data) {
      for (const listener of listeners.get(type) ?? []) {
        listener(data);
      }
    },
  };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

describe('createWebSocketHandler', () => {
  it('streams chat over the socket protocol', async () => {
    const bridge = makeBridge(new MockBackendAdapter({ defaultResponse: 'streamed reply' }));
    const socket = makeFakeSocket();

    createWebSocketHandler(bridge, { heartbeatMs: 0 })(socket);

    socket.emit(
      'message',
      JSON.stringify({
        type: 'chat',
        id: 'req-1',
        request: { model: 'm', messages: [{ role: 'user', content: 'hi' }], stream: true },
      })
    );
    await settle();

    const types = socket.outbox.map((message) => message.type);
    expect(types[0]).toBe('start');
    expect(types).toContain('chunk');
    expect(types[types.length - 1]).toBe('done');
    expect(socket.outbox.every((message) => message.type === 'ping' || message.id === 'req-1')).toBe(
      true
    );
  });

  it('rejects malformed JSON', async () => {
    const socket = makeFakeSocket();
    createWebSocketHandler(makeBridge(), { heartbeatMs: 0 })(socket);

    socket.emit('message', 'not json{');
    await settle();

    expect(socket.outbox[0]).toMatchObject({ type: 'error', id: null });
  });

  it('enforces the concurrent stream limit', async () => {
    const slowBackend = new MockBackendAdapter({ defaultResponse: 'slow' });
    const originalStream = slowBackend.executeStream.bind(slowBackend);
    slowBackend.executeStream = async function* (request, signal) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield* originalStream(request, signal);
    };

    const socket = makeFakeSocket();
    createWebSocketHandler(makeBridge(slowBackend), {
      heartbeatMs: 0,
      maxConcurrentStreams: 1,
    })(socket);

    const chat = (id: string) =>
      socket.emit(
        'message',
        JSON.stringify({
          type: 'chat',
          id,
          request: { model: 'm', messages: [{ role: 'user', content: 'hi' }], stream: true },
        })
      );

    chat('a');
    await new Promise((resolve) => setTimeout(resolve, 5));
    chat('b');
    await settle();

    expect(
      socket.outbox.some((message) => message.type === 'error' && message.id === 'b')
    ).toBe(true);
  });
});
