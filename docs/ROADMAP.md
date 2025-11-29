# ai.matey Roadmap

Development roadmap and future plans for the Universal AI Adapter System.

## Current State (Monorepo Consolidated)

**Monorepo Structure:**
- 23 packages (consolidated from 72)
- 165 TypeScript source files
- 32,019 lines of TypeScript code
- 43 test files with comprehensive coverage
- Turbo-based build system with caching
- Dual-format distribution: ESM and CommonJS
- Full TypeScript declarations

**Core Foundation:**
- ✅ Universal IR (Intermediate Representation) - comprehensive format spec
- ✅ Bridge architecture with middleware support
- ✅ Router with 7 routing strategies (explicit, model-based, cost-optimized, latency-optimized, round-robin, random, custom)
- ✅ Circuit breaker pattern with health checking
- ✅ Fallback chains (sequential and parallel)
- ✅ Provider-agnostic request/response handling

**Adapters:**
- ✅ 7 Frontend Adapters (OpenAI, Anthropic, Gemini, Mistral, Ollama, Chrome AI, Generic)
- ✅ 24 Backend Providers (OpenAI, Anthropic, Gemini, Mistral, Cohere, Groq, Ollama, AI21, Anyscale, AWS Bedrock, Azure OpenAI, Cerebras, Cloudflare, DeepInfra, DeepSeek, Fireworks, HuggingFace, LMStudio, NVIDIA, OpenRouter, Perplexity, Replicate, Together AI, X AI)
- ✅ 3 Browser Backends (Chrome AI, Function-based, Mock provider)
- ✅ Native adapters (Apple Silicon, node-llamacpp)

**Middleware & Cross-Cutting Concerns:**
- ✅ 10 Middleware types (logging, telemetry, **OpenTelemetry**, caching, retry, transform, security, cost-tracking, validation, conversation-history)
- ✅ Extensible middleware pipeline
- ✅ Custom middleware support
- ✅ OpenTelemetry integration with distributed tracing support

**HTTP Integration:**
- ✅ 6 Framework adapters (Express, Fastify, Hono, Koa, Node.js, Deno)
- ✅ Shared HTTP utilities (auth, CORS, error-handler, health-check, rate-limiter, streaming-handler)
- ✅ OpenAI-compatible API endpoints

**React Integration:**
- ✅ useChat hook (ai.matey.react.core)
- ✅ useCompletion hook (ai.matey.react.core)
- ✅ useObject hook (ai.matey.react.core)
- ✅ useAssistant hook (ai.matey.react.hooks)
- ✅ useStream hook (ai.matey.react.hooks)
- ✅ useTokenCount hook (ai.matey.react.hooks)
- ✅ StreamProvider component (ai.matey.react.stream)
- ✅ Next.js App Router integration (ai.matey.react.nextjs)
- ✅ Server Actions support
- ✅ Client and server utilities

**SDK Wrappers:**
- ✅ OpenAI SDK-compatible wrapper
- ✅ Anthropic SDK-compatible wrapper
- ✅ Chrome AI legacy support
- ✅ AnyMethod wrapper

**CLI Tools:**
- ✅ Proxy server
- ✅ Format converters (request/response)
- ✅ Ollama command emulation (list, ps, pull, run, show)
- ✅ Backend loader
- ✅ Pipeline inspector
- ✅ Model translation utilities

**Testing & Quality:**
- ✅ Request/response fixtures for all providers
- ✅ Test helpers and contract testing utilities
- ✅ Property-based testing setup
- ✅ Coverage thresholds configured
- ✅ Integration tests for cross-provider scenarios

**Developer Experience:**
- ✅ Comprehensive TypeScript types with discriminated unions
- ✅ Type inference from adapters
- ✅ Debug mode with pipeline visibility
- ✅ Performance profiling tools
- ✅ Semantic drift warnings
- ✅ Provenance tracking throughout request chain

## Competitive Positioning & Strategic Priorities

### Market Position

ai.matey occupies a unique position in the AI tooling ecosystem as a **provider-agnostic abstraction layer** with production-grade features. Our competitive advantages include:

**Technical Differentiation:**
- ✅ **Zero runtime dependencies** (unique among comprehensive solutions)
- ✅ **Advanced routing** (7 strategies including cost/latency optimization)
- ✅ **Circuit breaker pattern** (rare in this space)
- ✅ **Universal IR** (provider-agnostic intermediate representation)
- ✅ **HTTP framework integration** (6 frameworks)
- ✅ **React integration** (4 packages with hooks, streaming, Next.js support)
- ✅ **Monorepo architecture** (23 well-organized packages)

