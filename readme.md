<p align="center">
  <img src="logo.png" alt="ai.matey logo" width="200" />
</p>

# ai.matey - Universal AI Adapter System

Provider-agnostic interface for AI APIs. Write once, run anywhere.

> **Note:** All packages in this monorepo now publish under the `@johnhenry` npm scope
> (e.g. `ai.matey.core` → `@johnhenry/aimatey-core`), restarting at version `0.0.0`. See each
> package's readme.md for its prior unscoped name and last published version.

## Why ai.matey?

**Same code, any provider.** Switch between OpenAI, Anthropic, Gemini, Ollama, and 26 other providers (30 total) without changing your application code.

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
import { Bridge } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';

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
import { Bridge, createRouter } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { OpenAIBackendAdapter } from '@johnhenry/aimatey-backend/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';

// Create router and register backends
const router = createRouter({
  routingStrategy: 'model-based',
  fallbackStrategy: 'sequential',
})
  .register('openai', new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY }))
  .register('anthropic', new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }))
  .setFallbackChain(['openai', 'anthropic']);

// Use router as a backend in a Bridge
const bridge = new Bridge(new OpenAIFrontendAdapter(), router);

// If OpenAI fails, automatically falls back to Anthropic
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Parallel Dispatch

Query multiple models simultaneously for comparison or consensus:

```typescript
import { createRouter } from '@johnhenry/aimatey-core';
import { OpenAIBackendAdapter } from '@johnhenry/aimatey-backend/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';
import { GeminiBackendAdapter } from '@johnhenry/aimatey-backend/gemini';

// Create router with multiple backends
const router = createRouter()
  .register('openai', new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY }))
  .register('anthropic', new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }))
  .register('gemini', new GeminiBackendAdapter({ apiKey: process.env.GEMINI_API_KEY }));

// Create IR request
const request = {
  messages: [{ role: 'user', content: 'What is 2+2?' }],
  parameters: { model: 'gpt-4' },
  metadata: { requestId: crypto.randomUUID(), timestamp: Date.now(), provenance: {} },
};

// Get responses from ALL backends in parallel
const result = await router.dispatchParallel(request, {
  strategy: 'all',
  backends: ['openai', 'anthropic', 'gemini'],
});

result.allResponses?.forEach(({ backend, response, latencyMs }) => {
  console.log(`${backend}: ${response.message.content} (${latencyMs}ms)`);
});
```

### Middleware

**Consolidated Package:** [`@johnhenry/aimatey-middleware`](./packages/middleware)

All 10 middleware types in one package for cross-cutting concerns:

```typescript
import {
  createLoggingMiddleware,
  createCachingMiddleware,
  createRetryMiddleware,
  createTransformMiddleware,
  createValidationMiddleware,
  createTelemetryMiddleware,
  createOpenTelemetryMiddleware,
  createCostTrackingMiddleware,
  createSecurityMiddleware,
  createConversationHistoryMiddleware
} from '@johnhenry/aimatey-middleware';

bridge
  .use(createLoggingMiddleware({ level: 'info' }))
  .use(createValidationMiddleware({ validateIRFormat: true }))
  .use(createSecurityMiddleware({ redactPII: true, promptInjectionAction: 'warn' }))
  .use(createRetryMiddleware({ maxAttempts: 3, backoffMultiplier: 2 }))
  .use(createCachingMiddleware({ ttl: 3600 }))
  .use(createCostTrackingMiddleware())
  .use(createTelemetryMiddleware())
  .use(createOpenTelemetryMiddleware());
```

**Available Middleware:**
- **Logging** - Request/response logging with configurable levels
- **Caching** - Response caching with TTL and custom key generation
- **Retry** - Automatic retries with exponential backoff
- **Transform** - Request/response transformation pipeline
- **Validation** - Input validation & sanitization
- **Telemetry** - Metrics collection and reporting
- **OpenTelemetry** - Distributed tracing integration (OpenTelemetry standard)
- **Cost Tracking** - Token usage and cost tracking per request
- **Security** - PII redaction, content sanitization, prompt-injection detection, HTTP header policy
- **Conversation History** - Automatic context management and persistence

