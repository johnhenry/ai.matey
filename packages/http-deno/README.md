# ai.matey.http.deno

HTTP integration for Deno

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.http.deno
```

## Quick Start

```typescript
import { createDenoHandler } from 'ai.matey.http.deno';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

const handler = createDenoHandler(bridge, {
  streaming: true,
  timeout: 30000,
});

// Use with your Deno server
```

## API Reference

### createDenoHandler

Creates an HTTP handler for Deno.

```typescript
createDenoHandler(bridge: Bridge, options?: HandlerOptions): Handler
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `streaming` | `boolean` | `true` | Enable streaming responses |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `cors` | `boolean` | `false` | Enable CORS headers |

## Exports

- `createDenoHandler`

## License

MIT - see [LICENSE](./LICENSE) for details.
