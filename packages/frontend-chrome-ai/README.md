# ai.matey.frontend.chrome-ai

Chrome-ai frontend adapter for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.frontend.chrome-ai
```

## Usage

```typescript
import { ChromeAiFrontendAdapter } from 'ai.matey.frontend.chrome-ai';
import { Bridge } from 'ai.matey.core';

// Create a bridge that accepts Chrome Ai format requests
const bridge = new Bridge(
  new ChromeAiFrontendAdapter(),
  yourBackendAdapter
);
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
