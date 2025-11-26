# ai.matey.backend.azure-openai

Azure-openai backend adapter for AI Matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.backend.azure-openai
```

## Usage

```typescript
import { AzureOpenaiBackendAdapter } from 'ai.matey.backend.azure-openai';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AzureOpenaiBackendAdapter({
    apiKey: process.env.API_KEY,
  })
);

const response = await bridge.chat({
  model: 'model-name',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## Configuration

| Option | Type | Description |
|--------|------|-------------|
| `apiKey` | string | API key for authentication |
| `baseUrl` | string | Optional custom base URL |

## Supported Models

See the provider's documentation for available models.

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
