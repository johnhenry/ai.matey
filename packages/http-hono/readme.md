# ai.matey.http.hono

HTTP integration for Hono

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.http.hono
```

## Quick Start

```typescript
import { createHonoHandler } from 'ai.matey.http.hono';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

const handler = createHonoHandler(bridge, {
  streaming: true,
  timeout: 30000,
});

// Use with your Hono server
```

## API Reference

### createHonoHandler

Creates an HTTP handler for Hono.

```typescript
createHonoHandler(bridge: Bridge, options?: HandlerOptions): Handler
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `streaming` | `boolean` | `true` | Enable streaming responses |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `cors` | `boolean` | `false` | Enable CORS headers |

## Exports

- `createHonoHandler`
- `createHonoMiddleware`

## License

MIT - see [LICENSE](./LICENSE) for details.
