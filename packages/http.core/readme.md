# ai.matey.http.core

Core HTTP utilities shared across integrations

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.http.core
```

## Quick Start

```typescript
import { createCorsMiddleware } from 'ai.matey.http.core';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

const handler = createCorsMiddleware(bridge, {
  streaming: true,
  timeout: 30000,
});

// Use with your Core server
```

## API Reference

### createCorsMiddleware

Creates an HTTP handler for Core.

```typescript
createCorsMiddleware(bridge: Bridge, options?: HandlerOptions): Handler
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `streaming` | `boolean` | `true` | Enable streaming responses |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `cors` | `boolean` | `false` | Enable CORS headers |

## Exports

- `createCorsMiddleware`
- `validateApiKey`
- `parseRequestBody`

## License

MIT - see [LICENSE](./LICENSE) for details.
