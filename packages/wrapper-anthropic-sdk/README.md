# ai.matey.wrapper.anthropic-sdk

Anthropic SDK-compatible wrapper for any backend

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.wrapper.anthropic-sdk
```

## Quick Start

```typescript
import { Anthropic } from 'ai.matey.wrapper.anthropic-sdk';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';

// Create an SDK-compatible client backed by any adapter
const client = Anthropic(
  new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
);

// Use the same API as the official SDK
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## API Reference

### Anthropic

Creates an SDK-compatible client wrapper.

```typescript
Anthropic(backend: BackendAdapter, config?: WrapperConfig): Client
```

## Exports

- `Anthropic`
- `AnthropicClient`
- `Messages`

## Use Cases

### Migrate Existing Code

Replace your existing SDK import with ai.matey wrapper:

```typescript
// Before
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: '...' });

// After
import { Anthropic } from 'ai.matey.wrapper.anthropic-sdk';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
const client = Anthropic(new AnthropicBackendAdapter({ apiKey: '...' }));

// Same API, different backend!
```

## License

MIT - see [LICENSE](./LICENSE) for details.
