# ai.matey.frontend.ollama

Ollama frontend adapter for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.frontend.ollama
```

## Usage

```typescript
import { OllamaFrontendAdapter } from 'ai.matey.frontend.ollama';
import { Bridge } from 'ai.matey.core';

// Create a bridge that accepts Ollama format requests
const bridge = new Bridge(
  new OllamaFrontendAdapter(),
  yourBackendAdapter
);
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
