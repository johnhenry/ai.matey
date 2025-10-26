# Portkey AI Gateway vs ai.matey.universal: Deep Dive Comparison

## Executive Summary

This document provides a comprehensive technical comparison between Portkey AI Gateway and ai.matey.universal. Both projects address the challenge of working with multiple AI providers, but they approach the problem from different architectural perspectives:

- **Portkey AI Gateway**: A production-grade API gateway focused on routing, observability, and guardrails. Acts as a proxy layer sitting between applications and 200+ LLM providers with integrated safety mechanisms and enterprise features.

- **ai.matey.universal**: A provider-agnostic adapter library focused on API-level interoperability through a universal Intermediate Representation (IR), enabling seamless provider switching without vendor lock-in at the code level.

**Key Distinction**: Portkey is a **gateway service** (centralized proxy), while ai.matey.universal is an **adapter library** (embedded in your application).

---

## Project Overview

### Portkey AI Gateway

**Repository**: https://github.com/Portkey-AI/gateway
**Website**: https://portkey.ai/
**Implementation**: TypeScript/Node.js (Edge-optimized)
**License**: Open Source
**Backing**: Portkey AI (funded startup)

**Core Mission**: "A blazing fast AI Gateway with integrated guardrails. Route to 200+ LLMs, 50+ AI Guardrails with 1 fast & friendly API."

Portkey AI Gateway is a comprehensive production infrastructure focused on:
- **Gateway pattern**: Centralized proxy for all LLM requests
- **Routing & load balancing**: Intelligent request distribution across providers
- **Guardrails**: 50+ integrated safety checks and content filtering
- **Observability**: Comprehensive logging, tracing, and analytics (21+ metrics)
- **Reliability**: Automatic retries, fallbacks, circuit breakers
- **Cost optimization**: Semantic caching, usage analytics, provider optimization
- **Enterprise features**: SOC2, HIPAA, GDPR compliance, RBAC

**Architecture Philosophy**: Gateway-first, production-focused, observability-driven, safety-integrated

**Why TypeScript Over Python**: Chosen specifically for:
- Edge computing compatibility (Cloudflare Workers, V8 engine)
- Sub-10ms global latencies via edge deployment
- Excellent async/await for concurrent requests
- Compile-time optimizations through static typing
- WebAssembly integration for performance-critical sections
- Team proficiency and hiring accessibility

**Scale**: 10B+ tokens processed daily, 99.994% uptime, sub-1ms latency

### ai.matey.universal

**Repository**: https://github.com/ai-matey/universal
**Version**: 0.1.0 (Early Development)
**Implementation**: TypeScript 5.0+ (ES2020+)
**License**: MIT

**Core Mission**: "Provider-agnostic interface for AI APIs. Write once, run with any provider."

ai.matey.universal is an adapter library focused on:
- **Adapter pattern**: Frontend/Backend adapter separation
- **Provider interoperability**: Seamless switching through IR
- **Code-level abstraction**: Embedded in your application
- **Zero runtime dependencies**: Lightweight core library
- **Middleware pipeline**: Extensible request/response processing
- **HTTP server adapters**: Multi-framework support (Express, Koa, Hono, Fastify, Deno, Node)
- **Router with 7 strategies**: Cost, latency, round-robin, model-based, etc.

**Architecture Philosophy**: Library-first, adapter-based, unopinionated about deployment, developer-embedded

**Why TypeScript**: ES2020+ for async generator support, strong typing, zero dependencies

---

## Key Features Comparison

### Feature Matrix

| Feature | Portkey AI Gateway | ai.matey.universal |
|---------|-------------------|-------------------|
| **Deployment Model** |
| Architecture Type | Gateway Service (Proxy) | Adapter Library (Embedded) |
| Deployment | Standalone service, Edge, Cloud | Embedded in application |
| Hosting Options | Portkey Cloud, Self-hosted, Edge | Application-embedded |
| **Provider Support** |
| Number of Providers | 200+ LLMs | 6 (OpenAI, Anthropic, Gemini, Mistral, Ollama, Chrome AI) |
| Provider Categories | Cloud, Local, Proprietary | Cloud + Local + Browser |
| Easy Provider Addition | ✅ (Config-based) | ✅ (Adapter pattern) |
| **Routing & Intelligence** |
| Conditional Routing | ✅ (Metadata-based) | ✅ (7 strategies) |
| Load Balancing | ✅ (Weighted) | ⚠️ (Round-robin, random) |
| Cost-based Routing | ✅ | ✅ |
| Latency-based Routing | ✅ | ✅ |
| Model-based Routing | ✅ | ✅ |
| Automatic Fallback | ✅ | ✅ |
| **Reliability** |
| Circuit Breaker | ✅ | ✅ |
| Automatic Retries | ✅ (up to 5, exponential backoff) | ✅ (Middleware-based) |
| Request Timeout | ✅ | ⚠️ (Manual via AbortSignal) |
| Health Checking | ✅ | ✅ (Router-level) |
| **Caching** |
| Simple Caching | ✅ | ✅ (Middleware) |
| Semantic Caching | ✅ (Cosine similarity) | ❌ |
| Cache Performance | 20x faster/cheaper | Varies by middleware |
| **Guardrails & Safety** |
| Integrated Guardrails | ✅ (50+ guardrails) | ❌ |
| Input Validation | ✅ (Pre-request checks) | ⚠️ (Manual via middleware) |
| Output Filtering | ✅ (Post-response checks) | ⚠️ (Manual via middleware) |
| PII Redaction | ✅ | ❌ |
| Content Safety | ✅ (20+ deterministic + LLM-based) | ❌ |
| Custom Guardrails | ✅ | ⚠️ (Via middleware) |
| **Observability** |
| Logging | ✅ (All requests/responses) | ✅ (Middleware) |
| Tracing | ✅ (Request lifecycle) | ⚠️ (Basic via metadata) |
| Analytics Dashboard | ✅ (21+ metrics) | ❌ |
| OpenTelemetry Support | ✅ | ⚠️ (Via custom middleware) |
| Real-time Monitoring | ✅ | ❌ |
| Usage Analytics | ✅ | ⚠️ (Basic stats in router) |
| **Governance** |
| Budget Limits | ✅ (Cost/token-based) | ❌ |
| Rate Limiting | ✅ (Hourly/daily/per-minute) | ✅ (HTTP layer) |
| Role-based Access | ✅ (RBAC) | ⚠️ (Via auth middleware) |
| API Key Management | ✅ (Secure vault) | ❌ |
| **Compliance** |
| SOC2 Certified | ✅ | ❌ |
| HIPAA Compliant | ✅ | ❌ |
| GDPR/CCPA | ✅ | ❌ |
| **API Compatibility** |
| OpenAI Compatible | ✅ | ✅ |
| Anthropic Compatible | ✅ | ✅ |
| Universal REST API | ✅ | ✅ (via HTTP adapters) |
| **Advanced Features** |
| Canary Testing | ✅ | ❌ |
| Multimodality | ✅ (Vision, audio, image gen) | ✅ |
| Remote MCP Support | ✅ | ❌ |
| Streaming Support | ✅ | ✅ (First-class) |
| Tool Calling | ✅ | ✅ |
| **Developer Experience** |
| SDKs | Python, JavaScript | TypeScript (library) |
| Documentation | ✅ (Comprehensive) | ⚠️ (In development) |
| Deployment Complexity | Medium (Service setup) | Low (Library import) |
| Configuration | Config objects/files | Code-based (adapters) |
| **Cost** |
| Self-hosted | ✅ (Free, open-source) | ✅ (Free, MIT) |
| Cloud Hosted | ✅ (Paid plans) | N/A (Not applicable) |
| Runtime Cost | Gateway infrastructure | Application resources only |

