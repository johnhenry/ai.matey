# HTTP Listener Module

The HTTP Listener module provides a complete HTTP server implementation for the Universal AI Adapter System. It allows you to create HTTP endpoints that accept requests in various AI provider formats (OpenAI, Anthropic, etc.) and route them through the universal adapter system.

## Quick Start

```typescript
import http from 'http';
import { NodeHTTPListener } from 'ai.matey/http';
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

// Create adapter bridge
const frontend = new OpenAIFrontendAdapter();
const backend = new AnthropicBackendAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY
});
const bridge = new Bridge(frontend, backend);

// Create HTTP listener
const listener = NodeHTTPListener(bridge, {
  cors: true,
  streaming: true,
});

// Start server
const server = http.createServer(listener);
server.listen(8080, () => {
  console.log('Server listening on port 8080');
});
```

## Features

- ✅ **CORS Support** - Full CORS handling with customizable options
- ✅ **Authentication** - Bearer tokens, API keys, basic auth
- ✅ **Rate Limiting** - Sliding window rate limiting with custom keys
- ✅ **Streaming** - Server-Sent Events (SSE) streaming support
- ✅ **Error Handling** - Provider-specific error formatting
- ✅ **Routing** - Multi-endpoint support with pattern matching
- ✅ **Middleware** - Full middleware support from Bridge
- ✅ **Logging** - Request/response logging
- ✅ **Timeouts** - Configurable request timeouts

---

## Core API

### `NodeHTTPListener(bridge, options?)`

Creates an HTTP request handler compatible with Node.js `http.createServer()`.

