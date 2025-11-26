# ai.matey.http.express

HTTP integration for Express.js

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.http.express
```

## Quick Start

```typescript
import { createExpressHandler } from 'ai.matey.http.express';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

const handler = createExpressHandler(bridge, {
  streaming: true,
  timeout: 30000,
});

// Use with your Express server
```

## API Reference

### createExpressHandler

Creates an HTTP handler for Express.

```typescript
createExpressHandler(bridge: Bridge, options?: HandlerOptions): Handler
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `streaming` | `boolean` | `true` | Enable streaming responses |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `cors` | `boolean` | `false` | Enable CORS headers |

## Exports

- `createExpressHandler`
- `createExpressMiddleware`

## License

MIT - see [LICENSE](./LICENSE) for details.
