# ai.matey.react.stream

React components for streaming AI responses

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.react.stream
```

## Quick Start

```typescript
import { StreamProvider } from 'ai.matey.react.stream';

function ChatComponent() {
  const { messages, input, handleSubmit, setInput } = StreamProvider({
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

- `StreamProvider`
- `StreamText`
- `TypeWriter`

## API Reference

### StreamProvider

See the TypeScript definitions for detailed API documentation.

### StreamText

See the TypeScript definitions for detailed API documentation.

### TypeWriter

See the TypeScript definitions for detailed API documentation.


## License

MIT - see [LICENSE](./LICENSE) for details.
