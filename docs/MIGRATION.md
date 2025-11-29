# Migration Guide: Monolithic to Monorepo

This guide helps you migrate from the single `ai.matey` package to the new monorepo structure.

## Overview

The ai.matey project has been restructured from a single 50K+ line package into **23 consolidated packages**. This provides:

- **Better tree-shaking**: Only bundle what you use
- **Faster installs**: Install only needed packages
- **Independent versioning**: Packages can be updated independently
- **Clearer dependencies**: Explicit dependency graph
- **Provider consolidation**: All 24 backend providers in one package, all 10 middleware in one package

## Backwards Compatibility

**The main `ai.matey` package continues to work as before.** All exports are re-exported for backwards compatibility:

```typescript
// This still works!
import { Bridge, Router, OpenAIBackendAdapter } from 'ai.matey';
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

**All 24 backend providers are now in ONE consolidated package:**

```typescript
// Import from single consolidated package
import {
  OpenAIBackendAdapter,
  AnthropicBackendAdapter,
  GeminiBackendAdapter,
  OllamaBackendAdapter,
  MistralBackendAdapter,
  GroqBackendAdapter
  // ... all 24 providers available
} from 'ai.matey.backend';

// Or use subpath imports for better tree-shaking
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
```

**All 24 providers:**
OpenAI, Anthropic, Gemini, Mistral, Cohere, Groq, Ollama, Together AI, Fireworks AI, DeepInfra, Cerebras, xAI, AI21 Labs, NVIDIA NIM, Hugging Face, Perplexity, OpenRouter, Replicate, Azure OpenAI, AWS Bedrock, Cloudflare Workers AI, Anyscale, DeepSeek, LM Studio

### Frontend Adapters

**All 7 frontend adapters are now in ONE consolidated package:**

```typescript
// Import from single consolidated package
import {
  OpenAIFrontendAdapter,
  AnthropicFrontendAdapter,
  GeminiFrontendAdapter,
  OllamaFrontendAdapter,
  MistralFrontendAdapter
  // ... all 7 adapters available
} from 'ai.matey.frontend';
```

### Middleware

**All 10 middleware types are now in ONE consolidated package:**

```typescript
// Import from single consolidated package
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
} from 'ai.matey.middleware';
```

### HTTP Server Adapters

**HTTP adapters are in separate packages per framework:**

```typescript
import { ExpressMiddleware } from 'ai.matey.http.express';
import { HonoMiddleware } from 'ai.matey.http.hono';
import { FastifyPlugin } from 'ai.matey.http.fastify';
import { KoaMiddleware } from 'ai.matey.http.koa';
```

### React Hooks

```typescript
// React core hooks
import { useChat, useCompletion, useObject } from 'ai.matey.react.core';

// Extended hooks
import { useAssistant, useTokenCount } from 'ai.matey.react.hooks';

// Streaming components
import { StreamProvider, StreamText } from 'ai.matey.react.stream';

// Next.js integration
import { useChat } from 'ai.matey.react.nextjs';
```

## Complete Package List (23 packages)

### Foundation (5 packages)
- `ai.matey` - Main umbrella package (re-exports everything)
- `ai.matey.types` - TypeScript type definitions
- `ai.matey.errors` - Error classes and codes
- `ai.matey.utils` - Utilities and helpers
- `ai.matey.core` - Bridge, Router, Middleware core

### Providers (3 consolidated packages)
- `ai.matey.backend` - All 24 backend provider adapters
- `ai.matey.backend.browser` - Browser-only backends (Chrome AI, Function, Mock)
- `ai.matey.frontend` - All 7 frontend adapters

### Infrastructure (4 packages)
- `ai.matey.middleware` - All 10 middleware types
- `ai.matey.http` - HTTP server integration
- `ai.matey.http.core` - HTTP core utilities
- `ai.matey.testing` - Testing utilities and fixtures

### HTTP Frameworks (4 packages)
Each HTTP framework has its own package:
- `ai.matey.http.express`
- `ai.matey.http.hono`
- `ai.matey.http.fastify`
- `ai.matey.http.koa`

### React Integration (4 packages)
- `ai.matey.react.core` - Core hooks (useChat, useCompletion)
- `ai.matey.react.hooks` - Extended hooks
- `ai.matey.react.stream` - Streaming components
- `ai.matey.react.nextjs` - Next.js App Router integration

### Native/Advanced (3 packages)
- `ai.matey.native.apple` - Apple MLX integration
- `ai.matey.native.node-llamacpp` - Node Llama.cpp integration
- `ai.matey.native.model-runner` - Local model runner

### Utilities (2 packages)
- `ai.matey.wrapper` - SDK wrappers for popular libraries
- `ai.matey.cli` - Command-line interface

## Key Changes from Old Structure

### ✅ Consolidated (simpler)

**Before:** 29 individual `backend-*` packages
**After:** ONE `ai.matey.backend` package with all 24 providers

**Before:** 10 individual `middleware-*` packages
**After:** ONE `ai.matey.middleware` package with all 10 types

**Before:** 7 individual `frontend-*` packages
**After:** ONE `ai.matey.frontend` package with all 7 adapters

### ✅ Better Names

**Before:** `ai.matey.http-core`
**After:** `ai.matey.http.core` (consistent dot notation)

### ✅ Added

- React integration (4 new packages)
- Native model support (3 new packages)
- Better HTTP framework support

## Troubleshooting

### "Module not found" errors

Make sure you've installed the specific package:

```bash
npm install ai.matey.backend
npm install ai.matey.middleware
npm install ai.matey.react.core
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

Some packages have peer dependencies:
- React packages require `react >= 18.0.0`
- OpenTelemetry middleware requires `@opentelemetry/*` packages
- HTTP packages may require framework-specific dependencies

Install them alongside:

```bash
npm install ai.matey.react.core react
npm install ai.matey.middleware @opentelemetry/api
```

## Questions?

Open an issue at https://github.com/johnhenry/ai.matey/issues
