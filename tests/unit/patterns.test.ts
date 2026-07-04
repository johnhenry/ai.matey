/**
 * ai.matey.patterns tests
 *
 * Mock-backend tests for the five extracted patterns: complexity routing,
 * parallel aggregation, failover middleware, cost optimization, and batch
 * processing.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createComplexityRouter,
  defaultComplexityAnalyzer,
  createParallelAggregator,
  createFailoverMiddleware,
  createCostOptimizer,
  createBatchProcessor,
} from 'ai.matey.patterns';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend';
import { MockBackendAdapter, createErrorBackend } from 'ai.matey.backend.browser';
import type { IRChatRequest } from 'ai.matey.types';

function makeIRRequest(content: string): IRChatRequest {
  return {
    messages: [{ role: 'user', content }],
    parameters: {},
    metadata: { requestId: crypto.randomUUID(), timestamp: Date.now(), provenance: {} },
  };
}

// ============================================================================
// Complexity router
// ============================================================================

describe('createComplexityRouter', () => {
  it('scores complexity heuristically', () => {
    const simple = defaultComplexityAnalyzer(makeIRRequest('hi'));
    const complex = defaultComplexityAnalyzer(
      makeIRRequest(
        'Explain step by step why this architecture has trade-offs, analyze and compare ' +
          'the design options, and derive a proof. '.repeat(20) +
          '```function x() {}```'
      )
    );

    expect(simple).toBeLessThan(20);
    expect(complex).toBeGreaterThan(70);
  });

  it('routes simple queries to the low tier and complex to the high tier', async () => {
    const fastResponses: string[] = [];
    const powerfulResponses: string[] = [];

    const fast = new MockBackendAdapter({
      responseGenerator: (request) => {
        fastResponses.push(String(request.metadata.requestId));
        return 'fast';
      },
    });
    const powerful = new MockBackendAdapter({
      responseGenerator: (request) => {
        powerfulResponses.push(String(request.metadata.requestId));
        return 'powerful';
      },
    });

    const router = createComplexityRouter({
      tiers: [
        { backend: 'fast', maxComplexity: 30 },
        { backend: 'powerful', maxComplexity: 100 },
      ],
      backends: { fast, powerful },
    });

    await router.execute(makeIRRequest('hi'));
    await router.execute(
      makeIRRequest(
        'Explain step by step and analyze the trade-offs of this design. '.repeat(30)
      )
    );

    expect(fastResponses).toHaveLength(1);
    expect(powerfulResponses).toHaveLength(1);
  });
});

// ============================================================================
// Parallel aggregator
// ============================================================================

describe('createParallelAggregator', () => {
  it('returns the fastest response by default', async () => {
    const delayed = (text: string, ms: number) => {
      const adapter = new MockBackendAdapter({ defaultResponse: text });
      const execute = adapter.execute.bind(adapter);
      adapter.execute = async (request, signal) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        return execute(request, signal);
      };
      return adapter;
    };
    const slow = delayed('slow', 50);
    const quick = delayed('quick', 1);

    const aggregator = createParallelAggregator({ backends: { slow, quick } });
    const response = await aggregator.execute(makeIRRequest('race'));

    expect(JSON.stringify(response.message.content)).toContain('quick');
  });

  it('supports a custom judge over all responses', async () => {
    const a = new MockBackendAdapter({ defaultResponse: 'answer-a' });
    const b = new MockBackendAdapter({ defaultResponse: 'answer-b' });

    const aggregator = createParallelAggregator({
      backends: { a, b },
      strategy: (results) => {
        expect(results).toHaveLength(2);
        const chosen = results.find((result) =>
          JSON.stringify(result.response.message.content).includes('answer-b')
        );
        return (chosen ?? results[0]!).response;
      },
    });

    const response = await aggregator.execute(makeIRRequest('judge'));
    expect(JSON.stringify(response.message.content)).toContain('answer-b');
  });
});

// ============================================================================
// Failover middleware
// ============================================================================

describe('createFailoverMiddleware', () => {
  it('fails over to a fallback backend on retryable errors', async () => {
    const primary = createErrorBackend({
      errorCode: 'PROVIDER_ERROR',
      errorMessage: 'primary down',
    });
    const fallback = new MockBackendAdapter({ defaultResponse: 'from-fallback' });

    const hops: string[] = [];
    const bridge = new Bridge(new OpenAIFrontendAdapter(), primary).use(
      createFailoverMiddleware({
        fallbacks: [fallback],
        onFailover: (info) => hops.push(info.to),
      })
    );

    const response = await bridge.chat({
      model: 'test',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(JSON.stringify(response.choices[0]?.message.content)).toContain('from-fallback');
    expect(hops).toHaveLength(1);
  });

  it('rethrows when shouldFailover declines', async () => {
    const primary = createErrorBackend({
      errorCode: 'PROVIDER_ERROR',
      errorMessage: 'fatal',
    });
    const fallback = new MockBackendAdapter({ defaultResponse: 'unused' });

    const bridge = new Bridge(new OpenAIFrontendAdapter(), primary).use(
      createFailoverMiddleware({ fallbacks: [fallback], shouldFailover: () => false })
    );

    await expect(
      bridge.chat({ model: 'test', messages: [{ role: 'user', content: 'x' }] })
    ).rejects.toThrow();
  });
});

// ============================================================================
// Cost optimizer
// ============================================================================

describe('createCostOptimizer', () => {
  it('tracks spend in a sliding window and enforces the budget', async () => {
    const backend = new MockBackendAdapter({ defaultResponse: 'ok' });
    const { router, middleware, getSpend, recordSpend } = createCostOptimizer({
      backends: { backend },
      budget: { limitUSD: 0.01 },
      // Cost optimization requires capability data; use simple routing in tests
      routerConfig: { capabilityBasedRouting: false, optimization: 'balanced' },
    });

    const bridge = new Bridge(new OpenAIFrontendAdapter(), router).use(middleware);

    await bridge.chat({ model: 'm', messages: [{ role: 'user', content: 'one' }] });
    expect(getSpend()).toBe(0);

    recordSpend(0.02);
    expect(getSpend()).toBeCloseTo(0.02);

    await expect(
      bridge.chat({ model: 'm', messages: [{ role: 'user', content: 'two' }] })
    ).rejects.toThrow(/Budget/);
  });
});

// ============================================================================
// Batch processor
// ============================================================================

describe('createBatchProcessor', () => {
  it('bounds concurrency', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const processor = createBatchProcessor<number, number>({
      execute: async (n) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return n * 2;
      },
      concurrency: 2,
    });

    const results = await processor.addAll([1, 2, 3, 4, 5]);
    processor.dispose();

    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
  });

  it('retries failed requests', async () => {
    let attempts = 0;
    const processor = createBatchProcessor<string, string>({
      execute: (input) => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('flaky'));
        }
        return Promise.resolve(input.toUpperCase());
      },
      retries: 2,
    });

    const result = await processor.add('ok');
    processor.dispose();

    expect(result).toBe('OK');
    expect(attempts).toBe(3);
  });

  it('reports progress and enforces queue bounds', async () => {
    const progress = vi.fn();
    const processor = createBatchProcessor<number, number>({
      execute: (n) => Promise.resolve(n),
      concurrency: 1,
      maxQueueSize: 1,
      onProgress: progress,
    });

    const first = processor.add(1);
    // Queue is size 1; the first request may already be in flight, so fill it
    void processor.add(2).catch(() => undefined);
    await expect(processor.add(3)).rejects.toThrow(/Queue full/);

    await first;
    await processor.drain();
    processor.dispose();

    expect(progress).toHaveBeenCalled();
  });
});
