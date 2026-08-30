/**
 * Router Backend Lifecycle Tests
 *
 * Covers the register/replace/unregister lifecycle (issue #49).
 *
 * Before this, `register()` refused a name that already existed and
 * `unregister()` refused to remove the default or the last backend, so a
 * single-backend router had no way at all to change a backend's
 * configuration -- the common case being a rotated API key.
 */

import { describe, it, expect, vi } from 'vitest';
import { createRouter } from '@johnhenry/aimatey-core';
import { AdapterError } from '@johnhenry/aimatey-errors';
import type {
  BackendAdapter,
  IRChatRequest,
  IRChatResponse,
  IRWarning,
} from '@johnhenry/aimatey-types';

// ============================================================================
// Test Helpers
// ============================================================================

interface MockOptions {
  /** Reject every execute() call. */
  readonly shouldFail?: boolean;
  /** Fixed per-request cost reported through estimateCost(). */
  readonly cost?: number;
}

/**
 * Mock backend whose response text identifies the adapter *instance*, so a
 * test can tell the pre-replace adapter apart from the post-replace one even
 * when both are registered under the same backend name.
 */
function createMockBackend(label: string, options: MockOptions = {}): BackendAdapter {
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
      if (options.shouldFail) {
        throw new Error(`Backend execution failed (${label})`);
      }
      return {
        message: { role: 'assistant', content: `Response from ${label}` },
        finishReason: 'stop',
        metadata: {
          requestId: request.metadata?.requestId,
          provenance: { backend: label },
        },
      } as IRChatResponse;
    }),
    executeStream: vi.fn(async function* () {
      yield { type: 'start', sequence: 0 };
      yield {
        type: 'done',
        sequence: 1,
        finishReason: 'stop',
        message: { role: 'assistant', content: `Response from ${label}` },
      };
    }),
    estimateCost: options.cost === undefined ? undefined : vi.fn(async () => options.cost!),
    healthCheck: async () => true,
  } as unknown as BackendAdapter;
}

function createTestRequest(): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    parameters: { model: 'gpt-4' },
    metadata: {
      requestId: 'test-req-id',
      timestamp: Date.now(),
      provenance: {},
    },
  };
}

function responseText(response: IRChatResponse): string {
  const content = response.message.content;
  return typeof content === 'string' ? content : JSON.stringify(content);
}

/** Assert a rejection is an AdapterError and hand it back for inspection. */
async function expectAdapterError(promise: Promise<unknown>): Promise<AdapterError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AdapterError);
    return error as AdapterError;
  }
  throw new Error('Expected the promise to reject, but it resolved');
}

// ============================================================================
// register()
// ============================================================================

describe('Router.register', () => {
  it('should still reject a duplicate name, pointing at replace()', () => {
    const router = createRouter();
    router.register('openai', createMockBackend('key-v1'));

    expect(() => router.register('openai', createMockBackend('key-v2'))).toThrow(
      /already registered/
    );
    // The original adapter is untouched by the failed call.
    expect(router.get('openai')?.metadata.name).toBe('key-v1');
  });
});

// ============================================================================
// replace()
// ============================================================================

