# ai.matey.frontend.gemini

Frontend adapter for Gemini-compatible request format

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.frontend.gemini
```

## Quick Start

```typescript
import { GeminiFrontendAdapter } from 'ai.matey.frontend.gemini';
import { Bridge } from 'ai.matey.core';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

// Create a bridge that accepts Gemini format requests
const bridge = new Bridge(
  new GeminiFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);
```

## API Reference

### GeminiFrontendAdapter

Converts incoming requests from Gemini format to the internal IR format.

#### Constructor

```typescript
new GeminiFrontendAdapter()
```

#### Methods

##### `toIR(request: ProviderRequest): IRChatRequest`

Convert a provider-specific request to the internal IR format.

##### `fromIR(response: IRChatResponse): ProviderResponse`

Convert an IR response back to the provider-specific format.

##### `fromIRStream(chunk: IRStreamChunk): ProviderStreamChunk`

Convert an IR stream chunk to the provider-specific format.

## Use Cases

### Accept OpenAI Format, Use Any Backend

```typescript
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
import { Bridge } from 'ai.matey.core';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
);

// Client sends OpenAI format, ai.matey translates to Anthropic
const response = await bridge.chat({
  model: 'gpt-4',  // Will be mapped to Claude
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## License

MIT - see [LICENSE](./LICENSE) for details.
