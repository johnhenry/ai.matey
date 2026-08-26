# @johnhenry/aimatey-http-core

> **Note:** Previously published as `ai.matey.http.core@0.3.1`.

Core HTTP utilities shared across integrations

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install @johnhenry/aimatey-http-core
```

## Quick Start

```typescript
import { createCorsMiddleware } from '@johnhenry/aimatey-http-core';
import { Bridge } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { OpenAIBackendAdapter } from '@johnhenry/aimatey-backend/openai';

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
