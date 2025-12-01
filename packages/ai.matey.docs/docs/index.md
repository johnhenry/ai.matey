# ai.matey Documentation

Welcome to **ai.matey** - the Universal AI Adapter System that lets you write once and run anywhere.

## What is ai.matey?

ai.matey is a comprehensive TypeScript/JavaScript framework that provides a unified interface for interacting with multiple AI providers. Write your code once using any standard format (OpenAI, Anthropic, Google, etc.) and seamlessly switch between 24+ AI providers without changing your application code.

```typescript
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';

// Write code in OpenAI format, execute with Anthropic
const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({ apiKey: 'your-key' })
);

const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

## Key Features

### 🔌 Universal Compatibility
- **24+ AI Providers**: OpenAI, Anthropic, Google Gemini, Cohere, Groq, DeepSeek, Ollama, and more
- **7 Input Formats**: Write in your preferred API format
- **Seamless Switching**: Change providers without changing code

### 🎯 Smart Routing
- **Load Balancing**: Round-robin, weighted, priority-based routing
- **Automatic Failover**: Built-in redundancy and error recovery
- **Cost Optimization**: Route to cheapest provider based on quality requirements
- **Custom Strategies**: Build your own routing logic

### 🔧 Powerful Middleware
- **Logging**: Track all requests and responses
- **Caching**: Reduce costs with intelligent caching
- **Retry Logic**: Automatic retries with exponential backoff
- **Cost Tracking**: Monitor API spending in real-time
- **Transforms**: Modify requests/responses on-the-fly

### 🚀 Production Ready
- **100% Test Coverage**: All core packages fully tested
- **TypeScript First**: Complete type safety
- **Edge Compatible**: Deploy to Cloudflare Workers, Vercel Edge, Deno Deploy
- **Framework Agnostic**: Works with Express, Hono, Next.js, and more

## Quick Start

Get started with ai.matey in under 5 minutes:

1. **[Installation](/getting-started/installation)** - Install packages and set up your environment
2. **[Quick Start](/getting-started/quick-start)** - Your first Bridge in 30 seconds
3. **[Core Concepts](/getting-started/core-concepts)** - Understand the architecture
4. **[Examples](/examples)** - 34 runnable examples from basic to advanced

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Application                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   Frontend Adapter                           │
│        (OpenAI, Anthropic, Google, Ollama, etc.)            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              Intermediate Representation (IR)                │
│               (Universal Format Layer)                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    Middleware Stack                          │
│         (Logging, Caching, Retry, Transform, etc.)          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend Adapter                           │
│      (OpenAI, Anthropic, Gemini, Groq, Ollama, etc.)       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                      AI Provider                             │
└─────────────────────────────────────────────────────────────┘
```

## Use Cases

### Provider Migration
Switch from OpenAI to Anthropic (or any provider) with zero code changes:

```typescript
// Before
const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey })
);

// After - just change the backend
const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({ apiKey })
);
```

### Cost Optimization
Route simple queries to cheaper models, complex ones to powerful models:

```typescript
const router = new Router(new OpenAIFrontendAdapter(), {
  backends: [deepseek, groq, openai, anthropic],
  strategy: 'custom',
  customStrategy: (request) => {
    const complexity = analyzeComplexity(request);
    if (complexity < 25) return 0; // DeepSeek (cheapest)
    if (complexity < 50) return 1; // Groq
    if (complexity < 80) return 2; // OpenAI
    return 3; // Anthropic (most capable)
  }
});
```

### High Availability
Automatic failover when providers go down:

```typescript
const router = new Router(new OpenAIFrontendAdapter(), {
  backends: [primary, secondary, tertiary],
  strategy: 'priority',
  fallbackOnError: true,
  healthCheck: { enabled: true, interval: 60000 }
});
```

## Packages Overview

ai.matey is built as a monorepo with 21 specialized packages:

| Package | Purpose | Status |
|---------|---------|--------|
| **ai.matey.core** | Bridge & Router | ✅ Production |
| **ai.matey.frontend** | 7 input format adapters | ✅ Production |
| **ai.matey.backend** | 24 provider adapters | ✅ Production |
| **ai.matey.middleware** | Logging, caching, retry, etc. | ✅ Production |
| **ai.matey.http** | HTTP server integrations | ✅ Production |
| **ai.matey.wrapper** | Drop-in SDK replacements | ✅ Production |
| **ai.matey.cli** | Command-line interface | ✅ Production |
| **ai.matey.react.hooks** | React hooks | ✅ Production |
| **ai.matey.utils** | Shared utilities | ✅ Production |
| **ai.matey.types** | TypeScript definitions | ✅ Production |

[View all packages →](/packages/overview)

## Community & Support

- **[GitHub](https://github.com/johnhenry/ai.matey)** - Source code, issues, discussions
- **[npm](https://www.npmjs.com/package/ai.matey)** - Package registry
- **[Examples](/examples)** - 34 working examples
- **[API Reference](/api)** - Complete API documentation

## What's Next?

Ready to get started? Here are some recommended paths:

### For Beginners
1. Read the [Core Concepts](/getting-started/core-concepts)
2. Follow the [Quick Start Guide](/getting-started/quick-start)
3. Try the [Hello World Example](https://github.com/johnhenry/ai.matey/tree/main/packages/ai.matey.docs/examples/01-basics/01-hello-world.ts)

### For Production
1. Review [Production Patterns](https://github.com/johnhenry/ai.matey/tree/main/packages/ai.matey.docs/examples/07-advanced-patterns)
2. Explore [Integration Patterns](/patterns)
3. Check [Testing Strategies](/guides/testing)

### For Developers
1. Study the [IR Format](/guides/architecture/ir-format)
2. Browse [Provider Documentation](/packages/overview)
3. Review the [API Reference](/api)

---

**Ready to build?** Start with [Installation →](/getting-started/installation)
