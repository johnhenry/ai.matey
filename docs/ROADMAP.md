# ai.matey Roadmap

Development roadmap and strategic direction for the Universal AI Adapter System.

## Architecture Overview

**Monorepo Structure:**
- 23 consolidated packages
- 165 TypeScript source files
- 32,019 lines of TypeScript code
- Turbo-based build system with caching
- Dual-format distribution: ESM and CommonJS
- Full TypeScript declarations

## Current Capabilities

### Core Foundation
- ✅ Universal IR (Intermediate Representation)
- ✅ Bridge architecture with middleware support
- ✅ Router with 7 routing strategies (explicit, model-based, cost-optimized, latency-optimized, round-robin, random, custom)
- ✅ Circuit breaker pattern with health checking
- ✅ Fallback chains (sequential and parallel)
- ✅ Provider-agnostic request/response handling

### Providers
- ✅ **24 Backend Providers** in `ai.matey.backend`:
  OpenAI, Anthropic, Gemini, Mistral, Cohere, Groq, Ollama, AI21, Anyscale, AWS Bedrock, Azure OpenAI, Cerebras, Cloudflare, DeepInfra, DeepSeek, Fireworks, HuggingFace, LMStudio, NVIDIA, OpenRouter, Perplexity, Replicate, Together AI, XAI
- ✅ **7 Frontend Adapters** in `ai.matey.frontend`:
  OpenAI, Anthropic, Gemini, Mistral, Ollama, Chrome AI, Generic
- ✅ **3 Browser Backends** in `ai.matey.backend.browser`:
  Chrome AI, Function-based, Mock provider
- ✅ **Native adapters** in `ai.matey.native.*`:
  Apple Silicon (MLX), node-llamacpp, model-runner

### Middleware & Cross-Cutting Concerns
All 10 middleware types in `ai.matey.middleware`:
- **logging** - Request/response logging
- **telemetry** - Metrics collection
- **opentelemetry** - Distributed tracing (OpenTelemetry standard)
- **caching** - Response caching
- **retry** - Automatic retries with backoff
- **transform** - Request/response transforms
- **security** - Rate limiting & security
- **cost-tracking** - Usage & cost tracking
- **validation** - Input validation & sanitization
- **conversation-history** - Context management

### HTTP Integration
- ✅ **6 Framework adapters**: Express, Fastify, Hono, Koa, Node.js, Deno
- ✅ **Shared utilities** in `ai.matey.http.core`: auth, CORS, error-handler, health-check, rate-limiter, streaming-handler
- ✅ **OpenAI-compatible** API endpoints

### React Integration
**Core Hooks** (`ai.matey.react.core`):
- useChat, useCompletion, useObject

**Extended Hooks** (`ai.matey.react.hooks`):
- useAssistant, useStream, useTokenCount

**Streaming Components** (`ai.matey.react.stream`):
- StreamProvider component

**Next.js** (`ai.matey.react.nextjs`):
- App Router integration
- Server Actions support
- Client and server utilities

### SDK Wrappers
`ai.matey.wrapper` provides compatibility layers:
- OpenAI SDK-compatible wrapper
- Anthropic SDK-compatible wrapper
- Chrome AI legacy support
- AnyMethod wrapper

### CLI Tools
`ai.matey.cli` includes:
- Proxy server
- Format converters (request/response)
- Ollama command emulation (list, ps, pull, run, show)
- Backend loader
- Pipeline inspector
- Model translation utilities

### Developer Experience
- ✅ Comprehensive TypeScript types with discriminated unions
- ✅ Type inference from adapters
- ✅ Debug mode with pipeline visibility
- ✅ Performance profiling tools
- ✅ Semantic drift warnings
- ✅ Provenance tracking throughout request chain

## Package Structure

### Foundation (5 packages)
- `ai.matey` - Main umbrella package
- `ai.matey.types` - TypeScript type definitions
- `ai.matey.errors` - Error classes and codes
- `ai.matey.utils` - Utilities and helpers
- `ai.matey.core` - Bridge, Router, Middleware core

### Providers (3 packages)
- `ai.matey.backend` - All 24 backend provider adapters
- `ai.matey.backend.browser` - Browser-only backends
- `ai.matey.frontend` - All 7 frontend adapters

