# ai.matey.middleware.caching

Caching middleware for response caching

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.middleware.caching
```

## Quick Start

```typescript
import { createCachingMiddleware } from 'ai.matey.middleware.caching';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

// Add middleware
bridge.use(createCachingMiddleware({
  maxSize: /* value */,
  ttlMs: /* value */,
  keyGenerator: /* value */,
}));
```

## API Reference

### createCachingMiddleware

Creates middleware for caching middleware for response caching.

#### Configuration

```typescript
createCachingMiddleware(config?: CachingMiddlewareConfig): Middleware
```

| Option | Type | Description |
|--------|------|-------------|
| `maxSize` | `number` | Maximum cache size |
| `ttlMs` | `number` | Time-to-live in milliseconds |
| `keyGenerator` | `Function` | Custom cache key generator function |

## Exports

- `createCachingMiddleware`
- `InMemoryCacheStorage`

## Example

```typescript
import { createCachingMiddleware } from 'ai.matey.middleware.caching';

const middleware = createCachingMiddleware({
  // configuration options
});

bridge.use(middleware);
```

## License

MIT - see [LICENSE](./LICENSE) for details.
