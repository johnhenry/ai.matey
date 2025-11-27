# ai.matey.backend.mock

Mock backend adapter for testing

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.backend.mock
```

## Quick Start

```typescript
import { MockBackendAdapter } from 'ai.matey.backend.mock';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';

// Create the backend adapter for testing
const backend = new MockBackendAdapter({
  apiKey: 'mock-api-key',  // Any value works for mock
});

// Create a bridge
const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  backend
);

// Make a request
const response = await bridge.chat({
  model: 'mock-gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

## API Reference

### MockBackendAdapter

The main adapter class for Mock.

#### Constructor

```typescript
new MockBackendAdapter(config: MockBackendAdapterConfig)
```

#### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `defaultResponse` | `string` | No | defaultResponse configuration |
| `modelResponses` | `string` | No | modelResponses configuration |
| `responseGenerator` | `string` | No | responseGenerator configuration |

#### Methods

##### `execute(request: IRChatRequest): Promise<IRChatResponse>`

Execute a chat completion request.

```typescript
const response = await backend.execute({
  messages: [{ role: 'user', content: 'Hello!' }],
  parameters: { model: 'mock-gpt-4' },
  metadata: { requestId: 'req-123', timestamp: Date.now() },
});
```

##### `executeStream(request: IRChatRequest): AsyncGenerator<IRStreamChunk>`

Execute a streaming chat completion request.

```typescript
const stream = backend.executeStream({
  messages: [{ role: 'user', content: 'Tell me a story' }],
  parameters: { model: 'mock-gpt-4' },
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

- `mock-gpt-4`
- `mock-claude-3`
- `mock-fast`

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
