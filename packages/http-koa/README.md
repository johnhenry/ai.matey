# ai.matey.http.koa

HTTP integration for Koa

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.http.koa
```

## Quick Start

```typescript
import { createKoaHandler } from 'ai.matey.http.koa';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

const handler = createKoaHandler(bridge, {
  streaming: true,
  timeout: 30000,
});

// Use with your Koa server
```

## API Reference

### createKoaHandler

Creates an HTTP handler for Koa.

```typescript
createKoaHandler(bridge: Bridge, options?: HandlerOptions): Handler
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `streaming` | `boolean` | `true` | Enable streaming responses |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `cors` | `boolean` | `false` | Enable CORS headers |

## Exports

- `createKoaHandler`
- `createKoaMiddleware`

## License

MIT - see [LICENSE](./LICENSE) for details.
