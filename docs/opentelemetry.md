# OpenTelemetry Integration

**Status:** ✅ Available (v0.1.1+)
**Maturity:** Production Ready
**Dependencies:** Optional peer dependencies

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Integration Examples](#integration-examples)
  - [Jaeger](#jaeger)
  - [Zipkin](#zipkin)
  - [Datadog](#datadog)
  - [Honeycomb](#honeycomb)
  - [New Relic](#new-relic)
- [Advanced Usage](#advanced-usage)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

ai.matey's OpenTelemetry integration provides industry-standard distributed tracing and observability for your AI applications. Track requests across multiple providers, monitor performance, and gain deep insights into your AI infrastructure.

**Key Benefits:**
- 🔍 Distributed tracing across all AI providers
- 📊 Token usage and cost tracking via spans
- ⚡ Performance monitoring with millisecond precision
- 🏭 Production-grade observability
- 🔌 Works with all major observability platforms
- 🎯 Sampling support for high-traffic applications

**Important Limitations:**
- **Context Propagation**: Currently supports in-process context propagation only. Does NOT extract/inject HTTP headers for cross-service tracing. If you need distributed tracing across HTTP boundaries, you'll need to add custom header handling.
- **Metrics API**: Uses spans for metrics recording. Full OpenTelemetry Metrics API support is planned for future versions.

## Features

- **Automatic Span Creation**: Every AI request gets a detailed trace span
- **Rich Attributes**: Track model, provider, tokens, latency, and more
- **Error Tracking**: Automatic exception recording and error spans
- **Context Propagation**: In-process context propagation using OpenTelemetry Context API
- **Sampling**: Configurable sampling rates for high-volume apps
- **Zero Dependencies**: OpenTelemetry packages are optional peer dependencies
- **Runtime Checks**: Graceful degradation if packages aren't installed

## Installation

OpenTelemetry support requires installing optional peer dependencies:

```bash
npm install @opentelemetry/api \
  @opentelemetry/sdk-trace-base \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

**Why optional?** ai.matey maintains **zero runtime dependencies** for most users. OpenTelemetry is only needed if you want distributed tracing.

## Quick Start

### Basic Usage

```typescript
import { Bridge } from 'ai.matey.core';
import { createOpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { createOpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { createOpenTelemetryMiddleware } from 'ai.matey.middleware/opentelemetry';

async function main() {
  // Create bridge
  const bridge = new Bridge({
    frontend: createOpenAIFrontendAdapter(),
    backend: createOpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY!,
    }),
  });

  // Add OpenTelemetry middleware (async)
  const otelMiddleware = await createOpenTelemetryMiddleware({
    serviceName: 'my-ai-service',
    endpoint: 'http://localhost:4318/v1/traces',
  });
  bridge.use(otelMiddleware);

  // Make request - automatically traced!
  const response = await bridge.chat({
    messages: [{ role: 'user', content: 'Hello!' }],
    model: 'gpt-4',
  });
}

main().catch(console.error);
```

### Check Availability

You can check if OpenTelemetry packages are installed:

```typescript
import { isOpenTelemetryAvailable, isOpenTelemetryLoaded } from 'ai.matey.middleware';

// Async check with dynamic import
if (await isOpenTelemetryAvailable()) {
  console.log('OpenTelemetry is available!');
  const otel = await createOpenTelemetryMiddleware({ ... });
  bridge.use(otel);
} else {
  console.log('OpenTelemetry not installed, using fallback telemetry');
  // Use regular telemetry middleware instead
}

// OR synchronous check if already loaded
if (isOpenTelemetryLoaded()) {
  console.log('OpenTelemetry was already loaded!');
}
```

### Graceful Shutdown

For production applications, ensure proper shutdown:

```typescript
import { shutdownOpenTelemetry } from 'ai.matey.middleware';

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await shutdownOpenTelemetry();
  process.exit(0);
});
```

## Configuration

### OpenTelemetryConfig Options

```typescript
interface OpenTelemetryConfig {
  /**
   * Service name for OpenTelemetry.
   * @default 'ai-matey'
   */
  serviceName?: string;

  /**
   * Service version for OpenTelemetry.
   * @default '0.1.0'
   */
  serviceVersion?: string;

  /**
   * OTLP endpoint URL.
   * @default 'http://localhost:4318/v1/traces'
   */
  endpoint?: string;

  /**
   * Custom headers for OTLP export.
   */
  headers?: Record<string, string>;

  /**
   * Sampling rate (0.0 to 1.0).
   * @default 1.0 (100%)
   */
  samplingRate?: number;

  /**
   * Custom resource attributes.
   */
  resourceAttributes?: Record<string, string>;

  /**
   * Whether to export spans.
   * @default true
   */
  exportSpans?: boolean;

  /**
   * Custom tracer name.
   * @default 'ai-matey-tracer'
   */
  tracerName?: string;
}
```

### Example: Production Configuration

```typescript
const otel = createOpenTelemetryMiddleware({
  serviceName: 'production-ai-service',
  serviceVersion: '1.2.3',
  endpoint: 'https://api.honeycomb.io/v1/traces',
  headers: {
    'x-honeycomb-team': process.env.HONEYCOMB_API_KEY!,
  },
  samplingRate: 0.1, // Sample 10% of requests
  resourceAttributes: {
    'deployment.environment': 'production',
    'service.namespace': 'ai-services',
  },
});
```

## Integration Examples

### Jaeger

[Jaeger](https://www.jaegertracing.io/) is an open-source distributed tracing system.

**1. Start Jaeger:**

```bash
docker run -d --name jaeger \
  -p 4318:4318 \
  -p 16686:16686 \
  jaegertracing/all-in-one:latest
```

**2. Configure ai.matey:**

```typescript
import { createOpenTelemetryMiddleware } from 'ai.matey.middleware';

const otel = createOpenTelemetryMiddleware({
  serviceName: 'my-ai-service',
  endpoint: 'http://localhost:4318/v1/traces',
});

bridge.use(otel);
```

**3. View traces:**

Open http://localhost:16686 in your browser.

### Zipkin

[Zipkin](https://zipkin.io/) is a distributed tracing system.

**1. Start Zipkin:**

```bash
docker run -d -p 9411:9411 openzipkin/zipkin
```

**2. Configure ai.matey:**

```typescript
// Note: Zipkin uses a different endpoint format
// You'll need to use the Zipkin exporter instead
import { createOpenTelemetryMiddleware } from 'ai.matey.middleware';

const otel = createOpenTelemetryMiddleware({
  serviceName: 'my-ai-service',
  endpoint: 'http://localhost:9411/api/v2/spans',
});

bridge.use(otel);
```

**3. View traces:**

Open http://localhost:9411 in your browser.

### Datadog

[Datadog](https://www.datadoghq.com/) is an enterprise monitoring platform.

**1. Install Datadog Agent:**

Follow [Datadog's installation guide](https://docs.datadoghq.com/agent/).

**2. Configure ai.matey:**

```typescript
import { createOpenTelemetryMiddleware } from 'ai.matey.middleware';

const otel = createOpenTelemetryMiddleware({
  serviceName: 'my-ai-service',
  endpoint: 'http://localhost:4318/v1/traces', // Datadog Agent OTLP endpoint
  resourceAttributes: {
    'deployment.environment': process.env.DD_ENV || 'development',
    'service.version': process.env.DD_VERSION || '1.0.0',
  },
});

bridge.use(otel);
```

**Environment variables:**

```bash
export DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_HTTP_ENDPOINT=localhost:4318
export DD_API_KEY=your_datadog_api_key
```

### Honeycomb

[Honeycomb](https://www.honeycomb.io/) is an observability platform built for high-cardinality data.

**1. Get API Key:**

Sign up at https://honeycomb.io and get your API key.

**2. Configure ai.matey:**

```typescript
import { createOpenTelemetryMiddleware } from 'ai.matey.middleware';

const otel = createOpenTelemetryMiddleware({
  serviceName: 'my-ai-service',
  endpoint: 'https://api.honeycomb.io/v1/traces',
  headers: {
    'x-honeycomb-team': process.env.HONEYCOMB_API_KEY!,
    'x-honeycomb-dataset': 'ai-matey-traces',
  },
  resourceAttributes: {
    'deployment.environment': 'production',
  },
});

bridge.use(otel);
```

### New Relic

[New Relic](https://newrelic.com/) is an enterprise observability platform.

**1. Get License Key:**

Get your New Relic license key from the dashboard.

**2. Configure ai.matey:**

```typescript
import { createOpenTelemetryMiddleware } from 'ai.matey.middleware';

const otel = createOpenTelemetryMiddleware({
  serviceName: 'my-ai-service',
  endpoint: 'https://otlp.nr-data.net:4318/v1/traces', // US datacenter
  // For EU: 'https://otlp.eu01.nr-data.net:4318/v1/traces'
  headers: {
    'api-key': process.env.NEW_RELIC_LICENSE_KEY!,
  },
  resourceAttributes: {
    'service.instance.id': process.env.HOSTNAME || 'unknown',
  },
});

bridge.use(otel);
```

## Advanced Usage

### Custom Span Attributes

Access span attributes used by ai.matey:

```typescript
import { OpenTelemetryAttributes } from 'ai.matey.middleware';

console.log(OpenTelemetryAttributes.REQUEST_ID); // 'ai.request.id'
console.log(OpenTelemetryAttributes.TOKENS_TOTAL); // 'ai.tokens.total'
```

**Available attributes:**

- `ai.request.id` - Unique request ID
- `ai.request.model` - Requested model
- `ai.request.stream` - Whether streaming was used
- `ai.request.message_count` - Number of messages
- `ai.request.max_tokens` - Max tokens requested
- `ai.response.backend` - Backend provider used
- `ai.response.finish_reason` - Finish reason
- `ai.response.model` - Actual model used
- `ai.tokens.prompt` - Prompt tokens used
- `ai.tokens.completion` - Completion tokens used
- `ai.tokens.total` - Total tokens used
- `ai.frontend` - Frontend adapter name
- `ai.backend` - Backend adapter name
- `ai.duration.ms` - Request duration in milliseconds

### Combining with Regular Telemetry

You can use both OpenTelemetry and regular telemetry middleware:

```typescript
import {
  createOpenTelemetryMiddleware,
  createTelemetryMiddleware,
  ConsoleTelemetrySink,
} from 'ai.matey.middleware';

// OpenTelemetry for distributed tracing
bridge.use(
  createOpenTelemetryMiddleware({
    serviceName: 'my-ai-service',
    endpoint: 'http://localhost:4318/v1/traces',
  })
);

// Regular telemetry for console logging
bridge.use(
  createTelemetryMiddleware({
    sink: new ConsoleTelemetrySink(),
  })
);
```

### Using OpenTelemetryTelemetrySink

Use OpenTelemetry with the regular telemetry middleware:

```typescript
import {
  createTelemetryMiddleware,
  OpenTelemetryTelemetrySink,
} from 'ai.matey.middleware';

const sink = new OpenTelemetryTelemetrySink({
  serviceName: 'my-ai-service',
  endpoint: 'http://localhost:4318/v1/traces',
});

bridge.use(
  createTelemetryMiddleware({
    sink,
  })
);
```

## Best Practices

### 1. Use Sampling in Production

For high-traffic applications, use sampling to reduce overhead:

```typescript
const otel = createOpenTelemetryMiddleware({
  serviceName: 'my-ai-service',
  samplingRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});
```

### 2. Add Environment Context

Include environment information in resource attributes:

```typescript
const otel = createOpenTelemetryMiddleware({
  serviceName: 'my-ai-service',
  resourceAttributes: {
    'deployment.environment': process.env.NODE_ENV || 'development',
    'service.version': process.env.APP_VERSION || '1.0.0',
    'service.instance.id': process.env.HOSTNAME || 'unknown',
    'cloud.provider': 'aws',
    'cloud.region': process.env.AWS_REGION || 'us-east-1',
  },
});
```

### 3. Implement Graceful Shutdown

Always shutdown OpenTelemetry gracefully:

```typescript
import { shutdownOpenTelemetry } from 'ai.matey.middleware';

async function shutdown() {
  console.log('Shutting down...');
  await shutdownOpenTelemetry();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

### 4. Monitor Performance

Track key metrics:
- Request latency (p50, p95, p99)
- Token usage (prompt, completion, total)
- Error rates by provider
- Cost per request

### 5. Use Conditional Initialization

Only initialize OpenTelemetry if packages are installed:

```typescript
import { isOpenTelemetryAvailable, createOpenTelemetryMiddleware } from 'ai.matey.middleware';

async function setupTracing() {
  if (await isOpenTelemetryAvailable()) {
    const otel = await createOpenTelemetryMiddleware({
      serviceName: 'my-ai-service',
    });
    bridge.use(otel);
  } else {
    console.warn('OpenTelemetry not available, skipping tracing');
  }
}

await setupTracing();
```

## Troubleshooting

### Issue: "OpenTelemetry packages are not installed"

**Solution:** Install the required peer dependencies:

```bash
npm install @opentelemetry/api \
  @opentelemetry/sdk-trace-base \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

### Issue: No traces showing up

**Checklist:**
1. ✅ Verify OpenTelemetry packages are installed
2. ✅ Check endpoint URL is correct
3. ✅ Verify backend is running (Jaeger, Zipkin, etc.)
4. ✅ Check sampling rate isn't too low
5. ✅ Verify API keys/headers are correct
6. ✅ Check network connectivity

### Issue: High memory usage

**Solution:** Lower sampling rate or use batch span processor configuration:

```typescript
const otel = createOpenTelemetryMiddleware({
  serviceName: 'my-ai-service',
  samplingRate: 0.01, // Sample 1% of requests
});
```

### Issue: Traces not linking across services

**Current Limitation:** The current implementation does not automatically extract/inject trace context headers for cross-service tracing.

**Workaround:** If you need distributed tracing across HTTP services, you'll need to manually handle trace context propagation:

```typescript
import { context, propagation, trace } from '@opentelemetry/api';

// Extract trace context from incoming HTTP request
const ctx = propagation.extract(context.active(), req.headers);

// Your ai.matey code runs within this context...
await context.with(ctx, async () => {
  const response = await bridge.chat({ ... });
});

// Inject trace context into outgoing HTTP requests
const headers = {};
propagation.inject(context.active(), headers);
// Add headers to your outgoing request
```

**Note:** Full HTTP header propagation support may be added in future versions.

### Issue: TypeScript errors

**Solution:** Ensure types are installed:

```bash
npm install --save-dev @types/node
```

### Issue: Performance overhead

**Symptoms:**
- Increased latency
- Higher CPU usage

**Solutions:**
1. Use sampling: `samplingRate: 0.1`
2. Disable span export for testing: `exportSpans: false`
3. Use async export (default with BatchSpanProcessor)

## Performance Impact

OpenTelemetry middleware is designed for minimal performance impact:

- **Overhead per sampled request:** Typically < 1-2ms for span creation and export
- **Overhead per non-sampled request:** Negligible (< 0.1ms for sampling decision)
- **Memory overhead:** Depends on batch span processor queue size (default ~2MB buffer)

**Expected Performance:**

The actual overhead depends on:
- **Sampling rate**: Lower sampling = less overhead
- **Span processor config**: Larger batches = less frequent exports
- **Network latency**: OTLP export latency to your collector
- **Attribute count**: More attributes = larger span size

**Recommendations:**
- Use 1-10% sampling in high-traffic production (100-1000+ req/s)
- Use 100% sampling in development or low-traffic scenarios
- Configure `batchSpanProcessorConfig` to tune buffering and export behavior
- Monitor your own latency metrics to measure actual impact

## Next Steps

- **[Middleware Guide](./MIDDLEWARE.md)** - Learn about other middleware
- **[Router Guide](./ROUTER.md)** - Multi-provider routing strategies
- **[Examples](../EXAMPLES.md)** - See full examples
- **[API Reference](./API.md)** - Complete API documentation

## Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [OpenTelemetry JavaScript SDK](https://github.com/open-telemetry/opentelemetry-js)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [Semantic Conventions](https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/)

---

**Questions or Issues?**

- 🐛 [Report a bug](https://github.com/johnhenry/ai.matey/issues)
- 💬 [Discussion forum](https://github.com/johnhenry/ai.matey/discussions)
- 📧 [Contact support](mailto:support@aimatey.dev)
