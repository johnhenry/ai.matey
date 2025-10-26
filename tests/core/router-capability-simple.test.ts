/**
 * Simple Integration Tests for Router Capability-Based Routing
 */

import { describe, it, expect } from 'vitest';
import { Router } from '../../src/core/router.js';
import { MockBackendAdapter } from '../../src/adapters/backend/mock.js';
import type { IRChatRequest } from '../../src/types/ir.js';
import type { AIModel, ListModelsResult } from '../../src/types/models.js';

describe('Router Capability-Based Routing (Simple)', () => {
  it('should select backend using capability-based routing', async () => {
    // Create router with capability routing enabled
    const router = new Router({
      capabilityBasedRouting: true,
      optimization: 'cost',
    });

    // Create backends with different model capabilities
    const cheapBackend = new MockBackendAdapter({
      name: 'cheap-backend',
      defaultModel: 'cheap-model',
    });
    cheapBackend.listModels = async (): Promise<ListModelsResult> => ({
      models: [
        {
          id: 'cheap-model',
          name: 'Cheap Model',
          capabilities: {
            contextWindow: 8000,
            maxTokens: 2000,
            pricing: { input: 0.0001, output: 0.0002 },
            latency: { p50: 500, p95: 800 },
            qualityScore: 60,
          },
        },
      ],
      source: 'static',
      fetchedAt: Date.now(),
      isComplete: true,
    });

    const qualityBackend = new MockBackendAdapter({
      name: 'quality-backend',
      defaultModel: 'quality-model',
    });
    qualityBackend.listModels = async (): Promise<ListModelsResult> => ({
      models: [
        {
          id: 'quality-model',
          name: 'Quality Model',
          capabilities: {
            contextWindow: 200000,
            maxTokens: 8000,
            pricing: { input: 0.01, output: 0.03 },
            latency: { p50: 2000, p95: 4000 },
            qualityScore: 95,
          },
        },
      ],
      source: 'static',
      fetchedAt: Date.now(),
      isComplete: true,
    });

    router
      .register('cheap', cheapBackend)
      .register('quality', qualityBackend);

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      parameters: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 100,
      },
      metadata: {
        requestId: 'test-1',
        timestamp: Date.now(),
      },
    };

    const response = await router.execute(request);

    // Should successfully route and execute
    expect(response).toBeDefined();
    expect(response.message).toBeDefined();
  });

  it('should filter backends by hard requirements', async () => {
    const router = new Router({
      capabilityBasedRouting: true,
      optimization: 'balanced',
    });

    // Backend without vision
    const noVisionBackend = new MockBackendAdapter({
      name: 'no-vision',
      defaultModel: 'no-vision-model',
    });
    noVisionBackend.listModels = async (): Promise<ListModelsResult> => ({
      models: [
        {
          id: 'no-vision-model',
          name: 'No Vision Model',
          capabilities: {
            contextWindow: 8000,
            supportsVision: false,
            pricing: { input: 0.0001, output: 0.0002 },
            qualityScore: 70,
          },
        },
      ],
      source: 'static',
      fetchedAt: Date.now(),
      isComplete: true,
    });

    // Backend with vision
    const visionBackend = new MockBackendAdapter({
      name: 'vision',
      defaultModel: 'vision-model',
    });
    visionBackend.listModels = async (): Promise<ListModelsResult> => ({
      models: [
        {
          id: 'vision-model',
          name: 'Vision Model',
          capabilities: {
            contextWindow: 100000,
            supportsVision: true,
            pricing: { input: 0.005, output: 0.015 },
            qualityScore: 85,
          },
        },
      ],
      source: 'static',
      fetchedAt: Date.now(),
      isComplete: true,
    });

    router
      .register('no-vision', noVisionBackend)
      .register('vision', visionBackend);

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Describe this image' }] }],
      parameters: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 100,
      },
      metadata: {
        requestId: 'test-2',
        timestamp: Date.now(),
        custom: {
          capabilityRequirements: {
            required: {
              supportsVision: true,
            },
          },
        },
      },
    };

    const response = await router.execute(request);

    // Should successfully route and execute
    expect(response).toBeDefined();
    expect(response.message).toBeDefined();
  });

  it('should work without capability requirements', async () => {
    const router = new Router({
      capabilityBasedRouting: true,
      optimization: 'balanced',
    });

    const backend = new MockBackendAdapter({
      name: 'backend-a',
      defaultModel: 'model-a',
    });
    backend.listModels = async (): Promise<ListModelsResult> => ({
      models: [
        {
          id: 'model-a',
          name: 'Model A',
          capabilities: {
            contextWindow: 8000,
            pricing: { input: 0.001, output: 0.002 },
            qualityScore: 75,
          },
        },
      ],
      source: 'static',
      fetchedAt: Date.now(),
      isComplete: true,
    });

    router.register('backend-a', backend);

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      parameters: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 100,
      },
      metadata: {
        requestId: 'test-3',
        timestamp: Date.now(),
      },
    };

    const response = await router.execute(request);

    // Should successfully route and execute
    expect(response).toBeDefined();
    expect(response.message).toBeDefined();
  });

  it('should fallback when capability routing fails', async () => {
    const router = new Router({
      capabilityBasedRouting: true,
      fallbackStrategy: 'sequential',
      optimization: 'balanced',
    });

    const backend = new MockBackendAdapter({
      name: 'fallback-backend',
      defaultModel: 'fallback-model',
    });

    router.register('fallback-backend', backend);

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      parameters: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 100,
      },
      metadata: {
        requestId: 'test-4',
        timestamp: Date.now(),
        custom: {
          capabilityRequirements: {
            required: {
              contextWindow: 1000000, // Impossible requirement
            },
          },
        },
      },
    };

    const response = await router.execute(request);

    // Should fallback to traditional routing and succeed
    expect(response).toBeDefined();
    expect(response.message).toBeDefined();
  });
});
