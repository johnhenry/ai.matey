/**
 * Router selection-time fallback tests.
 *
 * Covers issue #134: `fallbackStrategy: 'none'` is documented as "No fallback -
 * fail immediately if primary backend fails", but it was only consulted on the
 * *post-failure* paths. `selectBackend()` never read it, so an open circuit on
 * the named backend made it "unavailable", `routeExplicit()` returned null, and
 * selection fell through to the unguarded "first available backend" branch --
 * substituting a backend the caller never named, in registration order, with no
 * signal that the destination had changed.
 *
 * These tests pin both directions: `'none'` must refuse to substitute, and the
 * default (`'sequential'`) must keep substituting exactly as before, so the fix
 * cannot become a silent breaking change.
 */

import { describe, it, expect, vi } from 'vitest';
import { Router } from '@johnhenry/aimatey-core';
import { AdapterError } from '@johnhenry/aimatey-errors';
import type {
  BackendAdapter,
  IRChatRequest,
  IRChatResponse,
  IRStreamChunk,
} from '@johnhenry/aimatey-types';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * A backend that always succeeds and names itself in its output, so a test can
 * tell *which* backend answered rather than only that something did.
 */
function createBackend(label: string): BackendAdapter {
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
    execute: vi.fn(
      async (): Promise<IRChatResponse> => ({
        message: { role: 'assistant', content: `SERVED BY ${label}` },
        finishReason: 'stop',
        metadata: { requestId: 'test-req-id', timestamp: Date.now() },
      })
    ),
    executeStream: vi.fn(async function* (): AsyncGenerator<IRStreamChunk> {
      yield { type: 'content', sequence: 0, delta: `SERVED BY ${label}` } as IRStreamChunk;
      yield {
        type: 'done',
        sequence: 1,
        finishReason: 'stop',
        message: { role: 'assistant', content: `SERVED BY ${label}` },
        metadata: { requestId: 'test-req-id', timestamp: Date.now() },
      } as IRStreamChunk;
    }),
    validateRequest: vi.fn(() => ({ valid: true, errors: [] })),
    healthCheck: vi.fn(async () => ({ healthy: true, timestamp: Date.now() })),
  } as unknown as BackendAdapter;
}

/** Request that names `primary` the way a caller of the Bridge/Router does. */
function requestFor(backend?: string): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'hi' }],
    parameters: { model: 'test-model' },
    metadata: {
      requestId: 'test-req-id',
      timestamp: Date.now(),
      ...(backend ? { custom: { backend } } : {}),
    },
  } as IRChatRequest;
}

/** Drain a stream into the text it produced plus any error chunk it yielded. */
async function drain(
  stream: AsyncIterable<IRStreamChunk>
): Promise<{ text: string; errorCode?: string }> {
  let text = '';
  let errorCode: string | undefined;
  for await (const chunk of stream) {
    if (chunk.type === 'content') {
      text += chunk.delta;
    } else if (chunk.type === 'error') {
      errorCode = chunk.error?.code;
    }
  }
  return { text, errorCode };
}

/** Two backends, `primary` first so registration order favours it. */
function twoBackends(router: Router): Router {
  router.register('primary', createBackend('primary'));
  router.register('other', createBackend('other'));
  return router;
}

// ============================================================================
// fallbackStrategy: 'none' -- the named backend, or nothing
// ============================================================================

