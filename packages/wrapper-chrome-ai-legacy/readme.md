# ai.matey.wrapper.chrome-ai-legacy

Legacy Chrome AI API wrapper

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.wrapper.chrome-ai-legacy
```

## Quick Start

```typescript
import { ChromeAILegacyWrapper } from 'ai.matey.wrapper.chrome-ai-legacy';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';

// Create an SDK-compatible client backed by any adapter
const client = ChromeAILegacyWrapper(
  new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
);

// Use the same API as the official SDK
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## API Reference

### ChromeAILegacyWrapper

Creates an SDK-compatible client wrapper.

```typescript
ChromeAILegacyWrapper(backend: BackendAdapter, config?: WrapperConfig): Client
```

## Exports

- `ChromeAILegacyWrapper`

## Use Cases

### Migrate Existing Code

Replace your existing SDK import with ai.matey wrapper:

```typescript
// Before
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: '...' });

// After
import { ChromeAILegacyWrapper } from 'ai.matey.wrapper.chrome-ai-legacy';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
const client = ChromeAILegacyWrapper(new AnthropicBackendAdapter({ apiKey: '...' }));

// Same API, different backend!
```

## License

MIT - see [LICENSE](./LICENSE) for details.
