/**
 * Integration Tests: Router Model Translation (Simplified)
 *
 * Core tests for Router fallback with automatic model translation.
 */

import { describe, it, expect } from 'vitest';
import { Router } from 'ai.matey.core';
import { MockBackendAdapter, createErrorBackend } from 'ai.matey.backend.mock';
import type { IRChatRequest } from 'ai.matey.types';

describe('Router Model Translation - Core Functionality', () => {
  it('should translate model name during fallback with exact match', async () => {
    let translatedModel = '';

    // Create failing primary backend
    const primaryBackend = createErrorBackend({
      errorCode: 'PROVIDER_ERROR',
      errorMessage: 'Primary failed',
    });

    // Create fallback backend that captures the model name
    const fallbackBackend = new MockBackendAdapter({
      responseGenerator: (request) => {
        translatedModel = request.parameters?.model || '';
        return 'Success';
      },
    });

    // Create router with translation
    const router = new Router({
      fallbackStrategy: 'sequential',
      modelTranslation: {
        strategy: 'exact',
        warnOnDefault: false,
      },
    });

    router
      .register('primary', primaryBackend)
      .register('fallback', fallbackBackend)
      .setModelTranslationMapping({
        'gpt-4': 'claude-3-5-sonnet-20241022',
      })
      .setFallbackChain(['primary', 'fallback']);

    // Execute with gpt-4
    await router.execute({
      messages: [{ role: 'user', content: 'Hello!' }],
      parameters: { model: 'gpt-4' },
    });

    // Verify model was translated
    expect(translatedModel).toBe('claude-3-5-sonnet-20241022');
  });

  it('should use backend default with hybrid strategy', async () => {
    let receivedModel = '';

    const primaryBackend = createErrorBackend({
      errorCode: 'PROVIDER_ERROR',
      errorMessage: 'Primary failed',
    });

    const fallbackBackend = new MockBackendAdapter({
      defaultModel: 'fallback-default-model',
      responseGenerator: (request) => {
        receivedModel = request.parameters?.model || '';
        return 'Success';
      },
      config: {
        defaultModel: 'fallback-default-model',
      },
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
      .setModelTranslationMapping({})  // No mapping
      .setFallbackChain(['primary', 'fallback']);

    await router.execute({
      messages: [{ role: 'user', content: 'Hello!' }],
      parameters: { model: 'unmapped-model' },
    });

    // Should use backend's default model
    expect(receivedModel).toBe('fallback-default-model');
  });

  it('should pass through original model when strategy is none', async () => {
    let receivedModel = '';

    const primaryBackend = createErrorBackend({
      errorCode: 'PROVIDER_ERROR',
      errorMessage: 'Primary failed',
    });

    const fallbackBackend = new MockBackendAdapter({
      responseGenerator: (request) => {
        receivedModel = request.parameters?.model || '';
        return 'Success';
      },
    });

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
        'gpt-4': 'should-not-be-used',
      })
      .setFallbackChain(['primary', 'fallback']);

    await router.execute({
      messages: [{ role: 'user', content: 'Hello!' }],
      parameters: { model: 'gpt-4' },
    });

    // Should use original model (no translation)
    expect(receivedModel).toBe('gpt-4');
  });

  it('should use pattern matching for translation', async () => {
    let receivedModel = '';

    const primaryBackend = createErrorBackend({
      errorCode: 'PROVIDER_ERROR',
      errorMessage: 'Primary failed',
    });

    const fallbackBackend = new MockBackendAdapter({
      responseGenerator: (request) => {
        receivedModel = request.parameters?.model || '';
        return 'Success';
      },
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
          pattern: /^gpt-4/i,
          backend: 'fallback',
          targetModel: 'claude-3-5-sonnet-20241022',
        },
      ])
      .setFallbackChain(['primary', 'fallback']);

    await router.execute({
      messages: [{ role: 'user', content: 'Hello!' }],
      parameters: { model: 'gpt-4-turbo' },
    });

    // Should match pattern and use target model
    expect(receivedModel).toBe('claude-3-5-sonnet-20241022');
  });

  it('should throw in strict mode when no translation found', async () => {
    const primaryBackend = createErrorBackend({
      errorCode: 'PROVIDER_ERROR',
      errorMessage: 'Primary failed',
    });

    const fallbackBackend = new MockBackendAdapter({
      defaultResponse: 'Should not reach here',
    });

    const router = new Router({
      fallbackStrategy: 'sequential',
      modelTranslation: {
        strategy: 'exact',
        strictMode: true,  // Strict mode
      },
    });

    router
      .register('primary', primaryBackend)
      .register('fallback', fallbackBackend)
      .setModelTranslationMapping({})  // No mapping
      .setFallbackChain(['primary', 'fallback']);

    // Should throw because no translation found
    await expect(
      router.execute({
        messages: [{ role: 'user', content: 'Hello!' }],
        parameters: { model: 'unmapped-model' },
      })
    ).rejects.toThrow('No translation found for model: unmapped-model');
  });
});