---

## Architecture Deep Dive

### Portkey AI Gateway Architecture

```
┌─────────────────────────────────────────┐
│         Application Code                │
│  (OpenAI SDK, Anthropic SDK, etc.)     │
└──────────────────┬──────────────────────┘
                   │ HTTP/REST
                   │
┌──────────────────▼──────────────────────┐
│     Portkey AI Gateway (Proxy)          │
│  ┌────────────────────────────────────┐ │
│  │  Request Ingestion & Validation    │ │
│  └──────────────┬─────────────────────┘ │
│                 │                        │
│  ┌──────────────▼─────────────────────┐ │
│  │  Guardrails Layer (50+ checks)    │ │
│  │  - Input validation               │ │
│  │  - PII detection                  │ │
│  │  - Content safety                 │ │
│  └──────────────┬─────────────────────┘ │
│                 │                        │
│  ┌──────────────▼─────────────────────┐ │
│  │  Cache Layer                       │ │
│  │  - Simple cache                    │ │
│  │  - Semantic cache (similarity)     │ │
│  └──────────────┬─────────────────────┘ │
│                 │                        │
│  ┌──────────────▼─────────────────────┐ │
│  │  Router & Load Balancer            │ │
│  │  - Conditional routing             │ │
│  │  - Weighted distribution           │ │
│  │  - Fallback chains                 │ │
│  │  - Circuit breaker                 │ │
│  └──────────────┬─────────────────────┘ │
│                 │                        │
│  ┌──────────────▼─────────────────────┐ │
│  │  Observability & Analytics         │ │
│  │  - Request logging                 │ │
│  │  - Tracing                         │ │
│  │  - Metrics collection (21+)        │ │
│  └──────────────┬─────────────────────┘ │
│                 │                        │
│  ┌──────────────▼─────────────────────┐ │
│  │  Provider Adapters (200+)          │ │
│  └──────────────┬─────────────────────┘ │
└─────────────────┼─────────────────────────┘
                  │
         ┌────────┴────────┬──────────┬───────┐
         ▼                 ▼          ▼       ▼
   ┌──────────┐      ┌─────────┐  ┌──────┐  ...
   │ OpenAI   │      │Anthropic│  │Gemini│  200+
   │   API    │      │   API   │  │ API  │  LLMs
   └──────────┘      └─────────┘  └──────┘
```

**Key Design Patterns**:
- **Proxy/Gateway**: Centralized intermediary for all LLM traffic
- **Edge Deployment**: Runs on Cloudflare Workers for global low latency
- **Config-Driven**: Gateway configs define routing, fallback, caching rules
- **Observability-First**: All requests logged and traced automatically
- **Safety-Integrated**: Guardrails run on every request (opt-in/out)
- **Stateful Service**: Maintains cache, metrics, rate limits centrally

**Deployment Options**:
```bash
# Local deployment
npx @portkey-ai/gateway

# Docker
docker run -p 8787:8787 portkey/gateway

# Cloudflare Workers (Edge)
# Self-hosted on AWS/GCP/Azure
# Kubernetes
```

### ai.matey.universal Architecture

```
┌─────────────────────────────────────────┐
│         Application Code                │
│  (OpenAI format, Anthropic format, etc) │
└──────────────────┬──────────────────────┘
                   │ (Embedded library)
                   │
┌──────────────────▼──────────────────────┐
│      Frontend Adapter Layer             │
│  OpenAIFrontendAdapter                  │
│  AnthropicFrontendAdapter               │
│  GeminiFrontendAdapter                  │
│  (Normalizes to Universal IR)           │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│    Intermediate Representation (IR)     │
│  Provider-agnostic universal format    │
│  IRChatRequest, IRChatResponse         │
│  IRMessage, IRTool, IRParameters       │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│            Bridge + Router              │
│  ┌────────────────────────────────────┐ │
│  │  Middleware Stack                  │ │
│  │  - Logging                         │ │
│  │  - Telemetry                       │ │
│  │  - Caching                         │ │
│  │  - Retry                           │ │
│  │  - Transform                       │ │
│  └────────────────┬───────────────────┘ │
│                   │                      │
│  ┌────────────────▼───────────────────┐ │
│  │  Router (7 strategies)             │ │
│  │  - Explicit                        │ │
│  │  - Model-based                     │ │
│  │  - Cost-optimized                  │ │
│  │  - Latency-optimized               │ │
│  │  - Round-robin                     │ │
│  │  - Random                          │ │
│  │  - Custom                          │ │
│  │  Circuit Breaker, Fallback Chains │ │
│  └────────────────┬───────────────────┘ │
└───────────────────┼─────────────────────┘
                    │
┌───────────────────▼─────────────────────┐
│      Backend Adapter Layer              │
│  OpenAIBackendAdapter                   │
│  AnthropicBackendAdapter                │
│  GeminiBackendAdapter                   │
│  (Executes on actual provider APIs)    │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
   ┌──────────┐        ┌──────────┐
   │ OpenAI   │        │Anthropic │
   │   API    │        │   API    │
   └──────────┘        └──────────┘
```

**Key Design Patterns**:
- **Library/Adapter**: Embedded code in your application
- **Two-Stage Transformation**: Frontend → IR → Backend
- **Middleware Pipeline**: Extensible request/response processing
- **Application-Level**: Runs within your application process
- **Zero External Dependency**: No external services required
- **Stateless**: State managed by your application

**Usage**:
```typescript
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({ apiKey: '...' })
);

// Embedded in your application
const response = await bridge.chat({ model: 'gpt-4', messages: [...] });
```

---

## Routing & Orchestration Comparison

### Portkey AI Gateway Routing

**Conditional Routing**:
```json
{
  "strategy": {
    "mode": "conditional",
    "conditions": [
      {
        "query": { "metadata.user_tier": "premium" },
        "then": "gpt-4-provider"
      },
      {
        "query": { "metadata.user_tier": "basic" },
        "then": "gpt-3.5-provider"
      }
    ],
    "default": "claude-provider"
  }
}
```

