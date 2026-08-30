/**
 * Node HTTP adapter error handling (issue #43).
 *
 * These tests drive a REAL http.Server over REAL sockets. The existing
 * http-listener suite builds hand-rolled mock req/res objects, which is exactly
 * why this class of bug survived it: a mock never destroys a socket, never
 * aborts mid-body, and never reports `headersSent`, so the failure modes below
 * are invisible to it.
 *
 * Every case asserts two things: the client gets an appropriate status code,
 * and the server process is still serving afterwards.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import net from 'node:net';
import { NodeHTTPListener } from '@johnhenry/aimatey-http';
import { Bridge } from '@johnhenry/aimatey-core';
import { AnthropicFrontendAdapter } from '@johnhenry/aimatey-frontend';
import type { BackendAdapter, IRChatRequest, IRChatResponse } from '@johnhenry/aimatey-types';

const MAX_BODY = 1024;

/** Backend that can be told to blow up asynchronously. */
class ControllableBackend implements BackendAdapter {
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

  /** When set, execute() rejects after a tick with this message. */
  failAsyncWith: string | null = null;

  async execute(request: IRChatRequest): Promise<IRChatResponse> {
    if (this.failAsyncWith) {
      await new Promise((r) => setTimeout(r, 5));
      throw new Error(this.failAsyncWith);
    }

    return {
      message: { role: 'assistant', content: 'Mock response' },
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      metadata: {
        requestId: request.metadata.requestId,
        timestamp: Date.now(),
        provenance: {
          frontend: request.metadata.provenance?.frontend,
          backend: this.metadata.name,
        },
      },
    } as IRChatResponse;
  }

  async *executeStream(): AsyncGenerator<any> {
    yield {
      type: 'message_start',
      message: {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'mock',
        usage: { input_tokens: 1, output_tokens: 0 },
      },
    };
    yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hi' } };
    yield { type: 'message_stop' };
  }
}

let server: Server;
let port: number;
let backend: ControllableBackend;
/** Server-side log lines, so we can assert errors are still reported. */
let logged: string[];

beforeAll(async () => {
  backend = new ControllableBackend();
  logged = [];

  const bridge = new Bridge(new AnthropicFrontendAdapter(), backend);

  server = createServer(
    NodeHTTPListener(bridge, {
      cors: true,
      streaming: true,
      maxBodySize: MAX_BODY,
      logging: true,
      log: (message: string, ...args: any[]) => {
        logged.push(`${message} ${args.map((a) => String(a?.message ?? a)).join(' ')}`);
      },
    })
  );

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as net.AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Send a raw byte string; optionally hang up partway through. */
function rawRequest(payload: string, opts: { abortAfterMs?: number } = {}): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    const sock = net.connect(port, '127.0.0.1', () => {
      sock.write(payload);
      if (opts.abortAfterMs !== undefined) {
        setTimeout(() => sock.destroy(), opts.abortAfterMs);
      }
    });
    sock.on('data', (d) => (data += d.toString()));
    sock.on('close', () => resolve(data));
    sock.on('error', () => resolve(data));
    setTimeout(() => {
      sock.destroy();
      resolve(data);
    }, 4000);
  });
}

function statusOf(raw: string): number | null {
  const m = raw.match(/^HTTP\/1\.1 (\d{3})/);
  return m ? Number(m[1]) : null;
}

function bodyOf(raw: string): string {
  const i = raw.indexOf('\r\n\r\n');
  return i === -1 ? '' : raw.slice(i + 4);
}

function post(body: string, headers = ''): string {
  return (
    `POST /v1/messages HTTP/1.1\r\n` +
    `Host: 127.0.0.1:${port}\r\n` +
    `Content-Type: application/json\r\n` +
    `Content-Length: ${Buffer.byteLength(body)}\r\n` +
    headers +
    `Connection: close\r\n\r\n` +
    body
  );
}

/** A well-formed request must still succeed -- proves the server is alive. */
async function expectServerStillServing(): Promise<void> {
  const raw = await rawRequest(
    post(
      JSON.stringify({
        model: 'claude-3',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 10,
      })
    )
  );
  expect(statusOf(raw)).toBe(200);
}

describe('Node HTTP adapter error handling (#43)', () => {
  it('answers 400 for an unparseable JSON payload', async () => {
    const raw = await rawRequest(post('{bad json'));

    expect(statusOf(raw)).toBe(400);
    expect(bodyOf(raw)).toContain('error');
    await expectServerStillServing();
  });

  it('answers 400 for a malformed Host header', async () => {
    const body = '{"model":"m","messages":[]}';
    const raw = await rawRequest(
      `POST /v1/messages HTTP/1.1\r\nHost: bad host\r\nContent-Type: application/json\r\n` +
        `Content-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`
    );

    expect(statusOf(raw)).toBe(400);
    await expectServerStillServing();
  });

  it('answers 413 for an oversized payload instead of dropping the connection', async () => {
    const big = JSON.stringify({
      model: 'm',
      messages: [{ role: 'user', content: 'x'.repeat(MAX_BODY * 4) }],
    });

    const raw = await rawRequest(post(big));

    // Regression guard: the parser used to req.destroy() on the size limit,
    // tearing down the socket the response had to go out on, so the client
    // received nothing at all.
    expect(statusOf(raw)).toBe(413);
    await expectServerStillServing();
  });

  it('survives a connection aborted mid-request without crashing or hanging', async () => {
    const raw = await rawRequest(
      `POST /v1/messages HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\n` +
        `Content-Type: application/json\r\nContent-Length: 5000\r\n\r\n{"model":`,
      { abortAfterMs: 30 }
    );

    // The client hung up, so there is legitimately nobody to answer; what
    // matters is that the process is still serving.
    expect(statusOf(raw)).toBeNull();
    await expectServerStillServing();
  });

  it('answers 5xx when the handler throws asynchronously', async () => {
    backend.failAsyncWith = 'backend exploded at /srv/app/packages/backend/src/secret.ts:42';
    try {
      const raw = await rawRequest(
        post(
          JSON.stringify({
            model: 'claude-3',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 10,
          })
        )
      );

      expect(statusOf(raw)).toBeGreaterThanOrEqual(500);
      expect(statusOf(raw)).toBeLessThan(600);
    } finally {
      backend.failAsyncWith = null;
    }

    await expectServerStillServing();
  });

  it('does not leak internal paths or stack frames to the client', async () => {
    backend.failAsyncWith = 'backend exploded at /srv/app/packages/backend/src/secret.ts:42';
    try {
      const raw = await rawRequest(
        post(
          JSON.stringify({
            model: 'claude-3',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 10,
          })
        )
      );

      const body = bodyOf(raw);
      expect(body).not.toContain('/srv/app');
      expect(body).not.toContain('secret.ts');
      expect(body).not.toContain('    at ');
    } finally {
      backend.failAsyncWith = null;
    }
  });

  it('still reports the failure server-side through the configured log hook', async () => {
    const before = logged.length;

    await rawRequest(post('{bad json'));

    const added = logged.slice(before).join('\n');
    expect(added).toContain('Invalid JSON body');
  });
});
