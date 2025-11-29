# ai.matey.native.node-llamacpp

Native llama.cpp integration via node-llama-cpp

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.native.node-llamacpp
```

## Requirements

- Node.js 18+

- GGUF model file

## Quick Start

```typescript
import { NodeLlamaCppBackend } from 'ai.matey.native.node-llamacpp';

const backend = new NodeLlamaCppBackend({
  // configuration
});
```

## Exports

- `NodeLlamaCppBackend`

## License

MIT - see [LICENSE](./LICENSE) for details.