### Infrastructure (4 packages)
- `ai.matey.middleware` - All 10 middleware types
- `ai.matey.http` - HTTP server integration
- `ai.matey.http.core` - HTTP core utilities
- `ai.matey.testing` - Testing utilities and fixtures

### HTTP Frameworks (4 packages)
- `ai.matey.http.express`
- `ai.matey.http.hono`
- `ai.matey.http.fastify`
- `ai.matey.http.koa`

### React Integration (4 packages)
- `ai.matey.react.core` - Core hooks
- `ai.matey.react.hooks` - Extended hooks
- `ai.matey.react.stream` - Streaming components
- `ai.matey.react.nextjs` - Next.js integration

### Native/Advanced (3 packages)
- `ai.matey.native.apple` - Apple MLX integration
- `ai.matey.native.node-llamacpp` - Node Llama.cpp
- `ai.matey.native.model-runner` - Local model runner

### Utilities (2 packages)
- `ai.matey.wrapper` - SDK compatibility wrappers
- `ai.matey.cli` - Command-line interface

## Installation & Usage

### Core Installation

```bash
npm install ai.matey.core ai.matey.types
```

### Add Providers

```bash
# All backend providers in one package
npm install ai.matey.backend

# All frontend adapters in one package
npm install ai.matey.frontend

# All middleware in one package
npm install ai.matey.middleware
```

### Basic Usage

```typescript
import { Bridge } from 'ai.matey.core';
import { OpenAIBackendAdapter } from 'ai.matey.backend';
import { createLoggingMiddleware, createRetryMiddleware } from 'ai.matey.middleware';

const bridge = new Bridge({
  backend: new OpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY
  })
});

bridge
  .use(createLoggingMiddleware({ level: 'info' }))
  .use(createRetryMiddleware({ maxAttempts: 3 }));

const response = await bridge.execute({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'gpt-4'
});
```

### React Usage

```bash
npm install ai.matey.react.core react
```

```typescript
import { useChat } from 'ai.matey.react.core';

function ChatComponent() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat'
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>{m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
```

## Market Position

ai.matey occupies a unique position as a **provider-agnostic abstraction layer** with production-grade features.

### Market Landscape

The AI tooling ecosystem has 6 distinct categories:

**1. Orchestration Frameworks** (LangChain.js, LlamaIndex.TS, Mastra)
- Focus: Complex AI workflows, agents, RAG systems
- **ai.matey Position**: Can serve as provider abstraction layer underneath these frameworks

**2. UI/Frontend Frameworks** (Vercel AI SDK, AI SDK Foundations)
- Focus: Building AI-powered user interfaces
- **ai.matey Position**: Can power the backend APIs that these UIs consume

**3. Provider Abstraction Libraries** (LiteLLM.js, llm.js, llm-bridge)
- Focus: Normalizing LLM provider APIs
- **ai.matey Position**: Direct competitor with superior routing, middleware, production features

**4. Specialized Tools** (Instructor-JS, Portkey, ModelFusion, Token.js)
- Focus: Specific capabilities (structured output, gateways, cost tracking)
- **ai.matey Position**: Can integrate with or replace depending on use case

**5. Local/Browser Solutions** (Ollama, WebLLM, Chrome AI, Node Llama.cpp)
- Focus: Running models locally or in browsers
- **ai.matey Position**: Supports these as backends (Ollama, Chrome AI adapters included)

**6. Infrastructure & Gateways** (MCP, OpenAI Agents.js, any-llm)
- Focus: Production deployment, routing, observability
- **ai.matey Position**: Can complement MCP or replace simpler gateways

### Ecosystem Positioning

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│  (React, Next.js, Vue, CLI, etc.)      │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│      UI Frameworks (Optional)           │
│  Vercel AI SDK, React hooks            │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│   Orchestration Layer (Optional)        │
│  LangChain, LlamaIndex, Mastra         │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│    ✨ ai.matey ✨                       │
│  Provider Abstraction & Routing        │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
   ┌──────────┐        ┌──────────┐
   │ Cloud    │        │  Local   │
   │ (OpenAI, │        │ (Ollama, │
   │ Anthropic│        │ Chrome   │
   │ Gemini)  │        │ AI, etc.)│
   └──────────┘        └──────────┘