**Load Balancing**:
```json
{
  "strategy": {
    "mode": "loadbalance",
    "targets": [
      { "virtual_key": "openai-key-1", "weight": 0.7 },
      { "virtual_key": "openai-key-2", "weight": 0.3 }
    ]
  }
}
```

**Fallback**:
```json
{
  "strategy": {
    "mode": "fallback",
    "targets": [
      { "virtual_key": "gpt-4-key" },
      { "virtual_key": "claude-key" },
      { "virtual_key": "gemini-key" }
    ]
  }
}
```

**Semantic Caching**:
- Uses cosine similarity to match similar requests
- Configurable threshold for similarity matching
- Serves cached responses 20x faster
- Reduces redundant API calls and costs

**Features**:
- **Metadata-based routing**: Tag requests with custom key-value pairs
- **Weighted load balancing**: Distribute traffic by percentage
- **Automatic retries**: Up to 5 attempts with exponential backoff
- **Request timeout**: Configurable per-strategy timeout handling
- **Circuit breaker**: Per-strategy failure handling

### ai.matey.universal Routing

**7 Routing Strategies**:

1. **Explicit**:
```typescript
const router = new Router({ routingStrategy: 'explicit' });
const response = await router.execute(request, { backend: 'openai' });
```

2. **Model-based**:
```typescript
router.setModelMapping({
  'gpt-4': 'openai',
  'claude-3': 'anthropic',
  'gemini-pro': 'gemini'
});
// Automatically routes based on model name
```

3. **Cost-optimized**:
```typescript
const router = new Router({
  routingStrategy: 'cost-optimized',
  trackCost: true
});
// Routes to provider with lowest average cost
```

4. **Latency-optimized**:
```typescript
const router = new Router({
  routingStrategy: 'latency-optimized',
  trackLatency: true
});
// Routes to provider with lowest average latency
```

5. **Round-robin**:
```typescript
const router = new Router({ routingStrategy: 'round-robin' });
// Distributes requests evenly across backends
```

6. **Random**:
```typescript
const router = new Router({ routingStrategy: 'random' });
// Randomly selects backend for each request
```

7. **Custom**:
```typescript
const router = new Router({
  routingStrategy: 'custom',
  customRouter: async (request, backends, context) => {
    // Your custom logic
    if (request.metadata.custom?.priority === 'high') {
      return 'fast-provider';
    }
    return 'cost-effective-provider';
  }
});
```

**Fallback Strategies**:
```typescript
router
  .setFallbackChain(['primary', 'secondary', 'tertiary'])
  .config.fallbackStrategy = 'sequential'; // or 'parallel'

// Sequential: Try each backend in order until success
// Parallel: Try all remaining backends simultaneously
```

**Circuit Breaker**:
```typescript
const router = new Router({
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,    // Failures before opening
  circuitBreakerTimeout: 60000    // Time before half-open
});

router.openCircuitBreaker('unstable-backend');
router.closeCircuitBreaker('recovered-backend');
```

**Features**:
- **Programmatic routing**: Code-based routing logic
- **Parallel dispatch**: Race multiple backends for fastest response
- **Health checking**: Periodic backend health verification
- **Backend stats**: Track success rate, latency, cost per backend
- **Fallback chains**: Configurable primary → secondary → tertiary

---

## Guardrails & Safety Comparison

### Portkey AI Gateway Guardrails

**50+ Integrated Guardrails**:

**Deterministic Guardrails** (20+):
- **Contains Code**: Detects SQL, Python, TypeScript, JavaScript, etc.
- **PII Detection**: Social Security Numbers, credit cards, emails, phone numbers
- **Profanity Filter**: Language appropriateness checks
- **URL Detection**: Identifies and filters URLs
- **Prompt Injection**: Detects injection attacks
- **Gibberish Detection**: Filters nonsensical input
- **Token Limit**: Enforces max token constraints

**LLM-Based Guardrails**:
- **Toxicity**: AI-powered toxicity detection
- **Bias Detection**: Identifies biased content
- **Factual Consistency**: Checks factual accuracy
- **Topic Relevance**: Ensures on-topic responses
- **Custom LLM Checks**: Define custom validation with LLMs

**Guardrail Configuration**:
```json
{
  "guardrails": [
    {
      "id": "pii-check",
      "on": "input",
      "checks": ["ssn", "credit_card", "email"],
      "action": "deny"
    },
    {
      "id": "code-detection",
      "on": "output",
      "checks": ["contains_sql", "contains_python"],
      "action": "log"
    },
    {
      "id": "toxicity",
      "on": "output",
      "type": "llm",
      "threshold": 0.7,
      "action": "fallback",
      "fallback_provider": "safer-model"
    }
  ]
}
```

**Guardrail Actions**:
- **Deny**: Reject the request outright
- **Log**: Log violation but allow request
- **Fallback**: Route to alternative provider/prompt
- **Retry**: Retry with modified prompt
- **Create Eval Dataset**: Collect for review

**Integration**:
- Runs automatically on every request (if configured)
- Applied to both input (pre-request) and output (post-response)
- Minimal latency impact (~10-50ms depending on checks)
- Results logged in observability dashboard

### ai.matey.universal Guardrails

**No Built-in Guardrails** - Must be implemented via middleware:

```typescript
import { Middleware } from 'ai.matey';

// Custom guardrail middleware
const piiGuardrail: Middleware = {
  name: 'pii-detection',
  async onRequest(request, context, next) {
    // Check for PII in request
    const content = JSON.stringify(request.messages);

    if (containsPII(content)) {
      throw new AdapterError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'PII detected in request',
        isRetryable: false
      });
    }

    return next(request);
  },
  async onResponse(response, context, next) {
    // Check for PII in response
    const content = response.message.content;

    if (containsPII(content)) {
      // Redact or reject
      return {
        ...response,
        message: {
          ...response.message,
          content: redactPII(content)
        }
      };
    }

    return next(response);
  }
};

bridge.use(piiGuardrail);
```

**Flexibility vs Convenience**:
- **Pro**: Complete control over guardrail logic
- **Pro**: Can integrate any third-party guardrail service
- **Con**: Must implement each check manually
- **Con**: No pre-built library of checks
- **Con**: More development effort required

**Potential Integration**:
```typescript
// Could integrate with external guardrail services
import { GuardrailsAI } from 'guardrails-ai';

const externalGuardrail: Middleware = {
  name: 'guardrails-ai',
  async onResponse(response, context, next) {
    const guard = new GuardrailsAI();
    const result = await guard.validate(response.message.content, {
      validators: ['no-pii', 'no-toxicity', 'factual-consistency']
    });

    if (!result.passed) {
      throw new AdapterError({
        code: ErrorCode.GUARDRAIL_FAILED,
        message: `Guardrail failed: ${result.failures.join(', ')}`,
        isRetryable: false
      });
    }

    return next(response);
  }
};
```

