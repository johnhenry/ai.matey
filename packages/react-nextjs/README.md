# ai.matey.react.nextjs

Next.js App Router integration

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.react.nextjs
```

## Quick Start

```typescript
import { createStreamingResponse } from 'ai.matey.react.nextjs';

function ChatComponent() {
  const { messages, input, handleSubmit, setInput } = createStreamingResponse({
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

- `createStreamingResponse`
- `AIProvider`

## API Reference

### createStreamingResponse

See the TypeScript definitions for detailed API documentation.

### AIProvider

See the TypeScript definitions for detailed API documentation.


## License

MIT - see [LICENSE](./LICENSE) for details.