**Parameters:**
- `bridge` - Bridge instance connecting frontend and backend adapters
- `options` - Optional configuration (see [Configuration Options](#configuration-options))

**Returns:** `HTTPRequestHandler` compatible with `http.createServer()`

**Example:**
```typescript
const listener = NodeHTTPListener(bridge, {
  cors: true,
  streaming: true,
  timeout: 30000,
});

const server = http.createServer(listener);
```

---

## Configuration Options

### Basic Options

```typescript
interface HTTPListenerOptions {
  // CORS configuration
  cors?: boolean | CORSOptions;

  // Authentication validator
  validateAuth?: AuthValidator;

  // Error handler
  onError?: ErrorHandler;

  // Custom response headers
  headers?: Record<string, string>;

  // Request timeout (ms)
  timeout?: number;

  // Path prefix for routes
  pathPrefix?: string;

  // Rate limiting
  rateLimit?: RateLimitOptions;

  // Route configurations
  routes?: RouteConfig[];

  // Enable logging
  logging?: boolean;

  // Log function
  log?: (message: string, ...args: any[]) => void;

  // Max request body size (bytes)
  maxBodySize?: number;

  // Enable streaming
  streaming?: boolean;
}
```

---

## CORS Configuration

### Basic CORS

```typescript
const listener = NodeHTTPListener(bridge, {
  cors: true, // Default: allow all origins
});
```

### Custom CORS

```typescript
const listener = NodeHTTPListener(bridge, {
  cors: {
    origin: ['https://example.com', 'https://app.example.com'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // 24 hours
  },
});
```

### Dynamic Origin Validation

```typescript
const listener = NodeHTTPListener(bridge, {
  cors: {
    origin: (origin) => {
      // Allow all subdomains of example.com
      return origin.endsWith('.example.com');
    },
  },
});
```

---

## Authentication

### Bearer Token Authentication

```typescript
import { createBearerTokenValidator } from 'ai.matey/http';

const listener = NodeHTTPListener(bridge, {
  validateAuth: createBearerTokenValidator(['token-1', 'token-2']),
});
```

### API Key Authentication

```typescript
import { createAPIKeyValidator } from 'ai.matey/http';

const listener = NodeHTTPListener(bridge, {
  validateAuth: createAPIKeyValidator(['key-1', 'key-2']),
});
```

### Basic Authentication

```typescript
import { createBasicAuthValidator } from 'ai.matey/http';

const credentials = new Map([
  ['admin', 'password123'],
  ['user', 'userpass'],
]);

const listener = NodeHTTPListener(bridge, {
  validateAuth: createBasicAuthValidator(credentials),
});
```

### Custom Authentication

```typescript
const listener = NodeHTTPListener(bridge, {
  validateAuth: async (req) => {
    const apiKey = req.headers['x-api-key'];

    // Validate against database
    const isValid = await checkAPIKeyInDatabase(apiKey);

    return isValid;
  },
});
```

### Combining Validators

```typescript
import { combineAuthValidators } from 'ai.matey/http';

const listener = NodeHTTPListener(bridge, {
  validateAuth: combineAuthValidators(
    createBearerTokenValidator(['token-1']),
    createAPIKeyValidator(['key-1'])
  ),
});
```

---

## Rate Limiting

### Basic Rate Limiting

```typescript
const listener = NodeHTTPListener(bridge, {
  rateLimit: {
    max: 100, // 100 requests
    windowMs: 60000, // per minute
  },
});
```

### Custom Rate Limit Key

```typescript
import { tokenKeyGenerator } from 'ai.matey/http';

const listener = NodeHTTPListener(bridge, {
  rateLimit: {
    max: 1000,
    windowMs: 60000,
    keyGenerator: tokenKeyGenerator, // Rate limit by auth token
  },
});
```

### Skip Rate Limiting for Certain Paths

```typescript
const listener = NodeHTTPListener(bridge, {
  rateLimit: {
    max: 100,
    windowMs: 60000,
    skip: (req) => {
      // Skip rate limiting for health check
      return req.url === '/health';
    },
  },
});
```

### Custom Rate Limit Handler

```typescript
const listener = NodeHTTPListener(bridge, {
  rateLimit: {
    max: 100,
    windowMs: 60000,
    handler: (req, res, retryAfter) => {
      res.statusCode = 429;
      res.end(JSON.stringify({
        error: 'Custom rate limit message',
        retryAfter,
      }));
    },
  },
});
```

---

## Error Handling

### Custom Error Handler

```typescript
const listener = NodeHTTPListener(bridge, {
  onError: (error, req, res) => {
    // Log error
    console.error(`Error: ${req.method} ${req.url}`, error);

    // Send custom error response
    res.statusCode = 500;
    res.end(JSON.stringify({
      error: 'Internal server error',
      message: error.message,
    }));
  },
});
```

### Logging Error Handler

```typescript
import { createLoggingErrorHandler } from 'ai.matey/http';

const listener = NodeHTTPListener(bridge, {
  onError: createLoggingErrorHandler((message, error) => {
    // Custom logging
    myLogger.error(message, { error });
  }),
});
```

### Reporting Error Handler

```typescript
import { createReportingErrorHandler } from 'ai.matey/http';

const listener = NodeHTTPListener(bridge, {
  onError: createReportingErrorHandler(async (error, req) => {
    // Report to external service
    await sentry.captureException(error, {
      extra: {
        method: req.method,
        url: req.url,
      },
    });
  }),
});
```

---

## Streaming Support

### Basic Streaming

Streaming is enabled by default. Requests with `stream: true` will automatically use SSE streaming.

```typescript
const listener = NodeHTTPListener(bridge, {
  streaming: true, // Default
});
```

### Disable Streaming

```typescript
const listener = NodeHTTPListener(bridge, {
  streaming: false,
});
```

### Streaming Example (Client-Side)

```javascript
// OpenAI-style streaming request
const response = await fetch('http://localhost:8080/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;

      const parsed = JSON.parse(data);
      const content = parsed.choices[0]?.delta?.content;
      if (content) {
        process.stdout.write(content);
      }
    }
  }
}
```

---

## Multi-Route Support

### Multiple Provider Endpoints

```typescript
import { OpenAIFrontendAdapter, AnthropicFrontendAdapter } from 'ai.matey';

const openAIFrontend = new OpenAIFrontendAdapter();
const anthropicFrontend = new AnthropicFrontendAdapter();
const backend = new AnthropicBackendAdapter({ apiKey: '...' });

const openAIBridge = new Bridge(openAIFrontend, backend);
const anthropicBridge = new Bridge(anthropicFrontend, backend);

const listener = NodeHTTPListener(openAIBridge, {
  routes: [
    {
      path: '/v1/chat/completions',
      methods: ['POST'],
      frontend: openAIFrontend,
      bridge: openAIBridge,
    },
    {
      path: '/v1/messages',
      methods: ['POST'],
      frontend: anthropicFrontend,
      bridge: anthropicBridge,
    },
  ],
});
```

### Wildcard Routes

```typescript
const listener = NodeHTTPListener(bridge, {
  routes: [
    {
      path: '/api/*',
      methods: ['POST'],
      frontend: openAIFrontend,
    },
  ],
});
```

### Parameterized Routes

```typescript
const listener = NodeHTTPListener(bridge, {
  routes: [
    {
      path: '/models/:modelId/chat',
      methods: ['POST'],
      frontend: openAIFrontend,
    },
  ],
});
```

---

## Logging

### Enable Logging

```typescript
const listener = NodeHTTPListener(bridge, {
  logging: true,
});
```

### Custom Logger

```typescript
const listener = NodeHTTPListener(bridge, {
  logging: true,
  log: (message, ...args) => {
    myLogger.info(message, ...args);
  },
});
```

---

## Complete Examples

### Example 1: Simple OpenAI-Compatible Server

```typescript
import http from 'http';
import { NodeHTTPListener } from 'ai.matey/http';
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

const frontend = new OpenAIFrontendAdapter();
const backend = new AnthropicBackendAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY
});
const bridge = new Bridge(frontend, backend);

const listener = NodeHTTPListener(bridge, {
  cors: true,
  streaming: true,
});

const server = http.createServer(listener);
server.listen(8080, () => {
  console.log('OpenAI-compatible server on http://localhost:8080');
});
```

### Example 2: Secure Server with Auth and Rate Limiting

```typescript
import http from 'http';
import { NodeHTTPListener, createBearerTokenValidator } from 'ai.matey/http';
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

const frontend = new OpenAIFrontendAdapter();
const backend = new AnthropicBackendAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY
});
const bridge = new Bridge(frontend, backend);

const listener = NodeHTTPListener(bridge, {
  cors: {
    origin: ['https://myapp.com'],
    credentials: true,
  },
  validateAuth: createBearerTokenValidator([
    process.env.API_TOKEN_1,
    process.env.API_TOKEN_2,
  ]),
  rateLimit: {
    max: 100,
    windowMs: 60000,
    headers: true,
  },
  streaming: true,
  logging: true,
});

const server = http.createServer(listener);
server.listen(8080);
```

### Example 3: Multi-Provider Server with Middleware

```typescript
import http from 'http';
import { NodeHTTPListener } from 'ai.matey/http';
import {
  Bridge,
  OpenAIFrontendAdapter,
  AnthropicFrontendAdapter,
  AnthropicBackendAdapter,
  createLoggingMiddleware,
  createCachingMiddleware,
  InMemoryCacheStorage,
} from 'ai.matey';

// Setup adapters
const openAIFrontend = new OpenAIFrontendAdapter();
const anthropicFrontend = new AnthropicFrontendAdapter();
const backend = new AnthropicBackendAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Create bridges with middleware
const openAIBridge = new Bridge(openAIFrontend, backend);
openAIBridge.use(createLoggingMiddleware({ level: 'info' }));
openAIBridge.use(createCachingMiddleware({
  storage: new InMemoryCacheStorage(100),
  ttl: 3600000,
}));

const anthropicBridge = new Bridge(anthropicFrontend, backend);
anthropicBridge.use(createLoggingMiddleware({ level: 'info' }));

// Create listener with multiple routes
const listener = NodeHTTPListener(openAIBridge, {
  cors: true,
  streaming: true,
  routes: [
    {
      path: '/v1/chat/completions',
      methods: ['POST'],
      frontend: openAIFrontend,
      bridge: openAIBridge,
    },
    {
      path: '/v1/messages',
      methods: ['POST'],
      frontend: anthropicFrontend,
      bridge: anthropicBridge,
    },
  ],
});

const server = http.createServer(listener);
server.listen(8080, () => {
  console.log('Multi-provider server running on port 8080');
  console.log('OpenAI endpoint: http://localhost:8080/v1/chat/completions');
  console.log('Anthropic endpoint: http://localhost:8080/v1/messages');
});
```

### Example 4: Production-Ready Server

```typescript
import http from 'http';
import { NodeHTTPListener, createBearerTokenValidator } from 'ai.matey/http';
import { Bridge, Router, OpenAIFrontendAdapter, AnthropicBackendAdapter, OpenAIBackendAdapter } from 'ai.matey';
import { createLoggingMiddleware, createRetryMiddleware, createTelemetryMiddleware } from 'ai.matey/middleware';

// Setup multiple backends with Router
const frontend = new OpenAIFrontendAdapter();
const anthropicBackend = new AnthropicBackendAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY
});
const openaiBackend = new OpenAIBackendAdapter({
  apiKey: process.env.OPENAI_API_KEY
});

// Use Router for multi-backend support
const router = new Router(frontend, [anthropicBackend, openaiBackend], {
  strategy: 'round-robin',
  fallback: 'sequential',
});

// Add production middleware
router.use(createLoggingMiddleware({
  level: 'info',
  logger: productionLogger,
}));

router.use(createRetryMiddleware({
  maxAttempts: 3,
  initialDelay: 1000,
}));

router.use(createTelemetryMiddleware({
  sink: productionTelemetrySink,
  trackCounts: true,
  trackLatencies: true,
  trackTokens: true,
}));

// Create secure listener
const listener = NodeHTTPListener(router, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
  },
  validateAuth: createBearerTokenValidator(async (token) => {
    return await validateTokenInDatabase(token);
  }),
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '1000'),
    windowMs: 60000,
    headers: true,
  },
  onError: async (error, req, res) => {
    // Log to monitoring service
    await monitoringService.captureException(error);

    // Send error response
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error' }));
  },
  streaming: true,
  timeout: 30000,
  maxBodySize: 5 * 1024 * 1024, // 5MB
  logging: true,
  log: productionLogger.info.bind(productionLogger),
});

// Start server
const port = parseInt(process.env.PORT || '8080');
const server = http.createServer(listener);

server.listen(port, () => {
  console.log(`Production server running on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

---

## API Reference

### Convenience Functions

#### `createSimpleListener(bridge)`

Creates a simple HTTP listener with default settings.

```typescript
import { createSimpleListener } from 'ai.matey/http';

const listener = createSimpleListener(bridge);
```

#### `createLoggingListener(bridge, log?)`

Creates an HTTP listener with logging enabled.

```typescript
import { createLoggingListener } from 'ai.matey/http';

const listener = createLoggingListener(bridge, myLogger.info);
```

#### `createSecureListener(bridge, options)`

Creates an HTTP listener with authentication and rate limiting.

```typescript
import { createSecureListener, createBearerTokenValidator } from 'ai.matey/http';

const listener = createSecureListener(bridge, {
  validateAuth: createBearerTokenValidator(['token']),
  rateLimit: { max: 100, windowMs: 60000 },
});
```

### Utility Functions

See the [API exports](./index.ts) for a complete list of utility functions including:
- Request parsing utilities
- Response formatting utilities
- CORS helpers
- Authentication helpers
- Rate limiting utilities
- Error handling utilities
- Streaming utilities
- Routing utilities

---

## Testing

The HTTP listener is fully tested with integration tests covering:
- Basic request handling
- CORS
- Authentication
- Rate limiting
- Error handling
- Streaming
- Multi-route support

See [tests/integration/http-listener.test.ts](../../tests/integration/http-listener.test.ts) for examples.

---

## TypeScript Support

All types are fully exported:

```typescript
import type {
  HTTPRequestHandler,
  HTTPListenerOptions,
  CORSOptions,
  RateLimitOptions,
  RouteConfig,
  AuthValidator,
  ErrorHandler,
} from 'ai.matey/http';
```

---

## Performance Considerations

1. **Rate Limiting**: Uses in-memory storage that periodically cleans up. For distributed systems, implement custom `RateLimitKeyGenerator` with external storage (Redis, etc.)

2. **Caching**: Bridge-level caching is recommended for repeated requests. See [middleware documentation](../middleware/README.md).

3. **Streaming**: SSE streaming is efficient but requires keeping connections open. Use appropriate timeout values.

4. **CORS**: Preflight requests are cached by browsers based on `maxAge` setting.

---

## Security Best Practices

1. **Always use authentication** in production
2. **Enable rate limiting** to prevent abuse
3. **Use CORS** to restrict origins
4. **Set reasonable timeouts** to prevent resource exhaustion
5. **Limit request body size** to prevent DoS attacks
6. **Use HTTPS** in production (terminate TLS at reverse proxy)
7. **Validate and sanitize** all inputs
8. **Log security events** for monitoring

---

## Troubleshooting

### CORS Issues

If you're experiencing CORS issues:
1. Check that `origin` allows your client's origin
2. Ensure `credentials: true` if sending cookies/auth headers
3. Verify `allowedHeaders` includes all headers you're sending

### Authentication Failures

If authentication isn't working:
1. Verify your validator function returns `true` for valid requests
2. Check header names are correct (case-insensitive)
3. Ensure tokens/keys are properly formatted

### Rate Limiting Issues

If rate limiting isn't working as expected:
1. Verify `keyGenerator` returns consistent keys
2. Check `windowMs` is appropriate for your use case
3. Ensure client IP is correctly detected (check `X-Forwarded-For` if behind proxy)

### Streaming Issues

If streaming isn't working:
1. Ensure `streaming: true` in options
2. Verify request has `stream: true` in body
3. Check that client properly handles SSE format
4. Verify no middleware is buffering responses

---

## License

MIT