---

## Observability Comparison

### Portkey AI Gateway Observability

**Comprehensive Built-in Observability**:

**1. Logging**:
- **Scope**: All multimodal requests and responses automatically logged
- **Storage**: Centralized database with queryable interface
- **Retention**: Configurable (cloud offering)
- **Features**:
  - Full request/response bodies
  - Latency tracking
  - Error details
  - Custom metadata tags
  - Filtering by model, provider, user, tags

**2. Tracing**:
- **Request Lifecycle**: End-to-end visibility from ingestion → routing → provider → response
- **Distributed Tracing**: OpenTelemetry-compliant
- **Trace Details**:
  - Gateway ingestion time
  - Guardrail execution time
  - Cache hit/miss
  - Routing decision
  - Provider call latency
  - Total roundtrip time

**3. Analytics Dashboard** (21+ Metrics):
- **Usage Metrics**:
  - Total requests
  - Requests per model
  - Requests per provider
  - Requests per user
  - Request volume over time
- **Performance Metrics**:
  - P50/P95/P99 latency
  - Average response time
  - Cache hit rate
  - Error rate by provider
- **Cost Metrics**:
  - Total cost
  - Cost per model
  - Cost per user
  - Token usage
  - Cost trends over time
- **Quality Metrics**:
  - Guardrail violations
  - Fallback usage
  - Retry attempts
  - Circuit breaker triggers

**4. Real-time Monitoring**:
- Live request stream
- Real-time error alerts
- Performance anomaly detection
- Cost threshold alerts
- Custom notification rules

**5. Custom Metadata & Feedback**:
```typescript
// Tag requests with custom metadata
await fetch('https://api.portkey.ai/v1/chat/completions', {
  headers: {
    'x-portkey-api-key': '...',
    'x-portkey-metadata': JSON.stringify({
      userId: 'user123',
      sessionId: 'session456',
      feature: 'chat',
      environment: 'production'
    })
  },
  body: JSON.stringify({ messages: [...] })
});

// Add feedback to requests
await portkey.feedback({
  requestId: 'req_abc123',
  rating: 5,
  feedback: 'Great response!'
});
```

**6. Export & Integration**:
- Export logs to S3, BigQuery, etc.
- Webhook notifications
- API for programmatic access
- OpenTelemetry export

### ai.matey.universal Observability

**Middleware-based Observability**:

**1. Logging Middleware**:
```typescript
import { createLoggingMiddleware } from 'ai.matey/middleware';

const logging = createLoggingMiddleware({
  logLevel: 'info',
  includeRequest: true,
  includeResponse: true,
  includeMetadata: true,
  logger: console // or custom logger (Winston, Pino, etc.)
});

bridge.use(logging);
```

**2. Telemetry Middleware**:
```typescript
import { createTelemetryMiddleware } from 'ai.matey/middleware';

const telemetry = createTelemetryMiddleware({
  trackLatency: true,
  trackTokens: true,
  trackErrors: true,
  onMetric: (metric) => {
    // Send to your observability platform
    // (DataDog, New Relic, Prometheus, etc.)
    datadogClient.gauge('llm.latency', metric.latency);
    datadogClient.increment('llm.requests');
  }
});

bridge.use(telemetry);
```

**3. Router Statistics**:
```typescript
const router = new Router({
  trackLatency: true,
  trackCost: true
});

// Get overall stats
const stats = router.getStats();
console.log({
  totalRequests: stats.totalRequests,
  successRate: (stats.successfulRequests / stats.totalRequests) * 100,
  totalFallbacks: stats.totalFallbacks,
  backendStats: stats.backendStats
});

// Get per-backend stats
const openaiStats = router.getBackendStats('openai');
console.log({
  successRate: openaiStats.successRate,
  avgLatency: openaiStats.averageLatencyMs,
  p95Latency: openaiStats.p95LatencyMs,
  totalCost: openaiStats.totalCost
});
```

**4. Custom Observability Integration**:
```typescript
// OpenTelemetry integration example
import { trace } from '@opentelemetry/api';

const otelMiddleware: Middleware = {
  name: 'opentelemetry',
  async onRequest(request, context, next) {
    const span = trace.getTracer('ai.matey').startSpan('llm-request', {
      attributes: {
        'llm.model': request.parameters?.model,
        'llm.provider': context.config.backend?.metadata?.name
      }
    });

    try {
      const response = await next(request);
      span.setAttributes({
        'llm.tokens.prompt': response.usage?.promptTokens,
        'llm.tokens.completion': response.usage?.completionTokens
      });
      return response;
    } finally {
      span.end();
    }
  }
};

bridge.use(otelMiddleware);
```

**Limitations**:
- No built-in dashboard or UI
- No centralized storage (app-level only)
- Manual integration with observability platforms required
- Basic stats tracking in router
- No pre-built analytics

**Advantages**:
- Complete control over where data goes
- Integrate with any observability platform
- No vendor lock-in for monitoring
- Runs in your infrastructure
- No additional service dependencies

---

## Comparison: Purpose and Use Cases

### Portkey AI Gateway Strengths

1. **Production-Grade Gateway Service**
   - Centralized control point for all LLM traffic
   - Enterprise compliance (SOC2, HIPAA, GDPR)
   - Battle-tested at 10B+ tokens/day
   - 99.994% uptime SLA

2. **Integrated Guardrails (50+)**
   - Pre-built safety checks
   - Both deterministic and LLM-based
   - Input and output validation
   - PII redaction, content filtering
   - Configurable actions (deny, log, fallback, retry)

3. **Semantic Caching**
   - Cosine similarity matching
   - 20x faster/cheaper than API calls
   - Reduces redundant requests
   - Intelligent cache invalidation

4. **Comprehensive Observability**
   - 21+ metrics in built-in dashboard
   - Request/response logging out of the box
   - Distributed tracing
   - Real-time monitoring
   - Cost analytics
   - Custom metadata tagging

5. **Config-Driven Orchestration**
   - JSON-based gateway configs
   - No code changes for routing updates
   - Conditional routing by metadata
   - Weighted load balancing
   - Automatic retries and fallbacks

6. **Edge Deployment**
   - Global low latency (<1ms)
   - Cloudflare Workers support
   - Sub-10ms response times
   - TypeScript chosen for V8 optimization

7. **200+ LLM Support**
   - Massive provider ecosystem
   - Cloud, local, proprietary models
   - Easy provider addition via config
   - Unified API interface

8. **Enterprise Features**
   - Budget limits (cost/token-based)
   - Rate limiting (hourly/daily/minute)
   - RBAC (role-based access control)
   - Secure API key vault
   - Canary testing
   - Remote MCP support

### ai.matey.universal Strengths

1. **Library Architecture (Not a Service)**
   - Embedded in your application
   - No external dependencies
   - No additional infrastructure
   - Full control over execution
   - Privacy-first (no data leaves your app)

