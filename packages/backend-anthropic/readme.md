# ai.matey.backend.anthropic

Backend adapter for Anthropic API (Claude models)

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.backend.anthropic
```

## Quick Start

```typescript
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';

// Create the backend adapter
const backend = new AnthropicBackendAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  baseURL: process.env.ANTHROPIC_BASE_URL,  // Optional
});

// Create a bridge
const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  backend
);

// Make a request
const response = await bridge.chat({
  model: 'claude-3-opus',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

## API Reference

### AnthropicBackendAdapter

The main adapter class for Anthropic.

#### Constructor

```typescript
new AnthropicBackendAdapter(config: AnthropicBackendAdapterConfig)
```

#### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | `string` | Yes | API key for authentication |
| `baseUrl` | `string` | No | Custom base URL for API endpoint |

#### Methods

##### `execute(request: IRChatRequest): Promise<IRChatResponse>`

Execute a chat completion request.

```typescript
const response = await backend.execute({
  messages: [{ role: 'user', content: 'Hello!' }],
  parameters: { model: 'claude-3-opus' },
  metadata: { requestId: 'req-123', timestamp: Date.now() },
});
```

##### `executeStream(request: IRChatRequest): AsyncGenerator<IRStreamChunk>`

Execute a streaming chat completion request.

```typescript
const stream = backend.executeStream({
  messages: [{ role: 'user', content: 'Tell me a story' }],
  parameters: { model: 'claude-3-opus' },
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

- `claude-3-opus`
- `claude-3-sonnet`
- `claude-3-haiku`
- `claude-3-5-sonnet`

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
