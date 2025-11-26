# ai.matey.frontend.anthropic

Anthropic frontend adapter for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.frontend.anthropic
```

## Usage

```typescript
import { AnthropicFrontendAdapter } from 'ai.matey.frontend.anthropic';
import { Bridge } from 'ai.matey.core';

// Create a bridge that accepts Anthropic format requests
const bridge = new Bridge(
  new AnthropicFrontendAdapter(),
  yourBackendAdapter
);
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
