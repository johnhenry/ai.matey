# Token.js vs AI Matey Universal: Technical Comparison

**Date**: 2025-10-14
**Analysis**: Deep dive comparison of token.js and ai.matey.universal

---

## Executive Summary

Both **token.js** and **ai.matey.universal** solve the problem of unifying access to multiple LLM providers, but they take fundamentally different architectural approaches:

- **Token.js**: Simple client-side SDK that translates requests from OpenAI format to various provider APIs
- **AI Matey Universal**: Enterprise-grade adapter system with bidirectional translation, intelligent routing, middleware pipeline, and server-side capabilities

**Key Distinction**: Token.js is a lightweight translation layer, while ai.matey.universal is a comprehensive abstraction framework with advanced orchestration features.

---

## 1. Project Overview

### Token.js

**Purpose**: Provide a unified TypeScript SDK for calling 200+ LLMs from 10+ providers using OpenAI's API format as a standard.

**Tagline**: "Integrate 200+ LLMs with one TypeScript SDK using OpenAI's format"

**Core Value Proposition**:
- Client-side only (no proxy server needed)
- Single API format (OpenAI) for all providers
- Simple installation and usage
- Free and open source (MIT)

**GitHub**: https://github.com/token-js/token.js
**Documentation**: https://docs.tokenjs.ai/

### AI Matey Universal

**Purpose**: Provider-agnostic universal adapter system with intelligent routing, fallback strategies, middleware, and bidirectional format translation.

**Tagline**: "Write once, run with any provider"

**Core Value Proposition**:
- Bidirectional translation (any frontend format to any backend provider)
- Intermediate Representation (IR) for provider-agnostic processing
- Advanced routing with 7 strategies + circuit breaker
- Middleware pipeline for cross-cutting concerns
- Server-side HTTP adapters for 6+ frameworks
- Semantic drift tracking and warnings

---

## 2. Architecture Comparison

### Token.js Architecture

```
User Code (OpenAI format)
         |
         v
    Token.js SDK
    (Direct translation)
         |
         v
Provider API (OpenAI, Anthropic, Gemini, etc.)
```

**Characteristics**:
- **One-way translation**: OpenAI format → Provider format
- **Client-side execution**: Runs in browser or Node.js
- **Direct API calls**: SDK calls provider APIs directly
- **Stateless**: No request tracking, no middleware
- **Simple**: Minimal abstraction layer

**Code Example**:
```typescript
const tokenjs = new TokenJS()

const completion = await tokenjs.chat.completions.create({
  provider: 'openai',
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

### AI Matey Universal Architecture

```
User Code (Any Provider Format)
         |
         v
  Frontend Adapter (Normalize)
         |
         v
   Universal IR (Provider-Agnostic)
         |
         v
  Middleware Pipeline (Transform, Log, Cache, etc.)
         |
         v
  Router (7 strategies + circuit breaker)
         |
         v
  Backend Adapter (Execute)
         |
         v
   Provider API
         |
         v
  Backend Adapter (Normalize response)
         |
         v
  Frontend Adapter (Denormalize)
         |
         v
  User Code (Original Format)
```

**Characteristics**:
- **Bidirectional translation**: Any format → IR → Any provider → IR → Original format
- **Both client and server**: Works in browser, Node.js, Deno, edge runtimes
- **Layered architecture**: Separation of concerns with adapters, router, bridge
- **Stateful**: Request tracking, provenance, statistics
- **Complex**: Full abstraction with rich features

**Code Example**:
```typescript
import {
  Bridge,
  OpenAIFrontendAdapter,
  AnthropicBackendAdapter,
  Router
} from 'ai.matey';

// Setup adapters
const frontend = new OpenAIFrontendAdapter();
const anthropic = new AnthropicBackendAdapter({ apiKey: '...' });
const openai = new OpenAIBackendAdapter({ apiKey: '...' });

// Setup router with fallback
const router = new Router({ routingStrategy: 'model-based' })
  .register('anthropic', anthropic)
  .register('openai', openai)
  .setFallbackChain(['anthropic', 'openai']);

// Create bridge
const bridge = new Bridge(frontend, router);

