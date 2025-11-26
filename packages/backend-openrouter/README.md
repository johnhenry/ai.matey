# ai.matey.backend.openrouter

Backend adapter for OpenRouter (multi-provider routing)

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.backend.openrouter
```

## Quick Start

```typescript
import { OpenRouterBackendAdapter } from 'ai.matey.backend.openrouter';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';

// Create the backend adapter
const backend = new OpenRouterBackendAdapter({
  apiKey: process.env._A_P_I_K_E_Y,
});

// Create a bridge
const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  backend
);

// Make a request
const response = await bridge.chat({
  model: 'openai/gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

## API Reference

### OpenRouterBackendAdapter

The main adapter class for OpenRouter.

#### Constructor

```typescript
new OpenRouterBackendAdapter(config: OpenRouterBackendAdapterConfig)
```

#### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | `string` | Yes | API key for authentication |

#### Methods

##### `execute(request: IRChatRequest): Promise<IRChatResponse>`

Execute a chat completion request.

```typescript
const response = await backend.execute({
  messages: [{ role: 'user', content: 'Hello!' }],
  parameters: { model: 'openai/gpt-4' },
  metadata: { requestId: 'req-123', timestamp: Date.now() },
});
```

##### `executeStream(request: IRChatRequest): AsyncGenerator<IRStreamChunk>`

Execute a streaming chat completion request.

```typescript
const stream = backend.executeStream({
  messages: [{ role: 'user', content: 'Tell me a story' }],
  parameters: { model: 'openai/gpt-4' },
  metadata: { requestId: 'req-123', timestamp: Date.now() },
});

for await (const chunk of stream) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.delta);
  }
}
```

##### `listModels(): Promise<ListModelsResult>`

List available models.

```typescript
const models = await backend.listModels();
console.log(models.models.map(m => m.id));
```

## Supported Models

- `openai/gpt-4`
- `anthropic/claude-3-opus`
- `google/gemini-pro`

## Streaming Support

This adapter supports streaming responses. Use `executeStream()` for real-time token generation.

## Error Handling

```typescript
import { AuthenticationError, RateLimitError } from 'ai.matey.errors';

try {
  const response = await backend.execute(request);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited, retry after:', error.retryAfter);
  }
}
```

## License

MIT - see [LICENSE](./LICENSE) for details.
