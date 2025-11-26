/**
 * Router Completeness Tests
 *
 * Tests for the logical completeness gaps identified in the Router class.
 * Covers: isCircuitBreakerOpen, clearTranslationMapping.
 */

import { describe, it, expect, vi } from 'vitest';
import { createRouter } from 'ai.matey.core';
import type { BackendAdapter, IRChatRequest, IRChatResponse } from 'ai.matey.types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockBackend(name: string, options?: { shouldFail?: boolean }): BackendAdapter {
  return {
    metadata: {
      name,
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
      if (options?.shouldFail) {
        throw new Error('Backend execution failed');
      }
      return {
        message: { role: 'assistant', content: `Response from ${name}` },
        finishReason: 'stop',
        metadata: {
          requestId: request.metadata.requestId,
          provenance: { backend: name },
        },
      } as IRChatResponse;
    }),
    executeStream: vi.fn(async function* () {
      yield { type: 'start', sequence: 0 };
      yield { type: 'done', sequence: 1, finishReason: 'stop', message: { role: 'assistant', content: 'Hello' } };
    }),
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

// ============================================================================
// isCircuitBreakerOpen Tests
// ============================================================================

describe('Router.isCircuitBreakerOpen', () => {
  it('should return false for a closed circuit breaker', () => {
    const router = createRouter({ enableCircuitBreaker: true });
    const backend = createMockBackend('test-backend');

    router.register('test-backend', backend);

    expect(router.isCircuitBreakerOpen('test-backend')).toBe(false);
  });

  it('should return true after opening circuit breaker', () => {
    const router = createRouter({ enableCircuitBreaker: true });
    const backend = createMockBackend('test-backend');

    router.register('test-backend', backend);
    router.openCircuitBreaker('test-backend');

    expect(router.isCircuitBreakerOpen('test-backend')).toBe(true);
  });

  it('should return false after closing circuit breaker', () => {
    const router = createRouter({ enableCircuitBreaker: true });
    const backend = createMockBackend('test-backend');

    router.register('test-backend', backend);
    router.openCircuitBreaker('test-backend');
    router.closeCircuitBreaker('test-backend');

    expect(router.isCircuitBreakerOpen('test-backend')).toBe(false);
  });

  it('should return false for non-existent backend', () => {
    const router = createRouter({ enableCircuitBreaker: true });

    expect(router.isCircuitBreakerOpen('non-existent')).toBe(false);
  });

  it('should return false after resetting circuit breaker', () => {
    const router = createRouter({ enableCircuitBreaker: true });
    const backend = createMockBackend('test-backend');

    router.register('test-backend', backend);
    router.openCircuitBreaker('test-backend');
    router.resetCircuitBreaker('test-backend');

    expect(router.isCircuitBreakerOpen('test-backend')).toBe(false);
  });
});

// ============================================================================
// clearModelTranslationMapping Tests
// ============================================================================

describe('Router.clearModelTranslationMapping', () => {
  it('should clear all model translation mappings', () => {
    const router = createRouter();

    router.setModelTranslationMapping({
      'gpt-4': 'claude-3-opus',
      'gpt-3.5': 'claude-3-haiku',
    });

    expect(router.getModelTranslationMapping()).toEqual({
      'gpt-4': 'claude-3-opus',
      'gpt-3.5': 'claude-3-haiku',
    });

    router.clearModelTranslationMapping();

    expect(router.getModelTranslationMapping()).toEqual({});
  });

  it('should return the router for chaining', () => {
    const router = createRouter();

    router.setModelTranslationMapping({ 'gpt-4': 'claude-3-opus' });
    const result = router.clearModelTranslationMapping();

    expect(result).toBe(router);
  });
});

// ============================================================================
// clearBackendTranslationMapping Tests
// ============================================================================

describe('Router.clearBackendTranslationMapping', () => {
  it('should clear translation mapping for a specific backend', () => {
    const router = createRouter();
    const backend1 = createMockBackend('backend1');
    const backend2 = createMockBackend('backend2');

    router
      .register('backend1', backend1)
      .register('backend2', backend2)
      .setBackendTranslationMapping('backend1', { 'gpt-4': 'model-a' })
      .setBackendTranslationMapping('backend2', { 'gpt-4': 'model-b' });

    expect(router.getBackendTranslationMapping('backend1')).toEqual({ 'gpt-4': 'model-a' });
    expect(router.getBackendTranslationMapping('backend2')).toEqual({ 'gpt-4': 'model-b' });

    router.clearBackendTranslationMapping('backend1');

    expect(router.getBackendTranslationMapping('backend1')).toEqual({});
    expect(router.getBackendTranslationMapping('backend2')).toEqual({ 'gpt-4': 'model-b' });
  });

  it('should clear all backend translation mappings when no backend specified', () => {
    const router = createRouter();
    const backend1 = createMockBackend('backend1');
    const backend2 = createMockBackend('backend2');

    router
      .register('backend1', backend1)
      .register('backend2', backend2)
      .setBackendTranslationMapping('backend1', { 'gpt-4': 'model-a' })
      .setBackendTranslationMapping('backend2', { 'gpt-4': 'model-b' });

    router.clearBackendTranslationMapping();

    expect(router.getBackendTranslationMapping('backend1')).toEqual({});
    expect(router.getBackendTranslationMapping('backend2')).toEqual({});
  });

  it('should return the router for chaining', () => {
    const router = createRouter();
    const backend = createMockBackend('backend1');

    router.register('backend1', backend);
    const result = router.clearBackendTranslationMapping('backend1');

    expect(result).toBe(router);
  });
});