// Use with OpenAI format, but routes intelligently
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello!' }
  ]
});
```

---

## 3. Key Features Comparison

| Feature | Token.js | AI Matey Universal |
|---------|----------|-------------------|
| **Provider Support** | 10+ providers, 200+ models | 6 providers currently (extensible) |
| **API Format** | OpenAI only | Any format (6 frontend adapters) |
| **Bidirectional Translation** | ❌ One-way only | ✅ Full bidirectional |
| **Intermediate Representation** | ❌ Direct translation | ✅ Universal IR |
| **Intelligent Routing** | ❌ Manual provider selection | ✅ 7 routing strategies |
| **Fallback/Failover** | ❌ Not supported | ✅ Sequential/parallel/custom |
| **Circuit Breaker** | ❌ Not supported | ✅ Automatic failure recovery |
| **Middleware Pipeline** | ❌ Not supported | ✅ Logging, caching, retry, etc. |
| **Request Tracking** | ❌ Not supported | ✅ Full provenance tracking |
| **Semantic Drift Warnings** | ❌ Not supported | ✅ Tracks parameter transformations |
| **Server-Side HTTP** | ❌ Client-only | ✅ 6 framework adapters |
| **Streaming** | ✅ Supported | ✅ Full support with normalization |
| **Tools/Function Calling** | ✅ Supported | ✅ Normalized across providers |
| **JSON Mode** | ✅ Supported | ✅ Supported |
| **Image Inputs** | ✅ Supported | ✅ Multi-modal support |
| **TypeScript** | ✅ Full TypeScript | ✅ Full TypeScript |
| **Zero Dependencies** | ✅ Lightweight | ✅ Core has zero dependencies |
| **Cost Tracking** | ❌ Not supported | ✅ Optional cost estimation |
| **Latency Tracking** | ❌ Not supported | ✅ P50/P95/P99 metrics |
| **Health Checks** | ❌ Not supported | ✅ Automatic health monitoring |

---

## 4. API Design Philosophy

### Token.js: OpenAI-First

Token.js standardizes on OpenAI's format as the "lingua franca" for LLM interactions.

**Pros**:
- Familiar to developers already using OpenAI
- Simple mental model
- Easy migration from OpenAI
- Minimal learning curve

**Cons**:
- Locked into OpenAI's API design
- Cannot use native features of other providers
- Semantic loss when providers have different capabilities
- One-way translation only

**Example**:
```typescript
// Always OpenAI format, regardless of provider
const completion = await tokenjs.chat.completions.create({
  provider: 'anthropic',  // Using Anthropic...
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Hello!' }]  // ...but OpenAI format
})
```

### AI Matey Universal: Provider-Agnostic IR

AI Matey Universal uses an Intermediate Representation (IR) that abstracts all provider differences.

**Pros**:
- True provider agnosticism
- Bidirectional translation preserves original API experience
- Can use any frontend format (OpenAI, Anthropic, Gemini, etc.)
- Rich metadata and provenance tracking
- Semantic drift warnings document transformations

**Cons**:
- More complex architecture
- Higher learning curve
- Larger API surface area

**Example**:
```typescript
// Can use Anthropic format natively
const anthropicFrontend = new AnthropicFrontendAdapter();
const openaiBackend = new OpenAIBackendAdapter({ apiKey: '...' });
const bridge = new Bridge(anthropicFrontend, openaiBackend);

// Write in Anthropic format...
const response = await bridge.chat({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }]
});
// ...get back Anthropic format, but runs on OpenAI!

// Or use OpenAI format
const openaiF
rontend = new OpenAIFrontendAdapter();
const bridge2 = new Bridge(openaiFrontend, openaiBackend);

const response2 = await bridge2.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

---

## 5. Intermediate Representation (IR)

### Token.js: No IR

Token.js directly translates OpenAI format to provider-specific format without an intermediate layer.

```typescript
// Conceptual flow
OpenAI Request → Token.js Translation → Provider API Call
```

### AI Matey Universal: Rich IR

The IR is the heart of ai.matey.universal, providing a universal format that captures all provider capabilities.

**Core IR Types**:

```typescript
interface IRChatRequest {
  messages: IRMessage[];           // Universal message format
  tools?: IRTool[];               // Normalized tool definitions
  toolChoice?: 'auto' | 'required' | 'none' | { name: string };
  parameters?: IRParameters;       // Normalized parameters
  metadata: IRMetadata;           // Provenance, tracking, warnings
  stream?: boolean;
}

interface IRChatResponse {
  message: IRMessage;             // Assistant's response
  finishReason: FinishReason;     // Why generation stopped
  usage?: IRUsage;                // Token usage statistics
  metadata: IRMetadata;           // Full provenance chain
  raw?: Record<string, unknown>;  // Original provider response
}

interface IRMetadata {
  requestId: string;                    // Unique request ID
  providerResponseId?: string;          // Provider's response ID
  timestamp: number;                    // Request timestamp
  provenance?: IRProvenance;            // Adapter chain tracking
  warnings?: IRWarning[];               // Semantic drift warnings
  custom?: Record<string, unknown>;     // User metadata
}
```

**Semantic Drift Tracking**:

```typescript
interface IRWarning {
  category: 'parameter-normalized' | 'parameter-clamped' | 'parameter-unsupported' | ...;
  severity: 'info' | 'warning' | 'error';
  message: string;
  field?: string;
  originalValue?: unknown;
  transformedValue?: unknown;
  source?: string;
}

// Example: Temperature scaling warning
{
  category: 'parameter-normalized',
  severity: 'info',
  message: 'Temperature scaled from 0-2 range (OpenAI) to 0-1 range (Anthropic)',
  field: 'temperature',
  originalValue: 1.5,
  transformedValue: 0.75,
  source: 'anthropic-backend'
}
```

This allows developers to understand exactly how their requests are transformed across providers.

---

## 6. Provider Support

### Token.js

**Providers** (10+):
- AI21
- Anthropic
- AWS Bedrock
- Cohere
- Gemini (Google)
- Groq
- Mistral
- OpenAI
- OpenRouter
- Perplexity
- Any OpenAI-compatible API

**Models**: Claims 200+ models

**Provider Configuration**:
```typescript
// Environment variables for credentials
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

// Usage
const completion = await tokenjs.chat.completions.create({
  provider: 'anthropic',  // String-based provider selection
  model: 'claude-3-5-sonnet-20241022',
  messages: [...]
})
```

### AI Matey Universal

**Current Providers** (6):
- OpenAI
- Anthropic
- Google Gemini
- Mistral AI
- Ollama (local)
- Chrome AI (browser)

