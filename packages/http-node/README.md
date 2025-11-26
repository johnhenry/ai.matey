# ai.matey.http.node

Node.js HTTP server adapter for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.http.node
```

## Usage

```typescript
import { createNodeHandler } from 'ai.matey.http.node';
import { Bridge } from 'ai.matey.core';

const bridge = new Bridge(frontend, backend);
const handler = createNodeHandler(bridge);

// Use with your Node server
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
