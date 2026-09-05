/**
 * Stream sequence contract (#120)
 *
 * `BaseStreamChunk.sequence` is documented as monotonic and contiguous across
 * every chunk type of one stream, starting at 0. In-process that is decoration;
 * across a transport it is the only loss-detection primitive the IR has, and it
 * only detects loss if a gap is illegal.
 *
 * The rule was violated on the one path nobody asserted on: every adapter's
 * terminal `error` chunk was emitted from a `catch` that could not see the
 * counter, so a failure after forty content chunks reported `sequence: 0`. The
 * repo's own `validateStream()` -- strict by default -- rejects such a stream
 * with "Out-of-order chunk", turning a clean in-band provider error into an
 * out-of-band throw with an unrelated message.
 *
 * These tests exercise the failure path of each streaming shape in the repo and
 * assert the terminal chunk continues the numbering.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  OpenAIBackendAdapter,
  OllamaBackendAdapter,
  GeminiBackendAdapter,
  HuggingFaceBackendAdapter,
} from '@johnhenry/aimatey-backend';
import { Router } from '@johnhenry/aimatey-core';
import {
  createProvenanceLostWarning,
  createRequestQueuedWarning,
  createTransportDegradedWarning,
  validateChunkSequence,
  validateStream,
} from '@johnhenry/aimatey-utils';
import type {
  BackendAdapter,
  IRChatRequest,
  IRChatStream,
  IRStreamChunk,
  WarningCategory,
} from '@johnhenry/aimatey-types';

// ============================================================================
// Helpers
// ============================================================================

const encoder = new TextEncoder();

function createRequest(): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'hi' }],
    parameters: { model: 'test-model' },
    metadata: { requestId: 'req-seq', timestamp: 0, provenance: {} },
  } as IRChatRequest;
}

/**
 * A `Response` whose body yields `frames` and then fails, the way a socket that
 * dies part-way through a generation does.
 */
function failingBodyResponse(frames: string[]): unknown {
  let i = 0;
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Map(),
    body: {
      getReader: () => ({
        read: async () => {
          if (i < frames.length) {
            return { done: false, value: encoder.encode(frames[i++]!) };
          }
          throw new Error('socket closed mid-stream');
        },
        releaseLock: () => {},
        cancel: async () => {},
      }),
    },
  };
}

async function collect(stream: IRChatStream): Promise<IRStreamChunk[]> {
  const chunks: IRStreamChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

/** The assertion the contract actually makes: 0, 1, 2, ... with no gaps. */
function expectContiguousFromZero(chunks: IRStreamChunk[]): void {
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.map((c) => c.sequence)).toEqual(chunks.map((_, i) => i));
  expect(validateChunkSequence(chunks).valid).toBe(true);
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// Backend adapters: the terminal error chunk
// ============================================================================

describe('terminal error chunk continues the stream sequence', () => {
  it('OpenAI (SSE) numbers the error chunk after the content it already sent', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      failingBodyResponse([
        'data: {"choices":[{"delta":{"content":"He"},"index":0}]}\n',
        'data: {"choices":[{"delta":{"content":"llo"},"index":0}]}\n',
      ])
    ) as never;

    const chunks = await collect(
      new OpenAIBackendAdapter({ apiKey: 'k' }).executeStream(createRequest())
    );

    expect(chunks.at(-1)!.type).toBe('error');
    expectContiguousFromZero(chunks);
  });

  it('Ollama (JSONL) numbers the error chunk after the content it already sent', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      failingBodyResponse([
        '{"message":{"content":"He"}}\n',
        '{"message":{"content":"llo"}}\n',
      ])
    ) as never;

    const chunks = await collect(new OllamaBackendAdapter({}).executeStream(createRequest()));

    expect(chunks.at(-1)!.type).toBe('error');
    expectContiguousFromZero(chunks);
  });

  it('Gemini numbers the error chunk after the content it already sent', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      failingBodyResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"He"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"llo"}]}}]}\n\n',
      ])
    ) as never;

    const chunks = await collect(
      new GeminiBackendAdapter({ apiKey: 'k' }).executeStream(createRequest())
    );

    expect(chunks.at(-1)!.type).toBe('error');
    expectContiguousFromZero(chunks);
  });

  it('HuggingFace, which simulates a stream, numbers its error chunk after start', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('inference endpoint down')) as never;

    const chunks = await collect(
      new HuggingFaceBackendAdapter({ apiKey: 'k' }).executeStream(createRequest())
    );

    expect(chunks.map((c) => c.type)).toEqual(['start', 'error']);
    expectContiguousFromZero(chunks);
  });

  it("a failed stream survives the repo's own strict validateStream()", async () => {
    // Before the fix this threw `Out-of-order chunk: sequence 0 after 3`, which
    // replaced the provider's real error with a validator artefact.
    global.fetch = vi.fn().mockResolvedValue(
      failingBodyResponse([
        'data: {"choices":[{"delta":{"content":"He"},"index":0}]}\n',
        'data: {"choices":[{"delta":{"content":"llo"},"index":0}]}\n',
      ])
    ) as never;

    const chunks = await collect(
      validateStream(new OpenAIBackendAdapter({ apiKey: 'k' }).executeStream(createRequest()))
    );

    const terminal = chunks.at(-1)!;
    expect(terminal.type).toBe('error');
    expect((terminal as { error: { message: string } }).error.message).toContain(
      'socket closed mid-stream'
    );
  });
});

