# ai.matey.wrapper.anthropic-sdk

Anthropic SDK-compatible wrapper for any backend.

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.wrapper.anthropic-sdk
```

## Overview

Use the familiar Anthropic SDK API with **any** backend adapter. This wrapper uses `ai.matey.frontend.anthropic` internally for format conversions, ensuring consistent behavior with the Anthropic format specification.

## Quick Start

```typescript
import { Anthropic } from 'ai.matey.wrapper.anthropic-sdk';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

// Create an SDK-compatible client backed by any adapter
const client = Anthropic(
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

// Use the same API as the official Anthropic SDK
const message = await client.messages.create({
  model: 'gpt-4',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(message.content[0].text);
```

## Streaming

```typescript
const stream = client.messages.create({
  model: 'gpt-4',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    process.stdout.write(event.delta.text);
  }
}
```

## System Prompt

```typescript
const message = await client.messages.create({
  model: 'gpt-4',
  max_tokens: 1024,
  system: 'You are a helpful assistant that speaks like a pirate.',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## API Reference

### Anthropic

Creates an SDK-compatible client wrapper.

```typescript
Anthropic(backend: BackendAdapter, config?: AnthropicSDKConfig): AnthropicClient
```

#### Config Options

```typescript
interface AnthropicSDKConfig {
  streamMode?: 'delta' | 'full'; // How to emit stream chunks
}
```

## Exports

- `Anthropic` - Factory function
- `AnthropicClient` - Client class
- `Messages` - Messages API class
- `Models` - Models API class
- Type exports from `ai.matey.frontend.anthropic`

## Architecture

This wrapper uses the `AnthropicFrontendAdapter` from `ai.matey.frontend.anthropic` internally:

```
Your Code (Anthropic SDK API)
    │
    ▼
Anthropic SDK Wrapper
    │
    ▼
AnthropicFrontendAdapter (format conversion)
    │
    ▼
Backend Adapter (OpenAI, Gemini, Ollama, etc.)
    │
    ▼
AI Provider
```

## Use Cases

### Migrate Existing Code

Replace your existing SDK import with ai.matey wrapper:

```typescript
// Before
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: '...' });

// After - same API, any backend!
import { Anthropic } from 'ai.matey.wrapper.anthropic-sdk';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
const client = Anthropic(new OpenAIBackendAdapter({ apiKey: '...' }));
```

### Use with Router for Fallback

```typescript
import { Anthropic } from 'ai.matey.wrapper.anthropic-sdk';
import { createRouter } from 'ai.matey.core';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const router = createRouter()
  .register('anthropic', new AnthropicBackendAdapter({ apiKey: '...' }))
  .register('openai', new OpenAIBackendAdapter({ apiKey: '...' }))
  .setFallbackChain(['anthropic', 'openai']);

// Use router as the backend - automatic fallback!
const client = Anthropic(router);
```

## Related Packages

| Package | Description |
|---------|-------------|
| `ai.matey.frontend.anthropic` | Anthropic format FrontendAdapter |
| `ai.matey.wrapper.openai-sdk` | OpenAI SDK wrapper |
| `ai.matey.wrapper.ir` | IR-native chat wrapper |

## License

MIT - see [LICENSE](./LICENSE) for details.
