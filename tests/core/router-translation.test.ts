/**
 * Integration Tests: Router Model Translation
 *
 * Tests for Router fallback with automatic model translation.
 */

import { describe, it, expect } from 'vitest';
import { Router } from 'ai.matey.core';
import { MockBackendAdapter, createErrorBackend } from 'ai.matey.backend.mock';
import type { IRChatRequest, IRChatResponse } from 'ai.matey.types';

// Helper to extract text from response
function getResponseText(response: IRChatResponse): string {
  const firstContent = response.message.content[0];
  return firstContent.type === 'text' ? firstContent.text : '';
}

// Helper to create a tracking backend that records the last request
function createTrackingBackend(responseText: string) {
  let lastRequest: IRChatRequest | null = null;

  const backend = new MockBackendAdapter({
    defaultResponse: responseText,
    responseGenerator: (request) => {
      lastRequest = request;
      return responseText;
    },
  });

  return {
    backend,
    getLastRequest: () => lastRequest,
  };
}

describe('Router Model Translation Integration', () => {
  describe('Sequential Fallback with Translation', () => {
    it('should translate model when falling back to second backend', async () => {
      // Create backends
      const primaryBackend = createErrorBackend({
        errorCode: 'PROVIDER_ERROR',
        errorMessage: 'Primary backend failed',
      });

      const fallbackTracking = createTrackingBackend('Fallback response');

      // Create router with model translation
      const router = new Router({
        fallbackStrategy: 'sequential',
        modelTranslation: {
          strategy: 'exact',
          warnOnDefault: false,
        },
      });

      router
        .register('primary', primaryBackend)
        .register('fallback', fallbackTracking.backend)
        .setModelTranslationMapping({
          'gpt-4': 'claude-3-5-sonnet-20241022',
        })
        .setFallbackChain(['primary', 'fallback']);

      // Make request with gpt-4
      const request: IRChatRequest = {
        messages: [{ role: 'user', content: 'Hello!' }],
        parameters: { model: 'gpt-4' },
      };

      const response = await router.execute(request);

      // Should get fallback response
      expect(getResponseText(response)).toBe('Fallback response');

      // Check that fallback backend received translated model
      const lastRequest = fallbackTracking.getLastRequest();
      expect(lastRequest).not.toBeNull();
      expect(lastRequest?.parameters?.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should use backend default when no exact match found (hybrid strategy)', async () => {
      // Create backends
      const primaryBackend = createErrorBackend({
        errorCode: 'PROVIDER_ERROR',
        errorMessage: 'Primary backend failed',
      });

      const fallbackBackend = new MockBackendAdapter({
        defaultResponse: 'Fallback response',
        defaultModel: 'claude-3-5-haiku-20241022',
      });

      // Create router with hybrid strategy
      const router = new Router({
        fallbackStrategy: 'sequential',
        modelTranslation: {
          strategy: 'hybrid',
          warnOnDefault: false,
        },
      });

      router
        .register('primary', primaryBackend)
        .register('fallback', fallbackBackend)
        .setModelTranslationMapping({
          // No mapping for 'gpt-3.5-turbo'
        })
        .setFallbackChain(['primary', 'fallback']);

      // Make request with unmapped model
      const request: IRChatRequest = {
        messages: [{ role: 'user', content: 'Hello!' }],
        parameters: { model: 'gpt-3.5-turbo' },
      };

      const response = await router.execute(request);

      // Should get fallback response
      expect(getResponseText(response)).toBe('Fallback response');

      // Check that fallback backend received default model
      const lastRequest = (fallbackBackend as any).lastRequest;
      expect(lastRequest.parameters?.model).toBe('claude-3-5-haiku-20241022');
    });

    it('should pass through original model when strategy is none', async () => {
      // Create backends
      const primaryBackend = createErrorBackend({
        errorCode: 'PROVIDER_ERROR',
        errorMessage: 'Primary backend failed',
      });

      const fallbackBackend = new MockBackendAdapter({
        defaultResponse: 'Fallback response',
      });

      // Create router with no translation
      const router = new Router({
        fallbackStrategy: 'sequential',
        modelTranslation: {
          strategy: 'none',
        },
      });

      router
        .register('primary', primaryBackend)
        .register('fallback', fallbackBackend)
        .setModelTranslationMapping({
          'gpt-4': 'claude-3-5-sonnet-20241022',
        })
        .setFallbackChain(['primary', 'fallback']);

      // Make request with gpt-4
      const request: IRChatRequest = {
        messages: [{ role: 'user', content: 'Hello!' }],
        parameters: { model: 'gpt-4' },
      };

      const response = await router.execute(request);

      // Should get fallback response
      expect(getResponseText(response)).toBe('Fallback response');

      // Check that fallback backend received original model (no translation)
      const lastRequest = (fallbackBackend as any).lastRequest;
      expect(lastRequest.parameters?.model).toBe('gpt-4');
    });

    it('should translate differently for different backends', async () => {
      // Create backends
      const backend1 = new MockBackendAdapter({
        defaultResponse: 'Backend 1',
      });

      const backend2 = new MockBackendAdapter({
        defaultResponse: 'Backend 2',
        defaultModel: 'mistral-large-latest',
      });

      const backend3 = new MockBackendAdapter({
        defaultResponse: 'Backend 3',
        defaultModel: 'gemini-1.5-pro',
      });

      // Create router
      const router = new Router({
        fallbackStrategy: 'sequential',
        modelTranslation: {
          strategy: 'hybrid',
          warnOnDefault: false,
        },
      });

      router
        .register('backend1', backend1)
        .register('backend2', backend2)
        .register('backend3', backend3)
        // Use backend-specific mapping for backend1 only
        .setBackendTranslationMapping('backend1', {
          'gpt-4': 'claude-3-5-sonnet-20241022',
        })
        .setFallbackChain(['backend1', 'backend2', 'backend3']);

      // Request to backend1 (uses exact match)
      const request: IRChatRequest = {
        messages: [{ role: 'user', content: 'Hello!' }],
        parameters: { model: 'gpt-4' },
      };

      await router.execute(request);
      expect((backend1 as any).lastRequest.parameters?.model).toBe('claude-3-5-sonnet-20241022');

      // Simulate backend1 failing, test backend2 gets its default
      const failingBackend1 = createErrorBackend({
        errorCode: 'PROVIDER_ERROR',
        errorMessage: 'Failed',
      });

      router.unregister('backend1');
      router.register('backend1-failing', failingBackend1);
      router.setFallbackChain(['backend1-failing', 'backend2', 'backend3']);

      await router.execute(request);

      // Backend2 should get its default model (no exact match for it)
      expect((backend2 as any).lastRequest.parameters?.model).toBe('mistral-large-latest');
    });
  });

  describe('Parallel Fallback with Translation', () => {
    it('should translate models for all parallel backends', async () => {
      // Create backends with delays
      const backend1 = new MockBackendAdapter({
        defaultResponse: 'Backend 1',
        delay: 100, // Slower
      });

      const backend2 = new MockBackendAdapter({
        defaultResponse: 'Backend 2',
        delay: 10, // Faster - will win
        defaultModel: 'claude-3-5-haiku-20241022',
      });

      const backend3 = new MockBackendAdapter({
        defaultResponse: 'Backend 3',
        delay: 50,
        defaultModel: 'gemini-1.5-flash',
      });

      // Create router with parallel fallback
      const router = new Router({
        fallbackStrategy: 'parallel',
        modelTranslation: {
          strategy: 'hybrid',
          warnOnDefault: false,
        },
      });

      router
        .register('backend1', backend1)
        .register('backend2', backend2)
        .register('backend3', backend3)
        .setModelTranslationMapping({
          // No mapping - all use defaults
        })
        .setFallbackChain(['backend1', 'backend2', 'backend3']);

      // Make primary fail to trigger parallel fallback
      const primaryBackend = createErrorBackend({
        errorCode: 'PROVIDER_ERROR',
        errorMessage: 'Primary failed',
      });

      router.unregister('backend1');
      router.register('primary', primaryBackend);
      router.setFallbackChain(['primary', 'backend2', 'backend3']);

      const request: IRChatRequest = {
        messages: [{ role: 'user', content: 'Hello!' }],
        parameters: { model: 'gpt-4' },
      };

      const response = await router.execute(request);

      // Should get fastest response (backend2)
      expect(getResponseText(response)).toBe('Backend 2');

      // Winning backend should have received request with its default model
      expect((backend2 as any).lastRequest.parameters?.model).toBe('claude-3-5-haiku-20241022');
    });
  });

  describe('Pattern Matching with Priority', () => {
    it('should match patterns and use targetModel', async () => {
      // Create backends
      const primaryBackend = createErrorBackend({
        errorCode: 'PROVIDER_ERROR',
        errorMessage: 'Primary failed',
      });

      const fallbackBackend = new MockBackendAdapter({
        defaultResponse: 'Fallback response',
      });

      // Create router with pattern matching
      const router = new Router({
        fallbackStrategy: 'sequential',
        modelTranslation: {
          strategy: 'pattern',
          warnOnDefault: false,
        },
      });

      router
        .register('primary', primaryBackend)
        .register('fallback', fallbackBackend)
        .setModelPatterns([
          {
            pattern: /^gpt-4/i,
            backend: 'fallback',
            targetModel: 'claude-3-5-sonnet-20241022',
            priority: 1,
          },
          {
            pattern: /^gpt-3\.5/i,
            backend: 'fallback',
            targetModel: 'claude-3-5-haiku-20241022',
            priority: 1,
          },
        ])
        .setFallbackChain(['primary', 'fallback']);

      // Test GPT-4 pattern
      const request1: IRChatRequest = {
        messages: [{ role: 'user', content: 'Hello!' }],
        parameters: { model: 'gpt-4-turbo' },
      };

      await router.execute(request1);
      expect((fallbackBackend as any).lastRequest.parameters?.model).toBe('claude-3-5-sonnet-20241022');

      // Test GPT-3.5 pattern
      const request2: IRChatRequest = {
        messages: [{ role: 'user', content: 'Hello!' }],
        parameters: { model: 'gpt-3.5-turbo' },
      };

      await router.execute(request2);
      expect((fallbackBackend as any).lastRequest.parameters?.model).toBe('claude-3-5-haiku-20241022');
    });

    it('should respect pattern priority (higher priority checked first)', async () => {
      const primaryBackend = createErrorBackend({
        errorCode: 'PROVIDER_ERROR',
        errorMessage: 'Primary failed',
      });

      const fallbackBackend = new MockBackendAdapter({
        defaultResponse: 'Fallback response',
      });

      const router = new Router({
        fallbackStrategy: 'sequential',
        modelTranslation: {
          strategy: 'pattern',
          warnOnDefault: false,
        },
      });

      router
        .register('primary', primaryBackend)
        .register('fallback', fallbackBackend)
        .setModelPatterns([
          {
            pattern: /^gpt/i, // Broad pattern
            backend: 'fallback',
            targetModel: 'claude-3-5-haiku-20241022',
            priority: 0, // Lower priority
          },
          {
            pattern: /^gpt-4/i, // Specific pattern
            backend: 'fallback',
            targetModel: 'claude-3-5-sonnet-20241022',
            priority: 10, // Higher priority - should be checked first
          },
        ])
        .setFallbackChain(['primary', 'fallback']);

      // Should match higher priority pattern
      const request: IRChatRequest = {
        messages: [{ role: 'user', content: 'Hello!' }],
        parameters: { model: 'gpt-4-turbo' },
      };

      await router.execute(request);
      expect((fallbackBackend as any).lastRequest.parameters?.model).toBe('claude-3-5-sonnet-20241022');
    });
  });

  describe('Hybrid Strategy Priority', () => {
    it('should prioritize: exact > pattern > default', async () => {
      const primaryBackend = createErrorBackend({
        errorCode: 'PROVIDER_ERROR',
        errorMessage: 'Primary failed',
      });

      const fallbackBackend = new MockBackendAdapter({
        defaultResponse: 'Fallback response',
        defaultModel: 'default-model',
      });

      const router = new Router({
        fallbackStrategy: 'sequential',
        modelTranslation: {
          strategy: 'hybrid',
          warnOnDefault: false,
        },
      });

      router
        .register('primary', primaryBackend)
        .register('fallback', fallbackBackend)
        .setModelTranslationMapping({
          'exact-match-model': 'exact-translated-model',
        })
        .setModelPatterns([
          {
            pattern: /^pattern-match/i,
            backend: 'fallback',
            targetModel: 'pattern-translated-model',
          },
        ])
        .setFallbackChain(['primary', 'fallback']);

      // Test exact match (highest priority)
      const request1: IRChatRequest = {
        messages: [{ role: 'user', content: 'Hello!' }],
        parameters: { model: 'exact-match-model' },
      };

      await router.execute(request1);
      expect((fallbackBackend as any).lastRequest.parameters?.model).toBe('exact-translated-model');

      // Test pattern match (medium priority)
      const request2: IRChatRequest = {
        messages: [{ role: 'user', content: 'Hello!' }],
        parameters: { model: 'pattern-match-model' },
      };

      await router.execute(request2);
      expect((fallbackBackend as any).lastRequest.parameters?.model).toBe('pattern-translated-model');

      // Test default (lowest priority)
      const request3: IRChatRequest = {
        messages: [{ role: 'user', content: 'Hello!' }],
        parameters: { model: 'no-match-model' },
      };

      await router.execute(request3);
      expect((fallbackBackend as any).lastRequest.parameters?.model).toBe('default-model');
    });
  });

  describe('Error Handling', () => {
    it('should throw in strict mode when no translation found', async () => {
      const primaryBackend = createErrorBackend({
        errorCode: 'PROVIDER_ERROR',
        errorMessage: 'Primary failed',
      });

      const fallbackBackend = new MockBackendAdapter({
        defaultResponse: 'Fallback response',
      });

      const router = new Router({
        fallbackStrategy: 'sequential',
        modelTranslation: {
          strategy: 'exact',
          strictMode: true, // Strict mode enabled
        },
      });

      router
        .register('primary', primaryBackend)
        .register('fallback', fallbackBackend)
        .setModelTranslationMapping({
          // No mapping for 'unknown-model'
        })
        .setFallbackChain(['primary', 'fallback']);

      const request: IRChatRequest = {
        messages: [{ role: 'user', content: 'Hello!' }],
        parameters: { model: 'unknown-model' },
      };

      // Should throw because no translation found and strict mode is on
      await expect(router.execute(request)).rejects.toThrow('No translation found for model: unknown-model');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle OpenAI → Anthropic fallback', async () => {
      const openaiBackend = createErrorBackend({
        errorCode: 'RATE_LIMIT_ERROR',
        errorMessage: 'OpenAI rate limit exceeded',
      });

      const anthropicBackend = new MockBackendAdapter({
        defaultResponse: 'Response from Anthropic',
      });

      const router = new Router({
        fallbackStrategy: 'sequential',
        modelTranslation: {
          strategy: 'hybrid',
          warnOnDefault: false,
        },
      });

      router
        .register('openai', openaiBackend)
        .register('anthropic', anthropicBackend)
        .setModelTranslationMapping({
          'gpt-4': 'claude-3-5-sonnet-20241022',
          'gpt-4-turbo': 'claude-3-5-sonnet-20241022',
          'gpt-3.5-turbo': 'claude-3-5-haiku-20241022',
        })
        .setFallbackChain(['openai', 'anthropic']);

      const request: IRChatRequest = {
        messages: [{ role: 'user', content: 'What is the capital of France?' }],
        parameters: {
          model: 'gpt-4-turbo',
          temperature: 0.7,
          max_tokens: 100,
        },
      };

      const response = await router.execute(request);

      expect(getResponseText(response)).toBe('Response from Anthropic');
      expect((anthropicBackend as any).lastRequest.parameters?.model).toBe('claude-3-5-sonnet-20241022');
      expect((anthropicBackend as any).lastRequest.parameters?.temperature).toBe(0.7);
      expect((anthropicBackend as any).lastRequest.parameters?.max_tokens).toBe(100);
    });
  });
});
