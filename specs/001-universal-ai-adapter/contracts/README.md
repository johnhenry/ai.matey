# Universal AI Adapter System - API Contracts

This directory contains the TypeScript API contracts (interfaces and types) for the Universal AI Adapter System. These contracts define the public API surface that all implementations must follow.

## Overview

The Universal AI Adapter System provides a unified interface for interacting with multiple AI providers (OpenAI, Anthropic, Google Gemini, Ollama, Mistral, Chrome AI). The system uses a **hybrid architecture** combining:

- **Adapters**: Bidirectional translation between provider formats and universal IR
- **Bridge**: Primary developer-facing API connecting frontend and backend adapters
- **Router**: Dynamic backend selection, fallback, and parallel dispatch
- **Middleware**: Composable transformation layers for cross-cutting concerns

## Contract Files

### [`ir.ts`](./ir.ts) - Intermediate Representation

The universal IR (Intermediate Representation) that all provider-specific formats translate to/from.

**Key Types:**
- `IRChatRequest` - Universal chat completion request
- `IRChatResponse` - Universal chat completion response
- `IRStreamChunk` - Universal streaming response chunk
- `IRMessage` - Normalized message format
- `IRParameters` - Universal model parameters
- `IRCapabilities` - Adapter capability metadata
- `SemanticTransform` - Documentation of lossy transformations

**Example:**
```typescript
import type { IRChatRequest, IRChatResponse } from './contracts';

const request: IRChatRequest = {
  messages: [
    { role: 'user', content: 'Hello, AI!' }
  ],
  parameters: {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000
  },
  metadata: {
    requestId: crypto.randomUUID(),
    timestamp: Date.now()
  }
};
```

### [`errors.ts`](./errors.ts) - Error Types and Codes

Normalized error handling across all providers with actionable error messages.

**Key Types:**
- `AdapterError` - Base error class with adapter context
- `ErrorCode` - Universal error codes (authentication, rate limit, validation, etc.)
- `AuthenticationError`, `ValidationError`, `RateLimitError`, etc. - Specialized errors
- Error factory functions for creating errors from HTTP responses

**Example:**
```typescript
import { AdapterError, ErrorCode, RateLimitError } from './contracts';

try {
  const response = await bridge.chat(request);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}ms`);
  } else if (error instanceof AdapterError) {
    console.error(`Error ${error.code}:`, error.message);
    console.error('Provenance:', error.provenance);
  }
}
```

### [`adapters.ts`](./adapters.ts) - Frontend and Backend Adapters

Adapter interfaces for bidirectional translation between provider formats and IR.

**Key Types:**
- `FrontendAdapter<TRequest, TResponse, TStreamChunk>` - Normalizes provider requests to IR
- `BackendAdapter` - Transforms IR to provider API calls
- `AdapterMetadata` - Adapter identification and capabilities
- `BackendAdapterConfig` - Configuration for backend adapters
- `AdapterRegistry` - Registry for managing available adapters

**Example:**
```typescript
import type { FrontendAdapter, BackendAdapter } from './contracts';

// Implement Anthropic frontend adapter
class AnthropicFrontendAdapter implements FrontendAdapter<
  AnthropicRequest,
  AnthropicResponse,
  AnthropicStreamChunk
> {
  readonly metadata = {
    name: 'anthropic',
    version: '1.0.0',
    provider: 'Anthropic',
    capabilities: {
      streaming: true,
      multiModal: false,
      maxContextTokens: 100000,
      supportedModels: ['claude-3-opus', 'claude-3-sonnet'],
      systemMessageStrategy: 'separate-parameter',
      supportsMultipleSystemMessages: false
    }
  };

  async toIR(request: AnthropicRequest): Promise<IRChatRequest> {
    // Convert Anthropic format to IR
  }

  async fromIR(response: IRChatResponse): Promise<AnthropicResponse> {
    // Convert IR back to Anthropic format
  }

  async *fromIRStream(stream: IRChatStream): AsyncGenerator<AnthropicStreamChunk> {
    // Convert IR stream to Anthropic chunks
  }
}
```

### [`bridge.ts`](./bridge.ts) - Bridge Class Public API

The primary developer-facing API for making AI requests with automatic translation.

**Key Types:**
- `Bridge<TFrontend>` - Main bridge interface
- `BridgeConfig` - Bridge configuration options
- `RequestOptions` - Per-request options
- `BridgeStats` - Runtime statistics
- `BridgeEvent` - Event system for monitoring

**Example:**
```typescript
import { Bridge } from './contracts';