2. **Code-Level Provider Portability**
   - Intermediate Representation (IR)
   - Write in one format, run on any provider
   - Drop-in SDK replacement (OpenAI/Anthropic)
   - Seamless provider migration
   - No vendor lock-in at code level

3. **HTTP Server Adapters (6 Frameworks)**
   - Express, Koa, Hono, Fastify, Deno, Node
   - OpenAI/Anthropic API-compatible endpoints
   - CORS, auth, rate limiting
   - Framework-agnostic HTTP layer
   - Easy API server creation

4. **Advanced Routing (7 Strategies)**
   - Explicit, model-based, cost, latency, round-robin, random, custom
   - Programmatic routing logic
   - Parallel dispatch (race backends)
   - Custom routing functions
   - Circuit breaker pattern

5. **Middleware Pipeline**
   - Logging, telemetry, caching, retry, transform
   - Custom middleware support
   - Request/response interception
   - Composable pipeline
   - Full control over processing

6. **Zero Dependencies**
   - Core library has zero runtime deps
   - Lightweight bundle
   - No framework requirements
   - Backend-agnostic
   - Runs anywhere (Node, Deno, Browser)

7. **TypeScript-First Design**
   - Strong typing throughout
   - Generic type inference
   - Discriminated unions for IR
   - Type-safe adapters
   - IntelliSense support

8. **Developer-Embedded Approach**
   - No separate service to manage
   - Debug in your application
   - Local development friendly
   - Full stack traces
   - Simpler deployment

### Use Case Fit

| Use Case | Portkey AI Gateway | ai.matey.universal |
|----------|-------------------|-------------------|
| **Enterprise AI Platform** | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Multi-team LLM governance | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Compliance requirements (HIPAA/SOC2) | ⭐⭐⭐⭐⭐ | ⭐ |
| Centralized observability | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Content safety & moderation | ⭐⭐⭐⭐⭐ | ⭐⭐ (custom) |
| Budget & cost control | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Backend API Development** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Provider-agnostic code | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| OpenAI → Anthropic migration | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Drop-in SDK replacement | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Custom routing logic | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Embedded library approach | ❌ | ⭐⭐⭐⭐⭐ |
| No external services | ❌ | ⭐⭐⭐⭐⭐ |
| **Performance-Critical Apps** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Edge deployment | ⭐⭐⭐⭐⭐ | ⭐⭐ (limited) |
| Sub-10ms latency | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Global CDN | ⭐⭐⭐⭐⭐ | N/A |
| Semantic caching | ⭐⭐⭐⭐⭐ | ⭐⭐ (simple cache) |
| **Developer Experience** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Comprehensive docs | ⭐⭐⭐⭐⭐ | ⭐⭐ (in progress) |
| Built-in dashboard | ⭐⭐⭐⭐⭐ | ❌ |
| Pre-built guardrails | ⭐⭐⭐⭐⭐ | ❌ |
| Quick setup | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Privacy & Control** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Self-hosted (no cloud) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Data never leaves your infra | ⭐⭐⭐⭐ (self-host) | ⭐⭐⭐⭐⭐ |
| Full code control | ⭐⭐⭐ (service) | ⭐⭐⭐⭐⭐ |
| No vendor analytics | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Open Source & Cost** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Open source | ✅ | ✅ |
| Free self-hosted | ✅ | ✅ |
| No service fees | ⚠️ (cloud) | ✅ |
| MIT licensed | ❌ | ✅ |

---

## Gateway vs Library: Architectural Tradeoffs

### Gateway Architecture (Portkey)

**Advantages**:
- ✅ Centralized control and governance
- ✅ No application code changes for routing updates
- ✅ Observability dashboard out of the box
- ✅ Shared infrastructure across teams
- ✅ Consistent policies across all apps
- ✅ Edge deployment for global low latency
- ✅ Built-in caching, analytics, guardrails

**Disadvantages**:
- ❌ Additional infrastructure to manage (unless cloud-hosted)
- ❌ Network hop adds latency (unless edge-deployed)
- ❌ Single point of failure (requires high availability)
- ❌ All requests go through gateway (privacy consideration)
- ❌ More complex deployment (service + apps)
- ❌ Potential vendor lock-in to gateway platform

### Library Architecture (ai.matey.universal)

**Advantages**:
- ✅ No external services required
- ✅ No network overhead (embedded)
- ✅ Full control and visibility in app
- ✅ Privacy-first (data stays in app)
- ✅ Simple deployment (just a library)
- ✅ No vendor lock-in for infrastructure
- ✅ Debug in your IDE

**Disadvantages**:
- ❌ Routing logic embedded in app code
- ❌ Each app has its own routing/caching state
- ❌ No centralized observability (app-level only)
- ❌ Must integrate with your own monitoring
- ❌ Configuration changes require code deployment
- ❌ No built-in dashboard or UI

---

## TypeScript Implementation Comparison

### Why Portkey Chose TypeScript Over Python

Portkey's detailed reasoning for TypeScript:

1. **Edge Computing Compatibility**:
   - Python not supported on edge platforms (Cloudflare Workers)
   - TypeScript compiles to JavaScript for V8 engine
   - Enables global edge deployment for <10ms latency

2. **Performance Advantages**:
   - Excellent async/await for concurrent AI requests
   - Compile-time optimizations via static typing
   - JIT compiler optimizations in V8
   - WebAssembly integration for critical sections

3. **Team & Ecosystem**:
   - Team proficiency in JavaScript/TypeScript
   - Easier hiring vs Rust
   - Rich Node.js ecosystem
   - More accessible for open-source contributors

4. **Results**:
   - Sub-10ms global latencies
   - 2B+ requests processed
   - 99.994% API uptime
   - Proven at scale

**Key Quote**: "Sometimes, the theoretically 'best' option isn't the right choice for your specific situation."

### ai.matey.universal TypeScript Choice

- **TypeScript 5.0+**: For latest language features
- **ES2020+ target**: For async generator support (streaming)
- **Zero dependencies**: No runtime deps for core library
- **Strong typing**: Discriminated unions, generics, readonly
- **Developer experience**: IntelliSense, type inference

**Example Type Safety**:
```typescript
// Portkey: Config-driven (runtime)
const config = {
  strategy: { mode: 'fallback', targets: [...] }
};

// ai.matey: Code-driven (compile-time)
const router = new Router();
router
  .register('openai', openaiBackend)
  .register('anthropic', anthropicBackend)
  .setFallbackChain(['openai', 'anthropic']);

// TypeScript ensures backend names exist at compile time
router.execute(request, { backend: 'typo' }); // TypeScript error
```

---

## Code Examples

### Basic Chat Completion

#### Portkey AI Gateway