**Planned Providers** (v1.0+):
- Cohere
- AI21 Labs
- Hugging Face
- Together AI
- Replicate
- AWS Bedrock
- Azure OpenAI
- Cloudflare Workers AI

**Provider Configuration**:
```typescript
// Backend adapters with rich configuration
const anthropic = new AnthropicBackendAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com',  // Optional custom endpoint
  timeout: 30000,                         // Request timeout
  maxRetries: 3,                          // Retry attempts
  debug: true,                            // Enable debug logging
  headers: { 'X-Custom': 'value' },      // Custom headers
});

// Frontend adapters (no config needed)
const openai = new OpenAIFrontendAdapter();
const anthropicFrontend = new AnthropicFrontendAdapter();

// Can mix and match: write in OpenAI format, run on Anthropic
const bridge = new Bridge(openai, anthropic);
```

**Verdict**: Token.js has broader provider coverage (200+ models), but ai.matey.universal has deeper integration with rich configuration and bidirectional support.

---

## 7. Routing & Orchestration

### Token.js: Manual Provider Selection

Token.js requires explicit provider specification in each request:

```typescript
// Must manually specify provider every time
await tokenjs.chat.completions.create({
  provider: 'openai',  // Hardcoded choice
  model: 'gpt-4',
  messages: [...]
})

// No automatic failover
try {
  await tokenjs.chat.completions.create({
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    messages: [...]
  })
} catch (error) {
  // Must manually implement fallback
  await tokenjs.chat.completions.create({
    provider: 'openai',
    model: 'gpt-4',
    messages: [...]
  })
}
```

**No built-in support for**:
- Automatic failover
- Circuit breaker
- Load balancing
- Cost optimization
- Latency optimization

### AI Matey Universal: Intelligent Router

The Router is a core feature that manages multiple backends with sophisticated strategies:

**7 Routing Strategies**:

1. **Explicit**: Use preferred backend if specified
2. **Model-Based**: Route based on model name mapping
3. **Cost-Optimized**: Choose cheapest backend
4. **Latency-Optimized**: Choose fastest backend
5. **Round-Robin**: Distribute load evenly
6. **Random**: Random selection for testing
7. **Custom**: User-defined routing logic

**Example**:
```typescript
const router = new Router({
  routingStrategy: 'latency-optimized',
  fallbackStrategy: 'sequential',
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  trackLatency: true,
  trackCost: true
});

// Register backends
router
  .register('anthropic', anthropicBackend)
  .register('openai', openaiBackend)
  .register('gemini', geminiBackend);

// Configure model mapping
router.setModelMapping({
  'gpt-4': 'openai',
  'gpt-4-turbo': 'openai',
  'claude-3-5-sonnet-20241022': 'anthropic',
  'gemini-pro': 'gemini'
});

// Set fallback chain
router.setFallbackChain(['openai', 'anthropic', 'gemini']);

// Use with Bridge
const bridge = new Bridge(frontend, router);

// Router automatically:
// 1. Selects best backend based on strategy
// 2. Falls back if primary fails
// 3. Tracks latency and cost
// 4. Opens circuit breaker on repeated failures
const response = await bridge.chat(request);
```

**Circuit Breaker**:
```typescript
// Automatic failure recovery
router.register('unstable-backend', unstableAdapter);

// After 5 consecutive failures, circuit opens
// Requests skip this backend for 60 seconds
// Then enters half-open state (one test request)
// If successful, circuit closes; if fails, opens again
```

**Health Checks**:
```typescript
const router = new Router({
  healthCheckInterval: 30000  // Check every 30 seconds
});

// Manual health check
const health = await router.checkHealth();
console.log(health);
// { anthropic: true, openai: true, gemini: false }

// Unhealthy backends excluded from routing
```

**Statistics & Monitoring**:
```typescript
const stats = router.getStats();
console.log(stats);
/*
{
  totalRequests: 1000,
  successfulRequests: 975,
  failedRequests: 25,
  totalFallbacks: 20,
  backendStats: {
    openai: {
      totalRequests: 500,
      successfulRequests: 495,
      failedRequests: 5,
      successRate: 99.0,
      averageLatencyMs: 250,
      p50LatencyMs: 200,
      p95LatencyMs: 400,
      p99LatencyMs: 600,
      averageCost: 0.002
    },
    anthropic: { ... }
  }
}
*/
```

**Verdict**: AI Matey Universal has enterprise-grade routing and orchestration features that token.js completely lacks.

---

## 8. Middleware System

### Token.js: No Middleware

Token.js does not support middleware or request/response transformation.

### AI Matey Universal: Rich Middleware Pipeline

The middleware system allows cross-cutting concerns to be applied to all requests:

**Built-in Middleware**:

1. **Logging Middleware**:
```typescript
import { createLoggingMiddleware } from 'ai.matey';

bridge.use(createLoggingMiddleware({
  logRequest: true,
  logResponse: true,
  logErrors: true,
  logger: console.log
}));
```

2. **Telemetry Middleware**:
```typescript
import { createTelemetryMiddleware } from 'ai.matey';

bridge.use(createTelemetryMiddleware({
  onRequestStart: (req) => { /* track */ },
  onRequestEnd: (req, res, duration) => { /* track */ },
  onRequestError: (req, error) => { /* track */ }
}));
```

3. **Caching Middleware**:
```typescript
import { createCachingMiddleware } from 'ai.matey';

bridge.use(createCachingMiddleware({
  ttl: 3600000,  // 1 hour
  keyGenerator: (req) => `${req.model}:${JSON.stringify(req.messages)}`,
  cache: new Map()  // Or Redis, Memcached, etc.
}));
```

