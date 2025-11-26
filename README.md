<p align="center">
  <img src="logo.png" alt="ai.matey logo" width="200" />
</p>

# ai.matey - Universal AI Adapter System

Provider-agnostic interface for AI APIs. Write once, run anywhere.

## Why ai.matey?

**Same code, any provider.** Switch between OpenAI, Anthropic, Gemini, Ollama, and 20+ other providers without changing your application code.

```typescript
// Your code stays the same...
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});

// ...only the backend changes
new OpenAIBackendAdapter({ apiKey: '...' })      // → OpenAI
new AnthropicBackendAdapter({ apiKey: '...' })   // → Anthropic
new GeminiBackendAdapter({ apiKey: '...' })      // → Google Gemini
new OllamaBackendAdapter({ baseURL: '...' })     // → Local Ollama
new GroqBackendAdapter({ apiKey: '...' })        // → Groq (fast inference)
```

## Quick Start

### Basic Bridge

Accept requests in one format, execute on any provider:

```typescript
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';

// Accept OpenAI format → Execute on Anthropic
const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
);

const response = await bridge.chat({
  model: 'gpt-4',  // Mapped to claude-3-5-sonnet automatically
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Streaming

```typescript
const stream = await bridge.chatStream({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### Router with Fallback

Route requests to multiple backends with automatic fallback:

```typescript
import { Router, createRouter } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';

const router = createRouter(new OpenAIFrontendAdapter(), {
  backends: [
    new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY }),
    new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }),
  ],
  strategy: 'priority',      // Try backends in order
  fallbackStrategy: 'next',  // On failure, try next backend
});

// If OpenAI fails, automatically falls back to Anthropic
const response = await router.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Parallel Dispatch

Query multiple models simultaneously for comparison or consensus:

```typescript
const result = await router.dispatchParallel(request, {
  strategy: 'all',
  backends: ['openai', 'anthropic', 'gemini'],
});

// Get responses from ALL backends
result.allResponses.forEach(({ backend, response, latencyMs }) => {
  console.log(`${backend}: ${response.message.content} (${latencyMs}ms)`);
});
```

### Middleware

Add logging, caching, retry logic, and more:

```typescript
import { createLoggingMiddleware } from 'ai.matey.middleware.logging';
import { createRetryMiddleware } from 'ai.matey.middleware.retry';
import { createCachingMiddleware } from 'ai.matey.middleware.caching';

bridge
  .use(createLoggingMiddleware({ level: 'info' }))
  .use(createRetryMiddleware({ maxRetries: 3, backoff: 'exponential' }))
  .use(createCachingMiddleware({ ttl: 3600 }));
```

### HTTP Server

Serve an OpenAI-compatible API with any backend:

```typescript
import express from 'express';
import { createExpressMiddleware } from 'ai.matey.http.express';

const app = express();
app.use('/v1', createExpressMiddleware({ bridge }));
app.listen(3000);

// Now clients can use OpenAI SDK pointed at localhost:3000
```

### React Hooks

```tsx
import { useChat } from 'ai.matey.react.core';

function ChatComponent() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
  });

  return (
    <form onSubmit={handleSubmit}>
      {messages.map((m) => (
        <div key={m.id}>{m.content}</div>
      ))}
      <input value={input} onChange={handleInputChange} />
    </form>
  );
}
```

### SDK Drop-in Replacement

Use ai.matey as a drop-in replacement for official SDKs:

```typescript
// Instead of: import OpenAI from 'openai';
import { OpenAI } from 'ai.matey.wrapper.openai-sdk';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Add ai.matey features transparently
});

// Existing OpenAI SDK code works unchanged
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](./docs/api.md) | Complete API documentation for all components |
| [Feature Guides](./docs/GUIDES.md) | In-depth guides for parallel dispatch, CLI tools, response conversion |
| [Roadmap](./docs/ROADMAP.md) | Project roadmap and planned features |

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

## CLI Tools

```bash
# Install globally
npm install -g ai.matey.cli

# Start an OpenAI-compatible proxy with any backend
ai-matey proxy --backend ./my-backend.mjs --port 3000

# Emulate Ollama CLI with any backend
ai-matey emulate-ollama --backend ./backend.mjs run llama3.1 "Hello!"

# Convert between formats
ai-matey convert --from openai --to anthropic request.json
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

## Examples

See the [examples directory](./examples) and [demo directory](./demo) for comprehensive usage:

```bash
# Run the main demo
node demo/demo.mjs

# Run the router demo
npx tsx demo/router-demo.ts
```

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Run linter
npm run lint
```

## License

MIT
