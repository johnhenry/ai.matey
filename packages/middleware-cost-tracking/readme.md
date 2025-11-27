# ai.matey.middleware.cost-tracking

Cost tracking middleware for usage monitoring

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.middleware.cost-tracking
```

## Quick Start

```typescript
import { createCostTrackingMiddleware } from 'ai.matey.middleware.cost-tracking';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

// Add middleware
bridge.use(createCostTrackingMiddleware({
  costPerToken: /* value */,
  onCost: /* value */,
}));
```

## API Reference

### createCostTrackingMiddleware

Creates middleware for cost tracking middleware for usage monitoring.

#### Configuration

```typescript
createCostTrackingMiddleware(config?: CostTrackingMiddlewareConfig): Middleware
```

| Option | Type | Description |
|--------|------|-------------|
| `costPerToken` | `any` | Cost per token for tracking |
| `onCost` | `any` | Callback for cost events |

## Exports

- `createCostTrackingMiddleware`

## Example

```typescript
import { createCostTrackingMiddleware } from 'ai.matey.middleware.cost-tracking';

const middleware = createCostTrackingMiddleware({
  // configuration options
});

bridge.use(middleware);
```

## License

MIT - see [LICENSE](./LICENSE) for details.
