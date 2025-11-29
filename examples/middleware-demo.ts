/**
 * Middleware Demo
 *
 * Demonstrates middleware chaining with logging, telemetry, caching, retry, and transform.
 */

import { Bridge } from 'ai.matey.core';
import { AnthropicFrontendAdapter } from 'ai.matey.frontend/anthropic';
import type { BackendAdapter } from 'ai.matey.types';
import type { IRChatRequest, IRChatResponse } from 'ai.matey.types';
import {
  createLoggingMiddleware,
  createTelemetryMiddleware,
  createCachingMiddleware,
  createRetryMiddleware,
  createTransformMiddleware,
  InMemoryTelemetrySink,
  InMemoryCacheStorage,
  createSystemMessageInjector,
} from 'ai.matey.middleware';

// ============================================================================
// Mock Backend for Demo
// ============================================================================

class DemoBackendAdapter implements BackendAdapter {
  metadata = {
    name: 'demo-backend',
    version: '1.0.0',
    provider: 'demo' as const,
  };

  capabilities = {
    streaming: false,
    multiModal: false,
    tools: false,
    maxContextTokens: 4096,
    systemMessageStrategy: 'in-messages' as const,
    supportsMultipleSystemMessages: true,
  };

  private callCount = 0;

  async execute(request: IRChatRequest): Promise<IRChatResponse> {
    this.callCount++;

    console.log(`\n[Backend] Processing request #${this.callCount}`);
    console.log(`[Backend] Model: ${request.parameters?.model}`);
    console.log(`[Backend] Messages: ${request.messages.length}`);

    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      message: {
        role: 'assistant',
        content: `Response from backend (call #${this.callCount})`,
      },
      finishReason: 'stop',
      usage: {
        promptTokens: 10 + this.callCount,
        completionTokens: 5 + this.callCount,
        totalTokens: 15 + this.callCount * 2,
      },
      metadata: {
        requestId: request.metadata.requestId,
        timestamp: Date.now(),
        provenance: {
          frontend: request.metadata.provenance?.frontend,
          backend: this.metadata.name,
        },
      },
    };
  }

  async executeStream(): Promise<never> {
    throw new Error('Streaming not supported in demo');
  }
}

// ============================================================================
// Demo Runner
// ============================================================================

async function runDemo() {
  console.log('='.repeat(60));
  console.log('Middleware Demo - Universal AI Adapter System');
  console.log('='.repeat(60));

  // Create adapters
  const frontend = new AnthropicFrontendAdapter();
  const backend = new DemoBackendAdapter();

  // Create telemetry sink
  const telemetrySink = new InMemoryTelemetrySink();

  // Create cache storage
  const cacheStorage = new InMemoryCacheStorage(100);

  // Create bridge with middleware stack
  const bridge = new Bridge(frontend, backend);

  console.log('\n1. Adding Middleware to Bridge...');
  console.log('   - Logging middleware (info level)');
  console.log('   - Telemetry middleware (tracking metrics)');
  console.log('   - Caching middleware (1 hour TTL)');
  console.log('   - Retry middleware (max 3 attempts)');
  console.log('   - Transform middleware (add system message)');

  // Add middleware in order
  bridge.use(
    createLoggingMiddleware({
      level: 'info',
      logRequests: true,
      logResponses: true,
      prefix: '[Logger]',
    })
  );

  bridge.use(
    createTelemetryMiddleware({
      sink: telemetrySink,
      trackCounts: true,
      trackLatencies: true,
      trackTokens: true,
    })
  );

  bridge.use(
    createCachingMiddleware({
      storage: cacheStorage,
      ttl: 3600000, // 1 hour
    })
  );

  bridge.use(
    createRetryMiddleware({
      maxAttempts: 3,
      initialDelay: 1000,
      backoffMultiplier: 2,
      onRetry: (error, attempt) => {
        console.log(`[Retry] Attempt ${attempt} after error: ${error}`);
      },
    })
  );

  bridge.use(
    createTransformMiddleware({
      transformRequest: createSystemMessageInjector(
        'You are a helpful AI assistant. Be concise and friendly.',
        'start'
      ),
    })
  );

  // ========================================================================
  // Test 1: First Request (cache miss)
  // ========================================================================

  console.log('\n' + '='.repeat(60));
  console.log('Test 1: First Request (should miss cache)');
  console.log('='.repeat(60));

  const response1 = await bridge.chat({
    model: 'claude-3-opus-20240229',
    messages: [{ role: 'user', content: 'Hello, what can you help me with?' }],
  });

  console.log('\n[Response 1]');
  console.log('Content:', response1.content?.[0]?.text || 'N/A');
  console.log('Cache Hit:', response1.metadata?.custom?.cacheHit);
  console.log('Usage:', response1.usage);

  // ========================================================================
  // Test 2: Same Request (cache hit)
  // ========================================================================

  console.log('\n' + '='.repeat(60));
  console.log('Test 2: Same Request (should hit cache)');
  console.log('='.repeat(60));

  const response2 = await bridge.chat({
    model: 'claude-3-opus-20240229',
    messages: [{ role: 'user', content: 'Hello, what can you help me with?' }],
  });

  console.log('\n[Response 2]');
  console.log('Content:', response2.content?.[0]?.text || 'N/A');
  console.log('Cache Hit:', response2.metadata?.custom?.cacheHit);
  console.log('Usage:', response2.usage);

  // ========================================================================
  // Test 3: Different Request (cache miss)
  // ========================================================================

  console.log('\n' + '='.repeat(60));
  console.log('Test 3: Different Request (should miss cache)');
  console.log('='.repeat(60));

  const response3 = await bridge.chat({
    model: 'claude-3-opus-20240229',
    messages: [{ role: 'user', content: 'Tell me about the weather.' }],
  });

  console.log('\n[Response 3]');
  console.log('Content:', response3.content?.[0]?.text || 'N/A');
  console.log('Cache Hit:', response3.metadata?.custom?.cacheHit);
  console.log('Usage:', response3.usage);

  // ========================================================================
  // Display Telemetry
  // ========================================================================

  console.log('\n' + '='.repeat(60));
  console.log('Telemetry Summary');
  console.log('='.repeat(60));

  const metrics = telemetrySink.getMetrics();
  const events = telemetrySink.getEvents();

  console.log(`\nMetrics Recorded: ${metrics.length}`);
  console.log('Sample Metrics:');
  metrics.slice(0, 5).forEach((metric) => {
    console.log(`  - ${metric.name}: ${metric.value}`);
  });

  console.log(`\nEvents Recorded: ${events.length}`);
  console.log('Sample Events:');
  events.slice(0, 3).forEach((event) => {
    console.log(`  - ${event.name}`);
  });

  // ========================================================================
  // Display Cache Stats
  // ========================================================================

  console.log('\n' + '='.repeat(60));
  console.log('Cache Statistics');
  console.log('='.repeat(60));

  const cacheStats = cacheStorage.getStats();
  console.log(`Cache Size: ${cacheStats.size} / ${cacheStats.maxSize}`);

  console.log('\n' + '='.repeat(60));
  console.log('Demo Complete!');
  console.log('='.repeat(60));
}

// Run demo
runDemo().catch((error) => {
  console.error('Demo failed:', error);
  process.exit(1);
});
