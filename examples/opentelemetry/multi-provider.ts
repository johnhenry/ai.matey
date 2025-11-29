/**
 * OpenTelemetry Multi-Provider Tracing Example
 *
 * This example shows how OpenTelemetry traces requests across multiple
 * AI providers with fallback routing.
 *
 * Prerequisites:
 * 1. Install OpenTelemetry packages:
 *    npm install @opentelemetry/api @opentelemetry/sdk-trace-base \
 *      @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources \
 *      @opentelemetry/semantic-conventions
 *
 * 2. Start Jaeger:
 *    docker run -d --name jaeger \
 *      -p 4318:4318 \
 *      -p 16686:16686 \
 *      jaegertracing/all-in-one:latest
 *
 * 3. Set environment variables:
 *    export OPENAI_API_KEY=your_openai_key
 *    export ANTHROPIC_API_KEY=your_anthropic_key
 *
 * 4. Run this example:
 *    npx tsx examples/opentelemetry/multi-provider.ts
 */

import { Router } from 'ai.matey.core';
import { createOpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { createOpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { createAnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { createOpenTelemetryMiddleware, shutdownOpenTelemetry } from 'ai.matey.middleware/opentelemetry';

async function main() {
  console.log('🌐 OpenTelemetry Multi-Provider Example\n');

  // Check for required environment variables
  if (!process.env.OPENAI_API_KEY || !process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  Warning: Set OPENAI_API_KEY and ANTHROPIC_API_KEY for full demo');
    console.log('Using mock backend as fallback\n');
  }

  // Create router with multiple backends
  const router = new Router({
    frontend: createOpenAIFrontendAdapter(),
    backends: [
      {
        name: 'openai',
        adapter: createOpenAIBackendAdapter({
          apiKey: process.env.OPENAI_API_KEY || 'mock',
        }),
      },
      {
        name: 'anthropic',
        adapter: createAnthropicBackendAdapter({
          apiKey: process.env.ANTHROPIC_API_KEY || 'mock',
        }),
      },
    ],
    strategy: 'fallback', // Try OpenAI first, fall back to Anthropic
  });

  // Add OpenTelemetry middleware (async)
  // This will trace requests across ALL backends
  const otelMiddleware = await createOpenTelemetryMiddleware({
    serviceName: 'ai-matey-multi-provider',
    serviceVersion: '1.0.0',
    endpoint: 'http://localhost:4318/v1/traces',
    resourceAttributes: {
      'deployment.environment': 'development',
      'service.type': 'multi-provider-router',
    },
  });
  router.use(otelMiddleware);

  console.log('📡 Sending requests with provider fallback...\n');

  try {
    // Make multiple requests
    const queries = ['What is TypeScript?', 'Explain async/await.', 'What are closures?'];

    for (const query of queries) {
      console.log(`🔍 Query: ${query}`);

      const response = await router.chat({
        messages: [
          {
            role: 'user',
            content: `${query} Answer in one sentence.`,
          },
        ],
        model: 'gpt-3.5-turbo',
      });

      console.log(`✅ Response: ${response.content}`);
      console.log(`🏭 Provider: ${response.metadata.provenance?.backend}`);
      console.log(`📊 Tokens: ${response.usage?.totalTokens}\n`);

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log('🔍 View traces in Jaeger: http://localhost:16686');
    console.log('   Service: ai-matey-multi-provider');
    console.log('   Look for spans showing provider fallback behavior\n');

    console.log('💡 Trace Insights:');
    console.log('   - Each request creates a parent span');
    console.log('   - Child spans show individual provider attempts');
    console.log('   - Failed attempts are marked with error status');
    console.log('   - Successful attempts show token usage attributes');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Graceful shutdown
    console.log('\n🛑 Shutting down OpenTelemetry...');
    await shutdownOpenTelemetry();
    console.log('✅ Shutdown complete');
  }
}

// Handle graceful shutdown
const shutdown = async () => {
  await shutdownOpenTelemetry();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch(console.error);
