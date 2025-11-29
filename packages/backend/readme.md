# ai.matey.backend

Server-side backend provider adapters for AI Matey - Universal AI Adapter System.

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.backend
```

## Included Providers

This package includes adapters for **24 AI providers**:

### Commercial APIs
- **OpenAI** - GPT-4, GPT-4 Turbo, GPT-3.5
- **Anthropic** - Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku
- **Google Gemini** - Gemini Pro, Gemini Ultra
- **Mistral AI** - Mistral Large, Medium, Small
- **Cohere** - Command, Command-Light, Command-R
- **xAI** - Grok models
- **AI21 Labs** - Jurassic models

### Cloud Providers
- **AWS Bedrock** - Amazon's managed AI service
- **Azure OpenAI** - Microsoft's OpenAI deployment
- **Cloudflare Workers AI** - Edge AI deployment

### Fast Inference
- **Groq** - Ultra-fast LLaMA, Mixtral inference
- **Fireworks AI** - Fast inference platform
- **Together AI** - Open model hosting
- **Anyscale** - Fast endpoints
- **DeepInfra** - High-performance inference
- **Cerebras** - AI supercomputer inference

### Aggregators
- **OpenRouter** - Multi-provider routing and fallback
- **Perplexity** - Search-augmented models

### Specialized
- **Replicate** - ML model deployment
- **NVIDIA NIM** - NVIDIA inference microservices
- **Hugging Face** - Open model inference
- **DeepSeek** - Research models

### Local/Development
- **Ollama** - Local model hosting
- **LM Studio** - Local desktop inference

For browser-compatible adapters (Chrome AI, Function, Mock), see [`ai.matey.backend.browser`](../backend-browser).

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
