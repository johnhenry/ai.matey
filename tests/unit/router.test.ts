/**
 * Router Tests
 *
 * Tests for the Router class including routing strategies,
 * fallback mechanisms, parallel dispatch, and health tracking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Router } from 'ai.matey.core';
import type { BackendAdapter, AdapterMetadata } from 'ai.matey.types';
import type { IRChatRequest, IRChatResponse, IRStreamChunk, IRCapabilities } from 'ai.matey.types';

// ============================================================================
// Mock Backend Adapters
// ============================================================================

class MockBackendAdapter implements BackendAdapter {
  readonly metadata: AdapterMetadata;

  constructor(
    public name: string,
    private shouldFail: boolean = false,
    private responseText: string = 'Response',
  ) {
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

  async execute(request: IRChatRequest): Promise<IRChatResponse> {
    if (this.shouldFail) {
      throw new Error(`${this.name} failed`);
    }

    return {
      message: {
        role: 'assistant',
        content: `${this.responseText} from ${this.name}`,
      },
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      metadata: {
        requestId: request.metadata.requestId,
        timestamp: Date.now(),
        provenance: {
          backend: this.name,
        },
      },
    };
  }

  async *executeStream(request: IRChatRequest): AsyncGenerator<IRStreamChunk, void, undefined> {
    if (this.shouldFail) {
      throw new Error(`${this.name} failed`);
    }

    const words = `${this.responseText} from ${this.name}`.split(' ');
    let seq = 0;
    for (const word of words) {
      yield {
        type: 'content',
        sequence: seq++,
        delta: word + ' ',
      };
    }

    yield {
      type: 'done',
      sequence: seq,
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      metadata: {
        requestId: request.metadata.requestId,
        timestamp: Date.now(),
        provenance: {
          backend: this.name,
        },
      },
    };
  }
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Router - Basic Initialization', () => {
  it('should initialize with single backend', () => {
    const backend = new MockBackendAdapter('backend-1');
    const router = new Router();
    router.register('backend-1', backend);

    expect(router).toBeDefined();
    expect(router.listBackends()).toEqual(['backend-1']);
  });

  it('should initialize with multiple backends', () => {
    const router = new Router();
    router.register('backend-1', new MockBackendAdapter('backend-1'));
    router.register('backend-2', new MockBackendAdapter('backend-2'));
    router.register('backend-3', new MockBackendAdapter('backend-3'));

    expect(router).toBeDefined();
    expect(router.listBackends()).toHaveLength(3);
  });

  it('should initialize with routing strategy', () => {
    const router = new Router({
      routingStrategy: 'round-robin',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));
    router.register('backend-2', new MockBackendAdapter('backend-2'));

    expect(router).toBeDefined();
    expect(router.listBackends()).toHaveLength(2);
  });
});

describe('Router - Round-Robin Strategy', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router({
      routingStrategy: 'round-robin',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));
    router.register('backend-2', new MockBackendAdapter('backend-2'));
    router.register('backend-3', new MockBackendAdapter('backend-3'));
  });

  it('should distribute requests evenly across backends', async () => {
    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response1 = await router.execute(request);
    const response2 = await router.execute(request);
    const response3 = await router.execute(request);
    const response4 = await router.execute(request);

    expect(response1.message.content).toContain('backend-1');
    expect(response2.message.content).toContain('backend-2');
    expect(response3.message.content).toContain('backend-3');
    expect(response4.message.content).toContain('backend-1'); // Wraps around
  });
});

describe('Router - Default Backend Strategy', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router({
      routingStrategy: 'explicit',
      defaultBackend: 'backend-1', // First backend is default
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));
    router.register('backend-2', new MockBackendAdapter('backend-2'));
    router.register('backend-3', new MockBackendAdapter('backend-3'));
  });

  it('should always use default backend when no preference specified', async () => {
    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response1 = await router.execute(request);
    const response2 = await router.execute(request);
    const response3 = await router.execute(request);

    expect(response1.message.content).toContain('backend-1');
    expect(response2.message.content).toContain('backend-1');
    expect(response3.message.content).toContain('backend-1');
  });
});

describe('Router - Random Strategy', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router({
      routingStrategy: 'random',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));
    router.register('backend-2', new MockBackendAdapter('backend-2'));
    router.register('backend-3', new MockBackendAdapter('backend-3'));
  });

  it('should select backends randomly', async () => {
    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const backends = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const response = await router.execute(request);
      const content = response.message.content as string;
      if (content.includes('backend-1')) backends.add('backend-1');
      if (content.includes('backend-2')) backends.add('backend-2');
      if (content.includes('backend-3')) backends.add('backend-3');
    }

    // With 20 requests and 3 backends, we should see multiple backends
    expect(backends.size).toBeGreaterThan(1);
  });
});

describe('Router - Custom Strategy', () => {
  it('should use custom routing strategy', async () => {
    // Custom strategy: always return backend-2
    const customStrategy = async () => 'backend-2';

    const router = new Router({
      routingStrategy: 'custom',
      customRouter: customStrategy,
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));
    router.register('backend-2', new MockBackendAdapter('backend-2'));
    router.register('backend-3', new MockBackendAdapter('backend-3'));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response1 = await router.execute(request);
    const response2 = await router.execute(request);

    expect(response1.message.content).toContain('backend-2');
    expect(response2.message.content).toContain('backend-2');
  });
});

describe('Router - Sequential Fallback', () => {
  it('should fallback to next backend on failure', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
      fallbackStrategy: 'sequential',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true)); // Will fail
    router.register('backend-2', new MockBackendAdapter('backend-2', false)); // Will succeed
    router.register('backend-3', new MockBackendAdapter('backend-3', false));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response = await router.execute(request);
    expect(response.message.content).toContain('backend-2');
  });

  it('should try all backends before failing', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
      fallbackStrategy: 'sequential',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true)); // Will fail
    router.register('backend-2', new MockBackendAdapter('backend-2', true)); // Will fail
    router.register('backend-3', new MockBackendAdapter('backend-3', true)); // Will fail

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    await expect(router.execute(request)).rejects.toThrow();
  });
});

describe('Router - Parallel Fallback', () => {
  it('should try all backends in parallel and use first success', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
      fallbackStrategy: 'parallel',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true)); // Will fail
    router.register('backend-2', new MockBackendAdapter('backend-2', false)); // Will succeed
    router.register('backend-3', new MockBackendAdapter('backend-3', false)); // Will succeed

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response = await router.execute(request);
    // Should get response from backend-2 or backend-3
    expect(response.message.content).toMatch(/backend-[23]/);
  });

  it('should fail if all backends fail in parallel', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
      fallbackStrategy: 'parallel',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true));
    router.register('backend-2', new MockBackendAdapter('backend-2', true));
    router.register('backend-3', new MockBackendAdapter('backend-3', true));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    await expect(router.execute(request)).rejects.toThrow();
  });
});

describe('Router - Custom Fallback', () => {
  it('should use custom fallback strategy', async () => {
    // Custom fallback: Return backend-3 directly
    const customFallback = async () => 'backend-3';

    const router = new Router({
      routingStrategy: 'round-robin',
      fallbackStrategy: 'custom',
      customFallback,
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true));
    router.register('backend-2', new MockBackendAdapter('backend-2', false));
    router.register('backend-3', new MockBackendAdapter('backend-3', false));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response = await router.execute(request);
    expect(response.message.content).toContain('backend-3');
  });
});

describe('Router - Model Mapping', () => {
  it('should map model names to specific backends', async () => {
    const router = new Router({
      routingStrategy: 'model-based',
    });
    router.register('openai-backend', new MockBackendAdapter('openai-backend'));
    router.register('anthropic-backend', new MockBackendAdapter('anthropic-backend'));
    router.register('gemini-backend', new MockBackendAdapter('gemini-backend'));

    router.setModelMapping({
      'gpt-4': 'openai-backend',
      'claude-3': 'anthropic-backend',
      'gemini-pro': 'gemini-backend',
    });

    const request1: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'gpt-4' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const request2: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'claude-3' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response1 = await router.execute(request1);
    const response2 = await router.execute(request2);

    expect(response1.message.content).toContain('openai-backend');
    expect(response2.message.content).toContain('anthropic-backend');
  });
});

describe('Router - Streaming Support', () => {
  it('should stream responses through router', async () => {
    const router = new Router();
    router.register('backend-1', new MockBackendAdapter('backend-1'));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: true,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const stream = router.executeStream(request);
    const chunks: IRStreamChunk[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some(c => c.type === 'content')).toBe(true);
    expect(chunks.some(c => c.type === 'done')).toBe(true);
  });

  it('should fallback on streaming failure', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
      fallbackStrategy: 'sequential',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true));
    router.register('backend-2', new MockBackendAdapter('backend-2', false));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: true,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const stream = router.executeStream(request);
    const chunks: IRStreamChunk[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    const lastChunk = chunks[chunks.length - 1];
    if (lastChunk.type === 'done') {
      expect(lastChunk.metadata.provenance?.backend).toBe('backend-2');
    }
  });
});

describe('Router - Health Tracking', () => {
  it('should track backend health statistics', async () => {
    const router = new Router();
    router.register('backend-1', new MockBackendAdapter('backend-1'));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    await router.execute(request);
    await router.execute(request);

    const stats = router.getStats();
    expect(stats).toBeDefined();
    expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
  });

  it('should track failures separately', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
      fallbackStrategy: 'sequential',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true));
    router.register('backend-2', new MockBackendAdapter('backend-2', false));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    await router.execute(request);

    const stats = router.getStats();
    expect(stats.totalRequests).toBeGreaterThanOrEqual(1);
  });
});

describe('Router - Error Handling', () => {
  it('should throw error when executing with no backends', async () => {
    const router = new Router();

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    await expect(router.execute(request)).rejects.toThrow();
  });

  it('should throw error when all backends fail with no fallback', async () => {
    const router = new Router({
      fallbackStrategy: 'none',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1', true));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    await expect(router.execute(request)).rejects.toThrow();
  });

  it('should handle invalid model mapping gracefully', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));
    router.register('backend-2', new MockBackendAdapter('backend-2'));

    router.setModelMapping({
      'gpt-4': 'backend-1',
    });

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'unknown-model' }, // Not in mapping
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    // Should fall back to routing strategy
    const response = await router.execute(request);
    expect(response).toBeDefined();
  });
});

describe('Router - Single Backend Edge Cases', () => {
  it('should work with single backend and round-robin strategy', async () => {
    const router = new Router({
      routingStrategy: 'round-robin',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response1 = await router.execute(request);
    const response2 = await router.execute(request);

    expect(response1.message.content).toContain('backend-1');
    expect(response2.message.content).toContain('backend-1');
  });

  it('should work with single backend with default backend', async () => {
    const router = new Router({
      defaultBackend: 'backend-1',
    });
    router.register('backend-1', new MockBackendAdapter('backend-1'));

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      parameters: { model: 'test-model' },
      stream: false,
      metadata: {
        requestId: randomUUID(),
        timestamp: Date.now(),
      },
    };

    const response = await router.execute(request);
    expect(response.message.content).toContain('backend-1');
  });
});
