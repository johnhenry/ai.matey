# ai.matey.middleware.caching

Caching middleware for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.middleware.caching
```

## Usage

```typescript
import { createCachingMiddleware } from 'ai.matey.middleware.caching';
import { Bridge } from 'ai.matey.core';

const bridge = new Bridge(frontend, backend);

// Add middleware
bridge.use(createCachingMiddleware({
  // options
}));
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