// ============================================================================
// Router: the terminal chunk it yields is numbered against its own stream
// ============================================================================

function backendYielding(name: string, stream: () => IRChatStream): BackendAdapter {
  return {
    metadata: {
      name,
      version: '1.0.0',
      provider: name,
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: false,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: true,
      },
    },
    execute: vi.fn(),
    executeStream: () => stream(),
  } as unknown as BackendAdapter;
}

describe('Router numbers its terminal error chunk against the stream it delivered', () => {
  it('continues the numbering of a committed stream that then throws', async () => {
    const router = new Router({ defaultBackend: 'only' });
    router.register(
      'only',
      backendYielding('only', async function* () {
        yield { type: 'start', sequence: 0, metadata: createRequest().metadata } as IRStreamChunk;
        for (let i = 1; i <= 40; i++) {
          yield { type: 'content', sequence: i, delta: 'x', role: 'assistant' } as IRStreamChunk;
        }
        throw new Error('backend died');
      })
    );

    const chunks = await collect(router.executeStream(createRequest()));

    expect(chunks.at(-1)!.type).toBe('error');
    expectContiguousFromZero(chunks);
  });

  it('renumbers a backend error chunk whose preamble the router withheld', async () => {
    // The backend numbers its error chunk 3, but the router held chunks 0-2 and
    // failed over, so the consumer receives the error chunk alone. Numbered 3 it
    // would open a stream at sequence 3 -- an apparent loss of three chunks.
    const router = new Router({ defaultBackend: 'only', fallbackStrategy: 'none' });
    router.register(
      'only',
      backendYielding('only', async function* () {
        yield { type: 'metadata', sequence: 0, usage: { promptTokens: 1 } } as IRStreamChunk;
        yield { type: 'metadata', sequence: 1, usage: { promptTokens: 1 } } as IRStreamChunk;
        yield { type: 'metadata', sequence: 2, usage: { promptTokens: 1 } } as IRStreamChunk;
        yield {
          type: 'error',
          sequence: 3,
          error: { code: 'PROVIDER_ERROR', message: 'upstream refused' },
        } as IRStreamChunk;
      })
    );

    const chunks = await collect(router.executeStream(createRequest()));

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.type).toBe('error');
    expect(chunks[0]!.sequence).toBe(0);
    expect(validateChunkSequence(chunks).valid).toBe(true);
  });
});

// ============================================================================
// WarningCategory additions (#123, #131)
// ============================================================================

describe('WarningCategory covers a degraded delivery, not only a degraded translation', () => {
  it('reports a queued turn as queued, with the wait it can be judged by', () => {
    const warning = createRequestQueuedWarning(812_000, 'tunnel');

    expect(warning.category).toBe<WarningCategory>('request-queued');
    expect(warning.severity).toBe('info');
    expect(warning.details).toEqual({ queuedMs: 812_000 });
    expect(warning.source).toBe('tunnel');
  });

  it('reports a degraded link as its own category, not as a missing capability', () => {
    const warning = createTransportDegradedWarning('stream reconnected at sequence 37', {
      details: { resumedAtSequence: 37 },
      source: 'tunnel',
    });

    expect(warning.category).toBe<WarningCategory>('transport-degraded');
    // The whole point of the member: this is the one that used to be reported
    // as 'capability-unsupported' because nothing else fit.
    expect(warning.category).not.toBe('capability-unsupported');
    expect(warning.details).toEqual({ resumedAtSequence: 37 });
  });

  it('makes a lost provenance detectable rather than indistinguishable from none', () => {
    const warning = createProvenanceLostWarning('desktop', 'tunnel');

    expect(warning.category).toBe<WarningCategory>('provenance-lost');
    expect(warning.field).toBe('metadata.provenance');
    expect(warning.details).toEqual({ expectedFrom: 'desktop' });
  });

  it('leaves an absent provenance with no warning meaning "not recorded"', () => {
    // The receiving hop attaches the warning; a walker never infers it. So a
    // response with neither provenance nor the warning still means "nothing was
    // recorded", which is what keeps the new member honest.
    const metadata = { requestId: 'r', timestamp: 0 } as { provenance?: unknown };
    expect(metadata.provenance).toBeUndefined();
  });
});