```

**ai.matey sits at the provider abstraction layer**, enabling everything above it to be provider-agnostic.

### Strategic Focus
- ✅ **Provider abstraction** (not orchestration like LangChain)
- ✅ **Backend infrastructure** (not just UI like Vercel AI SDK)
- ✅ **Production reliability** (not just prototyping like LiteLLM.js)
- ✅ **Self-hosted** (not managed service like Portkey)
- ✅ **Library approach** (embedded in your app, not gateway service)

### Competitive Landscape

**Vercel AI SDK** - UI Framework
- ⭐ **Our Edge**: Provider abstraction, routing, middleware, zero vendor lock-in
- ✅ **Matched**: Full React integration
- 🎯 **Gap**: Structured output with Zod

**LangChain.js** - Orchestration Framework
- ⭐ **Our Edge**: Simpler for provider switching
- 🤝 **Complementary**: Use LangChain for orchestration, ai.matey for provider layer

**Portkey** - Gateway Service
- ⭐ **Our Edge**: Privacy-first (no external service), full control, zero service dependencies
- 🔄 **Different Architecture**: Library (embedded) vs Gateway (proxy)

**Instructor-JS** - Structured Output
- ⭐ **Our Edge**: Full provider abstraction, routing, middleware
- 🎯 **Gap**: Zod integration
- 🤝 **Complementary**: Could work together

**LiteLLM.js / llm.js** - Simple Wrappers
- ⭐ **Our Edge**: Production-grade features, advanced routing, comprehensive middleware
- ⚖️ **Trade-off**: More powerful but higher complexity

### Detailed Feature Comparison

Legend: ⭐⭐ = Excellent (best-in-class), ⭐ = Good (competitive), ⚠️ = Limited (basic support), ❌ = Not available, N/A = Not applicable

| Feature | ai.matey | LangChain | Vercel AI | LiteLLM.js | Portkey | **Roadmap to ⭐⭐** |
|---------|----------|-----------|-----------|------------|---------|-----------------|
| Provider abstraction | ⭐⭐ | ⚠️ | ⚠️ | ⭐ | ⭐ | ✅ Already excellent |
| Advanced routing | ⭐⭐ | ❌ | ❌ | ❌ | ⭐ | ✅ Already excellent |
| Circuit breaker | ⭐ | ❌ | ❌ | ❌ | ⭐ | 🎯 See "Circuit Breaker Enhancement" below |
| Zero dependencies | ⭐⭐ | ❌ | ❌ | ⭐ | N/A | ✅ Already excellent |
| HTTP server support | ⭐ | ❌ | ❌ | ❌ | N/A | 🎯 See "HTTP Improvements" below |
| Middleware system | ⭐⭐ | ⚠️ | ⚠️ | ❌ | ⭐ | ✅ Already excellent |
| React integration | ⭐⭐ | ⚠️ | ⭐⭐ | ❌ | ❌ | ✅ Already excellent |
| Self-hosted | ⭐⭐ | ⭐ | ⭐ | ⭐ | ❌ | ✅ Already excellent |
| Structured output | ⚠️ | ⭐ | ⭐⭐ | ❌ | ⚠️ | 🎯 **Next Phase** - Zod integration |

### When to Choose ai.matey

**✅ Choose ai.matey when:**
- Provider independence is critical
- You need production-grade routing and failover
- You want cost/latency optimization
- You're building an API server or gateway
- You need comprehensive middleware
- You want zero runtime dependencies
- You're migrating between providers

**⚠️ Consider alternatives when:**
- You need RAG/agents → **LangChain.js**
- You only need React hooks → **Vercel AI SDK**
- You need structured output only → **Instructor-JS**
- You want managed service → **Portkey**
- You need local models only → **Ollama**

### Unique Strengths

| Capability | ai.matey | Others |
|------------|----------|--------|
| Zero runtime dependencies | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Advanced routing (7 strategies) | ⭐⭐⭐⭐⭐ | ⭐ |
| Circuit breaker pattern | ⭐⭐⭐⭐⭐ | ❌ |
| Provider abstraction | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| React integration | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Middleware pipeline | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Self-hosted | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

## Development Priorities

### Next Phase: Structured Output & Documentation

**1. Structured Output with Zod** (closes gap with Instructor-JS & Vercel AI)
- Zod schema integration
- Schema → tool definitions converter
- Runtime validation
- Type inference from schemas
- Streaming with partial objects
- `generateObject()` method
- JSON schema validation fallback

**2. Enhanced Documentation**
- Interactive code examples
- Step-by-step guides for common patterns
- More real-world examples
- API reference improvements

**3. Circuit Breaker Enhancement** (⭐ → ⭐⭐)
- **OpenTelemetry integration**: Emit circuit state changes as spans/events
  - `circuit.opened`, `circuit.half_open`, `circuit.closed` events
  - Failure count, threshold, and timeout as span attributes
  - Integrates with existing OpenTelemetry middleware
- Configurable failure thresholds per provider
- Half-open state with graduated recovery
- Circuit breaker events and webhooks for custom monitoring
- Per-model circuit breakers (not just per-provider)
- Health check improvements with circuit status

**4. HTTP Server Improvements** (⭐ → ⭐⭐)
- WebSocket support for real-time streaming
- Server-Sent Events (SSE) improvements
- Better error handling and status codes
- Request/response compression
- Rate limiting per route/user
- **Metrics endpoints**:
  - Prometheus format metrics (`/metrics`)
  - OpenTelemetry metrics export (integrates with existing OTel middleware)
  - Circuit breaker status included
- Health check endpoints with detailed status (`/health`, `/health/ready`, `/health/live`)

**5. Embeddings Support**
- Embedding generation across providers (24 backends)
- Batch embedding support with automatic chunking
- Vector dimension normalization across providers
- **Cost tracking integration**: Uses existing cost-tracking middleware
- **Caching integration**: Cache embeddings using existing caching middleware
- **Router integration**: Route embedding requests like chat (cost/latency optimized)

### Future Phase: Semantic Caching & Guardrails

**Semantic Caching** (unique differentiator)
- **Middleware architecture**: Implemented as middleware, works with existing pipeline
- Cache by semantic meaning, not exact match
- Cosine similarity matching with configurable threshold
- **Embeddings integration**: Uses Embeddings Support for semantic comparison
- Cache across different provider formats (provider-agnostic)
- **OpenTelemetry metrics**: Cache hit/miss rates, similarity scores
- Performance: 20x faster than API calls

**Guardrails System** (inspired by Portkey)
- **Middleware architecture**: Implemented as middleware, composable with others
- **Pre-built deterministic checks**: PII detection, profanity filtering, code detection, URL detection, prompt injection
- **LLM-based checks**: Toxicity, bias, factual consistency (uses existing providers)
- **Configurable actions**:
  - `deny` - Block request and return error
  - `log` - Log violation, continue request (uses existing logging middleware)
  - `fallback` - Use fallback provider (uses existing router)
  - `retry` - Retry with modifications (uses existing retry middleware)
- **OpenTelemetry integration**: Guardrail violations tracked as events
- Custom guardrail support via plugin API

**OpenTelemetry Enhancement**
- Additional integration examples (Jaeger, Zipkin, Datadog, Honeycomb)
- Performance optimization for trace spans

## Long-Term Vision

### Enhanced Multi-Modal
- **Audio processing**: Speech-to-text, text-to-speech across providers
  - Uses existing router for provider selection
  - Cost tracking integration
- **Image generation**: DALL-E, Stable Diffusion, Midjourney
  - Provider abstraction for image models
  - Caching integration for generated images
- **Video understanding**: Video analysis across providers
- **Advanced vision capabilities**: OCR, object detection, image classification

### Enterprise Features
- **Geographic routing**: Route to nearest provider for latency
  - Router integration with geo-aware strategy
  - OpenTelemetry metrics for latency by region
- **Multi-tenancy support**: Tenant isolation and resource management
  - Security middleware integration for tenant authentication
  - Cost tracking middleware per tenant
  - Separate circuit breakers per tenant
- **Advanced rate limiting**: Per-tenant, per-model, per-endpoint
  - Security middleware enhancement
  - OpenTelemetry metrics for rate limit hits
  - Integration with existing health checks
- **Audit logging and compliance**: Request/response audit trail
  - Logging middleware integration
  - OpenTelemetry events for audit trail
  - Conversation history middleware for full context preservation
- **SSO integration**: Enterprise authentication support
  - Security middleware enhancement
  - OpenID Connect, SAML support

### Performance Optimizations
- **Request deduplication**: Collapse identical concurrent requests
  - Middleware implementation
  - Caching middleware integration for dedup detection
  - OpenTelemetry metrics for dedup hit rate
- **Batch request optimization**: Automatic batching for supported providers
  - Router enhancement for batch dispatch
  - Cost tracking middleware for batched requests
- **Response compression**: Gzip/brotli for HTTP responses
  - HTTP core utilities enhancement
  - OpenTelemetry metrics for compression ratios
- **Parallel dispatch improvements**: Enhanced parallel execution
  - Router enhancement with improved concurrency control
  - OpenTelemetry distributed tracing for parallel requests
  - Circuit breaker integration (fail fast for unavailable backends)

### Developer Experience
- **VSCode extension**: Code snippets, autocomplete, inline docs
  - TypeScript integration with type inference
  - Quick provider switching
  - OpenTelemetry trace viewer integration
- **Browser debugging extension**: Chrome DevTools integration
  - Request/response inspection
  - Middleware pipeline visualization
  - OpenTelemetry trace correlation
  - Circuit breaker status display
- **Interactive code playground**: Web-based REPL
  - Powered by existing backend adapters
  - Mock provider for demo without API keys
  - React integration examples
- **"Awesome ai.matey" community list**: Curated resources
  - Community adapters, middleware, examples
- **Community adapter marketplace**: Discoverability platform
  - Testing utilities integration for adapter validation
  - OpenTelemetry-instrumented examples

### Advanced Features
- **Machine learning optimization**: Learn optimal models from usage patterns
  - Cost tracking middleware data for training
  - OpenTelemetry metrics for model performance
  - Router integration for automatic model selection
- **Model recommendations**: Suggest cheaper/better alternatives
  - Cost tracking middleware integration
  - Capability matching based on actual usage
  - OpenTelemetry metrics for recommendation acceptance
- **Dynamic pricing**: Real-time pricing API integration
  - Cost tracking middleware enhancement
  - Router integration for cost-based routing
  - OpenTelemetry metrics for pricing fluctuations
- **Advanced capability matching**: Match requests to capable models
  - Router enhancement with capability awareness
  - Uses existing provider metadata
- **Prompt template system**: Versioned prompt management
  - Transform middleware integration
  - Conversation history middleware for template context
  - Validation middleware for template compliance

### Ecosystem Expansion
- **SvelteKit integration**: Server-side actions and stores
  - Similar to existing Next.js integration
  - React core hooks adapted for Svelte
  - HTTP integration with SvelteKit endpoints
- **Vue.js composables**: `useChat`, `useCompletion` for Vue 3
  - Similar to React hooks architecture
  - Composables package following existing pattern
- **WebLLM browser integration**: Hybrid local+cloud models
  - Browser backend adapter (similar to Chrome AI)
  - Router integration for local-first strategy
  - Fallback to cloud providers when local unavailable
- **Plugin system**: Extensible middleware and adapter registry
  - Middleware pipeline enhancement
  - Testing utilities for plugin validation
  - OpenTelemetry integration for plugin metrics
- **Community adapter registry**: NPM-based adapter discovery
  - Standard adapter interface compliance
  - Testing utilities for community adapters
  - OpenTelemetry metrics reporting standard

## Strategic Roadmap Alignment

Our roadmap focuses on:
1. ✅ **Strengthen core competency** (provider abstraction, routing, middleware)
2. ✅ **Achieve excellence in all features** (⭐⭐ across the board)
3. ✅ **Fill competitive gaps** (structured output, circuit breaker, HTTP improvements)
4. ✅ **Add unique value** (semantic caching, guardrails, zero dependencies)
5. ❌ **Avoid scope creep** (won't compete on orchestration/RAG - different domain)

## Success Metrics

**Technical:**
- Zero runtime dependencies maintained
- <10ms middleware overhead
- 99.9% adapter compatibility
- Full TypeScript type coverage

**Adoption:**
- Growing GitHub stars
- NPM downloads increasing
- Active community contributions
- Production deployments

**Quality:**
- 80%+ test coverage
- Zero critical bugs
- <24h issue response time
- Comprehensive documentation

---

*For detailed API documentation, see [API.md](./API.md)*
*For implementation guides, see [GUIDES.md](./GUIDES.md)*
*For OpenTelemetry integration, see [opentelemetry.md](./opentelemetry.md)*