describe('Router.replace', () => {
  it('should route to the new adapter (rotate the key on the only backend)', async () => {
    const router = createRouter();
    router.register('openai', createMockBackend('key-v1'));

    const before = await router.execute(createTestRequest());
    expect(responseText(before)).toBe('Response from key-v1');

    router.replace('openai', createMockBackend('key-v2'));

    const after = await router.execute(createTestRequest());
    expect(responseText(after)).toBe('Response from key-v2');
    expect(router.get('openai')?.metadata.name).toBe('key-v2');
    // Still exactly one backend, under the same name.
    expect(router.listBackends()).toEqual(['openai']);
  });

  it('should work on the backend named by defaultBackend', async () => {
    const router = createRouter({ defaultBackend: 'openai' });
    router.register('openai', createMockBackend('key-v1'));

    router.replace('openai', createMockBackend('key-v2'));

    expect(router.config.defaultBackend).toBe('openai');
    expect(responseText(await router.execute(createTestRequest()))).toBe('Response from key-v2');
  });

  it('should return the router for chaining', () => {
    const router = createRouter();
    router.register('openai', createMockBackend('key-v1'));

    expect(router.replace('openai', createMockBackend('key-v2'))).toBe(router);
  });

  it('should preserve cumulative request counters', async () => {
    const router = createRouter();
    router.register('openai', createMockBackend('key-v1'));

    await router.execute(createTestRequest());
    await router.execute(createTestRequest());
    expect(router.getBackendStats('openai')?.totalRequests).toBe(2);

    router.replace('openai', createMockBackend('key-v2'));

    // Deliberate: the counters describe traffic sent to this logical backend,
    // and survive a configuration change.
    expect(router.getBackendStats('openai')?.totalRequests).toBe(2);
    expect(router.getBackendStats('openai')?.successfulRequests).toBe(2);

    await router.execute(createTestRequest());
    expect(router.getBackendStats('openai')?.totalRequests).toBe(3);
  });

  it('should preserve accrued cost', async () => {
    const router = createRouter({ trackCost: true });
    router.register('openai', createMockBackend('key-v1', { cost: 0.25 }));

    await router.execute(createTestRequest());
    await router.execute(createTestRequest());
    expect(router.getBackendStats('openai')?.totalCost).toBeCloseTo(0.5);

    router.replace('openai', createMockBackend('key-v2', { cost: 0.25 }));

    // Money already spent is not un-spent by rotating a credential.
    expect(router.getBackendStats('openai')?.totalCost).toBeCloseTo(0.5);
  });

  it('should preserve latency samples', async () => {
    const router = createRouter({ trackLatency: true });
    router.register('openai', createMockBackend('key-v1'));

    await router.execute(createTestRequest());
    const beforeStats = router.getBackendStats('openai');

    router.replace('openai', createMockBackend('key-v2'));

    expect(router.getBackendStats('openai')?.averageLatencyMs).toBe(beforeStats?.averageLatencyMs);
  });

  it('should reset the circuit breaker so the new configuration gets a chance', async () => {
    const router = createRouter({
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 1,
      fallbackStrategy: 'none',
    });
    router.register('openai', createMockBackend('expired-key', { shouldFail: true }));

    // Expired key -> auth failures -> breaker trips.
    await expect(router.execute(createTestRequest())).rejects.toThrow();
    expect(router.isCircuitBreakerOpen('openai')).toBe(true);
    expect(router.getBackendInfo('openai')?.consecutiveFailures).toBe(1);

    router.replace('openai', createMockBackend('fresh-key'));

    // The open breaker was a verdict on the *old* configuration. Keeping it
    // would make replace() useless for the case that motivates it.
    expect(router.isCircuitBreakerOpen('openai')).toBe(false);
    expect(router.getBackendInfo('openai')?.circuitBreakerState).toBe('closed');
    expect(router.getBackendInfo('openai')?.consecutiveFailures).toBe(0);
    expect(router.getBackendInfo('openai')?.isHealthy).toBe(true);

    // ...and the rotated key is actually usable again immediately.
    expect(responseText(await router.execute(createTestRequest()))).toBe('Response from fresh-key');
  });

  it('should keep the cumulative failure count while resetting the breaker trip counter', async () => {
    const router = createRouter({
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 1,
      fallbackStrategy: 'none',
    });
    router.register('openai', createMockBackend('expired-key', { shouldFail: true }));

    await expect(router.execute(createTestRequest())).rejects.toThrow();

    router.replace('openai', createMockBackend('fresh-key'));

    // failedRequests is history; consecutiveFailures is the live trip counter.
    expect(router.getBackendStats('openai')?.failedRequests).toBe(1);
    expect(router.getBackendInfo('openai')?.consecutiveFailures).toBe(0);
  });

  it('should clear a stale health-check verdict', async () => {
    const router = createRouter();
    router.register('openai', createMockBackend('key-v1'));

    await router.checkHealth('openai');
    expect(router.getBackendInfo('openai')?.lastHealthCheck).toBeTypeOf('number');

    router.replace('openai', createMockBackend('key-v2'));

    expect(router.getBackendInfo('openai')?.lastHealthCheck).toBeUndefined();
  });

  it('should leave routing configuration that names the backend untouched', () => {
    const router = createRouter();
    router
      .register('openai', createMockBackend('key-v1'))
      .register('anthropic', createMockBackend('anthropic-v1'))
      .setFallbackChain(['openai', 'anthropic'])
      .setModelMapping({ 'gpt-4': 'openai' })
      .setModelPatterns([{ pattern: /^gpt-/, backend: 'openai' }])
      .setBackendTranslationMapping('openai', { 'gpt-4': 'gpt-4o' });

    router.replace('openai', createMockBackend('key-v2'));

    expect(router.getFallbackChain()).toEqual(['openai', 'anthropic']);
    expect(router.getModelMapping()).toEqual({ 'gpt-4': 'openai' });
    expect(router.getModelPatterns()).toHaveLength(1);
    expect(router.getBackendTranslationMapping('openai')).toEqual({ 'gpt-4': 'gpt-4o' });
    // Registration order is preserved too (it drives round-robin and the
    // "first available backend" fallback).
    expect(router.listBackends()).toEqual(['openai', 'anthropic']);
  });

  it('should throw ROUTING_FAILED for a name that is not registered', () => {
    const router = createRouter();
    router.register('openai', createMockBackend('key-v1'));

    let thrown: unknown;
    try {
      router.replace('anthropic', createMockBackend('anthropic-v1'));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AdapterError);
    expect((thrown as AdapterError).code).toBe('ROUTING_FAILED');
    expect((thrown as AdapterError).message).toMatch(/is not registered/);
    // replace() is not an upsert: nothing was created.
    expect(router.has('anthropic')).toBe(false);
    expect(router.listBackends()).toEqual(['openai']);
  });
});

