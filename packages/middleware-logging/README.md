# ai.matey.middleware.logging

Logging middleware for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.middleware.logging
```

## Usage

```typescript
import { createLoggingMiddleware } from 'ai.matey.middleware.logging';
import { Bridge } from 'ai.matey.core';

const bridge = new Bridge(frontend, backend);

// Add middleware
bridge.use(createLoggingMiddleware({
  // options
}));
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
