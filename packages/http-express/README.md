# ai.matey.http.express

Express HTTP server adapter for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.http.express
```

## Usage

```typescript
import { createExpressHandler } from 'ai.matey.http.express';
import { Bridge } from 'ai.matey.core';

const bridge = new Bridge(frontend, backend);
const handler = createExpressHandler(bridge);

// Use with your Express server
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
