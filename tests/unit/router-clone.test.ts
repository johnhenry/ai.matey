/**
 * Router.clone() Tests
 *
 * Covers issue #58: `clone()` copied the routing mappings but silently
 * dropped the *model translation* mappings -- so cross-provider fallback in a
 * cloned router sent a model name the target had never heard of -- and
 * re-`register`ed every adapter, which zeroed the accounting counters and
 * quietly closed any open circuit breaker.
 *
 * A clone is documented as "this router with different settings": it inherits
 * routing configuration, routing state, accounting, and the health verdict,
 * because it shares the very adapter instances that verdict was about.
 */

import { describe, it, expect, vi } from 'vitest';
import { Router } from '@johnhenry/aimatey-core';
import type { BackendAdapter, IRChatRequest, IRChatResponse } from '@johnhenry/aimatey-types';

// ============================================================================
// Test Helpers
// ============================================================================

interface MockOptions {
  readonly shouldFail?: boolean;
  readonly cost?: number;
  readonly healthy?: boolean;
  readonly delayMs?: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function createBackend(label: string, options: MockOptions = {}): BackendAdapter {
  return {
    metadata: {
      name: label,
      version: '1.0.0',
      provider: 'Mock',
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: false,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: true,
      },
    },
    fromIR: vi.fn((request) => request),
    toIR: vi.fn((response) => response),
    execute: vi.fn(async (request: IRChatRequest) => {
      if (options.delayMs) {
        await sleep(options.delayMs);
      }
      if (options.shouldFail) {
        throw new Error(`execute failed (${label})`);
      }
      return {
        message: { role: 'assistant', content: `hello from ${label}` },
        finishReason: 'stop',
        metadata: {
          requestId: request.metadata?.requestId,
          timestamp: Date.now(),
          provenance: { backend: label },
        },
      } as IRChatResponse;
    }),
    executeStream: vi.fn(async function* () {
      yield { type: 'start', sequence: 0, metadata: { requestId: 'r', timestamp: 0 } };
      yield {
        type: 'done',
        sequence: 1,
        finishReason: 'stop',
        message: { role: 'assistant', content: `hello from ${label}` },
      };
    }),
    estimateCost: options.cost === undefined ? undefined : vi.fn(async () => options.cost!),
    healthCheck: async () => options.healthy ?? true,
  } as unknown as BackendAdapter;
}

function createRequest(model = 'gpt-4'): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    parameters: { model },
    metadata: {
      requestId: 'test-req-id',
      timestamp: Date.now(),
      provenance: {},
    },
  };
}

/** Model name the adapter was actually asked for on call `index`. */
function modelSentTo(adapter: BackendAdapter, index = 0): string | undefined {
  const mock = (adapter.execute as unknown as { mock: { calls: [IRChatRequest][] } }).mock;
  return mock.calls[index]?.[0].parameters?.model;
}

// ============================================================================
// Translation mappings (issue #58, part 1)
// ============================================================================

