/**
 * Integration Tests: Router Model Translation (Simplified)
 *
 * Core tests for Router fallback with automatic model translation.
 */

import { describe, it, expect } from 'vitest';
import { Router } from 'ai.matey.core';
import { MockBackendAdapter, createErrorBackend } from 'ai.matey.backend.browser';
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

describe('Router Model Translation - Substitution Warnings', () => {
  function makeRouterWithDefaultFallback(onWarning?: (w: unknown) => void, warnOnDefault?: boolean) {
    let receivedRequest: IRChatRequest | undefined;

    const backend = new MockBackendAdapter({
      defaultModel: 'backend-default-model',
      responseGenerator: (request) => {
        receivedRequest = request;
        return 'Success';
      },
      config: {
        defaultModel: 'backend-default-model',
      },
    });

    const router = new Router({
      fallbackStrategy: 'sequential',
      modelTranslation: {
        strategy: 'hybrid',
        ...(warnOnDefault === undefined ? {} : { warnOnDefault }),
      },
      ...(onWarning ? { onWarning } : {}),
    });

    router.register('only', backend).setModelTranslationMapping({});

    return { router, getRequest: () => receivedRequest };
  }

  it('invokes onWarning and attaches metadata warning on default substitution', async () => {
    const warnings: any[] = [];
    const { router, getRequest } = makeRouterWithDefaultFallback((w) => warnings.push(w));

    await router.execute({
      messages: [{ role: 'user', content: 'Hello!' }],
      parameters: { model: 'unmapped-model' },
      metadata: { requestId: 'warn-1', timestamp: Date.now(), provenance: {} },
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].category).toBe('model-substituted');
    expect(warnings[0].originalValue).toBe('unmapped-model');
    expect(warnings[0].transformedValue).toBe('backend-default-model');

    const metadataWarnings = getRequest()?.metadata?.warnings ?? [];
    expect(metadataWarnings.some((w) => w.category === 'model-substituted')).toBe(true);
  });

  it('suppresses the warning when warnOnDefault is false', async () => {
    const warnings: any[] = [];
    const { router, getRequest } = makeRouterWithDefaultFallback((w) => warnings.push(w), false);

    await router.execute({
      messages: [{ role: 'user', content: 'Hello!' }],
      parameters: { model: 'unmapped-model' },
      metadata: { requestId: 'warn-2', timestamp: Date.now(), provenance: {} },
    });

    expect(warnings).toHaveLength(0);
    expect(getRequest()?.metadata?.warnings ?? []).toHaveLength(0);
  });

  it('does not warn when an exact translation exists', async () => {
    const warnings: any[] = [];
    const { router } = makeRouterWithDefaultFallback((w) => warnings.push(w));

    router.setModelTranslationMapping({ 'mapped-model': 'target-model' });

    await router.execute({
      messages: [{ role: 'user', content: 'Hello!' }],
      parameters: { model: 'mapped-model' },
      metadata: { requestId: 'warn-3', timestamp: Date.now(), provenance: {} },
    });

    expect(warnings).toHaveLength(0);
  });
});
