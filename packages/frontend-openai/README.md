# ai.matey.frontend.openai

Openai frontend adapter for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.frontend.openai
```

## Usage

```typescript
import { OpenaiFrontendAdapter } from 'ai.matey.frontend.openai';
import { Bridge } from 'ai.matey.core';

// Create a bridge that accepts Openai format requests
const bridge = new Bridge(
  new OpenaiFrontendAdapter(),
  yourBackendAdapter
);
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
