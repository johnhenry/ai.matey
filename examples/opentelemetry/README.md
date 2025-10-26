# OpenTelemetry Examples

Examples demonstrating OpenTelemetry integration with ai.matey.

## Prerequisites

Install OpenTelemetry packages:

```bash
npm install @opentelemetry/api \
  @opentelemetry/sdk-trace-base \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

## Examples

### 1. Basic Jaeger Integration

**File:** `basic-jaeger.ts`

Simple example showing OpenTelemetry with Jaeger (open-source tracing).

**Start Jaeger:**
```bash
docker run -d --name jaeger \
  -p 4318:4318 \
  -p 16686:16686 \
  jaegertracing/all-in-one:latest
```

**Run:**
```bash
export OPENAI_API_KEY=your_key
npx tsx examples/opentelemetry/basic-jaeger.ts
```

**View traces:** http://localhost:16686

---

### 2. Honeycomb Integration

**File:** `honeycomb.ts`

Production-ready example with Honeycomb (commercial observability platform).

**Setup:**
1. Sign up at https://honeycomb.io
2. Get your API key from the dashboard

**Run:**
```bash
export HONEYCOMB_API_KEY=your_key
export OPENAI_API_KEY=your_key
npx tsx examples/opentelemetry/honeycomb.ts
```

---

### 3. Sampling for High Traffic

**File:** `sampling.ts`

Demonstrates sampling (only tracing X% of requests) for high-traffic applications.

**Run:**
```bash
npx tsx examples/opentelemetry/sampling.ts
```

**Key concepts:**
- Sample 10% of requests (reduces overhead)
- Production best practice
- Balance observability vs performance

---

### 4. Multi-Provider Tracing

**File:** `multi-provider.ts`

Shows how OpenTelemetry traces requests across multiple AI providers with fallback.

**Run:**
```bash
export OPENAI_API_KEY=your_key
export ANTHROPIC_API_KEY=your_key
npx tsx examples/opentelemetry/multi-provider.ts
```

**Insights:**
- See provider fallback in traces
- Track latency across providers
- Monitor error rates per provider

---

## Common Commands

### Start Jaeger (Local)
```bash
docker run -d --name jaeger \
  -p 4318:4318 \
  -p 16686:16686 \
  jaegertracing/all-in-one:latest
```

### Stop Jaeger
```bash
docker stop jaeger
docker rm jaeger
```

### Start Zipkin (Alternative)
```bash
docker run -d -p 9411:9411 openzipkin/zipkin
```

---

## Trace Attributes

ai.matey automatically adds these attributes to traces:

| Attribute | Description |
|-----------|-------------|
| `ai.request.id` | Unique request ID |
| `ai.request.model` | Requested model |
| `ai.request.stream` | Whether streaming was used |
| `ai.request.message_count` | Number of messages |
| `ai.tokens.prompt` | Prompt tokens used |
| `ai.tokens.completion` | Completion tokens |
| `ai.tokens.total` | Total tokens |
| `ai.frontend` | Frontend adapter (e.g., "openai") |
| `ai.backend` | Backend provider (e.g., "openai") |
| `ai.duration.ms` | Request duration |

---

## Integration Guides

### Datadog

```typescript
createOpenTelemetryMiddleware({
  serviceName: 'my-ai-service',
  endpoint: 'http://localhost:4318/v1/traces', // Datadog Agent
  resourceAttributes: {
    'deployment.environment': process.env.DD_ENV || 'development',
  },
});
```

### New Relic

```typescript
createOpenTelemetryMiddleware({
  serviceName: 'my-ai-service',
  endpoint: 'https://otlp.nr-data.net:4318/v1/traces', // US
  // EU: 'https://otlp.eu01.nr-data.net:4318/v1/traces'
  headers: {
    'api-key': process.env.NEW_RELIC_LICENSE_KEY!,
  },
});
```

### AWS X-Ray

Install additional package:
```bash
npm install @opentelemetry/exporter-trace-otlp-grpc
```

Configure:
```typescript
// Use AWS Distro for OpenTelemetry (ADOT)
// See: https://aws-otel.github.io/docs/getting-started/javascript-sdk
```

---

## Best Practices

1. **Use Sampling in Production**
   ```typescript
   samplingRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0
   ```

2. **Add Environment Context**
   ```typescript
   resourceAttributes: {
     'deployment.environment': process.env.NODE_ENV,
     'service.version': process.env.APP_VERSION,
   }
   ```

3. **Implement Graceful Shutdown**
   ```typescript
   process.on('SIGTERM', async () => {
     await shutdownOpenTelemetry();
     process.exit(0);
   });
   ```

4. **Monitor Key Metrics**
   - Request latency (p50, p95, p99)
   - Token usage by model
   - Error rate by provider
   - Cost per request

---

## Troubleshooting

### No traces showing up?

1. ✅ Verify OpenTelemetry packages are installed
2. ✅ Check endpoint URL is correct
3. ✅ Verify backend is running (Jaeger/Zipkin/etc)
4. ✅ Check sampling rate isn't 0
5. ✅ Verify API keys/headers for cloud providers

### High memory usage?

Lower sampling rate:
```typescript
samplingRate: 0.01 // Sample 1% of requests
```

### Performance overhead?

- **Overhead per sampled request:** ~1-2ms
- **Overhead per non-sampled request:** ~0.1ms
- Use sampling for high-traffic apps

---

## More Resources

- **[OpenTelemetry Documentation](../../docs/opentelemetry.md)**
- **[OpenTelemetry.io](https://opentelemetry.io/)**
- **[Jaeger Documentation](https://www.jaegertracing.io/docs/)**
- **[Honeycomb Documentation](https://docs.honeycomb.io/)**

---

**Questions?**

- 🐛 [Report a bug](https://github.com/johnhenry/ai.matey/issues)
- 💬 [Discussion](https://github.com/johnhenry/ai.matey/discussions)
