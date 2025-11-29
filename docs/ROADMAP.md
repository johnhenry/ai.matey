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

**3. Embeddings Support**
- Embedding generation across providers
- Batch embedding support
- Vector dimension normalization
- Embedding cost tracking

### Future Phase: Semantic Caching & Guardrails

**Semantic Caching** (unique differentiator)
- Cache by semantic meaning, not exact match
- Cosine similarity matching
- Configurable threshold
- Cache across different provider formats
- Performance: 20x faster than API calls

**Guardrails System** (inspired by Portkey)
- Middleware-based architecture
- Pre-built checks: PII detection, profanity filtering, code detection, URL detection, prompt injection
- LLM-based checks: toxicity, bias, factual consistency
- Configurable actions: deny, log, fallback, retry
- Custom guardrail support

**OpenTelemetry Enhancement**
- Additional integration examples (Jaeger, Zipkin, Datadog, Honeycomb)
- Performance optimization for trace spans

### Later Phase: Agent Runtime & RAG Basics

**Lightweight Agent Runtime**
- ReAct pattern support
- Basic tool orchestration
- Multi-step reasoning (simple)
- State management (minimal)
- **Focus**: Provider-agnostic agent flows, not complex multi-actor systems

**Basic RAG Pipeline**
- Simple document Q&A
- Document chunking helpers
- Basic vector store integration (Pinecone, Weaviate, Qdrant, Chroma)
- Semantic search utilities
- **Target**: Simple use cases, integrate with existing RAG libraries for advanced features

## Long-Term Vision

### Enhanced Multi-Modal
- Audio processing (speech-to-text, text-to-speech)
- Image generation (DALL-E, Stable Diffusion)
- Video understanding
- Advanced vision capabilities

### Enterprise Features
- Geographic routing (route to nearest provider for latency)
- Multi-tenancy support
- Advanced rate limiting per tenant
- Audit logging and compliance
- SSO integration

### Performance Optimizations
- Request deduplication
- Batch request optimization
- Response compression
- Parallel dispatch improvements

### Developer Experience
- VSCode extension with snippets
- Browser debugging extension
- Interactive code playground (web-based)
- "Awesome ai.matey" community list
- Community adapter marketplace

### Advanced Features
- Machine learning optimization (learn optimal models from usage)
- Model recommendations (suggest cheaper/better alternatives)
- Dynamic pricing (real-time pricing API integration)
- Advanced capability matching
- Prompt template system with versioning

### Ecosystem Expansion
- SvelteKit integration
- Vue.js composables
- WebLLM browser integration (hybrid local+cloud)
- Plugin system
- Community adapter registry

## Strategic Roadmap Alignment

Our roadmap focuses on:
1. ✅ **Strengthen core competency** (provider abstraction)
2. ✅ **Fill competitive gaps** (React ✅ done, structured output → next)
3. ✅ **Add unique value** (semantic caching, middleware pipeline)
4. ❌ **Avoid scope creep** (won't compete on full orchestration/RAG)

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