### HTTP Server

Serve an OpenAI-compatible API with any backend:

```typescript
import express from 'express';
import { ExpressMiddleware } from '@johnhenry/aimatey-http/express';
import { Bridge } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
);

const app = express();
app.use(express.json());
app.use('/v1/chat/completions', ExpressMiddleware(bridge, { streaming: true }));
app.listen(3000);

// Now clients can use OpenAI SDK pointed at localhost:3000
```

### React Hooks

```tsx
import { useChat } from '@johnhenry/aimatey-react-core';

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

### React Hooks - Direct Mode

Use backend adapters directly without HTTP (great for Electron, browser extensions, testing):

```tsx
import { useChat } from '@johnhenry/aimatey-react-core';
import { OpenAIBackendAdapter } from '@johnhenry/aimatey-backend/openai';

const backend = new OpenAIBackendAdapter({ apiKey: process.env.REACT_APP_OPENAI_API_KEY });

function ChatComponent() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    direct: {
      backend,
      systemPrompt: 'You are a helpful assistant.',
    },
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

### SDK Wrapper

Use OpenAI SDK-style code with any backend:

```typescript
import { OpenAI } from '@johnhenry/aimatey-wrapper/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';

// Create a backend adapter
const backend = new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY });

// Wrap it with OpenAI SDK interface
const client = OpenAI(backend);

// Use familiar OpenAI SDK patterns - works with any backend!
const response = await client.chat.completions.create({
  model: 'claude-3-5-sonnet',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

### Embeddings

Generate embeddings through the same provider-agnostic interface:

```typescript
const response = await bridge.embed(['first document', 'second document'], {
  model: 'text-embedding-3-small',
  dimensions: 512, // normalized client-side when the provider lacks native support
});

console.log(response.embeddings[0].vector.length); // 512
```

Supported backends: OpenAI, Mistral, Gemini, Cohere, Ollama, Together, Fireworks, DeepInfra,
NVIDIA, LM Studio. Routers route embedding requests with the same fallback and circuit-breaker
behavior as chat. Caching and cost-tracking middleware: `bridge.useEmbed(createEmbeddingCachingMiddleware())`.

### Agentic Tool Loop

Let the model call your tools until it reaches an answer:

```typescript
const result = await bridge.runTools({
  prompt: 'What is the weather in SF?',
  tools: {
    get_weather: {
      description: 'Get current weather for a city',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
      execute: async ({ city }) => fetchWeather(city),
    },
  },
});

console.log(result.text); // final answer after tool round-trips
```

Tool calls stream too: both OpenAI and Anthropic backends emit `tool_use` chunks with incremental
arguments, and frontend adapters re-emit them in their native streaming formats.

### Production Patterns

The validated pattern library is importable from [`@johnhenry/aimatey-patterns`](./packages/patterns):

```typescript
import { createComplexityRouter, createBatchProcessor } from '@johnhenry/aimatey-patterns';
```

Complexity-based routing, parallel aggregation, failover, cost optimization with budget windows,
and rate-limited batch processing.

### Production HTTP Endpoints

The HTTP handler ships health, metrics, and embeddings endpoints for every framework adapter:

```typescript
const handler = new CoreHTTPHandler({
  bridge,
  health: { enabled: true },      // GET /health, /health/ready, /health/live
  metrics: { enabled: true },     // GET /metrics (Prometheus text format)
  embeddings: { enabled: true },  // POST /v1/embeddings (OpenAI-compatible)
});
```

Real-time streaming over WebSocket (any socket implementation — ws, Deno, Bun):

```typescript
import { createWebSocketHandler } from '@johnhenry/aimatey-http/websocket';
new WebSocketServer({ port: 8080 }).on('connection', createWebSocketHandler(bridge));
```

### Model Registry

Pricing, context windows, and capabilities come from a runtime-extensible registry — register new
models the day they ship instead of waiting for a library release:

```typescript
import { registerModels } from '@johnhenry/aimatey-utils';