describe('Router.clone - model translation mappings', () => {
  it('copies the global model translation mapping', () => {
    const router = new Router({ defaultBackend: 'a' });
    router.register('a', createBackend('a'));
    router.setModelTranslationMapping({ 'gpt-4': 'claude-sonnet-4-5' });

    const clone = router.clone({});

    expect(clone.getModelTranslationMapping()).toEqual({ 'gpt-4': 'claude-sonnet-4-5' });
  });

  it('copies per-backend translation mappings', () => {
    const router = new Router({ defaultBackend: 'a' });
    router.register('a', createBackend('a'));
    router.register('b', createBackend('b'));
    router.setBackendTranslationMapping('a', { 'gpt-4': 'model-for-a' });
    router.setBackendTranslationMapping('b', { 'gpt-4': 'model-for-b' });

    const clone = router.clone({});

    expect(clone.getBackendTranslationMapping('a')).toEqual({ 'gpt-4': 'model-for-a' });
    expect(clone.getBackendTranslationMapping('b')).toEqual({ 'gpt-4': 'model-for-b' });
  });

  it('routes a translated model name identically to its source', async () => {
    const router = new Router({ defaultBackend: 'openai' });
    const openai = createBackend('openai');
    const anthropic = createBackend('anthropic');
    router.register('openai', openai);
    router.register('anthropic', anthropic);
    router.setModelMapping({ 'gpt-4': 'openai' });
    router.setModelTranslationMapping({ 'gpt-4': 'gpt-4-turbo' });
    router.setBackendTranslationMapping('anthropic', { 'gpt-4': 'claude-sonnet-4-5' });

    const clone = router.clone({ defaultBackend: 'anthropic' });

    await router.execute(createRequest('gpt-4'));
    await clone.execute(createRequest('gpt-4'));

    // The source translated via the global mapping; the clone, routing to a
    // different backend, applied that backend's more specific mapping.
    expect(modelSentTo(openai, 0)).toBe('gpt-4-turbo');
    expect(modelSentTo(anthropic, 0)).toBe('claude-sonnet-4-5');
  });

  it('sends a translated model name on a cloned cross-provider fallback', async () => {
    const router = new Router({ defaultBackend: 'openai', fallbackStrategy: 'sequential' });
    const anthropic = createBackend('anthropic');
    router.register('openai', createBackend('openai', { shouldFail: true }));
    router.register('anthropic', anthropic);
    router.setFallbackChain(['anthropic']);
    router.setBackendTranslationMapping('anthropic', { 'gpt-4': 'claude-sonnet-4-5' });

    const clone = router.clone({ trackLatency: false });
    const response = await clone.execute(createRequest('gpt-4'));

    expect(response.message.content).toBe('hello from anthropic');
    expect(modelSentTo(anthropic, 0)).toBe('claude-sonnet-4-5');
  });

  it('gives the clone independent copies, not shared maps', () => {
    const router = new Router({ defaultBackend: 'a' });
    router.register('a', createBackend('a'));
    router.setModelTranslationMapping({ 'gpt-4': 'original' });
    router.setBackendTranslationMapping('a', { 'gpt-4': 'original-a' });

    const clone = router.clone({});
    clone.setModelTranslationMapping({ 'gpt-4': 'changed' });
    clone.setBackendTranslationMapping('a', { 'gpt-4': 'changed-a' });

    expect(router.getModelTranslationMapping()).toEqual({ 'gpt-4': 'original' });
    expect(router.getBackendTranslationMapping('a')).toEqual({ 'gpt-4': 'original-a' });
  });

  it('still copies the routing mappings it always copied', () => {
    const router = new Router({ defaultBackend: 'a' });
    router.register('a', createBackend('a'));
    router.register('b', createBackend('b'));
    router.setModelMapping({ 'gpt-4': 'a' });
    router.setModelPatterns([{ pattern: /^claude/, backend: 'b' }]);
    router.setFallbackChain(['b']);

    const clone = router.clone({});

    expect(clone.getModelMapping()).toEqual({ 'gpt-4': 'a' });
    expect(clone.getModelPatterns()).toHaveLength(1);
    expect(clone.getFallbackChain()).toEqual(['b']);
    expect(clone.listBackends()).toEqual(['a', 'b']);
    expect(clone.get('a')).toBe(router.get('a'));
  });

  it('applies the config overrides it was given', () => {
    const router = new Router({ defaultBackend: 'a', routingStrategy: 'explicit' });
    router.register('a', createBackend('a'));

    const clone = router.clone({ routingStrategy: 'round-robin' });

    expect(clone.config.routingStrategy).toBe('round-robin');
    expect(clone.config.defaultBackend).toBe('a');
    expect(router.config.routingStrategy).toBe('explicit');
  });
});

// ============================================================================
// Accounting and health state (issue #58, part 2)
// ============================================================================

