# ai.matey

Universal AI Adapter System - Provider-agnostic interface for AI APIs

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

This package is intentionally minimal. Install the specific packages you need:

```bash
# Core functionality
npm install ai.matey.core ai.matey.types

# Backend adapters (pick what you need)
npm install ai.matey.backend.openai
npm install ai.matey.backend.anthropic
npm install ai.matey.backend.gemini

# Frontend adapters
npm install ai.matey.frontend.openai
npm install ai.matey.frontend.anthropic

# HTTP integrations
npm install ai.matey.http.express
npm install ai.matey.http.fastify

# Middleware
npm install ai.matey.middleware.logging
npm install ai.matey.middleware.retry
```

## Usage

Import directly from specific packages:

```typescript
import { Bridge, Router } from 'ai.matey.core';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import type { IRChatRequest, IRChatResponse } from 'ai.matey.types';

// Create a bridge
const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
);

// Make requests
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## Available Packages

### Core
- `ai.matey.core` - Bridge, Router, MiddlewareStack
- `ai.matey.types` - TypeScript type definitions
- `ai.matey.errors` - Error classes
- `ai.matey.utils` - Utility functions

### Backend Adapters
- `ai.matey.backend.openai`
- `ai.matey.backend.anthropic`
- `ai.matey.backend.gemini`
- `ai.matey.backend.groq`
- `ai.matey.backend.mistral`
- `ai.matey.backend.ollama`
- `ai.matey.backend.deepseek`
- ... and more

### Frontend Adapters
- `ai.matey.frontend.openai`
- `ai.matey.frontend.anthropic`
- `ai.matey.frontend.gemini`
- ... and more

### HTTP Integrations
- `ai.matey.http.express`
- `ai.matey.http.fastify`
- `ai.matey.http.hono`
- `ai.matey.http.koa`
- `ai.matey.http.node`

### Middleware
- `ai.matey.middleware.logging`
- `ai.matey.middleware.caching`
- `ai.matey.middleware.retry`
- `ai.matey.middleware.transform`
- `ai.matey.middleware.validation`
- ... and more

### SDK Wrappers
- `ai.matey.wrapper.openai-sdk`
- `ai.matey.wrapper.anthropic-sdk`
- `ai.matey.wrapper.chrome-ai`

See the [main documentation](https://github.com/johnhenry/ai.matey) for the complete list.

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