// Simple bridge: Anthropic frontend → OpenAI backend
const bridge = new Bridge(
  new AnthropicFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: 'sk-...' })
);

// Add middleware
bridge.use(loggingMiddleware);
bridge.use(cachingMiddleware);

// Make request using Anthropic format
const response = await bridge.chat({
  model: 'claude-3-opus',
  messages: [{ role: 'user', content: 'Hello!' }],
  system: 'You are helpful'
});

// Streaming
const stream = bridge.chatStream({
  model: 'claude-3-opus',
  messages: [{ role: 'user', content: 'Tell me a story' }]
});

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

### [`router.ts`](./router.ts) - Router Class Public API

Dynamic backend selection, fallback strategies, and parallel dispatch.

**Key Types:**
- `Router` - Router interface (implements BackendAdapter)
- `RouterConfig` - Router configuration
- `RoutingStrategy` - Backend selection strategies
- `FallbackStrategy` - Fallback behavior on failures
- `ParallelDispatchOptions` - Options for parallel requests
- `BackendInfo` - Information about registered backends
- `RouterStats` - Router statistics

**Example:**
```typescript
import { Router, RoutingStrategy, FallbackStrategy } from './contracts';

// Create router with multiple backends
const router = new Router({
  routingStrategy: 'model-based',
  fallbackStrategy: 'sequential',
  enableCircuitBreaker: true
});

// Register backends
router
  .register('openai', new OpenAIBackendAdapter({ apiKey: 'sk-...' }))
  .register('anthropic', new AnthropicBackendAdapter({ apiKey: 'sk-...' }))
  .register('gemini', new GeminiBackendAdapter({ apiKey: 'ai-...' }));

// Configure routing
router
  .setFallbackChain(['openai', 'anthropic', 'gemini'])
  .setModelMapping({
    'gpt-4': 'openai',
    'claude-3-opus': 'anthropic',
    'gemini-pro': 'gemini'
  });

// Use with bridge
const bridge = new Bridge(frontend, router);

// Parallel dispatch
const result = await router.dispatchParallel(request, {
  backends: ['openai', 'anthropic'],
  strategy: 'first' // Return first success
});
```

### [`middleware.ts`](./middleware.ts) - Middleware Function Signatures

Composable transformation layers for cross-cutting concerns.

**Key Types:**
- `Middleware` - Standard middleware function
- `StreamingMiddleware` - Streaming-aware middleware
- `MiddlewareContext` - Context passed to middleware
- `MiddlewareWithMetadata` - Middleware with metadata
- Built-in middleware: Logging, Caching, Telemetry, etc.

**Example:**
```typescript
import type { Middleware } from './contracts';
import { createMiddleware, createTimingMiddleware } from './contracts';

// Simple logging middleware
const loggingMiddleware: Middleware = async (context, next) => {
  console.log('Request:', context.request.metadata.requestId);
  const response = await next();
  console.log('Response:', response.finishReason);
  return response;
};

// Request transformation middleware
const promptRewriteMiddleware: Middleware = async (context, next) => {
  context.request = {
    ...context.request,
    messages: context.request.messages.map(msg => ({
      ...msg,
      content: typeof msg.content === 'string'
        ? msg.content.toUpperCase()
        : msg.content
    }))
  };
  return next();
};

// Use with bridge
bridge.use(loggingMiddleware);
bridge.use(promptRewriteMiddleware);
bridge.use(createTimingMiddleware({
  onComplete: (duration, context) => {
    console.log(`Request took ${duration}ms`);
  }
}));
```

## Usage Patterns

### Basic Usage: Direct Adapter Connection

```typescript
import { Bridge } from './contracts';

const bridge = new Bridge(
  new AnthropicFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

const response = await bridge.chat(anthropicRequest);
```

### Advanced Usage: Router with Multiple Backends

```typescript
import { Bridge, Router } from './contracts';

const router = new Router()
  .register('openai', new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY }))
  .register('anthropic', new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }))
  .setFallbackChain(['openai', 'anthropic']);

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  router
);

bridge.use(loggingMiddleware);
bridge.use(cachingMiddleware);

const response = await bridge.chat(openaiRequest);
```

### Streaming with Middleware

