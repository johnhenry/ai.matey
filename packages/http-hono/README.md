# ai.matey.http.hono

Hono HTTP server adapter for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.http.hono
```

## Usage

```typescript
import { createHonoHandler } from 'ai.matey.http.hono';
import { Bridge } from 'ai.matey.core';

const bridge = new Bridge(frontend, backend);
const handler = createHonoHandler(bridge);

// Use with your Hono server
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