registerModels([
  {
    id: 'gpt-6-preview',
    provider: 'openai',
    family: 'gpt-6',
    contextWindow: 800000,
    pricing: { inputPer1M: 4.0, outputPer1M: 20.0 },
  },
]);
```

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](./docs/api.md) | Complete API documentation for all components |
| [IR Format Guide](./docs/IR-FORMAT.md) | Comprehensive Intermediate Representation format specification |
| [Feature Guides](./docs/GUIDES.md) | In-depth guides for parallel dispatch, CLI tools, response conversion |
| [Roadmap](./docs/ROADMAP.md) | Project roadmap and planned features |

## Package Reference

### Core Packages

| Package | Description | Documentation |
|---------|-------------|---------------|
| [`@johnhenry/aimatey`](./packages/ai.matey) | Main umbrella package | [README](./packages/ai.matey/readme.md) |
| [`@johnhenry/aimatey-core`](./packages/ai.matey.core) | Bridge, Router, MiddlewareStack | [README](./packages/ai.matey.core/readme.md) |
| [`@johnhenry/aimatey-types`](./packages/ai.matey.types) | TypeScript type definitions | [README](./packages/ai.matey.types/readme.md) |
| [`@johnhenry/aimatey-errors`](./packages/ai.matey.errors) | Error classes and utilities | [README](./packages/ai.matey.errors/readme.md) |
| [`@johnhenry/aimatey-utils`](./packages/ai.matey.utils) | Shared utility functions | [README](./packages/ai.matey.utils/readme.md) |
| [`@johnhenry/aimatey-testing`](./packages/ai.matey.testing) | Testing utilities and mocks | [README](./packages/ai.matey.testing/readme.md) |
| [`@johnhenry/aimatey-cli`](./packages/cli) | CLI and conversion utilities | [README](./packages/cli/readme.md) |
| [`@johnhenry/aimatey-patterns`](./packages/patterns) | Production integration patterns | [README](./packages/patterns/readme.md) |

### Backend Adapters

**Consolidated Package:** [`@johnhenry/aimatey-backend`](./packages/backend) | [📚 Documentation](./packages/backend/readme.md)

All server-side provider adapters in one package. Import from main or use subpath imports:

```typescript
import { OpenAIBackendAdapter, AnthropicBackendAdapter } from '@johnhenry/aimatey-backend';
// or
import { OpenAIBackendAdapter } from '@johnhenry/aimatey-backend/openai';
```

**Included Providers:**
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Google Gemini
- Mistral AI
- Cohere
- Groq
- Ollama (local)
- AWS Bedrock
- Azure OpenAI
- DeepSeek
- Fireworks
- Together AI
- Perplexity
- OpenRouter
- Anyscale
- DeepInfra
- Cerebras
- AI21 Labs
- xAI (Grok)
- NVIDIA NIM
- LM Studio (local)
- Hugging Face
- Cloudflare Workers AI
- Replicate
- Inception Labs (Mercury)
- Moonshot AI (Kimi)
- SambaNova
- GitHub Models (free via any GitHub account)
- Alibaba Cloud Model Studio / DashScope (Qwen)
- OmniRoute (self-hosted gateway, 290+ providers, no API key required by default)

**Browser-Compatible Package:** [`@johnhenry/aimatey-backend-browser`](./packages/backend-browser)

Subset of adapters that work in browser environments:
- Chrome AI
- LiteRT-LM (on-device Gemma via WebGPU)
- Mock (testing)
- Function (testing)

### Frontend Adapters

**Consolidated Package:** [`@johnhenry/aimatey-frontend`](./packages/frontend) | [📚 Documentation](./packages/frontend/readme.md)

All frontend request adapters in one package:

```typescript
import { OpenAIFrontendAdapter, AnthropicFrontendAdapter } from '@johnhenry/aimatey-frontend';
```

**Included Adapters:**
- OpenAI format
- Anthropic format
- Gemini format
- Mistral format
- Ollama format
- Chrome AI format
- Generic (IR passthrough)

### HTTP Integrations

**Consolidated Package:** [`@johnhenry/aimatey-http`](./packages/http) | [📚 Documentation](./packages/http/readme.md)

Framework adapters for serving AI endpoints. Core utilities in [`@johnhenry/aimatey-http-core`](./packages/http.core).

**Supported Frameworks:**
- Express.js
- Fastify
- Hono
- Koa
- Node.js http
- Deno

### Middleware

**Consolidated Package:** [`@johnhenry/aimatey-middleware`](./packages/middleware) | [📚 Documentation](./packages/middleware/readme.md)

All middleware in one package:

```typescript
import {
  createLoggingMiddleware,
  createCachingMiddleware,
  createRetryMiddleware
} from '@johnhenry/aimatey-middleware';
```

**Included Middleware:**
- Logging - Request/response logging
- Caching - Response caching
- Retry - Automatic retries with backoff
- Transform - Request/response transforms
- Validation - Request validation
- Telemetry - Metrics collection
- OpenTelemetry - Distributed tracing
- Cost Tracking - Usage & cost tracking
- Security - Rate limiting & security
- Conversation History - Context management

### React Integration

| Package | Purpose | Documentation |
|---------|---------|---------------|
| [`@johnhenry/aimatey-react-core`](./packages/react-core) | Core hooks (useChat, useCompletion) | [README](./packages/react-core/readme.md) |
| [`@johnhenry/aimatey-react-hooks`](./packages/react-hooks) | Additional hooks | [README](./packages/react-hooks/readme.md) |
| [`@johnhenry/aimatey-react-stream`](./packages/react-stream) | Streaming components | [README](./packages/react-stream/readme.md) |
| [`@johnhenry/aimatey-react-nextjs`](./packages/react-nextjs) | Next.js App Router | [README](./packages/react-nextjs/readme.md) |

### SDK Wrappers

**Consolidated Package:** [`@johnhenry/aimatey-wrapper`](./packages/wrapper) | [📚 Documentation](./packages/wrapper/readme.md)

Drop-in replacements for official SDKs:

```typescript
import { OpenAI } from '@johnhenry/aimatey-wrapper';  // OpenAI SDK-compatible
```

**Included Wrappers:**
- OpenAI SDK
- Anthropic SDK
- Chrome AI API
- IR-native chat client
- Dynamic wrapper (anymethod)

### Tool Calling (MCP)

**Package:** [`@johnhenry/aimatey-mcp`](./packages/mcp) | [📚 Documentation](./packages/mcp/readme.md)

Translates MCP (Model Context Protocol) tools into the `ToolDefinition` shape consumed by
`@johnhenry/aimatey-core`'s `Bridge.runTools()` agentic loop, via an injectable client - no hard
dependency on any MCP SDK. Works with the official `@modelcontextprotocol/sdk`,
[`mcp-query`](https://github.com/johnhenry/mcp-query), or a test fake.

```typescript
import { runMcpTools } from '@johnhenry/aimatey-mcp';