4. **Retry Middleware**:
```typescript
import { createRetryMiddleware } from 'ai.matey';

bridge.use(createRetryMiddleware({
  maxRetries: 3,
  backoffMs: 1000,
  retryableErrors: ['RATE_LIMIT_EXCEEDED', 'TIMEOUT']
}));
```

5. **Transform Middleware**:
```typescript
import { createTransformMiddleware } from 'ai.matey';

bridge.use(createTransformMiddleware({
  transformRequest: (req) => ({
    ...req,
    parameters: { ...req.parameters, temperature: 0.7 }
  }),
  transformResponse: (res) => ({ ...res, /* custom fields */ })
}));
```

**Custom Middleware**:
```typescript
import { Middleware } from 'ai.matey';

const authMiddleware: Middleware = {
  name: 'auth',
  onRequest: async (context, next) => {
    // Check authentication
    if (!context.request.metadata.custom?.userId) {
      throw new Error('Unauthorized');
    }
    return next();
  }
};

bridge.use(authMiddleware);
```

**Middleware Composition**:
```typescript
// Middleware executes in order
bridge
  .use(authMiddleware)
  .use(cachingMiddleware)
  .use(retryMiddleware)
  .use(loggingMiddleware);

// Execution flow:
// Request → Auth → Cache Check → (miss) → Retry → Logging → Backend
//                            ↓ (hit)
//                          Response
```

**Verdict**: AI Matey Universal has a powerful middleware system for cross-cutting concerns that token.js lacks entirely.

---

## 9. Server-Side HTTP Support

### Token.js: Client-Side Only

Token.js is designed for client-side usage only. To expose it as a server endpoint, you'd need to manually wrap it:

```typescript
// Manual Express wrapper (not provided by token.js)
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const completion = await tokenjs.chat.completions.create(req.body);
    res.json(completion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Limitations**:
- No built-in server support
- No streaming handling
- No CORS configuration
- No rate limiting
- No authentication
- No request parsing/validation
- Must implement error handling manually

### AI Matey Universal: Full HTTP Server Support

AI Matey Universal provides HTTP adapters for 6+ frameworks:

**Supported Frameworks**:
- Node.js (http/https)
- Express
- Koa
- Hono
- Fastify
- Deno

**Node.js Example**:
```typescript
import http from 'http';
import { NodeHTTPListener } from 'ai.matey/http/node';
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

const frontend = new OpenAIFrontendAdapter();
const backend = new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY });
const bridge = new Bridge(frontend, backend);

const listener = NodeHTTPListener(bridge, {
  cors: {
    origin: '*',
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  streaming: true,
  rateLimit: {
    windowMs: 60000,
    max: 100
  },
  auth: {
    validator: async (token) => token === process.env.API_KEY
  }
});

const server = http.createServer(listener);
server.listen(8080);
```

**Express Example**:
```typescript
import express from 'express';
import { ExpressMiddleware } from 'ai.matey/http/express';

const app = express();
app.use(express.json());
app.use('/v1/chat/completions', ExpressMiddleware(bridge, {
  cors: true,
  streaming: true
}));
app.listen(8080);
```

**Features**:
- ✅ Automatic request parsing
- ✅ Response formatting (JSON, SSE for streaming)
- ✅ CORS handling
- ✅ Authentication/authorization
- ✅ Rate limiting
- ✅ Error handling and reporting
- ✅ Streaming support (SSE)
- ✅ Route matching
- ✅ Keep-alive for long requests
- ✅ Client disconnect handling

**Verdict**: AI Matey Universal has comprehensive server-side support, while token.js is client-only.

---

## 10. Streaming Support

### Token.js: Basic Streaming

Token.js supports streaming with async iterators:

```typescript
const result = await tokenjs.chat.completions.create({
  stream: true,
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }]
});

for await (const part of result) {
  process.stdout.write(part.choices[0]?.delta?.content || '');
}
```

**Characteristics**:
- OpenAI streaming format only
- No stream normalization across providers
- No chunk metadata
- No error handling in stream
- Client-side only

### AI Matey Universal: Universal Streaming

AI Matey Universal normalizes streaming across all providers with rich chunk types:

**IR Stream Chunks**:
```typescript
type IRStreamChunk =
  | StreamStartChunk      // Stream initialization with metadata
  | StreamContentChunk    // Content delta
  | StreamToolUseChunk    // Tool call in progress
  | StreamMetadataChunk   // Usage statistics, etc.
  | StreamDoneChunk       // Stream complete with final message
  | StreamErrorChunk;     // Error during streaming

// Example
for await (const chunk of bridge.chatStream(request)) {
  switch (chunk.type) {
    case 'start':
      console.log('Stream started:', chunk.metadata.requestId);
      break;
    case 'content':
      process.stdout.write(chunk.delta);
      break;
    case 'tool_use':
      console.log('Tool call:', chunk.name, chunk.id);
      break;
    case 'metadata':
      console.log('Usage:', chunk.usage);
      break;
    case 'done':
      console.log('Finish reason:', chunk.finishReason);
      console.log('Total usage:', chunk.usage);
      break;
    case 'error':
      console.error('Error:', chunk.error.message);
      break;
  }
}
```

**Server-Side Streaming (SSE)**:
```typescript
// Automatic SSE handling in HTTP adapters
const listener = NodeHTTPListener(bridge, { streaming: true });

