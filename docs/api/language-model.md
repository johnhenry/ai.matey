# Language Model API

The `window.ai.languageModel` API provides direct access to Chrome's built-in AI capabilities, specifically the Gemini Nano model. This low-level API allows for direct interaction with the language model for custom AI applications.

## Type Definitions

```typescript
interface AIConfig {
  endpoint?: string;
  credentials?: {
    apiKey: string;
    [key: string]: any;
  };
  model?: string;
}

interface AILanguageModelCapabilities {
  available: "no" | "readily" | "after-download";
  defaultTopK: number;
  maxTopK: number;
  defaultTemperature: number;
}

interface SessionOptions {
  temperature?: number; // Controls randomness in responses
  topK?: number; // Controls diversity of responses
  signal?: AbortSignal; // For cancelling operations
  systemPrompt?: string;
  initialPrompts?: Array<{ role: string; content: string }>;
  monitor?: (monitor: EventTarget) => void;
}

interface PromptOptions {
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
}

interface Session {
  tokensSoFar: number;
  maxTokens: number;
  get tokensLeft(): number;
  prompt(prompt: string, options?: PromptOptions): Promise<string>;
  promptStreaming(
    prompt: string,
    options?: PromptOptions
  ): Promise<ReadableStream<string>>;
  destroy(): Promise<void>;
  clone(options?: SessionOptions): Promise<Session>;
}
```

## Core Functions

### capabilities()

Returns information about model availability and parameters.

**Returns:** `Promise<AILanguageModelCapabilities>`

```typescript
const capabilities = await window.ai.languageModel.capabilities();
```

### create()

Creates a new language model session.

**Parameters:**

- `options?: SessionOptions` - Configuration for the session

**Returns:** `Promise<Session>`

```typescript
const session = await window.ai.languageModel.create({
  temperature: 0.7,
  topK: 40,
  systemPrompt: "You are a helpful assistant",
});
```

## Session Methods

### prompt(prompt: string, options?: PromptOptions): Promise<string>

Sends a prompt to the model and receives a complete response.

### promptStreaming(prompt: string, options?: PromptOptions): Promise<ReadableStream<string>>

Sends a prompt and receives a streaming response.

### destroy(): Promise<void>

Cleans up the session resources.

### clone(options?: SessionOptions): Promise<Session>

Clones the current session, potentially preserving its context and configuration.

## Model Availability and Download

Check model availability using `capabilities()`:

```javascript
const { available, defaultTemperature, defaultTopK, maxTopK } =
  await window.ai.languageModel.capabilities();
```

- "no": API supported but currently unusable
- "readily": API supported and immediately usable
- "after-download": API supported but requires model download

Monitor download progress when needed:

```javascript
const session = await window.ai.languageModel.create({
  monitor(m) {
    m.addEventListener("downloadprogress", (e) => {
      console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
    });
  },
});
```

## Session Management

### Creating Sessions

Basic session creation:

```javascript
const session = await window.ai.languageModel.create();
```

With custom options:

```javascript
const session = await window.ai.languageModel.create({
  temperature: 1.2,
  topK: 3,
  systemPrompt: "You are a helpful and friendly assistant.",
  initialPrompts: [
    { role: "system", content: "Previous context here" },
    { role: "user", content: "Previous user message" },
    { role: "assistant", content: "Previous response" },
  ],
});
```

### Session Information

Monitor token usage:

```javascript
console.log(
  `${session.tokensSoFar}/${session.maxTokens} (${session.tokensLeft} left)`
);
```

Limits:

- Per prompt: 1,024 tokens
- Session context: 4,096 tokens

### Session Control

Abort a session with an AbortSignal:

```javascript
const controller = new AbortController();
const session = await window.ai.languageModel.create({
  signal: controller.signal,
});

// Later, to abort:
controller.abort();
```

## Prompting the Model

### Non-streaming Output

```javascript
const result = await session.prompt("What is the capital of France?");
console.log(result); // "The capital of France is Paris."
```

### Streaming Output

```javascript
const stream = await session.promptStreaming(
  "Write a story about space exploration."
);
for await (const chunk of stream) {
  console.log(chunk);
}
```

## Session Persistence and Cloning

Clone a session to preserve resources and state:

```javascript
const clonedSession = await session.clone();
```

## Cleanup

Always destroy sessions when done:

```javascript
await session.destroy();
```
