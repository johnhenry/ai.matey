# ai.matey.middleware.conversation-history

Conversation-history middleware for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.middleware.conversation-history
```

## Usage

```typescript
import { createConversationHistoryMiddleware } from 'ai.matey.middleware.conversation-history';
import { Bridge } from 'ai.matey.core';

const bridge = new Bridge(frontend, backend);

// Add middleware
bridge.use(createConversationHistoryMiddleware({
  // options
}));
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
