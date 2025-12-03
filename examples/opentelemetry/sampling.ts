/**
 * OpenTelemetry Sampling Example
 *
 * This example demonstrates sampling for high-traffic applications.
 * Sampling reduces overhead by only tracing a percentage of requests.
 *
 * Prerequisites:
 * 1. Install OpenTelemetry packages:
 *    npm install @opentelemetry/api @opentelemetry/sdk-trace-base \
 *      @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources \
 *      @opentelemetry/semantic-conventions
 *
 * 2. Start Jaeger (or any OTLP-compatible backend):
 *    docker run -d --name jaeger \
 *      -p 4318:4318 \
 *      -p 16686:16686 \
 *      jaegertracing/all-in-one:latest
 *
 * 3. Run this example:
 *    npx tsx examples/opentelemetry/sampling.ts
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { MockBackendAdapter } from 'ai.matey.backend/mock';
import { createOpenTelemetryMiddleware, shutdownOpenTelemetry } from 'ai.matey.middleware/opentelemetry';

async function main() {
  console.log('📊 OpenTelemetry Sampling Example\n');

  // Create bridge with mock backend (no API key needed)
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new MockBackendAdapter({
      responses: [
        {
          content: 'This is a mock response.',
          finishReason: 'stop',
          usage: {
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
          },
        },
      ],
    })
  );

  // Add OpenTelemetry middleware with 10% sampling (async)
  // This means only 1 out of 10 requests will be traced
  const otelMiddleware = await createOpenTelemetryMiddleware({
    serviceName: 'ai-matey-sampling-demo',
    endpoint: 'http://localhost:4318/v1/traces',
    samplingRate: 0.1, // Sample 10% of requests
    resourceAttributes: {
      'deployment.environment': 'production',
    },
  });
  bridge.use(otelMiddleware);

  console.log('🔬 Sampling Rate: 10%');
  console.log('📡 Sending 20 requests...\n');

  try {
    // Make multiple requests to demonstrate sampling
    const totalRequests = 20;

    for (let i = 1; i <= totalRequests; i++) {
      await bridge.chat({
        messages: [
          {
            role: 'user',
            content: `Request ${i}`,
          },
        ],
        model: 'gpt-3.5-turbo',
      });

      // Note: We can't directly detect if a request was sampled from the response
      // But we can see it in the traces
      console.log(`✓ Request ${i} completed`);
    }

    console.log('\n📊 Statistics:');
    console.log(`   Total requests: ${totalRequests}`);
    console.log(`   Expected sampled: ~${Math.round(totalRequests * 0.1)}`);
    console.log('\n🔍 Check Jaeger for actual sampled traces: http://localhost:16686');
    console.log('   Service: ai-matey-sampling-demo\n');

    console.log('💡 Tips:');
    console.log('   - Use higher sampling rates in development (1.0 = 100%)');
    console.log('   - Use lower sampling rates in production (0.01 = 1%, 0.1 = 10%)');
    console.log('   - Balance between observability and performance overhead');
  } catch (error) {
    // Sanitize error for logging (avoid logging sensitive data)
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error:', errorMessage);
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
