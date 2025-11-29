# ai.matey.types

TypeScript type definitions for the ai.matey ecosystem

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.types
```

## Exports

### Core IR Types
- `IRChatRequest` - Universal chat request format
- `IRChatResponse` - Universal chat response format
- `IRMessage` - Individual message in conversation
- `IRStreamChunk` - Streaming response chunk
- `IRParameters` - Generation parameters (temperature, maxTokens, etc.)
- `IRMetadata` - Request/response metadata and provenance
- `IRTool` - Tool/function definition
- `IRUsage` - Token usage statistics

### Adapter Interfaces
- `FrontendAdapter` - Interface for frontend adapters
- `BackendAdapter` - Interface for backend adapters
- `AdapterMetadata` - Adapter capability metadata

### Middleware
- `Middleware` - Middleware interface
- `MiddlewareContext` - Middleware execution context

### Streaming
- `StreamMode` - Streaming mode ('delta' | 'accumulated')
- `StreamingConfig` - Streaming configuration options

### Utilities
- `MessageRole` - Message role type
- `MessageContent` - Content block types
- `FinishReason` - Generation completion reasons
- `IRCapabilities` - Adapter capabilities
- `IRWarning` - Semantic drift warnings

## Usage

```typescript
import {
  IRChatRequest,
  IRChatResponse,
  IRMessage,
  IRStreamChunk,
  FrontendAdapter,
  BackendAdapter,
  Middleware
} from 'ai.matey.types';

// Create a chat request
const request: IRChatRequest = {
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
  parameters: {
    model: 'gpt-4',
    temperature: 0.7
  },
  metadata: {
    requestId: 'req_123',
    timestamp: Date.now(),
    provenance: { frontend: 'openai' }
  }
};
```

## Documentation

For comprehensive documentation of the IR format, see:
- [IR Format Guide](../../docs/IR-FORMAT.md) - Complete specification with examples
- [API Reference](../../docs/API.md) - Full API documentation
- [Type Definitions](./src/ir.ts) - Authoritative TypeScript source

## License

MIT - see [LICENSE](./LICENSE) for details.
