/**
 * Circuit-breaker timer lifecycle.
 *
 * `openCircuitBreaker()` schedules the open -> half-open transition with a
 * `setTimeout`. That timer used to be scheduled and then forgotten: nothing
 * held it, so nothing could cancel it. Two consequences, both covered here.
 *
 * 1. **A timer outlived the open it belonged to.** Close (or reset, or
 *    replace) a breaker and open it again, and the transition armed by the
 *    *first* open would fire during the *second* one and half-open it early
 *    -- letting a trial request through before the backend had rested for the
 *    time the caller asked for.
 * 2. **A timer outlived its backend.** After `unregister()`, the pending
 *    transition still held the removed `BackendState`, and through it the
 *    adapter, keeping both reachable (and the host's event loop alive) until
 *    it expired.
 *
 * The rule the fix implements: a breaker that stops being the open breaker a
 * timer was scheduled for cancels that timer.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Router } from '@johnhenry/aimatey-core';
import type {
  BackendAdapter,
  AdapterMetadata,
  IRCapabilities,
  IRChatRequest,
  IRChatResponse,
  IRStreamChunk,
} from '@johnhenry/aimatey-types';

class TimerMockAdapter implements BackendAdapter {
  readonly metadata: AdapterMetadata;

  constructor(name = 'timer-mock') {
    this.metadata = {
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
  }

  fromIR(request: IRChatRequest): IRChatRequest {
    return request;
  }

  toIR(response: IRChatResponse): IRChatResponse {
    return response;
  }

  async execute(): Promise<IRChatResponse> {
    return {
      id: 'res',
      model: 'mock-model',
      message: { role: 'assistant', content: 'ok' },
      finishReason: 'stop',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    } as unknown as IRChatResponse;
  }

  async *executeStream(): AsyncGenerator<IRStreamChunk, void, undefined> {
    yield { type: 'done', sequence: 0, finishReason: 'stop' } as unknown as IRStreamChunk;
  }
}

/** A router with one backend and a 30s rest period. */
function makeRouter(): Router {
  const router = new Router({
    enableCircuitBreaker: true,
    circuitBreakerTimeout: 30_000,
  });
  router.register('peer', new TimerMockAdapter());
  return router;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Router circuit-breaker timer lifecycle', () => {
  it('still half-opens on time when nothing interferes', () => {
    vi.useFakeTimers();
    const router = makeRouter();

    router.openCircuitBreaker('peer');
    expect(router.isCircuitBreakerOpen('peer')).toBe(true);

    vi.advanceTimersByTime(29_000);
    expect(router.isCircuitBreakerOpen('peer')).toBe(true);

    vi.advanceTimersByTime(2_000);
    expect(router.isCircuitBreakerOpen('peer')).toBe(false);
  });

  it('honours the full rest period of a re-open, not the one the first open started', () => {
    vi.useFakeTimers();
    const router = makeRouter();

    // t=0: opened, transition armed for t=30s.
    router.openCircuitBreaker('peer');

    // t=20s: opened again -- a fresh rest period, running to t=50s.
    vi.advanceTimersByTime(20_000);
    router.openCircuitBreaker('peer');
    expect(router.isCircuitBreakerOpen('peer')).toBe(true);

    // t=30.5s: where the first transition would have fired. Before the fix it
    // did, half-opening the breaker 19.5s into a 30s rest.
    vi.advanceTimersByTime(10_500);
    expect(router.isCircuitBreakerOpen('peer')).toBe(true);

    // t=50.5s: the transition belonging to the second open.
    vi.advanceTimersByTime(20_000);
    expect(router.isCircuitBreakerOpen('peer')).toBe(false);
  });

  it('re-opening with a longer rest period does not inherit the shorter one', () => {
    vi.useFakeTimers();
    const router = makeRouter();

    router.openCircuitBreaker('peer', 1_000);
    router.openCircuitBreaker('peer', 60_000);

    vi.advanceTimersByTime(2_000);
    expect(router.isCircuitBreakerOpen('peer')).toBe(true);

    vi.advanceTimersByTime(59_000);
    expect(router.isCircuitBreakerOpen('peer')).toBe(false);
  });

  it('cancels the pending transition when the breaker is closed by hand', () => {
    vi.useFakeTimers();
    const router = makeRouter();

    router.openCircuitBreaker('peer');
    expect(vi.getTimerCount()).toBe(1);

    router.closeCircuitBreaker('peer');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels the pending transition on resetCircuitBreaker, named and router-wide', () => {
    vi.useFakeTimers();
    const named = makeRouter();
    named.openCircuitBreaker('peer');
    named.resetCircuitBreaker('peer');
    expect(vi.getTimerCount()).toBe(0);

    const all = makeRouter();
    all.register('second', new TimerMockAdapter('second'));
    all.openCircuitBreaker('peer');
    all.openCircuitBreaker('second');
    expect(vi.getTimerCount()).toBe(2);

    all.resetCircuitBreaker();
    expect(vi.getTimerCount()).toBe(0);

    // Resetting again, with nothing armed, is a no-op rather than an error.
    all.resetCircuitBreaker();
    all.resetCircuitBreaker('peer');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not let a transition from before a replace shorten the rest after it', () => {
    vi.useFakeTimers();
    const router = makeRouter();

    // The expired credential trips the breaker at t=0; transition at t=30s.
    router.openCircuitBreaker('peer');

    // t=5s: the key is rotated. replace() closes the breaker by contract.
    vi.advanceTimersByTime(5_000);
    router.replace('peer', new TimerMockAdapter('rotated'));
    expect(router.isCircuitBreakerOpen('peer')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    // t=20s: the replacement fails too. Its rest period runs to t=50s.
    vi.advanceTimersByTime(15_000);
    router.openCircuitBreaker('peer');

    // t=30.5s: where the pre-rotation transition would have fired.
    vi.advanceTimersByTime(10_500);
    expect(router.isCircuitBreakerOpen('peer')).toBe(true);
  });

  it('leaves no transition armed for a backend that has been unregistered', () => {
    vi.useFakeTimers();
    const router = makeRouter();

    router.openCircuitBreaker('peer');
    expect(vi.getTimerCount()).toBe(1);

    router.unregister('peer');
    expect(vi.getTimerCount()).toBe(0);
    expect(router.has('peer')).toBe(false);
  });

});
