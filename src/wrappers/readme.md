# Universal AI Adapter Wrappers

This directory contains wrapper implementations that mimic popular AI APIs using any backend adapter. These wrappers allow you to:

- Use familiar APIs with different providers
- Test API-specific code in environments where the original API isn't available
- Create a consistent interface across all backends

---

## Chrome AI Language Model Wrapper

The Chrome AI Language Model wrapper mimics the `window.ai.languageModel` API from Chrome's built-in AI, but works with any backend adapter (OpenAI, Anthropic, Gemini, etc.).

### Why Use This?

1. **Test Chrome AI code anywhere**: Develop and test Chrome AI applications using OpenAI, Anthropic, or any other provider
2. **Fallback support**: If Chrome AI isn't available, use a cloud provider seamlessly
3. **Consistent API**: Use the same simple API regardless of which backend you're using
4. **Local development**: Test Chrome AI features without needing Chrome Canary

### Quick Start

```typescript
import { ChromeAILanguageModel } from 'ai.matey/wrappers/chrome-ai';
import { AnthropicBackendAdapter } from 'ai.matey/adapters/backend/anthropic';

// Create backend adapter
const backend = new AnthropicBackendAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Create Chrome AI-style language model
const LanguageModel = ChromeAILanguageModel(backend);

// Create a session with initial prompts (system messages)
const session = await LanguageModel.create({
  initialPrompts: [{
    role: 'system',
    content: 'You are a helpful assistant and you speak like a pirate.'
  }],
});

// Use Chrome AI-style prompt method
console.log(await session.prompt('Tell me a joke.'));
// "Avast ye, matey! What do you call a lazy pirate? A sail-bum! Ahoy there..."

// Conversation history is maintained
console.log(await session.prompt('Tell me another one!'));
// Continues the conversation...

// Clean up when done
session.destroy();
```

### API Reference

#### `ChromeAILanguageModel(backend)`

Creates a Chrome AI-compatible Language Model API using any backend adapter.

**Parameters:**
- `backend`: Any `BackendAdapter` instance (OpenAI, Anthropic, Gemini, etc.)

**Returns:** `ChromeAILanguageModelAPI`

#### `ChromeAILanguageModelAPI`

##### `create(options?)`

Creates a new text session.

**Parameters:**
- `options.initialPrompts`: Array of system messages to set context
- `options.temperature`: Temperature (0-1)
- `options.topK`: Top-K sampling parameter
- `options.topP`: Top-P sampling parameter
- `options.maxTokens`: Maximum tokens to generate
- `options.model`: Model to use (backend-specific)
- `options.streamMode`: Streaming mode - `'accumulated'` (default, Chrome AI behavior) or `'delta'` (efficient)

**Returns:** `Promise<ChromeAISession>`

##### `capabilities()`

Checks if the language model is available.

**Returns:** `Promise<{ available: 'readily' | 'after-download' | 'no' }>`

#### `ChromeAISession`

##### `prompt(input)`

Sends a prompt and gets a complete response.

**Parameters:**
- `input`: The user's prompt text

**Returns:** `Promise<string>`

##### `promptStreaming(input)`

Sends a prompt and gets a streaming response.

**Parameters:**
- `input`: The user's prompt text

**Returns:** `ReadableStream<string>`

**Streaming Modes:**

The streaming behavior depends on the `streamMode` option passed to `create()`:

- **`'accumulated'` (default)**: Streams the full content accumulated so far on each chunk (Chrome AI behavior)
  - Use when you need Chrome AI compatibility
  - Each chunk contains all text from the start

- **`'delta'`**: Streams only new content chunks (standard streaming)
  - Use for terminal/console output (most efficient)
  - Each chunk contains only new text
  - Perfect for `process.stdout.write(chunk)`

##### `destroy()`

Destroys the session and cleans up resources.

##### `clone()`

Clones the session with the same configuration (system prompts only, not conversation history).

**Returns:** `Promise<ChromeAISession>`

### Examples

#### Basic Usage

```typescript
const backend = new OpenAIBackendAdapter({ apiKey: 'sk-...' });
const LanguageModel = ChromeAILanguageModel(backend);

const session = await LanguageModel.create({
  initialPrompts: [
    { role: 'system', content: 'You are a helpful coding assistant.' }
  ],
});

const answer = await session.prompt('What is 2+2?');
console.log(answer); // "2+2 equals 4."

session.destroy();
```

#### Streaming (Accumulated Mode - Chrome AI Default)

```typescript
const backend = new AnthropicBackendAdapter({ apiKey: 'sk-ant-...' });
const LanguageModel = ChromeAILanguageModel(backend);

const session = await LanguageModel.create({
  temperature: 0.7,
  streamMode: 'accumulated', // Default, can be omitted
});

const stream = session.promptStreaming('Write a haiku about coding.');
const reader = stream.getReader();

try {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log(value); // Full content so far (Chrome AI behavior)
  }
} finally {
  reader.releaseLock();
  session.destroy();
}
```

#### Streaming (Delta Mode - Efficient)

