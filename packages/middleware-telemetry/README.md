# ai.matey.middleware.telemetry

Telemetry middleware for metrics collection

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.middleware.telemetry
```

## Quick Start

```typescript
import { createTelemetryMiddleware } from 'ai.matey.middleware.telemetry';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

// Add middleware
bridge.use(createTelemetryMiddleware({
  sink: /* value */,
  collectLatency: /* value */,
  collectTokens: /* value */,
}));
```

## API Reference

### createTelemetryMiddleware

Creates middleware for telemetry middleware for metrics collection.

#### Configuration

```typescript
createTelemetryMiddleware(config?: TelemetryMiddlewareConfig): Middleware
```

| Option | Type | Description |
|--------|------|-------------|
| `sink` | `any` | Telemetry data sink |
| `collectLatency` | `any` | Collect latency metrics |
| `collectTokens` | `any` | Collect token usage metrics |

## Exports

- `createTelemetryMiddleware`
- `InMemoryTelemetrySink`

## Example

```typescript
import { createTelemetryMiddleware } from 'ai.matey.middleware.telemetry';

const middleware = createTelemetryMiddleware({
  // configuration options
});

bridge.use(middleware);
```

## License

MIT - see [LICENSE](./LICENSE) for details.
