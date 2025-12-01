/**
 * Observability - OpenTelemetry Integration
 *
 * Demonstrates:
 * - Distributed tracing with OpenTelemetry
 * - Metrics collection (latency, token usage, costs)
 * - Custom spans and attributes
 * - Integration with Jaeger, Honeycomb, etc.
 * - Production monitoring setup
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY in web.env.local.mjs
 * - OpenTelemetry packages installed
 * - Jaeger running (optional): docker run -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one
 *
 * Run:
 *   npx tsx examples/07-advanced-patterns/02-observability.ts
 *
 * View Traces:
 *   http://localhost:16686 (Jaeger UI)
 *
 * Expected Output:
 *   Detailed telemetry data showing request flow, timing,
 *   and custom metrics for AI operations.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { createObservabilityMiddleware } from 'ai.matey.middleware';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

// OpenTelemetry imports
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

let provider: NodeTracerProvider | null = null;

async function setupTelemetry() {
  // Create resource with service information
  const resource = Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'ai-matey-demo',
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'development',
    })
  );

  // Create trace provider
  provider = new NodeTracerProvider({
    resource,
  });

  // Export to Jaeger (OTLP HTTP endpoint)
  const exporter = new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  });

  provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  provider.register();

  console.log('✓ OpenTelemetry configured');
  console.log('  Service: ai-matey-demo');
  console.log('  Exporter: Jaeger (http://localhost:4318)');
  console.log('  View traces: http://localhost:16686\n');
}

async function shutdownTelemetry() {
  if (provider) {
    await provider.shutdown();
    console.log('\n✓ Telemetry shutdown complete');
  }
}

async function main() {
  displayExampleInfo(
    'Observability with OpenTelemetry',
    'Production-grade monitoring and tracing for AI applications',
    [
      'ANTHROPIC_API_KEY in web.env.local.mjs',
      'npm install @opentelemetry/api @opentelemetry/sdk-trace-node',
      'Jaeger running (optional): docker run -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one'
    ]
  );

  try {
    const anthropicKey = requireAPIKey('anthropic');

    // Setup telemetry
    await setupTelemetry();

    // Create bridge with observability middleware
    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    // Add observability middleware
    bridge.use(
      createObservabilityMiddleware({
        serviceName: 'ai-matey-demo',
        trackTokens: true,
        trackCosts: true,
        trackLatency: true,
        customAttributes: {
          environment: 'development',
          team: 'engineering',
        },
      })
    );

    console.log('═'.repeat(60));
    console.log('Example 1: Traced Request');
    console.log('═'.repeat(60) + '\n');

    // Get tracer
    const tracer = trace.getTracer('ai-matey-demo');

    // Create parent span for our operation
    await tracer.startActiveSpan('user-query', async (span) => {
      try {
        span.setAttribute('user.query', 'What is observability?');
        span.setAttribute('model.requested', 'gpt-4');

        console.log('Making traced request...\n');

        const response = await bridge.chat({
          model: 'gpt-4',
          messages: [
            {
              role: 'user',
              content: 'Explain observability in software systems in 2 sentences.',
            },
          ],
          max_tokens: 100,
        });

        // Add response metadata to span
        if (response.usage) {
          span.setAttribute('tokens.prompt', response.usage.prompt_tokens);
          span.setAttribute('tokens.completion', response.usage.completion_tokens);
          span.setAttribute('tokens.total', response.usage.total_tokens);
        }

        span.setStatus({ code: SpanStatusCode.OK });

        console.log('Response:');
        console.log('─'.repeat(60));
        console.log(response.choices[0].message.content);
        console.log('─'.repeat(60) + '\n');

        if (response.usage) {
          console.log('📊 Telemetry Data:');
          console.log(`   Prompt tokens: ${response.usage.prompt_tokens}`);
          console.log(`   Completion tokens: ${response.usage.completion_tokens}`);
          console.log(`   Total tokens: ${response.usage.total_tokens}\n`);
        }

      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        throw error;
      } finally {
        span.end();
      }
    });

    // Example 2: Multiple traced operations
    console.log('═'.repeat(60));
    console.log('Example 2: Multi-Step Traced Operation');
    console.log('═'.repeat(60) + '\n');

    await tracer.startActiveSpan('multi-step-operation', async (parentSpan) => {
      try {
        parentSpan.setAttribute('operation.type', 'multi-step');

        // Step 1: Query
        await tracer.startActiveSpan('step-1-query', async (stepSpan) => {
          console.log('Step 1: Initial query...');

          const response = await bridge.chat({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'What is 2+2?' }],
            max_tokens: 20,
          });

          stepSpan.setAttribute('step', 1);
          stepSpan.setAttribute('result', response.choices[0].message.content || '');

          console.log('  Result:', response.choices[0].message.content + '\n');
          stepSpan.end();
        });

        // Step 2: Follow-up
        await tracer.startActiveSpan('step-2-followup', async (stepSpan) => {
          console.log('Step 2: Follow-up query...');

          const response = await bridge.chat({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Now multiply that by 3' }],
            max_tokens: 20,
          });

          stepSpan.setAttribute('step', 2);
          stepSpan.setAttribute('result', response.choices[0].message.content || '');

          console.log('  Result:', response.choices[0].message.content + '\n');
          stepSpan.end();
        });

        parentSpan.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        parentSpan.recordException(error as Error);
        parentSpan.setStatus({ code: SpanStatusCode.ERROR });
      } finally {
        parentSpan.end();
      }
    });

    console.log('═'.repeat(60));
    console.log('Telemetry Summary');
    console.log('═'.repeat(60) + '\n');

    console.log('✓ All operations traced and exported\n');

    console.log('📊 What Was Captured:');
    console.log('   • Request/response timing');
    console.log('   • Token usage metrics');
    console.log('   • Cost estimates');
    console.log('   • Error tracking');
    console.log('   • Custom attributes');
    console.log('   • Distributed trace context\n');

    console.log('🔍 View in Jaeger:');
    console.log('   1. Open http://localhost:16686');
    console.log('   2. Select service: ai-matey-demo');
    console.log('   3. Click "Find Traces"');
    console.log('   4. Explore trace timeline and spans\n');

    console.log('💡 Production Benefits:');
    console.log('   • Debug performance issues');
    console.log('   • Track costs across services');
    console.log('   • Monitor error rates');
    console.log('   • Understand request flow');
    console.log('   • Set up alerts on anomalies\n');

    console.log('🔧 Integration Options:');
    console.log('   • Jaeger (open source)');
    console.log('   • Honeycomb (SaaS)');
    console.log('   • Datadog APM');
    console.log('   • New Relic');
    console.log('   • AWS X-Ray');
    console.log('   • Google Cloud Trace\n');

  } catch (error) {
    if ((error as any).code === 'ECONNREFUSED') {
      console.log('\n⚠️  Jaeger not running. Start with:');
      console.log('   docker run -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one\n');
      console.log('   (Traces will still work, just won\'t be exported)\n');
    } else {
      displayError(error, 'Observability example');
    }
  } finally {
    await shutdownTelemetry();
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await shutdownTelemetry();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdownTelemetry();
  process.exit(0);
});

main();
