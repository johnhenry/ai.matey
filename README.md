# ai.matey - Universal AI Adapter System

Provider-agnostic interface for AI APIs. Write once, run anywhere.

## Monorepo Structure

This monorepo contains 68 packages organized into categories:

### Core Packages
| Package | Description |
|---------|-------------|
| `ai.matey` | Main umbrella package with all re-exports |
| `ai.matey.types` | TypeScript type definitions |
| `ai.matey.errors` | Error classes and utilities |
| `ai.matey.utils` | Shared utilities |
| `ai.matey.core` | Bridge, Router, and Middleware core |
| `ai.matey.testing` | Test utilities and mocks |

### Backend Adapters (26 packages)
Adapters for AI providers: OpenAI, Anthropic, Gemini, Ollama, Mistral, Groq, Together AI, Fireworks, DeepInfra, Cerebras, xAI, Cohere, AI21, NVIDIA, Hugging Face, Perplexity, OpenRouter, Replicate, Azure OpenAI, AWS Bedrock, Cloudflare, Anyscale, DeepSeek, LM Studio, Chrome AI, Mock.

```bash
npm install ai.matey.backend.openai
npm install ai.matey.backend.anthropic
# etc.
```

### Frontend Adapters (6 packages)
Format responses for different SDK formats: OpenAI, Anthropic, Gemini, Ollama, Mistral, Chrome AI.

### HTTP Server Adapters (7 packages)
Framework integrations: Node.js, Express, Koa, Hono, Fastify, Deno + core utilities.

### Middleware (10 packages)
Request/response middleware: caching, retry, logging, telemetry, security, validation, cost tracking, conversation history, transform, OpenTelemetry.

### React Integration (4 packages)
| Package | Description |
|---------|-------------|
| `ai.matey.react.core` | Core hooks: `useChat`, `useCompletion`, `useObject` |
| `ai.matey.react.hooks` | Additional hooks: `useAssistant`, `useStream`, `useTokenCount` |
| `ai.matey.react.stream` | Streaming context, `StreamText`, `TypeWriter` |
| `ai.matey.react.nextjs` | Next.js App Router integration |

### SDK Wrappers (5 packages)
Drop-in SDK replacements: OpenAI SDK, Anthropic SDK, Chrome AI, Anymethod.

### Native Backends (3 packages)
Local model runners: Apple MLX, Node Llama.cpp, Model Runner.

### CLI Tools
```bash
npx ai-matey --help
```

## Quick Start

### Basic Usage
```typescript
import { Bridge } from 'ai.matey';
import { OpenAIBackend } from 'ai.matey.backend.openai';

const bridge = new Bridge({
  backend: new OpenAIBackend({ apiKey: process.env.OPENAI_API_KEY })
});

const response = await bridge.chat({
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### With React
```tsx
import { useChat } from 'ai.matey.react.core';

function ChatComponent() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat'
  });

  return (
    <form onSubmit={handleSubmit}>
      {messages.map(m => <div key={m.id}>{m.content}</div>)}
      <input value={input} onChange={handleInputChange} />
    </form>
  );
}
```

### With Routing
```typescript
import { Router } from 'ai.matey';
import { OpenAIBackend } from 'ai.matey.backend.openai';
import { AnthropicBackend } from 'ai.matey.backend.anthropic';

const router = new Router({
  backends: [
    new OpenAIBackend({ apiKey: '...' }),
    new AnthropicBackend({ apiKey: '...' })
  ],
  strategy: 'cost-optimized'
});
```

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## Migration from Single Package

If migrating from the monolithic `ai.matey` package:

1. The main `ai.matey` package re-exports everything for backwards compatibility
2. For tree-shaking, import from specific packages:
   ```typescript
   // Before
   import { Bridge, OpenAIBackend } from 'ai.matey';

   // After (recommended)
   import { Bridge } from 'ai.matey.core';
   import { OpenAIBackend } from 'ai.matey.backend.openai';
   ```

## License

MIT
