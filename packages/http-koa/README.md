# ai.matey.http.koa

Koa HTTP server adapter for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.http.koa
```

## Usage

```typescript
import { createKoaHandler } from 'ai.matey.http.koa';
import { Bridge } from 'ai.matey.core';

const bridge = new Bridge(frontend, backend);
const handler = createKoaHandler(bridge);

// Use with your Koa server
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
