# ai.matey.middleware.transform

Transform middleware for request/response modification

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.middleware.transform
```

## Quick Start

```typescript
import { createTransformMiddleware } from 'ai.matey.middleware.transform';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

// Add middleware
bridge.use(createTransformMiddleware({
  transformRequest: /* value */,
  transformResponse: /* value */,
  transformMessages: /* value */,
}));
```

## API Reference

### createTransformMiddleware

Creates middleware for transform middleware for request/response modification.

#### Configuration

```typescript
createTransformMiddleware(config?: TransformMiddlewareConfig): Middleware
```

| Option | Type | Description |
|--------|------|-------------|
| `transformRequest` | `Function` | Function to transform requests |
| `transformResponse` | `Function` | Function to transform responses |
| `transformMessages` | `Function` | Function to transform messages |

## Exports

- `createTransformMiddleware`

## Example

```typescript
import { createTransformMiddleware } from 'ai.matey.middleware.transform';

const middleware = createTransformMiddleware({
  // configuration options
});

bridge.use(middleware);
```

## License

MIT - see [LICENSE](./LICENSE) for details.