**Strategic Focus:**
- ✅ **Provider abstraction** (not orchestration like LangChain)
- ✅ **Backend infrastructure** (not just UI like Vercel AI SDK)
- ✅ **Production reliability** (not just prototyping like LiteLLM.js)
- ✅ **Self-hosted** (not managed service like Portkey)
- ✅ **Library approach** (embedded in your app, not gateway service)

### Key Competitors Analysis

**1. Vercel AI SDK (~18.5k stars)**
- Their strength: React hooks, streaming UI, Next.js integration
- Our response: ✅ **ADDRESSED** - Full React integration (useChat, useCompletion, useObject, Next.js adapters)
- Gap remaining: Structured output with Zod (`generateObject`) - HIGH PRIORITY
- Our advantage: Provider abstraction, routing, middleware, zero vendor lock-in

**2. LangChain.js (~6k+ stars)**
- Their strength: RAG, agents, orchestration, extensive integrations
- Our position: **WON'T COMPETE** on full orchestration - different problem domain
- Our advantage: Simpler for provider switching without heavy orchestration layer
- Note: Could be complementary (LangChain for orchestration, ai.matey for provider abstraction)

**3. Portkey AI Gateway**
- Their strength: 200+ providers, 50+ guardrails, semantic caching, enterprise observability
- Our position: **LIBRARY vs GATEWAY** - fundamentally different architecture
- Their approach: Centralized proxy/gateway service
- Our approach: Embedded library in application
- Trade-offs:
  - Portkey: Enterprise features, guardrails, semantic caching, centralized observability
  - ai.matey: Privacy-first (no external service), full control, simpler deployment, zero service dependencies

**4. Instructor-JS**
- Their strength: Zod integration, structured extraction, runtime validation, streaming with partial objects
- Gap: We lack Zod integration and structured output - **HIGH PRIORITY**
- Our advantage: Full provider abstraction, routing, middleware
- Potential: Could integrate both (ai.matey for providers, instructor-js for extraction)

**5. LiteLLM.js**
- Their strength: Simplicity, small bundle, quick setup, embedding support
- Our advantage: Comprehensive features, routing, middleware, production-grade, React integration
- Trade-off: We're more complex but more powerful for production use

### Competitive Gaps & Priorities

**✅ RECENTLY ADDRESSED:**
1. ✅ **React hooks** (`useChat`, `useCompletion`) - Matches Vercel AI SDK
2. ✅ **Next.js integration** - App Router, Server Actions support
3. ✅ **Streaming components** - StreamProvider, hooks

**HIGH Priority (Next Phase):**
1. **Structured output with Zod** (like Instructor-JS `generateObject`)
   - Zod schema → tool definitions
   - Runtime validation
   - Type inference
   - Streaming with partial objects
2. **Better documentation** - Interactive examples, more tutorials
3. **Semantic caching** - Unique differentiator (like Portkey)
4. **Embeddings support** - Missing compared to LiteLLM.js

**MEDIUM Priority (Differentiation):**
1. **Guardrails system** - Inspired by Portkey (50+ checks), but via middleware
2. **Agent runtime** - Light orchestration without LangChain complexity
3. **RAG pipeline** - Basic support without full LlamaIndex scope
4. **Geographic routing** - Enterprise feature for global deployments

**LOW Priority (Nice to Have):**
1. **Browser integration** - WebLLM support
2. **VSCode extension** - Developer experience enhancement
3. **Community marketplace** - Long-term ecosystem play

### Strategic Roadmap Alignment

