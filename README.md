# ai.matey - Universal AI Adapter System

Provider-agnostic interface for AI APIs. Write once, run anywhere.

## Quick Start

```typescript
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';

// Create a bridge: accept OpenAI format, use Anthropic backend
const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
);

// Make requests using OpenAI format
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## Package Reference

### Core Packages

| Package | Description | Documentation |
|---------|-------------|---------------|
| [`ai.matey`](./packages/ai.matey) | Main umbrella package | [README](./packages/ai.matey/README.md) |
| [`ai.matey.core`](./packages/ai.matey.core) | Bridge, Router, MiddlewareStack | [README](./packages/ai.matey.core/README.md) |
| [`ai.matey.types`](./packages/ai.matey.types) | TypeScript type definitions | [README](./packages/ai.matey.types/README.md) |
| [`ai.matey.errors`](./packages/ai.matey.errors) | Error classes and utilities | [README](./packages/ai.matey.errors/README.md) |
| [`ai.matey.utils`](./packages/ai.matey.utils) | Shared utility functions | [README](./packages/ai.matey.utils/README.md) |
| [`ai.matey.testing`](./packages/ai.matey.testing) | Testing utilities and mocks | [README](./packages/ai.matey.testing/README.md) |
| [`ai.matey.cli`](./packages/cli) | CLI and conversion utilities | [README](./packages/cli/README.md) |

### Backend Adapters

Connect to any AI provider with a unified interface.

| Package | Provider | Documentation |
|---------|----------|---------------|
| [`ai.matey.backend.openai`](./packages/backend-openai) | OpenAI (GPT-4, GPT-3.5) | [README](./packages/backend-openai/README.md) |
| [`ai.matey.backend.anthropic`](./packages/backend-anthropic) | Anthropic (Claude) | [README](./packages/backend-anthropic/README.md) |
| [`ai.matey.backend.gemini`](./packages/backend-gemini) | Google Gemini | [README](./packages/backend-gemini/README.md) |
| [`ai.matey.backend.groq`](./packages/backend-groq) | Groq (fast inference) | [README](./packages/backend-groq/README.md) |
| [`ai.matey.backend.mistral`](./packages/backend-mistral) | Mistral AI | [README](./packages/backend-mistral/README.md) |
| [`ai.matey.backend.ollama`](./packages/backend-ollama) | Ollama (local) | [README](./packages/backend-ollama/README.md) |
| [`ai.matey.backend.deepseek`](./packages/backend-deepseek) | DeepSeek | [README](./packages/backend-deepseek/README.md) |
| [`ai.matey.backend.cohere`](./packages/backend-cohere) | Cohere | [README](./packages/backend-cohere/README.md) |
| [`ai.matey.backend.huggingface`](./packages/backend-huggingface) | Hugging Face | [README](./packages/backend-huggingface/README.md) |
| [`ai.matey.backend.nvidia`](./packages/backend-nvidia) | NVIDIA NIM | [README](./packages/backend-nvidia/README.md) |
| [`ai.matey.backend.lmstudio`](./packages/backend-lmstudio) | LM Studio (local) | [README](./packages/backend-lmstudio/README.md) |
| [`ai.matey.backend.azure-openai`](./packages/backend-azure-openai) | Azure OpenAI | [README](./packages/backend-azure-openai/README.md) |
| [`ai.matey.backend.aws-bedrock`](./packages/backend-aws-bedrock) | AWS Bedrock | [README](./packages/backend-aws-bedrock/README.md) |
| [`ai.matey.backend.cloudflare`](./packages/backend-cloudflare) | Cloudflare Workers AI | [README](./packages/backend-cloudflare/README.md) |
| [`ai.matey.backend.together-ai`](./packages/backend-together-ai) | Together AI | [README](./packages/backend-together-ai/README.md) |
| [`ai.matey.backend.fireworks`](./packages/backend-fireworks) | Fireworks AI | [README](./packages/backend-fireworks/README.md) |
| [`ai.matey.backend.replicate`](./packages/backend-replicate) | Replicate | [README](./packages/backend-replicate/README.md) |
| [`ai.matey.backend.perplexity`](./packages/backend-perplexity) | Perplexity | [README](./packages/backend-perplexity/README.md) |
| [`ai.matey.backend.openrouter`](./packages/backend-openrouter) | OpenRouter | [README](./packages/backend-openrouter/README.md) |
| [`ai.matey.backend.anyscale`](./packages/backend-anyscale) | Anyscale | [README](./packages/backend-anyscale/README.md) |
| [`ai.matey.backend.deepinfra`](./packages/backend-deepinfra) | DeepInfra | [README](./packages/backend-deepinfra/README.md) |
| [`ai.matey.backend.cerebras`](./packages/backend-cerebras) | Cerebras | [README](./packages/backend-cerebras/README.md) |
| [`ai.matey.backend.ai21`](./packages/backend-ai21) | AI21 Labs | [README](./packages/backend-ai21/README.md) |
| [`ai.matey.backend.xai`](./packages/backend-xai) | xAI (Grok) | [README](./packages/backend-xai/README.md) |
| [`ai.matey.backend.chrome-ai`](./packages/backend-chrome-ai) | Chrome AI | [README](./packages/backend-chrome-ai/README.md) |
| [`ai.matey.backend.mock`](./packages/backend-mock) | Mock (testing) | [README](./packages/backend-mock/README.md) |

### Frontend Adapters

Accept requests in any format and translate to internal IR.

| Package | Format | Documentation |
|---------|--------|---------------|
| [`ai.matey.frontend.openai`](./packages/frontend-openai) | OpenAI format | [README](./packages/frontend-openai/README.md) |
| [`ai.matey.frontend.anthropic`](./packages/frontend-anthropic) | Anthropic format | [README](./packages/frontend-anthropic/README.md) |
| [`ai.matey.frontend.gemini`](./packages/frontend-gemini) | Gemini format | [README](./packages/frontend-gemini/README.md) |
| [`ai.matey.frontend.ollama`](./packages/frontend-ollama) | Ollama format | [README](./packages/frontend-ollama/README.md) |
| [`ai.matey.frontend.mistral`](./packages/frontend-mistral) | Mistral format | [README](./packages/frontend-mistral/README.md) |
| [`ai.matey.frontend.chrome-ai`](./packages/frontend-chrome-ai) | Chrome AI format | [README](./packages/frontend-chrome-ai/README.md) |

### HTTP Integrations

Serve AI endpoints with your favorite framework.

| Package | Framework | Documentation |
|---------|-----------|---------------|
| [`ai.matey.http.express`](./packages/http-express) | Express.js | [README](./packages/http-express/README.md) |
| [`ai.matey.http.fastify`](./packages/http-fastify) | Fastify | [README](./packages/http-fastify/README.md) |
| [`ai.matey.http.hono`](./packages/http-hono) | Hono | [README](./packages/http-hono/README.md) |
| [`ai.matey.http.koa`](./packages/http-koa) | Koa | [README](./packages/http-koa/README.md) |
| [`ai.matey.http.node`](./packages/http-node) | Node.js http | [README](./packages/http-node/README.md) |
| [`ai.matey.http.deno`](./packages/http-deno) | Deno | [README](./packages/http-deno/README.md) |
| [`ai.matey.http.core`](./packages/http-core) | Core utilities | [README](./packages/http-core/README.md) |

### Middleware

Add cross-cutting concerns to your AI pipeline.

| Package | Purpose | Documentation |
|---------|---------|---------------|
| [`ai.matey.middleware.logging`](./packages/middleware-logging) | Request/response logging | [README](./packages/middleware-logging/README.md) |
| [`ai.matey.middleware.caching`](./packages/middleware-caching) | Response caching | [README](./packages/middleware-caching/README.md) |
| [`ai.matey.middleware.retry`](./packages/middleware-retry) | Automatic retries | [README](./packages/middleware-retry/README.md) |
| [`ai.matey.middleware.transform`](./packages/middleware-transform) | Request/response transforms | [README](./packages/middleware-transform/README.md) |
| [`ai.matey.middleware.validation`](./packages/middleware-validation) | Request validation | [README](./packages/middleware-validation/README.md) |
| [`ai.matey.middleware.telemetry`](./packages/middleware-telemetry) | Metrics collection | [README](./packages/middleware-telemetry/README.md) |
| [`ai.matey.middleware.opentelemetry`](./packages/middleware-opentelemetry) | OpenTelemetry tracing | [README](./packages/middleware-opentelemetry/README.md) |
| [`ai.matey.middleware.cost-tracking`](./packages/middleware-cost-tracking) | Usage & cost tracking | [README](./packages/middleware-cost-tracking/README.md) |
| [`ai.matey.middleware.security`](./packages/middleware-security) | Rate limiting & security | [README](./packages/middleware-security/README.md) |
| [`ai.matey.middleware.conversation-history`](./packages/middleware-conversation-history) | Context management | [README](./packages/middleware-conversation-history/README.md) |

### React Integration

Build AI-powered React applications.

| Package | Purpose | Documentation |
|---------|---------|---------------|
| [`ai.matey.react.core`](./packages/react-core) | Core hooks (useChat, useCompletion) | [README](./packages/react-core/README.md) |
| [`ai.matey.react.hooks`](./packages/react-hooks) | Additional hooks | [README](./packages/react-hooks/README.md) |
| [`ai.matey.react.stream`](./packages/react-stream) | Streaming components | [README](./packages/react-stream/README.md) |
| [`ai.matey.react.nextjs`](./packages/react-nextjs) | Next.js App Router | [README](./packages/react-nextjs/README.md) |

### SDK Wrappers

Drop-in replacements for official SDKs.

| Package | SDK | Documentation |
|---------|-----|---------------|
| [`ai.matey.wrapper.openai-sdk`](./packages/wrapper-openai-sdk) | OpenAI SDK | [README](./packages/wrapper-openai-sdk/README.md) |
| [`ai.matey.wrapper.anthropic-sdk`](./packages/wrapper-anthropic-sdk) | Anthropic SDK | [README](./packages/wrapper-anthropic-sdk/README.md) |
| [`ai.matey.wrapper.chrome-ai`](./packages/wrapper-chrome-ai) | Chrome AI API | [README](./packages/wrapper-chrome-ai/README.md) |
| [`ai.matey.wrapper.chrome-ai-legacy`](./packages/wrapper-chrome-ai-legacy) | Chrome AI (legacy) | [README](./packages/wrapper-chrome-ai-legacy/README.md) |
| [`ai.matey.wrapper.anymethod`](./packages/wrapper-anymethod) | Dynamic wrapper | [README](./packages/wrapper-anymethod/README.md) |

### Native Backends

Run models locally.

| Package | Runtime | Documentation |
|---------|---------|---------------|
| [`ai.matey.native.node-llamacpp`](./packages/native-node-llamacpp) | llama.cpp via Node | [README](./packages/native-node-llamacpp/README.md) |
| [`ai.matey.native.apple`](./packages/native-apple) | Apple MLX (macOS 15+) | [README](./packages/native-apple/README.md) |
| [`ai.matey.native.model-runner`](./packages/native-model-runner) | Generic model runner | [README](./packages/native-model-runner/README.md) |

## Examples

See the [examples directory](./examples) for comprehensive usage examples:

- [Basic Bridge](./examples/basic) - Simple request/response
- [HTTP Server](./examples/http) - Express, Fastify, etc.
- [Middleware](./examples/middleware) - Logging, caching, retry
- [Routing](./examples/routing) - Multi-backend routing
- [Monorepo Examples](./examples/monorepo) - Cross-package usage

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Run demos
node demo/demo.mjs
npx tsx demo/router-demo.ts
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                              │
│  (OpenAI format, Anthropic format, Gemini format, etc.)     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Adapter                         │
│  Translates client format → Internal IR                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Bridge / Router                        │
│  Middleware stack, routing, fallback                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Adapter                          │
│  Translates Internal IR → Provider API                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      AI Provider                            │
│  (OpenAI, Anthropic, Gemini, Ollama, etc.)                  │
└─────────────────────────────────────────────────────────────┘
```

## License

MIT
