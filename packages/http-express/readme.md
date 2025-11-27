# ai.matey.http.express

Express.js HTTP integration for ai.matey.

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.http.express
```

## Quick Start

```typescript
import express from 'express';
import { ExpressMiddleware } from 'ai.matey.http.express';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const app = express();
app.use(express.json());

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY! })
);

// Serve OpenAI-compatible API
app.use('/v1/chat/completions', ExpressMiddleware(bridge, {
  streaming: true,
  cors: true,
}));

app.listen(3000, () => {
  console.log('AI API server running on port 3000');
});
```

## Exports

### Middleware

- `ExpressMiddleware` - Express middleware for handling AI chat requests

### Adapters

- `ExpressRequestAdapter` - Converts Express Request to GenericRequest
- `ExpressResponseAdapter` - Converts Express Response to GenericResponse

## API Reference

### ExpressMiddleware

Creates Express middleware for handling AI chat requests.

```typescript
ExpressMiddleware(
  bridge: Bridge,
  options?: HTTPListenerOptions
): (req: Request, res: Response, next: NextFunction) => Promise<void>
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `streaming` | `boolean` | `true` | Enable SSE streaming responses |
| `cors` | `boolean \| CorsOptions` | `false` | Enable CORS headers |
| `timeout` | `number` | `30000` | Request timeout in ms |

### Example with Full CORS

```typescript
app.use('/v1/chat/completions', ExpressMiddleware(bridge, {
  streaming: true,
  cors: {
    origin: ['https://myapp.com'],
    methods: ['POST'],
    credentials: true,
  },
}));
```

### Using Adapters Directly

For custom handling, use the adapters:

```typescript
import { ExpressRequestAdapter, ExpressResponseAdapter } from 'ai.matey.http.express';
import { CoreHTTPHandler } from 'ai.matey.http.core';

app.post('/custom', async (req, res) => {
  const genericReq = new ExpressRequestAdapter(req);
  const genericRes = new ExpressResponseAdapter(res);

  const handler = new CoreHTTPHandler({ bridge });
  await handler.handle(genericReq, genericRes);
});
```

## License

MIT - see [LICENSE](./LICENSE) for details.
