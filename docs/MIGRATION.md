# Migration Guide: Monolithic to Monorepo

This guide helps you migrate from the single `ai.matey` package to the new monorepo structure.

## Overview

The ai.matey project has been restructured from a single 50K+ line package into 68 independently publishable packages. This provides:

- **Better tree-shaking**: Only bundle what you use
- **Faster installs**: Install only needed packages
- **Independent versioning**: Packages can be updated independently
- **Clearer dependencies**: Explicit dependency graph

## Backwards Compatibility

**The main `ai.matey` package continues to work as before.** All exports are re-exported for backwards compatibility:

```typescript
// This still works!
import { Bridge, Router, OpenAIBackend } from 'ai.matey';
```

## Recommended Migration

For optimal bundle size and faster installs, migrate to direct package imports:

### Core Functionality

```typescript
// Before
import { Bridge, Router, MiddlewareStack } from 'ai.matey';

// After
import { Bridge, Router, MiddlewareStack } from 'ai.matey.core';
```

### Types

```typescript
// Before
import type { IRChatRequest, IRChatResponse } from 'ai.matey';

// After
import type { IRChatRequest, IRChatResponse } from 'ai.matey.types';
```

### Backend Adapters

```typescript
// Before
import { OpenAIBackend } from 'ai.matey/adapters/backend';

// After
import { OpenAIBackend } from 'ai.matey.backend.openai';
import { AnthropicBackend } from 'ai.matey.backend.anthropic';
import { GeminiBackend } from 'ai.matey.backend.gemini';
```

### Frontend Adapters

```typescript
// Before
import { OpenAIFrontend } from 'ai.matey/adapters/frontend';

// After
import { OpenAIFrontend } from 'ai.matey.frontend.openai';
```

### Middleware

```typescript
// Before
import { createCachingMiddleware } from 'ai.matey/middleware';

// After
import { createCachingMiddleware } from 'ai.matey.middleware.caching';
import { createRetryMiddleware } from 'ai.matey.middleware.retry';
import { createLoggingMiddleware } from 'ai.matey.middleware.logging';
```

### HTTP Server Adapters

```typescript
// Before
import { createExpressHandler } from 'ai.matey/http';

// After
import { createExpressHandler } from 'ai.matey.http.express';
import { createHonoHandler } from 'ai.matey.http.hono';
```

### React Hooks (New!)

```typescript
// New packages - not available in monolithic version
import { useChat, useCompletion, useObject } from 'ai.matey.react.core';
import { useAssistant, useTokenCount } from 'ai.matey.react.hooks';
import { StreamProvider, StreamText } from 'ai.matey.react.stream';
import { useChat } from 'ai.matey.react.nextjs';
```

## Package Naming Convention

All packages follow the pattern `ai.matey.{category}.{name}`:

| Category | Example Packages |
|----------|-----------------|
| `backend` | `ai.matey.backend.openai`, `ai.matey.backend.anthropic` |
| `frontend` | `ai.matey.frontend.openai`, `ai.matey.frontend.anthropic` |
| `middleware` | `ai.matey.middleware.caching`, `ai.matey.middleware.retry` |
| `http` | `ai.matey.http.express`, `ai.matey.http.hono` |
| `react` | `ai.matey.react.core`, `ai.matey.react.nextjs` |
| `wrapper` | `ai.matey.wrapper.openai-sdk` |
| `native` | `ai.matey.native.apple`, `ai.matey.native.node-llamacpp` |

## Complete Package List

### Foundation (5 packages)
- `ai.matey.types` - Type definitions
- `ai.matey.errors` - Error classes
- `ai.matey.utils` - Utilities
- `ai.matey.core` - Bridge, Router, Middleware
- `ai.matey.testing` - Test utilities

### Backend Adapters (26 packages)
- `ai.matey.backend.openai`
- `ai.matey.backend.anthropic`
- `ai.matey.backend.gemini`
- `ai.matey.backend.ollama`
- `ai.matey.backend.mistral`
- `ai.matey.backend.groq`
- `ai.matey.backend.together-ai`
- `ai.matey.backend.fireworks`
- `ai.matey.backend.deepinfra`
- `ai.matey.backend.cerebras`
- `ai.matey.backend.xai`
- `ai.matey.backend.cohere`
- `ai.matey.backend.ai21`
- `ai.matey.backend.nvidia`
- `ai.matey.backend.huggingface`
- `ai.matey.backend.perplexity`
- `ai.matey.backend.openrouter`
- `ai.matey.backend.replicate`
- `ai.matey.backend.azure-openai`
- `ai.matey.backend.aws-bedrock`
- `ai.matey.backend.cloudflare`
- `ai.matey.backend.anyscale`
- `ai.matey.backend.deepseek`
- `ai.matey.backend.lmstudio`
- `ai.matey.backend.chrome-ai`
- `ai.matey.backend.mock`

### Frontend Adapters (6 packages)
- `ai.matey.frontend.openai`
- `ai.matey.frontend.anthropic`
- `ai.matey.frontend.gemini`
- `ai.matey.frontend.ollama`
- `ai.matey.frontend.mistral`
- `ai.matey.frontend.chrome-ai`

### HTTP Adapters (7 packages)
- `ai.matey.http.core`
- `ai.matey.http.node`
- `ai.matey.http.express`
- `ai.matey.http.koa`
- `ai.matey.http.hono`
- `ai.matey.http.fastify`
- `ai.matey.http.deno`

### Middleware (10 packages)
- `ai.matey.middleware.caching`
- `ai.matey.middleware.retry`
- `ai.matey.middleware.logging`
- `ai.matey.middleware.telemetry`
- `ai.matey.middleware.security`
- `ai.matey.middleware.validation`
- `ai.matey.middleware.cost-tracking`
- `ai.matey.middleware.conversation-history`
- `ai.matey.middleware.transform`
- `ai.matey.middleware.opentelemetry`

### React (4 packages)
- `ai.matey.react.core`
- `ai.matey.react.hooks`
- `ai.matey.react.stream`
- `ai.matey.react.nextjs`

### Wrappers (5 packages)
- `ai.matey.wrapper.openai-sdk`
- `ai.matey.wrapper.anthropic-sdk`
- `ai.matey.wrapper.chrome-ai`
- `ai.matey.wrapper.chrome-ai-legacy`
- `ai.matey.wrapper.anymethod`

### Native (3 packages)
- `ai.matey.native.apple`
- `ai.matey.native.node-llamacpp`
- `ai.matey.native.model-runner`

### CLI (1 package)
- `ai.matey.cli`

## Troubleshooting

### "Module not found" errors

Make sure you've installed the specific package:

```bash
npm install ai.matey.backend.openai
```

### TypeScript errors

Ensure your `tsconfig.json` has `moduleResolution` set to `bundler` or `node16`:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

### Peer dependency warnings

Some packages have peer dependencies (e.g., React packages require `react >= 18.0.0`). Install them alongside:

```bash
npm install ai.matey.react.core react
```

## Questions?

Open an issue at https://github.com/johnhenry/ai.matey/issues
