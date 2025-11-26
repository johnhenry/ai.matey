# ai.matey.wrapper.anymethod

Dynamic method wrapper for flexible API patterns

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.wrapper.anymethod
```

## Quick Start

```typescript
import { AnyMethodWrapper } from 'ai.matey.wrapper.anymethod';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';

// Create an SDK-compatible client backed by any adapter
const client = AnyMethodWrapper(
  new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
);

// Use the same API as the official SDK
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## API Reference

### AnyMethodWrapper

Creates an SDK-compatible client wrapper.

```typescript
AnyMethodWrapper(backend: BackendAdapter, config?: WrapperConfig): Client
```

## Exports

- `AnyMethodWrapper`

## Use Cases

### Migrate Existing Code

Replace your existing SDK import with ai.matey wrapper:

```typescript
// Before
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: '...' });

// After
import { AnyMethodWrapper } from 'ai.matey.wrapper.anymethod';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
const client = AnyMethodWrapper(new AnthropicBackendAdapter({ apiKey: '...' }));

// Same API, different backend!
```

## License

MIT - see [LICENSE](./LICENSE) for details.