// Responds with:
// Content-Type: text/event-stream
// data: {"type":"start","sequence":0,...}
// data: {"type":"content","sequence":1,"delta":"Hello"}
// data: {"type":"content","sequence":2,"delta":" there"}
// data: {"type":"done","sequence":3,"finishReason":"stop"}
// data: [DONE]
```

**Verdict**: AI Matey Universal has more sophisticated streaming with normalized chunks and server-side SSE support.

---

## 11. Error Handling

### Token.js: Basic Error Handling

Token.js relies on native JavaScript errors:

```typescript
try {
  await tokenjs.chat.completions.create({
    provider: 'openai',
    model: 'gpt-4',
    messages: [...]
  });
} catch (error) {
  // Generic error handling
  console.error(error.message);
}
```

**Limitations**:
- No error categorization
- No retry logic
- No provider-specific error mapping
- No structured error details

### AI Matey Universal: Comprehensive Error System

30+ error codes with detailed categorization:

**Error Hierarchy**:
```typescript
class AdapterError extends Error {
  code: ErrorCode;           // Structured error code
  isRetryable: boolean;      // Should retry?
  details?: any;             // Error-specific details
  cause?: Error;             // Original error
  provenance?: Provenance;   // Where error occurred
}

enum ErrorCode {
  // Authentication
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  INVALID_API_KEY = 'INVALID_API_KEY',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_MODEL = 'INVALID_MODEL',

  // Provider
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Routing
  ROUTING_FAILED = 'ROUTING_FAILED',
  NO_BACKEND_AVAILABLE = 'NO_BACKEND_AVAILABLE',
  ALL_BACKENDS_FAILED = 'ALL_BACKENDS_FAILED',

  // Network
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',

  // Streaming
  STREAM_ERROR = 'STREAM_ERROR',
  STREAM_INTERRUPTED = 'STREAM_INTERRUPTED',

  // Content
  CONTENT_FILTER_ERROR = 'CONTENT_FILTER_ERROR',
  CONTEXT_LENGTH_EXCEEDED = 'CONTEXT_LENGTH_EXCEEDED',

  // Conversion
  ADAPTER_CONVERSION_ERROR = 'ADAPTER_CONVERSION_ERROR',
  UNSUPPORTED_FEATURE = 'UNSUPPORTED_FEATURE',

  // Internal
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}
```

**Usage**:
```typescript
try {
  await bridge.chat(request);
} catch (error) {
  if (error instanceof AdapterError) {
    console.error('Error code:', error.code);
    console.error('Retryable:', error.isRetryable);
    console.error('Provider:', error.provenance?.backend);
    console.error('Details:', error.details);

    // Structured error handling
    switch (error.code) {
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        await waitAndRetry();
        break;
      case ErrorCode.AUTHENTICATION_ERROR:
        refreshApiKey();
        break;
      case ErrorCode.ALL_BACKENDS_FAILED:
        notifyAdmin();
        break;
    }
  }
}
```

**Verdict**: AI Matey Universal has enterprise-grade error handling with 30+ structured error codes.

---

## 12. TypeScript Support

### Token.js: Full TypeScript

```typescript
import { TokenJS } from 'token.js';

const tokenjs = new TokenJS();

// Type-safe API
const completion: ChatCompletion = await tokenjs.chat.completions.create({
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }]
});
```

**Pros**:
- Written in TypeScript
- Type definitions included
- OpenAI types (familiar)

**Cons**:
- Limited type safety for provider-specific features
- No compile-time validation of provider/model combinations

### AI Matey Universal: Advanced TypeScript

```typescript
import {
  Bridge,
  OpenAIFrontendAdapter,
  AnthropicBackendAdapter,
  type IRChatRequest,
  type IRChatResponse,
  type InferFrontendRequest,
  type InferFrontendResponse
} from 'ai.matey';

// Type-safe adapter pairing
const frontend = new OpenAIFrontendAdapter();
const backend = new AnthropicBackendAdapter({ apiKey: '...' });
const bridge = new Bridge(frontend, backend);

// Inferred types
type RequestType = InferFrontendRequest<typeof frontend>;  // OpenAI.ChatCompletionCreateParams
type ResponseType = InferFrontendResponse<typeof frontend>; // OpenAI.ChatCompletion

// Type-safe request
const request: RequestType = {
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }]
};

const response: ResponseType = await bridge.chat(request);
```

**Features**:
- **Discriminated Unions**: Type-safe IR chunks, content types, etc.
- **Generic Adapters**: Preserve provider-specific types
- **Type Inference**: Automatic type inference from adapter types
- **Readonly Types**: Immutable IR for safety
- **Branded Types**: Prevent accidental type mixing

**Example - Type-Safe Streaming**:
```typescript
for await (const chunk of bridge.chatStream(request)) {
  // TypeScript knows all chunk types
  switch (chunk.type) {
    case 'start':
      const id = chunk.metadata.requestId;  // string
      break;
    case 'content':
      const text = chunk.delta;  // string
      break;
    case 'done':
      const reason = chunk.finishReason;  // FinishReason
      break;
  }
}
```

**Verdict**: Both have excellent TypeScript support, but ai.matey.universal has more sophisticated type-level features.

---

## 13. Target Audience & Use Cases

### Token.js: Best For

**Target Audience**:
- Developers wanting quick LLM integration
- Teams already using OpenAI format
- Prototypes and MVPs
- Client-side applications
- Small to medium projects

**Ideal Use Cases**:
1. **Rapid Prototyping**: Get multiple LLMs working quickly
2. **OpenAI Migration**: Easy switching from OpenAI to alternatives
3. **Client-Side Chatbots**: Browser-based LLM apps
4. **Simple CLI Tools**: Quick scripts and utilities
5. **Cost Optimization**: Try different providers with same code

**Example Project**:
```typescript
// Simple chatbot with multiple provider options
const provider = process.env.LLM_PROVIDER || 'openai';

