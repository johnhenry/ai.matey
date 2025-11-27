# ai.matey.middleware.logging

Logging middleware for request/response logging with configurable levels and sanitization.

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
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY! })
);

// Add logging middleware
bridge.use(createLoggingMiddleware({
  level: 'info',
  logRequests: true,
  logResponses: true,
  logErrors: true,
  sanitize: true,  // Redact API keys, tokens, etc.
}));
```

## Exports

- `createLoggingMiddleware` - Factory function to create logging middleware
- `LogLevel` - Type: `'debug' | 'info' | 'warn' | 'error'`
- `Logger` - Logger interface for custom implementations
- `LoggingConfig` - Configuration type

## API Reference

### createLoggingMiddleware

Creates middleware that logs requests, responses, and errors.

```typescript
createLoggingMiddleware(config?: LoggingConfig): Middleware
```

**Configuration:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | `LogLevel` | `'info'` | Minimum log level |
| `logRequests` | `boolean` | `true` | Log incoming requests |
| `logResponses` | `boolean` | `true` | Log outgoing responses |
| `logErrors` | `boolean` | `true` | Log errors |
| `sanitize` | `boolean` | `true` | Redact sensitive data (API keys, tokens) |
| `logger` | `Logger` | `console` | Custom logger implementation |
| `prefix` | `string` | - | Custom log prefix |

### Custom Logger

Provide a custom logger implementation:

```typescript
const customLogger = {
  debug: (msg, data) => myLogger.debug(msg, data),
  info: (msg, data) => myLogger.info(msg, data),
  warn: (msg, data) => myLogger.warn(msg, data),
  error: (msg, data) => myLogger.error(msg, data),
};

bridge.use(createLoggingMiddleware({
  logger: customLogger,
  level: 'debug',
}));
```

### Log Levels

- `debug` - Detailed debugging information
- `info` - General information (default)
- `warn` - Warning messages
- `error` - Error messages only

### Example Output

```
[ai.matey] INFO: Request received
  model: gpt-4
  messages: 3
  stream: true

[ai.matey] INFO: Response completed
  tokens: { prompt: 150, completion: 89, total: 239 }
  latency: 1234ms
```

## License

MIT - see [LICENSE](./LICENSE) for details.