Our roadmap focuses on features that:
1. ✅ **Strengthen core competency** (provider abstraction) - Ongoing
2. ✅ **Fill competitive gaps** (React hooks ✅ DONE, structured output → Next phase)
3. ✅ **Add unique value** (semantic caching, middleware pipeline)
4. ❌ **Avoid scope creep** (won't compete on full orchestration/RAG)

### Market Positioning Summary

| Feature Area | Vercel AI | LangChain | Portkey | Instructor | ai.matey |
|--------------|-----------|-----------|---------|------------|----------|
| React Integration | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| Provider Abstraction | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Advanced Routing | ⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| Structured Output | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ (planned) |
| RAG/Orchestration | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐ (won't compete) |
| Guardrails | ⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐ (middleware) |
| Self-Hosted | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Zero Dependencies | ⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## Upcoming Priorities

### Next Phase: Structured Output & Documentation (Priority: HIGH)

**Structured Output with Zod (closes gap with Instructor-JS & Vercel AI)**
- Zod schema integration
- Schema → tool definitions converter
- Runtime validation
- Type inference from schemas
- Streaming with partial objects (progressive hydration)
- `generateObject()` method (like Vercel AI SDK)
- JSON schema validation fallback

**Enhanced Documentation**
- Interactive code examples
- Video tutorials (leveraging existing 42 video synopses in docs/)
- Step-by-step guides for common patterns
- More real-world examples
- API reference improvements
- Migration guides from other frameworks

**Embeddings Support (closes gap with LiteLLM.js)**
- Embedding generation across providers
- Batch embedding support
- Vector dimension normalization
- Embedding cost tracking

### Future Phase: Semantic Caching & Guardrails (Priority: MEDIUM-HIGH)

**Semantic Caching (unique differentiator, inspired by Portkey)**
- Cache by semantic meaning, not exact match
- Cosine similarity matching
- Configurable threshold
- Cache across different provider formats
- Cache invalidation strategies
- Performance: 20x faster than API calls

**Guardrails System (inspired by Portkey's 50+ checks)**
- Middleware-based guardrail architecture
- Pre-built deterministic checks:
  - PII detection (SSN, credit cards, emails, phone numbers)
  - Profanity filtering
  - Code detection (SQL, Python, JavaScript)
  - URL detection
  - Prompt injection detection
- LLM-based checks:
  - Toxicity detection
  - Bias detection
  - Factual consistency
- Configurable actions: deny, log, fallback, retry
- Custom guardrail support

**OpenTelemetry Enhancement** (extends existing implementation)
- Additional integration examples (Jaeger, Zipkin, Datadog, Honeycomb)
- Performance optimization for trace spans
- Enhanced documentation and tutorials

### Later Phase: Agent Runtime & RAG Basics (Priority: MEDIUM)

**Lightweight Agent Runtime (not competing with LangChain)**
- ReAct pattern support
- Basic tool orchestration
- Multi-step reasoning (simple)
- State management (minimal)
- Memory helpers
- **Note:** Focus on provider-agnostic agent flows, not complex multi-actor systems

**Basic RAG Pipeline (not competing with LlamaIndex)**
- Simple document Q&A (not complex retrieval workflows)
- Document chunking helpers
- Basic vector store integration (Pinecone, Weaviate, Qdrant, Chroma)
- Semantic search utilities
- **Note:** Target simple use cases, integrate with existing RAG libraries for advanced features

---

## Long-Term Considerations

**Enhanced Multi-Modal:**
- Audio processing (speech-to-text, text-to-speech)
- Image generation (DALL-E, Stable Diffusion)
- Video understanding
- Advanced vision capabilities

**Enterprise Features:**
- Geographic routing (route to nearest provider for latency)
- Multi-tenancy support
- Advanced rate limiting per tenant
- Audit logging and compliance
- SSO integration
- Service mesh integration

**Performance Optimizations:**
- Request deduplication
- Batch request optimization
- Response compression
- Parallel dispatch improvements

**Developer Experience:**
- VSCode extension with snippets
- Browser debugging extension
- Interactive code playground (web-based)
- "Awesome ai.matey" community list
- Community adapter marketplace

**Advanced Features:**
- Machine learning optimization (learn optimal models from usage)
- Model recommendations (suggest cheaper/better alternatives)
- Dynamic pricing (real-time pricing API integration)
- Advanced capability matching (semantic, not just boolean)
- Prompt template system with versioning

**Ecosystem Expansion:**
- SvelteKit integration
- Vue.js composables
- WebLLM browser integration (hybrid local+cloud)
- Plugin system
- Community adapter registry

---

## Historical Context

This roadmap replaces the previous competitive analysis documents. The old docs/competition directory contained detailed comparisons with:
- Vercel AI SDK
- LangChain.js
- Portkey AI Gateway
- Instructor-JS
- LiteLLM.js
- And 18 other competitors

**Key takeaways from competitive analysis:**
1. React integration closes a major gap with Vercel AI SDK
2. Structured output with Zod is the highest priority remaining gap
3. We should NOT compete on full RAG/orchestration (LangChain's domain)
4. Library approach (vs gateway service like Portkey) is a strategic differentiation
5. Zero dependencies and comprehensive routing are unique strengths

For archived competitive analysis, see git history of docs/competition/.

---

## OpenTelemetry Integration (Detailed)

**Status:** ✅ **IMPLEMENTED** - Available in `ai.matey.middleware.opentelemetry`
**Competitive Priority:** HIGH - Industry standard for observability

### Current Implementation

OpenTelemetry middleware is **already implemented** and available. This gives us:
- ✅ Industry-standard observability
- ✅ Distributed tracing support
- ✅ Span creation for requests
- ✅ Trace context propagation
- ✅ Integration with existing telemetry

### Competitive Context

Having OpenTelemetry built-in gives us a strong advantage:
- Matches enterprise observability standards
- Enables integration with existing monitoring stacks (Datadog, New Relic, Honeycomb)
- Differentiates from simpler libraries (LiteLLM.js, llm.js)
- Complements our existing telemetry middleware

### What Exists
- ✅ OpenTelemetry middleware (`packages/middleware/src/opentelemetry.ts`)
- ✅ Telemetry middleware
- ✅ Metrics and events system
- ✅ Provenance tracking
- ✅ Documentation (`docs/opentelemetry.md`)

### Enhancement Opportunities

1. **Install Dependencies**
   ```bash
   npm install @opentelemetry/api
   npm install @opentelemetry/sdk-node
   npm install @opentelemetry/instrumentation
   npm install @opentelemetry/exporter-trace-otlp-http
   ```

2. **OpenTelemetry Middleware**
   ```typescript
   // src/middleware/opentelemetry.ts
   export interface OpenTelemetryConfig {
     serviceName: string;
     endpoint: string; // OTLP endpoint
     headers?: Record<string, string>;
     samplingRate?: number;
   }

   export function createOpenTelemetryMiddleware(config)
   ```

3. **Span Creation**
   - Create span for each request
   - Child spans for middleware
   - Child spans for adapter calls
   - Add attributes (provider, model, tokens)

4. **Trace Context Propagation**
   - Extract trace context from headers
   - Inject trace context into outgoing requests
   - Support W3C Trace Context standard

5. **Metrics Export**
   - Request count
   - Latency histogram
   - Error rate
   - Token usage

6. **Integration Examples**
   - Jaeger example
   - Zipkin example
   - Datadog example
   - Honeycomb example
   - New Relic example

7. **Documentation**
   - `docs/opentelemetry.md`
   - Setup guide
   - Configuration reference
   - Integration examples

### Deliverables
- OpenTelemetry middleware
- Span creation and propagation
- Metrics export
- Integration examples
- Documentation

### Success Criteria
- ✅ OpenTelemetry integration working end-to-end
- ✅ OpenTelemetry span creation < 1ms
- ✅ OpenTelemetry setup guide

### Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OpenTelemetry version conflicts | Medium | Medium | Pin versions, test compatibility |
| Performance overhead from instrumentation | Medium | Medium | Make profiling opt-in, optimize critical paths |


## Interactive Examples & Tutorials

**Status:** ✅ **FEASIBLE**
**Competitive Priority:** HIGH - Documentation quality is critical

### Competitive Context

LangChain.js has excellent documentation and is well-established in the ecosystem. Vercel AI SDK has comprehensive examples and video content. Our documentation quality needs to match these leaders. Interactive examples would:
- Lower the learning curve (currently a weakness)
- Compete with Vercel's playground experience
- Build community (like "Awesome LangChain" lists)
- Improve SEO and discovery

### Existing Foundation
- ✅ EXAMPLES.md with 16+ examples
- ✅ Working code examples
- ✅ Documentation system
- ✅ Tutorial video synopses (42 videos planned)

### What's Needed
- Interactive code playground (web-based)
- Step-by-step tutorials
- Video script creation
- Screen recording and editing
- Hosting platform (YouTube, docs site)

### Benefits
- Lower learning curve
- Better onboarding
- Community growth
- SEO and discovery

### Implementation Tasks

1. **Interactive Playground (Web)**
   - Create Next.js app
   - Monaco editor for code
   - Live execution
   - Share examples via URL
   - Deploy to Vercel

2. **Step-by-Step Tutorials**
   - Tutorial 1: Getting Started
   - Tutorial 2: Routing & Fallbacks
   - Tutorial 3: Middleware
   - Tutorial 4: Streaming
   - Tutorial 5: Cost Optimization
   - Tutorial 6: Custom Adapters

3. **Video Tutorial Scripts**
   - Write detailed scripts (see `docs/TUTORIAL-VIDEO-SYNOPSES.md` - 42 videos planned)
   - Include code examples
   - Talking points
   - Visual aids needed

4. **Video Production** (External)
   - Screen recordings
   - Voiceover
   - Editing
   - Publishing to YouTube

5. **Update Documentation Site**
   - Add tutorials section
   - Embed videos
   - Interactive code snippets
   - Search functionality

6. **Create "Awesome ai.matey" List**
   - Community projects
   - Blog posts
   - Tutorials
   - Adapters
   - Tools

### Deliverables
- Interactive playground
- 6 step-by-step tutorials
- Video scripts (42 videos, see [TUTORIAL-VIDEO-SYNOPSES.md](./TUTORIAL-VIDEO-SYNOPSES.md))
- Documentation updates
- Community resource list

### Success Criteria
- ✅ Interactive playground deployed
- ✅ 20+ video tutorials published
- ✅ Playground loads in < 2 seconds
- ✅ Video tutorials for all major features

### Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Video production takes significant effort | High | Low | Focus on most important features first, external help |
| Playground requires maintenance | Medium | Low | Keep simple, use established frameworks |