const completion = await tokenjs.chat.completions.create({
  provider,
  model: getModelForProvider(provider),
  messages: conversationHistory
});
```

### AI Matey Universal: Best For

**Target Audience**:
- Enterprise teams building production systems
- Platform engineers creating LLM infrastructure
- Teams needing advanced routing and failover
- Organizations requiring full observability
- Server-side application developers

**Ideal Use Cases**:
1. **LLM Proxy Services**: Unified gateway to multiple providers
2. **Enterprise Chatbots**: Production systems with SLAs
3. **API Gateways**: Route requests to optimal providers
4. **Multi-Tenant Platforms**: Different providers per customer
5. **Cost-Optimized Systems**: Automatic routing to cheapest provider
6. **High-Availability Systems**: Circuit breaker and fallback
7. **Observability Platforms**: Full tracking and monitoring
8. **Legacy System Integration**: Support multiple input formats

**Example Project**:
```typescript
// Production LLM gateway with intelligent routing
const router = new Router({
  routingStrategy: 'cost-optimized',
  fallbackStrategy: 'sequential',
  enableCircuitBreaker: true,
  trackLatency: true,
  trackCost: true
})
  .register('openai', openaiBackend)
  .register('anthropic', anthropicBackend)
  .register('gemini', geminiBackend)
  .setFallbackChain(['openai', 'anthropic', 'gemini']);

// Add middleware
bridge
  .use(authMiddleware)
  .use(cachingMiddleware)
  .use(telemetryMiddleware)
  .use(rateLimitMiddleware);

// Expose as HTTP API
const server = http.createServer(
  NodeHTTPListener(bridge, {
    cors: true,
    streaming: true,
    rateLimit: { windowMs: 60000, max: 1000 },
    auth: { validator: validateJWT }
  })
);

// Monitor health
setInterval(async () => {
  const health = await router.checkHealth();
  const stats = router.getStats();
  sendMetrics({ health, stats });
}, 30000);
```

**Verdict**: Token.js for simple projects, ai.matey.universal for production systems.

---

## 14. Strengths Comparison

### Token.js Strengths

1. **Simplicity**: Minimal API surface, easy to learn
2. **Broad Provider Coverage**: 200+ models from 10+ providers
3. **Zero Infrastructure**: Client-side only, no servers needed
4. **OpenAI Compatibility**: Drop-in replacement for OpenAI SDK
5. **Quick Setup**: `npm install token.js` and you're done
6. **Lightweight**: Small bundle size
7. **Familiar API**: Uses well-known OpenAI format

### AI Matey Universal Strengths

1. **Provider Agnosticism**: True bidirectional format translation
2. **Enterprise Features**: Router, circuit breaker, health checks
3. **Middleware System**: Extensible pipeline for cross-cutting concerns
4. **Server-Side Support**: 6+ framework adapters
5. **Observability**: Full provenance tracking, warnings, statistics
6. **Intelligent Routing**: 7 strategies including cost/latency optimization
7. **Semantic Drift Tracking**: Understand transformations across providers
8. **Advanced Streaming**: Normalized chunks with rich metadata
9. **Error Handling**: 30+ structured error codes
10. **Flexible Architecture**: Use any frontend format with any backend
11. **Production Ready**: Circuit breaker, health checks, fallback chains
12. **Zero Dependencies**: Core library is dependency-free

---

## 15. Weaknesses Comparison

### Token.js Weaknesses

1. **OpenAI Lock-In**: Forced to use OpenAI format only
2. **No Routing**: Manual provider selection required
3. **No Fallback**: Must implement failover manually
4. **No Middleware**: Can't add cross-cutting concerns
5. **No Observability**: Limited tracking and monitoring
6. **No Server Support**: Client-side only
7. **No Error Categorization**: Generic error handling
8. **No Semantic Drift Tracking**: Unaware of transformations
9. **Limited Streaming**: Basic async iteration only
10. **No Circuit Breaker**: No automatic failure recovery

### AI Matey Universal Weaknesses

1. **Complexity**: Steeper learning curve
2. **Limited Provider Coverage**: Only 6 providers currently (vs token.js 10+)
3. **Larger Bundle**: More features = more code
4. **More Moving Parts**: Adapters, routers, middleware, etc.
5. **Overkill for Simple Projects**: Too much infrastructure for quick prototypes
6. **Less Mature**: Newer project (v0.1.0) vs established alternatives

---

## 16. Performance Comparison

### Token.js Performance

**Pros**:
- Minimal overhead (direct translation)
- Small bundle size
- Fast for simple requests

**Cons**:
- No caching built-in
- No connection pooling
- No latency tracking

### AI Matey Universal Performance

**Target Benchmarks** (from ROADMAP.md):
- Adapter overhead < 5ms (p95)
- Streaming latency < 50ms (p95)
- Bundle size < 50KB minified

**Optimizations**:
- Middleware caching reduces redundant API calls
- Circuit breaker prevents wasting time on failed backends
- Latency-optimized routing selects fastest backend
- Connection reuse across requests
- Efficient streaming with backpressure handling

**Trade-offs**:
- More features = slightly higher overhead
- But provides caching, routing, and middleware benefits
- Net performance often better due to intelligent routing

---

## 17. Code Examples Comparison

### Simple Chat Request

**Token.js**:
```typescript
import { TokenJS } from 'token.js';

