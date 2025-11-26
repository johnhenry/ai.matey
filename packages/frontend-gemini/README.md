# ai.matey.frontend.gemini

Gemini frontend adapter for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.frontend.gemini
```

## Usage

```typescript
import { GeminiFrontendAdapter } from 'ai.matey.frontend.gemini';
import { Bridge } from 'ai.matey.core';

// Create a bridge that accepts Gemini format requests
const bridge = new Bridge(
  new GeminiFrontendAdapter(),
  yourBackendAdapter
);
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