// ============================================================================
// unregister() -- last backend
// ============================================================================

describe('Router.unregister (last backend)', () => {
  it('should allow removing the only backend', () => {
    const router = createRouter();
    router.register('only', createMockBackend('only-v1'));

    expect(() => router.unregister('only')).not.toThrow();
    expect(router.listBackends()).toEqual([]);
    expect(router.has('only')).toBe(false);
  });

  it('should reach the same zero-backend state a fresh router starts in', () => {
    const fresh = createRouter();
    const emptied = createRouter();
    emptied.register('only', createMockBackend('only-v1')).unregister('only');

    expect(emptied.listBackends()).toEqual(fresh.listBackends());
    expect(emptied.getBackendInfo()).toEqual([]);
  });

  it('should fail the next execute() with a routing error, not at removal time', async () => {
    const router = createRouter();
    router.register('only', createMockBackend('only-v1')).unregister('only');

    const error = await expectAdapterError(router.execute(createTestRequest()));

    // Default fallbackStrategy is 'sequential', so selection's
    // NO_BACKEND_AVAILABLE is folded into the fallback exhaustion error.
    expect(error.code).toBe('ALL_BACKENDS_FAILED');
    expect(error.category).toBe('routing');
  });

  it('should surface NO_BACKEND_AVAILABLE when fallback is disabled', async () => {
    const router = createRouter({ fallbackStrategy: 'none' });
    router.register('only', createMockBackend('only-v1')).unregister('only');

    const error = await expectAdapterError(router.execute(createTestRequest()));

    expect(error.code).toBe('NO_BACKEND_AVAILABLE');
    expect(error.category).toBe('routing');
  });

  it('should allow re-registering after the router has been emptied', async () => {
    const router = createRouter();
    router.register('only', createMockBackend('only-v1')).unregister('only');
    router.register('only', createMockBackend('only-v2'));

    expect(responseText(await router.execute(createTestRequest()))).toBe('Response from only-v2');
    // A fresh registration starts from zeroed stats.
    expect(router.getBackendStats('only')?.totalRequests).toBe(1);
  });

  it('should still throw for a name that is not registered', () => {
    const router = createRouter();
    router.register('openai', createMockBackend('key-v1'));

    let thrown: unknown;
    try {
      router.unregister('anthropic');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AdapterError);
    expect((thrown as AdapterError).code).toBe('ROUTING_FAILED');
  });
});

// ============================================================================
// unregister() -- defaultBackend
// ============================================================================

