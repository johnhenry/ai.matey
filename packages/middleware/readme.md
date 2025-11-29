# ai.matey.middleware

Middleware components for AI Matey - Universal AI Adapter System.

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.middleware
```

## Overview

This package provides middleware components that can be composed into a middleware stack for request/response processing in AI Matey bridges.

## Included Middleware

- **Retry** - Automatic retry with exponential backoff
- **Caching** - Response caching with configurable storage
- **Logging** - Request/response logging
- **Telemetry** - Metrics and telemetry collection
- **OpenTelemetry** - OpenTelemetry integration
- **Validation** - Request validation and sanitization
- **Transform** - Request/response transformation
- **Security** - Security headers and validation
- **Cost Tracking** - Token usage and cost tracking
- **Conversation History** - Conversation state management

## Usage

```typescript
import { Bridge } from 'ai.matey.core';
import {
  createRetryMiddleware,
  createCachingMiddleware,
  createLoggingMiddleware,
  InMemoryCacheStorage,
} from 'ai.matey.middleware';

const bridge = new Bridge({
  frontend,
  backend,
  middleware: [
    createLoggingMiddleware({ level: 'info' }),
    createRetryMiddleware({ maxAttempts: 3 }),
    createCachingMiddleware({ storage: new InMemoryCacheStorage() }),
  ],
});
```

### Retry Middleware

```typescript
import { createRetryMiddleware } from 'ai.matey.middleware';

const retry = createRetryMiddleware({
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
});
```

### Caching Middleware

```typescript
import { createCachingMiddleware, InMemoryCacheStorage } from 'ai.matey.middleware';

const cache = createCachingMiddleware({
  storage: new InMemoryCacheStorage(),
  ttlMs: 60000, // 1 minute
});
```

### Validation Middleware

```typescript
import { createValidationMiddleware } from 'ai.matey.middleware';

const validation = createValidationMiddleware({
  detectPII: true,
  detectPromptInjection: true,
});
```

### Cost Tracking Middleware

```typescript
import { createCostTrackingMiddleware, InMemoryCostStorage } from 'ai.matey.middleware';

const costTracking = createCostTrackingMiddleware({
  storage: new InMemoryCostStorage(),
});
```

## API Reference

See the TypeScript definitions for detailed API documentation.

## License

MIT - see [LICENSE](./LICENSE) for details.