```typescript
const backend = new AnthropicBackendAdapter({ apiKey: 'sk-ant-...' });
const LanguageModel = ChromeAILanguageModel(backend);

const session = await LanguageModel.create({
  temperature: 0.7,
  streamMode: 'delta', // Only stream new chunks
});

// Perfect for terminal output
const stream = session.promptStreaming('Tell me a joke.');
for await (const chunk of stream) {
  process.stdout.write(chunk); // No duplication!
}

session.destroy();
```

#### Conversation History

```typescript
const backend = new GeminiBackendAdapter({ apiKey: 'AIza...' });
const LanguageModel = ChromeAILanguageModel(backend);

const session = await LanguageModel.create({
  initialPrompts: [
    { role: 'system', content: 'You are a math tutor.' }
  ],
});

console.log(await session.prompt('What is 5 * 3?'));
// "5 multiplied by 3 equals 15."

console.log(await session.prompt('What if I add 10 to that?'));
// "If you add 10 to 15, you get 25."
// ^ Note: Context is maintained!

session.destroy();
```

#### Check Capabilities

```typescript
const backend = new OllamaBackendAdapter({ baseURL: 'http://localhost:11434' });
const LanguageModel = ChromeAILanguageModel(backend);

const capabilities = await LanguageModel.capabilities();
console.log(capabilities.available); // "readily" or "no"
```

#### Clone Session

```typescript
const session1 = await LanguageModel.create({
  initialPrompts: [
    { role: 'system', content: 'You are helpful.' }
  ],
});

await session1.prompt('My name is Alice.');

// Clone preserves system prompts but not conversation history
const session2 = await session1.clone();
await session2.prompt('What is my name?');
// "I don't know your name..."

session1.destroy();
session2.destroy();
```

#### Convenience API

```typescript
import { createChromeAILanguageModel } from 'ai.matey/wrappers/chrome-ai';

const backend = new AnthropicBackendAdapter({ apiKey: 'sk-ant-...' });
const ai = createChromeAILanguageModel(backend);

// Use like window.ai in Chrome
const session = await ai.languageModel.create({
  initialPrompts: [{ role: 'system', content: 'Be concise.' }],
});

console.log(await session.prompt('What is TypeScript?'));
session.destroy();
```

### Comparison with Chrome AI

| Feature | Chrome AI | This Wrapper |
|---------|-----------|--------------|
| API interface | ✅ Identical | ✅ Identical |
| Session management | ✅ Yes | ✅ Yes |
| Conversation history | ✅ Maintained | ✅ Maintained |
| Streaming | ✅ Accumulated chunks | ✅ Accumulated OR delta |
| Streaming modes | 🔒 Accumulated only | ✅ Both modes |
| System prompts | ✅ initialPrompts | ✅ initialPrompts |
| Backend | 🔒 Chrome only | ✅ Any provider |
| Availability | ⚠️ Chrome 129+ | ✅ Everywhere |
| Cost | 🆓 Free (local) | 💵 Varies by provider |
| Privacy | 🔒 Local | ⚠️ Provider-dependent |

### Use Cases

1. **Chrome AI Development**: Develop Chrome AI features using cloud providers during development
2. **Progressive Enhancement**: Start with Chrome AI, fall back to cloud providers when unavailable
3. **Testing**: Test Chrome AI applications in CI/CD without Chrome browser
4. **Cross-Platform**: Use Chrome AI API on Node.js, Deno, or other environments
5. **Multi-Provider**: Easy switching between providers without API changes

### Notes

- **Conversation History**: Each session maintains its own conversation history automatically
- **System Prompts**: Use `initialPrompts` to set system messages (context for the entire session)
- **Streaming Modes**:
  - `'accumulated'` (default): Chrome AI behavior - streams full content so far
  - `'delta'`: Efficient mode - streams only new chunks (perfect for terminal output)
- **Session Cloning**: `clone()` copies system prompts only, not conversation history
- **Error Handling**: Throws errors for destroyed sessions and provider failures
- **Backend Requirements**: Any `BackendAdapter` works (must implement `execute` and `executeStream`)

### TypeScript Types

All types are fully typed and exported:

```typescript
import type {
  ChromeAIPrompt,
  ChromeAICreateOptions,
  ChromeAISession,
  ChromeAILanguageModelAPI,
  StreamMode, // 'delta' | 'accumulated'
} from 'ai.matey/wrappers/chrome-ai';
```

---

## OpenAI SDK Wrapper

Mimics the OpenAI SDK interface (`client.chat.completions.create()`) using any backend adapter.

### Why Use This?

1. **Use OpenAI SDK code with any provider**: Write once using OpenAI's familiar interface
2. **Easy migration**: Existing OpenAI SDK code works instantly
3. **Provider flexibility**: Switch from OpenAI to Anthropic/Gemini/etc without code changes
4. **Type-safe**: Full TypeScript support matching OpenAI SDK types

### Quick Start

```typescript
import { OpenAI } from 'ai.matey/wrappers/openai-sdk';
import { AnthropicBackendAdapter } from 'ai.matey';

// Use OpenAI SDK style with Anthropic backend!
const backend = new AnthropicBackendAdapter({ apiKey: 'sk-ant-...' });
const client = OpenAI(backend);

const completion = await client.chat.completions.create({
  model: 'claude-3-5-sonnet',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
});

console.log(completion.choices[0].message.content);
```

