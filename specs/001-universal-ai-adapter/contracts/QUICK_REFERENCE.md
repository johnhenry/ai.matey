# Quick Reference Guide

A concise reference for the Universal AI Adapter System contracts.

## Core Concepts

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application Code                         │
│                  (Uses provider-specific format)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼───────┐
                    │ Frontend Adapter│
                    │ (Provider → IR) │
                    └────────┬───────┘
                             │
                    ┌────────▼───────┐
                    │     Bridge      │
                    │  + Middleware   │
                    │  + Router       │
                    └────────┬───────┘
                             │
                    ┌────────▼────────┐
                    │ Backend Adapter  │
                    │ (IR → Provider)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Provider API   │
                    │ (OpenAI, etc.)  │
                    └─────────────────┘
```

## 1-Minute Setup

```typescript
import { Bridge } from 'ai.matey.core';
import { AnthropicFrontendAdapter } from 'ai.matey.frontend/anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';

// Create bridge
const bridge = new Bridge(
  new AnthropicFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: 'sk-...' })
);

// Make request
const response = await bridge.chat({
  model: 'claude-3-opus',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

## Key Interfaces

### Frontend Adapter
```typescript
interface FrontendAdapter<TRequest, TResponse, TStreamChunk> {
  metadata: AdapterMetadata;
  toIR(request: TRequest): Promise<IRChatRequest>;
  fromIR(response: IRChatResponse): Promise<TResponse>;
  fromIRStream(stream: IRChatStream): AsyncGenerator<TStreamChunk>;
}
```

### Backend Adapter
```typescript
interface BackendAdapter {
  metadata: AdapterMetadata;
  execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse>;
  executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream;
}
```

### Bridge
```typescript
interface Bridge<TFrontend extends FrontendAdapter> {
  chat(request: InferFrontendRequest<TFrontend>, options?: RequestOptions):
    Promise<InferFrontendResponse<TFrontend>>;

  chatStream(request: InferFrontendRequest<TFrontend>, options?: RequestOptions):
    AsyncGenerator<InferFrontendStreamChunk<TFrontend>>;

  use(middleware: Middleware): this;
  on(event: BridgeEventType, listener: BridgeEventListener): this;
  getStats(): BridgeStats;
}
```

### Router
```typescript
interface Router extends BackendAdapter {
  register(name: string, adapter: BackendAdapter): this;
  setFallbackChain(chain: readonly string[]): this;
  setModelMapping(mapping: ModelMapping): this;
  dispatchParallel(request: IRChatRequest, options?: ParallelDispatchOptions):
    Promise<ParallelDispatchResult>;
}
```

### Middleware
```typescript
type Middleware = (
  context: MiddlewareContext,
  next: MiddlewareNext
) => Promise<IRChatResponse>;

type MiddlewareNext = () => Promise<IRChatResponse>;
```

## Common Patterns

### Basic Chat
```typescript
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response.choices[0].message.content);
```

### Streaming
```typescript
const stream = bridge.chatStream({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }]
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0].delta.content ?? '');
}
```

### With Router
```typescript
const router = new Router()
  .register('openai', new OpenAIBackendAdapter({ apiKey: 'sk-...' }))
  .register('anthropic', new AnthropicBackendAdapter({ apiKey: 'sk-...' }))
  .setFallbackChain(['openai', 'anthropic']);

const bridge = new Bridge(frontend, router);
```

### With Middleware
```typescript
bridge
  .use(loggingMiddleware)
  .use(cachingMiddleware)
  .use(createTimingMiddleware());

const response = await bridge.chat(request);
```

### Error Handling
```typescript
try {
  const response = await bridge.chat(request);
} catch (error) {
  if (error instanceof RateLimitError) {
    await sleep(error.retryAfter);
    // retry
  } else if (error instanceof ValidationError) {
    console.error('Invalid request:', error.validationDetails);
  } else if (error instanceof AdapterError) {
    console.error(`${error.code}:`, error.message);
  }
}
```

### Parallel Dispatch
```typescript
const result = await router.dispatchParallel(request, {
  backends: ['openai', 'anthropic'],
  strategy: 'first'
});

console.log('Response from:', result.successfulBackends[0]);
```

## IR Types Cheat Sheet

### Request
```typescript
interface IRChatRequest {
  messages: IRMessage[];           // Conversation history
  parameters?: IRParameters;        // Model settings
  metadata: IRMetadata;            // Tracking info
  stream?: boolean;                // Streaming flag
}
```

### Response
```typescript
interface IRChatResponse {
  message: IRMessage;              // Generated message
  finishReason: FinishReason;      // Why it stopped
  usage?: TokenUsage;              // Token counts
  metadata: IRMetadata;            // Tracking info
}
```

### Message
```typescript
interface IRMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];  // Text or multi-modal
  metadata?: Record<string, unknown>;
}
```

### Stream Chunk
```typescript
type IRStreamChunk =
  | { type: 'content'; delta: string; sequence: number }
  | { type: 'metadata'; usage?: TokenUsage; finishReason?: FinishReason }
  | { type: 'done'; finishReason: FinishReason; message?: IRMessage };
```

## Error Codes

| Code | Category | Retryable | Description |
|------|----------|-----------|-------------|
| `INVALID_API_KEY` | Authentication | No | API key is invalid |
| `RATE_LIMIT_EXCEEDED` | Rate Limit | Yes | Rate limit hit |
| `INVALID_REQUEST` | Validation | No | Request is malformed |
| `CONTEXT_LENGTH_EXCEEDED` | Validation | No | Too many tokens |
| `PROVIDER_ERROR` | Provider | Yes* | Upstream API error |
| `PROVIDER_UNAVAILABLE` | Provider | Yes | Provider is down |
| `NETWORK_ERROR` | Network | Yes | Network failure |
| `STREAM_INTERRUPTED` | Streaming | Yes | Stream disconnected |
| `NO_BACKEND_AVAILABLE` | Routing | No | No backend found |
| `ALL_BACKENDS_FAILED` | Routing | Yes* | All backends failed |

*Depends on specific error

## Middleware Examples

### Logging
```typescript
const loggingMiddleware: Middleware = async (context, next) => {
  console.log('[REQ]', context.request.metadata.requestId);
  const start = Date.now();
  try {
    const response = await next();
    console.log('[RES]', Date.now() - start, 'ms');
    return response;
  } catch (error) {
    console.error('[ERR]', Date.now() - start, 'ms', error);
    throw error;
  }
};
```

### Caching
```typescript
const cache = new Map<string, IRChatResponse>();

const cachingMiddleware: Middleware = async (context, next) => {
  const key = JSON.stringify(context.request.messages);
  const cached = cache.get(key);

  if (cached) return cached;

  const response = await next();
  cache.set(key, response);
  return response;
};
```

### Request Transform
```typescript
const temperatureClampMiddleware: Middleware = async (context, next) => {
  context.request = {
    ...context.request,
    parameters: {
      ...context.request.parameters,
      temperature: Math.min(context.request.parameters?.temperature ?? 0.7, 0.9)
    }
  };
  return next();
};
```

### Response Transform
```typescript
const uppercaseMiddleware: Middleware = async (context, next) => {
  const response = await next();
  return {
    ...response,
    message: {
      ...response.message,
      content: typeof response.message.content === 'string'
        ? response.message.content.toUpperCase()
        : response.message.content
    }
  };
};
```

## Router Strategies

### Routing Strategies
- `explicit` - Use backend from request options
- `model-based` - Route based on model name
- `cost-optimized` - Route to cheapest backend
- `latency-optimized` - Route to fastest backend
- `round-robin` - Distribute load evenly
- `random` - Random selection
- `custom` - Custom routing function

### Fallback Strategies
- `none` - Fail immediately, no retry
- `sequential` - Try backends in order
- `parallel` - Try all backends simultaneously
- `custom` - Custom fallback logic

### Parallel Strategies
- `first` - Return first success, cancel others
- `all` - Wait for all responses
- `fastest` - Return fastest success
- `custom` - Custom aggregation

## Configuration Examples

### Bridge Config
```typescript
const config: BridgeConfig = {
  debug: true,
  timeout: 60000,
  retries: 3,
  defaultModel: 'gpt-4',
  autoRequestId: true
};
```

### Router Config
```typescript
const config: RouterConfig = {
  routingStrategy: 'model-based',
  fallbackStrategy: 'sequential',
  healthCheckInterval: 30000,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000
};
```

### Backend Adapter Config
```typescript
const config: BackendAdapterConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
  timeout: 30000,
  maxRetries: 3,
  debug: false
};
```

## Type Guards

```typescript
// Check content type
if (isMultiPartContent(message.content)) {
  message.content.forEach(part => {
    if (part.type === 'text') console.log(part.text);
    if (part.type === 'image') console.log(part.source);
  });
}

// Check stream chunk type
for await (const chunk of stream) {
  if (isContentChunk(chunk)) console.log(chunk.delta);
  if (isMetadataChunk(chunk)) console.log(chunk.usage);
  if (isDoneChunk(chunk)) console.log(chunk.finishReason);
}
```

## Statistics

```typescript
// Bridge stats
const stats = bridge.getStats();
console.log(`Success rate: ${stats.successRate}%`);
console.log(`Avg latency: ${stats.averageLatencyMs}ms`);
console.log(`P95 latency: ${stats.p95LatencyMs}ms`);

// Router stats
const routerStats = router.getStats();
console.log(`Total requests: ${routerStats.totalRequests}`);
console.log(`Fallbacks: ${routerStats.totalFallbacks}`);

Object.entries(routerStats.backendStats).forEach(([name, stats]) => {
  console.log(`${name}: ${stats.successRate}%`);
});
```

## Events

```typescript
// Listen to events
bridge.on('request:success', (event) => {
  console.log(`Request ${event.requestId} succeeded in ${event.durationMs}ms`);
});

bridge.on('request:error', (event) => {
  console.error(`Request ${event.requestId} failed:`, event.error);
});

bridge.on('backend:failover', (event) => {
  console.log(`Failover: ${event.previousBackend} → ${event.backend}`);
});

bridge.on('*', (event) => {
  console.log('Event:', event.type);
});
```

## Advanced Usage

### Custom Routing
```typescript
const router = new Router({
  routingStrategy: 'custom',
  customRouter: async (request, backends, context) => {
    // Route expensive requests to cheaper backend
    const isExpensive = request.parameters?.maxTokens > 1000;
    if (isExpensive && backends.includes('mistral')) {
      return 'mistral';
    }
    return null; // Use default
  }
});
```

### Custom Fallback
```typescript
const router = new Router({
  fallbackStrategy: 'custom',
  customFallback: async (request, failed, error, attempted, available) => {
    // Only retry on rate limits
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      const remaining = available.filter(b => !attempted.includes(b));
      return remaining[0] ?? null;
    }
    return null; // Don't retry
  }
});
```

### Conditional Middleware
```typescript
const conditionalCache = createConditionalMiddleware({
  condition: (context) => !context.isStreaming,
  middleware: cachingMiddleware
});

bridge.use(conditionalCache);
```

### Fluent Builder
```typescript
const bridge = createBridge()
  .withFrontend(new OpenAIFrontendAdapter())
  .withBackend(new OpenAIBackendAdapter({ apiKey: 'sk-...' }))
  .withConfig({ debug: true })
  .withMiddleware(loggingMiddleware)
  .withMiddleware(cachingMiddleware)
  .build();
```

## File Sizes

- `ir.ts`: ~17KB - Core IR types
- `errors.ts`: ~20KB - Error system
- `adapters.ts`: ~21KB - Adapter interfaces
- `bridge.ts`: ~22KB - Bridge API
- `router.ts`: ~24KB - Router API
- `middleware.ts`: ~19KB - Middleware system

Total: ~123KB of type definitions
