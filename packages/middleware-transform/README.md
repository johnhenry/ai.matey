# ai.matey.middleware.transform

Transform middleware for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.middleware.transform
```

## Usage

```typescript
import { createTransformMiddleware } from 'ai.matey.middleware.transform';
import { Bridge } from 'ai.matey.core';

const bridge = new Bridge(frontend, backend);

// Add middleware
bridge.use(createTransformMiddleware({
  // options
}));
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