### API Reference

#### `OpenAI(backend, config?)`

Creates an OpenAI SDK-compatible client.

**Parameters:**
- `backend`: Any `BackendAdapter` instance
- `config.streamMode`: Optional streaming mode ('delta' | 'accumulated')

**Returns:** `OpenAIClient` with `chat.completions.create()` method

### Streaming Support

```typescript
const stream = client.chat.completions.create({
  model: 'claude-3-5-sonnet',
  messages: [{ role: 'user', content: 'Count to 5' }],
  stream: true, // Enable streaming
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}
```

### Supported Parameters

- `model`: Model name (backend-specific)
- `messages`: Array of `{role, content}` messages
- `temperature`: Temperature (0-2)
- `max_tokens`: Maximum tokens to generate
- `top_p`: Top-P sampling
- `frequency_penalty`: Frequency penalty
- `presence_penalty`: Presence penalty
- `stop`: Stop sequences
- `stream`: Enable streaming
- `user`: User identifier

---

## Anthropic SDK Wrapper

Mimics the Anthropic SDK interface (`client.messages.create()`) using any backend adapter.

### Why Use This?

1. **Use Anthropic SDK code with any provider**: Write once using Anthropic's interface
2. **Easy migration**: Existing Anthropic SDK code works instantly
3. **Provider flexibility**: Switch from Anthropic to OpenAI/Gemini/etc without code changes
4. **Type-safe**: Full TypeScript support matching Anthropic SDK types

### Quick Start

```typescript
import { Anthropic } from 'ai.matey/wrappers/anthropic-sdk';
import { OpenAIBackendAdapter } from 'ai.matey';

// Use Anthropic SDK style with OpenAI backend!
const backend = new OpenAIBackendAdapter({ apiKey: 'sk-...' });
const client = Anthropic(backend);

const message = await client.messages.create({
  model: 'gpt-4o',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Hello, Claude!' }
  ],
});

console.log(message.content[0].text);
```

### API Reference

#### `Anthropic(backend, config?)`

Creates an Anthropic SDK-compatible client.

**Parameters:**
- `backend`: Any `BackendAdapter` instance
- `config.streamMode`: Optional streaming mode ('delta' | 'accumulated')

**Returns:** `AnthropicClient` with `messages.create()` method

### Streaming Support

```typescript
const stream = client.messages.create({
  model: 'gpt-4o',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Count to 5' }],
  stream: true, // Enable streaming
});

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    process.stdout.write(event.delta.text);
  }
}
```

### Supported Parameters

- `model`: Model name (backend-specific)
- `messages`: Array of `{role, content}` messages
- `max_tokens`: Maximum tokens (required)
- `system`: System message (optional)
- `temperature`: Temperature
- `top_p`: Top-P sampling
- `top_k`: Top-K sampling
- `stop_sequences`: Stop sequences
- `stream`: Enable streaming

### Streaming Events

When streaming, the Anthropic wrapper emits these events:

- `message_start`: Stream begins
- `content_block_start`: Content block starts
- `content_block_delta`: Content delta (contains new text)
- `content_block_stop`: Content block ends
- `message_delta`: Message metadata (stop reason, usage)
- `message_stop`: Stream ends

---

## Comparison Matrix

| Wrapper | Interface | Best For | Streaming Style |
|---------|-----------|----------|-----------------|
| **Chrome AI** | `session.prompt()` | Simple chat apps, Chrome compatibility | Accumulated or delta |
| **OpenAI SDK** | `client.chat.completions.create()` | OpenAI migrations, familiar interface | Delta chunks |
| **Anthropic SDK** | `client.messages.create()` | Anthropic migrations, event-based streaming | Event stream |

---

## Use Cases

### 1. Provider Migration

```typescript
// Before: OpenAI SDK
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: '...' });

// After: Universal with Anthropic
import { OpenAI, AnthropicBackendAdapter } from 'ai.matey';
const client = OpenAI(new AnthropicBackendAdapter({ apiKey: '...' }));
// Same code works!
```

### 2. Multi-Provider Support

```typescript
import { OpenAI, AnthropicBackendAdapter, OpenAIBackendAdapter } from 'ai.matey';

const backend = process.env.USE_ANTHROPIC
  ? new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
  : new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY });

const client = OpenAI(backend);
// Code works with either provider!
```

### 3. Testing with Local Models

```typescript
import { Anthropic, OllamaBackendAdapter } from 'ai.matey';

const backend = new OllamaBackendAdapter({ baseURL: 'http://localhost:11434' });
const client = Anthropic(backend);

// Test Anthropic SDK code using local Ollama!
```

---

## Future Wrappers

Additional wrappers may be added, such as:

- Google Gemini SDK wrapper
- Mistral SDK wrapper
- LangChain-compatible wrapper
- Vertex AI wrapper

If you'd like to contribute a wrapper, please open a pull request!
