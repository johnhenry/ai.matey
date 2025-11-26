# ai.matey.react.core

Core React hooks for AI chat interactions

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.react.core
```

## Quick Start

```typescript
import { useChat } from 'ai.matey.react.core';

function ChatComponent() {
  const { messages, input, handleSubmit, setInput } = useChat({
    api: '/api/chat',
  });

  return (
    <div>
      {messages.map((m, i) => (
        <div key={i}>{m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

## Exports

- `useChat`
- `useCompletion`
- `useObject`

## API Reference

### useChat

See the TypeScript definitions for detailed API documentation.

### useCompletion

See the TypeScript definitions for detailed API documentation.

### useObject

See the TypeScript definitions for detailed API documentation.


## License

MIT - see [LICENSE](./LICENSE) for details.
