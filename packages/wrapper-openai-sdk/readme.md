# ai.matey.wrapper.openai-sdk

OpenAI SDK-compatible wrapper for any backend.

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.wrapper.openai-sdk
```

## Overview

Use the familiar OpenAI SDK API with **any** backend adapter. This wrapper uses `ai.matey.frontend.openai` internally for format conversions, ensuring consistent behavior with the OpenAI format specification.

## Quick Start

```typescript
import { OpenAI } from 'ai.matey.wrapper.openai-sdk';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';

// Create an SDK-compatible client backed by any adapter
const client = OpenAI(
  new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
);

// Use the same API as the official OpenAI SDK
const response = await client.chat.completions.create({
  model: 'claude-3-5-sonnet',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

## Streaming

```typescript
const stream = client.chat.completions.create({
  model: 'claude-3-5-sonnet',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}
```

## API Reference

### OpenAI

Creates an SDK-compatible client wrapper.

```typescript
OpenAI(backend: BackendAdapter, config?: OpenAISDKConfig): OpenAIClient
```

#### Config Options

```typescript
interface OpenAISDKConfig {
  streamMode?: 'delta' | 'full'; // How to emit stream chunks
}
```

## Exports

- `OpenAI` - Factory function
- `OpenAIClient` - Client class
- `Chat`, `ChatCompletions` - Chat API classes
- `Models` - Models API class
- Type exports from `ai.matey.frontend.openai`

## Architecture

This wrapper uses the `OpenAIFrontendAdapter` from `ai.matey.frontend.openai` internally:

```
Your Code (OpenAI SDK API)
    │
    ▼
OpenAI SDK Wrapper
    │
    ▼
OpenAIFrontendAdapter (format conversion)
    │
    ▼
Backend Adapter (Anthropic, Gemini, Ollama, etc.)
    │
    ▼
AI Provider
```

## Use Cases

### Migrate Existing Code

Replace your existing SDK import with ai.matey wrapper:

```typescript
// Before
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: '...' });

// After - same API, any backend!
import { OpenAI } from 'ai.matey.wrapper.openai-sdk';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
const client = OpenAI(new AnthropicBackendAdapter({ apiKey: '...' }));
```

### Use with Router for Fallback

```typescript
import { OpenAI } from 'ai.matey.wrapper.openai-sdk';
import { createRouter } from 'ai.matey.core';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';

const router = createRouter()
  .register('openai', new OpenAIBackendAdapter({ apiKey: '...' }))
  .register('anthropic', new AnthropicBackendAdapter({ apiKey: '...' }))
  .setFallbackChain(['openai', 'anthropic']);

// Use router as the backend - automatic fallback!
const client = OpenAI(router);
```

## Related Packages

| Package | Description |
|---------|-------------|
| `ai.matey.frontend.openai` | OpenAI format FrontendAdapter |
| `ai.matey.wrapper.anthropic-sdk` | Anthropic SDK wrapper |
| `ai.matey.wrapper.ir` | IR-native chat wrapper |

## License

MIT - see [LICENSE](./LICENSE) for details.
