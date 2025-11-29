# ai.matey.wrapper

SDK wrappers and utilities for AI Matey - Universal AI Adapter System.

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.wrapper
```

## Overview

This package provides SDK-compatible wrappers that let you use familiar SDK patterns (like OpenAI's or Anthropic's) with any AI Matey backend. It also includes IR-native chat utilities for direct usage.

## Included Components

### SDK Wrappers
- **OpenAI SDK Wrapper** - Use OpenAI SDK patterns with any backend
- **Anthropic SDK Wrapper** - Use Anthropic SDK patterns with any backend
- **Chrome AI Wrapper** - Simplified Chrome AI interface
- **AnyMethod Wrapper** - Flexible method-based wrapper

### IR Utilities
- **Chat** - High-level chat interface with conversation management
- **Stream Utilities** - Stream processing helpers

## Usage

### OpenAI SDK Wrapper

```typescript
import { OpenAI } from 'ai.matey.wrapper';

const client = new OpenAI({ backend: yourBackend });

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Anthropic SDK Wrapper

```typescript
import { Anthropic } from 'ai.matey.wrapper';

const client = new Anthropic({ backend: yourBackend });

const response = await client.messages.create({
  model: 'claude-3-opus',
  messages: [{ role: 'user', content: 'Hello!' }],
  max_tokens: 1024,
});
```

### IR Chat Interface

```typescript
import { Chat, createChat } from 'ai.matey.wrapper';

const chat = createChat({ backend: yourBackend });

// Send a message
const response = await chat.send('Hello!');

// Stream a response
for await (const chunk of chat.stream('Tell me a story')) {
  process.stdout.write(chunk.delta);
}
```

### Stream Utilities

```typescript
import { collectStream, streamToText } from 'ai.matey.wrapper';

// Collect all chunks from a stream
const collected = await collectStream(stream);

// Convert stream to text
const text = await streamToText(stream);
```

## API Reference

See the TypeScript definitions for detailed API documentation.

## License

MIT - see [LICENSE](./LICENSE) for details.
