# ai.matey.frontend

Frontend adapters for AI Matey - Universal AI Adapter System.

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.frontend
```

## Overview

Frontend adapters convert provider-specific request formats to the Universal IR (Intermediate Representation) format used internally by AI Matey. This allows your application to accept requests in any provider's format and route them to any backend.

## Included Adapters

- **OpenAI** - OpenAI Chat Completions API format
- **Anthropic** - Anthropic Messages API format
- **Gemini** - Google Gemini API format
- **Mistral** - Mistral API format
- **Ollama** - Ollama API format
- **Chrome AI** - Chrome AI format
- **Generic** - Passthrough adapter for IR format

## Usage

```typescript
import { OpenAIFrontendAdapter, AnthropicFrontendAdapter } from 'ai.matey.frontend';
import { Bridge } from 'ai.matey.core';

// Accept OpenAI-formatted requests
const openAIFrontend = new OpenAIFrontendAdapter();

// Accept Anthropic-formatted requests
const anthropicFrontend = new AnthropicFrontendAdapter();

// Create a bridge that accepts OpenAI format
const bridge = new Bridge({
  frontend: openAIFrontend,
  backend: yourBackend,
});
```

## Generic Adapter

The Generic adapter passes IR format directly without conversion:

```typescript
import { GenericFrontendAdapter, createGenericFrontend } from 'ai.matey.frontend';

const frontend = createGenericFrontend();
```

## API Reference

See the TypeScript definitions for detailed API documentation.

## License

MIT - see [LICENSE](./LICENSE) for details.
