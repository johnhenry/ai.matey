# ai.matey.middleware.security

Security middleware for rate limiting and access control

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.middleware.security
```

## Quick Start

```typescript
import { createSecurityMiddleware } from 'ai.matey.middleware.security';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

// Add middleware
bridge.use(createSecurityMiddleware({
  rateLimit: /* value */,
  allowedModels: /* value */,
  blockedPatterns: /* value */,
}));
```

## API Reference

### createSecurityMiddleware

Creates middleware for security middleware for rate limiting and access control.

#### Configuration

```typescript
createSecurityMiddleware(config?: SecurityMiddlewareConfig): Middleware
```

| Option | Type | Description |
|--------|------|-------------|
| `rateLimit` | `any` | Rate limiting configuration |
| `allowedModels` | `any` | List of allowed models |
| `blockedPatterns` | `any` | Patterns to block |

## Exports

- `createSecurityMiddleware`

## Example

```typescript
import { createSecurityMiddleware } from 'ai.matey.middleware.security';

const middleware = createSecurityMiddleware({
  // configuration options
});

bridge.use(middleware);
```

## License

MIT - see [LICENSE](./LICENSE) for details.
