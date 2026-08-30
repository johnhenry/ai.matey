/**
 * Bridge Pre-Pipeline Failure Accounting Tests
 *
 * Regression tests for #60: `Bridge` increments `_totalRequests` the moment a request
 * arrives, but anything thrown before the retry loop - `frontend.toIR()`, request
 * enrichment, and the registered-backend check enrichment performs - skipped both
 * `_failedRequests` and the error event. `getStats()` then reported a request counted
 * as sent, never counted as failed, with nothing to explain the drop in `successRate`.
 */

import { describe, it, expect, vi } from 'vitest';
import { Bridge, Router } from '@johnhenry/aimatey-core';
import { GenericFrontendAdapter } from '@johnhenry/aimatey-frontend';
import { BridgeEventType } from '@johnhenry/aimatey-types';
import type {
  AdapterMetadata,
  BackendAdapter,
  BridgeEventData,
  IRCapabilities,
  IRChatRequest,
  IRChatResponse,
  IRStreamChunk,
  RequestEvent,
  StreamEvent,
} from '@johnhenry/aimatey-types';

// ============================================================================
// Test Helpers
// ============================================================================

/** Backend that answers with a fixed string; the tests here only care that it works. */
function createStaticBackend(name: string, answer: string): BackendAdapter {
  const metadata: AdapterMetadata = {
    name,
    version: '1.0.0',
    provider: 'mock',
    capabilities: {
      streaming: true,
      multiModal: false,
      tools: false,
      systemMessageStrategy: 'in-messages' as const,
    } as IRCapabilities,
  };

  return {
    metadata,
    fromIR: (request: IRChatRequest) => request,
    toIR: (response: IRChatResponse) => response,

    async execute(request: IRChatRequest): Promise<IRChatResponse> {
      return {
        message: { role: 'assistant', content: answer },
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        metadata: {
          requestId: request.metadata.requestId,
          timestamp: Date.now(),
          provenance: { backend: name },
        },
      };
    },

    async *executeStream(request: IRChatRequest): AsyncGenerator<IRStreamChunk, void, undefined> {
      yield {
        type: 'start',
        sequence: 0,
        metadata: {
          requestId: request.metadata.requestId,
          timestamp: Date.now(),
          provenance: { backend: name },
        },
      };
      yield { type: 'content', sequence: 1, delta: answer, role: 'assistant' };
      yield {
        type: 'done',
        sequence: 2,
        finishReason: 'stop',
        message: { role: 'assistant', content: answer },
      };
    },
  } as unknown as BackendAdapter;
}

const CHEAP = 'answered by CHEAP';
const EXPENSIVE = 'answered by EXPENSIVE';

function createRouter(): Router {
  const router = new Router({ routingStrategy: 'explicit', defaultBackend: 'cheap' });
  router.register('cheap', createStaticBackend('cheap', CHEAP));
  router.register('expensive', createStaticBackend('expensive', EXPENSIVE));
  return router;
}

function createBridge(backend: BackendAdapter) {
  return new Bridge(new GenericFrontendAdapter(), backend);
}

function createRequest(messages: IRChatRequest['messages'] = [{ role: 'user', content: 'Hello' }]) {
  return {
    messages,
    parameters: { model: 'test-model' },
    metadata: {
      requestId: 'req-60',
      timestamp: Date.now(),
      provenance: {},
    },
  } satisfies IRChatRequest;
}

async function drain(stream: AsyncGenerator<unknown, void, undefined>): Promise<void> {
  for await (const _chunk of stream) {
    // consume
  }
}

// ============================================================================
// #60 - failures before the pipeline are counted and announced
// ============================================================================

describe('pre-pipeline failures are accounted for (#60)', () => {
  it('counts a chat() rejected by the registered-backend check as failed', async () => {
    const bridge = createBridge(createRouter());

    await expect(bridge.chat(createRequest(), { backend: 'antropic' })).rejects.toThrow();

    const stats = bridge.getStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.failedRequests).toBe(1);
    expect(stats.successRate).toBe(0);
    expect(stats.errorBreakdown).toMatchObject({ ROUTING_FAILED: 1 });
  });

  it('emits REQUEST_ERROR for a chat() rejected before the pipeline', async () => {
    const bridge = createBridge(createRouter());
    const events: BridgeEventData[] = [];
    bridge.on(BridgeEventType.REQUEST_ERROR, (event) => {
      events.push(event);
    });

    await expect(bridge.chat(createRequest(), { backend: 'antropic' })).rejects.toThrow();

    expect(events).toHaveLength(1);
    const event = events[0] as RequestEvent;
    expect(event.type).toBe(BridgeEventType.REQUEST_ERROR);
    expect(event.error?.message).toMatch(/not registered/);
    expect(event.request).toBeDefined();
    expect(event.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('counts a chatStream() rejected by the registered-backend check as failed', async () => {
    const bridge = createBridge(createRouter());
    const events: BridgeEventData[] = [];
    bridge.on(BridgeEventType.STREAM_ERROR, (event) => {
      events.push(event);
    });

    await expect(
      drain(bridge.chatStream(createRequest(), { backend: 'antropic' }))
    ).rejects.toThrow();

    const stats = bridge.getStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.failedRequests).toBe(1);
    expect(events).toHaveLength(1);
    expect((events[0] as StreamEvent).error?.message).toMatch(/not registered/);
  });

  it('counts a failure inside frontend.toIR(), which happens before there is an IR request', async () => {
    const frontend = new GenericFrontendAdapter();
    vi.spyOn(frontend, 'toIR').mockRejectedValue(new Error('frontend blew up'));
    const bridge = new Bridge(frontend, createRouter());
    const events: BridgeEventData[] = [];
    bridge.on(BridgeEventType.REQUEST_ERROR, (event) => {
      events.push(event);
    });

    await expect(bridge.chat(createRequest())).rejects.toThrow('frontend blew up');

    expect(bridge.getStats().failedRequests).toBe(1);
    expect(bridge.getStats().errorBreakdown).toMatchObject({ UNKNOWN: 1 });
    // No IR request existed, so the event reports a stub rather than being dropped.
    expect(events).toHaveLength(1);
    expect((events[0] as RequestEvent).request.messages).toEqual([]);
    expect((events[0] as RequestEvent).request.metadata.provenance?.frontend).toBe(
      'generic-frontend'
    );
  });

  it('re-throws the original error rather than wrapping it', async () => {
    const frontend = new GenericFrontendAdapter();
    const boom = new Error('frontend blew up');
    vi.spyOn(frontend, 'toIR').mockRejectedValue(boom);
    const bridge = new Bridge(frontend, createRouter());

    await expect(bridge.chat(createRequest())).rejects.toBe(boom);
  });

  it('still counts a request rejected by IR validation', async () => {
    const bridge = createBridge(createRouter());
    const events: BridgeEventData[] = [];
    bridge.on(BridgeEventType.REQUEST_ERROR, (event) => {
      events.push(event);
    });

    await expect(bridge.chat(createRequest([]))).rejects.toThrow();

    expect(bridge.getStats().failedRequests).toBe(1);
    expect(events).toHaveLength(1);
  });

  it('leaves a successful request accounted for exactly once', async () => {
    const bridge = createBridge(createRouter());

    await bridge.chat(createRequest());

    const stats = bridge.getStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.successfulRequests).toBe(1);
    expect(stats.failedRequests).toBe(0);
    expect(stats.successRate).toBe(100);
  });
});