```typescript
// Using Portkey SDK
import Portkey from 'portkey-ai';

const portkey = new Portkey({
  apiKey: 'your-portkey-api-key',
  virtualKey: 'openai-virtual-key',
  config: {
    strategy: {
      mode: 'fallback',
      targets: [
        { virtualKey: 'gpt-4-key' },
        { virtualKey: 'claude-key' }
      ]
    },
    cache: {
      mode: 'semantic',
      threshold: 0.9
    }
  }
});

const response = await portkey.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'What is 2+2?' }
  ]
});

console.log(response.choices[0].message.content);
```

**Or using OpenAI SDK with Portkey**:
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'your-openai-key',
  baseURL: 'https://api.portkey.ai/v1',
  defaultHeaders: {
    'x-portkey-api-key': 'your-portkey-api-key',
    'x-portkey-config': JSON.stringify({
      strategy: { mode: 'fallback', targets: [...] }
    })
  }
});

const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is 2+2?' }]
});
```

**Features**:
- Gateway handles routing, caching, guardrails automatically
- Config-based fallback and caching
- Observability tracked automatically
- No code changes for routing updates

#### ai.matey.universal

```typescript
import {
  Bridge,
  OpenAIFrontendAdapter,
  AnthropicBackendAdapter
} from 'ai.matey';

const frontend = new OpenAIFrontendAdapter();
const backend = new AnthropicBackendAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY
});
const bridge = new Bridge(frontend, backend);

const response = await bridge.chat({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'What is 2+2?' }
  ]
});

console.log(response.choices[0].message.content);
```

**Features**:
- OpenAI request format, Anthropic backend execution
- Embedded in application (no gateway service)
- IR transformation happens in-process
- Full type safety

### Advanced Routing with Fallback

#### Portkey AI Gateway

```typescript
const config = {
  strategy: {
    mode: 'fallback',
    targets: [
      {
        virtualKey: 'gpt-4-key',
        retry: { attempts: 3 }
      },
      {
        virtualKey: 'claude-key',
        retry: { attempts: 2 }
      },
      {
        virtualKey: 'gemini-key',
        retry: { attempts: 1 }
      }
    ]
  },
  guardrails: [
    {
      id: 'content-safety',
      on: 'output',
      checks: ['toxicity', 'pii'],
      action: 'deny'
    }
  ],
  cache: {
    mode: 'semantic',
    threshold: 0.85
  }
};

const portkey = new Portkey({
  apiKey: 'pk-...',
  config
});

const response = await portkey.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

**Lines of code**: ~35
**Config-driven**: Yes
**Guardrails**: Built-in
**Caching**: Semantic

#### ai.matey.universal

```typescript
import { Router, Bridge, OpenAIFrontendAdapter } from 'ai.matey';
import {
  OpenAIBackendAdapter,
  AnthropicBackendAdapter,
  GeminiBackendAdapter
} from 'ai.matey';

// Setup router with fallback
const router = new Router({
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000
});

router
  .register('openai', new OpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY
  }))
  .register('anthropic', new AnthropicBackendAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY
  }))
  .register('gemini', new GeminiBackendAdapter({
    apiKey: process.env.GEMINI_API_KEY
  }))
  .setFallbackChain(['openai', 'anthropic', 'gemini']);

// Setup bridge with middleware
const frontend = new OpenAIFrontendAdapter();
const bridge = new Bridge(frontend, router);

// Add retry middleware
import { createRetryMiddleware } from 'ai.matey/middleware';
bridge.use(createRetryMiddleware({
  maxRetries: 3,
  retryDelay: 1000
}));

const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

**Lines of code**: ~40
**Code-driven**: Yes
**Guardrails**: Manual (via middleware)
**Caching**: Simple (via middleware)

### Conditional Routing by User Tier

#### Portkey AI Gateway

```typescript
const config = {
  strategy: {
    mode: 'conditional',
    conditions: [
      {
        query: { 'metadata.user_tier': 'enterprise' },
        then: {
          virtualKey: 'gpt-4-turbo-key',
          cache: { mode: 'simple' }
        }
      },
      {
        query: { 'metadata.user_tier': 'premium' },
        then: {
          virtualKey: 'gpt-4-key',
          cache: { mode: 'semantic', threshold: 0.9 }
        }
      },
      {
        query: { 'metadata.user_tier': 'basic' },
        then: {
          virtualKey: 'gpt-3.5-key',
          cache: { mode: 'semantic', threshold: 0.95 }
        }
      }
    ],
    default: { virtualKey: 'claude-haiku-key' }
  }
};

const response = await portkey.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }]
}, {
  headers: {
    'x-portkey-metadata': JSON.stringify({
      user_tier: 'premium',
      user_id: 'user123'
    })
  }
});
```

**Features**:
- Metadata-based conditional routing
- No code changes for routing logic
- Update config without redeployment

#### ai.matey.universal

```typescript
const router = new Router({
  routingStrategy: 'custom',
  customRouter: async (request, backends, context) => {
    const userTier = request.metadata.custom?.userTier;

    switch (userTier) {
      case 'enterprise':
        return 'gpt4-turbo';
      case 'premium':
        return 'gpt4';
      case 'basic':
        return 'gpt35';
      default:
        return 'claude-haiku';
    }
  }
});

router
  .register('gpt4-turbo', gpt4TurboBackend)
  .register('gpt4', gpt4Backend)
  .register('gpt35', gpt35Backend)
  .register('claude-haiku', claudeHaikuBackend);

const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }]
}, {
  metadata: { userTier: 'premium', userId: 'user123' }
});
```

**Features**:
- Programmatic routing logic
- TypeScript functions for routing
- Routing logic in application code

### Semantic Caching

#### Portkey AI Gateway

```typescript
const config = {
  cache: {
    mode: 'semantic',
    threshold: 0.9  // 90% similarity threshold
  }
};

// First request
await portkey.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is the capital of France?' }]
});
// -> Calls OpenAI, stores in semantic cache

// Similar request (within threshold)
await portkey.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me the capital city of France' }]
});
// -> Cache hit! Returns cached response (20x faster)
```

**Features**:
- Cosine similarity matching
- Configurable threshold
- Automatic cache management
- 20x faster than API calls

#### ai.matey.universal

```typescript
import { createCachingMiddleware } from 'ai.matey/middleware';

// Simple caching (exact match only)
const cache = createCachingMiddleware({
  maxSize: 1000,
  ttl: 3600000  // 1 hour
});

bridge.use(cache);

// First request
await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is the capital of France?' }]
});
// -> Calls API, stores exact match

// Exact same request
await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is the capital of France?' }]
});
// -> Cache hit!

