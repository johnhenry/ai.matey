# ai.matey.react.nextjs

Next.js App Router integration for AI chat.

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.react.nextjs
```

## Quick Start

### Client Component

```tsx
'use client';

import { useChat } from 'ai.matey.react.nextjs';

export function ChatComponent() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat();

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

### API Route

```typescript
// app/api/chat/route.ts
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY! })
);

export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = await bridge.chatStream({
    model: 'gpt-4',
    messages,
    stream: true,
  });

  // Return streaming response
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

## Exports

### Hooks

- `useChat` - Chat hook optimized for Next.js (defaults to `/api/chat`)
- `useCompletion` - Completion hook (defaults to `/api/completion`)

### Utilities

- `generateAIMetadata` - Generate Next.js metadata from AI content

### Types (re-exported from react.core)

- `Message`, `ToolCall`, `ToolInvocation`, `Tool`
- `ChatRequestOptions`, `CompletionRequestOptions`
- `UseNextChatOptions`, `UseNextCompletionOptions`
- `AIMetadata`, `GenerateMetadataOptions`

## API Reference

### useChat

Next.js-optimized chat hook with sensible defaults.

```tsx
const {
  messages,
  input,
  handleInputChange,
  handleSubmit,
  append,
  reload,
  stop,
  isLoading,
  error,
} = useChat({
  api: '/api/chat',              // Default for Next.js
  streamProtocol: 'data',        // SSE protocol
  serverAction: async (body) => {}, // Use Server Action instead of API route
  experimental: {
    partialHydration: false,
    suspense: false,
  },
  // ...all options from react.core useChat
});
```

### useCompletion

Text completion hook for Next.js.

```tsx
const {
  completion,
  input,
  handleInputChange,
  handleSubmit,
  complete,
  isLoading,
  error,
} = useCompletion({
  api: '/api/completion',        // Default for Next.js
  streamProtocol: 'data',
  // ...all options from react.core useCompletion
});
```

### generateAIMetadata

Generate Next.js Metadata from AI-generated content (useful for SEO).

```typescript
// app/blog/[slug]/page.tsx
import { generateAIMetadata } from 'ai.matey.react.nextjs';

export async function generateMetadata({ params }) {
  const article = await getAIArticle(params.slug);

  return generateAIMetadata(article.content, article.aiMetadata, {
    titleTemplate: '%s | My Blog',
    descriptionTemplate: '%s',
    includeAttribution: true,  // Adds ai-generated meta tag
  });
}
```

**Returns:**
```typescript
{
  title: string;
  description: string;
  other?: {
    'ai-generated': 'true';
    'ai-attribution'?: string;
  };
}
```

## License

MIT - see [LICENSE](./LICENSE) for details.
