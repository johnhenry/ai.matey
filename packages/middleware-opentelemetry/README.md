# ai.matey.middleware.opentelemetry

OpenTelemetry middleware for distributed tracing

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.middleware.opentelemetry
```

## Quick Start

```typescript
import { createOpenTelemetryMiddleware } from 'ai.matey.middleware.opentelemetry';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

// Add middleware
bridge.use(createOpenTelemetryMiddleware({
  tracer: /* value */,
  spanName: /* value */,
}));
```

## API Reference

### createOpenTelemetryMiddleware

Creates middleware for opentelemetry middleware for distributed tracing.

#### Configuration

```typescript
createOpenTelemetryMiddleware(config?: OpenTelemetryMiddlewareConfig): Middleware
```

| Option | Type | Description |
|--------|------|-------------|
| `tracer` | `any` | OpenTelemetry tracer |
| `spanName` | `any` | Span name for traces |

## Exports

- `createOpenTelemetryMiddleware`

## Example

```typescript
import { createOpenTelemetryMiddleware } from 'ai.matey.middleware.opentelemetry';

const middleware = createOpenTelemetryMiddleware({
  // configuration options
});

bridge.use(middleware);
```

## License

MIT - see [LICENSE](./LICENSE) for details.
