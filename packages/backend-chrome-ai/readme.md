# ai.matey.backend.chrome-ai

Backend adapter for Chrome built-in AI (experimental)

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.backend.chrome-ai
```

## Quick Start

```typescript
import { ChromeAIBackendAdapter } from 'ai.matey.backend.chrome-ai';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';

// Create the backend adapter
const backend = new ChromeAIBackendAdapter({

});

// Create a bridge
const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  backend
);

// Make a request
const response = await bridge.chat({
  model: 'Built-in Chrome AI model',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

## API Reference

### ChromeAIBackendAdapter

The main adapter class for Chrome AI.

#### Constructor

```typescript
new ChromeAIBackendAdapter(config: ChromeAIBackendAdapterConfig)
```

#### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|


#### Methods

##### `execute(request: IRChatRequest): Promise<IRChatResponse>`

Execute a chat completion request.

```typescript
const response = await backend.execute({
  messages: [{ role: 'user', content: 'Hello!' }],
  parameters: { model: 'Built-in Chrome AI model' },
  metadata: { requestId: 'req-123', timestamp: Date.now() },
});
```

##### `executeStream(request: IRChatRequest): AsyncGenerator<IRStreamChunk>`

Execute a streaming chat completion request.

```typescript
const stream = backend.executeStream({
  messages: [{ role: 'user', content: 'Tell me a story' }],
  parameters: { model: 'Built-in Chrome AI model' },
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

- `Built-in Chrome AI model`

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
