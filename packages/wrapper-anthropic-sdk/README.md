# ai.matey.wrapper.anthropic-sdk

Anthropic SDK wrapper for AI Matey - use Anthropic-style code with any provider

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.wrapper.anthropic-sdk
```

## Usage

```typescript
import { createCompatibleClient } from 'ai.matey.wrapper.anthropic-sdk';

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
