# ai.matey.wrapper.anymethod

Anymethod wrapper for AI Matey - natural language method interface

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.wrapper.anymethod
```

## Usage

```typescript
import { createCompatibleClient } from 'ai.matey.wrapper.anymethod';

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
