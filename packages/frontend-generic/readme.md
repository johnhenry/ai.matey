# ai.matey.frontend.generic

Generic passthrough frontend adapter for the AI Matey universal adapter system.

## Installation

```bash
npm install ai.matey.frontend.generic
```

## Overview

This frontend adapter accepts and returns IR (Intermediate Representation) format directly, without any provider-specific conversions. It's the "identity" adapter - what goes in comes out unchanged.

**Use cases:**
- Work directly with universal IR format
- Test bridges and backends without conversion overhead
- Build tools that operate at the IR level
- Applications that already produce IR-formatted requests

## Quick Start

```typescript
import { GenericFrontendAdapter } from 'ai.matey.frontend.generic';
import { Bridge } from 'ai.matey.core';
import { OpenAIBackend } from 'ai.matey.backend.openai';

// Create the generic frontend
const frontend = new GenericFrontendAdapter();

// Create a bridge
const bridge = new Bridge(frontend, new OpenAIBackend({
  apiKey: process.env.OPENAI_API_KEY
}));

// Request using IR format directly
const response = await bridge.chat({
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello!' }
  ],
  parameters: {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000,
  },
  metadata: {
    requestId: crypto.randomUUID(),
    timestamp: Date.now(),
    provenance: {},
  },
});

// Response is also in IR format
console.log(response.message.content);
console.log(response.usage?.totalTokens);
```

## Comparison with Provider-Specific Frontends

| Frontend | Input Format | Output Format | Use When |
|----------|--------------|---------------|----------|
| `frontend-openai` | OpenAI API format | OpenAI API format | Building OpenAI-compatible APIs |
| `frontend-anthropic` | Anthropic API format | Anthropic API format | Building Anthropic-compatible APIs |
| **`frontend-generic`** | **IR format** | **IR format** | Working directly with universal IR |

## Configuration

```typescript
const frontend = new GenericFrontendAdapter({
  // Custom name for provenance tracking
  name: 'my-app-frontend',

  // Enable request validation
  validateRequests: true,

  // Track provenance (default: true)
  trackProvenance: true,

  // Report capabilities
  maxContextTokens: 128000,
  supportedModels: ['gpt-4', 'claude-3-opus'],
});
```

## API

### GenericFrontendAdapter

```typescript
class GenericFrontendAdapter implements FrontendAdapter<IRChatRequest, IRChatResponse, IRStreamChunk> {
  constructor(config?: GenericFrontendConfig);

  // Passthrough methods (no conversion)
  toIR(request: IRChatRequest): Promise<IRChatRequest>;
  fromIR(response: IRChatResponse): Promise<IRChatResponse>;
  fromIRStream(stream: IRChatStream): AsyncGenerator<IRStreamChunk>;

  // Optional validation
  validate(request: IRChatRequest): Promise<void>;

  // Metadata
  readonly metadata: AdapterMetadata;
}
```

### Factory Function

```typescript
import { createGenericFrontend } from 'ai.matey.frontend.generic';

const frontend = createGenericFrontend({
  name: 'my-frontend',
});
```

## When to Use

✅ **Use frontend-generic when:**
- Your application already works with IR format
- You want to test backends without format conversion
- You're building developer tools at the IR level
- You need a simple, zero-overhead frontend

❌ **Don't use when:**
- You need to expose an OpenAI-compatible API (use `frontend-openai`)
- You need to expose an Anthropic-compatible API (use `frontend-anthropic`)
- You're building a drop-in replacement for a specific provider

## License

MIT