const result = await runMcpTools(bridge.runTools, {
  client: mcpClient, // any object satisfying McpClientLike
  prompt: 'What files changed in the last commit?',
});
```

### Native Backends

| Package | Runtime | Documentation |
|---------|---------|---------------|
| [`@johnhenry/aimatey-native-node-llamacpp`](./packages/native-node-llamacpp) | llama.cpp via Node | [README](./packages/native-node-llamacpp/readme.md) |
| [`@johnhenry/aimatey-native-apple`](./packages/native-apple) | Apple MLX (macOS 15+) | [README](./packages/native-apple/readme.md) |
| [`@johnhenry/aimatey-native-model-runner`](./packages/native-model-runner) | Generic model runner | [README](./packages/native-model-runner/readme.md) |

## CLI Tools

```bash
# Install globally
npm install -g @johnhenry/aimatey-cli

# Start an OpenAI-compatible proxy with any backend
ai-matey proxy --backend ./my-backend.mjs --port 3000

# Emulate Ollama CLI with any backend
ai-matey emulate-ollama --backend ./backend.mjs run llama3.1 "Hello!"

# Convert requests between formats
ai-matey convert-request --from openai --to anthropic --input request.json

# Convert responses between formats
ai-matey convert-response --format openai --input response.json

# Create a backend adapter template
ai-matey create-backend --provider groq --output ./groq-backend.mjs
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
