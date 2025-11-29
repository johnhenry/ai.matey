/**
 * OpenTelemetry with Honeycomb Example
 *
 * This example shows how to set up OpenTelemetry tracing with Honeycomb.
 *
 * Prerequisites:
 * 1. Install OpenTelemetry packages:
 *    npm install @opentelemetry/api @opentelemetry/sdk-trace-base \
 *      @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources \
 *      @opentelemetry/semantic-conventions
 *
 * 2. Sign up for Honeycomb: https://honeycomb.io
 *
 * 3. Get your API key from the Honeycomb dashboard
 *
 * 4. Set environment variables:
 *    export HONEYCOMB_API_KEY=your_api_key
 *    export OPENAI_API_KEY=your_openai_key
 *
 * 5. Run this example:
 *    npx tsx examples/opentelemetry/honeycomb.ts
 */

import { Bridge } from 'ai.matey.core';
import { createOpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { createOpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { createOpenTelemetryMiddleware, shutdownOpenTelemetry } from 'ai.matey.middleware/opentelemetry';

async function main() {
  console.log('🍯 OpenTelemetry + Honeycomb Example\n');

  // Check for required environment variables
  if (!process.env.HONEYCOMB_API_KEY) {
    console.error('❌ Error: HONEYCOMB_API_KEY environment variable is required');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Create bridge with OpenAI
  const bridge = new Bridge({
    frontend: createOpenAIFrontendAdapter(),
    backend: createOpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY,
    }),
  });

  // Add OpenTelemetry middleware with Honeycomb configuration (async)
  const otelMiddleware = await createOpenTelemetryMiddleware({
    serviceName: 'ai-matey-demo',
    serviceVersion: '1.0.0',
    endpoint: 'https://api.honeycomb.io/v1/traces',
    headers: {
      'x-honeycomb-team': process.env.HONEYCOMB_API_KEY,
      'x-honeycomb-dataset': 'ai-matey-traces',
    },
    resourceAttributes: {
      'deployment.environment': process.env.NODE_ENV || 'development',
      'service.namespace': 'ai-services',
    },
    samplingRate: 1.0, // Sample 100% for demo
  });
  bridge.use(otelMiddleware);

  console.log('📡 Sending multiple requests to OpenAI...\n');

  try {
    // Make multiple requests to see different traces
    const queries = [
      'What is the capital of France?',
      'What is 2 + 2?',
      'Tell me a short joke.',
    ];

    for (const query of queries) {
      console.log(`🔍 Query: ${query}`);

      const response = await bridge.chat({
        messages: [
          {
            role: 'user',
            content: query,
          },
        ],
        model: 'gpt-3.5-turbo',
        maxTokens: 50,
      });

      console.log(`✅ Response: ${response.content}`);
      console.log(`📊 Tokens: ${response.usage?.totalTokens}\n`);

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('🍯 View traces in Honeycomb:');
    console.log('   https://ui.honeycomb.io/');
    console.log('   Dataset: ai-matey-traces');
    console.log('   Service: ai-matey-demo\n');
  } catch (error) {
    // Sanitize error for logging (avoid logging sensitive data)
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error:', errorMessage);
  } finally {
    // Graceful shutdown - ensure all spans are exported
    console.log('🛑 Shutting down OpenTelemetry...');
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
