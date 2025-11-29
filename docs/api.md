# API Reference

Complete API reference for ai.matey - Universal AI Adapter System.

## Table of Contents

- [Core Components](#core-components)
  - [Bridge](#bridge)
  - [Router](#router)
  - [MiddlewareStack](#middlewarestack)
- [Adapters](#adapters)
  - [Frontend Adapters](#frontend-adapters)
  - [Backend Adapters](#backend-adapters)
- [Middleware](#middleware)
  - [Logging](#logging-middleware)
  - [Telemetry](#telemetry-middleware)
  - [Caching](#caching-middleware)
  - [Retry](#retry-middleware)
  - [Transform](#transform-middleware)
  - [Security](#security-middleware)
  - [Cost Tracking](#cost-tracking-middleware)
  - [Validation](#validation-middleware)
- [HTTP Integration](#http-integration)
  - [Framework Support](#framework-support)
  - [Configuration](#http-configuration)
  - [Examples](#http-examples)
- [Wrappers](#wrappers)
  - [OpenAI SDK](#openai-sdk-wrapper)
  - [Anthropic SDK](#anthropic-sdk-wrapper)
  - [Chrome AI](#chrome-ai-wrapper)
- [Types](#types)
  - [Intermediate Representation (IR)](#intermediate-representation-ir)
  - [Streaming](#streaming)
  - [Errors](#errors)
- [Utilities](#utilities)
- [Complete Export Reference](#complete-export-reference)

---

## Core Components

### Bridge

The `Bridge` connects a frontend adapter (input format) to a backend adapter (execution provider).

#### Constructor

```typescript
new Bridge(frontend: FrontendAdapter, backend: BackendAdapter, config?: BridgeConfig)
```

**Parameters:**
- `frontend` - Frontend adapter that parses incoming requests
- `backend` - Backend adapter that executes requests on a provider
- `config` (optional) - Bridge configuration

**Config Options:**
```typescript
interface BridgeConfig {
  middleware?: Middleware[];
  streamingMiddleware?: StreamingMiddleware[];
  streaming?: StreamingConfig;
  defaultTimeout?: number;
  maxRetries?: number;
}
```

#### Methods

##### `chat(request, options?)`

Execute a chat completion request.

```typescript
async chat(
  request: FrontendRequest,
  options?: RequestOptions
): Promise<FrontendResponse>
```

**Parameters:**
- `request` - Request in frontend adapter's format
- `options` (optional) - Request-specific options

**Returns:** Response in frontend adapter's format

**Example:**
```typescript
const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({ apiKey: 'sk-...' })
);

const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

##### `chatStream(request, options?)`

Execute a streaming chat completion request.

```typescript
async chatStream(
  request: FrontendRequest,
  options?: RequestOptions
): Promise<AsyncIterable<FrontendStreamChunk>>
```

**Parameters:**
- `request` - Request in frontend adapter's format
- `options` (optional) - Request-specific options

**Returns:** Async iterable of stream chunks in frontend adapter's format

**Example:**
```typescript
const stream = await bridge.chatStream({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
  stream: true
});

for await (const chunk of stream) {
  console.log(chunk);
}
```

##### `getStats()`

Get bridge statistics.

```typescript
getStats(): BridgeStats
```

**Returns:**
```typescript
interface BridgeStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  lastRequestTime?: number;
}
```

##### `on(event, listener)`

Add event listener.

```typescript
on(event: BridgeEventType, listener: BridgeEventListener): void
```

**Event Types:**
- `'request:start'` - Request started
- `'request:end'` - Request completed
- `'request:error'` - Request failed
- `'stream:start'` - Stream started
- `'stream:chunk'` - Stream chunk received
- `'stream:end'` - Stream completed
- `'stream:error'` - Stream failed
- `'backend:switch'` - Backend switched (router only)
- `'middleware:before'` - Before middleware execution
- `'middleware:after'` - After middleware execution

**Example:**
```typescript
bridge.on('request:start', (event) => {
  console.log('Request started:', event.request);
});

bridge.on('request:error', (event) => {
  console.error('Request failed:', event.error);
});
```

##### `off(event, listener)`

Remove event listener.

```typescript
off(event: BridgeEventType, listener: BridgeEventListener): void
```

##### `use(middleware)`

Add middleware to the bridge.

```typescript
use(middleware: Middleware | StreamingMiddleware): Bridge
```

**Returns:** The bridge instance (for chaining)

**Example:**
```typescript
bridge
  .use(createLoggingMiddleware({ level: 'info' }))
  .use(createRetryMiddleware({ maxRetries: 3 }))
  .use(createCachingMiddleware({ ttl: 3600 }));
```

#### Factory Function

```typescript
createBridge(frontend: FrontendAdapter, backend: BackendAdapter, config?: BridgeConfig): Bridge
```

Convenience function for creating bridges.

**Example:**
```typescript
import { createBridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';

const bridge = createBridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({ apiKey: 'sk-...' })
);
```

---

### Router

The `Router` manages multiple backend adapters with routing, fallback, and parallel dispatch.

#### Constructor

```typescript
new Router(frontend: FrontendAdapter, config: RouterConfig)
```

**Parameters:**
- `frontend` - Frontend adapter
- `config` - Router configuration

**Config Options:**
```typescript
interface RouterConfig {
  backends: BackendAdapter[];
  strategy?: RoutingStrategy;
  fallbackStrategy?: FallbackStrategy;
  customRoute?: CustomRoutingFunction;
  customFallback?: CustomFallbackFunction;
  modelMappings?: ModelMapping[];
  healthCheckInterval?: number;
  middleware?: Middleware[];
  streamingMiddleware?: StreamingMiddleware[];
}
```

**Routing Strategies:**
- `'round-robin'` - Cycle through backends
- `'random'` - Random selection
- `'priority'` - Use first available backend
- `'model-based'` - Route based on model name
- `'custom'` - Custom routing function

**Fallback Strategies:**
- `'none'` - No fallback, fail on error
- `'next'` - Try next backend in list
- `'all'` - Try all backends until success
- `'custom'` - Custom fallback function

#### Methods

##### `chat(request, options?)`

Execute a chat completion request with routing.

```typescript
async chat(
  request: FrontendRequest,
  options?: RequestOptions
): Promise<FrontendResponse>
```

##### `chatStream(request, options?)`

Execute a streaming chat completion request with routing.

```typescript
async chatStream(
  request: FrontendRequest,
  options?: RequestOptions
): Promise<AsyncIterable<FrontendStreamChunk>>
```

##### `dispatchParallel(request, options?)`

Dispatch request to multiple backends in parallel.

```typescript
async dispatchParallel(
  request: FrontendRequest,
  options?: ParallelDispatchOptions
): Promise<ParallelDispatchResult>
```

**Options:**
```typescript
interface ParallelDispatchOptions {
  backends?: string[];  // Backend IDs to use
  timeout?: number;
  aggregate?: 'first' | 'all' | 'fastest';
}
```

**Returns:**
```typescript
interface ParallelDispatchResult {
  responses: Map<string, FrontendResponse>;
  errors: Map<string, Error>;
  fastest?: string;  // Backend ID of fastest response
  timing: Map<string, number>;
}
```

##### `getStats()`

Get router statistics.

```typescript
getStats(): RouterStats
```

**Returns:**
```typescript
interface RouterStats {
  totalRequests: number;
  backendStats: Map<string, BackendStats>;
  routingDecisions: Map<string, number>;
  fallbackCount: number;
}
```

##### `getBackendHealth(backendId?)`

Get backend health status.

```typescript
getBackendHealth(backendId?: string): BackendInfo | Map<string, BackendInfo>
```

#### Factory Function

```typescript
createRouter(frontend: FrontendAdapter, config: RouterConfig): Router
```

**Example:**
```typescript
import { createRouter } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';

const router = createRouter(
  new OpenAIFrontendAdapter(),
  {
    backends: [
      new AnthropicBackendAdapter({ apiKey: 'sk-ant-...' }),
      new OpenAIBackendAdapter({ apiKey: 'sk-...' })
    ],
    strategy: 'round-robin',
    fallbackStrategy: 'next'
  }
);
```

---

### MiddlewareStack

Internal component for managing middleware chains. Generally not used directly.

#### Methods

##### `execute(context, next)`

Execute middleware chain.

```typescript
async execute(
  context: MiddlewareContext,
  next: MiddlewareNext
): Promise<void>
```

##### `executeStreaming(context, next)`

Execute streaming middleware chain.

```typescript
async executeStreaming(
  context: StreamingMiddlewareContext,
  next: StreamingMiddlewareNext
): Promise<void>
```

---

## Adapters

### Frontend Adapters

Frontend adapters parse incoming requests and format outgoing responses.

#### AnthropicFrontendAdapter

```typescript
import { AnthropicFrontendAdapter } from 'ai.matey.frontend/anthropic';

const adapter = new AnthropicFrontendAdapter();
```

**Request Format:**
```typescript
interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  tools?: AnthropicTool[];
}
```

**Response Format:**
```typescript
interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
```

#### OpenAIFrontendAdapter

```typescript
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';

const adapter = new OpenAIFrontendAdapter();
```

**Request Format:**
```typescript
interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: OpenAITool[];
}
```

#### GeminiFrontendAdapter

```typescript
import { GeminiFrontendAdapter } from 'ai.matey.frontend/gemini';

const adapter = new GeminiFrontendAdapter();
```

#### OllamaFrontendAdapter

```typescript
import { OllamaFrontendAdapter } from 'ai.matey.frontend/ollama';

const adapter = new OllamaFrontendAdapter();
```

#### MistralFrontendAdapter

```typescript
import { MistralFrontendAdapter } from 'ai.matey.frontend/mistral';

const adapter = new MistralFrontendAdapter();
```

#### ChromeAIFrontendAdapter

```typescript
import { ChromeAIFrontendAdapter } from 'ai.matey.frontend/chrome-ai';

const adapter = new ChromeAIFrontendAdapter();
```

### Backend Adapters

Backend adapters execute requests on AI providers.

#### AnthropicBackendAdapter

```typescript
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';

const adapter = new AnthropicBackendAdapter({
  apiKey: 'sk-ant-...',
  baseURL?: 'https://api.anthropic.com',
  defaultModel?: 'claude-3-5-sonnet-20241022',
  timeout?: 60000,
  maxRetries?: 3
});
```

**Config:**
```typescript
interface BackendAdapterConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}
```

#### OpenAIBackendAdapter

```typescript
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';

const adapter = new OpenAIBackendAdapter({
  apiKey: 'sk-...',
  baseURL?: 'https://api.openai.com/v1',
  defaultModel?: 'gpt-4',
  organization?: 'org-...'
});
```

#### Other Backend Adapters

- `GeminiBackendAdapter` - Google Gemini
- `OllamaBackendAdapter` - Ollama (local models)
- `MistralBackendAdapter` - Mistral AI
- `ChromeAIBackendAdapter` - Chrome AI (Gemini Nano)
- `DeepSeekBackendAdapter` - DeepSeek AI
- `GroqBackendAdapter` - Groq (ultra-fast inference)
- `LMStudioBackendAdapter` - LM Studio (local)
- `HuggingFaceBackendAdapter` - Hugging Face Inference API
- `NVIDIABackendAdapter` - NVIDIA NIM
- `MockBackendAdapter` - Testing backend

**Native Backends (Node.js only):**
```typescript
import {
  NodeLlamaCppBackend,
  AppleBackend,
} from 'ai.matey.native.node-llamacpp';
```

---

## Middleware

### Logging Middleware

```typescript
import { createLoggingMiddleware } from 'ai.matey';

const middleware = createLoggingMiddleware({
  level?: 'debug' | 'info' | 'warn' | 'error',
  logger?: CustomLogger,
  logRequests?: boolean,
  logResponses?: boolean,
  logErrors?: boolean,
  redactFields?: string[]
});
```

**Options:**
- `level` - Minimum log level (default: `'info'`)
- `logger` - Custom logger implementation (default: console)
- `logRequests` - Log incoming requests (default: `true`)
- `logResponses` - Log outgoing responses (default: `true`)
- `logErrors` - Log errors (default: `true`)
- `redactFields` - Fields to redact in logs (default: `['apiKey', 'api_key']`)

**Example:**
```typescript
const loggingMiddleware = createLoggingMiddleware({
  level: 'info',
  redactFields: ['apiKey', 'password', 'token']
});

bridge.use(loggingMiddleware);
```

### Telemetry Middleware

```typescript
import { createTelemetryMiddleware, ConsoleTelemetrySink, InMemoryTelemetrySink } from 'ai.matey';

const middleware = createTelemetryMiddleware({
  sink?: TelemetrySink,
  metrics?: string[],
  events?: string[]
});
```

**Built-in Sinks:**
- `ConsoleTelemetrySink` - Logs to console
- `InMemoryTelemetrySink` - Stores in memory for testing

**Custom Sink:**
```typescript
interface TelemetrySink {
  recordMetric(name: string, value: number, tags?: Record<string, string>): void;
  recordEvent(name: string, data?: Record<string, any>): void;
}
```

**Example:**
```typescript
const telemetry = createTelemetryMiddleware({
  sink: new ConsoleTelemetrySink()
});

bridge.use(telemetry);
```

### Caching Middleware

```typescript
import { createCachingMiddleware, InMemoryCacheStorage } from 'ai.matey';

const middleware = createCachingMiddleware({
  storage?: CacheStorage,
  ttl?: number,
  keyGenerator?: (request: IRChatRequest) => string,
  shouldCache?: (request: IRChatRequest) => boolean
});
```

**Options:**
- `storage` - Cache storage implementation (default: `InMemoryCacheStorage`)
- `ttl` - Time to live in seconds (default: `3600`)
- `keyGenerator` - Custom cache key function
- `shouldCache` - Predicate to determine if request should be cached

**Custom Storage:**
```typescript
interface CacheStorage {
  get(key: string): Promise<IRChatResponse | null>;
  set(key: string, value: IRChatResponse, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

**Example:**
```typescript
const caching = createCachingMiddleware({
  ttl: 3600,
  shouldCache: (request) => !request.stream
});

bridge.use(caching);
```

### Retry Middleware

```typescript
import { createRetryMiddleware } from 'ai.matey';

const middleware = createRetryMiddleware({
  maxRetries?: number,
  initialDelay?: number,
  maxDelay?: number,
  backoffMultiplier?: number,
  shouldRetry?: (error: Error, attempt: number) => boolean,
  onRetry?: (error: Error, attempt: number) => void
});
```

**Options:**
- `maxRetries` - Maximum retry attempts (default: `3`)
- `initialDelay` - Initial delay in ms (default: `1000`)
- `maxDelay` - Maximum delay in ms (default: `30000`)
- `backoffMultiplier` - Exponential backoff multiplier (default: `2`)
- `shouldRetry` - Custom retry predicate
- `onRetry` - Callback on retry

**Built-in Predicates:**
```typescript
import { isRateLimitError, isNetworkError, isServerError, createRetryPredicate } from 'ai.matey';

const shouldRetry = createRetryPredicate([
  isRateLimitError,
  isNetworkError,
  isServerError
]);
```

**Example:**
```typescript
const retry = createRetryMiddleware({
  maxRetries: 3,
  shouldRetry: (error) => isRateLimitError(error) || isNetworkError(error)
});

bridge.use(retry);
```

### Transform Middleware

```typescript
import { createTransformMiddleware } from 'ai.matey';

const middleware = createTransformMiddleware({
  transformRequest?: RequestTransformer,
  transformResponse?: ResponseTransformer,
  transformMessages?: MessageTransformer
});
```

**Transformers:**
```typescript
type RequestTransformer = (request: IRChatRequest) => IRChatRequest | Promise<IRChatRequest>;
type ResponseTransformer = (response: IRChatResponse) => IRChatResponse | Promise<IRChatResponse>;
type MessageTransformer = (message: IRMessage) => IRMessage | Promise<IRMessage>;
```

**Built-in Transformers:**
```typescript
import {
  createPromptRewriter,
  createParameterModifier,
  createResponseFilter,
  createSystemMessageInjector,
  createMessageFilter,
  createContentSanitizer,
  composeRequestTransformers,
  composeResponseTransformers
} from 'ai.matey';
```

**Example:**
```typescript
const transform = createTransformMiddleware({
  transformRequest: createSystemMessageInjector(
    'You are a helpful assistant. Always be concise.'
  ),
  transformResponse: createResponseFilter((response) => {
    // Filter or modify response
    return response;
  })
});

bridge.use(transform);
```

### Security Middleware

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

### Cost Tracking Middleware

```typescript
import { createCostTrackingMiddleware, getCostStats, InMemoryCostStorage } from 'ai.matey';

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

### Validation Middleware

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

---

## HTTP Integration

ai.matey provides HTTP server integration for multiple frameworks, allowing you to create OpenAI-compatible API endpoints.

### Framework Support

| Framework | Import Path | Best For |
|-----------|-------------|----------|
| Node.js | `ai.matey/http/node` | Microservices, minimal deps |
| Express | `ai.matey/http/express` | Traditional web apps, REST APIs |
| Fastify | `ai.matey/http/fastify` | High-performance production APIs |
| Koa | `ai.matey/http/koa` | Modern middleware architecture |
| Hono | `ai.matey/http/hono` | Edge computing, serverless |
| Deno | `ai.matey/http/deno` | Deno runtime |

### HTTP Configuration

```typescript
interface HTTPListenerOptions {
  cors?: boolean | CORSOptions;
  streaming?: boolean;
  validateAuth?: AuthValidator;
  onError?: ErrorHandler;
  rateLimit?: RateLimitOptions;
  routes?: RouteConfig[];
  pathPrefix?: string;
  headers?: Record<string, string>;
  timeout?: number;
  maxBodySize?: number;
  logging?: boolean;
}

interface CORSOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: RateLimitKeyGenerator;
  handler?: RateLimitHandler;
}
```

### HTTP Examples

#### Node.js HTTP Server

```typescript
import { createServer } from 'http';
import { NodeHTTPListener } from 'ai.matey.http';
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
);

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

#### Express

```typescript
import express from 'express';
import { ExpressMiddleware } from 'ai.matey.http/express';

const app = express();
app.use(express.json());
app.use('/v1/messages', ExpressMiddleware(bridge, {
  cors: true,
  streaming: true
}));
app.listen(3000);
```

#### Koa

```typescript
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { KoaMiddleware } from 'ai.matey.http/koa';

const app = new Koa();
app.use(bodyParser());
app.use(KoaMiddleware(bridge, {
  cors: true,
  streaming: true
}));
app.listen(3000);
```

#### Hono (Edge/Serverless)

```typescript
import { Hono } from 'hono';
import { HonoMiddleware } from 'ai.matey.http/hono';

const app = new Hono();
app.post('/v1/messages', HonoMiddleware(bridge, {
  cors: true,
  streaming: true
}));
export default app;
```

#### Fastify

```typescript
import Fastify from 'fastify';
import { FastifyHandler } from 'ai.matey.http/fastify';

const fastify = Fastify();
fastify.post('/v1/messages', FastifyHandler(bridge, {
  cors: true,
  streaming: true
}));
fastify.listen({ port: 3000 });
```

#### Deno

```typescript
import { DenoHandler } from 'ai.matey.http/deno';

const handler = DenoHandler(bridge, {
  cors: true,
  streaming: true
});

Deno.serve({ port: 8080 }, handler);
```

### Testing HTTP Endpoints

```bash
# Test with curl
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Features

- **OpenAI-Compatible API** - Works with OpenAI SDKs and tools
- **Streaming Support** - Server-Sent Events (SSE) for real-time responses
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - Request throttling
- **Authentication** - Custom auth validators
- **Error Handling** - Consistent error responses
- **Multiple Backends** - Route to different AI providers

---

## Wrappers

### OpenAI SDK Wrapper

Drop-in replacement for OpenAI SDK that uses ai.matey bridges.

```typescript
import { OpenAI } from 'ai.matey.wrapper';

const client = new OpenAI({
  bridge: myBridge,  // Use any backend
  apiKey: 'unused'   // Not used, bridge handles auth
});

const completion = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Anthropic SDK Wrapper

Drop-in replacement for Anthropic SDK.

```typescript
import { Anthropic } from 'ai.matey.wrapper';

const client = new Anthropic({
  bridge: myBridge,
  apiKey: 'unused'
});

const message = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Chrome AI Wrapper

Wrapper for Chrome's built-in AI API.

```typescript
import { createChromeAILanguageModel } from 'ai.matey.wrapper/chrome-ai';

const model = await createChromeAILanguageModel({
  temperature: 0.7,
  topK: 40
});

const response = await model.prompt('Hello!');
```

---

## Types

### Intermediate Representation (IR)

The internal format used between adapters. For complete documentation, see [IR Format Guide](./IR-FORMAT.md).

#### IRMessage

```typescript
interface IRMessage {
  readonly role: MessageRole;
  readonly content: string | readonly MessageContent[];
  readonly name?: string;
  readonly metadata?: Record<string, unknown>;
}

type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

type MessageContent =
  | TextContent
  | ImageContent
  | ToolUseContent
  | ToolResultContent;

interface TextContent {
  readonly type: 'text';
  readonly text: string;
}

interface ImageContent {
  readonly type: 'image';
  readonly source:
    | {
        readonly type: 'url';
        readonly url: string;
      }
    | {
        readonly type: 'base64';
        readonly mediaType: string;
        readonly data: string;
      };
}

interface ToolUseContent {
  readonly type: 'tool_use';
  readonly id: string;
  readonly name: string;
  readonly input: Record<string, unknown>;
}

interface ToolResultContent {
  readonly type: 'tool_result';
  readonly toolUseId: string;
  readonly content: string | TextContent[];
  readonly isError?: boolean;
}
```

#### IRChatRequest

```typescript
interface IRChatRequest {
  readonly messages: readonly IRMessage[];
  readonly tools?: readonly IRTool[];
  readonly toolChoice?: 'auto' | 'required' | 'none' | { readonly name: string };
  readonly parameters?: IRParameters;
  readonly metadata: IRMetadata;
  readonly stream?: boolean;
  readonly streamMode?: StreamMode;  // 'delta' | 'accumulated'
}

interface IRParameters {
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly topP?: number;
  readonly topK?: number;
  readonly frequencyPenalty?: number;
  readonly presencePenalty?: number;
  readonly stopSequences?: readonly string[];
  readonly seed?: number;
  readonly user?: string;
  readonly custom?: Record<string, unknown>;
}

interface IRMetadata {
  readonly requestId: string;
  readonly providerResponseId?: string;
  readonly timestamp: number;
  readonly provenance?: IRProvenance;
  readonly warnings?: readonly IRWarning[];
  readonly custom?: Record<string, unknown>;
}
```

#### IRChatResponse

```typescript
interface IRChatResponse {
  readonly message: IRMessage;
  readonly finishReason: FinishReason;
  readonly usage?: IRUsage;
  readonly metadata: IRMetadata;
  readonly raw?: Record<string, unknown>;
}

type FinishReason =
  | 'stop'
  | 'length'
  | 'tool_calls'
  | 'content_filter'
  | 'error'
  | 'cancelled';

interface IRUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly details?: Record<string, unknown>;
}
```

### Streaming

#### IRStreamChunk

```typescript
type IRStreamChunk =
  | StreamStartChunk
  | StreamContentChunk
  | StreamToolUseChunk
  | StreamMetadataChunk
  | StreamDoneChunk
  | StreamErrorChunk;

interface StreamStartChunk {
  readonly type: 'start';
  readonly sequence: number;
  readonly metadata: IRMetadata;
}

interface StreamContentChunk {
  readonly type: 'content';
  readonly sequence: number;
  readonly delta: string;           // Always present
  readonly accumulated?: string;    // Optional (accumulated mode)
  readonly role?: 'assistant';
}

interface StreamToolUseChunk {
  readonly type: 'tool_use';
  readonly sequence: number;
  readonly id: string;
  readonly name: string;
  readonly inputDelta?: string;
}

interface StreamMetadataChunk {
  readonly type: 'metadata';
  readonly sequence: number;
  readonly usage?: Partial<IRUsage>;
  readonly metadata?: Partial<IRMetadata>;
}

interface StreamDoneChunk {
  readonly type: 'done';
  readonly sequence: number;
  readonly finishReason: FinishReason;
  readonly usage?: IRUsage;
  readonly message?: IRMessage;
}

interface StreamErrorChunk {
  readonly type: 'error';
  readonly sequence: number;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
}
```

### Errors

```typescript
import {
  AdapterError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ValidationError,
  ProviderError,
  NetworkError,
  StreamError,
  RouterError,
  MiddlewareError
} from 'ai.matey';
```

**Error Hierarchy:**
```
AdapterError (base)
├── AuthenticationError
├── AuthorizationError
├── RateLimitError
├── ValidationError
├── ProviderError
├── AdapterConversionError
├── NetworkError
├── StreamError
├── RouterError
└── MiddlewareError
```

**Error Properties:**
```typescript
interface AdapterError extends Error {
  code: ErrorCode;
  category: ErrorCategory;
  statusCode?: number;
  provenance?: ErrorProvenance;
  retryable?: boolean;
  details?: any;
}
```

---

## Utilities

### Validation

```typescript
import {
  validateMessage,
  validateMessages,
  validateTemperature,
  validateMaxTokens,
  validateTopP,
  validateParameters,
  validateIRChatRequest
} from 'ai.matey';

// Throws ValidationError if invalid
validateIRChatRequest(request);
```

### System Messages

```typescript
import {
  extractSystemMessages,
  combineSystemMessages,
  normalizeSystemMessages,
  addSystemMessage,
  hasSystemMessages
} from 'ai.matey';

const messages = [
  { role: 'system', content: [{ type: 'text', text: 'You are helpful.' }] },
  { role: 'user', content: [{ type: 'text', text: 'Hello!' }] }
];

const systemMessages = extractSystemMessages(messages);
const combined = combineSystemMessages(systemMessages);
```

### Parameter Normalization

```typescript
import {
  normalizeTemperature,
  normalizeTopP,
  normalizeTopK,
  normalizePenalty,
  normalizeStopSequences,
  sanitizeParameters
} from 'ai.matey';

const params = sanitizeParameters({
  temperature: 0.7,
  max_tokens: 1000,
  top_p: 0.9
});
```

### Streaming Utilities

```typescript
import {
  createStreamAccumulator,
  accumulateChunk,
  accumulatorToMessage,
  streamToResponse,
  streamToText,
  transformStream,
  filterStream,
  mapStream,
  collectStream
} from 'ai.matey';

// Accumulate stream into response
const accumulator = createStreamAccumulator();
for await (const chunk of stream) {
  accumulateChunk(accumulator, chunk);
}
const response = accumulatorToResponse(accumulator);

// Transform stream
const transformed = transformStream(stream, (chunk) => {
  // Modify chunk
  return chunk;
});

// Collect all chunks
const chunks = await collectStream(stream);

// Get text only
const text = await streamToText(stream);
```

### Request Parsing (HTTP)

```typescript
import {
  parseRequest,
  extractBearerToken,
  getClientIP
} from 'ai.matey.http';

const parsed = await parseRequest(req);
const token = extractBearerToken(req);
const ip = getClientIP(req);
```

### Response Formatting (HTTP)

```typescript
import {
  sendJSON,
  sendError,
  sendSSEChunk,
  sendText
} from 'ai.matey.http';

sendJSON(res, { data: 'value' }, 200);
sendError(res, new Error('Failed'), 500);
sendSSEChunk(res, chunk);
```

### Authentication (HTTP)

```typescript
import {
  createBearerTokenValidator,
  createAPIKeyValidator,
  createBasicAuthValidator,
  combineAuthValidators
} from 'ai.matey.http';

const authValidator = combineAuthValidators([
  createBearerTokenValidator(['token1', 'token2']),
  createAPIKeyValidator(['key1', 'key2'])
]);
```

### Rate Limiting (HTTP)

```typescript
import {
  RateLimiter,
  userIDKeyGenerator,
  tokenKeyGenerator,
  combineKeyGenerators
} from 'ai.matey.http';

const limiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 100
});

const keyGen = combineKeyGenerators([
  userIDKeyGenerator,
  tokenKeyGenerator
]);
```

---

## Complete Export Reference

### Main Package Exports

Import from the main package:

```typescript
import { Bridge, createBridge, OpenAIBackendAdapter } from 'ai.matey';
```

#### Core Components
- `Bridge`, `createBridge`
- `Router`, `createRouter`
- `MiddlewareStack`, `createMiddlewareContext`, `createStreamingMiddlewareContext`

#### Frontend Adapters
- `AnthropicFrontendAdapter` - Anthropic Messages API format
- `OpenAIFrontendAdapter` - OpenAI Chat Completions API format
- `GeminiFrontendAdapter` - Google Gemini API format
- `OllamaFrontendAdapter` - Ollama API format
- `MistralFrontendAdapter` - Mistral API format
- `ChromeAIFrontendAdapter` - Chrome AI API format

#### Backend Adapters

**Major Providers:**
- `AnthropicBackendAdapter` - Claude (Anthropic)
- `OpenAIBackendAdapter` - GPT models (OpenAI)
- `GeminiBackendAdapter` - Gemini (Google)
- `MistralBackendAdapter` - Mistral AI
- `OllamaBackendAdapter` - Ollama (local models)
- `ChromeAIBackendAdapter` - Chrome AI (Gemini Nano)

**Additional Providers:**
- `DeepSeekBackendAdapter`, `createDeepSeekAdapter` - DeepSeek AI
- `GroqBackendAdapter`, `createGroqAdapter` - Groq (ultra-fast inference)
- `LMStudioBackendAdapter`, `createLMStudioAdapter` - LM Studio (local)
- `HuggingFaceBackendAdapter`, `createHuggingFaceAdapter` - Hugging Face Inference API
- `NVIDIABackendAdapter`, `createNVIDIAAdapter` - NVIDIA NIM

**Testing:**
- `MockBackendAdapter`, `createEchoBackend`, `createErrorBackend`, `createDelayedBackend`

**Native Backends (Node.js only):**
```typescript
import { NodeLlamaCppBackend, AppleBackend } from 'ai.matey.native.node-llamacpp';
```

#### Middleware

**Logging:**
```typescript
import { createLoggingMiddleware } from 'ai.matey.middleware/logging';
```

**Telemetry:**
```typescript
import {
  createTelemetryMiddleware,
  ConsoleTelemetrySink,
  InMemoryTelemetrySink,
  MetricNames,
  EventNames,
} from 'ai.matey.middleware/telemetry';
```

**Caching:**
```typescript
import {
  createCachingMiddleware,
  InMemoryCacheStorage,
} from 'ai.matey.middleware/caching';
```

**Retry:**
```typescript
import {
  createRetryMiddleware,
  isRateLimitError,
  isNetworkError,
  isServerError,
  createRetryPredicate,
} from 'ai.matey.middleware/retry';
```

**Transform:**
```typescript
import {
  createTransformMiddleware,
  createPromptRewriter,
  createParameterModifier,
  createResponseFilter,
  createSystemMessageInjector,
  createMessageFilter,
  createContentSanitizer,
  composeRequestTransformers,
  composeResponseTransformers,
  composeMessageTransformers,
} from 'ai.matey.middleware/transform';
```

**Security:**
```typescript
import {
  createSecurityMiddleware,
  createProductionSecurityMiddleware,
  createDevelopmentSecurityMiddleware,
  DEFAULT_SECURITY_CONFIG,
} from 'ai.matey.middleware/security';
```

**Cost Tracking:**
```typescript
import {
  createCostTrackingMiddleware,
  createStreamingCostTrackingMiddleware,
  InMemoryCostStorage,
  calculateCost,
  getCostStats,
  DEFAULT_PRICING,
} from 'ai.matey.middleware/cost-tracking';
```

**Validation & Sanitization:**
```typescript
import {
  createValidationMiddleware,
  createProductionValidationMiddleware,
  createDevelopmentValidationMiddleware,
  detectPII,
  redactPII,
  detectPromptInjection,
  sanitizeText,
  validateRequest,
  sanitizeRequest,
  ValidationError as MiddlewareValidationError,
  DEFAULT_PII_PATTERNS,
  DEFAULT_INJECTION_PATTERNS,
} from 'ai.matey.middleware/validation';
```

#### Wrappers

**Chrome AI (Current API):**
```typescript
import {
  ChromeAILanguageModel,
  createChromeAILanguageModel,
} from 'ai.matey';
```

**Chrome AI (Legacy API):**
```typescript
import {
  LegacyChromeAILanguageModel,
  createLegacyWindowAI,
  polyfillLegacyWindowAI,
} from 'ai.matey';
```

**OpenAI SDK:**
```typescript
import {
  OpenAI,
  OpenAIClient,
  Chat,
  ChatCompletions,
} from 'ai.matey';
```

**Anthropic SDK:**
```typescript
import {
  Anthropic,
  AnthropicClient,
  Messages,
} from 'ai.matey';
```

#### Utilities

**Validation:**
```typescript
import {
  isValidMessageRole,
  validateMessageContent,
  validateMessage,
  validateMessages,
  validateTemperature,
  validateMaxTokens,
  validateTopP,
  validateParameters,
  validateIRChatRequest,
} from 'ai.matey';
```

**System Messages:**
```typescript
import {
  extractSystemMessages,
  combineSystemMessages,
  getFirstSystemMessage,
  normalizeSystemMessages,
  addSystemMessage,
  hasSystemMessages,
  countSystemMessages,
} from 'ai.matey';
```

**Parameter Normalization:**
```typescript
import {
  normalizeTemperature,
  denormalizeTemperature,
  normalizeTopP,
  normalizeTopK,
  normalizePenalty,
  normalizeStopSequences,
  filterUnsupportedParameters,
  applyParameterDefaults,
  mergeParameters,
  clampParameter,
  sanitizeParameters,
  areParametersValid,
} from 'ai.matey';
```

**Streaming:**
```typescript
import {
  createStreamAccumulator,
  accumulateChunk,
  accumulatorToMessage,
  accumulatorToResponse,
  transformStream,
  filterStream,
  mapStream,
  tapStream,
  collectStream,
  streamToResponse,
  streamToText,
  splitStream,
  catchStreamErrors,
  streamWithTimeout,
  isContentChunk,
  isDoneChunk,
  getContentDeltas,
} from 'ai.matey';
```

#### Error Classes

```typescript
import {
  AdapterError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ValidationError,
  ProviderError,
  AdapterConversionError,
  NetworkError,
  StreamError,
  RouterError,
  MiddlewareError,
  createErrorFromHttpResponse,
  createErrorFromProviderError,
  ErrorCodeEnum,
  ErrorCategoryEnum,
  ERROR_CODE_CATEGORIES,
} from 'ai.matey';
```

#### Constants

```typescript
import {
  FallbackStrategy,
  RoutingStrategy,
  ParallelStrategy,
  BridgeEventType,
  DEFAULT_STREAMING_CONFIG,
} from 'ai.matey';
```

### Subpath Exports

Import from specific subpaths for better tree-shaking and organization:

#### Types Only

```typescript
import type { IRChatRequest, IRChatResponse } from 'ai.matey.types';
```

#### Errors Only

```typescript
import { AdapterError, NetworkError } from 'ai.matey.errors';
```

#### Utilities Only

```typescript
import { validateMessage, normalizeTemperature } from 'ai.matey.utils';
```

#### Middleware Only

```typescript
import {
  createLoggingMiddleware,
  createCostTrackingMiddleware,
  createValidationMiddleware,
} from 'ai.matey.middleware';
```

#### Wrappers Only

```typescript
import {
  ChromeAILanguageModel,
  LegacyChromeAILanguageModel,
  OpenAI,
  Anthropic,
} from 'ai.matey.wrapper';
```

#### Frontend Adapters Only

```typescript
import {
  AnthropicFrontendAdapter,
  OpenAIFrontendAdapter,
} from 'ai.matey.frontend';
```

#### Backend Adapters Only

```typescript
import {
  AnthropicBackendAdapter,
  OpenAIBackendAdapter,
  DeepSeekBackendAdapter,
  GroqBackendAdapter,
} from 'ai.matey.backend';
```

#### HTTP Utilities

```typescript
import { NodeHTTPListener } from 'ai.matey.http';
```

**Framework-Specific:**
```typescript
import { ExpressMiddleware } from 'ai.matey.http/express';
import { KoaMiddleware } from 'ai.matey.http/koa';
import { HonoMiddleware } from 'ai.matey.http/hono';
import { FastifyHandler } from 'ai.matey.http/fastify';
import { DenoHandler } from 'ai.matey.http/deno';
```

**HTTP Utilities:**
```typescript
import {
  parseRequest,
  sendJSON,
  sendError,
  handleCORS,
  RateLimiter,
  HealthCheck,
  createHealthCheck,
} from 'ai.matey.http';
```

### Available Import Paths

```
ai.matey                      # Main package (everything)
ai.matey/types                # TypeScript types only
ai.matey/errors               # Error classes
ai.matey/utils                # Utility functions
ai.matey/middleware           # All middleware
ai.matey/wrappers             # All wrappers
ai.matey/adapters/frontend    # Frontend adapters
ai.matey/adapters/backend     # Backend adapters
ai.matey/adapters/backend-native  # Native backends (Node.js only)
ai.matey/http                 # HTTP utilities
ai.matey/http/node            # Node.js HTTP adapter
ai.matey/http/express         # Express middleware
ai.matey/http/koa             # Koa middleware
ai.matey/http/hono            # Hono middleware
ai.matey/http/fastify         # Fastify handler
ai.matey/http/deno            # Deno handler
```

---

## See Also

- [Getting Started Guide](../README.md)
- [Feature Guides](./GUIDES.md)
- [Examples](../examples/)
- [TypeScript Type Definitions](../src/types/)