// Similar but different request
await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me the capital city of France' }]
});
// -> Cache miss (exact match only), calls API
```

**Features**:
- Simple exact-match caching
- No semantic similarity
- Manual cache implementation for semantic matching required

### Guardrails in Action

#### Portkey AI Gateway

```typescript
const config = {
  guardrails: [
    {
      id: 'input-safety',
      on: 'input',
      checks: ['pii', 'prompt_injection'],
      action: 'deny'
    },
    {
      id: 'output-quality',
      on: 'output',
      checks: ['toxicity', 'factual_consistency'],
      action: 'fallback',
      fallback: {
        virtualKey: 'safer-model-key'
      }
    }
  ]
};

try {
  const response = await portkey.chat.completions.create({
    model: 'gpt-4',
    messages: [{
      role: 'user',
      content: 'My SSN is 123-45-6789. What should I do?'
    }]
  });
} catch (error) {
  // Guardrail denied request due to PII
  console.error('Request blocked by guardrails:', error);
}
```

**Features**:
- 50+ pre-built guardrails
- Input/output validation
- Multiple action types (deny, log, fallback, retry)
- Automatic enforcement

#### ai.matey.universal

```typescript
// Custom guardrail middleware
const piiGuardrail: Middleware = {
  name: 'pii-guardrail',
  async onRequest(request, context, next) {
    const content = JSON.stringify(request.messages);

    // Simple PII detection (SSN pattern)
    const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/;
    if (ssnPattern.test(content)) {
      throw new AdapterError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'PII detected: Social Security Number',
        isRetryable: false
      });
    }

    return next(request);
  }
};

bridge.use(piiGuardrail);

try {
  const response = await bridge.chat({
    model: 'gpt-4',
    messages: [{
      role: 'user',
      content: 'My SSN is 123-45-6789. What should I do?'
    }]
  });
} catch (error) {
  console.error('PII detected:', error);
}
```

**Features**:
- Manual implementation required
- Full control over detection logic
- Can integrate third-party services
- More development effort

---

## Strengths Summary

### Portkey AI Gateway Unique Strengths

1. **Gateway Service Model**
   - Centralized LLM traffic control
   - Shared infrastructure across teams
   - Config-driven updates (no redeployment)
   - Consistent policies everywhere

2. **Integrated Guardrails (50+)**
   - PII detection, toxicity, bias, factual consistency
   - Pre-built deterministic and LLM-based checks
   - Input/output validation
   - Multiple action types

3. **Semantic Caching**
   - Cosine similarity matching
   - 20x performance improvement
   - Intelligent cache invalidation

4. **Observability Dashboard**
   - 21+ metrics out of the box
   - Real-time monitoring
   - Cost analytics
   - Request tracing
   - No integration required

5. **Enterprise Features**
   - SOC2, HIPAA, GDPR compliance
   - Budget limits and rate limiting
   - RBAC and secure key vault
   - 99.994% uptime at scale

6. **Edge Deployment**
   - Global <10ms latency
   - Cloudflare Workers optimization
   - TypeScript for V8 performance

7. **200+ LLM Support**
   - Massive provider ecosystem
   - Easy config-based addition

### ai.matey.universal Unique Strengths

1. **Library Architecture**
   - No external services
   - Embedded in application
   - Zero infrastructure overhead
   - Privacy-first design

2. **Code-Level Portability**
   - Intermediate Representation (IR)
   - Write once, run anywhere
   - Drop-in SDK replacement
   - True provider independence

3. **HTTP Server Adapters**
   - 6 framework support
   - OpenAI/Anthropic compatible endpoints
   - Build API servers easily

4. **Programmatic Routing**
   - 7 routing strategies
   - TypeScript functions
   - Full compile-time type safety
   - Custom routing logic

5. **Middleware Pipeline**
   - Composable, extensible
   - Full control over processing
   - Integrate any observability platform

6. **Zero Dependencies**
   - Lightweight core
   - No vendor lock-in
   - Runs anywhere

7. **Developer-Embedded**
   - Debug in IDE
   - Full stack traces
   - Simple deployment

---

## Weaknesses Summary

### Portkey AI Gateway Weaknesses

1. **Gateway Overhead**
   - Additional infrastructure to manage (self-hosted)
   - Network hop adds latency (non-edge)
   - Single point of failure risk
   - More complex deployment

2. **Privacy Consideration**
   - All requests go through gateway
   - Data passes through Portkey (cloud)
   - Less suitable for highly sensitive data (unless self-hosted)

3. **Vendor Lock-in**
   - Config format proprietary
   - Dashboard tied to Portkey
   - Migration effort to switch gateways

4. **Limited Routing Strategies**
   - Config-based only
   - Less programmatic control
   - Harder to implement complex logic

5. **Not a Library**
   - Cannot embed in application
   - Requires service deployment
   - Less suitable for simple use cases

### ai.matey.universal Weaknesses

1. **No Built-in Guardrails**
   - Must implement all checks manually
   - No pre-built library of 50+ checks
   - More development effort

2. **No Semantic Caching**
   - Only exact-match caching
   - Manual implementation required for similarity

3. **No Observability Dashboard**
   - No built-in UI
   - Must integrate with external platforms
   - Manual monitoring setup

4. **Early Stage (v0.1.0)**
   - Limited documentation
   - Small community
   - Fewer production deployments

5. **No Enterprise Features**
   - No compliance certifications
   - No built-in budget limits (must implement)
   - No RBAC out of the box

6. **Limited Provider Count**
   - 6 providers vs 200+
   - Manual adapter development for new providers

7. **Decentralized State**
   - Each app has own routing/caching state
   - No centralized control
   - Config changes require code deployment

---

## Migration & Adoption Paths

### Adopting Portkey AI Gateway

**From Direct Provider APIs**:
```typescript
// Before: Direct OpenAI
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: '...' });
const response = await openai.chat.completions.create({...});

// After: OpenAI via Portkey Gateway
const openai = new OpenAI({
  apiKey: '...',
  baseURL: 'https://api.portkey.ai/v1',
  defaultHeaders: {
    'x-portkey-api-key': 'pk-...',
    'x-portkey-config': JSON.stringify({ strategy: {...} })
  }
});
const response = await openai.chat.completions.create({...});
```

**Migration Complexity**: Low
- Change baseURL and add headers
- Existing code works as-is
- Gateway provides immediate benefits

### Adopting ai.matey.universal

**From OpenAI SDK**:
```typescript
// Before: OpenAI SDK
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: '...' });
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }]
});

// After: ai.matey wrapper
import { OpenAI } from 'ai.matey/wrappers/openai-sdk';
import { AnthropicBackendAdapter } from 'ai.matey';

const backend = new AnthropicBackendAdapter({ apiKey: '...' });
const openai = OpenAI(backend);

// Same code, different backend!
const response = await openai.chat.completions.create({
  model: 'claude-3-5-sonnet',
  messages: [{ role: 'user', content: 'Hello' }]
});
```

**Migration Complexity**: Low to Medium
- SDK wrapper provides drop-in replacement
- Or refactor to Bridge pattern for more control
- Enables provider switching without code changes

---

## Deployment Comparison

### Portkey AI Gateway Deployment

**Self-Hosted Options**:
```bash
# Local (NPX)
npx @portkey-ai/gateway

