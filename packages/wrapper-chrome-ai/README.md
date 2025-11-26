# ai.matey.wrapper.chrome-ai

Chrome AI wrapper for AI Matey - use Chrome AI API with any provider

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.wrapper.chrome-ai
```

## Usage

```typescript
import { createCompatibleClient } from 'ai.matey.wrapper.chrome-ai';

// Create a drop-in replacement for the official SDK
const client = createCompatibleClient({
  backend: yourBackendAdapter,
});

// Use the same API as the official SDK
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
