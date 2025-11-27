# ai.matey.http.fastify

HTTP integration for Fastify

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.http.fastify
```

## Quick Start

```typescript
import { createFastifyHandler } from 'ai.matey.http.fastify';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

const handler = createFastifyHandler(bridge, {
  streaming: true,
  timeout: 30000,
});

// Use with your Fastify server
```

## API Reference

### createFastifyHandler

Creates an HTTP handler for Fastify.

```typescript
createFastifyHandler(bridge: Bridge, options?: HandlerOptions): Handler
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `streaming` | `boolean` | `true` | Enable streaming responses |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `cors` | `boolean` | `false` | Enable CORS headers |

## Exports

- `createFastifyHandler`
- `createFastifyPlugin`

## License

MIT - see [LICENSE](./LICENSE) for details.
