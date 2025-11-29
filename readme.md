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
import { Bridge, createRouter } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';

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
import { createRouter } from 'ai.matey.core';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
import { GeminiBackendAdapter } from 'ai.matey.backend.gemini';

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

Add logging, caching, retry logic, and more:

```typescript
import { createLoggingMiddleware } from 'ai.matey.middleware.logging';
import { createRetryMiddleware } from 'ai.matey.middleware.retry';
import { createCachingMiddleware } from 'ai.matey.middleware.caching';

bridge
  .use(createLoggingMiddleware({ level: 'info' }))
  .use(createRetryMiddleware({ maxAttempts: 3, backoffMultiplier: 2 }))
  .use(createCachingMiddleware({ ttl: 3600 }));
```

### HTTP Server

Serve an OpenAI-compatible API with any backend:

```typescript
import express from 'express';
import { ExpressMiddleware } from 'ai.matey.http.express';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';

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

### React Hooks - Direct Mode

Use backend adapters directly without HTTP (great for Electron, browser extensions, testing):

```tsx
import { useChat } from 'ai.matey.react.core';
import { OpenAIBackend } from 'ai.matey.backend.openai';

const backend = new OpenAIBackend({ apiKey: process.env.REACT_APP_OPENAI_API_KEY });

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
import { OpenAI } from 'ai.matey.wrapper.openai-sdk';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';

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

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](./docs/API.md) | Complete API documentation for all components |
| [IR Format Guide](./docs/IR-FORMAT.md) | Comprehensive Intermediate Representation format specification |
| [Feature Guides](./docs/GUIDES.md) | In-depth guides for parallel dispatch, CLI tools, response conversion |
| [Roadmap](./docs/ROADMAP.md) | Project roadmap and planned features |

## Package Reference

### Core Packages

| Package | Description | Documentation |
|---------|-------------|---------------|
| [`ai.matey`](./packages/ai.matey) | Main umbrella package | [README](./packages/ai.matey/readme.md) |
| [`ai.matey.core`](./packages/ai.matey.core) | Bridge, Router, MiddlewareStack | [README](./packages/ai.matey.core/readme.md) |
| [`ai.matey.types`](./packages/ai.matey.types) | TypeScript type definitions | [README](./packages/ai.matey.types/readme.md) |
| [`ai.matey.errors`](./packages/ai.matey.errors) | Error classes and utilities | [README](./packages/ai.matey.errors/readme.md) |
| [`ai.matey.utils`](./packages/ai.matey.utils) | Shared utility functions | [README](./packages/ai.matey.utils/readme.md) |
| [`ai.matey.testing`](./packages/ai.matey.testing) | Testing utilities and mocks | [README](./packages/ai.matey.testing/readme.md) |
| [`ai.matey.cli`](./packages/cli) | CLI and conversion utilities | [README](./packages/cli/readme.md) |

### Backend Adapters

**Consolidated Package:** [`ai.matey.backend`](./packages/backend)

All server-side provider adapters in one package. Import from main or use subpath imports:

```typescript
import { OpenAIBackendAdapter, AnthropicBackendAdapter } from 'ai.matey.backend';
// or
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
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

**Browser-Compatible Package:** [`ai.matey.backend.browser`](./packages/backend-browser)

Subset of adapters that work in browser environments:
- Chrome AI
- Mock (testing)
- Function (testing)

### Frontend Adapters

**Consolidated Package:** [`ai.matey.frontend`](./packages/frontend)

All frontend request adapters in one package:

```typescript
import { OpenAIFrontendAdapter, AnthropicFrontendAdapter } from 'ai.matey.frontend';
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

**Consolidated Package:** [`ai.matey.http`](./packages/http)

Framework adapters for serving AI endpoints. Core utilities in [`ai.matey.http.core`](./packages/http.core).

**Supported Frameworks:**
- Express.js
- Fastify
- Hono
- Koa
- Node.js http
- Deno

### Middleware

**Consolidated Package:** [`ai.matey.middleware`](./packages/middleware)

All middleware in one package:

```typescript
import {
  createLoggingMiddleware,
  createCachingMiddleware,
  createRetryMiddleware
} from 'ai.matey.middleware';
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
| [`ai.matey.react.core`](./packages/react-core) | Core hooks (useChat, useCompletion) | [README](./packages/react-core/readme.md) |
| [`ai.matey.react.hooks`](./packages/react-hooks) | Additional hooks | [README](./packages/react-hooks/readme.md) |
| [`ai.matey.react.stream`](./packages/react-stream) | Streaming components | [README](./packages/react-stream/readme.md) |
| [`ai.matey.react.nextjs`](./packages/react-nextjs) | Next.js App Router | [README](./packages/react-nextjs/readme.md) |

### SDK Wrappers

**Consolidated Package:** [`ai.matey.wrapper`](./packages/wrapper)

Drop-in replacements for official SDKs:

```typescript
import { OpenAI } from 'ai.matey.wrapper';  // OpenAI SDK-compatible
```

**Included Wrappers:**
- OpenAI SDK
- Anthropic SDK
- Chrome AI API
- IR-native chat client
- Dynamic wrapper (anymethod)

### Native Backends

| Package | Runtime | Documentation |
|---------|---------|---------------|
| [`ai.matey.native.node-llamacpp`](./packages/native-node-llamacpp) | llama.cpp via Node | [README](./packages/native-node-llamacpp/readme.md) |
| [`ai.matey.native.apple`](./packages/native-apple) | Apple MLX (macOS 15+) | [README](./packages/native-apple/readme.md) |
| [`ai.matey.native.model-runner`](./packages/native-model-runner) | Generic model runner | [README](./packages/native-model-runner/readme.md) |

## CLI Tools

```bash
# Install globally
npm install -g ai.matey.cli

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
