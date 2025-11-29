# ai.matey.backend

Server-side backend provider adapters for AI Matey - Universal AI Adapter System.

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.backend
```

## Included Providers

This package includes adapters for the following AI providers:

- **OpenAI** - GPT-4, GPT-3.5, etc.
- **Anthropic** - Claude 3, Claude 2, etc.
- **Google Gemini** - Gemini Pro, Gemini Ultra
- **Mistral** - Mistral Large, Medium, Small
- **Cohere** - Command, Command-Light
- **Groq** - LLaMA, Mixtral (fast inference)
- **Ollama** - Local model hosting
- **AWS Bedrock** - Amazon's managed AI service
- **Azure OpenAI** - Microsoft's OpenAI deployment
- **DeepSeek** - DeepSeek models
- **Fireworks** - Fast inference platform
- **Together AI** - Open model hosting
- **Perplexity** - Search-augmented models
- **OpenRouter** - Multi-provider routing
- **And more...**

For browser-compatible adapters (Chrome AI, Function, Mock), see [`ai.matey.backend.browser`](https://www.npmjs.com/package/ai.matey.backend.browser).

## Usage

```typescript
import { OpenAIBackendAdapter, AnthropicBackendAdapter } from 'ai.matey.backend';

// Create an OpenAI backend
const openaiBackend = new OpenAIBackendAdapter({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create an Anthropic backend
const anthropicBackend = new AnthropicBackendAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

## Subpath Imports

You can also import specific providers directly:

```typescript
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
```

## API Reference

See the TypeScript definitions for detailed API documentation.

## License

MIT - see [LICENSE](./LICENSE) for details.
