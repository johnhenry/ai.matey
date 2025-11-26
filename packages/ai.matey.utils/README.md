# ai.matey.utils

Utility functions for AI Matey - Universal AI Adapter System

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.utils
```

## Usage

This is the main umbrella package that re-exports all functionality.
For better tree-shaking, consider importing from specific packages:

```typescript
// Import everything (convenience)
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

// Or import specific packages (better for bundle size)
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
```

## Available Packages

See the [main documentation](https://github.com/johnhenry/ai.matey) for a full list of available packages.

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