describe('Router.clone - inherited state', () => {
  it('carries over per-backend accounting', async () => {
    const router = new Router({
      defaultBackend: 'a',
      fallbackStrategy: 'none',
      trackLatency: true,
      trackCost: true,
    });
    router.register('a', createBackend('a', { cost: 0.5, delayMs: 5 }));
    router.register('b', createBackend('b', { shouldFail: true }));

    await router.execute(createRequest());
    await router.execute(createRequest());
    await expect(
      router.execute({
        ...createRequest(),
        metadata: { ...createRequest().metadata, custom: { backend: 'b' } },
      })
    ).rejects.toThrow();

    const clone = router.clone({});

    for (const name of ['a', 'b'] as const) {
      const original = router.getBackendStats(name)!;
      const cloned = clone.getBackendStats(name)!;

      expect(cloned.totalRequests).toBe(original.totalRequests);
      expect(cloned.successfulRequests).toBe(original.successfulRequests);
      expect(cloned.failedRequests).toBe(original.failedRequests);
      expect(cloned.successRate).toBe(original.successRate);
      expect(cloned.totalCost).toBeCloseTo(original.totalCost!);
      expect(cloned.averageLatencyMs).toBe(original.averageLatencyMs);
    }

    expect(clone.getBackendStats('a')!.successfulRequests).toBe(2);
    expect(clone.getBackendStats('a')!.averageLatencyMs).toBeGreaterThan(0);
    expect(clone.getBackendStats('b')!.failedRequests).toBe(1);
  });

  it('carries over router-level accounting', async () => {
    const router = new Router({ defaultBackend: 'a', fallbackStrategy: 'sequential' });
    router.register('a', createBackend('a', { shouldFail: true }));
    router.register('b', createBackend('b'));
    router.setFallbackChain(['b']);

    await router.execute(createRequest());

    const clone = router.clone({});

    expect(clone.getStats().totalRequests).toBe(router.getStats().totalRequests);
    expect(clone.getStats().successfulRequests).toBe(router.getStats().successfulRequests);
    expect(clone.getStats().totalFallbacks).toBe(1);
    expect(clone.getStats().sinceTimestamp).toBe(router.getStats().sinceTimestamp);
  });

  it('does not let the clone mutate the source router accounting', async () => {
    const router = new Router({ defaultBackend: 'a', trackLatency: true });
    router.register('a', createBackend('a'));
    await router.execute(createRequest());

    const clone = router.clone({});
    await clone.execute(createRequest());

    expect(router.getBackendStats('a')?.totalRequests).toBe(1);
    expect(clone.getBackendStats('a')?.totalRequests).toBe(2);
  });

  it('keeps an open circuit breaker open', async () => {
    const router = new Router({
      defaultBackend: 'a',
      fallbackStrategy: 'none',
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 1,
      circuitBreakerTimeout: 10_000,
    });
    router.register('a', createBackend('a', { shouldFail: true }));

    await expect(router.execute(createRequest())).rejects.toThrow();
    expect(router.isCircuitBreakerOpen('a')).toBe(true);

    const clone = router.clone({ circuitBreakerThreshold: 3 });

    expect(clone.isCircuitBreakerOpen('a')).toBe(true);
    expect(clone.getBackendInfo('a')?.circuitBreakerState).toBe('open');
    expect(clone.getBackendInfo('a')?.consecutiveFailures).toBe(1);
    // ...and the clone refuses the request, rather than re-arming the backend.
    await expect(clone.execute(createRequest())).rejects.toThrow(/Circuit breaker is open/);

    router.resetCircuitBreaker();
    clone.resetCircuitBreaker();
  });

  it('lets the clone recover an inherited open circuit on its own timeout', async () => {
    const router = new Router({
      defaultBackend: 'a',
      fallbackStrategy: 'none',
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 1,
      circuitBreakerTimeout: 10_000,
    });
    router.register('a', createBackend('a'));
    router.openCircuitBreaker('a', 10_000);

    // The clone shortens the timeout, so its own next request probes.
    const clone = router.clone({ circuitBreakerTimeout: 1 });
    await sleep(10);

    const response = await clone.execute(createRequest());

    expect(response.message.content).toBe('hello from a');
    expect(clone.getBackendInfo('a')?.circuitBreakerState).toBe('closed');
    // The source router is unaffected.
    expect(router.isCircuitBreakerOpen('a')).toBe(true);

    router.resetCircuitBreaker();
  });

  it('closes inherited circuits when the clone disables the breaker', async () => {
    const router = new Router({
      defaultBackend: 'a',
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 1,
      circuitBreakerTimeout: 10_000,
    });
    router.register('a', createBackend('a'));
    router.openCircuitBreaker('a', 10_000);

    // Nothing in a breaker-less router would ever reopen or recover the
    // circuit, so an inherited open one would make the backend unroutable
    // forever.
    const clone = router.clone({ enableCircuitBreaker: false });

    expect(clone.isCircuitBreakerOpen('a')).toBe(false);
    expect(clone.listBackends()).toEqual(['a']);
    await expect(clone.execute(createRequest())).resolves.toBeDefined();

    router.resetCircuitBreaker();
  });

  it('carries over an unhealthy verdict', async () => {
    const router = new Router({ defaultBackend: 'a' });
    router.register('a', createBackend('a', { healthy: false }));
    await router.checkHealth();

    expect(router.getBackendInfo('a')?.isHealthy).toBe(false);

    const clone = router.clone({});

    expect(clone.getBackendInfo('a')?.isHealthy).toBe(false);
    expect(clone.getBackendInfo('a')?.lastHealthCheck).toBe(
      router.getBackendInfo('a')?.lastHealthCheck
    );
  });

  it('leaves the clone resettable to a fresh slate', async () => {
    const router = new Router({
      defaultBackend: 'a',
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 1,
      circuitBreakerTimeout: 10_000,
    });
    router.register('a', createBackend('a'));
    await router.execute(createRequest());
    router.openCircuitBreaker('a', 10_000);

    const clone = router.clone({});
    clone.resetStats();
    clone.resetCircuitBreaker();

    expect(clone.getBackendStats('a')?.totalRequests).toBe(0);
    expect(clone.isCircuitBreakerOpen('a')).toBe(false);
    // The source keeps its own record.
    expect(router.getBackendStats('a')?.totalRequests).toBe(1);
    expect(router.isCircuitBreakerOpen('a')).toBe(true);

    router.resetCircuitBreaker();
  });

  it('continues the round-robin rotation instead of restarting it', async () => {
    const router = new Router({ routingStrategy: 'round-robin' });
    const a = createBackend('a');
    const b = createBackend('b');
    router.register('a', a);
    router.register('b', b);

    await router.execute(createRequest());
    const clone = router.clone({});
    const next = await clone.execute(createRequest());

    expect(next.message.content).toBe('hello from b');
  });
});
