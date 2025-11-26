# ai.matey.middleware.logging

Logging middleware for request/response logging

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.middleware.logging
```

## Quick Start

```typescript
import { createLoggingMiddleware } from 'ai.matey.middleware.logging';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

// Add middleware
bridge.use(createLoggingMiddleware({
  level: /* value */,
  logRequests: /* value */,
  logResponses: /* value */,
  logErrors: /* value */,
  redactFields: /* value */,
}));
```

## API Reference

### createLoggingMiddleware

Creates middleware for logging middleware for request/response logging.

#### Configuration

```typescript
createLoggingMiddleware(config?: LoggingMiddlewareConfig): Middleware
```

| Option | Type | Description |
|--------|------|-------------|
| `level` | `'debug' | 'info' | 'warn' | 'error'` | Log level (debug, info, warn, error) |
| `logRequests` | `boolean` | Log incoming requests |
| `logResponses` | `boolean` | Log outgoing responses |
| `logErrors` | `boolean` | Log errors |
| `redactFields` | `string[]` | Fields to redact from logs |

## Exports

- `createLoggingMiddleware`

## Example

```typescript
import { createLoggingMiddleware } from 'ai.matey.middleware.logging';

const middleware = createLoggingMiddleware({
  // configuration options
});

bridge.use(middleware);
```

## License

MIT - see [LICENSE](./LICENSE) for details.
