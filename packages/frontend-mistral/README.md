# ai.matey.frontend.mistral

Mistral frontend adapter for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.frontend.mistral
```

## Usage

```typescript
import { MistralFrontendAdapter } from 'ai.matey.frontend.mistral';
import { Bridge } from 'ai.matey.core';

// Create a bridge that accepts Mistral format requests
const bridge = new Bridge(
  new MistralFrontendAdapter(),
  yourBackendAdapter
);
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