const tokenjs = new TokenJS();

const completion = await tokenjs.chat.completions.create({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'user', content: 'What is 2+2?' }
  ]
});

console.log(completion.choices[0].message.content);
```

**AI Matey Universal**:
```typescript
import {
  Bridge,
  OpenAIFrontendAdapter,
  AnthropicBackendAdapter
} from 'ai.matey';

const frontend = new OpenAIFrontendAdapter();
const backend = new AnthropicBackendAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY
});
const bridge = new Bridge(frontend, backend);

const response = await bridge.chat({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'What is 2+2?' }
  ]
});

console.log(response.choices[0].message.content);
```

**Verdict**: Token.js is simpler for basic use cases (4 lines vs 10 lines).

---

### Streaming

**Token.js**:
```typescript
const result = await tokenjs.chat.completions.create({
  stream: true,
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }]
});

for await (const chunk of result) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}
```

**AI Matey Universal**:
```typescript
for await (const chunk of bridge.chatStream({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }]
})) {
  if (chunk.choices?.[0]?.delta?.content) {
    process.stdout.write(chunk.choices[0].delta.content);
  }
}
```

**Verdict**: Roughly equivalent for basic streaming.

---

### Fallback/Failover

**Token.js**:
```typescript
// Must implement manually
async function chatWithFallback(messages) {
  const providers = ['openai', 'anthropic', 'gemini'];

  for (const provider of providers) {
    try {
      return await tokenjs.chat.completions.create({
        provider,
        model: getModelForProvider(provider),
        messages
      });
    } catch (error) {
      console.error(`${provider} failed:`, error);
      if (provider === providers[providers.length - 1]) {
        throw error;
      }
    }
  }
}

const completion = await chatWithFallback([
  { role: 'user', content: 'Hello' }
]);
```

**AI Matey Universal**:
```typescript
// Built-in fallback
const router = new Router({ fallbackStrategy: 'sequential' })
  .register('openai', openaiBackend)
  .register('anthropic', anthropicBackend)
  .register('gemini', geminiBackend)
  .setFallbackChain(['openai', 'anthropic', 'gemini']);

const bridge = new Bridge(frontend, router);

// Automatic fallback if openai fails
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }]
});
```

**Verdict**: AI Matey Universal has built-in, sophisticated fallback logic.

---

### Function Calling

**Token.js**:
```typescript
const tools = [{
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Get weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City and state'
        }
      },
      required: ['location']
    }
  }
}];

const completion = await tokenjs.chat.completions.create({
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What\'s the weather in SF?' }],
  tools
});

if (completion.choices[0].message.tool_calls) {
  // Handle tool calls
}
```

**AI Matey Universal**:
```typescript
const tools = [{
  name: 'get_weather',
  description: 'Get weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City and state'
      }
    },
    required: ['location']
  }
}];

const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What\'s the weather in SF?' }],
  tools
});

// Tools normalized across providers
if (response.choices[0].message.tool_calls) {
  // Handle tool calls
}
```

**Verdict**: Both support function calling with similar APIs.

---

### Production API Server

**Token.js**:
```typescript
// Must build manually
import express from 'express';
import { TokenJS } from 'token.js';

const app = express();
const tokenjs = new TokenJS();

app.use(express.json());

