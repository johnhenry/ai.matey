# ai.matey.middleware.retry

Retry middleware for automatic request retries

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.middleware.retry
```

## Quick Start

```typescript
import { createRetryMiddleware } from 'ai.matey.middleware.retry';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

// Add middleware
bridge.use(createRetryMiddleware({
  maxRetries: /* value */,
  initialDelayMs: /* value */,
  maxDelayMs: /* value */,
  backoffMultiplier: /* value */,
  retryableErrors: /* value */,
}));
```

## API Reference

### createRetryMiddleware

Creates middleware for retry middleware for automatic request retries.

#### Configuration

```typescript
createRetryMiddleware(config?: RetryMiddlewareConfig): Middleware
```

| Option | Type | Description |
|--------|------|-------------|
| `maxRetries` | `number` | Maximum number of retry attempts |
| `initialDelayMs` | `number` | Initial delay before first retry |
| `maxDelayMs` | `number` | Maximum delay between retries |
| `backoffMultiplier` | `number` | Backoff multiplier for exponential retry |
| `retryableErrors` | `string[]` | Error types to retry |

## Exports

- `createRetryMiddleware`

## Example

```typescript
import { createRetryMiddleware } from 'ai.matey.middleware.retry';

const middleware = createRetryMiddleware({
  // configuration options
});

bridge.use(middleware);
```

## License

MIT - see [LICENSE](./LICENSE) for details.
