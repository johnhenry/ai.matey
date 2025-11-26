# ai.matey.react.hooks

Additional React hooks for AI features

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.react.hooks
```

## Quick Start

```typescript
import { useAssistant } from 'ai.matey.react.hooks';

function ChatComponent() {
  const { messages, input, handleSubmit, setInput } = useAssistant({
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

- `useAssistant`
- `useStream`
- `useTokenCount`

## API Reference

### useAssistant

See the TypeScript definitions for detailed API documentation.

### useStream

See the TypeScript definitions for detailed API documentation.

### useTokenCount

See the TypeScript definitions for detailed API documentation.


## License

MIT - see [LICENSE](./LICENSE) for details.
