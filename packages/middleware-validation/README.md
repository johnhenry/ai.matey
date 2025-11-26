# ai.matey.middleware.validation

Validation middleware for request validation

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.middleware.validation
```

## Quick Start

```typescript
import { createValidationMiddleware } from 'ai.matey.middleware.validation';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

// Add middleware
bridge.use(createValidationMiddleware({
  validateRequest: /* value */,
  validateResponse: /* value */,
  schema: /* value */,
}));
```

## API Reference

### createValidationMiddleware

Creates middleware for validation middleware for request validation.

#### Configuration

```typescript
createValidationMiddleware(config?: ValidationMiddlewareConfig): Middleware
```

| Option | Type | Description |
|--------|------|-------------|
| `validateRequest` | `any` | Request validation function |
| `validateResponse` | `any` | Response validation function |
| `schema` | `any` | Validation schema |

## Exports

- `createValidationMiddleware`

## Example

```typescript
import { createValidationMiddleware } from 'ai.matey.middleware.validation';

const middleware = createValidationMiddleware({
  // configuration options
});

bridge.use(middleware);
```

## License

MIT - see [LICENSE](./LICENSE) for details.
