# ai.matey Roadmap

Development roadmap and strategic direction for the Universal AI Adapter System.

## Architecture Overview

**Monorepo Structure:**
- 24 consolidated packages
- 194 TypeScript source files
- ~60,500 lines of TypeScript code
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
- ✅ **29 Backend Providers** in `ai.matey.backend`:
  OpenAI, Anthropic, Gemini, Mistral, Cohere, Groq, Ollama, AI21, Anyscale, AWS Bedrock, Azure OpenAI, Cerebras, Cloudflare, DeepInfra, DeepSeek, Fireworks, HuggingFace, LMStudio, NVIDIA, OpenRouter, Perplexity, Replicate, Together AI, XAI, Inception Labs, Moonshot AI, SambaNova, GitHub Models, DashScope (Alibaba Cloud Model Studio)
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
- ✅ **Consolidated package** `ai.matey.http` with subpath imports for 6 frameworks:
  - `ai.matey.http/express`
  - `ai.matey.http/fastify`
  - `ai.matey.http/hono`
  - `ai.matey.http/koa`
  - `ai.matey.http/node`
  - `ai.matey.http/deno`
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
- `ai.matey.backend` - All 29 backend provider adapters
- `ai.matey.backend.browser` - Browser-only backends
- `ai.matey.frontend` - All 7 frontend adapters

### Infrastructure (4 packages)
- `ai.matey.middleware` - All 10 middleware types
- `ai.matey.http` - HTTP framework adapters (subpath imports for express, fastify, hono, koa, node, deno)
- `ai.matey.http.core` - HTTP core utilities
- `ai.matey.testing` - Testing utilities and fixtures


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

## Production Validation

**Comprehensive testing completed:** December 2025

### Test Coverage

**14 test applications** validated production readiness across all core packages:
- 6 original integration tests
- 8 advanced pattern applications
- **50+ test scenarios** executed
- **100% pass rate** on all core packages
- **Zero critical issues** in published versions

### Validated Performance Benchmarks

**Middleware Performance:**
- Single middleware: <1ms overhead ✅
- 6-layer production chain: 1-9ms ✅
- Short-circuit validation: 0ms (immediate) ✅

**Streaming Performance:**
- WebSocket latency: 101ms ✅
- Chunk delivery rate: 19 chunks/sec ✅
- Connection overhead: <100ms ✅

**Batch Processing:**
- Standard configuration: 14.87 req/s, 100% success ✅
- High throughput: 21.37 req/s, 87% success ✅

**Caching Efficiency:**
- Cache hit response: 0ms ✅
- Performance improvement: 1000x+ speedup ✅

**Cost Optimization:**
- Demonstrated savings: 84% vs baseline ✅
- Multi-tier routing validated ✅

### Discovered Integration Patterns

**8 production-ready patterns** validated through comprehensive testing:

1. **Complexity-Based Routing** - Route requests by query complexity
2. **Parallel Provider Aggregation** - Call multiple providers simultaneously
3. **Automatic Failover** - Health-aware provider switching
4. **Cost-Optimized Selection** - Dynamic provider selection by cost
5. **WebSocket Real-Time Streaming** - Bi-directional AI chat
6. **Batch Processing with Rate Limiting** - High-throughput request handling
7. **Advanced Middleware Composition** - Complex middleware chains
8. **Continuous Health Monitoring** - Provider health tracking

*Detailed pattern implementations available in test applications and upcoming pattern library*

### Package Validation Status

| Package | Tests | Pass Rate | Status |
|---------|-------|-----------|--------|
| ai.matey.core | 4 integration | 100% | ✅ Production-ready |
| ai.matey.backend | All providers | 100% | ✅ Production-ready |
| ai.matey.frontend | 3 adapters | 100% | ✅ Production-ready |
| ai.matey.middleware | All 10 types | 100% | ✅ Production-ready |
| ai.matey.http | 6 tests (v0.2.2) | 100% | ✅ Production-ready |
| ai.matey.wrapper | 28 tests | 100% | ✅ Production-ready |
| ai.matey.cli | 9 tests | 100% | ✅ Production-ready |
| ai.matey.react.hooks | Build + types | 100% | ✅ Production-ready |
| ai.matey.utils | 50+ utilities | 100% | ✅ Production-ready |

*Full test report: [FINAL-COMPREHENSIVE-TEST-REPORT.md](../../ai.matey.examples/FINAL-COMPREHENSIVE-TEST-REPORT.md)*

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
- ✅ **Matched**: Full React integration, Structured output with Zod

