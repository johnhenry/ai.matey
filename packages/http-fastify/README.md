# ai.matey.http.fastify

Fastify HTTP server adapter for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.http.fastify
```

## Usage

```typescript
import { createFastifyHandler } from 'ai.matey.http.fastify';
import { Bridge } from 'ai.matey.core';

const bridge = new Bridge(frontend, backend);
const handler = createFastifyHandler(bridge);

// Use with your Fastify server
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
