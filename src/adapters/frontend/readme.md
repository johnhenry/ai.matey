# Frontend Adapters

Frontend adapters convert provider-specific request formats into the Universal Intermediate Representation (IR).

## Overview

A frontend adapter allows you to use a specific provider's API format (e.g., OpenAI, Anthropic) while executing the request on any backend provider through the Universal IR.

```typescript
// Your code uses OpenAI format
const request = {
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
};

// Frontend adapter converts to IR
const irRequest = await frontendAdapter.toIR(request);

// Backend executes (any provider)
const irResponse = await backend.execute(irRequest);

// Frontend adapter converts back
const response = await frontendAdapter.fromIR(irResponse);
```

## Available Frontend Adapters

| Adapter | Provider | Multi-Modal | Streaming | Tools |
|---------|----------|-------------|-----------|-------|
| [OpenAI](#openai-frontend-adapter) | OpenAI | ✅ | ✅ | ✅ |
| [Anthropic](#anthropic-frontend-adapter) | Anthropic | ✅ | ✅ | ✅ |
| [Gemini](#gemini-frontend-adapter) | Google | ✅ | ✅ | ✅ |
| [Mistral](#mistral-frontend-adapter) | Mistral AI | ❌ | ✅ | ✅ |
| [Ollama](#ollama-frontend-adapter) | Ollama | ❌ | ✅ | ❌ |
| [Chrome AI](#chrome-ai-frontend-adapter) | Browser | ❌ | ✅ | ❌ |

---

## OpenAI Frontend Adapter

Convert OpenAI Chat Completions API format to/from Universal IR.

### Usage

```typescript
import { OpenAIFrontendAdapter } from 'ai.matey';

const frontend = new OpenAIFrontendAdapter();

// OpenAI format request
const request = {
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'What is 2+2?' }
  ],
  temperature: 0.7,
  max_tokens: 100
};

// Convert to IR
const irRequest = await frontend.toIR(request);

// Execute with any backend...
const irResponse = await backend.execute(irRequest);

// Convert back to OpenAI format
const response = await frontend.fromIR(irResponse);
console.log(response.choices[0].message.content);
```

### Streaming

```typescript
const request = {
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true
};

const irRequest = await frontend.toIR(request);
const irStream = backend.executeStream(irRequest);

// Convert stream to OpenAI format
for await (const chunk of frontend.fromIRStream(irStream)) {
  if (chunk.choices[0]?.delta?.content) {
    process.stdout.write(chunk.choices[0].delta.content);
  }
}
```

### Supported Parameters

- `model` - Model identifier
- `messages` - Conversation messages
- `temperature` - Sampling temperature (0-2)
- `max_tokens` - Maximum tokens to generate
- `top_p` - Nucleus sampling
- `frequency_penalty` - Frequency penalty (-2 to 2)
- `presence_penalty` - Presence penalty (-2 to 2)
- `stop` - Stop sequences (string or array)
- `stream` - Enable streaming
- `user` - User identifier
- `seed` - Random seed for deterministic output

### Features

- ✅ System messages (in messages array)
- ✅ Multi-modal (text + images)
- ✅ Tool calling
- ✅ Streaming with SSE format
- ✅ Stop sequences (max 4)
- ✅ Frequency and presence penalties

### Notes

- OpenAI format is very similar to the Universal IR, so this adapter is mostly pass-through
- System messages are kept in the messages array (OpenAI's native format)
- Image URLs and base64 data are both supported

---

## Anthropic Frontend Adapter

Convert Anthropic Messages API format to/from Universal IR.

### Usage

```typescript
import { AnthropicFrontendAdapter } from 'ai.matey';

const frontend = new AnthropicFrontendAdapter();

// Anthropic format request
const request = {
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  system: 'You are helpful.',
  messages: [
    { role: 'user', content: 'What is 2+2?' }
  ]
};

const irRequest = await frontend.toIR(request);
const irResponse = await backend.execute(irRequest);
const response = await frontend.fromIR(irResponse);
```

### Supported Parameters

- `model` - Model identifier
- `messages` - Conversation messages (user/assistant only)
- `system` - System prompt (separate parameter)
- `max_tokens` - Maximum tokens to generate (**required**)
- `temperature` - Sampling temperature (0-1)
- `top_p` - Nucleus sampling
- `top_k` - Top-K sampling
- `stop_sequences` - Stop sequences (max 4)
- `stream` - Enable streaming

### Features

- ✅ System prompt as separate parameter
- ✅ Multi-modal (text + images)
- ✅ Tool calling
- ✅ Streaming with SSE events
- ✅ Top-K sampling
- ❌ Frequency/presence penalties (not supported by Anthropic)

### Notes

- System messages are extracted from messages array and placed in `system` parameter
- `max_tokens` is required by Anthropic API
- Message roles are limited to `user` and `assistant` (system is separate)

---

## Gemini Frontend Adapter

Convert Google Gemini API format to/from Universal IR.

### Usage

```typescript
import { GeminiFrontendAdapter } from 'ai.matey';

const frontend = new GeminiFrontendAdapter();

// Gemini format request
const request = {
  model: 'gemini-pro',
  contents: [
    {
      role: 'user',
      parts: [{ text: 'What is 2+2?' }]
    }
  ],
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 100
  }
};

const irRequest = await frontend.toIR(request);
```

### Supported Parameters

- `model` - Model identifier
- `contents` - Conversation contents (Gemini's message format)
- `generationConfig` - Generation configuration
  - `temperature` - Sampling temperature
  - `maxOutputTokens` - Maximum tokens to generate
  - `topP` - Nucleus sampling
  - `topK` - Top-K sampling
  - `stopSequences` - Stop sequences

### Features

- ✅ Multi-modal (text + images)
- ✅ Tool calling (function declarations)
- ✅ Streaming
- ✅ System instructions
- ✅ Top-K sampling

### Notes

- Gemini uses `contents` with `parts` instead of simple messages
- System instructions are separate from contents
- Roles are `user` and `model` (mapped to `assistant` in IR)

---

## Mistral Frontend Adapter

Convert Mistral AI API format to/from Universal IR.

### Usage

```typescript
import { MistralFrontendAdapter } from 'ai.matey';

const frontend = new MistralFrontendAdapter();

// Mistral format request
const request = {
  model: 'mistral-small',
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'What is 2+2?' }
  ],
  temperature: 0.7,
  max_tokens: 100
};

const irRequest = await frontend.toIR(request);
```

### Supported Parameters

- `model` - Model identifier
- `messages` - Conversation messages
- `temperature` - Sampling temperature (0-1)
- `max_tokens` - Maximum tokens to generate
- `top_p` - Nucleus sampling
- `stream` - Enable streaming
- `random_seed` - Random seed
- `safe_prompt` - Enable safety mode

### Features

- ✅ System messages (in messages array)
- ✅ Tool calling
- ✅ Streaming
- ✅ Random seed for reproducibility
- ❌ Multi-modal (text only)

### Notes

- Similar to OpenAI format but with Mistral-specific features
- System messages kept in messages array
- Supports `safe_prompt` for content filtering

---

## Ollama Frontend Adapter

Convert Ollama API format to/from Universal IR.

### Usage

```typescript
import { OllamaFrontendAdapter } from 'ai.matey';

const frontend = new OllamaFrontendAdapter();

// Ollama format request
const request = {
  model: 'llama2',
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'What is 2+2?' }
  ],
  options: {
    temperature: 0.7,
    num_predict: 100
  }
};

const irRequest = await frontend.toIR(request);
```

### Supported Parameters

- `model` - Model identifier (local model name)
- `messages` - Conversation messages
- `options` - Model options
  - `temperature` - Sampling temperature
  - `num_predict` - Maximum tokens to generate
  - `top_p` - Nucleus sampling
  - `top_k` - Top-K sampling
  - `stop` - Stop sequences

### Features

- ✅ System messages
- ✅ Streaming (JSONL format)
- ✅ Top-K sampling
- ✅ Local model execution
- ❌ Multi-modal (text only)
- ❌ Tool calling (not supported by Ollama)

### Notes

- Designed for local Ollama deployments
- Parameters are in `options` object (Ollama convention)
- `num_predict` maps to `maxTokens` in IR
- Streaming uses JSONL format instead of SSE

---

## Chrome AI Frontend Adapter

Convert Chrome AI (Browser API) format to/from Universal IR.

### Usage

```typescript
import { ChromeAIFrontendAdapter } from 'ai.matey';

const frontend = new ChromeAIFrontendAdapter();

// Chrome AI format request
const request = {
  prompt: 'What is 2+2?',
  systemPrompt: 'You are helpful.',
  temperature: 0.7,
  topK: 40
};

const irRequest = await frontend.toIR(request);
```

### Supported Parameters

- `prompt` - User prompt (single message)
- `systemPrompt` - System instruction
- `temperature` - Sampling temperature
- `topK` - Top-K sampling

### Features

- ✅ System prompt
- ✅ Streaming
- ✅ Browser-native (no API keys)
- ❌ Multi-turn conversations (single prompt only)
- ❌ Multi-modal (text only)
- ❌ Tool calling

### Notes

- Chrome AI is a browser-only API (requires Chrome 127+)
- Experimental and subject to change
- Simplified interface compared to other providers
- Single-turn conversations (no message history)

---

## Creating Custom Frontend Adapters

To create a custom frontend adapter, implement the `FrontendAdapter` interface:

```typescript
import type { FrontendAdapter, AdapterMetadata } from 'ai.matey';
import type { IRChatRequest, IRChatResponse } from 'ai.matey';

export class CustomFrontendAdapter implements FrontendAdapter<CustomRequest, CustomResponse> {
  readonly metadata: AdapterMetadata = {
    name: 'custom-frontend',
    version: '1.0.0',
    provider: 'Custom Provider',
    capabilities: {
      streaming: true,
      multiModal: false,
      tools: false,
      systemMessageStrategy: 'in-messages',
      // ... more capabilities
    },
  };

  async toIR(request: CustomRequest): Promise<IRChatRequest> {
    // Convert provider format → IR
  }

  async fromIR(response: IRChatResponse): Promise<CustomResponse> {
    // Convert IR → provider format
  }

  async *fromIRStream(stream: AsyncGenerator<IRStreamChunk>): AsyncGenerator<CustomStreamChunk> {
    // Convert IR stream → provider stream format
  }
}
```

See [../../types/adapters.ts](../../types/adapters.ts) for full interface details.
