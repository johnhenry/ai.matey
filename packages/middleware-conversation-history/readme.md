# ai.matey.middleware.conversation-history

Conversation history middleware for maintaining context

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.middleware.conversation-history
```

## Quick Start

```typescript
import { createConversationHistoryMiddleware } from 'ai.matey.middleware.conversation-history';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

// Add middleware
bridge.use(createConversationHistoryMiddleware({
  maxMessages: /* value */,
  storage: /* value */,
}));
```

## API Reference

### createConversationHistoryMiddleware

Creates middleware for conversation history middleware for maintaining context.

#### Configuration

```typescript
createConversationHistoryMiddleware(config?: ConversationHistoryMiddlewareConfig): Middleware
```

| Option | Type | Description |
|--------|------|-------------|
| `maxMessages` | `any` | Maximum messages to retain |
| `storage` | `any` | Storage backend for history |

## Exports

- `createConversationHistoryMiddleware`

## Example

```typescript
import { createConversationHistoryMiddleware } from 'ai.matey.middleware.conversation-history';

const middleware = createConversationHistoryMiddleware({
  // configuration options
});

bridge.use(middleware);
```

## License

MIT - see [LICENSE](./LICENSE) for details.