**LangChain.js** - Orchestration Framework
- ⭐ **Our Edge**: Simpler for provider switching
- 🤝 **Complementary**: Use LangChain for orchestration, ai.matey for provider layer

**Portkey** - Gateway Service
- ⭐ **Our Edge**: Privacy-first (no external service), full control, zero service dependencies
- 🔄 **Different Architecture**: Library (embedded) vs Gateway (proxy)

**Instructor-JS** - Structured Output
- ⭐ **Our Edge**: Full provider abstraction, routing, middleware, React integration
- ✅ **Matched**: Zod integration with generateObject() and streamObject()
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
| Structured output | ⭐⭐ | ⭐ | ⭐⭐ | ❌ | ⚠️ | ✅ Already excellent |

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

## Development Priorities — The Wave Plan (updated 2026-07)

Grounded in a July-2026 competitive analysis (Vercel AI SDK 7, LangChain/LangGraph 1.0, Mastra
1.0, OpenAI Agents SDK, VoltAgent, LiteLLM/Portkey/Helicone gateways). Positioning decision:
**ai.matey remains a pure self-hosted library** — gateway-style capabilities ship as
self-hostable primitives, never a managed service.

Ranked capability gaps this plan closes: (1) MCP client+server — the defining 2026 shift,
table stakes; (2) reusable Agent abstraction; (3) durable execution/checkpointing; (4) agent
memory; (5) evals; (6) human-in-the-loop tool approvals; (7) speech/realtime-voice/image-gen/
reranking; (8) RAG + vector connectors; (9) content guardrails; (10) observability UI + live
pricing sync.

### ✅ Wave 0 (shipped 2026-07): LiteRT-LM on-device backend

`LiteRtLmBackendAdapter` in `ai.matey.backend.browser` — Gemma on WebGPU via `@litert-lm/core`
(optional peer), engine caching per model URL, streaming, semantic-drift warnings for the Web
SDK's dropped features. (`@litertjs/core` is tensor-only and deliberately out of scope; the
MediaPipe genai API is maintenance-mode.)

### Wave 1 (next): MCP + Agents

