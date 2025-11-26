# ai.matey.wrapper.openai-sdk

OpenAI SDK-compatible wrapper for any backend

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.wrapper.openai-sdk
```

## Quick Start

```typescript
import { OpenAI } from 'ai.matey.wrapper.openai-sdk';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';

// Create an SDK-compatible client backed by any adapter
const client = OpenAI(
  new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
);

// Use the same API as the official SDK
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## API Reference

### OpenAI

Creates an SDK-compatible client wrapper.

```typescript
OpenAI(backend: BackendAdapter, config?: WrapperConfig): Client
```

## Exports

- `OpenAI`
- `OpenAIClient`
- `ChatCompletions`

## Use Cases

### Migrate Existing Code

Replace your existing SDK import with ai.matey wrapper:

```typescript
// Before
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: '...' });

// After
import { OpenAI } from 'ai.matey.wrapper.openai-sdk';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
const client = OpenAI(new AnthropicBackendAdapter({ apiKey: '...' }));

// Same API, different backend!
```

## License

MIT - see [LICENSE](./LICENSE) for details.