describe('Router.unregister (defaultBackend)', () => {
  it('should clear config.defaultBackend instead of throwing', () => {
    const router = createRouter({ defaultBackend: 'openai' });
    router
      .register('openai', createMockBackend('key-v1'))
      .register('anthropic', createMockBackend('anthropic-v1'));

    expect(() => router.unregister('openai')).not.toThrow();

    expect(router.config.defaultBackend).toBeUndefined();
    expect(router.listBackends()).toEqual(['anthropic']);
  });

  it('should reflect the cleared default in metadata.config', () => {
    const router = createRouter({ defaultBackend: 'openai' });
    router.register('openai', createMockBackend('key-v1'));

    router.unregister('openai');

    expect(router.metadata.config?.defaultBackend).toBeUndefined();
  });

  it('should emit a routing-config-changed warning through onWarning', () => {
    const warnings: IRWarning[] = [];
    const router = createRouter({
      defaultBackend: 'openai',
      onWarning: (warning) => warnings.push(warning),
    });
    router.register('openai', createMockBackend('key-v1'));

    router.unregister('openai');

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.category).toBe('routing-config-changed');
    expect(warnings[0]?.field).toBe('config.defaultBackend');
    expect(warnings[0]?.originalValue).toBe('openai');
    expect(warnings[0]?.transformedValue).toBeUndefined();
    expect(warnings[0]?.message).toMatch(/defaultBackend/);
  });

  it('should not warn or touch the default when a different backend is removed', () => {
    const warnings: IRWarning[] = [];
    const router = createRouter({
      defaultBackend: 'openai',
      onWarning: (warning) => warnings.push(warning),
    });
    router
      .register('openai', createMockBackend('key-v1'))
      .register('anthropic', createMockBackend('anthropic-v1'));

    router.unregister('anthropic');

    expect(warnings).toEqual([]);
    expect(router.config.defaultBackend).toBe('openai');
  });

  it('should not fail when no onWarning hook is configured', () => {
    const router = createRouter({ defaultBackend: 'openai' });
    router.register('openai', createMockBackend('key-v1'));

    expect(() => router.unregister('openai')).not.toThrow();
    expect(router.config.defaultBackend).toBeUndefined();
  });

  it('should route to a remaining backend after the default is cleared', async () => {
    const router = createRouter({ defaultBackend: 'openai' });
    router
      .register('openai', createMockBackend('key-v1'))
      .register('anthropic', createMockBackend('anthropic-v1'));

    router.unregister('openai');

    expect(responseText(await router.execute(createTestRequest()))).toBe(
      'Response from anthropic-v1'
    );
  });
});

// ============================================================================
// unregister() -- dangling routing references
// ============================================================================

describe('Router.unregister (dangling references)', () => {
  it('should drop the backend from the fallback chain', () => {
    const router = createRouter();
    router
      .register('openai', createMockBackend('key-v1'))
      .register('anthropic', createMockBackend('anthropic-v1'))
      .setFallbackChain(['openai', 'anthropic']);

    router.unregister('openai');

    expect(router.getFallbackChain()).toEqual(['anthropic']);
  });

  it('should drop model mappings that point at the backend', () => {
    const router = createRouter();
    router
      .register('openai', createMockBackend('key-v1'))
      .register('anthropic', createMockBackend('anthropic-v1'))
      .setModelMapping({ 'gpt-4': 'openai', 'gpt-4o': 'openai', 'claude-3': 'anthropic' });

    router.unregister('openai');

    expect(router.getModelMapping()).toEqual({ 'claude-3': 'anthropic' });
  });

  it('should drop model patterns that point at the backend', () => {
    const router = createRouter();
    router
      .register('openai', createMockBackend('key-v1'))
      .register('anthropic', createMockBackend('anthropic-v1'))
      .setModelPatterns([
        { pattern: /^gpt-/, backend: 'openai' },
        { pattern: /^claude-/, backend: 'anthropic' },
      ]);

    router.unregister('openai');

    const patterns = router.getModelPatterns();
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.backend).toBe('anthropic');
  });

  it('should drop backend-specific translation mappings', () => {
    const router = createRouter();
    router
      .register('openai', createMockBackend('key-v1'))
      .setBackendTranslationMapping('openai', { 'gpt-4': 'gpt-4o' });

    router.unregister('openai');

    expect(router.getBackendTranslationMapping('openai')).toEqual({});
  });

  it('should not let a later, unrelated backend inherit the removed one’s rules', () => {
    const router = createRouter();
    router
      .register('openai', createMockBackend('key-v1'))
      .register('anthropic', createMockBackend('anthropic-v1'))
      .setFallbackChain(['openai', 'anthropic'])
      .setModelMapping({ 'gpt-4': 'openai' })
      .setBackendTranslationMapping('openai', { 'gpt-4': 'gpt-4o' });

    router.unregister('openai');
    // Same name, completely different provider behind it.
    router.register('openai', createMockBackend('some-other-provider'));

    expect(router.getFallbackChain()).toEqual(['anthropic']);
    expect(router.getModelMapping()).toEqual({});
    expect(router.getBackendTranslationMapping('openai')).toEqual({});
  });

  it('should leave rules for other backends alone', () => {
    const router = createRouter();
    router
      .register('openai', createMockBackend('key-v1'))
      .register('anthropic', createMockBackend('anthropic-v1'))
      .setBackendTranslationMapping('anthropic', { 'gpt-4': 'claude-3-5-sonnet-20241022' })
      .setFallbackChain(['anthropic']);

    router.unregister('openai');

    expect(router.getBackendTranslationMapping('anthropic')).toEqual({
      'gpt-4': 'claude-3-5-sonnet-20241022',
    });
    expect(router.getFallbackChain()).toEqual(['anthropic']);
  });
});