app.post('/v1/chat/completions', async (req, res) => {
  try {
    const completion = await tokenjs.chat.completions.create(req.body);
    res.json(completion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(8080);
```

**Problems**:
- No streaming support
- No CORS handling
- No authentication
- No rate limiting
- No error categorization
- No health checks

**AI Matey Universal**:
```typescript
import http from 'http';
import { NodeHTTPListener } from 'ai.matey/http/node';
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter, Router } from 'ai.matey';

const frontend = new OpenAIFrontendAdapter();
const router = new Router({
  routingStrategy: 'latency-optimized',
  enableCircuitBreaker: true
})
  .register('openai', new OpenAIBackendAdapter({ apiKey: '...' }))
  .register('anthropic', new AnthropicBackendAdapter({ apiKey: '...' }));

const bridge = new Bridge(frontend, router);

const listener = NodeHTTPListener(bridge, {
  cors: { origin: '*' },
  streaming: true,
  rateLimit: { windowMs: 60000, max: 1000 },
  auth: { validator: async (token) => validateToken(token) },
  errorHandler: (error, req, res) => {
    logError(error);
    sendErrorToMonitoring(error);
  }
});

const server = http.createServer(listener);
server.listen(8080);
```

**Verdict**: AI Matey Universal provides production-ready HTTP servers out of the box.

---

## 18. Ecosystem & Community

### Token.js

- **GitHub**: https://github.com/token-js/token.js
- **License**: MIT
- **Documentation**: https://docs.tokenjs.ai/
- **Status**: Active development

### AI Matey Universal

- **GitHub**: (Private/Internal based on the codebase)
- **License**: MIT
- **Version**: 0.1.0 (initial release)
- **Roadmap**: Comprehensive roadmap through v1.0 and beyond
- **Status**: Active development

**Verdict**: Token.js may have more community momentum as an established open-source project, while ai.matey.universal is newer but more feature-rich.

---

## 19. Summary Table

| Aspect | Token.js | AI Matey Universal |
|--------|----------|-------------------|
| **Complexity** | Simple | Complex |
| **Provider Coverage** | 10+ providers, 200+ models | 6 providers (extensible) |
| **API Format** | OpenAI only | Any format (6 frontend adapters) |
| **Architecture** | Direct translation | Intermediate Representation |
| **Routing** | Manual | 7 strategies + custom |
| **Fallback** | Manual | Automatic with circuit breaker |
| **Middleware** | None | Rich pipeline |
| **Server Support** | None | 6 frameworks |
| **Streaming** | Basic | Advanced with SSE |
| **Error Handling** | Generic | 30+ structured codes |
| **Observability** | Limited | Full provenance + stats |
| **Use Case** | Quick prototypes | Production systems |
| **Bundle Size** | Smaller | Larger |
| **Learning Curve** | Gentle | Steeper |
| **TypeScript** | Full | Advanced |
| **License** | MIT | MIT |

---

## 20. Recommendations

### Choose Token.js If:
- ✅ You want the simplest possible integration
- ✅ You're already using OpenAI format
- ✅ You need quick prototyping
- ✅ You're building client-side apps
- ✅ You need broad provider coverage (200+ models)
- ✅ You don't need routing, fallback, or middleware
- ✅ You're comfortable with manual failover logic

### Choose AI Matey Universal If:
- ✅ You're building production systems
- ✅ You need intelligent routing and failover
- ✅ You want bidirectional format translation
- ✅ You need server-side HTTP APIs
- ✅ You require full observability and tracking
- ✅ You want middleware for cross-cutting concerns
- ✅ You need circuit breaker and health checks
- ✅ You want to track semantic drift and transformations
- ✅ You're building an LLM gateway or proxy service
- ✅ You need advanced features like cost/latency optimization

### Consider Both If:
- Use **token.js** for client-side frontend code
- Use **ai.matey.universal** for backend API servers
- Best of both worlds: simplicity where it matters, power where it's needed

---

## 21. Future Outlook

### Token.js Roadmap (Inferred)
- Likely to add more providers
- May add more features over time
- Focus on simplicity and broad coverage

### AI Matey Universal Roadmap (From ROADMAP.md)

**v0.2.0** (Next Release):
- Router fallback model translation
- Hybrid model mapping strategies
- Pattern-based matching

**v0.3.0** (Advanced Features):
- Capability-based model matching
- Cost optimization enhancements
- Automatic equivalent model finding

**v0.4.0** (Developer Experience):
- Mock adapters for testing
- Enhanced debugging tools
- Interactive examples

**v1.0.0** (Production Ready):
- >90% test coverage
- Performance optimizations (<50KB bundle, <5ms overhead)
- Official CLI tool
- VSCode extension

**Post-1.0**:
- More providers (Cohere, AI21, Hugging Face, etc.)
- Request batching
- Redis caching
- LangChain/LlamaIndex adapters
- Enterprise features (multi-tenancy, audit logging)

---

## 22. Conclusion

**Token.js** and **AI Matey Universal** solve the same core problem (multi-provider LLM integration) but target different use cases:

- **Token.js**: Lightweight, client-side SDK for developers who want quick OpenAI-compatible access to many providers. Best for prototypes, small projects, and client-side apps.

- **AI Matey Universal**: Enterprise-grade adapter system with bidirectional translation, intelligent routing, middleware, and server-side support. Best for production systems, API gateways, and complex orchestration scenarios.

**Neither is objectively "better"** - they optimize for different goals:
- Token.js optimizes for **simplicity and breadth**
- AI Matey Universal optimizes for **power and flexibility**

For most greenfield enterprise projects requiring production LLM infrastructure, **AI Matey Universal** provides significantly more value through its routing, fallback, observability, and server-side features. For quick prototypes or simple client-side integrations, **Token.js** may be faster to implement.

The ideal solution might be to use **token.js** for client-side code and **ai.matey.universal** for backend infrastructure, combining the simplicity of the former with the power of the latter.

---

## Appendix: Key Technical Differentiators

### 1. Bidirectional Translation
- **Token.js**: One-way (OpenAI → Provider)
- **AI Matey Universal**: Two-way (Any Format → IR → Provider → IR → Original Format)

### 2. Intermediate Representation
- **Token.js**: None (direct translation)
- **AI Matey Universal**: Universal IR with rich metadata

### 3. Provider Agnosticism
- **Token.js**: OpenAI format only
- **AI Matey Universal**: 6 frontend formats, completely agnostic

### 4. Orchestration
- **Token.js**: None
- **AI Matey Universal**: Router with 7 strategies, circuit breaker, health checks

### 5. Observability
- **Token.js**: Minimal
- **AI Matey Universal**: Full provenance, warnings, statistics, P50/P95/P99 metrics

### 6. Server-Side
- **Token.js**: Client-only
- **AI Matey Universal**: 6 HTTP framework adapters with full features

### 7. Middleware
- **Token.js**: None
- **AI Matey Universal**: Extensible pipeline with 5 built-in middlewares

These differentiators make **AI Matey Universal** significantly more suitable for enterprise production systems, while **Token.js** remains excellent for simpler use cases.