```typescript
const stream = bridge.chatStream(request);

for await (const chunk of stream) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.delta);
  } else if (chunk.type === 'done') {
    console.log('\nFinished:', chunk.finishReason);
  }
}
```

### Parallel Dispatch for Comparison

```typescript
const result = await router.dispatchParallel(request, {
  backends: ['openai', 'anthropic', 'gemini'],
  strategy: 'all'
});

result.allResponses?.forEach(({ backend, response }) => {
  console.log(`${backend}:`, response.message.content);
});
```

## Type Safety Features

### Discriminated Unions

All variant types use discriminated unions for compile-time type safety:

```typescript
// Message content
if (typeof message.content === 'string') {
  console.log(message.content); // TypeScript knows it's a string
} else {
  message.content.forEach(part => {
    if (part.type === 'text') {
      console.log(part.text); // TypeScript knows text field exists
    } else if (part.type === 'image') {
      console.log(part.source); // TypeScript knows source field exists
    }
  });
}

// Stream chunks
for await (const chunk of stream) {
  if (chunk.type === 'content') {
    console.log(chunk.delta); // TypeScript knows delta exists
  } else if (chunk.type === 'metadata') {
    console.log(chunk.usage); // TypeScript knows usage exists
  } else if (chunk.type === 'done') {
    console.log(chunk.finishReason); // TypeScript knows finishReason exists
  }
}
```

### Template Literal Types

```typescript
// Error codes use const assertions for strict typing
const code: ErrorCode = ErrorCode.RATE_LIMIT_EXCEEDED; // ✓
const code: ErrorCode = 'INVALID_CODE'; // ✗ Compile error
```

### Readonly Properties

All contract types use `readonly` properties to prevent accidental mutations:

```typescript
const request: IRChatRequest = { /* ... */ };
request.messages = []; // ✗ Compile error - cannot assign to readonly property
```

### Type Inference

Bridge preserves frontend adapter types through generic constraints:

```typescript
const bridge = new Bridge(
  new AnthropicFrontendAdapter(), // TFrontend inferred
  new OpenAIBackendAdapter({ apiKey: 'sk-...' })
);

// Request type automatically inferred as AnthropicRequest
const response = await bridge.chat({
  model: 'claude-3-opus',
  messages: [{ role: 'user', content: 'Hello' }]
});
// Response type automatically inferred as AnthropicResponse
```

## Design Principles

1. **Provider Agnostic**: IR can represent features from any provider
2. **Lossless Where Possible**: Preserve semantic intent across translations
3. **Type Safe**: Compile-time checking prevents runtime errors
4. **Extensible**: Add new providers without modifying core contracts
5. **Observable**: Events, statistics, and metadata for monitoring
6. **Composable**: Middleware stacks in predictable order
7. **Async First**: All operations return Promises for flexibility
8. **Error Context**: Errors include adapter provenance and IR state

## Error Handling Strategy

All errors extend `AdapterError` with:
- Universal error codes (`ErrorCode`)
- Category for grouped handling (`ErrorCategory`)
- Retry-ability flag (`isRetryable`)
- Adapter provenance (frontend/backend that failed)
- IR state at failure point
- Original cause chain

```typescript
try {
  const response = await bridge.chat(request);
} catch (error) {
  if (error instanceof AdapterError) {
    console.error('Code:', error.code);
    console.error('Category:', error.category);
    console.error('Retryable:', error.isRetryable);
    console.error('Frontend:', error.provenance.frontend);
    console.error('Backend:', error.provenance.backend);
    console.error('IR State:', error.irState);
  }
}
```

## Implementation Notes

These are **contract definitions only** - they specify the public API surface that implementations must follow. The actual implementation will:

1. Implement all adapter interfaces for supported providers
2. Implement Bridge class with middleware and event system
3. Implement Router class with routing strategies and circuit breaking
4. Implement built-in middleware (logging, caching, telemetry)
5. Provide utilities for common patterns (error creation, middleware composition)

## Next Steps

After reviewing these contracts:

1. Validate contracts match requirements in `spec.md`
2. Implement core IR types and type guards
3. Implement error classes and factory functions
4. Implement adapter interfaces for each provider
5. Implement Bridge class with middleware stack
6. Implement Router class with routing strategies
7. Implement built-in middleware
8. Write comprehensive tests for each component

## Version

Contract Version: 1.0.0
Last Updated: 2025-10-13
TypeScript Version: 5.0+