**MCP client — shipped as `ai.matey.mcp`** (`packages/mcp`, 2026-07-23; depends only on
`ai.matey.types`, no MCP SDK dependency at all — the final design diverged from the original
optional-peer-SDK plan below in favor of a purely structural `McpClientLike` interface, so any
client implementation (the official SDK wrapped by hand, [`mcp-query`](https://github.com/johnhenry/mcp-query),
or a test fake) works with zero adapter code):
- `mcpToolsToDefinitions(client, opts?)` → `Record<string, ToolDefinition>`. MCP tool
  `inputSchema` passes straight through to `IRTool.parameters` (both raw JSON Schema);
  `isError` results throw so the existing `runTools` loop feeds them back as error tool results.
- `runMcpTools(runTools, { client, ...RunToolsOptions })` composes the above with an
  already-bound `runTools` function (e.g. `bridge.runTools`) — zero loop changes needed.
- Protocol-version-agnostic by design: `ai.matey.mcp` never touches the wire protocol, so
  whichever MCP revision(s) the injected client negotiates are supported transparently. See
  `packages/mcp/readme.md`'s "Protocol Versions" section.

**MCP server — not yet built.** The original plan below (`createMCPServer` on the SDK's
low-level `Server`, v1 tools-only / v2 resources+prompts) is still the intended shape for
exposing an ai.matey `Bridge` as an MCP server; tracked separately, not part of the client work
above.
- Server: `createMCPServer({ name, tools, bridge? })` on the SDK's **low-level Server**
  (`setRequestHandler` with raw JSON Schema — avoids a zod dependency), reusing
  `validateToolArgs`; `connectStdio()` plus Streamable HTTP `nodeHandler()`/`genericHandler()`
  for the http adapters. v1 scope: tools only (server-side resources/prompts in v2).
- Tests: SDK `InMemoryTransport.createLinkedPair()` roundtrips; peer-missing → friendly
  `AdapterError(UNSUPPORTED_FEATURE)`.

**Agent abstraction — new package `ai.matey.agent`** (`packages/agent`):
- Small core prerequisite: `RunToolsOptions.stopWhen?: (step) => boolean | Promise<boolean>`
  checked after each iteration in `run-tools.ts`.
- `Agent` class over `createRunTools`: `{ bridge | backend+model, name, instructions
  (string | (ctx) => string), tools, memory?, maxIterations, stopWhen, approvals?, parameters }`;
  `run()`, `stream()` (v1: per-step events via onStepFinish queue), `asTool()` for multi-agent
  handoffs (agent-as-tool with mapInput/mapResult).
- Typed run context: tools are `AgentToolDefinition<TContext>` — wrapped at run time so
  `execute(input, ctx)` receives `ctx.context`.
- Human-in-the-loop: per-tool `needsApproval: boolean | (input, ctx) => boolean`; suspension is
  simply an unresolved promise awaiting the `ApprovalHandler` (AbortSignal still cancels);
  `createApprovalQueue()` gives UIs pending()/approve()/deny(); denial throws
  `TOOL_APPROVAL_DENIED` → converted to an isError tool result so the model adapts.
- v2 (types reserved now): `AgentCheckpoint` + `onSuspend`/`resume(checkpoint, decisions)` for
  durable runs; pluggable checkpoint stores.

### Wave 2: Memory + Guardrails

**Memory — new package `ai.matey.memory`** (`packages/memory`; depends on types/errors/utils
only via a structural `EmbeddingProvider = { embed() }`):
- `createConversationMemory({ store?, maxMessages?, compressor? })` — session history with
  windowing and optional LLM compression of old turns into a summary message.
- `createSemanticMemory({ embedder /* the Bridge */, store?, recallLimit?, minScore?, extract?,
  inject? })` — recall via existing `bridge.embed()` + `cosineSimilarity`; `VectorStore`
  interface with in-memory brute-force v1, pgvector/qdrant optional-peer subpaths v2.
- Both implement the `AgentMemory` beforeRun/afterRun contract consumed by Agent;
  `composeMemory(...)` chains them. Embedding caching comes free by stacking the existing
  `createEmbeddingCachingMiddleware`.

**Guardrails — extend `ai.matey.middleware`** (new ErrorCode `GUARDRAIL_VIOLATION`):
- `createPIIRedactionMiddleware` — deterministic regex builtins (email/phone/ssn/creditCard/
  ipAddress/iban/apiKey) + custom patterns; actions transform (default) / deny / log; input,
  output, or both directions.
- `createModerationMiddleware` — LLM judge via a designated cheap bridge using the forced-tool-
  call trick (schema-only, no zod); category scores + threshold; failOpen default.
- `createAuditLogMiddleware` — hash-only by default (privacy-safe), drains violations recorded
  in middleware `context.state`, one record per request with usage/duration/error.
- Because `runTools`/Agent call `executeIR` through the middleware stack every iteration, rails
  automatically police each turn — including tool results — with zero extra wiring.

### Wave 3: Modalities, RAG, Evals

- **Speech**: `generateSpeech` (TTS) + `transcribe` (STT) IR surfaces with OpenAI/ElevenLabs/
  Deepgram adapters; realtime voice exploration after.
- **Image generation** (`generateImage`) and **reranking** IR surfaces.
- **RAG**: chunking + retrieval pipeline over Wave-2 vector stores (pgvector/Qdrant/Pinecone/
  Chroma connectors as optional peers).
- **Evals**: datasets + LLM-as-judge + rule-based metrics (relevance/faithfulness/toxicity),
  running on ai.matey's own provider layer — the industry's evals gap (observability ~89% vs
  evals ~52% adoption) is ai.matey's opening.

### Wave 4: Reach & polish

- Additional browser backends beside LiteRT-LM: **web-llm/MLC** (OpenAI-shaped, fastest tok/s)
  and **transformers.js v4** (ONNX/WebGPU; also a path to on-device embeddings).
- **Vue and Svelte hooks** mirroring `ai.matey.react.core`.
- **Devtools/trace inspector** over the existing OpenTelemetry + stats surfaces.
- **Registry pricing auto-sync**: optional fetch of a maintained pricing feed at runtime
  (`registerModels()` already supports live updates).

### Durable strengths to preserve

Zero runtime dependencies; 29 backends with 7 routing strategies, circuit breaker, fallback and
parallel dispatch; 6 HTTP framework adapters with health/metrics/embeddings endpoints; the
format-conversion CLI and OpenAI/Anthropic SDK shims; multi-format frontend adapters (few
competitors can speak Anthropic's or Gemini's wire format into the same core).


## CI/CD & Infrastructure

### GitHub Actions Workflow

**Current Implementation:**
- ✅ Parallel job execution (lint, typecheck, test, build)
- ✅ Matrix testing (Node 24, 25)
- ✅ Integration tests with monorepo builds
- ✅ CodeQL security analysis
- ✅ Dependency review

**Artifact Strategy:**
- **Current approach**: Integration tests build packages directly (no artifacts)
- **Rationale**: Turborepo creates `packages/*/dist/` folders, not root `dist/`
- **Trade-off**: Simpler and more reliable, but builds twice (in test and integration jobs)

**Future Consideration:**
- Option to upload all package dist folders as artifacts for better build/test separation
- Would require managing multiple artifact paths: `packages/ai.matey.core/dist/`, `packages/ai.matey.utils/dist/`, etc.
- Current approach prioritized simplicity and reliability over strict job separation

---

## Maintenance Tasks

### Provider Model List Updates

**Status**: Implementation 80% complete (2025-11-30)

**Context**: All backend providers now have fallback model lists sourced from web research. Providers with APIs are being updated to fetch models dynamically with caching and fallback support.

**✅ Completed Implementations:**

1. **Anthropic** - ✅ UPDATED
   - **Location**: `packages/backend/src/shared.ts` lines 284-373
   - **Type**: Fallback only (no public API)
   - **Models**: 6 models including Claude 4 family
   - **Latest**: claude-opus-4.5-20251124, claude-sonnet-4.5-20250929
   - **Default**: claude-3-5-haiku-20241022 (cheapest)

2. **AI21** - ✅ COMPLETE
   - **Location**: `packages/backend/src/shared.ts` lines 375-409
   - **Type**: Fallback only (no public API)
   - **Models**: 2 models (jamba-1.5-mini, jamba-1.5-large)
   - **Default**: jamba-1.5-mini (cheapest)

3. **Gemini** - ✅ COMPLETE
   - **Location**: `packages/backend/src/providers/gemini.ts` lines 287-394
   - **Type**: API + Fallback + Caching
   - **API**: GET `/v1beta/models`
   - **Fallback**: `packages/backend/src/shared.ts` lines 411-486
   - **Models**: 5 models (Gemini 2.0, 2.5, 3.0)
   - **Default**: gemini-2.0-flash-lite (cheapest)

4. **Mistral** - ✅ COMPLETE
   - **Location**: `packages/backend/src/providers/mistral.ts` lines 287-368
   - **Type**: API + Fallback + Caching
   - **API**: GET `/v1/models`
   - **Fallback**: `packages/backend/src/shared.ts` lines 551-612
   - **Models**: 4 models (Small, Medium, Large, Codestral)
   - **Default**: mistral-small-2501 (cheapest)

5. **OpenAI** - ✅ Already Complete
   - **Location**: `packages/backend/src/providers/openai.ts`
   - **Type**: API + Fallback + Caching
   - **API**: GET `/v1/models`
   - **Default**: gpt-4o-mini (cheapest)

6. **14 OpenAI-Compatible Providers** - ✅ Inherit from OpenAI
   - DeepSeek, Groq, NVIDIA, Anyscale, Azure, Cerebras, Cloudflare, etc.

**⏳ Ready for Implementation:**

1. **Anthropic** (`packages/backend/src/providers/anthropic.ts`) - ⚠️ **HIGH PRIORITY**
   - **Reason**: No public `/models` endpoint available
   - **Priority**: **HIGH** - Hard-coded list is the only source
   - **Location**: Lines 141-212 (`DEFAULT_ANTHROPIC_MODELS`)
   - **Current models**: 5 models (claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022, claude-3-opus-20240229, claude-3-sonnet-20240229, claude-3-haiku-20240307)
   - **Action**: Check [Anthropic's model documentation](https://docs.anthropic.com/claude/docs/models-overview) for new releases

2. **OpenAI** (`packages/backend/src/shared.ts`) - ℹ️ **LOW PRIORITY**
   - **Reason**: Fallback list for when API is unavailable
   - **Priority**: **LOW** - Adapter uses `/v1/models` API as primary source
   - **Location**: Lines 225-330 (`DEFAULT_OPENAI_MODELS`)
   - **Current models**: 4 models (gpt-4-turbo-preview, gpt-4, gpt-3.5-turbo, gpt-3.5-turbo-16k)
   - **Note**: OpenAI adapter fetches models from `/v1/models` endpoint with caching (1 hour TTL). Hard-coded list is only used when API is unreachable.
   - **Action**: Only update when major model families are released or deprecated
   - **Documentation**: [OpenAI's model documentation](https://platform.openai.com/docs/models)

**Update Schedule:**
- 🔄 **Quarterly review** (Jan 1, Apr 1, Jul 1, Oct 1)
- 🚨 **Immediate update** when major model releases are announced

**Update Process:**
1. Check provider documentation for new models
2. Update `DEFAULT_*_MODELS` constants with new model entries
3. Include full capability metadata (maxTokens, contextWindow, streaming, vision, tools, JSON)
4. Run tests: `npm test`
5. Update this roadmap with new model counts
6. Commit with message: `chore: update [provider] model list`

**Providers Ready for listModels() Implementation:**

The following providers have model listing APIs but haven't implemented `listModels()` yet:

1. **Gemini** - `GET https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}` ([docs](https://ai.google.dev/api/models))
2. **Ollama** - `GET http://localhost:11434/api/tags` ([docs](https://docs.ollama.com/api/tags))
3. **Cohere** - List Models endpoint ([docs](https://docs.cohere.com/reference/list-models))
4. **Mistral** - `GET https://api.mistral.ai/v1/models` ([docs](https://docs.mistral.ai/api/endpoint/models))
5. **AWS Bedrock** - `ListFoundationModels` SDK API ([docs](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_ListFoundationModels.html))
6. **Replicate** - `GET https://api.replicate.com/v1/models` ([docs](https://replicate.com/docs/reference/http))
7. **HuggingFace** - `GET https://huggingface.co/api/models` ([docs](https://huggingface.co/docs/hub/en/api))

**Provider Needing Fallback List:**

8. **AI21** - No list models endpoint available
   - **Action**: Create `DEFAULT_AI21_MODELS` constant in `packages/backend/src/providers/ai21.ts`
   - **Known models**: jamba-instruct-preview, jamba-mini, jamba-large, j2-ultra, j2-mid, j2-light
   - **Priority**: MEDIUM - Similar to Anthropic, requires manual maintenance

**Potential Improvements:**
- Implement `listModels()` for providers with APIs (see list above)
- Create `DEFAULT_AI21_MODELS` fallback list
- Create automated checks that compare hard-coded lists against provider documentation
- Add health checks that warn when using deprecated models

---

## Strategic Roadmap Alignment

Our roadmap focuses on:
1. ✅ **Strengthen core competency** (provider abstraction, routing, middleware)
2. ✅ **Achieve excellence in all features** (⭐⭐ across the board)
3. ✅ **Fill competitive gaps** (structured output, circuit breaker, HTTP improvements)
4. ✅ **Add unique value** (semantic caching, guardrails, zero dependencies)
5. ❌ **Avoid scope creep** (won't compete on orchestration/RAG - different domain)

## Success Metrics

**Technical (Validated ✅):**
- Zero runtime dependencies maintained ✅
- <10ms middleware overhead ✅ **Validated:** 1-9ms for 6-layer chain
- 99.9% adapter compatibility ✅
- Full TypeScript type coverage ✅
- <150ms WebSocket latency ✅ **Validated:** 101ms
- 15+ req/s batch throughput ✅ **Validated:** 14.87-21.37 req/s
- 1000x+ cache speedup ✅ **Validated:** 99.97% improvement
- 80%+ cost savings capability ✅ **Validated:** 84% demonstrated

**Quality (Validated ✅):**
- 100% core package pass rate ✅ **Validated:** All 9 core packages
- 100% integration test success ✅ **Validated:** 50+ scenarios
- Zero critical bugs ✅
- 80%+ test coverage ✅
- Comprehensive documentation ✅
- <24h issue response time (target)

**Adoption:**
- Growing GitHub stars
- NPM downloads increasing
- Active community contributions
- Production deployments

---

## Related Documentation

**Core Documentation:**
- [API Reference](./API.md) - Complete API documentation
- [Implementation Guides](./GUIDES.md) - Step-by-step tutorials
- [OpenTelemetry Integration](./opentelemetry.md) - Observability setup

**Production Resources:**
- [Integration Patterns](./PATTERNS.md) - 8 production-ready patterns with code examples
- [Performance Benchmarks](./BENCHMARKS.md) - Validated performance data and targets
- [Testing Guide](./TESTING.md) - Test coverage, strategy, and methodology

**External Resources:**
- [Test Report](https://github.com/johnhenry/ai.matey.examples/blob/main/FINAL-COMPREHENSIVE-TEST-REPORT.md) - Full validation results
- [Examples Repository](https://github.com/johnhenry/ai.matey.examples) - 14 test applications with source code
