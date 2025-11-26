# ai.matey.react.core

Core React hooks for AI chat interactions.

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.react.core
```

## Quick Start

```tsx
import { useChat } from 'ai.matey.react.core';

function ChatComponent() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          <strong>{m.role}:</strong> {m.content}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}
```

## Exports

### Hooks

- `useChat` - Chat interface with streaming support
- `useCompletion` - Text completion interface
- `useObject` - Structured object generation

### Types

- `Message` - Chat message type
- `ToolCall`, `ToolInvocation`, `Tool` - Tool calling types
- `UseChatOptions`, `UseChatReturn` - useChat types
- `UseCompletionOptions`, `UseCompletionReturn` - useCompletion types
- `UseObjectOptions`, `UseObjectReturn` - useObject types

## API Reference

### useChat

React hook for building chat interfaces with streaming support.

```tsx
const {
  messages,        // Message[] - Chat history
  input,           // string - Current input value
  setInput,        // (value: string) => void - Set input
  handleInputChange, // (e: ChangeEvent) => void - Input change handler
  handleSubmit,    // (e?: FormEvent) => void - Form submit handler
  append,          // (message: Message | string) => Promise<string | null>
  reload,          // () => Promise<string | null> - Reload last response
  stop,            // () => void - Stop streaming
  setMessages,     // (messages: Message[]) => void
  isLoading,       // boolean - Request in progress
  error,           // Error | undefined
  data,            // unknown[] | undefined - Additional data
} = useChat({
  api: '/api/chat',           // API endpoint (default: '/api/chat')
  initialMessages: [],        // Initial messages
  initialInput: '',           // Initial input value
  id: 'chat-1',              // Chat instance ID
  headers: {},               // Request headers
  body: {},                  // Extra request body fields
  onFinish: (message) => {}, // Called when response completes
  onError: (error) => {},    // Called on error
  onResponse: (response) => {}, // Called with fetch response
  streamProtocol: 'data',    // 'data' (SSE) or 'text'
});
```

### useCompletion

React hook for text completion interfaces.

```tsx
const {
  completion,      // string - Current completion
  input,           // string - Current input
  setInput,        // (value: string) => void
  handleInputChange,
  handleSubmit,
  complete,        // (prompt: string) => Promise<string | null>
  stop,
  isLoading,
  error,
} = useCompletion({
  api: '/api/completion',
  // ... similar options to useChat
});
```

### useObject

React hook for generating structured objects.

```tsx
const {
  object,          // T | undefined - Generated object
  submit,          // (input: string) => void
  isLoading,
  error,
} = useObject<MyType>({
  api: '/api/object',
  schema: myZodSchema, // Zod schema for validation
});
```

## License

MIT - see [LICENSE](./LICENSE) for details.