describe("Router selection under fallbackStrategy 'none' (#134)", () => {
  it('should not substitute another backend when the named one has an open circuit', async () => {
    const router = twoBackends(
      new Router({ routingStrategy: 'explicit', fallbackStrategy: 'none' })
    );
    router.openCircuitBreaker('primary');

    // The substitution this issue is about: selection used to answer 'other'.
    await expect(router.selectBackend(requestFor('primary'), 'primary')).rejects.toThrow(
      AdapterError
    );

    const error = await router
      .selectBackend(requestFor('primary'), 'primary')
      .then(
        (name) => {
          throw new Error(`selectBackend resolved to '${name}' instead of failing`);
        },
        (e: AdapterError) => e
      );
    expect(error.code).toBe('NO_BACKEND_AVAILABLE');
  });

  it('should fail execute() rather than serve the request from a backend never named', async () => {
    const router = twoBackends(
      new Router({ routingStrategy: 'explicit', fallbackStrategy: 'none' })
    );
    router.openCircuitBreaker('primary');

    const error = await router.execute(requestFor('primary')).then(
      (response) => {
        throw new Error(`execute() answered with ${JSON.stringify(response.message.content)}`);
      },
      (e: AdapterError) => e
    );

    expect(error.code).toBe('NO_BACKEND_AVAILABLE');
  });

  it('should fail executeStream() rather than stream from a backend never named', async () => {
    const router = twoBackends(
      new Router({ routingStrategy: 'explicit', fallbackStrategy: 'none' })
    );
    router.openCircuitBreaker('primary');

    const { text, errorCode } = await drain(router.executeStream(requestFor('primary')));

    // The downstream harm in #134 was content leaving for an unnamed backend.
    expect(text).toBe('');
    expect(errorCode).toBe('NO_BACKEND_AVAILABLE');
  });

  it('should still select the named backend while its circuit is closed', async () => {
    const router = twoBackends(
      new Router({ routingStrategy: 'explicit', fallbackStrategy: 'none' })
    );

    expect(await router.selectBackend(requestFor('primary'), 'primary')).toBe('primary');

    const response = await router.execute(requestFor('primary'));
    expect(response.message.content).toBe('SERVED BY primary');
  });

  it('should still resolve a sole backend when the caller named nothing', async () => {
    // The guard is about *substitution*. With no preference named there is
    // nothing to substitute for, and this is the only way a router without a
    // `defaultBackend` resolves at all -- suppressing it here would leave a
    // single-backend `'none'` router unable to route anything.
    const router = new Router({ fallbackStrategy: 'none' });
    router.register('only', createBackend('only'));

    expect(await router.selectBackend(requestFor())).toBe('only');
    expect((await router.execute(requestFor())).message.content).toBe('SERVED BY only');
  });

  it('should still resolve a configured defaultBackend, which is not a substitution', async () => {
    const router = twoBackends(
      new Router({
        routingStrategy: 'explicit',
        fallbackStrategy: 'none',
        defaultBackend: 'other',
      })
    );

    // No preference named: the caller's own default is what they asked for.
    expect(await router.selectBackend(requestFor())).toBe('other');
  });
});

// ============================================================================
// The default is unchanged -- this is what stops the fix being a breaking change
// ============================================================================

describe('Router selection under the default fallbackStrategy (#134)', () => {
  it("should substitute an available backend when fallbackStrategy is unset (defaults to 'sequential')", async () => {
    const router = twoBackends(new Router({ routingStrategy: 'explicit' }));
    router.openCircuitBreaker('primary');

    expect(await router.selectBackend(requestFor('primary'), 'primary')).toBe('other');
  });

  it('should serve execute() from the substituted backend when fallbackStrategy is unset', async () => {
    const router = twoBackends(new Router({ routingStrategy: 'explicit' }));
    router.openCircuitBreaker('primary');

    const response = await router.execute(requestFor('primary'));
    expect(response.message.content).toBe('SERVED BY other');
  });

  it('should serve executeStream() from the substituted backend when fallbackStrategy is unset', async () => {
    const router = twoBackends(new Router({ routingStrategy: 'explicit' }));
    router.openCircuitBreaker('primary');

    const { text, errorCode } = await drain(router.executeStream(requestFor('primary')));

    expect(text).toBe('SERVED BY other');
    expect(errorCode).toBeUndefined();
  });

  it("should substitute under an explicit fallbackStrategy: 'sequential' too", async () => {
    const router = twoBackends(
      new Router({ routingStrategy: 'explicit', fallbackStrategy: 'sequential' })
    );
    router.openCircuitBreaker('primary');

    expect(await router.selectBackend(requestFor('primary'), 'primary')).toBe('other');
  });
});

// ============================================================================
// isBackendAvailable() -- the predicate routing actually uses (#134, secondary)
// ============================================================================

describe('Router.isBackendAvailable (#134)', () => {
  it('should agree with what selection does about an open circuit', async () => {
    const router = twoBackends(
      new Router({ routingStrategy: 'explicit', fallbackStrategy: 'none' })
    );

    expect(router.isBackendAvailable('primary')).toBe(true);
    expect(await router.selectBackend(requestFor('primary'), 'primary')).toBe('primary');

    router.openCircuitBreaker('primary');

    // A caller can now pre-flight the same predicate rather than approximating
    // it from isCircuitBreakerOpen().
    expect(router.isBackendAvailable('primary')).toBe(false);
    await expect(router.selectBackend(requestFor('primary'), 'primary')).rejects.toThrow(
      AdapterError
    );
  });

  it('should be false for a name that was never registered', () => {
    const router = twoBackends(new Router());

    expect(router.isBackendAvailable('nonexistent')).toBe(false);
    expect(router.has('nonexistent')).toBe(false);
  });

  it('should recover with the circuit', () => {
    const router = twoBackends(new Router());

    router.openCircuitBreaker('primary');
    expect(router.isBackendAvailable('primary')).toBe(false);

    router.closeCircuitBreaker('primary');
    expect(router.isBackendAvailable('primary')).toBe(true);
  });
});
