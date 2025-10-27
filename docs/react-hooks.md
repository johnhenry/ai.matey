# React Hooks

**Status:** ✅ Available (v0.1.1+)
**Maturity:** Production Ready
**Dependencies:** Optional peer dependencies (React, React DOM, optionally Zod)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Hooks Reference](#hooks-reference)
  - [useChat](#usechat)
  - [useCompletion](#usecompletion)
  - [useObject](#useobject)
- [Quick Start](#quick-start)
- [Integration Examples](#integration-examples)
  - [Next.js App Router](#nextjs-app-router)
  - [Vite + React](#vite--react)
  - [Create React App](#create-react-app)
- [Advanced Usage](#advanced-usage)
- [Migration from Vercel AI SDK](#migration-from-vercel-ai-sdk)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

ai.matey's React hooks provide a seamless way to build AI-powered user interfaces. Compatible with the Vercel AI SDK API, these hooks offer state management, streaming support, and UI helpers for chat and completion interfaces.

**Key Benefits:**
- 🎣 React hooks for chat (`useChat`), completions (`useCompletion`), and structured data (`useObject`)
- 🌊 Streaming support with progressive UI updates
- 🔄 Built-in state management (no Redux/Zustand needed)
- 🎯 Type-safe with full TypeScript support
- 🔌 Provider-agnostic (works with any ai.matey backend adapter)
- 📦 Zero dependencies for core library (React is optional peer dependency)
- 🔁 Vercel AI SDK compatible API

**What's included:**
- **useChat**: Full-featured chat interface with message history, streaming, and controls
- **useCompletion**: Text generation/completion with streaming
- **useObject**: Structured data generation with Zod schema validation

## Features

### Common Features (All Hooks)

- **Streaming Support**: Real-time progressive updates as AI generates responses
- **State Management**: Automatic state handling (messages, loading, errors)
- **Error Handling**: Built-in error states and callbacks
- **Abort Control**: Cancel in-flight requests with stop()
- **Type Safety**: Full TypeScript support with generics
- **React 18/19**: Compatible with React 18+ and React 19+
- **Server Components**: Works with Next.js App Router (use "use client")

### Hook-Specific Features

**useChat:**
- Message history management
- Append/reload/stop controls
- Role-based messages (user/assistant/system)
- Streaming message updates

**useCompletion:**
- Simple text generation
- Input form helpers
- Streaming text updates

**useObject:**
- Structured data generation
- Zod schema validation
- Progressive object building
- Type inference from schemas

## Installation

React hooks require installing optional peer dependencies:

```bash
# Core dependencies (required)
npm install react react-dom

# For useObject (optional)
npm install zod
```

**Why optional?** ai.matey maintains **zero runtime dependencies** for backend use cases. React is only needed if you're building UIs.

## Hooks Reference

### useChat

Build chat interfaces with message history and streaming.

**Type Signature:**
```typescript
function useChat(options: UseChatOptions): UseChatHelpers
```

**Options:**
```typescript
interface UseChatOptions {
  backend: BackendAdapter;        // ai.matey backend adapter
  model?: string;                 // Model name (default: 'gpt-4')
  initialMessages?: UIMessage[];  // Pre-populate chat history
  maxTokens?: number;             // Max tokens per response
  temperature?: number;           // Temperature (0-2)
  streaming?: boolean;            // Enable streaming (default: true)
  onFinish?: (message: UIMessage) => void | Promise<void>;
  onError?: (error: Error) => void;
  onResponse?: (response: string) => void;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}
```

**Returns:**
```typescript
interface UseChatHelpers {
  messages: UIMessage[];          // All messages in chat
  input: string;                  // Current input value
  setInput: (input: string) => void;
  handleInputChange: (event: React.ChangeEvent<...>) => void;
  handleSubmit: (event?: React.FormEvent<...>) => void;
  sendMessage: (message: string) => Promise<void>;
  append: (message: UIMessage | Omit<UIMessage, 'id'>) => Promise<void>;
  reload: () => Promise<void>;    // Regenerate last response
  stop: () => void;               // Cancel current request
  setMessages: (messages: UIMessage[]) => void;
  status: 'idle' | 'streaming' | 'error';
  isLoading: boolean;
  error: Error | undefined;
}
```

**Example:**
```tsx
import { useChat } from 'ai.matey/react';
import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';

function ChatComponent() {
  const backend = createOpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY
  });

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    backend,
    model: 'gpt-4',
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          <strong>{m.role}:</strong> {m.content}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
```

### useCompletion

Generate text completions with streaming.

**Type Signature:**
```typescript
function useCompletion(options: UseCompletionOptions): UseCompletionHelpers
```

**Options:**
```typescript
interface UseCompletionOptions {
  backend: BackendAdapter;
  model?: string;
  initialInput?: string;
  initialCompletion?: string;
  maxTokens?: number;
  temperature?: number;
  streaming?: boolean;
  onFinish?: (prompt: string, completion: string) => void | Promise<void>;
  onError?: (error: Error) => void;
  onResponse?: (text: string) => void;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}
```

**Returns:**
```typescript
interface UseCompletionHelpers {
  completion: string;             // Generated text
  input: string;                  // Current input
  setInput: (input: string) => void;
  handleInputChange: (event: React.ChangeEvent<...>) => void;
  handleSubmit: (event?: React.FormEvent<...>) => void;
  complete: (prompt: string) => Promise<string | null>;
  setCompletion: (completion: string) => void;
  stop: () => void;
  isLoading: boolean;
  error: Error | undefined;
}
```

**Example:**
```tsx
import { useCompletion } from 'ai.matey/react';
import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';

function CompletionComponent() {
  const backend = createOpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY
  });

  const {
    completion,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
  } = useCompletion({
    backend,
    model: 'gpt-4',
  });

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <textarea value={input} onChange={handleInputChange} />
        <button disabled={isLoading}>Generate</button>
      </form>
      {completion && <div>{completion}</div>}
    </div>
  );
}
```

### useObject

Generate structured objects with schema validation.

**Type Signature:**
```typescript
function useObject<T>(options: UseObjectOptions<T>): UseObjectHelpers<T>
```

**Options:**
```typescript
interface UseObjectOptions<T> {
  backend: BackendAdapter;
  model?: string;
  schema?: ZodSchema<T>;          // Zod schema for validation
  maxTokens?: number;
  temperature?: number;
  streaming?: boolean;
  onFinish?: (object: T) => void | Promise<void>;
  onError?: (error: Error) => void;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}
```

**Returns:**
```typescript
interface UseObjectHelpers<T> {
  object: T | undefined;          // Generated object
  submit: (prompt: string) => Promise<T | null>;
  setObject: (object: T | undefined) => void;
  stop: () => void;
  isLoading: boolean;
  error: Error | undefined;
}
```

**Example:**
```tsx
import { useObject } from 'ai.matey/react';
import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';
import { z } from 'zod';

const recipeSchema = z.object({
  name: z.string(),
  ingredients: z.array(z.string()),
  steps: z.array(z.string()),
});

type Recipe = z.infer<typeof recipeSchema>;

function RecipeGenerator() {
  const backend = createOpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY
  });

  const { object: recipe, submit, isLoading } = useObject<Recipe>({
    backend,
    model: 'gpt-4',
    schema: recipeSchema,
  });

  return (
    <div>
      <button onClick={() => submit('chocolate chip cookies')}>
        Generate Recipe
      </button>
      {recipe && (
        <div>
          <h2>{recipe.name}</h2>
          <ul>
            {recipe.ingredients.map((i, idx) => <li key={idx}>{i}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## Quick Start

### 1. Install Dependencies

```bash
npm install ai.matey react react-dom
# Optional, for useObject:
npm install zod
```

### 2. Create Backend Adapter

```typescript
import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';

const backend = createOpenAIBackendAdapter({
  apiKey: process.env.OPENAI_API_KEY,
});
```

### 3. Use a Hook

```tsx
import { useChat } from 'ai.matey/react';

function App() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    backend,
    model: 'gpt-4',
  });

  return (
    <div>
      <div>
        {messages.map(m => (
          <div key={m.id}>{m.role}: {m.content}</div>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

## Integration Examples

### Next.js App Router

```tsx
// app/chat/page.tsx
'use client';

import React from 'react';
import { useChat } from 'ai.matey/react';
import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';

export default function ChatPage() {
  // Memoize backend to prevent recreating on each render
  const backend = React.useMemo(() => {
    return createOpenAIBackendAdapter({
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
    });
  }, []);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
  } = useChat({
    backend,
    model: 'gpt-4',
  });

  return (
    <div className="container">
      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={message.role}>
            {message.content}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          disabled={isLoading}
          placeholder="Type a message..."
        />
        <button type="submit" disabled={isLoading}>
          Send
        </button>
      </form>
    </div>
  );
}
```

**Important Notes for Next.js:**
- Add `'use client'` directive at the top of files using React hooks
- Use `NEXT_PUBLIC_` prefix for environment variables accessed in client components
- Memoize backend adapter with `React.useMemo()` to prevent unnecessary recreations

### Vite + React

```tsx
// src/App.tsx
import { useChat } from 'ai.matey/react';
import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';

const backend = createOpenAIBackendAdapter({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

function App() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    backend,
    model: 'gpt-4',
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>{m.role}: {m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button>Send</button>
      </form>
    </div>
  );
}

export default App;
```

**Environment variables in Vite:**
Create `.env.local`:
```
VITE_OPENAI_API_KEY=sk-...
```

### Create React App

```tsx
// src/App.tsx
import { useChat } from 'ai.matey/react';
import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';

const backend = createOpenAIBackendAdapter({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
});

function App() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    backend,
    model: 'gpt-4',
  });

  return (
    <div className="App">
      {messages.map(m => (
        <div key={m.id}>{m.role}: {m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button>Send</button>
      </form>
    </div>
  );
}

export default App;
```

**Environment variables in CRA:**
Create `.env.local`:
```
REACT_APP_OPENAI_API_KEY=sk-...
```

## Advanced Usage

### Multi-Provider Routing

Use different backends for different purposes:

```tsx
import { useState } from 'react';
import { useChat } from 'ai.matey/react';
import { createOpenAIBackendAdapter, createAnthropicBackendAdapter } from 'ai.matey/adapters/backend';

function MultiProviderChat() {
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai');

  const backend = provider === 'openai'
    ? createOpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
    : createAnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY });

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    backend,
    model: provider === 'openai' ? 'gpt-4' : 'claude-3-opus-20240229',
  });

  return (
    <div>
      <select value={provider} onChange={(e) => setProvider(e.target.value as any)}>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
      </select>
      {/* ... rest of UI ... */}
    </div>
  );
}
```

### Custom Message Rendering

```tsx
import { useChat, UIMessage } from 'ai.matey/react';

function MessageBubble({ message }: { message: UIMessage }) {
  return (
    <div className={`message ${message.role}`}>
      <div className="avatar">
        {message.role === 'user' ? '👤' : '🤖'}
      </div>
      <div className="content">
        <div className="role">{message.role}</div>
        <div className="text">{message.content}</div>
        <div className="timestamp">
          {message.createdAt?.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    backend,
    model: 'gpt-4',
  });

  return (
    <div>
      {messages.map(m => <MessageBubble key={m.id} message={m} />)}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
```

### Programmatic Message Appending

```tsx
import { useChat } from 'ai.matey/react';

function Chat() {
  const { messages, append, input, handleInputChange, handleSubmit } = useChat({
    backend,
    model: 'gpt-4',
  });

  const sendSystemMessage = () => {
    append({
      role: 'system',
      content: 'You are a helpful assistant specialized in TypeScript.',
      createdAt: new Date(),
    });
  };

  return (
    <div>
      <button onClick={sendSystemMessage}>Add System Prompt</button>
      {/* ... rest of UI ... */}
    </div>
  );
}
```

### Error Handling

```tsx
import { useChat } from 'ai.matey/react';

function Chat() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    error,
    reload,
  } = useChat({
    backend,
    model: 'gpt-4',
    onError: (error) => {
      console.error('Chat error:', error);
      // Send to error tracking service
    },
  });

  return (
    <div>
      {error && (
        <div className="error">
          <p>Error: {error.message}</p>
          <button onClick={reload}>Retry</button>
        </div>
      )}
      {/* ... rest of UI ... */}
    </div>
  );
}
```

### Streaming Progress Indicator

```tsx
import { useCompletion } from 'ai.matey/react';

function Completion() {
  const {
    completion,
    input,
    handleSubmit,
    isLoading,
    stop,
  } = useCompletion({
    backend,
    model: 'gpt-4',
  });

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <textarea value={input} onChange={handleInputChange} />
        {isLoading ? (
          <button onClick={stop} type="button">⏹ Stop</button>
        ) : (
          <button type="submit">Generate</button>
        )}
      </form>
      <div className="output">
        {completion}
        {isLoading && <span className="cursor">▊</span>}
      </div>
    </div>
  );
}
```

### Structured Data with Partial Updates

```tsx
import { useObject } from 'ai.matey/react';
import { z } from 'zod';

const eventSchema = z.object({
  title: z.string(),
  date: z.string(),
  location: z.string(),
  attendees: z.array(z.string()),
  agenda: z.array(z.object({
    time: z.string(),
    topic: z.string(),
  })),
});

type Event = z.infer<typeof eventSchema>;

function EventPlanner() {
  const { object: event, submit, isLoading } = useObject<Event>({
    backend,
    model: 'gpt-4',
    schema: eventSchema,
  });

  return (
    <div>
      <button onClick={() => submit('Plan a tech conference')}>
        Generate Event
      </button>

      {/* Show partial data as it streams */}
      {event && (
        <div>
          <h2>{event.title || 'Loading...'}</h2>
          {event.date && <p>Date: {event.date}</p>}
          {event.location && <p>Location: {event.location}</p>}

          {event.attendees && event.attendees.length > 0 && (
            <div>
              <h3>Attendees ({event.attendees.length})</h3>
              <ul>
                {event.attendees.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          {event.agenda && event.agenda.length > 0 && (
            <div>
              <h3>Agenda</h3>
              {event.agenda.map((item, i) => (
                <div key={i}>
                  <strong>{item.time}</strong>: {item.topic}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Migration from Vercel AI SDK

ai.matey React hooks are designed to be API-compatible with Vercel AI SDK. Migration is straightforward:

### Before (Vercel AI SDK)

```tsx
import { useChat } from 'ai/react';

function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
  });
  // ...
}
```

### After (ai.matey)

```tsx
import { useChat } from 'ai.matey/react';
import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';

const backend = createOpenAIBackendAdapter({
  apiKey: process.env.OPENAI_API_KEY,
});

function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    backend,  // Replace api with backend
    model: 'gpt-4',
  });
  // ...
}
```

**Key Differences:**

1. **No API Route Required**: ai.matey hooks call providers directly from the client
2. **Backend Adapter**: Use `backend` instead of `api` endpoint
3. **Provider Agnostic**: Switch providers by changing the adapter, not the hook code
4. **Model Parameter**: Specify `model` directly in hook options

**Security Note**: When using client-side hooks, API keys are exposed in the client bundle. For production apps, consider:
- Using edge functions with ai.matey adapters
- Environment variable restrictions (only expose NEXT_PUBLIC_ keys)
- Rate limiting and key rotation
- Or stick with API routes + ai.matey on the backend

## Best Practices

### 1. Memoize Backend Adapters

Prevent unnecessary re-initialization:

```tsx
const backend = React.useMemo(() => {
  return createOpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY,
  });
}, []);
```

### 2. Handle Errors Gracefully

```tsx
const { messages, error, reload } = useChat({
  backend,
  model: 'gpt-4',
  onError: (error) => {
    // Log to error tracking
    console.error('Chat error:', error);
  },
});

if (error) {
  return (
    <div>
      <p>Something went wrong: {error.message}</p>
      <button onClick={reload}>Try Again</button>
    </div>
  );
}
```

### 3. Use Stop Button for Long Generations

```tsx
const { isLoading, stop } = useCompletion({ backend, model: 'gpt-4' });

{isLoading && (
  <button onClick={stop}>Stop Generation</button>
)}
```

### 4. Validate useObject Schemas

```tsx
const schema = z.object({
  email: z.string().email(),  // Built-in validation
  age: z.number().min(0).max(120),
  tags: z.array(z.string()).min(1),
});
```

### 5. Persist Chat History

```tsx
import { useEffect } from 'react';
import { useChat } from 'ai.matey/react';

function Chat() {
  const { messages, setMessages, ...rest } = useChat({
    backend,
    model: 'gpt-4',
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('chat-history', JSON.stringify(messages));
  }, [messages]);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('chat-history');
    if (saved) {
      setMessages(JSON.parse(saved));
    }
  }, []);

  return (/* ... */);
}
```

### 6. Use Appropriate Temperatures

```tsx
// Creative writing (high temperature)
useCompletion({ backend, model: 'gpt-4', temperature: 0.9 });

// Data extraction (low temperature)
useObject({ backend, model: 'gpt-4', temperature: 0.1, schema });

// Balanced chat (medium temperature)
useChat({ backend, model: 'gpt-4', temperature: 0.7 });
```

## Troubleshooting

### React Not Found

**Error:**
```
React is not installed. Please install:
npm install react react-dom
```

**Solution:**
```bash
npm install react react-dom
```

### Zod Not Found (useObject)

**Error:**
```
Cannot find module 'zod'
```

**Solution:**
```bash
npm install zod
```

### Backend Adapter Errors

**Error:**
```
TypeError: Cannot read property 'execute' of undefined
```

**Solution:** Make sure backend adapter is created properly:

```tsx
// ❌ Wrong
const backend = createOpenAIBackendAdapter();

// ✅ Correct
const backend = createOpenAIBackendAdapter({
  apiKey: process.env.OPENAI_API_KEY,
});
```

### API Key Not Found

**Error:**
```
Error: API key is required
```

**Solution:** Set environment variables:

**Next.js:**
```bash
# .env.local
NEXT_PUBLIC_OPENAI_API_KEY=sk-...
```

**Vite:**
```bash
# .env.local
VITE_OPENAI_API_KEY=sk-...
```

**Create React App:**
```bash
# .env.local
REACT_APP_OPENAI_API_KEY=sk-...
```

### Infinite Re-renders

**Problem:** Backend adapter created in render causes infinite loop.

**Solution:** Memoize the adapter:

```tsx
// ❌ Wrong - creates new adapter every render
function Chat() {
  const backend = createOpenAIBackendAdapter({ apiKey: '...' });
  const { messages } = useChat({ backend, model: 'gpt-4' });
}

// ✅ Correct - memoized
function Chat() {
  const backend = React.useMemo(() =>
    createOpenAIBackendAdapter({ apiKey: '...' })
  , []);
  const { messages } = useChat({ backend, model: 'gpt-4' });
}
```

### Schema Validation Failures

**Error:**
```
Schema validation failed: ...
```

**Debug:** Check the AI's JSON output:

```tsx
const { object, error } = useObject({
  backend,
  model: 'gpt-4',
  schema,
  onError: (error) => {
    console.error('Validation error:', error);
    // Log the raw response to see what AI generated
  },
});
```

**Tips:**
- Use descriptive field names in your schema
- Add `.describe()` to schema fields for better AI understanding
- Lower temperature for more reliable structured output
- Try different models (GPT-4 generally better at JSON)

### Streaming Not Working

**Problem:** Responses appear all at once instead of streaming.

**Check:**

1. Streaming enabled:
```tsx
useChat({ backend, model: 'gpt-4', streaming: true }); // default is true
```

2. Backend supports streaming:
```tsx
// Some adapters may not support streaming
// Check adapter documentation
```

### Next.js "use client" Errors

**Error:**
```
Error: useState only works in Client Components
```

**Solution:** Add "use client" directive:

```tsx
'use client';

import { useChat } from 'ai.matey/react';

export default function ChatPage() {
  // ...
}
```

## Examples

Full working examples are available in the `examples/react/` directory:

- **`basic-chat.tsx`** - Simple chat interface with useChat
- **`basic-completion.tsx`** - Text generation with useCompletion
- **`nextjs-app-router.tsx`** - Next.js 13+ App Router integration
- **`recipe-generator.tsx`** - Structured data with useObject (recipes)
- **`contact-extractor.tsx`** - Data extraction with useObject

Run examples:
```bash
# Clone repo
git clone https://github.com/johnhenry/ai.matey.git
cd ai.matey

# Install dependencies
npm install
npm install react react-dom zod

# View examples
ls examples/react/
```

## API Reference

For complete TypeScript type definitions, see:
- [`src/react/types.ts`](../src/react/types.ts) - All hook types
- [`src/react/use-chat.ts`](../src/react/use-chat.ts) - useChat implementation
- [`src/react/use-completion.ts`](../src/react/use-completion.ts) - useCompletion implementation
- [`src/react/use-object.ts`](../src/react/use-object.ts) - useObject implementation

## Support

- **GitHub Issues**: [Report bugs](https://github.com/johnhenry/ai.matey/issues)
- **Documentation**: [Full docs](../README.md)
- **Examples**: [examples/react/](../examples/react/)

---

**Next Steps:**
- Try the [Quick Start](#quick-start)
- Explore [Integration Examples](#integration-examples)
- Read the [Best Practices](#best-practices)
- Check out working [Examples](../examples/react/)
