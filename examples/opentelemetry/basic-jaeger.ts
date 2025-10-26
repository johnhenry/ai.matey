/**
 * OpenTelemetry with Jaeger Example
 *
 * This example shows how to set up OpenTelemetry tracing with Jaeger.
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
 * 3. Run this example:
 *    npx tsx examples/opentelemetry/basic-jaeger.ts
 *
 * 4. View traces:
 *    Open http://localhost:16686 in your browser
 */

import { Bridge } from '../../src/index.js';
import { createOpenAIFrontendAdapter } from '../../src/adapters/frontend/index.js';
import { createOpenAIBackendAdapter } from '../../src/adapters/backend/index.js';
import { createOpenTelemetryMiddleware, shutdownOpenTelemetry } from '../../src/middleware/index.js';

async function main() {
  console.log('🔍 OpenTelemetry + Jaeger Example\n');

  // Create bridge with OpenAI
  const bridge = new Bridge({
    frontend: createOpenAIFrontendAdapter(),
    backend: createOpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY!,
    }),
  });

  // Add OpenTelemetry middleware (async)
  const otelMiddleware = await createOpenTelemetryMiddleware({
    serviceName: 'ai-matey-jaeger-demo',
    serviceVersion: '1.0.0',
    endpoint: 'http://localhost:4318/v1/traces',
    resourceAttributes: {
      'deployment.environment': 'development',
    },
  });
  bridge.use(otelMiddleware);

  console.log('📡 Sending request to OpenAI...\n');

  try {
    // Make a request - will be traced!
    const response = await bridge.chat({
      messages: [
        {
          role: 'user',
          content: 'What is the capital of France? Answer in one sentence.',
        },
      ],
      model: 'gpt-3.5-turbo',
    });

    console.log('✅ Response:', response.content);
    console.log('\n📊 Usage:', {
      promptTokens: response.usage?.promptTokens,
      completionTokens: response.usage?.completionTokens,
      totalTokens: response.usage?.totalTokens,
    });

    console.log('\n🔍 View trace in Jaeger: http://localhost:16686');
    console.log('   Look for service: ai-matey-jaeger-demo\n');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Graceful shutdown
    console.log('🛑 Shutting down OpenTelemetry...');
    await shutdownOpenTelemetry();
    console.log('✅ Shutdown complete');
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await shutdownOpenTelemetry();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdownOpenTelemetry();
  process.exit(0);
});

main().catch(console.error);
