# ai.matey.http.node

HTTP integration for Node.js http module

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.http.node
```

## Quick Start

```typescript
import { NodeHTTPListener } from 'ai.matey.http.node';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

const handler = NodeHTTPListener(bridge, {
  streaming: true,
  timeout: 30000,
});

// Use with your Node.js server
```

## API Reference

### NodeHTTPListener

Creates an HTTP handler for Node.js.

```typescript
NodeHTTPListener(bridge: Bridge, options?: HandlerOptions): Handler
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `streaming` | `boolean` | `true` | Enable streaming responses |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `cors` | `boolean` | `false` | Enable CORS headers |

## Exports

- `NodeHTTPListener`
- `createNodeHandler`

## License

MIT - see [LICENSE](./LICENSE) for details.