# Docker
docker run -p 8787:8787 portkey/gateway

# Cloudflare Workers (Edge)
# Follow Portkey edge deployment guide

# Kubernetes
# Use Portkey Helm charts

# AWS/GCP/Azure
# Deploy as containerized service
```

**Cloud-Hosted**:
- Sign up at portkey.ai
- Get API key
- Use cloud endpoint: `https://api.portkey.ai/v1`
- No infrastructure management

**Architecture**:
- Standalone service
- Separate from application
- Requires high availability setup
- Load balancing recommended
- Monitoring & alerting needed

### ai.matey.universal Deployment

**Application-Embedded**:
```typescript
// Just install and import
npm install ai.matey

import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({ apiKey: '...' })
);

// Runs in your application process
const response = await bridge.chat({...});
```

**HTTP Server**:
```typescript
// Express
import express from 'express';
import { ExpressMiddleware } from 'ai.matey/http/express';

const app = express();
app.post('/v1/chat/completions', ExpressMiddleware(bridge));
app.listen(8080);

// Deploy like any Node.js app
// (Vercel, Railway, Fly.io, AWS Lambda, etc.)
```

**Architecture**:
- Library embedded in app
- No separate service
- Deploys with application
- Same infrastructure as app
- No additional components

---

## Use Case Recommendations

### Choose Portkey AI Gateway When:

1. **Enterprise AI Platform**
   - Multi-team LLM usage
   - Centralized governance needed
   - Compliance requirements (SOC2, HIPAA)
   - Budget and cost control critical

2. **Content Safety is Critical**
   - Need 50+ pre-built guardrails
   - PII detection required
   - Toxicity/bias filtering
   - Regulatory compliance

3. **Observability Dashboard Needed**
   - Want analytics out of the box
   - Real-time monitoring required
   - 21+ metrics tracking
   - No time to build custom dashboards

4. **200+ Provider Support**
   - Need wide provider ecosystem
   - Config-based provider switching
   - Don't want to write adapters

5. **Edge Deployment & Performance**
   - Global low latency required (<10ms)
   - Edge computing preferred
   - Cloudflare Workers deployment

6. **Semantic Caching Benefits**
   - High request similarity
   - Cost reduction priority
   - 20x performance gains valuable

7. **Config-Driven Operations**
   - Want routing updates without code changes
   - Prefer JSON configs over code
   - Ops team manages routing logic

### Choose ai.matey.universal When:

1. **Privacy-First Architecture**
   - Data cannot leave your infrastructure
   - No external services allowed
   - Complete control required

2. **Provider Independence is Critical**
   - Need code-level portability
   - Want to avoid vendor lock-in
   - Plan to switch providers frequently
   - Cost optimization via provider arbitrage

3. **Simple Backend API**
   - Building API server
   - Don't need enterprise features
   - Want lightweight solution
   - Prefer embedded library

4. **Programmatic Routing**
   - Complex routing logic
   - TypeScript/code-based control
   - Compile-time type safety

5. **Drop-in SDK Replacement**
   - Migrating from OpenAI/Anthropic SDK
   - Want minimal code changes
   - SDK wrapper approach preferred

6. **Framework-Specific Integration**
   - Using Express, Koa, Hono, Fastify, Deno
   - Want framework-native middleware
   - Building multi-framework compatible API

7. **Zero External Dependencies**
   - Lightweight bundle required
   - No service infrastructure
   - Simple deployment preferred

8. **Custom Middleware Pipeline**
   - Need full control over request/response processing
   - Want to integrate with existing observability
   - Custom caching/logging/telemetry

### Consider Both (Hybrid) When:

- **Large organization** with multiple teams
  - Portkey for centralized governance, observability, guardrails
  - ai.matey for individual apps that need provider flexibility

- **Privacy + Observability**
  - ai.matey for sensitive data processing (on-prem)
  - Portkey for non-sensitive traffic (analytics, cost tracking)

---

## Conclusion

### Fundamental Difference: Gateway vs Library

**Portkey AI Gateway** and **ai.matey.universal** solve related but distinct problems:

- **Portkey**: Production-grade **infrastructure layer** (gateway service) for enterprise AI deployments. Best when you need centralized control, observability, safety, and compliance.

- **ai.matey.universal**: Developer **library layer** (embedded adapters) for provider-agnostic code. Best when you need code portability, privacy, simplicity, and no external services.

### When Each Excels

**Portkey excels for**:
- Enterprises with compliance requirements
- Teams needing guardrails and safety
- Organizations wanting centralized observability
- Use cases benefiting from semantic caching
- Deployments requiring 200+ provider support
- Edge deployment for global low latency

**ai.matey excels for**:
- Privacy-first architectures
- Provider-agnostic codebases
- Simple backend APIs
- Drop-in SDK replacement scenarios
- Applications avoiding external services
- Developers wanting full control

### Final Recommendations

**Use Portkey AI Gateway if**:
- You need an **enterprise AI platform**
- Compliance, safety, and governance are critical
- You want comprehensive observability out of the box
- You prefer **config-driven** routing and management
- You're building a **multi-team** AI infrastructure

**Use ai.matey.universal if**:
- You need **provider independence** at the code level
- You want a **lightweight library** without services
- You're building a backend API and need flexibility
- You require **privacy-first** design (data stays in app)
- You prefer **code-driven** routing and TypeScript control

**Both are excellent choices** - select based on whether you need a **gateway service** (Portkey) or an **adapter library** (ai.matey).

---

## Technical Specifications

### Portkey AI Gateway

- **Language**: TypeScript (for Edge/V8 optimization)
- **Runtime**: Node.js, Cloudflare Workers (Edge)
- **Deployment**: Standalone service, Cloud-hosted, Self-hosted
- **Architecture**: Gateway/Proxy service
- **Providers**: 200+ LLMs
- **License**: Open Source
- **Scale**: 10B+ tokens/day, 99.994% uptime
- **Latency**: Sub-1ms (edge), Sub-10ms (global)
- **Key Features**: Guardrails, Semantic caching, Observability dashboard

### ai.matey.universal

- **Language**: TypeScript 5.0+ (ES2020+)
- **Runtime**: Node.js 18+, Deno, Browser (Chrome AI)
- **Deployment**: Embedded library in application
- **Architecture**: Adapter pattern (Frontend/Backend)
- **Providers**: 6 (OpenAI, Anthropic, Gemini, Mistral, Ollama, Chrome AI)
- **License**: MIT
- **Dependencies**: Zero (core library)
- **Key Features**: IR-based portability, 7 routing strategies, HTTP adapters

---

*Last updated: 2025-10-14*
*Portkey AI Gateway: Latest (as of 2025-10)*
*ai.matey.universal: v0.1.0*
