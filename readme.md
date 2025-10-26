# ai.matey - Universal AI Adapter System

<img src="https://raw.githubusercontent.com/johnhenry/ai.matey/main/logo.png" alt="AI.Matey Logo" style="width:256px; height:256px">

> Provider-agnostic interface for AI APIs. Write once, run with any provider.

[![NPM Version](https://img.shields.io/npm/v/ai.matey.svg)](https://www.npmjs.com/package/ai.matey)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

The **ai.matey** Universal AI Adapter System provides a unified interface for interacting with multiple AI providers (OpenAI, Anthropic, Google, DeepSeek, Groq, and more) through a common Intermediate Representation (IR).

**Key Features:**
- 🔄 **Provider Agnostic**: Write code once, switch providers without changes
- 🎯 **Type Safe**: Full TypeScript support with strict typing
- 🚀 **Zero Dependencies**: Core library has no runtime dependencies
- 🔌 **Extensible**: Easy to add new providers through adapter pattern
- 📊 **Observable**: Built-in events, middleware, and statistics
- 🌊 **Stream First**: Native streaming support across all providers
- 💰 **Cost Tracking**: Monitor API costs across all providers
- 🛡️ **Security**: Built-in PII detection, prompt injection prevention, input validation
- 🔧 **Production Ready**: Middleware for logging, caching, retry, telemetry, and more

## Pirate Overview

Ahoy, me hearty! **ai.matey** be a Universal AI Adapter System fer scallywags wantin' ter talk to any AI provider without rewritin' their code. Ye write once, an' sail across the seven seas of AI providers (OpenAI, Anthropic, Google, DeepSeek, Groq, an' more) through a common Intermediate Representation (IR).

**What treasures await ye:**
- 🔄 **Provider Agnostic**: Chart yer course once, switch providers without changin' yer map
- 🎯 **Type Safe**: Full TypeScript support, strict as a ship's log
- 🚀 **Zero Dependencies**: Light as a feather, no barnacles weighin' ye down
- 🔌 **Extensible**: Add new providers easier than recruitin' a new crew member
- 📊 **Observable**: Built-in events, middleware, an' statistics to watch yer voyage
- 🌊 **Stream First**: Native streamin' support across all waters
- 💰 **Cost Tracking**: Count yer doubloons an' monitor API costs across all providers
- 🛡️ **Security**: Built-in defenses against PII leaks, prompt injection attacks, an' invalid cargo
- 🔧 **Production Ready**: Battle-tested middleware fer loggin', cachin', retry, telemetry, an' more

## Compatibility Matrix

| Feature | Browser | Node.js | Import Path |
|---------|---------|---------|-------------|
| HTTP Backends | ✅ | ✅ | `ai.matey/adapters/backend` |
| Model Runners | ❌ | ✅ | `ai.matey/adapters/backend-native/model-runners` |
| Frontend Adapters | ✅ | ✅ | `ai.matey/adapters/frontend` |
| Bridge & Router | ✅ | ✅ | `ai.matey` |
| Middleware | ✅ | ✅ | `ai.matey/middleware` |
| Types | ✅ | ✅ | `ai.matey/types` |

## Project Evolution

**ai.matey** has evolved significantly from its original purpose:

### Original Scope (v0.0.x)
The project began as a **polyfill and documentation tool** for Chrome's experimental `window.ai` API:
- Provided mock implementations of the unstable Chrome AI API
- Created API-compatible clients that mirrored `window.ai` structure
- Focused on browser compatibility and CORS workarounds
- Simple polyfill: `if (!window.ai) window.ai = ai`

### Current Scope (v0.1.0+)
ai.matey has grown into a **full-fledged universal AI framework** with enterprise features:
- Universal Intermediate Representation (IR) for provider independence
- Production-ready middleware (logging, caching, security, cost tracking)
- Intelligent routing with fallback chains and circuit breakers
- HTTP server integration for all major frameworks
- CLI tools for model management and format conversion
- Comprehensive testing and debugging infrastructure

The Chrome AI compatibility is now one of many supported formats, and the focus has shifted from polyfilling an unstable browser API to providing a robust, provider-agnostic abstraction layer for production AI applications.

## Installation

### NPM

```bash
npm install ai.matey
```

### CDN

For browser usage without a build step, you can use CDN imports:

#### ESM (Modern Browsers)

```html
<!-- Latest version -->
<script type="module">
  import { Bridge, OpenAIBackendAdapter } from 'https://cdn.jsdelivr.net/npm/ai.matey/+esm';

  const backend = new OpenAIBackendAdapter({ apiKey: 'your-key' });
  // ...
</script>

<!-- Specific version (recommended) -->
<script type="module">
  import { Bridge, OpenAIBackendAdapter } from 'https://cdn.jsdelivr.net/npm/ai.matey@0.1.0/+esm';
</script>

<!-- Alternative CDNs -->
<script type="module">
  // unpkg
  import { Bridge } from 'https://unpkg.com/ai.matey@0.1.0/dist/esm/index.js';

  // esm.sh
  import { Bridge } from 'https://esm.sh/ai.matey@0.1.0';
</script>
```

#### UMD (Legacy Browsers)

```html
<!-- Load from CDN -->
<script src="https://cdn.jsdelivr.net/npm/ai.matey@0.1.0/dist/umd/ai-matey.min.js"></script>
<script>
  // Available as global AIMatey
  const { Bridge, OpenAIBackendAdapter } = AIMatey;

  const backend = new OpenAIBackendAdapter({ apiKey: 'your-key' });
  // ...
</script>
```

#### Import Maps (Recommended for Multiple Imports)

```html
<script type="importmap">
{
  "imports": {
    "ai.matey": "https://cdn.jsdelivr.net/npm/ai.matey@0.1.0/+esm",
    "ai.matey/": "https://cdn.jsdelivr.net/npm/ai.matey@0.1.0/"
  }
}
</script>

<script type="module">
  import { Bridge } from 'ai.matey';
  import { OpenAIBackendAdapter } from 'ai.matey/adapters/backend';

  // Your code here
</script>
```

**Security Note:** Always specify a version (e.g., `@0.1.0`) in production to avoid breaking changes from automatic updates. Never expose API keys in client-side code - use proxy servers for production applications.

## Quick Start

### Basic Usage

```typescript
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

// Create a bridge: OpenAI format → Anthropic backend
const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
);

// Use OpenAI format, execute on Anthropic
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response.choices[0].message.content);
```

### With Middleware

```typescript
import {
  Bridge,
  OpenAIFrontendAdapter,
  createLoggingMiddleware,
  createCostTrackingMiddleware,
  createValidationMiddleware,
  AnthropicBackendAdapter,
} from 'ai.matey';

const frontend = new OpenAIFrontendAdapter();
const backend = new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY });

const bridge = new Bridge(frontend, backend)
  .use(createLoggingMiddleware({ level: 'info' }))
  .use(createCostTrackingMiddleware({ logCosts: true }))
  .use(createValidationMiddleware({ detectPII: true, piiAction: 'redact' }));

const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is 2+2?' }],
  temperature: 0.7,
});
```

### Router with Multiple Providers

```typescript
import {
  Router,
  Bridge,
  OpenAIFrontendAdapter,
  OpenAIBackendAdapter,
  AnthropicBackendAdapter,
  GroqBackendAdapter,
  RoutingStrategy
} from 'ai.matey';

const router = new Router({
  routingStrategy: RoutingStrategy.COST_OPTIMIZED,
  fallbackStrategy: 'sequential',
})
  .register('openai', new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY }))
  .register('anthropic', new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }))
  .register('groq', new GroqBackendAdapter({ apiKey: process.env.GROQ_API_KEY }))
  .setFallbackChain(['openai', 'anthropic', 'groq']);

const frontend = new OpenAIFrontendAdapter();
const bridge = new Bridge(frontend, router);
```

## Supported Providers

### All Providers

| Provider | Frontend | Backend | Wrapper | Streaming | Multi-Modal | Tools | Cost |
|----------|----------|---------|---------|-----------|-------------|-------|------|
| **OpenAI** | ✅ | ✅ | ✅ SDK | ✅ | ✅ | ✅ | $$ |
| **Anthropic** | ✅ | ✅ | ✅ SDK | ✅ | ✅ | ✅ | $$ |
| **Google Gemini** | ✅ | ✅ | — | ✅ | ✅ | ✅ | $ |
| **Mistral AI** | ✅ | ✅ | — | ✅ | ❌ | ✅ | $$ |
| **DeepSeek** | — | ✅ | — | ✅ | ❌ | ✅ | ¢ |
| **Groq** | — | ✅ | — | ✅ | ❌ | ✅ | ¢ |
| **Ollama** | ✅ | ✅ | — | ✅ | ❌ | ❌ | Free |
| **LM Studio** | — | ✅ | — | ✅ | ❌ | ✅ | Free |
| **Hugging Face** | — | ✅ | — | ✅ | ❌ | ❌ | Free* |
| **NVIDIA NIM** | — | ✅ | — | ✅ | ❌ | ✅ | $$ |
| **Chrome AI** | ✅ | ✅ | — | ✅ | ❌ | ❌ | Free |
| **Chrome AI (Current)** | — | — | ✅ | ✅ | ❌ | ❌ | Free |
| **Chrome AI (Legacy)** | — | — | ✅ | ✅ | ❌ | ❌ | Free |
| **Node Llama.cpp** | — | ✅ | — | ✅ | ❌ | ❌ | Free |
| **Apple Foundation Models** | — | ✅ | — | ✅ | ✅ | ✅ | Free |
| **Mock** | — | ✅ | — | ✅ | ✅ | ✅ | Free |
| **Together AI** | — | ✅ | — | ✅ | ✅ | ✅ | ¢ |
| **Fireworks AI** | — | ✅ | — | ✅ | ✅ | ✅ | ¢ |
| **DeepInfra** | — | ✅ | — | ✅ | ❌ | ✅ | ¢ |
| **xAI (Grok)** | — | ✅ | — | ✅ | ❌ | ✅ | $$$ |
| **Cerebras** | — | ✅ | — | ✅ | ❌ | ✅ | $ |
| **Azure OpenAI** | — | ✅ | — | ✅ | ✅ | ✅ | $$$ |
| **Cloudflare Workers AI** | — | ✅ | — | ✅ | ✅ | ✅ | ¢ |
| **Perplexity AI** | — | ✅ | — | ✅ | ❌ | ✅ | $$ |
| **OpenRouter** | — | ✅ | — | ✅ | ✅ | ✅ | varies |
| **AI21 Labs** | — | ✅ | — | ✅ | ❌ | ❌ | $$ |
| **Cohere** | — | ✅ | — | ✅ | ❌ | ✅ | $$ |
| **AWS Bedrock** | — | ✅ | — | ✅ | ✅ | ✅ | $$$ |
| **Anyscale** | — | ✅ | — | ✅ | ❌ | ❌ | $ |
| **Replicate** | — | ✅ | — | ✅ | ❌ | ❌ | varies |

*Free tier available with rate limits

**Wrapper Types:**
- **SDK** - Drop-in replacement for official SDK (OpenAI, Anthropic)
- **Chrome AI wrappers** - API compatibility layers for current and legacy Chrome AI APIs

### Provider Highlights

**Currently Available:**
- **DeepSeek**: Ultra-low cost ($0.14/$0.28 per 1M tokens), strong reasoning
- **Groq**: Ultra-fast inference (<100ms), very low cost ($0.05/$0.10 per 1M tokens)
- **LM Studio**: Run models locally, zero cost, complete privacy
- **Hugging Face**: Access thousands of models, free tier available
- **NVIDIA NIM**: Optimized inference, self-hosted or cloud
- **Together AI**: 200+ open-source models, starting at $0.06 per 1M tokens, OpenAI-compatible
- **Fireworks AI**: 100+ models, fastest APIs, topK support, batch inference discount
- **DeepInfra**: Cost estimation in responses, all models via one API, $0.40+ per 1M tokens
- **xAI (Grok)**: Real-time web & X search, 2M context window, reasoning models
- **Cerebras**: World's fastest inference (969 tokens/s), specialized AI hardware, seed support
- **Azure OpenAI**: Enterprise-grade, deployment-based routing, content filtering, SLA support
- **Cloudflare Workers AI**: Edge deployment, neuron-based pricing, global network
- **Perplexity AI**: Real-time search with citations, domain/recency filtering
- **OpenRouter**: Unified access to 100+ models, automatic fallback, pass-through pricing
- **AI21 Labs**: Jamba models (256K context), efficient tokenization, RAG support
- **Cohere**: Custom chat API, RAG-optimized, citations, document support
- **AWS Bedrock**: Unified Converse API, multi-model access, AWS SigV4 auth, enterprise features
- **Anyscale**: Platform-oriented, Llama-2 models, endpoint-based routing
- **Replicate**: Async predictions API, per-model variations, wide model selection
- **Node Llama.cpp**: Run GGUF models locally via llama.cpp (subprocess-based)
- **Apple Foundation Models**: On-device AI for macOS 15+ (Apple Silicon)

### Browser Compatibility Notes

Most providers support direct browser access, but some require:
- **CORS Configuration**: Use a proxy server for providers without browser CORS support (Anthropic uses the anthropic-dangerous-direct-browser-access header)
- **API Key Security**: Never expose API keys in client-side code - use proxy servers for production


## Core Features

### 1. Adapters

#### Frontend Adapters

Convert provider-specific request formats to Universal IR:

```typescript
import {
  OpenAIFrontendAdapter,
  AnthropicFrontendAdapter,
  GeminiFrontendAdapter,
  OllamaFrontendAdapter,
  MistralFrontendAdapter,
  ChromeAIFrontendAdapter,
} from 'ai.matey';
```

**Example:**
```typescript
const frontend = new OpenAIFrontendAdapter();
const irRequest = await frontend.toIR({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

#### Backend Adapters

Execute requests against AI provider APIs:

```typescript
import {
  OpenAIBackendAdapter,
  AnthropicBackendAdapter,
  GeminiBackendAdapter,
  MistralBackendAdapter,
  OllamaBackendAdapter,
  ChromeAIBackendAdapter,
  DeepSeekBackendAdapter,
  GroqBackendAdapter,
  LMStudioBackendAdapter,
  HuggingFaceBackendAdapter,
  NVIDIABackendAdapter,
  MockBackendAdapter,
} from 'ai.matey';

// Native backends (Node.js only, require native binaries)
import {
  NodeLlamaCppBackend,
  AppleBackend,
} from 'ai.matey/adapters/backend-native';
```

**Example:**
```typescript
const backend = new DeepSeekBackendAdapter({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const response = await backend.execute(irRequest);

// Native backend example (Node.js only)
const llamaBackend = new NodeLlamaCppBackend({
  modelPath: './models/llama-3.1-8b.gguf',
  contextSize: 4096,
});
await llamaBackend.start();

const appleBackend = new AppleBackend({
  maximumResponseTokens: 2048,
  temperature: 0.7,
});
```

### 2. Bridge

Connect frontend adapters to backends with middleware support:

```typescript
import { Bridge } from 'ai.matey';

// Create bridge with frontend and backend
const bridge = new Bridge(frontend, backend);

// Add middleware
bridge
  .use(loggingMiddleware)
  .use(costTrackingMiddleware);
```

### 3. Router

Intelligent routing across multiple backends:

```typescript
import { Router, RoutingStrategy } from 'ai.matey';

const router = new Router({
  routingStrategy: RoutingStrategy.COST_OPTIMIZED,
  fallbackStrategy: 'sequential',
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000,
})
  .register('fast', groqBackend)
  .register('smart', anthropicBackend)
  .register('cheap', deepseekBackend)
  .setFallbackChain(['fast', 'smart', 'cheap']);
```

**Routing Strategies:**
- `EXPLICIT` - Route by explicit backend name
- `MODEL_BASED` - Route based on model name
- `COST_OPTIMIZED` - Route to lowest cost provider
- `LATENCY_OPTIMIZED` - Route to fastest provider
- `ROUND_ROBIN` - Distribute requests evenly
- `RANDOM` - Random selection
- `CUSTOM` - Custom routing function

### 4. Middleware

#### Logging Middleware

Track requests and responses:

```typescript
import { createLoggingMiddleware } from 'ai.matey';

bridge.use(createLoggingMiddleware({
  level: 'info', // 'debug' | 'info' | 'warn' | 'error'
  includeRequests: true,
  includeResponses: true,
  includeMetadata: true,
}));
```

#### Cost Tracking Middleware

Monitor API costs in real-time:

```typescript
import { createCostTrackingMiddleware, getCostStats } from 'ai.matey';

const storage = new InMemoryCostStorage();

bridge.use(createCostTrackingMiddleware({
  storage,
  logCosts: true,
  requestThreshold: 0.10,  // Warn if request > $0.10
  hourlyThreshold: 10.00,  // Warn if hourly cost > $10
  dailyThreshold: 100.00,  // Warn if daily cost > $100
  onCost: (cost) => {
    console.log(`Request cost: $${cost.totalCost.toFixed(6)}`);
  },
  onThresholdExceeded: (cost, threshold) => {
    console.warn(`Cost threshold exceeded!`);
  },
}));

// Get statistics
const stats = await getCostStats(storage, 24); // Last 24 hours
console.log(stats); // { total, byProvider, byModel }
```

#### Validation & Sanitization Middleware

Protect against security issues:

```typescript
import { createValidationMiddleware } from 'ai.matey';

bridge.use(createValidationMiddleware({
  // PII Detection & Redaction
  detectPII: true,
  piiAction: 'redact', // 'block' | 'redact' | 'warn' | 'log'
  piiPatterns: {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  },

  // Prompt Injection Prevention
  preventPromptInjection: true,

  // Token Limits
  maxMessages: 100,
  maxTotalTokens: 128000,
  maxTokensPerMessage: 32000,

  // Content Moderation
  moderationCallback: async (content) => {
    // Call external moderation API
    const result = await moderationAPI.check(content);
    return {
      flagged: result.flagged,
      categories: result.categories,
    };
  },
  blockFlaggedContent: true,

  // Custom Validation
  customValidator: async (request) => {
    // Your custom validation logic
    const errors = [];
    // ... validate request
    return errors;
  },
}));
```

#### Caching Middleware

Cache responses for identical requests:

```typescript
import { createCachingMiddleware, InMemoryCacheStorage } from 'ai.matey';

bridge.use(createCachingMiddleware({
  storage: new InMemoryCacheStorage(),
  ttl: 60 * 60 * 1000, // 1 hour
  keyGenerator: (request) => JSON.stringify(request.messages),
  shouldCache: (request, response) => response.finishReason === 'stop',
}));
```

#### Retry Middleware

Automatic retry with exponential backoff:

```typescript
import { createRetryMiddleware, isRateLimitError } from 'ai.matey';

bridge.use(createRetryMiddleware({
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error) => isRateLimitError(error) || isNetworkError(error),
}));
```

#### Telemetry Middleware

Collect metrics and events:

```typescript
import { createTelemetryMiddleware, InMemoryTelemetrySink } from 'ai.matey';

const sink = new InMemoryTelemetrySink();

bridge.use(createTelemetryMiddleware({
  sink,
  includeMetrics: true,
  includeEvents: true,
}));

// View metrics
const metrics = sink.getMetrics();
console.log(metrics.get('request.duration'));
```

#### Transform Middleware

Modify requests and responses:

```typescript
import {
  createTransformMiddleware,
  createPromptRewriter,
  createSystemMessageInjector,
} from 'ai.matey';

bridge.use(createTransformMiddleware({
  requestTransformers: [
    createSystemMessageInjector('You are a helpful assistant.'),
    createPromptRewriter((text) => text + ' Please be concise.'),
  ],
  responseTransformers: [
    (response) => {
      // Custom response transformation
      return response;
    },
  ],
}));
```

#### Security Middleware

Add security headers and protection:

```typescript
import { createSecurityMiddleware, createProductionSecurityMiddleware } from 'ai.matey';

// Production preset
bridge.use(createProductionSecurityMiddleware());

// Custom configuration
bridge.use(createSecurityMiddleware({
  contentSecurityPolicy: "default-src 'self'",
  frameOptions: 'DENY',
  hsts: 'max-age=31536000; includeSubDomains',
}));
```

### 5. Wrappers

#### Chrome AI Wrapper (Current API)

Mimic the current Chrome AI API with any backend:

```typescript
import { ChromeAILanguageModel } from 'ai.matey';

const languageModel = ChromeAILanguageModel(backend);

const session = await languageModel.create({
  temperature: 0.8,
  topK: 40,
});

const response = await session.prompt('Hello!');

// Streaming
const stream = session.promptStreaming('Tell me a story');
for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

#### Legacy Chrome AI Wrapper (Old API)

Full compatibility with the original Chrome AI API:

```typescript
import { LegacyChromeAILanguageModel, polyfillLegacyWindowAI } from 'ai.matey';

const languageModel = LegacyChromeAILanguageModel(backend);

const session = await languageModel.create();
const response = await session.prompt('Hello!');

// Token tracking
console.log(session.tokensSoFar);
console.log(session.tokensLeft);

// Polyfill window.ai globally
polyfillLegacyWindowAI(backend);
const session = await window.ai.languageModel.create();
```

#### OpenAI SDK Wrapper

Drop-in replacement for OpenAI SDK:

```typescript
import { OpenAI } from 'ai.matey';

const client = new OpenAI(backend);

const completion = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

#### Anthropic SDK Wrapper

Drop-in replacement for Anthropic SDK:

```typescript
import { Anthropic } from 'ai.matey';

const client = new Anthropic(backend);

const message = await client.messages.create({
  model: 'claude-3-sonnet',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### 6. HTTP Server Support

Create HTTP endpoints for your AI services:

```typescript
import { createServer } from 'http';
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';
import { NodeHTTPListener } from 'ai.matey/http';

// Create bridge first
const frontend = new OpenAIFrontendAdapter();
const backend = new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY });
const bridge = new Bridge(frontend, backend);

// Create HTTP listener
const listener = NodeHTTPListener(bridge, {
  cors: true,
  streaming: true,
  rateLimit: {
    windowMs: 60000,
    maxRequests: 100,
  },
});

createServer(listener).listen(8080);
```

**Framework Support:**
- Node.js: `import { NodeHTTPListener } from 'ai.matey/http/node'`
- Express: `import { ExpressMiddleware } from 'ai.matey/http/express'`
- Koa: `import { KoaMiddleware } from 'ai.matey/http/koa'`
- Hono: `import { HonoMiddleware } from 'ai.matey/http/hono'`
- Fastify: `import { FastifyHandler } from 'ai.matey/http/fastify'`
- Deno: `import { DenoHandler } from 'ai.matey/http/deno'`

### 7. CLI Tools

ai.matey includes powerful command-line tools for various tasks:

#### Ollama CLI Emulator

Run Ollama-compatible commands with any backend:

```bash
# Download GGUF models from Ollama registry
ai-matey emulate-ollama pull phi3:3.8b

# Create a backend adapter
ai-matey create-backend --provider openai

# Run with your backend
ai-matey emulate-ollama --backend ./backend.mjs run llama3.1
ai-matey emulate-ollama --backend ./backend.mjs run llama3.1 "What is 2+2?"

# Other Ollama commands
ai-matey emulate-ollama --backend ./backend.mjs list
ai-matey emulate-ollama --backend ./backend.mjs ps
ai-matey emulate-ollama --backend ./backend.mjs show llama3.1
```

#### Backend Generator

Generate backend adapter templates:

```bash
# Interactive wizard
ai-matey create-backend

# Quick generation
ai-matey create-backend --provider openai --output ./backend.mjs
ai-matey create-backend --provider node-llamacpp --output ./llama-backend.mjs
ai-matey create-backend --provider apple --output ./apple-backend.mjs
```

#### Format Converters

Convert between Universal IR and provider formats:

```bash
# Convert IR response to provider format
ai-matey convert-response --format openai --input response.json
ai-matey convert-response --format anthropic --input response.json --output out.json

# Convert request formats
ai-matey convert-request --from openai --to ir --input request.json
ai-matey convert-request --from ir --to anthropic --input request.json

# Convert to all formats (for comparison)
ai-matey convert-response --format all --input response.json
```

#### Proxy Server

Start an OpenAI-compatible HTTP proxy with any backend:

```bash
# Start proxy server
ai-matey proxy --backend ./backend.mjs --port 3000

# Now you can use it like OpenAI API
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"Hello!"}]}'
```

See [docs/GUIDES.md](./docs/GUIDES.md) for detailed documentation on all CLI tools and features.

## Import Paths

### Main Package

```typescript
import { Bridge, Router, createBridge } from 'ai.matey';
```

### Subpath Imports

For better tree-shaking and organization:

```typescript
// Middleware only
import { createLoggingMiddleware, createCostTrackingMiddleware } from 'ai.matey/middleware';

// Wrappers only
import { ChromeAILanguageModel, OpenAI } from 'ai.matey/wrappers';

// Backend adapters only
import { OpenAIBackendAdapter, GroqBackendAdapter } from 'ai.matey/adapters/backend';

// Frontend adapters only
import { OpenAIFrontendAdapter } from 'ai.matey/adapters/frontend';

// HTTP utilities
import { NodeHTTPListener } from 'ai.matey/http';
import { ExpressMiddleware } from 'ai.matey/http/express';

// Types only
import type { IRChatRequest, IRChatResponse } from 'ai.matey/types';

// Errors only
import { AdapterError, NetworkError } from 'ai.matey/errors';

// Utils only
import { validateMessage, normalizeTemperature } from 'ai.matey/utils';
```

## API Reference

See [docs/API.md](./docs/API.md) for complete API reference including all exported functions, classes, types, and HTTP integration details.

## Examples

See the [examples/](./examples) directory for complete examples:

- `basic/` - Basic bridge and adapter usage
- `routing/` - Router with multiple providers
- `middleware/` - Middleware pipeline examples
- `http/` - HTTP server integrations
- `wrappers/` - SDK wrapper examples
- `chrome-ai-wrapper.js` - Chrome AI compatibility layer
- `chrome-ai-legacy-wrapper.js` - Legacy Chrome AI API wrapper
- `middleware-demo.ts` - Complete middleware demonstration

## Architecture

```
┌─────────────────────────────────────────────┐
│           Your Application                  │
│      (Provider-Specific Format)             │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│         Frontend Adapter                    │
│     (Convert to Universal IR)               │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│              Bridge                         │
│  ┌────────────────────────────────────────┐ │
│  │      Middleware Pipeline               │ │
│  │  • Logging                             │ │
│  │  • Cost Tracking                       │ │
│  │  • Validation & Sanitization           │ │
│  │  • Caching                             │ │
│  │  • Retry                               │ │
│  │  • Transform                           │ │
│  │  • Telemetry                           │ │
│  └────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│    Router (Optional)                        │
│  • Cost-Optimized Routing                   │
│  • Latency-Optimized Routing                │
│  • Model-Based Routing                      │
│  • Fallback Chain                           │
│  • Circuit Breaker                          │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│         Backend Adapter                     │
│    (Execute on Provider API)                │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│          AI Provider API                    │
│  (OpenAI, Anthropic, Gemini, etc.)          │
└─────────────────────────────────────────────┘
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format

# Test
npm test

# Test with coverage
npm run test:coverage

# Clean
npm run clean
```

## Contributing

Thank you for your interest in contributing to ai.matey! We welcome contributions of all kinds.

### Getting Started

1. Fork the repository and clone locally
2. Install dependencies: `npm install`
3. Create a branch: `git checkout -b feature/my-feature`
4. Make your changes and add tests
5. Run tests: `npm test`
6. Run linter: `npm run lint`
7. Build: `npm run build`
8. Submit a pull request

### What to Contribute

- **Bug fixes** - Check issues labeled `bug`
- **Features** - Check issues labeled `enhancement` or `help wanted`
- **Documentation** - Improve docs, add examples, fix typos
- **Tests** - Add missing tests, improve coverage
- **Adapters** - Add new provider adapters
- **Benchmarks** - Performance testing and optimization
- **Developer Experience** - Tooling (Broswer/VS Code Extension), CLI improvements, DX enhancements
- **Integration** - New HTTP frameworks, serverless platforms, React/Next.js hooks
- **Multi-modal support** - Image, audio, video handling

Look for issues labeled `good first issue` for beginner-friendly tasks.

### Coding Standards

- Use TypeScript with strict mode enabled
- Follow ESLint/Prettier configuration
- Write JSDoc comments for public APIs
- Add tests for new features
- Maintain 80%+ test coverage
- Use conventional commit messages

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

Examples:
- feat(adapters): add Gemini backend adapter
- fix(http): handle empty body in OPTIONS requests
- docs(examples): add caching middleware example
```

### Pull Request Process

1. Update documentation as needed
2. Ensure all tests pass
3. Update CHANGELOG if applicable
4. Request review from maintainers
5. Address feedback promptly

For detailed guidelines, see our [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

## Roadmap

**Current Version:** 0.1.0 (Foundation Complete)

**Next Releases:**
- **v0.2.0** - Router fallback model translation (Q1 2025)
- **v0.3.0** - Capability-based routing (Q2 2025)
- **v0.4.0** - Developer experience improvements (Q2 2025)
- **v1.0.0** - Production ready (Q3 2025)

For the complete roadmap including future features, competitive analysis, and release schedule, see [ROADMAP.md](./docs/ROADMAP.md).

## License

MIT © [AI Matey](https://github.com/johnhenry/ai.matey)

## Documentation

Complete documentation is available:

- **[Examples](./EXAMPLES.md)** - 18+ working examples with complete code:
  - Basic usage (simple bridge, streaming, reverse bridge)
  - Middleware (logging, retry, caching, transform)
  - Routing (round-robin, fallback)
  - HTTP servers (Node.js, Express, Hono)
  - SDK wrappers (OpenAI, Anthropic)
  - Browser APIs (Chrome AI, legacy Chrome AI)
  - Model runners (LlamaCpp for local GGUF models)
  - Browser compatibility guide

- **[API Reference](./docs/API.md)** - Complete API documentation:
  - Core components (Bridge, Router, MiddlewareStack)
  - All adapters (frontend and backend)
  - Middleware (logging, caching, retry, transform, telemetry, security)
  - HTTP integration for all frameworks (Express, Fastify, Koa, Hono, Deno)
  - SDK wrappers (OpenAI, Anthropic, Chrome AI)
  - Complete export reference and import paths
  - Types and error handling

- **[Feature Guides](./docs/GUIDES.md)** - Comprehensive guides:
  - Parallel dispatch (query multiple backends simultaneously)
  - Response conversion (debugging and testing utilities)
  - CLI tools (Ollama emulation, backend generator, format converters, proxy server)

## Support

- 📖 [Documentation](./docs)
- 🐛 [Issue Tracker](https://github.com/johnhenry/ai.matey/issues)
- 💬 [Discussions](https://github.com/johnhenry/ai.matey/discussions)

---

**Made with ❤️ for the AI community**
